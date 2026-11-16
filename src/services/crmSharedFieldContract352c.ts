import {
 normalizeCrmFieldBlueprint,validateCrmCustomFieldValue,
 type CrmCustomField,type CrmFieldBlueprint,type CrmFieldTarget,
 type CrmFieldType,type CrmFieldValue,
} from './crmFieldBlueprint352b';

/** The proposed cloud schema. No Supabase client, SQL, or customer-data
 * mutations live in this contract; production storage is NOT enabled. */
export interface SharedCrmDefinitionRow{
 organization_id:string;
 id:string;
 record_type:CrmFieldTarget;
 field_key:string;
 label:string;
 field_type:CrmFieldType;
 description:string|null;
 options:string[];
 active:boolean;
 revision:number;
}
export type SharedCrmValueColumn=
 'value_text'|'value_number'|'value_date'|'value_choice'|'value_boolean';
export interface SharedCrmValueRow{
 organization_id:string;
 field_id:string;
 record_type:CrmFieldTarget;
 company_id:string|null;
 contact_id:string|null;
 project_id:string|null;
 value_text:string|null;
 value_number:number|null;
 value_date:string|null;
 value_choice:string|null;
 value_boolean:boolean|null;
}
export type SharedCrmValueOperation=
 {action:'upsert';row:SharedCrmValueRow}|
 {action:'delete';organizationId:string;fieldId:string;target:CrmFieldTarget;recordId:string};
export interface SharedCrmPublicationPlan{
 organizationId:string;
 creates:SharedCrmDefinitionRow[];
 updates:SharedCrmDefinitionRow[];
 unchanged:SharedCrmDefinitionRow[];
 /** Values must be checked before removing choices currently in use. */
 choiceChangesRequiringValueReview:string[];
}

const recordColumn:Record<CrmFieldTarget,'company_id'|'contact_id'|'project_id'>={
 company:'company_id',person:'contact_id',deal:'project_id',
};
const valueColumn:Record<CrmFieldType,SharedCrmValueColumn>={
 text:'value_text',number:'value_number',date:'value_date',
 choice:'value_choice',boolean:'value_boolean',
};
const trimmed=(v:string|undefined,label:string):string=>{
 const clean=v?.trim()??'';
 if(!clean)throw new Error(label+' is required.');
 return clean;
};
const definitionFromField=(organizationId:string,field:CrmCustomField,revision:number):SharedCrmDefinitionRow=>({
 organization_id:organizationId,id:field.id,record_type:field.target,
 field_key:field.key,label:field.label,field_type:field.type,
 description:field.description??null,options:[...(field.options??[])],
 active:field.active,revision,
});
function assertDefinitionScope(row:SharedCrmDefinitionRow,organizationId:string){
 if(row.organization_id!==organizationId)
  throw new Error('Custom field definition belongs to a different organization.');
}
function definitionsMatch(a:SharedCrmDefinitionRow,b:SharedCrmDefinitionRow):boolean{
 return a.label===b.label&&a.description===b.description&&
  a.active===b.active&&JSON.stringify(a.options)===JSON.stringify(b.options);
}

/** Preview organization-wide publication. Missing local draft fields are NOT
 * implicitly deleted from the shared organization. Record IDs and types
 * remain immutable; choice shrinkage needs a value reconciliation check. */
export function planSharedCrmFieldPublication(
 organizationId:string,blueprint:CrmFieldBlueprint,
 existing:readonly SharedCrmDefinitionRow[],
):SharedCrmPublicationPlan{
 const org=trimmed(organizationId,'Organization');
 if(blueprint.version!==1||!Array.isArray(blueprint.fields))
  throw new Error('Unsupported custom-field blueprint.');
 const normalized=normalizeCrmFieldBlueprint(blueprint);
 if(normalized.fields.length!==blueprint.fields.length)
  throw new Error('Blueprint has invalid or duplicate fields. Repair the draft before publishing.');
 const priorById=new Map<string,SharedCrmDefinitionRow>();
 for(const row of existing){
  assertDefinitionScope(row,org);
  if(priorById.has(row.id))throw new Error('Duplicate published field IDs.');
  priorById.set(row.id,row);
 }
 const creates:SharedCrmDefinitionRow[]=[],updates:SharedCrmDefinitionRow[]=[],
  unchanged:SharedCrmDefinitionRow[]=[],choiceChangesRequiringValueReview:string[]=[];
 for(const field of normalized.fields){
  const prior=priorById.get(field.id);
  const next=definitionFromField(org,field,prior?.revision??0);
  if(prior){
   if(prior.record_type!==next.record_type||prior.field_key!==next.field_key||
      prior.field_type!==next.field_type)
    throw new Error('A published field cannot change its key, record type or value type.');
   if(definitionsMatch(prior,next))unchanged.push(prior);
   else{
    if(prior.field_type==='choice'&&prior.options.some(option=>!next.options.includes(option)))
     choiceChangesRequiringValueReview.push(field.id);
    updates.push({...next,revision:prior.revision+1});
   }
  }else{
   if(existing.some(row=>row.record_type===next.record_type&&row.field_key===next.field_key))
    throw new Error('A field with this key already belongs to the organization.');
   creates.push({...next,revision:1});
  }
 }
 return {organizationId:org,creates,updates,unchanged,choiceChangesRequiringValueReview};
}

export function buildSharedCrmValueOperation(input:{
 organizationId:string;
 target:CrmFieldTarget;
 recordId:string;
 field:CrmCustomField;
 value:unknown;
}):SharedCrmValueOperation{
 const organizationId=trimmed(input.organizationId,'Organization'),
  recordId=trimmed(input.recordId,'CRM record');
 if(input.field.target!==input.target)
  throw new Error('Field does not belong to this CRM record type.');
 if(!input.field.active)throw new Error('This field is paused. Existing values remain readable.');
 const checked=validateCrmCustomFieldValue(input.field,input.value);
 if(!checked.valid)throw new Error(checked.error);
 if(checked.value===null)return {
  action:'delete',organizationId,fieldId:input.field.id,target:input.target,recordId,
 };
 const row:SharedCrmValueRow={
  organization_id:organizationId,field_id:input.field.id,record_type:input.target,
  company_id:null,contact_id:null,project_id:null,
  value_text:null,value_number:null,value_date:null,value_choice:null,value_boolean:null,
 };
 const key=recordColumn[input.target],valueKey=valueColumn[input.field.type];
 row[key]=recordId;
 // The validated union is narrowed by field.type; PostgreSQL independently
 // enforces exactly one typed value and matching definition before accepting.
 if(valueKey==='value_number')row.value_number=checked.value as number;
 else if(valueKey==='value_boolean')row.value_boolean=checked.value as boolean;
 else row[valueKey]=checked.value as string;
 return {action:'upsert',row};
}

/** Read only rows that belong to the requested organization, record and
 * definition, and reject corrupt or mixed-value rows rather than merging
 * them into an unrelated record on the client. This is defense in depth;
 * it is NOT a substitute for RLS and composite foreign keys. */
export function decodeSharedCrmValue(
 row:SharedCrmValueRow,field:CrmCustomField,
 scope:{organizationId:string;target:CrmFieldTarget;recordId:string},
):CrmFieldValue{
 if(!scope.organizationId||!scope.recordId||row.organization_id!==scope.organizationId||
   row.record_type!==scope.target||field.target!==scope.target||row.field_id!==field.id)
  throw new Error('Custom value scope does not match the requested CRM record.');
 const actual=recordColumn[scope.target];
 const recordIds:[string,string|null][]=[
  ['company_id',row.company_id],['contact_id',row.contact_id],['project_id',row.project_id],
 ];
 if(row[actual]!==scope.recordId||
   recordIds.some(([key,id])=>key!==actual&&id!==null))
  throw new Error('Custom value refers to a different CRM record.');
 const active=valueColumn[field.type];
 const values:[SharedCrmValueColumn,CrmFieldValue][]=[
  ['value_text',row.value_text],['value_number',row.value_number],
  ['value_date',row.value_date],['value_choice',row.value_choice],
  ['value_boolean',row.value_boolean],
 ];
 if(values.filter(([,value])=>value!==null).length!==1||
   values.some(([key,value])=>key!==active&&value!==null))
  throw new Error('Custom value contains conflicting field types.');
 const raw=row[active];
 const checked=validateCrmCustomFieldValue(field,raw);
 if(!checked.valid||checked.value===null)
  throw new Error('Custom value does not match the field definition.');
 return checked.value;
}
