-- SalesShop platform layer / foundation Batch P1.
-- The operator is NOT a tenant role. No current users are promoted.
-- A platform operator account cannot simultaneously belong to any company.
-- This migration does not change current organizations, owners, or quotes.

create table private.platform_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'developer' check (role = 'developer'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  active boolean not null default true
);
alter table private.platform_operators enable row level security;
-- No client-visible policies or grants for this table. Only trusted server
-- administrators may provision a dedicated operator account by user UUID.

create function private.check_platform_operator_separation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.organization_members m where m.user_id = new.user_id
  ) then
    raise exception 'Platform developer accounts cannot hold a tenant membership; use a separate company login'
      using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger platform_operator_tenant_separation
  before insert or update of user_id on private.platform_operators
  for each row execute function private.check_platform_operator_separation();

create function private.check_tenant_member_separation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from private.platform_operators p where p.user_id = new.user_id
  ) then
    raise exception 'Platform developer accounts cannot join company workspaces; use a separate company login'
      using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger tenant_member_platform_separation
  before insert or update of user_id on public.organization_members
  for each row execute function private.check_tenant_member_separation();

-- Only non-sensitive subscription/lifecycle metadata. No tenant content,
-- members, contacts, quote counts, revenue, or staff emails are stored here.
create table private.platform_tenant_status (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  lifecycle text not null default 'not_configured'
    check (lifecycle in ('not_configured','trial','active','past_due','suspended')),
  plan text not null default 'not_configured'
    check (plan in ('not_configured','starter','growth','enterprise')),
  updated_at timestamptz not null default now()
);
alter table private.platform_tenant_status enable row level security;
-- No client policies. Billing webhook backend and server-authorized workflows
-- may eventually update status; frontend cannot.

create function private.is_platform_developer()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from private.platform_operators p
    where p.user_id=(select auth.uid()) and p.role='developer' and p.active=true
  );
$$;

-- Minimal bootstrap probe: boolean only. No org names returned to unauthorized
-- users and no tenant membership is conferred by this function.
create function public.is_platform_developer()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_platform_developer() $$;

-- Server-enforced developer console; business tables are not joined and no
-- user lists, quotes, activity, or contact data are exposed.
create function public.platform_console_overview()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare summary jsonb;
begin
  if not private.is_platform_developer() then
    raise exception 'Platform console access denied' using errcode='42501';
  end if;
  select jsonb_build_object(
    'organizations', coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'createdAt', o.created_at,
      'plan', coalesce(p.plan,'not_configured'),
      'lifecycle',coalesce(p.lifecycle,'not_configured')
    ) order by o.created_at desc), '[]'::jsonb),
    'organizationCount', count(*)
  )
  into summary
  from public.organizations o
  left join private.platform_tenant_status p on p.organization_id=o.id;
  return summary;
end;
$$;

revoke all on table private.platform_operators from public, anon, authenticated;
revoke all on table private.platform_tenant_status from public, anon, authenticated;
revoke all on function private.is_platform_developer() from public, anon;
revoke all on function private.check_platform_operator_separation() from public, anon, authenticated;
revoke all on function private.check_tenant_member_separation() from public, anon, authenticated;
revoke all on function public.is_platform_developer() from public, anon;
revoke all on function public.platform_console_overview() from public, anon;
grant execute on function private.is_platform_developer() to authenticated;
grant execute on function public.is_platform_developer() to authenticated;
grant execute on function public.platform_console_overview() to authenticated;

comment on table private.platform_operators is
  'Dedicated SalesShop platform developers only, provisioned by trusted DB admin. Never tenant members.';
comment on function public.platform_console_overview() is
  'Developer-only platform metadata. Never exposes customer quotes, CRM, billing secrets, or employee identities.';
