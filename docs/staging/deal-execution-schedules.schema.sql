-- STAGED ONLY. Do not execute on production or merge into auto-applied migrations.
-- See README staging/auth release gate. Validate with synthetic organizations
-- and a full role matrix on an isolated, explicitly approved environment.
--
-- SalesShop multifamily/contracted Deal execution schedules.
-- A schedule is a single revision-guarded JSON document per existing Deal.
-- Normalized ownership: tenant (organization_id) + CRM Deal (deal_id).
-- All phase IDs live *inside* the document and can refer to one another.
-- Deliberately separate from CRM deal stage and personal Tasks.
create table if not exists public.deal_execution_schedules (
  organization_id uuid not null,
  deal_id text not null,
  schedule jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_by uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, deal_id),
  constraint deal_execution_schedules_project_fkey
    foreign key (organization_id, deal_id)
    references public.projects (organization_id, id)
    on delete cascade,
  constraint deal_execution_schedules_shape
    check (
      jsonb_typeof(schedule) = 'object'
      and schedule ->> 'templateId' = 'multifamily-starter-v1'
      and schedule ->> 'dealId' = deal_id
      and jsonb_typeof(schedule -> 'rows') = 'array'
    )
);

comment on table public.deal_execution_schedules is
'One shared revision-guarded execution timeline per CRM Deal. Phase dependency IDs are stored in schedule JSON.';

create index if not exists deal_execution_schedules_updated_at_idx
  on public.deal_execution_schedules (organization_id, updated_at desc);

alter table public.deal_execution_schedules enable row level security;

-- All signed-in organization members may inspect execution timelines.
create policy deal_execution_schedules_read_org
  on public.deal_execution_schedules for select to authenticated
  using (private.is_org_member(organization_id));

-- Changes follow SalesShop's existing CRM editor rules.
create policy deal_execution_schedules_insert_editor
  on public.deal_execution_schedules for insert to authenticated
  with check (
    private.can_edit_org_area(organization_id, 'crm')
    and updated_by = (select auth.uid())
  );
create policy deal_execution_schedules_update_editor
  on public.deal_execution_schedules for update to authenticated
  using (private.can_edit_org_area(organization_id, 'crm'))
  with check (
    private.can_edit_org_area(organization_id, 'crm')
    and updated_by = (select auth.uid())
  );
create policy deal_execution_schedules_delete_editor
  on public.deal_execution_schedules for delete to authenticated
  using (private.can_edit_org_area(organization_id, 'crm'));

-- If the Data API uses explicit GRANTs, keep authenticated access RLS-limited.
revoke all on public.deal_execution_schedules from anon;
grant select, insert, update, delete on public.deal_execution_schedules to authenticated;

-- Crucial release checks, using synthetic cross-org accounts:
-- 1. Nonmember cannot SELECT or mutate a schedule even knowing org/deal IDs.
-- 2. Member without CRM-edit privilege can SELECT, but not INSERT/UPDATE/DELETE.
-- 3. Editor can create only under an existing Deal in the SAME organization.
-- 4. UPDATE with a stale revision returns zero rows; client reports conflict.
-- 5. Deleting a Deal cascades to its execution schedule (not to other Deals).
-- 6. A user cannot set updated_by to another user.
-- 7. If policy helper functions differ in staging, use the verified CRM
--    authorization functions rather than weakening these predicates.
