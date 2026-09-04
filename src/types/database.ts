/**
 * BioTwin — database contract.
 *
 * Hand-maintained to mirror `supabase/migrations/20260904000000_core_schema.sql`.
 * `npm run db:types` regenerates a raw copy into `supabase-generated.ts`; this
 * file stays authoritative because it carries the domain unions and the RPC
 * signatures that the generator flattens to `string` / `Json`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/* ── Domain unions ───────────────────────────────────────────────────────── */

export type StaffRole = "super_admin" | "resort_manager" | "csr_analyst";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "suspended"
  | "churned";

export type SensorStatus =
  | "provisioning"
  | "active"
  | "degraded"
  | "offline"
  | "retired";

export type SpeciesCategory =
  | "bird"
  | "mammal"
  | "amphibian"
  | "insect"
  | "reptile"
  | "other";

export type IucnStatus =
  | "not_evaluated"
  | "data_deficient"
  | "least_concern"
  | "near_threatened"
  | "vulnerable"
  | "endangered"
  | "critically_endangered"
  | "extinct_in_the_wild"
  | "extinct";

export type DetectionReviewState = "unreviewed" | "confirmed" | "rejected";

export type AudioCodec = "opus" | "aac" | "flac" | "wav";

export type IngestOutcome =
  | "accepted"
  | "rejected_auth"
  | "rejected_payload"
  | "rejected_quota"
  | "storage_error"
  | "internal_error";

export type MlJobStatus =
  | "queued"
  | "processing"
  | "succeeded"
  | "failed"
  | "dead_letter";

export type Asset3dKind = "glb" | "gltf" | "point_cloud" | "heightmap";

export type AssetProcessingStatus =
  | "uploaded"
  | "optimizing"
  | "ready"
  | "failed";

export type SoundscapeMode = "muted" | "ambient" | "live_detections";

export type LobbyCameraMode = "orbit" | "flyover" | "static";

export type AppLocale = "fr" | "en";

/** Georeferencing envelope stored in `tenants.coordinates`. */
export interface TenantCoordinates {
  lat: number;
  lon: number;
  alt: number;
  /** Rotation of the twin's +Z axis relative to true north, degrees. */
  headingDeg: number;
  /** Ground footprint of the twin along its longest edge, metres. */
  spanMeters: number;
}

/* ── Storage buckets ─────────────────────────────────────────────────────── */

export const STORAGE_BUCKETS = {
  audioVault: "audio-vault",
  spectrograms: "spectrograms",
  twinAssets: "twin-assets",
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/* ── Table row shapes ────────────────────────────────────────────────────── */

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  master_lobby_code: string;
  master_lobby_code_rotated_at: string;
  map_3d_asset_url: string | null;
  map_3d_asset_version: number;
  coordinates: TenantCoordinates | null;
  country_code: string | null;
  timezone: string;
  subscription_status: SubscriptionStatus;
  subscription_renews_at: string | null;
  sensor_quota: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProfileRow = {
  id: string;
  tenant_id: string | null;
  email: string;
  full_name: string | null;
  role: StaffRole;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SensorBaliseRow = {
  id: string;
  tenant_id: string;
  hardware_id: string;
  api_key_hash: string;
  api_key_last_four: string;
  api_key_issued_at: string;
  api_key_revoked_at: string | null;
  name: string;
  status: SensorStatus;
  battery_level: number | null;
  battery_voltage: number | null;
  solar_input_mv: number | null;
  signal_rssi_dbm: number | null;
  firmware_version: string | null;
  last_ping: string | null;
  /** PostGIS `geography(point,4326)`; PostgREST serialises this as WKB hex. */
  location: string | null;
  /** Generated from `location`. Use these, not `location`, on the client. */
  latitude: number | null;
  longitude: number | null;
  install_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type TenantAccessCodeRow = {
  id: string;
  tenant_id: string;
  code: string;
  valid_from: string;
  valid_until: string;
  cycle_index: number;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

export type SpeciesProfileRow = {
  id: string;
  latin_name: string;
  common_name_fr: string;
  common_name_en: string;
  category: SpeciesCategory;
  iucn_status: IucnStatus;
  description_fr: string | null;
  description_en: string | null;
  image_url: string | null;
  reference_audio_url: string | null;
  size_label: string | null;
  weight_label: string | null;
  max_age_label: string | null;
  created_at: string;
  updated_at: string;
}

export type AudioDetectionRow = {
  id: string;
  sensor_id: string;
  tenant_id: string;
  species_id: string | null;
  species_name: string;
  latin_name: string | null;
  confidence_score: number;
  model_version: string | null;
  audio_clip_url: string;
  spectrogram_url: string | null;
  clip_duration_ms: number | null;
  freq_low_hz: number | null;
  freq_high_hz: number | null;
  review_state: DetectionReviewState;
  reviewed_by: string | null;
  reviewed_at: string | null;
  detected_at: string;
  created_at: string;
}

export type TelemetryIngestLogRow = {
  id: number;
  sensor_id: string | null;
  tenant_id: string | null;
  hardware_id: string | null;
  outcome: IngestOutcome;
  http_status: number;
  error_code: string | null;
  error_detail: string | null;
  payload_bytes: number | null;
  audio_bytes: number | null;
  audio_codec: AudioCodec | null;
  duration_ms: number | null;
  received_at: string;
}

export type MlInferenceJobRow = {
  id: string;
  tenant_id: string;
  sensor_id: string;
  detection_id: string | null;
  audio_object_path: string;
  audio_codec: AudioCodec;
  duration_ms: number | null;
  sample_rate_hz: number | null;
  status: MlJobStatus;
  priority: number;
  attempts: number;
  last_error: string | null;
  locked_at: string | null;
  lock_expires_at: string | null;
  locked_by: string | null;
  enqueued_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export type Map3dAssetRow = {
  id: string;
  tenant_id: string;
  label: string;
  object_path: string;
  asset_kind: Asset3dKind;
  file_bytes: number | null;
  origin_lat: number | null;
  origin_lon: number | null;
  origin_alt_m: number | null;
  heading_deg: number | null;
  span_meters: number | null;
  processing_status: AssetProcessingStatus;
  processing_error: string | null;
  version: number;
  is_published: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LobbyDisplaySettingsRow = {
  tenant_id: string;
  featured_species_id: string | null;
  soundscape_mode: SoundscapeMode;
  soundscape_volume: number;
  camera_mode: LobbyCameraMode;
  orbit_period_s: number;
  show_live_alerts: boolean;
  show_species_names: boolean;
  locale: AppLocale;
  updated_by: string | null;
  updated_at: string;
}

export type GuestPinAttemptRow = {
  id: number;
  fingerprint_hash: string;
  succeeded: boolean;
  attempted_at: string;
}

/* ── RPC return shapes ───────────────────────────────────────────────────── */

export type VerifyGuestPinResult = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  code_id: string;
  valid_until: string;
}

export type VerifyLobbyCodeResult = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
}

export type ApplySensorTelemetryResult = {
  detection_id: string | null;
  job_id: string | null;
}

export type AudioConfidenceHistogramBin = {
  bucket_index: number;
  lower_bound: number;
  upper_bound: number;
  detections: number;
  confirmed: number;
  rejected: number;
}

export type IngestThroughputBucket = {
  hour: string;
  accepted: number;
  rejected: number;
  audio_bytes: number;
}

export type AudioPipelineSummary = {
  detections_total: number;
  detections_reviewed: number;
  detections_confirmed: number;
  detections_rejected: number;
  confidence_avg: number | null;
  confidence_p50: number | null;
  confidence_p95: number | null;
  high_confidence_share: number | null;
  distinct_species: number;
  audio_minutes: number;
  jobs_queued: number;
  jobs_processing: number;
  jobs_failed: number;
  ingest_accepted: number;
  ingest_rejected: number;
  ingest_bytes: number;
}

/* ── View row shapes ─────────────────────────────────────────────────────── */

export type TenantFleetOverviewRow = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  subscription_status: SubscriptionStatus;
  is_active: boolean;
  sensor_quota: number;
  created_at: string;
  sensors_total: number;
  sensors_active: number;
  sensors_degraded: number;
  sensors_offline: number;
  sensors_provisioning: number;
  battery_avg: number | null;
  battery_min: number | null;
  last_ping: string | null;
}

export type TenantDetectionRollupRow = {
  tenant_id: string;
  detections_24h: number;
  detections_7d: number;
  species_30d: number;
  confidence_avg_7d: number | null;
  awaiting_review: number;
  last_detection_at: string | null;
}

/* ── Insert / update helpers ─────────────────────────────────────────────── */

/**
 * Columns the database fills in for us, including generated ones.
 *
 * `master_lobby_code_rotated_at` is deliberately absent: it has a default for
 * the initial insert, but rotation is an application event and the admin
 * action stamps it explicitly.
 */
type Generated =
  | "id"
  | "created_at"
  | "updated_at"
  | "map_3d_asset_version"
  // Derived from `location` by the database; never writable.
  | "latitude"
  | "longitude";

type Insert<Row, Required extends keyof Row> = Pick<Row, Required> &
  Partial<Omit<Row, Required | Extract<Generated, keyof Row>>>;

export type TenantInsert = Insert<TenantRow, "name" | "slug" | "master_lobby_code">;
export type ProfileInsert = Insert<ProfileRow, "id" | "email">;
export type SensorBaliseInsert = Insert<
  SensorBaliseRow,
  "tenant_id" | "hardware_id" | "api_key_hash" | "api_key_last_four" | "name"
>;
export type SpeciesProfileInsert = Insert<
  SpeciesProfileRow,
  "latin_name" | "common_name_fr" | "common_name_en" | "category"
>;
export type AudioDetectionInsert = Insert<
  AudioDetectionRow,
  "sensor_id" | "tenant_id" | "species_name" | "confidence_score" | "audio_clip_url"
>;
export type TelemetryIngestLogInsert = Insert<
  TelemetryIngestLogRow,
  "outcome" | "http_status"
>;
export type Map3dAssetInsert = Insert<
  Map3dAssetRow,
  "tenant_id" | "label" | "object_path" | "asset_kind"
>;
export type LobbyDisplaySettingsUpsert = Pick<
  LobbyDisplaySettingsRow,
  "tenant_id"
> &
  Partial<Omit<LobbyDisplaySettingsRow, "tenant_id" | "updated_at">>;

/* ── Supabase client generic ─────────────────────────────────────────────── */

/**
 * Row shapes above are declared as type aliases rather than interfaces on
 * purpose. `supabase-js` constrains a schema to `Record<string, unknown>`, and
 * an interface has no implicit index signature, so an interface-typed row
 * silently fails the constraint and every query collapses to `never`.
 */
type TableDef<Row, Ins, Upd = Partial<Ins>, Rel extends readonly unknown[] = []> = {
  Row: Row;
  Insert: Ins;
  Update: Upd;
  Relationships: Rel;
};

/**
 * A single foreign key, in the shape PostgREST's type layer expects.
 *
 * These are not decoration: an embedded select such as
 * `sensors_balises(name)` only type-checks when the client can find the
 * matching relationship here. An empty list turns every join into a
 * `SelectQueryError`.
 */
type Fk<
  Name extends string,
  Column extends string,
  Relation extends string,
  OneToOne extends boolean = false,
> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: OneToOne;
  referencedRelation: Relation;
  referencedColumns: ["id"];
};

export interface Database {
  public: {
    Tables: {
      tenants: TableDef<TenantRow, TenantInsert>;
      profiles: TableDef<
        ProfileRow,
        ProfileInsert,
        Partial<ProfileInsert>,
        [Fk<"profiles_tenant_id_fkey", "tenant_id", "tenants">]
      >;
      sensors_balises: TableDef<
        SensorBaliseRow,
        SensorBaliseInsert,
        Partial<SensorBaliseInsert>,
        [Fk<"sensors_balises_tenant_id_fkey", "tenant_id", "tenants">]
      >;
      tenant_access_codes: TableDef<
        TenantAccessCodeRow,
        Insert<TenantAccessCodeRow, "tenant_id" | "code" | "valid_until">,
        Partial<Insert<TenantAccessCodeRow, "tenant_id" | "code" | "valid_until">>,
        [Fk<"tenant_access_codes_tenant_id_fkey", "tenant_id", "tenants">]
      >;
      species_profiles: TableDef<SpeciesProfileRow, SpeciesProfileInsert>;
      audio_detections: TableDef<
        AudioDetectionRow,
        AudioDetectionInsert,
        Partial<AudioDetectionInsert>,
        [
          Fk<"audio_detections_sensor_id_fkey", "sensor_id", "sensors_balises">,
          Fk<"audio_detections_tenant_id_fkey", "tenant_id", "tenants">,
          Fk<"audio_detections_species_id_fkey", "species_id", "species_profiles">,
        ]
      >;
      telemetry_ingest_log: TableDef<
        TelemetryIngestLogRow,
        TelemetryIngestLogInsert,
        Partial<TelemetryIngestLogInsert>,
        [
          Fk<"telemetry_ingest_log_sensor_id_fkey", "sensor_id", "sensors_balises">,
          Fk<"telemetry_ingest_log_tenant_id_fkey", "tenant_id", "tenants">,
        ]
      >;
      ml_inference_jobs: TableDef<
        MlInferenceJobRow,
        Insert<
          MlInferenceJobRow,
          "tenant_id" | "sensor_id" | "audio_object_path" | "audio_codec"
        >,
        Partial<
          Insert<
            MlInferenceJobRow,
            "tenant_id" | "sensor_id" | "audio_object_path" | "audio_codec"
          >
        >,
        [
          Fk<"ml_inference_jobs_sensor_id_fkey", "sensor_id", "sensors_balises">,
          Fk<"ml_inference_jobs_tenant_id_fkey", "tenant_id", "tenants">,
          Fk<"ml_inference_jobs_detection_id_fkey", "detection_id", "audio_detections">,
        ]
      >;
      map_3d_assets: TableDef<
        Map3dAssetRow,
        Map3dAssetInsert,
        Partial<Map3dAssetInsert>,
        [Fk<"map_3d_assets_tenant_id_fkey", "tenant_id", "tenants">]
      >;
      lobby_display_settings: TableDef<
        LobbyDisplaySettingsRow,
        LobbyDisplaySettingsUpsert,
        Partial<LobbyDisplaySettingsUpsert>,
        [
          // One row per resort, so this side is genuinely one-to-one.
          Fk<"lobby_display_settings_tenant_id_fkey", "tenant_id", "tenants", true>,
          Fk<
            "lobby_display_settings_featured_species_id_fkey",
            "featured_species_id",
            "species_profiles"
          >,
        ]
      >;
      guest_pin_attempts: TableDef<
        GuestPinAttemptRow,
        Insert<GuestPinAttemptRow, "fingerprint_hash" | "succeeded">
      >;
    };
    Views: {
      tenant_fleet_overview: {
        Row: TenantFleetOverviewRow;
        Relationships: [];
      };
      tenant_detection_rollup: {
        Row: TenantDetectionRollupRow;
        Relationships: [];
      };
    };
    Functions: {
      audio_pipeline_summary: {
        Args: { since: string; target_tenant?: string | null };
        Returns: AudioPipelineSummary[];
      };
      verify_guest_pin: {
        Args: { input_pin: string; client_fingerprint?: string | null };
        Returns: VerifyGuestPinResult[];
      };
      verify_lobby_code: {
        Args: { input_code: string };
        Returns: VerifyLobbyCodeResult[];
      };
      rotate_tenant_access_code: {
        Args: {
          target_tenant: string;
          target_cycle: number;
          window_from: string;
          window_until: string;
          actor?: string | null;
        };
        Returns: TenantAccessCodeRow;
      };
      allocate_guest_pin: {
        Args: { window_from: string; window_until: string };
        Returns: string;
      };
      apply_sensor_telemetry: {
        Args: {
          target_sensor: string;
          pinged_at: string;
          battery?: number | null;
          voltage?: number | null;
          solar_mv?: number | null;
          rssi_dbm?: number | null;
          firmware?: string | null;
          audio_object_path?: string | null;
          audio_codec?: AudioCodec | null;
          audio_duration_ms?: number | null;
          audio_sample_rate?: number | null;
          species?: string | null;
          species_latin?: string | null;
          confidence?: number | null;
          model?: string | null;
          clip_url?: string | null;
          spectrogram?: string | null;
        };
        Returns: ApplySensorTelemetryResult[];
      };
      claim_ml_jobs: {
        Args: {
          worker_id: string;
          batch_size?: number;
          lease_seconds?: number;
        };
        Returns: MlInferenceJobRow[];
      };
      audio_confidence_histogram: {
        Args: {
          since: string;
          bucket_count?: number;
          target_tenant?: string | null;
        };
        Returns: AudioConfidenceHistogramBin[];
      };
      ingest_throughput: {
        Args: { since: string; target_tenant?: string | null };
        Returns: IngestThroughputBucket[];
      };
      app_role: { Args: Record<never, never>; Returns: StaffRole | null };
      app_tenant_id: { Args: Record<never, never>; Returns: string | null };
      is_super_admin: { Args: Record<never, never>; Returns: boolean };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
