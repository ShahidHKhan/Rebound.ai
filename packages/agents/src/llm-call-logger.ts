import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@rebound/db";
import type { LlmCallSource, LlmFlow } from "@rebound/db";

import { anthropic } from "./client";
import { callGemini, isGeminiModel } from "./gemini-adapter";
import { estimateCostUsd } from "./models";

export interface LlmCallMeta {
  flow: LlmFlow;
  source: LlmCallSource;
  groupId: string;
  sequenceIndex: number;
  userId?: string;
  testRunId?: string;
}

// Wraps every anthropic.messages.create call in the codebase so every LLM
// call — production and admin test alike — lands as one LlmCall row. Logs
// on both success and failure (a thrown error still gets a row, so a failed
// call isn't invisible), then rethrows so existing retry/error-handling
// logic upstream is unaffected.
export async function loggedMessagesCreate(
  params: Anthropic.MessageCreateParamsNonStreaming,
  meta: LlmCallMeta
): Promise<Anthropic.Message> {
  const startedAt = Date.now();

  try {
    // Provider is inferred entirely from the model id prefix (all Claude
    // ids start "claude-", all Gemini ids start "gemini-") — no separate
    // provider field needed at any call site. See gemini-adapter.ts.
    const response = isGeminiModel(params.model)
      ? await callGemini(params)
      : await anthropic.messages.create(params);
    const latencyMs = Date.now() - startedAt;

    await prisma.llmCall.create({
      data: {
        flow: meta.flow,
        source: meta.source,
        model: params.model,
        groupId: meta.groupId,
        sequenceIndex: meta.sequenceIndex,
        userId: meta.userId,
        testRunId: meta.testRunId,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs,
        costUsd: estimateCostUsd(params.model, response.usage.input_tokens, response.usage.output_tokens),
        stopReason: response.stop_reason,
        success: true,
        requestJson: params as unknown as object,
        responseJson: response.content as unknown as object,
      },
    });

    return response;
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);

    await prisma.llmCall.create({
      data: {
        flow: meta.flow,
        source: meta.source,
        model: params.model,
        groupId: meta.groupId,
        sequenceIndex: meta.sequenceIndex,
        userId: meta.userId,
        testRunId: meta.testRunId,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        costUsd: null,
        success: false,
        errorMessage: message,
        requestJson: params as unknown as object,
      },
    });

    throw error;
  }
}
