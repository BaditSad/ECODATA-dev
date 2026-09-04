-- Owner identity is a platform address, not a person's mailbox.
-- The previous bootstrap promoted brieuc@ecodatalink.com; that address is
-- no longer special. Existing rows are left alone — this only changes who
-- a *new* signup of the operator address becomes.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    operator_email constant text := 'admin@ecodatalink.com';
    claimed_tenant uuid := (new.raw_user_meta_data->>'tenant_id')::uuid;
begin
    if lower(new.email) = operator_email then
        insert into public.profiles (id, email, full_name, role, tenant_id, is_active)
        values (new.id, new.email,
                coalesce(new.raw_user_meta_data->>'full_name', 'Platform owner'),
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
