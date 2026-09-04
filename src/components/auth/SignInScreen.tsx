"use client";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignInForm } from "@/components/auth/SignInForm";
import { useMessages } from "@/i18n/LocaleProvider";
import { TYPE } from "@/components/console/ui";

export function SignInScreen({
  surface,
  redirectTo,
  platformConsole,
}: {
  surface: "admin" | "tenant";
  redirectTo?: string;
  platformConsole: string | null;
}) {
  const t = useMessages().signIn;

  return (
    <main className="console-root relative flex min-h-screen items-center justify-center px-5 py-12">
      <div className="absolute right-5 top-5">
        <LanguageSwitcher variant="console" />
      </div>

      <div className="w-full max-w-[22rem]">
        <div className="mb-6">
          <p className="font-sans text-[13px] font-semibold tracking-[-0.01em] text-[var(--edl-text)]">
            Eco-Data Link
          </p>
          <h1 className="mt-2 font-sans text-[18px] font-semibold tracking-[-0.015em] text-[var(--edl-text)]">
            {t.title}
          </h1>
          <p className="mt-1 font-sans text-[12px] leading-relaxed text-[var(--edl-muted)]">
            {surface === "admin" ? t.platformLead : t.resortLead}
          </p>
        </div>

        {platformConsole ? (
          <div
            className="mb-4 rounded-md border p-3"
            style={{
              borderColor: "var(--edl-gold-40)",
              background: "var(--edl-gold-10)",
            }}
          >
            <p className="font-sans text-[12px] font-medium text-[var(--edl-text)]">
              {t.wrongConsoleTitle}
            </p>
            <p className={`mt-1 ${TYPE.meta}`}>{t.wrongConsoleBody}</p>
            <a
              href={platformConsole}
              className="console-btn-secondary mt-2.5 inline-flex"
            >
              {t.openPlatform} {platformConsole}
            </a>
          </div>
        ) : null}

        <SignInForm
          redirectTo={redirectTo}
          guestEntry={surface === "tenant"}
        />
      </div>
    </main>
  );
}
