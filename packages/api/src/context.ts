import { prisma } from "@rebound/db";

export interface CreateContextOptions {
  userId: string | null;
}

// Split from the request-parsing step so it can be reused directly in tests
// without needing to fake a Next.js/Expo request object.
export function createInnerContext(opts: CreateContextOptions) {
  return {
    prisma,
    userId: opts.userId,
  };
}

export type Context = ReturnType<typeof createInnerContext>;
