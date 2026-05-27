import { create } from 'zustand';

export type View =
  | { kind: 'empty' }
  | { kind: 'wizard'; sessionId: string; variantId?: string }
  | { kind: 'dashboard'; sessionId: string }
  | { kind: 'settings' };

interface State {
  view: View;
  setView: (v: View) => void;
}

export const useViewStore = create<State>((set) => ({
  view: { kind: 'empty' },
  setView: (v) => set({ view: v }),
}));
