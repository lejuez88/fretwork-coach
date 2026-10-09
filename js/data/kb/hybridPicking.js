// Hybrid picking: Pick plus middle and ring fingers: pinches over a bass line, then rolls across three strings.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** Hybrid picking: pick on the bass, middle and ring fingers pinch the top two strings. */
export function hybridPinches(c) {
  const chords = (c.lvl || 4) >= 5 ? ['G', 'Em', 'C', 'D'] : ['G', 'C', 'D', 'G'];
  const notes = [];
  chords.forEach((nm, bar) => {
    const [b1, b2] = bassPair(nm), T = bar * 4;
    [b1, b2, b1, b2].forEach((s, i) => {
      notes.push(N(s, onString(nm, s), T + i, 0.5));
      notes.push(N(2, onString(nm, 2), T + i + 0.5, 0.5, null, { chord: true }), N(1, onString(nm, 1), T + i + 0.5, 0.5, null, { chord: true }));
    });
  });
  return make(c, {
    id: 'hybrid-pinches', name: `Hybrid picking: pick the bass, pluck the top pair (${chords.join(' – ')})`, domain: 'picking', unit: '8th notes', goal: 112, start: 60, minutes: 5, picking: 'hybrid',
    why: 'Hybrid picking holds the pick for the bass and uses the middle and ring fingers for the top strings, so you get fingerstyle sounds without putting the pick down. Plucking two strings together is the first step: it trains the fingers to fire in time with the pick.',
    instr: 'Pick downstrokes on the beat: the root, then the alternate bass note. On every “and”, the middle finger (B string) and ring finger (high e) pluck together, snapping up and away from the guitar. Let the chord ring. Pass: four bars where the plucks are as loud as the pick and exactly between the beats.',
    watch: 'The plucked pair arriving early, crowding the bass note, or the hand lifting off its anchor to pluck.', simplify: 'Middle finger only on the B string.', voicings: openVoicings(chords), chords, backing: chords, tab: { notes }
  });
}
/** Hybrid-picked banjo-style rolls: pick, middle, ring across strings 3-2-1 through the chords of the key. */
export function hybridRolls(c, { cross = null } = {}) {
  const lvl = c.lvl || 4; cross = cross == null ? lvl >= 6 : cross; const step = cross ? 0.25 : 1 / 3, perBar = cross ? 16 : 12;
  const chords = keyChords(c).slice(0, 3); chords.push(chords[0]);
  const notes = [], voicings = [], used = []; let near = 6, i = 0;
  chords.forEach((nm, bar) => {
    const tr = topTriad(nm, near); if (!tr) return; near = (tr[1] + tr[2] + tr[3]) / 3;
    for (let k = 0; k < perBar; k++, i++) { const s = [3, 2, 1][i % 3]; notes.push(N(s, tr[s], bar * 4 + k * step, step)); }
    voicings.push({ name: tr.name, frets: [null, null, null, tr[3], tr[2], tr[1]] }); used.push(tr.name);
  });
  if (used.length < 4) return null;
  return make(c, {
    id: `hybrid-rolls-${cross ? '16' : '3'}`, name: `Hybrid-picked rolls on the top three strings${cross ? ' in 16ths' : ''} (${used.join(' – ')})`, domain: 'picking',
    unit: cross ? '16th notes' : '8th-note triplets', goal: cross ? 96 : 100, start: 50, minutes: 6, dl: cross ? 1 : 0, picking: 'hybrid',
    why: cross ? 'A three-note roll played in 16ths starts on a different part of the beat every time: the cascading banjo-roll sound of country hybrid picking. The hand has to keep a three-note cycle against a four-note pulse.'
      : 'Pick, middle, ring across three strings is the core motion of hybrid picking. Played as triplets, each beat is one complete roll, so you can lock every finger to the click.',
    instr: `Pick (downstroke) on the G string, middle finger on the B string, ring finger on the high e, over and over${cross ? ', without restarting at the bar line: the roll keeps cycling, so the accent moves' : ', one roll per beat'}. One chord per bar: grip the triad shown and change shapes without breaking the roll. Pass: all four bars even in volume at the goal tempo.`,
    watch: 'The ring finger being weaker than the others, or the pick digging in louder than the fingers.', simplify: cross ? 'Play it as triplets (one roll per beat) first.' : 'One chord, half tempo.',
    voicings, chords: used, backing: used, tab: { notes }
  });
}

export default entry({
  id: 'hybridPicking', kind: 'technique', title: 'Hybrid picking', domain: 'picking',
  re: /hybrid.?pick|pick (and|&|\+) fingers?|chicken.?pick/,
  summary: 'Pick plus middle and ring fingers: pinches over a bass line, then rolls across three strings.',
  ctx: { key: 7, minor: false, prog: 'country' },
  stages: [
    stage('intermediate', 'Hybrid picking', 'Play every lesson of this stage clean at its goal tempo.', [
      S('hybrid-pinch', 'Bass and pinches', 'picking', 'Pick the bass, pluck two strings together.', [c => hybridPinches(c)]),
      S('hybrid-rolls', 'Hybrid rolls', 'picking', 'Pick, middle, ring across strings 3-2-1.', [c => hybridRolls(c, { cross: false }), c => hybridRolls(c, { cross: true })])
    ], [4, 6])
  ]
});
