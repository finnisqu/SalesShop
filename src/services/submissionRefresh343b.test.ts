import {beforeEach,describe,expect,it} from 'vitest';
import type {Project,Activity} from '../types/crm';
import type {Quote} from '../types/quote';
import {personalCalendarSources,buildSalesCalendarEvents,recentHomeItems} from './salesCalendar';
import {buildCalendarBadgeIndex,metricCount} from './homeCalendarBadges';
import {homeCalendarBadgeEntries} from './homeCalendarDrilldown';
import {DEFAULT_HOME_CALENDAR_SETTINGS} from '../store/homeCalendarSettings';
import {buildSalesQuoteRegistry,mySalesQuoteRegistry} from './salesQuoteRegistry';
import {homeRecentQuoteEntries} from './homeOverview';
import {confirmedBidSubmissionDealIds} from './confirmedBidSubmissions';
import {usePersonalTaskStore,type PersonalTask} from '../store/personalTaskStore';
import {mergePrivateTasks} from './personalTaskCloudSync';

const scope='org:builder:user:rep-a';
const earlier='2026-11-11T12:00:00.000Z';
const deliveredAt='2026-11-12T15:00:00.000Z';
const later='2026-11-13T18:00:00.000Z';
const deal=(id:string,assignedUserId?:string):Project=>({
 id,name:'Builder proposal '+id,companyId:'builder',companyName:'Builder LLC',
 stage:'Bid Sent',createdAt:earlier,updatedAt:deliveredAt,
 ...(assignedUserId?{assignedUserId}:{}),
});
const external=(id:string,projectId:string,rep='rep-a'):Activity=>({
 id,type:'quote-sent',projectId,companyId:'builder',
 summary:'Bid submitted through builder portal',occurredAt:deliveredAt,
 metadata:{source:'manual',externalQuoteSent:true,fromStage:'Bid Development',
  bidSentDate:'2026-11-12',amount:81000,recordedByUserId:rep,
  recordedAt:deliveredAt},
});
const task=(id:string,projectId:string,changes:Partial<PersonalTask>={}):PersonalTask=>({
 id,sourceObjectId:'deal-submit:'+projectId,
 title:'Submit quote',status:'open',dueDate:'2026-11-15',
 workspaceScope:scope,createdAt:earlier,updatedAt:earlier,
 linked:{type:'project',id:projectId},
 associations:[{type:'project',id:projectId}],
 ...changes,
});
const native=(projectId:string):Quote=>({
 id:'quote-'+projectId,title:'Proposal',revision:0,status:'Sent',
 projectId,ownerUserId:'rep-a',companyId:'builder',
 lines:[],sections:[],history:[],documentType:'quote',
 customerColumns:{quantity:false,rate:false,lineAmount:true},
 createdAt:earlier,updatedAt:earlier,
}) as Quote;
beforeEach(()=>usePersonalTaskStore.setState({
 scope,tasks:[],syncStatus:'saved',syncError:null,
}));

describe('Batch 343b — cross-page submission consistency after cloud rehydrate',()=>{
 it('restores a Deal and its external bid for the author without a native Quote or Task',()=>{
  const project=deal('unassigned'),submission=external('outside-a',project.id);
  const sources=personalCalendarSources('cloud','rep-a',[],[],[project],[submission]);
  expect(sources.deals.map(d=>d.id)).toEqual([project.id]);
  expect(sources.activities.map(a=>a.id)).toEqual([submission.id]);
  const quotes=buildSalesQuoteRegistry([],sources.activities,sources.deals);
  expect(quotes).toMatchObject([{source:'external',projectId:'unassigned',
   id:'external:outside-a',sentDate:'2026-11-12',value:81000}]);
  const badge=buildCalendarBadgeIndex([],[],sources.activities,[],[],
   DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(metricCount(badge,'2026-11-12','quotes-sent')).toBe(1);
  const opened=homeCalendarBadgeEntries('quotes-sent','2026-11-12',[],[],
   sources.activities,[],[],DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(opened).toMatchObject([{kind:'activity',id:'outside-a'}]);
 });
 it('keeps explicit Deal assignments ahead of outside-submission author inference',()=>{
  const project=deal('assigned','rep-b'),submission=external('outside-b',project.id);
  const author=personalCalendarSources('cloud','rep-a',[],[],[project],[submission]);
  expect(author.deals).toEqual([]);
  // The author still owns the factual Activity; this is not an invitation to
  // take over someone else's current bid deadline.
  expect(author.activities.map(a=>a.id)).toEqual(['outside-b']);
  const assigned=personalCalendarSources('cloud','rep-b',[],[],[project],[submission]);
  expect(assigned.deals.map(d=>d.id)).toEqual(['assigned']);
  expect(assigned.activities.map(a=>a.id)).toEqual(['outside-b']);
  expect(personalCalendarSources('cloud','stranger',[],[],[project],[submission]))
   .toEqual({deals:[],activities:[]});
 });
 it('requires a marked external submission before extending the personal Deal list',()=>{
  const project=deal('unassigned'),notSubmitted:Activity={
   ...external('issued-only',project.id),
   metadata:{source:'quote',recordedByUserId:'rep-a'},
  };
  const sources=personalCalendarSources('cloud','rep-a',[],[],[project],
   [notSubmitted]);
  expect(sources.deals).toEqual([]);
  expect(buildSalesQuoteRegistry([],sources.activities,[project])).toEqual([]);
 });
 it('reconciles a later unconfirmed Task edit with durable CRM proof on refresh',()=>{
  const project=deal('shared'),submission=external('outside-shared',project.id);
  const remote=task('auto-task',project.id,{
   status:'completed',submissionConfirmedAt:deliveredAt,completedAt:deliveredAt,
   updatedAt:deliveredAt,
  });
  const stale=task('auto-task',project.id,{
   updatedAt:later,title:'Newer Task notes',dueDate:'2026-11-19',
  });
  const merged=mergePrivateTasks([stale],[remote]);
  expect(merged).toMatchObject([{status:'open',submissionConfirmedAt:deliveredAt,
   title:'Newer Task notes',dueDate:'2026-11-19'}]);
  usePersonalTaskStore.getState().receiveCloud(scope,merged);
  for(const id of confirmedBidSubmissionDealIds([submission]))
   usePersonalTaskStore.getState().completeDealSubmissionTasks(id);
  const restored=usePersonalTaskStore.getState().tasks;
  expect(restored).toMatchObject([{status:'completed',submissionConfirmedAt:deliveredAt,
   title:'Newer Task notes',dueDate:'2026-11-19'}]);
  const sources=personalCalendarSources('cloud','rep-a',[],restored,[project],[submission]);
  const agenda=buildSalesCalendarEvents(restored,sources.deals,sources.activities,[]);
  expect(agenda.filter(e=>e.kind==='bid'||e.kind==='task')).toEqual([]);
  expect(buildSalesQuoteRegistry([],sources.activities,sources.deals))
   .toMatchObject([{id:'external:outside-shared'}]);
  expect(recentHomeItems(restored,sources.activities,[],scope).some(x=>
   x.kind==='completed-task'&&x.recordId==='auto-task')).toBe(true);
 });
 it('shows external corrections as recently updated without creating a second Quote',()=>{
  const project=deal('corrected'),record=external('outside-corrected',project.id);
  const corrected:Activity={...record,metadata:{...record.metadata,
   editedAt:'2026-11-13T19:00:00.000Z',bidSentDate:'2026-11-11',amount:92000}};
  const registry=buildSalesQuoteRegistry([], [corrected],[project]);
  expect(registry).toMatchObject([{id:'external:outside-corrected',
   value:92000,sentDate:'2026-11-11',
   updatedAt:'2026-11-13T19:00:00.000Z'}]);
  const home=homeRecentQuoteEntries([], [corrected]);
  expect(home).toMatchObject([{id:'external:outside-corrected',
   timestamp:registry[0].updatedAt}]);
  const recent=recentHomeItems([],[corrected],[],null);
  expect(recent[0].timestamp).toBe(registry[0].updatedAt);
  // Correcting the send date moves the historical sent badge but does not
  // duplicate the Activity identity or manufacture a SalesShop quote.
  // A mixed stale+corrected cache must select the later correction even
  // when the stale copy is encountered first during cloud rehydration.
  expect(buildSalesQuoteRegistry([],[record,corrected],[project]))
   .toMatchObject([{id:'external:outside-corrected',value:92000,
    sentDate:'2026-11-11'}]);
  expect(homeRecentQuoteEntries([],[record,corrected]))
   .toMatchObject([{timestamp:'2026-11-13T19:00:00.000Z'}]);
  expect(recentHomeItems([],[record,corrected],[],null)).toHaveLength(1);
  const badges=buildCalendarBadgeIndex([],[],[record,corrected],[],[],
   DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(metricCount(badges,'2026-11-11','quotes-sent')).toBe(1);
  expect(metricCount(badges,'2026-11-12','quotes-sent')).toBe(0);
  expect(buildSalesQuoteRegistry([],[corrected,corrected],[project])).toHaveLength(1);
 });
 it('keeps a native delivery and an external submission separate after duplicate cache rehydrate',()=>{
  const project=deal('shared'),submission=external('outside-shared',project.id);
  const quote=native(project.id);
  const delivery:Activity={...submission,id:'native-delivery',
   quoteId:quote.id,metadata:{source:'manual',revision:0,deliveryConfirmed:true},
  };
  const sources=personalCalendarSources('cloud','rep-a',[quote],[],[project],
   [submission,{...submission,metadata:{...submission.metadata}},delivery]);
  expect(sources.activities).toHaveLength(2);
  const records=buildSalesQuoteRegistry([quote],sources.activities,sources.deals);
  expect(records.map(r=>r.source).sort()).toEqual(['external','salesshop']);
  expect(mySalesQuoteRegistry(records,'cloud','rep-a',sources.deals)).toHaveLength(2);
  const badges=buildCalendarBadgeIndex([],[],sources.activities,[],[],
   DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(metricCount(badges,'2026-11-12','quotes-sent')).toBe(2);
 });
});
