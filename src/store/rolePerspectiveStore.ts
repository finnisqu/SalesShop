import { create } from 'zustand';
import type { OwnerPerspectiveId } from '../services/rolePerspective';

interface RolePerspectiveState {
  activePerspective: OwnerPerspectiveId | null;
  previewToolsEnabled: boolean;
  setPreviewToolsEnabled: (enabled: boolean) => void;
  startPerspective: (id: OwnerPerspectiveId) => void;
  exitPerspective: () => void;
}

/** Owner role previews are purely local UI simulations, NEVER cloud permissions. */
const PREVIEW_TOOLS_KEY = 'salesshop-owner-role-preview-tools-v1';
const initialEnabled = (() => {
  try { return typeof window !== 'undefined' && window.sessionStorage.getItem(PREVIEW_TOOLS_KEY) === '1'; }
  catch { return false; }
})();

export const useRolePerspectiveStore = create<RolePerspectiveState>((set, get) => ({
  activePerspective: null,
  previewToolsEnabled: initialEnabled,
  setPreviewToolsEnabled: (previewToolsEnabled) => {
    try { window.sessionStorage.setItem(PREVIEW_TOOLS_KEY, previewToolsEnabled ? '1' : '0'); }
    catch { /* Session preferences are best-effort. */ }
    set({ previewToolsEnabled, ...(previewToolsEnabled ? {} : { activePerspective: null }) });
  },
  startPerspective: (activePerspective) => {
    if (get().previewToolsEnabled) set({ activePerspective });
  },
  exitPerspective: () => set({ activePerspective: null }),
}));
