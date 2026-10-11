create or replace function public.preview_team_invite(invite_token text)
returns table (
  organization_name text,
  invite_role text,
  invited_email_hint text,
  expires_at timestamptz,
  invitation_status text,
  current_account_matches boolean
)
language plpgsql security definer
set search_path = ''
as $$
declare
  invitation record;
  actor_email text;
  mailbox_name text;
begin
  -- Tokens are 32 cryptographically random bytes represented in hex.
  if invite_token is null or invite_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  select i.invited_email, i.invited_role, i.expires_at,
    i.accepted_at, i.revoked_at, o.name
  into invitation
  from private.team_invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex');
  if not found then return; end if;

  organization_name := coalesce(nullif(btrim(invitation.name), ''), 'Your team');
  invite_role := invitation.invited_role;
  mailbox_name := split_part(invitation.invited_email, '@', 1);
  invited_email_hint := left(mailbox_name, 1) || '***@' || split_part(invitation.invited_email, '@', 2);
  expires_at := invitation.expires_at;
  invitation_status := case
    when invitation.accepted_at is not null then 'accepted'
    when invitation.revoked_at is not null then 'revoked'
    when invitation.expires_at <= now() then 'expired'
    else 'pending'
  end;

  current_account_matches := null;
  if auth.uid() is not null then
    select lower(email) into actor_email
    from auth.users where id = auth.uid();
    current_account_matches := actor_email is not null
      and actor_email = invitation.invited_email;
  end if;
  return next;
end;
$$;

revoke all on function public.preview_team_invite(text) from public;
grant execute on function public.preview_team_invite(text) to anon, authenticated;
