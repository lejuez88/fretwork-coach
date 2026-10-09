// Spread triads: Root, 5th and 10th on non-adjacent strings: shapes, the chords of a key, and progressions.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** Spread triads, major and minor, on three string sets. */
export function ejSpreadShapes(c, { root = null } = {}) {
  const pc = root != null ? root : (c.minor ? mod12(c.key) : mod12(c.key));
  const plan = [[6, 'maj', 5], [6, 'min', 5], [5, 'maj', 10], [5, 'min', 10], [4, 'maj', 7], [4, 'min', 7]];
  const notes = [], voicings = [], chords = [];
  plan.forEach(([set, type, near], i) => {
    const v = spreadVoicing(pc, type, set, near); if (!v) return;
    spreadBar(v, i * 4, notes);
    const nm = spreadName(pc, type); voicings.push({ name: nm, frets: v.frets }); chords.push(nm);
  });
  return make(c, {
    id: 'ej-spread-shapes', name: `Spread triads: ${nameOf(pc)} and ${nameOf(pc)}m on three string sets`, domain: 'fretboard', unit: '8th notes', goal: 100, start: 50, minutes: 5,
    why: 'A spread (open) triad puts the root, 5th and the 3rd an octave up (the 10th) on non-adjacent strings. It’s the wide, piano-like chord sound in Eric Johnson’s clean parts and melodies.',
    instr: 'Each bar: root, 5th, 10th, 5th as 8th notes, then pinch all three together for two beats. Strings in between stay muted by the fretting fingers. The only difference between major and minor is the top note: one fret lower for minor. Use the pick on the root and the middle and ring fingers on the upper notes (hybrid picking), or fingers only.',
    watch: 'The muted middle string ringing through.', simplify: 'Only the string-5 shapes.', voicings, chords, tab: { notes }
  });
}
/** Spread triads through a progression with the closest shape each time. */
export function ejSpreadProgression(c, { key = 9, degrees = [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] } = {}) {
  const notes = [], voicings = [], chords = [];
  let near = 5;
  degrees.forEach(([semi, type], bar) => {
    const pc = mod12(key + semi);
    const cands = [6, 5].map(set => spreadVoicing(pc, type, set, near)).filter(Boolean).filter(v => v.fret >= 1 && v.fret <= 12);
    const v = cands.sort((a, b) => Math.abs(a.fret - near) - Math.abs(b.fret - near))[0]; if (!v) return;
    near = v.fret;
    spreadBar(v, bar * 4, notes);
    const nm = spreadName(pc, type); voicings.push({ name: nm, frets: v.frets }); chords.push(nm);
  });
  return make(c, {
    id: 'ej-spread-prog', name: `Spread triads through ${chords.join(' – ')}`, domain: 'theory', unit: '8th notes', goal: 96, start: 50, minutes: 6,
    why: 'Moving spread triads between the string-6 and string-5 sets keeps the hand in one area of the neck, so the chords connect smoothly instead of jumping.',
    instr: 'One chord per bar: arpeggiate root–5th–10th–5th, then pinch the three notes. For each chord take the shape closest to the last one (the diagrams show which). Let the notes ring over each other in the arpeggio.',
    watch: 'Moving the whole hand when the next shape is one string set over.', simplify: 'Two chords only, looped.', voicings, chords, backing: chords, tab: { notes }
  });
}
/** The chords of a major key as spread triads, climbing string set 5-4-2. */
export function ejSpreadDiatonic(c, { key = 9 } = {}) {
  const deg = [[0, 'maj'], [2, 'min'], [4, 'min'], [5, 'maj'], [7, 'maj'], [9, 'min'], [12, 'maj']];
  const notes = [], voicings = [], chords = [];
  let t = 0;
  const base = fretOn(5, key, 0, 11);
  deg.forEach(([semi, type]) => {
    const pc = mod12(key + semi), v = spreadVoicing(pc, type, 5, base + semi); if (!v) return;
    const [r, five, ten] = v.tones;
    [r, five, ten, five].forEach(([s, f], i) => notes.push(N(s, f, t + i * 0.5, 0.5)));
    t += 2;
    const nm = spreadName(pc, type); voicings.push({ name: nm, frets: v.frets }); chords.push(nm);
  });
  const last = voicings.length ? spreadVoicing(key, 'maj', 5, base + 12) : null;
  if (last) last.tones.forEach(([s, f]) => notes.push(N(s, f, t, 2, null, { chord: true })));
  return make(c, {
    id: 'ej-spread-diatonic', name: `The chords of ${nameOf(key)} major as spread triads`, domain: 'theory', unit: '8th notes', goal: 104, start: 52, minutes: 5,
    why: 'Harmonizing the major scale in spread triads shows which chords live in the key and gives you a ready-made chord melody: the top notes spell out the scale.',
    instr: `I, ii, iii, IV, V and vi of ${nameOf(key)} major, then I an octave up, all on strings 5, 4 and 2. Two beats each: root, 5th, 10th, 5th. Say the chord name as you play it. Major shapes have the top note two frets above the root fret; minor shapes one fret.`,
    watch: 'Forgetting which chords are minor (ii, iii, vi).', simplify: 'I, IV and V only.', voicings, chords, tab: { notes }
  });
}

export default entry({
  id: 'spreadTriads', kind: 'technique', title: 'Spread triads', domain: 'theory',
  re: /spread(-| )?triads?|open(-| )?(voiced )?triads?|wide triads?|spread voicings?|10ths?\b|tenths/,
  summary: 'Root, 5th and 10th on non-adjacent strings: shapes, the chords of a key, and progressions.',
  stages: [
    stage('intermediate', 'Spread triads', 'Play every lesson of this stage clean at its goal tempo.', [
      S('spread-shapes', 'Spread triad shapes', 'fretboard', 'Major and minor on three string sets.', [c => ejSpreadShapes(c, { root: 9 })]),
      S('spread-use', 'Spread triads in a key', 'theory', 'Diatonic chords and a progression in spread voicings.', [c => ejSpreadDiatonic(c, { key: 9 }), c => ejSpreadProgression(c, { key: 9 })])
    ], [4, 6])
  ]
});
