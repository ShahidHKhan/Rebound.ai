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
// Error on any non-2xx response — mirrors apps/web/src/lib/rest/api-error.ts.
// Every v1 route returns errors as { error: { code, message } } (see
// apps/web/src/lib/rest/error-response.ts).
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
