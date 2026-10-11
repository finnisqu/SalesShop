-- Apply straightforward Supabase advisor recommendations for the cloud foundation.

begin;

create index if not exists organizations_created_by_idx
  on public.organizations(created_by);

create index if not exists org_documents_updated_by_idx
  on public.org_documents(updated_by);

alter policy profiles_select_self on public.profiles
  using (user_id = (select auth.uid()));

alter policy profiles_update_self on public.profiles
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy private_documents_select_owner on public.private_documents
  using (owner_id = (select auth.uid()));

alter policy private_documents_insert_owner on public.private_documents
  with check (owner_id = (select auth.uid()));

alter policy private_documents_update_owner on public.private_documents
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

alter policy private_documents_delete_owner on public.private_documents
  using (owner_id = (select auth.uid()));

alter policy org_documents_insert_members on public.org_documents
  with check (
    private.is_org_member(organization_id)
    and updated_by = (select auth.uid())
  );

alter policy org_documents_update_members on public.org_documents
  using (private.is_org_member(organization_id))
  with check (
    private.is_org_member(organization_id)
    and updated_by = (select auth.uid())
  );

commit;
