"use client";

import { signOut } from "@/lib/auth/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useMessages } from "@/i18n/LocaleProvider";
import { TYPE } from "@/components/console/ui";

export function ErpSidebarFooter({
  email,
  isOwner,
}: {
  email: string;
  isOwner: boolean;
}) {
  const t = useMessages();

  return (
    <div className="mt-auto hidden flex-col gap-1.5 border-t border-[var(--edl-border)] px-2.5 pt-3 md:flex">
      <LanguageSwitcher variant="console" />
      <span className={`${TYPE.meta} break-all`}>{email}</span>
      <span
        className="w-fit rounded-md px-1.5 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.11em]"
        style={{
          background: isOwner ? "var(--edl-emerald-10)" : "var(--edl-soft)",
          color: isOwner ? "var(--edl-emerald)" : "var(--edl-muted)",
        }}
      >
        {isOwner ? t.erp.owner : t.erp.staff}
      </span>
      <form action={signOut}>
        <button type="submit" className="console-btn-quiet mt-1 text-left">
          {t.erp.signOut}
        </button>
      </form>
    </div>
  );
}
