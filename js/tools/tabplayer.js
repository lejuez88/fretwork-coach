// Tab player: renders structured tab as SVG (one long scrolling line or wrapped
// lines), plays it with the Karplus-Strong guitar voice and a click, and shows
// the notes on a fretboard underneath as they sound.
//   Play / Pause keeps your place; ⏮ goes back to the start.
//   Click (or tap) the tab, or the bar strip under it, to move the playhead.
//   Drag across notes (or along the bar strip) to select them: the selection
//   lights up and loops when you play.
// It also counts in, loops, steps the tempo up (tempo ladder), lights the chord
// box that is sounding, and logs the tempo a run finished at.
// With {dock: true} the transport, tempo and playback switches move to the
// playback bar at the bottom of the screen (ui/transport.js).
import { Audio } from '../core/audio.js';
import { esc, clamp, toast } from '../core/util.js';
import { noteMidi, exerciseBeats, STD_TUNING } from './exercises.js';
import { clickSoundSelectHTML } from '../ui/clicksound.js';
import { computePicks, suggestPicking, strokeSVG, PICK_MODES } from './picking.js';
import { fretboardSVG } from '../ui/fretboard.js';
import { chordTimeline, chordAt, findDiagrams, highlightChord } from '../ui/chordsync.js';
import { beatLabel, clickNote } from '../core/tempo.js';
import { Transport } from '../ui/transport.js';

const PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** String labels for a tuning (string 1 first): standard gives e B G D A E. */
export const stringNames = (tuning = STD_TUNING) => tuning.map((m, i) => { const n = PC[((m % 12) + 12) % 12]; return i === 0 && n === 'E' ? 'e' : n; });
const noteName = m => PC[((m % 12) + 12) % 12];

const ROW = 18, BOTTOM = 12, PAD = 28, NOTE_DX = 4;
const TOP_PLAIN = 26, TOP_PICKS = 46; // room above the strings: technique row, plus the picking row when shown
const EPS = 1e-6;

/** Tab marks above a note: PM, T (tap), b9 (bend to fret 9), pb9 (pre-bend to 9), r (release), AH (artificial harmonic). */
export function techLabel(n) {
  if (n.x === 'pm') return 'PM';
  if (n.x === 't') return 'T';
  if (n.x === 'b') return n.bendTo != null ? 'b' + n.bendTo : 'b';
  if (n.x === 'pb') return n.bendTo != null ? 'pb' + n.bendTo : 'pb';
  if (n.x === 'ah') return 'AH';
  if (n.x === 'nh') return 'NH';
  return n.x;
}
/** Whammy-bar mark above a note: dip −1, scoop, dive −12, w/bar ~ (vibrato), flutter. */
const FRAC = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
const fmtSemi = d => { const w = Math.floor(d), r = Math.round((d - w) * 4) / 4; return (w || !FRAC[r] ? String(w || '') : '') + (FRAC[r] || (r ? String(r) : '')) || '0'; };
export const BAR_DEFAULT = { dip: 1, scoop: 1, dive: 12, vib: 0.5, flutter: 0.5 };
export function barLabel(n) {
  if (!n.bar) return '';
  const d = n.barDepth || BAR_DEFAULT[n.bar] || 1;
  return n.bar === 'vib' ? 'w/bar ~' : n.bar === 'flutter' ? 'flutter' : n.bar === 'scoop' ? `scoop ${fmtSemi(d)}` : `${n.bar} −${fmtSemi(d)}`;
}
/**
 * Pitch movement of a note in cents from its sounding pitch, as [[seconds after the attack, cents]]:
 * bends glide up to their target, releases glide down, and whammy-bar moves follow the bar.
 */
export function pitchMoves(n, len) {
  const pts = [];
  if (n.x === 'b' && n.bendTo != null && n.bendTo > n.f) { const up = (n.bendTo - n.f) * 100, at = Math.min(0.18, len * 0.4); pts.push([0, 0], [at, up]); }
  if (n.x === 'r' && n.bendTo != null && n.bendTo > n.f) { const up = (n.bendTo - n.f) * 100, at = Math.min(0.2, len * 0.45); pts.push([0, up], [at, 0]); }
  if (n.bar) {
    const c = (n.barDepth || BAR_DEFAULT[n.bar] || 1) * 100, last = pts.length ? pts[pts.length - 1] : [0, 0], t0 = last[0], v = last[1];
    if (n.bar === 'dip') pts.push([t0, v], [t0 + Math.min(0.12, len * 0.25), v - c], [t0 + Math.min(0.26, len * 0.5), v]);
    else if (n.bar === 'scoop') { pts.length = 0; pts.push([0, -c], [Math.min(0.14, len * 0.3), 0]); }
    else if (n.bar === 'dive') pts.push([t0, v], [t0 + Math.max(0.2, len * 0.8), v - c]);
    else { const per = n.bar === 'flutter' ? 0.07 : 0.2; let t = t0 || 0.05; pts.push([t, v]); for (let k = 0; t < len && k < 120; k++) { t += per / 2; pts.push([t, v + (k % 2 ? c : -c) / 2]); } }
  }
  return pts;
}
// Natural harmonics: semitones above the open string for the frets where they ring
const HARMONIC = { 12: 12, 7: 19, 19: 19, 5: 24, 24: 24, 4: 28, 9: 28, 16: 28, 3: 31, 2: 34 };
/** The pitch a note actually sounds: harmonics and pre-bends differ from the fretted pitch. */
export function soundMidi(n, tuning = STD_TUNING) {
  const m = noteMidi(n, tuning);
  if (n.x === 'nh') return m - n.f + (HARMONIC[n.f] != null ? HARMONIC[n.f] : 12);
  if (n.x === 'ah') return m + 12;
  if (n.x === 'pb' && n.bendTo != null) return m + (n.bendTo - n.f);
  return m;
}
export function mountTabPlayer(el, ex, { settings = {}, onSettings = () => {}, onLog = null, beatsPerBar: bpbOpt = 4, startBpm = null, compact = false, onBpm = null, ramp = null, evalMode = false, dock = false, theme = null } = {}) {
  const beatsPerBar = ex.beatsPerBar || bpbOpt;
  const total = exerciseBeats(ex, beatsPerBar);
  const notes = [...ex.notes].sort((a, b) => a.t - b.t);
  const tuning = Array.isArray(ex.tuning) && ex.tuning.length === 6 ? ex.tuning : STD_TUNING;
  const names = stringNames(tuning);
  const minStep = Math.min(...notes.map(n => n.d).filter(Boolean), 1);
  const pxBeat = clamp(Math.round(24 / minStep), 48, 100);
  const onsets = [...new Set(notes.map(n => +n.t.toFixed(4)))].sort((a, b) => a - b);
  // Swing: notes written on the "&" sound two-thirds of the way through the beat
  const sw = t => (ex.swing ? Math.floor(t) + (((t % 1) + 1) % 1 === 0.5 ? 2 / 3 : t % 1) : t);
  const unsw = r => { if (!ex.swing) return r; const fl = Math.floor(r), fr = r - fl; return fr < 2 / 3 ? fl + fr * 0.75 : fl + 0.5 + (fr - 2 / 3) * 1.5; };
  const label = beatLabel(ex);
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const timeline = chordTimeline(ex, notes, { beatsPerBar, tuning });
  const timelineReal = timeline ? timeline.map(c => ({ t: sw(c.t), i: c.i })) : null;

  const S = {
    ramp: ramp ? Object.assign({ enabled: true, everyLoops: 2 }, ramp) : null, peakBpm: 0,
    bpm: startBpm || ex.bpm || 80, sound: !evalMode && settings.tabAudio !== false, scroll: settings.tabScroll !== false,
    click: true, loop: true, countIn: true, picks: settings.tabPicks !== false, neck: !evalMode && settings.tabNeck !== false,
    playing: false, t0: 0, schedE: 0, passes: 0, countRun: false,
    P: 0, A: 0, B: total,   // this run: start position and the looped region (real-time beats)
    pos: 0,                 // playhead while paused (real-time beats)
    sel: null,              // selection {a, b} in written beats
    seeked: false, raf: null, sched: null, followUntil: 0
  };
  let docked = null;
  const pickKey = ex.pickKey || ex.id;
  S.pickMode = (settings.pickModes && settings.pickModes[pickKey]) || suggestPicking(ex);

  el.innerHTML = `
  <div class="tabplayer${(theme || settings.tabTheme) === 'light' ? ' tp-light' : ''}">
    ${compact ? '' : `<div class="tp-head">
      <div><div class="label">${esc(ex.unit || '')}${ex.swing ? ' · swing' : ''}</div><h3>${esc(ex.name)}</h3></div>
      <div class="tp-goal" title="${esc(clickNote(ex))}"><span>Goal</span><b>${ex.goalBpm || '—'}</b><span>BPM · ${esc(label)}</span></div>
    </div>
    ${ex.why ? `<p class="why">${esc(ex.why)}</p>` : ''}`}
    <div class="tp-view ${S.scroll ? 'scroll' : 'static'}${S.picks ? ' picks' : ''}${evalMode ? '' : ' seekable'}" data-r="view"><div class="tp-track" data-r="track"></div></div>
    <div class="tp-ruler${evalMode ? ' ro' : ''}" data-r="ruler" aria-label="Bars: click to move the playhead, drag to loop a section">
      <div class="tp-rsel" data-r="rsel" hidden></div><i class="tp-rfill" data-r="prog"></i><b class="tp-rhead" data-r="rhead"></b><div class="tp-rbars" data-r="rbars"></div>
    </div>
    <div class="tp-selbar" data-r="selbar" hidden><span data-r="seltxt"></span><button class="btn sm ghost" data-r="clearsel">✕ Clear loop</button></div>
    ${evalMode ? '' : `<div class="tp-hint small muted">${coarse ? 'Tap a note to move the playhead. Drag along the bar strip to loop a section.' : 'Click a note to move the playhead. Drag across notes (or along the bar strip) to loop them.'}</div>`}
    <div class="fbwrap tpneck" data-r="neck" ${S.neck ? '' : 'hidden'}></div>
    <div class="tp-controls">
      <div class="tp-transport" ${evalMode ? 'hidden' : ''}>
        <button class="kbtn tp-restart" data-r="restart" aria-label="Back to the start" title="Back to the start">⏮</button>
        <button class="btn primary tp-play" data-r="play">▶ Play</button>
        ${onLog ? '<button class="btn" data-r="log">Log this tempo</button>' : ''}
      </div>
      <div class="tp-tempo-wrap">
        <div class="bpmrow tp-tempo">
          <button class="kbtn" data-d="-5">−5</button><button class="kbtn" data-d="-1">−1</button>
          <div class="bpm" title="${esc(clickNote(ex))}"><b data-r="bpm">${S.bpm}</b><span>BPM · ${esc(label)}</span></div>
          <button class="kbtn" data-d="1">+1</button><button class="kbtn" data-d="5">+5</button>
        </div>
        <input type="range" min="30" max="${Math.max(240, (ex.goalBpm || 0) + 40)}" value="${S.bpm}" data-r="range" aria-label="Tempo">
      </div>
    </div>
    <div class="tp-meter" data-r="meter"></div>
    ${S.ramp ? `<div class="ramp-row">${toggle('rampOn', 'Tempo ladder', S.ramp.enabled)}<span class="small muted" data-r="ramptxt"></span></div>` : ''}
    <div class="toggles" ${evalMode ? 'hidden' : ''}>
      ${toggle('sound', 'Guitar sound', S.sound)}${toggle('click', 'Click', S.click)}${toggle('loop', 'Loop', S.loop)}${toggle('countIn', 'Count-in', S.countIn)}
      ${toggle('scroll', 'Scrolling tab', S.scroll)}${toggle('picks', 'Pick direction', S.picks)}${toggle('neck', 'Fretboard', S.neck)}
      ${clickSoundSelectHTML('tp-sound')}
    </div>
    <div class="pickrow" data-r="pickrow" ${evalMode || !S.picks ? 'hidden' : ''}>
      <label class="mini">Picking<select data-r="pickmode">${PICK_MODES.map(([k, l]) => `<option value="${k}" ${S.pickMode === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="pickkey small muted"><span><svg viewBox="-7 -7 14 14" width="14" height="14"><path class="tab-pick" d="M-5 5V-4H5V5"/></svg> down</span><span><svg viewBox="-7 -7 14 14" width="14" height="14"><path class="tab-pick" d="M-5 -5L0 5L5 -5"/></svg> up</span><span data-r="pickhint"></span></div>
    </div>
  </div>`;
  const r = n => el.querySelector(`[data-r="${n}"]`);
  function toggle(k, lbl, on) { return `<button class="tgl ${on ? 'on' : ''}" data-tg="${k}" aria-pressed="${on}">${lbl}</button>`; }
  function setToggle(k, on) { const b = el.querySelector(`[data-tg="${k}"]`); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); } if (docked) docked.sync(); }

  /* ------------------------------ Rendering ------------------------------ */
  let systems = [];   // {el, svg, start, end, head, selrect, w}
  let noteEls = [], pickEls = [];
  let lastAct = null, lastChord = -2;
  const xOf = (sys, beat) => PAD + (beat - sys.start) * pxBeat + NOTE_DX;

  function render() {
    const view = r('view'), track = r('track');
    track.innerHTML = ''; systems = [];
    view.className = 'tp-view ' + (S.scroll ? 'scroll' : 'static') + (S.picks ? ' picks' : '') + (evalMode ? '' : ' seekable');
    const TOP = S.picks ? TOP_PICKS : TOP_PLAIN;
    const picks = S.picks ? computePicks(notes, S.pickMode) : null;
    const PICK_Y = TOP - 31;
    const width = view.clientWidth || 340;
    const barPx = pxBeat * beatsPerBar;
    const barsPerLine = S.scroll ? total / beatsPerBar : Math.max(1, Math.floor((width - PAD - 20) / barPx));
    const beatsPerLine = barsPerLine * beatsPerBar;
    for (let start = 0; start < total; start += beatsPerLine) {
      const end = Math.min(total, start + beatsPerLine);
      const w = PAD + (end - start) * pxBeat + 10, h = TOP + ROW * 5 + BOTTOM;
      let s = `<svg class="tabsvg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tab">`;
      s += `<rect class="tab-selrect" x="0" y="${TOP - 13}" width="0" height="${ROW * 5 + 22}" rx="6" style="display:none"/>`;
      names.forEach((name, i) => {
        const y = TOP + i * ROW;
        s += `<text x="6" y="${y + 4}" class="tab-sname">${name}</text><line x1="${PAD - 6}" y1="${y}" x2="${w - 6}" y2="${y}" class="tab-line"/>`;
      });
      for (let b = start; b <= end; b += beatsPerBar) { const x = PAD + (b - start) * pxBeat - 6; s += `<line x1="${x}" y1="${TOP}" x2="${x}" y2="${TOP + ROW * 5}" class="tab-bar"/>`; if (b < end) s += `<text x="${x + 3}" y="${TOP - (S.picks ? 36 : 16)}" class="tab-barno">${b / beatsPerBar + 1}</text>`; }
      for (let b = start; b < end; b++) s += `<text x="${PAD + (b - start) * pxBeat - 2}" y="${h - 1}" class="tab-count">${(b % beatsPerBar) + 1}</text>`;
      notes.forEach((n, i) => {
        if (n.t < start - EPS || n.t >= end - EPS) return;
        const x = PAD + (n.t - start) * pxBeat + NOTE_DX, y = TOP + (n.s - 1) * ROW, lab = n.x === 'ghost' ? `(${n.f})` : n.x === 'mute' ? 'x' : n.x === 'nh' ? `<${n.f}>` : String(n.f), wBox = 7 * lab.length + 6;
        s += `<g class="tab-note" data-i="${i}"><rect x="${x - wBox / 2}" y="${y - 9}" width="${wBox}" height="18" rx="4"/><text x="${x}" y="${y + 5}">${lab}</text></g>`;
        const tl = [n.x && n.x !== 'ghost' && n.x !== 'mute' && !n.chord ? techLabel(n) : '', barLabel(n)].filter(Boolean).join(' ');
        if (tl) s += `<text x="${x}" y="${TOP - 12}" class="tab-tech${n.bar ? ' bar' : ''}">${esc(tl)}</text>`;
        if (picks && picks[i].lead) {
          // Fingers for every note struck together (bass first), the stroke on the group's lowest string
          const fingers = notes.map((m, j) => ({ m, j })).filter(o => Math.abs(o.m.t - n.t) < 1e-3 && picks[o.j].finger).sort((a, b) => b.m.s - a.m.s).map(o => picks[o.j].finger);
          const st = picks[i].stroke, both = st && fingers.length;
          if (st) s += strokeSVG(st, both ? x - 8 : x, PICK_Y, i).replace('class="tab-pick"', `class="tab-pick" data-pi="${i}"`);
          if (fingers.length) s += `<text x="${both ? x + 7 : x}" y="${PICK_Y + 4}" class="tab-finger" data-pi="${i}">${fingers.join('')}</text>`;
        }
      });
      s += `<line class="tab-head" x1="0" y1="${TOP - 16}" x2="0" y2="${TOP + ROW * 5 + 6}" style="display:none"/></svg>`;
      const wrap = document.createElement('div'); wrap.className = 'tab-sys'; wrap.innerHTML = s;
      track.appendChild(wrap);
      systems.push({ el: wrap, svg: wrap.firstChild, start, end, w, head: wrap.querySelector('.tab-head'), selrect: wrap.querySelector('.tab-selrect') });
    }
    noteEls = notes.map((_, i) => el.querySelector(`.tab-note[data-i="${i}"]`));
    pickEls = notes.map((_, i) => [...el.querySelectorAll(`[data-pi="${i}"]`)]);
    drawRuler();
    lastAct = null;
    drawSelection();
    paint();
    if (S.scroll) follow(true);
  }

  function drawRuler() {
    const bars = Math.round(total / beatsPerBar), every = bars > 32 ? 4 : bars > 16 ? 2 : 1;
    let h = '';
    for (let k = 0; k < bars; k++) h += `<span class="tp-rbar ${k % every ? 'minor' : ''}" style="left:${(k * beatsPerBar / total) * 100}%">${k % every ? '' : k + 1}</span>`;
    r('rbars').innerHTML = h;
  }

  /* ------------------------------ The neck ------------------------------- */
  let neckMarks = new Map(); // "s:f" → element
  function renderNeck() {
    const host = r('neck'); if (!host) return;
    host.hidden = !S.neck;
    if (!S.neck) { host.innerHTML = ''; neckMarks = new Map(); return; }
    const seen = new Map();
    notes.forEach(n => { if (n.x === 'mute') return; const k = `${n.s}:${n.f}`; if (!seen.has(k)) seen.set(k, { s: n.s, f: n.f, label: noteName(noteMidi(n, tuning)), family: 'root', cls: 'tpm' }); });
    const maxF = Math.max(0, ...notes.map(n => n.f));
    const maxFret = clamp(Math.max(15, maxF + 1), 15, 24);
    host.innerHTML = fretboardSVG({ marks: [...seen.values()], maxFret, interactive: true, fw: 42, cls: 'tpboard', names });
    neckMarks = new Map([...host.querySelectorAll('.fb-mark')].map(m => [`${m.dataset.ms}:${m.dataset.mf}`, m]));
    lastAct = null;
    drawSelection();
    paint();
  }
  function neckFollow(keys) {
    const host = r('neck'); if (!host || !keys.length || host.scrollWidth <= host.clientWidth + 2) return;
    const m = neckMarks.get(keys[0]); if (!m || !m.getBoundingClientRect) return;
    const hr = host.getBoundingClientRect(), mr = m.getBoundingClientRect();
    if (mr.left < hr.left + 24 || mr.right > hr.right - 24) {
      const left = host.scrollLeft + (mr.left - hr.left) - hr.width * 0.4;
      try { host.scrollTo({ left, behavior: 'smooth' }); } catch { host.scrollLeft = left; }
    }
  }

  /* ------------------------------ Playback ------------------------------- */
  const spb = () => 60 / S.bpm;
  const elapsed = () => (Audio.now() - S.t0) / spb();
  const regionStart = () => (S.sel ? sw(S.sel.a) : 0);
  function computeRegion() {
    if (S.sel && !evalMode) { S.A = sw(S.sel.a); S.B = S.sel.b >= total - EPS ? total : sw(S.sel.b); }
    else { S.A = 0; S.B = total; }
    if (S.B - S.A < EPS) { S.A = 0; S.B = total; }
  }
  /** Position (real-time beats) after e beats of this run. */
  function posAt(e) {
    const len0 = S.B - S.P;
    if (e < len0) return { pos: S.P + e, pass: 0 };
    if (!S.loop) return { pos: S.B, pass: 0, ended: true };
    const L = S.B - S.A, k = Math.floor((e - len0) / L);
    return { pos: S.A + (e - len0 - k * L), pass: k + 1 };
  }
  const passStart = k => (k === 0 ? 0 : (S.B - S.P) + (k - 1) * (S.B - S.A));
  const countLead = P => P - (Math.ceil(P - EPS) - beatsPerBar);

  function rampText() {
    const R = S.ramp, t = r('ramptxt'); if (!R || !t) return;
    t.textContent = rampLine();
    if (docked) docked.sync();
  }
  function rampLine() { const R = S.ramp; return !R ? '' : R.enabled ? `Tempo ladder: +${R.step} BPM every ${R.everyLoops} loop${R.everyLoops > 1 ? 's' : ''}, up to ${R.max}` : 'Tempo ladder off: holding this tempo'; }
  function playBtn() {
    const p = r('play'); if (!p) return;
    if (S.playing) { p.textContent = '❚❚ Pause'; p.className = 'btn tp-play pause'; }
    else { p.textContent = S.pos > regionStart() + EPS ? '▶ Resume' : '▶ Play'; p.className = 'btn primary tp-play'; }
    if (docked) docked.sync();
  }
  /** Start the clock at a position (real-time beats), with or without a count-in. */
  function startRun(realPos, withCountIn) {
    const c = Audio.get(); if (!c) return false;
    computeRegion();
    if (realPos < S.A - EPS || realPos >= S.B - EPS) realPos = S.A;
    S.P = realPos; S.countRun = !!withCountIn; S.passes = 0;
    const lead = withCountIn ? countLead(realPos) : 0;
    S.t0 = c.currentTime + 0.1 + lead * spb();
    S.schedE = -lead - EPS;
    lastAct = null;
    return true;
  }
  function play() {
    if (S.playing) return;
    if (!Audio.get()) { toast('Audio is not supported here.'); return; }
    if (evalMode) { S.sel = null; S.pos = 0; }
    if (!startRun(S.pos, S.countIn)) return;
    S.playing = true; S.peakBpm = S.bpm;
    clearInterval(S.sched); S.sched = setInterval(schedule, 25); schedule();
    cancelAnimationFrame(S.raf); S.raf = requestAnimationFrame(frame);
    playBtn();
  }
  function pause() {
    if (!S.playing) return;
    const e = elapsed();
    const at = e < 0 ? S.P : posAt(e);
    S.pos = e < 0 ? S.P : at.ended || at.pos >= total - EPS ? regionStart() : at.pos;
    S.playing = false; clearInterval(S.sched); cancelAnimationFrame(S.raf);
    S.seeked = S.pos > EPS;
    lastAct = null; playBtn(); paint();
  }
  function stop() { pause(); S.pos = regionStart(); S.seeked = false; lastAct = null; playBtn(); paint(); }
  function restart() {
    S.pos = regionStart(); S.seeked = !!S.sel;
    if (S.playing) startRun(S.pos, false);
    lastAct = null; playBtn(); paint(); follow(true);
  }
  /** Keep playing from the current spot after the loop region or loop setting changes. */
  function rebase() {
    if (!S.playing) { computeRegion(); return; }
    const e = elapsed();
    if (e < 0) { computeRegion(); if (S.P < S.A - EPS || S.P >= S.B - EPS) startRun(S.A, S.countRun); return; }
    const pos = posAt(e).pos;
    computeRegion();
    if (pos >= S.A - EPS && pos < S.B - EPS) {
      S.P = pos; S.t0 += e * spb(); S.schedE -= e; S.passes = 0; S.countRun = false;
    } else startRun(S.A, false);
  }

  function playNote(n, t) {
    const c = Audio.ctx;
    if (!S.sound || t < c.currentTime - 0.01) return;
    const spread = n.chord ? 0.012 * (6 - n.s) : 0;
    if (n.x === 'mute') Audio.guitar(noteMidi(n, tuning), t + spread, { dur: 0.05, gain: n.chord ? 0.2 : 0.35, bright: 0.2 });
    else if (n.x === 'nh' || n.x === 'ah') {
      const dur = Math.max(n.bar === 'dive' ? 1 : 0.4, n.d * spb() * 2);
      const src = Audio.guitar(soundMidi(n, tuning), t + spread, { dur, gain: n.chord ? 0.22 : 0.4, bright: 0.85 });
      const moves = pitchMoves(n, Math.min(dur, n.d * spb() * 1.5));
      if (src && moves.length) Audio.glide(src, moves.map(([dt, c]) => [t + spread + dt, c]));
    }
    else {
      const dur = Math.max(n.bar === 'dive' ? 0.8 : 0.25, n.d * spb() * 1.6);
      const midi = n.x === 'r' && n.bendTo != null ? noteMidi(n, tuning) : soundMidi(n, tuning);
      const src = Audio.guitar(midi, t + spread, { dur, gain: n.chord ? 0.32 : 0.55, bright: n.x === 'pm' ? 0.3 : 0.55 });
      const moves = pitchMoves(n, Math.min(dur, n.d * spb()));
      if (src && moves.length) Audio.glide(src, moves.map(([dt, c]) => [t + spread + dt, c]));
    }
  }
  /** Schedule every note and click whose time (in beats since the run started) is in [e0, e1). */
  function scheduleWindow(e0, e1) {
    const sp = spb(), inWin = e => e >= e0 - 1e-9 && e < e1 - 1e-9;
    if (S.countRun && e0 < 0) {
      const last = Math.ceil(S.P - EPS), first = last - beatsPerBar;
      for (let x = first; x < last; x++) { const e = x - S.P; if (inWin(e)) Audio.click(S.t0 + e * sp, x === first, 0.8); }
    }
    if (e1 <= 0) return;
    const len0 = S.B - S.P, L = S.B - S.A;
    let k = e0 < len0 ? 0 : (S.loop && L > EPS ? 1 + Math.floor((Math.max(0, e0) - len0) / L) : null);
    if (k == null) return;
    for (; k < 100000; k++) {
      if (k > 0 && (!S.loop || L <= EPS)) break;
      const Es = passStart(k); if (Es >= e1) break;
      const P0 = k === 0 ? S.P : S.A;
      for (const n of notes) { const st = sw(n.t); if (st < P0 - EPS || st >= S.B - EPS) continue; const e = Es + st - P0; if (inWin(e)) playNote(n, S.t0 + e * sp); }
      if (S.click) for (let x = Math.ceil(P0 - EPS); x < S.B - EPS; x++) { const e = Es + x - P0; if (inWin(e)) Audio.click(S.t0 + e * sp, ((x % beatsPerBar) + beatsPerBar) % beatsPerBar === 0, 0.8); }
    }
  }
  function schedule() {
    const c = Audio.ctx; if (!c || !S.playing) return;
    let H = (c.currentTime + 0.15 - S.t0) / spb();
    // Tempo ladder: step the tempo at loop boundaries, keeping the boundary on time
    if (S.ramp && S.loop) {
      for (let guard = 0; guard < 64; guard++) {
        const k = S.passes + 1, Eb = passStart(k);
        if (Eb > H) break;
        if (Eb > S.schedE) { scheduleWindow(S.schedE, Eb); S.schedE = Eb; }
        S.passes = k;
        const R = S.ramp;
        if (R.enabled && k % R.everyLoops === 0 && S.bpm < R.max) {
          const T = S.t0 + Eb * spb();
          S.bpm = Math.min(R.max, S.bpm + R.step);
          S.t0 = T - Eb * spb();
          S.peakBpm = Math.max(S.peakBpm, S.bpm);
          const v = S.bpm;
          setTimeout(() => { if (!el.isConnected) return; showBpm(v); if (onBpm) onBpm(v); }, Math.max(0, (T - c.currentTime) * 1000));
          H = (c.currentTime + 0.15 - S.t0) / spb();
        }
      }
    }
    if (H > S.schedE) { scheduleWindow(S.schedE, H); S.schedE = H; }
    if (!S.loop && elapsed() > (S.B - S.P) + 0.25) { S.pos = regionStart(); S.playing = false; clearInterval(S.sched); cancelAnimationFrame(S.raf); S.seeked = false; lastAct = null; playBtn(); paint(); finished(); }
  }
  function frame() {
    if (!S.playing) return;
    paint();
    S.raf = requestAnimationFrame(frame);
  }

  /** Where the playhead is now: {real, count (beats of count-in left), pass}. */
  function now() {
    if (!S.playing) return { real: S.pos, count: 0, pass: 0 };
    const e = elapsed();
    if (e < 0) return { real: S.P, count: Math.ceil(-e - EPS), pass: 0 };
    const at = posAt(e);
    return { real: Math.min(at.pos, total - EPS), count: 0, pass: at.pass };
  }
  function paint() {
    if (!systems.length) return;
    const { real, count, pass } = now();
    const nb = unsw(real);
    const pct = clamp(real / total * 100, 0, 100);
    r('prog').style.width = pct + '%';
    r('rhead').style.left = pct + '%';
    const showHead = S.playing || S.seeked || S.pos > EPS;
    systems.forEach(sys => {
      const active = nb >= sys.start - EPS && (nb < sys.end - EPS || (sys.end >= total && nb <= total));
      const vis = active && showHead;
      sys.head.style.display = vis ? '' : 'none';
      if (vis) { const x = xOf(sys, nb); sys.head.setAttribute('x1', x); sys.head.setAttribute('x2', x); }
      sys.el.classList.toggle('active', active && (S.playing || S.seeked));
    });
    if (S.playing && S.scroll) follow(false);
    // notes sounding now (or, when paused on a spot, the notes at the playhead)
    const act = [];
    if (S.playing && !count) notes.forEach((n, i) => { const st = sw(n.t); if (real >= st - EPS && real < st + Math.max(n.d, 0.2)) act.push(i); });
    else if (!S.playing && S.seeked) notes.forEach((n, i) => { if (Math.abs(sw(n.t) - real) < 1e-3) act.push(i); });
    const key = act.join(',');
    if (key !== lastAct) {
      noteEls.forEach((g, i) => { if (g) g.classList.toggle('on', act.includes(i)); });
      pickEls.forEach((list, i) => { const on = act.includes(i); list.forEach(x => x.classList.toggle('on', on)); });
      const keys = [...new Set(act.filter(i => notes[i].x !== 'mute').map(i => `${notes[i].s}:${notes[i].f}`))];
      neckMarks.forEach((m, k) => m.classList.toggle('on', keys.includes(k)));
      if (keys.length && lastAct !== null) neckFollow(keys);
      lastAct = key;
    }
    // chord box
    const ci = timelineReal && ((S.playing && !count) || (!S.playing && S.seeked)) ? chordAt(timelineReal, real) : -1;
    if (ci !== lastChord) { highlightChord(findDiagrams(el), ci); lastChord = ci; }
    const m = r('meter');
    if (m) m.textContent = meterText(count, pass, nb);
  }
  function meterText(count, pass, nb) {
    if (S.playing && count) return `Count-in: ${count}`;
    if (S.playing) return `${S.loop ? `Loop ${pass + 1} · ` : ''}${fmtPos(nb)}${S.sel ? ' · looping your selection' : ''}`;
    return S.seeked ? `Playhead at ${fmtPos(nb)}` : (S.sel ? 'Loop selected' : '');
  }
  /** Scroll the long tab so the playhead sits about a third of the way in. */
  function follow(force) {
    if (!S.scroll || !systems.length) return;
    if (!force && performance.now() < S.followUntil) return;
    const view = r('view'), sys = systems[0];
    const { real } = now();
    const x = sys.el.offsetLeft + 6 + xOf(sys, unsw(real));
    const target = Math.max(0, x - (view.clientWidth || 340) * 0.3);
    if (Math.abs(view.scrollLeft - target) > 0.5) view.scrollLeft = target;
  }
  function fmtPos(beat) {
    const b = Math.max(0, beat), bar = Math.floor(b / beatsPerBar + EPS) + 1, inBar = b - (bar - 1) * beatsPerBar;
    const whole = Math.floor(inBar + EPS), fr = inBar - whole;
    const suf = fr < 0.03 ? '' : Math.abs(fr - 0.5) < 0.03 ? ' &' : Math.abs(fr - 0.25) < 0.03 ? ' e' : Math.abs(fr - 0.75) < 0.03 ? ' a' : '+';
    return `bar ${bar}, beat ${whole + 1}${suf}`;
  }
  function finished() { if (onLog) toast(`Run finished at ${S.bpm} BPM. Tap “Log this tempo” to record it.`); }

  function showBpm(v) {
    r('bpm').textContent = v; r('range').value = v;
    r('bpm').classList.toggle('goal-hit', !!ex.goalBpm && v >= ex.goalBpm);
    if (docked) docked.sync();
  }
  function setBpm(v) {
    const was = S.playing ? elapsed() : null;
    S.bpm = clamp(Math.round(v), 30, 300);
    if (was != null && Audio.ctx) S.t0 = Audio.ctx.currentTime - was * spb();
    showBpm(S.bpm);
    if (onBpm) onBpm(S.bpm);
  }

  /* ---------------------------- Seek and select --------------------------- */
  function snapBeat(b) {
    let best = 0, bd = Infinity;
    for (const t of onsets) { const d = Math.abs(t - b); if (d < bd) { bd = d; best = t; } }
    const gi = clamp(Math.round(b), 0, total - 1);
    if (Math.abs(gi - b) < bd - 0.05) best = gi;
    return clamp(best, 0, total - EPS);
  }
  /** Move the playhead to a written beat. */
  function seekTo(beat, snap = true) {
    const p = snap ? snapBeat(beat) : clamp(beat, 0, total - EPS);
    if (S.sel && (p < S.sel.a - EPS || p >= S.sel.b - EPS)) clearSelection();
    S.pos = sw(p); S.seeked = true;
    if (S.playing) startRun(S.pos, false);
    lastAct = null; playBtn(); paint();
  }
  /** The notes between two written beats, as a loop region {a, b} (b = the next note after the last one). */
  function selFromBeats(b0, b1) {
    const tol = 9 / pxBeat, lo = Math.min(b0, b1), hi = Math.max(b0, b1);
    const inside = onsets.filter(t => t >= lo - tol && t <= hi + tol);
    if (!inside.length) return null;
    const a = inside[0], last = inside[inside.length - 1];
    const next = onsets.find(t => t > last + EPS);
    return { a, b: next != null ? next : total };
  }
  function drawSelection(sel = S.sel) {
    systems.forEach(sys => {
      const on = sel && sel.a < sys.end - EPS && sel.b > sys.start + EPS;
      sys.selrect.style.display = on ? '' : 'none';
      if (on) {
        const x0 = sel.a <= sys.start + EPS ? PAD - 8 : xOf(sys, sel.a) - 10;
        const x1 = sel.b >= sys.end - EPS ? sys.w - 4 : xOf(sys, sel.b) - 10;
        sys.selrect.setAttribute('x', x0); sys.selrect.setAttribute('width', Math.max(4, x1 - x0));
      }
    });
    notes.forEach((n, i) => { const g = noteEls[i]; if (g) g.classList.toggle('insel', !!sel && n.t >= sel.a - EPS && n.t < sel.b - EPS); });
    const rs = r('rsel');
    rs.hidden = !sel;
    if (sel) { rs.style.left = (sel.a / total * 100) + '%'; rs.style.width = ((sel.b - sel.a) / total * 100) + '%'; }
    // the neck: positions outside the selection fade out
    const used = sel ? new Set(notes.filter(n => n.t >= sel.a - EPS && n.t < sel.b - EPS).map(n => `${n.s}:${n.f}`)) : null;
    neckMarks.forEach((m, k) => m.classList.toggle('out', !!used && !used.has(k)));
    const bar = r('selbar');
    if (bar) {
      const committed = sel && S.sel && sel.a === S.sel.a && sel.b === S.sel.b;
      bar.hidden = !committed;
      if (committed) {
        const inSel = notes.filter(n => n.t >= sel.a - EPS && n.t < sel.b - EPS);
        const lastOn = Math.max(...inSel.map(n => n.t));
        r('seltxt').innerHTML = `<b>Loop:</b> ${fmtPos(sel.a)} → ${fmtPos(lastOn)} <span class="muted">· ${inSel.length} note${inSel.length === 1 ? '' : 's'}</span>`;
      }
    }
  }
  function select(b0, b1) {
    const sel = selFromBeats(b0, b1);
    if (!sel) return false;
    S.sel = sel;
    if (!S.loop) { S.loop = true; setToggle('loop', true); }
    S.pos = sw(sel.a); S.seeked = true;
    drawSelection();
    if (S.playing) startRun(S.pos, false);
    lastAct = null; playBtn(); paint();
    return true;
  }
  function clearSelection() {
    if (!S.sel) return;
    S.sel = null; drawSelection(); rebase(); playBtn(); paint();
  }

  /** Written beat under a point on the tab (nearest line when `near` is set). */
  function beatAtPoint(cx, cy, near = false) {
    let best = null, bd = Infinity;
    for (const sys of systems) {
      const rc = sys.svg.getBoundingClientRect();
      const dy = cy < rc.top ? rc.top - cy : cy > rc.bottom ? cy - rc.bottom : 0;
      if (dy === 0 || (near && dy < bd)) { bd = dy; best = { sys, rc }; if (dy === 0) break; }
    }
    if (!best) return null;
    const x = cx - best.rc.left;
    return clamp(best.sys.start + (x - PAD - NOTE_DX) / pxBeat, best.sys.start, best.sys.end - EPS);
  }
  function beatOnRuler(cx) {
    const rc = r('ruler').getBoundingClientRect();
    return rc.width ? clamp((cx - rc.left) / rc.width * total, 0, total - EPS) : 0;
  }

  let drag = null;
  function onDown(e, where) {
    if (evalMode || (e.button != null && e.button > 0)) return;
    const b0 = where === 'ruler' ? beatOnRuler(e.clientX) : beatAtPoint(e.clientX, e.clientY);
    if (b0 == null) return;
    drag = { where, id: e.pointerId, x0: e.clientX, y0: e.clientY, b0, type: e.pointerType || 'mouse', moved: false, sel: false };
    // a touch on the tab scrolls it; a touch on the bar strip (and any mouse drag) selects
    if (where === 'ruler' || drag.type !== 'touch') { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } if (e.cancelable) e.preventDefault(); }
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) { drag.moved = true; drag.sel = drag.where === 'ruler' || drag.type !== 'touch'; }
    if (drag.sel) {
      const b = drag.where === 'ruler' ? beatOnRuler(e.clientX) : beatAtPoint(e.clientX, e.clientY, true);
      if (b != null) { drag.b1 = b; drawSelection(selFromBeats(drag.b0, b)); }
    }
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.sel) { if (!select(d.b0, d.b1 != null ? d.b1 : d.b0)) drawSelection(); }
    else if (!d.moved) seekTo(d.b0, true);
  }
  function onCancel() { if (drag) { drag = null; drawSelection(); } }
  const view = r('view'), ruler = r('ruler');
  if (!evalMode) {
    view.addEventListener('pointerdown', e => onDown(e, 'tab'));
    ruler.addEventListener('pointerdown', e => onDown(e, 'ruler'));
    [view, ruler].forEach(t => { t.addEventListener('pointermove', onMove); t.addEventListener('pointerup', onUp); t.addEventListener('pointercancel', onCancel); });
    // scrolling the tab by hand pauses the auto-follow for a moment
    const hold = () => { S.followUntil = performance.now() + 2500; };
    // a mouse wheel scrolls the long tab sideways (until it reaches an end, then the page scrolls)
    view.addEventListener('wheel', e => {
      hold();
      if (!S.scroll || view.scrollWidth <= view.clientWidth + 1 || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const next = clamp(view.scrollLeft + e.deltaY, 0, view.scrollWidth - view.clientWidth);
      if (Math.abs(next - view.scrollLeft) < 1) return;
      view.scrollLeft = next;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    view.addEventListener('touchstart', hold, { passive: true });
  }

  /* ------------------------------- Events -------------------------------- */
  el.addEventListener('click', e => {
    const hit = e.target.closest('.fb-hit');
    if (hit && el.contains(hit)) {
      const s = +hit.dataset.s, f = +hit.dataset.f, c = Audio.get();
      if (c) Audio.guitar(tuning[s - 1] + f, c.currentTime + 0.01, { dur: 1.2, gain: 0.6 });
      const m = neckMarks.get(`${s}:${f}`); if (m) { m.classList.add('tap'); setTimeout(() => m.classList.remove('tap'), 350); }
      return;
    }
    const b = e.target.closest('button'); if (!b || !el.contains(b)) return;
    if (b.dataset.d) setBpm(S.bpm + Number(b.dataset.d));
    else if (b.dataset.r === 'play') S.playing ? pause() : play();
    else if (b.dataset.r === 'restart') restart();
    else if (b.dataset.r === 'clearsel') clearSelection();
    else if (b.dataset.r === 'log') { onLog({ exerciseId: ex.id, name: ex.name, tempo: S.bpm, goalBpm: ex.goalBpm || null }); }
    else if (b.dataset.tg) flip(b.dataset.tg);
  });
  function flip(k) {
    if (k === 'rampOn') { if (S.ramp) { S.ramp.enabled = !S.ramp.enabled; setToggle('rampOn', S.ramp.enabled); rampText(); } return; }
    S[k] = !S[k];
    setToggle(k, S[k]);
    if (k === 'sound') onSettings({ tabAudio: S.sound });
    if (k === 'scroll') { onSettings({ tabScroll: S.scroll }); render(); }
    if (k === 'picks') { onSettings({ tabPicks: S.picks }); r('pickrow').hidden = !S.picks; render(); }
    if (k === 'neck') { onSettings({ tabNeck: S.neck }); renderNeck(); }
    if (k === 'loop') rebase(); // switching the loop off finishes the current pass
  }
  r('range').addEventListener('input', e => setBpm(+e.target.value));
  function setPickMode(m) {
    S.pickMode = m; const sel = r('pickmode'); if (sel) sel.value = m;
    onSettings({ pickModes: Object.assign({}, settings.pickModes || {}, { [pickKey]: S.pickMode }) });
    pickHint(); render();
  }
  r('pickmode').addEventListener('change', e => setPickMode(e.target.value));
  const hasWritten = notes.some(n => n.pick || n.fing);
  function pickHint() { const m = PICK_MODES.find(x => x[0] === S.pickMode); r('pickhint').textContent = (m ? m[2] : '') + (hasWritten ? ' Strokes and fingers marked by the lesson are shown as written.' : ''); }
  pickHint();
  let lastW = 0;
  const ro = window.ResizeObserver ? new ResizeObserver(() => { const w = r('view').clientWidth; if (!S.scroll && Math.abs(w - lastW) > 8) { lastW = w; render(); } }) : null;
  if (ro) ro.observe(r('view'));
  // The playback bar (declared before the first render so the hooks above can call it)
  docked = dock && !evalMode ? Transport.attach({
    el: el.querySelector('.tabplayer'), name: ex.name, unit: label, goal: ex.goalBpm || null,
    min: 30, max: Math.max(240, (ex.goalBpm || 0) + 40),
    isPlaying: () => S.playing, toggle: () => (S.playing ? pause() : play()), restart: () => restart(),
    getBpm: () => S.bpm, setBpm: v => setBpm(v), flip: k => flip(k),
    toggles: () => [{ k: 'click', label: 'Click', on: S.click }, { k: 'loop', label: 'Loop', on: S.loop }, { k: 'countIn', label: 'Count-in', on: S.countIn }, { k: 'sound', label: 'Guitar sound', on: S.sound }, ...(S.ramp ? [{ k: 'rampOn', label: 'Tempo ladder', on: S.ramp.enabled }] : [])],
    rampText: S.ramp ? rampLine : null,
    status: () => { const { real, count, pass } = now(); return { pct: clamp(real / total * 100, 0, 100), text: meterText(count, pass, unsw(real)) }; }
  }) : null;
  render();
  renderNeck();
  setBpm(S.bpm);
  rampText();
  playBtn();

  const cleanup = () => { pause(); if (ro) ro.disconnect(); highlightChord(findDiagrams(el), null); if (docked) { docked.detach(); docked = null; } };
  cleanup.getBpm = () => S.bpm;
  cleanup.flip = k => flip(k);
  cleanup.display = () => ({ scroll: S.scroll, picks: S.picks, neck: S.neck, pickMode: S.pickMode });
  cleanup.setPickMode = m => setPickMode(m);
  cleanup.setTheme = t => { const tp = el.querySelector('.tabplayer'); if (tp) tp.classList.toggle('tp-light', t === 'light'); };
  cleanup.relayout = () => { if (!S.scroll) render(); else follow(true); };
  cleanup.getPeakBpm = () => Math.max(S.peakBpm, S.bpm);
  cleanup.stop = stop;
  cleanup.pause = pause;
  cleanup.play = () => { if (!S.playing) play(); };
  cleanup.restart = restart;
  cleanup.isPlaying = () => S.playing;
  cleanup.set = (k, v) => { S[k] = v; if (k === 'loop') rebase(); };
  cleanup.seek = (beat, snap = true) => seekTo(beat, snap);
  cleanup.select = (a, b) => select(a, b);
  cleanup.clearSelection = clearSelection;
  cleanup.state = () => ({ playing: S.playing, pos: S.pos, sel: S.sel ? { ...S.sel } : null, loop: S.loop, region: [S.A, S.B], bpm: S.bpm, chord: lastChord });
  cleanup.picks = () => (S.picks ? { mode: S.pickMode, strokes: computePicks(notes, S.pickMode) } : null);
  /** Timing info for the evaluator: beat 0 of loop 1 happens at t0 (audio-context seconds). */
  cleanup.timing = () => ({ t0: S.t0, bpm: S.bpm, totalBeats: total, notes, swing: !!ex.swing, beatsPerBar, playing: S.playing, tuning });
  return cleanup;
}
