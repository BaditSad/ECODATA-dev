import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { TYPE } from "@/components/console/ui";

/**
 * Super-admin shell.
 *
 * The guard runs here, above every `/admin` page, so no page can be reached
 * without it — including ones added later. Middleware already rejected the
 * obvious cases; this is the authoritative check, co-located with the data.
 */

export const metadata: Metadata = { title: "Platform" };

const NAV = [
  { href: "/admin", label: "Estate" },
  { href: "/admin/analytics/audio", label: "Audio & AI" },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();

  return (
    <div className="console-root min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--edl-border)] bg-[var(--edl-bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/admin" className="flex items-baseline gap-2">
            <span className="font-sans text-[13px] font-semibold tracking-[-0.01em] text-[var(--edl-text)]">
              Eco-Data Link
            </span>
            <span className={TYPE.eyebrow}>Platform</span>
          </Link>

          <nav className="flex items-center gap-1" aria-label="Platform sections">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2.5 py-1 font-sans text-[12px] text-[var(--edl-muted)] transition-colors hover:bg-[var(--edl-soft)] hover:text-[var(--edl-text)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className={TYPE.meta}>{admin.email}</span>
            <span
              className="rounded-md px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.11em]"
              style={{
                background: "var(--edl-emerald-10)",
                color: "var(--edl-emerald)",
              }}
            >
              Super admin
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-6">{children}</main>
    </div>
  );
}
