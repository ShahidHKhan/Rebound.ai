import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, REGIME_MODEL } from "../src/client";
import { searchExercises, searchExercisesTool } from "../src/tools/search-exercises";

async function main() {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Find me 3 beginner-friendly stretching exercises for the lower back, then briefly tell me which one you'd recommend starting with and why.",
    },
  ];

  let response = await anthropic.messages.create({
    model: REGIME_MODEL,
    max_tokens: 1024,
    tools: [searchExercisesTool],
    messages,
  });

  console.log("stop_reason:", response.stop_reason);

  while (response.stop_reason === "tool_use") {
    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === "search_exercises") {
        console.log("Claude called search_exercises with:", block.input);
        const results = await searchExercises(block.input as Parameters<typeof searchExercises>[0]);
        console.log(`  -> found ${results.length} exercises`);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(results),
        });
      }
    }

    messages.push({ role: "user", content: toolResults });

    response = await anthropic.messages.create({
      model: REGIME_MODEL,
      max_tokens: 1024,
      tools: [searchExercisesTool],
      messages,
    });

    console.log("stop_reason:", response.stop_reason);
  }

  const textBlock = response.content.find((block) => block.type === "text");
  console.log("\nFinal answer:\n" + (textBlock?.text ?? "(no text content)"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
