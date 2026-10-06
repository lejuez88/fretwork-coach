// Pitch detection (YIN with parabolic interpolation). Pure functions so they
// can be unit-tested and reused by the Phase C playing evaluator.

/**
 * Estimate the fundamental frequency of `buf` (Float32Array, mono).
 * Returns {freq, clarity} or null when no clear pitch is present.
 */
export function detectPitch(buf, sampleRate, { minFreq = 50, maxFreq = 1400, threshold = 0.12 } = {}) {
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buf.length / 2) - 1);
  const W = buf.length - tauMax;
  if (W < tauMax || tauMax <= tauMin) return null;

  // Difference function d(tau)
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; sum += x * x; }
    d[tau] = sum;
  }
  // Cumulative mean normalized difference d'(tau)
  const cmnd = new Float32Array(tauMax + 1); cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) { running += d[tau]; cmnd[tau] = running ? d[tau] * tau / running : 1; }

  // First dip below threshold, then walk to its local minimum
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) { while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++; tau = t; break; }
  }
  if (tau < 0) {
    // No dip under threshold: take the global minimum if it is reasonably clear
    let best = tauMin;
    for (let t = tauMin + 1; t <= tauMax; t++) if (cmnd[t] < cmnd[best]) best = t;
    if (cmnd[best] > 0.3) return null;
    tau = best;
  }
  // Parabolic interpolation on the raw difference function for sub-sample accuracy
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const s0 = d[tau - 1], s1 = d[tau], s2 = d[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom) better = tau + (s2 - s0) / denom;
  }
  return { freq: sampleRate / better, clarity: 1 - cmnd[tau] };
}

export function rms(buf) { let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); }

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function freqToMidi(f, a4 = 440) { return 69 + 12 * Math.log2(f / a4); }
export function midiToFreq(m, a4 = 440) { return a4 * Math.pow(2, (m - 69) / 12); }
export function midiName(m) { const r = Math.round(m); return NOTE_NAMES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1); }
export function centsBetween(f, ref) { return 1200 * Math.log2(f / ref); }

/** Median of the last n values: kills single-frame octave glitches. */
export function median(arr) { const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
