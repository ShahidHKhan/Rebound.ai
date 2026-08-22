import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { QueryProvider } from "@/lib/rest/QueryProvider";
import { LargeTextToggle } from "@/components/LargeTextToggle";

import "./globals.css";

// Applied before hydration so a returning user with the preference already
// saved doesn't see a flash of normal-sized text before LargeTextToggle mounts.
const largeTextInitScript = `
  try {
    if (localStorage.getItem("rebound.largeText") === "true") {
      document.documentElement.dataset.largeText = "true";
    }
  } catch {}
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rebound.ai",
  description:
    "An AI-adjusted daily exercise plan that keeps you moving toward your next PR instead of sidelined by pain.",
};

// Async because of headers() below. Reading a request header opts the tree out
// of static generation, which is unavoidable with nonce-based CSP — a nonce is
// per-request by definition, and a prerendered page has no request to derive
// one from.
//
// Verified this costs nothing here: a build with this layout reverted marks
// /about, /pricing, /privacy and /terms as dynamic anyway, because
// ClerkProvider wrapping the root already opted every route in. There were no
// statically generated pages left to lose.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Set by src/proxy.ts. Absent only if a route somehow renders outside that
  // matcher — passing undefined then is correct, and simply yields no nonce
  // attribute rather than an invalid empty one.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <ClerkProvider nonce={nonce}>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
        <head>
          <script nonce={nonce} dangerouslySetInnerHTML={{ __html: largeTextInitScript }} />
        </head>
        <body>
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1rem 2rem",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <Link href="/" style={{ fontWeight: 700, color: "inherit", textDecoration: "none" }}>
              Rebound.ai
            </Link>
            <nav style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <SignedOut>
                <Link href="/how-it-works">How it works</Link>
                <Link href="/safety">Safety</Link>
                <Link href="/pricing">Pricing</Link>
                <Link href="/about">About</Link>
              </SignedOut>
              <SignedIn>
                <Link href="/today">Today</Link>
                <Link href="/history">History</Link>
                <Link href="/progress">Progress</Link>
                <Link href="/settings">Settings</Link>
              </SignedIn>
              <LargeTextToggle />
              <SignedOut>
                <SignInButton />
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </nav>
          </header>
          <QueryProvider>{children}</QueryProvider>
          <footer
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "1rem",
              padding: "2rem",
              fontSize: "0.85rem",
              color: "#666",
            }}
          >
            <Link href="/privacy" style={{ color: "#666" }}>
              Privacy Policy
            </Link>
            <Link href="/terms" style={{ color: "#666" }}>
              Terms of Service
            </Link>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
