import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import type {GmailThreadSummary} from './gmailRead359a';
import {gmailReviewStorageKey,readGmailReviewDecisions,saveGmailReviewDecisions,
 normalizeGmailReviewDecisions,currentGmailReviewDecision,withGmailReviewDecision}
 from './gmailReview368';
const records=new Map<string,string>();
const thread:GmailThreadSummary={id:'thread-123',subject:'Sensitive subject',
 from:'Customer <customer@example.com>',participants:['rep@shop.com','customer@example.com'],
 date:'2026-11-15T13:00:00.000Z',messageCount:2,snippet:'Sensitive message'};
const now=Date.parse('2026-11-17T12:00:00Z');
const scope='org:company-1:user:sales-1';
beforeEach(()=>{
 records.clear();
 vi.stubGlobal('localStorage',{
  getItem:(key:string)=>records.get(key)??null,
  setItem:(key:string,value:string)=>{records.set(key,value);}
 });
});
afterEach(()=>vi.unstubAllGlobals());
describe('personal Gmail reply triage #368',()=>{
 it('scopes review choices to both SalesShop user and Gmail mailbox',()=>{
  const initial=withGmailReviewDecision([],thread,'reviewed',now);
  saveGmailReviewDecisions(scope,'REP@SHOP.COM',initial);
  expect(readGmailReviewDecisions(scope,'rep@shop.com')).toEqual(initial);
  expect(readGmailReviewDecisions('org:company-1:user:sales-2','rep@shop.com')).toEqual([]);
  expect(readGmailReviewDecisions(scope,'other@shop.com')).toEqual([]);
  expect(gmailReviewStorageKey(scope,'rep@shop.com')).not.toBeNull();
  expect(gmailReviewStorageKey(null,'rep@shop.com')).toBeNull();
 });
 it('removes reviewed suggestions when a later Gmail message arrives',()=>{
  const reviewed=withGmailReviewDecision([],thread,'reviewed',now);
  expect(currentGmailReviewDecision(thread,reviewed,now)?.kind).toBe('reviewed');
  expect(currentGmailReviewDecision({...thread,date:'2026-11-17T13:00:00.000Z'},
   reviewed,now)).toBeNull();
  expect(currentGmailReviewDecision(thread,withGmailReviewDecision(reviewed,thread,null,now),now))
   .toBeNull();
 });
 it('snoozes for three full days and becomes visible again at expiration',()=>{
  const choices=withGmailReviewDecision([],thread,'snoozed',now);
  expect(choices[0].until).toBe('2026-11-20T12:00:00.000Z');
  expect(currentGmailReviewDecision(thread,choices,now+3*86400000-1)).not.toBeNull();
  expect(currentGmailReviewDecision(thread,choices,now+3*86400000)).toBeNull();
  expect(currentGmailReviewDecision({...thread,date:'2026-11-18T13:00:00.000Z'},
   choices,now+3600000)).toBeNull();
 });
 it('does not store subjects, snippets, message bodies, or access tokens',()=>{
  saveGmailReviewDecisions(scope,'rep@shop.com',
   withGmailReviewDecision([],thread,'snoozed',now));
  const saved=[...records.values()].join('\n');
  expect(saved).not.toContain('Sensitive');
  expect(saved).not.toContain('customer@example.com');
  expect(saved).not.toContain('rep@shop.com');
  expect(saved).toContain('thread-123');
 });
 it('rejects malicious, malformed and unbounded persisted decisions',()=>{
  const raw=[
   {threadId:'../evil',latestDate:thread.date,kind:'reviewed'},
   {threadId:'thread-123',latestDate:thread.date,kind:'snoozed',until:'never'},
   {threadId:'thread-123',latestDate:thread.date,kind:'reviewed'},
   {threadId:'thread-123',latestDate:thread.date,kind:'reviewed'},
  ];
  expect(normalizeGmailReviewDecisions(raw)).toEqual([
   {threadId:'thread-123',latestDate:thread.date,kind:'reviewed'}]);
  expect(normalizeGmailReviewDecisions(Array.from({length:420},(_,i)=>({
   threadId:'thread-'+i,latestDate:thread.date,kind:'reviewed'
  })))).toHaveLength(400);
 });
 it('uses in-place review controls without Gmail writes or CRM mutations',()=>{
  const source=readFileSync(new URL('../components/EmailWorkspace.tsx',import.meta.url),'utf8');
  expect(source).toContain('Mark reviewed');
  expect(source).toContain('Snooze 3 days');
  expect(source).toContain('Resume review');
  expect(source).toContain('Set aside');
  expect(source).toContain('currentGmailReviewDecision');
  expect(source).not.toContain('recordActivity(');
  const helper=readFileSync(new URL('./gmailReview368.ts',import.meta.url),'utf8');
  expect(helper).not.toContain('message.text');
  expect(helper).not.toContain('createTask(');
 });
});
