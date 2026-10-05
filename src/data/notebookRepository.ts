import type { NotebookDocument, NotebookEntry, PageTone, PaperStyle } from '../types/notebook';

const STORAGE_KEY = 'salesshop-react-notebook-v1';

export interface NotebookRepository {
  load(): NotebookDocument | null;
  save(document: NotebookDocument): void;
}

const PAPER_STYLES: PaperStyle[] = ['lined', 'grid', 'blank', 'cornell', 'dotted', 'two-column'];
const PAGE_TONES: PageTone[] = ['cream', 'white', 'blue', 'green', 'rose'];

function migrateEntry(entry: Partial<NotebookEntry> & Pick<NotebookEntry, 'id' | 'title' | 'contentHtml' | 'createdAt' | 'updatedAt'>): NotebookEntry {
  return {
    ...entry,
    strokes: Array.isArray(entry.strokes) ? entry.strokes : [],
    objects: Array.isArray(entry.objects) ? entry.objects : [],
    paperStyle: PAPER_STYLES.includes(entry.paperStyle as PaperStyle) ? entry.paperStyle as PaperStyle : 'lined',
    tone: PAGE_TONES.includes(entry.tone as PageTone) ? entry.tone as PageTone : 'cream',
    favorite: Boolean(entry.favorite),
    context: entry.context && typeof entry.context === 'object' ? entry.context : {},
  } as NotebookEntry;
}

function migrateDocument(raw: unknown): NotebookDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as { schemaVersion?: number; entries?: unknown[]; activeEntryId?: string | null; };
  if (!Array.isArray(candidate.entries)) return null;

  if (candidate.schemaVersion === 3 || candidate.schemaVersion === 2 || candidate.schemaVersion === 1) {
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
  save(document) { localStorage.setItem(STORAGE_KEY, JSON.stringify(document)); },
};
