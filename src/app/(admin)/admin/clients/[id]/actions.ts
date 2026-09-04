"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { generateSensorApiKey } from "@/lib/auth/sensor-keys";
import {
  currentCycleIndex,
  DEFAULT_ROTATION_POLICY,
  missingCycles,
  normalizeLobbyCode,
  windowForCycle,
} from "@/lib/pin-engine";
import { STORAGE_BUCKETS, type Asset3dKind } from "@/types/database";

/**
 * Super-admin mutations for one tenant.
 *
 * Every action re-authenticates through `requireSuperAdmin()`. A Server Action
 * is a public POST endpoint — the fact that it is only *rendered* inside a
 * guarded layout does nothing to stop a crafted request, so the guard has to
 * be in the action itself.
 */

export interface ActionResult<T = undefined> {
  ok: boolean;
  message: string;
  data?: T;
}

const uuid = z.string().uuid();

/* ── Sensor provisioning ─────────────────────────────────────────────────── */

const provisionSchema = z.object({
  tenantId: uuid,
  name: z.string().trim().min(1).max(100),
  hardwareId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    // IMEIs and vendor serials are alphanumeric with optional separators.
    .regex(/^[A-Za-z0-9_-]+$/, "Hardware ID may contain letters, digits, hyphen and underscore only."),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  installNotes: z.string().trim().max(2000).optional(),
});

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
  await requireSuperAdmin();

  const parsed = provisionSchema.safeParse({
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
      message: parsed.error.issues[0]?.message ?? "Invalid provisioning details.",
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
    return { ok: false, message: "Resort not found." };
  }

  const { count } = await supabase
    .from("sensors_balises")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", input.tenantId)
    .neq("status", "retired");

  if ((count ?? 0) >= tenant.sensor_quota) {
    return {
      ok: false,
      message: `Fleet quota reached (${tenant.sensor_quota}). Raise the quota before provisioning another balise.`,
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
        message: `Hardware ID ${input.hardwareId} is already provisioned on this platform.`,
      };
    }
    return { ok: false, message: `Provisioning failed: ${error.message}` };
  }

  revalidatePath(`/admin/clients/${input.tenantId}`);

  return {
    ok: true,
    message: `${sensor.name} provisioned. Copy the API key now — it will not be shown again.`,
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
  await requireSuperAdmin();

  if (!uuid.safeParse(sensorId).success || !uuid.safeParse(tenantId).success) {
    return { ok: false, message: "Invalid identifiers." };
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("sensors_balises")
    .update({ api_key_revoked_at: new Date().toISOString(), status: "offline" })
    .eq("id", sensorId)
    // Scope to the tenant as well: an id alone would let a mistyped request
    // touch another resort's hardware.
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, message: `Revocation failed: ${error.message}` };

  revalidatePath(`/admin/clients/${tenantId}`);
  return { ok: true, message: "Credential revoked. Re-provision to bring the unit back online." };
}

/** Issue a fresh credential for an existing unit, e.g. after a field swap. */
export async function rotateSensorKey(
  tenantId: string,
  sensorId: string
): Promise<ActionResult<{ rawApiKey: string }>> {
  await requireSuperAdmin();

  if (!uuid.safeParse(sensorId).success || !uuid.safeParse(tenantId).success) {
    return { ok: false, message: "Invalid identifiers." };
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

  if (error) return { ok: false, message: `Rotation failed: ${error.message}` };

  revalidatePath(`/admin/clients/${tenantId}`);
  return {
    ok: true,
    message: "New key issued. Flash it to the unit — the previous key no longer works.",
    data: { rawApiKey: credential.rawKey },
  };
}

/* ── Guest PIN rotation ──────────────────────────────────────────────────── */

/**
 * Bring a tenant's PIN cycles up to date.
 *
 * The window arithmetic comes from `lib/pin-engine.ts` and the insert from the
 * `rotate_tenant_access_code` RPC, which is idempotent per
 * `(tenant_id, cycle_index)`. Running this twice is therefore harmless, which
 * is what lets a cron job retry freely.
 */
export async function rotateGuestCodes(
  tenantId: string
): Promise<ActionResult<{ issued: number[] }>> {
  const admin = await requireSuperAdmin();

  if (!uuid.safeParse(tenantId).success) {
    return { ok: false, message: "Invalid resort id." };
  }

  const supabase = createAdminSupabase();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, created_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return { ok: false, message: "Resort not found." };

  const { data: existing, error: existingError } = await supabase
    .from("tenant_access_codes")
    .select("cycle_index")
    .eq("tenant_id", tenantId);

  if (existingError) {
    return { ok: false, message: `Could not read existing codes: ${existingError.message}` };
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
      message: `Already current — cycle ${current} is live and no window is missing.`,
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
      actor: admin.userId,
    });

    if (error) {
      // 53400 is the keyspace-exhausted signal from allocate_guest_pin.
      if (error.code === "53400") {
        return {
          ok: false,
          message:
            "The 4-digit PIN keyspace is exhausted for this window. No free code exists that does not collide with another live code.",
        };
      }
      return {
        ok: false,
        message: `Rotation failed at cycle ${cycleIndex}: ${error.message}`,
      };
    }

    issued.push(cycleIndex);
  }

  revalidatePath(`/admin/clients/${tenantId}`);
  return {
    ok: true,
    message: `Issued ${issued.length} code${issued.length === 1 ? "" : "s"} (cycle${
      issued.length === 1 ? "" : "s"
    } ${issued.join(", ")}).`,
    data: { issued },
  };
}

/** Revoke a single guest code ahead of its expiry. */
export async function revokeGuestCode(
  tenantId: string,
  codeId: string
): Promise<ActionResult> {
  await requireSuperAdmin();

  if (!uuid.safeParse(codeId).success || !uuid.safeParse(tenantId).success) {
    return { ok: false, message: "Invalid identifiers." };
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("tenant_access_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", codeId)
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, message: `Revocation failed: ${error.message}` };

  revalidatePath(`/admin/clients/${tenantId}`);
  return {
    ok: true,
    message:
      "Code revoked. Guests holding it lose access immediately; the overlapping code stays valid.",
  };
}

/* ── Lobby code ──────────────────────────────────────────────────────────── */

/** Generate a readable kiosk code, avoiding glyphs that are misread aloud. */
function generateLobbyCode(slug: string): string {
  const alphabet = "ACDEFGHJKLMNPQRTUVWXY34679";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);

  const suffix = Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");

  const prefix = slug.replace(/[^a-z0-9]/g, "").slice(0, 6).toUpperCase();
  return `${prefix || "LOBBY"}-${suffix}`;
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
  await requireSuperAdmin();

  if (!uuid.safeParse(tenantId).success) {
    return { ok: false, message: "Invalid resort id." };
  }

  const supabase = createAdminSupabase();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, slug")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return { ok: false, message: "Resort not found." };

  let code: string;
  if (desired && desired.trim().length > 0) {
    const normalized = normalizeLobbyCode(desired);
    if (!normalized) {
      return {
        ok: false,
        message: "Lobby codes must be 4–32 characters of A–Z, 0–9 and hyphens.",
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
        message: "That lobby code is already in use by another resort. Choose another.",
      };
    }
    return { ok: false, message: `Rotation failed: ${error.message}` };
  }

  revalidatePath(`/admin/clients/${tenantId}`);
  return {
    ok: true,
    message: "Lobby code rotated. Every paired display must be re-paired with the new code.",
    data: { code },
  };
}

/* ── 3D asset pipeline ───────────────────────────────────────────────────── */

const ASSET_KINDS: readonly Asset3dKind[] = ["glb", "gltf", "point_cloud", "heightmap"];

const uploadUrlSchema = z.object({
  tenantId: uuid,
  fileName: z.string().trim().min(1).max(200),
});

/**
 * Mint a direct-to-storage upload URL.
 *
 * Twin assets run to hundreds of megabytes. Routing them through a Server
 * Action would hit the body size limit and burn function time proxying bytes,
 * so the browser uploads straight to Supabase Storage with a scoped token and
 * then calls `registerTwinAsset` to record the metadata.
 */
export async function createTwinAssetUploadUrl(
  tenantId: string,
  fileName: string
): Promise<ActionResult<{ objectPath: string; token: string }>> {
  await requireSuperAdmin();

  const parsed = uploadUrlSchema.safeParse({ tenantId, fileName });
  if (!parsed.success) {
    return { ok: false, message: "Invalid upload request." };
  }

  // Strip path separators: a crafted name must not escape the tenant prefix
  // that storage RLS relies on.
  const safeName = parsed.data.fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  const objectPath = `${tenantId}/${Date.now()}_${safeName}`;

  const supabase = createAdminSupabase();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.twinAssets)
    .createSignedUploadUrl(objectPath);

  if (error || !data) {
    return { ok: false, message: `Could not prepare upload: ${error?.message ?? "unknown error"}` };
  }

  return { ok: true, message: "Upload authorised.", data: { objectPath, token: data.token } };
}

const registerAssetSchema = z.object({
  tenantId: uuid,
  objectPath: z.string().min(1),
  label: z.string().trim().min(1).max(120),
  assetKind: z.enum(["glb", "gltf", "point_cloud", "heightmap"]),
  fileBytes: z.coerce.number().int().min(0).optional(),
  originLat: z.coerce.number().min(-90).max(90),
  originLon: z.coerce.number().min(-180).max(180),
  originAltM: z.coerce.number().optional(),
  headingDeg: z.coerce.number().min(0).max(359.999),
  spanMeters: z.coerce.number().positive().max(100_000),
  publish: z.coerce.boolean().optional(),
});

/**
 * Record an uploaded twin asset and optionally publish it.
 *
 * Publishing is exclusive — the schema carries a unique partial index allowing
 * one published asset per tenant — so the previous one is unpublished first.
 * Guest and lobby views resolve the twin with no tie-breaker and would
 * otherwise pick arbitrarily.
 */
export async function registerTwinAsset(
  formData: FormData
): Promise<ActionResult<{ assetId: string }>> {
  const admin = await requireSuperAdmin();

  const parsed = registerAssetSchema.safeParse({
    tenantId: formData.get("tenantId"),
    objectPath: formData.get("objectPath"),
    label: formData.get("label"),
    assetKind: formData.get("assetKind"),
    fileBytes: formData.get("fileBytes") || undefined,
    originLat: formData.get("originLat"),
    originLon: formData.get("originLon"),
    originAltM: formData.get("originAltM") || undefined,
    headingDeg: formData.get("headingDeg"),
    spanMeters: formData.get("spanMeters"),
    publish: formData.get("publish") === "on" ? true : undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid asset metadata.",
    };
  }

  const input = parsed.data;
  if (!ASSET_KINDS.includes(input.assetKind)) {
    return { ok: false, message: "Unsupported asset kind." };
  }

  const supabase = createAdminSupabase();

  const { data: latest } = await supabase
    .from("map_3d_assets")
    .select("version")
    .eq("tenant_id", input.tenantId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  if (input.publish) {
    const { error: unpublishError } = await supabase
      .from("map_3d_assets")
      .update({ is_published: false })
      .eq("tenant_id", input.tenantId)
      .eq("is_published", true);

    if (unpublishError) {
      return {
        ok: false,
        message: `Could not retire the current twin: ${unpublishError.message}`,
      };
    }
  }

  const { data: asset, error } = await supabase
    .from("map_3d_assets")
    .insert({
      tenant_id: input.tenantId,
      label: input.label,
      object_path: input.objectPath,
      asset_kind: input.assetKind,
      file_bytes: input.fileBytes ?? null,
      origin_lat: input.originLat,
      origin_lon: input.originLon,
      origin_alt_m: input.originAltM ?? null,
      heading_deg: input.headingDeg,
      span_meters: input.spanMeters,
      // A .glb from the photogrammetry pipeline is already decimated and ready;
      // raw point clouds and heightmaps still need an optimisation pass.
      processing_status: input.assetKind === "glb" ? "ready" : "uploaded",
      version: nextVersion,
      is_published: input.publish ?? false,
      uploaded_by: admin.userId,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: `Could not register asset: ${error.message}` };
  }

  if (input.publish) {
    // Mirror the georeferencing onto the tenant so the guest view can place
    // sensor pins without joining the asset table on every render.
    await supabase
      .from("tenants")
      .update({
        map_3d_asset_url: input.objectPath,
        coordinates: {
          lat: input.originLat,
          lon: input.originLon,
          alt: input.originAltM ?? 0,
          headingDeg: input.headingDeg,
          spanMeters: input.spanMeters,
        },
      })
      .eq("id", input.tenantId);
  }

  revalidatePath(`/admin/clients/${input.tenantId}`);
  return {
    ok: true,
    message: input.publish
      ? `Version ${nextVersion} registered and published as the live twin.`
      : `Version ${nextVersion} registered as a draft.`,
    data: { assetId: asset.id },
  };
}
