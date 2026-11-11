-- Disposable PostgreSQL 17 fixture; no customer data, no Supabase connection.
\set ON_ERROR_STOP on
create role authenticated nologin;
create role anon nologin;
create schema auth;
create schema private;
grant usage on schema auth,private to authenticated;
create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant execute on function auth.uid() to authenticated;

create table public.organizations(id uuid primary key);
create table public.organization_members(
 organization_id uuid not null,
 user_id uuid not null,
 role text not null,
 job_function text not null default 'general',
 primary key(organization_id,user_id)
);
create table public.quotes(organization_id uuid not null,id text not null,owner_user_id uuid,
 primary key(organization_id,id));
create table public.companies(
 organization_id uuid not null,id text not null,name text not null,
 primary key(organization_id,id)
);
create table public.contacts(
 organization_id uuid not null,id text not null,company_id text,name text not null,
 primary key(organization_id,id)
);
create table public.projects(
 organization_id uuid not null,id text not null,company_id text,name text not null,
 primary key(organization_id,id)
);
create table public.activities(
 organization_id uuid not null,id text not null,type text not null default 'note',
 summary text not null default '',company_id text,contact_id text,
 project_id text,quote_id text,primary key(organization_id,id)
);
create or replace function private.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid())$$;
create or replace function private.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.organization_members where organization_id=p_org
and user_id=auth.uid() and role in ('owner','admin'))$$;
create or replace function private.can_edit_org_area(p_org uuid,p_area text)
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.organization_members where organization_id=p_org
and user_id=auth.uid() and (role in ('owner','admin') or
 (role='member' and ((job_function in ('general','salesperson') and p_area in ('crm','quotes'))
 or (job_function='project_manager' and p_area='crm')))))$$;
create or replace function private.can_read_quote(p_org uuid,p_id text)
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.quotes where organization_id=p_org and id=p_id
and owner_user_id=auth.uid())$$;
create or replace function private.can_edit_quote(p_org uuid,p_id text)
returns boolean language sql stable security definer set search_path=''
as $$select private.can_read_quote(p_org,p_id)$$;

grant select,insert,update,delete on public.companies,public.contacts,public.projects,public.activities to authenticated;
grant execute on all functions in schema private to authenticated;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.projects enable row level security;
alter table public.activities enable row level security;
create policy companies_read_org on public.companies for select to authenticated
 using(private.is_org_member(organization_id));
create policy companies_insert_editor on public.companies for insert to authenticated
 with check(private.can_edit_org_area(organization_id,'crm'));
create policy companies_update_editor on public.companies for update to authenticated
 using(private.can_edit_org_area(organization_id,'crm'))
 with check(private.can_edit_org_area(organization_id,'crm'));
create policy companies_delete_editor on public.companies for delete to authenticated
 using(private.can_edit_org_area(organization_id,'crm'));
create policy contacts_read_org on public.contacts for select to authenticated
 using(private.is_org_member(organization_id));
create policy contacts_insert_editor on public.contacts for insert to authenticated
 with check(private.can_edit_org_area(organization_id,'crm'));
create policy contacts_update_editor on public.contacts for update to authenticated
 using(private.can_edit_org_area(organization_id,'crm'))
 with check(private.can_edit_org_area(organization_id,'crm'));
create policy contacts_delete_editor on public.contacts for delete to authenticated
 using(private.can_edit_org_area(organization_id,'crm'));
create policy projects_read_org on public.projects for select to authenticated
 using(private.is_org_member(organization_id));
create policy projects_insert_editor on public.projects for insert to authenticated
 with check(private.can_edit_org_area(organization_id,'crm'));
create policy projects_update_editor on public.projects for update to authenticated
 using(private.can_edit_org_area(organization_id,'crm'))
 with check(private.can_edit_org_area(organization_id,'crm'));
create policy projects_delete_editor on public.projects for delete to authenticated
 using(private.can_edit_org_area(organization_id,'crm'));
create policy activities_read_org on public.activities for select to authenticated
 using(private.is_org_member(organization_id));
create policy activities_insert_editor on public.activities for insert to authenticated
 with check(private.can_edit_org_area(organization_id,'crm'));
create policy activities_update_editor on public.activities for update to authenticated
 using(private.can_edit_org_area(organization_id,'crm'))
 with check(private.can_edit_org_area(organization_id,'crm'));
create policy activities_delete_editor on public.activities for delete to authenticated
 using(private.can_edit_org_area(organization_id,'crm'));

insert into public.organizations(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.organization_members(organization_id,user_id,role,job_function) values
('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000001','owner','general'),
('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000002','admin','general'),
('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000003','member','salesperson'),
('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000004','member','salesperson'),
('11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000005','viewer','general'),
('22222222-2222-4222-8222-222222222222','00000000-0000-4000-8000-000000000006','owner','general');
insert into public.quotes(organization_id,id,owner_user_id) values
('11111111-1111-4111-8111-111111111111','alice-quote','00000000-0000-4000-8000-000000000003');

-- Existing historical record has UNKNOWN owner; it must remain NULL.
insert into public.companies(organization_id,id,name)
values('11111111-1111-4111-8111-111111111111','legacy-company','Legacy unnamed owner');

-- Simulate legacy privileged merge functions. The staged privacy migration
-- must revoke their authenticated EXECUTE capability.
create or replace function public.merge_crm_company_identity(uuid,text,text)
returns void language plpgsql security definer as $body$ begin null; end; $body$;
create or replace function public.merge_crm_contact_identity(uuid,text,text)
returns void language plpgsql security definer as $body$ begin null; end; $body$;
grant execute on function public.merge_crm_company_identity(uuid,text,text) to authenticated;
grant execute on function public.merge_crm_contact_identity(uuid,text,text) to authenticated;

-- Apply exact staged SQL against disposable database only.
\i supabase/migrations/20261015162000_private_crm_ownership_gate.sql
-- Disposable test-only assertion helper. Production audit table stays hidden
-- from authenticated users; this function exists only in the CI fixture.
create or replace function private.test_crm_audit_count(p_org uuid)
returns integer language sql stable security definer set search_path=''
as $testaudit$ select count(*)::integer from private.crm_recovery_audit where organization_id=p_org $testaudit$;
grant execute on function private.test_crm_audit_count(uuid) to authenticated;

-- New owned records: seed as privileged test fixture after RLS policy installation.
insert into public.companies(organization_id,id,name,owner_user_id) values
('11111111-1111-4111-8111-111111111111','alice-company','Alice customer','00000000-0000-4000-8000-000000000003'),
('11111111-1111-4111-8111-111111111111','bob-company','Bob customer','00000000-0000-4000-8000-000000000004'),
('22222222-2222-4222-8222-222222222222','other-company','Other customer','00000000-0000-4000-8000-000000000006');
insert into public.contacts(organization_id,id,name,company_id,owner_user_id) values
('11111111-1111-4111-8111-111111111111','alice-contact','Private contact','alice-company','00000000-0000-4000-8000-000000000003');
insert into public.projects(organization_id,id,name,company_id,owner_user_id) values
('11111111-1111-4111-8111-111111111111','alice-project','Private project','alice-company','00000000-0000-4000-8000-000000000003');
insert into public.activities(organization_id,id,summary,company_id,quote_id,owner_user_id) values
('11111111-1111-4111-8111-111111111111','alice-activity','Private note','alice-company','alice-quote','00000000-0000-4000-8000-000000000003');

\i tests/security/private_crm_rls_spec.sql
