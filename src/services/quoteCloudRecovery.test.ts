import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import type {Quote,QuoteDocument} from '../types/quote';
import {chooseActiveQuoteId} from './quoteActiveSelection';
import {mergePendingQuoteDrafts,markPendingQuoteSync,readPendingQuoteSync,clearPendingQuoteSync,quoteHasUnsavedContent,type PendingQuoteSync} from './quoteCloudRecovery';
const draft=(id:string,updatedAt='2026-11-01T15:00:00.000Z',extras:Partial<Quote>={}):Quote=>({
 id,quoteNumber:'DRAFT-'+id,title:id,documentType:'quote',status:'Draft',ownerUserId:'owner',
 updatedAt,createdAt:updatedAt,lines:[],sections:[],history:[],customerNotes:'',internalNotes:'',
 customerColumns:{quantity:false,rate:false,lineAmount:true},revision:0,
 quoteDate:'2026-11-01',originalQuoteDate:'2026-11-01',...extras
} as Quote);
const doc=(quotes:Quote[],activeQuoteId:string|null=null):QuoteDocument=>({schemaVersion:2,quotes,activeQuoteId});
const marker:PendingQuoteSync={userId:'owner',organizationId:'shop',token:'t',quoteIds:['new','old']};
describe('save recovery and active document selection',()=>{
 it('never defaults to archived when active work exists',()=>{
  expect(chooseActiveQuoteId([draft('archived',undefined,{archivedAt:'2026-11-01'}),draft('new')],'archived')).toBe('new');
  expect(chooseActiveQuoteId([draft('archived',undefined,{archivedAt:'2026-11-01'})],'archived')).toBeNull();
 });
 it('recovers an unsynced own Quick Quote but never another person quote',()=>{
  const local=doc([draft('new'),draft('someone',undefined,{ownerUserId:'someone'})],'new');
  const result=mergePendingQuoteDrafts(doc([]),local,{...marker,quoteIds:['new','someone']});
  expect(result?.quotes.map(q=>q.id)).toEqual(['new']);
  expect(result?.activeQuoteId).toBe('new');
 });
 it('keeps a newer cloud revision or an issued quote immutable',()=>{
  const cloud=doc([draft('old','2026-11-01T16:00:00Z'),
    draft('new',undefined,{status:'Sent'})]);
  const local=doc([draft('old'),draft('new')]);
  const result=mergePendingQuoteDrafts(cloud,local,marker);
  expect(result?.quotes[0].updatedAt).toBe('2026-11-01T16:00:00Z');
  expect(result?.quotes[1].status).toBe('Sent');
 });
 it('never resurrects a draft without a matching, scoped pending marker',()=>{
  expect(mergePendingQuoteDrafts(doc([]),doc([draft('new')]),null)?.quotes).toHaveLength(0);
 });
});

describe('Batch 340 — durable quote recovery marker distinguishes new drafts',()=>{
 const scope={userId:'owner',organizationId:'shop'};
 const saved=new Map<string,string>();
 beforeEach(()=>{
  saved.clear();
  vi.stubGlobal('localStorage',{
   getItem:(key:string)=>saved.get(key)??null,
   setItem:(key:string,value:string)=>{saved.set(key,String(value));},
   removeItem:(key:string)=>{saved.delete(key);},
  });
 });
 afterEach(()=>vi.unstubAllGlobals());
 it('restores an interrupted newly created draft, never an older remotely deleted draft',()=>{
  const baseline=doc([draft('old')]);
  const current=doc([draft('old'),draft('new')],'new');
  const token=markPendingQuoteSync(scope,current,baseline);
  expect(token).toBeTruthy();
  const pending=readPendingQuoteSync(scope);
  expect(pending?.quoteIds).toEqual(['new']);
  expect(pending?.createdQuoteIds).toEqual(['new']);
  // Cloud is missing both IDs: old may have been deleted by another device.
  const merged=mergePendingQuoteDrafts(doc([]),current,pending);
  expect(merged?.quotes.map(q=>q.id)).toEqual(['new']);
 });
 it('never marks unrelated unchanged quotes as pending recovery',()=>{
  const baseline=doc([draft('a'),draft('b'),draft('c')]);
  const changed=doc([draft('a'),draft('b','2026-11-02T10:00:00Z',
   {title:'Changed B'}),draft('c')],'b');
  markPendingQuoteSync(scope,changed,baseline);
  const pending=readPendingQuoteSync(scope);
  expect(pending?.quoteIds).toEqual(['b']);
  expect(pending?.createdQuoteIds).toEqual([]);
  const remote=doc([draft('a'),draft('b'),draft('c')]);
  const merged=mergePendingQuoteDrafts(remote,changed,pending);
  expect(merged?.quotes.find(q=>q.id==='b')?.title).toBe('Changed B');
  expect(merged?.quotes.find(q=>q.id==='a')?.title).toBe('a');
 });
 it('does not mistake a changed active tab for a quote edit',()=>{
  const baseline=doc([draft('original')],'original');
  const switched=doc([draft('original')],null);
  expect(quoteHasUnsavedContent(scope,switched,baseline)).toBe(false);
  expect(markPendingQuoteSync(scope,switched,baseline)).toBeNull();
  expect(readPendingQuoteSync(scope)).toBeNull();
  expect(mergePendingQuoteDrafts(doc([draft('original')]),switched,readPendingQuoteSync(scope))
   ?.quotes[0].title).toBe('original');
 });
 it('recovers pending changes to a known server draft without treating it as a creation',()=>{
  const baseline=doc([draft('existing','2026-11-01T15:00:00.000Z')]);
  const local=doc([draft('existing','2026-11-02T12:00:00.000Z',
   {title:'Unsaved customer edits'})]);
  markPendingQuoteSync(scope,local,baseline);
  const pending=readPendingQuoteSync(scope);
  expect(pending?.createdQuoteIds).toEqual([]);
  expect(mergePendingQuoteDrafts(baseline,local,pending)?.quotes[0].title)
   .toBe('Unsaved customer edits');
  expect(mergePendingQuoteDrafts(doc([]),local,pending)?.quotes).toEqual([]);
 });
 it('keeps pending new quote IDs across multiple save generations and partial INSERTs',()=>{
  const baseline=doc([draft('existing')]);
  const first=doc([draft('existing'),draft('new')]);
  const olderToken=markPendingQuoteSync(scope,first,baseline);
  expect(olderToken).toBeTruthy();
  // Parent INSERT reached the cloud while line batches failed. On retry the
  // recovered cache can already include this ID in its local baseline.
  const retryBaseline=doc([draft('existing'),draft('new')]);
  const revised=doc([draft('existing'),draft('new','2026-11-02T12:00:00.000Z')]);
  const newerToken=markPendingQuoteSync(scope,revised,retryBaseline);
  expect(readPendingQuoteSync(scope)?.createdQuoteIds).toEqual(['new']);
  clearPendingQuoteSync(scope,olderToken!);
  expect(readPendingQuoteSync(scope)?.token).toBe(newerToken);
  clearPendingQuoteSync(scope,newerToken!);
  expect(readPendingQuoteSync(scope)).toBeNull();
 });
 it('does not schedule a save for another owner or an unchanged draft',()=>{
  const baseline=doc([draft('mine'),draft('shared',undefined,{ownerUserId:'colleague'})]);
  const local=doc([draft('mine'),draft('shared','2026-11-02T00:00:00Z',
   {ownerUserId:'colleague',title:'Updated elsewhere'})]);
  expect(quoteHasUnsavedContent(scope,local,baseline)).toBe(false);
  expect(markPendingQuoteSync(scope,local,baseline)).toBeNull();
  expect(readPendingQuoteSync(scope)).toBeNull();
  const changed=doc([draft('mine','2026-11-03T00:00:00Z',{title:'Changed'}),
   local.quotes[1]]);
  expect(quoteHasUnsavedContent(scope,changed,baseline)).toBe(true);
  expect(markPendingQuoteSync(scope,changed,baseline)).toBeTruthy();
  expect(readPendingQuoteSync(scope)?.quoteIds).toEqual(['mine']);
 });
 it('prefers server on equal timestamps for existing drafts',()=>{
  const timestamp='2026-11-01T15:00:00.000Z';
  const cloud=doc([draft('existing',timestamp,{title:'Trusted cloud draft'})]);
  const local=doc([draft('existing',timestamp,{title:'Stale local copy'})]);
  const pending:PendingQuoteSync={...marker,quoteIds:['existing'],createdQuoteIds:[]};
  expect(mergePendingQuoteDrafts(cloud,local,pending)?.quotes[0].title)
   .toBe('Trusted cloud draft');
 });
 it('replays a partially inserted new quote with equal timestamps',()=>{
  const timestamp='2026-11-01T15:00:00.000Z';
  const remote=doc([draft('new',timestamp,{lines:[]})]);
  const local=doc([draft('new',timestamp,{lines:[{
   id:'line-a',kind:'item',description:'Labor',pricingMode:'direct',
   amount:100,customerVisible:true,includeInTotal:true,
  }]})]);
  const pending:PendingQuoteSync={...marker,quoteIds:['new'],createdQuoteIds:['new']};
  expect(mergePendingQuoteDrafts(remote,local,pending)?.quotes[0].lines)
   .toEqual(local.quotes[0].lines);
 });
 it('rejects invalid timestamps rather than allowing stale overwrites',()=>{
  const valid=doc([draft('old',undefined,{title:'Cloud is valid'})]);
  const bad=doc([draft('old','not a real date',{title:'Invalid local'})]);
  const pending:PendingQuoteSync={...marker,quoteIds:['old'],createdQuoteIds:[]};
  expect(mergePendingQuoteDrafts(valid,bad,pending)?.quotes[0].title)
   .toBe('Cloud is valid');
  const badCloud=doc([draft('old','invalid cloud date',{title:'Unverifiable server'})]);
  const goodLocal=doc([draft('old','2026-11-15T00:00:00Z',{title:'Good local'})]);
  expect(mergePendingQuoteDrafts(badCloud,goodLocal,pending)?.quotes[0].title)
   .toBe('Unverifiable server');
 });
 it('keeps read-only and issued rows protected during creation recovery',()=>{
  const baseline=doc([draft('existing')]);
  const pendingDoc=doc([draft('existing'),draft('new'),
   draft('other',undefined,{ownerUserId:'colleague'})]);
  markPendingQuoteSync(scope,pendingDoc,baseline);
  const pending=readPendingQuoteSync(scope);
  expect(pending?.createdQuoteIds).toEqual(['new']);
  const cloud=doc([draft('new','2026-11-03T00:00:00Z',{status:'Sent'})]);
  expect(mergePendingQuoteDrafts(cloud,pendingDoc,pending)?.quotes).toHaveLength(1);
  expect(mergePendingQuoteDrafts(cloud,pendingDoc,pending)?.quotes[0].status).toBe('Sent');
 });
});
