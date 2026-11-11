-- MANUAL EMERGENCY ROLLBACK only; reopens the former organization-wide
-- CRM policy and re-enables the legacy privileged merge RPCs. This is NOT a
-- privacy-preserving rollback. Review thoroughly before use.
-- Keeps CRM owner columns/grants/recovery audit to avoid destroying history.
begin;
alter policy companies_read_org on public.companies using(private.is_org_member(organization_id));
alter policy companies_insert_editor on public.companies with check(private.can_edit_org_area(organization_id,'crm'));
alter policy companies_update_editor on public.companies
 using(private.can_edit_org_area(organization_id,'crm'))
 with check(private.can_edit_org_area(organization_id,'crm'));
alter policy companies_delete_editor on public.companies using(private.can_edit_org_area(organization_id,'crm'));
alter policy contacts_read_org on public.contacts using(private.is_org_member(organization_id));
alter policy contacts_insert_editor on public.contacts with check(private.can_edit_org_area(organization_id,'crm'));
alter policy contacts_update_editor on public.contacts
 using(private.can_edit_org_area(organization_id,'crm'))
 with check(private.can_edit_org_area(organization_id,'crm'));
alter policy contacts_delete_editor on public.contacts using(private.can_edit_org_area(organization_id,'crm'));
alter policy projects_read_org on public.projects using(private.is_org_member(organization_id));
alter policy projects_insert_editor on public.projects with check(private.can_edit_org_area(organization_id,'crm'));
alter policy projects_update_editor on public.projects
 using(private.can_edit_org_area(organization_id,'crm'))
 with check(private.can_edit_org_area(organization_id,'crm'));
alter policy projects_delete_editor on public.projects using(private.can_edit_org_area(organization_id,'crm'));
alter policy activities_read_org on public.activities using(
 private.is_org_member(organization_id)
 and ((quote_id is null and type not like 'quote-%' and type not like 'change-order-%')
   or (quote_id is not null and private.can_read_quote(organization_id,quote_id)))
);
alter policy activities_insert_editor on public.activities with check(private.can_edit_org_area(organization_id,'crm'));
alter policy activities_update_editor on public.activities
 using(private.can_edit_org_area(organization_id,'crm') and (quote_id is null or private.can_edit_quote(organization_id,quote_id)))
 with check(private.can_edit_org_area(organization_id,'crm') and (quote_id is null or private.can_edit_quote(organization_id,quote_id)));
alter policy activities_delete_editor on public.activities
 using(private.can_edit_org_area(organization_id,'crm') and (quote_id is null or private.can_edit_quote(organization_id,quote_id)));
drop trigger if exists companies_owner_immutable on public.companies;
drop trigger if exists contacts_owner_immutable on public.contacts;
drop trigger if exists projects_owner_immutable on public.projects;
drop trigger if exists activities_owner_immutable on public.activities;
-- UNSAFE unless the pre-privacy app and access model were deliberately restored.
grant execute on function public.merge_crm_company_identity(uuid,text,text) to authenticated;
grant execute on function public.merge_crm_contact_identity(uuid,text,text) to authenticated;
commit;
