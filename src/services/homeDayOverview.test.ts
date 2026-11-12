import {describe,expect,it} from 'vitest';
import type {Activity,Company,Contact,Project} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import type {Quote} from '../types/quote';
import type {NotebookEntry} from '../types/notebook';
import type {SalesCalendarEvent} from './salesCalendar';
import {homeAgendaExtras,homeDayOverview,type HomeDaySources} from './homeDayOverview';

const day='2026-11-06';
const noon=day+'T12:00:00';
const empty=():HomeDaySources=>({
 events:[],tasks:[],activities:[],quotes:[],deals:[],
 companies:[],contacts:[],notebook:[],
});
const task=(id:string,changes:Partial<PersonalTask>={}):PersonalTask=>({
 id,title:id,createdAt:'2026-11-04T12:00:00',updatedAt:noon,
 status:'open',...changes,
});
const event=(id:string,kind:SalesCalendarEvent['kind'],date=day):SalesCalendarEvent=>({
 id,kind,date,title:id,detail:'',recordType:kind==='bid'?'project':'task',
 recordId:kind==='bid'?'deal-1':'task-1',
});
const activity=(id:string,type:Activity['type'],changes:Partial<Activity>={}):Activity=>({
 id,type,summary:id,occurredAt:noon,...changes,
});
const company=(id:string,kind:Company['kind']):Company=>({
 id,kind,name:id,createdAt:noon,updatedAt:noon,
});
const person=(id:string,companyId?:string):Contact=>({
 id,companyId,name:id,createdAt:noon,updatedAt:noon,
});
const quote=(id:string,changes:Partial<Quote>={}):Quote=>({
 id,title:id,createdAt:noon,updatedAt:noon,quoteNumber:id,
 ...changes,
} as Quote);
const deal=(id:string):Project=>({
 id,name:id,stage:'Discovery',createdAt:noon,updatedAt:noon,
});
const group=(sources:HomeDaySources,key:string,when=day)=>
 homeDayOverview(when,sources).find(item=>item.key===key);

describe('Home selected-day record navigation',()=>{
 it('includes scheduled tasks and bids on future dates',()=>{
  const future='2026-11-15';
  const data={...empty(),events:[event('due-task','task',future),event('due-bid','bid',future)]};
  expect(group(data,'tasks-due',future)?.entries).toMatchObject([
   {kind:'task',id:'task-1',title:'due-task'},
  ]);
  expect(group(data,'bids-due',future)?.entries).toMatchObject([
   {kind:'deal',id:'deal-1',title:'due-bid'},
  ]);
  expect(homeDayOverview(day,data)).toEqual([]);
 });
 it('retains the original due day for tasks completed later',()=>{
  const data={...empty(),tasks:[task('historical',{
   status:'completed',dueDate:day,completedAt:'2026-11-08T12:00:00',
  })]};
  expect(group(data,'tasks-due')?.entries[0]).toMatchObject({
   kind:'task',id:'historical',detail:'Completed · original due date',
  });
  expect(group(data,'tasks-completed')).toBeUndefined();
  expect(group(data,'tasks-completed','2026-11-08')?.entries[0].id).toBe('historical');
 });
 it('shows tasks completed on the selected day, not just the original due date',()=>{
  const data={...empty(),tasks:[
   task('finished',{status:'completed',completedAt:noon,dueDate:'2026-11-02'}),
   task('still-open',{dueDate:day}),
  ]};
  expect(group(data,'tasks-completed')?.entries.map(x=>x.id)).toEqual(['finished']);
  expect(group(data,'tasks-created')).toBeUndefined();
 });
 it('shows logged interactions and externally submitted quotes on their actual dates',()=>{
  const data={...empty(),activities:[
   activity('call','manual-touchpoint',{metadata:{interactionMethod:'call'}}),
   activity('email','notebook-touchpoint',{metadata:{interactionMethod:'email'}}),
   activity('sent','quote-sent',{occurredAt:'2026-11-07T12:00:00',
    projectId:'deal-1',metadata:{externalQuoteSent:true,bidSentDate:day}}),
  ]};
  expect(group(data,'activities')?.entries.map(x=>x.id)).toEqual(['call','email']);
  expect(group(data,'quotes-sent')?.entries[0]).toMatchObject({
   kind:'activity',id:'sent',detail:'Sent outside SalesShop',
  });
  expect(group(data,'quotes-sent','2026-11-07')).toBeUndefined();
 });
 it('falls back to native quote sentAt without duplicating matching quote activity',()=>{
  const data={...empty(),quotes:[
   quote('quote-1',{sentAt:noon}),quote('quote-2',{sentAt:noon}),
  ],activities:[activity('sent-event','quote-sent',{quoteId:'quote-1'})]};
  expect(group(data,'quotes-sent')?.entries).toHaveLength(2);
  expect(group(data,'quotes-sent')?.entries.map(x=>x.id).sort()).toEqual(['quote-1','quote-2']);
  expect(group(data,'quotes-created')?.entries).toHaveLength(2);
 });
 it('preserves date-only timestamps in local time instead of shifting a day',()=>{
  const data={...empty(),quotes:[quote('quote-1',{
   createdAt:'2026-11-06',sentAt:'2026-11-06',
  })]};
  expect(group(data,'quotes-created')?.entries[0].id).toBe('quote-1');
  expect(group(data,'quotes-sent')?.entries[0].id).toBe('quote-1');
 });
 it('links people, customer companies, and deals created that day',()=>{
  const data={...empty(),
   contacts:[person('customer-person','customer'),person('vendor-person','vendor'),person('prospect')],
   companies:[company('customer','customer'),company('vendor','non-customer')],
   deals:[deal('new-deal')],
  };
  expect(group(data,'people')?.entries.map(x=>x.id).sort()).toEqual(['customer-person','prospect']);
  expect(group(data,'companies')?.entries.map(x=>x.id)).toEqual(['customer']);
  expect(group(data,'deals-created')?.entries[0]).toMatchObject({kind:'deal',id:'new-deal'});
 });
 it('links daily Notebook pages and future calendar entries to their original pages',()=>{
  const data={...empty(),notebook:[{
   id:'page-1',title:'Friday notes',dailyDate:day,contentHtml:'',
   agendaItems:[{id:'agenda-1',kind:'calendar-date',date:day,title:'Site visit',time:'10:00'}],
  } as NotebookEntry]};
  expect(group(data,'notebook-pages')?.entries[0]).toMatchObject({kind:'note',id:'page-1'});
  expect(group(data,'notebook-dates')?.entries[0]).toMatchObject({
   kind:'calendar-date',id:'page-1',itemId:'agenda-1',
  });
 });
 it('keeps On this day disclosures separate from pending agenda and notebook date rows',()=>{
  const data={...empty(),
   events:[event('pending','task'),event('bid-due','bid')],
   tasks:[task('historical',{status:'completed',dueDate:day,
    completedAt:'2026-11-08T12:00:00'})],
   activities:[activity('call','manual-touchpoint',{metadata:{interactionMethod:'call'}})],
   notebook:[{id:'page-1',title:'Friday notes',dailyDate:day,contentHtml:'',
    agendaItems:[{id:'agenda-1',kind:'calendar-date',date:day,title:'Site visit'}],
   } as NotebookEntry],
  };
  const extras=homeAgendaExtras(homeDayOverview(day,data));
  expect(extras.some(group=>group.key==='bids-due')).toBe(false);
  expect(extras.some(group=>group.key==='notebook-dates')).toBe(false);
  // Even completed historical tasks with an original due date are excluded:
  // the selected-day Agenda owns due work, not the On this day history.
  expect(extras.some(group=>group.key==='tasks-due')).toBe(false);
  expect(extras.find(group=>group.key==='activities')?.entries.map(x=>x.id)).toEqual(['call']);
  expect(extras.find(group=>group.key==='notebook-pages')?.entries[0].id).toBe('page-1');
  expect(homeAgendaExtras(homeDayOverview('2026-11-20',data))).toEqual([]);
 });
 it('never repeats Tasks due in On this day, even if the day only has pending work',()=>{
  const data={...empty(),events:[event('pending','task')],
   tasks:[task('due-today',{dueDate:day})]};
  expect(homeDayOverview(day,data).some(group=>group.key==='tasks-due')).toBe(true);
  expect(homeAgendaExtras(homeDayOverview(day,data))).toEqual([]);
 });

});
