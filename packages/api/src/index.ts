export { appRouter } from "./root";
export type { AppRouter } from "./root";
export { createInnerContext } from "./context";
export type { Context, CreateContextOptions } from "./context";
export { ApiError } from "./errors";
export type { ApiErrorCode } from "./errors";

// REST handlers — plain functions extracted from tRPC procedure bodies as
// each router migrates. Exported from this same barrel (not a subpath like
// @rebound/api/handlers/health) to match this package's existing
// single-entry-point convention — no "exports" map exists to make subpath
// imports resolve.
export { getHealth } from "./handlers/health";
export { getExerciseById } from "./handlers/exercise";
export {
  getMe,
  submitCancellationFeedback,
  getNotificationTimes,
  updateNotificationTimes,
  deleteMyAccount,
} from "./handlers/user";
