import "server-only";

import { redirect } from "next/navigation";
import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth/guards";
import { isPlatformRole } from "@/lib/auth/roles";
import {
  ERP_MODULES,
  moduleFor,
  type ErpModule,
  type ModuleKey,
} from "@/modules/registry";
import type {
  ErpAccessLevel,
  ErpEffectiveAccess,
  PlatformRole,
} from "@/types/database";

/**
 * ERP authorisation.
 *
 * Resolved once per request and handed to whichever module is rendering. The
 * grant table is the source of truth in both directions: it decides what the
 * navigation shows *and* what the database will actually return, because the
 * same values back the `erp_can()` policies. A module that forgot its guard
 * would therefore render an empty page rather than another team's data.
 */

export interface ErpSession {
  userId: string;
  email: string;
  fullName: string | null;
  role: PlatformRole;
  /** The owner bypasses the grant table entirely. */
  isOwner: boolean;
  access: Record<ModuleKey, ErpEffectiveAccess>;
}

/** Where an account with no usable module lands. Always reachable. */
const NO_ACCESS = "/admin/no-access";

function emptyAccess(): Record<ModuleKey, ErpEffectiveAccess> {
  return Object.fromEntries(
    ERP_MODULES.map((module) => [module.key, "none" as ErpEffectiveAccess])
  ) as Record<ModuleKey, ErpEffectiveAccess>;
}

export async function currentErpSession(): Promise<ErpSession | null> {
  const staff = await currentStaff();
  if (!staff || !isPlatformRole(staff.role)) return null;

  const base = {
    userId: staff.userId,
    email: staff.email,
    fullName: staff.fullName,
    role: staff.role,
  };

  if (staff.role === "super_admin") {
    return {
      ...base,
      role: "super_admin",
      isOwner: true,
      access: Object.fromEntries(
        ERP_MODULES.map((module) => [module.key, "write" as ErpEffectiveAccess])
      ) as Record<ModuleKey, ErpEffectiveAccess>,
    };
  }

  // `erp_access_read_self` lets an account read its own grants, so this goes
  // through RLS rather than the service role.
  const supabase = createReadOnlyServerSupabase();
  const { data } = await supabase
    .from("erp_module_access")
    .select("module_key, access")
    .eq("profile_id", staff.userId);

  const access = emptyAccess();
  for (const grant of data ?? []) {
    if (grant.module_key in access) {
      access[grant.module_key] = grant.access;
    }
  }

  return { ...base, role: "platform_staff", isOwner: false, access };
}

export function canModule(
  session: ErpSession,
  key: ModuleKey,
  needed: ErpAccessLevel = "read"
): boolean {
  const level = session.access[key];
  return needed === "write" ? level === "write" : level !== "none";
}

/** Live modules this account may open, in registry order. */
export function visibleModules(session: ErpSession): ErpModule[] {
  const commercial =
    canModule(session, "contracts") || canModule(session, "invoices");

  return ERP_MODULES.filter((module) => {
    if (module.status !== "live" || !module.inNav) return false;
    if (canModule(session, module.key)) return true;
    // Contracts and invoices are reached through the domain they belong to.
    return module.key === "domains" && commercial;
  });
}

export async function requireAnyModule(keys: readonly ModuleKey[]): Promise<ErpSession> {
  const session = await requireErpSession();
  if (!keys.some((key) => canModule(session, key))) {
    redirect(landingFor(session, keys[0] ?? "overview"));
  }
  return session;
}

/**
 * First module to send someone to when the one they asked for is not theirs.
 *
 * Never returns the module that was refused, so a redirect here cannot bounce
 * back into the guard that issued it.
 */
function landingFor(session: ErpSession, refused: ModuleKey): string {
  const target = visibleModules(session).find(
    (module) => module.key !== refused
  );
  return target?.href ?? NO_ACCESS;
}

export async function requireErpSession(): Promise<ErpSession> {
  const session = await currentErpSession();
  if (!session) redirect("/sign-in?from=/admin");
  return session;
}

/**
 * Guard for a module's pages and actions.
 *
 * Server Actions are public POST endpoints, so calling this inside the action
 * matters as much as inside the layout: rendering behind a guarded shell is
 * not itself a check.
 */
export async function requireModule(
  key: ModuleKey,
  needed: ErpAccessLevel = "read"
): Promise<ErpSession> {
  const session = await requireErpSession();
  if (!canModule(session, key, needed)) redirect(landingFor(session, key));
  return session;
}

/**
 * Same check as `requireModule`, but answers instead of redirecting.
 *
 * Server Actions return a result the form renders; a redirect thrown from
 * inside one replaces that with a navigation the user did not ask for and no
 * explanation of what was refused.
 */
export async function authorizeModule(
  key: ModuleKey,
  needed: ErpAccessLevel = "read"
): Promise<ErpSession | null> {
  const session = await currentErpSession();
  if (!session || !canModule(session, key, needed)) return null;
  return session;
}

/** Owner-only surfaces: account administration and anything that grants it. */
export async function requireOwner(): Promise<ErpSession> {
  const session = await requireErpSession();
  if (!session.isOwner) redirect(landingFor(session, "access"));
  return session;
}

export { moduleFor };
