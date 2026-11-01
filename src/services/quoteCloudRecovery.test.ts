import {describe,it,expect} from 'vitest';
import type {Quote,QuoteDocument} from '../types/quote';
import {chooseActiveQuoteId} from './quoteActiveSelection';
import {mergePendingQuoteDrafts, type PendingQuoteSync} from './quoteCloudRecovery';
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
