"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AccessTier } from "@/lib/auth/session";

/**
 * Tries hotel Wi-Fi (and an optional remote pass) before showing a code pad.
 */
export function PresenceGate({
  tier,
  pass,
  checkingLabel,
  children,
}: {
  tier: AccessTier;
  pass?: string;
  checkingLabel: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"checking" | "entry">("checking");
  const [passError, setPassError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const response = await fetch("/api/auth/presence", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tier,
            ...(pass ? { pass } : {}),
          }),
        });
        const payload = (await response.json()) as
          | { ok: true; data: { redirectTo: string } }
          | { ok: false; code?: string; message: string };

        if (cancelled) return;

        if (payload.ok) {
          router.replace(payload.data.redirectTo);
          router.refresh();
          return;
        }

        if (payload.code === "invalid_remote_pass") {
          setPassError(payload.message);
        }
      } catch {
        // Fall through to the code pad; the guest can still authenticate.
      }

      if (!cancelled) setPhase("entry");
    }

    void probe();
    return () => {
      cancelled = true;
    };
  }, [tier, pass, router]);

  if (phase === "checking") {
    return (
      <p className="max-w-[24rem] text-center hud-body">{checkingLabel}</p>
    );
  }

  return (
    <>
      {passError ? (
        <p className="mb-4 max-w-[24rem] text-center text-[12px]" style={{ color: "#f0a58a" }}>
          {passError}
        </p>
      ) : null}
      {children}
    </>
  );
}
