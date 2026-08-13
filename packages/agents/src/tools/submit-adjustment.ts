import type Anthropic from "@anthropic-ai/sdk";

export const submitAdjustmentTool: Anthropic.Tool = {
  name: "submit_adjustment",
  description:
    "Submit the final adjustment decision for this user's regime. Call this once you've decided whether to hold, progress, or roll back, and have finalized the exercise list for both sessions.",
  input_schema: {
    type: "object",
    properties: {
      decision: {
        type: "string",
        enum: ["hold", "progress", "rollback"],
        description:
          "hold: keep current regime as-is. progress: increase load/difficulty within bounds. rollback: reduce load/difficulty due to a worsening trend.",
      },
      rationale: {
        type: "string",
        description: "Brief explanation of the decision, grounded in the trailing Session Log trend.",
      },
      exercises: {
        type: "array",
        items: {
          type: "object",
          properties: {
            exerciseId: { type: "string" },
            sets: { type: "number" },
            reps: { type: "number" },
            durationSeconds: { type: "number" },
            frequency: { type: "string" },
            sessionSlot: { type: "string", enum: ["MORNING", "EVENING"] },
          },
          required: ["exerciseId", "sessionSlot"],
        },
        description: "The full exercise list for the new/held regime (unchanged from current if decision is hold).",
      },
    },
    required: ["decision", "rationale", "exercises"],
  },
};
