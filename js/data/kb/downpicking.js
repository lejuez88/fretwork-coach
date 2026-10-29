// Downpicking endurance: every note a downstroke, with the pick clearing the strings on the silent trip
// back up. Palm-muted chugs on the low root, then triplets, gallops and reverse gallops, 16th-note bursts
// and long runs, string changes that keep the same mute, accents made by easing the palm instead of picking
// harder, power-chord stabs over a pedal note, and the stamina to keep it going. The rhythm engine of thrash,
// punk and hard rock.
//
// Concept-first (CONTENT.md): the model is a RIFF on a grid per bar (16 slots, or 12 for triplets). Each
// slot event is a KIND: C a palm-muted downstroke on the chord's root string, S a muted downstroke on the
// next string up (the fifth of the chord, same fret + 2), A an open (unmuted) power chord, T an open stab
// of a second chord (the bar's `stab` root) and a rest where there is no event. All notes carry the written
// down-stroke mark (pick: 'd'). The roots come from a progression of key degrees and are placed on the 6th
// or 5th string nearest the last one, so every sounding note is a root or fifth in every key by construction.
//
// Teaching method first (CONTENT.md, `pedagogy` below), researched 2026-10-29: teachers start with slow
// downstrokes on one low string with a small motion from the wrist and the pick clearing the strings,
// add rests so the hand can relax, then eighths, power chords on the off-beats, triplets, 16ths in
// short bursts with rests, gallops and reverse gallops, accents made by easing the muting palm, string
// changes with an unchanged mute, and finally longer runs. Short cells looped for 20 to 30 seconds, never
// speeding up when the hand feels good, are the practice method every source agrees on.
import { OPEN, N, nameOf, make, mod12, S, stage, entry } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const pitch = (s, f) => OPEN[s] + f;
function rootFret(pc, s, near) {
  let best = null;
  for (let f = 0; f <= 12; f++) if (mod12(pitch(s, f)) === mod12(pc)) { const d = Math.abs(f - near); if (best == null || d < best.d) best = { f, d }; }
  return best ? best.f : null;
}
function place(pc, near) {
  let best = null;
  for (const rs of [6, 5]) { const f = rootFret(pc, rs, near); if (f == null) continue; const d = Math.abs(f - near) + (rs === 5 ? 0.01 : 0); if (!best || d < best.d) best = { rs, f, d }; }
  return best;
}
const slots = (n, kind, len = 1, list = null) => (list || Array.from({ length: n }, (_, i) => i)).map(s => [s, len, kind]);
/** Patterns: grid 16 (16th notes) or 12 (triplets); events [slot, length, kind]. */
export const PAT = {
  q: { grid: 16, name: 'quarter notes', unit: 'quarter notes', ev: slots(0, 'C', 4, [0, 4, 8, 12]) },
  q3: { grid: 16, name: 'three quarters and a rest', unit: 'quarter notes', ev: slots(0, 'C', 4, [0, 4, 8]) },
  mix48: { grid: 16, name: 'quarters and a pair of 8ths', unit: 'quarter and 8th notes', ev: [[0, 4, 'C'], [4, 4, 'C'], [8, 2, 'C'], [10, 2, 'C'], [12, 4, 'C']] },
  e8: { grid: 16, name: 'steady 8ths', unit: '8th notes', ev: slots(0, 'C', 2, [0, 2, 4, 6, 8, 10, 12, 14]) },
  chug3: { grid: 16, name: 'three muted, one open', unit: 'quarter notes', ev: [[0, 4, 'C'], [4, 4, 'C'], [8, 4, 'C'], [12, 4, 'A']] },
  mute4: { grid: 16, name: 'four muted 8ths, four open', unit: '8th notes', ev: [...slots(0, 'C', 2, [0, 2, 4, 6]), ...slots(0, 'A', 2, [8, 10, 12, 14])] },
  acc13: { grid: 16, name: '8ths, open on 1 and 3', unit: '8th notes', ev: [0, 2, 4, 6, 8, 10, 12, 14].map(s => [s, 2, s === 0 || s === 8 ? 'A' : 'C']) },
  offs: { grid: 16, name: 'muted on the beat, open chord on the "&"', unit: '8th notes', ev: [0, 2, 4, 6, 8, 10, 12, 14].map(s => [s, 2, s % 4 === 2 ? 'A' : 'C']) },
  trip: { grid: 12, name: 'triplets', unit: '8th-note triplets', ev: slots(12, 'C', 1) },
  tripAcc: { grid: 12, name: 'triplets, open on the first of each beat', unit: '8th-note triplets', ev: slots(12, 'C', 1).map(([s, l]) => [s, l, s % 3 === 0 ? 'A' : 'C']) },
  gallop: { grid: 16, name: 'gallops (8th + two 16ths)', unit: '8th + two 16ths', ev: [0, 4, 8, 12].flatMap(b => [[b, 2, 'C'], [b + 2, 1, 'C'], [b + 3, 1, 'C']]) },
  revG: { grid: 16, name: 'reverse gallops with rests', unit: 'two 16ths + 8th', ev: [0, 8].flatMap(b => [[b, 1, 'C'], [b + 1, 1, 'C'], [b + 2, 2, 'C']]) },
  revG4: { grid: 16, name: 'reverse gallops on every beat', unit: 'two 16ths + 8th', ev: [0, 4, 8, 12].flatMap(b => [[b, 1, 'C'], [b + 1, 1, 'C'], [b + 2, 2, 'C']]) },
  burst5: { grid: 16, name: 'bursts of five 16ths', unit: '16th notes', ev: [...slots(0, 'C', 1, [0, 1, 2, 3, 4]), ...slots(0, 'C', 1, [8, 9, 10, 11, 12])] },
  s16: { grid: 16, name: 'continuous 16ths', unit: '16th notes', ev: slots(16, 'C', 1) },
  s16acc: { grid: 16, name: '16ths, open on 1 and 3', unit: '16th notes', ev: slots(16, 'C', 1).map(([s, l]) => [s, l, s === 0 || s === 8 ? 'A' : 'C']) },
  sw8: { grid: 16, name: 'alternating strings in 8ths', unit: '8th notes', ev: [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => [s, 2, i % 2 ? 'S' : 'C']) },
  sw16: { grid: 16, name: 'alternating strings in 16ths', unit: '16th notes', ev: slots(16, 'C', 1).map(([s, l]) => [s, l, s % 2 ? 'S' : 'C']) },
  swRest: { grid: 16, name: 'string changes with rests', unit: '16th notes', ev: [[0, 1, 'C'], [1, 1, 'S'], [4, 1, 'C'], [5, 1, 'S'], [8, 1, 'C'], [9, 1, 'S'], [12, 1, 'C'], [13, 1, 'S']] },
  pedal: { grid: 16, name: 'pedal 16ths with stabs', unit: '16th notes', ev: slots(16, 'C', 1).map(([s, l]) => [s, l, s === 6 || s === 14 ? 'T' : 'C']) },
  pedal8: { grid: 16, name: 'pedal 8ths with stabs', unit: '8th notes', ev: [0, 2, 4, 6, 8, 10, 12, 14].map(s => [s, 2, s === 6 || s === 14 ? 'T' : 'C']) },
  gallopAcc: { grid: 16, name: 'gallops, open on 1', unit: '8th + two 16ths', ev: [0, 4, 8, 12].flatMap(b => [[b, 2, b === 0 ? 'A' : 'C'], [b + 2, 1, 'C'], [b + 3, 1, 'C']]) }
};
export const PROG = {
  one: () => [0, 0, 0, 0],
  two: () => [0, 3, 0, 3],
  rock: c => (c.minor ? [0, 8, 10, 0] : [0, 10, 5, 0]),
  rock2: c => (c.minor ? [0, 3, 5, 7] : [0, 5, 7, 5]),
  thrash: c => (c.minor ? [0, 1, 0, 8] : [0, 5, 0, 10])
};
const cname = pc => nameOf(pc) + '5';
const bars = (offs, pat, reps = 1, stab = null) => Array.from({ length: reps }, () => offs.map((off, i) => ({ off, pat: Array.isArray(pat) ? pat[i % pat.length] : pat, stab: stab == null ? null : Array.isArray(stab) ? stab[i % stab.length] : stab }))).flat();

/** One exercise: spec { bars: (c) => [{off, pat, stab}], keys, size, name, unit, goal, start, why, instr, watch, simplify, minutes }. */
export function dpRun(c, id, method, spec) {
  const notes = [], used = []; let t = 0, near = 0;
  const size = typeof spec.size === 'function' ? spec.size(c) : spec.size || 2;
  let unit = null;
  for (const ko of spec.keys || [0]) {
    const k = mod12(c.key + ko), list = spec.bars(c);
    for (const b of list) {
      const root = mod12(k + b.off), pl = place(root, near); if (!pl) return null;
      const P = PAT[b.pat], step = 4 / P.grid, pcs = [root, mod12(root + 7)]; unit = unit || P.unit;
      for (const [sl, len, kind] of P.ev) {
        const T = t + sl * step, D = Math.min(len * step, kind === 'A' || kind === 'T' ? 4 : 0.5);
        if (kind === 'C') notes.push(tag(N(pl.rs, pl.f, T, D, 'pm', { pick: 'd' }), pcs));
        else if (kind === 'S') notes.push(tag(N(pl.rs - 1, pl.f + 2, T, D, 'pm', { pick: 'd' }), pcs));
        else if (kind === 'A') [[pl.rs, pl.f], ...(size > 1 ? [[pl.rs - 1, pl.f + 2]] : []), ...(size > 2 ? [[pl.rs - 2, pl.f + 2]] : [])].forEach(([s, f]) => notes.push(tag(N(s, f, T, Math.min(len * step, 1), null, { chord: true, pick: 'd' }), pcs)));
        else if (kind === 'T') {
          const sr = mod12(k + (b.stab != null ? b.stab : 5)), sp = place(sr, pl.f); if (!sp) return null;
          [[sp.rs, sp.f], [sp.rs - 1, sp.f + 2]].forEach(([s, f]) => notes.push(tag(N(s, f, T, Math.min(len * step, 1), null, { chord: true, pick: 'd' }), [sr, mod12(sr + 7)])));
        }
      }
      used.push(cname(root)); near = pl.f; t += 4;
    }
  }
  if (notes.length < 6 || notes.length > 400) return null;
  const uniq = [...new Set(used)], keyName = `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`;
  const fill = x => String(x).replace(/\{chords\}/g, uniq.slice(0, 6).join(' – ')).replace(/\{key\}/g, keyName);
  return make(c, {
    id, name: fill(spec.name), domain: 'picking', method, unit: spec.unit || unit, goal: spec.goal, start: spec.start, minutes: spec.minutes || 5, picking: 'down',
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, backing: used, chords: uniq, tab: { notes }
  });
}
const ST = (concept, why, theory) => ({ concept, why, theory });
const G = (id, method, spec) => c => dpRun(c, id, method, typeof spec === 'function' ? spec(c) : spec);
const R = (pat, reps = 1, stab = null) => c => bars(PROG.one(), pat, reps, stab);
const RK = (prog, pat, reps = 1, stab = null) => c => bars(PROG[prog](c), pat, reps, stab);

/* ------------------------------ Foundations ------------------------------ */
const quarters = G('dp-quarters', 'accurate-reps', { name: 'Quarter-note downstrokes on the low string ({chords})', bars: R('q', 1), goal: 80, start: 50, minutes: 4,
  why: 'Teachers start with slow downstrokes on one low string so you can feel the whole motion: the pick strikes down and returns above the string without touching it.',
  instr: 'Rest the picking hand lightly at the bridge, pick the low string with a small downstroke from the wrist, and let the pick return above the string on the silent up-trip. One stroke per click, four bars. Pass: 4 bars where every note has the same volume and the up-trip never touches a string.',
  watch: 'Moving the whole forearm instead of the wrist.', simplify: 'One stroke every two clicks.' });
const rests = G('dp-rest', 'chunking', { name: 'Quarters with built-in rests ({chords})', bars: R('q3', 2), goal: 80, start: 50, minutes: 4,
  why: 'A rest after three notes gives the hand a moment to release tension before it builds.',
  instr: 'Play three muted downstrokes and rest on beat 4; use the rest to relax your hand and check the pick clears the strings. Pass: 8 bars with each rest silent and the hand loose.',
  watch: 'Letting the rest ring or the hand tense up.', simplify: 'Play one note and rest for three.' });
const e8one = G('dp-e8-one', 'accurate-reps', { name: 'Steady 8th-note downstrokes ({chords})', bars: R('e8', 2), goal: 100, start: 60,
  why: 'The next step in every source is the same note twice per click, still with downstrokes and the same small motion.',
  instr: 'Two downstrokes per click on the low string, palm-muted. Keep each stroke the same volume and the pick travel small. Pass: 8 bars at the goal tempo with no stroke louder than another.',
  watch: 'Digging in harder as you speed up.', simplify: 'A mix of quarters and 8ths (two 8ths on beat 3).' });
const mix = G('dp-mix', 'chunking', { name: 'Quarters and paired 8ths ({chords})', bars: R('mix48', 4), goal: 95, start: 60,
  why: 'Mixing a pair of 8ths into a bar of quarters is the transition from slow to fast strokes without changing the motion.',
  instr: 'Quarter notes on beats 1, 2 and 4, two 8th notes on beat 3. Watch for tension as you reach the pair. Pass: 16 bars with the 8ths exactly even.',
  watch: 'Rushing the pair of 8ths.', simplify: 'Replace the pair with a quarter note and add it back in the last four bars.' });
const e8shift = G('dp-e8-shift', 'chunking', c => ({ name: 'Downpicked 8ths with power chord shifts ({key}: {chords})', bars: c2 => bars(PROG.two(), 'e8', 4), goal: 100, start: 60,
  why: 'Changing from one root to another with exactly the same picking is the real use of the technique: the picking hand does not care what the fretting hand does.',
  instr: 'Two bars of 8th-note chugs on the root, then two bars on the note a minor third higher, keeping the identical picking. Pass: 8 bars with the first stroke after each change no louder than the others.',
  watch: 'Digging in on the first stroke after a change.', simplify: 'Four bars on each root.' }));
const depth = G('dp-pm-depth', 'chunking', { name: 'Three muted, one open ({chords})', bars: R('chug3', 4), goal: 90, start: 55,
  why: 'Resting the palm at the bridge keeps the notes tight; lifting it for one chord lets it ring. The mute should come back right after the chord.',
  instr: 'Palm-mute three downstrokes, then lift the hand and strum a power chord on beat 4 (let it sustain), and re-mute at once. Pass: 8 bars where the chord rings and the next chug is tight again.',
  watch: 'Resting the palm too far back (no mute) or too far forward (a dead click).', simplify: 'Make the chord a single note.' });
const lift = G('dp-pm-lift', 'accurate-reps', { name: 'Four muted, four open ({chords})', bars: R('mute4', 4), goal: 100, start: 60,
  why: 'The hand bounces between muted and open, letting you accent without picking harder.',
  instr: 'Four muted 8ths, then lift the palm for four open power chords, keeping every stroke the same size. Practise each four-note group separately before joining them. Pass: 8 bars where the muted and open groups are clearly different in tone but equal in strength.',
  watch: 'Picking harder on the open strokes.', simplify: 'Two muted, two open.' });
const equal = G('dp-equal', 'accurate-reps', c => ({ name: 'Equal strokes with accents on 1 and 3 ({chords})', bars: R('acc13', 4), goal: 100, start: 60,
  why: 'Accents come from easing off the mute, not from picking harder; every stroke stays the same size.',
  instr: 'Play 8ths, muting each stroke except beats 1 and 3, where you lift the palm slightly. Pass: 8 bars with clear accents and no change in picking strength.',
  watch: 'Digging in for the accent.', simplify: 'An accent on beat 1 only.' }));
const offbeat = G('dp-offs', 'transfer', { name: 'Chords on the off-beats over a downpicked riff ({key}: {chords})', size: 3, bars: RK('rock', 'offs', 2), goal: 100, start: 60,
  why: 'Stressing the off-beats with open power chords gives the muted chugs a pushing, syncopated feel; it is a first real riff.',
  instr: 'Muted chugs on the beats, open power chords on the "&"s, all downstrokes, over the four chords. Pass: 8 bars with every chord on the "&" and no rushing.',
  watch: 'Letting the chord on the "&" run into the next chug.', simplify: 'Chords on the "&" of 2 and 4 only.' });

/* ------------------------------ Intermediate ------------------------------ */
const trip1 = G('dp-trip-one', 'chunking', { name: 'Downpicked triplets ({chords})', bars: R('trip', 2), goal: 80, start: 50,
  why: 'Triplet downstrokes are faster than 8ths and slower than 16ths: the next rung on the ladder.',
  instr: 'Count 1-trip-let and play three muted downstrokes per click. Keep the hand loose; if tension appears, slow down. Pass: 8 bars of even triplets.',
  watch: 'The third stroke of each group rushing.', simplify: 'Play two triplet beats and rest two.' });
const tripP = G('dp-trip-prog', 'accurate-reps', { name: 'Triplets on a rock progression ({key}: {chords})', bars: RK('rock', 'trip', 2), goal: 80, start: 50,
  why: 'The same hand over changing roots, one bar each.',
  instr: 'Muted triplet downstrokes over the four chords, one bar each, changing on the beat with no extra volume on the first stroke. Pass: 8 bars at the goal tempo.',
  watch: 'Louder first stroke after the change.', simplify: 'Two bars per chord.' });
const tripAcc = G('dp-trip-acc', 'interleaving', { name: 'Triplets with an open chord on each beat ({key}: {chords})', size: 3, bars: RK('rock', 'tripAcc', 2), goal: 75, start: 50,
  why: 'Easing the muting palm on the first stroke of each triplet makes accents without picking harder.',
  instr: 'Triplet downstrokes, the first of each group open (palm lifted slightly), the other two muted. Pass: 8 bars with a clear accent on each beat.',
  watch: 'Lifting the palm too far or too late.', simplify: 'Accent every second beat.' });
const galloP = G('dp-gallop', 'chunking', { name: 'Downpicked gallops ({chords})', bars: R('gallop', 4), goal: 85, start: 55,
  why: 'The gallop is long-short-short: an 8th and two 16ths. The two short notes must be evenly spaced and the long note is longer, not louder.',
  instr: 'All downstrokes: one on the beat, two quick ones after it, repeated on every beat. Count 1 (e) (&) (a) aloud. Pass: 8 bars with the two short notes the same distance apart.',
  watch: 'Rushing the short notes.', simplify: 'Two beats of gallops, two of quarters.' });
const revG = G('dp-revgallop', 'chunking', { name: 'Reverse gallops with rests ({chords})', bars: R('revG', 4), goal: 85, start: 55,
  why: 'A reverse gallop is short-short-long; resting on beats 2 and 4 gives the hand time to recover before the next group.',
  instr: 'Two quick 16ths then an 8th on beats 1 and 3, resting on 2 and 4, all downstrokes. Make each rest instantly silent. Pass: 8 bars with the rests silent and the groups even.',
  watch: 'Rests that still ring.', simplify: 'Play only beat 1 of each bar.' });
const burst = G('dp-burst', 'chunking', { name: 'Bursts of five 16ths with rests ({chords})', bars: R('burst5', 4), goal: 70, start: 45,
  why: 'Short bursts of fast downstrokes with a rest after each build speed without letting tension pile up.',
  instr: 'Five muted 16th downstrokes, then rest for the other three 16ths of the beat; repeat on beats 3 and 4. Use the rest to relax. Pass: 8 bars where every burst is even and the rests are silent.',
  watch: 'Tensing the hand across the burst.', simplify: 'Bursts of three.' });
const s16short = G('dp-s16-short', 'accurate-reps', { name: 'Continuous 16ths for two bars ({chords})', bars: R('s16', 1), goal: 70, start: 45,
  why: 'The first step toward sustained 16ths: a short continuous run, repeated with rests between.',
  instr: 'Play four bars of continuous muted 16th downstrokes, then rest and shake out your hand. Pass: 4 bars with every stroke even and no tension at the end.',
  watch: 'Speeding up as the bar goes on.', simplify: 'Triplets instead.' });
const sw8 = G('dp-sw8', 'chunking', { name: 'Alternating two strings in 8ths ({chords})', bars: R('sw8', 4), goal: 95, start: 60,
  why: 'Changing string keeps the same muting palm contact; if one string sounds more open than the other, change the pressure, not the hand position.',
  instr: 'Alternate the root string and the string above (the fifth), all downstrokes, 8ths. Pass: 8 bars where both strings have the same chug.',
  watch: 'Picking the wrong string at speed.', simplify: 'Slow with a pause after each switch.' });
const sw16 = G('dp-sw16', 'chunking', { name: 'String changes in 16ths with rests ({chords})', bars: R('swRest', 4), goal: 70, start: 45,
  why: 'A rest after each string switch lets you reset before the next, which is how the sources build this skill.',
  instr: 'Play the root string and the string above in 16ths, resting for two 16ths after each pair. Pass: 8 bars with both strings equally muted and no extra string noise.',
  watch: 'Extra string noise at the switch.', simplify: 'Slower with a longer rest.' });
const riff1 = G('dp-riff-one', 'transfer', { name: 'A downpicked riff: chugs, gallops and open chords ({key}: {chords})', size: 3, bars: RK('rock', ['acc13', 'gallop', 'offs', 'gallopAcc'], 2), goal: 95, start: 60, minutes: 6,
  why: 'Using the picking in a real riff: 8ths with accents, a gallop, off-beat chords and a gallop accent.',
  instr: 'All downstrokes through the four-bar riff, repeated, with the palm lifting on the accents. Pass: 8 bars with every stroke even and the accents clear.',
  watch: 'Letting the gallop speed up the rest of the bar.', simplify: 'Two bars at a time.' });
const pedalStab = G('dp-pedal-stab', 'transfer', { name: 'Chord stabs over a muted pedal note ({key}: {chords})', size: 2, bars: c => bars(PROG.one(), 'pedal8', 2, [5, 3, 5, 7]), goal: 95, start: 60,
  why: 'Two-string chord stabs on top of a muted pedal note: the stab sounds, then the mute returns at once.',
  instr: 'Muted 8ths on the root, and a power-chord stab on the "&" of 2 and 4. Practise the stabs alone first. Pass: 8 bars where each stab is clear and the next chug is tight.',
  watch: 'Flamming the stab.', simplify: 'One stab per bar.' });

/* ------------------------------- Advanced ------------------------------- */
const stam16 = G('dp-stam-16', 'accurate-reps', { name: 'Eight bars of continuous 16ths ({chords})', bars: R('s16', 2), goal: 85, start: 55, minutes: 6,
  why: 'Stamina: eight bars of unbroken 16th downstrokes, lengthening the runs gradually.',
  instr: 'Play 8 bars without stopping, relaxing the hand and keeping each stroke the same strength; if the tone gets harsher, reduce pick travel before slowing down. Pass: 8 bars at the goal tempo.',
  watch: 'Digging in as the hand tires.', simplify: 'Four bars with a bar rest.' });
const stam8 = G('dp-stam-8', 'accurate-reps', { name: 'Long runs of 8ths over changes ({key}: {chords})', bars: RK('rock', 'e8', 4), goal: 130, start: 90, minutes: 6,
  why: 'A longer run of 8ths over the changes, the picking never adjusted.',
  instr: 'Palm-muted 8ths over the progression, 16 bars, no stops. Pass: 16 bars with the picking identical on every chord.',
  watch: 'Louder first stroke after a change.', simplify: 'Eight bars.' });
const acc16 = G('dp-acc16', 'chunking', { name: 'Accents in 16ths made by easing the mute ({chords})', size: 3, bars: R('s16acc', 2), goal: 85, start: 55,
  why: 'In continuous 16ths the accents come from easing the palm on chosen strokes, never from picking harder.',
  instr: 'Continuous 16ths, with the palm lifting on beats 1 and 3. Pass: 4 bars where the accents are clear and every stroke is equal.',
  watch: 'Picking harder on the accents.', simplify: 'An accent on beat 1 only.' });
const acc16p = G('dp-acc16-prog', 'interleaving', { name: 'Accented 16ths over changes ({key}: {chords})', size: 3, bars: RK('rock', 's16acc', 1), goal: 85, start: 55,
  why: 'The accent pattern holds across a change of root.',
  instr: 'Accented 16ths over the four chords, one bar each. Pass: 4 bars (a pass) three times in a row.',
  watch: 'Losing the accent after the change.', simplify: 'Two bars per chord.' });
const pedal16 = G('dp-pedal-16', 'chunking', { name: 'Pedal 16ths with stabs ({key}: {chords})', size: 2, bars: RK('rock2', 'pedal', 1, [3, 5, 7, 5]), goal: 80, start: 50,
  why: 'The pedal note in 16ths with a stab of another chord on chosen 16ths: the stab and the mute change in one stroke.',
  instr: 'Muted 16ths on the root and open stabs on the "e" of 2 and 4. Pass: 4 bars with the stabs clear and the mute back at once.',
  watch: 'Being slow to re-mute.', simplify: 'Play it in 8ths.' });
const pedalGallop = G('dp-pedal-gallop', 'transfer', { name: 'Gallop riff with open chord stabs ({key}: {chords})', size: 3, bars: RK('rock2', ['gallopAcc', 'gallop'], 2), goal: 90, start: 60,
  why: 'The gallop with an open chord on the long note, then plain gallops, over a progression.',
  instr: 'All downstrokes: gallops on every beat, with the palm lifting on beat 1 of the accented bars. Pass: 8 bars with the gallops even and the accents clear.',
  watch: 'The short notes rushing.', simplify: 'Gallops on beats 1 and 3 only.' });
const thrash1 = G('dp-thrash-one', 'transfer', { name: 'Thrash riff: gallops, 8ths and open hits ({key}: {chords})', size: 3, bars: RK('thrash', ['gallop', 'acc13', 'gallop', 'offs'], 2), goal: 95, start: 60, minutes: 6,
  why: 'A thrash-style riff in all downstrokes, moving between the gallop, 8ths and off-beat chords.',
  instr: 'Play the four-bar riff twice, all downstrokes, palm lifting only on the open chords. Pass: 8 bars with the rhythms switching on the barline and no extra volume.',
  watch: 'Changing the picking motion between rhythms.', simplify: 'Two bars at a time.' });
const thrash2 = G('dp-thrash-two', 'interleaving', { name: 'Reverse gallops and 8ths over a minor-second riff ({key}: {chords})', size: 3, bars: RK('thrash', ['revG4', 'e8', 'revG', 'mute4'], 2), goal: 95, start: 60, minutes: 6,
  why: 'The reverse gallop alternating with 8ths and the mute/open switch, over chords a half step apart.',
  instr: 'All downstrokes through the riff, with rests exactly silent. Pass: 8 bars with the groups even and the open chords clean.',
  watch: 'Rests that still ring.', simplify: 'Half the riff.' });

/* ------------------------------- Mastery ------------------------------- */
const tempo8 = G('dp-tempo-8', 'accurate-reps', { name: 'Downpicked 8ths at performance tempo ({key}: {chords})', bars: RK('rock', 'e8', 3), goal: 160, start: 110, minutes: 6,
  why: 'The tempo where a downpicker is tested: 8ths held for twelve bars.',
  instr: 'Palm-muted all-downstroke 8ths for 12 bars over the progression. Raise the click only while the hand stays relaxed. Pass: 12 bars at the goal tempo.',
  watch: 'Speeding up when it feels good.', simplify: 'Drop 10 BPM.' });
const tempo16 = G('dp-tempo-16', 'chunking', { name: 'Downpicked 16ths at tempo ({chords})', bars: R('s16', 1), goal: 100, start: 70, minutes: 6,
  why: 'The 16th-note downstroke at a tempo you would use on stage.',
  instr: 'Four bars of continuous muted 16th downstrokes, then a rest bar to shake out. Pass: four bars at the goal tempo with even strokes.',
  watch: 'Harsh tone from digging in.', simplify: 'Drop 10 BPM.' });
const cell = G('dp-cell', 'accurate-reps', { name: 'Loop one cell until it stays clean ({key}: {chords})', size: 3, bars: RK('rock', 'gallopAcc', 2), goal: 110, start: 75, minutes: 6,
  why: 'The sources agree on one practice method: find a tempo where one bar is perfect for 20–30 seconds, loop it for 2–3 minutes, and lower the tempo if it breaks down.',
  instr: 'Loop the gallop bar with the open accent until the spacing, attack and rests stay the same for 2–3 minutes. Pass: 3 minutes with no change in tone or spacing.',
  watch: 'Raising the tempo because it feels easy.', simplify: 'Drop 10 BPM and restart the timer.' });
const mixAll = G('dp-mix-all', 'interleaving', { name: 'A different rhythm every bar ({key}: {chords})', size: 3, bars: RK('rock', ['gallop', 'trip', 'revG4', 'e8'], 2), goal: 100, start: 65, minutes: 6,
  why: 'The picking hand switches between gallops, triplets, reverse gallops and 8ths with no change in motion.',
  instr: 'Play 8 bars with a different rhythm every bar, all downstrokes. Pass: 8 bars with the rhythm changing on the barline and the strokes equal.',
  watch: 'Stumbling at the switch.', simplify: 'Two rhythms.' });
const study8 = G('dp-cap-8', 'transfer', { name: 'Study: an 8-bar downpicked riff ({key}: {chords})', size: 3, bars: RK('thrash', ['gallopAcc', 'acc13', 'revG4', 'offs', 'gallop', 'mute4', 'trip', 'e8'], 1), goal: 110, start: 75, minutes: 7,
  why: 'An original riff using the whole path: gallops, 8ths with accents, reverse gallops, off-beat chords, the mute/open switch and triplets.',
  instr: 'Learn it two bars at a time, then as one piece, all downstrokes. Pass: one clean pass at the goal tempo, then your own version on the same chords.',
  watch: 'Rushing the triplet bar.', simplify: 'Bars 1–4.' });
const study12 = G('dp-cap-12', 'transfer', { name: 'Capstone: a 12-bar downpicked riff ({key}: {chords})', size: 3, bars: c => bars(PROG.rock2(c).concat(PROG.thrash(c)).concat(PROG.rock(c)), ['gallopAcc', 'offs', 'gallop', 'revG4', 'acc13', 'mute4', 'gallop', 'trip', 'e8', 'gallopAcc', 'offs', 'e8'], 1), goal: 110, start: 75, minutes: 8,
  why: 'The whole path in twelve bars, all downstrokes, with different rhythms and roots.',
  instr: 'Learn it in three four-bar phrases, then join them, then write your own twelve bars on the same chords. Pass: the study at the goal tempo with the strokes equal, then your own version once.',
  watch: 'Losing the place when the root changes.', simplify: 'Bars 1–8.' });

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'downpicking', kind: 'technique', title: 'Downpicking endurance (metal and punk rhythm)', domain: 'picking',
  re: /down.?pick(ing)?|all.?down(stroke)?s?|down.?strokes? (picking|only)|thrash rhythm|endurance picking/,
  aliases: ['downstroke picking', 'down picking', 'all downstrokes', 'thrash rhythm picking', 'downpicking endurance', 'metal rhythm picking'],
  summary: 'All-downstroke picking on palm-muted chugs: the small motion, rests, 8ths, triplets, gallops, 16th bursts and string changes, accents made by easing the mute, and the stamina to keep it going.',
  prereqs: [],
  sources: [
    'https://www.musicradar.com/how-to/30-day-guitar-challenge-day-16-improve-your-metal-downpicking-speed',
    'https://www.guitarworld.com/lessons/techniques/downpicking',
    'https://cursa.app/en/page/basic-metal-rhythm-foundations-downpicking-endurance-gallops-and-palm-muted-riffs',
    'https://fretjam.com/fast-palm-mute.html'
  ],
  pedagogy: {
    date: '2026-10-29',
    summary: 'Taught from a small motion: start with slow downstrokes on one low string, with the pick clearing the strings on the silent up-trip, then add rests so the hand can relax, 8ths, off-beat power chords, triplets, 16ths in short bursts, gallops, string changes and long runs. Accents come from easing the palm, never from picking harder. Practice is short cells looped at a tempo you can hold, lowering the tempo when the tone or spacing drifts.',
    sequence: [
      { id: 'motion', tier: 'foundations', step: 'The small downstroke that clears the strings', how: 'Quarter-note downstrokes on the low string with a small wrist motion and the pick returning above the string; rests built in to relax the hand.', skills: ['dp-motion'], source: 1 },
      { id: 'eights', tier: 'foundations', step: 'Eighth notes and shifts, all downstrokes', how: 'The same note twice per click, then power chord shifts with the picking unchanged.', skills: ['dp-eights'], source: 2 },
      { id: 'mute', tier: 'foundations', step: 'Palm-mute depth and lifting for open chords', how: 'Muted notes with a sustained chord, and switching between muted and open groups.', skills: ['dp-pm'], source: 0 },
      { id: 'equal', tier: 'foundations', step: 'Equal strokes and off-beat power chords', how: 'Accents on chosen beats and power chords on the off-beats, every stroke equal.', skills: ['dp-accent'], source: 1 },
      { id: 'triplets', tier: 'intermediate', step: 'Triplet downstrokes', how: 'Three downstrokes per beat on the low string, then on a progression and with accents.', skills: ['dp-trip'], source: 0 },
      { id: 'gallops', tier: 'intermediate', step: 'Gallops and reverse gallops', how: 'Long-short-short and short-short-long, with the short notes evenly spaced, and rests to recover.', skills: ['dp-gal'], source: 2 },
      { id: 'sixteenths', tier: 'intermediate', step: 'Sixteenths in short bursts', how: 'Five-note bursts with rests between, then short continuous runs.', skills: ['dp-16'], source: 0 },
      { id: 'strings', tier: 'intermediate', step: 'String changes with the same mute', how: 'Alternating two adjacent strings in 8ths, then in 16ths with rests after each switch.', skills: ['dp-string'], source: 2 },
      { id: 'riffs', tier: 'intermediate', step: 'Riffs and chord stabs over a pedal note', how: 'Applying the picking in a riff, and short chord stabs on top of muted pedal notes.', skills: ['dp-riff'], source: 2 },
      { id: 'stamina', tier: 'advanced', step: 'Long runs', how: 'Lengthening runs of 8ths and 16ths, reducing pick travel before lowering the tempo.', skills: ['dp-stam'], source: 2 },
      { id: 'accents16', tier: 'advanced', step: 'Accents in 16ths by easing the mute', how: 'Continuous 16ths with the palm lifting on chosen strokes.', skills: ['dp-acc'], source: 1 },
      { id: 'pedal', tier: 'advanced', step: 'Pedal riffs and gallop riffs', how: 'Stabs on chosen 16ths over a pedal note, and gallops with open accents.', skills: ['dp-pedal'], source: 2 },
      { id: 'thrash', tier: 'advanced', step: 'Thrash riffs', how: 'Gallops, 8ths, reverse gallops and off-beat chords combined in one all-downstroke riff.', skills: ['dp-thrash'], source: 1 },
      { id: 'tempo', tier: 'mastery', step: 'Performance tempo', how: '8ths and 16ths at performance speed, raising the click only while relaxed.', skills: ['dp-tempo'], source: 0 },
      { id: 'cells', tier: 'mastery', step: 'Looped cells and mixed rhythms', how: 'Loop one cell at a tempo you can hold for 20–30 seconds, then for minutes; then mixed rhythms.', skills: ['dp-endure'], source: 2 },
      { id: 'capstone', tier: 'mastery', step: 'A full downpicked riff', how: 'Eight- and twelve-bar riffs using the whole technique.', skills: ['dp-cap'], source: 1 }
    ],
    drills: ['Quarter-note downstrokes on the low E string with built-in rest bars', 'Three muted downstrokes then a sustained power chord', 'Eighth-note triplet downstrokes, then 16th-note bursts of five', 'Reverse gallops with rests on 2 and 4', 'Alternating string patterns in 8ths and 16ths with rests after the switch', 'Two-string chord stabs over a muted pedal note', 'Looping a single bar for 2–3 minutes'],
    mistakes: ['Rushing the tempo', 'Tensing the picking hand', 'Letting the silent up-trip catch a string', 'Pressing the palm too hard or too far across the strings', 'Digging in harder as the hand tires', 'A louder first stroke after a chord change', 'Rests that still ring'],
    sources: [
      { title: 'Improve your metal downpicking speed', author: 'Charlie Griffiths (MusicRadar)', url: 'https://www.musicradar.com/how-to/30-day-guitar-challenge-day-16-improve-your-metal-downpicking-speed' },
      { title: 'Downpicking', author: 'Guitar World', url: 'https://www.guitarworld.com/lessons/techniques/downpicking' },
      { title: 'Basic metal rhythm foundations: downpicking endurance, gallops and palm-muted riffs', author: 'Cursa', url: 'https://cursa.app/en/page/basic-metal-rhythm-foundations-downpicking-endurance-gallops-and-palm-muted-riffs' },
      { title: 'Fast palm muting', author: 'FretJam', url: 'https://fretjam.com/fast-palm-mute.html' }
    ]
  },
  ctx: { key: 4, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The small downstroke',
      'Slow quarter-note downstrokes with built-in rests, steady downpicked 8ths with root shifts, palm-muted chugs with open chords, and off-beat power chords over a riff, 8 bars at 100 BPM with every stroke the same size.', [
        S('dp-motion', 'The small downstroke', 'picking', 'Quarter-note downstrokes with the pick clearing the strings.', [quarters, rests],
          ST('A downpicked note is a small downward stroke from the wrist, after which the pick returns above the string without touching it (the silent "ghost" upstroke). Every stroke should have the same angle and speed.', 'This one motion carries every rhythm later: if it is clean, the speed is only a matter of time.', ['Pick travel small, from the wrist.', 'The up-trip clears the strings.', 'Rests are for relaxing the hand.'])),
        S('dp-eights', 'Eighth notes, all downstrokes', 'picking', 'Two strokes per click, and power chord shifts with identical picking.', [e8one, mix, e8shift],
          ST('Eighth notes with downstrokes only are the same motion twice as often. Moving the fretting hand to another root must not change the picking.', 'It proves that picking and fretting are separate jobs.', ['Same volume for every stroke.', 'The first stroke after a change is no louder.', 'Reduce pick travel before lowering the tempo.'])),
        S('dp-pm', 'Palm-mute depth', 'rhythm', 'Muted chugs and lifting for an open chord.', [depth, lift],
          ST('The side of the picking hand rests on the strings at the bridge to make short, tight notes. Lifting it a little lets a chord ring; putting it back tightens the next note.', 'The palm is a second voice: it shapes the sound while the pick keeps time.', ['Closer to the bridge means more mute.', 'Too far back gives no mute; too far forward gives a click.', 'Re-mute at once after an open chord.'])),
        S('dp-accent', 'Equal strokes and off-beat chords', 'rhythm', 'Accents made by lifting the palm, and chords on the "&"s.', [equal, offbeat],
          ST('An accent in a downpicked riff comes from easing off the mute, not from picking harder. Every stroke stays the same size.', 'It keeps the hand relaxed and the tone consistent at speed.', ['Lift the palm for the accent.', 'Count 1 & 2 & aloud.', 'Chords on the "&" give a syncopated push.']))
      ]),
    stage('intermediate', 'Triplets, gallops and string changes',
      'Downpicked triplets, gallops and reverse gallops, bursts of 16ths, string changes and a riff with stabs, each over a progression for 8 bars at 85 BPM (8ths at 95).', [
        S('dp-trip', 'Triplet downstrokes', 'picking', 'Three strokes per beat.', [trip1, tripP, tripAcc],
          ST('Triplet downstrokes put three even strokes in each beat: faster than 8ths and slower than 16ths.', 'They are the stepping stone to 16ths and a staple of metal and punk rhythm.', ['Count 1-trip-let.', 'The last stroke of each group must not rush.', 'Ease the palm for the accent on the first of each beat.'])),
        S('dp-gal', 'Gallops and reverse gallops', 'rhythm', 'Long-short-short and short-short-long, all downstrokes.', [galloP, revG],
          ST('A gallop is an 8th note and two 16ths (long-short-short); a reverse gallop is two 16ths and an 8th. The two short notes must be evenly spaced and the long note longer, not louder.', 'These two cells are the vocabulary of metal rhythm.', ['Count 1 (e) (&) (a).', 'Rests between groups give the hand time to recover.', 'Make rests instantly silent.'])),
        S('dp-16', 'Sixteenths in bursts', 'picking', 'Short bursts of 16th downstrokes with rests.', [burst, s16short],
          ST('Bursts of five 16ths with a rest after each let you play fast without letting tension pile up, and then the bursts grow into continuous runs.', 'Short bursts build speed safely.', ['Relax in the rests.', 'Lengthen the burst gradually.', 'Slow down when the tone harshens.'])),
        S('dp-string', 'String changes with the same mute', 'picking', 'Alternating two adjacent strings.', [sw8, sw16],
          ST('Moving the pick to a new string must not change the palm contact. If one string sounds more open than the other, adjust the pressure slightly, not the hand position.', 'It keeps the chug consistent across a riff.', ['Practise two adjacent strings first.', 'Pause after each switch at first.', 'Avoid extra string noise.'])),
        S('dp-riff', 'Riffs and stabs', 'rhythm', 'The picking in a riff, and chord stabs over a pedal note.', [riff1, pedalStab],
          ST('A riff mixes rhythms and open chords; a pedal-note riff keeps a muted note going while chord stabs sound on top.', 'It is where the technique becomes music.', ['Palm lifts only on the open chords.', 'Practise stabs alone first.', 'The mute returns right after the stab.']))
      ]),
    stage('advanced', 'Stamina and thrash riffs',
      'Eight bars of continuous 16ths, long runs of 8ths, accents in 16ths, pedal and gallop riffs and two thrash riffs, each at 90 BPM for 8 bars with no extra volume.', [
        S('dp-stam', 'Long runs', 'picking', 'Unbroken downstrokes for many bars.', [stam16, stam8],
          ST('Stamina is built by lengthening the run of consecutive downstrokes while keeping the tone and volume steady. If the tone gets harsher, reduce pick travel before you slow down.', 'It lets you play a whole song without the hand giving out.', ['Short rests between long runs.', 'Reduce pick travel first.', 'Record yourself.'])),
        S('dp-acc', 'Accents in 16ths', 'rhythm', 'Easing the mute on chosen strokes.', [acc16, acc16p],
          ST('In continuous 16ths the accents are made by lifting the palm for chosen strokes. The picking itself stays level.', 'It is the basis of every syncopated 16th-note riff.', ['Lift for the accent, mute again at once.', 'Accents on beats 1 and 3 first.', 'Keep the stroke size equal.'])),
        S('dp-pedal', 'Pedal and gallop riffs', 'rhythm', 'Stabs on chosen strokes and gallops with open accents.', [pedal16, pedalGallop],
          ST('A pedal riff keeps the same note muted while chord stabs appear on chosen strokes; gallops can carry an open accent on the long note.', 'These are the building blocks of most metal riffs.', ['The mute returns at once.', 'Stabs are short.', 'Gallop short notes stay even.'])),
        S('dp-thrash', 'Thrash riffs', 'rhythm', 'Combinations of gallops, 8ths, reverse gallops and off-beat chords.', [thrash1, thrash2],
          ST('A thrash riff mixes the cells you know in a four-bar loop: gallops, 8ths with accents, reverse gallops and off-beat chords.', 'Switching rhythms with no change in the picking motion is the final skill.', ['Same motion for every rhythm.', 'Switch on the barline.', 'Rests exactly silent.']))
      ]),
    stage('mastery', 'Tempo, endurance and riffs',
      'Downpicked 8ths at 160 BPM and 16ths at 100 BPM, a looped cell kept clean for three minutes, and an eight- and a twelve-bar original riff at 110 BPM.', [
        S('dp-tempo', 'Performance tempo', 'picking', '8ths and 16ths at tempo.', [tempo8, tempo16],
          ST('The tempo of the whole technique is the one you can hold relaxed for many bars. Raise the click only while the hand stays loose.', 'It is the measure of whether the technique is yours.', ['Never speed up because it feels good.', 'Record yourself.', 'Rest between runs.'])),
        S('dp-endure', 'Cells and mixed rhythms', 'picking', 'Looping one bar for minutes, and switching rhythms every bar.', [cell, mixAll],
          ST('The practice method is to find a tempo where one bar is perfect for 20–30 seconds, loop it for 2–3 minutes, and lower the tempo if the spacing or attack breaks down.', 'It builds endurance with control and no bad habits.', ['A short cell, a tempo you can hold.', 'Lower the tempo and restart if it breaks.', 'Mixed rhythms test the switch.'])),
        S('dp-cap', 'A full downpicked riff', 'rhythm', 'Original riffs using the whole technique.', [study8, study12],
          ST('The final step is an arrangement of everything: gallops, 8ths with accents, reverse gallops, off-beat chords, the mute/open switch and triplets.', 'It is where the path becomes music.', ['Learn in phrases.', 'Every stroke a downstroke.', 'Write your own on the same chords.']))
      ])
  ]
});
