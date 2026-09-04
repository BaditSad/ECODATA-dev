import {
  DEFAULT_LOCALE,
  detectSystemLocale,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "./types";

export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
}

export function persistLocale(locale: Locale): void {
  applyDocumentLocale(locale);
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* private mode */
  }
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
}

export function readClientLocale(fallback: Locale = DEFAULT_LOCALE): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  const fromDom = document.documentElement.dataset.locale;
  if (isLocale(fromDom)) return fromDom;
  return detectSystemLocale() || fallback;
}
