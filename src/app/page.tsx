import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/auth/guards";
import { GUEST_COOKIE, LOBBY_COOKIE, verifySession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Root dispatcher.
 *
 * The production core has no public front page — every surface belongs to one
 * of four tiers, and marketing lives in the separate demo repo. So `/` only
 * decides where the visitor already belongs.
 *
 * Order matters. A wall display is checked before a guest cookie because a
 * paired kiosk must always return to the kiosk after a power cycle, even if a
 * member of staff once entered a guest PIN on it.
 */
export default async function RootPage() {
  const jar = cookies();

  const lobby = await verifySession(jar.get(LOBBY_COOKIE)?.value, "lobby");
  if (lobby) redirect("/lobby");

  const staff = await currentStaff();
  if (staff) {
    redirect(staff.role === "super_admin" ? "/admin" : "/hotel-portal");
  }

  const guest = await verifySession(jar.get(GUEST_COOKIE)?.value, "guest");
  redirect(guest ? "/client" : "/client/login");
}
