// Artist Series: Paul Gilbert. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';
import pent6s from '../kb/pent6s.js';
import pgSix from '../kb/pgSix.js';
import skipArps from '../kb/skipArps.js';
import stretchPent from '../kb/stretchPent.js';

const ARTIST_NOTE = 'Use the Songs tab to learn the real thing: add the song, paste or import a tab, and the app turns it into section lessons.';
export default artist({ id: 'paul-gilbert', name: 'Paul Gilbert', wiki: ['Paul Gilbert'], genre: 'rock', re: /paul gilbert|\bgilbert\b|racer x/,
    blurb: 'Machine-gun alternate picking, the six-note pentatonic lick, string skipping and wide stretches.',
    techniques: ['Strict alternate picking', 'Six-note pentatonic lick', 'String-skipped arpeggios', 'Pentatonic in sixes', 'Wide stretches'],
    ctx: { key: 9, minor: true, prog: 'minorRock' },
    units: [
      U('Picking foundations', 'Small motions, every note picked.', [
        S('pg-chrom', 'Chromatic alternate picking', 'picking', 'Four fingers, four frets, every note picked.', [{ spec: { libId: 'spider-1234', id: 'spider-1234', name: 'Chromatic picking climb', domain: 'picking', minutes: 5, instr: 'Strict alternate picking, starting with a downstroke, then again starting with an upstroke. One finger per fret.', watch: 'Picking from the elbow: keep the motion small.', simplify: 'Two strings only.', startBpm: 60, goalBpm: 120 } }])]),
      U('The six-note lick', 'His signature two-string picking cell.', skillsOf(pgSix)),
      U('Sequences', 'Pentatonic in sixes and on stretched shapes.', [...skillsOf(pent6s), ...skillsOf(stretchPent)]),
      U('String skipping', 'Wide-interval arpeggios without sweeping.', [...skillsOf(skipArps), S('pg-skip-scale', 'Skipping through the scale', 'picking', 'Strings 4 and 2 through the scale.', [['stringSkip']])]),
      U('Putting it together', 'Speed lines that still phrase.', [
        S('pg-sync', 'Hand sync at speed', 'picking', 'Bursts that stay clean.', [['speedBurst', { scale: 'minorPent' }], ['scaleRun', { scale: 'minor', nps: 3, unit: '16ths', pattern: 'fours' }]]),
        S('pg-solo', 'Picking licks in a solo', 'improv', 'Drop the six-note lick into phrases.', [['callResponse', { chords: '$minorRock' }]])])
    ],
    riffs: [
      { title: 'Technical Difficulties', artist: 'Racer X', note: 'Alternate-picking and arpeggio showcase.' },
      { title: 'Scarified', artist: 'Racer X', note: 'Fast picked lines and string skipping.' },
      { title: 'Daddy, Brother, Lover, Little Boy', artist: 'Mr. Big', note: 'Fast unison picking runs.' },
      { title: 'Green-Tinted Sixties Mind', artist: 'Mr. Big', note: 'Tapped arpeggio intro.' },
      { title: 'Addicted to That Rush', artist: 'Mr. Big', note: 'Fast picked riffing.' },
      { title: 'Get Out of My Yard', note: 'Instrumental full of his picking vocabulary.' }
    ] });
