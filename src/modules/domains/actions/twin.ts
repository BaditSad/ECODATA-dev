"use server";

import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/actions";
import { denied, notice } from "@/i18n/action-copy";
import { STORAGE_BUCKETS, type Asset3dKind } from "@/types/database";
import { domainsWriter, revalidateDomain, uuid } from "./shared";

/** Digital twin: map files uploaded for a resort, and which one is live. */

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
  if (!(await domainsWriter())) return denied("domains");

  const parsed = uploadUrlSchema.safeParse({ tenantId, fileName });
  if (!parsed.success) {
    return { ok: false, message: notice("invalidUpload") };
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
    return {
      ok: false,
      message: notice("failPrepareUpload", {
        detail: error?.message ?? notice("unknownError"),
      }),
    };
  }

  return { ok: true, message: notice("uploadAuthorised"), data: { objectPath, token: data.token } };
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
  const actor = await domainsWriter();
  if (!actor) return denied("domains");

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
      message: parsed.error.issues[0]?.message ?? notice("invalidAssetMeta"),
    };
  }

  const input = parsed.data;
  if (!ASSET_KINDS.includes(input.assetKind)) {
    return { ok: false, message: notice("unsupportedAsset") };
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
        message: notice("failRetireTwin", { detail: unpublishError.message }),
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
      uploaded_by: actor.userId,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: notice("failRegisterAsset", { detail: error.message }) };
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

  revalidateDomain(input.tenantId);
  return {
    ok: true,
    message: input.publish
      ? notice("twinPublished", { version: nextVersion })
      : notice("twinDraft", { version: nextVersion }),
    data: { assetId: asset.id },
  };
}
