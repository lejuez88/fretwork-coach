// Metronome engine (lookahead scheduler on the audio clock) and a reusable UI.
import { Audio, CHORD_MIDI } from '../core/audio.js';
import { clamp, esc, toast } from '../core/util.js';

export const Metronome = {
  bpm: 80, beatsPerBar: 4, subdiv: 1, mode: 'all', backing: null, volume: 1,
  ramp: null, // {enabled, step, everyBars, max}: tempo ladder
  running: false, nextTime: 0, tickIdx: 0, bar: 0, timerId: null, listeners: new Set(), wake: null,
  startedAt: 0,

  start() {
    const c = Audio.get(); if (!c) { toast('Audio is not supported in this browser.'); return false; }
    this.running = true; this.tickIdx = 0; this.bar = 0; this.nextTime = c.currentTime + 0.1; this.startedAt = this.nextTime;
    clearInterval(this.timerId); this.timerId = setInterval(() => this.tick(), 25); this.tick();
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { this.wake = w; }).catch(() => {}); } catch { /* ignore */ }
    this.emit({ type: 'state', running: true });
    return true;
  },
  stop() {
    if (!this.running) return;
    this.running = false; clearInterval(this.timerId); this.timerId = null;
    try { if (this.wake) { this.wake.release(); this.wake = null; } } catch { /* ignore */ }
    this.emit({ type: 'state', running: false });
  },
  toggle() { return this.running ? (this.stop(), false) : this.start(); },
  setBpm(v) { this.bpm = clamp(Math.round(v), 20, 300); this.emit({ type: 'bpm', bpm: this.bpm }); },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(e) { this.listeners.forEach(fn => { try { fn(e); } catch { /* ignore */ } }); },

  tick() {
    const c = Audio.ctx; if (!c || !this.running) return;
    const perBeat = 60 / this.bpm, step = perBeat / this.subdiv, ticksPerBar = this.beatsPerBar * this.subdiv;
    while (this.nextTime < c.currentTime + 0.12) {
      const inBar = this.tickIdx % ticksPerBar, beat = Math.floor(inBar / this.subdiv), sub = inBar % this.subdiv;
      this.schedule(beat, sub, this.bar, this.nextTime, perBeat);
      this.nextTime += step; this.tickIdx++;
      if (this.tickIdx % ticksPerBar === 0) {
        this.bar++;
        const R = this.ramp;
        if (R && R.enabled && this.bar % R.everyBars === 0 && this.bpm < R.max) {
          this.bpm = Math.min(R.max, this.bpm + R.step);
          const at = this.nextTime, v = this.bpm;
          setTimeout(() => this.emit({ type: 'bpm', bpm: v, ramp: true }), Math.max(0, (at - c.currentTime) * 1000));
          return; // re-enter with the new step size
        }
      }
    }
  },
  schedule(beat, sub, bar, t, perBeat) {
    let audible = true;
    if (this.mode === 'backbeat') audible = sub === 0 && beat % 2 === 1;
    if (this.mode === 'gap') audible = (bar % 4) < 2;
    if (audible) Audio.click(t, beat === 0 && sub === 0 && this.mode !== 'backbeat', sub ? 0.45 * this.volume : this.volume);
    if (this.backing && beat === 0 && sub === 0) {
      const ch = this.backing[bar % this.backing.length];
      if (CHORD_MIDI[ch]) Audio.strum(CHORD_MIDI[ch], t, { dur: perBeat * this.beatsPerBar * 0.98, gain: 0.45 });
    }
    if (sub === 0) {
      const delay = Math.max(0, (t - Audio.ctx.currentTime) * 1000);
      setTimeout(() => { if (this.running) this.emit({ type: 'beat', beat, bar, silent: !audible, time: t }); }, delay);
    }
  },
  configure({ bpm, mode, backing, beatsPerBar, subdiv, ramp = null } = {}) {
    if (bpm != null) this.setBpm(bpm);
    this.ramp = ramp;
    if (mode) this.mode = mode;
    this.backing = backing || null;
    if (beatsPerBar) this.beatsPerBar = beatsPerBar;
    this.subdiv = subdiv || 1;
    this.emit({ type: 'config' });
  }
};

const MODES = { all: 'Every beat', backbeat: '2 & 4 only', gap: 'Gap: 2 on / 2 off' };

/**
 * Mount a metronome control panel. Returns a cleanup function.
 * opts: {compact, showMeter}
 */
export function mountMetronome(el, opts = {}) {
  const taps = [];
  el.innerHTML = `
  <div class="metro ${opts.compact ? 'compact' : ''}">
    <div class="beats" data-r="beats">${'<i></i>'.repeat(Metronome.beatsPerBar)}</div>
    <div class="bpmrow">
      <button class="kbtn" data-d="-5">−5</button><button class="kbtn" data-d="-1">−1</button>
      <div class="bpm"><b data-r="bpm">${Metronome.bpm}</b><span>BPM</span></div>
      <button class="kbtn" data-d="1">+1</button><button class="kbtn" data-d="5">+5</button>
    </div>
    <input type="range" min="20" max="300" value="${Metronome.bpm}" data-r="range" aria-label="Tempo">
    <div class="row">
      <button class="btn ${Metronome.running ? 'stop' : 'primary'}" data-r="toggle">${Metronome.running ? '■ Stop' : '▶ Start'}</button>
      <button class="btn" data-r="tap">Tap</button>
    </div>
    ${opts.compact ? '' : `
    <div class="row metro-opts">
      <label class="mini">Mode<select data-r="mode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${Metronome.mode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="mini">Beats<select data-r="bpb">${[2, 3, 4, 5, 6, 7].map(n => `<option ${Metronome.beatsPerBar === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="mini">Clicks<select data-r="sub">${[[1, 'Quarters'], [2, '8ths'], [3, 'Triplets'], [4, '16ths']].map(([v, l]) => `<option value="${v}" ${Metronome.subdiv === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>`}
    ${Metronome.backing ? `<div class="backing">♫ Backing: ${esc(Metronome.backing.join(' – '))}</div>` : ''}
    ${Metronome.ramp ? `<div class="ramp-row"><button class="tgl ${Metronome.ramp.enabled ? 'on' : ''}" data-r="ramp">Tempo ladder</button><span class="small muted" data-r="ramptxt"></span></div>` : ''}
  </div>`;
  const r = n => el.querySelector(`[data-r="${n}"]`);
  const rampText = () => { const R = Metronome.ramp; const el2 = r('ramptxt'); if (R && el2) el2.textContent = R.enabled ? `+${R.step} BPM every ${R.everyBars} bars, up to ${R.max}` : 'Holding this tempo'; };
  const sync = () => {
    rampText();
    r('bpm').textContent = Metronome.bpm; r('range').value = Metronome.bpm;
    const b = r('toggle'); b.className = 'btn ' + (Metronome.running ? 'stop' : 'primary'); b.textContent = Metronome.running ? '■ Stop' : '▶ Start';
    const beats = r('beats'); if (beats.children.length !== Metronome.beatsPerBar) beats.innerHTML = '<i></i>'.repeat(Metronome.beatsPerBar);
  };
  const off = Metronome.on(e => {
    if (e.type === 'beat') {
      [...r('beats').children].forEach((d, i) => { d.className = i === e.beat ? 'on' + (i === 0 && Metronome.mode !== 'backbeat' ? ' acc' : '') + (e.silent ? ' silent' : '') : ''; });
    } else { sync(); if (e.type === 'state' && !e.running) [...r('beats').children].forEach(d => { d.className = ''; }); }
  });
  el.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b || !el.contains(b)) return;
    if (b.dataset.d) Metronome.setBpm(Metronome.bpm + Number(b.dataset.d));
    else if (b.dataset.r === 'toggle') Metronome.toggle();
    else if (b.dataset.r === 'ramp' && Metronome.ramp) { Metronome.ramp.enabled = !Metronome.ramp.enabled; b.classList.toggle('on', Metronome.ramp.enabled); rampText(); }
    else if (b.dataset.r === 'tap') {
      const now = performance.now(); if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
      taps.push(now); if (taps.length > 6) taps.shift();
      if (taps.length >= 3) { const gaps = taps.slice(1).map((t, i) => t - taps[i]); Metronome.setBpm(60000 / (gaps.reduce((a, b2) => a + b2, 0) / gaps.length)); }
    }
  });
  r('range').addEventListener('input', e => Metronome.setBpm(+e.target.value));
  if (!opts.compact) {
    r('mode').addEventListener('change', e => { Metronome.mode = e.target.value; });
    r('bpb').addEventListener('change', e => { Metronome.beatsPerBar = +e.target.value; sync(); });
    r('sub').addEventListener('change', e => { Metronome.subdiv = +e.target.value; });
  }
  rampText();
  return () => off();
}
