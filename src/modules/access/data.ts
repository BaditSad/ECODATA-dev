import "server-only";

import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
import { grantableModules } from "@/modules/registry";
import type {
  ErpEffectiveAccess,
  ErpModuleKey,
  PlatformRole,
} from "@/types/database";

/**
 * Access module — reads.
 *
 * Owner-only, so the `*_super_admin_all` policies already scope this; going
 * through the RLS client rather than the service role keeps that true even if
 * the page guard were ever loosened.
 */

export interface ErpAccount {
  id: string;
  email: string;
  fullName: string | null;
  role: PlatformRole;
  isActive: boolean;
  /** The owner bypasses the grant table, so its map is not meaningful. */
  isOwner: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  grants: Record<ErpModuleKey, ErpEffectiveAccess>;
}

function emptyGrants(): Record<ErpModuleKey, ErpEffectiveAccess> {
  return Object.fromEntries(
    grantableModules().map((module) => [module.key, "none" as ErpEffectiveAccess])
  ) as Record<ErpModuleKey, ErpEffectiveAccess>;
}

export async function fetchErpAccounts(): Promise<ErpAccount[]> {
  const supabase = createReadOnlyServerSupabase();

  const [profiles, grants] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, is_active, last_seen_at, created_at")
      .in("role", ["super_admin", "platform_staff"])
      // Owner first, then staff alphabetically: the list reads as a hierarchy
      // rather than an accident of creation order.
      .order("role", { ascending: true })
      .order("email", { ascending: true }),
    supabase.from("erp_module_access").select("profile_id, module_key, access"),
  ]);

  if (profiles.error) throw new Error(`Account list failed: ${profiles.error.message}`);
  if (grants.error) throw new Error(`Grant list failed: ${grants.error.message}`);

  const byProfile = new Map<string, Record<ErpModuleKey, ErpEffectiveAccess>>();
  for (const grant of grants.data ?? []) {
    const existing = byProfile.get(grant.profile_id) ?? emptyGrants();
    if (Object.hasOwn(existing, grant.module_key)) {
      existing[grant.module_key] = grant.access;
    }
    byProfile.set(grant.profile_id, existing);
  }

  return (profiles.data ?? []).map((profile) => {
    const isOwner = profile.role === "super_admin";
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role as PlatformRole,
      isActive: profile.is_active,
      isOwner,
      lastSeenAt: profile.last_seen_at,
      createdAt: profile.created_at,
      grants: isOwner
        ? (Object.fromEntries(
            grantableModules().map((module) => [module.key, "write"])
          ) as Record<ErpModuleKey, ErpEffectiveAccess>)
        : byProfile.get(profile.id) ?? emptyGrants(),
    };
  });
}
