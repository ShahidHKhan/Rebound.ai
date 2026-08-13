// Clerk's client SDKs throw an object with an `errors: { message }[]` shape
// rather than a plain Error — narrowed manually here instead of assuming an
// exported type guard, since the exact export surface varies across
// @clerk/clerk-expo versions.
export function getClerkErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "errors" in err &&
    Array.isArray((err as { errors: unknown }).errors)
  ) {
    const first = (err as { errors: { message?: string }[] }).errors[0];
    if (first?.message) return first.message;
  }
  return fallback;
}
