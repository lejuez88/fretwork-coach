// The stretched pentatonic: three notes per string instead of two, so each string spans four or five
// frets and the shape climbs diagonally along the neck. Wide, even shapes for long alternate-picked or legato runs (a Paul Gilbert favourite).
//
// Concept-first (CONTENT.md): the model is the five three-notes-per-string pentatonic shapes, one
// starting on each degree of the scale on the low E string (found from the scale, so they are right
// in every key), plus the stretch each string needs (four or five frets). The composer
// `stretchRun(c, spec)` builds an exercise from shape × strings × sequence (up and down or groups of
// n) × note value × articulation (picked or legato) × keys.
import { OPEN, N, nameOf, minorKey, make, fromSeq, scaleNps, legatoMarks, mod12, S, stage, entry, M, targetGuide } from '../lib.js';
import { grouped } from './pent6s.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const DEGREE_OF_SHAPE = { 1: 'R', 2: '♭3', 3: '4', 4: '5', 5: '♭7' };
const STEPS = [0, 3, 5, 7, 10];
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const unitName = step => UNIT.get(step) || '8th notes';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Three notes per string from fret f of `start`, across n strings, each string continuing with the next scale note. */
function diag(k, start, f, n) {
  const out = []; let p = OPEN[start] + f;
  for (let j = 0; j < n; j++) { const s = start - j; for (let m = 0; m < 3; m++) { while (!STEPS.includes(mod12(p - k))) p++; const fr = p - OPEN[s]; if (fr < 0 || fr > 22) return null; out.push([s, fr]); p++; } }
  return out;
}
/**
 * Stretched shape 1–5 (starting on the R, ♭3, 4, 5 or ♭7). part: 'top' (strings 3-2-1), 'low' (6-5-4)
 * or 'full' (all six strings, a diagonal that climbs about 17 frets, so it only fits when it starts
 * low on the neck). Returns [[string, fret], …] low to high, or null.
 */
export function stretchShape(k, i = 1, part = 'full') {
  const start = part === 'top' ? 3 : 6, n = part === 'full' ? 6 : 3;
  let f = mod12(k + STEPS[(i - 1) % 5] - OPEN[start]);
  for (const x of part === 'full' ? [f, f + 12] : [f < 1 ? f + 12 : f, f, f + 12, f - 12]) { if (x < 0) continue; const l = diag(k, start, x, n); if (l) return l; }
  return null;
}
/** The full six-string diagonal that fits the neck in this key, preferring shape 1: { shape, list }. */
export function fullShape(k, prefer = 1) {
  for (const i of [prefer, 1, 2, 3, 4, 5]) { const l = stretchShape(k, i, 'full'); if (l) return { shape: i, list: l }; }
  return null;
}
/** The widest stretch (in frets) on any string of a shape. */
export const spanOf = list => Math.max(...[6, 5, 4, 3, 2, 1].map(s => { const fs = list.filter(x => x[0] === s).map(x => x[1]); return fs.length ? Math.max(...fs) - Math.min(...fs) : 0; }));
const endOf = notes => Math.max(...notes.map(n => n.t + n.d));
function landOnRoot(notes, k, list) {
  const root = list.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || list[0];
  const t = endOf(notes), bar = Math.ceil((t + 1) / 4) * 4;
  notes.push(N(root[0], root[1], t, bar - t));
  return notes;
}
/** The plan of the random lesson: one { k, shape } per bar. */
export function stretchPlan(c) { const r = rng(709 + (c.lvl || 9)), out = []; for (let i = 0; i < 8; i++) out.push({ k: Math.floor(r() * 12), shape: 1 + Math.floor(r() * 5) }); return out; }

/* ------------------------------- The composer ------------------------------- */
/**
 * One stretched-pentatonic exercise from a spec: { id, name ('{key}', '{shape}'), method, shapes, part ('full' | 'top' | 'low'),
 * strings, seq ('updown' or a group size), step, legato, keys, reps, goal, dl, domain, why, instr,
 * watch, simplify }.
 */
export function stretchRun(c, spec) {
  const k0 = minorKey(c), seq = []; let last = null, span = 0, first = null;
  for (const off of spec.keys || [0]) for (const i of spec.shapes || [1]) {
    const k = mod12(k0 + off), part = spec.part || 'full';
    let list, shown = i;
    if (part === 'full') { const fs = fullShape(k, i); if (!fs) return null; list = fs.list; shown = fs.shape; } else list = stretchShape(k, i, part);
    if (!list) return null; if (first == null) first = shown;
    if (spec.strings) list = list.filter(([s]) => spec.strings.includes(s));
    span = Math.max(span, spanOf(list));
    const one = typeof spec.seq === 'number' ? grouped(list, spec.seq) : [...list, ...list.slice(0, -1).reverse()];
    for (let r = 0; r < (spec.reps || 1); r++) seq.push(...one);
    last = { k, list };
  }
  const step = spec.step || 0.25;
  const marked = spec.legato ? legatoMarks(seq.slice(0, 300)) : seq.slice(0, 300).map(([s, f]) => [s, f, null]);
  const notes = landOnRoot(marked.map(([s, f, x], i) => N(s, f, i * step, step, x)), last.k, last.list);
  const where = { full: 'all six strings', top: 'the top three strings', low: 'the bottom three strings' }[spec.part || 'full'];
  const fill = t => t.replace('{key}', `${nameOf(k0)} minor`).replace('{shape}', `shape ${first} (from the ${DEGREE_OF_SHAPE[first]}), ${where}`).replace('{span}', String(span));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretting', method: spec.method, unit: unitName(step), goal: spec.goal || 100, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: spec.legato ? 'legato' : 'alternate',
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
const T = (id, name, method, opts) => c => stretchRun(c, { id, name, method, ...opts });

/* ------------------------- Foundations: generators ------------------------- */
/** Three scale notes on one string, the window moving up the G string a note at a time: the stretch alone (chunking). */
export function stretchWindow(c) {
  const k = minorKey(c), s = 3; let f0 = mod12(k - OPEN[s]); if (f0 > 7) f0 -= 12; if (f0 < 0) f0 += 12;
  const frets = []; for (let f = f0; f <= f0 + 14 && f <= 20; f++) if (STEPS.includes(mod12(pitch(s, f) - k))) frets.push(f);
  const step = (c.lvl || 2) <= 1 ? 0.5 : 1 / 3, notes = []; let t = 0;
  for (let i = 0; i + 3 <= frets.length && i < 5; i++) { const g = frets.slice(i, i + 3); [...g, ...g.slice(0, 2).reverse()].concat([g[0]]).forEach(f => { notes.push(N(s, f, t, step)); t += step; }); }
  return make(c, {
    id: 'stretch-window', name: `The stretch alone: three ${nameOf(k)} minor pentatonic notes on the G string`, domain: 'fretting', method: 'chunking',
    unit: unitName(step), goal: 88, minutes: 4,
    why: 'Three pentatonic notes on one string span four or five frets: wider than the hand’s normal one-finger-per-fret position. Opening the hand on a single string first builds the stretch without anything else to think about.',
    instr: 'Three notes up and back on the G string, then move the group up one note and repeat. Fingers 1, 2 and 4 (or 1, 3 and 4 for the wider groups); thumb low behind the neck, wrist relaxed. Stop if anything hurts. Pass: every group clean with each note ringing, twice through.',
    watch: 'Squeezing with the thumb: the stretch comes from the fingers opening, not from pressure.', simplify: 'Higher up the neck, where the frets are closer, then move down.', tab: { notes }
  });
}
/** A short phrase on the top strings of shape 1 with a slide and a bend (use in music). */
export function stretchPhrase(c, { fast = false } = {}) {
  const k = minorKey(c), list = stretchShape(k, 1, 'top'); if (!list) return null;
  const top = list, g = top.filter(([s]) => s === 3), b = top.filter(([s]) => s === 2), e = top.filter(([s]) => s === 1);
  const step = fast ? 0.25 : 0.5, notes = []; let t = 0;
  const run = fast ? [...g, ...b, ...e, ...e.slice(0, 2).reverse(), ...b.slice().reverse()] : [...g, ...b, ...e];
  for (let bar = 0; bar < 2; bar++) {
    t = bar * 4;
    run.forEach(([s, f]) => { notes.push(N(s, f, t, step)); t += step; });
    const bend = bar === 0 ? b[1] : g[2];
    notes.push(N(bend[0], bend[1], t, Math.max(0.5, bar * 4 + 4 - t), '~'));
  }
  const chords = [nameOf(k) + 'm', nameOf(k + 10)];
  return make(c, {
    id: fast ? 'stretch-phrase-fast' : 'stretch-phrase', name: `A stretched-shape phrase on the top strings${fast ? ', in 16ths' : ''} (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: unitName(step), goal: fast ? 92 : 96, minutes: 4, dl: fast ? 1 : 0, backing: chords, chords,
    why: 'The stretched shape gives long, even lines on the top strings that a two-note-per-string box can’t: three strings carry nine notes in one smooth climb.',
    instr: 'Run up the top three strings of the shape, then hold the landing note with vibrato. Bar 2 lands somewhere new. Then improvise your own run and landing over the backing. Pass: both bars clean twice, then four of your own.',
    watch: 'Clipping the landing note short: hold it to the end of the bar.', simplify: 'The G and B strings only.', tab: { notes }
  });
}
/** A random key and shape every bar (interleaving). */
export function stretchRandom(c) {
  const plan = stretchPlan(c), notes = [], names = []; let t = 0;
  for (const { k, shape } of plan) {
    const list = stretchShape(k, shape, 'top'); if (!list) return null;
    names.push(`${nameOf(k)}m shape ${shape}`);
    [...list, ...list.slice(0, 3).reverse()].forEach(([s, f], i) => notes.push(N(s, f, t + i * 0.25, 0.25)));
    notes.push(N(list[0][0], list[0][1], t + 3, 1)); t += 4;
  }
  return make(c, {
    id: 'stretch-random', name: 'Random access: a new key and stretched shape every bar', domain: 'fretboard', method: 'interleaving',
    unit: '16th notes', goal: 92, minutes: 5, dl: 1,
    why: 'At mastery level any stretched shape in any key should be under the fingers instantly.',
    instr: `${names.join(' → ')}. The top three strings of each shape up and three notes back, then a beat to find the next. Read only the names. Pass: all 8 bars from memory at the goal tempo.`,
    watch: 'Collapsing back to the two-note box in a new shape.', simplify: 'The first four bars.', tab: { notes }
  });
}
/** An original 8-bar study on the stretched shapes: picked, legato, sequenced, shifting, landing (capstone). */
export function stretchEtude(c) {
  const k = minorKey(c), fs = fullShape(k, 1), s3 = stretchShape(k, 3, 'top'); if (!fs || !s3) return null; const s1 = fs.list;
  const notes = []; const put = (seq, step, t0, beats, legato) => { const m = legato ? legatoMarks(seq) : seq.map(([s, f]) => [s, f, null]); let t = t0; for (const [s, f, x] of m) { if (t >= t0 + beats - 1e-6) break; notes.push(N(s, f, t, step, x)); t += step; } };
  put([...s1, ...s1.slice(0, -1).reverse()], 0.25, 0, 8, false);       // bars 1–2: shape 1 picked, up and down
  put([...s3, ...s3.slice(0, -1).reverse(), ...s3, ...s3.slice(0, -1).reverse()], 0.25, 8, 8, true);  // bars 3–4: shape 3 legato, top strings
  put(grouped(s1, 6), 1 / 6, 16, 8, false);                             // bars 5–6: sixes on shape 1
  put([...s3.slice().reverse(), ...s3.slice().reverse()], 1 / 6, 24, 3, false);  // bar 7: shape 3 down as sextuplets
  const root = s1.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || s1[0];
  notes.push(N(root[0], root[1], 27, 1), N(root[0], root[1], 28, 4, '~'));
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: 'stretch-capstone-etude', name: `Capstone study: an 8-bar stretched-pentatonic piece (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: '16ths and sextuplets', goal: 92, minutes: 8, dl: 1, backing: [...chords, ...chords], chords,
    why: 'An original piece that uses the whole path: a picked run up the full diagonal, a legato run through shape 3 on the top strings, sixes on the diagonal and a fast descent to the root.',
    instr: 'Learn it two bars at a time. Bars 1–2 picked, 3–4 legato (pick only the first note on each string), 5–7 picked again. Then write your own 8 bars to the same plan. Pass: the study at the goal tempo with no stops, then your own version once.',
    watch: 'The legato bars getting quieter: hammer firmly.', simplify: 'Bars 1–4.', tab: { notes }
  });
}

/* --------------------------- Existing lesson (kept id) --------------------------- */
/** Three-notes-per-string pentatonic with wide stretches, alternate picked. */
export function pgStretchPent(c) {
  return stretchRun(c, { id: 'pg-stretch-pent', name: 'Stretched pentatonic, three notes per string ({key})', method: 'variable', shapes: [1], step: 0.25, goal: 100, dl: 1,
    why: 'Three pentatonic notes per string means wide stretches but an even number of notes per string, which makes fast alternate picking and long runs across the neck easier.',
    instr: 'Up the shape and back down in 16ths, alternate picking. Thumb low behind the neck for the stretches (up to {span} frets here); keep fingers close to the frets. Pass: 4 clean in a row at the goal tempo.',
    watch: 'Tension in the thumb on the widest stretches.', simplify: 'The top three strings.' });
}

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'stretchPent', kind: 'technique', title: 'Stretched pentatonic', domain: 'fretting',
  re: /(3|three).?notes?.?per.?string pentatonic|stretch(ed)? pentatonic|pentatonic stretch|wide.?stretch/,
  aliases: ['three-notes-per-string pentatonic', 'wide pentatonic shapes'],
  summary: 'The pentatonic with three notes per string: five wide shapes, from opening the hand on one string to legato and picked runs across the neck at speed.',
  prereqs: ['pentatonic'],
  sources: ['https://www.guitarworld.com/lessons/using-monster-three-notes-per-string-pentatonic-patterns-to-efficiently-traverse-the-fretboard', 'https://www.pickupmusic.com/blog/how-to-play-minor-pentatonic-scales', 'https://www.guitarnine.com/node/6040', 'https://www.premierguitar.com/articles/23477-cram-session-alternate-picking'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Opening the hand',
      'Play three-note groups up the G string with every note ringing, the 3 + 3 cell on the G and B strings 4 times clean, stretched shape 1 up and down in 8ths at 90 BPM, name its degrees from memory and sing each step before playing it, and a phrase on its top strings.', [
        S('stretch-open', 'The stretch', 'fretting', 'One string, then two.', [c => stretchWindow(c),
          T('stretch-two-strings', 'Shape 1 on the G and B strings ({key})', 'accurate-reps', { part: 'top', strings: [3, 2], reps: 4, step: 0.5, goal: 92, why: 'Two strings of the shape (six notes) are enough to learn the stretch pattern: each string has its own gap between the fingers.', instr: 'Up the G string, up the B string, and back, four times. Fingers stay close to the frets. Pass: 4 clean in a row with no buzz.', watch: 'Lifting the first finger off while the pinky stretches.', simplify: 'One string at a time.' })]),
        S('stretch-shape1', 'Shape 1', 'fretting', 'The whole shape, a few strings at a time, then whole.', [
          T('stretch-shape1-top', 'Stretched {shape} ({key})', 'chunking', { part: 'top', reps: 2, step: 0.5, goal: 92, why: 'Three strings of the shape at a time keeps the stretch manageable while you memorise it.', instr: 'Up and down the top three strings of the shape, twice; then once more from memory. Pass: clean twice in a row, once without the tab.', watch: 'Collapsing into the two-note box shape.', simplify: 'Two strings.' }),
          T('stretch-shape1', 'Stretched {shape}, up and down ({key})', 'accurate-reps', { step: 0.5, goal: 96, why: 'The whole shape is eighteen notes that climb diagonally up the neck, each string starting a little higher than the last: two boxes joined into one long line.', instr: 'Up and down the shape in 8ths, alternate picking. The hand moves up the neck as you cross to each higher string (and back down coming down); the widest stretch here is {span} frets: thumb low, wrist straight. Pass: 4 clean in a row.', watch: 'Tension in the thumb.', simplify: 'Top three strings.' })]),
        S('stretch-know', 'Know it and hear it', 'theory', 'The degrees of the shape from memory; each note sung before it is played.', [
          T('stretch-degrees', 'Name the degrees: stretched {shape} ({key})', 'retrieval', { part: 'top', reps: 2, step: 0.5, goal: 88, why: 'Each string of the stretched shape holds three of the five degrees, so knowing which ones (and where the roots are) is what turns the shape into music you can aim. Saying them from memory makes the knowledge stick.', instr: 'Play the top three strings of the shape once with the tab, then cover it. Going up, say each note’s degree as you play it (R, ♭3, 4, 5, ♭7…); coming down, say only the roots. Pass: twice through from memory with every degree named correctly.', watch: 'Calling the ♭7 the 6th: there is no 6th in the minor pentatonic.', simplify: 'The G string only.' }),
          T('stretch-sing', 'Sing, then play: the stretched shape on the B and high e ({key})', 'audiation', { part: 'top', strings: [2, 1], reps: 2, step: 1, goal: 72, why: 'The stretched shape puts the scale in order along two strings, so it is a good place to hear each step of the pentatonic (the whole steps and the minor 3rds) before your fingers play it.', instr: 'Play the first note; sing the next one, then play it to check; continue up the B and high e strings and back. Quarter notes at a slow tempo. Pass: up and back with every note sung before it is played, twice.', watch: 'Singing a whole step where the scale jumps a minor 3rd (the bigger gaps in the shape).', simplify: 'Only the B string.' })]),
        S('stretch-first-music', 'First music', 'improv', 'A run and a held note.', [c => stretchPhrase(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'All five shapes, picked and legato',
      'Play stretched shapes 1, 2 and 3 up and down in 16ths at 100 BPM, play shape 1 on the bass strings, run it in groups of three and four, find shapes 2 and 3 from their first degree, play it legato with every note equally loud, join two shapes, and use the top strings in a 16th-note phrase.', [
        S('stretch-shapes', 'Shapes 2 and 3', 'fretting', 'The same idea starting on the ♭3 and the 4.', [
          T('stretch-shape2', 'Stretched {shape} ({key})', 'variable', { part: 'top', shapes: [2], reps: 2, step: 0.25, goal: 100, why: 'Each stretched shape starts on a different degree on the low E string and has its stretches on different strings.', instr: 'Up and down in 16ths. Name the degree the shape starts on before you play. Pass: 4 clean in a row.', watch: 'Using the shape-1 fingering on the wrong strings.', simplify: '8th notes.' }),
          T('stretch-shape3', 'Stretched {shape} ({key})', 'variable', { part: 'top', shapes: [3], reps: 2, step: 0.25, goal: 100, why: 'Shape 3 is the bridge to the upper half of the neck.', instr: 'Up and down in 16ths; the widest stretch is {span} frets. Pass: 4 clean in a row.', watch: 'Losing the root positions.', simplify: '8th notes.' }),
          T('stretch-low', 'Stretched {shape} ({key})', 'variable', { part: 'low', shapes: [1], reps: 2, step: 0.25, goal: 100, why: 'On the bass strings the frets are wider apart, so the same stretched shape asks more of the hand, and it gives you low, heavy runs for riffs and the start of long climbs.', instr: 'Up and down the bottom three strings of shape 1 in 16ths; the widest stretch here is {span} frets. Keep the thumb low and let the wrist come forward slightly. Pass: 4 clean in a row.', watch: 'The pinky collapsing on the low E string.', simplify: '8th notes, or start the shape an octave higher.' })]),
        S('stretch-articulation', 'Sequences and legato', 'fretting', 'The same shape, sequenced and slurred.', [
          T('stretch-fours', 'Stretched {shape} in groups of 4 ({key})', 'variable', { seq: 4, step: 0.25, goal: 100, why: 'Groups of four in 16ths put a downstroke on every beat, but with three notes per string each group starts on a different note of a string: the accent wanders across the shape while the picking stays regular.', instr: 'Four up from each note, then four down, in 16ths. Accent each beat. Pass: 4 clean at the goal tempo.', watch: 'Losing the group at the string change.', simplify: 'The top three strings.' }),
          T('stretch-threes', 'Stretched {shape} in groups of 3 ({key})', 'variable', { seq: 3, step: 1 / 3, goal: 104, why: 'Groups of three fit three notes per string: each group starts on a new string, then the groups shift across strings, mixing the stretches.', instr: 'Three up from each note, then three down, as triplets. Pass: 4 clean at the goal tempo.', watch: 'Losing the triplet feel at the string change.', simplify: 'Ascending only.' }),
          T('stretch-legato', 'Stretched {shape} legato ({key})', 'external-focus', { legato: true, step: 0.25, goal: 100, why: 'Three notes per string is ideal for legato: pick the first note on each string and hammer or pull the other two. The goal is a smooth, even line where you can’t hear which notes were picked.', instr: 'Pick only the first note on each string; hammer on going up, pull off going down. Listen for every note being the same volume. Pass: up and down 4 times where the picked notes don’t stick out.', watch: 'Weak pull-offs: pull slightly down (toward the floor), not straight up.', simplify: '8th notes.' })]),
        S('stretch-connect', 'Joining shapes', 'fretboard', 'Two shapes in one run; finding them from their first note.', [
          T('stretch-from-degree', 'From memory: stretched shapes 2 and 3, found from their first degree ({key})', 'retrieval', { part: 'top', shapes: [2, 3, 2, 3], step: 0.25, goal: 96, why: 'Each stretched shape is named by the degree it starts on. Finding the shape from that one fact (where is the ♭3 on the G string? where is the 4?) is how the shapes become a map instead of five memorised patterns.', instr: 'Cover the tab. Before each shape, find its first note on the G string (the ♭3 for shape 2, the 4 for shape 3) and say it; then play the top three strings up and down. Shapes 2, 3, 2, 3. Pass: all four from memory without a wrong first note.', watch: 'Starting on the root out of habit.', simplify: 'Shape 2 only, 8th notes.' }),
          T('stretch-shapes12', 'Stretched shapes 1 and 2 in one run ({key})', 'interleaving', { part: 'top', shapes: [1, 2, 1, 3], step: 0.25, goal: 96, why: 'Switching between shapes in one run makes the stretched shapes a map of the neck rather than separate exercises.', instr: 'Shape 1 up and down, shape 2, shape 1, shape 3, without stopping. Pass: the whole run twice.', watch: 'Stopping between shapes: keep the 16ths going.', simplify: 'Shapes 1 and 2 only.' })]),
        S('stretch-music', 'In a phrase', 'improv', 'A 16th-note phrase, and a solo.', [c => stretchPhrase(c, { fast: true }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent' })])
      ], [4, 6]),
    stage('advanced', 'Speed, sixes and keys',
      'Play shape 1 in sixes as sextuplets at 100 BPM, play all five stretched shapes in one run without stopping, play shape 1 in four keys, play it legato in sextuplets on the top and bass strings, play shapes called out of order from memory, and solo with the shapes over a blues.', [
        S('stretch-speed', 'Speed', 'picking', 'Sixes and legato at speed.', [c => pgStretchPent(c),
          T('stretch-sixes', 'Stretched {shape} in groups of six ({key})', 'variable', { seq: 6, step: 1 / 6, goal: 92, domain: 'picking', why: 'Groups of six on the stretched shape cover two strings per group: the long, fast cascading lines of shred pentatonic playing.', instr: 'Six up from each note, then six down, one group per beat. Pass: 4 clean at the goal tempo.', watch: 'Losing the stretch as the tempo rises.', simplify: 'Triplets.' }),
          T('stretch-legato-fast', 'Stretched {shape} legato in sextuplets ({key})', 'variable', { legato: true, step: 1 / 6, goal: 88, why: 'Legato at speed: two strings per beat with only one pick stroke each.', instr: 'Pick the first note on each string, hammer and pull the rest, as sextuplets. Pass: 4 clean at the goal tempo.', watch: 'The last note of each string fading.', simplify: '16ths.' })]),
        S('stretch-anywhere', 'Every shape, every key', 'fretboard', 'The whole neck.', [
          T('stretch-all-shapes', 'All five stretched shapes in one run ({key})', 'interleaving', { part: 'top', shapes: [1, 2, 3, 4, 5], step: 0.25, goal: 100, why: 'Five shapes up the neck on the top strings, each up and down: the complete map, and stamina for the stretches.', instr: 'Each shape up and down in 16ths, from shape 1 to shape 5, no stops. Pass: the whole run clean.', watch: 'Shapes 4 and 5 falling apart: give them extra slow reps.', simplify: 'Shapes 1–3.' }),
          T('stretch-keys', 'The stretched diagonal in four keys around the cycle of fourths', 'interleaving', { keys: [0, 5, 10, 3], strings: [4, 3, 2, 1], step: 0.25, goal: 100, why: 'The shapes are found from the scale, so they move to any key: changing key per block trains finding them instantly.', instr: 'The top four strings of the diagonal, up and down, then the next key (a 4th up). Pass: all four keys without stopping.', watch: 'Starting the new key on the wrong fret.', simplify: 'Two keys.' })]),
        S('stretch-adv-recall', 'Called shapes and the low strings', 'fretboard', 'Shapes out of order from memory; legato on the bass strings.', [
          T('stretch-shapes-called', 'Shape called, shape played: 3, 1, 5, 2, 4 on the top strings ({key})', 'retrieval', { part: 'top', shapes: [3, 1, 5, 2, 4], step: 0.25, goal: 96, why: 'Played in order, each shape is found by sliding from the last. Out of order, it has to come from memory: the skill you need to jump to the right part of the neck in a solo.', instr: 'Cover the tab. Up and down the top three strings of shape 3, then 1, 5, 2 and 4, in 16ths, without stopping. Name each shape’s starting degree before you play it. Pass: all five from memory at the goal tempo.', watch: 'Defaulting to the nearest shape instead of the one called.', simplify: 'Shapes 1–3 only.' }),
          T('stretch-low-legato', 'Legato on the bass strings: stretched {shape} ({key})', 'external-focus', { part: 'low', shapes: [1, 2], legato: true, reps: 2, step: 1 / 6, goal: 88, why: 'Legato on the thick strings needs firmer hammer-ons and a cleaner mute than on the top strings. Listening for evenness (no picked note louder, no open strings ringing) is the test.', instr: 'Pick only the first note on each string; hammer and pull the rest, shape 1 then shape 2, as sextuplets. Listen: every note the same volume, nothing ringing underneath. Pass: twice through with no picked note sticking out.', watch: 'Open strings ringing on the pull-offs: mute with the side of the picking hand.', simplify: '16ths, shape 1 only.' })]),
        S('stretch-adv-music', 'In a solo', 'improv', 'Long lines in a blues.', [c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo: one long stretched-shape line per chorus' })])
      ], [7, 8]),
    stage('mastery', 'Instant, fast and your own',
      'Play shape 1 in sixes at about 110 BPM and all five shapes in 16ths at about 115, any key and shape on demand, and perform your own 8-bar piece on the stretched shapes.', [
        S('stretch-performance', 'Performance tempo', 'picking', 'At speed.', [
          T('stretch-sixes-fast', 'Stretched {shape} in sixes at performance tempo ({key})', 'edge', { seq: 6, step: 1 / 6, goal: 96, domain: 'picking', why: 'The signature fast run of the stretched shape, at tempo.', instr: 'Tempo ladder: start below the goal and add a few BPM after each clean pass. Pass: 4 clean at the goal tempo.', watch: 'Forearm tension.', simplify: '16ths.' }),
          T('stretch-all-fast', 'All five stretched shapes at performance tempo ({key})', 'edge', { part: 'top', shapes: [1, 2, 3, 4, 5], step: 0.25, goal: 92, domain: 'picking', why: 'The full map of the neck at speed: stamina for the stretches and instant shape changes.', instr: 'Tempo ladder to the goal. Pass: the whole run clean at the goal tempo.', watch: 'Rushing the shape changes.', simplify: 'Shapes 1–3.' })]),
        S('stretch-random', 'Any key, any shape', 'fretboard', 'No warning.', [c => stretchRandom(c), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo across the neck with the stretched shapes' })]),
        S('stretch-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => stretchEtude(c), c => targetGuide(c, { prog: 'minorRock', scale: 'blues', name: 'Solo with the blues scale on stretched shapes' })])
      ], [9, 10])
  ]
});
