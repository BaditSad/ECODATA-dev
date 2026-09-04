-- ═══════════════════════════════════════════════════════════════════════════
-- ERP FOUNDATION
-- ═══════════════════════════════════════════════════════════════════════════
-- The platform console grows from a single-operator estate view into an ERP:
-- domains, contracts, invoices, accounting and support, each an autonomous
-- module. Two things have to exist before any of those modules can:
--
--   1. Platform staff who are not the owner. Until now every non-tenant
--      identity was the super admin, so the profile table had no shape for a
--      bookkeeper or a support agent.
--   2. Per-module authorisation. A support agent must reach the support tab
--      and nothing else, and that has to hold at the database boundary — a
--      hidden nav item is not access control.
--
-- ── Why the access module is not grantable ─────────────────────────────────
-- Whoever administers ERP accounts can grant themselves any module, so a
-- grantable `access` module would collapse the whole matrix to a formality.
-- It is reserved to the owner instead, which removes the escalation path
-- rather than guarding it.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PLATFORM STAFF ROLE
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
    check (role in ('super_admin', 'platform_staff', 'resort_manager', 'csr_analyst'));

-- Platform roles are estate-wide and must not be pinned to a resort; resort
-- roles must be.
alter table public.profiles drop constraint profiles_tenant_scope_matches_role;
alter table public.profiles add constraint profiles_tenant_scope_matches_role check (
    (role in ('super_admin', 'platform_staff') and tenant_id is null)
    or (role in ('resort_manager', 'csr_analyst') and tenant_id is not null)
);

comment on column public.profiles.role is
    'super_admin owns the platform; platform_staff work in the ERP under per-module grants; resort roles are tenant-scoped.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. PER-MODULE GRANTS
-- ═══════════════════════════════════════════════════════════════════════════
-- One row per (account, module). A missing row means no access, so a new
-- account starts able to sign in and see nothing.

create table public.erp_module_access (
    profile_id uuid not null references public.profiles(id) on delete cascade,
    module_key varchar(32) not null,
    access     varchar(8) not null default 'read'
        check (access in ('read', 'write')),

    granted_by uuid references public.profiles(id) on delete set null,
    granted_at timestamptz not null default now(),

    primary key (profile_id, module_key),

    -- Mirrors the module registry in `src/modules/registry.ts`. Adding a
    -- module is a code change either way, so pinning the list here costs
    -- nothing and stops a typo from silently granting nothing.
    constraint erp_module_access_known_module check (
        module_key in (
            'overview', 'domains', 'contracts', 'invoices',
            'accounting', 'support', 'audio'
        )
    )
);

create index idx_erp_module_access_profile on public.erp_module_access (profile_id);

comment on table public.erp_module_access is
    'Which ERP modules an account may open, and whether it may write there. The owner bypasses this table; `access` is deliberately not grantable.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. AUTHORISATION HELPERS
-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER so policies on profiles can call them without recursing
-- through profiles' own RLS, matching the existing helpers.

create or replace function public.is_platform_member()
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
          and p.role in ('super_admin', 'platform_staff')
    )
$$;

/**
 * Effective access level for one module: 'none', 'read' or 'write'.
 *
 * The owner is unconditional. Everyone else is exactly what the grant table
 * says, and only while their profile is active — deactivating an account
 * revokes every module at once without touching its grants, so reinstating
 * someone restores what they had.
 */
create or replace function public.erp_access(target_module text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select case
        when public.is_super_admin() then 'write'
        else coalesce((
            select a.access
              from public.erp_module_access a
              join public.profiles p on p.id = a.profile_id
             where a.profile_id = auth.uid()
               and a.module_key = target_module
               and p.is_active
               and p.role = 'platform_staff'
        ), 'none')
    end
$$;

create or replace function public.erp_can(
    target_module text,
    needed text default 'read'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select case
        when needed = 'write' then public.erp_access(target_module) = 'write'
        else public.erp_access(target_module) in ('read', 'write')
    end
$$;

revoke all on function public.is_platform_member() from public;
revoke all on function public.erp_access(text) from public;
revoke all on function public.erp_can(text, text) from public;
grant execute on function public.is_platform_member() to authenticated;
grant execute on function public.erp_access(text) to authenticated;
grant execute on function public.erp_can(text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. GRANT TABLE POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.erp_module_access enable row level security;

-- Only the owner writes grants; an account may read its own to render its nav.
create policy erp_access_owner_all on public.erp_module_access
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

create policy erp_access_read_self on public.erp_module_access
    for select to authenticated
    using (profile_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. MODULE-SCOPED READS ACROSS THE ESTATE
-- ═══════════════════════════════════════════════════════════════════════════
-- The existing policies grant the estate to the owner and a single resort to
-- its staff. Platform staff sit between the two: the whole estate, but only
-- through the modules they hold.
--
-- The fleet and detection views are `security_invoker`, so they inherit these
-- policies rather than needing their own.

-- ── Domains module ─────────────────────────────────────────────────────────
create policy tenants_platform_domains on public.tenants
    for select to authenticated
    using (public.erp_can('domains'));

create policy tenants_platform_domains_write on public.tenants
    for all to authenticated
    using (public.erp_can('domains', 'write'))
    with check (public.erp_can('domains', 'write'));

create policy sensors_platform_domains on public.sensors_balises
    for select to authenticated
    using (public.erp_can('domains'));

create policy sensors_platform_domains_write on public.sensors_balises
    for all to authenticated
    using (public.erp_can('domains', 'write'))
    with check (public.erp_can('domains', 'write'));

-- Codes stay read-only outside the rotation engine, exactly as they are for
-- resort staff: the overlap guarantee has a single writer.
create policy access_codes_platform_domains on public.tenant_access_codes
    for select to authenticated
    using (public.erp_can('domains'));

create policy map_assets_platform_domains on public.map_3d_assets
    for select to authenticated
    using (public.erp_can('domains'));

create policy map_assets_platform_domains_write on public.map_3d_assets
    for all to authenticated
    using (public.erp_can('domains', 'write'))
    with check (public.erp_can('domains', 'write'));

create policy lobby_settings_platform_domains on public.lobby_display_settings
    for select to authenticated
    using (public.erp_can('domains'));

-- ── Overview module ────────────────────────────────────────────────────────
-- The dashboard reads the same fleet view as Domains; holding either is enough.
create policy tenants_platform_overview on public.tenants
    for select to authenticated
    using (public.erp_can('overview'));

create policy sensors_platform_overview on public.sensors_balises
    for select to authenticated
    using (public.erp_can('overview'));

-- ── Audio module ───────────────────────────────────────────────────────────
create policy detections_platform_audio on public.audio_detections
    for select to authenticated
    using (public.erp_can('audio'));

create policy detections_platform_audio_write on public.audio_detections
    for all to authenticated
    using (public.erp_can('audio', 'write'))
    with check (public.erp_can('audio', 'write'));

create policy ml_jobs_platform_audio on public.ml_inference_jobs
    for select to authenticated
    using (public.erp_can('audio'));

create policy ingest_log_platform_audio on public.telemetry_ingest_log
    for select to authenticated
    using (public.erp_can('audio'));

-- The overview and domains modules both surface detection counts.
create policy detections_platform_estate on public.audio_detections
    for select to authenticated
    using (public.erp_can('overview') or public.erp_can('domains'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RESORT LIFECYCLE
-- ═══════════════════════════════════════════════════════════════════════════
-- Suspension is reversible and has to be explainable months later, so the
-- reason and the moment are recorded rather than inferred from
-- `subscription_status` alone.

alter table public.tenants
    add column suspended_at      timestamptz,
    add column suspension_reason text;

comment on column public.tenants.suspended_at is
    'Set when the resort is suspended. Guest PINs and lobby codes stop resolving while non-null.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. SIGNUP TRIGGER
-- ═══════════════════════════════════════════════════════════════════════════
-- The original trigger inserted every non-owner signup as a `csr_analyst`
-- carrying whatever tenant id the metadata held. With no tenant id that
-- violates the role/tenant constraint and takes the auth insert down with it,
-- which made creating an ERP account impossible. A tenant-less signup now
-- lands as inactive platform staff with no module grants: it can authenticate
-- and read nothing until the owner says otherwise.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    operator_email constant text := 'brieuc@ecodatalink.com';
    claimed_tenant uuid := (new.raw_user_meta_data->>'tenant_id')::uuid;
begin
    if lower(new.email) = operator_email then
        insert into public.profiles (id, email, full_name, role, tenant_id, is_active)
        values (new.id, new.email,
                coalesce(new.raw_user_meta_data->>'full_name', 'Platform Operator'),
                'super_admin', null, true)
        on conflict (id) do nothing;

    elsif claimed_tenant is not null then
        insert into public.profiles (id, email, full_name, role, tenant_id, is_active)
        values (new.id, new.email,
                new.raw_user_meta_data->>'full_name',
                'csr_analyst', claimed_tenant, false)
        on conflict (id) do nothing;

    else
        insert into public.profiles (id, email, full_name, role, tenant_id, is_active)
        values (new.id, new.email,
                new.raw_user_meta_data->>'full_name',
                'platform_staff', null, false)
        on conflict (id) do nothing;
    end if;

    return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. GRANTS
-- ═══════════════════════════════════════════════════════════════════════════

grant select on public.erp_module_access to authenticated;
grant insert, update, delete on public.erp_module_access to authenticated;
