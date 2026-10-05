-- SalesShop cloud foundation
-- Phase 1 intentionally persists the current domain documents as JSONB snapshots.
-- This gives us Auth, multi-user organization scope, durable cloud persistence,
-- and hard Notebook privacy without forcing a risky all-at-once store rewrite.
-- The next repository migration can normalize individual domain entities behind
-- the same application/service seams.

begin;

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_id_idx
  on public.organization_members(user_id);

create table if not exists public.org_documents (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_key text not null check (document_key in ('crm', 'quotes', 'signatures')),
  document jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, document_key)
);

create table if not exists public.private_documents (
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null check (document_key in ('notebook')),
  document jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (owner_id, document_key)
);

comment on table public.org_documents is
  'Organization-shared SalesShop state. Current bridge keys: crm, quotes, signatures.';
comment on table public.private_documents is
  'User-private state. Notebook is intentionally isolated from organization-shared records.';

create or replace function public.is_org_member(target_organization uuid)
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

create or replace function public.is_org_admin(target_organization uuid)
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

create or replace function public.get_my_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select membership.organization_id
  from public.organization_members membership
  where membership.user_id = auth.uid()
  order by membership.created_at
  limit 1;
$$;

create or replace function public.ensure_current_workspace(requested_name text default null)
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

create or replace function public.handle_new_auth_user()
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
  for each row execute function public.handle_new_auth_user();

create or replace function public.touch_document_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.revision := coalesce(old.revision, 0) + 1;
  return new;
end;
$$;

drop trigger if exists touch_org_documents_updated_at on public.org_documents;
create trigger touch_org_documents_updated_at
  before update on public.org_documents
  for each row execute function public.touch_document_updated_at();

drop trigger if exists touch_private_documents_updated_at on public.private_documents;
create trigger touch_private_documents_updated_at
  before update on public.private_documents
  for each row execute function public.touch_document_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.org_documents enable row level security;
alter table public.private_documents enable row level security;

drop policy if exists organizations_select_members on public.organizations;
create policy organizations_select_members
  on public.organizations for select
  to authenticated
  using (public.is_org_member(id));

drop policy if exists organizations_update_admins on public.organizations;
create policy organizations_update_admins
  on public.organizations for update
  to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists memberships_select_org_members on public.organization_members;
create policy memberships_select_org_members
  on public.organization_members for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists memberships_insert_admins on public.organization_members;
create policy memberships_insert_admins
  on public.organization_members for insert
  to authenticated
  with check (public.is_org_admin(organization_id));

drop policy if exists memberships_update_admins on public.organization_members;
create policy memberships_update_admins
  on public.organization_members for update
  to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists memberships_delete_admins on public.organization_members;
create policy memberships_delete_admins
  on public.organization_members for delete
  to authenticated
  using (public.is_org_admin(organization_id));

drop policy if exists org_documents_select_members on public.org_documents;
create policy org_documents_select_members
  on public.org_documents for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists org_documents_insert_members on public.org_documents;
create policy org_documents_insert_members
  on public.org_documents for insert
  to authenticated
  with check (
    public.is_org_member(organization_id)
    and updated_by = auth.uid()
  );

drop policy if exists org_documents_update_members on public.org_documents;
create policy org_documents_update_members
  on public.org_documents for update
  to authenticated
  using (public.is_org_member(organization_id))
  with check (
    public.is_org_member(organization_id)
    and updated_by = auth.uid()
  );

drop policy if exists org_documents_delete_admins on public.org_documents;
create policy org_documents_delete_admins
  on public.org_documents for delete
  to authenticated
  using (public.is_org_admin(organization_id));

drop policy if exists private_documents_select_owner on public.private_documents;
create policy private_documents_select_owner
  on public.private_documents for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists private_documents_insert_owner on public.private_documents;
create policy private_documents_insert_owner
  on public.private_documents for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists private_documents_update_owner on public.private_documents;
create policy private_documents_update_owner
  on public.private_documents for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists private_documents_delete_owner on public.private_documents;
create policy private_documents_delete_owner
  on public.private_documents for delete
  to authenticated
  using (owner_id = auth.uid());

grant select on public.organizations, public.profiles, public.organization_members to authenticated;
grant update on public.organizations, public.profiles to authenticated;
grant select, insert, update, delete on public.org_documents, public.private_documents to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.get_my_org_id() to authenticated;
grant execute on function public.ensure_current_workspace(text) to authenticated;

commit;
