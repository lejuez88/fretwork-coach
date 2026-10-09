// Speed pentatonics: Six-note cells on three strings, one per beat, in one box and then across all five.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** EJ-style descending sixes: two notes per string across three strings, then down a string. */
export function ejSixes(c, { legato = false } = {}) {
  const key = minorKey(c), B = byString(pentBox(key, 1));
  if (!B[1] || !B[6]) return null;
  const cell = (top, up) => {
    const strs = up ? [top + 2, top + 1, top] : [top, top + 1, top + 2];
    return strs.flatMap(s => (up ? [[s, B[s][0]], [s, B[s][1], legato ? 'h' : null]] : [[s, B[s][1]], [s, B[s][0], legato ? 'p' : null]]));
  };
  const down = [1, 2, 3, 4].flatMap(t => cell(t, false));
  const up = [4, 3, 2, 1].flatMap(t => cell(t, true));
  const notes = [...fromSeq(down, 1 / 6), ...fromSeq(up, 1 / 6, 4)];
  const k = nameOf(key);
  return make(c, {
    id: legato ? 'ej-sixes-legato' : 'ej-sixes', name: `${legato ? 'Legato' : 'Picked'} pentatonic sixes in ${k} minor (Eric Johnson style)`, domain: legato ? 'fretting' : 'picking',
    unit: '16th-note sextuplets', goal: 92, start: 48, minutes: 6, dl: 1, picking: legato ? 'alternate' : 'strict',
    why: 'Six-note cells (two notes on each of three strings) are the engine of Eric Johnson’s fast pentatonic runs: each beat is one cell, so the run stays locked to the click while it cascades across the strings.',
    instr: `Box 1 of ${k} minor pentatonic. Bar 1: one six-note cell per beat, starting on string 1, then 2, 3 and 4, always descending. Bar 2: the same cells climbing back up. Accent the first note of every beat so you can hear the sextuplets.${legato ? ' Pick only the first note on each string; pull off (down) or hammer on (up) the second.' : ' Strict alternate picking, every note picked.'}`,
    watch: 'Rushing the string changes so the cells turn into uneven 16ths.', simplify: 'One cell per beat on strings 1–3 only, looped.', tab: { notes }
  });
}
/** The descending six-note cell moved through all five boxes: speed pentatonics that travel up and down the neck. */
export function ejSixesAcross(c) {
  const key = minorKey(c), order = [1, 2, 3, 4, 5, 4, 3, 2];
  const seq = [];
  for (const b of order) {
    const B = byString(pentBox(key, b)); if (!B[1] || !B[3]) return null;
    seq.push([1, B[1][1]], [1, B[1][0], 'p'], [2, B[2][1]], [2, B[2][0], 'p'], [3, B[3][1]], [3, B[3][0], 'p']);
  }
  const k = nameOf(key);
  return make(c, {
    id: 'ej-sixes-across', name: `Speed pentatonics through all five boxes (${k} minor)`, domain: 'fretboard', unit: '16th-note sextuplets', goal: 88, start: 44, minutes: 6, dl: 2, picking: 'alternate',
    why: 'Eric Johnson’s runs don’t stay in one box: the same six-note cell slides from position to position, so a run can travel the whole neck at speed.',
    instr: `One descending six-note cell on strings 1–3 per beat, in box 1, then box 2, 3, 4, 5 and back down (4, 3, 2). Shift on the first note of each beat with the index or ring finger, light on the strings. Watch the fretboard under the tab to see the boxes go by.`,
    watch: 'Late position shifts that leave a gap at the start of the beat.', simplify: 'Boxes 1 and 2 only, two beats each.', tab: { notes: fromSeq(seq, 1 / 6) }
  });
}

export default entry({
  id: 'speedPent', kind: 'technique', title: 'Speed pentatonics', domain: 'picking',
  re: /speed pentatonic|fast pentatonic|pentatonic (speed|runs?|sextuplets?|sixes)|sextuplets?|pentatonic sixes|\bsixes\b/,
  summary: 'Six-note cells on three strings, one per beat, in one box and then across all five.',
  stages: [
    stage('advanced', 'Speed pentatonics', 'Play every lesson of this stage clean at its goal tempo.', [
      S('speedpent-cells', 'Pentatonic sixes', 'picking', 'The six-note cell, picked and legato.', [c => ejSixes(c), c => ejSixes(c, { legato: true })]),
      S('speedpent-across', 'Speed pentatonics across the neck', 'fretboard', 'The cell through all five boxes.', [c => ejSixesAcross(c)])
    ], [7, 8])
  ]
});
