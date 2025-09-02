// Lightweight Web Audio helper for subtle beeps
let ctx: AudioContext | null = null;
let unlocked = false;

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

type BeepOpts = { freq?: number; durationMs?: number; volume?: number; type?: OscillatorType };

function playToneAt(time: number, opts: BeepOpts = {}) {
  const a = getCtx();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  const freq = opts.freq ?? 1000;
  const vol = Math.max(0, Math.min(1, opts.volume ?? 0.08));
  const dur = Math.max(0.04, (opts.durationMs ?? 160) / 1000);
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0, time);
  // Quick attack, short sustain, smooth release for non-harsh beep
  const attack = 0.005;
  const sustain = Math.max(0.02, dur - attack - 0.03);
  gain.gain.linearRampToValueAtTime(vol, time + attack);
  gain.gain.linearRampToValueAtTime(vol * 0.85, time + attack + sustain * 0.6);
  gain.gain.linearRampToValueAtTime(0, time + dur);
  osc.connect(gain).connect(a.destination);
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

  for (let i = 0; i < n; i++) {
    const base = t0 + i * 0.22; // spacing between beeps
    switch (style) {
      case 'gentle':
        playToneAt(base, { freq: 880, durationMs: 140, volume: 0.095, type: 'sine' });
        playToneAt(base + 0.18, { freq: 1175, durationMs: 160, volume: 0.10, type: 'sine' });
        break;
      case 'chime':
        playToneAt(base, { freq: 1480, durationMs: 180, volume: 0.09, type: 'triangle' });
        playToneAt(base + 0.22, { freq: 1760, durationMs: 200, volume: 0.09, type: 'triangle' });
        break;
      case 'digital':
        playToneAt(base, { freq: 1000, durationMs: 120, volume: 0.11, type: 'square' });
        playToneAt(base + 0.16, { freq: 1200, durationMs: 120, volume: 0.11, type: 'square' });
        break;
      case 'alarm':
        playToneAt(base, { freq: 720, durationMs: 150, volume: 0.12, type: 'sawtooth' });
        playToneAt(base + 0.16, { freq: 720, durationMs: 150, volume: 0.12, type: 'sawtooth' });
        break;
      case 'click':
        // Short percussive tick using very brief noise-like burst via high freq & fast decay
        playToneAt(base, { freq: 3000, durationMs: 60, volume: 0.08, type: 'square' });
        break;
    }
  }
}
