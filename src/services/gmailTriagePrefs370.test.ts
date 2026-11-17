import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Contact} from '../types/crm';
import type {GmailThreadSummary} from './gmailRead359a';
import {DEFAULT_GMAIL_REVIEW_RULES,normalizeGmailReviewRules,gmailReviewRulesStorageKey,
 loadGmailReviewRules,storeGmailReviewRules,reviewAgeMatches} from './gmailTriagePrefs370';
import {classifyGmailTriage,mayNeedGmailReplyReview} from './gmailTriage367';
import {suggestGmailReply} from './gmailCombinedWorkflow365';
import {withBulkGmailReviewDecisions,currentGmailReviewDecision} from './gmailReview368';
const storage=new Map<string,string>();
beforeEach(()=>{storage.clear();vi.stubGlobal('localStorage',{
 getItem:(key:string)=>storage.get(key)??null,
 setItem:(key:string,value:string)=>{storage.set(key,value);}
});});
afterEach(()=>vi.unstubAllGlobals());
const time=Date.parse('2026-11-17T12:00:00Z');
const thread=(email:string,date='2026-11-14T12:00:00Z'):GmailThreadSummary=>({
 id:'thread123',subject:'Sensitive subject',from:email,participants:[
 'owner@shop.com','client@builder.com'
 ],date,messageCount:2,snippet:'Sensitive snippet'});
const person={id:'p1',name:'Client',email:'client@builder.com'} as Contact;
describe('Gmail personalized triage final bundle #370',()=>{
 it('persists only a small rule object scoped by SalesShop user and Gmail mailbox',()=>{
  const rules={minDays:3,maxDays:30,knownOnly:true};
  expect(storeGmailReviewRules('org:1:user:2','OWNER@SHOP.COM',rules)).toEqual(rules);
  expect(loadGmailReviewRules('org:1:user:2','owner@shop.com')).toEqual(rules);
  expect(loadGmailReviewRules('org:1:user:3','owner@shop.com')).toEqual(DEFAULT_GMAIL_REVIEW_RULES);
  expect(loadGmailReviewRules('org:1:user:2','other@shop.com')).toEqual(DEFAULT_GMAIL_REVIEW_RULES);
  expect(gmailReviewRulesStorageKey(null,'owner@shop.com')).toBeNull();
  const json=[...storage.values()].join(' ');
  expect(json).not.toContain('client@builder.com');
  expect(json).not.toContain('Sensitive');
  expect(json).not.toContain('thread123');
 });
 it('fails closed for invalid preferences and preserves default thresholds',()=>{
  expect(normalizeGmailReviewRules({minDays:0,maxDays:365,knownOnly:'yes'}))
   .toEqual(DEFAULT_GMAIL_REVIEW_RULES);
  expect(normalizeGmailReviewRules(null)).toEqual(DEFAULT_GMAIL_REVIEW_RULES);
  expect(()=>storeGmailReviewRules(null,null,{minDays:2,maxDays:14,knownOnly:false}))
   .toThrow();
 });
 it('applies age windows to summary and detailed message hints',()=>{
  const rules={minDays:5,maxDays:30,knownOnly:false};
  const t=thread('Client <client@builder.com>');
  expect(mayNeedGmailReplyReview(t,'owner@shop.com',time)).toBe(true);
  expect(mayNeedGmailReplyReview(t,'owner@shop.com',time,rules)).toBe(false);
  expect(reviewAgeMatches('2026-11-10T12:00:00Z',time,rules)).toBe(true);
  const details={summary:t,messages:[{id:'m1',from:t.from,to:'owner@shop.com',
    date:t.date,subject:t.subject,text:'Private body'}]};
  expect(suggestGmailReply(details,'owner@shop.com',time)).not.toBeNull();
  expect(suggestGmailReply(details,'owner@shop.com',time,rules)).toBeNull();
 });
 it('can limit review suggestions to People in CRM without suppressing Unknown filter',()=>{
  const t=thread('Client <client@builder.com>');
  const settings={minDays:1,maxDays:14,knownOnly:true};
  expect(classifyGmailTriage([t],[], 'owner@shop.com',time,settings)[0].reviewReply).toBe(false);
  expect(classifyGmailTriage([t],[person],'owner@shop.com',time,settings)[0].reviewReply).toBe(true);
  expect(classifyGmailTriage([t],[], 'owner@shop.com',time,settings)[0].unknownAddresses)
   .toEqual(['client@builder.com']);
 });
 it('provides quick Gmail search presets but keeps manual search editable',()=>{
  const ui=readFileSync(new URL('../components/EmailWorkspace.tsx',import.meta.url),'utf8');
  expect(ui).toContain('Quick searches');
  expect(ui).toContain("newer_than:7d");
  expect(ui).toContain("newer_than:30d");
  expect(ui).toContain("in:sent newer_than:90d");
  expect(ui).toContain('Review settings');
  expect(ui).toContain('Mark visible reviewed');
  expect(ui).toContain('Snooze visible 3 days');
  expect(ui).toContain('window.confirm(');
  expect(ui).not.toContain('recordActivity(');
 });
 it('batch-actions review only the explicitly chosen conversations and never their content',()=>{
  const a=thread('Client <client@builder.com>');
  const b={...a,id:'thread456',subject:'Another private subject'};
  const next=withBulkGmailReviewDecisions([],[a,b],'snoozed',time);
  expect(next).toHaveLength(2);
  expect(currentGmailReviewDecision(a,next,time)?.kind).toBe('snoozed');
  expect(currentGmailReviewDecision(b,next,time)?.kind).toBe('snoozed');
  expect(JSON.stringify(next)).not.toContain('Sensitive');
  expect(JSON.stringify(next)).not.toContain('client@builder.com');
  const reviewed=withBulkGmailReviewDecisions(next,[a],'reviewed',time);
  expect(currentGmailReviewDecision(a,reviewed,time)?.kind).toBe('reviewed');
  expect(currentGmailReviewDecision(b,reviewed,time)?.kind).toBe('snoozed');
 });
 it('rejects batch requests beyond the bounded storage capacity',()=>{
  const batch=Array.from({length:401},(_,i)=>({...thread('client@builder.com'),id:'t'+i}));
  expect(()=>withBulkGmailReviewDecisions([],batch,'reviewed',time)).toThrow();
 });

});
