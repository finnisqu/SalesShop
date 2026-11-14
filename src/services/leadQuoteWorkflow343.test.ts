import {describe,expect,it} from 'vitest';
import type {Activity,Project} from '../types/crm';
import type {Quote} from '../types/quote';
import {visibleSubmissionDeals} from './dealSubmissionAudience';
import {dealNeedsSubmission} from '../store/personalTaskStore';
import {buildSalesQuoteRegistry,mySalesQuoteRegistry} from './salesQuoteRegistry';
import {confirmedBidSubmissionDealIds,isCustomerQuoteSubmission} from './confirmedBidSubmissions';
import {projectStageAfterDelivery,projectStageAfterIssue} from './quoteDeliveryLifecycle';
import {buildCalendarBadgeIndex,metricCount} from './homeCalendarBadges';
import {recentHomeItems,personalCalendarSources} from './salesCalendar';
import {DEFAULT_HOME_CALENDAR_SETTINGS} from '../store/homeCalendarSettings';

const deal=(id:string,assignedUserId?:string):Project=>({
 id,name:'Builder bid '+id,stage:'Bid Development',
 ...(assignedUserId?{assignedUserId}:{}),
 dueDate:'2026-11-20',companyId:'builder',companyName:'Builder LLC',
 createdAt:'2026-11-11T12:00:00.000Z',updatedAt:'2026-11-11T12:00:00.000Z',
});
const quote=(projectId:string):Quote=>({
 id:'quote-'+projectId,title:'SalesShop estimate',quoteNumber:'Q-343',
 revision:0,status:'Sent',projectId,ownerUserId:'rep-a',
 companyId:'builder',companyName:'Builder LLC',
 documentType:'quote',originalQuoteDate:'2026-11-12',quoteDate:'2026-11-12',
 customerNotes:'',internalNotes:'',lines:[],sections:[],history:[],
 customerColumns:{quantity:false,rate:false,lineAmount:true},
 createdAt:'2026-11-12T10:00:00.000Z',updatedAt:'2026-11-12T10:00:00.000Z',
});
const activity=(id:string,projectId:string,metadata:Activity['metadata'],quoteId?:string):Activity=>({
 id,type:'quote-sent',projectId,...(quoteId?{quoteId}:{}),
 summary:id,occurredAt:'2026-11-13T15:00:00.000Z',metadata,
});
const issued=(projectId:string)=>activity('issued',projectId,
 {source:'quote',revision:0},'quote-'+projectId);
const delivered=(projectId:string)=>activity('delivered',projectId,
 {source:'manual',deliveryConfirmed:true,revision:0,deliveryMethod:'email'},
 'quote-'+projectId);
const outside=(projectId:string,by='rep-a')=>activity('external',projectId,{
 source:'manual',externalQuoteSent:true,recordedByUserId:by,
 recordedAt:'2026-11-13T17:00:00.000Z',
 bidSentDate:'2026-11-13',amount:42000,externalQuoteFormat:'Builder portal',
 fromStage:'Bid Development',
});

describe('Batch 343 — first-class customer quote submissions across the CRM',()=>{
 it('routes unassigned legacy Deals through native or external authorship equally',()=>{
  const nativeDeal=deal('native'),outsideDeal=deal('external');
  const native=quote(nativeDeal.id),external=outside(outsideDeal.id);
  expect(visibleSubmissionDeals('cloud','member','rep-a',[nativeDeal,outsideDeal],
    [issued(nativeDeal.id),external],[native],[]).map(d=>d.id))
   .toEqual(['native','external']);
  expect(visibleSubmissionDeals('cloud','member','rep-b',[nativeDeal,outsideDeal],
    [issued(nativeDeal.id),external],[native],[])).toEqual([]);
 });
 it('explicit assignment takes precedence even when a coworker submitted the quote',()=>{
  const assigned=deal('external','rep-b'),external=outside(assigned.id,'rep-a');
  expect(visibleSubmissionDeals('cloud','member','rep-a',[assigned],
    [external],[],[])).toEqual([]);
  expect(visibleSubmissionDeals('cloud','member','rep-b',[assigned],
    [external],[],[])).toEqual([assigned]);
 });
 it('separates preparation, proven delivery, and completed bid obligations',()=>{
  const project=deal('native'),native=quote(project.id);
  const issue=issued(project.id),delivery=delivered(project.id);
  expect(dealNeedsSubmission(project)).toBe(true);
  expect(projectStageAfterIssue(project.stage)).toBe(null);
  expect(isCustomerQuoteSubmission(issue)).toBe(false);
  expect(confirmedBidSubmissionDealIds([issue])).toEqual(new Set());
  expect(isCustomerQuoteSubmission(delivery)).toBe(true);
  expect(confirmedBidSubmissionDealIds([issue,delivery]))
   .toEqual(new Set([project.id]));
  expect(projectStageAfterDelivery(project.stage,native.revision)).toBe('Bid Sent');
 });
 it('records external and delivered native bids once each in Quotes and sent-day Calendar',()=>{
  const nativeDeal=deal('native'),externalDeal=deal('external');
  const native=quote(nativeDeal.id);
  const deliveries=[issued(nativeDeal.id),delivered(nativeDeal.id),outside(externalDeal.id)];
  const registry=buildSalesQuoteRegistry([native],deliveries,[nativeDeal,externalDeal]);
  expect(registry.map(r=>r.source).sort()).toEqual(['external','salesshop']);
  expect(registry.find(r=>r.source==='salesshop')?.sentDate).toBe('2026-11-13');
  expect(registry.find(r=>r.source==='external')?.sentDate).toBe('2026-11-13');
  expect(registry.find(r=>r.source==='external')?.value).toBe(42000);
  const badges=buildCalendarBadgeIndex([],[],deliveries,[],[],
    DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(metricCount(badges,'2026-11-13','quotes-sent')).toBe(2);
  const doubled=buildSalesQuoteRegistry([native],deliveries.concat([outside(externalDeal.id)]),
    [nativeDeal,externalDeal]);
  expect(doubled).toHaveLength(2);
 });
 it('surfaces external backfills in Recents by recording time, not their send date',()=>{
  const external=outside('external');
  const backfill:Activity={...external,occurredAt:'2026-09-01T12:00:00.000Z',
   metadata:{...external.metadata,recordedAt:'2026-11-13T17:00:00.000Z',
    bidSentDate:'2026-09-01'}};
  const recent=recentHomeItems([],[backfill],[],null,8);
  expect(recent[0].timestamp).toBe('2026-11-13T17:00:00.000Z');
  expect(recent[0].detail).toContain('Sent 2026-09-01');
  const personal=personalCalendarSources('cloud','rep-a',[],[],[deal('external')],[backfill]);
  expect(personal.activities.map(a=>a.id)).toEqual([backfill.id]);
 });
 it('keeps external quote history available to an assigned Deal rep without leaking other Deals',()=>{
  const project=deal('external','rep-b'),record=outside(project.id,'rep-a');
  const registry=buildSalesQuoteRegistry([],[record],[project]);
  expect(mySalesQuoteRegistry(registry,'cloud','rep-b',[project]).map(r=>r.id))
   .toEqual(['external:external']);
  expect(mySalesQuoteRegistry(registry,'cloud','stranger',[project])).toEqual([]);
 });
});
