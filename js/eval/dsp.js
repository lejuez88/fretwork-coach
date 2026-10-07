// Signal processing for playing evaluation. Pure functions on Float32Array
// audio so they run in the browser and in tests.
import { detectPitch, freqToMidi } from '../tools/pitch.js';

/* ---------------------------------- FFT --------------------------------- */
const fftCache = new Map();
function plan(n) {
  if (fftCache.has(n)) return fftCache.get(n);
  const rev = new Uint32Array(n), bits = Math.log2(n);
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
  const cos = new Float32Array(n / 2), sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(-2 * Math.PI * i / n); sin[i] = Math.sin(-2 * Math.PI * i / n); }
  const win = new Float32Array(n); for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
  const p = { rev, cos, sin, win }; fftCache.set(n, p); return p;
}
/** In-place radix-2 FFT. */
export function fft(re, im) {
  const n = re.length, { rev, cos, sin } = plan(n);
  for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let i = 0; i < n; i += size) for (let j = 0; j < half; j++) {
      const k = j * step, wr = cos[k], wi = sin[k], a = i + j, b = a + half;
      const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
}

/* ------------------------------- Envelopes ------------------------------ */
/** Band-limited log spectral flux + frame RMS. */
export function spectralFlux(x, sr, { frame = 1024, hop = 256, fmin = 60, fmax = 2000, hiBand = [3000, 6500] } = {}) {
  const { win } = plan(frame);
  const nFrames = Math.max(0, Math.floor((x.length - frame) / hop) + 1);
  const bin = f => Math.max(1, Math.min(frame / 2 - 1, Math.round(f * frame / sr)));
  const lo = bin(fmin), hi = bin(fmax), hlo = bin(hiBand[0]), hhi = bin(hiBand[1]);
  const top = Math.max(hi, hhi);
  const flux = new Float32Array(nFrames), hiFlux = new Float32Array(nFrames), rms = new Float32Array(nFrames);
  const re = new Float32Array(frame), im = new Float32Array(frame);
  let prev = new Float32Array(top + 1), cur = new Float32Array(top + 1);
  for (let f = 0; f < nFrames; f++) {
    const off = f * hop; let e = 0;
    for (let i = 0; i < frame; i++) { const v = x[off + i]; e += v * v; re[i] = v * win[i]; im[i] = 0; }
    rms[f] = Math.sqrt(e / frame);
    fft(re, im);
    let sum = 0, hsum = 0;
    for (let k = Math.min(lo, hlo); k <= top; k++) {
      const m = Math.log1p(100 * Math.hypot(re[k], im[k]));
      cur[k] = m; const d = m - prev[k];
      if (d > 0) { if (k >= lo && k <= hi) sum += d; if (k >= hlo && k <= hhi) hsum += d; }
    }
    flux[f] = f ? sum / (hi - lo + 1) : 0; hiFlux[f] = f ? hsum / (hhi - hlo + 1) : 0;
    const t = prev; prev = cur; cur = t;
  }
  return { flux, hiFlux, rms, hop, frame, sr };
}

function movingMedian(a, w) {
  const out = new Float32Array(a.length), buf = [];
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - w), hi = Math.min(a.length - 1, i + w);
    buf.length = 0; for (let j = lo; j <= hi; j++) buf.push(a[j]);
    buf.sort((p, q) => p - q); out[i] = buf[buf.length >> 1];
  }
  return out;
}
const pct = (a, q) => { const s = Array.from(a).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };

/**
 * Detect note onsets. Returns [{time (s, from buffer start), strength, peak (amplitude)}].
 * minGap: seconds between onsets. band: [fmin,fmax] Hz for the flux (filters out the high eval click).
 */
export function detectOnsets(x, sr, { minGap = 0.045, band = [60, 2000], sensitivity = 1, rejectClicks = true, env = null } = {}) {
  env = env || spectralFlux(x, sr, { fmin: band[0], fmax: band[1] });
  const { flux, hiFlux, rms, hop, frame } = env;
  if (!flux.length) return [];
  const w = Math.max(3, Math.round(0.1 * sr / hop));
  const med = movingMedian(flux, w);
  // Candidate local maxima, then thresholds relative to how strong real onsets are in this take
  const cand = [];
  for (let i = 2; i < flux.length - 2; i++) {
    const v = flux[i];
    if (v >= flux[i - 1] && v >= flux[i - 2] && v > flux[i + 1] && v >= flux[i + 2] && v > med[i]) cand.push(i);
  }
  if (!cand.length) return [];
  // Energy-rise detector: catches re-picked notes and notes masked by ringing strings
  const lr = Array.from(rms, v => Math.log(v + 1e-5));
  const rise = new Set();
  for (let i = 3; i < lr.length - 1; i++) {
    const d = lr[i] - Math.min(lr[i - 2], lr[i - 3]);
    if (d > 0.45 && d >= (lr[i + 1] - Math.min(lr[i - 1], lr[i - 2])) && d > (lr[i - 1] - Math.min(lr[i - 3], lr[i - 4] ?? lr[i - 3]))) rise.add(i);
  }
  const vals = cand.map(i => flux[i]).sort((a, b) => b - a);
  const K = Math.max(3, Math.round(0.04 * vals.length));
  const strong = vals[Math.min(vals.length - 1, K >> 1)];          // typical real-onset strength
  const delta = 0.15 * strong / sensitivity;
  const localW = Math.round(0.6 * sr / hop);
  const localMax = i => { let m = 0; for (let j = Math.max(0, i - localW); j <= Math.min(flux.length - 1, i + localW); j++) if (flux[j] > m) m = flux[j]; return m; };
  const noise = Math.max(0.0015, pct(rms, 0.1) * 2.5);
  const gapF = Math.round(minGap * sr / hop);
  const peaks = [];
  const nearRise = i => rise.has(i) || rise.has(i - 1) || rise.has(i + 1) || rise.has(i - 2) || rise.has(i + 2);
  for (const i of cand) {
    const v = flux[i];
    const thr = med[i] + Math.max(delta, 0.08 * localMax(i) / sensitivity);
    if (v < thr && !(nearRise(i) && v > med[i] + 0.4 * delta)) continue;
    if (rejectClicks && hiFlux[i] > 1.5 * v && v < 0.4 * strong) continue; // metronome bleed: weak below 2 kHz, strong above 3 kHz
    const loud = Math.max(rms[i], rms[i + 1] || 0, rms[i + 2] || 0);
    if (loud < noise) continue;
    if (peaks.length && i - peaks[peaks.length - 1].i < gapF) {
      if (v > peaks[peaks.length - 1].v) peaks[peaks.length - 1] = { i, v };
      continue;
    }
    peaks.push({ i, v });
  }
  return peaks.map(({ i, v }) => {
    const coarse = (i * hop + frame / 2) / sr;
    const time = refineOnset(x, sr, coarse);
    return { time, strength: v, peak: peakAmp(x, sr, time) };
  });
}

/**
 * Informed detection: was a note played near time t (seconds in the buffer)?
 * Looks for a flux peak or energy rise inside ±tol, compared with the local baseline.
 * typical: strength of clearly detected onsets in this take.
 */
export function guidedOnset(x, env, t, tol, typical) {
  const { flux, hiFlux, rms, hop, frame, sr } = env;
  const toF = s => Math.round((s * sr - frame / 2) / hop);
  const a = Math.max(2, toF(t - tol)), b = Math.min(flux.length - 2, toF(t + tol));
  if (b <= a) return null;
  let best = a; for (let i = a; i <= b; i++) if (flux[i] > flux[best]) best = i;
  const ctx = []; const ca = Math.max(0, toF(t - 0.3)), cb = Math.min(flux.length - 1, toF(t + 0.3));
  for (let i = ca; i <= cb; i++) if (i < a - 2 || i > b + 2) ctx.push(flux[i]);
  ctx.sort((p, q) => p - q);
  const base = ctx.length ? ctx[ctx.length >> 1] : 0;
  let rise = 0;
  for (let i = a; i <= b; i++) { const d = Math.log(rms[i] + 1e-5) - Math.log(Math.min(rms[Math.max(0, i - 2)], rms[Math.max(0, i - 3)]) + 1e-5); if (d > rise) rise = d; }
  const v = flux[best];
  if (hiFlux[best] > 1.5 * v && v < 0.4 * typical) return null; // metronome bleed, not a note
  const ok = (v - base) >= 0.22 * typical || (rise >= 0.3 && v - base >= 0.1 * typical);
  if (!ok) return null;
  const time = refineOnset(x, sr, (best * hop + frame / 2) / sr);
  return { time, strength: v, peak: peakAmp(x, sr, time), guided: true };
}

/** Sharpen an onset to ~1 ms using a short energy envelope around the coarse time. */
export function refineOnset(x, sr, t) {
  const s0 = Math.max(0, Math.floor((t - 0.03) * sr)), s1 = Math.min(x.length - 1, Math.floor((t + 0.02) * sr));
  const win = Math.max(8, Math.round(0.001 * sr));
  const env = [];
  for (let s = s0; s + win <= s1; s += win) { let e = 0; for (let i = 0; i < win; i++) e += x[s + i] * x[s + i]; env.push(Math.sqrt(e / win)); }
  if (env.length < 4) return t;
  let maxI = 0; for (let i = 1; i < env.length; i++) if (env[i] > env[maxI]) maxI = i;
  let base = Infinity; for (let i = 0; i <= maxI; i++) base = Math.min(base, env[i]);
  const thr = base + 0.25 * (env[maxI] - base);
  let k = 0; while (k < maxI && env[k] < thr) k++;
  // walk back from the max to the last sample below threshold (handles a pre-attack bump)
  let j = maxI; while (j > 0 && env[j - 1] >= thr) j--;
  k = Math.max(k, j);
  return (s0 + k * win) / sr;
}

export function peakAmp(x, sr, t, dur = 0.04) {
  const a = Math.max(0, Math.floor(t * sr)), b = Math.min(x.length, a + Math.floor(dur * sr));
  let m = 0; for (let i = a; i < b; i++) { const v = Math.abs(x[i]); if (v > m) m = v; }
  return m;
}

/** Pitch (MIDI, fractional) of the note starting at t, or null. */
export function pitchAt(x, sr, t, maxDur = 0.12) {
  const start = Math.floor((t + 0.025) * sr);
  const len = Math.min(Math.floor(maxDur * sr), 4096);
  if (start + 1500 > x.length) return null;
  const seg = x.subarray(start, Math.min(x.length, start + len));
  if (seg.length < 1500) return null;
  const r = detectPitch(seg, sr, { minFreq: 70, maxFreq: 1400, threshold: 0.15 });
  if (!r || r.clarity < 0.75) return null;
  return freqToMidi(r.freq);
}

/**
 * Is the expected note sounding at t? Uses the YIN difference function at the
 * expected period (and its octaves), so it still works while other strings ring.
 * Returns the best normalized difference (lower = more clearly present).
 */
export function presenceAt(x, sr, t, midi, maxDur = 0.12) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const start = Math.floor((t + 0.025) * sr), len = Math.min(Math.floor(maxDur * sr), 4096);
  const seg = x.subarray(start, Math.min(x.length, start + len));
  const tauE = sr / f;
  const taus = [tauE, tauE * 2, tauE / 2].filter(tt => tt >= 8 && tt * 2 < seg.length);
  if (!taus.length) return null;
  let best = 1;
  for (const tt of taus) {
    const W = seg.length - Math.ceil(tt * 1.03) - 1; if (W < 256) continue;
    let e0 = 0; for (let i = 0; i < W; i++) e0 += seg[i] * seg[i];
    for (let tau = Math.max(1, Math.floor(tt * 0.97)); tau <= Math.ceil(tt * 1.03); tau++) {
      let d = 0, e1 = 0;
      for (let i = 0; i < W; i++) { const b = seg[i + tau], v = seg[i] - b; d += v * v; e1 += b * b; }
      const nd = d / (e0 + e1 + 1e-9);
      if (nd < best) best = nd;
    }
  }
  return best;
}

/**
 * Spectral "new energy" check: which candidate pitch gained harmonic energy at
 * this onset? Robust when earlier notes keep ringing. Returns {exp, best, bestMidi}
 * where exp/best are harmonic saliences of the expected and the strongest candidate.
 */
const N_H = 8192;
function magSpec(x, a, len) {
  const re = new Float32Array(N_H), im = new Float32Array(N_H);
  for (let i = 0; i < len; i++) { const v = x[a + i] || 0; const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (len - 1)); re[i] = v * w; }
  fft(re, im);
  const m = new Float32Array(N_H / 2); for (let k = 0; k < N_H / 2; k++) m[k] = Math.hypot(re[k], im[k]);
  return m;
}
export function harmonicCheck(x, sr, t, midi, { maxDur = 0.09 } = {}) {
  const len = Math.min(4096, Math.floor(maxDur * sr));
  const on = Math.floor(t * sr);
  if (on - len - 64 < 0 || on + len + 256 > x.length) return null;
  const after = magSpec(x, on + Math.floor(0.008 * sr), len), before = magSpec(x, on - len - Math.floor(0.004 * sr), len);
  const hz = sr / N_H;
  const sal = m => {
    const f0 = 440 * Math.pow(2, (m - 69) / 12); let s = 0;
    for (let h = 1; h <= 6; h++) {
      const f = f0 * h; if (f > 5000) break;
      const k = Math.round(f / hz), r = Math.max(1, Math.round(f * 0.012 / hz)); let best = 0;
      for (let j = k - r; j <= k + r; j++) if (j > 0 && j < after.length) { const d = after[j] - before[j]; if (d > best) best = d; }
      s += best / Math.sqrt(h);
    }
    return s;
  };
  const cands = [midi, midi - 2, midi - 1, midi + 1, midi + 2];
  const vals = cands.map(sal);
  let bi = 0; vals.forEach((v, i) => { if (v > vals[bi]) bi = i; });
  return { exp: vals[0], best: vals[bi], bestMidi: cands[bi] };
}

/** Simple high-band energy onset finder for latency calibration clicks. */
export function detectClicks(x, sr, band = [3000, 6000]) {
  return detectOnsets(x, sr, { band, minGap: 0.2, sensitivity: 0.7, rejectClicks: false });
}

export const rmsOf = buf => { let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / (buf.length || 1)); };
