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
  return arpMel(c, { id: 'arpm-random', name: 'Random access: a new seventh chord every bar, in arpeggio 3rds', method: 'interleaving', chords, shape: 'thirds', step: 0.25, goal: 96, dl: 1,
    why: 'At mastery level any seventh chord should turn into a melodic shape the moment you read its name, starting from the tone nearest to where your hand already is.',
    instr: 'The chords are {chords}. Read only the names; start each bar on the chord tone nearest the last note. Cover the tab after the first pass. Pass: all 8 bars from the names alone at the goal tempo.',
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
export default entry({
  id: 'arpMelodies', kind: 'technique', title: 'Arpeggio melodies', domain: 'improv',
  re: /arpeggio melod(y|ies)|melodic arpeggios?|intervallic arpeggios?|arpeggio (shapes|leaps)/,
  aliases: ['melodic arpeggios', 'intervallic arpeggios', 'chord-tone melodies'],
  summary: 'Melodies made only of chord tones: seventh-chord arpeggios taken in 3rds, wide leaps and octave displacement, voice-led across the changes and joined by slides, through vamps, ii–V–Is and the whole key.',
  prereqs: ['pentatonic', 'slides'],
  sources: ['https://www.premierguitar.com/lessons/guthrie-govans-erotic-cakes', 'https://www.premierguitar.com/lessons/fierce-guitar-intervallic-arpeggios', 'https://www.premierguitar.com/lessons/guthrie-govans-single-string-arpeggios', 'https://www.guitarworld.com/lessons/5-guthrie-govan-guitar-licks', 'https://guitarworld.com/lessons/introduction-effective-use-melody-part-2'],
  ctx: { key: 7, minor: true, prog: 'dorianVamp' },
  stages: [
    stage('foundations', 'Chord tones as melody',
      'Play the m7 and 9 chords of a Dorian vamp up and down in 8ths at 90 BPM naming every chord tone, echo arpeggio fragments by ear, land each chord on the tone nearest the last one, play the vamp in arpeggio 3rds with slides that sing, and play a slow chord-tone melody over the vamp.', [
        S('arpm-tones', 'The chord tones', 'theory', 'One chord, then two, named as you play.', [
          A_('arpm-one', 'One chord, up and back: {chords} ({key})', 'chunking', { prog: 'one', shape: 'updown', start: 'root', step: 1, goal: 80, startBpm: 50, why: 'An arpeggio melody starts with knowing every tone of one chord in one area of the neck. Up and back on a single minor-7th chord, slowly, is that map and nothing else.', instr: TN + 'here the root, ♭3, 5 and ♭7 of one chord, up and back in quarter notes, four bars. Pass: four bars with every note clean, twice, then once with the tab covered.', watch: 'Letting notes ring together like a chord.', simplify: 'Two bars.' }),
          A_('arpm-names', 'Name the tones: {chords}, up the arpeggio', 'retrieval', { prog: 'vamp', shape: 'up', start: 'root', step: 0.5, goal: 88, startBpm: 50, why: 'The two chords of the vamp share some tones and differ in others (the 9 chord brings the bright 3rd and 6th of the key). Saying each tone’s name as you play it makes you hear the chord, not a shape.', instr: TN + 'say each one’s name (R, ♭3, 5, ♭7 / R, 3, 5, ♭7, 9) as you play up from the root. After one pass, cover the tab. Pass: four bars from memory with every name right.', watch: 'Calling the 9 chord’s 3rd a ♭3.', simplify: 'Quarter notes.' })]),
        S('arpm-hear', 'Hear it and land it', 'ear', 'Echo fragments; land on the nearest tone.', [c => arpEcho(c),
          A_('arpm-landing', 'Down to the nearest tone: {chords}', 'accurate-reps', { prog: 'vamp', shape: 'down', step: 0.5, goal: 88, startBpm: 50, why: 'Voice leading is the habit of starting each chord on its tone nearest the last note. It is what turns a string of arpeggios into one melody that moves smoothly through the changes.', instr: TN + 'each bar starts on the tone of the new chord closest to where the last bar started, then falls through the arpeggio, so the melody stays in one register. Count only clean bars. Pass: 8 clean bars in a row.', watch: 'Jumping back to the root at every chord change.', simplify: 'Two bars.' })]),
        S('arpm-shape', 'The first melodic shape', 'improv', 'Arpeggio 3rds, and slides that make them sing.', [
          A_('arpm-thirds-slow', 'Arpeggio 3rds over the vamp: {chords}', 'variable', { prog: 'vamp', shape: 'thirds', step: 0.5, goal: 92, startBpm: 50, why: 'Taking the chord tones two at a time, skipping one (1–3, 2–4, 3–5…), turns an exercise into a tune: wider intervals, a clear direction, and every note still a chord tone.', instr: TN + 'take them in “arpeggio 3rds”: skip one, step back, skip one. Each bar starts on the nearest tone. Pass: four bars clean twice.', watch: 'Losing the skip-back pattern at the chord change.', simplify: 'Quarter notes.' }),
          A_('arpm-sing', 'Make it sing: four-note cells with slides ({chords})', 'external-focus', { prog: 'vamp', shape: 'cell4', step: 0.5, slides: true, goal: 88, startBpm: 50, why: 'Where two neighbouring tones fall on the same string, a slide instead of a pick makes the line vocal. The goal is a sound: one connected melody, not separate notes.', instr: TN + 'play the four-note cells, sliding wherever the tab shows / or \\. Listen for one connected line with no gaps and no extra notes ringing. Pass: four bars that sound like one sung phrase, twice.', watch: 'Picking the slid notes again.', simplify: 'Pick every note.' })]),
        S('arpm-first-music', 'First music', 'improv', 'A slow chord-tone melody, then your own.', [
          A_('arpm-melody', 'A chord-tone melody over {chords}', 'transfer', { prog: 'vamp', shape: 'thirds', rhythm: [1.5, 1.5, 1], slides: true, goal: 84, startBpm: 50, why: 'With a melodic rhythm (two long notes and a short one per bar) the same chord tones become a tune you could sing over the vamp.', instr: TN + 'play the melody, letting the long notes ring, then improvise your own using only chord tones and the same rhythm. Pass: the melody twice in time, then four bars of your own.', watch: 'Rushing the long notes.', simplify: 'Whole notes on the nearest tone of each chord.' }),
          c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Solo over a Dorian vamp: start every phrase on a chord tone' })])
      ], [1, 3]),
    stage('intermediate', 'Shapes across the changes',
      'Play 3rds, wide leaps and octave displacement over the vamp in 8ths at 100 BPM, voice-lead through i–♭VI–♭VII and a major ii–V–I, play the vamp in four keys, slide inside triplet lines, start every bar from the 3rd from memory, and phrase over a progression with chord tones.', [
        S('arpm-shapes', 'Three shapes', 'improv', '3rds, leaps and octave displacement.', [
          A_('arpm-thirds', 'Arpeggio 3rds in 8ths: {chords}', 'variable', { prog: 'vamp', shape: 'thirds', step: 0.5, goal: 104, why: 'The 3rds shape at tempo over both chords of the vamp: the backbone of arpeggio melodies.', instr: TN + 'arpeggio 3rds, voice-led. Pass: four bars clean at the goal tempo.', watch: 'The 9 chord’s extra tone throwing off the pattern.', simplify: 'Quarter notes.' }),
          A_('arpm-leaps', 'Wide leaps: {chords} {shape}', 'variable', { prog: 'vamp', shape: 'leaps', step: 0.5, goal: 96, why: 'Pairing each tone with the tone three places above it (a 6th or 7th away) gives the angular, intervallic sound of fusion melodies, still entirely chord tones.', instr: TN + 'alternate a low tone with one three places higher, moving up a tone each pair. Mute the strings you skip. Pass: four bars clean at the goal tempo.', watch: 'The skipped strings ringing.', simplify: 'Quarter notes.' }),
          A_('arpm-displace', 'Octave displacement: {chords}', 'variable', { prog: 'vamp', shape: 'displace', step: 0.5, goal: 92, why: 'Every other tone jumps up an octave: the arpeggio in order, but spread over two octaves, so the melody hops between two registers.', instr: TN + 'play up the arpeggio, putting every second note an octave higher. Pass: four bars clean at the goal tempo.', watch: 'Reaching for the octave late.', simplify: 'Quarter notes.' })]),
        S('arpm-voice-leading', 'Voice leading through progressions', 'improv', 'New chords, new keys, the nearest tone each time.', [
          A_('arpm-rock7', 'Voice-led arpeggios through {chords}', 'variable', { prog: 'rock7', shape: 'up', step: 0.5, goal: 100, why: 'i–♭VI–♭VII–i as seventh chords: four different qualities (m7, maj7, 7). Starting each on its nearest tone keeps the melody in one area while the colours change.', instr: TN + 'each bar starts on the new chord’s nearest tone and climbs. Say the chord type on beat 4 of the bar before. Pass: four bars clean at the goal tempo.', watch: 'The maj7: its 7th is a half step below the root.', simplify: 'Two chords.' }),
          A_('arpm-major-iiv', 'Arpeggio 3rds through a major ii–V–I: {chords}', 'variable', { prog: 'majorIIV', shape: 'thirds', step: 0.5, goal: 100, why: 'The ii–V–I is the most common progression in jazz and fusion. Its three chords (m7, 7, maj7) move by small steps, so voice-led 3rds glide through them.', instr: TN + 'arpeggio 3rds, the nearest tone each bar. Pass: four bars clean at the goal tempo.', watch: 'The V7: its 3rd is the leading tone into the I chord.', simplify: 'Quarter notes.' }),
          A_('arpm-keys', 'The vamp in four keys around the cycle of fourths', 'interleaving', { prog: 'one', keys: [0, 5, 10, 3], shape: 'thirds', step: 0.5, goal: 96, dl: 1, why: 'Arpeggios are built from the chord, so they work in any key. Changing key every four bars trains finding the nearest chord tone in a new key instantly.', instr: TN + 'four bars per key, each a new minor-7th chord a 4th up. Name each new chord before it starts. Pass: all four keys without stopping.', watch: 'Stopping at the key change.', simplify: 'Two keys.' })]),
        S('arpm-control', 'Slides and recall', 'improv', 'Triplet lines that slide; every bar from the 3rd.', [
          A_('arpm-slides', 'Sliding arpeggio 3rds as triplets: {chords}', 'external-focus', { prog: 'vamp', shape: 'thirds', step: 1 / 3, slides: true, goal: 96, why: 'In triplets the slides come faster and must still sound like legato, not smears. Listening for even, connected notes is the test.', instr: TN + 'play as triplets, sliding wherever the tab shows it. Record a pass: every note should be equally clear. Pass: a recorded pass with no smeared or missing notes.', watch: 'Slides that arrive late and push the triplet.', simplify: '8th notes.' }),
          A_('arpm-from-third', 'From memory: start every bar on the 3rd ({chords})', 'retrieval', { prog: 'rock7', shape: 'up', start: 'third', step: 0.5, goal: 96, why: 'The 3rd defines the chord’s quality; starting each bar on it makes the change audible at once. Finding it from memory for each chord is the core skill of chord-tone soloing.', instr: TN + 'each bar starts on the chord’s 3rd (nearest to the last note) and climbs. After one pass, cover the tab and say the 3rd’s note name before each bar. Pass: four bars from memory.', watch: 'Starting on the root out of habit.', simplify: 'Only the first two chords.' })]),
        S('arpm-music', 'In music', 'improv', 'A melody over a progression, and a solo.', [
          A_('arpm-melody-rock7', 'A chord-tone melody with leaps over {chords}', 'transfer', { prog: 'rock7', shape: 'leaps', rhythm: [1, 0.5, 0.5, 1, 1], slides: true, goal: 92, why: 'Leaps in a melodic rhythm make a tune with real contour over the changes.', instr: TN + 'play the melody, then improvise your own over the backing with leaps and slides. Pass: the melody twice, then four bars of your own.', watch: 'Rushing the 8th-note pairs.', simplify: 'The long notes only.' }),
          c => targetGuide(c, { prog: 'progMinor', scale: 'minor', name: 'Solo over i–♭VI–♭III–♭VII: arpeggio phrases landing on chord tones' })])
      ], [4, 6]),
    stage('advanced', 'The whole key, fast and wide',
      'Play all seven seventh chords of the key in arpeggio 3rds in 16ths at 100 BPM and in leaps as triplets, a minor ii–V–i, the chord types from memory, melodies with the top note accented, the vamp in four keys in 16ths, and phrase through the key with chord tones.', [
        S('arpm-cycle', 'Through the key', 'improv', 'All seven chords, two shapes.', [
          A_('arpm-cycle', 'All seven chords of {key} in arpeggio 3rds: {chords}', 'variable', { prog: 'cycle', shape: 'thirds', step: 0.25, goal: 96, why: 'The seventh chords of the key, in the cycle i–iv–♭VII–♭III–♭VI–ii°–V–i, are the harmony of countless rock and fusion tunes. Voice-led 3rds through all of them are a complete chord-tone vocabulary.', instr: TN + 'one chord per bar, arpeggio 3rds in 16ths, nearest tone each bar. Pass: all eight bars clean at the goal tempo.', watch: 'The m7♭5 (ii°): its 5th is flat.', simplify: '8th notes.' }),
          A_('arpm-cycle-leaps', 'Leaps through the key as triplets: {chords}', 'variable', { prog: 'cycle', shape: 'leaps', step: 1 / 3, goal: 92, why: 'The same seven chords in wide leaps: an angular, modern sound across the whole key.', instr: TN + 'leaps (a tone, then the tone three above) as triplets. Pass: all eight bars clean at the goal tempo.', watch: 'Rushing the big intervals.', simplify: '8th notes.' })]),
        S('arpm-minor-iiv', 'Minor ii–V–i and recall', 'improv', 'The minor cadence; chord types named from memory.', [
          A_('arpm-minor-iiv', 'Arpeggio 3rds through a minor ii–V–i: {chords}', 'variable', { prog: 'minorIIV', shape: 'thirds', step: 0.25, goal: 96, why: 'The minor ii–V–i (m7♭5, 7, m7) is darker: the V7 borrows the raised 7th of the harmonic minor. Arpeggios make that leading tone sing into the i chord.', instr: TN + '16ths, nearest tone each bar. Pass: four bars clean at the goal tempo.', watch: 'The V7’s 3rd, a half step below the i chord’s root.', simplify: '8th notes.' }),
          A_('arpm-cycle-recall', 'From memory: the seven chord types, up each arpeggio', 'retrieval', { prog: 'cycle', shape: 'up', step: 0.5, goal: 96, why: 'Knowing each diatonic chord’s quality (m7, m7, 7, maj7, maj7, m7♭5, 7, m7) and its tones without reading is what lets you improvise arpeggio melodies through a tune.', instr: TN + 'one bar per chord. Cover the tab. Before each bar, say the chord and its type, then climb its arpeggio from the nearest tone. Pass: all eight bars from memory.', watch: 'Treating the ♭VII7 as a maj7.', simplify: 'The first four chords.' })]),
        S('arpm-adv-sound', 'Shape the line', 'improv', 'Accents on top, and keys at speed.', [
          A_('arpm-top-melody', 'The melody on top: leaps with the high notes accented ({chords})', 'external-focus', { prog: 'vamp', shape: 'leaps', step: 0.25, goal: 96, why: 'In a leaping line the high notes form a melody of their own. Accenting them (and keeping the low notes light) makes the listener hear a tune over an accompaniment, from one guitar.', instr: TN + 'play the leaps in 16ths, accenting every upper note and playing the lower ones softly. Listen for the upper melody. Pass: four bars where the top line is clearly audible, twice.', watch: 'Every note the same volume.', simplify: '8th notes.' }),
          A_('arpm-keys-fast', 'Leaps in four keys, 16ths', 'interleaving', { prog: 'one', keys: [0, 7, 2, 9], shape: 'leaps', step: 0.25, goal: 92, dl: 1, why: 'Four keys a 5th apart, a new minor-7th chord every four bars, at speed: finding the leaping shape in any key without stopping.', instr: TN + 'four bars per key. Name each chord before it starts. Pass: all four keys without stopping at the goal tempo.', watch: 'Losing the leap pattern at the key change.', simplify: '8th notes.' })]),
        S('arpm-adv-music', 'In music', 'improv', 'A melody through the key, and a solo.', [
          A_('arpm-melody-cycle', 'A chord-tone melody through the key: {chords}', 'transfer', { prog: 'cycle', shape: 'displace', rhythm: [0.5, 0.5, 1, 0.5, 0.5, 1], slides: true, goal: 92, why: 'A melody through all seven chords with octave displacement and slides: the kind of through-composed arpeggio tune that defines fusion writing.', instr: TN + 'play the melody, then improvise your own over the same chords. Pass: the melody twice, then eight bars of your own.', watch: 'Losing the chord order: say the next chord on beat 4.', simplify: 'The quarter notes only.' }),
          c => targetGuide(c, { prog: 'iiVIminor', scale: 'harmonicMinor', name: 'Minor ii–V–i solo: arpeggio phrases, the V chord’s 3rd into the i' })])
      ], [7, 8]),
    stage('mastery', 'Fluent, fast and your own',
      'Play the key’s seven chords in arpeggio 3rds as sextuplets at about 100 BPM and the vamp in leaps in 16ths at 110, any seventh chord on demand, and perform your own 8-bar arpeggio melody.', [
        S('arpm-performance', 'Performance tempo', 'improv', 'The shapes at speed.', [
          as(A_('arpm-cycle-x', '', 'edge', { prog: 'cycle', shape: 'thirds', step: 1 / 6, goal: 92, why: 'The seven chords of the key in arpeggio 3rds, two notes per beat… six: the full-speed fusion run, every note a chord tone.', instr: TN + 'sextuplets, nearest tone each bar. Tempo ladder: add a few BPM after each clean pass. Pass: all eight bars at the goal tempo.', watch: 'Forearm tension.', simplify: '16ths.' }), { id: 'arpm-cycle-fast', method: 'edge', name: x => `All seven chords in arpeggio 3rds at performance tempo (${x.chords.slice(0, 3).join(' – ')} …)` }),
          A_('arpm-leaps-fast', 'Wide leaps at performance tempo: {chords}', 'edge', { prog: 'vamp', shape: 'leaps', step: 0.25, goal: 104, why: 'The angular leaping line at tempo over the vamp: the hardest shape to keep clean at speed.', instr: TN + '16ths, tempo ladder to the goal. Pass: four bars clean at the goal tempo.', watch: 'Skipped strings ringing at speed.', simplify: '8th notes.' })]),
        S('arpm-random-access', 'Any chord, any time', 'improv', 'No warning.', [c => arpRandom(c), c => targetGuide(c, { prog: 'andalusian', scale: 'harmonicMinor', name: 'Andalusian cadence: an arpeggio melody through i–♭VII–♭VI–V' })]),
        S('arpm-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => arpEtude(c), c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp: your own arpeggio melody, then a solo built on it' })])
      ], [9, 10])
  ]
});
