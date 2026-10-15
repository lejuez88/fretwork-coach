// Listens to the microphone for single played notes (a guitar note, plucked). Calls onNote(midi)
// once per pluck, after the pitch has held steady for three frames (about 120 ms). A note still
// ringing from before, or a tone the app is playing (ignore(ms)), is skipped until you pluck again.
import { Audio } from '../core/audio.js';
import { detectPitch, rms, freqToMidi } from './pitch.js';
import { listenRange } from '../core/guitar.js';

/**
 * createNoteListener({ onNote(midi, pc), onLevel?(rms), a4?: () => 440 })
 * → { start(): Promise<true | Error>, stop(), ignore(ms), get on() }
 */
export function createNoteListener({ onNote, onLevel = null, a4 = () => 440 } = {}) {
  const m = { range: listenRange(), on: false, an: null, hp: null, buf: null, timer: null, cur: null, n: 0, env: 0, quiet: 0, fired: false, ignoreUntil: 0 };
  function frame() {
    if (!m.an || !Audio.ctx) return;
    m.an.getFloatTimeDomainData(m.buf);
    const lv = rms(m.buf), prevEnv = m.env;
    m.env = Math.max(lv, m.env * 0.88);
    if (onLevel) onLevel(lv);
    if (lv < 0.006) { if (++m.quiet >= 3) m.fired = false; m.n = 0; m.cur = null; return; }
    m.quiet = 0;
    if (Date.now() < m.ignoreUntil) return;
    if (lv > 0.015 && lv > prevEnv * 1.5) { m.fired = false; m.n = 0; m.cur = null; }   // a new pluck
    if (m.fired) return;
    const pd = detectPitch(m.buf, Audio.ctx.sampleRate, { minFreq: m.range.minFreq, maxFreq: 1400, threshold: 0.12 });
    if (!pd || pd.clarity < 0.85) { m.n = 0; return; }
    const midi = Math.round(freqToMidi(pd.freq, a4()));
    if (midi === m.cur) m.n++; else { m.cur = midi; m.n = 1; }
    if (m.n === 3) { m.fired = true; onNote(midi, ((midi % 12) + 12) % 12); }
  }
  return {
    get on() { return m.on; },
    async start() {
      if (m.on) return true;
      try {
        const src = await Audio.openMic();
        const c = Audio.ctx;
        m.range = listenRange(); // the lowest string of the player's guitar (7- and 8-string included)
        m.hp = c.createBiquadFilter(); m.hp.type = 'highpass'; m.hp.frequency.value = m.range.highpass;
        m.an = c.createAnalyser(); m.an.fftSize = m.range.fftSize; m.an.smoothingTimeConstant = 0;
        src.connect(m.hp); m.hp.connect(m.an);
        m.buf = new Float32Array(m.an.fftSize);
        Object.assign(m, { on: true, cur: null, n: 0, env: 0, quiet: 0, fired: false });
        m.timer = setInterval(frame, 40);
        return true;
      } catch (e) { return e instanceof Error ? e : new Error(String(e)); }
    },
    stop() {
      if (!m.on) return;
      clearInterval(m.timer);
      try { m.hp && m.hp.disconnect(); m.an && m.an.disconnect(); } catch { /* ignore */ }
      Audio.closeMic();
      Object.assign(m, { on: false, an: null, hp: null, timer: null });
    },
    /** Skip what the microphone hears for a while (the app's own sound). */
    ignore(ms) { m.ignoreUntil = Date.now() + ms; m.fired = false; },
    /** For tests: feed a detected note as if it were played. */
    _hear(midi) { onNote(midi, ((midi % 12) + 12) % 12); }
  };
}
