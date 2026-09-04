-- ═══════════════════════════════════════════════════════════════════════════
-- ON-NETWORK ACCESS (windows + remote passes)
-- ═══════════════════════════════════════════════════════════════════════════
-- Guest (/client) and lobby (/lobby) admit without a code when the caller is
-- on a prefix the resort has registered. Off-network access still works via a
-- PIN, a lobby code, or a time-limited remote pass — never indefinitely.

drop trigger if exists trg_tenants_guard_trusted_cidrs on public.tenants;

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'tenants'
          and column_name = 'trusted_cidrs'
    ) and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'tenants'
          and column_name = 'network_cidrs'
    ) then
        alter table public.tenants rename column trusted_cidrs to network_cidrs;
    end if;
end $$;

alter table public.tenants
    add column if not exists network_cidrs cidr[] not null default '{}',
    add column if not exists on_network_hours integer not null default 12,
    add column if not exists remote_session_hours integer not null default 4;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'tenants_on_network_hours_range'
    ) then
        alter table public.tenants
            add constraint tenants_on_network_hours_range
            check (on_network_hours between 1 and 24);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'tenants_remote_session_hours_range'
    ) then
        alter table public.tenants
            add constraint tenants_remote_session_hours_range
            check (remote_session_hours between 1 and 12);
    end if;
end $$;

create or replace function public.guard_network_cidrs()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
    network cidr;
begin
    if new.network_cidrs is null then
        new.network_cidrs := '{}'::cidr[];
    end if;

    if cardinality(new.network_cidrs) > 16 then
        raise exception 'A resort may list at most 16 network prefixes'
            using errcode = 'check_violation';
    end if;

    foreach network in array new.network_cidrs
    loop
        if network = '0.0.0.0/0'::cidr or network = '::/0'::cidr then
            raise exception '0.0.0.0/0 and ::/0 cannot be registered'
                using errcode = 'check_violation';
        end if;
        if family(network) = 4 and masklen(network) < 8 then
            raise exception 'IPv4 prefixes must be /8 or narrower'
                using errcode = 'check_violation';
        end if;
        if family(network) = 6 and masklen(network) < 32 then
            raise exception 'IPv6 prefixes must be /32 or narrower'
                using errcode = 'check_violation';
        end if;
    end loop;

    return new;
end;
$$;

drop trigger if exists trg_tenants_guard_network_cidrs on public.tenants;
create trigger trg_tenants_guard_network_cidrs
    before insert or update of network_cidrs on public.tenants
    for each row execute function public.guard_network_cidrs();

drop function if exists public.guard_trusted_cidrs();

drop function if exists public.match_tenant_by_ip(text);

create function public.match_tenant_by_ip(client_ip text)
returns table (
    tenant_id uuid,
    tenant_slug varchar,
    tenant_name varchar,
    network_cidrs cidr[],
    on_network_hours integer,
    remote_session_hours integer,
    match_prefix integer
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
    parsed inet;
begin
    begin
        parsed := client_ip::inet;
    exception when others then
        return;
    end;

    return query
    select
        t.id,
        t.slug,
        t.name,
        t.network_cidrs,
        t.on_network_hours,
        t.remote_session_hours,
        (
            select max(masklen(network))
            from unnest(t.network_cidrs) as network
            where parsed <<= network
        ) as match_prefix
    from public.tenants t
    where t.is_active
      and t.subscription_status in ('trial', 'active', 'past_due')
      and cardinality(t.network_cidrs) > 0
      and exists (
          select 1
          from unnest(t.network_cidrs) as network
          where parsed <<= network
      )
    order by match_prefix desc, t.created_at asc
    limit 2;
end;
$$;

revoke all on function public.match_tenant_by_ip(text) from public;
grant execute on function public.match_tenant_by_ip(text) to anon, authenticated, service_role;

comment on column public.tenants.network_cidrs is
    'Prefixes from which guest and lobby views admit without a code. Usually the resort''s public NAT. If two tenants share a prefix, auto-admit is disabled for that prefix.';

comment on column public.tenants.on_network_hours is
    'Cookie lifetime while the device stays on a registered prefix. Renewed in place so a kiosk on hotel Wi-Fi does not drop overnight; leaving the network invalidates the session on the next request.';

comment on column public.tenants.remote_session_hours is
    'Hard lifetime for PIN, lobby-code and remote-pass sessions opened off the hotel network. Not renewed.';

-- Local demo hotel: private ranges so a laptop on the LAN reaches /client and
-- /lobby without a code. A second tenant on the same LAN would make these
-- prefixes ambiguous and auto-admit would stop — which is the intended guard.
update public.tenants
set network_cidrs = array[
    '127.0.0.0/8',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
]::cidr[]
where slug = 'domaine-lagon-vert'
  and coalesce(cardinality(network_cidrs), 0) = 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- REMOTE ACCESS PASSES
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.remote_access_passes (
    id           uuid primary key default uuid_generate_v4(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    tier         varchar(8) not null check (tier in ('guest', 'lobby')),
    token_hash   text not null unique,
    label        text,
    expires_at   timestamptz not null,
    revoked_at   timestamptz,
    created_by   uuid references public.profiles(id) on delete set null,
    created_at   timestamptz not null default now(),
    last_used_at timestamptz,

    constraint remote_access_passes_future check (expires_at > created_at)
);

create index if not exists idx_remote_passes_tenant
    on public.remote_access_passes (tenant_id, expires_at desc);

create index if not exists idx_remote_passes_live
    on public.remote_access_passes (token_hash)
    where revoked_at is null;

comment on table public.remote_access_passes is
    'Hotel-issued, time-limited links for off-site guest or kiosk access. The raw token is shown once; only a hash is stored.';

alter table public.remote_access_passes enable row level security;

drop policy if exists remote_passes_super_admin_all on public.remote_access_passes;
create policy remote_passes_super_admin_all on public.remote_access_passes
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

drop policy if exists remote_passes_staff_read_own on public.remote_access_passes;
create policy remote_passes_staff_read_own on public.remote_access_passes
    for select to authenticated
    using (public.is_tenant_member(tenant_id));

drop policy if exists remote_passes_manager_write_own on public.remote_access_passes;
create policy remote_passes_manager_write_own on public.remote_access_passes
    for all to authenticated
    using (public.can_manage_tenant(tenant_id))
    with check (public.can_manage_tenant(tenant_id));
