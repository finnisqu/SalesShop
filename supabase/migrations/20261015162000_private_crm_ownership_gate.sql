-- STAGED Batch 14E: salesperson-private CRM. NOT applied to production.
-- Existing records remain UNASSIGNED; never guess creator from data or timestamps.
-- Coordinate with CRM store/sync, Board, merging RPCs and quote RLS BEFORE deployment.
begin;
alter table public.companies add column if not exists owner_user_id uuid;
alter table public.companies alter column owner_user_id set default auth.uid();
create index if not exists companies_owner_scope_idx
 on public.companies(organization_id,owner_user_id);
alter table public.contacts add column if not exists owner_user_id uuid;
alter table public.contacts alter column owner_user_id set default auth.uid();
create index if not exists contacts_owner_scope_idx
 on public.contacts(organization_id,owner_user_id);
alter table public.projects add column if not exists owner_user_id uuid;
alter table public.projects alter column owner_user_id set default auth.uid();
create index if not exists projects_owner_scope_idx
 on public.projects(organization_id,owner_user_id);
alter table public.activities add column if not exists owner_user_id uuid;
alter table public.activities alter column owner_user_id set default auth.uid();
create index if not exists activities_owner_scope_idx
 on public.activities(organization_id,owner_user_id);
-- Explicit READ-only links; same owner doesn't imply access to another entity.
create table if not exists public.crm_access_grants (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 entity_type text not null check(entity_type in ('companies','contacts','projects','activities')),
 entity_id text not null,
 user_id uuid not null,
 granted_by uuid not null,
 created_at timestamptz not null default now(),
 primary key(organization_id,entity_type,entity_id,user_id)
);
create index if not exists crm_access_grants_grantee_idx on public.crm_access_grants(user_id,organization_id);
alter table public.crm_access_grants enable row level security;
grant select,insert,delete on public.crm_access_grants to authenticated;

-- A private-schema function avoids recursively invoking the policy on its own
-- table. Table references are static and the caller never chooses SQL text.
create or replace function private.can_read_crm_entity(p_org uuid,p_type text,p_id text)
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null and exists(
   select 1 from public.organization_members m
   where m.organization_id=p_org and m.user_id=(select auth.uid())
   and (
     exists (
       select 1 from (
         select owner_user_id from public.companies where p_type='companies' and organization_id=p_org and id=p_id
         union all select owner_user_id from public.contacts where p_type='contacts' and organization_id=p_org and id=p_id
         union all select owner_user_id from public.projects where p_type='projects' and organization_id=p_org and id=p_id
         union all select owner_user_id from public.activities where p_type='activities' and organization_id=p_org and id=p_id
       ) resource
       where resource.owner_user_id=(select auth.uid())
         or (resource.owner_user_id is null and m.role in ('owner','admin'))
     )
     or exists (
       select 1 from public.crm_access_grants g
       where g.organization_id=p_org and g.entity_type=p_type
         and g.entity_id=p_id and g.user_id=(select auth.uid())
     )
   )
 );
$$;

create or replace function private.can_edit_crm_entity(p_org uuid,p_type text,p_id text)
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null
  and private.can_edit_org_area(p_org,'crm')
  and exists (
    select 1 from public.organization_members m
    where m.organization_id=p_org and m.user_id=(select auth.uid())
      and exists (
        select 1 from (
          select owner_user_id from public.companies where p_type='companies' and organization_id=p_org and id=p_id
          union all select owner_user_id from public.contacts where p_type='contacts' and organization_id=p_org and id=p_id
          union all select owner_user_id from public.projects where p_type='projects' and organization_id=p_org and id=p_id
          union all select owner_user_id from public.activities where p_type='activities' and organization_id=p_org and id=p_id
        ) resource
        where resource.owner_user_id=(select auth.uid())
          or (resource.owner_user_id is null and m.role in ('owner','admin'))
      )
  );
$$;

revoke all on function private.can_read_crm_entity(uuid,text,text) from public,anon;
revoke all on function private.can_edit_crm_entity(uuid,text,text) from public,anon;
grant execute on function private.can_read_crm_entity(uuid,text,text) to authenticated;
grant execute on function private.can_edit_crm_entity(uuid,text,text) to authenticated;

-- A contact/project/activity may reference another entity. A caller who can't
-- even read the parent isn't allowed to link their private record to it.
create or replace function private.can_reference_crm(
 p_org uuid,p_company text,p_contact text,p_project text,p_quote text,p_edit_quote boolean default false
) returns boolean language sql stable security definer set search_path=''
as $$
 select (p_company is null or private.can_read_crm_entity(p_org,'companies',p_company))
   and (p_contact is null or private.can_read_crm_entity(p_org,'contacts',p_contact))
   and (p_project is null or private.can_read_crm_entity(p_org,'projects',p_project))
   and (p_quote is null or (
     case when p_edit_quote then private.can_edit_quote(p_org,p_quote)
          else private.can_read_quote(p_org,p_quote) end
   ));
$$;
revoke all on function private.can_reference_crm(uuid,text,text,text,text,boolean) from public,anon;
grant execute on function private.can_reference_crm(uuid,text,text,text,text,boolean) to authenticated;


alter policy companies_read_org on public.companies
  using (private.can_read_crm_entity(organization_id,'companies',id) );
alter policy companies_insert_editor on public.companies
  with check (private.can_edit_org_area(organization_id,'crm')
    and owner_user_id=(select auth.uid()) );
alter policy companies_update_editor on public.companies
  using (private.can_edit_crm_entity(organization_id,'companies',id))
  with check (private.can_edit_crm_entity(organization_id,'companies',id) );
alter policy companies_delete_editor on public.companies
  using (private.can_edit_crm_entity(organization_id,'companies',id));

alter policy contacts_read_org on public.contacts
  using (private.can_read_crm_entity(organization_id,'contacts',id) and (company_id is null or private.can_read_crm_entity(organization_id,'companies',company_id)));
alter policy contacts_insert_editor on public.contacts
  with check (private.can_edit_org_area(organization_id,'crm')
    and owner_user_id=(select auth.uid()) and (company_id is null or private.can_read_crm_entity(organization_id,'companies',company_id)));
alter policy contacts_update_editor on public.contacts
  using (private.can_edit_crm_entity(organization_id,'contacts',id))
  with check (private.can_edit_crm_entity(organization_id,'contacts',id) and (company_id is null or private.can_read_crm_entity(organization_id,'companies',company_id)));
alter policy contacts_delete_editor on public.contacts
  using (private.can_edit_crm_entity(organization_id,'contacts',id));

alter policy projects_read_org on public.projects
  using (private.can_read_crm_entity(organization_id,'projects',id) and (company_id is null or private.can_read_crm_entity(organization_id,'companies',company_id)));
alter policy projects_insert_editor on public.projects
  with check (private.can_edit_org_area(organization_id,'crm')
    and owner_user_id=(select auth.uid()) and (company_id is null or private.can_read_crm_entity(organization_id,'companies',company_id)));
alter policy projects_update_editor on public.projects
  using (private.can_edit_crm_entity(organization_id,'projects',id))
  with check (private.can_edit_crm_entity(organization_id,'projects',id) and (company_id is null or private.can_read_crm_entity(organization_id,'companies',company_id)));
alter policy projects_delete_editor on public.projects
  using (private.can_edit_crm_entity(organization_id,'projects',id));

alter policy activities_read_org on public.activities
  using (private.can_read_crm_entity(organization_id,'activities',id) and private.can_reference_crm(organization_id,company_id,contact_id,project_id,quote_id,false));
alter policy activities_insert_editor on public.activities
  with check (private.can_edit_org_area(organization_id,'crm')
    and owner_user_id=(select auth.uid()) and private.can_reference_crm(organization_id,company_id,contact_id,project_id,quote_id,true));
alter policy activities_update_editor on public.activities
  using (private.can_edit_crm_entity(organization_id,'activities',id))
  with check (private.can_edit_crm_entity(organization_id,'activities',id) and private.can_reference_crm(organization_id,company_id,contact_id,project_id,quote_id,true));
alter policy activities_delete_editor on public.activities
  using (private.can_edit_crm_entity(organization_id,'activities',id));

-- A member cannot grant access to records they don't own or manage.
create policy crm_grants_read on public.crm_access_grants for select to authenticated
 using (
   ((user_id=(select auth.uid())) and private.is_org_member(organization_id))
   or private.can_edit_crm_entity(organization_id,entity_type,entity_id)
 );
create policy crm_grants_insert on public.crm_access_grants for insert to authenticated
 with check (
   granted_by=(select auth.uid())
   and private.can_edit_crm_entity(organization_id,entity_type,entity_id)
   and exists(select 1 from public.organization_members m where
     m.organization_id=crm_access_grants.organization_id
     and m.user_id=crm_access_grants.user_id)
 );
create policy crm_grants_delete on public.crm_access_grants for delete to authenticated
 using (private.can_edit_crm_entity(organization_id,entity_type,entity_id));

-- Existing data remains explicitly unassigned. Only an authorized manager
-- may attribute an unassigned row, and the action is permanently auditable.
create table if not exists private.crm_recovery_audit (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 entity_type text not null,
 entity_id text not null,
 assigned_user_id uuid not null,
 assigned_by uuid not null,
 assigned_at timestamptz not null default now()
);
alter table private.crm_recovery_audit enable row level security;
revoke all on private.crm_recovery_audit from public,anon,authenticated;

-- Prevent direct owner changes. Audited recovery executes as the DB function
-- owner (postgres), not as the authenticated PostgREST session role.
create or replace function private.guard_crm_owner_update()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.owner_user_id is distinct from old.owner_user_id then
   if old.owner_user_id is not null
     or current_user <> 'postgres'
     or not private.is_org_admin(old.organization_id)
   then
     raise exception 'CRM record ownership requires an approved recovery/handoff'
       using errcode='42501';
   end if;
 end if;
 return new;
end;
$$;
drop trigger if exists companies_owner_immutable on public.companies;
create trigger companies_owner_immutable before update on public.companies
 for each row execute function private.guard_crm_owner_update();
drop trigger if exists contacts_owner_immutable on public.contacts;
create trigger contacts_owner_immutable before update on public.contacts
 for each row execute function private.guard_crm_owner_update();
drop trigger if exists projects_owner_immutable on public.projects;
create trigger projects_owner_immutable before update on public.projects
 for each row execute function private.guard_crm_owner_update();
drop trigger if exists activities_owner_immutable on public.activities;
create trigger activities_owner_immutable before update on public.activities
 for each row execute function private.guard_crm_owner_update();

create or replace function public.assign_unowned_crm_record(
 target_org uuid,target_type text,target_id text,target_user uuid
) returns boolean language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); affected int;
begin
 if actor is null or not private.is_org_admin(target_org) then
   raise exception 'Only company management may assign unowned CRM records' using errcode='42501';
 end if;
 if target_type not in ('companies','contacts','projects','activities') then
   raise exception 'Unsupported CRM entity' using errcode='22023';
 end if;
 if not exists(
   select 1 from public.organization_members m
   where m.organization_id=target_org and m.user_id=target_user
     and (m.role in ('owner','admin') or
       (m.role='member' and m.job_function in ('general','salesperson','project_manager')))
 ) then
   raise exception 'Assignee must be an authorized CRM editor in this company' using errcode='42501';
 end if;
 execute pg_catalog.format(
   'update public.%I set owner_user_id=$1 where organization_id=$2 and id=$3 and owner_user_id is null',
   target_type
 ) using target_user,target_org,target_id;
 get diagnostics affected = row_count;
 if affected<>1 then
   raise exception 'Record is assigned, absent, or changed' using errcode='42501';
 end if;
 insert into private.crm_recovery_audit(organization_id,entity_type,entity_id,assigned_user_id,assigned_by)
 values(target_org,target_type,target_id,target_user,actor);
 return true;
end;
$$;
revoke all on function public.assign_unowned_crm_record(uuid,text,text,uuid) from public,anon;
grant execute on function public.assign_unowned_crm_record(uuid,text,text,uuid) to authenticated;
commit;
