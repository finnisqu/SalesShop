/** Batch 353a — portable fictional demo datasets for the local Developer Playground.
 * NOT a cloud CRM importer. This parser never reads or writes any tenant data. */
import {ACTIVITY_TYPES,PROJECT_STAGES,DEAL_PIPELINES,type CrmDocument,
 type Company,type Contact,type Project,type Activity,type ActivityType,
 type ProjectStage,type DealPipeline} from '../types/crm';
import {type QuoteDocument,type Quote,type QuoteLine} from '../types/quote';
import type {PersonalTask,TaskPriority} from '../store/personalTaskStore';
import {seedPlaygroundCrm,seedPlaygroundQuotes} from './playgroundFixtures';

export const DEMO_RECORDS_FORMAT='salesshop.playground.records' as const;
export const DEMO_RECORDS_VERSION=1 as const;
export const DEMO_RECORDS_MAX_BYTES=250_000;

type CompanySpec={id:string;name:string;kind?:'customer'|'non-customer';annualUnits?:number;averageUnitValue?:number;expectedSharePct?:number};
type PersonSpec={id:string;companyId?:string;name:string;email?:string;phone?:string;title?:string};
type DealSpec={id:string;companyId?:string;name:string;stage?:ProjectStage;pipeline?:DealPipeline;amount?:number;nextAction?:string;dueDate?:string};
type ActivitySpec={id:string;type?:ActivityType;summary:string;companyId?:string;personId?:string;dealId?:string;occurredAt?:string};
type QuoteLineSpec={id:string;description:string;quantity?:number;rate?:number};
type QuoteSpec={id:string;number:string;title:string;status?:'Draft'|'Ready'|'Sent';companyId?:string;dealId?:string;contactName?:string;contactEmail?:string;lines:QuoteLineSpec[]};
type TaskSpec={id:string;title:string;dealId?:string;dueDate?:string;priority?:TaskPriority;notes?:string};
export interface DemoRecordsBundle{
 format:typeof DEMO_RECORDS_FORMAT;version:typeof DEMO_RECORDS_VERSION;
 companies:CompanySpec[];people:PersonSpec[];deals:DealSpec[];
 activities:ActivitySpec[];quotes:QuoteSpec[];tasks:TaskSpec[];
}
export interface DemoMaterialized{
 crm:CrmDocument;quotes:QuoteDocument;tasks:PersonalTask[];
 counts:{companies:number;people:number;deals:number;activities:number;quotes:number;tasks:number};
}
const isObject=(value:unknown):value is Record<string,unknown>=>
 value!==null&&typeof value==='object'&&!Array.isArray(value);
function assert(condition:unknown,message:string):asserts condition{
 if(!condition)throw new Error(message);
}
function keys(item:Record<string,unknown>,names:readonly string[],label:string){
 assert(Object.keys(item).every(key=>names.includes(key)),label+' has unknown properties.');
}
function requiredText(value:unknown,label:string,max=140):string{
 assert(typeof value==='string'&&value.trim()===value&&
  value.length>0&&value.length<=max,label+' must be text (1–'+max+' chars).');
 return value;
}
function optionalText(value:unknown,label:string,max=200):string|undefined{
 return value===undefined?undefined:requiredText(value,label,max);
}
function id(value:unknown,label:string):string{
 const text=requiredText(value,label,100);
 assert(/^demo_[a-zA-Z0-9_-]+$/.test(text),label+' must start with demo_.');
 return text;
}
function numberValue(value:unknown,label:string,max=10_000_000_000):number|undefined{
 if(value===undefined)return undefined;
 assert(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max,
  label+' must be a finite nonnegative number.');
 return value;
}
function dateValue(value:unknown,label:string):string|undefined{
 if(value===undefined)return undefined;
 assert(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
  !Number.isNaN(Date.parse(value+'T00:00:00Z'))&&
  new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value,
  label+' must be a valid YYYY-MM-DD date.');
 return value;
}
function timestampValue(value:unknown,label:string):string|undefined{
 if(value===undefined)return undefined;
 assert(typeof value==='string'&&value.length<=35&&
  /^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value)),
  label+' must be an ISO timestamp.');
 return value;
}
const rootKeys=['format','version','companies','people','deals','activities','quotes','tasks'];
const companyKeys=['id','name','kind','annualUnits','averageUnitValue','expectedSharePct'];
const personKeys=['id','companyId','name','email','phone','title'];
const dealKeys=['id','companyId','name','stage','pipeline','amount','nextAction','dueDate'];
const activityKeys=['id','type','summary','companyId','personId','dealId','occurredAt'];
const quoteKeys=['id','number','title','status','companyId','dealId','contactName','contactEmail','lines'];
const quoteLineKeys=['id','description','quantity','rate'];
const taskKeys=['id','title','dealId','dueDate','priority','notes'];
function collection(parent:Record<string,unknown>,key:string,max:number):Record<string,unknown>[]{
 const val=parent[key];
 assert(Array.isArray(val)&&val.length<=max&&val.every(isObject),
  key+' must be a list of at most '+max+' records.');
 return val as Record<string,unknown>[];
}
function verifyRef(value:unknown,records:Set<string>,label:string):string|undefined{
 if(value===undefined)return undefined;
 const ref=id(value,label);
 assert(records.has(ref),label+' must reference a record in this file.');
 return ref;
}
function email(value:unknown,label:string){
 const v=optionalText(value,label,160);
 assert(!v||/^[^\s@]+@[^\s@]+\.example$/i.test(v),
  label+' must use fictional .example email addresses.');
 return v;
}
function getId(row:Record<string,unknown>,label:string,seen:Set<string>){
 const val=id(row.id,label+' ID');
 assert(!seen.has(val),'Duplicate demo record ID: '+val);
 seen.add(val);
 return val;
}
function checkDateTask(t:Record<string,unknown>,label:string){
 return dateValue(t.dueDate,label+' due date');
}
export function parseDemoRecordsBundle(json:string,now=new Date().toISOString()):DemoMaterialized{
 assert(json.length<=DEMO_RECORDS_MAX_BYTES,'Demo file exceeds 250,000 characters.');
 let data:unknown;
 try{data=JSON.parse(json);}catch{throw new Error('The import file is not valid JSON.');}
 assert(isObject(data),'Demo file must contain an object.');
 keys(data,rootKeys,'Demo file');
 assert(data.format===DEMO_RECORDS_FORMAT&&data.version===DEMO_RECORDS_VERSION,
  'Unsupported demo file format or version.');
 const companiesIn=collection(data,'companies',200);
 const peopleIn=collection(data,'people',300);
 const dealsIn=collection(data,'deals',300);
 const activitiesIn=collection(data,'activities',400);
 const quotesIn=collection(data,'quotes',100);
 const tasksIn=collection(data,'tasks',300);
 const seen=new Set<string>();
 const companies:Company[]=companiesIn.map((r,index)=>{
  const label='Company '+(index+1);keys(r,companyKeys,label);
  const companyKind=r.kind??'customer';
  assert(companyKind==='customer'||companyKind==='non-customer',label+' has invalid kind.');
  const share=numberValue(r.expectedSharePct,label+' expected share',100);
  return {
   id:getId(r,label,seen),name:requiredText(r.name,label+' name'),
   kind:companyKind,annualUnits:numberValue(r.annualUnits,label+' annual units'),
   averageUnitValue:numberValue(r.averageUnitValue,label+' average unit value'),
   expectedSharePct:share,createdAt:now,updatedAt:now,
  };
 });
 const companyIds=new Set(companies.map(c=>c.id));
 const people:Contact[]=peopleIn.map((r,index)=>{
  const label='Person '+(index+1);keys(r,personKeys,label);
  return {id:getId(r,label,seen),name:requiredText(r.name,label+' name'),
   companyId:verifyRef(r.companyId,companyIds,label+' Company'),
   email:email(r.email,label+' email'),phone:optionalText(r.phone,label+' phone',60),
   title:optionalText(r.title,label+' title'),createdAt:now,updatedAt:now};
 });
 const peopleIds=new Set(people.map(p=>p.id));
 const deals:Project[]=dealsIn.map((r,index)=>{
  const label='Deal '+(index+1);keys(r,dealKeys,label);
  const stage=r.stage??'Discovery';
  assert(typeof stage==='string'&&(PROJECT_STAGES as readonly string[]).includes(stage),
   label+' has invalid stage.');
  assert(r.pipeline===undefined||DEAL_PIPELINES.some(p=>p.id===r.pipeline),
   label+' has invalid pipeline.');
  const companyId=verifyRef(r.companyId,companyIds,label+' Company');
  return {id:getId(r,label,seen),name:requiredText(r.name,label+' name'),
   companyId,companyName:companies.find(c=>c.id===companyId)?.name,
   stage:stage as ProjectStage,pipeline:r.pipeline as DealPipeline|undefined,
   amount:numberValue(r.amount,label+' amount'),dueDate:dateValue(r.dueDate,label+' due date'),
   nextAction:optionalText(r.nextAction,label+' next action',240),
   stageChangedAt:now,createdAt:now,updatedAt:now};
 });
 const dealIds=new Set(deals.map(d=>d.id));
 const quotes:Quote[]=quotesIn.map((r,index)=>{
  const label='Quote '+(index+1);keys(r,quoteKeys,label);
  const quoteId=getId(r,label,seen);
  const number=requiredText(r.number,label+' number',30);
  assert(/^DEMO-[A-Z0-9-]+$/.test(number),label+' number must begin with DEMO-.');
  const status=r.status??'Draft';
  assert(status==='Draft'||status==='Ready'||status==='Sent',
   label+' supports Draft, Ready or Sent only.');
  const companyId=verifyRef(r.companyId,companyIds,label+' Company');
  const dealId=verifyRef(r.dealId,dealIds,label+' Deal');
  if(companyId&&dealId){
   assert(deals.find(d=>d.id===dealId)?.companyId===companyId,
    label+' Deal must belong to its selected Company.');
  }
  const rawLines=r.lines;
  assert(Array.isArray(rawLines)&&rawLines.length<=60&&rawLines.every(isObject),
   label+' needs a list of at most 60 price lines.');
  const lineIds=new Set<string>();
  const lines:QuoteLine[]=(rawLines as Record<string,unknown>[]).map((line,i)=>{
   const title=label+' line '+(i+1);keys(line,quoteLineKeys,title);
   const lineId=id(line.id,title+' ID');
   assert(!lineIds.has(lineId),title+' has a duplicate line ID.');
   lineIds.add(lineId);
   const quantity=numberValue(line.quantity,title+' quantity',1_000_000)??1;
   const rate=numberValue(line.rate,title+' rate')??0;
   return {id:lineId,kind:'item',description:requiredText(line.description,title+' description',300),
    pricingMode:'quantity-rate',quantity,rate,customerVisible:true,includeInTotal:true};
  });
  const today=now.slice(0,10);
  return {id:quoteId,quoteNumber:number,title:requiredText(r.title,label+' title',240),
   documentType:'quote',originalQuoteDate:today,quoteDate:today,
   revision:0,status,companyId,companyName:companies.find(c=>c.id===companyId)?.name,
   projectId:dealId,contactName:optionalText(r.contactName,label+' contact name'),
   contactEmail:email(r.contactEmail,label+' contact email'),
   sections:[],lines,customerColumns:{quantity:true,rate:true,lineAmount:true},
   customerNotes:'DEMO ONLY — fictional data, not a real proposal.',
   internalNotes:'Imported in local Developer Playground; never sent to cloud.',
   history:[],createdAt:now,updatedAt:now};
 });
 const quoteNumbers=new Set<string>();
 for(const quote of quotes){
  assert(!quoteNumbers.has(quote.quoteNumber),'Duplicate demo Quote number.');
  quoteNumbers.add(quote.quoteNumber);
 }
 const activities:Activity[]=activitiesIn.map((r,index)=>{
  const label='Activity '+(index+1);keys(r,activityKeys,label);
  const type=r.type??'manual-touchpoint';
  assert(typeof type==='string'&&(ACTIVITY_TYPES as readonly string[]).includes(type),
   label+' has invalid type.');
  // Do not fabricate delivery or signed quotes via activity metadata.
  assert(['manual-touchpoint','contact-created','project-created','project-stage-changed']
   .includes(type),label+' has a restricted activity type.');
  return {id:getId(r,label,seen),type:type as ActivityType,
   summary:requiredText(r.summary,label+' summary',500),
   companyId:verifyRef(r.companyId,companyIds,label+' Company'),
   contactId:verifyRef(r.personId,peopleIds,label+' Person'),
   projectId:verifyRef(r.dealId,dealIds,label+' Deal'),
   occurredAt:timestampValue(r.occurredAt,label+' timestamp')??now,
   metadata:{source:'manual'}};
 });
 const scope='local:user';
 const priorities=['low','normal','high','urgent'];
 const tasks:PersonalTask[]=tasksIn.map((r,index)=>{
  const label='Task '+(index+1);keys(r,taskKeys,label);
  const priority=r.priority??'normal';
  assert(typeof priority==='string'&&priorities.includes(priority),
   label+' has invalid priority.');
  const dealId=verifyRef(r.dealId,dealIds,label+' Deal');
  return {id:getId(r,label,seen),title:requiredText(r.title,label+' title',240),
   dueDate:checkDateTask(r,label),priority:priority as TaskPriority,
   notes:optionalText(r.notes,label+' notes',1000),
   linked:dealId?{type:'project',id:dealId}:undefined,
   associations:dealId?[{type:'project',id:dealId}]:[],
   type:'todo',status:'open',workspaceScope:scope,
   createdAt:now,updatedAt:now};
 });
 assert(companies.length+people.length+deals.length+activities.length+quotes.length+tasks.length>0,
  'The demo file contains no records.');
 return {crm:{schemaVersion:3,companies,contacts:people,projects:deals,activities},
  quotes:{schemaVersion:2,quotes,activeQuoteId:quotes[0]?.id??null},
  tasks,counts:{companies:companies.length,people:people.length,deals:deals.length,
   activities:activities.length,quotes:quotes.length,tasks:tasks.length}};
}

/** The downloadable fixture matches the same portable narrow schema.
 * Only fictional data is included; it can be edited in any text editor. */
export function sampleDemoRecordsBundle():DemoRecordsBundle{
 const source=seedPlaygroundCrm(),quoted=seedPlaygroundQuotes();
 return {
  format:DEMO_RECORDS_FORMAT,version:DEMO_RECORDS_VERSION,
  companies:source.companies.map(c=>({
   id:c.id,name:c.name,kind:c.kind,annualUnits:c.annualUnits,
   averageUnitValue:c.averageUnitValue,expectedSharePct:c.expectedSharePct})),
  people:source.contacts.map(p=>({
   id:p.id,name:p.name,companyId:p.companyId,email:p.email,
   phone:p.phone,title:p.title})),
  deals:source.projects.map(d=>({
   id:d.id,name:d.name,companyId:d.companyId,stage:d.stage,pipeline:d.pipeline,
   amount:d.amount,nextAction:d.nextAction,dueDate:d.dueDate})),
  activities:source.activities.map(a=>({
   id:a.id,type:a.type,summary:a.summary,companyId:a.companyId,
   personId:a.contactId,dealId:a.projectId})),
  quotes:quoted.quotes.map(q=>({
   id:q.id,number:q.quoteNumber,title:q.title,status:
    q.status==='Draft'||q.status==='Ready'||q.status==='Sent'?q.status:'Draft',
   companyId:q.companyId,dealId:q.projectId,
   contactName:q.contactName,contactEmail:q.contactEmail,
   lines:q.lines.filter(line=>line.kind!=='note').map(line=>({
    id:line.id,description:line.description,quantity:line.quantity,rate:line.rate})),
  })),
  tasks:[
   {id:'demo_task_follow_up',title:'Follow up on sample apartment bid',
    dealId:'demo_project_1',priority:'high'},
   {id:'demo_task_review',title:'Review fictional pricing notes',
    dealId:'demo_project_2',priority:'normal'},
   {id:'demo_task_call',title:'Schedule sample buyer call',
    dealId:'demo_project_3',priority:'normal'},
  ],
 };
}
export function sampleDemoRecordsJson():string{
 return JSON.stringify(sampleDemoRecordsBundle(),null,2);
}
