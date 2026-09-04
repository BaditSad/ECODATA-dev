import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Staff sign-in, shared by both console tiers.
 *
 * Guests and lobby displays never reach this page: they authenticate with a
 * PIN or a kiosk code and are routed to their own entry screens by middleware.
 */
export default function SignInPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  return (
    <main className="console-root flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-[22rem]">
        <div className="mb-6">
          <p className="font-sans text-[13px] font-semibold tracking-[-0.01em] text-[var(--edl-text)]">
            Eco-Data Link
          </p>
          <h1 className="mt-2 font-sans text-[18px] font-semibold tracking-[-0.015em] text-[var(--edl-text)]">
            Sign in
          </h1>
          <p className="mt-1 font-sans text-[12px] leading-relaxed text-[var(--edl-muted)]">
            Platform operators and resort staff. Guests use the four-digit code
            from reception.
          </p>
        </div>

        <SignInForm redirectTo={searchParams.from} />
      </div>
    </main>
  );
}
