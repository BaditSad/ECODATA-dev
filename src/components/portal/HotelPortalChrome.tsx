"use client";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useMessages } from "@/i18n/LocaleProvider";
import { TYPE } from "@/components/console/ui";
import type { StaffRole } from "@/types/database";

export function HotelPortalChrome({
  identity,
  role,
}: {
  identity: string;
  role: StaffRole;
}) {
  const t = useMessages();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--edl-border)] bg-[var(--edl-bg)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <span className="flex items-baseline gap-2">
          <span className="font-sans text-[13px] font-semibold tracking-[-0.01em] text-[var(--edl-text)]">
            Eco-Data Link
          </span>
          <span className={TYPE.eyebrow}>{t.portal.eyebrow}</span>
        </span>

        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher variant="console" />
          <span className={TYPE.meta}>{identity}</span>
          <span
            className="rounded-md px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.11em]"
            style={{ background: "var(--edl-soft)", color: "var(--edl-muted)" }}
          >
            {role === "resort_manager" ? t.portal.manager : t.portal.analyst}
          </span>
        </div>
      </div>
    </header>
  );
}
