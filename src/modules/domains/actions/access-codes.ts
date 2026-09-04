"use server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/actions";
import { denied, notice } from "@/i18n/action-copy";
import {
  currentCycleIndex,
  DEFAULT_ROTATION_POLICY,
  generateLobbyCode,
  missingCycles,
  normalizeLobbyCode,
  windowForCycle,
} from "@/lib/pin-engine";
import { domainsWriter, revalidateDomain, uuid } from "./shared";

/** Guest PIN cycles and the permanent lobby code a hall display pairs with. */

/**
 * Bring a resort's PIN cycles up to date.
 *
 * The window arithmetic comes from `lib/pin-engine.ts` and the insert from the
 * `rotate_tenant_access_code` RPC, which is idempotent per
 * `(tenant_id, cycle_index)`. Running this twice is therefore harmless, which
 * is what lets a cron job retry freely.
 */
export async function rotateGuestCodes(
  tenantId: string
): Promise<ActionResult<{ issued: number[] }>> {
  const actor = await domainsWriter();
  if (!actor) return denied("domains");

  if (!uuid.safeParse(tenantId).success) {
    return { ok: false, message: notice("invalidResort") };
  }

  const supabase = createAdminSupabase();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, created_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return { ok: false, message: notice("resortNotFound") };

  const { data: existing, error: existingError } = await supabase
    .from("tenant_access_codes")
    .select("cycle_index")
    .eq("tenant_id", tenantId);

  if (existingError) {
    return { ok: false, message: notice("failReadCodes", { detail: existingError.message }) };
  }

  // Onboarding date anchors the whole schedule, so cycle boundaries stay
  // stable for the lifetime of the contract.
  const anchor = new Date(tenant.created_at);
  const now = new Date();
  const issuedCycles = (existing ?? []).map((row) => row.cycle_index);

  const pending = missingCycles(
    anchor,
    issuedCycles,
    now,
    DEFAULT_ROTATION_POLICY
  );

  if (pending.length === 0) {
    const current = currentCycleIndex(anchor, now, DEFAULT_ROTATION_POLICY);
    return {
      ok: true,
      message: notice("codesAlreadyCurrent", { cycle: current }),
      data: { issued: [] },
    };
  }

  const issued: number[] = [];

  for (const cycleIndex of pending) {
    const window = windowForCycle(anchor, cycleIndex, DEFAULT_ROTATION_POLICY);

    const { error } = await supabase.rpc("rotate_tenant_access_code", {
      target_tenant: tenantId,
      target_cycle: cycleIndex,
      window_from: window.validFrom.toISOString(),
      window_until: window.validUntil.toISOString(),
      actor: actor.userId,
    });

    if (error) {
      // 53400 is the keyspace-exhausted signal from allocate_guest_pin.
      if (error.code === "53400") {
        return {
          ok: false,
          message: notice("keyspaceExhaustedRotate"),
        };
      }
      return {
        ok: false,
        message: notice("failRotationCycle", {
          cycle: cycleIndex,
          detail: error.message,
        }),
      };
    }

    issued.push(cycleIndex);
  }

  revalidateDomain(tenantId);
  return {
    ok: true,
    message: notice("codesIssued", {
      n: issued.length,
      s: issued.length === 1 ? "" : "s",
      cycles: issued.join(", "),
    }),
    data: { issued },
  };
}

/** Revoke a single guest code ahead of its expiry. */
export async function revokeGuestCode(
  tenantId: string,
  codeId: string
): Promise<ActionResult> {
  if (!(await domainsWriter())) return denied("domains");

  if (!uuid.safeParse(codeId).success || !uuid.safeParse(tenantId).success) {
    return { ok: false, message: notice("invalidIds") };
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("tenant_access_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", codeId)
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, message: notice("failRevocation", { detail: error.message }) };

  revalidateDomain(tenantId);
  return {
    ok: true,
    message: notice("codeRevoked"),
  };
}

/**
 * Rotate a resort's permanent lobby code.
 *
 * This is the only way to revoke a paired display: lobby sessions are
 * long-lived by design, so rotating here is what unpairs a lost or
 * decommissioned screen.
 */
export async function rotateLobbyCode(
  tenantId: string,
  desired?: string
): Promise<ActionResult<{ code: string }>> {
  if (!(await domainsWriter())) return denied("domains");

  if (!uuid.safeParse(tenantId).success) {
    return { ok: false, message: notice("invalidResort") };
  }

  const supabase = createAdminSupabase();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, slug")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return { ok: false, message: notice("resortNotFound") };

  let code: string;
  if (desired && desired.trim().length > 0) {
    const normalized = normalizeLobbyCode(desired);
    if (!normalized) {
      return {
        ok: false,
        message: notice("lobbyCodeCharset"),
      };
    }
    code = normalized;
  } else {
    code = generateLobbyCode(tenant.slug);
  }

  const { error } = await supabase
    .from("tenants")
    .update({
      master_lobby_code: code,
      master_lobby_code_rotated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: notice("lobbyCodeTaken"),
      };
    }
    return { ok: false, message: notice("failRotation", { detail: error.message }) };
  }

  revalidateDomain(tenantId);
  return {
    ok: true,
    message: notice("lobbyRotated"),
    data: { code },
  };
}
