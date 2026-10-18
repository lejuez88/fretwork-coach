// Djent riffs and rhythmic displacement: palm-muted chugs on the lowest string with accented power-chord
// hits, built from cells of 3, 5, 7, 9 or 21 sixteenths that repeat against a steady 4/4 so the accents
// land somewhere new each time and the phrase resolves at a bar line (Meshuggah, Periphery, Animals as
// Leaders and Tosin Abasi's eight-string riffing).
//
// Concept-first (CONTENT.md): the model is a GRID of 16th notes under an unchanging pulse (the click and
// the drums stay in 4/4, or in the riff's odd meter). A riff is a list of SEGMENTS, each a CELL (events
// [length in 16ths, kind]: 'c' a palm-muted chug on the low root, 'a' an accented power chord, 'x' a
// pitched event that is a chug on the root and a ringing power chord elsewhere, 'r' a rest) repeated to
// fill an exact number of 16ths; the last repetition is cut to fit, which is how cross-rhythm riffs
// resolve to the bar. Accent pitches come from a separate PITCH CYCLE of natural-minor degrees (R, ♭3, 4,
// 5, ♭6, ♭7), so rhythm and pitch can repeat at different lengths (isorhythm). An offset displaces the
// whole riff by one or two 16ths. Strings: the low E, or string 7 (B) and 8 (F♯) on extended-range
// lessons. `djRun(c, spec)` builds every exercise; every note is a natural-minor tone, tagged.
//
// Teaching method first (CONTENT.md, `pedagogy` below), researched 2026-10-18: tight palm-muted chugs and
// downpicking first, then accents moved off the beat, then groups of three over 4/4, then fives, sevens
// and nines that cycle and are cut to fit a two- or four-bar phrase, displacement by a 16th or an 8th,
// long cells learned in pieces, rhythm and pitch cycles of different lengths, odd meters, then tempo, the
// extended range and your own riffs.
import { OPEN, N, nameOf, make, mod12, minorKey, S, stage, entry } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const MINOR = [0, 2, 3, 5, 7, 8, 10];
/** Degrees an accent may use (natural minor without the 2nd, whose 5th isn't in the key). */
export const DEGS = [0, 3, 5, 7, 8, 10];
const SNAME = { 6: 'low E string', 7: '7th (low B) string', 8: '8th (low F♯) string' };
/** Total length of a cell in 16ths. */
const lenOf = cell => cell.reduce((a, [l]) => a + l, 0);
/** A cell repeated (the last repetition cut) to fill exactly `len` 16ths. */
function fill(cell, len) { const out = []; let n = 0; for (let i = 0; n < len; i++) { const [l, k] = cell[i % cell.length], use = Math.min(l, len - n); out.push([use, k]); n += use; } return out; }

/**
 * spec: { id, name ('{key}', '{string}'), method, cell (one cell) + bars, or segments [[cell, length16], …],
 * pitches (accent degree cycle, semitones above the minor root), offset (16ths of rest before the riff),
 * low (6 | 7 | 8), beatsPerBar (4, 5 or 7), grid (beats per 16th: 0.25, or 0.5 in 7/8), down (mark
 * downstrokes), end (true: a ringing accent on the next downbeat), goal, start, dl, unit, why, instr,
 * watch, simplify, minutes, backing (false to leave it out) }.
 */
export function djRun(c, spec) {
  const k = minorKey(c), low = spec.low || 6, fR = mod12(k - OPEN[low]), bpb = spec.beatsPerBar || 4, grid = spec.grid || 0.25;
  const barLen = Math.round(bpb / grid), pcs = MINOR.map(x => mod12(k + x));
  const segs = spec.segments || [[spec.cell, (spec.bars || 2) * barLen]];
  const pitches = spec.pitches || [0];
  const notes = []; let pos = spec.offset || 0, acc = 0;
  const pfret = d => { let f = fR + d; if (f > 12) f -= 12; return f; };
  const hit = (d, t, dur, ring) => {
    const f = pfret(d);
    if (!ring) { notes.push(tag(N(low, fR, t, Math.min(dur, 2 * grid), 'pm', spec.down ? { pick: 'd' } : null), pcs)); return; }
    notes.push(tag(N(low, f, t, dur, null, { chord: true, ...(spec.down ? { pick: 'd' } : {}) }), pcs), tag(N(low - 1, f + 2, t, dur, null, { chord: true }), pcs));
  };
  for (const [cell, len] of segs) for (const [l, kind] of fill(cell, len)) {
    const t = pos * grid, dur = l * grid;
    if (kind === 'c') hit(0, t, dur, false);
    else if (kind === 'a') { hit(pitches[acc % pitches.length], t, dur, true); acc++; }
    else if (kind === 'x') { const d = pitches[acc % pitches.length]; acc++; hit(d, t, dur, d !== 0); }
    pos += l;
  }
  const total = pos * grid, endBar = Math.ceil(total / bpb - 1e-9) * bpb;
  if (spec.end !== false) hit(0, endBar, bpb / 2, true);
  if (notes.length < 6 || notes.length > 420) return null;
  const str = SNAME[low], kn = `${nameOf(k)} minor`;
  const f = x => String(x || '').replace(/\{key\}/g, kn).replace(/\{string\}/g, str);
  const root5 = nameOf(k) + '5';
  return make(c, {
    id: spec.id, name: f(spec.name), domain: spec.domain || 'rhythm', method: spec.method, unit: spec.unit || '16th notes',
    goal: spec.goal || 100, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'alternate',
    ...(spec.beatsPerBar && spec.beatsPerBar !== 4 ? { beatsPerBar: spec.beatsPerBar } : {}),
    ...(spec.backing === false || (spec.beatsPerBar && spec.beatsPerBar !== 4) ? {} : { backing: [root5], chords: [root5] }),
    why: f(spec.why), instr: f(spec.instr), watch: spec.watch, simplify: spec.simplify,
    tab: low > 6 ? { strings: low, notes } : { notes }
  });
}

/* ------------------------------- Cells ------------------------------- */
const C = {
  chug8: [[2, 'c']], chug16: [[1, 'c']],
  beat: [[1, 'a'], [1, 'c'], [1, 'c'], [1, 'c']], offA: [[1, 'c'], [1, 'c'], [1, 'c'], [1, 'a']],
  three: [[1, 'a'], [1, 'c'], [1, 'c']], threeR: [[1, 'a'], [1, 'c'], [1, 'r']],
  b332: [[2, 'a'], [1, 'c'], [1, 'c'], [1, 'c'], [1, 'r'], [2, 'a'], [1, 'c'], [1, 'c'], [1, 'c'], [1, 'r'], [2, 'a'], [1, 'c'], [1, 'c']],
  five: [[1, 'a'], [1, 'c'], [1, 'c'], [1, 'c'], [1, 'c']], fiveR: [[2, 'a'], [1, 'c'], [1, 'r'], [1, 'c']],
  seven: [[2, 'a'], [1, 'c'], [1, 'c'], [1, 'a'], [1, 'c'], [1, 'c']],
  nine: [[2, 'a'], [1, 'c'], [1, 'c'], [1, 'a'], [1, 'c'], [1, 'r'], [1, 'c'], [1, 'c']],
  threeTwo: [[1, 'a'], [1, 'c'], [1, 'c'], [2, 'r']], beatCell: [[1, 'a'], [1, 'c'], [2, 'c']],
  silence: [[1, 'a'], [1, 'c'], [1, 'r'], [1, 'r'], [1, 'c'], [1, 'c'], [1, 'r']],
  // 21 sixteenths, as 5 + 4 + 3 + 5 + 4
  t21: [[2, 'a'], [1, 'c'], [1, 'c'], [1, 'c'], [1, 'a'], [1, 'c'], [2, 'c'], [1, 'a'], [1, 'c'], [1, 'c'], [2, 'a'], [1, 'c'], [1, 'r'], [1, 'c'], [1, 'a'], [1, 'c'], [1, 'c'], [1, 'c']],
  iso: [[2, 'x'], [1, 'x'], [2, 'x'], [1, 'x'], [1, 'x'], [2, 'x']],                 // 9 sixteenths, 6 events
  isoA: [[2, 'a'], [1, 'a'], [1, 'a'], [2, 'a'], [1, 'a']],                            // 7 sixteenths, 5 events
  g2: [[1, 'a'], [1, 'c']], g4: [[1, 'a'], [1, 'c'], [1, 'c'], [1, 'c']],
  m78: [[2, 'a'], [1, 'c'], [1, 'c'], [2, 'a'], [1, 'c'], [1, 'c'], [2, 'a'], [1, 'c'], [1, 'c'], [2, 'c']],   // 4 + 4 + 6 = 14 sixteenths (2 + 2 + 3 eighths)
  m54: [[1, 'a'], [1, 'c'], [1, 'c'], [1, 'a'], [1, 'c'], [1, 'c'], [2, 'a'], [1, 'c'], [1, 'c'], [2, 'a'], [1, 'c'], [1, 'c'], [1, 'a'], [1, 'c'], [1, 'c'], [1, 'a'], [1, 'c'], [1, 'c']],   // 3+3+4+4+3+3 = 20
  tailA: [[2, 'a']], rest16: [[16, 'r']]
};
export const CELLS = C;

const R_ = (id, name, method, o) => c => djRun(c, { id, name, method, ...o });
const HOW = 'Palm on the strings right at the bridge for the chugs, lifted for the accents so the power chord rings. Strict alternate picking on 16ths (downstrokes on the beat); keep the pick hand moving through the rests. Count the 16ths ("1 e and a") and keep the click as the beat: the riff moves against it, the beat never moves. ';
const ST = (concept, why, theory) => ({ concept, why, theory });
const BAR = 16;
export default entry({
  id: 'djentRiffs', kind: 'style', title: 'Djent riffs and rhythmic displacement', domain: 'rhythm',
  re: /djent|rhythmic displacement|displaced riffs?|cross.?rhythms?|meshuggah|polymeter|odd.?grouping riffs?/,
  aliases: ['djent rhythm guitar', 'rhythmic displacement', 'cross rhythms', 'polymetric riffs'],
  summary: 'Palm-muted chugs and accented power chords on the lowest string, built from cells of 3, 5, 7, 9 and 21 sixteenths that cycle against a steady 4/4 and resolve at the phrase, displaced by a 16th or an 8th, with rhythm and pitch cycles of different lengths, odd meters and riffs on the 7th and 8th strings.',
  prereqs: ['palmMuting', 'subdivisions'],
  sources: ['https://fundamental-changes.com/?p=5009', 'https://www.riffhard.com/how-to-write-djent-rhythms/', 'https://www.riffhard.com/how-to-djent-on-a-6-string/', 'https://mixdownmag.com.au/features/columns/guitar-lesson-more-displacement-ideas/', 'https://metalintheory.com/meshuggah-nostrum/', 'https://www.musicradar.com/tuition/guitars/how-to-play-guitar-like-tosin-abasi-612264', 'https://www.guitarinteractivemagazine.com/tech-session/tosin-abasi/page/3/'],
  pedagogy: {
    date: '2026-10-18',
    summary: 'Taught groove first: tight palm-muted 8ths on the low string with downpicking and controlled mute pressure, then 16ths with a metronome, then accents shifted off the downbeat. Cross rhythms keep the bar’s subdivision but repeat a phrase of another length: first groups of three 16ths (realigning after three bars), then fives, sevens and nines cut to fit a two- or four-bar loop, the first note of each group accented, the pulse kept by foot or head. A phrase is displaced by starting it a 16th or an 8th later. Long cells are learned in isolation and split into 2-, 3-, 4- and 5-sixteenth pieces; rhythm and pitch cycles of different lengths, with palm-muted low notes against ringing ones, hide the repetition; riffs in odd meters (7/8, 5/4); finally tempo, the extended range and your own riffs over drums.',
    sequence: [
      { id: 'chugs', tier: 'foundations', step: 'Tight palm-muted chugs and downpicking', how: 'Palm-muted 8ths on the low string with downstrokes, mute pressure controlled; then 16ths alternate-picked with a metronome, slow first.', skills: ['dj-chug'], source: 1 },
      { id: 'accents', tier: 'foundations', step: 'Accents on the beat, then off it', how: 'Power-chord accents in the chugs, first on the beat, then shifted to off-beat 16ths until the syncopation feels right.', skills: ['dj-accent'], source: 1 },
      { id: 'threes', tier: 'foundations', step: 'Groups of three 16ths over 4/4', how: 'An accent every three 16ths: the riff realigns with the beat after three beats and with the bar after three bars.', skills: ['dj-threes'], source: 0 },
      { id: 'groove', tier: 'foundations', step: 'A first riff over the beat', how: 'A two-bar riff over a 4/4 beat, locked to the drums.', skills: ['dj-first-music'], source: 1 },
      { id: 'fives', tier: 'intermediate', step: 'Groups of five, cut to fit a two-bar loop', how: 'A five-16th cell repeated over 4/4, the first note of every five accented, the last repetition shortened to close the loop.', skills: ['dj-fives'], source: 0 },
      { id: 'sevens', tier: 'intermediate', step: 'Sevens and nines', how: 'Longer cells (7 and 9 sixteenths) that cross the bar, counted against the click and resolved at two or four bars; a nine realigns only after nine bars.', skills: ['dj-sevens', 'dj-nine'], source: 5 },
      { id: 'displace', tier: 'intermediate', step: 'Displacement by a 16th or an 8th', how: 'The same phrase started on the “e” or the “and” instead of the beat; a three-note cell with a rest that shifts on every repetition.', skills: ['dj-displace'], source: 3 },
      { id: 'phrase', tier: 'intermediate', step: 'Riffs that resolve to the phrase', how: 'Four-bar phrases whose cells cycle and are cut to land on the bar line; rests as part of the riff.', skills: ['dj-music-i'], source: 4 },
      { id: 'long', tier: 'advanced', step: 'Long cells, learned in pieces', how: 'A 21-sixteenth riff learned as its own phrase, split into 2-, 3-, 4- and 5-sixteenth cells, then cycled and altered to fit four bars.', skills: ['dj-long'], source: 0 },
      { id: 'iso', tier: 'advanced', step: 'Rhythm and pitch cycles of different lengths', how: 'A repeating rhythm with a pitch sequence of another length, palm-muted low notes against ringing higher ones, resolved at a regular number of bars.', skills: ['dj-iso'], source: 4 },
      { id: 'meters', tier: 'advanced', step: 'Riffs in odd meters', how: '7/8 and 5/4 riffs grouped in 2s and 3s, low-note rhythm first.', skills: ['dj-meter'], source: 6 },
      { id: 'study', tier: 'advanced', step: 'An 8-bar riff piece', how: 'Threes, fives, sevens and displacement in one riff that resolves at eight bars.', skills: ['dj-adv-music'], source: 0 },
      { id: 'tempo', tier: 'mastery', step: 'At tempo and with endurance', how: 'The cells at performance tempo; downpicking endurance built gradually.', skills: ['dj-perf'], source: 1 },
      { id: 'range', tier: 'mastery', step: 'The extended range', how: 'The same riffs on the 7th and 8th strings of a 7- or 8-string guitar.', skills: ['dj-ext'], source: 5 },
      { id: 'own', tier: 'mastery', step: 'Your own riffs', how: 'A 16-bar riff study, then your own riffs over the beat.', skills: ['dj-voice'], source: 1 }
    ],
    drills: ['Palm-muted 8ths with downstrokes on the low string', 'Accents moved from the beat to the off-beat 16ths', 'Groups of three 16ths over 4/4 (realign after three bars)', 'Groups of five and seven cut to fit a two-bar loop', 'The same cell started on the “e” or the “and”', 'A long cell split into 2-, 3-, 4- and 5-sixteenth pieces', 'A rhythm cycle and a pitch cycle of different lengths', 'Riffs in 7/8 and 5/4'],
    mistakes: ['Losing the pulse: the riff moves, the beat must not', 'Mute pressure too heavy or too light (no chug, or no pitch)', 'Downpicking tension: build endurance gradually', 'Pulling the cell back onto the beat after a displacement', 'Learning a long cell only as a whole instead of in pieces', 'Ragged accents that don’t ring against the chugs'],
    sources: [
      { title: 'Modern Metal Rhythm Guitar, Part 4: Cross Rhythms', author: 'Joseph Alexander (Fundamental Changes)', url: 'https://fundamental-changes.com/?p=5009' },
      { title: 'How to Write Djent Rhythms', author: 'Riffhard', url: 'https://www.riffhard.com/how-to-write-djent-rhythms/' },
      { title: 'How to Djent on a 6-String', author: 'Riffhard', url: 'https://www.riffhard.com/how-to-djent-on-a-6-string/' },
      { title: 'Guitar lesson: more displacement ideas', author: 'Mixdown Magazine', url: 'https://mixdownmag.com.au/features/columns/guitar-lesson-more-displacement-ideas/' },
      { title: 'Disconnecting Rhythm and Pitch in Meshuggah’s “Nostrum”', author: 'Stephen Hudson (Metal in Theory)', url: 'https://metalintheory.com/meshuggah-nostrum/' },
      { title: 'How to play guitar like… Tosin Abasi', author: 'Total Guitar (MusicRadar)', url: 'https://www.musicradar.com/tuition/guitars/how-to-play-guitar-like-tosin-abasi-612264' },
      { title: 'Tosin Abasi tech session', author: 'Sam Bell (Guitar Interactive)', url: 'https://www.guitarinteractivemagazine.com/tech-session/tosin-abasi/page/3/' }
    ]
  },
  ctx: { key: 4, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Chugs, accents and threes',
      'Palm-muted 8th-note chugs on the low string with downstrokes at 110 BPM and 16ths at 80, power-chord accents on and off the beat, and groups of three 16ths over 4/4 for three bars until they realign, with the click as steady as the riff, then a two-bar riff over the beat.', [
      S('dj-chug', 'Tight chugs', 'rhythm', 'Palm-muted 8ths and 16ths on the low root.', [
        R_('dj-chug-8', 'Palm-muted 8ths with downstrokes on the {string} ({key})', 'accurate-reps', { cell: C.chug8, bars: 4, down: true, goal: 115, start: 70, unit: '8th notes', why: 'The chug is the sound of the style: a tight, percussive low note, palm-muted at the bridge and downpicked so every note has the same attack.', instr: HOW + 'Every 8th note a downstroke on the low root. Try lighter and heavier palm pressure until the note chugs but still has pitch. Count only bars with every note the same. Pass: 4 clean bars in a row.', watch: 'The palm creeping off the bridge so the notes ring.', simplify: 'Quarter notes.' }),
        R_('dj-chug-16', 'Palm-muted 16ths, alternate picking ({key})', 'accurate-reps', { cell: C.chug16, bars: 2, goal: 90, start: 54, why: '16ths are the grid every djent riff is cut from; alternate picking keeps them even when the accents start moving.', instr: HOW + 'Even 16ths, down on the beat, up on the “e” and the “a”. Pass: 2 bars clean three times in a row.', watch: 'The upstrokes louder or softer than the downstrokes.', simplify: '8ths, alternate picked.' })],
        ST('A chug is a palm-muted low note: the side of the picking hand rests on the strings at the bridge.', 'Lighter pressure sounds more resonant, heavier more percussive; the djent sound sits in between and depends on even picking.', ['Downpicking gives every note the same attack; alternate picking is needed for 16ths.', 'Build downpicking endurance gradually: it tires the arm.'])),
      S('dj-accent', 'Accents on and off the beat', 'rhythm', 'Power-chord hits inside the chugs.', [
        R_('dj-accent-beat', 'A power-chord accent on every beat, chugs between ({key})', 'chunking', { cell: C.beat, bars: 2, pitches: [0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 7, 7, 7, 7], goal: 90, start: 54, why: 'An accent is the palm lifted for one 16th so the power chord rings out of the chugs. On the beat first, so the hand learns to lift and drop in time.', instr: HOW + 'Accent on each beat, three chugs after it; bar 2 moves the accent to the ♭6 and the 5th. Pass: 2 bars twice with every accent ringing and every chug tight.', watch: 'The chugs after an accent ringing because the palm came down late.', simplify: 'Accents only on beats 1 and 3.' }),
        R_('dj-accent-off', 'Accents moved to the last 16th of each beat ({key})', 'variable', { cell: C.offA, bars: 2, pitches: [0, 3, 0, 5], goal: 88, start: 52, why: 'Moving the accent to the “a” of each beat is syncopation: the riff now pushes against the beat instead of sitting on it.', instr: HOW + 'Three chugs, then the accent on the “a”. Keep the click on the beat in your head and body. Pass: 2 bars twice with the accents ahead of the beat, not on it.', watch: 'Drifting so the accent becomes the beat.', simplify: 'The accent on the “and” first.' })],
        ST('Accents are power chords that ring out of the muted chugs; where they fall in the 16ths makes the rhythm.', 'Shifting accents off the downbeat is the first step to djent syncopation.', ['A power chord is the root and the 5th: two strings, two frets apart.', 'The accent pitches here come from the natural minor scale.'])),
      S('dj-threes', 'Groups of three over 4/4', 'rhythm', 'An accent every three 16ths.', [
        R_('dj-three', 'Groups of three 16ths for three bars: accent, chug, chug ({key})', 'chunking', { cell: C.three, bars: 3, pitches: [0], goal: 84, start: 50, why: 'A three-16th cell (a dotted 8th) repeated in 4/4 lands on a different part of the beat each time and only lines up with the bar again after three bars: the simplest cross rhythm.', instr: HOW + 'Accent on the first of every three 16ths. Nod on the beat and notice the accent moving: on the beat, on the “a”, on the “and”, on the “e”. Pass: the three bars twice, landing on beat 1 of bar 4.', watch: 'Adding a 16th to make it fit the beat.', simplify: 'One bar, then stop.' }),
        R_('dj-three-rest', 'Groups of three with a rest: accent, chug, silence ({key})', 'variable', { cell: C.threeR, bars: 3, pitches: [0, 3], goal: 84, start: 50, why: 'A rest inside the cell makes the cross rhythm sharper: the silences move against the beat too.', instr: HOW + 'Accent, chug, rest; the accents alternate the root and the ♭3. Keep the pick hand moving in the rest. Pass: three bars twice.', watch: 'Stopping the pick hand in the rests and losing the 16ths.', simplify: 'No rest: accent, chug, chug.' })],
        ST('A cross rhythm keeps the bar’s 16ths but repeats a phrase of another length, so the two phase against each other.', 'It is the basis of djent riffing; groups of three are the first and simplest.', ['3 × 16 = 48 sixteenths: three bars of 4/4 hold exactly sixteen threes.', 'Polyrhythm is a different thing: a second subdivision (triplets) over the first.'])),
      S('dj-first-music', 'First riffs', 'rhythm', 'A two-bar riff over the beat.', [
        R_('dj-groove-332', 'A 3 + 3 + 2 riff: accents on the 8th-note groups ({key})', 'transfer', { cell: C.b332, bars: 4, pitches: [0, 0, 8, 0, 0, 7], goal: 88, start: 52, why: 'Grouping the bar’s 8ths in 3 + 3 + 2 gives a syncopated riff that still resolves every bar: the bridge from rock rhythm to djent.', instr: HOW + 'Each bar: accent, chugs, rest; accent, chugs, rest; accent, chugs. Play it with the backing. Pass: 4 bars in the pocket, twice.', watch: 'Rushing the rests.', simplify: 'Accents only, no chugs.' }),
        R_('dj-groove-threes', 'Threes for a bar and a half, then a closing hit ({key})', 'transfer', { segments: [[C.three, 30], [C.tailA, 2]], pitches: [0, 0, 3, 0, 5], goal: 88, start: 52, why: 'Ten groups of three and one two-16th hit fill two bars exactly: the riff crosses the beat, then closes the loop.', instr: HOW + 'The last accent is two 16ths long; then the riff starts again. Pass: the two-bar loop four times with the backing.', watch: 'Extending the closing hit.', simplify: 'Half tempo.' })],
        ST('A riff becomes a groove when the cross rhythm is locked to the drums’ 4/4.', 'In djent the snare and cymbals keep the pulse while the guitar moves against it.', ['Lock the closing hit to beat 4.', 'Two bars = 32 sixteenths.']))
    ], [1, 3]),
    stage('intermediate', 'Fives, sevens, nines and displacement',
      'Play five-, seven- and nine-16th cells over 4/4 at 100 BPM, cut to fit two- and four-bar loops with the first note of every group accented, a nine that runs nine bars until it realigns, the same cell displaced to the “e” and to the “and”, and four-bar riffs with rests over the beat.', [
      S('dj-fives', 'Fives', 'rhythm', 'A five-16th cell, cut to fit two bars.', [
        R_('dj-five', 'Groups of five 16ths, cut to fit a two-bar loop ({key})', 'chunking', { segments: [[C.five, 30], [C.tailA, 2]], pitches: [0, 0, 3, 0, 8, 7], goal: 100, start: 58, why: 'A five-16th cell starts a 16th later every beat; six of them take 30 sixteenths, and a two-16th hit closes the two bars.', instr: HOW + 'Accent the first note of every five and feel the five against the beat. Pass: the loop four times.', watch: 'Turning the five into four plus a late note.', simplify: 'Count the fives aloud with the click first.' }),
        R_('dj-five-rest', 'Fives with a rest: hit, chug, silence, chug ({key})', 'variable', { segments: [[C.fiveR, 30], [C.tailA, 2]], pitches: [0, 3, 5], goal: 100, start: 58, why: 'A rest in the five gives the riff its shape: the silences cross the beat with the accents.', instr: HOW + 'Two-16th accent, chug, rest, chug. Pass: the loop four times.', watch: 'Shortening the accent.', simplify: 'No rest.' })],
        ST('Five 16ths against four per beat: the cell starts one 16th later on each beat and realigns after five beats.', 'Fives are the most used odd cell in djent riffs.', ['Six fives = 30 sixteenths; two more fill two bars.', 'Accent the first of each five.'])),
      S('dj-sevens', 'Sevens', 'rhythm', 'Four plus three.', [
        R_('dj-seven', 'Groups of seven (4 + 3), cut to fit two bars ({key})', 'chunking', { segments: [[C.seven, 28], [C.g4, 4]], pitches: [0, 8, 0, 7], goal: 100, start: 58, why: 'A seven is a four and a three; it crosses the beat by one 16th less each time. Four of them and a four-16th tail close two bars.', instr: HOW + 'Accents on the first note of the four and of the three. Pass: the loop four times.', watch: 'Losing count in the middle of the second bar.', simplify: 'Accent only the first note of each seven.' }),
        R_('dj-seven-4', 'Sevens over four bars ({key})', 'variable', { segments: [[C.seven, 63], [C.chug16, 1]], pitches: [0, 3, 0, 5, 0, 10], goal: 100, start: 58, why: 'Nine sevens fill all but one 16th of four bars: a longer cycle, so the accents take longer to come round.', instr: HOW + 'Pass: the four bars twice, landing on beat 1 of bar 5.', watch: 'Rushing to the bar line.', simplify: 'Two bars.' })],
        ST('A seven-16th cell is a 4 and a 3; nine of them nearly fill four bars.', 'Longer cells make the riff sound less predictable.', ['7 × 9 = 63; one more 16th makes 64 = four bars.', 'Keep the 16ths even; the cell takes care of the accents.'])),
      S('dj-nine', 'Nines', 'rhythm', 'A nine-16th phrase that crosses many bar lines.', [
        R_('dj-nine', 'A nine-16th riff (4 + 5) over four bars ({key})', 'variable', { segments: [[C.nine, 63], [C.chug16, 1]], pitches: [0, 8, 7], goal: 100, start: 58, why: 'A nine-16th phrase never lines up with the bar, so it keeps landing on off-beats: the long, rolling cross rhythm of Tosin Abasi’s riffs.', instr: HOW + 'The nine is a four (accent, chug, chug) and a five (accent, chug, rest, chug, chug). Pass: the four bars twice.', watch: 'Shortening the rest.', simplify: 'Two bars.' }),
        R_('dj-nine-full', 'The nine until it realigns: nine bars ({key})', 'accurate-reps', { cell: C.nine, bars: 9, pitches: [0, 8, 7], goal: 96, start: 56, why: 'Sixteen nines fill exactly nine bars of 4/4: the full cycle, after which the riff lands on beat 1 again.', instr: HOW + 'Count bars as well as beats. Pass: all nine bars, arriving on the downbeat of bar 10.', watch: 'Losing the bar count around bar 5.', simplify: 'The first four bars.' })],
        ST('A nine-16th cell realigns with the bar only after nine bars (9 × 16 = 144 = 16 × 9).', 'It sounds almost random until the cycle closes.', ['Split it as 4 + 5 to count it.', 'Riffs are often cut to four bars instead of running the full cycle.'])),
      S('dj-displace', 'Displacement', 'rhythm', 'The same cell started a 16th or an 8th later.', [
        R_('dj-disp-e', 'Displaced to the “e”: three notes and a rest, a 16th late ({key})', 'variable', { segments: [[C.threeTwo, 31]], offset: 1, pitches: [0, 3], goal: 96, start: 56, why: 'Starting the same three-note cell one 16th after the beat moves every note; with its two-16th rest, the cell also shifts on every repetition.', instr: HOW + 'Rest on beat 1, then the cell from the “e”. Count “1 e and a” and play from the “e”. Pass: two bars twice.', watch: 'Pulling the cell back onto the beat.', simplify: 'Start it on the beat first, then move it.' }),
        R_('dj-disp-and', 'Displaced to the “and”: a one-beat riff, an 8th late ({key})', 'variable', { segments: [[C.beatCell, 30]], offset: 2, pitches: [0, 8, 0, 7], goal: 96, start: 56, why: 'A riff one beat long that starts on the “and” sits between the beats for the whole phrase: the same notes, a new rhythm.', instr: HOW + 'Rest for an 8th, then accent, chug, held chug, over and over. Pass: two bars twice.', watch: 'The accent sliding onto the beat.', simplify: 'Half tempo.' })],
        ST('Displacement starts a phrase later (or earlier) without changing it.', 'It turns one riff into several and keeps the listener guessing.', ['A 16th late sounds disjointed; an 8th late sounds syncopated.', 'Count 4/4 so the downbeats stay strong.'])),
      S('dj-music-i', 'Four-bar riffs', 'rhythm', 'Cycles that resolve; rests in the riff.', [
        R_('dj-phrase-4', 'A four-bar riff of fives that resolves to the bar ({key})', 'transfer', { segments: [[C.five, 60], [[[2, 'a'], [2, 'a']], 4]], pitches: [0, 0, 3, 0, 5, 0, 8, 7], goal: 100, start: 58, why: 'Twelve fives and two closing hits make four bars: the phrase drifts against the beat and resolves at the end, like a verse riff.', instr: HOW + 'With the backing. Pass: the riff three times through.', watch: 'Arriving early at the closing hits.', simplify: 'Two bars.' }),
        R_('dj-silence', 'Silence as rhythm: a seven with rests over two bars ({key})', 'transfer', { segments: [[C.silence, 28], [C.g4, 4]], pitches: [0, 10], goal: 96, start: 56, why: 'Rests are part of the riff: the silences cross the beat like notes.', instr: HOW + 'Keep the pick hand moving through the rests; mute everything with both hands. Pass: the loop four times.', watch: 'Notes ringing into the rests.', simplify: 'Fill the rests with chugs.' })],
        ST('A riff resolves when its cycles are cut to fit the phrase: two, four or eight bars.', 'Riffs that drift and then resolve are what make djent feel heavy and deliberate.', ['Plan the closing hits on the last beat.', 'Silence is as precise as the notes.']))
    ], [4, 6]),
    stage('advanced', 'Long cells, isorhythm and odd meters',
      'Learn a 21-sixteenth riff in pieces and play it over four bars at 105 BPM, play rhythm and pitch cycles of different lengths with palm-muted roots against ringing chords, play riffs in 7/8 and 5/4, and an 8-bar riff piece that resolves.', [
      S('dj-long', 'Long cells', 'rhythm', 'A 21-sixteenth riff, learned in pieces.', [
        R_('dj-cells', 'The pieces first: cells of 2, 3, 4 and 5, one bar each ({key})', 'chunking', { segments: [[C.g2, BAR], [C.three, BAR], [C.g4, BAR], [C.five, BAR]], pitches: [0, 0, 3, 0, 5], goal: 100, start: 58, why: 'Long riffs are learned by splitting them into 2-, 3-, 4- and 5-sixteenth cells; each bar here repeats one of them.', instr: HOW + 'Bar 1 twos, bar 2 threes, bar 3 fours, bar 4 fives (each cut at the bar line). Pass: the four bars twice.', watch: 'Carrying the last bar’s accents into the next.', simplify: 'Twos and fours only.' }),
        R_('dj-21', 'A 21-sixteenth riff (5 + 4 + 3 + 5 + 4) over four bars ({key})', 'variable', { segments: [[C.t21, 63], [C.chug16, 1]], pitches: [0, 8, 0, 3, 7], dl: 1, goal: 104, start: 60, why: 'A 21-sixteenth riff repeated three times nearly fills four bars: a long cross rhythm learned as its own phrase, then cycled.', instr: HOW + 'Learn it as 5 + 4 + 3 + 5 + 4, then play it three times and add the one-16th tail. Pass: the four bars twice.', watch: 'Losing the place in the second repetition.', simplify: 'One repetition of 21, then rest.' })],
        ST('A long cell is learned as its own odd-length phrase, split into small cells, then cycled against the bar.', 'It is how the most complex djent riffs are built and learned.', ['21 × 3 = 63; one 16th more = 64 = four bars.', 'Accent the first note of each small cell.'])),
      S('dj-iso', 'Rhythm and pitch cycles', 'rhythm', 'A rhythm and a pitch sequence of different lengths.', [
        R_('dj-iso-accent', 'Five hits against three pitches: rhythm and pitch out of step ({key})', 'variable', { segments: [[C.isoA, 63], [C.chug16, 1]], pitches: [0, 3, 8], goal: 100, start: 58, why: 'The rhythm repeats every five hits, the pitches every three, so the same rhythm never meets the same pitches until fifteen hits later: the riff sounds less predictable than either cycle.', instr: HOW + 'All power chords here: root, ♭3, ♭6 in turn, on a seven-16th rhythm. Pass: the four bars twice.', watch: 'Resetting the pitches with the rhythm.', simplify: 'One pitch.' }),
        R_('dj-iso-mute', 'Muted roots against ringing chords, cycles out of step ({key})', 'variable', { segments: [[C.iso, 63], [C.chug16, 1]], pitches: [0, 0, 10, 0, 7], goal: 100, start: 58, why: 'With the root palm-muted and the other notes ringing, the five-note pitch cycle changes the riff’s shape against its six-event rhythm.', instr: HOW + 'Root = palm-muted chug, ♭7 and 5 = ringing power chords. Pass: the four bars twice.', watch: 'Muting the ringing chords too.', simplify: 'Two bars.' })],
        ST('An isorhythm repeats a rhythm and a pitch sequence of different lengths.', 'Meshuggah-style riffs hide their repetition this way; palm-muted low notes against ringing ones change the shape further.', ['Five against three realigns after fifteen events.', 'The drums keep 4/4; the riff resolves at a whole number of bars.'])),
      S('dj-meter', 'Odd meters', 'rhythm', '7/8 and 5/4.', [
        R_('dj-78', 'A 7/8 riff: 2 + 2 + 3 eighths ({key})', 'chunking', { segments: [[C.m78, 56]], beatsPerBar: 7, grid: 0.5, pitches: [0, 8, 7], goal: 190, start: 110, unit: '16ths in 7/8 (click on every 8th)', why: 'In 7/8 the bar itself is odd: seven 8ths grouped 2 + 2 + 3. The riff accents each group.', instr: HOW + 'The click is on every 8th. Count “1 2 · 1 2 · 1 2 3”. Learn the low-note rhythm first, then add the accents. Pass: four bars twice.', watch: 'Turning the 3 into a 2.', simplify: 'Accents only.' }),
        R_('dj-54', 'A 5/4 riff: 3 + 3 + 4 + 4 + 3 + 3 sixteenths ({key})', 'variable', { segments: [[C.m54, 80]], beatsPerBar: 5, pitches: [0, 3, 0, 5, 0, 8], goal: 96, start: 56, why: 'Five beats per bar, grouped unevenly in 16ths: an odd meter with a cross rhythm inside it.', instr: HOW + 'Five clicks per bar. Pass: four bars twice.', watch: 'Dropping the fifth beat.', simplify: 'Count five quarter notes with chugs first.' })],
        ST('Odd meters change the bar itself: 7/8 has seven 8ths, 5/4 five beats.', 'Djent and prog riffs use them with or without cross rhythms inside.', ['7/8 = 2 + 2 + 3 eighths (or 3 + 2 + 2).', 'Learn the low-note rhythm first, then the accents.'])),
      S('dj-adv-music', 'An 8-bar riff', 'rhythm', 'Threes, fives, sevens and displacement in one riff.', [
        R_('dj-study-8', 'Study: an 8-bar riff that resolves ({key})', 'transfer', { segments: [[C.three, 30], [C.tailA, 2], [C.five, 30], [C.tailA, 2], [C.seven, 28], [C.g4, 4], [C.nine, 27], [C.g4, 5]], pitches: [0, 0, 3, 0, 8, 0, 7, 10], dl: 1, minutes: 8, goal: 104, start: 60, why: 'An original 8-bar riff: two bars of threes, two of fives, two of sevens and two of nines, each pair closed by a hit, all against a steady 4/4.', instr: HOW + 'Learn it two bars at a time with the backing. Pass: twice through without a gap.', watch: 'Rushing the changes between cells.', simplify: 'Bars 1–4.' }),
        R_('dj-call', 'Riff and answer: a written bar, then your own ({key})', 'transfer', { segments: [[C.five, 16], [C.rest16, 16], [C.seven, 16], [C.rest16, 16]], pitches: [0, 3, 0, 8], goal: 100, start: 58, why: 'Every other bar is yours: write your own cross-rhythm answer to the written bar.', instr: HOW + 'Odd bars as written; even bars your own riff from any cell. Pass: twice through, every bar in time.', watch: 'Your bars falling back to straight 8ths.', simplify: 'Answer with threes.' })],
        ST('A riff piece combines cells and resolves at eight bars.', 'This is how djent songs are built: sections of cross rhythm over one steady beat.', ['Each pair of bars closes with a hit.', 'The drums keep 4/4 throughout.']))
    ], [7, 8]),
    stage('mastery', 'Tempo, range and your own riffs',
      'Play fives and the 21-sixteenth riff at 120 BPM, eight bars of downpicked accents and chugs at 130, the riffs on the 7th and 8th strings of an extended-range guitar, and your own 16-bar riff piece.', [
      S('dj-perf', 'At tempo', 'rhythm', 'Speed and endurance.', [
        R_('dj-perf-five', 'Fives at performance tempo ({key})', 'edge', { segments: [[C.five, 60], [[[2, 'a'], [2, 'a']], 4]], pitches: [0, 0, 3, 0, 5, 0, 8, 7], goal: 98, start: 62, why: 'The four-bar riff of fives at tempo: tight chugs and ringing accents at speed.', instr: HOW + 'Tempo ladder: +3 BPM after each clean pass. Pass: two clean passes at the goal.', watch: 'Accents swallowed at speed.', simplify: 'Two bars.' }),
        R_('dj-perf-down', 'Eight bars of downpicked 8ths with accents ({key})', 'edge', { cell: [[2, 'a'], [2, 'c'], [2, 'c'], [2, 'c']], bars: 8, down: true, pitches: [0, 0, 8, 7], unit: '8th notes', goal: 108, start: 72, why: 'Downpicking endurance: eight bars of 8th-note downstrokes with accents, the arm relaxed throughout.', instr: HOW + 'All downstrokes. Shake out between passes; add tempo in small steps over days. Pass: eight bars at the goal tempo.', watch: 'Tension in the forearm.', simplify: 'Four bars.' })],
        ST('Tempo and endurance come in small steps.', 'At performance tempo the chugs must stay tight and the accents ring.', ['Downpicking endurance is built gradually.', 'Small tempo steps after clean passes.'])),
      S('dj-ext', 'The extended range', 'rhythm', 'The 7th and 8th strings.', [
        R_('dj-7-seven', 'Sevens on the 7th string of a 7-string ({key})', 'variable', { low: 7, segments: [[C.seven, 28], [C.g4, 4]], pitches: [0, 8, 0, 7], goal: 100, start: 58, why: 'On a 7-string the low B string takes the chugs a 4th below the low E: the same cross rhythm, a heavier register.', instr: 'On a 7-string in standard tuning (low to high B E A D G B E). ' + HOW + 'Pass: the loop four times.', watch: 'The low string flapping: lighter, more even picking.', simplify: 'Fives.' }),
        R_('dj-8-nine', 'The nine on the 8th string of an 8-string ({key})', 'variable', { low: 8, segments: [[C.nine, 63], [C.chug16, 1]], pitches: [0, 8, 7], goal: 100, start: 58, why: 'Tosin Abasi’s instrument: on an 8-string the low F♯ string gives the chugs their weight; the nine-16th riff on it.', instr: 'On an 8-string in standard tuning (low to high F♯ B E A D G B E). ' + HOW + 'Pass: the four bars twice.', watch: 'Muting the 7th string with the palm too: rest the palm on both.', simplify: 'Two bars.' })],
        ST('Extended-range guitars add a low B (7-string) and F♯ (8-string) below the low E.', 'Djent riffs sit on those strings; the techniques stay the same, the strings are thicker and looser.', ['Each low string is a 4th below the next, like the rest of the guitar.', 'Power chords keep their shape: root and the next string two frets up.'])),
      S('dj-voice', 'Your own riffs', 'rhythm', 'A 16-bar riff study, then your own.', [
        R_('dj-capstone', 'Capstone study: a 16-bar riff piece ({key})', 'transfer', { segments: [[C.three, 30], [C.tailA, 2], [C.five, 30], [C.tailA, 2], [C.seven, 28], [C.g4, 4], [C.t21, 63], [C.chug16, 1], [C.isoA, 31], [C.chug16, 1], [C.nine, 64]], offset: 0, pitches: [0, 0, 3, 0, 8, 0, 7, 10, 5], dl: 1, minutes: 8, goal: 98, start: 58, why: 'An original 16-bar riff piece through the whole path: threes, fives, sevens, the 21, an isorhythm and a nine, each section resolving at its bar line.', instr: HOW + 'Learn it four bars at a time. Then rewrite four bars with your own cells. Pass: the study at the goal tempo, then your version once.', watch: 'Losing the bar count in the long cells.', simplify: 'Bars 1–8.' }),
        R_('dj-own', 'Write your own: a cell length you choose, cut to fit four bars ({key})', 'transfer', { segments: [[C.five, 16], [C.rest16, 16], [C.nine, 16], [C.rest16, 16]], pitches: [0, 8, 7], goal: 100, start: 58, minutes: 6, why: 'Mastery is writing riffs: choose a cell length, decide where it is cut and where the phrase resolves.', instr: HOW + 'Odd bars as written; even bars your own cross-rhythm bar. Then write a full four-bar riff of your own. Pass: twice through in time, then your riff at the goal tempo.', watch: 'Your cells always restarting on beat 1.', simplify: 'Use threes.' })],
        ST('The capstone combines every cell; the last step is your own riff.', 'A rhythm idea becomes yours when you write with it.', ['Decide the cell, then the cut, then the resolution.', 'Write over a steady 4/4 beat.']))
    ], [9, 10])
  ]
});
