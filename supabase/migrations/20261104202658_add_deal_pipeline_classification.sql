-- Adds only the classification field; existing deals stay unassigned.
-- No changes to organization RLS or stage transitions.
alter table public.projects
  add column if not exists pipeline text;

alter table public.projects
  add constraint projects_pipeline_allowed
  check (pipeline is null or pipeline in ('residential', 'commercial', 'multifamily'));

comment on column public.projects.pipeline is
  'Deal pipeline classification: residential, commercial, multifamily; null represents unassigned legacy deals.';
