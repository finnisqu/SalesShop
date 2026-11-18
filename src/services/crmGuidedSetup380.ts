/** Guided, per-user CRM configuration drafts (#380).
 * Display-only proposal: never substitute for CRM auth, published fields or live stage data.
 * These profiles contain terminology and presentation preferences only, no customer values. */
import {
 previewCrmStarterPack,applyCrmStarterPack,
 type CrmStarterPackId,type CrmStarterPackPlan,
} from './crmStarterPacks352e1';
import {
 blankCrmModulePlans,CRM_MODULE_PLANS,crmModulePlansStorageKey,
 type CrmModulePlans,
} from './crmConfiguration352e2';
import {type CrmFieldBlueprint,type CrmFieldTarget} from './crmFieldBlueprint352b';

export type CrmSetupTemplateId='blank'|CrmStarterPackId;
export type CrmSetupPanelId='details'|'connections'|'files'|'notebook'|'recents';
export type CrmSetupView='table'|'board';
export type CrmSetupPanel={id:CrmSetupPanelId;visible:boolean};
export type CrmSetupTerminology={company:string;person:string;deal:string};
export interface CrmGuidedSetupDraft{
 version:1;
 template:CrmSetupTemplateId;
 terminology:CrmSetupTerminology;
 pipelineName:string;
 stages:string[];
 views:{companies:CrmSetupView;deals:CrmSetupView};
 panels:Record<CrmFieldTarget,CrmSetupPanel[]>;
 modules:CrmModulePlans;
}
export const CRM_SETUP_PANEL_LABELS:Record<CrmSetupPanelId,string>={
 details:'Details',connections:'Connections',files:'Files',notebook:'Notebook',recents:'Recents',
};
export const CRM_SETUP_PANEL_IDS:readonly CrmSetupPanelId[]=[
 'details','connections','files','notebook','recents',
];
export const CRM_SETUP_TEMPLATE_IDS:readonly CrmSetupTemplateId[]=[
 'blank','general_sales','construction_trades','real_estate','professional_services',
];
export const CRM_SETUP_TEMPLATES=[
 {id:'blank',label:'Blank CRM',description:'Start with the universal CRM core; add only what your team needs.',
  company:'Company',person:'Person',deal:'Deal',pipeline:'Sales pipeline',
  stages:['New','Working','Won','Lost'],defaultDealView:'board',fieldPack:null},
 {id:'general_sales',label:'General sales',description:'Qualify leads, progress proposals, and close business.',
  company:'Company',person:'Contact',deal:'Deal',pipeline:'Sales pipeline',
  stages:['New','Qualified','Proposal','Negotiation','Closed Won','Closed Lost'],
  defaultDealView:'board',fieldPack:'general_sales'},
 {id:'construction_trades',label:'Construction & trades',description:'Bid work, follow project opportunities, and hand off awards.',
  company:'Contractor',person:'Contact',deal:'Project',pipeline:'Bids',
  stages:['Lead','Bid Development','Bid Submitted','Negotiation','Awarded','Lost'],
  defaultDealView:'board',fieldPack:'construction_trades'},
 {id:'real_estate',label:'Real estate',description:'Track properties, agents and buyers, and offer progress.',
  company:'Agency',person:'Contact',deal:'Opportunity',pipeline:'Property pipeline',
  stages:['Lead','Showing','Offer','Under Contract','Closed Won','Closed Lost'],
  defaultDealView:'board',fieldPack:'real_estate'},
 {id:'professional_services',label:'Professional services',description:'Manage prospects, scoping, proposals and engagements.',
  company:'Client',person:'Stakeholder',deal:'Engagement',pipeline:'Engagement pipeline',
  stages:['Inquiry','Discovery','Proposal','Contracting','Won','Lost'],
  defaultDealView:'table',fieldPack:'professional_services'},
] as const;

const moduleIds=CRM_MODULE_PLANS.map(item=>item.id);
const targets:readonly CrmFieldTarget[]=['company','person','deal'];
const requiredPanels:readonly CrmSetupPanelId[]=['details','connections'];
const templateIdSet=new Set<string>(CRM_SETUP_TEMPLATE_IDS);
const panelIds=new Set<string>(CRM_SETUP_PANEL_IDS);

export function createCrmGuidedPreset(template:CrmSetupTemplateId):CrmGuidedSetupDraft{
 const source=CRM_SETUP_TEMPLATES.find(item=>item.id===template);
 if(!source)throw new Error('Choose a supported CRM setup template.');
 const panels=():CrmSetupPanel[]=>CRM_SETUP_PANEL_IDS.map(id=>({
  id,visible:true,
 }));
 return {
  version:1,template,terminology:{
   company:source.company,person:source.person,deal:source.deal,
  },
  pipelineName:source.pipeline,stages:[...source.stages],
  views:{companies:'table',deals:source.defaultDealView},
  panels:{company:panels(),person:panels(),deal:panels()},
  modules:blankCrmModulePlans(),
 };
}
export function crmGuidedSetupStorageKey(scope:string):string{
 return scope+':crm-guided-setup-v1';
}
function object(value:unknown):value is Record<string,unknown>{
 return value!==null&&typeof value==='object'&&!Array.isArray(value);
}
function label(value:unknown,max:number):value is string{
 return typeof value==='string'&&value===value.trim()&&value.length>=2&&
  value.length<=max&&!/[\u0000-\u001f<>]/.test(value);
}
export function validateCrmGuidedSetup(value:unknown):string[]{
 const errors:string[]=[];
 if(!object(value)||value.version!==1||!templateIdSet.has(String(value.template)))
  return ['Choose a valid setup template.'];
 const terms=value.terminology;
 if(!object(terms)||!targets.every(key=>label(terms[key],28)))
  errors.push('Use a 2–28 character name for Companies, People and Deals.');
 if(!label(value.pipelineName,44))
  errors.push('Name your pipeline using 2–44 characters.');
 if(!Array.isArray(value.stages)||value.stages.length<2||value.stages.length>9||
  !value.stages.every(entry=>label(entry,36))||
  new Set(value.stages.map(entry=>typeof entry==='string'?entry.toLocaleLowerCase():'')).size!==
   value.stages.length)
  errors.push('Provide 2–9 unique pipeline stages, each 2–36 characters.');
 if(!object(value.views)||!['table','board'].includes(String(value.views.companies))||
  !['table','board'].includes(String(value.views.deals)))
  errors.push('Choose a valid Table or Board preference.');
 if(!object(value.panels)||!targets.every(target=>{
  const entries=value.panels as Record<string,unknown>;
  const list=entries[target];
  return Array.isArray(list)&&list.length===CRM_SETUP_PANEL_IDS.length&&
   list.every(panel=>object(panel)&&panelIds.has(String(panel.id))&&
    typeof panel.visible==='boolean')&&
   new Set(list.map(panel=>(panel as CrmSetupPanel).id)).size===CRM_SETUP_PANEL_IDS.length&&
   requiredPanels.every(id=>list.some(panel=>panel.id===id&&panel.visible===true));
 }))
  errors.push('Keep Details and Connections visible, and each record panel listed once.');
 const selectedModules=value.modules;
 if(!object(selectedModules)||Object.keys(selectedModules).length!==moduleIds.length||
  !moduleIds.every(id=>typeof selectedModules[id]==='boolean'))
  errors.push('Choose valid optional module plans.');
 return errors;
}
export function readCrmGuidedSetup(raw:string|null):CrmGuidedSetupDraft|null{
 if(!raw||raw.length>12000)return null;
 try{
  const parsed:unknown=JSON.parse(raw);
  if(validateCrmGuidedSetup(parsed).length)return null;
  const value=parsed as CrmGuidedSetupDraft;
  // Copy only whitelisted keys to prevent imported arbitrary metadata being kept.
  return {
   version:1,template:value.template,
   terminology:{...value.terminology},
   pipelineName:value.pipelineName,stages:[...value.stages],
   views:{...value.views},
   panels:Object.fromEntries(targets.map(target=>[target,
    value.panels[target].map(item=>({id:item.id,visible:item.visible}))])) as
    Record<CrmFieldTarget,CrmSetupPanel[]>,
   modules:Object.fromEntries(moduleIds.map(id=>[id,value.modules[id]])) as CrmModulePlans,
  };
 }catch{return null;}
}
export function updateCrmSetupPanel(
 setup:CrmGuidedSetupDraft,target:CrmFieldTarget,id:CrmSetupPanelId,
 change:'up'|'down'|'toggle',
):CrmGuidedSetupDraft{
 const list=setup.panels[target].map(item=>({...item}));
 const index=list.findIndex(item=>item.id===id);
 if(index<0)return setup;
 if(change==='toggle'){
  if(requiredPanels.includes(id))return setup;
  list[index].visible=!list[index].visible;
 }else{
  const other=index+(change==='up'?-1:1);
  if(other<0||other>=list.length)return setup;
  [list[index],list[other]]=[list[other],list[index]];
 }
 return {...setup,panels:{...setup.panels,[target]:list}};
}
export function updateCrmSetupStage(
 setup:CrmGuidedSetupDraft,index:number,name:string,
):CrmGuidedSetupDraft{
 if(index<0||index>=setup.stages.length)return setup;
 return {...setup,stages:setup.stages.map((stage,i)=>i===index?name:stage)};
}
export function moveCrmSetupStage(
 setup:CrmGuidedSetupDraft,index:number,direction:-1|1,
):CrmGuidedSetupDraft{
 const other=index+direction;
 if(index<0||other<0||other>=setup.stages.length)return setup;
 const stages=[...setup.stages];[stages[index],stages[other]]=[stages[other],stages[index]];
 return {...setup,stages};
}

export interface CrmGuidedSetupPlan{
 nextBlueprint:CrmFieldBlueprint;
 nextModules:CrmModulePlans;
 savedProfile:CrmGuidedSetupDraft;
 packPreview:CrmStarterPackPlan|null;
 fieldsToAdd:number;
 existingFields:number;
 conflictingFields:number;
 modulePlansToAdd:number;
}
/** All-or-nothing pure plan. Reuses established field packs; never rewrites manual
 * fields, removes a previously planned module or writes real CRM records. */
export function previewCrmGuidedSetup(
 blueprint:CrmFieldBlueprint,modules:CrmModulePlans,profile:CrmGuidedSetupDraft,
):CrmGuidedSetupPlan{
 const errors=validateCrmGuidedSetup(profile);
 if(errors.length)throw new Error(errors.join(' '));
 const packPreview=profile.template==='blank'?null:previewCrmStarterPack(blueprint,profile.template);
 if(packPreview?.blockedReason)throw new Error(packPreview.blockedReason);
 const nextBlueprint=profile.template==='blank'?blueprint:applyCrmStarterPack(blueprint,profile.template);
 const nextModules={...modules};
 let modulePlansToAdd=0;
 for(const id of moduleIds){
  if(profile.modules[id]){
   if(!modules[id])modulePlansToAdd++;
   nextModules[id]=true;
  }
 }
 return {
  nextBlueprint,nextModules,savedProfile:profile,packPreview,
  fieldsToAdd:packPreview?.additions??0,
  existingFields:packPreview?.present??0,
  conflictingFields:packPreview?.incompatible??0,
  modulePlansToAdd,
 };
}
export interface CrmSetupStorage{
 getItem:(key:string)=>string|null;
 setItem:(key:string,value:string)=>void;
 removeItem:(key:string)=>void;
}
/** Best-effort rollback across the three existing browser keys. No cloud writes.
 * The caller updates React state only after browser persistence succeeds. */
export function saveCrmGuidedSetup(
 storage:CrmSetupStorage,scope:string,plan:CrmGuidedSetupPlan,
):void{
 const pairs:[
  string,string
 ][]=[
  [scope,JSON.stringify(plan.nextBlueprint)],
  [crmModulePlansStorageKey(scope),JSON.stringify(plan.nextModules)],
  [crmGuidedSetupStorageKey(scope),JSON.stringify(plan.savedProfile)],
 ];
 const prior=pairs.map(([key])=>storage.getItem(key));
 try{
  pairs.forEach(([key,value])=>storage.setItem(key,value));
 }catch{
  for(let i=pairs.length-1;i>=0;i--){
   const old=prior[i];
   try{if(old===null)storage.removeItem(pairs[i][0]);
    else storage.setItem(pairs[i][0],old);}catch{/* Browser storage may be unavailable. */}
  }
  throw new Error('Could not save the CRM draft in this browser. Check storage permissions and try again.');
 }
}
