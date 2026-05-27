import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, Variant, Measurement, MicProfile } from '../types';
import { CURVE_COLORS } from '../types';
import { BUILT_IN_PROFILES } from '../data/micProfiles';

const uid = () => Math.random().toString(36).slice(2, 10);

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  customProfiles: MicProfile[];

  createSession: (name: string) => string;
  deleteSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  setActiveSession: (id: string | null) => void;
  setSessionMicProfile: (sessionId: string, micProfileId: string | null) => void;

  addVariant: (sessionId: string, name: string, tag: Variant['tag'], notes?: string) => string;
  updateVariant: (sessionId: string, variantId: string, patch: Partial<Variant>) => void;
  deleteVariant: (sessionId: string, variantId: string) => void;

  addMeasurement: (sessionId: string, variantId: string, m: Measurement) => void;
  deleteMeasurement: (sessionId: string, variantId: string, measurementId: string) => void;
  updateMeasurement: (sessionId: string, variantId: string, measurementId: string, patch: Partial<Measurement>) => void;

  addCustomProfile: (p: MicProfile) => void;
  deleteCustomProfile: (id: string) => void;
  getProfile: (id: string | null) => MicProfile | null;

  importSession: (s: Session) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      customProfiles: [],

      createSession: (name) => {
        const id = uid();
        const now = Date.now();
        const s: Session = { id, name, createdAt: now, updatedAt: now, micProfileId: 'flat', variants: [] };
        set((st) => ({ sessions: [s, ...st.sessions], activeSessionId: id }));
        return id;
      },
      deleteSession: (id) => set((st) => ({
        sessions: st.sessions.filter((s) => s.id !== id),
        activeSessionId: st.activeSessionId === id ? null : st.activeSessionId,
      })),
      renameSession: (id, name) => set((st) => ({
        sessions: st.sessions.map((s) => s.id === id ? { ...s, name, updatedAt: Date.now() } : s),
      })),
      setActiveSession: (id) => set({ activeSessionId: id }),
      setSessionMicProfile: (sessionId, micProfileId) => set((st) => ({
        sessions: st.sessions.map((s) => s.id === sessionId ? { ...s, micProfileId, updatedAt: Date.now() } : s),
      })),

      addVariant: (sessionId, name, tag, notes) => {
        const id = uid();
        set((st) => ({
          sessions: st.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            const color = CURVE_COLORS[s.variants.length % CURVE_COLORS.length];
            const v: Variant = { id, name, tag, notes, color, measurements: [] };
            return { ...s, variants: [...s.variants, v], updatedAt: Date.now() };
          }),
        }));
        return id;
      },
      updateVariant: (sessionId, variantId, patch) => set((st) => ({
        sessions: st.sessions.map((s) => s.id !== sessionId ? s : {
          ...s, updatedAt: Date.now(),
          variants: s.variants.map((v) => v.id === variantId ? { ...v, ...patch } : v),
        }),
      })),
      deleteVariant: (sessionId, variantId) => set((st) => ({
        sessions: st.sessions.map((s) => s.id !== sessionId ? s : {
          ...s, updatedAt: Date.now(),
          variants: s.variants.filter((v) => v.id !== variantId),
        }),
      })),

      addMeasurement: (sessionId, variantId, m) => set((st) => ({
        sessions: st.sessions.map((s) => s.id !== sessionId ? s : {
          ...s, updatedAt: Date.now(),
          variants: s.variants.map((v) => v.id !== variantId ? v : { ...v, measurements: [...v.measurements, m] }),
        }),
      })),
      deleteMeasurement: (sessionId, variantId, measurementId) => set((st) => ({
        sessions: st.sessions.map((s) => s.id !== sessionId ? s : {
          ...s, updatedAt: Date.now(),
          variants: s.variants.map((v) => v.id !== variantId ? v : { ...v, measurements: v.measurements.filter((m) => m.id !== measurementId) }),
        }),
      })),
      updateMeasurement: (sessionId, variantId, measurementId, patch) => set((st) => ({
        sessions: st.sessions.map((s) => s.id !== sessionId ? s : {
          ...s, updatedAt: Date.now(),
          variants: s.variants.map((v) => v.id !== variantId ? v : {
            ...v, measurements: v.measurements.map((m) => m.id === measurementId ? { ...m, ...patch } : m),
          }),
        }),
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
      version: 4,
      // Exclude the ungated impulse response from persistence. At 250 ms × 48 kHz
      // it's still ~150 KB per measurement, and several sessions × several
      // variants × several measurements will exceed localStorage's ~5 MB quota.
      // The waterfall view falls back to the gated `impulseResponse` when
      // `fullImpulseResponse` is empty, so loaded sessions still render — just
      // with slightly less time-domain detail in the CSD plot.
      partialize: (state) => ({
        ...state,
        sessions: state.sessions.map((s) => ({
          ...s,
          variants: s.variants.map((v) => ({
            ...v,
            measurements: v.measurements.map((m) => ({ ...m, fullImpulseResponse: [] })),
          })),
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
          // Old measurements only had `frequencyResponse` (smoothed). Mirror it into
          // smoothedResponse so the new raw/smoothed toggle has a fallback, and stub
          // the new ungated IR field.
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
        return persisted;
      },
    }
  )
);
