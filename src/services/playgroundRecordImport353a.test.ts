import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {
 DEMO_RECORDS_FORMAT,DEMO_RECORDS_VERSION,DEMO_RECORDS_MAX_BYTES,
 parseDemoRecordsBundle,sampleDemoRecordsJson,
} from './playgroundRecordImport353a';
const example=()=>sampleDemoRecordsJson();
const edited=(change:(o:any)=>void)=>{
 const obj=JSON.parse(example());change(obj);return JSON.stringify(obj);
};

describe('Batch 353a — fictional Playground import and reset',()=>{
 it('generates a copyable narrow versioned JSON fixture',()=>{
  const sample=JSON.parse(example());
  expect(sample.format).toBe(DEMO_RECORDS_FORMAT);
  expect(sample.version).toBe(DEMO_RECORDS_VERSION);
  expect(Object.keys(sample).sort()).toEqual(
   ['format','version','companies','people','deals','activities','quotes','tasks'].sort());
 });
 it('round trips real CRM, Quotes and Tasks models for local tests',()=>{
  const parsed=parseDemoRecordsBundle(example(),'2026-11-16T15:00:00.000Z');
  expect(parsed.counts).toEqual({
   companies:5,people:4,deals:6,activities:2,quotes:3,tasks:3,
  });
  expect(parsed.crm.schemaVersion).toBe(3);
  expect(parsed.quotes.schemaVersion).toBe(2);
  expect(parsed.crm.contacts[0].companyId).toBe('demo_company_harbor');
  expect(parsed.quotes.quotes[0].projectId).toBe('demo_project_1');
  expect(parsed.tasks[0].linked).toEqual({type:'project',id:'demo_project_1'});
  expect(parsed.tasks[0].workspaceScope).toBe('local:user');
 });
 it('creates a fictional SalesShop quote with correct pricing contract',()=>{
  const q=parseDemoRecordsBundle(example()).quotes.quotes[0];
  expect(q.documentType).toBe('quote');
  expect(q.customerColumns).toEqual({quantity:true,rate:true,lineAmount:true});
  expect(q.lines.every(l=>l.kind==='item'&&l.customerVisible&&l.includeInTotal)).toBe(true);
  expect(q.lines.every(l=>l.pricingMode==='quantity-rate')).toBe(true);
  expect(q.history).toEqual([]);
 });
 it('rejects invalid or unsupported formats and extra columns',()=>{
  for(const json of ['{','{}',edited(o=>o.version=2),
   edited(o=>o.organizationId='real'),edited(o=>o.userId='x'),
   edited(o=>o.companies[0].ownerUserId='real')]){
   expect(()=>parseDemoRecordsBundle(json)).toThrow();
  }
 });
 it('rejects oversized JSON before parsing',()=>{
  expect(()=>parseDemoRecordsBundle('x'.repeat(DEMO_RECORDS_MAX_BYTES+1))).toThrow();
 });
 it('rejects duplicate identities and invalid test prefixes',()=>{
  expect(()=>parseDemoRecordsBundle(edited(o=>o.people[0].id=o.companies[0].id)))
   .toThrow('Duplicate');
  expect(()=>parseDemoRecordsBundle(edited(o=>o.people[0].id='real_contact')))
   .toThrow('demo_');
 });
 it('rejects cross-tenant/unknown relationships rather than silently dangling',()=>{
  for(const json of [
   edited(o=>o.people[0].companyId='demo_nonexistent'),
   edited(o=>o.deals[0].companyId='demo_nonexistent'),
   edited(o=>o.quotes[0].dealId='demo_nonexistent'),
   edited(o=>o.tasks[0].dealId='demo_nonexistent'),
   edited(o=>o.activities[0].personId='demo_nonexistent'),
  ])expect(()=>parseDemoRecordsBundle(json)).toThrow('must reference');
 });
 it('rejects quotes whose company and deal disagree',()=>{
  expect(()=>parseDemoRecordsBundle(edited(o=>o.quotes[0].companyId=o.companies[1].id)))
   .toThrow('must belong');
 });
 it('cannot forge issued signatures or business submission proof',()=>{
  for(const json of [
   edited(o=>o.quotes[0].status='Signed'),
   edited(o=>o.activities[0].type='quote-signed'),
   edited(o=>o.activities[0].metadata={deliveryConfirmed:true}),
   edited(o=>o.tasks[0].submissionConfirmedAt='2026-11-16'),
  ])expect(()=>parseDemoRecordsBundle(json)).toThrow();
 });
 it('requires fictional test-only email domains',()=>{
  expect(()=>parseDemoRecordsBundle(edited(o=>o.people[0].email='real@business.com')))
   .toThrow('.example');
 });
 it('validates exact dates and finite numeric values',()=>{
  for(const json of [
   edited(o=>o.deals[0].dueDate='2026-02-30'),
   edited(o=>o.deals[0].amount=-12),
   edited(o=>o.quotes[0].lines[0].rate=Infinity),
   edited(o=>o.tasks[0].dueDate='garbage'),
  ])expect(()=>parseDemoRecordsBundle(json)).toThrow();
 });
 it('accepts editing to test an empty optional section',()=>{
  const sample=edited(o=>{o.tasks=[];o.activities=[];});
  const parsed=parseDemoRecordsBundle(sample);
  expect(parsed.counts.tasks).toBe(0);
  expect(parsed.counts.activities).toBe(0);
 });
 it('does not import email-delivery, live records or privileged API metadata',()=>{
  const src=readFileSync(new URL('./playgroundRecordImport353a.ts',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../components/DeveloperPlaygroundToolbar.tsx',import.meta.url),'utf8');
  expect(src).not.toContain('supabase.from(');
  expect(src).not.toContain('fetch(');
  expect(ui).toContain('isDeveloperPlaygroundRoute()');
  expect(ui).toContain('writeLocalDocument(');
  expect(ui).toContain('resetPlaygroundStorage()');
  expect(ui).not.toContain('supabase.from(');
 });
 it('uses independently scoped storage for demo CRM, Quotes and Tasks',()=>{
  const ui=readFileSync(new URL('../components/DeveloperPlaygroundToolbar.tsx',import.meta.url),'utf8');
  expect(ui).toContain("scopedStorageKey('salesshop-personal-tasks-v1:local:user')");
  expect(ui).toContain("writeLocalDocument('crm'");
  expect(ui).toContain("writeLocalDocument('quotes'");
  expect(ui).toContain('window.location.reload()');
 });
});
