"use server";

import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { generateSensorApiKey } from "@/lib/auth/sensor-keys";
import type { ActionResult } from "@/lib/actions";
import { denied, notice } from "@/i18n/action-copy";
import { domainsWriter, revalidateDomain, uuid } from "./shared";

/** Listening fleet: provisioning balises and managing their credentials. */

function provisionSchema() {
  return z.object({
    tenantId: uuid,
    name: z.string().trim().min(1).max(100),
    hardwareId: z
      .string()
      .trim()
      .min(1)
      .max(64)
      // IMEIs and vendor serials are alphanumeric with optional separators.
      .regex(/^[A-Za-z0-9_-]+$/, notice("hardwareIdCharset")),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    installNotes: z.string().trim().max(2000).optional(),
  });
}

export interface ProvisionedSensorPayload {
  sensorId: string;
  name: string;
  hardwareId: string;
  /** Displayed once. There is no way to recover it afterwards. */
  rawApiKey: string;
}

/**
 * Provision a balise and mint its credential.
 *
 * The raw key is returned to the caller exactly once and never stored: only a
 * peppered SHA-256 goes to the database. If an operator loses it before
 * flashing the unit, the fix is to rotate, not to recover.
 */
export async function provisionSensor(
  formData: FormData
): Promise<ActionResult<ProvisionedSensorPayload>> {
  if (!(await domainsWriter())) return denied("domains");

  const parsed = provisionSchema().safeParse({
    tenantId: formData.get("tenantId"),
    name: formData.get("name"),
    hardwareId: formData.get("hardwareId"),
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
    installNotes: formData.get("installNotes") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? notice("invalidProvisioning"),
    };
  }

  const input = parsed.data;
  const supabase = createAdminSupabase();

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, sensor_quota")
    .eq("id", input.tenantId)
    .maybeSingle();

  if (tenantError || !tenant) {
    return { ok: false, message: notice("resortNotFound") };
  }

  const { count } = await supabase
    .from("sensors_balises")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", input.tenantId)
    .neq("status", "retired");

  if ((count ?? 0) >= tenant.sensor_quota) {
    return {
      ok: false,
      message: notice("fleetQuota", { quota: tenant.sensor_quota }),
    };
  }

  const credential = await generateSensorApiKey();

  // Only set a location when both coordinates are present: a half-specified
  // fix would place the unit on the equator or prime meridian.
  const hasFix = input.latitude !== undefined && input.longitude !== undefined;

  const { data: sensor, error } = await supabase
    .from("sensors_balises")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      hardware_id: input.hardwareId,
      api_key_hash: credential.hash,
      api_key_last_four: credential.lastFour,
      // Not 'active' until the unit has actually reported: the first ingest
      // promotes it. Anything else would show unshipped hardware as healthy.
      status: "provisioning",
      install_notes: input.installNotes ?? null,
      location: hasFix
        ? `SRID=4326;POINT(${input.longitude} ${input.latitude})`
        : null,
    })
    .select("id, name, hardware_id")
    .single();

  if (error) {
    // 23505 is unique_violation — almost always a hardware ID already in use.
    if (error.code === "23505") {
      return {
        ok: false,
        message: notice("hardwareTaken", { id: input.hardwareId }),
      };
    }
    return { ok: false, message: notice("failProvision", { detail: error.message }) };
  }

  revalidateDomain(input.tenantId);

  return {
    ok: true,
    message: notice("sensorProvisioned", { name: sensor.name }),
    data: {
      sensorId: sensor.id,
      name: sensor.name,
      hardwareId: sensor.hardware_id,
      rawApiKey: credential.rawKey,
    },
  };
}

/** Revoke a credential. The unit stops being able to ingest immediately. */
export async function revokeSensorKey(
  tenantId: string,
  sensorId: string
): Promise<ActionResult> {
  if (!(await domainsWriter())) return denied("domains");

  if (!uuid.safeParse(sensorId).success || !uuid.safeParse(tenantId).success) {
    return { ok: false, message: notice("invalidIds") };
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("sensors_balises")
    .update({ api_key_revoked_at: new Date().toISOString(), status: "offline" })
    .eq("id", sensorId)
    // Scope to the tenant as well: an id alone would let a mistyped request
    // touch another resort's hardware.
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, message: notice("failRevocation", { detail: error.message }) };

  revalidateDomain(tenantId);
  return { ok: true, message: notice("credentialRevoked") };
}

/** Issue a fresh credential for an existing unit, e.g. after a field swap. */
export async function rotateSensorKey(
  tenantId: string,
  sensorId: string
): Promise<ActionResult<{ rawApiKey: string }>> {
  if (!(await domainsWriter())) return denied("domains");

  if (!uuid.safeParse(sensorId).success || !uuid.safeParse(tenantId).success) {
    return { ok: false, message: notice("invalidIds") };
  }

  const credential = await generateSensorApiKey();
  const supabase = createAdminSupabase();

  const { error } = await supabase
    .from("sensors_balises")
    .update({
      api_key_hash: credential.hash,
      api_key_last_four: credential.lastFour,
      api_key_issued_at: new Date().toISOString(),
      api_key_revoked_at: null,
    })
    .eq("id", sensorId)
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, message: notice("failRotateKey", { detail: error.message }) };

  revalidateDomain(tenantId);
  return {
    ok: true,
    message: notice("newKeyIssued"),
    data: { rawApiKey: credential.rawKey },
  };
}
