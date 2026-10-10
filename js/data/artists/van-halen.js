// Artist Series: Eddie Van Halen. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';
import openPulls from '../kb/openPulls.js';
import tapping, { evhTapTriplets } from '../kb/tapping.js';

const ARTIST_NOTE = 'Use the Songs tab to learn the real thing: add the song, paste or import a tab, and the app turns it into section lessons.';
export default artist({ id: 'van-halen', name: 'Eddie Van Halen', wiki: ['Eddie Van Halen'], genre: 'rock', re: /van halen|\bevh\b|eddie van|eruption/,
    blurb: 'Two-hand tapping, open-string legato, tight palm-muted riffs and fearless whammy work.',
    techniques: ['Two-hand tapping', 'Tapped pentatonic', 'Open-string pull-offs', 'Palm-muted riffs', 'Harmonics'],
    sources: ['https://www.nme.com/features/eddie-van-halen-obituary-tribute-2774589', 'https://www.scotsman.com/whats-on/arts-and-entertainment/eddie-van-halen-life-and-career-of-legendary-guitarist-who-has-died-aged-65-and-most-famous-songs-and-solos-from-jump-to-beat-it-2995439', 'https://guitarworld.com/lessons/6-guitar-tricks-you-can-learn-from-eddie-van-halen'],
    bio: `Eddie Van Halen (1955–2020) was born in Amsterdam and moved with his family to the United States in 1962. With his brother Alex on drums he founded Van Halen in 1972, and the band's 1978 debut album, with the short instrumental "Eruption", changed rock guitar almost overnight. He also played the guitar solo on Michael Jackson's "Beat It", and "Jump", from the album 1984, became the band's only number-one single. He died of cancer in October 2020.

He popularised two-hand tapping: a picking-hand finger taps notes on the fretboard for fast arpeggios with wide intervals. Around it he built open-string pull-offs, natural and tapped harmonics, whammy-bar dives and scoops, tremolo picking, and riffs that keep a palm-muted open string ringing under short chord shapes, all with a loose, playful sense of time.

This course teaches tapping, his open-string legato lines and his riffs. Paths for palm-muted riffs and harmonics are being built so the page can draw on them, and a closing unit puts taps, legato and speed into a solo.`,
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
