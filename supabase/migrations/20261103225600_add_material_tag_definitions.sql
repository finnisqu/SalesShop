-- Company-level definitions for existing material/variant feature tags.
-- Additive JSONB column; existing organization RLS controls read/write permissions.
ALTER TABLE public.organizations
 ADD COLUMN IF NOT EXISTS material_tag_definitions jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.organizations.material_tag_definitions IS
 'Company-wide editable descriptions and labels for material feature tags.';
