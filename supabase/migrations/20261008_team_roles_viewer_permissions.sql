-- SalesShop roles foundation: Owner, Admin, Member (editor), Viewer (read-only).
-- Preserve existing memberships; all changes enforced by DB RLS and security-definer RPCs.
alter table public.organization_members drop constraint organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner','admin','member','viewer'));

create or replace function private.is_org_editor(target_organization uuid)
returns boolean language sql stable security definer
set search_path to 'public','auth'
as $$
  select exists (
    select 1 from public.organization_members membership
    where membership.organization_id = target_organization
      and membership.user_id = auth.uid()
      and membership.role in ('owner','admin','member')
  )
$$;
revoke all on function private.is_org_editor(uuid) from public;
grant execute on function private.is_org_editor(uuid) to authenticated;

-- Existing ALL policies give editors read/write. Split them to read-all/write-editor.
do $$
declare row record;
begin
 for row in
   select tablename, policyname
   from pg_policies
   where schemaname='public' and cmd='ALL'
     and qual='private.is_org_member(organization_id)'
     and with_check='private.is_org_member(organization_id)'
     and tablename in ('activities','companies','contacts','projects','quote_lines',
       'quote_sections','quotes','supplier_activities','supplier_commitments',
       'supplier_contacts','supplier_locations','supplier_rules','suppliers')
 loop
   execute format('drop policy %I on public.%I', row.policyname,row.tablename);
   execute format('create policy %I on public.%I for select to authenticated using (private.is_org_member(organization_id))',
     row.tablename||'_read_org',row.tablename);
   execute format('create policy %I on public.%I for insert to authenticated with check (private.is_org_editor(organization_id))',
     row.tablename||'_insert_editor',row.tablename);
   execute format('create policy %I on public.%I for update to authenticated using (private.is_org_editor(organization_id)) with check (private.is_org_editor(organization_id))',
     row.tablename||'_update_editor',row.tablename);
   execute format('create policy %I on public.%I for delete to authenticated using (private.is_org_editor(organization_id))',
     row.tablename||'_delete_editor',row.tablename);
 end loop;
end $$;

alter policy org_documents_insert_members on public.org_documents
  with check (private.is_org_editor(organization_id) and updated_by=auth.uid());
alter policy org_documents_update_members on public.org_documents
  using (private.is_org_editor(organization_id))
  with check (private.is_org_editor(organization_id) and updated_by=auth.uid());

alter policy quote_revisions_members_insert on public.quote_revisions
  with check (private.is_org_editor(organization_id));
alter policy quote_shares_members_insert on public.quote_shares
  with check (private.is_org_editor(organization_id));
alter policy quote_shares_members_update on public.quote_shares
  using (private.is_org_editor(organization_id))
  with check (private.is_org_editor(organization_id));
alter policy quote_shares_members_delete on public.quote_shares
  using (private.is_org_editor(organization_id));
alter policy signatures_members_insert on public.signatures
  with check (private.is_org_editor(organization_id));


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
  if auth.uid() is null or not private.is_org_editor(p_organization_id) then
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

CREATE OR REPLACE FUNCTION public.create_team_invite(target_organization uuid, target_email text, target_role text DEFAULT 'member'::text)
 RETURNS TABLE(invitation_id uuid, invite_token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  actor_role text;
  recipient text := lower(btrim(target_email));
  token_value text;
begin
  select role into actor_role from public.organization_members
    where organization_id = target_organization and user_id = actor;
  if actor_role is null or actor_role not in ('owner','admin') then
    raise exception 'Not authorized to invite members';
  end if;
  if target_role not in ('viewer','member','admin') or (target_role = 'admin' and actor_role <> 'owner') then
    raise exception 'Only owners can invite administrators';
  end if;
  if recipient is null or length(recipient) > 254
     or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if exists (
    select 1 from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = target_organization and lower(u.email) = recipient
  ) then raise exception 'That person is already a member'; end if;
  update private.team_invitations i set revoked_at = now()
    where i.organization_id = target_organization and i.invited_email = recipient
      and i.accepted_at is null and i.revoked_at is null;
  token_value := encode(extensions.gen_random_bytes(32), 'hex');
  return query insert into private.team_invitations as i
    (organization_id, invited_email, invited_role, token_hash, invited_by, expires_at)
    values (target_organization, recipient, target_role,
      encode(extensions.digest(token_value, 'sha256'), 'hex'), actor, now() + interval '7 days')
    returning i.id, token_value, i.expires_at;
end; $function$
;

CREATE OR REPLACE FUNCTION public.manage_team_member(target_organization uuid, member_user_id uuid, next_role text DEFAULT NULL::text, remove_member boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid := auth.uid(); actor_role text; old_role text;
begin
  select role into actor_role from public.organization_members
    where organization_id = target_organization and user_id = actor;
  if actor_role is null or actor_role not in ('owner','admin') then
    raise exception 'Only owners and admins can manage team access'; end if;
  select role into old_role from public.organization_members
    where organization_id = target_organization and user_id = member_user_id for update;
  if old_role is null then raise exception 'Member not found'; end if;
  if member_user_id = actor then raise exception 'You cannot change your own access'; end if;
  if old_role = 'owner' then raise exception 'Ownership must be transferred separately'; end if;
  if actor_role = 'admin' and (old_role = 'admin' or next_role = 'admin') then
    raise exception 'Only owners can manage administrators'; end if;
  if remove_member then
    delete from public.organization_members
      where organization_id = target_organization and user_id = member_user_id;
  else
    if next_role not in ('viewer','member','admin') then raise exception 'Choose a valid role'; end if;
    update public.organization_members set role = next_role
      where organization_id = target_organization and user_id = member_user_id;
  end if;
  return true;
end; $function$
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
  if auth.uid() is null or not private.is_org_editor(p_organization_id) then
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
  if auth.uid() is null or not private.is_org_editor(p_organization_id) then
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

      if not private.is_org_editor(p_organization_id) then
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
