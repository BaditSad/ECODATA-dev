"use client";

import { LocaleProvider } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/types";
import type { ReactNode } from "react";

export function AppProviders({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  return (
    <LocaleProvider initialLocale={initialLocale}>{children}</LocaleProvider>
  );
}
