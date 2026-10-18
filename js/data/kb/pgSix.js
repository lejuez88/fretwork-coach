// The two-string pentatonic cell: a six-note pentatonic cell on two strings, strict alternate picked,
// that drills the inside string change. A related drill from Paul Gilbert's picking vocabulary (not "the
// Paul Gilbert lick", which is the six-note B-string loop in pgLick.js), from the slow cell to performance tempo through all
// five boxes, in every key and in licks.
//
// Concept-first (CONTENT.md): the model is the cell itself as positions in a pentatonic box: on a
// pair of strings with two box notes each (L0 < L1 on the lower string, H0 < H1 on the upper), the
// ascending cell is L0 L1 H0 H1 H0 L1 (every string change inside) and its mirror H1 H0 L1 L0 L1 H0
// (every change outside). The composer `six(c, spec)` builds an exercise from cell direction ×
// string pairs (adjacent or skipping a string) × boxes × keys × note value × repetitions.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-18: the cell in halves, then the
// inside change alone and against the outside change on the same two strings, the cell on every pair
// of the box, first music; then the mirror, other boxes, accents and zig-zags; then sextuplets, string
// skips, keys; then performance tempo and a study. Removed: the ear quiz with the tab covered
// (`pgsix-echo`), the "from memory" versions (`pgsix-find`, `pgsix-box2-memory`, `pgsix-boxes-called`,
// "read only the names" in `pgsix-random`) and the quiet/loud drill no source teaches
// (`pgsix-dynamics`, now accents moved through the cell). Study notes added to every skill.
import { OPEN, N, nameOf, minorKey, make, fromSeq, pentBox, byString, mod12, S, stage, entry, M, targetGuide } from '../lib.js';
import { unitName, changes, rng, endOf } from './alternatePicking.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const ALL_PAIRS = [[6, 5], [5, 4], [4, 3], [3, 2], [2, 1]];
/** The cell on one pair of strings of a box: up = all inside changes, down (the mirror) = all outside. */
export function cell(k, box, lo, hi, dir = 'up') {
  const B = byString(pentBox(k, box)); if (!B[lo] || !B[hi]) return null;
  const L0 = [lo, B[lo][0]], L1 = [lo, B[lo][1]], H0 = [hi, B[hi][0]], H1 = [hi, B[hi][1]];
  return dir === 'up' ? [L0, L1, H0, H1, H0, L1] : [H1, H0, L1, L0, L1, H0];
}
/** The plan of a random lesson: one { k, box, pair } per bar, fixed per level. */
export function sixPlan(c) {
  const r = rng(307 + (c.lvl || 9)), out = [];
  for (let bar = 0; bar < 8; bar++) out.push({ k: Math.floor(r() * 12), box: 1 + Math.floor(r() * 5), pair: ALL_PAIRS[1 + Math.floor(r() * 4)] });
  return out;
}

/* ------------------------------- The composer ------------------------------- */
/**
 * One six-note-lick exercise from a spec: { id, name ('{key}'), method, dir ('up'|'down'), pairs,
 * boxes, keys (offsets from the key, one per block), alt (switch up/mirror on every block), step, reps (cells per pair), goal, dl, why,
 * instr ('{changes}'), watch, simplify }.
 */
export function six(c, spec) {
  const k0 = minorKey(c), seq = [];
  const keys = spec.keys || [0]; let block = 0;
  for (const off of keys) for (const box of spec.boxes || [1]) for (const [lo, hi] of spec.pairs || [[2, 1]]) {
    const dir = spec.alt ? (block++ % 2 ? 'down' : 'up') : spec.dir || 'up';
    const cl = cell(mod12(k0 + off), box, lo, hi, dir); if (!cl) return null;
    for (let r = 0; r < (spec.reps || 2); r++) seq.push(...cl);
  }
  const step = spec.step || 1 / 6, notes = fromSeq(seq.slice(0, 300), step);
  const last = seq[seq.length - 1]; notes.push(N(last[0], last[1], endOf(notes), 1, '~'));
  const ch = changes(seq.slice(0, 6));
  return make(c, {
    id: spec.id, name: spec.name.replace('{key}', `${nameOf(k0)} minor`), domain: 'picking', method: spec.method, unit: unitName(step), goal: spec.goal || 100, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'strict',
    why: spec.why, instr: spec.instr.replace('{changes}', `${ch.inside} inside and ${ch.outside} outside`), watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
const X = (id, name, method, opts) => c => six(c, { id, name, method, ...opts });

/* ------------------------- Foundations: generators ------------------------- */
/** The cell in two halves on the top strings, each looped, then joined (chunking). */
export function sixParts(c) {
  const k = minorKey(c), cl = cell(k, 1, 2, 1); if (!cl) return null;
  const step = (c.lvl || 2) <= 1 ? 0.5 : 1 / 3, seq = [];
  for (let r = 0; r < 4; r++) seq.push(...cl.slice(0, 3));
  for (let r = 0; r < 4; r++) seq.push(...cl.slice(3));
  for (let r = 0; r < 4; r++) seq.push(...cl);
  const notes = fromSeq(seq, step); notes.push(N(cl[0][0], cl[0][1], endOf(notes), 2));
  return make(c, {
    id: 'pgsix-parts', name: `The two-string cell in two halves (${nameOf(k)} minor pentatonic, top strings)`, domain: 'picking', method: 'chunking',
    unit: unitName(step), goal: 96, minutes: 4, picking: 'strict',
    why: 'The lick is two three-note halves: up across the string change, then back. Looping each half alone lets you fix the hard moment (the pick hopping between the B and high e strings) before joining them.',
    instr: 'Loop the first half (two notes on the B string, one on the high e) four times, then the second half (high e, high e, back to the B) four times, then the whole lick four times. Strict alternate picking, starting with a downstroke. Pass: the whole lick 4 times in a row with no extra or missing strokes.',
    watch: 'Hammering the second note instead of picking it.', simplify: '8th notes, half tempo.', tab: { notes }
  });
}
/** Only the two string changes of the cell, looped: the inside hop in both directions (chunking). */
export function insideHop(c) {
  const k = minorKey(c), cl = cell(k, 1, 2, 1); if (!cl) return null;
  const [, L1, H0] = cl, step = (c.lvl || 2) <= 1 ? 0.5 : 0.25, seq = [];
  for (let r = 0; r < 16; r++) seq.push(L1, H0);
  const notes = fromSeq(seq, step);
  return make(c, {
    id: 'pgsix-hop', name: `The inside hop: two notes, two strings (${nameOf(k)} minor pentatonic)`, domain: 'picking', method: 'chunking',
    unit: unitName(step), goal: 100, minutes: 3, picking: 'strict',
    why: 'The heart of the two-string cell is one motion: an upstroke on the B string followed by a downstroke on the high e, with the pick hopping between the two strings. Isolating it on two notes is the fastest way to make it reliable.',
    instr: 'Upstroke on the B-string note, downstroke on the high-e note, over and over. The pick travels between the two strings each time: keep the hop as small as possible and listen for both notes being equally loud. Pass: 8 bars without catching a wrong string.',
    watch: 'A big, loopy motion: the hop only has to clear one string.', simplify: 'Start with a downstroke on the B string instead (an outside change), then switch back.', tab: { notes }
  });
}
/**
 * Outside, then inside, on the same two strings: the cell's two string-change notes (the B-string note
 * L1 and the high-e note H0) alternate picked starting with a downstroke on the B (outside), then with an
 * upstroke on the B (inside), a bar each, then two cells.
 */
export function inOut(c) {
  const k = minorKey(c), cl = cell(k, 1, 2, 1); if (!cl) return null;
  const [, L1, H0] = cl, step = (c.lvl || 2) <= 1 ? 0.5 : 0.25, notes = []; let t = 0;
  for (let bar = 0; bar < 4; bar++) {
    const inside = bar % 2 === 1;
    for (let i = 0; i < 4 / step; i++) { const [s, f] = i % 2 ? H0 : L1; notes.push(N(s, f, t, step, null, i < 2 ? { pick: (i % 2 === 0) === !inside ? 'd' : 'u' } : null)); t += step; }
  }
  notes.push(N(L1[0], L1[1], t, 4));
  return make(c, {
    id: 'pgsix-in-out', name: `Outside, then inside: the same two notes, two strings (${nameOf(k)} minor pentatonic)`, domain: 'picking', method: 'chunking',
    unit: unitName(step), goal: 100, minutes: 4, picking: 'strict',
    why: 'The same two notes can be picked two ways. Starting with a downstroke on the B string, the pick goes around the outside of the pair; starting with an upstroke, it is trapped between the strings (inside). Playing the two back to back on the same notes shows which one feels easier, and the cell needs the inside one.',
    instr: 'Bar 1: B-string note down, high-e note up, over and over (outside). Bar 2: the same notes, B-string note up, high-e note down (inside): the pick stays between the two strings. Bars 3–4 the same again. Keep one note ringing at a time. Pass: the 4 bars twice with both versions equally even.',
    watch: 'Slipping back into the outside strokes in the inside bars.', simplify: 'Quarter notes; the inside bars only once you are ready.', tab: { notes }
  });
}
/** The lick inside a phrase over a minor groove: two cells, a climb, a bend to the root (use in music). */
export function sixLick(c, { fast = false } = {}) {
  const k = minorKey(c), cl = cell(k, 1, 2, 1), B = byString(pentBox(k, 1)); if (!cl || !B[3]) return null;
  const step = fast ? 1 / 6 : 1 / 3, notes = []; let t = 0;
  for (let bar = 0; bar < 2; bar++) {
    t = bar * 8;
    for (let r = 0; r < 2; r++) { cl.forEach(([s, f]) => { notes.push(N(s, f, t, step)); t += step; }); }
    // answer: the G-string 4th bent up to the 5th, then the root on the B string... held
    const four = B[3][1], rootB = B[2].find(f => mod12(pitch(2, f) - k) === 0);
    notes.push(N(3, four, t, 1, 'b', { bendTo: four + 2 })); t += 1;
    const land = rootB != null ? [2, rootB] : [3, B[3][0]];
    notes.push(N(land[0], land[1], t, Math.max(1, bar * 8 + 8 - t), '~'));
  }
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: fast ? 'pgsix-lick-fast' : 'pgsix-lick', name: `The two-string cell in a phrase${fast ? ', at speed' : ''} (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: unitName(step), goal: fast ? 88 : 96, minutes: 5, dl: fast ? 1 : 0, backing: chords, chords,
    why: 'A speed lick only becomes music when it leads somewhere: here two cells launch a bend into the 5th and a held note with vibrato. Speed, then space.',
    instr: 'Two cells on the top strings, then bend the G-string 4th up a whole step to the 5th, then land and hold with vibrato. Repeat over the second half of the progression. Then make your own answer after the two cells. Pass: four bars in time with the bend in tune, then four bars of your own.',
    watch: 'Rushing into the bend: the cells end exactly on the beat.', simplify: 'One cell, then the bend.', tab: { notes }
  });
}
/** The lick falling down the box: the mirror cell on each pair from the top, then the root (use in music). */
export function sixRun(c) {
  const k = minorKey(c), notes = []; let t = 0;
  for (const [lo, hi] of [[2, 1], [3, 2], [4, 3], [5, 4]]) { const cl = cell(k, 1, lo, hi, 'down'); if (!cl) return null; cl.forEach(([s, f]) => { notes.push(N(s, f, t, 1 / 6)); t += 1 / 6; }); }
  const B = byString(pentBox(k, 1)), root = [6, B[6][0]];
  notes.push(N(root[0], root[1], t, 4 - (t % 4), '~'));
  const chords = [nameOf(k) + 'm'];
  return make(c, {
    id: 'pgsix-run', name: `Cascading down the box with the mirrored lick (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: '16th-note sextuplets', goal: 96, minutes: 4, dl: 1, backing: chords, chords,
    why: 'Chaining the mirrored cell down the string pairs turns the drill into a classic descending rock run, one pair per beat, landing on the low root.',
    instr: 'One mirrored cell per beat, starting on the top pair and moving down a pair each beat, then land on the low root. Then use the run as the end of your own phrase over the backing. Pass: the run clean at the goal tempo, then 4 phrases of your own ending with it.',
    watch: 'Losing a beat when the pair changes.', simplify: 'Two pairs only.', tab: { notes }
  });
}
/** A random key, box and string pair every bar (interleaving). */
export function sixRandom(c) {
  const plan = sixPlan(c), notes = [], names = []; let t = 0;
  for (const { k, box, pair } of plan) {
    const cl = cell(k, box, pair[0], pair[1]); if (!cl) return null;
    names.push(`${nameOf(k)}m box ${box}, strings ${pair[0]}–${pair[1]}`);
    for (let r = 0; r < 3; r++) cl.forEach(([s, f], j) => notes.push(N(s, f, t + r + j / 6, 1 / 6)));
    notes.push(N(cl[5][0], cl[5][1], t + 3, 1)); t += 4;
  }
  return make(c, {
    id: 'pgsix-random', name: 'Mixed bars: the two-string cell in a new key, box and string pair every bar', domain: 'picking', method: 'interleaving',
    unit: '16th-note sextuplets', goal: 92, minutes: 5, dl: 1, picking: 'strict',
    why: 'At mastery level the cell should be available anywhere. Changing key, box and strings every bar, once each is secure, trains exactly that.',
    instr: `${names.join(' → ')}. Three cells per bar, then a beat to move to the next one. Pass: all 8 bars at the goal tempo without a stop.`,
    watch: 'Freezing on boxes 4 and 5: give them extra time in the earlier stages.', simplify: 'The first four bars only.', tab: { notes }
  });
}
/** An original 8-bar study built on the lick: slow cells, mirrored cells, box shifts, the run, the landing (capstone). */
export function sixEtude(c) {
  const k = minorKey(c), parts = [];
  const push = (seq, step, t0) => seq.forEach(([s, f], i) => parts.push(N(s, f, t0 + i * step, step)));
  const up = (b, lo, hi) => cell(k, b, lo, hi, 'up'), dn = (b, lo, hi) => cell(k, b, lo, hi, 'down');
  const blocks = [[up(1, 2, 1), up(1, 2, 1)], [up(1, 3, 2), up(1, 3, 2)], [dn(1, 2, 1), dn(1, 3, 2)], [up(2, 2, 1), up(3, 2, 1)]];
  if (blocks.flat().some(x => !x)) return null;
  blocks.forEach((pair, bar) => push([...pair[0], ...pair[1]], 1 / 3, bar * 4));
  // bars 5–6: the lick at full speed in boxes 1 and 2 on the top pair, four cells per bar
  let t = 16; for (const b of [1, 2]) for (let r = 0; r < 4; r++) { const cl = up(b, 2, 1); if (!cl) return null; push(cl, 1 / 6, t); t += 1; }
  // bar 7: the mirrored run down the box
  t = 24; for (const [lo, hi] of [[2, 1], [3, 2], [4, 3], [5, 4]]) { const cl = dn(1, lo, hi); if (!cl) return null; push(cl, 1 / 6, t); t += 1; }
  const B = byString(pentBox(k, 1));
  parts.push(N(6, B[6][0], 28, 4, '~'));
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: 'pgsix-capstone-etude', name: `Capstone study: an 8-bar piece on the two-string cell (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'triplets, then sextuplets', goal: 92, minutes: 8, dl: 1, picking: 'strict', backing: [...chords, ...chords], chords,
    why: 'An original piece that builds the lick the way the path did: slow cells on two string pairs, the mirror, a move into boxes 2 and 3, then the lick at full speed and the cascading run to the low root.',
    instr: 'Bars 1–4 in triplets, bars 5–7 in sextuplets: the same tempo, double the speed. Learn it two bars at a time. Then write your own 8 bars on the same plan. Pass: the study at the goal tempo with no stops, then your own version played through once.',
    watch: 'Tension when the sextuplets start in bar 5: the motion stays the same size, only faster.', simplify: 'Bars 1–4 only.', tab: { notes: parts }
  });
}

/* --------------------------- Existing lesson (kept id) --------------------------- */
/** Six-note two-string pentatonic cell, strict alternate picking (Paul Gilbert style). */
export function pgSixNote(c, { across = false } = {}) {
  const key = minorKey(c);
  const seq = [];
  if (!across) {
    for (const top of [1, 2, 3, 4]) { const cl = cell(key, 1, top + 1, top); if (!cl) return null; for (let r = 0; r < 4; r++) seq.push(...cl); }
  } else {
    for (const b of [1, 2, 3, 4, 5, 4, 3, 2]) { const cl = cell(key, b, 2, 1); if (!cl) return null; seq.push(...cl, ...cl); }
  }
  const k = nameOf(key);
  return make(c, {
    id: across ? 'pg-six-across' : 'pg-six-note', name: across ? `Two-string pentatonic cell through all five boxes (${k} minor)` : `Two-string pentatonic picking cell on string pairs (${k} minor)`,
    domain: 'picking', method: across ? 'interleaving' : 'variable', unit: '16th-note sextuplets', goal: 92, minutes: 5, dl: across ? 2 : 1, picking: 'strict',
    why: 'A six-note pentatonic cell on two strings, alternate picked, is a classic Paul Gilbert-style speed drill: it trains the string change from the inside of the strings, where most picking breaks down.',
    instr: across ? 'The cell on strings 1–2, twice per box, moving through boxes 1 to 5 and back. Shift on the first note of each beat. Pass: the whole journey clean at the goal tempo.' : 'The cell (two notes on the lower string, three on the upper, back to the lower) four times per bar, then down one string pair. Strict alternate picking starting with a downstroke; the pick has to jump between the strings on the string change. Pass: all four pairs clean at the goal tempo.',
    watch: 'Using hammer-ons to hide a missed pick stroke.', simplify: 'The cell in 16th notes (four per beat) at a slow tempo.', tab: { notes: fromSeq(seq, 1 / 6) }
  });
}

/* --------------------------------- The path --------------------------------- */
const W6 = 'Strict alternate picking, starting with a downstroke. The ascending cell has {changes} string changes; ';
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'pgSix', kind: 'technique', title: 'The two-string pentatonic cell', domain: 'picking',
  re: /(two|2).?string pentatonic (cell|lick|pattern)|(six|6).?note pentatonic (picking )?(lick|pattern|cell)/,
  aliases: ['two-string pentatonic cell', 'six-note pentatonic cell', 'six-note pentatonic lick'],
  pedagogy: {
    date: '2026-10-18',
    summary: 'Taught as a two-strings-at-a-time pentatonic picking drill: the small group practised in halves, the string change isolated on two notes and played both outside and inside on the same strings, the pattern on the top two strings and then moved down the box string pair by string pair; then reversed (the other kind of string change), in other positions, with accents moved through the group; then sextuplets, string skipping and other keys, ending in a solo that uses it.',
    sequence: [
      { id: 'halves', tier: 'foundations', step: 'The six-note group in halves, then joined, slowly', how: 'Practise each small group separately before linking; strict alternate picking from a downstroke; count only clean repetitions.', skills: ['pgsix-cell'], source: 0 },
      { id: 'inout', tier: 'foundations', step: 'The string change on two notes: outside, then inside', how: 'The same two notes on two strings, first outside (the pick goes around the pair), then inside (the pick stays between them); hear the difference.', skills: ['pgsix-inside'], source: 1 },
      { id: 'pairs', tier: 'foundations', step: 'The pattern on the top strings, then down the box', how: 'Two notes per string on the B and high e of a pentatonic shape, then the same on strings 2–3 and down the scale and back; one note ringing at a time, an even rhythm.', skills: ['pgsix-know'], source: 2 },
      { id: 'music1', tier: 'foundations', step: 'First musical use', how: 'The group launching a phrase over a groove.', skills: ['pgsix-first-music'], source: 0 },
      { id: 'reverse', tier: 'intermediate', step: 'Every pair, both directions', how: 'The same notes with the other stroke first (the reversed pattern changes the feel of the picking hand); 8ths, then 16ths.', skills: ['pgsix-pairs'], source: 2 },
      { id: 'positions', tier: 'intermediate', step: 'Other positions of the scale', how: 'The same notes in other positions of the pentatonic, which change the string-change strokes and the stretches.', skills: ['pgsix-boxes'], source: 1 },
      { id: 'control', tier: 'intermediate', step: 'Accents and mixed directions', how: 'Accenting different notes within the pattern; ascending and reversed groups alternated.', skills: ['pgsix-control'], source: 0 },
      { id: 'music2', tier: 'intermediate', step: 'In a phrase and a solo', how: 'The group at speed inside a phrase; a pentatonic solo.', skills: ['pgsix-music'], source: 0 },
      { id: 'sext', tier: 'advanced', step: 'Sextuplets through the positions', how: 'Six-note groups in sextuplets with the first note of each beat accented, moved through several positions.', skills: ['pgsix-speed'], source: 0 },
      { id: 'skip', tier: 'advanced', step: 'String skipping and other keys', how: 'The pattern across a skipped string; the shape moved to other keys.', skills: ['pgsix-skip'], source: 0 },
      { id: 'accent', tier: 'advanced', step: 'Positions out of order; accents on the beat', how: 'Jumps between positions; in 16ths the accent on the click, wherever it falls in the group.', skills: ['pgsix-adv-recall'], source: 0 },
      { id: 'music3', tier: 'advanced', step: 'A rock solo', how: 'A cascading run and bursts in a blues solo.', skills: ['pgsix-adv-music'], source: 0 },
      { id: 'tempo', tier: 'mastery', step: 'Performance tempo', how: 'Every pair of every box and the reversed pattern at speed with small, relaxed motions.', skills: ['pgsix-performance'], source: 3 },
      { id: 'any', tier: 'mastery', step: 'Any key, box and pair', how: 'A new key, box and pair every bar; bursts between long notes in a solo.', skills: ['pgsix-random'], source: 0 },
      { id: 'own', tier: 'mastery', step: 'Your own music', how: 'A study built on the pattern, then your own version and solo.', skills: ['pgsix-voice'], source: 0 }
    ],
    drills: ['The group in two halves, then joined', 'Two notes on two strings: outside, then inside', 'Two notes per string on the top strings of a pentatonic shape, moved down the box pair by pair', 'The reversed pattern (the other stroke first)', 'The same notes in other positions', 'Accents moved through the group; accent on the beat in 16ths', 'Sextuplets through several positions', 'String-skipped version'],
    mistakes: ['Hitting a neighbouring string at the inside change: the pick has to clear the string it just left', 'Hiding a missed stroke with a hammer-on', 'Uneven or late notes right after the string change', 'Accenting the first note of the group out of habit when it crosses the beat', 'Building speed before the pattern is clean and relaxed'],
    sources: [
      { title: '10 Steps to Master Alternate Picking Technique For Guitar', author: 'Rob Thorpe (Fundamental Changes)', url: 'https://www.fundamental-changes.com/guitar-alternate-picking-technique/' },
      { title: 'Inside and Outside Picking on the Guitar (Guitar Rhythm and Techniques For Dummies)', author: 'Desi Serna', url: 'https://www.dummies.com/article/academics-the-arts/music/instruments/guitar/inside-and-outside-picking-on-the-guitar-143479' },
      { title: 'Right Hand Picking Exercise (A major pentatonic, upstroke-first and downstroke-first)', author: 'GuitarLessons.com', url: 'https://guitarlessons.com/guitar-lessons/exercises-and-fretboard-navigation/right-hand-picking-exercise/' },
      { title: '"Intense Rock" Picking: A Brief Look at Paul Gilbert’s Alternate Picking Technique', author: 'Troy Grady (Guitar World)', url: 'https://www.guitarworld.com/lessons/intense-rock-picking-a-brief-look-at-paul-gilberts-alternate-picking-technique' },
      { title: 'Shred Your Enthusiasm: How to Practice Pole-Vaulting', author: 'Paul Gilbert (Premier Guitar)', url: 'https://www.premierguitar.com/articles/Shred_Your_Enthusiasm_How_to_Practice_Pole-Vaulting' }
    ]
  },
  summary: 'A two-string pentatonic cell from Paul Gilbert’s picking vocabulary (a related drill; the Paul Gilbert lick itself is the six-note B-string loop, its own path), alternate picked: from the slow cell and the inside string change to performance tempo through all five boxes, every key and real licks.',
  prereqs: ['alternatePicking', 'pentatonic'],
  sources: ['https://www.fundamental-changes.com/guitar-alternate-picking-technique/', 'https://www.dummies.com/article/academics-the-arts/music/instruments/guitar/inside-and-outside-picking-on-the-guitar-143479', 'https://guitarlessons.com/guitar-lessons/exercises-and-fretboard-navigation/right-hand-picking-exercise/', 'https://www.guitarworld.com/lessons/intense-rock-picking-a-brief-look-at-paul-gilberts-alternate-picking-technique', 'https://www.premierguitar.com/articles/Shred_Your_Enthusiasm_How_to_Practice_Pole-Vaulting', 'https://www.premierguitar.com/articles/23477-cram-session-alternate-picking'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The cell, slowly',
      'Play the six-note cell on the top strings 4 times in a row in triplets at 80 BPM, loop the inside string change for 8 bars without a wrong string, play the same two notes outside and inside, play the cell on four string pairs of box 1, and play it into a bend over a minor groove.', [
        S('pgsix-cell', 'The cell', 'picking', 'Two halves, then whole; then slow and even.', [c => sixParts(c),
          X('pgsix-slow', 'The two-string cell, slow and even, on the top strings ({key})', 'accurate-reps', { pairs: [[2, 1]], reps: 8, step: 1 / 3, goal: 92, why: 'Clean repetitions at a slow tempo build the motion you will keep at speed. Two triplets per cell put a downstroke on every beat.', instr: W6 + 'two beats per cell as triplets. Count only the clean cells. Pass: 8 clean cells in a row.', watch: 'Uneven triplets at the string change.', simplify: '8th notes.' })],
          ST('The cell is six notes on two strings of a pentatonic box: the two notes on the lower string, the lower note on the upper string, the higher one, back to the lower one on the upper string and the higher one on the lower string. Strict alternate picking from a downstroke.', 'It packs two string changes into one short loop, so every repeat trains the motion where alternate picking usually breaks down.', ['Six notes in triplets take two beats; in sextuplets, one beat.', 'Going up, both string changes are inside: the pick is trapped between the two strings.', 'Two notes per string in a pentatonic box: a whole step or a minor 3rd apart.'])),
        S('pgsix-inside', 'The inside change', 'picking', 'The motion the cell exists to train, alone and against the outside change.', [c => insideHop(c), c => inOut(c)],
          ST('An inside change is an upstroke on one string followed by a downstroke on the next higher string (or the reverse going down): the pick has to hop between the two strings. An outside change goes around the pair instead.', 'Most players find the outside change easier; this cell is built to make the inside one just as reliable.', ['Outside: down on the lower string, up on the higher.', 'Inside: up on the lower string, down on the higher.', 'The hop only has to clear one string: keep it small.'])),
        S('pgsix-know', 'Every string pair', 'fretboard', 'The cell on each pair of box 1; an even sound across the strings.', [
          X('pgsix-find', 'The cell on each string pair of box 1: 2–1, 3–2, 4–3, 5–4 ({key})', 'variable', { pairs: [[2, 1], [3, 2], [4, 3], [5, 4]], reps: 2, step: 1 / 3, goal: 88, why: 'The cell is always the same four box notes: the two on the lower string, then the two on the upper. Moving it down the box pair by pair shows it works on every pair, with the same picking.', instr: W6 + 'two cells on each pair, from the top pair down to strings 5–4, in triplets. Keep only one note ringing at a time. Pass: all four pairs clean, twice.', watch: 'The fretting fingers staying on the last pair and letting notes ring together.', simplify: 'Two pairs only: 2–1 and 3–2.' }),
          X('pgsix-even', 'Even across the strings: the lick at one volume ({key})', 'external-focus', { pairs: [[3, 2]], reps: 8, step: 1 / 3, goal: 92, why: 'Players usually hear the string change before they see it: the note after the hop comes out late or quiet. Listening for one steady volume and rhythm fixes the motion without thinking about the hand.', instr: 'Play the cell on the G and B strings eight times. Listen, don’t watch: every note should sound the same length and loudness, like a machine. If one note pops out, slow down until it doesn’t. Pass: 8 cells in a row where you can’t hear the string change.', watch: 'The first note of each cell accented by habit.', simplify: '8th notes.' })],
          ST('A pentatonic box has two notes on every string, so the cell fits on every pair of neighbouring strings. Only the G–B pair is tuned a major 3rd apart, so its fingering shifts by one fret.', 'Using every pair turns one drill into a whole box of picking practice.', ['Box 1 of A minor: frets 5 and 8 on the low E, B and high e strings, 5 and 7 on the A, D and G.', 'An even, machine-like sound is the test: the string change should be inaudible.'])),
        S('pgsix-first-music', 'First music', 'improv', 'The lick into a bend.', [c => sixLick(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])],
          ST('A fast cell sounds like music when it leads to a strong note: here two cells launch a bend from the 4th up to the 5th and a held note.', 'Speed, then space: the contrast is what makes the burst exciting.', ['Bending the 4th a whole step reaches the 5th, a chord tone of the minor chord.']))
      ], [1, 3]),
    stage('intermediate', 'Every string pair, both directions',
      'Play the cell on every string pair of box 1 in 16ths at 100 BPM, play its mirror (all outside changes) as triplets at 110, play it in boxes 2 to 5, zig-zag between the cell and its mirror, move the accent through the cell, and use it in a phrase over a minor progression.', [
        S('pgsix-pairs', 'Every pair, both ways', 'picking', 'Up (inside changes) and its mirror (outside changes).', [
          X('pgsix-16ths', 'The two-string cell in 16ths on every string pair ({key})', 'variable', { pairs: ALL_PAIRS, reps: 2, step: 0.25, goal: 100, why: 'Played in 16ths the six-note cell crosses the beat: the accent falls on a different note each time, which makes it sound fast and unpredictable at a moderate tempo.', instr: W6 + 'four notes per beat, so the cell starts in a new place each time. Two cells per pair, low pair to high. Pass: all five pairs clean at the goal tempo.', watch: 'Accenting the first note of the cell instead of the beat.', simplify: 'Triplets.' }),
          X('pgsix-mirror', 'The mirrored lick: down the cell, every change outside ({key})', 'variable', { dir: 'down', pairs: ALL_PAIRS.slice().reverse(), reps: 2, step: 1 / 3, goal: 110, why: 'Turning the cell around (high to low) makes every string change an outside one: the other half of the picking problem, and a great descending lick.', instr: 'Two notes down the upper string, two down the lower, back up one to each: strict alternate picking. Top pair first, moving down. Pass: all pairs clean at the goal tempo.', watch: 'Clipping the string you just left on the way around.', simplify: 'Top two pairs only.' })],
          ST('The mirror plays the cell backwards, high to low. With the same down-first picking, both of its string changes are outside.', 'Together, the cell and its mirror cover both kinds of string change.', ['Mirror on the top pair: the two high-e notes down, the two B-string notes down, then back up one on each.', 'In 16ths the six notes take one and a half beats, so the click lands on a different note each time.'])),
        S('pgsix-boxes', 'Other boxes', 'picking', 'The same cell in boxes 2 and 3.', [
          X('pgsix-box12', 'The lick in boxes 1 and 2 on the top strings ({key})', 'interleaving', { boxes: [1, 2, 1, 2], pairs: [[2, 1]], reps: 2, step: 0.25, goal: 100, why: 'Switching boxes every two cells forces the fretting hand to find the new shape while the picking pattern stays identical.', instr: W6 + 'two cells in box 1, two in box 2, and back. Pass: 4 switches clean.', watch: 'The B-string shift in box 2.', simplify: 'Triplets.' }),
          X('pgsix-box3', 'The lick on every pair of box 3 ({key})', 'variable', { boxes: [3], pairs: ALL_PAIRS, reps: 2, step: 0.25, goal: 96, why: 'Box 3 changes the finger stretches on every pair: the same picking, a new fretting-hand map.', instr: W6 + 'two cells per pair, low to high. Pass: all pairs clean.', watch: 'Losing the box shape on the B string.', simplify: 'The top three pairs.' })],
          ST('Every pentatonic box has two notes per string, so the cell moves into each box unchanged in its picking; only the fingering and the stretches change.', 'Playing it in other boxes makes the picking independent of one hand shape.', ['Box 2 starts on the next scale note above box 1’s root on the low E string.', 'Watch the B string: its notes shift up a fret relative to the pattern on the other strings.'])),
        S('pgsix-control', 'Control and mixed directions', 'picking', 'Up and mirror mixed, accents moved, the upper boxes.', [
          X('pgsix-zigzag', 'Up, then mirror: the lick zig-zagging across the pairs ({key})', 'interleaving', { alt: true, pairs: ALL_PAIRS, reps: 2, step: 0.25, goal: 96, why: 'Alternating the ascending cell (inside changes) with its mirror (outside changes) from pair to pair means the picking hand can never settle into one kind of string change.', instr: 'Two ascending cells on strings 6–5, two mirrored cells on 5–4, ascending on 4–3, and so on, in 16ths. Pass: the whole zig-zag twice without a wrong stroke.', watch: 'Starting the mirrored cell on an upstroke: every cell starts down.', simplify: 'Triplets.' }),
          X('pgsix-box2', 'The lick on every pair of box 2 ({key})', 'variable', { boxes: [2], pairs: ALL_PAIRS, reps: 2, step: 0.25, goal: 96, why: 'Box 2 moves the cell up the neck: every pair has a new fingering, while the picking stays the same.', instr: W6 + 'play box 2 once up and down, then two cells on each pair from low to high. Pass: all five pairs at the goal tempo.', watch: 'Drifting back into box 1 on the low strings.', simplify: 'The top three pairs.' }),
          X('pgsix-accents', 'Moving the accent: first note of each cell, then the third ({key})', 'external-focus', { pairs: [[2, 1], [3, 2]], reps: 4, step: 1 / 3, goal: 100, why: 'Accenting different notes of the same pattern trains a pick that can place weight anywhere, which is what control at speed means. The pattern stays the same; only the accent moves.', instr: W6 + 'in triplets: four cells on the top pair accenting the first note of each cell, then four on the next pair accenting the third note (the first one after the string change). Then swap. Listen for the rhythm staying identical. Pass: both accent placements even at the goal tempo.', watch: 'Speeding up on the accented note.', simplify: 'One pair only.' }),
          X('pgsix-box45', 'The lick in boxes 4 and 5 on the top pairs ({key})', 'variable', { boxes: [4, 5], pairs: [[3, 2], [2, 1]], reps: 2, step: 0.25, goal: 96, why: 'The upper boxes change every stretch and string-change position: the same picking against a new map, so the motion becomes independent of the shape.', instr: 'Two cells on strings 3–2 and 2–1 of box 4, then the same in box 5. Pass: clean at the goal tempo, twice.', watch: 'The B-string shift in box 5.', simplify: 'Box 4 only.' })],
          ST('Control means choosing: which kind of string change comes next, which note is accented, which box the hand is in.', 'Mixing directions and moving accents keeps the drill from becoming one automatic motion that only works one way.', ['Every cell, ascending or mirrored, starts on a downstroke.', 'An accent is extra weight on one stroke, not a bigger motion.'])),
        S('pgsix-music', 'In a phrase', 'improv', 'The lick at speed, and a solo.', [c => sixLick(c, { fast: true }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent' })],
          ST('At speed the two cells become a short burst before the bend: the same phrase, twice as fast.', 'A solo uses bursts sparingly, between phrases with space.', ['Land the bend on a chord tone of the bar.']))
      ], [4, 6]),
    stage('advanced', 'Sextuplets, skips and keys',
      'Play the cell on every pair as sextuplets at 110 BPM, run it through all five boxes, play it across a skipped string, jump between boxes out of order, change key every block without stopping, and cascade the mirrored lick down the box into a solo.', [
        S('pgsix-speed', 'Sextuplets through the boxes', 'picking', 'One cell per beat.', [c => pgSixNote(c), c => pgSixNote(c, { across: true })],
          ST('In sextuplets the six-note cell fills exactly one beat, so the first note of every cell falls on the click.', 'This is the cell at real speed, and moving it through the boxes builds the whole-neck map.', ['Accent the first note of each beat to lock the cell to the click.', 'Shift between boxes on the first note of a beat.'])),
        S('pgsix-skip', 'Skips and keys', 'picking', 'Wider jumps; any key.', [
          X('pgsix-skip', 'The lick across a skipped string ({key})', 'variable', { pairs: [[3, 1], [4, 2]], reps: 4, step: 1 / 6, goal: 92, why: 'With a string skipped, the cell becomes wide intervals and the pick has to hop two strings at the inside change: the hardest version of the motion.', instr: W6 + 'on the G and high e strings, then the D and B, skipping the string in between. Mute it with the fretting fingers. Pass: both pairs clean at the goal tempo.', watch: 'The skipped string sounding.', simplify: 'Triplets.' }),
          X('pgsix-keys', 'The lick in four keys around the cycle of fourths', 'interleaving', { keys: [0, 5, 10, 3], pairs: [[2, 1], [3, 2]], reps: 2, step: 1 / 6, goal: 96, why: 'The cell is a shape on the box, so it moves to any key. Changing key every block trains you to find box 1 instantly while the hand keeps picking.', instr: W6 + 'two cells on the top pair, two on the next, then the next key (up a 4th). Pass: all four keys without stopping.', watch: 'Stopping to find the next key: lower the tempo instead.', simplify: 'Two keys.' })],
          ST('Skipping a string turns the cell’s steps into wide intervals; moving the box moves the cell to any key.', 'Wide intervals sound modern; any key makes the cell usable in real songs.', ['Mute the skipped string with the underside of the fretting fingers.', 'Up a 4th each block: A, D, G, C minor.'])),
        S('pgsix-adv-recall', 'Boxes out of order and accents', 'picking', 'Jump between boxes; put accents on the beat.', [
          X('pgsix-boxes-called', 'Boxes out of order: 3, 1, 5, 2, 4 on strings 3–2 ({key})', 'interleaving', { boxes: [3, 1, 5, 2, 4], pairs: [[3, 2]], reps: 2, step: 1 / 6, goal: 92, why: 'Jumping between boxes out of order, instead of sliding to the next one, makes every move a real jump, the way the cell turns up in a solo.', instr: W6 + 'two cells on the G and B strings of box 3, then box 1, 5, 2 and 4, as sextuplets. Look ahead to the next box during the last cell. Pass: all five boxes at the goal tempo without a gap.', watch: 'A late jump that steals a note from the next cell.', simplify: '16ths, boxes 1–3.' }),
          X('pgsix-accent-beat', 'Accents on the beat: the cell in 16ths, zig-zagging ({key})', 'external-focus', { alt: true, pairs: [[2, 1], [3, 2], [4, 3], [3, 2]], reps: 4, step: 0.25, goal: 104, why: 'In 16ths the six-note cell crosses the beat, so the beat falls on a different note each time. Accenting the beat (not the cell) is what makes the line groove instead of sounding like an exercise.', instr: 'Accent the note that falls on each click, whichever note of the cell it is; ascending and mirrored cells alternate by pair. Listen for a clear pulse under the stream. Pass: 4 bars at the goal tempo with every beat audible.', watch: 'Accenting the first note of each cell instead of the beat.', simplify: 'Only the top pair.' })],
          ST('In 16ths the six-note cell repeats every one and a half beats, so the beat moves through the cell.', 'Feeling the beat under a pattern that crosses it is what makes fast lines groove.', ['Two cells (12 notes) take exactly three beats of 16ths.'])),
        S('pgsix-adv-music', 'In a solo', 'improv', 'The cascading run, and a blues solo.', [c => sixRun(c), c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo with six-note bursts: speed, then space' })],
          ST('Chained down the string pairs, the mirrored cell becomes a descending run that lands on the low root.', 'A run gives a solo direction: it starts high and lands somewhere strong.', ['One pair per beat in sextuplets, then the root held.']))
      ], [7, 8]),
    stage('mastery', 'Anywhere, at speed, your own',
      'Play the lick through all five boxes on every pair as sextuplets at about 120 BPM, the mirror at 110, a new key, box and pair every bar, and perform your own 8-bar piece built on it.', [
        S('pgsix-performance', 'Performance tempo', 'picking', 'The whole neck at speed.', [
          X('pgsix-all-boxes', 'The lick on every pair of all five boxes ({key})', 'edge', { boxes: [1, 2, 3, 4, 5], pairs: ALL_PAIRS, reps: 1, step: 1 / 6, goal: 96, why: 'Every pair of every box at performance tempo: the complete map of the lick, with the picking hand on autopilot.', instr: W6 + 'one cell per pair, low to high, box by box. Use the tempo ladder to climb to the goal. Pass: the whole run clean at the goal tempo.', watch: 'Tension building over the long run: shake out between boxes if needed.', simplify: 'Boxes 1 and 2.' }),
          X('pgsix-mirror-fast', 'The mirrored lick at speed, every pair ({key})', 'edge', { dir: 'down', pairs: ALL_PAIRS.slice().reverse(), reps: 2, step: 1 / 6, goal: 92, why: 'The outside-change version at performance tempo: together with the ascending cell it covers every string change alternate picking has.', instr: 'Two mirrored cells per pair from the top down, as sextuplets. Tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'Loopy motion around the strings.', simplify: '16ths.' })],
          ST('Speed comes from the same small, relaxed motion played faster, with the pick clearing each string by as little as possible.', 'Tension and big motions are what stop players at a speed limit.', ['Add 3–5 BPM only after two clean passes.', 'Relax the grip between runs.'])),
        S('pgsix-random', 'Any key, any box', 'picking', 'A new place every bar.', [c => sixRandom(c), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: six-note bursts between long notes' })],
          ST('Changing key, box and string pair every bar, once each is secure, is the hardest and most useful way to practise the cell.', 'In a solo the cell has to appear wherever the hand is.', ['Find each new box from its root on the low E string.'])),
        S('pgsix-voice', 'Your own voice', 'improv', 'A study built on the lick, then your version.', [c => sixEtude(c), c => targetGuide(c, { prog: 'slowBlues', scale: 'minorPent', name: 'Slow blues: one six-note burst per chorus, the rest pure phrasing' })],
          ST('The capstone study rebuilds the path as music: slow cells, the mirror, box shifts, full speed and the run home.', 'Mastery is using the cell musically and making your own version.', ['Learn the study two bars at a time, then rewrite it.']))
      ], [9, 10])
  ]
});
