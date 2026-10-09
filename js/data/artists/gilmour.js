// Artist Series: David Gilmour. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';


const ARTIST_NOTE = 'Use the Songs tab to learn the real thing: add the song, paste or import a tab, and the app turns it into section lessons.';
/** Pre-bends and releases in box 1: bend silently, pick, let the note fall to a scale tone. */
export function dgPrebends(c) {
  const key = minorKey(c), B = byString(pentBox(key, 1));
  if (!B[1] || !B[4] || B[1][1] + 3 > 22) return null;
  const notes = []; let t = 0;
  const pb = (s, f, up) => { notes.push(N(s, f, t, 1, 'b', { bendTo: f + up }), N(s, f, t + 1, 1)); t += 2; };
  // bar 1: G string 4th → 5th; bar 2: B string ♭7 → root; bar 3: e string ♭3 → 4th; bar 4: back down, resolve on the root
  pb(3, B[3][1], 2); notes.push(N(3, B[3][0], t, 2, '~')); t += 2;
  pb(2, B[2][1], 2); notes.push(N(2, B[2][0], t, 2, '~')); t += 2;
  pb(1, B[1][1], 2); notes.push(N(1, B[1][0], t, 2, '~')); t += 2;
  if ((c.lvl || 4) >= 6) { pb(2, B[2][0], 3); notes.push(N(2, B[2][0], t, 2, '~')); t += 2; } // 1½-step pre-bend: 5th up to ♭7
  pb(3, B[3][1], 2); notes.push(N(4, B[4][1], t, 2, '~'));
  return make(c, {
    id: 'dg-prebend', name: `Pre-bends and releases in ${nameOf(key)} minor, box 1 (Gilmour style)`, domain: 'fretting', unit: 'quarter notes', goal: 80, start: 50, minutes: 5,
    why: 'Bending silently, then picking and letting the note fall, makes a melody sigh down into place: a Gilmour signature. It only works if the silent bend is exactly in pitch.',
    instr: `The note marked b is bent BEFORE you pick it: push the string up to the target (whole step = two frets) without sound, pick, then release over one beat to the fretted note and move on. Bar 1: G string, the 4th up to the 5th. Bar 2: B string, ♭7 up to the root. Bar 3: high e, ♭3 up to the 4th.${(c.lvl || 4) >= 6 ? ' Then a 1½-step pre-bend on the B string (the 5th up to the ♭7).' : ''} Last bar resolves to the root on the D string. Pass: every pre-bend matches the target when you check it against the fretted note two frets up.`,
    watch: 'Pre-bends that start flat: you hear the note creep up after you pick. Check the target first, then bend to it.', simplify: 'Bend up and release with sound (no pre-bend) to learn the distance first.', tab: { notes }
  });
}

export default artist({ id: 'gilmour', name: 'David Gilmour', wiki: ['David Gilmour'], genre: 'classic-rock', re: /gilmour|pink floyd/,
    blurb: 'Slow, singing phrasing, perfectly pitched bends and pre-bends, and space.',
    techniques: ['Bends and pre-bends', 'Vibrato', 'Pentatonic phrasing', 'Space'],
    ctx: { key: 11, minor: true, prog: 'minorRock' },
    units: [
      U('The box', 'B minor pentatonic, played slowly.', [S('dg-box', 'B minor pentatonic', 'fretboard', 'Box 1 in triplets.', [['scaleRun', { scale: 'minorPent', box: 1, unit: 'triplets' }], ['connectPositions', { scale: 'minorPent', from: 1, to: 2 }]])]),
      U('Bends in tune', 'Every bend lands on pitch.', [S('dg-bend', 'Bends to pitch', 'fretting', 'Check each bend against the fretted target.', [['bendLick'], c => dgPrebends(c)])]),
      U('Vibrato', 'Slow, wide vibrato.', [S('dg-vib', 'Vibrato', 'fretting', 'Even, slow vibrato on held notes.', [['vibratoHolds']])]),
      U('Color', 'The Dorian 6th.', [S('dg-dorian', 'Minor pentatonic vs Dorian', 'theory', 'Adding the 2nd and 6th.', [['modeCompare', { modes: ['minor', 'dorian'] }]])]),
      U('Putting it together', 'Fewer notes, more meaning.', [S('dg-solo', 'Slow phrasing', 'improv', 'Space between phrases.', [['callResponse', { chords: '$minorRock' }], ['targetSolo', { chords: '$slowBlues' }]])])
    ],
    riffs: [{ title: 'Comfortably Numb', artist: 'Pink Floyd', note: 'Bends and slow phrasing.' }, { title: 'Shine On You Crazy Diamond', artist: 'Pink Floyd', note: 'Slow, singing lead.' },
      { title: 'Time', artist: 'Pink Floyd', note: 'Bends and pentatonic phrasing.' }, { title: 'Money', artist: 'Pink Floyd', note: 'Riff in 7/4 and solo.' },
      { title: 'Wish You Were Here', artist: 'Pink Floyd', note: 'Acoustic intro lick.' }] });
