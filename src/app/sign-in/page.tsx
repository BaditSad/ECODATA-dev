import type { Metadata } from "next";
import { headers } from "next/headers";
import { SignInScreen } from "@/components/auth/SignInScreen";
import { currentStaff } from "@/lib/auth/guards";
import { adminOrigin, surfaceForHost } from "@/lib/surface";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messages().signIn.title };
}

export const dynamic = "force-dynamic";

/**
 * Staff sign-in, shared by both console tiers.
 *
 * Guests and lobby displays never reach this page: they authenticate with a
 * PIN or a kiosk code and are routed to their own entry screens by middleware.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  const requestHeaders = headers();
  const surface = surfaceForHost(requestHeaders.get("host"));

  const staff = surface === "tenant" ? await currentStaff() : null;
  const platformConsole =
    staff?.role === "super_admin"
      ? adminOrigin(
          requestHeaders.get("host"),
          requestHeaders.get("x-forwarded-proto") ?? "http"
        )
      : null;

  return (
    <SignInScreen
      surface={surface === "admin" ? "admin" : "tenant"}
      redirectTo={searchParams.from}
      platformConsole={platformConsole}
    />
  );
}
