import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {crmOwnerLabel,initialCrmOwnerUserId} from './crmRecordOwnership';
const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
describe('Creator ownership defaults',()=>{
 it('assigns new cloud CRM records to the creating user, not all teammates',()=>{
  expect(initialCrmOwnerUserId('cloud','member-A')).toBe('member-A');
  expect(initialCrmOwnerUserId('cloud',undefined)).toBeUndefined();
  expect(initialCrmOwnerUserId('local','member-A')).toBeUndefined();
  const store=source('src/store/crmStore.ts');
  expect(store.match(/ownerUserId:initialCrmOwnerUserId\(/g)).toHaveLength(2);
  expect(store).toContain('assignedUserId:useAuthStore.getState().mode');
  const quotes=source('src/store/quoteStore.ts');
  expect(quotes).toContain("ownerUserId: useAuthStore.getState().mode === 'cloud'");
 });
 it('does not relabel legacy records as owned',()=>{
  expect(crmOwnerLabel(undefined,'member-A','cloud')).toMatch(/Unassigned/);
  expect(crmOwnerLabel('member-A','member-A','cloud')).toBe('You');
  expect(crmOwnerLabel('member-B','member-A','cloud')).toBe('Assigned teammate');
  expect(crmOwnerLabel(undefined,undefined,'local')).toMatch(/local workspace/);
 });
 it('roundtrips owner from cloud and local cache without overwriting SQL default',()=>{
  const repo=source('src/data/crmRepository.ts');
  const sync=source('src/services/normalizedCrmSync.ts');
  const types=source('src/types/crm.ts');
  expect(types.match(/ownerUserId\?: string;/g)).toHaveLength(2);
  expect(repo).toContain('ownerUserId: raw.ownerUserId');
  expect(sync).toContain('ownerUserId:valueOrUndefined(row.owner_user_id)');
  // Owner is established at database insertion by auth.uid(), not rewritten by a
  // later stale client upsert that might belong to another salesperson.
  expect(sync).not.toContain('owner_user_id: company.');
  expect(sync).not.toContain('owner_user_id: contact.');
  const migration=source('supabase/migrations/20261110164748_crm_company_contact_creator_ownership_20261110.sql');
  expect(migration).toContain('alter table public.companies add column if not exists owner_user_id');
  expect(migration).toContain('alter table public.contacts add column if not exists owner_user_id');
  expect(migration).toContain('set default auth.uid()');
  expect(migration).toContain('on delete set null (owner_user_id)');
 });
 it('shows actual owner/legacy state across full and quick CRM record views',()=>{
  expect(source('src/components/CompanyRecordPage.tsx')).toContain('crmOwnerLabel(company.ownerUserId,userId,authMode)');
  expect(source('src/components/PersonRecordPage.tsx')).toContain('crmOwnerLabel(person.ownerUserId,userId,authMode)');
  const preview=source('src/components/RecordPreviewDrawer.tsx');
  expect(preview).toContain('crmOwnerLabel(company.ownerUserId,userId,authMode)');
  expect(preview).toContain('crmOwnerLabel(person.ownerUserId,userId,authMode)');
 });
});
describe('Reliability recovery',()=>{
 it('does not blank Suppliers when one of six feeds fails',()=>{
  const suppliers=source('src/components/SuppliersWorkspace.tsx');
  expect(suppliers).toContain('Promise.allSettled([');
  expect(suppliers).toContain("if(p.status==='fulfilled')setProfiles(p.value)");
  expect(suppliers).toContain('fetchRevision.current+=1');
  expect(suppliers).toContain('Retry loading suppliers');
  expect(suppliers).toContain('Available records are shown');
 });
 it('retries the actual Cloud document instead of changing selected Quote',()=>{
  const cloud=source('src/services/cloudSync.ts');
  const toolbar=source('src/components/SalesDocumentToolbar.tsx');
  expect(cloud).toContain('window.addEventListener(CLOUD_DOCUMENT_RETRY_EVENT,retryOnDemand)');
  expect(cloud).toContain('window.removeEventListener(CLOUD_DOCUMENT_RETRY_EVENT,retryOnDemand)');
  expect(toolbar).toContain('window.dispatchEvent(new Event(CLOUD_DOCUMENT_RETRY_EVENT))');
  expect(toolbar).not.toContain('selectQuote(quote.id)');
 });
});
