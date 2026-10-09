// String-skipped arpeggios: Triads with a skipped string, alternate picked.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** String-skipped arpeggios on strings 4 and 2 (Paul Gilbert style). */
export function pgSkipArps(c, { chords = ['Am', 'F', 'C', 'G'] } = {}) {
  const seq = [], used = []; let near = 7;
  for (const name of chords) {
    const ch = chordInfo(name); if (!ch) continue;
    let r = null; for (let f = 2; f <= 14; f++) if (mod12(50 + f) === ch.pc && (r == null || Math.abs(f - near) < Math.abs(r - near))) r = f;
    if (r == null) continue; near = r;
    const third = ch.type === 'min' ? 3 : 4;
    const cell = [[4, r], [4, r + third], [2, r - 2], [2, r + 3], [2, r - 2], [4, r + third]];
    for (let k = 0; k < 4; k++) seq.push(...cell);
    used.push(ch.name);
  }
  if (!seq.length) return null;
  return make(c, {
    id: `pg-skip-${slug(used.join(''))}`, name: `String-skipped arpeggios: ${used.join(' – ')}`, domain: 'picking', unit: '16th-note sextuplets', goal: 92, start: 46, minutes: 6, dl: 2, picking: 'alternate',
    why: 'Skipping a string turns a plain triad into wide intervals: the angular arpeggio sound Paul Gilbert uses instead of sweeping, played with alternate picking.',
    instr: 'Each chord: root and 3rd on string 4, skip string 3, 5th and octave on string 2, back down. Four times per bar, one chord per bar. Alternate pick every note; mute string 3 with the underside of the fretting fingers.',
    watch: 'Clipping string 3 on the way over.', simplify: '16th notes and one chord.', chords: used, backing: used, tab: { notes: fromSeq(seq, 1 / 6) }
  });
}

export default entry({
  id: 'skipArps', kind: 'technique', title: 'String-skipped arpeggios', domain: 'picking',
  re: /string.?skip/,
  summary: 'Triads with a skipped string, alternate picked.',
  stages: [
    stage('advanced', 'String-skipped arpeggios', 'Play every lesson of this stage clean at its goal tempo.', [
      S('skip-arps', 'String-skipped arpeggios', 'picking', 'Root and 3rd on string 4, 5th and octave on string 2.', [c => pgSkipArps(c)])
    ], [7, 8])
  ]
});
