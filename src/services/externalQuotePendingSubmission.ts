/** A browser refresh must not manufacture a second Activity ID for the
 * same in-flight external bid. This pending envelope is scoped to one user,
 * organization and Deal; it is *not* evidence of successful cloud delivery. */
export interface ExternalQuotePendingIdentity {
 organizationId:string;
 userId:string;
 dealId:string;
}
export interface PendingExternalQuoteSubmission extends ExternalQuotePendingIdentity {
 version:1;
 id:string;
 recordedAt:string;
 bidSentDate:string;
 amount:number;
 format:string;
}
type PendingStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const PREFIX='salesshop-external-quote-pending-v1:';
const key=(identity:ExternalQuotePendingIdentity)=>
 PREFIX+[identity.organizationId,identity.userId,identity.dealId]
 .map(encodeURIComponent).join(':');
function browserStorage():PendingStorage|null{
 try{return typeof window==='undefined'?null:window.localStorage;}
 catch{return null;}
}
function sameIdentity(a:ExternalQuotePendingIdentity,b:ExternalQuotePendingIdentity){
 return a.organizationId===b.organizationId&&a.userId===b.userId&&a.dealId===b.dealId;
}
export function isPendingExternalQuoteSubmission(
 value:unknown,identity:ExternalQuotePendingIdentity,
):value is PendingExternalQuoteSubmission{
 if(!value||typeof value!=='object')return false;
 const v=value as Partial<PendingExternalQuoteSubmission>;
 return v.version===1&&sameIdentity({
   organizationId:v.organizationId??'',userId:v.userId??'',dealId:v.dealId??'',
  },identity)&&
  typeof v.id==='string'&&v.id.startsWith('activity_')&&v.id.length<=110&&
  typeof v.recordedAt==='string'&&Number.isFinite(Date.parse(v.recordedAt))&&
  typeof v.bidSentDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.bidSentDate)&&
  typeof v.amount==='number'&&Number.isFinite(v.amount)&&v.amount>=0&&
  typeof v.format==='string'&&v.format.length<=120;
}
export function readPendingExternalQuoteSubmission(
 identity:ExternalQuotePendingIdentity,storage:PendingStorage|null=browserStorage(),
):PendingExternalQuoteSubmission|null{
 if(!storage)return null;
 try{
  const raw=storage.getItem(key(identity));
  const parsed:unknown=raw?JSON.parse(raw):null;
  return isPendingExternalQuoteSubmission(parsed,identity)?parsed:null;
 }catch{return null;}
}
export function savePendingExternalQuoteSubmission(
 pending:PendingExternalQuoteSubmission,storage:PendingStorage|null=browserStorage(),
):boolean{
 if(!storage||!isPendingExternalQuoteSubmission(pending,pending))return false;
 try{storage.setItem(key(pending),JSON.stringify(pending));return true;}
 catch{return false;}
}
/** Clears only this precise attempt, never a newer attempt from another tab. */
export function clearPendingExternalQuoteSubmission(
 pending:PendingExternalQuoteSubmission,storage:PendingStorage|null=browserStorage(),
):boolean{
 if(!storage)return false;
 try{
  const existing=readPendingExternalQuoteSubmission(pending,storage);
  if(!existing)return true;
  if(existing.id!==pending.id||existing.recordedAt!==pending.recordedAt)return false;
  storage.removeItem(key(pending));return true;
 }catch{return false;}
}
