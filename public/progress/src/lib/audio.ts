// Lightweight Web Audio helper for subtle beeps
let ctx: AudioContext | null = null;
let unlocked = false;
let volumeScalar = 1; // global multiplier for perceived volume (0..4)

function getCtx(): AudioContext {
  if (ctx) return ctx;
  const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
  ctx = AC ? new AC() : null;
  return ctx as any;
}

export async function unlockAudio() {
  const a = getCtx();
  if (!a) return false;
  if (a.state === 'suspended') {
    try { await a.resume(); } catch {}
  }
  unlocked = a.state === 'running';
  return unlocked;
}

/** Set global volume multiplier for beeps (0..4, default 1). 2-3 recommended to cut through music. */
export function setBeepVolumeScalar(mult: number) {
  if (!Number.isFinite(mult)) return;
  volumeScalar = Math.max(0, Math.min(4, mult));
}

type BeepOpts = {
  freq?: number;
  durationMs?: number;
  volume?: number;
  type?: OscillatorType;
  // Optional FX
  filter?: { type: BiquadFilterType; frequency?: number; Q?: number; gain?: number };
  shaper?: 'soft' | 'hard';
  sweep?: { to: number }; // linear sweep from freq -> to over duration
};

function createWaveshaper(a: AudioContext, amount = 20, mode: 'soft' | 'hard' = 'soft') {
  const n = 44100;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; ++i) {
    const x = (i * 2) / n - 1;
    if (mode === 'hard') {
      curve[i] = Math.tanh(x * amount);
    } else {
      // soft saturation
      curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
    }
  }
  const ws = a.createWaveShaper();
  ws.curve = curve;
  ws.oversample = '4x';
  return ws;
}

function playToneAt(time: number, opts: BeepOpts = {}) {
  const a = getCtx();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  const freq = opts.freq ?? 1000;
  const volBase = Math.max(0, Math.min(1, opts.volume ?? 0.08));
  const vol = Math.min(0.9, volBase * volumeScalar);
  const dur = Math.max(0.04, (opts.durationMs ?? 160) / 1000);
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, time);
  if (opts.sweep?.to != null) {
    osc.frequency.linearRampToValueAtTime(opts.sweep.to, time + dur);
  }
  let node: AudioNode = osc;
  // Optional filtering for timbre control
  if (opts.filter) {
    const f = a.createBiquadFilter();
    f.type = opts.filter.type;
    if (opts.filter.frequency) f.frequency.setValueAtTime(opts.filter.frequency, time);
    if (opts.filter.Q) f.Q.setValueAtTime(opts.filter.Q, time);
    if (opts.filter.gain != null) f.gain.setValueAtTime(opts.filter.gain, time);
    node.connect(f);
    node = f;
  }
  // Optional waveshaper for extra bite
  if (opts.shaper) {
    const ws = createWaveshaper(a, opts.shaper === 'hard' ? 28 : 12, opts.shaper);
    node.connect(ws);
    node = ws;
  }
  gain.gain.setValueAtTime(0, time);
  // Quick attack, short sustain, smooth release for non-harsh beep
  const attack = 0.005;
  const sustain = Math.max(0.02, dur - attack - 0.03);
  gain.gain.linearRampToValueAtTime(vol, time + attack);
  gain.gain.linearRampToValueAtTime(vol * 0.85, time + attack + sustain * 0.6);
  gain.gain.linearRampToValueAtTime(0, time + dur);
  node.connect(gain).connect(a.destination);
  osc.start(time);
  osc.stop(time + dur + 0.02);
}

/** Play a subtle double-beep to indicate rest target reached. */
export function playRestBeep(pattern: 'single'|'double'|'triple' = 'double') {
  const a = getCtx();
  if (!a) return;
  // If context is suspended, try to resume but don't block
  if (a.state === 'suspended') a.resume().catch(() => {});
  const t0 = a.currentTime + 0.01;
  if (pattern === 'single') {
    playToneAt(t0, { freq: 920, durationMs: 150, volume: 0.09, type: 'sine' });
    return;
  }
  // Default: pleasant double beep with slight interval
  playToneAt(t0, { freq: 880, durationMs: 140, volume: 0.10, type: 'sine' });
  playToneAt(t0 + 0.20, { freq: 1175, durationMs: 160, volume: 0.10, type: 'sine' });
  if (pattern === 'triple') {
    playToneAt(t0 + 0.40, { freq: 990, durationMs: 120, volume: 0.09, type: 'sine' });
  }
}

export type BeepStyle = 'gentle' | 'chime' | 'digital' | 'alarm' | 'click';

/** Play a sequence of beeps using a named style. count clamped 1-5. */
export function playBeepStyle(style: BeepStyle = 'gentle', count = 2) {
  const a = getCtx();
  if (!a) return;
  if (a.state === 'suspended') a.resume().catch(() => {});
  const t0 = a.currentTime + 0.01;
  const n = Math.max(1, Math.min(5, Math.floor(count || 1)));

  // Define per-style pattern and derived spacing to avoid overlaps
  type Seg = { at: number; opts: BeepOpts };
  const buildPattern = (base: number): { segs: Seg[]; length: number } => {
    switch (style) {
      case 'gentle': {
        const segs: Seg[] = [
          { at: base, opts: { freq: 880, durationMs: 150, volume: 0.095, type: 'sine' } },
          { at: base + 0.20, opts: { freq: 1175, durationMs: 170, volume: 0.10, type: 'sine' } },
        ];
        const length = 0.20 + 0.17; // last offset + dur
        return { segs, length };
      }
      case 'chime': {
        const segs: Seg[] = [
          { at: base, opts: { freq: 1500, durationMs: 190, volume: 0.10, type: 'triangle', filter: { type: 'bandpass', frequency: 1500, Q: 1.2 } } },
          { at: base + 0.24, opts: { freq: 1800, durationMs: 210, volume: 0.10, type: 'triangle', filter: { type: 'bandpass', frequency: 1800, Q: 1.2 } } },
        ];
        const length = 0.24 + 0.21;
        return { segs, length };
      }
      case 'digital': {
        const segs: Seg[] = [
          { at: base, opts: { freq: 1100, durationMs: 140, volume: 0.12, type: 'square', filter: { type: 'highpass', frequency: 650, Q: 0.8 }, shaper: 'hard' } },
          { at: base + 0.18, opts: { freq: 1350, durationMs: 150, volume: 0.12, type: 'square', filter: { type: 'highpass', frequency: 700, Q: 0.8 }, shaper: 'hard' } },
        ];
        const length = 0.18 + 0.15;
        return { segs, length };
      }
      case 'alarm': {
        // Piercing siren-like pair with slight sweeps and gentle saturation
        const segs: Seg[] = [
          { at: base, opts: { freq: 1900, sweep: { to: 2600 }, durationMs: 220, volume: 0.14, type: 'sawtooth', filter: { type: 'highpass', frequency: 950, Q: 0.9 }, shaper: 'hard' } },
          { at: base + 0.26, opts: { freq: 2400, sweep: { to: 2000 }, durationMs: 220, volume: 0.14, type: 'sawtooth', filter: { type: 'highpass', frequency: 950, Q: 0.9 }, shaper: 'hard' } },
        ];
        const length = 0.26 + 0.22;
        return { segs, length };
      }
      case 'click': {
        const segs: Seg[] = [
          { at: base, opts: { freq: 3200, durationMs: 70, volume: 0.10, type: 'square', filter: { type: 'highpass', frequency: 1200, Q: 0.7 } } },
        ];
        const length = 0.07;
        return { segs, length };
      }
    }
    // fallback gentle
    return buildPattern(base);
  };

  let cursor = t0;
  for (let i = 0; i < n; i++) {
    const { segs, length } = buildPattern(cursor);
    for (const s of segs) playToneAt(s.at, s.opts);
    const pad = 0.14; // extra silence between beeps
    cursor += length + pad;
  }
}
