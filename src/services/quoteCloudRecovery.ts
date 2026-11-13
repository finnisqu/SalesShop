import type {Quote,QuoteDocument} from '../types/quote';
import {chooseActiveQuoteId} from './quoteActiveSelection';
import {scopedStorageKey} from '../lib/developerPlayground';

const KEY=scopedStorageKey('salesshop-cloud-quote-pending-v1');
export interface QuoteSyncScope {userId:string;organizationId:string;}
export interface PendingQuoteSync {
  userId:string;organizationId:string;token:string;quoteIds:string[];
  /** IDs created after the last acknowledged cloud baseline. Explicitly
   * distinguish new drafts from old drafts deleted on another device. */
  createdQuoteIds?:string[];
}
const cleanQuoteIds=(value:unknown):string[]=>Array.isArray(value)
  ?[...new Set(value.filter((id):id is string=>typeof id==='string'&&id.length>0))]:[];
function isQuoteDoc(value:unknown):value is QuoteDocument {
  if(!value||typeof value!=='object')return false;
  const doc=value as Partial<QuoteDocument>;
  return doc.schemaVersion===2&&Array.isArray(doc.quotes);
}
export function readPendingQuoteSync(scope:QuoteSyncScope):PendingQuoteSync|null {
  try{
    const value=JSON.parse(localStorage.getItem(KEY)??'null') as Partial<PendingQuoteSync>|null;
    if(!value||value.userId!==scope.userId||value.organizationId!==scope.organizationId
      ||!Array.isArray(value.quoteIds)||typeof value.token!=='string')return null;
    return {...scope,token:value.token,quoteIds:cleanQuoteIds(value.quoteIds),
      ...(Array.isArray(value.createdQuoteIds)
        ?{createdQuoteIds:cleanQuoteIds(value.createdQuoteIds)}:{}),
    };
  }catch{return null;}
}
/** A durable marker points at the *existing* local quote document. No extra
 * copy of customer quotes goes into localStorage. */
export function markPendingQuoteSync(
  scope:QuoteSyncScope,value:unknown,baseline?:QuoteDocument|null,
):string|null {
  if(!isQuoteDoc(value))return null;
  try{
    const token=crypto.randomUUID();
    const earlier=readPendingQuoteSync(scope);
    const quoteIds=cleanQuoteIds(value.quotes
      .filter(q=>q.ownerUserId===scope.userId).map(q=>q.id));
    const activeIds=new Set(quoteIds);
    const baselineIds=new Set(isQuoteDoc(baseline)?baseline.quotes.map(q=>q.id):[]);
    // Preserve older pending creations when a partially completed INSERT
    // wrote its parent row but did not finish its line/section batches.
    const created=cleanQuoteIds([
      ...(earlier?.createdQuoteIds??[]),
      ...quoteIds.filter(id=>!baselineIds.has(id)),
    ]).filter(id=>activeIds.has(id));
    const marker:PendingQuoteSync={...scope,token,quoteIds,
      // Legacy markers have no creation metadata. Keep their existing
      // recovery semantics until the old marker is acknowledged.
      ...(earlier&&!Array.isArray(earlier.createdQuoteIds)
        ?{}:{createdQuoteIds:created})};
    localStorage.setItem(KEY,JSON.stringify(marker));
    return token;
  }catch{return null;}
}
export function clearPendingQuoteSync(scope:QuoteSyncScope,token:string) {
  try{if(readPendingQuoteSync(scope)?.token===token)localStorage.removeItem(KEY);}
  catch{/* never let a cleared marker stop a successful cloud write */}
}
/** Recovered data is limited to the signed-in owner's unsynced, still-editable
 * drafts. Cloud-issued, signed or archived rows always take precedence. */
export function mergePendingQuoteDrafts(
  cloud:QuoteDocument|null,local:unknown,pending:PendingQuoteSync|null,
):QuoteDocument|null {
  if(!pending||!isQuoteDoc(local))return cloud;
  const cloudQuotes=cloud?.quotes??[];
  const byId=new Map(cloudQuotes.map(q=>[q.id,q]));
  let recovered=false;
  const pendingIds=new Set(pending.quoteIds);
  const newIds=Array.isArray(pending.createdQuoteIds)
    ?new Set(pending.createdQuoteIds):null;
  for(const candidate of local.quotes){
    if(!pendingIds.has(candidate.id)||candidate.ownerUserId!==pending.userId||
       candidate.archivedAt||!['Draft','Ready'].includes(candidate.status))continue;
    const server=byId.get(candidate.id);
    // Existing drafts deleted remotely must stay deleted. Newly created
    // unsynced drafts are the only records eligible to be added back.
    if(!server&&newIds&&!newIds.has(candidate.id))continue;
    if(server&&(server.archivedAt||!['Draft','Ready'].includes(server.status)))continue;
    if(server&&Date.parse(candidate.updatedAt)<Date.parse(server.updatedAt))continue;
    byId.set(candidate.id,candidate);
    recovered=true;
  }
  if(!recovered)return cloud;
  const quotes=[...byId.values()];
  return {schemaVersion:2,quotes,
    activeQuoteId:chooseActiveQuoteId(quotes,local.activeQuoteId??cloud?.activeQuoteId)};
}
