-- Make company Rate Book items first-class quote lines with frozen quote-time references.

begin;

alter table public.quote_lines
  add column if not exists rate_reference jsonb;

comment on column public.quote_lines.rate_reference is
  'Private SalesShop Rate Book source/snapshot metadata for quote-time pricing references.';

alter table public.quote_lines
  drop constraint if exists quote_lines_kind_check;

alter table public.quote_lines
  add constraint quote_lines_kind_check
  check (kind in ('item', 'material', 'rate', 'allowance', 'discount', 'tax', 'note', 'scope', 'warranty'));

commit;
