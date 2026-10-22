// Sweep picking fundamentals: the single continuous pick motion across neighbouring strings, taught
// from the rest stroke on two strings through the three-string and five-string arpeggio loops to
// endurance, speed, bends and taps. The companion path sweepChanges takes the same shapes through
// chord progressions; this one is the mechanics: the pick glide, the muting, the finger roll and the
// turnaround.
//
// Concept-first (CONTENT.md): the shapes are not typed in. A sweep shape is a triad (from the chord's
// notes, so any key and any quality works) stacked one note per string from a starting chord tone, with
// the extra top note on the high e string that turns the sweep around (sweepShape in sweepChanges.js).
//   - 3-string shape: strings 3-2-1 with two notes on the high e ('3top').
//   - 5-string shape: strings 5-4-3-2-1 with one note per string and two on the high e ('5top').
// The sweep cell is the shape up (one downward push, the top note hammered), the pull-off, and one
// upward push back down: 6 notes on three strings, 10 on five. Strokes follow the direction of travel.
// Every lesson below is built from these shapes (and, where a lesson adds a scale run, a bend or a tap,
// from the chord's own notes or the key's scale), so it is correct in all 12 keys.
import { OPEN, N, nameOf, minorKey, make, mod12, S, stage, entry, SCALE_BY_ID } from '../lib.js';
import { sweepShape } from './sweepChanges.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const UNIT = new Map([[0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const range = (a, b) => { const o = []; if (a <= b) for (let i = a; i <= b; i++) o.push(i); else for (let i = a; i >= b; i--) o.push(i); return o; };

/** The shape of a chord on a string set, falling back to another inversion when one doesn't fit. */
export function shapeOf(rootPc, q, set, inv = 0, near = 7) {
  const at = nr => [inv, 0, 1, 2].map(iv => sweepShape(mod12(rootPc), q, set, iv, nr)).find(Boolean) || null;
  const low = at(near);
  if (low && Math.min(...low.notes.map(n => n[1])) >= 3) return low;
  const high = at(near + 12); // shapes in the first frets sit awkwardly with the scale runs: use the octave up when there is room
  return high && Math.max(...high.notes.map(n => n[1])) <= 21 ? high : low;
}
/** A shape whose highest fret is at most `maxFret` (room above for a tapped note), trying the octave below as well. */
export function shapeBelow(rootPc, q, set, inv, near, maxFret) {
  for (const nr of [near, near - 12, near + 12]) { const sh = shapeOf(rootPc, q, set, inv, nr); if (sh && Math.max(...sh.notes.map(n => n[1])) <= maxFret) return sh; }
  for (const nr of [near, near - 12]) { const sh = [inv, 0, 1, 2].map(iv => sweepShape(mod12(rootPc), q, set, iv, nr)).find(Boolean); if (sh && Math.max(...sh.notes.map(n => n[1])) <= maxFret) return sh; }
  return null;
}
/**
 * Events (string, fret, technique, stroke) for the notes of a shape listed by index. A note on the same
 * string as the one before is slurred (hammer-on up, pull-off down); every other note is picked in the
 * direction of travel (down going up the strings, up going down them).
 */
export function run(ns, idx, firstPick = null) {
  return idx.map((k, i) => {
    const [s, f] = ns[k], prev = i ? ns[idx[i - 1]] : null;
    if (prev && prev[0] === s && prev[1] !== f) return { s, f, x: f > prev[1] ? 'h' : 'p', pk: null };
    if (prev) return { s, f, x: null, pk: s < prev[0] ? 'd' : 'u' };
    let pk = 'd'; for (let j = 1; j < idx.length; j++) { const o = ns[idx[j]]; if (o[0] !== s) { pk = o[0] < s ? 'd' : 'u'; break; } }
    return { s, f, x: null, pk: firstPick || pk };
  });
}
/** The index lists of the cells of a shape with n notes: up, the full loop, down from the top. */
export const idxUp = n => range(0, n - 1);
export const idxLoop = n => [...range(0, n - 1), ...range(n - 2, 1)];
export const idxDown = n => range(n - 1, 0);

/** A running exercise: notes laid end to end, with the allowed pitch classes recorded for the check. */
class Acc {
  constructor() { this.notes = []; this.t = 0; this.pcs = null; this.marks = 0; this.used = []; this.voic = []; }
  shape(sh) {
    this.pcs = sh.pcs; if (!this.used.includes(sh.name)) this.used.push(sh.name);
    if (!this.voic.find(v => v.name === sh.name)) { const fr = [null, null, null, null, null, null]; sh.notes.forEach(([s, f]) => { if (fr[6 - s] == null) fr[6 - s] = f; }); this.voic.push({ name: sh.name, frets: fr }); }
  }
  put(ev, step, o = {}) {
    const extra = { ...(ev.pk && this.marks > 0 ? { pick: ev.pk } : {}), ...(ev.extra || {}) };
    this.marks = Math.max(0, this.marks - 1);
    const x = this.notes.length ? ev.x : (ev.x === 'h' || ev.x === 'p' ? null : ev.x);
    this.notes.push(tag(N(ev.s, ev.f, this.t, o.d != null ? o.d : step, o.x !== undefined ? o.x : x, Object.keys(extra).length ? extra : null), o.pcs || this.pcs));
    this.t += o.adv != null ? o.adv : step;
  }
  evs(list, step, o) { list.forEach(e => this.put(e, step, o)); }
  rest(beats) { this.t += beats; }
  pad(beats) { this.t = Math.ceil((this.t - 1e-6) / beats) * beats; }
}
const loopFill = (A, cell, step, n, o) => { for (let i = 0; i < n; i++) A.put(cell[i % cell.length], step, o); };
/** Chord roots of the key's I–IV–V–I (major triads) and i–iv–♭VII–i (minor), as offsets above the root. */
const MAJ_PROG = [0, 5, 7, 0], MIN_PROG = [0, 5, 10, 0];
const root3 = c => mod12(c.key), root5 = c => minorKey(c);
const finish = (c, A, o) => {
  const last = A.notes[A.notes.length - 1];
  if (o.end !== false && last && !o.noEnd) {
    const bars = Math.ceil((A.t - 1e-6) / 4) * 4, rest = bars - A.t;
    if (rest >= 1 - 1e-6) A.notes.push(tag(N(last.s, last.f, A.t, rest, '~'), ALLOW.get(last)));
  }
  return make(c, {
    id: o.id, name: o.name, domain: o.domain || 'picking', method: o.method, unit: o.unit || UNIT.get(o.step) || '8th notes', goal: o.goal, start: o.start, minutes: o.minutes || 6, dl: o.dl || 0, picking: 'economy',
    voicings: A.voic.slice(0, 8), chords: A.used.slice(0, 8), backing: o.backing === false ? undefined : A.used.slice(0, 8),
    why: o.why, instr: o.instr, watch: o.watch, simplify: o.simplify, tab: { notes: A.notes }
  });
};
/** A major or minor triad's name for the text. */
const nm = sh => sh.name;

/* ------------------------------ Scale runs for the transfer lessons ------------------------------ */
/** A descending run: the scale's notes on the top four strings from `topMidi` downward, near fret `loFret`. */
export function scaleDown(rootPc, scaleId, topMidi, n, loFret) {
  const pcs = SCALE_BY_ID[scaleId].steps.map(x => mod12(rootPc + x));
  for (let widen = 0; widen <= 3; widen++) {
    const out = [];
    for (let p = topMidi; out.length < n && p > 40; p--) {
      if (!pcs.includes(mod12(p))) continue;
      let best = null;
      for (const s of [1, 2, 3, 4]) { const f = p - OPEN[s]; if (f >= Math.max(1, loFret - 3 - widen) && f <= loFret + 6 + widen && (!best || Math.abs(f - (loFret + 2)) < Math.abs(best[1] - (loFret + 2)))) best = [s, f]; }
      if (best) out.push({ s: best[0], f: best[1], x: null, pk: null });
    }
    if (out.length === n) return out;
  }
  return null;
}
/** Strict alternate picking marks for a run, starting with `first`. */
const alt = (evs, first = 'd') => evs.map((e, i) => ({ ...e, pk: (i % 2 === 0) === (first === 'd') ? 'd' : 'u' }));

/* ------------------------------- Foundations ------------------------------- */
/** Two chord tones on the G and B strings, ascending: one downward push, the pick resting on the next string. */
export function restUp(c) {
  const A = new Acc(), sh = shapeOf(root3(c), '', '2str', 0, 7); if (!sh) return null; A.shape(sh);
  const ev = run(sh.notes, [0, 1]); A.marks = 2;
  for (let b = 0; b < 4; b++) for (let k = 0; k < 4; k++) { A.evs(ev, 0.5); A.t = b * 4 + (k + 1); }
  return finish(c, A, {
    id: 'sp-rest-up', name: `Two-string rest strokes up: ${nm(sh)} on the G and B strings`, method: 'chunking', step: 0.5, goal: 80, start: 52, minutes: 5,
    why: 'A sweep is a rest stroke repeated across strings: the pick pushes through one string and comes to rest against the next. Learn that push on two strings before any shape.',
    instr: `Fret the two notes (G string ${sh.notes[0][1]}, B string ${sh.notes[1][1]}) and play both with ONE downstroke: the pick pushes through the G string and stops on the B string, then plays it as it moves on. Lift the pick back over the G string in the air and repeat on the next beat. Keep the motion small and relaxed. Pass: 10 pairs in a row, each pair one movement of the pick, with no pick stroke starting on the B string.`,
    watch: 'Two separate strokes: stopping after the G string, then starting a new pick stroke for the B string.', simplify: 'One note per bar, with the pick resting on the B string until the next bar.'
  });
}
/** The same two notes descending with one upward push. */
export function restDown(c) {
  const A = new Acc(), sh = shapeOf(root3(c), '', '2str', 0, 7); if (!sh) return null; A.shape(sh);
  const ev = run(sh.notes, [1, 0], 'u'); A.marks = 2;
  for (let b = 0; b < 4; b++) for (let k = 0; k < 4; k++) { A.evs(ev, 0.5); A.t = b * 4 + (k + 1); }
  return finish(c, A, {
    id: 'sp-rest-down', name: `Two-string rest strokes down: ${nm(sh)} from the B string to the G string`, method: 'chunking', step: 0.5, goal: 80, start: 52, minutes: 5,
    why: 'Going down the strings uses the same idea backwards: one upstroke that rests against the next lower string. The upstroke is the weaker motion for most players, so it gets its own lesson.',
    instr: `Play the B string (fret ${sh.notes[1][1]}) then the G string (fret ${sh.notes[0][1]}) with ONE upstroke: the pick pushes through the B string and stops on the G string. Keep the motion small and relaxed, then return to the B string in the air. Pass: 10 pairs in a row, each pair one upward movement.`,
    watch: 'Letting the upstroke become two small strokes, or tilting the pick so the second string clicks.', simplify: 'Play the upstroke pair on open strings first, then fretted.'
  });
}
/** The finger roll: the first inversion puts the same fret on the B and high e strings; one finger rolls from one to the other. */
export function rollOne(c) {
  const A = new Acc(), sh = sweepShape(root3(c), '', '3top', 1, 7); if (!sh) return null; A.shape(sh);
  const [, b, e] = sh.notes; const ev = run([b, e], [0, 1]); A.marks = 2;
  for (let beat = 0; beat < 16; beat++) { A.evs(ev, 1 / 3); A.t = beat + 1; }
  return finish(c, A, {
    id: 'sp-roll', name: `The finger roll: ${nm(sh)} first inversion, B and e strings both on fret ${b[1]}`, domain: 'fretting', method: 'accurate-reps', step: 1 / 3, goal: 85, start: 55, minutes: 6,
    why: 'When two neighbouring notes share a fret you cannot hold a flat barre: both would ring together like a strum. One finger rolls from one string to the next so only one note sounds at a time.',
    instr: `Fret the B string at fret ${b[1]} with the tip of one finger, then roll it up to the high e string (same fret) as you play the e: the finger flattens onto the e string as the B string note is released. Play the pair in triplets, one pair per beat, rest, repeat. Pass: 4 clean runs of 4 beats where each note stops completely before the next one sounds.`,
    watch: 'Keeping the barre flat, so the two notes ring into each other.', simplify: 'Play the pair as quarter notes and listen for the silence between.'
  });
}
/** Right-hand muting: alternate palm-muted and open sweeps. */
export function trailMute(c) {
  const A = new Acc(), sh = shapeOf(root3(c), '', '3top', 0, 7); if (!sh) return null; A.shape(sh);
  const ns = sh.notes, cell = run(ns, [0, 1, 2, 1]); A.marks = 4;
  for (let bar = 0; bar < 4; bar++) { for (let i = 0; i < 12; i++) A.put(cell[i % 4], 1 / 3, { x: bar % 2 === 0 ? 'pm' : null }); }
  return finish(c, A, {
    id: 'sp-trail-mute', name: `The picking palm trails the pick: palm-muted bars and open bars (${nm(sh)})`, method: 'interleaving', step: 1 / 3, goal: 90, start: 58, minutes: 5,
    why: 'In a sweep the pick pushes through the strings while the heel of the picking hand follows just behind it, damping the strings that have already sounded. This is half of what keeps the notes separate.',
    instr: 'Play the up-and-back sweep (G, B, e, B) in triplets: bars 1 and 3 with the palm resting on the strings (palm-muted), bars 2 and 4 open. Let the palm slide a little toward the bridge side of the pick, trailing it across the strings. Same tempo and touch in every bar. Pass: 2 minutes through the four bars without the tempo dropping in the muted bars.',
    watch: 'Resting the palm so hard that the notes die before they ring, or so lightly that open strings hum.', simplify: 'Muted bars only, then open bars only, before switching.'
  });
}
/** The ascending sweep with its pull-off turnaround as a short burst, then rest. */
export function upAndTurn(c) {
  const A = new Acc(), sh = shapeOf(root3(c), '', '3top', 0, 7); if (!sh) return null; A.shape(sh);
  const cell = run(sh.notes, [0, 1, 2, 3, 2]); A.marks = 5;
  for (let beat = 0; beat < 16; beat += 2) { A.t = beat; A.evs(cell, 0.25); }
  return finish(c, A, {
    id: 'sp-up-turn', name: `Sweep up, hammer and pull off: ${nm(sh)} in short 16th-note bursts`, method: 'edge', step: 0.25, goal: 90, start: 56, minutes: 6,
    why: 'Most sweep shapes turn around on the top string with a hammer-on and a pull-off, so only one pick stroke is needed to go up. Short bursts with rests let you build the turn without tension.',
    instr: `One downstroke sweeps up the G, B and e strings (frets ${sh.notes.slice(0, 3).map(n => n[1]).join(', ')}); hammer the e string note up to fret ${sh.notes[3][1]}, then pull off back. Play five notes in 16ths, then rest for the rest of the beat and the next one. Pass: 5 bursts in a row, each with the pick moving in one smooth push and no squeezing of the pick.`,
    watch: 'Squeezing the pick or stiffening the forearm as the burst gets faster.', simplify: 'Triplets, with two beats of rest.'
  });
}
/** The pull-off into the descending sweep. */
export function turnDown(c) {
  const A = new Acc(), sh = shapeOf(root3(c), '', '3top', 0, 7); if (!sh) return null; A.shape(sh);
  const cell = run(sh.notes, [3, 2, 1, 0], 'd'); A.marks = 4;
  for (let beat = 0; beat < 16; beat += 2) { A.t = beat; A.evs(cell, 0.25); }
  return finish(c, A, {
    id: 'sp-turn-down', name: `Pull off and sweep down: ${nm(sh)} from the top note to the G string`, method: 'spacing', step: 0.25, goal: 90, start: 56, minutes: 5,
    why: 'The way back down is a mirror of the way up: the pull-off sounds the lower top note and one upward push carries the pick through the B and G strings. It needs its own practice because the upstroke is less used.',
    instr: `Pick the top note (e string fret ${sh.notes[3][1]}), pull off to fret ${sh.notes[2][1]}, then one upstroke through the B and G strings. Four notes per burst, then rest. Pass: 4 bursts in a row where the pull-off is as loud as the picked note.`,
    watch: 'A weak pull-off: flick the finger sideways off the string rather than just lifting it.', simplify: 'Leave out the G string and play the pull-off and one upstroke note only.'
  });
}
/** The full three-string loop. */
export function loop3(c) {
  const A = new Acc(), sh = shapeOf(root3(c), '', '3top', 0, 7); if (!sh) return null; A.shape(sh);
  const cell = run(sh.notes, idxLoop(sh.notes.length)); A.marks = 6;
  loopFill(A, cell, 1 / 3, 48);
  return finish(c, A, {
    id: 'sp-loop3', name: `The continuous three-string loop on ${nm(sh)}`, method: 'retrieval', step: 1 / 3, goal: 100, start: 60, minutes: 7,
    why: 'Up one downward push, hammer, pull off, down one upward push, and round again: six notes, a complete cycle. Joining the parts you practised separately is the first real sweep.',
    instr: `Loop: G, B, e (down-stroke sweep, frets ${sh.notes.slice(0, 3).map(n => n[1]).join('–')}), hammer to ${sh.notes[3][1]}, pull off, then one upstroke on the B string; repeat. Triplets, two beats per loop. Keep the picking palm trailing and the pick motion small. Pass: 8 loops in a row without a stop or a ringing note.`,
    watch: 'Hurrying the top of the loop; the turn is where the time slips.', simplify: 'Two loops, a bar of rest, two loops.'
  });
}
/** Arpeggio into scale (transfer): a bar of sweeping then a bar of descending major pentatonic. */
export function sweepToScale(c) {
  const A = new Acc(), r = root3(c), sh = shapeOf(r, '', '3top', 0, 7); if (!sh) return null; A.shape(sh);
  const loop = run(sh.notes, idxLoop(sh.notes.length)); const top = sh.notes[3];
  const pent = scaleDown(r, 'majorPent', OPEN[1] + top[1] - 1, 6, Math.max(1, top[1] - 5)); if (!pent) return null;
  A.marks = 6; const penPcs = SCALE_BY_ID.majorPent.steps.map(x => mod12(r + x));
  for (let rep = 0; rep < 4; rep++) {
    A.t = rep * 8; A.pcs = sh.pcs; loopFill(A, loop, 1 / 3, 12);
    A.pcs = penPcs; for (let k = 0; k < 2; k++) pent.forEach((e, i) => A.put({ ...e, pk: i % 2 ? 'u' : 'd' }, 1 / 3, { pcs: penPcs }));
  }
  return finish(c, A, {
    id: 'sp-to-scale', name: `Sweep into a scale: ${nm(sh)} arpeggio, then a descending ${nameOf(r)} major pentatonic`, domain: 'improv', method: 'transfer', step: 1 / 3, goal: 90, start: 58, minutes: 7, backing: true,
    why: 'Sweeps are rarely played alone: they sit between scale runs. Going from the arpeggio straight into an alternate-picked scale is the first musical use.',
    instr: `Bar 1: the three-string loop twice. Bar 2: a descending ${nameOf(r)} major pentatonic run on the top strings, strictly alternate picked, played twice. Four times through without a break. The change from the sweep to alternate picking is the whole exercise: let the last upstroke of the sweep become the first note of the run. Pass: 4 times through at the goal tempo, with the pick changing from sweeping to alternate picking without a pause.`,
    watch: 'A hesitation at the bar line, where the picking changes.', simplify: 'Two bars of sweep, one of scale.'
  });
}

/* ------------------------------- Intermediate ------------------------------- */
/** The same shape moved by whole steps. */
export function shiftWhole(c) {
  const A = new Acc(); const r = root3(c), offs = [0, 2, 4, 2, 0, 2, 4, 2]; A.marks = 6;
  for (const o of offs) {
    const sh = shapeOf(r + o, '', '3top', 0, 7 + o); if (!sh) return null; A.shape(sh);
    loopFill(A, run(sh.notes, idxLoop(sh.notes.length)), 1 / 3, 6);
  }
  return finish(c, A, {
    id: 'sp-shift', name: `Moving the shape in whole steps: ${A.used.join(', ')}`, domain: 'fretboard', method: 'variable', step: 1 / 3, goal: 110, start: 66, minutes: 7,
    why: 'The shape does not change when you move it, only the chord name does. Sliding the same fingering up and down by two frets every two beats shows that one sweep shape gives you a chord on any root.',
    instr: `Play the loop once per two beats, shifting the whole shape up two frets, then up two more, then back (${A.used.join(' – ')}), and repeat. Lift the fingers just before the shift; do not drag them. The pick motion never changes. Pass: the 8 shifts twice without losing the pick stroke.`,
    watch: 'Looking at the left hand and losing the pick pattern.', simplify: 'Shift every four beats.'
  });
}
/** A six-note loop against four 16ths: the accent walks round the shape. */
export function accentLoop(c) {
  const A = new Acc(), sh = shapeOf(root3(c), '', '3top', 0, 7); if (!sh) return null; A.shape(sh);
  const cell = run(sh.notes, idxLoop(sh.notes.length)); A.marks = 6;
  loopFill(A, cell, 0.25, 64);
  return finish(c, A, {
    id: 'sp-accent', name: `Six against four: the ${nm(sh)} loop in 16ths, the accent walks round`, domain: 'rhythm', method: 'interleaving', step: 0.25, goal: 90, start: 56, minutes: 7,
    why: 'The loop has six notes but the beat has four 16ths, so each bar starts on a different note of the loop. Playing it in time with the click shows the pick motion is steady even when the pattern is not square.',
    instr: 'Play the six-note loop continuously in 16th notes for four bars. Tap your foot on every beat: the loop will start on a different note each bar (after 4 bars it is back where it began). Accent the note that lands on beat 1 of each bar. Pass: 4 bars in a row, the accent on beat 1 every time.',
    watch: 'Cutting the loop short to land on the beat: the loop must keep going.', simplify: 'Triplets, where six notes fit two beats exactly.'
  });
}
/** Short sextuplet bursts: one loop per beat, a beat of rest. */
export function burst3(c) {
  const A = new Acc(), sh = shapeOf(root3(c), '', '3top', 0, 7); if (!sh) return null; A.shape(sh);
  const cell = run(sh.notes, idxLoop(sh.notes.length)); A.marks = 6;
  for (let beat = 0; beat < 16; beat += 2) { A.t = beat; loopFill(A, cell, 1 / 6, 6); }
  return finish(c, A, {
    id: 'sp-burst3', name: `Sextuplet bursts: one ${nm(sh)} loop per beat, a beat of rest`, method: 'edge', step: 1 / 6, goal: 80, start: 52, minutes: 5,
    why: 'Short bursts let you play the loop at a speed you could not hold for long, so you can feel the motion that fast tempos need, then recover.',
    instr: 'Play one full loop (6 notes) in one beat as sextuplets, then rest for a full beat. Stay relaxed in the forearm and let the whole loop be a single wave. Pass: 6 bursts in a row, each clean and the same tempo.',
    watch: 'Tensing the forearm before the burst.', simplify: 'Triplets: two beats per loop.'
  });
}
/** The five-string sweep up: one downstroke from the A string to the high e. */
export function five_up(c) {
  const A = new Acc(), sh = shapeOf(root5(c), 'm', '5top', 0, 10); if (!sh) return null; A.shape(sh);
  const cell = run(sh.notes, idxUp(sh.notes.length)); A.marks = 6;
  for (let beat = 0; beat < 16; beat += 4) { A.t = beat; A.evs(cell, 0.5); }
  return finish(c, A, {
    id: 'sp-5-up', name: `The five-string sweep up: ${nm(sh)} from the A string to the high e`, method: 'chunking', step: 0.5, goal: 85, start: 55, minutes: 6,
    why: 'Five strings means a longer push of the pick and more notes to damp. Learn the way up first, one downstroke, hammering the last note.',
    instr: `Start on the A string (fret ${sh.notes[0][1]}) and push the pick through D, G, B and e (frets ${sh.notes.slice(1, 5).map(n => n[1]).join(', ')}), hammer the top note up to fret ${sh.notes[5][1]}. After each note, release that finger and let the palm damp the string behind the pick. Play at 8ths then rest the rest of the bar. Pass: 10 clean sweeps up in a row, each note separate.`,
    watch: 'Strumming the first three strings: the A, D and G notes must be separate.', simplify: 'Three strings (G, B, e) only.'
  });
}
/** The five-string sweep down. */
export function five_down(c) {
  const A = new Acc(), sh = shapeOf(root5(c), 'm', '5top', 0, 10); if (!sh) return null; A.shape(sh);
  const cell = run(sh.notes, [5, 4, 3, 2, 1, 0], 'd'); A.marks = 6;
  for (let beat = 0; beat < 16; beat += 4) { A.t = beat; A.evs(cell, 0.5); }
  return finish(c, A, {
    id: 'sp-5-down', name: `The five-string sweep down: ${nm(sh)} from the top note to the A string`, method: 'chunking', step: 0.5, goal: 85, start: 55, minutes: 6,
    why: 'The mirror of the way up: a pull-off and one upstroke that runs through four strings.',
    instr: `Pick the top note (e string fret ${sh.notes[5][1]}), pull off to fret ${sh.notes[4][1]}, and sweep up-stroke through B, G, D and A (frets ${[3, 2, 1, 0].map(i => sh.notes[i][1]).join(', ')}) with one push. Release each finger as the pick passes. Pass: 10 clean sweeps down in a row, each note separate, with the upstroke finishing on the A string.`,
    watch: 'Letting the pick bounce off the top strings and start a second stroke.', simplify: 'Four strings (e, B, G, D).'
  });
}
/** The turn: strings 2 and 1 and the pull-off. */
export function turn5(c) {
  const A = new Acc(), sh = shapeOf(root5(c), 'm', '5top', 0, 10); if (!sh) return null; A.shape(sh);
  const cell = run(sh.notes, [3, 4, 5, 4, 3]); A.marks = 5;
  for (let beat = 0; beat < 16; beat += 2) { A.t = beat; A.evs(cell, 0.25); }
  return finish(c, A, {
    id: 'sp-5-turn', name: `The turnaround alone: ${nm(sh)} B string, e string, hammer, pull off, back`, method: 'spacing', step: 0.25, goal: 85, start: 55, minutes: 6,
    why: 'In the five-string loop the turn at the top is where most mistakes happen. Taking just the top two strings and the hammer-on and pull-off out of the shape lets you drill it by itself.',
    instr: `B string (fret ${sh.notes[3][1]}), e string (${sh.notes[4][1]}), hammer to ${sh.notes[5][1]}, pull off to ${sh.notes[4][1]}, then one upstroke on the B string. 16ths, then rest. Pass: 8 turnarounds in a row, then a 30 second break, then 8 more.`,
    watch: 'Not releasing the e string note, so the B note sounds as a chord.', simplify: 'Triplets.'
  });
}
/** The A string to D string change. */
export function rollRoot(c) {
  const A = new Acc(), sh = shapeOf(root5(c), 'm', '5top', 0, 10); if (!sh) return null; A.shape(sh);
  const dn = run(sh.notes, [0, 1]), up = run(sh.notes, [1, 0], 'u'); A.marks = 4;
  for (let beat = 0; beat < 16; beat += 2) { A.t = beat; A.evs(beat % 4 === 0 ? dn : up, 0.5); }
  return finish(c, A, {
    id: 'sp-5-roll', name: `The first string change: ${nm(sh)} A string to D string and back`, domain: 'fretting', method: 'retrieval', step: 0.5, goal: 90, start: 58, minutes: 5,
    why: 'At the bottom of the shape the finger on the A string must come off as the D string note starts, or the two ring together. This pair is where a five-string sweep begins and ends.',
    instr: `A string (fret ${sh.notes[0][1]}) then D string (${sh.notes[1][1]}) with one downstroke, then D then A with one upstroke. Lift the A string finger exactly when the D string is struck. 8th notes, a pair per two beats. Pass: 15 pairs with no overlap between the two notes.`,
    watch: 'Leaving the first finger down on the A string.', simplify: 'Play the pair as quarter notes.'
  });
}
/** Staccato five-string loop. */
export function staccato5(c) {
  const A = new Acc(), sh = shapeOf(root5(c), 'm', '5top', 0, 10); if (!sh) return null; A.shape(sh);
  const cell = run(sh.notes, idxLoop(sh.notes.length)); A.marks = 10;
  loopFill(A, cell, 0.25, 40, { d: 0.125 });
  return finish(c, A, {
    id: 'sp-5-staccato', name: `Staccato ${nm(sh)} loop: every note as short as possible`, domain: 'fretting', method: 'variable', step: 0.25, goal: 75, start: 50, minutes: 5,
    why: 'If every note is cut short, any note that rings on is a mistake you can hear. Playing the loop staccato tests how fast the fretting fingers release and how well the palm damps.',
    instr: 'Play the ten-note loop in 16ths with every note as short as possible: press, sound, release. The silence between notes should be as long as the notes. Four loops. Pass: all four loops with no note running into the next.',
    watch: 'Short notes that are actually lazy ones: stay accurate.', simplify: 'Half the loop (the way up) first.'
  });
}
/** Continuous five-string loop. */
export function loop5(c) {
  const A = new Acc(), sh = shapeOf(root5(c), 'm', '5top', 0, 10); if (!sh) return null; A.shape(sh);
  const cell = run(sh.notes, idxLoop(sh.notes.length)); A.marks = 10;
  loopFill(A, cell, 0.25, 40);
  return finish(c, A, {
    id: 'sp-5-loop', name: `The continuous five-string loop on ${nm(sh)}`, method: 'interleaving', step: 0.25, goal: 90, start: 58, minutes: 7,
    why: 'Ten notes: a sweep up five strings, a hammer-on and pull-off, and a sweep back down four. This is the full shape that most sweep licks and exercises are made of.',
    instr: `Loop: A, D, G, B, e (frets ${sh.notes.slice(0, 5).map(n => n[1]).join(', ')}), hammer to ${sh.notes[5][1]}, pull off, then B... down to D with one upstroke; the loop repeats on the A string. 16ths, 2.5 beats per loop. Pass: 4 loops in a row without a stop and without the pull-off missing.`,
    watch: 'Treating the top turn as a stop: keep the pulse through it.', simplify: 'Triplets and two loops.'
  });
}
const progOf = (c, major) => (major ? MAJ_PROG : MIN_PROG).map(o => mod12((major ? root3(c) : root5(c)) + o));
/** A progression with one sweep loop per bar, then the bar rest. */
export function overProg3(c) {
  const A = new Acc(), r = root3(c), roots = progOf(c, true); A.marks = 6; let near = 7;
  for (const [i, rt] of roots.entries()) {
    const sh = shapeOf(rt, '', '3top', 0, near); if (!sh) return null; A.shape(sh); near = sh.notes[0][1];
    A.t = i * 4; loopFill(A, run(sh.notes, idxLoop(sh.notes.length)), 1 / 3, 6);
  }
  return finish(c, A, {
    id: 'sp-prog3', name: `One loop, a bar's wait, the next shape: ${A.used.join(' – ')}`, domain: 'improv', method: 'transfer', step: 1 / 3, goal: 100, start: 62, minutes: 7,
    why: 'Real music changes chord. Playing one loop and then waiting gives you time to find the next shape while the pick keeps its habit, which is the beginning of sweeping through chord changes.',
    instr: `Play one loop (two beats of triplets), rest the rest of the bar, and move to the next chord: ${A.used.join(' – ')}. Choose each shape near the last one. Count the rest. Pass: the four bars twice through without a missed start.`,
    watch: 'Rushing the start of the next shape.', simplify: 'Two bars per chord.'
  });
}
/** Five-string sweep into a minor pentatonic run. */
export function fiveToPent(c) {
  const A = new Acc(), r = root5(c), sh = shapeOf(r, 'm', '5top', 0, 10); if (!sh) return null; A.shape(sh);
  const loopUp = run(sh.notes, idxLoop(sh.notes.length)); A.marks = 10;
  const top = sh.notes[4], pent = scaleDown(r, 'minorPent', OPEN[1] + top[1] - 1, 6, Math.max(1, top[1] - 4)); if (!pent) return null;
  const penPcs = SCALE_BY_ID.minorPent.steps.map(x => mod12(r + x));
  for (let rep = 0; rep < 2; rep++) {
    A.t = rep * 8; A.pcs = sh.pcs; A.evs(loopUp.slice(0, 7), 0.25);
    A.pcs = penPcs; pent.forEach((e, i) => A.put({ ...e, pk: i % 2 ? 'd' : 'u' }, 0.25, { pcs: penPcs }));
  }
  return finish(c, A, {
    id: 'sp-5-to-pent', name: `Five strings up, turn, then a ${nameOf(r)} minor pentatonic run down the top strings`, domain: 'improv', method: 'transfer', step: 0.25, goal: 85, start: 55, minutes: 7,
    why: 'A big sweep rarely stands alone. After the turn at the top the line usually falls back into scale notes, so the exit from the sweep is a skill of its own.',
    instr: `One downstroke sweep up the five strings, hammer and pull off at the top, and then straight into a descending ${nameOf(r)} minor pentatonic run on the top three strings, alternate picked. Two times through. Pass: the exit made without a gap in the 16ths, twice in a row.`,
    watch: 'A gap right after the pull-off while you find the scale.', simplify: 'Run of four notes.'
  });
}

/* ------------------------------- Advanced ------------------------------- */
/** Progression of three-string loops in 16ths: the downbeat falls on a different note each bar. */
export function sixes16(c) {
  const A = new Acc(), roots = progOf(c, true); A.marks = 6; let near = 7, ci = 0;
  for (const rt of roots) {
    const sh = shapeOf(rt, '', '3top', ci % 2, near); if (!sh) return null; A.shape(sh); near = sh.notes[0][1]; ci++;
    loopFill(A, run(sh.notes, idxLoop(sh.notes.length)), 0.25, 16);
  }
  return finish(c, A, {
    id: 'sp-sixes-16', name: `Six-note loops through ${A.used.join(' – ')} in 16ths`, domain: 'rhythm', method: 'variable', step: 0.25, goal: 110, start: 70, minutes: 7,
    why: 'Loops of six against a pulse of four put the accents on different notes, and a new chord every bar changes the shape too. The pick motion has to be independent of both.',
    instr: `One chord per bar (${A.used.join(' – ')}): the six-note loop in 16ths with the shape chosen as the nearest to the last (the 1st inversion is allowed). Accent the note on each downbeat. Pass: the four bars twice, with a clean change at every bar line.`,
    watch: 'Stopping the loop at the bar line to start the next shape.', simplify: 'Triplets.'
  });
}
/** Five-string loop in sextuplets. */
export function loop5sext(c) {
  const A = new Acc(), sh = shapeOf(root5(c), 'm', '5top', 0, 10); if (!sh) return null; A.shape(sh);
  const cell = run(sh.notes, idxLoop(sh.notes.length)); A.marks = 10;
  loopFill(A, cell, 1 / 6, 96);
  return finish(c, A, {
    id: 'sp-5-sext', name: `Ten against six: the ${nm(sh)} loop in sextuplets`, domain: 'rhythm', method: 'interleaving', step: 1 / 6, goal: 85, start: 55, minutes: 8,
    why: 'Ten notes in sextuplets drift against the beat: the turnaround falls in a new place each time. This is how long sweep lines sit in real music.',
    instr: 'The ten-note loop continuously in sextuplets (six per beat) for four bars. Track where the top of the loop (the hammer-on) lands relative to the beat each time. Pass: four unbroken bars with the motion unchanged as the turnaround moves.',
    watch: 'Straightening the loop to fit the beat.', simplify: '16ths, where the loop spans two and a half beats.'
  });
}
/** Ascending five-string bursts. */
export function burst5(c) {
  const A = new Acc(), sh = shapeOf(root5(c), 'm', '5top', 0, 10); if (!sh) return null; A.shape(sh);
  const cell = run(sh.notes, idxUp(sh.notes.length)); A.marks = 6;
  for (let bar = 0; bar < 4; bar++) { A.t = bar * 4; A.evs(cell, 0.25); }
  return finish(c, A, {
    id: 'sp-5-burst', name: `Ascending bursts: the ${nm(sh)} sweep up in 16ths, a bar of rest`, domain: 'picking', method: 'edge', step: 0.25, goal: 130, start: 80, minutes: 6,
    why: 'The sweep up is one gesture. Playing it alone in a burst, then resting, teaches the gesture at a tempo where it is almost a single stroke.',
    instr: `One downstroke up the A, D, G, B and e strings and the hammered top note in 16ths (6 notes), then rest the bar. Let the forearm carry the pick and keep the wrist loose. Pass: 8 bursts in a row, each in time, a full bar between them.`,
    watch: 'Pushing harder as the tempo goes up; keep the motion light.', simplify: 'Triplets.'
  });
}
/** Major and minor five-string loops of one root, alternating each bar. */
export function hyper5(c) {
  const A = new Acc(), r = root5(c), qs = ['m', '', 'm', '']; A.marks = 10; let near = 10;
  for (const q of qs) {
    const sh = shapeOf(r, q, '5top', 0, near); if (!sh) return null; A.shape(sh);
    const cell = run(sh.notes, idxLoop(sh.notes.length)); loopFill(A, cell, 0.25, 16);
  }
  return finish(c, A, {
    id: 'sp-5-hyper', name: `The five-string loop, minor then major on one root: ${A.used.join(' – ')}`, domain: 'picking', method: 'chunking', step: 0.25, goal: 115, start: 72, minutes: 8,
    why: 'Switching the 3rd between the minor and major triad every bar shows that the sweep shape is a chord: only one note per string moves. The long loop is the endurance test.',
    instr: `${A.used.join(' – ')}: the ten-note loop in 16ths, a new quality each bar, played continuously. Pass: 30 seconds at the goal tempo with no skipped notes and no ringing.`,
    watch: 'Hesitating at the bar line where the 3rd changes.', simplify: 'One quality only.'
  });
}
/** Sweep then alternate picking. */
export function sweepAlt(c) {
  const A = new Acc(), r = root3(c), sh = shapeOf(r, '', '3top', 0, 7); if (!sh) return null; A.shape(sh);
  const loop = run(sh.notes, idxLoop(sh.notes.length)); A.marks = 6;
  const top = sh.notes[3], scaleMajor = SCALE_BY_ID.major.steps.map(x => mod12(r + x));
  const sc = scaleDown(r, 'major', OPEN[1] + top[1] - 1, 12, Math.max(1, top[1] - 5)); if (!sc) return null;
  for (let rep = 0; rep < 2; rep++) {
    A.t = rep * 8; A.pcs = sh.pcs; loopFill(A, loop, 1 / 6, 24);
    A.t = rep * 8 + 4; A.pcs = scaleMajor; alt(sc, 'd').forEach(e => A.put(e, 0.25, { pcs: scaleMajor }));
  }
  return finish(c, A, {
    id: 'sp-sweep-alt', name: `Sweep, then alternate picking: ${nm(sh)} loops in sextuplets, a descending ${nameOf(r)} major scale in 16ths`, domain: 'picking', method: 'interleaving', step: 1 / 6, goal: 100, start: 62, minutes: 7,
    why: 'A sweep and a scale use different picking habits. Moving between them in one phrase, with the change of rhythm included, is how sweeps appear in solos.',
    instr: `Bar 1: the three-string loop in sextuplets (4 loops). Bar 2: a descending ${nameOf(r)} major scale run in 16ths, strictly alternate picked. Two times through. Pass: both bars joined with no break in the beat and the 16ths clean.`,
    watch: 'Leaving a gap while the hand re-sets for alternate picking.', simplify: 'Triplets in bar 1.'
  });
}
/** Sweep up, pull off, then a 3-note-per-string legato descent. */
export function sweepLegato(c) {
  const A = new Acc(), r = root5(c), sh = shapeOf(r, 'm', '5top', 0, 10); if (!sh) return null; A.shape(sh);
  const up = run(sh.notes, idxUp(sh.notes.length)); A.marks = 6;
  const topF = sh.notes[5][1], sc = SCALE_BY_ID.minor.steps.map(x => mod12(r + x));
  const desc = []; for (const s of [1, 2, 3]) { const fs = []; for (let f = Math.max(1, topF - 6); f <= topF; f++) if (sc.includes(mod12(OPEN[s] + f))) fs.push(f); desc.push(...fs.slice(-3).reverse().map(f => [s, f])); }
  const dEvs = desc.map(([s, f], i) => ({ s, f, x: i && desc[i - 1][0] === s ? 'p' : null, pk: null })).filter((e, i) => !(i === 0 && e.s === 1 && e.f === topF));
  for (let rep = 0; rep < 2; rep++) {
    A.t = rep * 8; A.pcs = sh.pcs; A.evs(up, 0.25);
    A.pcs = sc; dEvs.forEach((e, i) => A.put(i === 0 ? { ...e, x: 'p' } : e, 0.25, { pcs: sc }));
  }
  return finish(c, A, {
    id: 'sp-sweep-legato', name: `Sweep up ${nm(sh)}, then a legato descent in ${nameOf(r)} natural minor`, domain: 'fretting', method: 'spacing', step: 0.25, goal: 110, start: 70, minutes: 7,
    why: 'After the top of a sweep, a legato run falls down the scale without any more picking. It is the fastest way back down and a common exit.',
    instr: `Sweep up the five strings with one downstroke and hammer the top note, then descend in ${nameOf(r)} natural minor with three notes per string on the high e, B and G strings: pick the first note of the group and pull off the rest, with no further picking in the descent. Two times through. Pass: the sweep and the descent clean and in time, twice in a row.`,
    watch: 'Weak pull-offs on the way down; flick each finger off sideways.', simplify: 'Stop the descent after the top string.'
  });
}
/** Sliding the whole shape. */
export function slideLoops(c) {
  const A = new Acc(), r = root5(c), offs = [0, 2, 0, 2, 0, 2]; A.marks = 10; let near = 10;
  for (const o of offs) {
    const sh = shapeOf(r + o, 'm', '5top', 0, near + o); if (!sh) return null; A.shape(sh);
    loopFill(A, run(sh.notes, idxLoop(sh.notes.length)), 0.25, 10);
  }
  return finish(c, A, {
    id: 'sp-5-slide', name: `Sliding five-string loops: ${A.used.join(' – ')}`, domain: 'fretboard', method: 'variable', step: 0.25, goal: 105, start: 66, minutes: 8,
    why: 'Moving the whole five-string shape two frets and back builds the ability to change chord without any pause, with the hand sliding as the pick keeps its pulse.',
    instr: `One loop on ${A.used[0]}, slide the whole shape up two frets for the next loop (${A.used[1]}), back, and so on, in continuous 16th notes. Slide the first finger and bring the others with it. Pass: six loops without a gap at the goal tempo.`,
    watch: 'Letting the slide take a beat.', simplify: 'A rest of one beat after each loop.'
  });
}
/** The advanced study: minor to minor, loop plus the sweep up to start the next bar. */
export function study5(c) {
  const A = new Acc(), r = root5(c), plan = [0, 5, 0, 5]; A.marks = 10; let near = 10;
  for (const o of plan) {
    const sh = shapeOf(r + o, 'm', '5top', 0, near); if (!sh) return null; A.shape(sh); near = sh.notes[0][1];
    loopFill(A, [...run(sh.notes, idxLoop(sh.notes.length)), ...run(sh.notes, idxUp(sh.notes.length))], 0.25, 16);
  }
  return finish(c, A, {
    id: 'sp-adv-study', name: `Four-bar sweep study: ${A.used.join(' – ')}`, domain: 'improv', method: 'transfer', step: 0.25, goal: 110, start: 70, minutes: 9,
    why: 'Two chords, two five-string shapes, and the same continuous pick motion: the first piece where the sweep serves a progression.',
    instr: `Each bar: the full ten-note loop and then the sweep up again to the top (16 notes), then the next chord's shape. ${A.used.join(' – ')}, played twice through. Pass: the four bars twice, changing shape cleanly at each bar line.`,
    watch: 'Looking for the next shape instead of continuing the motion.', simplify: 'Two bars.'
  });
}

/* -------------------------------- Mastery -------------------------------- */
/** Bursts of the whole loop across the chords of the key. */
export function hyperBurst(c) {
  const A = new Acc(), r = root5(c), offs = [0, 5, 7, 3, 0]; A.marks = 10; let near = 10;
  for (const [i, o] of offs.entries()) {
    const sh = shapeOf(r + o, o === 7 || o === 3 ? '' : 'm', '5top', 0, near); if (!sh) return null; A.shape(sh); near = sh.notes[0][1];
    A.t = i * 4; A.evs(run(sh.notes, idxLoop(sh.notes.length)), 0.25);
  }
  return finish(c, A, {
    id: 'sp-m-burst', name: `Hyper-bursts: the full loop on ${A.used.join(', ')}`, method: 'edge', step: 0.25, goal: 140, start: 90, minutes: 8,
    why: 'The whole loop at top speed, one burst per bar, with a new shape each time. Rest between bursts is part of the drill: it keeps tension from building.',
    instr: `One complete ten-note loop in 16ths per bar, then rest: ${A.used.join(', ')}. Move to the next shape during the rest. Pass: 5 flawless bursts at top speed with no tension building up.`,
    watch: 'Gripping the pick harder as the tempo goes up.', simplify: 'Triplets at the same BPM.'
  });
}
/** Sustained cycling through a long progression. */
export function cycle5(c) {
  const A = new Acc(), r = root5(c), plan = [[0, 'm'], [8, ''], [10, ''], [0, 'm'], [5, 'm'], [8, ''], [7, ''], [0, 'm']]; A.marks = 10; let near = 10;
  for (const [o, q] of plan) {
    const sh = shapeOf(r + o, q, '5top', 0, near); if (!sh) return null; A.shape(sh); near = sh.notes[0][1];
    loopFill(A, [...run(sh.notes, idxLoop(sh.notes.length)), ...run(sh.notes, idxUp(sh.notes.length))], 0.25, 16);
  }
  return finish(c, A, {
    id: 'sp-m-cycle', name: `Sustained cycling: ${A.used.join(' – ')} without a stop`, method: 'spacing', step: 0.25, goal: 120, start: 80, minutes: 15,
    why: 'Endurance: eight bars of continuous 16ths through a progression. A sweep that can only be played for four bars is not yet usable in a solo.',
    instr: `Every bar: the loop plus the sweep up (16 notes), a new shape each bar: ${A.used.join(' – ')}. Repeat the eight bars until you have played for one full minute. Pass: one minute of continuous clean 16ths with no stops and no ringing notes.`,
    watch: 'Tension creeping into the forearm after the first minute: check by releasing your grip.', simplify: 'Four bars, then rest.'
  });
}
/** Sweep up and land on a whole-step bend. */
export function sweepBend(c) {
  const A = new Acc(), r = root3(c); A.marks = 4; let near = 7;
  for (let bar = 0; bar < 4; bar++) {
    const sh = shapeOf(r + [0, 5, 7, 0][bar], '', '3top', 0, near); if (!sh) return null; A.shape(sh); near = sh.notes[0][1];
    const [g, b, e] = sh.notes; const nxt = mod12(OPEN[1] + e[1] + 2), major = SCALE_BY_ID.major.steps.map(x => mod12(r + x));
    A.t = bar * 4 + 1 - 1 / 3; A.pcs = sh.pcs; A.evs(run(sh.notes, [0, 1]), 1 / 6);
    // the first note on the high e string is bent a whole step: the target is checked to be a note of the major scale
    const pcs = [...sh.pcs, nxt];
    A.notes.push(tag(N(1, e[1], bar * 4 + 1, 2.5, 'b', { bendTo: e[1] + 2 }), pcs)); A.t = bar * 4 + 4;
    if (!major.includes(nxt)) return null;
  }
  return finish(c, A, {
    id: 'sp-m-bend', name: `Sweep into a bend: ${A.used.join(', ')} up two strings, then bend the top note a whole step`, domain: 'improv', method: 'interleaving', step: 1 / 6, goal: 110, start: 70, minutes: 8, noEnd: true,
    why: 'A sweep that ends in a bend sounds like a phrase and not an exercise: the arpeggio delivers you to the top note and the bend carries on from there.',
    instr: `Sweep up the G and B strings in sextuplets just before beat 2 and land on the high e note on beat 2, bent up a whole step and held. Bend to pitch: check against the fretted note two frets higher. Four chords, a bar each: ${A.used.join(', ')}. Pass: the bend on pitch on the downbeat in all four bars, twice through.`,
    watch: 'A late or flat bend: set the bend before you start the sweep.', simplify: 'Fret the target note and hold it instead of bending.'
  });
}
/** Entry points chosen at random. */
export function entryPoints(c) {
  const A = new Acc(), r = root5(c), chords = [[0, 'm'], [8, ''], [10, ''], [0, 'm']]; A.marks = 10; let near = 10;
  const pos = [1, 0, 1, 0].map((_, i) => (((c.lvl || 9) * 7 + i * 5) % 3));
  for (const [i, [o, q]] of chords.entries()) {
    const sh = shapeOf(r + o, q, '5top', 0, near); if (!sh) return null; A.shape(sh);
    A.t = i * 4 + pos[i]; A.evs(run(sh.notes, idxLoop(sh.notes.length)).slice(0, 10), 0.25);
  }
  return finish(c, A, {
    id: 'sp-m-entry', name: `Spontaneous entry points: a sweep dropped into ${A.used.join(' – ')}`, domain: 'improv', method: 'variable', step: 0.25, goal: 100, start: 65, minutes: 10,
    why: 'In improvising the sweep has to start when the line calls for it, on any beat, not only on beat 1. The tab shows one set of entry points; the exercise is to choose your own.',
    instr: `Improvise over the ${A.used.join(' – ')} changes with a backing track. In each bar, play the five-string loop on that chord starting on a beat you choose on the spot (the tab shows beats ${pos.map(x => x + 1).join(', ')}), with your own scale lines between. Pass: a four-bar chorus where every sweep begins in time on the beat you picked.`,
    watch: 'Always starting on beat 1.', simplify: 'Only the entry points of the tab.'
  });
}
/** A tapped extension. */
export function sweepTap(c) {
  const A = new Acc(), r = root5(c), sh = shapeBelow(r, 'm', '5top', 0, 10, 16); if (!sh) return null; A.shape(sh);
  const ns = sh.notes, top = ns[5][1]; let tapF = null;
  for (let f = top + 1; f <= Math.min(22, top + 8); f++) if (sh.pcs.includes(mod12(OPEN[1] + f))) { tapF = f; break; }
  if (tapF == null) return null;
  const evs = [...run(ns, idxUp(ns.length)), { s: 1, f: tapF, x: 't', pk: null }, { s: 1, f: top, x: 'p', pk: null }, ...run(ns, [4, 3, 2, 1]).map((e, i) => (i === 0 ? { ...e, x: 'p', pk: null } : e))];
  A.marks = 4;
  for (let rep = 0; rep < 4; rep++) { A.t = rep * 4; A.evs(evs, 0.25); }
  return finish(c, A, {
    id: 'sp-m-tap', name: `Sweep and tap: ${nm(sh)} up, a tapped note above the top, back down`, domain: 'fretting', method: 'chunking', step: 0.25, goal: 115, start: 72, minutes: 10,
    why: 'Tapping a chord tone above the top of the sweep extends the shape without moving the fretting hand and lets the line go higher than the strings of the neck allow.',
    instr: `Sweep up the five strings with one downstroke, hammer to fret ${top}, tap fret ${tapF} on the e string with the picking hand (a chord tone), pull off the tap to fret ${top}, then pull off down and sweep back down. Make the tap with the pick hand's fingertip and flick it off sideways. Pass: 10 repetitions in a row.`,
    watch: 'A weak tap: keep the finger firm and flick it.', simplify: 'Without the pick: tap and pull-offs only.'
  });
}
/** The 16-bar capstone. */
export function etude(c) {
  const A = new Acc(), r5 = root5(c); A.marks = 10; let near = 10, bar = 0;
  const bars = [];
  const prog = [[0, 'm'], [8, ''], [10, ''], [7, ''], [0, 'm'], [5, 'm'], [10, ''], [7, ''], [0, 'm'], [8, ''], [5, 'm'], [7, ''], [0, 'm'], [8, ''], [10, ''], [0, 'm']];
  for (const [i, [o, q]] of prog.entries()) {
    const root = mod12(r5 + o);
    if (i < 4) { const sh = shapeOf(root, q, '3top', 0, 7); if (!sh) return null; A.shape(sh); A.t = i * 4; loopFill(A, run(sh.notes, idxLoop(sh.notes.length)), 1 / 3, 12); continue; }
    const sh = shapeOf(root, q, '5top', 0, near); if (!sh) return null; A.shape(sh); near = sh.notes[0][1];
    const ns = sh.notes, cell = run(ns, idxLoop(ns.length)), upc = run(ns, idxUp(ns.length));
    A.t = i * 4;
    if (i < 8) loopFill(A, [...cell, ...upc], 0.25, 16);
    else if (i < 12) { // loop, then the sweep up with a tapped top note
      const top = ns[5][1]; let tf = null; for (let f = top + 1; f <= Math.min(22, top + 8); f++) if (sh.pcs.includes(mod12(OPEN[1] + f))) { tf = f; break; }
      if (tf == null) loopFill(A, [...cell, ...upc], 0.25, 16); else { A.evs(cell, 0.25); A.evs(upc, 0.25); A.evs([{ s: 1, f: tf, x: 't', pk: null }, { s: 1, f: top, x: 'p', pk: null }], 0.25); }
    } else if (i < 15) loopFill(A, [...cell, ...upc], 1 / 6, 24);
    else { A.evs(upc, 0.25); A.put({ ...cell[5], x: null }, 0.25); }
  }
  return finish(c, A, {
    id: 'sp-m-etude', name: `Capstone study: sixteen bars of sweeping (${nameOf(r5)} minor)`, domain: 'improv', method: 'transfer', step: 0.25, goal: 125, start: 80, minutes: 20,
    why: 'An original piece that uses the whole path: three-string loops in triplets, five-string loops in 16ths, a tapped extension and a sextuplet finish.',
    instr: 'Learn it four bars at a time. Bars 1–4: three-string loops in triplets, a chord a bar. Bars 5–8: five-string loop plus the sweep up, in 16ths. Bars 9–12: the same with a tapped top note. Bars 13–15: sextuplets. Bar 16: the sweep up and the last note. Then write your own sixteen bars on the same plan. Pass: the study at the goal tempo with no stops, then your own version played through once.',
    watch: 'Letting a bar line interrupt the motion.', simplify: 'Bars 1–8 only.'
  });
}

/* --------------------------------- The path --------------------------------- */
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'sweepPicking', kind: 'technique', title: 'Sweep picking fundamentals', domain: 'picking',
  re: /sweep(ing)?.?pick(ing)?(?! (through|over|across))|\bsweeps?\b(?! (through|over|across))|sweep arpeggios?/,
  aliases: ['sweep picking', 'sweeping arpeggios', 'sweep picking basics'],
  summary: 'The sweep as one continuous pick motion across neighbouring strings: the rest stroke on two strings, the three-string and five-string arpeggio loops, muting and the finger roll, then speed, bends and taps.',
  prereqs: ['economyPicking', 'alternatePicking', 'palmMuting'],
  pedagogy: {
    date: '2026-10-22',
    summary: 'Taught from the pick motion outward: a rest stroke on one string, two strings, then three strings; muting and the finger roll as the two jobs that keep the notes separate; the turn at the top (hammer-on and pull-off); the three-string loop; the five-string shape; then the shapes shifted, moved through subdivisions and combined with scales, legato, bends and taps.',
    sequence: [
      { id: 'rest', tier: 'foundations', step: 'The rest stroke across two strings', how: 'One pick stroke that pushes through a string and rests on the next, then two strokes in a row in the same direction.', skills: ['sp-glide'], source: 1 },
      { id: 'mute', tier: 'foundations', step: 'Muting and the finger roll', how: 'Only one string fretted at a time; the idle strings damped by the fretting fingers and the picking palm; one finger rolled over two strings at the same fret.', skills: ['sp-mute'], source: 2 },
      { id: 'turn', tier: 'foundations', step: 'The top turn: hammer-on and pull-off', how: 'Sweep up on three strings with one downstroke, hammer the top note and pull off, then sweep back down; each half alone, then joined.', skills: ['sp-turn'], source: 3 },
      { id: 'loop3', tier: 'foundations', step: 'The three-string loop and its first use', how: 'The six-note loop with a metronome, then an arpeggio followed by a scale run.', skills: ['sp-loop'], source: 0 },
      { id: 'shift', tier: 'intermediate', step: 'The three-string shape moved and displaced', how: 'The same shape on other roots; rhythmic subdivisions (triplets, 16ths, sextuplets) taken in turn.', skills: ['sp-shift'], source: 4 },
      { id: 'five', tier: 'intermediate', step: 'The five-string shape built in parts', how: 'The way up alone, the way down alone, the turnaround alone, then the whole loop.', skills: ['sp-five'], source: 3 },
      { id: 'clean5', tier: 'intermediate', step: 'Clean notes in the five-string loop', how: 'Release each finger as the pick passes; staccato to expose notes that ring on.', skills: ['sp-clean'], source: 2 },
      { id: 'use1', tier: 'intermediate', step: 'Over chords and into scale runs', how: 'One shape per chord of a progression; a sweep that ends in a scale run.', skills: ['sp-use1'], source: 5 },
      { id: 'groups', tier: 'advanced', step: 'Groupings against the beat', how: 'Six- and ten-note loops against 16ths and sextuplets so the accents fall in new places.', skills: ['sp-groups'], source: 4 },
      { id: 'speed', tier: 'advanced', step: 'Speed, relaxation and endurance', how: 'Short bursts at tempo, then continuous loops; major and minor of one root.', skills: ['sp-speed'], source: 0 },
      { id: 'exits', tier: 'advanced', step: 'Entering and leaving the sweep', how: 'A sweep followed by alternate picking and by a legato descent.', skills: ['sp-exits'], source: 5 },
      { id: 'prog', tier: 'advanced', step: 'Sweeps along the neck', how: 'The five-string shape slid along the neck and linked in a four-bar study.', skills: ['sp-prog'], source: 5 },
      { id: 'velocity', tier: 'mastery', step: 'Top speed and long endurance', how: 'Hyper-bursts; long continuous cycling through a progression.', skills: ['sp-velocity'], source: 0 },
      { id: 'phrase', tier: 'mastery', step: 'Sweeps inside phrases', how: 'A bend at the peak, entry points chosen on the spot.', skills: ['sp-phrase'], source: 5 },
      { id: 'study', tier: 'mastery', step: 'The performance study', how: 'The tapped extension and an original sixteen-bar study combining the shapes.', skills: ['sp-study'], source: 5 }
    ],
    drills: ['Two-string rest strokes up and down', 'The finger roll over two strings at one fret', 'Palm-muted and open sweeps alternated', 'The ascending sweep with the pull-off turn, in short bursts', 'The three-string loop with a metronome', 'The five-string shape in parts: up, down, turnaround, whole', 'Staccato five-string loop', 'The loop in different subdivisions (triplets, 16ths, sextuplets)'],
    mistakes: ['Picking each note separately instead of one continuous push', 'Letting the notes ring together like a strummed chord (fretting a flat barre, no damping)', 'Not muting the strings behind the pick with the picking palm', 'Tension in the forearm as the tempo rises', 'Speeding up before the notes are separate'],
    sources: [
      { title: 'Sweep picking: how to get started with this awe-inspiring guitar technique', author: 'Guitar World', url: 'https://www.guitarworld.com/lessons/sweep-picking-how-to-get-started' },
      { title: 'Master Sweeping by Learning the Rest Stroke', author: 'Guitar World', url: 'https://guitarworld.com/lessons/master-sweeping-learning-rest-stroke' },
      { title: 'A Clean Sweep: Mastering Sweep Arpeggios', author: 'John Petrucci (Guitar World)', url: 'https://guitarworld.com/features/clean-sweep-mastering-sweep-arpeggios-john-petrucci' },
      { title: 'Get Started with Sweep Picking', author: 'Premier Guitar', url: 'https://www.premierguitar.com/lessons/shred/get-started-with-sweep-picking' },
      { title: 'The Shred Decoder\'s Guide to Sweep Picking', author: 'Premier Guitar', url: 'https://www.premierguitar.com/lessons/the-shred-decoders-guide-to-sweep-picking' },
      { title: 'Guitar skills: sweep picking lessons', author: 'MusicRadar', url: 'https://www.musicradar.com/how-to/guitar-skills-sweep-picking-lessons' },
      { title: '3 Essential Sweep Picking Shapes', author: 'DJ Temple (guitarlessons.com)', url: 'https://guitarlessons.com/guitar-lessons/lead-guitar/3-essential-sweep-picking-shapes/' }
    ]
  },
  sources: ['https://www.guitarworld.com/lessons/sweep-picking-how-to-get-started', 'https://guitarworld.com/lessons/master-sweeping-learning-rest-stroke', 'https://guitarworld.com/features/clean-sweep-mastering-sweep-arpeggios-john-petrucci', 'https://www.premierguitar.com/lessons/shred/get-started-with-sweep-picking', 'https://www.premierguitar.com/lessons/the-shred-decoders-guide-to-sweep-picking', 'https://www.musicradar.com/how-to/guitar-skills-sweep-picking-lessons', 'https://guitarlessons.com/guitar-lessons/lead-guitar/3-essential-sweep-picking-shapes/'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The pick glide and the first loop',
      'Play two notes on neighbouring strings with one pick stroke ten times, roll one finger across two strings at one fret with silence between the notes, alternate palm-muted and open sweeps for two minutes, play the sweep-and-pull-off bursts, and play the six-note three-string loop eight times in a row at 100 BPM in triplets.', [
        S('sp-glide', 'The pick glide and the rest stroke', 'picking', 'One push of the pick across two strings, up and down.', [c => restUp(c), c => restDown(c)],
          ST('A sweep is a rest stroke repeated across strings: the pick pushes through one string and stops against the next, so one movement plays several notes.', 'It is the picking half of the technique; without the continuous motion the arpeggio turns into separate strokes.', ['A downstroke sweeps the notes up in pitch; an upstroke sweeps them down.', 'The pick tip and a small motion keep the sweep light.'])),
        S('sp-mute', 'Muting and the finger roll', 'fretting', 'The picking palm trails the pick; one finger rolls over two strings.', [c => rollOne(c), c => trailMute(c)],
          ST('Sweeping is only one note per string: each string is damped as soon as it has sounded, by the picking palm behind the pick and by the fretting finger rolling or lifting.', 'Without damping a sweep sounds like a strummed chord.', ['When two chord tones share a fret a flat barre would hold both; rolling the finger gives one note at a time.', 'The first inversion of a triad (3rd–5th–root) has the 5th and root on the same fret across the B and e strings.'])),
        S('sp-turn', 'The turn at the top', 'picking', 'Hammer-on and pull-off to reverse the sweep.', [c => upAndTurn(c), c => turnDown(c)],
          ST('A three-string sweep reverses direction on the high e string with a hammer-on to the next chord tone and a pull-off back, so only one pick stroke is needed each way.', 'The turn is what makes a continuous loop possible.', ['The extra top note is the next chord tone above the one before it.', 'The pull-off is a flick sideways, not just a lift.'])),
        S('sp-loop', 'The three-string loop', 'picking', 'The whole six-note cycle, then into a scale.', [c => loop3(c), c => sweepToScale(c)],
          ST('The full cycle is a down-sweep up three strings, a hammer-on, a pull-off and an up-sweep back down: six notes that repeat.', 'It joins the parts and is the basis of the larger shapes.', ['In triplets the six notes make exactly two beats.', 'The same loop is a triad of any quality and any key.']))
      ], [1, 3]),
    stage('intermediate', 'Moving it, the five-string shape, first music',
      'Shift the three-string shape up and down by whole steps every two beats in triplets at 110 BPM, play the loop in 16ths with the accent walking round, play the five-string loop in parts and then continuously for four loops in 16ths at 90 BPM, play a short loop per chord over I–IV–V–I, and sweep five strings into a pentatonic run.', [
        S('sp-shift', 'Moving and displacing the three-string shape', 'fretboard', 'Whole-step shifts; six against four; bursts.', [c => shiftWhole(c), c => accentLoop(c), c => burst3(c)],
          ST('The sweep shape is a triad, so it moves anywhere: shifting by two frets gives the next chord a whole step away.', 'A shape that moves freely is the beginning of playing sweeps through changes.', ['Six notes against four 16ths put the loop start on a different note each bar.', 'Sextuplet bursts: one loop per beat.'])),
        S('sp-five', 'The five-string shape in parts', 'picking', 'The way up, the way down, the turnaround.', [c => five_up(c), c => five_down(c), c => turn5(c)],
          ST('The five-string shape adds the A and D strings: ten notes in all, with the same top turn.', 'Larger shapes need the same single push, longer, and more notes to damp.', ['Up: A, D, G, B, e and a hammered top note.', 'Down: a pull-off and four upstroke notes.'])),
        S('sp-clean', 'Clean notes in the five-string loop', 'fretting', 'Releasing fingers; staccato; the whole loop.', [c => rollRoot(c), c => staccato5(c), c => loop5(c)],
          ST('Every finger must come off as the next string is struck, or the notes bleed together.', 'It trains the fretting hand to release, which clean sweeping depends on.', ['Staccato exposes every note that rings on.', 'The bottom of the shape (A to D string) is the first string change.'])),
        S('sp-use1', 'First musical uses', 'improv', 'A loop per chord; a sweep into a pentatonic run.', [c => overProg3(c), c => fiveToPent(c)],
          ST('Sweeps move through chords and end in scale runs.', 'It is how sweeps are used in solos.', ['I–IV–V–I with one shape per bar.', 'The run after the turn uses the minor pentatonic of the same root.']))
      ], [4, 6]),
    stage('advanced', 'Odd groupings, speed and exits',
      'Play six-note loops through I–IV–V–I in 16ths at 110 BPM, the ten-note loop in sextuplets at 85 BPM for four bars, ascending five-string bursts in 16ths at 130 BPM, the five-string loop for 30 seconds at 115 BPM, sweeps into alternate picking and legato descents, slide the shape along the neck, and play a four-bar sweep study.', [
        S('sp-groups', 'Groupings against the beat', 'rhythm', 'Six in 16ths through a progression; ten in sextuplets.', [c => sixes16(c), c => loop5sext(c)],
          ST('A loop whose length does not divide the beat lands its turnaround on a different place each time.', 'Real lines are not square, and the pick motion has to be independent of the beat.', ['6 notes in 16ths: the loop returns after 3 beats and 3 notes; 10 in sextuplets: after 5 beats.', 'A loop that is cut to fit the beat is no longer a loop.'])),
        S('sp-speed', 'Speed and endurance', 'picking', 'Bursts; the long loop; minor and major.', [c => burst5(c), c => hyper5(c)],
          ST('Speed comes from a relaxed, small and continuous motion; bursts build it and long loops test it.', 'A technique that cannot be sustained is not yet usable.', ['Rest between bursts so tension does not build.', 'Changing the 3rd (minor to major) moves one note per string.'])),
        S('sp-exits', 'Entering and leaving the sweep', 'picking', 'Sweep to alternate picking; sweep to legato.', [c => sweepAlt(c), c => sweepLegato(c)],
          ST('A sweep is usually surrounded by other picking: alternate picked scales or legato.', 'Moving between picking habits in one phrase is the difficulty.', ['The last upstroke of the sweep leads into the run.', 'Three notes per string legato falls down the neck fast.'])),
        S('sp-prog', 'Along the neck and a study', 'fretboard', 'Sliding the shape; a four-bar study.', [c => slideLoops(c), c => study5(c)],
          ST('The five-string shape slides to any chord; the hand moves while the pick keeps its pulse.', 'It joins the shapes into a progression.', ['Shift by a whole step and back.', 'Use the nearest shape for the next chord.']))
      ], [7, 8]),
    stage('mastery', 'Top speed, phrases and the study',
      'Play five-string bursts at 140 BPM with no tension, sustain the loop for a minute at 120 BPM, land on a bend after a sweep, choose your own entry points over a progression, add a tapped note at the top of the sweep, and perform a sixteen-bar sweep study at 125 BPM without a stop.', [
        S('sp-velocity', 'Top speed and endurance', 'picking', 'Hyper-bursts; a minute of cycling.', [c => hyperBurst(c), c => cycle5(c)],
          ST('The top end of the technique is a loose, tiny motion; endurance shows whether it is truly relaxed.', 'The same motion works fast or slow.', ['Rest between bursts so tension does not build.', 'Long continuous cycling through a progression.'])),
        S('sp-phrase', 'Sweeps inside phrases', 'improv', 'A bend at the peak; entry points chosen at random.', [c => sweepBend(c), c => entryPoints(c)],
          ST('A sweep can end in a bend or begin anywhere in a bar; either hides the mechanical side of the technique.', 'It makes sweeps musical.', ['A whole-step bend from the top chord tone reaches the next note of the major scale.', 'Choose entry points on the spot rather than always on beat 1.'])),
        S('sp-study', 'The mastery study', 'fretboard', 'Sweep and tap; the sixteen-bar study.', [c => sweepTap(c), c => etude(c)],
          ST('A tapped note above the top of the sweep extends the shape; the capstone combines every shape in the path.', 'It proves the technique in music.', ['The tap uses a chord tone above the hammered note.', 'The study moves from triplets to 16ths to sextuplets.']))
      ], [9, 10])
  ]
});
