alter table public.quote_lines
  add column if not exists sink_reference jsonb;

comment on column public.quote_lines.sink_reference is
  'Private SalesShop sink catalog snapshot/reference for sink quote lines. Public quote shares must not expose this metadata.';
