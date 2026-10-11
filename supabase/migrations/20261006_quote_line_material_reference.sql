alter table public.quote_lines
  add column if not exists material_reference jsonb;

comment on column public.quote_lines.material_reference is
  'Private SalesShop material/pricing reference metadata. Not customer-facing.';
