import type { Session, Measurement } from '../types';

export function exportSessionJson(session: Session) {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${safeFilename(session.name)}.soundbench`);
}

export function importSessionJson(text: string): Session {
  const s = JSON.parse(text);
  if (!s.id || !s.name || !Array.isArray(s.variants)) throw new Error('Invalid session');
  return s as Session;
}

export function exportCsv(session: Session) {
  // One column per measurement
  const columns: { header: string; data: Map<number, number> }[] = [];
  const allFreqs = new Set<number>();

  for (const v of session.variants) {
    for (const m of v.measurements) {
      const header = `${v.name}_${m.position}_db`.replace(/[^\w]+/g, '_');
      const data = new Map<number, number>();
      for (const p of m.frequencyResponse) { data.set(p.f, p.db); allFreqs.add(p.f); }
      columns.push({ header, data });
    }
  }

  const freqs = Array.from(allFreqs).sort((a, b) => a - b);
  const rows: string[] = [];
  rows.push(['frequency_hz', ...columns.map((c) => c.header)].join(','));
  for (const f of freqs) {
    const row = [f.toFixed(2), ...columns.map((c) => {
      const v = c.data.get(f);
      return v === undefined ? '' : v.toFixed(3);
    })];
    rows.push(row.join(','));
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  downloadBlob(blob, `${safeFilename(session.name)}.csv`);
}

export function exportFrd(session: Session, variantName: string, m: Measurement) {
  const lines: string[] = [];
  lines.push(`* Exported from SoundBench`);
  lines.push(`* Session: ${session.name}`);
  lines.push(`* Variant: ${variantName} | Position: ${m.position}`);
  lines.push(`* Date: ${new Date(m.timestamp).toISOString().slice(0, 10)}`);
  for (const p of m.frequencyResponse) {
    lines.push(`${p.f.toFixed(2).padStart(10)}   ${p.db.toFixed(2).padStart(7)}   0.00`);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  downloadBlob(blob, `${safeFilename(session.name)}_${safeFilename(variantName)}_${safeFilename(m.position)}.frd`);
}

export async function exportPdf(containerEl: HTMLElement, session: Session) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const canvas = await html2canvas(containerEl, { scale: 2, backgroundColor: '#FAFAF9' });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / canvas.height;
  const imgW = pw - 40;
  const imgH = imgW / ratio;
  pdf.setFontSize(16);
  pdf.text('SoundBench Report', 20, 28);
  pdf.setFontSize(10);
  pdf.text(`${session.name}  ·  ${new Date().toLocaleDateString()}`, 20, 44);
  let y = 60;
  if (imgH > ph - y) {
    // Scale to fit
    const fitH = ph - y - 20;
    const fitW = fitH * ratio;
    pdf.addImage(imgData, 'PNG', 20, y, Math.min(imgW, fitW), Math.min(imgH, fitH));
  } else {
    pdf.addImage(imgData, 'PNG', 20, y, imgW, imgH);
  }
  pdf.save(`${safeFilename(session.name)}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(s: string) {
  return s.replace(/[^\w\-]+/g, '_').slice(0, 80) || 'soundbench';
}
