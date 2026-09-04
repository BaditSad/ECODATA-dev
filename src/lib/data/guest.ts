import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { STORAGE_BUCKETS } from "@/types/database";
import type {
  AudioDetectionRow,
  LobbyDisplaySettingsRow,
  Map3dAssetRow,
  SensorBaliseRow,
  SpeciesProfileRow,
  TenantRow,
} from "@/types/database";

/**
 * Guest & lobby reads.
 *
 * ── Why the service role, and what replaces RLS here ────────────────────────
 * A guest authenticates with four digits and a kiosk with a wall code. Neither
 * is an `auth.users` identity, so `auth.uid()` is null and every RLS policy in
 * the schema evaluates to false. There is no session for Postgres to reason
 * about.
 *
 * The alternative would be minting a real Supabase JWT per guest, which means
 * either a throwaway auth user per stay (unbounded junk in `auth.users`) or
 * signing tokens with the project's JWT secret in application code. Both are
 * worse than the approach here.
 *
 * So this module is the *only* place the guest tier touches the database, and
 * it upholds by construction what RLS would have enforced:
 *
 *   1. Every exported function takes `tenantId` as its first argument.
 *   2. That value comes exclusively from `verifySession()` — an HMAC-verified
 *      cookie — never from a route param, query string, or request body.
 *   3. Every query filters on it. There is no unfiltered read in this file.
 *
 * Reviewer's rule: if a function here gains a code path that does not filter
 * by `tenantId`, that is a cross-tenant data leak, full stop.
 */

/** Guests see a curated window, not the full archive. */
const GUEST_DETECTION_LIMIT = 24;

/** Signed URLs outlive a page view but not a stay. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface GuestSpeciesCard {
  detectionId: string;
  speciesName: string;
  latinName: string | null;
  confidence: number;
  detectedAt: string;
  sensorName: string;
  /** Short-lived signed URL, or null when the clip is not yet available. */
  audioUrl: string | null;
  spectrogramUrl: string | null;
  profile: SpeciesProfileRow | null;
}

export interface GuestSensorPin {
  id: string;
  name: string;
  status: SensorBaliseRow["status"];
  /** [longitude, latitude], or null when the unit has no fix yet. */
  position: [number, number] | null;
}

export interface GuestTwinView {
  tenant: Pick<TenantRow, "id" | "name" | "slug" | "coordinates" | "timezone">;
  twinAssetUrl: string | null;
  twinAsset: Pick<
    Map3dAssetRow,
    "asset_kind" | "origin_lat" | "origin_lon" | "heading_deg" | "span_meters"
  > | null;
  sensors: GuestSensorPin[];
  detections: GuestSpeciesCard[];
  lobbySettings: LobbyDisplaySettingsRow | null;
  featuredSpecies: SpeciesProfileRow | null;
}

/**
 * Build a pin position from the generated lat/lon columns.
 *
 * A unit that has never acquired a fix has nulls here, which is a real state:
 * newly provisioned hardware sitting on a workbench. Such a unit is returned
 * with `position: null` so the twin can list it without placing it.
 */
function parsePosition(
  longitude: number | null,
  latitude: number | null
): [number, number] | null {
  if (typeof longitude !== "number" || typeof latitude !== "number") return null;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return [longitude, latitude];
}

/**
 * Sign a stored object for browser playback.
 *
 * Buckets are private, so nothing is readable without this. A failure returns
 * null instead of throwing: one unplayable clip must not blank the whole view.
 */
async function signObject(
  bucket: string,
  objectPath: string | null
): Promise<string | null> {
  if (!objectPath) return null;

  // Already an absolute URL (legacy or externally hosted asset).
  if (/^https?:\/\//i.test(objectPath)) return objectPath;

  const supabase = createAdminSupabase();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Everything the guest 3D view and the lobby kiosk render.
 *
 * @param tenantId Must originate from a verified session cookie.
 */
export async function fetchGuestTwinView(
  tenantId: string
): Promise<GuestTwinView> {
  const supabase = createAdminSupabase();

  const [tenant, sensors, detections, asset, lobby] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, slug, coordinates, timezone")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("sensors_balises")
      .select("id, name, status, latitude, longitude")
      .eq("tenant_id", tenantId)
      .neq("status", "retired")
      .order("name", { ascending: true }),
    supabase
      .from("audio_detections")
      .select(
        "id, species_name, latin_name, confidence_score, detected_at, audio_clip_url, spectrogram_url, species_id, sensors_balises(name)"
      )
      .eq("tenant_id", tenantId)
      // A guest must never be shown a call an operator rejected.
      .neq("review_state", "rejected")
      // Low-confidence calls are pipeline noise, not a guest experience.
      .gte("confidence_score", 0.7)
      .order("detected_at", { ascending: false })
      .limit(GUEST_DETECTION_LIMIT),
    supabase
      .from("map_3d_assets")
      .select("object_path, asset_kind, origin_lat, origin_lon, heading_deg, span_meters")
      .eq("tenant_id", tenantId)
      .eq("is_published", true)
      .maybeSingle(),
    supabase
      .from("lobby_display_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  if (tenant.error) throw new Error(`Tenant lookup failed: ${tenant.error.message}`);
  if (!tenant.data) throw new Error(`Tenant ${tenantId} not found.`);

  const detectionRows = detections.data ?? [];

  // Hydrate species cards from the shared catalogue in one query.
  const speciesIds = [
    ...new Set(
      detectionRows
        .map((row) => row.species_id)
        .filter((id): id is string => typeof id === "string")
    ),
  ];

  const speciesById = new Map<string, SpeciesProfileRow>();
  if (speciesIds.length > 0) {
    const { data } = await supabase
      .from("species_profiles")
      .select("*")
      .in("id", speciesIds);
    for (const profile of data ?? []) speciesById.set(profile.id, profile);
  }

  const cards: GuestSpeciesCard[] = await Promise.all(
    detectionRows.map(async (row) => {
      const embedded = row.sensors_balises as
        | { name: string }
        | { name: string }[]
        | null;
      const sensorName = Array.isArray(embedded)
        ? embedded[0]?.name ?? "Unknown"
        : embedded?.name ?? "Unknown";

      const [audioUrl, spectrogramUrl] = await Promise.all([
        signObject(STORAGE_BUCKETS.audioVault, row.audio_clip_url),
        signObject(STORAGE_BUCKETS.spectrograms, row.spectrogram_url),
      ]);

      return {
        detectionId: row.id,
        speciesName: row.species_name,
        latinName: row.latin_name,
        confidence: row.confidence_score,
        detectedAt: row.detected_at,
        sensorName,
        audioUrl,
        spectrogramUrl,
        profile: row.species_id ? speciesById.get(row.species_id) ?? null : null,
      };
    })
  );

  let featuredSpecies: SpeciesProfileRow | null = null;
  if (lobby.data?.featured_species_id) {
    const { data } = await supabase
      .from("species_profiles")
      .select("*")
      .eq("id", lobby.data.featured_species_id)
      .maybeSingle();
    featuredSpecies = data ?? null;
  }

  return {
    tenant: tenant.data,
    twinAssetUrl: await signObject(
      STORAGE_BUCKETS.twinAssets,
      asset.data?.object_path ?? null
    ),
    twinAsset: asset.data
      ? {
          asset_kind: asset.data.asset_kind,
          origin_lat: asset.data.origin_lat,
          origin_lon: asset.data.origin_lon,
          heading_deg: asset.data.heading_deg,
          span_meters: asset.data.span_meters,
        }
      : null,
    sensors: (sensors.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      position: parsePosition(row.longitude, row.latitude),
    })),
    detections: cards,
    lobbySettings: lobby.data ?? null,
    featuredSpecies,
  };
}

/**
 * Newest detections only, for the lobby's live alert ticker.
 *
 * @param tenantId Must originate from a verified session cookie.
 */
export async function fetchLatestDetections(
  tenantId: string,
  limit = 8
): Promise<Pick<AudioDetectionRow, "id" | "species_name" | "latin_name" | "confidence_score" | "detected_at">[]> {
  const supabase = createAdminSupabase();

  const { data, error } = await supabase
    .from("audio_detections")
    .select("id, species_name, latin_name, confidence_score, detected_at")
    .eq("tenant_id", tenantId)
    .neq("review_state", "rejected")
    .gte("confidence_score", 0.7)
    .order("detected_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Detection ticker failed: ${error.message}`);
  return data ?? [];
}
