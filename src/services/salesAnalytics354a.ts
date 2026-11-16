import type {Activity,Project,ProjectStage} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import type {SalesQuoteRecord} from './salesQuoteRegistry';
import {OPEN_PIPELINE_STAGES} from './dashboardMetrics';
import type {DealPipeline} from '../types/crm';

/** Read-only, in-memory rollup of the same accessible records used by Records.
 * Neither an issued native document nor a copied link proves delivery:
 * sentDate is provided only by confirmed native delivery or external bid facts.
 */
export type AnalyticsPeriod='30d'|'90d'|'365d'|'all';
export interface AnalyticsFilters {
 period:AnalyticsPeriod;
 ownerId:string; // 'all' or an actual organization user ID
 pipeline:'all'|DealPipeline;
}
export interface AnalyticsStage {stage:ProjectStage;count:number;value:number}
export interface AnalyticsTrend {key:string;label:string;sent:number;interactions:number}
export interface SalesAnalyticsSnapshot {
 since:string|null;through:string;
 dealsCreated:number;openDeals:number;openValue:number;
 wonDeals:number;wonValue:number;lostDeals:number;winRate:number|null;
 sentQuotes:number;nativeSent:number;externalSent:number;
 sentValue:number;missingQuoteValues:number;
 interactions:number;privateOverdueTasks:number;
 pipelineByStage:AnalyticsStage[];
 trend:AnalyticsTrend[];trendLabel:string;
 topDeals:Project[];recentSent:SalesQuoteRecord[];
}
const pad=(n:number)=>String(n).padStart(2,'0');
export function analyticsLocalDay(date:Date):string {
 return [date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join('-');
}
function parseDay(value:string|undefined):string|null {
 if(!value)return null;
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 const date=new Date(value);
 return Number.isFinite(date.getTime())?analyticsLocalDay(date):null;
}
export function analyticsWindowStart(period:AnalyticsPeriod,now:Date):string|null {
 if(period==='all')return null;
 const days=period==='30d'?30:period==='90d'?90:365;
 const first=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 first.setDate(first.getDate()-days+1);
 return analyticsLocalDay(first);
}
function onOrAfter(value:string|undefined,start:string|null,through:string):boolean {
 const day=parseDay(value);
 return day!==null&&day<=through&&(start===null||day>=start);
}
function monthKey(day:string){return day.slice(0,7);}
function weekKey(day:string):string {
 const date=new Date(day+'T12:00:00');
 // Monday is the start of each reporting week; local noon avoids DST drift.
 date.setDate(date.getDate()-(date.getDay()+6)%7);
 return analyticsLocalDay(date);
}
function periodBuckets(period:AnalyticsPeriod,now:Date):AnalyticsTrend[]{
 if(period==='30d'||period==='90d'){
  // Generate every Monday from the window's first week through this week.
  // A hard-coded 5/13-week list silently omits early days in some 30/90-day windows.
  const first=analyticsWindowStart(period,now)!;
  const start=new Date(weekKey(first)+'T12:00:00');
  const last=new Date(weekKey(analyticsLocalDay(now))+'T12:00:00');
  const rows:AnalyticsTrend[]=[];
  for(const date=new Date(start);date<=last;date.setDate(date.getDate()+7)){
   rows.push({key:analyticsLocalDay(date),
    label:date.toLocaleDateString(undefined,{month:'short',day:'numeric'}),
    sent:0,interactions:0});
  }
  return rows;
 }
 return Array.from({length:12},(_,i)=>{
  const d=new Date(now.getFullYear(),now.getMonth()-11+i,1,12);
  return {key:analyticsLocalDay(d).slice(0,7),label:d.toLocaleDateString(undefined,{month:'short',year:'2-digit'}),sent:0,interactions:0};
 });
}
const isInteraction=(event:Activity)=>Boolean(event.metadata?.interactionMethod)||
 event.type==='manual-touchpoint'||event.type==='notebook-touchpoint';

export function buildSalesAnalytics(
 deals:readonly Project[],records:readonly SalesQuoteRecord[],activities:readonly Activity[],
 personalTasks:readonly PersonalTask[],filters:AnalyticsFilters,now=new Date()
):SalesAnalyticsSnapshot {
 const since=analyticsWindowStart(filters.period,now),through=analyticsLocalDay(now);
 const allDealsById=new Map(deals.map(deal=>[deal.id,deal]));
 const matchesOwner=(ownerId?:string)=>filters.ownerId==='all'||ownerId===filters.ownerId;
 const matchPipeline=(deal:Project)=>filters.pipeline==='all'||deal.pipeline===filters.pipeline;
 const eligibleDeals=deals.filter(deal=>matchesOwner(deal.assignedUserId)&&matchPipeline(deal));
 // Date range is a Deal creation cohort, not a fabricated historical pipeline snapshot.
 const cohort=eligibleDeals.filter(deal=>onOrAfter(deal.createdAt,since,through));
 const pipelineByStage=OPEN_PIPELINE_STAGES.map(stage=>{
  const active=cohort.filter(deal=>deal.stage===stage);
  return {stage,count:active.length,value:active.reduce((sum,deal)=>sum+(Number.isFinite(deal.amount)?deal.amount??0:0),0)};
 });
 const openDeals=pipelineByStage.reduce((sum,row)=>sum+row.count,0);
 const openValue=pipelineByStage.reduce((sum,row)=>sum+row.value,0);
 const won=cohort.filter(deal=>deal.stage==='Closed Won'||deal.stage==='Completed');
 const lost=cohort.filter(deal=>deal.stage==='Closed Lost');
 const matchedQuotes=records.filter(record=>{
  const related=record.projectId?allDealsById.get(record.projectId):undefined;
  const ownerMatches=filters.ownerId==='all'||record.ownerUserId===filters.ownerId||
   (record.source==='external'&&related?.assignedUserId===filters.ownerId);
  if(!ownerMatches)return false;
  if(filters.pipeline!=='all'&&related?.pipeline!==filters.pipeline)return false;
  return record.documentType!=='Change order'&&!record.archived;
 });
 // Defensive rehydration dedupe: one external submission ID or native document,
 // not one row for each cached copy of the same record.
 const unique=new Map<string,SalesQuoteRecord>();
 for(const item of matchedQuotes){
  const previous=unique.get(item.id);
  if(!previous||item.updatedAt>previous.updatedAt)unique.set(item.id,item);
 }
 const sent=[...unique.values()].filter(record=>
   record.sentDate!==undefined&&onOrAfter(record.sentDate,since,through));
 const interactionEvents=activities.filter(activity=>
  isInteraction(activity)&&matchesOwner(activity.metadata?.recordedByUserId)&&
  onOrAfter(activity.occurredAt,since,through)&&
  (filters.pipeline==='all'||Boolean(activity.projectId&&
    allDealsById.get(activity.projectId)?.pipeline===filters.pipeline)));
 const trend=periodBuckets(filters.period,now);
 const byBucket=new Map(trend.map(row=>[row.key,row]));
 const keyFor=(day:string)=>filters.period==='30d'||filters.period==='90d'
  ?weekKey(day):monthKey(day);
 sent.forEach(record=>{
  const key=parseDay(record.sentDate);
  if(key){const row=byBucket.get(keyFor(key));if(row)row.sent++;}
 });
 interactionEvents.forEach(activity=>{
  const key=parseDay(activity.occurredAt);
  if(key){const row=byBucket.get(keyFor(key));if(row)row.interactions++;}
 });
 const overdue=personalTasks.filter(task=>!task.deletedAt&&
  task.status!=='completed'&&task.status!=='canceled'&&
  Boolean(task.dueDate&&task.dueDate<through)).length;
 const decided=won.length+lost.length;
 return {
  since,through,dealsCreated:cohort.length,openDeals,openValue,
  wonDeals:won.length,wonValue:won.reduce((sum,deal)=>sum+(deal.amount??0),0),
  lostDeals:lost.length,winRate:decided?won.length/decided:null,
  sentQuotes:sent.length,nativeSent:sent.filter(record=>record.source==='salesshop').length,
  externalSent:sent.filter(record=>record.source==='external').length,
  sentValue:sent.reduce((sum,record)=>sum+(record.value??0),0),
  missingQuoteValues:sent.filter(record=>record.value===undefined).length,
  interactions:interactionEvents.length,privateOverdueTasks:overdue,
  pipelineByStage,trend,trendLabel:filters.period==='30d'||filters.period==='90d'
   ?'Weekly · selected window':filters.period==='all'?'Monthly · most recent 12 months':'Monthly · selected window',
  topDeals:cohort.filter(deal=>OPEN_PIPELINE_STAGES.some(stage=>stage===deal.stage))
   .sort((a,b)=>(b.amount??0)-(a.amount??0)).slice(0,6),
  recentSent:sent.sort((a,b)=>(b.sentDate??'').localeCompare(a.sentDate??'')).slice(0,6),
 };
}
