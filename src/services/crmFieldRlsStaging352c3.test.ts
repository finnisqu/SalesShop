import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const source=(path:string)=>
 readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const schema=source('docs/platform/sql/352c3-staging-only-schema.sql');
const matrix=source('docs/platform/sql/352c3-disposable-role-matrix.psql');
const guide=source('docs/platform/77-custom-field-disposable-rls-kit-352c3.md');

describe('Batch 352c3 — disposable-only CRM custom-field RLS candidate',()=>{
 it('is outside migration directories and refuses unmarked environments before any DDL',()=>{
  expect(schema).toContain('STAGING/DISPOSABLE ONLY. NOT A PRODUCTION MIGRATION');
  expect(schema).toContain("current_setting('app.salesshop_disposable_custom_field_test',true)");
  expect(schema).toContain("RAISE EXCEPTION 'Refusing custom-field schema changes");
  expect(schema.indexOf('RAISE EXCEPTION \'Refusing custom-field schema changes'))
   .toBeLessThan(schema.indexOf('CREATE TABLE public.crm_field_definitions'));
  expect(guide).toContain('NO PRODUCTION MIGRATION APPLIED');
 });
 it('creates only the two dedicated, non-polymorphic-field CRM tables',()=>{
  expect((schema.match(/CREATE TABLE public\./g)??[])).toHaveLength(2);
  expect(schema).toContain('CREATE TABLE public.crm_field_definitions');
  expect(schema).toContain('CREATE TABLE public.crm_field_values');
  expect(schema).toContain('organization_id uuid NOT NULL');
  expect(schema).toContain('PRIMARY KEY(organization_id,id)');
  expect(schema).toContain('UNIQUE(organization_id,record_type,field_key)');
 });
 it('uses the existing organization-scoped composite CRM foreign keys',()=>{
  expect(schema).toContain('FOREIGN KEY (organization_id,field_id,record_type)');
  expect(schema).toContain('REFERENCES public.crm_field_definitions(organization_id,id,record_type)');
  for(const [column,table] of [
   ['company_id','companies'],['contact_id','contacts'],['project_id','projects'],
  ]){
   expect(schema).toContain('FOREIGN KEY (organization_id,'+column+')');
   expect(schema).toContain('REFERENCES public.'+table+'(organization_id,id) ON DELETE CASCADE');
  }
 });
 it('requires exactly one real record target and typed field value per row',()=>{
  expect(schema).toContain("record_type='company' AND company_id IS NOT NULL");
  expect(schema).toContain("record_type='person' AND company_id IS NULL AND contact_id IS NOT NULL");
  expect(schema).toContain("record_type='deal' AND company_id IS NULL AND contact_id IS NULL AND project_id IS NOT NULL");
  expect(schema).toContain('num_nonnulls(value_text,value_number,value_date,value_choice,value_boolean)=1');
  expect(schema).toContain('value_number::text NOT IN');
 });
 it('prevents duplicate field values for each record type',()=>{
  for(const [name,id] of [
   ['company','company_id'],['contact','contact_id'],['project','project_id'],
  ]){
   expect(schema).toContain('CREATE UNIQUE INDEX crm_field_value_'+name+'_unique');
   expect(schema).toContain('(organization_id,'+id+',field_id) WHERE '+id+' IS NOT NULL');
  }
 });
 it('enables RLS before granting authenticated Data API privileges',()=>{
  for(const table of ['crm_field_definitions','crm_field_values']){
   expect(schema).toContain('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY;');
   expect(schema.indexOf('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY;'))
    .toBeLessThan(schema.indexOf('GRANT SELECT,INSERT,UPDATE'));
  }
  expect(schema).toContain('FROM PUBLIC,anon;');
  expect(schema).toContain('TO authenticated;');
  expect(schema).not.toContain('TO anon;');
 });
 it('restricts both definition and value SELECT policies by membership and visibility',()=>{
  expect(schema).toContain('CREATE POLICY crm_field_defs_select');
  expect(schema).toContain('CREATE POLICY crm_field_values_select');
  expect(schema).toContain('private.is_org_member(organization_id)');
  expect(schema).toContain("visibility='organization'");
  expect(schema).toContain("visibility='crm_editors'");
  expect(schema).toContain("visibility='admins'");
  expect(schema).toContain("private.can_edit_org_area(organization_id,'crm')");
  expect(schema).toContain('private.is_org_admin(organization_id)');
  expect(schema).toContain('SELECT 1 FROM public.crm_field_definitions d');
 });
 it('permits definitions to be managed only by organization admins',()=>{
  expect(schema).toContain('CREATE POLICY crm_field_defs_insert');
  expect(schema).toContain('CREATE POLICY crm_field_defs_update');
  expect(schema).toContain('WITH CHECK (private.is_org_admin(organization_id));');
  expect(schema).not.toContain('CREATE POLICY crm_field_defs_delete');
  expect(schema).not.toContain('GRANT SELECT,INSERT,UPDATE,DELETE ON public.crm_field_definitions');
 });
 it('requires CRM-edit rights and an active visible definition to change a value',()=>{
  for(const name of ['insert','update','delete']){
   expect(schema).toContain('CREATE POLICY crm_field_values_'+name);
  }
  expect(schema).toContain("private.can_edit_org_area(organization_id,'crm')");
  expect(schema).toContain('AND d.record_type=crm_field_values.record_type AND d.active');
  expect(schema).toContain('FOR UPDATE TO authenticated');
  expect(schema).toContain('WITH CHECK (');
 });
 it('uses invoker triggers, validates types/options and never bypasses RLS',()=>{
  expect((schema.match(/SECURITY INVOKER/g)??[]).length).toBeGreaterThanOrEqual(2);
  expect(schema).not.toContain('SECURITY DEFINER');
  expect(schema).toContain('CREATE TRIGGER crm_field_definition_guard');
  expect(schema).toContain('CREATE TRIGGER crm_field_value_guard');
  expect(schema).toContain('Custom value does not match its field type or choice options');
  expect(schema).toContain('Duplicate custom-field choices are not allowed');
  expect(schema).toContain('Choice field requires 2 to 20 options');
  expect(schema).toContain('Custom-field definition unavailable or paused');
 });
 it('blocks silent identity reassignments and wider visibility without review',()=>{
  expect(schema).toContain('Published custom-field identity and type are immutable');
  expect(schema).toContain('Custom value identity and record are immutable');
  expect(schema).toContain('Field revision must advance by one');
  expect(schema).toContain('Widening custom-field visibility requires a reviewed publication');
  expect(schema).toContain('An option still used by CRM values cannot be removed');
 });
 it('makes the disposable test matrix fail closed and rollback its fixture writes',()=>{
  expect(matrix).toContain("current_setting('app.salesshop_disposable_custom_field_test',true)");
  expect(matrix).toContain('Refusing RLS role impersonation outside marked disposable DB');
  expect(matrix.trim().endsWith('ROLLBACK;')).toBe(true);
  expect(matrix).toContain('\\set ON_ERROR_STOP on');
  expect(matrix).toContain('SET LOCAL ROLE authenticated;');
  expect(matrix).toContain('SET LOCAL ROLE anon;');
  expect(matrix).toContain('request.jwt.claim.sub');
 });
 it('tests outsider/viewer/editor/admin isolation for both definitions and values',()=>{
  for(const who of ['viewer','limited','editor','admin','outsider'])
   expect(matrix).toContain('DO $'+who+'$');
  expect(matrix).toContain('Viewer: expected 1 visible definition');
  expect(matrix).toContain('Non-CRM member: expected 1 visible definition');
  expect(matrix).toContain('Editor: expected 2 visible definitions');
  expect(matrix).toContain('Admin: expected 3 visible definitions');
  expect(matrix).toContain('Outsider can read foreign values');
  expect(matrix).toContain('Anonymous role has table access');
  expect(matrix).toContain('Editor modified admins-only custom value');
 });
 it('tests administrative privacy widening and cross-tenant record rejection',()=>{
  expect(matrix).toContain("SET visibility='organization', revision=revision+1");
  expect(matrix).toContain('Admin widened visibility without reviewed publication');
  expect(matrix).toContain("current_setting('app.test_company_b')");
  expect(matrix).toContain('Cross-tenant Company foreign key was not enforced');
 });
 it('requires a real disposable DB, negative RLS execution and manual release approval',()=>{
  expect(guide).toContain('No disposable Supabase branch is currently connected');
  expect(guide).toContain('not executed against a database');
  expect(guide).toContain('manual approval');
  expect(guide).toContain('psql');
  expect(guide).toContain('Supabase CLI v3');
  expect(guide).toContain('real RLS');
 });
});
