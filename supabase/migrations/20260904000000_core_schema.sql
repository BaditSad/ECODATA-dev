-- ═══════════════════════════════════════════════════════════════════════════
-- BioTwin — Production Core Schema
-- ═══════════════════════════════════════════════════════════════════════════
-- Multi-tenant biodiversity digital twins for luxury eco-resorts.
--
-- Four access tiers:
--   super_admin      → platform operator, full estate, /admin
--   resort_manager   → tenant-scoped staff, /hotel-portal
--   csr_analyst      → tenant-scoped staff, read-mostly, /hotel-portal
--   guest / lobby    → no auth.users row; authenticated by rotating PIN or
--                      static lobby code, resolved through SECURITY DEFINER
--                      RPCs and served by tenant-pinned server code.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensions ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists postgis;
-- btree_gist lets an exclusion constraint mix scalar equality with range
-- overlap, which is how we guarantee globally unique *concurrently active*
-- guest PINs (see tenant_access_codes).
create extension if not exists btree_gist;
-- pgcrypto provides gen_random_bytes for code generation and digest() for
-- hashing PIN-attempt fingerprints.
create extension if not exists pgcrypto;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TENANTS (RESORTS)
-- ═══════════════════════════════════════════════════════════════════════════

create table public.tenants (
    id                        uuid primary key default uuid_generate_v4(),
    name                      varchar(255) not null,
    slug                      varchar(255) unique not null,

    -- Permanent alphanumeric code for hall displays. Globally unique because
    -- /lobby authenticates on the code alone, with no tenant hint.
    master_lobby_code         varchar(32) not null,
    master_lobby_code_rotated_at timestamptz not null default now(),

    -- Digital twin: signed or public URL of the terrain asset (.glb / .gltf /
    -- point cloud) plus the georeferencing envelope used to place sensor pins.
    map_3d_asset_url          text,
    map_3d_asset_version      integer not null default 0,

    -- { "lat": number, "lon": number, "alt": number, "headingDeg": number,
    --   "spanMeters": number }
    coordinates               jsonb,

    country_code              char(2),
    timezone                  text not null default 'UTC',

    subscription_status       varchar(20) not null default 'trial'
        check (subscription_status in ('trial', 'active', 'past_due', 'suspended', 'churned')),
    subscription_renews_at    timestamptz,

    -- Denormalised fleet target: the standard deployment is 7 balises per site.
    sensor_quota              integer not null default 7 check (sensor_quota between 0 and 512),

    is_active                 boolean not null default true,
    created_at                timestamptz not null default now(),
    updated_at                timestamptz not null default now(),

    constraint tenants_slug_format
        check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint tenants_lobby_code_format
        check (master_lobby_code ~ '^[A-Z0-9-]{4,32}$')
);

create unique index idx_tenants_lobby_code
    on public.tenants (upper(master_lobby_code));

comment on table public.tenants is
    'Resort tenants. One row per contracted property; the unit of data segregation.';
comment on column public.tenants.master_lobby_code is
    'Permanent kiosk code. Case-insensitively unique platform-wide: /lobby resolves a tenant from this code alone.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. STAFF PROFILES
-- ═══════════════════════════════════════════════════════════════════════════
-- Mirrors auth.users and carries the role + tenant claim every RLS policy
-- reads. Guests never appear here.

create table public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    tenant_id   uuid references public.tenants(id) on delete cascade,
    email       varchar(320) not null unique,
    full_name   varchar(255),
    role        varchar(20) not null default 'csr_analyst'
        check (role in ('super_admin', 'resort_manager', 'csr_analyst')),
    is_active   boolean not null default true,
    last_seen_at timestamptz,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    -- A super_admin is platform-wide and must not be pinned to a tenant;
    -- every resort role must be.
    constraint profiles_tenant_scope_matches_role check (
        (role = 'super_admin' and tenant_id is null)
        or (role <> 'super_admin' and tenant_id is not null)
    )
);

create index idx_profiles_tenant on public.profiles (tenant_id) where tenant_id is not null;

comment on table public.profiles is
    'Staff identities. Source of truth for the role/tenant claims used by RLS.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. HARDWARE SENSORS / BALISES
-- ═══════════════════════════════════════════════════════════════════════════
-- Autonomous field units: LiFePO4 + solar, 4G/LTE-M backhaul, on-board
-- bioacoustic capture.

create table public.sensors_balises (
    id                uuid primary key default uuid_generate_v4(),
    tenant_id         uuid not null references public.tenants(id) on delete cascade,

    -- Physical identity stamped at provisioning: IMEI, or vendor serial.
    hardware_id       varchar(64) unique not null,

    -- SHA-256 of (pepper || raw key). The raw key is shown once, at
    -- provisioning, and is never recoverable.
    api_key_hash      text not null,
    -- Last four characters of the raw key, so operators can identify which
    -- credential a field unit holds without being able to reconstruct it.
    api_key_last_four char(4) not null,
    api_key_issued_at timestamptz not null default now(),
    api_key_revoked_at timestamptz,

    name              varchar(100) not null,
    status            varchar(20) not null default 'active'
        check (status in ('provisioning', 'active', 'degraded', 'offline', 'retired')),

    battery_level     integer check (battery_level between 0 and 100),
    -- LiFePO4 pack terminal voltage. The chemistry's discharge curve is nearly
    -- flat from 3.2-3.3 V, so percentage alone hides imminent cut-off; raw
    -- voltage is what the fleet view uses to predict a field visit.
    battery_voltage   numeric(4, 2) check (battery_voltage between 0 and 99.99),
    solar_input_mv    integer check (solar_input_mv between 0 and 60000),

    -- 4G/LTE-M radio quality, dBm (RSRP). Typical usable range -44 .. -140.
    signal_rssi_dbm   integer check (signal_rssi_dbm between -140 and 0),
    firmware_version  varchar(32),

    last_ping         timestamptz,
    location          geography(point, 4326),

    -- PostgREST serialises `geography` as WKB hex, which a browser cannot use.
    -- These generated columns expose the same fix as plain numbers so the
    -- guest and lobby views can place pins without a PostGIS round trip or a
    -- WKB parser shipped to the client. Stored, because they are read on every
    -- twin render and written only when a unit is physically moved.
    latitude          double precision
        generated always as (st_y(location::geometry)) stored,
    longitude         double precision
        generated always as (st_x(location::geometry)) stored,

    install_notes     text,

    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index idx_sensors_tenant on public.sensors_balises (tenant_id, status);
create index idx_sensors_last_ping on public.sensors_balises (last_ping desc nulls last);
-- Hot path: every ingest request authenticates by hash lookup.
create index idx_sensors_api_key_hash on public.sensors_balises (api_key_hash)
    where api_key_revoked_at is null;
create index idx_sensors_location on public.sensors_balises using gist (location);

comment on column public.sensors_balises.battery_voltage is
    'LiFePO4 terminal voltage. Flat discharge curve makes voltage a better field-visit predictor than percentage alone.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. DYNAMIC GUEST ACCESS CODES (ROTATION WITH OVERLAP)
-- ═══════════════════════════════════════════════════════════════════════════
-- Generated monthly, valid six weeks → two consecutive codes are always live
-- at once, so a guest who checked in under the outgoing code is never cut off
-- at rollover.

create table public.tenant_access_codes (
    id           uuid primary key default uuid_generate_v4(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    code         varchar(4) not null,

    valid_from   timestamptz not null default now(),
    valid_until  timestamptz not null,

    -- Monotonic rotation counter per tenant. Cycle 0 is issued at onboarding;
    -- the engine derives every subsequent window from it, so generation is
    -- idempotent and safe to retry from a cron job.
    cycle_index  integer not null default 0 check (cycle_index >= 0),

    revoked_at   timestamptz,
    created_by   uuid references public.profiles(id) on delete set null,
    created_at   timestamptz not null default now(),

    constraint access_codes_is_four_digits check (code ~ '^[0-9]{4}$'),
    constraint access_codes_window_ordered check (valid_until > valid_from),
    constraint access_codes_cycle_unique unique (tenant_id, cycle_index),

    -- ─────────────────────────────────────────────────────────────────────
    -- The load-bearing constraint of the whole guest auth model.
    --
    -- verify_guest_pin() receives four digits and nothing else, so a PIN must
    -- resolve to exactly one tenant. Two codes sharing the same digits with
    -- overlapping validity windows would make the lookup ambiguous and could
    -- expose resort A's telemetry to resort B's guest. Postgres rejects that
    -- write outright rather than trusting application code to check first.
    --
    -- Revoked codes are excluded, so digits become reusable once retired.
    -- ─────────────────────────────────────────────────────────────────────
    constraint access_codes_no_overlapping_duplicates
        exclude using gist (
            code with =,
            tstzrange(valid_from, valid_until) with &&
        ) where (revoked_at is null)
);

create index idx_access_codes_lookup
    on public.tenant_access_codes (tenant_id, code, valid_from, valid_until);

-- Serves the RPC hot path: resolve live code → tenant.
create index idx_access_codes_active
    on public.tenant_access_codes (code, valid_until desc)
    where revoked_at is null;

comment on constraint access_codes_no_overlapping_duplicates on public.tenant_access_codes is
    'Guarantees a live 4-digit PIN maps to exactly one tenant. Without it, guest PIN auth could cross tenant boundaries.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SPECIES REFERENCE CATALOGUE
-- ═══════════════════════════════════════════════════════════════════════════
-- Platform-global reference data backing guest info cards. Not tenant-scoped:
-- a toucan is a toucan at every resort.

create table public.species_profiles (
    id             uuid primary key default uuid_generate_v4(),
    latin_name     varchar(255) unique not null,
    common_name_fr varchar(255) not null,
    common_name_en varchar(255) not null,
    category       varchar(20) not null
        check (category in ('bird', 'mammal', 'amphibian', 'insect', 'reptile', 'other')),
    iucn_status    varchar(24) not null default 'not_evaluated'
        check (iucn_status in (
            'not_evaluated', 'data_deficient', 'least_concern', 'near_threatened',
            'vulnerable', 'endangered', 'critically_endangered',
            'extinct_in_the_wild', 'extinct'
        )),
    description_fr text,
    description_en text,
    image_url      text,
    reference_audio_url text,
    size_label     varchar(64),
    weight_label   varchar(64),
    max_age_label  varchar(64),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index idx_species_category on public.species_profiles (category);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. BIOACOUSTIC DETECTIONS
-- ═══════════════════════════════════════════════════════════════════════════

create table public.audio_detections (
    id                uuid primary key default uuid_generate_v4(),
    sensor_id         uuid not null references public.sensors_balises(id) on delete cascade,
    tenant_id         uuid not null references public.tenants(id) on delete cascade,
    species_id        uuid references public.species_profiles(id) on delete set null,

    -- Denormalised from the catalogue at write time: a detection is an
    -- immutable historical record and must survive taxonomy edits.
    species_name      varchar(255) not null,
    latin_name        varchar(255),

    confidence_score  double precision not null check (confidence_score between 0 and 1),
    model_version     varchar(64),

    audio_clip_url    text not null,
    spectrogram_url   text,
    clip_duration_ms  integer check (clip_duration_ms between 0 and 600000),

    -- Dominant frequency band of the vocalisation, Hz. Drives spectrogram
    -- framing in the admin analytics view.
    freq_low_hz       integer check (freq_low_hz >= 0),
    freq_high_hz      integer check (freq_high_hz >= 0),

    -- Set once an operator confirms or rejects the model's call. Feeds the
    -- precision figures on /admin/analytics/audio.
    review_state      varchar(16) not null default 'unreviewed'
        check (review_state in ('unreviewed', 'confirmed', 'rejected')),
    reviewed_by       uuid references public.profiles(id) on delete set null,
    reviewed_at       timestamptz,

    detected_at       timestamptz not null default now(),
    created_at        timestamptz not null default now(),

    constraint detections_freq_band_ordered
        check (freq_high_hz is null or freq_low_hz is null or freq_high_hz >= freq_low_hz)
);

-- Indexing for high throughput
create index idx_audio_detections_tenant
    on public.audio_detections (tenant_id, detected_at desc);
create index idx_audio_detections_sensor
    on public.audio_detections (sensor_id, detected_at desc);
create index idx_audio_detections_species
    on public.audio_detections (tenant_id, species_name, detected_at desc);
-- Powers the ML confidence histogram without scanning the full table.
create index idx_audio_detections_confidence
    on public.audio_detections (detected_at desc, confidence_score);
create index idx_audio_detections_review
    on public.audio_detections (review_state, detected_at desc)
    where review_state = 'unreviewed';

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. TELEMETRY INGEST LOG
-- ═══════════════════════════════════════════════════════════════════════════
-- Append-only audit of every ingest attempt. Backs pipeline throughput charts
-- and post-mortems on field connectivity.

create table public.telemetry_ingest_log (
    id             bigserial primary key,
    sensor_id      uuid references public.sensors_balises(id) on delete set null,
    tenant_id      uuid references public.tenants(id) on delete cascade,
    hardware_id    varchar(64),

    outcome        varchar(24) not null
        check (outcome in (
            'accepted', 'rejected_auth', 'rejected_payload',
            'rejected_quota', 'storage_error', 'internal_error'
        )),
    http_status    integer not null check (http_status between 100 and 599),
    error_code     varchar(64),
    error_detail   text,

    payload_bytes  integer check (payload_bytes >= 0),
    audio_bytes    integer check (audio_bytes >= 0),
    audio_codec    varchar(16) check (audio_codec in ('opus', 'aac', 'flac', 'wav')),
    duration_ms    integer check (duration_ms >= 0),

    received_at    timestamptz not null default now()
);

create index idx_ingest_log_recent on public.telemetry_ingest_log (received_at desc);
create index idx_ingest_log_tenant on public.telemetry_ingest_log (tenant_id, received_at desc);
create index idx_ingest_log_failures on public.telemetry_ingest_log (outcome, received_at desc)
    where outcome <> 'accepted';

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. ML INFERENCE QUEUE
-- ═══════════════════════════════════════════════════════════════════════════
-- Ingestion is deliberately cheap: it stores audio and enqueues. Classification
-- happens out-of-band so a field unit on a weak 4G link is never blocked by
-- model latency.

create table public.ml_inference_jobs (
    id              uuid primary key default uuid_generate_v4(),
    tenant_id       uuid not null references public.tenants(id) on delete cascade,
    sensor_id       uuid not null references public.sensors_balises(id) on delete cascade,
    detection_id    uuid references public.audio_detections(id) on delete set null,

    audio_object_path text not null,
    audio_codec     varchar(16) not null check (audio_codec in ('opus', 'aac', 'flac', 'wav')),
    duration_ms     integer check (duration_ms >= 0),
    sample_rate_hz  integer check (sample_rate_hz between 4000 and 384000),

    status          varchar(16) not null default 'queued'
        check (status in ('queued', 'processing', 'succeeded', 'failed', 'dead_letter')),
    priority        smallint not null default 5 check (priority between 1 and 9),
    attempts        smallint not null default 0 check (attempts >= 0),
    last_error      text,

    -- Cooperative lease: a worker claims a job by stamping these, and an
    -- expired lease is reclaimable. Avoids a stuck worker parking a job.
    locked_at       timestamptz,
    lock_expires_at timestamptz,
    locked_by       varchar(64),

    enqueued_at     timestamptz not null default now(),
    started_at      timestamptz,
    finished_at     timestamptz
);

-- Worker claim path: highest priority, oldest first.
create index idx_ml_jobs_claimable
    on public.ml_inference_jobs (priority, enqueued_at)
    where status = 'queued';
create index idx_ml_jobs_tenant on public.ml_inference_jobs (tenant_id, enqueued_at desc);
create index idx_ml_jobs_reclaim on public.ml_inference_jobs (lock_expires_at)
    where status = 'processing';

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. 3D ASSET PIPELINE
-- ═══════════════════════════════════════════════════════════════════════════

create table public.map_3d_assets (
    id             uuid primary key default uuid_generate_v4(),
    tenant_id      uuid not null references public.tenants(id) on delete cascade,

    label          varchar(120) not null,
    object_path    text not null,
    asset_kind     varchar(16) not null
        check (asset_kind in ('glb', 'gltf', 'point_cloud', 'heightmap')),
    file_bytes     bigint check (file_bytes >= 0),

    -- Georeferencing: where the mesh origin sits and how it is oriented, so
    -- sensor GPS fixes can be projected onto the twin.
    origin_lat     double precision check (origin_lat between -90 and 90),
    origin_lon     double precision check (origin_lon between -180 and 180),
    origin_alt_m   double precision,
    heading_deg    double precision check (heading_deg >= 0 and heading_deg < 360),
    span_meters    double precision check (span_meters > 0),

    processing_status varchar(16) not null default 'uploaded'
        check (processing_status in ('uploaded', 'optimizing', 'ready', 'failed')),
    processing_error text,

    version        integer not null default 1 check (version >= 1),
    is_published   boolean not null default false,

    uploaded_by    uuid references public.profiles(id) on delete set null,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index idx_map_assets_tenant on public.map_3d_assets (tenant_id, created_at desc);
-- At most one published twin per tenant: the guest and lobby views resolve the
-- asset with no tie-breaker.
create unique index idx_map_assets_one_published
    on public.map_3d_assets (tenant_id) where is_published;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. LOBBY DISPLAY SETTINGS
-- ═══════════════════════════════════════════════════════════════════════════
-- Driven from /hotel-portal, consumed by the kiosk at /lobby.

create table public.lobby_display_settings (
    tenant_id           uuid primary key references public.tenants(id) on delete cascade,

    featured_species_id uuid references public.species_profiles(id) on delete set null,
    soundscape_mode     varchar(16) not null default 'ambient'
        check (soundscape_mode in ('muted', 'ambient', 'live_detections')),
    soundscape_volume   smallint not null default 40 check (soundscape_volume between 0 and 100),

    camera_mode         varchar(16) not null default 'orbit'
        check (camera_mode in ('orbit', 'flyover', 'static')),
    orbit_period_s      smallint not null default 90 check (orbit_period_s between 20 and 600),

    show_live_alerts    boolean not null default true,
    show_species_names  boolean not null default true,
    locale              char(2) not null default 'fr' check (locale in ('fr', 'en')),

    updated_by          uuid references public.profiles(id) on delete set null,
    updated_at          timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. GUEST PIN ATTEMPT THROTTLE
-- ═══════════════════════════════════════════════════════════════════════════
-- A 4-digit PIN is a 10 000-value keyspace. Without throttling it falls to a
-- trivial online brute force, so attempts are counted server-side and the RPC
-- refuses to evaluate once a fingerprint exceeds its budget.

create table public.guest_pin_attempts (
    id              bigserial primary key,
    -- SHA-256 of (client IP + user agent). Never store the raw address.
    fingerprint_hash text not null,
    succeeded       boolean not null,
    attempted_at    timestamptz not null default now()
);

create index idx_pin_attempts_window
    on public.guest_pin_attempts (fingerprint_hash, attempted_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. updated_at MAINTENANCE
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger trg_tenants_touch before update on public.tenants
    for each row execute function public.touch_updated_at();
create trigger trg_profiles_touch before update on public.profiles
    for each row execute function public.touch_updated_at();
create trigger trg_sensors_touch before update on public.sensors_balises
    for each row execute function public.touch_updated_at();
create trigger trg_species_touch before update on public.species_profiles
    for each row execute function public.touch_updated_at();
create trigger trg_map_assets_touch before update on public.map_3d_assets
    for each row execute function public.touch_updated_at();
create trigger trg_lobby_settings_touch before update on public.lobby_display_settings
    for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. CLAIM HELPERS
-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER so policies on public.profiles can call them without
-- recursing into their own RLS check.

create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select p.role
    from public.profiles p
    where p.id = auth.uid() and p.is_active
$$;

create or replace function public.app_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select p.tenant_id
    from public.profiles p
    where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_active and p.role = 'super_admin'
    )
$$;

create or replace function public.is_tenant_member(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.is_active
          and p.tenant_id = target_tenant
    )
$$;

create or replace function public.can_manage_tenant(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.is_active
          and p.tenant_id = target_tenant
          and p.role = 'resort_manager'
    )
$$;

revoke all on function public.app_role() from public;
revoke all on function public.app_tenant_id() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.can_manage_tenant(uuid) from public;
grant execute on function public.app_role() to authenticated;
grant execute on function public.app_tenant_id() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.can_manage_tenant(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════
-- Enabled everywhere. The service role bypasses RLS by design and is the only
-- credential the telemetry pipeline and the guest data layer ever use.

alter table public.tenants                enable row level security;
alter table public.profiles               enable row level security;
alter table public.sensors_balises        enable row level security;
alter table public.tenant_access_codes    enable row level security;
alter table public.species_profiles       enable row level security;
alter table public.audio_detections       enable row level security;
alter table public.telemetry_ingest_log   enable row level security;
alter table public.ml_inference_jobs      enable row level security;
alter table public.map_3d_assets          enable row level security;
alter table public.lobby_display_settings enable row level security;
alter table public.guest_pin_attempts     enable row level security;

-- NOTE: deliberately no FORCE ROW LEVEL SECURITY anywhere. The SECURITY
-- DEFINER RPCs below execute as the table owner, and FORCE would subject that
-- owner to policies written for `authenticated`, breaking guest PIN
-- verification on any deployment where the owner lacks BYPASSRLS.

-- ── profiles ───────────────────────────────────────────────────────────────
create policy profiles_read_self on public.profiles
    for select to authenticated
    using (id = auth.uid());

create policy profiles_update_self on public.profiles
    for update to authenticated
    using (id = auth.uid())
    -- Privilege escalation guard: a user may edit their own row but cannot
    -- change their role or move themselves to another tenant.
    with check (
        id = auth.uid()
        and role = public.app_role()
        and tenant_id is not distinct from public.app_tenant_id()
    );

create policy profiles_read_same_tenant on public.profiles
    for select to authenticated
    using (tenant_id is not null and tenant_id = public.app_tenant_id());

create policy profiles_super_admin_all on public.profiles
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ── tenants ────────────────────────────────────────────────────────────────
create policy tenants_super_admin_all on public.tenants
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

create policy tenants_staff_read_own on public.tenants
    for select to authenticated
    using (id = public.app_tenant_id());

-- Managers may edit presentation details of their own resort. Slug, lobby
-- code, subscription and quota stay under platform control: they are omitted
-- from the portal's write surface and re-validated by a trigger below.
create policy tenants_manager_update_own on public.tenants
    for update to authenticated
    using (public.can_manage_tenant(id))
    with check (public.can_manage_tenant(id));

create or replace function public.guard_tenant_manager_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if public.is_super_admin() then
        return new;
    end if;

    if new.slug is distinct from old.slug
       or new.master_lobby_code is distinct from old.master_lobby_code
       or new.subscription_status is distinct from old.subscription_status
       or new.sensor_quota is distinct from old.sensor_quota
       or new.is_active is distinct from old.is_active
    then
        raise exception
            'Only a platform super admin may change slug, lobby code, subscription, quota or activation'
            using errcode = 'insufficient_privilege';
    end if;

    return new;
end;
$$;

create trigger trg_tenants_guard_manager_update
    before update on public.tenants
    for each row execute function public.guard_tenant_manager_update();

-- ── sensors_balises ────────────────────────────────────────────────────────
create policy sensors_super_admin_all on public.sensors_balises
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

create policy sensors_staff_read_own on public.sensors_balises
    for select to authenticated
    using (public.is_tenant_member(tenant_id));

-- Field-visit bookkeeping only. Provisioning, key rotation and retirement
-- remain super-admin operations.
create policy sensors_manager_update_own on public.sensors_balises
    for update to authenticated
    using (public.can_manage_tenant(tenant_id))
    with check (public.can_manage_tenant(tenant_id));

-- ── tenant_access_codes ────────────────────────────────────────────────────
-- Staff may read their own codes to hand them to guests. Nobody but the
-- service role or a super admin may write: the overlap engine is the single
-- writer, and hand-editing a window would break the no-gap guarantee.
create policy access_codes_super_admin_all on public.tenant_access_codes
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

create policy access_codes_staff_read_own on public.tenant_access_codes
    for select to authenticated
    using (public.is_tenant_member(tenant_id));

-- ── species_profiles ───────────────────────────────────────────────────────
create policy species_read_all_authenticated on public.species_profiles
    for select to authenticated
    using (true);

create policy species_super_admin_write on public.species_profiles
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ── audio_detections ───────────────────────────────────────────────────────
create policy detections_super_admin_all on public.audio_detections
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

create policy detections_staff_read_own on public.audio_detections
    for select to authenticated
    using (public.is_tenant_member(tenant_id));

-- Staff curate their own detections (confirm / reject a model call).
create policy detections_staff_review_own on public.audio_detections
    for update to authenticated
    using (public.is_tenant_member(tenant_id))
    with check (public.is_tenant_member(tenant_id));

-- ── telemetry_ingest_log ───────────────────────────────────────────────────
create policy ingest_log_super_admin_read on public.telemetry_ingest_log
    for select to authenticated
    using (public.is_super_admin());

create policy ingest_log_staff_read_own on public.telemetry_ingest_log
    for select to authenticated
    using (tenant_id is not null and public.is_tenant_member(tenant_id));

-- ── ml_inference_jobs ──────────────────────────────────────────────────────
create policy ml_jobs_super_admin_all on public.ml_inference_jobs
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

create policy ml_jobs_staff_read_own on public.ml_inference_jobs
    for select to authenticated
    using (public.is_tenant_member(tenant_id));

-- ── map_3d_assets ──────────────────────────────────────────────────────────
create policy map_assets_super_admin_all on public.map_3d_assets
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

create policy map_assets_staff_read_own on public.map_3d_assets
    for select to authenticated
    using (public.is_tenant_member(tenant_id));

-- ── lobby_display_settings ─────────────────────────────────────────────────
create policy lobby_settings_super_admin_all on public.lobby_display_settings
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

create policy lobby_settings_staff_read_own on public.lobby_display_settings
    for select to authenticated
    using (public.is_tenant_member(tenant_id));

create policy lobby_settings_manager_write_own on public.lobby_display_settings
    for all to authenticated
    using (public.can_manage_tenant(tenant_id))
    with check (public.can_manage_tenant(tenant_id));

-- ── guest_pin_attempts ─────────────────────────────────────────────────────
-- No policy grants access: only the service role and SECURITY DEFINER RPCs
-- touch this table. Enumerating attempt volume is itself a signal.
create policy pin_attempts_super_admin_read on public.guest_pin_attempts
    for select to authenticated
    using (public.is_super_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. GUEST PIN VERIFICATION RPC
-- ═══════════════════════════════════════════════════════════════════════════

-- Rolling-window budget for a single client fingerprint.
create or replace function public.guest_pin_attempts_exhausted(
    fingerprint text,
    max_attempts integer default 10,
    window_minutes integer default 15
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select count(*) >= max_attempts
    from public.guest_pin_attempts a
    where a.fingerprint_hash = fingerprint
      and not a.succeeded
      and a.attempted_at > now() - make_interval(mins => window_minutes)
$$;

/**
 * verify_guest_pin — resolve a live 4-digit guest PIN to its tenant.
 *
 * Returns at most one row. The `access_codes_no_overlapping_duplicates`
 * exclusion constraint is what makes "at most one" a database guarantee
 * rather than an assumption, even during the two-week rollover overlap when
 * two distinct codes are live for the same resort.
 *
 * SECURITY DEFINER: callable by `anon`, because a guest has no auth.users row.
 * It reads only the columns needed to mint a scoped session and never exposes
 * the code table itself.
 *
 * `client_fingerprint` is a SHA-256 of the caller's IP + user agent, computed
 * by the API route. When supplied, attempts are budgeted and logged; a
 * fingerprint over budget is refused without evaluating the PIN at all.
 */
create or replace function public.verify_guest_pin(
    input_pin text,
    client_fingerprint text default null
)
returns table (
    tenant_id     uuid,
    tenant_slug   varchar(255),
    tenant_name   varchar(255),
    code_id       uuid,
    valid_until   timestamptz
)
language plpgsql
-- VOLATILE (the default): this function records the attempt, and Postgres
-- forbids writes from a STABLE function.
security definer
set search_path = ''
as $$
declare
    normalized text := btrim(coalesce(input_pin, ''));
    m_tenant_id   uuid;
    m_slug        varchar(255);
    m_name        varchar(255);
    m_code_id     uuid;
    m_valid_until timestamptz;
    hit           boolean := false;
begin
    -- Shape check first: a malformed PIN never reaches the index.
    if normalized !~ '^[0-9]{4}$' then
        return;
    end if;

    if client_fingerprint is not null
       and public.guest_pin_attempts_exhausted(client_fingerprint) then
        raise exception 'Too many PIN attempts. Try again later.'
            using errcode = '54000';
    end if;

    select t.id, t.slug, t.name, c.id, c.valid_until
      into m_tenant_id, m_slug, m_name, m_code_id, m_valid_until
      from public.tenant_access_codes c
      join public.tenants t on t.id = c.tenant_id
     where c.code = normalized
       and c.revoked_at is null
       and c.valid_from <= now()
       and c.valid_until >= now()
       and t.is_active
       -- A lapsed subscription must not keep serving guest experiences.
       and t.subscription_status in ('trial', 'active', 'past_due')
     limit 1;

    hit := found;

    if client_fingerprint is not null then
        insert into public.guest_pin_attempts (fingerprint_hash, succeeded)
        values (client_fingerprint, hit);
    end if;

    if not hit then
        return;
    end if;

    return query select m_tenant_id, m_slug, m_name, m_code_id, m_valid_until;
end;
$$;

/**
 * verify_lobby_code — resolve a permanent kiosk code to its tenant.
 *
 * Case-insensitive, matching `idx_tenants_lobby_code`. Lobby codes do not
 * expire, so there is no validity window to evaluate; they are only
 * invalidated by an admin rotation.
 */
create or replace function public.verify_lobby_code(input_code text)
returns table (
    tenant_id   uuid,
    tenant_slug varchar(255),
    tenant_name varchar(255)
)
language sql
stable
security definer
set search_path = ''
as $$
    select t.id, t.slug, t.name
    from public.tenants t
    where upper(btrim(coalesce(input_code, ''))) = upper(t.master_lobby_code)
      and t.is_active
      and t.subscription_status in ('trial', 'active', 'past_due')
    limit 1
$$;

revoke all on function public.verify_guest_pin(text, text) from public;
revoke all on function public.verify_lobby_code(text) from public;
revoke all on function public.guest_pin_attempts_exhausted(text, integer, integer) from public;
grant execute on function public.verify_guest_pin(text, text) to anon, authenticated;
grant execute on function public.verify_lobby_code(text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 16. ACCESS CODE ROTATION SUPPORT
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * allocate_guest_pin — pick 4 digits free for a given validity window.
 *
 * Random probe rather than sequential scan, so issued PINs are not guessable
 * from a neighbouring resort's code. Falls back to a deterministic sweep of
 * the whole keyspace if random probing keeps colliding, which makes
 * exhaustion an explicit error instead of an infinite loop.
 */
create or replace function public.allocate_guest_pin(
    window_from timestamptz,
    window_until timestamptz
)
returns varchar(4)
language plpgsql
security definer
set search_path = ''
as $$
declare
    candidate text;
    taken     boolean;
begin
    for attempt in 1..200 loop
        candidate := lpad((floor(random() * 10000))::int::text, 4, '0');

        select exists (
            select 1 from public.tenant_access_codes c
            where c.code = candidate
              and c.revoked_at is null
              and tstzrange(c.valid_from, c.valid_until)
                  && tstzrange(window_from, window_until)
        ) into taken;

        if not taken then
            return candidate::varchar(4);
        end if;
    end loop;

    -- Random probing is exhausted; sweep deterministically before giving up.
    for probe in 0..9999 loop
        candidate := lpad(probe::text, 4, '0');

        select exists (
            select 1 from public.tenant_access_codes c
            where c.code = candidate
              and c.revoked_at is null
              and tstzrange(c.valid_from, c.valid_until)
                  && tstzrange(window_from, window_until)
        ) into taken;

        if not taken then
            return candidate::varchar(4);
        end if;
    end loop;

    raise exception
        'Guest PIN keyspace exhausted for window % .. %. The 4-digit format cannot serve this many concurrent tenants.',
        window_from, window_until
        using errcode = '53400';
end;
$$;

/**
 * rotate_tenant_access_code — issue the next code in a tenant's cycle.
 *
 * Idempotent on (tenant_id, cycle_index): a retried cron run returns the
 * existing row instead of minting a duplicate. The caller computes the window
 * with `lib/pin-engine.ts`, keeping one source of truth for the arithmetic.
 */
create or replace function public.rotate_tenant_access_code(
    target_tenant uuid,
    target_cycle integer,
    window_from timestamptz,
    window_until timestamptz,
    actor uuid default null
)
returns public.tenant_access_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing public.tenant_access_codes;
    issued   public.tenant_access_codes;
    pin      varchar(4);
begin
    if window_until <= window_from then
        raise exception 'Validity window must end after it starts'
            using errcode = '22023';
    end if;

    select * into existing
      from public.tenant_access_codes c
     where c.tenant_id = target_tenant
       and c.cycle_index = target_cycle;

    if found then
        return existing;
    end if;

    pin := public.allocate_guest_pin(window_from, window_until);

    insert into public.tenant_access_codes
        (tenant_id, code, valid_from, valid_until, cycle_index, created_by)
    values
        (target_tenant, pin, window_from, window_until, target_cycle, actor)
    returning * into issued;

    return issued;
end;
$$;

-- Rotation is a platform operation: only the service role (cron / admin API)
-- and a super admin may mint codes.
revoke all on function public.allocate_guest_pin(timestamptz, timestamptz) from public;
revoke all on function public.rotate_tenant_access_code(uuid, integer, timestamptz, timestamptz, uuid) from public;
grant execute on function public.allocate_guest_pin(timestamptz, timestamptz) to service_role;
grant execute on function public.rotate_tenant_access_code(uuid, integer, timestamptz, timestamptz, uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 17. SENSOR TELEMETRY APPLY (ATOMIC INGEST TAIL)
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * apply_sensor_telemetry — commit one ingest in a single round trip.
 *
 * Updates fleet health, optionally records a detection, and enqueues ML work
 * atomically. Doing this in one statement keeps a global fleet of balises on
 * weak links from holding several connections open per upload, and prevents a
 * half-applied ingest (health bumped, detection missing).
 */
create or replace function public.apply_sensor_telemetry(
    target_sensor uuid,
    pinged_at timestamptz,
    battery integer default null,
    voltage numeric default null,
    solar_mv integer default null,
    rssi_dbm integer default null,
    firmware text default null,
    audio_object_path text default null,
    audio_codec text default null,
    audio_duration_ms integer default null,
    audio_sample_rate integer default null,
    species text default null,
    species_latin text default null,
    confidence double precision default null,
    model text default null,
    clip_url text default null,
    spectrogram text default null
)
returns table (detection_id uuid, job_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
    sensor          public.sensors_balises;
    new_detection   uuid;
    new_job         uuid;
    resolved_species uuid;
    next_status     varchar(20);
begin
    select * into sensor
      from public.sensors_balises s
     where s.id = target_sensor
     for update;

    if not found then
        raise exception 'Unknown sensor %', target_sensor using errcode = 'no_data_found';
    end if;

    -- A unit that reports is by definition reachable. Low battery or a weak
    -- radio downgrades it to 'degraded' rather than clearing an operator's
    -- 'retired' decision.
    next_status := case
        when sensor.status = 'retired' then 'retired'
        when coalesce(battery, sensor.battery_level, 100) < 20 then 'degraded'
        when coalesce(rssi_dbm, sensor.signal_rssi_dbm, -70) <= -110 then 'degraded'
        else 'active'
    end;

    update public.sensors_balises s
       set last_ping        = greatest(pinged_at, coalesce(s.last_ping, pinged_at)),
           battery_level    = coalesce(battery, s.battery_level),
           battery_voltage  = coalesce(voltage, s.battery_voltage),
           solar_input_mv   = coalesce(solar_mv, s.solar_input_mv),
           signal_rssi_dbm  = coalesce(rssi_dbm, s.signal_rssi_dbm),
           firmware_version = coalesce(firmware, s.firmware_version),
           status           = next_status
     where s.id = target_sensor;

    if species is not null and confidence is not null and clip_url is not null then
        select sp.id into resolved_species
          from public.species_profiles sp
         where species_latin is not null
           and lower(sp.latin_name) = lower(species_latin)
         limit 1;

        insert into public.audio_detections (
            sensor_id, tenant_id, species_id, species_name, latin_name,
            confidence_score, model_version, audio_clip_url, spectrogram_url,
            clip_duration_ms, detected_at
        ) values (
            target_sensor, sensor.tenant_id, resolved_species, species, species_latin,
            confidence, model, clip_url, spectrogram,
            audio_duration_ms, pinged_at
        )
        returning id into new_detection;
    end if;

    if audio_object_path is not null and audio_codec is not null then
        insert into public.ml_inference_jobs (
            tenant_id, sensor_id, detection_id, audio_object_path,
            audio_codec, duration_ms, sample_rate_hz,
            -- An unclassified clip is the reason the queue exists, so it
            -- outranks a clip the edge model already labelled.
            priority
        ) values (
            sensor.tenant_id, target_sensor, new_detection, audio_object_path,
            audio_codec, audio_duration_ms, audio_sample_rate,
            case when new_detection is null then 3 else 6 end
        )
        returning id into new_job;
    end if;

    return query select new_detection, new_job;
end;
$$;

revoke all on function public.apply_sensor_telemetry(
    uuid, timestamptz, integer, numeric, integer, integer, text, text, text,
    integer, integer, text, text, double precision, text, text, text
) from public;
grant execute on function public.apply_sensor_telemetry(
    uuid, timestamptz, integer, numeric, integer, integer, text, text, text,
    integer, integer, text, text, double precision, text, text, text
) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 18. ML QUEUE WORKER CLAIM
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * claim_ml_jobs — lease a batch of queued clips to one worker.
 *
 * SKIP LOCKED lets N workers scale horizontally without contending on the same
 * head-of-queue row. Leases past `lock_expires_at` are reclaimed, so a worker
 * that dies mid-batch does not strand its jobs.
 */
create or replace function public.claim_ml_jobs(
    worker_id varchar(64),
    batch_size integer default 8,
    lease_seconds integer default 300
)
returns setof public.ml_inference_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- Reclaim expired leases in a separate statement. A data-modifying CTE is
    -- not visible to sibling CTEs in the same statement, so folding this into
    -- the claim below would silently skip the reclaimed rows.
    update public.ml_inference_jobs j
       set status = 'queued',
           locked_at = null,
           lock_expires_at = null,
           locked_by = null
     where j.status = 'processing'
       and j.lock_expires_at < now();

    return query
        with claimable as (
            select j.id
              from public.ml_inference_jobs j
             where j.status = 'queued'
             order by j.priority, j.enqueued_at
             limit greatest(1, batch_size)
             for update skip locked
        )
        update public.ml_inference_jobs j
           set status          = 'processing',
               attempts        = j.attempts + 1,
               locked_at       = now(),
               lock_expires_at = now() + make_interval(secs => lease_seconds),
               locked_by       = worker_id,
               started_at      = coalesce(j.started_at, now())
         where j.id in (select c.id from claimable c)
        returning j.*;
end;
$$;

revoke all on function public.claim_ml_jobs(varchar, integer, integer) from public;
grant execute on function public.claim_ml_jobs(varchar, integer, integer) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 19. AUDIO PIPELINE ANALYTICS
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * audio_confidence_histogram — bucketed model confidence over a time window.
 *
 * Aggregated in Postgres so /admin/analytics/audio never ships raw detection
 * rows to the browser to bin them client-side.
 */
create or replace function public.audio_confidence_histogram(
    since timestamptz,
    bucket_count integer default 10,
    target_tenant uuid default null
)
returns table (
    bucket_index integer,
    lower_bound  double precision,
    upper_bound  double precision,
    detections   bigint,
    confirmed    bigint,
    rejected     bigint
)
language sql
stable
security definer
set search_path = ''
as $$
    with bounds as (
        select greatest(1, least(50, bucket_count)) as n
    ),
    buckets as (
        select i::integer as bucket_index,
               (i - 1)::double precision / b.n as lower_bound,
               i::double precision / b.n       as upper_bound
          from bounds b, generate_series(1, b.n) as i
    ),
    scoped as (
        select d.confidence_score, d.review_state
          from public.audio_detections d
         where d.detected_at >= since
           and (target_tenant is null or d.tenant_id = target_tenant)
           and (
                public.is_super_admin()
                or public.is_tenant_member(d.tenant_id)
           )
    )
    select bk.bucket_index,
           bk.lower_bound,
           bk.upper_bound,
           count(s.confidence_score)                                        as detections,
           count(*) filter (where s.review_state = 'confirmed')             as confirmed,
           count(*) filter (where s.review_state = 'rejected')              as rejected
      from buckets bk
      left join scoped s
        on s.confidence_score >= bk.lower_bound
       and (s.confidence_score < bk.upper_bound
            or (bk.upper_bound = 1 and s.confidence_score = 1))
     group by bk.bucket_index, bk.lower_bound, bk.upper_bound
     order by bk.bucket_index;
$$;

/**
 * ingest_throughput — ingest volume and failure rate bucketed by hour.
 */
create or replace function public.ingest_throughput(
    since timestamptz,
    target_tenant uuid default null
)
returns table (
    hour        timestamptz,
    accepted    bigint,
    rejected    bigint,
    audio_bytes numeric
)
language sql
stable
security definer
set search_path = ''
as $$
    select date_trunc('hour', l.received_at) as hour,
           count(*) filter (where l.outcome = 'accepted')  as accepted,
           count(*) filter (where l.outcome <> 'accepted') as rejected,
           coalesce(sum(l.audio_bytes), 0)::numeric        as audio_bytes
      from public.telemetry_ingest_log l
     where l.received_at >= since
       and (target_tenant is null or l.tenant_id = target_tenant)
       and (
            public.is_super_admin()
            or (l.tenant_id is not null and public.is_tenant_member(l.tenant_id))
       )
     group by 1
     order by 1;
$$;

revoke all on function public.audio_confidence_histogram(timestamptz, integer, uuid) from public;
revoke all on function public.ingest_throughput(timestamptz, uuid) from public;
grant execute on function public.audio_confidence_histogram(timestamptz, integer, uuid) to authenticated;
grant execute on function public.ingest_throughput(timestamptz, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 19b. DASHBOARD ROLLUPS
-- ═══════════════════════════════════════════════════════════════════════════
-- PostgREST cannot express GROUP BY, so the aggregates the consoles need live
-- here rather than as N+1 queries from the app.
--
-- `security_invoker = true` is essential: without it a view runs with its
-- owner's rights and would hand every tenant's fleet to every caller. With it,
-- the underlying tables' RLS policies still apply to whoever selects.

create view public.tenant_fleet_overview with (security_invoker = true) as
select
    t.id                  as tenant_id,
    t.name                as tenant_name,
    t.slug                as tenant_slug,
    t.subscription_status,
    t.is_active,
    t.sensor_quota,
    t.created_at,
    count(s.id)                                              as sensors_total,
    count(s.id) filter (where s.status = 'active')           as sensors_active,
    count(s.id) filter (where s.status = 'degraded')         as sensors_degraded,
    count(s.id) filter (where s.status = 'offline')          as sensors_offline,
    count(s.id) filter (where s.status = 'provisioning')     as sensors_provisioning,
    avg(s.battery_level)                                     as battery_avg,
    min(s.battery_level)                                     as battery_min,
    max(s.last_ping)                                         as last_ping
from public.tenants t
left join public.sensors_balises s
       on s.tenant_id = t.id
      and s.status <> 'retired'
group by t.id;

comment on view public.tenant_fleet_overview is
    'Per-tenant fleet health. security_invoker keeps each caller inside their own RLS scope.';

create view public.tenant_detection_rollup with (security_invoker = true) as
select
    d.tenant_id,
    count(*) filter (where d.detected_at > now() - interval '24 hours') as detections_24h,
    count(*) filter (where d.detected_at > now() - interval '7 days')   as detections_7d,
    count(distinct d.species_name)
        filter (where d.detected_at > now() - interval '30 days')       as species_30d,
    avg(d.confidence_score)
        filter (where d.detected_at > now() - interval '7 days')        as confidence_avg_7d,
    count(*) filter (where d.review_state = 'unreviewed')               as awaiting_review,
    max(d.detected_at)                                                  as last_detection_at
from public.audio_detections d
group by d.tenant_id;

grant select on public.tenant_fleet_overview to authenticated;
grant select on public.tenant_detection_rollup to authenticated;

/**
 * audio_pipeline_summary — headline figures for /admin/analytics/audio.
 *
 * One row, one round trip. Returned as a set so PostgREST exposes it as an
 * RPC with a uniform shape.
 */
create or replace function public.audio_pipeline_summary(
    since timestamptz,
    target_tenant uuid default null
)
returns table (
    detections_total     bigint,
    detections_reviewed  bigint,
    detections_confirmed bigint,
    detections_rejected  bigint,
    confidence_avg       double precision,
    confidence_p50       double precision,
    confidence_p95       double precision,
    high_confidence_share double precision,
    distinct_species     bigint,
    audio_minutes        double precision,
    jobs_queued          bigint,
    jobs_processing      bigint,
    jobs_failed          bigint,
    ingest_accepted      bigint,
    ingest_rejected      bigint,
    ingest_bytes         numeric
)
language sql
stable
security definer
set search_path = ''
as $$
    with scoped_detections as (
        select d.*
          from public.audio_detections d
         where d.detected_at >= since
           and (target_tenant is null or d.tenant_id = target_tenant)
           and (public.is_super_admin() or public.is_tenant_member(d.tenant_id))
    ),
    scoped_jobs as (
        select j.*
          from public.ml_inference_jobs j
         where j.enqueued_at >= since
           and (target_tenant is null or j.tenant_id = target_tenant)
           and (public.is_super_admin() or public.is_tenant_member(j.tenant_id))
    ),
    scoped_ingest as (
        select l.*
          from public.telemetry_ingest_log l
         where l.received_at >= since
           and (target_tenant is null or l.tenant_id = target_tenant)
           and (
                public.is_super_admin()
                or (l.tenant_id is not null and public.is_tenant_member(l.tenant_id))
           )
    )
    select
        (select count(*) from scoped_detections),
        (select count(*) from scoped_detections where review_state <> 'unreviewed'),
        (select count(*) from scoped_detections where review_state = 'confirmed'),
        (select count(*) from scoped_detections where review_state = 'rejected'),
        (select avg(confidence_score) from scoped_detections),
        (select percentile_cont(0.5) within group (order by confidence_score)
           from scoped_detections),
        (select percentile_cont(0.95) within group (order by confidence_score)
           from scoped_detections),
        -- Share of calls the model was confident enough about to surface to a
        -- guest without human review.
        (select case when count(*) = 0 then null
                     else count(*) filter (where confidence_score >= 0.85)::double precision
                          / count(*)
                end
           from scoped_detections),
        (select count(distinct species_name) from scoped_detections),
        (select coalesce(sum(clip_duration_ms), 0)::double precision / 60000
           from scoped_detections),
        (select count(*) from scoped_jobs where status = 'queued'),
        (select count(*) from scoped_jobs where status = 'processing'),
        (select count(*) from scoped_jobs where status in ('failed', 'dead_letter')),
        (select count(*) from scoped_ingest where outcome = 'accepted'),
        (select count(*) from scoped_ingest where outcome <> 'accepted'),
        (select coalesce(sum(audio_bytes), 0)::numeric from scoped_ingest);
$$;

revoke all on function public.audio_pipeline_summary(timestamptz, uuid) from public;
grant execute on function public.audio_pipeline_summary(timestamptz, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 20. STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════════════════════════
-- All private. Guests and kiosks receive short-lived signed URLs minted
-- server-side; no bucket is ever publicly listable.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('audio-vault', 'audio-vault', false, 26214400,
     array['audio/opus', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/flac', 'audio/wav']),
    ('spectrograms', 'spectrograms', false, 5242880,
     array['image/png', 'image/webp', 'image/jpeg']),
    ('twin-assets', 'twin-assets', false, 524288000,
     array['model/gltf-binary', 'model/gltf+json', 'application/octet-stream', 'image/png'])
on conflict (id) do nothing;

-- Staff may read their own resort's objects. Object paths are laid out as
-- `<tenant_id>/…`, so the first path segment is the tenant claim. The regex
-- guard matters: casting a non-UUID first segment would raise instead of
-- simply denying, turning a stray upload into a 500 for every reader.
create policy storage_staff_read_tenant_objects on storage.objects
    for select to authenticated
    using (
        bucket_id in ('audio-vault', 'spectrograms', 'twin-assets')
        and (
            public.is_super_admin()
            or (
                (storage.foldername(name))[1] ~*
                    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
            )
        )
    );

create policy storage_super_admin_write on storage.objects
    for all to authenticated
    using (
        bucket_id in ('audio-vault', 'spectrograms', 'twin-assets')
        and public.is_super_admin()
    )
    with check (
        bucket_id in ('audio-vault', 'spectrograms', 'twin-assets')
        and public.is_super_admin()
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 21. SUPER ADMIN BOOTSTRAP
-- ═══════════════════════════════════════════════════════════════════════════
-- The platform operator signs up through Supabase Auth like anyone else; this
-- trigger promotes the single known operator address on first insert. Every
-- other signup lands as an inactive csr_analyst awaiting tenant assignment,
-- so a stray signup can never read resort data.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    operator_email constant text := 'brieuc@ecodatalink.com';
begin
    if lower(new.email) = operator_email then
        insert into public.profiles (id, email, full_name, role, tenant_id, is_active)
        values (new.id, new.email,
                coalesce(new.raw_user_meta_data->>'full_name', 'Platform Operator'),
                'super_admin', null, true)
        on conflict (id) do nothing;
    else
        insert into public.profiles (id, email, full_name, role, tenant_id, is_active)
        values (new.id, new.email,
                new.raw_user_meta_data->>'full_name',
                'csr_analyst',
                (new.raw_user_meta_data->>'tenant_id')::uuid,
                false)
        on conflict (id) do nothing;
    end if;

    return new;
end;
$$;

create trigger trg_on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_auth_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- 22. GRANTS
-- ═══════════════════════════════════════════════════════════════════════════
-- Table-level grants are permissive; RLS above is the actual boundary.

grant usage on schema public to anon, authenticated;

grant select on public.tenants, public.profiles, public.sensors_balises,
               public.tenant_access_codes, public.species_profiles,
               public.audio_detections, public.telemetry_ingest_log,
               public.ml_inference_jobs, public.map_3d_assets,
               public.lobby_display_settings
    to authenticated;

grant insert, update, delete on public.tenants, public.profiles,
               public.sensors_balises, public.tenant_access_codes,
               public.species_profiles, public.audio_detections,
               public.ml_inference_jobs, public.map_3d_assets,
               public.lobby_display_settings
    to authenticated;

-- `anon` reaches nothing directly. Guest and kiosk access flows exclusively
-- through the SECURITY DEFINER RPCs granted in section 15.
