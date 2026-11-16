import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {
 blankCrmFieldBlueprint,createCrmCustomField,
 setCrmFieldVisibility,toggleCrmCustomField,
 CRM_MAX_FIELDS_PER_TARGET,
} from './crmFieldBlueprint352b';
import {
 CRM_MODULE_PLANS,blankCrmModulePlans,readCrmModulePlans,crmModulePlansStorageKey,
 setCrmModulePlan,exportCrmConfiguration,
 previewCrmConfigurationImport,applyCrmConfigurationImport,
} from './crmConfiguration352e2';
import {applyCrmStarterPack} from './crmStarterPacks352e1';
const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const initial=()=>blankCrmFieldBlueprint();
const plans=()=>blankCrmModulePlans();
const exportSample=()=>exportCrmConfiguration(
 applyCrmStarterPack(initial(),'general_sales'),
 setCrmModulePlan(plans(),'lead_intake',true),
);

describe('Batch 352e2 — portable CRM draft configuration',()=>{
 it('starts with no optional module plans and isolates device preference keys',()=>{
  expect(Object.values(plans()).every(value=>value===false)).toBe(true);
  expect(crmModulePlansStorageKey('workspace-A'))
   .not.toBe(crmModulePlansStorageKey('workspace-B'));
  expect(CRM_MODULE_PLANS).toHaveLength(4);
 });
 it('normalizes damaged local module preferences safely',()=>{
  expect(readCrmModulePlans('not-json')).toEqual(plans());
  expect(readCrmModulePlans('{"lead_intake":"true","renewal_follow_up":true}'))
   .toMatchObject({lead_intake:false,renewal_follow_up:true});
  expect(setCrmModulePlan(plans(),'pipeline_reviews',true).pipeline_reviews).toBe(true);
 });
 it('exports only versioned, portable definitions and module intentions',()=>{
  const exported=JSON.parse(exportSample());
  expect(exported.format).toBe('salesshop.crm.configuration');
  expect(exported.version).toBe(1);
  expect(Object.keys(exported).sort()).toEqual(['fields','format','modules','version']);
  expect(exported.fields).toHaveLength(4);
  expect(exported.modules.lead_intake).toBe(true);
  expect(exported).not.toHaveProperty('organizationId');
  expect(exported).not.toHaveProperty('records');
  expect(exportSample()).not.toContain('customerValues');
 });
 it('round-trips in a new workspace with stable field IDs and intended visibility',()=>{
  const sample=applyCrmStarterPack(initial(),'general_sales');
  const changed=setCrmFieldVisibility(toggleCrmCustomField(sample,sample.fields[0].id,false),
   sample.fields[0].id,'admins');
  const json=exportCrmConfiguration(changed,plans());
  const result=applyCrmConfigurationImport(initial(),plans(),json);
  expect(result.blueprint.fields).toEqual(changed.fields);
  expect(result.modules).toEqual(plans());
 });
 it('previews imports and supports preview-only without writes',()=>{
  const base=initial(),modules=plans(),json=exportSample();
  const plan=previewCrmConfigurationImport(base,modules,json);
  expect(plan.additions).toBe(4);
  expect(plan.modulesToPlan).toBe(1);
  expect(plan.conflicts).toBe(0);
  expect(plan.blockedReason).toBeNull();
  expect(base.fields).toHaveLength(0);
  expect(modules.lead_intake).toBe(false);
 });
 it('is idempotent and never overwrites a manually modified definition',()=>{
  const existing=createCrmCustomField(initial(),{
   target:'deal',label:'Lead Source',type:'choice',
   options:['Phone','Walk-in'],visibility:'admins',
  },'manual-choice');
  const once=applyCrmConfigurationImport(existing,plans(),exportSample());
  const twice=applyCrmConfigurationImport(once.blueprint,once.modules,exportSample());
  expect(once.blueprint.fields.find(x=>x.id==='manual-choice')).toEqual(existing.fields[0]);
  expect(twice.blueprint).toEqual(once.blueprint);
  expect(twice.modules).toEqual(once.modules);
 });
 it('keeps conflicting types rather than overwrite or widen them',()=>{
  const current=createCrmCustomField(initial(),{
   target:'deal',label:'Lead Source',type:'text',visibility:'admins',
  },'custom-source');
  const plan=previewCrmConfigurationImport(current,plans(),exportSample());
  expect(plan.conflicts).toBe(1);
  expect(plan.additions).toBe(3);
  const applied=applyCrmConfigurationImport(current,plans(),exportSample());
  expect(applied.blueprint.fields.find(x=>x.id==='custom-source')).toEqual(current.fields[0]);
 });
 it('remaps colliding IDs for unrelated fields without replacing an existing ID',()=>{
  const json=JSON.parse(exportSample());
  const collidedId=json.fields[0].id;
  const current=createCrmCustomField(initial(),{
   target:'company',label:'Different Account Fact',type:'text',
  },collidedId);
  const applied=applyCrmConfigurationImport(current,plans(),JSON.stringify(json));
  expect(applied.blueprint.fields.find(x=>x.id===collidedId)?.label)
   .toBe('Different Account Fact');
  const imported=applied.blueprint.fields.find(x=>x.key==='customer_segment');
  expect(imported?.id).toBe('import_company_customer_segment');
 });
 it('does not silently disable existing draft modules from an import',()=>{
  const current=setCrmModulePlan(plans(),'project_handoff',true);
  const applied=applyCrmConfigurationImport(initial(),current,exportSample());
  expect(applied.modules.project_handoff).toBe(true);
  expect(applied.modules.lead_intake).toBe(true);
 });
 it('rejects invalid JSON, unsupported versions and record-bearing payloads',()=>{
  const bad=['{',JSON.stringify({...JSON.parse(exportSample()),version:2}),
   JSON.stringify({...JSON.parse(exportSample()),records:[{name:'Customer X'}]}),
   JSON.stringify({...JSON.parse(exportSample()),values:{secret:'no'}})];
  for(const json of bad)expect(()=>
   previewCrmConfigurationImport(initial(),plans(),json)).toThrow();
  expect(()=>previewCrmConfigurationImport(initial(),plans(),'x'.repeat(80001)))
   .toThrow('limit');
 });
 it('rejects malformed field definitions rather than silently discarding them',()=>{
  const raw=JSON.parse(exportSample());
  for(const mutate of [
   (row:any)=>{row.key='other_key';},
   (row:any)=>{row.type='unknown';},
   (row:any)=>{row.visibility='public';},
   (row:any)=>{row.options=['Only one'];},
   (row:any)=>{row.customerValue='secret';},
  ]){
   const changed=JSON.parse(JSON.stringify(raw));
   mutate(changed.fields[0]);
   expect(()=>previewCrmConfigurationImport(initial(),plans(),JSON.stringify(changed)))
    .toThrow();
  }
 });
 it('rejects duplicate identities or keys in the source bundle',()=>{
  const raw=JSON.parse(exportSample());
  raw.fields.push({...raw.fields[0]});
  expect(()=>previewCrmConfigurationImport(initial(),plans(),JSON.stringify(raw)))
   .toThrow('duplicate');
 });
 it('rejects unknown/nonboolean modules',()=>{
  const raw=JSON.parse(exportSample());
  raw.modules.lead_intake='true';
  expect(()=>previewCrmConfigurationImport(initial(),plans(),JSON.stringify(raw))).toThrow();
  delete raw.modules.lead_intake;
  expect(()=>previewCrmConfigurationImport(initial(),plans(),JSON.stringify(raw))).toThrow();
 });
 it('fails as a whole on capacity overflow, including module intentions',()=>{
  let full=initial();
  for(let i=0;i<CRM_MAX_FIELDS_PER_TARGET;i++){
   full=createCrmCustomField(full,{
    label:'Company Field '+i,target:'company',type:'text',
   },'manual-'+i);
  }
  const old=JSON.stringify(full);
  const plan=previewCrmConfigurationImport(full,plans(),exportSample());
  expect(plan.blockedReason).toContain('Limit reached');
  expect(plan.nextBlueprint).toBe(full);
  expect(plan.nextModules).toEqual(plans());
  expect(()=>applyCrmConfigurationImport(full,plans(),exportSample()))
   .toThrow('Limit reached');
  expect(JSON.stringify(full)).toBe(old);
 });
 it('sets no shared permissions or module runtime features',()=>{
  const source=src('services/crmConfiguration352e2.ts');
  const ui=src('components/CrmFieldBlueprintSettings.tsx');
  expect(source).not.toContain('supabase.from(');
  expect(source).not.toContain('fetch(');
  expect(ui).toContain('previewCrmConfigurationImport(blueprint,modulePlans,importText)');
  expect(ui).toContain('applyCrmConfigurationImport(blueprint,modulePlans,importText)');
  expect(ui).toContain('Portable CRM configuration');
  expect(ui).toContain('Module plans · local draft only');
  expect(ui).toContain('No actual CRM tabs, automations or workflow rules change.');
  expect(ui).not.toContain('supabase.from(');
 });
});
