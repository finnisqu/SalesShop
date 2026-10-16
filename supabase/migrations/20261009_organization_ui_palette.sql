-- Workspace UI palette is shared, optional, and independent of customer-facing branding.
-- Existing admins are the only users authorized by organizations_update_admins to set it.
alter table public.organizations
  add column if not exists ui_palette text not null default 'warm';
alter table public.organizations
  drop constraint if exists organizations_ui_palette_check;
alter table public.organizations
  add constraint organizations_ui_palette_check
  check (ui_palette in ('light','warm','contrast','dark','sage','coastal','autumn','winter','holiday','rainy','seasonal'));
comment on column public.organizations.ui_palette is
  'Shared SalesShop UI palette default; employees can override it locally. Does not affect quote documents.';
