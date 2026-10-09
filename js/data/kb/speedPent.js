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
 * mirror. legato marks the second note of each string as a pull-off (down) or hammer-on (up).
 */
export function cellOf(k, b, top, dir = 'down', legato = false) {
  const B = boxOf(k, b), strs = dir === 'down' ? [top, top + 1, top + 2] : [top + 2, top + 1, top];
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
    const cl = cellOf(k, b, top, dir, !!spec.legato); if (!cl) return null;
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
/** The app plays a cell on a random set of strings, going down or up; the next bar is silent: name and play it (hear it first). */
export function cellEcho(c) {
  const k = minorKey(c), r = rng(59 + (c.lvl || 2)), notes = [], plan = [];
  for (let i = 0; i < 4; i++) {
    const top = 1 + Math.floor(r() * 4), dir = r() < 0.5 ? 'down' : 'up', cl = cellOf(k, 1, top, dir); if (!cl) return null;
    plan.push(`strings ${top}–${top + 2} ${dir}`);
    cl.forEach(([s, f], j) => notes.push(N(s, f, i * 8 + j / 3, 1 / 3))); notes.push(N(cl[5][0], cl[5][1], i * 8 + 2, 2));
  }
  return make(c, {
    id: 'spd-echo', name: `Hear the cell: which strings, which way? (${nameOf(k)} minor pentatonic)`, domain: 'ear', method: 'audiation',
    unit: '8th-note triplets', goal: 80, start: 50, minutes: 4,
    why: 'A cell high on the neck’s top strings sounds bright and thin; on the D, G and B strings it is darker. Hearing which strings and which direction ties the sound of a run to its shape.',
    instr: 'Cover the tab. Each bar plays one cell; the next bar is silent. In the silence, say which three strings and whether it went down or up, then play it. Check afterwards. Pass: 3 of 4 named and played correctly, twice.',
    watch: 'Looking at the tab.', simplify: 'Only descending cells.', tab: { notes }
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
    instr: `${names.join(' → ')}. Three cells per bar, then a beat to find the next. Read only the names. Pass: all 8 bars from memory at the goal tempo.`,
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
export default entry({
  id: 'speedPent', kind: 'technique', title: 'Speed pentatonics', domain: 'picking',
  re: /speed pentatonic|fast pentatonic|pentatonic (speed|runs?|sextuplets?|sixes)|sextuplets?|pentatonic sixes|\bsixes\b/,
  aliases: ['pentatonic sixes', 'six-note pentatonic cells', 'cascading pentatonic runs'],
  summary: 'The six-note pentatonic cell (two notes on each of three strings), one per beat: from the slow cell in one box to sextuplet runs, picked and slurred, that cascade through all five boxes in any key.',
  prereqs: ['pentatonic'],
  sources: ['https://www.premierguitar.com/eric-johnson-concepts-and-techniques', 'https://guitarworld.com/lessons/eric-johnson-fluid-streams-of-notes', 'https://www.guitarworld.com/lessons/eric-johnson-tasty-solos', 'https://www.musicradar.com/how-to/5-guitar-tricks-you-can-learn-from-eric-johnson-today'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The cell, slowly',
      'Play the six-note cell on the top strings 8 times in a row as triplets at 80 BPM, name a cell’s strings and direction by ear, play the cell on four string sets from memory, slur it with every note even, climb it as well as fall, and end a phrase with it.', [
        S('spd-cell', 'The cell', 'picking', 'Six notes, three strings, two beats.', [
          P_('spd-cell-slow', 'Pentatonic sixes, slowly: the cell in two halves, then whole ({key}, box 1)', 'chunking', { tops: [1], reps: 4, step: 1 / 3, goal: 84, start: 50, why: 'Speed pentatonics are built from one cell: the two box-1 notes on the high e, the two on the B, the two on the G, falling. Slowly, as triplets, two beats per cell, the shape gets into the hand before the speed does.', instr: CELL + 'high e, B, G, each high note then low note. Loop the first four notes until even, then the whole cell, four times. Pass: 4 cells in a row with no hesitation at the string changes.', watch: 'Pausing at each string change.', simplify: '8th notes.' }),
          P_('spd-cell-count', 'Count the clean ones: the cell, eight in a row ({key})', 'accurate-reps', { tops: [1], reps: 8, step: 1 / 3, goal: 88, start: 52, why: 'Clean repetitions at a slow tempo build the motion you keep at speed. Count only the clean cells: a fumbled one teaches the fumble.', instr: CELL + 'eight in a row as triplets, picking every note. Count only clean cells. Pass: 8 clean cells in a row.', watch: 'Speeding up on the easy strings.', simplify: 'Four in a row.' })]),
        S('spd-hear', 'Hear it, recall it', 'ear', 'The cell by ear and from memory.', [c => cellEcho(c),
          P_('spd-cell-recall', 'From memory: the cell on four string sets ({key}, box 1)', 'retrieval', { tops: [1, 2, 3, 4], reps: 2, step: 1 / 3, goal: 84, start: 50, why: 'The same cell moves down a string at a time: strings 1–3, 2–4, 3–5, 4–6. Finding each from the box shape, not the tab, is what lets you move it in a run.', instr: CELL + 'play it twice on strings 1–3, then 2–4, 3–5, 4–6. After one pass, cover the tab and say the three strings before each. Pass: all four from memory.', watch: 'Losing the box on the B string.', simplify: 'Two string sets.' })]),
        S('spd-articulation', 'Slurred and climbing', 'fretting', 'The legato version, and the cell turned around.', [
          P_('spd-legato-slow', 'Slurred cells: pick one, pull off one ({key})', 'external-focus', { tops: [1, 2], legato: true, reps: 2, step: 1 / 3, goal: 84, start: 50, why: 'Eric Johnson slurs much of his speed pentatonics: pick the first note on a string, pull off to the second. The line only sounds fluid if the pulled-off notes are as loud as the picked ones, so listen for that.', instr: CELL + 'pick the high note on each string and pull off to the low one. Listen: every note the same volume, no gap at the pull-off. Pass: 4 cells in a row where you can’t hear which notes were picked.', watch: 'Weak pull-offs: pull slightly down toward the floor.', simplify: 'Pick every note first.' }),
          P_('spd-up-slow', 'The cell climbing: strings 3 to 1 and higher sets ({key})', 'variable', { tops: [3, 2, 1], dir: 'up', reps: 2, step: 1 / 3, goal: 84, start: 50, why: 'Turned around (low string first, low note then high), the cell climbs. The string changes now go the other way, a new motion for the picking hand.', instr: CELL + 'from the lowest of the three strings up: low note, high note, next string up. Pass: all three string sets clean twice.', watch: 'Picking the hammered note too.', simplify: 'One string set.' })]),
        S('spd-first-music', 'First music', 'improv', 'Cells into a bend.', [c => cellPhrase(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'Sextuplets in every box',
      'Play the cell down and back up the box as sextuplets at 90 BPM, picked and slurred, in boxes 2 and 3 and alternating boxes 1 and 2, box 2 from memory, cells in 16ths with the beat accented, the cell in four keys, and a fast run into a bend over a minor progression.', [
        S('spd-sextuplets', 'One cell per beat', 'picking', 'Down and back up box 1 at speed.', [c => ejSixes(c), c => ejSixes(c, { legato: true })]),
        S('spd-boxes', 'Other boxes', 'fretboard', 'The same cell in new shapes.', [
          P_('spd-box2', 'Cells down box 2 ({key})', 'variable', { boxes: [2], tops: [1, 2, 3, 4], legato: true, step: 1 / 6, goal: 88, why: 'Box 2 moves the cell up the neck: the same picking and slurs over a new set of frets.', instr: CELL + 'in box 2, one per beat, from strings 1–3 down to 4–6. Pass: 4 times clean at the goal tempo.', watch: 'The B-string shift in box 2.', simplify: 'Triplets.' }),
          P_('spd-box12', 'Box 1, box 2, box 1, box 2: cells that move ({key})', 'interleaving', { boxes: [1, 2, 1, 2], tops: [1, 2], legato: true, step: 1 / 6, goal: 88, why: 'Switching box every two cells makes the hand move position inside the run, which is where speed pentatonics come alive.', instr: CELL + 'two cells in box 1 (strings 1–3, 2–4), two in box 2, and again. Pass: the cycle twice without a gap.', watch: 'Arriving late in box 2.', simplify: 'Triplets.' }),
          P_('spd-box3', 'Cells down box 3 ({key})', 'variable', { boxes: [3], tops: [1, 2, 3, 4], legato: true, step: 1 / 6, goal: 88, why: 'Box 3 has the widest finger spread on the top strings: the cell under a new hand shape.', instr: CELL + 'in box 3, one per beat. Pass: 4 times clean at the goal tempo.', watch: 'Pinky collapsing on the stretch.', simplify: 'Triplets.' })]),
        S('spd-control', 'Recall and accents', 'picking', 'Box 2 from memory; the cell across the beat.', [
          P_('spd-recall-box2', 'From memory: climbing cells in box 2 ({key})', 'retrieval', { boxes: [2], tops: [4, 3, 2, 1], dir: 'up', legato: true, step: 1 / 6, goal: 84, why: 'Recalling box 2’s cells climbing, without the tab, proves you know the shape from its sound and fingering, not from reading.', instr: CELL + 'from strings 4–6 up to 1–3, climbing. Play box 2 once as a scale, then cover the tab. Pass: twice from memory at the goal tempo.', watch: 'Slipping into box 1 on the low strings.', simplify: 'Triplets.' }),
          P_('spd-accent', 'The cell in 16ths: accent the beat, not the cell ({key})', 'external-focus', { tops: [1, 2, 1, 2, 3, 2], step: 0.25, goal: 100, why: 'Played as 16ths the six-note cell drifts across the beat. Accenting each beat (not the start of each cell) makes a steady groove under a pattern that keeps shifting.', instr: CELL + 'in steady 16ths. Accent the note on every click whichever note of the cell it is. Listen for the pulse. Pass: four bars with every beat audible.', watch: 'Accenting the first note of each cell.', simplify: '8th notes.' }),
          P_('spd-keys', 'The cell in four keys around the cycle of fourths', 'interleaving', { keys: [0, 5, 10, 3], tops: [1, 2, 3, 4], legato: true, step: 1 / 6, goal: 84, dl: 1, why: 'The cell is built from the box, so it works in any key. Changing key every bar trains finding box 1 at once while the run keeps going.', instr: CELL + 'down box 1, one bar per key, each a 4th up. Name the key before each bar. Pass: all four without stopping.', watch: 'Stopping to look for the new box.', simplify: 'Two keys, triplets.' })]),
        S('spd-music', 'In a phrase', 'improv', 'The fast run, and a solo.', [c => cellPhrase(c, { fast: true }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo with one cascading run per phrase' })])
      ], [4, 6]),
    stage('advanced', 'Across the neck',
      'Run the cell through all five boxes down and up as sextuplets at 100 BPM, on the low strings, alternating direction cell by cell, through boxes called out of order from memory, with a crescendo across the neck, and drop runs into a blues solo.', [
        S('spd-across', 'Through the boxes', 'fretboard', 'The cell travels the neck.', [c => ejSixesAcross(c),
          P_('spd-across-up', 'Climbing pentatonic sixes through boxes 1 to 5 ({key})', 'variable', { boxes: [1, 2, 3, 4, 5], tops: [3], dir: 'up', legato: true, step: 1 / 6, reps: 2, goal: 88, why: 'Climbing cells on strings 3–1, moving up a box every two beats: the ascending run that answers the cascade.', instr: CELL + 'climbing from the G string, two per box, boxes 1 to 5. Shift on the beat. Pass: clean at the goal tempo.', watch: 'Late shifts.', simplify: 'Boxes 1–3.' })]),
        S('spd-low', 'Low strings and both directions', 'picking', 'Darker cells; direction changes.', [
          P_('spd-low-strings', 'Cells on the bass strings, boxes 1 and 2 ({key})', 'variable', { boxes: [1, 2], tops: [3, 4], legato: true, step: 1 / 6, reps: 2, goal: 88, why: 'On strings 3–6 the cell is darker and the strings are heavier: the same run with a new sound and more muting work.', instr: CELL + 'strings 3–5 and 4–6, two of each, box 1 then box 2. Mute the strings above with the fretting hand. Pass: clean at the goal tempo.', watch: 'Open strings ringing.', simplify: 'Triplets.' }),
          P_('spd-zigzag', 'Down, up, down: alternating cells across the strings ({key})', 'interleaving', { tops: [1, 2, 3, 4, 3, 2], dir: 'alt', legato: true, step: 1 / 6, goal: 88, why: 'Alternating a falling cell and a climbing one means every beat reverses the motion: a much less predictable line and a real test of control.', instr: CELL + 'falling on strings 1–3, climbing on 2–4, falling on 3–5… Pass: four bars clean at the goal tempo.', watch: 'Picking the slurred note when the direction flips.', simplify: 'Triplets.' })]),
        S('spd-adv-recall', 'Called boxes and dynamics', 'fretboard', 'Any box from memory; shaping the run.', [
          P_('spd-boxes-called', 'Boxes called out of order: 3, 1, 5, 2, 4 ({key})', 'retrieval', { boxes: [3, 1, 5, 2, 4], tops: [1, 2], legato: true, step: 1 / 6, goal: 88, why: 'Out of order, each box has to come from memory instead of sliding from the last: what a solo actually asks.', instr: CELL + 'two cells (strings 1–3, 2–4) in box 3, then 1, 5, 2, 4. Cover the tab. Pass: all five from memory at the goal tempo.', watch: 'Defaulting to the neighbouring box.', simplify: 'Boxes 1–3.' }),
          P_('spd-swell', 'A run with a shape: crescendo across the neck ({key})', 'external-focus', { boxes: [1, 2, 3, 4, 5], tops: [1], legato: true, step: 1 / 6, reps: 2, goal: 88, why: 'A fast run at one volume is an exercise; one that grows from a whisper to full force as it climbs the neck is a musical gesture.', instr: CELL + 'two per box from box 1 to 5. Start as quietly as possible and grow steadily louder to the end. Listen for a smooth curve. Pass: twice with a smooth crescendo at the goal tempo.', watch: 'Speeding up as you get louder.', simplify: 'Boxes 1–3.' })]),
        S('spd-adv-music', 'In a solo', 'improv', 'Runs between vocal phrases.', [c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo: one cascading run per chorus, then space' }), M('transfer', ['callResponse', { chords: '$slowBlues', scale: 'minorPent' }])])
      ], [7, 8]),
    stage('mastery', 'Fast, anywhere and your own',
      'Play the cascade down and up box 1 at about 115 BPM and through all five boxes at 105 in sextuplets, a random key, box and string set every bar from memory, and perform your own 8-bar speed-pentatonic piece.', [
        S('spd-performance', 'Performance tempo', 'picking', 'At speed.', [
          as(c => ejSixes(c, { legato: true }), { id: 'spd-fast-box1', method: 'edge', goal: 104, name: x => x.name + ', at performance tempo', instr: 'Down box 1 and back up, slurred, as sextuplets. Tempo ladder: start below the goal, add a few BPM after each clean pass. Pass: clean at the goal tempo.' }),
          P_('spd-fast-across', 'Through all five boxes and back at performance tempo ({key})', 'edge', { boxes: [1, 2, 3, 4, 5, 4, 3, 2, 1], tops: [1, 2], legato: true, step: 1 / 6, goal: 92, why: 'Two cells per box, up the neck and back down, at tempo: the complete speed-pentatonic run.', instr: CELL + 'two per box (strings 1–3 and 2–4), boxes 1 to 5 and back. Tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'Tension building over the long run.', simplify: 'Boxes 1–3.' })]),
        S('spd-random-access', 'Any key, any box', 'fretboard', 'No warning.', [c => spdRandom(c), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: cascading runs as launch pads for long notes' })]),
        S('spd-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => spdEtude(c), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo in his spirit: runs that cascade, then a singing held note' })])
      ], [9, 10])
  ]
});
