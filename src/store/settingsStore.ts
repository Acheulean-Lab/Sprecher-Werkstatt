// Lightweight preferences store. Holds the sweep parameters and the
// remembered input-device id, since both persist across measurement sessions.
// Theme + outputDeviceId removed — the app is dark-only and we never routed
// playback to a non-default sink in code.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  sweepF1: number;
  sweepF2: number;
  sweepDuration: number;
  gateMs: number;
  inputDeviceId: string | null;

  setSweepF1: (v: number) => void;
  setSweepF2: (v: number) => void;
  setSweepDuration: (v: number) => void;
  setGateMs: (v: number) => void;
  setInputDevice: (id: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sweepF1: 20,
      sweepF2: 20000,
      sweepDuration: 5,
      gateMs: 5,
      inputDeviceId: null,
      setSweepF1: (v) => set({ sweepF1: v }),
      setSweepF2: (v) => set({ sweepF2: v }),
      setSweepDuration: (v) => set({ sweepDuration: v }),
      setGateMs: (v) => set({ gateMs: v }),
      setInputDevice: (id) => set({ inputDeviceId: id }),
    }),
    { name: 'soundbench-settings' }
  )
);
