// Scales glossary (Tools → Scales): pick a root and a scale to see its notes and formula, how it
// sounds and where it's used, the whole neck with degree or note labels, and one position at a
// time. ▶ plays it up and down; scales with a learning path link to it.
// Colors: the root is always marked; every other note is a plain dot until you tap its degree in
// the list above the neck, which lights that interval in its color. Any combination can be on.
import { esc } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { ROOTS, SCALE_BY_ID, STD_LOW, mod12, intervalFamily, spellScale, scalePositions, ROOT_BY_PC } from '../core/theory.js';
import { fretboardSVG } from '../ui/fretboard.js';
import { SCALE_GROUPS, SCALE_INFO, SCALE_PATHS } from '../data/scaleinfo.js';
import { KB_BY_ID } from '../data/kb.js';

const KEY = 'fretworkCoach.scales';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch { return {}; } };

/** The scale's notes in a key, spelled from its degrees: [{pc, name, label}]. */
export function scaleNotes(rootPc, id) {
  return spellScale(ROOTS.find(r => r.pc === mod12(rootPc)) || ROOT_BY_PC[mod12(rootPc)], id);
}
/**
 * Marks for every scale note on the neck (frets 0..maxFret). The root is always in the root color;
 * other degrees are plain unless their label is in `hl` (a Set of degree labels such as '3', '♭7').
 */
export function neckMarksFor(rootPc, id, { maxFret = 15, labels = 'degree', lo = 0, hi = 99, lit = null, hl = null } = {}) {
  const notes = scaleNotes(rootPc, id), out = [];
  for (let i = 0; i < 6; i++) for (let f = 0; f <= maxFret; f++) {
    const n = notes.find(x => x.pc === mod12(STD_LOW[i] + f)); if (!n) continue;
    const inBox = lit ? lit.has(`${6 - i}:${f}`) : f >= lo && f <= hi;
    const isRoot = n.label === 'R', on = !isRoot && hl && hl.has(n.label);
    out.push({ s: 6 - i, f, label: labels === 'note' ? n.name : n.label, family: isRoot ? 'root' : on ? intervalFamily(n.label) : 'plain', cls: on ? 'hl' : '', ghost: !inBox });
  }
  return out;
}

export function mountScalesGlossary(el) {
  const saved = load();
  const S = { root: saved.root != null ? saved.root : 9, scale: SCALE_BY_ID[saved.scale] ? saved.scale : 'minorPent', labels: saved.labels || 'degree', pos: 0, hl: new Set() };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ root: S.root, scale: S.scale, labels: S.labels })); } catch { /* ignore */ } };
  let playTimer = null;
  const rootPc = () => ROOTS[S.root].pc;

  /** Positions: real fingerings (3 notes per string, or the pentatonic boxes) you can run straight through. */
  const positions = () => scalePositions(rootPc(), S.scale);
  function render() {
    const sc = SCALE_BY_ID[S.scale], info = SCALE_INFO[S.scale] || {}, notes = scaleNotes(rootPc(), S.scale);
    const pos = positions(), box = S.pos > 0 ? pos[S.pos - 1] : null;
    const path = SCALE_PATHS[S.scale] && KB_BY_ID[SCALE_PATHS[S.scale]];
    el.innerHTML = `<section class="card glossary scales">
      <div class="label">Scales glossary</div>
      <div class="rootpick">${ROOTS.map((r, i) => `<button class="rootbtn ${i === S.root ? 'on' : ''}" data-root="${i}">${esc(r.name)}</button>`).join('')}</div>
      <label class="mini typepick">Scale<select data-r="scale">${SCALE_GROUPS.map(([, label, ids]) => `<optgroup label="${esc(label)}">${ids.filter(id => SCALE_BY_ID[id]).map(id => `<option value="${id}" ${S.scale === id ? 'selected' : ''}>${esc(ROOTS[S.root].name + ' ' + SCALE_BY_ID[id].name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <div class="chordhead"><div><h2>${esc(ROOTS[S.root].name)} ${esc(sc.name)}</h2><div class="small muted">${sc.steps.length} notes · ${esc(stepPattern(sc.steps))}</div></div>
        <div class="sc-tonebox"><div class="tones" role="group" aria-label="Highlight intervals">${notes.map(n => n.label === 'R'
          ? `<span class="tone fam-root is-root" title="The root is always marked"><b>${esc(n.name)}</b><i>1</i></span>`
          : `<button type="button" class="tone tone-tg ${S.hl.has(n.label) ? 'on fam-' + intervalFamily(n.label) : ''}" data-hl="${esc(n.label)}" aria-pressed="${S.hl.has(n.label)}" title="${S.hl.has(n.label) ? 'Hide' : 'Highlight'} the ${esc(n.label)} on the neck"><b>${esc(n.name)}</b><i>${esc(n.label)}</i></button>`).join('')}</div>
          <div class="sc-tonehint small muted">${S.hl.size ? `<button type="button" class="linkbtn" data-hlall="0">Clear highlights</button>` : 'Tap a note to highlight that interval on the neck'}${S.hl.size < notes.length - 1 ? ` · <button type="button" class="linkbtn" data-hlall="1">Highlight all</button>` : ''}</div></div></div>
      <div class="row sc-act"><button class="btn sm primary" data-sc="play">▶ Play it</button><div class="chips">${[['degree', 'Degrees'], ['note', 'Notes']].map(([k, l]) => `<button class="chip sm ${S.labels === k ? 'on' : ''}" data-lab="${k}">${l}</button>`).join('')}</div>
        ${path ? `<a class="btn sm" href="#/techniques/${path.id}">Learn it step by step: ${esc(path.title)} ›</a>` : ''}</div>
      <div class="chips sc-pos"><button class="chip sm ${!box ? 'on' : ''}" data-pos="0">Whole neck</button>${pos.map((p, i) => `<button class="chip sm ${S.pos === i + 1 ? 'on' : ''}" data-pos="${i + 1}">Position ${i + 1} · frets ${p.lo}–${p.hi}</button>`).join('')}</div>
      <div class="fbwrap">${fretboardSVG({ marks: neckMarksFor(rootPc(), S.scale, { labels: S.labels, maxFret: box ? Math.max(15, box.hi) : 15, lit: box ? new Set(box.notes.map(n => `${n.s}:${n.f}`)) : null, hl: S.hl }), maxFret: box ? Math.max(15, box.hi) : 15, highlightFrets: box ? [box.lo, box.hi] : null })}</div>
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
    if (b.dataset.hl != null) { const l = b.dataset.hl; S.hl.has(l) ? S.hl.delete(l) : S.hl.add(l); return render(); }
    if (b.dataset.hlall != null) { S.hl = b.dataset.hlall === '1' ? new Set(scaleNotes(rootPc(), S.scale).map(n => n.label).filter(l => l !== 'R')) : new Set(); return render(); }
    if (b.dataset.root != null) { S.root = +b.dataset.root; S.pos = 0; }
    else if (b.dataset.lab) S.labels = b.dataset.lab;
    else if (b.dataset.pos != null) S.pos = +b.dataset.pos;
    else if (b.dataset.sc === 'play') return play();
    else return;
    persist(); render();
  });
  el.addEventListener('change', e => { if (e.target.dataset.r === 'scale') { S.scale = e.target.value; S.pos = 0; const ls = new Set(scaleNotes(rootPc(), S.scale).map(n => n.label)); S.hl = new Set([...S.hl].filter(l => ls.has(l))); persist(); render(); } });
  render();
  return () => { clearTimeout(playTimer); };
}
