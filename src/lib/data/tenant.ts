import "server-only";

import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
import type {
  AudioDetectionRow,
  LobbyDisplaySettingsRow,
  RemoteAccessPassRow,
  SensorBaliseRow,
  SpeciesProfileRow,
  TenantAccessCodeRow,
  TenantDetectionRollupRow,
  TenantFleetOverviewRow,
  TenantRow,
} from "@/types/database";

/**
 * Hotel portal reads, for resort staff.
 *
 * Uses the RLS-scoped client, so `tenant_id` filters below are belt-and-braces
 * rather than the security boundary — the policies would reject a cross-tenant
 * row even if a filter were omitted. Keeping the explicit filter makes the
 * intent readable and keeps the query plans tight.
 */

export interface PortalSnapshot {
  tenant: TenantRow;
  fleet: TenantFleetOverviewRow | null;
  detections: TenantDetectionRollupRow | null;
  sensors: SensorBaliseRow[];
  recentDetections: AudioDetectionRow[];
  activeCodes: TenantAccessCodeRow[];
  remotePasses: RemoteAccessPassRow[];
  lobbySettings: LobbyDisplaySettingsRow | null;
  featuredSpecies: SpeciesProfileRow | null;
}

export async function fetchPortalSnapshot(
  tenantId: string
): Promise<PortalSnapshot> {
  const supabase = createReadOnlyServerSupabase();
  const nowIso = new Date().toISOString();

  const [tenant, fleet, rollup, sensors, detections, codes, passes, lobby] =
    await Promise.all([
      supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
      supabase
        .from("tenant_fleet_overview")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("tenant_detection_rollup")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("sensors_balises")
        .select("*")
        .eq("tenant_id", tenantId)
        .neq("status", "retired")
        .order("name", { ascending: true }),
      supabase
        .from("audio_detections")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("detected_at", { ascending: false })
        .limit(20),
      supabase
        .from("tenant_access_codes")
        .select("*")
        .eq("tenant_id", tenantId)
        .is("revoked_at", null)
        .lte("valid_from", nowIso)
        .gte("valid_until", nowIso)
        .order("valid_from", { ascending: true }),
      supabase
        .from("remote_access_passes")
        .select("*")
        .eq("tenant_id", tenantId)
        .is("revoked_at", null)
        .gt("expires_at", nowIso)
        .order("expires_at", { ascending: false }),
      supabase
        .from("lobby_display_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

  if (tenant.error) throw new Error(`Tenant lookup failed: ${tenant.error.message}`);
  if (!tenant.data) throw new Error(`Tenant ${tenantId} not found or not visible.`);
  if (sensors.error) throw new Error(`Sensor list failed: ${sensors.error.message}`);
  if (detections.error) throw new Error(`Detection feed failed: ${detections.error.message}`);
  if (codes.error) throw new Error(`Access code list failed: ${codes.error.message}`);
  if (passes.error) throw new Error(`Remote pass list failed: ${passes.error.message}`);

  // The rollup views legitimately return nothing for a resort with no
  // detections yet, so a missing row is not an error.
  let featuredSpecies: SpeciesProfileRow | null = null;
  const featuredId = lobby.data?.featured_species_id;

  if (featuredId) {
    const { data } = await supabase
      .from("species_profiles")
      .select("*")
      .eq("id", featuredId)
      .maybeSingle();
    featuredSpecies = data ?? null;
  }

  return {
    tenant: tenant.data,
    fleet: fleet.data ?? null,
    detections: rollup.data ?? null,
    sensors: sensors.data ?? [],
    recentDetections: detections.data ?? [],
    activeCodes: codes.data ?? [],
    remotePasses: passes.data ?? [],
    lobbySettings: lobby.data ?? null,
    featuredSpecies,
  };
}

/* ── TNFD / ESG reporting ────────────────────────────────────────────────── */

export interface TnfdSpeciesLine {
  speciesName: string;
  latinName: string | null;
  detections: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  averageConfidence: number;
  sensorsInvolved: number;
}

export interface TnfdReportData {
  tenant: TenantRow;
  periodStart: string;
  periodEnd: string;
  totalDetections: number;
  species: TnfdSpeciesLine[];
  monitoredSensors: number;
  /** Share of the period during which at least one balise was reporting. */
  coverageRatio: number;
}

/**
 * Assemble the evidence base for a TNFD disclosure.
 *
 * Aggregated in the app rather than SQL because a disclosure period is
 * arbitrary and operator-chosen; a fixed view would not fit, and the row count
 * for one resort over one quarter is small enough to fold in memory.
 */
export async function fetchTnfdReportData(params: {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<TnfdReportData> {
  const supabase = createReadOnlyServerSupabase();
  const { tenantId, periodStart, periodEnd } = params;

  const [tenant, detections, sensors] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
    supabase
      .from("audio_detections")
      .select("species_name, latin_name, confidence_score, detected_at, sensor_id")
      .eq("tenant_id", tenantId)
      // Confirmed or unreviewed only: a call an operator explicitly rejected
      // must never appear as evidence in a compliance disclosure.
      .neq("review_state", "rejected")
      .gte("detected_at", periodStart.toISOString())
      .lte("detected_at", periodEnd.toISOString())
      .order("detected_at", { ascending: true }),
    supabase
      .from("sensors_balises")
      .select("id")
      .eq("tenant_id", tenantId)
      .neq("status", "retired"),
  ]);

  if (tenant.error) throw new Error(`Tenant lookup failed: ${tenant.error.message}`);
  if (!tenant.data) throw new Error(`Tenant ${tenantId} not found or not visible.`);
  if (detections.error) throw new Error(`Detection query failed: ${detections.error.message}`);

  interface Accumulator {
    speciesName: string;
    latinName: string | null;
    detections: number;
    confidenceSum: number;
    firstDetectedAt: string;
    lastDetectedAt: string;
    sensors: Set<string>;
  }

  const bySpecies = new Map<string, Accumulator>();
  const activeDays = new Set<string>();

  for (const row of detections.data ?? []) {
    const existing = bySpecies.get(row.species_name);
    if (existing) {
      existing.detections += 1;
      existing.confidenceSum += row.confidence_score;
      existing.lastDetectedAt = row.detected_at;
      existing.sensors.add(row.sensor_id);
      if (!existing.latinName && row.latin_name) existing.latinName = row.latin_name;
    } else {
      bySpecies.set(row.species_name, {
        speciesName: row.species_name,
        latinName: row.latin_name,
        detections: 1,
        confidenceSum: row.confidence_score,
        firstDetectedAt: row.detected_at,
        lastDetectedAt: row.detected_at,
        sensors: new Set([row.sensor_id]),
      });
    }

    activeDays.add(row.detected_at.slice(0, 10));
  }

  const periodDays = Math.max(
    1,
    Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / 86_400_000
    )
  );

  const species: TnfdSpeciesLine[] = [...bySpecies.values()]
    .map((entry) => ({
      speciesName: entry.speciesName,
      latinName: entry.latinName,
      detections: entry.detections,
      firstDetectedAt: entry.firstDetectedAt,
      lastDetectedAt: entry.lastDetectedAt,
      averageConfidence: entry.confidenceSum / entry.detections,
      sensorsInvolved: entry.sensors.size,
    }))
    .sort((a, b) => b.detections - a.detections);

  return {
    tenant: tenant.data,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalDetections: detections.data?.length ?? 0,
    species,
    monitoredSensors: sensors.data?.length ?? 0,
    coverageRatio: Math.min(1, activeDays.size / periodDays),
  };
}
