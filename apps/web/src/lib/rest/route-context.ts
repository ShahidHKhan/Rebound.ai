// Next.js 16 Route Handler shape — `params` is a Promise (dynamic segments),
// matching the same convention this app's page.tsx files already use.
export type RouteContext = { params: Promise<Record<string, string>> };
export type RouteHandler = (req: Request, routeCtx: RouteContext) => Promise<Response>;
