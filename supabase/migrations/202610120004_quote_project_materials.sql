-- Quote-scoped project material shortlist. No tenant RLS changes.
alter table public.quotes add column if not exists project_materials jsonb not null default '[]'::jsonb;
comment on column public.quotes.project_materials is 'Pinned material references for this quote only, including manually entered materials.';
