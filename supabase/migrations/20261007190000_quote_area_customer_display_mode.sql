alter table public.quote_sections
  add column if not exists customer_display_mode text not null default 'detail';

alter table public.quote_sections
  drop constraint if exists quote_sections_customer_display_mode_check;

alter table public.quote_sections
  add constraint quote_sections_customer_display_mode_check
  check (customer_display_mode in ('detail', 'summary'));

comment on column public.quote_sections.customer_display_mode is
  'Controls customer-facing quote rendering for an area: detailed lines or one summarized area total.';
