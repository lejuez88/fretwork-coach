// The six-note picking lick: A two-string pentatonic cell that trains inside string changes.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** Six-note two-string pentatonic cell, strict alternate picking (Paul Gilbert style). */
export function pgSixNote(c, { across = false } = {}) {
  const key = minorKey(c);
  const seq = [];
  if (!across) {
    const B = byString(pentBox(key, 1)); if (!B[1] || !B[5]) return null;
    for (const top of [1, 2, 3, 4]) {
      const lo = top + 1;
      const cell = [[lo, B[lo][0]], [lo, B[lo][1]], [top, B[top][0]], [top, B[top][1]], [top, B[top][0]], [lo, B[lo][1]]];
      for (let r = 0; r < 4; r++) seq.push(...cell);
    }
  } else {
    for (const b of [1, 2, 3, 4, 5, 4, 3, 2]) {
      const B = byString(pentBox(key, b)); if (!B[1]) return null;
      const cell = [[2, B[2][0]], [2, B[2][1]], [1, B[1][0]], [1, B[1][1]], [1, B[1][0]], [2, B[2][1]]];
      seq.push(...cell, ...cell);
    }
  }
  const k = nameOf(key);
  return make(c, {
    id: across ? 'pg-six-across' : 'pg-six-note', name: across ? `Six-note picking lick through all five boxes (${k} minor)` : `Six-note pentatonic picking lick on string pairs (${k} minor)`,
    domain: 'picking', unit: '16th-note sextuplets', goal: 100, start: 48, minutes: 5, dl: across ? 2 : 1, picking: 'strict',
    why: 'Paul Gilbert’s best-known speed drill is a six-note pentatonic cell on two strings, alternate picked: it trains the string change from the inside of the strings, where most picking breaks down.',
    instr: across ? 'The cell on strings 1–2, twice per box, moving through boxes 1 to 5 and back. Shift on the first note of each beat.' : 'The cell (two notes on the lower string, three on the upper, back to the lower) four times per bar, then down one string pair. Strict alternate picking starting with a downstroke; the pick has to jump between the strings on the string change.',
    watch: 'Using hammer-ons to hide a missed pick stroke.', simplify: 'The cell in 16th notes (four per beat) at a slow tempo.', tab: { notes: fromSeq(seq, 1 / 6) }
  });
}

export default entry({
  id: 'pgSix', kind: 'technique', title: 'The six-note picking lick', domain: 'picking',
  re: /paul gilbert lick|gilbert lick|(six|6).?note (picking )?(lick|pattern|cell)/,
  summary: 'A two-string pentatonic cell that trains inside string changes.',
  stages: [
    stage('advanced', 'The six-note picking lick', 'Play every lesson of this stage clean at its goal tempo.', [
      S('pg-six', 'Six-note picking lick', 'picking', 'On every string pair, then through the boxes.', [c => pgSixNote(c), c => pgSixNote(c, { across: true })])
    ], [7, 8])
  ]
});
