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

  it('rejects invalid folder targets and creates new pages in a selected folder', () => {
    const original=useNotebookStore.getState().entries[0];
    useNotebookStore.getState().moveEntryToFolder(original.id,'not-a-folder');
    expect(useNotebookStore.getState().entries[0].folderId).toBeUndefined();
    const folder=useNotebookStore.getState().createFolder('My work');
    useNotebookStore.getState().createEntry(folder);
    expect(useNotebookStore.getState().entries[0].folderId).toBe(folder);
    expect(useNotebookStore.getState().entries[0].id).not.toBe(original.id);
  });
});
