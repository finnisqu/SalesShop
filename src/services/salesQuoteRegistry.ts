import type {Activity,Project} from '../types/crm';
import type {Quote} from '../types/quote';
import {displayQuoteNumber,quoteTotal} from '../types/quote';
import {confirmedQuoteDeliveries} from './quoteDeliveryLifecycle';

/** All submitted bids deserve a searchable Quote record. A SalesShop quote
 * retains its full editable document; an external quote retains its actual
 * delivery fact and contract value, without a fictitious document editor.
 */
export interface SalesQuoteRecord {
 id:string;source:'salesshop'|'external';sourceId:string;
 name:string;number:string;documentType:string;platform?:string;
 companyId?:string;companyName?:string;projectId?:string;dealName?:string;
 status:string;value:number|undefined;sentDate?:string;updatedAt:string;
 ownerUserId?:string;archived?:boolean;
}
type DealSummary=Pick<Project,'id'|'name'|'companyId'|'companyName'|'assignedUserId'>;
/** The Quotes register and Home badges must use the viewer's same local day.
 * The document's sentAt represents issuance and is not delivery evidence. */
function deliveredLocalDay(timestamp:string):string|undefined{
 const date=new Date(timestamp);
 if(!Number.isFinite(date.getTime()))return undefined;
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),
  String(date.getDate()).padStart(2,'0')].join('-');
}
export function isExternalQuoteActivity(activity:Activity):boolean{
 return activity.type==='quote-sent'&&activity.metadata?.externalQuoteSent===true&&
  Boolean(activity.projectId)&&!activity.quoteId;
}
/** A confirmed correction keeps its immutable Activity ID but advances
 * editedAt. Prefer the freshest reliable copy when cloud/local caches differ.
 * An older unedited record is never allowed to replace that correction. */
function externalActivityVersion(activity:Activity):number{
 for(const timestamp of [activity.metadata?.editedAt,activity.metadata?.recordedAt,
  activity.occurredAt]){
  if(typeof timestamp==='string'){
   const date=Date.parse(timestamp);
   if(Number.isFinite(date))return date;
  }
 }
 return Number.NEGATIVE_INFINITY;
}
/** Retry/hydration caches can contain repeated copies of one external bid.
 * Preserve its position, but retain the most recently updated Activity with
 * that immutable ID so Quotes, Calendar, and Home agree after a correction.
 * Never dedupe or rewrite native SalesShop quote lifecycle activities. */
export function dedupeExternalQuoteActivities<T extends Activity>(activities:readonly T[]):T[]{
 const result:T[]=[];
 const indexById=new Map<string,number>();
 for(const activity of activities){
  if(!isExternalQuoteActivity(activity)){result.push(activity);continue;}
  const index=indexById.get(activity.id);
  if(index===undefined){
   indexById.set(activity.id,result.length);
   result.push(activity);
  }else if(externalActivityVersion(activity)>externalActivityVersion(result[index])){
   result[index]=activity;
  }
 }
 return result;
}
export function externalQuoteActivities(activities:readonly Activity[]):Activity[]{
 return dedupeExternalQuoteActivities(activities).filter(isExternalQuoteActivity);
}

export function buildSalesQuoteRegistry(quotes:readonly Quote[],activities:readonly Activity[],
 deals:readonly DealSummary[],options?:{includeArchived?:boolean}):SalesQuoteRecord[]{
 const dealMap=new Map(deals.map(deal=>[deal.id,deal]));
 const native:SalesQuoteRecord[]=quotes.filter(q=>options?.includeArchived||!q.archivedAt).map(q=>({
  id:'native:'+q.id,source:'salesshop',sourceId:q.id,
  name:q.title?.trim()||displayQuoteNumber(q),
  number:displayQuoteNumber(q),
  documentType:q.documentType==='pricing-schedule'?'Pricing schedule':
   q.documentType==='change-order'?'Change order':'Quote',
  companyId:q.companyId,companyName:q.companyName,
  projectId:q.projectId,dealName:dealMap.get(q.projectId??'')?.name,
  status:q.status,value:quoteTotal(q),
  // sentAt tracks document issuance, not proof the customer received it.
 // Only salesperson-confirmed delivery supplies the registry's sent date.
 sentDate:deliveredLocalDay(confirmedQuoteDeliveries(q,activities)[0]?.occurredAt??''),
 updatedAt:q.updatedAt,
  ownerUserId:q.ownerUserId,archived:Boolean(q.archivedAt),
 }));
 const external:SalesQuoteRecord[]=externalQuoteActivities(activities).map(a=>{
  const deal=dealMap.get(a.projectId??'');
  const amount=a.metadata?.amount;
  const recordedAt=a.metadata?.recordedAt;
  const editedAt=a.metadata?.editedAt;
  const date=a.metadata?.bidSentDate;
  return {
   id:'external:'+a.id,source:'external' as const,sourceId:a.id,
   name:deal?.name?.trim()||a.summary||'External quote',
   number:'',documentType:'Quote',
   platform:a.metadata?.externalQuoteFormat,
   companyId:a.companyId??deal?.companyId,
   companyName:deal?.companyName,projectId:a.projectId,dealName:deal?.name,
   status:'Sent',
   value:typeof amount==='number'&&Number.isFinite(amount)?amount:undefined,
   sentDate:date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?date:a.occurredAt.slice(0,10),
   updatedAt:editedAt&&Number.isFinite(Date.parse(editedAt))?editedAt:
    recordedAt&&Number.isFinite(Date.parse(recordedAt))?recordedAt:a.occurredAt,
   ownerUserId:a.metadata?.recordedByUserId,
  };
 });
 return [...native,...external].sort((a,b)=>
  b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
}
/** The directory is a personal work surface, not a leak of other reps'
 * private quote drafts. An assigned external Deal counts as the rep's work.
 * CRM ownership and privacy are still enforced by source-table RLS.
 */
export function mySalesQuoteRegistry(records:readonly SalesQuoteRecord[],
 mode:'local'|'cloud',userId:string|undefined,
 deals:readonly DealSummary[]):SalesQuoteRecord[]{
 if(mode==='local')return [...records];
 if(!userId)return [];
 const assignedDealIds=new Set(deals.filter(d=>d.assignedUserId===userId).map(d=>d.id));
 return records.filter(record=>record.ownerUserId===userId||
  (record.source==='external'&&!!record.projectId&&assignedDealIds.has(record.projectId)));
}
