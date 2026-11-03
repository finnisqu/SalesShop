-- Match Activity INSERT permissions to UPDATE / DELETE for private quotes.
-- Only CRM editors can create activity; a linked private quote must also be
-- editable by the actor. No changes to organization read policies.
begin;
drop policy if exists activities_insert_editor on public.activities;
create policy activities_insert_editor on public.activities for insert
to authenticated
with check (
 private.can_edit_org_area(organization_id,'crm'::text)
 and (quote_id is null or private.can_edit_quote(organization_id,quote_id))
);
commit;
