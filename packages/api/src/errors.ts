// REST equivalent of TRPCError — same code vocabulary as packages/api/src/trpc.ts
// so mixed-transport-era logs and error handling stay comparable. Mapped to
// HTTP status codes in apps/web/src/lib/rest/error-response.ts.
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "NOT_FOUND"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_SERVER_ERROR";

export class ApiError extends Error {
  code: ApiErrorCode;
  cause?: unknown;

  constructor(code: ApiErrorCode, message?: string, cause?: unknown) {
    super(message ?? code);
    this.name = "ApiError";
    this.code = code;
    this.cause = cause;
  }
}
