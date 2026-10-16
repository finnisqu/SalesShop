-- Normalize SalesShop Quotes and Signatures behind the existing domain/repository seams.
-- Legacy org_documents quote/signature snapshots are intentionally retained as rollback backups.

begin;

create table if not exists public.quotes (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  quote_number text not null,
  original_quote_date date not null,
  quote_date date not null,
  revision integer not null default 0 check (revision >= 0),
  revision_label text,
  status text not null check (status in ('Draft', 'Ready', 'Sent', 'Viewed', 'Signed', 'Declined', 'Expired')),
  title text not null,
  project_id text,
  company_id text,
  company_name text,
  contact_id text,
  contact_name text,
  contact_email text,
  address text,
  customer_quantity boolean not null default false,
  customer_rate boolean not null default false,
  customer_line_amount boolean not null default true,
  customer_notes text not null default '',
  internal_notes text not null default '',
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists public.quote_sections (
  organization_id uuid not null,
  id text not null,
  quote_id text not null,
  title text not null,
  customer_visible boolean not null default true,
  sort_order integer not null default 0,
  primary key (organization_id, id),
  constraint quote_sections_quote_fkey
    foreign key (organization_id, quote_id)
    references public.quotes(organization_id, id)
    on delete cascade
);

create table if not exists public.quote_lines (
  organization_id uuid not null,
  id text not null,
  quote_id text not null,
  section_id text,
  kind text not null check (kind in ('item', 'allowance', 'discount', 'tax', 'note', 'scope', 'warranty')),
  description text not null,
  pricing_mode text not null check (pricing_mode in ('direct', 'quantity-rate', 'none')),
  quantity numeric,
  rate numeric,
  amount numeric,
  customer_visible boolean not null default true,
  include_in_total boolean not null default true,
  sort_order integer not null default 0,
  primary key (organization_id, id),
  constraint quote_lines_quote_fkey
    foreign key (organization_id, quote_id)
    references public.quotes(organization_id, id)
    on delete cascade
);

create table if not exists public.quote_revisions (
  organization_id uuid not null,
  quote_id text not null,
  revision integer not null check (revision >= 0),
  label text,
  quote_date date not null,
  captured_at timestamptz not null,
  status text not null check (status in ('Draft', 'Ready', 'Sent', 'Viewed', 'Signed', 'Declined', 'Expired')),
  title text not null,
  snapshot jsonb not null,
  primary key (organization_id, quote_id, revision),
  constraint quote_revisions_quote_fkey
    foreign key (organization_id, quote_id)
    references public.quotes(organization_id, id)
    on delete cascade
);

create table if not exists public.signatures (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  quote_id text not null,
  project_id text,
  company_id text,
  contact_id text,
  quote_number text not null,
  revision integer not null default 0 check (revision >= 0),
  signer_name text not null,
  signer_email text,
  method text not null check (method in ('drawn', 'typed')),
  signature_text text,
  strokes jsonb not null default '[]'::jsonb,
  consent_text text not null,
  accepted_at timestamptz not null,
  accepted_snapshot jsonb not null,
  primary key (organization_id, id)
);

create index if not exists quotes_organization_number_idx
  on public.quotes(organization_id, quote_number);
create index if not exists quotes_organization_project_idx
  on public.quotes(organization_id, project_id) where project_id is not null;
create index if not exists quotes_organization_company_idx
  on public.quotes(organization_id, company_id) where company_id is not null;
create index if not exists quotes_organization_contact_idx
  on public.quotes(organization_id, contact_id) where contact_id is not null;
create index if not exists quotes_organization_status_idx
  on public.quotes(organization_id, status);
create index if not exists quote_sections_organization_quote_idx
  on public.quote_sections(organization_id, quote_id, sort_order);
create index if not exists quote_lines_organization_quote_idx
  on public.quote_lines(organization_id, quote_id, sort_order);
create index if not exists quote_revisions_organization_quote_idx
  on public.quote_revisions(organization_id, quote_id, revision);
create index if not exists signatures_organization_quote_idx
  on public.signatures(organization_id, quote_id, revision);
create index if not exists signatures_organization_accepted_idx
  on public.signatures(organization_id, accepted_at desc);

alter table public.quotes enable row level security;
alter table public.quote_sections enable row level security;
alter table public.quote_lines enable row level security;
alter table public.quote_revisions enable row level security;
alter table public.signatures enable row level security;

create policy quotes_members_all
  on public.quotes for all to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

create policy quote_sections_members_all
  on public.quote_sections for all to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

create policy quote_lines_members_all
  on public.quote_lines for all to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

create policy quote_revisions_members_select
  on public.quote_revisions for select to authenticated
  using (private.is_org_member(organization_id));

create policy quote_revisions_members_insert
  on public.quote_revisions for insert to authenticated
  with check (private.is_org_member(organization_id));

create policy signatures_members_select
  on public.signatures for select to authenticated
  using (private.is_org_member(organization_id));

create policy signatures_members_insert
  on public.signatures for insert to authenticated
  with check (private.is_org_member(organization_id));

grant select, insert, update, delete on
  public.quotes, public.quote_sections, public.quote_lines
  to authenticated;
grant select, insert on public.quote_revisions, public.signatures to authenticated;

-- Seed current quotes from the existing organization document snapshots.
insert into public.quotes (
  organization_id, id, quote_number, original_quote_date, quote_date, revision,
  revision_label, status, title, project_id, company_id, company_name, contact_id,
  contact_name, contact_email, address, customer_quantity, customer_rate,
  customer_line_amount, customer_notes, internal_notes, sent_at, viewed_at,
  signed_at, sort_order, created_at, updated_at
)
select
  doc.organization_id,
  item.value ->> 'id',
  item.value ->> 'quoteNumber',
  coalesce(nullif(item.value ->> 'originalQuoteDate', '')::date, current_date),
  coalesce(nullif(item.value ->> 'quoteDate', '')::date, current_date),
  coalesce((item.value ->> 'revision')::integer, 0),
  nullif(item.value ->> 'revisionLabel', ''),
  coalesce(nullif(item.value ->> 'status', ''), 'Draft'),
  coalesce(nullif(item.value ->> 'title', ''), 'Untitled quote'),
  nullif(item.value ->> 'projectId', ''),
  nullif(item.value ->> 'companyId', ''),
  nullif(item.value ->> 'companyName', ''),
  nullif(item.value ->> 'contactId', ''),
  nullif(item.value ->> 'contactName', ''),
  nullif(item.value ->> 'contactEmail', ''),
  nullif(item.value ->> 'address', ''),
  coalesce((item.value -> 'customerColumns' ->> 'quantity')::boolean, false),
  coalesce((item.value -> 'customerColumns' ->> 'rate')::boolean, false),
  coalesce((item.value -> 'customerColumns' ->> 'lineAmount')::boolean, true),
  coalesce(item.value ->> 'customerNotes', ''),
  coalesce(item.value ->> 'internalNotes', ''),
  nullif(item.value ->> 'sentAt', '')::timestamptz,
  nullif(item.value ->> 'viewedAt', '')::timestamptz,
  nullif(item.value ->> 'signedAt', '')::timestamptz,
  (item.ordinality - 1)::integer,
  coalesce(nullif(item.value ->> 'createdAt', '')::timestamptz, now()),
  coalesce(nullif(item.value ->> 'updatedAt', '')::timestamptz, now())
from public.org_documents doc
cross join lateral jsonb_array_elements(coalesce(doc.document -> 'quotes', '[]'::jsonb))
  with ordinality as item(value, ordinality)
where doc.document_key = 'quotes'
  and nullif(item.value ->> 'id', '') is not null
  and nullif(item.value ->> 'quoteNumber', '') is not null
on conflict (organization_id, id) do update set
  quote_number = excluded.quote_number,
  original_quote_date = excluded.original_quote_date,
  quote_date = excluded.quote_date,
  revision = excluded.revision,
  revision_label = excluded.revision_label,
  status = excluded.status,
  title = excluded.title,
  project_id = excluded.project_id,
  company_id = excluded.company_id,
  company_name = excluded.company_name,
  contact_id = excluded.contact_id,
  contact_name = excluded.contact_name,
  contact_email = excluded.contact_email,
  address = excluded.address,
  customer_quantity = excluded.customer_quantity,
  customer_rate = excluded.customer_rate,
  customer_line_amount = excluded.customer_line_amount,
  customer_notes = excluded.customer_notes,
  internal_notes = excluded.internal_notes,
  sent_at = excluded.sent_at,
  viewed_at = excluded.viewed_at,
  signed_at = excluded.signed_at,
  sort_order = excluded.sort_order,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.quote_sections (
  organization_id, id, quote_id, title, customer_visible, sort_order
)
select
  doc.organization_id,
  section.value ->> 'id',
  quote_item.value ->> 'id',
  coalesce(section.value ->> 'title', 'Section'),
  coalesce((section.value ->> 'customerVisible')::boolean, true),
  (section.ordinality - 1)::integer
from public.org_documents doc
cross join lateral jsonb_array_elements(coalesce(doc.document -> 'quotes', '[]'::jsonb)) quote_item(value)
cross join lateral jsonb_array_elements(coalesce(quote_item.value -> 'sections', '[]'::jsonb))
  with ordinality as section(value, ordinality)
where doc.document_key = 'quotes'
  and nullif(section.value ->> 'id', '') is not null
  and exists (
    select 1 from public.quotes q
    where q.organization_id = doc.organization_id
      and q.id = quote_item.value ->> 'id'
  )
on conflict (organization_id, id) do update set
  quote_id = excluded.quote_id,
  title = excluded.title,
  customer_visible = excluded.customer_visible,
  sort_order = excluded.sort_order;

insert into public.quote_lines (
  organization_id, id, quote_id, section_id, kind, description, pricing_mode,
  quantity, rate, amount, customer_visible, include_in_total, sort_order
)
select
  doc.organization_id,
  line.value ->> 'id',
  quote_item.value ->> 'id',
  nullif(line.value ->> 'sectionId', ''),
  coalesce(nullif(line.value ->> 'kind', ''), 'item'),
  coalesce(line.value ->> 'description', ''),
  coalesce(nullif(line.value ->> 'pricingMode', ''), 'direct'),
  nullif(line.value ->> 'quantity', '')::numeric,
  nullif(line.value ->> 'rate', '')::numeric,
  nullif(line.value ->> 'amount', '')::numeric,
  coalesce((line.value ->> 'customerVisible')::boolean, true),
  coalesce((line.value ->> 'includeInTotal')::boolean, true),
  (line.ordinality - 1)::integer
from public.org_documents doc
cross join lateral jsonb_array_elements(coalesce(doc.document -> 'quotes', '[]'::jsonb)) quote_item(value)
cross join lateral jsonb_array_elements(coalesce(quote_item.value -> 'lines', '[]'::jsonb))
  with ordinality as line(value, ordinality)
where doc.document_key = 'quotes'
  and nullif(line.value ->> 'id', '') is not null
  and exists (
    select 1 from public.quotes q
    where q.organization_id = doc.organization_id
      and q.id = quote_item.value ->> 'id'
  )
on conflict (organization_id, id) do update set
  quote_id = excluded.quote_id,
  section_id = excluded.section_id,
  kind = excluded.kind,
  description = excluded.description,
  pricing_mode = excluded.pricing_mode,
  quantity = excluded.quantity,
  rate = excluded.rate,
  amount = excluded.amount,
  customer_visible = excluded.customer_visible,
  include_in_total = excluded.include_in_total,
  sort_order = excluded.sort_order;

insert into public.quote_revisions (
  organization_id, quote_id, revision, label, quote_date, captured_at, status, title, snapshot
)
select
  doc.organization_id,
  quote_item.value ->> 'id',
  coalesce((history.value ->> 'revision')::integer, 0),
  nullif(history.value ->> 'label', ''),
  coalesce(nullif(history.value ->> 'quoteDate', '')::date, current_date),
  coalesce(nullif(history.value ->> 'capturedAt', '')::timestamptz, now()),
  coalesce(nullif(history.value ->> 'status', ''), 'Draft'),
  coalesce(nullif(history.value ->> 'title', ''), 'Untitled quote'),
  history.value
from public.org_documents doc
cross join lateral jsonb_array_elements(coalesce(doc.document -> 'quotes', '[]'::jsonb)) quote_item(value)
cross join lateral jsonb_array_elements(coalesce(quote_item.value -> 'history', '[]'::jsonb)) history(value)
where doc.document_key = 'quotes'
  and nullif(quote_item.value ->> 'id', '') is not null
  and exists (
    select 1 from public.quotes q
    where q.organization_id = doc.organization_id
      and q.id = quote_item.value ->> 'id'
  )
on conflict (organization_id, quote_id, revision) do nothing;

insert into public.signatures (
  organization_id, id, quote_id, project_id, company_id, contact_id, quote_number,
  revision, signer_name, signer_email, method, signature_text, strokes,
  consent_text, accepted_at, accepted_snapshot
)
select
  doc.organization_id,
  item.value ->> 'id',
  item.value ->> 'quoteId',
  nullif(item.value ->> 'projectId', ''),
  nullif(item.value ->> 'companyId', ''),
  nullif(item.value ->> 'contactId', ''),
  item.value ->> 'quoteNumber',
  coalesce((item.value ->> 'revision')::integer, 0),
  item.value ->> 'signerName',
  nullif(item.value ->> 'signerEmail', ''),
  case when item.value ->> 'method' = 'typed' then 'typed' else 'drawn' end,
  nullif(item.value ->> 'signatureText', ''),
  coalesce(item.value -> 'strokes', '[]'::jsonb),
  coalesce(item.value ->> 'consentText', ''),
  coalesce(nullif(item.value ->> 'acceptedAt', '')::timestamptz, now()),
  item.value -> 'acceptedSnapshot'
from public.org_documents doc
cross join lateral jsonb_array_elements(coalesce(doc.document -> 'signatures', '[]'::jsonb))
  with ordinality as item(value, ordinality)
where doc.document_key = 'signatures'
  and nullif(item.value ->> 'id', '') is not null
  and nullif(item.value ->> 'quoteId', '') is not null
  and item.value -> 'acceptedSnapshot' is not null
on conflict (organization_id, id) do nothing;

commit;
