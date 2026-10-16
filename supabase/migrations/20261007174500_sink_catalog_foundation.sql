-- Add a dedicated organization sink product catalog.
-- Null means the catalog has not been initialized yet; the app seeds the legacy World Stone sink lineup on first use.

alter table public.organizations
  add column if not exists sink_catalog jsonb;

alter table public.organizations
  drop constraint if exists organizations_sink_catalog_array;

alter table public.organizations
  add constraint organizations_sink_catalog_array
  check (sink_catalog is null or jsonb_typeof(sink_catalog) = 'array');

comment on column public.organizations.sink_catalog is
  'Organization sink product catalog. Sink models contain one or more sellable variants with private cost and customer pricing history.';
