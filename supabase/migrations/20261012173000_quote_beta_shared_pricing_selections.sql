-- Additive, backward-compatible Quotes Beta pricing/workflow fields.
-- Existing organizations and quotes retain current behavior until opt-in.
alter table public.organizations
  add column if not exists material_level_guide jsonb;
comment on column public.organizations.material_level_guide is
  'Company-wide editable Stock / Builder Level cost bands and historical price snapshots.';

alter table public.quotes
  add column if not exists attach_selections_sheet boolean not null default false;
comment on column public.quotes.attach_selections_sheet is
  'Attach a customer-facing materials and fabrication selections appendix to the quote preview/revision.';
