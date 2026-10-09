// Slides: moving a fretted note along the string without lifting the finger, to join two notes in
// one sound (a legato slide), to change position (a shift slide), to decorate a target (sliding into
// it) or to let a note fall away (sliding out). From the first two-note slide on one string to
// sliding 6ths and fast position-shifting runs, the vocal glue of blues, rock and fusion lines
// (Guthrie Govan, Gilmour, Hendrix, SRV).
//
// Concept-first (CONTENT.md): the model is a scale laid out along one string (`along()`: the frets of
// a scale's tones on a string, found from the key, so the slides are right in every key), the five
// pentatonic boxes as windows on that line (`boxOn()`: each box holds two neighbouring tones of the
// line, so moving from one box to the next is a slide along the string), the degrees of every tone,
// and the slide kinds (legato, shift, into, out, long, double-stop). The composer `slideRun(c, spec)`
// builds an exercise from scale × strings × which tones (moves between neighbours, chord tones,
// degrees) × kind × note value × keys; phrases are written in degrees with a box for each note.
import { OPEN, N, nameOf, minorKey, make, pentBox, byString, mod12, SCALE_BY_ID, S, stage, entry, M, targetGuide } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const DEG = { 0: 'R', 2: '2', 3: '♭3', 5: '4', 7: '5', 8: '♭6', 9: '6', 10: '♭7' };
const STR = { 1: 'high e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'low E' };
const SCN = { minorPent: 'minor pentatonic', dorian: 'Dorian', minor: 'natural minor' };
const pcsOf = (k, scale) => SCALE_BY_ID[scale].steps.map(x => mod12(k + x));
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes']]);
const unitName = step => UNIT.get(step) || '8th notes';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** The frets of a scale's tones along string s, from fret lo to hi. */
export function along(k, s, scale = 'minorPent', lo = 1, hi = 20) { const pcs = pcsOf(k, scale), out = []; for (let f = lo; f <= hi; f++) if (pcs.includes(mod12(pitch(s, f)))) out.push(f); return out; }
/**
 * The two frets of pentatonic box b on string s, as neighbouring tones of the scale along the string:
 * box 1 is where the root sits on the low E string, box 2 starts on box 1's upper note, and so on, so
 * boxes always climb the string in order. Box 0 is box 5 an octave lower (below box 1), for keys
 * where box 5 runs off the top of the neck. Returns null when the box doesn't fit (frets 0–22).
 */
export function boxOn(k, b, s) {
  const B1 = byString(pentBox(k, 1)); if (!B1[s]) return null;
  const L = along(k, s, 'minorPent', 0, 22), i0 = L.indexOf(B1[s][0]); if (i0 < 0) return null;
  const a = i0 + b - 1; return a >= 0 && a + 1 < L.length ? [L[a], L[a + 1]] : null;
}
/** Five boxes in climbing order that fit on the neck in this key: 1–5, or 5 (an octave down) and 1–4. */
export function chainBoxes(k) {
  const fits = b => [3, 2, 1].every(s => boxOn(k, b, s));
  return [1, 2, 3, 4, 5].every(fits) ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4].every(fits) ? [0, 1, 2, 3, 4] : null;
}
const boxName = b => (b === 0 ? '5 (an octave down)' : String(b));
/** Slide mark for moving from fret a to fret b on one string. */
const mark = (a, b) => (b > a ? '/' : '\\');
const degOf = (k, s, f) => DEG[mod12(pitch(s, f) - k)] || '?';
/** The tones of the scale on string s around the root: from the first root at fret ≥ 2 up `n` tones. */
function fromRoot(k, s, scale, n) { const l = along(k, s, scale, 2, 22), i = l.findIndex(f => mod12(pitch(s, f) - k) === 0); const out = l.slice(Math.max(0, i), Math.max(0, i) + n); return out.length >= n ? out : l.slice(-n); }

/** Move a whole line up an octave when a slide would start or end on an open string (it can't). */
export function liftOpen(notes) {
  const bad = notes.some((n, i) => (n.x === '/' || n.x === '\\') && (n.f < 1 || (notes.slice(0, i).reverse().find(m => m.s === n.s) || {}).f < 1));
  return bad && Math.max(...notes.map(n => n.f)) + 12 <= 22 ? notes.map(n => ({ ...n, f: n.f + 12 })) : notes;
}

/* ------------------------------- The composer ------------------------------- */
/**
 * One slide exercise from a spec: { id, name ('{key}', '{string}', '{scale}'), method, scale, string,
 * n (tones along the string from the root), kind ('pair': pick, slide up, slide back · 'shift': pick,
 * slide, pick again · 'walk': up the string sliding every other note · 'into': slide into each tone
 * from the tone below · 'out': hold, then fall to the tone below · 'long': root ↔ 5th and other
 * wide slides), step, keys, goal, start, dl, domain, why, instr, watch, simplify }.
 */
export function slideRun(c, spec) {
  const k0 = minorKey(c), s = spec.string || 3, scale = spec.scale || 'minorPent', step = spec.step || 0.5, notes = []; let t = 0;
  for (const off of spec.keys || [0]) {
    const k = mod12(k0 + off), l = fromRoot(k, s, scale, spec.n || 6); if (l.length < 3) return null;
    const put = (f, d, x) => { notes.push(N(s, f, t, d, x || null)); t += d; };
    switch (spec.kind || 'pair') {
      case 'pair': for (let i = 0; i + 1 < l.length; i++) { put(l[i], step); put(l[i + 1], step, '/'); put(l[i], step, '\\'); t += step; } break;
      case 'shift': for (let i = 0; i + 1 < l.length; i++) { put(l[i], step); put(l[i + 1], step, '/'); } for (let i = l.length - 1; i > 0; i--) { put(l[i], step); put(l[i - 1], step, '\\'); } break;
      case 'walk': { const seq = [...l, ...l.slice(0, -1).reverse()]; seq.forEach((f, i) => put(f, step, i && i % 2 ? mark(seq[i - 1], f) : null)); break; }
      case 'into': for (let i = 1; i < l.length; i++) { put(l[i - 1], step / 2); put(l[i], step * 1.5, '/'); } break;
      case 'out': for (let i = l.length - 1; i > 0; i--) { put(l[i], step * 1.5, '~'); put(l[i - 1], step / 2, '\\'); } break;
      case 'long': { const r = l[0], hiR = l.find(f => f > r && mod12(pitch(s, f) - k) === 7) || l[l.length - 1]; for (let i = 0; i < 2; i++) { put(r, 1); put(hiR, 1, '/'); put(hiR, 1, '~'); put(r, 1, '\\'); } break; }
      default: return null;
    }
  }
  const k0l = fromRoot(k0, s, scale, spec.n || 6);
  notes.push(N(s, k0l[0], t, Math.ceil((t + 1) / 4) * 4 - t, '~'));
  const fill = x => x.replace('{key}', `${nameOf(k0)} ${SCN[scale]}`).replace('{string}', `the ${STR[s]} string`).replace('{scale}', SCN[scale]);
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretting', method: spec.method, unit: spec.unit || unitName(step), goal: spec.goal || 92, start: spec.start, minutes: spec.minutes || 4, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes: liftOpen(notes) }
  });
}
const R_ = (id, name, method, opts) => c => slideRun(c, { id, name, method, ...opts });

/* --------------------------- Existing lessons (kept ids) --------------------------- */
/** Slides between neighbouring pentatonic boxes a and b on the top three strings. */
export function slideBoxes(c, { a = 1, b = 2 } = {}) {
  const key = minorKey(c), notes = []; let t = 0;
  const A = s => boxOn(key, a, s), B = s => boxOn(key, b, s);
  if ([1, 2, 3].some(s => !A(s) || !B(s) || B(s)[1] <= A(s)[1])) return null;
  for (const s of [3, 2, 1]) { const [lo, hi] = A(s), top = B(s)[1]; [[lo, 0.5], [hi, 0.5], [top, 1, '/'], [hi, 1, '\\'], [lo, 1]].forEach(([f, d, x]) => { notes.push(N(s, f, t, d, x)); t += d; }); }
  for (const s of [1, 2, 3]) { const [lo, hi] = A(s), top = B(s)[1]; [[top, 1], [hi, 1, '\\'], [lo, 1], [hi, 1, '/']].forEach(([f, d, x]) => { notes.push(N(s, f, t, d, x)); t += d; }); }
  const k = nameOf(key), first = a === 1 && b === 2;
  return make(c, {
    id: `slides-box${a}-${b}`, name: `Slides between boxes ${a} and ${b} (${k} minor pentatonic, top strings)`, domain: 'fretting', method: 'variable', unit: '8th notes', goal: 100, start: 56, minutes: 5, dl: first ? 0 : 1,
    why: `A slide joins two notes with one pick stroke and moves the hand to a new position at the same time: it is how players connect pentatonic boxes${first ? '' : ` (here box ${a} into box ${b})`} and make a line sing instead of stepping note to note.`,
    instr: `Bars 1–3: on the G, B and high e strings, play the two box-${a} notes, then slide the ring finger up to the box-${b} note (/) without picking again, slide back (\\) and pick the low note. Bars 4–6 come down from box ${b}. Keep pressure on the string the whole way so the note never dies, and arrive exactly on the beat. Pass: every slide lands in tune and on time.`,
    watch: 'Easing off the string during the slide (the note fades) or overshooting the target fret.', simplify: 'Pick the target note again when you arrive (a shift slide) at half tempo.', tab: { notes: liftOpen(notes) }
  });
}
/** The minor pentatonic (or another scale) along one string, joined by slides: horizontal playing. */
export function slideOneString(c, { string = 2, scale = 'minorPent' } = {}) {
  const key = minorKey(c), up = along(key, string, scale, 1, 17).slice(0, 8); if (up.length < 6) return null;
  const fast = (c.lvl || 4) >= 5, step = fast ? 0.5 : 1;
  const seq = [...up.map((f, i) => [string, f, i % 2 ? '/' : null]), ...up.slice().reverse().map((f, i) => [string, f, i % 2 ? '\\' : null])];
  const k = nameOf(key), pent = scale === 'minorPent';
  return make(c, {
    id: `slides-one-string-${string}${pent ? '' : '-' + scale}`, name: `${k} ${SCN[scale]} along the ${STR[string]} string, with slides`, domain: 'fretboard', method: pent && string === 2 ? 'retrieval' : 'variable',
    unit: fast ? '8th notes' : 'quarter notes', goal: fast ? 84 : 96, start: 50, minutes: 5, dl: pent ? 0 : 1,
    why: pent ? 'Playing a scale up one string shows how the boxes connect horizontally and trains the slide as a way to change position. You hear the notes of the scale as distances on a single string.'
      : 'Dorian on one string adds the 2 and the bright 6 between the pentatonic notes: the slides get shorter (whole and half steps), and you hear exactly where the two extra notes sit.',
    instr: `Start at fret ${up[0]}. Pick a note, slide (/) to the next scale note with the same finger, pick the next, slide again, all the way up to fret ${up[up.length - 1]}; then come back down the same way (\\). Say the scale degree of each note you land on (${pent ? 'R, ♭3, 4, 5, ♭7' : 'R, 2, ♭3, 4, 5, 6, ♭7'}). Pass: two clean trips with every slide landing on the beat.`,
    watch: 'Looking at the fretboard so long that the slide arrives late.', simplify: 'Pick every note, no slides, until the frets are memorized.', tab: { notes: seq.map(([s, f, x], i) => N(s, f, i * step, step, x)) }
  });
}

/* ------------------------------- Generators ------------------------------- */
/** Hear the target, sing it, then slide into it from the scale tone below (hear it first). */
export function slideHear(c) {
  const k = minorKey(c), notes = []; let t = 0;
  for (const s of [3, 2, 1]) {
    const B = boxOn(k, 2, s), A = boxOn(k, 1, s); if (!A || !B) return null;
    const target = B[1], from = A[1];
    notes.push(N(s, target, t, 1)); t += 2;                         // hear it (then sing it in the gap)
    notes.push(N(s, from, t, 0.5), N(s, target, t + 0.5, 1.5, '/')); t += 2;
  }
  return make(c, {
    id: 'slides-hear', name: `Hear it, sing it, slide to it (${nameOf(k)} minor pentatonic, boxes 1 → 2)`, domain: 'ear', method: 'audiation',
    unit: 'half notes', goal: 72, start: 50, minutes: 4,
    why: 'A slide is only as good as where it stops. Hearing the target first and singing it gives the ear a goal, so the finger stops on pitch instead of on a guess.',
    instr: 'On each of the top three strings: play the box-2 target note and let it ring; in the silent beat, sing it; then pick the box-1 note below it and slide up to the target. If the slide lands sharp or flat of the note you sang, repeat. Pass: all three slides land exactly on the sung pitch, twice.',
    watch: 'Stopping the slide by sight instead of by ear.', simplify: 'The G string only.', tab: { notes: liftOpen(notes) }
  });
}
/** Whole tones slid into from below and allowed to bloom, chord tones of i on the top strings (focus on the sound). */
export function slideInto(c) {
  const k = minorKey(c), chord = [0, 3, 7], notes = []; let t = 0;
  for (const s of [3, 2, 1, 2, 3]) {
    const l = along(k, s, 'minorPent', 3, 17), i = l.findIndex(f => chord.includes(mod12(pitch(s, f) - k)) && l.indexOf(f) > 0); if (i < 1) return null;
    notes.push(N(s, l[i - 1], t, 0.25), N(s, l[i], t + 0.25, 1.75, '/')); t += 2;
  }
  notes.push(N(4, (along(k, 4, 'minorPent', 2, 17).find(f => mod12(pitch(4, f) - k) === 0)) || 5, t, 2, '~'));
  return make(c, {
    id: 'slides-into', name: `Sliding into chord tones: let the target bloom (${nameOf(k)}m)`, domain: 'fretting', method: 'external-focus',
    unit: 'half notes', goal: 80, start: 50, minutes: 4, backing: [nameOf(k) + 'm'], chords: [nameOf(k) + 'm'],
    why: 'Sliding into a note from just below gives it a vocal attack: the listener hears the target arrive, not the note you started on. The skill is in the sound: a quick, light start and a full, ringing target.',
    instr: 'For each chord tone (root, ♭3 or 5 of the chord), pick the scale note just below it with light pressure while already moving, and land on the target with full pressure, letting it ring for the rest of the beat. Listen: the start should be a blur, the target clear. Pass: five targets in a row that ring at full volume after the slide.',
    watch: 'The starting note lasting too long, so it sounds like two notes.', simplify: 'Pick the target again on arrival.', tab: { notes: liftOpen(notes) }
  });
}
/** Slide from the root to named degrees along the B string and back, from memory (retrieval). */
export function slideDegrees(c) {
  const k = minorKey(c), s = 2, l = fromRoot(k, s, 'minorPent', 6), notes = [], names = []; let t = 0;
  for (const j of [2, 1, 4, 3, 5]) { const f = l[j]; if (f == null) return null; notes.push(N(s, l[0], t, 1), N(s, f, t + 1, 1, '/'), N(s, f, t + 2, 1, '~'), N(s, l[0], t + 3, 1, '\\')); names.push(degOf(k, s, f)); t += 4; }
  return make(c, {
    id: 'slides-degrees', name: `Slide to the degree: from the root along the B string (${nameOf(k)} minor pentatonic)`, domain: 'fretboard', method: 'retrieval',
    unit: 'quarter notes', goal: 84, start: 50, minutes: 4,
    why: 'Knowing how far each degree is from the root on one string (a minor 3rd is 3 frets, a 4th is 5, a 5th is 7) lets you slide to a chosen note instead of hoping. Recalling the distance by degree name builds that map.',
    instr: `From the root on the B string, slide to the ${names.join(', then the ')}, each time holding it with vibrato and sliding back. Cover the tab: say the degree and its distance in frets before each slide. Pass: all five from memory, landing on pitch.`,
    watch: 'Counting frets with your eyes: feel the distance.', simplify: 'Only the ♭3, 4 and 5.', tab: { notes: liftOpen(notes) }
  });
}
/** Through all five boxes on the G and B strings: two notes on each string, then a shift slide into the next box (interleaving). */
export function boxChain(c) {
  const k = minorKey(c), chain = chainBoxes(k), notes = []; let t = 0; if (!chain) return null;
  for (const [i, b] of chain.entries()) {
    const G = boxOn(k, b, 3), B = boxOn(k, b, 2), Bn = i < 4 ? boxOn(k, chain[i + 1], 2) : null; if (!G || !B) return null;
    [[3, G[0]], [3, G[1]], [2, B[0]], [2, B[1]]].forEach(([s, f]) => { notes.push(N(s, f, t, 0.5)); t += 0.5; });
    if (Bn) { if (Bn[1] <= B[1]) return null; notes.push(N(2, Bn[1], t, 1, '/')); t += 1; notes.push(N(2, B[1], t, 1, '\\')); t += 1; }
  }
  notes.push(N(2, boxOn(k, chain[4], 2)[1], t, 2, '~'));
  return make(c, {
    id: 'slides-box-chain', name: `Through all five boxes with shift slides (${nameOf(k)} minor pentatonic, G and B strings)`, domain: 'fretboard', method: 'interleaving',
    unit: '8th notes', goal: 92, start: 54, minutes: 5, dl: 1,
    why: 'The five boxes are windows on one long scale. Sliding out of each box into the next, then back, makes you switch shapes every bar: the boxes stop being separate places and become one neck.',
    instr: `In each box: the two G-string notes and the two B-string notes, then slide up the B string to the next box’s note and back. Boxes ${chain.map(boxName).join(', ')} without stopping. Pass: the whole chain twice in time.`,
    watch: 'Losing the box shape after the slide back.', simplify: 'Boxes 1–3.', tab: { notes: liftOpen(notes) }
  });
}
/** Diatonic 6ths on the G and high e strings, slid from one to the next (variable). */
export function slideSixths(c, { scale = 'dorian', fast = false } = {}) {
  const k = minorKey(c), pcs = pcsOf(k, scale), pairs = [];
  for (let f = 1; f <= 19; f++) { const lo = pitch(3, f); if (!pcs.includes(mod12(lo))) continue; let q = lo, n = 0; while (n < 5) { q++; if (pcs.includes(mod12(q))) n++; } const hi = q - OPEN[1]; if (hi >= 1 && hi <= 20 && Math.abs(hi - f) <= 3) pairs.push([f, hi]); }
  const ris = pairs.map((p, i) => i).filter(i => mod12(pitch(3, pairs[i][0]) - k) === 0 && pairs.length - i >= 6);
  const use = ris.length ? pairs.slice(ris[0], ris[0] + 6) : pairs.slice(-6); if (use.length < 5) return null;
  const step = fast ? 0.5 : 1, seq = [...use, ...use.slice(0, -1).reverse()], notes = []; let t = 0;
  seq.forEach(([a, b], i) => { const x = i ? mark(seq[i - 1][0], a) : null; notes.push(N(3, a, t, step, x, { chord: true }), N(1, b, t, step, x, { chord: true })); t += step; });
  notes.push(N(3, use[0][0], t, 2, '~', { chord: true }), N(1, use[0][1], t, 2, '~', { chord: true }));
  return make(c, {
    id: fast ? 'slides-sixths-fast' : `slides-sixths${scale === 'dorian' ? '' : '-' + scale}`, name: `Sliding 6ths on the G and high e strings${fast ? ', at tempo' : ''} (${nameOf(k)} ${SCN[scale]})`, domain: 'fretting', method: fast ? 'edge' : 'variable',
    unit: unitName(step), goal: fast ? 100 : 84, start: 50, minutes: 5, dl: fast ? 1 : 0,
    why: 'Two fingers sliding together from one diatonic 6th to the next is a soul, country and fusion sound (Govan slides 6ths through whole melodies). Both notes must move as one and land together.',
    instr: `Fret each 6th with two fingers (G string and high e, the B string muted underneath), pick both, and slide the shape to the next 6th of the scale without lifting. Up the scale and back.${fast ? ' Tempo ladder to the goal.' : ''} Pass: up and back with both notes arriving together every time.`,
    watch: 'One finger arriving before the other.', simplify: 'Pick every 6th instead of sliding.', tab: { notes: liftOpen(notes) }
  });
}
/** A pentatonic run up the B and high e strings: two notes on each, sliding up to shift position (variable). */
export function slideRuns(c, { fast = false } = {}) {
  const k = minorKey(c), B = along(k, 2, 'minorPent', 1, 22), E = along(k, 1, 'minorPent', 1, 22);
  const okAt = d => B.map((f, i) => i).filter(i => mod12(pitch(2, B[i]) - k) === d && B.length - i >= 8);
  const cand = [...okAt(0), ...okAt(7), 0]; const bi = cand[0];
  const notes = []; let t = 0; const step = fast ? 0.25 : 1 / 3;
  for (let i = bi; i + 1 < B.length && i < bi + 5; i++) {
    const e0 = E.find(f => pitch(1, f) > pitch(2, B[i + 1])); if (e0 == null) break; const ei = E.indexOf(e0); if (ei + 1 >= E.length) break;
    [[2, B[i], null], [2, B[i + 1], '/'], [1, E[ei], null], [1, E[ei + 1], '/'], [1, E[ei], '\\'], [2, B[i + 1], null]].forEach(([s, f, x]) => { notes.push(N(s, f, t, step, x)); t += step; });
  }
  if (notes.length < 18) return null;
  notes.push(N(1, notes[notes.length - 3].f, t, 2, '~'));
  return make(c, {
    id: fast ? 'slides-runs-fast' : 'slides-runs', name: `Sliding runs up the neck on the top two strings${fast ? ', at tempo' : ''} (${nameOf(k)} minor pentatonic)`, domain: 'fretting', method: fast ? 'edge' : 'variable',
    unit: unitName(step), goal: fast ? 104 : 96, start: 52, minutes: 5, dl: fast ? 1 : 0,
    why: 'Sliding up a string on every second note moves the hand up the neck inside a fast line, so a run can travel two octaves without a single visible position shift: the fluid horizontal runs of fusion and blues-rock players.',
    instr: `Each group of six: a note on the B string and a slide up to the next, the same on the high e, slide back, then the B-string note again. Each group starts one scale note higher.${fast ? ' Tempo ladder to the goal.' : ''} Pass: the whole climb clean twice, every slide landing on its note.`,
    watch: 'The slid notes coming out quieter than the picked ones.', simplify: 'The B string only.', tab: { notes: liftOpen(notes) }
  });
}
/** Box 1 → box 2 slides on one string, in four keys around the cycle of fourths (interleaving). */
export function slideKeys(c) {
  const k0 = minorKey(c), notes = [], names = []; let t = 0;
  for (const off of [0, 5, 10, 3]) {
    const k = mod12(k0 + off);
    for (const s of [3, 2]) { const A = boxOn(k, 1, s), B = boxOn(k, 2, s); if (!A || !B || B[1] <= A[1]) return null; [[A[0], 0.5], [A[1], 0.5], [B[1], 0.5, '/'], [A[1], 0.5, '\\']].forEach(([f, d, x]) => { notes.push(N(s, f, t, d, x || null)); t += d; }); }
    names.push(nameOf(k) + 'm');
  }
  notes.push(N(2, boxOn(mod12(k0 + 3), 1, 2)[0], t, 4, '~'));
  return make(c, {
    id: 'slides-keys', name: `Box-joining slides in four keys: ${names.join(', ')}`, domain: 'fretboard', method: 'interleaving',
    unit: '8th notes', goal: 96, start: 54, minutes: 5, dl: 1,
    why: 'The slide between box 1 and box 2 is a shape, so it works in every key. Changing key every bar trains you to find it at once wherever box 1 sits.',
    instr: `${names.join(' → ')}: on the G string then the B string, the two box-1 notes, a slide up into box 2 and back. Name the key before each bar. Pass: all four keys without stopping.`,
    watch: 'Sliding to the wrong fret in the new key: look one beat ahead.', simplify: 'Two keys.', tab: { notes: liftOpen(notes) }
  });
}
/** Long slides between boxes called out of order on the B string (retrieval). */
export function boxesCalled(c) {
  const k = minorKey(c), chain = chainBoxes(k); if (!chain) return null; const order = [3, 1, 4, 2, 5, 1].map(b => chain[b - 1]), notes = []; let t = 0;
  for (const [i, b] of order.entries()) {
    const B = boxOn(k, b, 2); if (!B) return null;
    if (i) notes.push(N(2, B[1], t, 1, mark(notes[notes.length - 1].f, B[1])));
    else notes.push(N(2, B[1], t, 1));
    notes.push(N(2, B[0], t + 1, 1), N(2, B[1], t + 2, 2, '~')); t += 4;
  }
  return make(c, {
    id: 'slides-boxes-called', name: `Long slides between boxes called out of order (${nameOf(k)} minor pentatonic, B string)`, domain: 'fretboard', method: 'retrieval',
    unit: 'quarter notes', goal: 84, start: 50, minutes: 4, dl: 1,
    why: 'A long slide jumps the hand across several boxes in one gesture. Calling the boxes out of order means you must know where each one sits on the string before you leave, which is what makes long slides land.',
    instr: `Boxes ${order.map(boxName).join(', ')}: slide along the B string into the upper note of each box, play its lower note, return to the upper and hold with vibrato. Cover the tab. Pass: all six from memory, every slide arriving on pitch.`,
    watch: 'Stopping short on the long slides.', simplify: 'Neighbouring boxes only.', tab: { notes: liftOpen(notes) }
  });
}
/** Slow, vocal slides with vibrato on arrival over a slow progression (focus on the sound). */
export function vocalSlides(c) {
  const k = minorKey(c), notes = []; let t = 0;
  for (const s of [2, 1, 3, 2]) { const l = along(k, s, 'minorPent', 3, 18); const i = l.findIndex((f, j) => j > 0 && (mod12(pitch(s, f) - k) === 7 || mod12(pitch(s, f) - k) === 0)); if (i < 1) return null; notes.push(N(s, l[i - 1], t, 1), N(s, l[i], t + 1, 3, '/')); t += 4; }
  const chords = [nameOf(k) + 'm', nameOf(k + 5) + 'm', nameOf(k + 8), nameOf(k) + 'm'];
  return make(c, {
    id: 'slides-vocal', name: `Vocal slides: slow arrival, then vibrato (${chords.join(' – ')})`, domain: 'fretting', method: 'external-focus',
    unit: 'whole notes', goal: 72, start: 50, minutes: 4, backing: chords, chords,
    why: 'Slowed down, a slide becomes a singer’s scoop: the pitch rises through the gap and settles, then blooms with vibrato. The sound you aim for decides the speed of the slide.',
    instr: 'Pick the lower note on beat 1 and take the whole of beat 2 to slide up to the target (the root or 5th), then hold it for two beats, adding slow vibrato once it has settled. Listen for a smooth rise with no bumps. Pass: four bars where every arrival is smooth and in tune.',
    watch: 'Adding vibrato before the slide has finished.', simplify: 'A faster slide, no vibrato.', tab: { notes: liftOpen(notes) }
  });
}
/** A random key, box pair and string every bar (interleaving). */
export function slideRandom(c) {
  const rr = rng(1543 + (c.lvl || 9)), notes = [], names = []; let t = 0;
  for (let bar = 0; bar < 8; bar++) {
    const k = Math.floor(rr() * 12), ch = chainBoxes(k), j = Math.floor(rr() * 4), s = [3, 2, 1][Math.floor(rr() * 3)]; if (!ch) return null;
    const a = ch[j], A = boxOn(k, a, s), B = boxOn(k, ch[j + 1], s); if (!A || !B || B[1] <= A[1]) return null;
    [[A[0], 0.5], [A[1], 0.5], [B[1], 1, '/'], [A[1], 1, '\\'], [A[0], 1]].forEach(([f, d, x]) => { notes.push(N(s, f, t, d, x || null)); t += d; });
    names.push(`${nameOf(k)}m boxes ${boxName(a)}→${boxName(ch[j + 1])}, ${STR[s]}`);
  }
  return make(c, {
    id: 'slides-random', name: 'Random access: a new key, box and string every bar, joined by slides', domain: 'fretboard', method: 'interleaving',
    unit: '8th notes', goal: 96, start: 54, minutes: 5, dl: 1,
    why: 'At mastery level any box-to-box slide in any key should be ready the moment you need it.',
    instr: `${names.join(' → ')}. Read only the names: the two notes of the lower box on that string, slide into the next box, slide back, land. Pass: all 8 bars from the names alone at the goal tempo.`,
    watch: 'Hesitating on box 4 to 5.', simplify: 'The first four bars.', tab: { notes: liftOpen(notes) }
  });
}
/**
 * A phrase in degrees, each note in its box: events [string, degree, beats, mark, box]; mark is a
 * slide ('/' or '\'), '~' or null. Returns notes or null when a degree isn't in the box on that string.
 */
function phrase(k, events) {
  const notes = []; let t = 0;
  for (const [s, d, beats, x, b] of events) {
    if (s == null) { t += beats; continue; }
    const B = boxOn(k, b || 1, s); if (!B) return null;
    let f = B.find(fr => mod12(pitch(s, fr) - k) === d); if (f == null) return null;
    notes.push(N(s, f, t, beats, x || null)); t += beats;
  }
  return notes;
}
/** Phrases built on slides over a groove (use in music). */
export function slidePhrase(c, { level = 1 } = {}) {
  const k = minorKey(c);
  const ev = level === 1
    ? [[3, 3, 1, null, 1], [3, 5, 1, '/', 1], [2, 7, 1, null, 1], [2, 10, 1, '/', 1], [2, 10, 2, '~', 1], [null, 0, 2], [2, 0, 1, null, 2], [2, 10, 1, '\\', 2], [3, 5, 1, null, 1], [3, 3, 1, '\\', 1], [4, 0, 4, '~', 1]]
    : level === 2
      ? [[3, 5, 0.5, null, 1], [3, 7, 0.5, '/', 2], [2, 10, 0.5, null, 2], [2, 0, 0.5, '/', 2], [1, 3, 1, null, 2], [1, 5, 2, '/', 3], [1, 3, 0.5, '\\', 2], [2, 0, 0.5, null, 2], [2, 10, 1, '\\', 2], [3, 7, 2, '~', 2], [2, 7, 1, null, 1], [3, 5, 1, null, 1], [4, 0, 2, '~', 1]]
      : [[2, 0, 0.5, null, 2], [2, 3, 0.5, '/', 3], [1, 5, 0.5, null, 3], [1, 7, 1, '/', 4], [1, 5, 0.5, '\\', 3], [2, 3, 0.5, null, 3], [2, 0, 1, '\\', 2], [3, 7, 0.5, null, 2], [3, 10, 0.5, '/', 3], [3, 7, 1, '\\', 2], [3, 5, 1, null, 2], [2, 10, 1, null, 1], [3, 3, 2, '\\', 1], [4, 0, 4, '~', 1]];
  const raw = phrase(k, ev); if (!raw) return null; const notes = liftOpen(raw);
  const chords = level === 3 ? [nameOf(k) + '7', nameOf(k + 5) + '7', nameOf(k) + '7', nameOf(k + 7) + '7'] : [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: ['slides-phrase', 'slides-phrase-boxes', 'slides-phrase-blues'][level - 1],
    name: [`First sliding phrases in box 1 (${chords.join(' – ')})`, `Phrases that slide across boxes 1 to 3 (${nameOf(k)} minor)`, `Blues phrases sliding from box 2 to box 4 and home (${nameOf(k)} blues)`][level - 1],
    domain: 'improv', method: 'transfer', unit: 'phrases', goal: [80, 90, 96][level - 1], start: 52, minutes: 5, backing: chords, chords,
    why: ['Slides make a phrase sound sung rather than typed: here a call that slides up to the ♭7 and an answer that slides back down to the root.', 'A phrase that slides out of box 1, through box 2 and up into box 3 covers the neck without a visible position change: slides are the hinges.', 'A blues phrase starting high in box 2, sliding up into box 4 and stepping back down to box 1, over a dominant blues: the horizontal phrasing of blues and fusion players.'][level - 1],
    instr: 'Play the phrase over the backing, sliding where the tab shows / or \\ (pick only the first note of each slide). Then answer it with your own phrase using at least two slides. Pass: the phrase twice in time with every slide landing on the beat, then four bars of your own.',
    watch: 'Picking the slid notes again, so the phrase stops singing.', simplify: 'Half tempo, and pick every note.', tab: { notes: liftOpen(notes) }
  });
}
/** An original 8-bar study on slides: phrases, box chain, 6ths, runs, a long slide home (capstone). */
export function slideEtude(c) {
  const k = minorKey(c), cc = { ...c, key: k, minor: true };
  const p = slidePhrase(cc, { level: 2 }), sx = slideSixths(cc, { scale: 'minor' }), rn = slideRuns(cc); if (!p || !sx || !rn) return null;
  const notes = p.tab.notes.filter(n => n.t < 8).map(n => ({ ...n }));                                        // bars 1–2: a phrase across boxes
  sx.tab.notes.filter(n => n.t < 8).forEach(n => notes.push({ ...n, t: n.t + 8 }));                           // bars 3–4: sliding 6ths
  rn.tab.notes.filter(n => n.t < 8 && n.t + n.d <= 8).forEach(n => notes.push({ ...n, t: n.t + 16 }));        // bars 5–6: sliding runs
  const hi = boxOn(k, 4, 2), lo = boxOn(k, 1, 2); if (!hi || !lo) return null;
  const rootLo = along(k, 2, 'minorPent', 1, hi[1] - 1).filter(f => mod12(pitch(2, f) - k) === 0).pop(); if (rootLo == null) return null;
  notes.push(N(2, hi[1], 24, 2, '~'), N(2, rootLo, 26, 2, '\\'), N(2, rootLo, 28, 4, '~'));                  // bars 7–8: a long slide home
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: 'slides-capstone-etude', name: `Capstone study: an 8-bar piece built on slides (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'mixed rhythms', goal: 88, start: 52, minutes: 8, dl: 1, backing: [...chords, ...chords], chords,
    why: 'An original piece that uses every slide of the path: a phrase hinged on slides across three boxes, sliding 6ths, a sliding run that climbs the neck, and a long slide all the way home to the root.',
    instr: 'Learn it two bars at a time. Pick only where a slide starts; let the slides carry the line. Then write your own 8 bars with the same plan. Pass: the study at the goal tempo with every slide on the beat, then your own version once.',
    watch: 'The long slide in bar 7 stopping short of the root.', simplify: 'Bars 1–4.', tab: { notes: liftOpen(notes) }
  });
}
/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'slides', kind: 'technique', title: 'Slides', domain: 'fretting',
  re: /\bslid(es?|ing)\b(?! guitar)|legato slides?|shift slides?/,
  aliases: ['legato slides', 'shift slides', 'sliding 6ths'],
  summary: 'Moving a note along the string without lifting the finger: legato and shift slides, sliding into and out of notes, joining the five boxes, sliding 6ths and fast position-shifting runs, in any key and in real phrases.',
  prereqs: ['pentatonic'],
  sources: ['https://www.guitarworld.com/lessons/learning-slide-how-legato-technique-can-enhance-your-sound', 'https://jgmusiclessons.com/how-to-play-slides-on-guitar/', 'https://appliedguitartheory.com/lessons/guitar-sliding-exercises-to-level-up-your-technique/', 'https://www.premierguitar.com/lessons/guthrie-govans-erotic-cakes', 'https://www.merriammusic.com/blog/music-school/sliding-technique-crash-course/'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The slide itself',
      'Slide between neighbouring scale notes on the G string so the target sounds at full volume and on the beat at 80 BPM, shift-slide up and down a string, slide into chord tones from below so only the target is heard, slide to a sung pitch, play the pentatonic along the B and G strings naming each degree, and play two sliding phrases over a minor groove.', [
        S('slides-motion', 'Legato and shift slides', 'fretting', 'One finger, two notes, constant pressure.', [
          R_('slides-pair', 'Two notes, one pick stroke: slides up and back on {string} ({key})', 'chunking', { string: 3, n: 5, kind: 'pair', step: 1, goal: 80, start: 50, why: 'The legato slide is two notes for one pick stroke: pick, keep pressing, glide to the next fret, arrive. Doing it between neighbouring scale notes one pair at a time isolates the pressure and the stop.', instr: 'Pick the first note, slide up to the next scale note without picking (/), slide back (\\), rest a beat; then the next pair up the string. Ease off a little as you start moving and press fully as you arrive. Pass: every pair with the target as loud as the picked note, twice.', watch: 'Letting go of the string mid-slide so the target is silent.', simplify: 'Slide up only.' }),
          R_('slides-shift', 'Shift slides: up and down {string}, picking each arrival ({key})', 'accurate-reps', { string: 3, n: 6, kind: 'shift', step: 0.5, goal: 88, start: 52, why: 'A shift slide moves the hand to a new position and picks the arrival note again, so it is heard clearly on the beat. It is how you change position inside a line without a gap.', instr: 'Pick a note, slide to the next scale note and pick it again as you arrive; continue up the string, then come back down the same way. Count only clean, on-pitch arrivals. Pass: up and down twice with every arrival exactly on the 8th note.', watch: 'Arriving late because the slide started late.', simplify: 'Quarter notes.' })]),
        S('slides-into', 'Into the target', 'ear', 'Slides that start fast and land exactly.', [c => slideInto(c), c => slideHear(c)]),
        S('slides-string', 'The scale along a string', 'fretboard', 'Horizontal playing, joined by slides.', [c => slideOneString(c, { string: 2 }), c => slideOneString(c, { string: 3 })]),
        S('slides-first-music', 'First music', 'improv', 'Phrases hinged on slides.', [c => slidePhrase(c, { level: 1 }), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'Joining the boxes',
      'Slide between boxes 1–2 and 2–3 on the top strings and through all five boxes in time at 90 BPM, play Dorian and the pentatonic along the high e and G strings, keep long slides alive and slide out of notes cleanly, slide to any named degree from the root, and phrase across three boxes over a minor progression.', [
        S('slides-boxes', 'Box to box', 'fretboard', 'Slides as the hinges between the five shapes.', [c => slideBoxes(c), c => slideBoxes(c, { a: 2, b: 3 }), c => boxChain(c)]),
        S('slides-strings', 'Other strings and scales', 'fretboard', 'The same idea on the high e, and with Dorian.', [c => slideOneString(c, { string: 1 }), c => slideOneString(c, { string: 3, scale: 'dorian' })]),
        S('slides-control', 'Long, out and on demand', 'fretting', 'Long slides that stay alive, falls, and slides to a named degree.', [
          R_('slides-long', 'Long slides: root to 5th and back on {string} ({key})', 'external-focus', { string: 2, kind: 'long', n: 6, step: 1, goal: 76, start: 50, why: 'Sliding seven frets from the root to the 5th is where the note usually dies halfway. Listening for a continuous, full sound across the whole distance trains the steady pressure a long slide needs.', instr: 'Pick the root, slide up to the 5th (seven frets) in one beat, hold it with vibrato, slide back to the root. Listen for the note staying loud the whole way. Pass: four long slides in a row that never fade.', watch: 'Gripping hard with the thumb: it locks the hand.', simplify: 'Root to 4th (five frets).' }),
          R_('slides-out', 'Falling off notes: hold, then slide out down {string} ({key})', 'variable', { string: 1, kind: 'out', n: 6, step: 1, goal: 80, start: 50, why: 'Sliding out of a note (holding it, then letting it fall to the note below as the pressure eases) ends a phrase with a sigh instead of a full stop. Practised on each step of the scale it becomes controllable.', instr: 'Hold each note with a little vibrato, then slide down to the next scale note below on the “and” and stop there. Work down the high e string. Pass: every fall landing on its note and in time, twice.', watch: 'Sliding all the way down the neck: stop on the next note.', simplify: 'Slide out without stopping on a note (a fall-off).' }),
          c => slideDegrees(c)]),
        S('slides-music', 'In music', 'improv', 'Phrases across boxes, and a solo.', [c => slidePhrase(c, { level: 2 }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo that slides into every guide note' })])
      ], [4, 6]),
    stage('advanced', 'Double stops, runs and keys',
      'Slide diatonic 6ths up and down the G and high e strings with both notes arriving together, play sliding runs up the top two strings in triplets at 100 BPM, join boxes in four keys without stopping, land long slides between boxes called out of order, slide vocally over slow changes, and phrase across the neck over a blues.', [
        S('slides-double', 'Double-stop slides', 'fretting', 'Two fingers sliding as one.', [c => slideSixths(c), c => slideSixths(c, { scale: 'minor' })]),
        S('slides-runs', 'Runs and keys', 'fretting', 'Slides inside fast lines; the shapes in any key.', [c => slideRuns(c), c => slideKeys(c)]),
        S('slides-adv-control', 'Long and vocal', 'fretboard', 'Long slides from memory; slow, singing slides.', [c => boxesCalled(c), c => vocalSlides(c)]),
        S('slides-adv-music', 'In a solo', 'improv', 'Sliding blues phrases.', [c => slidePhrase(c, { level: 3 }), c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo: slide between at least three boxes every chorus' })])
      ], [7, 8]),
    stage('mastery', 'Fluent, fast and your own',
      'Play sliding runs in 16ths and sliding 6ths in 8ths at performance tempo, any key, box and string on demand, and perform your own 8-bar slide study.', [
        S('slides-performance', 'Performance tempo', 'fretting', 'Slides at speed.', [c => slideRuns(c, { fast: true }), c => slideSixths(c, { fast: true })]),
        S('slides-random-access', 'Any key, any box', 'fretboard', 'No warning.', [c => slideRandom(c), c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp solo: slide into every bar line' })]),
        S('slides-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => slideEtude(c), c => targetGuide(c, { prog: 'slowBlues', scale: 'minorPent', name: 'Slow blues: long, vocal slides and space' })])
      ], [9, 10])
  ]
});
