/** Per-user, per-connected-mailbox Gmail review preferences.
 * Only the review rules are persisted. No Gmail content, tokens or recipients.
 */
import {scopedStorageKey} from '../lib/developerPlayground';
import {personEmailAddress} from './emailAutoMatch361';

export interface GmailReviewRules {
 minDays:number;
 maxDays:number;
 knownOnly:boolean;
}
export const DEFAULT_GMAIL_REVIEW_RULES:Readonly<GmailReviewRules>=Object.freeze({
 minDays:1,maxDays:14,knownOnly:false
});
export const GMAIL_REVIEW_MIN_DAYS=[1,2,3,5,7] as const;
export const GMAIL_REVIEW_MAX_DAYS=[7,14,30] as const;

export function normalizeGmailReviewRules(data:unknown):GmailReviewRules{
 if(!data||typeof data!=='object')return {...DEFAULT_GMAIL_REVIEW_RULES};
 const row=data as Record<string,unknown>;
 const minDays=GMAIL_REVIEW_MIN_DAYS.some(n=>n===row.minDays)
  ?row.minDays as number:DEFAULT_GMAIL_REVIEW_RULES.minDays;
 const maxDays=GMAIL_REVIEW_MAX_DAYS.some(n=>n===row.maxDays)
  ?row.maxDays as number:DEFAULT_GMAIL_REVIEW_RULES.maxDays;
 return {minDays,maxDays,knownOnly:row.knownOnly===true};
}
export function gmailReviewRulesStorageKey(scope:string|null,mailbox:string|null):string|null{
 const address=personEmailAddress(mailbox);
 return scope&&address
  ?scopedStorageKey('salesshop-gmail-review-rules-370:'+scope+':'+address):null;
}
export function loadGmailReviewRules(scope:string|null,mailbox:string|null):GmailReviewRules{
 const key=gmailReviewRulesStorageKey(scope,mailbox);
 if(!key)return {...DEFAULT_GMAIL_REVIEW_RULES};
 try{return normalizeGmailReviewRules(JSON.parse(localStorage.getItem(key)??'null'));}
 catch{return {...DEFAULT_GMAIL_REVIEW_RULES};}
}
export function storeGmailReviewRules(scope:string|null,mailbox:string|null,
 rules:GmailReviewRules):GmailReviewRules{
 const key=gmailReviewRulesStorageKey(scope,mailbox);
 if(!key)throw new Error('Connect a signed-in Gmail account to save review settings.');
 const clean=normalizeGmailReviewRules(rules);
 try{localStorage.setItem(key,JSON.stringify(clean));}
 catch{throw new Error('Could not save review settings in this browser.');}
 return clean;
}
export function reviewAgeMatches(date:string,now:number,
 rules:Readonly<GmailReviewRules>=DEFAULT_GMAIL_REVIEW_RULES):boolean{
 const age=now-Date.parse(date);
 const {minDays,maxDays}=normalizeGmailReviewRules(rules);
 return Number.isFinite(age)&&age>=minDays*86400000&&age<=maxDays*86400000;
}
