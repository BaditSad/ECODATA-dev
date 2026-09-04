-- Closed incidents from previous months become archives.
-- Manual archive sets status = archived independently of closed.

alter table public.hotel_incidents
    drop constraint if exists hotel_incidents_status_check;

alter table public.hotel_incidents
    add constraint hotel_incidents_status_check
    check (status in ('open', 'in_progress', 'resolved', 'closed', 'suspended', 'archived'));

alter table public.hotel_incidents
    add column if not exists closed_at timestamptz;

alter table public.hotel_incidents
    add column if not exists archived_at timestamptz;

update public.hotel_incidents
    set closed_at = coalesce(closed_at, updated_at)
    where status in ('closed', 'archived') and closed_at is null;

update public.hotel_incidents
    set archived_at = coalesce(archived_at, updated_at)
    where status = 'archived' and archived_at is null;

comment on column public.hotel_incidents.closed_at is
    'Set when the incident is closed. At month rollover, closed incidents from prior months are archived.';

comment on column public.hotel_incidents.archived_at is
    'Set when the incident is archived, automatically or by hand.';
