import { cookies } from "next/headers";
import { dictionaries, type Messages } from "./dictionaries";
import { DEFAULT_LOCALE, localeFromCookie, LOCALE_COOKIE, type Locale } from "./types";

export function currentLocale(): Locale {
  return localeFromCookie(cookies().get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE);
}

export function messages(): Messages {
  return dictionaries[currentLocale()];
}
