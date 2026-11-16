import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {
 buildSharedCrmValueOperation,decodeSharedCrmValue,planSharedCrmFieldPublication,
 type SharedCrmDefinitionRow,type SharedCrmValueRow,
} from './crmSharedFieldContract352c';
import {
 blankCrmFieldBlueprint,createCrmCustomField,
 type CrmCustomField,
} from './crmFieldBlueprint352b';

const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const mk=(type:'text'|'number'|'date'|'choice'|'boolean'='text',
 target:'company'|'person'|'deal'='company'):CrmCustomField=>({
 id:'field-1',key:'custom',label:'Custom',target,type,active:true,
 ...(type==='choice'?{options:['Basic','Premium']}:{}),
});
const stored=(overrides:Partial<SharedCrmDefinitionRow>={}):SharedCrmDefinitionRow=>({
 organization_id:'org-A',id:'field-1',record_type:'company',
 field_key:'custom',label:'Custom',field_type:'text',
 description:null,options:[],active:true,revision:3,...overrides,
});
const write=(field=mk(),value:unknown='Hello',recordId='record-1')=>
 buildSharedCrmValueOperation({organizationId:'org-A',target:field.target,recordId,field,value});

describe('Batch 352c — shared CRM custom field contract before cloud activation',()=>{
 it('prepares new definitions scoped to exactly one organization',()=>{
  const blueprint=createCrmCustomField(blankCrmFieldBlueprint(),{
   label:'Territory',target:'company',type:'choice',options:['East','West'],
  },'territory-id');
  const plan=planSharedCrmFieldPublication('org-A',blueprint,[]);
  expect(plan.creates).toEqual([{
   organization_id:'org-A',id:'territory-id',record_type:'company',
   field_key:'territory',label:'Territory',field_type:'choice',
   description:null,options:['East','West'],active:true,revision:1,
  }]);
  expect(plan.updates).toEqual([]);
  expect(plan.unchanged).toEqual([]);
  expect(plan.choiceChangesRequiringValueReview).toEqual([]);
 });
 it('retains stable definition identity and increments revisions on edit',()=>{
  const blueprint=createCrmCustomField(blankCrmFieldBlueprint(),{
   label:'Custom',target:'company',type:'text',description:'For my team',
  },'field-1');
  const plan=planSharedCrmFieldPublication('org-A',blueprint,[stored()]);
  expect(plan.creates).toEqual([]);
  expect(plan.updates).toMatchObject([{
   organization_id:'org-A',id:'field-1',field_key:'custom',
   description:'For my team',revision:4,
  }]);
 });
 it('does not re-publish unchanged fields or delete missing ones',()=>{
  const field=createCrmCustomField(blankCrmFieldBlueprint(),{
   label:'Custom',target:'company',type:'text',
  },'field-1');
  const existing=[stored(),stored({id:'old-field',field_key:'legacy',label:'Legacy'})];
  const plan=planSharedCrmFieldPublication('org-A',field,existing);
  expect(plan.unchanged).toEqual([existing[0]]);
  expect(plan.creates).toHaveLength(0);
  expect(plan.updates).toHaveLength(0);
  expect('deletes' in plan).toBe(false);
 });
 it('rejects cross-organization rows and immutable type/key changes',()=>{
  const blueprint=createCrmCustomField(blankCrmFieldBlueprint(),{
   label:'Custom',target:'company',type:'number',
  },'field-1');
  expect(()=>planSharedCrmFieldPublication('org-A',blueprint,[stored({organization_id:'org-B'})]))
   .toThrow('different organization');
  expect(()=>planSharedCrmFieldPublication('org-A',blueprint,[stored()]))
   .toThrow('cannot change its key, record type or value type');
  expect(()=>planSharedCrmFieldPublication('',blueprint,[]))
   .toThrow('Organization is required');
 });
 it('warns on removing choice options that might exist in shared record values',()=>{
  const blueprint=createCrmCustomField(blankCrmFieldBlueprint(),{
   label:'Custom',target:'company',type:'choice',options:['Basic','Premium'],
  },'field-1');
  const plan=planSharedCrmFieldPublication('org-A',blueprint,[stored({
   field_type:'choice',options:['Basic','Premium','Legacy'],
  })]);
  expect(plan.choiceChangesRequiringValueReview).toEqual(['field-1']);
 });
 it('rejects duplicate published IDs, key conflicts, or malformed drafts',()=>{
  const blueprint=createCrmCustomField(blankCrmFieldBlueprint(),{
   label:'Custom',target:'company',type:'text',
  },'field-1');
  expect(()=>planSharedCrmFieldPublication('org-A',blueprint,[stored(),stored()]))
   .toThrow('Duplicate published field IDs');
  const other=createCrmCustomField(blankCrmFieldBlueprint(),{
   label:'Custom',target:'company',type:'text',
  },'other-id');
  expect(()=>planSharedCrmFieldPublication('org-A',other,[stored()]))
   .toThrow('already belongs to the organization');
  expect(()=>planSharedCrmFieldPublication('org-A',{
   version:1,fields:[mk(),mk()],
  },[])).toThrow('invalid or duplicate');
 });
 it('writes exactly one typed, scoped Company value without changing core CRM rows',()=>{
  expect(write()).toEqual({action:'upsert',row:{
   organization_id:'org-A',field_id:'field-1',record_type:'company',
   company_id:'record-1',contact_id:null,project_id:null,
   value_text:'Hello',value_number:null,value_date:null,
   value_choice:null,value_boolean:null,
  }});
 });
 it('validates numbers, dates, choices and booleans using the field definition',()=>{
  const cases=[
   [mk('number'),8,'value_number'],
   [mk('date'),'2026-11-16','value_date'],
   [mk('choice'),'Premium','value_choice'],
   [mk('boolean'),false,'value_boolean'],
  ] as const;
  for(const [field,value,column] of cases){
   const op=write(field,value);
   expect(op.action).toBe('upsert');
   if(op.action==='upsert'){
    expect(op.row[column]).toBe(value);
    expect(decodeSharedCrmValue(op.row,field,{
     organizationId:'org-A',target:'company',recordId:'record-1',
    })).toBe(value);
   }
  }
  expect(()=>write(mk('number'),'123')).toThrow('valid number');
  expect(()=>write(mk('date'),'2026-02-30')).toThrow('valid date');
  expect(()=>write(mk('choice'),'Unlisted')).toThrow('valid choice');
 });
 it('uses the correct physical foreign-key column for People and Deals',()=>{
  const person=write(mk('text','person'),'hello');
  const deal=write(mk('boolean','deal'),true);
  expect(person.action).toBe('upsert');
  expect(deal.action).toBe('upsert');
  if(person.action==='upsert')expect(person.row).toMatchObject({
   record_type:'person',company_id:null,contact_id:'record-1',project_id:null,
  });
  if(deal.action==='upsert')expect(deal.row).toMatchObject({
   record_type:'deal',company_id:null,contact_id:null,project_id:'record-1',
  });
 });
 it('deletes a cleared value instead of persisting an untyped null row',()=>{
  expect(write(mk(),null)).toEqual({
   action:'delete',organizationId:'org-A',fieldId:'field-1',
   target:'company',recordId:'record-1',
  });
  expect(write(mk(),'')).toMatchObject({action:'delete'});
 });
 it('rejects mismatched or paused fields and empty target IDs before writing',()=>{
  expect(()=>buildSharedCrmValueOperation({
   organizationId:'org-A',target:'deal',recordId:'d1',field:mk(),value:'hi',
  })).toThrow('does not belong');
  expect(()=>write({...mk(),active:false},'hi')).toThrow('paused');
  expect(()=>write(mk(),'Hello','   ')).toThrow('CRM record is required');
 });
 it('reads only exact organization, record, target and field identities',()=>{
  const op=write();
  expect(op.action).toBe('upsert');
  if(op.action!=='upsert')return;
  const row=op.row;
  expect(decodeSharedCrmValue(row,mk(),{
   organizationId:'org-A',target:'company',recordId:'record-1',
  })).toBe('Hello');
  expect(()=>decodeSharedCrmValue(row,mk(),{
   organizationId:'org-B',target:'company',recordId:'record-1',
  })).toThrow('scope');
  expect(()=>decodeSharedCrmValue(row,mk(),{
   organizationId:'org-A',target:'company',recordId:'record-2',
  })).toThrow('different CRM record');
  expect(()=>decodeSharedCrmValue({...row,field_id:'other'},mk(),{
   organizationId:'org-A',target:'company',recordId:'record-1',
  })).toThrow('scope');
 });
 it('rejects mixed physical record IDs and mixed typed columns on read',()=>{
  const op=write();
  if(op.action!=='upsert')throw Error('Expected upsert');
  const row=op.row;
  const scope={organizationId:'org-A',target:'company' as const,recordId:'record-1'};
  expect(()=>decodeSharedCrmValue({...row,contact_id:'person-1'},mk(),scope))
   .toThrow('different CRM record');
  expect(()=>decodeSharedCrmValue({...row,value_number:4},mk(),scope))
   .toThrow('conflicting field types');
  expect(()=>decodeSharedCrmValue({...row,value_text:null},mk(),scope))
   .toThrow('conflicting field types');
  expect(()=>decodeSharedCrmValue({...row,value_text:'x'.repeat(501)},mk(),scope))
   .toThrow('does not match');
 });
 it('keeps cloud writes disabled pending staging RLS tests and explicit schema review',()=>{
  const adapter=src('services/crmSharedFieldContract352c.ts');
  const designer=src('components/CrmFieldBlueprintSettings.tsx');
  const spec=readFileSync(new URL('../../docs/platform/75-shared-custom-fields-design-352c.md',
   import.meta.url),'utf8');
  expect(adapter).not.toContain('supabase.from(');
  expect(adapter).not.toContain('execute_sql');
  expect(adapter).toContain('No Supabase client, SQL, or customer-data');
  expect(designer).toContain('They are not shared with your team, do not appear on live records yet');
  expect(spec).toContain('NO PRODUCTION MIGRATION APPLIED');
  expect(spec).toContain('organization_id');
  expect(spec).toContain('private.is_org_admin');
  expect(spec).toContain('private.can_edit_org_area');
  expect(spec).toContain('FOREIGN KEY (organization_id, company_id)');
  expect(spec).toContain('FOREIGN KEY (organization_id, contact_id)');
  expect(spec).toContain('FOREIGN KEY (organization_id, project_id)');
 });
});
