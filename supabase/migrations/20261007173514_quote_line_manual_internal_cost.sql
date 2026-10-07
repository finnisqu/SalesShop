-- Store a private total internal cost on ordinary quote lines for margin coverage.

alter table public.quote_lines
  add column if not exists internal_cost numeric;

alter table public.quote_lines
  drop constraint if exists quote_lines_internal_cost_nonnegative;

alter table public.quote_lines
  add constraint quote_lines_internal_cost_nonnegative
  check (internal_cost is null or internal_cost >= 0);

comment on column public.quote_lines.internal_cost is
  'Private SalesShop manual total internal cost for an ordinary quote line. Never customer-facing.';
