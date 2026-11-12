import {beforeEach,describe,expect,it,vi} from 'vitest';
import {useNotebookStore} from './notebookStore';
import {notebookCalendarDates} from '../services/notebookDaily';
import type {NotebookEntry} from '../types/notebook';

vi.mock('../data/notebookRepository',()=>({
 localNotebookRepository:{load:vi.fn(()=>null),save:vi.fn()},
}));

const page=():NotebookEntry=>({
 id:'ordinary-page',title:'My Notebook',contentHtml:'<p>Notes</p>',
 strokes:[],objects:[],paperStyle:'lined',tone:'cream',texture:'classic',
 favorite:false,openAtStart:false,hidden:false,deletionLocked:false,
 createdAt:'2026-11-01T12:00:00.000Z',updatedAt:'2026-11-01T12:00:00.000Z',
});

describe('Home agenda calendar entries without Notebook navigation',()=>{
 beforeEach(()=>{
  useNotebookStore.setState({entries:[page()],activeEntryId:'ordinary-page',
   folders:[],trashedEntries:[],hydrated:true});
 });
 it('creates nothing until a valid title and date are actually saved',()=>{
  const store=useNotebookStore.getState();
  expect(store.addStandaloneCalendarDate({title:'',date:'2026-11-12'})).toBeNull();
  expect(store.addStandaloneCalendarDate({title:'Reminder',date:'2026-02-31'})).toBeNull();
  expect(useNotebookStore.getState().entries).toHaveLength(1);
 });
 it('saves and edits a private calendar entry without switching Notebook pages',()=>{
  const saved=useNotebookStore.getState().addStandaloneCalendarDate({
   title:'Site walk',date:'2026-11-14',time:'09:30',
  });
  expect(saved?.entryId).toBe('page_calendar_inbox');
  expect(useNotebookStore.getState().activeEntryId).toBe('ordinary-page');
  const entries=useNotebookStore.getState().entries;
  const inbox=entries.find(e=>e.isCalendarInbox);
  expect(inbox).toMatchObject({hidden:true,deletionLocked:true,title:'Calendar'});
  expect(notebookCalendarDates(entries,'2026-11-14')[0]?.item)
   .toMatchObject({title:'Site walk',time:'09:30',date:'2026-11-14',kind:'calendar-date'});
  useNotebookStore.getState().updateAgendaItem(saved!.entryId,saved!.itemId,{
   title:'Revised walk',date:'2026-11-15',
  });
  expect(notebookCalendarDates(useNotebookStore.getState().entries,'2026-11-15')[0]?.item.title)
   .toBe('Revised walk');
  useNotebookStore.getState().deleteAgendaItem(saved!.entryId,saved!.itemId);
  expect(notebookCalendarDates(useNotebookStore.getState().entries,'2026-11-15')).toHaveLength(0);
 });
 it('reuses one calendar inbox and supports yearly dates without creating Tasks',()=>{
  const a=useNotebookStore.getState().addStandaloneCalendarDate({
   title:'Anniversary',date:'2026-11-12',annual:true,
  });
  const b=useNotebookStore.getState().addStandaloneCalendarDate({
   title:'Client lunch',date:'2026-11-12',
  });
  expect(a?.entryId).toBe(b?.entryId);
  expect(useNotebookStore.getState().entries.filter(e=>e.isCalendarInbox)).toHaveLength(1);
  expect(notebookCalendarDates(useNotebookStore.getState().entries,'2027-11-12')
   .map(item=>item.item.title)).toEqual(['Anniversary']);
 });
});
