// Speed pentatonics: the six-note cell (two notes on each of three strings) that drives Eric
// Johnson's cascading runs, one cell per beat, from the slow cell in one box to sextuplet runs that
// travel through all five boxes.
//
// Concept-first (CONTENT.md): the model is the pentatonic box (two notes per string) and the CELL
// built on it: three neighbouring strings starting from a top string, both box notes on each, high
// to low (descending) or low to high (ascending). Moving the top string down a string, or the box up
// the neck, moves the cell; the cell stays one beat long. The composer `spd(c, spec)` builds an
// exercise from boxes × top strings × direction × articulation (picked or slurred) × note value ×
// keys × repetitions.
import { OPEN, N, nameOf, minorKey, make, pentBox, byString, mod12, goalFor, S, stage, entry, M, targetGuide } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const unitName = step => UNIT.get(step) || '8th notes';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const boxOf = (k, b) => byString(pentBox(k, b));
/**
 * The six-note cell of box b starting on string `top` (1–4): both box notes on strings top, top+1 and
 * top+2. Descending: high note then low note on each string, from the top string down; ascending: the
 * mirror. `len` is the number of strings (3 = six notes, 2 = the four-note half cell). legato marks the second note of each string as a pull-off (down) or hammer-on (up).
 */
export function cellOf(k, b, top, dir = 'down', legato = false, len = 3) {
  const B = boxOf(k, b), down = Array.from({ length: len }, (_, i) => top + i), strs = dir === 'down' ? down : down.slice().reverse();
  if (strs.some(s => !B[s])) return null;
  return strs.flatMap(s => (dir === 'down' ? [[s, B[s][1], null], [s, B[s][0], legato ? 'p' : null]] : [[s, B[s][0], null], [s, B[s][1], legato ? 'h' : null]]));
}
const endOf = notes => Math.max(...notes.map(n => n.t + n.d));
function landOnRoot(notes, k, b = 1) {
  const B = boxOf(k, b), s = [4, 3, 5, 2].find(x => B[x] && B[x].some(f => mod12(pitch(x, f) - k) === 0)); if (!s) return notes;
  const f = B[s].find(x => mod12(pitch(s, x) - k) === 0), t = endOf(notes), bar = Math.ceil((t + 1) / 4) * 4;
  notes.push(N(s, f, t, bar - t, '~')); return notes;
}

/* ------------------------------- The composer ------------------------------- */
/**
 * One exercise from a spec: { id, name ('{key}'), method, boxes, tops (top strings, in order), dir
 * ('down' | 'up' | 'alt': alternate cell by cell), legato, step, reps (cells per position), keys,
 * goal, start, dl, domain, why, instr, watch, simplify }.
 */
export function spd(c, spec) {
  const k0 = minorKey(c), step = spec.step || 1 / 6, seq = []; let n = 0, lastK = k0, lastB = 1;
  for (const off of spec.keys || [0]) for (const b of spec.boxes || [1]) for (const top of spec.tops || [1]) {
    const k = mod12(k0 + off), dir = spec.dir === 'alt' ? (n % 2 ? 'up' : 'down') : spec.dir || 'down';
    const cl = cellOf(k, b, top, dir, !!spec.legato, spec.len || 3); if (!cl) return null;
    for (let r = 0; r < (spec.reps || 1); r++) seq.push(...cl);
    n++; lastK = k; lastB = b;
  }
  const notes = landOnRoot(seq.slice(0, 300).map(([s, f, x], i) => N(s, f, i * step, step, x)), lastK, lastB);
  return make(c, {
    id: spec.id, name: spec.name.replace('{key}', `${nameOf(k0)} minor`), domain: spec.domain || 'picking', method: spec.method, unit: unitName(step), goal: spec.goal || 92, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: spec.legato ? 'legato' : 'alternate',
    why: spec.why, instr: spec.instr, watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
const P_ = (id, name, method, opts) => c => spd(c, { id, name, method, ...opts });

/* --------------------------- Existing lessons (kept ids) --------------------------- */
/** EJ-style sixes: the descending cell from strings 1 to 4, then climbing back up. */
export function ejSixes(c, { legato = false } = {}) {
  const key = minorKey(c), down = [1, 2, 3, 4].flatMap(t => cellOf(key, 1, t, 'down', legato) || []), up = [4, 3, 2, 1].flatMap(t => cellOf(key, 1, t, 'up', legato) || []);
  if (down.length < 24 || up.length < 24) return null;
  const notes = [...down.map(([s, f, x], i) => N(s, f, i / 6, 1 / 6, x)), ...up.map(([s, f, x], i) => N(s, f, 4 + i / 6, 1 / 6, x))];
  const k = nameOf(key);
  return make(c, {
    id: legato ? 'ej-sixes-legato' : 'ej-sixes', name: `${legato ? 'Legato' : 'Picked'} pentatonic sixes in ${k} minor (Eric Johnson style)`, domain: legato ? 'fretting' : 'picking', method: legato ? 'external-focus' : 'variable',
    unit: '16th-note sextuplets', goal: 92, start: 48, minutes: 6, dl: 1, picking: legato ? 'alternate' : 'strict',
    why: 'Six-note cells (two notes on each of three strings) are the engine of Eric Johnson’s fast pentatonic runs: each beat is one cell, so the run stays locked to the click while it cascades across the strings.',
    instr: `Box 1 of ${k} minor pentatonic. Bar 1: one six-note cell per beat, starting on string 1, then 2, 3 and 4, always descending. Bar 2: the same cells climbing back up. Accent the first note of every beat so you can hear the sextuplets.${legato ? ' Pick only the first note on each string; pull off (down) or hammer on (up) the second. Listen: the slurred notes must be as loud as the picked ones.' : ' Strict alternate picking, every note picked.'} Pass: both bars clean at the goal tempo.`,
    watch: 'Rushing the string changes so the cells turn into uneven 16ths.', simplify: 'One cell per beat on strings 1–3 only, looped.', tab: { notes }
  });
}
/** The descending cell on the top strings moved through all five boxes and back (also used by the pentatonic path). */
export function ejSixesAcross(c) {
  const key = minorKey(c), seq = [];
  for (const b of [1, 2, 3, 4, 5, 4, 3, 2]) { const cl = cellOf(key, b, 1, 'down', true); if (!cl) return null; seq.push(...cl); }
  const k = nameOf(key);
  return make(c, {
    id: 'ej-sixes-across', name: `Speed pentatonics through all five boxes (${k} minor)`, domain: 'fretboard', method: 'interleaving', unit: '16th-note sextuplets', goal: 88, start: 44, minutes: 6, dl: 2, picking: 'alternate',
    why: 'Eric Johnson’s runs don’t stay in one box: the same six-note cell slides from position to position, so a run can travel the whole neck at speed.',
    instr: 'One descending six-note cell on strings 1–3 per beat, in box 1, then box 2, 3, 4, 5 and back down (4, 3, 2). Shift on the first note of each beat with the index or ring finger, light on the strings. Pass: the whole journey clean at the goal tempo.',
    watch: 'Late position shifts that leave a gap at the start of the beat.', simplify: 'Boxes 1 and 2 only, two beats each.', tab: { notes: seq.map(([s, f, x], i) => N(s, f, i / 6, 1 / 6, x)) }
  });
}

/* ------------------------------- Generators ------------------------------- */
/** Speed bursts: four cells at sextuplet speed, then a "chill out" bar of one note per beat (the guitarworld burst format). */
export function spdBurst(c) {
  const k = minorKey(c), B = boxOf(k, 1), notes = []; let t = 0;
  const rf = (B[4] || []).find(f => mod12(pitch(4, f) - k) === 0); if (rf == null) return null;
  for (let rep = 0; rep < 3; rep++) {
    for (const top of [1, 2, 1, 2]) { const cl = cellOf(k, 1, top, 'down', true); if (!cl) return null; cl.forEach(([s, f, x]) => { notes.push(N(s, f, t, 1 / 6, x)); t += 1 / 6; }); }
    for (let i = 0; i < 4; i++) { notes.push(N(4, rf, t, 1)); t += 1; }
  }
  return make(c, {
    id: 'spd-burst', name: `Speed bursts: four cells, then a bar of rest notes (${nameOf(k)} minor, box 1)`, domain: 'picking', method: 'edge',
    unit: '16th-note sextuplets', goal: 100, start: 60, minutes: 6, dl: 1,
    why: 'Short bursts at a speed you cannot yet hold, each followed by a slow bar to let the hands recover, are how speed is added without building tension.',
    instr: 'Bar 1: four slurred cells (strings 1–3, 2–4, 1–3, 2–4), one per beat. Bar 2: the root on the D string, one note per beat, shaking the hands out. Three bursts in a row. When all three are clean, raise the metronome 10 BPM and start again. Pass: three clean bursts in a row at the goal tempo, relaxed.',
    watch: 'Gripping through the rest bar: the rest bar is part of the drill.', simplify: 'Two cells per burst.', tab: { notes }
  });
}
/** Groups of four and groups of six mixed: a two-string half cell in 16ths and a three-string cell in sextuplets. */
export function spdMixed(c) {
  const k = minorKey(c), notes = []; let t = 0;
  const plan = [[2, 'down'], [3, 'down'], [2, 'down'], [3, 'down'], [2, 'up'], [3, 'up'], [2, 'up'], [3, 'up']];
  for (const [i, [len, dir]] of plan.entries()) {
    const top = dir === 'down' ? 1 + (i % 2) : 3 - (i % 2) - (len === 3 ? 1 : 0), cl = cellOf(k, 1, Math.max(1, top), dir, true, len); if (!cl) return null;
    const step = len === 2 ? 0.25 : 1 / 6; cl.forEach(([s, f, x]) => { notes.push(N(s, f, t, step, x)); t += step; });
  }
  return make(c, {
    id: 'spd-mixed', name: `Fours and sixes: a 16th-note group of four, then a sextuplet group of six (${nameOf(k)} minor)`, domain: 'rhythm', method: 'interleaving',
    unit: '16th notes and sextuplets', goal: 88, start: 54, minutes: 7, dl: 0,
    why: 'Fast players change how many notes they play to a beat. Here beat 1 holds four notes (two strings), beat 2 holds six (three strings), and the click stays steady underneath.',
    instr: 'Slur every pair (pick the first note on each string). Count 1 2 3 4 and let each beat hold its own group: four notes on the odd beats, six on the even. First falling for two bars, then climbing. Pass: both bars clean, the beat steady, at the goal tempo.',
    watch: 'Squeezing the six notes into the same speed as the four: the beat must stay even.', simplify: 'Fours only, then sixes only.', tab: { notes }
  });
}
/** A phrase: two cells down the box, then a bend into the 5th and a held root (use in music). */
export function cellPhrase(c, { fast = false } = {}) {
  const k = minorKey(c), B = boxOf(k, 1); if (!B[3] || !B[4]) return null;
  const step = fast ? 1 / 6 : 1 / 3, notes = []; let t = 0;
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  for (let bar = 0; bar < 2; bar++) {
    t = bar * 8; const tops = fast ? [1, 2, 3, 4] : [1, 2];
    for (const top of tops) { const cl = cellOf(k, 1, top, 'down', true); if (!cl) return null; cl.forEach(([s, f, x]) => { notes.push(N(s, f, t, step, x)); t += step; }); }
    notes.push(N(3, B[3][1], t, 1, 'b', { bendTo: B[3][1] + 2 })); t += 1;
    const rf = B[4].find(f => mod12(pitch(4, f) - k) === 0) || B[4][1];
    notes.push(N(4, rf, t, Math.max(1, bar * 8 + 8 - t), '~'));
  }
  return make(c, {
    id: fast ? 'spd-phrase-fast' : 'spd-phrase', name: `Cascading cells into a bend${fast ? ', at speed' : ''} (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: unitName(step), goal: fast ? 88 : 88, start: 50, minutes: 5, dl: fast ? 1 : 0, backing: chords, chords,
    why: 'A run is only a lick when it lands: the cells cascade down the box and launch a bend into the 5th, then rest on the root with vibrato. Speed, then a vocal note.',
    instr: 'The cells down the box (slurred), then bend the G-string 4th up to the 5th and land on the root. Bar 2 repeats it; then answer with your own landing. Pass: both bars in time with the bend in tune, then four of your own.',
    watch: 'Rushing into the bend: the last cell ends exactly on the beat.', simplify: 'One cell, then the bend.', tab: { notes }
  });
}
/** A random key, box and top string every bar (interleaving). */
export function spdRandom(c) {
  const r = rng(271 + (c.lvl || 9)), notes = [], names = [];
  for (let bar = 0; bar < 8; bar++) {
    const k = Math.floor(r() * 12), b = 1 + Math.floor(r() * 5), top = 1 + Math.floor(r() * 3), cl = cellOf(k, b, top, 'down', true); if (!cl) return null;
    for (let rep = 0; rep < 3; rep++) cl.forEach(([s, f, x], j) => notes.push(N(s, f, bar * 4 + rep + j / 6, 1 / 6, x)));
    notes.push(N(cl[5][0], cl[5][1], bar * 4 + 3, 1)); names.push(`${nameOf(k)}m box ${b}, strings ${top}–${top + 2}`);
  }
  return make(c, {
    id: 'spd-random', name: 'Random access: the cell in a new key, box and string set every bar', domain: 'fretboard', method: 'interleaving',
    unit: '16th-note sextuplets', goal: 92, start: 50, minutes: 5, dl: 1,
    why: 'At mastery level the cell should appear anywhere, in any key, the moment you need it.',
    instr: `${names.join(' → ')}. Three cells per bar, then a beat to find the next one. Pass: all 8 bars at the goal tempo, each box found from its name.`,
    watch: 'Freezing on boxes 4 and 5.', simplify: 'The first four bars.', tab: { notes }
  });
}
/** An original 8-bar study on speed pentatonics (capstone). */
export function spdEtude(c) {
  const k = minorKey(c), notes = []; let t = 0;
  const put = (b, top, dir, step) => { const cl = cellOf(k, b, top, dir, true); if (!cl) return false; cl.forEach(([s, f, x]) => { notes.push(N(s, f, t, step, x)); t += step; }); return true; };
  for (const top of [1, 2]) if (!put(1, top, 'down', 1 / 3)) return null;                       // bar 1: two slow cells
  t = 4; for (const top of [1, 2, 3, 4]) if (!put(1, top, 'down', 1 / 6)) return null;          // bar 2: down the box at speed
  t = 8; for (const top of [4, 3, 2, 1]) if (!put(1, top, 'up', 1 / 6)) return null;            // bar 3: back up
  t = 12; for (const b of [2, 3]) for (const top of [1, 2]) if (!put(b, top, 'down', 1 / 6)) return null;   // bar 4: into boxes 2 and 3
  t = 16; for (const b of [1, 2, 3, 4, 5, 4, 3, 2]) if (!put(b, 1, 'down', 1 / 6)) return null;  // bars 5–6: through all five boxes
  const B = boxOf(k, 1); t = 24; notes.push(N(3, B[3][1], t, 2, 'b', { bendTo: B[3][1] + 2 }), N(3, B[3][1], t + 2, 2, 'r'));   // bar 7: bend and release
  const rf = B[4].find(f => mod12(pitch(4, f) - k) === 0) || B[4][1]; notes.push(N(4, rf, 28, 4, '~'));
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: 'spd-capstone-etude', name: `Capstone study: an 8-bar speed-pentatonic piece (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'triplets, then sextuplets', goal: 88, start: 48, minutes: 8, dl: 1, backing: [...chords, ...chords], chords,
    why: 'An original piece that builds the run the way the path did: slow cells, the cascade down and back up the box at speed, cells moving into boxes 2 and 3, a trip through all five boxes, then a bend and the landing.',
    instr: 'Learn it two bars at a time. Pick the first note on each string and slur the second. Then write your own 8 bars to the same plan. Pass: the study at the goal tempo with no stops, then your own version once.',
    watch: 'The position shifts in bars 5–6 arriving late.', simplify: 'Bars 1–4.', tab: { notes }
  });
}
function as(gen, over) { return c => { const x = gen(c); if (!x) return null; const out = { ...x, id: over.id, method: over.method, name: over.name ? over.name(x) : x.name }; if (over.goal) { out.goalBpm = goalFor(c, over.goal); out.startBpm = Math.max(30, Math.min(Math.round(out.goalBpm * 0.6), out.goalBpm - 4)); } if (over.instr) out.instr = over.instr; return out; }; }

/* --------------------------------- The path --------------------------------- */
const CELL = 'The cell is both box notes on each of three neighbouring strings: ';
const entryDef = {
  id: 'speedPent', kind: 'technique', title: 'Speed pentatonics', domain: 'picking',
  re: /speed pentatonic|fast pentatonic|pentatonic (speed|runs?|sextuplets?|sixes)|sextuplets?|pentatonic sixes|\bsixes\b/,
  aliases: ['pentatonic sixes', 'six-note pentatonic cells', 'cascading pentatonic runs'],
  summary: 'The six-note pentatonic cell (two notes on each of three strings), one per beat: from the slow cell in one box to sextuplet runs, picked and slurred, that cascade through all five boxes in any key.',
  prereqs: ['pentatonic'],
  sources: ['https://www.musicradar.com/how-to/5-guitar-tricks-you-can-learn-from-eric-johnson-today', 'https://www.guitarworld.com/lessons/guitar-101-how-play-fast-part-2', 'https://www.premierguitar.com/lessons/shred/full-on-pentatonic-shred', 'https://www.guitarworld.com/lessons/techniques/shred-speed-bursts', 'https://www.premierguitar.com/lessons/shred/pentatonic-scales-guitar-shred'],
  pedagogy: {
    date: '2026-10-22',
    summary: 'Taught as short repeating pentatonic cells of two notes per string: first on two strings, then three, slowly with a metronome; picked or slurred (the pick tried every way, pull-offs resting the picking hand); moved through the boxes and keys; speed added in short bursts with a recovery bar, raising the metronome 10 to 20 BPM; then group sizes and positions varied and the runs used in solos.',
    sequence: [
      { id: 'two', tier: 'foundations', step: 'The two-notes-per-string pattern on two strings', how: 'Start with a short pentatonic lick of two notes per string on two neighbouring strings, slowly, both hands loose.', skills: ['spd-two'], source: 1 },
      { id: 'three', tier: 'foundations', step: 'The six-note cell on three strings, slowly', how: 'The same pattern across three strings within one box, one cell per beat or two, with a metronome.', skills: ['spd-cell'], source: 1 },
      { id: 'artic', tier: 'foundations', step: 'Picked, slurred and climbing', how: 'Pick every note, or pick the first of each pair and pull off; the pull-off version rests the picking hand; try the cell climbing too.', skills: ['spd-articulation'], source: 2 },
      { id: 'music1', tier: 'foundations', step: 'The cell inside a phrase', how: 'A short run repeated over chord changes, ending on a held note.', skills: ['spd-first-music'], source: 1 },
      { id: 'sext', tier: 'intermediate', step: 'Sextuplets, one cell per beat', how: 'Cells down the box and back up, one per beat, picked and slurred.', skills: ['spd-sextuplets'], source: 2 },
      { id: 'boxes', tier: 'intermediate', step: 'Other boxes, shifting position inside the run', how: 'The same cells in the neighbouring pentatonic boxes, then switching box every few cells.', skills: ['spd-boxes'], source: 2 },
      { id: 'speed', tier: 'intermediate', step: 'Counting, keys and speed bursts', how: 'Keep counting 16ths whatever the grouping; repeat the pattern in other keys; short fast bursts followed by a slow recovery bar; raise the metronome 10 to 20 BPM after a clean burst.', skills: ['spd-control'], source: 3 },
      { id: 'music2', tier: 'intermediate', step: 'Runs in a phrase', how: 'A fast run launched into a bend or held note over a progression.', skills: ['spd-music'], source: 1 },
      { id: 'neck', tier: 'advanced', step: 'Through every box and up the neck', how: 'The cell moved through all five positions, descending and climbing.', skills: ['spd-across'], source: 0 },
      { id: 'low', tier: 'advanced', step: 'Other string sets and directions', how: 'The cell on the lower strings and alternating falling and climbing cells.', skills: ['spd-low'], source: 2 },
      { id: 'groups', tier: 'advanced', step: 'Switching group sizes', how: 'Changing between 16th-note groups of different lengths while counting 16ths; boxes taken in a set order.', skills: ['spd-adv-groups'], source: 0 },
      { id: 'music3', tier: 'advanced', step: 'Runs in a solo', how: 'A cascading run between vocal phrases in a blues.', skills: ['spd-adv-music'], source: 1 },
      { id: 'tempo', tier: 'mastery', step: 'Performance tempo', how: 'Raising the metronome 10 to 20 BPM once the top speed is reached, in single repetitions with short breaks, staying relaxed.', skills: ['spd-performance'], source: 3 },
      { id: 'any', tier: 'mastery', step: 'Any key, any box', how: 'The pattern in every key and position, switched on demand.', skills: ['spd-random-access'], source: 0 },
      { id: 'own', tier: 'mastery', step: 'Your own lines', how: 'Short repeating patterns built into your own solo phrases.', skills: ['spd-voice'], source: 2 }
    ],
    drills: ['The two-notes-per-string lick on two neighbouring strings', 'The six-note cell on three strings with a metronome', 'The cell picked, then with pull-offs', 'The cell down and back up a box, one per beat', 'The same cell in the next box and in other keys', 'Speed bursts: a short fast pattern, then a slow recovery bar', 'Mixing groups of four and six notes against a steady beat'],
    mistakes: ['Tension in the hands at speed', 'Weak or uneven pull-offs and hammer-ons', 'Pushing the tempo before the cell is clean', 'Weak upstrokes at string changes', 'Late position shifts', 'Losing the beat when the group size changes'],
    sources: [
      { title: '5 guitar tricks you can learn from Eric Johnson today', author: 'MusicRadar', url: 'https://www.musicradar.com/how-to/5-guitar-tricks-you-can-learn-from-eric-johnson-today' },
      { title: 'Guitar 101: How To Play Fast, Part 2', author: 'Guitar World', url: 'https://www.guitarworld.com/lessons/guitar-101-how-play-fast-part-2' },
      { title: 'Full-On Pentatonic Shred', author: 'Premier Guitar', url: 'https://www.premierguitar.com/lessons/shred/full-on-pentatonic-shred' },
      { title: 'Shred Speed Bursts', author: 'Guitar World', url: 'https://www.guitarworld.com/lessons/techniques/shred-speed-bursts' },
      { title: 'Pentatonic Scales for Shred Guitar', author: 'Sam Bell (Premier Guitar)', url: 'https://www.premierguitar.com/lessons/shred/pentatonic-scales-guitar-shred' }
    ]
  },
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The cell, slowly',
      'Play the four-note half cell on two string pairs, falling and climbing, then the six-note cell on the top strings 8 times in a row as triplets at 80 BPM, slur it with every note even, climb it as well as fall, and end a phrase with it.', [
        S('spd-two', 'Two strings first', 'picking', 'The four-note half cell, falling and climbing.', [
          P_('spd-two-down', 'Two strings, four notes, falling: the half cell on strings 1–2, then 2–3 ({key}, box 1)', 'chunking', { len: 2, tops: [1, 2, 3], reps: 4, step: 1 / 3, goal: 84, start: 50, why: 'Learn the two-notes-per-string pattern on two strings before three: four notes, high note then low note on each string, and a single string change to get right.', instr: 'Both box-1 notes on the high e string, high note then low note, then the same two notes on the B string. Four times, then the same on strings 2–3 and 3–4. Picking every note, alternate strokes, slowly as triplets. Pass: each string pair clean four times in a row.', watch: 'Rushing the string change.', simplify: '8th notes.' }, ),
          P_('spd-two-up', 'Two strings, four notes, climbing ({key}, box 1)', 'chunking', { len: 2, tops: [3, 2, 1], dir: 'up', reps: 4, step: 1 / 3, goal: 84, start: 50, why: 'The same four notes turned round: low note then high note, string changing towards the top. The string change now goes the other way.', instr: 'Low note then high note on the lower string, then the same on the next string up. Four times per pair, strings 3–4, 2–3, 1–2. Alternate picking, slowly as triplets. Pass: each pair clean four times in a row.', watch: 'Tension in the picking arm on the way up.', simplify: '8th notes.' })]),
        S('spd-cell', 'The cell', 'picking', 'Six notes, three strings, two beats.', [
          P_('spd-cell-slow', 'Pentatonic sixes, slowly: the cell in two halves, then whole ({key}, box 1)', 'chunking', { tops: [1], reps: 4, step: 1 / 3, goal: 84, start: 50, why: 'Speed pentatonics are built from one cell: the two box-1 notes on the high e, the two on the B, the two on the G, falling. Slowly, as triplets, two beats per cell, the shape gets into the hand before the speed does.', instr: CELL + 'high e, B, G, each high note then low note. Loop the first four notes until even, then the whole cell, four times. Pass: 4 cells in a row with no hesitation at the string changes.', watch: 'Pausing at each string change.', simplify: '8th notes.' }),
          P_('spd-cell-count', 'Count the clean ones: the cell, eight in a row ({key})', 'accurate-reps', { tops: [1], reps: 8, step: 1 / 3, goal: 88, start: 52, why: 'Clean repetitions at a slow tempo build the motion you keep at speed. Count only the clean cells: a fumbled one teaches the fumble.', instr: CELL + 'eight in a row as triplets, picking every note. Count only clean cells. Pass: 8 clean cells in a row.', watch: 'Speeding up on the easy strings.', simplify: 'Four in a row.' })]),
        S('spd-articulation', 'Picked, slurred and climbing', 'fretting', 'The legato version, and the cell turned around.', [
          P_('spd-legato-slow', 'Slurred cells: pick one, pull off one ({key})', 'external-focus', { tops: [1, 2], legato: true, reps: 2, step: 1 / 3, goal: 84, start: 50, why: 'The same cell can be picked on every note or slurred (pick the first note on a string, pull off to the second). Slurring rests the picking hand, and the line only sounds even if the pulled-off notes are as loud as the picked ones.', instr: CELL + 'pick the high note on each string and pull off to the low one. Listen: every note the same volume, with even timing at the pull-off. Pass: 4 cells in a row where you can’t hear which notes were picked.', watch: 'Weak pull-offs: pull slightly down toward the floor.', simplify: 'Pick every note first.' }),
          P_('spd-up-slow', 'The cell climbing: strings 3 to 1 and higher sets ({key})', 'variable', { tops: [3, 2, 1], dir: 'up', reps: 2, step: 1 / 3, goal: 84, start: 50, why: 'Turned around (low string first, low note then high), the cell climbs. The string changes now go the other way, a new motion for the picking hand.', instr: CELL + 'from the lowest of the three strings up: low note, high note, next string up. Pass: all three string sets clean twice.', watch: 'Picking the hammered note too.', simplify: 'One string set.' })]),
        S('spd-first-music', 'First music', 'improv', 'Cells into a bend.', [c => cellPhrase(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'Sextuplets in every box',
      'Play the cell down and back up the box as sextuplets at 90 BPM, picked and slurred, in boxes 2 and 3 and alternating boxes 1 and 2, cells in 16ths with the beat accented, the cell in four keys, speed bursts with a rest bar, and a fast run into a bend over a minor progression.', [
        S('spd-sextuplets', 'One cell per beat', 'picking', 'Down and back up box 1 at speed.', [c => ejSixes(c), c => ejSixes(c, { legato: true })]),
        S('spd-boxes', 'Other boxes', 'fretboard', 'The same cell in new shapes.', [
          P_('spd-box2', 'Cells down box 2 ({key})', 'variable', { boxes: [2], tops: [1, 2, 3, 4], legato: true, step: 1 / 6, goal: 88, why: 'Box 2 moves the cell up the neck: the same picking and slurs over a new set of frets.', instr: CELL + 'in box 2, one per beat, from strings 1–3 down to 4–6. Pass: 4 times clean at the goal tempo.', watch: 'The B-string shift in box 2.', simplify: 'Triplets.' }),
          P_('spd-box12', 'Box 1, box 2, box 1, box 2: cells that move ({key})', 'interleaving', { boxes: [1, 2, 1, 2], tops: [1, 2], legato: true, step: 1 / 6, goal: 88, why: 'Switching box every two cells makes the hand move position inside the run, which is where speed pentatonics come alive.', instr: CELL + 'two cells in box 1 (strings 1–3, 2–4), two in box 2, and again. Pass: the cycle twice without a gap.', watch: 'Arriving late in box 2.', simplify: 'Triplets.' }),
          P_('spd-box3', 'Cells down box 3 ({key})', 'variable', { boxes: [3], tops: [1, 2, 3, 4], legato: true, step: 1 / 6, goal: 88, why: 'Box 3 has the widest finger spread on the top strings: the cell under a new hand shape.', instr: CELL + 'in box 3, one per beat. Pass: 4 times clean at the goal tempo.', watch: 'Pinky collapsing on the stretch.', simplify: 'Triplets.' })]),
        S('spd-control', 'Accents, keys and bursts', 'picking', 'The cell across the beat; other keys; speed bursts.', [
          P_('spd-accent', 'The cell in 16ths: accent the beat, not the cell ({key})', 'external-focus', { tops: [1, 2, 1, 2, 3, 2], step: 0.25, goal: 100, why: 'Played as 16ths the six-note cell drifts across the beat. Counting 16ths and accenting each beat (not the start of each cell) keeps a steady groove under a pattern that keeps shifting.', instr: CELL + 'in steady 16ths. Accent the note on every click whichever note of the cell it is. Listen for the pulse. Pass: four bars with every beat audible.', watch: 'Accenting the first note of each cell.', simplify: '8th notes.' }),
          P_('spd-keys', 'The cell in four keys around the cycle of fourths', 'interleaving', { keys: [0, 5, 10, 3], tops: [1, 2, 3, 4], legato: true, step: 1 / 6, goal: 84, dl: 1, why: 'The cell is built from the box, so it works in any key. Changing key every bar trains finding box 1 at once while the run keeps going.', instr: CELL + 'down box 1, one bar per key, each a 4th up. Pass: all four without stopping.', watch: 'Stopping to look for the new box.', simplify: 'Two keys, triplets.' }),
          c => spdBurst(c)]),
        S('spd-music', 'In a phrase', 'improv', 'The fast run, and a solo.', [c => cellPhrase(c, { fast: true }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo with one cascading run per phrase' })])
      ], [4, 6]),
    stage('advanced', 'Across the neck',
      'Run the cell through all five boxes down and up as sextuplets at 100 BPM, on the low strings, alternating direction cell by cell, mixing groups of four and six against a steady beat, through the boxes in a set order, and drop runs into a blues solo.', [
        S('spd-across', 'Through the boxes', 'fretboard', 'The cell travels the neck.', [c => ejSixesAcross(c),
          P_('spd-across-up', 'Climbing pentatonic sixes through boxes 1 to 5 ({key})', 'variable', { boxes: [1, 2, 3, 4, 5], tops: [3], dir: 'up', legato: true, step: 1 / 6, reps: 2, goal: 88, why: 'Climbing cells on strings 3–1, moving up a box every two beats: the ascending run that answers the cascade.', instr: CELL + 'climbing from the G string, two per box, boxes 1 to 5. Shift on the beat. Pass: clean at the goal tempo.', watch: 'Late shifts.', simplify: 'Boxes 1–3.' })]),
        S('spd-low', 'Low strings and both directions', 'picking', 'Darker cells; direction changes.', [
          P_('spd-low-strings', 'Cells on the bass strings, boxes 1 and 2 ({key})', 'variable', { boxes: [1, 2], tops: [3, 4], legato: true, step: 1 / 6, reps: 2, goal: 88, why: 'On strings 3–6 the cell is darker and the strings are heavier: the same run with a new sound and more muting work.', instr: CELL + 'strings 3–5 and 4–6, two of each, box 1 then box 2. Mute the strings above with the fretting hand. Pass: clean at the goal tempo.', watch: 'Open strings ringing.', simplify: 'Triplets.' }),
          P_('spd-zigzag', 'Down, up, down: alternating cells across the strings ({key})', 'interleaving', { tops: [1, 2, 3, 4, 3, 2], dir: 'alt', legato: true, step: 1 / 6, goal: 88, why: 'Alternating a falling cell and a climbing one means every beat reverses the motion: a much less predictable line and a real test of control.', instr: CELL + 'falling on strings 1–3, climbing on 2–4, falling on 3–5… Pass: four bars clean at the goal tempo.', watch: 'Picking the slurred note when the direction flips.', simplify: 'Triplets.' })]),
        S('spd-adv-groups', 'Groups of four and six; boxes in a set order', 'rhythm', 'Mixed group sizes; the boxes in an order you learn.', [c => spdMixed(c),
          P_('spd-boxes-called', 'Boxes in a set order: 3, 1, 5, 2, 4 ({key})', 'variable', { boxes: [3, 1, 5, 2, 4], tops: [1, 2], legato: true, step: 1 / 6, goal: 88, why: 'Out of order, each box has to be found from the one before without sliding: what a solo asks.', instr: CELL + 'two cells (strings 1–3, 2–4) in box 3, then 1, 5, 2, 4. Learn the order first, then play it straight through. Pass: all five boxes in order at the goal tempo.', watch: 'Defaulting to the neighbouring box.', simplify: 'Boxes 3, 1, 2.' })]),
        S('spd-adv-music', 'In a solo', 'improv', 'Runs between vocal phrases.', [c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo: one cascading run per chorus, then space' }), M('transfer', ['callResponse', { chords: '$slowBlues', scale: 'minorPent' }])])
      ], [7, 8]),
    stage('mastery', 'Fast, anywhere and your own',
      'Play the cascade down and up box 1 at about 115 BPM and through all five boxes at 105 in sextuplets, a random key, box and string set every bar from the names, and perform your own 8-bar speed-pentatonic piece.', [
        S('spd-performance', 'Performance tempo', 'picking', 'At speed.', [
          as(c => ejSixes(c, { legato: true }), { id: 'spd-fast-box1', method: 'edge', goal: 104, name: x => x.name + ', at performance tempo', instr: 'Down box 1 and back up, slurred, as sextuplets. Tempo ladder: start below the goal, add a few BPM after each clean pass. Pass: clean at the goal tempo.' }),
          P_('spd-fast-across', 'Through all five boxes and back at performance tempo ({key})', 'edge', { boxes: [1, 2, 3, 4, 5, 4, 3, 2, 1], tops: [1, 2], legato: true, step: 1 / 6, goal: 92, why: 'Two cells per box, up the neck and back down, at tempo: the complete speed-pentatonic run.', instr: CELL + 'two per box (strings 1–3 and 2–4), boxes 1 to 5 and back. Tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'Tension building over the long run.', simplify: 'Boxes 1–3.' })]),
        S('spd-random-access', 'Any key, any box', 'fretboard', 'No warning.', [c => spdRandom(c), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: cascading runs as launch pads for long notes' })]),
        S('spd-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => spdEtude(c), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo in his spirit: runs that cascade, then a singing held note' })])
      ], [9, 10])
  ]
};

/* ------------------------------- Study notes ------------------------------- */
const ST = (concept, why, theory) => ({ concept, why, theory });
const STUDY = {
  'spd-two': ST('The speed-pentatonic cell is built from two notes on each string. On two strings it is four notes: high note then low note on one string, then the same on the next.', 'Two strings is the smallest piece that contains the whole difficulty: the string change. Get it even here before adding a third string.', ['Falling: high then low on each string; climbing: low then high.', 'The notes are the two minor-pentatonic notes the box has on each string.']),
  'spd-cell': ST('Three strings, two notes each: six notes that fit a beat as sextuplets or two beats as triplets. The cell moves down a string, or up the neck, and stays one beat long.', 'Because every cell is the same length, a long fast run stays locked to the click while it moves across strings and boxes.', ['Six notes per beat is a sextuplet; at triplet speed it takes two beats.', 'Loop the first four notes, then the whole cell.']),
  'spd-articulation': ST('The cell can be picked on every note or slurred: pick the first note on a string and pull off (falling) or hammer on (climbing) to the second.', 'Slurring rests the picking hand and the fretting hand carries the speed, but only if the slurred notes are as loud and as even as the picked ones.', ['The climbing cell reverses the string changes and the slurs (hammer-ons).', 'Both versions are worth learning; keep the one that sounds and feels best.']),
  'spd-first-music': ST('A run is only a lick when it lands: cells falling down the box into a bend and a held note, or answered by a phrase of your own.', 'Playing the cell in a phrase from the start keeps it musical.', ['The bend here goes from the 4th to the 5th.', 'Call and response: you answer the backing with your own phrase.']),
  'spd-sextuplets': ST('One cell per beat as sextuplets, falling down the box from the top strings and climbing back up.', 'This is the basic speed-pentatonic run. A beat is always one cell, so the timing stays easy to check.', ['Six notes per beat at 90 BPM is 9 notes per second.', 'Pick every note, then slur; compare the sound.']),
  'spd-boxes': ST('The same cell in the neighbouring pentatonic boxes: the finger pattern changes, the picking does not. Moving between boxes inside a run shifts the hand.', 'Runs rarely stay in one box. Shifting position on the first note of a beat keeps the run unbroken.', ['Box 3 has the widest spread on the top strings.', 'Shift with the finger that plays the first note of the beat.']),
  'spd-control': ST('Keep counting 16ths whatever the grouping, play the cell in other keys, and add speed with short bursts followed by a slow recovery bar.', 'Counting keeps the groove under a shifting pattern; bursts add speed without building tension.', ['After a clean burst, raise the metronome 10 to 20 BPM.', 'The cycle of fourths moves the key a 4th each bar.']),
  'spd-music': ST('Fast cells as a phrase: a cascade that launches a bend, and a solo with one run per phrase.', 'Speed is only useful when it leads somewhere.', ['Land on a chord tone of the backing at the end of the run.']),
  'spd-across': ST('The cell moved through all five boxes, falling and climbing, so a run travels the whole neck.', 'It joins the five boxes into one long line at speed.', ['Shift on the beat.', 'Two cells per box keeps the pattern easy to follow.']),
  'spd-low': ST('The cell on the bass strings, and falling and climbing cells alternated beat by beat.', 'It gives the run a darker sound and trains control when the direction flips every beat.', ['Strings 3–6 are heavier and need more muting.']),
  'spd-adv-groups': ST('Groups of four notes (two strings, 16ths) and groups of six (three strings, sextuplets) mixed against a steady beat; the five boxes taken in a set order.', 'Fast players change how many notes they play to a beat without losing the pulse.', ['A group of four takes a beat in 16ths; a group of six takes a beat in sextuplets.']),
  'spd-adv-music': ST('Cascading runs between vocal phrases in a blues, and a call-and-response over a slow blues.', 'Speed in a solo is a contrast to space.', ['One run per chorus, then space.']),
  'spd-performance': ST('Performance tempo: the down-and-up run in box 1 and the whole-neck run at the top of your speed, raised in small steps once clean.', 'The top speed is only useful if it is relaxed.', ['After a clean pass, add a few BPM.', 'Stop and shake out the hands when tension builds.']),
  'spd-random-access': ST('A new key, box and string set every bar, read only from the names, and a hard-rock solo that uses runs as launch pads.', 'It tests that the cell can be found anywhere.', ['Boxes 4 and 5 are the ones that usually cause hesitation.']),
  'spd-voice': ST('A capstone study that uses every part of the path, then a solo of your own in the same spirit.', 'Mastery is making the technique yours.', ['Slow cells, the cascade, the boxes, a bend and a landing.'])
};
const e = entry(entryDef);
e.stages.forEach(st => st.skills.forEach(sk => { if (STUDY[sk.id]) sk.study = STUDY[sk.id]; }));
export default e;
