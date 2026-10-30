// Boom-chuck rhythm: the flat-picked country and bluegrass accompaniment. A bass note (the "boom": the root,
// then the fifth) alternates with a short strum of the chord's upper strings (the "chuck"). Foundations: root
// and chuck on beats 1-4, alternating root and fifth, two and three chords, minor keys; intermediate: the
// up-chuck (boom-chuck-a), both chord shapes, walk-ups and approach notes into the next chord; advanced: dead
// chucks, walking bass, switching feels bar by bar and longer progressions; mastery: tempo, endurance and
// original studies.
//
// Concept-first (CONTENT.md): the chord is a MOVABLE SHAPE found from the key, so every note is a chord tone
// by construction. E-form (root on string 6): strings 6 5 4 3 2 1 = R 5 R 3 5 R (the 3rd is one fret lower
// for minor). A-form (root on string 5): strings 5 4 3 2 1 = R 5 R 3 5. The boom is the shape's lowest note
// (the root) and its next string (the fifth); the chuck is the shape's strings 3-5 (R 3 5), a short down
// strum; the up-chuck is its top two. Walk-ups are the scale notes root+2, 3rd, 4th, 5th on the root string;
// an approach note is one fret from the next chord's root. The chord root's place is the fret on string 6
// or 5 nearest the hand (`shape` forces one).
//
// Teaching method first (see `pedagogy` below), researched 2026-10-30.
import { OPEN, N, nameOf, make, mod12, S, stage, entry } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
export const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const pitch = (s, f) => OPEN[s] + f;
function rootFret(pc, s, near) {
  let best = null;
  for (let f = 0; f <= 11; f++) if (mod12(pitch(s, f)) === mod12(pc)) { const d = Math.abs(f - near); if (best == null || d < best.d) best = { f, d }; }
  return best ? best.f : null;
}
/** Where chord root `pc` sits: { rs, f } on string 6 (E-form) or 5 (A-form), nearest `near`; `shape` forces 6 or 5. */
export function place(pc, near, shape = null) {
  let best = null;
  for (const rs of shape ? [shape] : [6, 5]) { const f = rootFret(pc, rs, near); if (f == null) continue; const d = Math.abs(f - near) + (rs === 5 ? 0.01 : 0); if (!best || d < best.d) best = { rs, f, d }; }
  return best;
}
/** The chord shape from a placement: [string, fret, semitones above the root] from the lowest string up. */
export function shapeOf(pl, minor) {
  const { rs, f } = pl, third = minor ? 3 : 4;
  return rs === 6
    ? [[6, f, 0], [5, f + 2, 7], [4, f + 2, 0], [3, f + (minor ? 0 : 1), third], [2, f, 7], [1, f, 0]]
    : [[5, f, 0], [4, f + 2, 7], [3, f + 2, 0], [2, f + (minor ? 1 : 2), third], [1, f, 7]];
}
export const chordName = (root, minor) => nameOf(root) + (minor ? 'm' : '');
const SC = [2, 4, 5, 7]; // walk-up offsets above the root (the 3rd is 3 for minor)
const walkOff = (i, minor) => (i === 1 && minor ? 3 : SC[i]);

const ev = (list, kind) => list.map(s => [s, 1, kind]);
/** Patterns: 8 slots per bar (8th notes); events [slot, length in slots, kind]. B root, F fifth, K chuck (down strum), k up-chuck, X dead chuck, W0-W3 walk-up notes, A approach note into the next chord. */
export const PAT = {
  rootQ: { name: 'root on every beat', unit: 'quarter notes', ev: [[0, 2, 'B'], [2, 2, 'B'], [4, 2, 'B'], [6, 2, 'B']] },
  altQ: { name: 'root and fifth', unit: 'quarter notes', ev: [[0, 2, 'B'], [2, 2, 'F'], [4, 2, 'B'], [6, 2, 'F']] },
  rootChuck: { name: 'root, chuck, root, chuck', unit: 'quarter notes', ev: [[0, 2, 'B'], [2, 1, 'K'], [4, 2, 'B'], [6, 1, 'K']] },
  bc: { name: 'boom-chuck (root, chuck, fifth, chuck)', unit: 'quarter notes', ev: [[0, 2, 'B'], [2, 1, 'K'], [4, 2, 'F'], [6, 1, 'K']] },
  bcDead: { name: 'boom-chuck with a dead chuck', unit: 'quarter notes', ev: [[0, 2, 'B'], [2, 1, 'X'], [4, 2, 'F'], [6, 1, 'X']] },
  bcUp: { name: 'boom-chuck-a (with the up-chuck)', unit: '8th notes', ev: [[0, 2, 'B'], [2, 1, 'K'], [3, 1, 'k'], [4, 2, 'F'], [6, 1, 'K'], [7, 1, 'k']] },
  bcUpAll: { name: 'up-chuck after every beat', unit: '8th notes', ev: [[0, 1, 'B'], [1, 1, 'k'], [2, 1, 'K'], [3, 1, 'k'], [4, 1, 'F'], [5, 1, 'k'], [6, 1, 'K'], [7, 1, 'k']] },
  walkUp: { name: 'boom-chuck with a walk-up', unit: '8th notes', ev: [[0, 2, 'B'], [2, 1, 'K'], [4, 1, 'B'], [5, 1, 'W0'], [6, 1, 'W1'], [7, 1, 'W2']] },
  appr: { name: 'boom-chuck with an approach note', unit: '8th notes', ev: [[0, 2, 'B'], [2, 1, 'K'], [4, 2, 'F'], [6, 1, 'K'], [7, 1, 'A']] },
  walk4: { name: 'walking bass in quarters', unit: 'quarter notes', ev: [[0, 2, 'B'], [2, 2, 'W0'], [4, 2, 'W1'], [6, 2, 'W2']] },
  walkChuck: { name: 'walking bass with chucks', unit: 'quarter notes', ev: [[0, 2, 'B'], [2, 1, 'K'], [4, 2, 'W1'], [6, 1, 'K']] },
  walkFull: { name: 'walking bass up to the fifth', unit: 'quarter notes', ev: [[0, 2, 'B'], [2, 2, 'W0'], [4, 2, 'W1'], [6, 2, 'W3']] }
};
const bar = (off, minor, pat) => ({ off, minor, pat });
export const PROG = {
  one: c => [0, 0, 0, 0].map(o => [o, !!c.minor]),
  oneFour: c => [[0, !!c.minor], [0, !!c.minor], [5, !!c.minor], [5, !!c.minor]],
  oneFourBars: c => [[0, !!c.minor], [5, !!c.minor], [0, !!c.minor], [5, !!c.minor]],
  country: c => (c.minor ? [[0, true], [5, true], [7, false], [0, true]] : [[0, false], [5, false], [7, false], [0, false]]),
  oneSix: c => (c.minor ? [[0, true], [8, false], [10, false], [0, true]] : [[0, false], [9, true], [5, false], [7, false]]),
  oneFiveFour: c => (c.minor ? [[0, true], [7, false], [5, true], [0, true]] : [[0, false], [7, false], [5, false], [0, false]])
};
const toBars = (prog, pat, reps) => Array.from({ length: reps }, () => prog.map(([off, minor], i) => bar(off, minor, Array.isArray(pat) ? pat[i % pat.length] : pat))).flat();

/** One exercise. spec { prog: (c) => [[off, minor]...], pat, reps, shape, name, goal, start, why, instr, watch, simplify, minutes }. */
export function bcRun(c, id, method, spec) {
  const notes = [], used = []; let t = 0, near = 0;
  const list = toBars(spec.prog(c), spec.pat, spec.reps || 1), key = mod12(c.key);
  const pls = list.map(b => place(mod12(key + b.off), 0, spec.shape || null));
  // place each bar near the previous one
  let prev = 0;
  for (let i = 0; i < list.length; i++) { const p = place(mod12(key + list[i].off), prev, spec.shape || null); if (!p) return null; pls[i] = p; prev = p.f; }
  let unit = null;
  list.forEach((b, i) => {
    const root = mod12(key + b.off), pl = pls[i], sh = shapeOf(pl, b.minor), P = PAT[b.pat];
    unit = unit || P.unit;
    const next = list[(i + 1) % list.length], npl = pls[(i + 1) % list.length], nroot = mod12(key + next.off);
    for (const [sl, len, kind] of P.ev) {
      const T = t + sl * 0.5, D = len * 0.5, pk = sl % 2 ? 'u' : 'd';
      const chordPcs = [0, 3, 4, 7].map(o => mod12(root + o));
      if (kind === 'B') notes.push(tag(N(sh[0][0], sh[0][1], T, D, null, { pick: 'd' }), [root]));
      else if (kind === 'F') notes.push(tag(N(sh[1][0], sh[1][1], T, D, null, { pick: 'd' }), [mod12(root + 7)]));
      else if (kind === 'K') sh.slice(2, 5).forEach(([s, f, o]) => notes.push(tag(N(s, f, T, Math.min(D, 0.5), null, { chord: true, pick: 'd' }), [mod12(root + o)])));
      else if (kind === 'k') sh.slice(3, 5).forEach(([s, f, o]) => notes.push(tag(N(s, f, T, Math.min(D, 0.5), null, { chord: true, pick: 'u' }), [mod12(root + o)])));
      else if (kind === 'X') sh.slice(2, 5).forEach(([s, f]) => notes.push(tag(N(s, f, T, 0.5, 'mute', { chord: true, pick: 'd' }), chordPcs)));
      else if (kind[0] === 'W') { const o = walkOff(+kind[1], b.minor); notes.push(tag(N(pl.rs, pl.f + o, T, D, null, { pick: pk }), [mod12(root + o)])); }
      else if (kind === 'A') { const f2 = npl.f >= 1 ? npl.f - 1 : npl.f + 1; notes.push(tag(N(npl.rs, f2, T, D, null, { pick: 'u' }), [mod12(nroot + (npl.f >= 1 ? -1 : 1))])); }
    }
    used.push(chordName(root, b.minor)); t += 4;
  });
  if (notes.length < 6 || notes.length > 400) return null;
  const uniq = [...new Set(used)], keyName = `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`;
  const fill = x => String(x).replace(/\{chords\}/g, uniq.slice(0, 6).join(' – ')).replace(/\{key\}/g, keyName);
  return make(c, {
    id, name: fill(spec.name), domain: 'rhythm', method, unit: spec.unit || unit, goal: spec.goal, start: spec.start, minutes: spec.minutes || 5,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, backing: used, chords: uniq, tab: { notes }
  });
}
const ST = (concept, why, theory) => ({ concept, why, theory });
const G = (id, method, spec) => c => bcRun(c, id, method, spec);
const P1 = c => PROG.one(c), P14 = c => PROG.oneFour(c), PC = c => PROG.country(c), P16 = c => PROG.oneSix(c), P154 = c => PROG.oneFiveFour(c);

/* ------------------------------ Foundations ------------------------------ */
const rootOnly = G('bc-root-q', 'accurate-reps', { name: 'The boom: the root on every beat ({key}: {chords})', prog: P1, pat: 'rootQ', reps: 2, goal: 90, start: 60, minutes: 4,
  why: 'Teachers start with one thing: a clear bass note on the root string, with the chord held down, so the "boom" is steady before anything else is added.',
  instr: 'Hold the chord shape and pick only the lowest string (the root) with a downstroke on every beat. Pass: 8 bars with every note ringing clearly and the same volume.',
  watch: 'Hitting a neighbouring string with the pick.', simplify: 'One note every two beats.' });
const rootChuck = G('bc-root-chuck', 'chunking', { name: 'Root on 1 and 3, chuck on 2 and 4 ({key}: {chords})', prog: P1, pat: 'rootChuck', reps: 2, goal: 90, start: 60,
  why: 'The pattern in its simplest form: a single bass note on beats 1 and 3, and a short strum of the upper strings on 2 and 4.',
  instr: 'Pick the root with a downstroke on beats 1 and 3, then strum the three upper strings of the shape on 2 and 4, lifting the pick off the strings after each strum. Count 1 2 3 4. Pass: 8 bars with a clear low-high-low-high sound and the strum no louder than the bass note.',
  watch: 'Strumming too many strings or too hard.', simplify: 'Play the chuck only; keep the bass in your head.' });
const altBass = G('bc-alt-q', 'accurate-reps', { name: 'Alternating bass: root, fifth ({key}: {chords})', prog: P1, pat: 'altQ', reps: 2, goal: 90, start: 60, minutes: 4,
  why: 'The step after one root note is alternating it with the fifth, the string next to it: this is what turns a strum into a bass line.',
  instr: 'Hold the chord, pick the root on beats 1 and 3 and the fifth on beats 2 and 4, all downstrokes. Pass: 8 bars where both notes ring and the alternation never falters.',
  watch: 'Missing the fifth string and hitting the root again.', simplify: 'Root twice, then fifth twice.' });
const bc1 = G('bc-one', 'chunking', { name: 'Boom-chuck on one chord ({key}: {chords})', prog: P1, pat: 'bc', reps: 2, goal: 100, start: 65,
  why: 'Root, chuck, fifth, chuck: the full boom-chuck.',
  instr: 'Root on 1, chuck on 2, fifth on 3, chuck on 4, all downstrokes. Keep the pick close to the strings. Pass: 8 bars, steady, with the chuck short and the bass notes ringing.',
  watch: 'Rushing the chuck.', simplify: 'Use the root only for the bass.' });
const bc14 = G('bc-14', 'chunking', { name: 'Boom-chuck on two chords, I and IV ({key}: {chords})', prog: P14, pat: 'bc', reps: 2, goal: 100, start: 65,
  why: 'Two chords, two bars each: the first test of changing chord without breaking the pattern.',
  instr: 'Boom-chuck on the I chord for two bars, then the IV chord for two bars, moving the fretting hand on beat 1 and keeping the picking going. Pass: 8 bars with no hesitation at the changes.',
  watch: 'Stopping the pick while the left hand moves.', simplify: 'Four bars on each chord.' });
const bcCountry = G('bc-country', 'transfer', { name: 'Boom-chuck on I–IV–V–I ({key}: {chords})', prog: PC, pat: 'bc', reps: 2, goal: 105, start: 65,
  why: 'Three chords is the first real song: I, IV and V, one bar each, the shape of most country and bluegrass tunes.',
  instr: 'One bar of each chord, I–IV–V–I, boom-chuck all the way. Pass: 8 bars at the goal tempo with each fifth found on the first try.',
  watch: 'Losing the fifth after a change.', simplify: 'Two bars per chord.' });
const bcMinor = G('bc-minor', 'interleaving', { name: 'Boom-chuck in the minor key ({key}: {chords})', prog: c => PROG.country({ ...c, minor: true }), pat: 'bc', reps: 2, goal: 100, start: 65,
  why: 'The same pattern on minor chords: only the third changes, in the chuck.',
  instr: 'Boom-chuck on i–iv–V–i; the minor chuck is one fret lower on its third string. Pass: 8 bars with the V chord played major.',
  watch: 'Playing the minor shape on the V.', simplify: 'Use the chuck only on beat 2.' });
const bcDead1 = G('bc-dead-intro', 'external-focus', { name: 'A dead chuck: the strings muted with the fretting hand ({key}: {chords})', prog: P1, pat: 'bcDead', reps: 2, goal: 95, start: 60,
  why: 'Easing the fretting-hand pressure for the chuck gives the percussive "chick" many players use; it is the same pattern with a different sound.',
  instr: 'On beats 2 and 4, relax the fretting fingers so the strings are muted, strum the upper strings (a click), and press again for the bass notes. Pass: 8 bars with a clear click on 2 and 4 and the bass notes ringing.',
  watch: 'Letting the bass notes go dead too.', simplify: 'Make the dead chuck on beat 4 only.' });

/* ------------------------------ Intermediate ------------------------------ */
const up1 = G('bc-up-one', 'chunking', { name: 'Boom-chuck-a on one chord ({key}: {chords})', prog: P1, pat: 'bcUp', reps: 2, goal: 100, start: 65,
  why: 'Teachers add an upstroke on the "and" of 2 and 4, a light brush of the top strings, to make the pattern bounce.',
  instr: 'Root on 1, down-strum on 2, an up-strum of the top two strings on the "&" of 2, fifth on 3, down-strum on 4, up on the "&" of 4. Pass: 8 bars with every up-strum soft and evenly placed.',
  watch: 'The up-strum louder than the chuck.', simplify: 'Add the upstroke after beat 4 only.' });
const upAll = G('bc-up-all', 'chunking', { name: 'An up-chuck after every beat ({key}: {chords})', prog: P1, pat: 'bcUpAll', reps: 2, goal: 95, start: 60,
  why: 'The next rung: the hand swings in steady 8ths and the upstroke fills every gap.',
  instr: 'Down on the beats (bass notes on 1 and 3, chucks on 2 and 4), up-strums on every "&". Keep the hand moving constantly. Pass: 8 bars with a constant down-up motion.',
  watch: 'Stopping the hand on the beats that have no strum.', simplify: 'Use the pattern from the previous lesson.' });
const upProg = G('bc-up-country', 'transfer', { name: 'Boom-chuck-a over I–IV–V–I ({key}: {chords})', prog: PC, pat: 'bcUp', reps: 2, goal: 105, start: 65,
  why: 'The bouncing pattern on the usual three chords.',
  instr: 'Boom-chuck-a, one chord per bar, I–IV–V–I. Pass: 8 bars with no break at the changes.',
  watch: 'Leaving out the upstrokes at changes.', simplify: 'Two bars per chord.' });
const eform = G('bc-eform', 'interleaving', { name: 'Boom-chuck with E-form shapes, roots on the 6th string ({key}: {chords})', prog: PC, pat: 'bc', reps: 2, shape: 6, goal: 105, start: 65,
  why: 'The same chords can sit on the 6th-string shape; the root is a string lower, the fifth on the 5th string.',
  instr: 'Root on the 6th string, fifth on the 5th (two frets up), chuck on strings 4–2. Pass: 8 bars with a clean 6th-string root every time.',
  watch: 'Muddy open strings in the chuck.', simplify: 'Two bars per chord.' });
const aform = G('bc-aform', 'interleaving', { name: 'Boom-chuck with A-form shapes, roots on the 5th string ({key}: {chords})', prog: PC, pat: 'bc', reps: 2, shape: 5, goal: 105, start: 65,
  why: 'Chords on the 5th-string shape give a higher, tighter sound and a shorter reach for the fifth.',
  instr: 'Root on the 5th string, fifth on the 4th (two frets up), chuck on strings 3–1. Pass: 8 bars with every bass note ringing.',
  watch: 'Hitting the 6th string.', simplify: 'Two bars per chord.' });
const walk1 = G('bc-walk-14', 'chunking', { name: 'Walk-up from I into the IV chord ({key}: {chords})', prog: P14, pat: ['bc', 'walkUp'], reps: 2, goal: 95, start: 60,
  why: 'A walk-up is a short bass line on the root string connecting two chords; it is how the sources lead into a change.',
  instr: 'Boom-chuck for two beats, then climb the root string: root, 2nd, 3rd, 4th on the last 8ths. The line should land on the next chord. Pass: 8 bars with the climb steady and the next chord on beat 1.',
  watch: 'Rushing the climb.', simplify: 'Play only the root and the 3rd.' });
const walkC = G('bc-walk-country', 'transfer', { name: 'Walk-ups at every change ({key}: {chords})', prog: PC, pat: ['bc', 'bc', 'bc', 'walkUp'], reps: 2, goal: 100, start: 60,
  why: 'The walk-up comes at the end of the phrase: three bars of boom-chuck and one with the climb.',
  instr: 'Boom-chuck for three bars, then the walk-up bar. Pass: 8 bars with the walk-up in the same place each time.',
  watch: 'Speeding up for the climb.', simplify: 'Walk-up only every other time.' });
const walkP = G('bc-walk-1514', 'interleaving', { name: 'Walk-ups on I–V–IV–I ({key}: {chords})', prog: P154, pat: ['walkUp', 'bc', 'walkUp', 'bc'], reps: 2, goal: 100, start: 60,
  why: 'A different order of chords with the same climbs.',
  instr: 'Boom-chuck bars alternate with walk-up bars. Pass: 8 bars with each climb finishing exactly on the next beat 1.',
  watch: 'The climb not landing on the next chord.', simplify: 'Use plain boom-chuck bars.' });
const appr1 = G('bc-approach', 'chunking', { name: 'An approach note into the next chord ({key}: {chords})', prog: PC, pat: 'appr', reps: 2, goal: 95, start: 60,
  why: 'A single note one fret from the next root, played on the last 8th, pulls the ear into the change.',
  instr: 'Boom-chuck with a last 8th that is one fret below (or above) the next chord\'s root, picked with an upstroke. Pass: 8 bars with the approach note quiet and the root on 1.',
  watch: 'An approach note that is too loud.', simplify: 'Only on the last bar.' });
const apprMix = G('bc-approach-mix', 'interleaving', { name: 'Approach notes and walk-ups together ({key}: {chords})', prog: P16, pat: ['appr', 'bc', 'walkUp', 'appr'], reps: 2, goal: 95, start: 60,
  why: 'Choosing between the two ways of changing chord is what the sources mean by a bass line.',
  instr: 'A different way of getting into each chord. Pass: 8 bars with every change clean.',
  watch: 'Mixing up which bar gets which.', simplify: 'Only walk-ups.' });

/* ------------------------------- Advanced ------------------------------- */
const deadC = G('bc-dead-country', 'transfer', { name: 'Dead chucks over I–IV–V–I ({key}: {chords})', prog: PC, pat: 'bcDead', reps: 2, goal: 115, start: 75,
  why: 'The percussive chuck is a feel choice; on a progression the damping has to stay in time.',
  instr: 'Dead chuck on 2 and 4 over the changes. Pass: 8 bars at the goal tempo with every click on the beat.',
  watch: 'Letting the bass notes die.', simplify: 'Dead chuck on beat 4 only.' });
const deadMix = G('bc-dead-mix', 'interleaving', { name: 'Dead and live chucks bar by bar ({key}: {chords})', prog: P16, pat: ['bc', 'bcDead'], reps: 2, goal: 110, start: 70,
  why: 'Switching between the open chuck and the dead one lets you shape the dynamics of a verse.',
  instr: 'One bar of ringing chucks, the next bar dead, over the changes. Pass: 8 bars with a clean change of sound.',
  watch: 'Muting the bass notes in the dead bars.', simplify: 'Two bars each.' });
const walk4a = G('bc-walk4', 'chunking', { name: 'Walking bass in quarters ({key}: {chords})', prog: PC, pat: 'walk4', reps: 2, goal: 105, start: 70,
  why: 'The bass becomes a line: root, 2nd, 3rd, 4th, each on a beat, one bar to a chord.',
  instr: 'Climb the root string of each chord, one note per beat. Pass: 8 bars with every note ringing and the line connecting.',
  watch: 'Ignoring the shape of the next chord.', simplify: 'Two notes a bar.' });
const walkCh = G('bc-walk-chuck', 'chunking', { name: 'Walking bass with chucks ({key}: {chords})', prog: PC, pat: 'walkChuck', reps: 2, goal: 105, start: 70,
  why: 'A bass line on beats 1 and 3 with the chucks on 2 and 4, the sound of a solo flatpicker.',
  instr: 'Root on 1, chuck on 2, the 3rd of the scale on 3, chuck on 4. Pass: 8 bars with the chuck steady.',
  watch: 'The walking note too loud.', simplify: 'Root and chuck only.' });
const mixfeel = G('bc-switch', 'interleaving', { name: 'Switching the feel every bar ({key}: {chords})', prog: P16, pat: ['bc', 'bcUp', 'bcDead', 'walkUp'], reps: 2, goal: 105, start: 70,
  why: 'A four-bar pattern of feels: plain, bouncing, dead, climbing.',
  instr: 'Each bar a different pattern, the hand never stopping. Pass: 8 bars with no hesitation at the barlines.',
  watch: 'Stumbling at the walk-up.', simplify: 'Two feels.' });
const mixfeel2 = G('bc-switch-mixed', 'interleaving', { name: 'Switching feels on I–V–IV–I ({key}: {chords})', prog: P154, pat: ['bcUp', 'bcDead', 'appr', 'walk4'], reps: 2, goal: 105, start: 70,
  why: 'The same idea in a different order.',
  instr: 'Each bar a different pattern. Pass: 8 bars at the goal tempo with every pattern clear.',
  watch: 'The wrong pattern for the bar.', simplify: 'Two feels.' });
const prog16 = G('bc-1645', 'transfer', { name: 'Boom-chuck on I–vi–IV–V ({key}: {chords})', prog: P16, pat: 'bcUp', reps: 2, goal: 110, start: 70,
  why: 'A fourth chord, a different shape, the same hand.',
  instr: 'Boom-chuck-a over four chords, one per bar. Pass: 8 bars with the fifth found on the first try.',
  watch: 'Losing the pattern on the minor chord.', simplify: 'Plain boom-chuck.' });
const prog16w = G('bc-1645-walk', 'transfer', { name: 'I–vi–IV–V with walk-ups and approach notes ({key}: {chords})', prog: P16, pat: ['walkUp', 'appr', 'bcUp', 'appr'], reps: 2, goal: 105, start: 65,
  why: 'The lesson of the stage: a complete accompaniment with bass lines.',
  instr: 'A walk-up, approach, bouncing bar, approach. Pass: 8 bars at the goal tempo.',
  watch: 'Overusing the walk-up.', simplify: 'Plain boom-chuck-a.' });

/* ------------------------------- Mastery ------------------------------- */
const tempo = G('bc-tempo', 'accurate-reps', { name: 'Boom-chuck at performance tempo ({key}: {chords})', prog: PC, pat: 'bc', reps: 4, goal: 140, start: 100, minutes: 6,
  why: 'A band tempo for country and bluegrass: sixteen bars without the pattern tiring.',
  instr: 'Boom-chuck over I–IV–V–I for 16 bars. Raise the click only while the hand stays loose. Pass: 16 bars at the goal tempo.',
  watch: 'Tension in the picking wrist.', simplify: 'Drop 10 BPM.' });
const tempoUp = G('bc-tempo-up', 'accurate-reps', { name: 'Boom-chuck-a at performance tempo ({key}: {chords})', prog: P16, pat: 'bcUp', reps: 4, goal: 130, start: 95, minutes: 6,
  why: 'The same tempo with the upstrokes in.',
  instr: 'Sixteen bars of boom-chuck-a, no breaks. Pass: 16 bars at the goal tempo with every up-strum even.',
  watch: 'Dropping the upstrokes.', simplify: 'Drop 10 BPM.' });
const endure = G('bc-endure', 'chunking', { name: 'A twelve-bar run of mixed feels ({key}: {chords})', prog: c => PROG.oneFiveFour(c).concat(PROG.country(c)).concat(PROG.oneSix(c)), pat: ['bc', 'bcUp', 'walkUp', 'appr', 'bcDead', 'bc'], reps: 1, goal: 120, start: 80, minutes: 6,
  why: 'Longer than the stage drills: twelve bars with all the pieces.',
  instr: 'Play the twelve bars without stopping, choosing walk-ups and approach notes where marked. Pass: twelve bars at the goal tempo.',
  watch: 'Losing the place after bar 8.', simplify: 'Eight bars.' });
const loop = G('bc-loop', 'accurate-reps', { name: 'Loop a four-bar phrase until it never changes ({key}: {chords})', prog: P154, pat: ['bc', 'bcUp', 'walkUp', 'bc'], reps: 2, goal: 125, start: 85, minutes: 6,
  why: 'Looping a short cell and recording it is the sources\' way to find tempo drift.',
  instr: 'Loop the four-bar phrase for three minutes. Pass: three minutes with no change in the pattern or tempo.',
  watch: 'Speeding up.', simplify: 'Drop 10 BPM.' });
const cap8 = G('bc-cap-8', 'transfer', { name: 'Study: an 8-bar accompaniment ({key}: {chords})', prog: c => PROG.country(c).concat(PROG.oneSix(c)), pat: ['bc', 'bcUp', 'bc', 'walkUp', 'bcUp', 'bcDead', 'appr', 'bc'], reps: 1, goal: 125, start: 85, minutes: 7,
  why: 'An original accompaniment using the whole path.',
  instr: 'Learn it two bars at a time, then as a whole, then write your own version on the same chords. Pass: one clean pass at the goal tempo.',
  watch: 'Rushing the walk-up.', simplify: 'First four bars.' });
const cap12 = G('bc-cap-12', 'transfer', { name: 'Capstone: a 12-bar accompaniment ({key}: {chords})', prog: c => PROG.country(c).concat(PROG.oneFiveFour(c)).concat(PROG.oneSix(c)), pat: ['bc', 'bcUp', 'bc', 'walkUp', 'bcDead', 'bcUp', 'appr', 'bc', 'walk4', 'bcUp', 'bc', 'appr'], reps: 1, goal: 125, start: 85, minutes: 8,
  why: 'The whole path in twelve bars.',
  instr: 'Learn in three four-bar phrases, join them, then write your own on the same chords. Pass: one clean pass at the goal tempo, then your own version once.',
  watch: 'Losing the pattern at a change.', simplify: 'Bars 1–8.' });

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'boomChuck', kind: 'technique', title: 'Boom-chuck rhythm (country and bluegrass flatpicking)', domain: 'rhythm',
  re: /boom.?chuck|boom.?chick|boom.?chuck.?a|alternating bass (strum|note|rhythm)|train beat|country (rhythm|strum)|bluegrass (rhythm|strum)/,
  aliases: ['boom chick', 'country rhythm', 'bluegrass rhythm guitar', 'alternating bass strum', 'bass-strum'],
  summary: 'The flat-picked accompaniment of country and bluegrass: a bass note (root, then fifth) alternating with a short chord strum, then the up-chuck, walk-ups, approach notes, dead chucks and walking bass.',
  prereqs: ['strumming'],
  ctx: { key: 4, minor: false, prog: 'folkAxis' },
  sources: [
    'https://acousticguitar.com/how-to-boomchuck/',
    'https://goodguitarist.com/country-chords-and-strumming',
    'https://pegheadnation.com/string-school/courses/flatpicking-guitar/bluegrass-rhythm-basics-part-1-boom-chuck-and-g-runs/'
  ],
  pedagogy: {
    date: '2026-10-30',
    summary: 'Taught by building the pattern from one piece at a time: first the bass note alone, then the bass note with the chord strum, then alternating the root with the fifth, one chord at a time, then three chords (I, IV, V). The upstroke on the "and" of 2 and 4 comes next, then walk-ups between chords as a bass line. Practice is a chord-by-chord ladder: get each chord solid before the next.',
    sequence: [
      { id: 'root', tier: 'foundations', step: 'The bass note alone, then with the chuck', how: 'A held chord; pick only the root on 1 and 3, then add the chord strum on 2 and 4.', skills: ['bc-s-root'], source: 0 },
      { id: 'alt', tier: 'foundations', step: 'Alternating the root and the fifth', how: 'The fifth is the neighbouring string; alternate root and fifth under the chuck.', skills: ['bc-s-alt'], source: 0 },
      { id: 'chords', tier: 'foundations', step: 'Two and three chords', how: 'The same pattern on one chord, then on the IV and V, one bar at a time.', skills: ['bc-s-chords'], source: 1 },
      { id: 'feel', tier: 'foundations', step: 'Minor keys and the dead chuck', how: 'Minor chords change the third in the chuck; a muted chuck is a different sound with the same pattern.', skills: ['bc-s-feel'], source: 1 },
      { id: 'up', tier: 'intermediate', step: 'The upstroke on the "and"', how: 'Up-strums on the "&" of 2 and 4, then on all of the "&"s.', skills: ['bc-s-up'], source: 0 },
      { id: 'shapes', tier: 'intermediate', step: 'The same pattern on other chord shapes', how: 'Repeat the moves on chords with the root on other strings: F and G in the C-F-G ladder.', skills: ['bc-s-shapes'], source: 0 },
      { id: 'walk', tier: 'intermediate', step: 'Walk-ups between chords', how: 'A short bass line connecting two chords: root, second, third.', skills: ['bc-s-walk'], source: 0 },
      { id: 'approach', tier: 'intermediate', step: 'Approach notes', how: 'A single note leading into the next chord.', skills: ['bc-s-approach'], source: 1 },
      { id: 'dead', tier: 'advanced', step: 'Dead chucks', how: 'Damping the strings for a percussive chuck.', skills: ['bc-s-dead'], source: 2 },
      { id: 'bass', tier: 'advanced', step: 'Walking bass', how: 'Lines of one note per beat with chucks.', skills: ['bc-s-bass'], source: 1 },
      { id: 'switch', tier: 'advanced', step: 'Switching feels', how: 'Mixing the patterns bar by bar.', skills: ['bc-s-switch'], source: 2 },
      { id: 'prog', tier: 'advanced', step: 'Longer progressions', how: 'I-vi-IV-V with bass lines.', skills: ['bc-s-prog'], source: 1 },
      { id: 'tempo', tier: 'mastery', step: 'Tempo', how: 'Sixteen bars at band tempo.', skills: ['bc-s-tempo'], source: 2 },
      { id: 'loop', tier: 'mastery', step: 'Loop and record', how: 'A short phrase looped until it never drifts; a twelve-bar run.', skills: ['bc-s-loop'], source: 1 },
      { id: 'study', tier: 'mastery', step: 'A full accompaniment', how: 'Original studies using the whole technique.', skills: ['bc-s-study'], source: 0 }
    ],
    drills: ['The root alone on every beat', 'Root on 1 and 3 with the chord strum on 2 and 4', 'Alternating the root and the fifth', 'Repeating the pattern on I, IV and V one at a time', 'Adding the upstroke on the "and" of 2 and 4', 'Walk-ups of three notes from the root', 'A twelve-bar run of mixed feels'],
    mistakes: ['Strumming too many strings or too hard', 'Rushing the chuck', 'Missing the fifth string', 'Stopping the pick hand while the fretting hand moves', 'An up-strum louder than the chuck', 'Walk-ups that do not land on the next chord'],
    sources: [
      { title: 'How to Play the Boom-Chuck Strumming Pattern on Guitar', author: 'Cathy Fink (Acoustic Guitar)', url: 'https://acousticguitar.com/how-to-boomchuck/' },
      { title: 'Boom Chuck country chords and strumming (Walking Bassline Challenge)', author: 'Good Guitarist', url: 'https://goodguitarist.com/country-chords-and-strumming' },
      { title: 'Bluegrass Rhythm Basics, Part 1: Boom-Chuck and G-Runs', author: 'Peghead Nation', url: 'https://pegheadnation.com/string-school/courses/flatpicking-guitar/bluegrass-rhythm-basics-part-1-boom-chuck-and-g-runs/' }
    ]
  },
  stages: [
    stage('foundations', 'Boom and chuck',
      'Boom-chuck (root, chuck, fifth, chuck) over I–IV–V–I at 100 BPM for 8 bars, with a short chuck, the fifth found every time and no hesitation at the changes.', [
        S('bc-s-root', 'The boom and the chuck', 'rhythm', 'A bass note alone, then with the chord strum.', [rootOnly, rootChuck],
          ST('The "boom" is one bass note (the root of the chord) and the "chuck" is a short strum of the upper strings. Bass on 1 and 3, strum on 2 and 4, is the whole pattern in its simplest form.', 'The sound of country and bluegrass rhythm is the contrast between a clear low note and a quick high strum.', ['Boom on the beat, chuck right after.', 'Lift the pick off the strings after the chuck.', 'Keep the strum quieter than the bass.'])),
        S('bc-s-alt', 'Root and fifth', 'rhythm', 'Alternating the bass note.', [altBass, bc1],
          ST('The fifth of the chord sits on the next string (two frets up). Alternating root and fifth gives the bass its walking motion under the strum.', 'It turns the strum into a bass line, the thing that sets the style apart from a plain strum.', ['Root, fifth, root, fifth.', 'The fifth is a chord tone: no new fingering.', 'Both notes are downstrokes.'])),
        S('bc-s-chords', 'More than one chord', 'rhythm', 'Two and three chords.', [bc14, bcCountry],
          ST('Country rhythm uses the I, IV and V chords of the key. Changing chord means moving the root and the fifth to new strings or frets while the pick keeps the beat.', 'It is where the pattern becomes a song.', ['I, IV and V make most country tunes.', 'Move the fretting hand on beat 1.', 'Never stop the picking hand.'])),
        S('bc-s-feel', 'Minor keys and a dead chuck', 'rhythm', 'The pattern in a minor key and with a damped chuck.', [bcMinor, bcDead1],
          ST('A minor chord lowers the third by a fret; in the chuck that is the note on string 3 (E-form) or string 2 (A-form). A dead chuck mutes the strings with the fretting hand so the strum is a click.', 'It makes the pattern work in any key and in a more percussive style.', ['Minor: the third one fret lower.', 'The V chord in a minor key is often major.', 'Dead chuck: relax the fretting hand, do not lift it.']))
      ]),
    stage('intermediate', 'The up-chuck, shapes and bass lines',
      'Boom-chuck-a over I–IV–V–I with E-form and A-form shapes, with a walk-up into a change and an approach note into the next chord, each for 8 bars at 105 BPM.', [
        S('bc-s-up', 'The up-chuck', 'rhythm', 'An upstroke on the "and".', [up1, upAll, upProg],
          ST('The up-chuck is a light brush of the top two strings on the "and" of 2 and 4 (boom-chuck-a). The hand keeps moving down-up and the up-strum is softer than the down-strum.', 'It makes the pattern bounce and is the next step after the plain boom-chuck.', ['Down on the beat, up on the "and".', 'The up-strum is light: top two strings.', 'Keep the hand moving.'])),
        S('bc-s-shapes', 'Chord shapes', 'rhythm', 'Roots on the 6th and the 5th string.', [eform, aform],
          ST('Every major or minor chord can be played with the root on string 6 (E-form) or string 5 (A-form). The root and the fifth then sit on different strings, and the chuck on the next three.', 'It lets you play the pattern in any key.', ['E-form: root on 6, fifth on 5 (two frets up).', 'A-form: root on 5, fifth on 4 (two frets up).', 'The chuck is always the next three strings.'])),
        S('bc-s-walk', 'Walk-ups', 'rhythm', 'A short bass line into the next chord.', [walk1, walkC, walkP],
          ST('A walk-up climbs the root string of the chord by scale steps (root, second, third) on the last beat of a bar, and lands on the next chord\'s root on beat 1.', 'It connects the chords like a bass player would.', ['Climb on the last 8ths of the bar.', 'The third is major (or minor in a minor key).', 'Land on the next root on beat 1.'])),
        S('bc-s-approach', 'Approach notes', 'rhythm', 'A note one fret from the next chord.', [appr1, apprMix],
          ST('An approach note is a single note a fret below or above the next chord\'s root, played on the last 8th. It leads the ear into the change.', 'It is the shortest way to make a change sound connected.', ['One fret from the target.', 'Played as an upstroke, softly.', 'The root lands on 1.']))
      ]),
    stage('advanced', 'Dead chucks, walking bass and longer forms',
      'Dead chucks, walking bass with chucks, a bar-by-bar switch between four feels and I–vi–IV–V with bass lines, each for 8 bars at 105 BPM with the pick never stopping.', [
        S('bc-s-dead', 'Dead chucks in a progression', 'rhythm', 'Damping the strings in time.', [deadC, deadMix],
          ST('A dead chuck is a damped strum; used over changes it needs the fretting hand to relax and press again on time.', 'It gives a percussive, drier feel and contrasts with open chucks.', ['Relax the pressure, do not lift.', 'The click lands on 2 and 4.', 'Bass notes stay open.'])),
        S('bc-s-bass', 'Walking bass', 'rhythm', 'Bass notes that walk.', [walk4a, walkCh],
          ST('A walking bass plays one note per beat, climbing the scale from the root; with the chuck it uses beats 1 and 3 for bass and 2 and 4 for the strum.', 'It is the solo flatpicker\'s way of being the bass player.', ['Root, 2nd, 3rd, 4th.', 'Keep the notes even.', 'The chuck stays steady.'])),
        S('bc-s-switch', 'Switching feels', 'rhythm', 'A different pattern every bar.', [mixfeel, mixfeel2],
          ST('Each bar can use a different pattern: plain, bouncing, dead, climbing. The hand never stops.', 'It shapes a verse and is how accompanists keep a long song interesting.', ['Plan the pattern per bar.', 'Switch on the barline.', 'Keep the hand moving.'])),
        S('bc-s-prog', 'Longer progressions', 'rhythm', 'Four chords with bass lines.', [prog16, prog16w],
          ST('I–vi–IV–V uses a minor chord in a major key; the pattern stays the same and only the third in the chuck changes.', 'A fourth chord is the step from simple tunes to most pop and country.', ['The vi chord is minor.', 'Bass lines connect the changes.', 'Keep the pattern unchanged.']))
      ]),
    stage('mastery', 'Tempo, endurance and studies',
      'Boom-chuck at 140 BPM and boom-chuck-a at 130 BPM for 16 bars, a looped phrase held for three minutes, and an eight- and a twelve-bar original accompaniment at 125 BPM.', [
        S('bc-s-tempo', 'Performance tempo', 'rhythm', 'Sixteen bars at band tempo.', [tempo, tempoUp],
          ST('Band tempo for country and bluegrass is where the pattern must run on its own: the picking hand is relaxed and the fretting hand changes ahead of time.', 'It shows whether the pattern is automatic.', ['Raise the click only while relaxed.', 'Plan each change one beat early.', 'Record yourself.'])),
        S('bc-s-loop', 'Endurance', 'rhythm', 'A looped phrase and a long run.', [loop, endure],
          ST('A short cell looped and recorded shows drift in tempo and volume; a twelve-bar run tests the whole toolkit.', 'It builds the stamina of a working rhythm player.', ['Loop for three minutes.', 'Listen for drift.', 'Lower the tempo and restart if it breaks.'])),
        S('bc-s-study', 'Original accompaniments', 'rhythm', 'Studies using the whole path.', [cap8, cap12],
          ST('The last step is arranging: choosing a pattern for each bar from everything you have learned.', 'It turns the technique into your own playing.', ['Learn in phrases.', 'Choose walk-ups with care.', 'Write your own on the same chords.']))
      ])
  ]
});
