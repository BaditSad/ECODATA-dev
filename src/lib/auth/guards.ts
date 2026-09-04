import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
import { clientIpFromHeaders } from "@/lib/auth/client-ip";
import {
  GUEST_COOKIE,
  LOBBY_COOKIE,
  sessionAllowedFromIp,
  verifySession,
  type SessionPayload,
} from "@/lib/auth/session";
import { isPlatformRole } from "@/lib/auth/roles";
import type { ProfileRow, StaffRole } from "@/types/database";

/**
 * Layout-level guards.
 *
 * Middleware already screened the request, but these run again inside the
 * render. That redundancy is the point: a guard co-located with the data
 * access cannot be bypassed by a future route the middleware matcher misses,
 * and it is also what narrows types — a page that calls `requireStaff()` gets
 * a non-null `tenantId` and cannot forget to scope its queries.
 */

export interface StaffSession {
  userId: string;
  email: string;
  fullName: string | null;
  role: StaffRole;
  /** Non-null for resort roles; always null for platform roles. */
  tenantId: string | null;
}

export interface TenantStaffSession extends StaffSession {
  tenantId: string;
}

async function loadStaffSession(): Promise<StaffSession | null> {
  const supabase = createReadOnlyServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, tenant_id, is_active")
    .eq("id", user.id)
    .maybeSingle<
      Pick<
        ProfileRow,
        "id" | "email" | "full_name" | "role" | "tenant_id" | "is_active"
      >
    >();

  if (!profile || !profile.is_active) return null;

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    tenantId: profile.tenant_id,
  };
}

/**
 * Platform operator only.
 *
 * Module-scoped ERP work goes through `requireModule()` in `lib/auth/erp.ts`;
 * this stays for the few operations the owner alone performs.
 */
export async function requireSuperAdmin(): Promise<StaffSession> {
  const session = await loadStaffSession();
  if (!session) redirect("/sign-in?from=/admin");
  if (session.role !== "super_admin") {
    redirect(isPlatformRole(session.role) ? "/admin" : "/hotel-portal");
  }
  return session;
}

/** Any tenant-scoped staff member. Guarantees a resolved `tenantId`. */
export async function requireStaff(): Promise<TenantStaffSession> {
  const session = await loadStaffSession();
  if (!session) redirect("/sign-in?from=/hotel-portal");
  if (isPlatformRole(session.role)) redirect("/admin");
  if (!session.tenantId) redirect("/sign-in");
  return session as TenantStaffSession;
}

/** Optional read, for shared chrome that adapts to whoever is signed in. */
export async function currentStaff(): Promise<StaffSession | null> {
  return loadStaffSession();
}

export async function requireGuestSession(): Promise<SessionPayload> {
  const token = cookies().get(GUEST_COOKIE)?.value;
  const session = await verifySession(token, "guest");
  if (!session) redirect("/client/login");
  if (!sessionAllowedFromIp(session, clientIpFromHeaders(headers()))) {
    redirect("/client/login");
  }
  return session;
}

export async function requireLobbySession(): Promise<SessionPayload> {
  const token = cookies().get(LOBBY_COOKIE)?.value;
  const session = await verifySession(token, "lobby");
  if (!session) redirect("/lobby/pair");
  if (!sessionAllowedFromIp(session, clientIpFromHeaders(headers()))) {
    redirect("/lobby/pair");
  }
  return session;
}

/** Write operations in the portal are manager-only; analysts are read-mostly. */
export function canEditTenantSettings(role: StaffRole): boolean {
  return role === "super_admin" || role === "resort_manager";
}
