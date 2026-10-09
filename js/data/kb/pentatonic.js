// The minor pentatonic scale, from scratch to mastery.
//
// Concept-first: instead of a list of fixed tabs, this file holds a model of the
// scale (its degrees, the five boxes, the diagonal and one-string shapes, where
// it bends, which notes are chord tones) and a composer that builds exercises
// from independent dimensions: shape × sequence × rhythm × key plan × technique ×
// musical context. Every lesson is one choice along those dimensions, at any key
// and level, and is tagged with the learning method it applies (js/core/methods.js):
// chunking, accurate repetitions, retrieval, interleaving, variable practice, focus
// on the sound, hearing it first, and use in music. New lessons are new specs, not
// new code. This is the reference for how the content runs should model a topic
// (CONTENT.md, "Concept-first lessons").
import { OPEN, N, make, pentBox, pent3nps, byString, nameOf, minorKey, mod12, S, stage, entry, M } from '../lib.js';
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
    why: 'Every phrase is heard against the root, and every box is anchored by it. Finding the roots from memory, not from the tab, is what lets you start a solo anywhere.',
    instr: 'Before each bar, say out loud where the roots of the next box are, then look away from the screen and play them. Use the tab only to check yourself afterwards. Pass: all five boxes with no peeking, twice.',
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
    id: 'pent-degree-callouts', name: `Degree call-outs in box 1: ${order.join(', ')}`, domain: 'theory', method: 'retrieval',
    unit: 'quarter notes', goal: 80, start: 50, minutes: 4,
    why: 'Knowing which note of the scale is under each finger (root, ♭3, 4, 5, ♭7) is what turns a shape into music: it tells you which notes sound resolved, tense or bluesy.',
    instr: `Each bar plays one degree wherever it sits in box 1: first every root, then every 5th, every ♭3, every ♭7, every 4th. Say the degree name as you play. Then do it with the tab hidden. Pass: the whole order from memory without a wrong note.`,
    watch: 'Mixing up the 4th and the 5th: the 5th is always two frets above the 4th on the same string in this box.', simplify: 'Roots and 5ths only.', tab: { notes }
  });
}
/** Play a note, rest a beat while singing the next one, then play it (hear it first). */
export function singThenPlay(c) {
  const k = minorKey(c), list = box(k, 1); if (!list) return null;
  const pick = list.slice(2, 9), notes = []; let t = 0;
  [...pick, ...pick.slice(0, -1).reverse()].forEach(([s, f]) => { notes.push(N(s, f, t, 1)); t += 2; });
  return make(c, {
    id: 'pent-sing-then-play', name: `Sing, then play: ${nameOf(k)} minor pentatonic`, domain: 'ear', method: 'audiation',
    unit: 'one note every 2 beats', goal: 80, start: 50, minutes: 4,
    why: 'Singing the next note before playing it connects the sound in your head to the place on the neck: the foundation of playing what you hear.',
    instr: 'Play a note on the beat, then during the silent beat sing the next note of the scale (any octave, quietly is fine). Play it and check: did your voice match? Pass: 8 notes in a row where the sung note matched.',
    watch: 'Playing the note first and singing along afterwards: sing it before you play it.', simplify: 'Three notes only: root, ♭3, 4.', tab: { notes }
  });
}
/** The app plays a short phrase, then leaves a bar of silence for you to echo it by ear (hear it first). */
export function echoCalls(c) {
  const k = minorKey(c), list = box(k, 1); if (!list) return null;
  const r = rng(53 + (c.lvl || 2)), notes = []; let t = 0;
  const rootIx = list.findIndex(([s, f], i) => i >= 3 && mod12(pitch(s, f) - k) === 0);
  const len = (c.lvl || 2) <= 2 ? 3 : 4;
  for (let ph = 0; ph < 4; ph++) {
    let ix = rootIx + Math.floor(r() * 3) - 1;
    for (let i = 0; i < len; i++) {
      const [s, f] = list[Math.max(0, Math.min(list.length - 1, ix))];
      const d = i === len - 1 ? 2 - (len - 1) * 0.5 + 1 : 0.5;
      notes.push(N(s, f, t, Math.max(0.5, d))); t += i === len - 1 ? Math.max(0.5, d) : 0.5;
      ix += r() < 0.5 ? -1 : 1;
    }
    t = Math.ceil(t / 4) * 4 + 4; // a silent bar for your echo
  }
  return make(c, {
    id: 'pent-echo-calls', name: `Call and echo by ear (${nameOf(k)} minor, box 1)`, domain: 'ear', method: 'audiation',
    unit: `${len}-note phrases`, goal: 80, start: 55, minutes: 5,
    why: 'Copying short phrases by ear, straight away and in time, is how players learn to play what they hear. The silent bar is your turn.',
    instr: 'Cover the tab and the fretboard. Listen to each phrase, then play it back in the silent bar that follows. Start from the root (the first note is always near it). Check yourself against the tab only after each round. Pass: 3 of the 4 phrases echoed exactly, twice in a row.',
    watch: 'Looking at the tab before you try: guess, then check.', simplify: 'Turn the tempo down and echo only the first two notes of each phrase.', tab: { notes }
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
/** Box `from` on the low strings, a slide on the G string into box `to`, up and back (connecting boxes). */
export function slideConnect(c, { from = 1, to = 2 } = {}) {
  const k = minorKey(c), A = byString(pentBox(k, from)), B = byString(pentBox(k, to)); if (!A[3] || !B[3]) return null;
  const up = [[6, A[6][0]], [6, A[6][1]], [5, A[5][0]], [5, A[5][1]], [4, A[4][0]], [4, A[4][1]], [3, A[3][0]], [3, A[3][1]], [3, B[3][1]], [2, B[2][0]], [2, B[2][1]], [1, B[1][0]], [1, B[1][1]]];
  const step = runStep(Math.min(6, c.lvl || 5));
  const notes = up.map(([s, f], i) => N(s, f, i * step, step, i === 8 && B[3][1] > A[3][1] ? '/' : null));
  const down = up.slice(0, -1).reverse(), t0 = up.length * step;
  down.forEach(([s, f], i) => notes.push(N(s, f, t0 + i * step, step, i === 4 && A[3][1] < B[3][1] ? '\\' : null)));
  landOnRoot(notes, k, box(k, from));
  return make(c, {
    id: `pent-slide-${from}-${to}`, name: `Slide from box ${from} into box ${to} (${nameOf(k)} minor)`, domain: 'fretboard', method: 'chunking',
    unit: unitName(step), goal: 100, start: 55, minutes: 5,
    why: 'Boxes are only useful when you can leave them. A slide on the G string carries the hand into the next box without a break in the line, so the neck becomes one map instead of five islands.',
    instr: `Box ${from} up to the G string, slide up the G string into box ${to}, finish the top strings there; come back the same way. Pass: 4 times in a row with the slide landing in time.`,
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
    instr: `Box ${boxN}, ascending, then hold the top note while you find the next key's position: ${names.join(' → ')}. Say the key out loud during the held note. Pass: the whole cycle without stopping, twice, then once with the tab hidden.`,
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
  const notes = seq.map(([ss, f], i) => { const prev = seq[i - 1]; return N(ss, f, i * step, step, prev && Math.abs(prev[1] - f) >= 3 ? (f > prev[1] ? '/' : '\\') : null); });
  landOnRoot(notes, k, l);
  return make(c, {
    id: `pent-one-string-${s}`, name: `The whole scale along the ${['', 'high E', 'B', 'G', 'D', 'A', 'low E'][s]} string (${nameOf(k)} minor)`, domain: 'fretboard', method: 'variable',
    unit: unitName(step), goal: 100, start: 55, minutes: 4,
    why: 'Boxes are vertical; melodies are often horizontal. Playing the scale along one string shows the intervals as distances (3 frets, 2 frets…) and links every box through the notes they share.',
    instr: 'One finger does most of the work, sliding on the wide jumps. Say the degree of each note as you go (R, ♭3, 4, 5, ♭7). Pass: up and down twice without a wrong note, then once on another string.',
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
export default entry({
  id: 'pentatonic', kind: 'technique', title: 'Pentatonic mastery', domain: 'fretboard',
  re: /(?<!(?:speed|fast|stretched|stretch|5s|fives|6s|sixes|in groups of \w+) )\bpentatonics?\b(?! ?(in |plus|with|speed|runs?\b|sextuplets?|sixes|stretch))|\bpenta\b|minor pentatonic|pentatonic (scale|mastery|boxes|positions|soloing)/,
  aliases: ['pentatonic scale', 'minor pentatonic', 'pentatonic boxes'],
  summary: 'The five-note scale behind rock, blues and most lead guitar, built from scratch: the box, every position, sequences, keys, bends and phrasing, then real soloing.',
  prereqs: [],
  sources: ['https://www.pickupmusic.com/blog/how-to-play-minor-pentatonic-scales', 'https://jgmusiclessons.com/how-to-play-minor-pentatonic-scales-on-guitar/', 'https://hubguitar.com/fretboard/pentatonic-scale-sequences', 'https://study-guitar.com/blog/the-minor-pentatonic-scale-on-guitar'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Box 1, by ear and from memory',
      'Play box 1 up and down from memory at 80 BPM in 8th notes, find every root without looking, sing-then-play 8 notes in tune, and answer a backing with three-note phrases.', [
        S('pent-shape', 'The shape, in small pieces', 'fretboard', 'Box 1 two strings at a time, then whole, slowly and cleanly.', [c => boxChunks(c),
          run('pent-box1-clean', 'Box 1 of {key} pentatonic, clean and even', 'accurate-reps', { box: 1, seq: 'updown', step: 0.5, goal: 100, why: 'Accuracy first, then speed: clean repetitions build the movement you will keep; fumbled ones build the fumble.', instr: 'Up and down the box in 8th notes with strict alternate picking. If a note buzzes or a string rings over, drop 10 BPM. Pass: 4 clean repetitions in a row.', watch: 'Speeding up on the easy strings: keep every note the same length.', simplify: 'Quarter notes.' })]),
        S('pent-know', 'Know the notes you play', 'theory', 'Roots and degrees, recalled rather than read.', [c => rootsEverywhere(c), c => degreeCallouts(c, { order: ['R', '5', '♭3'] })]),
        S('pent-hear', 'Hear it before you play it', 'ear', 'Sing the next note, then find it.', [c => singThenPlay(c), c => echoCalls(c)]),
        S('pent-first-music', 'First music', 'improv', 'Short phrases with space, over a groove.', [c => motifPhrase(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'All five boxes, connected',
      'Play all five boxes and slide between neighbours in time, run box 1 in groups of 3, 4 and in 3rds at 100 BPM, change key every two bars without stopping, and bend to pitch.', [
        S('pent-boxes', 'Boxes 2 to 5', 'fretboard', 'The other four shapes, each joined to the last.', [
          run('pent-box2', 'Box 2 of {key} pentatonic', 'chunking', { box: 2, seq: 'updown', why: 'Box 2 starts on the note where box 1 ends on each string: learn it as box 1’s upper half plus two new notes.', instr: 'Up and down, then play box 1 and box 2 back to back. Pass: 4 clean in a row.', watch: 'The B-string shift: the shape moves one fret up on strings 2 and 1.', simplify: 'The bottom four strings only.' }),
          run('pent-box3', 'Box 3 of {key} pentatonic', 'chunking', { box: 3, seq: 'updown', why: 'Box 3 is the home of many classic bends and the bridge to the upper boxes.', instr: 'Up and down; say where the roots are before you start. Pass: 4 clean in a row.', watch: 'Losing the root position: it sits under the pinky on string 5 and the index on string 3.', simplify: 'Strings 6–3 only.' }),
          run('pent-box45', 'Boxes 4 and 5 of {key} pentatonic', 'chunking', { box: 4, seq: 'updown', why: 'Boxes 4 and 5 complete the map: box 5 leads back into box 1 an octave up.', instr: 'Box 4 up and down; then box 5 the same way (it is the next shape up the neck). Pass: both, 4 clean in a row.', watch: 'Mixing up boxes 4 and 5 at the B string.', simplify: 'Box 4 only.' }),
          c => slideConnect(c, { from: 1, to: 2 })]),
        S('pent-sequences', 'Sequences', 'picking', 'One scale, many orders: the vocabulary of fast, musical runs.', [
          run('pent-seq3', '{key} pentatonic in groups of 3', 'variable', { box: 1, seq: 'threes', goal: 115, why: 'Sequences break the up-and-down habit and make runs sound like melodies.', instr: 'Three notes up from each note of the box, then back down. Accent the first of each group. Pass: 4 clean at the goal tempo.', watch: 'Losing the group when the string changes.', simplify: 'Only the ascending half.' }),
          run('pent-seq4', '{key} pentatonic in groups of 4', 'variable', { box: 1, seq: 'fours', goal: 115, why: 'Groups of four line up with the beat in 16ths: the backbone of rock and blues runs.', instr: 'Four up from each note, then down. Pass: 4 clean at the goal tempo.', watch: 'Rushing the last note of each group.', simplify: '8th notes.' }),
          run('pent-thirds', '{key} pentatonic in 3rds', 'variable', { box: 1, seq: 'thirds', goal: 110, why: 'Skipping a note gives wider, more vocal intervals and trains the picking hand to jump strings.', instr: 'Play every other note: 1–3, 2–4, 3–5… up, then the same coming down. Pass: 4 clean at the goal tempo.', watch: 'Hitting the string in between.', simplify: 'Half the box.' })]),
        S('pent-keys', 'Every key', 'fretboard', 'The same shape anywhere on the neck.', [c => keysInterleaved(c), c => keysInterleaved(c, { boxN: 2 })]),
        S('pent-expression', 'Bends and vibrato', 'fretting', 'The pentatonic’s voice.', [c => bendTargets(c), M('external-focus', ['vibratoHolds'])]),
        S('pent-changes', 'Over the changes', 'improv', 'Minor and major pentatonic over a blues, landing on chord tones.', [M('transfer', ['targetSolo', { chords: '$blues', scale: 'minorPent' }]), M('variable', ['modeCompare', { modes: ['minorPent', 'majorPent'] }])])
      ], [4, 6]),
    stage('advanced', 'The whole neck, any key, real phrases',
      'Run the diagonal shape and a single string in 16ths at 100 BPM, play groups of 5 and 6, take the scale through all 12 keys in one area of the neck, and solo landing on planned degrees.', [
        S('pent-neck', 'Across the neck', 'fretboard', 'Diagonal and horizontal shapes that join the boxes.', [
          run('pent-diag', 'The diagonal {key} pentatonic (three notes per string)', 'variable', { shape: 'diag', seq: 'updown', step: 0.25, goal: 105, dl: 0, why: 'Three notes per string carries you across two boxes in one smooth line: the shape behind long, fast runs.', instr: 'Up and down in 16ths; slide the index finger to shift positions on the way up. Pass: 4 clean at the goal tempo.', watch: 'Uneven timing on the stretches.', simplify: '8th notes.' }),
          c => alongOneString(c, { s: 3 }), c => slideConnect(c, { from: 3, to: 4 })]),
        S('pent-speed', 'Groups of 5 and 6', 'picking', 'The sequences behind cascading runs.', [M('variable', c => ejRolling5s(c)), M('variable', c => pgPent6s(c))]),
        S('pent-anykey', 'Every key, every position', 'fretboard', 'Find the scale where your hand already is.', [c => fourthsNearest(c), c => degreeTargets(c)]),
        S('pent-phrasing', 'Phrasing like a singer', 'improv', 'Motifs, bends and space, over slow blues.', [c => motifPhrase(c, { bends: true, seed: 3 }), M('transfer', ['callResponse', { chords: '$slowBlues', scale: 'minorPent' }])])
      ], [7, 8]),
    stage('mastery', 'Instant, fast and your own',
      'Play any key and box on demand at 110 BPM in 16ths, run the whole neck in sextuplets, solo over a blues switching minor and major pentatonic with the chords, and perform your own 8-bar pentatonic piece.', [
        S('pent-instant', 'Instant recall', 'fretboard', 'Any key, any box, no warning.', [c => randomAccess(c), c => keysInterleaved(c, { keys: KEYSETS.fourths, boxN: 3 })]),
        S('pent-performance', 'Performance tempo', 'picking', 'Full-neck runs at speed.', [M('edge', c => ejSixesAcross(c)), run('pent-diag-fast', 'The diagonal {key} pentatonic in sextuplets', 'edge', { shape: 'diag', seq: 'sixes', step: 1 / 6, goal: 100, why: 'Six-note groups on the diagonal shape: long, fast lines that still divide clearly into beats.', instr: 'One group of six per beat, accent the first. Use the tempo ladder: start at the target, add a few BPM after every clean pass. Pass: 4 clean at the goal tempo.', watch: 'Tension in the picking forearm as the tempo rises: stop and shake it out.', simplify: '16th notes.' })]),
        S('pent-voice', 'Your own voice', 'improv', 'Solos and a piece of your own.', [c => capstoneEtude(c), M('transfer', ['targetSolo', { chords: '$blues', scale: 'majorPent' }])])
      ], [9, 10])
  ]
});
