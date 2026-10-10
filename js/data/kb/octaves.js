// Octaves: one melody note doubled an octave up, the string between them muted, so a simple line sounds
// huge (Wes Montgomery, Jimi Hendrix, George Benson, and every rock player who doubles a riff). From the
// two basic shapes, played note by note and then together with the middle string silent, to scales and
// riffs in octaves on every string pair, syncopated punches and slides, chord roots and guide tones in
// octaves, fast lines in triplets and 16ths, a blues chorus and a ballad melody, and an original study.
//
// Concept-first (CONTENT.md): the model is an octave SHAPE on a string pair (low string, high string, fret
// gap): 6–4 and 5–3 are two frets apart, 4–2 and 3–1 three (the B-string shift). A melody is written as
// scale DEGREES (semitones above the key root, in any scale); `place()` puts each pitch on a string pair,
// either on one LANE (the same pair, so the hand travels along the neck) or in a POSITION (the pair nearest
// the hand, so the hand stays put), and checks that the two notes are exactly an octave apart. The composer
// `octRun(c, spec)` builds an exercise from scale × melody (scale runs, 3rds, original riffs, chord roots,
// called degrees) × lane × articulation (pinched, strummed through a muted middle string, slid into from a
// fret below, glided along one pair) × rhythm × key plan, so every lesson is right in any key.
import { OPEN, N, nameOf, minorKey, make, mod12, S, stage, entry, targetGuide, chordInfo } from '../lib.js';
import { rng } from './bending.js';

/* ------------------------------- The concept ------------------------------- */
/** Octave shapes: low string, high string, fret gap, and the muted string between. */
export const SETS = {
  64: { lo: 6, hi: 4, gap: 2, mid: 5, label: '6–4' },
  53: { lo: 5, hi: 3, gap: 2, mid: 4, label: '5–3' },
  42: { lo: 4, hi: 2, gap: 3, mid: 3, label: '4–2' },
  31: { lo: 3, hi: 1, gap: 3, mid: 2, label: '3–1' }
};
export const SCALES = {
  minorPent: { degs: [0, 3, 5, 7, 10], minor: true, name: 'minor pentatonic' },
  blues: { degs: [0, 3, 5, 6, 7, 10], minor: true, name: 'blues scale' },
  dorian: { degs: [0, 2, 3, 5, 7, 9, 10], minor: true, name: 'Dorian' },
  majorPent: { degs: [0, 2, 4, 7, 9], minor: false, name: 'major pentatonic' },
  major: { degs: [0, 2, 4, 5, 7, 9, 11], minor: false, name: 'major scale' },
  mixo: { degs: [0, 2, 4, 5, 7, 9, 10], minor: false, name: 'Mixolydian' }
};
const pitch = (s, f) => OPEN[s] + f;
/** The key root a scale uses: the minor key for minor scales, its relative major (or the key) for major ones. */
export const rootFor = (c, scale) => (SCALES[scale].minor ? minorKey(c) : c.minor ? mod12(c.key + 3) : mod12(c.key));
/** Scale index → semitones above the root (index 5 of a pentatonic is the octave; −1 the ♭7 below). */
export const deg = (scale, i) => { const d = SCALES[scale].degs, n = d.length; return Math.floor(i / n) * 12 + d[((i % n) + n) % n]; };
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes']]);
/** Note value for scale lines at a level. */
export const stepFor = lvl => (lvl <= 2 ? 1 : lvl <= 6 ? 0.5 : lvl <= 8 ? 1 / 3 : 0.25);
/**
 * Where a pitch sits as an octave: on a fixed pair (lane = '53' …) or the pair nearest fret `pos` among
 * `sets`. Returns { set, f } with both frets in 1–17, or null.
 */
export function place(p, lane, pos = 5, sets = ['64', '53', '42', '31']) {
  const cands = (lane === 'pos' ? sets : [lane]).map(id => { const S_ = SETS[id], f = p - OPEN[S_.lo]; return { set: id, f }; })
    .filter(x => x.f >= 0 && x.f + SETS[x.set].gap <= 22);
  if (!cands.length) return null;
  return cands.sort((a, b) => Math.abs(a.f - pos) - Math.abs(b.f - pos))[0];
}
/** The pair to use when a melody doesn't fit a pair in some key: the next pair with the same shape. */
const ALT = { 53: '64', 64: '53', 42: '31', 31: '42' };
/** The lowest root pitch (MIDI) from which every degree of the melody fits the lane. */
function baseFor(root, melody, lane, sets) {
  for (let base = 40 + mod12(root - 40); base <= 72; base += 12) {
    let pos = lane === 'pos' ? null : 0, ok = true;
    for (const [d] of melody) { if (d == null) continue; const pl = place(base + d, lane, pos == null ? 5 : pos, sets); if (!pl) { ok = false; break; } pos = pl.f; }
    if (ok) return base;
  }
  return null;
}
/** Which note may sound where (for the pitch check): note → allowed pitch classes (null = a muted string). */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
/** Render one octave at beat t: art = pinch | strum (middle string muted, strummed through) | slide (from a fret below) | glide (slide along the pair from the last note). */
export function renderOct(notes, pl, t, d, art, pcs, last) {
  const S_ = SETS[pl.set], f = pl.f, g = f + S_.gap;
  if (pitch(S_.hi, g) - pitch(S_.lo, f) !== 12) throw new Error('not an octave');
  const x = { chord: true };
  if (art === 'slide' && d >= 0.5 && f >= 2) {
    notes.push(tag(N(S_.lo, f - 1, t, 0.25, null, x), [mod12(pitch(S_.lo, f - 1))]), tag(N(S_.hi, g - 1, t, 0.25, null, x), [mod12(pitch(S_.lo, f - 1))]));
    notes.push(tag(N(S_.lo, f, t + 0.25, d - 0.25, '/', x), pcs), tag(N(S_.hi, g, t + 0.25, d - 0.25, '/', x), pcs)); return;
  }
  const mv = art === 'glide' && last && last.set === pl.set && last.f !== f ? (f > last.f ? '/' : '\\') : null;
  notes.push(tag(N(S_.lo, f, t, d, mv, x), pcs), tag(N(S_.hi, g, t, d, mv, x), pcs));
  if (art === 'strum') notes.push(tag(N(S_.mid, f + 1, t, d, 'mute', x), null));
}
/**
 * One octave exercise from a spec: { id, name ('{key}', '{scale}', '{sets}'), method, scale, melody
 * (c, step) => [[semitones | null, beats, art?], …], lane ('53' | 'pos' | ['53','42'] per block),
 * sets (allowed pairs for 'pos'), art, keys (offsets, one block each), backing (root => chord names),
 * chordTones (true: each note's allowed set is its bar's chord), domain, unit, goal, start, dl, why, instr, watch, simplify }.
 */
export function octRun(c, spec) {
  const scale = spec.scale || 'minorPent', root0 = rootFor(c, scale), lvl = c.lvl || 5, step = spec.step || stepFor(lvl);
  const notes = [], usedSets = new Set(); let t = 0;
  const lanes = Array.isArray(spec.lane) ? spec.lane : [spec.lane || '53'];
  for (const [bi, off] of (spec.keys || [0]).entries()) {
    const root = mod12(root0 + off), melody = spec.melody(c, step, root);
    // the lane asked for, or (when the melody can't fit it in this key) the pair with the same shape
    let lane = lanes[bi % lanes.length], base = baseFor(root, melody, lane, spec.sets);
    if (base == null && ALT[lane]) { lane = ALT[lane]; base = baseFor(root, melody, lane, spec.sets); }
    if (base == null) return null;
    const pcs = SCALES[scale].degs.map(d => mod12(root + d));
    let pos = null, last = null;
    for (const [d, beats, art] of melody) {
      if (d == null) { t += beats; continue; }
      const pl = place(base + d, lane, pos == null ? (lane === 'pos' ? 5 : 0) : pos, spec.sets); if (!pl) return null;
      renderOct(notes, pl, t, beats, art || spec.art || 'pinch', spec.allow ? spec.allow(root, t) : pcs, last);
      usedSets.add(SETS[pl.set].label); pos = pl.f; last = pl; t += beats;
    }
    if (spec.blockRest) t += spec.blockRest;
  }
  if (notes.length < 6 || notes.length > 400) return null;
  const root = root0, chords = spec.backing ? spec.backing(root) : null;
  const fill = s => s.replace(/\{key\}/g, `${nameOf(root)}${SCALES[scale].minor ? ' minor' : ''}`).replace('{scale}', SCALES[scale].name).replace('{sets}', [...usedSets].join(', '));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretting', method: spec.method, unit: spec.unit || UNIT.get(step) || '8th notes',
    goal: spec.goal || 100, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify,
    ...(chords ? { backing: chords, chords: [...new Set(chords)].slice(0, 8) } : {}), tab: { notes }
  });
}
const O_ = (id, name, method, opts) => c => octRun(c, { id, name, method, ...opts });

/* ------------------------------- Melodies ------------------------------- */
// Each melody is (c, step, root) => [[semitones above the root, beats, art?], …]; null = a rest.
const run = (scale, idx, step) => idx.map(i => [deg(scale, i), step]);
const upDown = (scale, n) => { const up = [...Array(n + 1).keys()]; return [...up, ...up.slice(0, -1).reverse()]; };
const thirdsOf = n => { const out = []; for (let i = 0; i + 2 <= n; i++) out.push(i, i + 2); for (let i = n; i - 2 >= 0; i--) out.push(i, i - 2); return out; };
/** Original riffs, in scale indices with beats (minor pentatonic unless noted). */
export const RIFFS = {
  first: [[0, 1], [1, 0.5], [2, 0.5], [3, 1], [2, 0.5], [1, 0.5], [0, 1], [-1, 1], [0, 2]],
  push: [[0, 0.75], [0, 0.75], [1, 0.5], [2, 0.5], [null, 0.5], [3, 0.5], [2, 0.5], [1, 0.75], [0, 0.75], [-1, 0.5], [0, 2]],
  rise: [[3, 0.5, 'slide'], [3, 0.5], [4, 0.5], [3, 0.5], [2, 1], [1, 1], [2, 0.5], [1, 0.5], [0, 1], [null, 2]],
  call: [[5, 0.5], [4, 0.5], [3, 1], [2, 0.5], [3, 0.5], [null, 1], [3, 0.5], [2, 0.5], [1, 0.5], [0, 1.5], [null, 1]]
};
const riff = name => (c, step) => RIFFS[name].map(([i, b, a]) => [i == null ? null : deg('minorPent', i), b, a]);
/** A blues melody in Mixolydian (12 bars, original): long notes, rests, a pickup into each phrase. */
const BLUES_MEL = [[4, 1.5], [5, 0.5], [4, 1], [2, 1], [0, 2], [null, 1], [5, 1], [6, 1.5], [5, 0.5], [3, 1], [2, 1], [3, 3], [null, 1],
  [4, 1.5], [5, 0.5], [4, 1], [2, 1], [0, 3], [null, 1], [2, 1], [4, 1], [5, 1], [6, 1], [7, 3], [null, 1],
  [6, 1.5], [5, 0.5], [4, 2], [3, 1.5], [2, 0.5], [0, 2], [4, 1], [2, 1], [0, 4], [null, 4]];
/** A ballad melody in the major scale over I – vi – IV – V (original). */
const BALLAD = [[4, 1], [4, 0.5], [5, 0.5], [4, 1], [2, 1], [0, 2], [null, 1], [2, 1], [3, 1.5], [2, 0.5], [0, 1], [-2, 1], [-1, 4], [5, 1], [4, 0.5], [5, 0.5], [7, 2], [6, 1], [4, 1], [3, 2], [2, 2], [1, 4]];
const cr = (c, step) => { const q = RIFFS.call.map(([i, b]) => [i == null ? null : deg('minorPent', i), b]); return q; };

/* ------------------------------- Special lessons ------------------------------- */
/** Each note of the shape alone, then both together (chunking / accurate reps). */
export function octTeach(c, { set = '53', id, method }) {
  const k = minorKey(c), pcs = SCALES.minorPent.degs.map(d => mod12(k + d)), notes = [];
  let base = baseFor(k, [[0], [3], [5], [7]], set); if (base == null) { set = ALT[set]; base = baseFor(k, [[0], [3], [5], [7]], set); } if (base == null) return null;
  const S_ = SETS[set];
  let t = 0;
  for (const d of [0, 3, 5, 7]) {
    const pl = place(base + d, set); if (!pl) return null; const g = pl.f + S_.gap;
    notes.push(tag(N(S_.lo, pl.f, t, 1), pcs), tag(N(S_.hi, g, t + 1, 1), pcs));
    renderOct(notes, pl, t + 2, 2, 'strum', pcs); t += 4;
  }
  const two = S_.gap === 2;
  return make(c, {
    id, name: `The ${S_.label} octave shape: each note, then both (${nameOf(k)} minor pentatonic: R, ♭3, 4, 5)`, domain: 'fretting', method, unit: 'quarter notes', goal: 72, start: 44, minutes: 4, tab: { notes },
    why: two ? 'Every octave is two notes: the low one under the index finger and the high one two strings up, two frets higher. Playing each note alone, then both, splits the shape into its pieces and lets you check each one rings.' : 'On the 4–2 and 3–1 string pairs the B string is tuned a semitone lower, so the high note sits three frets above the low one, not two: a wider stretch that the hand must learn separately.',
    instr: `Index finger on the low note (${S_.label} strings), ${two ? 'ring finger' : 'pinky'} on the high note ${S_.gap} frets up. Beat 1: the low note alone. Beat 2: the high note alone. Beats 3–4: both together, strummed through the middle string, which the underside of the index finger mutes. ${method === 'accurate-reps' ? 'Count only the octaves where both notes ring and the middle string is dead. Pass: 8 clean in a row.' : 'Pass: all four notes of the line, each note clean alone and the octave clean together.'}`,
    watch: two ? 'The index finger standing up on its tip: let it lie flat enough to touch the middle string.' : 'Reaching for the B string with the ring finger out of habit: the 3-fret gap needs the pinky.', simplify: 'Only the root and the 5th.'
  });
}
/** An original 8-bar study in octaves (capstone): riff, push, slides, a run, position changes, a long ending. */
export function octEtude(c) {
  const k = minorKey(c), pcs = SCALES.minorPent.degs.map(d => mod12(k + d)), notes = [];
  const parts = [['53', RIFFS.first, 'strum'], ['42', RIFFS.push, 'pinch'], ['pos', RIFFS.rise, 'glide'], ['53', RIFFS.call, 'slide']];
  let t = 0, last = null;
  for (const [lane, r, art] of parts) {
    const mel = r.map(([i, b, a]) => [i == null ? null : deg('minorPent', i), b, a]);
    let ln = lane, base = baseFor(k, mel, ln); if (base == null && ALT[ln]) { ln = ALT[ln]; base = baseFor(k, mel, ln); } if (base == null) return null;
    let pos = null;
    for (const [d, b, a] of mel) { if (d == null) { t += b; continue; } const pl = place(base + d, ln, pos == null ? 5 : pos); if (!pl) return null; renderOct(notes, pl, t, b, a || art, pcs, last); pos = pl.f; last = pl; t += b; }
    t = Math.ceil(t / 8) * 8 || t;
  }
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: 'oct-capstone-etude', name: `Capstone study: an 8-bar piece in octaves (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer', unit: 'mixed 8ths and 16ths', goal: 100, start: 60, minutes: 8, dl: 1, backing: [...chords, ...chords], chords, tab: { notes },
    why: 'An original piece that uses the whole path: a strummed riff on 5–3, a syncopated push on 4–2 with its wider shape, a line that glides between string pairs in one position, and a call phrase that slides into every note.',
    instr: 'Learn it two bars at a time, saying the string pair before you play it. Then write your own 8 bars to the same plan (a riff, a push, a gliding line, a sliding call). Pass: the study at the goal tempo with no middle string sounding, then your own version once.',
    watch: 'The shape collapsing when you change string pair: the gap changes from two frets to three.', simplify: 'Bars 1–4.'
  });
}
/** A new key, string pair and degree every bar (interleaving). */
export function octRandom(c) {
  const r = rng(353 + (c.lvl || 9)), notes = [], names = [];
  for (let bar = 0; bar < 8; bar++) {
    const k = Math.floor(r() * 12), set = ['64', '53', '42', '31'][Math.floor(r() * 4)], di = Math.floor(r() * 5), d = SCALES.minorPent.degs[di];
    const pcs = SCALES.minorPent.degs.map(x => mod12(k + x));
    let pl = null; for (let p = 40; p <= 76 && !pl; p++) if (mod12(p - k - d) === 0) { const q = place(p, set); if (q && q.f >= 3) pl = q; }
    if (!pl) return null;
    for (let i = 0; i < 4; i++) renderOct(notes, pl, bar * 4 + i, 1, i === 0 ? 'slide' : 'strum', pcs);
    names.push(`the ${['R', '♭3', '4', '5', '♭7'][di]} of ${nameOf(k)} minor on ${SETS[set].label}`);
  }
  return make(c, {
    id: 'oct-random', name: 'Random access: a new key, string pair and degree every bar', domain: 'fretboard', method: 'interleaving', unit: 'quarter notes', goal: 110, start: 60, minutes: 5, dl: 1, tab: { notes },
    why: 'At mastery level the octave has to appear on any string pair for any note of any key, instantly: a mixed, unpredictable order is the practice that transfers to playing.',
    instr: `${names.join(' → ')}. Read only the names: slide into the octave on beat 1, then strum it on beats 2–4. Pass: all 8 bars in time from the names alone.`,
    watch: 'Forgetting the three-fret shape on 4–2 and 3–1.', simplify: 'The first four bars.'
  });
}
/** Guide tones in octaves: the 3rd of each chord of a progression (each note checked against its chord). */
export function octGuide(c) {
  const major = !c.minor, k = major ? mod12(c.key) : minorKey(c);
  const prog = major ? [[0, ''], [9, 'm'], [5, ''], [7, '']] : [[0, 'm'], [8, ''], [3, ''], [10, '']];
  const chords = prog.map(([o, q]) => nameOf(k + o) + q), notes = []; let pos = 7;
  chords.forEach((nm, bar) => {
    const ch = chordInfo(nm), third = ch.pcs[1], root = ch.pcs[0];
    [[third, 2], [root, 1], [third, 1]].forEach(([pc, b], i) => {
      let best = null; for (let p = 43; p <= 64; p++) if (mod12(p) === pc) { const q = place(p, 'pos', pos); if (q && (!best || Math.abs(q.f - pos) < Math.abs(best.f - pos))) best = q; }
      if (best) { renderOct(notes, best, bar * 4 + [0, 2, 3][i], b, 'pinch', ch.pcs); pos = best.f; }
    });
  });
  return make(c, {
    id: 'oct-guide', name: `Chord tones in octaves: the 3rd and root of ${chords.join(' – ')}`, domain: 'theory', method: 'retrieval', unit: 'half and quarter notes', goal: 96, start: 56, minutes: 5, backing: chords, chords, tab: { notes },
    why: 'The 3rd of a chord says major or minor; played in octaves it becomes a strong, singing guide line through the changes. Finding it for each chord from memory links the octave shapes to harmony.',
    instr: 'Cover the tab. For each chord say its 3rd, find it in octaves near where your hand already is, hold it two beats, then the root, then the 3rd again. Pass: twice through from memory, never moving more than three frets between chords.', watch: 'Jumping to the 5–3 pair every time: use the pair nearest the hand.', simplify: 'Only the 3rd, whole notes.'
  });
}

/* --------------------------------- The path --------------------------------- */
const HOW = 'Index finger on the low note, ring finger (6–4 and 5–3) or pinky (4–2 and 3–1) on the high note; the index finger lies across the string between them and mutes it, and the free fingers mute the strings outside. ';
const rockB = k => [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
const bluesB = k => [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map(o => nameOf(k + o) + '7');
export default entry({
  id: 'octaves', kind: 'technique', title: 'Octaves', domain: 'fretting',
  re: /octaves?( playing| shapes| melod)?|wes montgomery octaves/,
  aliases: ['octave melodies', 'playing in octaves'],
  summary: 'Melodies doubled an octave up with the middle string muted: the two shapes, then scales, riffs and chord tones in octaves on every string pair, slides and syncopated punches, fast lines, a blues chorus, a ballad and an original study.',
  prereqs: ['pentatonic'],
  sources: ['https://www.premierguitar.com/beyond-blues-blue-octaves', 'https://www.premierguitar.com/wes-montgomery-octaves', 'https://www.jazz-guitar-licks.com/blog/how-to-play-octaves-in-guitar-10-easy-jazz-lines.html', 'https://guitarworld.com/lessons/hendrix-chord-from-jazz-to-jimi'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Two shapes, one sound',
      'Play the 5–3 and 4–2 octave shapes note by note and together, strum through three strings with only the two octave notes sounding 8 times in a row, play the same note in both shapes, find the root octave of any called key, and play a first riff and a call-and-response in octaves over a minor groove at 70 BPM.', [
        S('oct-shapes', 'The two shapes', 'fretting', 'Each note alone, then both.', [
          c => octTeach(c, { set: '53', id: 'oct-shape-53', method: 'chunking' }),
          c => octTeach(c, { set: '42', id: 'oct-shape-42', method: 'accurate-reps' })]),
        S('oct-mute', 'Only two notes sound', 'fretting', 'The muted middle string; the same note in two shapes.', [
          O_('oct-strum-through', 'Strum through three strings, hear two: {key} pentatonic up and down on the {sets} pair', 'external-focus', { lane: '53', art: 'strum', step: 1, melody: (c, step) => run('minorPent', upDown('minorPent', 5), step), goal: 70, start: 44, why: 'Strumming through the muted middle string (rather than picking two separate strings) is what makes octaves fast and even. The sound is the test: two notes an octave apart and a dead click in the middle.', instr: HOW + 'Strum all three strings with a short, firm stroke, one octave per beat, up the minor pentatonic and back on the {sets} pair. Listen for exactly two pitches. Pass: the line up and down with no middle string sounding.', watch: 'A ringing middle string: flatten the index finger slightly.', simplify: 'Half the line, up only.' }),
          O_('oct-two-shapes', 'The same notes in two shapes: {key} pentatonic on {sets}', 'variable', { lane: ['53', '42'], keys: [0, 0], art: 'strum', step: 1, melody: (c, step) => run('minorPent', [0, 1, 2, 3], step), goal: 70, start: 44, why: 'The same octave lives on two string pairs: on 5–3 with a two-fret shape and five frets lower on 4–2 with a three-fret shape. Playing the line in both trains the hand to change the shape, not just the place.', instr: HOW + 'Four notes of the scale on the first pair ({sets}), then the same four notes on the second, where the shape changes (two frets apart on 6–4 and 5–3, three on 4–2 and 3–1). Pass: both halves clean, twice.', watch: 'Keeping the two-fret shape on 4–2: it sounds out of tune.', simplify: 'The root only, in both shapes.' })]),
        S('oct-find', 'Find it, hear it', 'fretboard', 'Root octaves from memory; sing first.', [
          O_('oct-roots', 'From memory: the root octave of called keys ({key} and around the cycle of fourths)', 'retrieval', { lane: ['53', '64'], keys: [0, 5, 10, 3, 8, 1], art: 'strum', step: 1, melody: () => [[0, 2], [0, 2]], unit: 'half notes', goal: 68, start: 42, why: 'An octave starts from its low note. Finding the root of a called key on the A string or the low E from memory is the first step to playing anything in octaves in any key.', instr: 'Cover the tab. Say the key, find its root on the low string of the pair the tab uses ({sets}) and play the octave twice. The keys move up a fourth each time. Pass: all six keys from the names alone.', watch: 'Counting frets from the nut: learn the notes on the low two strings.', simplify: 'A string only.' }),
          O_('oct-sing', 'Sing it, then play it in octaves ({key})', 'audiation', { lane: '53', art: 'pinch', melody: () => [[0, 1], [3, 1], [5, 1], [7, 1], [null, 4], [7, 1], [5, 1], [3, 1], [0, 1], [null, 4]], step: 1, goal: 66, start: 44, why: 'Octaves only double a melody you can already hear. Singing each short phrase in the empty bar before playing it fixes the tune in the ear first, so the hands follow the sound.', instr: 'Play bar 1, then sing it back in bar 2 (the rest). Bar 3: the answer; sing it in bar 4. Then sing first and play second. Pinch both notes together (pick and middle finger, or the thumb alone like Wes Montgomery). Pass: you can sing each phrase and play it in octaves without looking.', watch: 'Singing a different rhythm from the one you play.', simplify: 'Two-note phrases.' })]),
        S('oct-first-music', 'First music', 'improv', 'A riff and a conversation in octaves.', [
          O_('oct-riff-first', 'First octave riff over {key} ({sets} pair)', 'transfer', { lane: '53', art: 'strum', melody: riff('first'), unit: 'quarter and 8th notes', backing: rockB, goal: 76, start: 48, why: 'A simple pentatonic riff in octaves sounds as big as a riff doubled by a bass player: the octave fills the low and the middle at once.', instr: HOW + 'Learn the two-bar riff on the {sets} pair, strumming every octave through the muted D string, and loop it over the backing. Pass: four times round in time, the middle string dead throughout.', watch: 'Lifting the hand between notes: slide it along the neck, keeping the shape.', simplify: 'Quarter notes only.' }),
          O_('oct-call-response', 'Call and response: single notes ask, octaves answer ({key})', 'transfer', { lane: '42', art: 'pinch', melody: cr, unit: '8th notes', backing: rockB, goal: 76, start: 48, why: 'A favourite move of blues and jazz players: a phrase in single notes, then the same idea answered in octaves, which sounds like a second, bigger voice.', instr: 'Play the written phrase in octaves on the {sets} pair. Then, over the backing, play it first with only the low notes (single notes), then in octaves, as question and answer. Pass: four question-and-answer pairs, the octaves as clean as the single notes.', watch: 'The octave answer coming late: prepare the shape during the question.', simplify: 'Only the first half of the phrase.' })])
      ], [1, 3]),
    stage('intermediate', 'Scales, riffs and rhythm in octaves',
      'Play the minor pentatonic and the major scale in octaves on one string pair and in one position using all four pairs, play syncopated octave punches and slide into octaves at 90 BPM, find chord roots and called degrees in octaves from memory, and play a riff and a blues melody in octaves over the backing.', [
        S('oct-scales', 'Scales in octaves', 'fretboard', 'Along one pair: the hand travels.', [
          O_('oct-pent-lane', '{key} pentatonic in octaves along the {sets} pair', 'variable', { lane: '53', art: 'glide', melody: (c, step) => run('minorPent', upDown('minorPent', 5), step), goal: 96, start: 56, why: 'On one string pair the whole scale is a journey along the neck: each note is the same shape in a new place. Gliding between notes on the same pair is the smooth, horizontal sound of octave melodies.', instr: HOW + 'Up the scale and back on the {sets} pair, keeping the shape locked and sliding the hand between notes (the tab marks the slides). Pass: up and down in time with no gap between notes.', watch: 'The shape opening up as the hand moves.', simplify: 'Up only.' }),
          O_('oct-major-lane', '{key} major in octaves along the {sets} pair', 'variable', { lane: '42', scale: 'major', art: 'pinch', melody: (c, step) => run('major', upDown('major', 7), step), goal: 92, start: 54, why: 'The major scale in octaves is the jazz and soul sound (Wes Montgomery, George Benson). On the 4–2 pair the three-fret shape has to stay exact on every fret.', instr: HOW + 'Up the major scale and back on the {sets} pair, pinched (pick on the low note, middle finger on the high one) or with the thumb. Pass: in time, every octave in tune.', watch: 'Half steps (3–4, 7–8) played as whole steps: count the frets.', simplify: 'The first five notes up and back.' })]),
        S('oct-sets', 'Every string pair', 'fretting', '6–4 and 3–1; one position.', [
          O_('oct-outer', 'The outer pairs: a {key} pentatonic line on {sets}', 'accurate-reps', { lane: ['64', '31'], keys: [0, 0], art: 'strum', melody: (c, step) => run('minorPent', [0, 1, 2, 3, 2, 1, 0, -1, 0], step).map(([d, b], i, a) => [d, i === a.length - 1 ? b * 2 : b]), goal: 90, start: 52, why: 'The 6–4 pair gives the darkest, heaviest octaves (rock riffs), the 3–1 pair the brightest (lead lines). Each needs the muting of the string between, and the 3–1 pair the three-fret shape.', instr: HOW + 'The line on the low pair, then the same line on the high pair ({sets}). Count the lines where every octave rings and nothing else does. Pass: 4 clean lines in a row.', watch: 'The high e string ringing open above the 3–1 shape: the side of the pinky mutes it.', simplify: 'Only the 6–4 pair.' }),
          O_('oct-position', 'One position, every pair: {key} pentatonic in octaves ({sets})', 'interleaving', { lane: 'pos', art: 'strum', melody: (c, step) => run('minorPent', upDown('minorPent', 7), step), goal: 92, start: 54, why: 'Staying in one place and changing string pair for each note (the hand never travels) mixes the two shapes from note to note: harder than one pair, and how octave lines are actually played.', instr: HOW + 'Keep the hand around one position: each note goes on whichever pair is nearest (the tab chooses: {sets}). Say the pair before each note at first. Pass: up and down with no shape errors.', watch: 'Using the two-fret shape on 4–2 or 3–1.', simplify: 'Only notes on 5–3 and 4–2.' })]),
        S('oct-rhythm', 'Rhythm in octaves', 'rhythm', 'Punches and slides.', [
          O_('oct-punch', 'Syncopated punches: a {key} riff in octaves on the {sets} pair', 'external-focus', { lane: '53', art: 'strum', melody: riff('push'), unit: '16th-note syncopation', backing: rockB, goal: 92, start: 56, why: 'Short octave punches on the off-beats are a rhythm part in themselves: they cut through a band like a horn section. They only work if every punch is short and the same volume.', instr: HOW + 'Strum each octave short by releasing the pressure right after it sounds. Listen for punches of equal loudness and equal shortness, landing exactly on the 16ths. Pass: four times round with every punch the same.', watch: 'Letting the long notes and the short ones ring the same length.', simplify: 'Leave out the 16th-note pushes; play on the 8ths.' }),
          O_('oct-slide-in', 'Slide into every octave from a fret below ({key} pentatonic, {sets} pair)', 'chunking', { lane: '53', art: 'slide', step: 1, melody: (c, step) => run('minorPent', [0, 1, 2, 3, 4, 3, 2, 1, 0], step).map(([d], i) => [d, i === 8 ? 2 : 1]), goal: 86, start: 50, why: 'A slide from one fret below into an octave is a classic blues-rock and soul move. Practise the slide alone, then the slide into each note of a line: small pieces, then the whole.', instr: HOW + 'For each note: the shape one fret low on the last 16th, slide into the target on the beat. First do only the root ten times, then the whole line. Pass: every slide arrives on the beat with the shape intact.', watch: 'Sliding with heavy pressure: the shape smears and the middle string rings.', simplify: 'Slide only into the root and the 5th.' })]),
        S('oct-recall', 'From memory', 'theory', 'Chord roots and called degrees.', [
          O_('oct-chord-roots', 'Chord roots in octaves, called: {key} i – ♭VI – ♭VII – i', 'retrieval', { lane: 'pos', art: 'strum', melody: () => [[0, 4], [8, 4], [10, 4], [0, 4]].flatMap(([d, b]) => [[d, 1], [d, 0.5], [d, 0.5], [d, 1], [d, 1]]), unit: 'quarter and 8th notes', backing: rockB, goal: 90, start: 54, scale: 'dorian', allow: (root) => [0, 8, 10].map(d => mod12(root + d)), why: 'Playing each chord’s root in octaves (a rhythm-guitar and bass-doubling job) needs the roots of the progression from memory, on whichever pair is nearest.', instr: 'Cover the tab. Say each chord’s root, find it in octaves near the last one and play the rhythm. Pass: twice round from memory.', watch: 'Jumping to the low E for every root.', simplify: 'Whole notes.' }),
          O_('oct-degrees', 'Called degrees in octaves: R, 5, ♭3, ♭7, 4 ({key}, two pairs)', 'retrieval', { lane: ['53', '42'], keys: [0, 0], art: 'pinch', step: 1, melody: () => [[0, 1], [7, 1], [3, 1], [10, 1], [5, 1], [12, 1], [7, 1], [0, 1]], goal: 86, start: 50, why: 'An improviser thinks in degrees. Finding a called degree in octaves, on two different pairs, connects the shapes to the scale instead of to frets.', instr: 'Cover the tab. Say each degree before you play it (R, 5, ♭3, ♭7, 4, R, 5, R), on each pair the tab uses ({sets}). Pass: both pairs from memory.', watch: 'Finding degrees by running up the scale from the root.', simplify: 'R, ♭3 and 5 only.' })]),
        S('oct-music', 'In music', 'improv', 'A riff, a blues melody.', [
          O_('oct-riff-rise', 'Octave riff with slides and a rest over {key} (in one position)', 'transfer', { lane: 'pos', art: 'strum', melody: riff('rise'), unit: '8th notes', backing: rockB, goal: 92, start: 54, why: 'A riff that slides into its first octave, walks down through the box and stops for two beats: in octaves, one guitar sounds like two.', instr: HOW + 'Loop the riff with the backing; let the rest be silent (mute everything). Then change its last bar into your own ending. Pass: four times round with the rest clean and your own ending once.', watch: 'Noise in the rest.', simplify: 'Leave out the slide.' }),
          O_('oct-blues-melody', 'A 12-bar blues melody in octaves ({key} Mixolydian)', 'transfer', { lane: 'pos', scale: 'mixo', art: 'pinch', melody: () => BLUES_MEL.map(([i, b]) => [i == null ? null : deg('mixo', i), b]), unit: 'quarter and 8th notes', backing: bluesB, goal: 88, start: 52, minutes: 6, why: 'An original blues head in octaves, the way jazz and soul players state a melody: long notes, rests and pickups, from the Mixolydian mode of the key.', instr: HOW + 'Pinch every octave and let the long notes ring their full length. Then play the head once more and change one phrase. Pass: the 12 bars in time with the backing.', watch: 'Rushing the rests.', simplify: 'The first four bars.' })])
      ], [4, 6]),
    stage('advanced', 'Fast lines and real music',
      'Play octave lines in triplets and 16ths with downstrokes at 100 BPM, change string pair every bar and key every four bars, play scales in 3rds and the 3rds of a progression in octaves from memory, and play a blues chorus and a ballad melody in octaves.', [
        S('oct-speed', 'Speed', 'picking', 'Triplets and 16ths.', [
          O_('oct-triplets', '{key} pentatonic in triplet octaves on the {sets} pair, gliding', 'variable', { lane: '42', art: 'glide', step: 1 / 3, melody: (c, step) => run('minorPent', upDown('minorPent', 5), step), goal: 100, start: 60, why: 'Triplet octaves with slides between the notes on one pair: a smooth, rolling line that needs the shape locked while the hand moves quickly.', instr: HOW + 'Down-strum every octave; slide between notes on the pair. Pass: up and down at the goal tempo with every note in tune.', watch: 'Notes smearing into each other: stop the slide exactly on the fret.', simplify: '8th notes.' }),
          O_('oct-16ths', '16th-note octaves with downstrokes: {key} in one position', 'edge', { lane: 'pos', art: 'strum', step: 0.25, melody: (c, step) => run('minorPent', [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0], step), goal: 104, start: 60, why: 'Fast octaves are played with downstrokes from the wrist, not alternate picking, so every octave has the same attack. At 16ths this is the edge of the technique.', instr: HOW + 'All downstrokes, light and from the wrist. Tempo ladder: +4 BPM after each clean pass. Pass: the line clean at the goal tempo.', watch: 'Upstrokes sneaking in (they hit the strings in the wrong order).', simplify: '8th-note triplets.' })]),
        S('oct-neck', 'Across the neck', 'fretboard', 'Every pair, four keys.', [
          O_('oct-every-pair', 'A new string pair every bar: {key} pentatonic on {sets}', 'interleaving', { lane: ['64', '53', '42', '31'], keys: [0, 0, 0, 0], art: 'strum', step: 0.5, melody: (c, step) => run('minorPent', [0, 1, 2, 3, 4, 3, 2, 1], step), goal: 100, start: 60, why: 'The same line on all four pairs, one after another, alternates the two-fret and three-fret shapes and four different mutings: mixed practice that makes the change automatic.', instr: HOW + 'One bar on each pair, in the order {sets} (three-fret shape on 4–2 and 3–1). Pass: all four bars without stopping.', watch: 'Carrying the two-fret shape onto 4–2.', simplify: 'Two pairs.' }),
          O_('oct-four-keys', 'Four keys around the cycle of fourths, in one position each ({key} and up)', 'interleaving', { lane: 'pos', keys: [0, 5, 10, 3], art: 'strum', step: 0.5, melody: (c, step) => run('minorPent', [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0], step).concat([[0, 0.5]]), goal: 98, start: 58, why: 'Changing key every block forces you to find the root, the position and the pairs again each time: the most transferable way to make octaves work in any key.', instr: HOW + 'The line in four keys, a fourth apart, staying near one position for each. Pass: all four keys without stopping.', watch: 'A long pause to find each new root.', simplify: 'Two keys.' })]),
        S('oct-lines', 'Lines and harmony', 'theory', '3rds; chord tones.', [
          O_('oct-thirds', '{key} Dorian in 3rds, in octaves ({sets})', 'variable', { lane: 'pos', scale: 'dorian', art: 'pinch', step: 0.5, melody: (c, step) => run('dorian', thirdsOf(7), step), goal: 96, start: 56, why: 'A scale in 3rds (skip a note, step back) is a melodic sequence that jazz players love in octaves: every pair of notes is a little melody, and the shapes change at every step.', instr: HOW + 'Up the Dorian mode in 3rds and back, in one position. Pass: in time with no wrong shapes.', watch: 'Losing the pattern on the way down.', simplify: 'Up only.' }),
          c => octGuide(c)]),
        S('oct-adv-music', 'In music', 'improv', 'A blues chorus, a ballad.', [
          O_('oct-blues-chorus', 'Blues chorus in octaves: the head, then your answer ({key} Mixolydian)', 'transfer', { lane: '42', scale: 'mixo', art: 'glide', melody: () => BLUES_MEL.map(([i, b]) => [i == null ? null : deg('mixo', i), b]), unit: 'quarter and 8th notes', backing: bluesB, goal: 98, start: 58, minutes: 6, why: 'The same blues head as before, now on one string pair gliding along the neck, then answered by a chorus of your own octave phrases: the way Wes Montgomery built a solo from single notes to octaves.', instr: HOW + 'Play the head on the {sets} pair, sliding between notes. Then improvise a chorus in octaves from the Mixolydian mode, using rests. Pass: two choruses in time.', watch: 'Your chorus turning into a scale run: phrase it like the head.', simplify: 'Head only.' }),
          O_('oct-ballad', 'Ballad melody in octaves over I – vi – IV – V ({key})', 'transfer', { lane: 'pos', scale: 'major', art: 'pinch', melody: () => BALLAD.map(([i, b]) => [i == null ? null : deg('major', i), b]), unit: 'quarter and 8th notes', backing: k => [nameOf(k), nameOf(k + 9) + 'm', nameOf(k + 5), nameOf(k + 7)], goal: 84, start: 50, minutes: 6, why: 'An original slow melody in octaves, the soul-ballad sound: every note sustained and singing, played with the thumb or pinched softly.', instr: HOW + 'Let every octave ring its full length, with the softest attack you can (the thumb gives the warmest tone). Pass: the melody twice with the backing, every note sustained.', watch: 'Notes cut short when the hand moves.', simplify: 'The first four bars.' })])
      ], [7, 8]),
    stage('mastery', 'Octaves at will',
      'Play 16th-note octave lines with downstrokes at 110 BPM in one position, find any degree of any key on any string pair on the spot, improvise a solo that moves between single notes and octaves, and perform your own 8-bar octave piece.', [
        S('oct-performance', 'At performance tempo', 'picking', 'Fast, clean, any key.', [
          O_('oct-perf', 'Performance tempo: {key} pentatonic up an octave and a half in 16th-note octaves, two keys', 'edge', { lane: 'pos', art: 'strum', step: 0.25, keys: [0, 7], melody: (c, step) => run('minorPent', [0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 0], step).concat([[0, 0.75]]), goal: 112, start: 68, why: 'An octave and a half of pentatonic and back in 16th-note octaves, in two keys: the speed, the muting and the shape changes all at performance tempo.', instr: HOW + 'Downstrokes only, a relaxed wrist. Tempo ladder from the start tempo, +4 BPM after each clean pass. Pass: both keys clean at the goal tempo.', watch: 'Tension creeping into the fretting hand: the shape needs only light pressure.', simplify: 'One octave of the scale.' }),
          c => octRandom(c)]),
        S('oct-recall-m', 'From memory, anywhere', 'fretboard', 'All twelve keys; a solo.', [
          O_('oct-all-keys', 'From memory: the root and 5th of all 12 keys in octaves, around the cycle', 'retrieval', { lane: ['53', '64', '42'], keys: [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7], art: 'strum', step: 1, melody: () => [[0, 1], [7, 1], [12, 1], [0, 1]], goal: 108, start: 64, why: 'Instant recall of every key on every pair: the root, the 5th and the octave of all twelve keys around the cycle of fourths, with the string pair changing every key.', instr: 'Cover the tab. Each key: root, 5th, root an octave up, root, on the pair the tab moves through ({sets}). Pass: all twelve keys in time from memory.', watch: 'A pause at each new key.', simplify: 'Six keys.' }),
          c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo that builds: single notes, then octaves at the peak, then single notes' })]),
        S('oct-voice', 'Your own piece', 'improv', 'A study, then your version.', [
          c => octEtude(c),
          O_('oct-own-riff', 'Make it yours: rewrite the {sets} octave riff over {key} with your own rhythm', 'transfer', { lane: '64', art: 'strum', melody: riff('push'), unit: '16th-note syncopation', backing: rockB, goal: 108, start: 64, why: 'Mastery means writing parts. The tab gives a heavy riff on the low string pairs; the lesson is to keep its notes and rewrite its rhythm into your own riff.', instr: HOW + 'Learn the riff, then keep the notes and change where they fall (push some ahead of the beat, add rests). Play the original and yours back to back. Pass: your riff four times round, as tight as the original.', watch: 'A rewrite that changes every time: fix it and repeat it.', simplify: 'Change only the second bar.' })])
      ], [9, 10])
  ]
});

/** Octave melodies on strings 5 & 3, then 4 & 2 (kept for older links). */
export function hxOctaves(c) { return octRun(c, { id: 'hx-octaves', name: 'Octave melodies ({key} pentatonic) on {sets}', method: 'variable', lane: ['53', '42'], keys: [0, 0], art: 'strum', melody: (c2, step) => run('minorPent', [0, 1, 2, 3, 4, 3, 2, 1], step), goal: 120, start: 60, why: 'Octaves (one note doubled an octave up, with the string between muted) make a melody sound huge: a Hendrix and Wes Montgomery trademark.', instr: HOW + 'Strings 5 & 3 are two frets apart; 4 & 2 are three frets apart (the B-string shift). Pass: both halves clean.', watch: 'The middle string ringing.', simplify: 'Quarter notes on strings 5 & 3 only.' }); }
