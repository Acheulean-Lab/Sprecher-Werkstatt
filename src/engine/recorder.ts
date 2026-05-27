// Simultaneous playback + capture using Web Audio API + getUserMedia.
//
// Audio-resource discipline:
//   · No AudioContext is created outside of an explicit user-initiated capture
//     or test-tone playback. Page navigation never opens the mic or the output.
//   · enumerateDevices() is called WITHOUT getUserMedia() — opening the mic
//     just to populate device labels causes macOS to duck speaker output (the
//     "fade in/out" the user hears) and is never the right thing to do.
//   · The ScriptProcessor's output channel is explicitly silenced so the mic
//     feed is never routed back to the speakers (mic monitoring leak).

export interface CaptureHandle {
  stop: () => Promise<{ recording: Float32Array; sampleRate: number; peakDbfs: number }>;
  abort: () => void;
  onLevel: (cb: (peakDbfs: number) => void) => void;
}

// Internal cache of the last enumerated device list. After the first real
// capture, labels become populated and we keep the resolved list around so
// subsequent enumerations don't appear empty.
let cachedInputs: MediaDeviceInfo[] = [];
let cachedOutputs: MediaDeviceInfo[] = [];

/**
 * Returns the list of audio input/output devices. Does NOT request microphone
 * permission. If no permission has been granted yet, device labels will be
 * empty strings; callers should display a generic name in that case and call
 * `refreshDeviceLabels` after the first successful capture.
 */
export async function listAudioDevices() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    cachedInputs = all.filter((d) => d.kind === 'audioinput');
    cachedOutputs = all.filter((d) => d.kind === 'audiooutput');
  } catch { /* ignore */ }
  return { inputs: cachedInputs, outputs: cachedOutputs };
}

/**
 * Re-enumerates devices. Call this after a successful capture so device
 * labels (which only become visible once the user has granted permission)
 * are populated for subsequent UI rendering.
 */
export async function refreshDeviceLabels() {
  return listAudioDevices();
}

export async function playTestTone(freq = 1000, durationSec = 60, level = 0.01): Promise<() => void> {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  // Apply a 30 ms ramp on start and stop to avoid the click that occurs when
  // an oscillator is started or stopped at non-zero amplitude — that click
  // can cause an audible "fade in/out" perception even with a quiet test tone.
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(level, ctx.currentTime + 0.03);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationSec);
  // Close the context when the oscillator naturally ends so we don't leave
  // the audio output device held open longer than necessary.
  let closed = false;
  const closeOnce = () => { if (closed) return; closed = true; try { ctx.close(); } catch { /* noop */ } };
  osc.onended = closeOnce;
  return () => {
    try {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
      osc.stop(ctx.currentTime + 0.05);
    } catch { /* noop */ }
    setTimeout(closeOnce, 80);
  };
}

export async function capture(
  inputDeviceId: string | null,
  signalSamples: Float32Array | null,
  durationSec: number,
  sampleRate: number
): Promise<CaptureHandle> {
  const ctx = new AudioContext({ sampleRate });
  const constraints: MediaStreamConstraints = {
    audio: {
      deviceId: inputDeviceId ? { exact: inputDeviceId } : undefined,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    } as MediaTrackConstraints,
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const src = ctx.createMediaStreamSource(stream);

  const actualRate = ctx.sampleRate;
  const chunkSize = 4096;
  const buffers: Float32Array[] = [];
  let peak = 0;
  let levelCb: ((p: number) => void) | null = null;

  const processor = ctx.createScriptProcessor(chunkSize, 1, 1);
  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    // CRITICAL: silence the processor's output channel. Without this, the
    // mic feed is routed straight back to the speakers — a literal monitor
    // passthrough that's audible in headphones and causes feedback in the
    // sweep itself. ScriptProcessor copies input → output by default.
    const out = e.outputBuffer.getChannelData(0);
    out.fill(0);

    const copy = new Float32Array(input.length);
    copy.set(input);
    buffers.push(copy);
    let localPeak = 0;
    for (let i = 0; i < input.length; i++) {
      const v = Math.abs(input[i]);
      if (v > localPeak) localPeak = v;
    }
    if (localPeak > peak) peak = localPeak;
    if (levelCb) levelCb(20 * Math.log10(Math.max(localPeak, 1e-9)));
  };

  // ScriptProcessor only fires events when something pulls audio through it,
  // so we have to connect to destination — but we route through a muted gain
  // node as belt-and-suspenders in case the output-fill is skipped on any
  // platform. (Some Safari builds historically ignored output writes.)
  const muteGain = ctx.createGain();
  muteGain.gain.value = 0;
  src.connect(processor);
  processor.connect(muteGain);
  muteGain.connect(ctx.destination);

  // Playback path — this IS supposed to reach the speakers (the sweep).
  let sweepSource: AudioBufferSourceNode | null = null;
  if (signalSamples) {
    const audioBuf = ctx.createBuffer(1, signalSamples.length, actualRate);
    audioBuf.getChannelData(0).set(signalSamples);
    sweepSource = ctx.createBufferSource();
    sweepSource.buffer = audioBuf;
    sweepSource.connect(ctx.destination);
    sweepSource.start();
  }

  let stopped = false;
  const finish = (): { recording: Float32Array; sampleRate: number; peakDbfs: number } => {
    const total = buffers.reduce((acc, b) => acc + b.length, 0);
    const out = new Float32Array(total);
    let off = 0;
    for (const b of buffers) { out.set(b, off); off += b.length; }
    return { recording: out, sampleRate: actualRate, peakDbfs: 20 * Math.log10(Math.max(peak, 1e-9)) };
  };

  const cleanup = () => {
    try { sweepSource && sweepSource.stop(); } catch { /* noop */ }
    try { processor.disconnect(); src.disconnect(); muteGain.disconnect(); } catch { /* noop */ }
    stream.getTracks().forEach((t) => t.stop());
    try { ctx.close(); } catch { /* noop */ }
  };

  const handle: CaptureHandle = {
    stop: async () => {
      if (stopped) return finish();
      stopped = true;
      await new Promise((r) => setTimeout(r, 150)); // drain
      cleanup();
      return finish();
    },
    abort: () => { if (stopped) return; stopped = true; cleanup(); },
    onLevel: (cb) => { levelCb = cb; },
  };

  // Auto-stop safety: if for any reason the caller never invokes stop(),
  // tear everything down a little after the expected duration so the mic
  // doesn't stay open.
  setTimeout(() => { if (!stopped) handle.stop(); }, (durationSec + 0.5) * 1000);

  return handle;
}
