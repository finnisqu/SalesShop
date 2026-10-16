-- CRM identity hygiene: account aliases and transactional record merges.

begin;

alter table public.companies
  add column if not exists aliases text[] not null default '{}'::text[];

create index if not exists companies_organization_aliases_idx
  on public.companies using gin (aliases);

comment on column public.companies.aliases is
  'Known alternate names for exact CRM identity resolution. Fuzzy matches remain review-only.';

create or replace function public.merge_crm_company_identity(
  p_organization_id uuid,
  p_primary_id text,
  p_duplicate_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_primary public.companies%rowtype;
  v_duplicate public.companies%rowtype;
  v_aliases text[];
begin
  if auth.uid() is null or not private.is_org_member(p_organization_id) then
    raise exception 'Workspace access denied.';
  end if;
  if p_primary_id is null or p_duplicate_id is null or p_primary_id = p_duplicate_id then
    raise exception 'Choose two different account records to merge.';
  end if;

  select * into v_primary
  from public.companies
  where organization_id = p_organization_id and id = p_primary_id
  for update;

  select * into v_duplicate
  from public.companies
  where organization_id = p_organization_id and id = p_duplicate_id
  for update;

  if v_primary.id is null or v_duplicate.id is null then
    raise exception 'One of these account records no longer exists.';
  end if;

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_aliases
  from (
    select distinct btrim(alias_value) as value
    from unnest(
      coalesce(v_primary.aliases, '{}'::text[])
      || coalesce(v_duplicate.aliases, '{}'::text[])
      || array[v_duplicate.name]
    ) as alias_value
    where btrim(alias_value) <> ''
      and lower(regexp_replace(btrim(alias_value), '[^a-zA-Z0-9]+', '', 'g'))
          <> lower(regexp_replace(btrim(v_primary.name), '[^a-zA-Z0-9]+', '', 'g'))
  ) aliases;

  update public.companies
  set aliases = v_aliases,
      annual_units = coalesce(v_primary.annual_units, v_duplicate.annual_units),
      average_unit_value = coalesce(v_primary.average_unit_value, v_duplicate.average_unit_value),
      expected_share_pct = coalesce(v_primary.expected_share_pct, v_duplicate.expected_share_pct),
      updated_at = now()
  where organization_id = p_organization_id and id = p_primary_id;

  update public.contacts
  set company_id = p_primary_id,
      updated_at = now()
  where organization_id = p_organization_id and company_id = p_duplicate_id;

  update public.projects
  set company_id = p_primary_id,
      updated_at = now()
  where organization_id = p_organization_id and company_id = p_duplicate_id;

  update public.activities
  set company_id = p_primary_id
  where organization_id = p_organization_id and company_id = p_duplicate_id;

  update public.quotes
  set company_id = p_primary_id,
      company_name = case when status in ('Draft', 'Ready') then v_primary.name else company_name end,
      updated_at = now()
  where organization_id = p_organization_id and company_id = p_duplicate_id;

  update public.signatures
  set company_id = p_primary_id
  where organization_id = p_organization_id and company_id = p_duplicate_id;

  delete from public.companies
  where organization_id = p_organization_id and id = p_duplicate_id;
end;
$$;

create or replace function public.merge_crm_contact_identity(
  p_organization_id uuid,
  p_primary_id text,
  p_duplicate_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_primary public.contacts%rowtype;
  v_duplicate public.contacts%rowtype;
begin
  if auth.uid() is null or not private.is_org_member(p_organization_id) then
    raise exception 'Workspace access denied.';
  end if;
  if p_primary_id is null or p_duplicate_id is null or p_primary_id = p_duplicate_id then
    raise exception 'Choose two different contact records to merge.';
  end if;

  select * into v_primary
  from public.contacts
  where organization_id = p_organization_id and id = p_primary_id
  for update;

  select * into v_duplicate
  from public.contacts
  where organization_id = p_organization_id and id = p_duplicate_id
  for update;

  if v_primary.id is null or v_duplicate.id is null then
    raise exception 'One of these contact records no longer exists.';
  end if;

  update public.contacts
  set company_id = coalesce(v_primary.company_id, v_duplicate.company_id),
      email = coalesce(nullif(btrim(v_primary.email), ''), v_duplicate.email),
      phone = coalesce(nullif(btrim(v_primary.phone), ''), v_duplicate.phone),
      title = coalesce(nullif(btrim(v_primary.title), ''), v_duplicate.title),
      updated_at = now()
  where organization_id = p_organization_id and id = p_primary_id;

  select * into v_primary
  from public.contacts
  where organization_id = p_organization_id and id = p_primary_id;

  update public.activities
  set contact_id = p_primary_id
  where organization_id = p_organization_id and contact_id = p_duplicate_id;

  update public.quotes
  set contact_id = p_primary_id,
      contact_name = case when status in ('Draft', 'Ready') then v_primary.name else contact_name end,
      contact_email = case when status in ('Draft', 'Ready') then coalesce(v_primary.email, contact_email) else contact_email end,
      updated_at = now()
  where organization_id = p_organization_id and contact_id = p_duplicate_id;

  update public.signatures
  set contact_id = p_primary_id
  where organization_id = p_organization_id and contact_id = p_duplicate_id;

  delete from public.contacts
  where organization_id = p_organization_id and id = p_duplicate_id;
end;
$$;

revoke all on function public.merge_crm_company_identity(uuid, text, text) from public;
revoke all on function public.merge_crm_contact_identity(uuid, text, text) from public;
grant execute on function public.merge_crm_company_identity(uuid, text, text) to authenticated;
grant execute on function public.merge_crm_contact_identity(uuid, text, text) to authenticated;

commit;
