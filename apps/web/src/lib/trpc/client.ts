import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@rebound/api";

export const trpc = createTRPCReact<AppRouter>();
