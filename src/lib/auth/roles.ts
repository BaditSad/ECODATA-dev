import type { PlatformRole, StaffRole } from "@/types/database";

/**
 * Role predicates shared by the edge middleware and the render-time guards.
 *
 * Kept free of `server-only`, `next/headers` and any Supabase import so the
 * middleware bundle can use them: everything else in `lib/auth` pulls in the
 * Node runtime one way or another.
 */

/** Estate-wide roles. Neither carries a tenant, so neither has a portal. */
export function isPlatformRole(role: StaffRole): role is PlatformRole {
  return role === "super_admin" || role === "platform_staff";
}

/** Resort-scoped roles always resolve a tenant. */
export function isTenantRole(role: StaffRole): boolean {
  return !isPlatformRole(role);
}
