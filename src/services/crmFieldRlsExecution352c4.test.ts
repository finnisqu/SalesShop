import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(
 new URL('../../docs/platform/sql/'+path,import.meta.url),'utf8');
const runner=read('352c4-disposable-run.psql');
const fixtures=read('352c4-disposable-fixtures.psql');
const matrix=read('352c4-disposable-negative-matrix.psql');
const schema=read('352c3-staging-only-schema.sql');

describe('Batch 352c4 staging-only RLS execution preparation',()=>{
 it('runs only with operator-confirmed disposable mode and explicit runner',()=>{
  expect(runner).toContain('disposable_confirmed');
  expect(runner).toContain('SET app.salesshop_disposable_custom_field_test');
  expect(runner).toContain('352c3-staging-only-schema.sql');
  expect(runner).toContain('352c4-disposable-fixtures.psql');
  expect(runner).toContain('352c3-disposable-role-matrix.psql');
  expect(runner).toContain('352c4-disposable-negative-matrix.psql');
  expect(runner).not.toContain('supabase db push');
 });
 it('has no automatic or production migration placement',()=>{
  expect(schema).toContain('NOT A PRODUCTION MIGRATION');
  expect(fixtures).toContain('DISPOSABLE');
  expect(matrix).toContain('disposable');
 });
 it('refuses unmarked fixture installation and repeated seed collisions',()=>{
  expect(fixtures).toContain("current_setting('app.salesshop_disposable_custom_field_test',true)");
  expect(fixtures).toContain('Fixture already exists');
  expect(fixtures).toContain('BEGIN;');
  expect(fixtures).toContain('COMMIT;');
 });
 it('uses fake users and test-only records, never real customer identifiers',()=>{
  expect(fixtures).toContain('352c4-viewer@invalid.example');
  expect(fixtures).toContain('352c4-outsider@invalid.example');
  expect(fixtures).toContain('352c4 Fixture Company A');
  expect(fixtures).toContain('352c4 Fixture Company B');
  expect(fixtures).toContain('352c4 Fixture Company A Alt');
  expect(fixtures).toContain('c352c4_public_note');
  expect(fixtures).not.toContain('World Stone');
 });
 it('seeds all relevant role/organization states',()=>{
  for(const role of ["'viewer'","'member'","'admin'"]){
   expect(fixtures).toContain(role);
  }
  expect(fixtures).toContain("'purchasing'");
  expect(fixtures).toContain("'salesperson'");
  expect(fixtures).toContain(":'org_b'");
  expect(fixtures).toContain(":'outsider_uid'");
 });
 it('seeds real composite Company, Person and Deal record targets',()=>{
  expect(fixtures).toContain('INSERT INTO public.companies');
  expect(fixtures).toContain('INSERT INTO public.contacts');
  expect(fixtures).toContain('INSERT INTO public.projects');
  expect(fixtures).toContain("'Discovery'");
 });
 it('checks actual RLS-enabled tables and anonymous Data API privileges',()=>{
  expect(matrix).toContain('c.relrowsecurity');
  expect(matrix).toContain("has_table_privilege('anon'");
  expect(matrix).toContain("has_table_privilege('authenticated'");
 });
 it('positively proves CRM-editor write access before negative checks',()=>{
  expect(matrix).toContain('CRM editor cannot update an allowed custom field');
  expect(matrix).toContain('Editor inserted into hidden admins-only field');
  expect(matrix).toContain('CRM editor modified organization field definition');
 });
 it('validates constraints and typed fields with positive/negative writes',()=>{
  expect(matrix).toContain('Admin positive choice value write failed');
  expect(matrix).toContain('app.test_company_a_alt');
  for(const assertion of [
   'Invalid choice inserted','Removed an in-use choice option',
   'Wrong record type attached','Number inserted into Text definition',
   'Moved an existing custom value','Stored multiple typed value columns',
   'Duplicate field/record value was stored','paused',
  ])expect(matrix).toContain(assertion);
 });
 it('revokes live membership and checks neither metadata nor values leak',()=>{
  expect(matrix).toContain('DELETE FROM public.organization_members');
  expect(matrix).toContain("'request.jwt.claim.sub'");
  expect(matrix).toContain('Revoked editor can still read definitions');
  expect(matrix).toContain('Revoked editor can still read values');
 });
 it('rolls back every write performed during negative tests',()=>{
  expect(matrix).toContain('BEGIN;');
  expect(matrix).toContain('ROLLBACK;');
  expect(matrix).not.toContain('COMMIT;');
 });
 it('keeps every SQL script separate from production migration folders',()=>{
  const guide=readFileSync(new URL('../../docs/platform/81-custom-field-rls-runbook-352c4.md',import.meta.url),'utf8');
  // Test durable safety instructions, not a time-sensitive staging status sentence.
  expect(guide).toContain('Prepared, NOT EXECUTED');
  expect(guide).toContain('352c4-disposable-run.psql');
  expect(guide).toContain('DO NOT use a production connection URL');
  expect(guide).toContain('Actual disposable Postgres role and negative tests passing.');
 });
});
