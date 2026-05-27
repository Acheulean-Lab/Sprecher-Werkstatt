import { useEffect } from 'react';
import { Logo } from './components/ui/Logo';
import { MeasurementWizard } from './components/wizard/MeasurementWizard';
import { Dashboard } from './components/dashboard/Dashboard';
import { Settings } from './components/Settings';
import { useViewStore } from './store/viewStore';
import { useSessionStore } from './store/sessionStore';
import { PageShell } from './components/layout/PageShell';
import { exportSessionJson, importSessionJson } from './utils/export';
import './engine/snrSelfTest';

function App() {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSession = useSessionStore((s) => s.sessions.find((x) => x.id === s.activeSessionId));

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
        setView({ kind: 'wizard', sessionId: s.id, variantId: s.variants[0]?.id });
      } catch {
        alert('That doesn\'t look like a valid SoundBench session file.');
      }
    };
    input.click();
  };

  const newProject = () => {
    const id = useSessionStore.getState().createSession('Untitled project');
    setView({ kind: 'wizard', sessionId: id });
  };

  // Sort most-recently-updated first so the active project sits at the top.
  const orderedProjects = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  let main: React.ReactNode;
  if (view.kind === 'empty') {
    main = (
      <PageShell>
        <div className="max-w-xl mx-auto text-center py-24">
          <h2 className="inline-block tracking-[0.04em] uppercase text-3xl px-2 py-1 font-normal text-white mb-4 border-white border-2 rounded-md ">Sprecher-Werkstatt</h2>
          <p className="text-md font-light text-white mb-4">Speaker analysis</p>
          <div className="inline-flex flex-row gap-[18px]">
            <button
              className="inline-flex items-center h-7 px-2 font-mono text-base uppercase tracking-[0.04em] bg-transparent text-white border-b border-white hover:text-accent hover:border-accent transition-colors"
              onClick={newProject}
            >
              New
            </button>
            <button
              className="inline-flex items-center h-7 px-2 font-mono text-base uppercase tracking-[0.04em] bg-transparent text-[#939393] border-b border-transparent hover:text-white hover:border-white transition-colors"
              onClick={openImportDialog}
            >
              Load
            </button>
          </div>

          {/* Project list — one stacked button per saved session, most recent
              at the top.  Empty when no sessions exist yet. */}
          <div className="mt-12 flex flex-col items-center gap-1">
            {orderedProjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setView({ kind: 'wizard', sessionId: s.id, variantId: s.variants[0]?.id })}
                className="font-mono text-base uppercase tracking-[0.04em] text-[#939393] hover:text-white border-b border-transparent hover:border-white px-2 h-7 inline-flex items-center transition-colors"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </PageShell>
    );
  } else if (view.kind === 'settings') main = <Settings />;
  else if (view.kind === 'wizard') main = <MeasurementWizard sessionId={view.sessionId} initialVariantId={view.variantId} />;
  else if (view.kind === 'dashboard') main = <Dashboard sessionId={view.sessionId} />;

  return (
    <div className="h-full flex flex-col">
      <Logo />
      <div className="flex-1 overflow-hidden flex">{main}</div>
    </div>
  );
}

export default App;
