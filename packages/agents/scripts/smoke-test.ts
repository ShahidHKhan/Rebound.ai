import { anthropic, REGIME_MODEL } from "../src/client";

async function main() {
  const message = await anthropic.messages.create({
    model: REGIME_MODEL,
    max_tokens: 256,
    messages: [{ role: "user", content: "In one sentence, what does a physical therapist do?" }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  console.log(textBlock?.text ?? "(no text content in response)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
