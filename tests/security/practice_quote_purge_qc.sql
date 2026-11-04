-- Disposable PostgreSQL only. Executed AFTER private_quote_rls_bootstrap.sql.
-- Extends the fixture with minimal signed-quote lifecycle tables.
\set ON_ERROR_STOP on

alter table public.quotes
  add column archived_at timestamptz,
  add column signed_at timestamptz,
  add column status text not null default 'Draft';
alter table public.activities
  add column metadata jsonb not null default '{}'::jsonb;

create table public.quote_revisions(
 organization_id uuid not null,
 quote_id text not null,
 revision integer not null,
 status text not null,
 primary key (organization_id,quote_id,revision),
 foreign key (organization_id,quote_id) references public.quotes(organization_id,id)
   on delete cascade
);
create table public.quote_shares(
 organization_id uuid not null,
 id text not null,
 quote_id text not null,
 revision integer not null,
 status text not null,
 signed_at timestamptz,
 primary key (organization_id,id),
 foreign key (organization_id,quote_id,revision)
  references public.quote_revisions(organization_id,quote_id,revision)
  on delete cascade
);
create table public.signatures(
 organization_id uuid not null,
 id text not null,
 quote_id text not null,
 primary key (organization_id,id)
);

-- Compile the newly staged procedure in a fresh disposable database.
\i supabase/migrations/20261104171500_guarded_archived_practice_quote_purge.sql

-- A stored signed test agreement with share link and generated Deal activity.
begin;
update public.quotes
  set quote_number='Q-TEST-SIGNED',status='Signed',
      archived_at=now(),signed_at=now()
  where organization_id='11111111-1111-4111-8111-111111111111'
    and id='unowned';
insert into public.quote_revisions(organization_id,quote_id,revision,status)
values('11111111-1111-4111-8111-111111111111','unowned',0,'Signed');
insert into public.quote_shares(organization_id,id,quote_id,revision,status,signed_at)
values('11111111-1111-4111-8111-111111111111','share-practice','unowned',0,'signed',now());
insert into public.signatures(organization_id,id,quote_id)
values('11111111-1111-4111-8111-111111111111','signature-practice','unowned');
insert into public.activities(organization_id,id,quote_id,type,metadata) values
('11111111-1111-4111-8111-111111111111','practice-sign-event','unowned','quote-signed','{}'),
('11111111-1111-4111-8111-111111111111','practice-stage-event','unowned','project-stage-changed','{"source":"quote"}');

-- Rejected: a Member cannot purge even their own archived test quote.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$
begin
  begin
    perform public.purge_archived_practice_quote(
      '11111111-1111-4111-8111-111111111111','unowned',
      'PURGE SIGNED Q-TEST-SIGNED'
    );
    raise exception 'EXPECTED_FAILURE_NOT_RAISED';
  exception when others then
    if sqlerrm='EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
  end;
end
$$;

-- Rejected: an Owner must supply SIGNED in the phrase.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
begin
  begin
    perform public.purge_archived_practice_quote(
      '11111111-1111-4111-8111-111111111111','unowned',
      'PURGE Q-TEST-SIGNED'
    );
    raise exception 'EXPECTED_FAILURE_NOT_RAISED';
  exception when others then
    if sqlerrm='EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
  end;
end
$$;

-- Accepted: exact phrase by Owner removes all quote-specific records atomically.
select public.purge_archived_practice_quote(
 '11111111-1111-4111-8111-111111111111','unowned',
 'PURGE SIGNED Q-TEST-SIGNED'
);
reset role;

do $$
begin
 if exists(select 1 from public.quotes where id='unowned')
    or exists(select 1 from public.signatures where id='signature-practice')
    or exists(select 1 from public.quote_revisions where quote_id='unowned')
    or exists(select 1 from public.quote_shares where id='share-practice')
    or exists(select 1 from public.activities where quote_id='unowned') then
   raise exception 'Signed test purge left dependent records behind';
 end if;
 if not exists(select 1 from public.quotes where id='alice') then
   raise exception 'Purge touched an unrelated quote';
 end if;
end
$$;
rollback;

-- Rejected: even Owner/Admin may not purge another salesperson's quote.
begin;
update public.quotes
  set quote_number='Q-REAL-OTHER',status='Signed',archived_at=now()
  where organization_id='11111111-1111-4111-8111-111111111111'
    and id='alice';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
begin
  begin
    perform public.purge_archived_practice_quote(
      '11111111-1111-4111-8111-111111111111','alice',
      'PURGE SIGNED Q-REAL-OTHER'
    );
    raise exception 'EXPECTED_FAILURE_NOT_RAISED';
  exception when others then
    if sqlerrm='EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
  end;
end
$$;
rollback;

-- Rejected: unrelated manual CRM history is never part of the cascade.
begin;
update public.quotes
  set quote_number='Q-TEST-WITH-MANUAL',status='Sent',archived_at=now()
  where organization_id='11111111-1111-4111-8111-111111111111'
    and id='unowned2';
insert into public.activities(organization_id,id,quote_id,type)
values('11111111-1111-4111-8111-111111111111','practice-manual','unowned2','manual-touchpoint');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
begin
  begin
    perform public.purge_archived_practice_quote(
      '11111111-1111-4111-8111-111111111111','unowned2',
      'PURGE Q-TEST-WITH-MANUAL'
    );
    raise exception 'EXPECTED_FAILURE_NOT_RAISED';
  exception when others then
    if sqlerrm='EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
  end;
end
$$;
rollback;

\echo 'PASS: Signed-practice purge transaction, role boundary, signature/share cleanup and manual-history guards'
