/** Batch 352e1 — optional CRM starter fields.
 * These templates change ONLY account/organization-scoped browser blueprints.
 * They never mutate CRM records or publish definitions to Supabase. */
import {
 createCrmCustomField,crmFieldKeyFromLabel,
 type CrmFieldBlueprint,type NewCrmCustomField,
} from './crmFieldBlueprint352b';

export type CrmStarterPackId='general_sales'|'construction_trades'|'professional_services';
export interface CrmStarterPack {
 id:CrmStarterPackId;
 title:string;
 description:string;
 fields:readonly NewCrmCustomField[];
}

export const CRM_STARTER_FIELD_PACKS:readonly CrmStarterPack[]=[
 {
  id:'general_sales',title:'General Sales',
  description:'A lightweight starting point for most sales organizations.',
  fields:[
   {target:'company',label:'Customer Segment',type:'choice',
    options:['Prospect','Customer','Partner']},
   {target:'person',label:'Preferred Contact Method',type:'choice',
    options:['Email','Phone','Text']},
   {target:'deal',label:'Lead Source',type:'choice',
    options:['Referral','Website','Outreach','Returning customer']},
   {target:'deal',label:'Next Decision Date',type:'date'},
  ],
 },
 {
  id:'construction_trades',title:'Construction & Trades',
  description:'Optional account, site-contact and opportunity details for project work.',
  fields:[
   {target:'company',label:'Service Region',type:'text'},
   {target:'person',label:'Site Contact Role',type:'choice',
    options:['Decision maker','Project manager','Site contact','Other']},
   {target:'deal',label:'Project Category',type:'choice',
    options:['Residential','Commercial','Multifamily','Other']},
   {target:'deal',label:'Site Visit Required',type:'boolean'},
  ],
 },
 {
  id:'professional_services',title:'Professional Services',
  description:'Useful client and engagement attributes without a fixed workflow.',
  fields:[
   {target:'company',label:'Client Industry',type:'text'},
   {target:'person',label:'Primary Stakeholder',type:'boolean'},
   {target:'deal',label:'Engagement Model',type:'choice',
    options:['Fixed fee','Hourly','Retainer']},
   {target:'deal',label:'Target Kickoff',type:'date'},
  ],
 },
];

export type CrmStarterFieldStatus='add'|'present'|'incompatible';
export interface CrmStarterFieldPlan {
 field:NewCrmCustomField;
 status:CrmStarterFieldStatus;
 message:string;
}
export interface CrmStarterPackPlan {
 pack:CrmStarterPack;
 fields:CrmStarterFieldPlan[];
 additions:number;
 present:number;
 incompatible:number;
 blockedReason:string|null;
}

function getPack(id:CrmStarterPackId):CrmStarterPack{
 const pack=CRM_STARTER_FIELD_PACKS.find(item=>item.id===id);
 if(!pack)throw new Error('Unknown CRM starter pack.');
 return pack;
}

/** Stable IDs avoid duplicate imports and will remain traceable if definitions
 * are eventually published. No imported field is mandatory or publicly visible. */
export function crmStarterFieldId(packId:CrmStarterPackId,field:NewCrmCustomField):string{
 return 'starter_'+packId+'_'+field.target+'_'+crmFieldKeyFromLabel(field.label);
}

/** Pure, atomic preflight. Existing keys are never overwritten, including
 * manually changed labels, types, visibility, order and active state. */
export function previewCrmStarterPack(
 blueprint:CrmFieldBlueprint,id:CrmStarterPackId,
):CrmStarterPackPlan{
 const pack=getPack(id);
 const fields:CrmStarterFieldPlan[]=[];
 let staged=blueprint;
 let blockedReason:string|null=null;
 for(const field of pack.fields){
  const key=crmFieldKeyFromLabel(field.label);
  const existing=staged.fields.find(item=>item.target===field.target&&item.key===key);
  if(existing){
   const compatible=existing.type===field.type;
   fields.push({field,status:compatible?'present':'incompatible',
    message:compatible?'Already defined — your settings will be kept.':
     'Key already exists with a different type — it will not be changed.'});
   continue;
  }
  if(blockedReason){
   fields.push({field,status:'add',message:'Pending capacity review.'});
   continue;
  }
  try{
   staged=createCrmCustomField(staged,field,crmStarterFieldId(id,field));
   fields.push({field,status:'add',message:'Will add to the local blueprint.'});
  }catch(error){
   blockedReason=error instanceof Error?error.message:'Unable to add the starter fields.';
   fields.push({field,status:'add',message:'Cannot add until the issue is resolved.'});
  }
 }
 return {
  pack,fields,
  additions:fields.filter(item=>item.status==='add').length,
  present:fields.filter(item=>item.status==='present').length,
  incompatible:fields.filter(item=>item.status==='incompatible').length,
  blockedReason,
 };
}

/** Idempotent and all-or-nothing. Never deletes or edits existing definitions.
 * The parent Settings component owns device-only persistence and role gating. */
export function applyCrmStarterPack(
 blueprint:CrmFieldBlueprint,id:CrmStarterPackId,
):CrmFieldBlueprint{
 const plan=previewCrmStarterPack(blueprint,id);
 if(plan.blockedReason)throw new Error(plan.blockedReason);
 if(!plan.additions)return blueprint;
 let next=blueprint;
 for(const entry of plan.fields){
  if(entry.status==='add'){
   next=createCrmCustomField(next,entry.field,crmStarterFieldId(id,entry.field));
  }
 }
 return next;
}
