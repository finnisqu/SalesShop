import {describe,expect,it} from 'vitest';
import type {Activity} from '../types/crm';
import {confirmedBidSubmissionDealIds} from './confirmedBidSubmissions';
const activity=(id:string,overrides:Partial<Activity>):Activity=>({
 id,type:'quote-sent',summary:'Quote event',occurredAt:'2026-11-09T18:00:00.000Z',...overrides,
});
describe('CRM proof for generated bid Tasks',()=>{
 it('ignores issue events, link creation, and unverified Deal stages',()=>{
  expect([...confirmedBidSubmissionDealIds([
   activity('issued',{projectId:'deal-1',quoteId:'quote-1',metadata:{source:'quote'}}),
   activity('other',{type:'project-stage-changed',projectId:'deal-2'}),
  ])]).toEqual([]);
 });
 it('recognizes customer delivery of an actual linked quote',()=>{
  expect([...confirmedBidSubmissionDealIds([
   activity('delivered',{projectId:'deal-1',quoteId:'quote-1',
    metadata:{source:'manual',deliveryConfirmed:true,deliveryMethod:'email'}}),
  ])]).toEqual(['deal-1']);
 });
 it('recognizes genuine external bids but not historical closed-Deal backfills',()=>{
  expect([...confirmedBidSubmissionDealIds([
   activity('live',{projectId:'deal-2',metadata:{
    externalQuoteSent:true,fromStage:'Bid Development',bidSentDate:'2026-11-09'}}),
   activity('historical',{projectId:'deal-3',metadata:{
    externalQuoteSent:true,fromStage:'Closed Won',bidSentDate:'2024-06-01'}}),
  ])]).toEqual(['deal-2']);
 });
});
