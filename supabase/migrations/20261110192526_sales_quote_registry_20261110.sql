-- A unified, read-only sales quote index. Native quotes remain authored and
-- versioned in public.quotes; builder-platform submissions remain immutable
-- CRM quote-sent facts in public.activities. Neither is duplicated or
-- coerced into the other's editing model.
-- PostgreSQL 15 security_invoker protects native quote privacy and CRM RLS.
create or replace view public.sales_quote_registry
with (security_invoker = true)
as
select
  q.organization_id,
  'native:' || q.id as record_key,
  'salesshop'::text as origin,
  q.id as native_quote_id,
  null::text as external_activity_id,
  q.project_id,
  q.company_id,
  q.owner_user_id,
  q.title,
  q.quote_number,
  q.status,
  q.document_type,
  q.quote_date::text as sent_date,
  null::numeric as external_amount,
  null::text as external_platform,
  q.created_at as recorded_at,
  q.updated_at
from public.quotes q
where q.archived_at is null

union all

select
  a.organization_id,
  'external:' || a.id as record_key,
  'external'::text as origin,
  null::text as native_quote_id,
  a.id as external_activity_id,
  a.project_id,
  coalesce(a.company_id, p.company_id) as company_id,
  case
    when a.metadata->>'recordedByUserId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (a.metadata->>'recordedByUserId')::uuid else null::uuid
  end as owner_user_id,
  coalesce(nullif(p.name,''),a.summary) as title,
  null::text as quote_number,
  'Sent'::text as status,
  'quote'::text as document_type,
  coalesce(nullif(a.metadata->>'bidSentDate',''),(a.occurred_at at time zone 'UTC')::date::text) as sent_date,
  case when jsonb_typeof(a.metadata->'amount')='number'
    then (a.metadata->>'amount')::numeric else null::numeric
  end as external_amount,
  nullif(a.metadata->>'externalQuoteFormat','') as external_platform,
  a.occurred_at as recorded_at,
  a.occurred_at as updated_at
from public.activities a
left join public.projects p
  on p.organization_id=a.organization_id and p.id=a.project_id
where a.type='quote-sent'
  and a.quote_id is null
  and a.project_id is not null
  and a.metadata->>'externalQuoteSent'='true';

revoke all on public.sales_quote_registry from public, anon;
grant select on public.sales_quote_registry to authenticated;
comment on view public.sales_quote_registry is
 'Unified quote index for native SalesShop documents and genuine external builder-portal submissions. SECURITY INVOKER preserves source table RLS; external rows are read-only derived CRM events.';
