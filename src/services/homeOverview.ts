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
