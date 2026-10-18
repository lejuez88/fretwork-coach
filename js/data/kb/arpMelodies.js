// Arpeggio melodies: melodies built only from the tones of the chord of the moment, taken in shapes
// (in order, in "arpeggio 3rds", in wide leaps, with octave displacement) and joined across the
// changes by voice leading and slides. The sound of Guthrie Govan's tunes and of modern fusion lines.
//
// Concept-first (CONTENT.md): the model is a chord as its tones laid out as pitches over the middle
// of the neck (`tonesOf()`), any progression of the key (`PROGS`, seventh chords from the key, so it
// is right in every key), and melodic SHAPES as index patterns over that tone list (`SHAPES`: up,
// down, up and down, 3rds, leaps, four-note cells, octave displacement). Every bar starts on the tone
// nearest to the last note (voice leading) or on a chosen chord tone; notes are placed on the neck
// near the hand's position (`place()`), with slides where two neighbours share a string. The composer
// `arpMel(c, spec)` builds an exercise from progression × shape × start tone × note value × rhythm ×
// slides × keys. Every note is a chord tone of its bar.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-18: the tones of one chord, then
// two; target notes (one chord tone per chord, the 3rd first); voice leading to the nearest tone;
// reordering the tones (arpeggio 3rds, slides that make the line sing); then wide intervals, octave
// displacement and string skips, progressions and keys; then the whole key, minor ii–V–i, accented top
// lines; then tempo and your own melody. Removed: echoing by ear and singing (`arpm-echo`), naming tones
// and chords aloud, covering the tab and "from memory" versions (`arpm-names`, `arpm-from-third`,
// `arpm-cycle-recall`, the covered passes of `arpm-one` and `arpm-random`); added `arpm-target` (target
// notes: each chord's 3rd on beat 1). Study notes added to every skill.
import { OPEN, N, nameOf, minorKey, make, mod12, chordInfo, goalFor, S, stage, entry, M, targetGuide } from '../lib.js';
import { place } from './chromaticPassing.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const unitName = step => UNIT.get(step) || '8th notes';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Progressions of a minor key (k = the minor tonic), as seventh chords. */
export const PROGS = {
  one: k => [nameOf(k) + 'm7', nameOf(k) + 'm7', nameOf(k) + 'm7', nameOf(k) + 'm7'],
  vamp: k => [nameOf(k) + 'm7', nameOf(k + 5) + '9', nameOf(k) + 'm7', nameOf(k + 5) + '9'],
  rock7: k => [nameOf(k) + 'm7', nameOf(k + 8) + 'maj7', nameOf(k + 10) + '7', nameOf(k) + 'm7'],
  minorIIV: k => [nameOf(k + 2) + 'm7b5', nameOf(k + 7) + '7', nameOf(k) + 'm7', nameOf(k) + 'm7'],
  majorIIV: k => [nameOf(k + 5) + 'm7', nameOf(k + 10) + '7', nameOf(k + 3) + 'maj7', nameOf(k + 3) + 'maj7'],
  cycle: k => [nameOf(k) + 'm7', nameOf(k + 5) + 'm7', nameOf(k + 10) + '7', nameOf(k + 3) + 'maj7', nameOf(k + 8) + 'maj7', nameOf(k + 2) + 'm7b5', nameOf(k + 7) + '7', nameOf(k) + 'm7']
};
const LO = 50, HI = 81;   // D3 … A5: the middle of the neck
/** The chord's tones as pitches from LO to HI, ascending. */
export function tonesOf(name, lo = LO, hi = HI) { const ch = chordInfo(name); if (!ch) return null; const out = []; for (let p = lo; p <= hi; p++) if (ch.pcs.includes(mod12(p))) out.push(p); return out; }
/** Melodic shapes: the index offsets (into the tone list, from the start tone) for n notes. */
export const SHAPES = {
  up: n => [...Array(n).keys()],
  down: n => [...Array(n).keys()].map(i => -i),
  updown: n => [...Array(n).keys()].map(i => { const m = i % 6; return m <= 3 ? m : 6 - m; }),
  thirds: n => [...Array(n).keys()].map(i => Math.floor(i / 2) + (i % 2 ? 2 : 0)),            // 0 2 1 3 2 4 …
  thirdsDown: n => [...Array(n).keys()].map(i => -(Math.floor(i / 2) + (i % 2 ? 2 : 0))),
  leaps: n => [...Array(n).keys()].map(i => Math.floor(i / 2) + (i % 2 ? 3 : 0)),             // 0 3 1 4 2 5 …
  cell4: n => [...Array(n).keys()].map(i => Math.floor(i / 4) + [0, 1, 2, 1][i % 4]),
  displace: n => [...Array(n).keys()].map(i => Math.floor(i / 2) + (i % 2 ? 4 : 0))           // every other note an octave up (4 tones of a 7th chord)
};
/** A shape's offsets for n notes, folded back on itself (up, then back down) when it is wider than the chord's range. */
export function shapeOffs(shape, n, len) {
  let offs = SHAPES[shape](n);
  if (Math.max(...offs) - Math.min(...offs) > len - 1) { const up = SHAPES[shape](Math.ceil(n / 2)); offs = [...up, ...up.slice().reverse()].slice(0, n); }
  return offs;
}
const SHAPE_NAME = { up: 'up the arpeggio', down: 'down the arpeggio', updown: 'up and back', thirds: 'in arpeggio 3rds', thirdsDown: 'in arpeggio 3rds, descending', leaps: 'in wide leaps', cell4: 'in four-note cells', displace: 'with octave displacement' };
const TONE_NAMES = { m7: ['R', '♭3', '5', '♭7'], maj7: ['R', '3', '5', '7'], '7': ['R', '3', '5', '♭7'], m7b5: ['R', '♭3', '♭5', '♭7'], '9': ['R', '3', '5', '♭7', '9'] };
/** Slide marks for neighbours that share a string (up to five frets apart, never from or to an open string). */
function slideMarks(notes) { return notes.map((n, i) => { const p = notes[i - 1]; return p && p.s === n.s && p.f !== n.f && p.f > 0 && n.f > 0 && Math.abs(p.f - n.f) <= 5 && Math.abs(p.t + p.d - n.t) < 1e-6 ? { ...n, x: n.f > p.f ? '/' : '\\' } : n; }); }

/* ------------------------------- The composer ------------------------------- */
/**
 * One arpeggio-melody exercise from a spec: { id, name ('{key}', '{chords}', '{shape}'), method, prog
 * (a PROGS name) or chords, keys (offsets: the progression repeated in each key), shape, start
 * ('near' | 'root' | 'third' | 'top'), step, rhythm (durations of one bar, overriding step), slides,
 * goal, start BPM (startBpm), dl, why, instr, watch, simplify }.
 */
export function arpMel(c, spec) {
  const k0 = minorKey(c), step = spec.step || 0.5, rhythm = spec.rhythm || Array(Math.round(4 / step)).fill(step);
  const bars = []; for (const off of spec.keys || [0]) bars.push(...(spec.chords || PROGS[spec.prog || 'vamp'](mod12(k0 + off))));
  const notes = [], used = []; let last = 64, anchor = 64, near = 7, t = 0;
  const monotonic = (spec.shape || 'up') !== 'updown';
  for (const nm of bars) {
    const T = tonesOf(nm); if (!T || T.length < 6) return null; const ch = chordInfo(nm);
    let i0;
    if (spec.start === 'root' || spec.start === 'third') { const want = ch.pcs[spec.start === 'root' ? 0 : 1]; const cand = T.map((p, i) => i).filter(i => mod12(T[i]) === want); i0 = cand.sort((a, b) => Math.abs(T[a] - last) - Math.abs(T[b] - last))[0]; }
    else if (spec.start === 'top') i0 = T.length - 1;
    else { const ref = monotonic ? anchor : last; i0 = T.reduce((b, p, i) => (Math.abs(p - ref) < Math.abs(T[b] - ref) ? i : b), 0); }
    const offs = shapeOffs(spec.shape || 'up', rhythm.length, T.length);
    const lo = Math.min(...offs), hi = Math.max(...offs); if (hi - lo > T.length - 1) return null;
    i0 = Math.max(-lo, Math.min(T.length - 1 - hi, i0));                       // keep the shape inside the range
    let tt = t; anchor = T[i0 + offs[0]];
    offs.forEach((o, j) => { const p = T[i0 + o], at = place(p, near); if (!at) return; notes.push(N(at[0], at[1], tt, rhythm[j])); near = (near * 2 + at[1]) / 3; last = p; tt += rhythm[j]; });
    used.push(ch.name); t += 4;
  }
  if (notes.length < bars.length * 2) return null;
  const end = notes[notes.length - 1]; end.d = Math.max(end.d, 1); end.x = end.x || '~';
  const tab = spec.slides ? slideMarks(notes) : notes;
  const chordsShown = [...new Set(used)], fill = x => x.replace('{key}', `${nameOf(k0)} minor`).replace('{chords}', used.slice(0, 8).join(' – ')).replace('{shape}', SHAPE_NAME[spec.shape || 'up']);
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'improv', method: spec.method, unit: spec.unit || (spec.rhythm ? 'melody rhythm' : unitName(step)), goal: spec.goal || 96, start: spec.startBpm, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, backing: used, chords: used.length <= 8 ? used : chordsShown.slice(0, 8), tab: { notes: tab }
  });
}
const A_ = (id, name, method, opts) => c => arpMel(c, { id, name, method, ...opts });

/* ------------------------------- Generators ------------------------------- */
/** The app plays a four-note arpeggio fragment; the next bar is silent: echo it (hear it first). */
export function arpEcho(c) {
  const k = minorKey(c), chords = PROGS.vamp(k), r = rng(97 + (c.lvl || 2)), notes = []; let near = 7;
  for (const [bar, nm] of chords.entries()) {
    const T = tonesOf(nm), i0 = 2 + Math.floor(r() * 3), shape = r() < 0.5 ? [0, 1, 2, 3] : [3, 2, 1, 0];
    shape.forEach((o, j) => { const at = place(T[i0 + o], near); if (at) { notes.push(N(at[0], at[1], bar * 8 + j * 0.5, j === 3 ? 2.5 : 0.5)); near = at[1]; } });
  }
  return make(c, {
    id: 'arpm-echo', name: `Hear the arpeggio, then echo it (${chords.slice(0, 2).join(' – ')})`, domain: 'ear', method: 'audiation',
    unit: '8th notes', goal: 80, start: 50, minutes: 4, backing: chords.flatMap(x => [x, x]), chords: chords.flatMap(x => [x, x]),
    why: 'An arpeggio melody is heard as a shape (rising or falling, starting low or high in the chord). Echoing short fragments by ear links that sound to the notes under your fingers.',
    instr: 'Cover the tab. Each chord gets a four-note fragment of its arpeggio, rising or falling; the following bar is silent. In the silence, sing it, then play it back. Check against the tab. Pass: 3 of 4 fragments echoed exactly, twice.',
    watch: 'Guessing the direction from the chord change rather than listening.', simplify: 'Echo only the first two notes.', tab: { notes }
  });
}
/** Random seventh chords, any root and quality, one per bar, in arpeggio 3rds (interleaving). */
export function arpRandom(c) {
  const r = rng(733 + (c.lvl || 9)), types = ['m7', 'maj7', '7', 'm7b5'], chords = [];
  for (let i = 0; i < 8; i++) chords.push(nameOf(Math.floor(r() * 12)) + types[Math.floor(r() * 4)]);
  return arpMel(c, { id: 'arpm-random', name: 'Mixed bars: a new seventh chord every bar, in arpeggio 3rds', method: 'interleaving', chords, shape: 'thirds', step: 0.25, goal: 96, dl: 1,
    why: 'At mastery level any seventh chord should turn into a melodic shape at once, starting from the tone nearest to where your hand already is: unrelated chords, any root and quality, one per bar.',
    instr: 'The chords are {chords}. Start each bar on the chord tone nearest the last note and look one bar ahead. Pass: all 8 bars at the goal tempo.',
    watch: 'Jumping to a root-position shape instead of the nearest tone.', simplify: 'The first four bars, 8th notes.' });
}
/** An original 8-bar study: a singing arpeggio melody, wide leaps, octave displacement and a held landing (capstone). */
export function arpEtude(c) {
  const k = minorKey(c), chords = PROGS.cycle(k), plan = [['thirds', 0.5], ['thirds', 0.5], ['leaps', 1 / 3], ['leaps', 1 / 3], ['displace', 0.25], ['displace', 0.25], ['thirdsDown', 0.25]];
  const notes = []; let last = 64, near = 7;
  for (const [bar, [shape, step]] of plan.entries()) {
    const T = tonesOf(chords[bar]); if (!T) return null; const n = Math.round(4 / step), offs = shapeOffs(shape, n, T.length), lo = Math.min(...offs), hi = Math.max(...offs); if (hi - lo > T.length - 1) return null;
    let i0 = T.reduce((b, p, i) => (Math.abs(p - last) < Math.abs(T[b] - last) ? i : b), 0); i0 = Math.max(-lo, Math.min(T.length - 1 - hi, i0));
    offs.forEach((o, j) => { const at = place(T[i0 + o], near); if (at) { notes.push(N(at[0], at[1], bar * 4 + j * step, step)); near = (near * 2 + at[1]) / 3; last = T[i0 + o]; } });
  }
  const R = tonesOf(chords[7]), land = R.reduce((b, p) => (Math.abs(p - last) < Math.abs(b - last) && mod12(p) === mod12(k) ? p : b), R.find(p => mod12(p) === mod12(k))), at = place(land, near); if (!at) return null;
  notes.push(N(at[0], at[1], 28, 4, '~'));
  return make(c, {
    id: 'arpm-capstone-etude', name: `Capstone study: an 8-bar arpeggio melody through the key (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'mixed rhythms', goal: 92, start: 52, minutes: 8, dl: 1, backing: chords, chords, tab: { notes: slideMarks(notes) },
    why: 'An original piece that uses every shape of the path through all seven chords of the key: singing arpeggio 3rds, wide leaps as triplets, octave displacement in 16ths, a descending run, and a held landing on the root, every note a chord tone.',
    instr: 'Learn it two bars at a time; slide wherever the tab shows it. Bars 1–2 arpeggio 3rds, 3–4 leaps, 5–6 octave displacement, 7 a descent, 8 the landing. Then write your own 8 bars over the same chords with the same plan. Pass: the study at the goal tempo with no stops, then your own version once.',
    watch: 'Neighbouring strings ringing on the leaps: mute with both hands.', simplify: 'Bars 1–4.'
  });
}
function as(gen, over) { return c => { const x = gen(c); if (!x) return null; const out = { ...x, id: over.id, method: over.method, name: over.name ? over.name(x) : x.name }; if (over.goal) { out.goalBpm = goalFor(c, over.goal); out.startBpm = Math.max(30, Math.min(Math.round(out.goalBpm * 0.6), out.goalBpm - 4)); } if (over.instr) out.instr = over.instr; return out; }; }

/* --------------------------------- The path --------------------------------- */
const TN = 'Every note is a tone of the chord of that bar (root, 3rd, 5th, 7th); ';
const PATH = entry({
  id: 'arpMelodies', kind: 'technique', title: 'Arpeggio melodies', domain: 'improv',
  re: /arpeggio melod(y|ies)|melodic arpeggios?|intervallic arpeggios?|arpeggio (shapes|leaps)/,
  aliases: ['melodic arpeggios', 'intervallic arpeggios', 'chord-tone melodies'],
  summary: 'Melodies made only of chord tones: seventh-chord arpeggios taken in 3rds, wide leaps and octave displacement, voice-led across the changes and joined by slides, through vamps, ii–V–Is and the whole key.',
  prereqs: ['pentatonic', 'slides'],
  sources: ['https://jgmusiclessons.com/how-to-use-chord-tones-to-get-better-at-improvising/', 'https://www.premierguitar.com/lessons/style-guide-all-about-arpeggios', 'https://www.premierguitar.com/lessons/fierce-guitar-intervallic-arpeggios', 'https://www.premierguitar.com/lessons/guthrie-govans-erotic-cakes', 'https://www.guitarworld.com/lessons/5-guthrie-govan-guitar-licks'],
  pedagogy: {
    date: '2026-10-18',
    summary: 'Taught as chord-tone playing that becomes melody: learn the tones of each chord (R, 3, 5, 7), target one tone per chord (roots, then 3rds, 5ths and 7ths), play the arpeggios ascending, descending and from different tones, and voice-lead to the nearest tone at each change; then reorder and spread the tones (skips, octave displacement, wide intervals with string skips, often hybrid-picked), add slides and legato so the line sings (Govan), work through progressions and the whole key, and finally write and improvise melodies with them.',
    sequence: [
      { id: 'tones', tier: 'foundations', step: 'The chord tones of one chord, then two', how: 'Root, 3rd, 5th and 7th of each chord, played as an arpeggio up and down in one area of the neck.', skills: ['arpm-tones'], source: 0 },
      { id: 'target', tier: 'foundations', step: 'Target notes and voice leading', how: 'One target per chord (roots, then 3rds); the closest useful chord tone at each change instead of a new area of the neck.', skills: ['arpm-hear'], source: 0 },
      { id: 'reorder', tier: 'foundations', step: 'Reordering the tones; slides and legato', how: 'Arpeggios from different tones and with skipped notes; slides and legato to keep the line smooth.', skills: ['arpm-shape'], source: 1 },
      { id: 'melody', tier: 'foundations', step: 'A chord-tone melody', how: 'Short phrases from the arpeggio over a backing, kept simple rather than run-like.', skills: ['arpm-first-music'], source: 1 },
      { id: 'spread', tier: 'intermediate', step: 'Wide intervals and octave displacement', how: 'The tones spread over two octaves (1–5–10); intervallic patterns with string skips.', skills: ['arpm-shapes'], source: 2 },
      { id: 'prog', tier: 'intermediate', step: 'Through progressions and keys', how: 'Arpeggios over each chord of a progression (ii–V–I, i–♭VI–♭VII), pivoting on common tones; the shapes in other keys.', skills: ['arpm-voice-leading'], source: 1 },
      { id: 'third', tier: 'intermediate', step: 'Landing on the 3rd; sliding lines', how: 'Every chord entered on its 3rd; slides and legato inside faster lines.', skills: ['arpm-control'], source: 0 },
      { id: 'phrase', tier: 'intermediate', step: 'Phrases over a progression', how: 'Melodies with leaps, rests and rhythm over the changes.', skills: ['arpm-music'], source: 0 },
      { id: 'key', tier: 'advanced', step: 'The whole key', how: 'Every diatonic seventh chord of the key in sequence, each shape played twice before the next chord, up and down the neck.', skills: ['arpm-cycle', 'arpm-minor-iiv'], source: 2 },
      { id: 'shape', tier: 'advanced', step: 'Shaping intervallic lines', how: 'Accented top notes, the patterns in several keys at double speed.', skills: ['arpm-adv-sound'], source: 2 },
      { id: 'tune', tier: 'advanced', step: 'Arpeggio melodies in a tune', how: 'Melodic arpeggio lines through the key with slides and string skips, as in Govan’s tunes.', skills: ['arpm-adv-music'], source: 3 },
      { id: 'tempo', tier: 'mastery', step: 'Performance tempo and any chord', how: 'The shapes at speed; any seventh chord outlined at once.', skills: ['arpm-performance', 'arpm-random-access'], source: 2 },
      { id: 'own', tier: 'mastery', step: 'Your own arpeggio melody', how: 'Write and improvise melodies with the shapes over a vamp and through the key.', skills: ['arpm-voice'], source: 3 }
    ],
    drills: ['Arpeggios of one chord, then two, up and down from the root', 'Target notes: one chord tone per chord (roots, then 3rds, 5ths, 7ths)', 'Voice leading to the nearest chord tone at each change', 'Arpeggios started on different tones and with skips', 'Octave-displaced and intervallic arpeggio patterns with string skips', 'Each shape twice, then the next chord of the key, up and down the neck', 'Arpeggio melodies with slides and legato'],
    mistakes: ['Jumping to a new area of the neck (or the root) at every chord', 'Running arpeggios as exercises instead of shaping phrases', 'Losing your place in the progression while finding a note', 'Skipped strings ringing on wide intervals', 'Filling every beat instead of letting the target note land'],
    sources: [
      { title: 'How to Confidently Solo Over Chord Progressions with Chord Tones', author: 'JG Music Lessons', url: 'https://jgmusiclessons.com/how-to-use-chord-tones-to-get-better-at-improvising/' },
      { title: 'Style Guide: All About Arpeggios', author: 'Marc Schonbrun (Premier Guitar)', url: 'https://www.premierguitar.com/lessons/style-guide-all-about-arpeggios' },
      { title: 'Fierce Guitar: Intervallic Arpeggios', author: 'Dave Martone (Premier Guitar)', url: 'https://www.premierguitar.com/lessons/fierce-guitar-intervallic-arpeggios' },
      { title: 'Guthrie Govan’s Erotic Cakes (style lesson)', author: 'Sam Bell (Premier Guitar)', url: 'https://www.premierguitar.com/lessons/guthrie-govans-erotic-cakes' },
      { title: '5 mind-blowing Guthrie Govan licks you need to learn', author: 'Charlie Griffiths (Guitar World)', url: 'https://www.guitarworld.com/lessons/5-guthrie-govan-guitar-licks' }
    ]
  },
  ctx: { key: 7, minor: true, prog: 'dorianVamp' },
  stages: [
    stage('foundations', 'Chord tones as melody',
      'Play the m7 and 9 chords of a Dorian vamp up and down in 8ths at 90 BPM, land on each chord’s 3rd on beat 1, start each chord on the tone nearest the last one, play the vamp in arpeggio 3rds with slides that sing, and play a slow chord-tone melody over the vamp.', [
        S('arpm-tones', 'The chord tones', 'theory', 'One chord, then two.', [
          A_('arpm-one', 'One chord, up and back: {chords} ({key})', 'chunking', { prog: 'one', shape: 'updown', start: 'root', step: 1, goal: 80, startBpm: 50, why: 'An arpeggio melody starts with knowing every tone of one chord in one area of the neck. Up and back on a single minor-7th chord, slowly, is that map and nothing else.', instr: TN + 'here the root, ♭3, 5 and ♭7 of one chord, up and back in quarter notes, four bars. Pass: four bars with every note clean, twice.', watch: 'Letting notes ring together like a chord.', simplify: 'Two bars.' }),
          A_('arpm-names', 'Two chords: {chords}, up from the root', 'chunking', { prog: 'vamp', shape: 'up', start: 'root', step: 0.5, goal: 88, startBpm: 50, why: 'The two chords of the vamp share some tones and differ in others: the 9 chord brings the bright major 3rd and the 9th (the 6th of the key). Playing each arpeggio up from its root, chord by chord, makes the change of colour audible.', instr: TN + 'm7 tones R, ♭3, 5, ♭7; 9-chord tones R, 3, 5, ♭7, 9. Play up from the root of each chord in 8ths. Pass: four bars clean, twice.', watch: 'Calling the 9 chord’s 3rd a ♭3.', simplify: 'Quarter notes.' })]),
        S('arpm-hear', 'Target and land it', 'improv', 'The 3rd on beat 1; the nearest tone.', [
          A_('arpm-target', 'Target notes: each chord’s 3rd on beat 1 ({chords})', 'accurate-reps', { prog: 'vamp', shape: 'up', start: 'third', rhythm: [3, 1], goal: 80, startBpm: 50, why: 'Chord-tone soloing starts with one target per chord: the note you land on as the chord arrives. The 3rd is the tone that tells major from minor, so landing on it makes every change audible.', instr: TN + 'on beat 1 of each bar land on the 3rd of the new chord (the one nearest your last note) and hold it, then step to the next chord tone up. Pass: 8 bars with every 3rd landing on the beat.', watch: 'Landing on the root out of habit.', simplify: 'The 3rd only, one note per bar.' }),
          A_('arpm-landing', 'Down to the nearest tone: {chords}', 'accurate-reps', { prog: 'vamp', shape: 'down', step: 0.5, goal: 88, startBpm: 50, why: 'Voice leading is the habit of starting each chord on its tone nearest the last note. It is what turns a string of arpeggios into one melody that moves smoothly through the changes.', instr: TN + 'each bar starts on the tone of the new chord closest to where the last bar started, then falls through the arpeggio, so the melody stays in one register. Count only clean bars. Pass: 8 clean bars in a row.', watch: 'Jumping back to the root at every chord change.', simplify: 'Two bars.' })]),
        S('arpm-shape', 'The first melodic shape', 'improv', 'Arpeggio 3rds, and slides that make them sing.', [
          A_('arpm-thirds-slow', 'Arpeggio 3rds over the vamp: {chords}', 'variable', { prog: 'vamp', shape: 'thirds', step: 0.5, goal: 92, startBpm: 50, why: 'Taking the chord tones two at a time, skipping one (1–3, 2–4, 3–5…), turns an exercise into a tune: wider intervals, a clear direction, and every note still a chord tone.', instr: TN + 'take them in “arpeggio 3rds”: skip one, step back, skip one. Each bar starts on the nearest tone. Pass: four bars clean twice.', watch: 'Losing the skip-back pattern at the chord change.', simplify: 'Quarter notes.' }),
          A_('arpm-sing', 'Make it sing: four-note cells with slides ({chords})', 'external-focus', { prog: 'vamp', shape: 'cell4', step: 0.5, slides: true, goal: 88, startBpm: 50, why: 'Where two neighbouring tones fall on the same string, a slide instead of a pick makes the line vocal. The goal is a sound: one connected melody, not separate notes.', instr: TN + 'play the four-note cells, sliding wherever the tab shows / or \\. Listen for one connected line with no gaps and no extra notes ringing. Pass: four bars that sound like one sung phrase, twice.', watch: 'Picking the slid notes again.', simplify: 'Pick every note.' })]),
        S('arpm-first-music', 'First music', 'improv', 'A slow chord-tone melody, then your own.', [
          A_('arpm-melody', 'A chord-tone melody over {chords}', 'transfer', { prog: 'vamp', shape: 'thirds', rhythm: [1.5, 1.5, 1], slides: true, goal: 84, startBpm: 50, why: 'With a melodic rhythm (two long notes and a short one per bar) the same chord tones become a tune you could sing over the vamp.', instr: TN + 'play the melody, letting the long notes ring, then improvise your own using only chord tones and the same rhythm. Pass: the melody twice in time, then four bars of your own.', watch: 'Rushing the long notes.', simplify: 'Whole notes on the nearest tone of each chord.' }),
          c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Solo over a Dorian vamp: start every phrase on a chord tone' })])
      ], [1, 3]),
    stage('intermediate', 'Shapes across the changes',
      'Play 3rds, wide leaps and octave displacement over the vamp in 8ths at 100 BPM, voice-lead through i–♭VI–♭VII and a major ii–V–I, play the vamp in four keys, slide inside triplet lines, start every bar from the 3rd, and phrase over a progression with chord tones.', [
        S('arpm-shapes', 'Three shapes', 'improv', '3rds, leaps and octave displacement.', [
          A_('arpm-thirds', 'Arpeggio 3rds in 8ths: {chords}', 'variable', { prog: 'vamp', shape: 'thirds', step: 0.5, goal: 104, why: 'The 3rds shape at tempo over both chords of the vamp: the backbone of arpeggio melodies.', instr: TN + 'arpeggio 3rds, voice-led. Pass: four bars clean at the goal tempo.', watch: 'The 9 chord’s extra tone throwing off the pattern.', simplify: 'Quarter notes.' }),
          A_('arpm-leaps', 'Wide leaps: {chords} {shape}', 'variable', { prog: 'vamp', shape: 'leaps', step: 0.5, goal: 96, why: 'Pairing each tone with the tone three places above it (a 6th or 7th away) gives the angular, intervallic sound of fusion melodies, still entirely chord tones.', instr: TN + 'alternate a low tone with one three places higher, moving up a tone each pair. Mute the strings you skip. Pass: four bars clean at the goal tempo.', watch: 'The skipped strings ringing.', simplify: 'Quarter notes.' }),
          A_('arpm-displace', 'Octave displacement: {chords}', 'variable', { prog: 'vamp', shape: 'displace', step: 0.5, goal: 92, why: 'Every other tone jumps up an octave: the arpeggio in order, but spread over two octaves, so the melody hops between two registers.', instr: TN + 'play up the arpeggio, putting every second note an octave higher. Pass: four bars clean at the goal tempo.', watch: 'Reaching for the octave late.', simplify: 'Quarter notes.' })]),
        S('arpm-voice-leading', 'Voice leading through progressions', 'improv', 'New chords, new keys, the nearest tone each time.', [
          A_('arpm-rock7', 'Voice-led arpeggios through {chords}', 'variable', { prog: 'rock7', shape: 'up', step: 0.5, goal: 100, why: 'i–♭VI–♭VII–i as seventh chords: four different qualities (m7, maj7, 7). Starting each on its nearest tone keeps the melody in one area while the colours change.', instr: TN + 'each bar starts on the new chord’s nearest tone and climbs. Look ahead to the next chord’s type on beat 4. Pass: four bars clean at the goal tempo.', watch: 'The maj7: its 7th is a half step below the root.', simplify: 'Two chords.' }),
          A_('arpm-major-iiv', 'Arpeggio 3rds through a major ii–V–I: {chords}', 'variable', { prog: 'majorIIV', shape: 'thirds', step: 0.5, goal: 100, why: 'The ii–V–I is the most common progression in jazz and fusion. Its three chords (m7, 7, maj7) move by small steps, so voice-led 3rds glide through them.', instr: TN + 'arpeggio 3rds, the nearest tone each bar. Pass: four bars clean at the goal tempo.', watch: 'The V7: its 3rd is the leading tone into the I chord.', simplify: 'Quarter notes.' }),
          A_('arpm-keys', 'The vamp in four keys around the cycle of fourths', 'interleaving', { prog: 'one', keys: [0, 5, 10, 3], shape: 'thirds', step: 0.5, goal: 96, dl: 1, why: 'Arpeggios are built from the chord, so they work in any key. Changing key every four bars trains finding the nearest chord tone in a new key instantly.', instr: TN + 'four bars per key, each a new minor-7th chord a 4th up. Pass: all four keys without stopping.', watch: 'Stopping at the key change.', simplify: 'Two keys.' })]),
        S('arpm-control', 'Slides and the 3rd', 'improv', 'Triplet lines that slide; every bar from the 3rd.', [
          A_('arpm-slides', 'Sliding arpeggio 3rds as triplets: {chords}', 'external-focus', { prog: 'vamp', shape: 'thirds', step: 1 / 3, slides: true, goal: 96, why: 'In triplets the slides come faster and must still sound like legato, not smears. Listening for even, connected notes is the test.', instr: TN + 'play as triplets, sliding wherever the tab shows it. Record a pass: every note should be equally clear. Pass: a recorded pass with no smeared or missing notes.', watch: 'Slides that arrive late and push the triplet.', simplify: '8th notes.' }),
          A_('arpm-from-third', 'Start every bar on the 3rd: {chords}', 'variable', { prog: 'rock7', shape: 'up', start: 'third', step: 0.5, goal: 96, why: 'The 3rd defines the chord’s quality; starting each bar on it makes the change audible at once. Through four chord qualities (m7, maj7, 7) the 3rd moves by small steps, so the line stays in one area.', instr: TN + 'each bar starts on the chord’s 3rd (nearest to the last note) and climbs. Pass: four bars clean at the goal tempo.', watch: 'Starting on the root out of habit.', simplify: 'Only the first two chords.' })]),
        S('arpm-music', 'In music', 'improv', 'A melody over a progression, and a solo.', [
          A_('arpm-melody-rock7', 'A chord-tone melody with leaps over {chords}', 'transfer', { prog: 'rock7', shape: 'leaps', rhythm: [1, 0.5, 0.5, 1, 1], slides: true, goal: 92, why: 'Leaps in a melodic rhythm make a tune with real contour over the changes.', instr: TN + 'play the melody, then improvise your own over the backing with leaps and slides. Pass: the melody twice, then four bars of your own.', watch: 'Rushing the 8th-note pairs.', simplify: 'The long notes only.' }),
          c => targetGuide(c, { prog: 'progMinor', scale: 'minor', name: 'Solo over i–♭VI–♭III–♭VII: arpeggio phrases landing on chord tones' })])
      ], [4, 6]),
    stage('advanced', 'The whole key, fast and wide',
      'Play all seven seventh chords of the key in arpeggio 3rds in 16ths at 100 BPM and in leaps as triplets, a minor ii–V–i, every chord type of the key up its arpeggio, melodies with the top note accented, the vamp in four keys in 16ths, and phrase through the key with chord tones.', [
        S('arpm-cycle', 'Through the key', 'improv', 'All seven chords, two shapes.', [
          A_('arpm-cycle', 'All seven chords of {key} in arpeggio 3rds: {chords}', 'variable', { prog: 'cycle', shape: 'thirds', step: 0.25, goal: 96, why: 'The seventh chords of the key, in the cycle i–iv–♭VII–♭III–♭VI–ii°–V–i, are the harmony of countless rock and fusion tunes. Voice-led 3rds through all of them are a complete chord-tone vocabulary.', instr: TN + 'one chord per bar, arpeggio 3rds in 16ths, nearest tone each bar. Pass: all eight bars clean at the goal tempo.', watch: 'The m7♭5 (ii°): its 5th is flat.', simplify: '8th notes.' }),
          A_('arpm-cycle-leaps', 'Leaps through the key as triplets: {chords}', 'variable', { prog: 'cycle', shape: 'leaps', step: 1 / 3, goal: 92, why: 'The same seven chords in wide leaps: an angular, modern sound across the whole key.', instr: TN + 'leaps (a tone, then the tone three above) as triplets. Pass: all eight bars clean at the goal tempo.', watch: 'Rushing the big intervals.', simplify: '8th notes.' })]),
        S('arpm-minor-iiv', 'Minor ii–V–i and the chord types', 'improv', 'The minor cadence; every chord type of the key.', [
          A_('arpm-minor-iiv', 'Arpeggio 3rds through a minor ii–V–i: {chords}', 'variable', { prog: 'minorIIV', shape: 'thirds', step: 0.25, goal: 96, why: 'The minor ii–V–i (m7♭5, 7, m7) is darker: the V7 borrows the raised 7th of the harmonic minor. Arpeggios make that leading tone sing into the i chord.', instr: TN + '16ths, nearest tone each bar. Pass: four bars clean at the goal tempo.', watch: 'The V7’s 3rd, a half step below the i chord’s root.', simplify: '8th notes.' }),
          A_('arpm-cycle-recall', 'The seven chord types of {key}, up each arpeggio', 'variable', { prog: 'cycle', shape: 'up', step: 0.5, goal: 96, why: 'Each diatonic chord has its own quality (m7, m7, 7, maj7, maj7, m7♭5, 7, m7). Climbing every one from its nearest tone lays out the whole key as arpeggios in one area of the neck.', instr: TN + 'one bar per chord, climbing from the nearest tone. Pass: all eight bars clean, twice.', watch: 'Treating the ♭VII7 as a maj7.', simplify: 'The first four chords.' })]),
        S('arpm-adv-sound', 'Shape the line', 'improv', 'Accents on top, and keys at speed.', [
          A_('arpm-top-melody', 'The melody on top: leaps with the high notes accented ({chords})', 'external-focus', { prog: 'vamp', shape: 'leaps', step: 0.25, goal: 96, why: 'In a leaping line the high notes form a melody of their own. Accenting them (and keeping the low notes light) makes the listener hear a tune over an accompaniment, from one guitar.', instr: TN + 'play the leaps in 16ths, accenting every upper note and playing the lower ones softly. Listen for the upper melody. Pass: four bars where the top line is clearly audible, twice.', watch: 'Every note the same volume.', simplify: '8th notes.' }),
          A_('arpm-keys-fast', 'Leaps in four keys, 16ths', 'interleaving', { prog: 'one', keys: [0, 7, 2, 9], shape: 'leaps', step: 0.25, goal: 92, dl: 1, why: 'Four keys a 5th apart, a new minor-7th chord every four bars, at speed: finding the leaping shape in any key without stopping.', instr: TN + 'four bars per key. Pass: all four keys without stopping at the goal tempo.', watch: 'Losing the leap pattern at the key change.', simplify: '8th notes.' })]),
        S('arpm-adv-music', 'In music', 'improv', 'A melody through the key, and a solo.', [
          A_('arpm-melody-cycle', 'A chord-tone melody through the key: {chords}', 'transfer', { prog: 'cycle', shape: 'displace', rhythm: [0.5, 0.5, 1, 0.5, 0.5, 1], slides: true, goal: 92, why: 'A melody through all seven chords with octave displacement and slides: the kind of through-composed arpeggio tune that defines fusion writing.', instr: TN + 'play the melody, then improvise your own over the same chords. Pass: the melody twice, then eight bars of your own.', watch: 'Losing the chord order: look ahead to the next chord on beat 4.', simplify: 'The quarter notes only.' }),
          c => targetGuide(c, { prog: 'iiVIminor', scale: 'harmonicMinor', name: 'Minor ii–V–i solo: arpeggio phrases, the V chord’s 3rd into the i' })])
      ], [7, 8]),
    stage('mastery', 'Fluent, fast and your own',
      'Play the key’s seven chords in arpeggio 3rds as sextuplets at about 100 BPM and the vamp in leaps in 16ths at 110, any seventh chord on demand, and perform your own 8-bar arpeggio melody.', [
        S('arpm-performance', 'Performance tempo', 'improv', 'The shapes at speed.', [
          as(A_('arpm-cycle-x', '', 'edge', { prog: 'cycle', shape: 'thirds', step: 1 / 6, goal: 92, why: 'The seven chords of the key in arpeggio 3rds, two notes per beat… six: the full-speed fusion run, every note a chord tone.', instr: TN + 'sextuplets, nearest tone each bar. Tempo ladder: add a few BPM after each clean pass. Pass: all eight bars at the goal tempo.', watch: 'Forearm tension.', simplify: '16ths.' }), { id: 'arpm-cycle-fast', method: 'edge', name: x => `All seven chords in arpeggio 3rds at performance tempo (${x.chords.slice(0, 3).join(' – ')} …)` }),
          A_('arpm-leaps-fast', 'Wide leaps at performance tempo: {chords}', 'edge', { prog: 'vamp', shape: 'leaps', step: 0.25, goal: 104, why: 'The angular leaping line at tempo over the vamp: the hardest shape to keep clean at speed.', instr: TN + '16ths, tempo ladder to the goal. Pass: four bars clean at the goal tempo.', watch: 'Skipped strings ringing at speed.', simplify: '8th notes.' })]),
        S('arpm-random-access', 'Any chord, any time', 'improv', 'A new seventh chord every bar.', [c => arpRandom(c), c => targetGuide(c, { prog: 'andalusian', scale: 'harmonicMinor', name: 'Andalusian cadence: an arpeggio melody through i–♭VII–♭VI–V' })]),
        S('arpm-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => arpEtude(c), c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp: your own arpeggio melody, then a solo built on it' })])
      ], [9, 10])
  ]
});
const ST = (concept, why, theory) => ({ concept, why, theory });
const STUDY = {
  'arpm-tones': ST('An arpeggio is a chord played one note at a time. A seventh chord has four tones (root, 3rd, 5th, 7th); a 9 chord adds the 9th.', 'An arpeggio melody uses only these tones, so every note fits the chord of the moment.', ['m7: R ♭3 5 ♭7; dominant 7: R 3 5 ♭7; maj7: R 3 5 7; m7♭5: R ♭3 ♭5 ♭7.', 'In a Dorian vamp the IV9 chord brings the major 3rd of its own root (the 6th of the key).']),
  'arpm-hear': ST('A target note is the chord tone you land on as the chord arrives. Voice leading picks the tone nearest the last note instead of jumping back to the root.', 'Target notes and voice leading are what make a line follow the changes smoothly.', ['The 3rd shows whether a chord is major or minor.', 'Neighbouring chords often share tones: hold or move by a step.']),
  'arpm-shape': ST('Arpeggio tones need not be played in order: taking them two at a time, skipping one (arpeggio 3rds), gives a melody with wider intervals and a clear direction.', 'Reordering the tones turns an exercise into a tune; slides between neighbours on one string make it vocal.', ['Arpeggio 3rds: 1–3, 2–4, 3–5 … of the tone list.', 'Slide only between notes on the same string.']),
  'arpm-first-music': ST('With a melodic rhythm (long and short notes) chord tones become a melody over the vamp.', 'This is how arpeggio melodies are used in tunes, not as runs.', ['Let the long notes ring.', 'Start each phrase on a chord tone.']),
  'arpm-shapes': ST('Wide leaps pair a tone with one three places higher; octave displacement moves every other tone up an octave.', 'They give the angular, intervallic sound of fusion melodies while every note stays a chord tone.', ['Leaps often need a string skip: mute the skipped string.', '1–3–5 spread out becomes 1–5–10.']),
  'arpm-voice-leading': ST('Through a progression each chord starts on its tone nearest the last note; in a new key the same shapes move.', 'Voice leading keeps the melody in one register while the harmony changes.', ['In a ii–V–I the 7th of one chord falls a half step to the 3rd of the next.', 'Arpeggios are built from the chord, so they work in any key.']),
  'arpm-control': ST('Triplet lines with slides, and every bar started on the chord’s 3rd.', 'Starting on the 3rd makes each chord change heard at once.', ['A maj7’s 7th sits a half step below the root.', 'Slides must keep the triplet even.']),
  'arpm-music': ST('A melody with leaps over a progression, then your own.', 'Leaps in a melodic rhythm give a line real contour.', ['Rest between phrases.', 'Land long notes on 3rds and 7ths.']),
  'arpm-cycle': ST('The seven seventh chords of a minor key, in the cycle i–iv–♭VII–♭III–♭VI–ii°–V–i, as arpeggio 3rds and leaps.', 'Arpeggios through the whole key are a complete chord-tone vocabulary for a tune.', ['The ii° is m7♭5: its 5th is flat.', 'The V is a dominant 7 borrowed from harmonic minor.']),
  'arpm-minor-iiv': ST('The minor ii–V–i (m7♭5, 7, m7) and every chord type of the key.', 'The V7’s 3rd is the leading tone that resolves up a half step to the root of i.', ['m7♭5 tones: R ♭3 ♭5 ♭7.', 'Natural-minor chords: i m7, ii m7♭5, ♭III maj7, iv m7, v m7, ♭VI maj7, ♭VII 7.']),
  'arpm-adv-sound': ST('In a leaping line the high notes form a melody of their own; accenting them makes one guitar sound like melody and accompaniment.', 'Shaping dynamics is what makes intervallic lines musical rather than mechanical.', ['Accent the upper notes, play the lower ones light.', 'A shape keeps its intervals in every key.']),
  'arpm-adv-music': ST('A through-composed melody across the whole key with octave displacement and slides.', 'This is the kind of arpeggio tune fusion writing is built on.', ['Look ahead to the next chord.', 'Keep the melody singable.']),
  'arpm-performance': ST('The arpeggio shapes at performance tempo.', 'At speed the shapes become runs that still outline every chord.', ['Raise the tempo after a clean pass.', 'Mute skipped strings with both hands.']),
  'arpm-random-access': ST('Unrelated seventh chords, any root and quality, one per bar.', 'Any chord in a tune should turn into a melodic shape at once.', ['Start on the nearest tone.', 'Know the four seventh-chord formulas.']),
  'arpm-voice': ST('The capstone study uses every shape of the path through the key; then you write your own.', 'A technique becomes yours when you compose with it.', ['Learn it two bars at a time.', 'Keep every note a chord tone.'])
};
for (const st of PATH.stages) for (const sk of st.skills) if (STUDY[sk.id]) sk.study = STUDY[sk.id];
export default PATH;
