import { create } from 'zustand';
import type { OwnerPerspectiveId } from '../services/rolePerspective';

interface RolePerspectiveState {
  activePerspective: OwnerPerspectiveId | null;
  startPerspective: (id: OwnerPerspectiveId) => void;
  exitPerspective: () => void;
}

/** Session-memory-only view simulation; never mutates Auth or Supabase membership. */
export const useRolePerspectiveStore = create<RolePerspectiveState>((set) => ({
  activePerspective: null,
  startPerspective: (activePerspective) => set({ activePerspective }),
  exitPerspective: () => set({ activePerspective: null }),
}));
