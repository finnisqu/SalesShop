-- Disposable Postgres 17 ONLY. Do not point at Supabase production.
\set ON_ERROR_STOP on
create schema if not exists auth;
create schema if not exists private;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='authenticated') then
   create role authenticated nologin;
 end if;
 if not exists(select 1 from pg_roles where rolname='anon') then
   create role anon nologin;
 end if;
end $$;
grant usage on schema auth,private,public to authenticated;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant execute on function auth.uid() to authenticated;

create table public.organizations(id uuid primary key);
create table public.organization_members(
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null,
  role text not null,
  primary key(organization_id,user_id)
);
create table public.projects(
  organization_id uuid not null references public.organizations(id),
  id text not null,
  primary key(organization_id,id)
);
create table public.contacts(
  organization_id uuid not null references public.organizations(id),
  id text not null,
  primary key(organization_id,id)
);
create table public.quotes(
  organization_id uuid not null references public.organizations(id),
  id text not null,
  owner_user_id uuid,
  project_id text,
  contact_id text,
  primary key(organization_id,id)
);
create function private.can_edit_org_area(org uuid,area text)
returns boolean language sql stable security definer set search_path=''
as $$
  select area='quotes' and exists(
    select 1 from public.organization_members m
    where m.organization_id=org and m.user_id=auth.uid()
    and m.role in ('owner','admin','member')
  );
$$;

insert into public.organizations(id)
 values ('11111111-1111-4111-8111-111111111111');
insert into public.organization_members(organization_id,user_id,role) values
 ('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000001','owner'),
 ('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000002','admin'),
 ('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000003','member'),
 ('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000004','member'),
 ('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000005','viewer');
insert into public.projects values
 ('11111111-1111-4111-8111-111111111111','deal-1'),
 ('11111111-1111-4111-8111-111111111111','deal-2');
insert into public.contacts values
 ('11111111-1111-4111-8111-111111111111','contact-a'),
 ('11111111-1111-4111-8111-111111111111','contact-b'),
 ('11111111-1111-4111-8111-111111111111','contact-c');
insert into public.quotes values
 ('11111111-1111-4111-8111-111111111111','a-owned','00000000-0000-4000-8000-000000000003','deal-1','contact-a'),
 ('11111111-1111-4111-8111-111111111111','b-owned','00000000-0000-4000-8000-000000000004','deal-1','contact-b'),
 ('11111111-1111-4111-8111-111111111111','viewer-owned','00000000-0000-4000-8000-000000000005','deal-1','contact-c'),
 ('11111111-1111-4111-8111-111111111111','outsider-owned','00000000-0000-4000-8000-000000000006','deal-2','contact-c');

\i supabase/migrations/20261015173000_private_deal_contact_roles.sql
\i tests/security/private_deal_roles_spec.sql
