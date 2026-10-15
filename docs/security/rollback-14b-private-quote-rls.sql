-- Manual rollback for STAGED Batch 14B ONLY.
-- Run after checking current policy definitions against production. This
-- restores the exact broad quote/CRM access model observed 2026-10-15.
-- It DOES NOT undo quote ownership assignments already performed.
begin;

create or replace function private.can_read_quote(p_org uuid,p_quote_id text)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.quotes q
    join public.organization_members m
      on m.organization_id=q.organization_id and m.user_id=(select auth.uid())
    where q.organization_id=p_org and q.id=p_quote_id
      and (
        m.role in ('owner','admin')
        or q.owner_user_id=(select auth.uid())
        or exists (
          select 1 from public.quote_access_grants g
          where g.organization_id=q.organization_id and g.quote_id=q.id
            and g.user_id=(select auth.uid())
        )
        or (m.role='member' and q.team_id is not null and exists (
          select 1 from public.sales_team_members tm
          where tm.organization_id=q.organization_id
            and tm.team_id=q.team_id and tm.user_id=(select auth.uid())
        ))
      )
  );
$$;

create or replace function private.can_edit_quote(p_org uuid,p_quote_id text)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.quotes q
    join public.organization_members m
      on m.organization_id=q.organization_id and m.user_id=(select auth.uid())
    where q.organization_id=p_org and q.id=p_quote_id
      and (m.role in ('owner','admin')
        or (m.role='member' and q.owner_user_id=(select auth.uid())
          and private.can_edit_org_area(q.organization_id,'quotes')))
  );
$$;

alter policy quotes_insert_editor on public.quotes
  with check (
    private.can_edit_org_area(organization_id,'quotes')
    and (owner_user_id=(select auth.uid()) or private.is_org_admin(organization_id))
  );
alter policy quote_access_grants_read on public.quote_access_grants
  using (user_id=(select auth.uid()) or private.is_org_admin(organization_id));
alter policy quote_access_grants_insert_admin on public.quote_access_grants
  with check (private.is_org_admin(organization_id) and granted_by=(select auth.uid()));
alter policy quote_access_grants_update_admin on public.quote_access_grants
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id) and granted_by=(select auth.uid()));
alter policy quote_access_grants_delete_admin on public.quote_access_grants
  using (private.is_org_admin(organization_id));
alter policy activities_insert_editor on public.activities
  with check (private.can_edit_org_area(organization_id,'crm'));

alter policy org_documents_select_members on public.org_documents
  using (private.is_org_admin(organization_id));
alter policy org_documents_insert_members on public.org_documents
  with check (private.is_org_admin(organization_id) and updated_by=(select auth.uid()));
alter policy org_documents_update_members on public.org_documents
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id) and updated_by=(select auth.uid()));
alter policy org_documents_delete_admins on public.org_documents
  using (private.is_org_admin(organization_id));

drop function if exists public.assign_unowned_quote(uuid,text,uuid);
-- Preserve audit evidence unless a data/privacy owner explicitly authorizes
-- purging it later. It has no authenticated permissions.
commit;
