// The 7♯9 chord: The Hendrix chord in a groove.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** A 7♯9 funk-rock groove (the “Hendrix chord”), original pattern. */
export function hxSharp9(c) {
  const shapes = [{ name: 'E7♯9', frets: [null, 7, 6, 7, 8, null] }, { name: 'D7♯9', frets: [null, 5, 4, 5, 6, null] }];
  const hits = [[0, 0.5], [0.5, 0.5, 'm'], [1, 0.5], [1.75, 0.25], [2, 0.5, 'm'], [2.5, 0.5], [3, 0.5], [3.5, 0.5, 'm']];
  const notes = [];
  [0, 0, 1, 0].forEach((si, bar) => {
    const v = shapes[si];
    hits.forEach(([t, d, m]) => v.frets.forEach((f, i) => { if (f != null) notes.push(N(6 - i, f, bar * 4 + t, d, m ? 'pm' : null, { chord: true })); }));
  });
  return make(c, {
    id: 'hx-sharp9', name: 'The 7♯9 chord groove (Hendrix style)', domain: 'rhythm', unit: '16th notes', goal: 110, start: 60, minutes: 5,
    why: 'The dominant 7♯9 has the major 3rd and the minor 3rd (♯9) in one grip: the tense, bluesy chord Hendrix made famous in rock.',
    instr: 'Grip E7♯9 at the 7th fret (x7678x). Strum the rhythm; the hits marked PM are muted by relaxing the fretting hand, not by palm muting. Bar 3 moves the shape down two frets to D7♯9.',
    watch: 'Strings 1 and 6 ringing: touch them with the thumb and the underside of the index finger.', simplify: 'Quarter-note strums.',
    voicings: shapes, chords: shapes.map(s => s.name), backing: ['E7', 'E7', 'D7', 'E7'], tab: { notes }
  });
}

export default entry({
  id: 'sharp9', kind: 'technique', title: 'The 7♯9 chord', domain: 'rhythm',
  re: /7.?(♯|#|sharp) ?9|hendrix chord/,
  summary: 'The Hendrix chord in a groove.',
  stages: [
    stage('intermediate', 'The 7♯9 chord', 'Play every lesson of this stage clean at its goal tempo.', [
      S('sharp9', 'The 7♯9 groove', 'rhythm', 'Grip, rhythm and moving it.', [c => hxSharp9(c)])
    ], [4, 6])
  ]
});
