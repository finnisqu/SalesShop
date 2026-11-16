/** Organization-specific CRM field blueprint. #352b intentionally stores
 * definitions as local drafts; applying values to shared records requires a
 * separately reviewed cloud schema and permission boundary. */
export type CrmFieldTarget='company'|'person'|'deal';
export type CrmFieldType='text'|'number'|'date'|'choice'|'boolean';
/** Presentation guidance only: cloud RLS must independently enforce this. */
export type CrmFieldVisibility='organization'|'crm_editors'|'admins';
export const CRM_FIELD_VISIBILITIES=[
 {id:'organization',label:'Everyone in organization',
  description:'Any signed-in teammate, including viewers, can read this field.'},
 {id:'crm_editors',label:'CRM editors and admins',
  description:'Only teammates permitted to edit CRM records and administrators can read it.'},
 {id:'admins',label:'Owners and admins only',
  description:'Restrict this field to organization leadership.'},
] as const;
export const DEFAULT_CRM_FIELD_VISIBILITY:CrmFieldVisibility='crm_editors';
const VISIBILITY_RANK:Record<CrmFieldVisibility,number>={
 admins:0,crm_editors:1,organization:2,
};
export function normalizeCrmFieldVisibility(value:unknown):CrmFieldVisibility{
 // Previous #352b browser-only blueprints had no visibility; keep the
 // newly adopted editors-only default. Unknown/tampered values fail closed.
 if(value===undefined||value===null)return DEFAULT_CRM_FIELD_VISIBILITY;
 return value==='organization'||value==='crm_editors'||value==='admins'?value:'admins';
}
export function widensCrmFieldVisibility(previous:CrmFieldVisibility,next:CrmFieldVisibility):boolean{
 return VISIBILITY_RANK[next]>VISIBILITY_RANK[previous];
}
/** UI guidance only. Never use client role state as database authorization. */
export function canReadCrmFieldVisibility(
 visibility:CrmFieldVisibility,
 role:'owner'|'admin'|'member'|'viewer'|null,
 crmEditPermitted:boolean,
):boolean{
 if(!role)return false;
 if(role==='owner'||role==='admin')return true;
 if(visibility==='organization')return true;
 return visibility==='crm_editors'&&role==='member'&&crmEditPermitted;
}

export const CRM_FIELD_TARGETS=[
 {id:'company',label:'Companies'},
 {id:'person',label:'People'},
 {id:'deal',label:'Deals'},
] as const;
export const CRM_FIELD_TYPES=[
 {id:'text',label:'Text'},
 {id:'number',label:'Number'},
 {id:'date',label:'Date'},
 {id:'choice',label:'Single choice'},
 {id:'boolean',label:'Yes / No'},
] as const;

export interface CrmCustomField {
 id:string;
 key:string;
 label:string;
 target:CrmFieldTarget;
 type:CrmFieldType;
 visibility?:CrmFieldVisibility;
 description?:string;
 options?:string[];
 active:boolean;
}

export interface CrmFieldBlueprint {version:1;fields:CrmCustomField[];}
export interface NewCrmCustomField {
 label:string;
 target:CrmFieldTarget;
 type:CrmFieldType;
 visibility?:CrmFieldVisibility;
 description?:string;
 options?:string[];
}
export type CrmFieldValue=string|number|boolean|null;

export const CRM_MAX_FIELDS_PER_TARGET=30;
export const CRM_MAX_OPTIONS=20;
export const CRM_LABEL_LIMIT=48;
export const CRM_DESCRIPTION_LIMIT=160;
export const CRM_TEXT_LIMIT=500;

const TARGETS=new Set<string>(CRM_FIELD_TARGETS.map(x=>x.id));
const TYPES=new Set<string>(CRM_FIELD_TYPES.map(x=>x.id));
const RESERVED_KEYS=new Set([
 'id','name','company_id','companyid','created_at','createdat','updated_at','updatedat',
 'owner_user_id','owneruserid','status','stage','pipeline','type','kind','amount',
 'email','phone','title','notes','due_date','duedate','assigned_user_id','assigneduserid',
 'custom_fields','customfields','metadata',
]);
const usableKey=(key:string)=>/^[a-z][a-z0-9_]{0,39}$/.test(key)&&!RESERVED_KEYS.has(key);
export const blankCrmFieldBlueprint=():CrmFieldBlueprint=>({version:1,fields:[]});

export function crmBlueprintStorageKey(
 mode:'local'|'cloud',organizationId:string|null,userId?:string,
):string{
 return 'salesshop-crm-field-blueprints-v1:'+JSON.stringify([
  mode,mode==='cloud'?organizationId??'signed-out':'local',
  mode==='cloud'?userId??'signed-out':'local',
 ]);
}

export function crmFieldKeyFromLabel(label:string):string{
 return label.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
}

export function crmFieldOptions(raw:readonly string[]):string[]{
 const seen=new Set<string>();
 const options:string[]=[];
 for(const input of raw){
  const item=String(input).trim().slice(0,CRM_LABEL_LIMIT);
  const code=item.toLocaleLowerCase();
  if(!item||seen.has(code))continue;
  seen.add(code);options.push(item);
  if(options.length===CRM_MAX_OPTIONS)break;
 }
 return options;
}

export function createCrmCustomField(
 blueprint:CrmFieldBlueprint,input:NewCrmCustomField,id:string,
):CrmFieldBlueprint{
 if(!TARGETS.has(input.target)||!TYPES.has(input.type))throw new Error('Choose a valid record and field type.');
 const label=input.label.trim().slice(0,CRM_LABEL_LIMIT);
 const key=crmFieldKeyFromLabel(label);
 if(!label||!key||!usableKey(key))
  throw new Error('Use a descriptive field name that does not conflict with a built-in CRM field.');
 if(blueprint.fields.filter(f=>f.target===input.target).length>=CRM_MAX_FIELDS_PER_TARGET)
  throw new Error('Limit reached: 30 custom fields for each record type.');
 if(blueprint.fields.some(f=>f.target===input.target&&(f.key===key||
   f.label.toLocaleLowerCase()===label.toLocaleLowerCase())))
  throw new Error('A field with this name already exists for that record type.');
 if(!id||id.length>100||blueprint.fields.some(f=>f.id===id))
  throw new Error('Could not assign a unique field ID. Please retry.');
 const options=input.type==='choice'?crmFieldOptions(input.options??[]):undefined;
 if(input.type==='choice'&&(options?.length??0)<2)
  throw new Error('Single choice fields need at least two different options.');
 const description=input.description?.trim().slice(0,CRM_DESCRIPTION_LIMIT)||undefined;
 const field:CrmCustomField={id,key,label,target:input.target,type:input.type,
  visibility:normalizeCrmFieldVisibility(input.visibility),
  ...(description?{description}:{}),...(options?{options}:{}),active:true};
 return {version:1,fields:[...blueprint.fields,field]};
}

/** Disabling a definition keeps its stable ID/key for future record-value
 * migrations. No hard delete operation is offered for published fields. */
export function toggleCrmCustomField(
 blueprint:CrmFieldBlueprint,id:string,active:boolean,
):CrmFieldBlueprint{
 return {...blueprint,fields:blueprint.fields.map(f=>f.id===id?{...f,active}:f)};
}

export function setCrmFieldVisibility(
 blueprint:CrmFieldBlueprint,id:string,visibility:CrmFieldVisibility,
):CrmFieldBlueprint{
 if(!CRM_FIELD_VISIBILITIES.some(item=>item.id===visibility))
  throw new Error('Choose a valid field visibility.');
 return {...blueprint,fields:blueprint.fields.map(field=>
  field.id===id?{...field,visibility}:field)};
}

export function moveCrmCustomField(
 blueprint:CrmFieldBlueprint,id:string,direction:-1|1,
):CrmFieldBlueprint{
 const index=blueprint.fields.findIndex(f=>f.id===id);
 if(index<0)return blueprint;
 const target=blueprint.fields[index].target;
 const indices=blueprint.fields.flatMap((f,i)=>f.target===target?[i]:[]);
 const position=indices.indexOf(index),dest=indices[position+direction];
 if(dest===undefined)return blueprint;
 const fields=[...blueprint.fields];
 [fields[index],fields[dest]]=[fields[dest],fields[index]];
 return {version:1,fields};
}

export function validateCrmCustomFieldValue(
 field:CrmCustomField,value:unknown,
):{valid:true;value:CrmFieldValue}|{valid:false;error:string}{
 if(value===null||value===undefined||value==='')return {valid:true,value:null};
 switch(field.type){
  case 'text':
   if(typeof value==='string'&&value.trim().length<=CRM_TEXT_LIMIT)
    return {valid:true,value:value.trim()};
   break;
  case 'number':
   if(typeof value==='number'&&Number.isFinite(value))return {valid:true,value};
   break;
  case 'date':
   if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){
    const date=new Date(value+'T12:00:00Z');
    if(Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value)
     return {valid:true,value};
   }
   break;
  case 'choice':
   if(typeof value==='string'&&field.options?.includes(value))return {valid:true,value};
   break;
  case 'boolean':
   if(typeof value==='boolean')return {valid:true,value};
   break;
 }
 return {valid:false,error:'Enter a valid '+field.type+' value for '+field.label+'.'};
}

/** Corrupt, outdated and untrusted device data cannot introduce custom keys
 * into the live CRM; these definitions are still only local blueprints. */
export function normalizeCrmFieldBlueprint(raw:unknown):CrmFieldBlueprint{
 if(!raw||typeof raw!=='object'||(raw as {version?:unknown}).version!==1)
  return blankCrmFieldBlueprint();
 const entries=(raw as {fields?:unknown}).fields;
 if(!Array.isArray(entries))return blankCrmFieldBlueprint();
 const fields:CrmCustomField[]=[];
 const seenIds=new Set<string>(),seenKeys=new Set<string>();
 for(const row of entries.slice(0,200)){
  if(!row||typeof row!=='object')continue;
  const f=row as Record<string,unknown>;
  const id=typeof f.id==='string'?f.id.trim():'';
  const label=typeof f.label==='string'?f.label.trim().slice(0,CRM_LABEL_LIMIT):'';
  const key=typeof f.key==='string'?f.key:'';
  if(!id||id.length>100||!label||!usableKey(key)||
     !TARGETS.has(String(f.target))||!TYPES.has(String(f.type)))continue;
  const target=f.target as CrmFieldTarget,type=f.type as CrmFieldType;
  const composite=target+':'+key;
  if(seenIds.has(id)||seenKeys.has(composite)||
    fields.filter(item=>item.target===target).length>=CRM_MAX_FIELDS_PER_TARGET)continue;
  const options=type==='choice'?crmFieldOptions(
   Array.isArray(f.options)?f.options.filter((x):x is string=>typeof x==='string'):[]):undefined;
  if(type==='choice'&&(options?.length??0)<2)continue;
  const description=typeof f.description==='string'?
   f.description.trim().slice(0,CRM_DESCRIPTION_LIMIT)||undefined:undefined;
  fields.push({id,label,key,target,type,visibility:normalizeCrmFieldVisibility(f.visibility),
   ...(options?{options}:{}),
   ...(description?{description}:{}),active:f.active!==false});
  seenIds.add(id);seenKeys.add(composite);
 }
 return {version:1,fields};
}

export function readCrmFieldBlueprint(raw:string|null):CrmFieldBlueprint{
 try{return normalizeCrmFieldBlueprint(JSON.parse(raw??'null'));}
 catch{return blankCrmFieldBlueprint();}
}
