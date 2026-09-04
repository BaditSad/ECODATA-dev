import type { Metadata } from "next";
import Link from "next/link";
import { requireErpSession, visibleModules } from "@/lib/auth/erp";
import { ModuleNav } from "@/components/erp/ModuleNav";
import { ErpSidebarFooter } from "@/components/erp/ErpSidebarFooter";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TYPE } from "@/components/console/ui";

/**
 * ERP shell.
 *
 * Establishes the session above every `/admin` page, so no page can be reached
 * without one — including ones added later. It does *not* authorise the module
 * being rendered: that belongs to the page and its actions, because a shell
 * check cannot know which module a Server Action is about to write to.
 */

export const metadata: Metadata = { title: "Eco-Data Link ERP" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireErpSession();
  const allowed = visibleModules(session).map((module) => module.key);

  return (
    <div className="console-root min-h-screen md:flex">
      <aside className="border-b border-[var(--edl-border)] bg-[var(--edl-soft)]/40 md:sticky md:top-0 md:h-screen md:w-[196px] md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-full flex-col gap-4 overflow-x-auto px-3 py-3 md:overflow-x-visible md:py-4">
          <div className="flex items-start justify-between gap-2 px-2.5">
            <Link href="/admin" className="flex flex-col gap-0.5">
              <span className="font-sans text-[13px] font-semibold tracking-[-0.01em] text-[var(--edl-text)]">
                Eco-Data Link
              </span>
              <span className={TYPE.eyebrow}>ERP</span>
            </Link>
            <LanguageSwitcher variant="console" className="shrink-0 md:hidden" />
          </div>

          <ModuleNav allowed={allowed} />

          <ErpSidebarFooter email={session.email} isOwner={session.isOwner} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
