-- Incidents are hotel-raised. ERP staff close, suspend or delete them, and
-- may open an internal work ticket that points back at the report.

alter table public.hotel_incidents
    drop constraint if exists hotel_incidents_status_check;

alter table public.hotel_incidents
    add constraint hotel_incidents_status_check
    check (status in ('open', 'in_progress', 'resolved', 'closed', 'suspended'));

alter table public.work_tickets
    add column if not exists source_incident_id uuid
        references public.hotel_incidents(id) on delete set null;

create index if not exists idx_work_tickets_source_incident
    on public.work_tickets (source_incident_id)
    where source_incident_id is not null;

comment on column public.work_tickets.source_incident_id is
    'When set, this ticket was opened from a hotel incident.';
