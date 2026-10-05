-- Activity is an append-only-style business breadcrumb stream. References may
-- legitimately outlive a Project, Company, or Contact, so keep these as soft
-- text references rather than foreign keys that erase history on deletion.

begin;

alter table public.activities drop constraint if exists activities_project_fkey;
alter table public.activities drop constraint if exists activities_company_fkey;
alter table public.activities drop constraint if exists activities_contact_fkey;

-- Restore exact historical references from the retained CRM rollback snapshot.
update public.activities activity
set
  project_id = nullif(item.value ->> 'projectId', ''),
  company_id = nullif(item.value ->> 'companyId', ''),
  contact_id = nullif(item.value ->> 'contactId', '')
from public.org_documents doc
cross join lateral jsonb_array_elements(coalesce(doc.document -> 'activities', '[]'::jsonb)) item(value)
where doc.document_key = 'crm'
  and doc.organization_id = activity.organization_id
  and item.value ->> 'id' = activity.id;

commit;
