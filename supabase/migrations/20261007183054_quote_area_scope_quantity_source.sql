alter table public.quote_sections
  add column if not exists scope jsonb;

alter table public.quote_lines
  add column if not exists quantity_source jsonb;

comment on column public.quote_sections.scope is
  'Private SalesShop structured countertop area scope used to drive quote quantities.';

comment on column public.quote_lines.quantity_source is
  'Private SalesShop quantity provenance linking a quote line to an area scope field.';
