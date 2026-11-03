import {describe,expect,it} from 'vitest';
import type {Activity,Project} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import type {Quote} from '../types/quote';
import {buildSalesCalendarEvents,calendarDayCounts,calendarMonthDays,isoLocalDay,localDateKey} from './salesCalendar';
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
