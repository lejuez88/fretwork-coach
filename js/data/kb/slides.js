// Slides: Legato and shift slides that connect notes and move the hand to a new position.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** Slides between pentatonic boxes 1 and 2 on the top three strings. */
export function slideBoxes(c) {
  const key = minorKey(c), B1 = byString(pentBox(key, 1)), B2 = byString(pentBox(key, 2));
  if ([1, 2, 3].some(s => !B1[s] || !B2[s] || B2[s][1] <= B1[s][1])) return null;
  const notes = []; let t = 0;
  for (const s of [3, 2, 1]) { // up: shift up into box 2 and back
    const [lo, hi] = B1[s], top = B2[s][1];
    [[lo, 0.5], [hi, 0.5], [top, 1, '/'], [hi, 1, '\\'], [lo, 1]].forEach(([f, d, x]) => { notes.push(N(s, f, t, d, x)); t += d; });
  }
  for (const s of [1, 2, 3]) { // down: start in box 2, slide down, climb back with a slide
    const [lo, hi] = B1[s], top = B2[s][1];
    [[top, 1], [hi, 1, '\\'], [lo, 1], [hi, 1, '/']].forEach(([f, d, x]) => { notes.push(N(s, f, t, d, x)); t += d; });
  }
  const k = nameOf(key);
  return make(c, {
    id: 'slides-box1-2', name: `Slides between boxes 1 and 2 (${k} minor pentatonic, top strings)`, domain: 'fretting', unit: '8th notes', goal: 100, start: 56, minutes: 5, dl: -1,
    why: 'A slide joins two notes with one pick stroke and moves the hand to a new position at the same time: it is how players connect pentatonic boxes and make a line sing instead of stepping note to note.',
    instr: `Bars 1–3: on the G, B and high e strings, play the two box-1 notes, then slide the ring finger up to the box-2 note (/) without picking again, slide back (\\) and pick the low note. Bars 4–6 come down from box 2. Keep pressure on the string the whole way so the note never dies, and arrive exactly on the beat. Pass: every slide lands in tune and on time.`,
    watch: 'Easing off the string during the slide (the note fades) or overshooting the target fret.', simplify: 'Pick the target note again when you arrive (a shift slide) at half tempo.', tab: { notes }
  });
}
/** The minor pentatonic along one string, joined by slides: horizontal playing. */
export function slideOneString(c, { string = 2 } = {}) {
  const key = minorKey(c), pcs = [0, 3, 5, 7, 10].map(x => mod12(key + x));
  const frets = []; for (let f = 1; f <= 17; f++) if (pcs.includes(mod12(OPEN[string] + f))) frets.push(f);
  const up = frets.slice(0, 8); if (up.length < 6) return null;
  const fast = (c.lvl || 4) >= 5, step = fast ? 0.5 : 1;
  const seq = [...up.map((f, i) => [string, f, i % 2 ? '/' : null]), ...up.slice().reverse().map((f, i) => [string, f, i % 2 ? '\\' : null])];
  const k = nameOf(key);
  return make(c, {
    id: `slides-one-string-${string}`, name: `${k} minor pentatonic along the ${string === 2 ? 'B' : string === 3 ? 'G' : 'high e'} string, with slides`, domain: 'fretboard',
    unit: fast ? '8th notes' : 'quarter notes', goal: fast ? 84 : 96, start: 50, minutes: 5, dl: -1,
    why: 'Playing a scale up one string shows how the boxes connect horizontally and trains the slide as a way to change position. You hear the notes of the scale as distances on a single string.',
    instr: `Start at fret ${up[0]}. Pick a note, slide (/) to the next scale note with the same finger, pick the next, slide again, all the way up to fret ${up[up.length - 1]}; then come back down the same way (\\). Say the scale degree of each note you land on (R, ♭3, 4, 5, ♭7). Pass: two clean trips with every slide landing on the beat.`,
    watch: 'Looking at the fretboard so long that the slide arrives late.', simplify: 'Pick every note, no slides, until the frets are memorized.', tab: { notes: fromSeq(seq, step) }
  });
}

export default entry({
  id: 'slides', kind: 'technique', title: 'Slides', domain: 'fretting',
  re: /\bslid(es?|ing)\b(?! guitar)|legato slides?|shift slides?/,
  summary: 'Legato and shift slides that connect notes and move the hand to a new position.',
  stages: [
    stage('foundations', 'Slides', 'Play every lesson of this stage clean at its goal tempo.', [
      S('slides-boxes', 'Sliding between boxes', 'fretting', 'Slides joining pentatonic boxes 1 and 2.', [c => slideBoxes(c)]),
      S('slides-one-string', 'One-string scales with slides', 'fretboard', 'The scale along a single string.', [c => slideOneString(c, { string: 2 }), c => slideOneString(c, { string: 3 })])
    ], [2, 3])
  ]
});
