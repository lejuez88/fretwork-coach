// Pentatonic plus the 9th: the minor hexatonic scale (R 2 ♭3 4 5 ♭7), the minor pentatonic with the
// 2nd (9th) added. Brighter and more open than the pentatonic, it fits minor 9th and 11th chords and
// gives the passing tone between the root and the ♭3 that Eric Johnson's runs are full of. Its other
// face: the minor pentatonic built on the 5th (5 ♭7 R 2 4) lies entirely inside it, so "two
// pentatonics" over one minor chord is the same sound.
//
// Concept-first (CONTENT.md): the model is the scale's degrees and its shapes, found from the key:
// each pentatonic box with the 2 added where it falls (`hexBox()`, a fret beyond the box on some
// strings), a diagonal three-notes-per-string shape (`hexDiag()`), and the pentatonic of the 5th
// (`pentOf5()`). The composer `hex(c, spec)` builds an exercise from shape × boxes × strings ×
// sequence (the pentatonic path's sequences) × articulation × note value × keys.
import { OPEN, N, nameOf, minorKey, make, pentBox, byString, mod12, rootFret6, goalFor, S, stage, entry, M, targetGuide } from '../lib.js';
import { SEQUENCES } from './pentatonic.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const HEX = [0, 2, 3, 5, 7, 10];
export const DEG = { 0: 'R', 2: '9', 3: '♭3', 5: '4', 7: '5', 10: '♭7' };
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const unitName = step => UNIT.get(step) || '8th notes';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const isHex = (k, p) => HEX.includes(mod12(p - k));
/** Pentatonic box b with the 2 (9th) added on each string where it falls within reach (one fret below to two above the box). */
export function hexBox(k, b = 1) {
  const B = byString(pentBox(k, b)), out = [];
  for (const s of [6, 5, 4, 3, 2, 1]) {
    if (!B[s]) return null;
    const fs = new Set(B[s]);
    for (let f = Math.max(0, B[s][0] - 1); f <= Math.min(22, B[s][1] + 2); f++) if (mod12(pitch(s, f) - k) === 2) fs.add(f);
    [...fs].sort((a, c) => a - c).forEach(f => out.push([s, f]));
  }
  return out.sort((a, c) => pitch(...a) - pitch(...c));
}
/** Three notes per string through the scale from the root on the low E string: a diagonal shape across the neck. */
export function hexDiag(k) {
  for (const f0 of [rootFret6(k), rootFret6(k) + 12]) {
    const out = []; let p = OPEN[6] + f0, ok = true;
    for (const s of [6, 5, 4, 3, 2, 1]) for (let m = 0; m < 3; m++) { while (!isHex(k, p)) p++; const f = p - OPEN[s]; if (f < 0 || f > 22) { ok = false; break; } out.push([s, f]); p++; }
    if (ok && out.length === 18 && Math.max(...out.map(x => x[1])) <= 22) return out;
  }
  return null;
}
/** The minor pentatonic on the 5th of the key (5 ♭7 R 2 4), box b: every note inside the hexatonic. */
export function pentOf5(k, b = 1) { const n = pentBox(mod12(k + 7), b); return n ? n.map(x => [x.s, x.f]) : null; }
const legato = seq => seq.map(([s, f], i) => { const p = seq[i - 1]; return [s, f, p && p[0] === s && p[1] !== f ? (f > p[1] ? 'h' : 'p') : null]; });
const endOf = notes => Math.max(...notes.map(n => n.t + n.d));
function landOnRoot(notes, k, list) {
  const root = list.find(([s, f]) => s <= 5 && s >= 3 && mod12(pitch(s, f) - k) === 0) || list.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || list[0];
  const t = endOf(notes), bar = Math.ceil((t + 1) / 4) * 4; notes.push(N(root[0], root[1], t, bar - t, '~')); return notes;
}

/* ------------------------------- The composer ------------------------------- */
/**
 * One exercise from a spec: { id, name ('{key}'), method, shape ('hex' | 'diag' | 'pent5'), boxes,
 * strings, seq (a SEQUENCES name), step, legato, keys, alt (alternate pentatonics of the key and of
 * its 5th, block by block), goal, start, dl, domain, why, instr, watch, simplify }.
 */
export function hex(c, spec) {
  const k0 = minorKey(c), step = spec.step || 0.5, seq = []; let last = null, i = 0;
  for (const off of spec.keys || [0]) for (const b of spec.boxes || [1]) {
    const k = mod12(k0 + off), sh = spec.alt ? (i++ % 2 ? 'pent5' : 'pent') : spec.shape || 'hex';
    let list = sh === 'diag' ? hexDiag(k) : sh === 'pent5' ? pentOf5(k, b) : sh === 'pent' ? pentBox(k, b).map(x => [x.s, x.f]) : hexBox(k, b);
    if (!list) return null;
    if (spec.strings) list = list.filter(([s]) => spec.strings.includes(s));
    seq.push(...(SEQUENCES[spec.seq || 'updown'] || SEQUENCES.updown)(list)); last = { k, list };
  }
  const cut = seq.slice(0, 300), marked = spec.legato ? legato(cut) : cut.map(([s, f]) => [s, f, null]);
  const notes = landOnRoot(marked.map(([s, f, x], j) => N(s, f, j * step, step, x)), last.k, last.list);
  const chords = spec.backing === false ? null : [nameOf(k0) + 'm9'];
  return make(c, {
    id: spec.id, name: spec.name.replace('{key}', `${nameOf(k0)} minor`).replace('{five}', nameOf(k0 + 7)), domain: spec.domain || 'fretboard', method: spec.method, unit: unitName(step), goal: spec.goal || 96, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: spec.legato ? 'legato' : 'alternate',
    why: spec.why, instr: spec.instr.replace('{five}', nameOf(k0 + 7)), watch: spec.watch, simplify: spec.simplify, ...(chords ? { backing: chords, chords } : {}), tab: { notes }
  });
}
const H_ = (id, name, method, opts) => c => hex(c, { id, name, method, ...opts });

/* --------------------------- Existing lesson (kept id) --------------------------- */
/** The pentatonic with the added 9th, descending across the box with pull-offs, then climbing back picked. */
export function ejAddedNotes(c) {
  const key = minorKey(c), list = hexBox(key, 1); if (!list) return null;
  const down = legato(list.slice().reverse()).slice(0, 16), up = down.slice().reverse().map(([s, f]) => [s, f, null]);
  const notes = [...down.map(([s, f, x], i) => N(s, f, i * 0.25, 0.25, x)), ...up.map(([s, f], i) => N(s, f, 4 + i * 0.25, 0.25))];
  return make(c, {
    id: 'ej-added-9', name: `Pentatonic plus the 9th (${nameOf(key)} minor)`, domain: 'fretboard', method: 'variable', unit: '16th notes', goal: 100, start: 50, minutes: 5, backing: [nameOf(key) + 'm9'], chords: [nameOf(key) + 'm9'],
    why: 'Adding the 2nd (9th) to the minor pentatonic gives the brighter, more open sound Eric Johnson uses in his runs, without leaving the familiar box.',
    instr: 'Descend through the box with the added note on each string where it falls (pull-offs marked p), then climb back up picking every note. The new notes sit two frets above each root. Pass: down and up clean at the goal tempo.',
    watch: 'Dropping the added note when the tempo goes up.', simplify: 'The top three strings only.', tab: { notes }
  });
}

/* ------------------------------- Generators ------------------------------- */
/** The same phrase twice: first pentatonic, then with the 9th passing between the root and the ♭3 (hear it first). */
export function hexCompare(c) {
  const k = minorKey(c), B = byString(pentBox(k, 1)), list = hexBox(k, 1); if (!list || !B[2] || !B[1]) return null;
  const root1 = B[1][0], nine = list.find(([s, f]) => s === 1 && mod12(pitch(s, f) - k) === 2), three = B[1][1];
  if (!nine) return null;
  const notes = [];
  for (const bar of [0, 1, 2, 3]) {
    const t = bar * 4, with9 = bar % 2 === 1;
    notes.push(N(2, B[2][1], t, 1), N(1, root1, t + 1, with9 ? 0.5 : 1));
    if (with9) notes.push(N(1, nine[1], t + 1.5, 0.5));
    notes.push(N(1, three, t + 2, 2, '~'));
  }
  return make(c, {
    id: 'hex-compare', name: `Hear the 9th: the same phrase without and with it (${nameOf(k)}m9)`, domain: 'ear', method: 'audiation',
    unit: 'quarter notes', goal: 76, start: 50, minutes: 4, backing: [nameOf(k) + 'm9'], chords: [nameOf(k) + 'm9'],
    why: 'The 9th is one note, but it changes the mood: the pentatonic phrase sounds bluesy, the same phrase with the 9th passing between the root and the ♭3 sounds open and bright. Hearing that difference first is what makes you choose it on purpose.',
    instr: 'Bars 1 and 3: the plain pentatonic phrase. Bars 2 and 4: the same phrase with the 9th between the root and the ♭3. Before bar 2, sing the 9th (a whole step above the root), then play. Pass: four bars where you can sing the 9th before you play it, twice.',
    watch: 'Rushing the passing note.', simplify: 'Only bars 1 and 2.', tab: { notes }
  });
}
/** A phrase that leans on the 9th over a minor 9th vamp (use in music). */
export function hexPhrase(c, { level = 1 } = {}) {
  const k = minorKey(c), list = hexBox(k, level === 3 ? 2 : 1); if (!list) return null;
  const top = list.slice(-8), notes = []; let t = 0;
  const step = level === 1 ? 0.5 : 0.25;
  for (let bar = 0; bar < 4; bar++) {
    t = bar * 4; const run = bar % 2 ? top.slice().reverse() : top;
    run.forEach(([s, f]) => { notes.push(N(s, f, t, step)); t += step; });
    const nine = list.filter(([s, f]) => mod12(pitch(s, f) - k) === 2).pop(), r = list.filter(([s, f]) => mod12(pitch(s, f) - k) === 0).pop();
    const land = bar % 2 ? r : nine; if (!land) return null;
    notes.push(N(land[0], land[1], t, Math.max(0.5, bar * 4 + 4 - t), '~'));
  }
  const chords = level === 3 ? [nameOf(k) + 'm9', nameOf(k + 5) + '9'] : [nameOf(k) + 'm9', nameOf(k + 10)];
  return make(c, {
    id: ['hex-phrase', 'hex-phrase-16', 'hex-phrase-box2'][level - 1], name: [`Leaning on the 9th: phrases over ${chords.join(' – ')}`, `16th-note runs that land on the 9th (${chords.join(' – ')})`, `Box 2 phrases landing on the 9th and the root (${chords.join(' – ')})`][level - 1],
    domain: 'improv', method: 'transfer', unit: unitName(step), goal: [84, 96, 100][level - 1], start: 50, minutes: 5, backing: chords, chords,
    why: 'The 9th is a beautiful note to land on and hold over a minor chord: not tense, but more colourful than the root. These phrases climb to it, then the next one falls home to the root.',
    instr: 'Run up the top of the box and hold the 9th with vibrato; the next bar runs down and lands on the root. Then improvise your own answers that land on the 9th. Pass: four bars in time, then four of your own.',
    watch: 'Landing on the ♭3 by habit.', simplify: 'Half as many notes per run.', tab: { notes }
  });
}
/** A random key and box every bar, hexatonic up and down (interleaving). */
export function hexRandom(c) {
  const rr = rng(997 + (c.lvl || 9)), notes = [], names = [];
  for (let bar = 0; bar < 8; bar++) {
    const k = Math.floor(rr() * 12), b = 1 + Math.floor(rr() * 5), list = hexBox(k, b); if (!list) return null;
    list.slice(0, 12).forEach(([s, f], i) => notes.push(N(s, f, bar * 4 + i * 0.25, 0.25)));
    notes.push(N(list[11][0], list[11][1], bar * 4 + 3, 1)); names.push(`${nameOf(k)}m box ${b}`);
  }
  return make(c, {
    id: 'hex-random', name: 'Random access: the hexatonic in a new key and box every bar', domain: 'fretboard', method: 'interleaving',
    unit: '16th notes', goal: 96, start: 52, minutes: 5, dl: 1,
    why: 'At mastery level the added 9th should be in every box of every key, without thinking.',
    instr: `${names.join(' → ')}. Twelve notes up each box including the 9th, then a beat to find the next. Read only the names. Pass: all 8 bars from memory at the goal tempo.`,
    watch: 'Leaving out the 9th in unfamiliar boxes.', simplify: 'The first four bars.', tab: { notes }
  });
}
/** An original 8-bar study on the hexatonic (capstone). */
export function hexEtude(c) {
  const k = minorKey(c), b1 = hexBox(k, 1), b2 = hexBox(k, 2), dg = hexDiag(k), p5 = pentOf5(k, 1); if (!b1 || !b2 || !dg || !p5) return null;
  const notes = [], put = (seq, step, t0, beats, lg) => { let t = t0; for (const [s, f, x] of (lg ? legato(seq) : seq.map(([s, f]) => [s, f, null]))) { if (t >= t0 + beats - 1e-6) break; notes.push(N(s, f, t, step, x)); t += step; } };
  put(SEQUENCES.thirds(b1), 0.5, 0, 8, false);              // bars 1–2: box 1 in 3rds, 8ths
  put(SEQUENCES.fours(b2), 0.25, 8, 8, false);              // bars 3–4: box 2 in fours, 16ths
  put(SEQUENCES.updown(p5), 0.25, 16, 4, false);            // bar 5: the pentatonic of the 5th
  put(SEQUENCES.sixes(dg).slice(0, 36), 1 / 6, 20, 6, true); // bars 6–7: sixes down the diagonal, slurred
  const nine = b1.filter(([s, f]) => s <= 3 && mod12(pitch(s, f) - k) === 2).pop() || b1[b1.length - 1];
  notes.push(N(nine[0], nine[1], 26, 2, '~'));
  const root = b1.find(([s, f]) => s === 4 && mod12(pitch(s, f) - k) === 0) || b1.find(([s, f]) => mod12(pitch(s, f) - k) === 0);
  notes.push(N(root[0], root[1], 28, 4, '~'));
  const chords = [nameOf(k) + 'm9', nameOf(k) + 'm9', nameOf(k + 10), nameOf(k + 10), nameOf(k) + 'm9', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm9'];
  return make(c, {
    id: 'hex-capstone-etude', name: `Capstone study: an 8-bar piece on the pentatonic plus the 9th (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'mixed rhythms', goal: 92, start: 52, minutes: 8, dl: 1, backing: chords, chords,
    why: 'An original piece that uses the whole path: the scale in 3rds, fours in box 2, the pentatonic of the 5th as a second colour, slurred sixes down the diagonal, then the 9th held before the final root.',
    instr: 'Learn it two bars at a time. Let the held 9th in bar 7 ring before resolving to the root. Then write your own 8 bars to the same plan. Pass: the study at the goal tempo with no stops, then your own version once.',
    watch: 'Rushing the slurred sextuplets.', simplify: 'Bars 1–4.', tab: { notes }
  });
}
function as(gen, over) { return c => { const x = gen(c); if (!x) return null; const out = { ...x, id: over.id, method: over.method, name: over.name ? over.name(x) : x.name }; if (over.goal) { out.goalBpm = goalFor(c, over.goal); out.startBpm = Math.max(30, Math.min(Math.round(out.goalBpm * 0.6), out.goalBpm - 4)); } if (over.instr) out.instr = over.instr; return out; }; }

/* --------------------------------- The path --------------------------------- */
const HX = 'The minor pentatonic with the 9th (a whole step above the root) added: R, 9, ♭3, 4, 5, ♭7. ';
export default entry({
  id: 'hexatonic', kind: 'technique', title: 'Pentatonic plus the 9th', domain: 'fretboard',
  re: /hexatonic|added (2nd|9th|ninth)|pentatonic (\+|plus|with) (the )?(2|9|2nd|9th)/,
  aliases: ['minor hexatonic', 'pentatonic with the 9th', 'two pentatonics'],
  summary: 'The minor hexatonic (the minor pentatonic plus the 9th) and the pentatonic of the 5th inside it: from hearing the added note to runs, sequences and phrases that land on the 9th, in every box and key.',
  prereqs: ['pentatonic'],
  sources: ['https://www.premierguitar.com/eric-johnson-concepts-and-techniques', 'https://www.premierguitar.com/lessons/beyond-blues-eric-johnson-vs-joe-bonamassa', 'https://jazzimproviser.com/tag/guitar-pentatonics-lesson/', 'https://www.musicradar.com/how-to/5-guitar-tricks-you-can-learn-from-eric-johnson-today'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Find and hear the 9th',
      'Play box 1 with the 9th added on the top strings and then all strings at 80 BPM, naming every degree from memory, hear the difference the 9th makes and sing it before playing it, let the 9th ring over a minor 9th chord, run the box in threes, and play phrases that land on the 9th.', [
        S('hex-find', 'Find the added note', 'fretboard', 'Where the 9th sits in box 1.', [
          H_('hex-top-slow', 'The 9th on the top strings: box 1, slowly ({key})', 'chunking', { strings: [3, 2, 1], step: 1, goal: 80, start: 50, why: HX + 'In box 1 it appears on the high e string, two frets above the root: start where it is easiest to see.', instr: 'Up and down the top three strings of box 1 in quarter notes, saying “nine” on the added note. Pass: up and down twice with no added wrong notes.', watch: 'Adding the 2 on strings where it isn’t in reach.', simplify: 'Only the high e string.' }),
          H_('hex-degrees', 'Name every degree: box 1 with the 9th ({key})', 'retrieval', { step: 0.5, goal: 88, start: 50, why: HX + 'Knowing each note’s degree (R, 9, ♭3, 4, 5, ♭7) is what lets you aim for the 9th in a phrase.', instr: 'Up and down the whole box in 8ths, saying each degree as you play it. Then cover the tab and play it again from memory. Pass: up and down from memory with every degree named.', watch: 'Calling the 9th the ♭3.', simplify: 'Four strings.' })]),
        S('hex-hear', 'Hear the colour', 'ear', 'Without and with the 9th; the 9th ringing over the chord.', [c => hexCompare(c),
          H_('hex-ring', 'Let it ring: the 9th inside the chord ({key}m9)', 'external-focus', { strings: [4, 3, 2, 1], seq: 'thirds', step: 0.5, goal: 84, start: 50, why: 'Over a minor 9th chord the 9th is a chord tone. Letting the notes of the scale ring into each other (in 3rds, on the top four strings) makes you hear how the 9th belongs.', instr: 'Play the top four strings of the box in 3rds and let each note ring as long as you can while the next sounds. Listen for the soft, open colour whenever the 9th is in the pair. Pass: up and down twice with the notes ringing evenly.', watch: 'Cutting notes short.', simplify: 'Quarter notes.' })]),
        S('hex-shape', 'The whole box', 'fretboard', 'Down with pull-offs, then in threes.', [c => ejAddedNotes(c),
          H_('hex-threes-slow', 'Box 1 with the 9th in groups of 3 ({key})', 'variable', { seq: 'threes', step: 1 / 3, goal: 92, start: 50, why: 'In threes, the 9th falls in different places in the groups: the scale stops being a shape and starts being a melody.', instr: HX + 'Three up from each note, then three down, as triplets. Pass: up and down twice clean.', watch: 'Losing the group at the added note.', simplify: 'Ascending only.' })]),
        S('hex-first-music', 'First music', 'improv', 'Phrases that land on the 9th.', [c => hexPhrase(c, { level: 1 }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo over i–♭VI–♭VII: add the 9th to your pentatonic phrases' })])
      ], [1, 3]),
    stage('intermediate', 'Every box, and the pentatonic of the 5th',
      'Play the hexatonic in boxes 2 and 3 and alternate boxes 1 and 2 at 100 BPM in 16ths, run it in fours and in slurred sixes, play the minor pentatonic on the 5th over the minor chord and name its 9ths and 11ths from memory, change key every bar, and play 16th-note runs that land on the 9th.', [
        S('hex-boxes', 'Other boxes', 'fretboard', 'The 9th in boxes 2 and 3.', [
          H_('hex-box2', 'Box 2 with the 9th ({key})', 'variable', { boxes: [2], step: 0.25, goal: 100, why: HX + 'In box 2 the 9th falls on different strings and fingers.', instr: 'Up and down box 2 in 16ths; say “nine” as it passes. Pass: 4 clean at the goal tempo.', watch: 'The B-string shift.', simplify: '8th notes.' }),
          H_('hex-box3', 'Box 3 with the 9th ({key})', 'variable', { boxes: [3], step: 0.25, goal: 100, why: HX + 'Box 3 completes the middle of the neck.', instr: 'Up and down box 3 in 16ths. Pass: 4 clean at the goal tempo.', watch: 'Stretching for a 9th that sits outside the hand: shift instead.', simplify: '8th notes.' }),
          H_('hex-boxes12', 'Boxes 1 and 2 back to back ({key})', 'interleaving', { boxes: [1, 2, 1, 2], step: 0.25, goal: 96, why: 'Alternating boxes makes the added note a map across the neck, not a box-1 habit.', instr: HX + 'Box 1 up and down, box 2, box 1, box 2, without stopping. Pass: the cycle twice.', watch: 'Forgetting the 9th in box 2.', simplify: '8th notes.' })]),
        S('hex-seq', 'Sequences', 'picking', 'Fours, and slurred sixes.', [
          H_('hex-fours', 'Box 1 with the 9th in groups of 4 ({key})', 'variable', { seq: 'fours', step: 0.25, goal: 100, why: 'Groups of four in 16ths give the run a downstroke on every beat and move the 9th through the beat.', instr: HX + 'Four up from each note, then down. Pass: 4 clean at the goal tempo.', watch: 'Rushing the last note of each group.', simplify: '8th notes.' }),
          H_('hex-sixes', 'Slurred sixes through box 1 with the 9th ({key})', 'variable', { seq: 'sixes', step: 1 / 6, legato: true, goal: 88, why: 'Slurred groups of six are the fluid sound of his runs; with the 9th in the scale they sound more open than plain pentatonic sixes.', instr: HX + 'Six from each note, one group per beat, slurring notes on the same string. Pass: 4 clean at the goal tempo.', watch: 'Weak pull-offs.', simplify: 'Triplets.' })]),
        S('hex-pent5', 'Two pentatonics', 'theory', 'The pentatonic on the 5th is the same sound.', [
          H_('hex-pent5', '{five} minor pentatonic over {key}m9: the pentatonic of the 5th', 'variable', { shape: 'pent5', step: 0.25, goal: 100, why: 'The minor pentatonic built on the 5th of the key (5, ♭7, R, 9, 4) lies entirely inside the hexatonic. Playing a familiar box from a new root gives the 9th and 11th sounds for free: one of Eric Johnson’s “multiple pentatonics”.', instr: 'Box 1 of {five} minor pentatonic, up and down in 16ths, over the minor 9th chord of the key. Listen to how it sounds against the chord. Pass: 4 clean at the goal tempo.', watch: 'Treating it as a key change: the chord stays the same.', simplify: '8th notes.' }),
          H_('hex-pent5-recall', 'From memory: which notes of {five} minor pentatonic are the 9th and the 11th?', 'retrieval', { shape: 'pent5', seq: 'thirds', step: 0.5, goal: 92, why: 'Knowing what each note of the second pentatonic means over the chord (its root is the chord’s 5th, its 4th is the chord’s 9th, its ♭7 is the chord’s 11th) is what lets you aim for the colours.', instr: 'Play the box in 3rds. Cover the tab and say the degree each note has over the chord (5, ♭7, R, 9, 11). Pass: up and down from memory with every degree right.', watch: 'Naming degrees from the second pentatonic’s root.', simplify: 'Only name the 9ths.' })]),
        S('hex-music', 'In music', 'improv', 'Runs that land on the 9th, in any key, and a solo.', [c => hexPhrase(c, { level: 2 }), c => targetGuide(c, { prog: 'progMinor', scale: 'minor', name: 'Solo over i–♭VI–♭III–♭VII: land on the 9th over every i chord' }),
          H_('hex-keys', 'The hexatonic in four keys around the cycle of fourths', 'interleaving', { keys: [0, 5, 10, 3], strings: [4, 3, 2, 1], step: 0.25, goal: 96, dl: 1, backing: false, why: 'The 9th is two frets above the root in every key: changing key every bar trains finding it immediately.', instr: HX + 'The top four strings of box 1, up and down, one key per bar, a 4th up each time. Pass: all four without stopping.', watch: 'Forgetting the 9th in the new key.', simplify: 'Two keys.' })])
      ], [4, 6]),
    stage('advanced', 'Across the neck',
      'Play the diagonal three-notes-per-string hexatonic up and down at 100 BPM and in slurred fives, alternate the pentatonics of the key and of the 5th bar by bar, play boxes called out of order from memory, let the 9th ring in 3rds in box 2, play it on the bass strings, and phrase in box 2 over a Dorian vamp.', [
        S('hex-diag', 'The diagonal', 'fretboard', 'Three notes per string across the neck.', [
          H_('hex-diag', 'The diagonal hexatonic: three notes per string ({key})', 'variable', { shape: 'diag', step: 0.25, goal: 100, why: 'With six notes in the scale, three per string fit exactly: two strings hold one octave, and the shape climbs diagonally across two boxes.', instr: HX + 'Up and down the diagonal in 16ths, shifting position with the index finger. Pass: 4 clean at the goal tempo.', watch: 'Uneven stretches.', simplify: '8th notes.' }),
          H_('hex-diag-fives', 'Slurred fives down the diagonal ({key})', 'variable', { shape: 'diag', seq: 'fives', step: 0.25, legato: true, goal: 96, why: 'Rolling fives on the diagonal hexatonic: the cascading Eric Johnson run with his brighter scale.', instr: HX + 'Five from each note, slurred, in 16ths. Pass: 4 clean at the goal tempo.', watch: 'Losing the group at the shifts.', simplify: 'Quintuplets.' })]),
        S('hex-mix', 'Two pentatonics and recall', 'fretboard', 'Switching colours; boxes from memory.', [
          H_('hex-two-pents', 'Two pentatonics, alternating: {key} and {five} minor', 'interleaving', { boxes: [1, 1, 2, 2], alt: true, step: 0.25, goal: 96, why: 'Switching between the pentatonic of the key and the pentatonic of the 5th every block changes the colour (bluesy, then open) while the chord stays the same: two sounds from one scale.', instr: 'Box 1 of the key’s pentatonic, box 1 of the pentatonic on the 5th, then box 2 of each, up and down in 16ths. Listen to the colour change. Pass: the four blocks without stopping.', watch: 'Mixing the two shapes.', simplify: '8th notes.' }),
          H_('hex-boxes-called', 'Boxes called out of order: 3, 1, 4, 2, 5 ({key})', 'retrieval', { boxes: [3, 1, 4, 2, 5], strings: [4, 3, 2, 1], step: 0.25, goal: 96, why: 'Out of order, each box with its 9th must come from memory.', instr: HX + 'The top four strings of boxes 3, 1, 4, 2, 5. Cover the tab. Pass: all five from memory at the goal tempo.', watch: 'Leaving the 9th out.', simplify: 'Boxes 1–3.' })]),
        S('hex-sound', 'Colour and register', 'fretting', 'Ringing 3rds; the bass strings.', [
          H_('hex-ring-box2', 'Ringing 3rds in box 2 over the chord ({key}m9)', 'external-focus', { boxes: [2], seq: 'thirds', strings: [4, 3, 2, 1], step: 0.25, goal: 96, why: 'Played in 3rds and allowed to ring, the scale becomes a shimmering chord-like texture: the open, bell-like side of the hexatonic.', instr: HX + 'Box 2 in 3rds, letting each pair ring together. Listen for clarity: no buzzes, every note sustaining. Pass: twice with every note ringing.', watch: 'Fretting fingers muting the neighbouring string.', simplify: '8th notes.' }),
          H_('hex-low', 'The hexatonic on the bass strings, boxes 1 and 2 ({key})', 'variable', { boxes: [1, 2], strings: [6, 5, 4], step: 0.25, goal: 100, why: 'Low on the neck the 9th gives riffs and bass-register runs an unusual, modern colour.', instr: HX + 'The three bass strings of box 1, then box 2, up and down. Pass: 4 clean at the goal tempo.', watch: 'Open strings ringing.', simplify: '8th notes.' })]),
        S('hex-adv-music', 'In music', 'improv', 'Box 2 phrases, and a Dorian vamp.', [c => hexPhrase(c, { level: 3 }), c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp solo: the hexatonic with the 9th as the colour note' })])
      ], [7, 8]),
    stage('mastery', 'Fast, anywhere and your own',
      'Play slurred sixes down the diagonal at about 110 BPM and all five boxes in 16ths at 115, any key and box on demand, and perform your own 8-bar hexatonic piece.', [
        S('hex-performance', 'Performance tempo', 'picking', 'At speed.', [
          H_('hex-diag-sixes-fast', 'Slurred sixes down the diagonal at performance tempo ({key})', 'edge', { shape: 'diag', seq: 'sixes', step: 1 / 6, legato: true, goal: 96, why: 'The signature run with the brighter scale, at tempo.', instr: HX + 'Sixes from each note, one group per beat, slurred. Tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'Forearm tension.', simplify: '16ths.' }),
          H_('hex-all-boxes', 'All five boxes with the 9th at performance tempo ({key})', 'edge', { boxes: [1, 2, 3, 4, 5], step: 0.25, goal: 100, why: 'The whole neck with the added note, at tempo.', instr: HX + 'Each box up and down, 1 to 5, without stopping. Tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'Boxes 4 and 5.', simplify: 'Boxes 1–3.' })]),
        S('hex-random-access', 'Any key, any box', 'fretboard', 'No warning.', [c => hexRandom(c), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: pentatonic runs with the 9th as the surprise note' })]),
        S('hex-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => hexEtude(c), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo in his spirit: pentatonic runs brightened by the 9th' })])
      ], [9, 10])
  ]
});
