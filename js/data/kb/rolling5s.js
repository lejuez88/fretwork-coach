// Rolling 5s: Pentatonic in groups of five, played in 16ths so the accent rolls across the beat.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** Rolling 5s: five-note groups stepping through the scale, played in 16ths so the accent rolls across the beat. */
export function ejRolling5s(c, { dir = 'down', diagonal = false } = {}) {
  const key = minorKey(c);
  const pts = diagonal ? pent3nps(key) : pentBox(key, 1);
  if (!pts) return null;
  const line = (dir === 'down' ? pts.slice().reverse() : pts.slice()).map(p => [p.s, p.f]);
  const groups = Math.min(diagonal ? 12 : 8, line.length - 4);
  const seq = []; for (let i = 0; i < groups; i++) seq.push(...line.slice(i, i + 5));
  const marked = legatoMarks(seq).map((n, i) => (i % 5 === 0 ? [n[0], n[1], null] : n)); // pick the first note of every group
  const notes = fromSeq(marked, 0.25);
  // land on the root
  const rootNote = (dir === 'down' ? pts.slice() : pts.slice().reverse()).find(p => mod12(OPEN[p.s] + p.f) === key);
  const end = groups * 5 * 0.25, beats = Math.ceil((end + 1) / 4) * 4;
  if (rootNote) notes.push(N(rootNote.s, rootNote.f, end, beats - end));
  const k = nameOf(key);
  return make(c, {
    id: `ej-rolling5-${dir}${diagonal ? '-diag' : ''}`,
    name: `Rolling 5s ${dir === 'down' ? 'descending' : 'ascending'}${diagonal ? ' along the neck' : ', box 1'} (${k} minor)`,
    domain: 'picking', unit: '16th notes (groups of 5)', goal: diagonal ? 92 : 100, start: 50, minutes: 6, dl: diagonal ? 2 : 1, picking: 'alternate',
    why: 'Eric Johnson’s “rolling” runs group the pentatonic in fives but play it in 16ths: the group restarts on a different part of the beat each time, which gives the line its cascading, rolling sound.',
    instr: `Play five notes ${dir === 'down' ? 'down' : 'up'} the scale, then start again one note ${dir === 'down' ? 'lower' : 'higher'}: ${diagonal ? 'on the three-notes-per-string shape, so the run travels diagonally across the neck' : 'inside box 1'}. Accent the first note of each group of five while the click stays on quarter notes: the accent lands on a different 16th every time. Pick the first note of each group and each new string; slur the rest (marked h/p).`,
    watch: 'Turning the groups of five into groups of four, so the accent stops rolling.', simplify: 'Play it as quintuplets (five notes per click) at half tempo until the groups feel automatic.', tab: { notes }
  });
}

export default entry({
  id: 'rolling5s', kind: 'technique', title: 'Rolling 5s', domain: 'picking',
  re: /rolling (5|five)'?s?|groups? of (5|five)|\bin (5|five)s\b|quintuplet/,
  summary: 'Pentatonic in groups of five, played in 16ths so the accent rolls across the beat.',
  stages: [
    stage('advanced', 'Rolling 5s', 'Play every lesson of this stage clean at its goal tempo.', [
      S('rolling5s-box', 'Rolling 5s in box 1', 'picking', 'Groups of five down and up the box.', [c => ejRolling5s(c, { dir: 'down' }), c => ejRolling5s(c, { dir: 'up' })]),
      S('rolling5s-neck', 'Rolling 5s along the neck', 'picking', 'The same groups on the diagonal three-notes-per-string shape.', [c => ejRolling5s(c, { dir: 'down', diagonal: true })])
    ], [7, 8])
  ]
});
