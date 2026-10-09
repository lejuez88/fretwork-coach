// Artist Series: Jimi Hendrix. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID, PU } from '../lib.js';
import pentatonic from '../kb/pentatonic.js';
import octaves from '../kb/octaves.js';
import sharp9 from '../kb/sharp9.js';

const ARTIST_NOTE = 'Use the Songs tab to learn the real thing: add the song, paste or import a tab, and the app turns it into section lessons.';
export default artist({ id: 'hendrix', name: 'Jimi Hendrix', wiki: ['Jimi Hendrix'], genre: 'classic-rock', re: /hendrix|\bjimi\b/,
    blurb: 'Chord embellishments, the 7♯9 chord, octaves, thumb-over grips and vocal bends.',
    techniques: ['Chord embellishments', 'The 7♯9 chord', 'Octaves', 'Bends and vibrato'],
    ctx: { key: 4, minor: true, prog: 'minorRock' },
    units: [
      U('Rhythm with melody', 'Chords decorated with hammer-ons and fills.', [S('hx-emb', 'Chord embellishments', 'fretting', 'Hammer-ons inside the chord shape.', [['embellish', { chords: ['E', 'A', 'D', 'A'] }], ['embellish', { chords: ['Em', 'G', 'Am', 'Em'] }]])]),
      U('The 7♯9', 'The Hendrix chord.', skillsOf(sharp9)),
      U('Octaves', 'Big, simple melodies.', skillsOf(octaves)),
      PU(pentatonic, { title: 'Pentatonic phrasing', summary: 'The boxes, bends and phrasing under his leads.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      U('Bends and vibrato', 'Vocal bends.', [S('hx-bend', 'Bends and vibrato', 'fretting', 'Bends to pitch, wide vibrato.', [['bendLick'], ['vibratoHolds']])]),
      U('Putting it together', 'Lead and rhythm as one part.', [S('hx-solo', 'Pentatonic phrasing', 'improv', 'Licks and fills over a vamp.', [['callResponse', { chords: '$minorRock' }], ['doubleStops', { interval: '3rds' }]])])
    ],
    riffs: [{ title: 'Little Wing', note: 'Chord embellishments.' }, { title: 'Purple Haze', note: 'The 7♯9 chord.' }, { title: 'Voodoo Child (Slight Return)', note: 'Wah riff and pentatonic lead.' },
      { title: 'Hey Joe', note: 'Bass-line riff and chord fills.' }, { title: 'The Wind Cries Mary', note: 'Chord embellishments.' }, { title: 'Foxy Lady', note: 'The 7♯9 and bends.' }] });
