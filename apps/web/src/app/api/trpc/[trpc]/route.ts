import { auth } from "@clerk/nextjs/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createInnerContext } from "@rebound/api";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const { userId } = await auth();
      return createInnerContext({ userId });
    },
  });
}

export { handler as GET, handler as POST };
