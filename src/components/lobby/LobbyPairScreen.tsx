"use client";

import { PresenceGate } from "@/components/auth/PresenceGate";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LobbyPairForm } from "@/components/lobby/LobbyPairForm";
import { useMessages } from "@/i18n/LocaleProvider";

export function LobbyPairScreen({ pass }: { pass?: string }) {
  const t = useMessages().lobbyPair;

  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center bg-canopy-950 px-6 py-12">
      <div className="absolute right-4 top-4 z-20">
        <div className="hud-surface px-3 py-2">
          <LanguageSwitcher variant="hud" />
        </div>
      </div>

      <div className="w-full max-w-[24rem]">
        <p className="hud-eyebrow">{t.eyebrow}</p>
        <h1 className="mt-3 font-sans text-[1.6rem] font-light leading-tight tracking-[-0.03em] text-sand-100">
          {t.title}
        </h1>
        <p className="mt-2 hud-body">{t.lead}</p>

        <div className="mt-7">
          <PresenceGate tier="lobby" pass={pass} checkingLabel={t.checking}>
            <LobbyPairForm />
          </PresenceGate>
        </div>
      </div>
    </main>
  );
}
