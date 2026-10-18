// The six-note Paul Gilbert lick: three notes up the B string, one on the high e, two back down the B
// string, looped with strict alternate picking. At the 12th fret: B 12–13–15, e 12, B 15–13, then
// B 12 again (the player's specification, 2026-10-11: the player is the authority on this pattern).
// A fixed left-hand pattern (not a pentatonic-box cell): from the pieces of the loop at the 12th fret,
// through its three left-hand shapes, to moving it up and down the whole neck by fret and by position
// in a key, the skipped-string and inside-picking (mirror) versions, every key, performance tempo and
// an original study.
//
// Concept-first (CONTENT.md): the model is a LOOP of six notes on two strings, defined by
//   - a FORM, each an exact six-note rule:
//       'six'    the lick: B-string notes a b c (low to high), e-string note x, B-string notes c b;
//       'mirror' the inside-picking mirror: e-string notes c' b' a' (high to low), the B-string note a
//                perfect 4th below a' (under the same finger), e-string notes a' b';
//       'skip'   the skipped-string version: G-string notes a b c, e-string note x, G-string notes c b
//                (the B string is skipped);
//   - a SHAPE: the frets of the three same-string notes above the index finger: half–whole [0,1,3],
//     whole–half [0,2,3] or whole–whole [0,2,4]. In any major or minor key, three consecutive scale
//     notes on one string always form one of these three shapes, so the lick moves through a key by
//     changing shape;
//   - a PLACEMENT: one fret, a chromatic walk (the same shape moved fret by fret: no key, a pure
//     left-hand pattern) or a diatonic walk (by position: the next scale note of the key each time,
//     the shape adapting so every note stays in the key).
// Six notes and strict alternate picking: down–up–down on the way up the B string, up on the high e,
// down–up on the way back, so every loop starts on a downstroke. In the lick both string changes are
// "outside" (down on the B then up on the e, up on the e then down on the B: the pick goes around the
// pair); in the mirror both are "inside". The composer `lick(c, spec)` builds an exercise from form ×
// shape × placement × note value × loops per position × key plan; every note is tagged with what it
// must be (a shape offset or a scale tone) for the pitch check.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-18: the outside string change
// on its own (two notes on one string, then two notes on two strings, Paul Gilbert's own order), the
// lick in pieces and joined, the three shapes, first music; then in time, along the neck by fret and by
// position, the inside-picked mirror, over changes; then sextuplets, the skipped string, keys; then
// performance tempo and a study. Removed: naming the shape by ear with the tab covered (`pglick-hear`),
// the "from memory" shape drill (`pglick-recall`), saying shapes, keys or chord tones aloud and covering
// the tab (`pglick-key-up`, `pglick-called`, `pglick-phrase`, `pglick-12-keys`), and "read only the
// names" in `pglick-random` (now mixed bars played from the tab).
import { OPEN, N, nameOf, make, mod12, S, stage, entry, M, targetGuide } from '../lib.js';
import { rng, endOf } from './alternatePicking.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const SHAPES = { HW: [0, 1, 3], WH: [0, 2, 3], WW: [0, 2, 4] };
export const SHAPE_NAME = { HW: 'half–whole', WH: 'whole–half', WW: 'whole–whole' };
export const FORM_NAME = { six: 'the lick', mirror: 'the mirror', skip: 'the skipped-string lick' };
const SCALE = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };
const DEG = { minor: ['R', '2', '♭3', '4', '5', '♭6', '♭7'], major: ['R', '2', '3', '4', '5', '6', '7'] };
/** For the pitch check: what each note must be ({base, rel} offsets from a pitch, or {key, scale}). */
export const ALLOW = new WeakMap();
const UNIT = new Map([[0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const unitOf = step => UNIT.get(step) || '16th notes';
const stepFor = lvl => (lvl <= 6 ? 1 / 3 : lvl <= 8 ? 0.25 : 1 / 6);
const keyName = c => `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`;
const scaleOf = c => (c.minor ? 'minor' : 'major');
const pcsOf = (k, sc) => SCALE[sc].map(x => mod12(k + x));
/** The index of the note the loop "arrives" on (the e-string note x, or a' in the mirror). */
const topIx = form => (form === 'mirror' ? 2 : 3);

/** One loop at a fixed fret and shape (index finger at fret f). */
export function fixedLoop(form, shape, f) {
  const sh = SHAPES[shape]; if (!sh) return null;
  const [a, b, c3] = sh.map(x => f + x);
  if (form === 'six') return { notes: [[2, a], [2, b], [2, c3], [1, f], [2, c3], [2, b]], shape, f, allow: { base: pitch(2, f), rel: [...sh, 5] } };
  if (form === 'mirror') return { notes: [[1, c3], [1, b], [1, a], [2, f], [1, a], [1, b]], shape, f, allow: { base: pitch(2, f), rel: [0, ...sh.map(x => x + 5)] } };
  if (form === 'skip') return { notes: [[3, a], [3, b], [3, c3], [1, f], [3, c3], [3, b]], shape, f, allow: { base: pitch(3, f), rel: [...sh, 9] } };
  return null;
}
/** The scale tones of a key as MIDI pitches from E2 up. */
function ladder(k, sc) { const out = []; for (let m = 40; m <= 90; m++) if (pcsOf(k, sc).includes(mod12(m))) out.push(m); return out; }
/** Shape id from the two steps between three consecutive scale tones. */
const shapeFrom = (a, b, c3) => ({ '1,2': 'HW', '2,1': 'WH', '2,2': 'WW' })[`${b - a},${c3 - b}`] || null;
/**
 * One loop by position in a key: x = the index of the anchor note in the key's ladder.
 * six: three consecutive scale notes on the B string (L[x], L[x+1], L[x+2]), the next one (L[x+3]) on
 * the e, then L[x+2], L[x+1] on the B. mirror: L[x+5], L[x+4], L[x+3] on the e, L[x] on the B, then
 * L[x+3], L[x+4] on the e. skip: L[x], L[x+1], L[x+2] on the G, the first scale note at least a major
 * 6th above L[x] on the e, then L[x+2], L[x+1] on the G.
 */
export function keyLoop(k, sc, form, x) {
  const L = ladder(k, sc), allow = { key: k, scale: sc };
  if (form === 'six') {
    const [a, b, c3, d] = [L[x], L[x + 1], L[x + 2], L[x + 3]]; if (d == null) return null;
    const B = m => [2, m - OPEN[2]];
    return { notes: [B(a), B(b), B(c3), [1, d - OPEN[1]], B(c3), B(b)], shape: shapeFrom(a, b, c3), f: a - OPEN[2], first: a, allow };
  }
  if (form === 'mirror') {
    const [a, d, e2, f2] = [L[x], L[x + 3], L[x + 4], L[x + 5]]; if (f2 == null) return null;
    const E = m => [1, m - OPEN[1]];
    return { notes: [E(f2), E(e2), E(d), [2, a - OPEN[2]], E(d), E(e2)], shape: shapeFrom(d, e2, f2), f: a - OPEN[2], first: a, allow };
  }
  if (form === 'skip') {
    const [a, b, c3] = [L[x], L[x + 1], L[x + 2]]; const top = L.find(m => m >= a + 9); if (top == null || c3 == null) return null;
    const G = m => [3, m - OPEN[3]];
    return { notes: [G(a), G(b), G(c3), [1, top - OPEN[1]], G(c3), G(b)], shape: shapeFrom(a, b, c3), f: a - OPEN[3], first: a, allow };
  }
  return null;
}
const okFrets = lp => lp && lp.notes.every(([, f]) => f >= 1 && f <= 22);
/** Ladder indexes of key positions whose anchor note sits on its string between frets lo and hi. */
function positionsIn(k, sc, form, lo, hi) {
  const L = ladder(k, sc), s = form === 'skip' ? 3 : 2, out = [];
  L.forEach((m, x) => { const f = m - OPEN[s]; if (f >= lo && f <= hi) { const lp = keyLoop(k, sc, form, x); if (okFrets(lp)) out.push(x); } });
  return out;
}
/** The position nearest a fret (optionally with its anchor on a given degree of the key). */
export function nearestPos(k, sc, form, near = 12, degIx = null) {
  const L = ladder(k, sc), s = form === 'skip' ? 3 : 2; let best = null;
  L.forEach((m, x) => {
    if (degIx != null && mod12(m - k) !== SCALE[sc][degIx]) return;
    const lp = keyLoop(k, sc, form, x); if (!okFrets(lp)) return;
    const d = Math.abs(m - OPEN[s] - near); if (!best || d < best.d) best = { x, d };
  });
  return best ? best.x : null;
}
const degName = (k, sc, m) => DEG[sc][SCALE[sc].indexOf(mod12(m - k))];
/** Push the notes of a loop, cycling, for `beats` beats from t0 (stops on whole notes of the grid). */
function putLoop(notes, lp, step, t0, beats, extra = null) {
  let t = t0, i = 0;
  while (t < t0 + beats - 1e-6) { const [s, f] = lp.notes[i % lp.notes.length]; const n = N(s, f, t, step, null, extra && i < 6 ? { pick: i % 2 ? 'u' : 'd' } : null); ALLOW.set(n, lp.allow); notes.push(n); t += step; i++; }
  return t;
}
const tagged = (lp, s, f, t, d, x) => { const n = N(s, f, t, d, x); ALLOW.set(n, lp.allow); return n; };

/* ------------------------------- The composer ------------------------------- */
/**
 * spec: { id, name, method, domain, form | forms (cycled per position), shape | shapes (cycled), place:
 * 'fixed' | 'chrom' | 'key', at (fret), frets ([from, to] for chrom: there and back unless oneWay),
 * lo/hi (key walk range, up then back unless oneWay; down: reversed), positions (ladder offsets from
 * the position nearest `at`), keys (key offsets for a key walk, one block each), cycles (loops per
 * position), step, marks, why, instr, watch, simplify, goal, start, dl, backing }.
 */
export function lick(c, spec) {
  const step = spec.step || stepFor(c.lvl || 4), cyc = spec.cycles || 2, plan = [];
  const forms = spec.forms || [spec.form || 'six'];
  if (spec.place === 'key') {
    const keys = spec.keys || [0];
    keys.forEach((off, ki) => {
      const k = mod12(c.key + off), sc = scaleOf(c), form0 = forms[0];
      let xs;
      if (spec.positions) { const x0 = nearestPos(k, sc, form0, spec.at || 12); if (x0 == null) return; xs = spec.positions.map(d => x0 + d); }
      else { const up = positionsIn(k, sc, form0, spec.lo || 1, spec.hi || 17); xs = spec.oneWay ? up : [...up, ...up.slice(0, -1).reverse()]; if (spec.down) xs = xs.slice().reverse(); }
      xs.forEach((x, i) => { const form = forms[(i + ki) % forms.length]; const lp = keyLoop(k, sc, form, x); if (okFrets(lp)) plan.push({ ...lp, form, k, sc }); });
    });
  } else {
    const shapes = spec.shapes || [spec.shape || 'HW'];
    let frets = [spec.at || 12];
    if (spec.place === 'chrom') { const [a, b] = spec.frets; const up = []; for (let f = a; a <= b ? f <= b : f >= b; f += a <= b ? 1 : -1) up.push(f); frets = spec.oneWay ? up : [...up, ...up.slice(0, -1).reverse()]; }
    const n = Math.max(frets.length, shapes.length, forms.length);
    for (let i = 0; i < n; i++) { const form = forms[i % forms.length], lp = fixedLoop(form, shapes[i % shapes.length], frets[i % frets.length]); if (okFrets(lp)) plan.push({ ...lp, form }); }
  }
  if (!plan.length) return null;
  const notes = []; let t = 0;
  const maxNotes = 380;
  for (const p of plan) {
    for (let r = 0; r < cyc; r++) p.notes.forEach(([s, f], j) => {
      if (notes.length >= maxNotes) return;
      const extra = spec.marks !== false && r === 0 && (p === plan[0] || spec.marks === 'all') ? { pick: j % 2 ? 'u' : 'd' } : null;
      const n = N(s, f, t, step, null, extra); ALLOW.set(n, p.allow); notes.push(n); t += step;
    });
  }
  // land: hold the last loop's arrival note (the e-string note) to the end of the bar
  const last = plan[plan.length - 1], land = last.notes[topIx(last.form)];
  const t0 = endOf(notes), end = Math.max(t0 + 1, Math.ceil((t0 + 1) / 4) * 4);
  notes.push(tagged(last, land[0], land[1], t0, end - t0, '~'));
  const where = plan.map(p => (p.form === 'skip' ? `G${p.f}` : `B${p.f}`));
  const shapesUsed = [...new Set(plan.map(p => p.shape).filter(Boolean))];
  const fill = s => String(s).replace('{key}', keyName(c)).replace('{shapes}', shapesUsed.map(x => SHAPE_NAME[x]).join(', ')).replace('{where}', where.slice(0, 16).join(' → ') + (where.length > 16 ? ' …' : ''));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'picking', method: spec.method, unit: unitOf(step), goal: spec.goal || 100, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'strict',
    shape: plan.length === 1 || shapesUsed.length === 1 ? shapesUsed[0] : null, neck: spec.place !== 'fixed' && plan.length >= 6,
    ...(spec.backing ? { backing: spec.backing, chords: spec.backing } : {}),
    why: fill(spec.why), instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
/** The declared structure of each form (see content/REQUESTS.md, 2026-10-11 "Stop wrong signature patterns"). */
export const PATTERN = {
  six: { name: 'The Paul Gilbert lick', notesPerString: '3 up the B string, 1 on the high e, 2 back down the B string', stringOrder: 'B B B e B B', picking: 'strict alternate: D U D U D U, every loop starts down; both string changes outside', sources: ['player specification 2026-10-11', 'https://www.guitarworld.com/lessons/intense-rock-picking-a-brief-look-at-paul-gilberts-alternate-picking-technique'], confirmed: 'player' },
  mirror: { name: 'Mirror of the lick (a derived drill, not a Paul Gilbert pattern)', notesPerString: '3 down the e string, 1 on the B, 2 back up the e', stringOrder: 'e e e B e e', picking: 'strict alternate: D U D U D U; both string changes inside', sources: ['derived from the six-note lick'], confirmed: 'derived' },
  skip: { name: 'Skipped-string lick (a derived drill)', notesPerString: '3 up the G string, 1 on the high e, 2 back down the G', stringOrder: 'G G G e G G', picking: 'strict alternate: D U D U D U', sources: ['derived from the six-note lick'], confirmed: 'derived' }
};
const L_ = (id, name, method, opts) => c => { const x = lick(c, { id, name, method, ...opts }); const fs = [...new Set(opts.forms || [opts.form || 'six'])]; return x ? { ...x, pattern: fs.length === 1 ? PATTERN[fs[0]] : fs.map(f => PATTERN[f]) } : x; };
const HOW = 'Six notes per loop: up the B string (index, then middle or ring, then pinky), the high e under the index finger (roll it across), then back down the B string (pinky, middle or ring) and round again from the index. Strict alternate picking: down–up–down on the way up, up on the e, down–up on the way back, so every loop starts on a downstroke; both string changes go around the outside of the pair. ';
const HOW_M = 'The mirror, six notes per loop: down the e string (pinky, middle or ring, index), the B string under the index (roll it), then back up the e (index, middle or ring) and round again from the pinky. Strict alternate picking from a downstroke; both string changes are now inside: the pick stays between the B and e strings. ';

/* ------------------------------ Generators ------------------------------ */
/**
 * The lick in pieces at the 12th fret (chunking), in the order the player learns it:
 * 'b3' the three B-string notes; 'e' add the high e (four notes); 'turn' the two string changes and
 * the way back (B 15, e 12, B 15, 13); the whole loop is the next lesson.
 */
export function lickParts(c, { part = 'b3' } = {}) {
  const lp = fixedLoop('six', 'HW', 12), [a, b, c3, x] = lp.notes, step = (c.lvl || 1) <= 1 ? 0.5 : 1 / 3;
  const P = {
    b3: { cell: [a, b, c3], reps: 8, id: 'pglick-b3', name: 'The lick in pieces, 1: the three B-string notes (frets 12–13–15)', why: 'The lick starts with three notes up the B string. Looping them alone puts the fretting fingers (index, middle, pinky) in place before anything else is added.', instr: 'Index on fret 12, middle on 13, pinky on 15 of the B string, up and round again. Alternate picking; with three notes per loop the first stroke changes each time (down, then up), which is fine for this step. Pass: 8 loops even and clean, twice in a row.', watch: 'Lifting the index finger off fret 12 while the pinky plays: keep it down.' },
    e: { cell: [a, b, c3, x], reps: 8, id: 'pglick-add-e', name: 'The lick in pieces, 2: add the high e (B 12–13–15, e 12)', why: 'The second piece adds the string change: after the downstroke on B 15, the upstroke takes the high e at fret 12, under the index finger. Four notes per loop, so each loop starts on a downstroke.', instr: 'B 12 (down), 13 (up), 15 (down), then e 12 (up) with the index rolled flat across both strings, and round again. Pass: 8 loops where the e note is as loud as the others.', watch: 'Hitting the B string again on the way to the e: aim the upstroke at the e alone.' },
    turn: { cell: [c3, x, c3, b], reps: 8, id: 'pglick-turn', name: 'The lick in pieces, 3: the turn and the way back (B 15, e 12, B 15–13)', why: 'The third piece is the end of the lick: up to the e and straight back down the B string. Both string changes go around the outside of the pair (down on the B then up on the e, up on the e then down on the B).', instr: 'B 15 (down), e 12 (up), B 15 (down), B 13 (up), and round again. Keep the pick motion small: the wrist carries the pick around the outside of the two strings. Pass: 8 bars where all four notes are equally loud.', watch: 'Skipping the second B 15: the way back starts on the same fret the way up ended on.' }
  }[part];
  const notes = []; let t = 0;
  for (let r = 0; r < P.reps; r++) P.cell.forEach(([s, f], i) => { const n = N(s, f, t, step, null, r === 0 ? { pick: i % 2 ? 'u' : 'd' } : null); ALLOW.set(n, lp.allow); notes.push(n); t += step; });
  const end = Math.ceil((t + 1) / 4) * 4; notes.push(tagged(lp, P.cell[0][0], P.cell[0][1], t, end - t));
  return make(c, {
    id: P.id, name: P.name, domain: 'picking', method: 'chunking', unit: unitOf(step), goal: 96, start: 50, minutes: 3, picking: 'strict',
    why: P.why, instr: P.instr, watch: P.watch, simplify: 'Quarter notes, as slowly as needed.', shape: 'HW', tab: { notes }
  });
}
/**
 * The outside string change on its own, in Paul Gilbert's order (his "Color TVs" and "Refrigerators"):
 * two notes on the B string (12, 15), then the same top note and the high e (B 15, e 12) looped, which
 * makes every string change an outside one, then the two back to back.
 */
export function changeDrill(c) {
  const lp = fixedLoop('six', 'HW', 12), step = (c.lvl || 1) <= 1 ? 0.5 : 0.25, notes = [];
  const one = [[2, 12], [2, 15]], two = [[2, 15], [1, 12]];
  const plan = [one, one, two, two, one, two, one, two];
  let t = 0;
  plan.forEach((cellNotes, bar) => { for (let i = 0; i < 4 / step / 2; i++) cellNotes.forEach(([s, f], j) => { const n = N(s, f, t, step, null, bar < 4 && i === 0 ? { pick: j ? 'u' : 'd' } : null); ALLOW.set(n, lp.allow); notes.push(n); t += step; }); });
  notes.push(tagged(lp, 2, 12, t, 4));
  return make(c, {
    id: 'pglick-change', name: 'The outside string change on its own: two notes on the B string, then B 15 and e 12', domain: 'picking', method: 'chunking', unit: unitOf(step), goal: 104, start: 56, minutes: 4, picking: 'strict',
    why: 'Paul Gilbert teaches the string change before any lick: two notes on one string, then the same two strokes on two neighbouring strings. Looping B 15 (down) and e 12 (up) makes both changes outside ones, the exact motion the lick uses twice per loop, with nothing else to think about.',
    instr: 'Bars 1–2: B 12 and B 15, down–up, over and over. Bars 3–4: B 15 down, e 12 up (index rolled flat across both strings), over and over: the pick goes around the outside of the two strings each time. Bars 5–8: one bar of each, back to back. Start slowly with an even rhythm; keep the motion small. Pass: the 8 bars twice with every note equally loud and no other string sounding.',
    watch: 'Hitting the B string again on the way to the e, or the e on the way back to the B.', simplify: 'Bars 3–4 only, in quarter notes.', shape: 'HW', tab: { notes }
  });
}
/** The lick in the key's position nearest fret 12 anchored on the 5th, looped, then the root held: over a groove (use in music). */
export function lickGroove(c) {
  const k = c.key, sc = scaleOf(c), x = nearestPos(k, sc, 'six', 12, 4); if (x == null) return null;
  const lp = keyLoop(k, sc, 'six', x), step = (c.lvl || 2) <= 2 ? 1 / 3 : 1 / 6, notes = [];
  const chords = c.minor ? [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'] : [nameOf(k), nameOf(k + 9) + 'm', nameOf(k + 5), nameOf(k + 7)];
  const e = lp.notes[3];
  for (let b = 0; b < 4; b++) {
    if (b % 2 === 0) putLoop(notes, lp, step, b * 4, 4);
    else notes.push(tagged(lp, e[0], e[1], b * 4, 3, '~'));
  }
  return make(c, {
    id: 'pglick-groove', name: `First music: the lick resolving to the root (${keyName(c)}, ${SHAPE_NAME[lp.shape]} at fret ${lp.f})`, domain: 'improv', method: 'transfer', unit: unitOf(step), goal: 92, start: 50, minutes: 5, picking: 'strict',
    backing: chords, chords, shape: lp.shape,
    why: `Anchored on the 5th of the key (${nameOf(lp.first)}), the lick climbs ${degName(k, sc, lp.first)}–${degName(k, sc, lp.first + (lp.notes[1][1] - lp.notes[0][1]))}–${degName(k, sc, lp.first + (lp.notes[2][1] - lp.notes[0][1]))} on the B string to the root on the e, then turns back: the e-string note is the root. That is why the lick sounds finished when you stop on it.`,
    instr: 'Bar 1: the lick looped in time. Bar 2: stop on the high-e note (the root) and hold it with vibrato. Same again over the next two chords. Then vary it: loop it for a whole bar, or stop after one loop. Pass: 4 bars in time with the held root landing on beat 1.',
    watch: 'Rushing into the held note: the loop ends exactly on the bar line.', simplify: 'One loop, then the held note.', tab: { notes }
  });
}
/** Each bar a key position whose anchor note is a chord tone of that bar's chord, near the last one (use in music). */
export function lickChanges(c, { prog = null, id = 'pglick-phrase', name = null, form = 'six', step = null } = {}) {
  const k = c.key, sc = scaleOf(c); step = step || ((c.lvl || 5) <= 6 ? 1 / 3 : 1 / 6);
  const degs = prog || (c.minor ? [[0, 'm'], [8, ''], [10, ''], [0, 'm']] : [[0, ''], [9, 'm'], [5, ''], [7, '']]);
  const chords = degs.map(([d, q]) => nameOf(k + d) + q), L = ladder(k, sc), notes = []; let at = 12;
  for (let b = 0; b < degs.length; b++) {
    const root = mod12(k + degs[b][0]), tones = [root, mod12(root + (degs[b][1] === 'm' ? 3 : 4)), mod12(root + 7)];
    let best = null;
    L.forEach((m, x) => { if (!tones.includes(mod12(m))) return; const lp = keyLoop(k, sc, form, x); if (!okFrets(lp)) return; const d = Math.abs(lp.f - at); if (!best || d < best.d) best = { lp, d }; });
    if (!best) return null; at = best.lp.f;
    putLoop(notes, best.lp, step, b * 4, 3);
    const land = best.lp.notes[0]; notes.push(tagged(best.lp, land[0], land[1], b * 4 + 3, 1, '~'));
  }
  return make(c, {
    id, name: name || `The lick over ${chords.join(' – ')}: a new position for every chord (${keyName(c)})`, domain: 'improv', method: 'transfer', unit: unitOf(step), goal: 96, start: 52, minutes: 6, picking: 'strict', backing: chords, chords,
    why: 'Moved by position inside the key, the lick follows the harmony: each bar starts the lick on a note of that bar’s chord, so the fast loop always begins on a strong, consonant note, and the held note on beat 4 points to the next chord.',
    instr: 'Each bar: three beats of the lick in the position shown, then hold its first note on beat 4 while moving to the next position (always a short move). Pass: the four bars twice in time, then your own choice of positions over the same chords.',
    watch: 'Jumping to a far position: pick the chord tone nearest the hand.', simplify: 'One loop per bar and half the tempo.', tab: { notes }
  });
}
/** A random form, shape and fret every bar (interleaving). */
export function lickRandom(c) {
  const r = rng(733 + (c.lvl || 9)), notes = [], names = [];
  for (let b = 0; b < 8; b++) {
    const form = ['six', 'mirror'][Math.floor(r() * 2)], sh = ['HW', 'WH', 'WW'][Math.floor(r() * 3)], f = 3 + Math.floor(r() * 13);
    const lp = fixedLoop(form, sh, f); names.push(`${form === 'six' ? 'lick' : 'mirror'} ${SHAPE_NAME[sh]} at ${f}`);
    putLoop(notes, lp, 1 / 6, b * 4, 3);
    const top = lp.notes[topIx(form)]; notes.push(tagged(lp, top[0], top[1], b * 4 + 3, 1));
  }
  return make(c, {
    id: 'pglick-random', name: 'Mixed bars: the lick or its mirror, a new shape and fret every bar', domain: 'fretboard', method: 'interleaving', unit: '16th-note sextuplets', goal: 92, start: 52, minutes: 5, picking: 'strict',
    why: 'At mastery level any version of the lick should come out on demand. Changing form, shape and position every bar, once each is secure, is the hardest and most useful way to practise that.',
    instr: `${names.join(' → ')}. Three beats of loops in sextuplets (one loop per beat), then the arrival note on beat 4 while you move to the next bar. Pass: all 8 bars at the goal tempo without a stop.`,
    watch: 'Starting the mirror on the B string: it begins at the top of the e-string shape.', simplify: 'The first four bars.', tab: { notes }
  });
}
/** All 12 keys around the cycle of fourths, each in the position nearest the last (interleaving). */
export function lickTwelveKeys(c) {
  const sc = scaleOf(c), notes = [], names = []; let at = 12;
  for (let i = 0; i < 12; i++) {
    const k = mod12(c.key + 5 * i), x = nearestPos(k, sc, 'six', at, 4); if (x == null) return null;
    const lp = keyLoop(k, sc, 'six', x); at = lp.f; names.push(`${nameOf(k)} (${SHAPE_NAME[lp.shape]}, fret ${lp.f})`);
    putLoop(notes, lp, 1 / 6, i * 4, 3);
    const e = lp.notes[3]; notes.push(tagged(lp, e[0], e[1], i * 4 + 3, 1, '~'));
  }
  return make(c, {
    id: 'pglick-12-keys', name: `All 12 ${sc} keys around the cycle of fourths: the lick from the 5th to the root`, domain: 'fretboard', method: 'interleaving', unit: '16th-note sextuplets', goal: 96, start: 54, minutes: 6, picking: 'strict',
    why: 'In every key, the lick anchored on the 5th climbs to the root on the e string. Finding that position in a new key each bar, close to where the hand already is, turns the lick into vocabulary you can use in any song.',
    instr: `Each bar: a new key (up a 4th), three loops (one per beat) and the root held, each position close to the last. The plan: ${names.join(' → ')}. Pass: all 12 keys in time without a stop.`,
    watch: 'Jumping back to the 12th fret every time: stay near the last position.', simplify: 'The first four keys.', tab: { notes }
  });
}
/** An original 8-bar study on the lick (capstone). */
export function lickEtude(c) {
  const k = c.key, sc = scaleOf(c), notes = [];
  let ps = null, MI = null, SK = null;
  for (const near of [12, 9, 14, 7, 5]) {
    const x5 = nearestPos(k, sc, 'six', near, 4); if (x5 == null) continue;
    const P = d => { const lp = keyLoop(k, sc, 'six', x5 + d); return okFrets(lp) ? lp : null; };
    MI = [0, -1, 1, -2].map(d => keyLoop(k, sc, 'mirror', x5 + d)).find(okFrets); SK = [-2, 0, -1, 1].map(d => keyLoop(k, sc, 'skip', x5 + d)).find(okFrets);
    for (const offs of [[0, 1, 2, -1, -2], [0, -1, -2, 1, 2], [0, 1, 2, -1, 3]]) { ps = offs.map(P); if (!ps.some(x => !x)) break; }
    if (!ps.some(x => !x) && okFrets(MI) && okFrets(SK)) break; ps = null;
  }
  if (!ps) return null;
  const T = 1 / 3, X = 1 / 6, e0 = ps[0].notes[3];
  putLoop(notes, ps[0], T, 0, 2); notes.push(tagged(ps[0], e0[0], e0[1], 2, 2, '~'));                          // bar 1: one loop, the root held
  putLoop(notes, ps[1], T, 4, 2); putLoop(notes, ps[2], T, 6, 2);                                                // bar 2: up two positions
  putLoop(notes, MI, X, 8, 4);                                                                                    // bar 3: the mirror, four loops
  putLoop(notes, SK, T, 12, 2); { const e = SK.notes[3]; notes.push(tagged(SK, e[0], e[1], 14, 2, '~')); }       // bar 4: the skipped-string lick
  [ps[2], ps[1], ps[0], ps[3]].forEach((lp, i) => putLoop(notes, lp, X, 16 + i, 1));                              // bar 5: down by position, a loop a beat
  putLoop(notes, ps[4], X, 20, 2); putLoop(notes, ps[3], X, 22, 2);                                               // bar 6
  putLoop(notes, ps[0], X, 24, 4);                                                                                // bar 7: home, full speed
  notes.push(tagged(ps[0], e0[0], e0[1], 28, 4, '~'));                                                            // bar 8: the root
  const chords = c.minor ? [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'] : [nameOf(k), nameOf(k + 9) + 'm', nameOf(k + 5), nameOf(k + 7)];
  return make(c, {
    id: 'pglick-etude', name: `Capstone study: an 8-bar piece on the Paul Gilbert lick (${keyName(c)})`, domain: 'improv', method: 'transfer', unit: '8th-note triplets, then sextuplets', goal: 92, start: 52, minutes: 8, picking: 'strict',
    backing: [...chords, ...chords], chords,
    why: 'An original piece that uses the whole path: the lick resolving to the root, moved up by position, the inside-picked mirror, the skipped-string version, then the lick falling down the positions at a loop per beat and home to the root.',
    instr: 'Learn it two bars at a time, then join them. Bars 1, 2 and 4 in triplets (one loop every two beats); bars 3 and 5–7 in sextuplets (one loop per beat): the same pulse, twice the speed. Strict alternate picking, every loop starting down. Then write your own 8 bars on the same plan. Pass: the study at the goal tempo with no stops, then your own version played through once.',
    watch: 'Tension when the sextuplets start: keep the motion small, only faster.', simplify: 'Bars 1–4 only.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'pgLick', kind: 'technique', title: 'The six-note Paul Gilbert lick', domain: 'picking',
  re: /paul gilbert lick|gilbert lick|\bpg lick|three notes on the b string/,
  aliases: ['Paul Gilbert lick', 'Gilbert lick', 'six-note Paul Gilbert lick'],
  pedagogy: {
    date: '2026-10-18',
    summary: 'Taught as a string-change drill before it is a lick: the outside change on its own (two notes on one string, then two notes on two strings, alternate picked from a downstroke), then the six-note loop in pieces and joined, slowly and evenly with the first note accented; then the same loop in time, in the other left-hand shapes, moved along the neck and through a key, with the inside-picked version for the other kind of string change; then sextuplets, string skipping and other keys, and finally speed with small motions and musical use. Paul Gilbert himself calls the lick hard for beginners, so the sources start from the single motion.',
    sequence: [
      { id: 'change', tier: 'foundations', step: 'The outside string change on its own', how: 'Two notes on one string alternate picked from a downstroke, then the same two strokes on two neighbouring strings (outside: the pick never goes between them), then both back to back; slow, even, small motions; accent the loop.', skills: ['pglick-change'], source: 0 },
      { id: 'pieces', tier: 'foundations', step: 'The six-note group in pieces, then joined', how: 'Practise each small group of notes separately before linking them; then the whole six-note loop, counting clean repetitions.', skills: ['pglick-parts'], source: 1 },
      { id: 'shapes', tier: 'foundations', step: 'The other left-hand shapes', how: 'The same picking over the half–whole, whole–half and whole–whole fingerings at the 12th fret (the player’s specification); a one-finger-per-fret hand.', skills: ['pglick-shapes'], source: 4 },
      { id: 'music1', tier: 'foundations', step: 'First musical use', how: 'The figure in a phrase over a groove, ending on a held note.', skills: ['pglick-first-music'], source: 0 },
      { id: 'time', tier: 'intermediate', step: 'In time, accents and groupings', how: 'The six-note group in triplets, then in 16ths across the beat with the accent on the click; shapes mixed.', skills: ['pglick-time'], source: 1 },
      { id: 'shift', tier: 'intermediate', step: 'Along the neck: by fret and by position', how: 'Runs that move the group across positions, shifting with the whole hand on the first note.', skills: ['pglick-frets', 'pglick-positions'], source: 1 },
      { id: 'inside', tier: 'intermediate', step: 'The inside-picked version', how: 'The same two strings with the strokes reversed (inside picking), then outside and inside alternated, so both kinds of string change are practised.', skills: ['pglick-mirror'], source: 2 },
      { id: 'music2', tier: 'intermediate', step: 'Over a progression', how: 'The figure placed on chord tones over a progression; bursts in a solo.', skills: ['pglick-music-i'], source: 1 },
      { id: 'speed', tier: 'advanced', step: 'Speed with small motions, the whole neck', how: 'Sextuplets on a tempo ladder; a relaxed hand, the pick clearing the string it just left with the smallest motion that works.', skills: ['pglick-speed'], source: 3 },
      { id: 'skip', tier: 'advanced', step: 'String skipping', how: 'The same picking with a string skipped, the skipped string muted.', skills: ['pglick-skip'], source: 1 },
      { id: 'keys', tier: 'advanced', step: 'Other keys and positions', how: 'The figure moved by position in other keys around the cycle; jumps between positions.', skills: ['pglick-keys'], source: 1 },
      { id: 'music3', tier: 'advanced', step: 'In a rock solo', how: 'Fast bursts between long notes over rock progressions.', skills: ['pglick-music-a'], source: 1 },
      { id: 'tempo', tier: 'mastery', step: 'Performance tempo', how: 'The whole neck and the inside version at speed, a few BPM at a time.', skills: ['pglick-perf'], source: 3 },
      { id: 'any', tier: 'mastery', step: 'Any form, shape and key', how: 'A new version every bar; all 12 keys.', skills: ['pglick-anywhere'], source: 1 },
      { id: 'own', tier: 'mastery', step: 'Your own music', how: 'A study that combines the versions, then your own solo.', skills: ['pglick-voice'], source: 1 }
    ],
    drills: ['Two notes on one string, then two notes on two strings, outside picked (Paul Gilbert’s order)', 'The six-note loop in pieces, then joined, counting clean loops', 'The first note of each loop accented', 'The loop in triplets, then 16ths across the beat with the click accented', 'One shape moved fret by fret; the loop moved through a key by position', 'Inside-picked version and outside/inside alternated', 'String-skipped version with the skipped string muted', 'Sextuplets on a tempo ladder'],
    mistakes: ['Hitting the string just left (the pick not clearing it): noise at every change', 'Starting with the full loop at speed: the lick is hard for beginners, build it from the single change', 'An extra or missing stroke on the way back from the e, so the loop stops starting on a downstroke', 'The B string ringing under the e note: keep the index rolled flat to mute it', 'Big, tense motions at speed instead of the same small motion faster', 'A small pause before the lone e-string note or at the shifts'],
    sources: [
      { title: 'Shred Your Enthusiasm: How to Practice Pole-Vaulting', author: 'Paul Gilbert (Premier Guitar)', url: 'https://www.premierguitar.com/articles/Shred_Your_Enthusiasm_How_to_Practice_Pole-Vaulting' },
      { title: '10 Steps to Master Alternate Picking Technique For Guitar', author: 'Rob Thorpe (Fundamental Changes)', url: 'https://www.fundamental-changes.com/guitar-alternate-picking-technique/' },
      { title: 'Inside and Outside Picking on the Guitar (Guitar Rhythm and Techniques For Dummies)', author: 'Desi Serna', url: 'https://www.dummies.com/article/academics-the-arts/music/instruments/guitar/inside-and-outside-picking-on-the-guitar-143479' },
      { title: '"Intense Rock" Picking: A Brief Look at Paul Gilbert’s Alternate Picking Technique', author: 'Troy Grady (Guitar World)', url: 'https://www.guitarworld.com/lessons/intense-rock-picking-a-brief-look-at-paul-gilberts-alternate-picking-technique' },
      { title: 'Paul Gilbert: What I learned and taught at GIT', author: 'Paul Gilbert (Guitar World)', url: 'https://guitarworld.com/lessons/artist-lessons/paul-gilbert-git-lesson' },
      { title: 'The Paul Gilbert Lick (forum thread: learning it slowly, muting the B string, timing at the string changes)', author: 'Cracking the Code forum', url: 'https://forum.troygrady.com/t/the-paul-gilbert-lick/30497' }
    ]
  },
  summary: 'Three notes up the B string, one on the high e, two back down the B string (B 12–13–15, e 12, B 15–13 at the 12th fret), looped with strict alternate picking: learned in pieces, in three left-hand shapes, then moved up and down the whole neck by fret and by position, with the skipped-string and inside-picked mirror versions, in every key, to performance tempo.',
  prereqs: ['alternatePicking'],
  sources: ['https://www.guitarworld.com/lessons/intense-rock-picking-a-brief-look-at-paul-gilberts-alternate-picking-technique', 'https://www.premierguitar.com/articles/Shred_Your_Enthusiasm_How_to_Practice_Pole-Vaulting', 'https://www.fundamental-changes.com/guitar-alternate-picking-technique/', 'https://www.dummies.com/article/academics-the-arts/music/instruments/guitar/inside-and-outside-picking-on-the-guitar-143479', 'https://guitarworld.com/lessons/artist-lessons/paul-gilbert-git-lesson', 'https://forum.troygrady.com/t/inside-gilbert-lick-on-youtube-mini-lesson/97006', 'https://forum.troygrady.com/t/the-paul-gilbert-lick/30497', 'https://forum.troygrady.com/t/haha-paul-gilbert-admits-that-the-paul-gilbert-lick-is-too-hard-for-beginners/8197', 'https://www.guitarplayer.com/technique/paul-gilbert-gives-a-classic-lesson-in-shred-tab-audio'],
  ctx: { key: 4, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The lick at the 12th fret',
      'Loop the six-note lick at the 12th fret (B 12–13–15, e 12, B 15–13) in all three shapes as 8th-note triplets at 100 BPM with strict alternate picking (every loop starting down) and the first note of each loop accented, and use it to resolve to the root over a minor groove.', [
        S('pglick-change', 'The outside string change', 'picking', 'Two notes on one string, then on two strings; accents on the loop.', [c => changeDrill(c),
          L_('pglick-accent', 'Accent the first note of every loop (half–whole at the 12th fret)', 'external-focus', { place: 'fixed', form: 'six', shape: 'HW', at: 12, cycles: 8, step: 1 / 3, goal: 104, start: 54, why: 'An accent on the first note of each loop (B 12, a downstroke) marks where the loop starts and keeps it locked to the beat: in triplets the accent falls on every other click. Listening for that accent tells you at once if a stroke went missing.', instr: HOW + 'Accent B 12 every time, the other five notes lighter and even. Pass: 8 loops in a row with the accent on every other click.', watch: 'The accent drifting to the e-string note, which is often the loudest by accident.', simplify: '8th notes (one loop every three beats), accent still on B 12.' })],
          ST('Changing strings is the hard part of alternate picking: after a downstroke the pick sits on the wrong side of the next string. In an outside change the pick goes around the pair (down on the lower string, up on the higher one), never between them.', 'The lick has two outside changes per loop; making that one motion reliable first is what lets the whole loop speed up later.', ['Down on B 15, up on e 12: the pick travels around the outside of the B and e strings.', 'Keep the index finger rolled flat across both strings so the B string is muted while the e sounds.', 'Six notes per loop with alternate picking: the accent (a downstroke) falls on the same note every time.'])),
        S('pglick-parts', 'The lick in pieces', 'picking', 'The three B-string notes, add the e, add the way back, then the whole loop.', [c => lickParts(c, { part: 'b3' }), c => lickParts(c, { part: 'e' }), c => lickParts(c, { part: 'turn' }),
          L_('pglick-hw', 'The Paul Gilbert lick, joined: half–whole shape at the 12th fret (B 12–13–15, e 12, B 15–13)', 'accurate-reps', { place: 'fixed', form: 'six', shape: 'HW', at: 12, cycles: 8, step: 1 / 3, goal: 110, start: 56, why: 'The three pieces joined into the six-note loop. Clean repetitions at a slow tempo build the motion you will keep at speed, and with six notes per loop every repeat starts on a downstroke.', instr: HOW + 'In triplets, one loop takes two beats. Count only the clean loops. Pass: 8 clean loops in a row, twice.', watch: 'An extra stroke, or a missed B 15, on the way back from the e.', simplify: 'Quarter notes, or go back to the pieces.' })],
          ST('The lick is a fixed left-hand pattern of six notes: three up the B string (index, middle or ring, pinky), one on the high e under the index finger, and two back down the B string (pinky, then middle or ring), looped. With strict alternate picking a six-note loop always starts on a downstroke.', 'It is one of the most useful speed builders there is: a short loop that trains two string changes and the fretting-hand sync, and it sounds like music at any speed.', ['At the 12th fret: B 12–13–15, e 12, B 15–13, then B 12 again.', 'The e-string note sits a perfect 4th above the first B-string note: under the same finger, one string up.', 'Down on B 15, up on e 12, down on B 15: both string changes go around the outside of the two strings.'])),
        S('pglick-shapes', 'The three left-hand shapes', 'fretting', 'Whole–half and whole–whole at the 12th fret.', [
          L_('pglick-wh', 'The whole–half shape at the 12th fret (B 12–14–15, e 12, B 15–14)', 'accurate-reps', { place: 'fixed', form: 'six', shape: 'WH', at: 12, cycles: 8, step: 1 / 3, goal: 110, start: 56, why: 'Whole step, then half step: the minor, Dorian-sounding version, with the middle finger replaced by the ring finger on fret 14. The way back uses the top two notes, 15 then 14.', instr: HOW + 'Fingers: index 12, ring 14, pinky 15 on the B string. Pass: 8 clean loops in a row, twice.', watch: 'The ring and pinky collapsing together on frets 14 and 15.', simplify: 'Quarter notes.' }),
          L_('pglick-ww', 'The whole–whole shape at the 12th fret (B 12–14–16, e 12, B 16–14)', 'external-focus', { place: 'fixed', form: 'six', shape: 'WW', at: 12, cycles: 8, step: 1 / 3, goal: 104, start: 54, why: 'Two whole steps make the bright, major version and the widest stretch (index 12, middle 14, pinky 16). Listening for six equally loud, equally long notes keeps the stretch from making the rhythm limp.', instr: HOW + 'Listen, don’t watch: the loop should sound like a machine, no note louder or later than the others. Pass: 8 loops in a row where you can’t hear the string changes.', watch: 'The stretched note (fret 16) coming late, twice per loop.', simplify: 'The shape a few frets higher, where the frets are closer.' })],
          ST('Three notes on one string can be spaced half–whole, whole–half or whole–whole. These are the only three spacings that occur between neighbouring notes of a major or minor key.', 'Knowing all three is what lets the lick move through a key: each position of the key on the B string is one of them.', ['Half–whole (0-1-3): dark, Phrygian or natural-minor colour.', 'Whole–half (0-2-3): minor, Dorian colour.', 'Whole–whole (0-2-4): bright, major colour; the widest stretch.', 'The way back is always the top two B-string notes, highest first.'])),
        S('pglick-first-music', 'First music', 'improv', 'The lick that resolves to the root.', [c => lickGroove(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])],
          ST('Anchored on the 5th of a minor key, the three B-string notes are the 5th, ♭6 and ♭7, and the e-string note is the root: the lick climbs home and turns back.', 'A speed lick only becomes music when it lands somewhere: here it lands on the root.', ['In E minor at the 12th fret: B, C, D on the B string, E on the high e, then D, C.']))
      ], [1, 3]),
    stage('intermediate', 'In time, every shape, along the neck',
      'Loop the lick in triplets at 120 BPM and in 16ths across the beat at 90, change shape every bar, move one shape up and down the neck fret by fret and through a key by position, play the inside-picked mirror, and use it over a minor progression.', [
        S('pglick-time', 'In time', 'picking', 'Triplets, 16ths across the beat, shapes mixed.', [
          L_('pglick-trip', 'The lick in triplets at tempo, one loop every two beats (half–whole at 12)', 'accurate-reps', { place: 'fixed', form: 'six', shape: 'HW', at: 12, cycles: 12, step: 1 / 3, goal: 120, why: 'In triplets the six-note loop fits two beats exactly: the first B-string note and the downstroke fall on every other click, which makes the loop easy to lock to the metronome.', instr: HOW + '12 loops in a row. Pass: 12 loops clean at the goal tempo, 3 times.', watch: 'Drifting ahead of the click in the second half.', simplify: '8th notes.' }),
          L_('pglick-16', 'The lick in 16ths across the beat: accent the click, not the loop (half–whole at 12)', 'external-focus', { place: 'fixed', form: 'six', shape: 'HW', at: 12, cycles: 8, step: 0.25, goal: 96, why: 'In 16ths the six-note loop no longer lines up with the beat: it restarts every one and a half beats, so the click falls on a different note of the loop each time. Accenting the click keeps the line grooving and shows whether the picking is really even.', instr: HOW + 'Four notes per click; accent whichever note falls on the click. Listen for a clear pulse under the stream. Pass: 8 loops with every beat audible, at the goal tempo.', watch: 'Accenting the first note of the loop out of habit.', simplify: 'Triplets.' }),
          L_('pglick-shapes-mix', 'Shapes interleaved: half–whole, whole–half, whole–whole, a new shape every bar', 'interleaving', { place: 'fixed', form: 'six', shapes: ['HW', 'WH', 'WW', 'WH', 'HW', 'WW'], at: 12, cycles: 2, step: 1 / 3, goal: 110, why: 'Changing the shape every bar while the picking stays identical makes the fretting hand find each shape on the fly instead of settling into one.', instr: HOW + 'Two loops per shape (one bar each), in the order shown. Look ahead to the next shape during the last loop. Pass: the whole sequence twice without a wrong fret.', watch: 'Carrying the last shape’s stretch into the next one.', simplify: '8th notes, four loops per shape.' })],
          ST('Six notes fit two beats of triplets or one beat of sextuplets exactly; in 16ths they cross the beat and come round every three beats.', 'Locking the loop to the beat is what makes a fast loop sound in time; crossing the beat is what makes it sound restless and fast.', ['Triplets: one loop per two beats, the downstroke always on the beat.', '16ths: 12 notes (two loops) take three beats.'])),
        S('pglick-frets', 'Along the neck, fret by fret', 'fretboard', 'One shape moved a fret at a time, up and back.', [
          L_('pglick-chrom-up', 'Half–whole shape from fret 12 up to 16 and back, a fret every two loops', 'variable', { place: 'chrom', form: 'six', shape: 'HW', frets: [12, 16], cycles: 2, step: 1 / 3, goal: 110, why: 'Moving the same shape a fret at a time, in time, trains the shift while the picking keeps going: the first step to playing the lick anywhere on the neck.', instr: HOW + 'Two loops per fret (one bar), then shift the whole hand up one fret on the next downstroke; at fret 16 come back down. Pass: up and back twice without a gap at the shifts.', watch: 'Stopping to shift: the shift happens on the beat, with the first note.', simplify: 'Four loops per fret, 8th notes.' }),
          L_('pglick-chrom-down', 'Whole–whole shape from fret 12 down to 7 and back, a fret every two loops', 'variable', { place: 'chrom', form: 'six', shape: 'WW', frets: [12, 7], cycles: 2, step: 1 / 3, goal: 104, why: 'Going down the neck the frets get wider: the whole–whole stretch gets harder at every shift, so the hand has to adapt while the picking stays the same.', instr: HOW + 'Two loops per fret, down to fret 7 and back up to 12. Pass: the whole trip twice without the stretch note coming late.', watch: 'The pinky falling short of the stretch as the frets widen.', simplify: 'Frets 12 to 10 only.' })],
          ST('Moved fret by fret, the shape stays the same and the pitch slides chromatically: a pure left-hand pattern, no key.', 'This is how players warm the lick up and how it becomes a speed burst anywhere on the neck.', ['The frets get wider toward the nut: the same shape needs a bigger stretch.', 'Shift with the whole hand on the first note of the loop, not finger by finger.'])),
        S('pglick-positions', 'By position in a key', 'fretboard', 'The next scale note each time: the shape changes, every note stays in the key.', [
          L_('pglick-key-up', 'Up the key by position from fret 12 ({key})', 'variable', { place: 'key', form: 'six', lo: 12, hi: 17, cycles: 2, step: 1 / 3, goal: 104, why: 'In a key, the lick moves to the next scale note each time and the shape changes by itself: {shapes}. Every note stays in the key, so the lick becomes a run up the scale.', instr: 'Two loops in each position: {where}, then back down. Shift on the first note of each position with the whole hand. Pass: up and back twice with every shape played right and no gap at the shifts.', watch: 'Keeping the last shape out of habit: each position has its own.', simplify: 'The first three positions only.' }),
          L_('pglick-key-down', 'Down the key by position from fret 12 ({key})', 'variable', { place: 'key', form: 'six', lo: 5, hi: 12, cycles: 2, step: 1 / 3, goal: 104, down: true, why: 'The same key walk going down the neck: wider frets, the shapes in the opposite order, and the same picking.', instr: 'Two loops per position from the 12th fret down: {where}, and back up. Pass: the whole walk twice in time.', watch: 'Losing the key: every note is in it, so a wrong note means a wrong shape.', simplify: 'Four positions only.' })],
          ST('Three neighbouring notes of a key up the B string, the next one on the e, and back down: moved to each next scale note, the lick climbs the key and the shape changes on its own.', 'This is how the lick becomes melodic: it can run up or down any key and land on any note.', ['In a major or minor key the B-string notes always form one of the three shapes.', 'The e-string note is the next scale note: a perfect 4th above the first note, or an augmented 4th once per octave (one fret further).'])),
        S('pglick-mirror', 'The mirror: inside picking', 'picking', 'Three down the e, one on the B, two back up the e.', [
          L_('pglick-mirror', 'The mirror: e 15–13–12, B 12, e 12–13 (half–whole), then the other shapes', 'chunking', { place: 'fixed', form: 'mirror', shapes: ['HW', 'WH', 'WW'], at: 12, cycles: 4, step: 1 / 3, goal: 104, why: 'Turned upside down, the lick runs down the e string, drops to the B string a 4th below and climbs back. The six strokes are the same, but both string changes are now inside: the pick has to hop between the two strings. That is the other half of string changing.', instr: HOW_M + 'Learn it in halves first: the three e-string notes, then e 12 → B 12 → e 12. Four loops in each shape. Pass: all three shapes clean at the goal tempo.', watch: 'Catching the e string on the upstroke to the B: the pick stays between the strings.', simplify: 'Half–whole only, 8th notes.' }),
          L_('pglick-lick-mirror', 'The lick, then the mirror: outside and inside picking alternating every bar (half–whole at 12)', 'interleaving', { place: 'fixed', forms: ['six', 'mirror', 'six', 'mirror'], shapes: ['HW'], at: 12, cycles: 2, step: 1 / 3, goal: 104, why: 'Alternating the lick (outside string changes) and its mirror (inside string changes) means the picking hand can never settle into one escape: exactly the switching a real line asks for.', instr: 'Two loops of the lick, two of the mirror, and again. Every loop starts with a downstroke. Pass: the whole sequence twice without a wrong string.', watch: 'Starting the mirror on the B string: it begins at the top of the e-string shape.', simplify: '8th notes.' })],
          ST('The mirror keeps the six strokes and the shapes but swaps the strings: three down the e, one on the B (a perfect 4th below, under the index), two back up the e. Its string changes are inside, the lick’s are outside.', 'Together the two cover both kinds of string change for this picking pattern.', ['Mirror at the 12th fret, half–whole: e 15–13–12, B 12, e 12–13.', 'Inside: up on one string, down on the next, the pick trapped between them.'])),
        S('pglick-music-i', 'Over the changes', 'improv', 'A position for every chord; bursts in a solo.', [c => lickChanges(c), c => targetGuide(c, { prog: 'minorRock', scale: 'minor', name: 'Solo over i–♭VI–♭VII: one burst of the lick per phrase, then space' })],
          ST('Starting each bar’s lick on a note of that bar’s chord makes the fast loop sound like it belongs to the harmony.', 'Speed in a solo works when it is aimed: a burst that starts on a chord tone and lands somewhere.', ['Pick the chord tone nearest the hand: the positions are never far apart.']))
      ], [4, 6]),
    stage('advanced', 'Sextuplets, skips, the whole neck, every key',
      'Play the lick in sextuplets (one loop per beat) at 100 BPM, run one shape up and down the whole neck, play the skipped-string version through a key, jump between positions out of order, change key every block, and climb the positions into a held note over a progression.', [
        S('pglick-speed', 'Speed and the whole neck', 'picking', 'A loop per beat; frets 1 to 17 and back.', [
          L_('pglick-sext', 'Sextuplets: one loop per beat (half–whole at 12)', 'edge', { place: 'fixed', form: 'six', shape: 'HW', at: 12, cycles: 16, step: 1 / 6, goal: 96, start: 56, why: 'In sextuplets the six-note loop fills exactly one beat: the downstroke on the first B-string note lands on every click. This is the lick at real speed. Climb the tempo ladder: the motion must stay as small as it was in triplets.', instr: HOW + 'One loop per click. Start at the start tempo and add 4 BPM after every clean pass. Pass: two clean passes of 16 loops at the goal tempo.', watch: 'The second B-string 15 getting swallowed at speed.', simplify: 'Triplets at double the tempo setting.' }),
          L_('pglick-neck', 'The whole neck by fret: half–whole from fret 1 to 17 and back', 'variable', { place: 'chrom', form: 'six', shape: 'HW', frets: [1, 17], cycles: 1, step: 0.25, goal: 96, marks: false, why: 'One loop per fret over the whole neck: the shape shrinks as you climb and stretches as you come down, while the picking runs on. The complete chromatic map of the lick.', instr: HOW + 'One loop per fret in 16ths, shift on every first note, up to fret 17 and back to fret 1. Pass: the whole trip at the goal tempo without a gap.', watch: 'The low frets: the stretch is widest there, so keep the thumb low behind the neck.', simplify: 'Frets 5 to 15.' })],
          ST('At speed the six-note loop sits in one beat of sextuplets; the same shape can run over the whole neck one fret at a time.', 'Sextuplets are how the lick is usually heard; the full neck builds stamina and shift accuracy.', ['Six notes per beat at 100 BPM is 10 notes a second.', 'Fret spacing near the nut is about one and a half times that at the 12th fret.'])),
        S('pglick-skip', 'The skipped-string version', 'picking', 'Three up the G string, the high e, two back down the G.', [
          L_('pglick-skip', 'Skipped string: G-string notes, the high e, back down the G ({key})', 'variable', { place: 'key', form: 'skip', positions: [0, 1, 0, -1], cycles: 4, step: 1 / 3, goal: 100, why: 'Skipping the B string turns the loop into wide intervals (the e note lands a 6th or 7th above the first G-string note) and makes the pick jump two strings twice per loop: the same picking with a much bigger target.', instr: 'Three notes up the G string (down–up–down), the high e (up), two back down the G (down–up), the B string muted by the fretting fingers. Four loops in each position: {where}. Pass: all four positions clean at the goal tempo.', watch: 'The B string sounding: rest the side of the index finger on it.', simplify: 'One position, 8th notes.' }),
          L_('pglick-skip-walk', 'Skipped string up the key by position ({key})', 'edge', { place: 'key', form: 'skip', lo: 9, hi: 16, cycles: 2, step: 0.25, goal: 92, start: 54, why: 'Walking the skipped version through the key combines the wide jump with a shape change at every position. Climb the tempo ladder: the motion has to stay small as it gets faster.', instr: 'Two loops per position in 16ths, up and back: {where}. Start at the start tempo and add 4 BPM after every clean pass. Pass: two clean passes at the goal tempo.', watch: 'Reaching for the e string with the whole arm.', simplify: 'Four loops per position, half tempo.' })],
          ST('With the B string skipped, the same six-note rule runs on the G string with the top note on the e: three up the G, the e, two back down the G.', 'Wide intervals sound modern and less scale-like; skipping a string is the hardest version of the change.', ['G to e is a major 6th apart in standard tuning, so the e note at the index fret sits a 6th above the first G-string note.', 'Mute the skipped B string with the underside of the fretting fingers.'])),
        S('pglick-keys', 'Any key, any position', 'fretboard', 'Four keys; positions out of order.', [
          L_('pglick-keys4', 'Four keys around the cycle of fourths, positions near the 12th fret ({key} and up in 4ths)', 'interleaving', { place: 'key', form: 'six', keys: [0, 5, 10, 3], positions: [0, 1, 2, 1], at: 12, cycles: 2, step: 1 / 6, goal: 92, why: 'The lick moves by position in any key. Changing key every block forces you to rebuild the map each time, which is what real songs ask of you.', instr: 'Each key: four positions (up three and back one) near the 12th fret, two loops each in sextuplets, straight into the next key. Pass: all four keys without stopping.', watch: 'Carrying shapes over from the last key: the shapes follow the new key.', simplify: 'Two keys, triplets.' }),
          L_('pglick-called', 'Positions out of order: anchored on the 5th, root, ♭3, ♭7, 4th ({key})', 'interleaving', { place: 'key', form: 'six', positions: [0, 3, -2, 2, -1], at: 12, cycles: 3, step: 1 / 6, goal: 92, why: 'Jumping between positions anchored on different notes of the key, instead of sliding to the next one, makes each shift a real jump: the way the lick turns up in a solo.', instr: 'Three loops anchored on each degree in turn, all near the 12th fret: {where}. Look ahead to the next position during the last loop and shift with the whole hand on its first note. Pass: all five positions at the goal tempo without a gap.', watch: 'A late shift that steals a note from the next loop.', simplify: 'The first three positions, triplets.' })],
          ST('Every position of the lick is anchored on a degree of the key: the same rule (three neighbouring scale notes up the B string, the next on the e) finds it in any key.', 'Knowing which note each position starts on turns the lick into a melodic tool, not just a finger pattern.', ['In a minor key, the position anchored on the 5th reaches the root on the e; the one anchored on the root reaches the 4th.'])),
        S('pglick-music-a', 'In real music', 'improv', 'Climbing the key into a held note; a hard-rock solo.', [
          c => lickChanges(c, { id: 'pglick-climb', step: 1 / 6, name: `Climbing by chord: the lick from each chord tone over i–♭VII–♭VI–♭VII (${keyName(c)})`, prog: c.minor ? [[0, 'm'], [10, ''], [8, ''], [10, '']] : [[0, ''], [7, ''], [9, 'm'], [5, '']] }),
          c => targetGuide(c, { prog: 'powerMinor', scale: 'minor', name: 'Hard-rock solo: lick bursts between long, bent notes' })],
          ST('In a solo, the lick works as a burst between long notes: fast, then held.', 'Contrast (speed against space) is what makes a fast lick exciting rather than tiring.', ['Start each burst on a chord tone; end it on a note you can hold.']))
      ], [7, 8]),
    stage('mastery', 'Anywhere, at speed, your own',
      'Run the whole neck in sextuplets at about 110 BPM, the mirror through a key at speed, a new form, shape and fret every bar, the lick in all 12 keys, and perform your own 8-bar piece built on it.', [
        S('pglick-perf', 'Performance tempo', 'picking', 'The whole neck and the mirror at speed.', [
          L_('pglick-neck-fast', 'The whole neck in sextuplets: half–whole from fret 3 to 17 and back', 'edge', { place: 'chrom', form: 'six', shape: 'HW', frets: [3, 17], cycles: 1, step: 1 / 6, goal: 100, start: 60, marks: false, why: 'The full chromatic trip at performance tempo: a loop per beat and a shift on every beat, with the picking on autopilot.', instr: HOW + 'One loop per fret, shifting on each first note. Use the tempo ladder: start at the start tempo and add a few BPM after every clean pass. Pass: the whole trip clean at the goal tempo.', watch: 'Forearm tension on the long run: breathe and keep the grip light.', simplify: 'Triplets.' }),
          L_('pglick-mirror-key', 'The mirror through the key at speed ({key})', 'edge', { place: 'key', form: 'mirror', lo: 7, hi: 15, cycles: 2, step: 1 / 6, goal: 92, start: 58, why: 'The mirror moved by position, at speed: the shapes now change on the top string while the inside string changes stay clean.', instr: HOW_M + 'Two loops per position: {where}, up and back. Tempo ladder to the goal. Pass: clean at the goal tempo, twice.', watch: 'The single B-string note going quiet.', simplify: 'Triplets.' })],
          ST('Performance tempo is reached in small steps: a tempo just above the clean one, then a few BPM more.', 'The goal is the same small motion at a higher speed, not a harder motion.', ['Add 3–5 BPM only after two clean passes.'])),
        S('pglick-anywhere', 'Any form, any key', 'fretboard', 'No warning.', [c => lickRandom(c), c => lickTwelveKeys(c)],
          ST('At mastery the lick is available in any form, shape, position and key on demand.', 'Random practice is harder in the moment and sticks better afterwards.', ['The lick anchored on the 5th reaches the root in every key; find the 5th on the B string first.'])),
        S('pglick-voice', 'Your own voice', 'improv', 'A study on the lick, then your own.', [c => lickEtude(c), c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp: bursts of the lick, each ending on a long note' })],
          ST('A capstone study puts every version of the lick into one piece of music, which you then rewrite as your own.', 'Mastery is using the lick musically, not just fast.', ['Plan where each burst starts and ends before you play it.']))
      ], [9, 10])
  ]
});
