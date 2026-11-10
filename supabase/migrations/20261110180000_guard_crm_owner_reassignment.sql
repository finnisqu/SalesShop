-- Admin-only reassignment for normalized Company and Person owners.
-- Existing records and general CRM edit policies remain unchanged.
-- The trigger prevents ordinary editors from reassigning through a direct REST
-- update, while RLS still governs whether a row may be modified at all.
create or replace function private.enforce_crm_record_owner_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  manager boolean := false;
begin
  -- Service-side maintenance without an end-user JWT is still governed by
  -- its database role. Authenticated REST requests always have an actor.
  if actor is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.owner_user_id is null then
      new.owner_user_id := actor;
      return new;
    end if;
    if new.owner_user_id = actor then return new; end if;
  elsif new.owner_user_id is not distinct from old.owner_user_id then
    return new;
  end if;

  select exists(
    select 1 from public.organization_members m
    where m.organization_id = new.organization_id
      and m.user_id = actor
      and m.role in ('owner', 'admin')
  ) into manager;
  if not manager then
    raise exception 'Only organization owners and admins can reassign CRM records.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists companies_owner_reassignment_guard on public.companies;
create trigger companies_owner_reassignment_guard
before insert or update of owner_user_id on public.companies
for each row execute function private.enforce_crm_record_owner_change();

drop trigger if exists contacts_owner_reassignment_guard on public.contacts;
create trigger contacts_owner_reassignment_guard
before insert or update of owner_user_id on public.contacts
for each row execute function private.enforce_crm_record_owner_change();

comment on function private.enforce_crm_record_owner_change() is
 'Enforce creator attribution on new Companies/People and restrict subsequent ownership changes to organization owners/admins. General CRM editors keep their normal permissions.';
