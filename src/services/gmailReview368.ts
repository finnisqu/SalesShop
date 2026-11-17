/** Browser-local, signed-in-user Gmail triage decisions (not CRM Activities).
 * Only a thread ID, last-message timestamp, and review status are retained.
 */
import {scopedStorageKey} from '../lib/developerPlayground';
import {personEmailAddress} from './emailAutoMatch361';
import type {GmailThreadSummary} from './gmailRead359a';

export type GmailReviewKind='reviewed'|'snoozed';
export interface GmailReviewDecision {
 threadId:string;
 latestDate:string;
 kind:GmailReviewKind;
 until?:string;
}
const idPattern=/^[A-Za-z0-9_-]{3,128}$/;
const DAYS=24*60*60*1000;
const MAX_ROWS=400;

function validTimestamp(value:unknown):value is string{
 return typeof value==='string'&&value.length>=20&&value.length<=35&&
  Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
}
export function gmailReviewStorageKey(scope:string|null,mailbox:string|null):string|null{
 const email=personEmailAddress(mailbox);
 return scope&&email?scopedStorageKey('salesshop-gmail-review-368:'+scope+':'+email):null;
}
function validReviewDecision(value:unknown):value is GmailReviewDecision{
 if(!value||typeof value!=='object')return false;
 const d=value as Record<string,unknown>;
 return typeof d.threadId==='string'&&idPattern.test(d.threadId)&&
  validTimestamp(d.latestDate)&&
  (d.kind==='reviewed'||(d.kind==='snoozed'&&validTimestamp(d.until)));
}
export function normalizeGmailReviewDecisions(input:unknown):GmailReviewDecision[]{
 if(!Array.isArray(input))return [];
 const unique=new Map<string,GmailReviewDecision>();
 for(const item of input)if(validReviewDecision(item)){
  unique.set(item.threadId,{
   threadId:item.threadId,latestDate:item.latestDate,kind:item.kind,
   ...(item.kind==='snoozed'?{until:item.until}:{})
  });
 }
 return [...unique.values()].slice(-MAX_ROWS);
}
export function readGmailReviewDecisions(scope:string|null,mailbox:string|null):GmailReviewDecision[]{
 const key=gmailReviewStorageKey(scope,mailbox);
 if(!key)return [];
 try{return normalizeGmailReviewDecisions(JSON.parse(localStorage.getItem(key)??'null'));}
 catch{return [];}
}
export function saveGmailReviewDecisions(scope:string|null,mailbox:string|null,
 decisions:readonly GmailReviewDecision[]):void{
 const key=gmailReviewStorageKey(scope,mailbox);
 if(!key)throw new Error('Connect a signed-in Gmail mailbox to save review preferences.');
 try{
  localStorage.setItem(key,JSON.stringify(normalizeGmailReviewDecisions(decisions)));
 }catch{throw new Error('Could not save review choices in this browser. Check browser storage.');}
}
export function currentGmailReviewDecision(thread:GmailThreadSummary,
 decisions:readonly GmailReviewDecision[],now=Date.now()):GmailReviewDecision|null{
 const row=decisions.find(d=>d.threadId===thread.id&&d.latestDate===thread.date);
 if(!row)return null;
 if(row.kind==='snoozed'&&(!row.until||Date.parse(row.until)<=now))return null;
 return row;
}
export function withGmailReviewDecision(decisions:readonly GmailReviewDecision[],
 thread:GmailThreadSummary,kind:GmailReviewKind|null,now=Date.now()):GmailReviewDecision[]{
 if(!idPattern.test(thread.id)||!validTimestamp(thread.date))
  throw new Error('This conversation needs valid Gmail metadata.');
 const next=normalizeGmailReviewDecisions(decisions).filter(d=>d.threadId!==thread.id);
 if(kind===null)return next;
 if(kind!=='reviewed'&&kind!=='snoozed')throw new Error('Invalid review action.');
 if(kind==='snoozed'&&!Number.isFinite(now))throw new Error('Invalid snooze time.');
 return normalizeGmailReviewDecisions([...next,{
  threadId:thread.id,latestDate:thread.date,kind,
  ...(kind==='snoozed'?{until:new Date(now+3*DAYS).toISOString()}:{})
 }]);
}
