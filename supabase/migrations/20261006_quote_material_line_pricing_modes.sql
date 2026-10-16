-- Quote material rows and slab-multiplier pricing are first-class line-item concepts.

begin;

alter table public.quote_lines
  drop constraint if exists quote_lines_kind_check;

alter table public.quote_lines
  add constraint quote_lines_kind_check
  check (kind in ('item', 'material', 'allowance', 'discount', 'tax', 'note', 'scope', 'warranty'));

alter table public.quote_lines
  drop constraint if exists quote_lines_pricing_mode_check;

alter table public.quote_lines
  add constraint quote_lines_pricing_mode_check
  check (pricing_mode in ('direct', 'quantity-rate', 'slab-multiplier', 'none'));

commit;
