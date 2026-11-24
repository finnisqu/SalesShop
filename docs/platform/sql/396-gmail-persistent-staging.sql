-- #396 — STAGING ONLY. Do not add to production migrations until isolated
-- two-organization auth, encrypted-token, revocation and rollback tests pass.
-- Personal Gmail connections are scoped to one authenticated SalesShop user
-- and organization, NOT shared organization-wide OAuth credentials.
begin;
create table if not exists public.gmail_oauth_connections396 (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 mailbox text not null check (length(mailbox) between 3 and 254),
 refresh_ciphertext text not null check (length(refresh_ciphertext) between 24 and 8192),
 refresh_nonce text not null check (length(refresh_nonce) between 12 and 128),
 key_version integer not null default 1 check (key_version = 1),
 granted_scope text not null
  check (granted_scope = 'https://www.googleapis.com/auth/gmail.readonly'),
 status text not null default 'active' check (status in ('active','reauthorize')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 last_verified_at timestamptz,
 primary key(organization_id,user_id),
 constraint gmail396_mailbox_normalized check (mailbox=lower(btrim(mailbox)) and
  mailbox ~ '^[^ @]+@[^ @]+[.][^ @]+$')
);
comment on table public.gmail_oauth_connections396 is
 'Private encrypted Gmail OAuth refresh tokens; service-role Worker access only; staging #396';
alter table public.gmail_oauth_connections396 enable row level security;
-- No policies for anon/authenticated, including SELECT. Worker checks both
-- Supabase Auth user identity AND org membership at every request.
revoke all on public.gmail_oauth_connections396 from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.gmail_oauth_connections396 to service_role;
create index if not exists gmail396_mailbox_idx
 on public.gmail_oauth_connections396(organization_id,mailbox);
-- Supports auth.users deletion and user-centric credential administration.
create index if not exists gmail396_user_idx
 on public.gmail_oauth_connections396(user_id);
commit;
