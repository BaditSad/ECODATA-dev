import type { Metadata } from "next";
import { LobbyPairScreen } from "@/components/lobby/LobbyPairScreen";

export const metadata: Metadata = { title: "Pair display" };
export const dynamic = "force-dynamic";

/**
 * Hall display pairing.
 *
 * A screen on the hotel Wi-Fi is admitted without the lobby code. Off-site
 * pairing (a temporary kiosk, a demo) uses the code or a time-limited link,
 * and that session is not kept alive.
 */
export default function LobbyPairPage({
  searchParams,
}: {
  searchParams: { pass?: string };
}) {
  return <LobbyPairScreen pass={searchParams.pass} />;
}
