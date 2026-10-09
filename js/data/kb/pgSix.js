// The six-note picking lick: a two-string pentatonic cell, strict alternate picked, that drills the
// inside string change. Paul Gilbert's best-known speed exercise, from the slow cell to performance
// tempo through all five boxes, in every key and in licks.
//
// Concept-first (CONTENT.md): the model is the cell itself as positions in a pentatonic box: on a
// pair of strings with two box notes each (L0 < L1 on the lower string, H0 < H1 on the upper), the
// ascending cell is L0 L1 H0 H1 H0 L1 (every string change inside) and its mirror H1 H0 L1 L0 L1 H0
// (every change outside). The composer `six(c, spec)` builds an exercise from cell direction ×
// string pairs (adjacent or skipping a string) × boxes × keys × note value × repetitions.
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
 * boxes, keys (offsets from the key, one per block), step, reps (cells per pair), goal, dl, why,
 * instr ('{changes}'), watch, simplify }.
 */
export function six(c, spec) {
  const k0 = minorKey(c), seq = [];
  const keys = spec.keys || [0];
  for (const off of keys) for (const box of spec.boxes || [1]) for (const [lo, hi] of spec.pairs || [[2, 1]]) {
    const cl = cell(mod12(k0 + off), box, lo, hi, spec.dir || 'up'); if (!cl) return null;
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
    id: 'pgsix-parts', name: `The six-note lick in two halves (${nameOf(k)} minor pentatonic, top strings)`, domain: 'picking', method: 'chunking',
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
    why: 'The heart of the six-note lick is one motion: an upstroke on the B string followed by a downstroke on the high e, with the pick hopping between the two strings. Isolating it on two notes is the fastest way to make it reliable.',
    instr: 'Upstroke on the B-string note, downstroke on the high-e note, over and over. The pick travels between the two strings each time: keep the hop as small as possible and listen for both notes being equally loud. Pass: 8 bars without catching a wrong string.',
    watch: 'A big, loopy motion: the hop only has to clear one string.', simplify: 'Start with a downstroke on the B string instead (an outside change), then switch back.', tab: { notes }
  });
}
/** The app plays the cell on a string pair, then a silent bar: name the pair and direction, then play it (hear it first). */
export function sixEcho(c) {
  const k = minorKey(c), r = rng(41 + (c.lvl || 2)), notes = [], plan = [];
  let t = 0;
  for (let i = 0; i < 4; i++) {
    const pair = ALL_PAIRS[1 + Math.floor(r() * 4)], dir = r() < 0.5 ? 'up' : 'down', cl = cell(k, 1, pair[0], pair[1], dir); if (!cl) return null;
    plan.push(`${pair[0]}–${pair[1]} ${dir}`);
    cl.forEach(([s, f], j) => notes.push(N(s, f, t + j / 3, 1 / 3))); notes.push(N(cl[5][0], cl[5][1], t + 2, 2));
    t += 8;
  }
  return make(c, {
    id: 'pgsix-echo', name: `Hear the lick: which strings, which way? (${nameOf(k)} minor pentatonic)`, domain: 'ear', method: 'audiation',
    unit: '8th-note triplets', goal: 84, minutes: 4, picking: 'strict',
    why: 'Recognising the lick by ear (how high it sits, whether it climbs or falls) links the sound to the shape. Players who can hear a lick can drop it into a solo at the right moment.',
    instr: 'Cover the tab. Each bar plays the lick on one string pair, going up (the normal cell) or down (its mirror); the next bar is silent. In the silent bar, say which pair and which way, then play it. Check against the tab afterwards. Pass: 3 of 4 named and played correctly, twice.',
    watch: 'Guessing from the tab: keep it covered.', simplify: 'Only the up direction.', tab: { notes }
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
    id: fast ? 'pgsix-lick-fast' : 'pgsix-lick', name: `The six-note lick in a phrase${fast ? ', at speed' : ''} (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
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
    id: 'pgsix-random', name: 'Random access: the six-note lick in a new key, box and string pair every bar', domain: 'picking', method: 'interleaving',
    unit: '16th-note sextuplets', goal: 92, minutes: 5, dl: 1, picking: 'strict',
    why: 'At mastery level the lick should be available anywhere instantly. Unpredictable changes of key, box and strings train exactly that.',
    instr: `${names.join(' → ')}. Three cells per bar, then a beat to find the next one. Read only the names, not the notes. Pass: all 8 bars from memory at the goal tempo.`,
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
    id: 'pgsix-capstone-etude', name: `Capstone study: an 8-bar piece on the six-note lick (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
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
    id: across ? 'pg-six-across' : 'pg-six-note', name: across ? `Six-note picking lick through all five boxes (${k} minor)` : `Six-note pentatonic picking lick on string pairs (${k} minor)`,
    domain: 'picking', method: across ? 'interleaving' : 'variable', unit: '16th-note sextuplets', goal: 92, minutes: 5, dl: across ? 2 : 1, picking: 'strict',
    why: 'Paul Gilbert’s best-known speed drill is a six-note pentatonic cell on two strings, alternate picked: it trains the string change from the inside of the strings, where most picking breaks down.',
    instr: across ? 'The cell on strings 1–2, twice per box, moving through boxes 1 to 5 and back. Shift on the first note of each beat. Pass: the whole journey clean at the goal tempo.' : 'The cell (two notes on the lower string, three on the upper, back to the lower) four times per bar, then down one string pair. Strict alternate picking starting with a downstroke; the pick has to jump between the strings on the string change. Pass: all four pairs clean at the goal tempo.',
    watch: 'Using hammer-ons to hide a missed pick stroke.', simplify: 'The cell in 16th notes (four per beat) at a slow tempo.', tab: { notes: fromSeq(seq, 1 / 6) }
  });
}

/* --------------------------------- The path --------------------------------- */
const W6 = 'Strict alternate picking, starting with a downstroke. The ascending cell has {changes} string changes; ';
export default entry({
  id: 'pgSix', kind: 'technique', title: 'The six-note picking lick', domain: 'picking',
  re: /paul gilbert lick|gilbert lick|(six|6).?note (picking )?(lick|pattern|cell)/,
  aliases: ['Paul Gilbert lick', 'six-note pentatonic lick'],
  summary: 'Paul Gilbert’s two-string pentatonic cell, alternate picked: from the slow cell and the inside string change to performance tempo through all five boxes, every key and real licks.',
  prereqs: ['alternatePicking', 'pentatonic'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The cell, slowly',
      'Play the six-note cell on the top strings 4 times in a row in triplets at 80 BPM, loop the inside string change for 8 bars without a wrong string, name the string pair and direction of the lick by ear, and play it into a bend over a minor groove.', [
        S('pgsix-cell', 'The cell', 'picking', 'Two halves, then whole; then slow and even.', [c => sixParts(c),
          X('pgsix-slow', 'The six-note lick, slow and even, on the top strings ({key})', 'accurate-reps', { pairs: [[2, 1]], reps: 8, step: 1 / 3, goal: 92, why: 'Clean repetitions at a slow tempo build the motion you will keep at speed. Two triplets per cell put a downstroke on every beat.', instr: W6 + 'two beats per cell as triplets. Count only the clean cells. Pass: 8 clean cells in a row.', watch: 'Uneven triplets at the string change.', simplify: '8th notes.' })]),
        S('pgsix-inside', 'The inside change', 'picking', 'The motion the lick exists to train, and hearing it.', [c => insideHop(c), c => sixEcho(c)]),
        S('pgsix-first-music', 'First music', 'improv', 'The lick into a bend.', [c => sixLick(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'Every string pair, both directions',
      'Play the cell on every string pair of box 1 in 16ths at 100 BPM, play its mirror (all outside changes) as triplets at 110, play it in boxes 2 and 3, and use it in a phrase over a minor progression.', [
        S('pgsix-pairs', 'Every pair, both ways', 'picking', 'Up (inside changes) and its mirror (outside changes).', [
          X('pgsix-16ths', 'The six-note lick in 16ths on every string pair ({key})', 'variable', { pairs: ALL_PAIRS, reps: 2, step: 0.25, goal: 100, why: 'Played in 16ths the six-note cell crosses the beat: the accent falls on a different note each time, which makes it sound fast and unpredictable at a moderate tempo.', instr: W6 + 'four notes per beat, so the cell starts in a new place each time. Two cells per pair, low pair to high. Pass: all five pairs clean at the goal tempo.', watch: 'Accenting the first note of the cell instead of the beat.', simplify: 'Triplets.' }),
          X('pgsix-mirror', 'The mirrored lick: down the cell, every change outside ({key})', 'variable', { dir: 'down', pairs: ALL_PAIRS.slice().reverse(), reps: 2, step: 1 / 3, goal: 110, why: 'Turning the cell around (high to low) makes every string change an outside one: the other half of the picking problem, and a great descending lick.', instr: 'Two notes down the upper string, two down the lower, back up one to each: strict alternate picking. Top pair first, moving down. Pass: all pairs clean at the goal tempo.', watch: 'Clipping the string you just left on the way around.', simplify: 'Top two pairs only.' })]),
        S('pgsix-boxes', 'Other boxes', 'picking', 'The same cell in boxes 2 and 3.', [
          X('pgsix-box12', 'The lick in boxes 1 and 2 on the top strings ({key})', 'interleaving', { boxes: [1, 2, 1, 2], pairs: [[2, 1]], reps: 2, step: 0.25, goal: 100, why: 'Switching boxes every two cells forces the fretting hand to find the new shape while the picking pattern stays identical.', instr: W6 + 'two cells in box 1, two in box 2, and back. Pass: 4 switches clean.', watch: 'The B-string shift in box 2.', simplify: 'Triplets.' }),
          X('pgsix-box3', 'The lick on every pair of box 3 ({key})', 'variable', { boxes: [3], pairs: ALL_PAIRS, reps: 2, step: 0.25, goal: 96, why: 'Box 3 changes the finger stretches on every pair: the same picking, a new fretting-hand map.', instr: W6 + 'two cells per pair, low to high. Pass: all pairs clean.', watch: 'Losing the box shape on the B string.', simplify: 'The top three pairs.' })]),
        S('pgsix-music', 'In a phrase', 'improv', 'The lick at speed, and a solo.', [c => sixLick(c, { fast: true }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent' })])
      ], [4, 6]),
    stage('advanced', 'Sextuplets, skips and keys',
      'Play the cell on every pair as sextuplets at 110 BPM, run it through all five boxes, play it across a skipped string, change key every block without stopping, and cascade the mirrored lick down the box into a solo.', [
        S('pgsix-speed', 'Sextuplets through the boxes', 'picking', 'One cell per beat.', [c => pgSixNote(c), c => pgSixNote(c, { across: true })]),
        S('pgsix-skip', 'Skips and keys', 'picking', 'Wider jumps; any key.', [
          X('pgsix-skip', 'The lick across a skipped string ({key})', 'variable', { pairs: [[3, 1], [4, 2]], reps: 4, step: 1 / 6, goal: 92, why: 'With a string skipped, the cell becomes wide intervals and the pick has to hop two strings at the inside change: the hardest version of the motion.', instr: W6 + 'on the G and high e strings, then the D and B, skipping the string in between. Mute it with the fretting fingers. Pass: both pairs clean at the goal tempo.', watch: 'The skipped string sounding.', simplify: 'Triplets.' }),
          X('pgsix-keys', 'The lick in four keys around the cycle of fourths', 'interleaving', { keys: [0, 5, 10, 3], pairs: [[2, 1], [3, 2]], reps: 2, step: 1 / 6, goal: 96, why: 'The cell is a shape on the box, so it moves to any key. Changing key every block trains you to find box 1 instantly while the hand keeps picking.', instr: W6 + 'two cells on the top pair, two on the next, then the next key (up a 4th). Pass: all four keys without stopping.', watch: 'Stopping to find the next key: lower the tempo instead.', simplify: 'Two keys.' })]),
        S('pgsix-adv-music', 'In a solo', 'improv', 'The cascading run, and a blues solo.', [c => sixRun(c), c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo with six-note bursts: speed, then space' })])
      ], [7, 8]),
    stage('mastery', 'Anywhere, at speed, your own',
      'Play the lick through all five boxes on every pair as sextuplets at about 120 BPM, the mirror at 110, a random key, box and pair every bar from memory, and perform your own 8-bar piece built on it.', [
        S('pgsix-performance', 'Performance tempo', 'picking', 'The whole neck at speed.', [
          X('pgsix-all-boxes', 'The lick on every pair of all five boxes ({key})', 'edge', { boxes: [1, 2, 3, 4, 5], pairs: ALL_PAIRS, reps: 1, step: 1 / 6, goal: 96, why: 'Every pair of every box at performance tempo: the complete map of the lick, with the picking hand on autopilot.', instr: W6 + 'one cell per pair, low to high, box by box. Use the tempo ladder to climb to the goal. Pass: the whole run clean at the goal tempo.', watch: 'Tension building over the long run: shake out between boxes if needed.', simplify: 'Boxes 1 and 2.' }),
          X('pgsix-mirror-fast', 'The mirrored lick at speed, every pair ({key})', 'edge', { dir: 'down', pairs: ALL_PAIRS.slice().reverse(), reps: 2, step: 1 / 6, goal: 92, why: 'The outside-change version at performance tempo: together with the ascending cell it covers every string change alternate picking has.', instr: 'Two mirrored cells per pair from the top down, as sextuplets. Tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'Loopy motion around the strings.', simplify: '16ths.' })]),
        S('pgsix-random', 'Any key, any box', 'picking', 'No warning.', [c => sixRandom(c), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: six-note bursts between long notes' })]),
        S('pgsix-voice', 'Your own voice', 'improv', 'A study built on the lick, then your version.', [c => sixEtude(c), c => targetGuide(c, { prog: 'slowBlues', scale: 'minorPent', name: 'Slow blues: one six-note burst per chorus, the rest pure phrasing' })])
      ], [9, 10])
  ]
});
