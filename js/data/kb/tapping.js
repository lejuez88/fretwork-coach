// Two-hand tapping: Tap–pull–hammer arpeggios on one string, and tapped extensions of the pentatonic.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** Tap – pull-off – hammer-on triplets that outline each chord on one string. */
export function evhTapTriplets(c, { chords = ['Am', 'F', 'G', 'E'], string = 2, sixteenths = false } = {}) {
  const notes = [], used = [];
  let t = 0;
  for (const name of chords) {
    const ch = chordInfo(name); if (!ch) continue;
    const frets = []; for (let f = 1; f <= 22; f++) if (ch.pcs.includes(mod12(OPEN[string] + f))) frets.push(f);
    const i = frets.findIndex(f => f >= 4 && f <= 10);
    if (i < 0 || i + 2 >= frets.length) continue;
    const [L, M, T] = [frets[i], frets[i + 1], frets[i + 2]];
    const cell = sixteenths ? [[T, 't'], [L, 'p'], [M, 'h'], [L, 'p']] : [[T, 't'], [L, 'p'], [M, 'h']];
    const step = sixteenths ? 0.25 : 1 / 3;
    for (let b = 0; b < 4; b++) cell.forEach(([f, x], k) => notes.push(N(string, f, t + b + k * step, step, x)));
    t += 4; used.push(ch.name);
  }
  if (!notes.length) return null;
  return make(c, {
    id: `evh-tap-${sixteenths ? '16' : '3'}-${slug(used.join(''))}`, name: `Tapped ${sixteenths ? '16th-note' : 'triplet'} arpeggios: ${used.join(' – ')} (Van Halen style)`, domain: 'fretting',
    unit: sixteenths ? '16th notes' : '8th-note triplets', goal: sixteenths ? 104 : 112, start: 50, minutes: 5, dl: 1,
    why: 'Eddie Van Halen made two-hand tapping a rock technique: the picking hand taps a high note, pulls off to a fretted note and the fretting hand hammers the next, so one string plays a whole chord at speed.',
    instr: `Tap (T) with the picking-hand middle or index finger, pull off sideways to the index finger's fret so the note sounds, then hammer the middle note. One chord per bar on string ${string}; the chord boxes show which notes you are outlining. Rest the picking-hand palm on the low strings to keep them quiet.`,
    watch: 'The tapped pull-off being weaker than the hammer: flick the string down toward the floor as you release.', simplify: 'Tap and pull-off only, in 8th notes, one chord.',
    chords: used, backing: used, tab: { notes }
  });
}
/** Tapped octave extensions of the pentatonic box. */
export function evhPentTap(c) {
  const key = minorKey(c), B = byString(pentBox(key, 1));
  if (!B[1] || B[1][0] + 12 > 22) return null;
  const notes = []; let t = 0;
  for (const s of [1, 2, 3, 2]) {
    const [a, b] = B[s];
    for (let r = 0; r < 2; r++) { notes.push(N(s, a + 12, t, 1 / 3, 't'), N(s, a, t + 1 / 3, 1 / 3, 'p'), N(s, b, t + 2 / 3, 1 / 3, 'h')); t += 1; }
  }
  return make(c, {
    id: 'evh-pent-tap', name: `Tapped pentatonic octaves (${nameOf(key)} minor, box 1)`, domain: 'fretting', unit: '8th-note triplets', goal: 112, start: 50, minutes: 5, dl: 1,
    why: 'Tapping the octave above the box turns a familiar pentatonic shape into wide, fast Van Halen-style licks without learning a new scale.',
    instr: 'On each string: tap 12 frets above the lower box note, pull off to it, hammer the upper box note. Two beats per string: 1, 2, 3, then back to 2.',
    watch: 'Tapping slightly off the fret (the tapped note goes sharp or dull).', simplify: 'String 1 only.', tab: { notes }
  });
}

export default entry({
  id: 'tapping', kind: 'technique', title: 'Two-hand tapping', domain: 'fretting',
  re: /tapping|tapped|two.?hand(ed)? tap|\btaps?\b|eruption/,
  summary: 'Tap–pull–hammer arpeggios on one string, and tapped extensions of the pentatonic.',
  stages: [
    stage('advanced', 'Two-hand tapping', 'Play every lesson of this stage clean at its goal tempo.', [
      S('tap-triplets', 'Tapped triplet arpeggios', 'fretting', 'Tap, pull off, hammer: one chord per bar.', [c => evhTapTriplets(c), c => evhTapTriplets(c, { sixteenths: true, chords: ['Am', 'G', 'F', 'E'] })]),
      S('tap-pent', 'Tapped pentatonic octaves', 'fretting', 'The box with a tapped note an octave up.', [c => evhPentTap(c)])
    ], [7, 8])
  ]
});
