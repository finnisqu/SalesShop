-- STAGING ONLY: remove EXACTLY the dummy visibility fixture created by
-- 396-gmail-saved-fixture-staging.sql, never a genuine Gmail credential.
-- Never run this script in production.
begin;
delete from public.gmail_oauth_connections396
where organization_id='68af5ab1-aa83-43c9-b442-93b0f3bb7ca7'::uuid
  and user_id='86d84443-aa40-4054-ad7c-999e91064a99'::uuid
  and mailbox='gmail396-owner-fixture@example.invalid'
  and refresh_ciphertext=repeat('A',80)
  and refresh_nonce=repeat('A',24)
  and status='reauthorize';
do $fixture396$
begin
 if exists(select 1 from public.gmail_oauth_connections396 where
  organization_id='68af5ab1-aa83-43c9-b442-93b0f3bb7ca7'::uuid
  and user_id='86d84443-aa40-4054-ad7c-999e91064a99'::uuid) then
  raise exception 'Fixture cleanup refused: owner has an unexpected Gmail row; inspect manually';
 end if;
end $fixture396$;
commit;
