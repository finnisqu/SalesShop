-- Relationship-level recurring builder volume belongs on the Account, not a fake Project.

begin;

alter table public.companies
  add column if not exists annual_units numeric,
  add column if not exists average_unit_value numeric,
  add column if not exists expected_share_pct numeric;

alter table public.companies
  drop constraint if exists companies_annual_units_nonnegative,
  add constraint companies_annual_units_nonnegative
    check (annual_units is null or annual_units >= 0),
  drop constraint if exists companies_average_unit_value_nonnegative,
  add constraint companies_average_unit_value_nonnegative
    check (average_unit_value is null or average_unit_value >= 0),
  drop constraint if exists companies_expected_share_pct_range,
  add constraint companies_expected_share_pct_range
    check (expected_share_pct is null or (expected_share_pct >= 0 and expected_share_pct <= 100));

comment on column public.companies.annual_units is
  'Estimated recurring homes/units produced by this account per year.';
comment on column public.companies.average_unit_value is
  'Typical SalesShop organization revenue expected per home/unit before share-of-work adjustment.';
comment on column public.companies.expected_share_pct is
  'Expected percent of the account annual unit volume captured by this organization.';

commit;
