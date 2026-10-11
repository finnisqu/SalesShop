-- Industry job functions layered on top of Owner / Admin / Member / Viewer.
-- Existing Member users default to "general" with unchanged access.
alter table public.organization_members
  add column if not exists job_function text not null default 'general';
alter table public.organization_members
  add constraint organization_members_job_function_check
  check (job_function in ('general','salesperson','estimator','purchasing','project_manager'));

alter table private.team_invitations
  add column if not exists invited_job_function text not null default 'general';
alter table private.team_invitations
  add constraint team_invitations_job_function_check
  check (invited_job_function in ('general','salesperson','estimator','purchasing','project_manager'));

create or replace function private.can_edit_org_area(target_organization uuid, target_area text)
returns boolean language sql stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization
      and m.user_id = auth.uid()
      and (
        m.role in ('owner','admin')
        or (m.role='member' and (
          m.job_function='general'
          or (m.job_function='salesperson' and target_area in ('crm','quotes'))
          or (m.job_function='estimator' and target_area='quotes')
          or (m.job_function='purchasing' and target_area='supplier')
          or (m.job_function='project_manager' and target_area='crm')
        ))
      )
  )
$$;
revoke all on function private.can_edit_org_area(uuid,text) from public;
grant execute on function private.can_edit_org_area(uuid,text) to authenticated;

create or replace function public.can_edit_team_area(target_organization uuid, target_area text)
returns boolean language sql stable security invoker
set search_path to ''
as $$
  select case when target_area in ('crm','quotes','supplier') then
    private.can_edit_org_area(target_organization,target_area) else false end
$$;
revoke all on function public.can_edit_team_area(uuid,text) from public,anon;
grant execute on function public.can_edit_team_area(uuid,text) to authenticated;

create or replace function private.can_edit_org_document(target_organization uuid, target_document_key text)
returns boolean language sql stable security definer
set search_path to ''
as $$
  select case target_document_key
    when 'crm' then private.can_edit_org_area(target_organization,'crm')
    when 'quotes' then private.can_edit_org_area(target_organization,'quotes')
    when 'signatures' then private.can_edit_org_area(target_organization,'quotes')
    else private.is_org_admin(target_organization)
  end
$$;
revoke all on function private.can_edit_org_document(uuid,text) from public;
grant execute on function private.can_edit_org_document(uuid,text) to authenticated;

create or replace function public.set_team_job_function(
  target_organization uuid, member_user_id uuid, new_job_function text
) returns boolean language plpgsql security definer
set search_path to ''
as $$
declare actor_role text; target_role text;
begin
  select role into actor_role from public.organization_members
    where organization_id=target_organization and user_id=auth.uid();
  if actor_role not in ('owner','admin') or actor_role is null then
    raise exception 'Only owners and administrators may change job functions'; end if;
  if member_user_id=auth.uid() then
    raise exception 'You cannot change your own job function'; end if;
  select role into target_role from public.organization_members
    where organization_id=target_organization and user_id=member_user_id for update;
  if target_role is null then raise exception 'Team member not found'; end if;
  if target_role <> 'member' then
    raise exception 'Job functions apply only to members'; end if;
  if new_job_function not in ('general','salesperson','estimator','purchasing','project_manager')
      or new_job_function is null then
    raise exception 'Choose a valid job function'; end if;
  update public.organization_members set job_function=new_job_function
    where organization_id=target_organization and user_id=member_user_id;
  return true;
end $$;
revoke all on function public.set_team_job_function(uuid,uuid,text) from public,anon;
grant execute on function public.set_team_job_function(uuid,uuid,text) to authenticated;

create or replace function public.create_team_invite_with_department(
 target_organization uuid, target_email text, target_role text,
 target_job_function text default 'general'
) returns table(invitation_id uuid,invite_token text,expires_at timestamptz)
language plpgsql security definer set search_path to ''
as $$
declare created record;
begin
  if target_job_function not in ('general','salesperson','estimator','purchasing','project_manager')
    or target_job_function is null then raise exception 'Invalid job function'; end if;
  if target_role <> 'member' and target_job_function <> 'general' then
    raise exception 'Job functions can only be assigned to Member invitations'; end if;
  select * into created from public.create_team_invite(target_organization,target_email,target_role);
  update private.team_invitations i set invited_job_function=target_job_function
    where i.id=created.invitation_id;
  return query select created.invitation_id::uuid, created.invite_token::text, created.expires_at::timestamptz;
end $$;
revoke all on function public.create_team_invite_with_department(uuid,text,text,text) from public,anon;
grant execute on function public.create_team_invite_with_department(uuid,text,text,text) to authenticated;

-- Normalize existing non-member labels, but leave Member assignments untouched.
update public.organization_members set job_function='general' where role <> 'member' and job_function <> 'general';

alter policy "activities_delete_editor" on public."activities" using (private.can_edit_org_area(organization_id,'crm')) ;

alter policy "activities_insert_editor" on public."activities"  with check (private.can_edit_org_area(organization_id,'crm'));

alter policy "activities_update_editor" on public."activities" using (private.can_edit_org_area(organization_id,'crm')) with check (private.can_edit_org_area(organization_id,'crm'));

alter policy "companies_delete_editor" on public."companies" using (private.can_edit_org_area(organization_id,'crm')) ;

alter policy "companies_insert_editor" on public."companies"  with check (private.can_edit_org_area(organization_id,'crm'));

alter policy "companies_update_editor" on public."companies" using (private.can_edit_org_area(organization_id,'crm')) with check (private.can_edit_org_area(organization_id,'crm'));

alter policy "contacts_delete_editor" on public."contacts" using (private.can_edit_org_area(organization_id,'crm')) ;

alter policy "contacts_insert_editor" on public."contacts"  with check (private.can_edit_org_area(organization_id,'crm'));

alter policy "contacts_update_editor" on public."contacts" using (private.can_edit_org_area(organization_id,'crm')) with check (private.can_edit_org_area(organization_id,'crm'));

alter policy "projects_delete_editor" on public."projects" using (private.can_edit_org_area(organization_id,'crm')) ;

alter policy "projects_insert_editor" on public."projects"  with check (private.can_edit_org_area(organization_id,'crm'));

alter policy "projects_update_editor" on public."projects" using (private.can_edit_org_area(organization_id,'crm')) with check (private.can_edit_org_area(organization_id,'crm'));

alter policy "quotes_delete_editor" on public."quotes" using (private.can_edit_org_area(organization_id,'quotes')) ;

alter policy "quotes_insert_editor" on public."quotes"  with check (private.can_edit_org_area(organization_id,'quotes'));

alter policy "quotes_update_editor" on public."quotes" using (private.can_edit_org_area(organization_id,'quotes')) with check (private.can_edit_org_area(organization_id,'quotes'));

alter policy "quote_lines_delete_editor" on public."quote_lines" using (private.can_edit_org_area(organization_id,'quotes')) ;

alter policy "quote_lines_insert_editor" on public."quote_lines"  with check (private.can_edit_org_area(organization_id,'quotes'));

alter policy "quote_lines_update_editor" on public."quote_lines" using (private.can_edit_org_area(organization_id,'quotes')) with check (private.can_edit_org_area(organization_id,'quotes'));

alter policy "quote_sections_delete_editor" on public."quote_sections" using (private.can_edit_org_area(organization_id,'quotes')) ;

alter policy "quote_sections_insert_editor" on public."quote_sections"  with check (private.can_edit_org_area(organization_id,'quotes'));

alter policy "quote_sections_update_editor" on public."quote_sections" using (private.can_edit_org_area(organization_id,'quotes')) with check (private.can_edit_org_area(organization_id,'quotes'));

alter policy "quote_revisions_members_insert" on public."quote_revisions"  with check (private.can_edit_org_area(organization_id,'quotes'));

alter policy "quote_shares_members_delete" on public."quote_shares" using (private.can_edit_org_area(organization_id,'quotes')) ;

alter policy "quote_shares_members_insert" on public."quote_shares"  with check (private.can_edit_org_area(organization_id,'quotes'));

alter policy "quote_shares_members_update" on public."quote_shares" using (private.can_edit_org_area(organization_id,'quotes')) with check (private.can_edit_org_area(organization_id,'quotes'));

alter policy "signatures_members_insert" on public."signatures"  with check (private.can_edit_org_area(organization_id,'quotes'));

alter policy "suppliers_delete_editor" on public."suppliers" using (private.can_edit_org_area(organization_id,'supplier')) ;

alter policy "suppliers_insert_editor" on public."suppliers"  with check (private.can_edit_org_area(organization_id,'supplier'));

alter policy "suppliers_update_editor" on public."suppliers" using (private.can_edit_org_area(organization_id,'supplier')) with check (private.can_edit_org_area(organization_id,'supplier'));

alter policy "supplier_contacts_delete_editor" on public."supplier_contacts" using (private.can_edit_org_area(organization_id,'supplier')) ;

alter policy "supplier_contacts_insert_editor" on public."supplier_contacts"  with check (private.can_edit_org_area(organization_id,'supplier'));

alter policy "supplier_contacts_update_editor" on public."supplier_contacts" using (private.can_edit_org_area(organization_id,'supplier')) with check (private.can_edit_org_area(organization_id,'supplier'));

alter policy "supplier_locations_delete_editor" on public."supplier_locations" using (private.can_edit_org_area(organization_id,'supplier')) ;

alter policy "supplier_locations_insert_editor" on public."supplier_locations"  with check (private.can_edit_org_area(organization_id,'supplier'));

alter policy "supplier_locations_update_editor" on public."supplier_locations" using (private.can_edit_org_area(organization_id,'supplier')) with check (private.can_edit_org_area(organization_id,'supplier'));

alter policy "supplier_rules_delete_editor" on public."supplier_rules" using (private.can_edit_org_area(organization_id,'supplier')) ;

alter policy "supplier_rules_insert_editor" on public."supplier_rules"  with check (private.can_edit_org_area(organization_id,'supplier'));

alter policy "supplier_rules_update_editor" on public."supplier_rules" using (private.can_edit_org_area(organization_id,'supplier')) with check (private.can_edit_org_area(organization_id,'supplier'));

alter policy "supplier_activities_delete_editor" on public."supplier_activities" using (private.can_edit_org_area(organization_id,'supplier')) ;

alter policy "supplier_activities_insert_editor" on public."supplier_activities"  with check (private.can_edit_org_area(organization_id,'supplier'));

alter policy "supplier_activities_update_editor" on public."supplier_activities" using (private.can_edit_org_area(organization_id,'supplier')) with check (private.can_edit_org_area(organization_id,'supplier'));

alter policy "supplier_commitments_delete_editor" on public."supplier_commitments" using (private.can_edit_org_area(organization_id,'supplier')) ;

alter policy "supplier_commitments_insert_editor" on public."supplier_commitments"  with check (private.can_edit_org_area(organization_id,'supplier'));

alter policy "supplier_commitments_update_editor" on public."supplier_commitments" using (private.can_edit_org_area(organization_id,'supplier')) with check (private.can_edit_org_area(organization_id,'supplier'));

alter policy org_documents_insert_members on public.org_documents with check (
  private.can_edit_org_document(organization_id,document_key) and updated_by=auth.uid());
alter policy org_documents_update_members on public.org_documents
  using (private.can_edit_org_document(organization_id,document_key))
  with check (private.can_edit_org_document(organization_id,document_key) and updated_by=auth.uid());

CREATE OR REPLACE FUNCTION public.accept_team_invite(invite_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  verified_email text;
  invite private.team_invitations%rowtype;
begin
  if actor is null or invite_token is null or invite_token !~ '^[0-9a-f]{64}$'
    then raise exception 'Invalid invitation'; end if;
  select lower(email) into verified_email from auth.users
    where id = actor and email_confirmed_at is not null;
  if verified_email is null then raise exception 'Confirm your email address before joining'; end if;
  select * into invite from private.team_invitations
    where token_hash=encode(extensions.digest(invite_token,'sha256'),'hex') for update;
  if not found or invite.revoked_at is not null or invite.accepted_at is not null
    or invite.expires_at <= now() then raise exception 'Invitation expired or no longer valid'; end if;
  if verified_email <> invite.invited_email then
    raise exception 'Invitation belongs to another email address'; end if;

  -- No deletes or transfers of existing memberships, organizations, or user data.
  if not exists (
    select 1 from public.organization_members
    where user_id = actor and organization_id = invite.organization_id
  ) then
    insert into public.organization_members(organization_id,user_id,role,job_function)
      values(invite.organization_id,actor,invite.invited_role,
        case when invite.invited_role='member' then invite.invited_job_function else 'general' end);
  end if;
  insert into public.profiles(user_id,active_organization_id)
    values(actor,invite.organization_id)
    on conflict(user_id) do update set active_organization_id=excluded.active_organization_id;
  update private.team_invitations
    set accepted_by = actor, accepted_at = now() where id=invite.id;
  return invite.organization_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.assign_commercial_document_number(p_organization_id uuid, p_quote_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_quote public.quotes%rowtype;
  v_parent public.quotes%rowtype;
  v_timezone text;
  v_number_date date;
  v_last integer;
  v_existing_max integer;
  v_change_order integer;
  v_number text;
begin
  if auth.uid() is null or not private.can_edit_org_area(p_organization_id,'quotes') then
    raise exception 'Workspace access denied.' using errcode = '42501';
  end if;

  select o.timezone into v_timezone
  from public.organizations o
  where o.id = p_organization_id;

  if not found then
    raise exception 'Workspace not found.' using errcode = 'P0002';
  end if;

  select * into v_quote
  from public.quotes
  where organization_id = p_organization_id and id = p_quote_id
  for update;

  if not found then
    raise exception 'Commercial document not found.' using errcode = 'P0002';
  end if;

  if v_quote.quote_number !~ '^DRAFT-' then
    return jsonb_build_object(
      'quote_number', v_quote.quote_number,
      'change_order_number', v_quote.change_order_number,
      'document_type', v_quote.document_type
    );
  end if;

  if v_quote.document_type = 'change-order' then
    if v_quote.parent_quote_id is null then
      raise exception 'A Change Order must reference its original agreement.' using errcode = '23514';
    end if;

    select * into v_parent
    from public.quotes
    where organization_id = p_organization_id and id = v_quote.parent_quote_id
    for update;

    if not found then
      raise exception 'Original agreement not found.' using errcode = 'P0002';
    end if;

    if v_parent.quote_number ~ '^DRAFT-' then
      raise exception 'The original agreement must be officially numbered before a Change Order can be sent.' using errcode = '23514';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_organization_id::text || ':' || v_quote.parent_quote_id, 0)
    );

    select coalesce(max(q.change_order_number), 0) + 1
      into v_change_order
    from public.quotes q
    where q.organization_id = p_organization_id
      and q.parent_quote_id = v_quote.parent_quote_id
      and q.document_type = 'change-order';

    v_number := v_parent.quote_number || '-CO' || lpad(v_change_order::text, 2, '0');

    update public.quotes
    set quote_number = v_number,
        change_order_number = v_change_order
    where organization_id = p_organization_id and id = p_quote_id;

    return jsonb_build_object(
      'quote_number', v_number,
      'change_order_number', v_change_order,
      'document_type', v_quote.document_type
    );
  end if;

  v_number_date := (now() at time zone v_timezone)::date;

  insert into private.quote_number_counters (organization_id, number_date, last_number)
  values (p_organization_id, v_number_date, 0)
  on conflict (organization_id, number_date) do nothing;

  select last_number into v_last
  from private.quote_number_counters
  where organization_id = p_organization_id and number_date = v_number_date
  for update;

  select coalesce(max(substring(q.quote_number from ('^Q-' || to_char(v_number_date, 'YYYYMMDD') || '-([0-9]+)$'))::integer), 0)
    into v_existing_max
  from public.quotes q
  where q.organization_id = p_organization_id
    and q.quote_number ~ ('^Q-' || to_char(v_number_date, 'YYYYMMDD') || '-[0-9]+$');

  v_last := greatest(coalesce(v_last, 0), coalesce(v_existing_max, 0)) + 1;

  update private.quote_number_counters
  set last_number = v_last
  where organization_id = p_organization_id and number_date = v_number_date;

  v_number := 'Q-' || to_char(v_number_date, 'YYYYMMDD') || '-' || lpad(v_last::text, 3, '0');

  update public.quotes
  set quote_number = v_number
  where organization_id = p_organization_id and id = p_quote_id;

  return jsonb_build_object(
    'quote_number', v_number,
    'change_order_number', null,
    'document_type', v_quote.document_type
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.merge_crm_company_identity(p_organization_id uuid, p_primary_id text, p_duplicate_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_primary public.companies%rowtype;
  v_duplicate public.companies%rowtype;
  v_aliases text[];
  v_exclusions text[];
begin
  if auth.uid() is null or not private.can_edit_org_area(p_organization_id,'crm') then
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

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_exclusions
  from (
    select distinct excluded_id as value
    from unnest(
      coalesce(v_primary.identity_exclusions, '{}'::text[])
      || coalesce(v_duplicate.identity_exclusions, '{}'::text[])
    ) as excluded_id
    where excluded_id <> ''
      and excluded_id <> p_primary_id
      and excluded_id <> p_duplicate_id
  ) exclusions;

  update public.companies
  set aliases = v_aliases,
      identity_exclusions = v_exclusions,
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
$function$
;

CREATE OR REPLACE FUNCTION public.merge_crm_contact_identity(p_organization_id uuid, p_primary_id text, p_duplicate_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_primary public.contacts%rowtype;
  v_duplicate public.contacts%rowtype;
  v_exclusions text[];
begin
  if auth.uid() is null or not private.can_edit_org_area(p_organization_id,'crm') then
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

  if v_primary.company_id is not null
     and v_duplicate.company_id is not null
     and v_primary.company_id <> v_duplicate.company_id then
    raise exception 'These contacts belong to different accounts. Reassign the contact or merge the accounts first.';
  end if;

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_exclusions
  from (
    select distinct excluded_id as value
    from unnest(
      coalesce(v_primary.identity_exclusions, '{}'::text[])
      || coalesce(v_duplicate.identity_exclusions, '{}'::text[])
    ) as excluded_id
    where excluded_id <> ''
      and excluded_id <> p_primary_id
      and excluded_id <> p_duplicate_id
  ) exclusions;

  update public.contacts
  set company_id = coalesce(v_primary.company_id, v_duplicate.company_id),
      email = coalesce(nullif(btrim(v_primary.email), ''), v_duplicate.email),
      phone = coalesce(nullif(btrim(v_primary.phone), ''), v_duplicate.phone),
      title = coalesce(nullif(btrim(v_primary.title), ''), v_duplicate.title),
      identity_exclusions = v_exclusions,
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
$function$
;

CREATE OR REPLACE FUNCTION public.merge_supplier_profiles(p_organization_id uuid, p_source_id text, p_target_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
    declare
      v_source_name text;
      v_target_name text;
    begin
      if p_source_id = p_target_id then
        raise exception 'Source and target supplier must differ.';
      end if;

      if not private.can_edit_org_area(p_organization_id,'supplier') then
        raise exception 'Not authorized for this organization.';
      end if;

      select name into v_source_name
      from public.suppliers
      where organization_id = p_organization_id and id = p_source_id
      for update;

      select name into v_target_name
      from public.suppliers
      where organization_id = p_organization_id and id = p_target_id
      for update;

      if v_source_name is null or v_target_name is null then
        raise exception 'Both suppliers must exist before merging.';
      end if;

      update public.supplier_contacts
        set supplier_id = p_target_id, updated_at = now()
        where organization_id = p_organization_id and supplier_id = p_source_id;

      update public.supplier_locations
        set supplier_id = p_target_id, updated_at = now()
        where organization_id = p_organization_id and supplier_id = p_source_id;

      update public.supplier_rules
        set supplier_id = p_target_id, updated_at = now()
        where organization_id = p_organization_id and supplier_id = p_source_id;

      update public.supplier_activities
        set supplier_id = p_target_id
        where organization_id = p_organization_id and supplier_id = p_source_id;

      update public.supplier_commitments
        set supplier_id = p_target_id, updated_at = now()
        where organization_id = p_organization_id and supplier_id = p_source_id;

      update public.supplier_import_publications
        set supplier = v_target_name,
            source = case
              when jsonb_typeof(source) = 'object'
                then jsonb_set(source, '{supplier}', to_jsonb(v_target_name), true)
              else source
            end
        where organization_id = p_organization_id
          and lower(btrim(supplier)) = lower(btrim(v_source_name));

      update public.organizations
        set stock_materials = coalesce((
          select jsonb_agg(
            case
              when lower(btrim(coalesce(item->>'supplier',''))) = lower(btrim(v_source_name))
                then jsonb_set(item, '{supplier}', to_jsonb(v_target_name), true)
              else item
            end
          )
          from jsonb_array_elements(stock_materials) item
        ), '[]'::jsonb),
        updated_at = now()
        where id = p_organization_id;

      delete from public.suppliers
        where organization_id = p_organization_id and id = p_source_id;
    end;
    $function$
;
