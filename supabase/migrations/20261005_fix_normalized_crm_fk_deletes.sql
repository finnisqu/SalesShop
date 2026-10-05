-- Composite organization-scoped foreign keys should preserve organization_id
-- when the related entity is removed; only the nullable entity id is cleared.

begin;

alter table public.contacts drop constraint if exists contacts_company_fkey;
alter table public.contacts
  add constraint contacts_company_fkey
  foreign key (organization_id, company_id)
  references public.companies(organization_id, id)
  on delete set null (company_id);

alter table public.projects drop constraint if exists projects_company_fkey;
alter table public.projects
  add constraint projects_company_fkey
  foreign key (organization_id, company_id)
  references public.companies(organization_id, id)
  on delete set null (company_id);

alter table public.activities drop constraint if exists activities_project_fkey;
alter table public.activities
  add constraint activities_project_fkey
  foreign key (organization_id, project_id)
  references public.projects(organization_id, id)
  on delete set null (project_id);

alter table public.activities drop constraint if exists activities_company_fkey;
alter table public.activities
  add constraint activities_company_fkey
  foreign key (organization_id, company_id)
  references public.companies(organization_id, id)
  on delete set null (company_id);

alter table public.activities drop constraint if exists activities_contact_fkey;
alter table public.activities
  add constraint activities_contact_fkey
  foreign key (organization_id, contact_id)
  references public.contacts(organization_id, id)
  on delete set null (contact_id);

commit;
