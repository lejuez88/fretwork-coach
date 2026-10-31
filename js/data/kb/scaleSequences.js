// Scale sequences: a short pattern of scale steps repeated up and down a scale (groups of three and four,
// thirds, step-backs, 1-3-2-4, interval sequences, six-note and nine-note cells, string-skipping cells).
// Foundations: groups of three and four on a few strings, coming down, thirds and step-backs; intermediate:
// 1-3-2-4, other positions, interval sequences, legato versions, phrases; advanced: longer cells,
// string skipping, 16ths, phrases over progressions; mastery: tempo, mixed cells, studies.
//
// Concept-first (CONTENT.md): the scale is the three-notes-per-string position of threeNps.js (18 notes in
// ascending order, a "ladder"). A sequence is a cell of ladder steps repeated one step higher each time; the
// descending form is the same cell mirrored from the top. Every note is a scale tone by construction.
//
// Teaching method first (see `pedagogy` below), researched 2026-10-31.
import { S, stage, entry } from '../lib.js';
import { run, barsRun, PROGS, ALLOW } from './threeNps.js';
export { ALLOW };

const ST = (concept, why, theory) => ({ concept, why, theory });
const G = (id, method, spec) => c => run(c, id, method, spec);
const B = (id, method, spec) => c => barsRun(c, id, method, spec);
const one = (k, extra) => [{ k, ...extra }];
const LOW = [0, 3];

/* ------------------------------ Foundations ------------------------------ */
const threesLow = G('sq-threes-low', 'chunking', { name: 'Groups of three on the four lowest strings ({key})', unit: '8th-note triplets', goal: 70, start: 45, minutes: 4,
  passes: one(0, { seq: 'threes', g: LOW, dir: 'both' }),
  why: 'Teachers start with a group of three notes (1-2-3, 2-3-4, 3-4-5 …) climbing the scale, one step higher each time.',
  instr: 'In position 1, play three notes, then start again one scale note higher, up to the top of the four lowest strings and back down the same way. Strict alternate picking: because three is odd, the group starts on a down stroke, then an up stroke, and so on. Pass: 4 round trips with no wrong note and the picking never changing.',
  watch: 'Losing the alternating pick direction at the start of each group.', simplify: 'Play in 8th notes and count the groups aloud.' });
const threesFull = G('sq-threes-full', 'accurate-reps', { name: 'Groups of three on all six strings ({key})', unit: '8th-note triplets', goal: 75, start: 50,
  passes: one(0, { seq: 'threes', dir: 'both' }),
  why: 'The same sequence across the whole position.',
  instr: 'Run the groups of three over all six strings of position 1, up and back. Pass: 3 round trips even.',
  watch: 'Rushing as the groups cross to the thin strings.', simplify: 'The four lowest strings.' });
const foursLow = G('sq-fours-low', 'chunking', { name: 'Groups of four on the four lowest strings ({key})', unit: '8th notes', goal: 80, start: 50, minutes: 4,
  passes: one(0, { seq: 'fours', g: LOW, dir: 'both' }),
  why: 'Groups of four (1-2-3-4, 2-3-4-5 …) fit the 8th-note pulse, so each group sits in one beat.',
  instr: 'Play four notes, then start again one scale note higher, up the four lowest strings of position 1 and back. Build the pattern first, then get it clean, then speed it up. Pass: 4 round trips with every group starting on the beat.',
  watch: 'Slipping off the beat as the groups cross a string.', simplify: 'Two strings at a time.' });
const foursFull = G('sq-fours-full', 'accurate-reps', { name: 'Groups of four on all six strings ({key})', unit: '8th notes', goal: 85, start: 55,
  passes: one(0, { seq: 'fours', dir: 'both' }),
  why: 'The full position in fours.',
  instr: 'Pass: 3 round trips even over all six strings.', watch: 'Skipping the string change.', simplify: 'The four lowest strings.' });
const foursDown = G('sq-fours-down', 'accurate-reps', { name: 'Groups of four coming down ({key})', unit: '8th notes', goal: 80, start: 50,
  passes: one(0, { seq: 'fours', g: LOW, dir: 'down' }),
  why: 'Coming down the same cell is a different movement for the hand and gets its own repetitions.',
  instr: 'Start on the highest note of the four lowest strings and play a group of four descending, then start one scale note lower. Pass: 6 descents with no wrong note.',
  watch: 'Fingers lifting too high on the way down.', simplify: 'Two strings at a time.' });
const vamp = B('sq-vamp', 'transfer', { name: 'Sequence phrases over a vamp ({key}: {chords})', prog: PROGS.vamp, pats: ['tri3', 'f4'], dirs: ['up', 'down'], pos: 0, reps: 2, goal: 80, start: 55,
  why: 'A sequence is only a tool until it is used over chords. Each bar here is a threes or fours cell that lands on a chord tone.',
  instr: 'Play the bars over {chords}. Each bar is eight 8th notes and ends on a tone of its chord. Pass: 8 bars at the goal tempo.',
  watch: 'Stopping the pick hand at the bar line.', simplify: 'Four bars.' });
const thirdsLow = G('sq-thirds-low', 'chunking', { name: 'Scale in thirds on the four lowest strings ({key})', unit: '8th notes', goal: 85, start: 55,
  passes: one(0, { seq: 'thirds', g: LOW, dir: 'both' }),
  why: 'A teaching source adds a third pattern that skips a scale note each time (1-3, 2-4, 3-5 …).',
  instr: 'Play a note and the note two scale steps above it, then start one scale note higher. Up the four lowest strings of position 1 and back. Pass: 4 round trips even.',
  watch: 'Landing on the neighbouring note instead of skipping one.', simplify: 'Two strings.' });
const stepBackLow = G('sq-stepback-low', 'chunking', { name: 'Step-back pattern on the four lowest strings ({key})', unit: '8th notes', goal: 85, start: 55,
  passes: one(0, { seq: 'stepBack', g: LOW, dir: 'both' }),
  why: 'The fourth pattern plays a scale note, then the note just below it, and moves up.',
  instr: 'Play note 2 then note 1, note 3 then note 2, and so on up the four lowest strings of position 1 and back. Pass: 4 round trips even.',
  watch: 'Getting the order of the pair backwards.', simplify: 'Two strings.' });

/* ------------------------------ Intermediate ------------------------------ */
const skip13 = G('sq-skip13', 'chunking', { name: 'The 1-3-2-4 cell on all strings ({key})', unit: '8th notes', goal: 90, start: 60,
  passes: one(0, { seq: 'skip13', dir: 'both' }),
  why: 'A cell that skips and steps back (1-3-2-4, 2-4-3-5 …) is a common next sequence.',
  instr: 'Play scale notes 1, 3, 2, 4 then repeat starting one higher, up all six strings of position 1 and back. Pass: 3 round trips even.',
  watch: 'Playing 1-2-3-4.', simplify: 'The four lowest strings.' });
const skip13p3 = G('sq-skip13-p3', 'interleaving', { name: 'The 1-3-2-4 cell in position 3 ({key})', unit: '8th notes', goal: 90, start: 60,
  passes: one(2, { seq: 'skip13', dir: 'both' }),
  why: 'The same cell in a different position.',
  instr: 'Pass: 3 round trips even.', watch: 'Fretting the shape you know best.', simplify: 'The four lowest strings.' });
const foursP2 = G('sq-fours-p2', 'interleaving', { name: 'Groups of four in position 2 ({key})', unit: '8th notes', goal: 95, start: 62,
  passes: one(1, { seq: 'fours', dir: 'both' }),
  why: 'The sources keep the same sequence and move it to other positions.',
  instr: 'Pass: 3 round trips even.', watch: 'Rushing the shape you know less.', simplify: 'Four lowest strings.' });
const foursP4 = G('sq-fours-p4', 'interleaving', { name: 'Groups of four in position 4 ({key})', unit: '8th notes', goal: 95, start: 62,
  passes: one(3, { seq: 'fours', dir: 'both' }),
  why: 'Another position, the same cell.',
  instr: 'Pass: 3 round trips even.', watch: 'Fingering changes between strings.', simplify: 'Four lowest strings.' });
const threesP3 = G('sq-threes-p3', 'interleaving', { name: 'Groups of three in position 3 ({key})', unit: '8th-note triplets', goal: 80, start: 52,
  passes: one(2, { seq: 'threes', dir: 'both' }),
  why: 'Groups of three in a different position.',
  instr: 'Pass: 3 round trips with the picking alternating.', watch: 'Flipping the pick direction wrongly.', simplify: 'Four lowest strings.' });
const thirdsFull = G('sq-thirds-full', 'chunking', { name: 'Thirds on all six strings ({key})', unit: '8th notes', goal: 95, start: 62,
  passes: one(0, { seq: 'thirds', dir: 'both' }),
  why: 'The thirds pattern across the full position.',
  instr: 'Pass: 3 round trips even.', watch: 'Stumbling at string changes.', simplify: 'Four lowest strings.' });
const fourths = G('sq-fourths', 'chunking', { name: 'Fourths: each note and the one three steps above ({key})', unit: '8th notes', goal: 90, start: 58,
  passes: one(0, { seq: 'fourths', dir: 'both' }),
  why: 'A wider interval sequence: the note and the one three scale steps above (a fourth in the scale).',
  instr: 'Play note 1 and note 4, note 2 and note 5, and so on across position 1 and back. Pass: 3 round trips even.',
  watch: 'Playing thirds by habit.', simplify: 'Four lowest strings.' });
const sixths = G('sq-sixths', 'chunking', { name: 'Sixths: each note and the one five steps above ({key})', unit: '8th notes', goal: 90, start: 58,
  passes: one(0, { seq: 'sixths', dir: 'both' }),
  why: 'A wide interval sequence that crosses strings on every pair.',
  instr: 'Play note 1 and note 6, note 2 and note 7, and so on. Pass: 3 round trips even.',
  watch: 'Choking the pick on the string change.', simplify: 'Slow down.' });
const legFours = G('sq-fours-legato', 'chunking', { name: 'Groups of four as hammer-ons and pull-offs ({key})', unit: '8th notes', goal: 85, start: 55,
  passes: one(0, { seq: 'fours', dir: 'both', legato: true }),
  why: 'A teaching source shows the same sequence as a legato version: pick the first note on each string and hammer or pull the rest.',
  instr: 'Pick only the first note on each string, hammer up and pull off down. Pass: 3 round trips with every hammered note as loud as the picked one.',
  watch: 'Weak pull-offs on the way down.', simplify: 'Two strings.' });
const legThrees = G('sq-threes-legato', 'chunking', { name: 'Groups of three as hammer-ons and pull-offs ({key})', unit: '8th-note triplets', goal: 75, start: 50,
  passes: one(0, { seq: 'threes', dir: 'both', legato: true }),
  why: 'Groups of three work the left hand.',
  instr: 'Pass: 3 round trips even.', watch: 'Uneven notes.', simplify: 'Two strings.' });
const phrases1 = B('sq-phrases-1', 'transfer', { name: 'Sequence phrases through a four-chord loop ({key}: {chords})', prog: PROGS.fourChords, pats: ['tri3', 'iv4', 'f4', 'th'], dirs: ['up', 'down'], pos: [0, 1], reps: 2, goal: 90, start: 60,
  why: 'Different cells on different chords: how sequences become phrases.',
  instr: 'Pass: 8 bars over {chords}.', watch: 'Using one cell for all bars.', simplify: 'Four bars.' });

/* ------------------------------- Advanced ------------------------------- */
const sixBack = G('sq-sixback', 'chunking', { name: 'Six notes up, two back, on the lowest strings ({key})', unit: '8th notes', goal: 90, start: 58,
  passes: one(0, { seq: 'sixBack', g: LOW, dir: 'both' }),
  why: 'A longer cell: a run of six notes, back two, and again.',
  instr: 'Ascend six notes, go back two, and ascend six more. Then turn at the top and descend the same way. Pass: 3 round trips.',
  watch: 'Losing count of the step back.', simplify: 'Groups of four.' });
const nines = G('sq-nines', 'chunking', { name: 'Nine-note cells across three strings ({key})', unit: '8th notes', goal: 90, start: 58,
  passes: one(0, { seq: 'nines', dir: 'both' }),
  why: 'Nine notes cover three strings; each next cell starts one string higher.',
  instr: 'Start on the lowest string, ascend nine notes, then move one string back and repeat. Turn at the top and descend likewise. Pass: 2 round trips.',
  watch: 'Starting the cell on the wrong string.', simplify: 'Six-note cells.' });
const strSkip = G('sq-strskip', 'chunking', { name: 'String-skipping cells ({key})', unit: '8th notes', goal: 85, start: 55,
  passes: one(0, { seq: 'strSkip', dir: 'both' }),
  why: 'A cell that takes three notes on a string, skips one, and comes back.',
  instr: 'Play three notes on the lowest string, skip a string for three notes, return to the string you skipped, then go on. Pass: 2 round trips.',
  watch: 'Aiming at the wrong string.', simplify: 'Four lowest strings.' });
const chain = G('sq-chain', 'chunking', { name: 'Linking the cells: scale, six-back, nines, string skips ({key})', unit: '8th notes', goal: 90, start: 60, minutes: 6,
  passes: [{ k: 0, dir: 'up' }, { k: 0, seq: 'sixBack', dir: 'up' }, { k: 0, seq: 'nines', dir: 'up' }, { k: 0, seq: 'strSkip', dir: 'up' }],
  why: 'A workout chains the cells so you practise changing gears.',
  instr: 'Play each in order without stopping. Pass: one pass with no break.',
  watch: 'A pause between cells.', simplify: 'Two cells.' });
const fours16 = G('sq-fours-16', 'accurate-reps', { name: 'Groups of four in 16th notes ({key})', unit: '16th notes', goal: 70, start: 45,
  passes: one(0, { seq: 'fours', dir: 'both' }),
  why: 'Sixteen notes per bar: four groups of four per bar.',
  instr: 'Pass: 3 round trips even.', watch: 'Tension.', simplify: 'Play in 8ths.' });
const skip16 = G('sq-skip13-16', 'accurate-reps', { name: 'The 1-3-2-4 cell in 16th notes ({key})', unit: '16th notes', goal: 70, start: 45,
  passes: one(2, { seq: 'skip13', dir: 'both' }),
  why: 'The same speed on a different cell.',
  instr: 'Pass: 3 round trips even.', watch: 'Rushing.', simplify: 'Play in 8ths.' });
const progAdv = B('sq-prog-1', 'transfer', { name: 'Cells across four positions ({key}: {chords})', prog: PROGS.turn, pats: ['iv4', 'tri3', 'th', 'f4'], dirs: ['up', 'down'], pos: [1, 2, 3, 4], reps: 2, goal: 95, start: 65,
  why: 'Different cells, different positions, landing on chord tones.',
  instr: 'Pass: 8 bars over {chords}.', watch: 'Arriving early.', simplify: 'Four bars.' });
const progMin = B('sq-prog-min', 'transfer', { name: 'Cells over a minor loop ({key}: {chords})', prog: PROGS.fourChords, pats: ['f4', 'tri3', 'th', 'two'], dirs: ['down', 'up'], pos: [5, 6, 0, 1], reps: 2, goal: 95, start: 65,
  why: 'A minor loop with higher positions.',
  instr: 'Pass: 8 bars over {chords}.', watch: 'Wrong position.', simplify: 'Four bars.' });

/* ------------------------------- Mastery ------------------------------- */
const tempo8 = G('sq-tempo-8', 'accurate-reps', { name: 'Fours at performance tempo ({key})', unit: '8th notes', goal: 120, start: 85, minutes: 6,
  passes: [{ k: 0, seq: 'fours', dir: 'both' }, { k: 2, seq: 'fours', dir: 'both' }],
  why: 'At performance speed the cell should be automatic.', instr: 'Pass: both positions at the goal tempo with no wrong note.', watch: 'Digging in.', simplify: 'Drop 10 BPM.' });
const tempo16 = G('sq-tempo-16', 'accurate-reps', { name: 'Fours in 16th notes at tempo ({key})', unit: '16th notes', goal: 85, start: 60, minutes: 6,
  passes: [{ k: 0, seq: 'fours', dir: 'both' }, { k: 4, seq: 'fours', dir: 'both' }],
  why: 'The speed where a sequence becomes a flurry.', instr: 'Pass: both positions at the goal tempo clean.', watch: 'Losing the beat.', simplify: 'Drop 10 BPM.' });
const mixCells = G('sq-mix', 'interleaving', { name: 'Five cells in one pass ({key})', unit: '8th notes', goal: 105, start: 70, minutes: 6,
  passes: ['threes', 'fours', 'thirds', 'skip13', 'stepBack'].map((seq, i) => ({ k: 0, seq, dir: i % 2 ? 'down' : 'up' })),
  why: 'Switching cells without a break is how sequences become playing.',
  instr: 'Pass: one clean pass through all five.', watch: 'Pausing at each switch.', simplify: 'Three cells.' });
const allPos = G('sq-allpos', 'chunking', { name: 'Threes through every position ({key})', unit: '8th-note triplets', goal: 85, start: 58, minutes: 7,
  passes: [0, 1, 2, 3, 4, 5, 6].map((k, i) => ({ k, seq: 'threes', dir: i % 2 ? 'down' : 'up' })),
  why: 'The sequence mapped to the whole set of positions.',
  instr: 'Pass: one pass up through the seven positions.', watch: 'Wrong position.', simplify: 'Positions 1 to 4.' });
const cap8 = B('sq-cap-8', 'transfer', { name: 'Study: eight bars of sequences ({key}: {chords})', prog: PROGS.fourChords, pats: ['f4', 'tri3', 'iv4', 'th', 'two', 'sb', 'run', 'f4'], dirs: ['up', 'down'], pos: [0, 1, 2, 3, 4, 3, 2, 1], reps: 2, goal: 100, start: 70, minutes: 7,
  why: 'An original study with a different cell on each chord.',
  instr: 'Learn two bars at a time. Pass: one clean pass, then make your own version.', watch: 'Rushing.', simplify: 'Four bars.' });
const cap12 = B('sq-cap-12', 'transfer', { name: 'Capstone: a twelve-bar sequence study ({key}: {chords})', prog: PROGS.oneFourFive, pats: ['f4', 'tri3', 'iv4', 'th', 'two', 'sb'], dirs: ['up', 'down', 'down', 'up'], pos: [0, 1, 2, 3, 4, 5, 6, 0, 2, 4, 3, 1], reps: 3, goal: 100, start: 70, minutes: 8,
  why: 'The whole path in twelve bars.',
  instr: 'Learn in three four-bar phrases, join them, then write your own. Pass: one clean pass at the goal tempo.', watch: 'Losing the position.', simplify: 'Bars 1 to 8.' });

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'scaleSequences', kind: 'technique', title: 'Scale sequences (threes, fours, thirds and longer cells)', domain: 'picking',
  re: /scale sequenc(e|es|ing)|sequencing|diatonic sequenc(e|es)|sequences in (3|4|three|four)/,
  aliases: ['sequences', 'sequencing', 'diatonic sequences', 'scale patterns', 'groups of four', 'scale runs'],
  summary: 'Repeating a short cell up and down the scale: groups of three and four, thirds, step-backs, 1-3-2-4, interval sequences, six- and nine-note cells, string skips, legato versions and phrases over chords.',
  prereqs: ['threeNps', 'alternatePicking'],
  ctx: { key: 9, minor: false, prog: 'folkAxis' },
  sources: [
    'https://guitarlessons.com/guitar-lessons/lead-guitar/major-scale-sequencing-in-3s/',
    'https://guitarlessons.com/guitar-lessons/lead-guitar/major-scale-sequencing-in-4s/',
    'https://guitarworld.com/lessons/diatonic-scale-workout-increase-left-hand-strength-and-produce-great-sounding-sequences',
    'https://appliedguitartheory.com/lessons/3-notes-per-string-major-scale-exercises/'
  ],
  pedagogy: {
    date: '2026-10-31',
    summary: 'Taught on a known scale pattern (three notes per string): a cell of three or four notes is repeated one scale step higher each time, up and then down, with strict alternate picking and a metronome. Sources then add other cells (thirds, step-backs), longer cells across strings, a legato version, and using one cell at a time in playing.',
    sequence: [
      { id: 'threes', tier: 'foundations', step: 'Groups of three', how: 'Three notes, repeated one scale note higher, up and back, strict alternate picking.', skills: ['sq-s-threes'], source: 0 },
      { id: 'fours', tier: 'foundations', step: 'Groups of four', how: 'Four notes, repeated one scale note higher; build, clean up, then speed up.', skills: ['sq-s-fours'], source: 1 },
      { id: 'down', tier: 'foundations', step: 'Coming down, and over a chord', how: 'The descending cell, then a bar of it over a chord.', skills: ['sq-s-down'], source: 2 },
      { id: 'other', tier: 'foundations', step: 'Thirds and step-backs', how: 'Two further exercises on the same pattern.', skills: ['sq-s-other'], source: 3 },
      { id: 'skip', tier: 'intermediate', step: 'The 1-3-2-4 cell', how: 'Skip, step back, step forward, and repeat.', skills: ['sq-s-skip'], source: 3 },
      { id: 'positions', tier: 'intermediate', step: 'Other positions', how: 'The same cells in positions other than the first.', skills: ['sq-s-positions'], source: 2 },
      { id: 'intervals', tier: 'intermediate', step: 'Interval sequences', how: 'Thirds, fourths and sixths of the scale.', skills: ['sq-s-intervals'], source: 3 },
      { id: 'legato', tier: 'intermediate', step: 'The legato version', how: 'Pick once per string and hammer or pull the rest.', skills: ['sq-s-legato'], source: 1 },
      { id: 'long', tier: 'advanced', step: 'Longer cells across strings', how: 'Six notes up and two back, then nine-note cells.', skills: ['sq-s-long'], source: 2 },
      { id: 'skipstr', tier: 'advanced', step: 'String skipping', how: 'Three notes, skip a string, and back.', skills: ['sq-s-skipstr'], source: 2 },
      { id: 'sixteenth', tier: 'advanced', step: 'Faster subdivisions', how: '16th-note versions of the cells.', skills: ['sq-s-16'], source: 0 },
      { id: 'music', tier: 'advanced', step: 'Using sequences in music', how: 'A cell per bar over a progression.', skills: ['sq-s-music'], source: 1 },
      { id: 'tempo', tier: 'mastery', step: 'Tempo', how: 'Add 10 BPM at a time only when clean.', skills: ['sq-s-tempo'], source: 0 },
      { id: 'mix', tier: 'mastery', step: 'Linking cells', how: 'Chaining the cells and all positions without stopping.', skills: ['sq-s-mix'], source: 2 },
      { id: 'study', tier: 'mastery', step: 'Using it without overusing it', how: 'Studies that use a cell here and there.', skills: ['sq-s-study'], source: 1 }
    ],
    drills: ['Groups of three, up and down, strict alternate picking', 'Groups of four on a metronome with +10 BPM steps', 'The 1-3-2-4 cell', 'Thirds, fourths and sixths of the scale', 'Six notes up, two back', 'Nine-note cells across three strings', 'String-skipping cells', 'Five cells chained'],
    mistakes: ['Losing the alternating pick direction in groups of three', 'Speeding up before the pattern is even', 'Sloppiness at speed', 'Overusing a sequence so a solo sounds like practice', 'Pausing between cells'],
    sources: [
      { title: 'Major Scale Sequencing in 3’s', author: 'GuitarLessons.com', url: 'https://guitarlessons.com/guitar-lessons/lead-guitar/major-scale-sequencing-in-3s/' },
      { title: 'Major Scale Sequencing in 4’s', author: 'GuitarLessons.com', url: 'https://guitarlessons.com/guitar-lessons/lead-guitar/major-scale-sequencing-in-4s/' },
      { title: 'Diatonic scale workout', author: 'Adrian Galysh (Guitar World)', url: 'https://guitarworld.com/lessons/diatonic-scale-workout-increase-left-hand-strength-and-produce-great-sounding-sequences' },
      { title: '3 Notes Per String Major Scale Exercises', author: 'Applied Guitar Theory', url: 'https://appliedguitartheory.com/lessons/3-notes-per-string-major-scale-exercises/' }
    ]
  },
  stages: [
    stage('foundations', 'Threes and fours on a known pattern',
      'Groups of three and four over the four lowest strings of position 1, up and down, at 80 BPM, plus thirds and step-backs and one bar-by-bar phrase over a vamp.', [
        S('sq-s-threes', 'Groups of three', 'picking', 'Three notes, one step higher each time.', [threesLow, threesFull],
          ST('A sequence repeats a short pattern one scale step higher each time. A group of three is the shortest.', 'It trains the hand to move through a scale in a pattern.', ['The pattern shifts one scale note each time.', 'Three is odd, so the first pick direction alternates.', 'Use a metronome.'])),
        S('sq-s-fours', 'Groups of four', 'picking', 'Four notes, one step higher each time.', [foursLow, foursFull],
          ST('Groups of four fit the 8th-note pulse: one group per beat.', 'The pick direction repeats the same way each beat.', ['Four notes per beat in 8ths gives two beats per group pair.', 'Build, clean, then speed.', 'Stay on the pulse.'])),
        S('sq-s-down', 'Down, and a bar over a chord', 'picking', 'The descending form.', [foursDown, vamp],
          ST('The descending sequence is the cell mirrored from the top of the scale.', 'Every line needs both directions.', ['Start from the top.', 'The bar ends on a chord tone.', 'Keep the beat.'])),
        S('sq-s-other', 'Thirds and step-backs', 'picking', 'Two more cells.', [thirdsLow, stepBackLow],
          ST('A third pattern skips a scale note (1-3, 2-4); a fourth steps back (2-1, 3-2).', 'More cells mean more ways to move through a scale.', ['Thirds skip a note.', 'Step-backs play a note then the one below.', 'Same positions.']))
      ]),
    stage('intermediate', 'More cells, more positions, interval sequences',
      'The 1-3-2-4 cell, groups of four in positions 2 and 4, thirds, fourths and sixths, and a legato version, each at 90 BPM, plus an 8-bar phrase over a four-chord loop.', [
        S('sq-s-skip', 'The 1-3-2-4 cell', 'picking', 'Skip, step back, step on.', [skip13, skip13p3],
          ST('The 1-3-2-4 cell reaches forward and steps back, making a zigzag up the scale.', 'It is one of the most common cells in solos.', ['Zigzag shape.', 'Note 2 follows note 3.', 'Shift one scale step each time.'])),
        S('sq-s-positions', 'Other positions', 'picking', 'The same cells in new shapes.', [foursP2, foursP4, threesP3],
          ST('A sequence works in any position of the scale; only the shape under the hand changes.', 'It forces you to know the positions.', ['Same cell, new shape.', 'Keep the pulse.', 'Alternate pick.'])),
        S('sq-s-intervals', 'Thirds, fourths and sixths', 'picking', 'Interval sequences.', [thirdsFull, fourths, sixths],
          ST('An interval sequence plays each scale note together with the one a fixed number of steps above.', 'Wide intervals sound more modern.', ['Thirds: two steps up.', 'Fourths: three steps up.', 'Sixths: five steps up.'])),
        S('sq-s-legato', 'The legato version and a phrase', 'picking', 'Hammer-ons, pull-offs, and a loop.', [legFours, legThrees, phrases1],
          ST('Legato plays the same cell with one pick per string and hammer-ons and pull-offs for the rest.', 'It works the fretting hand and gives a smoother sound.', ['Pick the first note on each string.', 'Pull-offs on the way down.', 'Match volume.']))
      ]),
    stage('advanced', 'Longer cells, string skipping and phrases',
      'Six-note and nine-note cells, string-skipping cells and a chain of them at 90 BPM, 16th-note fours at 70 BPM, and two eight-bar phrases over chord loops.', [
        S('sq-s-long', 'Longer cells', 'picking', 'Six and nine notes.', [sixBack, nines],
          ST('A long cell covers several strings before stepping back, so the sequence moves slowly up the neck.', 'It trains the pick across strings.', ['Six up, two back.', 'Nine notes cover three strings.', 'Turn at the top.'])),
        S('sq-s-skipstr', 'Skipping strings', 'picking', 'Jumps between strings.', [strSkip, chain],
          ST('A string-skipping cell jumps over a string and comes back, widening the pick motion.', 'It builds accuracy on the pick hand.', ['Aim before you play.', 'Keep jumps small.', 'Chain the cells.'])),
        S('sq-s-16', 'Sixteenth notes', 'picking', 'Faster.', [fours16, skip16],
          ST('Sixteenth notes put sixteen notes in a bar.', 'It is the next speed step.', ['Keep the wrist loose.', 'Alternate strictly.', 'Slow down when tension builds.'])),
        S('sq-s-music', 'Cells over progressions', 'picking', 'A cell per bar.', [progAdv, progMin],
          ST('Choosing a cell and a position for each bar and landing on a chord tone turns a sequence into a phrase.', 'It is how sequences are used in songs.', ['One cell per bar.', 'End on a chord tone.', 'Move smoothly between positions.']))
      ]),
    stage('mastery', 'Tempo, mixing the cells, and studies',
      'Fours at 120 BPM in 8ths and 85 BPM in 16ths, five cells in one pass, threes through all seven positions, and an eight- and twelve-bar study at 100 BPM.', [
        S('sq-s-tempo', 'Performance tempo', 'picking', 'Speed.', [tempo8, tempo16],
          ST('Add about 10 BPM at a time and only when the pattern is clean.', 'It shows whether the cell is automatic.', ['Raise the click when relaxed.', 'Record yourself.', 'Rest between runs.'])),
        S('sq-s-mix', 'Linking cells', 'picking', 'Cells and positions in one pass.', [mixCells, allPos],
          ST('Chaining cells and positions without stopping trains changing gears.', 'It is the final test of the set.', ['No pause between cells.', 'Know the position.', 'Keep the beat.'])),
        S('sq-s-study', 'Original studies', 'picking', 'Using it without overusing it.', [cap8, cap12],
          ST('A sequence works best used here and there; a study chooses where.', 'Overused, a solo sounds like practice.', ['Choose the cell per bar.', 'Land on chord tones.', 'Write your own on the same chords.']))
      ])
  ]
});
