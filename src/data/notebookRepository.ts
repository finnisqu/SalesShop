import type { NotebookDocument } from '../types/notebook';

const STORAGE_KEY = 'salesshop-react-notebook-v1';

export interface NotebookRepository {
  load(): NotebookDocument | null;
  save(document: NotebookDocument): void;
}

export const localNotebookRepository: NotebookRepository = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as NotebookDocument;
      return parsed?.schemaVersion === 1 && Array.isArray(parsed.entries) ? parsed : null;
    } catch {
      return null;
    }
  },

  save(document) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  },
};
