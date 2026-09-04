"use client";

import { PresenceGate } from "@/components/auth/PresenceGate";
import { PinPad } from "@/components/client/PinPad";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useMessages } from "@/i18n/LocaleProvider";

export function ClientLoginScreen({
  from,
  pass,
}: {
  from?: string;
  pass?: string;
}) {
  const t = useMessages().login;

  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-canopy-950 px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(at 20% 15%, rgba(61,155,122,0.18) 0, transparent 55%), radial-gradient(at 85% 85%, rgba(196,165,116,0.12) 0, transparent 50%)",
        }}
      />

      <div className="pointer-events-auto absolute right-4 top-4 z-20">
        <div className="hud-surface px-3 py-2">
          <LanguageSwitcher variant="hud" />
        </div>
      </div>

      <div className="relative z-10 flex w-full flex-col items-center">
        <p className="hud-eyebrow">{t.eyebrow}</p>
        <h1 className="mt-3 text-center font-sans text-[1.9rem] font-light leading-[1.1] tracking-[-0.03em] text-sand-100">
          {t.titleLine1}
          <br />
          {t.titleLine2}
        </h1>
        <p className="mt-3 max-w-[26rem] text-center hud-body">{t.lead}</p>

        <div className="mt-9 flex w-full flex-col items-center justify-center">
          <PresenceGate tier="guest" pass={pass} checkingLabel={t.checking}>
            <PinPad redirectTo={from} />
          </PresenceGate>
        </div>

        <p className="mt-9 max-w-[24rem] text-center hud-meta">{t.footer}</p>
      </div>
    </main>
  );
}
