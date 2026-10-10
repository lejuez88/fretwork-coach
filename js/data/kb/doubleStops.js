// Double-stops: two notes played together as one voice: the 3rds, 4ths and 6ths of blues, rock and roll,
// soul and country lead guitar (Chuck Berry, T-Bone Walker, Stevie Ray Vaughan, Jimi Hendrix). From the
// first barred pair on the top two strings and the first harmonised 3rds, to 3rds and 6ths walking up and
// down every string pair, slides and hammer-ons into them, chord-tone pairs that follow a 12-bar blues,
// triplet rock-and-roll figures, turnarounds, and an original blues study.
//
// Concept-first (CONTENT.md): the model is a SCALE (the Mixolydian of each chord of a dominant blues, the
// key's minor pentatonic, or the major scale) laid out as pitches, and a DYAD as two of its notes a fixed
// number of scale steps apart (3rds = 2 steps, 6ths = 5 steps, pentatonic 4ths = 1 pentatonic step) on a
// STRING PAIR (adjacent strings for 3rds and 4ths, one string skipped for 6ths), found near a hand position,
// so every pair is right in any key by construction. The composer `dsRun(c, spec)` builds an exercise from
// interval × string pair × scale × motion (a harmonised scale run, a chord-tone pair per bar of a
// progression, a descending walk, slides, hammer-ons, triplet repeats, the barred "rock and roll" pair) ×
// rhythm (straight or shuffle) × key plan.
import { OPEN, N, nameOf, make, mod12, S, stage, entry, targetGuide, chordInfo } from '../lib.js';
import { rng } from './bending.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const SCALES = { mixo: [0, 2, 4, 5, 7, 9, 10], major: [0, 2, 4, 5, 7, 9, 11], minorPent: [0, 3, 5, 7, 10], majorPent: [0, 2, 4, 7, 9] };
/** Intervals: scale steps apart, the string pairs they use, and how to read them. */
export const INTERVALS = {
  '3rds': { steps: 2, pairs: [[3, 2], [2, 1], [4, 3]], label: '3rds' },
  '6ths': { steps: 5, pairs: [[3, 1], [4, 2], [5, 3]], label: '6ths' },
  '4ths': { steps: 1, pairs: [[2, 1], [3, 2], [4, 3]], label: 'pentatonic pairs (mostly 4ths)' }
};
export const BLUES12 = [0, 5, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7];
/** The pitches of a scale on root `root` inside a MIDI range, ascending. */
const ladder = (root, degs, lo = 40, hi = 90) => { const out = []; for (let m = lo; m <= hi; m++) if (degs.includes(mod12(m - root))) out.push(m); return out; };
/**
 * Every dyad of a scale on a string pair: [{ lo: [s, f], hi: [s, f], p }] ascending by the low note,
 * with both frets in 1–17 and at most 4 frets apart.
 */
export function dyads(root, degs, steps, [a, b], lo = 1, hi = 17) {
  const L = ladder(root, degs), out = [];
  for (let i = 0; i + steps < L.length; i++) {
    const pa = L[i], pb = L[i + steps], fa = pa - OPEN[a], fb = pb - OPEN[b];
    if (fa >= lo && fa <= hi && fb >= lo && fb <= hi && Math.abs(fa - fb) <= 4) out.push({ lo: [a, fa], hi: [b, fb], p: pa });
  }
  return out;
}
/** The run of dyads on a pair nearest fret `near` (n of them, going up). */
function runNear(list, near, n) {
  if (list.length < n) return null;
  let best = 0, bd = 1e9;
  for (let i = 0; i + n <= list.length; i++) { const d = Math.abs(list[i].lo[1] - near); if (d < bd) { bd = d; best = i; } }
  return list.slice(best, best + n);
}
/** Which note may sound where (for the pitch check): note → allowed pitch classes. */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
/** Push one dyad at beat t; art: null | 'slide' (from a fret below) | 'ham' (low note hammered from a step below) | '~'. */
function put(notes, d, t, len, pcs, art = null) {
  const C = { chord: true };
  if (art === 'slide' && d.lo[1] >= 2 && d.hi[1] >= 2 && len >= 0.5) {
    const lp = [mod12(pitch(d.lo[0], d.lo[1] - 1)), mod12(pitch(d.hi[0], d.hi[1] - 1))];
    notes.push(tag(N(d.lo[0], d.lo[1] - 1, t, 0.25, null, C), lp), tag(N(d.hi[0], d.hi[1] - 1, t, 0.25, null, C), lp));
    notes.push(tag(N(d.lo[0], d.lo[1], t + 0.25, len - 0.25, '/', C), pcs), tag(N(d.hi[0], d.hi[1], t + 0.25, len - 0.25, '/', C), pcs)); return;
  }
  if (art === 'ham' && len >= 0.5) {
    const from = [2, 1].map(k => d.lo[1] - k).find(f => f >= 0 && pcs.includes(mod12(pitch(d.lo[0], f))));
    if (from != null) { notes.push(tag(N(d.lo[0], from, t, 0.25, null, C), pcs), tag(N(d.hi[0], d.hi[1], t, len, null, C), pcs), tag(N(d.lo[0], d.lo[1], t + 0.25, len - 0.25, 'h'), pcs)); return; }
  }
  notes.push(tag(N(d.lo[0], d.lo[1], t, len, art === '~' ? '~' : null, C), pcs), tag(N(d.hi[0], d.hi[1], t, len, art === '~' ? '~' : null, C), pcs));
}
/** Swing: an 8th-note grid position → [time, length] (long-short shuffle), or straight. */
const grid = (i, step, swing) => (swing && step === 0.5 ? [Math.floor(i / 2) + (i % 2 ? 2 / 3 : 0), i % 2 ? 1 / 3 : 2 / 3] : [i * step, step]);
/** Step for runs at a level. */
export const stepFor = lvl => (lvl <= 2 ? 1 : lvl <= 6 ? 0.5 : lvl <= 8 ? 1 / 3 : 0.25);
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes']]);

/* ------------------------------- The composer ------------------------------- */
/**
 * One double-stop exercise from a spec: { id, name ('{key}', '{interval}', '{pairs}', '{chords}'), method,
 * interval ('3rds' | '6ths' | '4ths'), pairs (string pairs, one block each), scale ('mixo' | 'major' |
 * 'minorPent' | 'majorPent'), motion ('run' | 'down' | 'chordTones' | 'triplets' | 'walk'), art (slide, ham,
 * '~'), prog (bar offsets from the key root, for chordTones / walk), keys (offsets), swing, near, step,
 * domain, unit, goal, start, dl, why, instr, watch, simplify }.
 */
export function dsRun(c, spec) {
  const k0 = mod12(c.key), lvl = c.lvl || 5, I = INTERVALS[spec.interval || '3rds'], step = spec.step || stepFor(lvl), swing = !!spec.swing;
  const notes = [], used = new Set(), chordsOut = []; let t = 0;
  const pairs = spec.pairs || [I.pairs[0]], motion = spec.motion || 'run';
  for (const off of spec.keys || [0]) for (const pair of pairs) {
    const k = mod12(k0 + off), near = spec.near || 5;
    used.add(`${pair[0]}–${pair[1]}`);
    if (motion === 'run' || motion === 'down') {
      const degs = SCALES[spec.scale || 'mixo'], list = runNear(dyads(k, degs, I.steps, pair), near, spec.n || (degs.length === 5 ? 6 : 8)); if (!list) return null;
      const seq = motion === 'run' ? [...list, ...list.slice(0, -1).reverse()] : list.slice().reverse();
      const pcs = degs.map(d => mod12(k + d));
      seq.forEach((d, i) => { const [tt, len] = grid(i, step, swing); put(notes, d, t + tt, len, pcs, i === 0 ? spec.art || null : spec.artAll || null); });
      t += Math.ceil(grid(seq.length, step, swing)[0] / 4 + 1e-6) * 4;
      chordsOut.push(nameOf(k) + (spec.scale === 'major' || spec.scale === 'majorPent' ? '' : '7'));
    } else {
      // one pair per bar that holds the bar's chord's 3rd (chordTones / triplets) or walks to it (walk)
      let pos = near;
      for (const o of spec.prog || [0, 5, 0, 7]) {
        const ch = chordInfo(nameOf(k + o) + '7'), cr = ch.pcs[0], degs = SCALES.mixo, pcs = [...new Set([...degs.map(d => mod12(cr + d)), mod12(k + 3)])];
        const list = dyads(cr, degs, I.steps, pair).filter(d => [d.lo, d.hi].some(([s, f]) => mod12(pitch(s, f)) === ch.pcs[1]));
        if (!list.length) return null;
        const d = list.sort((x, y) => Math.abs(x.lo[1] - pos) - Math.abs(y.lo[1] - pos))[0]; pos = d.lo[1];
        if (motion === 'triplets') {
          for (let i = 0; i < 9; i++) put(notes, d, t + i / 3, 1 / 3, pcs, i === 0 ? spec.art || null : null);
          put(notes, d, t + 3, 1, pcs, '~');
        } else if (motion === 'walk') {
          const all = dyads(cr, degs, I.steps, pair), j = all.findIndex(x => x.p === d.p), seq = [all[j + 2], all[j + 1], d].filter(Boolean);
          seq.forEach((x, i) => { const [tt, len] = grid(i, 0.5, swing); put(notes, x, t + tt, len, pcs, null); });
          put(notes, d, t + 2, 2, pcs, '~');
        } else {
          put(notes, d, t, 2, pcs, spec.art || null);
          const [tt, len] = grid(4, 0.5, swing), [tt2, len2] = grid(5, 0.5, swing); put(notes, d, t + tt, len, pcs); put(notes, d, t + tt2, len2, pcs);
          put(notes, d, t + 3, 1, pcs);
        }
        chordsOut.push(ch.name); t += 4;
      }
    }
  }
  if (notes.length < 6 || notes.length > 400) return null;
  const fill = s => s.replace(/\{key\}/g, nameOf(k0)).replace('{interval}', I.label).replace('{pairs}', [...used].join(', ')).replace('{chords}', [...new Set(chordsOut)].join(' – '));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretting', method: spec.method, unit: spec.unit || (swing ? '8th-note shuffle' : UNIT.get(step) || '8th notes'),
    goal: spec.goal || 96, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify,
    chords: [...new Set(chordsOut)].slice(0, 8), backing: chordsOut, tab: { notes }
  });
}
const D_ = (id, name, method, opts) => c => dsRun(c, { id, name, method, ...opts });

/* ------------------------------- Special lessons ------------------------------- */
/** The barred top-two-string pair (a 4th) in rock-and-roll triplets, then sliding and bending (Chuck Berry style, original). */
export function dsBarred(c, { level = 1 } = {}) {
  const k = mod12(c.key), pent = SCALES.minorPent.map(d => mod12(k + d)), notes = [];
  let f = 1; while (mod12(pitch(2, f) - k) !== 10 || f < 3) f++;   // B string ♭7 + e string ♭3, the same fret
  if (f > 15) f -= 12;
  const C = { chord: true }, pair = (t, d, x = null, ff = f) => notes.push(tag(N(2, ff, t, d, x, C), pent), tag(N(1, ff, t, d, x, C), pent));
  const tb = (t, d) => notes.push(tag(N(2, f, t, d, 'b', { bendTo: f + 2, chord: true }), pent), tag(N(1, f, t, d, null, C), pent));
  for (let bar = 0; bar < 4; bar++) {
    const T = bar * 4;
    if (level === 1) { for (let i = 0; i < 6; i++) pair(T + i / 3, 1 / 3); pair(T + 2, 2); }
    else { pair(T, 1 / 3); pair(T + 1 / 3, 1 / 3); tb(T + 2 / 3, 4 / 3); for (let i = 0; i < 3; i++) pair(T + 2 + i / 3, 1 / 3); notes.push(tag(N(3, f + 1, T + 3, 1, '~'), pent)); }
  }
  const chords = [k, k + 5, k, k + 7].map(x => nameOf(x) + '7');
  return make(c, {
    id: level === 1 ? 'ds-barred' : 'ds-barred-bend', name: level === 1 ? `The barred pair: ♭7 and ♭3 on the top strings in rock-and-roll triplets (${nameOf(k)})` : `Barred pair with a bend: the B string pushed to the root under the held ♭3 (${nameOf(k)})`,
    domain: 'fretting', method: level === 1 ? 'chunking' : 'variable', unit: '8th-note triplets', goal: level === 1 ? 80 : 88, start: level === 1 ? 50 : 54, minutes: 4, backing: chords, chords: [...new Set(chords)], tab: { notes },
    why: level === 1 ? 'One finger barring the B and e strings at the same fret gives the ♭7 and ♭3 of the key together: the first double-stop of rock and roll and the blues. Repeating it in triplets builds a relaxed barre and an even picking hand.' : 'Bending the B string a whole step (♭7 → R) while the e string keeps the ♭3 makes the barred pair cry: a sound shared by Chuck Berry, Hendrix and Stevie Ray Vaughan.',
    instr: level === 1 ? `Barre the B and e strings with the index (or ring) finger at fret ${f}. Pick both strings together, six triplets, then let the pair ring for two beats. First practise only the barre (both notes ringing), then the triplets. Pass: four bars with both notes in every triplet.` : `Two triplet pairs, then push the B string up a whole step with the ring finger (middle and index behind it) while the e string stays on the ♭3; three more triplets; then the 5th on the G string, one fret up, with vibrato. Pass: four bars with the bend reaching the root every time.`,
    watch: level === 1 ? 'The barre collapsing so one string goes dead.' : 'The e string being pushed out of tune by the bending finger.', simplify: level === 1 ? 'Quarter notes.' : 'Leave out the bend; play the triplets.'
  });
}
/** A random interval, pair and chord every bar (interleaving). */
export function dsRandom(c) {
  const r = rng(631 + (c.lvl || 9)), k = mod12(c.key), notes = [], names = [], chords = [];
  for (let bar = 0; bar < 8; bar++) {
    const o = [0, 5, 7][Math.floor(r() * 3)], iv = ['3rds', '6ths', '4ths'][Math.floor(r() * 3)], I = INTERVALS[iv], pair = I.pairs[Math.floor(r() * 2)];
    const ch = chordInfo(nameOf(k + o) + '7'), degs = iv === '4ths' ? SCALES.minorPent : SCALES.mixo, root = iv === '4ths' ? k : ch.pcs[0];
    const pcs = [...new Set([...SCALES.mixo.map(d => mod12(ch.pcs[0] + d)), ...SCALES.minorPent.map(d => mod12(k + d))])];
    const list = runNear(dyads(root, degs, I.steps, pair), 3 + Math.floor(r() * 9), 4); if (!list) return null;
    [...list, list[2], list[1]].forEach((d, i) => put(notes, d, bar * 4 + i * 0.5, 0.5, pcs)); put(notes, list[0], bar * 4 + 3, 1, pcs, '~');
    names.push(`${ch.name}: ${I.label} on ${pair[0]}–${pair[1]}`); chords.push(ch.name);
  }
  return make(c, {
    id: 'ds-random', name: `Random access: a new chord, interval and string pair every bar (${nameOf(k)} blues)`, domain: 'fretboard', method: 'interleaving', unit: '8th notes', goal: 104, start: 62, minutes: 5, dl: 1, chords: [...new Set(chords)], backing: chords, tab: { notes },
    why: 'At mastery level the double-stop is chosen on the spot: whichever chord comes, whichever interval and string pair suits the moment. An unpredictable order is what makes the choice instant.',
    instr: `${names.join(' → ')}. Read only the names: find four pairs of that interval near the called fret, up and back, and land with vibrato. Pass: all 8 bars in time from the names alone.`,
    watch: 'Using 3rds on the G and B strings for everything.', simplify: 'The first four bars.'
  });
}
/** An original 12-bar blues study in double-stops (capstone): barred pairs, 3rds per chord, 6ths walking, triplets, a turnaround. */
export function dsEtude(c) {
  const k = mod12(c.key), notes = [], chords = [];
  const plan = [['3rds', [3, 2], 'chord'], ['3rds', [3, 2], 'chord'], ['6ths', [3, 1], 'walk'], ['4ths', [2, 1], 'trip'], ['3rds', [3, 2], 'chord'], ['6ths', [3, 1], 'walk'], ['3rds', [2, 1], 'chord'], ['4ths', [2, 1], 'trip'], ['6ths', [4, 2], 'chord'], ['3rds', [3, 2], 'chord'], ['6ths', [3, 1], 'walk'], ['6ths', [4, 2], 'chord']];
  let pos = 5;
  for (const [bar, o] of BLUES12.entries()) {
    const [iv, pair, m] = plan[bar], I = INTERVALS[iv], ch = chordInfo(nameOf(k + o) + '7'), cr = ch.pcs[0];
    const pcs = [...new Set([...SCALES.mixo.map(d => mod12(cr + d)), mod12(k + 3)])], T = bar * 4;
    const degs = iv === '4ths' ? SCALES.minorPent : SCALES.mixo, root = iv === '4ths' ? k : cr;
    const pcsB = iv === '4ths' ? [...new Set([...pcs, ...SCALES.minorPent.map(d => mod12(k + d))])] : pcs;
    const all = dyads(root, degs, I.steps, pair), withThird = all.filter(d => [d.lo, d.hi].some(([s, f]) => mod12(pitch(s, f)) === ch.pcs[1]));
    const pool = iv === '4ths' ? all : withThird; if (!pool.length) return null;
    const d = pool.sort((x, y) => Math.abs(x.lo[1] - pos) - Math.abs(y.lo[1] - pos))[0]; pos = d.lo[1];
    if (m === 'chord') { put(notes, d, T, 2, pcsB, 'slide'); put(notes, d, T + 2 + 2 / 3, 1 / 3, pcsB); put(notes, d, T + 3, 1, pcsB, '~'); }
    else if (m === 'trip') { for (let i = 0; i < 9; i++) put(notes, d, T + i / 3, 1 / 3, pcsB); put(notes, d, T + 3, 1, pcsB, '~'); }
    else { const j = all.indexOf(d), seq = [all[j + 2], all[j + 1], d].filter(Boolean); seq.forEach((x, i) => put(notes, x, T + i * (2 / 3), 2 / 3, pcsB)); put(notes, d, T + 2, 2, pcsB, '~'); }
    chords.push(ch.name);
  }
  if (notes.length > 400) return null;
  return make(c, {
    id: 'ds-capstone-etude', name: `Capstone study: a 12-bar blues in double-stops (${nameOf(k)})`, domain: 'improv', method: 'transfer', unit: '8th-note shuffle and triplets', goal: 96, start: 58, minutes: 8, dl: 1, chords: [...new Set(chords)], backing: chords, tab: { notes },
    why: 'An original 12-bar piece that uses the whole path: 3rds that slide into each chord’s 3rd, 6ths that walk down into the chord, rock-and-roll triplets on pentatonic pairs, a different string pair for each colour, and vibrato on every landing.',
    instr: 'Learn it four bars at a time, naming the interval and string pair of each bar before you play it. Then write your own 12 bars to the same plan. Pass: the study at the goal tempo with both notes of every pair ringing, then your own version once.',
    watch: 'Losing the shuffle feel in the triplet bars.', simplify: 'The first four bars.'
  });
}

/* --------------------------------- The path --------------------------------- */
const HOW = 'Fret the two notes with two fingers (or barre them with one when they sit on the same fret), pick both strings together with one short stroke, and mute the strings around them with the fretting fingers’ sides and the picking hand’s palm. ';
const blues4 = [0, 5, 0, 7];
export default entry({
  id: 'doubleStops', kind: 'technique', title: 'Double-stops', domain: 'fretting',
  re: /double.?stops?|dyads?( licks?)?|two.note (licks|fills)|chuck berry (licks|style)/,
  aliases: ['dyads', 'double stop licks', '3rds and 6ths'],
  summary: 'Two notes as one voice: the barred rock-and-roll pair, 3rds, 6ths and pentatonic pairs on every string pair, slides and hammer-ons into them, pairs that follow a 12-bar blues, triplets, walks and an original blues study.',
  prereqs: ['pentatonic'],
  sources: ['https://www.premierguitar.com/deep-blues-double-stoppin-jive', 'https://guitarplayer.com/lessons/blues-guitar-double-stops', 'https://guitarworld.com/lessons/stevie-ray-vaughan-5-licks', 'https://www.guitarplayer.com/lessons/jimi-hendrix-the-five-rules-of-his-powerful-rhythm-style'],
  ctx: { key: 4, minor: false, prog: 'blues' },
  stages: [
    stage('foundations', 'Two notes, one sound',
      'Barre the top-string pair in even triplets at 80 BPM, play the major scale in 3rds on the G and B strings up and back, hear the 3rd of each pair before playing it, find the pair holding each chord’s 3rd from memory over I – IV – I – V, and play a first double-stop blues over a shuffle.', [
        S('ds-first', 'The first pairs', 'fretting', 'The barred pair; two fingers on two strings.', [
          c => dsBarred(c, { level: 1 }),
          D_('ds-3rds-first', '{key} major in 3rds on the G and B strings, one pair a beat', 'accurate-reps', { interval: '3rds', pairs: [[3, 2]], scale: 'major', step: 1, n: 8, goal: 66, start: 42, why: 'Harmonising a scale in 3rds (each note with the scale tone two steps above) is the basic double-stop. On the G and B strings the shapes alternate between a one-fret and a two-fret spread: count the clean pairs to learn both.', instr: HOW + 'Up the scale in 3rds on the G and B strings and back, one pair a beat. Count the pairs where both notes ring. Pass: 8 clean pairs in a row, twice.', watch: 'One note of the pair louder or choked.', simplify: 'Only the first four pairs.' })]),
        S('ds-sound', 'Hear the pair', 'ear', 'Two notes as one; the third that moves.', [
          D_('ds-hear', 'Hear it first: {key} major 3rds, sung, then played', 'audiation', { interval: '3rds', pairs: [[2, 1]], scale: 'major', step: 1, n: 6, motion: 'down', goal: 64, start: 40, why: 'A pair of notes is heard as one sweet sound, but the melody is usually its top note. Singing the top note of each pair before playing it makes the line musical instead of mechanical.', instr: HOW + 'Sing the top note of each pair, then play the pair, walking down the scale in 3rds on the B and e strings. Pass: you can sing the top line while you play it.', watch: 'Singing the lower note.', simplify: 'Three pairs.' }),
          D_('ds-even', 'Both notes the same volume: {key} 3rds on {pairs}', 'external-focus', { interval: '3rds', pairs: [[3, 2], [2, 1]], scale: 'mixo', step: 1, n: 6, goal: 66, start: 42, why: 'A double-stop only sounds like one voice if both notes are equally loud and stop together. Listening for that balance (not watching the fingers) is what fixes the picking angle.', instr: HOW + 'The Mixolydian scale in 3rds on two string pairs, one pair a beat. Listen: one sound, two equal notes, stopping together. Pass: every pair balanced on both string pairs.', watch: 'The higher string always louder (the pick only grazing the lower one).', simplify: 'One string pair.' })]),
        S('ds-know', 'Know where they live', 'fretboard', 'The pair holding each chord’s 3rd.', [
          D_('ds-chord-3rds', 'From memory: the 3rds pair holding each chord’s 3rd ({chords})', 'retrieval', { interval: '3rds', pairs: [[3, 2]], motion: 'chordTones', prog: blues4, goal: 66, start: 42, why: 'Over a blues every chord has its own 3rd. Finding the pair that contains it (from memory, near where the hand is) is what makes double-stops follow the changes.', instr: 'Cover the tab. For each chord say its 3rd, find the 3rds pair on the G and B strings that contains it, near the last one, and play the bar. Pass: all four chords from memory.', watch: 'Staying on the I chord’s pair when the chord changes.', simplify: 'I and IV only.' }),
          D_('ds-slide-first', 'Slide into the pair: {key} 3rds on {pairs}', 'chunking', { interval: '3rds', pairs: [[3, 2]], scale: 'mixo', step: 1, n: 5, art: 'slide', artAll: 'slide', goal: 64, start: 40, why: 'Sliding into a double-stop from a fret below is the most common way it is played in the blues. The slide is a small motion: practise it alone, then on every pair.', instr: HOW + 'Each pair arrives by sliding up one fret on the beat. First slide into one pair ten times, then the whole line. Pass: every slide arrives together and on time.', watch: 'One finger arriving before the other.', simplify: 'Slide only into the first pair.' })]),
        S('ds-first-music', 'First music', 'improv', 'A double-stop blues.', [
          D_('ds-first-blues', 'First double-stop blues: the 3rd of each chord over {chords}', 'transfer', { interval: '3rds', pairs: [[3, 2]], motion: 'chordTones', prog: blues4, swing: true, art: 'slide', goal: 72, start: 46, why: 'Four bars, one pair per chord, slid into and repeated in the shuffle: already a blues part, and a template for every double-stop solo.', instr: HOW + 'Slide into the pair on beat 1, repeat it on the shuffle off-beat of 3 and on beat 4. Then change the rhythm of bar 4 to your own. Pass: four times round with the backing.', watch: 'Straight 8ths creeping in: long-short, long-short.', simplify: 'Only beat 1 of each bar.' }),
          c => dsBarred(c, { level: 2 })])
      ], [1, 3]),
    stage('intermediate', '3rds, 6ths and the changes',
      'Play Mixolydian 3rds and 6ths up and down three string pairs at 90 BPM, hammer and slide into pairs, play pentatonic pairs on the top strings, follow a 12-bar blues with each chord’s pair from memory, walk 6ths down into each chord, and play a double-stop solo over a shuffle.', [
        S('ds-6ths', 'Sixths', 'fretting', 'One string skipped.', [
          D_('ds-6ths-run', '{key} Mixolydian in 6ths on {pairs}', 'variable', { interval: '6ths', pairs: [[3, 1], [4, 2]], scale: 'mixo', goal: 88, start: 54, why: 'A 6th is a 3rd turned upside down: the pairs skip a string, which gives the open, soulful sound of Curtis Mayfield and Steve Cropper and of every blues turnaround. The middle string must stay silent.', instr: HOW + 'Fret the G and e strings (then D and B), the middle string muted by the underside of the lower finger; pick with the pick and a finger, or the pick alone muting in between. Up and back. Pass: both string pairs clean.', watch: 'The middle string ringing.', simplify: 'Quarter notes on one pair.' }),
          D_('ds-6ths-walk', '6ths walking down into each chord: {chords}', 'variable', { interval: '6ths', pairs: [[3, 1]], motion: 'walk', prog: [0, 5, 0, 7], swing: true, goal: 86, start: 52, why: 'Two 6ths walking down the chord’s scale into a 6th that holds its 3rd (a soul and blues move) leads the ear into each chord.', instr: HOW + 'Three pairs per bar, the last one holding the chord’s 3rd with vibrato. Pass: four bars in time with the backing.', watch: 'Landing on a pair that misses the chord’s 3rd.', simplify: 'Only the landing pair.' }),
          D_('ds-6ths-soul', 'Soul 6ths: slide into every pair, {key} major on {pairs}', 'external-focus', { interval: '6ths', pairs: [[3, 1]], scale: 'major', n: 6, art: 'slide', artAll: 'slide', goal: 84, start: 50, why: 'Sliding into 6ths in the major scale is the soul-ballad sound (Curtis Mayfield, Steve Cropper). It depends on the sound: a smooth, vocal slide that stops exactly in tune.', instr: HOW + 'Slide into every pair from a fret below, letting each ring. Listen for a slide that sounds like a singer reaching the note, not a scrape. Pass: up and back with every slide smooth and in tune.', watch: 'Pressing hard during the slide (it squeaks and goes sharp).', simplify: 'Slide only into every other pair.' })]),
        S('ds-moves', 'Moves into the pair', 'fretting', 'Hammer-ons and slides.', [
          D_('ds-ham', 'Hammer the lower note: {key} 3rds on {pairs}', 'accurate-reps', { interval: '3rds', pairs: [[3, 2]], scale: 'mixo', n: 6, art: 'ham', artAll: 'ham', goal: 86, start: 52, why: 'Hammering the lower note of a pair from a step below while the upper note rings (the ♭3 into the 3rd is the classic) makes the pair move like a voice.', instr: HOW + 'Pick the pair with the lower note a step low, then hammer it up. Count the clean ones. Pass: 8 clean hammer-ons in a row.', watch: 'The hammered note dying: hammer from close to the string.', simplify: 'Hammer only on the beat-1 pair.' }),
          D_('ds-pent-pairs', 'Pentatonic pairs on the top strings: {key} minor pentatonic on {pairs}', 'variable', { interval: '4ths', pairs: [[2, 1], [3, 2]], scale: 'minorPent', art: 'slide', goal: 88, start: 54, why: 'Neighbouring notes of the minor pentatonic on adjacent strings are mostly 4ths: the gritty, open blues-rock pairs (Hendrix, Vaughan) that also fit over every chord of the blues.', instr: HOW + 'Up and back through the pentatonic pairs on the B and e strings, then on the G and B. Pass: both pairs clean.', watch: 'Two fingers where one barre would do (same fret on both strings).', simplify: 'One string pair.' })]),
        S('ds-changes', 'Through the changes', 'fretboard', 'A 12-bar; any pair from memory.', [
          D_('ds-12bar', 'A 12-bar blues in chord-tone 3rds: {chords}', 'interleaving', { interval: '3rds', pairs: [[3, 2]], motion: 'chordTones', prog: BLUES12, swing: true, art: 'slide', goal: 88, start: 54, minutes: 6, why: 'A full 12-bar with the pair moving to each chord’s 3rd: the hand switches between three different pairs in the order the form demands, which is how the skill is used.', instr: HOW + 'One chord-tone pair per bar, slid into, in the shuffle. Pass: one chorus without stopping.', watch: 'Arriving late at bar 9 (the V chord).', simplify: 'The first four bars.' }),
          D_('ds-called-pairs', 'From memory: 6ths holding each chord’s 3rd ({chords})', 'retrieval', { interval: '6ths', pairs: [[4, 2]], motion: 'chordTones', prog: [0, 5, 7, 5, 0, 7], goal: 86, start: 52, why: 'The same retrieval with 6ths: the chord’s 3rd is on top or underneath, a string apart, in a new place on the neck.', instr: 'Cover the tab. For each chord, say its 3rd and find the 6th on the D and B strings that holds it. Pass: all six bars from memory.', watch: 'Searching on the wrong string pair.', simplify: 'Three chords.' }),
          D_('ds-3rds-walk', '3rds walking down into each chord on the top strings: {chords}', 'interleaving', { interval: '3rds', pairs: [[2, 1]], motion: 'walk', prog: [0, 5, 7, 5], swing: true, goal: 86, start: 52, why: 'A walk of two 3rds into the pair that holds the chord’s 3rd changes shape on every chord, because each chord has its own Mixolydian: mixed practice that follows the harmony.', instr: HOW + 'Three pairs per bar on the B and e strings, landing on the chord’s 3rd with vibrato on beat 3. Pass: four bars in time with the backing.', watch: 'Using the I chord’s pairs over the IV and V.', simplify: 'Only the landing pair.' })]),
        S('ds-music', 'In music', 'improv', 'Triplets and a solo.', [
          D_('ds-triplet-blues', 'Rock-and-roll triplets on each chord’s pair: {chords}', 'transfer', { interval: '3rds', pairs: [[2, 1]], motion: 'triplets', prog: [0, 5, 0, 7], goal: 92, start: 56, why: 'Repeating each chord’s pair in triplets and holding it with vibrato on beat 4 is the Chuck Berry engine that blues and rock players still use to build a chorus.', instr: HOW + 'Nine triplet pairs, then the pair held with vibrato. Pass: four bars with the backing, every triplet even.', watch: 'The picking hand tightening.', simplify: '8th notes.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'majorPent', name: 'Double-stop solo over a blues: each phrase ends on a pair with the chord’s 3rd' })])
      ], [4, 6]),
    stage('advanced', 'Every pair, every chord',
      'Play 3rds and 6ths on every string pair in triplets at 100 BPM, change interval and key every block, recall each chord’s pairs in two intervals from memory, hammer and slide through a 12-bar in 6ths, and play a shuffle chorus and a slow-blues chorus in double-stops.', [
        S('ds-speed', 'Faster', 'fretting', 'Triplets on all pairs.', [
          D_('ds-3rds-trip', '{key} Mixolydian 3rds in triplets on {pairs}', 'variable', { interval: '3rds', pairs: [[4, 3], [3, 2], [2, 1]], scale: 'mixo', step: 1 / 3, goal: 100, start: 60, why: 'The same 3rds on three string pairs, in triplets: each pair has its own fingerings (the B string changes them), so the hand must adapt every block.', instr: HOW + 'Up and back on the D–G, G–B and B–e pairs. Pass: all three clean at the goal tempo.', watch: 'Shapes from the G–B pair carried to the D–G pair (which needs a different spread).', simplify: 'Two pairs.' }),
          D_('ds-6ths-fast', '6ths at the edge: {key} Mixolydian on {pairs}', 'edge', { interval: '6ths', pairs: [[3, 1], [5, 3]], scale: 'mixo', step: 1 / 3, goal: 100, start: 60, why: 'Fast 6ths need a clean string skip on every pair. Climbing the tempo while the middle string stays silent is the edge of the technique.', instr: HOW + 'Tempo ladder: +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Noise from the skipped string as the tempo rises.', simplify: '8th notes.' })]),
        S('ds-neck', 'Across keys and intervals', 'fretboard', 'Mixed blocks.', [
          D_('ds-keys', 'Four keys around the cycle of fourths: 3rds on {pairs}', 'interleaving', { interval: '3rds', pairs: [[3, 2]], scale: 'mixo', keys: [0, 5, 10, 3], n: 6, goal: 98, start: 58, why: 'Changing key every block means rebuilding every pair from a new root: the practice that makes double-stops work in any song’s key.', instr: HOW + 'The Mixolydian 3rds of four keys, a fourth apart. Pass: all four without stopping.', watch: 'Pauses at each key change.', simplify: 'Two keys.' }),
          D_('ds-two-intervals', 'From memory: each chord’s 3rd in 3rds, then in 6ths ({chords})', 'retrieval', { interval: '3rds', pairs: [[3, 2]], motion: 'chordTones', prog: [0, 5, 7, 0], goal: 96, start: 58, why: 'Knowing two pairs for every chord (a 3rd and a 6th) gives a choice of register and colour on every change. Recall them with the tab covered.', instr: 'Cover the tab. Play the written 3rds pair for each chord, then on a second pass find a 6ths pair (G and e strings) holding the same 3rd. Pass: both passes from memory.', watch: 'The 6ths pass drifting off the chord tone.', simplify: '3rds only.' })]),
        S('ds-colour', 'Colour', 'fretting', 'Hammer-ons and slides through a 12-bar.', [
          D_('ds-12bar-6ths', 'A 12-bar in 6ths, each one slid into: {chords}', 'accurate-reps', { interval: '6ths', pairs: [[3, 1]], motion: 'chordTones', prog: BLUES12, art: 'slide', swing: true, goal: 96, start: 58, minutes: 6, why: 'A chorus in 6ths, sliding into each chord’s pair, is the soul-blues sound: it asks for a clean skip and an exact slide twelve times in a row.', instr: HOW + 'Count the bars where the slide arrives with both notes and no middle string. Pass: a whole chorus clean.', watch: 'Slides that overshoot.', simplify: 'The first four bars.' }),
          D_('ds-ham-pent', 'Hammer-ons inside the pentatonic pairs: {key} on {pairs}', 'variable', { interval: '4ths', pairs: [[3, 2]], scale: 'minorPent', artAll: 'ham', n: 6, goal: 96, start: 58, why: 'Hammering the lower note of each pentatonic pair from below (the ♭3 hammered from the 2, the 5 from the 4) makes the pairs sound like a singer sliding into notes.', instr: HOW + 'Every pair with the lower note hammered. Pass: up and back clean.', watch: 'The upper note stopping when you hammer.', simplify: 'Hammer every other pair.' })]),
        S('ds-adv-music', 'In music', 'improv', 'Shuffle and slow blues.', [
          D_('ds-shuffle-chorus', 'Shuffle chorus: triplets and slides through {chords}', 'transfer', { interval: '3rds', pairs: [[2, 1]], motion: 'triplets', prog: BLUES12, art: 'slide', goal: 100, start: 60, minutes: 6, why: 'A full chorus of the rock-and-roll engine: each chord’s pair slid into, repeated in triplets and held with vibrato. Then a chorus of your own pairs answers it.', instr: HOW + 'Play the written chorus, then improvise one chorus of double-stops in any interval. Pass: both choruses with the backing.', watch: 'Your chorus losing the form.', simplify: 'The written chorus only.' }),
          c => targetGuide(c, { prog: 'slowBlues', scale: 'majorPent', name: 'Slow blues in double-stops: 6ths and 3rds landing on each chord’s 3rd' })])
      ], [7, 8]),
    stage('mastery', 'Double-stops at will',
      'Play 3rds in 16ths at 104 BPM on the top pairs, choose any interval and string pair for any chord on the spot, play all twelve keys’ I – IV – V pairs from memory, and perform your own 12-bar double-stop piece.', [
        S('ds-performance', 'At performance tempo', 'fretting', 'Fast and any chord.', [
          D_('ds-perf', 'Performance tempo: {key} Mixolydian 3rds in 16ths on {pairs}', 'edge', { interval: '3rds', pairs: [[3, 2], [2, 1]], scale: 'mixo', step: 0.25, goal: 104, start: 64, why: 'Fast 3rds on the top pairs: the speed of country and rock-and-roll double-stop runs, with both notes still even.', instr: HOW + 'Tempo ladder from the start tempo, +4 BPM after each clean pass. Pass: both pairs clean at the goal tempo.', watch: 'The lower note dropping out at speed.', simplify: 'Triplets.' }),
          c => dsRandom(c)]),
        S('ds-recall-m', 'Every key', 'fretboard', 'All twelve keys; a solo.', [
          D_('ds-all-keys', 'From memory: I – IV – V chord-tone pairs in six keys ({key} and around the cycle)', 'retrieval', { interval: '3rds', pairs: [[3, 2]], motion: 'chordTones', prog: [0, 5, 7], keys: [0, 5, 10, 3, 8, 1], goal: 100, start: 60, why: 'The chord-tone pairs of I, IV and V in six keys around the cycle of fourths, recalled under time: the map that lets you play double-stops in any blues.', instr: 'Cover the tab. Three bars per key. Pass: all six keys in time from memory, then the other six on your own.', watch: 'A pause at each new key.', simplify: 'Three keys.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Solo that moves between single notes and double-stops at every chord change' })]),
        S('ds-voice', 'Your own piece', 'improv', 'A study, then your version.', [
          c => dsEtude(c),
          D_('ds-own', 'Make it yours: rewrite a 12-bar of pairs over {chords}', 'transfer', { interval: '6ths', pairs: [[4, 2]], motion: 'walk', prog: BLUES12, swing: true, goal: 98, start: 58, minutes: 6, why: 'Mastery means writing your own part: the tab gives a chorus of walking 6ths; keep the form and replace the pairs and rhythms with your own.', instr: HOW + 'Learn the written chorus, then rewrite it: change the interval or string pair of at least six bars and the rhythm of four. Play both back to back. Pass: your chorus twice, as clean as the written one.', watch: 'A rewrite that changes every time: fix it and repeat it.', simplify: 'Rewrite four bars.' })])
      ], [9, 10])
  ]
});
