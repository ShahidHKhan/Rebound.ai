export class ApiClientError extends Error {
  status: number;
  code?: string;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

// Unwraps openapi-fetch's { data, error, response } result into a thrown
// Error on any non-2xx response, so REST call sites can keep the same
// `catch`/`.error?.message` shape their tRPC equivalents used against
// TRPCClientError. Every v1 route returns errors as { error: { code,
// message } } (see apps/web/src/lib/rest/error-response.ts) — this is the
// one place that shape is turned into a real Error.
export function unwrap<T>({ data, error, response }: { data?: T; error?: unknown; response: Response }): T {
  if (error !== undefined) {
    const body = error as { error?: { code?: string; message?: string } };
    throw new ApiClientError(response.status, body?.error?.code, body?.error?.message ?? "Request failed");
  }
  if (data === undefined) {
    throw new ApiClientError(response.status, undefined, "Request failed");
  }
  return data;
}
