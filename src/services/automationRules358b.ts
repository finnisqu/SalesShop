import {scopedStorageKey} from '../lib/developerPlayground';
import {PROJECT_STAGES,type ProjectStage,type Activity,type Project} from '../types/crm';
import type {SalesQuoteRecord} from './salesQuoteRegistry';
import type {PersonalTask,TaskAssociation,TaskChanges} from '../store/personalTaskStore';
import {sanitizeCustomWorkflows,isCustomWorkflowId,
 type CustomStageWorkflow} from './automationCustomWorkflows384';

export type AutomationRuleId='quote-delivered'|'deal-inactive'|'deal-won'|'deal-stage-task';
export const AUTOMATION_IDS=['quote-delivered','deal-inactive','deal-won','deal-stage-task'] as const;
export const AUTOMATION_STAGE_CHOICES:readonly ProjectStage[]=PROJECT_STAGES;
export const DEFAULT_STAGE_TASK_LABEL='Review next steps';
export const normalizeStageTaskLabel=(label:unknown):string=>
 typeof label==='string'&&label.trim().length>=2&&label.trim().length<=70&&
 !/[\u0000-\u001f<>]/.test(label)
 ?label.trim():DEFAULT_STAGE_TASK_LABEL;
export const normalizeAutomationStage=(stage:unknown):ProjectStage=>
 AUTOMATION_STAGE_CHOICES.find(s=>s===stage)??'Bid Sent';
export interface AutomationRuleOptions{enabled:boolean;days:number;stage?:ProjectStage;taskLabel?:string}
export type AutomationRules=Record<AutomationRuleId,AutomationRuleOptions>;
export interface AutomationHistoryItem{
 id:string;rule:AutomationRuleId;sourceObjectId:string;taskId:string;
 title:string;at:string;customRuleId?:string;
}
export interface AutomationSettings {
 rules:AutomationRules;customRules:CustomStageWorkflow[];
 autoRunWhileOpen:boolean;history:AutomationHistoryItem[];
}
export interface AutomationCandidate{
 rule:AutomationRuleId;sourceObjectId:string;title:string;customRuleId?:string;
 context:string;changes:TaskChanges;
}
export const DEFAULT_AUTOMATION_SETTINGS:AutomationSettings={
 rules:{
  'quote-delivered':{enabled:false,days:3},
  'deal-inactive':{enabled:false,days:14},
  'deal-won':{enabled:false,days:1},
  'deal-stage-task':{enabled:false,days:1,stage:'Bid Sent',taskLabel:DEFAULT_STAGE_TASK_LABEL},
 },
 customRules:[],autoRunWhileOpen:false,history:[],
};
export const automationKey=(scope:string)=>scopedStorageKey('salesshop-automation-rules-v1:'+scope);
export function sanitizeAutomationSettings(source:unknown):AutomationSettings{
 const raw=source&&typeof source==='object'?source as Record<string,unknown>:{};
 const saved=raw.rules&&typeof raw.rules==='object'?raw.rules as Record<string,unknown>:{};
 const rules=Object.fromEntries(AUTOMATION_IDS.map(id=>{
  const item=saved[id]&&typeof saved[id]==='object'?saved[id] as Record<string,unknown>:{};
  const base={enabled:item.enabled===true,
   days:typeof item.days==='number'&&Number.isInteger(item.days)
      ?Math.max(1,Math.min(60,item.days)):DEFAULT_AUTOMATION_SETTINGS.rules[id].days};
  return [id,id==='deal-stage-task'?{
   ...base,stage:normalizeAutomationStage(item.stage),
   taskLabel:normalizeStageTaskLabel(item.taskLabel),
  }:base];
 })) as AutomationRules;
 const history=Array.isArray(raw.history)?raw.history.filter((row:unknown)=>{
  if(!row||typeof row!=='object')return false;
  const value=row as Record<string,unknown>;
  return typeof value.id==='string'&&typeof value.taskId==='string'&&
   typeof value.sourceObjectId==='string'&&typeof value.title==='string'&&
   typeof value.at==='string'&&AUTOMATION_IDS.some(id=>id===value.rule);
 }).slice(0,150).map((row:AutomationHistoryItem)=>({
  id:row.id,rule:row.rule,sourceObjectId:row.sourceObjectId,
  taskId:row.taskId,title:row.title,at:row.at,
  ...(isCustomWorkflowId(row.customRuleId)?{customRuleId:row.customRuleId}:{}),
 })):[] as AutomationHistoryItem[];
 return {rules,customRules:sanitizeCustomWorkflows(raw.customRules),
  autoRunWhileOpen:raw.autoRunWhileOpen===true,history};
}
export function readAutomationSettings(scope:string):AutomationSettings{
 try{return sanitizeAutomationSettings(JSON.parse(localStorage.getItem(automationKey(scope))??'{}'));}
 catch{return sanitizeAutomationSettings(null);}
}
export function saveAutomationSettings(scope:string,settings:AutomationSettings):void{
 localStorage.setItem(automationKey(scope),JSON.stringify(settings));
}
export function localDay(date:Date):string{
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),
  String(date.getDate()).padStart(2,'0')].join('-');
}
function parseDay(raw:string|undefined):Date|null{
 if(!raw)return null;
 const day=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:localDay(new Date(raw));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
 const d=new Date(day+'T12:00:00');
 return Number.isFinite(d.getTime())&&localDay(d)===day?d:null;
}
export function addCalendarDays(day:string,days:number):string|null{
 const d=parseDay(day);
 if(!d)return null;
 d.setDate(d.getDate()+days);
 return localDay(d);
}
function ageDays(day:string,now:Date):number{
 const d=parseDay(day);
 if(!d)return Infinity;
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
 return Math.floor((today.getTime()-d.getTime())/86400000+.05);
}
const isCustomerInteraction=(event:Activity)=>Boolean(event.metadata?.interactionMethod)||
 ['quote-sent','quote-follow-up','quote-viewed'].includes(event.type);
const openStages=new Set<Project['stage']>([
 'Discovery','Intent to Bid','Bid Development','Bid Sent','Negotiation',
]);
const dealAssociation=(deal:Project):TaskAssociation=>({
 type:'project',id:deal.id,label:'Deal · '+deal.name,
});
/** Pure event-to-Task proposals. Existing tasks (including canceled and
 * tombstoned tasks) suppress replay. Nothing is persisted or sent here. */
export function automationCandidates(input:{
 deals:readonly Project[];quotes:readonly SalesQuoteRecord[];
 activities:readonly Activity[];tasks:readonly PersonalTask[];
 rules:AutomationRules;customRules?:readonly CustomStageWorkflow[];
 now:Date;userId?:string;mode:'local'|'cloud';
}):AutomationCandidate[]{
 const {deals,quotes,activities,tasks,rules,now,userId,mode,customRules}=input;
 const today=localDay(now);
 const taskKeys=new Set(tasks.map(task=>task.sourceObjectId).filter(Boolean));
 const candidates:AutomationCandidate[]=[];
 const ownDeal=(deal:Project)=>mode==='local'||!!userId&&deal.assignedUserId===userId;
 const ownQuote=(quote:SalesQuoteRecord,deal?:Project)=>
  mode==='local'||!!userId&&(quote.ownerUserId===userId||
   (quote.source==='external'&&deal?.assignedUserId===userId));
 const dealsById=new Map(deals.map(deal=>[deal.id,deal]));
 const include=(candidate:AutomationCandidate)=>{
  if(taskKeys.has(candidate.sourceObjectId)||candidates.some(row=>row.sourceObjectId===candidate.sourceObjectId))return;
  candidates.push(candidate);
 };
 if(rules['quote-delivered'].enabled)for(const quote of quotes){
  if(quote.archived||quote.documentType==='Change order'||!quote.sentDate)continue;
  const deal=quote.projectId?dealsById.get(quote.projectId):undefined;
  if(!ownQuote(quote,deal))continue;
  const age=ageDays(quote.sentDate,now);
  if(age<0||age>30)continue; // No surprise backfill of months of old bids.
  const dueDate=addCalendarDays(quote.sentDate,rules['quote-delivered'].days);
  if(!dueDate)continue;
  const key='automation:quote-delivered:'+quote.id+':'+quote.sentDate;
  include({rule:'quote-delivered',sourceObjectId:key,
   title:'Follow up on quote · '+quote.name,
   context:'Confirmed delivery '+quote.sentDate+' · '+(quote.source==='external'?'External':'SalesShop'),
   changes:{type:'follow-up',dueDate,sourceObjectId:key,
    associations:[
     ...(deal?[dealAssociation(deal)]:[]),
     ...(quote.source==='salesshop'?[{type:'quote' as const,id:quote.sourceId,label:'Quote · '+quote.name}]:[]),
    ],
    notes:'Automated personal follow-up after confirmed quote delivery on '+quote.sentDate+
     '. This Task does not send a customer message or confirm a second delivery.'}});
 }
 if(rules['deal-inactive'].enabled)for(const deal of deals){
  if(!ownDeal(deal)||!openStages.has(deal.stage))continue;
  const latest=activities.filter(a=>a.projectId===deal.id&&isCustomerInteraction(a))
   .map(a=>a.occurredAt).sort().at(-1);
  const last=latest??deal.createdAt;
  const age=ageDays(last,now);
  if(!Number.isFinite(age)||age<rules['deal-inactive'].days||age>365)continue;
  const stamp=parseDay(last);
  if(!stamp)continue;
  const lastDay=localDay(stamp);
  const key='automation:deal-inactive:'+deal.id+':'+lastDay;
  include({rule:'deal-inactive',sourceObjectId:key,
   title:'Reconnect with '+deal.name,
   context:'No recorded customer interaction for '+age+' days',
   changes:{type:'follow-up',priority:'high',dueDate:today,
    sourceObjectId:key,associations:[dealAssociation(deal)],
    notes:'SalesShop detected no logged customer contact since '+lastDay+
     '. Check this Deal before contacting anyone. No message has been sent.'}});
 }
 // A configurable, evidence-based stage event creates a private Task.
 // Unlike a generic stage snapshot, this needs an actual recorded transition,
 // so importing an old Deal never creates an unsolicited Task.
 const stageRule=rules['deal-stage-task'];
 if(stageRule.enabled){
  const selectedStage=normalizeAutomationStage(stageRule.stage);
  const label=normalizeStageTaskLabel(stageRule.taskLabel);
  for(const deal of deals){
   if(!ownDeal(deal)||deal.stage!==selectedStage)continue;
   const events=activities.filter(a=>a.projectId===deal.id&&
    a.type==='project-stage-changed'&&a.metadata?.toStage===selectedStage)
    .sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));
   const event=events[0];
   if(!event)continue;
   const age=ageDays(event.occurredAt,now);
   if(!Number.isFinite(age)||age<0||age>14)continue;
   const stageDay=parseDay(event.occurredAt);
   if(!stageDay)continue;
   const dueDate=addCalendarDays(localDay(stageDay),stageRule.days);
   if(!dueDate)continue;
   const key='automation:deal-stage-task:'+deal.id+':'+event.id+':'+selectedStage;
   include({rule:'deal-stage-task',sourceObjectId:key,
    title:label+' · '+deal.name,
    context:'Confirmed stage change → '+selectedStage+' · '+localDay(stageDay),
    changes:{type:'todo',priority:'normal',dueDate,sourceObjectId:key,
     associations:[dealAssociation(deal)],
     notes:'Personal Task prompted by a recorded move to '+selectedStage+
      ' on '+localDay(stageDay)+'. No customer messages or other changes were made.'}});
  }
 }
 // Every custom workflow has its own durable identity. Multiple templates
 // may match one stage event, but each can generate at most one Task.
 for(const workflow of sanitizeCustomWorkflows(customRules)){
  if(!workflow.enabled)continue;
  for(const deal of deals){
   if(!ownDeal(deal)||deal.stage!==workflow.stage)continue;
   const latest=activities.filter(event=>event.projectId===deal.id&&
    event.type==='project-stage-changed')
    .sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt))[0];
   // Only the actual latest stage transition can trigger a workflow.
   if(!latest||latest.metadata?.toStage!==workflow.stage)continue;
   const age=ageDays(latest.occurredAt,now);
   if(!Number.isFinite(age)||age<0||age>14)continue;
   const when=parseDay(latest.occurredAt);
   if(!when)continue;
   const stageDay=localDay(when);
   const dueDate=addCalendarDays(stageDay,workflow.days);
   if(!dueDate)continue;
   const key='automation:custom-stage-task:'+workflow.id+':'+deal.id+':'+latest.id+':'+workflow.stage;
   include({rule:'deal-stage-task',customRuleId:workflow.id,sourceObjectId:key,
    title:workflow.taskLabel+' · '+deal.name,
    context:workflow.name+' · '+workflow.stage+' on '+stageDay,
    changes:{type:'todo',priority:workflow.priority,dueDate,sourceObjectId:key,
     associations:[dealAssociation(deal)],
     notes:'Personal Task from '+workflow.name+' after confirmed stage change to '+
      workflow.stage+' on '+stageDay+'. No customer messages or Deal updates were made.'}});
  }
 }
 if(rules['deal-won'].enabled)for(const deal of deals){
  if(!ownDeal(deal)||deal.stage!=='Closed Won')continue;
  const events=activities.filter(a=>a.projectId===deal.id&&
   a.type==='project-stage-changed'&&a.metadata?.toStage==='Closed Won')
   .sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));
  const event=events[0];
  if(!event||ageDays(event.occurredAt,now)<0||ageDays(event.occurredAt,now)>60)continue;
  const key='automation:deal-won:'+deal.id+':'+event.id;
  include({rule:'deal-won',sourceObjectId:key,title:'Handoff · '+deal.name,
   context:'Confirmed Closed Won stage change',
   changes:{type:'todo',priority:'high',dueDate:addCalendarDays(today,rules['deal-won'].days)??today,
    sourceObjectId:key,associations:[dealAssociation(deal)],
    notes:'Internal handoff checklist from a Won Deal. Does not create invoices or notify external systems.',
    subtasks:[
     {id:key+':contract',title:'Confirm contract and scope',completed:false},
     {id:key+':operations',title:'Coordinate operations handoff',completed:false},
     {id:key+':schedule',title:'Review schedule and delivery milestones',completed:false},
     {id:key+':accounting',title:'Prepare accounting handoff',completed:false},
    ]}});
 }
 return candidates.sort((a,b)=>a.rule.localeCompare(b.rule)||a.sourceObjectId.localeCompare(b.sourceObjectId));
}
