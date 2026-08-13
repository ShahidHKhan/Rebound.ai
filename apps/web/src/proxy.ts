import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Named "proxy.ts" per the Next.js 16 rename of middleware.ts -> proxy.ts;
// the exported function is still what Clerk calls "middleware" in its own docs.
//
// Everything is protected by default except sign-in/sign-up and /api routes
// (tRPC procedures and cron routes already enforce their own auth).
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/api(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
