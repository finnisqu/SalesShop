import {beforeEach,describe,expect,it} from 'vitest';
import type {Activity,Project} from '../types/crm';
import type {Quote} from '../types/quote';
import {usePersonalTaskStore,type PersonalTask} from '../store/personalTaskStore';
import {confirmedBidSubmissionDealIds,isCustomerQuoteSubmission} from './confirmedBidSubmissions';
import {buildSalesQuoteRegistry} from './salesQuoteRegistry';
import {buildSalesCalendarEvents,recentHomeItems,isoLocalDay} from './salesCalendar';
import {buildCalendarBadgeIndex,metricCount} from './homeCalendarBadges';
import {homeCalendarBadgeEntries} from './homeCalendarDrilldown';
import {DEFAULT_HOME_CALENDAR_SETTINGS} from '../store/homeCalendarSettings';

const sentDay='2026-11-12';
const nativeDeal:Project={id:'deal-native',name:'Apartments',stage:'Bid Development',
 dueDate:'2026-11-15',companyId:'co-1',companyName:'Builder',
 createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-09T12:00:00Z'};
const externalDeal:Project={...nativeDeal,id:'deal-external',name:'Office bids'};
const nativeQuote:Quote={
 id:'quote-native',title:'Apartments estimate',quoteNumber:'Q-123',revision:1,
 status:'Sent',sentAt:'2026-11-10T15:00:00Z',
 projectId:nativeDeal.id,companyId:'co-1',companyName:'Builder',
 ownerUserId:'rep-1',documentType:'quote',lines:[],sections:[],history:[],
 customerColumns:{quantity:true,rate:true,lineAmount:true},
 updatedAt:'2026-11-10T15:00:00Z',
} as Quote;
const issued:Activity={id:'issued',type:'quote-sent',summary:'Q-123 issued',
 quoteId:nativeQuote.id,projectId:nativeDeal.id,
 occurredAt:'2026-11-10T15:00:00Z',
 metadata:{source:'quote',revision:1}};
const delivered:Activity={...issued,id:'delivered',
 summary:'Q-123 delivered to customer',
 occurredAt:'2026-11-12T17:00:00Z',
 metadata:{source:'manual',deliveryConfirmed:true,deliveryMethod:'email',revision:1}};
const outside:Activity={id:'external',type:'quote-sent',summary:'Office bid submitted',
 projectId:externalDeal.id,companyId:'co-1',
 occurredAt:'2026-11-12T12:00:00Z',
 metadata:{externalQuoteSent:true,source:'manual',fromStage:'Bid Development',
  bidSentDate:sentDay,amount:54000,externalQuoteFormat:'Builder portal',
  recordedAt:'2026-11-13T12:00:00Z',recordedByUserId:'rep-1'}};
const task=(dealId:string):PersonalTask=>({
 id:'task-'+dealId,title:'Submit quote · '+dealId,
 status:'open',type:'todo',sourceObjectId:'deal-submit:'+dealId,
 dueDate:'2026-11-15',linked:{type:'project',id:dealId},
 associations:[{type:'project',id:dealId}],
 workspaceScope:'local:user',createdAt:'2026-11-01T12:00:00Z',
 updatedAt:'2026-11-01T12:00:00Z',
});
beforeEach(()=>{
 usePersonalTaskStore.setState({scope:'local:user',tasks:[
  task(nativeDeal.id),task(externalDeal.id)],
  syncStatus:'local',syncError:null});
});

describe('Batch 329 Deal to native/external submission workflow',()=>{
 it('keeps bid tasks pending on issuance, then completes only after delivery or external submission',()=>{
  const store=usePersonalTaskStore.getState();
  store.complete('task-'+nativeDeal.id);
  expect(usePersonalTaskStore.getState().tasks.find(t=>t.id==='task-'+nativeDeal.id)?.status).toBe('open');
  expect(confirmedBidSubmissionDealIds([issued])).toEqual(new Set());
  const pending=buildSalesCalendarEvents(store.tasks,[nativeDeal,externalDeal],[issued],[nativeQuote]);
  expect(pending.filter(row=>row.kind==='bid')).toHaveLength(2);
  const confirmed=confirmedBidSubmissionDealIds([issued,delivered,outside]);
  expect([...confirmed].sort()).toEqual([nativeDeal.id,externalDeal.id].sort());
  for(const dealId of confirmed)usePersonalTaskStore.getState().completeDealSubmissionTasks(dealId);
  const completed=usePersonalTaskStore.getState().tasks;
  expect(completed.map(t=>t.status)).toEqual(['completed','completed']);
  expect(completed.every(t=>Boolean(t.submissionConfirmedAt))).toBe(true);
  const post=buildSalesCalendarEvents(completed,
   [{...nativeDeal,stage:'Bid Sent'}, {...externalDeal,stage:'Bid Sent'}],
   [issued,delivered,outside],[nativeQuote]);
  expect(post.filter(row=>row.kind==='bid')).toHaveLength(0);
 });
 it('keeps both submissions in Quotes, but only actual deliveries on sent-day Calendar',()=>{
  const activities=[issued,delivered,outside];
  const records=buildSalesQuoteRegistry([nativeQuote],activities,[nativeDeal,externalDeal]);
  expect(records.map(r=>r.source).sort()).toEqual(['external','salesshop']);
  expect(records.find(r=>r.source==='salesshop')).toMatchObject({
   projectId:nativeDeal.id,sentDate:isoLocalDay(delivered.occurredAt)});
  expect(records.find(r=>r.source==='external')).toMatchObject({
   projectId:externalDeal.id,sentDate:sentDay,value:54000});
  expect(isCustomerQuoteSubmission(issued)).toBe(false);
  const badges=buildCalendarBadgeIndex([],[],activities,[],[],
   DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(metricCount(badges,sentDay,'quotes-sent')).toBe(2);
  expect(metricCount(badges,'2026-11-10','quotes-sent')).toBe(0);
  const entries=homeCalendarBadgeEntries('quotes-sent',sentDay,[],[],
   activities,[],[],DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(entries.map(entry=>entry.kind).sort()).toEqual(['activity','quote']);
  expect(entries.map(entry=>entry.id).sort()).toEqual([outside.id,nativeQuote.id].sort());
  // Issuing is still a historical event, not a submitted bid.
  const recents=recentHomeItems([],activities,[nativeQuote],null,10);
  expect(recents.map(item=>item.recordId)).toContain(issued.id);
 });
 it('records historical builder backfills without completing already closed Deal tasks',()=>{
  const historical:Activity={...outside,id:'backfill',projectId:'deal-closed',
   metadata:{...outside.metadata,fromStage:'Closed Won',bidSentDate:'2024-09-01'}};
  expect(isCustomerQuoteSubmission(historical)).toBe(true);
  expect(confirmedBidSubmissionDealIds([historical])).toEqual(new Set());
  expect(buildSalesQuoteRegistry([], [historical],
   [{...nativeDeal,id:'deal-closed',stage:'Closed Won'}])[0].sentDate).toBe('2024-09-01');
  const badges=buildCalendarBadgeIndex([],[],[historical],[],[],
   DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(metricCount(badges,'2024-09-01','quotes-sent')).toBe(1);
 });
});
