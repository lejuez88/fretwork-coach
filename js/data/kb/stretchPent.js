// Stretched pentatonic: Three notes per string for long, even runs.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** Three-notes-per-string pentatonic with wide stretches, alternate picked. */
export function pgStretchPent(c) {
  const key = minorKey(c), pts = pent3nps(key); if (!pts) return null;
  const up = pts.map(p => [p.s, p.f]), down = up.slice(0, -1).reverse();
  const notes = fromSeq([...up, ...down], 0.25);
  return make(c, {
    id: 'pg-stretch-pent', name: `Stretched pentatonic, three notes per string (${nameOf(key)} minor)`, domain: 'fretting', unit: '16th notes', goal: 108, start: 50, minutes: 5, dl: 1, picking: 'alternate',
    why: 'Three pentatonic notes per string means wide stretches but an even number of notes per string, which makes fast alternate picking and long runs across the neck easier.',
    instr: 'Up the shape and back down in 16ths, alternate picking. Thumb low behind the neck for the stretches; keep fingers close to the frets.',
    watch: 'Tension in the thumb on the widest stretches.', simplify: 'The top three strings.', tab: { notes }
  });
}

export default entry({
  id: 'stretchPent', kind: 'technique', title: 'Stretched pentatonic', domain: 'fretting',
  re: /(3|three).?notes?.?per.?string pentatonic|stretch(ed)? pentatonic|pentatonic stretch/,
  summary: 'Three notes per string for long, even runs.',
  stages: [
    stage('intermediate', 'Stretched pentatonic', 'Play every lesson of this stage clean at its goal tempo.', [
      S('stretch-pent', 'Three-notes-per-string pentatonic', 'fretting', 'Wide stretches, alternate picked.', [c => pgStretchPent(c)])
    ], [5, 6])
  ]
});
