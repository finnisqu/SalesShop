-- Verify real RLS evaluations under the authenticated DB role and simulated
-- JWT IDs; this is an isolated schema, not deployed Supabase.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
insert into public.deal_contact_roles(organization_id,deal_id,contact_id,owner_user_id,role)
 values ('11111111-1111-4111-8111-111111111111','deal-1','contact-a',
         '00000000-0000-4000-8000-000000000003','Estimator');
do $$
declare n integer;
begin
 select count(*) into n from public.deal_contact_roles;
 if n<>1 then raise exception 'Alice cannot read her one owned role';end if;
 begin
  insert into public.deal_contact_roles(organization_id,deal_id,contact_id,owner_user_id,role)
    values('11111111-1111-4111-8111-111111111111','deal-1','contact-b',
           '00000000-0000-4000-8000-000000000003','Buyer');
  raise exception 'Alice assigned a contact only linked to Bob quote';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.deal_contact_roles(organization_id,deal_id,contact_id,owner_user_id,role)
    values('11111111-1111-4111-8111-111111111111','deal-1','contact-a',
           '00000000-0000-4000-8000-000000000004','Buyer');
  raise exception 'Alice spoofed Bob owner ID';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.deal_contact_roles(organization_id,deal_id,contact_id,owner_user_id,role)
    values('11111111-1111-4111-8111-111111111111','deal-2','contact-a',
           '00000000-0000-4000-8000-000000000003','Buyer');
  raise exception 'Alice assigned role on unrelated deal';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;

-- Simulate committed rows owned separately by Alice and Bob, then attempt
-- cross-user reads and mutation through RLS as each identity.
insert into public.deal_contact_roles(organization_id,deal_id,contact_id,owner_user_id,role)
values
 ('11111111-1111-4111-8111-111111111111','deal-1','contact-a','00000000-0000-4000-8000-000000000003','Estimator'),
 ('11111111-1111-4111-8111-111111111111','deal-1','contact-b','00000000-0000-4000-8000-000000000004','Buyer');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
do $$
begin
 if (select count(*) from public.deal_contact_roles)<>1 then
   raise exception 'Bob can read Alice private role'; end if;
 if (select role from public.deal_contact_roles where contact_id='contact-b')<>'Buyer' then
   raise exception 'Bob lost his role'; end if;
 update public.deal_contact_roles set role='Decision maker' where contact_id='contact-a';
 if found then raise exception 'Bob edited Alice row'; end if;
 delete from public.deal_contact_roles where contact_id='contact-a';
 if found then raise exception 'Bob deleted Alice row'; end if;
end $$;
rollback;

-- Owner and Admin may administer the organization but cannot query private
-- roles merely by having a management title.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from public.deal_contact_roles)<>0 then
   raise exception 'Owner automatically reads employee role notes';end if;
end $$;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
 if (select count(*) from public.deal_contact_roles)<>0 then
   raise exception 'Admin automatically reads employee role notes';end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
do $$ begin
 if (select count(*) from public.deal_contact_roles)<>0 then
   raise exception 'Viewer reads salesperson role notes';end if;
 begin
  insert into public.deal_contact_roles(organization_id,deal_id,contact_id,owner_user_id,role)
    values('11111111-1111-4111-8111-111111111111','deal-1','contact-c',
           '00000000-0000-4000-8000-000000000005','Buyer');
  raise exception 'Viewer can create role despite own quote';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
do $$ begin
 if (select count(*) from public.deal_contact_roles)<>0 then
   raise exception 'Outsider can read role notes';end if;
end $$;
rollback;

-- A quote reassignment/relink must automatically end eligibility without
-- exposing stale role rows.
begin;
update public.quotes set contact_id='contact-c' where id='a-owned';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$ begin
 if (select count(*) from public.deal_contact_roles)<>0 then
   raise exception 'Old quote link still permits role SELECT';end if;
end $$;
rollback;

\echo 'PASS: private Deal contact roles RLS under simulated member, owner, admin, viewer and outsider identities'
