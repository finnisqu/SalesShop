/** On-demand Gmail triage of ONLY the currently loaded conversation summaries.
 * No Gmail writes, automatic CRM Activities, or persistent inbox classification.
 */
import type {Contact} from '../types/crm';
import type {GmailThreadSummary} from './gmailRead359a';
import {extractAddresses} from './gmailRead359a';
import {personEmailAddress} from './emailAutoMatch361';
import {reviewAgeMatches,DEFAULT_GMAIL_REVIEW_RULES,type GmailReviewRules} from './gmailTriagePrefs370';

export type GmailTriageFilter='all'|'review'|'known'|'new';
export interface GmailTriageItem {
 thread:GmailThreadSummary;
 people:Contact[];
 unknownAddresses:string[];
 reviewReply:boolean;
}
export interface GmailTriageCounts {all:number;review:number;known:number;new:number}
const BOT_LOCAL=/^(?:no[\W_]*reply|do[\W_]*not[\W_]*reply|mailer[\W_]*daemon|notifications?|bounce)(?:[\W_]|$)/i;

/** "Review replies" is NOT a statement that the mailbox has no response:
 * Gmail summaries omit To/CC for the latest individual message and may not
 * include all messages. The detailed reader offers a more specific suggestion.
 */
export function mayNeedGmailReplyReview(thread:GmailThreadSummary,
 mailbox:string|null,now=Date.now(),
 rules:Readonly<GmailReviewRules>=DEFAULT_GMAIL_REVIEW_RULES):boolean{
 const own=personEmailAddress(mailbox);
 const senders=extractAddresses(thread.from);
 if(!own||senders.length!==1||senders[0]===own)return false;
 const local=senders[0].slice(0,senders[0].indexOf('@'));
 if(BOT_LOCAL.test(local))return false;
 // The thread must involve our mailbox, even if not necessarily addressed to it last.
 if(!thread.participants.some(address=>personEmailAddress(address)===own))return false;
 return reviewAgeMatches(thread.date,now,rules);
}
export function classifyGmailTriage(threads:readonly GmailThreadSummary[],
 contacts:readonly Contact[],mailbox:string|null,now=Date.now(),
 rules:Readonly<GmailReviewRules>=DEFAULT_GMAIL_REVIEW_RULES):GmailTriageItem[]{
 const own=personEmailAddress(mailbox);
 const peopleByEmail=new Map<string,Contact[]>();
 for(const contact of contacts){
  const email=personEmailAddress(contact.email);
  if(email)peopleByEmail.set(email,[...(peopleByEmail.get(email)??[]),contact]);
 }
 return threads.map(thread=>{
  const participants=[...new Set(thread.participants.map(personEmailAddress)
   .filter((value):value is string=>!!value&&value!==own))];
  const people:Contact[]=[];
  const unknownAddresses:string[]=[];
  const seen=new Set<string>();
  for(const email of participants){
   const matches=peopleByEmail.get(email)??[];
   if(!matches.length){unknownAddresses.push(email);continue;}
   for(const person of matches)if(!seen.has(person.id)){
    seen.add(person.id);people.push(person);
   }
  }
  return {thread,people,unknownAddresses,
   reviewReply:(!rules.knownOnly||people.length>0)&&
    mayNeedGmailReplyReview(thread,mailbox,now,rules)};
 });
}
export function gmailTriageCounts(items:readonly GmailTriageItem[]):GmailTriageCounts{
 return {all:items.length,review:items.filter(item=>item.reviewReply).length,
  known:items.filter(item=>item.people.length>0).length,
  new:items.filter(item=>item.unknownAddresses.length>0).length};
}
export function filterGmailTriage(items:readonly GmailTriageItem[],
 filter:GmailTriageFilter):GmailTriageItem[]{
 switch(filter){
  case 'review':return items.filter(item=>item.reviewReply);
  case 'known':return items.filter(item=>item.people.length>0);
  case 'new':return items.filter(item=>item.unknownAddresses.length>0);
  default:return [...items];
 }
}
