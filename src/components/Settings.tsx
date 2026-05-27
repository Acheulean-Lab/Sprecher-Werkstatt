import { useEffect, useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useSessionStore } from '../store/sessionStore';
import { PageShell } from './layout/PageShell';
import { Input, Label, Select } from './ui/Input';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { BUILT_IN_PROFILES, parseCalFile } from '../data/micProfiles';
import { listAudioDevices } from '../engine/recorder';
import type { MicProfile } from '../types';

export function Settings() {
  const s = useSettingsStore();
  const customProfiles = useSessionStore((st) => st.customProfiles);
  const addCustomProfile = useSessionStore((st) => st.addCustomProfile);
  const deleteCustomProfile = useSessionStore((st) => st.deleteCustomProfile);
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    listAudioDevices().then((d) => { setInputs(d.inputs); setOutputs(d.outputs); }).catch(() => { /* ignore */ });
  }, []);

  const upload = async (file: File) => {
    const text = await file.text();
    const pts = parseCalFile(text);
    if (pts.length < 2) { alert('Could not parse file.'); return; }
    const p: MicProfile = { id: `custom-${Date.now()}`, name: file.name.replace(/\.[^.]+$/, ''), builtIn: false, points: pts };
    addCustomProfile(p);
  };

  return (
    <PageShell title="Settings">
      <div className="space-y-6">
        <Card title="Sweep parameters">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Start frequency (Hz)</Label><Input type="number" value={s.sweepF1} onChange={(e) => s.setSweepF1(parseFloat(e.target.value))} /></div>
            <div><Label>End frequency (Hz)</Label><Input type="number" value={s.sweepF2} onChange={(e) => s.setSweepF2(parseFloat(e.target.value))} /></div>
            <div><Label>Duration (s)</Label><Input type="number" step={0.5} value={s.sweepDuration} onChange={(e) => s.setSweepDuration(parseFloat(e.target.value))} /></div>
          </div>
          <Label className="mt-3">Gate time (ms)</Label>
          <Input type="number" value={s.gateMs} onChange={(e) => s.setGateMs(parseFloat(e.target.value))} />
          <p className="text-xs text-white font-light mt-1">Higher gate times include more room information. 5 ms is typical for 1 m far-field.</p>
        </Card>

        <Card title="Audio devices">
          <Label>Preferred input</Label>
          <Select value={s.inputDeviceId ?? ''} onChange={(e) => s.setInputDevice(e.target.value || null)}>
            <option value="">System default</option>
            {inputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId.slice(0, 8)}</option>)}
          </Select>
          <Label className="mt-3">Preferred output</Label>
          <Select value={s.outputDeviceId ?? ''} onChange={(e) => s.setOutputDevice(e.target.value || null)}>
            <option value="">System default</option>
            {outputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId.slice(0, 8)}</option>)}
          </Select>
          <p className="text-xs text-white font-light mt-1">Browsers generally route output to the system default. Use your OS audio settings for device-level routing.</p>
        </Card>

        <Card title="Microphone profiles">
          <div className="space-y-2">
            {BUILT_IN_PROFILES.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.name}</span><Badge>built-in</Badge>
              </div>
            ))}
            {customProfiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <div className="flex items-center gap-2"><Badge>custom</Badge><Button size="sm" variant="ghost" onClick={() => deleteCustomProfile(p.id)}>Delete</Button></div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <input type="file" accept=".cal,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border rounded-card p-5">
      <h2 className="text-sm font-semibold text-ink mb-3">{title}</h2>
      {children}
    </section>
  );
}
