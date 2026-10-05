begin;

create table if not exists public.quote_shares (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  quote_id text not null,
  revision integer not null check (revision >= 0),
  public_token text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked', 'signed')),
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  revoked_at timestamptz,
  signed_at timestamptz,
  primary key (organization_id, id),
  constraint quote_shares_revision_fkey
    foreign key (organization_id, quote_id, revision)
    references public.quote_revisions(organization_id, quote_id, revision)
    on delete cascade
);

create unique index if not exists quote_shares_one_active_per_quote_idx
  on public.quote_shares(organization_id, quote_id)
  where status = 'active';
create index if not exists quote_shares_organization_quote_idx
  on public.quote_shares(organization_id, quote_id, revision);
create index if not exists quote_shares_expires_idx
  on public.quote_shares(expires_at)
  where status = 'active' and expires_at is not null;
create unique index if not exists signatures_quote_revision_unique_idx
  on public.signatures(organization_id, quote_id, revision);

alter table public.quote_shares enable row level security;

create policy quote_shares_members_select
  on public.quote_shares for select to authenticated
  using (private.is_org_member(organization_id));
create policy quote_shares_members_insert
  on public.quote_shares for insert to authenticated
  with check (private.is_org_member(organization_id));
create policy quote_shares_members_update
  on public.quote_shares for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
create policy quote_shares_members_delete
  on public.quote_shares for delete to authenticated
  using (private.is_org_member(organization_id));

grant select, insert, update, delete on public.quote_shares to authenticated;
revoke all on public.quote_shares from anon;

commit;
