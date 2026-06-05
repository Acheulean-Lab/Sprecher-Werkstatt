import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { Button } from '../ui/Button';
import { FrequencyChart } from './FrequencyChart';
import { PolarPlot } from './PolarPlot';
import { WaterfallPanel } from './WaterfallPanel';
import { exportCsv, exportFrd, exportPdf } from '../../utils/export';
import { CURVE_COLORS } from '../../types';

type Tab = 'fr' | 'directivity' | 'waterfall';

export function Dashboard({ sessionId, footerLeft }: { sessionId: string; footerLeft?: ReactNode }) {
  const session = useSessionStore((s) => s.sessions.find((x) => x.id === sessionId));
  const deleteMeasurement = useSessionStore((s) => s.deleteMeasurement);

  const [tab, setTab] = useState<Tab>('fr');
  const [smoothed, setSmoothed] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [polarFreq, setPolarFreq] = useState(1000);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement | null>(null);

  // Assign a stable color to each measurement by position index.
  // All hooks must come before the early-return guard.
  const allMeasurements = useMemo(
    () => (session?.measurements ?? []).map((m, i) => ({
      color: CURVE_COLORS[i % CURVE_COLORS.length] as string,
      m,
    })),
    [session?.measurements]
  );

  const series = useMemo(
    () => allMeasurements
      .filter(({ m }) => !hiddenIds.has(m.id))
      .map(({ color, m }) => ({
        name: m.position,
        color,
        data: smoothed
          ? (m.smoothedResponse || m.frequencyResponse)
          : (m.frequencyResponse || m.smoothedResponse),
      })),
    [allMeasurements, hiddenIds, smoothed]
  );

  const directivitySeries = useMemo(
    () => (session?.measurements ?? []).map((m, i, arr) => {
      const hue = 220 - (i / Math.max(1, arr.length - 1)) * 180;
      return {
        name: m.position,
        color: `hsl(${hue}, 70%, 60%)`,
        data: m.smoothedResponse || m.frequencyResponse,
      };
    }),
    [session?.measurements]
  );

  const selectedMeasurement = useMemo(() => {
    const found = allMeasurements.find(({ m }) => m.id === selectedMeasurementId);
    return found?.m ?? allMeasurements[0]?.m ?? null;
  }, [selectedMeasurementId, allMeasurements]);

  if (!session) return null;

  const toggle = (id: string) => {
    const next = new Set(hiddenIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setHiddenIds(next);
  };

  const exportActions = (
    <>
      <Button size="sm" variant="secondary" onClick={() => exportCsv(session)}>Export CSV</Button>
      <Button size="sm" variant="secondary" onClick={() => pdfRef.current && exportPdf(pdfRef.current, session)}>Export PDF</Button>
    </>
  );

  const body = (
    <div ref={pdfRef}>
      {/* Mono uppercase tabs with hairline rule */}
      <div className="flex gap-6 border-b border-border mb-8">
        {([['fr', 'Frequency'], ['directivity', 'Directivity'], ['waterfall', 'Waterfall']] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`pb-3 -mb-px border-b font-mono text-sm uppercase tracking-[0.04em] transition-colors ${tab === v ? 'border-white text-white' : 'border-transparent text-[#6B6B70] hover:text-white'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'fr' && (
        <div className="space-y-8">
          <label className="flex items-center gap-2 spec-label cursor-pointer">
            <input type="checkbox" checked={smoothed} onChange={(e) => setSmoothed(e.target.checked)} />
            1/24-octave smoothed
          </label>

          <FrequencyChart series={series} />

          {/* Series toggles — line-art chips */}
          <div className="flex flex-wrap gap-2">
            {allMeasurements.map(({ color, m }) => {
              const hidden = hiddenIds.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className={`flex items-center gap-2 border px-3 h-8 font-mono text-xs uppercase tracking-[0.04em] transition-colors ${hidden ? 'border-border text-[#6B6B70] line-through' : 'border-border text-white hover:border-white'}`}
                >
                  <span className="w-2 h-2" style={{ backgroundColor: color }} />
                  {m.position}
                </button>
              );
            })}
          </div>

          {/* Measurements — departure-board grid */}
          <section>
            <div className="spec-label mb-2">Measurements</div>
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_6rem_6rem_6rem_5rem_6rem_4rem] items-end gap-3 pb-2">
              <span className="spec-label">Position</span>
              <span className="spec-label text-right">Sens @ 1k</span>
              <span className="spec-label text-right">−3 dB Lo</span>
              <span className="spec-label text-right">−3 dB Hi</span>
              <span className="spec-label text-right">SNR</span>
              <span className="spec-label">Mic</span>
              <span />
            </div>
            {allMeasurements.map(({ color, m }) => (
              <div
                key={m.id}
                className="data-row grid grid-cols-[1fr_6rem_6rem_6rem_5rem_6rem_4rem] items-center gap-3 py-3"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-mono text-xs uppercase tracking-[0.04em] text-white truncate">{m.position}</span>
                </span>
                <span className="font-mono text-sm tabular-nums text-white text-right">{m.metrics.sensitivity1k.toFixed(1)}</span>
                <span className="font-mono text-sm tabular-nums text-white text-right">{m.metrics.minus3dbLow ? m.metrics.minus3dbLow.toFixed(0) : '—'}</span>
                <span className="font-mono text-sm tabular-nums text-white text-right">{m.metrics.minus3dbHigh ? (m.metrics.minus3dbHigh / 1000).toFixed(1) + 'k' : '—'}</span>
                <span className="font-mono text-sm tabular-nums text-right">
                  {isFinite(m.metrics.snrDb) ? (
                    <span className={m.metrics.snrDb < 10 ? 'text-danger' : m.metrics.snrDb < 20 ? 'text-warn' : 'text-success'}>
                      {m.metrics.snrDb.toFixed(0)}
                    </span>
                  ) : '—'}
                </span>
                <span className="spec-label truncate">{m.micProfileId || '—'}</span>
                <span className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => exportFrd(session, m)}>.frd</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { if (confirm('Delete this measurement?')) deleteMeasurement(session.id, m.id); }}
                  >
                    ×
                  </Button>
                </span>
              </div>
            ))}
            <div className="border-t border-border" />
          </section>
        </div>
      )}

      {tab === 'directivity' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="spec-label">Polar frequency</span>
            <select
              className="h-8 border border-border bg-black px-2 font-mono text-xs uppercase tracking-[0.04em] text-white hover:border-white transition-colors focus:outline-none"
              value={polarFreq}
              onChange={(e) => setPolarFreq(parseInt(e.target.value))}
            >
              {[250, 500, 1000, 2000, 4000, 8000].map((f) => (
                <option key={f} value={f} className="bg-black">{f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <FrequencyChart series={directivitySeries} />
            <PolarPlot
              variants={[{ id: session.id, name: session.name, color: session.color, measurements: session.measurements }]}
              frequency={polarFreq}
            />
          </div>
        </div>
      )}

      {tab === 'waterfall' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="spec-label">Measurement</span>
            <select
              className="h-8 border border-border bg-black px-2 font-mono text-xs uppercase tracking-[0.04em] text-white hover:border-white transition-colors focus:outline-none"
              value={selectedMeasurement?.id || ''}
              onChange={(e) => setSelectedMeasurementId(e.target.value)}
            >
              {allMeasurements.map(({ m }) => (
                <option key={m.id} value={m.id} className="bg-black">{m.position}</option>
              ))}
            </select>
          </div>
          {selectedMeasurement ? (
            <WaterfallPanel measurement={selectedMeasurement} />
          ) : (
            <div className="spec-label">No measurements yet.</div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full">
      {body}
      {/* Footer — back nav on the left, exports on the right, matching the
          other wizard steps' footer placement. */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-8">
        <div>{footerLeft}</div>
        <div className="flex gap-2">{exportActions}</div>
      </div>
    </div>
  );
}
