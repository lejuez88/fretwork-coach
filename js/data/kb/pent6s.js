// Pentatonic in sixes: The box in six-note sequences.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** The pentatonic box in groups of six, up and down. */
export function pgPent6s(c) {
  const key = minorKey(c), pts = pentBox(key, 1); if (!pts) return null;
  const up = pts.map(p => [p.s, p.f]), dn = up.slice().reverse();
  const seq = [];
  for (let i = 0; i + 6 <= up.length; i++) seq.push(...up.slice(i, i + 6));
  const half = seq.length;
  for (let i = 0; i + 6 <= dn.length; i++) seq.push(...dn.slice(i, i + 6));
  const notes = fromSeq(seq.slice(0, half), 1 / 6).concat(fromSeq(seq.slice(half), 1 / 6, 8));
  return make(c, {
    id: 'pg-pent-6s', name: `Pentatonic in groups of six (${nameOf(key)} minor)`, domain: 'picking', unit: '16th-note sextuplets', goal: 100, start: 48, minutes: 5, dl: 1, picking: 'alternate',
    why: 'Sequencing the pentatonic in sixes is a Paul Gilbert staple: each beat starts one note further along, so the line climbs steadily while every beat begins on a downstroke.',
    instr: 'Six notes up from the first note, then six up from the second, and so on to the top; then the same coming down. One group per beat, alternate picked.',
    watch: 'Losing the downstroke at the start of each beat.', simplify: 'Groups of four in 16ths.', tab: { notes }
  });
}

export default entry({
  id: 'pent6s', kind: 'technique', title: 'Pentatonic in sixes', domain: 'picking',
  re: /pentatonic in (6'?s|sixes)|groups? of (6|six)/,
  summary: 'The box in six-note sequences.',
  stages: [
    stage('intermediate', 'Pentatonic in sixes', 'Play every lesson of this stage clean at its goal tempo.', [
      S('pent-6s', 'Pentatonic in groups of six', 'picking', 'One group per beat, up and down.', [c => pgPent6s(c)])
    ], [5, 6])
  ]
});
