-- Give SalesShop commercial documents durable company-wide identity.
-- New drafts use local DRAFT-* placeholders; official numbers are assigned atomically
-- by Supabase on first Send/Share. Change Orders get child numbers from the signed
-- parent agreement and remain separate signature-bearing commercial documents.

begin;

alter table public.quotes
  add column if not exists document_type text not null default 'quote',
  add column if not exists parent_quote_id text,
  add column if not exists change_order_number integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quotes_document_type_check'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_document_type_check
      check (document_type in ('quote', 'pricing-schedule', 'change-order'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'quotes_change_order_number_check'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_change_order_number_check
      check (change_order_number is null or change_order_number > 0);
  end if;
end $$;

create unique index if not exists quotes_organization_official_number_unique
  on public.quotes(organization_id, quote_number)
  where quote_number !~ '^DRAFT-';

create unique index if not exists quotes_change_order_sequence_unique
  on public.quotes(organization_id, parent_quote_id, change_order_number)
  where document_type = 'change-order' and parent_quote_id is not null and change_order_number is not null;

create index if not exists quotes_organization_parent_idx
  on public.quotes(organization_id, parent_quote_id)
  where parent_quote_id is not null;

create table if not exists private.quote_number_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number_date date not null,
  last_number integer not null default 0 check (last_number >= 0),
  primary key (organization_id, number_date)
);

-- Preserve the already-issued legacy numbers as the starting point for each day.
insert into private.quote_number_counters (organization_id, number_date, last_number)
select
  q.organization_id,
  to_date(substring(q.quote_number from '^Q-([0-9]{8})-[0-9]+$'), 'YYYYMMDD'),
  max(substring(q.quote_number from '^Q-[0-9]{8}-([0-9]+)$')::integer)
from public.quotes q
where q.quote_number ~ '^Q-[0-9]{8}-[0-9]+$'
group by q.organization_id, to_date(substring(q.quote_number from '^Q-([0-9]{8})-[0-9]+$'), 'YYYYMMDD')
on conflict (organization_id, number_date) do update
set last_number = greatest(private.quote_number_counters.last_number, excluded.last_number);

-- Change Order events are intentionally separate from Quote events so dashboard
-- quote volume / close-rate metrics do not count contract modifications as new wins.
alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities
  add constraint activities_type_check check (type in (
    'project-created', 'project-stage-changed', 'quote-created', 'quote-linked',
    'quote-sent', 'quote-revision-created', 'quote-viewed', 'quote-signed',
    'quote-declined', 'quote-expired',
    'change-order-created', 'change-order-sent', 'change-order-revision-created',
    'change-order-viewed', 'change-order-signed', 'change-order-declined',
    'change-order-expired', 'contact-created'
  ));

create or replace function private.assign_commercial_document_number(
  p_organization_id uuid,
  p_quote_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes%rowtype;
  v_parent public.quotes%rowtype;
  v_number_date date;
  v_last integer;
  v_existing_max integer;
  v_change_order integer;
  v_number text;
begin
  if auth.uid() is null or not private.is_org_member(p_organization_id) then
    raise exception 'Workspace access denied.' using errcode = '42501';
  end if;

  select * into v_quote
  from public.quotes
  where organization_id = p_organization_id and id = p_quote_id
  for update;

  if not found then
    raise exception 'Commercial document not found.' using errcode = 'P0002';
  end if;

  if v_quote.quote_number !~ '^DRAFT-' then
    return jsonb_build_object(
      'quote_number', v_quote.quote_number,
      'change_order_number', v_quote.change_order_number,
      'document_type', v_quote.document_type
    );
  end if;

  if v_quote.document_type = 'change-order' then
    if v_quote.parent_quote_id is null then
      raise exception 'A Change Order must reference its original agreement.' using errcode = '23514';
    end if;

    select * into v_parent
    from public.quotes
    where organization_id = p_organization_id and id = v_quote.parent_quote_id
    for update;

    if not found then
      raise exception 'Original agreement not found.' using errcode = 'P0002';
    end if;

    if v_parent.quote_number ~ '^DRAFT-' then
      raise exception 'The original agreement must be officially numbered before a Change Order can be sent.' using errcode = '23514';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_organization_id::text || ':' || v_quote.parent_quote_id, 0)
    );

    select coalesce(max(q.change_order_number), 0) + 1
      into v_change_order
    from public.quotes q
    where q.organization_id = p_organization_id
      and q.parent_quote_id = v_quote.parent_quote_id
      and q.document_type = 'change-order';

    v_number := v_parent.quote_number || '-CO' || lpad(v_change_order::text, 2, '0');

    update public.quotes
    set quote_number = v_number,
        change_order_number = v_change_order,
        updated_at = now()
    where organization_id = p_organization_id and id = p_quote_id;

    return jsonb_build_object(
      'quote_number', v_number,
      'change_order_number', v_change_order,
      'document_type', v_quote.document_type
    );
  end if;

  v_number_date := current_date;

  insert into private.quote_number_counters (organization_id, number_date, last_number)
  values (p_organization_id, v_number_date, 0)
  on conflict (organization_id, number_date) do nothing;

  select last_number into v_last
  from private.quote_number_counters
  where organization_id = p_organization_id and number_date = v_number_date
  for update;

  select coalesce(max(substring(q.quote_number from ('^Q-' || to_char(v_number_date, 'YYYYMMDD') || '-([0-9]+)$'))::integer), 0)
    into v_existing_max
  from public.quotes q
  where q.organization_id = p_organization_id
    and q.quote_number ~ ('^Q-' || to_char(v_number_date, 'YYYYMMDD') || '-[0-9]+$');

  v_last := greatest(coalesce(v_last, 0), coalesce(v_existing_max, 0)) + 1;

  update private.quote_number_counters
  set last_number = v_last
  where organization_id = p_organization_id and number_date = v_number_date;

  v_number := 'Q-' || to_char(v_number_date, 'YYYYMMDD') || '-' || lpad(v_last::text, 3, '0');

  update public.quotes
  set quote_number = v_number,
      updated_at = now()
  where organization_id = p_organization_id and id = p_quote_id;

  return jsonb_build_object(
    'quote_number', v_number,
    'change_order_number', null,
    'document_type', v_quote.document_type
  );
end;
$$;

revoke all on function private.assign_commercial_document_number(uuid, text) from public;
grant usage on schema private to authenticated;
grant execute on function private.assign_commercial_document_number(uuid, text) to authenticated;

create or replace function public.assign_commercial_document_number(
  p_organization_id uuid,
  p_quote_id text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.assign_commercial_document_number(p_organization_id, p_quote_id);
$$;

revoke all on function public.assign_commercial_document_number(uuid, text) from public;
revoke all on function public.assign_commercial_document_number(uuid, text) from anon;
grant execute on function public.assign_commercial_document_number(uuid, text) to authenticated;

commit;
