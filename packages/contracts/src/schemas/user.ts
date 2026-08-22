import { z } from "zod";

import { registry } from "../registry";

export const goalTypeSchema = z.enum(["INJURY_RECOVERY", "STRENGTH", "MOBILITY", "GENERAL_FITNESS"]);

// Matches the PRD's Business Model cancellation-flow reason codes exactly —
// mirrors packages/api/src/routers/user.ts's cancellationReasonCodeSchema.
export const cancellationReasonCodeSchema = z.enum([
  "TOO_EXPENSIVE",
  "NOT_SEEING_RESULTS",
  "PLAN_TOO_DEMANDING",
  "PLAN_TOO_EASY",
  "TECHNICAL_ISSUES",
  "OTHER",
]);
export type CancellationReasonCode = z.infer<typeof cancellationReasonCodeSchema>;

export const getMeResponseSchema = registry.register(
  "GetMeResponse",
  z.object({
    goalType: goalTypeSchema,
    createdAt: z.string().datetime(),
    wakeTimeMinutes: z.number().int().nullable(),
    eveningTimeMinutes: z.number().int().nullable(),
    billing: z.object({
      trialActive: z.boolean(),
      firstAdjustmentAt: z.string().datetime().nullable(),
    }),
  })
);
export type GetMeResponse = z.infer<typeof getMeResponseSchema>;

export const submitCancellationFeedbackRequestSchema = z.object({
  reasonCode: cancellationReasonCodeSchema,
  comment: z.string().max(1000).optional(),
});
export type SubmitCancellationFeedbackInput = z.infer<typeof submitCancellationFeedbackRequestSchema>;

export const submitCancellationFeedbackResponseSchema = registry.register(
  "SubmitCancellationFeedbackResponse",
  z.object({ received: z.literal(true) })
);
export type SubmitCancellationFeedbackResponse = z.infer<typeof submitCancellationFeedbackResponseSchema>;

// Same bounds onboardingSubmissionSchema uses (packages/api/src/schemas.ts)
// — minutes since local midnight, 0-1439. Nullable here (GET, and PATCH's
// response) because that's Prisma's real declared column type — never null
// in practice right after a successful PATCH, but the schema shouldn't
// claim more than the DB actually guarantees.
export const notificationTimesResponseSchema = registry.register(
  "NotificationTimes",
  z.object({
    wakeTimeMinutes: z.number().int().nullable(),
    eveningTimeMinutes: z.number().int().nullable(),
  })
);
export type NotificationTimesResponse = z.infer<typeof notificationTimesResponseSchema>;

export const updateNotificationTimesRequestSchema = z.object({
  wakeTimeMinutes: z.number().int().min(0).max(1439),
  eveningTimeMinutes: z.number().int().min(0).max(1439),
});
export type UpdateNotificationTimesInput = z.infer<typeof updateNotificationTimesRequestSchema>;

export const deleteMyAccountResponseSchema = registry.register(
  "DeleteMyAccountResponse",
  z.object({ success: z.literal(true) })
);
export type DeleteMyAccountResponse = z.infer<typeof deleteMyAccountResponseSchema>;

registry.registerPath({
  method: "get",
  path: "/users/me",
  tags: ["user"],
  summary: "Get the current user's profile + billing status",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: getMeResponseSchema } } },
    401: { description: "Not authenticated" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/users/me",
  tags: ["user"],
  summary: "Permanently delete the current user's account and app data",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: deleteMyAccountResponseSchema } } },
    401: { description: "Not authenticated" },
  },
});

registry.registerPath({
  method: "post",
  path: "/users/me/cancellation-feedback",
  tags: ["user"],
  summary: "Record a cancellation reason (beta preview — no real subscription exists yet)",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: submitCancellationFeedbackRequestSchema } } },
  },
  responses: {
    200: {
      description: "Recorded",
      content: { "application/json": { schema: submitCancellationFeedbackResponseSchema } },
    },
    400: { description: "Invalid input" },
    401: { description: "Not authenticated" },
  },
});

registry.registerPath({
  method: "get",
  path: "/users/me/notification-times",
  tags: ["user"],
  summary: "Get the current user's wake / evening session times",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: notificationTimesResponseSchema } } },
    401: { description: "Not authenticated" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/users/me/notification-times",
  tags: ["user"],
  summary: "Update the current user's wake / evening session times",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: updateNotificationTimesRequestSchema } } },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: notificationTimesResponseSchema } } },
    400: { description: "Invalid input" },
    401: { description: "Not authenticated" },
  },
});
