"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";
import { useLocale } from "@/i18n/LocaleProvider";

/**
 * Four-digit guest PIN entry.
 *
 * Designed for the actual context: a guest standing in a lobby, one-handed, on
 * a phone, possibly in bright sun. Hence an on-screen keypad rather than a
 * text input, large targets, and auto-submit on the fourth digit so there is no
 * "confirm" step to hunt for.
 *
 * A physical keyboard works too — the component listens for digit keys — so the
 * same screen serves a tablet at reception.
 */

const PIN_LENGTH = 4;

export function PinPad({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const t = useLocale().messages.pin;
  const [digits, setDigits] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  // Guards against a double submit when the fourth digit is entered by both
  // keyboard and tap in quick succession.
  const submittingRef = useRef(false);

  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/client";

  const submit = useCallback(
    async (code: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setPending(true);
      setError(null);

      try {
        const response = await fetch("/api/auth/verify-pin", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, tier: "guest" }),
        });

        const payload = (await response.json()) as
          | { ok: true; data: { redirectTo: string } }
          | { ok: false; message: string };

        if (payload.ok) {
          router.replace(safeRedirect);
          router.refresh();
          return;
        }

        setError(payload.message);
        setDigits([]);
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
      } catch {
        setError(t.network);
        setDigits([]);
      } finally {
        setPending(false);
        submittingRef.current = false;
      }
    },
    [router, safeRedirect, t.network]
  );

  const push = useCallback(
    (digit: string) => {
      setDigits((current) => {
        if (current.length >= PIN_LENGTH) return current;
        const next = [...current, digit];
        if (next.length === PIN_LENGTH) void submit(next.join(""));
        return next;
      });
    },
    [submit]
  );

  const pop = useCallback(() => {
    setError(null);
    setDigits((current) => current.slice(0, -1));
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (pending) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        push(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        pop();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [push, pop, pending]);

  return (
    <div className="w-full max-w-[19rem]">
      {/* ── Digit cells ──────────────────────────────────────────────────── */}
      <div
        className={`flex justify-center gap-2.5 ${shake ? "animate-shake" : ""}`}
        role="status"
        aria-live="polite"
        aria-label={t.digitsEntered
          .replace("{n}", String(digits.length))
          .replace("{total}", String(PIN_LENGTH))}
      >
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span
            key={index}
            className={`pin-cell ${
              index === digits.length && !pending ? "pin-cell-active" : ""
            }`}
          >
            {/* Masked: a lobby is a public place and the code is reused by
                every guest at the resort. */}
            {digits[index] !== undefined ? "•" : ""}
          </span>
        ))}
      </div>

      <p
        className="mt-3 min-h-[2.25rem] text-center hud-body"
        style={error ? { color: "#f0a58a" } : undefined}
        role={error ? "alert" : undefined}
      >
        {pending ? t.checking : (error ?? t.hint)}
      </p>

      {/* ── Keypad ───────────────────────────────────────────────────────── */}
      <div className="mt-2 grid grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => push(digit)}
            disabled={pending || digits.length >= PIN_LENGTH}
            className="pin-key"
            aria-label={digit}
          >
            {digit}
          </button>
        ))}

        {/* Empty cell keeps 0 centred under 8, matching a phone dial pad. */}
        <span aria-hidden />

        <button
          type="button"
          onClick={() => push("0")}
          disabled={pending || digits.length >= PIN_LENGTH}
          className="pin-key"
          aria-label="0"
        >
          0
        </button>

        <button
          type="button"
          onClick={pop}
          disabled={pending || digits.length === 0}
          className="pin-key"
          aria-label={t.deleteDigit}
        >
          <Delete size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
