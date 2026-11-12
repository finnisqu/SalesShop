-- Generic organization-wide Other products worktable.
-- Reuses organizations SELECT/UPDATE RLS (members read, admins update).
alter table public.organizations
 add column if not exists other_catalog jsonb not null default '[]'::jsonb;
comment on column public.organizations.other_catalog is
 'Organization-owned generic catalog items and variants, edited by organization admins under existing organizations RLS.';
