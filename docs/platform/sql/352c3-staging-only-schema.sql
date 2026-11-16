-- #352c3 — STAGING/DISPOSABLE ONLY. NOT A PRODUCTION MIGRATION.
-- DO NOT put this file into supabase/migrations or run it on a live project.
-- Requires the existing SalesShop public CRM and private membership functions.
-- Refuses to run unless an operator explicitly sets
--   SET app.salesshop_disposable_custom_field_test = 'yes';
-- on an isolated, disposable database session.
BEGIN;
DO $guard$
BEGIN
 IF coalesce(current_setting('app.salesshop_disposable_custom_field_test',true),'') <> 'yes' THEN
  RAISE EXCEPTION 'Refusing custom-field schema changes outside an explicitly marked disposable DB';
 END IF;
 IF to_regclass('public.crm_field_definitions') IS NOT NULL
   OR to_regclass('public.crm_field_values') IS NOT NULL THEN
  RAISE EXCEPTION 'Custom-field tables already exist; refusing to overwrite their data';
 END IF;
END
$guard$;

CREATE TABLE public.crm_field_definitions (
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 id text NOT NULL CHECK(length(trim(id)) BETWEEN 1 AND 100),
 record_type text NOT NULL CHECK(record_type IN ('company','person','deal')),
 field_key text NOT NULL CHECK(
  field_key ~ '^[a-z][a-z0-9_]{0,39}$'
  AND field_key NOT IN ('id','name','email','phone','type','status','stage','pipeline',
   'company_id','companyid','created_at','createdat','updated_at','updatedat',
   'owner_user_id','owneruserid','title','notes','due_date','duedate','kind','amount',
   'assigned_user_id','assigneduserid','metadata','custom_fields','customfields')),
 label text NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 48),
 field_type text NOT NULL CHECK(field_type IN ('text','number','date','choice','boolean')),
 visibility text NOT NULL DEFAULT 'crm_editors'
  CHECK(visibility IN ('organization','crm_editors','admins')),
 description text CHECK(description IS NULL OR length(description)<=160),
 options jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(options)='array'),
 active boolean NOT NULL DEFAULT true,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),
 UNIQUE(organization_id,id,record_type),
 UNIQUE(organization_id,record_type,field_key)
);
CREATE INDEX crm_field_defs_visible_idx
 ON public.crm_field_definitions(organization_id,record_type,visibility);

CREATE TABLE public.crm_field_values (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL,
 field_id text NOT NULL,
 record_type text NOT NULL CHECK(record_type IN ('company','person','deal')),
 company_id text,
 contact_id text,
 project_id text,
 value_text text CHECK(value_text IS NULL OR length(value_text)<=500),
 value_number numeric CHECK(value_number IS NULL OR value_number::text NOT IN ('NaN','Infinity','-Infinity')),
 value_date date,
 value_choice text CHECK(value_choice IS NULL OR length(value_choice)<=48),
 value_boolean boolean,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT crm_field_exactly_one_target CHECK (
  (record_type='company' AND company_id IS NOT NULL AND contact_id IS NULL AND project_id IS NULL)
  OR (record_type='person' AND company_id IS NULL AND contact_id IS NOT NULL AND project_id IS NULL)
  OR (record_type='deal' AND company_id IS NULL AND contact_id IS NULL AND project_id IS NOT NULL)),
 CONSTRAINT crm_field_exactly_one_value CHECK(
  num_nonnulls(value_text,value_number,value_date,value_choice,value_boolean)=1),
 CONSTRAINT crm_value_definition_fk
  FOREIGN KEY (organization_id,field_id,record_type)
  REFERENCES public.crm_field_definitions(organization_id,id,record_type)
  ON DELETE CASCADE,
 CONSTRAINT crm_value_company_fk
  FOREIGN KEY (organization_id,company_id)
  REFERENCES public.companies(organization_id,id) ON DELETE CASCADE,
 CONSTRAINT crm_value_contact_fk
  FOREIGN KEY (organization_id,contact_id)
  REFERENCES public.contacts(organization_id,id) ON DELETE CASCADE,
 CONSTRAINT crm_value_project_fk
  FOREIGN KEY (organization_id,project_id)
  REFERENCES public.projects(organization_id,id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX crm_field_value_company_unique
 ON public.crm_field_values(organization_id,company_id,field_id) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX crm_field_value_contact_unique
 ON public.crm_field_values(organization_id,contact_id,field_id) WHERE contact_id IS NOT NULL;
CREATE UNIQUE INDEX crm_field_value_project_unique
 ON public.crm_field_values(organization_id,project_id,field_id) WHERE project_id IS NOT NULL;
CREATE INDEX crm_field_value_field_lookup
 ON public.crm_field_values(organization_id,field_id,record_type);

-- SECURITY INVOKER only. No unexposed privileged shortcuts that bypass RLS.
CREATE FUNCTION private.crm_field_definition_guard_352c3()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $definition$
DECLARE
 opt jsonb;
 opt_label text;
 seen_options text[]:=ARRAY[]::text[];
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
   OR NEW.id IS DISTINCT FROM OLD.id
   OR NEW.record_type IS DISTINCT FROM OLD.record_type
   OR NEW.field_key IS DISTINCT FROM OLD.field_key
   OR NEW.field_type IS DISTINCT FROM OLD.field_type
   OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
   RAISE EXCEPTION 'Published custom-field identity and type are immutable';
  END IF;
  IF NEW.revision <> OLD.revision+1 THEN
   RAISE EXCEPTION 'Field revision must advance by one';
  END IF;
  -- Broadening visibility exposes all existing values. Require a separate,
  -- approved audited publication mechanism; direct updates are blocked.
  IF (CASE NEW.visibility WHEN 'admins' THEN 0 WHEN 'crm_editors' THEN 1 ELSE 2 END)
    > (CASE OLD.visibility WHEN 'admins' THEN 0 WHEN 'crm_editors' THEN 1 ELSE 2 END)
  THEN
   RAISE EXCEPTION 'Widening custom-field visibility requires a reviewed publication';
  END IF;
  IF OLD.field_type='choice' AND EXISTS(
   SELECT 1 FROM public.crm_field_values v
   WHERE v.organization_id=NEW.organization_id AND v.field_id=NEW.id
    AND v.value_choice IS NOT NULL AND NOT (NEW.options ? v.value_choice)
  ) THEN
   RAISE EXCEPTION 'An option still used by CRM values cannot be removed';
  END IF;
  NEW.updated_at=now();
 ELSIF NEW.revision<>1 THEN
  RAISE EXCEPTION 'New field revision must be 1';
 END IF;
 IF NEW.field_type='choice' THEN
  IF jsonb_array_length(NEW.options) NOT BETWEEN 2 AND 20 THEN
   RAISE EXCEPTION 'Choice field requires 2 to 20 options';
  END IF;
  FOR opt IN SELECT value FROM jsonb_array_elements(NEW.options) LOOP
   IF jsonb_typeof(opt)<>'string' OR length(trim(opt #>> '{}')) NOT BETWEEN 1 AND 48 THEN
    RAISE EXCEPTION 'Choice options must be nonblank strings of at most 48 characters';
   END IF;
   opt_label=lower(trim(opt #>> '{}'));
   IF opt_label=ANY(seen_options) THEN
    RAISE EXCEPTION 'Duplicate custom-field choices are not allowed';
   END IF;
   seen_options=array_append(seen_options,opt_label);
  END LOOP;
 ELSIF NEW.options <> '[]'::jsonb THEN
  RAISE EXCEPTION 'Non-choice fields cannot hold options';
 END IF;
 RETURN NEW;
END
$definition$;

CREATE FUNCTION private.crm_field_value_guard_352c3()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $value$
DECLARE def record;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id
   OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
   OR NEW.field_id IS DISTINCT FROM OLD.field_id
   OR NEW.record_type IS DISTINCT FROM OLD.record_type
   OR NEW.company_id IS DISTINCT FROM OLD.company_id
   OR NEW.contact_id IS DISTINCT FROM OLD.contact_id
   OR NEW.project_id IS DISTINCT FROM OLD.project_id
   OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
   RAISE EXCEPTION 'Custom value identity and record are immutable';
  END IF;
 END IF;
 SELECT field_type,active,options INTO def
 FROM public.crm_field_definitions
 WHERE organization_id=NEW.organization_id AND id=NEW.field_id
  AND record_type=NEW.record_type;
 IF NOT FOUND OR NOT def.active THEN
  RAISE EXCEPTION 'Custom-field definition unavailable or paused';
 END IF;
 IF NOT (
  (def.field_type='text' AND NEW.value_text IS NOT NULL)
  OR (def.field_type='number' AND NEW.value_number IS NOT NULL)
  OR (def.field_type='date' AND NEW.value_date IS NOT NULL)
  OR (def.field_type='choice' AND NEW.value_choice IS NOT NULL
    AND def.options ? NEW.value_choice)
  OR (def.field_type='boolean' AND NEW.value_boolean IS NOT NULL)
 ) THEN
  RAISE EXCEPTION 'Custom value does not match its field type or choice options';
 END IF;
 NEW.updated_at=now();
 RETURN NEW;
END
$value$;

CREATE TRIGGER crm_field_definition_guard
 BEFORE INSERT OR UPDATE ON public.crm_field_definitions
 FOR EACH ROW EXECUTE FUNCTION private.crm_field_definition_guard_352c3();
CREATE TRIGGER crm_field_value_guard
 BEFORE INSERT OR UPDATE ON public.crm_field_values
 FOR EACH ROW EXECUTE FUNCTION private.crm_field_value_guard_352c3();

-- Enable RLS before giving authenticated clients any table privileges.
ALTER TABLE public.crm_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_field_defs_select ON public.crm_field_definitions
 FOR SELECT TO authenticated USING (
 private.is_org_member(organization_id)
 AND (
  visibility='organization'
  OR (visibility='crm_editors' AND private.can_edit_org_area(organization_id,'crm'))
  OR (visibility='admins' AND private.is_org_admin(organization_id))
 )
);
CREATE POLICY crm_field_defs_insert ON public.crm_field_definitions
 FOR INSERT TO authenticated WITH CHECK (private.is_org_admin(organization_id));
CREATE POLICY crm_field_defs_update ON public.crm_field_definitions
 FOR UPDATE TO authenticated
 USING (private.is_org_admin(organization_id))
 WITH CHECK (private.is_org_admin(organization_id));
-- No general definition DELETE grant or policy: pause rather than destroy.

CREATE POLICY crm_field_values_select ON public.crm_field_values
 FOR SELECT TO authenticated USING (
 private.is_org_member(organization_id)
 AND EXISTS (
  SELECT 1 FROM public.crm_field_definitions d
  WHERE d.organization_id=crm_field_values.organization_id
    AND d.id=crm_field_values.field_id
    AND d.record_type=crm_field_values.record_type
    AND (
     d.visibility='organization'
     OR (d.visibility='crm_editors'
         AND private.can_edit_org_area(crm_field_values.organization_id,'crm'))
     OR (d.visibility='admins'
         AND private.is_org_admin(crm_field_values.organization_id))
    )
 )
);
CREATE POLICY crm_field_values_insert ON public.crm_field_values
 FOR INSERT TO authenticated WITH CHECK (
 private.can_edit_org_area(organization_id,'crm')
 AND EXISTS (
  SELECT 1 FROM public.crm_field_definitions d
  WHERE d.organization_id=crm_field_values.organization_id
   AND d.id=crm_field_values.field_id
   AND d.record_type=crm_field_values.record_type AND d.active
   AND (
    d.visibility='organization'
    OR (d.visibility='crm_editors'
        AND private.can_edit_org_area(crm_field_values.organization_id,'crm'))
    OR (d.visibility='admins'
        AND private.is_org_admin(crm_field_values.organization_id))
   )
 )
);
CREATE POLICY crm_field_values_update ON public.crm_field_values
 FOR UPDATE TO authenticated
 USING (private.can_edit_org_area(organization_id,'crm'))
 WITH CHECK (
 private.can_edit_org_area(organization_id,'crm')
 AND EXISTS (
  SELECT 1 FROM public.crm_field_definitions d
  WHERE d.organization_id=crm_field_values.organization_id
   AND d.id=crm_field_values.field_id
   AND d.record_type=crm_field_values.record_type AND d.active
   AND (
    d.visibility='organization'
    OR (d.visibility='crm_editors'
        AND private.can_edit_org_area(crm_field_values.organization_id,'crm'))
    OR (d.visibility='admins'
        AND private.is_org_admin(crm_field_values.organization_id))
   )
 )
);
CREATE POLICY crm_field_values_delete ON public.crm_field_values
 FOR DELETE TO authenticated
 USING (
 private.can_edit_org_area(organization_id,'crm')
 AND EXISTS (
  SELECT 1 FROM public.crm_field_definitions d
   WHERE d.organization_id=crm_field_values.organization_id
    AND d.id=crm_field_values.field_id
    AND d.record_type=crm_field_values.record_type
    AND (
     d.visibility='organization'
     OR (d.visibility='crm_editors'
         AND private.can_edit_org_area(crm_field_values.organization_id,'crm'))
     OR (d.visibility='admins'
         AND private.is_org_admin(crm_field_values.organization_id))
    )
 )
);
REVOKE ALL ON public.crm_field_definitions,public.crm_field_values FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.crm_field_definitions TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.crm_field_values TO authenticated;
REVOKE ALL ON FUNCTION private.crm_field_definition_guard_352c3() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.crm_field_value_guard_352c3() FROM PUBLIC,anon;

-- This preview creates new schema ONLY on a disposable DB; no client activation.
COMMIT;
