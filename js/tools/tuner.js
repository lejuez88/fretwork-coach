// Chromatic + guitar tuner. Mic → high-pass → analyser → YIN at ~20 Hz,
// median-of-5 smoothing, needle + strobe display, adjustable A4 and tunings.
import { Audio } from '../core/audio.js';
import { detectPitch, rms, freqToMidi, midiToFreq, midiName, median, NOTE_NAMES } from './pitch.js';
import { esc } from '../core/util.js';
import { Store } from '../core/store.js';
import { inputSummaryHTML, openAudioSheet } from '../ui/audiosetup.js';

export const TUNINGS = {
  standard: { label: 'Standard (E A D G B E)', notes: [40, 45, 50, 55, 59, 64] },
  dropD: { label: 'Drop D', notes: [38, 45, 50, 55, 59, 64] },
  halfDown: { label: 'E♭ standard (½ step down)', notes: [39, 44, 49, 54, 58, 63] },
  wholeDown: { label: 'D standard', notes: [38, 43, 48, 53, 57, 62] },
  dropC: { label: 'Drop C', notes: [36, 43, 48, 53, 57, 62] },
  dadgad: { label: 'DADGAD', notes: [38, 45, 50, 55, 57, 62] },
  openG: { label: 'Open G', notes: [38, 43, 50, 55, 59, 62] },
  openD: { label: 'Open D', notes: [38, 45, 50, 54, 57, 62] },
  openE: { label: 'Open E', notes: [40, 47, 52, 56, 59, 64] }
};

/**
 * Mount the tuner. settings: {referenceA4, tuning}; onSettings(next) persists changes.
 * opts.mini: compact layout for a sheet; opts.pop: just the curved meter and the note
 * (the pop-up quick tuner); opts.autostart: open the mic at once.
 * Returns cleanup.
 */
export function mountTuner(el, settings, onSettings, { mini = false, pop = false, autostart = false } = {}) {
  let a4 = settings.referenceA4 || 440, tuningKey = settings.tuning in TUNINGS ? settings.tuning : 'standard';
  let target = null; // null = auto (nearest string) | 'chromatic' | string index
  let running = false, analyser = null, hp = null, buf = null, timer = null, raf = null;
  const hist = []; let shown = null, inTuneSince = 0, strobePos = 0, lastFrame = performance.now(), lastCents = null;

  const POP_TICKS = [-50, -25, 0, 25, 50].map(c => { const a = (c / 50) * 70 * Math.PI / 180; return `<line x1="${150 + Math.sin(a) * 118}" y1="${150 - Math.cos(a) * 118}" x2="${150 + Math.sin(a) * (c ? 104 : 98)}" y2="${150 - Math.cos(a) * (c ? 104 : 98)}" stroke="${c ? 'var(--muted)' : 'var(--green)'}" stroke-width="${c ? 3 : 4}"/>`; }).join('');
  el.innerHTML = pop ? `
  <div class="tuner pop" role="group" aria-label="Quick tuner">
    <svg class="gauge" viewBox="0 0 300 156" aria-hidden="true">
      <path d="M30 150 A120 120 0 0 1 270 150" fill="none" stroke="var(--line)" stroke-width="12" stroke-linecap="round"/>
      <path d="M140 31 A120 120 0 0 1 160 31" fill="none" stroke="var(--green)" stroke-width="14"/>
      ${POP_TICKS}
      <g data-r="needle" style="transform-origin:150px 150px;transition:transform .08s linear"><line x1="150" y1="150" x2="150" y2="42" stroke="var(--amber)" stroke-width="5" stroke-linecap="round"/></g>
      <circle cx="150" cy="150" r="9" fill="var(--amber)"/>
    </svg>
    <div class="tpop-read"><span class="tuner-note"><span data-r="note">—</span><small data-r="oct"></small></span><span class="tpop-cents" data-r="cents">♪</span></div>
    <div class="tuner-status" data-r="status">Starting the mic…</div>
  </div>` : mini ? `
  <div class="tuner mini">
    <div class="tmini-top"><div class="tuner-note"><span data-r="note">—</span><small data-r="oct"></small></div>
      <div class="tmini-read"><span data-r="cents">— ¢</span><span data-r="hz">— Hz</span><span data-r="target">Auto</span></div></div>
    <svg class="gauge" viewBox="0 0 300 160" aria-hidden="true">
      <path d="M30 150 A120 120 0 0 1 270 150" fill="none" stroke="var(--line)" stroke-width="10" stroke-linecap="round"/>
      <path d="M142 32 A120 120 0 0 1 158 32" fill="none" stroke="var(--green)" stroke-width="12"/>
      <g data-r="needle" style="transform-origin:150px 150px;transition:transform .08s linear"><line x1="150" y1="150" x2="150" y2="40" stroke="var(--amber)" stroke-width="4" stroke-linecap="round"/></g>
      <circle cx="150" cy="150" r="8" fill="var(--amber)"/>
    </svg>
    <div class="strobe" data-r="strobe"></div>
    <div class="tuner-status" data-r="status">Tap Start and play one string at a time.</div>
    <div class="strings" data-r="strings"></div>
    <div class="row tmini-ctrl"><button class="btn primary" data-r="go">🎤 Start tuner</button>
      <select data-r="tuning" aria-label="Tuning">${Object.entries(TUNINGS).map(([k, t]) => `<option value="${k}" ${k === tuningKey ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></div>
    <div class="small muted tmini-foot">A4 = <b data-r="a4">${a4}</b> Hz · more options in <a class="link" href="#/tools/tuner" data-r="full">Tools → Tuner</a></div>
  </div>` : `
  <div class="tuner card">
    <div class="tuner-note"><span data-r="note">—</span><small data-r="oct"></small></div>
    <svg class="gauge" viewBox="0 0 300 160" aria-hidden="true">
      <path d="M30 150 A120 120 0 0 1 270 150" fill="none" stroke="var(--line)" stroke-width="10" stroke-linecap="round"/>
      <path d="M142 32 A120 120 0 0 1 158 32" fill="none" stroke="var(--green)" stroke-width="12"/>
      ${[-50, -25, 0, 25, 50].map(c => { const a = (c / 50) * 70 * Math.PI / 180; const x1 = 150 + Math.sin(a) * 104, y1 = 150 - Math.cos(a) * 104, x2 = 150 + Math.sin(a) * 92, y2 = 150 - Math.cos(a) * 92; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--muted)" stroke-width="2"/><text x="${150 + Math.sin(a) * 78}" y="${150 - Math.cos(a) * 78 + 4}" text-anchor="middle" font-size="11" fill="var(--muted)">${c > 0 ? '+' + c : c}</text>`; }).join('')}
      <g data-r="needle" style="transform-origin:150px 150px;transition:transform .08s linear"><line x1="150" y1="150" x2="150" y2="40" stroke="var(--amber)" stroke-width="4" stroke-linecap="round"/></g>
      <circle cx="150" cy="150" r="8" fill="var(--amber)"/>
    </svg>
    <div class="strobe" data-r="strobe"></div>
    <div class="tuner-read"><span data-r="cents">— ¢</span><span data-r="hz">— Hz</span><span data-r="target">Auto</span></div>
    <div class="tuner-status" data-r="status">Tap Start and play one string at a time.</div>
    <button class="btn primary block" data-r="go">🎤 Start tuner</button>
    <div data-r="inline">${Store.profile ? inputSummaryHTML(Store.profile) : ''}</div>
  </div>
  <div class="card">
    <div class="label">Strings</div>
    <div class="strings" data-r="strings"></div>
    <p class="muted small">Tap a string to lock the target and hear a reference tone. Tap Auto to pick the nearest string, or Chromatic for any note.</p>
    <div class="row">
      <label class="mini grow">Tuning<select data-r="tuning">${Object.entries(TUNINGS).map(([k, t]) => `<option value="${k}" ${k === tuningKey ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></label>
      <label class="mini">A4 (Hz)<div class="a4"><button class="kbtn sm" data-a4="-1">−</button><b data-r="a4">${a4}</b><button class="kbtn sm" data-a4="1">+</button></div></label>
    </div>
  </div>`;
  const r = n => el.querySelector(`[data-r="${n}"]`);

  function renderStrings() {
    if (!r('strings')) return;
    const notes = TUNINGS[tuningKey].notes;
    r('strings').innerHTML =
      `<button class="chip ${target === null ? 'on' : ''}" data-t="auto">Auto</button>` +
      notes.map((m, i) => `<button class="chip ${target === i ? 'on' : ''}" data-t="${i}">${6 - i}: ${midiName(m)}</button>`).join('') +
      `<button class="chip ${target === 'chromatic' ? 'on' : ''}" data-t="chromatic">Chromatic</button>`;
    r('target').textContent = target === null ? 'Auto' : target === 'chromatic' ? 'Chromatic' : `String ${6 - target}`;
  }
  renderStrings();

  function resolve(freq) {
    const m = freqToMidi(freq, a4);
    let refMidi;
    if (target === 'chromatic') refMidi = Math.round(m);
    else if (typeof target === 'number') refMidi = TUNINGS[tuningKey].notes[target];
    else { const notes = TUNINGS[tuningKey].notes; refMidi = notes.reduce((b, n) => (Math.abs(n - m) < Math.abs(b - m) ? n : b), notes[0]); if (Math.abs(refMidi - m) > 2.5) refMidi = Math.round(m); }
    const ref = midiToFreq(refMidi, a4);
    return { refMidi, cents: 1200 * Math.log2(freq / ref) };
  }

  function analyse() {
    analyser.getFloatTimeDomainData(buf);
    const level = rms(buf);
    if (level < 0.006) { hist.length = 0; return show(null, level); }
    const p = detectPitch(buf, Audio.ctx.sampleRate, { minFreq: 35, maxFreq: 1400, threshold: 0.12 });
    if (!p || p.clarity < 0.82) return show(null, level);
    hist.push(p.freq); if (hist.length > 5) hist.shift();
    // Reject an octave jump until it repeats
    const med = median(hist);
    show(med, level);
  }

  function show(freq, level) {
    if (freq == null) {
      if (shown != null && performance.now() - shown.at < 400) return; // brief hold to avoid flicker
      r('status').textContent = level < 0.006 ? (pop ? 'Play a string' : 'Listening… play a string.') : (pop ? 'Mute the other strings' : 'Unclear pitch. Mute the other strings.');
      r('status').className = 'tuner-status'; lastCents = null;
      return;
    }
    const { refMidi, cents } = resolve(freq);
    shown = { at: performance.now() };
    lastCents = cents;
    const nm = midiName(refMidi);
    r('note').textContent = nm.replace(/-?\d+$/, ''); r('oct').textContent = nm.match(/-?\d+$/)[0];
    r('cents').textContent = (cents > 0 ? '+' : '') + (pop ? Math.round(cents) : cents.toFixed(1)) + ' ¢';
    if (r('hz')) r('hz').textContent = freq.toFixed(2) + ' Hz';
    const ang = Math.max(-50, Math.min(50, cents)) / 50 * 70;
    r('needle').style.transform = `rotate(${ang}deg)`;
    const inTune = Math.abs(cents) < 2;
    if (inTune) { if (!inTuneSince) inTuneSince = performance.now(); } else inTuneSince = 0;
    const locked = inTuneSince && performance.now() - inTuneSince > 500;
    const st = r('status');
    st.textContent = locked ? '✓ In tune' : Math.abs(cents) < 5 ? 'Almost there' : cents < 0 ? (pop ? 'Flat ↑' : 'Flat: tune up ↑') : (pop ? 'Sharp ↓' : 'Sharp: tune down ↓');
    st.className = 'tuner-status ' + (locked ? 'ok' : Math.abs(cents) < 5 ? 'near' : 'off');
    el.querySelector('.tuner').classList.toggle('intune', !!locked);
  }

  function strobeLoop(now) {
    const dt = (now - lastFrame) / 1000; lastFrame = now;
    if (lastCents != null && r('strobe')) { strobePos += lastCents * dt * 6; r('strobe').style.backgroundPositionX = strobePos + 'px'; }
    raf = requestAnimationFrame(strobeLoop);
  }

  let dead = false;
  async function start() {
    try {
      const src = await Audio.openMic();
      if (dead) { Audio.closeMic(); return; } // closed while the permission prompt was up
      const c = Audio.ctx;
      hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 30;
      analyser = c.createAnalyser(); analyser.fftSize = 4096; analyser.smoothingTimeConstant = 0;
      src.connect(hp); hp.connect(analyser);
      buf = new Float32Array(analyser.fftSize);
      running = true; timer = setInterval(analyse, 50); raf = requestAnimationFrame(strobeLoop);
      if (r('go')) { r('go').textContent = '■ Stop tuner'; r('go').className = mini ? 'btn stop' : 'btn stop block'; }
      r('status').textContent = pop ? 'Play a string' : 'Listening… play a string.';
    } catch (e) {
      r('status').textContent = e.name === 'NotAllowedError' ? (pop ? 'Mic blocked: allow it in site settings' : 'Microphone permission was denied. Allow it in your browser’s site settings.') : (e.message || 'Could not open the microphone.');
    }
  }
  function stop() {
    running = false; clearInterval(timer); cancelAnimationFrame(raf);
    try { hp && hp.disconnect(); analyser && analyser.disconnect(); } catch { /* ignore */ }
    if (analyser) Audio.closeMic();
    analyser = null; hp = null;
    const go = r('go'); if (go) { go.textContent = '🎤 Start tuner'; go.className = mini ? 'btn primary' : 'btn primary block'; }
  }

  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.audio === 'change') {
      const was = running; if (running) stop();
      openAudioSheet(Store.profile, () => { const il = r('inline'); if (il) il.innerHTML = inputSummaryHTML(Store.profile); if (was) start(); });
      return;
    }
    if (b.dataset.r === 'go') return running ? stop() : start();
    if (b.dataset.a4) { a4 = Math.max(415, Math.min(466, a4 + Number(b.dataset.a4))); r('a4').textContent = a4; onSettings({ referenceA4: a4 }); return; }
    if (b.dataset.t != null) {
      const t = b.dataset.t; target = t === 'auto' ? null : t === 'chromatic' ? 'chromatic' : Number(t);
      if (typeof target === 'number') { const m = TUNINGS[tuningKey].notes[target]; Audio.guitar(m, null, { dur: 2.5, gain: 0.7, cents: 1200 * Math.log2(a4 / 440) }); }
      renderStrings();
    }
  });
  if (r('tuning')) r('tuning').addEventListener('change', e => { tuningKey = e.target.value; target = null; renderStrings(); onSettings({ tuning: tuningKey }); });

  if (autostart) start();
  return () => { dead = true; stop(); };
}
export { NOTE_NAMES };
