import type { Metadata } from "next";
import { PinPad } from "@/components/client/PinPad";

export const metadata: Metadata = { title: "Welcome" };

/**
 * Guest entry.
 *
 * No email, no password, no account — a guest is here for a few nights and any
 * signup friction would simply stop them using the product. The four-digit
 * code on the welcome card is the whole credential.
 */
export default function ClientLoginPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-canopy-950 px-6 py-12">
      {/* Ambient wash, so the pad does not sit on flat black. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(at 20% 15%, rgba(61,155,122,0.18) 0, transparent 55%), radial-gradient(at 85% 85%, rgba(196,165,116,0.12) 0, transparent 50%)",
        }}
      />

      <div className="relative z-10 flex w-full flex-col items-center">
        <p className="hud-eyebrow">Living inventory</p>
        <h1 className="mt-3 text-center font-sans text-[1.9rem] font-light leading-[1.1] tracking-[-0.03em] text-sand-100">
          Discover the wildlife
          <br />
          around you
        </h1>
        <p className="mt-3 max-w-[26rem] text-center hud-body">
          The estate listens continuously. Enter your code to explore a live
          three-dimensional model of the grounds and hear what has been detected
          nearby.
        </p>

        <div className="mt-9 flex justify-center">
          <PinPad redirectTo={searchParams.from} />
        </div>

        <p className="mt-9 max-w-[24rem] text-center hud-meta">
          Codes are issued monthly and remain valid for six weeks, so a code
          given on arrival keeps working for the whole of your stay.
        </p>
      </div>
    </main>
  );
}
