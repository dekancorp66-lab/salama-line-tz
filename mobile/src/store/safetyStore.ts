import { create } from 'zustand';

export interface SafetyState {
  quickExitActive: boolean;
  triggerQuickExit: () => void;
  resetQuickExit: () => void;
}

/**
 * In-memory only. Quick Exit state must never survive an app restart: a fresh
 * launch returns to the normal app rather than a stale "exited" state.
 */
export const useSafetyStore = create<SafetyState>((set) => ({
  quickExitActive: false,
  triggerQuickExit: () => set({ quickExitActive: true }),
  resetQuickExit: () => set({ quickExitActive: false }),
}));
