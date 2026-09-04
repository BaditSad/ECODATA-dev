import "server-only";

import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
import { STORAGE_BUCKETS } from "@/types/database";
import type {
  AudioConfidenceHistogramBin,
  AudioDetectionRow,
  AudioPipelineSummary,
  IngestThroughputBucket,
  Map3dAssetRow,
  MlInferenceJobRow,
  SensorBaliseRow,
  TelemetryIngestLogRow,
  TenantAccessCodeRow,
  TenantDetectionRollupRow,
  TenantFleetOverviewRow,
  TenantRow,
} from "@/types/database";

/**
 * Super-admin reads.
 *
 * Deliberately uses the RLS-scoped server client rather than the service role.
 * The `*_super_admin_all` policies already grant estate-wide access, so going
 * through them means the policies are exercised on every request instead of
 * being bypassed and left to rot untested.
 */

export interface EstateRow extends TenantFleetOverviewRow {
  detections: TenantDetectionRollupRow | null;
}

export async function fetchEstateOverview(): Promise<EstateRow[]> {
  const supabase = createReadOnlyServerSupabase();

  const [fleet, rollup] = await Promise.all([
    supabase
      .from("tenant_fleet_overview")
      .select("*")
      .order("tenant_name", { ascending: true }),
    supabase.from("tenant_detection_rollup").select("*"),
  ]);

  if (fleet.error) throw new Error(`Fleet overview failed: ${fleet.error.message}`);
  if (rollup.error) throw new Error(`Detection rollup failed: ${rollup.error.message}`);

  const byTenant = new Map<string, TenantDetectionRollupRow>(
    (rollup.data ?? []).map((row) => [row.tenant_id, row])
  );

  return (fleet.data ?? []).map((row) => ({
    ...row,
    detections: byTenant.get(row.tenant_id) ?? null,
  }));
}

export async function fetchTenant(tenantId: string): Promise<TenantRow | null> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw new Error(`Tenant lookup failed: ${error.message}`);
  return data;
}

export async function fetchTenantSensors(
  tenantId: string
): Promise<SensorBaliseRow[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("sensors_balises")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Sensor list failed: ${error.message}`);
  return data ?? [];
}

export async function fetchTenantAccessCodes(
  tenantId: string
): Promise<TenantAccessCodeRow[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("tenant_access_codes")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("cycle_index", { ascending: false })
    .limit(12);

  if (error) throw new Error(`Access code list failed: ${error.message}`);
  return data ?? [];
}

export async function fetchTenantAssets(
  tenantId: string
): Promise<Map3dAssetRow[]> {
  const supabase = createReadOnlyServerSupabase();
  const { data, error } = await supabase
    .from("map_3d_assets")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Asset list failed: ${error.message}`);
  return data ?? [];
}

/* ── Audio & AI pipeline analytics ───────────────────────────────────────── */

export interface AudioAnalytics {
  summary: AudioPipelineSummary;
  histogram: AudioConfidenceHistogramBin[];
  throughput: IngestThroughputBucket[];
  recentDetections: DetectionWithContext[];
  queue: MlInferenceJobRow[];
  ingestFailures: TelemetryIngestLogRow[];
}

export interface DetectionWithContext extends AudioDetectionRow {
  sensor_name: string | null;
  tenant_name: string | null;
  /** Short-lived signed URLs, resolved from the stored object paths. */
  audio_signed_url: string | null;
  spectrogram_signed_url: string | null;
}

/** Long enough to audition a queue of clips without re-signing mid-review. */
const SIGNED_URL_TTL_SECONDS = 60 * 30;

/**
 * Batch-sign stored objects.
 *
 * `createSignedUrls` is one request for many paths. Signing individually would
 * mean up to 80 sequential storage round trips for a single page render.
 */
async function signPaths(
  supabase: SupabaseServerClient,
  bucket: string,
  paths: string[]
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const relative = paths.filter((path) => !/^https?:\/\//i.test(path));

  // Absolute URLs are already reachable and need no signature.
  for (const path of paths) {
    if (/^https?:\/\//i.test(path)) resolved.set(path, path);
  }

  if (relative.length === 0) return resolved;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(relative, SIGNED_URL_TTL_SECONDS);

  // A signing failure degrades the player to "clip unavailable" rather than
  // failing the whole analytics page.
  if (error || !data) return resolved;

  for (const entry of data) {
    if (entry.path && entry.signedUrl) resolved.set(entry.path, entry.signedUrl);
  }

  return resolved;
}

/** Zeroed summary, so an empty window renders as zeros rather than dashes. */
const EMPTY_SUMMARY: AudioPipelineSummary = {
  detections_total: 0,
  detections_reviewed: 0,
  detections_confirmed: 0,
  detections_rejected: 0,
  confidence_avg: null,
  confidence_p50: null,
  confidence_p95: null,
  high_confidence_share: null,
  distinct_species: 0,
  audio_minutes: 0,
  jobs_queued: 0,
  jobs_processing: 0,
  jobs_failed: 0,
  ingest_accepted: 0,
  ingest_rejected: 0,
  ingest_bytes: 0,
};

export async function fetchAudioAnalytics(options: {
  since: Date;
  tenantId?: string | null;
  detectionLimit?: number;
}): Promise<AudioAnalytics> {
  const supabase = createReadOnlyServerSupabase();
  const since = options.since.toISOString();
  const tenantId = options.tenantId ?? null;
  const limit = options.detectionLimit ?? 40;

  // One parallel batch: the analytics view is a single render, and serialising
  // six round trips would dominate its latency.
  const [summary, histogram, throughput, detections, queue, failures] =
    await Promise.all([
      supabase.rpc("audio_pipeline_summary", {
        since,
        target_tenant: tenantId,
      }),
      supabase.rpc("audio_confidence_histogram", {
        since,
        bucket_count: 10,
        target_tenant: tenantId,
      }),
      supabase.rpc("ingest_throughput", { since, target_tenant: tenantId }),
      buildDetectionQuery(supabase, since, tenantId, limit),
      buildQueueQuery(supabase, tenantId),
      buildFailureQuery(supabase, since, tenantId),
    ]);

  if (summary.error) throw new Error(`Pipeline summary failed: ${summary.error.message}`);
  if (histogram.error) throw new Error(`Confidence histogram failed: ${histogram.error.message}`);
  if (throughput.error) throw new Error(`Throughput query failed: ${throughput.error.message}`);
  if (detections.error) throw new Error(`Detection feed failed: ${detections.error.message}`);
  if (queue.error) throw new Error(`Queue query failed: ${queue.error.message}`);
  if (failures.error) throw new Error(`Ingest failure query failed: ${failures.error.message}`);

  const summaryRow = Array.isArray(summary.data) ? summary.data[0] : null;
  const flattened = flattenDetections(detections.data ?? []);

  const [audioUrls, spectrogramUrls] = await Promise.all([
    signPaths(
      supabase,
      STORAGE_BUCKETS.audioVault,
      flattened.map((row) => row.audio_clip_url).filter(Boolean)
    ),
    signPaths(
      supabase,
      STORAGE_BUCKETS.spectrograms,
      flattened
        .map((row) => row.spectrogram_url)
        .filter((path): path is string => Boolean(path))
    ),
  ]);

  return {
    summary: summaryRow ?? EMPTY_SUMMARY,
    histogram: histogram.data ?? [],
    throughput: throughput.data ?? [],
    recentDetections: flattened.map((row) => ({
      ...row,
      audio_signed_url: audioUrls.get(row.audio_clip_url) ?? null,
      spectrogram_signed_url: row.spectrogram_url
        ? spectrogramUrls.get(row.spectrogram_url) ?? null
        : null,
    })),
    queue: queue.data ?? [],
    ingestFailures: failures.data ?? [],
  };
}

type SupabaseServerClient = ReturnType<typeof createReadOnlyServerSupabase>;

/** Shape returned by the embedded-relation select below. */
interface RawDetectionJoin extends AudioDetectionRow {
  sensors_balises: { name: string } | { name: string }[] | null;
  tenants: { name: string } | { name: string }[] | null;
}

function buildDetectionQuery(
  supabase: SupabaseServerClient,
  since: string,
  tenantId: string | null,
  limit: number
) {
  const query = supabase
    .from("audio_detections")
    .select("*, sensors_balises(name), tenants(name)")
    .gte("detected_at", since)
    .order("detected_at", { ascending: false })
    .limit(limit);

  return tenantId ? query.eq("tenant_id", tenantId) : query;
}

function buildQueueQuery(supabase: SupabaseServerClient, tenantId: string | null) {
  const query = supabase
    .from("ml_inference_jobs")
    .select("*")
    .in("status", ["queued", "processing", "failed", "dead_letter"])
    .order("enqueued_at", { ascending: false })
    .limit(25);

  return tenantId ? query.eq("tenant_id", tenantId) : query;
}

function buildFailureQuery(
  supabase: SupabaseServerClient,
  since: string,
  tenantId: string | null
) {
  const query = supabase
    .from("telemetry_ingest_log")
    .select("*")
    .neq("outcome", "accepted")
    .gte("received_at", since)
    .order("received_at", { ascending: false })
    .limit(25);

  return tenantId ? query.eq("tenant_id", tenantId) : query;
}

/** A detection with its context resolved but its media not yet signed. */
type FlatDetection = AudioDetectionRow & {
  sensor_name: string | null;
  tenant_name: string | null;
};

/**
 * Collapse PostgREST's embedded relations to scalars.
 *
 * A to-one embed can come back as an object or a single-element array
 * depending on how the relationship is inferred, so both are handled.
 */
function flattenDetections(rows: RawDetectionJoin[]): FlatDetection[] {
  const firstName = (
    value: { name: string } | { name: string }[] | null
  ): string | null => {
    if (!value) return null;
    return Array.isArray(value) ? value[0]?.name ?? null : value.name;
  };

  return rows.map(({ sensors_balises, tenants, ...detection }) => ({
    ...detection,
    sensor_name: firstName(sensors_balises),
    tenant_name: firstName(tenants),
  }));
}
