import {describe,expect,it} from 'vitest';
import type {Activity} from '../types/crm';
import type {Quote} from '../types/quote';
import {confirmedQuoteDeliveries,dedupeNativeQuoteActivities} from './quoteDeliveryLifecycle';
import {confirmedBidSubmissionDealIds,isCustomerQuoteSubmission} from './confirmedBidSubmissions';
import {buildSalesQuoteRegistry} from './salesQuoteRegistry';
import {buildCalendarBadgeIndex,metricCount} from './homeCalendarBadges';
import {homeCalendarBadgeEntries} from './homeCalendarDrilldown';
import {DEFAULT_HOME_CALENDAR_SETTINGS} from '../store/homeCalendarSettings';

const day='2026-11-14';
const quote:Quote={
 id:'quote-347c',title:'Builder countertop bid',quoteNumber:'Q-347',
 documentType:'quote',revision:2,status:'Sent',projectId:'deal-347c',
 quoteDate:day,originalQuoteDate:day,sections:[],lines:[],history:[],
 customerColumns:{quantity:true,rate:true,lineAmount:true},
 customerNotes:'',internalNotes:'',
 createdAt:'2026-11-14T10:00:00Z',updatedAt:'2026-11-14T10:00:00Z',
};
const delivery:Activity={
 id:'delivery-1',type:'quote-sent',quoteId:quote.id,projectId:'deal-347c',
 summary:'Delivered customer quote',occurredAt:'2026-11-14T12:00:00Z',
 metadata:{source:'manual',revision:2,deliveryConfirmed:true,deliveryMethod:'email'},
};

describe('Batch 347c — native quote evidence across CRM and Calendar',()=>{
 it('a newer correction of the same Activity ID revokes stale delivery proof everywhere',()=>{
  const corrected:Activity={...delivery,metadata:{
   ...delivery.metadata,editedAt:'2026-11-14T13:00:00Z',
   deliveryConfirmed:false,
  }};
  for(const activities of [[delivery,corrected],[corrected,delivery]]){
   expect(dedupeNativeQuoteActivities(activities)).toEqual([corrected]);
   expect(confirmedQuoteDeliveries(quote,activities)).toEqual([]);
   expect(confirmedBidSubmissionDealIds(activities)).toEqual(new Set());
   expect(buildSalesQuoteRegistry([quote],activities,[])[0].sentDate).toBeUndefined();
   const badges=buildCalendarBadgeIndex([],[],activities,[],[],
    DEFAULT_HOME_CALENDAR_SETTINGS);
   expect(metricCount(badges,day,'quotes-sent')).toBe(0);
   expect(homeCalendarBadgeEntries('quotes-sent',day,[],[],activities,[],[],
    DEFAULT_HOME_CALENDAR_SETTINGS)).toEqual([]);
  }
 });
 it('a same-timestamp disagreement fails closed rather than reusing stale confirmation',()=>{
  const notConfirmed:Activity={...delivery,metadata:{
   ...delivery.metadata,deliveryConfirmed:false,
  }};
  for(const activities of [[delivery,notConfirmed],[notConfirmed,delivery]]){
   expect(confirmedQuoteDeliveries(quote,activities)).toEqual([]);
   expect(confirmedBidSubmissionDealIds(activities)).toEqual(new Set());
  }
 });
 it('requires revision-specific proof and keeps genuine distinct confirmations',()=>{
  const legacy={...delivery,id:'legacy',metadata:{
   source:'manual' as const,deliveryConfirmed:true,
  }};
  const old={...delivery,id:'old-revision',metadata:{
   source:'manual' as const,revision:1,deliveryConfirmed:true,
  }};
  const second={...delivery,id:'delivery-2',occurredAt:'2026-11-14T14:00:00Z'};
  expect(isCustomerQuoteSubmission(legacy)).toBe(false);
  expect(isCustomerQuoteSubmission(old)).toBe(true);
  expect(confirmedQuoteDeliveries(quote,[legacy,old,delivery,second]).map(a=>a.id))
   .toEqual(['delivery-2','delivery-1']);
  expect(confirmedBidSubmissionDealIds([legacy])).toEqual(new Set());
  expect(confirmedBidSubmissionDealIds([delivery,second]))
   .toEqual(new Set(['deal-347c']));
  const badges=buildCalendarBadgeIndex([],[],[delivery,second],[],[],
   DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(metricCount(badges,day,'quotes-sent')).toBe(2);
 });
});
