import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {useAuthStore} from '../store/authStore';
import {useCrmStore} from '../store/crmStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import type {Company,Contact,Project} from '../types/crm';
import {
 MAX_CRM_IMPORT_BYTES,parseCrmCsv,buildCrmImportTable,
 detectCrmImportMapping,previewCrmImport,
 type CrmImportTable,type CrmImportSnapshot,
} from './crmImport385';
import {commitReviewedCrmImport,crmImportCanCreate,crmImportIdentity}
 from './crmImportCommit385';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const snapshot=(companies:Company[]=[],people:Contact[]=[],deals:Project[]=[]):
 CrmImportSnapshot=>({companies,people,deals});
const company=(name='Acme Contractors',id='c-1'):Company=>({
 id,name,kind:'customer',createdAt:'2026-11-01T12:00:00Z',
 updatedAt:'2026-11-01T12:00:00Z',
});
const person=(name:string,email:string,companyId?:string):Contact=>({
 id:'p-'+name,name,email,companyId,createdAt:'2026-11-01T12:00:00Z',
 updatedAt:'2026-11-01T12:00:00Z',
});
const deal=(name:string,companyId?:string):Project=>({
 id:'d-'+name,name,companyId,stage:'Discovery',pipeline:'commercial',
 createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',
});
const original=new Map<string,string>();
const memoryStorage={
 getItem:(k:string)=>original.get(k)??null,
 setItem:(k:string,v:string)=>{original.set(k,v);},
 removeItem:(k:string)=>{original.delete(k);},
 clear:()=>original.clear(),
};
beforeEach(()=>{
 original.clear();vi.stubGlobal('localStorage',memoryStorage);
 useAuthStore.setState({mode:'local',ready:true,organizationId:null,user:null});
 useCrmStore.setState({companies:[],contacts:[],projects:[],activities:[],hydrated:true});
 useRolePerspectiveStore.setState({activePerspective:null});
});
afterEach(()=>vi.unstubAllGlobals());
describe('#385 — CRM import: CSV/Excel mapping and review',()=>{
 it('handles UTF-8 BOM, quoted commas, multiline cells and escaped quote characters',()=>{
  const table=parseCrmCsv('\uFEFF"Name","Company"\r\n"Ana, Jr.","Acme"\r\n'+
   '"Bob ""B""","Company with\nnewline"\r\n');
  expect(table.headers).toEqual(['Name','Company']);
  expect(table.rows).toEqual([['Ana, Jr.','Acme'],
   ['Bob "B"','Company with\nnewline']]);
  expect(()=>parseCrmCsv('Name\n"Unclosed')).toThrow('unclosed');
 });
 it('rejects oversized/ambiguous files before staging any records',()=>{
  expect(()=>parseCrmCsv('a'.repeat(MAX_CRM_IMPORT_BYTES+1))).toThrow('2 MB');
  expect(()=>buildCrmImportTable([['Name','name'],['Acme','x']],'CSV'))
   .toThrow('Duplicate column names');
  expect(()=>buildCrmImportTable([['Name']],'CSV')).toThrow('no data');
  const rows=[['Name'],...Array.from({length:501},(_,i)=>['Record '+i])];
  expect(()=>buildCrmImportTable(rows,'CSV')).toThrow('500 data rows');
 });
 it('suggests sample CSV mapping for Companies, People and Deals without sharing columns',()=>{
  expect(detectCrmImportMapping('company',
   ['Company name','Customer classification'])).toEqual({name:0,kind:1});
  expect(detectCrmImportMapping('person',
   ['Person name','Email','Phone','Job title','Linked Company name']))
   .toEqual({name:0,email:1,phone:2,title:3,company:4});
  expect(detectCrmImportMapping('deal',
   ['Deal name','Linked Company name','Deal stage','Pipeline','Amount','Due date','Next action']))
   .toEqual({name:0,company:1,stage:2,pipeline:3,amount:4,dueDate:5,nextAction:6});
 });
 it('distinguishes new Companies from duplicate names, aliases and suffix-ambiguous matches',()=>{
  const table=buildCrmImportTable([
   ['Company name','Customer classification'],
   ['Pioneer Builders','Customer'],['PIONEER BUILDERS','Customer'],
   ['Acme Contractors','Customer'],['Acme Contractors LLC','Partner'],
   ['Fresh Company','Vendor'],
  ],'CSV');
  const preview=previewCrmImport('company',table,{name:0,kind:1},
   snapshot([company('Acme Contractors LLC')]));
  expect(preview.candidates.map(row=>row.status))
   .toEqual(['ready','review','review','existing','ready']);
  expect(preview.counts).toEqual({ready:2,existing:1,review:2});
  expect(preview.candidates[2].reason).toContain('Similar Company');
  expect(preview.candidates[4].values.kind).toBe('non-customer');
 });
 it('never invents a Company link; accepts uniquely resolved names and aliases',()=>{
  const file=buildCrmImportTable([
   ['Name','Company','Email'],
   ['Sam Rivera','Acme Contractors','sam@example.com'],
   ['Ava','Not found','ava@example.com'],
   ['Jo','ACME BUILDERS','jo@example.com'],
  ],'CSV');
  const existing=[{...company(),aliases:['Acme Builders']}];
  const preview=previewCrmImport('person',file,{name:0,company:1,email:2},
   snapshot(existing));
  expect(preview.candidates.map(row=>row.status)).toEqual(['ready','review','ready']);
  expect(preview.candidates[0].values.companyId).toBe('c-1');
  expect(preview.candidates[1].reason).toContain('Import or create');
 });
 it('flags existing People by exact email and possible name-only duplicates',()=>{
  const table=buildCrmImportTable([
   ['Name','Email'],['Sam','SAM@EXAMPLE.COM'],['Sam','another@example.com'],
   ['Jordan','jordan@example.com'],
  ],'CSV');
  const preview=previewCrmImport('person',table,{name:0,email:1},
   snapshot([], [person('Sam','sam@example.com')]));
  expect(preview.candidates.map(row=>row.status)).toEqual(['existing','ready','ready']);
  const nameOnly=previewCrmImport('person',
   buildCrmImportTable([['Name'],['Sam']],'CSV'),{name:0},
   snapshot([], [person('Sam','sam@example.com')]));
  expect(nameOnly.candidates[0].status).toBe('review');
 });
 it('validates Deal stage, pipeline, numeric amount, date, and existing duplicates',()=>{
  const file=buildCrmImportTable([
   ['Name','Company','Stage','Pipeline','Amount','Due'],
   ['Oak Phase 1','Acme Contractors','Bid Sent','commercial','$14,000.00','2026-12-15'],
   ['Oak Phase 2','Acme Contractors','Imaginary','commercial','900',''],
   ['Oak Phase 3','Acme Contractors','Discovery','commercial','-8',''],
   ['Oak Phase 4','Acme Contractors','Discovery','commercial','140','2026-02-30'],
   ['Oak Phase 1','Acme Contractors','Bid Sent','commercial','14000','2026-12-15'],
  ],'CSV');
  const preview=previewCrmImport('deal',file,{
   name:0,company:1,stage:2,pipeline:3,amount:4,dueDate:5,
  },snapshot([company()]));
  expect(preview.candidates.map(c=>c.status))
   .toEqual(['ready','review','review','review','review']);
  expect(preview.candidates[0].values).toMatchObject({
   companyId:'c-1',stage:'Bid Sent',pipeline:'commercial',amount:14000,dueDate:'2026-12-15',
  });
  const existing=previewCrmImport('deal',
   buildCrmImportTable([['Name'],['Oak Phase 1']],'CSV'),{name:0},
   snapshot([],[],[deal('Oak Phase 1')]));
  expect(existing.candidates[0].status).toBe('review');
 });
 it('rejects missing Name mappings, duplicate column assignments and missing source columns',()=>{
  const table=buildCrmImportTable([['Name','Email'],['Sam','sam@example.com']],'CSV');
  expect(previewCrmImport('person',table,{email:1},snapshot()).errors).toContain(
   'Map the required Name column.');
  expect(previewCrmImport('person',table,{name:0,email:0},snapshot()).errors).toContain(
   'One source column cannot map to multiple fields.');
  expect(previewCrmImport('person',table,{name:3},snapshot()).errors).toContain(
   'A mapping points to a missing column.');
 });
});
describe('#385 — guarded real CRM creation',()=>{
 it('creates reviewed Companies in the existing local CRM, then skips exact repeats',async()=>{
  const table=parseCrmCsv('Company name,Customer classification\nAcme Contractors,Customer\nNew Supplier,Partner');
  const mapping={name:0,kind:1};
  const identity=crmImportIdentity();
  const result=await commitReviewedCrmImport({kind:'company',table,mapping,identity});
  expect(result).toMatchObject({created:2,cloudConfirmed:true});
  expect(useCrmStore.getState().companies).toHaveLength(2);
  expect(useCrmStore.getState().companies.find(c=>c.name==='New Supplier')?.kind).toBe('non-customer');
  await expect(commitReviewedCrmImport({kind:'company',table,mapping,identity}))
   .rejects.toThrow('No reviewed new records');
 });
 it('creates a Person and Deal with exact Company IDs and preserves Deal fields',async()=>{
  useCrmStore.setState({companies:[company()]});
  const identity=crmImportIdentity();
  const personTable=parseCrmCsv('Name,Company,Email,Phone,Title\n'+
   'Sam Rivera,Acme Contractors,sam@example.com,555-012-3456,Estimator');
  const p=await commitReviewedCrmImport({kind:'person',table:personTable,
   mapping:{name:0,company:1,email:2,phone:3,title:4},identity});
  expect(p.created).toBe(1);
  expect(useCrmStore.getState().contacts[0]).toMatchObject({
   name:'Sam Rivera',companyId:'c-1',email:'sam@example.com',
  });
  const dealTable=parseCrmCsv('Name,Company,Stage,Pipeline,Amount,Due date,Next action\n'+
   'Building A,Acme Contractors,Bid Sent,Commercial,25000,2026-12-15,Check scope');
  const d=await commitReviewedCrmImport({kind:'deal',table:dealTable,
   mapping:{name:0,company:1,stage:2,pipeline:3,amount:4,dueDate:5,nextAction:6},identity});
  expect(d.created).toBe(1);
  expect(useCrmStore.getState().projects[0]).toMatchObject({
   name:'Building A',companyId:'c-1',stage:'Bid Sent',pipeline:'commercial',
   amount:25000,dueDate:'2026-12-15',nextAction:'Check scope',
  });
  expect(useCrmStore.getState().activities.some(a=>a.type==='project-created')).toBe(true);
 });
 it('blocks writes when CRM is not hydrated, identity changed or in role preview',async()=>{
  const table=parseCrmCsv('Name\nReview test');
  const identity=crmImportIdentity();
  useCrmStore.setState({hydrated:false});
  await expect(commitReviewedCrmImport({kind:'company',table,
   mapping:{name:0},identity})).rejects.toThrow('not finished loading');
  useCrmStore.setState({hydrated:true});
  useAuthStore.setState({mode:'cloud',organizationId:'different',user:null});
  await expect(commitReviewedCrmImport({kind:'company',table,
   mapping:{name:0},identity})).rejects.toThrow('workspace or access changed');
  expect(useCrmStore.getState().companies).toHaveLength(0);
  expect(crmImportCanCreate()).toBe(false);
 });
 it('only exposes a guarded, explicit Import tool, not a playground seed',()=>{
  const tools=source('components/ToolsWorkspace.tsx');
  const panel=source('components/CrmImportWorkspace385.tsx');
  const commit=source('services/crmImportCommit385.ts');
  expect(tools).toContain("id:'import',label:'Import'");
  expect(tools).toContain('<CrmImportWorkspace385 key=');
  expect(panel).toContain('I reviewed the results');
  expect(panel).toContain('preview.counts.ready');
  expect(panel).toContain('commitReviewedCrmImport(');
  expect(panel).toContain('Download sample CSV');
  expect(panel).toContain('Unmapped optional fields stay empty');
  expect(commit).toContain('canEditTeamArea(auth.teamRole,auth.teamDepartment');
  expect(commit).toContain('useRolePerspectiveStore.getState().activePerspective');
  expect(commit).toContain('syncNormalizedCrm(identity.organizationId,doc)');
  expect(commit).not.toContain('supabase.from(');
  expect(commit).not.toContain('.deleteProject(');
  expect(commit).not.toContain('mergeCompanyRecords(');
 });
});
