import { useEffect } from 'react';
import { Logo } from './components/ui/Logo';
import { MonoLink } from './components/ui/MonoLink';
import { Arrow } from './components/ui/lineart';
import { MeasurementWizard } from './components/wizard/MeasurementWizard';
import { useViewStore } from './store/viewStore';
import { useSessionStore } from './store/sessionStore';
import { exportSessionJson, importSessionJson } from './utils/export';
import type { Session } from './types';
import './engine/snrSelfTest';

// Compact relative time, departure-board style ("2 MIN", "3 HR", "5 DAY").
function relativeTime(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'JUST NOW';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} MIN`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} HR`;
  const d = Math.floor(h / 24);
  return `${d} DAY`;
}

function App() {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSession = useSessionStore((s) => s.sessions.find((x) => x.id === (view.kind === 'wizard' ? view.sessionId : null)));

  // Global keyboard shortcut: Cmd/Ctrl+S = save/export active session
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        const s = activeSession || sessions[0];
        if (s) exportSessionJson(s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeSession, sessions]);

  const openImportDialog = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.soundbench,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const s = importSessionJson(text);
        useSessionStore.getState().importSession(s);
        setView({ kind: 'wizard', sessionId: s.id });
      } catch {
        alert('That doesn\'t look like a valid SoundBench session file.');
      }
    };
    input.click();
  };

  const newProject = () => {
    const id = useSessionStore.getState().createSession('');
    setView({ kind: 'wizard', sessionId: id });
  };

  // Most-recently-updated first.
  const orderedProjects = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  let main: React.ReactNode;
  if (view.kind === 'empty') {
    main = (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-12 pt-24 pb-24">

          {/* ── Masthead ──────────────────────────────────────────────── */}
          <div className="flex items-end justify-between mb-16">
            <div>
              <h1 className="text-page-title-bold !text-[32px] leading-none">Sprecher-Werkstatt</h1>
              <p className="spec-label mt-3">Speaker Analysis Workbench · Log-Sweep Acoustic Measurement</p>
            </div>
            <div className="flex items-center gap-[18px]">
              <MonoLink active onClick={newProject}>New</MonoLink>
              <MonoLink onClick={openImportDialog}>Load</MonoLink>
            </div>
          </div>

          {/* ── Project index (departure-board grid) ──────────────────── */}
          <div>
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_8rem_7rem_7rem_1.5rem] items-end gap-4 pb-2 border-b border-border">
              <span className="spec-label">Project</span>
              <span className="spec-label">Config</span>
              <span className="spec-label text-right">Measurements</span>
              <span className="spec-label text-right">Updated</span>
              <span />
            </div>

            {orderedProjects.length === 0 ? (
              <div className="data-row py-8 text-center">
                <span className="spec-label">No projects — press NEW to begin</span>
              </div>
            ) : (
              orderedProjects.map((s: Session) => (
                <button
                  key={s.id}
                  onClick={() => setView({ kind: 'wizard', sessionId: s.id })}
                  className="data-row group w-full grid grid-cols-[1fr_8rem_7rem_7rem_1.5rem] items-center gap-4 py-4 text-left"
                >
                  {/* Name */}
                  <div className="min-w-0">
                    <div className="text-sm font-sans text-[#9CA3A0] group-hover:text-white transition-colors truncate capitalize">
                      {s.name || 'Untitled project'}
                    </div>
                  </div>
                  {/* Config / enclosure tag */}
                  <span className="font-mono text-xs uppercase tracking-[0.04em] text-[#6B6B70] group-hover:text-white transition-colors truncate">
                    {s.geometry?.enclosure ?? '—'}
                  </span>
                  {/* Measurement count */}
                  <span className="font-mono text-sm tabular-nums text-[#9CA3A0] group-hover:text-white transition-colors text-right">
                    {String(s.measurements.length).padStart(2, '0')}
                  </span>
                  {/* Updated */}
                  <span className="font-mono text-xs uppercase tracking-[0.04em] text-[#6B6B70] group-hover:text-white transition-colors text-right">
                    {relativeTime(s.updatedAt)}
                  </span>
                  {/* Arrow */}
                  <span className="text-[#6B6B70] group-hover:text-accent transition-colors flex justify-end"><Arrow dir="right" size={16} /></span>
                </button>
              ))
            )}
          </div>

        </div>
      </div>
    );
  } else if (view.kind === 'wizard') {
    main = <MeasurementWizard sessionId={view.sessionId} />;
  }

  return (
    <div className="h-full flex flex-col">
      <Logo />
      <div className="flex-1 overflow-hidden flex">{main}</div>
    </div>
  );
}

export default App;
