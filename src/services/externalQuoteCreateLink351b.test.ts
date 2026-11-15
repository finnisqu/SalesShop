import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {
 createExternalQuoteDealWithCompany,linkExternalQuoteDealCompany,
 type ExternalQuoteDealCreateServices,
} from './externalQuoteDealCreateLink';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function fixture(){
 const deals:{id:string;name:string;companyId?:string}[]=[];
 const companies:{id:string;name:string}[]=[{id:'company-1',name:'Oak Builders'}];
 let failLink=false,failCompany=false,createdCompanies=0;
 const services:ExternalQuoteDealCreateServices={
  deals:()=>deals,
  companies:()=>companies,
  createDeal:name=>{const id='deal-'+(deals.length+1);deals.push({id,name});return id;},
  resolveCompany:name=>{
   if(failCompany)throw new Error('Company service unavailable');
   createdCompanies++;
   const id='company-new-'+createdCompanies;
   companies.push({id,name});
   return id;
  },
  assignCompany:(dealId,companyId)=>{
   if(failLink)throw new Error('Company association rejected');
   const deal=deals.find(d=>d.id===dealId);
   if(!deal)throw new Error('Deal missing');
   deal.companyId=companyId;
  },
 };
 return {deals,companies,services,
  setFailLink:(value:boolean)=>{failLink=value;},
  setFailCompany:(value:boolean)=>{failCompany=value;},
  createdCompanies:()=>createdCompanies};
}

describe('Batch 351b — external quote Deal/Company creation and recovery',()=>{
 it('links an existing Company to exactly one new Deal',()=>{
  const f=fixture();
  const result=createExternalQuoteDealWithCompany('  Parkside Apartments  ',
   {companyId:'company-1'},f.services);
  expect(result).toEqual({dealId:'deal-1',recovery:null});
  expect(f.deals).toEqual([{id:'deal-1',name:'Parkside Apartments',companyId:'company-1'}]);
  expect(f.createdCompanies()).toBe(0);
 });
 it('leaves Company optional and never creates one for a name-only Deal',()=>{
  const f=fixture();
  expect(createExternalQuoteDealWithCompany('Unassigned bid',{},f.services))
   .toEqual({dealId:'deal-1',recovery:null});
  expect(f.deals[0].companyId).toBeUndefined();
  expect(f.createdCompanies()).toBe(0);
 });
 it('rejects duplicate Deal/Company names and invalid selections BEFORE creating anything',()=>{
  const f=fixture();
  createExternalQuoteDealWithCompany('Lot 42',{},f.services);
  expect(()=>createExternalQuoteDealWithCompany(' LOT   42 ',{},f.services))
   .toThrow('A Deal with that name already exists');
  expect(()=>createExternalQuoteDealWithCompany('New Job',{newCompanyName:' oak builders '},f.services))
   .toThrow('That Company already exists');
  expect(()=>createExternalQuoteDealWithCompany('New Job',{companyId:'missing'},f.services))
   .toThrow('Selected Company is no longer available');
  expect(()=>createExternalQuoteDealWithCompany('New Job',{companyId:'company-1',newCompanyName:'Else'},f.services))
   .toThrow('not both');
  expect(f.deals).toHaveLength(1);
  expect(f.createdCompanies()).toBe(0);
 });
 it('creates a staged new Company only AFTER the Deal exists',()=>{
  const f=fixture();
  f.services.createDeal=()=>null;
  expect(()=>createExternalQuoteDealWithCompany('Job',{newCompanyName:'New Builder'},f.services))
   .toThrow('Could not create the Deal');
  expect(f.createdCompanies()).toBe(0);
  expect(f.deals).toHaveLength(0);
  // Allow a normal Deal create after the failed pre-create attempt.
  f.services.createDeal=name=>{f.deals.push({id:'deal-1',name});return 'deal-1';};
  const result=createExternalQuoteDealWithCompany('Job',{newCompanyName:'New Builder'},f.services);
  expect(result.recovery).toBeNull();
  expect(f.deals[0].companyId).toBe('company-new-1');
  expect(f.companies.find(company=>company.id==='company-new-1')?.name).toBe('New Builder');
 });
 it('keeps the created Deal ID when linking an existing Company fails; retry does not duplicate',()=>{
  const f=fixture();
  f.setFailLink(true);
  const result=createExternalQuoteDealWithCompany('Tower A',{companyId:'company-1'},f.services);
  expect(result.dealId).toBe('deal-1');
  expect(result.recovery).toMatchObject({dealId:'deal-1',companyId:'company-1'});
  expect(result.recovery?.message).toContain('Deal created, but its Company is not linked');
  expect(f.deals).toHaveLength(1);
  f.setFailLink(false);
  const remaining=linkExternalQuoteDealCompany(result.dealId,result.recovery!,f.services);
  expect(remaining).toBeNull();
  expect(f.deals).toEqual([{id:'deal-1',name:'Tower A',companyId:'company-1'}]);
 });
 it('recovers a failed new Company assignment using its resolved ID, not a duplicate Company',()=>{
  const f=fixture();
  f.setFailLink(true);
  const result=createExternalQuoteDealWithCompany('Tower B',{newCompanyName:'Stone Partners'},f.services);
  expect(result.recovery).toMatchObject({dealId:'deal-1',companyId:'company-new-1'});
  expect(result.recovery?.newCompanyName).toBeUndefined();
  expect(f.createdCompanies()).toBe(1);
  f.setFailLink(false);
  expect(linkExternalQuoteDealCompany(result.dealId,result.recovery!,f.services)).toBeNull();
  expect(f.deals).toHaveLength(1);
  expect(f.createdCompanies()).toBe(1);
  expect(f.deals[0].companyId).toBe('company-new-1');
 });
 it('recovers a new Company service failure without recreating the already-saved Deal',()=>{
  const f=fixture();
  f.setFailCompany(true);
  const result=createExternalQuoteDealWithCompany('Tower C',{newCompanyName:'Future Contractor'},f.services);
  expect(result.recovery).toMatchObject({dealId:'deal-1',newCompanyName:'Future Contractor'});
  expect(f.deals).toHaveLength(1);
  expect(f.createdCompanies()).toBe(0);
  f.setFailCompany(false);
  const remaining=linkExternalQuoteDealCompany(result.dealId,result.recovery!,f.services);
  expect(remaining).toBeNull();
  expect(f.deals).toHaveLength(1);
  expect(f.deals[0].companyId).toBe('company-new-1');
 });
 it('keeps nested Deal and Company picker dismissal separate for keyboard Escape',()=>{
  const picker=source('components/UnifiedRecordPicker.tsx');
  const dismiss=source('components/useDismissibleDetails.ts');
  expect(picker).toContain('data-ss-popover-open={open?"true":"false"}');
  expect(picker).toContain('useDismissiblePopover(rootRef,open');
  expect(dismiss).toContain("event.target.closest('[data-ss-popover-open=\"true\"]')");
  expect(dismiss).toContain('innerOpen!==root&&root.contains(innerOpen)');
  expect(dismiss).toContain('event.preventDefault();');
  expect(dismiss).toContain('latest.current();');
 });
 it('reuses the shared searchable picker and keeps external submission attached to selected Deal',()=>{
  const dialog=source('components/ExternalQuoteBackfillDialog.tsx');
  const form=source('components/ExternalQuoteSentForm.tsx');
  expect(dialog).toContain('<UnifiedRecordPicker kind="Deal"');
  expect(dialog).toContain('<UnifiedRecordPicker kind="Company"');
  expect(dialog).toContain("onCreate={name=>{setNewCompanyName(name.trim());setNewCompanyId('');}}");
  expect(dialog).toContain('createExternalQuoteDealWithCompany(name,');
  expect(dialog).toContain('setSelectedId(result.dealId);');
  expect(dialog).toContain('setLinkRecovery(result.recovery);');
  expect(dialog).toContain('linkExternalQuoteDealCompany(linkRecovery.dealId,');
  expect(dialog).toMatch(/<button[^>]*onClick={retryCompanyLink}>\s*Retry Company link/);
  expect(dialog).toContain('<ExternalQuoteSentForm key={selected.id} deal={selected}');
  expect(form).toContain('recordExternalQuoteSent(');
  expect(dialog).not.toContain('<select value={newCompanyId}');
 });
});
