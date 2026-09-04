-- ═══════════════════════════════════════════════════════════════════════════
-- ERP COMMERCIAL MODULES
-- ═══════════════════════════════════════════════════════════════════════════
-- Four autonomous modules, each with its own tables and its own `erp_can()`
-- boundary. Overview may *read* them for the attention list; it may not write.
-- Accounting reads contracts and invoices rather than duplicating them, and
-- owns a ledger only for costs that are not an invoice (hosting, travel).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CONTRACTS
-- ═══════════════════════════════════════════════════════════════════════════

create table public.contracts (
    id              uuid primary key default uuid_generate_v4(),
    tenant_id       uuid not null references public.tenants(id) on delete cascade,

    starts_on       date not null,
    ends_on         date not null,
    billing_cycle   varchar(16) not null default 'yearly'
        check (billing_cycle in ('monthly', 'quarterly', 'yearly')),

    amount_cents    integer not null check (amount_cents >= 0),
    currency        char(3) not null default 'EUR',

    status          varchar(16) not null default 'active'
        check (status in ('draft', 'active', 'ended', 'cancelled')),

    notes           text,
    created_by      uuid references public.profiles(id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),

    constraint contracts_window_ordered check (ends_on > starts_on)
);

create index idx_contracts_tenant on public.contracts (tenant_id, ends_on desc);

comment on table public.contracts is
    'Commercial terms for a resort. History is kept; `active` is the one currently in force.';

-- At most one active contract per resort: two overlapping "current" terms
-- would make MRR and renewal dates ambiguous.
create unique index idx_contracts_one_active
    on public.contracts (tenant_id)
    where status = 'active';

create trigger trg_contracts_touch before update on public.contracts
    for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. INVOICES
-- ═══════════════════════════════════════════════════════════════════════════

create table public.invoices (
    id              uuid primary key default uuid_generate_v4(),
    tenant_id       uuid not null references public.tenants(id) on delete cascade,
    contract_id     uuid references public.contracts(id) on delete set null,

    number          varchar(32) not null unique,
    issued_on       date not null default (timezone('utc', now()))::date,
    due_on          date not null,

    amount_cents    integer not null check (amount_cents >= 0),
    tax_cents       integer not null default 0 check (tax_cents >= 0),
    currency        char(3) not null default 'EUR',

    status          varchar(16) not null default 'issued'
        check (status in ('draft', 'issued', 'paid', 'void')),
    paid_at         timestamptz,

    notes           text,
    created_by      uuid references public.profiles(id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),

    constraint invoices_due_after_issue check (due_on >= issued_on),
    constraint invoices_paid_consistency check (
        (status = 'paid' and paid_at is not null)
        or (status <> 'paid' and paid_at is null)
    )
);

create index idx_invoices_tenant on public.invoices (tenant_id, issued_on desc);
create index idx_invoices_status on public.invoices (status, due_on);

comment on table public.invoices is
    'Bills issued to a resort. Overdue is derived from `status = issued` and `due_on < today`, not stored.';

create trigger trg_invoices_touch before update on public.invoices
    for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. ACCOUNTING LEDGER
-- ═══════════════════════════════════════════════════════════════════════════
-- Costs and adjustments that are not an invoice. Paid invoices are income;
-- they stay on `invoices` so Accounting never has a second copy to drift.

create table public.ledger_entries (
    id              uuid primary key default uuid_generate_v4(),
    tenant_id       uuid references public.tenants(id) on delete set null,

    occurred_on     date not null default (timezone('utc', now()))::date,
    kind            varchar(16) not null
        check (kind in ('expense', 'adjustment')),
    amount_cents    integer not null check (amount_cents <> 0),
    currency        char(3) not null default 'EUR',
    memo            text not null,

    created_by      uuid references public.profiles(id) on delete set null,
    created_at      timestamptz not null default now()
);

create index idx_ledger_occurred on public.ledger_entries (occurred_on desc);

comment on table public.ledger_entries is
    'Accounting-owned journal. Expenses and adjustments only; invoice income is read from `invoices`.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. SUPPORT
-- ═══════════════════════════════════════════════════════════════════════════

create table public.support_tickets (
    id              uuid primary key default uuid_generate_v4(),
    tenant_id       uuid not null references public.tenants(id) on delete cascade,

    subject         varchar(200) not null,
    body            text not null,

    status          varchar(16) not null default 'open'
        check (status in ('open', 'pending', 'resolved', 'closed')),
    priority        varchar(16) not null default 'normal'
        check (priority in ('low', 'normal', 'high', 'urgent')),

    assigned_to     uuid references public.profiles(id) on delete set null,
    created_by      uuid references public.profiles(id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index idx_tickets_open on public.support_tickets (status, priority, created_at desc);

create table public.support_messages (
    id              uuid primary key default uuid_generate_v4(),
    ticket_id       uuid not null references public.support_tickets(id) on delete cascade,
    author_id       uuid references public.profiles(id) on delete set null,
    body            text not null,
    created_at      timestamptz not null default now()
);

create index idx_ticket_messages on public.support_messages (ticket_id, created_at);

create trigger trg_tickets_touch before update on public.support_tickets
    for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.contracts          enable row level security;
alter table public.invoices           enable row level security;
alter table public.ledger_entries     enable row level security;
alter table public.support_tickets    enable row level security;
alter table public.support_messages   enable row level security;

-- ── Contracts ──────────────────────────────────────────────────────────────
create policy contracts_read on public.contracts
    for select to authenticated
    using (
        public.erp_can('contracts')
        or public.erp_can('invoices')
        or public.erp_can('accounting')
        or public.erp_can('overview')
    );

create policy contracts_write on public.contracts
    for all to authenticated
    using (public.erp_can('contracts', 'write'))
    with check (public.erp_can('contracts', 'write'));

-- ── Invoices ───────────────────────────────────────────────────────────────
create policy invoices_read on public.invoices
    for select to authenticated
    using (
        public.erp_can('invoices')
        or public.erp_can('accounting')
        or public.erp_can('overview')
    );

create policy invoices_write on public.invoices
    for all to authenticated
    using (public.erp_can('invoices', 'write'))
    with check (public.erp_can('invoices', 'write'));

-- ── Ledger ─────────────────────────────────────────────────────────────────
create policy ledger_read on public.ledger_entries
    for select to authenticated
    using (public.erp_can('accounting'));

create policy ledger_write on public.ledger_entries
    for all to authenticated
    using (public.erp_can('accounting', 'write'))
    with check (public.erp_can('accounting', 'write'));

-- ── Support ────────────────────────────────────────────────────────────────
create policy tickets_read on public.support_tickets
    for select to authenticated
    using (public.erp_can('support') or public.erp_can('overview'));

create policy tickets_write on public.support_tickets
    for all to authenticated
    using (public.erp_can('support', 'write'))
    with check (public.erp_can('support', 'write'));

create policy messages_read on public.support_messages
    for select to authenticated
    using (public.erp_can('support'));

create policy messages_write on public.support_messages
    for all to authenticated
    using (public.erp_can('support', 'write'))
    with check (public.erp_can('support', 'write'));

-- Commercial modules need the resort list to attach a contract, invoice or
-- ticket. Overview already has a tenants read; this covers the rest.
create policy tenants_platform_commercial on public.tenants
    for select to authenticated
    using (
        public.erp_can('contracts')
        or public.erp_can('invoices')
        or public.erp_can('accounting')
        or public.erp_can('support')
    );

create policy profiles_platform_support on public.profiles
    for select to authenticated
    using (public.erp_can('support') or public.is_super_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. GRANTS
-- ═══════════════════════════════════════════════════════════════════════════

grant select, insert, update, delete
    on public.contracts, public.invoices, public.ledger_entries,
       public.support_tickets, public.support_messages
    to authenticated;
