import {describe,expect,it} from 'vitest';
import type {Activity,Company,Contact} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import type {SalesCalendarEvent} from './salesCalendar';
import {buildCalendarBadgeIndex,metricCount} from './homeCalendarBadges';
import {DEFAULT_HOME_CALENDAR_SETTINGS,homeCalendarScope,
 readHomeCalendarSettings,saveHomeCalendarSettings,type HomeCalendarSettings}
 from '../store/homeCalendarSettings';

const day='2026-11-05';
const timestamp=day+'T12:00:00';
const pending:SalesCalendarEvent[]=[
 {id:'t1',date:day,kind:'task',title:'Follow up',detail:'',
  recordType:'task',recordId:'t1',urgent:true},
 {id:'b1',date:day,kind:'bid',title:'Submit bid',detail:'',
  recordType:'project',recordId:'p1'},
];
const task=(id:string,status:PersonalTask['status']='open'):PersonalTask=>({
 id,title:'Task '+id,dueDate:day,status,
 createdAt:timestamp,updatedAt:timestamp,
 completedAt:status==='completed'?timestamp:undefined,
});
const activity=(type:Activity['type'],id:string,method?:NonNullable<Activity['metadata']>['interactionMethod']):Activity=>({
 id,type,occurredAt:timestamp,summary:id,metadata:{interactionMethod:method},
});
const company=(id:string,kind:Company['kind']):Company=>({
 id,name:id,kind,createdAt:timestamp,updatedAt:timestamp,
});
const contact=(id:string,companyId?:string):Contact=>({
 id,name:id,companyId,createdAt:timestamp,updatedAt:timestamp,
});

describe('Home calendar custom badges',()=>{
 it('offers four independent slots and isolates saved settings by user/workspace',()=>{
  const one=homeCalendarScope('cloud','company-1','person-1');
  const two=homeCalendarScope('cloud','company-1','person-2');
  expect(one).not.toBe(two);
  expect(DEFAULT_HOME_CALENDAR_SETTINGS.slots).toHaveLength(4);
  const custom:HomeCalendarSettings={...DEFAULT_HOME_CALENDAR_SETTINGS,
   countDownCompletedTasks:false};
  saveHomeCalendarSettings(one,custom);
  expect(readHomeCalendarSettings(one).countDownCompletedTasks).toBe(false);
  expect(readHomeCalendarSettings(two).countDownCompletedTasks).toBe(true);
 });
 it('keeps live due work separate from logged history metrics',()=>{
  const history=[
   activity('manual-touchpoint','call','call'),
   activity('manual-touchpoint','email','email'),
   activity('manual-touchpoint','text','text'),
   activity('notebook-touchpoint','meeting','in-person'),
   activity('quote-sent','quote'),
  ];
  const index=buildCalendarBadgeIndex(pending,[task('t1')],history,
   [company('customer','customer'),company('vendor','non-customer')],
   [contact('prospect'),contact('customer-person','customer'),contact('vendor-person','vendor')],
   DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(metricCount(index,day,'tasks')).toBe(1);
  expect(metricCount(index,day,'bid-due')).toBe(1);
  expect(metricCount(index,day,'due-dates')).toBe(2);
  expect(metricCount(index,day,'activities')).toBe(4);
  expect(metricCount(index,day,'calls')).toBe(1);
  expect(metricCount(index,day,'emails')).toBe(1);
  expect(metricCount(index,day,'texts')).toBe(1);
  expect(metricCount(index,day,'meetings')).toBe(1);
  expect(metricCount(index,day,'quotes-sent')).toBe(1);
  expect(metricCount(index,day,'companies-created')).toBe(1);
  expect(metricCount(index,day,'people-created')).toBe(2);
 });
 it('keeps completed tasks off the agenda, with configurable historic counts',()=>{
  const finished=task('finished','completed');
  const live=buildCalendarBadgeIndex(pending,[finished],[],[],[],
   DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(metricCount(live,day,'tasks')).toBe(1);
  const retained=buildCalendarBadgeIndex(pending,[finished],[],[],[],
   {...DEFAULT_HOME_CALENDAR_SETTINGS,countDownCompletedTasks:false});
  expect(metricCount(retained,day,'tasks')).toBe(2);
  expect(metricCount(retained,day,'due-dates')).toBe(3);
 });
 it('uses the recorded sent date for external quotes, not the logging date',()=>{
  const external:Activity={
   id:'external',type:'quote-sent',summary:'External quote sent',
   occurredAt:'2026-11-06T12:00:00',
   metadata:{externalQuoteSent:true,bidSentDate:day,amount:100000},
  };
  const index=buildCalendarBadgeIndex([],[],[external],[],[],
   DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(metricCount(index,day,'quotes-sent')).toBe(1);
  expect(metricCount(index,'2026-11-06','quotes-sent')).toBe(0);
 });
});
