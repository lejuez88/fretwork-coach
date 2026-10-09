// Metronome sounds: every voice builds its audio graph without errors.
import { Audio, CLICK_SOUNDS } from '../js/core/audio.js';
const ok = window.__ok;
const made = [];
const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
const node = kind => { const n = { kind, connect() {}, start() { made.push(kind); }, stop() {}, frequency: param(), gain: param(), Q: param(), type: '' }; return n; };
const ctx = { currentTime: 1, sampleRate: 44100, state: 'running',
  createOscillator: () => node('osc'), createGain: () => node('gain'), createBiquadFilter: () => node('filter'), createBufferSource: () => node('noise'),
  createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }) };
Audio.ctx = ctx; Audio.master = node('master'); Audio.get = () => ctx;
ok(CLICK_SOUNDS.length >= 8, `${CLICK_SOUNDS.length} sounds`);
for (const [id, label] of CLICK_SOUNDS) {
  Audio.sound = id; made.length = 0;
  let threw = null; try { Audio.click(2, true, 1); Audio.click(2.5, false, 0.5); } catch (e) { threw = e.message; }
  ok(!threw && made.length >= 2, `${label} plays (${made.join(',')})${threw ? ': ' + threw : ''}`);
}
Audio.sound = 'nonsense'; made.length = 0; Audio.click(3, false, 1); ok(made.length === 1, 'unknown sound falls back to the classic click');
Audio.clickStyle = 'eval'; Audio.sound = 'drums'; made.length = 0; Audio.click(3, true, 1); ok(made.length === 1, 'evaluation mode keeps its filtered blip'); Audio.clickStyle = 'normal';
window.__finish();
