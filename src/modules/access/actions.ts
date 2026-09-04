"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { currentErpSession } from "@/lib/auth/erp";
import { grantableModules } from "@/modules/registry";
import type { ActionResult } from "@/lib/actions";
import { notice } from "@/i18n/action-copy";
import { messages } from "@/i18n/server";
import type { ErpAccessLevel, ErpModuleKey } from "@/types/database";

/**
 * ERP account administration.
 *
 * Owner-only, every action. The alternative — a grantable `access` module —
 * would let whoever held it grant themselves the rest, which makes the whole
 * matrix decorative. Refusing here removes the escalation instead of policing
 * it, and the database agrees: `erp_module_access` has no `access` row to
 * write, and only `is_super_admin()` may write the table at all.
 */

const GRANTABLE = new Set<string>(grantableModules().map((module) => module.key));

function ownerOnly(): ActionResult<never> {
  return { ok: false, message: notice("ownerOnlyAccess") };
}

async function owner() {
  const session = await currentErpSession();
  return session?.isOwner ? session : null;
}

/* ── Account creation ────────────────────────────────────────────────────── */

function createAccountSchema() {
  return z.object({
    email: z.string().trim().toLowerCase().email(notice("validEmail")),
    fullName: z.string().trim().max(255).optional(),
  });
}

export interface CreatedAccountPayload {
  accountId: string;
  email: string;
  /** Shown once. There is no outbound mail on self-hosted deployments. */
  temporaryPassword: string;
}

/**
 * A first password the holder is expected to change.
 *
 * The alphabet drops glyphs that are ambiguous when a password is read aloud,
 * which is how these actually get delivered.
 */
function generateTemporaryPassword(): string {
  const alphabet = "ACDEFGHJKLMNPQRTUVWXYacdefghjkmnpqrtuvwxy34679";
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
}

/**
 * Create a platform staff account.
 *
 * It lands active but with no module grants, so the holder can sign in and
 * reach nothing until the matrix says otherwise. That ordering is deliberate:
 * an account is never briefly more privileged than intended.
 */
export async function createErpAccount(
  formData: FormData
): Promise<ActionResult<CreatedAccountPayload>> {
  if (!(await owner())) return ownerOnly();

  const parsed = createAccountSchema().safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? notice("invalidAccount"),
    };
  }

  const { email, fullName } = parsed.data;
  const supabase = createAdminSupabase();
  const temporaryPassword = generateTemporaryPassword();

  // No `tenant_id` in the metadata: `handle_new_auth_user` reads its absence as
  // "platform staff" and inserts the profile with a null tenant accordingly.
  const { data: created, error: signUpError } =
    await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName ?? null },
    });

  if (signUpError || !created.user) {
    return {
      ok: false,
      message: notice("failCreateAccount", {
        detail: signUpError?.message ?? notice("unknownError"),
      }),
    };
  }

  const { error: activateError } = await supabase
    .from("profiles")
    .update({ full_name: fullName ?? null, is_active: true })
    .eq("id", created.user.id);

  if (activateError) {
    return {
      ok: false,
      message: notice("createdNotActivated", {
        email,
        detail: activateError.message,
      }),
    };
  }

  revalidatePath("/admin/access");

  return {
    ok: true,
    message: notice("accountReady", { email }),
    data: { accountId: created.user.id, email, temporaryPassword },
  };
}

/* ── Module grants ───────────────────────────────────────────────────────── */

function setAccessSchema() {
  return z.object({
    profileId: z.string().uuid(),
    moduleKey: z.string().refine((key) => GRANTABLE.has(key)),
    access: z.enum(["none", "read", "write"]),
  });
}

/**
 * Set one account's access to one module.
 *
 * `none` deletes the row rather than storing it. A grant table where absence
 * and "none" both mean no access has two ways to say the same thing, and they
 * drift.
 */
export async function setModuleAccess(
  profileId: string,
  moduleKey: string,
  access: string
): Promise<ActionResult> {
  const session = await owner();
  if (!session) return ownerOnly();

  const parsed = setAccessSchema().safeParse({ profileId, moduleKey, access });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? notice("invalidGrants"),
    };
  }

  const supabase = createAdminSupabase();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", parsed.data.profileId)
    .maybeSingle();

  if (!target) return { ok: false, message: notice("accountNotFound") };
  if (target.role !== "platform_staff") {
    return {
      ok: false,
      message: notice("ownerHasAll"),
    };
  }

  if (parsed.data.access === "none") {
    const { error } = await supabase
      .from("erp_module_access")
      .delete()
      .eq("profile_id", parsed.data.profileId)
      .eq("module_key", parsed.data.moduleKey as ErpModuleKey);

    if (error) {
      return { ok: false, message: notice("failRevoke", { detail: error.message }) };
    }
  } else {
    const { error } = await supabase.from("erp_module_access").upsert(
      {
        profile_id: parsed.data.profileId,
        module_key: parsed.data.moduleKey as ErpModuleKey,
        access: parsed.data.access as ErpAccessLevel,
        granted_by: session.userId,
      },
      { onConflict: "profile_id,module_key" }
    );

    if (error) {
      return { ok: false, message: notice("failGrant", { detail: error.message }) };
    }
  }

  revalidatePath("/admin/access");
  return { ok: true, message: notice("accessUpdated") };
}

const grantsSchema = z.record(z.enum(["none", "read", "write"]));

/**
 * Save every module grant for one account, and optionally its active flag.
 *
 * The edit modal submits the whole row at once so a half-edited matrix cannot
 * be left behind if the owner closes the dialog mid-way.
 */
export async function saveAccountAccess(
  profileId: string,
  grants: Record<string, string>,
  isActive: boolean
): Promise<ActionResult> {
  const session = await owner();
  if (!session) return ownerOnly();
  if (!z.string().uuid().safeParse(profileId).success) {
    return { ok: false, message: notice("invalidAccount") };
  }

  const parsedGrants = grantsSchema.safeParse(grants);
  if (!parsedGrants.success) {
    return { ok: false, message: notice("invalidGrants") };
  }

  for (const key of Object.keys(parsedGrants.data)) {
    if (!GRANTABLE.has(key)) {
      return { ok: false, message: notice("unknownModule", { key }) };
    }
  }

  const supabase = createAdminSupabase();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, role, email, is_active")
    .eq("id", profileId)
    .maybeSingle();

  if (!target) return { ok: false, message: notice("accountNotFound") };
  if (target.role !== "platform_staff") {
    return {
      ok: false,
      message: notice("ownerHasAll"),
    };
  }

  const labels = messages().modules;
  for (const module of grantableModules()) {
    if (!(module.key in parsedGrants.data)) {
      return { ok: false, message: notice("incompleteGrants") };
    }
    const access = parsedGrants.data[module.key];
    if (access === "none") {
      const { error } = await supabase
        .from("erp_module_access")
        .delete()
        .eq("profile_id", profileId)
        .eq("module_key", module.key as ErpModuleKey);
      if (error) {
        return {
          ok: false,
          message: notice("failRevokeModule", {
            module: labels[module.key].label,
            detail: error.message,
          }),
        };
      }
    } else {
      const { error } = await supabase.from("erp_module_access").upsert(
        {
          profile_id: profileId,
          module_key: module.key as ErpModuleKey,
          access: access as ErpAccessLevel,
          granted_by: session.userId,
        },
        { onConflict: "profile_id,module_key" }
      );
      if (error) {
        return {
          ok: false,
          message: notice("failGrantModule", {
            module: labels[module.key].label,
            detail: error.message,
          }),
        };
      }
    }
  }

  if (profileId !== session.userId && target.is_active !== isActive) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", profileId);
    if (error) {
      return {
        ok: false,
        message: notice("failAccountState", { detail: error.message }),
      };
    }
  }

  revalidatePath("/admin/access");
  return {
    ok: true,
    message: notice("accountUpdated", { email: target.email }),
  };
}

/* ── Account state ───────────────────────────────────────────────────────── */

/**
 * Suspend or reinstate an account.
 *
 * `erp_access()` requires an active profile, so deactivating revokes every
 * module at once without touching the grants — reinstating restores exactly
 * what the account had, which is what makes this usable for a leave of absence
 * rather than only for a departure.
 */
export async function setAccountActive(
  profileId: string,
  isActive: boolean
): Promise<ActionResult> {
  const session = await owner();
  if (!session) return ownerOnly();

  if (profileId === session.userId) {
    return { ok: false, message: notice("cannotDeactivateSelf") };
  }

  const supabase = createAdminSupabase();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role, email")
    .eq("id", profileId)
    .maybeSingle();

  if (!target) return { ok: false, message: notice("accountNotFound") };
  if (target.role !== "platform_staff") {
    return { ok: false, message: notice("staffOnlyDeactivate") };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", profileId);

  if (error) {
    return { ok: false, message: notice("updateFailed", { detail: error.message }) };
  }

  revalidatePath("/admin/access");
  return {
    ok: true,
    message: isActive
      ? notice("accountReactivated", { email: target.email })
      : notice("accountDeactivated", { email: target.email }),
  };
}

/**
 * Delete an account outright.
 *
 * Removing the auth user cascades to the profile, which cascades to its
 * grants. Deactivation is the reversible option and is what most departures
 * should use; this is for accounts created in error.
 */
export async function deleteErpAccount(profileId: string): Promise<ActionResult> {
  const session = await owner();
  if (!session) return ownerOnly();

  if (profileId === session.userId) {
    return { ok: false, message: notice("cannotDeleteSelf") };
  }

  const supabase = createAdminSupabase();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role, email")
    .eq("id", profileId)
    .maybeSingle();

  if (!target) return { ok: false, message: notice("accountNotFound") };
  if (target.role !== "platform_staff") {
    return { ok: false, message: notice("staffOnlyDelete") };
  }

  const { error } = await supabase.auth.admin.deleteUser(profileId);
  if (error) {
    return { ok: false, message: notice("deletionFailed", { detail: error.message }) };
  }

  revalidatePath("/admin/access");
  return { ok: true, message: notice("accountRemoved", { email: target.email }) };
}
