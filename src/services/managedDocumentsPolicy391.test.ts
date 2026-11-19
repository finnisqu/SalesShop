import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';

const stage=new URL('../../docs/platform/sql/391-private-documents-staging.sql',import.meta.url);
const noAuto=new URL('../../supabase/migrations/20261119000000_crm_private_documents_391.sql',import.meta.url);
const matrix=new URL('../../scripts/security/staging-documents-391.mjs',import.meta.url);
const sql=readFileSync(stage,'utf8');
const script=readFileSync(matrix,'utf8');

describe('#391 — staged private Storage release gate (static contract)',()=>{
 it('cannot be swept into routine production migration pushes',()=>{
  expect(existsSync(stage)).toBe(true);
  expect(existsSync(noAuto)).toBe(false);
  expect(sql).toContain('STAGING/DISPOSABLE ONLY; NOT AN AUTOMATIC PRODUCTION MIGRATION');
  expect(sql).toContain('Do not run on production');
 });
 it('creates only a private bucket, fails closed on existing unsafe bucket settings',()=>{
  expect(sql).toContain("'sales-documents','sales-documents',false,15728640");
  expect(sql).toContain("b.public is distinct from false");
  expect(sql).toContain("b.file_size_limit is distinct from 15728640");
  expect(sql).toContain("b.allowed_mime_types is distinct from");
  expect(sql).not.toMatch(/'sales-documents','sales-documents',true/);
 });
 it('ties storage paths to immutable randomized org/file UUIDs',()=>{
  expect(sql).toContain("id uuid primary key default gen_random_uuid()");
  expect(sql).toContain("(organization_id::text || '/' || id::text) stored");
  expect(sql).toContain("new.organization_id is distinct from old.organization_id");
  expect(sql).toContain("new.object_path is distinct from old.object_path");
  expect(sql).toContain("new.size_bytes is distinct from old.size_bytes");
  expect(sql).toContain("new.created_at := now()");
 });
 it('requires real Company/Deal targets; Quote attachment remains blocked',()=>{
  expect(sql).toContain("target_kind in ('company','deal')");
  expect(sql).toContain("private.can_edit_org_area(organization_id,'crm')");
  expect(sql).toContain("private.is_org_member(organization_id)");
  expect(sql).toContain("where c.id=target_id and c.organization_id=crm_file_objects.organization_id");
  expect(sql).toContain("where p.id=target_id and p.organization_id=crm_file_objects.organization_id");
  expect(sql).not.toContain("target_kind in ('company','deal','quote')");
 });
 it('does not allow client-controlled ready rows or unverified byte counts',()=>{
  expect(sql).toContain("status<>'pending' or new.size_bytes is not null");
  expect(sql).toContain("o.metadata->>'size'");
  expect(sql).toContain("o.metadata->>'mimetype'");
  expect(sql).toContain("new.size_bytes := stored_bytes");
  expect(sql).toContain("new.status='ready'");
  expect(sql).toContain("old.status='pending' and new.status='ready'");
 });
 it('serializes 500 MiB quota reservations including pending and trash',()=>{
  expect(sql).toContain("pg_catalog.pg_advisory_xact_lock");
  expect(sql).toContain("f.status='pending' then 15728640::bigint");
  expect(sql).toContain("reserved_bytes + 15728640 > 524288000");
 });
 it('keeps lifecycle recovery to CRM editors and rejects Storage overwrites',()=>{
  expect(sql).toContain("private.can_edit_org_area(f.organization_id,'crm')");
  expect(sql).toContain("f.status='trashed' or f.status='pending'");
  expect(sql).not.toContain("on storage.objects for update");
  expect(sql).toContain("uploaded_by=(select auth.uid())");
  expect(sql).toContain("status='trashed' and private.can_edit_org_area(organization_id,'crm')");
 });
 it('provides real staging-only auth and Storage tests',()=>{
  expect(script).toContain("STAGING_RELEASE_ACK");
  expect(script).toContain("disposable-documents-fixtures");
  expect(script).toContain("pvchgibllozuwickhfqz.supabase.co");
  for(const role of ["'owner'","'editor'","'viewer'","'outsider'"])
   expect(script).toContain(role);
  expect(script).toContain("Wrong object path cannot be uploaded");
  expect(script).toContain("Client cannot spoof provider-derived size");
  expect(script).toContain("Foreign organization cannot read metadata or download bytes");
  expect(script).toContain("A second CRM editor can clean another uploader");
 });
});
