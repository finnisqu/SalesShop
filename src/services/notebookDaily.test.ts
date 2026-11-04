import {describe,expect,it} from 'vitest';
import type {NotebookEntry,NotebookAgendaItem} from '../types/notebook';
import {dailyNotebookPages,notebookPlainText,notebookCalendarDates,agendaOccurrence,agendaTitle}
 from './notebookDaily';
const page=(id:string,dailyDate?:string):NotebookEntry=>({
 id,title:'Daily Notes',dailyDate,contentHtml:'<p>Aaron &amp; Bryant</p><p>Send a message</p>',
 strokes:[],objects:[],paperStyle:'lined',tone:'cream',texture:'classic',
 favorite:false,openAtStart:false,hidden:false,deletionLocked:false,
 createdAt:'2026-11-04T10:00:00Z',updatedAt:'2026-11-04T12:00:00Z',
});
const calendar=(id:string,date:string,annual=false):NotebookAgendaItem=>({
 id,kind:'calendar-date',title:"Aaron's birthday",date,sourceText:'Aaron',
 annual,createdAt:'2026-11-04T10:00:00Z',updatedAt:'2026-11-04T10:00:00Z',
});
describe('Daily Notebook Home helpers',()=>{
 it('shows only dated pages in most recent day order',()=>{
  expect(dailyNotebookPages([page('ordinary'),page('earlier','2026-11-03'),
    page('today','2026-11-04')]).map(x=>x.id)).toEqual(['today','earlier']);
 });
 it('shows readable text without exposing source markup',()=>{
  expect(notebookPlainText('<p>Aaron &amp; Bryant</p><p>Send a message</p>'))
   .toBe('Aaron & Bryant\nSend a message');
  expect(agendaTitle(' Aaron\n birthday soon ')).toBe('Aaron');
 });
 it('finds private calendar dates independently from pending Tasks',()=>{
  const a={...page('daily','2026-11-04'),agendaItems:[
   calendar('birthday','2026-12-12',true),
   {...calendar('task','2026-12-13'),kind:'task' as const,taskId:'task-1'},
  ]};
  expect(notebookCalendarDates([a],'2026-12-12')).toHaveLength(1);
  expect(notebookCalendarDates([a],'2027-12-12')).toHaveLength(1);
  expect(notebookCalendarDates([a],'2026-12-13')).toHaveLength(0);
 });
 it('does not move leap-day birthdays to March 1 on non-leap years',()=>{
  const leap=calendar('leap','2028-02-29',true);
  expect(agendaOccurrence(leap,2028)).toBe('2028-02-29');
  expect(agendaOccurrence(leap,2029)).toBe('');
 });
});
