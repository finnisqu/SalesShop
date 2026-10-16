-- Tighten safe onboarding: only an untouched, automatically provisioned My Shop can be discarded.
begin;
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


commit;
