"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { currentErpSession } from "@/lib/auth/erp";
import type { ActionResult } from "@/lib/actions";
import { denied, notice } from "@/i18n/action-copy";
import { STORAGE_BUCKETS } from "@/types/database";
import { domainsWriter, revalidateDomain, uuid } from "./shared";

/**
 * Domain lifecycle: suspend, reinstate, remove.
 *
 * Suspension is the lever that matters day to day, and it is reversible.
 * `verify_guest_pin` and `verify_lobby_code` both filter on `is_active`, so
 * clearing that flag closes guest and lobby access at the database rather than
 * in the UI — a resort whose invoice went unpaid stops resolving codes even if
 * a cached page still renders.
 *
 * Sensors keep ingesting while suspended, on purpose: the property's data
 * continuity should not be a casualty of a billing dispute, and the reading
 * surfaces are already closed.
 */

function suspendSchema() {
  return z.object({
    tenantId: uuid,
    reason: z
      .string()
      .trim()
      .min(4, notice("suspendReason"))
      .max(500),
  });
}

export async function suspendDomain(
  formData: FormData
): Promise<ActionResult> {
  if (!(await domainsWriter())) return denied("domains");

  const parsed = suspendSchema().safeParse({
    tenantId: formData.get("tenantId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? notice("invalidSuspension"),
    };
  }

  const { tenantId, reason } = parsed.data;
  const supabase = createAdminSupabase();

  const { error } = await supabase
    .from("tenants")
    .update({
      is_active: false,
      subscription_status: "suspended",
      suspended_at: new Date().toISOString(),
      suspension_reason: reason,
    })
    .eq("id", tenantId);

  if (error) return { ok: false, message: notice("failSuspend", { detail: error.message }) };

  revalidateDomain(tenantId);
  return {
    ok: true,
    message: notice("domainSuspended"),
  };
}

/**
 * Lift a suspension.
 *
 * Returns the resort to `active` rather than to whatever it held before.
 * A trial that was suspended for non-payment has, by the time anyone
 * reinstates it, been converted or abandoned — silently restoring `trial`
 * would quietly give away a second free period.
 */
export async function reinstateDomain(tenantId: string): Promise<ActionResult> {
  if (!(await domainsWriter())) return denied("domains");

  if (!uuid.safeParse(tenantId).success) {
    return { ok: false, message: notice("invalidResort") };
  }

  const supabase = createAdminSupabase();

  const { error } = await supabase
    .from("tenants")
    .update({
      is_active: true,
      subscription_status: "active",
      suspended_at: null,
      suspension_reason: null,
    })
    .eq("id", tenantId);

  if (error) return { ok: false, message: notice("failReinstate", { detail: error.message }) };

  revalidateDomain(tenantId);
  return {
    ok: true,
    message: notice("domainReinstated"),
  };
}

/**
 * Erase a domain and everything belonging to it.
 *
 * Owner-only, and not because staff are untrusted: this destroys a client's
 * entire detection history, and no grant level should make that a routine
 * click. Suspension covers every reversible case.
 *
 * The tenant row cascades to profiles, sensors, codes, assets, settings and
 * detections. Two things do not cascade and are handled here: the `auth.users`
 * rows behind those profiles, and the stored twin files. Leaving either would
 * strand credentials that still authenticate and objects nobody can reach.
 */
export async function deleteDomain(formData: FormData): Promise<ActionResult> {
  const session = await currentErpSession();
  if (!session?.isOwner) {
    return {
      ok: false,
      message: notice("deleteOwnerOnly"),
    };
  }

  const tenantId = String(formData.get("tenantId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  if (!uuid.safeParse(tenantId).success) {
    return { ok: false, message: notice("invalidResort") };
  }

  const supabase = createAdminSupabase();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return { ok: false, message: notice("resortNotFound") };

  // Typing the slug is the confirmation. A yes/no dialog is muscle memory by
  // the second time; transcribing the identifier is not.
  if (confirmation !== tenant.slug) {
    return {
      ok: false,
      message: notice("typeSlugToConfirm", { slug: tenant.slug }),
    };
  }

  // Auth identities first. If the run stops here the tenant still exists and
  // the operator can retry; the reverse order would leave live logins for a
  // resort that no longer has any data behind them.
  const { data: members } = await supabase
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenantId);

  for (const member of members ?? []) {
    const { error } = await supabase.auth.admin.deleteUser(member.id);
    if (error) {
      return {
        ok: false,
        message: notice("failRemoveAccount", { id: member.id, detail: error.message }),
      };
    }
  }

  // Stored twin files live under a `${tenantId}/` prefix.
  const { data: objects } = await supabase.storage
    .from(STORAGE_BUCKETS.twinAssets)
    .list(tenantId);

  if (objects && objects.length > 0) {
    await supabase.storage
      .from(STORAGE_BUCKETS.twinAssets)
      .remove(objects.map((object) => `${tenantId}/${object.name}`));
  }

  const { error } = await supabase.from("tenants").delete().eq("id", tenantId);

  if (error) {
    return {
      ok: false,
      message: notice("failDeleteAfterAccounts", { detail: error.message }),
    };
  }

  revalidatePath("/admin/domains");
  revalidatePath("/admin");
  redirect("/admin/domains");
}
