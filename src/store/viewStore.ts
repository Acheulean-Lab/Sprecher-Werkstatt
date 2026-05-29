import { create } from 'zustand';

// The app has exactly two destinations: the welcome / project-picker view
// and the measurement wizard for a given session. Dashboard lives embedded
// inside the wizard's analysis step (so there's no standalone route).
export type View =
  | { kind: 'empty' }
  | { kind: 'wizard'; sessionId: string };

interface State {
  view: View;
  setView: (v: View) => void;
}

export const useViewStore = create<State>((set) => ({
  view: { kind: 'empty' },
  setView: (v) => set({ view: v }),
}));
