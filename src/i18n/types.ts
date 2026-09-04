export type Locale = "fr" | "en";

export const LOCALES: readonly Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "edl-locale";
export const LOCALE_STORAGE_KEY = "edl-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "fr" || value === "en";
}

export function localeFromCookie(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function detectSystemLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const langs =
    navigator.languages?.length > 0
      ? navigator.languages
      : [navigator.language];
  for (const raw of langs) {
    const code = String(raw || "").toLowerCase();
    if (code.startsWith("fr")) return "fr";
    if (code.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

export function dateLocale(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-GB";
}
