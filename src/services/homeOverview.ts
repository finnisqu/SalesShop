import type {Quote} from '../types/quote';
import type {Activity} from '../types/crm';
import {quoteTotal} from '../types/quote';
import {buildQuoteFollowUpQueue,followUpLocalDate} from './quoteFollowUps';

export function personalHomeQuotes(quotes:readonly Quote[],actorId:string|undefined,isCloud:boolean):Quote[]{
  if(isCloud&&!actorId)return[];
  return quotes.filter(q=>!q.archivedAt&&(!isCloud||q.ownerUserId===actorId));
}
export function homeRecentQuotes(quotes:readonly Quote[],limit=3){
  return [...quotes].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,limit);
}
/** A sent bid created in another tool is still a quote in Home Recents.
 * Do not manufacture a native SalesShop Quote for it; open its real CRM Activity.
 */
export interface HomeRecentQuoteEntry{
 kind:'quote'|'external';id:string;recordId:string;
 title:string;detail:string;timestamp:string;
}
export function homeRecentQuoteEntries(quotes:readonly Quote[],activities:readonly Activity[],
 limit=5):HomeRecentQuoteEntry[]{
 const normal:HomeRecentQuoteEntry[]=quotes.map(quote=>({
  kind:'quote',id:'quote:'+quote.id,recordId:quote.id,
  title:quote.title||'Untitled quote',
  detail:quote.companyName||quote.quoteNumber||'Quote draft',
  timestamp:quote.updatedAt,
 }));
 const external:HomeRecentQuoteEntry[]=activities
  .filter(activity=>activity.type==='quote-sent'&&activity.metadata?.externalQuoteSent===true)
  .map(activity=>({
   kind:'external',id:'external:'+activity.id,recordId:activity.id,
   title:activity.summary,
   detail:'Outside SalesShop · Sent '+(activity.metadata?.bidSentDate??activity.occurredAt.slice(0,10)),
   timestamp:activity.metadata?.recordedAt&&Number.isFinite(Date.parse(activity.metadata.recordedAt))
    ?activity.metadata.recordedAt:activity.occurredAt,
  }));
 // Keep a small, explicitly labeled external history visible even for
 // legacy backfills that predate recordedAt metadata. They cannot safely be
 // assigned a fabricated logging timestamp.
 const order=(a:HomeRecentQuoteEntry,b:HomeRecentQuoteEntry)=>
  Date.parse(b.timestamp)-Date.parse(a.timestamp)||a.id.localeCompare(b.id);
 const externalSlots=Math.min(2,limit,external.length);
 return [...external.sort(order).slice(0,externalSlots),
  ...normal.sort(order).slice(0,Math.max(0,limit-externalSlots))];
}
export function homeQuoteAttention(quotes:readonly Quote[],activities:readonly Activity[],today=followUpLocalDate()){
  const queue=buildQuoteFollowUpQueue(quotes,activities,today);
  const immediate=queue.filter(item=>['due','needs-delivery','ready-to-review'].includes(item.priority));
  const suggestions=queue.filter(item=>item.priority==='awaiting-reply');
  const upcoming=queue.filter(item=>item.priority==='upcoming');
  return [...immediate,...suggestions,...upcoming].slice(0,6);
}
export function homeMonthlyMetrics(quotes:readonly Quote[],date=new Date()){
  const month=followUpLocalDate(date).slice(0,7);
  const sent=quotes.filter(q=>q.sentAt?.startsWith(month)).length;
  const accepted=quotes.filter(q=>q.status==='Signed'&&q.signedAt?.startsWith(month));
  return {sent,signed:accepted.length,signedValue:accepted.reduce((total,q)=>total+quoteTotal(q),0)};
}
