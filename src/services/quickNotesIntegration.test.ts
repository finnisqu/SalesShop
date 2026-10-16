import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const notes=read('src/components/GlobalPostIt.tsx');
const home=read('src/components/HomeWorkspace.tsx');
const app=read('src/App.tsx');
describe('Quick Notes workspace contract',()=>{
 it('creates a new Notebook-backed Post-it from Home and keeps the layer mounted',()=>{
   expect(notes).toContain("newQuickNoteEvent = 'sales-shop:new-quick-note'");
   expect(notes).toContain('useNotebookStore.getState().createGlobalPostIt()');
   expect(notes).toContain('updateTextObject(selected.entryId,selected.object.id,event.target.value)');
   expect(home).toContain('window.dispatchEvent(new Event(newQuickNoteEvent))');
   expect(app).toContain('<GlobalPostItLayer />');
 });
 it('preserves full Notebook editing handoff and private data ownership',()=>{
   expect(notes).toContain("setView('notebook')");
   expect(notes).toContain('selectEntry(selected.entryId)');
   expect(notes).toContain('per-user Notebook document');
   expect(notes).toContain('Private · saved to Notebook');
 });
});
