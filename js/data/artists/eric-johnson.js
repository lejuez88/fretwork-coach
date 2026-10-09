// Artist Series: Eric Johnson. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
// Every technique unit draws from a researched learning path (PU), so progress is shared with the
// Technique Library and with every other artist who uses the same path. Only the closing study is his own.
import { OPEN, N, nameOf, minorKey, make, mod12, S, U, PU, M, artist, targetGuide } from '../lib.js';
import pentatonic from '../kb/pentatonic.js';
import speedPent, { cellOf } from '../kb/speedPent.js';
import rolling5s, { shape5 } from '../kb/rolling5s.js';
import hexatonic, { hexBox } from '../kb/hexatonic.js';
import positionShifts, { boxNotes, fitRoute } from '../kb/positionShifts.js';
import spreadTriads, { spread } from '../kb/spreadTriads.js';
import { grouped } from '../kb/pent6s.js';

const pitch = (s, f) => OPEN[s] + f;

/** An original 8-bar study in his style: cascading cells, rolling fives, the 9th, a climb up the neck, a spread-triad colour and a held landing. */
export function ejStudy(c) {
  const k = minorKey(c), notes = [];
  const put = (seq, step, t0, beats) => { let t = t0; for (const [s, f, x] of seq) { if (t >= t0 + beats - 1e-6) break; notes.push(N(s, f, t, step, x || null)); t += step; } };
  const cells = tops => tops.flatMap(tp => cellOf(k, 1, tp, 'down', true) || []);
  const b2 = shape5(k, 'box', 2), hx = hexBox(k, 1), fit = fitRoute(k, [2, 1]);
  if (!b2 || !hx || !fit) return null;
  put(cells([1, 2, 3, 4]), 1 / 6, 0, 4);                                                    // bar 1: the cascade down box 1
  put(grouped(b2, 5, 'down'), 0.25, 4, 4);                                                  // bar 2: rolling fives in box 2
  put(hx.filter(([s]) => s <= 3), 0.25, 8, 4);                                              // bar 3: up the top strings with the 9th
  put([2, 3, 4].flatMap(b => boxNotes(k, fit[b - 1], [2, 1]) || []), 1 / 3, 12, 4);         // bar 4: climbing the top two strings, box 2 to 4
  put([1, 2, 3, 4, 5, 4, 3, 2].flatMap(b => cellOf(k, b, 1, 'down', true) || []), 1 / 6, 16, 8);   // bars 5–6: the cell through all five boxes
  const v = spread(nameOf(k + 10), 0, 5, 8); if (!v) return null;                          // bar 7: ♭VII as a rolled spread triad
  [0, 1, 2, 1, 2, 1, 0, 1].forEach((j, m) => notes.push(N(v.tones[j][0], v.tones[j][1], 24 + m * 0.5, 0.5)));
  const root = hx.find(([s, f]) => s === 4 && mod12(pitch(s, f) - k) === 0) || hx.find(([s, f]) => mod12(pitch(s, f) - k) === 0);
  notes.push(N(root[0], root[1], 28, 4, '~'));                                              // bar 8: land
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k) + 'm9', nameOf(k + 10), nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: 'ej-study', name: `A study in his style: cascades, fives, the 9th and a spread-triad colour (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'sextuplets, 16ths and triplets', goal: 88, start: 50, minutes: 8, dl: 1, backing: chords, chords, voicings: [{ name: v.name, frets: v.frets }],
    why: 'His solos join very fast, very even runs to singing held notes and wide chord colours: slurred six-note cells cascading down the box, groups of five rolling against the beat, the bright added 9th, climbs up the neck on two strings, and a clean spread triad before the landing. This original study strings those ideas together.',
    instr: 'Learn it two bars at a time, then join them. Bar 1: cells down box 1. Bar 2: rolling fives in box 2. Bar 3: the top strings with the 9th. Bar 4: a triplet climb up the top two strings. Bars 5–6: the cell through all five boxes and back. Bar 7: the ♭VII as a rolled spread triad. Bar 8: the root, held. Pass: the study at the goal tempo with no stops; then rewrite bars 5–8 as your own.',
    watch: 'Rushing the held notes after the runs: the space is part of the style.', simplify: 'Bars 1–4 only.', tab: { notes }
  });
}

export default artist({ id: 'eric-johnson', name: 'Eric Johnson', wiki: ['Eric Johnson (guitarist)'], genre: 'rock', re: /eric johnson|\bej\b/,
    blurb: 'Violin-like tone, cascading pentatonic runs, rolling 5s, the bright added 9th, runs that travel the neck and wide spread-triad chords.',
    techniques: [{ name: 'Speed pentatonics', path: 'speedPent' }, { name: 'Rolling 5s', path: 'rolling5s' }, { name: 'Spread triads', path: 'spreadTriads' }, { name: 'Pentatonic plus the 9th', path: 'hexatonic' }, { name: 'Position shifting', path: 'positionShifts' }],
    sources: ['https://www.premierguitar.com/eric-johnson-concepts-and-techniques', 'https://guitarworld.com/lessons/eric-johnson-fluid-streams-of-notes', 'https://www.guitarworld.com/lessons/eric-johnson-tasty-solos', 'https://www.musicradar.com/how-to/5-guitar-tricks-you-can-learn-from-eric-johnson-today', 'https://www.pickupmusic.com/guitar/guitar-classes/play-like-eric-johnson-in-10-days'],
    ctx: { key: 9, minor: true, prog: 'minorRock' },
    units: [
      PU(pentatonic, { title: 'The pentatonic boxes', summary: 'All five boxes, sequences and keys: the ground his speed pentatonics run on.', tiers: ['intermediate', 'advanced', 'mastery'] }),
      PU(speedPent, { title: 'Speed pentatonics', summary: 'The six-note cell that drives his fast runs, from one box to the whole neck.' }),
      PU(rolling5s, { title: 'Rolling 5s', summary: 'Groups of five against a 16th-note pulse: the cascading, rolling sound.' }),
      PU(spreadTriads, { title: 'Spread triads', summary: 'The wide, open chord sound of his clean playing.' }),
      PU(hexatonic, { title: 'Pentatonic plus the 9th', summary: 'The brighter scale of his runs, and the pentatonic of the 5th inside it.' }),
      PU(positionShifts, { title: 'Across the neck', summary: 'Shifting positions inside a line, so runs travel the whole neck.' }),
      U('Putting it together', 'Runs, colours and space in a study of his kind.', [
        S('ej-study', 'A study in his style', 'improv', 'Every technique of the course in eight bars.', [c => ejStudy(c)]),
        S('ej-solo', 'Your own solo', 'improv', 'Cascading runs between phrases with space.', [c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Your own solo: cascades and fives between singing held notes' }), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])])
    ],
    riffs: [
      { title: 'Cliffs of Dover', note: 'Fast pentatonic runs and wide intervals; his best-known instrumental.' },
      { title: 'Manhattan', note: 'Clean chordal playing with spread voicings.' },
      { title: 'Desert Rose', note: 'Clean arpeggiated chords and melodic lines.' },
      { title: 'Trademark', note: 'Pentatonic speed runs over a rock groove.' },
      { title: 'Zap', note: 'Instrumental full of fast pentatonic and position-shifting lines.' },
      { title: 'S.R.V.', note: 'Texas blues-rock tribute with pentatonic runs.' }
    ] });
