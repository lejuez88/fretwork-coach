// Pentatonic plus the 9th: The minor pentatonic with the 2nd added: a brighter, more open run.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** EJ-style pentatonic with the added 2nd and 4th (the “hexatonic” color), descending across two octaves. */
export function ejAddedNotes(c) {
  const key = minorKey(c);
  const pcs = [0, 2, 3, 5, 7, 10].map(x => mod12(key + x)); // minor pentatonic + 9
  const rf = rootFret6(key) || 12;
  const seq = [];
  for (let s = 1; s <= 6; s++) {
    const here = []; for (let f = rf - 1; f <= rf + 4; f++) if (f >= 0 && pcs.includes(mod12(OPEN[s] + f))) here.push(f);
    here.sort((a, b) => b - a).forEach((f, i) => seq.push([s, f, i ? 'p' : null]));
  }
  if (seq.length < 8) return null;
  const notes = fromSeq(seq.slice(0, 16), 0.25).concat(fromSeq(seq.slice(0, 16).reverse().map(([s, f]) => [s, f, null]), 0.25, 4));
  return make(c, {
    id: 'ej-added-9', name: `Pentatonic plus the 9th (${nameOf(key)} minor)`, domain: 'fretboard', unit: '16th notes', goal: 100, start: 50, minutes: 5,
    why: 'Adding the 2nd (9th) to the minor pentatonic gives the brighter, more open sound Eric Johnson uses in his runs, without leaving the familiar box.',
    instr: 'Descend through the box with the added note on each string (pull-offs marked p), then climb back up picking every note. Find the new notes: they sit two frets above each root.',
    watch: 'Dropping the added note when the tempo goes up.', simplify: 'The top three strings only.', tab: { notes }
  });
}

export default entry({
  id: 'hexatonic', kind: 'technique', title: 'Pentatonic plus the 9th', domain: 'fretboard',
  re: /hexatonic|added (2nd|9th|ninth)|pentatonic (\+|plus|with) (the )?(2|9|2nd|9th)/,
  summary: 'The minor pentatonic with the 2nd added: a brighter, more open run.',
  stages: [
    stage('intermediate', 'Pentatonic plus the 9th', 'Play every lesson of this stage clean at its goal tempo.', [
      S('hexatonic', 'Pentatonic plus the 9th', 'fretboard', 'The added note in box 1.', [c => ejAddedNotes(c)])
    ], [4, 6])
  ]
});
