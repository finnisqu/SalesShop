-- STAGING ONLY: temporary, deliberately INVALID Gmail credential visibility fixture.
-- Never run this in production. The row is marked 'reauthorize' so the Worker
-- refuses refresh with 409 and NEVER sends fake tokens to Google.
-- Run only against Sales Shop Staging: lztviymnqplloarwywde.
-- Intended for the browser /audit?fixture=saved owner/colleague/outsider checks.
begin;
do $fixture396$
declare
 org_a constant uuid:='68af5ab1-aa83-43c9-b442-93b0f3bb7ca7';
 org_b constant uuid:='1d3ddc50-070f-4bff-9dec-111136e9da14';
 owner_id constant uuid:='86d84443-aa40-4054-ad7c-999e91064a99';
 colleague_id constant uuid:='84a8c429-e48b-45e0-8382-3cf535a28d32';
 outsider_id constant uuid:='8a2d4ebc-758b-4a58-b10a-194f13e9dc18';
begin
 if (select count(*) from auth.users)<>3 or
    (select count(*) from public.organizations)<>2 or
    (select count(*) from public.organization_members)<>3 or
    (select count(*) from public.gmail_oauth_connections396)<>0 then
  raise exception 'Refusing saved fixture: staging tables must have exactly three users, two orgs, three memberships and zero saved credentials';
 end if;
 if not exists(select 1 from public.organizations where id=org_a and name='Gmail 396 — Synthetic Company A') or
    not exists(select 1 from public.organizations where id=org_b and name='Gmail 396 — Synthetic Company B') or
    not exists(select 1 from public.organization_members where organization_id=org_a and user_id=owner_id and role='owner') or
    not exists(select 1 from public.organization_members where organization_id=org_a and user_id=colleague_id and role='salesperson') or
    not exists(select 1 from public.organization_members where organization_id=org_b and user_id=outsider_id and role='owner') then
  raise exception 'Refusing saved fixture: isolated organization/user-role anchors differ';
 end if;
 insert into public.gmail_oauth_connections396(
  organization_id,user_id,mailbox,refresh_ciphertext,refresh_nonce,
  key_version,granted_scope,status
 ) values (
  org_a,owner_id,'gmail396-owner-fixture@example.invalid',
  repeat('A',80),repeat('A',24),1,
  'https://www.googleapis.com/auth/gmail.readonly',
  'reauthorize'
 );
end $fixture396$;
commit;
