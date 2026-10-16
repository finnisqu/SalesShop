-- Repair invitations for already provisioned accounts. Preserve existing workspaces.
-- Active workspace is a per-user preference, but a membership check is mandatory.
begin;
alter table public.profiles
  add column if not exists active_organization_id uuid
    references public.organizations(id) on delete set null;

create or replace function private.ensure_current_workspace(requested_name text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  preferred uuid;
  existing_organization_id uuid;
  created_organization_id uuid;
  fallback_name text;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;

  select p.active_organization_id into preferred
    from public.profiles p where p.user_id = current_user_id;
  if preferred is not null and exists (
    select 1 from public.organization_members m
    where m.organization_id = preferred and m.user_id = current_user_id
  ) then return preferred; end if;

  select m.organization_id into existing_organization_id
    from public.organization_members m where m.user_id = current_user_id
    order by m.created_at limit 1;
  if existing_organization_id is not null then
    insert into public.profiles(user_id,active_organization_id)
      values (current_user_id,existing_organization_id)
      on conflict(user_id) do update set active_organization_id = excluded.active_organization_id;
    return existing_organization_id;
  end if;

  insert into public.profiles(user_id) values(current_user_id) on conflict do nothing;
  select coalesce(nullif(btrim(requested_name),''),
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'shop_name'),''),
    'My Shop') into fallback_name;
  insert into public.organizations(name,created_by)
    values (fallback_name,current_user_id) returning id into created_organization_id;
  insert into public.organization_members(organization_id,user_id,role)
    values (created_organization_id,current_user_id,'owner');
  update public.profiles set active_organization_id = created_organization_id
    where user_id = current_user_id;
  return created_organization_id;
end;
$$;

create or replace function public.accept_team_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  verified_email text;
  invite private.team_invitations%rowtype;
begin
  if actor is null or invite_token is null or invite_token !~ '^[0-9a-f]{64}$'
    then raise exception 'Invalid invitation'; end if;
  select lower(email) into verified_email from auth.users
    where id = actor and email_confirmed_at is not null;
  if verified_email is null then raise exception 'Confirm your email address before joining'; end if;
  select * into invite from private.team_invitations
    where token_hash=encode(extensions.digest(invite_token,'sha256'),'hex') for update;
  if not found or invite.revoked_at is not null or invite.accepted_at is not null
    or invite.expires_at <= now() then raise exception 'Invitation expired or no longer valid'; end if;
  if verified_email <> invite.invited_email then
    raise exception 'Invitation belongs to another email address'; end if;

  -- No deletes or transfers of existing memberships, organizations, or user data.
  if not exists (
    select 1 from public.organization_members
    where user_id = actor and organization_id = invite.organization_id
  ) then
    insert into public.organization_members(organization_id,user_id,role)
      values(invite.organization_id,actor,invite.invited_role);
  end if;
  insert into public.profiles(user_id,active_organization_id)
    values(actor,invite.organization_id)
    on conflict(user_id) do update set active_organization_id=excluded.active_organization_id;
  update private.team_invitations
    set accepted_by = actor, accepted_at = now() where id=invite.id;
  return invite.organization_id;
end;
$$;

create or replace function public.select_team_workspace(target_organization uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from public.organization_members
    where organization_id=target_organization and user_id=actor
  ) then raise exception 'Not a member of that workspace'; end if;
  insert into public.profiles(user_id,active_organization_id)
    values(actor,target_organization)
    on conflict(user_id) do update set active_organization_id=excluded.active_organization_id;
  return target_organization;
end;
$$;
revoke all on function public.select_team_workspace(uuid) from public,anon;
grant execute on function public.select_team_workspace(uuid) to authenticated;
commit;
