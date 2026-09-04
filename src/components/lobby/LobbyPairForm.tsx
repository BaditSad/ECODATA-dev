"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Lobby code entry.
 *
 * A free-text field rather than a keypad: lobby codes are alphanumeric and
 * this screen is used by staff with a keyboard, not by a guest on a phone.
 * Input is upper-cased as it is typed to match the stored form and to remove
 * any doubt about case.
 */
export function LobbyPairForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, tier: "lobby" }),
      });

      const payload = (await response.json()) as
        | { ok: true; data: { redirectTo: string } }
        | { ok: false; message: string };

      if (payload.ok) {
        router.replace("/lobby");
        router.refresh();
        return;
      }

      setError(payload.message);
    } catch {
      setError("Network unavailable. Check the screen's connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label className="block">
        <span className="hud-eyebrow">Lobby code</span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          autoFocus
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={32}
          placeholder="RESORT-A1B2C3"
          className="mt-2 w-full rounded-md border bg-transparent px-3 py-3 font-mono text-[1.05rem] tracking-[0.14em] text-sand-100 outline-none transition-colors placeholder:text-sand-200/25"
          style={{ borderColor: "var(--hud-line-strong)" }}
        />
      </label>

      {error ? (
        <p className="mt-3 text-[12px]" style={{ color: "#f0a58a" }} role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || code.trim().length < 4}
        className="mt-5 inline-flex w-full items-center justify-center rounded-md border px-5 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-sand-100 transition-colors disabled:opacity-40"
        style={{
          borderColor: "var(--hud-accent-line)",
          background: "var(--hud-accent-soft)",
        }}
      >
        {pending ? "Pairing…" : "Pair display"}
      </button>
    </form>
  );
}
