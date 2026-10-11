-- Keep INSERT and UPDATE trigger branches separate so OLD is never read
-- on an INSERT and direct REST writes are rejected consistently.
create or replace function private.guard_quote_issuance()
returns trigger language plpgsql security invoker
set search_path to ''
as $$
declare needs_issue_permission boolean := false;
begin
  if tg_op = 'INSERT' then
    needs_issue_permission := new.status in ('Sent','Viewed','Signed') or new.sent_at is not null;
  elsif tg_op = 'UPDATE' then
    needs_issue_permission :=
      (new.status in ('Sent','Viewed','Signed') and old.status in ('Draft','Ready'))
      or (new.sent_at is distinct from old.sent_at and new.sent_at is not null);
  end if;
  if needs_issue_permission and not private.can_issue_org_quotes(new.organization_id) then
    raise exception 'You can prepare estimates but cannot issue customer quotes with this department'
      using errcode = '42501';
  end if;
  return new;
end $$;
