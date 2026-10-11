// Artist Series: Greg Howe. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
// Built technique-first (CONTENT.md): every signature technique is a researched learning path at the
// reference standard, drawn here with PU. Only the closing unit has lessons of its own.
import { OPEN, N, nameOf, minorKey, make, mod12, S, U, PU, M, artist, targetGuide } from '../lib.js';
import legato, { shape, PATTERNS } from '../kb/legato.js';
import subdivisions from '../kb/subdivisions.js';
import tapping from '../kb/tapping.js';
import chromaticPassing, { vampChords } from '../kb/chromaticPassing.js';
import hybridPicking from '../kb/hybridPicking.js';
import vibrato from '../kb/vibrato.js';

/** For the pitch check: each note's allowed pitch classes (Dorian, or a chromatic approach). */
export const ALLOW = new WeakMap();
const DOR = k => [0, 2, 3, 5, 7, 9, 10].map(x => mod12(k + x));
const legMarks = seq => seq.map(([s, f], i) => { const p = seq[i - 1]; return p && p[0] === s ? (f > p[1] ? 'h' : f < p[1] ? 'p' : null) : null; });

/** An original 8-bar study in his style over a Dorian vamp: legato that changes gear, quintuplets, chromatic approaches, a tapped run, hammer-ons from nowhere, a wide-vibrato landing. */
export function ghStudy(c) {
  const k = minorKey(c), dor = DOR(k), notes = [];
  const add = (s, f, t, d, x, pcs) => { const n = N(s, f, t, d, x); ALLOW.set(n, pcs); notes.push(n); };
  const run = (seq, st, t0, beats, mode = 'string') => { const mk = legMarks(seq); for (let j = 0; j < Math.round(beats / st); j++) { const i = j % seq.length; const p = seq[i - 1]; const x = j === 0 ? null : mk[i] || (mode === 'once' && p && seq[i][0] < p[0] ? 'h' : null); add(seq[i][0], seq[i][1], t0 + j * st, st, x, dor); } };
  const S1 = shape(k, 'dorian', 1), S2 = shape(k, 'dorian', 2), S3 = shape(k, 'dorian', 3), P = shape(k, 'minorPent', 1, 2); if (!S1 || !S2 || !S3 || !P) return null;
  run(PATTERNS.up(S1), 1 / 3, 0, 4);                                    // bar 1: shape 1 up in triplets
  run(PATTERNS.down(S3), 0.25, 4, 4);                                   // bar 2: shape 3 down in 16ths (gear change)
  run(PATTERNS.pairs(P).slice(4, 10), 0.5, 8, 3);                       // bar 3: pentatonic hammer pairs, then a held note
  { const last = PATTERNS.pairs(P)[9]; add(last[0], last[1], 11, 1, '~', dor); }
  run(PATTERNS.updown(S2), 1 / 5, 12, 4);                               // bar 4: shape 2 in quintuplets
  // bar 5 (on the IV chord): chord tones of the IV (its root, 3rd, 5th, ♭7) each approached from a half step below
  const iv = [5, 9, 0, 3].map(x => mod12(k + x)); let near = S1[0][1] + 2;
  iv.forEach((pc, i) => {
    let best = null; for (const s of [3, 2]) for (let f = 2; f <= 20; f++) if (mod12(OPEN[s] + f) === pc && (!best || Math.abs(f - near) < Math.abs(best[1] - near))) best = [s, f];
    near = best[1]; add(best[0], best[1] - 1, 16 + i, 0.5, null, [mod12(pc - 1)]); add(best[0], best[1], 16.5 + i, 0.5, 'h', dor);
  });
  // bar 6: a tapped run on the high e: tap a Dorian note, pull off, hammer, in triplets, two positions
  const eFrets = []; for (let f = 1; f <= 22; f++) if (dor.includes(mod12(OPEN[1] + f))) eFrets.push(f);
  const lo = eFrets.findIndex(f => f >= S1[0][1]); if (lo < 0 || lo + 5 >= eFrets.length) return null;
  [[eFrets[lo], eFrets[lo + 1], eFrets[lo + 4]], [eFrets[lo + 1], eFrets[lo + 2], eFrets[lo + 5]]].forEach(([L, Mf, T], h) => {
    for (let j = 0; j < 6; j++) { const t = 20 + h * 2 + j / 3, [f, x] = [[T, 't'], [L, 'p'], [Mf, 'h']][j % 3]; add(1, f, t, 1 / 3, x, dor); }
  });
  run(PATTERNS.up(S3), 1 / 6, 24, 3, 'once');                            // bar 7: hammer-ons from nowhere in sextuplets
  const root = S1.find(([s, f]) => s <= 3 && mod12(OPEN[s] + f) === k) || S1[0];
  add(root[0], root[1], 27, 5, '~', dor);                                 // into bar 8: the root, wide vibrato
  const chords = vampChords(k);
  return make(c, {
    id: 'gh-study', name: `A fusion study in his style (${nameOf(k)} Dorian, ${chords.join(' – ')})`, domain: 'improv', method: 'transfer', unit: 'changing gears', goal: 88, start: 50, minutes: 8, picking: 'legato',
    backing: [...chords, ...chords, ...chords, ...chords], chords,
    why: 'His lines are mostly legato and keep changing speed inside one tempo, mixing scale runs, short bluesy pentatonic phrases, chromatic notes that lean into chord tones, tapped flurries and a wide, vocal vibrato on the last note. This original study chains those ideas the way the course’s paths taught them.',
    instr: 'Learn it two bars at a time. Bar 1 triplets, bar 2 the same pulse in 16ths, bar 4 quintuplets, bar 7 sextuplets picked once: the beat never moves. Bar 5 approaches each chord tone of the IV chord from a half step below; bar 6 taps on the high e (tap, pull off, hammer). Then rewrite bars 5–8 as your own. Pass: the study at the goal tempo with no stops, then your version once.',
    watch: 'Rushing the gear changes: count the beat, not the notes.', simplify: 'Bars 1–4.', tab: { notes }
  });
}

export default artist({ id: 'greg-howe', name: 'Greg Howe', wiki: ['Greg Howe'], genre: 'fusion', re: /greg howe|\bhowe\b|howe ii/,
  blurb: 'Fluid legato that changes gear between triplets, 16ths and odd groupings, tapped flurries, chromatic notes leaning into chord tones and a funky, R&B-flavoured time feel.',
  techniques: [{ name: 'Legato', path: 'legato' }, { name: 'Changing gears (subdivisions)', path: 'subdivisions' }, { name: 'Two-hand tapping', path: 'tapping' }, { name: 'Chromatic passing tones', path: 'chromaticPassing' }, { name: 'Hybrid picking', path: 'hybridPicking' }, { name: 'Wide vibrato', path: 'vibrato' }],
  sources: ['https://en.wikipedia.org/wiki/Greg_Howe', 'https://www.guitarinteractivemagazine.com/tech-session/greg-howe/page/2/', 'https://www.licklibrary.com/learn/courses/greg-howe-tech-session', 'https://www.premierguitar.com/lessons/cram-session-modern-legato-techniques', 'https://guitarworld.com/lessons/modern-legato-video-masterclass', 'https://en.wikipedia.org/wiki/Greg_Howe_(album)'],
  bio: `Greg Howe (born 1963 in New York City) sent a demo to Mike Varney of Shrapnel Records in 1987 and released his debut, Greg Howe, the following year. He recorded hard rock as Howe II with his brother Albert, turned toward jazz fusion with Introspection (1993), and made records with Richie Kotzen and with Dennis Chambers and Victor Wooten. He has also toured as lead guitarist for Michael Jackson, ’N Sync and Justin Timberlake, and since 2017 has played in Simon Phillips’s fusion band Protocol.

His playing blends rock, jazz, funk and R&B: long legato lines with few pick strokes, phrases that shift between triplets, 16ths and odd groupings within one tempo, tapped runs, chromatic notes that slide into chord tones, Dorian and pentatonic vocabulary, and a wide vibrato.

This course starts with legato, then subdivisions and gear changes, tapping, chromatic passing tones, hybrid picking and vibrato, and ends with an original fusion study and improvising over a Dorian vamp.`,
  bands: ['Howe II', 'Protocol'],
  ctx: { key: 9, minor: true, prog: 'dorianVamp' },
  units: [
    PU(legato, { title: 'Legato', summary: 'The core of his sound: hammer-ons and pull-offs, three notes per string, hammer-ons from nowhere and gear changes.' }),
    PU(subdivisions, { title: 'Changing gears', summary: 'Triplets, 16ths, quintuplets and sextuplets on demand, and groupings that cross the beat.', tiers: ['intermediate', 'advanced', 'mastery'] }),
    PU(tapping, { title: 'Two-hand tapping', summary: 'Tapped arpeggios and scale flurries.', tiers: ['intermediate', 'advanced', 'mastery'] }),
    PU(chromaticPassing, { title: 'Chromatic and outside notes', summary: 'Half steps into chord tones, enclosures and side-stepping out and back.' }),
    PU(hybridPicking, { title: 'Hybrid picking', summary: 'Pick and fingers for funky double-stops and wide intervals.', tiers: ['foundations', 'intermediate', 'advanced'] }),
    PU(vibrato, { title: 'Wide vibrato', summary: 'A wide, vocal vibrato on the landing notes.', tiers: ['intermediate', 'advanced'] }),
    U('Putting it together', 'All of it in a study, then improvising over a Dorian vamp.', [
      S('gh-study', 'A study in his style', 'improv', 'Legato gears, chromatic approaches, a tapped run and a held landing in eight bars.', [c => ghStudy(c)]),
      S('gh-solo', 'Fusion soloing', 'improv', 'Gear-changing legato bursts, each ending on a chord tone.', [c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp in his style: legato bursts that change gear, then a wide vibrato' }), M('transfer', ['callResponse', { chords: '$dorianVamp', scale: 'dorian' }])])])
  ],
  riffs: [
    { title: 'Kick It All Over', note: 'From his 1988 debut: fast legato and tapping over a hard-rock groove.' },
    { title: 'The Pepper Shake', note: 'From the debut album: rock-fusion lead lines.' },
    { title: 'Super Unleaded', note: 'From the debut album: up-tempo instrumental.' }
  ] });
