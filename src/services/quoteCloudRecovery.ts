import type {Quote,QuoteDocument} from '../types/quote';
import {chooseActiveQuoteId} from './quoteActiveSelection';
import {scopedStorageKey} from '../lib/developerPlayground';

const KEY=scopedStorageKey('salesshop-cloud-quote-pending-v1');
export interface QuoteSyncScope {userId:string;organizationId:string;}
export interface PendingQuoteSync {
  userId:string;organizationId:string;token:string;quoteIds:string[];
}
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
    return {...scope,token:value.token,quoteIds:value.quoteIds.filter((id):id is string=>typeof id==='string')};
  }catch{return null;}
}
/** A durable marker points at the *existing* local quote document. No extra
 * copy of customer quotes goes into localStorage. */
export function markPendingQuoteSync(scope:QuoteSyncScope,value:unknown):string|null {
  if(!isQuoteDoc(value))return null;
  try{
    const token=crypto.randomUUID();
    const marker:PendingQuoteSync={...scope,token,
      quoteIds:value.quotes.filter(q=>q.ownerUserId===scope.userId).map(q=>q.id)};
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
  for(const candidate of local.quotes){
    if(!pendingIds.has(candidate.id)||candidate.ownerUserId!==pending.userId||
       candidate.archivedAt||!['Draft','Ready'].includes(candidate.status))continue;
    const server=byId.get(candidate.id);
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
