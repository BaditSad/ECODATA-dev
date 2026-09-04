import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { TYPE } from "@/components/console/ui";

/**
 * Resort staff shell.
 *
 * `requireStaff()` guarantees a resolved `tenantId`, which is what every page
 * below uses to scope its reads. A super admin is redirected to `/admin`: they
 * have no tenant of their own, so the portal has nothing to show them.
 */

export const metadata: Metadata = { title: "Resort operations" };

export default async function HotelPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();

  return (
    <div className="console-root min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--edl-border)] bg-[var(--edl-bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <span className="flex items-baseline gap-2">
            <span className="font-sans text-[13px] font-semibold tracking-[-0.01em] text-[var(--edl-text)]">
              Eco-Data Link
            </span>
            <span className={TYPE.eyebrow}>Resort operations</span>
          </span>

          <div className="ml-auto flex items-center gap-3">
            <span className={TYPE.meta}>{staff.fullName ?? staff.email}</span>
            <span
              className="rounded-md px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.11em]"
              style={{ background: "var(--edl-soft)", color: "var(--edl-muted)" }}
            >
              {staff.role === "resort_manager" ? "Manager" : "CSR analyst"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-6">{children}</main>
    </div>
  );
}
