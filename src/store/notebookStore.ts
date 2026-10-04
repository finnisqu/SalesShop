import { create } from 'zustand';
import { localNotebookRepository } from '../data/notebookRepository';
import type {
  ActiveNotebookTool,
  AttachmentObject,
  BusinessCardField,
  BusinessCardObject,
  ImageObject,
  InkStroke,
  NotebookDocument,
  NotebookEntry,
  NotebookObject,
  NotebookObjectFrame,
  PaperCardObject,
  PaperScrapObject,
  PaperScrapVariant,
  PaperStyle,
  PostItObject,
  PostItTone,
  ShapeKind,
  ShapeObject,
  SpreadsheetObject,
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
  createPostIt: (entryId: string, tone?: PostItTone) => void;
  createBusinessCard: (entryId: string) => void;
  createPaperScrap: (entryId: string, variant?: PaperScrapVariant) => void;
  createShape: (entryId: string, shape?: ShapeKind) => void;
  createImage: (entryId: string, src: string, alt: string) => void;
  createAttachment: (entryId: string, name: string, mimeType?: string, size?: number) => void;
  createSpreadsheet: (entryId: string) => void;
  selectObject: (objectId: string | null) => void;
  updateObjectFrame: (entryId: string, objectId: string, frame: Partial<NotebookObjectFrame>) => void;
  updateTextObject: (entryId: string, objectId: string, text: string) => void;
  updatePostItTone: (entryId: string, objectId: string, tone: PostItTone) => void;
  updateBusinessCardField: (entryId: string, objectId: string, field: BusinessCardField, value: string) => void;
  updateImageCaption: (entryId: string, objectId: string, caption: string) => void;
  updateSpreadsheetData: (entryId: string, objectId: string, workbookData: unknown) => void;
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

function mapEntry(
  entries: NotebookEntry[],
  entryId: string,
  updater: (entry: NotebookEntry) => NotebookEntry,
) {
  return entries.map((entry) => (entry.id === entryId ? updater(entry) : entry));
}

function nextZ(entry: NotebookEntry) {
  return Math.max(0, ...entry.objects.map((object) => object.zIndex)) + 1;
}

function appendObject(entries: NotebookEntry[], entryId: string, object: NotebookObject, timestamp: string) {
  return mapEntry(entries, entryId, (entry) => ({
    ...entry,
    objects: [...entry.objects, object],
    updatedAt: timestamp,
  }));
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
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({ ...entry, contentHtml, updatedAt: timestamp }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  renameEntry: (entryId, title) => {
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      title: title || 'Untitled page',
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  addStroke: (entryId, stroke) => {
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      strokes: [...entry.strokes, stroke],
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  clearInk: (entryId) => {
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({ ...entry, strokes: [], updatedAt: timestamp }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  setPaperStyle: (entryId, paperStyle) => {
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({ ...entry, paperStyle, updatedAt: timestamp }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  setActiveTool: (activeTool) => set({ activeTool }),

  createPaperCard: (entryId) => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    const timestamp = now();
    const object: PaperCardObject = {
      id: id('object'), type: 'paper-card', text: 'New card', tone: 'cream',
      x: 18, y: 16, width: 27, height: 14, rotation: -1.2, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select' });
  },

  createPostIt: (entryId, tone = 'yellow') => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    const timestamp = now();
    const object: PostItObject = {
      id: id('object'), type: 'post-it', text: 'Quick note…', tone,
      x: 58, y: 15, width: 21, height: 18, rotation: 1.4, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select' });
  },

  createBusinessCard: (entryId) => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    const timestamp = now();
    const object: BusinessCardObject = {
      id: id('object'), type: 'business-card', name: 'Contact name', company: 'Company', title: 'Title', email: '', phone: '',
      x: 18, y: 40, width: 34, height: 18, rotation: -0.6, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select' });
  },

  createPaperScrap: (entryId, variant = 'plain') => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    const timestamp = now();
    const object: PaperScrapObject = {
      id: id('object'), type: 'paper-scrap', text: variant === 'index' ? 'Index card note' : 'Loose thought…', variant,
      x: variant === 'index' ? 52 : 20,
      y: variant === 'index' ? 42 : 64,
      width: variant === 'index' ? 32 : 29,
      height: variant === 'index' ? 16 : 18,
      rotation: variant === 'torn' ? -2.1 : 0.8,
      zIndex: nextZ(entry), createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select' });
  },

  createShape: (entryId, shape = 'box') => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    const timestamp = now();
    const object: ShapeObject = {
      id: id('object'), type: 'shape', shape, style: 'pencil',
      x: 55, y: 64, width: shape === 'arrow' ? 27 : 24, height: shape === 'arrow' ? 8 : 14,
      rotation: shape === 'arrow' ? -4 : 0.5, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select' });
  },

  createImage: (entryId, src, alt) => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    const timestamp = now();
    const object: ImageObject = {
      id: id('object'), type: 'image', src, alt, caption: '',
      x: 20, y: 28, width: 35, height: 25, rotation: -0.4, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select' });
  },

  createAttachment: (entryId, name, mimeType, size) => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    const timestamp = now();
    const object: AttachmentObject = {
      id: id('object'), type: 'attachment', name, mimeType, size,
      x: 58, y: 38, width: 30, height: 10, rotation: 0.7, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select' });
  },

  createSpreadsheet: (entryId) => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    const timestamp = now();
    const object: SpreadsheetObject = {
      id: id('object'), type: 'spreadsheet', workbookData: undefined,
      x: 10, y: 24, width: 72, height: 34, rotation: 0, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select' });
  },

  selectObject: (selectedObjectId) => set({ selectedObjectId }),

  updateObjectFrame: (entryId, objectId, frame) => {
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) => object.id === objectId ? { ...object, ...frame, updatedAt: timestamp } : object),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  updateTextObject: (entryId, objectId, text) => {
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) => {
        if (object.id !== objectId) return object;
        if (object.type === 'paper-card' || object.type === 'post-it' || object.type === 'paper-scrap') {
          return { ...object, text, updatedAt: timestamp };
        }
        return object;
      }),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  updatePostItTone: (entryId, objectId, tone) => {
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) => object.id === objectId && object.type === 'post-it'
        ? { ...object, tone, updatedAt: timestamp }
        : object),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  updateBusinessCardField: (entryId, objectId, field, value) => {
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) => object.id === objectId && object.type === 'business-card'
        ? { ...object, [field]: value, updatedAt: timestamp }
        : object),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  updateImageCaption: (entryId, objectId, caption) => {
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) => object.id === objectId && object.type === 'image'
        ? { ...object, caption, updatedAt: timestamp }
        : object),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  updateSpreadsheetData: (entryId, objectId, workbookData) => {
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) => object.id === objectId && object.type === 'spreadsheet'
        ? { ...object, workbookData, updatedAt: timestamp }
        : object),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries });
  },

  deleteObject: (entryId, objectId) => {
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.filter((object) => object.id !== objectId),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: get().selectedObjectId === objectId ? null : get().selectedObjectId });
  },
}));
