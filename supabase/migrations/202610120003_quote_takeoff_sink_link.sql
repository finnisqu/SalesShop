-- Optional link between a Takeoffs Lite sink selection and its managed
-- quote line. Tenant ownership, RLS, and user access are unchanged.
alter table public.quote_lines
  add column if not exists takeoff_sink_id text;
comment on column public.quote_lines.takeoff_sink_id is
  'Optional Takeoffs Lite sink selection id, used only to sync an explicitly priced sink row.';
