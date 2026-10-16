-- Disposable PostgreSQL fixture for staged RLS migration validation.
-- Intended ONLY for a local/CI empty Postgres instance.
-- NEVER execute against the connected SalesShop production project.
\set ON_ERROR_STOP on

create role authenticated nologin;
create role anon nologin;
create schema auth;
create schema private;
grant usage on schema auth,private to authenticated;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant execute on function auth.uid() to authenticated;

create table public.organizations(
  id uuid primary key,
  timezone text not null default 'America/New_York'
);
create table public.organization_members(
  organization_id uuid not null,
  user_id uuid not null,
  role text not null,
  job_function text not null default 'general',
  primary key(organization_id,user_id)
);
create table public.quotes(
  organization_id uuid not null,
  id text not null,
  owner_user_id uuid,
  quote_number text not null default 'DRAFT-LOCAL',
  document_type text not null default 'quote',
  change_order_number int,
  parent_quote_id text,
  updated_at timestamptz not null default now(),
  primary key(organization_id,id)
);
create table public.quote_access_grants(
  organization_id uuid not null,
  quote_id text not null,
  user_id uuid not null,
  granted_by uuid,
  primary key(organization_id,quote_id,user_id)
);
create table public.quote_lines(
  organization_id uuid not null,
  id text not null,
  quote_id text not null,
  primary key(organization_id,id)
);
create table public.activities(
  organization_id uuid not null,
  id text not null,
  quote_id text,
  type text not null default 'quote-linked',
  primary key(organization_id,id)
);
create table public.org_documents(
  organization_id uuid not null,
  document_key text not null,
  updated_by uuid not null,
  primary key(organization_id,document_key)
);
create table private.quote_number_counters(
  organization_id uuid not null,
  number_date date not null,
  last_number integer not null default 0,
  primary key(organization_id,number_date)
);

create or replace function private.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.organization_members m
   where m.organization_id=p_org and m.user_id=auth.uid())
$$;
create or replace function private.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.organization_members m
   where m.organization_id=p_org and m.user_id=auth.uid()
   and m.role in ('owner','admin'))
$$;
create or replace function private.can_edit_org_area(p_org uuid,p_area text)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.organization_members m
   where m.organization_id=p_org and m.user_id=auth.uid()
   and (m.role in ('owner','admin')
     or (m.role='member' and ((m.job_function in ('general','salesperson')
       and p_area in ('quotes','crm'))
       or (m.job_function='estimator' and p_area='quotes')))))
$$;
create or replace function private.can_issue_org_quotes(p_org uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select private.can_edit_org_area(p_org,'quotes') $$;
-- Placeholders preserve the live policy shape and are replaced by the migration.
create or replace function private.can_read_quote(p_org uuid,p_quote_id text)
returns boolean language sql stable security definer set search_path=''
as $$ select false $$;
create or replace function private.can_edit_quote(p_org uuid,p_quote_id text)
returns boolean language sql stable security definer set search_path=''
as $$ select false $$;
create or replace function public.can_access_quote(p_organization_id uuid,p_quote_id text,p_action text default 'read')
returns boolean language sql stable set search_path=''
as $$
 select case
 when p_action='read' then private.can_read_quote(p_organization_id,p_quote_id)
 when p_action='edit' then private.can_edit_quote(p_organization_id,p_quote_id)
 else false end
$$;

grant select,insert,update,delete on public.quotes,public.quote_access_grants,
  public.quote_lines,public.activities,public.org_documents to authenticated;
grant select on public.organization_members to authenticated;
grant execute on all functions in schema private to authenticated;
grant execute on function public.can_access_quote(uuid,text,text) to authenticated;

alter table public.quotes enable row level security;
alter table public.quote_access_grants enable row level security;
alter table public.quote_lines enable row level security;
alter table public.activities enable row level security;
alter table public.org_documents enable row level security;

create policy quotes_read_org on public.quotes for select to authenticated
  using(private.can_read_quote(organization_id,id));
create policy quotes_insert_editor on public.quotes for insert to authenticated
  with check(private.can_edit_org_area(organization_id,'quotes'));
create policy quotes_update_editor on public.quotes for update to authenticated
  using(private.can_edit_quote(organization_id,id))
  with check(private.can_edit_quote(organization_id,id));
create policy quotes_delete_editor on public.quotes for delete to authenticated
  using(private.can_edit_quote(organization_id,id));
create policy quote_lines_read_org on public.quote_lines for select to authenticated
  using(private.can_read_quote(organization_id,quote_id));

create policy quote_access_grants_read on public.quote_access_grants for select to authenticated
  using(private.is_org_admin(organization_id));
create policy quote_access_grants_insert_admin on public.quote_access_grants for insert to authenticated
  with check(private.is_org_admin(organization_id));
create policy quote_access_grants_update_admin on public.quote_access_grants for update to authenticated
  using(private.is_org_admin(organization_id))
  with check(private.is_org_admin(organization_id));
create policy quote_access_grants_delete_admin on public.quote_access_grants for delete to authenticated
  using(private.is_org_admin(organization_id));

create policy activities_insert_editor on public.activities for insert to authenticated
  with check(private.can_edit_org_area(organization_id,'crm'));

create policy org_documents_select_members on public.org_documents for select to authenticated
  using(private.is_org_admin(organization_id));
create policy org_documents_insert_members on public.org_documents for insert to authenticated
  with check(private.is_org_admin(organization_id));
create policy org_documents_update_members on public.org_documents for update to authenticated
  using(private.is_org_admin(organization_id))
  with check(private.is_org_admin(organization_id));
create policy org_documents_delete_admins on public.org_documents for delete to authenticated
  using(private.is_org_admin(organization_id));

insert into public.organizations(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
insert into public.organization_members(organization_id,user_id,role,job_function) values
 ('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000001','owner','general'),
 ('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000002','admin','general'),
 ('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000003','member','salesperson'),
 ('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000004','member','salesperson'),
 ('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000005','viewer','general'),
 ('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000007','member','purchasing'),
 ('22222222-2222-4222-8222-222222222222','00000000-0000-4000-8000-000000000006','owner','general');
insert into public.quotes(organization_id,id,owner_user_id) values
 ('11111111-1111-4111-8111-111111111111','alice','00000000-0000-4000-8000-000000000003'),
 ('11111111-1111-4111-8111-111111111111','bob','00000000-0000-4000-8000-000000000004'),
 ('11111111-1111-4111-8111-111111111111','unowned',null),
 ('11111111-1111-4111-8111-111111111111','unowned2',null),
 ('22222222-2222-4222-8222-222222222222','other-company','00000000-0000-4000-8000-000000000006');
insert into public.quote_lines(organization_id,id,quote_id)
values('11111111-1111-4111-8111-111111111111','line-alice','alice');
insert into public.quote_access_grants(organization_id,quote_id,user_id,granted_by)
values
 ('11111111-1111-4111-8111-111111111111','alice','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003'),
 ('11111111-1111-4111-8111-111111111111','alice','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000003');

insert into public.org_documents(organization_id,document_key,updated_by)
values
 ('11111111-1111-4111-8111-111111111111','crm','00000000-0000-4000-8000-000000000001'),
 ('11111111-1111-4111-8111-111111111111','quotes','00000000-0000-4000-8000-000000000001'),
 ('11111111-1111-4111-8111-111111111111','signatures','00000000-0000-4000-8000-000000000001'),
 ('11111111-1111-4111-8111-111111111111','settings','00000000-0000-4000-8000-000000000001');

-- Compile and apply the exact proposed SQL file against this test database.
\i supabase/migrations/20261015151800_private_quote_ownership_gate.sql

-- Run the role behavior assertions as actual authenticated DB role, not
-- postgres superuser. Each transaction sets a disposable JWT claim subject.
\i tests/security/private_quote_rls_spec.sql
