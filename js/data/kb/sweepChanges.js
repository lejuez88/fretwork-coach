// Sweeps through chord changes: Three- and five-string sweeps that change shape with every chord of a progression.
// A learning path in stages (see CONTENT.md). Generators build original exercises in any key and level.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID } from '../lib.js';

/** Sweeps through the chords of a key: 3-string shapes, or 5-string shapes from the A string. */
export function sweepChanges(c, { strings = 3, fast: fastOpt = null } = {}) {
  const lvl = c.lvl || 4, chords = keyChords(c);
  const notes = [], used = [], voicings = []; let t = 0, near = 7;
  if (strings === 5) {
    for (const nm of chords) {
      const ch = chordInfo(nm); if (!ch) return null;
      let plan = null;
      const roots = []; for (let f = 3; f <= 15; f++) if (mod12(OPEN[5] + f) === ch.pc) roots.push(f);
      roots.sort((a, b) => Math.abs(a - near) - Math.abs(b - near));
      for (const r of roots) {
        const tones = []; for (let m = OPEN[5] + r; tones.length < 7; m++) if (ch.pcs.includes(mod12(m))) tones.push(m);
        const p = [[5, 0], [5, 1], [4, 2], [3, 3], [2, 4], [1, 5], [1, 6]].map(([s, i]) => [s, tones[i] - OPEN[s]]);
        const fs = p.map(x => x[1]);
        if (Math.min(...fs) >= 1 && Math.max(...fs) <= 20 && Math.max(...fs) - Math.min(...fs) <= 5) { plan = p; near = r; break; }
      }
      if (!plan) return null;
      const up = plan.map(([s, f], i) => [s, f, i === 1 || i === 6 ? 'h' : null]);
      const down = [[1, plan[5][1], 'p'], [2, plan[4][1]], [3, plan[3][1]], [4, plan[2][1]], [5, plan[1][1]]];
      for (let r = 0; r < 2; r++) [...up, ...down].forEach(([s, f, x]) => { notes.push(N(s, f, t, 1 / 6, x)); t += 1 / 6; });
      used.push(ch.name);
      const frets = [null, null, null, null, null, null]; plan.forEach(([s, f], i) => { if (i !== 1 && i !== 6) frets[6 - s] = f; });
      voicings.push({ name: ch.name, frets });
    }
  } else {
    const fast = fastOpt == null ? lvl >= 7 : fastOpt, step = fast ? 1 / 6 : 1 / 3, reps = fast ? 4 : 2;
    for (const nm of chords) {
      const tr = topTriad(nm, near); if (!tr) return null; near = (tr[1] + tr[2] + tr[3]) / 3;
      const top = nextToneUp(nm, 1, tr[1]); if (top == null) return null;
      const cell = [[3, tr[3]], [2, tr[2]], [1, tr[1]], [1, top, 'h'], [1, tr[1], 'p'], [2, tr[2]]];
      for (let r = 0; r < reps; r++) cell.forEach(([s, f, x]) => { notes.push(N(s, f, t, step, x)); t += step; });
      used.push(tr.name); voicings.push({ name: tr.name, frets: [null, null, null, tr[3], tr[2], tr[1]] });
    }
  }
  const five = strings === 5, fast = five || (fastOpt == null ? lvl >= 7 : fastOpt);
  return make(c, {
    id: `sweep-changes-${strings}${!five && fast ? '-fast' : ''}`, name: `${strings}-string sweeps${!five && fast ? ' in sextuplets' : ''} through ${used.join(' – ')}`, domain: 'picking',
    unit: fast ? '16th-note sextuplets' : '8th-note triplets', goal: five ? 76 : fast ? 80 : 108, start: five ? 40 : fast ? 42 : 50, minutes: 6, dl: five ? 3 : 2, picking: 'economy',
    why: 'Sweeping one shape is a trick; sweeping through chord changes is music. Each bar is a new chord, so you must see the next shape before you get there and keep the pick flowing through the change, the way shred and neoclassical players outline a progression.',
    instr: five ? 'Each chord: root on the A string, hammer to the next chord tone, one push of the pick through strings 4, 3, 2 and 1, hammer on the top note, then pull off and pull the pick back up through the strings. Twice per chord, one chord per bar. Mute behind the sweep with the fretting fingers’ undersides and the picking palm. Pass: each chord clean twice at the goal tempo, with no notes ringing together.'
      : `Each chord: one downward push through the G, B and e strings, hammer to the next chord tone on the e string, pull off, then upstroke on the B string; ${fast ? 'four' : 'two'} times per chord, one chord per bar. Roll the fingertip when two notes share a fret. Pass: the changes land on beat 1 with no gap.`,
    watch: 'The sweep turning into a strum because fretted notes stay down; and a hesitation at each chord change.', simplify: five ? 'The 3-string version of the same changes.' : 'One chord at a time, picking each note separately.',
    voicings, chords: used, backing: used, tab: { notes }
  });
}

export default entry({
  id: 'sweepChanges', kind: 'technique', title: 'Sweeps through chord changes', domain: 'picking',
  re: /sweep(s|ing)? (through|over|across) (a |the )?(chord )?(changes|progression)|sweep(s|ing)? (with|on) chord changes|progression sweeps?/,
  summary: 'Three- and five-string sweeps that change shape with every chord of a progression.',
  stages: [
    stage('advanced', 'Sweeps through chord changes', 'Play every lesson of this stage clean at its goal tempo.', [
      S('sweep-changes-3', 'Three-string sweeps through changes', 'picking', 'Triad sweeps on the top strings, one chord per bar.', [c => sweepChanges(c, { strings: 3, fast: false }), c => sweepChanges(c, { strings: 3, fast: true })]),
      S('sweep-changes-5', 'Five-string sweeps through changes', 'picking', 'A-string shapes for each chord.', [c => sweepChanges(c, { strings: 5 })])
    ], [7, 8])
  ]
});
