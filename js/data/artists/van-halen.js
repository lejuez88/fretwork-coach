// Artist Series: Eddie Van Halen. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';
import openPulls from '../kb/openPulls.js';
import tapping, { evhTapTriplets } from '../kb/tapping.js';

const ARTIST_NOTE = 'Use the Songs tab to learn the real thing: add the song, paste or import a tab, and the app turns it into section lessons.';
export default artist({ id: 'van-halen', name: 'Eddie Van Halen', wiki: ['Eddie Van Halen'], genre: 'rock', re: /van halen|\bevh\b|eddie van|eruption/,
    blurb: 'Two-hand tapping, open-string legato, tight palm-muted riffs and fearless whammy work.',
    techniques: ['Two-hand tapping', 'Tapped pentatonic', 'Open-string pull-offs', 'Palm-muted riffs', 'Harmonics'],
    ctx: { key: 4, minor: true, prog: 'minorRock' },
    units: [
      U('Tapping basics', 'Tap, pull off, hammer on: one string, one chord at a time.', [skillsOf(tapping)[0]]),
      U('Open-string legato', 'Fast, slurred lines against the open string.', skillsOf(openPulls)),
      U('Tapping and the pentatonic', 'Tapped octaves on the box you already know.', [skillsOf(tapping)[1]]),
      U('The riffs', 'Palm-muted power chords with a push.', [
        S('evh-riff', 'Palm-muted rock riffs', 'rhythm', 'Tight downstrokes and syncopated power chords.', [['powerRiff', { rhythm: 'drive' }], ['powerRiff', { rhythm: 'synco' }]]),
        S('evh-harm', 'Harmonics and pinch harmonics', 'picking', 'The squeals and chimes between riffs.', [W('evh-harmonics', 'Natural, tapped and pinch harmonics', 'picking', 'one per beat', 50, 90,
          'Harmonics are part of the Van Halen sound: natural ones at frets 12, 7 and 5, tapped ones 12 frets above a fretted note, and pinch harmonics that make a single note scream.',
          'One per click: natural harmonics at 12, 7 and 5 on strings 3–1; then hold a power chord and tap 12 frets above it (touch and release, don’t press); then pinch harmonics: let the thumb edge graze the string right after the pick.',
          'Pressing the tapped harmonic down to the fret.', 'Natural harmonics only.')])]),
      U('Putting it together', 'Taps, legato and speed in a solo.', [
        S('evh-speed', 'Speed bursts and tremolo', 'picking', 'Short, fast bursts between licks.', [['speedBurst'], ['scaleRun', { scale: 'blues', box: 1, unit: '16ths' }]]),
        S('evh-solo', 'Tapping in a solo', 'improv', 'Answer a phrase with a tapped lick.', [['callResponse', { chords: '$minorRock' }], c => evhTapTriplets(c, { chords: ['Em', 'C', 'D', 'B'] })])])
    ],
    riffs: [
      { title: 'Eruption', note: 'The tapping showcase.' }, { title: 'Ain\'t Talkin\' \'bout Love', note: 'Arpeggiated riff with a heavy groove.' },
      { title: 'Panama', note: 'Driving riff with open strings.' }, { title: 'Hot for Teacher', note: 'Fast shuffle riff and tapping.' },
      { title: 'Runnin\' with the Devil', note: 'Simple, heavy power-chord riff.' }, { title: 'Unchained', note: 'Drop-D riff with harmonics.' }
    ] });
