import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
        <head>
          <script dangerouslySetInnerHTML={{ __html: largeTextInitScript }} />
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
