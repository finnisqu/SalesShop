import type {Activity,Project} from '../types/crm';
import type {Quote} from '../types/quote';
import {displayQuoteNumber,quoteTotal} from '../types/quote';

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
export function isExternalQuoteActivity(activity:Activity):boolean{
 return activity.type==='quote-sent'&&activity.metadata?.externalQuoteSent===true&&
  Boolean(activity.projectId)&&!activity.quoteId;
}
/** Retry/hydration caches can contain repeated copies of one submission.
 * De-duplicate by immutable Activity ID without touching native quote events. */
export function dedupeExternalQuoteActivities<T extends Activity>(activities:readonly T[]):T[]{
 const seen=new Set<string>();
 return activities.filter(activity=>{
  if(!isExternalQuoteActivity(activity))return true;
  if(seen.has(activity.id))return false;
  seen.add(activity.id);
  return true;
 });
}
export function externalQuoteActivities(activities:readonly Activity[]):Activity[]{
 return dedupeExternalQuoteActivities(activities).filter(isExternalQuoteActivity);
}

export function buildSalesQuoteRegistry(quotes:readonly Quote[],activities:readonly Activity[],
 deals:readonly DealSummary[]):SalesQuoteRecord[]{
 const dealMap=new Map(deals.map(deal=>[deal.id,deal]));
 const native:SalesQuoteRecord[]=quotes.filter(q=>!q.archivedAt).map(q=>({
  id:'native:'+q.id,source:'salesshop',sourceId:q.id,
  name:q.title?.trim()||displayQuoteNumber(q),
  number:displayQuoteNumber(q),
  documentType:q.documentType==='pricing-schedule'?'Pricing schedule':
   q.documentType==='change-order'?'Change order':'Quote',
  companyId:q.companyId,companyName:q.companyName,
  projectId:q.projectId,dealName:dealMap.get(q.projectId??'')?.name,
  status:q.status,value:quoteTotal(q),
  sentDate:q.sentAt?.slice(0,10),updatedAt:q.updatedAt,
  ownerUserId:q.ownerUserId,
 }));
 const external:SalesQuoteRecord[]=externalQuoteActivities(activities).map(a=>{
  const deal=dealMap.get(a.projectId??'');
  const amount=a.metadata?.amount;
  const recordedAt=a.metadata?.recordedAt;
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
   updatedAt:recordedAt&&Number.isFinite(Date.parse(recordedAt))?recordedAt:a.occurredAt,
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
