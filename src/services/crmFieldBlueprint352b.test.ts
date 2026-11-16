import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {
 blankCrmFieldBlueprint,crmBlueprintStorageKey,crmFieldKeyFromLabel,crmFieldOptions,
 createCrmCustomField,toggleCrmCustomField,moveCrmCustomField,
 validateCrmCustomFieldValue,normalizeCrmFieldBlueprint,readCrmFieldBlueprint,
 CRM_MAX_FIELDS_PER_TARGET,type CrmCustomField,
} from './crmFieldBlueprint352b';

const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const company=()=>createCrmCustomField(blankCrmFieldBlueprint(),{
 label:'Territory',target:'company',type:'choice',options:['North','South',' north '],
},'field-one');

describe('Batch 352b — plug-and-play CRM field blueprints',()=>{
 it('starts blank, without mandatory industry fields',()=>{
  expect(blankCrmFieldBlueprint()).toEqual({version:1,fields:[]});
  expect(src('services/crmFieldBlueprint352b.ts')).not.toContain('worldstone');
 });
 it('isolates draft definitions by account, organization and local workspace',()=>{
  const a=crmBlueprintStorageKey('cloud','org-a','alice');
  expect(a).not.toBe(crmBlueprintStorageKey('cloud','org-b','alice'));
  expect(a).not.toBe(crmBlueprintStorageKey('cloud','org-a','bob'));
  expect(a).not.toBe(crmBlueprintStorageKey('local',null));
  expect(a).toContain('salesshop-crm-field-blueprints-v1:');
 });
 it('creates stable type, key and options without changing the original blueprint',()=>{
  const base=blankCrmFieldBlueprint();
  const next=createCrmCustomField(base,{
   target:'company',label:'  Territory ',type:'choice',
   options:['North','South','north',' South '],description:'Region covered',
  },'company-field-1');
  expect(base.fields).toEqual([]);
  expect(next.fields).toEqual([{
   id:'company-field-1',key:'territory',label:'Territory',
   target:'company',type:'choice',options:['North','South'],
   description:'Region covered',active:true,
  }]);
 });
 it('normalizes descriptive keys and protects built-in record properties',()=>{
  expect(crmFieldKeyFromLabel('Preferred Contact Method')).toBe('preferred_contact_method');
  expect(crmFieldKeyFromLabel('Étage / Sales Region')).toBe('etage_sales_region');
  expect(()=>createCrmCustomField(blankCrmFieldBlueprint(),{
   target:'person',label:'Email',type:'text',
  },'id1')).toThrow('conflict');
  expect(()=>createCrmCustomField(blankCrmFieldBlueprint(),{
   target:'deal',label:'     ',type:'text',
  },'id2')).toThrow('descriptive');
 });
 it('permits different industries and record types to reuse a field label independently',()=>{
  const a=createCrmCustomField(blankCrmFieldBlueprint(),{
   target:'person',label:'Lead Source',type:'text',
  },'person-1');
  const b=createCrmCustomField(a,{
   target:'deal',label:'Lead Source',type:'text',
  },'deal-1');
  expect(b.fields.map(f=>f.target)).toEqual(['person','deal']);
  expect(()=>createCrmCustomField(b,{
   target:'person',label:'LEAD  SOURCE',type:'number',
  },'person-2')).toThrow('already exists');
 });
 it('limits fields per record kind without blocking other kinds',()=>{
  let blueprint=blankCrmFieldBlueprint();
  for(let i=0;i<CRM_MAX_FIELDS_PER_TARGET;i++){
   blueprint=createCrmCustomField(blueprint,{
    target:'company',label:'Custom Attribute '+i,type:'text',
   },'id'+i);
  }
  expect(blueprint.fields).toHaveLength(30);
  expect(()=>createCrmCustomField(blueprint,{
   target:'company',label:'One more',type:'text',
  },'overflow')).toThrow('30 custom fields');
  expect(createCrmCustomField(blueprint,{
   target:'person',label:'One more',type:'text',
  },'person-id').fields).toHaveLength(31);
 });
 it('rejects malformed choice fields and deduplicates choices case-insensitively',()=>{
  expect(crmFieldOptions([' Inbound ','inbound','Partner','partner'])).toEqual(['Inbound','Partner']);
  expect(()=>createCrmCustomField(blankCrmFieldBlueprint(),{
   target:'deal',label:'Deal Segment',type:'choice',options:['SMB','smb'],
  },'bad')).toThrow('at least two');
  expect(()=>createCrmCustomField(blankCrmFieldBlueprint(),{
   target:'deal',label:'Deal Segment',type:'choice',options:[],
  },'bad')).toThrow('at least two');
 });
 it('prevents duplicate IDs and retains unique immutable field keys',()=>{
  const first=createCrmCustomField(blankCrmFieldBlueprint(),{
   target:'company',label:'Source Channel',type:'text',
  },'id-1');
  expect(()=>createCrmCustomField(first,{
   target:'company',label:'Another Source',type:'date',
  },'id-1')).toThrow('unique field ID');
  expect(()=>createCrmCustomField(first,{
   target:'company',label:'Source---Channel',type:'number',
  },'id-2')).toThrow('already exists');
 });
 it('pauses a definition without deleting its ID, key or type',()=>{
  const a=company();
  const paused=toggleCrmCustomField(a,'field-one',false);
  expect(paused.fields[0]).toMatchObject({id:'field-one',key:'territory',active:false});
  expect(paused.fields[0].options).toEqual(['North','South']);
  expect(toggleCrmCustomField(paused,'field-one',true).fields[0].active).toBe(true);
  expect(a.fields[0].active).toBe(true);
 });
 it('reorders fields only within their target record type',()=>{
  let a=company();
  a=createCrmCustomField(a,{target:'person',label:'Contact Zone',type:'text'},'person');
  a=createCrmCustomField(a,{target:'company',label:'Account Tier',type:'number'},'second');
  const moved=moveCrmCustomField(a,'second',-1);
  expect(moved.fields.map(f=>f.id)).toEqual(['second','person','field-one']);
  expect(moveCrmCustomField(a,'field-one',-1).fields).toEqual(a.fields);
  expect(moveCrmCustomField(a,'person',1).fields).toEqual(a.fields);
 });
 it('validates text, numbers and nullable values for future typed record storage',()=>{
  const f:CrmCustomField={
   id:'t',key:'description',label:'Description',target:'company',type:'text',active:true,
  };
  expect(validateCrmCustomFieldValue(f,' Hello ')).toEqual({valid:true,value:'Hello'});
  expect(validateCrmCustomFieldValue(f,null)).toEqual({valid:true,value:null});
  expect(validateCrmCustomFieldValue(f,'x'.repeat(501)).valid).toBe(false);
  expect(validateCrmCustomFieldValue({...f,type:'number'},42)).toEqual({valid:true,value:42});
  expect(validateCrmCustomFieldValue({...f,type:'number'},Infinity).valid).toBe(false);
  expect(validateCrmCustomFieldValue({...f,type:'number'},'42').valid).toBe(false);
 });
 it('validates actual calendar dates and strict selection/boolean types',()=>{
  const f=company().fields[0];
  expect(validateCrmCustomFieldValue({...f,type:'date'},'2026-02-28'))
   .toEqual({valid:true,value:'2026-02-28'});
  expect(validateCrmCustomFieldValue({...f,type:'date'},'2026-02-30').valid).toBe(false);
  expect(validateCrmCustomFieldValue(f,'North')).toEqual({valid:true,value:'North'});
  expect(validateCrmCustomFieldValue(f,'East').valid).toBe(false);
  expect(validateCrmCustomFieldValue({...f,type:'boolean'},false))
   .toEqual({valid:true,value:false});
  expect(validateCrmCustomFieldValue({...f,type:'boolean'},'false').valid).toBe(false);
 });
 it('ignores corrupted JSON, unsupported schema versions and tampered definitions',()=>{
  expect(readCrmFieldBlueprint('{invalid')).toEqual(blankCrmFieldBlueprint());
  expect(normalizeCrmFieldBlueprint({version:2,fields:[company().fields[0]]}))
   .toEqual(blankCrmFieldBlueprint());
  const valid=company().fields[0];
  const parsed=normalizeCrmFieldBlueprint({version:1,fields:[
   {...valid,active:false}, {...valid,id:'copy'}, {...valid,id:'copy2',key:'name'},
   {...valid,id:'copy3',target:'not-a-target'},
   {...valid,id:'copy4',type:'unknown'},
  ]});
  expect(parsed.fields).toEqual([{...valid,active:false}]);
 });
 it('remains a device-local design draft, not a customer-field database mutation',()=>{
  const page=src('components/CrmFieldBlueprintSettings.tsx');
  const settings=src('components/CompanySettings.tsx');
  expect(page).toContain('useWorktableDirectoryState<CrmFieldBlueprint>(scope,');
  expect(page).toContain("localStorage.setItem(key,JSON.stringify(value))");
  expect(page).toContain('not shared with your team, do not appear on live records yet');
  expect(page).toContain("createCrmCustomField(blueprint,");
  expect(page).toContain('toggleCrmCustomField(current,field.id,!field.active)');
  expect(page).toContain('moveCrmCustomField(current,field.id,-1)');
  expect(page).toContain('fieldset disabled={!editable}');
  expect(settings).toContain("{ id: 'crm', title: 'CRM Setup'");
  expect(settings).toContain("editable={canEditCompany} mode={mode} organizationId={organizationId}");
  expect(settings).toContain("import {CrmFieldBlueprintSettings} from './CrmFieldBlueprintSettings';");
  expect(page).not.toContain('supabase.from(');
 });
});
