import type { Metadata } from "next";
import { LobbyPairForm } from "@/components/lobby/LobbyPairForm";

export const metadata: Metadata = { title: "Pair display" };

/**
 * One-time display pairing.
 *
 * Seen once per screen, by staff, at installation. Afterwards the display holds
 * a year-long session so nobody has to retype anything; rotating the resort's
 * lobby code from the portal is what unpairs a screen.
 */
export default function LobbyPairPage() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center bg-canopy-950 px-6 py-12">
      <div className="w-full max-w-[24rem]">
        <p className="hud-eyebrow">Eco-Data Link display</p>
        <h1 className="mt-3 font-sans text-[1.6rem] font-light leading-tight tracking-[-0.03em] text-sand-100">
          Pair this screen
        </h1>
        <p className="mt-2 hud-body">
          Enter the resort&apos;s permanent lobby code. This screen will stay
          paired until the code is rotated, so this is a one-time step.
        </p>

        <div className="mt-7">
          <LobbyPairForm />
        </div>
      </div>
    </main>
  );
}
