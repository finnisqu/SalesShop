import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(name:string)=>readFileSync(join(process.cwd(),name),'utf8');
const company=read('src/components/CompanyRecordPage.tsx');
const person=read('src/components/PersonRecordPage.tsx');
const deal=read('src/components/DealRecordPage.tsx');
const link=read('src/components/RecordRelatedActions.tsx');
const tasks=read('src/components/RecordTasksPanel.tsx');

describe('CRM record page linking and private Tasks',()=>{
 it('offers Company Add Deal and link-existing controls without manufacturing activities',()=>{
  expect(company).toContain('<RecordNewDeal companyId={company.id}');
  for(const kind of ['person','deal','quote']){
   expect(company).toContain('target="'+kind+'"');
  }
  expect(link).toContain('setProjectCompany(id,source.id)');
  expect(link).toContain('updateContact(id,{companyId:source.id})');
  expect(link).not.toContain('recordActivity(');
 });
 it('offers Person Company/Quote links and preserves internal roster access',()=>{
  expect(person).toContain('target="company"');
  expect(person).toContain('target="quote"');
  expect(person).toContain('Change an internal Person');
  expect(person).toContain('<RecordNewCompany source={{kind:\'person\'');
 });
 it('offers Deal Company and Quote links, and all records include Tasks',()=>{
  expect(deal).toContain('target="company"');
  expect(deal).toContain('target="quote"');
  for(const [file,kind] of [[company,'company'],[person,'person'],[deal,'deal']] as const){
   expect(file).toContain('<RecordTasksPanel kind="'+kind+'"');
  }
  expect(tasks).toContain("requestTaskModal({mode:'create'");
  expect(tasks).toContain('normalizedTaskAssociations(task)');
 });
 it('distinguishes + New from + Link Existing with consistent labels',()=>{
  expect(link).toContain("'+ Link Existing '+targetLabel");
  expect(link).toContain("'+ New Deal'");
  expect(link).toContain("'+ New Company'");
  expect(tasks).toContain('>+ New Task</button>');
  expect(company).toContain("'+ New Person'");
  expect(company).toContain('>+ New Quote</button>');
  expect(deal).toContain("'+ New Person'");
  expect(deal).toContain('>+ New Quote</button>');
  expect(person).toContain('>+ New Quote</button>');
 });
 it('retains the company SELF designation without turning it into a customer',()=>{
  expect(company).toContain('This is our company');
  expect(company).toContain('ourCompanyPatch');
  expect(company).toContain("kind:'non-customer' as const");
  const list=read('src/components/Connections.tsx');
  expect(list).toContain('<option value="self">Our Company (SELF)</option>');
  expect(list).toContain('isSelfCompany:isOurCompany(c)');
  expect(read('src/components/ConnectionsTable.tsx')).toContain('connections-table-self-badge');
 });
 it('does not silently reassign issued quote contracts',()=>{
  expect(link).toContain("q.status==='Draft'||q.status==='Ready'");
  expect(link).toContain('Only editable draft Quotes can be reassigned');
 });
});
