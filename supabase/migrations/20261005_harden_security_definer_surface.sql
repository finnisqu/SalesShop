-- Harden SalesShop's SECURITY DEFINER surface.
-- Keep only the authenticated workspace bootstrap RPC exposed in public;
-- move RLS/trigger helpers behind a non-exposed private schema.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_org_member(target_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization
      and membership.user_id = auth.uid()
  );
$$;

create or replace function private.is_org_admin(target_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin')
  );
$$;

create or replace function private.ensure_current_workspace(requested_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  existing_organization_id uuid;
  created_organization_id uuid;
  fallback_name text;
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

  insert into public.organizations (name, created_by)
  values (fallback_name, current_user_id)
  returning id into created_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (created_organization_id, current_user_id, 'owner');

  return created_organization_id;
end;
$$;

create or replace function public.ensure_current_workspace(requested_name text default null)
returns uuid
language sql
security invoker
set search_path = public, private, auth
as $$
  select private.ensure_current_workspace(requested_name);
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  created_organization_id uuid;
  shop_name text;
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

    insert into public.organizations (name, created_by)
    values (shop_name, new.id)
    returning id into created_organization_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (created_organization_id, new.id, 'owner');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

alter policy organizations_select_members on public.organizations
  using (private.is_org_member(id));

alter policy organizations_update_admins on public.organizations
  using (private.is_org_admin(id))
  with check (private.is_org_admin(id));

alter policy memberships_select_org_members on public.organization_members
  using (private.is_org_member(organization_id));

alter policy memberships_insert_admins on public.organization_members
  with check (private.is_org_admin(organization_id));

alter policy memberships_update_admins on public.organization_members
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id));

alter policy memberships_delete_admins on public.organization_members
  using (private.is_org_admin(organization_id));

alter policy org_documents_select_members on public.org_documents
  using (private.is_org_member(organization_id));

alter policy org_documents_insert_members on public.org_documents
  with check (
    private.is_org_member(organization_id)
    and updated_by = auth.uid()
  );

alter policy org_documents_update_members on public.org_documents
  using (private.is_org_member(organization_id))
  with check (
    private.is_org_member(organization_id)
    and updated_by = auth.uid()
  );

alter policy org_documents_delete_admins on public.org_documents
  using (private.is_org_admin(organization_id));

revoke all on function public.ensure_current_workspace(text) from public, anon;
grant execute on function public.ensure_current_workspace(text) to authenticated;
grant execute on function private.ensure_current_workspace(text) to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.is_org_admin(uuid) to authenticated;

revoke all on function public.is_org_member(uuid) from public, anon, authenticated;
revoke all on function public.is_org_admin(uuid) from public, anon, authenticated;
revoke all on function public.get_my_org_id() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop function if exists public.is_org_member(uuid);
drop function if exists public.is_org_admin(uuid);
drop function if exists public.get_my_org_id();
drop function if exists public.handle_new_auth_user();

commit;
