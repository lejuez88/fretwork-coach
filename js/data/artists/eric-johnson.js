// Artist Series: Eric Johnson. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID, PU } from '../lib.js';
import pentatonic from '../kb/pentatonic.js';
import hexatonic from '../kb/hexatonic.js';
import rolling5s from '../kb/rolling5s.js';
import speedPent from '../kb/speedPent.js';
import spreadTriads, { ejSpreadProgression } from '../kb/spreadTriads.js';

const ARTIST_NOTE = 'Use the Songs tab to learn the real thing: add the song, paste or import a tab, and the app turns it into section lessons.';
export default artist({ id: 'eric-johnson', name: 'Eric Johnson', wiki: ['Eric Johnson (guitarist)'], genre: 'rock', re: /eric johnson|\bej\b/,
    blurb: 'Violin-like tone, cascading pentatonic runs, rolling 5s and wide spread-triad chords.',
    techniques: ['Speed pentatonics', 'Rolling 5s', 'Spread triads', 'Pentatonic plus the 9th', 'Position shifting'],
    ctx: { key: 9, minor: true, prog: 'minorRock' },
    units: [
      PU(pentatonic, { title: 'The pentatonic boxes', summary: 'All five boxes, sequences and keys: the ground his speed pentatonics run on.', tiers: ['intermediate', 'advanced', 'mastery'] }),
      U('Pentatonic sixes', 'The six-note cell that drives his fast runs, in one box.', [skillsOf(speedPent)[0]]),
      U('Rolling 5s', 'Groups of five against a 16th-note pulse.', skillsOf(rolling5s)),
      U('Across the neck', 'Speed pentatonics through all five boxes, and the added 9th.', [skillsOf(speedPent)[1], ...skillsOf(hexatonic)]),
      U('Spread triads', 'The wide, open chord sound of his clean playing.', skillsOf(spreadTriads)),
      U('Putting it together', 'Runs and chords in real music.', [
        S('ej-solo', 'Cascading runs in a solo', 'improv', 'Drop sixes and rolling 5s into phrases with space.', [['callResponse', { chords: '$minorRock', scale: 'minorPent' }], ['targetSolo', { chords: '$axis' }, { minor: false, key: 9 }]]),
        S('ej-clean', 'Spread-triad chord melody', 'theory', 'Clean chord parts with a melody on top.', [c => ejSpreadProgression(c, { key: 4, degrees: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']] })])])
    ],
    riffs: [
      { title: 'Cliffs of Dover', note: 'Fast pentatonic runs and wide intervals; his best-known instrumental.' },
      { title: 'Manhattan', note: 'Clean chordal playing with spread voicings.' },
      { title: 'Desert Rose', note: 'Clean arpeggiated chords and melodic lines.' },
      { title: 'Trademark', note: 'Pentatonic speed runs over a rock groove.' },
      { title: 'Zap', note: 'Instrumental full of fast pentatonic and position-shifting lines.' },
      { title: 'S.R.V.', note: 'Texas blues-rock tribute with pentatonic runs.' }
    ] });
