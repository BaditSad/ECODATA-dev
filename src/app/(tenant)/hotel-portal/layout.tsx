import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { HotelPortalChrome } from "@/components/portal/HotelPortalChrome";

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
      <HotelPortalChrome
        identity={staff.fullName ?? staff.email}
        role={staff.role}
      />

      <main className="mx-auto max-w-[1400px] px-5 py-6">{children}</main>
    </div>
  );
}
