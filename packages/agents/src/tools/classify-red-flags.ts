import type Anthropic from "@anthropic-ai/sdk";

export const classifyRedFlagsTool: Anthropic.Tool = {
  name: "classify_red_flags",
  description:
    "Classify whether the given free text discloses any clinical red flags (severe/sudden pain, numbness or tingling, recent trauma, recent/unhealed surgery, pregnancy-related symptoms, or cardiac symptoms on exertion) and, separately, any self-harm or mental-health crisis language (suicidal ideation, self-harm, hopelessness expressed as a safety risk). Keep these two categories independent — crisis language is not a physical red flag and vice versa.",
  input_schema: {
    type: "object",
    properties: {
      flagged: { type: "boolean", description: "true if any physical red flag is disclosed anywhere in the text" },
      reasons: {
        type: "array",
        items: { type: "string" },
        description: "Short description of each physical red flag found, empty if none",
      },
      crisisFlagged: {
        type: "boolean",
        description: "true if the text discloses suicidal ideation, self-harm, or a mental-health crisis",
      },
      crisisReasons: {
        type: "array",
        items: { type: "string" },
        description: "Short description of each crisis signal found, empty if none",
      },
    },
    required: ["flagged", "reasons", "crisisFlagged", "crisisReasons"],
  },
};
