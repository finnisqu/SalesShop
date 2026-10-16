-- Run after bootstrap + proposed migration on disposable Postgres ONLY.
-- Each block runs with an authenticated role and a scoped simulated JWT
-- identity. Real Supabase Auth token/Edge Function testing remains required.
\set ON_ERROR_STOP on

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$
declare org uuid:='11111111-1111-4111-8111-111111111111';
begin
  if not public.can_access_quote(org,'alice','read') or
     not public.can_access_quote(org,'alice','edit') then
    raise exception 'Alice cannot access her own draft';
  end if;
  if public.can_access_quote(org,'bob','read') or
     public.can_access_quote(org,'bob','edit') or
     public.can_access_quote(org,'unowned','read') then
    raise exception 'Alice can access someone else private or unowned draft';
  end if;
  if (select count(*) from public.quotes where organization_id=org)<>1 then
    raise exception 'Alice direct SELECT RLS shows wrong quotes';
  end if;
  if (select count(*) from public.quote_lines where organization_id=org)<>1 then
    raise exception 'Alice child line RLS lost her own data';
  end if;
  insert into public.quotes(organization_id,id,owner_user_id)
    values(org,'alice-new',auth.uid());
  begin
    insert into public.quotes(organization_id,id,owner_user_id)
      values(org,'alice-spoof','00000000-0000-4000-8000-000000000004');
    raise exception 'Owner-spoofed quote INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.activities(organization_id,id,quote_id)
      values(org,'alice-mutate-bob','bob');
    raise exception 'Alice could inject activity into Bob quote';
  exception when insufficient_privilege then null;
  end;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
do $$
declare org uuid:='11111111-1111-4111-8111-111111111111';
begin
  if not public.can_access_quote(org,'bob','read') or not public.can_access_quote(org,'bob','edit')
    then raise exception 'Bob cannot edit own draft'; end if;
  if not public.can_access_quote(org,'alice','read') or public.can_access_quote(org,'alice','edit')
    then raise exception 'Explicit read grant was improperly elevated'; end if;
  if (select count(*) from public.quote_lines where organization_id=org)<>1
    then raise exception 'Read grant does not flow to child lines'; end if;
  begin
    delete from public.quote_access_grants
      where organization_id=org and quote_id='alice';
    if found then raise exception 'Bob revoked Alice private quote grant'; end if;
  end;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
declare org uuid:='11111111-1111-4111-8111-111111111111';
begin
  if public.can_access_quote(org,'alice','read') or public.can_access_quote(org,'bob','edit')
    then raise exception 'Company owner can read or edit salesperson owned drafts'; end if;
  if not public.can_access_quote(org,'unowned','read') or
     not public.can_access_quote(org,'unowned','edit')
    then raise exception 'Owner lost unattributed legacy recovery scope'; end if;
  if (select count(*) from public.quotes where organization_id=org)<>2
    then raise exception 'Owner direct RLS read escaped or lost recovery scope'; end if;
  if (select count(*) from public.org_documents where organization_id=org and
    document_key in ('quotes','signatures','crm'))<>0 then
    raise exception 'Legacy JSON privacy keys remain readable'; end if;
  begin
    perform private.assign_commercial_document_number(org,'alice');
    raise exception 'Direct privileged numbering bypass unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  if not public.assign_unowned_quote(org,'unowned','00000000-0000-4000-8000-000000000003')
    then raise exception 'Audited recovery failed'; end if;
  if public.can_access_quote(org,'unowned','read')
    then raise exception 'Recovered quote still visible to manager'; end if;
  begin
    perform public.assign_unowned_quote(org,'bob','00000000-0000-4000-8000-000000000001');
    raise exception 'Owner took over Bob private quote';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.assign_unowned_quote(org,'unowned2','00000000-0000-4000-8000-000000000007');
    raise exception 'Manager assigned quote to a non-quote department';
  exception when insufficient_privilege then null;
  end;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$
declare org uuid:='11111111-1111-4111-8111-111111111111';
begin
  if public.can_access_quote(org,'alice','read') or
     public.can_access_quote(org,'bob','edit') then
    raise exception 'Admin implicitly sees another employee draft'; end if;
  if not public.can_access_quote(org,'unowned2','edit') then
    raise exception 'Admin cannot recover truly unowned quote'; end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
do $$
declare org uuid:='11111111-1111-4111-8111-111111111111';
begin
  if not public.can_access_quote(org,'alice','read') or
     public.can_access_quote(org,'alice','edit') then
    raise exception 'Viewer explicit access is not read only'; end if;
  if public.can_access_quote(org,'bob','read') or
     public.can_access_quote(org,'unowned','read') then
    raise exception 'Viewer can inspect unshared documents'; end if;
  begin
    perform public.assign_unowned_quote(org,'unowned','00000000-0000-4000-8000-000000000005');
    raise exception 'Viewer assigned a legacy quote';
  exception when insufficient_privilege then null;
  end;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
do $$
declare org uuid:='11111111-1111-4111-8111-111111111111';
begin
  if public.can_access_quote(org,'alice','read') or
     public.can_access_quote(org,'unowned','edit') then
    raise exception 'Cross-company user gained workspace quote access'; end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000008',true);
do $$
begin
  if public.can_access_quote('11111111-1111-4111-8111-111111111111','alice','read') then
    raise exception 'Nonmember can read granted data'; end if;
end
$$;
rollback;

\echo 'PASS: Batch 14B disposable Postgres ownership/RLS checks'
