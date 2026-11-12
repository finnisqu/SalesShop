-- Immutable bid deadline baseline with responsible, auditable reschedules.
-- Nullable original date intentionally does not guess historical dates for legacy Deals.
ALTER TABLE public.projects
 ADD COLUMN IF NOT EXISTS original_due_date date,
 ADD COLUMN IF NOT EXISTS due_date_responsibility text,
 ADD COLUMN IF NOT EXISTS due_date_change_reason text,
 ADD COLUMN IF NOT EXISTS due_date_history jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.projects.original_due_date IS 'First recorded bid due date, immutable through ordinary rescheduling. Older deals may be null.';
COMMENT ON COLUMN public.projects.due_date_responsibility IS 'Latest deadline shift attribution: internal, external, or neutral';
COMMENT ON COLUMN public.projects.due_date_history IS 'Chronological rescheduling history including from/to, reason, owner, and timestamp';
