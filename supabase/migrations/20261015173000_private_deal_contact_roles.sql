-- Batch 17G STAGED ONLY: person-owned Deal contact role annotations.
-- DO NOT APPLY to production before JWT role-matrix and CRM privacy cutover.
-- Existing public.projects / public.contacts are organization-readable; this
-- addition MUST NOT inherit their broad policy. No new quote/CRM grants.
begin;

create table public.deal_contact_roles (
  organization_id uuid not null,
  deal_id text not null,
  contact_id text not null,
  owner_user_id uuid not null default auth.uid(),
  role text not null check (role in (
    'Estimator','Buyer','Decision maker','Project manager','Other'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id,deal_id,contact_id,owner_user_id),
  constraint deal_contact_roles_deal_fk
    foreign key (organization_id,deal_id)
    references public.projects(organization_id,id) on delete cascade,
  constraint deal_contact_roles_contact_fk
    foreign key (organization_id,contact_id)
    references public.contacts(organization_id,id) on delete cascade,
  constraint deal_contact_roles_owner_fk
    foreign key (organization_id,owner_user_id)
    references public.organization_members(organization_id,user_id) on delete cascade
);
create index deal_contact_roles_person_idx on public.deal_contact_roles
  (organization_id,contact_id,owner_user_id);

alter table public.deal_contact_roles enable row level security;
revoke all on public.deal_contact_roles from public,anon;
grant select,insert,update,delete on public.deal_contact_roles to authenticated;

-- SECURITY DEFINER is restricted to a boolean and MUST verify the actual
-- authenticated identity. Never authorize by frontend role hints or
-- organization membership alone. An explicit OWNED quote proves the contact
-- is associated with the specific Deal in the current salesperson's scope.
create function private.can_manage_private_deal_contact_role(
  p_org uuid,p_deal text,p_contact text,p_owner uuid
) returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null
     and p_owner=(select auth.uid())
     and exists (
       select 1 from public.organization_members m
       where m.organization_id=p_org and m.user_id=(select auth.uid())
         and m.role in ('owner','admin','member')
     )
     and private.can_edit_org_area(p_org,'quotes')
     and exists (
       select 1 from public.quotes q
       where q.organization_id=p_org
         and q.project_id=p_deal and q.contact_id=p_contact
         and q.owner_user_id=(select auth.uid())
     );
$$;
revoke all on function private.can_manage_private_deal_contact_role(uuid,text,text,uuid) from public,anon;
grant execute on function private.can_manage_private_deal_contact_role(uuid,text,text,uuid) to authenticated;

create policy deal_contact_roles_select_own on public.deal_contact_roles
  for select to authenticated
  using (private.can_manage_private_deal_contact_role(
    organization_id,deal_id,contact_id,owner_user_id));
create policy deal_contact_roles_insert_own on public.deal_contact_roles
  for insert to authenticated
  with check (private.can_manage_private_deal_contact_role(
    organization_id,deal_id,contact_id,owner_user_id));
create policy deal_contact_roles_update_own on public.deal_contact_roles
  for update to authenticated
  using (private.can_manage_private_deal_contact_role(
    organization_id,deal_id,contact_id,owner_user_id))
  with check (private.can_manage_private_deal_contact_role(
    organization_id,deal_id,contact_id,owner_user_id));
create policy deal_contact_roles_delete_own on public.deal_contact_roles
  for delete to authenticated
  using (private.can_manage_private_deal_contact_role(
    organization_id,deal_id,contact_id,owner_user_id));

comment on table public.deal_contact_roles is
  'Private per-user Deal contact labels. NOT organization-wide roles; requires an owned, explicitly contact-linked Quote. Staged until JWT privacy tests pass.';
commit;
