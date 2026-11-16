import {scopedStorageKey} from '../lib/developerPlayground';
export type EmailTargetKind='person'|'deal';
export interface EmailTarget {kind:EmailTargetKind;id:string;title:string}
export interface LinkedEmailThread {
 id:string;provider:'gmail';mailbox:string;threadId:string;
 targetKind:EmailTargetKind;targetId:string;linkedAt:string;
}
export type EmailLinkDraft=Pick<LinkedEmailThread,'mailbox'|'threadId'|'targetKind'|'targetId'>;
/** No unconfirmed local account or missing team identity may persist references. */
export function emailWorkspaceScope(mode:'cloud'|'local',org?:string|null,user?:string|null):string|null{
 return mode==='cloud'&&org&&user?'org:'+org+':user:'+user:null;
}
export const emailLinksKey=(scope:string)=>scopedStorageKey('salesshop-email-thread-links-v1:'+scope);
export function normalizeMailbox(value:string):string{
 const email=value.trim().toLowerCase();
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error('A verified Gmail address is required.');
 return email;
}
export function validateEmailLink(draft:EmailLinkDraft):EmailLinkDraft{
 const mailbox=normalizeMailbox(draft.mailbox);
 if(!/^[A-Za-z0-9_-]{3,128}$/.test(draft.threadId))throw new Error('Invalid Gmail conversation ID.');
 if(!['person','deal'].includes(draft.targetKind)||!draft.targetId||draft.targetId.length>200)
  throw new Error('Select an accessible CRM Person or Deal.');
 return {...draft,mailbox};
}
export function loadEmailLinks(scope:string):LinkedEmailThread[]{
 try{
  const raw=JSON.parse(localStorage.getItem(emailLinksKey(scope))??'[]') as unknown;
  if(!Array.isArray(raw))return [];
  return raw.filter((row):row is LinkedEmailThread=>{
   if(!row||typeof row!=='object')return false;
   const r=row as Record<string,unknown>;
   try{
    return r.provider==='gmail'&&typeof r.id==='string'&&typeof r.linkedAt==='string'&&
     Boolean(validateEmailLink(r as unknown as EmailLinkDraft));
   }catch{return false;}
  });
 }catch{return [];}
}
export function saveEmailLinks(scope:string,items:readonly LinkedEmailThread[]):void{
 // Persist a reference only. Never persist token, subject, snippet, body or recipients.
 localStorage.setItem(emailLinksKey(scope),JSON.stringify(items));
}
