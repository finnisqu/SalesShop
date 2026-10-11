-- All three org_documents keys are legacy rollback snapshots.
-- The active React app uses normalized CRM, Quotes and Signatures tables.
-- CRM snapshots can include quote-related activity metadata, so leaving the
-- 'crm' JSON open would bypass quote-level activity RLS.
alter policy org_documents_select_members on public.org_documents
  using (private.is_org_admin(organization_id));
alter policy org_documents_insert_members on public.org_documents
  with check (private.is_org_admin(organization_id)
    and updated_by=(select auth.uid()));
alter policy org_documents_update_members on public.org_documents
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id)
    and updated_by=(select auth.uid()));
comment on table public.org_documents
  is 'Legacy rollback snapshots only. Normalized CRM/Quote/Signature APIs are authoritative; admin-only to prevent scope bypass.';
