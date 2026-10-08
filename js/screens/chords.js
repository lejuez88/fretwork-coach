// Chord glossary: pick a root and a chord type to see its notes, formula,
// voicings up the neck and inversions on every string set, all on an
// interactive fretboard with root/interval labels. "Build" mode turns the
// fretboard into a chord finder: tap frets and the chord is named.
import { esc, toast } from '../core/util.js';
import { Audio } from '../core/audio.js';
import {
  ROOTS, ROOT_BY_PC, CHORD_TYPES, TYPE_BY_ID, TYPE_GROUPS, chordTones, chordName, findVoicings, inversionVoicings, identifyChord, intervalFamily,
  INVERSION_NAMES, STRING_SETS, setName, coreTones, parseChord, STD_LOW, mod12, pcName, fretsToString, describeVoicing
} from '../core/theory.js';
import { chordDiagramSVG, fretboardSVG, FAMILY_LEGEND } from '../ui/fretboard.js';

const FAMILIES = [['triad', 'Triads'], ['drop2', 'Drop 2'], ['drop3', 'Drop 3'], ['shell', 'Shells']];
const KEY = 'fretworkCoach.glossary';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch { return {}; } };

export function mountChordGlossary(el, { initial = null } = {}) {
  const saved = load();
  const S = {
    root: saved.root != null ? saved.root : 0, type: saved.type || 'maj', view: saved.view || 'shapes', label: saved.label || 'interval',
    family: null, setIdx: 0, sel: 0, inv: 'all', build: Array(6).fill(null)
  };
  if (initial) {
    const c = parseChord(initial);
    if (c) { S.root = ROOTS.findIndex(r => r.pc === c.root.pc); S.type = c.type; S.view = 'shapes'; }
  }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ root: S.root, type: S.type, view: S.view, label: S.label })); } catch { /* ignore */ } };
  const root = () => ROOTS[S.root];
  const families = () => {
    const n = coreTones(S.type).length;
    return FAMILIES.filter(([k]) => (k === 'triad' ? n === 3 : k === 'shell' ? !!inversionVoicings(root(), S.type, 'shell').length : n === 4 && k !== 'shell'));
  };

  let shapes = [], invs = [];
  function compute() {
    shapes = findVoicings(root(), S.type, { limit: 8 });
    const fams = families();
    if (!S.family || !fams.some(([k]) => k === S.family)) S.family = fams.length ? fams[0][0] : null;
    const sets = S.family ? STRING_SETS[S.family].filter(set => inversionVoicings(root(), S.type, S.family, { set }).length) : [];
    if (S.setIdx >= sets.length) S.setIdx = 0;
    invs = S.family && sets.length ? inversionVoicings(root(), S.type, S.family, { set: sets[S.setIdx] }) : [];
    S._sets = sets;
  }

  function current() {
    if (S.view === 'shapes') return shapes[Math.min(S.sel, shapes.length - 1)] || null;
    if (S.view === 'inversions') { const list = invList(); return list[Math.min(S.sel, list.length - 1)] || null; }
    return null;
  }
  const invList = () => (S.inv === 'all' ? invs : invs.filter(v => v.inversion === +S.inv));

  function marksFor(v) {
    const L = S.label === 'note' ? v.names : S.label === 'finger' ? v.fingers : v.labels;
    return v.frets.map((f, i) => (f == null ? null : { s: 6 - i, f, label: L && L[i] != null ? L[i] : '', family: intervalFamily(v.labels[i]) })).filter(Boolean);
  }
  function neckMarks() {
    const tones = chordTones(root(), S.type), out = [];
    for (let i = 0; i < 6; i++) for (let f = 0; f <= 15; f++) {
      const t = tones.find(x => x.pc === mod12(STD_LOW[i] + f));
      if (t) out.push({ s: 6 - i, f, label: S.label === 'note' ? t.name : t.label, family: intervalFamily(t.label), ghost: t.label !== 'R' && false });
    }
    return out;
  }

  function header() {
    const t = TYPE_BY_ID[S.type], tones = chordTones(root(), S.type);
    return `<div class="chordhead">
      <div><h2>${esc(chordName(root(), S.type))}</h2><div class="small muted">${esc(t.name)}</div></div>
      <div class="tones">${tones.map(x => `<span class="tone fam-${intervalFamily(x.label)}"><b>${esc(x.name)}</b><i>${esc(x.label === 'R' ? '1' : x.label)}</i></span>`).join('')}</div>
    </div>`;
  }

  let render = function () {
    compute();
    const v = current();
    const grouped = TYPE_GROUPS.map(([g, label]) => `<optgroup label="${label}">${CHORD_TYPES.filter(t => t.group === g).map(t => `<option value="${t.id}" ${S.type === t.id ? 'selected' : ''}>${esc(root().name + t.symbol)}  ·  ${esc(t.name)}</option>`).join('')}</optgroup>`).join('');
    el.innerHTML = `
      <section class="card glossary">
        <div class="label">Chord glossary</div>
        <div class="rootpick">${ROOTS.map((r, i) => `<button class="rootbtn ${i === S.root && S.view !== 'build' ? 'on' : ''}" data-root="${i}">${esc(r.name)}</button>`).join('')}</div>
        <label class="mini typepick">Chord type<select data-r="type">${grouped}</select></label>
        ${S.view !== 'build' ? header() : ''}
        <div class="segtabs four gviews">${[['shapes', 'Shapes'], ['inversions', 'Inversions'], ['neck', 'Whole neck'], ['build', 'Build a chord']].map(([k, l]) => `<a href="javascript:void 0" data-view="${k}" class="${S.view === k ? 'on' : ''}">${l}</a>`).join('')}</div>
        ${S.view === 'build' ? buildHTML() : viewHTML(v)}
      </section>`;
  };

  function legendHTML() {
    const fams = new Set(chordTones(root(), S.type).map(x => intervalFamily(x.label)));
    return `<div class="fblegend">${FAMILY_LEGEND.filter(([k]) => fams.has(k)).map(([k, l]) => `<span><i class="fam-${k}"></i>${l}</span>`).join('')}
      <span class="labmodes">${[['interval', 'Intervals'], ['note', 'Notes'], ['finger', 'Fingers']].filter(([k]) => S.view !== 'neck' || k !== 'finger').map(([k, l]) => `<button class="chip sm ${S.label === k ? 'on' : ''}" data-label="${k}">${l}</button>`).join('')}</span></div>`;
  }

  function viewHTML(v) {
    const board = S.view === 'neck' ? fretboardSVG({ marks: neckMarks() }) : v ? fretboardSVG({ marks: marksFor(v), muted: v.frets.map((f, i) => (f == null ? 6 - i : null)).filter(Boolean) }) : '';
    let below = '';
    if (S.view === 'shapes') {
      below = shapes.length ? `<p class="small muted">${shapes.length} shapes up the neck. Tap one to see it on the fretboard.</p>
        <div class="vgrid">${shapes.map((x, i) => `<button class="vcard ${i === S.sel ? 'on' : ''}" data-sel="${i}">${chordDiagramSVG(x, { mode: S.label, title: x.frets.some(f => f === 0) && x.maxF <= 4 ? 'Open' : `Fret ${x.minF}` })}<span class="small muted">${x.inversion ? esc(x.name) : x.barre ? 'Barre' : x.frets.some(f => f === 0) ? 'Open strings' : 'Movable'}</span></button>`).join('')}</div>`
        : '<p class="muted">No playable shape found for this chord in standard tuning.</p>';
    } else if (S.view === 'inversions') {
      const fams = families(), list = invList();
      const n = coreTones(S.type).length;
      below = !fams.length ? `<p class="muted">${n === 2 ? 'Power chords have two notes, so there are no inversions to show.' : 'This chord has more notes than fit on one string set; see Shapes.'}</p>` : `
        <div class="chips small">${fams.map(([k, l]) => `<button class="chip sm ${S.family === k ? 'on' : ''}" data-family="${k}">${l}</button>`).join('')}</div>
        <div class="chips small">${S._sets.map((set, i) => `<button class="chip sm ${S.setIdx === i ? 'on' : ''}" data-set="${i}">${esc(setName(set))}</button>`).join('')}</div>
        <div class="chips small" ${S.family === 'shell' ? 'hidden' : ''}>${['all', 0, 1, 2, 3].filter(k => k === 'all' || k < n).map(k => `<button class="chip sm ${String(S.inv) === String(k) ? 'on' : ''}" data-inv="${k}">${k === 'all' ? 'All' : INVERSION_NAMES[k]}</button>`).join('')}</div>
        <p class="small muted">${familyHelp(S.family, n)}</p>
        <div class="vgrid">${list.map((x, i) => `<button class="vcard ${i === S.sel ? 'on' : ''}" data-sel="${i}">${chordDiagramSVG(x, { mode: S.label, title: INVERSION_NAMES[x.inversion].replace(' position', '') })}<span class="small muted">${esc(x.name)} · fret ${x.minF || 0}</span></button>`).join('') || '<p class="muted small">No voicings on this string set.</p>'}</div>`;
    } else {
      below = `<p class="small muted">Every ${esc(chordName(root(), S.type))} chord tone on the neck. Find the root on each string, then the 3rd and 5th around it: that's how every shape is built.</p>`;
    }
    return `
      <div class="fbwrap">${board}</div>
      ${legendHTML()}
      ${v && S.view !== 'neck' ? `<div class="vinfo"><b>${esc(v.name)}</b> <span class="small muted">${esc(INVERSION_NAMES[v.inversion] || '')} · ${esc(fretsToString(v.frets))} · bass ${esc(v.names[v.frets.findIndex(f => f != null)])}</span><button class="btn sm" data-x="play">▶ Play</button><button class="btn sm ghost" data-x="arp">Arpeggiate</button></div>` : `<div class="vinfo"><button class="btn sm" data-x="playroot">▶ Hear ${esc(chordName(root(), S.type))}</button></div>`}
      ${below}`;
  }

  function familyHelp(f, n) {
    return {
      triad: 'Three-note voicings on three adjacent strings. Root position, 1st inversion (3rd in the bass) and 2nd inversion (5th in the bass) repeat up the neck: learn one string set at a time.',
      drop2: 'Four-note voicings on four adjacent strings: take a close voicing and drop the second-highest note an octave. The standard jazz and neo-soul grips.',
      drop3: 'Four-note voicings with a string skipped: the third-highest note is dropped an octave. Wide, piano-like sound with the bass on string 6 or 5.',
      shell: 'Root, 3rd and 7th only: the essential sound of the chord, used for comping and walking changes.'
    }[f] || '';
  }

  /* ------------------------------- Build -------------------------------- */
  function buildHTML() {
    const b = S.build, played = b.map((f, i) => (f == null ? null : { i, f, midi: STD_LOW[i] + f })).filter(Boolean);
    const bass = played.length ? played[0].midi : null;
    const cands = played.length ? identifyChord(played.map(p => p.midi), bass) : [];
    const best = cands[0];
    const desc = best && best.type ? describeVoicing(b, best.name) : null;
    const marks = played.map(p => {
      const lab = desc ? (S.label === 'note' ? desc.names[p.i] : S.label === 'finger' ? desc.fingers[p.i] : desc.labels[p.i]) : pcName(p.midi);
      return { s: 6 - p.i, f: p.f, label: lab == null ? '' : lab, family: desc ? intervalFamily(desc.labels[p.i]) : 'root' };
    });
    const muted = b.map((f, i) => (f == null ? 6 - i : null)).filter(Boolean);
    return `
      <p class="small muted">Tap a fret on each string to build a chord (tap the space left of the nut for an open string, tap a note again to mute that string). The chord is named as you go.</p>
      <div class="fbwrap">${fretboardSVG({ marks, muted, interactive: true })}</div>
      ${legendHTML()}
      <div class="buildres">
        ${!played.length ? '<p class="muted">No notes yet.</p>' : best ? `
          <div class="bname">${esc(best.name)}</div>
          <div class="small muted">${best.note ? esc(best.note) : `${esc(TYPE_BY_ID[best.type].name)}${best.inversion ? ' · ' + esc(INVERSION_NAMES[best.inversion]) : ''}${best.exact ? '' : ' · missing ' + esc(best.missing.join(', '))}`}</div>
          ${cands.length > 1 ? `<div class="small">Also: ${cands.slice(1, 5).map(c => `<b>${esc(c.name)}</b>`).join(' · ')}</div>` : ''}
          <div class="small">Notes, low to high: ${played.map(p => esc(desc ? desc.names[p.i] : pcName(p.midi))).join(' – ')} · ${esc(fretsToString(b))}</div>`
        : `<div class="bname">?</div><div class="small muted">These notes (${[...new Set(played.map(p => pcName(p.midi)))].join(', ')}) don't form a chord in the glossary yet.</div>`}
        <div class="row">${played.length ? '<button class="btn sm" data-x="playbuild">▶ Play</button>' : ''}${best && best.type ? '<button class="btn sm" data-x="open">Show in glossary</button>' : ''}<button class="btn sm ghost" data-x="clear">Clear</button>${v0() ? '<button class="btn sm ghost" data-x="fromsel">Start from the selected shape</button>' : ''}</div>
      </div>`;
  }
  const v0 = () => shapes[S.sel] || null;

  function play(frets, arp = false) {
    const c = Audio.get(); if (!c) return toast('Audio is not supported here.');
    const ms = frets.map((f, i) => (f == null ? null : STD_LOW[i] + f)).filter(m => m != null);
    if (!ms.length) return;
    if (arp) ms.forEach((m, i) => Audio.guitar(m, c.currentTime + 0.05 + i * 0.22, { dur: 1.6, gain: 0.5 }));
    else Audio.strum(ms, c.currentTime + 0.05, { dur: 2.4, gain: 0.7 });
  }

  const onClick = e => {
    const hit = e.target.closest('.fb-hit');
    if (hit && S.view === 'build') {
      const i = 6 - +hit.dataset.s, f = +hit.dataset.f;
      S.build[i] = S.build[i] === f ? null : f;
      render();
      if (S.build[i] != null) { const c = Audio.get(); if (c) Audio.guitar(STD_LOW[i] + f, c.currentTime + 0.02, { dur: 1.2, gain: 0.5 }); }
      return;
    }
    const b = e.target.closest('button, [data-view]'); if (!b) return;
    const d = b.dataset;
    if (d.root != null) { S.root = +d.root; S.sel = 0; if (S.view === 'build') S.view = 'shapes'; persist(); return render(); }
    if (d.view) { S.view = d.view; S.sel = 0; persist(); return render(); }
    if (d.label) { S.label = d.label; persist(); return render(); }
    if (d.family) { S.family = d.family; S.setIdx = 0; S.sel = 0; S.inv = 'all'; return render(); }
    if (d.set != null) { S.setIdx = +d.set; S.sel = 0; return render(); }
    if (d.inv != null) { S.inv = d.inv; S.sel = 0; return render(); }
    if (d.sel != null) { S.sel = +d.sel; render(); const v = current(); if (v) play(v.frets); return; }
    if (d.x === 'play') { const v = current(); if (v) play(v.frets); return; }
    if (d.x === 'arp') { const v = current(); if (v) play(v.frets, true); return; }
    if (d.x === 'playroot') { const v = shapes[0]; if (v) play(v.frets); return; }
    if (d.x === 'playbuild') return play(S.build);
    if (d.x === 'clear') { S.build = Array(6).fill(null); return render(); }
    if (d.x === 'fromsel') { const v = v0(); if (v) S.build = v.frets.slice(); return render(); }
    if (d.x === 'open') {
      const played = S.build.map((f, i) => (f == null ? null : STD_LOW[i] + f)).filter(m => m != null);
      const best = identifyChord(played, played[0])[0];
      if (best && best.type) { S.root = ROOTS.findIndex(r => r.pc === best.root.pc); S.type = best.type; S.view = 'shapes'; S.sel = 0; persist(); render(); }
    }
  };
  const onChange = e => { if (e.target.dataset.r === 'type') { S.type = e.target.value; S.sel = 0; S.inv = 'all'; if (S.view === 'build') S.view = 'shapes'; persist(); render(); } };
  el.addEventListener('click', onClick); el.addEventListener('change', onChange);
  const _render = render;
  render = function () {
    _render();
    // Scroll the neck to the selected shape
    const wrap = el.querySelector('.fbwrap'), v = S.view !== 'neck' && S.view !== 'build' ? current() : null;
    if (wrap && v) { const mid = ((v.minF || 0) + (v.maxF || 0)) / 2; wrap.scrollLeft = Math.max(0, 38 + mid * 46 - wrap.clientWidth / 2); }
  };
  render();
  return () => { el.removeEventListener('click', onClick); el.removeEventListener('change', onChange); };
}
