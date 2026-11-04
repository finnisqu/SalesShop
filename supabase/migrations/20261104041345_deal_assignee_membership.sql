-- Applied to SalesShop via Supabase migration 20261104041345.
-- Additive: do not assign or modify any existing Deal.
alter table public.projects
  add column if not exists assigned_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.projects'::regclass
      and conname='projects_assignee_member_fkey'
  ) then
    alter table public.projects
      add constraint projects_assignee_member_fkey
      foreign key (organization_id,assigned_user_id)
      references public.organization_members(organization_id,user_id)
      on delete set null (assigned_user_id);
  end if;
end $$;

create index if not exists projects_org_assignee_idx
  on public.projects (organization_id,assigned_user_id)
  where assigned_user_id is not null;

comment on column public.projects.assigned_user_id is
 'Optional explicitly assigned salesperson, restricted to an organization member. Unassigned legacy Deals retain existing private submission-task routing until assigned.';
