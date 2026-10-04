import { create } from 'zustand';
import { localNotebookRepository } from '../data/notebookRepository';
import type { InkStroke, InkTool, NotebookDocument, NotebookEntry, PaperStyle } from '../types/notebook';

interface NotebookState {
  entries: NotebookEntry[];
  activeEntryId: string | null;
  activeTool: 'text' | InkTool;
  hydrated: boolean;
  hydrate: () => void;
  createEntry: () => void;
  selectEntry: (id: string) => void;
  deleteEntry: (id: string) => void;
  updateContent: (id: string, contentHtml: string) => void;
  renameEntry: (id: string, title: string) => void;
  addStroke: (id: string, stroke: InkStroke) => void;
  clearInk: (id: string) => void;
  setPaperStyle: (id: string, style: PaperStyle) => void;
  setActiveTool: (tool: 'text' | InkTool) => void;
}

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

function newEntry(): NotebookEntry {
  const timestamp = now();
  return {
    id: id('page'),
    title: 'Untitled page',
    contentHtml: '<p></p>',
    strokes: [],
    paperStyle: 'lined',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function persist(entries: NotebookEntry[], activeEntryId: string | null) {
  const document: NotebookDocument = { schemaVersion: 1, entries, activeEntryId };
  localNotebookRepository.save(document);
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  entries: [],
  activeEntryId: null,
  activeTool: 'pen',
  hydrated: false,

  hydrate: () => {
    const stored = localNotebookRepository.load();
    if (stored?.entries.length) {
      set({
        entries: stored.entries,
        activeEntryId: stored.activeEntryId ?? stored.entries[0].id,
        hydrated: true,
      });
      return;
    }

    const first = newEntry();
    persist([first], first.id);
    set({ entries: [first], activeEntryId: first.id, hydrated: true });
  },

  createEntry: () => {
    const entry = newEntry();
    const entries = [entry, ...get().entries];
    persist(entries, entry.id);
    set({ entries, activeEntryId: entry.id });
  },

  selectEntry: (activeEntryId) => {
    persist(get().entries, activeEntryId);
    set({ activeEntryId });
  },

  deleteEntry: (entryId) => {
    let entries = get().entries.filter((entry) => entry.id !== entryId);
    if (!entries.length) entries = [newEntry()];
    const activeEntryId = get().activeEntryId === entryId ? entries[0].id : get().activeEntryId;
    persist(entries, activeEntryId);
    set({ entries, activeEntryId });
  },

  updateContent: (entryId, contentHtml) => {
    const entries = get().entries.map((entry) =>
      entry.id === entryId ? { ...entry, contentHtml, updatedAt: now() } : entry,
    );
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  renameEntry: (entryId, title) => {
    const entries = get().entries.map((entry) =>
      entry.id === entryId ? { ...entry, title: title || 'Untitled page', updatedAt: now() } : entry,
    );
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  addStroke: (entryId, stroke) => {
    const entries = get().entries.map((entry) =>
      entry.id === entryId
        ? { ...entry, strokes: [...entry.strokes, stroke], updatedAt: now() }
        : entry,
    );
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  clearInk: (entryId) => {
    const entries = get().entries.map((entry) =>
      entry.id === entryId ? { ...entry, strokes: [], updatedAt: now() } : entry,
    );
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  setPaperStyle: (entryId, paperStyle) => {
    const entries = get().entries.map((entry) =>
      entry.id === entryId ? { ...entry, paperStyle, updatedAt: now() } : entry,
    );
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  setActiveTool: (activeTool) => set({ activeTool }),
}));
