import { create } from 'zustand';

type NotebookInputMode = 'pencil' | 'finger';

interface NotebookInputState {
  inputMode: NotebookInputMode;
  setInputMode: (mode: NotebookInputMode) => void;
}

const STORAGE_KEY = 'salesshop-notebook-input-mode-v1';

function initialMode(): NotebookInputMode {
  if (typeof window === 'undefined') return 'pencil';
  return window.sessionStorage.getItem(STORAGE_KEY) === 'finger' ? 'finger' : 'pencil';
}

export const useNotebookInputStore = create<NotebookInputState>((set) => ({
  inputMode: initialMode(),
  setInputMode: (inputMode) => {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, inputMode);
    set({ inputMode });
  },
}));
