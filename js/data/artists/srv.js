// Artist Series: Stevie Ray Vaughan. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID, PU } from '../lib.js';
import pentatonic from '../kb/pentatonic.js';
import bending from '../kb/bending.js';
import vibrato from '../kb/vibrato.js';


const ARTIST_NOTE = 'Use the Songs tab to learn the real thing: add the song, paste or import a tab, and the app turns it into section lessons.';
export default artist({ id: 'srv', name: 'Stevie Ray Vaughan', wiki: ['Stevie Ray Vaughan'], genre: 'blues', re: /stevie ray|\bsrv\b|vaughan/,
    blurb: 'Texas shuffle, huge bends with a wide vibrato, raking and double-stop fills.',
    techniques: ['Texas shuffle', { name: 'Wide bends and vibrato', path: 'bending' }, 'Double-stops', 'Raking'],
    ctx: { key: 4, minor: true, prog: 'blues' },
    units: [
      U('The shuffle', 'The Texas shuffle groove.', [S('srv-shuffle', 'Texas shuffle', 'rhythm', 'Swung 8ths with bass and chord stabs.', [['shuffleRiff'], ['strumPattern', { chords: '$blues', pattern: 'rock8', swing: true }]])]),
      PU(pentatonic, { title: 'The pentatonic box', summary: 'Box 1 and its neighbours, by ear and from memory: the shapes his licks live in.', tiers: ['foundations', 'intermediate'] }),
      PU(bending, { title: 'Big bends in tune', summary: 'Whole-step and wider bends with every finger behind them, pre-bends, unison and double-stop bends.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      PU(vibrato, { title: 'A wide vibrato', summary: 'Wide, wrist-driven vibrato locked to the shuffle, on bends and on double-stops.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      U('Raking', 'A muted rake into the target note.', [S('srv-rake', 'Raking into notes', 'picking', 'A muted rake into the target.', [W('srv-rake', 'Rakes into bends', 'picking', 'one per beat', 50, 90,
          'Raking the pick across muted strings before the target note gives his attack its percussive bite.', 'Mute the strings below the target with the fretting hand, drag the pick through them in one motion, land on the bent note on the beat.', 'The muted strings sounding pitches.', 'Rake into an unbent note.')])]),
      U('Double-stops', 'Two-note fills between vocal lines.', [S('srv-ds', 'Double-stop fills', 'fretting', 'Rhythmic double-stops on the top strings.', [['doubleStopRnR'], ['doubleStops', { interval: '3rds' }]])]),
      U('Putting it together', 'Phrasing over a shuffle and a slow blues.', [S('srv-solo', 'Blues phrasing', 'improv', 'Call and response, chord targets.', [['callResponse', { chords: '$blues' }], ['targetSolo', { chords: '$slowBlues' }]])])
    ],
    riffs: [{ title: 'Pride and Joy', note: 'The Texas shuffle.' }, { title: 'Texas Flood', note: 'Slow blues phrasing.' }, { title: 'Lenny', note: 'Clean chord melody.' },
      { title: 'Scuttle Buttin\'', note: 'Fast pentatonic shuffle instrumental.' }, { title: 'Couldn\'t Stand the Weather', note: 'Funky riff and rhythm part.' }] });
