import { useMemo, useRef, useState } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { useViewStore } from '../../store/viewStore';
import { PageShell } from '../layout/PageShell';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { FrequencyChart } from './FrequencyChart';
import { PolarPlot } from './PolarPlot';
import { WaterfallPanel } from './WaterfallPanel';
import { exportCsv, exportFrd, exportPdf } from '../../utils/export';
import type { Measurement } from '../../types';

type Tab = 'fr' | 'directivity' | 'waterfall';

export function Dashboard({ sessionId, embedded = false }: { sessionId: string; embedded?: boolean }) {
  const session = useSessionStore((s) => s.sessions.find((x) => x.id === sessionId));
  const deleteMeasurement = useSessionStore((s) => s.deleteMeasurement);
  const setView = useViewStore((s) => s.setView);
  const [tab, setTab] = useState<Tab>('fr');
  const [smoothed, setSmoothed] = useState(true);
  const [showDiff, setShowDiff] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [polarFreq, setPolarFreq] = useState(1000);
  const [directivityVariantId, setDirectivityVariantId] = useState<string | null>(session?.variants[0]?.id ?? null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement | null>(null);

  if (!session) return null;

  const allMeasurements: { variantId: string; variantName: string; color: string; m: Measurement }[] = [];
  for (const v of session.variants) for (const m of v.measurements) allMeasurements.push({ variantId: v.id, variantName: v.name, color: v.color, m });

  const series = useMemo(() => allMeasurements.filter(({ m }) => !hiddenIds.has(m.id)).map(({ variantName, color, m }) => ({
    name: `${variantName} — ${m.position}`,
    color,
    data: smoothed ? (m.smoothedResponse || m.frequencyResponse) : (m.frequencyResponse || m.smoothedResponse),
  })), [allMeasurements, hiddenIds, smoothed]);

  const diffSeries = useMemo(() => {
    if (!showDiff || series.length < 2) return null;
    const a = series[0];
    const b = series[1];
    const data = a.data.map((p, i) => ({ f: p.f, db: (b.data[i]?.db ?? 0) - p.db }));
    return { name: `Δ (${b.name} − ${a.name})`, color: '#9C9A96', data };
  }, [series, showDiff]);

  const directivityVariant = session.variants.find((v) => v.id === directivityVariantId) || session.variants[0];
  const directivitySeries = useMemo(() => {
    if (!directivityVariant) return [];
    return directivityVariant.measurements.map((m, i, arr) => {
      const hue = 220 - (i / Math.max(1, arr.length - 1)) * 180;
      return { name: m.position, color: `hsl(${hue}, 70%, 60%)`, data: m.smoothedResponse || m.frequencyResponse };
    });
  }, [directivityVariant]);

  const selectedMeasurement = useMemo(() => {
    const found = allMeasurements.find(({ m }) => m.id === selectedMeasurementId);
    return found?.m ?? allMeasurements[0]?.m ?? null;
  }, [selectedMeasurementId, allMeasurements]);

  const toggle = (id: string) => {
    const next = new Set(hiddenIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setHiddenIds(next);
  };

  const actions = (
    <>
      {!embedded && (
        <Button size="sm" variant="secondary" onClick={() => setView({ kind: 'empty' })}>Home</Button>
      )}
      <Button size="sm" variant="secondary" onClick={() => exportCsv(session)}>Export CSV</Button>
      <Button size="sm" variant="secondary" onClick={() => pdfRef.current && exportPdf(pdfRef.current, session)}>Export PDF</Button>
    </>
  );

  const body = (
    <div ref={pdfRef}>
        <div className="flex gap-1 border-b border-border mb-6">
          {([['fr', 'Frequency'], ['directivity', 'Directivity'], ['waterfall', 'Waterfall']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === v ? 'border-accent text-ink font-medium' : 'border-transparent text-white font-light hover:text-ink'}`}>{l}</button>
          ))}
        </div>

        {tab === 'fr' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-white font-light">
                <input type="checkbox" checked={smoothed} onChange={(e) => setSmoothed(e.target.checked)} />
                1/24-octave smoothed
              </label>
              <label className="flex items-center gap-2 text-sm text-white font-light">
                <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} disabled={series.length < 2} />
                Show difference (B − A)
              </label>
            </div>
            <FrequencyChart series={series} diffSeries={diffSeries} />

            <div className="flex flex-wrap gap-2 mt-2">
              {allMeasurements.map(({ variantName, color, m }) => {
                const hidden = hiddenIds.has(m.id);
                return (
                  <button key={m.id} onClick={() => toggle(m.id)} className={`flex items-center gap-2 rounded-btn border px-3 py-1.5 text-xs ${hidden ? 'bg-surface border-border text-white font-light line-through' : 'bg-surface border-border text-ink'}`}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    {variantName} — {m.position}
                  </button>
                );
              })}
            </div>

            <section className="border border-border rounded-card p-5 mt-6">
              <h3 className="text-sm font-semibold text-ink mb-3">Measurements</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-white font-light border-b border-border">
                    <th className="py-2">Variant</th><th>Position</th><th>Sens @ 1k</th><th>−3 dB low</th><th>−3 dB high</th><th>SNR</th><th>Mic</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {allMeasurements.map(({ variantName, color, m }) => (
                    <tr key={m.id} className="border-b border-border/60">
                      <td className="py-2"><Badge color={color}>{variantName}</Badge></td>
                      <td>{m.position}</td>
                      <td className="font-mono">{m.metrics.sensitivity1k.toFixed(1)} dB</td>
                      <td className="font-mono">{m.metrics.minus3dbLow ? `${m.metrics.minus3dbLow.toFixed(0)} Hz` : '—'}</td>
                      <td className="font-mono">{m.metrics.minus3dbHigh ? `${(m.metrics.minus3dbHigh / 1000).toFixed(1)} kHz` : '—'}</td>
                      <td className="font-mono">
                        {isFinite(m.metrics.snrDb) ? (
                          <span className={m.metrics.snrDb < 10 ? 'text-danger' : m.metrics.snrDb < 20 ? 'text-warn' : 'text-success'}>
                            {m.metrics.snrDb.toFixed(0)} dB
                          </span>
                        ) : '—'}
                      </td>
                      <td className="text-xs text-white font-light">{m.micProfileId || '—'}</td>
                      <td className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => exportFrd(session, variantName, m)}>.frd</Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete this measurement?')) deleteMeasurement(session.id, allMeasurements.find((x) => x.m.id === m.id)!.variantId, m.id); }}>×</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {tab === 'directivity' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-white font-light">Variant:</label>
              <select className="h-8 rounded-btn border border-border bg-surface px-2 text-sm" value={directivityVariant?.id || ''} onChange={(e) => setDirectivityVariantId(e.target.value)}>
                {session.variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <label className="text-sm text-white font-light ml-4">Polar frequency:</label>
              <select className="h-8 rounded-btn border border-border bg-surface px-2 text-sm font-mono" value={polarFreq} onChange={(e) => setPolarFreq(parseInt(e.target.value))}>
                {[250, 500, 1000, 2000, 4000, 8000].map((f) => <option key={f} value={f}>{f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FrequencyChart series={directivitySeries} />
              <PolarPlot variants={[directivityVariant].filter(Boolean) as typeof session.variants} frequency={polarFreq} />
            </div>
          </div>
        )}

        {tab === 'waterfall' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-white font-light">Measurement:</label>
              <select className="h-8 rounded-btn border border-border bg-surface px-2 text-sm" value={selectedMeasurement?.id || ''} onChange={(e) => setSelectedMeasurementId(e.target.value)}>
                {allMeasurements.map(({ variantName, m }) => <option key={m.id} value={m.id}>{variantName} — {m.position}</option>)}
              </select>
            </div>
            {selectedMeasurement ? (
              <WaterfallPanel measurement={selectedMeasurement} />
            ) : (
              <div className="text-sm text-white font-light">No measurements yet.</div>
            )}
          </div>
        )}
      </div>
  );

  if (embedded) {
    return (
      <div className="max-w-6xl mx-auto px-8 py-6">
        <div className="flex justify-end gap-2 mb-4 flex-wrap">{actions}</div>
        {body}
      </div>
    );
  }
  return (
    <PageShell title={`${session.name} — Results`} actions={actions}>
      {body}
    </PageShell>
  );
}
