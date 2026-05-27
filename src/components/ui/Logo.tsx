// Fixed-position home logo at the top-left of the viewport. Clicking always
// returns to the welcome view (App.tsx is the project picker).
import { useViewStore } from '../../store/viewStore';

export function Logo() {
  const setView = useViewStore((s) => s.setView);
  const goHome = () => setView({ kind: 'empty' });
  return (
    <button
      onClick={goHome}
      aria-label="Home"
      className="fixed top-4 left-4 z-30 inline-flex items-center justify-center px-1 py-1 border-2 border-white rounded-md text-white font-sans font-normal text-[12pt] leading-none tracking-[0.04em] hover:border-accent hover:text-accent transition-colors focus:outline-none"
    >
      SW
    </button>
  );
}
