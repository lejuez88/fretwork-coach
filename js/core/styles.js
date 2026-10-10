// Style library: for every genre and style focus, the key, progression and a
// unit-by-unit plan of exercise generators. Local course plans and the daily
// routine pools come from here, so each course practices its own vocabulary
// (a Texas shuffle course is in E with shuffles, bends and double-stops; a
// jazz comping course is shells and drop-2s over ii–V–I).
import { ROOT_BY_PC, mod12, chordName, parseNote } from './theory.js';
import { ATOMS } from './atoms.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { hash } from './util.js';

/* --------------------------- Progressions --------------------------- */
// [semitones from key, chord type]
const P = {
  blues: [[0, '7'], [5, '7'], [0, '7'], [7, '7']],
  blues9: [[0, '9'], [5, '9'], [0, '9'], [7, '9']],
  minorRock: [[0, 'min'], [8, 'maj'], [10, 'maj'], [0, 'min']],
  mixo: [[0, 'maj'], [10, 'maj'], [5, 'maj'], [0, 'maj']],
  power145: [[0, '5'], [5, '5'], [7, '5'], [5, '5']],
  powerMinor: [[0, '5'], [8, '5'], [10, '5'], [0, '5']],
  popPunk: [[0, '5'], [7, '5'], [9, '5'], [5, '5']],
  axis: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']],
  folk145: [[0, 'maj'], [5, 'maj'], [7, 'maj'], [0, 'maj']],
  folkAxis: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']],
  indie: [[5, 'add9'], [9, 'm7'], [0, 'maj'], [7, 'sus4']],
  iiVI: [[2, 'm7'], [7, '7'], [0, 'maj7'], [0, 'maj7']],
  iiVIminor: [[2, 'm7b5'], [7, '7'], [0, 'm7'], [0, 'm7']],
  royal: [[5, 'maj7'], [7, '7'], [4, 'm7'], [9, 'm7']],
  neo: [[5, 'maj7'], [4, 'm7'], [2, 'm7'], [0, 'maj7']],
  dorianVamp: [[0, 'm7'], [5, '9']],
  funk9: [[0, '9'], [5, '9']],
  andalusian: [[0, 'min'], [10, 'maj'], [8, 'maj'], [7, 'maj']],
  classical: [[0, 'min'], [5, 'min'], [7, 'maj'], [0, 'min']],
  country: [[0, 'maj'], [5, 'maj'], [0, 'maj'], [7, 'maj']],
  progMinor: [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']],
  latinRock: [[0, 'm7'], [5, '9']],
  slowBlues: [[0, '9'], [5, '9'], [0, '9'], [7, '9']],
  sus: [[0, 'sus2'], [0, 'maj'], [0, 'sus4'], [0, 'maj']],
  capo: [[0, 'maj'], [9, 'min'], [4, 'min'], [5, 'maj']],
  dimVamp: [[0, 'dim7'], [0, 'dim7'], [3, 'dim7'], [3, 'dim7']],
  dom7b9: [[0, '7b9'], [0, '7b9'], [5, 'maj7'], [5, 'maj7']],
  augVamp: [[0, 'aug7'], [0, 'aug7'], [5, 'maj7'], [5, 'maj7']],
  alteredV: [[0, '7s9'], [0, '7s9'], [5, 'm7'], [5, 'm7']],
  lydDom: [[0, '9'], [0, '9'], [10, 'maj7'], [10, 'maj7']],
  minMaj: [[0, 'mmaj7'], [0, 'mmaj7'], [5, 'm6'], [7, '7b9']]
};
export const progressionNames = (keyPc, id) => (P[id] || P.axis).map(([s, t]) => chordName(mod12(keyPc + s), t));

/* ------------------------------ Styles ------------------------------ */
// Each style: key, minor (for scale/bend context), prog, units: [title, summary, [[id, title, domain, summary, [[atom, opts]...]]]]
// Option values starting with "$" are resolved: $prog (main progression), $<progId> (named progression).
const U = (title, summary, skills) => ({ title, summary, skills });
const S = (id, title, domain, summary, ex) => ({ id, title, domain, summary, ex });

const STYLES = {
  blues: {
    default: { key: 'A', minor: true, prog: 'blues' },
    'Texas Shuffle': { key: 'E', minor: true, prog: 'blues', units: [
      U('The shuffle', 'Swing feel and the boogie rhythm part.', [S('shuffle', 'Boogie shuffle in E', 'rhythm', 'Root–5th / root–6th with a swing feel.', [['shuffleRiff'], ['subdivisionLadder', { feel: 'swing' }]])]),
      U('The E box', 'Where Texas licks live.', [S('e-box', 'E minor pentatonic & blues scale', 'fretboard', 'Box 1 in open position and at the 12th fret.', [['scaleRun', { scale: 'minorPent' }], ['scaleRun', { scale: 'blues', pattern: 'threes' }]]), S('every-e', 'Every E on the neck', 'fretboard', 'Root positions that anchor every shape.', [['noteFinder']])]),
      U('Bends & double-stops', 'The Texas vocabulary.', [S('bends', 'Bends and vibrato', 'fretting', 'Bends to pitch, singing vibrato.', [['bendLick'], ['vibratoHolds']]), S('ds', 'Double-stop fills', 'fretting', 'Rhythmic double-stops on the top strings.', [['doubleStopRnR'], ['doubleStops', { interval: '3rds' }]])]),
      U('Harmony', 'Dominant chords and where the notes come from.', [S('dom', 'Dominant 7th and 9th grips', 'theory', 'E7, A7, B7 shapes and their 9th versions.', [['chordChanges', { chords: '$blues', beats: 2 }], ['chordChanges', { chords: '$blues9', beats: 2 }]]), S('ear', 'Hear the changes', 'ear', 'Find I, IV and V by ear.', [['earKey', { chords: '$prog' }]])]),
      U('Making music', 'Solo over the shuffle.', [S('connect', 'Box 1 to box 2', 'fretboard', 'Move the solo up the neck.', [['connectPositions', { scale: 'minorPent', from: 1, to: 2 }]]), S('solo', 'Texas lead over the shuffle', 'improv', 'Call-and-response phrases that follow the changes.', [['callResponse', { chords: '$prog' }], ['targetSolo', { chords: '$prog' }]])])
    ] },
    'Chicago Blues Lead': { key: 'A', minor: true, prog: 'blues', units: [
      U('Box 1 and the blues scale', 'The core soloing shape.', [S('a-box', 'A minor pentatonic box 1', 'fretboard', 'The home position.', [['scaleRun', { scale: 'minorPent' }], ['scaleRun', { scale: 'blues' }]])]),
      U('Expression', 'Bends, vibrato and space.', [S('bends', 'Bends to pitch', 'fretting', 'Whole-step bends on G and B.', [['bendLick'], ['vibratoHolds']])]),
      U('Major and minor colors', 'Mixing the major pentatonic in.', [S('major-pent', 'A major pentatonic', 'fretboard', 'The sweet side of blues lead.', [['scaleRun', { scale: 'majorPent' }], ['scaleRun', { scale: 'majorBlues', pattern: 'threes' }]]), S('dom', 'Dominant chords', 'theory', 'A7, D7, E7 and their chord tones.', [['chordChanges', { chords: '$prog' }], ['guideTones', { chords: '$prog' }]])]),
      U('The neck', 'Beyond box 1.', [S('connect', 'Connect boxes 1–2 and 2–3', 'fretboard', 'Slide between positions mid-phrase.', [['connectPositions', { from: 1, to: 2 }], ['connectPositions', { from: 2, to: 3 }]]), S('ear', 'Echo licks by ear', 'ear', 'Copy short phrases in time.', [['echoPhrases', { chords: '$prog' }]])]),
      U('Making music', 'Chicago-style solos.', [S('solo', 'Call and response', 'improv', 'Phrases with space that answer each other.', [['callResponse', { chords: '$prog' }], ['targetSolo', { chords: '$prog' }]])])
    ] },
    'Slow Blues Phrasing': { key: 'G', minor: true, prog: 'slowBlues', units: [
      U('Feel', 'Slow 12/8 time and long notes.', [S('feel', 'Triplet feel', 'rhythm', 'Slow blues lives on the triplet.', [['subdivisionLadder', { feel: 'swing' }], ['chordChanges', { chords: '$slowBlues', beats: 4 }]])]),
      U('Vocal phrasing', 'Make every note sing.', [S('vib', 'Vibrato and bends', 'fretting', 'Long notes with in-tune bends and vibrato.', [['vibratoHolds'], ['bendLick']]), S('box', 'G minor pentatonic', 'fretboard', 'The slow-blues box.', [['scaleRun', { scale: 'minorPent', unit: 'triplets' }]])]),
      U('Sweet notes', 'Thirds and the major side.', [S('thirds', 'Double-stop 3rds', 'fretting', 'Soulful fills between phrases.', [['doubleStops', { interval: '3rds' }]]), S('mixo', 'Major pentatonic over the I chord', 'fretboard', 'Switching to the major sound.', [['scaleRun', { scale: 'majorPent', unit: 'triplets' }]])]),
      U('Harmony', '9th chords and chord tones.', [S('ninths', '9th chord grips', 'theory', 'G9, C9, D9 shapes.', [['chordChanges', { chords: '$slowBlues', beats: 4 }], ['guideTones', { chords: '$slowBlues' }]])]),
      U('Making music', 'Tell a story over 12 bars.', [S('story', 'Space and repetition', 'improv', 'Fewer notes, more meaning.', [['callResponse', { chords: '$slowBlues' }], ['echoPhrases', { chords: '$slowBlues' }]])])
    ] }
  },
  rock: {
    default: { key: 'A', minor: true, prog: 'minorRock' },
    'Riff Architecture': { key: 'E', minor: true, prog: 'powerMinor', units: [
      U('Riff rhythm', 'Tight power chords and rests.', [S('riff', 'Syncopated power-chord riff', 'rhythm', 'The rhythm is the riff.', [['powerRiff', { rhythm: 'synco' }], ['powerRiff', { rhythm: 'stab', degrees: [0, 3, 5, 3] }]])]),
      U('Low-string control', 'Palm muting and chugs.', [S('chug', 'Palm-muted 8ths', 'picking', 'Even, tight muting.', [['chugRiff', { rhythm: '8ths' }]]), S('notes', 'Notes on the low strings', 'fretboard', 'Know where every riff note is.', [['noteFinder']])]),
      U('Riff vocabulary', 'Scales behind the riffs.', [S('penta', 'E minor pentatonic & blues riffs', 'fretboard', 'Single-note riff material.', [['scaleRun', { scale: 'blues', pattern: 'threes' }], ['stringSkip']])]),
      U('Harmony', 'Which chords fit together.', [S('keychords', 'Chords of E minor', 'theory', 'i, ♭VI, ♭VII and the rest.', [['diatonicCycle']]), S('ear', 'Riffs by ear', 'ear', 'Echo short riffs.', [['echoPhrases', { chords: '$prog' }]])]),
      U('Making music', 'Write and play riffs.', [S('write', 'Riff over the loop', 'improv', 'Make up a 2-bar riff and repeat it.', [['callResponse', { chords: '$prog', scale: 'blues' }], ['gapClick', { chords: '$prog' }]])])
    ] },
    'Power Chord Drive': { key: 'A', minor: false, prog: 'power145', units: [
      U('Drive', 'Steady 8ths.', [S('drive', 'Driving 8th-note power chords', 'rhythm', 'Endurance and evenness.', [['powerRiff', { rhythm: 'drive', degrees: [0, 5, 7, 5] }], ['strumPattern', { chords: '$power145', pattern: 'rock8' }]])]),
      U('Changes', 'Moving shapes cleanly.', [S('changes', 'Power-chord changes', 'fretting', 'Root on 6 and 5.', [['chordChanges', { chords: '$powerMinor', beats: 2 }], ['powerRiff', { rhythm: 'halftime', degrees: [0, 10, 8, 7] }]])]),
      U('Time', 'Locking in.', [S('time', 'Time without the click', 'rhythm', 'Internal clock.', [['gapClick', { chords: '$prog' }], ['subdivisionLadder']])]),
      U('Fretboard', 'Roots everywhere.', [S('roots', 'Root notes on strings 6 and 5', 'fretboard', 'Find any power chord fast.', [['noteFinder'], ['intervalShapes']])]),
      U('Making music', 'Play the song.', [S('song', 'Verse-chorus drive', 'repertoire', 'Dynamics: palm-muted verse, open chorus.', [['chugRiff', { rhythm: '8ths' }], ['powerRiff', { rhythm: 'synco', degrees: [0, 7, 9, 5] }]])])
    ] },
    'Arena Lead': { key: 'A', minor: true, prog: 'minorRock', units: [
      U('Lead shapes', 'Pentatonic and minor.', [S('box', 'A minor pentatonic boxes 1–2', 'fretboard', 'The lead toolbox.', [['scaleRun', { scale: 'minorPent' }], ['connectPositions', { from: 1, to: 2 }]])]),
      U('Expression', 'Bends that sing.', [S('bends', 'Bends and vibrato', 'fretting', 'Stadium-sized bends.', [['bendLick'], ['vibratoHolds']])]),
      U('Speed & legato', 'Fast, fluid lines.', [S('speed', 'Pentatonic bursts', 'picking', 'Short fast cells.', [['speedBurst'], ['scaleRun', { scale: 'minorPent', pattern: 'threes', unit: '16ths' }]]), S('legato', 'Legato runs', 'fretting', '3-notes-per-string flow.', [['legatoRun', { scale: 'minor' }]])]),
      U('Harmony', 'The natural minor.', [S('minor', 'A natural minor', 'theory', 'Adding the 2 and ♭6.', [['scaleRun', { scale: 'minor', nps: 3 }], ['modeCompare', { modes: ['minorPent', 'minor'] }]])]),
      U('Making music', 'Arena solo.', [S('solo', 'Melodic solo over i–♭VI–♭VII', 'improv', 'Target chord tones, build to a peak.', [['targetSolo', { chords: '$prog' }], ['callResponse', { chords: '$prog' }]])])
    ] }
  },
  'classic-rock': {
    default: { key: 'A', minor: false, prog: 'mixo' },
    'Pentatonic Storytelling': { key: 'A', minor: true, prog: 'minorRock', units: [
      U('Box 1', 'The storyteller’s shape.', [S('box', 'A minor pentatonic', 'fretboard', 'Phrase, don’t run.', [['scaleRun', { scale: 'minorPent' }], ['scaleRun', { scale: 'minorPent', pattern: 'threes' }]])]),
      U('Voice', 'Bends and vibrato.', [S('voice', 'Bends that speak', 'fretting', 'Pitch and vibrato.', [['bendLick'], ['vibratoHolds']])]),
      U('Up the neck', 'Five boxes, one key.', [S('connect', 'Connect positions', 'fretboard', 'Boxes 1–2 and 2–3.', [['connectPositions', { from: 1, to: 2 }], ['connectPositions', { from: 2, to: 3 }]])]),
      U('Harmony', 'Major and minor pentatonic.', [S('relative', 'Relative major and minor', 'theory', 'Same shape, different home.', [['modeCompare', { modes: ['minorPent', 'majorPent'] }]]), S('ear', 'Echo phrases', 'ear', 'Play what you hear.', [['echoPhrases', { chords: '$prog' }]])]),
      U('Making music', 'Solos that tell a story.', [S('story', 'Call and response', 'improv', 'Question, answer, resolution.', [['callResponse', { chords: '$prog' }], ['targetSolo', { chords: '$prog' }]])])
    ] },
    'British Blues-Rock': { key: 'E', minor: true, prog: 'blues', units: [
      U('Shuffle and drive', 'Blues rhythm, rock volume.', [S('shuffle', 'Boogie shuffle', 'rhythm', 'Swing feel at volume.', [['shuffleRiff']])]),
      U('Blues-rock lead', 'Box 1 and bends.', [S('box', 'E blues scale', 'fretboard', 'Box 1 at the 12th fret and open.', [['scaleRun', { scale: 'blues' }]]), S('bends', 'Bends and double-stops', 'fretting', 'Aggressive bends, tight double-stops.', [['bendLick'], ['doubleStopRnR']])]),
      U('Major-minor mix', 'Two pentatonics.', [S('mix', 'Major and minor pentatonic', 'fretboard', 'Switch colors per chord.', [['scaleRun', { scale: 'majorPent' }], ['modeCompare', { modes: ['minorPent', 'majorPent'] }]])]),
      U('Harmony', 'Dominant chords.', [S('dom', 'E7, A7, B7', 'theory', 'Grips and chord tones.', [['chordChanges', { chords: '$prog' }], ['guideTones', { chords: '$prog' }]])]),
      U('Making music', 'Blues-rock solo.', [S('solo', 'Solo over the shuffle', 'improv', 'Riff, solo, riff.', [['callResponse', { chords: '$prog', scale: 'blues' }], ['targetSolo', { chords: '$prog' }]])])
    ] },
    'Vintage Riffcraft': { key: 'A', minor: false, prog: 'mixo', units: [
      U('Open-chord riffs', 'Chords that move.', [S('open', 'A–G–D open-chord riffing', 'rhythm', 'Mixolydian rock rhythm.', [['strumPattern', { chords: '$prog', pattern: 'rock8' }], ['chordChanges', { chords: '$prog', beats: 2 }]])]),
      U('Rock ’n’ roll lead', 'Double-stops.', [S('rnr', 'Double-stop licks', 'fretting', 'The vintage lead sound.', [['doubleStopRnR'], ['bendLick']])]),
      U('Riffs', 'Power and stabs.', [S('riff', 'Stab riffs', 'rhythm', 'Short, punchy hits.', [['powerRiff', { rhythm: 'stab', degrees: [0, 10, 5, 0] }], ['powerRiff', { rhythm: 'synco', degrees: [0, 3, 5, 0] }]])]),
      U('Harmony', 'The ♭VII sound.', [S('mixo', 'A mixolydian', 'theory', 'Why A–G–D works.', [['scaleRun', { scale: 'mixolydian', nps: 3 }], ['diatonicCycle']])]),
      U('Making music', 'Riff and solo.', [S('solo', 'Solo over A–G–D', 'improv', 'Major pentatonic with the ♭7.', [['targetSolo', { chords: '$prog', scale: 'majorPent' }], ['callResponse', { chords: '$prog', scale: 'majorPent' }]])])
    ] }
  },
  metal: {
    default: { key: 'E', minor: true, prog: 'powerMinor' },
    'Thrash Precision': { key: 'E', minor: true, prog: 'powerMinor', units: [
      U('Right hand', 'Tremolo and gallops.', [S('gallop', 'Gallops and 16th chugs', 'picking', 'Tight palm-muted rhythm.', [['chugRiff', { rhythm: 'gallop' }], ['chugRiff', { rhythm: '16ths' }]])]),
      U('Riffs', 'Chromatic and Phrygian.', [S('riff', 'Phrygian power-chord riff', 'rhythm', 'The ♭2 menace.', [['powerRiff', { rhythm: 'drive', degrees: [0, 1, 0, 3] }], ['powerRiff', { rhythm: 'synco', degrees: [0, 6, 5, 1] }]])]),
      U('Fretboard', 'Scales for riffs and leads.', [S('phrygian', 'E Phrygian & harmonic minor', 'fretboard', 'Dark scale colors.', [['scaleRun', { scale: 'phrygian', nps: 3 }], ['scaleRun', { scale: 'harmonicMinor', nps: 3 }]])]),
      U('Speed', 'Lead bursts.', [S('burst', 'Speed bursts', 'picking', 'Synchronized hands.', [['speedBurst', { scale: 'minorPent' }]]), S('time', 'Time at speed', 'rhythm', 'Hold tempo without the click.', [['gapClick', { chords: '$prog' }]])]),
      U('Making music', 'Riff writing.', [S('write', 'Write a thrash riff', 'improv', 'Gallop + chromatic hooks.', [['callResponse', { chords: '$prog', scale: 'blues' }]])])
    ] },
    'Downpicking Endurance': { key: 'E', minor: true, prog: 'powerMinor', units: [
      U('Downstrokes', 'Build stamina.', [S('down', 'Downpicked 8ths', 'picking', 'All downstrokes, relaxed.', [['chugRiff', { rhythm: '8ths' }], ['powerRiff', { rhythm: 'drive', degrees: [0, 0, 10, 8] }]])]),
      U('Riffs', 'Power chords at tempo.', [S('riff', 'Downpicked riffs', 'rhythm', 'Accents and muting.', [['powerRiff', { rhythm: 'drive', degrees: [0, 3, 5, 7] }], ['chugRiff', { rhythm: 'gallop' }]])]),
      U('Time', 'Steady at speed.', [S('time', 'Endurance with a gap click', 'rhythm', 'Hold the tempo for minutes.', [['gapClick', { chords: '$prog' }], ['subdivisionLadder']])]),
      U('Fretboard', 'Low-string notes.', [S('notes', 'Notes on strings 6 and 5', 'fretboard', 'Find riff notes instantly.', [['noteFinder'], ['intervalShapes']])]),
      U('Making music', 'Full riffs.', [S('song', 'Riff medley', 'repertoire', 'Link riffs without stopping.', [['powerRiff', { rhythm: 'synco', degrees: [0, 8, 10, 0] }]])])
    ] },
    'Shred Foundations': { key: 'A', minor: true, prog: 'minorRock', units: [
      U('Alternate picking', 'Clean, fast, relaxed.', [S('alt', 'Bursts and 3nps runs', 'picking', 'Synchronized hands.', [['speedBurst'], ['scaleRun', { scale: 'minor', nps: 3, unit: '16ths', pattern: 'threes' }]])]),
      U('Legato', 'Fluid lines.', [S('legato', '3nps legato', 'fretting', 'Hammer-ons and pull-offs.', [['legatoRun', { scale: 'harmonicMinor' }]])]),
      U('Arpeggios', 'Sweeps and tapping.', [S('sweep', 'Sweep arpeggios', 'picking', 'One motion through the strings.', [['sweepArp']]), S('tap', 'Tapping', 'fretting', 'Three-finger lines.', [['tapLick']])]),
      U('Harmony', 'Neoclassical color.', [S('harm', 'Harmonic minor', 'theory', 'The raised 7th.', [['scaleRun', { scale: 'harmonicMinor', nps: 3 }], ['modeCompare', { modes: ['minor', 'harmonicMinor'] }]])]),
      U('Making music', 'Shred solo.', [S('solo', 'Solo with speed and melody', 'improv', 'Fast runs that land on chord tones.', [['targetSolo', { chords: '$prog', scale: 'minor' }]])])
    ] }
  },
  punk: {
    default: { key: 'A', minor: false, prog: 'power145' },
    'Three-Chord Velocity': { key: 'A', minor: false, prog: 'power145', units: [
      U('Downstrokes', 'Fast and even.', [S('down', 'Downstroke 8ths', 'picking', 'All down, all the time.', [['strumPattern', { chords: '$power145', pattern: 'punk' }], ['powerRiff', { rhythm: 'drive' }]])]),
      U('Changes', 'No gaps.', [S('changes', 'I–IV–V power chords', 'fretting', 'Shift the shape on the last 8th.', [['chordChanges', { chords: '$power145', beats: 2 }]])]),
      U('Endurance', 'Two minutes straight.', [S('endure', 'Stamina at tempo', 'rhythm', 'Hold tempo, stay loose.', [['chugRiff', { rhythm: '8ths' }], ['gapClick', { chords: '$power145' }]])]),
      U('Fretboard', 'Roots on 6 and 5.', [S('roots', 'Power-chord roots', 'fretboard', 'Any chord, instantly.', [['noteFinder']])]),
      U('Making music', 'Play a song.', [S('song', 'Verse-chorus in three chords', 'repertoire', 'Palm-muted verse, open chorus.', [['powerRiff', { rhythm: 'synco', degrees: [0, 5, 7, 0] }]])])
    ] },
    'Pop-Punk Power': { key: 'C', minor: false, prog: 'popPunk', units: [
      U('Palm-muted verses', 'Tight 8ths.', [S('pm', 'Palm-muted 8ths', 'picking', 'Muted verse drive.', [['chugRiff', { rhythm: '8ths' }], ['powerRiff', { rhythm: 'drive', degrees: [0, 7, 9, 5] }]])]),
      U('Open choruses', 'Big chords.', [S('chorus', 'I–V–vi–IV power chords', 'rhythm', 'The pop-punk progression.', [['strumPattern', { chords: '$popPunk', pattern: 'punk' }], ['chordChanges', { chords: '$axis', beats: 2 }]])]),
      U('Riffs', 'Single-note hooks.', [S('hooks', 'Major pentatonic hooks', 'fretboard', 'Catchy lead lines.', [['scaleRun', { scale: 'majorPent' }]])]),
      U('Harmony', 'Why it works.', [S('key', 'Chords of the key', 'theory', 'I, IV, V and vi.', [['diatonicCycle']])]),
      U('Making music', 'Song form.', [S('song', 'Verse to chorus', 'repertoire', 'Dynamics between sections.', [['triadProgression', { chords: '$axis' }]])])
    ] },
    'Garage Grit': { key: 'E', minor: true, prog: 'minorRock', units: [
      U('Raw rhythm', 'Open chords and stabs.', [S('stabs', 'Stab riffs', 'rhythm', 'Short and loud.', [['powerRiff', { rhythm: 'stab', degrees: [0, 10, 8, 10] }], ['strumPattern', { chords: '$prog', pattern: 'rock8' }]])]),
      U('Lead', 'Blues-scale garage licks.', [S('licks', 'E blues licks', 'fretboard', 'Box 1 at the open position.', [['scaleRun', { scale: 'blues' }], ['doubleStopRnR']])]),
      U('Expression', 'Bends.', [S('bends', 'Rough bends', 'fretting', 'In tune, even when rough.', [['bendLick']])]),
      U('Harmony', 'Minor key chords.', [S('key', 'Chords of E minor', 'theory', 'i, ♭VI, ♭VII.', [['diatonicCycle']])]),
      U('Making music', 'Jam.', [S('jam', 'Garage jam', 'improv', 'Riff, then solo.', [['callResponse', { chords: '$prog', scale: 'blues' }]])])
    ] }
  },
  indie: {
    default: { key: 'G', minor: false, prog: 'indie' },
    'Arpeggio Textures': { key: 'D', minor: false, prog: 'axis', units: [
      U('Arpeggiated chords', 'Picking patterns.', [S('arp', 'Triad arpeggios through the changes', 'picking', 'Let notes ring.', [['triadProgression', { chords: '$prog', arpeggio: true }], ['openDrone', { chords: '$prog' }]])]),
      U('String skipping', 'Angular lines.', [S('skip', 'String-skipped patterns', 'picking', 'Wide intervals.', [['stringSkip']])]),
      U('Inversions', 'Voicings that move less.', [S('inv', 'Triad inversions', 'fretboard', 'Three string sets.', [['triadProgression', { chords: '$prog', set: [2, 3, 4] }], ['triadProgression', { chords: '$prog', set: [3, 4, 5] }]])]),
      U('Harmony', 'Key and color.', [S('key', 'Chords of D major', 'theory', 'Roman numerals.', [['diatonicCycle']]), S('ear', 'Hear the key', 'ear', 'Find home by ear.', [['earKey', { chords: '$prog' }]])]),
      U('Making music', 'Layered parts.', [S('layer', 'A part that complements', 'improv', 'Write a 2-bar arpeggio part.', [['callResponse', { chords: '$prog', scale: 'majorPent' }]])])
    ] },
    'Alt-Rock Voicings': { key: 'G', minor: false, prog: 'indie', units: [
      U('Add9 and sus', 'Open, ringing grips.', [S('voicings', 'Cadd9–Em7–G–Dsus4', 'fretting', 'The alt-rock chord set.', [['chordChanges', { chords: '$indie', beats: 2 }], ['strumPattern', { chords: '$indie', pattern: 'pop' }]])]),
      U('Dynamics', 'Quiet verse, loud chorus.', [S('dyn', 'Power-chord chorus', 'rhythm', 'Switch textures.', [['powerRiff', { rhythm: 'drive', degrees: [0, 9, 5, 7] }], ['strumPattern', { chords: '$axis', pattern: 'rock8' }]])]),
      U('Voicings up the neck', 'Inversions.', [S('inv', 'Triads on the top strings', 'fretboard', 'Move less, sound bigger.', [['triadProgression', { chords: '$axis' }]])]),
      U('Harmony', 'Borrowed chords.', [S('key', 'Chords of G major', 'theory', 'And where Em7 comes from.', [['diatonicCycle', { sevenths: true }]])]),
      U('Making music', 'Song part.', [S('song', 'Verse-chorus arrangement', 'repertoire', 'Two textures, one song.', [['openDrone', { chords: '$axis' }]])])
    ] },
    'Jangle & Drone': { key: 'D', minor: false, prog: 'sus', units: [
      U('Drones', 'Open strings ringing.', [S('drone', 'Shapes over open strings', 'picking', 'Chiming arpeggios.', [['openDrone', { chords: '$axis' }]])]),
      U('Jangle strumming', 'Bright, steady.', [S('jangle', 'Sus embellishments', 'rhythm', 'Dsus2–D–Dsus4–D.', [['strumPattern', { chords: '$sus', pattern: 'folk' }], ['chordChanges', { chords: '$sus', beats: 2 }]])]),
      U('Arpeggios', 'Picking patterns.', [S('arp', 'Arpeggiated triads', 'picking', 'Let it ring.', [['triadProgression', { chords: '$axis', arpeggio: true }]])]),
      U('Harmony', 'Modal flavor.', [S('modal', 'D mixolydian vs major', 'theory', 'The ♭7 drone.', [['modeCompare', { modes: ['major', 'mixolydian'] }]])]),
      U('Making music', 'Hypnotic parts.', [S('loop', 'A looping part', 'improv', 'Repetition with small changes.', [['callResponse', { chords: '$axis', scale: 'majorPent' }]])])
    ] }
  },
  pop: {
    default: { key: 'G', minor: false, prog: 'axis' },
    'Campfire to Stage Strumming': { key: 'G', minor: false, prog: 'axis', units: [
      U('Strumming', 'A steady hand.', [S('strum', 'D–DU–UDU pattern', 'rhythm', 'The pop strum.', [['strumPattern', { chords: '$prog', pattern: 'pop' }], ['subdivisionLadder']])]),
      U('Changes', 'On the beat.', [S('changes', 'G–D–Em–C changes', 'fretting', 'No gaps.', [['chordChanges', { chords: '$prog', beats: 2 }]])]),
      U('More patterns', 'Variety.', [S('patterns', 'Folk and ballad patterns', 'rhythm', 'Three patterns, one song.', [['strumPattern', { chords: '$prog', pattern: 'folk' }], ['strumPattern', { chords: '$prog', pattern: 'ballad' }]])]),
      U('Harmony', 'The four-chord song.', [S('key', 'Chords of G major', 'theory', 'I–V–vi–IV everywhere.', [['diatonicCycle']]), S('time', 'Time on your own', 'rhythm', 'Gap click.', [['gapClick', { chords: '$prog' }]])]),
      U('Making music', 'Accompany a song.', [S('song', 'Verse and chorus', 'repertoire', 'Different pattern per section.', [['triadProgression', { chords: '$prog' }]])])
    ] },
    'Capo Craft': { key: 'C', minor: false, prog: 'capo', units: [
      U('Open shapes', 'Shapes you capo.', [S('shapes', 'C–Am–Em–F', 'fretting', 'Clean open grips.', [['chordChanges', { chords: '$capo', beats: 2 }]])]),
      U('Embellishments', 'Sus and add9.', [S('sus', 'Sus2–sus4 movement', 'fretting', 'Decorate the chord.', [['strumPattern', { chords: '$sus', pattern: 'folk' }]])]),
      U('Patterns', 'Strum and pick.', [S('strum', 'Strum patterns with a capo', 'rhythm', 'Same shapes, new key.', [['strumPattern', { chords: '$capo', pattern: 'pop' }], ['travisPattern', { chords: '$capo' }]])]),
      U('Harmony', 'Transposing.', [S('trans', 'Capo math', 'theory', 'Shapes vs sounding key.', [['diatonicCycle']])]),
      U('Making music', 'Arrange a song.', [S('song', 'Capo arrangement', 'repertoire', 'Choose shapes that ring.', [['triadProgression', { chords: '$capo', arpeggio: true }]])])
    ] },
    'Songwriter Accompaniment': { key: 'C', minor: false, prog: 'folkAxis', units: [
      U('Fingerpicking', 'Thumb and fingers.', [S('travis', 'Travis pattern', 'picking', 'Alternating bass.', [['travisPattern', { chords: '$folkAxis' }]])]),
      U('Strumming', 'Ballad feel.', [S('ballad', 'Ballad strum', 'rhythm', 'Space in the pattern.', [['strumPattern', { chords: '$folkAxis', pattern: 'ballad' }]])]),
      U('Voicings', 'Inversions for accompaniment.', [S('inv', 'Triads up the neck', 'fretboard', 'Smooth voice leading.', [['triadProgression', { chords: '$folkAxis' }]])]),
      U('Harmony', 'Keys and numbers.', [S('key', 'Chords of C major', 'theory', 'Writing with numerals.', [['diatonicCycle']]), S('ear', 'Hear the changes', 'ear', 'I, IV, V, vi by ear.', [['earKey', { chords: '$folkAxis' }]])]),
      U('Making music', 'Accompany yourself.', [S('song', 'Boom-chicka to picking', 'repertoire', 'Switch textures per section.', [['boomChicka', { chords: '$folk145' }]])])
    ] }
  },
  funk: {
    default: { key: 'E', minor: true, prog: 'dorianVamp' },
    '16th-Note Pocket': { key: 'E', minor: true, prog: 'dorianVamp', units: [
      U('The 16th hand', 'Never stop moving.', [S('scratch', '16th scratch on Em7', 'rhythm', 'Muted and open strokes.', [['funkScratch'], ['subdivisionLadder']])]),
      U('Pocket', 'Time and space.', [S('pocket', 'Gap click groove', 'rhythm', 'Lock without the click.', [['gapClick', { chords: '$prog' }]])]),
      U('Voicings', 'Small, top-string chords.', [S('voicings', 'm7 and 9 grips', 'fretting', 'Funk chord shapes.', [['chordChanges', { chords: '$prog', beats: 2 }], ['funkScratch', { chord: 'A9' }]])]),
      U('Harmony', 'Dorian.', [S('dorian', 'E Dorian', 'theory', 'The funk mode.', [['scaleRun', { scale: 'dorian', nps: 3 }], ['modeCompare', { modes: ['minor', 'dorian'] }]])]),
      U('Making music', 'Groove part.', [S('groove', 'Write a 1-bar groove', 'improv', 'Single notes and chords.', [['callResponse', { chords: '$prog', scale: 'minorPent' }]])])
    ] },
    'Chicken Scratch Grooves': { key: 'A', minor: true, prog: 'funk9', units: [
      U('Scratch', 'Muted strokes.', [S('scratch', 'A9 scratch groove', 'rhythm', '16th funk.', [['funkScratch', { chord: 'A9' }], ['funkScratch', { chord: 'D9' }]])]),
      U('Single-note lines', 'Muted pentatonic riffs.', [S('lines', 'A minor pentatonic in 16ths', 'picking', 'Muted, percussive lines.', [['scaleRun', { scale: 'minorPent', unit: '16ths' }], ['speedBurst']])]),
      U('Double-stops', 'Sweet fills.', [S('ds', '3rds and 6ths', 'fretting', 'R&B fills.', [['doubleStops', { interval: '6ths' }]])]),
      U('Harmony', 'Dominant 9ths.', [S('ninths', '9th chord voicings', 'theory', 'Where the 9 lives.', [['chordChanges', { chords: '$funk9', beats: 4 }]])]),
      U('Making music', 'Lock in.', [S('lock', 'Groove over the vamp', 'improv', 'Chords and lines together.', [['gapClick', { chords: '$funk9' }]])])
    ] },
    'Disco Rhythm': { key: 'A', minor: true, prog: 'dorianVamp', units: [
      U('Disco 16ths', 'Relentless.', [S('disco', '16th chops on m7 chords', 'rhythm', 'Endurance and feel.', [['funkScratch', { chord: 'Am7' }], ['funkScratch', { chord: 'D9' }]])]),
      U('Voicings', 'Top-string grips.', [S('voicings', 'Drop-2 voicings', 'fretting', 'Small, bright chords.', [['drop2Comp', { chords: '$iiVI' }]])]),
      U('Time', 'Steady for minutes.', [S('time', 'Gap click', 'rhythm', 'Internal clock.', [['gapClick', { chords: '$prog' }]])]),
      U('Harmony', '7th chords of the key.', [S('sevenths', 'Diatonic 7th chords', 'theory', 'm7, maj7, 7.', [['diatonicCycle', { sevenths: true }]])]),
      U('Making music', 'Disco part.', [S('part', 'A full disco guitar part', 'repertoire', 'Chops plus fills.', [['doubleStops', { interval: '3rds' }]])])
    ] }
  },
  neosoul: {
    default: { key: 'D', minor: false, prog: 'neo' },
    'Neo-Soul Chord Melody': { key: 'D', minor: false, prog: 'neo', units: [
      U('Voicings', 'Maj7 and m7 grips.', [S('drop2', 'Drop-2 voicings through the changes', 'fretting', 'Smooth voice leading.', [['drop2Comp', { chords: '$prog' }], ['drop2Comp', { chords: '$prog', set: [2, 3, 4, 5] }]])]),
      U('Embellishments', 'Hammer-ons inside chords.', [S('emb', 'Hammer-on embellishments', 'fretting', 'Chords that sing.', [['embellish', { chords: '$prog' }]])]),
      U('Chord melody', 'Melody on top.', [S('cm', 'Harmonized scale', 'theory', 'Melody on the top string.', [['chordMelody']])]),
      U('Harmony', '7th chords of the key.', [S('sev', 'Diatonic 7ths', 'theory', 'Imaj7 to viiø7.', [['diatonicCycle', { sevenths: true }]]), S('ear', 'Hear maj7 vs m7', 'ear', 'Chord quality by ear.', [['earKey', { chords: '$prog' }]])]),
      U('Making music', 'Comp and fill.', [S('comp', 'Comp with fills', 'improv', 'Leave space for the melody.', [['guideTones', { chords: '$prog' }]])])
    ] },
    'Hammer-On Embellishments': { key: 'E', minor: true, prog: 'neo', units: [
      U('Hammer-ons', 'Strength and evenness.', [S('legato', 'Legato within shapes', 'fretting', 'Even hammer-ons.', [['legatoRun', { scale: 'dorian' }]])]),
      U('Embellished chords', 'Decorate the voicing.', [S('emb', 'Hammer-on embellishments', 'fretting', 'Neo-soul movement.', [['embellish', { chords: '$prog' }]])]),
      U('Double-stops', 'Thirds.', [S('ds', 'Diatonic 3rds', 'fretting', 'Sweet two-note fills.', [['doubleStops', { interval: '3rds' }]])]),
      U('Harmony', 'Dorian minor.', [S('dorian', 'Dorian vs natural minor', 'theory', 'The bright 6th.', [['modeCompare', { modes: ['minor', 'dorian'] }]])]),
      U('Making music', 'Fills over a loop.', [S('fills', 'Fill between phrases', 'improv', 'Call and response.', [['callResponse', { chords: '$prog', scale: 'dorian' }]])])
    ] },
    'R&B Double-Stops': { key: 'A', minor: false, prog: 'neo', units: [
      U('Sixths', 'The R&B sound.', [S('sixths', 'Diatonic 6ths', 'fretting', 'Strings 3 and 1.', [['doubleStops', { interval: '6ths' }]])]),
      U('Thirds', 'Sweet fills.', [S('thirds', 'Diatonic 3rds', 'fretting', 'Strings 3 and 2.', [['doubleStops', { interval: '3rds' }]])]),
      U('Chords', 'Maj7 and m7 grips.', [S('grips', 'Drop-2 voicings', 'fretting', 'Smooth changes.', [['drop2Comp', { chords: '$prog' }]])]),
      U('Harmony', 'Guide tones.', [S('guide', '3rds and 7ths', 'theory', 'Follow the changes.', [['guideTones', { chords: '$prog' }]])]),
      U('Making music', 'Fill the gaps.', [S('fill', 'Double-stop fills over the loop', 'improv', 'Answer the vocal.', [['callResponse', { chords: '$prog', scale: 'majorPent' }]])])
    ] }
  },
  jazz: {
    default: { key: 'C', minor: false, prog: 'iiVI' },
    'Bebop Line Building': { key: 'F', minor: false, prog: 'iiVI', units: [
      U('Scales', 'The major scale everywhere.', [S('major', 'F major, 3 notes per string', 'fretboard', 'Positions for lines.', [['scaleRun', { scale: 'major', nps: 3, unit: '8ths' }], ['scaleRun', { scale: 'major', nps: 3, pattern: 'thirds' }]])]),
      U('Arpeggios', 'Chord tones.', [S('sev', 'Diatonic 7th chords', 'theory', 'Arpeggiate every chord of the key.', [['diatonicCycle', { sevenths: true }]])]),
      U('Guide tones', 'The skeleton of a line.', [S('guide', 'Guide-tone lines over ii–V–I', 'improv', '3rds and 7ths.', [['guideTones', { chords: '$prog' }], ['guideTones', { chords: '$iiVIminor' }]])]),
      U('Modes', 'Dorian and mixolydian.', [S('modes', 'ii = Dorian, V = Mixolydian', 'theory', 'Same notes, different home.', [['modeCompare', { modes: ['dorian', 'mixolydian'] }]]), S('ear', 'Hear ii–V–I', 'ear', 'The sound of resolution.', [['earKey', { chords: '$prog' }]])]),
      U('Making music', 'Lines over changes.', [S('lines', 'Target chord tones on beat 1', 'improv', 'Bebop phrasing.', [['targetSolo', { chords: '$prog', scale: 'major' }]])])
    ] },
    'Jazz Comping': { key: 'C', minor: false, prog: 'iiVI', units: [
      U('Shells', 'Root, 3rd, 7th.', [S('shells', 'Shell voicings over ii–V–I', 'theory', 'The first jazz grips.', [['shellComp', { chords: '$prog' }], ['shellComp', { chords: '$iiVIminor' }]])]),
      U('Drop 2', 'Four-note voicings.', [S('drop2', 'Drop-2 on strings 1–4 and 2–5', 'fretting', 'Voice-led comping.', [['drop2Comp', { chords: '$prog' }], ['drop2Comp', { chords: '$prog', set: [2, 3, 4, 5] }]])]),
      U('Rhythm', 'Charleston and space.', [S('rhythm', 'Comping rhythms', 'rhythm', 'Swing feel.', [['subdivisionLadder', { feel: 'swing' }], ['gapClick', { chords: '$prog' }]])]),
      U('Harmony', 'Diatonic 7ths.', [S('sev', '7th chords of the key', 'theory', 'Imaj7 to viiø7.', [['diatonicCycle', { sevenths: true }]])]),
      U('Making music', 'Comp a tune.', [S('tune', 'Comp the changes with a guide-tone top', 'improv', 'Melodic comping.', [['guideTones', { chords: '$prog' }]])])
    ] },
    'Chord-Melody Basics': { key: 'C', minor: false, prog: 'iiVI', units: [
      U('Voicings', 'Melody on top.', [S('voicings', 'Drop-2 voicings', 'fretting', 'Top note = melody.', [['drop2Comp', { chords: '$prog' }]])]),
      U('Harmonized scale', 'First arrangement.', [S('cm', 'Harmonize the major scale', 'theory', 'Triads under each melody note.', [['chordMelody']])]),
      U('Shells', 'Bass and harmony.', [S('shells', 'Shells under a melody', 'theory', 'Two layers.', [['shellComp', { chords: '$prog' }]])]),
      U('Harmony', 'Keys and numbers.', [S('sev', 'Diatonic 7ths', 'theory', 'Chords of C major.', [['diatonicCycle', { sevenths: true }]])]),
      U('Making music', 'Arrange.', [S('arr', 'Arrange 4 bars', 'repertoire', 'Melody, chords, bass.', [['triadProgression', { chords: '$axis' }]])])
    ] }
  },
  country: {
    default: { key: 'G', minor: false, prog: 'country' },
    'Chicken Pickin\'': { key: 'A', minor: false, prog: 'country', units: [
      U('Hybrid picking', 'Pick and fingers.', [S('hybrid', 'Pick-and-finger 6ths', 'picking', 'The country double-stop.', [['doubleStops', { interval: '6ths' }]])]),
      U('Major pentatonic', 'Country scale.', [S('pent', 'A major pentatonic', 'fretboard', 'Licks live here.', [['scaleRun', { scale: 'majorPent' }], ['scaleRun', { scale: 'majorBlues', pattern: 'threes' }]])]),
      U('Bends', 'Pedal-steel style.', [S('bends', 'Bends to pitch', 'fretting', 'In-tune B-string bends.', [['bendLick'], ['vibratoHolds']])]),
      U('Speed', 'Snappy runs.', [S('speed', 'Bursts', 'picking', 'Fast, clean.', [['speedBurst', { scale: 'majorPent' }]])]),
      U('Making music', 'Country solo.', [S('solo', 'Solo over I–IV–V', 'improv', 'Major pentatonic and double-stops.', [['targetSolo', { chords: '$prog', scale: 'majorPent' }]])])
    ] },
    'Hybrid Picking Twang': { key: 'G', minor: false, prog: 'country', units: [
      U('Hybrid basics', 'Pick + middle finger.', [S('hybrid', 'Double-stop 6ths', 'picking', 'Pick the low note, pluck the high.', [['doubleStops', { interval: '6ths' }]])]),
      U('Rolls', 'Banjo-like patterns.', [S('rolls', 'Travis rolls', 'picking', 'Bass and treble.', [['travisPattern', { chords: '$prog' }]])]),
      U('Scale', 'Major pentatonic.', [S('pent', 'G major pentatonic', 'fretboard', 'Twangy licks.', [['scaleRun', { scale: 'majorPent' }]])]),
      U('Harmony', 'I–IV–V.', [S('key', 'Chords of G', 'theory', 'Country numbers.', [['diatonicCycle']])]),
      U('Making music', 'Twang solo.', [S('solo', 'Solo with double-stops', 'improv', 'Over I–IV–V.', [['callResponse', { chords: '$prog', scale: 'majorPent' }]])])
    ] },
    'Boom-Chicka Rhythm': { key: 'G', minor: false, prog: 'country', units: [
      U('Boom-chicka', 'Bass and strum.', [S('boom', 'Bass–strum pattern', 'rhythm', 'Alternating bass.', [['boomChicka', { chords: '$prog' }]])]),
      U('Changes', 'Open chords.', [S('changes', 'G–C–D changes', 'fretting', 'Clean on the beat.', [['chordChanges', { chords: '$prog', beats: 2 }]])]),
      U('Strumming', 'Country patterns.', [S('strum', 'Country strum', 'rhythm', 'Bass-strum-bass-strum.', [['strumPattern', { chords: '$prog', pattern: 'country' }]])]),
      U('Harmony', 'Keys.', [S('key', 'Chords of G', 'theory', 'I, IV, V.', [['diatonicCycle']]), S('ear', 'Hear the changes', 'ear', 'I–IV–V by ear.', [['earKey', { chords: '$prog' }]])]),
      U('Making music', 'Accompany.', [S('song', 'Two-step accompaniment', 'repertoire', 'Bass walks between chords.', [['boomChicka', { chords: '$folk145' }]])])
    ] }
  },
  folk: {
    default: { key: 'G', minor: false, prog: 'folk145' },
    'Travis Picking': { key: 'C', minor: false, prog: 'folkAxis', units: [
      U('Thumb', 'Alternating bass.', [S('thumb', 'Travis pattern on C–Am–F–G', 'picking', 'Steady thumb.', [['travisPattern', { chords: '$folkAxis' }]])]),
      U('More chords', 'Same pattern, new shapes.', [S('more', 'Travis on G–Em–C–D', 'picking', 'Bass strings change.', [['travisPattern', { chords: '$capo' }]])]),
      U('Changes', 'Open chords.', [S('changes', 'Chord changes', 'fretting', 'Smooth, in time.', [['chordChanges', { chords: '$folkAxis', beats: 2 }]])]),
      U('Harmony', 'Keys.', [S('key', 'Chords of C major', 'theory', 'Numbers.', [['diatonicCycle']])]),
      U('Making music', 'Accompany.', [S('song', 'Picking a song', 'repertoire', 'Verse and chorus.', [['travisPattern', { chords: '$folk145' }]])])
    ] },
    'Bluegrass Flatpicking': { key: 'G', minor: false, prog: 'folk145', units: [
      U('Flatpicking', 'Alternate picking in open position.', [S('scale', 'G major in open position', 'picking', 'Strict alternate.', [['scaleRun', { scale: 'major', box: 1, nps: 2, unit: '8ths' }], ['speedBurst', { scale: 'majorPent' }]])]),
      U('Rhythm', 'Boom-chick.', [S('rhythm', 'Bluegrass rhythm', 'rhythm', 'Bass and chop.', [['boomChicka', { chords: '$prog' }], ['strumPattern', { chords: '$prog', pattern: 'folk' }]])]),
      U('Crosspicking', 'Across strings.', [S('cross', 'String crossing', 'picking', 'Clean across strings.', [['stringSkip', { scale: 'major' }]])]),
      U('Harmony', 'I–IV–V.', [S('key', 'Chords of G', 'theory', 'Numbers.', [['diatonicCycle']])]),
      U('Making music', 'Breaks.', [S('break', 'Take a break', 'improv', 'Major pentatonic break.', [['targetSolo', { chords: '$prog', scale: 'majorPent' }]])])
    ] },
    'Open-String Folk': { key: 'D', minor: false, prog: 'sus', units: [
      U('Ringing chords', 'Sus and add9.', [S('sus', 'Dsus2–D–Dsus4', 'fretting', 'Open strings ring.', [['chordChanges', { chords: '$sus', beats: 2 }]])]),
      U('Drones', 'Shapes over open strings.', [S('drone', 'Moving shapes', 'picking', 'Chime.', [['openDrone', { chords: '$axis' }]])]),
      U('Strumming', 'Folk pattern.', [S('strum', 'Folk strum', 'rhythm', 'D–D–DUDU.', [['strumPattern', { chords: '$sus', pattern: 'folk' }]])]),
      U('Harmony', 'Modal folk.', [S('modal', 'D mixolydian', 'theory', 'The ♭7.', [['modeCompare', { modes: ['major', 'mixolydian'] }]])]),
      U('Making music', 'Song.', [S('song', 'Accompany with drones', 'repertoire', 'Ringing arrangement.', [['travisPattern', { chords: '$folk145' }]])])
    ] }
  },
  fingerstyle: {
    default: { key: 'A', minor: true, prog: 'classical' },
    'Independent Thumb': { key: 'E', minor: true, prog: 'folkAxis', units: [
      U('Thumb', 'Steady bass.', [S('thumb', 'Travis pattern', 'picking', 'Thumb never stops.', [['travisPattern', { chords: '$folkAxis' }]])]),
      U('Thumb + melody', 'Two voices.', [S('melody', 'Bass with percussive slap', 'picking', 'Groove underneath.', [['percussiveGroove']])]),
      U('Arpeggios', 'p-i-m-a.', [S('pima', 'Classical arpeggios', 'picking', 'Even fingers.', [['pimaArpeggio', { chords: '$classical' }]])]),
      U('Harmony', 'Keys.', [S('key', 'Chords of the key', 'theory', 'Numbers.', [['diatonicCycle']])]),
      U('Making music', 'Arrange.', [S('arr', 'Arrange a progression', 'repertoire', 'Bass, chords, melody.', [['chordMelody']])])
    ] },
    'Percussive Fingerstyle': { key: 'E', minor: true, prog: 'classical', units: [
      U('Groove', 'Thumb and slap.', [S('groove', 'Bass and percussive hits', 'picking', 'The guitar as a drum kit.', [['percussiveGroove']])]),
      U('Patterns', 'Travis variations.', [S('travis', 'Travis pattern', 'picking', 'Independence.', [['travisPattern', { chords: '$folkAxis' }]])]),
      U('Arpeggios', 'Flowing texture.', [S('arp', 'Arpeggiated triads', 'picking', 'Ringing notes.', [['triadProgression', { chords: '$classical', arpeggio: true }]])]),
      U('Harmony', 'Keys.', [S('key', 'Chords of E minor', 'theory', 'Numbers.', [['diatonicCycle']])]),
      U('Making music', 'Arrange.', [S('arr', 'Groove arrangement', 'repertoire', 'Slap, bass, melody.', [['percussiveGroove']])])
    ] },
    'Classical Technique': { key: 'A', minor: true, prog: 'classical', units: [
      U('Right hand', 'p-i-m-a.', [S('pima', 'Arpeggio studies', 'picking', 'Even, planted fingers.', [['pimaArpeggio', { chords: '$classical' }]])]),
      U('Scales', 'Rest strokes.', [S('scale', 'A minor in position', 'fretboard', 'i-m alternation.', [['scaleRun', { scale: 'harmonicMinor', nps: 3, unit: '8ths' }]])]),
      U('Melody and bass', 'Two voices.', [S('cm', 'Harmonized melody', 'theory', 'Melody on top.', [['chordMelody']])]),
      U('Harmony', 'Minor keys.', [S('key', 'Chords of A minor', 'theory', 'And the major V.', [['diatonicCycle']])]),
      U('Making music', 'A study.', [S('study', 'Arpeggio study through i–iv–V', 'repertoire', 'Dynamics and tone.', [['pimaArpeggio', { chords: '$classical' }]])])
    ] }
  },
  prog: {
    default: { key: 'E', minor: true, prog: 'progMinor' },
    'Odd-Meter Mastery': { key: 'E', minor: true, prog: 'progMinor', units: [
      U('7/8', 'Groups of 2 and 3.', [S('seven', '7/8 riff (2+2+3)', 'rhythm', 'Count and accent.', [['oddMeterRiff', { meter: 7 }]])]),
      U('5/4', 'Five-beat cycles.', [S('five', '5/8 riff (3+2)', 'rhythm', 'Asymmetric groove.', [['oddMeterRiff', { meter: 5 }]])]),
      U('Subdivision', 'Inner clock.', [S('subdiv', 'Subdivision ladder', 'rhythm', 'Switch on demand.', [['subdivisionLadder'], ['gapClick', { chords: '$prog' }]])]),
      U('Harmony', 'Prog minor.', [S('key', 'Chords of E minor', 'theory', 'i–♭VI–♭III–♭VII.', [['diatonicCycle']])]),
      U('Making music', 'Odd-time lead.', [S('lead', 'Phrase over 7/8', 'improv', 'Phrases that cross the bar.', [['callResponse', { chords: '$prog', scale: 'minor' }]])])
    ] },
    'Tapping & Legato Lab': { key: 'A', minor: true, prog: 'progMinor', units: [
      U('Legato', '3nps flow.', [S('legato', 'Legato runs', 'fretting', 'Pick once per string.', [['legatoRun', { scale: 'minor' }]])]),
      U('Tapping', 'Three-finger lines.', [S('tap', 'Tapping triplets', 'fretting', 'Tap–pull–hammer.', [['tapLick']])]),
      U('Arpeggios', 'Sweeps.', [S('sweep', 'Sweep arpeggios', 'picking', 'Economy motion.', [['sweepArp']]), S('skip', 'String skipping', 'picking', 'Wide intervals.', [['stringSkip']])]),
      U('Harmony', 'Modes.', [S('modes', 'Aeolian vs Dorian', 'theory', 'Mode colors.', [['modeCompare', { modes: ['minor', 'dorian'] }]])]),
      U('Making music', 'Fluid solo.', [S('solo', 'Legato solo', 'improv', 'Over the prog loop.', [['targetSolo', { chords: '$prog', scale: 'minor' }]])])
    ] },
    'Technical Prog': { key: 'D', minor: true, prog: 'progMinor', units: [
      U('Precision', 'Odd meters and chugs.', [S('odd', '7/8 chug riff', 'rhythm', 'Accents in odd time.', [['oddMeterRiff', { meter: 7 }], ['chugRiff', { rhythm: '16ths' }]])]),
      U('Speed', '3nps runs.', [S('speed', '3nps runs in 16ths', 'picking', 'Clean and fast.', [['scaleRun', { scale: 'minor', nps: 3, unit: '16ths', pattern: 'threes' }], ['speedBurst']])]),
      U('Voicings', 'Extended chords.', [S('voicings', 'Drop-2 prog voicings', 'fretting', 'Rich harmony.', [['drop2Comp', { chords: '$royal' }]])]),
      U('Harmony', 'Modal interchange.', [S('modes', 'Minor vs harmonic minor', 'theory', 'Color notes.', [['modeCompare', { modes: ['minor', 'harmonicMinor'] }]])]),
      U('Making music', 'Composition.', [S('comp', 'Write an odd-time section', 'improv', 'Riff + lead.', [['callResponse', { chords: '$prog', scale: 'minor' }]])])
    ] }
  },
  jrock: {
    default: { key: 'A', minor: true, prog: 'royal' },
    'Anime Opening Shred': { key: 'E', minor: true, prog: 'progMinor', units: [
      U('Speed', 'Fast melodic runs.', [S('speed', 'Bursts and 3nps runs', 'picking', 'Clean at tempo.', [['speedBurst'], ['scaleRun', { scale: 'minor', nps: 3, unit: '16ths' }]])]),
      U('Power', 'Fast power chords.', [S('power', 'Driving power chords', 'rhythm', 'Opening energy.', [['powerRiff', { rhythm: 'drive', degrees: [0, 8, 3, 10] }]])]),
      U('Arpeggios', 'Sweeps.', [S('sweep', 'Sweep arpeggios', 'picking', 'Shred color.', [['sweepArp']])]),
      U('Harmony', 'Royal road.', [S('royal', 'IVmaj7–V7–iii7–vi', 'theory', 'The J-pop progression.', [['drop2Comp', { chords: '$royal' }]])]),
      U('Making music', 'Opening solo.', [S('solo', 'Melodic speed solo', 'improv', 'Fast runs landing on chord tones.', [['targetSolo', { chords: '$prog', scale: 'minor' }]])])
    ] },
    'J-Rock Melodic Lead': { key: 'A', minor: true, prog: 'royal', units: [
      U('Melodic scales', 'Minor and harmonic minor.', [S('scales', 'A minor & harmonic minor', 'fretboard', 'Singable lines.', [['scaleRun', { scale: 'minor', nps: 3 }], ['scaleRun', { scale: 'harmonicMinor', nps: 3 }]])]),
      U('Expression', 'Bends and legato.', [S('expr', 'Bends and legato', 'fretting', 'Vocal phrasing.', [['bendLick'], ['legatoRun', { scale: 'minor' }]])]),
      U('Harmony', 'Royal road.', [S('royal', 'Royal road progression', 'theory', 'Hear and play it.', [['drop2Comp', { chords: '$royal' }], ['guideTones', { chords: '$royal' }]])]),
      U('Ear', 'Melodies by ear.', [S('ear', 'Echo melodies', 'ear', 'Play what you sing.', [['echoPhrases', { chords: '$royal', scale: 'minor' }]])]),
      U('Making music', 'Melodic solo.', [S('solo', 'Solo over the royal road', 'improv', 'Target chord tones.', [['targetSolo', { chords: '$royal', scale: 'minor' }], ['callResponse', { chords: '$royal', scale: 'minor' }]])])
    ] },
    'City-Pop Chords': { key: 'D', minor: false, prog: 'royal', units: [
      U('Voicings', 'Maj7 and m7.', [S('voicings', 'Drop-2 royal road', 'fretting', 'Smooth city-pop grips.', [['drop2Comp', { chords: '$royal' }], ['drop2Comp', { chords: '$royal', set: [2, 3, 4, 5] }]])]),
      U('Rhythm', '16th funk feel.', [S('rhythm', '16th chops', 'rhythm', 'City-pop groove.', [['funkScratch', { chord: 'Em7' }]])]),
      U('Inversions', 'Triads on top.', [S('inv', 'Triad inversions', 'fretboard', 'Melodic top voices.', [['triadProgression', { chords: '$axis' }]])]),
      U('Harmony', '7th chords of the key.', [S('sev', 'Diatonic 7ths', 'theory', 'Imaj7, ii7, iii7…', [['diatonicCycle', { sevenths: true }]])]),
      U('Making music', 'Comp a song.', [S('comp', 'Comp with guide tones', 'improv', 'Melodic comping.', [['guideTones', { chords: '$royal' }]])])
    ] }
  },
  latin: {
    default: { key: 'A', minor: true, prog: 'andalusian' },
    'Rasgueado Rhythm': { key: 'A', minor: true, prog: 'andalusian', units: [
      U('Rasgueado', 'Four-finger flick.', [S('rasg', 'Rasgueado over Am–G–F–E', 'rhythm', 'The flamenco strum.', [['rasgueado', { chords: '$prog' }]])]),
      U('Rumba', 'Groove.', [S('rumba', 'Rumba strum', 'rhythm', 'Accents and mutes.', [['funkScratch', { chord: 'Am' }], ['strumPattern', { chords: '$prog', pattern: 'pop' }]])]),
      U('Changes', 'Andalusian cadence.', [S('changes', 'Am–G–F–E changes', 'fretting', 'Clean and fast.', [['chordChanges', { chords: '$prog', beats: 2 }]])]),
      U('Harmony', 'Phrygian.', [S('phry', 'E Phrygian dominant', 'theory', 'The Spanish scale.', [['scaleRun', { scale: 'phrygianDominant', nps: 3 }]])]),
      U('Making music', 'Accompany.', [S('song', 'Rumba accompaniment', 'repertoire', 'Strum and accents.', [['rasgueado', { chords: '$prog' }]])])
    ] },
    'Picado Speed': { key: 'E', minor: true, prog: 'andalusian', units: [
      U('Picado', 'i-m alternation.', [S('picado', 'Picado runs', 'picking', 'Fast, articulated.', [['picado']])]),
      U('Scales', 'Phrygian dominant.', [S('scale', 'E Phrygian dominant positions', 'fretboard', 'The flamenco scale.', [['scaleRun', { scale: 'phrygianDominant', nps: 3 }]])]),
      U('Speed', 'Bursts.', [S('burst', 'Speed bursts', 'picking', 'Short fast cells.', [['speedBurst', { scale: 'phrygianDominant' }]])]),
      U('Harmony', 'Andalusian cadence.', [S('cad', 'Am–G–F–E', 'theory', 'The flamenco cadence.', [['chordChanges', { chords: '$prog', beats: 2 }]])]),
      U('Making music', 'Falseta.', [S('falseta', 'Short falseta', 'improv', 'Phrase over the cadence.', [['callResponse', { chords: '$prog', scale: 'phrygianDominant' }]])])
    ] },
    'Latin Rock Lead': { key: 'A', minor: true, prog: 'latinRock', units: [
      U('Dorian lead', 'The latin-rock mode.', [S('dorian', 'A Dorian', 'fretboard', 'Over Am7–D9.', [['scaleRun', { scale: 'dorian', nps: 3 }], ['modeCompare', { modes: ['minor', 'dorian'] }]])]),
      U('Sustain', 'Long singing notes.', [S('sustain', 'Bends and vibrato', 'fretting', 'Singing lead.', [['bendLick'], ['vibratoHolds']])]),
      U('Groove', 'Am7–D9 vamp.', [S('groove', 'Vamp groove', 'rhythm', 'Latin feel.', [['funkScratch', { chord: 'Am7' }], ['chordChanges', { chords: '$prog', beats: 4 }]])]),
      U('Ear', 'Melodies.', [S('ear', 'Echo phrases', 'ear', 'Over the vamp.', [['echoPhrases', { chords: '$prog', scale: 'dorian' }]])]),
      U('Making music', 'Solo.', [S('solo', 'Solo over the vamp', 'improv', 'Dorian with space.', [['targetSolo', { chords: '$prog', scale: 'dorian' }], ['callResponse', { chords: '$prog', scale: 'dorian' }]])])
    ] }
  }
};

/* ---------------------------- Resolution ---------------------------- */
export function styleDef(genre, style) {
  const g = STYLES[genre] || STYLES.rock;
  const sd = g[style] || null;
  if (sd) return { ...g.default, ...sd, found: true };
  // unknown style name: pick the genre style whose name shares the most words, else the first
  const names = Object.keys(g).filter(k => k !== 'default');
  const words = String(style || '').toLowerCase().split(/\W+/);
  const best = names.map(n => ({ n, s: n.toLowerCase().split(/\W+/).filter(w => words.includes(w)).length })).sort((a, b) => b.s - a.s)[0];
  return { ...g.default, ...g[best && best.s ? best.n : names[0]], found: false };
}

export function styleContext(course) {
  const sd = styleDef(course.genre, course.style);
  const key = parseNote(sd.key) || { pc: 9 };
  return { key: key.pc, minor: !!sd.minor, lvl: Math.max(1, Math.min(10, course.difficulty || 4)), genre: course.genre, style: course.style, prog: sd.prog };
}

function resolve(opts, c) {
  const out = {};
  for (const [k, v] of Object.entries(opts || {})) {
    if (typeof v === 'string' && v.startsWith('$')) out[k] = progressionNames(c.key, v === '$prog' ? c.prog : v.slice(1));
    else out[k] = v;
  }
  return out;
}

export function runAtom(c, name, opts = {}) {
  const fn = ATOMS[name]; if (!fn) return null;
  try {
    const ex = fn(c, resolve(opts, c)) || null;
    // remember how it was made, so variations can re-run it with other settings
    if (ex) ex.gen = { atom: name, opts: JSON.parse(JSON.stringify(opts || {})), c: { key: c.key, minor: !!c.minor, lvl: c.lvl, genre: c.genre || null, prog: c.prog || null } };
    return ex;
  } catch (e) { if (typeof console !== 'undefined') console.warn('atom failed', name, e && e.message); return null; }
}

/** The raw tree (before normalizing) for a course: units → skills → exercises, all in the style. */
export function styleTreeRaw(course) {
  const c = styleContext(course), sd = styleDef(course.genre, course.style);
  const gname = GENRE_BY_ID[course.genre] ? GENRE_BY_ID[course.genre].name : course.genre;
  const units = (sd.units || STYLES.rock['Arena Lead'].units).map((u, ui) => ({
    title: u.title, summary: u.summary,
    skills: u.skills.map((s, si) => ({
      id: s.id, title: s.title, domain: s.domain, summary: s.summary,
      prereqs: ui === 0 ? [] : [],
      exercises: s.ex.map(([a, o]) => {
        // later units step the difficulty up a little
        const cc = { ...c, lvl: Math.min(10, c.lvl + (ui >= 3 ? 1 : 0)) };
        const ex = runAtom(cc, a, o);
        if (ex && ex.domain !== s.domain && ['theory', 'ear', 'improv', 'repertoire'].includes(s.domain)) ex.domain = s.domain;
        return ex;
      }).filter(Boolean)
    })).filter(s => s.exercises.length)
  })).filter(u => u.skills.length);
  // Skills with a single exercise get a complementary one, so each skill has a drill and an application
  const COMPLEMENT = { rhythm: ['gapClick', { chords: '$prog' }], picking: ['speedBurst'], fretting: ['vibratoHolds'], fretboard: ['noteFinder'], theory: ['intervalShapes'], ear: ['echoPhrases', { chords: '$prog' }], improv: ['targetSolo', { chords: '$prog' }], repertoire: ['gapClick', { chords: '$prog' }] };
  const used = new Set(units.flatMap(u => u.skills.flatMap(s => s.exercises.map(e => e.id))));
  units.forEach(u => u.skills.forEach(s => {
    if (s.exercises.length > 1) return;
    const [a, o] = COMPLEMENT[s.domain] || COMPLEMENT.fretboard;
    const ex = runAtom(c, a, o);
    if (ex && !used.has(ex.id)) { used.add(ex.id); s.exercises.push(ex); }
  }));
  const keyNm = ROOT_BY_PC[c.key] ? ROOT_BY_PC[c.key].name : '';
  return {
    summary: `${course.style} in ${keyNm}${c.minor ? ' minor' : ''}: ${units.map(u => u.title.toLowerCase()).join(', ')}, built around the ${gname.toLowerCase()} vocabulary at your level.`,
    units, style: course.style, key: keyNm
  };
}

/* ------------------------------- Pools ------------------------------- */
// Daily-routine pools per style: warm-ups, review, theory and music items that rotate day to day.
const POOL_ATOMS = {
  warmup: { rhythm: [['subdivisionLadder'], ['gapClick', { chords: '$prog' }]], picking: [['speedBurst'], ['stringSkip']], fretting: [['vibratoHolds'], ['legatoRun']], default: [['speedBurst'], ['subdivisionLadder']] },
  theory: [['diatonicCycle'], ['intervalShapes'], ['noteFinder'], ['modeCompare']],
  ear: [['earKey', { chords: '$prog' }], ['echoPhrases', { chords: '$prog' }], ['intervalShapes']],
  music: [['callResponse', { chords: '$prog' }], ['targetSolo', { chords: '$prog' }], ['gapClick', { chords: '$prog' }]]
};
const poolCache = new Map();
export function stylePools(course) {
  const k = `${course.genre}|${course.style}|${course.difficulty}`;
  if (poolCache.has(k)) return poolCache.get(k);
  const c = styleContext(course), sd = styleDef(course.genre, course.style);
  const fromUnits = dom => (sd.units || []).flatMap(u => u.skills.filter(s => dom.includes(s.domain)).flatMap(s => s.ex));
  const run = list => list.map(([a, o]) => runAtom(c, a, o)).filter(Boolean);
  const techAtoms = fromUnits(['picking', 'fretting', 'rhythm']);
  // Style items first; generic ones only top a pool up to three choices
  const topUp = (own, generic) => { const a = run(own); if (a.length >= 3) return a; return [...a, ...run(generic)].slice(0, Math.max(3, a.length)); };
  const pools = {
    warmup: topUp(techAtoms.slice(0, 5), POOL_ATOMS.warmup.default).map(e => ({ ...e, minutes: Math.min(e.minutes, 4) })),
    review: topUp(fromUnits(['fretboard']), [['noteFinder'], ['intervalShapes']]),
    theory: topUp(fromUnits(['theory', 'ear']), POOL_ATOMS.theory),
    music: topUp(fromUnits(['improv', 'repertoire']), POOL_ATOMS.music)
  };
  // de-duplicate by id within each pool
  for (const kk of Object.keys(pools)) { const seen = new Set(); pools[kk] = pools[kk].filter(e => (seen.has(e.id) ? false : seen.add(e.id))); }
  poolCache.set(k, pools);
  return pools;
}

/** Pick an item from a pool for a date, rotating day to day and avoiding ids already used. */
export function rotate(pool, seedStr, used = new Set()) {
  if (!pool || !pool.length) return null;
  const start = hash(seedStr) % pool.length;
  for (let i = 0; i < pool.length; i++) { const e = pool[(start + i) % pool.length]; if (!used.has(e.id)) return e; }
  return null;
}

export const STYLE_NAMES = Object.fromEntries(Object.entries(STYLES).map(([g, v]) => [g, Object.keys(v).filter(k => k !== 'default')]));
