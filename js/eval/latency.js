// Latency: the time between a scheduled click and when the microphone hears a
// note played exactly on it (speaker output + mic input). Measured by a loopback
// test (speakers) or a tap-along test (headphones); otherwise estimated.
import { Audio } from '../core/audio.js';
import { Recorder } from './recorder.js';
import { detectClicks, detectOnsets } from './dsp.js';

const median = a => { const s = [...a].sort((x, y) => x - y); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

export function estimateLatency() {
  const c = Audio.get(); if (!c) return 0.03;
  let input = 0.01;
  if (Audio.micInfo && Audio.micInfo.latency) input = Audio.micInfo.latency;
  else if (Audio.isDirect()) input = 0.008;
  return (c.outputLatency || 0) + (c.baseLatency || 0) + input;
}

/** Latency is stored per input device (a USB interface and a built-in mic differ). */
export function latencyKey() { return (Audio.input.deviceId || 'default') + ':' + (Audio.input.type || 'mic'); }
export function saveLatency(settings, r) {
  settings.latencyByInput = settings.latencyByInput || {};
  settings.latencyByInput[latencyKey()] = { ms: r.ms, method: r.method, spreadMs: r.spreadMs, at: Date.now(), label: Audio.input.label || 'Default input' };
  settings.latency = settings.latencyByInput[latencyKey()];
}
/** Current latency in seconds + whether it was measured (for the selected input). */
export function currentLatency(settings) {
  const map = (settings && settings.latencyByInput) || {};
  const L = map[latencyKey()] || (!Object.keys(map).length && latencyKey() === 'default:mic' ? settings && settings.latency : null);
  if (L && L.ms != null && (L.method === 'loopback' || L.method === 'tap')) return { sec: L.ms / 1000, calibrated: true, method: L.method };
  return { sec: estimateLatency(), calibrated: false, method: 'estimate' };
}

/**
 * Run a calibration. mode: 'loopback' (speakers: app listens to its own clicks)
 * or 'tap' (headphones: player taps muted strings on each click).
 * onStatus(text) for UI updates. Returns {ms, spreadMs, n, method} or throws.
 */
export async function calibrate(mode = 'loopback', onStatus = () => {}) {
  const ctx = Audio.get(); if (!ctx) throw new Error('Audio is not supported in this browser.');
  const src = await Audio.openMic();
  const rec = await Recorder.start(src);
  const prevStyle = Audio.clickStyle; Audio.clickStyle = mode === 'loopback' ? 'eval' : 'normal';
  const n = mode === 'loopback' ? 8 : 12, gap = mode === 'loopback' ? 0.45 : 0.6;
  const t0 = ctx.currentTime + (mode === 'loopback' ? 0.5 : 1.8);
  if (mode === 'tap') { for (let i = 0; i < 4; i++) Audio.click(t0 - (4 - i) * gap, i === 0, 0.6); }
  const times = Array.from({ length: n }, (_, i) => t0 + i * gap);
  times.forEach((t, i) => Audio.click(t, i % 4 === 0, mode === 'loopback' ? 1 : 0.8));
  onStatus(mode === 'loopback' ? 'Listening to the clicks… stay quiet.' : 'Tap the muted strings exactly on each click…');
  await new Promise(r => setTimeout(r, (t0 - ctx.currentTime + n * gap + 0.5) * 1000));
  const take = await rec.stop();
  Audio.clickStyle = prevStyle; Audio.closeMic();
  const sr = take.sampleRate;
  const ons = (mode === 'loopback' ? detectClicks(take.samples, sr) : detectOnsets(take.samples, sr, { rejectClicks: false })).map(o => o.time + take.startTime);
  const offs = [];
  for (const t of times) {
    const lo = mode === 'loopback' ? t : t - 0.15, hi = mode === 'loopback' ? t + 0.45 : t + 0.4;
    const c = ons.filter(o => o >= lo && o <= hi);
    if (c.length) offs.push(c.reduce((b, o) => (Math.abs(o - t - (mode === 'tap' ? 0.03 : 0)) < Math.abs(b - t - (mode === 'tap' ? 0.03 : 0)) ? o : b)) - t);
  }
  if (offs.length < Math.ceil(n * 0.6)) throw new Error(mode === 'loopback' ? (Audio.isDirect() ? 'A direct input can’t hear the speakers. Use the tap-along test instead.' : 'Couldn’t hear the clicks. Use speakers (not headphones), turn the volume up and try again.') : 'Not enough taps were heard. Strike the muted strings a little harder.');
  const m = median(offs), spread = median(offs.map(o => Math.abs(o - m)));
  if ((mode === 'loopback' && spread > 0.006) || (mode === 'tap' && spread > 0.03)) throw new Error('The measurement was inconsistent. Try again in a quieter room.');
  return { ms: Math.round(m * 1000), spreadMs: Math.round(spread * 1000), n: offs.length, method: mode };
}
