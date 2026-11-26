-- #396 ONLY: minimal organization scaffolding in an empty disposable Supabase
-- staging project. These tables intentionally do NOT mirror the full SalesShop
-- schema and must NEVER run on production or an existing populated database.
-- Intended as a prerequisite for 396-gmail-persistent-staging.sql on an empty
-- project before synthetic two-org authorization tests.
begin;
do $$
begin
 if exists(select 1 from auth.users) then
  raise exception 'Refusing Gmail isolated staging bootstrap: auth.users is not empty';
 end if;
 if exists(select 1 from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE'
    and table_name not in ('schema_migrations')) then
  raise exception 'Refusing Gmail isolated staging bootstrap: public tables already exist';
 end if;
end $$;

create table public.organizations (
 id uuid primary key,
 name text not null check(length(name) between 1 and 120)
);
create table public.organization_members (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','salesperson','viewer')),
 primary key(organization_id,user_id)
);
comment on table public.organizations is
 'Disposable #396 staging-only organization fixture — NOT SalesShop production schema';
comment on table public.organization_members is
 'Disposable #396 staging-only membership fixture — NOT SalesShop production schema';
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
revoke all on public.organizations from PUBLIC,anon,authenticated;
revoke all on public.organization_members from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.organizations to service_role;
grant select,insert,update,delete on public.organization_members to service_role;
-- Staging-only auth.users cascade cleanup uses a user_id-leading index.
create index if not exists gmail396_staging_member_user_idx
 on public.organization_members(user_id);
commit;
