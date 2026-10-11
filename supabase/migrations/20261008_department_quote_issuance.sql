-- Issuing quotes is distinct from preparing/estimating quotes.
create or replace function private.can_issue_org_quotes(target_organization uuid)
returns boolean language sql stable security definer
set search_path to ''
as $$
 select exists(
  select 1 from public.organization_members m
  where m.organization_id=target_organization and m.user_id=auth.uid()
    and (m.role in ('owner','admin') or
      (m.role='member' and m.job_function in ('general','salesperson')))
 )
$$;
revoke all on function private.can_issue_org_quotes(uuid) from public;
grant execute on function private.can_issue_org_quotes(uuid) to authenticated;

create or replace function public.can_issue_team_quote(target_organization uuid)
returns boolean language sql stable security invoker
set search_path to ''
as $$ select private.can_issue_org_quotes(target_organization) $$;
revoke all on function public.can_issue_team_quote(uuid) from public,anon;
grant execute on function public.can_issue_team_quote(uuid) to authenticated;

-- Fail closed on unauthorized first issuance, including direct REST writes.
create or replace function private.guard_quote_issuance()
returns trigger language plpgsql security invoker
set search_path to ''
as $$
begin
 if (tg_op='INSERT' and (new.status in ('Sent','Viewed','Signed') or new.sent_at is not null))
    or (tg_op='UPDATE' and (
      (new.status in ('Sent','Viewed','Signed') and old.status in ('Draft','Ready'))
      or (new.sent_at is distinct from old.sent_at and new.sent_at is not null)
    ))
 then
   if not private.can_issue_org_quotes(new.organization_id) then
     raise exception 'You can edit estimates but cannot issue customer quotes with this department'
       using errcode='42501';
   end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_quote_issuance() from public,anon;
drop trigger if exists quotes_guard_first_issuance on public.quotes;
create trigger quotes_guard_first_issuance before insert or update on public.quotes
for each row execute function private.guard_quote_issuance();

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
  if auth.uid() is null or not private.can_issue_org_quotes(p_organization_id) then
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