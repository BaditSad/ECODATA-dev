import type { Metadata } from "next";
import { ClientLoginScreen } from "@/components/client/ClientLoginScreen";

export const metadata: Metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

/**
 * Guest entry.
 *
 * On the hotel Wi-Fi the pad is skipped: reception already decided who is on
 * the network. Off-site, a PIN or a time-limited link from the hotel still
 * works — that session is short and is not renewed.
 */
export default function ClientLoginPage({
  searchParams,
}: {
  searchParams: { from?: string; pass?: string };
}) {
  return (
    <ClientLoginScreen from={searchParams.from} pass={searchParams.pass} />
  );
}
