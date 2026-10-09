// Open-string pull-offs: Legato against the open string.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** Pull-offs to the open string through E minor: the open-string legato sound of early Van Halen. */
export function evhOpenPulloffs(c) {
  const em = [0, 2, 3, 5, 7, 8, 10].map(x => mod12(4 + x));
  const notes = []; let t = 0;
  for (const s of [1, 2]) {
    const frets = []; for (let f = 1; f <= 12; f++) if (em.includes(mod12(OPEN[s] + f))) frets.push(f);
    frets.slice(0, 7).forEach(f => { notes.push(N(s, f, t, 0.25), N(s, 0, t + 0.25, 0.25, 'p'), N(s, f, t + 0.5, 0.25, 'h'), N(s, 0, t + 0.75, 0.25, 'p')); t += 1; });
    notes.push(N(s, 12, t, 1)); t += 1;
  }
  return make(c, {
    id: 'evh-open-pulloffs', name: 'Pull-offs to the open string (E minor)', domain: 'fretting', unit: '16th notes', goal: 120, start: 60, minutes: 4,
    why: 'Pulling off to an open string is the fastest legato there is: one finger walks up the scale while the open E keeps the line moving, a sound all over early Van Halen.',
    instr: 'Pick the fretted note, pull off to the open string, hammer back on, pull off again: four 16ths per fret. Walk up E natural minor on string 1, then string 2.',
    watch: 'The open string getting quieter than the fretted note.', simplify: '8th notes, the first three frets.', tab: { notes }
  });
}

export default entry({
  id: 'openPulls', kind: 'technique', title: 'Open-string pull-offs', domain: 'fretting',
  re: /open.?string (pull|legato)|pull.?offs? to (the )?open/,
  summary: 'Legato against the open string.',
  stages: [
    stage('intermediate', 'Open-string pull-offs', 'Play every lesson of this stage clean at its goal tempo.', [
      S('open-pulls', 'Pull-offs to the open string', 'fretting', 'One finger walks the scale; the open string keeps the line moving.', [c => evhOpenPulloffs(c)])
    ], [4, 6])
  ]
});
