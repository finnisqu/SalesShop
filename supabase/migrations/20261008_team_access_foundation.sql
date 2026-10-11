-- Team Access v1: one-time, verified-email invitations and server-enforced membership.
-- Only the generated token is returned once; its SHA-256 hash is stored in a private schema.
begin;

create table if not exists private.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_email text not null,
  invited_role text not null check (invited_role in ('member','admin')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at timestamptz
);
create index if not exists team_invitations_org_idx
  on private.team_invitations(organization_id, created_at desc);
alter table private.team_invitations enable row level security;
revoke all on private.team_invitations from public, anon, authenticated;

-- Prevent clients from bypassing administrative role checks with direct DML.
drop policy if exists memberships_insert_admins on public.organization_members;
drop policy if exists memberships_update_admins on public.organization_members;
drop policy if exists memberships_delete_admins on public.organization_members;
revoke insert, update, delete on public.organization_members from authenticated;

create or replace function public.create_team_invite(
  target_organization uuid, target_email text, target_role text default 'member'
) returns table(invitation_id uuid, invite_token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  recipient text := lower(btrim(target_email));
  token_value text;
begin
  select role into actor_role from public.organization_members
    where organization_id = target_organization and user_id = actor;
  if actor_role is null or actor_role not in ('owner','admin') then
    raise exception 'Not authorized to invite members';
  end if;
  if target_role not in ('member','admin') or (target_role = 'admin' and actor_role <> 'owner') then
    raise exception 'Only owners can invite administrators';
  end if;
  if recipient is null or length(recipient) > 254
     or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if exists (
    select 1 from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = target_organization and lower(u.email) = recipient
  ) then raise exception 'That person is already a member'; end if;
  update private.team_invitations i set revoked_at = now()
    where i.organization_id = target_organization and i.invited_email = recipient
      and i.accepted_at is null and i.revoked_at is null;
  token_value := encode(extensions.gen_random_bytes(32), 'hex');
  return query insert into private.team_invitations as i
    (organization_id, invited_email, invited_role, token_hash, invited_by, expires_at)
    values (target_organization, recipient, target_role,
      encode(extensions.digest(token_value, 'sha256'), 'hex'), actor, now() + interval '7 days')
    returning i.id, token_value, i.expires_at;
end; $$;

create or replace function public.list_team_invites(target_organization uuid)
returns table(id uuid, email text, role text, created_at timestamptz, expires_at timestamptz,
  accepted_at timestamptz, revoked_at timestamptz, status text)
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_org_admin(target_organization) then raise exception 'Not authorized'; end if;
  return query select i.id,i.invited_email,i.invited_role,i.created_at,i.expires_at,
    i.accepted_at,i.revoked_at,
    case when i.accepted_at is not null then 'accepted'
         when i.revoked_at is not null then 'revoked'
         when i.expires_at <= now() then 'expired'
         else 'pending' end
    from private.team_invitations i where i.organization_id = target_organization
    order by i.created_at desc limit 100;
end; $$;

create or replace function public.revoke_team_invite(invitation_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare org uuid;
begin
  select organization_id into org from private.team_invitations where id = invitation_id for update;
  if org is null then return false; end if;
  if not private.is_org_admin(org) then raise exception 'Not authorized'; end if;
  update private.team_invitations set revoked_at = now()
    where id = invitation_id and accepted_at is null and revoked_at is null;
  return found;
end; $$;

create or replace function public.accept_team_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  verified_email text;
  invite private.team_invitations%rowtype;
  old_org uuid;
begin
  if actor is null or invite_token is null
     or invite_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invitation'; end if;
  select lower(email) into verified_email from auth.users
    where id = actor and email_confirmed_at is not null;
  if verified_email is null then raise exception 'Confirm your email address before joining'; end if;
  select * into invite from private.team_invitations
    where token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex')
    for update;
  if not found or invite.revoked_at is not null or invite.accepted_at is not null
     or invite.expires_at <= now() then raise exception 'Invitation expired or no longer valid'; end if;
  if verified_email <> invite.invited_email then raise exception 'Invitation belongs to another email address'; end if;
  if exists (select 1 from public.organization_members
    where user_id = actor and organization_id = invite.organization_id) then
    raise exception 'Already a member of this company';
  end if;

  -- Supabase's sign-up trigger creates an empty personal org. Remove ONLY that
  -- unused bootstrap org, never an established account or its sales data.
  for old_org in select organization_id from public.organization_members
    where user_id = actor
  loop
    if not exists (select 1 from public.organizations o
      where o.id = old_org and o.created_by = actor
        and o.name = 'My Shop'
        and o.timezone = 'UTC'
        and o.address is null and o.phone is null and o.email is null
        and o.website is null and o.logo_url is null
        and o.quote_contact_name is null and o.quote_contact_phone is null
        and coalesce(o.stock_materials, '[]'::jsonb) = '[]'::jsonb
        and coalesce(o.sink_catalog, '[]'::jsonb) = '[]'::jsonb)
      or exists (select 1 from public.organization_members m
        where m.organization_id = old_org and m.user_id <> actor)
      or exists (select 1 from public.org_documents d where d.organization_id = old_org)
      or exists (select 1 from public.companies x where x.organization_id = old_org)
      or exists (select 1 from public.contacts x where x.organization_id = old_org)
      or exists (select 1 from public.projects x where x.organization_id = old_org)
      or exists (select 1 from public.activities x where x.organization_id = old_org)
      or exists (select 1 from public.quotes x where x.organization_id = old_org)
      or exists (select 1 from public.signatures x where x.organization_id = old_org)
      or exists (select 1 from public.suppliers x where x.organization_id = old_org)
      or exists (select 1 from public.quote_shares x where x.organization_id = old_org)
      or exists (select 1 from public.quote_lines x where x.organization_id = old_org)
      or exists (select 1 from public.quote_sections x where x.organization_id = old_org)
      or exists (select 1 from public.quote_revisions x where x.organization_id = old_org)
      or exists (select 1 from public.supplier_activities x where x.organization_id = old_org)
      or exists (select 1 from public.supplier_commitments x where x.organization_id = old_org)
      or exists (select 1 from public.supplier_contacts x where x.organization_id = old_org)
      or exists (select 1 from public.supplier_import_publications x where x.organization_id = old_org)
      or exists (select 1 from public.supplier_locations x where x.organization_id = old_org)
      or exists (select 1 from public.supplier_rules x where x.organization_id = old_org)
    then raise exception 'This account already belongs to another active workspace'; end if;
    delete from public.organization_members where organization_id = old_org and user_id = actor;
    delete from public.organizations where id = old_org and created_by = actor;
  end loop;

  insert into public.organization_members(organization_id,user_id,role)
  values(invite.organization_id,actor,invite.invited_role);
  update private.team_invitations set accepted_by = actor, accepted_at = now()
    where id = invite.id;
  return invite.organization_id;
end; $$;

create or replace function public.manage_team_member(
  target_organization uuid, member_user_id uuid,
  next_role text default null, remove_member boolean default false
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid(); actor_role text; old_role text;
begin
  select role into actor_role from public.organization_members
    where organization_id = target_organization and user_id = actor;
  if actor_role is null or actor_role not in ('owner','admin') then
    raise exception 'Only owners and admins can manage team access'; end if;
  select role into old_role from public.organization_members
    where organization_id = target_organization and user_id = member_user_id for update;
  if old_role is null then raise exception 'Member not found'; end if;
  if member_user_id = actor then raise exception 'You cannot change your own access'; end if;
  if old_role = 'owner' then raise exception 'Ownership must be transferred separately'; end if;
  if actor_role = 'admin' and (old_role = 'admin' or next_role = 'admin') then
    raise exception 'Only owners can manage administrators'; end if;
  if remove_member then
    delete from public.organization_members
      where organization_id = target_organization and user_id = member_user_id;
  else
    if next_role not in ('member','admin') then raise exception 'Choose a valid role'; end if;
    update public.organization_members set role = next_role
      where organization_id = target_organization and user_id = member_user_id;
  end if;
  return true;
end; $$;

revoke all on function public.create_team_invite(uuid,text,text) from public, anon;
revoke all on function public.list_team_invites(uuid) from public, anon;
revoke all on function public.revoke_team_invite(uuid) from public, anon;
revoke all on function public.accept_team_invite(text) from public, anon;
revoke all on function public.manage_team_member(uuid,uuid,text,boolean) from public, anon;
grant execute on function public.create_team_invite(uuid,text,text) to authenticated;
grant execute on function public.list_team_invites(uuid) to authenticated;
grant execute on function public.revoke_team_invite(uuid) to authenticated;
grant execute on function public.accept_team_invite(text) to authenticated;
grant execute on function public.manage_team_member(uuid,uuid,text,boolean) to authenticated;
commit;
