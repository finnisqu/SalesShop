import {create} from 'zustand';
import {loadEmailLinks,saveEmailLinks,validateEmailLink,
 type LinkedEmailThread,type EmailLinkDraft} from '../services/emailThreadLinks359a';
interface EmailThreadLinkState {
 scope:string|null;links:LinkedEmailThread[];
 hydrate:(scope:string|null)=>void;
 link:(draft:EmailLinkDraft)=>void;
 unlink:(id:string)=>void;
}
export const useEmailThreadLinkStore=create<EmailThreadLinkState>((set,get)=>({
 scope:null,links:[],
 hydrate(scope){
  if(get().scope===scope)return;
  set({scope,links:scope?loadEmailLinks(scope):[]});
 },
 link(draft){
  const {scope,links}=get();
  if(!scope)throw new Error('Sign in to SalesShop before linking email.');
  const safe=validateEmailLink(draft);
  if(links.some(l=>l.mailbox===safe.mailbox&&l.threadId===safe.threadId&&
   l.targetKind===safe.targetKind&&l.targetId===safe.targetId))
   throw new Error('This conversation is already linked to that record.');
  const next=[{...safe,id:crypto.randomUUID(),provider:'gmail' as const,
   linkedAt:new Date().toISOString()},...links];
  saveEmailLinks(scope,next);
  set({links:next});
 },
 unlink(id){
  const {scope,links}=get();
  if(!scope)throw new Error('Email links are not ready.');
  const next=links.filter(row=>row.id!==id);
  if(next.length===links.length)return;
  saveEmailLinks(scope,next);
  set({links:next});
 },
}));
