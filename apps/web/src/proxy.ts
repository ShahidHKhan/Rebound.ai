import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Named "proxy.ts" per the Next.js 16 rename of middleware.ts -> proxy.ts;
// the exported function is still what Clerk calls "middleware" in its own docs.
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
