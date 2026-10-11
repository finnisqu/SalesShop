-- SalesShop security pass — quote row-scoped RLS.
-- Additive grant table, policy replacement; never reassign or delete existing quotes.
-- Permission model:
-- Owner/Admin: all organization quotes and mutations
-- Member with quote-editing department: create/edit OWN; read own, team, explicit grants
-- Viewer: read only explicit grants; never edit/issue
-- Unassigned legacy: owner/admin until deliberately assigned
-- Customer share links: validated in Edge Functions using service-role, unaffected by RLS.

create table if not exists public.quote_access_grants (
  organization_id uuid not null,
  quote_id text not null,
  user_id uuid not null,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  primary key (organization_id, quote_id, user_id),
  constraint quote_access_grants_quote_fk
    foreign key (organization_id, quote_id)
    references public.quotes (organization_id, id) on delete cascade,
  constraint quote_access_grants_member_fk
    foreign key (organization_id, user_id)
    references public.organization_members (organization_id, user_id) on delete cascade
);
create index if not exists quote_access_grants_by_user
  on public.quote_access_grants (organization_id, user_id);
alter table public.quote_access_grants enable row level security;
grant select, insert, update, delete on public.quote_access_grants to authenticated;
create policy quote_access_grants_read on public.quote_access_grants
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_org_admin(organization_id));
create policy quote_access_grants_insert_admin on public.quote_access_grants
  for insert to authenticated
  with check (private.is_org_admin(organization_id) and granted_by = (select auth.uid()));
create policy quote_access_grants_update_admin on public.quote_access_grants
  for update to authenticated
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id) and granted_by = (select auth.uid()));
create policy quote_access_grants_delete_admin on public.quote_access_grants
  for delete to authenticated
  using (private.is_org_admin(organization_id));

-- SECURITY DEFINER avoids recursive quote RLS, while checking the actual JWT
-- identity and org membership for every invocation. The quote owner field is
-- NEVER inferred from past creation date or shared company membership.
create function private.can_read_quote(p_org uuid, p_quote_id text)
returns boolean language sql stable security definer set search_path = ''
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

create function private.can_edit_quote(p_org uuid, p_quote_id text)
returns boolean language sql stable security definer set search_path = ''
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

create function public.can_access_quote(p_organization_id uuid, p_quote_id text, p_action text default 'read')
returns boolean language sql stable security invoker set search_path=''
as $$
  select case
    when p_action = 'read' then private.can_read_quote(p_organization_id,p_quote_id)
    when p_action = 'edit' then private.can_edit_quote(p_organization_id,p_quote_id)
    else false
  end;
$$;

revoke all on function private.can_read_quote(uuid,text) from public,anon;
revoke all on function private.can_edit_quote(uuid,text) from public,anon;
revoke all on function public.can_access_quote(uuid,text,text) from public,anon;
grant execute on function private.can_read_quote(uuid,text) to authenticated;
grant execute on function private.can_edit_quote(uuid,text) to authenticated;
grant execute on function public.can_access_quote(uuid,text,text) to authenticated;

-- Narrow the existing PERMISSIVE policies (adding policies with OR semantics
-- would leave prior organization-wide reads open).
alter policy quotes_read_org on public.quotes
  using (private.can_read_quote(organization_id,id));
alter policy quotes_insert_editor on public.quotes
  with check (
    private.can_edit_org_area(organization_id,'quotes')
    and (owner_user_id=(select auth.uid()) or private.is_org_admin(organization_id))
  );
alter policy quotes_update_editor on public.quotes
  using (private.can_edit_quote(organization_id,id))
  with check (private.can_edit_quote(organization_id,id));
alter policy quotes_delete_editor on public.quotes
  using (private.can_edit_quote(organization_id,id));

alter policy quote_lines_read_org on public.quote_lines
  using (private.can_read_quote(organization_id,quote_id));
alter policy quote_lines_insert_editor on public.quote_lines
  with check (private.can_edit_quote(organization_id,quote_id));
alter policy quote_lines_update_editor on public.quote_lines
  using (private.can_edit_quote(organization_id,quote_id))
  with check (private.can_edit_quote(organization_id,quote_id));
alter policy quote_lines_delete_editor on public.quote_lines
  using (private.can_edit_quote(organization_id,quote_id));

alter policy quote_sections_read_org on public.quote_sections
  using (private.can_read_quote(organization_id,quote_id));
alter policy quote_sections_insert_editor on public.quote_sections
  with check (private.can_edit_quote(organization_id,quote_id));
alter policy quote_sections_update_editor on public.quote_sections
  using (private.can_edit_quote(organization_id,quote_id))
  with check (private.can_edit_quote(organization_id,quote_id));
alter policy quote_sections_delete_editor on public.quote_sections
  using (private.can_edit_quote(organization_id,quote_id));

alter policy quote_revisions_members_select on public.quote_revisions
  using (private.can_read_quote(organization_id,quote_id));
alter policy quote_revisions_members_insert on public.quote_revisions
  with check (private.can_edit_quote(organization_id,quote_id));

alter policy signatures_members_select on public.signatures
  using (private.can_read_quote(organization_id,quote_id));
alter policy signatures_members_insert on public.signatures
  with check (private.can_edit_quote(organization_id,quote_id));

alter policy quote_shares_members_select on public.quote_shares
  using (private.can_read_quote(organization_id,quote_id));
alter policy quote_shares_members_insert on public.quote_shares
  with check (private.can_edit_quote(organization_id,quote_id)
    and private.can_issue_org_quotes(organization_id));
alter policy quote_shares_members_update on public.quote_shares
  using (private.can_edit_quote(organization_id,quote_id))
  with check (private.can_edit_quote(organization_id,quote_id));
alter policy quote_shares_members_delete on public.quote_shares
  using (private.can_edit_quote(organization_id,quote_id));

-- Legacy JSON document bridge is rollback-only. Do not allow its old
-- organization-wide SELECT policy to expose full quote/signature snapshots.
alter policy org_documents_select_members on public.org_documents
  using (private.is_org_member(organization_id)
    and (document_key not in ('quotes','signatures')
      or private.is_org_admin(organization_id)));
alter policy org_documents_insert_members on public.org_documents
  with check (private.can_edit_org_document(organization_id,document_key)
    and updated_by=(select auth.uid())
    and (document_key not in ('quotes','signatures')
      or private.is_org_admin(organization_id)));
alter policy org_documents_update_members on public.org_documents
  using (private.can_edit_org_document(organization_id,document_key)
    and (document_key not in ('quotes','signatures')
      or private.is_org_admin(organization_id)))
  with check (private.can_edit_org_document(organization_id,document_key)
    and updated_by=(select auth.uid())
    and (document_key not in ('quotes','signatures')
      or private.is_org_admin(organization_id)));

-- Quote activities can contain customer names and amounts. Prevent quote
-- notes from leaking through the CRM activity stream.
alter policy activities_read_org on public.activities
  using (private.is_org_member(organization_id)
    and (
      (quote_id is null and type not like 'quote-%' and type not like 'change-order-%')
      or (quote_id is not null and private.can_read_quote(organization_id,quote_id))
    ));

-- Public RPC for authenticated Edge Functions is intentionally BOOLEAN-only.
comment on function public.can_access_quote(uuid,text,text)
  is 'JWT-scoped boolean quote authorization for privileged quote-share function. No row data returned.';
comment on table public.quote_access_grants
  is 'Owner/admin-created read grants for specific quotes. Viewers need explicit grants.';
