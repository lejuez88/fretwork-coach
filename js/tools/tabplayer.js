// Tab player: renders structured tab as SVG, scrolls it at tempo (or keeps it
// stationary with a moving playhead), plays it with the Karplus-Strong guitar
// voice (toggleable) and an optional click, loops, counts in, and logs the
// tempo a run finished at.
import { Audio } from '../core/audio.js';
import { esc, clamp, toast } from '../core/util.js';
import { noteMidi, exerciseBeats } from './exercises.js';

const ROW = 18, TOP = 26, BOTTOM = 12, PAD = 28;

export function mountTabPlayer(el, ex, { settings = {}, onSettings = () => {}, onLog = null, beatsPerBar = 4, startBpm = null, compact = false, onBpm = null } = {}) {
  const state = {
    bpm: startBpm || ex.bpm || 80, sound: settings.tabAudio !== false, scroll: settings.tabScroll !== false,
    click: true, loop: true, countIn: true, playing: false, t0: 0, nextIdx: 0, loopN: 0, raf: null, sched: null, clickBeat: 0
  };
  const total = exerciseBeats(ex, beatsPerBar);
  const minStep = Math.min(...ex.notes.map(n => n.d).filter(Boolean), 1);
  const pxBeat = clamp(Math.round(24 / minStep), 48, 100);
  const swungT = t => (ex.swing ? Math.floor(t) + (((t % 1) + 1) % 1 === 0.5 ? 2 / 3 : t % 1) : t);
  const notes = [...ex.notes].sort((a, b) => a.t - b.t);

  el.innerHTML = `
  <div class="tabplayer">
    ${compact ? '' : `<div class="tp-head">
      <div><div class="label">${esc(ex.unit || '')}${ex.swing ? ' · swing' : ''}</div><h3>${esc(ex.name)}</h3></div>
      <div class="tp-goal"><span>Goal</span><b>${ex.goalBpm || '—'}</b><span>BPM</span></div>
    </div>
    ${ex.why ? `<p class="why">${esc(ex.why)}</p>` : ''}`}
    <div class="tp-view ${state.scroll ? 'scroll' : 'static'}" data-r="view"><div class="tp-track" data-r="track"></div><div class="tp-fixedhead" data-r="fixedhead"></div></div>
    <div class="tp-progress"><i data-r="prog"></i></div>
    <div class="bpmrow tp-tempo">
      <button class="kbtn" data-d="-5">−5</button><button class="kbtn" data-d="-1">−1</button>
      <div class="bpm"><b data-r="bpm">${state.bpm}</b><span>BPM</span></div>
      <button class="kbtn" data-d="1">+1</button><button class="kbtn" data-d="5">+5</button>
    </div>
    <input type="range" min="30" max="${Math.max(240, (ex.goalBpm || 0) + 40)}" value="${state.bpm}" data-r="range" aria-label="Tempo">
    <div class="tp-meter" data-r="meter"></div>
    <div class="row"><button class="btn primary" data-r="play">▶ Play</button>${onLog ? '<button class="btn" data-r="log">Log this tempo</button>' : ''}</div>
    <div class="toggles">
      ${toggle('sound', 'Guitar sound', state.sound)}${toggle('click', 'Click', state.click)}
      ${toggle('scroll', 'Scrolling tab', state.scroll)}${toggle('loop', 'Loop', state.loop)}${toggle('countIn', 'Count-in', state.countIn)}
    </div>
  </div>`;
  const r = n => el.querySelector(`[data-r="${n}"]`);

  /* ------------------------------ Rendering ------------------------------ */
  let systems = []; // {svg, startBeat, endBeat, head}
  function render() {
    const view = r('view'), track = r('track');
    track.innerHTML = ''; r('fixedhead').innerHTML = ''; systems = [];
    view.className = 'tp-view ' + (state.scroll ? 'scroll' : 'static');
    const width = view.clientWidth || 340;
    const barPx = pxBeat * beatsPerBar;
    const barsPerLine = state.scroll ? total / beatsPerBar : Math.max(1, Math.floor((width - PAD - 8) / barPx));
    const beatsPerLine = barsPerLine * beatsPerBar;
    for (let start = 0; start < total; start += beatsPerLine) {
      const end = Math.min(total, start + beatsPerLine);
      const w = PAD + (end - start) * pxBeat + 10, h = TOP + ROW * 5 + BOTTOM;
      let s = `<svg class="tabsvg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tab">`;
      'eBGDAE'.split('').forEach((name, i) => {
        const y = TOP + i * ROW;
        s += `<text x="6" y="${y + 4}" class="tab-sname">${name}</text><line x1="${PAD - 6}" y1="${y}" x2="${w - 6}" y2="${y}" class="tab-line"/>`;
      });
      for (let b = start; b <= end; b += beatsPerBar) { const x = PAD + (b - start) * pxBeat - 6; s += `<line x1="${x}" y1="${TOP}" x2="${x}" y2="${TOP + ROW * 5}" class="tab-bar"/>`; }
      for (let b = start; b < end; b++) s += `<text x="${PAD + (b - start) * pxBeat - 2}" y="${h - 1}" class="tab-count">${(b % beatsPerBar) + 1}</text>`;
      notes.forEach((n, i) => {
        if (n.t < start || n.t >= end) return;
        const x = PAD + (n.t - start) * pxBeat + 4, y = TOP + (n.s - 1) * ROW, label = String(n.f), wBox = 7 * label.length + 6;
        s += `<g class="tab-note" data-i="${i}"><rect x="${x - wBox / 2}" y="${y - 9}" width="${wBox}" height="18" rx="4"/><text x="${x}" y="${y + 5}">${label}</text></g>`;
        if (n.x && !n.chord) s += `<text x="${x}" y="${TOP - 12}" class="tab-tech">${esc(n.x === 'pm' ? 'PM' : n.x)}</text>`;
      });
      s += `<line class="tab-head" x1="0" y1="${TOP - 16}" x2="0" y2="${TOP + ROW * 5 + 6}" style="display:none"/></svg>`;
      const wrap = document.createElement('div'); wrap.className = 'tab-sys'; wrap.innerHTML = s;
      track.appendChild(wrap);
      systems.push({ el: wrap, svg: wrap.firstChild, start, end, head: wrap.querySelector('.tab-head') });
    }
    if (state.scroll) r('fixedhead').innerHTML = '<div class="tp-playline"></div>';
    track.style.transform = '';
    paint(state.playing ? currentBeat() : 0);
  }
  function toggle(k, label, on) { return `<button class="tgl ${on ? 'on' : ''}" data-tg="${k}" aria-pressed="${on}">${label}</button>`; }

  /* ------------------------------ Playback ------------------------------- */
  const spb = () => 60 / state.bpm;
  function currentBeat() { return (Audio.now() - state.t0) / spb(); }

  function play() {
    const c = Audio.get(); if (!c) return toast('Audio is not supported here.');
    state.playing = true; state.nextIdx = 0; state.loopN = 0; state.clickBeat = state.countIn ? -beatsPerBar : 0;
    const lead = 0.12 + (state.countIn ? beatsPerBar * spb() : 0);
    state.t0 = c.currentTime + lead;
    state.sched = setInterval(schedule, 25); schedule();
    state.raf = requestAnimationFrame(frame);
    r('play').textContent = '■ Stop'; r('play').className = 'btn stop';
  }
  function stop() {
    state.playing = false; clearInterval(state.sched); cancelAnimationFrame(state.raf);
    const p = r('play'); if (p) { p.textContent = '▶ Play'; p.className = 'btn primary'; }
    paint(-1);
  }
  function schedule() {
    const c = Audio.ctx, ahead = c.currentTime + 0.15;
    // Clicks (including count-in)
    while (state.t0 + state.clickBeat * spb() < ahead) {
      const b = state.clickBeat, t = state.t0 + b * spb();
      const inLoop = b < 0 || state.loop || b < total;
      if (!inLoop) break;
      if (state.click || b < 0) Audio.click(t, ((b % beatsPerBar) + beatsPerBar) % beatsPerBar === 0, 0.8);
      state.clickBeat++;
    }
    // Notes
    for (;;) {
      if (state.nextIdx >= notes.length) {
        if (!state.loop) break;
        state.nextIdx = 0; state.loopN++;
      }
      const n = notes[state.nextIdx];
      const beat = state.loopN * total + swungT(n.t);
      const t = state.t0 + beat * spb();
      if (t > ahead) break;
      if (state.sound && t >= c.currentTime - 0.01) {
        const spread = n.chord ? 0.012 * (6 - n.s) : 0;
        Audio.guitar(noteMidi(n), t + spread, { dur: Math.max(0.25, n.d * spb() * 1.6), gain: n.chord ? 0.32 : 0.55, bright: n.x === 'pm' ? 0.3 : 0.55 });
      }
      state.nextIdx++;
    }
    if (!state.loop && currentBeat() > total + 0.25) { stop(); finished(); }
  }
  function frame() {
    if (!state.playing) return;
    paint(currentBeat());
    state.raf = requestAnimationFrame(frame);
  }
  function paint(beat) {
    const looped = beat >= 0 ? beat % total : -1;
    r('prog').style.width = beat >= 0 ? (looped / total * 100) + '%' : '0';
    systems.forEach(sys => {
      const active = looped >= sys.start && looped < sys.end;
      sys.head.style.display = active && !state.scroll ? '' : 'none';
      if (active && !state.scroll) { const x = PAD + (looped - sys.start) * pxBeat; sys.head.setAttribute('x1', x); sys.head.setAttribute('x2', x); }
      sys.el.classList.toggle('active', active);
    });
    if (state.scroll) {
      const view = r('view'), anchor = (view.clientWidth || 340) * 0.3;
      const x = PAD + Math.max(0, looped) * pxBeat;
      r('track').style.transform = `translateX(${Math.round(anchor - x)}px)`;
    }
    el.querySelectorAll('.tab-note.on').forEach(g => g.classList.remove('on'));
    if (looped >= 0) notes.forEach((n, i) => {
      const st = swungT(n.t);
      if (looped >= st && looped < st + Math.max(n.d, 0.2)) { const g = el.querySelector(`.tab-note[data-i="${i}"]`); if (g) g.classList.add('on'); }
    });
    const m = r('meter');
    if (m && beat < 0 && state.playing) m.textContent = `Count-in: ${Math.ceil(-beat)}`;
    else if (m) m.textContent = state.playing ? `Loop ${Math.floor(beat / total) + 1} · bar ${Math.floor(looped / beatsPerBar) + 1}` : '';
  }
  function finished() { if (onLog) toast(`Run finished at ${state.bpm} BPM. Tap “Log this tempo” to record it.`); }

  function setBpm(v) {
    const was = state.playing ? currentBeat() : null;
    state.bpm = clamp(Math.round(v), 30, 300);
    if (was != null && Audio.ctx) { state.t0 = Audio.ctx.currentTime - was * spb(); state.clickBeat = Math.ceil(was); recalcNext(was); }
    r('bpm').textContent = state.bpm; r('range').value = state.bpm;
    const g = ex.goalBpm; r('bpm').classList.toggle('goal-hit', !!g && state.bpm >= g);
    if (onBpm) onBpm(state.bpm);
  }
  function recalcNext(beat) {
    const looped = beat % total; state.loopN = Math.floor(beat / total);
    state.nextIdx = notes.findIndex(n => swungT(n.t) > looped); if (state.nextIdx < 0) { state.nextIdx = 0; state.loopN++; }
  }

  /* ------------------------------- Events -------------------------------- */
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !el.contains(b)) return;
    if (b.dataset.d) setBpm(state.bpm + Number(b.dataset.d));
    else if (b.dataset.r === 'play') state.playing ? stop() : play();
    else if (b.dataset.r === 'log') { onLog({ exerciseId: ex.id, name: ex.name, tempo: state.bpm, goalBpm: ex.goalBpm || null }); }
    else if (b.dataset.tg) {
      const k = b.dataset.tg; state[k] = !state[k];
      b.classList.toggle('on', state[k]); b.setAttribute('aria-pressed', state[k]);
      if (k === 'sound') onSettings({ tabAudio: state.sound });
      if (k === 'scroll') { onSettings({ tabScroll: state.scroll }); render(); }
      if (k === 'loop' && state.playing && !state.loop) { /* finishes at end of current pass */ }
    }
  });
  r('range').addEventListener('input', e => setBpm(+e.target.value));
  const ro = window.ResizeObserver ? new ResizeObserver(() => { if (!state.scroll) render(); }) : null;
  if (ro) ro.observe(r('view'));
  render();
  setBpm(state.bpm);

  const cleanup = () => { stop(); if (ro) ro.disconnect(); };
  cleanup.getBpm = () => state.bpm;
  cleanup.stop = stop;
  return cleanup;
}
