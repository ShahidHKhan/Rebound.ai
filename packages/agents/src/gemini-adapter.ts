import { FunctionCallingConfigMode, GoogleGenAI } from "@google/genai";
import type { Content, FunctionDeclaration, Part, Tool as GeminiTool } from "@google/genai";
import type Anthropic from "@anthropic-ai/sdk";

export const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function isGeminiModel(model: string): boolean {
  return model.startsWith("gemini-");
}

function toGeminiContents(messages: Anthropic.MessageParam[]): Content[] {
  // Gemini's functionResponse needs the function *name*, but Anthropic's
  // tool_result only carries the originating tool_use_id — rebuild the
  // mapping from this same message history (which only ever contains
  // tool_use blocks this adapter itself synthesized on a prior turn).
  const idToName = new Map<string, string>();
  for (const message of messages) {
    if (message.role !== "assistant" || typeof message.content === "string") continue;
    for (const block of message.content) {
      if (block.type === "tool_use") idToName.set(block.id, block.name);
    }
  }

  return messages.map((message): Content => {
    const role = message.role === "assistant" ? "model" : "user";
    if (typeof message.content === "string") {
      return { role, parts: [{ text: message.content }] };
    }

    const parts: Part[] = message.content.map((block): Part => {
      if (block.type === "text") return { text: block.text };

      if (block.type === "tool_use") {
        // id matters, not just name: Gemini 3.x populates FunctionCall.id
        // and expects the matching FunctionResponse.id back on the next
        // turn — omitting it produced a live 400 INVALID_ARGUMENT once a
        // retry round-trip actually happened (confirmed 2026-08-20).
        //
        // thoughtSignature (opaque, attached by callGemini below when this
        // block was first synthesized) must also round-trip verbatim on any
        // *multi-step* tool-calling turn (search_exercises then submit_*) —
        // Gemini 3.x rejects a functionCall part missing it with a 400,
        // confirmed live. Anthropic.ToolUseBlock has no field for this, so
        // it's smuggled through as an extra runtime property; safe because
        // this message history only ever holds blocks this adapter itself
        // produced (flow-a.ts/flow-b.ts push response.content verbatim).
        const thoughtSignature = (block as { _geminiThoughtSignature?: string })._geminiThoughtSignature;
        return {
          functionCall: { id: block.id, name: block.name, args: block.input as Record<string, unknown> },
          ...(thoughtSignature ? { thoughtSignature } : {}),
        };
      }

      if (block.type === "tool_result") {
        const name = idToName.get(block.tool_use_id) ?? "unknown_tool";
        const raw = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
        return {
          functionResponse: {
            id: block.tool_use_id,
            name,
            response: block.is_error ? { error: parsed } : { output: parsed },
          },
        };
      }

      throw new Error(`Unsupported content block type for Gemini translation: ${(block as { type: string }).type}`);
    });

    return { role, parts };
  });
}

// params.tools is typed as Anthropic.ToolUnion[] (custom tools plus
// built-in ones like code execution, which have no input_schema) — this
// codebase only ever defines custom tools, so narrow to those at runtime.
function toGeminiTools(tools: Anthropic.MessageCreateParamsNonStreaming["tools"]): GeminiTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  const customTools = tools.filter((tool): tool is Anthropic.Tool => "input_schema" in tool);
  const functionDeclarations: FunctionDeclaration[] = customTools.map((tool) => ({
    name: tool.name,
    description: typeof tool.description === "string" ? tool.description : undefined,
    parametersJsonSchema: tool.input_schema,
  }));
  return [{ functionDeclarations }];
}

function toGeminiToolConfig(toolChoice: Anthropic.MessageCreateParamsNonStreaming["tool_choice"]) {
  if (!toolChoice) return undefined;
  if (toolChoice.type === "tool") {
    return { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: [toolChoice.name] } };
  }
  if (toolChoice.type === "any") {
    return { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } };
  }
  // "auto" is Gemini's default behavior already — nothing to set.
  return undefined;
}

function mapFinishReason(finishReason: string | undefined, hasToolUse: boolean): Anthropic.Message["stop_reason"] {
  if (hasToolUse) return "tool_use";
  if (finishReason === "MAX_TOKENS") return "max_tokens";
  return "end_turn";
}

// Translates one call through the same request/response shape the rest of
// packages/agents already speaks (Anthropic's types), so flow-a.ts,
// flow-b.ts, and every tool file need zero changes — only the model id
// string picks the provider (see isGeminiModel / llm-call-logger.ts).
// Straight-swap in spirit (no formal multi-file adapter interface), but the
// translation has to live somewhere, and doing it once here beats
// duplicating every flow's loop per provider. Not yet verified against a
// real API key — see HANDOFF for the provider-swap session this came from.
export async function callGemini(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  const contents = toGeminiContents(params.messages);
  const tools = toGeminiTools(params.tools);
  const toolConfig = toGeminiToolConfig(params.tool_choice);

  const response = await gemini.models.generateContent({
    model: params.model,
    contents,
    config: {
      maxOutputTokens: params.max_tokens,
      // Gemini 3.x "flash" models think by default, and thinking tokens
      // count against maxOutputTokens and bill at the output rate — for a
      // bounded tool-selection task (not open-ended reasoning), unbounded
      // (-1/automatic) thinking silently ate the whole budget before a
      // function call was ever emitted (confirmed live: stop_reason came
      // back "max_tokens" with zero content). thinkingBudget: 0 (fully
      // disabled) seemed like the fix but gemini-3.6-flash rejects it
      // outright with a 400 — confirmed live this model can't fully
      // disable thinking. A small fixed budget is the one setting that's
      // both accepted and keeps cost/latency predictable.
      thinkingConfig: { thinkingBudget: 512 },
      ...(tools ? { tools } : {}),
      ...(toolConfig ? { toolConfig } : {}),
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const content: Anthropic.ContentBlock[] = parts
    .filter((part) => part.text !== undefined || part.functionCall !== undefined)
    .map((part) => {
      if (part.functionCall) {
        return {
          type: "tool_use",
          id: part.functionCall.id ?? `gemini_${crypto.randomUUID()}`,
          name: part.functionCall.name ?? "",
          input: part.functionCall.args ?? {},
          // See toGeminiContents — must round-trip verbatim on the next turn.
          ...(part.thoughtSignature ? { _geminiThoughtSignature: part.thoughtSignature } : {}),
        } as Anthropic.ToolUseBlock;
      }
      return { type: "text", text: part.text ?? "", citations: null } as unknown as Anthropic.TextBlock;
    });

  const hasToolUse = content.some((block) => block.type === "tool_use");

  return {
    id: response.responseId ?? crypto.randomUUID(),
    type: "message",
    role: "assistant",
    model: params.model,
    content,
    stop_reason: mapFinishReason(response.candidates?.[0]?.finishReason, hasToolUse),
    stop_sequence: null,
    usage: {
      input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      server_tool_use: null,
      service_tier: null,
    },
  } as Anthropic.Message;
}
