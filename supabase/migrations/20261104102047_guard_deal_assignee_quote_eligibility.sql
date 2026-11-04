-- Applied to SalesShop Supabase project on 2026-11-04,
-- migration 20261104102047 guard_deal_assignee_quote_eligibility.
-- Validate new assignees without modifying existing Deals or RLS policies.
create or replace function private.enforce_deal_assignee_quote_eligibility()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.assigned_user_id is null then
    return new;
  end if;

  -- Preserve existing assignments on unrelated edits even when the
  -- salesperson's role has changed. Newly selected assignees must qualify.
  if tg_op = 'UPDATE' then
    if new.assigned_user_id is not distinct from old.assigned_user_id then
      return new;
    end if;
  end if;

  if not exists (
    select 1 from public.organization_members as member
    where member.organization_id = new.organization_id
      and member.user_id = new.assigned_user_id
      and (
        member.role in ('owner','admin')
        or (member.role='member'
          and member.job_function in ('general','salesperson'))
      )
  ) then
    raise exception using
      errcode='23514',
      message='Deal assignee must be a teammate allowed to issue quotes.';
  end if;
  return new;
end;
$function$;

revoke all on function private.enforce_deal_assignee_quote_eligibility()
  from public, anon, authenticated;

drop trigger if exists projects_validate_quote_assignee on public.projects;
create trigger projects_validate_quote_assignee
before insert or update of assigned_user_id
on public.projects
for each row execute function private.enforce_deal_assignee_quote_eligibility();
