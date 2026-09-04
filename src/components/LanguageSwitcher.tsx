"use client";

import { useLocale } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/types";

export function LanguageSwitcher({
  variant = "console",
  className = "",
}: {
  variant?: "console" | "hud";
  className?: string;
}) {
  const { locale, setLocale, messages } = useLocale();
  const options: Locale[] = ["fr", "en"];

  return (
    <div
      className={
        variant === "hud"
          ? `hud-eyebrow inline-flex items-center gap-0.5 ${className}`
          : `inline-flex items-center gap-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.14em] ${className}`
      }
      role="group"
      aria-label={messages.languageAria}
    >
      {options.map((code, index) => {
        const active = locale === code;
        return (
          <span key={code} className="inline-flex items-center gap-0.5">
            {index > 0 ? (
              <span
                className={
                  variant === "hud"
                    ? "text-sand-200/30"
                    : "text-[var(--edl-muted)]"
                }
                aria-hidden
              >
                /
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setLocale(code)}
              aria-pressed={active}
              className={
                variant === "hud"
                  ? `px-1 py-0.5 transition-colors ${
                      active
                        ? "text-gold-400"
                        : "text-sand-200/70 hover:text-sand-100"
                    }`
                  : `px-1 py-0.5 transition-colors ${
                      active
                        ? "text-[var(--edl-emerald)]"
                        : "text-[var(--edl-muted)] hover:text-[var(--edl-text)]"
                    }`
              }
            >
              {code.toUpperCase()}
            </button>
          </span>
        );
      })}
    </div>
  );
}
