import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, Measurement, MicProfile } from '../types';
import { CURVE_COLORS, DEFAULT_GEOMETRY } from '../types';
import { BUILT_IN_PROFILES } from '../data/micProfiles';

const uid = () => Math.random().toString(36).slice(2, 10);

interface SessionState {
  sessions: Session[];
  customProfiles: MicProfile[];

  createSession: (name: string) => string;
  updateSession: (id: string, patch: Partial<Pick<Session, 'name' | 'tag' | 'notes' | 'geometry' | 'color' | 'micProfileId'>>) => void;

  addMeasurement: (sessionId: string, m: Measurement) => void;
  deleteMeasurement: (sessionId: string, measurementId: string) => void;
  updateMeasurement: (sessionId: string, measurementId: string, patch: Partial<Measurement>) => void;

  addCustomProfile: (p: MicProfile) => void;
  deleteCustomProfile: (id: string) => void;
  getProfile: (id: string | null) => MicProfile | null;

  importSession: (s: Session) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      customProfiles: [],

      createSession: (name) => {
        const id = uid();
        const now = Date.now();
        const colorIndex = get().sessions.length % CURVE_COLORS.length;
        const s: Session = {
          id,
          name,
          createdAt: now,
          updatedAt: now,
          micProfileId: 'flat',
          color: CURVE_COLORS[colorIndex],
          tag: 'other',
          geometry: { ...DEFAULT_GEOMETRY },
          measurements: [],
        };
        set((st) => ({ sessions: [s, ...st.sessions] }));
        return id;
      },

      updateSession: (id, patch) => set((st) => ({
        sessions: st.sessions.map((s) =>
          s.id !== id ? s : { ...s, ...patch, updatedAt: Date.now() }
        ),
      })),

      addMeasurement: (sessionId, m) => set((st) => ({
        sessions: st.sessions.map((s) =>
          s.id !== sessionId ? s : { ...s, measurements: [...s.measurements, m], updatedAt: Date.now() }
        ),
      })),

      deleteMeasurement: (sessionId, measurementId) => set((st) => ({
        sessions: st.sessions.map((s) =>
          s.id !== sessionId ? s : {
            ...s,
            measurements: s.measurements.filter((m) => m.id !== measurementId),
            updatedAt: Date.now(),
          }
        ),
      })),

      updateMeasurement: (sessionId, measurementId, patch) => set((st) => ({
        sessions: st.sessions.map((s) =>
          s.id !== sessionId ? s : {
            ...s,
            updatedAt: Date.now(),
            measurements: s.measurements.map((m) => m.id === measurementId ? { ...m, ...patch } : m),
          }
        ),
      })),

      addCustomProfile: (p) => set((st) => ({ customProfiles: [...st.customProfiles, p] })),
      deleteCustomProfile: (id) => set((st) => ({ customProfiles: st.customProfiles.filter((p) => p.id !== id) })),
      getProfile: (id) => {
        if (!id) return null;
        return BUILT_IN_PROFILES.find((p) => p.id === id) || get().customProfiles.find((p) => p.id === id) || null;
      },

      importSession: (s) => set((st) => ({ sessions: [s, ...st.sessions.filter((x) => x.id !== s.id)] })),
    }),
    {
      name: 'soundbench-sessions',
      version: 5,
      // Exclude the ungated impulse response from persistence. At 250 ms × 48 kHz
      // it's still ~150 KB per measurement, and several sessions × several
      // measurements will exceed localStorage's ~5 MB quota.
      // The waterfall view falls back to the gated `impulseResponse` when
      // `fullImpulseResponse` is empty, so loaded sessions still render — just
      // with slightly less time-domain detail in the CSD plot.
      partialize: (state) => ({
        ...state,
        sessions: state.sessions.map((s) => ({
          ...s,
          measurements: s.measurements.map((m) => ({ ...m, fullImpulseResponse: [] })),
        })),
      }),
      migrate: (persisted: any, version) => {
        if (!persisted?.sessions) return persisted;

        if (version < 2) {
          for (const s of persisted.sessions) {
            for (const v of s.variants || []) {
              for (const m of v.measurements || []) delete m.recording;
            }
          }
        }
        if (version < 3) {
          for (const s of persisted.sessions) {
            for (const v of s.variants || []) {
              for (const m of v.measurements || []) {
                if (!m.smoothedResponse) m.smoothedResponse = m.frequencyResponse || [];
                if (!m.fullImpulseResponse) m.fullImpulseResponse = m.impulseResponse || [];
                if (m.peakIndex == null) m.peakIndex = 0;
              }
            }
          }
        }
        if (version < 4) {
          for (const s of persisted.sessions) {
            for (const v of s.variants || []) {
              for (const m of v.measurements || []) {
                if (m.metrics) {
                  if (m.metrics.snrDb == null) m.metrics.snrDb = NaN;
                  if (m.metrics.irPeak == null) m.metrics.irPeak = 0;
                }
              }
            }
          }
        }
        if (version < 5) {
          // Flatten the Variant[] wrapper into the Session directly.
          // Take the first variant's data; discard any additional variants.
          for (const s of persisted.sessions) {
            const v = s.variants?.[0];
            if (v) {
              s.color = v.color || CURVE_COLORS[0];
              s.tag = v.tag || 'other';
              if (v.notes) s.notes = v.notes;
              s.geometry = v.geometry || { ...DEFAULT_GEOMETRY };
              s.measurements = v.measurements || [];
            } else {
              s.color = CURVE_COLORS[0];
              s.tag = 'other';
              s.geometry = { ...DEFAULT_GEOMETRY };
              s.measurements = s.measurements || [];
            }
            delete s.variants;
          }
          // Remove the top-level activeSessionId field if present.
          delete persisted.activeSessionId;
        }

        return persisted;
      },
    }
  )
);
