-- ═══════════════════════════════════════════════════════════════════════════
-- WORK TICKETS + HOTEL INCIDENTS
-- ═══════════════════════════════════════════════════════════════════════════
-- Replaces the single Support module. Internal work (IT / commerce /
-- marketing) and hotel-raised incidents are different queues, different
-- grants, different writers. Hotel staff open incidents from the portal;
-- platform staff assign, prioritise and close them.

-- ── 1. Module registry ─────────────────────────────────────────────────────
-- Widen the grant constraint before inserting the new keys, then drop the
-- old `support` grants once they have been copied.

alter table public.erp_module_access
    drop constraint erp_module_access_known_module;

insert into public.erp_module_access (profile_id, module_key, access, granted_by, granted_at)
select profile_id, 'tickets', access, granted_by, granted_at
  from public.erp_module_access
 where module_key = 'support'
on conflict (profile_id, module_key) do nothing;

insert into public.erp_module_access (profile_id, module_key, access, granted_by, granted_at)
select profile_id, 'incidents', access, granted_by, granted_at
  from public.erp_module_access
 where module_key = 'support'
on conflict (profile_id, module_key) do nothing;

delete from public.erp_module_access where module_key = 'support';

alter table public.erp_module_access
    add constraint erp_module_access_known_module check (
        module_key in (
            'overview', 'domains', 'contracts', 'invoices',
            'accounting', 'tickets', 'incidents', 'audio'
        )
    );

-- ── 2. Internal work tickets ───────────────────────────────────────────────

create table public.work_tickets (
    id              uuid primary key default uuid_generate_v4(),

    department      varchar(16) not null
        check (department in ('it', 'commerce', 'marketing')),
    title           varchar(200) not null,
    description     text not null,

    status          varchar(16) not null default 'open'
        check (status in ('open', 'in_progress', 'resolved', 'closed')),
    priority        varchar(16) not null default 'normal'
        check (priority in ('low', 'normal', 'high', 'urgent')),

    assigned_to     uuid references public.profiles(id) on delete set null,
    created_by      uuid references public.profiles(id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index idx_work_tickets_queue
    on public.work_tickets (department, status, priority, created_at desc);

create trigger trg_work_tickets_touch before update on public.work_tickets
    for each row execute function public.touch_updated_at();

comment on table public.work_tickets is
    'Internal platform tasks. Colour-coded by department; not visible to resorts.';

-- ── 3. Hotel incidents ─────────────────────────────────────────────────────

create table public.hotel_incidents (
    id              uuid primary key default uuid_generate_v4(),
    tenant_id       uuid not null references public.tenants(id) on delete cascade,

    title           varchar(200) not null,
    description     text not null,

    status          varchar(16) not null default 'open'
        check (status in ('open', 'in_progress', 'resolved', 'closed')),
    priority        varchar(16) not null default 'normal'
        check (priority in ('low', 'normal', 'high', 'urgent')),

    assigned_to     uuid references public.profiles(id) on delete set null,
    created_by      uuid references public.profiles(id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index idx_hotel_incidents_queue
    on public.hotel_incidents (status, priority, created_at desc);

create index idx_hotel_incidents_tenant
    on public.hotel_incidents (tenant_id, created_at desc);

create trigger trg_hotel_incidents_touch before update on public.hotel_incidents
    for each row execute function public.touch_updated_at();

comment on table public.hotel_incidents is
    'Incidents raised by a resort. Hotel staff open them; platform staff assign and close them.';

-- Carry over anything that lived in the old support queue.
insert into public.hotel_incidents (
    id, tenant_id, title, description, status, priority,
    assigned_to, created_by, created_at, updated_at
)
select
    id,
    tenant_id,
    subject,
    body,
    case when status = 'pending' then 'in_progress' else status end,
    priority,
    assigned_to,
    created_by,
    created_at,
    updated_at
from public.support_tickets;

-- ── 4. Drop the old support surface ────────────────────────────────────────

drop policy if exists tickets_read on public.support_tickets;
drop policy if exists tickets_write on public.support_tickets;
drop policy if exists messages_read on public.support_messages;
drop policy if exists messages_write on public.support_messages;
drop policy if exists profiles_platform_support on public.profiles;

drop table if exists public.support_messages;
drop table if exists public.support_tickets;

-- ── 5. RLS ─────────────────────────────────────────────────────────────────

alter table public.work_tickets     enable row level security;
alter table public.hotel_incidents  enable row level security;

create policy work_tickets_read on public.work_tickets
    for select to authenticated
    using (public.erp_can('tickets') or public.erp_can('overview'));

create policy work_tickets_write on public.work_tickets
    for all to authenticated
    using (public.erp_can('tickets', 'write'))
    with check (public.erp_can('tickets', 'write'));

create policy hotel_incidents_platform_read on public.hotel_incidents
    for select to authenticated
    using (
        public.erp_can('incidents')
        or public.erp_can('overview')
        or public.is_tenant_member(tenant_id)
    );

create policy hotel_incidents_platform_write on public.hotel_incidents
    for all to authenticated
    using (public.erp_can('incidents', 'write'))
    with check (public.erp_can('incidents', 'write'));

-- Resort staff may open and follow incidents for their own hotel. They do not
-- assign platform accounts or close the ticket — that stays with the ERP.
create policy hotel_incidents_staff_insert on public.hotel_incidents
    for insert to authenticated
    with check (public.is_tenant_member(tenant_id));

drop policy if exists tenants_platform_commercial on public.tenants;
create policy tenants_platform_commercial on public.tenants
    for select to authenticated
    using (
        public.erp_can('contracts')
        or public.erp_can('invoices')
        or public.erp_can('accounting')
        or public.erp_can('incidents')
        or public.erp_can('tickets')
    );

create policy profiles_platform_tasking on public.profiles
    for select to authenticated
    using (
        public.erp_can('tickets')
        or public.erp_can('incidents')
        or public.is_super_admin()
    );

grant select, insert, update, delete
    on public.work_tickets, public.hotel_incidents
    to authenticated;
