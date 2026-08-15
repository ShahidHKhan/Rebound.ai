import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "4rem 1rem" }}
    >
      <SignUp />
      <p style={{ fontSize: "0.85rem", color: "#666" }}>
        By signing up you agree to our{" "}
        <Link href="/terms" style={{ color: "#2563eb" }}>
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" style={{ color: "#2563eb" }}>
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
