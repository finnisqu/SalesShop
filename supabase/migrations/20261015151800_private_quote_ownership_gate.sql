-- Batch 14B STAGED ONLY: private salesperson quote ownership.
-- Requires test-org JWT matrix and a coordinated client release BEFORE applying.
-- Protects quote rows, their children through can_read_quote, grants, and
-- legacy JSON; company/contact/project/activity ownership is a separate gate.
-- Never apply this file automatically as part of front-end deployment.

begin;

-- These helpers intentionally run in a private schema to avoid quote RLS
-- recursion. Authorization always comes from the session's auth.uid() and
-- membership ROWS (never user_metadata or caller-supplied roles).
create or replace function private.can_read_quote(p_org uuid,p_quote_id text)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.quotes q
    join public.organization_members m
      on m.organization_id=q.organization_id
     and m.user_id=(select auth.uid())
    where q.organization_id=p_org and q.id=p_quote_id
      and (
        (q.owner_user_id=(select auth.uid()) and m.role in ('owner','admin','member'))
        or exists (
          select 1 from public.quote_access_grants g
          where g.organization_id=q.organization_id
            and g.quote_id=q.id and g.user_id=(select auth.uid())
        )
        -- Legacy unattributed quotes remain in the admin recovery pool;
        -- no admin automatically reads another named salesperson's draft.
        or (q.owner_user_id is null and m.role in ('owner','admin'))
      )
  );
$$;

create or replace function private.can_edit_quote(p_org uuid,p_quote_id text)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.quotes q
    join public.organization_members m
      on m.organization_id=q.organization_id
     and m.user_id=(select auth.uid())
    where q.organization_id=p_org and q.id=p_quote_id
      and (
        (q.owner_user_id=(select auth.uid())
          and m.role in ('owner','admin','member')
          and private.can_edit_org_area(q.organization_id,'quotes'))
        or (q.owner_user_id is null and m.role in ('owner','admin')
          and private.can_edit_org_area(q.organization_id,'quotes'))
      )
  );
$$;

revoke all on function private.can_read_quote(uuid,text) from public,anon;
revoke all on function private.can_edit_quote(uuid,text) from public,anon;
grant execute on function private.can_read_quote(uuid,text) to authenticated;
grant execute on function private.can_edit_quote(uuid,text) to authenticated;

-- Existing child SELECT/UPDATE policies already refer to these two functions.
-- Retighten the root INSERT: even an admin creates an OWNED quote, not a
-- staff member's document under somebody else's user ID.
alter policy quotes_insert_editor on public.quotes
  with check (
    private.can_edit_org_area(organization_id,'quotes')
    and owner_user_id=(select auth.uid())
  );

-- Existing quote grants are READ-only. An owner can intentionally grant a
-- coworker access. Organization management is not a license to grant itself
-- access to another employee's private quote.
alter policy quote_access_grants_read on public.quote_access_grants
  using (
    (user_id=(select auth.uid()) and private.is_org_member(organization_id))
    or private.can_edit_quote(organization_id,quote_id)
  );
alter policy quote_access_grants_insert_admin on public.quote_access_grants
  with check (
    private.can_edit_quote(organization_id,quote_id)
    and granted_by=(select auth.uid())
  );
alter policy quote_access_grants_update_admin on public.quote_access_grants
  using (private.can_edit_quote(organization_id,quote_id))
  with check (
    private.can_edit_quote(organization_id,quote_id)
    and granted_by=(select auth.uid())
  );
alter policy quote_access_grants_delete_admin on public.quote_access_grants
  using (private.can_edit_quote(organization_id,quote_id));

-- Quote activity INSERT must be as private as quote activity SELECT; otherwise
-- an unrelated salesperson could inject breadcrumbs into someone else's work.
alter policy activities_insert_editor on public.activities
  with check (
    private.can_edit_org_area(organization_id,'crm')
    and (quote_id is null or private.can_edit_quote(organization_id,quote_id))
  );

-- Legacy JSON snapshots remain rollback-only. Prevent admins and members
-- fetching entire quotes/signatures/CRM blobs through old document keys.
alter policy org_documents_select_members on public.org_documents
  using (
    private.is_org_admin(organization_id)
    and document_key not in ('quotes','signatures','crm')
  );
alter policy org_documents_insert_members on public.org_documents
  with check (
    private.is_org_admin(organization_id)
    and updated_by=(select auth.uid())
    and document_key not in ('quotes','signatures','crm')
  );
alter policy org_documents_update_members on public.org_documents
  using (
    private.is_org_admin(organization_id)
    and document_key not in ('quotes','signatures','crm')
  )
  with check (
    private.is_org_admin(organization_id)
    and updated_by=(select auth.uid())
    and document_key not in ('quotes','signatures','crm')
  );
alter policy org_documents_delete_admins on public.org_documents
  using (
    private.is_org_admin(organization_id)
    and document_key not in ('quotes','signatures','crm')
  );

-- Deliberate recovery for LEGACY quotes without any attributed salesperson.
-- Cannot steal or reassign an owned quote, and creates an auditable record.
create table private.quote_recovery_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  quote_id text not null,
  assigned_user_id uuid not null,
  assigned_by uuid not null,
  assigned_at timestamptz not null default now(),
  foreign key (organization_id,quote_id)
    references public.quotes(organization_id,id) on delete cascade,
  foreign key (organization_id,assigned_user_id)
    references public.organization_members(organization_id,user_id)
);
alter table private.quote_recovery_assignments enable row level security;
revoke all on private.quote_recovery_assignments from public,anon,authenticated;

create or replace function public.assign_unowned_quote(
  target_organization uuid,target_quote_id text,target_user_id uuid
) returns boolean language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not exists(
    select 1 from public.organization_members m
    where m.organization_id=target_organization
      and m.user_id=actor and m.role in ('owner','admin')
  ) then
    raise exception 'Only company owners or admins can assign legacy unowned quotes'
      using errcode='42501';
  end if;
  if not exists(
    select 1 from public.organization_members m
    where m.organization_id=target_organization
      and m.user_id=target_user_id and m.role in ('owner','admin','member')
  ) then
    raise exception 'Quote assignee must be a current editor in this company'
      using errcode='42501';
  end if;
  -- Atomic compare-and-set: never transfer an already owned private quote.
  update public.quotes
     set owner_user_id=target_user_id,updated_at=now()
   where organization_id=target_organization
     and id=target_quote_id and owner_user_id is null;
  if not found then
    raise exception 'The quote is owned, missing, or has already been assigned'
      using errcode='42501';
  end if;
  insert into private.quote_recovery_assignments(
    organization_id,quote_id,assigned_user_id,assigned_by
  ) values(target_organization,target_quote_id,target_user_id,actor);
  return true;
end;
$$;
revoke all on function public.assign_unowned_quote(uuid,text,uuid) from public,anon;
grant execute on function public.assign_unowned_quote(uuid,text,uuid) to authenticated;

comment on function public.assign_unowned_quote(uuid,text,uuid)
 is 'Admin-only audited assignment of a legacy unowned quote; cannot take ownership of another salesperson private work.';
comment on function private.can_read_quote(uuid,text)
 is 'Private quote: owner or explicitly granted user; company admins recover only truly unowned legacy rows. No implicit team/admin access.';

commit;
