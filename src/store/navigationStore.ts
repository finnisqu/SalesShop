import { create } from 'zustand';
import { useNotebookStore } from './notebookStore';

export type AppView = 'notebook' | 'board' | 'quotes';

interface NavigationState {
  view: AppView;
  focusedProjectId: string | null;
  setView: (view: AppView) => void;
  openProject: (projectId: string) => void;
  openNotebookPage: (pageId: string) => void;
  clearFocusedProject: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  view: 'notebook',
  focusedProjectId: null,
  setView: (view) => set({ view, focusedProjectId: null }),
  openProject: (projectId) => set({ view: 'board', focusedProjectId: projectId }),
  openNotebookPage: (pageId) => {
    useNotebookStore.getState().selectEntry(pageId);
    set({ view: 'notebook', focusedProjectId: null });
  },
  clearFocusedProject: () => set({ focusedProjectId: null }),
}));
