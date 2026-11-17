/** Gmail Person matching is a live, mailbox-private view, not a CRM email archive.
 * A Person is matched only by an exact From/To/Cc header address.
 */
import {scopedStorageKey} from '../lib/developerPlayground';
import type {GmailThreadSummary} from './gmailRead359a';

export interface PersonEmailPreferences {
 enabled:boolean;
 hiddenThreadIds:string[];
}
const DEFAULT_PREFS:PersonEmailPreferences={enabled:true,hiddenThreadIds:[]};
const threadIdPattern=/^[A-Za-z0-9_-]{3,128}$/;

export function personEmailAddress(value?:string|null):string|null{
 const normalized=(value??'').trim().toLowerCase();
 return normalized.length<=254&&/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(normalized)
  ?normalized:null;
}

/** Gmail's brace syntax ORs participants; exact headers are checked afterwards. */
export function gmailPersonQuery(address:string):string{
 const email=personEmailAddress(address);
 if(!email)throw new Error('The Person needs a valid email address.');
 return '{from:'+email+' to:'+email+' cc:'+email+'}';
}
export function personThreadMatches(thread:GmailThreadSummary,address:string):boolean{
 const email=personEmailAddress(address);
 return !!email&&thread.participants.some(item=>item.trim().toLowerCase()===email);
}
export function matchingPersonThreads(threads:readonly GmailThreadSummary[],address:string):GmailThreadSummary[]{
 return threads.filter(item=>threadIdPattern.test(item.id)&&personThreadMatches(item,address));
}
export function mergePersonThreads(existing:readonly GmailThreadSummary[],
 next:readonly GmailThreadSummary[]):GmailThreadSummary[]{
 const byId=new Map<string,GmailThreadSummary>();
 for(const item of [...existing,...next])if(threadIdPattern.test(item.id))byId.set(item.id,item);
 return [...byId.values()].sort((a,b)=>b.date.localeCompare(a.date));
}

/** Saves only Person-scoped preferences and excluded thread IDs, never message content. */
export function personEmailPreferencesKey(scope:string,mailbox:string,personId:string):string{
 return scopedStorageKey('salesshop-person-email-auto-v1:'+scope+':'+mailbox+':'+personId);
}
export function readPersonEmailPreferences(scope:string|null,mailbox:string|null,
 personId:string):PersonEmailPreferences{
 if(!scope||!mailbox||!personId)return {...DEFAULT_PREFS,hiddenThreadIds:[]};
 try{
  const raw=JSON.parse(localStorage.getItem(personEmailPreferencesKey(scope,mailbox,personId))??'null') as unknown;
  if(!raw||typeof raw!=='object')return {...DEFAULT_PREFS,hiddenThreadIds:[]};
  const data=raw as Record<string,unknown>;
  return {enabled:data.enabled!==false,
   hiddenThreadIds:Array.isArray(data.hiddenThreadIds)?
    [...new Set(data.hiddenThreadIds.filter((id):id is string=>
     typeof id==='string'&&threadIdPattern.test(id)))].slice(0,500):[]};
 }catch{return {...DEFAULT_PREFS,hiddenThreadIds:[]};}
}
export function savePersonEmailPreferences(scope:string,mailbox:string,personId:string,
 prefs:PersonEmailPreferences):void{
 localStorage.setItem(personEmailPreferencesKey(scope,mailbox,personId),
  JSON.stringify({enabled:prefs.enabled,hiddenThreadIds:prefs.hiddenThreadIds
   .filter(id=>threadIdPattern.test(id)).slice(0,500)}));
}
