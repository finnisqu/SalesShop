-- #396: disposable, transaction-rolled-back security audit for the isolated
-- Sales Shop Staging project ONLY. No real Gmail credentials are used.
-- DO NOT run against production or a populated customer database.
begin;
do $$
declare
 org_a uuid;
 org_b uuid;
 owner_id uuid;
 colleague_id uuid;
 outsider_id uuid;
begin
 if (select count(*) from public.gmail_oauth_connections396) <> 0 then
  raise exception 'Refusing synthetic audit: existing Gmail credentials present';
 end if;
 select id into strict org_a from public.organizations
  where name='Gmail 396 — Synthetic Company A';
 select id into strict org_b from public.organizations
  where name='Gmail 396 — Synthetic Company B';
 if org_a=org_b then raise exception 'Fixture organizations must differ'; end if;
 select user_id into strict owner_id from public.organization_members
  where organization_id=org_a and role='owner';
 select user_id into strict colleague_id from public.organization_members
  where organization_id=org_a and role='salesperson';
 select user_id into strict outsider_id from public.organization_members
  where organization_id=org_b and role='owner';

 if (select count(*) from public.organization_members)<>3 or
   (select count(distinct user_id) from public.organization_members)<>3 or
   (select count(*) from public.organization_members where
     (user_id=owner_id and organization_id<>org_a) or
     (user_id=colleague_id and organization_id<>org_a) or
     (user_id=outsider_id and organization_id<>org_b))<>0 then
  raise exception 'Staging fixture membership is not isolated';
 end if;
 if (select count(*) from pg_policies where schemaname='public'
    and tablename='gmail_oauth_connections396')<>0 then
  raise exception 'Gmail credential table unexpectedly exposes an RLS policy';
 end if;
 if not (select relrowsecurity from pg_class
    where oid='public.gmail_oauth_connections396'::regclass) then
  raise exception 'Gmail credential RLS is disabled';
 end if;

 -- Confirm both grants and table-level RLS deny every browser mutation.
 if has_table_privilege('anon','public.gmail_oauth_connections396','select') or
  has_table_privilege('anon','public.gmail_oauth_connections396','insert') or
  has_table_privilege('anon','public.gmail_oauth_connections396','update') or
  has_table_privilege('anon','public.gmail_oauth_connections396','delete') or
  has_table_privilege('authenticated','public.gmail_oauth_connections396','select') or
  has_table_privilege('authenticated','public.gmail_oauth_connections396','insert') or
  has_table_privilege('authenticated','public.gmail_oauth_connections396','update') or
  has_table_privilege('authenticated','public.gmail_oauth_connections396','delete') then
  raise exception 'A browser role has direct credential table permissions';
 end if;
 if not (has_table_privilege('service_role','public.gmail_oauth_connections396','select')
  and has_table_privilege('service_role','public.gmail_oauth_connections396','insert')
  and has_table_privilege('service_role','public.gmail_oauth_connections396','update')
  and has_table_privilege('service_role','public.gmail_oauth_connections396','delete')) then
  raise exception 'Server role cannot manage encrypted Gmail credentials';
 end if;

 -- INSERT is rolled back below even when the audit succeeds.
 insert into public.gmail_oauth_connections396(
  organization_id,user_id,mailbox,refresh_ciphertext,refresh_nonce,
  key_version,granted_scope,status
 ) values (
  org_a,owner_id,'staging-only-396@example.invalid',
  'SYNTHETIC_NOT_A_REAL_GOOGLE_REFRESH_CIPHER',
  'SYNTHETIC_NONCE_396',1,
  'https://www.googleapis.com/auth/gmail.readonly','active'
 );
 if (select count(*) from public.gmail_oauth_connections396)<>1 then
  raise exception 'Synthetic credential insertion failed';
 end if;
end $$;

-- Execute a real SELECT as the browser role, not merely a privilege query.
do $$
declare denied boolean:=false;
begin
 execute 'set local role authenticated';
 begin
  execute 'select count(*) from public.gmail_oauth_connections396';
 exception when insufficient_privilege then
  denied:=true;
 end;
 execute 'reset role';
 if not denied then
  raise exception 'Authenticated role could SELECT synthetic Gmail credentials';
 end if;
end $$;
rollback;
