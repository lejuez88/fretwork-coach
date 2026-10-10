// Vibrato: a steady, in-tune pulse on a held note that makes it sing. From the first slow, measured
// pulse on one supported finger to a vibrato whose width, speed and onset are chosen on purpose: on
// every finger and string, at the top of a bend, on double-stops, after a slide, in any key, and as
// the voice of a slow solo (Gilmour, B.B. King, Hendrix, Stevie Ray Vaughan).
//
// Concept-first (CONTENT.md): the model describes a vibrato by four independent numbers: WIDTH (how far
// the pitch rises: a half step is a medium vibrato, a whole step a wide one), RATE (cycles per beat,
// locked to the click: 1, 2, 3 or 4), ONSET (straight first, then vibrato) and SHAPE (even, or widening
// as it goes). Measured vibrato is written as bend–release pulses (`b` up to the width, `r` back to the
// note) so the width and speed are visible and heard; free vibrato is the `~` mark. Where a vibrato
// goes is a scale DEGREE on a string inside a pentatonic box (`spotDeg`), found from the key, so every
// held note is in the key by construction. The composer `vibRun(c, spec)` builds an exercise from
// spots (degrees × strings × boxes × keys) × kind (reference, measured, free, delayed, widening,
// compare, on a bend, double-stop, slide-in) × width × rate × hold. Phrases are written in degrees
// (bending.js `phrase()`), so they too are right in any key.
import { OPEN, N, nameOf, minorKey, make, mod12, S, stage, entry, M, targetGuide } from '../lib.js';
import { boxFrets, rng, spot, phrase } from './bending.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const DEG = { 0: 'R', 3: '♭3', 5: '4', 7: '5', 10: '♭7' };
/** The stable notes a phrase rests on: root, ♭3 and 5. */
export const LAND = [0, 3, 7];
export const ALL = [0, 3, 5, 7, 10];
const WIDTH = { 1: 'half-step (medium) width', 2: 'whole-step (wide) width' };
const RATE = { 1: 'one cycle a beat', 2: 'two cycles a beat (8ths)', 3: 'three cycles a beat (triplets)', 4: 'four cycles a beat (16ths)' };
const UNIT = { 1: 'quarter-note pulses', 2: '8th-note pulses', 3: 'triplet pulses', 4: '16th-note pulses' };
/** The vibrato rate a level can control: slow first, then faster. */
export const rateFor = lvl => (lvl <= 2 ? 1 : lvl <= 5 ? 2 : lvl <= 8 ? 3 : 4);
/** Where degree d sits on string s inside a box (the box's own fret), with the finger that plays it. */
export function spotDeg(k, box, s, d) {
  const B = boxFrets(k, box); if (!B[s]) return null;
  const f = B[s].find(x => mod12(pitch(s, x) - k) === d); if (f == null) return null;
  const finger = f === B[s][0] ? 'index' : B[s][1] - B[s][0] >= 3 ? 'pinky' : 'ring';
  return { s, f, d, finger };
}
/** Every spot of the given degrees on the given strings of a box, low string to high. */
export function spotsIn(k, box, strings, degs) {
  const out = [];
  for (const s of strings) for (const d of degs) { const p = spotDeg(k, box, s, d); if (p) out.push(p); }
  return out;
}
/** The next box note below fret f on string s (the start of a slide into f), or null. */
function belowIn(k, box, s, f) { const B = boxFrets(k, box); const lo = (B[s] || []).filter(x => x < f); if (lo.length) return lo[lo.length - 1]; for (let x = f - 1; x >= Math.max(1, f - 4); x--) if (ALL.includes(mod12(pitch(s, x) - k))) return x; return null; }

/* ------------------------------- The composer ------------------------------- */
/** Measured vibrato: `cycles` bend–release pulses of `width` frets, each half a 1/(2·rate) beat; returns beats used. */
export function pulses(notes, s, f, t, beats, rate, width, { chord = false, widen = false } = {}) {
  const half = 1 / (2 * rate), n = Math.round(beats * rate);
  for (let i = 0; i < n; i++) {
    const w = widen && i >= n / 2 ? Math.min(2, width + 1) : width, x = chord ? { chord: true } : {};
    notes.push(N(s, f, t + i * 2 * half, half, 'b', { bendTo: f + w, ...x }), N(s, f, t + i * 2 * half + half, half, 'r', x));
  }
  return n * 2 * half;
}
/**
 * Render one vibrato at a spot from beat t; returns the beats used.
 *   ref: the plain note, then slow measured pulses · measured: pulses from the attack · free: the ~ mark
 *   delayed: straight half the hold, then pulses · widen: medium, then wide · compare: narrow-fast, then wide-slow
 *   bend: a whole-step bend held (vibrato at the top) · double: two strings barred, pulsed together
 *   slide: slide in from the box note below, then pulses
 */
function render(notes, k, box, p, kind, t, o) {
  const { hold, rate, width } = o;
  switch (kind) {
    case 'ref': notes.push(N(p.s, p.f, t, 1)); return 1 + pulses(notes, p.s, p.f, t + 1, hold - 1, 1, width);
    case 'measured': return pulses(notes, p.s, p.f, t, hold, rate, width);
    case 'free': notes.push(N(p.s, p.f, t, hold, '~')); return hold;
    case 'delayed': { const d = Math.max(1, Math.floor(hold / 2)); notes.push(N(p.s, p.f, t, d)); return d + pulses(notes, p.s, p.f, t + d, hold - d, rate, width); }
    case 'widen': return pulses(notes, p.s, p.f, t, hold, rate, 1, { widen: true });
    case 'compare': { const a = pulses(notes, p.s, p.f, t, hold / 2, Math.max(2, rate), 1); return a + pulses(notes, p.s, p.f, t + a, hold / 2, 1, 2); }
    case 'bend': {
      const move = { 5: [5, 7], 10: [10, 0], 3: [3, 5] }[p.d]; if (!move) return 0;
      const b = spot(k, box, p.s, move); if (!b) return 0;
      notes.push(N(b.s, b.f, t, 1, 'b', { bendTo: b.to }), N(b.s, b.f, t + 1, hold - 1, 'pb', { bendTo: b.to })); return hold;
    }
    case 'double': {
      const B = boxFrets(k, box); if (!B[1] || !B[2] || B[1][0] !== B[2][0]) return 0;
      const f = B[1][0]; notes.push(N(2, f, t, 1, null, { chord: true }), N(1, f, t, 1, null, { chord: true }));
      const half = 1 / (2 * rate), n = Math.round((hold - 1) * rate);
      for (let i = 0; i < n; i++) for (const s of [2, 1]) notes.push(N(s, f, t + 1 + i * 2 * half, half, 'b', { bendTo: f + 1, chord: true }), N(s, f, t + 1 + i * 2 * half + half, half, 'r', { chord: true }));
      return hold;
    }
    case 'slide': { const lo = belowIn(k, box, p.s, p.f); if (lo == null) return 0; notes.push(N(p.s, lo, t, 0.5), N(p.s, p.f, t + 0.5, 0.5, '/')); return 1 + pulses(notes, p.s, p.f, t + 1, hold - 1, rate, width); }
    default: return 0;
  }
}
/**
 * One vibrato exercise from a spec: { id, name ('{key}', '{width}', '{rate}', '{spots}'), method, kind,
 * degs (degrees), strings, boxes, keys (offsets, one block each), hold (beats per note), rate (or by
 * level), width (1 or 2), reps, land, rest (beats of silence after each note), goal, start, dl, domain,
 * unit, why, instr, watch, simplify, backing (k => chord names) }.
 */
export function vibRun(c, spec) {
  const k0 = minorKey(c), lvl = c.lvl || 5, kind = spec.kind || 'measured';
  const o = { hold: spec.hold || 4, rate: spec.rate || rateFor(lvl), width: spec.width || 1 };
  const notes = [], used = [], plan = []; let t = 0, n = 0;
  for (const off of spec.keys || [0]) for (const box of spec.boxes || [1]) {
    const k = mod12(k0 + off); plan.push([t, k]); const list = spotsIn(k, box, spec.strings || [3, 2, 1], spec.degs || LAND);
    for (let r = 0; r < (spec.reps || 1); r++) for (const p of list) {
      const b = render(notes, k, box, p, kind, t, o); if (!b) continue;
      t += b + (spec.rest || 0); n++; if (r === 0) used.push(`${DEG[p.d]} (${p.finger})`);
    }
  }
  if (n < 2 || notes.length > 400) return null;
  const fill = s => s.replace('{key}', `${nameOf(k0)} minor`).replace('{width}', WIDTH[o.width]).replace('{rate}', RATE[o.rate]).replace('{spots}', [...new Set(used)].join(', '));
  const chords = spec.backing ? spec.backing(k0) : null;
  const ex = make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretting', method: spec.method, unit: spec.unit || (['free', 'bend'].includes(kind) ? 'half notes' : UNIT[o.rate]),
    goal: spec.goal || 72, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, ...(chords ? { backing: chords, chords } : {}), tab: { notes }
  });
  KEY_PLAN.set(ex, plan); return ex;
}
/** For the pitch check: the key each note belongs to, for lessons that change key ([[from beat, key pc], …]). */
export const KEY_PLAN = new WeakMap();
const V_ = (id, name, method, opts) => c => vibRun(c, { id, name, method, ...opts });
const rockChords = k => [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
const bluesChords = k => [nameOf(k) + '7', nameOf(k + 5) + '7', nameOf(k) + '7', nameOf(k + 7) + '7'];

/* ------------------------------- Phrases ------------------------------- */
/** Phrases that end on long, vibrato-ed landing notes, written in degrees (use in music). */
export function vibPhrase(c, { level = 1 } = {}) {
  const k = minorKey(c);
  const ev = level === 1
    ? [[2, 10, 1], [2, 7, 1], [3, 5, 2], [3, 3, 4, '~'], [null, 0, 4], [1, 3, 1], [1, 0, 1], [2, 10, 2], [2, 7, 4, '~'], [null, 0, 4]]
    : level === 2
      ? [[3, 5, 0.5], [3, 3, 0.5], [4, 0, 3, '~'], [null, 0, 2], [2, 10, 1], [3, 5, 1, 'b', 7], [3, 5, 2, '~'], [null, 0, 2], [1, 3, 0.5], [1, 0, 0.5], [2, 10, 1], [2, 7, 2, '~'], [null, 0, 2], [3, 3, 0.5], [4, 10, 0.5], [4, 0, 7, '~']]
      : [[1, 0, 0.5], [1, 3, 1.5, 'b', 5], [1, 3, 2, '~'], [2, 10, 1, 'pb', 0], [2, 10, 1, 'r'], [2, 7, 2, '~'], [null, 0, 2], [3, 5, 1, 'b', 7], [3, 3, 1], [4, 0, 2, '~'], [2, 7, 0.5], [2, 10, 0.5], [1, 0, 3, '~'], [null, 0, 2], [3, 3, 0.5], [4, 0, 5.5, '~']];
  const notes = phrase(k, 1, ev); if (!notes) return null;
  const chords = level === 3 ? bluesChords(k) : rockChords(k);
  const id = ['vib-phrase', 'vib-phrase-bend', 'vib-phrase-blues'][level - 1];
  const name = [`First phrases that end on a singing note (${chords.join(' – ')})`, `Phrases with a bend and three different landings (${nameOf(k)} minor)`, `Blues phrases: vibrato on the bend, the pre-bend and the root (${nameOf(k)} blues)`][level - 1];
  return make(c, {
    id, name, domain: 'improv', method: 'transfer', unit: 'phrases', goal: level === 3 ? 76 : 70, start: 48, minutes: 5, backing: [...chords, ...chords], chords,
    why: ['A phrase is only as good as its last note. Two short phrases end on a held ♭3 and a held 5th with vibrato, then leave a bar of silence: the vibrato is what makes the long note worth waiting for.',
      'Three landings, three vibratos: a slow wide one on the low root, a bend held with vibrato at the top, and a narrow, faster one on the 5th. Choosing the vibrato for the moment is the point.',
      'Over a blues the vibrato goes everywhere a singer would hold a note: at the top of a bend, after a pre-bend that falls into place, and on the root at the end of the chorus.'][level - 1],
    instr: 'Play the phrases over the backing. On every held note, start the vibrato in time with the click (the speed your level uses: one, two or three cycles a beat) and keep it going to the end of the note; then rest. Answer each phrase with one of your own that ends on a different held note. Pass: the phrases in time with every vibrato even and in tune, then four bars of your own.',
    watch: 'Vibrato that stops early or speeds up as the note fades: keep it going until the note ends.', simplify: 'Only the first phrase, with one cycle a beat.', tab: { notes }
  });
}
/** The plan of the random lesson: one { k, box, d, s, width, rate, onset } per bar. */
export function vibPlan(c) {
  const r = rng(907 + (c.lvl || 9)), out = [];
  for (let bar = 0; bar < 8; bar++) out.push({ k: Math.floor(r() * 12), box: 1 + Math.floor(r() * 5), d: LAND[Math.floor(r() * 3)], s: [3, 2, 1][Math.floor(r() * 3)], width: 1 + Math.floor(r() * 2), rate: 2 + Math.floor(r() * 3), delayed: r() < 0.5 });
  return out;
}
/** A random key, box, landing note, width, speed and onset every bar (interleaving). */
export function vibRandom(c) {
  const plan = vibPlan(c), notes = [], names = [];
  for (const [bar, p] of plan.entries()) {
    const sp = [p.s, 3, 2, 1, 4].map(s => spotDeg(p.k, p.box, s, p.d)).find(Boolean); if (!sp) return null;
    render(notes, p.k, p.box, sp, p.delayed ? 'delayed' : 'measured', bar * 4, { hold: 4, rate: p.rate, width: p.width });
    names.push(`${nameOf(p.k)}m box ${p.box}: the ${DEG[p.d]}, ${p.width === 2 ? 'wide' : 'medium'}, ${p.rate}/beat${p.delayed ? ', delayed' : ''}`);
  }
  const ex = make(c, {
    id: 'vib-random', name: 'Random access: a new key, note, width and speed every bar', domain: 'fretting', method: 'interleaving', unit: 'mixed pulses', goal: 76, start: 50, minutes: 5, dl: 1,
    why: 'At mastery level the vibrato is a choice made in the moment: the right note, the right width, the right speed, the right onset, instantly and in tune.',
    instr: `${names.join(' → ')}. Read only the names: find the note in the box, then give it exactly that vibrato, locked to the click. Pass: all 8 bars from memory with every vibrato at the called width and speed.`,
    watch: 'Every vibrato drifting back to your habit speed.', simplify: 'The first four bars.', tab: { notes }
  });
  KEY_PLAN.set(ex, plan.map((p, bar) => [bar * 4, p.k])); return ex;
}
/** An original 8-bar study that uses every vibrato of the path (capstone). */
export function vibEtude(c) {
  const k = minorKey(c), notes = [];
  const p1 = phrase(k, 1, [[2, 10, 0.5], [2, 7, 0.5], [3, 5, 1], [3, 3, 2]], 0); if (!p1) return null; notes.push(...p1);   // bar 1: a short line…
  const a = spotDeg(k, 1, 3, 3); if (!a) return null; render(notes, k, 1, a, 'delayed', 4, { hold: 4, rate: 2, width: 1 });   // bar 2: …into a delayed vibrato on the ♭3
  const b = spotDeg(k, 1, 2, 7); if (!b) return null; render(notes, k, 1, b, 'widen', 8, { hold: 4, rate: 2, width: 1 });      // bar 3: the 5th, widening
  const p2 = phrase(k, 1, [[1, 0, 0.5], [1, 3, 0.5]], 15); if (!p2) return null; notes.push(...p2);                              // bar 4: rest, then a pickup
  const bb = spotDeg(k, 1, 3, 5); if (!bb || !render(notes, k, 1, bb, 'bend', 16, { hold: 4 })) return null;                      // bar 5: a bend held with vibrato
  if (!render(notes, k, 1, { s: 1, d: 7 }, 'double', 20, { hold: 4, rate: 3 })) return null;                                       // bar 6: double-stop vibrato
  const sl = spotDeg(k, 1, 2, 10); if (!sl || !render(notes, k, 1, sl, 'slide', 24, { hold: 4, rate: 3, width: 1 })) return null; // bar 7: slide in, vibrato
  const r = spotDeg(k, 1, 4, 0); if (!r) return null; render(notes, k, 1, r, 'measured', 28, { hold: 4, rate: 2, width: 2 });   // bar 8: the root, wide
  const chords = rockChords(k);
  return make(c, {
    id: 'vib-capstone-etude', name: `Capstone study: an 8-bar piece for vibrato (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer', unit: 'mixed rhythms', goal: 76, start: 48, minutes: 8, dl: 1, backing: [...chords, ...chords], chords,
    why: 'An original piece that asks for every vibrato of the path: delayed onset on the ♭3, a widening vibrato on the 5th, silence and a pickup, vibrato at the top of a bend, double-stop vibrato, a slide into a vibrato, and a wide, slow vibrato on the low root.',
    instr: 'Learn it two bars at a time, saying the vibrato of each held note before you play it (delayed, widening, on the bend, double, slide-in, wide). Then write your own 8 bars to the same plan. Pass: the study at the goal tempo with every vibrato as written, then your own version once.',
    watch: 'The bend in bar 5 sinking while you add vibrato: keep the top of the bend as the top of the vibrato.', simplify: 'Bars 1–4.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const HOW = 'Hook the thumb lightly over the neck and rotate the wrist, like turning a door handle, so the string is pushed a little up (toward the ceiling on the G, B and e strings, toward the floor on the D, A and low E) and let back: the finger only holds the note, the wrist moves it. ';
export default entry({
  id: 'vibrato', kind: 'technique', title: 'Vibrato', domain: 'fretting',
  re: /vibrato|singing (held )?notes|wide vibrato/,
  aliases: ['finger vibrato', 'wrist vibrato'],
  summary: 'A vibrato that makes held notes sing, from the first slow pulse locked to the click to a width, speed and onset chosen on purpose: on every finger and string, on bends, double-stops and slides, in any key and in real solos.',
  prereqs: ['pentatonic', 'bending'],
  sources: ['https://www.premierguitar.com/lessons/shake-it-off-everything-you-need-to-know-about-vibrato', 'https://practiceguitarnow.com/GuitarVibratoLesson.html', 'https://www.riffhard.com/?p=35830', 'https://www.pickupmusic.com/blog/guitar-techniques-bending-and-vibrato', 'https://riffhard.com/?p=36564'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'A steady, in-tune pulse',
      'Hold the ♭3, the 5th and the root of box 1 with a measured half-step vibrato at one cycle a beat at 60 BPM, then two cycles a beat, even and returning to pitch every time, with every finger, name the landing notes of the box from memory, and end two phrases on a singing note over a minor groove.', [
        S('vib-hear', 'Hear it first', 'ear', 'The note, then the movement around it.', [
          V_('vib-ref', 'Hear the note, then pulse it: {spots} ({key}, box 1)', 'audiation', { kind: 'ref', hold: 3, width: 1, rest: 1, goal: 66, start: 48, why: 'Vibrato is a movement AROUND a pitch the ear already knows. Holding the plain note first, then pulsing it slowly, lets you hear that the vibrato must rise a little and always come back to that same pitch.', instr: HOW + 'Pick the note, hold it straight for a beat and hear it; then push the string up a half step and let it back, once per beat, for two beats (the tab writes each push as a small bend). Notes: {spots}. Pass: every pulse comes back exactly to the note you heard first.', watch: 'Pulses that never come back down: the note sounds sharp, not singing.', simplify: 'Only the G-string ♭3 and the B-string 5th.' }),
          V_('vib-compare', 'Narrow and fast vs wide and slow on the same note ({key})', 'external-focus', { kind: 'compare', strings: [3, 2], degs: [3, 7], hold: 4, rate: 2, width: 1, goal: 66, start: 46, why: 'Width and speed are two separate controls. Hearing the same note with a narrow, quicker vibrato and then a wide, slower one makes the difference audible, before the hands have to choose.', instr: HOW + 'On each note: two beats of narrow pulses (a half step, two a beat), then two beats of wide ones (a whole step, one a beat). Listen to the sound, not the fingers: the first should shimmer, the second should cry. Pass: each half clearly different and in time.', watch: 'Letting the width grow during the narrow half.', simplify: 'One note, slower tempo.' })]),
        S('vib-motion', 'The motion, in time', 'fretting', 'Measured pulses with the wrist.', [
          V_('vib-measured-1', 'Measured vibrato, {rate}: {spots} ({key}, box 1)', 'chunking', { kind: 'measured', rate: 1, width: 1, hold: 2, rest: 2, goal: 66, start: 46, why: 'Locking the pulse to the click turns a vague wobble into a controlled movement. One cycle a beat, with two beats of rest after each note, splits the skill into small, repeatable pieces.', instr: HOW + 'Pick once; push up a half step on the beat and let back on the "and", for two beats; rest two beats with the hand relaxed; next note. Notes: {spots}. Pass: 6 notes in a row in time with every pulse the same size.', watch: 'Squeezing the neck harder and harder: squeeze only while the vibrato runs, then relax.', simplify: 'Use the ring finger with the middle behind it on the G string only.' }),
          V_('vib-measured-2', 'Measured vibrato, {rate}: {spots} ({key})', 'accurate-reps', { kind: 'measured', rate: 2, width: 1, hold: 2, rest: 2, reps: 2, goal: 66, start: 46, why: 'Two cycles a beat is close to a real vibrato speed at a slow tempo. Counting only the notes where every pulse is even and returns to pitch builds the clean version, not the habit of a shaky one.', instr: HOW + 'Two pulses per beat (up on the 8th, down on the next), for two beats; then rest. Count the clean notes, not the attempts. Pass: 8 clean notes in a row.', watch: 'The second beat speeding up or shrinking.', simplify: 'One cycle a beat for the first beat, two for the second.' })]),
        S('vib-fingers', 'Every finger, the landing notes', 'fretting', 'Index, ring and pinky; the notes that rest.', [
          V_('vib-fingers-all', 'Vibrato with every finger: every note of box 1 on the top strings ({key})', 'variable', { kind: 'measured', degs: ALL, strings: [3, 2, 1], rate: 1, width: 1, hold: 2, rest: 1, goal: 66, start: 46, why: 'Players often have one good vibrato finger. Every note of the box on the top three strings uses the index finger or the ring and pinky, so each finger learns the same wrist motion with different support.', instr: HOW + 'Index-finger notes: the wrist pivots on the index knuckle, no fingers behind. Ring and pinky notes: the fingers behind support it. Notes: {spots}. Pass: every finger’s vibrato sounds the same size and speed.', watch: 'The index-finger vibrato being much narrower.', simplify: 'Index and ring only.' }),
          V_('vib-landing', 'From memory: the landing notes of box 1 with vibrato ({key})', 'retrieval', { kind: 'free', degs: LAND, strings: [4, 3, 2, 1], hold: 2, goal: 66, start: 46, why: 'Phrases rest on the root, the ♭3 and the 5th: those are the notes that get long vibratos. Finding them from memory, by degree, is what lets you end a phrase in the right place without looking.', instr: 'Cover the tab. Say the degree, then find it and hold it two beats with vibrato: on the D, G, B and e strings, every root, ♭3 and 5th of box 1. The tab writes ~ for a free vibrato: use the size and speed you just practised. Pass: all of them from memory, twice, each vibrato even.', watch: 'Landing on the 4th or ♭7, which pull away instead of resting.', simplify: 'The G and B strings only.' })]),
        S('vib-first-music', 'First music', 'improv', 'Phrases that end on a singing note.', [c => vibPhrase(c, { level: 1 }), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'Width, speed and onset on purpose',
      'Play measured vibrato at two, three and four cycles a beat and at half-step and whole-step width on demand at 70 BPM, delay the onset and widen a vibrato in time, hold vibrato at the top of a bend and on the bass strings, find the landing notes of all five boxes, and end every phrase of a slow solo with a deliberate vibrato.', [
        S('vib-rate', 'Speed and width ladders', 'fretting', 'The two controls, one at a time.', [
          V_('vib-rate-ladder', 'Rate ladder at half-step width: {spots} ({key})', 'variable', { kind: 'measured', degs: [3, 7, 0], strings: [3, 2, 1], hold: 4, width: 1, rest: 0, goal: 72, start: 50, why: 'The same width at a faster rate sounds more intense; at a slower rate, more relaxed. Climbing the rate on the same notes, while the width stays the same, separates the two controls.', instr: HOW + 'Each note gets four beats of pulses at {rate}, half-step wide. As your level rises the rate rises (two, three, then four cycles a beat). Pass: every pulse the same width at the new speed, 4 notes in a row.', watch: 'The width shrinking as the speed rises.', simplify: 'Lower the tempo until the width holds.' }),
          V_('vib-wide', 'Wide vibrato: whole-step pulses, {rate} ({key})', 'variable', { kind: 'measured', degs: [3, 7, 0], strings: [3, 2, 1], hold: 4, width: 2, rate: 2, goal: 70, start: 48, why: 'A whole-step vibrato is the big rock and blues sound: it needs the full wrist rotation and solid support, and it must still return to the note every time or it sounds out of tune.', instr: HOW + 'Pulses a whole step wide, two a beat, four beats per note. Check the top of the first pulse against the fret two above if unsure. Pass: 4 notes in a row where every pulse reaches the same top and comes back.', watch: 'Pulses that rise only a half step at the end of the note.', simplify: 'One cycle a beat.' })]),
        S('vib-onset', 'Onset and shape', 'fretting', 'When the vibrato starts, how it grows.', [
          V_('vib-delayed', 'Delayed vibrato: straight, then singing ({key})', 'external-focus', { kind: 'delayed', degs: [3, 7, 0], strings: [3, 2, 1], hold: 4, width: 1, goal: 70, start: 48, why: 'Holding a note straight and then letting the vibrato bloom (a Santana and Gilmour habit) lets the listener hear the pitch first, then the feeling. It is a decision, so it has to start exactly where you choose.', instr: HOW + 'Hold each note perfectly still for two beats, then start the vibrato on beat 3 at {rate}. Listen for the moment it starts: it should sound like a singer opening up, not a wobble creeping in. Pass: every onset exactly on beat 3, 4 notes in a row.', watch: 'Vibrato leaking into the straight part.', simplify: 'Straight for one beat, then vibrato.' }),
          V_('vib-widen', 'Widening vibrato: medium, then wide ({key})', 'external-focus', { kind: 'widen', degs: [3, 7, 0], strings: [3, 2, 1], hold: 4, width: 1, rate: 2, goal: 70, start: 48, why: 'Starting a vibrato narrow and letting it widen (a B.B. King signature) builds intensity on one note. The speed stays locked while only the width grows.', instr: HOW + 'Two beats of half-step pulses, two beats of whole-step pulses, at the same speed. Listen to the note grow without speeding up. Pass: 4 notes in a row with an audible change of width and no change of speed.', watch: 'Speeding up when the vibrato gets wider.', simplify: 'Three beats medium, one beat wide.' })]),
        S('vib-strings', 'On bends and bass strings', 'fretting', 'Two harder places for the same motion.', [
          V_('vib-on-bend', 'Vibrato at the top of a bend: the 4, ♭7 and ♭3 bends ({key})', 'accurate-reps', { kind: 'bend', degs: [5, 10, 3], strings: [3, 2, 1], hold: 4, goal: 70, start: 48, why: 'Vibrato on a bend comes from letting the bend down a little and pushing it back to the target. The top of the vibrato must be the target pitch, or the whole bend sounds flat.', instr: 'Bend up a whole step on the beat (4 → 5 on the G string, ♭7 → R on the B, ♭3 → 4 on the e), hold it, then add vibrato for three beats by easing the bend down slightly and pushing back up to the target. The tab marks the bend, then the held bent note. Count the clean ones. Pass: 6 bends in a row whose vibrato peaks on the target.', watch: 'The vibrato going above the target, or the bend sinking while you add it.', simplify: 'Hold the bend two beats still, then add two beats of vibrato.' }),
          V_('vib-bass', 'Vibrato on the bass strings: pull toward the floor ({key})', 'variable', { kind: 'measured', degs: [0, 3, 7, 10], strings: [6, 5, 4], hold: 2, width: 1, rest: 1, rate: 2, goal: 70, start: 48, why: 'On the D, A and low E strings the push goes toward the floor, so the string doesn’t slip off the neck. The motion feels different, the sound must be the same.', instr: HOW + 'Pull the bass strings down toward the floor for each pulse. Notes: {spots}. Pass: every note even and in tune, with no string slipping off the edge.', watch: 'Pushing the low E string up off the fingerboard.', simplify: 'D string only.' })]),
        S('vib-anywhere', 'Every box, from memory', 'fretboard', 'The landing notes all over the neck.', [
          V_('vib-boxes', 'Landing notes in boxes 1 to 5, one vibrato each ({key})', 'interleaving', { kind: 'measured', degs: [0, 7], strings: [2], boxes: [1, 2, 3, 4, 5], hold: 2, width: 1, rate: 2, goal: 72, start: 50, why: 'Changing box every note changes the finger, the fret spacing and the support, so the vibrato has to adapt each time: mixed practice that transfers to real solos.', instr: HOW + 'On the B string, the root and the 5th of each box from 1 to 5 (whichever it holds), two beats of vibrato each. Notes: {spots}. Pass: the whole run with every vibrato the same size.', watch: 'Narrower vibrato high on the neck, where the frets are close.', simplify: 'Boxes 1–3.' }),
          V_('vib-called', 'Called degree: the note is named, you find it and sing it ({key}, box 4)', 'retrieval', { kind: 'free', degs: [0, 3, 7, 10], strings: [4, 3, 2, 1], boxes: [4], hold: 2, goal: 70, start: 48, why: 'Calling a degree and finding it in a box away from home is the retrieval that improvising needs: the vibrato note is wherever the phrase lands.', instr: 'Cover the tab. In box 4, say each degree (R, ♭3, 5, ♭7), find it on the D, G, B and e strings and hold it with two beats of vibrato. Pass: all of them from memory with no searching.', watch: 'Drifting back into box 1.', simplify: 'Look at the box once, then cover it.' })]),
        S('vib-music', 'In music', 'improv', 'Landings that sing, then a solo.', [c => vibPhrase(c, { level: 2 }), c => targetGuide(c, { prog: 'slowBlues', scale: 'minorPent', name: 'Slow blues: end every phrase on a held chord tone with a chosen vibrato' })])
      ], [4, 6]),
    stage('advanced', 'Vibrato as expression',
      'Lock vibrato to triplets and 16ths at 80 BPM, hold a unison bend with vibrato, give double-stops and slide-in notes an even vibrato, find landing notes in four keys and any box from memory, and play a blues solo where every held note has the vibrato it needs.', [
        S('vib-locked', 'Locked to the groove', 'fretting', 'Fast pulses and the double-stop.', [
          V_('vib-triplet', 'Triplet-locked vibrato on the landing notes ({key}, boxes 1 and 2)', 'variable', { kind: 'measured', boxes: [1, 2], degs: [3, 7, 0], strings: [3, 2], hold: 2, width: 1, rate: 3, goal: 78, start: 52, why: 'In a shuffle or slow blues the vibrato moves with the triplet feel. Three cycles a beat, locked to the groove, makes the held note part of the rhythm.', instr: HOW + 'Three half-step pulses per beat, two beats per note, in box 1 then box 2. Pass: every note in time with the triplets.', watch: 'Pulses blurring into a shake: keep each one a clear up and back.', simplify: 'Two cycles a beat.' }),
          c => vibRun(c, { id: 'vib-double', name: 'Double-stop vibrato: the top two strings barred ({key})', method: 'variable', kind: 'double', degs: [0, 7], strings: [1], boxes: [1, 4], hold: 4, rate: 2, rest: 0, reps: 2, goal: 76, start: 50, backing: bluesChords, why: 'Barring the B and e strings and shaking both at once (a Hendrix and Chuck Berry sound) needs a vibrato from the wrist, not the finger: both strings must move the same amount.', instr: 'Barre the top two strings with the index finger (box 1, then box 4). Pick both, hold one beat, then pulse both strings together. Pass: 4 double-stops in a row where both strings ring and pulse evenly.', watch: 'One string going dead under the barre.', simplify: 'One cycle a beat.' })]),
        S('vib-arrivals', 'Arrivals: slides and unisons', 'fretting', 'Vibrato after a move.', [
          V_('vib-slide', 'Slide in, then vibrato: {spots} ({key})', 'accurate-reps', { kind: 'slide', degs: [3, 7, 10, 0], strings: [3, 2, 1], hold: 3, width: 1, rate: 2, rest: 1, goal: 76, start: 50, why: 'Sliding into a note and then singing it is one of the most vocal moves on the guitar, but the vibrato only works if the slide stops exactly on the fret first.', instr: 'Pick the box note below, slide up to the target on the beat, then pulse it for two beats. Count only the notes where the slide stops dead on the fret before the vibrato starts. Pass: 8 clean in a row.', watch: 'Starting the vibrato before the slide has arrived.', simplify: 'Slide in, hold straight one beat, then vibrato.' }),
          c => { const k = minorKey(c), notes = []; let t = 0; for (const [s, m] of [[3, [5, 7]], [2, [10, 0]], [3, [5, 7]], [2, [10, 0]]]) { const b = spot(k, 1, s, m); if (!b) return null; const hs = s - 1, fu = b.to - (OPEN[hs] - OPEN[s]); notes.push(N(hs, fu, t, 1), N(s, b.f, t + 1, 1, 'b', { bendTo: b.to, chord: true }), N(hs, fu, t + 1, 1, null, { chord: true }), N(s, b.f, t + 2, 2, 'pb', { bendTo: b.to, chord: true }), N(hs, fu, t + 2, 2, '~', { chord: true })); t += 4; }
            return make(c, { id: 'vib-unison', name: `Unison bends held with vibrato (${nameOf(k)} minor)`, domain: 'fretting', method: 'external-focus', unit: 'half notes', goal: 72, start: 48, minutes: 5,
              why: 'A unison bend held still is one note; with vibrato on both strings it becomes a huge, singing chorus sound (a Gilmour favourite). The beating between the two strings must stay slow while the vibrato moves.', instr: 'Fret the target on the higher string, then pick both and bend the lower string to it. When the beating stops, add a gentle vibrato with the wrist so both notes move together. Listen: the two notes should sound like one wide voice. Pass: 4 unisons in a row, in tune before and during the vibrato.', watch: 'The bent string sinking flat as soon as the vibrato starts.', simplify: 'Hold the unison still; add vibrato to the higher note only.', tab: { notes } }); }]),
        S('vib-anywhere-adv', 'Any key, any box', 'fretboard', 'Landing notes found on the spot.', [
          V_('vib-keys', 'Landing notes in four keys around the cycle of fourths', 'interleaving', { kind: 'measured', keys: [0, 5, 10, 3], degs: [3, 7, 0], strings: [3, 2], hold: 2, width: 1, rate: 3, goal: 76, start: 50, why: 'The landing notes are degrees, so they move with the key. Changing key every block means finding the ♭3, the 5th and the root at once and giving each the same vibrato.', instr: HOW + 'In box 1 of each key, a 4th apart: the ♭3, 5th and root on the G and B strings, two beats of triplet pulses each. Pass: all four keys without stopping.', watch: 'Different vibrato in the high keys, where the frets are close.', simplify: 'Two keys.' }),
          V_('vib-called-all', 'Called landing notes in all five boxes ({key})', 'retrieval', { kind: 'free', degs: [0, 3, 7], strings: [3, 2, 1], boxes: [3, 5, 1, 4, 2], hold: 1, goal: 78, start: 52, why: 'Out of order, every box’s resting notes have to come from memory: exactly the skill of ending a phrase anywhere on the neck with a note that sings.', instr: 'Cover the tab. Boxes 3, 5, 1, 4, 2: in each, find the root, ♭3 and 5th on the G, B and e strings and give each a short vibrato. Pass: all five boxes from memory.', watch: 'Defaulting to box 1.', simplify: 'Boxes 1–3.' })]),
        S('vib-adv-music', 'In a solo', 'improv', 'Every held note, the right vibrato.', [c => vibPhrase(c, { level: 3 }), c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo: wide vibrato at the peaks, narrow on the way down' })])
      ], [7, 8]),
    stage('mastery', 'Your vibrato, at will',
      'Play a wide, 16th-note vibrato at performance tempo without losing pitch, give any note in any key the called width, speed and onset on demand, and perform your own 8-bar vibrato piece.', [
        S('vib-performance', 'At performance tempo', 'fretting', 'Fast, wide and still in tune.', [
          V_('vib-fast-wide', 'Wide vibrato at four cycles a beat ({key}, boxes 1 and 4)', 'edge', { kind: 'measured', boxes: [1, 4], degs: [3, 7, 0], strings: [3, 2, 1], hold: 2, width: 2, rate: 4, goal: 80, why: 'Fast and wide together is the most demanding vibrato: rock’s aggressive sustain. It needs a loose arm and the thumb as a pivot, and every pulse must still return to the note.', instr: HOW + 'Whole-step pulses, four a beat, two beats per note. Tempo ladder: add a few BPM after each pass where every pulse still reaches the same top. Pass: clean at the goal tempo.', watch: 'Tension climbing up the forearm: shake out between notes.', simplify: 'Half-step width at the same speed.' }),
          V_('vib-recall-fast', 'Every landing note of box 2 from memory, wide and fast ({key})', 'retrieval', { kind: 'measured', boxes: [2], degs: [0, 3, 7], strings: [4, 3, 2, 1], hold: 1, width: 2, rate: 3, goal: 80, start: 52, why: 'Retrieval under speed: the note has to be found instantly and given a performance vibrato straight away.', instr: 'Cover the tab. Box 2, D string to high e: every root, ♭3 and 5th, one beat each of wide triplet pulses. Pass: from memory, in time, twice.', watch: 'Hesitating between strings.', simplify: 'Two beats per note.' })]),
        S('vib-random', 'Any key, any note, any vibrato', 'fretboard', 'No warning.', [c => vibRandom(c), c => targetGuide(c, { prog: 'slowBlues', scale: 'minorPent', name: 'Slow blues: three vibratos per chorus, each one different' })]),
        S('vib-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => vibEtude(c), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Rock ballad solo: long notes, each with the vibrato it needs' })])
      ], [9, 10])
  ]
});
