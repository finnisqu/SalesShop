/** Batch 352e2: portable, local-only CRM configuration drafts.
 * A bundle has no organization identifiers, people, CRM records, or values.
 * Importing drafts has NO server/cloud effect. */
import {
 createCrmCustomField,crmFieldKeyFromLabel,crmFieldOptions,
 CRM_FIELD_TARGETS,CRM_FIELD_TYPES,CRM_FIELD_VISIBILITIES,
 CRM_DESCRIPTION_LIMIT,CRM_LABEL_LIMIT,CRM_MAX_FIELDS_PER_TARGET,
 type CrmCustomField,type CrmFieldBlueprint,type CrmFieldTarget,
 type CrmFieldType,type CrmFieldVisibility,
} from './crmFieldBlueprint352b';

export type CrmModulePlanId=
 'lead_intake'|'pipeline_reviews'|'project_handoff'|'renewal_follow_up';
export type CrmModulePlans=Record<CrmModulePlanId,boolean>;
export const CRM_MODULE_PLANS=[
 {id:'lead_intake',label:'Lead intake',
  description:'Plan a configurable qualification form and lead routing flow.'},
 {id:'pipeline_reviews',label:'Pipeline reviews',
  description:'Plan optional pipeline check-ins and shared deal review views.'},
 {id:'project_handoff',label:'Project handoff',
  description:'Plan handoff checklists after a deal is awarded.'},
 {id:'renewal_follow_up',label:'Renewal follow-up',
  description:'Plan follow-up prompts for repeat and contract-based customers.'},
] as const;

const FORMAT='salesshop.crm.configuration' as const;
const VERSION=1 as const;
const MAX_BUNDLE_CHARS=80000;
const MODULE_IDS=CRM_MODULE_PLANS.map(module=>module.id);
const FIELD_PROPERTIES=new Set([
 'id','key','label','target','type','visibility','description','options','active',
]);
const ROOT_PROPERTIES=new Set(['format','version','fields','modules']);
const fieldTargets=new Set<string>(CRM_FIELD_TARGETS.map(target=>target.id));
const fieldTypes=new Set<string>(CRM_FIELD_TYPES.map(type=>type.id));
const fieldVisibilities=new Set<string>(CRM_FIELD_VISIBILITIES.map(item=>item.id));

const object=(value:unknown):value is Record<string,unknown>=>
 typeof value==='object'&&value!==null&&!Array.isArray(value);
const own=(value:Record<string,unknown>,key:string):boolean=>
 Object.prototype.hasOwnProperty.call(value,key);

export const blankCrmModulePlans=():CrmModulePlans=>({
 lead_intake:false,pipeline_reviews:false,project_handoff:false,renewal_follow_up:false,
});

export function readCrmModulePlans(raw:string|null):CrmModulePlans{
 try{
  const value:unknown=JSON.parse(raw??'null');
  if(!object(value))return blankCrmModulePlans();
  const result=blankCrmModulePlans();
  for(const id of MODULE_IDS)result[id]=value[id]===true;
  return result;
 }catch{return blankCrmModulePlans();}
}

export function crmModulePlansStorageKey(scope:string):string{
 return scope+':crm-module-plans-v1';
}

export function setCrmModulePlan(
 plans:CrmModulePlans,id:CrmModulePlanId,planned:boolean,
):CrmModulePlans{
 if(!MODULE_IDS.includes(id))throw new Error('Unknown CRM module.');
 return {...plans,[id]:planned};
}

/** Generated JSON is explicitly a blueprint + design-intent module list.
 * Whitelist exported keys; never spread arbitrary records or settings. */
export function exportCrmConfiguration(
 blueprint:CrmFieldBlueprint,modules:CrmModulePlans,
):string{
 return JSON.stringify({
  format:FORMAT,version:VERSION,
  fields:blueprint.fields.map(field=>({
   id:field.id,key:field.key,label:field.label,target:field.target,type:field.type,
   visibility:field.visibility??'crm_editors',
   ...(field.description?{description:field.description}:{}),
   ...(field.type==='choice'?{options:[...(field.options??[])]}:{}),
   active:field.active,
  })),
  modules:Object.fromEntries(MODULE_IDS.map(id=>[id,modules[id]===true])),
 },null,2);
}

function reject(message:string):never{throw new Error(message);}
function parseField(value:unknown,position:number):CrmCustomField{
 const at='Field '+(position+1);
 if(!object(value))return reject(at+' must be an object.');
 if(Object.keys(value).some(key=>!FIELD_PROPERTIES.has(key)))
  return reject(at+' includes unsupported or record-value properties.');
 const {id,key,label,target,type,visibility,active,description,options}=value;
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||
    typeof key!=='string'||typeof label!=='string'||
    label!==label.trim()||!label||label.length>CRM_LABEL_LIMIT||
    !fieldTargets.has(String(target))||!fieldTypes.has(String(type))||
    !fieldVisibilities.has(String(visibility))||typeof active!=='boolean')
  return reject(at+' contains an invalid ID, label, target, type, visibility or state.');
 if(crmFieldKeyFromLabel(label)!==key)
  return reject(at+' has a key that does not match its label.');
 if(own(value,'description')&&(
    typeof description!=='string'||description.length>CRM_DESCRIPTION_LIMIT||
    !description.trim()||description!==description.trim()))
  return reject(at+' has an invalid description.');
 if(type==='choice'){
  if(!Array.isArray(options)||options.length<2||options.length>20||
     !options.every(item=>typeof item==='string'&&item.trim()===item&&
      item.length>0&&item.length<=CRM_LABEL_LIMIT)||
     crmFieldOptions(options as string[]).length!==options.length)
   return reject(at+' has invalid or duplicate choices.');
 }else if(own(value,'options')){
  return reject(at+' has options but is not a single-choice field.');
 }
 return {
  id,key,label,target:target as CrmFieldTarget,type:type as CrmFieldType,
  visibility:visibility as CrmFieldVisibility,active,
  ...(typeof description==='string'?{description}:{}),
  ...(type==='choice'?{options:options as string[]}:{}),
 };
}

export interface CrmImportFieldReview{
 field:CrmCustomField;
 status:'add'|'present'|'conflict';
 message:string;
}
export interface CrmImportModuleReview{
 id:CrmModulePlanId;
 label:string;
 status:'plan'|'already_planned'|'not_requested';
}
export interface CrmConfigurationImportPlan{
 fields:CrmImportFieldReview[];
 modules:CrmImportModuleReview[];
 additions:number;
 alreadyPresent:number;
 conflicts:number;
 modulesToPlan:number;
 blockedReason:string|null;
 nextBlueprint:CrmFieldBlueprint;
 nextModules:CrmModulePlans;
}

/** Fail closed on malformed/cross-version envelopes. Unlike the tolerant
 * browser preference normalizer, portable imports may not silently drop
 * malformed definitions or smuggle extra payloads into CRM. */
export function previewCrmConfigurationImport(
 blueprint:CrmFieldBlueprint,currentModules:CrmModulePlans,json:string,
):CrmConfigurationImportPlan{
 if(json.length>MAX_BUNDLE_CHARS)throw new Error('Bundle exceeds the 80,000-character limit.');
 let value:unknown;
 try{value=JSON.parse(json);}catch{throw new Error('Paste valid JSON configuration.');}
 if(!object(value)||Object.keys(value).some(key=>!ROOT_PROPERTIES.has(key))||
    value.format!==FORMAT||value.version!==VERSION||
    !Array.isArray(value.fields)||!object(value.modules))
  throw new Error('Unsupported or unsafe CRM configuration bundle.');
 if(value.fields.length>CRM_MAX_FIELDS_PER_TARGET*CRM_FIELD_TARGETS.length)
  throw new Error('Too many field definitions in the configuration bundle.');
 const incomingFields:CrmCustomField[]=[];
 const uniqueIds=new Set<string>(),uniqueKeys=new Set<string>();
 // Reject any invalid payload before considering an import; never partially
 // normalize tampered, unsupported or value-bearing JSON.
 for(let i=0;i<value.fields.length;i++){
  const field=parseField(value.fields[i],i);
  const pair=field.target+':'+field.key;
  if(uniqueIds.has(field.id)||uniqueKeys.has(pair))
   throw new Error('The bundle contains duplicate field IDs or record keys.');
  uniqueIds.add(field.id);uniqueKeys.add(pair);
  incomingFields.push(field);
 }
 const incomingModules=value.modules;
 if(Object.keys(incomingModules).length!==MODULE_IDS.length||
    Object.keys(incomingModules).some(id=>!MODULE_IDS.includes(id as CrmModulePlanId))||
    MODULE_IDS.some(id=>typeof incomingModules[id]!=='boolean'))
  throw new Error('Bundle contains unknown or invalid module settings.');
 let nextBlueprint=blueprint;
 let blockedReason:string|null=null;
 const fields:CrmImportFieldReview[]=[];
 for(const field of incomingFields){
  const previous=nextBlueprint.fields.find(current=>
   current.target===field.target&&current.key===field.key);
  if(previous){
   const compatible=previous.type===field.type;
   fields.push({field,status:compatible?'present':'conflict',
    message:compatible?'Existing field kept; imported settings will not overwrite it.':
     'Type conflict; existing field kept and this field skipped.'});
   continue;
  }
  if(blockedReason){
   fields.push({field,status:'add',message:'Pending capacity review.'});
   continue;
  }
  let id=field.id;
  if(nextBlueprint.fields.some(current=>current.id===id)){
   const base='import_'+field.target+'_'+field.key;
   id=base;
   for(let number=2;nextBlueprint.fields.some(current=>current.id===id);number++)
    id=base+'_'+number;
  }
  try{
   nextBlueprint=createCrmCustomField(nextBlueprint,{
    target:field.target,label:field.label,type:field.type,
    visibility:field.visibility,
    ...(field.description?{description:field.description}:{}),
    ...(field.type==='choice'?{options:field.options}:{}),
   },id);
   // Keep the explicitly exported active/paused state of *new* definitions.
   if(!field.active){
    nextBlueprint={version:1,fields:nextBlueprint.fields.map(item=>
     item.id===id?{...item,active:false}:item)};
   }
   fields.push({field,status:'add',message:'New optional definition to add locally.'});
  }catch(error){
   blockedReason=error instanceof Error?error.message:'Invalid field definition.';
   fields.push({field,status:'add',message:'Cannot add until the issue is resolved.'});
  }
 }
 const nextModules={...currentModules};
 const modules:CrmImportModuleReview[]=CRM_MODULE_PLANS.map(module=>{
  const incoming=incomingModules[module.id]===true;
  const previous=currentModules[module.id]===true;
  if(incoming)nextModules[module.id]=true;
  return {id:module.id,label:module.label,
   status:!incoming?'not_requested':previous?'already_planned':'plan'};
 });
 return {
  fields,modules,
  additions:fields.filter(item=>item.status==='add').length,
  alreadyPresent:fields.filter(item=>item.status==='present').length,
  conflicts:fields.filter(item=>item.status==='conflict').length,
  modulesToPlan:modules.filter(item=>item.status==='plan').length,
  blockedReason,
  nextBlueprint:blockedReason?blueprint:nextBlueprint,
  nextModules:blockedReason?currentModules:nextModules,
 };
}

/** A single caller-reviewed preflight result is the only import output.
 * Storage and permission checks remain entirely with the parent UI. */
export function applyCrmConfigurationImport(
 blueprint:CrmFieldBlueprint,modules:CrmModulePlans,json:string,
):{blueprint:CrmFieldBlueprint;modules:CrmModulePlans}{
 const plan=previewCrmConfigurationImport(blueprint,modules,json);
 if(plan.blockedReason)throw new Error(plan.blockedReason);
 return {blueprint:plan.nextBlueprint,modules:plan.nextModules};
}
