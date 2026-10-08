// Artist Series: built-in lessons on the signature techniques of well-known
// guitarists (Eric Johnson's rolling 5s and spread triads, Eddie Van Halen's
// tapping, Paul Gilbert's six-note picking lick…). Every exercise is an
// original drill "in the style of" the player, generated in any key by the
// theory engine; famous songs are linked out (Songsterr) rather than
// transcribed. Each artist is also a master-class topic, so "an Eric Johnson
// master class" is built from these lessons with no API call.
//
// The same generators back the technique library (TECHNIQUES), which lets a
// request that names techniques ("speed pentatonics, rolling 5s and spread
// triads") get one skill per technique instead of a generic course.
import { mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC } from '../core/theory.js';
import { rootFret6, fretOn } from '../core/atoms.js';

/* ------------------------------- Helpers ------------------------------- */
const OPEN = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
const N = (s, f, t, d, x, extra) => ({ t: +t.toFixed(4), d, s, f, ...(x ? { x } : {}), ...(extra || {}) });
const nameOf = pc => (ROOT_BY_PC[mod12(pc)] ? ROOT_BY_PC[mod12(pc)].name : 'A');
const minorKey = c => (c.minor ? mod12(c.key) : mod12(c.key - 3));
const goalFor = (c, base) => Math.round(base * (0.78 + (c.lvl || 4) * 0.05));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const beatsOf = notes => Math.max(4, Math.ceil(Math.max(...notes.map(n => n.t + n.d)) / 4 - 1e-6) * 4);
function make(c, o) {
  const goal = goalFor(c, o.goal), start = Math.max(30, Math.round(o.start != null ? o.start : goal * 0.6));
  const out = { level: Math.max(1, Math.min(10, Math.round((c.lvl || 4) + (o.dl || 0)))), minutes: o.minutes || 5, goalBpm: goal, startBpm: Math.min(start, goal - 4), ...o };
  delete out.goal; delete out.start; delete out.dl;
  if (out.tab && out.tab.notes && !out.tab.beats) out.tab.beats = beatsOf(out.tab.notes);
  out.id = out.id || slug(out.name);
  return out;
}
const fromSeq = (seq, step, t0 = 0) => seq.map(([s, f, x], i) => N(s, f, t0 + i * step, step, x));

/** Minor pentatonic box (1–5) for a minor key: 12 notes, low string to high, two per string. */
export function pentBox(key, box = 1) {
  const pcs = [0, 3, 5, 7, 10].map(x => mod12(key + x));
  let f = rootFret6(key), k = 1;
  while (k < box) { f++; if (pcs.includes(mod12(40 + f))) k++; }
  let n = scaleNps(key, 'minorPent', f, 2);
  if ((!n || Math.max(...n.map(x => x.f)) > 20) && f >= 12) n = scaleNps(key, 'minorPent', f - 12, 2);
  return n || null;
}
/** Frets per string: {1: [lo, hi], 2: [...], ...}. */
const byString = notes => { const m = {}; (notes || []).forEach(n => (m[n.s] = m[n.s] || []).push(n.f)); Object.values(m).forEach(a => a.sort((x, y) => x - y)); return m; };
/** Three-notes-per-string pentatonic: the diagonal shape that travels along the neck. */
function pent3nps(key) {
  const rf = rootFret6(key);
  for (const f of [rf, rf - 12, rf + 12, 0]) { if (f < 0) continue; const n = scaleNps(key, 'minorPent', f, 3); if (n && Math.max(...n.map(x => x.f)) <= 22) return n; }
  return null;
}
/** Hammer-on / pull-off marks for notes that stay on the same string. */
function legatoMarks(seq) {
  return seq.map(([s, f], i) => {
    const prev = seq[i - 1];
    if (!prev || prev[0] !== s || prev[1] === f) return [s, f, null];
    return [s, f, f > prev[1] ? 'h' : 'p'];
  });
}
function chordInfo(name) {
  const c = parseChord(name); if (!c) return null;
  return { name: c.name, pc: c.root.pc, pcs: chordTones(c.root, c.type).map(t => t.pc), type: c.type };
}

/* --------------------------- Eric Johnson style --------------------------- */
/** EJ-style descending sixes: two notes per string across three strings, then down a string. */
export function ejSixes(c, { legato = false } = {}) {
  const key = minorKey(c), B = byString(pentBox(key, 1));
  if (!B[1] || !B[6]) return null;
  const cell = (top, up) => {
    const strs = up ? [top + 2, top + 1, top] : [top, top + 1, top + 2];
    return strs.flatMap(s => (up ? [[s, B[s][0]], [s, B[s][1], legato ? 'h' : null]] : [[s, B[s][1]], [s, B[s][0], legato ? 'p' : null]]));
  };
  const down = [1, 2, 3, 4].flatMap(t => cell(t, false));
  const up = [4, 3, 2, 1].flatMap(t => cell(t, true));
  const notes = [...fromSeq(down, 1 / 6), ...fromSeq(up, 1 / 6, 4)];
  const k = nameOf(key);
  return make(c, {
    id: legato ? 'ej-sixes-legato' : 'ej-sixes', name: `${legato ? 'Legato' : 'Picked'} pentatonic sixes in ${k} minor (Eric Johnson style)`, domain: legato ? 'fretting' : 'picking',
    unit: '16th-note sextuplets', goal: 92, start: 48, minutes: 6, dl: 1, picking: legato ? 'alternate' : 'strict',
    why: 'Six-note cells (two notes on each of three strings) are the engine of Eric Johnson’s fast pentatonic runs: each beat is one cell, so the run stays locked to the click while it cascades across the strings.',
    instr: `Box 1 of ${k} minor pentatonic. Bar 1: one six-note cell per beat, starting on string 1, then 2, 3 and 4, always descending. Bar 2: the same cells climbing back up. Accent the first note of every beat so you can hear the sextuplets.${legato ? ' Pick only the first note on each string; pull off (down) or hammer on (up) the second.' : ' Strict alternate picking, every note picked.'}`,
    watch: 'Rushing the string changes so the cells turn into uneven 16ths.', simplify: 'One cell per beat on strings 1–3 only, looped.', tab: { notes }
  });
}

/** The descending six-note cell moved through all five boxes: speed pentatonics that travel up and down the neck. */
export function ejSixesAcross(c) {
  const key = minorKey(c), order = [1, 2, 3, 4, 5, 4, 3, 2];
  const seq = [];
  for (const b of order) {
    const B = byString(pentBox(key, b)); if (!B[1] || !B[3]) return null;
    seq.push([1, B[1][1]], [1, B[1][0], 'p'], [2, B[2][1]], [2, B[2][0], 'p'], [3, B[3][1]], [3, B[3][0], 'p']);
  }
  const k = nameOf(key);
  return make(c, {
    id: 'ej-sixes-across', name: `Speed pentatonics through all five boxes (${k} minor)`, domain: 'fretboard', unit: '16th-note sextuplets', goal: 88, start: 44, minutes: 6, dl: 2, picking: 'alternate',
    why: 'Eric Johnson’s runs don’t stay in one box: the same six-note cell slides from position to position, so a run can travel the whole neck at speed.',
    instr: `One descending six-note cell on strings 1–3 per beat, in box 1, then box 2, 3, 4, 5 and back down (4, 3, 2). Shift on the first note of each beat with the index or ring finger, light on the strings. Watch the fretboard under the tab to see the boxes go by.`,
    watch: 'Late position shifts that leave a gap at the start of the beat.', simplify: 'Boxes 1 and 2 only, two beats each.', tab: { notes: fromSeq(seq, 1 / 6) }
  });
}

/** Rolling 5s: five-note groups stepping through the scale, played in 16ths so the accent rolls across the beat. */
export function ejRolling5s(c, { dir = 'down', diagonal = false } = {}) {
  const key = minorKey(c);
  const pts = diagonal ? pent3nps(key) : pentBox(key, 1);
  if (!pts) return null;
  const line = (dir === 'down' ? pts.slice().reverse() : pts.slice()).map(p => [p.s, p.f]);
  const groups = Math.min(diagonal ? 12 : 8, line.length - 4);
  const seq = []; for (let i = 0; i < groups; i++) seq.push(...line.slice(i, i + 5));
  const marked = legatoMarks(seq).map((n, i) => (i % 5 === 0 ? [n[0], n[1], null] : n)); // pick the first note of every group
  const notes = fromSeq(marked, 0.25);
  // land on the root
  const rootNote = (dir === 'down' ? pts.slice() : pts.slice().reverse()).find(p => mod12(OPEN[p.s] + p.f) === key);
  const end = groups * 5 * 0.25, beats = Math.ceil((end + 1) / 4) * 4;
  if (rootNote) notes.push(N(rootNote.s, rootNote.f, end, beats - end));
  const k = nameOf(key);
  return make(c, {
    id: `ej-rolling5-${dir}${diagonal ? '-diag' : ''}`,
    name: `Rolling 5s ${dir === 'down' ? 'descending' : 'ascending'}${diagonal ? ' along the neck' : ', box 1'} (${k} minor)`,
    domain: 'picking', unit: '16th notes (groups of 5)', goal: diagonal ? 92 : 100, start: 50, minutes: 6, dl: diagonal ? 2 : 1, picking: 'alternate',
    why: 'Eric Johnson’s “rolling” runs group the pentatonic in fives but play it in 16ths: the group restarts on a different part of the beat each time, which gives the line its cascading, rolling sound.',
    instr: `Play five notes ${dir === 'down' ? 'down' : 'up'} the scale, then start again one note ${dir === 'down' ? 'lower' : 'higher'}: ${diagonal ? 'on the three-notes-per-string shape, so the run travels diagonally across the neck' : 'inside box 1'}. Accent the first note of each group of five while the click stays on quarter notes: the accent lands on a different 16th every time. Pick the first note of each group and each new string; slur the rest (marked h/p).`,
    watch: 'Turning the groups of five into groups of four, so the accent stops rolling.', simplify: 'Play it as quintuplets (five notes per click) at half tempo until the groups feel automatic.', tab: { notes }
  });
}

/** One spread triad (root – 5th – 10th) on a string set: 6 (root on string 6), 5 or 4. */
export function spreadVoicing(rootPc, type, set, near = 5) {
  const open = { 6: 40, 5: 45, 4: 50 }[set];
  let best = null;
  for (let f = 0; f <= 15; f++) if (mod12(open + f) === mod12(rootPc) && (best == null || Math.abs(f - near) < Math.abs(best - near))) best = f;
  if (best == null) return null;
  const f = best, third = type === 'min' || type === 'dim' ? -1 : 0, fifth = type === 'dim' ? 1 : 2;
  const top = { 6: [3, f + 1 + third], 5: [2, f + 2 + third], 4: [1, f + 2 + third] }[set];
  const tones = [[set, f], [set - 1, f + fifth], top];
  const frets = [null, null, null, null, null, null];
  tones.forEach(([s, fr]) => { frets[6 - s] = fr; });
  return { tones, frets, fret: f, set };
}
function spreadBar(v, t0, notes, { arpeggio = 'pinch' } = {}) {
  const [r, five, ten] = v.tones;
  if (arpeggio === 'pinch') {
    [r, five, ten, five].forEach(([s, f], i) => notes.push(N(s, f, t0 + i * 0.5, 0.5)));
    v.tones.forEach(([s, f]) => notes.push(N(s, f, t0 + 2, 2, null, { chord: true })));
  } else {
    [r, five, ten, five].forEach(([s, f], i) => notes.push(N(s, f, t0 + i * 0.5, 0.5)));
  }
}
const spreadName = (pc, type) => nameOf(pc) + (type === 'min' ? 'm' : type === 'dim' ? '°' : '');

/** Spread triads, major and minor, on three string sets. */
export function ejSpreadShapes(c, { root = null } = {}) {
  const pc = root != null ? root : (c.minor ? mod12(c.key) : mod12(c.key));
  const plan = [[6, 'maj', 5], [6, 'min', 5], [5, 'maj', 10], [5, 'min', 10], [4, 'maj', 7], [4, 'min', 7]];
  const notes = [], voicings = [], chords = [];
  plan.forEach(([set, type, near], i) => {
    const v = spreadVoicing(pc, type, set, near); if (!v) return;
    spreadBar(v, i * 4, notes);
    const nm = spreadName(pc, type); voicings.push({ name: nm, frets: v.frets }); chords.push(nm);
  });
  return make(c, {
    id: 'ej-spread-shapes', name: `Spread triads: ${nameOf(pc)} and ${nameOf(pc)}m on three string sets`, domain: 'fretboard', unit: '8th notes', goal: 100, start: 50, minutes: 5,
    why: 'A spread (open) triad puts the root, 5th and the 3rd an octave up (the 10th) on non-adjacent strings. It’s the wide, piano-like chord sound in Eric Johnson’s clean parts and melodies.',
    instr: 'Each bar: root, 5th, 10th, 5th as 8th notes, then pinch all three together for two beats. Strings in between stay muted by the fretting fingers. The only difference between major and minor is the top note: one fret lower for minor. Use the pick on the root and the middle and ring fingers on the upper notes (hybrid picking), or fingers only.',
    watch: 'The muted middle string ringing through.', simplify: 'Only the string-5 shapes.', voicings, chords, tab: { notes }
  });
}

/** Spread triads through a progression with the closest shape each time. */
export function ejSpreadProgression(c, { key = 9, degrees = [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] } = {}) {
  const notes = [], voicings = [], chords = [];
  let near = 5;
  degrees.forEach(([semi, type], bar) => {
    const pc = mod12(key + semi);
    const cands = [6, 5].map(set => spreadVoicing(pc, type, set, near)).filter(Boolean).filter(v => v.fret >= 1 && v.fret <= 12);
    const v = cands.sort((a, b) => Math.abs(a.fret - near) - Math.abs(b.fret - near))[0]; if (!v) return;
    near = v.fret;
    spreadBar(v, bar * 4, notes);
    const nm = spreadName(pc, type); voicings.push({ name: nm, frets: v.frets }); chords.push(nm);
  });
  return make(c, {
    id: 'ej-spread-prog', name: `Spread triads through ${chords.join(' – ')}`, domain: 'theory', unit: '8th notes', goal: 96, start: 50, minutes: 6,
    why: 'Moving spread triads between the string-6 and string-5 sets keeps the hand in one area of the neck, so the chords connect smoothly instead of jumping.',
    instr: 'One chord per bar: arpeggiate root–5th–10th–5th, then pinch the three notes. For each chord take the shape closest to the last one (the diagrams show which). Let the notes ring over each other in the arpeggio.',
    watch: 'Moving the whole hand when the next shape is one string set over.', simplify: 'Two chords only, looped.', voicings, chords, backing: chords, tab: { notes }
  });
}

/** The chords of a major key as spread triads, climbing string set 5-4-2. */
export function ejSpreadDiatonic(c, { key = 9 } = {}) {
  const deg = [[0, 'maj'], [2, 'min'], [4, 'min'], [5, 'maj'], [7, 'maj'], [9, 'min'], [12, 'maj']];
  const notes = [], voicings = [], chords = [];
  let t = 0;
  const base = fretOn(5, key, 0, 11);
  deg.forEach(([semi, type]) => {
    const pc = mod12(key + semi), v = spreadVoicing(pc, type, 5, base + semi); if (!v) return;
    const [r, five, ten] = v.tones;
    [r, five, ten, five].forEach(([s, f], i) => notes.push(N(s, f, t + i * 0.5, 0.5)));
    t += 2;
    const nm = spreadName(pc, type); voicings.push({ name: nm, frets: v.frets }); chords.push(nm);
  });
  const last = voicings.length ? spreadVoicing(key, 'maj', 5, base + 12) : null;
  if (last) last.tones.forEach(([s, f]) => notes.push(N(s, f, t, 2, null, { chord: true })));
  return make(c, {
    id: 'ej-spread-diatonic', name: `The chords of ${nameOf(key)} major as spread triads`, domain: 'theory', unit: '8th notes', goal: 104, start: 52, minutes: 5,
    why: 'Harmonizing the major scale in spread triads shows which chords live in the key and gives you a ready-made chord melody: the top notes spell out the scale.',
    instr: `I, ii, iii, IV, V and vi of ${nameOf(key)} major, then I an octave up, all on strings 5, 4 and 2. Two beats each: root, 5th, 10th, 5th. Say the chord name as you play it. Major shapes have the top note two frets above the root fret; minor shapes one fret.`,
    watch: 'Forgetting which chords are minor (ii, iii, vi).', simplify: 'I, IV and V only.', voicings, chords, tab: { notes }
  });
}

/** EJ-style pentatonic with the added 2nd and 4th (the “hexatonic” color), descending across two octaves. */
export function ejAddedNotes(c) {
  const key = minorKey(c);
  const pcs = [0, 2, 3, 5, 7, 10].map(x => mod12(key + x)); // minor pentatonic + 9
  const rf = rootFret6(key) || 12;
  const seq = [];
  for (let s = 1; s <= 6; s++) {
    const here = []; for (let f = rf - 1; f <= rf + 4; f++) if (f >= 0 && pcs.includes(mod12(OPEN[s] + f))) here.push(f);
    here.sort((a, b) => b - a).forEach((f, i) => seq.push([s, f, i ? 'p' : null]));
  }
  if (seq.length < 8) return null;
  const notes = fromSeq(seq.slice(0, 16), 0.25).concat(fromSeq(seq.slice(0, 16).reverse().map(([s, f]) => [s, f, null]), 0.25, 4));
  return make(c, {
    id: 'ej-added-9', name: `Pentatonic plus the 9th (${nameOf(key)} minor)`, domain: 'fretboard', unit: '16th notes', goal: 100, start: 50, minutes: 5,
    why: 'Adding the 2nd (9th) to the minor pentatonic gives the brighter, more open sound Eric Johnson uses in his runs, without leaving the familiar box.',
    instr: 'Descend through the box with the added note on each string (pull-offs marked p), then climb back up picking every note. Find the new notes: they sit two frets above each root.',
    watch: 'Dropping the added note when the tempo goes up.', simplify: 'The top three strings only.', tab: { notes }
  });
}

/* --------------------------- Eddie Van Halen style --------------------------- */
/** Tap – pull-off – hammer-on triplets that outline each chord on one string. */
export function evhTapTriplets(c, { chords = ['Am', 'F', 'G', 'E'], string = 2, sixteenths = false } = {}) {
  const notes = [], used = [];
  let t = 0;
  for (const name of chords) {
    const ch = chordInfo(name); if (!ch) continue;
    const frets = []; for (let f = 1; f <= 22; f++) if (ch.pcs.includes(mod12(OPEN[string] + f))) frets.push(f);
    const i = frets.findIndex(f => f >= 4 && f <= 10);
    if (i < 0 || i + 2 >= frets.length) continue;
    const [L, M, T] = [frets[i], frets[i + 1], frets[i + 2]];
    const cell = sixteenths ? [[T, 't'], [L, 'p'], [M, 'h'], [L, 'p']] : [[T, 't'], [L, 'p'], [M, 'h']];
    const step = sixteenths ? 0.25 : 1 / 3;
    for (let b = 0; b < 4; b++) cell.forEach(([f, x], k) => notes.push(N(string, f, t + b + k * step, step, x)));
    t += 4; used.push(ch.name);
  }
  if (!notes.length) return null;
  return make(c, {
    id: `evh-tap-${sixteenths ? '16' : '3'}-${slug(used.join(''))}`, name: `Tapped ${sixteenths ? '16th-note' : 'triplet'} arpeggios: ${used.join(' – ')} (Van Halen style)`, domain: 'fretting',
    unit: sixteenths ? '16th notes' : '8th-note triplets', goal: sixteenths ? 104 : 112, start: 50, minutes: 5, dl: 1,
    why: 'Eddie Van Halen made two-hand tapping a rock technique: the picking hand taps a high note, pulls off to a fretted note and the fretting hand hammers the next, so one string plays a whole chord at speed.',
    instr: `Tap (T) with the picking-hand middle or index finger, pull off sideways to the index finger's fret so the note sounds, then hammer the middle note. One chord per bar on string ${string}; the chord boxes show which notes you are outlining. Rest the picking-hand palm on the low strings to keep them quiet.`,
    watch: 'The tapped pull-off being weaker than the hammer: flick the string down toward the floor as you release.', simplify: 'Tap and pull-off only, in 8th notes, one chord.',
    chords: used, backing: used, tab: { notes }
  });
}

/** Tapped octave extensions of the pentatonic box. */
export function evhPentTap(c) {
  const key = minorKey(c), B = byString(pentBox(key, 1));
  if (!B[1] || B[1][0] + 12 > 22) return null;
  const notes = []; let t = 0;
  for (const s of [1, 2, 3, 2]) {
    const [a, b] = B[s];
    for (let r = 0; r < 2; r++) { notes.push(N(s, a + 12, t, 1 / 3, 't'), N(s, a, t + 1 / 3, 1 / 3, 'p'), N(s, b, t + 2 / 3, 1 / 3, 'h')); t += 1; }
  }
  return make(c, {
    id: 'evh-pent-tap', name: `Tapped pentatonic octaves (${nameOf(key)} minor, box 1)`, domain: 'fretting', unit: '8th-note triplets', goal: 112, start: 50, minutes: 5, dl: 1,
    why: 'Tapping the octave above the box turns a familiar pentatonic shape into wide, fast Van Halen-style licks without learning a new scale.',
    instr: 'On each string: tap 12 frets above the lower box note, pull off to it, hammer the upper box note. Two beats per string: 1, 2, 3, then back to 2.',
    watch: 'Tapping slightly off the fret (the tapped note goes sharp or dull).', simplify: 'String 1 only.', tab: { notes }
  });
}

/** Pull-offs to the open string through E minor: the open-string legato sound of early Van Halen. */
export function evhOpenPulloffs(c) {
  const em = [0, 2, 3, 5, 7, 8, 10].map(x => mod12(4 + x));
  const notes = []; let t = 0;
  for (const s of [1, 2]) {
    const frets = []; for (let f = 1; f <= 12; f++) if (em.includes(mod12(OPEN[s] + f))) frets.push(f);
    frets.slice(0, 7).forEach(f => { notes.push(N(s, f, t, 0.25), N(s, 0, t + 0.25, 0.25, 'p'), N(s, f, t + 0.5, 0.25, 'h'), N(s, 0, t + 0.75, 0.25, 'p')); t += 1; });
    notes.push(N(s, 12, t, 1)); t += 1;
  }
  return make(c, {
    id: 'evh-open-pulloffs', name: 'Pull-offs to the open string (E minor)', domain: 'fretting', unit: '16th notes', goal: 120, start: 60, minutes: 4,
    why: 'Pulling off to an open string is the fastest legato there is: one finger walks up the scale while the open E keeps the line moving, a sound all over early Van Halen.',
    instr: 'Pick the fretted note, pull off to the open string, hammer back on, pull off again: four 16ths per fret. Walk up E natural minor on string 1, then string 2.',
    watch: 'The open string getting quieter than the fretted note.', simplify: '8th notes, the first three frets.', tab: { notes }
  });
}

/* ---------------------------- Paul Gilbert style ---------------------------- */
/** Six-note two-string pentatonic cell, strict alternate picking (Paul Gilbert style). */
export function pgSixNote(c, { across = false } = {}) {
  const key = minorKey(c);
  const seq = [];
  if (!across) {
    const B = byString(pentBox(key, 1)); if (!B[1] || !B[5]) return null;
    for (const top of [1, 2, 3, 4]) {
      const lo = top + 1;
      const cell = [[lo, B[lo][0]], [lo, B[lo][1]], [top, B[top][0]], [top, B[top][1]], [top, B[top][0]], [lo, B[lo][1]]];
      for (let r = 0; r < 4; r++) seq.push(...cell);
    }
  } else {
    for (const b of [1, 2, 3, 4, 5, 4, 3, 2]) {
      const B = byString(pentBox(key, b)); if (!B[1]) return null;
      const cell = [[2, B[2][0]], [2, B[2][1]], [1, B[1][0]], [1, B[1][1]], [1, B[1][0]], [2, B[2][1]]];
      seq.push(...cell, ...cell);
    }
  }
  const k = nameOf(key);
  return make(c, {
    id: across ? 'pg-six-across' : 'pg-six-note', name: across ? `Six-note picking lick through all five boxes (${k} minor)` : `Six-note pentatonic picking lick on string pairs (${k} minor)`,
    domain: 'picking', unit: '16th-note sextuplets', goal: 100, start: 48, minutes: 5, dl: across ? 2 : 1, picking: 'strict',
    why: 'Paul Gilbert’s best-known speed drill is a six-note pentatonic cell on two strings, alternate picked: it trains the string change from the inside of the strings, where most picking breaks down.',
    instr: across ? 'The cell on strings 1–2, twice per box, moving through boxes 1 to 5 and back. Shift on the first note of each beat.' : 'The cell (two notes on the lower string, three on the upper, back to the lower) four times per bar, then down one string pair. Strict alternate picking starting with a downstroke; the pick has to jump between the strings on the string change.',
    watch: 'Using hammer-ons to hide a missed pick stroke.', simplify: 'The cell in 16th notes (four per beat) at a slow tempo.', tab: { notes: fromSeq(seq, 1 / 6) }
  });
}

/** String-skipped arpeggios on strings 4 and 2 (Paul Gilbert style). */
export function pgSkipArps(c, { chords = ['Am', 'F', 'C', 'G'] } = {}) {
  const seq = [], used = []; let near = 7;
  for (const name of chords) {
    const ch = chordInfo(name); if (!ch) continue;
    let r = null; for (let f = 2; f <= 14; f++) if (mod12(50 + f) === ch.pc && (r == null || Math.abs(f - near) < Math.abs(r - near))) r = f;
    if (r == null) continue; near = r;
    const third = ch.type === 'min' ? 3 : 4;
    const cell = [[4, r], [4, r + third], [2, r - 2], [2, r + 3], [2, r - 2], [4, r + third]];
    for (let k = 0; k < 4; k++) seq.push(...cell);
    used.push(ch.name);
  }
  if (!seq.length) return null;
  return make(c, {
    id: `pg-skip-${slug(used.join(''))}`, name: `String-skipped arpeggios: ${used.join(' – ')}`, domain: 'picking', unit: '16th-note sextuplets', goal: 92, start: 46, minutes: 6, dl: 2, picking: 'alternate',
    why: 'Skipping a string turns a plain triad into wide intervals: the angular arpeggio sound Paul Gilbert uses instead of sweeping, played with alternate picking.',
    instr: 'Each chord: root and 3rd on string 4, skip string 3, 5th and octave on string 2, back down. Four times per bar, one chord per bar. Alternate pick every note; mute string 3 with the underside of the fretting fingers.',
    watch: 'Clipping string 3 on the way over.', simplify: '16th notes and one chord.', chords: used, backing: used, tab: { notes: fromSeq(seq, 1 / 6) }
  });
}

/** The pentatonic box in groups of six, up and down. */
export function pgPent6s(c) {
  const key = minorKey(c), pts = pentBox(key, 1); if (!pts) return null;
  const up = pts.map(p => [p.s, p.f]), dn = up.slice().reverse();
  const seq = [];
  for (let i = 0; i + 6 <= up.length; i++) seq.push(...up.slice(i, i + 6));
  const half = seq.length;
  for (let i = 0; i + 6 <= dn.length; i++) seq.push(...dn.slice(i, i + 6));
  const notes = fromSeq(seq.slice(0, half), 1 / 6).concat(fromSeq(seq.slice(half), 1 / 6, 8));
  return make(c, {
    id: 'pg-pent-6s', name: `Pentatonic in groups of six (${nameOf(key)} minor)`, domain: 'picking', unit: '16th-note sextuplets', goal: 100, start: 48, minutes: 5, dl: 1, picking: 'alternate',
    why: 'Sequencing the pentatonic in sixes is a Paul Gilbert staple: each beat starts one note further along, so the line climbs steadily while every beat begins on a downstroke.',
    instr: 'Six notes up from the first note, then six up from the second, and so on to the top; then the same coming down. One group per beat, alternate picked.',
    watch: 'Losing the downstroke at the start of each beat.', simplify: 'Groups of four in 16ths.', tab: { notes }
  });
}

/** Three-notes-per-string pentatonic with wide stretches, alternate picked. */
export function pgStretchPent(c) {
  const key = minorKey(c), pts = pent3nps(key); if (!pts) return null;
  const up = pts.map(p => [p.s, p.f]), down = up.slice(0, -1).reverse();
  const notes = fromSeq([...up, ...down], 0.25);
  return make(c, {
    id: 'pg-stretch-pent', name: `Stretched pentatonic, three notes per string (${nameOf(key)} minor)`, domain: 'fretting', unit: '16th notes', goal: 108, start: 50, minutes: 5, dl: 1, picking: 'alternate',
    why: 'Three pentatonic notes per string means wide stretches but an even number of notes per string, which makes fast alternate picking and long runs across the neck easier.',
    instr: 'Up the shape and back down in 16ths, alternate picking. Thumb low behind the neck for the stretches; keep fingers close to the frets.',
    watch: 'Tension in the thumb on the widest stretches.', simplify: 'The top three strings.', tab: { notes }
  });
}

/* ------------------------------ Hendrix style ------------------------------ */
/** A 7♯9 funk-rock groove (the “Hendrix chord”), original pattern. */
export function hxSharp9(c) {
  const shapes = [{ name: 'E7♯9', frets: [null, 7, 6, 7, 8, null] }, { name: 'D7♯9', frets: [null, 5, 4, 5, 6, null] }];
  const hits = [[0, 0.5], [0.5, 0.5, 'm'], [1, 0.5], [1.75, 0.25], [2, 0.5, 'm'], [2.5, 0.5], [3, 0.5], [3.5, 0.5, 'm']];
  const notes = [];
  [0, 0, 1, 0].forEach((si, bar) => {
    const v = shapes[si];
    hits.forEach(([t, d, m]) => v.frets.forEach((f, i) => { if (f != null) notes.push(N(6 - i, f, bar * 4 + t, d, m ? 'pm' : null, { chord: true })); }));
  });
  return make(c, {
    id: 'hx-sharp9', name: 'The 7♯9 chord groove (Hendrix style)', domain: 'rhythm', unit: '16th notes', goal: 110, start: 60, minutes: 5,
    why: 'The dominant 7♯9 has the major 3rd and the minor 3rd (♯9) in one grip: the tense, bluesy chord Hendrix made famous in rock.',
    instr: 'Grip E7♯9 at the 7th fret (x7678x). Strum the rhythm; the hits marked PM are muted by relaxing the fretting hand, not by palm muting. Bar 3 moves the shape down two frets to D7♯9.',
    watch: 'Strings 1 and 6 ringing: touch them with the thumb and the underside of the index finger.', simplify: 'Quarter-note strums.',
    voicings: shapes, chords: shapes.map(s => s.name), backing: ['E7', 'E7', 'D7', 'E7'], tab: { notes }
  });
}

/** Octave melodies (strings 5 & 3, then 4 & 2). */
export function hxOctaves(c) {
  const key = minorKey(c);
  const degs = [0, 3, 5, 7, 10, 7, 5, 3];
  const notes = []; let t = 0;
  for (const [s, gap] of [[5, 2], [4, 3]]) {
    for (const d of degs) {
      const f = fretOn(s, mod12(key + d), 3, 15); if (f == null) continue;
      notes.push(N(s, f, t, 0.5, null, { chord: true }), N(s - 2, f + gap, t, 0.5, null, { chord: true })); t += 0.5;
    }
  }
  return make(c, {
    id: 'hx-octaves', name: `Octave melodies (${nameOf(key)} minor pentatonic)`, domain: 'fretting', unit: '8th notes', goal: 120, start: 60, minutes: 4,
    why: 'Octaves (one note doubled an octave up, with the string between muted) make a melody sound huge: a Hendrix and Wes Montgomery trademark.',
    instr: 'Index on the lower note, ring or pinky on the upper, the index finger’s underside mutes the string in between. Strum all three strings. Strings 5 & 3 are two frets apart; 4 & 2 are three frets apart (the B string shift).',
    watch: 'The middle string ringing.', simplify: 'Quarter notes on strings 5 & 3 only.', tab: { notes }
  });
}

/* ------------------------------- Shared specs ------------------------------- */
const W = (id, name, domain, unit, start, goal, why, instr, watch, simplify, minutes = 5) => ({ spec: { id, name, domain, unit, startBpm: start, goalBpm: goal, why, instr, watch, simplify, minutes } });

/* ----------------------------- Technique library ----------------------------- */
// Each technique: one or two skills, matched from the words of a request.
const S = (id, title, domain, summary, ex) => ({ id, title, domain, summary, ex });
const U = (title, summary, skills) => ({ title, summary, skills });

export const TECHNIQUES = [
  { id: 'rolling5s', title: 'Rolling 5s', re: /rolling (5|five)'?s?|groups? of (5|five)|\bin (5|five)s\b|quintuplet/, domain: 'picking',
    summary: 'Pentatonic in groups of five, played in 16ths so the accent rolls across the beat.',
    skills: [S('rolling5s-box', 'Rolling 5s in box 1', 'picking', 'Groups of five down and up the box.', [c => ejRolling5s(c, { dir: 'down' }), c => ejRolling5s(c, { dir: 'up' })]),
      S('rolling5s-neck', 'Rolling 5s along the neck', 'picking', 'The same groups on the diagonal three-notes-per-string shape.', [c => ejRolling5s(c, { dir: 'down', diagonal: true })])] },
  { id: 'speedPent', title: 'Speed pentatonics', re: /speed pentatonic|fast pentatonic|pentatonic (speed|runs?|sextuplets?|sixes)|sextuplets?|pentatonic sixes|\bsixes\b/, domain: 'picking',
    summary: 'Six-note cells on three strings, one per beat, in one box and then across all five.',
    skills: [S('speedpent-cells', 'Pentatonic sixes', 'picking', 'The six-note cell, picked and legato.', [c => ejSixes(c), c => ejSixes(c, { legato: true })]),
      S('speedpent-across', 'Speed pentatonics across the neck', 'fretboard', 'The cell through all five boxes.', [c => ejSixesAcross(c)])] },
  { id: 'spreadTriads', title: 'Spread triads', re: /spread(-| )?triads?|open(-| )?(voiced )?triads?|wide triads?|spread voicings?|10ths?\b|tenths/, domain: 'theory',
    summary: 'Root, 5th and 10th on non-adjacent strings: shapes, the chords of a key, and progressions.',
    skills: [S('spread-shapes', 'Spread triad shapes', 'fretboard', 'Major and minor on three string sets.', [c => ejSpreadShapes(c, { root: 9 })]),
      S('spread-use', 'Spread triads in a key', 'theory', 'Diatonic chords and a progression in spread voicings.', [c => ejSpreadDiatonic(c, { key: 9 }), c => ejSpreadProgression(c, { key: 9 })])] },
  { id: 'hexatonic', title: 'Pentatonic plus the 9th', re: /hexatonic|added (2nd|9th|ninth)|pentatonic (\+|plus|with) (the )?(2|9|2nd|9th)/, domain: 'fretboard',
    summary: 'The minor pentatonic with the 2nd added: a brighter, more open run.',
    skills: [S('hexatonic', 'Pentatonic plus the 9th', 'fretboard', 'The added note in box 1.', [c => ejAddedNotes(c)])] },
  { id: 'tapping', title: 'Two-hand tapping', re: /tapping|tapped|two.?hand(ed)? tap|\btaps?\b|eruption/, domain: 'fretting',
    summary: 'Tap–pull–hammer arpeggios on one string, and tapped extensions of the pentatonic.',
    skills: [S('tap-triplets', 'Tapped triplet arpeggios', 'fretting', 'Tap, pull off, hammer: one chord per bar.', [c => evhTapTriplets(c), c => evhTapTriplets(c, { sixteenths: true, chords: ['Am', 'G', 'F', 'E'] })]),
      S('tap-pent', 'Tapped pentatonic octaves', 'fretting', 'The box with a tapped note an octave up.', [c => evhPentTap(c)])] },
  { id: 'openPulls', title: 'Open-string pull-offs', re: /open.?string (pull|legato)|pull.?offs? to (the )?open/, domain: 'fretting',
    summary: 'Legato against the open string.', skills: [S('open-pulls', 'Pull-offs to the open string', 'fretting', 'One finger walks the scale; the open string keeps the line moving.', [c => evhOpenPulloffs(c)])] },
  { id: 'pgSix', title: 'The six-note picking lick', re: /paul gilbert lick|gilbert lick|six.?note (lick|pattern|cell)|6.?note (lick|pattern|cell)/, domain: 'picking',
    summary: 'A two-string pentatonic cell that trains inside string changes.',
    skills: [S('pg-six', 'Six-note picking lick', 'picking', 'On every string pair, then through the boxes.', [c => pgSixNote(c), c => pgSixNote(c, { across: true })])] },
  { id: 'skipArps', title: 'String-skipped arpeggios', re: /string.?skip/, domain: 'picking',
    summary: 'Triads with a skipped string, alternate picked.', skills: [S('skip-arps', 'String-skipped arpeggios', 'picking', 'Root and 3rd on string 4, 5th and octave on string 2.', [c => pgSkipArps(c)])] },
  { id: 'pent6s', title: 'Pentatonic in sixes', re: /pentatonic in (6|six)'?s|groups? of (6|six)/, domain: 'picking',
    summary: 'The box in six-note sequences.', skills: [S('pent-6s', 'Pentatonic in groups of six', 'picking', 'One group per beat, up and down.', [c => pgPent6s(c)])] },
  { id: 'stretchPent', title: 'Stretched pentatonic', re: /(3|three).?notes?.?per.?string pentatonic|stretch(ed)? pentatonic|pentatonic stretch/, domain: 'fretting',
    summary: 'Three notes per string for long, even runs.', skills: [S('stretch-pent', 'Three-notes-per-string pentatonic', 'fretting', 'Wide stretches, alternate picked.', [c => pgStretchPent(c)])] },
  { id: 'sharp9', title: 'The 7♯9 chord', re: /7.?(♯|#|sharp) ?9|hendrix chord/, domain: 'rhythm',
    summary: 'The Hendrix chord in a groove.', skills: [S('sharp9', 'The 7♯9 groove', 'rhythm', 'Grip, rhythm and moving it.', [c => hxSharp9(c)])] },
  { id: 'octaves', title: 'Octaves', re: /octaves?/, domain: 'fretting',
    summary: 'Melodies in octaves with the middle string muted.', skills: [S('octaves', 'Octave melodies', 'fretting', 'Strings 5 & 3, then 4 & 2.', [c => hxOctaves(c)])] }
];
export const TECHNIQUE_BY_ID = Object.fromEntries(TECHNIQUES.map(t => [t.id, t]));
const techSkills = (...ids) => ids.flatMap(id => TECHNIQUE_BY_ID[id].skills);

/** Techniques named in a request, in the order they appear. */
export function matchTechniques(text) {
  const t = String(text || '').toLowerCase();
  return TECHNIQUES.map(x => { const m = t.match(x.re); return m ? { x, at: m.index } : null; }).filter(Boolean).sort((a, b) => a.at - b.at).map(m => m.x);
}

/* ------------------------------- The artists ------------------------------- */
const BLUES_LEAD = 'Use the Songs tab to learn the real thing: add the song, paste or import a tab, and the app turns it into section lessons.';
export const ARTISTS = [
  { id: 'eric-johnson', name: 'Eric Johnson', wiki: ['Eric Johnson (guitarist)'], genre: 'rock', re: /eric johnson|\bej\b/,
    blurb: 'Violin-like tone, cascading pentatonic runs, rolling 5s and wide spread-triad chords.',
    techniques: ['Speed pentatonics', 'Rolling 5s', 'Spread triads', 'Pentatonic plus the 9th', 'Position shifting'],
    ctx: { key: 9, minor: true, prog: 'minorRock' },
    units: [
      U('Pentatonic sixes', 'The six-note cell that drives his fast runs, in one box.', [techSkills('speedPent')[0]]),
      U('Rolling 5s', 'Groups of five against a 16th-note pulse.', techSkills('rolling5s')),
      U('Across the neck', 'Speed pentatonics through all five boxes, and the added 9th.', [techSkills('speedPent')[1], ...techSkills('hexatonic')]),
      U('Spread triads', 'The wide, open chord sound of his clean playing.', techSkills('spreadTriads')),
      U('Putting it together', 'Runs and chords in real music.', [
        S('ej-solo', 'Cascading runs in a solo', 'improv', 'Drop sixes and rolling 5s into phrases with space.', [['callResponse', { chords: '$minorRock', scale: 'minorPent' }], ['targetSolo', { chords: '$axis' }, { minor: false, key: 9 }]]),
        S('ej-clean', 'Spread-triad chord melody', 'theory', 'Clean chord parts with a melody on top.', [c => ejSpreadProgression(c, { key: 4, degrees: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']] })])])
    ],
    riffs: [
      { title: 'Cliffs of Dover', note: 'Fast pentatonic runs and wide intervals; his best-known instrumental.' },
      { title: 'Manhattan', note: 'Clean chordal playing with spread voicings.' },
      { title: 'Desert Rose', note: 'Clean arpeggiated chords and melodic lines.' },
      { title: 'Trademark', note: 'Pentatonic speed runs over a rock groove.' },
      { title: 'Zap', note: 'Instrumental full of fast pentatonic and position-shifting lines.' },
      { title: 'S.R.V.', note: 'Texas blues-rock tribute with pentatonic runs.' }
    ] },
  { id: 'van-halen', name: 'Eddie Van Halen', wiki: ['Eddie Van Halen'], genre: 'rock', re: /van halen|\bevh\b|eddie van|eruption/,
    blurb: 'Two-hand tapping, open-string legato, tight palm-muted riffs and fearless whammy work.',
    techniques: ['Two-hand tapping', 'Tapped pentatonic', 'Open-string pull-offs', 'Palm-muted riffs', 'Harmonics'],
    ctx: { key: 4, minor: true, prog: 'minorRock' },
    units: [
      U('Tapping basics', 'Tap, pull off, hammer on: one string, one chord at a time.', [techSkills('tapping')[0]]),
      U('Open-string legato', 'Fast, slurred lines against the open string.', techSkills('openPulls')),
      U('Tapping and the pentatonic', 'Tapped octaves on the box you already know.', [techSkills('tapping')[1]]),
      U('The riffs', 'Palm-muted power chords with a push.', [
        S('evh-riff', 'Palm-muted rock riffs', 'rhythm', 'Tight downstrokes and syncopated power chords.', [['powerRiff', { rhythm: 'drive' }], ['powerRiff', { rhythm: 'synco' }]]),
        S('evh-harm', 'Harmonics and pinch harmonics', 'picking', 'The squeals and chimes between riffs.', [W('evh-harmonics', 'Natural, tapped and pinch harmonics', 'picking', 'one per beat', 50, 90,
          'Harmonics are part of the Van Halen sound: natural ones at frets 12, 7 and 5, tapped ones 12 frets above a fretted note, and pinch harmonics that make a single note scream.',
          'One per click: natural harmonics at 12, 7 and 5 on strings 3–1; then hold a power chord and tap 12 frets above it (touch and release, don’t press); then pinch harmonics: let the thumb edge graze the string right after the pick.',
          'Pressing the tapped harmonic down to the fret.', 'Natural harmonics only.')])]),
      U('Putting it together', 'Taps, legato and speed in a solo.', [
        S('evh-speed', 'Speed bursts and tremolo', 'picking', 'Short, fast bursts between licks.', [['speedBurst'], ['scaleRun', { scale: 'blues', box: 1, unit: '16ths' }]]),
        S('evh-solo', 'Tapping in a solo', 'improv', 'Answer a phrase with a tapped lick.', [['callResponse', { chords: '$minorRock' }], c => evhTapTriplets(c, { chords: ['Em', 'C', 'D', 'B'] })])])
    ],
    riffs: [
      { title: 'Eruption', note: 'The tapping showcase.' }, { title: 'Ain\'t Talkin\' \'bout Love', note: 'Arpeggiated riff with a heavy groove.' },
      { title: 'Panama', note: 'Driving riff with open strings.' }, { title: 'Hot for Teacher', note: 'Fast shuffle riff and tapping.' },
      { title: 'Runnin\' with the Devil', note: 'Simple, heavy power-chord riff.' }, { title: 'Unchained', note: 'Drop-D riff with harmonics.' }
    ] },
  { id: 'paul-gilbert', name: 'Paul Gilbert', wiki: ['Paul Gilbert'], genre: 'rock', re: /paul gilbert|\bgilbert\b|racer x/,
    blurb: 'Machine-gun alternate picking, the six-note pentatonic lick, string skipping and wide stretches.',
    techniques: ['Strict alternate picking', 'Six-note pentatonic lick', 'String-skipped arpeggios', 'Pentatonic in sixes', 'Wide stretches'],
    ctx: { key: 9, minor: true, prog: 'minorRock' },
    units: [
      U('Picking foundations', 'Small motions, every note picked.', [
        S('pg-chrom', 'Chromatic alternate picking', 'picking', 'Four fingers, four frets, every note picked.', [{ spec: { libId: 'spider-1234', id: 'spider-1234', name: 'Chromatic picking climb', domain: 'picking', minutes: 5, instr: 'Strict alternate picking, starting with a downstroke, then again starting with an upstroke. One finger per fret.', watch: 'Picking from the elbow: keep the motion small.', simplify: 'Two strings only.', startBpm: 60, goalBpm: 120 } }])]),
      U('The six-note lick', 'His signature two-string picking cell.', techSkills('pgSix')),
      U('Sequences', 'Pentatonic in sixes and on stretched shapes.', [...techSkills('pent6s'), ...techSkills('stretchPent')]),
      U('String skipping', 'Wide-interval arpeggios without sweeping.', [...techSkills('skipArps'), S('pg-skip-scale', 'Skipping through the scale', 'picking', 'Strings 4 and 2 through the scale.', [['stringSkip']])]),
      U('Putting it together', 'Speed lines that still phrase.', [
        S('pg-sync', 'Hand sync at speed', 'picking', 'Bursts that stay clean.', [['speedBurst', { scale: 'minorPent' }], ['scaleRun', { scale: 'minor', nps: 3, unit: '16ths', pattern: 'fours' }]]),
        S('pg-solo', 'Picking licks in a solo', 'improv', 'Drop the six-note lick into phrases.', [['callResponse', { chords: '$minorRock' }]])])
    ],
    riffs: [
      { title: 'Technical Difficulties', artist: 'Racer X', note: 'Alternate-picking and arpeggio showcase.' },
      { title: 'Scarified', artist: 'Racer X', note: 'Fast picked lines and string skipping.' },
      { title: 'Daddy, Brother, Lover, Little Boy', artist: 'Mr. Big', note: 'Fast unison picking runs.' },
      { title: 'Green-Tinted Sixties Mind', artist: 'Mr. Big', note: 'Tapped arpeggio intro.' },
      { title: 'Addicted to That Rush', artist: 'Mr. Big', note: 'Fast picked riffing.' },
      { title: 'Get Out of My Yard', note: 'Instrumental full of his picking vocabulary.' }
    ] },
  { id: 'srv', name: 'Stevie Ray Vaughan', wiki: ['Stevie Ray Vaughan'], genre: 'blues', re: /stevie ray|\bsrv\b|vaughan/,
    blurb: 'Texas shuffle, huge bends with a wide vibrato, raking and double-stop fills.',
    techniques: ['Texas shuffle', 'Wide bends and vibrato', 'Double-stops', 'Raking'],
    ctx: { key: 4, minor: true, prog: 'blues' },
    units: [
      U('The shuffle', 'The Texas shuffle groove.', [S('srv-shuffle', 'Texas shuffle', 'rhythm', 'Swung 8ths with bass and chord stabs.', [['shuffleRiff'], ['strumPattern', { chords: '$blues', pattern: 'rock8', swing: true }]])]),
      U('The E box', 'Box 1 in open position and at the 12th fret.', [S('srv-box', 'E blues scale', 'fretboard', 'Open position and 12th fret.', [['scaleRun', { scale: 'blues', box: 1 }], ['scaleRun', { scale: 'minorPent', box: 1, pattern: 'threes' }]])]),
      U('Bends and vibrato', 'Big, in-tune bends with a wide vibrato.', [S('srv-bend', 'Bends and vibrato', 'fretting', 'Whole-step bends with two or three fingers.', [['bendLick'], ['vibratoHolds']]),
        S('srv-rake', 'Raking into notes', 'picking', 'A muted rake into the target.', [W('srv-rake', 'Rakes into bends', 'picking', 'one per beat', 50, 90,
          'Raking the pick across muted strings before the target note gives his attack its percussive bite.', 'Mute the strings below the target with the fretting hand, drag the pick through them in one motion, land on the bent note on the beat.', 'The muted strings sounding pitches.', 'Rake into an unbent note.')])]),
      U('Double-stops', 'Two-note fills between vocal lines.', [S('srv-ds', 'Double-stop fills', 'fretting', 'Rhythmic double-stops on the top strings.', [['doubleStopRnR'], ['doubleStops', { interval: '3rds' }]])]),
      U('Putting it together', 'Phrasing over a shuffle and a slow blues.', [S('srv-solo', 'Blues phrasing', 'improv', 'Call and response, chord targets.', [['callResponse', { chords: '$blues' }], ['targetSolo', { chords: '$slowBlues' }]])])
    ],
    riffs: [{ title: 'Pride and Joy', note: 'The Texas shuffle.' }, { title: 'Texas Flood', note: 'Slow blues phrasing.' }, { title: 'Lenny', note: 'Clean chord melody.' },
      { title: 'Scuttle Buttin\'', note: 'Fast pentatonic shuffle instrumental.' }, { title: 'Couldn\'t Stand the Weather', note: 'Funky riff and rhythm part.' }] },
  { id: 'hendrix', name: 'Jimi Hendrix', wiki: ['Jimi Hendrix'], genre: 'classic-rock', re: /hendrix|\bjimi\b/,
    blurb: 'Chord embellishments, the 7♯9 chord, octaves, thumb-over grips and vocal bends.',
    techniques: ['Chord embellishments', 'The 7♯9 chord', 'Octaves', 'Bends and vibrato'],
    ctx: { key: 4, minor: true, prog: 'minorRock' },
    units: [
      U('Rhythm with melody', 'Chords decorated with hammer-ons and fills.', [S('hx-emb', 'Chord embellishments', 'fretting', 'Hammer-ons inside the chord shape.', [['embellish', { chords: ['E', 'A', 'D', 'A'] }], ['embellish', { chords: ['Em', 'G', 'Am', 'Em'] }]])]),
      U('The 7♯9', 'The Hendrix chord.', techSkills('sharp9')),
      U('Octaves', 'Big, simple melodies.', techSkills('octaves')),
      U('Bends and vibrato', 'Vocal bends.', [S('hx-bend', 'Bends and vibrato', 'fretting', 'Bends to pitch, wide vibrato.', [['bendLick'], ['vibratoHolds']])]),
      U('Putting it together', 'Lead and rhythm as one part.', [S('hx-solo', 'Pentatonic phrasing', 'improv', 'Licks and fills over a vamp.', [['callResponse', { chords: '$minorRock' }], ['doubleStops', { interval: '3rds' }]])])
    ],
    riffs: [{ title: 'Little Wing', note: 'Chord embellishments.' }, { title: 'Purple Haze', note: 'The 7♯9 chord.' }, { title: 'Voodoo Child (Slight Return)', note: 'Wah riff and pentatonic lead.' },
      { title: 'Hey Joe', note: 'Bass-line riff and chord fills.' }, { title: 'The Wind Cries Mary', note: 'Chord embellishments.' }, { title: 'Foxy Lady', note: 'The 7♯9 and bends.' }] },
  { id: 'gilmour', name: 'David Gilmour', wiki: ['David Gilmour'], genre: 'classic-rock', re: /gilmour|pink floyd/,
    blurb: 'Slow, singing phrasing, perfectly pitched bends and pre-bends, and space.',
    techniques: ['Bends and pre-bends', 'Vibrato', 'Pentatonic phrasing', 'Space'],
    ctx: { key: 11, minor: true, prog: 'minorRock' },
    units: [
      U('The box', 'B minor pentatonic, played slowly.', [S('dg-box', 'B minor pentatonic', 'fretboard', 'Box 1 in triplets.', [['scaleRun', { scale: 'minorPent', box: 1, unit: 'triplets' }], ['connectPositions', { scale: 'minorPent', from: 1, to: 2 }]])]),
      U('Bends in tune', 'Every bend lands on pitch.', [S('dg-bend', 'Bends to pitch', 'fretting', 'Check each bend against the fretted target.', [['bendLick'], W('dg-prebend', 'Pre-bends and releases', 'fretting', 'one per 2 beats', 50, 80,
        'Bending silently, then picking and releasing, makes a note fall into place: a Gilmour signature.', 'Bend the G string at fret 14 up a whole step without picking, then pick and release slowly over two beats. Check the pre-bend against fret 16.', 'Pre-bends that start sharp or flat.', 'Half-step pre-bends.')])]),
      U('Vibrato', 'Slow, wide vibrato.', [S('dg-vib', 'Vibrato', 'fretting', 'Even, slow vibrato on held notes.', [['vibratoHolds']])]),
      U('Color', 'The Dorian 6th.', [S('dg-dorian', 'Minor pentatonic vs Dorian', 'theory', 'Adding the 2nd and 6th.', [['modeCompare', { modes: ['minor', 'dorian'] }]])]),
      U('Putting it together', 'Fewer notes, more meaning.', [S('dg-solo', 'Slow phrasing', 'improv', 'Space between phrases.', [['callResponse', { chords: '$minorRock' }], ['targetSolo', { chords: '$slowBlues' }]])])
    ],
    riffs: [{ title: 'Comfortably Numb', artist: 'Pink Floyd', note: 'Bends and slow phrasing.' }, { title: 'Shine On You Crazy Diamond', artist: 'Pink Floyd', note: 'Slow, singing lead.' },
      { title: 'Time', artist: 'Pink Floyd', note: 'Bends and pentatonic phrasing.' }, { title: 'Money', artist: 'Pink Floyd', note: 'Riff in 7/4 and solo.' },
      { title: 'Wish You Were Here', artist: 'Pink Floyd', note: 'Acoustic intro lick.' }] }
];
export const ARTIST_BY_ID = Object.fromEntries(ARTISTS.map(a => [a.id, a]));
export const ARTIST_NOTE = BLUES_LEAD;

/** The artist named in a text (or null). */
export function matchArtist(text) {
  const t = String(text || '').toLowerCase();
  return t ? ARTISTS.find(a => a.re.test(t)) || null : null;
}

/** Artists as master-class topics (built from the lessons above, no API). */
export const ARTIST_TOPICS = ARTISTS.map(a => ({
  id: 'artist-' + a.id, artist: a.id, title: `${a.name} style`, blurb: a.blurb, domain: a.units[0].skills[0].domain, cat: 'artist',
  re: a.re, ctx: a.ctx, units: a.units
}));

/** All lessons of an artist, flattened: [{unit, skill, ex}] built for a level. */
export function artistLessons(artist, lvl = 4, run) {
  const out = [];
  artist.units.forEach((u, ui) => u.skills.forEach(s => s.ex.forEach(e => {
    const c = { key: artist.ctx.key, minor: !!artist.ctx.minor, lvl: Math.max(1, Math.min(10, lvl - 1 + Math.round(ui * 3 / Math.max(1, artist.units.length - 1)))), genre: artist.genre, prog: artist.ctx.prog };
    const ex = run(c, e, s);
    if (ex) out.push({ unit: u, skill: s, ex });
  })));
  return out;
}
