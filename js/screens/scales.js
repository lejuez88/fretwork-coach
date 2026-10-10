// Scales glossary (Tools → Scales): pick a root and a scale to see its notes and formula, how it
// sounds and where it's used, the whole neck with degree or note labels, and one position at a
// time. ▶ plays it up and down; scales with a learning path link to it.
import { esc } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { ROOTS, SCALE_BY_ID, STD_LOW, mod12, intervalFamily } from '../core/theory.js';
import { fretboardSVG } from '../ui/fretboard.js';
import { SCALE_GROUPS, SCALE_INFO, SCALE_PATHS } from '../data/scaleinfo.js';
import { KB_BY_ID } from '../data/kb.js';

const KEY = 'fretworkCoach.scales';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch { return {}; } };
const FLAT_KEYS = new Set([5, 10, 3, 8, 1]); // F, B♭, E♭, A♭, D♭ read better with flats
const NAMES_S = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'], NAMES_F = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/** The scale's notes in a key: [{pc, name, label}]. */
export function scaleNotes(rootPc, id) {
  const sc = SCALE_BY_ID[id]; if (!sc) return [];
  const flats = FLAT_KEYS.has(rootPc) || /♭/.test(sc.labels.join('')) && !/♯/.test(sc.labels.join(''));
  return sc.steps.map((st, i) => { const pc = mod12(rootPc + st); return { pc, name: (flats ? NAMES_F : NAMES_S)[pc], label: sc.labels[i] }; });
}
/** Marks for every scale note on the neck (frets 0..maxFret). */
export function neckMarksFor(rootPc, id, { maxFret = 15, labels = 'degree', lo = 0, hi = 99 } = {}) {
  const notes = scaleNotes(rootPc, id), out = [];
  for (let i = 0; i < 6; i++) for (let f = 0; f <= maxFret; f++) {
    const n = notes.find(x => x.pc === mod12(STD_LOW[i] + f)); if (!n) continue;
    const inBox = f >= lo && f <= hi;
    out.push({ s: 6 - i, f, label: labels === 'note' ? n.name : (n.label === 'R' ? 'R' : n.label), family: n.label === 'R' ? 'root' : intervalFamily(n.label), ghost: !inBox });
  }
  return out;
}

export function mountScalesGlossary(el) {
  const saved = load();
  const S = { root: saved.root != null ? saved.root : 9, scale: SCALE_BY_ID[saved.scale] ? saved.scale : 'minorPent', labels: saved.labels || 'degree', pos: 0 };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ root: S.root, scale: S.scale, labels: S.labels })); } catch { /* ignore */ } };
  let playTimer = null;
  const rootPc = () => ROOTS[S.root].pc;

  /** Positions: windows of 4–5 frets starting on each scale note of the low E string inside frets 0–12. */
  function positions() {
    const notes = scaleNotes(rootPc(), S.scale), starts = [];
    for (let f = 0; f <= 12; f++) if (notes.some(n => n.pc === mod12(STD_LOW[0] + f))) starts.push(f);
    const span = SCALE_BY_ID[S.scale].steps.length >= 8 ? 4 : 3;
    return starts.filter((f, i) => i === 0 || f - starts[i - 1] >= 2 || SCALE_BY_ID[S.scale].steps.length <= 5).slice(0, 7).map(f => [Math.max(0, f), f + span]);
  }
  function render() {
    const sc = SCALE_BY_ID[S.scale], info = SCALE_INFO[S.scale] || {}, notes = scaleNotes(rootPc(), S.scale);
    const pos = positions(), box = S.pos > 0 ? pos[S.pos - 1] : null;
    const path = SCALE_PATHS[S.scale] && KB_BY_ID[SCALE_PATHS[S.scale]];
    el.innerHTML = `<section class="card glossary scales">
      <div class="label">Scales glossary</div>
      <div class="rootpick">${ROOTS.map((r, i) => `<button class="rootbtn ${i === S.root ? 'on' : ''}" data-root="${i}">${esc(r.name)}</button>`).join('')}</div>
      <label class="mini typepick">Scale<select data-r="scale">${SCALE_GROUPS.map(([, label, ids]) => `<optgroup label="${esc(label)}">${ids.filter(id => SCALE_BY_ID[id]).map(id => `<option value="${id}" ${S.scale === id ? 'selected' : ''}>${esc(ROOTS[S.root].name + ' ' + SCALE_BY_ID[id].name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <div class="chordhead"><div><h2>${esc(ROOTS[S.root].name)} ${esc(sc.name)}</h2><div class="small muted">${sc.steps.length} notes · ${esc(stepPattern(sc.steps))}</div></div>
        <div class="tones">${notes.map(n => `<span class="tone fam-${n.label === 'R' ? 'root' : intervalFamily(n.label)}"><b>${esc(n.name)}</b><i>${esc(n.label === 'R' ? '1' : n.label)}</i></span>`).join('')}</div></div>
      <div class="row sc-act"><button class="btn sm primary" data-sc="play">▶ Play it</button><div class="chips">${[['degree', 'Degrees'], ['note', 'Notes']].map(([k, l]) => `<button class="chip sm ${S.labels === k ? 'on' : ''}" data-lab="${k}">${l}</button>`).join('')}</div>
        ${path ? `<a class="btn sm" href="#/techniques/${path.id}">Learn it step by step: ${esc(path.title)} ›</a>` : ''}</div>
      <div class="chips sc-pos"><button class="chip sm ${!box ? 'on' : ''}" data-pos="0">Whole neck</button>${pos.map((p, i) => `<button class="chip sm ${S.pos === i + 1 ? 'on' : ''}" data-pos="${i + 1}">Position ${i + 1} · frets ${p[0]}–${p[1]}</button>`).join('')}</div>
      <div class="fbwrap">${fretboardSVG({ marks: neckMarksFor(rootPc(), S.scale, { labels: S.labels, lo: box ? box[0] : 0, hi: box ? box[1] : 99 }), maxFret: 15, highlightFrets: box || null })}</div>
      <dl class="sc-info">
        ${info.sound ? `<dt>Sound</dt><dd>${esc(info.sound)}</dd>` : ''}
        ${info.built ? `<dt>How it’s built</dt><dd>${esc(info.built)}</dd>` : ''}
        ${info.fits ? `<dt>Play it over</dt><dd>${esc(info.fits)}</dd>` : ''}
        ${info.where ? `<dt>Where you hear it</dt><dd>${esc(info.where)}</dd>` : ''}
        ${info.tip ? `<dt>Tip</dt><dd>${esc(info.tip)}</dd>` : ''}
      </dl>
    </section>`;
  }
  const stepPattern = steps => steps.map((s, i) => { const d = (steps[i + 1] != null ? steps[i + 1] : 12) - s; return d === 1 ? 'H' : d === 2 ? 'W' : d === 3 ? 'W+H' : `${d}`; }).join(' ');
  function play() {
    const c = Audio.get(); if (!c) return;
    const base = 52 + mod12(rootPc() - 4), steps = SCALE_BY_ID[S.scale].steps, seq = [...steps.map(s => base + s), base + 12, ...steps.slice().reverse().map(s => base + s)];
    const t0 = c.currentTime + 0.05;
    seq.forEach((m, i) => Audio.guitar(m, t0 + i * 0.22, { dur: 0.5, gain: 0.5 }));
  }
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.root != null) { S.root = +b.dataset.root; S.pos = 0; }
    else if (b.dataset.lab) S.labels = b.dataset.lab;
    else if (b.dataset.pos != null) S.pos = +b.dataset.pos;
    else if (b.dataset.sc === 'play') return play();
    else return;
    persist(); render();
  });
  el.addEventListener('change', e => { if (e.target.dataset.r === 'scale') { S.scale = e.target.value; S.pos = 0; persist(); render(); } });
  render();
  return () => { clearTimeout(playTimer); };
}
