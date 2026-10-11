import { readLocalDocument, writeLocalDocument } from './cloudAwareStorage';
import type { NotebookDocument, NotebookEntry, PageTone, PaperStyle, PaperTexture } from '../types/notebook';

export interface NotebookRepository {
  load(): NotebookDocument | null;
  save(document: NotebookDocument): void;
}

const PAPER_STYLES: PaperStyle[] = ['lined', 'grid', 'blank', 'cornell', 'dotted', 'two-column'];
const PAGE_TONES: PageTone[] = ['cream', 'white', 'blue', 'green', 'rose'];
const PAGE_TEXTURES: PaperTexture[] = ['classic', 'clean', 'fibrous', 'kraft'];

function migrateEntry(entry: Partial<NotebookEntry> & Pick<NotebookEntry, 'id' | 'title' | 'contentHtml' | 'createdAt' | 'updatedAt'>): NotebookEntry {
  return {
    ...entry,
    strokes: Array.isArray(entry.strokes) ? entry.strokes : [],
    objects: Array.isArray(entry.objects) ? entry.objects : [],
    paperStyle: PAPER_STYLES.includes(entry.paperStyle as PaperStyle) ? entry.paperStyle as PaperStyle : 'lined',
    tone: PAGE_TONES.includes(entry.tone as PageTone) ? entry.tone as PageTone : 'cream',
    texture: PAGE_TEXTURES.includes(entry.texture as PaperTexture) ? entry.texture as PaperTexture : 'classic',
    favorite: Boolean(entry.favorite),
    openAtStart: Boolean(entry.openAtStart),
    hidden: Boolean(entry.hidden),
    deletionLocked: entry.deletionLocked !== false,
    context: entry.context && typeof entry.context === 'object' ? entry.context : {},
  } as NotebookEntry;
}

function migrateDocument(raw: unknown): NotebookDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as { schemaVersion?: number; entries?: unknown[]; activeEntryId?: string | null };
  if (!Array.isArray(candidate.entries)) return null;

  if ([1, 2, 3].includes(candidate.schemaVersion ?? 0)) {
    return {
      schemaVersion: 3,
      entries: candidate.entries.map((entry) => migrateEntry(entry as NotebookEntry)),
      activeEntryId: candidate.activeEntryId ?? null,
    };
  }
  return null;
}

export const localNotebookRepository: NotebookRepository = {
  load() {
    const migrated = migrateDocument(readLocalDocument('notebook'));
    if (migrated) this.save(migrated);
    return migrated;
  },
  save(document) {
    writeLocalDocument('notebook', document);
  },
};
