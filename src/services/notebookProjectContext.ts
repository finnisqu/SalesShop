import { localNotebookRepository } from '../data/notebookRepository';
import { useNotebookStore } from '../store/notebookStore';
import type { NotebookEntry } from '../types/notebook';

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

function persist(entries: NotebookEntry[], activeEntryId: string | null) {
  localNotebookRepository.save({ schemaVersion: 2, entries, activeEntryId });
}

export function setNotebookProject(entryId: string, projectId?: string) {
  const state = useNotebookStore.getState();
  const timestamp = now();
  const entries = state.entries.map((entry) => entry.id === entryId
    ? {
        ...entry,
        context: { ...(entry.context ?? {}), projectId: projectId || undefined },
        updatedAt: timestamp,
      }
    : entry);
  persist(entries, state.activeEntryId);
  useNotebookStore.setState({ entries });
}

export function createProjectNotebookPage(projectId: string, title: string) {
  const state = useNotebookStore.getState();
  const timestamp = now();
  const entry: NotebookEntry = {
    id: id('page'),
    title: title.trim() || 'Project notes',
    contentHtml: '<p></p>',
    strokes: [],
    objects: [],
    paperStyle: 'lined',
    tone: 'cream',
    favorite: false,
    context: { projectId },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const entries = [entry, ...state.entries];
  persist(entries, entry.id);
  useNotebookStore.setState({ entries, activeEntryId: entry.id, selectedObjectId: null });
  return entry.id;
}

export function detachProjectNotebookPages(projectId: string) {
  const state = useNotebookStore.getState();
  const timestamp = now();
  let changed = false;
  const entries = state.entries.map((entry) => {
    if (entry.context?.projectId !== projectId) return entry;
    changed = true;
    return {
      ...entry,
      context: { ...(entry.context ?? {}), projectId: undefined },
      updatedAt: timestamp,
    };
  });
  if (!changed) return;
  persist(entries, state.activeEntryId);
  useNotebookStore.setState({ entries });
}
