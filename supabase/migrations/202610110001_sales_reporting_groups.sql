-- SalesShop Batch 11C: additive, organization-scoped ownership & reporting.
-- No legacy quote is reassigned. Existing schema/policies remain intact.
create table public.sales_divisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,name)
);
create table public.sales_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  division_id uuid,
  name text not null check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,name),
  constraint sales_teams_division_fk foreign key (organization_id,division_id)
    references public.sales_divisions(organization_id,id) on delete set null (division_id)
);
create table public.sales_team_members (
  organization_id uuid not null,
  team_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id,team_id,user_id),
  foreign key (organization_id,team_id)
    references public.sales_teams(organization_id,id) on delete cascade,
  foreign key (organization_id,user_id)
    references public.organization_members(organization_id,user_id) on delete cascade
);
create index sales_teams_by_division on public.sales_teams(organization_id,division_id);
create index sales_team_members_by_user on public.sales_team_members(organization_id,user_id);

alter table public.quotes
  add column owner_user_id uuid references auth.users(id) on delete set null,
  add column division_id uuid,
  add column team_id uuid;
alter table public.quotes
  add constraint quotes_sales_division_fk foreign key (organization_id,division_id)
    references public.sales_divisions(organization_id,id) on delete set null (division_id),
  add constraint quotes_sales_team_fk foreign key (organization_id,team_id)
    references public.sales_teams(organization_id,id) on delete set null (team_id);
create index quotes_by_owner on public.quotes(organization_id,owner_user_id);
create index quotes_by_team on public.quotes(organization_id,team_id);
create index quotes_by_division on public.quotes(organization_id,division_id);

alter table public.sales_divisions enable row level security;
alter table public.sales_teams enable row level security;
alter table public.sales_team_members enable row level security;

create policy sales_divisions_read_org on public.sales_divisions for select to authenticated
  using (private.is_org_member(organization_id));
create policy sales_teams_read_org on public.sales_teams for select to authenticated
  using (private.is_org_member(organization_id));
create policy sales_team_members_read_org on public.sales_team_members for select to authenticated
  using (private.is_org_member(organization_id));

create policy sales_divisions_admin_write on public.sales_divisions for all to authenticated
  using (exists (select 1 from public.organization_members m
    where m.organization_id = sales_divisions.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
  with check (exists (select 1 from public.organization_members m
    where m.organization_id = sales_divisions.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));
create policy sales_teams_admin_write on public.sales_teams for all to authenticated
  using (exists (select 1 from public.organization_members m
    where m.organization_id = sales_teams.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
  with check (exists (select 1 from public.organization_members m
    where m.organization_id = sales_teams.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));
create policy sales_team_members_admin_write on public.sales_team_members for all to authenticated
  using (exists (select 1 from public.organization_members m
    where m.organization_id = sales_team_members.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
  with check (exists (select 1 from public.organization_members m
    where m.organization_id = sales_team_members.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));

-- Only owners/admins may reassign quote responsibility; no new broad
-- read/write permissions are granted to members or viewers.
create function private.guard_quote_team_assignment()
returns trigger language plpgsql security definer
set search_path = '' as $$
declare actor_role text;
begin
  if auth.uid() is null then return new; end if;
  select m.role into actor_role from public.organization_members m
    where m.organization_id = new.organization_id and m.user_id = auth.uid();
  if tg_op = 'INSERT' then
    if actor_role not in ('owner','admin') then
      new.owner_user_id := auth.uid();
      new.division_id := null;
      new.team_id := null;
    elsif new.owner_user_id is null then
      new.owner_user_id := auth.uid();
    end if;
  elsif new.owner_user_id is distinct from old.owner_user_id
     or new.division_id is distinct from old.division_id
     or new.team_id is distinct from old.team_id then
    if actor_role not in ('owner','admin') then
      raise exception 'Only a SalesShop owner/admin can reassign quotes'
        using errcode = '42501';
    end if;
  end if;
  if new.owner_user_id is not null and not exists (
    select 1 from public.organization_members m
      where m.organization_id = new.organization_id
        and m.user_id = new.owner_user_id) then
    raise exception 'Quote owner must belong to this organization'
      using errcode = '23514';
  end if;
  if new.team_id is not null and new.division_id is not null and not exists (
    select 1 from public.sales_teams t
      where t.organization_id = new.organization_id
        and t.id = new.team_id and t.division_id = new.division_id) then
    raise exception 'Quote team must belong to selected division'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger quote_assignment_guard before insert or update of
  owner_user_id,division_id,team_id on public.quotes for each row
  execute function private.guard_quote_team_assignment();
comment on column public.quotes.owner_user_id is 'Salesperson responsibility; legacy records remain NULL until explicitly assigned';
comment on column public.quotes.division_id is 'Reporting division, organization scoped';
comment on column public.quotes.team_id is 'Reporting team, organization scoped';
