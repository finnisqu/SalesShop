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
  PageTone,
  PaperCardObject,
  PaperScrapObject,
  PaperScrapVariant,
  PaperStyle,
  PaperTexture,
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
  canUndo: boolean;
  canRedo: boolean;
  hydrate: () => void;
  createEntry: () => void;
  duplicateEntry: (id: string) => void;
  selectEntry: (id: string) => void;
  deleteEntry: (id: string) => void;
  toggleFavorite: (id: string) => void;
  toggleOpenAtStart: (id: string) => void;
  toggleHidden: (id: string) => void;
  toggleDeletionLocked: (id: string) => void;
  setPageTone: (id: string, tone: PageTone) => void;
  setPageTexture: (id: string, texture: PaperTexture) => void;
  updateContent: (id: string, contentHtml: string) => void;
  renameEntry: (id: string, title: string) => void;
  addStroke: (id: string, stroke: InkStroke) => void;
  deleteStrokes: (id: string, strokeIds: string[]) => void;
  moveStrokes: (id: string, strokeIds: string[], dx: number, dy: number) => void;
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
  undo: () => void;
  redo: () => void;
}

interface HistorySnapshot {
  entries: NotebookEntry[];
  activeEntryId: string | null;
}

const HISTORY_LIMIT = 80;
let past: HistorySnapshot[] = [];
let future: HistorySnapshot[] = [];
let lastCheckpointKey = '';
let lastCheckpointAt = 0;

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

function snapshot(state: Pick<NotebookState, 'entries' | 'activeEntryId'>): HistorySnapshot {
  return {
    entries: structuredClone(state.entries),
    activeEntryId: state.activeEntryId,
  };
}

function resetHistory() {
  past = [];
  future = [];
  lastCheckpointKey = '';
  lastCheckpointAt = 0;
}

function checkpoint(state: NotebookState, key: string, coalesceMs = 0) {
  const timestamp = Date.now();
  const coalescing = coalesceMs > 0 && lastCheckpointKey === key && timestamp - lastCheckpointAt <= coalesceMs;
  if (!coalescing) {
    past.push(snapshot(state));
    if (past.length > HISTORY_LIMIT) past.shift();
    future = [];
  }
  lastCheckpointKey = key;
  lastCheckpointAt = timestamp;
}

function historyFlags() {
  return { canUndo: past.length > 0, canRedo: future.length > 0 };
}

function newEntry(): NotebookEntry {
  const timestamp = now();
  return {
    id: id('page'),
    title: 'Untitled page',
    contentHtml: '<p></p>',
    strokes: [],
    objects: [],
    paperStyle: 'lined',
    tone: 'cream',
    texture: 'classic',
    favorite: false,
    openAtStart: false,
    hidden: false,
    deletionLocked: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function duplicateEntryModel(source: NotebookEntry): NotebookEntry {
  const timestamp = now();
  const clone = structuredClone(source);
  return {
    ...clone,
    id: id('page'),
    title: `${source.title || 'Untitled page'} copy`,
    favorite: false,
    openAtStart: false,
    hidden: false,
    deletionLocked: true,
    strokes: clone.strokes.map((stroke) => ({ ...stroke, id: id('stroke') })),
    objects: clone.objects.map((object) => ({
      ...object,
      id: id('object'),
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function persist(entries: NotebookEntry[], activeEntryId: string | null) {
  const document: NotebookDocument = { schemaVersion: 3, entries, activeEntryId };
  localNotebookRepository.save(document);
}

function mapEntry(entries: NotebookEntry[], entryId: string, updater: (entry: NotebookEntry) => NotebookEntry) {
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

function nextVisibleEntry(entries: NotebookEntry[], excludingId?: string) {
  return entries.find((entry) => entry.id !== excludingId && !entry.hidden)
    ?? entries.find((entry) => entry.id !== excludingId)
    ?? null;
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  entries: [],
  activeEntryId: null,
  activeTool: 'select',
  selectedObjectId: null,
  hydrated: false,
  canUndo: false,
  canRedo: false,

  hydrate: () => {
    resetHistory();
    const stored = localNotebookRepository.load();
    if (stored?.entries.length) {
      const startEntry = stored.entries.find((entry) => entry.favorite && entry.openAtStart);
      const fallback = stored.entries.find((entry) => entry.id === stored.activeEntryId) ?? stored.entries[0];
      set({
        entries: stored.entries,
        activeEntryId: startEntry?.id ?? fallback.id,
        activeTool: 'select',
        selectedObjectId: null,
        hydrated: true,
        ...historyFlags(),
      });
      return;
    }
    const first = newEntry();
    persist([first], first.id);
    set({ entries: [first], activeEntryId: first.id, activeTool: 'select', selectedObjectId: null, hydrated: true, ...historyFlags() });
  },

  createEntry: () => {
    checkpoint(get(), 'page:create');
    const entry = newEntry();
    const entries = [entry, ...get().entries];
    persist(entries, entry.id);
    set({ entries, activeEntryId: entry.id, selectedObjectId: null, activeTool: 'select', ...historyFlags() });
  },

  duplicateEntry: (entryId) => {
    const source = get().entries.find((entry) => entry.id === entryId);
    if (!source) return;
    checkpoint(get(), `page:duplicate:${entryId}`);
    const duplicate = duplicateEntryModel(source);
    const sourceIndex = get().entries.findIndex((entry) => entry.id === entryId);
    const entries = [...get().entries];
    entries.splice(sourceIndex + 1, 0, duplicate);
    persist(entries, duplicate.id);
    set({ entries, activeEntryId: duplicate.id, selectedObjectId: null, activeTool: 'select', ...historyFlags() });
  },

  selectEntry: (activeEntryId) => {
    persist(get().entries, activeEntryId);
    set({ activeEntryId, selectedObjectId: null, activeTool: 'select' });
  },

  deleteEntry: (entryId) => {
    const target = get().entries.find((entry) => entry.id === entryId);
    if (!target || target.deletionLocked) return;
    checkpoint(get(), `page:delete:${entryId}`);
    let entries = get().entries.filter((entry) => entry.id !== entryId);
    if (!entries.length) entries = [newEntry()];
    const replacement = nextVisibleEntry(entries);
    const activeEntryId = get().activeEntryId === entryId ? (replacement?.id ?? entries[0].id) : get().activeEntryId;
    persist(entries, activeEntryId);
    set({ entries, activeEntryId, selectedObjectId: null, activeTool: 'select', ...historyFlags() });
  },

  toggleFavorite: (entryId) => {
    checkpoint(get(), `page:favorite:${entryId}`);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => {
      const favorite = !entry.favorite;
      return { ...entry, favorite, openAtStart: favorite ? entry.openAtStart : false, updatedAt: timestamp };
    });
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  toggleOpenAtStart: (entryId) => {
    const target = get().entries.find((entry) => entry.id === entryId);
    if (!target?.favorite) return;
    checkpoint(get(), `page:start:${entryId}`);
    const timestamp = now();
    const enable = !target.openAtStart;
    const entries = get().entries.map((entry) => ({
      ...entry,
      openAtStart: entry.id === entryId ? enable : false,
      updatedAt: entry.id === entryId || entry.openAtStart ? timestamp : entry.updatedAt,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  toggleHidden: (entryId) => {
    checkpoint(get(), `page:hidden:${entryId}`);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({ ...entry, hidden: !entry.hidden, updatedAt: timestamp }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  toggleDeletionLocked: (entryId) => {
    checkpoint(get(), `page:delete-lock:${entryId}`);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({ ...entry, deletionLocked: !entry.deletionLocked, updatedAt: timestamp }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  setPageTone: (entryId, tone) => {
    checkpoint(get(), `page:tone:${entryId}`);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({ ...entry, tone, updatedAt: timestamp }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  setPageTexture: (entryId, texture) => {
    checkpoint(get(), `page:texture:${entryId}`);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({ ...entry, texture, updatedAt: timestamp }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  updateContent: (entryId, contentHtml) => {
    const existing = get().entries.find((entry) => entry.id === entryId);
    if (!existing || existing.contentHtml === contentHtml) return;
    checkpoint(get(), `content:${entryId}`, 900);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({ ...entry, contentHtml, updatedAt: timestamp }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  renameEntry: (entryId, title) => {
    checkpoint(get(), `title:${entryId}`, 900);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      title: title || 'Untitled page',
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  addStroke: (entryId, stroke) => {
    checkpoint(get(), `ink:add:${entryId}`);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      strokes: [...entry.strokes, stroke],
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  deleteStrokes: (entryId, strokeIds) => {
    if (!strokeIds.length) return;
    checkpoint(get(), `ink:delete:${entryId}`);
    const selected = new Set(strokeIds);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      strokes: entry.strokes.filter((stroke) => !selected.has(stroke.id)),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  moveStrokes: (entryId, strokeIds, dx, dy) => {
    if (!strokeIds.length || (!dx && !dy)) return;
    checkpoint(get(), `ink:move:${entryId}`);
    const selected = new Set(strokeIds);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      strokes: entry.strokes.map((stroke) => selected.has(stroke.id)
        ? { ...stroke, points: stroke.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })) }
        : stroke),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  clearInk: (entryId) => {
    const target = get().entries.find((entry) => entry.id === entryId);
    if (!target?.strokes.length) return;
    checkpoint(get(), `ink:clear:${entryId}`);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({ ...entry, strokes: [], updatedAt: timestamp }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  setPaperStyle: (entryId, paperStyle) => {
    checkpoint(get(), `page:paper:${entryId}`);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({ ...entry, paperStyle, updatedAt: timestamp }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  setActiveTool: (activeTool) => set({ activeTool: activeTool === 'text' ? 'select' : activeTool }),

  createPaperCard: (entryId) => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    checkpoint(get(), `object:create:${entryId}`);
    const timestamp = now();
    const object: PaperCardObject = {
      id: id('object'), type: 'paper-card', text: 'New card', tone: 'cream',
      x: 18, y: 16, width: 27, height: 14, rotation: -1.2, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select', ...historyFlags() });
  },

  createPostIt: (entryId, tone = 'yellow') => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    checkpoint(get(), `object:create:${entryId}`);
    const timestamp = now();
    const object: PostItObject = {
      id: id('object'), type: 'post-it', text: 'Quick note…', tone,
      x: 58, y: 15, width: 21, height: 18, rotation: 1.4, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select', ...historyFlags() });
  },

  createBusinessCard: (entryId) => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    checkpoint(get(), `object:create:${entryId}`);
    const timestamp = now();
    const object: BusinessCardObject = {
      id: id('object'), type: 'business-card', name: 'Contact name', company: 'Company', title: 'Title', email: '', phone: '',
      x: 18, y: 40, width: 34, height: 18, rotation: -0.6, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select', ...historyFlags() });
  },

  createPaperScrap: (entryId, variant = 'plain') => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    checkpoint(get(), `object:create:${entryId}`);
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
    set({ entries, selectedObjectId: object.id, activeTool: 'select', ...historyFlags() });
  },

  createShape: (entryId, shape = 'box') => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    checkpoint(get(), `object:create:${entryId}`);
    const timestamp = now();
    const object: ShapeObject = {
      id: id('object'), type: 'shape', shape, style: 'pencil',
      x: 55, y: 64, width: shape === 'arrow' ? 27 : 24, height: shape === 'arrow' ? 8 : 14,
      rotation: shape === 'arrow' ? -4 : 0.5, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select', ...historyFlags() });
  },

  createImage: (entryId, src, alt) => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    checkpoint(get(), `object:create:${entryId}`);
    const timestamp = now();
    const object: ImageObject = {
      id: id('object'), type: 'image', src, alt, caption: '',
      x: 20, y: 28, width: 35, height: 25, rotation: -0.4, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select', ...historyFlags() });
  },

  createAttachment: (entryId, name, mimeType, size) => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    checkpoint(get(), `object:create:${entryId}`);
    const timestamp = now();
    const object: AttachmentObject = {
      id: id('object'), type: 'attachment', name, mimeType, size,
      x: 58, y: 38, width: 30, height: 10, rotation: 0.7, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select', ...historyFlags() });
  },

  createSpreadsheet: (entryId) => {
    const entry = get().entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    checkpoint(get(), `object:create:${entryId}`);
    const timestamp = now();
    const object: SpreadsheetObject = {
      id: id('object'), type: 'spreadsheet', workbookData: undefined,
      x: 10, y: 24, width: 72, height: 34, rotation: 0, zIndex: nextZ(entry),
      createdAt: timestamp, updatedAt: timestamp,
    };
    const entries = appendObject(get().entries, entryId, object, timestamp);
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: object.id, activeTool: 'select', ...historyFlags() });
  },

  selectObject: (selectedObjectId) => set({ selectedObjectId }),

  updateObjectFrame: (entryId, objectId, frame) => {
    checkpoint(get(), `object:frame:${entryId}:${objectId}`);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) => object.id === objectId ? { ...object, ...frame, updatedAt: timestamp } : object),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  updateTextObject: (entryId, objectId, text) => {
    checkpoint(get(), `object:text:${entryId}:${objectId}`, 900);
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
    set({ entries, ...historyFlags() });
  },

  updatePostItTone: (entryId, objectId, tone) => {
    checkpoint(get(), `object:tone:${entryId}:${objectId}`);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) => object.id === objectId && object.type === 'post-it'
        ? { ...object, tone, updatedAt: timestamp }
        : object),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  updateBusinessCardField: (entryId, objectId, field, value) => {
    checkpoint(get(), `object:business:${entryId}:${objectId}:${field}`, 900);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) => object.id === objectId && object.type === 'business-card'
        ? { ...object, [field]: value, updatedAt: timestamp }
        : object),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  updateImageCaption: (entryId, objectId, caption) => {
    checkpoint(get(), `object:caption:${entryId}:${objectId}`, 900);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) => object.id === objectId && object.type === 'image'
        ? { ...object, caption, updatedAt: timestamp }
        : object),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  updateSpreadsheetData: (entryId, objectId, workbookData) => {
    checkpoint(get(), `object:sheet:${entryId}:${objectId}`, 1200);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.map((object) => object.id === objectId && object.type === 'spreadsheet'
        ? { ...object, workbookData, updatedAt: timestamp }
        : object),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, ...historyFlags() });
  },

  deleteObject: (entryId, objectId) => {
    checkpoint(get(), `object:delete:${entryId}:${objectId}`);
    const timestamp = now();
    const entries = mapEntry(get().entries, entryId, (entry) => ({
      ...entry,
      objects: entry.objects.filter((object) => object.id !== objectId),
      updatedAt: timestamp,
    }));
    persist(entries, get().activeEntryId);
    set({ entries, selectedObjectId: get().selectedObjectId === objectId ? null : get().selectedObjectId, ...historyFlags() });
  },

  undo: () => {
    const previous = past.pop();
    if (!previous) return;
    future.push(snapshot(get()));
    if (future.length > HISTORY_LIMIT) future.shift();
    persist(previous.entries, previous.activeEntryId);
    lastCheckpointKey = '';
    set({
      entries: previous.entries,
      activeEntryId: previous.activeEntryId,
      selectedObjectId: null,
      activeTool: 'select',
      ...historyFlags(),
    });
  },

  redo: () => {
    const next = future.pop();
    if (!next) return;
    past.push(snapshot(get()));
    if (past.length > HISTORY_LIMIT) past.shift();
    persist(next.entries, next.activeEntryId);
    lastCheckpointKey = '';
    set({
      entries: next.entries,
      activeEntryId: next.activeEntryId,
      selectedObjectId: null,
      activeTool: 'select',
      ...historyFlags(),
    });
  },
}));
