import {describe,expect,it} from 'vitest';
import type {Activity,Project} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import type {Quote} from '../types/quote';
import {buildSalesCalendarEvents,personalCalendarSources,calendarDayCounts,calendarMonthDays,calendarCompactMonthDays,calendarWeekDays,isoLocalDay,localDateKey} from './salesCalendar';
const task=(id:string,dueDate?:string,extra:Partial<PersonalTask>={})=>({
 id,title:'Task '+id,dueDate,status:'open',createdAt:'2026-11-01T12:00:00Z',
 updatedAt:'2026-11-01T12:00:00Z',...extra,
}) as PersonalTask;
const deal=(dueDate:string):Project=>({
 id:'d1',name:'Riverwalk Apartments',stage:'Intent to Bid',dueDate,
 createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',
});
const quote=(id:string):Quote=>({
 id,title:'Bid '+id,ownerUserId:'u1',
}) as unknown as Quote;
const activity=(id:string,type:Activity['type'],occurredAt:string,
 metadata?:Activity['metadata'],extra:Partial<Activity>={}):Activity=>({
 id,type,occurredAt,summary:'Spoke with builder',metadata,...extra,
});
describe('SalesShop shared Calendar',()=>{
 it('generates exactly six local-date rows with padding for month boundaries',()=>{
  const days=calendarMonthDays(2026,10);
  expect(days).toHaveLength(42);
  expect(days[0]).toBe('2026-11-01');
  expect(days[29]).toBe('2026-11-30');
  expect(days.at(-1)).toBe('2026-12-12');
  const feb=calendarMonthDays(2027,1);
  expect(feb).toHaveLength(42);
  expect(feb[0]).toBe('2027-01-31');
 });
 it('uses only four or five weeks when the Home month fits, without losing dates',()=>{
  const november=calendarCompactMonthDays(2026,10);
  expect(november).toHaveLength(35);
  expect(november.at(-1)).toBe('2026-12-05');
  const february=calendarCompactMonthDays(2026,1);
  expect(february).toHaveLength(28);
  expect(february.at(-1)).toBe('2026-02-28');
  expect(calendarCompactMonthDays(2026,7)).toHaveLength(42);
 });
 it('builds a seven-day week without UTC shifts at DST and month boundaries',()=>{
  expect(calendarWeekDays('2026-11-03')).toEqual([
   '2026-11-01','2026-11-02','2026-11-03','2026-11-04',
   '2026-11-05','2026-11-06','2026-11-07'
  ]);
  expect(calendarWeekDays('2026-03-08')).toEqual([
   '2026-03-08','2026-03-09','2026-03-10','2026-03-11',
   '2026-03-12','2026-03-13','2026-03-14'
  ]);
  expect(calendarWeekDays('2026-11-30').at(-1)).toBe('2026-12-05');
 });
 it('shows only authored or personally linked CRM dates on cloud Home',()=>{
  const ownQuote={...quote('q-own'),projectId:'mine'};
  const ownTask=task('mytask',undefined,{
   associations:[{type:'project',id:'linked'}],
  });
  const sharedDeals=[
   {...deal('2026-11-05'),id:'mine'},
   {...deal('2026-11-05'),id:'linked'},
   {...deal('2026-11-05'),id:'other'},
  ];
  const activityItems=[
   activity('authored','manual-touchpoint','2026-11-03T12:00:00Z',
    {recordedByUserId:'me'},{contactId:'person'}),
   activity('team','manual-touchpoint','2026-11-03T12:00:00Z',
    {recordedByUserId:'coworker'},{contactId:'other-person'}),
   activity('quote','manual-touchpoint','2026-11-03T12:00:00Z',
    undefined,{quoteId:'q-own'}),
   activity('unowned','manual-touchpoint','2026-11-03T12:00:00Z',
    undefined,{quoteId:'q-other'}),
  ];
  const cloud=personalCalendarSources('cloud','me',[ownQuote],[ownTask],sharedDeals,activityItems);
  expect(cloud.deals.map(d=>d.id)).toEqual(['mine','linked']);
  expect(cloud.activities.map(a=>a.id)).toEqual(['authored','quote']);
  expect(personalCalendarSources('cloud',undefined,[ownQuote],[ownTask],sharedDeals,activityItems))
   .toEqual({deals:[],activities:[]});
  expect(personalCalendarSources('local',undefined,[],[],sharedDeals,activityItems).deals).toHaveLength(3);
 });
 it('uses exactly one bid badge when a Deal has an automatic submission Task',()=>{
  const date='2026-11-12';
  const submission=task('task_deal_submit_d1',date,{
   title:'Submit quote · Riverwalk Apartments',
   sourceObjectId:'deal-submit:d1',
   linked:{type:'project',id:'d1'},
   priority:'urgent',
  });
  const events=buildSalesCalendarEvents([submission],[deal(date)],[],[]);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
   kind:'bid',recordType:'task',recordId:'task_deal_submit_d1',urgent:true,
  });
  expect(calendarDayCounts(events,date)).toMatchObject({bid:1,task:0,total:1,urgent:1});
 });
 it('recognizes a linked manual Submit Quote task as the sole bid badge',()=>{
  const due='2026-11-13';
  const existing=task('manual',due,{
   title:'Submit quote for Riverwalk',linked:{type:'project',id:'d1'},
   priority:'high',
  });
  const events=buildSalesCalendarEvents([existing],[deal(due)],[],[]);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({kind:'bid',recordType:'task',recordId:'manual'});
 });
 it('shows planned follow-up Tasks on their due dates apart from logged activities',()=>{
  const date='2026-11-06';
  const followUp=task('followup',date,{type:'follow-up',status:'open'});
  const events=buildSalesCalendarEvents([followUp],[],[
   activity('call','manual-touchpoint','2026-11-03T12:00:00',
    {interactionMethod:'call'}),
  ],[]);
  expect(calendarDayCounts(events,date)).toMatchObject({followUp:1,activity:0,total:1});
  expect(calendarDayCounts(events,'2026-11-03')).toMatchObject({activity:1,followUp:0});
 });
 it('includes scheduled tasks, bid due dates, and manually logged touchpoints',()=>{
  const date='2026-11-03';
  const events=buildSalesCalendarEvents(
   [task('a',date),task('b',date,{status:'completed'})],
   [deal(date)],
   [activity('call','manual-touchpoint',date+'T12:45:00',{
     interactionMethod:'video-call',notes:'Discussed schedule'}, {contactId:'c1'})],
   []
  );
  const counts=calendarDayCounts(events,date);
  expect(counts).toMatchObject({task:2,bid:1,activity:1,followUp:0,total:4});
  expect(events.find(x=>x.id==='activity:call')).toMatchObject({
   recordType:'contact',recordId:'c1',kind:'activity'});
  expect(events.find(x=>x.id==='activity:call')?.detail).toContain('Discussed schedule');
 });
 it('shows unlinked interactions in Activity History rather than dropping them',()=>{
  const result=buildSalesCalendarEvents([],[],[
   activity('unlinked','manual-touchpoint','2026-11-03T14:00:00', {interactionMethod:'email'})
  ],[]);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({recordType:'activity',recordId:'unlinked'});
 });
 it('shows only the latest active quote follow-up without private quote leakage',()=>{
  const activities=[
   activity('old','quote-follow-up','2026-11-01T12:00:00Z',{
    followUpAction:'scheduled',followUpDueDate:'2026-11-08'},{quoteId:'q1'}),
   activity('new','quote-follow-up','2026-11-02T12:00:00Z',{
    followUpAction:'scheduled',followUpDueDate:'2026-11-09'},{quoteId:'q1'}),
   activity('private','manual-touchpoint','2026-11-03T12:00:00Z',{
    interactionMethod:'text'},{quoteId:'q2',projectId:'d1'}),
  ];
  const onlyMine=buildSalesCalendarEvents([],[],activities,[quote('q1')]);
  expect(onlyMine.map(e=>e.date)).toEqual(['2026-11-09']);
  expect(onlyMine[0]).toMatchObject({recordType:'quote',recordId:'q1'});
  expect(buildSalesCalendarEvents([],[],[
   ...activities,activity('clear','quote-follow-up','2026-11-04T12:00:00Z',{
    followUpAction:'cleared'},{quoteId:'q1'})],[quote('q1')])).toHaveLength(0);
 });
 it('does not invent deadlines for anytime or canceled tasks',()=>{
  const items=buildSalesCalendarEvents([
   task('none'),task('canceled','2026-11-03',{status:'canceled'}),
   task('deleted','2026-11-03',{deletedAt:'2026-11-03T12:00:00Z'})
  ],[],[],[]);
  expect(items).toHaveLength(0);
 });
 it('uses local calendar-day semantics rather than UTC string truncation',()=>{
  const clock=new Date(2026,10,3,23,40);
  expect(isoLocalDay(clock.toISOString())).toBe(localDateKey(clock));
  expect(isoLocalDay('not-a-date')).toBeNull();
 });
});
