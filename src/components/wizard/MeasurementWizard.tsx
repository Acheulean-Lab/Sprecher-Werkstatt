import { useEffect, useMemo, useRef, useState } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Stepper } from '../ui/Stepper';
import { TerminalButton } from '../ui/TerminalButton';
import { TerminalDropdown } from '../ui/TerminalDropdown';
import { Arrow, SectionHeading, CheckMark } from '../ui/lineart';
import { AudioLevelMeter } from '../ui/AudioLevelMeter';
import { BUILT_IN_PROFILES, parseCalFile } from '../../data/micProfiles';
import { POSITION_PRESETS, DEFAULT_GEOMETRY } from '../../types';
import type { Measurement, MicProfile, SpeakerGeometry, DriverPosition, EnclosureType } from '../../types';
import { SpeakerCube } from '../ui/SpeakerCube';
import { generateLogSweep } from '../../engine/sweepGenerator';
import { capture, listAudioDevices, playTestTone, refreshDeviceLabels } from '../../engine/recorder';
import { processMeasurement } from '../../engine/pipeline';
import { analyzeNoiseFloor } from '../../engine/noiseFloor';
import { FrequencyChart } from '../dashboard/FrequencyChart';
import { Dashboard } from '../dashboard/Dashboard';

type Step = 'setup' | 'calibrate' | 'capture' | 'analysis';
type CaptureSub = 'pick' | 'ready' | 'sweeping' | 'review';

const STEPS: Step[] = ['setup', 'calibrate', 'capture', 'analysis'];
const STEP_LABELS: Record<Step, string> = {
  setup: 'Setup',
  calibrate: 'Calibrate',
  capture: 'Capture',
  analysis: 'Analysis',
};
const STEP_TITLES: Record<Step, string> = {
  setup: 'Setup the project',
  calibrate: 'Calibrate the room and output level',
  capture: 'Capture measurements',
  analysis: 'Analyze the results',
};

export function MeasurementWizard({ sessionId }: { sessionId: string }) {
  const session = useSessionStore((s) => s.sessions.find((x) => x.id === sessionId));
  const updateSession = useSessionStore((s) => s.updateSession);
  const addMeasurement = useSessionStore((s) => s.addMeasurement);
  const addCustomProfile = useSessionStore((s) => s.addCustomProfile);
  const getProfile = useSessionStore((s) => s.getProfile);
  const customProfiles = useSessionStore((s) => s.customProfiles);
  const settings = useSettingsStore();

  const [step, setStep] = useState<Step>('setup');

  // ── Setup state ─────────────────────────────────────────────────────────
  const [sessionName, setSessionName] = useState(session?.name || '');
  // tag and notes are still part of the data model, but no longer surfaced on
  // Setup — the new Figma collapsed those affordances. We leave the existing
  // values untouched when committing.
  const [geometry, setGeometry] = useState<SpeakerGeometry>(() => session?.geometry ?? { ...DEFAULT_GEOMETRY });
  const [micProfileId, setMicProfileId] = useState<string | null>(session?.micProfileId || 'flat');
  const [inputDeviceId, setInputDeviceId] = useState<string | null>(settings.inputDeviceId);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);

  // ── Calibrate state ─────────────────────────────────────────────────────
  // Each section has three UI states: before / during / after
  const [noiseState, setNoiseState] = useState<'before' | 'during' | 'after'>('before');
  const [noiseWarning, setNoiseWarning] = useState<string | null>(null);
  const [toneState, setToneState] = useState<'before' | 'during' | 'after'>('before');
  const stopToneRef = useRef<(() => void) | null>(null);
  const [calibLiveLevel, setCalibLiveLevel] = useState(-60);

  // ── Capture state ───────────────────────────────────────────────────────
  const [captureSub, setCaptureSub] = useState<CaptureSub>('pick');
  const [positionId, setPositionId] = useState<string>('on-axis');
  const [customPositionLabel, setCustomPositionLabel] = useState<string>('');
  const [sweeping, setSweeping] = useState(false);
  const [liveLevel, setLiveLevel] = useState(-60);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Measurement | null>(null);
  const [measurementNotes, setMeasurementNotes] = useState('');
  const [measurementName, setMeasurementName] = useState('');
  const [signalWarning, setSignalWarning] = useState<string | null>(null);

  const captureHandleRef = useRef<{ stop: () => Promise<{ recording: Float32Array; sampleRate: number; peakDbfs: number }>; abort: () => void } | null>(null);
  // The wizard's outer scrollable container; reset on step transitions so the
  // user sees the top of the next step rather than landing scrolled down.
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);

  const allProfiles: MicProfile[] = [...BUILT_IN_PROFILES, ...customProfiles];
  const measurements = session?.measurements ?? [];

  // ── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    listAudioDevices().then((d) => {
      setInputDevices(d.inputs);
      if (!inputDeviceId && d.inputs[0]) setInputDeviceId(d.inputs[0].deviceId);
    }).catch(() => { /* ignore */ });
  }, []);

  useEffect(() => () => { stopToneRef.current?.(); }, []);

  // Auto-stop the calibration test tone the moment the user leaves the
  // Calibrate step.
  useEffect(() => {
    if (step !== 'calibrate' && toneState === 'during') {
      stopToneRef.current?.();
      stopToneRef.current = null;
      setToneState('before');
    }
  }, [step, toneState]);

  // Spacebar → stop sweep; arrow keys → step navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && sweeping) {
        e.preventDefault();
        captureHandleRef.current?.abort();
        setSweeping(false);
      }
      const isInput = (e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/);
      if (isInput || sweeping) return;
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!session) return null;

  // ── Step navigation ─────────────────────────────────────────────────────
  const stepIdx = STEPS.indexOf(step);
  const canAdvance = (from: Step): boolean => {
    if (from === 'calibrate') return toneState === 'after';
    if (from === 'capture') return measurements.length > 0;
    return true;
  };
  const goNext = () => {
    if (step === 'setup') return commitSetupAndAdvance();
    if (step === 'calibrate' && toneState !== 'after') return;
    if (step === 'capture' && measurements.length === 0) return;
    const next = STEPS[Math.min(STEPS.length - 1, stepIdx + 1)];
    setStep(next);
  };
  const goPrev = () => {
    const prev = STEPS[Math.max(0, stepIdx - 1)];
    setStep(prev);
  };

  const commitSetupAndAdvance = () => {
    updateSession(sessionId, {
      name: sessionName.trim() || session.name || 'Untitled project',
      geometry,
      micProfileId,
    });
    settings.setInputDevice(inputDeviceId);
    setStep('calibrate');
  };

  // ── Calibrate handlers ──────────────────────────────────────────────────
  const handleUploadCal = async (file: File) => {
    const text = await file.text();
    const points = parseCalFile(text);
    if (points.length < 2) { alert('Could not parse calibration file.'); return; }
    const id = `custom-${Date.now()}`;
    const profile: MicProfile = { id, name: file.name.replace(/\.[^.]+$/, ''), builtIn: false, points };
    addCustomProfile(profile);
    setMicProfileId(id);
  };

  const startNoiseCheck = async () => {
    setNoiseState('during');
    setCalibLiveLevel(-60);
    try {
      const handle = await capture(inputDeviceId, null, 3, 48000);
      handle.onLevel((v) => setCalibLiveLevel(v));
      captureHandleRef.current = handle;
      await new Promise((r) => setTimeout(r, 3100));
      const { recording, sampleRate } = await handle.stop();
      captureHandleRef.current = null;
      const { exceedsLowBand } = analyzeNoiseFloor(recording, sampleRate);
      setNoiseWarning(exceedsLowBand ? 'Low-frequency noise is elevated. This may corrupt measurements below 500 Hz. Try again in a quieter moment.' : null);
      setNoiseState('after');
      refreshDeviceLabels().then((d) => setInputDevices(d.inputs));
    } catch {
      alert('Could not access microphone. Grant permission in your browser/OS settings and try again.');
      setNoiseState('before');
    }
  };

  const stopNoiseCheck = () => {
    captureHandleRef.current?.abort();
    captureHandleRef.current = null;
    setNoiseState('before');
    setCalibLiveLevel(-60);
  };

  const startTestTone = async () => {
    try {
      const stop = await playTestTone(1000, 600, 0.01);
      stopToneRef.current = stop;
      setToneState('during');
    } catch {
      alert('Could not start the test tone. Check your audio output.');
    }
  };

  const stopTestTone = () => {
    stopToneRef.current?.();
    stopToneRef.current = null;
    setToneState('after');
  };

  // ── Capture handlers ────────────────────────────────────────────────────
  const startSweep = async () => {
    setSignalWarning(null);
    try {
      const sr = 48000;
      const sweep = generateLogSweep(settings.sweepF1, settings.sweepF2, settings.sweepDuration, sr);
      const handle = await capture(inputDeviceId, sweep.samples, settings.sweepDuration + 0.5, sr);
      handle.onLevel((v) => setLiveLevel(v));
      captureHandleRef.current = handle;
      setSweeping(true);
      setCaptureSub('sweeping');
      await new Promise((r) => setTimeout(r, (settings.sweepDuration + 0.6) * 1000));
      const { recording, sampleRate, peakDbfs } = await handle.stop();
      setSweeping(false);
      captureHandleRef.current = null;

      if (peakDbfs < -60) setSignalWarning('No signal detected. Check that your mic is connected and your speaker is playing.');
      else if (peakDbfs > -3) setSignalWarning('Signal is clipping. Lower your playback volume and re-measure.');

      setProcessing(true);
      await new Promise((r) => setTimeout(r, 50));

      const micProfile = getProfile(micProfileId);
      const processed = processMeasurement(recording, sweep, sampleRate, settings.gateMs, micProfile);
      const positionLabel = positionId === 'custom' ? (customPositionLabel || 'Custom') : (POSITION_PRESETS.find((p) => p.id === positionId)?.label || positionId);

      const m: Measurement = {
        id: `m-${Date.now()}`,
        name: `${positionLabel} – ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        position: positionLabel,
        timestamp: Date.now(),
        sweep: { f1: settings.sweepF1, f2: settings.sweepF2, duration: settings.sweepDuration, sampleRate },
        frequencyResponse: processed.raw,
        smoothedResponse: processed.smoothed,
        impulseResponse: processed.impulseResponse,
        fullImpulseResponse: processed.fullImpulseResponse,
        peakIndex: processed.peakIndex,
        micProfileId,
        metrics: { ...processed.metrics, peakDbfs },
        gateMs: settings.gateMs,
      };
      setResult(m);
      setMeasurementName('');
      setMeasurementNotes('');
      setProcessing(false);
      setCaptureSub('review');
      refreshDeviceLabels().then((d) => setInputDevices(d.inputs));
    } catch (err) {
      setSweeping(false);
      setProcessing(false);
      setCaptureSub('ready');
      alert('Measurement failed: ' + (err as Error).message);
    }
  };

  // Persisting a measurement can throw if localStorage is full. We want the
  // navigation flow to continue regardless — the in-memory store update will
  // still succeed (Zustand applies state before attempting persistence).
  const persistMeasurement = (): boolean => {
    if (!result) return false;
    try {
      addMeasurement(sessionId, { ...result, name: measurementName || result.name, notes: measurementNotes });
      return true;
    } catch (err) {
      console.warn('[soundbench] measurement save failed:', err);
      alert('Could not persist this measurement to local storage (quota likely exceeded). The measurement is kept in memory for this session — export the session to a .soundbench file to keep it.');
      return true; // still allow the flow to proceed
    }
  };

  const saveAndPickAnother = () => {
    if (!persistMeasurement()) return;
    setResult(null);
    setCaptureSub('pick');
  };
  const saveAndFinish = () => {
    if (!persistMeasurement()) return;
    setResult(null);
    setCaptureSub('pick');
    setStep('analysis');
  };
  const discardAndRetake = () => {
    setResult(null);
    setCaptureSub('ready');
  };

  const positionLabel = positionId === 'custom' ? customPositionLabel : POSITION_PRESETS.find((p) => p.id === positionId)?.label;

  const reviewSeries = useMemo(() => {
    if (!result) return [];
    return [{ name: result.name, color: session.color, data: result.smoothedResponse || result.frequencyResponse }];
  }, [result, session.color]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div ref={scrollerRef} className="flex-1 overflow-y-auto">
      {/* Sticky header zone — stepper sits centered. Same width for every step. */}
      <div className="sticky top-0 z-20 bg-black">
        <div className="max-w-4xl mx-auto px-8 pt-4 pb-4 flex justify-center items-center">
          <Stepper labels={STEPS.map((s) => STEP_LABELS[s])} activeIndex={STEPS.indexOf(step)} />
        </div>
      </div>

      {/* Single content column — identical width and top padding on every step. */}
      <div className="max-w-4xl mx-auto px-8 pb-10 pt-8">
        {/* Step title — every step's title occupies the same 48px row, padded
            px-4, so the text sits in the exact same place across steps. Setup is
            an always-visible outlined box at the full body width. */}
        {step === 'setup' ? (
          <label className="group mb-[52px] mt-[38px] flex items-center h-10 w-full px-4 cursor-text border border-white">
          {/* <label className="group mb-[52px] flex items-center h-12 w-full px-4 cursor-text border border-white"> */}
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Project Title"
              aria-label="Session title"
              autoComplete="off"
              spellCheck={false}
              className="w-full p-0 bg-transparent outline-none text-sm placeholder:text-[#9CA3A0] group-hover:placeholder:text-white"
              // className="w-full p-0 bg-transparent outline-none text-page-title placeholder:text-[#9CA3A0] group-hover:placeholder:text-white"

            
            />
          </label>
        ) : (
          <div className=" flex items-center h-12">
          {/* <div className="mb-[52px] flex items-center h-12"> */}
            {/* <h1 className="text-page-title">{STEP_TITLES[step]}</h1> */}
          </div>
        )}

        {/* ─── Setup ──────────────────────────────────────────────────── */}
        {step === 'setup' && (
          <div className="space-y-[72px]">
            {/* ── Microphone Preferences (horizontal) ─────────────── */}
            <section className="space-y-[24px]">
              <SectionHeading>Microphone Preferences</SectionHeading>

              <div className="flex items-center gap-10 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-mono-label text-white">Input</span>
                  <TerminalDropdown
                    value={inputDeviceId ?? ''}
                    placeholder="Select"
                    options={
                      inputDevices.length === 0
                        ? [{ value: '', label: 'Default' }]
                        : inputDevices.map((d) => ({
                            value: d.deviceId,
                            label: d.label || `Device ${d.deviceId.slice(0, 8)}`,
                          }))
                    }
                    onChange={(v) => setInputDeviceId(v || null)}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-mono-label text-white">Profile</span>
                  <TerminalDropdown
                    value={micProfileId ?? 'flat'}
                    placeholder="None"
                    options={[
                      ...allProfiles.map((p) => ({ value: p.id, label: p.name })),
                      { value: '__upload__', label: 'Upload .cal…' },
                    ]}
                    onChange={(v) => {
                      if (v === '__upload__') {
                        const inp = document.createElement('input');
                        inp.type = 'file'; inp.accept = '.cal,.txt';
                        inp.onchange = () => { const f = inp.files?.[0]; if (f) handleUploadCal(f); };
                        inp.click();
                      } else {
                        setMicProfileId(v);
                      }
                    }}
                  />
                </div>
              </div>
            </section>

            {/* ── Speaker Geometry ───────────────────────────────── */}
            <section className="space-y-[24px]">
              <SectionHeading>Speaker Geometry</SectionHeading>

              <div className="flex gap-10 items-center">
                {/* Interactive 3D cube — the highlight, presented clean */}
                <div className="w-[300px] h-[300px] shrink-0 flex items-center justify-center">
                  <SpeakerCube geometry={geometry} size={300} zoom={1.44} interactive />
                </div>

                {/* Control grid */}
                <div className="grid grid-cols-[110px_1fr] gap-x-5 gap-y-6 items-center flex-1">
                  {/* Dimensions */}
                  <span className="text-mono-label text-white">Dimensions</span>
                  <div className="flex gap-3 items-center">
                    <DimInput label="W" value={geometry.widthMm} onChange={(v) => setGeometry({ ...geometry, widthMm: v })} />
                    <DimInput label="H" value={geometry.heightMm} onChange={(v) => setGeometry({ ...geometry, heightMm: v })} />
                    <DimInput label="D" value={geometry.depthMm} onChange={(v) => setGeometry({ ...geometry, depthMm: v })} />
                    <div className="border-b border-dashed border-white px-3 py-2 ml-1">
                      <span className="font-mono text-sm tabular-nums text-white">
                        {(geometry.widthMm * geometry.heightMm * geometry.depthMm / 1_000_000).toFixed(1)}
                        <span className="font-mono text-sm tabular-nums text-white"> L</span>
                      </span>
                    </div>
                  </div>

                  {/* Driver */}
                  <span className="text-mono-label text-white">Driver</span>
                  <div className="flex gap-3">
                    {(['front', 'top'] as DriverPosition[]).map((dp) => (
                      <TerminalButton
                        key={dp}
                        onClick={() => setGeometry({ ...geometry, driverPosition: dp })}
                        className={geometry.driverPosition === dp ? '' : 'border-dashed'}
                      >
                        {dp}
                      </TerminalButton>
                    ))}
                  </div>

                  {/* Port */}
                  <span className="text-mono-label text-white">Port</span>
                  <div className="flex gap-3">
                    {([
                      { id: 'sealed' as EnclosureType, label: 'None' },
                      { id: 'bottom-port' as EnclosureType, label: 'Bottom' },
                      { id: 'rear-port' as EnclosureType, label: 'Back' },
                    ]).map((opt) => (
                      <TerminalButton
                        key={opt.id}
                        onClick={() => setGeometry({ ...geometry, enclosure: opt.id })}
                        className={geometry.enclosure === opt.id ? '' : 'border-dashed'}
                      >
                        {opt.label}
                      </TerminalButton>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── Footer ─────────────────────────────────────────── */}
            <div className="flex justify-end pt-8">
              <Button size="sm" onClick={goNext} disabled={!canAdvance('setup')}>
                Continue to Calibrate <Arrow dir="right" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── Calibrate ──────────────────────────────────────────────── */}
        {step === 'calibrate' && (
          <div className="space-y-[72px]">

            {/* ── Background noise level ─────────────────────────────── */}
            <section className="space-y-[24px]">
              <SectionHeading>Background noise level</SectionHeading>
              <p className="text-body">
                Record three seconds of silence so we can show your room's noise floor. Stay quiet and turn off HVAC/fans if possible. Low-frequency noise (below 500 Hz) most often corrupts speaker measurements.
              </p>

              {/* State row — fixed height so before/during/after don't shift the layout */}
              <div className="min-h-[48px] flex items-center">
                {/* BEFORE */}
                {noiseState === 'before' && (
                  <TerminalButton onClick={startNoiseCheck}>
                    Start level check
                  </TerminalButton>
                )}

                {/* DURING */}
                {noiseState === 'during' && (
                  <div className="flex items-center gap-[16px]">
                    <TerminalButton onClick={stopNoiseCheck}>Stop</TerminalButton>
                    <AudioLevelMeter dbfs={calibLiveLevel} />
                  </div>
                )}

                {/* AFTER */}
                {noiseState === 'after' && (
                  <div className="flex items-center gap-[12px]">
                    <CheckMark size={28} className="text-complete" />
                    <span className="text-mono-label text-complete">Level Set</span>
                    <button
                      onClick={() => { setNoiseState('before'); setCalibLiveLevel(-60); }}
                      className="text-mono-label text-[#939393] border-b border-[#939393] px-2 h-7 inline-flex items-center hover:text-white hover:border-white transition-colors"
                    >
                      Recheck
                    </button>
                  </div>
                )}
              </div>

              {noiseWarning && noiseState === 'after' && (
                <div className="p-3 bg-warn/50 text-sm text-warn">{noiseWarning}</div>
              )}
            </section>

            {/* ── Output level safety check ─────────────────────────── */}
            <section className="space-y-[24px]">
              <SectionHeading>Output level safety check</SectionHeading>
              <p className="text-body">
                Before any sweep, set a safe playback level. Start with your amplifier or system volume at the minimum, then slowly raise it. Never start at full volume — you could damage your speakers or hearing. Press Play test tone to send a soft 1 kHz reference tone while you set the dial.
              </p>

              {/* State row — fixed height so before/during/after don't shift the layout */}
              <div className="min-h-[48px] flex items-center">
                {/* BEFORE */}
                {toneState === 'before' && (
                  <div className="flex items-center gap-[16px]">
                    <TerminalButton onClick={startTestTone}>Start test tone</TerminalButton>
                    <span className="text-mono-label text-white">1 kHz · −40 dBFS</span>
                  </div>
                )}

                {/* DURING */}
                {toneState === 'during' && (
                  <div className="flex items-center gap-[16px]">
                    <TerminalButton onClick={stopTestTone}>Stop</TerminalButton>
                    <span className="text-mono-label text-white">1 kHz tone playing…</span>
                  </div>
                )}

                {/* AFTER */}
                {toneState === 'after' && (
                  <div className="flex items-center gap-[12px]">
                    <CheckMark size={28} className="text-complete" />
                    <span className="text-mono-label text-complete">Level Set</span>
                    <button
                      onClick={() => setToneState('before')}
                      className="text-mono-label text-[#939393] border-b border-[#939393] px-2 h-7 inline-flex items-center hover:text-white hover:border-white transition-colors"
                    >
                      Recheck
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* ── Footer navigation ─────────────────────────────────── */}
            <div className="flex justify-between pt-8">
              <Button size="sm" variant="secondary" onClick={goPrev}><Arrow dir="left" /> Back</Button>
              <Button size="sm" onClick={goNext} disabled={toneState !== 'after'}>Continue to Capture <Arrow dir="right" /></Button>
            </div>
          </div>
        )}

        {/* ─── Capture ────────────────────────────────────────────────── */}
        {step === 'capture' && (
          <div className="space-y-8">
            {/* Session header — line-art row with spec labels */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#9D5FF9' }} />
                <span className="font-mono text-sm uppercase tracking-[0.04em] text-white capitalize">{session.name}</span>
                <span className="spec-label">{String(measurements.length).padStart(2, '0')} captured</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#34D399' }} />
                <span className="spec-label">Output level set</span>
              </div>
            </div>

            {/* PICK position */}
            {captureSub === 'pick' && (
              <>
                <p className="text-body">Pick the mic position for the next sweep. Each preset includes a placement guide.</p>
                <div className="grid grid-cols-2 gap-3">
                  {POSITION_PRESETS.map((p) => {
                    const taken = measurements.some((m) => m.position === p.label);
                    return (
                      <button
                        key={p.id}
                        onClick={() => { setPositionId(p.id); setCaptureSub('ready'); }}
                        className={`relative text-left border p-4 transition-colors ${positionId === p.id ? 'border-white' : 'border-border hover:border-white'}`}
                      >
                        <div className="flex items-center gap-3">
                          <SpeakerCube
                            geometry={session.geometry}
                            size={72}
                            micPlacement={p.mic}
                            strokeWidth={1}
                            className="shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs uppercase tracking-[0.04em] text-white flex items-center gap-2">
                              <span className="truncate">{p.label}</span>
                              {taken && <CheckMark size={12} className="text-success shrink-0" />}
                            </div>
                            <div className="text-body !text-xs leading-snug mt-1.5">{p.hint}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-border pt-4">
                  <div className="spec-label mb-2">Or enter a custom position label</div>
                  <div className="flex gap-2">
                    <Input placeholder="e.g. 22° listening axis" value={customPositionLabel} onChange={(e) => setCustomPositionLabel(e.target.value)} />
                    <Button variant="secondary" disabled={!customPositionLabel.trim()} onClick={() => { setPositionId('custom'); setCaptureSub('ready'); }}>Use label</Button>
                  </div>
                </div>
                <div className="flex justify-between pt-2">
                  <Button size="sm" variant="secondary" onClick={goPrev}><Arrow dir="left" /> Calibrate</Button>
                  <Button size="sm" onClick={() => setStep('analysis')} disabled={measurements.length === 0}>
                    Finish & view Analysis <Arrow dir="right" />
                  </Button>
                </div>
              </>
            )}

            {/* READY to sweep */}
            {captureSub === 'ready' && (
              <div className="panel">
                <div className="panel-head">
                  <span className="spec-label">Ready to sweep</span>
                  <span className="spec-label">{positionLabel}</span>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <Metric label="Sweep range" value={`${settings.sweepF1}–${settings.sweepF2} Hz`} />
                    <Metric label="Duration" value={`${settings.sweepDuration} s`} />
                    <Metric label="Gate" value={`${settings.gateMs} ms`} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={startSweep}>Start sweep</Button>
                    <Button variant="secondary" onClick={() => setCaptureSub('pick')}><Arrow dir="left" /> Position</Button>
                  </div>
                </div>
              </div>
            )}

            {/* SWEEPING */}
            {captureSub === 'sweeping' && (
              <div className="panel">
                <div className="panel-head">
                  <span className="spec-label">{processing ? 'Processing' : 'Sweeping'}</span>
                  <span className="spec-label">{positionLabel}</span>
                </div>
                <div className="p-5">
                  {sweeping && <AudioLevelMeter dbfs={liveLevel} />}
                  {sweeping && (
                    <div className="mt-4">
                      <Button variant="danger" onClick={() => { captureHandleRef.current?.abort(); setSweeping(false); setCaptureSub('ready'); }}>Stop · Space</Button>
                    </div>
                  )}
                  {processing && <p className="text-body mt-2">Computing impulse response and frequency response…</p>}
                  {signalWarning && (
                    <div className="mt-4 p-3 bg-warn/50 text-sm text-warn">{signalWarning}</div>
                  )}
                </div>
              </div>
            )}

            {/* REVIEW */}
            {captureSub === 'review' && result && (
              <>
                <div className="panel">
                  <div className="panel-head">
                    <span className="spec-label">Result · {positionLabel}</span>
                    {isFinite(result.metrics.snrDb) && (
                      <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${result.metrics.snrDb < 10 ? 'text-danger' : result.metrics.snrDb < 20 ? 'text-warn' : 'text-success'}`}>
                        SNR {result.metrics.snrDb.toFixed(1)} dB
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <FrequencyChart series={reviewSeries} height={240} />
                    {(() => {
                      const snr = result.metrics.snrDb;
                      if (!isFinite(snr)) return null;
                      if (snr < 10) {
                        return (
                          <div className="mt-4 p-3 bg-danger/50 text-sm text-danger">
                            <b>Measurement is invalid (SNR {snr.toFixed(1)} dB).</b> The impulse response is buried in noise — the speaker likely wasn't playing, the volume is too low, or the mic isn't picking up the sound. Re-take with the speaker actually playing and the mic in front of it.
                          </div>
                        );
                      }
                      if (snr < 20) {
                        return (
                          <div className="mt-4 p-3 bg-warn/50 text-sm text-warn">
                            <b>Low signal quality (SNR {snr.toFixed(1)} dB).</b> Increase output volume, reduce ambient noise, or move the mic closer for a cleaner measurement.
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <dl className="grid grid-cols-5 gap-4 mt-5">
                      <Metric label="Sens @ 1kHz" value={`${result.metrics.sensitivity1k.toFixed(1)} dBFS`} />
                      <Metric label="−3 dB low" value={result.metrics.minus3dbLow ? `${result.metrics.minus3dbLow.toFixed(0)} Hz` : '—'} />
                      <Metric label="−10 dB low" value={result.metrics.minus10dbLow ? `${result.metrics.minus10dbLow.toFixed(0)} Hz` : '—'} />
                      <Metric label="−3 dB high" value={result.metrics.minus3dbHigh ? `${(result.metrics.minus3dbHigh / 1000).toFixed(1)} kHz` : '—'} />
                      <Metric label="IR SNR" value={isFinite(result.metrics.snrDb) ? `${result.metrics.snrDb.toFixed(1)} dB` : '—'} />
                    </dl>
                  </div>
                </div>
                <div className="border border-border p-5 space-y-3">
                  <div>
                    <div className="spec-label mb-2">Measurement name</div>
                    <Input value={measurementName} onChange={(e) => setMeasurementName(e.target.value)} placeholder={result.name} />
                  </div>
                  <div>
                    <div className="spec-label mb-2">Notes</div>
                    <Textarea value={measurementNotes} onChange={(e) => setMeasurementNotes(e.target.value)} placeholder="Optional notes about this take" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button size="sm" variant="secondary" onClick={discardAndRetake}>Re-take</Button>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={saveAndPickAnother}>Save · another</Button>
                    <Button size="sm" onClick={saveAndFinish}>Save · finish <Arrow dir="right" /></Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Analysis ───────────────────────────────────────────────── */}
        {step === 'analysis' && (
          <Dashboard
            sessionId={sessionId}
            footerLeft={<Button size="sm" variant="secondary" onClick={() => setStep('capture')}><Arrow dir="left" /> Back to Capture</Button>}
          />
        )}
      </div>
    </div>
  );
}


/** W / H / D numeric input — IBM Plex Mono Bold cell with a 1 px solid
 *  white underline.  Used by the Speaker Geometry dimensions row on Setup. */
function DimInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="border-b border-white px-3 py-2 flex items-center justify-center" aria-label={label}>
      <input
        type="number"
        min={1}
        max={3000}
        value={value}
        onChange={(e) => onChange(Math.max(1, parseFloat(e.target.value) || 0))}
        placeholder={label}
        className="w-12 bg-transparent text-center font-mono font-bold text-sm tracking-[0.04em] text-white outline-none placeholder:text-white capitalize [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </label>
  );
}


function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="spec-label">{label}</div>
      <div className="font-mono text-sm tabular-nums text-white mt-1">{value}</div>
    </div>
  );
}
