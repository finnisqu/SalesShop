-- SalesShop P2: accepted, auditable, single-owner tenant handoff.
-- Installation is schema-only: NO transfer requests or membership changes.

create unique index organization_exactly_one_owner_at_most
  on public.organization_members(organization_id) where role='owner';

create table private.ownership_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  current_owner_id uuid not null references auth.users(id),
  successor_id uuid not null references auth.users(id),
  former_owner_access text not null default 'remove'
    check (former_owner_access in ('remove','member')),
  status text not null default 'pending'
    check (status in ('pending','accepted','cancelled','declined','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  check (current_owner_id <> successor_id)
);
create unique index one_pending_ownership_transfer_per_org
  on private.ownership_transfer_requests(organization_id) where status='pending';
create index ownership_transfer_successor_lookup
  on private.ownership_transfer_requests(successor_id,created_at desc);
alter table private.ownership_transfer_requests enable row level security;
revoke all on private.ownership_transfer_requests from public,anon,authenticated;

create table private.ownership_transfer_audit (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references private.ownership_transfer_requests(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event text not null check(event in ('requested','cancelled','declined','accepted','expired')),
  actor_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
create index ownership_transfer_audit_org_date
  on private.ownership_transfer_audit(organization_id,occurred_at desc);
alter table private.ownership_transfer_audit enable row level security;
revoke all on private.ownership_transfer_audit from public,anon,authenticated;

-- A transferred-out account must not bootstrap a new dummy workspace simply
-- because it no longer has any memberships. Reinvitation still works because
-- the existing-membership path is checked before this tombstone.
create table private.tenant_offboarded_accounts(
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  offboarded_at timestamptz not null default now()
);
alter table private.tenant_offboarded_accounts enable row level security;
revoke all on private.tenant_offboarded_accounts from public,anon,authenticated;

create function public.request_ownership_transfer(
  target_organization uuid, successor_user_id uuid, former_owner_access text default 'remove'
) returns uuid language plpgsql security definer set search_path=''
as $$
declare actor uuid := auth.uid(); successor_confirmed timestamptz; request_id uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if former_owner_access not in ('remove','member') or former_owner_access is null then
    raise exception 'Choose a valid former Owner access level' using errcode='22023';
  end if;
  if actor=successor_user_id then raise exception 'A different member must accept ownership' using errcode='22023'; end if;
  perform 1 from public.organizations where id=target_organization for update;
  if not found then raise exception 'Workspace not found' using errcode='22023'; end if;
  if not exists (select 1 from public.organization_members where organization_id=target_organization and user_id=actor and role='owner') then
    raise exception 'Only the current Owner can request ownership transfer' using errcode='42501';
  end if;
  if not exists (select 1 from public.organization_members where organization_id=target_organization and user_id=successor_user_id and role in ('admin','member','viewer')) then
    raise exception 'Successor must already belong to this company' using errcode='22023';
  end if;
  select email_confirmed_at into successor_confirmed from auth.users where id=successor_user_id;
  if successor_confirmed is null then
    raise exception 'Successor must verify their login email before accepting' using errcode='22023';
  end if;
  if exists(select 1 from private.platform_operators where user_id=successor_user_id) then
    raise exception 'Platform developers cannot own customer workspaces' using errcode='42501';
  end if;
  -- Reconcile expired requests inside the organization's serialization lock.
  update private.ownership_transfer_requests set status='expired'
    where organization_id=target_organization and status='pending' and expires_at<=now();
  if exists (select 1 from private.ownership_transfer_requests
    where organization_id=target_organization and status='pending') then
    raise exception 'An ownership transfer is already pending' using errcode='23505';
  end if;
  insert into private.ownership_transfer_requests(
    organization_id,current_owner_id,successor_id,former_owner_access
  ) values(target_organization,actor,successor_user_id,former_owner_access)
    returning id into request_id;
  insert into private.ownership_transfer_audit(transfer_id,organization_id,event,actor_id)
    values(request_id,target_organization,'requested',actor);
  return request_id;
end;
$$;

create function public.get_ownership_transfer(target_organization uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); request_record private.ownership_transfer_requests%rowtype;
begin
  if actor is null or not exists(
    select 1 from public.organization_members where organization_id=target_organization and user_id=actor
  ) then
    raise exception 'Workspace membership required' using errcode='42501';
  end if;
  select * into request_record from private.ownership_transfer_requests
    where organization_id=target_organization and status='pending' and expires_at>now()
      and (current_owner_id=actor or successor_id=actor)
    order by created_at desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id',request_record.id,'organizationId',request_record.organization_id,
    'currentOwnerId',request_record.current_owner_id,
    'successorId',request_record.successor_id,
    'formerOwnerAccess',request_record.former_owner_access,
    'createdAt',request_record.created_at,'expiresAt',request_record.expires_at
  );
end;
$$;

create function public.cancel_ownership_transfer(request_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); req private.ownership_transfer_requests%rowtype;
declare result_status text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into req from private.ownership_transfer_requests where id=request_id;
  if not found then raise exception 'Transfer request not found' using errcode='22023'; end if;
  perform 1 from public.organizations where id=req.organization_id for update;
  select * into req from private.ownership_transfer_requests where id=request_id for update;
  if req.status<>'pending' or req.expires_at<=now() then
    raise exception 'Transfer request is no longer pending' using errcode='22023';
  end if;
  if actor<>req.current_owner_id and actor<>req.successor_id then
    raise exception 'Only the participating Owner or successor can cancel' using errcode='42501';
  end if;
  if actor=req.current_owner_id and not exists(
    select 1 from public.organization_members
    where organization_id=req.organization_id and user_id=actor and role='owner'
  ) then raise exception 'Owner authorization changed' using errcode='42501'; end if;
  result_status:=case when actor=req.successor_id then 'declined' else 'cancelled' end;
  update private.ownership_transfer_requests
    set status=result_status, completed_at=now(), completed_by=actor where id=req.id;
  insert into private.ownership_transfer_audit(transfer_id,organization_id,event,actor_id)
    values(req.id,req.organization_id,result_status,actor);
  return true;
end;
$$;

create function public.accept_ownership_transfer(request_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); req private.ownership_transfer_requests%rowtype;
declare current_owners integer;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into req from private.ownership_transfer_requests where id=request_id;
  if not found then raise exception 'Transfer request not found' using errcode='22023'; end if;
  -- All transfer/role mutations take an organization row lock first.
  perform 1 from public.organizations where id=req.organization_id for update;
  select * into req from private.ownership_transfer_requests where id=request_id for update;
  if req.status<>'pending' or req.expires_at<=now() then
    raise exception 'Transfer request expired or unavailable' using errcode='22023';
  end if;
  if req.successor_id<>actor then
    raise exception 'Only the named successor can accept ownership' using errcode='42501';
  end if;
  if not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then
    raise exception 'Verify your account email before accepting' using errcode='42501';
  end if;
  if exists(select 1 from private.platform_operators where user_id=actor) then
    raise exception 'Developer account cannot become a company Owner' using errcode='42501';
  end if;
  select count(*) into current_owners from public.organization_members
    where organization_id=req.organization_id and role='owner';
  if current_owners<>1 or not exists(
    select 1 from public.organization_members where organization_id=req.organization_id
      and user_id=req.current_owner_id and role='owner'
  ) then raise exception 'Existing ownership changed; request a new transfer' using errcode='42501'; end if;
  if not exists(
    select 1 from public.organization_members where organization_id=req.organization_id and user_id=actor
      and role in ('admin','member','viewer')
  ) then raise exception 'Successor no longer belongs to the company' using errcode='42501'; end if;
  -- Transactional: the old Owner must be demoted before promotion due to
  -- the unique Owner index. PostgreSQL rolls all changes back on any error.
  if req.former_owner_access='remove' then
    delete from public.organization_members
      where organization_id=req.organization_id and user_id=req.current_owner_id and role='owner';
    insert into private.tenant_offboarded_accounts(user_id,organization_id)
      values(req.current_owner_id,req.organization_id)
      on conflict(user_id) do update set organization_id=excluded.organization_id,offboarded_at=now();
    update public.profiles set active_organization_id=null
      where user_id=req.current_owner_id and active_organization_id=req.organization_id;
  else
    update public.organization_members set role='member',job_function='salesperson'
      where organization_id=req.organization_id and user_id=req.current_owner_id and role='owner';
  end if;
  update public.organization_members set role='owner',job_function='general'
    where organization_id=req.organization_id and user_id=actor;
  if not found then raise exception 'Successor promotion failed' using errcode='42501'; end if;
  update public.profiles set active_organization_id=req.organization_id where user_id=actor;
  update private.ownership_transfer_requests set status='accepted',completed_by=actor,completed_at=now() where id=req.id;
  insert into private.ownership_transfer_audit(transfer_id,organization_id,event,actor_id,details)
    values(req.id,req.organization_id,'accepted',actor,
      jsonb_build_object('formerOwnerAccess',req.former_owner_access));
  return true;
end;
$$;

-- Avoid auto-creating a brand-new tenant when a former Owner with no other
-- workspace logs back in after leaving. The invitation accept path can restore
-- legitimate future memberships; the membership check runs before this guard.
create or replace function private.ensure_current_workspace(requested_name text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare current_user_id uuid:=auth.uid(); preferred uuid; existing_org uuid; created_org uuid; fallback_name text;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if exists(select 1 from private.platform_operators where user_id=current_user_id) then
    raise exception 'Developer accounts cannot create or enter customer workspaces' using errcode='42501';
  end if;
  select p.active_organization_id into preferred from public.profiles p where p.user_id=current_user_id;
  if preferred is not null and exists(
    select 1 from public.organization_members m where m.organization_id=preferred and m.user_id=current_user_id
  ) then return preferred; end if;
  select m.organization_id into existing_org from public.organization_members m
    where m.user_id=current_user_id order by m.created_at limit 1;
  if existing_org is not null then
    insert into public.profiles(user_id,active_organization_id) values(current_user_id,existing_org)
      on conflict(user_id) do update set active_organization_id=excluded.active_organization_id;
    return existing_org;
  end if;
  if exists(select 1 from private.tenant_offboarded_accounts where user_id=current_user_id) then
    raise exception 'This account has left its previous workspace. Ask to be invited to a company to rejoin.'
      using errcode='42501';
  end if;
  insert into public.profiles(user_id) values(current_user_id) on conflict do nothing;
  select coalesce(nullif(btrim(requested_name),''),
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'shop_name'),''),'My Shop')
    into fallback_name;
  insert into public.organizations(name,created_by)
    values(fallback_name,current_user_id) returning id into created_org;
  insert into public.organization_members(organization_id,user_id,role)
    values(created_org,current_user_id,'owner');
  update public.profiles set active_organization_id=created_org where user_id=current_user_id;
  return created_org;
end;
$$;

revoke all on function public.request_ownership_transfer(uuid,uuid,text) from public,anon;
revoke all on function public.get_ownership_transfer(uuid) from public,anon;
revoke all on function public.cancel_ownership_transfer(uuid) from public,anon;
revoke all on function public.accept_ownership_transfer(uuid) from public,anon;
grant execute on function public.request_ownership_transfer(uuid,uuid,text) to authenticated;
grant execute on function public.get_ownership_transfer(uuid) to authenticated;
grant execute on function public.cancel_ownership_transfer(uuid) to authenticated;
grant execute on function public.accept_ownership_transfer(uuid) to authenticated;
comment on function public.accept_ownership_transfer(uuid)
  is 'Only named, email-verified successor may complete an active transfer; audit and company Owner swap in one transaction.';
