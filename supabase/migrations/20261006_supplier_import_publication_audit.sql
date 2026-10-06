-- Durable, transactional supplier-price publishing for the SalesShop Material Catalog.

begin;

create table if not exists public.supplier_import_publications (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_session_id text not null,
  supplier text not null,
  brand text,
  source_file_name text not null,
  source_file_size bigint,
  page_count integer,
  price_list_label text,
  effective_date date,
  parser_id text not null,
  parser_version integer not null,
  source jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  changes jsonb not null default '[]'::jsonb,
  published_candidate_ids jsonb not null default '[]'::jsonb,
  published_by uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz not null default now(),
  constraint supplier_import_publications_source_object_check check (jsonb_typeof(source) = 'object'),
  constraint supplier_import_publications_summary_object_check check (jsonb_typeof(summary) = 'object'),
  constraint supplier_import_publications_changes_array_check check (jsonb_typeof(changes) = 'array'),
  constraint supplier_import_publications_candidate_ids_array_check check (jsonb_typeof(published_candidate_ids) = 'array'),
  constraint supplier_import_publications_source_session_unique unique (organization_id, source_session_id)
);

create index if not exists supplier_import_publications_org_published_idx
  on public.supplier_import_publications (organization_id, published_at desc);

comment on table public.supplier_import_publications is
  'Durable management audit trail for supplier price sheets published into the organization Material Catalog.';
comment on column public.supplier_import_publications.changes is
  'Per-candidate before/after publishing audit. Supplier rules remain reference-only and do not create catalog variants.';

alter table public.supplier_import_publications enable row level security;

drop policy if exists supplier_import_publications_select_members on public.supplier_import_publications;
create policy supplier_import_publications_select_members
  on public.supplier_import_publications for select
  to authenticated
  using (private.is_org_member(organization_id));

grant select on public.supplier_import_publications to authenticated;

create or replace function public.publish_supplier_import(
  p_publication_id uuid,
  p_organization_id uuid,
  p_source_session_id text,
  p_expected_stock_materials jsonb,
  p_updated_stock_materials jsonb,
  p_source jsonb,
  p_summary jsonb,
  p_changes jsonb,
  p_published_candidate_ids jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  current_materials jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_org_admin(p_organization_id) then
    raise exception 'Organization admin access required';
  end if;

  if jsonb_typeof(p_expected_stock_materials) <> 'array'
     or jsonb_typeof(p_updated_stock_materials) <> 'array'
     or jsonb_typeof(p_changes) <> 'array'
     or jsonb_typeof(p_published_candidate_ids) <> 'array'
     or jsonb_typeof(p_source) <> 'object'
     or jsonb_typeof(p_summary) <> 'object' then
    raise exception 'Invalid supplier import payload';
  end if;

  select stock_materials
    into current_materials
  from public.organizations
  where id = p_organization_id
  for update;

  if current_materials is null then
    raise exception 'Organization not found';
  end if;

  if current_materials <> p_expected_stock_materials then
    raise exception 'Material Catalog changed since this import was staged. Refresh Rates and stage the supplier sheet again before publishing.';
  end if;

  if exists (
    select 1
    from public.supplier_import_publications publication
    where publication.organization_id = p_organization_id
      and publication.source_session_id = p_source_session_id
  ) then
    raise exception 'This staged supplier import has already been published.';
  end if;

  update public.organizations
  set stock_materials = p_updated_stock_materials,
      updated_at = now()
  where id = p_organization_id;

  insert into public.supplier_import_publications (
    id, organization_id, source_session_id, supplier, brand, source_file_name,
    source_file_size, page_count, price_list_label, effective_date, parser_id,
    parser_version, source, summary, changes, published_candidate_ids, published_by
  )
  values (
    p_publication_id,
    p_organization_id,
    p_source_session_id,
    coalesce(nullif(btrim(p_source ->> 'supplier'), ''), 'Unknown supplier'),
    nullif(btrim(p_source ->> 'brand'), ''),
    coalesce(nullif(btrim(p_source ->> 'fileName'), ''), 'Unknown file'),
    nullif(p_source ->> 'fileSize', '')::bigint,
    nullif(p_source ->> 'pageCount', '')::integer,
    nullif(btrim(p_source ->> 'priceListLabel'), ''),
    nullif(p_source ->> 'effectiveDate', '')::date,
    coalesce(nullif(btrim(p_source ->> 'parserId'), ''), 'unknown'),
    coalesce(nullif(p_source ->> 'parserVersion', '')::integer, 1),
    p_source,
    p_summary,
    p_changes,
    p_published_candidate_ids,
    auth.uid()
  );

  return p_publication_id;
end;
$$;

revoke all on function public.publish_supplier_import(uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.publish_supplier_import(uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

commit;
