// Playback bar: fixed at the bottom of the screen whenever something you can play
// is open (the tab player or the metronome on a practice screen). It controls the
// player you used last: play/pause, back to the start, tempo (±1, ±5, slider, tap),
// and the playback switches (click, loop, count-in, guitar sound, tempo ladder,
// click sound). The players hide their own copies of these controls while docked.
// Space bar plays and pauses (when you aren't typing).
//
// A player attaches with Transport.attach(ctrl) and calls the returned handle's
// sync() when its state changes; detach() when it unmounts. ctrl:
//   {el, name, isPlaying(), toggle(), restart?(), getBpm(), setBpm(v), min, max,
//    unit, goal, toggles() → [{k, label, on}], flip(k), status() → {pct, text}, rampText?()}
import { esc } from '../core/util.js';
import { clickSoundSelectHTML } from './clicksound.js';

const OPEN_KEY = 'fretworkCoach.dockOpen';
const stack = [];
let active = null, bar = null, raf = null, taps = [];
let optsOpen = false;
try { optsOpen = localStorage.getItem(OPEN_KEY) === '1'; } catch { /* ignore */ }

function ensureBar() {
  if (bar && bar.isConnected) return bar;
  bar = document.createElement('div');
  bar.id = 'transport';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Playback controls');
  const ab = document.getElementById('actionbar');
  if (ab && ab.parentNode) ab.parentNode.insertBefore(bar, ab); else document.body.appendChild(bar);
  bar.addEventListener('click', onClick);
  bar.addEventListener('input', onInput);
  window.addEventListener('resize', place);
  window.addEventListener('fc:bars', place);
  document.addEventListener('keydown', onKey);
  return bar;
}

function render() {
  const c = active, b = ensureBar();
  if (!c) { b.classList.remove('show'); b.innerHTML = ''; document.body.classList.remove('has-transport'); place(); return; }
  const playing = c.isPlaying(), bpm = c.getBpm(), tg = c.toggles ? c.toggles() : [];
  const goalHit = c.goal && bpm >= c.goal;
  b.innerHTML = `
    <div class="tr-prog"><i data-tr="prog"></i></div>
    <div class="inner">
      <div class="tr-status"><b>${esc(c.name || 'Now playing')}</b><span data-tr="status"></span></div>
      <div class="tr-main">
        ${c.restart ? '<button class="kbtn tr-restart" data-tr="restart" aria-label="Back to the start" title="Back to the start">⏮</button>' : ''}
        <button class="btn ${playing ? 'pause' : 'primary'} tr-play" data-tr="play" aria-label="${playing ? 'Pause' : 'Play'}">${playing ? '❚❚' : '▶'}<span class="tr-pl"> ${playing ? 'Pause' : 'Play'}</span></button>
        <div class="tr-tempo">
          <button class="kbtn wide-only" data-tr-d="-5">−5</button><button class="kbtn" data-tr-d="-1" aria-label="Slower">−</button>
          <div class="tr-bpm ${goalHit ? 'goal-hit' : ''}" title="${c.goal ? `Goal: ${c.goal} BPM` : ''}"><b data-tr="bpm">${bpm}</b><span>BPM${c.unit ? ' · ' + esc(c.unit) : ''}</span></div>
          <button class="kbtn" data-tr-d="1" aria-label="Faster">+</button><button class="kbtn wide-only" data-tr-d="5">+5</button>
        </div>
        <input class="tr-range wide-only" type="range" min="${c.min || 30}" max="${c.max || 240}" value="${bpm}" data-tr="range" aria-label="Tempo">
        <button class="kbtn tr-tap wide-only" data-tr="tap">Tap</button>
        <button class="kbtn tr-more ${optsOpen ? 'on' : ''}" data-tr="more" aria-expanded="${optsOpen}" aria-label="More playback options" title="More options">⋯</button>
      </div>
      <div class="tr-opts" ${optsOpen ? '' : 'hidden'}>
        <input class="tr-range narrow-only" type="range" min="${c.min || 30}" max="${c.max || 240}" value="${bpm}" data-tr="range" aria-label="Tempo">
        <div class="tr-tgls">
          <button class="tgl narrow-only" data-tr="tap">Tap tempo</button>
          ${tg.map(t => `<button class="tgl ${t.on ? 'on' : ''}" data-tr-tg="${t.k}" aria-pressed="${t.on}">${esc(t.label)}</button>`).join('')}
          ${clickSoundSelectHTML('tr-sound')}
        </div>
        ${c.rampText ? `<div class="small muted tr-ramptxt">${esc(c.rampText())}</div>` : ''}
      </div>
    </div>`;
  b.classList.add('show');
  document.body.classList.add('has-transport');
  paintStatus();
  place();
  loop();
}

function paintStatus() {
  if (!active || !bar) return;
  const s = active.status ? active.status() : null;
  const st = bar.querySelector('[data-tr="status"]'), pr = bar.querySelector('[data-tr="prog"]');
  if (st) st.textContent = s && s.text ? ' · ' + s.text : '';
  if (pr) pr.style.width = (s && s.pct != null ? s.pct : 0) + '%';
}
function loop() {
  cancelAnimationFrame(raf);
  if (!active || !active.isPlaying()) return;
  const step = () => { paintStatus(); if (active && active.isPlaying()) raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step);
}

/** Sit just above the action bar or the tab bar, and leave room for it at the end of the page. */
function place() {
  if (!bar) return;
  const ab = document.getElementById('actionbar'), tb = document.getElementById('tabbar');
  const below = ab && ab.classList.contains('show') ? ab.offsetHeight : tb && tb.classList.contains('show') && getComputedStyle(tb).display !== 'none' ? tb.offsetHeight : 0;
  bar.style.bottom = below + 'px';
  const h = bar.classList.contains('show') ? bar.offsetHeight : 0;
  document.body.style.setProperty('--dock-top', (below + h) + 'px');
}

function onClick(e) {
  const c = active; if (!c) return;
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.trD) { c.setBpm(c.getBpm() + Number(b.dataset.trD)); return; }
  if (b.dataset.trTg) { c.flip(b.dataset.trTg); return; }
  switch (b.dataset.tr) {
    case 'play': c.toggle(); break;
    case 'restart': if (c.restart) c.restart(); break;
    case 'more':
      optsOpen = !optsOpen; try { localStorage.setItem(OPEN_KEY, optsOpen ? '1' : '0'); } catch { /* ignore */ }
      render(); break;
    case 'tap': {
      const now = performance.now(); if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
      taps.push(now); if (taps.length > 6) taps.shift();
      if (taps.length >= 3) { const gaps = taps.slice(1).map((t, i) => t - taps[i]); c.setBpm(Math.round(60000 / (gaps.reduce((a, x) => a + x, 0) / gaps.length))); }
      break;
    }
  }
}
function onInput(e) { if (active && e.target.dataset.tr === 'range') active.setBpm(+e.target.value); }
function onKey(e) {
  if (!active || e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || (t && t.isContentEditable)) return;
  if (document.querySelector('.sheet-wrap')) return;
  e.preventDefault(); active.toggle();
}

/** Light refresh (tempo, play state) without rebuilding the bar while a slider is dragged. */
function refresh(c) {
  if (c !== active || !bar) return;
  const bpmEl = bar.querySelector('[data-tr="bpm"]');
  const playing = c.isPlaying(), pb = bar.querySelector('[data-tr="play"]');
  const sameShape = bpmEl && pb && pb.classList.contains(playing ? 'pause' : 'primary');
  if (!sameShape) return render();
  const bpm = c.getBpm();
  bpmEl.textContent = bpm;
  bar.querySelectorAll('[data-tr="range"]').forEach(r => { if (document.activeElement !== r) r.value = bpm; });
  bpmEl.parentElement.classList.toggle('goal-hit', !!c.goal && bpm >= c.goal);
  const tg = c.toggles ? c.toggles() : [];
  tg.forEach(t => { const x = bar.querySelector(`[data-tr-tg="${t.k}"]`); if (x) { x.classList.toggle('on', t.on); x.setAttribute('aria-pressed', t.on); } });
  const rt = bar.querySelector('.tr-ramptxt'); if (rt && c.rampText) rt.textContent = c.rampText();
  paintStatus();
}

export const Transport = {
  /** Register a player; it becomes the one the bar controls. Returns {sync, activate, detach}. */
  attach(ctrl) {
    stack.push(ctrl); active = ctrl;
    if (ctrl.el) {
      ctrl.el.classList.add('docked');
      ctrl._onDown = () => { if (active !== ctrl && stack.includes(ctrl)) { active = ctrl; render(); } };
      ctrl.el.addEventListener('pointerdown', ctrl._onDown);
    }
    render();
    return {
      sync: () => (ctrl === active ? refresh(ctrl) : null),
      activate: () => { if (stack.includes(ctrl)) { active = ctrl; render(); } },
      detach: () => {
        const i = stack.indexOf(ctrl); if (i >= 0) stack.splice(i, 1);
        if (ctrl.el) { ctrl.el.classList.remove('docked'); ctrl.el.removeEventListener('pointerdown', ctrl._onDown); }
        if (active === ctrl) { active = stack[stack.length - 1] || null; render(); }
      }
    };
  },
  get active() { return active; },
  /** For tests. */
  _bar: () => bar
};
