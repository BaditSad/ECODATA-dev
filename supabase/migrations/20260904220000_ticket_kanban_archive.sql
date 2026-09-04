-- Kanban statuses for internal tickets.
-- open → waiting, resolved → done, closed → archived. in_progress stays.

update public.work_tickets set status = 'waiting' where status = 'open';
update public.work_tickets set status = 'done' where status = 'resolved';
update public.work_tickets set status = 'archived' where status = 'closed';

alter table public.work_tickets
    drop constraint if exists work_tickets_status_check;

alter table public.work_tickets
    add constraint work_tickets_status_check
    check (status in ('draft', 'waiting', 'in_progress', 'done', 'archived'));

alter table public.work_tickets
    alter column status set default 'draft';

alter table public.work_tickets
    add column if not exists completed_at timestamptz;

alter table public.work_tickets
    add column if not exists archived_at timestamptz;

update public.work_tickets
    set completed_at = coalesce(completed_at, updated_at)
    where status = 'done' and completed_at is null;

update public.work_tickets
    set archived_at = coalesce(archived_at, updated_at)
    where status = 'archived' and archived_at is null;

comment on column public.work_tickets.completed_at is
    'Set when the ticket enters done. At month rollover, done tickets from prior months are archived.';

comment on column public.work_tickets.archived_at is
    'Set when the ticket is archived, automatically or by hand.';
