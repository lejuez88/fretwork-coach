// Rolling 5s: the pentatonic in groups of five, played against a 16th-note pulse so the accent rolls
// across the beat (Eric Johnson's cascading runs), from counting five in 8ths to quintuplets and
// slurred 16th-note runs along the whole neck.
//
// Concept-first (CONTENT.md): the model is a pentatonic shape as an ordered note list (a box, or the
// diagonal three-notes-per-string shape), the grouping rule (five notes from each note in turn, up or
// down: `grouped()` from pent6s) and the rhythmic relation between the group and the pulse: five per
// beat (quintuplets: the group lines up with the click) or four per beat (16ths: the group starts a
// 16th later every beat and comes round after five beats). The composer `roll5(c, spec)` builds an
// exercise from shape × boxes × strings × direction × pulse (8ths, quintuplets, 16ths) × articulation
// (picked, or slurred with the first note of each group and each new string picked) × keys.
import { OPEN, N, nameOf, minorKey, make, pentBox, pent3nps, byString, mod12, goalFor, S, stage, entry, M, targetGuide } from '../lib.js';
import { grouped } from './pent6s.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [0.25, '16th notes (groups of 5)'], [0.2, '16th-note quintuplets']]);
const unitName = step => UNIT.get(step) || '16th notes';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** A shape as [string, fret] pairs low to high: box 1–5 or the diagonal. */
export function shape5(k, shape = 'box', b = 1) { const n = shape === 'diag' ? pent3nps(k) : pentBox(k, b); return n ? n.map(x => [x.s, x.f]) : null; }
/** Groups of five: slur marks for notes on the same string as the one before, except each group's first note (picked). */
function slur(seq) { return seq.map(([s, f], i) => { const p = seq[i - 1]; return [s, f, i % 5 === 0 || !p || p[0] !== s || p[1] === f ? null : f > p[1] ? 'h' : 'p']; }); }
const endOf = notes => Math.max(...notes.map(n => n.t + n.d));
function landOnRoot(notes, k, list) {
  const root = list.find(([s, f]) => s >= 3 && mod12(pitch(s, f) - k) === 0) || list.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || list[0];
  const t = endOf(notes), bar = Math.ceil((t + 1) / 4) * 4; notes.push(N(root[0], root[1], t, bar - t, '~')); return notes;
}

/* ------------------------------- The composer ------------------------------- */
/**
 * One exercise from a spec: { id, name ('{key}'), method, shape ('box' | 'diag'), boxes, strings,
 * dir ('down' | 'up' | 'alt'), groups (per shape), step (0.5 8ths, 0.2 quintuplets, 0.25 16ths),
 * legato, keys, goal, start, dl, why, instr, watch, simplify }.
 */
export function roll5(c, spec) {
  const k0 = minorKey(c), step = spec.step || 0.25, seq = []; let last = null, n = 0;
  for (const off of spec.keys || [0]) for (const b of spec.boxes || [1]) {
    const k = mod12(k0 + off); let list = shape5(k, spec.shape || 'box', b); if (!list) return null;
    if (spec.strings) list = list.filter(([s]) => spec.strings.includes(s));
    const dir = spec.dir === 'alt' ? (n++ % 2 ? 'up' : 'down') : spec.dir || 'down';
    let g = grouped(list, 5, dir); if (spec.groups) g = g.slice(0, spec.groups * 5);
    seq.push(...g); last = { k, list };
  }
  if (seq.length < 10) return null;
  const marked = spec.legato ? slur(seq.slice(0, 300)) : seq.slice(0, 300).map(([s, f]) => [s, f, null]);
  const notes = landOnRoot(marked.map(([s, f, x], i) => N(s, f, i * step, step, x)), last.k, last.list);
  return make(c, {
    id: spec.id, name: spec.name.replace('{key}', `${nameOf(k0)} minor`), domain: spec.domain || 'picking', method: spec.method, unit: unitName(step), goal: spec.goal || 96, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: spec.legato ? 'legato' : 'alternate',
    why: spec.why, instr: spec.instr, watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
const R5 = (id, name, method, opts) => c => roll5(c, { id, name, method, ...opts });

/* --------------------------- Existing lesson (kept ids) --------------------------- */
/** Rolling 5s: five-note groups stepping through the scale in 16ths (also used by the pentatonic path). */
export function ejRolling5s(c, { dir = 'down', diagonal = false } = {}) {
  const k = nameOf(minorKey(c));
  const x = roll5(c, { id: `ej-rolling5-${dir}${diagonal ? '-diag' : ''}`, name: `Rolling 5s ${dir === 'down' ? 'descending' : 'ascending'}${diagonal ? ' along the neck' : ', box 1'} ({key})`, method: 'variable',
    shape: diagonal ? 'diag' : 'box', dir, groups: diagonal ? 12 : 8, legato: true, step: 0.25, goal: diagonal ? 92 : 100, start: 50, dl: diagonal ? 2 : 1,
    why: 'Eric Johnson’s “rolling” runs group the pentatonic in fives but play it in 16ths: the group restarts on a different part of the beat each time, which gives the line its cascading, rolling sound.',
    instr: `Play five notes ${dir === 'down' ? 'down' : 'up'} the scale, then start again one note ${dir === 'down' ? 'lower' : 'higher'}: ${diagonal ? 'on the three-notes-per-string shape, so the run travels diagonally across the neck' : 'inside box 1'}. Accent the first note of each group of five while the click stays on quarter notes: the accent lands on a different 16th every time. Pick the first note of each group and each new string; slur the rest (marked h/p). Pass: the run clean at the goal tempo with the accents audible.`,
    watch: 'Turning the groups of five into groups of four, so the accent stops rolling.', simplify: 'Play it as quintuplets (five notes per click) at half tempo until the groups feel automatic.' });
  return x ? { ...x, minutes: 6 } : x;
}

/* ------------------------------- Generators ------------------------------- */
/** One group of five per bar in 8ths, then a rest: count it, each bar one note lower (chunking). */
export function fiveCount(c) {
  const k = minorKey(c), list = shape5(k, 'box', 1); if (!list) return null;
  const r = list.slice().reverse(), notes = [];
  for (let bar = 0; bar < 4; bar++) r.slice(bar, bar + 5).forEach(([s, f], i) => notes.push(N(s, f, bar * 4 + i * 0.5, i === 4 ? 1.5 : 0.5)));
  return make(c, {
    id: 'r5-count', name: `Count to five: one group per bar, each a note lower (${nameOf(k)} minor pentatonic)`, domain: 'picking', method: 'chunking',
    unit: '8th notes', goal: 88, start: 50, minutes: 4,
    why: 'Before a group of five can roll against the beat, it has to be a unit in your head and hands. One group per bar with a rest after it lets you count it out loud: 1-2-3-4-5.',
    instr: 'Each bar: five notes down box 1 in 8ths, counting “1 2 3 4 5” aloud, then hold the fifth. The next bar starts one note lower. Pass: all four bars counted and played clean, twice.',
    watch: 'Adding a sixth note out of habit.', simplify: 'Quarter notes.', tab: { notes }
  });
}
/** The app plays a group of five as a quintuplet on the beat, then a silent beat: echo it (hear it first). */
export function fiveEcho(c) {
  const k = minorKey(c), list = shape5(k, 'box', 1), rr = rng(83 + (c.lvl || 2)); if (!list) return null;
  const notes = [];
  for (let i = 0; i < 6; i++) { const dir = rr() < 0.5 ? 'down' : 'up', g = grouped(list, 5, dir), j = Math.floor(rr() * 5) * 5; g.slice(j, j + 5).forEach(([s, f], m) => notes.push(N(s, f, i * 4 + m * 0.4, m === 4 ? 1.2 : 0.4))); }
  return make(c, {
    id: 'r5-echo', name: `Hear five, play five: quintuplet echoes (${nameOf(k)} minor pentatonic)`, domain: 'ear', method: 'audiation',
    unit: '8th-note quintuplets', goal: 72, start: 50, minutes: 4,
    why: 'A group of five fills a space in time that two or four notes don’t: hearing it, then echoing it in the same space, builds the feel before the speed.',
    instr: 'Cover the tab. Each group of five is played over two beats; the next two beats are silent: sing the group, then play it back in the same time. Pass: 4 of 6 echoes with the right notes and the same length, twice.',
    watch: 'Squeezing the echo into one beat.', simplify: 'Echo only the direction (up or down) and the first note.', tab: { notes }
  });
}
/** A phrase: rolling fives down the box into a bend and a held root (use in music). */
export function rollPhrase(c, { fast = false } = {}) {
  const k = minorKey(c), list = shape5(k, 'box', 1), B = byString(pentBox(k, 1)); if (!list || !B[3]) return null;
  const step = fast ? 0.25 : 0.5, g = slur(grouped(list, 5, 'down')), notes = [], chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  for (let bar = 0; bar < 2; bar++) {
    let t = bar * 8; const take = g.slice(bar * 15, bar * 15 + (fast ? 20 : 10));
    take.forEach(([s, f, x]) => { notes.push(N(s, f, t, step, fast ? x : null)); t += step; });
    notes.push(N(3, B[3][1], t, 1, 'b', { bendTo: B[3][1] + 2 })); t += 1;
    const root = list.find(([s, f]) => s === 4 && mod12(pitch(s, f) - k) === 0) || list[0];
    notes.push(N(root[0], root[1], t, Math.max(1, bar * 8 + 8 - t), '~'));
  }
  return make(c, {
    id: fast ? 'r5-phrase-fast' : 'r5-phrase', name: `Rolling fives into a bend${fast ? ', at speed' : ''} (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: unitName(step), goal: fast ? 92 : 88, start: 50, minutes: 5, dl: fast ? 1 : 0, backing: chords, chords,
    why: 'The fives cascade down the box and land in a bend into the 5th, then a held root: the run becomes the build-up to a singing note.',
    instr: 'Play the groups of five descending, then bend the G-string 4th up a whole step and land on the root with vibrato. Bar 2 continues from where bar 1 stopped. Then make your own ending. Pass: both bars in time with the bend in tune, then four of your own.',
    watch: 'Running out of beat before the bend: the bend lands on a beat.', simplify: 'One group, then the bend.', tab: { notes }
  });
}
/** A random key and box every bar, rolling fives down (interleaving). */
export function r5Random(c) {
  const rr = rng(1117 + (c.lvl || 9)), notes = [], names = [];
  for (let bar = 0; bar < 8; bar++) {
    const k = Math.floor(rr() * 12), b = 1 + Math.floor(rr() * 5), list = shape5(k, 'box', b); if (!list) return null;
    slur(grouped(list, 5, 'down').slice(0, 15)).forEach(([s, f, x], i) => notes.push(N(s, f, bar * 4 + i * 0.2, 0.2, x)));
    notes.push(N(list[7][0], list[7][1], bar * 4 + 3, 1)); names.push(`${nameOf(k)}m box ${b}`);
  }
  return make(c, {
    id: 'r5-random', name: 'Random access: rolling fives in a new key and box every bar', domain: 'fretboard', method: 'interleaving',
    unit: '16th-note quintuplets', goal: 88, start: 50, minutes: 5, dl: 1,
    why: 'At mastery level the grouping should start from any box in any key the moment you need it.',
    instr: `${names.join(' → ')}. Three quintuplet groups down from the top of the box, then a beat to find the next. Read only the names. Pass: all 8 bars from memory at the goal tempo.`,
    watch: 'Starting the group from the wrong note of a new box.', simplify: 'The first four bars.', tab: { notes }
  });
}
/** An original 8-bar study on rolling fives (capstone). */
export function r5Etude(c) {
  const k = minorKey(c), b1 = shape5(k, 'box', 1), b2 = shape5(k, 'box', 2), dg = shape5(k, 'diag'); if (!b1 || !b2 || !dg) return null;
  const notes = [], put = (seq, step, t0, beats) => { let t = t0; for (const [s, f, x] of slur(seq)) { if (t >= t0 + beats - 1e-6) break; notes.push(N(s, f, t, step, x)); t += step; } };
  put(grouped(b1, 5, 'down'), 0.2, 0, 4);       // bar 1: quintuplets, the group on the beat
  put(grouped(b1, 5, 'down'), 0.25, 4, 4);      // bar 2: the same notes as 16ths, the accent rolling
  put(grouped(b2, 5, 'up'), 0.25, 8, 4);        // bar 3: box 2 climbing
  put(grouped(b2, 5, 'down'), 0.25, 12, 4);     // bar 4: and falling
  put(grouped(dg, 5, 'down'), 0.25, 16, 8);     // bars 5–6: down the diagonal across the neck
  put(grouped(b1, 5, 'down').slice(20), 0.2, 24, 3);   // bar 7: the end of box 1 as quintuplets
  const root = b1.find(([s, f]) => s === 4 && mod12(pitch(s, f) - k) === 0) || b1[0];
  notes.push(N(root[0], root[1], 28, 4, '~'));
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: 'r5-capstone-etude', name: `Capstone study: an 8-bar rolling-fives piece (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'quintuplets and 16ths', goal: 88, start: 50, minutes: 8, dl: 1, backing: [...chords, ...chords], chords,
    why: 'An original piece that turns the path into music: fives lined up with the beat, the same notes rolling against it, box 2 up and down, a cascade down the diagonal across the neck, and a held landing.',
    instr: 'Learn it two bars at a time. Bars 1 and 7 are quintuplets (five per click); the rest are 16ths with the accent rolling. Then write your own 8 bars to the same plan. Pass: the study at the goal tempo with no stops, then your own version once.',
    watch: 'Bar 2: keep the 16ths even when the accent stops matching the beat.', simplify: 'Bars 1–4.', tab: { notes }
  });
}
function as(gen, over) { return c => { const x = gen(c); if (!x) return null; const out = { ...x, id: over.id, method: over.method, name: over.name ? over.name(x) : x.name }; if (over.goal) { out.goalBpm = goalFor(c, over.goal); out.startBpm = Math.max(30, Math.min(Math.round(out.goalBpm * 0.6), out.goalBpm - 4)); } if (over.instr) out.instr = over.instr; return out; }; }

/* --------------------------------- The path --------------------------------- */
const FIVE = 'Five notes from each note of the shape in turn; ';
export default entry({
  id: 'rolling5s', kind: 'technique', title: 'Rolling 5s', domain: 'picking',
  re: /rolling (5|five)'?s?|groups? of (5|five)|\bin (5|five)s\b|quintuplet/,
  aliases: ['groups of five', 'pentatonic in fives', 'quintuplets'],
  summary: 'The pentatonic in groups of five against a 16th-note pulse, so the accent rolls across the beat: from counting five in 8ths to quintuplets, slurred 16th runs and cascades along the whole neck.',
  prereqs: ['pentatonic'],
  sources: ['https://www.premierguitar.com/eric-johnson-concepts-and-techniques', 'https://hubguitar.com/fretboard/pentatonic-scale-sequences', 'https://guitarworld.com/lessons/eric-johnson-fluid-streams-of-notes', 'https://www.musicradar.com/how-to/5-guitar-tricks-you-can-learn-from-eric-johnson-today'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Feeling five',
      'Count groups of five in 8ths, play groups of five down box 1 as quintuplets at 70 BPM (one group per click), echo a group of five by ear, play the box in fives from memory, hear the accent roll in slow 16ths on the top strings, climb in fives, and end a phrase with a run of fives.', [
        S('r5-count', 'Counting five', 'picking', 'One group at a time, then one per beat.', [c => fiveCount(c),
          R5('r5-quint-slow', 'Quintuplets: one group of five per click on the top strings ({key})', 'accurate-reps', { strings: [3, 2, 1], step: 0.2, goal: 72, start: 46, why: 'Five notes per click (quintuplets) line the group up with the beat, so the shape of the group is easy to feel. Getting them even is the first real version of the technique.', instr: FIVE + 'here down the top three strings of box 1, one group per click. Count “1 2 3 4 5” per beat. Count only clean bars. Pass: 4 clean bars in a row.', watch: 'Uneven groups (two fast, three slow).', simplify: '8th notes.' })]),
        S('r5-hear', 'Hear and recall', 'ear', 'The group by ear and from memory.', [c => fiveEcho(c),
          R5('r5-recall', 'From memory: box 1 in fives as quintuplets ({key})', 'retrieval', { step: 0.2, goal: 72, start: 46, why: 'The rule (five from each note) generates the whole run; recalling it from the box instead of reading is what makes it usable in a solo.', instr: FIVE + 'all the way down box 1 as quintuplets. Play it once with the tab, then cover it and say the first note of each group before it. Pass: down the box from memory, twice.', watch: 'Skipping a group mid-box.', simplify: 'The top four strings.' })]),
        S('r5-feel', 'The roll', 'picking', 'The accent moving against the beat; climbing fives.', [
          R5('r5-roll-slow', 'Hear the roll: fives as slow 16ths on the top strings ({key})', 'external-focus', { strings: [3, 2, 1], step: 0.25, goal: 72, start: 46, why: 'The same groups of five played four notes per click no longer match the beat: the accent arrives a 16th later each time and comes round after five beats. That rolling sound is the point, so listen for it.', instr: FIVE + 'down the top strings in 16ths, accenting the first note of each group. Listen: the accents form a pattern that slides against the click. Pass: four bars where the accents are clearly audible and the 16ths stay even.', watch: 'Pausing after each group to line it up with the beat.', simplify: 'Quintuplets first, then switch to 16ths.' }),
          R5('r5-up-slow', 'Climbing fives: box 1 ascending as quintuplets ({key})', 'variable', { dir: 'up', step: 0.2, goal: 72, start: 46, why: 'Turned around, the groups climb: the string changes go the other way, a new motion for the picking hand with the same rule.', instr: FIVE + 'up box 1, one group per click. Pass: up the box twice clean.', watch: 'Rushing the last group of each string.', simplify: '8th notes.' })]),
        S('r5-first-music', 'First music', 'improv', 'Fives into a bend.', [c => rollPhrase(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'Rolling 16ths in every box',
      'Roll fives down and up box 1 as slurred 16ths at 100 BPM, picked and slurred, in box 2 (from memory), alternating boxes 1 and 2, in four keys, and play a fast rolling run into a bend over a minor progression.', [
        S('r5-box', 'Rolling 5s in box 1 and 2', 'picking', 'Down, up, and the next box.', [c => ejRolling5s(c, { dir: 'down' }), c => ejRolling5s(c, { dir: 'up' }),
          R5('r5-box2', 'Rolling 5s down box 2 ({key})', 'variable', { boxes: [2], legato: true, step: 0.25, goal: 96, why: 'The same rule on box 2: the notes change, the roll doesn’t.', instr: FIVE + 'down box 2 in slurred 16ths, accent the first of each group. Pass: down the box clean at the goal tempo.', watch: 'The B-string shift in box 2.', simplify: 'Quintuplets.' })]),
        S('r5-articulation', 'Picked and slurred', 'picking', 'Two sounds of the same run.', [
          R5('r5-legato', 'Slurred fives: only the group starts and new strings picked ({key})', 'external-focus', { legato: true, step: 0.25, goal: 100, why: 'Slurring most of the notes gives the run its fluid, violin-like sound. It only works if the slurred notes are as loud as the picked ones, so the goal is a sound, not a motion.', instr: FIVE + 'down box 1 in 16ths: pick the first note of each group and each new string, hammer or pull the rest. Listen for an even stream with the group accents. Pass: down the box twice where no slurred note drops out.', watch: 'Weak pull-offs on the high strings.', simplify: 'Quintuplets.' }),
          R5('r5-picked', 'Picked fives: every note alternate picked ({key})', 'variable', { step: 0.25, goal: 96, why: 'Every note picked gives a harder, more percussive sound, and the picking pattern itself rolls: each group starts on the opposite stroke from the last.', instr: FIVE + 'down box 1 in 16ths, strict alternate picking. Notice each group starts with the other stroke. Pass: clean at the goal tempo.', watch: 'Restarting each group with a downstroke.', simplify: 'Quintuplets.' })]),
        S('r5-control', 'Recall and keys', 'fretboard', 'Box 2 from memory, boxes mixed, other keys.', [
          R5('r5-box2-recall', 'From memory: climbing fives in box 2 ({key})', 'retrieval', { boxes: [2], dir: 'up', legato: true, step: 0.25, goal: 92, why: 'Recalling the groups in box 2, climbing, without the tab proves you own the rule and the shape.', instr: FIVE + 'up box 2. Play the box once as a scale, then cover the tab. Pass: twice from memory at the goal tempo.', watch: 'Starting from box 1’s notes.', simplify: 'Quintuplets.' }),
          R5('r5-boxes12', 'Down box 1, up box 2: fives that change shape ({key})', 'interleaving', { boxes: [1, 2, 1, 2], dir: 'alt', groups: 4, legato: true, step: 0.25, goal: 92, why: 'Switching box and direction every few beats makes the run a map of the neck, not one memorised shape.', instr: FIVE + 'four groups down box 1, four up box 2, and again. Pass: the cycle twice without stopping.', watch: 'Starting box 2 from the wrong note.', simplify: 'Quintuplets.' }),
          R5('r5-keys', 'Rolling fives in four keys around the cycle of fourths', 'interleaving', { keys: [0, 5, 10, 3], groups: 4, legato: true, step: 0.25, goal: 92, dl: 1, why: 'The rule moves to any key. Changing key every five beats trains finding box 1 at once while the roll continues.', instr: FIVE + 'four groups down box 1 in each key, a 4th up each time. Name the key before it starts. Pass: all four keys without stopping.', watch: 'Stopping at the key change.', simplify: 'Two keys.' })]),
        S('r5-music', 'In a phrase', 'improv', 'The fast run, and a solo.', [c => rollPhrase(c, { fast: true }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo with one rolling run per phrase, landing on a chord tone' })])
      ], [4, 6]),
    stage('advanced', 'Along the neck',
      'Roll fives down and up the diagonal shape across two boxes at 100 BPM, on the bass strings, through boxes 1–3 alternating direction, through boxes called out of order from memory, shape a cascade with a crescendo, and use rolling runs in a blues solo.', [
        S('r5-diag', 'The diagonal', 'fretboard', 'Fives that travel along the neck.', [c => ejRolling5s(c, { dir: 'down', diagonal: true }),
          R5('r5-diag-up', 'Rolling fives up the diagonal ({key})', 'variable', { shape: 'diag', dir: 'up', groups: 12, legato: true, step: 0.25, goal: 92, why: 'Climbing the three-notes-per-string shape in fives moves the hand up the neck inside the run: the ascending answer to the cascade.', instr: FIVE + 'up the diagonal shape in slurred 16ths, shifting position with the index finger. Pass: clean at the goal tempo.', watch: 'Late shifts that break the 16ths.', simplify: 'Quintuplets.' })]),
        S('r5-low', 'Bass strings and direction changes', 'picking', 'Darker fives; turns.', [
          R5('r5-low', 'Fives on the bass strings of boxes 1 and 2 ({key})', 'variable', { boxes: [1, 2], strings: [6, 5, 4, 3], legato: true, step: 0.25, goal: 92, why: 'On strings 3–6 the roll sounds darker and heavier; the thick strings need firmer slurs and more muting.', instr: FIVE + 'down the four bass strings of box 1, then box 2. Mute the strings above with the fretting hand. Pass: clean at the goal tempo.', watch: 'Open strings ringing.', simplify: 'Quintuplets.' }),
          R5('r5-alt', 'Down, up, down: fives through boxes 1 to 3 ({key})', 'interleaving', { boxes: [1, 2, 3], dir: 'alt', legato: true, step: 0.25, goal: 92, why: 'Changing direction with every box gives a wave-like run and forces the hand to reverse cleanly at speed.', instr: FIVE + 'down box 1, up box 2, down box 3. Pass: clean at the goal tempo.', watch: 'Losing the group at the turn.', simplify: 'Quintuplets.' })]),
        S('r5-adv-recall', 'Called boxes and dynamics', 'fretboard', 'Any box from memory; a shaped cascade.', [
          R5('r5-boxes-called', 'Boxes called out of order: 3, 1, 5, 2, 4 ({key})', 'retrieval', { boxes: [3, 1, 5, 2, 4], groups: 4, legato: true, step: 0.25, goal: 88, why: 'Out of order, each box has to be recalled rather than slid into: exactly the skill a solo asks for.', instr: FIVE + 'four groups down each box: 3, 1, 5, 2, 4. Cover the tab. Pass: all five from memory at the goal tempo.', watch: 'Defaulting to the neighbouring box.', simplify: 'Boxes 1–3.' }),
          R5('r5-swell', 'A cascade with a shape: crescendo down the diagonal ({key})', 'external-focus', { shape: 'diag', groups: 12, legato: true, step: 0.25, goal: 92, why: 'A cascade that starts as a whisper and grows to full force as it falls is music; the same notes at one volume are an exercise.', instr: FIVE + 'down the diagonal. Start very quietly and grow louder to the end, landing strongly. Listen for a smooth curve. Pass: twice with a smooth crescendo.', watch: 'Speeding up as you get louder.', simplify: 'Box 1.' })]),
        S('r5-adv-music', 'In a solo', 'improv', 'Rolling runs between phrases.', [c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo: one rolling run per chorus, then space' }), M('transfer', ['callResponse', { chords: '$slowBlues', scale: 'minorPent' }])])
      ], [7, 8]),
    stage('mastery', 'Fast, anywhere and your own',
      'Roll fives down the diagonal at about 115 BPM and through all five boxes at 105 in 16ths, start from any key and box on demand, and perform your own 8-bar rolling-fives piece.', [
        S('r5-performance', 'Performance tempo', 'picking', 'At speed.', [
          as(c => ejRolling5s(c, { dir: 'down', diagonal: true }), { id: 'r5-diag-fast', method: 'edge', goal: 104, name: x => x.name + ', at performance tempo', instr: 'Rolling fives down the diagonal at performance tempo. Tempo ladder: add a few BPM after each clean pass. Pass: clean at the goal tempo with the accents still rolling.' }),
          R5('r5-all-boxes', 'Rolling fives through all five boxes at performance tempo ({key})', 'edge', { boxes: [1, 2, 3, 4, 5], dir: 'alt', groups: 4, legato: true, step: 0.25, goal: 96, why: 'Four groups per box, alternating direction, through all five: the complete map of the roll at tempo.', instr: FIVE + 'tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'Tension over the long run.', simplify: 'Boxes 1–3.' })]),
        S('r5-random-access', 'Any key, any box', 'fretboard', 'No warning.', [c => r5Random(c), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: rolling runs into long notes' })]),
        S('r5-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => r5Etude(c), c => targetGuide(c, { prog: 'minorRock', scale: 'blues', name: 'Solo with the blues scale: build your own groups of five' })])
      ], [9, 10])
  ]
});
