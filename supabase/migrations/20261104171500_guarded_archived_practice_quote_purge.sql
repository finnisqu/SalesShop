-- ADMINISTRATIVE PURGE FOR DECLARED TEST-ONLY QUOTES.
-- Release-gated: do not apply to production without isolated role/RLS and
-- signing tests. Nothing in this migration deletes data until explicitly
-- invoked by an authenticated Owner/Admin supplying the precise phrase.
begin;

create or replace function public.purge_archived_practice_quote(
  p_organization_id uuid,
  p_quote_id text,
  p_confirmation text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes%rowtype;
  v_signed boolean;
  v_expected text;
  v_activity_count integer := 0;
  v_signature_count integer := 0;
  v_quote_count integer := 0;
begin
  -- Membership comes from the database, never caller-supplied client roles.
  if (select auth.uid()) is null or not exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  ) then
    raise exception 'Owner or Admin access required';
  end if;

  if not private.can_edit_org_area(p_organization_id, 'quotes')
     or not private.can_edit_org_area(p_organization_id, 'crm') then
    raise exception 'Quotes and CRM editing permissions are required';
  end if;

  select q.*
  into v_quote
  from public.quotes q
  where q.organization_id = p_organization_id and q.id = p_quote_id
  for update;

  if not found then
    raise exception 'Quote not found or unavailable';
  end if;

  -- Never expose another salesperson's private record via this function.
  if v_quote.owner_user_id is not null
    and v_quote.owner_user_id <> (select auth.uid()) then
    raise exception 'Only your own or unassigned legacy quotes are eligible';
  end if;
  if v_quote.archived_at is null then
    raise exception 'Archive the practice quote first';
  end if;

  if exists (
    select 1 from public.quotes q
    where q.organization_id = p_organization_id
      and q.parent_quote_id = p_quote_id
  ) then
    raise exception 'Dependent Change Orders must be resolved first';
  end if;

  -- A signed practice contract is allowed only via an explicitly stronger
  -- confirmation. Include actual signatures, signed share links and revisions
  -- so a stale client cannot falsely treat a signed contract as unsigned.
  select
    v_quote.status = 'Signed'
    or v_quote.signed_at is not null
    or exists (
      select 1 from public.signatures s
      where s.organization_id = p_organization_id and s.quote_id = p_quote_id
    )
    or exists (
      select 1 from public.quote_revisions r
      where r.organization_id = p_organization_id
        and r.quote_id = p_quote_id and r.status = 'Signed'
    )
    or exists (
      select 1 from public.quote_shares sh
      where sh.organization_id = p_organization_id and sh.quote_id = p_quote_id
        and (sh.status = 'signed' or sh.signed_at is not null)
    )
    or exists (
      select 1 from public.activities a
      where a.organization_id = p_organization_id and a.quote_id = p_quote_id
        and a.type in ('quote-signed','change-order-signed')
    )
  into v_signed;

  v_expected :=
    'PURGE ' || (case when v_signed then 'SIGNED ' else '' end) ||
    v_quote.quote_number;

  if p_confirmation is distinct from v_expected then
    raise exception 'Type the exact confirmation phrase for this practice contract';
  end if;

  -- Block any manually recorded quote history. The administrative purge
  -- removes only lifecycle events and quote-originated CRM setup events.
  if exists (
    select 1 from public.activities a
    where a.organization_id = p_organization_id and a.quote_id = p_quote_id
      and not (
        a.type in (
          'quote-created','quote-linked','quote-sent','quote-follow-up',
          'quote-revision-created','quote-viewed','quote-signed',
          'quote-declined','quote-expired',
          'change-order-created','change-order-sent',
          'change-order-revision-created','change-order-viewed',
          'change-order-signed','change-order-declined','change-order-expired'
        )
        or (a.type in ('contact-created','project-created','project-stage-changed')
            and a.metadata ->> 'source' = 'quote')
      )
  ) then
    raise exception 'Unrelated CRM activities must be reviewed before purge';
  end if;

  if exists (
    select 1 from public.activities a
    where a.organization_id = p_organization_id
      and a.quote_id is distinct from p_quote_id
      and exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(a.metadata -> 'relatedRecords') = 'array'
            then a.metadata -> 'relatedRecords'
            else '[]'::jsonb
          end
        ) as linked(value)
        where linked.value ->> 'type' = 'quote'
          and linked.value ->> 'id' = p_quote_id
      )
  ) then
    raise exception 'Other CRM activities still reference this quote';
  end if;

  -- These records cannot be removed by ordinary authenticated RLS. This
  -- narrowly authorized SECURITY DEFINER function performs all writes in
  -- the same transaction, so any failure rolls back every preceding delete.
  delete from public.activities a
  where a.organization_id = p_organization_id and a.quote_id = p_quote_id;
  get diagnostics v_activity_count = row_count;

  delete from public.signatures s
  where s.organization_id = p_organization_id and s.quote_id = p_quote_id;
  get diagnostics v_signature_count = row_count;

  -- CASCADE deletes quote-owned sections, lines, revisions and share links.
  delete from public.quotes q
  where q.organization_id = p_organization_id and q.id = p_quote_id;
  get diagnostics v_quote_count = row_count;
  if v_quote_count <> 1 then
    raise exception 'Quote purge was not confirmed';
  end if;

  return jsonb_build_object(
    'quote_id', p_quote_id,
    'deleted_activities', v_activity_count,
    'deleted_signatures', v_signature_count
  );
end;
$$;

revoke all on function public.purge_archived_practice_quote(uuid,text,text)
  from public, anon;
grant execute on function public.purge_archived_practice_quote(uuid,text,text)
  to authenticated;

comment on function public.purge_archived_practice_quote(uuid,text,text) is
  'Owner/Admin test-only archival purge, including explicit signed practice signatures and generated CRM history; no unrelated CRM cascading.';

commit;
