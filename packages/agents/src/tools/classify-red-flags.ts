import type Anthropic from "@anthropic-ai/sdk";

export const classifyRedFlagsTool: Anthropic.Tool = {
  name: "classify_red_flags",
  description:
    "Classify whether the given free text discloses any clinical red flags: severe/sudden pain, numbness or tingling, recent trauma, recent/unhealed surgery, pregnancy-related symptoms, or cardiac symptoms on exertion.",
  input_schema: {
    type: "object",
    properties: {
      flagged: { type: "boolean", description: "true if any red flag is disclosed anywhere in the text" },
      reasons: {
        type: "array",
        items: { type: "string" },
        description: "Short description of each red flag found, empty if none",
      },
    },
    required: ["flagged", "reasons"],
  },
};
