import {describe,expect,it} from 'vitest';
import type {Activity,Company,Contact} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import type {SalesCalendarEvent} from './salesCalendar';
import {DEFAULT_HOME_CALENDAR_SETTINGS} from '../store/homeCalendarSettings';
import {buildCalendarBadgeIndex,metricCount} from './homeCalendarBadges';
import {homeCalendarBadgeEntries} from './homeCalendarDrilldown';

const date='2026-11-06',when=date+'T12:00:00';
const activeEvents:SalesCalendarEvent[]=[
 {id:'task:one',date,kind:'task',recordType:'task',recordId:'one',title:'Call builder',detail:''},
 {id:'bid:deal',date,kind:'bid',recordType:'project',recordId:'deal',title:'Submit quote',detail:''},
];
const tasks:PersonalTask[]=[
 {id:'done',title:'Finished estimate',dueDate:date,status:'completed',
  createdAt:when,updatedAt:when,completedAt:when},
];
const activity=(id:string,type:Activity['type'],method?:NonNullable<Activity['metadata']>['interactionMethod']):Activity=>({
 id,type,occurredAt:when,summary:id,metadata:method?{interactionMethod:method}:{},
});
const history:Activity[]=[
 activity('call','manual-touchpoint','call'),activity('email','manual-touchpoint','email'),
 activity('meeting','notebook-touchpoint','in-person'),
 {id:'external',type:'quote-sent',occurredAt:'2026-11-07T10:00:00',
  summary:'External bid sent',projectId:'deal',
  metadata:{externalQuoteSent:true,bidSentDate:date,amount:120000}},
];
const companies:Company[]=[
 {id:'client',name:'Client',kind:'customer',createdAt:when,updatedAt:when},
 {id:'vendor',name:'Vendor',kind:'non-customer',createdAt:when,updatedAt:when},
];
const contacts:Contact[]=[
 {id:'person',name:'Customer Person',companyId:'client',createdAt:when,updatedAt:when},
 {id:'vendor-person',name:'Vendor Person',companyId:'vendor',createdAt:when,updatedAt:when},
];
const settings=DEFAULT_HOME_CALENDAR_SETTINGS;
const list=(metric:Parameters<typeof homeCalendarBadgeEntries>[0],prefs=settings)=>
 homeCalendarBadgeEntries(metric,date,activeEvents,tasks,history,companies,contacts,prefs);

describe('Home badge drilldowns',()=>{
 it('keeps badge drilldowns opt-in on phones and supports Home sections',()=>{
  expect(DEFAULT_HOME_CALENDAR_SETTINGS.clickableMobileBadges).toBe(false);
  expect(DEFAULT_HOME_CALENDAR_SETTINGS.defaultCalendarView).toBe('auto');
  expect(DEFAULT_HOME_CALENDAR_SETTINGS.sectionOrder).toEqual(['quickActions','calendar','recent']);
  expect(DEFAULT_HOME_CALENDAR_SETTINGS.visibleSections.calendar).toBe(true);
 });
 it('matches task and deadline event counts without inserting history in the agenda',()=>{
  expect(list('tasks').map(x=>x.id)).toEqual(['one']);
  expect(list('bid-due').map(x=>x.kind)).toEqual(['deal']);
  expect(list('due-dates')).toHaveLength(2);
  expect(list('activities')).toHaveLength(3);
 });
 it('respects the completed-task count toggle and navigates to the task record',()=>{
  expect(list('tasks',{...settings,countDownCompletedTasks:false}).map(x=>x.id)).toEqual(['one','done']);
  expect(list('due-dates',{...settings,countDownCompletedTasks:false})).toHaveLength(3);
 });
 it('opens history and external bids as their real Activity records',()=>{
  expect(list('calls')[0]).toMatchObject({kind:'activity',id:'call'});
  expect(list('emails')[0]).toMatchObject({kind:'activity',id:'email'});
  expect(list('meetings')[0]).toMatchObject({kind:'activity',id:'meeting'});
  expect(list('quotes-sent')[0]).toMatchObject({kind:'activity',id:'external'});
 });
 it('filters vendors from customer/prospect creation drilldowns',()=>{
  expect(list('companies-created')).toHaveLength(1);
  expect(list('people-created')).toHaveLength(1);
  expect(list('companies-created')[0]).toMatchObject({kind:'company',id:'client'});
  expect(list('people-created')[0]).toMatchObject({kind:'person',id:'person'});
 });
 it('returns the same number of records as the badge count for each metric',()=>{
  const idx=buildCalendarBadgeIndex(activeEvents,tasks,history,companies,contacts,settings);
  const metrics=['tasks','due-dates','bid-due','calls','emails','texts','meetings',
   'activities','quotes-sent','companies-created','people-created'] as const;
  for(const metric of metrics){
   expect(list(metric).length,metric).toBe(metricCount(idx,date,metric));
  }
 });
 it('preserves one badge and one details link with duplicated cloud cache records',()=>{
  const duplicates=[...history,history[3]];
  const badges=buildCalendarBadgeIndex(activeEvents,tasks,duplicates,companies,contacts,settings);
  const entries=homeCalendarBadgeEntries('quotes-sent',date,activeEvents,tasks,
   duplicates,companies,contacts,settings);
  expect(metricCount(badges,date,'quotes-sent')).toBe(1);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({kind:'activity',id:'external'});
 });
});
