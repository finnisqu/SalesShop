-- New shops inherit the creator's browser IANA timezone rather than World Stone's
-- timezone. Existing World Stone remains America/New_York; UTC is the safe database
-- fallback when a client does not provide a valid timezone.

begin;

alter table public.organizations
  alter column timezone set default 'UTC';

update public.organizations
set timezone = 'America/New_York'
where id = '0cbc5047-8f32-4bcc-9ed8-e015a596d3fb'::uuid;

create or replace function private.ensure_current_workspace(requested_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing_organization_id uuid;
  created_organization_id uuid;
  fallback_name text;
  requested_timezone text;
  safe_timezone text := 'UTC';
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select membership.organization_id
    into existing_organization_id
  from public.organization_members membership
  where membership.user_id = current_user_id
  order by membership.created_at
  limit 1;

  if existing_organization_id is not null then
    return existing_organization_id;
  end if;

  insert into public.profiles (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  select coalesce(
    nullif(btrim(requested_name), ''),
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'shop_name'), ''),
    'My Shop'
  ) into fallback_name;

  requested_timezone := nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'shop_timezone'), '');
  if requested_timezone is not null and exists (
    select 1 from pg_catalog.pg_timezone_names where name = requested_timezone
  ) then
    safe_timezone := requested_timezone;
  end if;

  insert into public.organizations (name, created_by, timezone)
  values (fallback_name, current_user_id, safe_timezone)
  returning id into created_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (created_organization_id, current_user_id, 'owner');

  return created_organization_id;
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_organization_id uuid;
  shop_name text;
  requested_timezone text;
  safe_timezone text := 'UTC';
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''))
  on conflict (user_id) do nothing;

  if not exists (
    select 1 from public.organization_members membership where membership.user_id = new.id
  ) then
    shop_name := coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'shop_name'), ''),
      'My Shop'
    );
    requested_timezone := nullif(btrim(new.raw_user_meta_data ->> 'shop_timezone'), '');
    if requested_timezone is not null and exists (
      select 1 from pg_catalog.pg_timezone_names where name = requested_timezone
    ) then
      safe_timezone := requested_timezone;
    end if;

    insert into public.organizations (name, created_by, timezone)
    values (shop_name, new.id, safe_timezone)
    returning id into created_organization_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (created_organization_id, new.id, 'owner');
  end if;

  return new;
end;
$$;

revoke all on function private.ensure_current_workspace(text) from public;
grant execute on function private.ensure_current_workspace(text) to authenticated;

commit;
