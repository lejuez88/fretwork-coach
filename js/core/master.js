// Master classes: a whole course built around one topic (the modes, playing
// over changes, sight reading, bends…), for when you know what you want to get
// better at but not where to start or how to practice it. Claude designs the
// course when a key is set; otherwise a built-in curriculum is used for the
// common topics, and any other topic the request parser understands gets a
// five-step plan (foundations → building → new keys → in music → mastery).
// Also: rotating topic recommendations and a "For you" pick from your weakest
// areas and the struggles you named.
import { Claude } from './claude.js';
import { uid, today } from './util.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { EXERCISES, EXERCISE_BY_ID } from '../tools/exercises.js';
import { DOMAINS, DOMAIN_BY_KEY } from '../assessment/engine.js';
import { ROOT_BY_PC, mod12, parseNote } from './theory.js';
import { runAtom } from './styles.js';
import { stringNotesDrill } from './drills.js';
import { normalizeTree, normalizeExercise, profileBrief, TAB_RULES, EXERCISE_SCHEMA, LOCAL_TREE_VERSION } from './coursegen.js';
import { KB_BY_ID, ARTIST_INDEX, ARTIST_META_BY_ID, matchArtist, matchTechniques, loadEntry, loadEntries, loadArtist, stageFor, TIERS, TIER_BY_ID } from '../data/kb.js';
import { getMaster, putMaster } from './lessoncache.js';
import { parseRequest, buildForRequest } from './topics.js';
import { tierName } from './courses.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SKILL_DOMAINS = DOMAINS.map(d => d.key).filter(k => k !== 'repertoire');

/* ------------------------- Built-in curricula ------------------------- */
// Unit: [title, summary, skills]; skill: [id, title, domain, summary, exercises].
// Exercise: [atom, opts, contextPatch] | {spec} (a written drill) | (c) => raw exercise.
const U = (title, summary, skills) => ({ title, summary, skills });
const S = (id, title, domain, summary, ex) => ({ id, title, domain, summary, ex });
const W = (id, name, domain, unit, start, goal, why, instr, watch, simplify, minutes = 5) => ({ spec: { id, name, domain, unit, startBpm: start, goalBpm: goal, why, instr, watch, simplify, minutes } });
const LIB = (libId, name, domain, instr, watch, simplify) => ({ spec: { libId, id: libId, name, domain, minutes: 5, instr, watch, simplify, startBpm: (EXERCISE_BY_ID[libId] || {}).bpm || 60, goalBpm: (EXERCISE_BY_ID[libId] || {}).goalBpm || 120 } });
const TRAINER = 'Use Practice → Theory on the neck → Interval trainer.';

export const MASTER_TOPICS = [
  { id: 'modes', title: 'The modes', blurb: 'Hear, find and use all seven modes over real vamps.', domain: 'theory', cat: 'theory', re: /\bmodes?\b|modal|dorian|lydian|mixolydian|phrygian|locrian|aeolian|ionian/, ctx: { key: 9, prog: 'mixo' }, units: [
    U('The parent scale', 'Every mode is the major scale seen from a different note. Start there.', [
      S('major-shape', 'The major scale in two positions', 'fretboard', 'The shape every mode is built from.', [['scaleRun', { scale: 'major', box: 1 }], ['connectPositions', { scale: 'major', from: 1, to: 2 }]]),
      S('degrees', 'The chord on each degree', 'theory', 'The seven chords of the key: each one is the home chord of a mode.', [['diatonicCycle', { sevenths: false }], ['diatonicCycle', { sevenths: true }]])]),
    U('Major-type modes', 'Ionian, Lydian and Mixolydian: one note changes the color.', [
      S('lydian', 'Lydian: the ♯4', 'theory', 'Play Lydian against Ionian and hear the raised 4th.', [['modeCompare', { modes: ['major', 'lydian'] }], ['scaleRun', { scale: 'lydian', box: 1 }]]),
      S('mixo', 'Mixolydian: the ♭7', 'theory', 'The dominant color of rock, blues and funk.', [['modeCompare', { modes: ['major', 'mixolydian'] }], ['scaleRun', { scale: 'mixolydian', box: 1, pattern: 'threes' }]])]),
    U('Minor-type modes', 'Aeolian, Dorian, Phrygian and Locrian.', [
      S('dorian', 'Dorian: the natural 6', 'theory', 'The brighter minor of funk, soul and Santana.', [['modeCompare', { modes: ['minor', 'dorian'] }, { minor: true }], ['scaleRun', { scale: 'dorian', box: 1 }, { minor: true }]]),
      S('phrygian', 'Phrygian and Locrian: ♭2 and ♭5', 'theory', 'The dark modes of metal, flamenco and m7♭5 chords.', [['modeCompare', { modes: ['minor', 'phrygian'] }, { minor: true }], ['modeCompare', { modes: ['phrygian', 'locrian'] }, { minor: true }]])]),
    U('Hearing the modes', 'Tell them apart by ear over a vamp.', [
      S('ear-modes', 'Mode colors by ear', 'ear', 'Hear each mode’s characteristic note.', [['echoPhrases', { chords: '$dorianVamp', scale: 'dorian' }, { minor: true }], ['earKey', { chords: '$mixo' }]])]),
    U('Modal improvisation', 'Solo over vamps that bring out each mode.', [
      S('dorian-solo', 'Dorian over a minor vamp', 'improv', 'Lean on the 6th over i7–IV.', [['targetSolo', { chords: '$dorianVamp', scale: 'dorian' }, { minor: true }], ['callResponse', { chords: '$dorianVamp', scale: 'dorian' }, { minor: true }]]),
      S('mixo-solo', 'Mixolydian over I–♭VII–IV', 'improv', 'The ♭7 over a rock vamp.', [['targetSolo', { chords: '$mixo', scale: 'mixolydian' }], ['callResponse', { chords: '$mixo', scale: 'mixolydian' }]])])
  ] },
  { id: 'changes', title: 'Playing over chord changes', blurb: 'Make solos follow the harmony: chord tones, guide tones, targets.', domain: 'improv', cat: 'chords', re: /over (the )?(chord )?changes|chord changes? (solo|improv)|follow(ing)? the chords|outlin|chord tones?|guide.?tones?|target(ing)?/, ctx: { key: 7, prog: 'iiVI' }, units: [
    U('Chord tones', 'Know the 1-3-5-7 of every chord before you solo over it.', [
      S('arps7', '7th-chord arpeggios', 'fretboard', 'maj7, m7 and 7 arpeggios in one position.', [['arpeggioBox', { type: 'maj7' }], ['arpeggioBox', { type: 'm7' }], ['arpeggioBox', { type: '7' }]]),
      S('hear-tones', 'Hear the chord tones', 'ear', 'Sing and find the 3rd and 5th of each chord.', [['intervalShapes']])]),
    U('Following the progression', 'Switch arpeggios as each chord goes by.', [
      S('arp-prog', 'Arpeggios through I–V–vi–IV', 'fretboard', 'One arpeggio per chord, no gaps.', [['triadProgression', { chords: '$axis', arpeggio: true }], ['triadProgression', { chords: '$axis', set: [2, 3, 4], arpeggio: true }]]),
      S('guide', 'Guide tones', 'improv', '3rds and 7ths: the notes that spell the changes.', [['guideTones', { chords: '$iiVI' }]])]),
    U('Targeting', 'Land on a chord tone at every change.', [
      S('target-pop', 'Targets over a pop progression', 'improv', 'Root, then the 3rd, on beat 1 of each chord.', [['targetSolo', { chords: '$axis' }]]),
      S('target-blues', 'Targets over a 12-bar blues', 'improv', 'Follow I7–IV7–V7 instead of one scale.', [['targetSolo', { chords: '$blues' }], ['callResponse', { chords: '$blues' }]])]),
    U('The ii–V–I', 'The progression that moves between keys in jazz, soul and pop.', [
      S('iivi-comp', 'Comp the ii–V–I', 'theory', 'Shells and drop-2 voicings, so you hear the harmony you solo over.', [['shellComp', { chords: '$iiVI' }], ['drop2Comp', { chords: '$iiVI' }]]),
      S('iivi-lines', 'Lines through the ii–V–I', 'improv', 'Join guide tones into melodies.', [['guideTones', { chords: '$iiVI' }], ['targetSolo', { chords: '$iiVI' }]])]),
    U('Hear it, then play it', 'Know where the progression is going by ear, and answer it.', [
      S('ear-changes', 'Hear the changes', 'ear', 'Name I, IV, V and vi by ear.', [['earKey', { chords: '$axis' }], ['echoPhrases', { chords: '$axis' }]]),
      S('minor-iivi', 'The minor ii–V–i', 'improv', 'The m7♭5 and the dominant into minor.', [['targetSolo', { chords: '$iiVIminor' }, { minor: true }]])])
  ] },
  { id: 'sightreading', title: 'Sight reading', blurb: 'Read standard notation on the guitar, in time, without stopping.', domain: 'fretboard', cat: 'theory', re: /sight.?read|read(ing)? (music|notation|standard|sheet)|notation|staff|sheet music/, ctx: { key: 0, prog: 'axis' }, units: [
    U('The staff and the top strings', 'Read notes on strings 1–3 in open position. (The app shows tab, so read from a sight-reading book or printed sheet.)', [
      S('staff', 'Staff notes on strings 1–3', 'fretboard', 'E–F–G on string 1, B–C–D on string 2, G–A on string 3.', [W('sr-staff', 'Staff note flash: say it, play it', 'fretboard', 'one note per beat', 40, 80,
        'Linking the written note straight to the fret, without a detour through counting lines, is the core of sight reading.',
        'From a beginner sight-reading book or a printed page of single notes: open position, strings 1–3 only. Say each note’s name and play it, one per click. Never stop the click; skip a note rather than pause.',
        'Counting lines and spaces from the bottom for every note.', 'High e string only (E, F, G).')]),
      S('rhythm-read', 'Reading rhythms', 'rhythm', 'Whole, half, quarter and 8th notes, counted out loud.', [['subdivisionLadder'], W('sr-rhythm', 'Clap and strum written rhythms', 'rhythm', 'one bar per line', 50, 100,
        'Most sight-reading mistakes are rhythm mistakes, not wrong notes.', 'Take one line of rhythms from your book. Count “1 & 2 &” out loud, clap the rhythm, then strum it on a muted chord. One bar per click group; keep going.',
        'Rushing rests.', 'Quarters and halves only.')])]),
    U('All six strings', 'Open position, every string, including ledger lines below the staff.', [
      S('low', 'Strings 4–6 and the ledger lines', 'fretboard', 'D–E–F on string 4, A–B–C on 5, E–F–G on 6.', [W('sr-low', 'Low-string note flash', 'fretboard', 'one note per beat', 40, 80,
        'The low strings sit on and below the staff; ledger lines are where readers slow down most.', 'From your book: notes on strings 4–6. Name and play one per click. Then mix all six strings.', 'Reading ledger-line notes one line off.', 'String 4 only.'), (c) => stringNotesDrill(6, c.lvl)]),
      S('melodies', 'Simple melodies in C', 'fretboard', 'Eight-bar melodies, quarter and 8th notes.', [W('sr-melody', 'Eight bars in C at sight', 'fretboard', 'quarter notes', 50, 90,
        'Reading a whole tune in time is the actual skill; single notes are the warm-up.', 'Pick an eight-bar melody you have never played. Look through it for 30 seconds (key, rhythm, highest and lowest note), then play it with the click, never stopping.',
        'Stopping to fix a wrong note.', 'Half the tempo, or the first four bars.')])]),
    U('Keys and accidentals', 'Sharps, flats and the key signatures of G, F and D.', [
      S('keys', 'Key signatures', 'theory', 'What a key signature changes on the neck.', [W('sr-keysig', 'Read in G, F and D', 'fretboard', 'quarter notes', 50, 90,
        'A key signature changes notes for the whole piece; forgetting it is the most common reading error.', 'Before you start, play the scale of the key signature once. Then read a melody in that key: G (F♯), F (B♭), D (F♯, C♯).', 'Forgetting the F♯ halfway through.', 'G major only.'), ['diatonicCycle', { sevenths: false }, { key: 7 }]]),
      S('acc', 'Accidentals on the fly', 'fretboard', 'Sharps and flats that last a bar.', [W('sr-acc', 'Accidentals drill', 'fretboard', 'quarter notes', 50, 85,
        'Accidentals hold for the rest of the bar; reading them cleanly is what lets you read real music.', 'Read lines with accidentals (chromatic passing notes). Say the note including its sharp or flat as you play it.', 'Carrying an accidental into the next bar.', 'One accidental per line.')])]),
    U('Reading in position', 'Read in 2nd and 5th position, not just open.', [
      S('pos2', 'Position II', 'fretboard', 'Index finger at fret 2: one finger per fret.', [['scaleRun', { scale: 'major', box: 1 }, { key: 2 }], W('sr-pos2', 'Read in position II', 'fretboard', 'quarter notes', 50, 90,
        'Most written music sits in one position; knowing the notes there lets you read without hunting.', 'Put your index finger at fret 2 and stay there. Read melodies in D and A major in that position.', 'Sliding back to open position.', 'Strings 1–3 only.')]),
      S('pos5', 'Position V', 'fretboard', 'Index at fret 5: the middle of the neck.', [['scaleRun', { scale: 'major', box: 1 }, { key: 0 }], W('sr-pos5', 'Read in position V', 'fretboard', 'quarter notes', 50, 90,
        'Position V covers most melodies above the open strings.', 'Index at fret 5. Read melodies in C and F there.', 'Reading open-position frets out of habit.', 'Strings 1–3 only.')])]),
    U('Real sight reading', 'New music every day, in time, with no stops.', [
      S('daily', 'Daily sight reading', 'fretboard', 'One new piece a day: the habit that makes readers.', [W('sr-daily', 'A new 16-bar melody every day', 'fretboard', '8th notes', 60, 100,
        'Reading something new every day is the one method all good readers use.', 'Every day: one 16-bar melody you have never seen. 30 seconds to look it over, then play it once, in time, never stopping. Log the tempo.', 'Practicing the same piece until memorized; that is no longer reading.', '8 bars.', 6)]),
      S('synco', 'Syncopation and ties', 'rhythm', 'Off-beat rhythms and tied notes.', [['gapClick', { chords: '$axis' }], W('sr-synco', 'Read syncopated rhythms', 'rhythm', '8th notes', 60, 100,
        'Syncopation and ties are where reading turns into feel.', 'Read lines with ties across beats and notes on the “&”. Count out loud, strum on a muted chord.', 'Turning a tied note into two attacks.', 'Ties within the bar only.')])])
  ] },
  { id: 'fretboard', title: 'Every note on the neck', blurb: 'Find any note on any string, instantly.', domain: 'fretboard', cat: 'scales', re: /fretboard|note names?|notes on the (neck|guitar|fretboard)|memori[sz]e the|where the notes|find(ing)? notes/, ctx: { key: 9, prog: 'axis' }, units: [
    U('The low strings', 'Natural notes on the E and A strings: the roots of most chords.', [
      S('s6', 'The low E string', 'fretboard', 'E F G A B C D E, frets 0–12.', [(c) => stringNotesDrill(6, c.lvl), ['noteFinder', { pc: 4 }]]),
      S('s5', 'The A string', 'fretboard', 'A B C D E F G A, frets 0–12.', [(c) => stringNotesDrill(5, c.lvl), ['noteFinder', { pc: 9 }]])]),
    U('Octave shapes', 'One note, found everywhere with two shapes.', [
      S('octaves', 'Octaves and every root', 'fretboard', 'Two strings up, two frets up (three across G–B).', [['noteFinder', { pc: 7 }], ['noteFinder', { pc: 2 }]])]),
    U('The middle and top strings', 'D, G, B and high e.', [
      S('s43', 'The D and G strings', 'fretboard', 'Natural notes on strings 4 and 3.', [(c) => stringNotesDrill(4, c.lvl), (c) => stringNotesDrill(3, c.lvl)]),
      S('s21', 'The B and high e strings', 'fretboard', 'Natural notes on strings 2 and 1.', [(c) => stringNotesDrill(2, c.lvl), (c) => stringNotesDrill(1, c.lvl)])]),
    U('Intervals and chords by shape', 'Notes in relation to each other.', [
      S('ints', 'Interval shapes', 'fretboard', 'Every interval as a shape from the root.', [['intervalShapes'], W('mc-trainer-fb', 'Interval trainer: chord tones in every key', 'fretboard', 'notes per minute', 15, 30,
        'Finding the 3rd, 5th and 7th of any root without thinking is what makes chords and solos fluent.', `${TRAINER} Pick “Pick my own”: 1, 3, 5, ♭7. Key: random each round. Tempo here = correct notes per minute.`, 'Always using the same octave shape.', 'One key, roots shown.')]),
      S('caged-roots', 'Chord roots everywhere', 'fretboard', 'Five places to play the same chord.', [['shapesAcrossNeck', { type: 'maj' }]])]),
    U('Fluent', 'Any note, any string, in time.', [
      S('fast', 'Sharps and flats in time', 'fretboard', 'The notes between the naturals.', [['noteFinder', { pc: 1 }], ['noteFinder', { pc: 10 }]]),
      S('roots-solo', 'Roots in a solo', 'improv', 'Land on each chord’s root as the progression moves.', [['targetSolo', { chords: '$axis' }]])])
  ] },
  { id: 'intervals', title: 'Intervals: by ear and by shape', blurb: 'Know every interval as a sound and as a shape on the neck.', domain: 'ear', cat: 'theory', re: /intervals?/, ctx: { key: 9, prog: 'axis' }, units: [
    U('Shapes from the root', 'Where each interval sits on the neck.', [
      S('shapes', 'Interval shapes', 'fretboard', 'Root to 3rd, 5th, octave and the rest.', [['intervalShapes'], W('mc-it-1', 'Interval trainer: 1–3–5 in one key', 'fretboard', 'notes per minute', 15, 30,
        'Playing the interval the moment you see it ties the name to the hand.', `${TRAINER} Key A, intervals: pick my own 3 and 5, from the root. Tempo here = correct notes per minute.`, 'Counting frets instead of using the shape.', 'Tap mode first, then the mic.')])]),
    U('Hearing intervals', 'Recognize them by sound.', [
      S('hear', 'Intervals by ear', 'ear', 'Sing, then play, every interval from a root.', [['intervalShapes', {}, {}], ['echoPhrases', { chords: '$axis' }]])]),
    U('Every interval, every key', 'All the scale degrees in any key.', [
      S('all', 'All degrees, random keys', 'fretboard', 'The full scale, a new key each round.', [W('mc-it-2', 'Interval trainer: all degrees, random keys', 'fretboard', 'notes per minute', 15, 30,
        'Intervals only become automatic when the key keeps changing.', `${TRAINER} Intervals: every degree of the scale; key: random each round; time limit 5 s.`, 'Slowing down on ♭6 and 7.', 'Major scale only.'), ['noteFinder', { pc: 3 }]])]),
    U('Chaining intervals', 'Measure from the last note, not the root.', [
      S('chain', 'Interval chains', 'fretboard', 'Each answer is the next reference.', [W('mc-it-3', 'Interval trainer: from the last note', 'fretboard', 'notes per minute', 12, 28,
        'Melodies move from note to note; chained intervals are how you hear and play them.', `${TRAINER} Measure from: the last note (chain). Intervals 2, ♭3, 3, 4, 5.`, 'Losing the reference after a miss.', 'Steps only (2 and ♭3).')])]),
    U('Using intervals', 'Double-stops and melodies.', [
      S('ds', '3rds and 6ths', 'fretting', 'Harmony in two notes.', [['doubleStops', { interval: '3rds' }], ['doubleStops', { interval: '6ths' }]]),
      S('melody', 'Melodies by interval', 'improv', 'Answer phrases you hear.', [['callResponse', { chords: '$axis' }]])])
  ] },
  { id: 'ear', title: 'Playing by ear', blurb: 'Hear a phrase or a progression and play it back.', domain: 'ear', cat: 'ear', re: /\bear\b|by ear|transcri|hear(ing)?|play what i hear/, ctx: { key: 7, prog: 'axis' }, units: [
    U('Pitch and intervals', 'Hear where a note goes before you look for it.', [
      S('ints', 'Interval sounds', 'ear', 'Sing it, then find it.', [['intervalShapes'], W('mc-ear-sing', 'Sing then play', 'ear', 'one note per 2 beats', 40, 80,
        'If you can sing it, you can find it. Singing first trains the ear, not the fingers.', 'Play a root. Sing a note above it, then find that note on the guitar. Every 2 beats, a new note.', 'Hunting on the fretboard before singing.', 'Only notes from the major scale.')])]),
    U('Echo phrases', 'Copy short phrases in time.', [
      S('echo', 'Two-bar echoes', 'ear', 'Hear it, play it back, no stopping.', [['echoPhrases', { chords: '$axis' }]])]),
    U('Find the key and chords', 'Where home is, and which chords are around it.', [
      S('key', 'Find the key', 'ear', 'The root of a loop by ear.', [['earKey', { chords: '$axis' }], ['earKey', { chords: '$minorRock' }, { minor: true }]]),
      S('quality', 'Chord qualities', 'ear', 'Major, minor and dominant by ear.', [['qualityCycle', { types: ['maj', 'min', '7'], family: 'full' }]])]),
    U('Progressions by ear', 'Name I, IV, V and vi as they go by.', [
      S('prog', 'Common progressions', 'ear', 'Pop, blues and minor rock.', [['earKey', { chords: '$blues' }], ['echoPhrases', { chords: '$blues' }]])]),
    U('Transcribing', 'Learn real music by ear.', [
      S('trans', 'Transcribe a phrase', 'ear', 'Four bars from a song you love.', [W('mc-transcribe', 'Transcribe four bars', 'ear', 'bars per session', 40, 80,
        'Working parts out by ear is the most effective ear training there is.', 'Choose a song you love. Loop four bars of the vocal or guitar line (slow it down if your player allows). Find the first note, then each next note by singing it. Play the four bars along with the record.', 'Looking up the tab when it gets hard.', 'Two bars, or only the melody’s first notes of each bar.', 8), ['callResponse', { chords: '$axis' }]])])
  ] },
  { id: 'timing', title: 'Rhythm & timing', blurb: 'Lock to the click, hold time without it, feel every subdivision.', domain: 'rhythm', cat: 'rhythm', re: /timing|rhythm|in time|metronome|groove|tempo|subdivi|syncopat|swing feel/, ctx: { key: 9, prog: 'axis' }, units: [
    U('The grid', 'Quarters, 8ths, triplets and 16ths on demand.', [
      S('grid', 'Subdivisions', 'rhythm', 'Switch subdivisions without moving the beat.', [['subdivisionLadder'], ['strumPattern', { chords: '$axis', pattern: 'rock8' }]])]),
    U('Swing and shuffle', 'The long–short feel.', [
      S('swing', 'Swung 8ths', 'rhythm', 'Triplet-based feel that doesn’t drift.', [['subdivisionLadder', { feel: 'swing' }], ['shuffleRiff']])]),
    U('Internal time', 'Keep time when the click goes quiet.', [
      S('gap', 'Gap click', 'rhythm', 'The click drops out; you don’t.', [['gapClick', { chords: '$axis' }], W('mc-2and4', 'Click on 2 and 4', 'rhythm', 'click on 2 and 4', 50, 100,
        'Feeling the backbeat yourself, with the click only on 2 and 4, is how drummers and bands feel time.', 'Set the metronome to half your tempo and count it as beats 2 and 4. Strum 8ths over it.', 'Flipping the click to 1 and 3 without noticing.', 'Quarter-note strums.')])]),
    U('Syncopation', 'Accents off the beat.', [
      S('synco', 'Syncopated rhythm parts', 'rhythm', 'Pushes and anticipations.', [['powerRiff', { rhythm: 'synco' }], ['funkScratch']])]),
    U('Odd meters and feel', 'Fives and sevens.', [
      S('odd', 'Odd meters', 'rhythm', '7/8 and 5/4 grooves.', [['oddMeterRiff', { meter: 7 }], ['oddMeterRiff', { meter: 5 }]])])
  ] },
  { id: 'pentatonic', title: 'Pentatonic & blues soloing', blurb: 'All five pentatonic boxes, joined up, with real blues phrasing.', domain: 'improv', cat: 'scales', re: /pentatonic|penta\b|blues (solo|lead|scale|licks?)|lead guitar/, ctx: { key: 9, minor: true, prog: 'minorRock' }, units: [
    U('Box 1', 'The home position, cleanly and in time.', [
      S('box1', 'Box 1', 'fretboard', 'Up and down, then in 3s.', [['scaleRun', { scale: 'minorPent', box: 1 }], ['scaleRun', { scale: 'minorPent', box: 1, pattern: 'threes' }]])]),
    U('Boxes 2 and 3', 'Out of the box.', [
      S('box23', 'Boxes 2 and 3', 'fretboard', 'The next two shapes up the neck.', [['scaleRun', { scale: 'minorPent', box: 2 }], ['scaleRun', { scale: 'minorPent', box: 3 }]]),
      S('connect12', 'Connecting 1 to 2', 'fretboard', 'Slide between positions mid-phrase.', [['connectPositions', { scale: 'minorPent', from: 1, to: 2 }]])]),
    U('Boxes 4 and 5', 'The whole neck.', [
      S('box45', 'Boxes 4 and 5', 'fretboard', 'The last two shapes.', [['scaleRun', { scale: 'minorPent', box: 4 }], ['scaleRun', { scale: 'minorPent', box: 5 }]]),
      S('connect23', 'Connecting 2 to 3', 'fretboard', 'Move freely up the neck.', [['connectPositions', { scale: 'minorPent', from: 2, to: 3 }]])]),
    U('Blue notes and the major side', 'The ♭5 and the major pentatonic.', [
      S('blues', 'The blues scale', 'fretboard', 'Add the ♭5.', [['scaleRun', { scale: 'blues', box: 1 }], ['scaleRun', { scale: 'majorPent', box: 1 }, { minor: false }]]),
      S('bends', 'Bends and vibrato', 'fretting', 'The voice of blues guitar.', [['bendLick'], ['vibratoHolds']])]),
    U('Phrasing', 'Licks, space and following the changes.', [
      S('cr', 'Call and response', 'improv', 'Short phrases with space.', [['callResponse', { chords: '$minorRock' }], ['callResponse', { chords: '$blues' }]]),
      S('targets', 'Targets over the blues', 'improv', 'Change with the chords.', [['targetSolo', { chords: '$blues' }]])])
  ] },
  { id: 'improv', title: 'Improvisation & phrasing', blurb: 'Solos that say something: motifs, space, targets and your own voice.', domain: 'improv', cat: 'ear', re: /improvis|solo(ing)?|phras|jam(ming)?|licks?/, ctx: { key: 9, minor: true, prog: 'minorRock' }, units: [
    U('Small vocabulary', 'Fewer notes, more music.', [
      S('three', 'Three-note solos', 'improv', 'A whole solo from three notes.', [['callResponse', { chords: '$minorRock', scale: 'minorPent' }], W('mc-3notes', 'Three-note solo', 'improv', 'phrases', 60, 100,
        'Limits force rhythm, dynamics and repetition: the parts of phrasing that scales don’t teach.', 'Pick three notes from box 1. Solo over the loop using only those three. Change rhythm, length and accent, not notes.', 'Playing constantly with no space.', 'Two notes.')])]),
    U('Space and expression', 'Breath, bends and vibrato.', [
      S('space', 'Phrase and rest', 'improv', 'Play two bars, rest two bars.', [['callResponse', { chords: '$blues' }], ['vibratoHolds']])]),
    U('Following the chords', 'Make the solo change with the progression.', [
      S('targets', 'Chord-tone targets', 'improv', 'Land on chord tones at the changes.', [['targetSolo', { chords: '$axis' }, { minor: false }], ['guideTones', { chords: '$iiVI' }]])]),
    U('Motifs', 'Develop one idea instead of many.', [
      S('motif', 'Motif development', 'improv', 'Repeat, vary, answer.', [['echoPhrases', { chords: '$axis' }], W('mc-motif', 'One motif, four ways', 'improv', 'phrases', 60, 100,
        'Developing one idea (repeat it, shift it, change its rhythm, answer it) is what makes a solo sound composed.', 'Play a 3–5 note motif. Then: repeat it, start it on another beat, move it to another chord tone, flip its ending. Each version for two bars.', 'Dropping the motif for a new idea after one bar.', 'Only repeat and shift.')])]),
    U('Your own voice', 'Modes and color over vamps.', [
      S('modal', 'Dorian and Mixolydian solos', 'improv', 'Two colors you will use forever.', [['targetSolo', { chords: '$dorianVamp', scale: 'dorian' }], ['callResponse', { chords: '$mixo', scale: 'mixolydian' }, { minor: false }]])])
  ] },
  { id: 'bends', title: 'Bending & vibrato', blurb: 'In-tune bends and a vibrato that sings.', domain: 'fretting', cat: 'fretting', re: /bend|vibrato/, ctx: { key: 9, minor: true, prog: 'minorRock' }, units: [
    U('Pitch-accurate bends', 'Hit the target pitch every time.', [
      S('bends', 'Bends to pitch', 'fretting', 'Check against the fretted target.', [['bendLick'], ['vibratoHolds']])]),
    U('Bends in another key', 'Same control in a new position.', [
      S('bends2', 'Bends in E', 'fretting', 'Lower on the neck, stiffer strings.', [['bendLick', {}, { key: 4 }], ['vibratoHolds', {}, { key: 4 }]])]),
    U('Double-stops and unison bends', 'Two strings at once.', [
      S('ds', 'Double-stop bends', 'fretting', 'Chuck Berry and Texas style.', [['doubleStopRnR'], ['doubleStops', { interval: '3rds' }]])]),
    U('Bends in licks', 'Expression inside phrases.', [
      S('licks', 'Bending licks', 'improv', 'Call-and-response with bends.', [['callResponse', { chords: '$blues' }], ['bendLick', {}, { key: 7 }]])]),
    U('Expressive soloing', 'Slow blues: every note bent and shaped.', [
      S('slow', 'Slow-blues phrasing', 'improv', 'Bends and vibrato at a slow tempo.', [['targetSolo', { chords: '$slowBlues' }], ['callResponse', { chords: '$minorRock' }]])])
  ] },
  { id: 'speed', title: 'Alternate-picking speed', blurb: 'Clean, relaxed, fast picking: from bursts to full runs.', domain: 'picking', cat: 'picking', re: /alternate pick|speed|faster|shred|fast picking|picking (hand|technique)|tremolo/, ctx: { key: 9, minor: true, prog: 'minorRock' }, units: [
    U('Small, relaxed motion', 'Speed comes from efficiency, not effort.', [
      S('burst', 'Speed bursts', 'picking', 'Short fast bursts, then rest.', [['speedBurst'], ['chugRiff', { rhythm: '8ths' }]])]),
    U('String changes', 'Where most picking breaks down.', [
      S('cross', 'Crossing strings', 'picking', 'Inside and outside picking.', [['stringSkip'], ['scaleRun', { scale: 'minorPent', box: 1, unit: '16ths' }]])]),
    U('Three notes per string', 'The shred building block.', [
      S('3nps', '3nps runs', 'picking', 'Even 16ths across the neck.', [['scaleRun', { scale: 'minor', nps: 3, unit: '16ths' }], ['scaleRun', { scale: 'minor', nps: 3, unit: '16ths', pattern: 'threes' }]])]),
    U('Bursts to full runs', 'Lengthen the fast parts.', [
      S('long', 'Longer bursts', 'picking', 'From 4 to 16 fast notes.', [['speedBurst', { scale: 'minor' }], ['chugRiff', { rhythm: '16ths' }]])]),
    U('Speed in music', 'Fast lines that still phrase.', [
      S('lines', 'Sequenced runs', 'picking', 'Groups of four through the scale.', [['scaleRun', { scale: 'minor', nps: 3, unit: '16ths', pattern: 'fours' }]]),
      S('solo', 'Fast phrases in a solo', 'improv', 'Bursts inside call and response.', [['callResponse', { chords: '$minorRock' }]])])
  ] },
  { id: 'sweep', title: 'Sweep picking', blurb: 'Smooth arpeggio sweeps from three strings to five.', domain: 'picking', cat: 'picking', re: /sweep/, ctx: { key: 9, minor: true, prog: 'minorRock' }, units: [
    U('Arpeggio shapes', 'Know the notes before sweeping them.', [
      S('shapes', 'Triad arpeggios', 'fretboard', 'Minor and major shapes.', [['arpeggioBox', { type: 'min' }], ['arpeggioBox', { type: 'maj' }, { minor: false }]])]),
    U('Three-string sweeps', 'One motion, each note separate.', [
      S('three', '3-string sweeps', 'picking', 'Push through, mute behind.', [['sweepArp', { strings: 3 }]])]),
    U('Sweeps through a progression', 'Change shape on each chord.', [
      S('prog', 'Sweeps in E minor and D', 'picking', 'Two keys, same motion.', [['sweepArp', { strings: 3 }, { key: 4 }], ['sweepArp', { strings: 3 }, { key: 2, minor: false }]])]),
    U('Five-string sweeps', 'The full shape.', [
      S('five', '5-string sweeps', 'picking', 'Long sweeps, every note clean.', [['sweepArp', { strings: 5 }]])]),
    U('Sweeps in solos', 'Use them musically.', [
      S('use', 'Sweeps in a solo', 'improv', 'A sweep as one phrase among others.', [['sweepArp', { strings: 5 }, { key: 4 }], ['targetSolo', { chords: '$minorRock' }]])])
  ] },
  { id: 'legato', title: 'Legato & tapping', blurb: 'Hammer-ons, pull-offs and tapped lines that flow.', domain: 'fretting', cat: 'fretting', re: /legato|hammer|pull.?off|tapping|\btap\b/, ctx: { key: 9, minor: true, prog: 'minorRock' }, units: [
    U('Even hammer-ons and pull-offs', 'Every note the same volume.', [
      S('hp', 'Hammers and pulls', 'fretting', 'Pentatonic legato.', [['legatoRun', { scale: 'minorPent' }], W('mc-trills', 'Trill workout', 'fretting', '16ths', 60, 120,
        'Trills build the strength and timing of each finger pair, which is what legato is made of.', 'Trill between two fingers on one string for one bar, then the next pair: 1–2, 1–3, 1–4, 2–3, 2–4, 3–4.', 'The pull-off note getting quieter.', '8th notes.', 4)])]),
    U('Three notes per string', 'Legato scale runs.', [
      S('3nps', '3nps legato', 'fretting', 'Pick once per string.', [['legatoRun', { scale: 'minor' }]])]),
    U('Tapping', 'A third finger from the picking hand.', [
      S('tap', 'Tapped arpeggios', 'fretting', 'Tap, pull, hammer.', [['tapLick']])]),
    U('New keys and scales', 'Legato in Dorian and E minor.', [
      S('keys', 'Legato in other keys', 'fretting', 'Same motion, new notes.', [['legatoRun', { scale: 'dorian' }], ['tapLick', {}, { key: 4 }]])]),
    U('Legato in solos', 'Smooth lines inside phrases.', [
      S('solo', 'Legato phrasing', 'improv', 'Mix picked and legato notes.', [['callResponse', { chords: '$minorRock' }]])])
  ] },
  { id: 'dexterity', title: 'Finger independence', blurb: 'Faster, lighter, more accurate fretting fingers.', domain: 'fretting', cat: 'warmup', re: /dexterity|finger (independence|strength|speed)|spider|stretch(es)?|tension|weak (pinky|fingers?)/, ctx: { key: 9, minor: true, prog: 'minorRock' }, units: [
    U('One finger per fret', 'The spider, relaxed.', [
      S('spider', 'Chromatic spider', 'fretting', 'Light pressure, fingers close to the strings.', [LIB('spider-1234', 'Chromatic spider', 'fretting', 'One finger per fret, strict alternate picking. Press just hard enough for a clean note.', 'Squeezing the neck.', 'Two strings only.')])]),
    U('Trills and pairs', 'Each finger pair on its own.', [
      S('trills', 'Trills', 'fretting', 'Strength and timing per finger pair.', [W('mc-trills2', 'Finger-pair trills', 'fretting', '16ths', 60, 120, 'Weak pairs (3–4) hold back everything else.', 'One bar each: 1–2, 1–3, 1–4, 2–3, 2–4, 3–4, on the G string.', 'Fingers flying far off the string.', '8th notes.', 4)])]),
    U('Legato strength', 'Hammers and pulls at volume.', [
      S('legato', 'Legato runs', 'fretting', 'Three notes per string.', [LIB('legato-3nps', '3-note-per-string legato', 'fretting', 'Pick only the first note on each string.', 'Weak pull-offs.', 'One string.'), ['legatoRun', { scale: 'minorPent' }]])]),
    U('Stretches', 'Wider spans without tension.', [
      S('stretch', 'Stretch patterns', 'fretting', 'Four-fret and five-fret spans.', [W('mc-stretch', 'Stretch spider', 'fretting', '8ths', 50, 100, 'Reaching without tension opens up chords and 3nps scales.', 'Spider pattern on frets 5–9 (one stretch), then 3–7, then 1–5. Thumb behind the neck, low.', 'Locking the wrist.', 'Frets 7–10 only.')])]),
    U('Applying it', 'Dexterity in real lines.', [
      S('lines', 'Scale runs', 'fretting', 'Clean 16ths.', [['scaleRun', { scale: 'minor', nps: 3, unit: '16ths' }], ['legatoRun', { scale: 'dorian' }]])])
  ] },
  { id: 'barre', title: 'Barre chords', blurb: 'Clean barre chords anywhere, and fast changes between them.', domain: 'fretting', cat: 'chords', re: /barre|bar chords?|f chord/, ctx: { key: 5, prog: 'axis' }, units: [
    U('The E-shape barre', 'F major and its strength.', [
      S('eshape', 'E-shape major', 'fretting', 'Index flat, thumb low.', [['shapesAcrossNeck', { type: 'maj', root: 5 }], W('mc-barre-str', 'Barre strength builder', 'fretting', 'one strum per beat', 50, 90, 'Clean barres come from leverage and placement, not grip strength.', 'Barre fret 5 with the index only and strum; 4 beats on, 4 beats relaxed. Then add the shape.', 'Squeezing with the thumb.', 'Barre only the top 4 strings.')])]),
    U('Minor and A-shape barres', 'Bm and its relatives.', [
      S('minor', 'Minor and A-shape barres', 'fretting', 'Two shapes cover every chord.', [['shapesAcrossNeck', { type: 'min', root: 11 }], ['chordChanges', { chords: ['F', 'Bm', 'B♭', 'F♯m'], beats: 4 }]])]),
    U('Changes', 'Moving between barres in time.', [
      S('changes', 'Barre progressions', 'fretting', 'Two beats per chord.', [['chordChanges', { chords: ['F', 'Dm', 'B♭', 'C'], beats: 2 }], ['strumPattern', { chords: ['F', 'Dm', 'B♭', 'C'], pattern: 'pop' }]])]),
    U('Dominant and minor 7 barres', 'More colors.', [
      S('sevens', '7th barres', 'fretting', '7 and m7 shapes.', [['shapesAcrossNeck', { type: '7' }], ['chordChanges', { chords: ['Bm', 'G', 'D', 'A'], beats: 2 }]])]),
    U('Songs with barres', 'In real strumming.', [
      S('songs', 'Barre strumming', 'rhythm', 'Full songs’ worth of barres.', [['strumPattern', { chords: ['F♯m', 'D', 'A', 'E'], pattern: 'rock8' }], ['chordChanges', { chords: ['B♭', 'Gm', 'E♭', 'F'], beats: 1 }]])])
  ] },
  { id: 'triads', title: 'Triads everywhere', blurb: 'Every triad on every string set, and how to move between them.', domain: 'fretboard', cat: 'chords', re: /triads?/, ctx: { key: 0, prog: 'axis' }, units: [
    U('Major triads', 'Three inversions on one string set.', [
      S('maj', 'Major triad inversions', 'fretboard', 'Root, 1st and 2nd inversion.', [['inversionCycle', { type: 'maj', family: 'triad', set: [2, 3, 4] }]])]),
    U('Minor triads and more string sets', 'Same idea, more places.', [
      S('min', 'Minor triad inversions', 'fretboard', 'The minor shapes.', [['inversionCycle', { type: 'min', family: 'triad', set: [2, 3, 4] }], ['inversionCycle', { type: 'maj', family: 'triad', set: [3, 4, 5] }]])]),
    U('Triads through progressions', 'The nearest inversion each time.', [
      S('lead', 'Voice-leading triads', 'fretboard', 'Smallest moves between chords.', [['triadProgression', { chords: '$folkAxis', set: [3, 4, 5] }], ['triadProgression', { chords: '$axis', set: [2, 3, 4] }]])]),
    U('Diminished, augmented and sus', 'The other triads.', [
      S('other', 'Other triad types', 'fretboard', 'dim, aug, sus.', [['inversionCycle', { type: 'dim', family: 'triad', set: [2, 3, 4] }], ['inversionCycle', { type: 'sus4', family: 'triad', set: [2, 3, 4] }]])]),
    U('Triads in music', 'Rhythm parts and fills.', [
      S('use', 'Triad parts', 'theory', 'High triads over a band.', [['triadProgression', { chords: '$capo', set: [1, 2, 3] }], ['embellish', { chords: '$neo' }]])])
  ] },
  { id: 'sevenths', title: '7th chords & voicings', blurb: 'maj7, 7, m7 and m7♭5: shells, drop-2 and real comping.', domain: 'theory', cat: 'chords', re: /7th chords?|seventh|maj7|m7|drop.?2|shell|jazz chords?|comp(ing)?/, ctx: { key: 0, prog: 'iiVI' }, units: [
    U('The four qualities', 'What makes each 7th chord sound the way it does.', [
      S('quals', 'Four qualities, one root', 'theory', 'maj7, 7, m7, m7♭5.', [['qualityCycle', { types: ['maj7', '7', 'm7', 'm7b5'], family: 'full' }]])]),
    U('Shell voicings', 'Root, 3rd and 7th.', [
      S('shells', 'Shells', 'theory', 'Three-note grips.', [['qualityCycle', { types: ['maj7', '7', 'm7'], family: 'shell', set: [1, 2, 3] }], ['shellComp', { chords: '$iiVI' }]])]),
    U('Drop-2 inversions', 'Four-note voicings up the neck.', [
      S('drop2', 'Drop-2 inversions', 'fretboard', 'Every inversion on the top four strings.', [['inversionCycle', { type: 'maj7', family: 'drop2', set: [2, 3, 4, 5] }], ['inversionCycle', { type: '7', family: 'drop2', set: [1, 2, 3, 4] }]])]),
    U('Comping', 'Voice-led progressions.', [
      S('comp', 'ii–V–I and beyond', 'theory', 'Smooth comping.', [['drop2Comp', { chords: '$iiVI' }], ['drop2Comp', { chords: '$royal' }]])]),
    U('Color and melody', 'Guide tones and embellishments.', [
      S('color', 'Guide tones and color', 'improv', 'Make the chords sing.', [['guideTones', { chords: '$iiVI' }], ['embellish', { chords: '$neo' }]])])
  ] },
  { id: 'caged', title: 'The CAGED system', blurb: 'Five shapes that map the whole neck.', domain: 'fretboard', cat: 'chords', re: /caged/, ctx: { key: 0, prog: 'folk145' }, units: [
    U('Major shapes', 'C, A, G, E and D shapes of one chord.', [S('maj', 'Major CAGED shapes', 'fretboard', 'One chord, five places.', [['shapesAcrossNeck', { type: 'maj' }]])]),
    U('Minor shapes', 'The minor versions.', [S('min', 'Minor CAGED shapes', 'fretboard', 'Same map, minor.', [['shapesAcrossNeck', { type: 'min' }, { minor: true }]])]),
    U('Arpeggios inside the shapes', 'The notes that make each shape.', [S('arp', 'CAGED arpeggios', 'fretboard', 'Major and minor.', [['arpeggioBox', { type: 'maj' }], ['arpeggioBox', { type: 'min' }, { minor: true }]])]),
    U('Scales around the shapes', 'Each shape has its scale.', [S('scale', 'Scale positions', 'fretboard', 'Major scale by shape.', [['scaleRun', { scale: 'major', box: 1 }], ['connectPositions', { scale: 'major', from: 1, to: 2 }]])]),
    U('Using CAGED', 'Chords and solos anywhere.', [S('use', 'CAGED in music', 'improv', '7th shapes and targets.', [['shapesAcrossNeck', { type: '7' }], ['targetSolo', { chords: '$folk145' }]])])
  ] },
  { id: 'harmony', title: 'Chords in a key', blurb: 'Why songs use the chords they do, and how to hear and use them.', domain: 'theory', cat: 'theory', re: /diatonic|chords in (a|the) key|harmon(y|i[sz]ed?)|roman numerals?|number system|nashville|music theory|\btheory\b/, ctx: { key: 7, prog: 'axis' }, units: [
    U('Triads of the major key', 'I ii iii IV V vi vii°.', [S('triads', 'The seven chords', 'theory', 'Build them from the scale.', [['diatonicCycle', { sevenths: false }]])]),
    U('Progressions', 'The numbers behind songs.', [S('prog', 'Common progressions', 'theory', 'I–V–vi–IV and friends.', [['triadProgression', { chords: '$axis' }], ['earKey', { chords: '$axis' }]])]),
    U('7th chords of the key', 'Four-note harmony.', [S('sevenths', 'Diatonic 7ths', 'theory', 'Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø.', [['diatonicCycle', { sevenths: true }]])]),
    U('The minor key', 'Natural minor and the borrowed V.', [S('minor', 'Minor-key chords', 'theory', 'i ♭VI ♭VII and V.', [['triadProgression', { chords: '$minorRock' }, { minor: true }], ['earKey', { chords: '$minorRock' }, { minor: true }]])]),
    U('Borrowed chords', 'Colors from outside the key.', [S('borrow', 'Borrowed chords', 'theory', '♭VII, iv and friends.', [['chordChanges', { chords: '$mixo' }], ['strumPattern', { chords: '$capo' }]])])
  ] },
  { id: 'fingerstyle', title: 'Fingerstyle', blurb: 'Independent thumb and fingers: Travis picking to chord melody.', domain: 'picking', cat: 'picking', re: /fingerstyle|finger.?pick|travis|classical|p.?i.?m.?a|chord.?melody/, ctx: { key: 0, prog: 'folkAxis' }, units: [
    U('p-i-m-a', 'Each finger owns a string.', [S('pima', 'Arpeggio patterns', 'picking', 'Thumb on bass, fingers on top.', [['pimaArpeggio', { chords: '$classical' }, { key: 9, minor: true }]])]),
    U('Travis picking', 'The alternating thumb.', [S('travis', 'Travis pattern', 'picking', 'Thumb steady, fingers in between.', [['travisPattern', { chords: '$folkAxis' }]])]),
    U('Bass and strum', 'Boom-chicka and more chords.', [S('boom', 'Boom-chicka', 'picking', 'Bass note, strum.', [['boomChicka', { chords: '$folk145' }], ['travisPattern', { chords: '$capo' }]])]),
    U('Percussive groove', 'Slaps and thumb hits.', [S('perc', 'Percussive fingerstyle', 'picking', 'The guitar as a drum kit.', [['percussiveGroove']])]),
    U('Chord melody', 'Melody and harmony together.', [S('cm', 'Chord melody', 'theory', 'Melody on top of chords.', [['chordMelody']])])
  ] },
  { id: 'funk', title: 'Funk rhythm guitar', blurb: '16th-note grooves, scratches and 9th chords.', domain: 'rhythm', cat: 'rhythm', re: /funk|16th.?(note)? strum|scratch|chop/, ctx: { key: 4, prog: 'funk9' }, units: [
    U('The 16th-note grid', 'Keep the hand moving.', [S('grid', '16th-note motion', 'rhythm', 'Constant down-up.', [['subdivisionLadder'], ['funkScratch']])]),
    U('Scratch rhythms', 'Muted and played notes.', [S('scratch', 'Scratch grooves', 'rhythm', 'Accents in the 16th grid.', [['funkScratch', {}, { key: 9 }], ['funkScratch', {}, { key: 2 }]])]),
    U('Chord color', '9ths and embellishments.', [S('color', 'Funk chord moves', 'theory', 'Small grips, big sound.', [['embellish', { chords: '$funk9' }]])]),
    U('Time without the click', 'Lock in by yourself.', [S('gap', 'Gap click', 'rhythm', 'The groove holds.', [['gapClick', { chords: '$funk9' }]])]),
    U('Lead fills', 'Single-note answers.', [S('fills', 'Funk fills', 'improv', 'Short Dorian answers.', [['callResponse', { chords: '$funk9', scale: 'dorian' }, { minor: true }]])])
  ] },
  { id: 'riffs', title: 'Riffs & palm muting', blurb: 'Tight, heavy rhythm parts: chugs, gallops and syncopated riffs.', domain: 'rhythm', cat: 'rhythm', re: /riffs?|palm.?mut|chug|gallop|downpick|metal rhythm|power.?chords?/, ctx: { key: 4, minor: true, prog: 'powerMinor' }, units: [
    U('Palm muting', 'Muted 8ths, all downstrokes.', [S('pm', 'Palm-muted 8ths', 'picking', 'Even chugs.', [['chugRiff', { rhythm: '8ths' }], ['powerRiff', { rhythm: 'drive' }]])]),
    U('Gallops', 'The 8th-and-two-16ths rhythm.', [S('gallop', 'Gallop rhythm', 'picking', 'Iron Maiden-style drive.', [['chugRiff', { rhythm: 'gallop' }]])]),
    U('Syncopation', 'Accents off the beat.', [S('synco', 'Syncopated riffs', 'rhythm', 'Pushes and stabs.', [['powerRiff', { rhythm: 'synco' }]])]),
    U('16th chugs', 'Speed and endurance.', [S('16', '16th-note chugs', 'picking', 'Alternate-picked mutes.', [['chugRiff', { rhythm: '16ths' }]])]),
    U('Odd-meter riffs', 'Riffs in 7.', [S('odd', 'Riffs in 7/8', 'rhythm', 'Odd groupings that groove.', [['oddMeterRiff', { meter: 7 }]])])
  ] },
  { id: 'strumming', title: 'Strumming patterns', blurb: 'Steady, musical strumming in every common feel.', domain: 'rhythm', cat: 'rhythm', re: /strum/, ctx: { key: 7, prog: 'axis' }, units: [
    U('The constant motion', 'Down on the beat, up in between.', [S('folk', 'Folk strum', 'rhythm', 'The pendulum hand.', [['strumPattern', { chords: '$axis', pattern: 'folk' }]])]),
    U('The pop pattern', 'Skipped strums with the hand still moving.', [S('pop', 'Pop strum', 'rhythm', 'D D U U D U.', [['strumPattern', { chords: '$axis', pattern: 'pop' }]])]),
    U('Other feels', 'Country and reggae.', [S('feels', 'Country and off-beat', 'rhythm', 'Bass–strum and chops.', [['strumPattern', { chords: '$folk145', pattern: 'country' }], ['strumPattern', { chords: '$axis', pattern: 'reggae' }]])]),
    U('16th-note strumming', 'Funk and pop grooves.', [S('16', '16th strums', 'rhythm', 'Accents in the grid.', [['funkScratch']])]),
    U('Songs and dynamics', 'Ballads and holding time.', [S('songs', 'Ballad and time', 'rhythm', 'Soft strumming that stays in time.', [['strumPattern', { chords: '$capo', pattern: 'ballad' }], ['gapClick', { chords: '$axis' }]])])
  ] },
  { id: 'changes-clean', title: 'Clean chord changes', blurb: 'Change chords on time, with every note ringing.', domain: 'fretting', cat: 'chords', re: /chord changes?|chord switch|switching chords|changing chords|change between|transitions?|chords? faster/, ctx: { key: 7, prog: 'axis' }, units: [
    U('Two chords', 'The smallest change, perfected.', [S('two', 'G to C', 'fretting', 'Four beats each, then two.', [['chordChanges', { chords: ['G', 'C'], beats: 4 }], ['chordChanges', { chords: ['Em', 'C', 'G', 'D'], beats: 4 }]])]),
    U('Four chords', 'G, C, D and Em.', [S('four', 'Four-chord changes', 'fretting', 'Two beats each.', [['chordChanges', { chords: ['G', 'C', 'D', 'Em'], beats: 2 }]])]),
    U('The A family', 'A, D and E.', [S('a', 'A–D–E', 'fretting', 'Anchor fingers.', [['chordChanges', { chords: ['A', 'D', 'E'], beats: 2 }], ['strumPattern', { chords: ['A', 'D', 'E'], pattern: 'pop' }]])]),
    U('With a barre', 'F in the middle of open chords.', [S('f', 'F, C, G, Am', 'fretting', 'The famous F change.', [['chordChanges', { chords: ['F', 'C', 'G', 'Am'], beats: 2 }]])]),
    U('Fast changes in songs', 'One beat per chord.', [S('fast', 'Fast changes', 'fretting', 'Changes on every beat.', [['chordChanges', { chords: ['G', 'Em', 'C', 'D'], beats: 1 }], ['strumPattern', { chords: ['C', 'G', 'Am', 'F'], pattern: 'pop' }]])])
  ] }
];
/** Artists as master-class topics (their lessons load when a class is built). */
export const ARTIST_TOPICS = ARTIST_INDEX.map(a => ({ id: 'artist-' + a.id, artist: a.id, title: `${a.name} style`, blurb: a.blurb, domain: (KB_BY_ID[(a.uses || [])[0]] || {}).domain || 'improv', cat: 'artist', re: a.re, ctx: a.ctx, units: null, techniques: a.techniques }));
export const MASTER_BY_ID = Object.fromEntries([...MASTER_TOPICS, ...ARTIST_TOPICS].map(t => [t.id, t]));

/** The built-in topic a text is about (or null). An artist's name wins: "Eric Johnson pentatonic runs" is the Eric Johnson class. */
export function matchTopic(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  const a = matchArtist(t); if (a) return MASTER_BY_ID['artist-' + a.id];
  const exact = MASTER_TOPICS.find(x => x.title.toLowerCase() === t.trim());
  return exact || MASTER_TOPICS.find(x => x.re.test(t)) || null;
}
/** The topic of a request: an artist first; otherwise a built-in topic named outside the technique names
 * ("speed pentatonics, rolling 5s" is a techniques course, not the pentatonic course). */
export function topicFor(text) {
  const a = matchArtist(text); if (a) return MASTER_BY_ID['artist-' + a.id];
  const techs = matchTechniques(text);
  let rest = String(text || '').toLowerCase(); techs.forEach(x => { rest = rest.replace(x.re, ' '); });
  return matchTopic(rest) || (techs.length ? null : matchTopic(text));
}
/** Topic title for a text without the artist rule (used per phrase). */
const matchPlainTopic = text => { const t = String(text || '').toLowerCase().trim(); return t ? MASTER_TOPICS.find(x => x.title.toLowerCase() === t) || MASTER_TOPICS.find(x => x.re.test(t)) || null : null; };

/* ---------------------- Library exercise → topic ---------------------- */
const ENTRY_TOPIC = {
  spider: 'dexterity', trills: 'dexterity', 'vibrato-holds': 'bends', bends: 'bends', 'bend-lick': 'bends',
  'speed-burst': 'speed', 'alt-burst': 'speed', 'string-cross': 'speed', 'string-skip': 'speed', sweep: 'sweep',
  gallop: 'riffs', chug: 'riffs', 'power-riff': 'riffs', 'power-shifts': 'riffs',
  travis: 'fingerstyle', pima: 'fingerstyle', 'boom-chicka': 'fingerstyle', legato: 'legato', tapping: 'legato',
  'open-changes': 'changes-clean', 'barre-changes': 'barre', 'triad-shapes': 'triads', 'triad-prog': 'triads', inversions: 'triads',
  'seventh-qualities': 'sevenths', shells: 'sevenths', drop2: 'sevenths', strum: 'strumming', funk: 'funk',
  shuffle: 'timing', subdivisions: 'timing', 'gap-click': 'timing', 'odd-meter': 'timing',
  penta: 'pentatonic', 'blues-scale': 'pentatonic', 'note-finder': 'fretboard', 'string-notes': 'fretboard',
  intervals: 'intervals', 'interval-trainer': 'intervals', arpeggio: 'changes', 'guide-tones': 'changes',
  'key-chords': 'harmony', modes: 'modes', echo: 'ear', 'find-key': 'ear', 'call-response': 'improv', 'target-solo': 'improv'
};
const ENTRY_TEXT = { hybrid: 'Hybrid picking and double-stops', 'double-stops': 'Double-stops in 3rds and 6ths', slides: 'Slides and position shifts', picado: 'Flamenco technique: picado and rasgueado', rasgueado: 'Flamenco technique: rasgueado and picado', embellish: 'Chord embellishments and neo-soul color', 'major-scale': 'The major scale across the whole neck', connect: 'Connecting scale positions across the neck' };
/** The master-class topic for a library exercise: {title, text, topicId?, domain, cat}. */
export function topicForEntry(entry) {
  const id = entry.id, cur = MASTER_BY_ID[ENTRY_TOPIC[id]];
  if (cur) return { title: cur.title, text: cur.title, topicId: cur.id, domain: cur.domain, cat: cur.cat, libId: id };
  const title = ENTRY_TEXT[id] || entry.title || entry.ex.name;
  return { title, text: title, topicId: null, domain: entry.ex.domain, cat: entry.cat, libId: id };
}

/* --------------------------- Difficulty --------------------------- */
const TOPIC_DOMAIN = {
  inversions: 'fretboard', drop2: 'fretboard', drop3: 'fretboard', shells: 'theory', triads: 'fretboard', caged: 'fretboard', barre: 'fretting', open: 'fretting', arpeggio: 'fretboard', chordMelody: 'theory', comping: 'theory', guideTones: 'improv',
  keychords: 'theory', progression: 'theory', modes: 'theory', scale: 'fretboard', intervals: 'ear', fretboard: 'fretboard', bends: 'fretting', vibrato: 'fretting', legato: 'fretting', tapping: 'fretting', sweep: 'picking',
  economy: 'picking', hybrid: 'picking', skip: 'picking', speed: 'picking', palm: 'picking', downpick: 'picking', slides: 'fretting', doublestops: 'fretting', travis: 'picking', classical: 'picking', percussive: 'picking',
  funk: 'rhythm', rasgueado: 'rhythm', picado: 'picking', oddmeter: 'rhythm', strum: 'rhythm', timing: 'rhythm', improv: 'improv', ear: 'ear', riff: 'rhythm', power: 'rhythm', changes: 'fretting', chordtypes: 'theory'
};
const levelOf = (p, dom) => (p.domains && p.domains[dom] ? p.domains[dom].level : null);
const avgLevel = p => { const v = SKILL_DOMAINS.map(k => levelOf(p, k)).filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 4; };
/** Main skill area of a topic (from the built-in list or the words). */
export function topicDomain(topic) {
  if (topic.topicId && MASTER_BY_ID[topic.topicId]) return MASTER_BY_ID[topic.topicId].domain;
  const cur = topicFor(topic.text || topic.title); if (cur) return cur.domain;
  if (topic.domain && DOMAIN_BY_KEY[topic.domain]) return topic.domain;
  const req = parseRequest(topic.text || topic.title);
  const d = req.topics.map(t => TOPIC_DOMAIN[t]).find(Boolean);
  return d || 'theory';
}
/** Starting level for a master class: your level in the topic's skill area. */
export function masterDifficulty(p, topic) { return clamp(Math.round(levelOf(p, topicDomain(topic)) || avgLevel(p)), 1, 10); }

/* --------------------------- Local builders --------------------------- */
function runEntry(c, e, lvl, skillDomain) {
  let ex = null;
  if (typeof e === 'function') ex = e(c);
  else if (Array.isArray(e)) ex = runAtom({ ...c, ...(e[2] || {}) }, e[0], e[1] || {});
  else if (e && e.spec) { const k = 0.8 + lvl * 0.06; ex = { ...e.spec, level: lvl, ...(e.spec.libId ? {} : { goalBpm: Math.round(e.spec.goalBpm * k), startBpm: Math.round(Math.min(e.spec.startBpm, e.spec.goalBpm * k * 0.7)) }) }; }
  if (ex && ['theory', 'ear', 'improv'].includes(skillDomain) && ex.domain !== skillDomain) ex.domain = skillDomain;
  if (ex && e && e.method && !ex.method) ex.method = e.method;
  return ex;
}
function curatedRaw(t, difficulty, genre) { return unitsRaw(t.units, { ctx: t.ctx, difficulty, genre, title: t.title }); }
/** Five steps for any topic the request parser understands. */
function genericRaw(p, topic, difficulty) {
  const req = parseRequest(topic.text || topic.title);
  if (!req.topics.length) return null;
  const steps = [
    ['Foundations', 'The first steps, slow and clean, with the idea behind them.', -1, 0, ['drill', 'main']],
    ['Building it', 'The core drills at your level.', 0, 5, ['main', 'drill']],
    ['New keys and positions', 'The same skills somewhere new, so they aren’t tied to one shape.', 1, 7, ['main', 'drill']],
    ['In real music', 'Using it over loops and progressions.', 1, 2, ['apply', 'main']],
    ['Mastery', 'Faster, harder and from memory.', 2, 10, ['main', 'apply', 'drill']]
  ];
  let base = req.key;
  const units = [];
  const seen = new Set();
  steps.forEach(([title, summary, dl, shift, roles], ui) => {
    const lv = clamp(difficulty + dl, 1, 10);
    const fake = { domains: Object.fromEntries(SKILL_DOMAINS.map(k => [k, { level: lv }])) };
    const r2 = { ...req, ...(base ? { key: { pc: mod12(base.pc + shift), minor: base.minor } } : {}) };
    const built = buildForRequest(fake, r2);
    if (!base) { const m = String(built.key || '').match(/^([A-G][♯♭#b]?)( minor)?/); const n = m && parseNote(m[1]); base = n ? { pc: n.pc, minor: !!m[2] } : { pc: 9, minor: true }; }
    const pick = built.items.filter(i => roles.includes(i.role)).sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role)).slice(0, 3).filter(i => !seen.has(JSON.stringify([i.raw.name, i.raw.level])));
    pick.forEach(i => seen.add(JSON.stringify([i.raw.name, i.raw.level])));
    if (!pick.length) return;
    const what = built.understood.length ? built.understood.join(' and ') : topic.title;
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const core = pick.filter(i => i.role !== 'apply'), apply = pick.filter(i => i.role === 'apply');
    const skills = [];
    if (core.length) skills.push({ id: `s${ui}a`, title: `${cap(what)}${ui ? ` in ${built.key}` : ''}`, domain: core[0].raw.domain, summary: summary, prereqs: [], exercises: core.map(i => i.raw) });
    if (apply.length) skills.push({ id: `s${ui}b`, title: `${cap(what)} in context`, domain: apply[0].raw.domain, summary: 'Use it in real music.', prereqs: [], exercises: apply.map(i => i.raw) });
    units.push({ title, summary, skills });
  });
  if (!units.length) return null;
  return { summary: `A five-step course on ${topic.title.toLowerCase()}: from the foundations to using it in music, in several keys.`, units };
}
/* ------------------------ Requests that name techniques ------------------------ */
/** Phrases of a request: "covering speed pentatonics, rolling 5s and spread triads" → ['speed pentatonics', 'rolling 5s', 'spread triads']. */
export function requestPhrases(text) {
  return String(text || '').toLowerCase()
    .replace(/\b(such as|including|covering|like|e\.g\.|especially|focus(ing)? on|with)\b/g, ',')
    .split(/[,;:\n/&]|\band\b|\bplus\b/).map(x => x.replace(/[^a-z0-9♯♭# '-]/g, ' ').replace(/\s+/g, ' ').trim()).filter(x => x.length >= 3 && x.length <= 60);
}
/** Your level in an area (for picking the right stage of a path). */
const yourLevel = (p, dom) => clamp(Math.round(levelOf(p, dom) || avgLevel(p)), 1, 10);
/**
 * Units for the knowledge-base entries a request names: for each, the stage at your level and the
 * next one (so a request is never generic), then a unit for each other built-in topic it names.
 * Units carry their own level (lvl) and key (ctx).
 */
async function requestedUnits(p, text, { skipTech = new Set(), skipTopics = new Set() } = {}) {
  const units = [], seen = new Set(skipTopics);
  const metas = matchTechniques(text).filter(x => !skipTech.has(x.id));
  const entries = await loadEntries(metas.map(x => x.id));
  entries.forEach(e => {
    const lv = yourLevel(p, e.domain), cur = stageFor(e, lv); if (!cur) return;
    const i = e.stages.indexOf(cur), take = metas.length > 2 ? [cur] : e.stages.slice(i, i + 2);
    take.forEach((st, k) => units.push({ ...U(take.length > 1 ? `${e.title}: ${TIER_BY_ID[st.tier].name.toLowerCase()}` : e.title, st.goal, st.skills), lvl: k ? st.levels[0] : clamp(lv, st.levels[0], st.levels[1]), ctx: e.ctx }));
  });
  for (const ph of requestPhrases(text)) {
    if (matchTechniques(ph).length || matchArtist(ph)) continue;
    const t = matchPlainTopic(ph); if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    units.push({ ...U(t.title, t.blurb, t.units.slice(0, 2).map(u => u.skills[0]).filter(Boolean)), ctx: t.ctx });
  }
  return units;
}
/** Knowledge-base entries an artist's lessons already cover. */
const artistTechIds = artistId => new Set((ARTIST_META_BY_ID[artistId] || {}).uses || []);
/** Base units with requested ones added before the closing unit, at most 8 in all. */
function mergeUnits(base, extra) {
  if (!extra.length) return base;
  const ex = extra.slice(0, 6), room = Math.max(1, 8 - ex.length - 1);
  return [...base.slice(0, -1).slice(0, room), ...ex, base[base.length - 1]];
}
const TOGETHER = U('Putting it together', 'Every technique inside real phrases, over a loop.', [
  S('together', 'Mix it into a solo', 'improv', 'Use each technique as one phrase among others.', [['callResponse', { chords: '$minorRock' }], ['targetSolo', { chords: '$minorRock' }]])]);

/** Raw course from units that may carry their own level (lvl) and key (ctx); others ramp from the difficulty. */
function unitsRaw(units, { ctx, difficulty, genre, title }) {
  const n = units.length;
  const out = units.map((u, ui) => {
    const lvl = u.lvl != null ? u.lvl : clamp(difficulty - 1 + Math.round(ui * 3 / Math.max(1, n - 1)), 1, 10);
    const x = u.ctx || ctx, c = { key: x.key, minor: !!x.minor, lvl, genre, prog: x.prog };
    return { title: u.title, summary: u.summary, skills: u.skills.map(s => ({ id: s.id, title: s.title, domain: s.domain, summary: s.summary, prereqs: [], exercises: s.ex.map(e => runEntry(c, e, lvl, s.domain)).filter(Boolean) })).filter(s => s.exercises.length) };
  }).filter(u => u.skills.length);
  const keyNm = ROOT_BY_PC[ctx.key] ? ROOT_BY_PC[ctx.key].name : '';
  return { summary: `${title}, step by step: ${units.map(u => u.title.toLowerCase()).join(', ')}. Starts in ${keyNm}${ctx.minor ? ' minor' : ''}; every exercise can be moved to any key.`, units: out };
}
/**
 * A full learning path as a course: one unit per stage, from the stage at your level (or from
 * scratch when you're new to it) up to mastery. Each unit's lessons are built at that stage's level.
 */
export function pathRaw(e, startLevel, genre) {
  const first = e.stages.findIndex(s => s.levels[1] >= startLevel);
  const stages = e.stages.slice(first < 0 ? e.stages.length - 1 : first);
  const units = stages.map((st, i) => ({ ...U(`${TIER_BY_ID[st.tier].name}: ${st.title}`, st.goal, st.skills), lvl: i ? st.levels[0] : clamp(startLevel, st.levels[0], st.levels[1]) }));
  const raw = unitsRaw(units, { ctx: e.ctx, genre, title: e.title, difficulty: startLevel });
  raw.summary = `${e.title} from ${stages.length === e.stages.length && first <= 0 ? 'scratch' : TIER_BY_ID[stages[0].tier].name.toLowerCase()} to ${TIER_BY_ID[stages[stages.length - 1].tier].name.toLowerCase()}: ${stages.map(s => TIER_BY_ID[s.tier].name.toLowerCase()).join(' → ')}. Each stage's lessons are built at its level.`;
  return raw;
}

/** The built-in plan for a course's request: {raw, kind, techniques} or null. kind: artist | path | topic | techniques | generic. */
async function localMasterRaw(p, course) {
  const text = course.topic ? course.topic.text || course.topic.title : course.style;
  const byId = course.topic && course.topic.topicId && MASTER_BY_ID[course.topic.topicId];
  const techs = matchTechniques(text);
  const t = byId && !techs.length ? byId : topicFor(text);
  if (t && t.artist) {
    const a = await loadArtist(t.artist);
    const extra = await requestedUnits(p, text, { skipTech: artistTechIds(t.artist) });
    return { raw: unitsRaw(mergeUnits(a.units, extra), { ctx: a.ctx, difficulty: course.difficulty, genre: course.genre, title: `${a.name} style` }), kind: 'artist', techniques: techs };
  }
  // One knowledge-base entry with a full path (or no built-in topic to lean on): the path itself
  if (techs.length === 1 && (techs[0].complete || !t)) {
    const e = await loadEntry(techs[0].id);
    return { raw: pathRaw(e, course.difficulty, course.genre), kind: 'path', techniques: techs };
  }
  if (t) {
    const extra = (await requestedUnits(p, text, { skipTopics: new Set([t.id]) })).filter(u => techs.some(x => u.title.startsWith(x.title)));
    return { raw: unitsRaw(mergeUnits(t.units, extra), { ctx: t.ctx, difficulty: course.difficulty, genre: course.genre, title: t.title }), kind: 'topic', techniques: techs };
  }
  const units = await requestedUnits(p, text);
  if (units.length) {
    const req = parseRequest(text);
    const ctx = { key: req.key ? req.key.pc : 9, minor: req.key ? !!req.key.minor : true, prog: 'minorRock' };
    const raw = unitsRaw([...units.slice(0, 7), TOGETHER], { ctx, difficulty: course.difficulty, genre: course.genre, title: course.topic ? course.topic.title : course.style });
    raw.summary = `A course built on what you named: ${techs.map(x => x.title.toLowerCase()).join(', ') || units.map(u => u.title.toLowerCase()).join(', ')}, each from the stage at your level, then all of it together in real music.`;
    return { raw, kind: 'techniques', techniques: techs };
  }
  const g = genericRaw(p, course.topic || { title: course.style, text: course.style }, course.difficulty);
  return g ? { raw: g, kind: 'generic', techniques: [] } : null;
}
/** Built-in master class tree, or null when the topic isn't one the app knows. */
export async function generateMasterLocal(p, course) {
  const r = await localMasterRaw(p, course);
  if (!r) return null;
  const tree = normalizeTree(r.raw, { generatedBy: 'local', difficulty: course.difficulty, version: LOCAL_TREE_VERSION, style: course.style });
  if (!tree.units.length) return null;
  tree.kind = r.kind;
  return tree;
}

/* ---------------------------- Claude builder ---------------------------- */
// Two steps, so a big course is never cut off: an outline first (what every unit
// and skill covers, with each technique the student named as its own skill), then
// the exercises unit by unit, a few requests at a time. A unit Claude can't write
// is filled from the built-in lessons for its skills.
const SYSTEM = 'You are a world-class guitar teacher and curriculum designer who uses deliberate practice, the 70–85% success "edge zone", spaced repetition and interleaving. You give the student exactly what they asked for, specifically and in depth, never a generic substitute.';
const wait = ms => new Promise(r => setTimeout(r, ms));
async function askJSON(opts, tries = 3) {
  for (let i = 0; ; i++) {
    try { return await Claude.json(opts); } catch (e) {
      if (!['rate_limited', 'overloaded'].includes(e && e.code) || i >= tries - 1) throw e;
      await wait(12000 * (i + 1));
    }
  }
}
async function pool(tasks, n) {
  const out = new Array(tasks.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => { while (next < tasks.length) { const i = next++; try { out[i] = { ok: true, value: await tasks[i]() }; } catch (e) { out[i] = { ok: false, error: e }; } } }));
  return out;
}

async function outlineWithClaude(p, course) {
  const t = course.topic || { title: course.style, text: course.style };
  const words = t.text && t.text !== t.title ? t.text : t.title;
  const genres = (p.questionnaire.genres || []).map(g => (GENRE_BY_ID[g] ? GENRE_BY_ID[g].name : g)).join(', ') || 'rock';
  const existing = p.courses.filter(c => c.id !== course.id).map(c => c.name);
  const seen = matchTechniques(words).map(x => x.title);
  const d = course.difficulty;
  const content = `Design the OUTLINE of a MASTER CLASS: a complete guitar course built entirely around what the student asked for.

REQUEST: "${t.title}"${words !== t.title ? ` (in the student's words: "${words}")` : ''}
${t.from ? `The student started from the exercise "${t.from.name}"${t.from.why ? ` (${t.from.why})` : ''}.\n` : ''}${seen.length ? `Techniques the app spotted in the request: ${seen.join(', ')}.\n` : ''}STUDENT: ${JSON.stringify(profileBrief(p))}
Favorite genres: ${genres}. Level in this topic: ${d}/10 (${tierName(d)}).

Step 1: in "required", list every specific technique, pattern, concept or skill the student named, in their words (e.g. "rolling 5s", "spread triads"). If they name an artist or a style, add that player's 3–6 most characteristic techniques.
Step 2: outline 5–6 units of 2–3 skills each. EVERY item in "required" gets at least one skill whose title names it and whose "covers" repeats it. No generic filler: a skill that would fit any course (a plain scale box, a chromatic spider, open-chord changes) only if the request is about it.
- Teach in the order a great teacher would: unit 1 is the smallest useful first step, doable this week; build to about level ${Math.min(10, d + 3)}; the last unit uses everything in real music in the student's genres (${genres}).
- Each skill's "plan" says in one sentence exactly what its 2–3 exercises will be (pattern, key, string set, rhythm, tempo idea).

Return JSON:
{"name": string (2–5 words, vivid and specific; must differ from ${JSON.stringify(existing)}),
 "tagline": string (max 12 words), "summary": string (2 sentences: what the student can do at the end),
 "required": [string],
 "units": [{"title": string, "summary": string, "skills": [{"id": "kebab-slug", "title": string, "domain": one of ${JSON.stringify(SKILL_DOMAINS)}, "summary": string, "covers": string, "plan": string}]}]}`;
  const o = await askJSON({ feature: 'master-class', system: SYSTEM, content, maxTokens: 4000 });
  const units = (o && Array.isArray(o.units) ? o.units : []).slice(0, 7).map(u => ({
    title: String(u.title || 'Unit').slice(0, 60), summary: String(u.summary || '').slice(0, 240),
    skills: (Array.isArray(u.skills) ? u.skills : []).slice(0, 4).map((s, i) => ({ id: String(s.id || s.title || 'skill-' + i).slice(0, 40), title: String(s.title || 'Skill').slice(0, 60), domain: SKILL_DOMAINS.includes(s.domain) ? s.domain : 'fretting', summary: String(s.summary || '').slice(0, 240), covers: String(s.covers || '').slice(0, 80), plan: String(s.plan || '').slice(0, 300) }))
  })).filter(u => u.skills.length);
  if (!units.length) throw new Error('Claude returned an empty outline.');
  return { units, name: typeof o.name === 'string' ? o.name.trim().slice(0, 60) : null, tagline: typeof o.tagline === 'string' ? o.tagline.trim().slice(0, 120) : null, summary: String(o.summary || '').slice(0, 300), required: (Array.isArray(o.required) ? o.required : []).map(String).slice(0, 12) };
}

async function unitWithClaude(p, course, outline, ui, { short = false } = {}) {
  const t = course.topic || { title: course.style, text: course.style };
  const words = t.text || t.title, u = outline.units[ui], n = outline.units.length;
  const lvl = clamp(course.difficulty - 1 + Math.round(ui * 3 / Math.max(1, n - 1)), 1, 10);
  const doms = new Set(u.skills.map(s => s.domain));
  const lib = EXERCISES.filter(e => doms.has(e.domain)).map(e => ({ libId: e.id, name: e.name, goalBpm: e.goalBpm }));
  const brief = profileBrief(p);
  const content = `Write the exercises for unit ${ui + 1} of ${n} of the master class "${outline.name || t.title}".
The student asked for: "${words}". Required items: ${JSON.stringify(outline.required)}.
Whole course, for context only: ${outline.units.map((x, i) => `${i + 1}. ${x.title} (${x.skills.map(s => s.title).join('; ')})`).join(' | ')}
THIS UNIT: "${u.title}": ${u.summary}
Skills to write (keep each id): ${JSON.stringify(u.skills)}
STUDENT levels: ${JSON.stringify(brief.levels)}. Guitar: ${brief.guitar || 'electric'}. This unit's level: ${lvl}/10.

Rules:
- ${short ? '2 exercises' : '2–3 exercises'} per skill, each exactly about that skill and following its plan. If a skill names a technique (e.g. rolling 5s, spread triads), the exercises drill that technique itself.
- Measurable: startBpm = a tempo this student can play cleanly today; goalBpm = mastery tempo.
- Original exercises "in the style of"; never transcribe copyrighted songs or solos.
- Give a tab for every single-note exercise (max ${short ? 24 : 40} notes); chord exercises give "voicings".
${TAB_RULES}- Built-in exercises ("libId", then omit tab) only if one is exactly right: ${JSON.stringify(lib)}

Return JSON: {"skills":[{"id": string (as given), "exercises":[${EXERCISE_SCHEMA}]}]}`;
  const r = await askJSON({ feature: 'master-class', system: SYSTEM, content, maxTokens: short ? 6000 : 7000 });
  const byId = {};
  (r && Array.isArray(r.skills) ? r.skills : []).forEach((s, i) => { const id = s && s.id != null ? String(s.id) : u.skills[i] && u.skills[i].id; if (id && Array.isArray(s.exercises)) byId[id] = s.exercises.slice(0, 3); });
  return byId;
}

/** Built-in exercises for one outlined skill (when Claude couldn't write it). */
async function localSkillExercises(p, course, skill, lvl) {
  const text = `${skill.title} ${skill.covers || ''}`;
  const tech = matchTechniques(text)[0] || matchTechniques(skill.plan || '')[0];
  const topic = matchTopic(text);
  let entries = null, ctx = { key: 9, minor: true, prog: 'minorRock' };
  if (tech) { const e = await loadEntry(tech.id), st = stageFor(e, lvl); entries = (st ? st.skills : e.stages[0].skills).flatMap(k => k.ex).slice(0, 3); ctx = e.ctx; }
  else if (topic && topic.units) { entries = topic.units.slice(0, 2).flatMap(u => u.skills[0] ? u.skills[0].ex : []).slice(0, 3); ctx = topic.ctx; }
  if (entries) {
    const c = { key: ctx.key, minor: !!ctx.minor, lvl, genre: course.genre, prog: ctx.prog };
    return entries.map(e => runEntry(c, e, lvl, skill.domain)).filter(Boolean);
  }
  const fake = { domains: Object.fromEntries(SKILL_DOMAINS.map(k => [k, { level: lvl }])) };
  const built = buildForRequest(fake, parseRequest(text));
  return built.items.slice(0, 2).map(i => i.raw);
}

export async function generateMasterWithClaude(p, course, { onProgress = () => {} } = {}) {
  onProgress({ step: 'outline' });
  const outline = await outlineWithClaude(p, course);
  const n = outline.units.length;
  let done = 0;
  onProgress({ step: 'units', done, total: n });
  const results = await pool(outline.units.map((u, ui) => async () => {
    try { return await unitWithClaude(p, course, outline, ui); }
    catch (e) { if (e && e.code === 'cut_off') return await unitWithClaude(p, course, outline, ui, { short: true }); throw e; }
    finally { onProgress({ step: 'units', done: ++done, total: n }); }
  }), 3);
  let filled = 0;
  const units = await Promise.all(outline.units.map(async (u, ui) => {
    const lvl = clamp(course.difficulty - 1 + Math.round(ui * 3 / Math.max(1, n - 1)), 1, 10);
    const written = results[ui] && results[ui].ok ? results[ui].value : {};
    return { title: u.title, summary: u.summary, skills: await Promise.all(u.skills.map(async s => {
      let exercises = written[s.id] || [];
      if (!exercises.length) { exercises = await localSkillExercises(p, course, s, lvl); if (exercises.length) filled++; }
      return { id: s.id, title: s.title, domain: s.domain, summary: s.summary, prereqs: [], exercises };
    })) };
  }));
  if (results.every(r => !r.ok)) throw results[0].error || new Error('Claude couldn’t write the exercises.');
  const tree = normalizeTree({ summary: outline.summary, units }, { generatedBy: 'claude', difficulty: course.difficulty, style: course.style });
  if (!tree.units.length) throw new Error('Claude returned an empty course.');
  tree.required = outline.required;
  return { tree, name: outline.name, tagline: outline.tagline, filled };
}

/** A course name from the techniques a request named, when the title is a long sentence. */
function techniqueName(course, techs) {
  if (!course.autoName || !techs.length || (course.topic && course.topic.title.length <= 40)) return null;
  return `${techs.slice(0, 3).map(x => x.title).join(', ')} Master Class`;
}

/**
 * Build (or rebuild) a master class plan. Returns {tree, usedClaude, source, error?, cached?}.
 * source: 'artist' (built-in Artist Series lessons), 'path' (a knowledge-base learning path), 'cache' (a plan Claude designed before for the
 * same request: no API cost), 'claude', or 'local'. fresh: skip the saved plan (a rebuild).
 */
export async function buildMasterTree(p, course, { fresh = false, onProgress = () => {} } = {}) {
  const text = course.topic ? course.topic.text || course.topic.title : course.style;
  const t = (course.topic && course.topic.topicId && MASTER_BY_ID[course.topic.topicId]) || topicFor(text);
  const taken = new Set(p.courses.filter(c => c.id !== course.id).map(c => c.name.toLowerCase()));
  const rename = (name, tagline) => { if (!course.autoName) return; if (name && !taken.has(name.toLowerCase())) course.name = name; if (tagline) course.tagline = tagline; };
  const done = (tree, extra) => { course.tree = tree; course.state = null; return { tree, usedClaude: false, ...extra }; };

  // Artists: the built-in Artist Series lessons, no API call
  if (t && t.artist) {
    const tree = await generateMasterLocal(p, course);
    if (tree) { const a = ARTIST_META_BY_ID[t.artist]; rename(`${a.name} Master Class`, a.blurb); if (course.topic) course.topic.cat = 'artist'; return done(tree, { source: 'artist' }); }
  }
  // One topic with a complete learning path in the knowledge base: the path itself, no API call
  const techs = matchTechniques(text);
  if (techs.length === 1 && techs[0].complete && !fresh) {
    const tree = await generateMasterLocal(p, course);
    if (tree) { rename(`${techs[0].title} Master Class`, techs[0].summary); return done(tree, { source: 'path' }); }
  }
  // A plan Claude already designed for this request (same or similar words, same level): no API call
  if (!fresh) {
    const hit = getMaster(p, text, course.difficulty);
    if (hit) { hit.tree.generatedAt = Date.now(); hit.tree.fromCache = true; rename(hit.name, hit.tagline); return done(hit.tree, { source: 'cache', cached: true }); }
  }
  let tree = null, error = null, usedClaude = false;
  if (Claude.hasKey()) {
    try {
      const r = await generateMasterWithClaude(p, course, { onProgress });
      tree = r.tree; usedClaude = true;
      rename(r.name, r.tagline);
      putMaster(p, text, course.difficulty, { tree: r.tree, name: r.name, tagline: r.tagline });
    } catch (e) { error = e.message || String(e); }
  }
  if (!tree) {
    tree = await generateMasterLocal(p, course);
    if (tree) { const n = techniqueName(course, matchTechniques(text)); if (n) rename(n, null); }
  }
  if (!tree) throw new Error(error ? `Claude couldn’t build it (${error}), and the built-in plans don’t cover “${course.topic.title}”.` : `The built-in plans don’t cover “${course.topic.title}” yet. Connect Claude in Settings and any topic works, or pick one of the suggested topics.`);
  course.tree = tree; course.state = null;
  return { tree, usedClaude, error, source: usedClaude ? 'claude' : tree.kind === 'path' ? 'path' : 'local' };
}

/** Can this topic be built right now (Claude connected, or a built-in plan exists)? */
export function canBuild(topic) {
  if (Claude.hasKey()) return true;
  if (topic.topicId || matchTopic(topic.text || topic.title) || matchTechniques(topic.text || topic.title).length) return true;
  return parseRequest(topic.text || topic.title).topics.length > 0;
}

/** Create a master class (the plan is built separately with buildMasterTree). */
export function createMasterClass(p, { title, text = '', topicId = null, libId = null, domain = null, cat = null, from = null, difficulty = null }) {
  title = String(title || text || '').trim().slice(0, 80);
  const cur = (topicId && MASTER_BY_ID[topicId]) || topicFor(text || title);
  const topic = { title, text: String(text || title).trim().slice(0, 300), topicId: cur ? cur.id : null, libId, domain: null, cat: cat || (cur ? cur.cat : null), from };
  topic.domain = domain && DOMAIN_BY_KEY[domain] ? domain : topicDomain(topic);
  if (!topic.cat) topic.cat = { fretting: 'fretting', picking: 'picking', rhythm: 'rhythm', fretboard: 'scales', theory: 'theory', ear: 'ear', improv: 'ear' }[topic.domain] || 'theory';
  const diff = clamp(Math.round(difficulty || masterDifficulty(p, topic)), 1, 10);
  const taken = new Set(p.courses.map(c => c.name.toLowerCase()));
  let name = `${title.charAt(0).toUpperCase() + title.slice(1)} Master Class`; let k = 2;
  while (taken.has(name.toLowerCase())) name = `${title} Master Class ${k++}`;
  const course = {
    id: uid(), kind: 'master', name, autoName: true, tagline: cur ? cur.blurb : `A whole course on ${title.toLowerCase()}, from the first step to mastery.`,
    genre: (p.questionnaire.genres || [])[0] || 'rock', style: title, players: [], topic,
    difficulty: diff, levelLabel: tierName(diff), createdAt: today(), status: 'open', progress: 0, tree: null, lessons: [], lastPracticed: null
  };
  p.courses.push(course);
  return course;
}
export const isMaster = c => !!(c && c.kind === 'master');
/** Open master classes for a topic (to avoid suggesting one you already have). */
const haveTopic = (p, id) => p.courses.some(c => isMaster(c) && c.status !== 'archived' && c.topic && c.topic.topicId === id);

/* -------------------------- Recommendations -------------------------- */
// A new mix every time the app is opened (stable while it stays open).
const SESSION_SEED = Math.floor(Math.random() * 2 ** 31);
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const GENRE_TOPICS = { blues: ['pentatonic', 'bends', 'changes'], jazz: ['changes', 'sevenths', 'modes'], metal: ['riffs', 'speed', 'sweep'], funk: ['funk', 'sevenths', 'timing'], neosoul: ['sevenths', 'triads', 'changes'], folk: ['fingerstyle', 'strumming', 'changes-clean'], country: ['fingerstyle', 'bends'], fingerstyle: ['fingerstyle', 'harmony'], prog: ['timing', 'modes', 'legato'], rock: ['pentatonic', 'riffs', 'bends'], 'classic-rock': ['pentatonic', 'bends'], punk: ['riffs', 'strumming'], indie: ['triads', 'strumming'], pop: ['strumming', 'changes-clean', 'harmony'], jrock: ['legato', 'speed', 'triads'], latin: ['fingerstyle', 'modes'] };

/** n topics to suggest, reshuffled on every app open. Skips the "For you" pick and topics you already have a class for. */
export function recommendedTopics(p, n = 4, exclude = []) {
  const rnd = seeded(SESSION_SEED);
  const pool = MASTER_TOPICS.filter(t => !exclude.includes(t.id) && !haveTopic(p, t.id)).map(t => ({ t, r: rnd() }));
  // nudge topics from your genres up a little, so the mix fits you
  const fav = new Set((p.questionnaire.genres || []).flatMap(g => GENRE_TOPICS[g] || []));
  pool.forEach(x => { if (fav.has(x.t.id)) x.r -= 0.25; });
  return pool.sort((a, b) => a.r - b.r).slice(0, n).map(x => x.t);
}

const DOMAIN_TOPICS = { fretting: ['changes-clean', 'barre', 'bends', 'dexterity', 'legato'], picking: ['speed', 'fingerstyle', 'sweep'], rhythm: ['timing', 'strumming', 'funk'], fretboard: ['fretboard', 'caged', 'triads'], theory: ['harmony', 'modes', 'sevenths'], ear: ['ear', 'intervals'], improv: ['improv', 'changes', 'pentatonic'] };
const STRUGGLE_TOPIC = { changes: 'changes-clean', barre: 'barre', speed: 'speed', timing: 'timing', strum: 'strumming', fretboard: 'fretboard', improv: 'improv', ear: 'ear', theory: 'harmony', tension: 'dexterity' };
const STRUGGLE_LABEL = { changes: 'chord changes', barre: 'barre chords', speed: 'speed', timing: 'timing', strum: 'strumming', fretboard: 'knowing the fretboard', improv: 'improvising', ear: 'playing by ear', theory: 'theory', tension: 'tension' };

/**
 * "For you": the topic that would help most right now, with the reason.
 * Weighs how far each skill area trails your average, the struggles you named,
 * stalled exercises, and your weakest intervals in the trainer.
 * Returns [{topic, reason, score}] best first (up to 3).
 */
export function forYou(p) {
  const avg = avgLevel(p), scores = new Map(), why = new Map();
  const add = (id, s, reason) => { if (!MASTER_BY_ID[id] || haveTopic(p, id)) return; scores.set(id, (scores.get(id) || 0) + s); if (reason && !(why.get(id) || []).includes(reason)) why.set(id, [...(why.get(id) || []), reason]); };
  const genreFav = new Set((p.questionnaire.genres || []).flatMap(g => GENRE_TOPICS[g] || []));
  for (const k of SKILL_DOMAINS) {
    const l = levelOf(p, k); if (l == null) continue;
    const gap = avg - l;
    if (gap < 0.5) continue;
    const name = DOMAIN_BY_KEY[k].name;
    (DOMAIN_TOPICS[k] || []).forEach((id, i) => add(id, gap * 2 - i * 0.4 + (genreFav.has(id) ? 0.5 : 0), `your ${name.toLowerCase()} is level ${l}, ${Math.round(gap * 10) / 10 >= 1.5 ? `${Math.round(gap)} levels` : 'a level'} below your average`));
  }
  for (const s of p.questionnaire.struggles || []) if (STRUGGLE_TOPIC[s]) add(STRUGGLE_TOPIC[s], 2.2, `you said ${STRUGGLE_LABEL[s]} is a struggle`);
  if (p.focus && p.focus.domain && DOMAIN_TOPICS[p.focus.domain]) add(DOMAIN_TOPICS[p.focus.domain][0], 1, `${DOMAIN_BY_KEY[p.focus.domain].name.toLowerCase()} is your current focus area`);
  // stalled exercises in your courses
  const stalledDomains = {};
  for (const c of p.courses || []) for (const u of (c.tree && c.tree.units) || []) for (const s of u.skills) for (const e of s.exercises) { const st = c.state && c.state.exercises && c.state.exercises[e.id]; if (st && st.stalled) stalledDomains[e.domain] = (stalledDomains[e.domain] || 0) + 1; }
  Object.entries(stalledDomains).forEach(([d, n]) => (DOMAIN_TOPICS[d] || []).slice(0, 1).forEach(id => add(id, Math.min(2, n * 0.7), `${n} exercise${n > 1 ? 's' : ''} in ${DOMAIN_BY_KEY[d] ? DOMAIN_BY_KEY[d].name.toLowerCase() : d} ${n > 1 ? 'have' : 'has'} stalled`)));
  const by = p.intervalStats && p.intervalStats.byInterval;
  if (by) { const weak = Object.entries(by).filter(([, b]) => b.n >= 4 && b.correct / b.n < 0.75).length; if (weak) add('intervals', 1 + weak * 0.3, `${weak} interval${weak > 1 ? 's are' : ' is'} under 75% in the trainer`); }
  if (!scores.size) {
    // nothing stands out: suggest the next step for your strongest genre
    const g = (p.questionnaire.genres || [])[0]; (GENRE_TOPICS[g] || ['pentatonic', 'timing']).forEach((id, i) => add(id, 1 - i * 0.2, `it’s central to ${GENRE_BY_ID[g] ? GENRE_BY_ID[g].name : 'your music'}`));
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, score]) => {
    const rs = (why.get(id) || []).slice(0, 2);
    return { topic: MASTER_BY_ID[id], score, reason: rs.length ? `Because ${rs.join(', and ')}.` : '' };
  });
}

/* ----------------------- Any exercise → topic ----------------------- */
const ATOM_TOPIC = {
  modeCompare: 'modes', guideTones: 'changes', arpeggioBox: 'changes', targetSolo: 'improv', callResponse: 'improv', bendLick: 'bends', vibratoHolds: 'bends', doubleStopRnR: 'bends',
  legatoRun: 'legato', tapLick: 'legato', sweepArp: 'sweep', speedBurst: 'speed', stringSkip: 'speed', strumPattern: 'strumming', chordChanges: 'changes-clean', funkScratch: 'funk',
  powerRiff: 'riffs', chugRiff: 'riffs', shuffleRiff: 'timing', travisPattern: 'fingerstyle', pimaArpeggio: 'fingerstyle', boomChicka: 'fingerstyle', percussiveGroove: 'fingerstyle',
  chordMelody: 'fingerstyle', diatonicCycle: 'harmony', triadProgression: 'triads', inversionCycle: 'triads', drop2Comp: 'sevenths', shellComp: 'sevenths', qualityCycle: 'sevenths',
  embellish: 'sevenths', shapesAcrossNeck: 'caged', noteFinder: 'fretboard', intervalShapes: 'intervals', earKey: 'ear', echoPhrases: 'ear', subdivisionLadder: 'timing', gapClick: 'timing', oddMeterRiff: 'timing',
  connectPositions: 'pentatonic'
};
const SCALE_TOPIC = { minorPent: 'pentatonic', majorPent: 'pentatonic', blues: 'pentatonic', majorBlues: 'pentatonic', dorian: 'modes', mixolydian: 'modes', lydian: 'modes', phrygian: 'modes', locrian: 'modes' };
/** The master-class topic for any exercise (a routine item, a song section, a course exercise). */
export function topicForExercise(ex) {
  const g = ex && ex.gen;
  const id = g ? (g.atom === 'scaleRun' ? SCALE_TOPIC[(g.opts || {}).scale] || 'speed' : ATOM_TOPIC[g.atom]) : null;
  const cur = (id && MASTER_BY_ID[id]) || matchTopic(`${ex.name} ${ex.unit || ''}`);
  const from = { name: ex.name, why: ex.why || '' };
  if (cur) return { title: cur.title, text: cur.title, topicId: cur.id, domain: cur.domain, cat: cur.cat, from };
  return { title: ex.name, text: ex.name, domain: ex.domain, from };
}

/* ----------------------------- Artist Series ----------------------------- */
/** Build normalized lessons from skills at a level: [{skill, ex}]. */
function buildLessons(skills, c, lvl, idPrefix, keyPrefix, used = new Set()) {
  return skills.flatMap(s => s.ex.map(e => runEntry(c, e, lvl, s.domain)).filter(Boolean).map(raw => {
    const base = raw.id || raw.name;
    const ex = normalizeExercise({ ...raw, id: `${idPrefix}-${base}` }, used);
    if (ex && ex.level == null) ex.level = lvl;
    return ex ? { skill: s, ex, key: `${keyPrefix}:${base}` } : null;
  }).filter(Boolean));
}
/**
 * An artist's lessons at the player's level, ready to practice: [{unit, skill, ex, key}].
 * key identifies the lesson across levels (its progress lives in profile.varState).
 */
export async function artistLessonList(p, artistId) {
  const meta = ARTIST_META_BY_ID[artistId]; if (!meta) return [];
  const a = await loadArtist(artistId), t = MASTER_BY_ID['artist-' + artistId];
  const lvl = masterDifficulty(p, { title: t.title, text: t.title, topicId: t.id });
  const used = new Set();
  return a.units.flatMap((u, ui) => {
    const ulvl = clamp(lvl - 1 + Math.round(ui * 3 / Math.max(1, a.units.length - 1)), 1, 10);
    const c = { key: a.ctx.key, minor: !!a.ctx.minor, lvl: ulvl, genre: a.genre, prog: a.ctx.prog };
    return buildLessons(u.skills, c, ulvl, artistId, `artist:${artistId}`, used).map(l => ({ ...l, unit: u }));
  });
}

/* ---------------------------- Technique Library ---------------------------- */
/** The level to start a topic at: your level in its skill area, inside the path's range. */
export function techniqueLevelFor(p, techId) {
  const t = KB_BY_ID[techId]; if (!t) return 4;
  const [lo, hi] = t.level || [1, 10];
  return clamp(Math.round(levelOf(p, t.domain) || avgLevel(p)), lo, hi);
}
/** One stage's lessons built at a level: [{skill, ex, key}]. tier defaults to the stage at that level. */
export async function stageLessonList(p, techId, { tier = null, lvl = null } = {}) {
  const e = await loadEntry(techId);
  const L = clamp(Math.round(lvl || techniqueLevelFor(p, techId)), 1, 10);
  const st = (tier && e.stages.find(s => s.tier === tier)) || stageFor(e, L); if (!st) return [];
  const level = clamp(L, st.levels[0], st.levels[1]);
  const c = { key: e.ctx.key, minor: !!e.ctx.minor, lvl: level, genre: (p.questionnaire.genres || [])[0] || 'rock', prog: e.ctx.prog };
  return buildLessons(st.skills, c, level, `tech-${techId}`, `kb:${techId}`);
}
/** Progress on a path: per stage, lessons practiced and mastered (from profile.varState). */
export function pathProgress(p, meta, lessonKeysByTier) {
  const vs = p.varState || {};
  return Object.fromEntries((meta.stages || []).map(st => {
    const keys = lessonKeysByTier[st.tier] || [];
    const states = keys.map(k => vs[`${k}~base`]).filter(Boolean);
    return [st.tier, { total: st.lessons, practiced: states.filter(x => x.history && x.history.length).length, mastered: states.filter(x => x.mastered).length }];
  }));
}
