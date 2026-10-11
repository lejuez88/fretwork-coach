// The Paul Gilbert lick (3+1): three notes on the B string, one on the high e, looped with strict
// alternate picking. A fixed left-hand pattern (not a pentatonic-box cell): from the first slow loop at
// the 12th fret, through its three left-hand shapes, the descending order and the 1+3 mirror, to moving
// it up and down the whole neck by fret and by position in a key, the skipped-string version, every key,
// performance tempo and an original study.
//
// Concept-first (CONTENT.md): the model is a LOOP of four notes on two strings, defined by
//   - a FORM: '31up' (B-string notes low to high, then the e note), '31down' (B-string notes high to low,
//     then the e note), '13' (the 1+3 mirror: one B-string note, then three on the e) or 'skip' (three
//     on the G string, one on the e: the string between is skipped);
//   - a SHAPE: the frets of the three same-string notes above the index finger: half–whole [0,1,3],
//     whole–half [0,2,3] or whole–whole [0,2,4]. In any major or minor key, three consecutive scale
//     notes on one string always form one of these three shapes, so the lick moves through a key by
//     changing shape;
//   - a PLACEMENT: one fret, a chromatic walk (the same shape moved fret by fret: no key, a pure
//     left-hand pattern) or a diatonic walk (by position: the next scale note of the key each time,
//     the shape adapting so every note stays in the key).
// With strict alternate picking a four-note loop always starts on a downstroke: down–up–down on the B
// string, up on the e, so both string changes are "outside" (the pick goes around the pair). The
// composer `lick(c, spec)` builds an exercise from form × shape × placement × note value × cycles per
// position × key plan; every note is tagged with what it must be (a shape offset or a scale tone) for
// the pitch check.
import { OPEN, N, nameOf, make, mod12, S, stage, entry, M, targetGuide } from '../lib.js';
import { rng, endOf } from './alternatePicking.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const SHAPES = { HW: [0, 1, 3], WH: [0, 2, 3], WW: [0, 2, 4] };
export const SHAPE_NAME = { HW: 'half–whole', WH: 'whole–half', WW: 'whole–whole' };
const SCALE = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };
const DEG = { minor: ['R', '2', '♭3', '4', '5', '♭6', '♭7'], major: ['R', '2', '3', '4', '5', '6', '7'] };
/** For the pitch check: what each note must be ({base, rel} offsets from a pitch, or {key, scale}). */
export const ALLOW = new WeakMap();
const UNIT = new Map([[0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const unitOf = step => UNIT.get(step) || '16th notes';
const stepFor = lvl => (lvl <= 3 ? 0.5 : lvl <= 8 ? 0.25 : 1 / 6);
const keyName = c => `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`;
const scaleOf = c => (c.minor ? 'minor' : 'major');
const pcsOf = (k, sc) => SCALE[sc].map(x => mod12(k + x));

/** One loop at a fixed fret and shape (index finger at fret f on the B string). */
export function fixedLoop(form, shape, f) {
  const sh = SHAPES[shape], base = pitch(form === 'skip' ? 3 : 2, f);
  let notes;
  if (form === '31up') notes = [[2, f + sh[0]], [2, f + sh[1]], [2, f + sh[2]], [1, f]];
  else if (form === '31down') notes = [[2, f + sh[2]], [2, f + sh[1]], [2, f + sh[0]], [1, f]];
  else if (form === '13') notes = [[2, f], [1, f + sh[0]], [1, f + sh[1]], [1, f + sh[2]]];
  else return null;
  return { notes, shape, f, allow: { base, rel: [0, ...sh, 5, ...sh.map(x => x + 5)] } };
}
/** The scale tones of a key as MIDI pitches from E2 up. */
function ladder(k, sc) { const out = []; for (let m = 40; m <= 90; m++) if (pcsOf(k, sc).includes(mod12(m))) out.push(m); return out; }
/** Shape id from the two steps between three consecutive scale tones. */
const shapeFrom = (a, b, c3) => ({ '1,2': 'HW', '2,1': 'WH', '2,2': 'WW' })[`${b - a},${c3 - b}`] || null;
/**
 * One loop by position in a key: x = the index of the first note in the key's ladder. 31up/31down: three
 * consecutive scale notes on the B string, the next scale note on the e. 13: one note on the B string,
 * then the scale notes 3, 4 and 5 steps above it on the e. skip: three on the G string, then the first
 * scale note at least a major 6th above the first one, on the e string.
 */
export function keyLoop(k, sc, form, x) {
  const L = ladder(k, sc), allow = { key: k, scale: sc };
  if (form === '31up' || form === '31down') {
    const [a, b, c3, d] = [L[x], L[x + 1], L[x + 2], L[x + 3]]; if (d == null) return null;
    const B = [a, b, c3].map(m => [2, m - OPEN[2]]), e = [1, d - OPEN[1]];
    const notes = form === '31up' ? [...B, e] : [B[2], B[1], B[0], e];
    return { notes, shape: shapeFrom(a, b, c3), f: B[0][1], first: a, allow };
  }
  if (form === '13') {
    const [a, d, e2, f2] = [L[x], L[x + 3], L[x + 4], L[x + 5]]; if (f2 == null) return null;
    return { notes: [[2, a - OPEN[2]], ...[d, e2, f2].map(m => [1, m - OPEN[1]])], shape: shapeFrom(d, e2, f2), f: a - OPEN[2], first: a, allow };
  }
  if (form === 'skip') {
    const [a, b, c3] = [L[x], L[x + 1], L[x + 2]]; const top = L.find(m => m >= a + 9); if (top == null || c3 == null) return null;
    return { notes: [[3, a - OPEN[3]], [3, b - OPEN[3]], [3, c3 - OPEN[3]], [1, top - OPEN[1]]], shape: shapeFrom(a, b, c3), f: a - OPEN[3], first: a, allow };
  }
  return null;
}
const okFrets = lp => lp && lp.notes.every(([, f]) => f >= 1 && f <= 22);
/** Ladder indexes of key positions whose first note sits on string s between frets lo and hi. */
function positionsIn(k, sc, form, lo, hi) {
  const L = ladder(k, sc), s = form === 'skip' ? 3 : 2, out = [];
  L.forEach((m, x) => { const f = m - OPEN[s]; if (f >= lo && f <= hi) { const lp = keyLoop(k, sc, form, x); if (okFrets(lp)) out.push(x); } });
  return out;
}
/** The position nearest a fret (optionally starting on a given degree of the key). */
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

/* ------------------------------- The composer ------------------------------- */
/**
 * spec: { id, name, method, domain, form, shape | shapes (one per position, cycled), place:
 * 'fixed' | 'chrom' | 'key', at (fret), frets ([from, to] for chrom: up then back), lo/hi (key walk
 * range, up then back unless oneWay), positions (ladder offsets from the position nearest `at`, key
 * walks), keys (key offsets for a key walk, one block each), forms (cycled per position), cycles
 * (per position), step, marks, land, why, instr, watch, simplify, goal, start, dl, backing }.
 */
export function lick(c, spec) {
  const step = spec.step || stepFor(c.lvl || 4), cyc = spec.cycles || 2, plan = [];
  const forms = spec.forms || [spec.form || '31up'];
  if (spec.place === 'key') {
    const keys = spec.keys || [0];
    keys.forEach((off, ki) => {
      const k = mod12(c.key + off), sc = scaleOf(c), form0 = forms[0];
      let xs;
      if (spec.positions) { const x0 = nearestPos(k, sc, form0, spec.at || 12); if (x0 == null) return; xs = spec.positions.map(d => x0 + d); }
      else if (spec.near) { const x0 = nearestPos(k, sc, form0, spec.at || 12, spec.degIx != null ? spec.degIx : null); xs = x0 == null ? [] : [x0]; }
      else { const up = positionsIn(k, sc, form0, spec.lo || 1, spec.hi || 17); xs = spec.oneWay ? up : [...up, ...up.slice(0, -1).reverse()]; if (spec.down) xs = xs.slice().reverse(); }
      xs.forEach((x, i) => { const form = forms[(i + ki) % forms.length]; const lp = keyLoop(k, sc, form, x); if (okFrets(lp)) plan.push({ ...lp, form, k, sc }); });
    });
  } else {
    const shapes = spec.shapes || [spec.shape || 'HW'];
    let frets = [spec.at || 12];
    if (spec.place === 'chrom') { const [a, b] = spec.frets; const up = []; for (let f = a; a <= b ? f <= b : f >= b; f += a <= b ? 1 : -1) up.push(f); frets = spec.oneWay ? up : [...up, ...up.slice(0, -1).reverse()]; }
    const n = Math.max(frets.length, shapes.length, forms.length);
    for (let i = 0; i < n; i++) { const form = forms[i % forms.length], lp = fixedLoop(form, shapes[i % shapes.length], frets[i % frets.length]); if (lp) plan.push({ ...lp, form }); }
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
  // land: hold the last loop's e-string note (or the first note) to the end of the bar
  const last = plan[plan.length - 1], land = spec.land === 'first' ? last.notes[0] : last.notes.find(([s]) => s === 1) || last.notes[3];
  const t0 = endOf(notes), end = Math.max(t0 + 1, Math.ceil((t0 + 1) / 4) * 4);
  const ln = N(land[0], land[1], t0, end - t0, '~'); ALLOW.set(ln, last.allow); notes.push(ln);
  const where = plan.map(p => p.form === 'skip' ? `G${p.f}` : `B${p.f}`);
  const shapesUsed = [...new Set(plan.map(p => p.shape).filter(Boolean))];
  const fill = s => String(s).replace('{key}', keyName(c)).replace('{shapes}', shapesUsed.map(x => SHAPE_NAME[x]).join(', ')).replace('{where}', where.slice(0, 16).join(' → ') + (where.length > 16 ? ' …' : ''));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'picking', method: spec.method, unit: unitOf(step), goal: spec.goal || 100, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'strict',
    shape: plan.length === 1 || shapesUsed.length === 1 ? shapesUsed[0] : null, neck: spec.place !== 'fixed' && plan.length >= 6,
    ...(spec.backing ? { backing: spec.backing, chords: spec.backing } : {}),
    why: fill(spec.why), instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
const L_ = (id, name, method, opts) => c => lick(c, { id, name, method, ...opts });
const HOW = 'Strict alternate picking: down–up–down on the three B-string notes, up on the high e, then down again on the B string; both string changes go around the outside of the pair. Index finger at the first fret of the shape, the e-string note under the same finger (roll it). ';

/* ------------------------------ Generators ------------------------------ */
/** The three B-string notes alone, then the string change alone (chunking). */
export function lickParts(c, { part = 'b' } = {}) {
  const lp = fixedLoop('31up', 'HW', 12), step = (c.lvl || 1) <= 1 ? 0.5 : 1 / 3, notes = []; let t = 0;
  const seq = part === 'b' ? Array.from({ length: 6 }, () => lp.notes.slice(0, 3)).flat() : Array.from({ length: 12 }, () => [lp.notes[2], lp.notes[3]]).flat();
  seq.forEach(([s, f], i) => { const n = N(s, f, t, step, null, i < 4 ? { pick: i % 2 ? 'u' : 'd' } : null); ALLOW.set(n, lp.allow); notes.push(n); t += step; });
  const end = Math.ceil((t + 1) / 4) * 4, ln = N(seq[0][0], seq[0][1], t, end - t); ALLOW.set(ln, lp.allow); notes.push(ln);
  return make(c, {
    id: part === 'b' ? 'pglick-b3' : 'pglick-change', name: part === 'b' ? 'The lick in pieces: the three B-string notes (frets 12–13–15)' : 'The lick in pieces: the string change, B-string 15 down, high-e 12 up',
    domain: 'picking', method: 'chunking', unit: unitOf(step), goal: 96, start: 50, minutes: 3, picking: 'strict',
    why: part === 'b' ? 'The lick is three notes on the B string plus one on the e. Looping the three B-string notes first puts the fretting fingers (index, middle, pinky) in place before the string change is added.' : 'The hard moment of the lick is one motion: a downstroke on the B string followed straight away by an upstroke on the high e, the pick travelling around the outside of the two strings. Looping just those two notes fixes it.',
    instr: part === 'b' ? 'Index on fret 12, middle on 13, pinky on 15 of the B string. Alternate picking: with three notes per loop the stroke on fret 12 changes every time (down, then up), which is fine here. Pass: 6 loops even and clean, twice in a row.' : 'Pinky on fret 15 of the B string (downstroke), index on fret 12 of the high e (upstroke), over and over. Keep the pick motion small and let the wrist carry the pick around the outside of the pair. Pass: 8 bars where both notes are equally loud.',
    watch: part === 'b' ? 'Lifting the index finger off fret 12 while the pinky plays: keep it down.' : 'Hitting the B string again on the way to the e: aim the upstroke at the e alone.',
    simplify: 'Quarter notes, as slowly as needed.', shape: 'HW', tab: { notes }
  });
}
/** The app plays a loop in one of the three shapes; a silent bar follows: name the shape, then play it (hear it first). */
export function lickHear(c) {
  const r = rng(61 + (c.lvl || 2)), notes = [], plan = []; let t = 0;
  for (let i = 0; i < 4; i++) {
    const sh = ['HW', 'WH', 'WW'][Math.floor(r() * 3)], lp = fixedLoop('31up', sh, 12); plan.push(SHAPE_NAME[sh]);
    for (let rep = 0; rep < 2; rep++) lp.notes.forEach(([s, f]) => { const n = N(s, f, t, 0.5); ALLOW.set(n, lp.allow); notes.push(n); t += 0.5; });
    t += 4;
  }
  return make(c, {
    id: 'pglick-hear', name: 'Hear the shape: half–whole, whole–half or whole–whole?', domain: 'ear', method: 'audiation', unit: '8th notes', goal: 88, start: 50, minutes: 4, picking: 'strict',
    why: 'Each shape has its own sound: half–whole is dark (a minor, Phrygian colour), whole–half is minor and smooth, whole–whole is bright (major). Hearing which is which ties the sound to the fingers, so later you can pick the shape a key or a chord needs.',
    instr: `Cover the tab. Each bar plays the lick twice at the 12th fret in one of the three shapes; the next bar is silent. In the silent bar, say the shape, then play it. Check against the answer afterwards: ${plan.join(', ')}. Pass: 3 of 4 named and played right, twice.`,
    watch: 'Reading the answer before guessing.', simplify: 'Compare only half–whole and whole–whole (the most different).', tab: { notes }
  });
}
/** The lick in the key's position nearest fret 12 that starts on the 5th, looped, then the root held: over a minor groove (use in music). */
export function lickGroove(c) {
  const k = c.key, sc = scaleOf(c), x = nearestPos(k, sc, '31up', 12, 4); if (x == null) return null;
  const lp = keyLoop(k, sc, '31up', x), step = (c.lvl || 2) <= 2 ? 0.5 : 0.25, notes = []; let t = 0;
  const chords = c.minor ? [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'] : [nameOf(k), nameOf(k + 9) + 'm', nameOf(k + 5), nameOf(k + 7)];
  for (let b = 0; b < 4; b++) {
    t = b * 4;
    if (b % 2 === 0) { for (let r = 0; r < Math.round(1 / step); r++) lp.notes.forEach(([s, f]) => { const n = N(s, f, t, step); ALLOW.set(n, lp.allow); notes.push(n); t += step; }); }
    else { const e = lp.notes[3], n = N(e[0], e[1], t, 3, '~'); ALLOW.set(n, lp.allow); notes.push(n); }
  }
  return make(c, {
    id: 'pglick-groove', name: `First music: the lick resolving to the root (${keyName(c)}, ${SHAPE_NAME[lp.shape]} at fret ${lp.f})`, domain: 'improv', method: 'transfer', unit: unitOf(step), goal: 92, start: 50, minutes: 5, picking: 'strict',
    backing: chords, chords, shape: lp.shape,
    why: `Started on the 5th of the key (${nameOf(lp.first)}), the four notes of the lick climb ${degName(k, sc, lp.first)}–${degName(k, sc, lp.first + (lp.notes[1][1] - lp.notes[0][1]))}–…–R: the e-string note is the root. That is why the lick sounds finished when you stop on it.`,
    instr: 'Bar 1: the lick looped in time. Bar 2: stop on the high-e note (the root) and hold it with vibrato. Same again over the next two chords. Then vary it: loop it for a whole bar, or stop after one loop. Pass: 4 bars in time with the held root landing on beat 1.',
    watch: 'Rushing into the held note: the loop ends exactly on the bar line.', simplify: 'One loop, then the held note.', tab: { notes }
  });
}
/** Each bar a key position whose first note is a chord tone of that bar's chord, near the last one (use in music). */
export function lickChanges(c, { prog = null, id = 'pglick-phrase', name = null, form = '31up' } = {}) {
  const k = c.key, sc = scaleOf(c), step = stepFor(c.lvl || 5);
  const degs = prog || (c.minor ? [[0, 'm'], [8, ''], [10, ''], [0, 'm']] : [[0, ''], [9, 'm'], [5, ''], [7, '']]);
  const chords = degs.map(([d, q]) => nameOf(k + d) + q), L = ladder(k, sc), notes = []; let at = 12;
  for (let b = 0; b < degs.length; b++) {
    const root = mod12(k + degs[b][0]), tones = [root, mod12(root + (degs[b][1] === 'm' ? 3 : 4)), mod12(root + 7)];
    let best = null;
    L.forEach((m, x) => { if (!tones.includes(mod12(m))) return; const lp = keyLoop(k, sc, form, x); if (!okFrets(lp)) return; const d = Math.abs(lp.f - at); if (!best || d < best.d) best = { lp, d }; });
    if (!best) return null; at = best.lp.f;
    let t = b * 4; const loops = Math.round(3 / (4 * step));
    for (let r = 0; r < loops; r++) best.lp.notes.forEach(([s, f]) => { const n = N(s, f, t, step); ALLOW.set(n, best.lp.allow); notes.push(n); t += step; });
    const land = best.lp.notes[0], n = N(land[0], land[1], b * 4 + 3, 1, '~'); ALLOW.set(n, best.lp.allow); notes.push(n);
  }
  return make(c, {
    id, name: name || `The lick over ${chords.join(' – ')}: a new position for every chord (${keyName(c)})`, domain: 'improv', method: 'transfer', unit: unitOf(step), goal: 96, start: 52, minutes: 6, picking: 'strict', backing: chords, chords,
    why: 'Moved by position inside the key, the lick follows the harmony: each bar starts the lick on a note of that bar’s chord, so the fast loop always begins on a strong, consonant note, and the held note on beat 4 points to the next chord.',
    instr: 'Each bar: three beats of the lick in the position shown, then hold its first note on beat 4 while moving to the next position (always a short move). Name the chord tone you start on before each bar. Pass: the four bars twice in time, then your own choice of positions over the same chords.',
    watch: 'Jumping to a far position: pick the chord tone nearest the hand.', simplify: 'Two loops per bar and half the tempo.', tab: { notes }
  });
}
/** A random form, shape and fret every bar (interleaving). */
export function lickRandom(c) {
  const r = rng(733 + (c.lvl || 9)), notes = [], names = []; let t = 0;
  for (let b = 0; b < 8; b++) {
    const form = ['31up', '31down', '13'][Math.floor(r() * 3)], sh = ['HW', 'WH', 'WW'][Math.floor(r() * 3)], f = 3 + Math.floor(r() * 13);
    const lp = fixedLoop(form, sh, f); names.push(`${form === '13' ? '1+3' : form === '31up' ? '3+1 up' : '3+1 down'} ${SHAPE_NAME[sh]} at ${f}`);
    for (let i = 0; i < 18; i++) { const [s, fr] = lp.notes[i % 4]; const n = N(s, fr, b * 4 + i / 6, 1 / 6); ALLOW.set(n, lp.allow); notes.push(n); }
    t = b * 4 + 3; const [s, fr] = lp.notes[3]; const n = N(s, fr, t, 1); ALLOW.set(n, lp.allow); notes.push(n); t = b * 4 + 4;
  }
  return make(c, {
    id: 'pglick-random', name: 'Random access: a new form, shape and fret every bar', domain: 'fretboard', method: 'interleaving', unit: '16th-note sextuplets', goal: 92, start: 52, minutes: 5, dl: 0, picking: 'strict',
    why: 'At mastery level any version of the lick should come out on demand. Unpredictable changes of form, shape and position are the hardest, and most transferable, way to practise that.',
    instr: `${names.join(' → ')}. Three beats of the lick in sextuplets, a beat to move. Read only the names, not the notes. Pass: all 8 bars from memory at the goal tempo.`,
    watch: 'Starting the 1+3 on the wrong string: it begins with its single B-string note.', simplify: 'The first four bars.', tab: { notes }
  });
}
/** All 12 keys around the cycle of fourths, each in the position nearest the last (retrieval). */
export function lickTwelveKeys(c) {
  const sc = scaleOf(c), notes = [], names = []; let t = 0, at = 12;
  for (let i = 0; i < 12; i++) {
    const k = mod12(c.key + 5 * i), x = nearestPos(k, sc, '31up', at, 4); if (x == null) return null;
    const lp = keyLoop(k, sc, '31up', x); at = lp.f; names.push(`${nameOf(k)} (${SHAPE_NAME[lp.shape]}, fret ${lp.f})`);
    for (let r = 0; r < 3; r++) lp.notes.forEach(([s, f]) => { const n = N(s, f, t, 0.25); ALLOW.set(n, lp.allow); notes.push(n); t += 0.25; });
    const e = lp.notes[3], n = N(e[0], e[1], t, 1, '~'); ALLOW.set(n, lp.allow); notes.push(n); t += 1;
  }
  return make(c, {
    id: 'pglick-12-keys', name: `All 12 ${sc} keys around the cycle of fourths: the lick from the 5th to the root`, domain: 'fretboard', method: 'retrieval', unit: '16th notes', goal: 104, start: 56, minutes: 6, picking: 'strict',
    why: 'In every key, the lick started on the 5th climbs to the root. Finding that position in a new key each bar, close to where the hand already is, turns the lick into vocabulary you can use in any song.',
    instr: `Each bar: a new key (up a 4th), three loops and the root held. Before each bar say the key's 5th and find it on the B string near the last position. The plan: ${names.join(' → ')}. Pass: all 12 keys in time, then the first 6 with the tab hidden.`,
    watch: 'Jumping back to the 12th fret every time: stay near the last position.', simplify: 'The first four keys.', tab: { notes }
  });
}
/** An original 8-bar study on the lick (capstone). */
export function lickEtude(c) {
  const k = c.key, sc = scaleOf(c), notes = [];
  const put = (lp, step, t0, beats) => { let t = t0, i = 0; while (t < t0 + beats - 1e-6) { const [s, f] = lp.notes[i % 4]; const n = N(s, f, t, step); ALLOW.set(n, lp.allow); notes.push(n); t += step; i++; } };
  let ps = null, M13 = null, SK = null;
  for (const near of [12, 9, 14, 7, 5]) {
    const x5 = nearestPos(k, sc, '31up', near, 4); if (x5 == null) continue;
    const P = d => { const lp = keyLoop(k, sc, '31up', x5 + d); return okFrets(lp) ? lp : null; };
    M13 = [-3, 0, -1, 1].map(d => keyLoop(k, sc, '13', x5 + d)).find(okFrets); SK = [-2, 0, -1, 1].map(d => keyLoop(k, sc, 'skip', x5 + d)).find(okFrets); for (const offs of [[0, 1, 2, -1, -2], [0, -1, -2, 1, 2], [0, 1, 2, -1, 3]]) { ps = offs.map(P); if (!ps.some(x => !x)) break; }
    if (!ps.some(x => !x) && okFrets(M13) && okFrets(SK)) break; ps = null;
  }
  if (!ps) return null;
  put(ps[0], 0.25, 0, 3); { const e = ps[0].notes[3], n = N(e[0], e[1], 3, 1, '~'); ALLOW.set(n, ps[0].allow); notes.push(n); }   // bar 1: home position, the root held
  put(ps[1], 0.25, 4, 2); put(ps[2], 0.25, 6, 2);                                                                                    // bar 2: up two positions
  put(M13, 1 / 6, 8, 4);                                                                                                              // bar 3: the 1+3 mirror
  put(SK, 0.25, 12, 3); { const e = SK.notes[3], n = N(e[0], e[1], 15, 1, '~'); ALLOW.set(n, SK.allow); notes.push(n); }           // bar 4: the skipped-string version
  [ps[2], ps[1], ps[0], ps[3]].forEach((lp, i) => put(lp, 1 / 6, 16 + i, 1));                                                          // bar 5: down by position in sextuplets
  put(ps[4], 1 / 6, 20, 2); put(ps[3], 1 / 6, 22, 2);                                                                                  // bar 6
  put(ps[0], 1 / 6, 24, 4);                                                                                                           // bar 7: home, full speed
  { const e = ps[0].notes[3], n = N(e[0], e[1], 28, 4, '~'); ALLOW.set(n, ps[0].allow); notes.push(n); }                               // bar 8: the root
  const chords = c.minor ? [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'] : [nameOf(k), nameOf(k + 9) + 'm', nameOf(k + 5), nameOf(k + 7)];
  return make(c, {
    id: 'pglick-etude', name: `Capstone study: an 8-bar piece on the Paul Gilbert lick (${keyName(c)})`, domain: 'improv', method: 'transfer', unit: '16ths, then sextuplets', goal: 92, start: 52, minutes: 8, dl: 0, picking: 'strict',
    backing: [...chords, ...chords], chords,
    why: 'An original piece that uses the whole path: the lick resolving to the root, moved up by position, the 1+3 mirror, the skipped-string version, then the lick falling down the positions at full speed and home to the root.',
    instr: 'Learn it two bars at a time, then join them. Bars 1–4 in 16ths (bar 3 in sextuplets), bars 5–7 in sextuplets: the same pulse, faster notes. Strict alternate picking, every loop starting down. Then write your own 8 bars on the same plan. Pass: the study at the goal tempo with no stops, then your own version played through once.',
    watch: 'Tension when the sextuplets start: keep the motion small, only faster.', simplify: 'Bars 1–4 only.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'pgLick', kind: 'technique', title: 'The Paul Gilbert lick (3+1)', domain: 'picking',
  re: /paul gilbert lick|gilbert lick|\bpg lick|3 ?\+ ?1 (picking )?lick|three notes on the b string/,
  aliases: ['Paul Gilbert lick', 'Gilbert lick', '3+1 lick'],
  summary: 'Three notes on the B string and one on the high e, looped with strict alternate picking: the three left-hand shapes, the mirror and the skipped-string version, moved up and down the whole neck by fret and by position, in every key, to performance tempo.',
  prereqs: ['alternatePicking'],
  sources: ['https://www.guitarworld.com/lessons/intense-rock-picking-a-brief-look-at-paul-gilberts-alternate-picking-technique', 'https://forum.troygrady.com/t/inside-gilbert-lick-on-youtube-mini-lesson/97006', 'https://forum.troygrady.com/t/the-paul-gilbert-lick/30497', 'https://forum.troygrady.com/t/haha-paul-gilbert-admits-that-the-paul-gilbert-lick-is-too-hard-for-beginners/8197', 'https://www.guitarplayer.com/technique/paul-gilbert-gives-a-classic-lesson-in-shred-tab-audio'],
  ctx: { key: 4, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The lick at the 12th fret',
      'Loop the 3+1 lick at the 12th fret in all three shapes in 8th notes at 100 BPM with strict alternate picking (down on the first B-string note, up on the e), name each shape by ear, and use it to resolve to the root over a minor groove.', [
        S('pglick-parts', 'The lick in pieces', 'picking', 'The B-string notes, the string change, then the whole loop.', [c => lickParts(c, { part: 'b' }), c => lickParts(c, { part: 'change' }),
          L_('pglick-hw', 'The Paul Gilbert lick: half–whole shape at the 12th fret (B 12–13–15, e 12)', 'accurate-reps', { place: 'fixed', shape: 'HW', at: 12, cycles: 8, goal: 110, start: 56, why: 'Clean repetitions at a slow tempo build the motion you will keep at speed. Four notes per loop put a downstroke on the first B-string note every time.', instr: HOW + 'Count only the clean loops. Pass: 8 clean loops in a row, twice.', watch: 'An extra stroke when the pick comes back from the e string.', simplify: 'Quarter notes.' })],
          ST('The lick is a fixed left-hand pattern: three notes on the B string (index, middle or ring, pinky), then one on the high e under the index finger, looped. With strict alternate picking a four-note loop always starts on a downstroke.', 'It is one of the most useful speed builders there is: a short loop that trains the string change and the fretting-hand sync, and it sounds like music at any speed.', ['The e-string note sits a perfect 4th above the first B-string note, so the four notes climb like a scale.', 'Down on the third B-string note, up on the e: the pick goes around the outside of the two strings at both changes.'])),
        S('pglick-shapes', 'The three left-hand shapes', 'fretting', 'Whole–half and whole–whole at the 12th fret.', [
          L_('pglick-wh', 'The whole–half shape at the 12th fret (B 12–14–15, e 12)', 'accurate-reps', { place: 'fixed', shape: 'WH', at: 12, cycles: 8, goal: 110, start: 56, why: 'Whole step, then half step: the minor, Dorian-sounding version, with the middle finger replaced by the ring finger on fret 14.', instr: HOW + 'Fingers: index 12, ring 14, pinky 15 on the B string. Pass: 8 clean loops in a row, twice.', watch: 'The ring and pinky collapsing together on frets 14 and 15.', simplify: 'Quarter notes.' }),
          L_('pglick-ww', 'The whole–whole shape at the 12th fret (B 12–14–16, e 12)', 'external-focus', { place: 'fixed', shape: 'WW', at: 12, cycles: 8, goal: 104, start: 54, why: 'Two whole steps make the bright, major version and the widest stretch (index 12, middle 14, pinky 16). Listening for four equally loud, equally long notes keeps the stretch from making the rhythm limp.', instr: HOW + 'Listen, don’t watch: the loop should sound like a machine, no note louder or later than the others. Pass: 8 loops in a row where you can’t hear the string change.', watch: 'The stretched note (fret 16) coming late.', simplify: 'The shape a few frets higher, where the frets are closer.' })],
          ST('Three notes on one string can be spaced half–whole, whole–half or whole–whole. These are the only three spacings that occur between neighbouring notes of a major or minor key.', 'Knowing all three is what lets the lick move through a key: each position of the key on the B string is one of them.', ['Half–whole (0-1-3): dark, Phrygian or natural-minor colour.', 'Whole–half (0-2-3): minor, Dorian colour.', 'Whole–whole (0-2-4): bright, major colour; the widest stretch.'])),
        S('pglick-know', 'Hear it, recall it', 'ear', 'Name the shape by ear; play shapes called from memory.', [c => lickHear(c),
          L_('pglick-recall', 'From memory: the shapes called in order, half–whole, whole–whole, whole–half, half–whole', 'retrieval', { place: 'fixed', shapes: ['HW', 'WW', 'WH', 'HW'], at: 12, cycles: 4, goal: 104, start: 54, marks: false, why: 'Recalling a shape from its name, without reading frets, is what makes it available later in a solo.', instr: 'Cover the tab. Four loops in each shape: half–whole, whole–whole, whole–half, half–whole, all with the index at fret 12. Say the shape before each block. Pass: all four blocks from memory without a wrong fret.', watch: 'Peeking at the tab between blocks.', simplify: 'Two shapes only: half–whole and whole–whole.' })],
          ST('Each shape has a sound and a name. Linking the two (ear to fingers, name to fingers) is what makes the shapes usable.', 'Players who can hear the difference choose the right shape for the key without thinking.', ['Half–whole has a half step at the bottom; whole–half at the top; whole–whole none.'])),
        S('pglick-first-music', 'First music', 'improv', 'The lick that resolves to the root.', [c => lickGroove(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])],
          ST('Started on the 5th of a minor key, the three B-string notes are the 5th, ♭6 and ♭7, and the e-string note is the root: the lick climbs home.', 'A speed lick only becomes music when it lands somewhere: here it lands on the root.', ['In E minor at the 12th fret: B, C, D on the B string, E on the high e.']))
      ], [1, 3]),
    stage('intermediate', 'In time, every shape, along the neck',
      'Loop the lick in 16th notes at 100 BPM in all three shapes and in the descending order, move one shape up and down the neck fret by fret and through a key by position (naming the shape at each position), play the 1+3 mirror, and use it over a minor progression.', [
        S('pglick-time', 'In 16ths', 'picking', 'One loop per beat; shapes mixed; the descending order.', [
          L_('pglick-16', 'The lick in 16ths, one loop per beat (half–whole at 12)', 'accurate-reps', { place: 'fixed', shape: 'HW', at: 12, cycles: 12, step: 0.25, goal: 96, why: 'In 16ths the loop fits the beat exactly: the first B-string note and the downstroke fall on every click, which makes the loop easy to lock to the metronome.', instr: HOW + 'One loop per click, 12 loops. Pass: 12 loops clean at the goal tempo, 3 times.', watch: 'Drifting ahead of the click in the second half.', simplify: '8th notes.' }),
          L_('pglick-shapes-mix', 'Shapes interleaved: half–whole, whole–half, whole–whole, a new shape every bar', 'interleaving', { place: 'fixed', shapes: ['HW', 'WH', 'WW', 'WH', 'HW', 'WW'], at: 12, cycles: 4, step: 0.25, goal: 96, why: 'Changing the shape every bar while the picking stays identical makes the fretting hand find each shape on the fly instead of settling into one.', instr: HOW + 'Four loops per shape, one shape per bar, in the order shown. Say the next shape during the last loop. Pass: the whole sequence twice without a wrong fret.', watch: 'Carrying the last shape’s stretch into the next one.', simplify: 'Two loops per shape, 8th notes.' }),
          L_('pglick-down', 'The descending order: B 15–13–12, then e 12 (half–whole at 12)', 'variable', { place: 'fixed', form: '31down', shapes: ['HW', 'WH', 'WW'], at: 12, cycles: 4, step: 0.25, goal: 96, why: 'Played high to low on the B string, the same four notes become a different line (a falling scale and a leap up to the e). The picking is the same, so the motion transfers.', instr: 'Pinky, middle (or ring), index on the B string, then the index on the e. Strict alternate picking from a downstroke. Four loops in each shape. Pass: all three shapes clean at the goal tempo.', watch: 'Hammering the descending notes: pick every one.', simplify: 'Half–whole only.' })],
          ST('The loop is four 16ths: one loop per beat. The B-string notes can run up (12–13–15) or down (15–13–12) before the e note.', 'Locking the loop to the beat is what makes a fast loop sound in time.', ['Four notes per beat in 16ths: the downstroke always falls on the click.', 'The descending order makes the e note a leap of a 6th or so: a different sound with the same hand.'])),
        S('pglick-frets', 'Along the neck, fret by fret', 'fretboard', 'One shape moved a fret at a time, up and back.', [
          L_('pglick-chrom-up', 'Half–whole shape from fret 12 up to 16 and back, a fret each two loops', 'variable', { place: 'chrom', shape: 'HW', frets: [12, 16], cycles: 2, step: 0.25, goal: 96, why: 'Moving the same shape a fret at a time, in time, trains the shift while the picking keeps going: the first step to playing the lick anywhere on the neck.', instr: HOW + 'Two loops per fret, then shift the whole hand up one fret on the next downstroke; at fret 16 come back down. Pass: up and back twice without a gap at the shifts.', watch: 'Stopping to shift: the shift happens on the beat, with the first note.', simplify: 'Four loops per fret, 8th notes.' }),
          L_('pglick-chrom-down', 'Whole–whole shape from fret 12 down to 7 and back, a fret each two loops', 'variable', { place: 'chrom', shape: 'WW', frets: [12, 7], cycles: 2, step: 0.25, goal: 92, why: 'Going down the neck the frets get wider: the whole–whole stretch gets harder at every shift, so the hand has to adapt while the picking stays the same.', instr: HOW + 'Two loops per fret, down to fret 7 and back up to 12. Pass: the whole trip twice without the stretch note coming late.', watch: 'The pinky missing fret 16→11 as the frets widen.', simplify: 'Frets 12 to 10 only.' })],
          ST('Moved fret by fret, the shape stays the same and the pitch slides chromatically: a pure left-hand pattern, no key.', 'This is how players warm the lick up and how it becomes a speed burst anywhere on the neck.', ['The frets get wider toward the nut: the same shape needs a bigger stretch.', 'Shift with the whole hand on the first note of the loop, not finger by finger.'])),
        S('pglick-positions', 'By position in a key', 'fretboard', 'The next scale note each time: the shape changes, every note stays in the key.', [
          L_('pglick-key-up', 'Up the key by position from fret 12, naming each shape ({key})', 'retrieval', { place: 'key', lo: 12, hi: 17, cycles: 2, step: 0.25, goal: 92, why: 'In a key, the lick moves to the next scale note each time and the shape changes by itself: {shapes}. Naming the shape before you play it turns the key into a map you remember.', instr: 'Two loops in each position: {where}, then back down. Before each position, say its shape (half–whole, whole–half or whole–whole). Then try it with the tab covered. Pass: up and back twice with every shape named and played right.', watch: 'Keeping the last shape out of habit: each position has its own.', simplify: 'The first three positions only.' }),
          L_('pglick-key-down', 'Down the key by position from fret 12 ({key})', 'variable', { place: 'key', lo: 5, hi: 12, cycles: 2, step: 0.25, goal: 92, down: true, why: 'The same key walk going down the neck: wider frets, the shapes in the opposite order, and the same picking.', instr: 'Two loops per position from the 12th fret down: {where}, and back up. Pass: the whole walk twice in time.', watch: 'Losing the key: every note is in it, so a wrong note means a wrong shape.', simplify: 'Four positions only.' })],
          ST('Three neighbouring notes of a key on the B string, then the next one on the e: moved to each next scale note, the lick climbs the key and the shape changes on its own.', 'This is how the lick becomes melodic: it can run up or down any key and land on any note.', ['In a major or minor key the B-string notes always form one of the three shapes.', 'The e-string note is the next scale note: a perfect 4th above the first note, or an augmented 4th once per octave (one fret further).'])),
        S('pglick-mirror', 'The 1+3 mirror', 'picking', 'One note on the B string, three on the e.', [
          L_('pglick-13', 'The 1+3 mirror: B 12, then e 12–13–15 (half–whole)', 'chunking', { place: 'fixed', form: '13', shapes: ['HW', 'WH', 'WW'], at: 12, cycles: 4, step: 0.25, goal: 92, why: 'Turned around, the lick has one note on the B string and three on the e: the same four strokes and the same outside changes, with the shapes now on the top string.', instr: 'Index on fret 12 of the B string (down), then index, middle/ring, pinky on the e string (up–down–up). Learn it in halves first: B→e, then the three e-string notes. Four loops in each shape. Pass: all three shapes clean at the goal tempo.', watch: 'Hitting the B string again during the e-string notes.', simplify: 'Half–whole only, 8th notes.' }),
          L_('pglick-31-13', '3+1, then 1+3: the lick and its mirror alternating every bar (half–whole at 12)', 'interleaving', { place: 'fixed', forms: ['31up', '13', '31up', '13'], shapes: ['HW'], at: 12, cycles: 4, step: 0.25, goal: 92, why: 'Alternating the lick and its mirror means the fretting hand can never settle into one string: exactly the switching a real line asks for.', instr: 'Four loops of the 3+1, four of the 1+3, and again. Every loop starts with a downstroke. Pass: the whole sequence twice without a wrong string.', watch: 'Starting the mirror on the e string: it begins with its single B-string note.', simplify: '8th notes.' })],
          ST('The mirror keeps the four strokes and the outside string changes but swaps the strings: one note on the B, three on the e.', 'Together with the 3+1 it covers both directions of the string change for this picking pattern.', ['The B-string note sits a perfect 4th below the first e-string note.'])),
        S('pglick-music-i', 'Over the changes', 'improv', 'A position for every chord; bursts in a solo.', [c => lickChanges(c), c => targetGuide(c, { prog: 'minorRock', scale: 'minor', name: 'Solo over i–♭VI–♭VII: one burst of the lick per phrase, then space' })],
          ST('Starting each bar’s lick on a note of that bar’s chord makes the fast loop sound like it belongs to the harmony.', 'Speed in a solo works when it is aimed: a burst that starts on a chord tone and lands somewhere.', ['Pick the chord tone nearest the hand: the positions are never far apart.']))
      ], [4, 6]),
    stage('advanced', 'Sextuplets, skips, the whole neck, every key',
      'Play the lick in sextuplets at 100 BPM with the beat accented, run one shape up and down the whole neck in 16ths, play the skipped-string version through a key, find positions called by degree, change key every block, and climb the positions into a held note over a progression.', [
        S('pglick-speed', 'Speed and the whole neck', 'picking', 'Sextuplets across the beat; frets 1 to 17 and back.', [
          L_('pglick-sext', 'Sextuplets: the four-note loop across the beat, accents on the click (half–whole at 12)', 'external-focus', { place: 'fixed', shape: 'HW', at: 12, cycles: 18, step: 1 / 6, goal: 88, why: 'In sextuplets the four-note loop no longer lines up with the beat: the click falls on a different note each time. Accenting the click, not the loop, keeps the line grooving and shows whether the picking is really even.', instr: HOW + 'Six notes per click; accent whichever note falls on the click. Listen for a clear pulse under the stream. Pass: 3 bars with every beat audible, at the goal tempo.', watch: 'Accenting the first note of the loop out of habit.', simplify: '16th notes.' }),
          L_('pglick-neck', 'The whole neck by fret: half–whole from fret 1 to 17 and back', 'variable', { place: 'chrom', shape: 'HW', frets: [1, 17], cycles: 1, step: 0.25, goal: 96, marks: false, why: 'One loop per fret over the whole neck: the shape shrinks as you climb and stretches as you come down, while the picking runs on. The complete chromatic map of the lick.', instr: HOW + 'One loop per fret, shift on every downstroke, up to fret 17 and back to fret 1. Pass: the whole trip at the goal tempo without a gap.', watch: 'The low frets: the stretch is widest there, so keep the thumb low behind the neck.', simplify: 'Frets 5 to 15.' })],
          ST('At speed the loop can be grouped against any pulse: in sextuplets it crosses the beat. And the same shape can run over the whole neck one fret at a time.', 'Crossing the beat makes a loop sound unpredictable and fast; the full neck builds stamina and shift accuracy.', ['Four-note loops in sextuplets realign every 2 beats (12 notes).', 'Fret spacing near the nut is about one and a half times that at the 12th fret.'])),
        S('pglick-skip', 'The skipped-string version', 'picking', 'Three notes on the G string, one on the high e.', [
          L_('pglick-skip', 'Skipped string: three notes on the G, one on the high e ({key})', 'variable', { place: 'key', form: 'skip', positions: [0, 1, 0, -1], cycles: 4, step: 0.25, goal: 88, why: 'Skipping the B string turns the loop into wide intervals (the e note lands a 6th or 7th above the first G-string note) and makes the pick jump two strings: the same picking with a much bigger target.', instr: 'Three notes on the G string (down–up–down), then the high e (up), the B string muted by the fretting fingers. Four loops in each position: {where}. Pass: all four positions clean at the goal tempo.', watch: 'The B string sounding: rest the side of the index finger on it.', simplify: 'One position, 8th notes.' }),
          L_('pglick-skip-walk', 'Skipped string up the key by position ({key})', 'edge', { place: 'key', form: 'skip', lo: 9, hi: 16, cycles: 2, step: 0.25, goal: 92, start: 54, why: 'Walking the skipped version through the key combines the wide jump with a shape change at every position. Climb the tempo ladder: the motion has to stay small as it gets faster.', instr: 'Two loops per position, up and back: {where}. Start at the start tempo and add 4 BPM after every clean pass. Pass: two clean passes at the goal tempo.', watch: 'Reaching for the e string with the whole arm.', simplify: 'Four loops per position, half tempo.' })],
          ST('With the B string skipped, the three notes go on the G string and the top note on the e: a wide-interval version of the same loop.', 'Wide intervals sound modern and less scale-like; skipping a string is the hardest version of the change.', ['G to e is a major 6th apart in standard tuning, so the e note sits a 6th or 7th above the first G-string note.', 'Mute the skipped B string with the underside of the fretting fingers.'])),
        S('pglick-keys', 'Any key, any position', 'fretboard', 'Four keys; positions called by degree.', [
          L_('pglick-keys4', 'Four keys around the cycle of fourths, positions near the 12th fret ({key} and up in 4ths)', 'interleaving', { place: 'key', keys: [0, 5, 10, 3], positions: [0, 1, 2, 1], at: 12, cycles: 2, step: 0.25, goal: 92, why: 'The lick moves by position in any key. Changing key every block forces you to rebuild the map each time, which is what real songs ask of you.', instr: 'Each key: four positions (up three and back one) near the 12th fret, two loops each. Say the key before each block. Pass: all four keys without stopping.', watch: 'Carrying shapes over from the last key: the shapes follow the new key.', simplify: 'Two keys.' }),
          L_('pglick-called', 'Positions called out of order: 5th, root, ♭3, ♭7, 4th ({key})', 'retrieval', { place: 'key', positions: [0, 3, -2, 2, -1], at: 12, cycles: 3, step: 0.25, goal: 92, why: 'Jumping to a position named by its first note (the 5th, the root…) forces you to find it from the key rather than slide from the last one: the way you will need it in a solo.', instr: 'Cover the tab. Three loops starting on each degree in turn, all near the 12th fret: {where}. Find the next position during the last loop. Pass: all five from memory at the goal tempo.', watch: 'Counting frets: picture the key instead.', simplify: 'The first three positions.' })],
          ST('Every position of the lick starts on a degree of the key; naming it by degree is how you find it in any key.', 'Finding the lick by degree turns it into a melodic tool, not just a finger pattern.', ['In a minor key, the position starting on the 5th ends on the root; the one starting on the root ends on the 4th.'])),
        S('pglick-music-a', 'In real music', 'improv', 'Climbing the key into a held note; a hard-rock solo.', [
          c => lickChanges(c, { id: 'pglick-climb', name: `Climbing by chord: the lick from each chord tone over i–♭VII–♭VI–♭VII (${keyName(c)})`, prog: c.minor ? [[0, 'm'], [10, ''], [8, ''], [10, '']] : [[0, ''], [7, ''], [9, 'm'], [5, '']] }),
          c => targetGuide(c, { prog: 'powerMinor', scale: 'minor', name: 'Hard-rock solo: lick bursts between long, bent notes' })],
          ST('In a solo, the lick works as a burst between long notes: fast, then held.', 'Contrast (speed against space) is what makes a fast lick exciting rather than tiring.', ['Start each burst on a chord tone; end it on a note you can hold.']))
      ], [7, 8]),
    stage('mastery', 'Anywhere, at speed, your own',
      'Run the whole neck in sextuplets at about 110 BPM, the 1+3 mirror through a key at speed, a random form, shape and fret every bar from memory, the lick in all 12 keys, and perform your own 8-bar piece built on it.', [
        S('pglick-perf', 'Performance tempo', 'picking', 'The whole neck and the mirror at speed.', [
          L_('pglick-neck-fast', 'The whole neck in sextuplets: half–whole from fret 3 to 17 and back', 'edge', { place: 'chrom', shape: 'HW', frets: [3, 17], cycles: 1, step: 1 / 6, goal: 92, start: 60, marks: false, why: 'The full chromatic trip at performance tempo: the shift on every loop with the picking on autopilot.', instr: HOW + 'One loop per fret, shifting on each downstroke. Use the tempo ladder: start at the start tempo and add a few BPM after every clean pass. Pass: the whole trip clean at the goal tempo.', watch: 'Forearm tension on the long run: breathe and keep the grip light.', simplify: '16th notes.' }),
          L_('pglick-13-key', 'The 1+3 mirror through the key at speed ({key})', 'edge', { place: 'key', form: '13', lo: 7, hi: 15, cycles: 2, step: 1 / 6, goal: 88, start: 58, why: 'The mirror moved by position, at speed: the shapes now change on the top string while the picking stays strict.', instr: 'Two loops per position: {where}, up and back. Tempo ladder to the goal. Pass: clean at the goal tempo, twice.', watch: 'The single B-string note going quiet.', simplify: '16th notes.' })],
          ST('Performance tempo is reached in small steps: a tempo just above the clean one, then a few BPM more.', 'The goal is the same small motion at a higher speed, not a harder motion.', ['Add 3–5 BPM only after two clean passes.'])),
        S('pglick-anywhere', 'Any form, any key', 'fretboard', 'No warning.', [c => lickRandom(c), c => lickTwelveKeys(c)],
          ST('At mastery the lick is available in any form, shape, position and key on demand.', 'Random practice is harder in the moment and sticks better afterwards.', ['The lick from the 5th to the root exists in every key; find the 5th on the B string first.'])),
        S('pglick-voice', 'Your own voice', 'improv', 'A study on the lick, then your own.', [c => lickEtude(c), c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp: bursts of the lick, each ending on a long note' })],
          ST('A capstone study puts every version of the lick into one piece of music, which you then rewrite as your own.', 'Mastery is using the lick musically, not just fast.', ['Plan where each burst starts and ends before you play it.']))
      ], [9, 10])
  ]
});
