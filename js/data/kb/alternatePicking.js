// Alternate picking: strict down-up picking, from the motion on one string to three-notes-per-string
// runs, bursts and sequences at performance tempo. The foundation of the Paul Gilbert course.
//
// Concept-first (CONTENT.md): the model is the stroke rule (every note alternates, whatever the
// string), the two kinds of string change it creates (inside: the pick changes strings between the
// two strings; outside: it has to travel around the string it just left or is heading for), the
// seven three-notes-per-string positions of any scale, the sequences of the pentatonic path, and
// note values. The composer `ap(c, spec)` builds an exercise from scale × position × strings ×
// sequence × note value; string-change drills are built from cells whose changes are all inside or
// all outside, checked by `changes()`.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-16: one string, the four-finger
// permutations starting on either stroke, string crossing (outside, inside, uneven counts on two strings),
// three-notes-per-string scales, sequences, accents, skips and position shifts, then licks in the style
// of the great pickers. Removed: naming each string change aloud ("in"/"out") and the from-memory and
// say-the-degree add-ons; no source combines them with picking drills.
import { OPEN, N, nameOf, minorKey, make, fromSeq, mod12, SCALE_BY_ID, S, stage, entry, M, targetGuide } from '../lib.js';
import { SEQUENCES } from './pentatonic.js';
import { position, econPlan } from './economyPicking.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const pcsOf = (k, scale) => SCALE_BY_ID[scale].steps.map(x => mod12(k + x));
const inScale = (k, scale, p) => pcsOf(k, scale).includes(mod12(p));
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
export const unitName = step => UNIT.get(step) || '8th notes';
const SCALE_NAME = { minor: 'natural minor', dorian: 'Dorian', harmonicMinor: 'harmonic minor', major: 'major' };
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Any group size: n notes up from each note, then n down from each note. */
export function groupsOf(l, n) { const up = [], dn = [], r = l.slice().reverse(); for (let i = 0; i + n <= l.length; i++) up.push(...l.slice(i, i + n)); for (let i = 0; i + n <= r.length; i++) dn.push(...r.slice(i, i + n)); return [...up, ...dn]; }
export const endOf = notes => Math.max(...notes.map(n => n.t + n.d));
/** Pad to a whole bar and land on the lowest root of the list. */
export function landOnRoot(notes, k, list) {
  const root = list.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || list[0];
  const t = endOf(notes), bar = Math.ceil((t + 1) / 4) * 4;
  notes.push(N(root[0], root[1], t, bar - t));
  return notes;
}
/**
 * The string changes strict alternate picking makes in a line: { inside, outside }. Going to a
 * higher string (lower number) after a downstroke, or to a lower string after an upstroke, the pick
 * must hop around the string: outside. The other two cases change strings between them: inside.
 */
export function changes(seq) {
  let inside = 0, outside = 0;
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1][0], b = seq[i][0]; if (a === b) continue;
    const down = (i - 1) % 2 === 0, toHigher = b < a;
    if (toHigher === down) outside++; else inside++;
  }
  return { inside, outside };
}
/** Note value for scale runs at a level: 8ths → triplets → 16ths → sextuplets. */
const stepFor = lvl => (lvl <= 3 ? 0.5 : lvl <= 5 ? 1 / 3 : lvl <= 8 ? 0.25 : 1 / 6);

/* ------------------------------- The composer ------------------------------- */
/**
 * One alternate-picking exercise from a spec: { id, name ('{key}', '{scale}'), method, scale, pos,
 * strings (keep only these), seq (a SEQUENCES name or a number for groups of n), step, goal, dl,
 * domain, why, instr ('{changes}' is filled in), watch, simplify }.
 */
export function ap(c, spec) {
  const k = minorKey(c), scale = spec.scale || 'minor';
  let list = position(k, scale, spec.pos || 1); if (!list) return null;
  if (spec.strings) list = list.filter(([s]) => spec.strings.includes(s));
  const step = spec.step || stepFor(c.lvl || 5);
  const seq = (typeof spec.seq === 'number' ? groupsOf(list, spec.seq) : (SEQUENCES[spec.seq || 'updown'] || SEQUENCES.updown)(list)).slice(0, 180);
  const notes = landOnRoot(fromSeq(seq, step), k, list);
  const ch = changes(seq), fill = s => s.replace('{key}', nameOf(k)).replace('{scale}', SCALE_NAME[scale] || scale).replace('{changes}', `${ch.inside} inside and ${ch.outside} outside string changes`);
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'picking', method: spec.method, unit: unitName(step), goal: spec.goal || 110, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'strict',
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}

/* ------------------------- Foundations: generators ------------------------- */
/** The motion alone: each note of the scale along the B string picked four times, down-up-down-up (accurate repetitions). */
export function oneString(c) {
  const k = minorKey(c), s = 2; let f0 = mod12(k - OPEN[s]); if (f0 > 9) f0 -= 12; if (f0 < 0) f0 += 12;
  const frets = []; for (let f = f0; f <= f0 + 12 && f <= 22; f++) if (inScale(k, 'minor', pitch(s, f))) frets.push(f);
  const step = (c.lvl || 2) <= 1 ? 0.5 : 0.25, seq = [];
  [...frets, ...frets.slice(0, -1).reverse()].forEach(f => { for (let r = 0; r < 4; r++) seq.push([s, f]); });
  const notes = fromSeq(seq, step); notes.push(N(s, frets[0], endOf(notes), 2));
  return make(c, {
    id: 'ap-one-string', name: `Down-up on one string: ${nameOf(k)} natural minor along the B string`, domain: 'picking', method: 'accurate-reps',
    unit: unitName(step), goal: 100, minutes: 4, picking: 'strict',
    why: 'Alternate picking is one small, relaxed motion repeated: down, up, down, up. On a single string there is nothing else to think about, so the motion can become even and light before string changes are added.',
    instr: 'Each note four times (down, up, down, up), then slide the fretting finger to the next scale note, up the string and back. Keep the motion small, from the wrist, with the pick just brushing the string. Count clean bars, not minutes. Pass: the whole string twice with every stroke the same volume.',
    watch: 'The upstroke being quieter than the downstroke.', simplify: 'Two strokes per note.', tab: { notes }
  });
}
/** Four frets, one finger each, across all six strings in a fingering order that changes with the level (chunking). */
export function spider(c) {
  const lvl = c.lvl || 2, orders = { 1: [1, 2, 3, 4], 2: [1, 3, 2, 4], 3: [2, 1, 4, 3] }, ord = orders[Math.min(3, Math.max(1, lvl))] || orders[1];
  const base = 4, seq = [];
  for (const s of [6, 5, 4, 3, 2, 1]) ord.forEach(fg => seq.push([s, base + fg]));
  for (const s of [1, 2, 3, 4, 5, 6]) ord.slice().reverse().forEach(fg => seq.push([s, base + 1 + fg]));
  const step = lvl <= 2 ? 0.5 : 1 / 3, notes = fromSeq(seq, step);
  return make(c, {
    id: 'ap-spider', name: `Four fingers, four frets: the ${ord.join('-')} fingering across all strings`, domain: 'picking', method: 'chunking',
    unit: unitName(step), goal: 96, minutes: 4, picking: 'strict',
    why: 'Before scales, the two hands have to agree: one finger per fret, one pick stroke per note, including on every string change. A fixed four-note pattern takes the notes out of the way so you can watch the coordination.',
    instr: `Fingers ${ord.join('-')} on frets 5–8 of each string, low E to high e, then shift up one fret and come back down in reverse order. Strict alternate picking, starting with a downstroke; then the whole thing again starting with an upstroke. Pass: up and down once each way with no missed or extra strokes.`,
    watch: 'Lifting fingers high off the fretboard: keep them hovering just above the strings.', simplify: 'Strings 3 to 1 only.', tab: { notes }
  });
}
/** Cells on every adjacent string pair whose string changes are all outside (3 + 3) or all inside (2-3-1) (chunking / variable). */
export function crossDrill(c, { type = 'outside' } = {}) {
  const k = minorKey(c), list = position(k, 'minor', 1); if (!list) return null;
  const on = s => list.filter(x => x[0] === s);
  const lvl = c.lvl || 4, step = lvl <= 3 ? 0.5 : lvl <= 5 ? 1 / 3 : 0.25, seq = [];
  for (const lo of [6, 5, 4, 3, 2]) {
    const L = on(lo), H = on(lo - 1); if (L.length < 3 || H.length < 3) return null;
    const cell = type === 'outside' ? [L[0], L[1], L[2], H[0], H[1], H[2]] : [L[0], L[1], H[0], H[1], H[2], L[1]];
    for (let r = 0; r < 2; r++) seq.push(...cell);
  }
  const ch = changes(seq), notes = landOnRoot(fromSeq(seq, step), k, list), out = type === 'outside';
  return make(c, {
    id: out ? 'ap-outside' : 'ap-inside', name: `${out ? 'Outside' : 'Inside'} string changes on every string pair (${nameOf(k)} natural minor)`, domain: 'picking', method: out ? 'chunking' : 'variable',
    unit: unitName(step), goal: out ? 100 : 96, minutes: 5, dl: out ? 0 : 1, picking: 'strict',
    why: out ? 'When you change strings, the pick either changes between the two strings (inside) or has to travel around the outside of them (outside). This cell, three notes on each string, makes every change an outside one, so you can work on that motion alone.'
      : 'Here every string change is inside: the pick has to hop between the two strings, which is where most picking breaks down (it is the change Paul Gilbert’s six-note lick drills). Two notes on the lower string, three on the upper, one back on the lower.',
    instr: `${out ? 'Three notes on the lower string, three on the upper' : 'Two notes on the lower string, three on the upper, one back on the lower'}, twice per string pair, then up a pair. Strict alternate picking starting with a downstroke: this line has ${ch.inside} inside and ${ch.outside} outside changes. Watch the pick at each change. Pass: every string pair clean, twice through.`,
    watch: out ? 'Hitting the string you are leaving on the way around: arc the pick just enough to clear it.' : 'Catching the neighbouring string when you hop: keep the pick slanted and the motion small.',
    simplify: 'One string pair, slower.', tab: { notes }
  });
}
/**
 * Two strings, uneven stroke counts (Guitarlessons.com "Right hand guitar exercise"): 4 on the lower
 * string, 1 on the upper, 4, 1, 2, 1, 3, a 16-stroke loop. Strict alternation makes the string change
 * fall after a downstroke one time and after an upstroke the next, so both inside and outside changes
 * come up without a pattern to lean on. More string pairs at higher levels.
 */
export function twoString(c) {
  const k = minorKey(c), list = position(k, 'minor', 1); if (!list) return null;
  const lvl = c.lvl || 2, pairs = lvl <= 1 ? [[5, 4]] : lvl === 2 ? [[5, 4], [4, 3]] : [[5, 4], [4, 3], [3, 2], [2, 1]];
  const counts = [4, 1, 4, 1, 2, 1, 3], seq = [];
  for (const [lo, hi] of pairs) {
    const L = list.filter(x => x[0] === lo)[0], H = list.filter(x => x[0] === hi)[1]; if (!L || !H) return null;
    for (let r = 0; r < 2; r++) counts.forEach((n, i) => { for (let j = 0; j < n; j++) seq.push(i % 2 ? H : L); });
  }
  const step = lvl <= 2 ? 0.5 : 0.25, notes = fromSeq(seq, step), ch = changes(seq);
  const end = endOf(notes); notes.push(N(pairs[0][0], list.filter(x => x[0] === pairs[0][0])[0][1], end, Math.max(1, Math.ceil((end + 1) / 4) * 4 - end)));
  return make(c, {
    id: 'ap-two-string', name: `Two strings, uneven counts: 4-1-4-1-2-1-3 (${nameOf(k)} natural minor, ${pairs.length} string pair${pairs.length > 1 ? 's' : ''})`, domain: 'picking', method: 'accurate-reps',
    unit: unitName(step), goal: 100, minutes: 4, picking: 'strict',
    why: 'Changing strings is where alternate picking usually breaks. Uneven groups (four, one, four, one, two, one, three) make the change come after a downstroke one time and after an upstroke the next, so you meet both kinds of change without a pattern to lean on.',
    instr: `On each string pair: four strokes on the lower note, one on the upper, four on the lower, one on the upper, two, one, three; twice, then the next pair. Never two strokes the same way in a row. This line has ${ch.inside} inside and ${ch.outside} outside string changes. Pass: the whole loop twice per pair with no stroke out of order.`,
    watch: 'Restarting each group with a downstroke: let the strokes keep alternating.', simplify: 'One string pair, quarter notes.', tab: { notes }
  });
}
/** A palm-muted rock riff: the chord root as a pedal, alternate picked, with scale notes on top (use in music). */
export function apRiff(c, { gallop = false } = {}) {
  const k = minorKey(c), roots = [0, 8, 10, 0].map(x => mod12(k + x)), chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  const step = gallop ? 0.25 : 0.5, notes = []; let t = 0;
  for (const r of roots) {
    let f = mod12(r - OPEN[6]); if (f < 1) f += 12; if (f > 12) f -= 12;
    // the scale notes above the root on the A string, near the root fret
    const tops = []; for (let x = Math.max(0, f - 3); x <= f + 4 && tops.length < 3; x++) if (inScale(k, 'minor', pitch(5, x)) && pitch(5, x) > pitch(6, f) + 2) tops.push(x);
    if (tops.length < 3) return null;
    const pat = gallop ? ['R', 'R', 'R', 'R', 0, 'R', 'R', 1, 'R', 'R', 'R', 'R', 2, 'R', 1, 'R'] : ['R', 'R', 0, 'R', 'R', 1, 'R', 2];
    pat.forEach(p => { notes.push(p === 'R' ? N(6, f, t, step, 'pm') : N(5, tops[p], t, step)); t += step; });
  }
  return make(c, {
    id: gallop ? 'ap-riff-16' : 'ap-riff', name: `Alternate-picked rock riff${gallop ? ' in 16ths' : ''} (${chords.join(' – ')})`, domain: 'rhythm', method: 'transfer',
    unit: unitName(step), goal: gallop ? 100 : 120, minutes: 5, backing: chords, chords,
    why: 'Most real alternate picking happens in riffs: a palm-muted root pedal with notes on the next string. Keeping strict down-up through the pedal and the accents is what makes a riff sound tight.',
    instr: `Palm-mute the low-string pedal (the edge of the picking hand resting on the strings at the bridge) and let the A-string notes ring a little more. Strict alternate picking${gallop ? ' in 16ths, even though the pedal notes repeat' : ''}: down on every beat${gallop ? '' : ', up on every “and”'}. One chord per bar. Pass: four bars locked to the click, then four bars with your own top notes.`,
    watch: 'Switching to all downstrokes when the pedal repeats: keep alternating.', simplify: 'Pedal notes only.', tab: { notes }
  });
}

/* ------------------------- Advanced: generators ------------------------- */
/** Speed bursts: a short fast cell on the beat, then a held landing note; longer bursts at higher levels (chunking toward speed). */
export function bursts(c) {
  const k = minorKey(c), list = position(k, 'minor', 1); if (!list) return null;
  const lvl = c.lvl || 7, n = lvl >= 8 ? 12 : 6, notes = []; let t = 0;
  const pairs = [[3, 2], [2, 1], [4, 3], [3, 2]];
  for (const [lo, hi] of pairs) {
    const L = list.filter(x => x[0] === lo), H = list.filter(x => x[0] === hi);
    const cell = [...L, ...H]; const burst = n === 6 ? cell : [...cell, ...cell.slice().reverse()];
    burst.forEach(([s, f], i) => notes.push(N(s, f, t + i / 6, 1 / 6)));
    const land = burst[burst.length - 1]; notes.push(N(land[0], land[1], t + n / 6, 4 - n / 6, '~'));
    t += 4;
  }
  return make(c, {
    id: 'ap-bursts', name: `Speed bursts: ${n} notes, then land (${nameOf(k)} natural minor)`, domain: 'picking', method: 'chunking',
    unit: '16th-note sextuplets', goal: 96, minutes: 4, dl: 1, picking: 'strict',
    why: 'A short burst at full speed followed by a rest lets the hand feel the target tempo without the tension that builds over long runs. Bursts are chunks that later join into lines.',
    instr: `Each bar: ${n} notes as fast sextuplets starting on the beat, then land on the last note and hold it. Relax completely during the held note. Pass: all four bursts clean at the goal tempo; then try them at 10 BPM above it.`,
    watch: 'Tensing up before the burst: breathe out and start loose.', simplify: 'Three-note bursts.', tab: { notes }
  });
}
/** The scale on strings 3 and 1, skipping the B string: two notes on each, alternate picked (variable). */
export function skipScale(c) {
  const k = minorKey(c), list = position(k, 'minor', 1); if (!list) return null;
  const G = list.filter(x => x[0] === 3), E = list.filter(x => x[0] === 1);
  const cell = [G[0], G[1], E[0], E[1], G[1], G[2], E[1], E[2]], seq = [...cell, ...cell.slice().reverse(), ...cell, ...cell.slice().reverse()];
  const notes = fromSeq(seq, 0.25); notes.push(N(G[0][0], G[0][1], endOf(notes), 2));
  return make(c, {
    id: 'ap-skip-scale', name: `String skipping: ${nameOf(k)} natural minor on the G and high e strings`, domain: 'picking', method: 'variable',
    unit: '16th notes', goal: 104, minutes: 4, dl: 1, picking: 'strict',
    why: 'Skipping a string makes the pick travel further between notes and turns the scale into wide, open intervals. It is a Paul Gilbert favourite and a hard test of how small and accurate your motion is.',
    instr: 'Two notes on the G string, two on the high e, then the next pair up on each; back down the same way. Strict alternate picking; the B string stays silent (touch it with the fretting fingers). Pass: 4 clean in a row at the goal tempo.', watch: 'Clipping the B string on the way across.', simplify: '8th notes.', tab: { notes }
  });
}
/** Harmonic-minor pedal-point lines on the high e: a chord tone alternating with the scale below it, through i–iv–V–i (use in music). */
export function pedalLine(c) {
  const k = minorKey(c), chords = [nameOf(k) + 'm', nameOf(k + 5) + 'm', nameOf(k + 7), nameOf(k) + 'm'], roots = [0, 5, 7, 0].map(x => mod12(k + x));
  const notes = []; let t = 0;
  for (const r of roots) {
    let p = OPEN[1] + 8; while (mod12(p) !== r) p++;                       // the chord root on the high e, frets 8–19
    const below = []; let q = p; while (below.length < 4) { q--; if (inScale(k, 'harmonicMinor', q)) below.push(q); }
    for (let rep = 0; rep < 2; rep++) below.forEach(b => { notes.push(N(1, p - OPEN[1], t, 0.25), N(1, b - OPEN[1], t + 0.25, 0.25)); t += 0.5; });
  }
  return make(c, {
    id: 'ap-pedal-line', name: `Pedal-point lines in ${nameOf(k)} harmonic minor (${chords.join(' – ')})`, domain: 'picking', method: 'transfer',
    unit: '16th notes', goal: 104, minutes: 5, dl: 1, picking: 'strict', backing: chords, chords,
    why: 'A pedal point (one note returning between every scale note) on a single string is a classic neoclassical alternate-picking line: no string changes, so it is all about an even, fast motion, and it outlines each chord clearly.',
    instr: 'On the high e: the chord root, then the scale notes below it one by one, returning to the root between each (root–note–root–note…). One chord per bar, the line repeats twice. Pass: four bars clean over the backing at the goal tempo.', watch: 'The pedal notes getting louder than the scale notes.', simplify: '8th notes.', tab: { notes }
  });
}
/** A new key every bar (cycle of fourths), or a random key, scale and position (interleaving). */
export function apKeys(c, { random = false } = {}) {
  const plan = econPlan(c, random), notes = [], names = []; let t = 0;
  for (const { k, scale, pos } of plan) {
    const list = position(k, scale, pos); if (!list) return null;
    const run = random ? list.slice(4, 16) : list.slice(0, 12);
    run.forEach(([s, f], i) => notes.push(N(s, f, t + i * 0.25, 0.25)));
    notes.push(N(run[11][0], run[11][1], t + 3, 1));
    names.push(random ? `${nameOf(k)} ${SCALE_NAME[scale]} (position ${pos})` : nameOf(k) + ' minor');
    t += 4;
  }
  return make(c, {
    id: random ? 'ap-random' : 'ap-keys', name: random ? 'A new key, scale and position every bar, alternate picked' : `Alternate picking through four keys: ${names.join(', ')}`, domain: 'picking', method: 'interleaving',
    unit: '16th notes', goal: 100, minutes: 5, dl: 1, picking: 'strict',
    why: random ? 'At mastery level the picking hand keeps going whatever the fretting hand has to do: a new key, scale and position every bar, the notes in the tab, the 16ths never stopping.' : 'Changing key every bar makes the fretting hand find the position while the picking hand keeps the 16ths going: the two hands learn to work independently.',
    instr: `${names.join(' → ')}. Twelve notes per bar, then hold the last while the fretting hand moves to the next position; the picking hand keeps its 16ths. Pass: all ${plan.length} bars without stopping${random ? ' at the goal tempo' : ', twice'}.`,
    watch: 'Stopping the picking hand while you search: lower the tempo instead.', simplify: random ? 'The first four bars only.' : 'Two keys back and forth.', tab: { notes }
  });
}
/** An original 8-bar alternate-picking study: riff, sequence, inside and outside cells, a descent, the landing (capstone). */
export function apEtude(c) {
  const k = minorKey(c), list = position(k, 'minor', 1), riff = apRiff({ ...c, key: k, minor: true }, { gallop: true }); if (!list || !riff) return null;
  const notes = riff.tab.notes.filter(n => n.t < 8).map(n => ({ ...n })); let t = 8;
  SEQUENCES.fours(list).slice(0, 32).forEach(([s, f]) => { notes.push(N(s, f, t, 0.25)); t += 0.25; });             // bars 3–4: groups of four
  const on = s => list.filter(x => x[0] === s), L = on(3), H = on(2);
  for (let r = 0; r < 4; r++) [L[0], L[1], H[0], H[1], H[2], L[1]].forEach(([s, f]) => { notes.push(N(s, f, t, 1 / 6)); t += 1 / 6; });   // bar 5: inside cell
  t = 20;
  for (let r = 0; r < 4; r++) [L[0], L[1], L[2], H[0], H[1], H[2]].forEach(([s, f]) => { notes.push(N(s, f, t, 1 / 6)); t += 1 / 6; }); // bar 6: outside cell
  t = 24;
  list.slice().reverse().forEach(([s, f]) => { notes.push(N(s, f, t, 1 / 6)); t += 1 / 6; });                        // bar 7: down the position
  const root = list.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || list[0];
  notes.push(N(root[0], root[1], 27, 1), N(root[0], root[1], 28, 4, '~'));
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: 'ap-capstone-etude', name: `Capstone study: an 8-bar alternate-picking piece (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'mixed rhythms', goal: 96, minutes: 8, dl: 1, picking: 'strict', backing: [...chords, ...chords], chords,
    why: 'An original piece that uses the whole path: a galloping palm-muted riff, a sequence in 16ths, inside and outside string-change cells as sextuplets, a full descent and a held landing. Mastery is playing it with one relaxed motion throughout.',
    instr: 'Learn it two bars at a time, then join the halves. Strict alternate picking everywhere, starting each bar with a downstroke. Then write your own 8 bars to the same plan. Pass: the study at the goal tempo with no stops, then your own version played through once.',
    watch: 'Tension creeping in at bar 5 (the inside cell): drop the shoulders and keep the motion small.', simplify: 'Bars 1–4 only.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const A = (id, name, method, opts) => c => ap(c, { id, name, method, ...opts });
/* ------------------------------ Study notes ------------------------------ */
const ST = (concept, why, theory) => ({ concept, why, theory });
const STUDY = {
  'ap-motion': ST('Alternate picking means every note gets the opposite stroke to the one before: down, up, down, up, whatever the string. The motion is small and comes from the wrist, with the pick only just passing through the string.', 'Every later skill (string changes, scales, sequences, speed) is this one motion applied to more notes; if it is tense or uneven here, it stays that way.', ['Down- and upstrokes should sound the same.', 'The four-finger pattern takes the notes out of the way so you can watch the hands work together.']),
  'ap-cross': ST('A string change happens after a downstroke or after an upstroke. Three notes on each string makes every change an "outside" one, where the pick travels around the outside of the two strings.', 'Most picking problems start at string changes; learning one kind at a time makes them reliable.', ['Outside: the pick leaves one string and approaches the next from the far side.', 'Starting a line on an upstroke flips every change the other way round.']),
  'ap-sound': ST('Evenness is judged by ear: no note louder, softer or shorter than its neighbours. Uneven stroke counts on two strings make the string change land after both kinds of stroke.', 'A line only sounds fast and clean when every note is equal, and real music changes strings after downstrokes and upstrokes alike.', ['Downstrokes are naturally a little louder: aim the upstroke at the sound.', '4-1-4-1-2-1-3 is sixteen strokes: one bar of 16ths.']),
  'ap-first-music': ST('In a riff, alternate picking keeps going through a palm-muted pedal note and the notes above it.', 'Riffs are where most players use alternate picking every day.', ['Palm mute: the edge of the picking hand rests on the strings at the bridge.', 'Down on the beat, up on the "and".']),
  'ap-3nps': ST('Three notes per string lays a seven-note scale out in seven positions, each starting on the next scale note on the low E string. Alternate picked, the string changes alternate between outside and inside.', 'It is the standard fingering for scale-based picking practice, and moving position by position joins the whole neck.', ['Position 1 starts on the root, position 2 on the 2nd degree, position 5 on the 5th.', 'An odd number of notes per string flips the stroke at every new string.']),
  'ap-inside': ST('An inside change is the harder one: the pick has to get from between the two strings onto the next one. Playing the position in 3rds mixes inside and outside changes unpredictably.', 'Inside changes are where the pick most often catches the wrong string.', ['Inside: the pick moves between the two strings it is changing between.', 'Two on the lower string, three on the upper, one back: every change inside.']),
  'ap-sequences': ST('A sequence plays the scale in groups (three, four or five notes up from each note, then down), so the line moves forward while repeating a shape.', 'Sequences are how scales become lines, and each group size puts the strokes and the string changes in new places.', ['Groups of 3 as triplets and groups of 4 as 16ths put a downstroke on every beat.', 'Groups of 5 in 16ths start on a different stroke each time.']),
  'ap-music': ST('A 16th-note riff and a solo over a minor rock progression: the same motion in music.', 'Technique is only finished when it works with a band.', ['The pedal note keeps the 16ths going between the riff notes.']),
  'ap-speed': ST('Speed is built in short loops at the target tempo with a rest between them, and accents that make the groups audible. Groups of three in 16ths make the accent move across the beat.', 'Short bursts avoid the tension that builds over long fast runs; accents turn speed into phrases.', ['Three-note groups against four 16ths line up again every three beats.', 'Relax completely on the held note after each burst.']),
  'ap-skip': ST('String skipping jumps over a string between notes; changing key every bar makes the fretting hand move while the picking keeps going.', 'Wide intervals and moving hands are where precision is tested.', ['Mute the skipped string with the fretting hand.', 'A key a 4th higher moves the position five frets up (or seven down).']),
  'ap-colors': ST('Dorian is natural minor with a major 6th; harmonic minor is natural minor with a raised 7th, which leaves a gap of three frets between the ♭6 and the 7th.', 'These scales change the stretches under the same picking, and harmonic minor is the sound of neoclassical alternate picking.', ['Dorian: R 2 ♭3 4 5 6 ♭7.', 'Harmonic minor: R 2 ♭3 4 5 ♭6 7.']),
  'ap-adv-music': ST('A pedal point returns to one note between every scale note. On a single string it is a pure, fast alternate-picking line that outlines each chord.', 'It is a classic neoclassical device and needs no string changes, so the motion itself is exposed.', ['i–iv–V–i in harmonic minor: the V chord is major because of the raised 7th.']),
  'ap-performance': ST('Performance tempo is reached by a tempo ladder: a few BPM more after each clean pass, never more than the hand can keep relaxed.', 'Long lines at speed are the goal of the path; groups of six put one group on every beat.', ['Six notes a beat = 16th-note sextuplets.', 'Add 3–5 BPM after two clean passes.']),
  'ap-random': ST('A new key, scale and position every bar: the picking hand keeps going while the fretting hand moves.', 'In real music the scale and position change all the time; the picking must not stop for them.', ['The notes are in the tab: the challenge is the change, not the memory.']),
  'ap-voice': ST('A capstone study uses everything in the path (riff, sequence, inside and outside cells, a descent), then you write your own on the same plan.', 'Mastery is using the technique musically, not only as an exercise.', ['Learn it two bars at a time, then join the halves.'])
};
const path = entry({
  id: 'alternatePicking', kind: 'technique', title: 'Alternate picking', domain: 'picking',
  re: /alternate.?pick|strict.?pick|down.?up pick|(inside|outside) (picking|string chang)/,
  aliases: ['strict alternate picking', 'inside and outside picking'],
  sources: ['https://www.premierguitar.com/lessons/cram-session-alternate-picking', 'https://www.guitarchalk.com/alternate-picking-exercises/', 'https://justinguitar.com/guitar-lessons/the-spider-te-201', 'https://guitarlessons.com/guitar-lessons/exercises-and-fretboard-navigation/right-hand-guitar-exercise/', 'https://www.guitarworld.com/lessons/intense-rock-picking-a-brief-look-at-paul-gilberts-alternate-picking-technique', 'https://www.dummies.com/article/inside-and-outside-picking-on-the-guitar-143479', 'https://forum.troygrady.com/t/alternate-picking-exercise-that-switches-between-inside-and-out/6923'],
  summary: 'Strict down-up picking from scratch: the motion on one string, inside and outside string changes, three-notes-per-string scales and sequences, bursts and accents, up to performance tempo.',
  pedagogy: {
    date: '2026-10-16',
    summary: 'Alternate picking is taught from a small, relaxed down-up motion on one string, then the four-finger (spider) permutations across the strings starting on either stroke, then string crossing on two and three strings (outside and inside changes), then three-notes-per-string scales, sequences in groups, accents, string skipping and position shifts, and finally licks in the style of the great pickers, always with a metronome and small tempo increases.',
    sequence: [
      { id: 'motion', tier: 'foundations', step: 'One string, then the four-finger pattern across the strings', how: 'Single-string 8ths, then 16ths, with a small relaxed motion; then the 1-2-3-4 (spider) permutations across all six strings, learning the fingering first and then watching the picking hand.', skills: ['ap-motion'], source: 1 },
      { id: 'cross', tier: 'foundations', step: 'String crossing, starting with a downstroke and with an upstroke', how: 'Run each pattern across the strings once starting down and once starting up; three notes per string makes every change outside.', skills: ['ap-cross'], source: 0 },
      { id: 'two-string', tier: 'foundations', step: 'Two strings with uneven stroke counts; even volume', how: 'Four strokes on one string, one on the next, four, one, two, one, three: strict alternation puts the change after both strokes; any notes on two adjacent strings will do.', skills: ['ap-sound'], source: 3 },
      { id: 'licks', tier: 'foundations', step: 'Apply it in riffs and licks in the style of known players', how: 'Riffs, pentatonic and harmonic-minor licks and string-skipped lines in the styles of Eric Johnson, Zakk Wylde, Malmsteen and Paul Gilbert, over a click or backing.', skills: ['ap-first-music', 'ap-music', 'ap-adv-music'], source: 0 },
      { id: 'scales', tier: 'intermediate', step: 'Three-notes-per-string scales, position by position', how: 'A three-notes-per-string scale up and down, then the next position; the same picking in every position.', skills: ['ap-3nps'], source: 0 },
      { id: 'inside-outside', tier: 'intermediate', step: 'Inside and outside picking', how: 'Separate drills for inside changes (the pick between the strings) and outside changes (around them), then lines that mix both.', skills: ['ap-inside'], source: 1 },
      { id: 'sequences', tier: 'intermediate', step: 'Sequences: groups of three, four and five', how: 'Ascending and descending note cells through the scale (groups of four, then reversed), with a metronome.', skills: ['ap-sequences'], source: 0 },
      { id: 'accents', tier: 'advanced', step: 'Accents and short loops at speed', how: 'Accent each group of 16ths; loop short patterns and raise the tempo 5–10 BPM at a time once each tempo is clean.', skills: ['ap-speed'], source: 1 },
      { id: 'skip-shift', tier: 'advanced', step: 'String skipping and position shifts', how: 'Scale lines on two non-adjacent strings, started slowly; lines that shift position as they go.', skills: ['ap-skip'], source: 0 },
      { id: 'other-scales', tier: 'advanced', step: 'Harmonic minor and other scales', how: 'Harmonic-minor figures in strict time, the neoclassical way, and other scales under the same picking.', skills: ['ap-colors'], source: 0 },
      { id: 'performance', tier: 'mastery', step: 'Long lines at performance tempo', how: 'Groups of six over 16ths and long descending lines, tempo raised only when clean and relaxed.', skills: ['ap-performance'], source: 0 },
      { id: 'anywhere', tier: 'mastery', step: 'Any key, scale and position', how: 'The fretting hand changes key, scale and position while the picking keeps going.', skills: ['ap-random'], source: 0 },
      { id: 'own', tier: 'mastery', step: 'Your own study', how: 'Combine riff, sequences, string changes and a descent in one piece, then write your own.', skills: ['ap-voice'], source: 0 }
    ],
    drills: ['Single-string 8ths and 16ths', 'Four-finger permutations (1234, 1324, 2134 …) across the strings, starting down and starting up', 'Two strings with uneven stroke counts (4-1-4-1-2-1-3)', 'Inside and outside string-change cells', 'Three-notes-per-string scales in groups of four, ascending and reversed', 'Accented groups of 16ths', 'String-skipped scale lines', 'Tremolo and short loops with the tempo raised 5–10 BPM at a time'],
    mistakes: ['A tense wrist and big picking motions', 'Starting too fast and raising the tempo before the line is clean', 'Practising without a metronome', 'Two strokes the same way in a row at a string change', 'Watching the fretting hand instead of the picking', 'Neglecting the fretting hand, which must keep up with the pick', 'Letting unused strings ring'],
    sources: [
      { title: 'Cram Session: Alternate Picking', author: 'Jamie Humphries (Premier Guitar)', url: 'https://www.premierguitar.com/lessons/cram-session-alternate-picking' },
      { title: '20 Alternate Picking Exercises', author: 'Bobby Kittleberger (Guitar Chalk)', url: 'https://www.guitarchalk.com/alternate-picking-exercises/' },
      { title: 'The Spider', author: 'Justin Sandercoe (JustinGuitar)', url: 'https://justinguitar.com/guitar-lessons/the-spider-te-201' },
      { title: 'Right Hand Guitar Exercise', author: 'Guitarlessons.com', url: 'https://guitarlessons.com/guitar-lessons/exercises-and-fretboard-navigation/right-hand-guitar-exercise/' }
    ]
  },
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The motion and the string change',
      'Pick every note of a scale along one string four times with even volume at 90 BPM in 16ths, play the four-finger pattern across all six strings starting with either stroke, cross every string pair with outside changes in 8ths, play the 4-1-4-1-2-1-3 two-string loop without breaking the alternation, keep down- and upstrokes the same volume, and keep a palm-muted 8th-note riff locked to the click.', [
        S('ap-motion', 'The motion', 'picking', 'Down, up, down, up: small and even.', [c => oneString(c), c => spider(c)]),
        S('ap-cross', 'Changing strings', 'picking', 'Outside changes first, then starting on an upstroke.', [c => crossDrill(c, { type: 'outside' }),
          A('ap-upstroke-start', '{key} {scale} on the top three strings, starting with an upstroke', 'accurate-reps', { pos: 1, strings: [3, 2, 1], seq: 'updown', step: 0.5, goal: 104, why: 'A line that starts with an upstroke turns every string change the other way round. Good picking works from either stroke, so practise both until neither feels like the “wrong” one.', instr: 'Up the top three strings of the position and back, first starting with a downstroke, then the same line starting with an upstroke. This line has {changes} when started with a downstroke. Pass: both versions clean twice.', watch: 'Sneaking in two downstrokes in a row to get back to “normal”.', simplify: 'Two strings.' })]),
        S('ap-sound', 'Even strokes, uneven counts', 'picking', 'Every note the same; string changes after either stroke.', [
          A('ap-even', '{key} {scale} on the B and high e: one volume, one length', 'external-focus', { pos: 1, strings: [2, 1], seq: 'updown', step: 0.5, goal: 100, why: 'Downstrokes are naturally louder than upstrokes. Aiming at the sound (every note the same volume and length) evens the two out faster than thinking about the wrist.', instr: 'Up and down the two strings in 8ths, strict alternate picking. Record yourself, or close your eyes: you should not be able to tell which notes are downstrokes. Pass: 4 passes in a row where no note pops out or drops away.', watch: 'Upstrokes catching only the edge of the string.', simplify: 'One string.' }),
          c => twoString(c)]),
        S('ap-first-music', 'First music', 'rhythm', 'A riff, then phrases.', [c => apRiff(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minor' }])])
      ], [1, 3]),
    stage('intermediate', 'Three notes per string',
      'Play a full three-notes-per-string position up and down at 110 BPM in triplets, cross every string pair with inside changes, run positions 1, 2 and 5 and groups of 3, 4 and 5 through the position, and play an alternate-picked riff in 16ths.', [
        S('ap-3nps', 'Three notes per string', 'picking', 'Paul Gilbert’s favourite way to practise picking.', [
          A('ap-3nps', '{key} {scale}, three notes per string', 'accurate-reps', { pos: 1, seq: 'updown', goal: 112, why: 'Three notes per string alternates the string-change type: one change is outside, the next inside. Running the whole position is the best all-round picking workout there is.', instr: 'Up and down the position, strict alternate picking, starting with a downstroke. The line has {changes}. Pass: 4 clean repetitions in a row.', watch: 'Speeding up on the easy strings.', simplify: 'The top three strings.' }),
          A('ap-3nps-pos2', '{key} {scale}, position 2', 'variable', { pos: 2, seq: 'updown', goal: 110, why: 'Position 2 starts on the 2nd degree: a different finger stretch on every string, the same picking. Moving one position up at a time is how the seven positions join into the whole neck.', instr: 'Up and down the position. This line has {changes}. Pass: 4 clean in a row.', watch: 'Fingering it like position 1.', simplify: 'The top three strings.' }),
          A('ap-3nps-pos5', '{key} {scale}, position 5', 'variable', { pos: 5, seq: 'updown', goal: 110, why: 'The same picking on a different set of stretches: position 5 starts on the 5th of the key. Every position should feel the same to the picking hand.', instr: 'Up and down the position, strict alternate picking. This line has {changes}. Pass: 4 clean in a row.', watch: 'The fretting hand lagging on the wider stretches.', simplify: 'The bottom three strings.' })]),
        S('ap-inside', 'Inside changes', 'picking', 'The harder change, and both kinds mixed.', [c => crossDrill(c, { type: 'inside' }),
          A('ap-pairs', '{key} {scale}, two notes at a time on two strings', 'interleaving', { pos: 1, seq: 'thirds', goal: 104, why: 'Playing the position in 3rds mixes inside and outside changes unpredictably, so you can’t settle into one motion.', instr: 'The position in 3rds (every other note) up and back. It has {changes}. Pass: 4 clean in a row.', watch: 'Hitting the skipped note.', simplify: 'Ascending only.' })]),
        S('ap-sequences', 'Sequences', 'picking', 'Groups of 3, 4 and 5.', [
          A('ap-threes', '{key} {scale} in groups of 3', 'variable', { pos: 1, seq: 'threes', step: 1 / 3, goal: 112, why: 'Groups of three as triplets put a downstroke on every beat.', instr: 'Three up from each note, then down in threes. Accent the first of each group. Pass: 4 clean at the goal tempo.', watch: 'Losing the group at the string change.', simplify: 'Ascending only.' }),
          A('ap-fives', '{key} {scale} in groups of 5, as 16ths', 'variable', { pos: 1, seq: 5, step: 0.25, goal: 100, why: 'Five notes against four per beat: each group starts on a different part of the beat and on alternating strokes, so the picking hand has to keep alternating without any pattern to lean on.', instr: 'Five up from each note, then five down, in steady 16ths. Every group starts with the opposite stroke from the one before: let it. Pass: 4 clean at the goal tempo.', watch: 'Restarting each group with a downstroke.', simplify: 'Quintuplets: one group per beat.' }),
          A('ap-fours', '{key} {scale} in groups of 4', 'variable', { pos: 1, seq: 'fours', step: 0.25, goal: 104, why: 'Groups of four in 16ths: the backbone of rock and metal runs, a downstroke on every beat.', instr: 'Four up from each note, then four down. Pass: 4 clean at the goal tempo.', watch: 'Rushing the last note of each group.', simplify: '8th notes.' })]),
        S('ap-music', 'In music', 'rhythm', 'A 16th-note riff and a solo.', [c => apRiff(c, { gallop: true }), c => targetGuide(c, { prog: 'minorRock', scale: 'minor' })])
      ], [4, 6]),
    stage('advanced', 'Speed, skips and accents',
      'Play 12-note bursts cleanly at 110 BPM in sextuplets, skip strings through the scale in 16ths at 100, move the accent with groups of 3 in 16ths, change key every bar without stopping, play Dorian in threes and harmonic minor in fours, and play harmonic-minor pedal lines over i–iv–V.', [
        S('ap-speed', 'Bursts and accents', 'picking', 'Short bursts at full speed; accents that move.', [c => bursts(c),
          A('ap-accent-3', '{key} {scale} in groups of 3, as 16ths', 'variable', { pos: 1, seq: 'threes', step: 0.25, goal: 104, why: 'Groups of three played as 16ths make the accent land in a different place every beat: three against four. Accents are what make fast picking sound like phrases.', instr: 'Accent the first note of each group of three while the click marks the beats: the accent drifts across the beat and returns every three beats. Pass: 4 clean with the accents audible.', watch: 'Turning it into triplets.', simplify: 'Triplets first, then 16ths.' })]),
        S('ap-skip', 'Skips and keys', 'picking', 'Wider jumps; the scale in any key.', [c => skipScale(c), c => apKeys(c)]),
        S('ap-colors', 'Other scales: Dorian and harmonic minor', 'picking', 'New stretches under the same picking.', [
          A('ap-dorian-threes', '{key} {scale}, position 2, in groups of 3 as sextuplets', 'variable', { scale: 'dorian', pos: 2, seq: 'threes', step: 1 / 6, goal: 96, why: 'Dorian (natural minor with a major 6th) is the scale of funk, fusion and much rock soloing. Groups of three in sextuplets put two groups in every beat, with the accent switching between downstroke and upstroke.', instr: 'Three up from each note, then three down, two groups per beat. Accent each beat. Pass: 4 clean at the goal tempo.', watch: 'Playing the ♭6 of natural minor out of habit: Dorian’s 6th is a fret higher.', simplify: '16ths.' }),
          A('ap-harmonic-fours', '{key} {scale}, position 1, in groups of 4', 'variable', { scale: 'harmonicMinor', pos: 1, seq: 'fours', step: 0.25, goal: 100, why: 'The harmonic minor’s raised 7th leaves a gap of three frets after the ♭6, which changes the fingering on two strings. Sequencing the position in fours, in strict time, is the neoclassical way to make that gap automatic.', instr: 'Play the position up and down once, then in groups of four, up and down, strict alternate picking. Pass: twice through at the goal tempo with the raised 7th in tune every time.', watch: 'Flattening the 7th back to natural minor on the second string.', simplify: 'Ascending only, 8th notes.' })]),
        S('ap-adv-music', 'Neoclassical lines', 'picking', 'Pedal points over i–iv–V.', [c => pedalLine(c), c => targetGuide(c, { prog: 'iiVIminor', scale: 'harmonicMinor' })])
      ], [7, 8]),
    stage('mastery', 'Performance tempo and your own',
      'Run groups of 6 as sextuplets at about 110 BPM and groups of 4 through position 5 at 120 in 16ths, keep the 16ths going through a new key, scale and position every bar, and perform your own 8-bar alternate-picking piece.', [
        S('ap-performance', 'Performance tempo', 'picking', 'Long lines at speed.', [
          A('ap-sixes', '{key} {scale} in groups of 6, sextuplets', 'edge', { pos: 1, seq: 'sixes', step: 1 / 6, goal: 88, why: 'One six-note group per beat: long, fast lines that still divide clearly into beats, and the standard test of a fast alternate picker.', instr: 'One group per beat, accent the first note. Use the tempo ladder: start below the goal, add a few BPM after each clean pass. Pass: 4 clean at the goal tempo.', watch: 'Forearm tension: stop and shake out.', simplify: '16th notes.' }),
          A('ap-fours-pos5', '{key} {scale}, position 5 in groups of 4', 'edge', { pos: 5, seq: 'fours', step: 0.25, goal: 96, why: 'The same sequence in another position at performance tempo proves the speed belongs to the hand, not to one shape.', instr: 'Groups of four up and down position 5 in 16ths, tempo ladder to the goal. Pass: 4 clean at the goal tempo.', watch: 'Fretting-hand fingers flying off: stay close.', simplify: 'Triplets.' })]),
        S('ap-random', 'Any key, any scale', 'picking', 'The fretting hand moves; the pick never stops.', [c => apKeys(c, { random: true }), c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian' })]),
        S('ap-voice', 'Your own voice', 'improv', 'A study that uses everything, then your version.', [c => apEtude(c), c => targetGuide(c, { prog: 'progMinor', scale: 'minor' })])
      ], [9, 10])
  ]
});
for (const st of path.stages) for (const sk of st.skills) if (STUDY[sk.id] && !sk.study) sk.study = STUDY[sk.id];
export default path;
