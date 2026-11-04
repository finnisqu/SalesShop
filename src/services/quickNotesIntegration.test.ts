import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const notes=read('src/components/GlobalPostIt.tsx');
const home=read('src/components/HomeWorkspace.tsx');
const calendar=read('src/components/SalesCalendarLauncher.tsx');
const noteHost=read('src/components/HomeNoteModalHost.tsx');
const app=read('src/App.tsx');
describe('Notebook-backed HOME notes contract',()=>{
 it('uses saved daily Notebook captures without adding old Post-its to HOME',()=>{
  expect(home).toContain('<SalesCalendarLauncher embedded />');
  expect(calendar).toContain("createFromSidecar('note')");
  expect(noteHost).toContain('append(targetDate,value)');
  expect(noteHost).toContain("entry?.id??'today'");
  expect(app).toContain('<HomeNoteModalHost/>');
 });
 it('preserves the legacy Post-it editor handoff in Notebook',()=>{
  expect(notes).toContain("newQuickNoteEvent = 'sales-shop:new-quick-note'");
  expect(notes).toContain('useNotebookStore.getState().createGlobalPostIt()');
  expect(notes).toContain('updateTextObject(selected.entryId,selected.object.id,event.target.value)');
  expect(notes).toContain("setView('notebook')");
  expect(notes).toContain('selectEntry(selected.entryId)');
  expect(notes).toContain('per-user Notebook document');
  expect(app).toContain('<GlobalPostItLayer />');
 });
});
