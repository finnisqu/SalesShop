import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotebookDocument } from '../types/notebook';
import { useNotebookStore } from './notebookStore';

// Exercise the real Notebook store without touching a signed-in user's private cloud document.
const storage = vi.hoisted(() => ({ document: null as unknown }));
vi.mock('../data/notebookRepository', () => ({
  localNotebookRepository: {
    load: () => storage.document as NotebookDocument | null,
    save: (document: NotebookDocument) => { storage.document = structuredClone(document); },
  },
}));

describe('Notebook seven-day page recovery', () => {
  beforeEach(() => {
    storage.document = null;
    useNotebookStore.getState().hydrate();
  });

  it('starts new and duplicated pages unlocked while retaining the original content', () => {
    const store = useNotebookStore.getState();
    const first = store.entries[0];
    expect(first.deletionLocked).toBe(false);
    store.renameEntry(first.id, 'Kitchen measurement notes');
    store.updateContent(first.id, '<p>Countertop takeoff</p>');
    useNotebookStore.getState().duplicateEntry(first.id);
    const duplicate = useNotebookStore.getState().entries.find(entry => entry.id !== first.id);
    expect(duplicate?.deletionLocked).toBe(false);
    expect(duplicate?.contentHtml).toContain('Countertop takeoff');
  });

  it('moves a page to private trash, persists it, and restores it unchanged', () => {
    const store = useNotebookStore.getState();
    const first = store.entries[0];
    store.renameEntry(first.id, 'Confidential draft');
    store.updateContent(first.id, '<p>Internal note</p>');
    useNotebookStore.getState().deleteEntry(first.id);
    const deleted = useNotebookStore.getState();
    expect(deleted.entries.some(entry => entry.id === first.id)).toBe(false);
    expect(deleted.trashedEntries.map(item => item.entry.id)).toContain(first.id);
    expect((storage.document as NotebookDocument).trashedEntries?.[0].entry.id).toBe(first.id);

    deleted.hydrate();
    expect(useNotebookStore.getState().trashedEntries.some(item => item.entry.id === first.id)).toBe(true);
    useNotebookStore.getState().restoreEntry(first.id);
    const restored = useNotebookStore.getState();
    expect(restored.entries.find(entry => entry.id === first.id)?.contentHtml).toBe('<p>Internal note</p>');
    expect(restored.trashedEntries.some(item => item.entry.id === first.id)).toBe(false);
    expect(restored.activeEntryId).toBe(first.id);
  });

  it('never trashes locked pages and can undo a new deletion', () => {
    const first = useNotebookStore.getState().entries[0];
    useNotebookStore.getState().toggleDeletionLocked(first.id);
    expect(useNotebookStore.getState().entries.find(entry => entry.id === first.id)?.deletionLocked).toBe(true);
    useNotebookStore.getState().deleteEntry(first.id);
    expect(useNotebookStore.getState().trashedEntries).toHaveLength(0);
    useNotebookStore.getState().toggleDeletionLocked(first.id);
    useNotebookStore.getState().deleteEntry(first.id);
    expect(useNotebookStore.getState().trashedEntries).toHaveLength(1);
    useNotebookStore.getState().undo();
    expect(useNotebookStore.getState().entries.some(entry => entry.id === first.id)).toBe(true);
    expect(useNotebookStore.getState().trashedEntries).toHaveLength(0);
  });
});

describe('Global personal Post-it capture', () => {
  beforeEach(() => {
    storage.document = null;
    useNotebookStore.getState().hydrate();
  });

  it('creates a dedicated private collection without changing the active Notebook page', () => {
    const currentId = useNotebookStore.getState().activeEntryId;
    const id = useNotebookStore.getState().createGlobalPostIt();
    const state = useNotebookStore.getState();
    expect(state.activeEntryId).toBe(currentId);
    const inbox = state.entries.find(entry => entry.isPostItInbox);
    expect(inbox?.deletionLocked).toBe(true);
    expect(inbox?.title).toBe('Post-its');
    expect(inbox?.objects.find(item => item.id === id)?.type).toBe('post-it');
    state.updateTextObject(inbox!.id, id, 'Call about kitchen sink');
    state.hydrate();
    const saved = useNotebookStore.getState().entries.find(entry => entry.isPostItInbox);
    const persisted = saved?.objects.find(item => item.id === id);
    expect(persisted?.type).toBe('post-it');
    if (!persisted || persisted.type !== 'post-it') throw new Error('Post-it was not persisted');
    expect(persisted.text).toBe('Call about kitchen sink');
  });

  it('appends further quick notes to one collection rather than creating extra pages', () => {
    const before = useNotebookStore.getState().entries.length;
    const one = useNotebookStore.getState().createGlobalPostIt();
    const two = useNotebookStore.getState().createGlobalPostIt();
    const next = useNotebookStore.getState();
    expect(next.entries).toHaveLength(before + 1);
    const notes = next.entries.find(entry => entry.isPostItInbox)?.objects ?? [];
    expect(notes.map(item => item.id)).toEqual([one, two]);
  });
});

describe('Notebook 2.0 private folder organization', () => {
  beforeEach(() => {
    storage.document = null;
    useNotebookStore.getState().hydrate();
  });

  it('creates nested folders and files an existing page without replacing its content', () => {
    const id = useNotebookStore.getState().entries[0].id;
    useNotebookStore.getState().updateContent(id, '<p>Kitchen drawings are private</p>');
    const parent=useNotebookStore.getState().createFolder('Builders');
    const child=useNotebookStore.getState().createFolder('East Coast',parent);
    expect(useNotebookStore.getState().folders.find(folder=>folder.id===child)?.parentId).toBe(parent);
    useNotebookStore.getState().moveEntryToFolder(id,child);
    expect(useNotebookStore.getState().entries.find(entry=>entry.id===id)?.folderId).toBe(child);
    useNotebookStore.getState().hydrate();
    expect(useNotebookStore.getState().folders).toHaveLength(2);
    expect(useNotebookStore.getState().entries.find(entry=>entry.id===id)?.contentHtml)
      .toContain('Kitchen drawings are private');
    expect(useNotebookStore.getState().entries.find(entry=>entry.id===id)?.folderId).toBe(child);
  });

  it('removing a folder safely moves pages and subfolders up without deleting data', () => {
    const first=useNotebookStore.getState().entries[0];
    const parent=useNotebookStore.getState().createFolder('Projects');
    const sub=useNotebookStore.getState().createFolder('2026',parent);
    useNotebookStore.getState().moveEntryToFolder(first.id,parent);
    useNotebookStore.getState().removeFolder(parent);
    const after=useNotebookStore.getState();
    expect(after.entries.find(entry=>entry.id===first.id)?.folderId).toBeUndefined();
    expect(after.folders.find(folder=>folder.id===sub)?.parentId).toBeUndefined();
    expect(after.entries.some(entry=>entry.id===first.id)).toBe(true);
    after.undo();
    expect(useNotebookStore.getState().folders.some(folder=>folder.id===parent)).toBe(true);
    expect(useNotebookStore.getState().entries.find(entry=>entry.id===first.id)?.folderId).toBe(parent);
  });

  it('keeps recently deleted pages recoverable if their folder is removed', () => {
    const id=useNotebookStore.getState().entries[0].id;
    const folder=useNotebookStore.getState().createFolder('Private drafts');
    useNotebookStore.getState().moveEntryToFolder(id,folder);
    useNotebookStore.getState().deleteEntry(id);
    useNotebookStore.getState().removeFolder(folder);
    expect(useNotebookStore.getState().trashedEntries[0].entry.folderId).toBeUndefined();
    useNotebookStore.getState().restoreEntry(id);
    const restored=useNotebookStore.getState().entries.find(entry=>entry.id===id);
    expect(restored?.folderId).toBeUndefined();
    expect(restored?.id).toBe(id);
  });

  it('rejects invalid folder targets and creates new pages in a selected folder', () => {
    const original=useNotebookStore.getState().entries[0];
    useNotebookStore.getState().moveEntryToFolder(original.id,'not-a-folder');
    expect(useNotebookStore.getState().entries[0].folderId).toBeUndefined();
    const folder=useNotebookStore.getState().createFolder('My work');
    useNotebookStore.getState().createEntry(folder);
    expect(useNotebookStore.getState().entries[0].folderId).toBe(folder);
    expect(useNotebookStore.getState().entries[0].id).not.toBe(original.id);
  });

  it('undoes split-pane object edits on one page without rewinding another',()=>{
    const first=useNotebookStore.getState().entries[0].id;
    useNotebookStore.getState().createEntry();
    const second=useNotebookStore.getState().activeEntryId!;
    useNotebookStore.getState().createPostIt(first);
    useNotebookStore.getState().createPostIt(second);
    const both=useNotebookStore.getState();
    expect(both.entries.find(e=>e.id===first)?.objects).toHaveLength(1);
    expect(both.entries.find(e=>e.id===second)?.objects).toHaveLength(1);
    expect(both.canUndoEntry(first)).toBe(true);
    both.undoEntry(first);
    const after=useNotebookStore.getState();
    expect(after.entries.find(e=>e.id===first)?.objects).toHaveLength(0);
    expect(after.entries.find(e=>e.id===second)?.objects).toHaveLength(1);
    expect(after.canRedoEntry(first)).toBe(true);
    after.redoEntry(first);
    expect(useNotebookStore.getState().entries.find(e=>e.id===first)?.objects).toHaveLength(1);
  });

  it('keeps later text and metadata when undoing split-pane objects',()=>{
    const id=useNotebookStore.getState().entries[0].id;
    useNotebookStore.getState().createPostIt(id);
    useNotebookStore.getState().renameEntry(id,'Revised page');
    // A page-level structural/metadata change invalidates older object snapshots.
    expect(useNotebookStore.getState().canUndoEntry(id)).toBe(false);
    useNotebookStore.getState().createPostIt(id);
    useNotebookStore.getState().updateContent(id,'<p>Newest text must survive object undo</p>');
    useNotebookStore.getState().undoEntry(id);
    const after=useNotebookStore.getState().entries.find(entry=>entry.id===id)!;
    expect(after.title).toBe('Revised page');
    expect(after.contentHtml).toBe('<p>Newest text must survive object undo</p>');
    expect(after.objects).toHaveLength(1);
    useNotebookStore.getState().redoEntry(id);
    const restored=useNotebookStore.getState().entries.find(entry=>entry.id===id)!;
    expect(restored.objects).toHaveLength(2);
    expect(restored.contentHtml).toBe('<p>Newest text must survive object undo</p>');
  });

  it('invalidates stale page history after a full-document undo',()=>{
    const id=useNotebookStore.getState().entries[0].id;
    useNotebookStore.getState().createPostIt(id);
    expect(useNotebookStore.getState().canUndoEntry(id)).toBe(true);
    useNotebookStore.getState().undo();
    expect(useNotebookStore.getState().canUndoEntry(id)).toBe(false);
    expect(useNotebookStore.getState().entries.find(entry=>entry.id===id)?.objects).toHaveLength(0);
  });

  it('keeps one Post-it inbox even when that Notebook page is duplicated', () => {
    const originalId=useNotebookStore.getState().createGlobalPostIt();
    const inbox=useNotebookStore.getState().entries.find(entry=>entry.isPostItInbox)!;
    expect(inbox.objects.some(object=>object.id===originalId)).toBe(true);
    useNotebookStore.getState().duplicateEntry(inbox.id);
    const after=useNotebookStore.getState();
    expect(after.entries.filter(entry=>entry.isPostItInbox)).toHaveLength(1);
    expect(after.entries.find(entry=>entry.id===after.activeEntryId)?.isPostItInbox).toBe(false);
  });
});


describe('Day One-style Daily Notebook pages',()=>{
 beforeEach(()=>{
  storage.document=null;
  useNotebookStore.getState().hydrate();
 });
 it('creates a daily page only after a saved thought and reuses it for the same date',()=>{
  const before=useNotebookStore.getState().entries.length;
  expect(useNotebookStore.getState().appendDailyCapture('2026-11-04','')).toBeNull();
  expect(useNotebookStore.getState().entries).toHaveLength(before);
  const first=useNotebookStore.getState().appendDailyCapture('2026-11-04',"Aaron's birthday");
  const second=useNotebookStore.getState().appendDailyCapture('2026-11-04','Send a card');
  expect(first).toBe(second);
  const pages=useNotebookStore.getState().entries.filter(e=>e.dailyDate==='2026-11-04');
  expect(pages).toHaveLength(1);
  expect(pages[0].contentHtml).toContain("Aaron's birthday");
  expect(pages[0].contentHtml).toContain('Send a card');
  expect(useNotebookStore.getState().activeEntryId).not.toBe(first);
 });
 it('escapes untrusted quick-capture HTML instead of injecting markup',()=>{
  const id=useNotebookStore.getState().appendDailyCapture('2026-11-04',
   '<img onerror=alert(1)> & an appointment');
  const page=useNotebookStore.getState().entries.find(e=>e.id===id);
  expect(page?.contentHtml).toContain('&lt;img');
  expect(page?.contentHtml).toContain('&amp; an appointment');
  expect(page?.contentHtml).not.toContain('<img');
 });
 it('persists Linked Agenda records independently of page content and objects',()=>{
  const id=useNotebookStore.getState().appendDailyCapture('2026-11-04',
   "Aaron's birthday")!;
  const before=useNotebookStore.getState().entries.find(e=>e.id===id)!;
  const agendaId=useNotebookStore.getState().addAgendaItem(id,{
   kind:'calendar-date',title:"Aaron's birthday",date:'2026-12-12',
   sourceText:"Aaron's birthday",annual:true,
  });
  expect(agendaId).toBeTruthy();
  const after=useNotebookStore.getState().entries.find(e=>e.id===id)!;
  expect(after.contentHtml).toBe(before.contentHtml);
  expect(after.objects).toBe(before.objects);
  expect(after.agendaItems?.[0]).toMatchObject({
   date:'2026-12-12',annual:true,kind:'calendar-date',
  });
  useNotebookStore.getState().updateAgendaItem(id,agendaId!,{date:'2026-12-13'});
  useNotebookStore.getState().hydrate();
  expect(useNotebookStore.getState().entries.find(e=>e.id===id)?.agendaItems?.[0].date)
   .toBe('2026-12-13');
  useNotebookStore.getState().deleteAgendaItem(id,agendaId!);
  expect(useNotebookStore.getState().entries.find(e=>e.id===id)?.agendaItems)
   .toEqual([]);
 });
 it('never duplicates a linked Task agenda item after a creation retry',()=>{
  const id=useNotebookStore.getState().appendDailyCapture('2026-11-04','Call Aaron')!;
  const input={kind:'task' as const,taskId:'task-1',title:'Call Aaron',
   sourceText:'Call Aaron',date:'2026-11-06'};
  const a=useNotebookStore.getState().addAgendaItem(id,input);
  const b=useNotebookStore.getState().addAgendaItem(id,input);
  expect(a).toBe(b);
  expect(useNotebookStore.getState().entries.find(e=>e.id===id)?.agendaItems).toHaveLength(1);
 });
 it('keeps existing Post-its unchanged after new daily capture',()=>{
  const postId=useNotebookStore.getState().createGlobalPostIt();
  const old=useNotebookStore.getState().entries.find(e=>e.isPostItInbox)!;
  useNotebookStore.getState().updateTextObject(old.id,postId,'Legacy private note');
  useNotebookStore.getState().appendDailyCapture('2026-11-04','New daily note');
  const after=useNotebookStore.getState().entries.find(e=>e.isPostItInbox)!;
  expect(after.objects.find(x=>x.id===postId&&x.type==='post-it'))
   .toMatchObject({text:'Legacy private note'});
 });
});
