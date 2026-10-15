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

-- Harden the internal SECURITY DEFINER numbering helper too. Its public
-- wrapper already checks quote-level permission, but callers with direct
-- schema EXECUTE privileges must not bypass that check.
CREATE OR REPLACE FUNCTION private.assign_commercial_document_number(p_organization_id uuid, p_quote_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_quote public.quotes%rowtype;
  v_parent public.quotes%rowtype;
  v_timezone text;
  v_number_date date;
  v_last integer;
  v_existing_max integer;
  v_change_order integer;
  v_number text;
begin
  if auth.uid() is null or not private.can_issue_org_quotes(p_organization_id) then
    raise exception 'Workspace access denied.' using errcode = '42501';
  end if;

  -- Defense in depth: the internal numbering helper is executable by
  -- authenticated roles, so it must independently authorize this quote.
  if not private.can_edit_quote(p_organization_id,p_quote_id) then
    raise exception 'This quote is not in your editing scope'
      using errcode='42501';
  end if;

  select o.timezone into v_timezone
  from public.organizations o
  where o.id = p_organization_id;

  if not found then
    raise exception 'Workspace not found.' using errcode = 'P0002';
  end if;

  select * into v_quote
  from public.quotes
  where organization_id = p_organization_id and id = p_quote_id
  for update;

  if not found then
    raise exception 'Commercial document not found.' using errcode = 'P0002';
  end if;

  if v_quote.quote_number !~ '^DRAFT-' then
    return jsonb_build_object(
      'quote_number', v_quote.quote_number,
      'change_order_number', v_quote.change_order_number,
      'document_type', v_quote.document_type
    );
  end if;

  if v_quote.document_type = 'change-order' then
    if v_quote.parent_quote_id is null then
      raise exception 'A Change Order must reference its original agreement.' using errcode = '23514';
    end if;

    select * into v_parent
    from public.quotes
    where organization_id = p_organization_id and id = v_quote.parent_quote_id
    for update;

    if not found then
      raise exception 'Original agreement not found.' using errcode = 'P0002';
    end if;

    if v_parent.quote_number ~ '^DRAFT-' then
      raise exception 'The original agreement must be officially numbered before a Change Order can be sent.' using errcode = '23514';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_organization_id::text || ':' || v_quote.parent_quote_id, 0)
    );

    select coalesce(max(q.change_order_number), 0) + 1
      into v_change_order
    from public.quotes q
    where q.organization_id = p_organization_id
      and q.parent_quote_id = v_quote.parent_quote_id
      and q.document_type = 'change-order';

    v_number := v_parent.quote_number || '-CO' || lpad(v_change_order::text, 2, '0');

    update public.quotes
    set quote_number = v_number,
        change_order_number = v_change_order
    where organization_id = p_organization_id and id = p_quote_id;

    return jsonb_build_object(
      'quote_number', v_number,
      'change_order_number', v_change_order,
      'document_type', v_quote.document_type
    );
  end if;

  v_number_date := (now() at time zone v_timezone)::date;

  insert into private.quote_number_counters (organization_id, number_date, last_number)
  values (p_organization_id, v_number_date, 0)
  on conflict (organization_id, number_date) do nothing;

  select last_number into v_last
  from private.quote_number_counters
  where organization_id = p_organization_id and number_date = v_number_date
  for update;

  select coalesce(max(substring(q.quote_number from ('^Q-' || to_char(v_number_date, 'YYYYMMDD') || '-([0-9]+)
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
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id text not null,
  assigned_user_id uuid not null,
  assigned_by uuid not null,
  assigned_at timestamptz not null default now()
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
      and m.user_id=target_user_id
      and (m.role in ('owner','admin') or
        (m.role='member' and m.job_function in ('general','salesperson','estimator')))
  ) then
    raise exception 'Quote assignee must have Quotes editing permissions in this company'
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
))::integer), 0)
    into v_existing_max
  from public.quotes q
  where q.organization_id = p_organization_id
    and q.quote_number ~ ('^Q-' || to_char(v_number_date, 'YYYYMMDD') || '-[0-9]+
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
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id text not null,
  assigned_user_id uuid not null,
  assigned_by uuid not null,
  assigned_at timestamptz not null default now()
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
      and m.user_id=target_user_id
      and (m.role in ('owner','admin') or
        (m.role='member' and m.job_function in ('general','salesperson','estimator')))
  ) then
    raise exception 'Quote assignee must have Quotes editing permissions in this company'
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
);

  v_last := greatest(coalesce(v_last, 0), coalesce(v_existing_max, 0)) + 1;

  update private.quote_number_counters
  set last_number = v_last
  where organization_id = p_organization_id and number_date = v_number_date;

  v_number := 'Q-' || to_char(v_number_date, 'YYYYMMDD') || '-' || lpad(v_last::text, 3, '0');

  update public.quotes
  set quote_number = v_number
  where organization_id = p_organization_id and id = p_quote_id;

  return jsonb_build_object(
    'quote_number', v_number,
    'change_order_number', null,
    'document_type', v_quote.document_type
  );
end;
$function$


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
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id text not null,
  assigned_user_id uuid not null,
  assigned_by uuid not null,
  assigned_at timestamptz not null default now()
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
      and m.user_id=target_user_id
      and (m.role in ('owner','admin') or
        (m.role='member' and m.job_function in ('general','salesperson','estimator')))
  ) then
    raise exception 'Quote assignee must have Quotes editing permissions in this company'
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
