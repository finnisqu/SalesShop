import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {recordNameKey} from './recordNameKey';
import {
 stageActivityCompanyName,resolveActivityCompanyStage,type ActivityCompanyStageServices,
} from './activityCompanyStage351c';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function fixture(){
 const companies=[{id:'company-1',name:'Cedar Builders'}];
 let calls=0;
 const events:string[]=[];
 const services:ActivityCompanyStageServices={
  companies:()=>companies,
  resolveCompany:name=>{
   calls++;
   events.push('resolve');
   const id='new-company-'+calls;
   companies.push({id,name});
   return id;
  },
  onCreated:id=>{events.push('remember:'+id);},
  classifyNewCompany:id=>{events.push('classify:'+id);},
 };
 return {companies,events,services,calls:()=>calls};
}

describe('Batch 351c — Activity Company staged create/link',()=>{
 it('stages a name without changing CRM Company records',()=>{
  const f=fixture();
  const name=stageActivityCompanyName('  Pine   Development  ',f.companies);
  expect(name).toBe('Pine   Development');
  expect(f.companies).toHaveLength(1);
  expect(f.calls()).toBe(0);
  expect(recordNameKey(name)).toBe('pine development');
 });
 it('rejects duplicate and empty Company names before any creation',()=>{
  const f=fixture();
  expect(()=>stageActivityCompanyName(' CEDAR   BUILDERS ',f.companies)).toThrow('already exists');
  expect(()=>stageActivityCompanyName('   ',f.companies)).toThrow('Enter a Company name');
  expect(f.calls()).toBe(0);
  expect(f.companies).toHaveLength(1);
 });
 it('resolves optional/valid existing Company selection without creating a Company',()=>{
  const f=fixture();
  expect(resolveActivityCompanyStage({},f.services)).toBeUndefined();
  expect(resolveActivityCompanyStage({companyId:'company-1'},f.services)).toBe('company-1');
  expect(f.calls()).toBe(0);
  expect(f.events).toEqual([]);
 });
 it('rejects a stale Company or contradictory existing-and-new selections',()=>{
  const f=fixture();
  expect(()=>resolveActivityCompanyStage({companyId:'deleted'},f.services)).toThrow('no longer available');
  expect(()=>resolveActivityCompanyStage({companyId:'company-1',stagedCompanyName:'New'},
   f.services)).toThrow('not both');
  expect(f.calls()).toBe(0);
 });
 it('commits staged Company only at Person/Deal submit and remembers ID before classification',()=>{
  const f=fixture();
  const id=resolveActivityCompanyStage({stagedCompanyName:'New Supplier'},f.services);
  expect(id).toBe('new-company-1');
  expect(f.events).toEqual(['resolve','remember:new-company-1','classify:new-company-1']);
  expect(f.calls()).toBe(1);
  expect(f.companies[1]).toMatchObject({id,name:'New Supplier'});
 });
 it('preserves the resolved ID if classification fails, preventing duplicates on retry',()=>{
  const f=fixture();
  let resolved='';
  f.services.onCreated=id=>{resolved=id;};
  f.services.classifyNewCompany=()=>{throw new Error('classification write failed');};
  expect(()=>resolveActivityCompanyStage({stagedCompanyName:'Valley Builder'},f.services))
   .toThrow('classification write failed');
  expect(resolved).toBe('new-company-1');
  expect(f.calls()).toBe(1);
  f.services.classifyNewCompany=()=>{};
  expect(resolveActivityCompanyStage({companyId:resolved},f.services)).toBe(resolved);
  expect(f.calls()).toBe(1);
 });
 it('fails a concurrent duplicate after staging before creating a second Company',()=>{
  const f=fixture();
  const pending=stageActivityCompanyName('New Builders',f.companies);
  f.companies.push({id:'other-tab',name:'NEW BUILDERS'});
  expect(()=>resolveActivityCompanyStage({stagedCompanyName:pending},f.services))
   .toThrow('already exists');
  expect(f.calls()).toBe(0);
 });
 it('integrates staging and retry with the existing Activity creation and picker',()=>{
  const activity=source('components/ActivityRelatedQuickCreate.tsx');
  const picker=source('components/UnifiedRecordPicker.tsx');
  const stageStart=activity.indexOf('const createCompanyWhileLogging=(raw:string)=>{');
  const createStart=activity.indexOf('const resolveSelectedCompany=()=>{');
  const submitStart=activity.indexOf('const submit=()=>{');
  expect(stageStart).toBeGreaterThan(0);
  expect(createStart).toBeGreaterThan(stageStart);
  expect(submitStart).toBeGreaterThan(createStart);
  expect(activity.slice(stageStart,createStart)).toContain('stageActivityCompanyName(raw,');
  expect(activity.slice(stageStart,createStart)).not.toContain("resolveCompany(clean,'customer')");
  expect(activity).toContain('const resolvedCompanyId=resolveSelectedCompany();');
  expect(activity).toContain('companyId:resolvedCompanyId,source:');
  expect(activity).toContain('if(resolvedCompanyId)relinkDealCompany(id,resolvedCompanyId)');
  expect(activity).toContain("setCompanyId(id);setStagedCompanyName('');setCreatedCompanyId(id);");
  expect(activity).toContain("onLink={id=>{setCompanyId(id);setStagedCompanyName('');setCreatedCompanyId(null);}}");
  expect(activity).toContain('Not saved yet. Canceling this {contextLabel} will not create the Company.');
  expect(picker).toContain('useDismissiblePopover(rootRef,open');
 });
});
