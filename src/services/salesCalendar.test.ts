import {describe,expect,it} from 'vitest';
import type {Activity,Project} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import type {Quote} from '../types/quote';
import {buildSalesCalendarEvents,calendarDayCounts,calendarMonthDays,isoLocalDay,localDateKey} from './salesCalendar';
const task=(id:string,dueDate?:string,extra:Partial<PersonalTask>={})=>({
 id,title:'Task '+id,dueDate,status:'open',createdAt:'2026-11-01T12:00:00Z',
 updatedAt:'2026-11-01T12:00:00Z',...extra,
}) as PersonalTask;
const deal=(bidDueDate:string):Project=>({
 id:'d1',name:'Riverwalk Apartments',stage:'Intent to Bid',bidDueDate,
 createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',
});
const quote=(id:string):Quote=>({
 id,title:'Bid '+id,ownerUserId:'u1',revision:0,status:'Sent',
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
   recordType:'activity',recordId:'call',kind:'activity'});
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
   activity('delivery','quote-sent','2026-10-31T12:00:00Z',{
    source:'manual',deliveryConfirmed:true,revision:0},{quoteId:'q1'}),
   activity('old','quote-follow-up','2026-11-01T12:00:00Z',{
    revision:0,followUpAction:'scheduled',followUpDueDate:'2026-11-08'},{quoteId:'q1'}),
   activity('new','quote-follow-up','2026-11-02T12:00:00Z',{
    revision:0,followUpAction:'scheduled',followUpDueDate:'2026-11-09'},{quoteId:'q1'}),
   activity('private','manual-touchpoint','2026-11-03T12:00:00Z',{
    interactionMethod:'text'},{quoteId:'q2',projectId:'d1'}),
  ];
  const onlyMine=buildSalesCalendarEvents([],[],activities,[quote('q1')]);
  expect(onlyMine.map(e=>e.date)).toEqual(['2026-11-09']);
  expect(onlyMine[0]).toMatchObject({recordType:'quote',recordId:'q1'});
  expect(buildSalesCalendarEvents([],[],[
   ...activities,activity('clear','quote-follow-up','2026-11-04T12:00:00Z',{
    revision:0,followUpAction:'cleared'},{quoteId:'q1'})],[quote('q1')])).toHaveLength(0);
 });
 it('never shows a reminder from a different revision or a completed quote',()=>{
  const events=[
   activity('delivered','quote-sent','2026-10-28T12:00:00Z',
    {source:'manual',deliveryConfirmed:true,revision:1},{quoteId:'q1'}),
   activity('old','quote-follow-up','2026-10-29T12:00:00Z',
    {revision:0,followUpAction:'scheduled',followUpDueDate:'2026-11-12'},{quoteId:'q1'}),
  ];
  expect(buildSalesCalendarEvents([],[],events,[{...quote('q1'),revision:1}])).toHaveLength(0);
  expect(buildSalesCalendarEvents([],[],events,[{...quote('q1'),revision:1,status:'Signed'}])).toHaveLength(0);
 });
 it('preserves due times for chronological agenda ordering',()=>{
  const tasks=[task('late','2026-11-03',{dueTime:'16:30'}),
   task('early','2026-11-03',{dueTime:'09:00'})];
  expect(buildSalesCalendarEvents(tasks,[],[],[]).map(e=>e.recordId)).toEqual(['early','late']);
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
