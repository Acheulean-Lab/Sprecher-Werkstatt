import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  theme: 'light' | 'dark';
  sweepF1: number;
  sweepF2: number;
  sweepDuration: number;
  gateMs: number;
  inputDeviceId: string | null;
  outputDeviceId: string | null;

  setTheme: (t: 'light' | 'dark') => void;
  setSweepF1: (v: number) => void;
  setSweepF2: (v: number) => void;
  setSweepDuration: (v: number) => void;
  setGateMs: (v: number) => void;
  setInputDevice: (id: string | null) => void;
  setOutputDevice: (id: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      sweepF1: 20,
      sweepF2: 20000,
      sweepDuration: 5,
      gateMs: 5,
      inputDeviceId: null,
      outputDeviceId: null,
      setTheme: (t) => set({ theme: t }),
      setSweepF1: (v) => set({ sweepF1: v }),
      setSweepF2: (v) => set({ sweepF2: v }),
      setSweepDuration: (v) => set({ sweepDuration: v }),
      setGateMs: (v) => set({ gateMs: v }),
      setInputDevice: (id) => set({ inputDeviceId: id }),
      setOutputDevice: (id) => set({ outputDeviceId: id }),
    }),
    { name: 'soundbench-settings' }
  )
);
