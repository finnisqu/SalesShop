-- Normalize SalesShop CRM entities behind the existing domain/repository seams.
-- The legacy org_documents.crm snapshot is intentionally retained as a rollback backup.

begin;

create table if not exists public.companies (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  name text not null check (length(btrim(name)) > 0),
  kind text not null default 'customer' check (kind in ('customer', 'non-customer')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists public.contacts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  company_id text,
  name text not null check (length(btrim(name)) > 0),
  email text,
  phone text,
  title text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id),
  constraint contacts_company_fkey
    foreign key (organization_id, company_id)
    references public.companies(organization_id, id)
    on delete set null
);

create table if not exists public.projects (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  company_id text,
  name text not null check (length(btrim(name)) > 0),
  stage text not null check (stage in (
    'Discovery', 'Intent to Bid', 'Bid Development', 'Bid Sent',
    'Negotiation', 'Closed Won', 'Completed', 'Closed Lost', 'Discarded'
  )),
  due_date date,
  amount numeric,
  next_action text,
  last_touchpoint date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id),
  constraint projects_company_fkey
    foreign key (organization_id, company_id)
    references public.companies(organization_id, id)
    on delete set null
);

create table if not exists public.activities (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  type text not null check (type in (
    'project-created', 'project-stage-changed', 'quote-created', 'quote-linked',
    'quote-sent', 'quote-revision-created', 'quote-viewed', 'quote-signed',
    'quote-declined', 'quote-expired', 'contact-created'
  )),
  summary text not null,
  project_id text,
  company_id text,
  contact_id text,
  quote_id text,
  occurred_at timestamptz not null,
  metadata jsonb,
  sort_order integer not null default 0,
  primary key (organization_id, id),
  constraint activities_project_fkey
    foreign key (organization_id, project_id)
    references public.projects(organization_id, id)
    on delete set null,
  constraint activities_company_fkey
    foreign key (organization_id, company_id)
    references public.companies(organization_id, id)
    on delete set null,
  constraint activities_contact_fkey
    foreign key (organization_id, contact_id)
    references public.contacts(organization_id, id)
    on delete set null
);

create index if not exists companies_organization_name_idx
  on public.companies(organization_id, lower(name));
create index if not exists contacts_organization_company_idx
  on public.contacts(organization_id, company_id);
create index if not exists contacts_organization_email_idx
  on public.contacts(organization_id, lower(email)) where email is not null;
create index if not exists projects_organization_company_idx
  on public.projects(organization_id, company_id);
create index if not exists projects_organization_stage_idx
  on public.projects(organization_id, stage);
create index if not exists activities_organization_occurred_idx
  on public.activities(organization_id, occurred_at desc);
create index if not exists activities_organization_project_idx
  on public.activities(organization_id, project_id);
create index if not exists activities_organization_company_idx
  on public.activities(organization_id, company_id);
create index if not exists activities_organization_contact_idx
  on public.activities(organization_id, contact_id);
create index if not exists activities_organization_quote_idx
  on public.activities(organization_id, quote_id) where quote_id is not null;

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.projects enable row level security;
alter table public.activities enable row level security;

create policy companies_members_all
  on public.companies for all to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

create policy contacts_members_all
  on public.contacts for all to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

create policy projects_members_all
  on public.projects for all to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

create policy activities_members_all
  on public.activities for all to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

grant select, insert, update, delete on
  public.companies, public.contacts, public.projects, public.activities
  to authenticated;

-- Seed normalized rows from the existing organization CRM snapshots.
insert into public.companies (
  organization_id, id, name, kind, sort_order, created_at, updated_at
)
select
  doc.organization_id,
  item.value ->> 'id',
  item.value ->> 'name',
  case when item.value ->> 'kind' = 'non-customer' then 'non-customer' else 'customer' end,
  (item.ordinality - 1)::integer,
  coalesce(nullif(item.value ->> 'createdAt', '')::timestamptz, now()),
  coalesce(nullif(item.value ->> 'updatedAt', '')::timestamptz, now())
from public.org_documents doc
cross join lateral jsonb_array_elements(coalesce(doc.document -> 'companies', '[]'::jsonb))
  with ordinality as item(value, ordinality)
where doc.document_key = 'crm'
  and nullif(item.value ->> 'id', '') is not null
  and nullif(item.value ->> 'name', '') is not null
on conflict (organization_id, id) do update set
  name = excluded.name,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.contacts (
  organization_id, id, company_id, name, email, phone, title, sort_order, created_at, updated_at
)
select
  doc.organization_id,
  item.value ->> 'id',
  company.id,
  item.value ->> 'name',
  nullif(item.value ->> 'email', ''),
  nullif(item.value ->> 'phone', ''),
  nullif(item.value ->> 'title', ''),
  (item.ordinality - 1)::integer,
  coalesce(nullif(item.value ->> 'createdAt', '')::timestamptz, now()),
  coalesce(nullif(item.value ->> 'updatedAt', '')::timestamptz, now())
from public.org_documents doc
cross join lateral jsonb_array_elements(coalesce(doc.document -> 'contacts', '[]'::jsonb))
  with ordinality as item(value, ordinality)
left join public.companies company
  on company.organization_id = doc.organization_id
 and company.id = nullif(item.value ->> 'companyId', '')
where doc.document_key = 'crm'
  and nullif(item.value ->> 'id', '') is not null
  and nullif(item.value ->> 'name', '') is not null
on conflict (organization_id, id) do update set
  company_id = excluded.company_id,
  name = excluded.name,
  email = excluded.email,
  phone = excluded.phone,
  title = excluded.title,
  sort_order = excluded.sort_order,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.projects (
  organization_id, id, company_id, name, stage, due_date, amount, next_action,
  last_touchpoint, sort_order, created_at, updated_at
)
select
  doc.organization_id,
  item.value ->> 'id',
  company.id,
  item.value ->> 'name',
  item.value ->> 'stage',
  nullif(item.value ->> 'dueDate', '')::date,
  nullif(item.value ->> 'amount', '')::numeric,
  nullif(item.value ->> 'nextAction', ''),
  nullif(item.value ->> 'lastTouchpoint', '')::date,
  (item.ordinality - 1)::integer,
  coalesce(nullif(item.value ->> 'createdAt', '')::timestamptz, now()),
  coalesce(nullif(item.value ->> 'updatedAt', '')::timestamptz, now())
from public.org_documents doc
cross join lateral jsonb_array_elements(coalesce(doc.document -> 'projects', '[]'::jsonb))
  with ordinality as item(value, ordinality)
left join public.companies company
  on company.organization_id = doc.organization_id
 and company.id = nullif(item.value ->> 'companyId', '')
where doc.document_key = 'crm'
  and nullif(item.value ->> 'id', '') is not null
  and nullif(item.value ->> 'name', '') is not null
on conflict (organization_id, id) do update set
  company_id = excluded.company_id,
  name = excluded.name,
  stage = excluded.stage,
  due_date = excluded.due_date,
  amount = excluded.amount,
  next_action = excluded.next_action,
  last_touchpoint = excluded.last_touchpoint,
  sort_order = excluded.sort_order,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.activities (
  organization_id, id, type, summary, project_id, company_id, contact_id,
  quote_id, occurred_at, metadata, sort_order
)
select
  doc.organization_id,
  item.value ->> 'id',
  item.value ->> 'type',
  item.value ->> 'summary',
  project.id,
  company.id,
  contact.id,
  nullif(item.value ->> 'quoteId', ''),
  coalesce(nullif(item.value ->> 'occurredAt', '')::timestamptz, now()),
  case when jsonb_typeof(item.value -> 'metadata') = 'object' then item.value -> 'metadata' else null end,
  (item.ordinality - 1)::integer
from public.org_documents doc
cross join lateral jsonb_array_elements(coalesce(doc.document -> 'activities', '[]'::jsonb))
  with ordinality as item(value, ordinality)
left join public.projects project
  on project.organization_id = doc.organization_id
 and project.id = nullif(item.value ->> 'projectId', '')
left join public.companies company
  on company.organization_id = doc.organization_id
 and company.id = nullif(item.value ->> 'companyId', '')
left join public.contacts contact
  on contact.organization_id = doc.organization_id
 and contact.id = nullif(item.value ->> 'contactId', '')
where doc.document_key = 'crm'
  and nullif(item.value ->> 'id', '') is not null
  and nullif(item.value ->> 'type', '') is not null
  and nullif(item.value ->> 'summary', '') is not null
on conflict (organization_id, id) do update set
  type = excluded.type,
  summary = excluded.summary,
  project_id = excluded.project_id,
  company_id = excluded.company_id,
  contact_id = excluded.contact_id,
  quote_id = excluded.quote_id,
  occurred_at = excluded.occurred_at,
  metadata = excluded.metadata,
  sort_order = excluded.sort_order;

commit;
