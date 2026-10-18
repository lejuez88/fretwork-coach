// Economy picking: alternate picking on a string, and one continuous stroke (a sweep) through the
// string change whenever the next string lies in the direction the pick is already moving.
//
// Concept-first (CONTENT.md): the model is the pick-direction rule (odd numbers of notes per string
// make every string change a sweep), the three-notes-per-string positions of any scale (seven
// positions, one per degree on the low E string), the minor triads of the key on the top strings, and
// the sequences from the pentatonic path. The composer builds an exercise from scale × position ×
// note counts per string × sequence × note value × key plan; new lessons are new specs.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-18: the rest stroke on a triad
// (one push through the strings), two strings then three, odd note counts (3-1, 1-3), the same on the
// bass strings; then three notes per string up and down, positions, sequences and keys; then speed,
// other scales, positions mixed; then sextuplets, fives and your own piece. Removed: saying strokes,
// degrees or "6" aloud (`economy-odd-31`, `economy-pos3`, `economy-dorian`), covering the tab and "from
// memory" versions (`economy-pos4-recall`, `economy-dorian-recall`, the covered passes of
// `economy-keys`, `economy-random` and `economy-positions`). Study notes added to every skill.
import { OPEN, N, nameOf, minorKey, make, fromSeq, rootFret6, scaleNps, topTriad, mod12, SCALE_BY_ID, S, stage, entry, M } from '../lib.js';
import { SEQUENCES } from './pentatonic.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const pcsOf = (k, scale) => SCALE_BY_ID[scale].steps.map(x => mod12(k + x));
const inScale = (k, scale, p) => pcsOf(k, scale).includes(mod12(p));
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const unitName = step => UNIT.get(step) || '8th notes';
const SCALE_NAME = { minor: 'natural minor', dorian: 'Dorian', harmonicMinor: 'harmonic minor', phrygian: 'Phrygian' };
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/**
 * A three-notes-per-string position of a scale: pos 1–7 starts on that scale degree on the low E string.
 * Returns [[string, fret], …] low to high (18 notes), or null when it doesn't fit on the neck.
 */
export function position(k, scale = 'minor', pos = 1) {
  const deg = SCALE_BY_ID[scale].steps[(pos - 1) % 7];
  let f = mod12(k + deg - 40); if (f < 1) f += 12;
  for (const start of [f, f + 12, f - 12]) {
    if (start < 0) continue;
    const n = scaleNps(k, scale, start, 3);
    if (n && Math.max(...n.map(x => x.f)) <= 20) return n.map(x => [x.s, x.f]);
  }
  return null;
}
/** Keep the first `n` notes of each string (counts listed from string 6 to string 1). */
const thin = (list, counts) => list.filter(([s], i) => { const ix = list.slice(0, i).filter(x => x[0] === s).length; return ix < counts[6 - s]; });
/** The pick strokes economy picking gives a line: alternate, but keep the same stroke across a string change in that direction. */
export function strokes(seq) {
  const out = []; let last = null;
  seq.forEach(([s], i) => {
    if (!i) { out.push('D'); last = 'D'; return; }
    const prev = seq[i - 1][0];
    const st = s < prev ? 'D' : s > prev ? 'U' : last === 'D' ? 'U' : 'D';  // to a higher string (lower number): down
    out.push(st); last = st;
  });
  return out;
}
const strokeText = (seq, n = 6) => strokes(seq.slice(0, n)).join(' ');
const stepFor = lvl => (lvl <= 6 ? 1 / 3 : lvl <= 8 ? 0.25 : 1 / 6);
const endOf = notes => Math.max(...notes.map(n => n.t + n.d));
function landOnRoot(notes, k, list) {
  const root = list.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || list[0];
  const t = endOf(notes), bar = Math.ceil((t + 1) / 4) * 4;
  notes.push(N(root[0], root[1], t, bar - t));
  return notes;
}

/* ------------------------------- The composer ------------------------------- */
/**
 * One economy-picking exercise from a spec: { id, name ('{key}' and '{scale}' are filled in), method,
 * scale, pos, counts (notes per string, string 6 first), seq, step, goal, dl, why, instr, watch, simplify }.
 */
export function econ(c, spec) {
  const k = minorKey(c), scale = spec.scale || 'minor';
  let list = position(k, scale, spec.pos || 1); if (!list) return null;
  if (spec.counts) list = thin(list, spec.counts);
  const step = spec.step || stepFor(c.lvl || 5);
  const seq = (SEQUENCES[spec.seq || 'updown'] || SEQUENCES.updown)(list).slice(0, 180);
  const notes = landOnRoot(fromSeq(seq, step), k, list);
  const fill = s => s.replace('{key}', nameOf(k)).replace('{scale}', SCALE_NAME[scale] || scale);
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: 'picking', method: spec.method, unit: unitName(step), goal: spec.goal || 110, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'economy',
    why: spec.why, instr: fill(spec.instr).replace('{strokes}', strokeText(seq)), watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}

/* ------------------------- Foundations: generators ------------------------- */
/** The rest stroke: a minor-key triad, one note per string on strings 3-2-1, swept down then up (chunking). */
export function restStroke(c) {
  const k = minorKey(c), chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  const step = (c.lvl || 2) <= 2 ? 0.5 : 1 / 3, notes = [], vs = []; let near = 7, t = 0;
  for (const nm of chords) {
    const tr = topTriad(nm, near); if (!tr) return null; near = (tr[1] + tr[2] + tr[3]) / 3;
    vs.push({ name: tr.name, frets: [null, null, null, tr[3], tr[2], tr[1]] });
    const cell = [3, 2, 1, 1, 2, 3];
    const reps = Math.round(4 / (cell.length * step));
    for (let r = 0; r < reps; r++) for (const s of cell) { notes.push(N(s, tr[s], t, step)); t += step; }
    t = Math.ceil(t / 4 - 1e-6) * 4;
  }
  return make(c, {
    id: 'economy-rest-stroke', name: `The rest stroke: triads swept one note per string (${chords.join(' – ')})`, domain: 'picking', method: 'chunking',
    unit: unitName(step), goal: 92, minutes: 5, picking: 'economy', chords, voicings: vs, backing: chords,
    why: 'Economy picking rests on one motion: when the next note is on the next string in the same direction, the pick keeps going and comes to rest against that string, then plays it. Three strings, one note each, is that motion and nothing else.',
    instr: 'Down, down, down across the G, B and high e strings as one slow push, letting the pick stop against each string before it plays it; then up, up, up back to the G string. Each note sounds separately (fret one at a time and lift it). Pass: the four chords with every note separate and even, 3 times in a row.',
    watch: 'Strumming: if the notes ring together, you are moving too fast or holding them down.', simplify: 'One chord, ascending only.', tab: { notes }
  });
}
/** Three notes on the G string, three on the B, and back: the economy cell on one string pair, as triplets (accurate repetitions). */
export function pairCell(c) {
  const k = minorKey(c), list = position(k, 'minor', 1); if (!list) return null;
  const G = list.filter(([s]) => s === 3), B = list.filter(([s]) => s === 2);
  const cell = [...G, ...B, ...B.slice().reverse(), ...G.slice().reverse()];
  const step = (c.lvl || 2) <= 1 ? 0.5 : 1 / 3, reps = 4;
  const seq = []; for (let r = 0; r < reps; r++) seq.push(...cell);
  const notes = fromSeq(seq, step); notes.push(N(G[0][0], G[0][1], endOf(notes), 2));
  return make(c, {
    id: 'economy-pair-cell', name: `Three and three: the economy cell on the G and B strings (${nameOf(k)} natural minor)`, domain: 'picking', method: 'accurate-reps',
    unit: unitName(step), goal: 100, minutes: 4, picking: 'economy',
    why: 'Three notes on a string means the pick ends on the same stroke it started with, so it is already moving toward the next string. Getting that one change clean, both ways, is the heart of economy picking.',
    instr: 'Going up: down-up-down on the G string, then down-up-down on the B (the two downstrokes in a row are one push). Coming down: up-down-up on the B, then up-down-up on the G. Count only clean repetitions. Pass: 8 clean cells in a row at the goal tempo.',
    watch: 'Two separate strokes at the string change instead of one smooth push.', simplify: 'Ascending half only.', tab: { notes }
  });
}

/* --------------------------- Music: generators --------------------------- */
/**
 * Each chord gets a triad swept up the top strings, a turn on the high e, and a line back down that
 * lands on a chord tone (use in music). harm: i–iv–V–i with the harmonic minor.
 */
export function triadLines(c, { harm = false } = {}) {
  const k = minorKey(c), scale = harm ? 'harmonicMinor' : 'minor';
  const chords = harm ? [nameOf(k) + 'm', nameOf(k + 5) + 'm', nameOf(k + 7), nameOf(k) + 'm'] : [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  const notes = [], vs = []; let near = 7;
  const up = (s, f, n) => { const out = []; let x = f; while (out.length < n && x < 22) { x++; if (inScale(k, scale, pitch(s, x))) out.push(x); } return out; };
  const down = (s, f) => { for (let x = f - 1; x >= Math.max(0, f - 3); x--) if (inScale(k, scale, pitch(s, x))) return x; return null; };
  for (const [bar, nm] of chords.entries()) {
    const tr = topTriad(nm, near); if (!tr) return null; near = (tr[1] + tr[2] + tr[3]) / 3;
    vs.push({ name: tr.name, frets: [null, null, null, tr[3], tr[2], tr[1]] });
    const [a, b] = up(1, tr[1], 2), below = down(2, tr[2]); if (a == null || b == null || below == null) return null;
    const T = bar * 4, st = 1 / 3;
    [[3, tr[3]], [2, tr[2]], [1, tr[1]], [1, a], [1, b], [1, a], [1, tr[1]], [2, tr[2]], [2, below]].forEach(([s, f], i) => notes.push(N(s, f, T + i * st, st)));
    notes.push(N(3, tr[3], T + 3, 1, '~'));
  }
  return make(c, {
    id: harm ? 'economy-lines-harmonic' : 'economy-triad-lines', name: `Triads and lines: sweep the chord, turn, land on a chord tone (${chords.join(' – ')})`, domain: 'improv', method: 'transfer',
    unit: '8th-note triplets', goal: harm ? 100 : 96, minutes: 6, dl: harm ? 1 : 0, picking: 'economy', chords, voicings: vs, backing: chords,
    why: harm ? 'Over i–iv–V the harmonic minor gives the V chord its leading tone, the sound of neoclassical rock. The economy motion is the same; the line now outlines a different scale.'
      : 'Real economy-picked lines mix the chord and the scale: the triad swept up, a turn in the scale, and a line back down that lands on a chord tone. It is how the technique is used in rock and fusion solos.',
    instr: 'Beat 1: the triad, one push down across the G, B and high e. Beat 2: two scale notes up on the high e and back (alternate). Beat 3: back down through the chord, sweeping the string changes upward. Beat 4: land on the G-string chord tone with vibrato. Pass: the four bars clean over the backing, then four bars where you change the beat-2 turn yourself.',
    watch: 'Rushing beat 1 because sweeps feel fast: keep all three triplet notes even.', simplify: 'Beats 1 and 4 only: the triad and the landing note.', tab: { notes }
  });
}

/* ----------------------- Keys and random access ----------------------- */
/** The bar plan for keys/random lessons: [{ k, scale, pos }], one per bar. */
export function econPlan(c, random = false) {
  const k0 = minorKey(c);
  if (!random) return [0, 5, 10, 3].map(x => ({ k: mod12(k0 + x), scale: 'minor', pos: 1 }));
  const r = rng(131 + (c.lvl || 9)), scales = ['minor', 'dorian', 'harmonicMinor'], out = [];
  for (let bar = 0; bar < 8; bar++) out.push({ k: Math.floor(r() * 12), scale: scales[Math.floor(r() * 3)], pos: [1, 3, 5][Math.floor(r() * 3)] });
  return out;
}
/** A new key every bar (cycle of fourths), or a random key, scale and position every bar (interleaving). */
export function econKeys(c, { random = false } = {}) {
  const plan = econPlan(c, random), notes = [], names = []; let t = 0;
  for (const { k, scale, pos } of plan) {
    const list = position(k, scale, pos); if (!list) return null;
    const run = list.slice(0, 12);
    run.forEach(([s, f], i) => notes.push(N(s, f, t + i * 0.25, 0.25)));
    notes.push(N(run[11][0], run[11][1], t + 3, 1));
    names.push(random ? `${nameOf(k)} ${SCALE_NAME[scale]} (position ${pos})` : nameOf(k) + ' minor');
    t += 4;
  }
  return make(c, {
    id: random ? 'economy-random' : 'economy-keys', name: random ? 'Mixed bars: a new key, scale and position every bar' : `Economy picking through four keys: ${names.join(', ')}`, domain: 'picking', method: 'interleaving',
    unit: '16th notes', goal: random ? 104 : 100, minutes: 5, dl: 1, picking: 'economy',
    why: random ? 'At mastery level the picking hand runs on autopilot while the fretting hand finds any scale anywhere. Unpredictable changes are the hardest, and most transferable, way to practice that.'
      : 'Changing key every bar forces you to find the position each time while the economy motion carries on: the two hands learn to work independently.',
    instr: `${names.join(' → ')}. Each bar: four strings of the position ascending (12 notes, sweeping each string change), then hold the top note while you find the next one. Look one bar ahead. Pass: all ${plan.length} bars without stopping${random ? ' at the goal tempo' : ', twice'}.`,
    watch: 'Stopping to think: lower the tempo rather than breaking the bar.', simplify: random ? 'The first four bars only.' : 'Two keys only, back and forth.', tab: { notes }
  });
}

/* --------------------------- Existing lessons (kept ids) --------------------------- */
/** Economy picking through a three-notes-per-string scale: sweep the string changes. */
export function economyScale(c, { fast = null } = {}) {
  const key = minorKey(c), rf = rootFret6(key) || 12;
  const pts = scaleNps(key, 'minor', rf, 3) || scaleNps(key, 'minor', rf - 12 >= 0 ? rf - 12 : rf, 3);
  if (!pts || Math.max(...pts.map(p => p.f)) > 22) return null;
  fast = fast == null ? (c.lvl || 4) >= 6 : fast; const step = fast ? 1 / 6 : 1 / 3;
  const up = pts.map(p => [p.s, p.f]), seq = [...up, ...up.slice().reverse()];
  const k = nameOf(key);
  return make(c, {
    id: `economy-3nps-${fast ? '6' : '3'}`, name: `Economy picking: ${k} natural minor, three notes per string${fast ? ' (two strings per beat)' : ''}`, domain: 'picking', method: fast ? 'edge' : 'accurate-reps',
    unit: fast ? '16th-note sextuplets' : '8th-note triplets', goal: fast ? 84 : 120, start: fast ? 44 : 60, minutes: 5, dl: fast ? 1 : 0, picking: 'economy',
    why: 'Economy picking alternates on a string but sweeps through the string change when the next string lies in the same direction. With three notes per string, every new string ascending starts with a downstroke and every new string descending with an upstroke, so the pick never jumps back over a string.',
    instr: `Ascending: down-up-down on each string, then keep the downstroke falling onto the next string (down-up-down, down…). Descending: up-down-up on each string, then let the upstroke carry onto the next string down. ${fast ? 'Two strings per beat.' : 'One string per beat: the first note of each string lands on the click.'} Say the pick directions out loud at the start tempo. Pass: up and down twice with the sweep feeling like one motion, not two separate strokes.`,
    watch: 'Turning the string change into a rushed flick: the two strokes in the same direction must be as evenly spaced as the rest.', simplify: 'Two strings only (the G and B), looped.', tab: { notes: fromSeq(seq, step) }
  });
}
/** The two-string economy cell: six up, six down, on every string pair. */
export function economyCell(c) {
  const key = minorKey(c), rf = rootFret6(key) || 12;
  const pts = scaleNps(key, 'minor', rf, 3); if (!pts) return null;
  const B = {}; pts.forEach(p => (B[p.s] = B[p.s] || []).push(p.f)); Object.values(B).forEach(a => a.sort((x, y) => x - y));
  const seq = [];
  for (const hi of [5, 4, 3, 2, 1]) {
    const lo = hi + 1; if (!B[lo] || !B[hi] || B[lo].length < 3 || B[hi].length < 3) return null;
    const upCell = [...B[lo].map(f => [lo, f]), ...B[hi].map(f => [hi, f])];
    const cell = [...upCell, ...upCell.slice().reverse()];
    seq.push(...cell, ...cell);
  }
  const k = nameOf(key);
  return make(c, {
    id: 'economy-cell', name: `Economy picking cell on every string pair (${k} natural minor)`, domain: 'picking', method: 'chunking', unit: '16th-note sextuplets', goal: 92, start: 46, minutes: 6, dl: 1, picking: 'economy',
    why: 'Six notes up across two strings and six back down puts a sweep in both directions inside one beat pair. It isolates the exact motion economy picking depends on, on every string pair.',
    instr: 'Going up: down-up-down on the lower string, down-up-down on the upper (the two downstrokes in a row are the sweep). Coming down: up-down-up on the upper string, up-down-up on the lower. Each six-note group is one beat; play the cell twice, then move up a string pair. Pass: all five string pairs clean at the goal tempo.',
    watch: 'Letting the swept notes ring together: lift each finger as soon as the next string sounds.', simplify: 'One string pair (G and B) in 8th-note triplets.', tab: { notes: fromSeq(seq, 1 / 6) }
  });
}

/** The seven positions of the scale, one per bar, each run up four strings (interleaving). */
export function econPositions(c) {
  const k = minorKey(c), notes = [], names = []; let t = 0;
  for (const pos of [1, 3, 5, 7, 2, 4, 6]) {
    const list = position(k, 'minor', pos); if (!list) return null;
    const run = list.slice(0, 12); run.forEach(([s, f], i) => notes.push(N(s, f, t + i * 0.25, 0.25)));
    notes.push(N(run[11][0], run[11][1], t + 3, 1)); names.push(String(pos)); t += 4;
  }
  return make(c, {
    id: 'economy-positions', name: `All seven positions out of order: ${nameOf(k)} natural minor`, domain: 'picking', method: 'interleaving',
    unit: '16th notes', goal: 100, minutes: 5, dl: 1, picking: 'economy',
    why: 'Each position starts on a different degree and has its stretches on different strings; mixing them out of order makes the hand rebuild the shape every bar while the economy motion stays constant.',
    instr: `Positions ${names.join(', ')}: four strings ascending in each (twelve notes, every string change swept), then hold the top note while you find the next position. Pass: all seven bars without stopping, twice.`,
    watch: 'Positions 6 and 7 sitting high on the neck in some keys: look ahead.', simplify: 'Positions 1, 3 and 5.', tab: { notes }
  });
}

/* --------------------------- Mastery: capstone --------------------------- */
/** An original 8-bar study: triad sweeps and turns, a sequenced run, a fast descent, the landing (capstone). */
export function econEtude(c) {
  const k = minorKey(c), list = position(k, 'minor', 1); if (!list) return null;
  const head = triadLines({ ...c, minor: true, key: k }); if (!head) return null;
  const notes = head.tab.notes.slice(); let t = 16;
  // bars 5–6: groups of four up the position in 16ths
  SEQUENCES.fours(list).slice(0, 32).forEach(([s, f]) => { notes.push(N(s, f, t, 0.25)); t += 0.25; });
  t = 24;
  // bar 7: the whole position down in sextuplets (18 notes = 3 beats), then a beat on the low root
  list.slice().reverse().forEach(([s, f]) => { notes.push(N(s, f, t, 1 / 6)); t += 1 / 6; });
  const root = list.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || list[0];
  notes.push(N(root[0], root[1], 27, 1));
  // bar 8: land on the root an octave up, held
  const hiRoot = list.filter(([s, f]) => mod12(pitch(s, f) - k) === 0).pop() || root;
  notes.push(N(hiRoot[0], hiRoot[1], 28, 4, '~'));
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: 'economy-capstone-etude', name: `Capstone study: an 8-bar economy-picking piece (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'mixed rhythms', goal: 92, minutes: 8, dl: 1, picking: 'economy', backing: [...chords, ...chords], chords, voicings: head.voicings,
    why: 'An original piece that uses the whole path in one musical arc: chord sweeps with turns, a sequenced run in 16ths, a sextuplet descent through the whole position and a held landing. Mastery is switching between them without the picking hand changing gear audibly.',
    instr: 'Learn it two bars at a time (chunking), then join the halves. Keep the economy rule everywhere: same stroke through a string change in the direction of travel. Play it over the backing with a dynamic arc (quiet triads, louder run, full descent). Then write your own 8 bars to the same plan. Pass: the study at the goal tempo with no stops, then your own version played through once.',
    watch: 'Rushing the sextuplet descent and arriving early on the low root.', simplify: 'Bars 1–4 only.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const E = (id, name, method, opts) => c => econ(c, { id, name, method, ...opts });
const PATH = entry({
  id: 'economyPicking', kind: 'technique', title: 'Economy picking', domain: 'picking',
  re: /economy.?pick/,
  aliases: ['economy picking', 'directional picking'],
  sources: ['https://guitarworld.com/lessons/how-to-use-economy-picking', 'https://guitargearfinder.com/lessons/economy-picking-exercises/', 'https://hubguitar.com/technique/economy-picking-overview', 'https://www.guitarmasterclass.net/ls/Economy-Picking-101', 'https://www.premierguitar.com/lessons/guthrie-govans-erotic-cakes'],
  pedagogy: {
    date: '2026-10-18',
    summary: 'Taught as alternate picking on a string plus one continuous stroke through a string change in the direction of travel: first the motion across strings (open strings, then a triad swept with rest strokes), then two strings, then three, then odd note counts (one or three on a string); then the three-notes-per-string scale up (down-up-down, sweep) and down (up-down-up, sweep), changing direction, scale runs and sequences in other positions and scales (Dorian, harmonic and melodic minor), descending lines for stamina, and finally speed and musical lines.',
    sequence: [
      { id: 'rest', tier: 'foundations', step: 'The rest stroke across strings: a triad swept, then the two-string cell', how: 'Pick in the direction the hand travels across the strings (down to a higher string, up to a lower one); a triad with an ascending rest stroke; then a scale fragment on two strings.', skills: ['economy-rest'], source: 0 },
      { id: 'odd', tier: 'foundations', step: 'Odd note counts per string', how: 'Patterns starting with one or three notes on a string, so every change is swept.', skills: ['economy-odd'], source: 0 },
      { id: 'three', tier: 'foundations', step: 'Three strings up and down, even and muted', how: 'The same motion across three strings in each direction, looped; open strings first, notes even at the change, strings muted.', skills: ['economy-sound'], source: 1 },
      { id: 'arp', tier: 'foundations', step: 'Simple arpeggios and lines', how: 'Triads swept between strings with a scale turn, over a backing.', skills: ['economy-first-music'], source: 1 },
      { id: 'nps', tier: 'intermediate', step: 'Three notes per string ascending and descending', how: 'Down-up-down and sweep going up; up-down-up and sweep coming down; aim for the same top tempo in both directions.', skills: ['economy-scale'], source: 2 },
      { id: 'dir', tier: 'intermediate', step: 'Changing direction, positions and keys', how: 'Patterns that turn around inside the scale; the scale form in other positions and keys.', skills: ['economy-positions', 'economy-more'], source: 1 },
      { id: 'runs', tier: 'intermediate', step: 'Scale runs in music', how: 'Your own scale runs, landing on chord tones over a progression.', skills: ['economy-music'], source: 1 },
      { id: 'lines', tier: 'advanced', step: 'Straight 16th-note lines and stamina', how: 'Triads and scale fragments turned into steady 16ths; shorter note values for stamina.', skills: ['economy-speed'], source: 0 },
      { id: 'modes', tier: 'advanced', step: 'Other three-notes-per-string scales', how: 'Dorian fragments, then harmonic or melodic minor with the same picking.', skills: ['economy-scales', 'economy-mix'], source: 2 },
      { id: 'neo', tier: 'advanced', step: 'Lines over chord changes', how: 'Descending triads through a progression, harmonic-minor lines over i–iv–V.', skills: ['economy-adv-music'], source: 0 },
      { id: 'tempo', tier: 'mastery', step: 'Performance tempo in any scale', how: 'The picking form applied to any three-notes-per-string scale at speed; a daily workout combining the examples.', skills: ['economy-performance', 'economy-random'], source: 0 },
      { id: 'own', tier: 'mastery', step: 'Your own economy-picked music', how: 'A study, then your own runs, choosing economy or alternate picking for each.', skills: ['economy-voice'], source: 1 }
    ],
    drills: ['Open strings across the strings, picking in the direction of travel', 'A triad swept with rest strokes', 'Two-string and three-string fragments up and down', 'Odd note counts: one or three notes on a string', 'Three notes per string: down-up-down ascending, up-down-up descending', 'Patterns that change direction inside the scale', 'Dorian and harmonic-minor three-notes-per-string shapes', 'Straight 16th-note lines from triads'],
    mistakes: ['Falling back on alternate picking at the string change', 'Two separate strokes in a row instead of one controlled sweep', 'The pick escaping the strings instead of resting on the next one', 'Rushed or clumped notes either side of the sweep', 'Descending lines weaker than ascending ones', 'Not flipping the first strokes when the pattern repeats from the other direction'],
    sources: [
      { title: 'How to use economy picking: a beginner’s guide to an expert technique', author: 'Chris Brooks (Guitar World)', url: 'https://guitarworld.com/lessons/how-to-use-economy-picking' },
      { title: '8 Best Economy Picking Exercises (Easy to Hard)', author: 'Aaron Matthies (Guitar Gear Finder)', url: 'https://guitargearfinder.com/lessons/economy-picking-exercises/' },
      { title: 'Economy Picking Exercises', author: 'Hub Guitar', url: 'https://hubguitar.com/technique/economy-picking-overview' },
      { title: 'Economy Picking 101', author: 'GuitarMasterClass', url: 'https://www.guitarmasterclass.net/ls/Economy-Picking-101' }
    ]
  },
  summary: 'Alternate picking on a string, one continuous stroke through the string change in the direction of travel: from the rest stroke to three-notes-per-string runs in any key, scale and position.',
  prereqs: ['pentatonic'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The rest stroke and odd numbers',
      'Sweep a triad down and up the top three strings with every note separate at 90 BPM, play the three-and-three cell on the G and B strings 8 times clean as triplets, say the pick strokes of a 3-1-3 line before playing it, and keep the sweep inaudible on the top strings and the bass strings.', [
        S('economy-rest', 'The rest stroke', 'picking', 'The pick keeps going onto the next string.', [c => restStroke(c), c => pairCell(c)]),
        S('economy-odd', 'Odd numbers of notes', 'picking', 'Why three (or one) notes per string make every change a sweep.', [
          E('economy-odd-31', '3-1-3-1 through {key} {scale}', 'chunking', { counts: [3, 1, 3, 1, 3, 1], seq: 'updown', step: 0.5, goal: 96, why: 'Economy picking is a rule, not a feel: odd numbers of notes on a string end on the stroke that sweeps into the next string. Three-and-one patterns put a sweep at every string change, so the rule is practised on every beat.', instr: 'Three notes on one string, one on the next, alternating, up through the position and back. Strokes start: {strokes} … After an odd count, keep going in the same direction onto the next string. Pass: the whole line up and down with those strokes, twice.', watch: 'Defaulting to strict alternation on the single notes.', simplify: 'The first three strings only.' }),
          E('economy-odd-13', '1-3-1-3 through {key} {scale}', 'accurate-reps', { counts: [1, 3, 1, 3, 1, 3], seq: 'updown', step: 1 / 3, goal: 100, why: 'Starting each pair with a single note puts the sweep at the start of the beat instead of the end: the same rule, felt from the other side.', instr: 'One note, then three on the next string, up through the position and back. Strokes start: {strokes}. Count clean repetitions. Pass: 4 clean in a row.', watch: 'The single notes being shorter than the rest.', simplify: 'Ascending only.' })]),
        S('economy-sound', 'Hear the sweep', 'picking', 'The swept pair as even as the rest; the cell on the bass strings.', [
          E('economy-even-top', 'Even through the sweep: {key} {scale} on the top three strings', 'external-focus', { counts: [0, 0, 0, 3, 3, 3], seq: 'updown', step: 1 / 3, goal: 96, why: 'The giveaway of a clumsy sweep is in the sound: the two notes on either side of the string change come out rushed or clumped. Listening for perfectly even triplets fixes the motion faster than watching the pick.', instr: 'Up and down the top three strings of the position as triplets. Close your eyes: every note the same length and volume, with no gap or rush at the string changes. Record one pass and listen. Pass: a recorded pass where you can’t hear where the strings change.', watch: 'Accenting the first note after each sweep.', simplify: 'Only the G and B strings.' }),
          E('economy-low-strings', 'Three and three on the bass strings: {key} {scale}', 'variable', { counts: [3, 3, 3, 0, 0, 0], seq: 'updown', step: 1 / 3, goal: 96, why: 'The thick strings need a firmer sweep and more muting, and the pick travels further between them. Practising the same motion on a new string set makes it general.', instr: 'Up and down the bottom three strings of the position as triplets, sweeping each string change. Rest the side of the picking hand on the strings you have left. Pass: 4 clean in a row.', watch: 'Strings ringing on after you leave them.', simplify: '8th notes.' })]),
        S('economy-first-music', 'First music', 'improv', 'Sweeps and lines over a minor groove.', [c => triadLines(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minor' }])])
      ], [1, 3]),
    stage('intermediate', 'Three notes per string, every position',
      'Play the full three-notes-per-string position up and down at 110 BPM in triplets with every string change swept, run groups of 3 through it, play positions 1 to 5 (position 4 from memory), groups of 4 against triplets, and change key every bar without stopping.', [
        S('economy-scale', 'The full position', 'picking', 'Down-up-down, then sweep onto the next string.', [c => economyScale(c, { fast: false }), c => economyCell(c)]),
        S('economy-positions', 'Positions and sequences', 'picking', 'The same rule anywhere on the neck and in any order.', [
          E('economy-pos3', '{key} {scale}, position 3 (starting on the ♭3)', 'variable', { pos: 3, seq: 'updown', goal: 110, why: 'Every scale has seven three-notes-per-string positions, one starting on each degree. Economy picking works the same in all of them; only the stretches change.', instr: 'Up and down the position as triplets, one string per beat, sweeping each change. Pass: 4 clean in a row.', watch: 'The wider stretches pulling the hand out of position: pivot on the thumb.', simplify: 'The bottom four strings.' }),
          E('economy-threes', '{key} {scale} in groups of 3', 'variable', { pos: 1, seq: 'threes', goal: 110, why: 'Groups of three move the string changes to different places in the group, so the picking hand has to apply the rule on the fly instead of by habit.', instr: 'Three notes up from each note of the position, then back down in threes. Follow the rule wherever the string changes. Pass: 4 clean in a row at the goal tempo.', watch: 'Falling back to strict alternation when a change comes mid-group.', simplify: 'The ascending half only.' }),
          c => econKeys(c)]),
        S('economy-more', 'More positions', 'picking', 'Positions 2 and 4; fours against triplets.', [
          E('economy-pos2', '{key} {scale}, position 2 (starting on the 2)', 'variable', { pos: 2, seq: 'updown', goal: 110, why: 'Position 2 joins positions 1 and 3: once it is known, three positions connect into a third of the neck.', instr: 'Up and down as triplets, one string per beat, sweeping each change. Pass: 4 clean in a row.', watch: 'Fingering it like position 1 on the B string.', simplify: 'The bottom four strings.' }),
          E('economy-pos4-recall', '{key} {scale}, position 4 (starting on the 4th)', 'variable', { pos: 4, seq: 'updown', goal: 106, why: 'Position 4 starts on the 4th of the key on the low E string and has its stretches on different strings from positions 1–3. The same picking rule carries through a new shape.', instr: 'Up and down as triplets, one string per beat, sweeping each string change. Strokes start: {strokes} … Pass: twice clean with every change swept.', watch: 'Drifting into position 3 or 5.', simplify: 'The top three strings.' }),
          E('economy-fours-trip', '{key} {scale} in groups of 4 as triplets', 'variable', { pos: 1, seq: 'fours', step: 1 / 3, goal: 104, why: 'Four-note groups over a triplet pulse cross the beat: each group starts on a different part of it, and the string changes move with it. The picking rule has to work wherever they fall.', instr: 'Four up from each note, then four down, in steady triplets. Accent the beat, not the group. Pass: 4 clean at the goal tempo.', watch: 'Slipping into 16ths to make the groups line up.', simplify: 'Ascending only.' })]),
        S('economy-music', 'Over the changes', 'improv', 'Lines that follow a minor progression.', [M('transfer', ['targetSolo', { chords: '$minorRock', scale: 'minor' }]), E('economy-pos5-phrase', '{key} {scale}, position 5, landing on the root', 'transfer', { pos: 5, seq: 'thirds', goal: 100, why: 'Thirds give the position a melodic shape, and landing on the root ends it like a phrase rather than an exercise.', instr: 'Play the position in 3rds (every other note) up and back, then land on the root with vibrato. Then play it over the backing as the end of your own phrase. Pass: twice clean, then 4 bars of your own ending on the root.', watch: 'Hitting the skipped note between each pair.', simplify: 'Ascending only.' })])
      ], [4, 6]),
    stage('advanced', 'Speed, sequences and other scales',
      'Play the position as sextuplets at 100 BPM and in groups of 4 in 16ths at 110, play the Dorian and harmonic minor positions with the same motion (Dorian in threes from memory), run all seven positions out of order, and solo with economy lines over i–iv–V.', [
        S('economy-speed', 'Speed', 'picking', 'Two strings per beat and sequences in 16ths.', [c => economyScale(c, { fast: true }),
          E('economy-fours', '{key} {scale} in groups of 4', 'variable', { pos: 1, seq: 'fours', step: 0.25, goal: 104, why: 'Groups of four line up with 16ths, the backbone of rock runs, and put the string changes in shifting places.', instr: 'Four up from each note, then four down from each note. Apply the rule at every string change. Pass: 4 clean at the goal tempo.', watch: 'Rushing the swept pair inside the group.', simplify: '8th notes.' })]),
        S('economy-scales', 'Other scales', 'picking', 'Dorian and harmonic minor under the same hand.', [
          E('economy-dorian', '{key} {scale}, three notes per string', 'variable', { scale: 'dorian', pos: 1, seq: 'updown', step: 0.25, goal: 104, why: 'Dorian has the major 6th: the brighter minor of funk, fusion and Santana. The picking stays the same; the fingering changes on two strings.', instr: 'Up and down in 16ths. Listen for the major 6th, the one note that differs from natural minor. Pass: 4 clean at the goal tempo.', watch: 'Slipping back into natural minor on the 6th.', simplify: 'Triplets.' }),
          E('economy-harmonic', '{key} {scale}, three notes per string', 'variable', { scale: 'harmonicMinor', pos: 5, seq: 'updown', step: 0.25, goal: 100, why: 'The harmonic minor’s gap between the ♭6 and the 7 is the sound of neoclassical rock, and its three-note-per-string shapes need a wide stretch on some strings.', instr: 'Position 5 (starting on the 5th), up and down in 16ths. Hear the step-and-a-half gap each time it comes. Pass: 4 clean at the goal tempo.', watch: 'Tension in the wide stretch: keep the thumb low.', simplify: 'Triplets.' })]),
        S('economy-mix', 'Positions mixed; sequences in Dorian', 'picking', 'Seven positions out of order; Dorian in groups of 3.', [c => econPositions(c),
          E('economy-dorian-recall', '{key} {scale}, position 4, in groups of 3', 'variable', { scale: 'dorian', pos: 4, seq: 'threes', step: 0.25, goal: 100, why: 'A sequence in a less familiar scale and position: groups of three as 16ths drift across the beat, and the string changes fall in a new place in every group.', instr: 'Groups of three up and down the position as 16ths (the accent drifts across the beat). Apply the rule wherever the string changes. Pass: up and down at the goal tempo.', watch: 'The natural-minor ♭6 creeping in.', simplify: 'Triplets, ascending only.' })]),
        S('economy-adv-music', 'Neoclassical lines', 'improv', 'Harmonic-minor lines over i–iv–V.', [c => triadLines(c, { harm: true }), M('transfer', ['targetSolo', { chords: '$iiVIminor', scale: 'harmonicMinor' }])])
      ], [7, 8]),
    stage('mastery', 'Instant, fast and your own',
      'Run the position in groups of 6 as sextuplets at about 110 BPM, play a random key, scale and position every bar from memory, solo over minor progressions with economy lines, and perform your own 8-bar economy-picking piece.', [
        S('economy-performance', 'Performance tempo', 'picking', 'Long sextuplet lines.', [
          E('economy-sixes', '{key} {scale} in groups of 6, sextuplets', 'edge', { pos: 1, seq: 'sixes', step: 1 / 6, goal: 88, why: 'Six-note groups as sextuplets: one group per beat, long lines that still divide clearly into beats. The economy rule makes them possible at speed.', instr: 'One group per beat, accent the first note. Use the tempo ladder: start below the goal and add a few BPM after every clean pass. Pass: 4 clean at the goal tempo.', watch: 'Forearm tension as the tempo climbs: stop and shake it out.', simplify: '16th notes.' }),
          E('economy-pos3-fives', '{key} {scale}, position 3 in groups of 5', 'edge', { pos: 3, seq: 'fives', step: 0.25, goal: 92, why: 'Groups of five against 16ths shift the accent every beat: the hardest grouping to keep even, and a fusion staple.', instr: 'Five up from each note, then five down, as 16ths: the group restarts in a different place each beat. Pass: 4 clean at the goal tempo.', watch: 'Turning it into groups of four.', simplify: 'Count it as quintuplets, one group per beat.' })]),
        S('economy-random', 'Any key, any scale', 'picking', 'A new key every bar.', [c => econKeys(c, { random: true }), M('transfer', ['targetSolo', { chords: '$dorianVamp', scale: 'dorian' }])]),
        S('economy-voice', 'Your own voice', 'improv', 'A study that uses everything, then your version.', [c => econEtude(c), M('transfer', ['targetSolo', { chords: '$progMinor', scale: 'minor' }])])
      ], [9, 10])
  ]
});
const ST = (concept, why, theory) => ({ concept, why, theory });
const STUDY = {
  'economy-rest': ST('Economy picking alternates on a string and sweeps through a string change when the next string lies in the direction the pick is already moving. The sweep is a rest stroke: the pick plays a string and comes to rest on the next one, then plays it.', 'One push replaces two separate strokes, so string changes cost less motion; it is the base of economy and sweep picking.', ['Going up (toward the floor): downstrokes sweep. Going down: upstrokes sweep.', 'Each note still sounds on its own: fret one at a time.']),
  'economy-odd': ST('Odd numbers of notes on a string end on the stroke that carries into the next string, so 3-1 and 1-3 patterns put a sweep at every change.', 'Odd counts are where economy picking differs from strict alternate picking.', ['Three notes: down-up-down, then down again on the next string.', 'After an even count, alternate as usual.']),
  'economy-sound': ST('A good sweep is inaudible: the notes either side of a string change are as even as the rest.', 'Uneven or clumped notes at the changes are the usual sign of a rushed sweep.', ['Mute the strings you leave with the picking-hand palm.', 'Bass strings need a firmer push.']),
  'economy-first-music': ST('Triads swept across the top strings and short scale turns make the first economy lines.', 'Sweeping the chord and turning on a scale note is how the technique appears in solos.', ['Land on a chord tone.', 'Pick only as hard as the line needs.']),
  'economy-scale': ST('Three notes per string makes the picking repeat: down-up-down on every string going up, up-down-up going down.', 'This is the core economy-picking scale form: every string change becomes a sweep.', ['Each string starts on the same stroke in one direction.', 'Two strings make a six-note cell, one beat of sextuplets.']),
  'economy-positions': ST('A scale has seven three-notes-per-string positions, each starting on a different degree on the low E string. Sequences (groups of 3) move the string changes inside the group.', 'The rule has to work in any shape and in any order of notes.', ['Position 3 starts on the ♭3 in minor.', 'In a sequence, apply the rule wherever the string changes.']),
  'economy-more': ST('Positions 2 and 4 join the others into connected shapes; four-note groups over triplets cross the beat.', 'More positions mean more of the neck, with the same picking.', ['Position 2 starts on the 2nd, position 4 on the 4th.', 'Accent the beat, not the group.']),
  'economy-music': ST('Lines in a position that land on chord tones of a progression.', 'Economy lines become music when they target the chords.', ['End on the root or a chord tone with vibrato.', '3rds give a scale shape a melodic contour.']),
  'economy-speed': ST('Two strings per beat (sextuplets) and groups of four in 16ths.', 'Speed is where the saved motion of the sweep pays off.', ['Raise the tempo a few BPM after each clean pass.', 'Keep the sweep a single push at speed.']),
  'economy-scales': ST('Dorian (natural minor with a major 6th) and harmonic minor (with a major 7th) in three-notes-per-string shapes.', 'The picking stays the same while the colour changes.', ['Dorian: R 2 ♭3 4 5 6 ♭7.', 'Harmonic minor: R 2 ♭3 4 5 ♭6 7; the ♭6–7 gap is a step and a half.']),
  'economy-mix': ST('Positions out of order and sequences in a second scale.', 'Mixing shapes makes the fretting hand rebuild each one while the picking rule stays constant.', ['Look ahead to the next position.', 'Groups of 3 in 16ths shift the accent every beat.']),
  'economy-adv-music': ST('Harmonic-minor lines over a minor progression with a major V chord.', 'The neoclassical sound: the major 7th of harmonic minor is the 3rd of the V chord.', ['Target the 7th over V, resolving up to the root.', 'Sweep the triads, alternate the turns.']),
  'economy-performance': ST('Sextuplets and fives at performance tempo.', 'Long lines that still divide clearly into beats.', ['Accent the first note of each group.', 'Stop and shake out tension.']),
  'economy-random': ST('A new key, scale and position every bar.', 'At this level the picking runs on its own while the fretting hand finds the shapes.', ['Look one bar ahead.', 'Lower the tempo rather than stopping.']),
  'economy-voice': ST('The capstone study combines triads, runs and sequences; then you write your own.', 'A technique becomes yours when you compose with it.', ['Learn it two bars at a time.', 'Keep the rule everywhere.'])
};
for (const st of PATH.stages) for (const sk of st.skills) if (STUDY[sk.id]) sk.study = STUDY[sk.id];
export default PATH;
