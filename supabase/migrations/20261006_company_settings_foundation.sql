-- Organization-level branding and stock material defaults used by quoting.

begin;

alter table public.organizations
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists logo_url text,
  add column if not exists quote_contact_name text,
  add column if not exists quote_contact_phone text,
  add column if not exists stock_materials jsonb not null default '[]'::jsonb;

alter table public.organizations
  drop constraint if exists organizations_stock_materials_array_check;

alter table public.organizations
  add constraint organizations_stock_materials_array_check
  check (jsonb_typeof(stock_materials) = 'array');

commit;
