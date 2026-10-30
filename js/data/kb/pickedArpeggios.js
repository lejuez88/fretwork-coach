// Picked chord arpeggios: the accompaniment of ballads and folk-rock played with a pick, one string of the
// chord at a time with the notes left to ring. Foundations: one note per beat up the chord, then up and back
// in 8ths and holding the shape; intermediate: rolling patterns, alternating bass, triplet (6/8-style)
// patterns, two chords in a bar; advanced: 16ths, string-skipping broken patterns, and arpeggios under a
// changing progression; mastery: tempo, endurance and original studies.
//
// Concept-first (CONTENT.md): the chord is the same MOVABLE SHAPE as boomChuck.js (E-form: strings 6-1 =
// R 5 R 3 5 R; A-form: strings 5-1 = R 5 R 3 5, the 3rd a fret lower for minor), so every note is a chord
// tone by construction. A pattern is a list of indexes into the shape (0 = lowest string), each on a slot of
// a grid of 8, 12 (triplets) or 16 per bar; picks alternate down-up in order (quarter-note patterns are all
// downstrokes); notes ring until the bar ends or two beats pass.
//
// Teaching method first (see `pedagogy` below), researched 2026-10-30.
import { N, nameOf, make, mod12, S, stage, entry } from '../lib.js';
import { place, shapeOf, chordName, ALLOW, tag } from './boomChuck.js';
export { ALLOW };

/** Patterns: grid slots per bar and the shape index played on each slot (null = rest). */
export const PAT = {
  qUp: { grid: 8, name: 'one note a beat, up the chord', unit: 'quarter notes', dn: true, seq: [0, null, 1, null, 2, null, 3, null] },
  qUpBack: { grid: 8, name: 'one note a beat, up and back', unit: 'quarter notes', dn: true, seq: [0, null, 2, null, 4, null, 2, null] },
  upBack: { grid: 8, name: 'up and back, 8th notes', unit: '8th notes', seq: [0, 1, 2, 3, 4, 3, 2, 1] },
  upBack3: { grid: 8, name: 'up and back on the top four strings', unit: '8th notes', seq: [1, 2, 3, 4, 3, 2, 3, 2] },
  roll: { grid: 8, name: 'bass, then a rolling three', unit: '8th notes', seq: [0, 2, 3, 4, 3, 2, 3, 2] },
  rollB: { grid: 8, name: 'bass, then a rolling three, twice', unit: '8th notes', seq: [0, 2, 3, 4, 0, 2, 3, 4] },
  altBass: { grid: 8, name: 'alternating bass with a repeated third', unit: '8th notes', seq: [0, 3, 1, 3, 0, 3, 1, 3] },
  altBass2: { grid: 8, name: 'alternating bass with the top two strings', unit: '8th notes', seq: [0, 4, 3, 4, 1, 4, 3, 4] },
  tri: { grid: 12, name: 'triplets, up and back (6/8 feel)', unit: '8th-note triplets', seq: [0, 2, 3, 4, 3, 2, 0, 2, 3, 4, 3, 2] },
  tri2: { grid: 12, name: 'triplets, bass then three up', unit: '8th-note triplets', seq: [0, 2, 3, 1, 2, 4, 0, 2, 3, 1, 2, 4] },
  s16: { grid: 16, name: 'up and back, 16th notes', unit: '16th notes', seq: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1] },
  s16b: { grid: 16, name: 'bass with a broken top, 16th notes', unit: '16th notes', seq: [0, 2, 3, 2, 4, 2, 3, 2, 1, 2, 3, 2, 4, 2, 3, 2] },
  skip: { grid: 8, name: 'skipping strings, bass and top', unit: '8th notes', seq: [0, 4, 2, 4, 1, 4, 3, 4] }
};
export const PROG = {
  one: c => [[0, !!c.minor], [0, !!c.minor], [0, !!c.minor], [0, !!c.minor]],
  oneFour: c => [[0, !!c.minor], [0, !!c.minor], [5, !!c.minor], [5, !!c.minor]],
  oneFive: c => (c.minor ? [[0, true], [0, true], [7, false], [0, true]] : [[0, false], [7, false], [0, false], [7, false]]),
  folk: c => (c.minor ? [[0, true], [8, false], [3, false], [10, false]] : [[0, false], [7, false], [9, true], [5, false]]),
  oneSix: c => (c.minor ? [[0, true], [8, false], [10, false], [0, true]] : [[0, false], [9, true], [5, false], [7, false]])
};
const toBars = (prog, pat, reps, half) => Array.from({ length: reps }, () => prog.map(([off, minor], i) => ({ off, minor, pat: Array.isArray(pat) ? pat[i % pat.length] : pat, half: half ? half[i % half.length] : null }))).flat();

/** One exercise. spec { prog, pat, reps, half: [[off, minor] | null per bar] (a second chord from beat 3), shape, name, goal, start, ... }. */
export function arpRun(c, id, method, spec) {
  const notes = [], used = []; let t = 0, prev = 0;
  const key = mod12(c.key), list = toBars(spec.prog(c), spec.pat, spec.reps || 1, spec.half ? spec.half(c) : null);
  let unit = null;
  for (const b of list) {
    const P = PAT[b.pat]; unit = unit || P.unit;
    const roots = [mod12(key + b.off)], pls = [place(roots[0], prev, spec.shape || null)];
    if (!pls[0]) return null;
    let sh = [shapeOf(pls[0], b.minor)]; const names = [chordName(roots[0], b.minor)];
    if (b.half) { const r2 = mod12(key + b.half[0]), p2 = place(r2, pls[0].f, spec.shape || null); if (!p2) return null; roots.push(r2); pls.push(p2); sh.push(shapeOf(p2, b.half[1])); names.push(chordName(r2, b.half[1])); }
    const step = 4 / P.grid; let k = 0;
    P.seq.forEach((idx, slot) => {
      if (idx == null) return;
      const ci = b.half && slot >= P.grid / 2 ? 1 : 0, s = sh[ci], T = t + slot * step;
      const [str, fret, off] = s[Math.min(idx, s.length - 1)];
      const end = ci === 0 && b.half ? t + 2 : t + 4, D = Math.min(2, end - T);
      notes.push(tag(N(str, fret, T, Math.max(step, D), null, { pick: P.dn || k % 2 === 0 ? 'd' : 'u' }), [mod12(roots[ci] + off)]));
      k++;
    });
    names.forEach(n => used.push(n)); prev = pls[pls.length - 1].f; t += 4;
  }
  if (notes.length < 6 || notes.length > 400) return null;
  const uniq = [...new Set(used)], keyName = `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`;
  const fill = x => String(x).replace(/\{chords\}/g, uniq.slice(0, 6).join(' – ')).replace(/\{key\}/g, keyName);
  return make(c, {
    id, name: fill(spec.name), domain: 'picking', method, unit: spec.unit || unit, goal: spec.goal, start: spec.start, minutes: spec.minutes || 5,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, backing: used, chords: uniq, tab: { notes }
  });
}
const ST = (concept, why, theory) => ({ concept, why, theory });
const G = (id, method, spec) => c => arpRun(c, id, method, spec);
const P1 = c => PROG.one(c), P14 = c => PROG.oneFour(c), P15 = c => PROG.oneFive(c), PF = c => PROG.folk(c), P16 = c => PROG.oneSix(c);
const HALF = c => [[7, false], null, [7, false], null];

/* ------------------------------ Foundations ------------------------------ */
const qUp = G('pa-q-up', 'accurate-reps', { name: 'One note a beat, up the chord ({key}: {chords})', prog: P1, pat: 'qUp', reps: 2, goal: 80, start: 55, minutes: 4,
  why: 'Teachers start with the simplest arpeggio: one string of a held chord at a time, in order, with the notes ringing together.',
  instr: 'Hold the chord shape and pick the lowest four strings in order, one per beat, all downstrokes, letting each ring. Pass: 8 bars with every note ringing clearly and evenly spaced.',
  watch: 'Fretting fingers lying flat and muting strings.', simplify: 'One note every two beats.' });
const qBack = G('pa-q-back', 'chunking', { name: 'One note a beat, up and back ({key}: {chords})', prog: P1, pat: 'qUpBack', reps: 2, goal: 80, start: 55, minutes: 4,
  why: 'Coming back down is the next step: the same strings in the other direction.',
  instr: 'Play root, then up through the chord and back, one per beat. Pass: 8 bars with every string clearly sounded.',
  watch: 'Missing the middle string on the way back.', simplify: 'Stay on the bass strings.' });
const upBack = G('pa-8-upback', 'accurate-reps', { name: 'Up and back in 8th notes ({key}: {chords})', prog: P1, pat: 'upBack', reps: 2, goal: 90, start: 60,
  why: 'The pattern teachers use first at an even 8th-note pulse: up the five strings and back.',
  instr: 'Alternate down and up strokes on eight 8ths per bar: 1 & 2 & 3 & 4 &. Pass: 8 bars with the notes even and let ring.',
  watch: 'Pick catching on a string.', simplify: 'Quarter notes (previous lesson).' });
const upBack3 = G('pa-8-top', 'chunking', { name: 'Up and back on the top strings ({key}: {chords})', prog: P1, pat: 'upBack3', reps: 2, goal: 90, start: 60,
  why: 'A shorter pattern that stays on the strings above the bass.',
  instr: 'Down-up on strings 5–2 of the shape and back. Pass: 8 bars even.',
  watch: 'Starting on the wrong string.', simplify: 'Slower.' });
const hold = G('pa-hold-14', 'transfer', { name: 'Up and back on two chords, I and IV ({key}: {chords})', prog: P14, pat: 'upBack', reps: 2, goal: 90, start: 60,
  why: 'Changing chord without breaking the pattern: the first test of an arpeggio in a song.',
  instr: 'Two bars on each chord. Move the fretting hand on beat 1 and keep the picking going. Pass: 8 bars with no hesitation.',
  watch: 'The pick stopping as the left hand moves.', simplify: 'Four bars per chord.' });
const hold15 = G('pa-hold-15', 'transfer', { name: 'Up and back on I and V ({key}: {chords})', prog: P15, pat: 'upBack3', reps: 2, goal: 90, start: 60,
  why: 'Another pair of chords with the same hand.',
  instr: 'One bar on each chord. Pass: 8 bars with every note ringing.',
  watch: 'Lifting the fingers too early.', simplify: 'Two bars per chord.' });
const minorUp = G('pa-minor', 'interleaving', { name: 'The same pattern in the minor key ({key}: {chords})', prog: c => PROG.oneFour({ ...c, minor: true }), pat: 'upBack', reps: 2, goal: 90, start: 60,
  why: 'On a minor chord the third (one fret lower) is the only change.',
  instr: 'Up and back on i and iv. Pass: 8 bars with the third clearly different.',
  watch: 'Playing the major third.', simplify: 'One chord.' });
const slowRing = G('pa-ring', 'external-focus', { name: 'Letting every note ring ({key}: {chords})', prog: P1, pat: 'qUp', reps: 2, goal: 70, start: 50, minutes: 4,
  why: 'The sound of an arpeggio is the notes sustaining together; listen for it.',
  instr: 'Pick one note a beat and listen: each note should still sound when the next is played. Pass: 8 bars where all four notes ring at the end of the bar.',
  watch: 'Fingers not pressing on tip.', simplify: 'Hold each note for two beats.' });

/* ------------------------------ Intermediate ------------------------------ */
const roll1 = G('pa-roll', 'chunking', { name: 'The rolling pattern: bass, then three ({key}: {chords})', prog: P1, pat: 'roll', reps: 2, goal: 100, start: 65,
  why: 'A ballad staple: the bass starts the bar and a rolling figure on three strings follows.',
  instr: 'Bass, then up through three strings and back. Pass: 8 bars with the bass clear and the roll even.',
  watch: 'Rushing the roll.', simplify: 'Play only four notes of the pattern.' });
const roll2 = G('pa-roll-prog', 'transfer', { name: 'The roll over I–IV–V–I ({key}: {chords})', prog: c => PROG.oneFive(c), pat: 'roll', reps: 2, goal: 100, start: 65,
  why: 'The same pattern across changing chords.',
  instr: 'One chord per bar. Pass: 8 bars with every change clean.',
  watch: 'Losing the bass after a change.', simplify: 'Two bars per chord.' });
const rollB = G('pa-roll-twice', 'chunking', { name: 'Bass and three, twice a bar ({key}: {chords})', prog: P14, pat: 'rollB', reps: 2, goal: 100, start: 65,
  why: 'Playing the bass twice per bar gives the pattern a stronger pulse.',
  instr: 'Bass and the three strings, repeated twice per bar. Pass: 8 bars even.',
  watch: 'Uneven bass notes.', simplify: 'Slower.' });
const alt1 = G('pa-alt', 'chunking', { name: 'Alternating bass with a repeated third ({key}: {chords})', prog: P1, pat: 'altBass', reps: 2, goal: 100, start: 65,
  why: 'The bass alternates between root and fifth, as in country picking, while a higher note repeats between them.',
  instr: 'Root, third, fifth, third, root, third, fifth, third. Pass: 8 bars with the bass notes clearly different.',
  watch: 'Muting the bass notes.', simplify: 'Without the alternation.' });
const alt2 = G('pa-alt-prog', 'transfer', { name: 'Alternating bass over a folk progression ({key}: {chords})', prog: PF, pat: 'altBass2', reps: 2, goal: 100, start: 65,
  why: 'The alternating bass over changing chords, with the top strings on the offbeats.',
  instr: 'Pass: 8 bars with every bass note clear.',
  watch: 'Missing the top strings.', simplify: 'Slower.' });
const tri1 = G('pa-tri', 'chunking', { name: 'Triplets: the 6/8-style arpeggio ({key}: {chords})', prog: P1, pat: 'tri', reps: 2, goal: 80, start: 55,
  why: 'Twelve triplet notes in a bar of four: the swaying feel of ballads.',
  instr: 'Count 1-trip-let and pick in down-up order; the first note of each group is a bass or low string. Pass: 8 bars with even triplets.',
  watch: 'Two groups of 3 and 3 turning into 4s.', simplify: 'Play only the first two beats.' });
const tri2 = G('pa-tri-prog', 'transfer', { name: 'Triplets over I–vi–IV–V ({key}: {chords})', prog: P16, pat: 'tri', reps: 2, goal: 80, start: 55,
  why: 'The pattern in a progression.',
  instr: 'One chord per bar. Pass: 8 bars with the triplets steady.',
  watch: 'Rushing the changes.', simplify: 'Two bars per chord.' });
const tri3 = G('pa-tri-b', 'chunking', { name: 'A second triplet pattern ({key}: {chords})', prog: P14, pat: 'tri2', reps: 2, goal: 80, start: 55,
  why: 'A different order of strings in triplets.',
  instr: 'Pass: 8 bars with every triplet even.',
  watch: 'A bass note that is too loud.', simplify: 'First half of the bar.' });
const split = G('pa-split', 'chunking', { name: 'Two chords in one bar ({key}: {chords})', prog: P1, pat: 'upBack3', reps: 2, half: HALF, goal: 85, start: 55,
  why: 'Changing chord in the middle of the bar is the first real test of speed.',
  instr: 'Two beats on each chord. Pass: 8 bars with no break at the change.',
  watch: 'Hesitating before the change.', simplify: 'One chord per bar.' });
const split2 = G('pa-split-roll', 'transfer', { name: 'Two chords a bar with the rolling pattern ({key}: {chords})', prog: P1, pat: 'roll', reps: 2, half: HALF, goal: 85, start: 55,
  why: 'The same with the rolling pattern.',
  instr: 'Pass: 8 bars at the goal tempo.',
  watch: 'Losing the roll after the change.', simplify: 'Slower.' });

/* ------------------------------- Advanced ------------------------------- */
const s16a = G('pa-16', 'accurate-reps', { name: 'Up and back in 16th notes ({key}: {chords})', prog: P1, pat: 's16', reps: 2, goal: 75, start: 50,
  why: 'Sixteenth notes up and back: the next step in speed.',
  instr: 'Alternate pick the five strings and back, twice per bar. Pass: 8 bars even.',
  watch: 'Tension in the wrist.', simplify: 'Use 8ths.' });
const s16b = G('pa-16-b', 'chunking', { name: 'A broken 16th pattern ({key}: {chords})', prog: P14, pat: 's16b', reps: 2, goal: 75, start: 50,
  why: 'A pattern that returns to a middle string between each note.',
  instr: 'Pass: 8 bars even.',
  watch: 'Losing the bass.', simplify: 'Half speed.' });
const skip1 = G('pa-skip', 'chunking', { name: 'Skipping strings between bass and top ({key}: {chords})', prog: P1, pat: 'skip', reps: 2, goal: 100, start: 65,
  why: 'Jumping from the bass to the highest string is a wider motion for the pick.',
  instr: 'Pass: 8 bars clean.',
  watch: 'Hitting the wrong middle strings.', simplify: 'Slower.' });
const skip2 = G('pa-skip-prog', 'transfer', { name: 'String skipping over a folk progression ({key}: {chords})', prog: PF, pat: 'skip', reps: 2, goal: 100, start: 65,
  why: 'The pattern over changes.',
  instr: 'Pass: 8 bars.',
  watch: 'Rushing.', simplify: 'Two bars each.' });
const mixA = G('pa-switch', 'interleaving', { name: 'A different pattern each bar ({key}: {chords})', prog: PF, pat: ['roll', 'altBass', 'upBack', 'skip'], reps: 2, goal: 95, start: 60,
  why: 'Choosing patterns bar by bar is what keeps a long arpeggio interesting.',
  instr: 'Pass: 8 bars with every switch on the barline.',
  watch: 'Stopping at the switch.', simplify: 'Two patterns.' });
const mixB = G('pa-switch-b', 'interleaving', { name: 'Switching between 8ths and triplets ({key}: {chords})', prog: P16, pat: ['upBack', 'tri'], reps: 2, goal: 80, start: 55,
  why: 'Changing the subdivision between bars.',
  instr: 'Pass: 8 bars with the pulse steady.',
  watch: 'Rushing into the triplets.', simplify: 'Same subdivision.' });
const long1 = G('pa-long', 'transfer', { name: 'Arpeggios over a longer progression ({key}: {chords})', prog: c => PROG.folk(c).concat(PROG.oneSix(c)), pat: ['roll', 'altBass', 'roll', 'upBack'], reps: 1, goal: 100, start: 65,
  why: 'Eight bars of different chords with the patterns moving.',
  instr: 'Pass: one clean pass at the goal tempo.',
  watch: 'Losing the place.', simplify: 'Four bars.' });
const long2 = G('pa-long-split', 'transfer', { name: 'Arpeggios with mid-bar changes ({key}: {chords})', prog: P1, pat: ['roll', 'upBack3'], reps: 2, half: HALF, goal: 90, start: 60,
  why: 'The two-chords-a-bar change at a longer length.',
  instr: 'Pass: 8 bars.',
  watch: 'Hesitating at the changes.', simplify: 'One chord per bar.' });

/* ------------------------------- Mastery ------------------------------- */
const tempo1 = G('pa-tempo', 'accurate-reps', { name: 'Up and back in 8ths at performance tempo ({key}: {chords})', prog: P16, pat: 'upBack', reps: 4, goal: 130, start: 95, minutes: 6,
  why: 'The speed where an arpeggio becomes a texture.',
  instr: 'Sixteen bars. Pass: 16 bars at the goal tempo with every note ringing.',
  watch: 'Muted notes at speed.', simplify: 'Drop 10 BPM.' });
const tempo2 = G('pa-tempo-16', 'accurate-reps', { name: '16th-note arpeggios at tempo ({key}: {chords})', prog: P14, pat: 's16', reps: 4, goal: 100, start: 70, minutes: 6,
  why: 'The 16th-note version at a speed you would perform.',
  instr: 'Pass: 16 bars even.',
  watch: 'Digging in.', simplify: 'Drop 10 BPM.' });
const loop1 = G('pa-loop', 'accurate-reps', { name: 'Loop a phrase until it never changes ({key}: {chords})', prog: PF, pat: ['roll', 'altBass', 'roll', 'skip'], reps: 2, goal: 110, start: 75, minutes: 6,
  why: 'Looping a short phrase shows drift.',
  instr: 'Loop for three minutes. Pass: no change in tempo or tone.',
  watch: 'Speeding up.', simplify: 'Drop 10 BPM.' });
const loop2 = G('pa-endure', 'chunking', { name: 'A twelve-bar run of mixed patterns ({key}: {chords})', prog: c => PROG.folk(c).concat(PROG.oneSix(c)).concat(PROG.oneFive(c)), pat: ['roll', 'altBass', 'upBack', 'skip', 'tri'], reps: 1, goal: 100, start: 70, minutes: 6,
  why: 'Longer than the stage drills.',
  instr: 'Pass: twelve bars without stopping.',
  watch: 'Losing the place after bar 8.', simplify: 'Eight bars.' });
const cap8 = G('pa-cap-8', 'transfer', { name: 'Study: an 8-bar arpeggio accompaniment ({key}: {chords})', prog: c => PROG.folk(c).concat(PROG.oneSix(c)), pat: ['roll', 'altBass', 'upBack', 'skip', 'roll', 'altBass', 'tri', 'upBack3'], reps: 1, goal: 105, start: 70, minutes: 7,
  why: 'An original accompaniment using the whole path.',
  instr: 'Learn two bars at a time. Pass: one clean pass at the goal tempo, then your own version.',
  watch: 'Rushing.', simplify: 'Four bars.' });
const cap12 = G('pa-cap-12', 'transfer', { name: 'Capstone: a 12-bar arpeggio study ({key}: {chords})', prog: c => PROG.folk(c).concat(PROG.oneSix(c)).concat(PROG.oneFive(c)), pat: ['roll', 'altBass', 'upBack', 'skip', 'roll', 'tri', 'altBass', 'upBack3', 'roll', 'skip', 'altBass', 'upBack'], reps: 1, goal: 105, start: 70, minutes: 8,
  why: 'The whole path in twelve bars.',
  instr: 'Learn in three four-bar phrases, join them, then write your own on the same chords. Pass: one clean pass at the goal tempo.',
  watch: 'Losing the place at a change.', simplify: 'Bars 1–8.' });

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'pickedArpeggios', kind: 'technique', title: 'Picked chord arpeggios (ballads and folk-rock)', domain: 'picking',
  re: /picked (chord )?arpeggios?|arpeggio picking|pick arpeggios?|chord arpeggios? (with a )?pick|ballad arpeggios?|broken chords?/,
  aliases: ['arpeggio picking', 'picked arpeggios', 'broken chord picking', 'ballad picking', 'chordal picking'],
  summary: 'Chords played one string at a time with a pick and the notes left to ring: one note a beat, up and back in 8ths, rolling and alternating-bass patterns, triplets, two chords in a bar, 16ths and string skipping.',
  prereqs: ['alternatePicking'],
  ctx: { key: 0, minor: false, prog: 'folkAxis' },
  sources: [
    'https://www.andyguitar.co.uk/lessons/lesson-4-picked-arpeggios',
    'https://www.tabs4acoustic.com/en/guitar-lessons/arpeggios-and-fingerpicking-101.html',
    'https://www.fender.com/play/lessons/show-me-arpeggio-picking'
  ],
  pedagogy: {
    date: '2026-10-30',
    summary: 'Taught by picking one string of a held chord at a time, in order, with the notes ringing and an even pulse, first on one chord, then swapping to a second chord with the same pattern. Patterns grow from a single cycle up and back to rolling and alternating-bass patterns, with the common faults being fingers that mute strings and a pick that catches.',
    sequence: [
      { id: 'single', tier: 'foundations', step: 'One string at a time, ringing', how: 'A held chord, one string per beat in order, letting every note sound.', skills: ['pa-s-single'], source: 0 },
      { id: 'cycle', tier: 'foundations', step: 'The up-and-back cycle in even 8ths', how: 'A cycle of strings up the chord and back, repeated twice per chord.', skills: ['pa-s-cycle'], source: 0 },
      { id: 'swap', tier: 'foundations', step: 'Swapping chords with the same pattern', how: 'The same cycle on a second chord after two rounds.', skills: ['pa-s-swap'], source: 0 },
      { id: 'minor', tier: 'foundations', step: 'Minor chords and ringing notes', how: 'The same patterns on minor chords, listening for every note to ring.', skills: ['pa-s-minor'], source: 1 },
      { id: 'rolling', tier: 'intermediate', step: 'Other patterns: rolling and alternating bass', how: 'Patterns with a bass note and a figure on the higher strings, shifting finger independence from open strings to chord shapes.', skills: ['pa-s-roll'], source: 1 },
      { id: 'altbass', tier: 'intermediate', step: 'Alternating bass patterns', how: 'Bass notes alternating between strings with higher notes between.', skills: ['pa-s-alt'], source: 1 },
      { id: 'triplets', tier: 'intermediate', step: 'Triplet patterns', how: 'Twelve notes a bar for a rolling 6/8-style feel.', skills: ['pa-s-tri'], source: 2 },
      { id: 'split', tier: 'intermediate', step: 'Two chords in a bar', how: 'Changing chords every two beats with the pattern unbroken.', skills: ['pa-s-split'], source: 0 },
      { id: 'sixteenths', tier: 'advanced', step: 'Faster patterns', how: 'Sixteenth-note cycles and broken patterns.', skills: ['pa-s-16'], source: 2 },
      { id: 'skipping', tier: 'advanced', step: 'Skipping strings', how: 'Jumping between the bass and the top string.', skills: ['pa-s-skip'], source: 2 },
      { id: 'switching', tier: 'advanced', step: 'Switching patterns', how: 'A different pattern every bar, and between subdivisions.', skills: ['pa-s-switch'], source: 2 },
      { id: 'long', tier: 'advanced', step: 'Longer progressions', how: 'Eight bars with mid-bar changes.', skills: ['pa-s-long'], source: 0 },
      { id: 'tempo', tier: 'mastery', step: 'Tempo', how: 'Sixteen bars at performance tempo.', skills: ['pa-s-tempo'], source: 2 },
      { id: 'loop', tier: 'mastery', step: 'Loop and endurance', how: 'A phrase looped until it never drifts.', skills: ['pa-s-loop'], source: 0 },
      { id: 'study', tier: 'mastery', step: 'A full arpeggio accompaniment', how: 'Studies using the whole technique.', skills: ['pa-s-study'], source: 1 }
    ],
    drills: ['One string per beat up a held chord', 'The cycle 5-4-3-2-3-4 on one chord, two rounds, then the next chord', 'Up and back in 8ths on two chords', 'A rolling pattern over I, IV and V', 'Alternating bass with a repeated higher note', 'Triplet arpeggios', 'Two chords in one bar'],
    mistakes: ['Fingers lying flat and muting strings', 'A pick that catches on the strings instead of sliding', 'Uneven timing', 'Notes not allowed to ring', 'Hesitating at chord changes'],
    sources: [
      { title: 'Lesson 4: Picked Arpeggios', author: 'Andy Guitar', url: 'https://www.andyguitar.co.uk/lessons/lesson-4-picked-arpeggios' },
      { title: 'Arpeggios and fingerpicking 101', author: 'Tabs4Acoustic', url: 'https://www.tabs4acoustic.com/en/guitar-lessons/arpeggios-and-fingerpicking-101.html' },
      { title: 'Show Me: Arpeggio Picking', author: 'Fender Play', url: 'https://www.fender.com/play/lessons/show-me-arpeggio-picking' }
    ]
  },
  stages: [
    stage('foundations', 'One string at a time',
      'Up and back through a held chord in even 8ths on two chords at 90 BPM for 8 bars, every note ringing and no break at the change.', [
        S('pa-s-single', 'One string at a time', 'picking', 'Picking a held chord string by string.', [qUp, qBack, slowRing],
          ST('An arpeggio is a chord played one string at a time, in order, with the notes left to ring. The fretting fingers stay on the shape the whole time.', 'It is the sound of ballads and folk, and it trains the pick to find individual strings.', ['One string per beat to start.', 'Press with the fingertips so open strings ring.', 'Listen for all the notes together.'])),
        S('pa-s-cycle', 'Up and back in 8ths', 'picking', 'A cycle of strings in even 8ths.', [upBack, upBack3],
          ST('The usual first pattern goes up the strings and back at an even 8th-note pulse, with alternate (down-up) picking.', 'Even timing is the point: every note the same length and volume.', ['Down on the beats, up on the "&".', 'Slide the pick, do not catch the strings.', 'Count 1 & 2 & 3 & 4 &.'])),
        S('pa-s-swap', 'Changing chord', 'picking', 'The same pattern on a second chord.', [hold, hold15],
          ST('After a couple of rounds on one chord, move to the next and keep the same pattern. The picking hand never stops.', 'It turns the exercise into accompaniment.', ['Two bars per chord to begin.', 'Move the fretting hand on beat 1.', 'The pick keeps going.'])),
        S('pa-s-minor', 'Minor chords', 'picking', 'The same on minor shapes.', [minorUp],
          ST('A minor chord lowers the third by one fret; the patterns are unchanged.', 'It extends the technique to every key.', ['Third a fret lower.', 'Listen for the change in colour.', 'Same picking.']))
      ]),
    stage('intermediate', 'Rolling, alternating bass and triplets',
      'A rolling pattern over I–IV–V–I, an alternating-bass pattern, triplet arpeggios and two chords in one bar, each for 8 bars at 85 BPM.', [
        S('pa-s-roll', 'The rolling pattern', 'picking', 'A bass note and a figure on three strings.', [roll1, roll2, rollB],
          ST('A rolling pattern starts with the bass note and then rolls up and back through three strings. It is a staple of ballad accompaniment.', 'It has more movement than a plain cycle.', ['Bass first.', 'The roll stays on three strings.', 'Keep it even.'])),
        S('pa-s-alt', 'Alternating bass', 'picking', 'Bass notes alternating between strings.', [alt1, alt2],
          ST('Alternating the bass between the root and the fifth, with a higher note between, gives the pattern a walking low end.', 'It adds a bass line under the harmony.', ['Root, fifth, root, fifth.', 'The higher note repeats.', 'Let the bass ring.'])),
        S('pa-s-tri', 'Triplets', 'picking', 'Twelve notes a bar.', [tri1, tri2, tri3],
          ST('A triplet arpeggio plays three notes to a beat, giving a rolling 6/8-style feel.', 'It is the sound of many ballads.', ['Count 1-trip-let.', 'The first note of each group is a low string.', 'Keep the groups of three.'])),
        S('pa-s-split', 'Two chords in a bar', 'picking', 'Changing chord every two beats.', [split, split2],
          ST('When the harmony changes twice per bar, the pattern halves: two beats on each chord.', 'It prepares you for real progressions.', ['Move on beat 3.', 'Keep the picking unbroken.', 'Plan the change a beat early.']))
      ]),
    stage('advanced', 'Faster patterns and longer forms',
      '16th-note arpeggios, string skipping, a different pattern every bar and an eight-bar progression with mid-bar changes, each at 90 BPM for 8 bars.', [
        S('pa-s-16', 'Sixteenth notes', 'picking', 'Faster cycles.', [s16a, s16b],
          ST('Sixteenth-note arpeggios put sixteen notes in a bar with alternate picking.', 'It is the next step in speed.', ['Keep the wrist loose.', 'Alternate strictly.', 'Slow down before tension builds.'])),
        S('pa-s-skip', 'Skipping strings', 'picking', 'Jumps between the bass and the top.', [skip1, skip2],
          ST('Skipping strings means jumping over strings between consecutive notes, a wider pick motion.', 'It gives a more open, modern sound.', ['Keep the movement small.', 'Aim before you play.', 'Let the notes ring.'])),
        S('pa-s-switch', 'Switching patterns', 'picking', 'A different pattern each bar.', [mixA, mixB],
          ST('Changing the pattern or the subdivision from bar to bar keeps a long arpeggio from becoming monotonous.', 'It is how accompaniment gets variety.', ['Plan the pattern per bar.', 'Switch on the barline.', 'Keep the pulse steady.'])),
        S('pa-s-long', 'Longer progressions', 'picking', 'Eight bars of changing chords.', [long1, long2],
          ST('Longer progressions with mid-bar changes test accuracy at the changes.', 'It is where the technique is used in songs.', ['Anticipate changes.', 'Keep the pattern.', 'Let notes ring.']))
      ]),
    stage('mastery', 'Tempo, endurance and studies',
      'Arpeggios at 130 BPM in 8ths and 100 BPM in 16ths, a looped phrase held for three minutes, and an eight- and a twelve-bar original accompaniment at 105 BPM.', [
        S('pa-s-tempo', 'Performance tempo', 'picking', 'Sixteen bars at speed.', [tempo1, tempo2],
          ST('Performance tempo is the one you can hold for many bars with every note ringing.', 'It shows whether the technique is automatic.', ['Raise the click only while relaxed.', 'Record yourself.', 'Rest between runs.'])),
        S('pa-s-loop', 'Endurance', 'picking', 'A looped phrase and a long run.', [loop1, loop2],
          ST('A short phrase looped and recorded shows drift; a long run tests stamina.', 'It builds the control of a working player.', ['Loop for three minutes.', 'Listen for drift.', 'Lower the tempo if it breaks.'])),
        S('pa-s-study', 'Original accompaniments', 'picking', 'Studies using the whole path.', [cap8, cap12],
          ST('The final step is arranging: choosing a pattern for each bar from everything you have learned.', 'It turns the technique into your own playing.', ['Learn in phrases.', 'Choose patterns with care.', 'Write your own on the same chords.']))
      ])
  ]
});
