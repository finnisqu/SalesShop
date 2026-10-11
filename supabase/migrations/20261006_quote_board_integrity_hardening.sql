-- Harden quote lifecycle snapshots and board stage history.

begin;

alter table public.quotes
  add column if not exists pricing_division text,
  add column if not exists archived_at timestamptz;

create index if not exists quotes_organization_archived_idx
  on public.quotes (organization_id, archived_at)
  where archived_at is not null;

alter table public.projects
  add column if not exists stage_changed_at timestamptz;

update public.projects
set stage_changed_at = coalesce(stage_changed_at, updated_at, created_at, now())
where stage_changed_at is null;

comment on column public.quotes.archived_at is
  'Business-record archive timestamp. Archived commercial documents remain durable instead of being deleted.';
comment on column public.quotes.pricing_division is
  'Pricing context frozen with the quote revision and retained on the live commercial record.';
comment on column public.projects.stage_changed_at is
  'Timestamp of the most recent actual pipeline-stage transition; ordinary card edits do not change it.';

commit;
