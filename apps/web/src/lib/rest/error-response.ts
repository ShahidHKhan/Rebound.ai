import { Prisma } from "@rebound/db";

import { ApiError, type ApiErrorCode } from "@rebound/api";

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};

// Mirrors packages/api/src/trpc.ts's errorFormatter: real message/cause only
// ever reaches the client for a deliberately-thrown ApiError. Anything that
// fell through as a raw exception (Prisma, Anthropic SDK, etc.) is logged
// server-side and replaced with a generic message in production — never the
// raw exception text, which can carry internal file paths/table names.
export function errorResponse(err: unknown): Response {
  // Real, low-risk improvement over the tRPC version: findUniqueOrThrow's
  // "not found" (P2025) is a routine 404, not a 500 — the tRPC path never
  // special-cased this and surfaced it as a generic INTERNAL_SERVER_ERROR.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return Response.json({ error: { code: "NOT_FOUND", message: "Resource not found." } }, { status: 404 });
  }

  const apiErr = err instanceof ApiError ? err : new ApiError("INTERNAL_SERVER_ERROR", undefined, err);
  const status = STATUS[apiErr.code];
  const isMasked = apiErr.code === "INTERNAL_SERVER_ERROR" && process.env.NODE_ENV === "production";

  if (apiErr.code === "INTERNAL_SERVER_ERROR") {
    console.error("Unhandled REST API error:", apiErr.cause ?? apiErr);
  }

  return Response.json(
    { error: { code: apiErr.code, message: isMasked ? "Something went wrong. Please try again." : apiErr.message } },
    { status }
  );
}
