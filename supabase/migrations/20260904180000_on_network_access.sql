-- Prefixes from which a resort admits guest and lobby surfaces without a code.
-- Session windows and remote passes are added in a later migration; this one
-- only introduces the prefix list and the IP match helper.

alter table public.tenants
    add column if not exists trusted_cidrs cidr[] not null default '{}';

comment on column public.tenants.trusted_cidrs is
    'CIDR prefixes from which guest and lobby views admit without a code. Usually the resort public NAT. If two tenants share a prefix, auto-admit is disabled for that prefix.';

create or replace function public.guard_trusted_cidrs()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
    network cidr;
begin
    if new.trusted_cidrs is null then
        new.trusted_cidrs := '{}'::cidr[];
    end if;

    if cardinality(new.trusted_cidrs) > 16 then
        raise exception 'A resort may list at most 16 trusted networks'
            using errcode = 'check_violation';
    end if;

    foreach network in array new.trusted_cidrs
    loop
        if network = '0.0.0.0/0'::cidr or network = '::/0'::cidr then
            raise exception '0.0.0.0/0 and ::/0 cannot be trusted networks'
                using errcode = 'check_violation';
        end if;
        if family(network) = 4 and masklen(network) < 8 then
            raise exception 'IPv4 trusted networks must be /8 or narrower'
                using errcode = 'check_violation';
        end if;
        if family(network) = 6 and masklen(network) < 32 then
            raise exception 'IPv6 trusted networks must be /32 or narrower'
                using errcode = 'check_violation';
        end if;
    end loop;

    return new;
end;
$$;

drop trigger if exists trg_tenants_guard_trusted_cidrs on public.tenants;
create trigger trg_tenants_guard_trusted_cidrs
    before insert or update of trusted_cidrs on public.tenants
    for each row execute function public.guard_trusted_cidrs();

create or replace function public.match_tenant_by_ip(client_ip text)
returns table (
    tenant_id uuid,
    tenant_slug varchar,
    tenant_name varchar,
    trusted_cidrs cidr[],
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
        t.trusted_cidrs,
        (
            select max(masklen(network))
            from unnest(t.trusted_cidrs) as network
            where parsed <<= network
        ) as match_prefix
    from public.tenants t
    where t.is_active
      and t.subscription_status in ('trial', 'active', 'past_due')
      and cardinality(t.trusted_cidrs) > 0
      and exists (
          select 1
          from unnest(t.trusted_cidrs) as network
          where parsed <<= network
      )
    order by match_prefix desc, t.created_at asc
    limit 2;
end;
$$;

revoke all on function public.match_tenant_by_ip(text) from public;
grant execute on function public.match_tenant_by_ip(text) to anon, authenticated, service_role;
