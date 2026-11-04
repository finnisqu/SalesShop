import {describe,expect,it} from 'vitest';
import type {NotebookEntry,PostItObject} from '../types/notebook';
import {homeNotes,homeNoteTitle,homeNoteSummary} from './homeNotes';

const post=(id:string,text:string,updatedAt:string):PostItObject=>({
 id,type:'post-it',text,tone:'yellow',x:0,y:0,width:25,height:15,
 rotation:0,zIndex:1,createdAt:'2026-11-01T12:00:00Z',updatedAt,
});
const entry=(isPostItInbox:boolean,objects:PostItObject[]):NotebookEntry=>({
 id:isPostItInbox?'inbox':'normal',title:'Post-its',isPostItInbox,
 objects,strokes:[],contentHtml:'',paperStyle:'blank',tone:'cream',
 texture:'classic',favorite:false,openAtStart:false,hidden:false,
 deletionLocked:true,createdAt:'2026-11-01T12:00:00Z',
 updatedAt:'2026-11-01T12:00:00Z',
});
describe('Home Notes backed by the private Notebook inbox',()=>{
 it('shows inbox notes, not unrelated Notebook-page objects',()=>{
  const items=homeNotes([
   entry(true,[post('a',"Aaron's birthday",'2026-11-01T12:00:00Z')]),
   entry(false,[post('b','Draft on regular page','2026-11-02T12:00:00Z')]),
  ]);
  expect(items.map(item=>item.objectId)).toEqual(['a']);
  expect(items[0].entryId).toBe('inbox');
 });
 it('sorts notes by most recently edited without changing source objects',()=>{
  const notes=homeNotes([entry(true,[
   post('early','Earlier','2026-11-02T12:00:00Z'),
   post('late','Later','2026-11-04T12:00:00Z'),
  ])]);
  expect(notes.map(note=>note.text)).toEqual(['Later','Earlier']);
 });
 it('uses the first meaningful line as the Task suggestion and list title',()=>{
  const text="\n Aaron's birthday\n Send him a birthday message\n";
  expect(homeNoteTitle(text)).toBe("Aaron's birthday");
  expect(homeNoteSummary(text)).toBe('Send him a birthday message');
  expect(homeNoteTitle('')).toBe('Untitled note');
  expect(homeNoteSummary("Aaron's birthday")).toBe('');
 });
});
