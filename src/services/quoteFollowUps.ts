import type {Activity} from '../types/crm';
import type {Quote} from '../types/quote';
import {confirmedQuoteDeliveries} from './quoteDeliveryLifecycle';

export type FollowUpAction='scheduled'|'contacted'|'cleared';
export type FollowUpMethod='call'|'email'|'text'|'meeting'|'other';
export type FollowUpPriority='needs-delivery'|'due'|'upcoming'|'awaiting-reply'|'ready-to-review';
export interface QuoteFollowUpItem{
  quote:Quote;priority:FollowUpPriority;label:string;reason:string;
  dueDate?:string;lastContactAt?:string;
}
const DAY=86_400_000;
const validDate=(value?:string)=>Boolean(value&&/^\d{4}-\d\d-\d\d$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z')));
export const followUpLocalDate=(date=new Date())=>date.getFullYear()+'-'+
  String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');

export function latestQuoteFollowUp(quote:Pick<Quote,'id'|'revision'>,activities:readonly Activity[]){
  return activities.filter(a=>a.quoteId===quote.id&&a.type==='quote-follow-up'&&
    a.metadata?.revision===quote.revision&&
    ['scheduled','contacted','cleared'].includes(a.metadata?.followUpAction??''))
    .sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||b.id.localeCompare(a.id))[0];
}
/** Events are scoped to the exact revision. Old revisions never suppress a new follow-up. */
export function buildQuoteFollowUpQueue(quotes:readonly Quote[],activities:readonly Activity[],today=followUpLocalDate()):QuoteFollowUpItem[]{
  const entries:QuoteFollowUpItem[]=[];
  for(const quote of quotes){
    if(quote.archivedAt||['Signed','Declined','Expired'].includes(quote.status))continue;
    if(quote.status==='Draft')continue;
    if(quote.status==='Ready'){
      entries.push({quote,priority:'ready-to-review',label:'Ready to review',reason:'Approve and issue the customer revision.'});
      continue;
    }
    const last=latestQuoteFollowUp(quote,activities);
    const deliveries=confirmedQuoteDeliveries(quote,activities);
    if(!deliveries.length){
      entries.push({quote,priority:'needs-delivery',label:'Delivery not confirmed',
        reason:'Issue is complete, but no customer delivery has been recorded.'});
      continue;
    }
    const contacted=last?.metadata?.followUpAction==='contacted';
    const cleared=last?.metadata?.followUpAction==='cleared';
    if(contacted||cleared){
      entries.push({quote,priority:'awaiting-reply',label:contacted?'Contact logged':'Reminder cleared',
        lastContactAt:last?.occurredAt,
        reason:'No next follow-up is scheduled. Plan the next check-in or open the quote.'});
      continue;
    }
    const dueDate=last?.metadata?.followUpAction==='scheduled'&&validDate(last.metadata.followUpDueDate)
      ?last.metadata.followUpDueDate:undefined;
    if(dueDate){
      entries.push({quote,priority:dueDate<=today?'due':'upcoming',dueDate,
        label:dueDate<today?'Follow-up overdue':dueDate===today?'Follow-up today':'Follow-up scheduled',
        reason:'Reach out about the delivered revision.'});
      continue;
    }
    const deliveryDate=deliveries[0].occurredAt.slice(0,10);
    // A reminder suggestion is not an assigned due date; never call it overdue.
    const ageDays=Math.max(0,Math.floor((Date.parse(today+'T12:00:00Z')-Date.parse(deliveryDate+'T12:00:00Z'))/DAY));
    entries.push({quote,priority:'awaiting-reply',label:'Awaiting customer response',
      lastContactAt:deliveries[0].occurredAt,
      reason:ageDays>=5?'Delivered '+ageDays+' days ago · Consider following up.':
        'Customer delivery confirmed · Schedule a follow-up when appropriate.'});
  }
  const order:Record<FollowUpPriority,number>={
    'due':0,'needs-delivery':1,'ready-to-review':2,'awaiting-reply':3,'upcoming':4,
  };
  return entries.sort((a,b)=>order[a.priority]-order[b.priority]||
    (a.dueDate??'9999-12-31').localeCompare(b.dueDate??'9999-12-31')||
    a.quote.title.localeCompare(b.quote.title)||a.quote.id.localeCompare(b.quote.id));
}
export function quoteFollowUpCounts(items:readonly QuoteFollowUpItem[]){
  return {total:items.length,due:items.filter(x=>x.priority==='due').length,
    needsDelivery:items.filter(x=>x.priority==='needs-delivery').length,
    awaiting:items.filter(x=>x.priority==='awaiting-reply').length,
    scheduled:items.filter(x=>x.priority==='upcoming').length};
}
