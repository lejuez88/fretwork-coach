// Travis picking: An alternating thumb bass with the fingers playing between the beats, built up in three steps.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** Travis picking, built in three stages: thumb alone, thumb + one finger, the full pattern. */
export function travisStages(c, { stage = 3 } = {}) {
  const lvl = c.lvl || 4;
  const chords = stage === 3 ? ['C', 'Am', 'Em', 'G'] : ['C', 'Am', 'G', 'C'];
  const notes = [];
  chords.forEach((nm, bar) => {
    const [b1, b2] = bassPair(nm), T = bar * 4;
    const thumb = [b1, b2, b1, b2];
    const pinches = stage === 3 ? (lvl >= 5 ? [0, 2] : [0]) : [];
    thumb.forEach((s, i) => notes.push(N(s, onString(nm, s), T + i, 1, null, pinches.includes(i) ? { chord: true } : null)));
    if (stage === 2) [1.5, 3.5].forEach(t => notes.push(N(2, onString(nm, 2), T + t, 0.5)));
    if (stage === 3) {
      pinches.forEach(i => notes.push(N(1, onString(nm, 1), T + i, 1, null, { chord: true })));
      [[0.5, 2], [1.5, 3], [2.5, 2], [3.5, 1]].forEach(([t, s]) => notes.push(N(s, onString(nm, s), T + t, 0.5)));
    }
  });
  const label = { 1: 'the thumb alone', 2: 'thumb plus one finger', 3: 'the full pattern' }[stage];
  return make(c, {
    id: `travis-stage-${stage}`, name: `Travis picking, step ${stage}: ${label} (${chords.join(' – ')})`, domain: 'picking',
    unit: stage === 1 ? 'quarter notes' : '8th notes', goal: stage === 1 ? 100 : 88, start: stage === 1 ? 60 : 48, minutes: 5, dl: stage - 3, picking: 'fingers',
    why: stage === 1 ? 'Travis picking only works when the thumb runs on autopilot: an alternating bass on every beat, root string then the next string up, that never waits for the fingers.'
      : stage === 2 ? 'Adding one finger on the off-beats is the hardest moment in Travis picking: the thumb must keep its quarter notes while the finger plays between them.'
        : 'The full pattern: thumb on every beat, fingers filling the “ands”, and a pinch (thumb and finger together) on beat 1 to anchor the bar. This is the accompaniment behind folk, country and fingerstyle pop.',
    instr: stage === 1 ? 'Thumb (p) only. Each bar: root string, the next string up, root, next string up, one per click. Hold the full chord shape anyway so it rings. Pass: four bars with the thumb never stopping at the chord changes.'
      : stage === 2 ? 'Thumb exactly as in step 1. The middle finger (m) plucks the B string on the “and” of 2 and the “and” of 4. Count “1 2 & 3 4 &” out loud. Pass: four bars where the thumb stays even while the finger joins.'
        : `Thumb on every beat as before. Fingers: index (i) on the G string, middle (m) on the B string, ring or middle on the high e. Beat 1${lvl >= 5 ? ' and beat 3 are pinches' : ' is a pinch'} (thumb and high e together), then the off-beats go B, G, B, e. Pass: all four bars at the goal tempo without the thumb hesitating.`,
    watch: 'The thumb copying the fingers’ rhythm, or the bass skipping a beat when the chord changes.', simplify: stage === 1 ? 'One chord, half the tempo.' : 'Drop back a step for two minutes, then return.',
    voicings: openVoicings(chords), chords, ...(stage === 3 ? { backing: chords } : {}), tab: { notes }
  });
}

export default entry({
  id: 'travis', kind: 'technique', title: 'Travis picking', domain: 'picking',
  re: /travis(-| )?pick|travis (pattern|style)|alternating(-| )thumb|alternating bass fingerpick/,
  summary: 'An alternating thumb bass with the fingers playing between the beats, built up in three steps.',
  ctx: { key: 0, minor: false, prog: 'folkAxis' },
  stages: [
    stage('foundations', 'Travis picking', 'Play every lesson of this stage clean at its goal tempo.', [
      S('travis-thumb', 'The alternating thumb', 'picking', 'Thumb alone, then one finger on the off-beats.', [c => travisStages(c, { stage: 1 }), c => travisStages(c, { stage: 2 })]),
      S('travis-full', 'The full Travis pattern', 'picking', 'Pinch on beat 1, fingers filling the ands.', [c => travisStages(c, { stage: 3 }), ['travisPattern', { chords: ['G', 'Em', 'C', 'D'] }]])
    ], [2, 3])
  ]
});
