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
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [0.2, '16th-note quintuplets'], [1 / 6, '16th-note sextuplets']]);
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
 * strings, seq (a SEQUENCES name), step, lead (beats of rest before the first note: starts the figure on beat 3), legato, keys, alt (alternate pentatonics of the key and of
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
  if (spec.lead) notes.forEach(n => { n.t = +(n.t + spec.lead).toFixed(4); });
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
    id: 'hex-compare', name: `Hear the 9th: the same phrase without and with it (${nameOf(k)}m9)`, domain: 'fretboard', method: 'accurate-reps',
    unit: 'quarter notes', goal: 76, start: 50, minutes: 4, backing: [nameOf(k) + 'm9'], chords: [nameOf(k) + 'm9'],
    why: 'The 9th is one note, but it changes the mood: the pentatonic phrase sounds bluesy, the same phrase with the 9th passing between the root and the ♭3 sounds open and bright. Playing the two versions side by side is how Eric Johnson’s 9th reads: a passing tone between the root and the ♭3.',
    instr: 'Bars 1 and 3: the plain pentatonic phrase. Bars 2 and 4: the same phrase with the 9th between the root and the ♭3. The 9th is the note a whole step above the root; play it quickly, as a passing tone, and land on the ♭3. Pass: the four bars in time with the 9th and the ♭3 both clean, twice.',
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
/** The pentatonic box, then the same box with the 9th added: the one new note, alone (start from what you know). */
export function hexAdd(c) {
  const k = minorKey(c), P = pentBox(k, 1), H = hexBox(k, 1); if (!P || !H) return null;
  const up = l => [...l, ...l.slice(0, -1).reverse()], seq = [...up(P.map(x => [x.s, x.f])), ...up(H), ...up(P.map(x => [x.s, x.f])), ...up(H)];
  const notes = seq.map(([s, f], i) => N(s, f, i * 0.5, 0.5));
  const t = endOf(notes), root = H.find(([s, f]) => s === 4 && mod12(pitch(s, f) - k) === 0) || H[0], bar = Math.ceil((t + 1) / 4) * 4; notes.push(N(root[0], root[1], t, bar - t, '~'));
  return make(c, {
    id: 'hex-add-one', name: `Pentatonic, then the same box with the 9th added (${nameOf(k)} minor)`, domain: 'fretboard', method: 'chunking', unit: '8th notes', goal: 88, start: 50, minutes: 5,
    backing: [nameOf(k) + 'm9'], chords: [nameOf(k) + 'm9'],
    why: 'You already know box 1 of the minor pentatonic. The hexatonic is that same box plus one note, so the quickest way to learn it is to play the two back to back and notice only what is new.',
    instr: 'Up and down box 1 of the minor pentatonic, then up and down the same box with the 9th added (a whole step above each root, between the root and the ♭3 on the strings where it sits). Alternate the two twice. Pass: both versions twice in 8ths with the added notes in the right places.',
    watch: 'Adding the 9th on strings where it does not sit in this box.', simplify: 'The top three strings only.', tab: { notes }
  });
}
/** Root – 9th – ♭3 (and back to the 9th) on every string of box 1 that holds all three: the passing-tone figure. */
export function hexPass(c) {
  const k = minorKey(c), H = hexBox(k, 1); if (!H) return null;
  const B = byString(H.map(([s, f]) => ({ s, f }))), cells = [];
  for (const s of [6, 5, 4, 3, 2, 1]) {
    const fr = rel => (B[s] || []).find(f => mod12(pitch(s, f) - k) === rel);
    const r = fr(0), n = fr(2), t3 = fr(3);
    if (r != null && n != null && t3 != null) cells.push([[s, r], [s, n], [s, t3], [s, n]]);
  }
  if (cells.length < 2) return null;
  const order = [...cells, ...cells.slice(0, -1).reverse()], seq = order.flatMap(cl => [...cl, ...cl]);
  const notes = seq.map(([s, f], i) => N(s, f, i * 0.25, 0.25, i > 0 && seq[i - 1][0] === s && seq[i - 1][1] !== f ? (f > seq[i - 1][1] ? 'h' : 'p') : null));
  const t = endOf(notes), root = H.find(([s, f]) => s === 4 && mod12(pitch(s, f) - k) === 0) || H[0], bar = Math.ceil((t + 1) / 4) * 4; notes.push(N(root[0], root[1], t, bar - t, '~'));
  return make(c, {
    id: 'hex-pass', name: `Root – 9th – ♭3: the passing-tone figure on each string (${nameOf(k)} minor, box 1)`, domain: 'fretboard', method: 'accurate-reps', unit: '16th notes', goal: 84, start: 50, minutes: 5,
    backing: [nameOf(k) + 'm9'], chords: [nameOf(k) + 'm9'],
    why: 'The 9th earns its place as the passing tone between the root and the ♭3: three neighbouring notes that a plain minor pentatonic jumps across.',
    instr: 'On each string that holds all three, play root, 9th, ♭3, 9th twice, slurring notes on the same string (hammer up, pull off down), then move to the next string and come back. Pass: all the strings up and back in 16ths, even and clean.',
    watch: 'Letting the 9th ring into the ♭3.', simplify: 'Two strings only, in 8th notes.', tab: { notes }
  });
}
/** Groups of 3, 4, 5, 6 and 7 over steady 16ths, bar by bar (the group size changes on demand). */
export function hexSwitch(c) {
  const k = minorKey(c), sizes = [3, 4, 5, 6, 7, 4, 5, 3], notes = [];
  const grp = (l, n) => { const up = [], dn = [], r = l.slice().reverse(); for (let i = 0; i + n <= l.length; i++) up.push(...l.slice(i, i + n)); for (let i = 0; i + n <= r.length; i++) dn.push(...r.slice(i, i + n)); return [...up, ...dn]; };
  let last = null;
  sizes.forEach((g, bar) => { const list = hexBox(k, 1 + (bar % 2)); if (!list) return; last = list; grp(list, g).slice(0, 16).forEach(([s, f], i) => notes.push(N(s, f, bar * 4 + i * 0.25, 0.25))); });
  if (!last || notes.length < 100) return null;
  return make(c, {
    id: 'hex-groups-switch', name: `Groups of 3, 4, 5, 6 and 7 over steady 16ths (${nameOf(k)} minor hexatonic, boxes 1 and 2)`, domain: 'rhythm', method: 'variable', unit: '16th notes', goal: 92, start: 52, minutes: 6, dl: 1,
    backing: [nameOf(k) + 'm9'], chords: [nameOf(k) + 'm9'],
    why: 'Fast players change the grouping on demand while the 16ths never move. Bar by bar the size is 3, 4, 5, 6, 7, 4, 5, 3, in boxes 1 and 2 alternately, so the 9th lands in a new place each time.',
    instr: 'Every bar is sixteen 16th notes: play groups of the size shown (the tab shows each bar), ascending from the bottom of the box. Think 16th notes throughout and let the groups cross the beat. Pass: all eight bars at the goal tempo with the click never lost.',
    watch: 'Thinking the groups instead of the 16ths and drifting off the click.', simplify: 'Only groups of 4, 5 and 6.', tab: { notes }
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
/* --------------------------------- The path --------------------------------- */
const HX = 'The minor pentatonic with the 9th (a whole step above the root) added: R, 9, ♭3, 4, 5, ♭7. ';
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'hexatonic', kind: 'technique', title: 'Pentatonic plus the 9th', domain: 'fretboard',
  re: /hexatonic|added (2nd|9th|ninth)|pentatonic (\+|plus|with) (the )?(2|9|2nd|9th)/,
  aliases: ['minor hexatonic', 'pentatonic with the 9th', 'two pentatonics'],
  summary: 'The minor hexatonic (the minor pentatonic plus the 9th) and the pentatonic of the 5th inside it: from adding one note to a box you know to runs, groups of five and phrases that land on the 9th, in every box and key.',
  prereqs: ['pentatonic'],
  pedagogy: {
    date: '2026-10-22',
    summary: 'Taught from what the player already knows: the minor pentatonic box, with one note added (the 2nd, or 9th). Premier Guitar introduces it as a passing tone between the ♭3 and the root that also implies the 9th and 11th, then shows it in a line; the same sources build on it with groups of five, a second minor pentatonic from another degree of the scale over a static chord, and the shapes moved to the other positions and keys. There is no separate beginner drill sequence, so the order follows the pentatonic path it extends: the added note in one box, the other boxes, sequences, the second pentatonic, then three notes per string, groupings and displacement, and use in lines.',
    sequence: [
      { id: 'add', tier: 'foundations', step: 'Start from the pentatonic box and add the one note', how: 'Box 1 of the minor pentatonic is played first, then the same box with the 2nd (9th) added, first where it is easiest to see (the top strings).', skills: ['hex-find'], source: 3 },
      { id: 'passing', tier: 'foundations', step: 'The 9th as a passing tone between the root and the ♭3', how: 'The root–9th–♭3 figure, and the same phrase with and without the 9th, so the added note is heard in its usual job.', skills: ['hex-hear'], source: 0 },
      { id: 'box', tier: 'foundations', step: 'The whole box, then in groups', how: 'The box down with pull-offs and back up, in 3rds and in groups of three, so the 9th falls in different places.', skills: ['hex-shape'], source: 1 },
      { id: 'line', tier: 'foundations', step: 'A first line that uses it', how: 'Short lines in which the 9th is a passing or landing tone over a minor chord.', skills: ['hex-first-music'], source: 0 },
      { id: 'positions', tier: 'intermediate', step: 'The other positions, and across keys', how: 'The pattern repeats in every position of the pentatonic: the same added note is found in boxes 2 and 3, then boxes alternated.', skills: ['hex-boxes'], source: 3 },
      { id: 'groups', tier: 'intermediate', step: 'Groups of four, five and six', how: 'Groups of four and slurred groups of six, and groups of five (favoured by Eric Johnson) played as quintuplets first.', skills: ['hex-seq'], source: 1 },
      { id: 'multiple', tier: 'intermediate', step: 'A second pentatonic from another degree', how: 'The minor pentatonic built on the 5th of the key lies inside the hexatonic; over a static minor chord it adds the colour of the 9th and 11th.', skills: ['hex-pent5'], source: 0 },
      { id: 'music2', tier: 'intermediate', step: 'Runs and solos that land on the 9th, in four keys', how: 'The 9th as a held landing tone in 16th-note lines, and the shape moved through keys.', skills: ['hex-music'], source: 0 },
      { id: 'diag', tier: 'advanced', step: 'Three notes per string combined with the pentatonic shapes', how: 'The diagonal three-notes-per-string shape, with the fingering shifting between positions, and slurred fives down it.', skills: ['hex-diag'], source: 1 },
      { id: 'two', tier: 'advanced', step: 'Switching between the two pentatonics', how: 'The pentatonic of the key and of the 5th used in turn over the same chord; the boxes in a new order.', skills: ['hex-mix'], source: 0 },
      { id: 'displace', tier: 'advanced', step: 'Fives, quintuplets and displaced starts', how: 'Groups of five as quintuplets and over 16ths, and the same lick started on beat 3 instead of beat 1.', skills: ['hex-groups'], source: 1 },
      { id: 'music3', tier: 'advanced', step: 'Box 2 phrases and a Dorian vamp', how: 'Phrases in other positions, and the pentatonic with its added 2nd (and 6th) as Dorian over a vamp.', skills: ['hex-adv-music'], source: 3 },
      { id: 'tempo', tier: 'mastery', step: 'Performance tempo', how: 'Slurred groups down the diagonal and every box at speed, with the tempo raised in steps.', skills: ['hex-performance'], source: 2 },
      { id: 'any', tier: 'mastery', step: 'Any key, any box, any grouping', how: 'Switching the size of the group on demand while the 16ths stay steady (3, 4, 5, 6, 7); new keys and boxes without warning.', skills: ['hex-random-access'], source: 2 },
      { id: 'own', tier: 'mastery', step: 'Your own line', how: 'A study built from the path, then your own ideas in every pentatonic position.', skills: ['hex-voice'], source: 2 }
    ],
    drills: ['Box 1 of the minor pentatonic, then the same box with the 9th added', 'Root–9th–♭3 passing figure on each string', 'Box 1 and 2 in 3rds, groups of three, four and six', 'Groups of five as quintuplets, then over 16ths', 'The minor pentatonic on the 5th over the minor chord', 'Three notes per string combined with pentatonic shapes', 'The same lick started on beat 1 and on beat 3', 'Groups of 3, 4, 5, 6 and 7 over steady 16ths'],
    mistakes: ['Adding the 9th on strings where it does not sit in the box', 'Leaving the 9th out once the tempo rises', 'Treating the pentatonic on the 5th as a key change (the chord stays)', 'Thinking the groups instead of the 16ths and losing the click', 'Landing on the ♭3 by habit instead of choosing the 9th'],
    sources: [
      { title: 'Eric Johnson: Concepts and Techniques', author: 'Premier Guitar', url: 'https://www.premierguitar.com/eric-johnson-concepts-and-techniques' },
      { title: 'Beyond Blues: Eric Johnson vs. Joe Bonamassa', author: 'Premier Guitar', url: 'https://www.premierguitar.com/lessons/beyond-blues-eric-johnson-vs-joe-bonamassa' },
      { title: '5 guitar tricks you can learn from Eric Johnson', author: 'MusicRadar', url: 'https://www.musicradar.com/how-to/5-guitar-tricks-you-can-learn-from-eric-johnson-today' },
      { title: 'How to play Dorian mode with the pentatonic scale on the guitar', author: 'Dummies', url: 'https://dummies.com/article/how-to-play-dorian-mode-with-the-pentatonic-scale-on-the-guitar-154852' }
    ]
  },
  sources: ['https://www.premierguitar.com/eric-johnson-concepts-and-techniques', 'https://www.premierguitar.com/lessons/beyond-blues-eric-johnson-vs-joe-bonamassa', 'https://www.musicradar.com/how-to/5-guitar-tricks-you-can-learn-from-eric-johnson-today', 'https://dummies.com/article/how-to-play-dorian-mode-with-the-pentatonic-scale-on-the-guitar-154852'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Add one note to the box you know',
      'Play box 1 of the minor pentatonic and then the same box with the 9th added at 88 BPM in 8ths, the root–9th–♭3 figure on each string at 84 BPM in 16ths, the box in 3rds and in threes, and phrases that land on the 9th over a minor 9th chord.', [
        S('hex-find', 'Find the added note', 'fretboard', 'Where the 9th sits in box 1.', [
          H_('hex-top-slow', 'The 9th on the top strings: box 1, slowly ({key})', 'chunking', { strings: [3, 2, 1], step: 1, goal: 80, start: 50, why: HX + 'In box 1 it appears on the high e string, two frets above the root: start where it is easiest to see.', instr: 'Up and down the top three strings of box 1 in quarter notes. The 9th is the added note. Pass: up and down twice with no added wrong notes.', watch: 'Adding the 9th on strings where it isn’t in reach.', simplify: 'Only the high e string.' }),
          c => hexAdd(c)],
          ST('The hexatonic is the minor pentatonic box you already know plus one extra note: the 2nd, played an octave higher as the 9th. In box 1 it sits two frets above the root and one fret below the ♭3 on the strings where the box holds both.', 'Learning it as “my box plus one note” keeps the shape you trust and puts the new colour only where it is added.', ['Minor pentatonic: R ♭3 4 5 ♭7. Hexatonic: R 2 ♭3 4 5 ♭7.', 'The 2nd is the same note as the 9th, an octave lower.', 'The pattern repeats in every position, so the added note follows the box.'])),
        S('hex-hear', 'The passing tone', 'fretboard', 'The 9th between the root and the ♭3.', [c => hexCompare(c), c => hexPass(c)],
          ST('The 9th is most useful as a passing tone: a quick step from the root through the 9th to the ♭3, where a plain pentatonic would jump a minor third.', 'The passing tone is the first and most common use of the added note, and the reason the scale sounds smoother than the pentatonic.', ['Root to ♭3 is three frets; the 9th sits between them.', 'Slur the three notes on one string, then pick the next string.', 'Over a minor 9th chord the 9th is a chord tone, so it also works as a place to rest.'])),
        S('hex-shape', 'The whole box', 'fretboard', 'Down with pull-offs, in 3rds and in threes.', [c => ejAddedNotes(c),
          H_('hex-ring', 'Box 1 with the 9th in 3rds ({key})', 'variable', { strings: [4, 3, 2, 1], seq: 'thirds', step: 0.5, goal: 84, start: 50, why: 'Thirds skip every other scale note, so the 9th is played next to notes it does not normally touch, and the line sounds like a melody rather than a scale.', instr: 'Play the top four strings of box 1 in 3rds, up and down, in 8ths. Pass: up and down twice with the 9th in the right places.', watch: 'Losing the pattern at the string change.', simplify: 'Quarter notes.' }),
          H_('hex-threes-slow', 'Box 1 with the 9th in groups of 3 ({key})', 'variable', { seq: 'threes', step: 1 / 3, goal: 92, start: 50, why: 'In threes, the 9th falls in different places in the groups: the scale stops being a shape and starts being a melody.', instr: HX + 'Three up from each note, then three down, as triplets. Pass: up and down twice clean.', watch: 'Losing the group at the added note.', simplify: 'Ascending only.' })],
          ST('Once the added notes are found, the whole box is played down with pull-offs and back up, then in patterns (3rds, groups of three) that make the added note appear in changing places.', 'Patterns turn a scale shape into something close to a line, which is how the scale is used.', ['Pull-offs descend between notes on the same string; pick when the string changes.', 'Groups of three against triplets fall on the beat at the same note each time.'])),
        S('hex-first-music', 'First music', 'improv', 'Phrases that land on the 9th.', [c => hexPhrase(c, { level: 1 }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo over i–♭VI–♭VII: add the 9th to your pentatonic phrases' })],
          ST('Over a minor 9th chord the 9th is a chord tone. A phrase can climb to it and hold it with vibrato, then fall to the root.', 'Every stage ends in music: the added note is only worth knowing if you reach for it in a line.', ['The 9th is brighter than the root and less tense than the 4th.', 'Hold it with vibrato, then resolve to the root.']))
      ], [1, 3]),
    stage('intermediate', 'Every box, in groups, and the pentatonic of the 5th',
      'Play the hexatonic in boxes 2 and 3 and alternate boxes 1 and 2 at 100 BPM in 16ths, run it in fours, slurred sixes and groups of five, play the minor pentatonic on the 5th over the minor chord, change key every bar, and play 16th-note runs that land on the 9th.', [
        S('hex-boxes', 'Other boxes', 'fretboard', 'The 9th in boxes 2 and 3.', [
          H_('hex-box2', 'Box 2 with the 9th ({key})', 'variable', { boxes: [2], step: 0.25, goal: 100, why: HX + 'In box 2 the 9th falls on different strings and fingers.', instr: 'Up and down box 2 in 16ths. Pass: 4 clean at the goal tempo.', watch: 'The B-string shift.', simplify: '8th notes.' }),
          H_('hex-box3', 'Box 3 with the 9th ({key})', 'variable', { boxes: [3], step: 0.25, goal: 100, why: HX + 'Box 3 completes the middle of the neck.', instr: 'Up and down box 3 in 16ths. Pass: 4 clean at the goal tempo.', watch: 'Stretching for a 9th that sits outside the hand: shift instead.', simplify: '8th notes.' }),
          H_('hex-boxes12', 'Boxes 1 and 2 back to back ({key})', 'interleaving', { boxes: [1, 2, 1, 2], step: 0.25, goal: 96, why: 'Alternating boxes makes the added note a map across the neck, not a box-1 habit.', instr: HX + 'Box 1 up and down, box 2, box 1, box 2, without stopping. Pass: the cycle twice.', watch: 'Forgetting the 9th in box 2.', simplify: '8th notes.' })],
          ST('Every pentatonic position has its own hexatonic box: the 9th is added wherever it falls beside the box notes, a fret or two outside the box on some strings.', 'The shapes repeat, so learning the added note box by box turns it into a map of the neck.', ['Box 1 starts on the root on the low E string; each next box starts on the next scale note.', 'Where the 9th falls outside the hand, shift one fret rather than stretch.'])),
        S('hex-seq', 'Groups', 'picking', 'Fours, slurred sixes, and fives.', [
          H_('hex-fours', 'Box 1 with the 9th in groups of 4 ({key})', 'variable', { seq: 'fours', step: 0.25, goal: 100, why: 'Groups of four in 16ths give the run a downstroke on every beat and move the 9th through the beat.', instr: HX + 'Four up from each note, then down. Pass: 4 clean at the goal tempo.', watch: 'Rushing the last note of each group.', simplify: '8th notes.' }),
          H_('hex-sixes', 'Slurred sixes through box 1 with the 9th ({key})', 'variable', { seq: 'sixes', step: 1 / 6, legato: true, goal: 88, why: 'Slurred groups of six are the fluid sound of his runs; with the 9th in the scale they sound more open than plain pentatonic sixes.', instr: HX + 'Six from each note, one group per beat, slurring notes on the same string. Pass: 4 clean at the goal tempo.', watch: 'Weak pull-offs.', simplify: 'Triplets.' }),
          H_('hex-fives-q', 'Groups of five as quintuplets through box 1 ({key})', 'chunking', { seq: 'fives', step: 0.2, goal: 80, start: 48, why: 'Groups of five are one of the groupings Eric Johnson favours. Played as quintuplets, one group per beat, the five-note cell is felt before it is moved across the beat.', instr: HX + 'Five up from each note, then five down, one group per click (five notes per beat). Pass: 4 clean at the goal tempo with the first note of each group on the click.', watch: 'Squeezing the fifth note into a late four.', simplify: 'A few groups on one pair of strings.' })],
          ST('A sequence plays the scale in groups: fours, sixes, or fives. In fives, each group of five starts one scale note higher than the last.', 'Groups hide the scale shape and make the run sound like a line; fives are favoured in the Premier Guitar lesson for the sound and feel they give.', ['Quintuplet: five notes in one beat. Groups of five over 16ths realign every five beats.', 'Slurred sixes: pick the first note of each string, hammer and pull the rest.'])),
        S('hex-pent5', 'Two pentatonics', 'theory', 'The pentatonic on the 5th is the same sound.', [
          H_('hex-pent5', '{five} minor pentatonic over {key}m9: the pentatonic of the 5th', 'variable', { shape: 'pent5', step: 0.25, goal: 100, why: 'The minor pentatonic built on the 5th of the key (5, ♭7, R, 9, 4) lies entirely inside the hexatonic. Playing a familiar box from a new root gives the 9th and 11th sounds for free: one of Eric Johnson’s “multiple pentatonics”.', instr: 'Box 1 of {five} minor pentatonic, up and down in 16ths, over the minor 9th chord of the key. Pass: 4 clean at the goal tempo.', watch: 'Treating it as a key change: the chord stays the same.', simplify: '8th notes.' }),
          H_('hex-pent5-box2', 'Box 2 of {five} minor pentatonic in 3rds, over {key}m9', 'variable', { shape: 'pent5', boxes: [2], seq: 'thirds', step: 0.5, goal: 92, why: 'The second pentatonic has its own boxes; box 2 in 3rds is the same idea one position up.', instr: 'Box 2 of {five} minor pentatonic in 3rds, up and down in 8ths, over the minor 9th chord. Pass: up and down twice clean.', watch: 'Resting on the wrong chord: the chord stays the same.', simplify: 'Up only.' })],
          ST('Over a static minor chord, a minor pentatonic built on the 5th of the key adds the colour of the 9th and 11th while using a shape you already know. All its notes are inside the hexatonic.', 'It gives two sounds, plain and open, from the same scale, without learning a new shape.', ['In A minor: E minor pentatonic is E G A B D, all notes of the A hexatonic.', 'Its root is the chord’s 5th, its 4th is the chord’s 9th, its ♭7 is the chord’s 11th.', 'The 4th-degree pentatonic is the other “multiple pentatonic”, but it adds the ♭6, which the hexatonic does not contain.'])),
        S('hex-music', 'In music', 'improv', 'Runs that land on the 9th, in any key, and a solo.', [c => hexPhrase(c, { level: 2 }), c => targetGuide(c, { prog: 'progMinor', scale: 'minor', name: 'Solo over i–♭VI–♭III–♭VII: land on the 9th over every i chord' }),
          H_('hex-keys', 'The hexatonic in four keys around the cycle of fourths', 'interleaving', { keys: [0, 5, 10, 3], strings: [4, 3, 2, 1], step: 0.25, goal: 96, dl: 1, backing: false, why: 'The 9th is two frets above the root in every key: changing key every bar trains finding it immediately.', instr: HX + 'The top four strings of box 1, up and down, one key per bar, a 4th up each time. Pass: all four without stopping.', watch: 'Forgetting the 9th in the new key.', simplify: 'Two keys.' })],
          ST('Phrases in 16ths run to the 9th and hold it, then fall to the root. The same shape in other keys is the same fingering moved.', 'It carries the sound out of the exercise and into any key.', ['The 9th is a whole step above the root in every key.', 'Landing on the 9th sounds open; landing on the root sounds finished.']))
      ], [4, 6]),
    stage('advanced', 'Across the neck',
      'Play the diagonal three-notes-per-string hexatonic up and down at 100 BPM and in slurred fives, alternate the pentatonics of the key and of the 5th, play the boxes in a new order, play groups of five as quintuplets and over 16ths and start a lick on beat 3, and phrase in box 2 over a Dorian vamp.', [
        S('hex-diag', 'The diagonal', 'fretboard', 'Three notes per string across the neck.', [
          H_('hex-diag', 'The diagonal hexatonic: three notes per string ({key})', 'variable', { shape: 'diag', step: 0.25, goal: 100, why: 'With six notes in the scale, three per string fit exactly: two strings hold one octave, and the shape climbs diagonally across two boxes.', instr: HX + 'Up and down the diagonal in 16ths, shifting position with the index finger. Pass: 4 clean at the goal tempo.', watch: 'Uneven stretches.', simplify: '8th notes.' }),
          H_('hex-diag-fives', 'Slurred fives down the diagonal ({key})', 'variable', { shape: 'diag', seq: 'fives', step: 0.25, legato: true, goal: 96, why: 'Rolling fives on the diagonal hexatonic: the cascading Eric Johnson run with his brighter scale.', instr: HX + 'Five from each note, slurred, in 16ths. Pass: 4 clean at the goal tempo.', watch: 'Losing the group at the shifts.', simplify: 'Quintuplets.' })],
          ST('Three notes on every string is a different map of the same scale: the fingering shifts position between the strings, so the hexatonic runs diagonally across the neck.', 'It is the hexatonic equivalent of the three-notes-per-string shapes Eric Johnson combines with his pentatonic shapes.', ['Six notes in the scale make an exact fit: three per string, two strings per octave.', 'Shift with the index finger so the hand arrives ready on the next string.'])),
        S('hex-mix', 'Switching pentatonics', 'fretboard', 'Two colours; boxes in a new order.', [
          H_('hex-two-pents', 'Two pentatonics, alternating: {key} and {five} minor', 'interleaving', { boxes: [1, 1, 2, 2], alt: true, step: 0.25, goal: 96, why: 'Switching between the pentatonic of the key and the pentatonic of the 5th every block changes the colour (bluesy, then open) while the chord stays the same: two sounds from one scale.', instr: 'Box 1 of the key’s pentatonic, box 1 of the pentatonic on the 5th, then box 2 of each, up and down in 16ths. Pass: the four blocks without stopping.', watch: 'Mixing the two shapes.', simplify: '8th notes.' }),
          H_('hex-boxes-called', 'Boxes in a new order: 3, 1, 4, 2, 5 ({key})', 'interleaving', { boxes: [3, 1, 4, 2, 5], strings: [4, 3, 2, 1], step: 0.25, goal: 96, why: 'Jumping between boxes out of order makes the added note a map of the whole neck, not a sequence you know in a row.', instr: HX + 'The top four strings of boxes 3, 1, 4, 2, 5, up and down each, without stopping. Pass: all five without a wrong note at the goal tempo.', watch: 'Leaving the 9th out.', simplify: 'Boxes 1–3.' })],
          ST('Using the pentatonic of the key and the pentatonic of the 5th one after the other changes the colour while the chord stays the same.', 'It is the practical form of the “multiple pentatonics” idea: two sounds from one hexatonic.', ['Both pentatonics lie inside the hexatonic.', 'The switch can happen mid-phrase: in the Premier Guitar line, the second pentatonic covers beats two to four.'])),
        S('hex-groups', 'Fives and displacement', 'rhythm', 'Groups of five and a lick started on beat 3.', [
          H_('hex-fives-box2', 'Box 2 with the 9th in groups of 5, as quintuplets ({key})', 'chunking', { boxes: [2], seq: 'fives', step: 0.2, goal: 88, start: 52, why: 'Fives as quintuplets in a second position: the cell is the same, the fingers are not.', instr: HX + 'Five up from each note, then five down, one group per click. Pass: 4 clean at the goal tempo.', watch: 'The group collapsing into four.', simplify: 'Box 1.' }),
          H_('hex-fives-16', 'Box 1 in groups of 5 over steady 16ths ({key})', 'variable', { seq: 'fives', step: 0.25, goal: 100, why: 'Five notes against four per beat: the group starts on a different part of the beat each time and comes back after five beats.', instr: HX + 'Five up from each note, then five down, in steady 16ths. Think 16th notes, not five. Pass: 4 clean at the goal tempo.', watch: 'Turning it into quintuplets by accident.', simplify: 'Quintuplets first.' }),
          H_('hex-displaced', 'The same lick started on beat 3 ({key})', 'variable', { seq: 'fours', step: 0.25, lead: 2, goal: 100, why: 'Starting a lick on a different beat changes how it feels without changing a single note; two beats of rest, then the lick.', instr: HX + 'Wait two beats, then play fours up and down box 1 in 16ths. Then play it again starting on beat 1. Pass: both starts clean at the goal tempo.', watch: 'Rushing the entrance.', simplify: '8th notes.' })],
          ST('A five-note group in 16ths cycles against the beat; the same lick started on beat 1 or on beat 3 feels different.', 'Displacement and fives keep a repeated figure from sounding square, a habit of Eric Johnson’s phrasing.', ['Groups of five realign with the beat every five beats.', 'Offset by an 8th or 16th to find new feels; count the beat, not the group.'])),
        S('hex-adv-music', 'In music', 'improv', 'Box 2 phrases, and a Dorian vamp.', [c => hexPhrase(c, { level: 3 }), c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp solo: the hexatonic with the 9th as the colour note' })],
          ST('Over a one-chord vamp, the hexatonic is the minor pentatonic with its added 2nd; adding the major 6th as well gives Dorian.', 'Dorian is the next step of the same idea: from five notes, to six, to seven.', ['Dorian = minor pentatonic + 2nd + major 6th.', 'Moving the shape up two frets gives the next key.']))
      ], [7, 8]),
    stage('mastery', 'Fast, anywhere and your own',
      'Play slurred sixes down the diagonal at about 110 BPM and all five boxes in 16ths at 115, change the group size (3 to 7) every bar over steady 16ths, any key and box on demand, and perform your own 8-bar hexatonic piece.', [
        S('hex-performance', 'Performance tempo', 'picking', 'At speed.', [
          H_('hex-diag-sixes-fast', 'Slurred sixes down the diagonal at performance tempo ({key})', 'edge', { shape: 'diag', seq: 'sixes', step: 1 / 6, legato: true, goal: 96, why: 'The signature run with the brighter scale, at tempo.', instr: HX + 'Sixes from each note, one group per beat, slurred. Tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'Forearm tension.', simplify: '16ths.' }),
          H_('hex-all-boxes', 'All five boxes with the 9th at performance tempo ({key})', 'edge', { boxes: [1, 2, 3, 4, 5], step: 0.25, goal: 100, why: 'The whole neck with the added note, at tempo.', instr: HX + 'Each box up and down, 1 to 5, without stopping. Tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'Boxes 4 and 5.', simplify: 'Boxes 1–3.' })],
          ST('At performance tempo the hexatonic is played in groups, slurred where the string allows, with the tempo raised in small steps.', 'Speed with clean notes is what the earlier stages were building.', ['Raise the tempo in small steps once the previous one is clean.', 'Tension in the forearm is the first sign you have gone too fast.'])),
        S('hex-random-access', 'Any key, any box, any group', 'fretboard', 'No warning.', [c => hexRandom(c), c => hexSwitch(c), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: pentatonic runs with the 9th as the surprise note' })],
          ST('Switching the size of the group on demand (3, 4, 5, 6, 7) while the 16ths stay steady, and changing key and box without warning, is the last step of fluency.', 'It ensures the technique works in real playing, where the next idea is not planned.', ['Think 16th notes throughout; the group size only changes where the accent falls.', 'The 9th is two frets above the root in every key.'])),
        S('hex-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => hexEtude(c), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo in his spirit: pentatonic runs brightened by the 9th' })],
          ST('A short study combines the path: the scale in 3rds, fours in box 2, the pentatonic of the 5th, slurred sixes down the diagonal, then a held 9th before the final root.', 'Writing your own version of the plan is how the technique becomes part of your playing.', ['Plan: 3rds, fours, second pentatonic, sixes, held 9th, root.', 'Build your own ideas in every pentatonic position.']))
      ], [9, 10])
  ]
});
