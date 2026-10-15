// The minor pentatonic scale, from scratch to mastery.
//
// Teaching method first (CONTENT.md): the path follows the order recognized teachers use (see
// `pedagogy` below): box 1 slowly and cleanly, its roots, licks and restricted-note improvising in it;
// then the other four boxes one at a time, the slides that link neighbours, sequences against a click,
// keys, in-tune bends, the blues scale and the major pentatonic; then the whole neck, groups of 5 and 6,
// and phrasing; finally any key on demand, performance tempo and a full solo.
//
// Concept-first: the file holds a model of the scale (its degrees, the five boxes, the diagonal and
// one-string shapes, where it bends, which notes are chord tones) and a composer that builds every
// exercise from it, in any key and at any level. Audited 2026-10-15: singing and degree call-outs were
// removed from the playing drills (no source combines them), licks and a three-note improvisation added.
import { OPEN, N, make, pentBox, pent3nps, byString, nameOf, minorKey, mod12, S, stage, entry, M, scaleNps, rootFret6 } from '../lib.js';
import { ejRolling5s } from './rolling5s.js';
import { pgPent6s } from './pent6s.js';
import { ejSixesAcross } from './speedPent.js';

/* ------------------------------- The concept ------------------------------- */
export const DEGREES = { 0: 'R', 3: '♭3', 5: '4', 7: '5', 10: '♭7' };
const PCS = k => [0, 3, 5, 7, 10].map(x => mod12(k + x));
const pitch = (s, f) => OPEN[s] + f;
const degreeOf = (k, s, f) => DEGREES[mod12(pitch(s, f) - k)];
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const unitName = step => UNIT.get(step) || '8th notes';
/** Note value for runs at a level: quarters → 8ths → triplets → 16ths → sextuplets. */
const runStep = lvl => (lvl <= 2 ? 1 : lvl <= 4 ? 0.5 : lvl <= 6 ? 1 / 3 : lvl <= 8 ? 0.25 : 1 / 6);
/** A box as [string, fret] pairs, low to high (box 1–5). */
function box(k, b) { const n = pentBox(k, b); return n ? n.map(x => [x.s, x.f]) : null; }
/** All scale notes on one string within a fret range, low to high. */
function oneString(k, s, lo = 0, hi = 17) { const out = []; for (let f = lo; f <= hi; f++) if (PCS(k).includes(mod12(pitch(s, f)))) out.push([s, f]); return out; }
/** Deterministic pseudo-random numbers (same lesson every time for the same level). */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* -------------------------------- Sequences -------------------------------- */
// A sequence turns an ascending note list into a practice order.
export const SEQUENCES = {
  updown: l => [...l, ...l.slice(0, -1).reverse()],
  threes: l => groups(l, 3), fours: l => groups(l, 4), fives: l => groups(l, 5), sixes: l => groups(l, 6),
  thirds: l => { const up = [], dn = [], r = l.slice().reverse(); for (let i = 0; i + 2 < l.length; i++) up.push(l[i], l[i + 2]); for (let i = 0; i + 2 < r.length; i++) dn.push(r[i], r[i + 2]); return [...up, ...dn]; }
};
function groups(l, n) { const up = [], dn = [], r = l.slice().reverse(); for (let i = 0; i + n <= l.length; i++) up.push(...l.slice(i, i + n)); for (let i = 0; i + n <= r.length; i++) dn.push(...r.slice(i, i + n)); return [...up, ...dn]; }
const SEQ_NAME = { updown: 'up and down', threes: 'in groups of 3', fours: 'in groups of 4', fives: 'in groups of 5', sixes: 'in groups of 6', thirds: 'in 3rds (skipping a note)' };
/** Notes from [s,f] pairs at a fixed step, with hammer/pull marks for same-string moves when legato. */
function timed(seq, step, t0 = 0, { legato = false } = {}) {
  return seq.map(([s, f], i) => {
    const prev = seq[i - 1];
    const x = legato && prev && prev[0] === s && prev[1] !== f ? (f > prev[1] ? 'h' : 'p') : null;
    return N(s, f, t0 + i * step, step, x);
  });
}
const endOf = notes => Math.max(...notes.map(n => n.t + n.d));
/** Pad to a whole bar and land on the root (lowest root of the list) for a beat or more. */
function landOnRoot(notes, k, list) {
  const root = list.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || list[0];
  const t = endOf(notes), bar = Math.ceil((t + 1) / 4) * 4;
  notes.push(N(root[0], root[1], t, bar - t));
  return notes;
}
const KEYSETS = { four: [9, 0, 2, 4], fourths: [9, 2, 7, 0, 5, 10, 3, 8, 1, 6, 11, 4] };

/* ------------------------------- The composer ------------------------------- */
/**
 * One pentatonic exercise from a spec. spec: { id, name, method, domain, shape ('box'|'diag'),
 * box, seq, step (note value, default by level), legato, why, instr, watch, simplify, goal, dl }.
 */
export function compose(c, spec) {
  const k = minorKey(c);
  const list = spec.shape === 'diag' ? (pent3nps(k) || []).map(n => [n.s, n.f]) : box(k, spec.box || 1);
  if (!list || !list.length) return null;
  const step = spec.step || runStep(c.lvl || 4);
  const seq = (SEQUENCES[spec.seq || 'updown'] || SEQUENCES.updown)(list).slice(0, 180);
  const notes = landOnRoot(timed(seq, step, 0, { legato: spec.legato }), k, list);
  return make(c, {
    id: spec.id, name: spec.name.replace('{key}', `${nameOf(k)} minor`), domain: spec.domain || 'fretboard', method: spec.method,
    unit: unitName(step), goal: spec.goal || 110, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: spec.legato ? 'alternate' : 'alternate',
    why: spec.why, instr: spec.instr, watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}

/* ------------------------- Foundations: generators ------------------------- */
/** Box 1 two strings at a time, then the whole shape (chunking). */
export function boxChunks(c) {
  const k = minorKey(c), B = byString(pentBox(k, 1)); if (!B[1]) return null;
  const step = (c.lvl || 2) <= 1 ? 1 : 0.5, notes = []; let t = 0;
  for (const [lo, hi] of [[6, 5], [4, 3], [2, 1]]) {
    const up = [[lo, B[lo][0]], [lo, B[lo][1]], [hi, B[hi][0]], [hi, B[hi][1]]], cell = [...up, up[2], up[1]];
    for (let r = 0; r < 2; r++) { notes.push(...timed(cell, step, t)); t += cell.length * step; }
  }
  const all = box(k, 1); notes.push(...timed(all, step, t)); t += all.length * step;
  landOnRoot(notes, k, all);
  return make(c, {
    id: 'pent-box1-chunks', name: `Box 1 of ${nameOf(k)} minor pentatonic, two strings at a time`, domain: 'fretboard', method: 'chunking',
    unit: unitName(step), goal: 90, start: 50, minutes: 5, picking: 'alternate',
    why: 'The pentatonic box is five notes spread over six strings. Learning it two strings at a time, then joining the pieces, is faster and more accurate than trying to swallow the whole shape at once.',
    instr: `Index finger at fret ${B[6][0]}, one finger per fret, pinky on the fourth fret of the shape. Strings 6–5 up and back twice, then 4–3, then 2–1, then the whole box once, ending on the root. Pass: the whole sequence with every note clear and no stops, 3 times in a row.`,
    watch: 'Flattening the index finger so neighbouring strings ring; lift each finger just off the string as you move on.', simplify: 'One string pair only, quarter notes.', tab: { notes }
  });
}
/** The roots in every box, low to high, with a beat of rest to find the next one (retrieval). */
export function rootsEverywhere(c) {
  const k = minorKey(c), notes = []; let t = 0;
  for (let b = 1; b <= 5; b++) {
    const roots = (box(k, b) || []).filter(([s, f]) => mod12(pitch(s, f) - k) === 0);
    roots.forEach(([s, f]) => { notes.push(N(s, f, t, 1)); t += 1; });
    t = Math.ceil((t + 1) / 4) * 4;
  }
  if (!notes.length) return null;
  return make(c, {
    id: 'pent-roots-everywhere', name: `Find every ${nameOf(k)}: the roots in all five boxes`, domain: 'fretboard', method: 'retrieval',
    unit: 'quarter notes', goal: 90, start: 50, minutes: 4,
    why: 'Every box is anchored by its roots: they tell you which key you are in and where each shape sits. Finding them without the tab is what lets you start a solo anywhere.',
    instr: 'One bar per box, boxes 1 to 5: play every root in the box, low to high. After the first pass, cover the tab and find them from the shape alone, checking afterwards. Pass: all five boxes without the tab, twice.',
    watch: 'Reading the tab instead of recalling: cover it after the first pass.', simplify: 'Boxes 1 and 2 only.', tab: { notes }
  });
}
/** Only one scale degree at a time across box 1 (retrieval of the degrees). */
export function degreeCallouts(c, { order = ['R', '5', '♭3', '♭7', '4'] } = {}) {
  const k = minorKey(c), list = box(k, 1); if (!list) return null;
  const notes = []; let t = 0;
  for (const d of order) {
    const hits = list.filter(([s, f]) => degreeOf(k, s, f) === d);
    hits.forEach(([s, f]) => { notes.push(N(s, f, t, 1)); t += 1; });
    t = Math.ceil(t / 4) * 4 || 4;
  }
  return make(c, {
    id: 'pent-degree-callouts', name: `Where each degree sits in box 1: ${order.join(', ')}`, domain: 'theory', method: 'retrieval',
    unit: 'quarter notes', goal: 80, start: 50, minutes: 4,
    why: 'Knowing which note of the scale is under each finger (root, ♭3, 4, 5, ♭7) is what turns a shape into music: it tells you which notes sound resolved, tense or bluesy.',
    instr: `Each bar plays one degree wherever it sits in box 1: ${order.map(d => `every ${d === 'R' ? 'root' : d}`).join(', then ')}. Then play the same bars with the tab hidden. Pass: the whole order without the tab and without a wrong note.`,
    watch: 'Mixing up the 4th and the 5th: the 5th is always two frets above the 4th on the same string in this box.', simplify: 'Roots and 5ths only.', tab: { notes }
  });
}
/**
 * Licks from box 1 (JustinGuitar, "5 blues licks from pattern 1"; Chad Johnson, Pentatonic Scales for Guitar):
 * short, original phrases of under a bar, each with a bar of space, using the box's bend points and the
 * same-fret roll. Every note is a box-1 note; bends go to the next scale note (4 → 5, ♭7 → R, ♭3 → 4).
 */
export function box1Licks(c, { set = 1 } = {}) {
  const k = minorKey(c), B = byString(pentBox(k, 1)); if (!B[1] || !B[2] || !B[3] || !B[4] || !B[5]) return null;
  const notes = []; let t = 0;
  const put = (s, f, d, x, extra) => { notes.push(N(s, f, t, d, x, extra)); t += d; };
  const licks = set === 1 ? [
    // A: down from the root on the high e, the 4 → 5 bend on the G string, released, into the root on the D string
    () => { put(1, B[1][0], 0.5); put(2, B[2][1], 0.5); put(2, B[2][0], 0.5); put(3, B[3][1], 1, 'b', { bendTo: B[3][1] + 2 }); put(3, B[3][1], 0.5, 'r', { bendTo: B[3][1] + 2 }); put(3, B[3][0], 0.5); put(4, B[4][1], 2.5, '~'); },
    // B: the ♭7 → root bend on the B string, then the roll: the same fret on the e and B strings with one finger
    () => { put(2, B[2][1], 1, 'b', { bendTo: B[2][1] + 2 }); put(1, B[1][0], 0.5); put(2, B[2][0], 0.5); put(3, B[3][1], 0.5); put(3, B[3][0], 0.5); put(4, B[4][1], 3, '~'); }
  ] : [
    // C: low in the box with hammer-ons, up to a held ♭3 on the G string
    () => { put(5, B[5][0], 0.5); put(5, B[5][1], 0.5, 'h'); put(4, B[4][0], 0.5); put(4, B[4][1], 0.5, 'h'); put(3, B[3][0], 2, '~'); put(4, B[4][1], 0.5); put(4, B[4][0], 0.5, 'p'); put(5, B[5][1], 3, '~'); },
    // D: the ♭3 → 4 bend on the high e, released, down to the 4 on the G string
    () => { put(1, B[1][1], 1, 'b', { bendTo: B[1][1] + 2 }); put(1, B[1][1], 0.5, 'r', { bendTo: B[1][1] + 2 }); put(1, B[1][0], 0.5, 'p'); put(2, B[2][1], 0.5); put(2, B[2][0], 0.5, 'p'); put(3, B[3][1], 3, '~'); }
  ];
  licks.forEach(l => { for (let r = 0; r < 2; r++) { l(); t = Math.ceil((t + 1) / 4) * 4; if (t % 8) t += 4; } });
  const names = set === 1 ? 'the G-string bend and the roll' : 'hammer-ons, pull-offs and the high-e bend';
  return make(c, {
    id: `pent-licks-${set}`, name: `Licks from box 1: ${names} (${nameOf(k)} minor)`, domain: 'improv', method: 'chunking',
    unit: 'one-bar licks with a bar of space', goal: 90, start: 56, minutes: 5, backing: [nameOf(k) + 'm', nameOf(k) + 'm'],
    why: 'Teachers bring the first pentatonic shape to life with a handful of short licks: they show where the bends are, which fingers to use, and that a few notes with space already sound like a solo.',
    instr: set === 1
      ? `Two licks, each played twice with a bar of space after it. Lick 1 bends the 4 up to the 5 on the G string (fret ${B[3][1]} to the pitch of fret ${B[3][1] + 2}) with the ring finger, two fingers behind it, then releases it. Lick 2 bends the ♭7 up to the root on the B string, then plays fret ${B[1][0]} on the e and B strings with one finger, rolling the fingertip so the notes don't ring together. Pass: each lick 4 times in a row in time, every bend in tune.`
      : `Two licks, each played twice with a bar of space after it. Lick 1 climbs the low strings with hammer-ons (index to ring finger) to a held ♭3 on the G string, then falls back with a pull-off. Lick 2 bends the ♭3 up to the 4 on the high e (ring finger, supported), releases it and pulls off down the box to the 4 on the G string. Pass: each lick 4 times in a row in time, every bend in tune.`,
    watch: 'Bending with the pinky or a lone finger: bend with the ring finger and the fingers behind it pushing too.', simplify: 'Play the first lick only, without the bend.', tab: { notes }
  });
}
/**
 * Three notes, one spot (JustinGuitar's restricted-note improvising): four example phrases from only three
 * box-1 notes (the 4 on the G string, the 5 and the ♭7 on the B string, plus their bends), each with space.
 */
export function threeNotes(c) {
  const k = minorKey(c), B = byString(pentBox(k, 1)); if (!B[2] || !B[3]) return null;
  const g4 = B[3][1], b5 = B[2][0], b7 = B[2][1], notes = []; let t = 0;
  const put = (s, f, d, x, extra) => { notes.push(N(s, f, t, d, x, extra)); t += d; };
  put(2, b7, 1); put(2, b5, 1); put(3, g4, 2, 'b', { bendTo: g4 + 2 }); t = 8;
  put(2, b5, 0.5); put(2, b7, 0.5); put(2, b5, 1); put(3, g4, 2, '~'); t = 16;
  put(3, g4, 1, 'b', { bendTo: g4 + 2 }); put(3, g4, 0.5, 'r', { bendTo: g4 + 2 }); put(2, b5, 2.5, '~'); t = 24;
  put(2, b5, 0.5); put(2, b7, 1.5, 'b', { bendTo: b7 + 2 }); put(2, b7, 2, 'pb', { bendTo: b7 + 2 });   // the bend held at the root
  return make(c, {
    id: 'pent-three-notes', name: `Three notes, one spot: improvising with the 4, 5 and ♭7 (${nameOf(k)} minor, box 1)`, domain: 'improv', method: 'transfer',
    unit: 'phrases with space', goal: 84, start: 56, minutes: 6, backing: [nameOf(k) + 'm', nameOf(k) + 'm'],
    why: 'Limiting yourself to three notes takes away the urge to run the scale and leaves only phrasing: rhythm, repetition, bends and space. It is how many teachers start a player improvising.',
    instr: `The notes: fret ${g4} on the G string (the 4, bent up to the 5), fret ${b5} on the B string (the 5) and fret ${b7} on the B string (the ♭7, bent up to the root). Play the four written phrases, each followed by a bar of silence. Then improvise over the backing with only these three notes and their bends: change the rhythm, start on different beats, repeat an idea before changing it. Pass: the written phrases in time with the bends in tune, then 8 bars of your own using only the three notes.`,
    watch: 'Reaching for a fourth note: the limit is the exercise.', simplify: 'Two notes only, the B-string pair, no bends.', tab: { notes }
  });
}
/**
 * A short phrase built like a singer would: a motif, repeated a step higher, again, then an answer
 * that falls to the root, with space between (focus on the sound). bends: add a bend to the third phrase.
 */
export function motifPhrase(c, { bends = false, seed = 1 } = {}) {
  const k = minorKey(c), list = box(k, 1); if (!list) return null;
  const r = rng(seed * 101 + (c.lvl || 4));
  const rootIx = list.findIndex(([s, f], i) => i >= 3 && mod12(pitch(s, f) - k) === 0);
  const startIx = Math.max(2, rootIx - 1);
  const shape = [0, 1, 2 + (r() < 0.5 ? 0 : 1)].map(x => x - 1), rhythm = r() < 0.5 ? [0.5, 0.5, 1] : [1, 0.5, 0.5];
  const notes = []; let t = 0;
  for (let rep = 0; rep < 3; rep++) {
    shape.forEach((d, i) => { const [s, f] = list[Math.min(list.length - 1, Math.max(0, startIx + rep + d))]; notes.push(N(s, f, t, rhythm[i])); t += rhythm[i]; });
    if (bends && rep === 2) {
      // bend the 4th up to the 5th on the G string (the classic pentatonic bend)
      const four = list.find(([s, f]) => s === 3 && degreeOf(k, s, f) === '4');
      if (four) { notes.push(N(3, four[1], t, 1, 'b', { bendTo: four[1] + 2 })); t += 1; }
    }
    t = Math.ceil(t / 4) * 4;
  }
  // the answer: down the box to the root
  const ans = list.slice(Math.max(0, rootIx - 3), rootIx + 2).reverse();
  ans.forEach(([s, f], i) => { notes.push(N(s, f, t, i === ans.length - 1 ? 2 : 0.5, i === ans.length - 1 ? '~' : null)); t += i === ans.length - 1 ? 2 : 0.5; });
  return make(c, {
    id: bends ? 'pent-phrase-bends' : 'pent-phrase-motif', name: bends ? `Phrases that sing: motif, bend, answer (${nameOf(k)} minor)` : `Three short phrases and an answer (${nameOf(k)} minor)`,
    domain: 'improv', method: 'external-focus', unit: '2-beat phrases with space', goal: 90, start: 60, minutes: 5, dl: bends ? 1 : 0, backing: [nameOf(k) + 'm', nameOf(k) + 'm'],
    why: 'Good solos are built from short ideas repeated and varied, with space between them, not from running the scale. This is the phrase structure singers use: say it, say it again higher, then answer.',
    instr: `Play each phrase, then leave the rest of the bar silent. Aim for the sound of a voice: every note clean, the last one held with vibrato.${bends ? ' The bend in bar 3 goes up a whole step until it matches the 5th (fret ' + ((list.find(([s, f]) => s === 3 && degreeOf(k, s, f) === '4') || [0, 0])[1] + 2) + ' on the G string): play that fret first to hear the target.' : ''} Then make up your own: same rhythm, different notes. Pass: the written version 4 times, then 4 phrases of your own over the backing.`,
    watch: 'Filling the silences: the rests are part of the phrase.', simplify: 'Just the first phrase and the answer.', tab: { notes }
  });
}

/* ------------------------ Intermediate: generators ------------------------ */
/**
 * The two boxes of a slide, as fret lists per string: box `from`, and the next box up starting on its
 * second low-E note (box 5 leads into box 1 an octave up). Both an octave lower if the upper one runs past fret 20.
 */
export function boxPair(k, from) {
  const A0 = pentBox(k, from); if (!A0) return null;
  let fa = Math.min(...A0.filter(n => n.s === 6).map(n => n.f));
  const build = fa0 => { const A = scaleNps(k, 'minorPent', fa0, 2); if (!A) return null; const fb = byString(A)[6][1], B = scaleNps(k, 'minorPent', fb, 2); return B ? { A, B } : null; };
  let pr = build(fa);
  if ((!pr || Math.max(...pr.B.map(n => n.f)) > 20) && fa >= 12) pr = build(fa - 12);
  if (!pr || Math.max(...pr.B.map(n => n.f)) > 20) return null;
  return pr;
}
/** Box `from` on the low strings, a slide on the G string into the next box, up and back (connecting boxes). */
export function slideConnect(c, { from = 1, to = 2 } = {}) {
  const k = minorKey(c), pr = boxPair(k, from); if (!pr) return null;
  const A = byString(pr.A), B = byString(pr.B); if (!A[3] || !B[3]) return null;
  const up = [[6, A[6][0]], [6, A[6][1]], [5, A[5][0]], [5, A[5][1]], [4, A[4][0]], [4, A[4][1]], [3, A[3][0]], [3, A[3][1]], [3, B[3][1]], [2, B[2][0]], [2, B[2][1]], [1, B[1][0]], [1, B[1][1]]];
  const step = runStep(Math.min(6, c.lvl || 5));
  const notes = up.map(([s, f], i) => N(s, f, i * step, step, i === 8 && B[3][1] > A[3][1] ? '/' : null));
  const down = up.slice(0, -1).reverse(), t0 = up.length * step;
  down.forEach(([s, f], i) => notes.push(N(s, f, t0 + i * step, step, i === 4 && A[3][1] < B[3][1] ? '\\' : null)));
  landOnRoot(notes, k, pr.A.map(n => [n.s, n.f]));
  const wrap = from === 5;
  return make(c, {
    id: `pent-slide-${from}-${to}`, name: `Slide from box ${from} into box ${to}${wrap ? ' an octave up' : ''} (${nameOf(k)} minor)`, domain: 'fretboard', method: 'chunking',
    unit: unitName(step), goal: 100, start: 55, minutes: 5,
    why: wrap ? 'Box 5 is the last shape before the pattern repeats: its upper notes are box 1 an octave higher. Sliding from box 5 into that box 1 closes the loop, so the five boxes become one continuous map that repeats every 12 frets.' : 'Boxes are only useful when you can leave them. A slide on the G string carries the hand into the next box without a break in the line, so the neck becomes one map instead of five islands.',
    instr: `Box ${from} up to the G string, slide up the G string into box ${to}${wrap ? ' (an octave above the first box 1)' : ''}, finish the top strings there; come back the same way. Pass: 4 times in a row with the slide landing in time.`,
    watch: 'Stopping before the slide: keep the rhythm going through it.', simplify: 'Just the G-string slide and the two notes either side, slowly.', tab: { notes }
  });
}
/** One box in several keys, a key change every two bars (interleaving). */
export function keysInterleaved(c, { keys = null, boxN = 1 } = {}) {
  const set = keys || ((c.lvl || 5) >= 7 ? KEYSETS.fourths.slice(0, 6) : KEYSETS.four);
  const step = 0.5, notes = []; let t = 0; const names = [];
  for (const k of set) {
    const list = box(k, boxN); if (!list) continue;
    names.push(nameOf(k));
    notes.push(...timed(list, step, t)); t += list.length * step;
    const top = list[list.length - 1]; notes.push(N(top[0], top[1], t, 2)); t += 2;
  }
  if (!notes.length) return null;
  return make(c, {
    id: `pent-keys-${boxN}-${set.length}`, name: `Box ${boxN} in ${names.length} keys: ${names.join(', ')}`, domain: 'fretboard', method: 'interleaving',
    unit: '8th notes', goal: 110, start: 60, minutes: 5, dl: 1,
    why: 'Practicing one key until it is smooth feels productive but doesn’t transfer well. Changing key every two bars forces you to find the shape each time, which is what real playing asks of you.',
    instr: `Box ${boxN}, ascending, then hold the top note while you find the next key's root on the low E string: ${names.join(' → ')}. Pass: the whole cycle without stopping, twice, then once with the tab hidden.`,
    watch: 'Stopping to think: if you need more time, lower the tempo rather than breaking the bar.', simplify: 'Two keys only, back and forth.', tab: { notes }
  });
}
/** The natural bend points of the box, each checked against its target pitch (focus on the sound). */
export function bendTargets(c) {
  const k = minorKey(c), list = box(k, 1); if (!list) return null;
  const pts = [];
  const find = (s, d) => list.find(([ss, f]) => ss === s && degreeOf(k, ss, f) === d);
  const g4 = find(3, '4'), b7 = find(2, '♭7'), e3 = find(1, '♭3');
  if (g4) pts.push([3, g4[1], 2, '4 → 5']);
  if (b7) pts.push([2, b7[1], 2, '♭7 → root']);
  if (e3) pts.push([1, e3[1], 2, '♭3 → 4']);
  const notes = []; let t = 0;
  for (let r = 0; r < 2; r++) for (const [s, f, up] of pts) {
    notes.push(N(s, f + up, t, 1)); t += 1;                         // the target, fretted
    notes.push(N(s, f, t, 2, 'b', { bendTo: f + up })); t += 2;      // bend up to it
    notes.push(N(s, f + up, t, 1, '~')); t += 1;                     // the target again, with vibrato
  }
  return make(c, {
    id: 'pent-bend-targets', name: `Bends in tune: the box’s three bend points (${nameOf(k)} minor)`, domain: 'fretting', method: 'external-focus',
    unit: 'one bend per bar', goal: 80, start: 50, minutes: 5,
    why: 'The pentatonic box has three natural bend points: 4 → 5 on the G string, ♭7 → root on the B string and ♭3 → 4 on the high E. A bend that misses the pitch sounds wrong, however good the phrase.',
    instr: 'Play the fretted target first and listen. Then bend up to that exact pitch, using two or three fingers behind the bending finger, and hold it. Then play the target again with vibrato. Listen to the pitch, not your hand. Pass: every bend matches the target on 4 tries in a row.',
    watch: 'Stopping short of the pitch (flat bends are the most common problem).', simplify: 'Half-step bends (one fret) at first.', tab: { notes }
  });
}

/* -------------------------- Advanced: generators -------------------------- */
/** The scale along one string with shifts (horizontal thinking). */
export function alongOneString(c, { s = 3 } = {}) {
  const k = minorKey(c), l = oneString(k, s, 0, 17); if (l.length < 6) return null;
  const step = runStep(Math.min(6, c.lvl || 6)), seq = [...l, ...l.slice(0, -1).reverse()];
  const notes = seq.map(([ss, f], i) => { const prev = seq[i - 1]; return N(ss, f, i * step, step, prev && prev[1] > 0 && f > 0 && Math.abs(prev[1] - f) >= 3 ? (f > prev[1] ? '/' : '\\') : null); });
  landOnRoot(notes, k, l);
  return make(c, {
    id: `pent-one-string-${s}`, name: `The whole scale along the ${['', 'high E', 'B', 'G', 'D', 'A', 'low E'][s]} string (${nameOf(k)} minor)`, domain: 'fretboard', method: 'variable',
    unit: unitName(step), goal: 100, start: 55, minutes: 4,
    why: 'Boxes are vertical; melodies are often horizontal. Playing the scale along one string shows the intervals as distances (3 frets, 2 frets…) and links every box through the notes they share.',
    instr: 'One finger does most of the work, sliding on the wide jumps (the gaps repeat in the same order every octave: 3, 2, 2, 3, 2 frets). Pass: up and down twice without a wrong note, then once on another string.',
    watch: 'Looking for the frets instead of hearing the intervals: the gaps repeat in the same order every octave.', simplify: 'Only frets 0–12.', tab: { notes }
  });
}
/** Through the cycle of fourths, each key in the box nearest the last (interleaving + retrieval). */
export function fourthsNearest(c) {
  const notes = []; let t = 0, at = 5; const names = [];
  for (const k of KEYSETS.fourths) {
    let best = null;
    for (let b = 1; b <= 5; b++) { const l = box(k, b); if (!l) continue; const lo = Math.min(...l.map(x => x[1])); if (lo > 15) continue; if (!best || Math.abs(lo - at) < Math.abs(best.lo - at)) best = { l, lo, b }; }
    if (!best) continue;
    names.push(`${nameOf(k)} (box ${best.b})`); at = best.lo;
    notes.push(...timed(best.l, 0.25, t)); t += best.l.length * 0.25 + 1;
  }
  return make(c, {
    id: 'pent-fourths-nearest', name: 'All 12 keys around the cycle of fourths, staying in one area of the neck', domain: 'fretboard', method: 'interleaving',
    unit: '16th notes', goal: 100, start: 50, minutes: 6, dl: 1,
    why: 'Real songs change key and players don’t jump to the “home” box each time: they find the scale right where the hand already is. This trains exactly that.',
    instr: `Each bar is a new key (A, D, G, C, F, B♭, E♭, A♭, D♭, G♭, B, E), played in whichever box is closest to where you are. Name the key and the box during the rest beat. Pass: all 12 keys in time, then with the tab hidden for the first 6.`,
    watch: 'Jumping back to box 1 every time: stay within about four frets of the last position.', simplify: 'The first four keys only.', tab: { notes }
  });
}
/** Runs that land on a chosen degree on the last beat of each bar (retrieval + phrasing). */
export function degreeTargets(c) {
  const k = minorKey(c), list = box(k, 1); if (!list) return null;
  const targets = ['♭3', '5', '♭7', 'R', '4', 'R'], notes = []; let t = 0;
  targets.forEach((d, bar) => {
    // approach from above on odd bars, from below on even ones, using an instance of the target with room for 6 notes
    const ixs = list.map((x, i) => i).filter(i => degreeOf(k, list[i][0], list[i][1]) === d);
    let down = bar % 2 === 1;
    let fits = ixs.filter(i => (down ? i + 6 < list.length : i - 6 >= 0));
    if (!fits.length) { down = !down; fits = ixs.filter(i => (down ? i + 6 < list.length : i - 6 >= 0)); }
    const tix = fits.length ? fits[bar % fits.length] : ixs[0];
    const path = [];
    for (let j = 6; j >= 1; j--) { const i = down ? tix + j : tix - j; path.push(list[Math.max(0, Math.min(list.length - 1, i))]); }
    path.forEach(([s, f], i) => notes.push(N(s, f, t + i * 0.5, 0.5)));
    notes.push(N(list[tix][0], list[tix][1], t + 3, 1, '~'));
    t += 4;
  });
  return make(c, {
    id: 'pent-degree-targets', name: `Land on the target: ♭3, 5, ♭7, R, 4 (${nameOf(k)} minor)`, domain: 'improv', method: 'retrieval',
    unit: '8th notes', goal: 110, start: 60, minutes: 5, dl: 1, backing: [nameOf(k) + 'm'],
    why: 'Phrases are judged by where they end. Choosing the landing note in advance (the ♭3 for a minor sound, the 5 for strength, the ♭7 for tension, the root for rest) is the first step from running scales to soloing.',
    instr: 'Each bar runs six 8th notes into the target degree on beat 4 and holds it with vibrato. Before each bar, say the target. Then improvise your own runs to the same targets. Pass: the written bars twice, then 6 targets of your own in a row, each landing on beat 4.',
    watch: 'Landing late: the target belongs exactly on the beat.', simplify: 'Only roots and 5ths as targets.', tab: { notes }
  });
}

/* -------------------- Added 2026-10-11: one string, major, blue note -------------------- */
export const PENT_ALLOW = new WeakMap();   // for the pitch check: the pitch classes each note may be
const tagN = (n, pcs) => { PENT_ALLOW.set(n, pcs); return n; };
const MAJ = k => [0, 2, 4, 7, 9].map(x => mod12(k + x));
const BLUES = k => [0, 3, 5, 6, 7, 10].map(x => mod12(k + x));
/** Before the box: the five notes from the root to the octave along one string, slowly, singing each one (hear it first). */
export function oneStringIntro(c) {
  const k = minorKey(c), r6 = rootFret6(k), r5 = mod12(k - 45);
  const [s, r] = r6 <= 4 ? [6, r6] : [5, r5];
  const offs = [0, 3, 5, 7, 10, 12], names = ['R', '♭3', '4', '5', '♭7', 'R'], seq = [...offs, ...offs.slice(0, -1).reverse()], notes = []; let t = 0;
  seq.forEach((o, i) => { const prev = seq[i - 1]; notes.push(tagN(N(s, r + o, t, 2, prev != null && r + prev > 0 && Math.abs(o - prev) >= 3 ? (o > prev ? '/' : '\\') : null), PCS(k))); t += 2; });
  return make(c, {
    id: 'pent-one-string-intro', name: `Before the box: ${nameOf(k)} minor pentatonic on one string (${s === 6 ? 'low E' : 'A'} string, fret ${r} to ${r + 12})`, domain: 'fretboard', method: 'external-focus',
    unit: 'half notes', goal: 80, start: 40, minutes: 3,
    why: 'Five notes, five distances: 3 frets, 2, 2, 3, 2 back to the root. Played on one string, the scale is a sound and a shape you can see before it is folded into a box.',
    instr: `One finger, sliding: ${names.join(' – ')} up the ${s === 6 ? 'low E' : 'A'} string and back, two beats per note. Let each note ring and listen to the size of each step before you move. Pass: up and down twice in time, every slide landing exactly on its fret.`,
    watch: 'Counting frets instead of hearing the step: the jumps of 3 sound wider than the jumps of 2.', simplify: 'Root to 5th only.', tab: { notes }
  });
}
/** The major pentatonic shape: the minor box 1 moved down 3 frets has the same root as a major scale (focus on the sound). */
function majorBox(k) {
  let fm = rootFret6(k) - 3; if (fm < 0) fm += 12;
  const n = scaleNps(mod12(k - 3), 'minorPent', fm, 2); return n ? n.map(x => [x.s, x.f]) : null;
}
export function majorShape(c) {
  const k = minorKey(c), minB = box(k, 1), majB = majorBox(k); if (!minB || !majB) return null;
  const notes = []; let t = 0;
  const run = (list, pcs) => { [...list, ...list.slice(0, -1).reverse()].forEach(([s, f]) => { notes.push(tagN(N(s, f, t, 0.5), pcs)); t += 0.5; }); const root = list.find(([s, f]) => mod12(pitch(s, f) - k) === 0); notes.push(tagN(N(root[0], root[1], t, 2, '~'), pcs)); t = Math.ceil((t + 2) / 4) * 4; };
  run(minB, PCS(k)); run(majB, MAJ(k));
  const fMin = Math.min(...minB.map(x => x[1])), fMaj = Math.min(...majB.map(x => x[1]));
  return make(c, {
    id: 'pent-major-shape', name: `Same shape, new home: ${nameOf(k)} minor pentatonic at fret ${fMin}, then ${nameOf(k)} major pentatonic at fret ${fMaj}`, domain: 'fretboard', method: 'external-focus',
    unit: '8th notes', goal: 100, start: 56, minutes: 5, backing: [nameOf(k), nameOf(k)],
    why: `The major pentatonic uses the same five-note shape as the minor one, moved down 3 frets: box 1 at fret ${fMaj} is ${nameOf(k)} major pentatonic (R 2 3 5 6), because ${nameOf(k - 3)} minor and ${nameOf(k)} major share their notes. Same fingers, a bright, open sound.`,
    instr: `Box 1 at fret ${fMin} up and down, landing on ${nameOf(k)}; then the same shape at fret ${fMaj}, landing on the same ${nameOf(k)}, now under a different finger (the pinky on the low E string). Listen to the drone chord: the first sounds bluesy and dark, the second sweet and country. Pass: both shapes clean, and you can say which is which by ear.`,
    watch: `Landing on the old root (fret ${fMaj} on the low E) in the major shape: in major, the root is the note under the pinky.`, simplify: 'Only the major shape, quarter notes.', tab: { notes }
  });
}
/** Roots and 3rds in the minor box and in the major shape 3 frets below, from memory (retrieval). */
export function majorRoots(c) {
  const k = minorKey(c), minB = box(k, 1), majB = majorBox(k); if (!minB || !majB) return null;
  const notes = []; let t = 0;
  const bar = (list, iv, pcs) => { list.filter(([s, f]) => mod12(pitch(s, f) - k) === iv).forEach(([s, f]) => { notes.push(tagN(N(s, f, t, 1), pcs)); t += 1; }); t = Math.ceil(t / 4) * 4; };
  bar(minB, 0, PCS(k)); bar(majB, 0, MAJ(k)); bar(minB, 3, PCS(k)); bar(majB, 4, MAJ(k));
  return make(c, {
    id: 'pent-major-roots', name: `Where the root and 3rd move: ${nameOf(k)} minor box vs ${nameOf(k)} major shape`, domain: 'theory', method: 'retrieval',
    unit: 'quarter notes', goal: 84, start: 50, minutes: 4,
    why: 'When the shape moves down 3 frets, the root moves to a different finger and the ♭3 becomes a major 3rd. Knowing where they sit in each shape, without reading, is what lets you switch between the two sounds mid-solo.',
    instr: `Bar 1: every ${nameOf(k)} in the minor box. Bar 2: every ${nameOf(k)} in the major shape. Bar 3: every ♭3 (${nameOf(k + 3)}) in the minor box. Bar 4: every major 3rd (${nameOf(k + 4)}) in the major shape. Before each bar, say where the notes are, then cover the tab and play them. Pass: all four bars from memory, twice.`,
    watch: 'Mixing up the two shapes’ roots: in the major shape the root is on the 4th fret of the shape on the low E.', simplify: 'Roots only (bars 1 and 2).', tab: { notes }
  });
}
/** One phrase of a bar: three notes stepping into a target pitch class, the target held (8ths, then 2 beats). */
function phraseInto(list, k, targetIv, t0, pcs, up = false) {
  const ixs = list.map((x, i) => i).filter(i => mod12(pitch(...list[i]) - k) === targetIv && list[i][0] <= 4 && list[i][0] >= 2);
  const fits = ixs.filter(i => (up ? i - 3 >= 0 : i + 3 < list.length)); const ti = (fits.length ? fits : ixs)[0]; if (ti == null) return [];
  const path = up ? [ti - 3, ti - 2, ti - 1] : [ti + 3, ti + 2, ti + 1];
  const out = path.map((i, j) => tagN(N(...list[Math.max(0, Math.min(list.length - 1, i))], t0 + j * 0.5, 0.5), pcs));
  out.push(tagN(N(list[ti][0], list[ti][1], t0 + 1.5, 2, '~'), pcs));
  return out;
}
/** A 12-bar blues: major pentatonic over the I chord, minor pentatonic from the IV chord on (use in music). */
export function bluesSwitch(c) {
  const k = minorKey(c), minB = box(k, 1), majB = majorBox(k); if (!minB || !majB) return null;
  const form = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7], chords = form.map(d => nameOf(k + d) + '7'), notes = [];
  form.forEach((d, b) => {
    const maj = d === 0;
    const target = maj ? (b % 2 ? 0 : 4) : d === 5 ? (b % 2 ? 5 : 3) : (b % 2 ? 7 : 5);   // I: 3rd or root; IV: its root (4) or its ♭7 (♭3); V: its root (5) or its ♭7 (4)
    notes.push(...phraseInto(maj ? majB : minB, k, target, b * 4, maj ? MAJ(k) : PCS(k), b % 2 === 1));
  });
  if (notes.length < 24) return null;
  return make(c, {
    id: 'pent-blues-switch', name: `Major on the I, minor from the IV: a 12-bar blues in ${nameOf(k)}`, domain: 'improv', method: 'transfer',
    unit: '8th-note phrases', goal: 100, start: 60, minutes: 7, backing: chords, chords: [...new Set(chords)],
    why: `Over a blues the I chord (${nameOf(k)}7) has a major 3rd, so the major pentatonic sounds sweet on it; the IV and V chords sound best with the minor pentatonic, whose ♭3 and ♭7 are the ♭7 of the IV and V chords. Switching shapes on the chord change is the core sound of B.B. King-style blues.`,
    instr: `Bars on ${nameOf(k)}7: the major shape (3 frets lower), landing on the 3rd or the root. From the first ${nameOf(k + 5)}7 bar: the minor box, landing on ${nameOf(k + 5)} or ${nameOf(k + 3)} (its ♭7); on ${nameOf(k + 7)}7 land on ${nameOf(k + 7)} or ${nameOf(k + 5)}. Each phrase: three 8ths into the target, held. Then improvise your own phrases with the same switch. Pass: the written chorus in time, then two choruses of your own switching on every chord change.`,
    watch: `Staying in the major shape over ${nameOf(k + 5)}7: its major 3rd (${nameOf(k + 4)}) clashes with the IV chord.`, simplify: 'Only bars 1–6 (I, then IV).', tab: { notes }
  });
}
/** Four box-1 licks with the ♭5 as a passing note between the 4 and 5 (focus on the sound). */
export function blueLicks(c) {
  const k = minorKey(c), B = byString(pentBox(k, 1)); if (!B[1] || !B[5] || !B[3]) return null;
  const P = { 6: { R: B[6][0], b3: B[6][1] }, 5: { 4: B[5][0], b5: B[5][0] + 1, 5: B[5][1] }, 4: { b7: B[4][0], R: B[4][1] }, 3: { b3: B[3][0], 4: B[3][1], b5: B[3][1] + 1 }, 2: { 5: B[2][0], b7: B[2][1] } };
  const pcs = BLUES(k), notes = []; let t = 0;
  const put = (s, d, len, x) => { notes.push(tagN(N(s, P[s][d], t, len, x), pcs)); t += len; };
  put(6, 'R', 0.5); put(6, 'b3', 0.5); put(5, '4', 0.5); put(5, 'b5', 0.5, 'h'); put(5, '5', 0.5, 'h'); put(4, 'b7', 0.5); put(4, 'R', 1, '~'); t = 4;
  put(2, '5', 0.5); put(3, 'b5', 0.5); put(3, '4', 0.5, 'p'); put(3, 'b3', 0.5, 'p'); put(4, 'R', 0.5); put(4, 'b7', 0.5, 'p'); put(5, '5', 1, '~'); t = 8;
  [[5, '5'], [4, 'b7'], [4, 'R', 'h'], [3, 'b3'], [3, '4', 'h'], [3, 'b5', 'h']].forEach(([s, d, x]) => put(s, d, 1 / 3, x)); put(2, '5', 2, '~'); t = 12;
  put(5, '5', 0.5); put(5, 'b5', 0.5, 'p'); put(5, '4', 0.5, 'p'); put(6, 'b3', 0.5); put(6, 'R', 2, '~');
  return make(c, {
    id: 'pent-blue-note', name: `The blue note: the ♭5 as a passing tone in four box-1 licks (${nameOf(k)} minor)`, domain: 'improv', method: 'external-focus',
    unit: '8th notes and triplets', goal: 96, start: 56, minutes: 5, backing: [nameOf(k) + '7', nameOf(k + 5) + '7', nameOf(k) + '7', nameOf(k + 7) + '7'],
    why: `Adding the ♭5 (${nameOf(k + 6)}) between the 4 and the 5 turns the pentatonic into the blues scale. It is a tense note: it sounds great passing through on its way to the 4 or the 5, and sour when held, so it lives in the middle of a lick, never at the end.`,
    instr: `In box 1 the ♭5 is one fret above the 4: on the A string (fret ${P[5].b5}) and on the G string (fret ${P[3].b5}, a pinky stretch). Lick 1 climbs 4–♭5–5 with hammer-ons; lick 2 falls ♭5–4–♭3 with pull-offs; lick 3 is a triplet run ending on the 5; lick 4 falls 5–♭5–4 to the root. Listen for the ♭5 as a quick, bluesy rub that always resolves. Pass: each lick 4 times in time, then 4 bars of your own with the ♭5 only as a passing note.`,
    watch: 'Landing on the ♭5 or holding it: pass through it.', simplify: 'Licks 1 and 4 only.', tab: { notes }
  });
}

/* --------------------------- Mastery: generators --------------------------- */
/** Key and box change every bar, chosen at random (fixed per level): retrieval under pressure. */
export function randomAccess(c) {
  const r = rng(97 + (c.lvl || 9)), keys = [9, 4, 2, 7, 0, 5], notes = []; let t = 0; const names = [];
  for (let bar = 0; bar < 8; bar++) {
    const k = keys[Math.floor(r() * keys.length)], b = 1 + Math.floor(r() * 5), l = box(k, b); if (!l) continue;
    names.push(`${nameOf(k)}/${b}`);
    const dir = r() < 0.5 ? l : l.slice().reverse(), seq = dir.slice(0, 12);
    notes.push(...timed(seq, 0.25, t)); t += 4;
  }
  return make(c, {
    id: 'pent-random-access', name: 'Random access: a new key and box every bar', domain: 'fretboard', method: 'interleaving',
    unit: '16th notes', goal: 110, start: 60, minutes: 5, dl: 1,
    why: 'At mastery level the scale should be available instantly in any key and position. Unpredictable changes are the hardest, and most transferable, way to practice that.',
    instr: `The order is ${names.join(', ')} (key/box). Read only the key and box, not the notes: cover the tab and play each one from memory, 12 notes per bar with a beat to move. Pass: all 8 bars from memory at the goal tempo.`,
    watch: 'Hesitating on boxes 4 and 5: give them extra reps in the earlier stages.', simplify: 'The same key throughout, only the box changes.', tab: { notes }
  });
}
/** An original eight-bar study that uses everything: motif, sequence, bend, slide, a fast run, the answer. */
export function capstoneEtude(c) {
  const k = minorKey(c), b1 = box(k, 1), b2 = box(k, 2); if (!b1 || !b2) return null;
  const B1 = byString(pentBox(k, 1)), B2 = byString(pentBox(k, 2)), notes = []; let t = 0;
  const put = (s, f, d, x, extra) => { notes.push(N(s, f, t, d, x, extra)); t += d; };
  const rootIx = b1.findIndex(([s, f], i) => i >= 3 && mod12(pitch(s, f) - k) === 0);
  // bars 1–2: motif and its echo a step higher
  [[0, 0.5], [1, 0.5], [2, 1]].forEach(([d, l]) => put(...b1[rootIx - 1 + d], l)); t = 4;
  [[0, 0.5], [1, 0.5], [2, 1]].forEach(([d, l]) => put(...b1[rootIx + d], l)); t = 8;
  // bar 3: a groups-of-4 fragment in 16ths, down from the top
  const top = b1.slice(-6).reverse(); for (let i = 0; i + 4 <= top.length && t < 11.5; i++) top.slice(i, i + 4).forEach(([s, f]) => put(s, f, 0.25)); t = 12;
  // bar 4: the 4 → 5 bend on the G string, held with vibrato
  put(3, B1[3][1], 2, 'b', { bendTo: B1[3][1] + 2 }); put(3, B1[3][1] + 2, 2, '~'); t = 16;
  // bar 5: slide into box 2 and climb
  put(3, B1[3][1], 0.5); put(3, B2[3][1], 0.5, '/'); put(2, B2[2][0], 0.5); put(2, B2[2][1], 0.5); put(1, B2[1][0], 0.5); put(1, B2[1][1], 1.5, '~'); t = 20;
  // bar 6: a fast run back down box 1 in sextuplets
  b1.slice().reverse().slice(0, 12).forEach(([s, f]) => put(s, f, 1 / 6)); t = 24;
  // bars 7–8: the motif again, then the answer to the root
  [[0, 0.5], [1, 0.5], [2, 1]].forEach(([d, l]) => put(...b1[rootIx - 1 + d], l)); t = 28;
  b1.slice(Math.max(0, rootIx - 3), rootIx + 1).reverse().forEach(([s, f], i, a) => put(s, f, i === a.length - 1 ? 2.5 : 0.5, i === a.length - 1 ? '~' : null));
  return make(c, {
    id: 'pent-capstone-etude', name: `Capstone study: an 8-bar pentatonic piece (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'mixed rhythms', goal: 96, start: 60, minutes: 8, dl: 1, backing: [nameOf(k) + 'm', nameOf(k) + 'm', nameOf(k + 10), nameOf(k) + 'm'],
    why: 'A short original piece that uses every skill of the path in one musical whole: motif and echo, a sequence, an in-tune bend, a slide into the next box, a fast run and a resolution. Mastery is being able to do all of it in one breath, in time, musically.',
    instr: 'Learn it two bars at a time (chunking), then join the halves. Play it over the backing with dynamics: quiet motif, louder run, singing bend. Then write your own 8 bars with the same plan. Pass: the study at the goal tempo with no stops, then your own version recorded once.',
    watch: 'Rushing the sextuplet bar into the ending: land the last root exactly on bar 8.', simplify: 'Bars 1–4 only.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const run = (id, name, method, opts) => c => compose(c, { id, name, method, ...opts });
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'pentatonic', kind: 'technique', title: 'Pentatonic mastery', domain: 'fretboard',
  re: /(?<!(?:speed|fast|stretched|stretch|5s|fives|6s|sixes|in groups of \w+) )\bpentatonics?\b(?! ?(in |plus|with|speed|runs?\b|sextuplets?|sixes|stretch))|\bpenta\b|minor pentatonic|pentatonic (scale|mastery|boxes|positions|soloing)/,
  aliases: ['pentatonic scale', 'minor pentatonic', 'pentatonic boxes'],
  summary: 'The five-note scale behind rock, blues and most lead guitar, built from scratch: one string, the box, all five boxes and the slides between them, the major pentatonic and the blue note, sequences, keys, bends and phrasing, then real soloing.',
  prereqs: [],
  sources: ['https://justinguitar.com/guitar-lessons/minor-pentatonic-the-5-patterns-sc-304', 'https://guitarplayer.com/lessons/soar-along-the-neck-with-the-minor-pentatonic-scales-overlapping-patterns', 'https://guitarlessons.com/guitar-lessons/lead-guitar/pentatonic-scale-sequencing-3s/', 'https://community.justinguitar.com/t/first-steps-in-blues-improvisation-using-minor-pentatonic-scale-pattern-1/78164', 'https://www.halleonard.com/product/695699', 'https://www.pickupmusic.com/blog/how-to-play-minor-pentatonic-scales', 'https://jgmusiclessons.com/how-to-play-minor-pentatonic-scales-on-guitar/', 'https://hubguitar.com/fretboard/pentatonic-scale-sequences', 'https://study-guitar.com/blog/the-minor-pentatonic-scale-on-guitar', 'https://www.premierguitar.com/articles/25911-blue-horizons-how-to-mix-major-and-minor-pentatonics', 'https://community.justinguitar.com/t/major-pentatonic-in-the-blues/2095', 'https://www.guitarworld.com/lessons/three-essential-blues-scales-every-guitarist-should-know', 'https://study-guitar.com/blog/the-blues-scale-on-guitar'],
  pedagogy: {
    date: '2026-10-15',
    summary: 'Teachers start with one shape (pattern 1, rooted on the low E string), played slowly and perfectly and used at once in licks and restricted-note improvising; then add the other four patterns one at a time, link neighbours through their shared notes and slides, drill sequences against a metronome in every pattern, and finish by soloing across the whole neck.',
    sequence: [
      { id: 'one-shape', tier: 'foundations', step: 'Pattern 1, slowly and perfectly', how: 'Learn the first shape before any other: one finger per fret, fingertips, no barre; root to the top, down to the lowest note and back to the root, about ten times perfectly at a very slow speed.', skills: ['pent-shape'], source: 0 },
      { id: 'roots', tier: 'foundations', step: 'Know the roots (and the degrees) of the shape', how: 'Find the roots that anchor each pattern and the key; label each note of the shape by its scale degree.', skills: ['pent-know'], source: 1 },
      { id: 'licks', tier: 'foundations', step: 'Licks from pattern 1, bends in tune', how: 'A handful of short licks in the first pattern teach the bend points (with supported fingers, never the pinky), the same-fret roll and phrasing.', skills: ['pent-licks'], source: 3 },
      { id: 'restricted', tier: 'foundations', step: 'First improvising: few notes, space, licks as building blocks', how: 'Improvise with only three notes in one spot, then with short phrases; vary the rhythm and where a lick starts.', skills: ['pent-first-music'], source: 3 },
      { id: 'all-five', tier: 'intermediate', step: 'Patterns 2 to 5, one at a time', how: 'Pattern 2 next, then 3, 4 and 5; each learned on its own, from the root, up and down.', skills: ['pent-boxes'], source: 0 },
      { id: 'connect', tier: 'intermediate', step: 'Connect neighbouring patterns', how: 'Neighbouring patterns share "linking notes"; loop pairs of patterns (1–2, 3–4, 5–1) and shift between them with slides.', skills: ['pent-connect'], source: 1 },
      { id: 'sequences', tier: 'intermediate', step: 'Sequences with a metronome', how: 'Interval sequences (skipping a note) and groups of 3 and 4 started on each scale note, slowly with a metronome, raising the tempo gradually; then in all five fingerings.', skills: ['pent-sequences'], source: 2 },
      { id: 'keys', tier: 'intermediate', step: 'Other keys', how: 'Move the shapes and licks to other keys by moving the root.', skills: ['pent-keys'], source: 3 },
      { id: 'expression', tier: 'intermediate', step: 'Bends and vibrato in tune', how: 'Bend the natural bend points up to the pitch of the fretted target; add vibrato to held notes.', skills: ['pent-expression'], source: 3 },
      { id: 'blues-major', tier: 'intermediate', step: 'The blues scale and the major pentatonic', how: 'Add the ♭5 as a passing note; learn the major pentatonic positions (the same shapes from a new root) and use major on the I chord, minor from the IV in a blues.', skills: ['pent-blue', 'pent-changes'], source: 4 },
      { id: 'neck', tier: 'advanced', step: 'The whole neck: mapping and moving between positions', how: 'Travel through every pattern along the neck with slides and legato, on single strings and across positions, in any key.', skills: ['pent-neck', 'pent-anykey'], source: 1 },
      { id: 'groups', tier: 'advanced', step: 'Longer groupings: 5 and 6', how: 'Groups of 5 and 6 notes, each started on the next scale note and fitted to one beat, with a metronome.', skills: ['pent-speed'], source: 2 },
      { id: 'phrasing', tier: 'advanced', step: 'Phrasing with licks and bends', how: 'Use licks and bends as building blocks of phrases over a backing, with space between them.', skills: ['pent-phrasing'], source: 3 },
      { id: 'tempo', tier: 'mastery', step: 'Push the tempo limit gradually', how: 'Raise the metronome step by step until you reach your limit, then keep pushing it over time, in every fingering.', skills: ['pent-performance'], source: 2 },
      { id: 'solo', tier: 'mastery', step: 'A full-neck solo over a progression', how: 'Use all five patterns, freely and in any key, in a complete solo over a chord progression.', skills: ['pent-instant', 'pent-voice'], source: 1 }
    ],
    drills: ['Pattern from the root to the top, down to the lowest note and back to the root, slowly and perfectly', 'Pairs of neighbouring patterns looped through their linking notes', 'Interval sequences and groups of 3, 4, 5 and 6 with a metronome, in all five fingerings', 'Licks per pattern, moved to other keys', 'Restricted improvising with three notes', 'Bends to the pitch of the fretted target', 'A full-neck solo over a progression'],
    mistakes: ['Bending with the pinky or a lone finger', 'Barring or folding the fingers, so notes ring together', 'Running all five patterns up and down without making music with any of them', 'Raising the tempo before the pattern is clean', 'Losing the group when the string changes in a sequence', 'Bends that stop short of the pitch'],
    sources: [
      { title: 'Minor Pentatonic: The 5 Patterns', author: 'Justin Sandercoe (JustinGuitar)', url: 'https://justinguitar.com/guitar-lessons/minor-pentatonic-the-5-patterns-sc-304' },
      { title: 'Soar Along the Neck with the Minor Pentatonic Scale’s Overlapping Patterns', author: 'Tom Kolb (Guitar Player)', url: 'https://guitarplayer.com/lessons/soar-along-the-neck-with-the-minor-pentatonic-scales-overlapping-patterns' },
      { title: 'Pentatonic Scale Sequences, parts 1 and 2', author: 'Hub Guitar', url: 'https://hubguitar.com/fretboard/pentatonic-scale-sequences' },
      { title: 'First Steps in Blues Improvisation using Minor Pentatonic Scale Pattern 1 (Blues Lead Guitar course)', author: 'Justin Sandercoe (JustinGuitar)', url: 'https://community.justinguitar.com/t/first-steps-in-blues-improvisation-using-minor-pentatonic-scale-pattern-1/78164' },
      { title: 'Pentatonic Scales for Guitar: The Essential Guide (Hal Leonard)', author: 'Chad Johnson', url: 'https://www.halleonard.com/product/695699' },
      { title: 'Pentatonic Scale Sequencing 3’s', author: 'Guitareo (guitarlessons.com)', url: 'https://guitarlessons.com/guitar-lessons/lead-guitar/pentatonic-scale-sequencing-3s/' }
    ]
  },
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Box 1, by ear and from memory',
      'Play box 1 up and down from memory at 80 BPM in 8th notes, find every root without the tab, play four box-1 licks with in-tune bends, and improvise 8 bars over a backing with only three notes.', [
        S('pent-shape', 'The shape, in small pieces', 'fretboard', 'One string first, then box 1 two strings at a time, then whole, slowly and cleanly.', [c => oneStringIntro(c), c => boxChunks(c),
          run('pent-box1-clean', 'Box 1 of {key} pentatonic, clean and even', 'accurate-reps', { box: 1, seq: 'updown', step: 0.5, goal: 100, why: 'Accuracy first, then speed: clean repetitions build the movement you will keep; fumbled ones build the fumble.', instr: 'Up and down the box in 8th notes with strict alternate picking. If a note buzzes or a string rings over, drop 10 BPM. Pass: 4 clean repetitions in a row.', watch: 'Speeding up on the easy strings: keep every note the same length.', simplify: 'Quarter notes.' })],
          ST('The minor pentatonic is five notes: root, ♭3, 4, 5, ♭7. On one string they are distances of 3, 2, 2, 3 and 2 frets; folded across the strings they make box 1, two notes per string.', 'Almost every rock and blues solo starts from this shape: it is the first map of the neck most players learn.', ['No half steps between neighbouring notes: that is why the scale rarely sounds wrong.', 'Box 1 starts on the root on the low E string; one finger per fret, index to pinky.'])),
        S('pent-know', 'Know the notes you play', 'theory', 'Roots and degrees, recalled rather than read.', [c => rootsEverywhere(c), c => degreeCallouts(c, { order: ['R', '5', '♭3'] })],
          ST('Every note of the box has a name relative to the key: R, ♭3, 4, 5 or ♭7. The roots are the anchors: two or three in every box.', 'Knowing the degrees tells you which notes sound resolved (R, 5), minor (♭3) or tense (4, ♭7).', ['In box 1 the roots sit under the index finger on strings 6 and 1, and under the ring finger on string 4.', 'The 5th is always two frets above the 4th on the same string in box 1.'])),
        S('pent-licks', 'Licks from box 1', 'improv', 'Short licks that show the bends, the roll and the fingers.', [c => box1Licks(c, { set: 1 }), c => box1Licks(c, { set: 2 })],
          ST('A lick is a short, complete phrase. Box 1 has three natural bend points (4 → 5 on the G string, ♭7 → root on the B, ♭3 → 4 on the high e) and one spot where two strings share a fret, played with one rolled finger.', 'Licks turn the shape into music straight away and teach where the bends and the fingers go.', ['Bend with the ring finger and the fingers behind it; the pinky rarely bends.', 'A lick is a building block: change its rhythm, start it on another beat, make it your own.'])),
        S('pent-first-music', 'First music', 'improv', 'Three notes, short phrases and space, over a groove.', [c => threeNotes(c), c => motifPhrase(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])],
          ST('A phrase is a short idea, repeated and varied, with space after it, like a sentence.', 'Three notes and a rest already make music; running the whole box doesn’t.', ['Say it, say it again a step higher, then answer down to the root.']))
      ], [1, 3]),
    stage('intermediate', 'All five boxes, connected; major and blue',
      'Play all five boxes and slide between neighbours in time, run box 1 in groups of 3, 4 and in 3rds at 100 BPM, change key every two bars, bend to pitch, use the ♭5 as a passing note, and switch from the major pentatonic on the I chord to the minor from the IV chord in a 12-bar blues.', [
        S('pent-boxes', 'Boxes 2 to 5', 'fretboard', 'The other four shapes, one at a time.', [
          run('pent-box2', 'Box 2 of {key} pentatonic', 'chunking', { box: 2, seq: 'updown', why: 'Box 2 starts on the note where box 1 ends on each string: learn it as box 1’s upper half plus two new notes.', instr: 'Up and down, then play box 1 and box 2 back to back. Pass: 4 clean in a row.', watch: 'The B-string shift: the shape moves one fret up on strings 2 and 1.', simplify: 'The bottom four strings only.' }),
          run('pent-box3', 'Box 3 of {key} pentatonic', 'chunking', { box: 3, seq: 'updown', why: 'Box 3 is the home of many classic bends and the bridge to the upper boxes.', instr: 'Up and down; say where the roots are before you start. Pass: 4 clean in a row.', watch: 'Losing the root position: it sits under the pinky on string 5 and the index on string 3.', simplify: 'Strings 6–3 only.' }),
          run('pent-box45', 'Box 4 of {key} pentatonic', 'chunking', { box: 4, seq: 'updown', why: 'Box 4 starts on the 4th of the key on the low E string and holds the root on the G string: the shape behind many high, bending phrases.', instr: 'Up and down; then play box 3 and box 4 back to back. Pass: 4 clean in a row.', watch: 'The B-string shift: the top two strings move up one fret.', simplify: 'Strings 6–3 only.' }),
          run('pent-box5', 'Box 5 of {key} pentatonic', 'chunking', { box: 5, seq: 'updown', why: 'Box 5 completes the map: it starts on the ♭7 on the low E string, and its top notes are box 1 an octave up, so the five shapes join into a loop that repeats every 12 frets.', instr: 'Up and down; say where the roots are (under the ring finger on the low and high E strings) before you start; then play box 4 and box 5 back to back. Pass: 4 clean in a row.', watch: 'Mixing up boxes 4 and 5 at the B string.', simplify: 'Strings 6–3 only.' })],
          ST('The five boxes are the same five notes laid out in five overlapping positions; each box starts on the next note of the scale on the low E string.', 'Knowing all five frees you from one position: the whole neck becomes playable.', ['Each box shares its lower notes with the box below and its upper notes with the box above.', 'After box 5 the pattern repeats: box 1 again, 12 frets higher.'])),
        S('pent-connect', 'Slides between the boxes', 'fretboard', 'A slide on the G string from each box into the next.', [c => slideConnect(c, { from: 1, to: 2 }), c => slideConnect(c, { from: 2, to: 3 }), c => slideConnect(c, { from: 4, to: 5 })],
          ST('Neighbouring boxes share notes; a slide on one string carries the hand from one to the next in the middle of a line.', 'Players move through the boxes on slides rather than jumping; it keeps lines smooth and vocal.', ['The slide goes from the top note of the lower box to the next scale note, which belongs to the upper box.'])),
        S('pent-sequences', 'Sequences', 'picking', 'One scale, many orders: the vocabulary of fast, musical runs.', [
          run('pent-seq3', '{key} pentatonic in groups of 3', 'variable', { box: 1, seq: 'threes', goal: 115, why: 'Sequences break the up-and-down habit and make runs sound like melodies.', instr: 'Three notes up from each note of the box, then back down. Accent the first of each group. Pass: 4 clean at the goal tempo.', watch: 'Losing the group when the string changes.', simplify: 'Only the ascending half.' }),
          run('pent-seq4', '{key} pentatonic in groups of 4', 'variable', { box: 1, seq: 'fours', goal: 115, why: 'Groups of four line up with the beat in 16ths: the backbone of rock and blues runs.', instr: 'Four up from each note, then down. Pass: 4 clean at the goal tempo.', watch: 'Rushing the last note of each group.', simplify: '8th notes.' }),
          run('pent-thirds', '{key} pentatonic in 3rds', 'variable', { box: 1, seq: 'thirds', goal: 110, why: 'Skipping a note gives wider, more vocal intervals and trains the picking hand to jump strings.', instr: 'Play every other note: 1–3, 2–4, 3–5… up, then the same coming down. Pass: 4 clean at the goal tempo.', watch: 'Hitting the string in between.', simplify: 'Half the box.' })],
          ST('A sequence is a pattern applied to every note of the scale: groups of 3 or 4, or skips (3rds).', 'Sequences turn a scale into melodic runs and train the picking hand for every string change.', ['Groups of 4 in 16ths line up with the beat; groups of 3 in 16ths cross it.'])),
        S('pent-keys', 'Every key', 'fretboard', 'The same shape anywhere on the neck.', [c => keysInterleaved(c), c => keysInterleaved(c, { boxN: 2 })],
          ST('The pentatonic is a movable shape: start box 1 on any root on the low E string and you are in that key.', 'Songs come in every key; the shape has to be ready wherever the root is.', ['Find the root on the low E string first; the box follows.'])),
        S('pent-expression', 'Bends and vibrato', 'fretting', 'The pentatonic’s voice.', [c => bendTargets(c), M('external-focus', ['vibratoHolds'])],
          ST('The box has three natural bend points: the 4 up to the 5 on the G string, the ♭7 up to the root on the B string, and the ♭3 up to the 4 on the high E.', 'Bends and vibrato make the scale sing; out-of-tune bends ruin it.', ['A whole-step bend reaches the pitch two frets higher: play that fret first to hear the target.'])),
        S('pent-blue', 'The blue note', 'improv', 'The ♭5 as a passing tone in box-1 licks.', [c => blueLicks(c), M('transfer', ['callResponse', { chords: '$blues', scale: 'blues' }])],
          ST('Adding the ♭5 to the minor pentatonic makes the blues scale. In box 1 it sits one fret above the 4, on the A and G strings.', 'It is the bluesiest note there is, but it is a passing note: it sounds right moving between the 4 and the 5, wrong when held.', ['Blues scale: R ♭3 4 ♭5 5 ♭7.', 'Use it in the middle of a lick, then resolve to the 4 or 5.'])),
        S('pent-changes', 'Major and minor over a blues', 'improv', 'The major shape 3 frets down; switch on the IV chord.', [c => majorShape(c), c => majorRoots(c), c => bluesSwitch(c), M('transfer', ['targetSolo', { chords: '$blues', scale: 'minorPent' }]), M('variable', ['modeCompare', { modes: ['minorPent', 'majorPent'] }])],
          ST('Moved down 3 frets, the minor pentatonic shape becomes the major pentatonic of the original root (R 2 3 5 6): a minor key and its relative major share their notes.', 'Over a blues, major pentatonic on the I chord and minor pentatonic from the IV chord is the classic way to sound both sweet and bluesy.', ['A minor pentatonic at fret 5, A major pentatonic at fret 2: the same shape.', 'Over the IV chord (D7 in A), the minor pentatonic’s C is that chord’s ♭7, while the major pentatonic’s C♯ clashes with it.']))
      ], [4, 6]),
    stage('advanced', 'The whole neck, any key, real phrases',
      'Run the diagonal shape and a single string in 16ths at 100 BPM, slide from box 5 into box 1 an octave up, play groups of 5 and 6, take the scale through all 12 keys in one area of the neck, and solo landing on planned degrees.', [
        S('pent-neck', 'Across the neck', 'fretboard', 'Diagonal and horizontal shapes that join the boxes.', [
          run('pent-diag', 'The diagonal {key} pentatonic (three notes per string)', 'variable', { shape: 'diag', seq: 'updown', step: 0.25, goal: 105, dl: 0, why: 'Three notes per string carries you across two boxes in one smooth line: the shape behind long, fast runs.', instr: 'Up and down in 16ths; slide the index finger to shift positions on the way up. Pass: 4 clean at the goal tempo.', watch: 'Uneven timing on the stretches.', simplify: '8th notes.' }),
          c => alongOneString(c, { s: 3 }), c => slideConnect(c, { from: 3, to: 4 }), c => slideConnect(c, { from: 5, to: 1 })],
          ST('Diagonal (three notes per string) and horizontal (one string) shapes cut across the boxes and join them.', 'Long runs and melodic lines travel along the neck; boxes alone keep you in one place.', ['The diagonal shape covers two boxes; slide the index finger to shift.', 'Box 5 slides into box 1 an octave up: the map repeats every 12 frets.'])),
        S('pent-speed', 'Groups of 5 and 6', 'picking', 'The sequences behind cascading runs.', [M('variable', c => ejRolling5s(c)), M('variable', c => pgPent6s(c))],
          ST('Groups of 5 and 6 sound fast and cascading: in 16ths or sextuplets they roll across the beat.', 'They are the vocabulary of Eric Johnson’s and Paul Gilbert’s pentatonic runs.', ['Six-note groups fit sextuplets exactly: one group per beat.'])),
        S('pent-anykey', 'Every key, every position', 'fretboard', 'Find the scale where your hand already is.', [c => fourthsNearest(c), c => degreeTargets(c)],
          ST('Each key has all five boxes; one of them is always within a few frets of your hand.', 'Real songs change key: good players find the scale where they already are.', ['Moving up a 4th moves box 1 five frets up, or one box down from where you are.'])),
        S('pent-phrasing', 'Phrasing like a singer', 'improv', 'Motifs, bends and space, over slow blues.', [c => motifPhrase(c, { bends: true, seed: 3 }), M('transfer', ['callResponse', { chords: '$slowBlues', scale: 'minorPent' }])],
          ST('Phrasing is how notes are grouped and shaped: motifs, repetition, bends, vibrato and rests.', 'It is the difference between playing the scale and saying something with it.', ['Leave as much space as you play.']))
      ], [7, 8]),
    stage('mastery', 'Instant, fast and your own',
      'Play any key and box on demand at 110 BPM in 16ths, run the whole neck in sextuplets, solo over a blues switching minor and major pentatonic with the chords, and perform your own 8-bar pentatonic piece.', [
        S('pent-instant', 'Instant recall', 'fretboard', 'Any key, any box, no warning.', [c => randomAccess(c), c => keysInterleaved(c, { keys: KEYSETS.fourths, boxN: 3 })],
          ST('At mastery the scale is available in any key and box on demand, without finding it from box 1.', 'Unpredictable practice is harder now and transfers best to real playing.', ['Name key and box first, then play.'])),
        S('pent-performance', 'Performance tempo', 'picking', 'Full-neck runs at speed.', [M('edge', c => ejSixesAcross(c)), run('pent-diag-fast', 'The diagonal {key} pentatonic in sextuplets', 'edge', { shape: 'diag', seq: 'sixes', step: 1 / 6, goal: 100, why: 'Six-note groups on the diagonal shape: long, fast lines that still divide clearly into beats.', instr: 'One group of six per beat, accent the first. Use the tempo ladder: start at the target, add a few BPM after every clean pass. Pass: 4 clean at the goal tempo.', watch: 'Tension in the picking forearm as the tempo rises: stop and shake it out.', simplify: '16th notes.' })],
          ST('Performance tempo is reached by small tempo steps from a clean tempo, not by forcing.', 'Fast runs only work in music if they stay clean and relaxed.', ['Add 3–5 BPM after two clean passes.'])),
        S('pent-voice', 'Your own voice', 'improv', 'Solos and a piece of your own.', [c => capstoneEtude(c), M('transfer', ['targetSolo', { chords: '$blues', scale: 'majorPent' }])],
          ST('A short original study that uses every skill of the path, then rewritten as your own.', 'Mastery is using the scale musically in one breath: motif, sequence, bend, slide, run, resolution.', ['Plan the shape of the solo: quiet start, a peak, a resolution.']))
      ], [9, 10])
  ]
});
