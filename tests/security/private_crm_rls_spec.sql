-- Executed ONLY against disposable PostgreSQL 17 in GitHub Actions.
\set ON_ERROR_STOP on

-- Salesperson A sees their own CRM + associated records, not Bob's.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$
declare org uuid:='11111111-1111-4111-8111-111111111111';
begin
 if not private.can_read_crm_entity(org,'companies','alice-company')
 or not private.can_edit_crm_entity(org,'companies','alice-company')
 or private.can_read_crm_entity(org,'companies','bob-company')
 or private.can_read_crm_entity(org,'companies','legacy-company') then
   raise exception 'Salesperson can read someone else CRM or cannot read own CRM';end if;
 if (select count(*) from public.companies where organization_id=org)<>1 or
 (select count(*) from public.contacts where organization_id=org)<>1 or
 (select count(*) from public.projects where organization_id=org)<>1 or
 (select count(*) from public.activities where organization_id=org)<>1 then
   raise exception 'Private CRM SELECT policies returned wrong rows';end if;
 insert into public.companies(organization_id,id,name)
 values(org,'alice-new','Alice additional company');
 if not exists(select 1 from public.companies
 where organization_id=org and id='alice-new' and owner_user_id=auth.uid()) then
   raise exception 'New CRM records do not default to authenticated owner';end if;
 begin
   insert into public.companies(organization_id,id,name,owner_user_id)
   values(org,'spoof','Not mine','00000000-0000-4000-8000-000000000004');
   raise exception 'Spoofed salesperson owner insert succeeded';
 exception when insufficient_privilege then null;
 end;
 begin
   insert into public.contacts(organization_id,id,name,company_id)
   values(org,'forged-linked-contact','Cannot link to Bob','bob-company');
   raise exception 'Cross-owner CRM reference unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
 begin
   update public.companies set owner_user_id='00000000-0000-4000-8000-000000000004'
   where organization_id=org and id='alice-company';
   raise exception 'Direct owned CRM transfer succeeded';
 exception when insufficient_privilege then null;
 end;
 begin
   insert into public.activities(organization_id,id,summary,quote_id,company_id)
   values(org,'bad-quote-activity','Cannot mutate colleague quote','bob-quote','alice-company');
   raise exception 'Unowned quote activity was accepted';
 exception when insufficient_privilege then null;
 end;
 insert into public.crm_access_grants(organization_id,entity_type,entity_id,user_id,granted_by)
 values(org,'companies','alice-company','00000000-0000-4000-8000-000000000004',auth.uid());
end
$$;
commit;

-- Granted salesperson B may READ exactly one company, not edit it or read
-- related contacts/projects/activities without separate explicit grants.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
do $$
declare org uuid:='11111111-1111-4111-8111-111111111111';
begin
 if not private.can_read_crm_entity(org,'companies','alice-company')
 or private.can_edit_crm_entity(org,'companies','alice-company')
 or private.can_read_crm_entity(org,'contacts','alice-contact') then
   raise exception 'Read-only CRM share incorrectly expands to edit or related entities';end if;
 if (select count(*) from public.companies where organization_id=org)<>2
 or (select count(*) from public.contacts where organization_id=org)<>0 then
   raise exception 'CRM granted row visibility mismatch';end if;
 begin
  delete from public.crm_access_grants where entity_type='companies' and entity_id='alice-company';
  if found then raise exception 'Grantee deleted someone else grant';end if;
 end;
end
$$;
rollback;

-- An admin sees legacy unassigned records but cannot silently read others'
-- private CRM. Recovery must be an explicit audited one-time action.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$
declare org uuid:='11111111-1111-4111-8111-111111111111';
begin
 if not private.can_read_crm_entity(org,'companies','legacy-company')
 or private.can_read_crm_entity(org,'companies','alice-company')
 or private.can_edit_crm_entity(org,'companies','alice-company') then
   raise exception 'Admin historical recovery scope leaks owned CRM';end if;
 if not public.assign_unowned_crm_record(org,'companies','legacy-company',
   '00000000-0000-4000-8000-000000000003') then
   raise exception 'Admin cannot audit-assign genuinely unowned company';end if;
 if private.can_read_crm_entity(org,'companies','legacy-company') then
   raise exception 'Recovered company still visible to admin';end if;
 if (select count(*) from private.crm_recovery_audit where organization_id=org)<>1 then
   raise exception 'Legacy CRM recovery lacked durable audit record';end if;
 begin
  perform public.assign_unowned_crm_record(org,'companies','bob-company',
   '00000000-0000-4000-8000-000000000003');
  raise exception 'Manager forcibly transferred Bob company';
 exception when insufficient_privilege then null;
 end;
end
$$;
rollback;

-- Management role, viewer, nonmember, and cross-tenant access.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
begin
 if private.can_read_crm_entity('11111111-1111-4111-8111-111111111111','projects','alice-project') then
   raise exception 'Owner can read salesperson private project';end if;
end
$$;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
do $$
begin
 if private.can_read_crm_entity('11111111-1111-4111-8111-111111111111','contacts','alice-contact') then
   raise exception 'Viewer can read private contact';end if;
end
$$;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
do $$
begin
 if private.can_read_crm_entity('11111111-1111-4111-8111-111111111111','companies','alice-company') then
   raise exception 'Cross-org CRM read succeeded';end if;
end
$$;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000008',true);
do $$
begin
 if private.can_read_crm_entity('11111111-1111-4111-8111-111111111111','companies','alice-company') then
   raise exception 'Nonmember accessed company';end if;
end
$$;
rollback;
\echo 'PASS: CRM owner-only visibility, explicit grants and audited legacy recovery'
