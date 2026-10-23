// Sweeps through chord changes: arpeggios swept with one continuous pick motion, a new shape for every
// chord of a progression. From the first two-string roll and the muted one-note-at-a-time arpeggio,
// through the three-string triad sweep, string sets, inversions and four-string shapes in time with the
// click, to five-string sweeps, two chords a bar in sextuplets, neoclassical and diminished changes,
// performance tempo, random access and an original study.
//
// Concept-first (CONTENT.md): the model is
//   - a CHORD (triad: major, minor or diminished) from a progression of key degrees;
//   - a STRING SET with how many notes each string carries ('3top' = strings 3-2-1 with two on the top
//     string, '3mid' = 4-3-2, '4str' = 4-3-2-1, '5str' = 5-4-3-2-1 with two on the A and high e strings);
//   - an INVERSION (the chord tone the shape starts on: root, 3rd or 5th).
//   `sweepShape` stacks consecutive chord tones from that starting note across the set, one string at a
//   time, keeping the shape within a four- or five-fret span near the hand, so every note is a chord tone
//   in any key by construction. The SWEEP CELL is the shape up (one downward push of the pick, the extra
//   top note hammered) and back down (pull-off, one upward push), or up only.
// The composer `swRun(c, spec)` builds an exercise from progression × string-set plan × inversion plan ×
// direction × note value × beats per chord × key plan, choosing each shape nearest the last one.
import { OPEN, N, nameOf, make, mod12, chordInfo, S, stage, entry, M, targetGuide } from '../lib.js';
import { rng } from './alternatePicking.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
export const SETS = {
  '2str': { strings: [3, 2], counts: [1, 1], span: 5, name: 'two strings (G and B)' },
  '3top': { strings: [3, 2, 1], counts: [1, 1, 2], span: 5, name: 'strings 3-2-1' },
  '3mid': { strings: [4, 3, 2], counts: [1, 1, 2], span: 5, name: 'strings 4-3-2' },
  '4str': { strings: [4, 3, 2, 1], counts: [1, 1, 1, 2], span: 5, name: 'strings 4-3-2-1' },
  '5str': { strings: [5, 4, 3, 2, 1], counts: [2, 1, 1, 1, 2], span: 5, name: 'strings 5-4-3-2-1' },
  '5top': { strings: [5, 4, 3, 2, 1], counts: [1, 1, 1, 1, 2], span: 5, name: 'strings 5-4-3-2-1' }
};
const INV = ['root position', '1st inversion', '2nd inversion'];
/** Progressions as [semitones above the key root, quality]; minor ones are relative to the minor key. */
export const PROGS = {
  keyChords: { name: 'the key’s main chords', minor: [[0, 'm'], [8, ''], [10, ''], [7, '']], major: [[0, ''], [9, 'm'], [5, ''], [7, '']] },
  minorRock: { name: 'i–♭VI–♭VII–i', minor: [[0, 'm'], [8, ''], [10, ''], [0, 'm']] },
  neo: { name: 'i–iv–V–i (harmonic minor)', minor: [[0, 'm'], [5, 'm'], [7, ''], [0, 'm']] },
  andalusian: { name: 'i–♭VII–♭VI–V (Andalusian)', minor: [[0, 'm'], [10, ''], [8, ''], [7, '']] },
  dim: { name: 'i–vii°–i–V (harmonic minor, diminished)', minor: [[0, 'm'], [11, 'dim'], [0, 'm'], [7, '']] },
  long: { name: 'i–iv–♭VII–♭III–♭VI–ii°–V–i', minor: [[0, 'm'], [5, 'm'], [10, ''], [3, ''], [8, ''], [2, 'dim'], [7, ''], [0, 'm']] },
  pair: { name: 'the same root, minor then major', minor: [[0, 'm'], [0, ''], [0, 'm'], [0, '']] },
  axis: { name: 'I–V–vi–IV', major: [[0, ''], [7, ''], [9, 'm'], [5, '']] }
};
const SUF = { '': '', m: 'm', dim: '°' };
const chordName = (pc, q) => nameOf(pc) + SUF[q];
const pcsOf = (pc, q) => [0, q === '' ? 4 : 3, q === 'dim' ? 6 : 7].map(x => mod12(pc + x));
/**
 * The sweep shape of a triad on a string set: consecutive chord tones from the inversion's starting
 * note, `counts` notes per string low to high, every fret 1–21 within the set's span, nearest `near`.
 */
export function sweepShape(rootPc, q, set, inv = 0, near = 7) {
  const S_ = SETS[set], pcs = pcsOf(rootPc, q), low = S_.strings[0], total = S_.counts.reduce((a, b) => a + b, 0);
  let best = null;
  for (let f0 = 1; f0 <= 19; f0++) {
    const m0 = OPEN[low] + f0; if (mod12(m0) !== pcs[inv]) continue;
    const tones = []; for (let m = m0; tones.length < total; m++) if (pcs.includes(mod12(m))) tones.push(m);
    const notes = []; let i = 0;
    S_.strings.forEach((s, j) => { for (let x = 0; x < S_.counts[j]; x++) notes.push([s, tones[i++] - OPEN[s]]); });
    const fs = notes.map(n => n[1]); if (Math.min(...fs) < 1 || Math.max(...fs) > 21 || Math.max(...fs) - Math.min(...fs) > S_.span) continue;
    const score = Math.abs(fs.reduce((a, b) => a + b, 0) / fs.length - near);
    if (!best || score < best.score) best = { notes, score, fret: Math.min(...fs), name: chordName(rootPc, q), pcs, set, inv };
  }
  return best;
}
/** The sweep cell: up (same-string notes hammered) and back down (pull-offs), or up only. */
export function cellOf(shape, dir = 'updown') {
  const up = shape.notes.map(([s, f], i) => [s, f, i && shape.notes[i - 1][0] === s ? 'h' : null, 'd']);
  if (dir === 'up') return up;
  if (dir === 'down') return shape.notes.slice().reverse().map(([s, f], i, a) => [s, f, i && a[i - 1][0] === s ? 'p' : null, 'u']);
  const dn = shape.notes.slice(1, -1).reverse().map(([s, f], i, a) => { const prev = i ? a[i - 1] : shape.notes[shape.notes.length - 1]; return [s, f, prev[0] === s ? 'p' : null, 'u']; });
  return [...up, ...dn];
}
const UNIT = new Map([[0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);

/* ------------------------------- The composer ------------------------------- */
/**
 * spec: { id, name, method, prog, sets (cycled per chord), invs (cycled per chord), dir, step, beats
 * (per chord, default 4), keys (key offsets, one block each), reps, order (chord indexes), near,
 * marks, why, instr, watch, simplify, goal, start, dl, minutes }. '{chords}', '{prog}', '{keys}' and
 * '{sets}' in the text are filled in.
 */
export function swRun(c, spec) {
  const P = PROGS[spec.prog || 'keyChords'], useMinor = P.minor && (c.minor || !P.major);
  const k0 = useMinor ? (c.minor ? mod12(c.key) : mod12(c.key - 3)) : (c.minor ? mod12(c.key + 3) : mod12(c.key));
  const deg = useMinor ? P.minor : P.major;
  const sets = spec.sets || ['3top'], invs = spec.invs || [0], beats = spec.beats || 4;
  const step = spec.step || ((c.lvl || 4) >= 7 ? 1 / 6 : 1 / 3);
  const notes = [], used = [], voicings = [], keyNames = []; let t = 0, near = spec.near || 7, ci = 0;
  for (const off of spec.keys || [0]) {
    const k = mod12(k0 + off); keyNames.push(nameOf(k) + (useMinor ? ' minor' : ' major'));
    const order = spec.order || deg.map((_, i) => i);
    for (let rep = 0; rep < (spec.reps || 1); rep++) for (const di of order) {
      const [d, q] = deg[di], set = sets[ci % sets.length], inv = invs[ci % invs.length]; ci++;
      const sh = [inv, 0, 1, 2].map(iv => sweepShape(mod12(k + d), q, set, iv, near)).find(Boolean); if (!sh) return null;
      near = sh.notes.reduce((a, n) => a + n[1], 0) / sh.notes.length;
      used.push(sh.name);
      if (!voicings.find(v => v.name === sh.name)) { const fr = [null, null, null, null, null, null]; sh.notes.forEach(([s, f]) => { if (fr[6 - s] == null) fr[6 - s] = f; }); voicings.push({ name: sh.name, frets: fr }); }
      const cell = cellOf(sh, spec.dir || 'updown'), n = Math.round(beats / step);
      for (let i = 0; i < n; i++) {
        const [s, f, x, pk] = cell[i % cell.length];
        const extra = spec.marks !== false && ci === 1 && i < cell.length && !x ? { pick: pk } : null;
        notes.push(tag(N(s, f, t, step, i === 0 ? null : x, extra), sh.pcs)); t += step;
      }
    }
  }
  if (!notes.length || notes.length > 400) return null;
  const last = notes[notes.length - 1];
  notes.push(tag(N(last.s, last.f, t, Math.max(1, Math.ceil((t + 1) / 4) * 4 - t), '~'), ALLOW.get(last)));
  const fill = s => String(s || '').replace('{chords}', used.slice(0, 8).join(' – ') + (used.length > 8 ? ' …' : '')).replace('{prog}', P.name).replace('{keys}', keyNames.join(', ')).replace('{sets}', [...new Set(sets.map(x => SETS[x].name))].join(', '));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'picking', method: spec.method, unit: UNIT.get(step) || '8th-note triplets', goal: spec.goal || 100, start: spec.start, minutes: spec.minutes || 6, dl: spec.dl || 0, picking: 'economy',
    voicings: voicings.slice(0, 8), chords: [...new Set(used)].slice(0, 8), backing: used.slice(0, 16),
    why: fill(spec.why), instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
const W_ = (id, name, method, opts) => c => swRun(c, { id, name, method, ...opts });
const HOW = 'Sweep: one downward push of the pick through the strings going up (each string a separate note, not a strum), hammer the extra top note, pull off, then one upward push back down. Lift each fretting finger as soon as its note has sounded, and rest the picking palm lightly on the strings you have left. ';

/* ------------------------------ Generators ------------------------------ */
/** An original 8-bar study (capstone): three-, four- and five-string sweeps, two chords a bar, diminished, ending. */
export function swEtude(c) {
  const k = c.minor ? c.key : mod12(c.key - 3), notes = [], used = [], voicings = []; let near = 7;
  const plan = [[0, 'm', '3top', 4, 1 / 3], [8, '', '3top', 4, 1 / 3], [5, 'm', '4str', 4, 0.25], [7, '', '4str', 4, 0.25], [0, 'm', '5str', 4, 1 / 6], [10, '', '5str', 4, 1 / 6], [8, '', '3top', 2, 1 / 6], [11, 'dim', '3top', 2, 1 / 6], [0, 'm', '3mid', 2, 1 / 6], [7, '', '3top', 2, 1 / 6]];
  let t = 0;
  for (const [d, q, set, beats, step] of plan) {
    const sh = sweepShape(mod12(k + d), q, set, 0, near) || sweepShape(mod12(k + d), q, set, 1, near); if (!sh) return null;
    near = sh.notes.reduce((a, n) => a + n[1], 0) / sh.notes.length; used.push(sh.name);
    if (!voicings.find(v => v.name === sh.name)) { const fr = [null, null, null, null, null, null]; sh.notes.forEach(([s, f]) => { if (fr[6 - s] == null) fr[6 - s] = f; }); voicings.push({ name: sh.name, frets: fr }); }
    const cell = cellOf(sh); for (let i = 0; i < Math.round(beats / step); i++) { const [s, f, x] = cell[i % cell.length]; notes.push(tag(N(s, f, t, step, i ? x : null), sh.pcs)); t += step; }
  }
  const root = sweepShape(k, 'm', '3top', 0, near); notes.push(tag(N(root.notes[0][0], root.notes[0][1], t, 4, '~'), root.pcs));
  return make(c, {
    id: 'sw-etude', name: `Capstone study: an 8-bar sweep piece (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer', unit: 'triplets, 16ths, then sextuplets', goal: 84, start: 50, minutes: 8, picking: 'economy',
    voicings, chords: [...new Set(used)], backing: used,
    why: 'An original piece that climbs through the whole path: three-string sweeps in triplets, four-string shapes in 16ths, five-string sweeps in sextuplets, then two chords a bar through a diminished chord and home.',
    instr: 'Learn it two bars at a time; the pulse stays the same while the note values get faster. Choose each shape near the last one, as written. Then write your own 8 bars on the same plan. Pass: the study at the goal tempo with no stops, then your own version played through once.',
    watch: 'Notes bleeding into a strum when the tempo rises: keep lifting the fingers.', simplify: 'Bars 1–4 only.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'sweepChanges', kind: 'technique', title: 'Sweeps through chord changes', domain: 'picking',
  re: /sweep(s|ing)? (through|over|across) (a |the )?(chord )?(changes|progression)|sweep(s|ing)? (with|on) chord changes|progression sweeps?/,
  aliases: ['sweep picking through changes', 'arpeggio sweeps over a progression'],
  summary: 'Arpeggios swept with one pick motion, a new shape for every chord: from the first two-string roll to three-, four- and five-string sweeps, inversions, two chords a bar, neoclassical and diminished changes.',
  prereqs: ['economyPicking', 'sweepPicking'],
  pedagogy: {
    date: '2026-10-23',
    summary: 'Taught as sweep picking applied to a progression: first even, separate notes in one shape with a metronome, then the triad shapes tied to the chord qualities (major 1-3-5, minor 1-♭3-5), then the same shape moved to each chord of a progression, with inversions, fragments and larger string sets so the hand stays near, then faster harmonic rhythm and full-range five-string shapes.',
    sequence: [
      { id: 'even', tier: 'foundations', step: 'Even, separate notes with a metronome', how: 'The two-string roll, then the three-string arpeggio played slowly and evenly in tempo, each note stopped before the next; long patterns split into an up half and a down half.', skills: ['sweep-motion'], source: 2 },
      { id: 'cell', tier: 'foundations', step: 'The three-string cell: the shape up, a hammer-on at the top, the way back', how: 'Pick the first note on each string and hammer the second note of the top string; the return is a pull-off and an upstroke sweep.', skills: ['sweep-triad'], source: 2 },
      { id: 'quality', tier: 'foundations', step: 'Triad shapes: major and minor of the same root', how: 'Major is 1-3-5 and minor 1-♭3-5; the minor shape is the major shape with the 3rd lowered a fret.', skills: ['sweep-quality'], source: 1 },
      { id: 'first', tier: 'foundations', step: 'The first progression', how: 'One triad per chord of a short progression, a new shape every two bars, played slowly.', skills: ['sweep-first-music'], source: 1 },
      { id: 'move', tier: 'intermediate', step: 'Moving the shape to every chord', how: 'Learn the shape, play the first chord up and down, then shift the same shape to each next chord; a minor-to-major switch changes the shape slightly.', skills: ['sweep-changes-3'], source: 0 },
      { id: 'four', tier: 'intermediate', step: 'More strings: the fourth string, then the fifth', how: 'Start with two or three strings and add the fourth string, then a sweep rooted on the fifth, slowly first.', skills: ['sweep-4'], source: 3 },
      { id: 'mix', tier: 'intermediate', step: 'Inversions and keys so the hand stays near', how: 'Mix inversions so the hand does not jump across the fretboard; the same shapes in other keys.', skills: ['sweep-mix'], source: 2 },
      { id: 'fragments', tier: 'intermediate', step: 'Reversed patterns and smaller fragments', how: 'The pattern played in reverse and as smaller arpeggio fragments (up-only and down-only), applied to the same progression.', skills: ['sweep-frag'], source: 2 },
      { id: 'style', tier: 'intermediate', step: 'Progressions in the style: harmonic minor and the Andalusian cadence', how: 'The shapes over a classical-sounding progression (the source uses a Pachelbel-type pattern), then neoclassical changes with a major V chord.', skills: ['sweep-music-i'], source: 1 },
      { id: 'five', tier: 'advanced', step: 'Five-string shapes', how: 'Link the fifth- and sixth-string shapes to cover more of the neck; slow practice first because the five-string sweep sounds fast.', skills: ['sweep-changes-5'], source: 3 },
      { id: 'fast', tier: 'advanced', step: 'Sextuplets and faster chord changes', how: 'The shape in six notes per beat (sextuplets) through the progression, one chord a bar and then two chords a bar.', skills: ['sweep-fast'], source: 0 },
      { id: 'voice', tier: 'advanced', step: 'Shapes chosen by position', how: 'Alternate inversions and string sets from chord to chord so each shape is the nearest one.', skills: ['sweep-adv-mix'], source: 2 },
      { id: 'dim', tier: 'advanced', step: 'Diminished chords and soloing over the changes', how: 'Add the diminished triad to harmonic-minor changes; outline the chords with sweeps and then melody notes.', skills: ['sweep-music-a'], source: 0 },
      { id: 'speed', tier: 'mastery', step: 'Performance tempo', how: 'Tempo ladder on the five-string shapes and on a long progression of four-string shapes.', skills: ['sweep-perf'], source: 4 },
      { id: 'any', tier: 'mastery', step: 'Any key, any set', how: 'Keys and string sets changed every block or bar so no shape can run on habit.', skills: ['sweep-random'], source: 2 },
      { id: 'study', tier: 'mastery', step: 'An original study', how: 'A study joining three-, four- and five-string sweeps through the changes, then your own.', skills: ['sweep-voice'], source: 5 }
    ],
    drills: ['The two-string roll with a metronome', 'The three-string arpeggio, each note stopped before the next', 'Splitting a long arpeggio into an up half and a down half', 'One shape moved to each chord of a progression', 'Mixing inversions so the hand stays in one area', 'Reversed patterns and up-only or down-only fragments', 'Sextuplet sweeps with one cell per beat', 'Two chords a bar', 'Tempo ladder on five-string shapes'],
    mistakes: ['Uneven or off-tempo sweeps from playing too fast too soon', 'Letting notes ring together like a strummed chord', 'Jumping across the fretboard instead of choosing the nearest inversion', 'Hesitating at each chord change instead of finding the next shape during the last cycle', 'Playing the minor-to-major switch with the wrong 3rd', 'Skipping slow practice of long five-string shapes'],
    sources: [
      { title: 'Using sweep picking and tapping to outline a chord progression', author: 'Guitar World', url: 'https://www.guitarworld.com/lessons/using-sweep-picking-and-tapping-outline-chord-progression-video' },
      { title: 'Sweeping Arpeggios', author: 'Guitar9', url: 'https://www.guitar9.com/node/6775' },
      { title: 'Sweep Picking 101', author: 'Guitar9', url: 'https://www.guitar9.com/node/5828' },
      { title: 'More Sweeping Arpeggio Shapes (You Should Know)', author: 'Guitar9', url: 'https://www.guitar9.com/columnist821.html' },
      { title: 'Sweep picking: how to get started', author: 'Guitar World', url: 'https://www.guitarworld.com/lessons/sweep-picking-how-to-get-started' },
      { title: 'The Shred Decoder\'s Guide to Sweep Picking', author: 'Premier Guitar', url: 'https://www.premierguitar.com/lessons/the-shred-decoders-guide-to-sweep-picking' }
    ]
  },
  sources: ['https://www.guitarworld.com/lessons/using-sweep-picking-and-tapping-outline-chord-progression-video', 'https://www.guitar9.com/node/6775', 'https://www.guitar9.com/node/5828', 'https://www.guitar9.com/columnist821.html', 'https://www.guitarworld.com/lessons/sweep-picking-how-to-get-started', 'https://www.premierguitar.com/lessons/the-shred-decoders-guide-to-sweep-picking'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The sweep motion',
      'Roll the pick through two and three strings in one motion with every note separate, sweep a three-string minor and major triad in triplets at 90 BPM with no notes ringing together, switch between the minor and major shape of one root, and sweep through i–♭VI–♭VII–i at two bars a chord.', [
        S('sweep-motion', 'One motion, separate notes', 'picking', 'The two-string roll; the arpeggio one note at a time.', [
          W_('sw-roll2', 'The roll: two strings in one push, two notes ({chords})', 'chunking', { prog: 'minorRock', sets: ['2str'], step: 0.5, goal: 92, start: 50, why: 'A sweep is a rake that plays notes: the pick pushes through the strings in one motion, and the fretting hand makes each note sound alone. Two strings is the smallest piece of that motion.', instr: 'Downstroke on the G string and keep pushing into the B string (one motion), then upstroke on the B and keep pulling into the G. Fret each note only while it sounds. Pass: 8 bars with two clearly separate notes every time.', watch: 'Two pick strokes instead of one push.', simplify: 'Quarter notes.' }),
          W_('sw-separate', 'One note at a time: the three-string shape, each note stopped before the next ({chords})', 'accurate-reps', { prog: 'minorRock', sets: ['3top'], step: 0.5, beats: 8, goal: 88, start: 48, why: 'The hardest part of sweeping is not the pick, it is stopping each note before the next one sounds. Counting only the arpeggios where no two notes ring together builds that muting first.', instr: HOW + 'Slowly, in 8th notes with a metronome: lift each finger (or roll off a shared fret) as the next note sounds. Count only clean cycles. Pass: 8 clean cycles in a row.', watch: 'Fingers pressing down as a chord: it sounds like a strum.', simplify: 'Quarter notes.' })],
          ST('Sweep picking plays one note per string with a single continuous pick motion: down through the strings going up, up through them going down. The fretting hand releases each note as the next one sounds.', 'It is the most efficient way to play arpeggios fast; without muting it is just a strum.', ['One pick motion per direction, not one stroke per note.', 'Roll the fingertip when two notes share a fret on neighbouring strings.', 'The first goal is even notes in tempo, not speed.'])),
        S('sweep-triad', 'The first sweep', 'picking', 'A three-string triad, in time; listening for separation.', [
          W_('sw-3top-one', 'The three-string sweep on one chord, in triplets ({chords})', 'accurate-reps', { prog: 'minorRock', sets: ['3top'], beats: 8, step: 1 / 3, goal: 92, start: 48, why: 'Three strings and an extra hammered top note make the classic six-note sweep cell, one per two beats in triplets: the shape every sweep player starts with.', instr: HOW + 'Two bars per chord. Count only cycles where every note is separate. Pass: 4 clean cycles in a row on each chord.', watch: 'Rushing the upward sweep back down.', simplify: '8th notes.' }),
          W_('sw-listen', 'Hear each note start and stop: minor and major, the same sweep ({chords})', 'external-focus', { prog: 'keyChords', sets: ['3top'], beats: 8, step: 1 / 3, goal: 92, start: 48, why: 'A good sweep sounds like a fast arpeggio, never like a strum. Listening for one note at a time (rather than watching the hands) fixes both the pick and the muting.', instr: HOW + 'Listen to each cycle: can you hear every note start and stop? If two notes ring together, slow down until they don’t. Pass: every cycle heard as separate notes, 2 bars per chord.', watch: 'Accepting a blur at speed: slow down.', simplify: 'Only the first two chords.' })],
          ST('The three-string sweep cell: strings 3-2-1 one note each, a hammered top note, a pull-off and the sweep back.', 'It is the shape behind most sweep licks and the building block for the larger shapes.', ['The shape is a triad: root, 3rd and 5th, with the root repeated on top.', 'Triplets put one cell on every two beats.', 'Pick the first note on each string; the second note of the top string is hammered.'])),
        S('sweep-quality', 'Major and minor of one root', 'fretting', 'The same root, minor then major: the 3rd moves.', [
          W_('sw-quality-pair', 'One root, minor then major: only the 3rd moves ({chords})', 'chunking', { prog: 'pair', sets: ['3top'], beats: 8, step: 1 / 3, goal: 92, start: 48, why: 'A minor triad is the major triad with its middle note (the 3rd) lowered one fret. Switching between them on one root shows that the shape barely changes while the sound does.', instr: HOW + 'Two bars minor, two bars major, on the same root. Only the middle note of the shape changes; keep the rest of the hand where it is. Pass: 4 clean cycles of each, switching with no gap, twice through.', watch: 'Moving the whole hand at the switch instead of just the 3rd.', simplify: 'Four bars on each quality.' }),
          W_('sw-quality-mid', 'The same switch on strings 4-3-2: minor, then major ({chords})', 'chunking', { prog: 'pair', sets: ['3mid'], beats: 8, step: 1 / 3, goal: 88, start: 46, why: 'The minor-to-major switch on a lower string set: the same idea, a darker sound, and the muting now has to cover the high e.', instr: HOW + 'Strings 4-3-2, two bars on each quality. Mute the high e with the underside of the fretting fingers. Pass: twice through, every note separate.', watch: 'The high e ringing after the sweep.', simplify: 'Four bars on each quality.' })],
          ST('A triad is root, 3rd and 5th. Minor has a ♭3 (three frets above the root on the same string); major has a natural 3 (four frets).', 'Swapping one note is how you change from a minor chord to its major in the middle of a progression.', ['Major is 1-3-5, minor is 1-♭3-5.', 'On a sweep shape the 3rd is the middle note; it moves one fret.'])),
        S('sweep-first-music', 'First music', 'improv', 'Sweeping through a progression, two bars a chord.', [
          W_('sw-first-changes', 'First changes: {prog}, two bars a chord ({chords})', 'transfer', { prog: 'minorRock', sets: ['3top'], beats: 8, step: 1 / 3, goal: 92, start: 48, why: 'Two bars per chord gives the hand time to see the next shape before it arrives: the first time the sweep follows the harmony.', instr: HOW + 'Change shape on beat 1; find the next shape during the last cycle. Pass: the progression twice without a gap at a change.', watch: 'Stopping at the change.', simplify: 'Four bars per chord.' }),
          W_('sw-first-major', 'A major-key progression: {prog} ({chords})', 'transfer', { prog: 'keyChords', sets: ['3top'], beats: 8, step: 1 / 3, goal: 92, start: 48, why: 'The same motion over the main chords of the key: major and minor shapes alternate, so the 3rd moves under the same fingers.', instr: HOW + 'Two bars per chord. Play it as music: a slight accent on the first note of each bar. Pass: twice through in time.', watch: 'The 3rd landing on the wrong fret when the chord quality changes.', simplify: 'Four bars per chord.' })],
          ST('Sweeping through changes means a new triad shape for every chord, chosen near the last one.', 'This is how players outline harmony with arpeggios at speed.', ['Look for the shape that is closest, not the one you know best.', 'Find the next shape during the last cycle of the current chord.']))
      ], [1, 3]),
    stage('intermediate', 'Shapes, sets and inversions in time',
      'Sweep three-string shapes through a progression at one chord a bar in triplets at 100 BPM on two string sets and in inversions, sweep four-string shapes in 16ths, change key and string set between blocks, play one-way sweep fragments through the changes, and play neoclassical and Andalusian changes.', [
        S('sweep-changes-3', 'Three-string sweeps through changes', 'picking', 'One chord per bar; another string set; inversions.', [
          W_('sweep-changes-3', '3-string sweeps through {chords}', 'variable', { prog: 'keyChords', sets: ['3top'], step: 1 / 3, goal: 108, start: 50, why: 'Sweeping one shape is a trick; sweeping through chord changes is music. Each bar is a new chord, so you must see the next shape before you get there and keep the pick flowing through the change.', instr: HOW + 'One chord per bar, the next shape near the last. Pass: the changes land on beat 1 with no gap, twice through.', watch: 'A hesitation at each chord change.', simplify: 'Two bars per chord.' }),
          W_('sw-3mid', 'The middle string set (4-3-2) through {chords}', 'variable', { prog: 'keyChords', sets: ['3mid'], step: 1 / 3, goal: 104, start: 50, why: 'The same cell one string set lower: a darker sound, and the muting now has to cover strings on both sides.', instr: HOW + 'Strings 4-3-2. Mute the high e with the underside of the fretting fingers. Pass: twice through with no open strings ringing.', watch: 'The high e ringing after the sweep.', simplify: 'Two bars per chord.' }),
          W_('sw-inversions', 'Inversions: each chord in root position, 1st and 2nd inversion ({chords})', 'variable', { prog: 'minorRock', sets: ['3top'], invs: [0, 1, 2], reps: 3, step: 1 / 3, goal: 100, start: 48, why: 'Starting the shape on the 3rd or the 5th instead of the root gives three shapes per chord in three places: more ways to stay near the hand and smoother changes.', instr: HOW + 'Each chord in turn cycles through root position, 1st inversion (from the 3rd) and 2nd inversion (from the 5th). Look at which chord tone is lowest in each bar. Pass: all 12 bars in time.', watch: 'Losing the chord when the bottom note is not the root.', simplify: 'Root position and 1st inversion only.' })],
          ST('A triad can start on any of its tones: root position, 1st inversion (3rd at the bottom), 2nd inversion (5th at the bottom). Each gives a different sweep shape on the same strings.', 'Inversions let the hand stay in one area while the chords change.', ['Each inversion shifts the shape up the neck by about 3–5 frets.', 'Strings 4-3-2 use the same idea one string lower.'])),
        S('sweep-4', 'Four strings', 'picking', 'Strings 4-3-2-1 in 16ths.', [
          W_('sw-4-one', 'Four-string shapes, one chord at a time, in 16ths ({chords})', 'chunking', { prog: 'minorRock', sets: ['4str'], step: 0.25, beats: 8, goal: 96, start: 48, why: 'Four strings and a hammered top note make an eight-note cell: two beats in 16ths. Learn it in halves (the lower two strings, then the top two) before sweeping it whole.', instr: HOW + 'First loop strings 4-3 alone, then 2-1 with the hammer and pull, then the whole cell. Two bars per chord. Pass: 4 clean cycles per chord.', watch: 'The middle strings sounding together where two notes share a fret.', simplify: 'Triplets, half tempo.' }),
          W_('sw-4-changes', 'Four-string sweeps through {chords}, one chord a bar', 'variable', { prog: 'keyChords', sets: ['4str'], step: 0.25, goal: 100, start: 50, why: 'The four-string shape through the changes: a fuller arpeggio and a longer sweep to keep even.', instr: HOW + 'One chord per bar, two cycles each. Pass: twice through with every change on beat 1.', watch: 'The upward sweep running faster than the downward one.', simplify: 'Two bars per chord.' })],
          ST('The four-string shape adds the D string: a longer sweep with one more note to mute.', 'Bigger shapes give longer, more dramatic arpeggios.', ['Cell: 4 notes up, a hammered top note, 3 back down = 8 notes, two beats of 16ths.', 'Add strings one at a time, slowly.'])),
        S('sweep-mix', 'Keys and shapes mixed', 'fretboard', 'A new key or string set every bar.', [
          W_('sw-keys', 'Four keys: the progression in {keys}', 'interleaving', { prog: 'minorRock', sets: ['3top'], keys: [0, 5, 10, 3], step: 1 / 3, goal: 100, start: 50, why: 'The shapes are movable: changing key every block forces you to find each shape again rather than repeat a memorised path.', instr: HOW + 'One chord a bar; a new key every four bars ({keys}). Pass: all four keys without stopping.', watch: 'Stopping to find the new key: lower the tempo instead.', simplify: 'Two keys.' }),
          W_('sw-sets-mix', 'String sets interleaved: 3-2-1, 4-3-2, 4-3-2-1, a new set every bar ({chords})', 'interleaving', { prog: 'keyChords', sets: ['3top', '3mid', '4str'], reps: 3, step: 1 / 3, goal: 96, start: 48, why: 'Changing string set every bar while the chords change trains the hand to see each chord in several shapes.', instr: HOW + 'The set changes every bar (3-2-1, then 4-3-2, then 4-3-2-1), the chord too. Pass: all 12 bars in time.', watch: 'Defaulting to strings 3-2-1.', simplify: 'Two sets only.' })],
          ST('Every chord exists in every key and on several string sets; mixing them builds a map rather than a habit.', 'Real progressions don’t sit in one key or shape.', ['Find the root of the next chord first, then build the shape around it.'])),
        S('sweep-frag', 'Fragments and one-way sweeps', 'picking', 'Up-only and down-only fragments through the changes.', [
          W_('sw-up-frag', 'Ascending fragments: a four-note up-sweep on every beat ({chords})', 'chunking', { prog: 'keyChords', sets: ['3top'], dir: 'up', step: 0.25, goal: 88, start: 46, why: 'The smaller fragment of the arpeggio: one downward sweep, then the pick jumps back to start again. It isolates the up-sweep, the half of the cell most players find easier.', instr: HOW + 'Play only the way up: down-sweep, lift the pick back to the lowest string, repeat, four fragments a bar, one chord a bar. Pass: twice through, each fragment four separate notes.', watch: 'Dragging the pick back across the strings on the return.', simplify: 'Two bars per chord.' }),
          W_('sw-down-frag', 'Descending fragments: a four-note down-sweep on every beat ({chords})', 'chunking', { prog: 'keyChords', sets: ['3mid'], dir: 'down', step: 0.25, goal: 84, start: 44, why: 'The mirror fragment, an up-stroke sweep coming down the strings: the half of the cell that usually lags. Practised alone, it catches up.', instr: HOW + 'Play only the way down: start on the top note, pull off, sweep with upstrokes to the lowest string, then jump back. Four fragments a bar, one chord a bar. Pass: twice through with four separate notes every time.', watch: 'The pull-off thinning out after the first note.', simplify: 'Two bars per chord.' })],
          ST('A sweep arpeggio can be broken into smaller fragments, and the pattern can be played in reverse, to apply the same shapes in new ways.', 'The up half and the down half of a cell are different motions; isolating them is how each is fixed.', ['Up: one downstroke through the strings.', 'Down: a pull-off, then one upstroke through the strings.'])),
        S('sweep-music-i', 'Neoclassical changes', 'improv', 'Harmonic minor and the Andalusian cadence.', [
          W_('sw-neo', 'Neoclassical: {prog} ({chords})', 'transfer', { prog: 'neo', sets: ['3top', '4str'], step: 1 / 3, reps: 2, goal: 100, start: 50, why: 'The major V chord in a minor key (from the harmonic minor scale) is the sound of neoclassical rock: the leading tone pulling back to the root.', instr: HOW + 'One chord per bar, alternating three- and four-string shapes. Play it as music: a slight crescendo into the V chord. Pass: twice through in time.', watch: 'Playing the V as minor: its 3rd is the raised 7th of the key.', simplify: 'Three-string shapes only.' }),
          W_('sw-andalusian', 'The Andalusian cadence: {prog} ({chords})', 'transfer', { prog: 'andalusian', sets: ['3top'], invs: [0, 1], step: 1 / 3, reps: 2, goal: 100, start: 50, why: 'Four chords stepping down to the V (the flamenco and neoclassical cadence): with inversions the shapes walk down the neck together.', instr: HOW + 'One chord per bar, root position and 1st inversion alternating. Pass: twice through with every change in time.', watch: 'Jumping across the neck: choose the inversion nearest the last shape.', simplify: 'Root position only.' })],
          ST('Neoclassical harmony uses the harmonic minor: a major V (and a diminished vii°) in a minor key.', 'Sweeps through these changes are a staple of neoclassical rock and fusion.', ['A minor: Am – Dm – E – Am; the E chord holds G♯, the leading tone.']))
      ], [4, 6]),
    stage('advanced', 'Five strings, two chords a bar',
      'Sweep five-string shapes through the key’s chords in sextuplets, play three-string sweeps two chords a bar at 90 BPM in sextuplets, change string set and inversion every bar, choose the nearest shape for each chord of an eight-chord progression, and sweep a diminished harmonic-minor progression and a solo over it.', [
        S('sweep-changes-5', 'Five-string sweeps', 'picking', 'A-string shapes, one chord at a time and through the changes.', [
          W_('sw-5-one', 'Five-string shapes, one chord at a time ({chords})', 'chunking', { prog: 'minorRock', sets: ['5str'], step: 1 / 6, beats: 8, goal: 84, start: 42, why: 'The five-string shape (two notes on the A string, one on each middle string, two on the high e) is the big neoclassical sweep. Learn it in two halves: strings 5-4-3, then 3-2-1.', instr: HOW + 'Loop each half, then the whole cell (12 notes, two beats of sextuplets). Two bars per chord. Pass: 4 clean cycles per chord.', watch: 'The low notes ringing into the high ones: mute with the picking palm as it moves.', simplify: 'Triplets, half tempo.' }),
          W_('sweep-changes-5', '5-string sweeps through {chords}', 'variable', { prog: 'keyChords', sets: ['5str'], step: 1 / 6, goal: 76, start: 40, why: 'Five-string sweeps through the key’s chords: each bar a new A-string shape, chosen near the last one.', instr: HOW + 'One chord per bar: root on the A string, hammer to the next tone, sweep up, hammer the top note, pull off and sweep back. Pass: each chord clean twice at the goal tempo, with no notes ringing together.', watch: 'Uneven speed: the upward sweep rushing.', simplify: 'The 3-string version of the same changes.' })],
          ST('The five-string shape spans root to two octaves above, with the hammer-ons at both ends.', 'It is the signature big sweep of neoclassical and shred playing.', ['Cell: 7 notes up, 5 back down = 12 notes, two beats of sextuplets.', 'Practise it slowly first: it sounds fast even at a low tempo.'])),
        S('sweep-fast', 'Faster changes', 'picking', 'Sextuplets; two chords a bar.', [
          W_('sweep-changes-3-fast', '3-string sweeps in sextuplets through {chords}', 'variable', { prog: 'keyChords', sets: ['3top'], step: 1 / 6, goal: 80, start: 42, why: 'In sextuplets the cell fits one beat: four cells per chord, the same motion twice as fast.', instr: HOW + 'One cell per beat, one chord per bar. Pass: twice through with the changes on beat 1.', watch: 'The sweep turning into a strum at speed.', simplify: 'Triplets.' }),
          W_('sw-half', 'Two chords a bar: {chords}', 'variable', { prog: 'long', sets: ['3top'], beats: 2, step: 1 / 6, goal: 80, start: 42, why: 'Changing chord every two beats is the density of real neoclassical lines: the next shape has to be ready after two cells.', instr: HOW + 'Two cells per chord, eight chords in four bars. Pass: the progression twice without a gap.', watch: 'Late changes on beat 3.', simplify: 'One chord a bar.' })],
          ST('Faster harmonic rhythm (two chords a bar) is harder than faster notes.', 'Neoclassical lines move the harmony fast.', ['Look one chord ahead.', 'Sextuplets: six notes per beat, the 3-string cell fits one beat.'])),
        S('sweep-adv-mix', 'On the fly', 'fretboard', 'Random set and inversion; the nearest shape.', [
          c => { const r = rng(83 + (c.lvl || 7)); const sets = Array.from({ length: 8 }, () => ['3top', '3mid', '4str'][Math.floor(r() * 3)]), invs = Array.from({ length: 8 }, () => Math.floor(r() * 3)); return swRun(c, { id: 'sw-random-shape', name: 'A random string set and inversion every bar ({chords})', method: 'interleaving', prog: 'keyChords', sets, invs, reps: 2, step: 1 / 6, goal: 80, start: 42, why: 'Unpredictable shapes, chosen for you every bar, train the hand to find any triad on any set.', instr: HOW + `The plan: ${sets.map((s, i) => `${SETS[s].name}, ${INV[invs[i]]}`).join(' · ')}. Pass: all 8 bars in time.`, watch: 'Falling back to root position.', simplify: 'Triplets.' }); },
          W_('sw-nearest', 'Nearest-shape voice leading: the inversions stay in one area, {prog}', 'chunking', { prog: 'long', sets: ['3top'], invs: [0, 1, 2, 1, 0, 2, 1, 0], step: 1 / 3, goal: 96, start: 48, why: 'Each shape is chosen nearest the last, so the arpeggios walk along the neck instead of jumping. Seeing where the hand already is tells you which inversion to take.', instr: HOW + 'Before each bar line, look at the next chord ({chords}) and take the inversion nearest your hand (the tab shows the choice). Pass: all 8 bars in time, no jump of more than a few frets.', watch: 'Jumping back to a favourite shape.', simplify: 'The first four chords.' })],
          ST('Any triad, any set, any inversion: chosen by where the hand is.', 'This is how fluent sweep players make arpeggios sound melodic.', ['The nearest shape usually keeps one or two notes in common with the last.'])),
        S('sweep-music-a', 'Diminished and a solo', 'improv', 'Harmonic-minor changes with a diminished chord; soloing over them.', [
          W_('sw-dim', 'Harmonic minor with a diminished chord: {prog} ({chords})', 'transfer', { prog: 'dim', sets: ['3top', '4str'], step: 1 / 6, reps: 2, goal: 80, start: 42, why: 'The diminished vii° (three minor 3rds) is the tension chord of harmonic minor: swept, it gives the dramatic neoclassical sound before resolving.', instr: HOW + 'One chord per bar; the diminished shape has the 5th one fret lower than a minor shape. Pass: twice through with the diminished chord in tune.', watch: 'Playing the diminished chord as minor.', simplify: 'Three-string shapes only, triplets.' }),
          c => targetGuide(c, { prog: 'andalusian', scale: 'harmonicMinor', name: 'Solo over the Andalusian cadence: sweep a chord, then a melody, landing on chord tones' })],
          ST('The diminished triad (R ♭3 ♭5) is built from two minor 3rds.', 'It adds tension that resolves to the i chord.', ['vii° in A harmonic minor: G♯ – B – D.']))
      ], [7, 8]),
    stage('mastery', 'At speed, anywhere, your own',
      'Sweep five-string shapes in sextuplets at 90 BPM and four-string shapes through 8 chords at speed, keys and shapes changing every bar, six keys in a row around the cycle of fourths, and perform your own 8-bar sweep study.', [
        S('sweep-perf', 'Performance tempo', 'picking', 'The big shapes at speed.', [
          W_('sw-5-fast', 'Five-string sweeps at speed through {prog}', 'edge', { prog: 'neo', sets: ['5str'], step: 1 / 6, reps: 2, goal: 84, start: 50, why: 'The biggest shape at performance tempo: only a relaxed, continuous motion survives.', instr: HOW + 'Tempo ladder: start at the start tempo, add 3 BPM after every clean pass. Pass: two clean passes at the goal tempo.', watch: 'Tension in the picking forearm.', simplify: 'Three-string shapes at the same tempo.' }),
          W_('sw-4-fast', 'Four-string sweeps through 8 chords at speed ({chords})', 'edge', { prog: 'long', sets: ['4str'], step: 0.25, goal: 100, start: 56, why: 'Eight chords in 16ths: a long stretch of changes at speed.', instr: HOW + 'Tempo ladder to the goal. Pass: two clean passes at the goal tempo.', watch: 'Notes smearing together at the top.', simplify: 'The first four chords.' })],
          ST('Performance tempo comes from small tempo steps over clean passes.', 'At speed the motion must stay as small and relaxed as when slow.', ['Add 3 BPM only after two clean passes.'])),
        S('sweep-random', 'Anywhere, on demand', 'fretboard', 'Mixed keys and sets; the cycle of fourths.', [
          W_('sw-random-keys', 'Mixed keys: {keys}', 'interleaving', { prog: 'neo', sets: ['3top', '4str', '3mid', '5str'], keys: [0, 7, 3, 10], step: 1 / 6, goal: 80, start: 46, why: 'A new key and set every bar, at speed: nothing can run on habit.', instr: HOW + 'Key changes every block ({keys}); set changes every bar. Pass: all 16 bars in time.', watch: 'Freezing at the key change: look at the next root during the last cycle.', simplify: 'Two keys.' }),
          W_('sw-fourths', 'Around the cycle of fourths: {keys}', 'interleaving', { prog: 'minorRock', sets: ['3top'], keys: [0, 5, 10, 3, 8, 1], step: 1 / 3, goal: 100, start: 52, why: 'Six keys in a row, each a fourth above the last: the same shapes on six different roots.', instr: HOW + 'One chord a bar, a new key every four bars ({keys}). Pass: all six keys in time without stopping.', watch: 'Losing the ♭VI and ♭VII in flat keys.', simplify: 'Three keys.' })],
          ST('At mastery any chord in any key comes out on demand.', 'Mixed practice transfers best.', ['Find the root first, then the shape.'])),
        S('sweep-voice', 'Your own voice', 'improv', 'A study, then your own.', [c => swEtude(c), c => targetGuide(c, { prog: 'neo', scale: 'harmonicMinor', name: 'Neoclassical solo: sweep bursts on each chord, then a melody that lands on the 3rd' })],
          ST('A capstone study uses every shape of the path, then becomes your own.', 'Mastery is using sweeps musically: as arpeggios that follow the harmony, between melodies.', ['Plan where each sweep starts and lands.']))
      ], [9, 10])
  ]
});
