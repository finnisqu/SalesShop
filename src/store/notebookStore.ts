import { create } from 'zustand';
import { localNotebookRepository } from '../data/notebookRepository';
import type {
  ActiveNotebookTool,
  InkStroke,
  NotebookDocument,
  NotebookEntry,
  NotebookObjectFrame,
  PaperCardObject,
  PaperStyle,
} from '../types/notebook';

interface NotebookState {
  entries: NotebookEntry[];
  activeEntryId: string | null;
  activeTool: ActiveNotebookTool;
  selectedObjectId: string | null;
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
  setActiveTool: (tool: ActiveNotebookTool) => void;
  createPaperCard: (entryId: string) => void;
  selectObject: (objectId: string | null) => void;
  updateObjectFrame: (entryId: string, objectId: string, frame: Partial<NotebookObjectFrame>) => void;
  updatePaperCardText: (entryId: string, objectId: string, text: string) => void;
  deleteObject: (entryId: string, objectId: string) => void;
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
    objects: [],
    paperStyle: 'lined',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function persist(entries: NotebookEntry[], activeEntryId: string | null) {
  const document: NotebookDocument = { schemaVersion: 2, entries, activeEntryId };
  localNotebookRepository.save(document);
}

function updateEntryObjects(
  entries: NotebookEntry[],
  entryId: string,
  updater: (entry: NotebookEntry) => NotebookEntry,
) {
  return entries.map((entry) => (entry.id === entryId ? updater(entry) : entry));
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  entries: [],
  activeEntryId: null,
  activeTool: 'pen',
  selectedObjectId: null,
  hydrated: false,

  hydrate: () => {
    const stored = localNotebookRepository.load();
    if (stored?.entries.length) {
      set({
        entries: stored.entries,
        activeEntryId: stored.activeEntryId ?? stored.entries[0].id,
        selectedObjectId: null,
        hydrated: true,
      });
      return;
    }

    const first = newEntry();
    persist([first], first.id);
    set({ entries: [first], activeEntryId: first.id, selectedObjectId: null, hydrated: true });
  },

  createEntry: () => {
    const entry = newEntry();
    const entries = [entry, ...get().entries];
    persist(entries, entry.id);
    set({ entries, activeEntryId: entry.id, selectedObjectId: null });
  },

  selectEntry: (activeEntryId) => {
    persist(get().entries, activeEntryId);
    set({ activeEntryId, selectedObjectId: null });
  },

  deleteEntry: (entryId) => {
    let entries = get().entries.filter((entry) => entry.id !== entryId);
    if (!entries.length) entries = [newEntry()];
    const activeEntryId = get().activeEntryId === entryId ? entries[0].id : get().activeEntryId;
    persist(entries, activeEntryId);
    set({ entries, activeEntryId, selectedObjectId: null });
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

  createPaperCard: (entryId) => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    const timestamp = now();
    const card: PaperCardObject = {
      id: id('object'),
      type: 'paper-card',
      text: 'New card',
      tone: 'cream',
      x: 18,
      y: 16,
      width: 27,
      height: 14,
      rotation: -1.2,
      zIndex: Math.max(0, ...entry.objects.map((object) => object.zIndex)) + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const entries = updateEntryObjects(get().entries, entryId, (candidate) => ({
      ...candidate,
      objects: [...candidate.objects, card],
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: card.id, activeTool: 'select' });
  },

  selectObject: (selectedObjectId) => set({ selectedObjectId }),

  updateObjectFrame: (entryId, objectId, frame) => {
    const timestamp = now();
    const entries = updateEntryObjects(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) =>
        object.id === objectId ? { ...object, ...frame, updatedAt: timestamp } : object,
      ),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  updatePaperCardText: (entryId, objectId, text) => {
    const timestamp = now();
    const entries = updateEntryObjects(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) =>
        object.id === objectId && object.type === 'paper-card'
          ? { ...object, text, updatedAt: timestamp }
          : object,
      ),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  deleteObject: (entryId, objectId) => {
    const timestamp = now();
    const entries = updateEntryObjects(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.filter((object) => object.id !== objectId),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: get().selectedObjectId === objectId ? null : get().selectedObjectId });
  },
}));
