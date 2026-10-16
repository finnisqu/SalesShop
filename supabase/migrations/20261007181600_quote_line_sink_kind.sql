alter table public.quote_lines
  drop constraint if exists quote_lines_kind_check;

alter table public.quote_lines
  add constraint quote_lines_kind_check
  check (kind in ('item', 'material', 'sink', 'rate', 'allowance', 'discount', 'tax', 'note', 'scope', 'warranty'));
