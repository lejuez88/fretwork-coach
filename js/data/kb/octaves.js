// Octaves: Melodies in octaves with the middle string muted.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** Octave melodies (strings 5 & 3, then 4 & 2). */
export function hxOctaves(c) {
  const key = minorKey(c);
  const degs = [0, 3, 5, 7, 10, 7, 5, 3];
  const notes = []; let t = 0;
  for (const [s, gap] of [[5, 2], [4, 3]]) {
    for (const d of degs) {
      const f = fretOn(s, mod12(key + d), 3, 15); if (f == null) continue;
      notes.push(N(s, f, t, 0.5, null, { chord: true }), N(s - 2, f + gap, t, 0.5, null, { chord: true })); t += 0.5;
    }
  }
  return make(c, {
    id: 'hx-octaves', name: `Octave melodies (${nameOf(key)} minor pentatonic)`, domain: 'fretting', unit: '8th notes', goal: 120, start: 60, minutes: 4,
    why: 'Octaves (one note doubled an octave up, with the string between muted) make a melody sound huge: a Hendrix and Wes Montgomery trademark.',
    instr: 'Index on the lower note, ring or pinky on the upper, the index finger’s underside mutes the string in between. Strum all three strings. Strings 5 & 3 are two frets apart; 4 & 2 are three frets apart (the B string shift).',
    watch: 'The middle string ringing.', simplify: 'Quarter notes on strings 5 & 3 only.', tab: { notes }
  });
}

export default entry({
  id: 'octaves', kind: 'technique', title: 'Octaves', domain: 'fretting',
  re: /octaves?/,
  summary: 'Melodies in octaves with the middle string muted.',
  stages: [
    stage('intermediate', 'Octaves', 'Play every lesson of this stage clean at its goal tempo.', [
      S('octaves', 'Octave melodies', 'fretting', 'Strings 5 & 3, then 4 & 2.', [c => hxOctaves(c)])
    ], [4, 6])
  ]
});
