// Economy picking: Alternate picking on a string, sweeping through the string change when it goes the same way.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** Economy picking through a three-notes-per-string scale: sweep the string changes. */
export function economyScale(c, { fast = null } = {}) {
  const key = minorKey(c), rf = rootFret6(key) || 12;
  const pts = scaleNps(key, 'minor', rf, 3) || scaleNps(key, 'minor', rf - 12 >= 0 ? rf - 12 : rf, 3);
  if (!pts || Math.max(...pts.map(p => p.f)) > 22) return null;
  fast = fast == null ? (c.lvl || 4) >= 6 : fast; const step = fast ? 1 / 6 : 1 / 3;
  const up = pts.map(p => [p.s, p.f]), seq = [...up, ...up.slice().reverse()];
  const k = nameOf(key);
  return make(c, {
    id: `economy-3nps-${fast ? '6' : '3'}`, name: `Economy picking: ${k} natural minor, three notes per string${fast ? ' (two strings per beat)' : ''}`, domain: 'picking',
    unit: fast ? '16th-note sextuplets' : '8th-note triplets', goal: fast ? 84 : 120, start: fast ? 44 : 60, minutes: 5, dl: fast ? 1 : 0, picking: 'economy',
    why: 'Economy picking alternates on a string but sweeps through the string change when the next string lies in the same direction. With three notes per string, every new string ascending starts with a downstroke and every new string descending with an upstroke, so the pick never jumps back over a string.',
    instr: `Ascending: down-up-down on each string, then keep the downstroke falling onto the next string (down-up-down, down…). Descending: up-down-up on each string, then let the upstroke carry onto the next string down. ${fast ? 'Two strings per beat.' : 'One string per beat: the first note of each string lands on the click.'} Say the pick directions out loud at the start tempo. Pass: up and down twice with the sweep feeling like one motion, not two separate strokes.`,
    watch: 'Turning the string change into a rushed flick: the two strokes in the same direction must be as evenly spaced as the rest.', simplify: 'Two strings only (the G and B), looped.', tab: { notes: fromSeq(seq, step) }
  });
}
/** The two-string economy cell: six up, six down, on every string pair. */
export function economyCell(c) {
  const key = minorKey(c), rf = rootFret6(key) || 12;
  const pts = scaleNps(key, 'minor', rf, 3); if (!pts) return null;
  const B = {}; pts.forEach(p => (B[p.s] = B[p.s] || []).push(p.f)); Object.values(B).forEach(a => a.sort((x, y) => x - y));
  const seq = [];
  for (const hi of [5, 4, 3, 2, 1]) {
    const lo = hi + 1; if (!B[lo] || !B[hi] || B[lo].length < 3 || B[hi].length < 3) return null;
    const upCell = [...B[lo].map(f => [lo, f]), ...B[hi].map(f => [hi, f])];
    const cell = [...upCell, ...upCell.slice().reverse()];
    seq.push(...cell, ...cell);
  }
  const k = nameOf(key);
  return make(c, {
    id: 'economy-cell', name: `Economy picking cell on every string pair (${k} natural minor)`, domain: 'picking', unit: '16th-note sextuplets', goal: 92, start: 46, minutes: 6, dl: 1, picking: 'economy',
    why: 'Six notes up across two strings and six back down puts a sweep in both directions inside one beat pair. It isolates the exact motion economy picking depends on, on every string pair.',
    instr: 'Going up: down-up-down on the lower string, down-up-down on the upper (the two downstrokes in a row are the sweep). Coming down: up-down-up on the upper string, up-down-up on the lower. Each six-note group is one beat; play the cell twice, then move up a string pair. Pass: all five string pairs clean at the goal tempo.',
    watch: 'Letting the swept notes ring together: lift each finger as soon as the next string sounds.', simplify: 'One string pair (G and B) in 8th-note triplets.', tab: { notes: fromSeq(seq, 1 / 6) }
  });
}

export default entry({
  id: 'economyPicking', kind: 'technique', title: 'Economy picking', domain: 'picking',
  re: /economy.?pick/,
  summary: 'Alternate picking on a string, sweeping through the string change when it goes the same way.',
  stages: [
    stage('intermediate', 'Economy picking', 'Play every lesson of this stage clean at its goal tempo.', [
      S('economy-scale', 'Economy picking a 3nps scale', 'picking', 'Down-up-down, then sweep onto the next string.', [c => economyScale(c, { fast: false }), c => economyScale(c, { fast: true })]),
      S('economy-cell', 'The two-string economy cell', 'picking', 'Six up, six down, on every string pair.', [c => economyCell(c)])
    ], [5, 6])
  ]
});
