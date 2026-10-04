import type { NotebookDocument, NotebookEntry } from '../types/notebook';

const STORAGE_KEY = 'salesshop-react-notebook-v1';

export interface NotebookRepository {
  load(): NotebookDocument | null;
  save(document: NotebookDocument): void;
}

function migrateEntry(entry: NotebookEntry | (Omit<NotebookEntry, 'objects'> & { objects?: unknown })):
  NotebookEntry {
  return {
    ...entry,
    strokes: Array.isArray(entry.strokes) ? entry.strokes : [],
    objects: Array.isArray(entry.objects) ? entry.objects as NotebookEntry['objects'] : [],
  };
}

function migrateDocument(raw: unknown): NotebookDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as {
    schemaVersion?: number;
    entries?: unknown[];
    activeEntryId?: string | null;
  };
  if (!Array.isArray(candidate.entries)) return null;

  if (candidate.schemaVersion === 2) {
    return {
      schemaVersion: 2,
      entries: candidate.entries.map((entry) => migrateEntry(entry as NotebookEntry)),
      activeEntryId: candidate.activeEntryId ?? null,
    };
  }

  if (candidate.schemaVersion === 1) {
    return {
      schemaVersion: 2,
      entries: candidate.entries.map((entry) => migrateEntry(entry as NotebookEntry)),
      activeEntryId: candidate.activeEntryId ?? null,
    };
  }

  return null;
}

export const localNotebookRepository: NotebookRepository = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const migrated = migrateDocument(JSON.parse(raw));
      if (migrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {
      return null;
    }
  },

  save(document) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  },
};
