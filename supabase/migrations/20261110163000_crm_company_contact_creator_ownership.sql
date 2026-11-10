-- New Company/Person CRM records belong to their creator by default.
-- Existing records remain unassigned; no retroactive ownership assumptions.
-- Apply as additive migration before deploying the matching client.
alter table public.companies add column if not exists owner_user_id uuid;
alter table public.contacts add column if not exists owner_user_id uuid;

-- Set defaults only after creating nullable columns so old records remain NULL.
alter table public.companies alter column owner_user_id set default auth.uid();
alter table public.contacts alter column owner_user_id set default auth.uid();

do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.companies'::regclass
    and conname='companies_owner_member_fkey') then
    alter table public.companies add constraint companies_owner_member_fkey
      foreign key (organization_id,owner_user_id)
      references public.organization_members(organization_id,user_id)
      on delete set null (owner_user_id);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.contacts'::regclass
    and conname='contacts_owner_member_fkey') then
    alter table public.contacts add constraint contacts_owner_member_fkey
      foreign key (organization_id,owner_user_id)
      references public.organization_members(organization_id,user_id)
      on delete set null (owner_user_id);
  end if;
end $$;

create index if not exists companies_org_owner_idx
 on public.companies(organization_id,owner_user_id)
 where owner_user_id is not null;
create index if not exists contacts_org_owner_idx
 on public.contacts(organization_id,owner_user_id)
 where owner_user_id is not null;

comment on column public.companies.owner_user_id is
 'The authenticated member who created this Company. Existing shared Companies are unassigned; default applied only to future inserts.';
comment on column public.contacts.owner_user_id is
 'The authenticated member who created this Person. Existing shared People are unassigned; default applied only to future inserts.';
