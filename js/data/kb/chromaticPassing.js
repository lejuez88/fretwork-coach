// Chromatic passing tones and approach notes: notes from outside the scale that lead into notes
// inside it, the sound of bebop, fusion and players like Guthrie Govan and Greg Howe.
//
// Concept-first (CONTENT.md): the model is a scale (Dorian by default, the minor mode of fusion and
// funk) with its chord tones, and one rhythmic rule: scale or chord tones sit on the beat, chromatic
// notes sit off the beat and move by a half step into the next target. From that come single
// approaches (from below, from above), passing tones that fill a whole step, enclosures (scale step
// above, half step below, target), the bebop scale (an added passing tone that keeps chord tones on
// the beat), lines over the changes and side-stepping a phrase a half step out and back.
import { OPEN, N, nameOf, minorKey, make, mod12, SCALE_BY_ID, chordInfo, pentBox, S, stage, entry, M } from '../lib.js';
import { position } from './economyPicking.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const pcsOf = (k, scale) => SCALE_BY_ID[scale].steps.map(x => mod12(k + x));
export const inScale = (k, scale, p) => pcsOf(k, scale).includes(mod12(p));
/** Chord tones of the Dorian vamp: i m7 (R ♭3 5 ♭7) and IV9 (4 6 R ♭3 5). */
export const vampChords = k => [nameOf(k) + 'm7', nameOf(k + 5) + '9'];
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes']]);
/** A playable place for a pitch: the string whose fret is closest to `near` (frets 0–20). */
export function place(p, near = 7) {
  let best = null;
  for (const s of [6, 5, 4, 3, 2, 1]) { const f = p - OPEN[s]; if (f < 0 || f > 20) continue; const d = Math.abs(f - near) + (f === 0 ? 2 : 0); if (!best || d < best.d) best = { s, f, d }; }
  return best ? [best.s, best.f] : null;
}
/** Pitches of a scale between lo and hi (inclusive), ascending. */
const scalePitches = (k, scale, lo, hi) => { const out = []; for (let p = lo; p <= hi; p++) if (inScale(k, scale, p)) out.push(p); return out; };
/** Pitches of chord tones (pcs) between lo and hi. */
const tonePitches = (pcs, lo, hi) => { const out = []; for (let p = lo; p <= hi; p++) if (pcs.includes(mod12(p))) out.push(p); return out; };
/** The range of a Dorian position near the root on the low E string, as [lowest, highest] pitch. */
function rangeOf(k) { const pos = position(k, 'dorian', 1); if (!pos) return null; const ps = pos.map(([s, f]) => pitch(s, f)); return [Math.min(...ps), Math.max(...ps)]; }
/** Turn timed pitches [[p, t, d, x?], …] into tab notes, each placed near the last. */
function toNotes(seq, near0 = 7) {
  const notes = []; let near = near0;
  for (const [p, t, d, x] of seq) { const at = place(p, near); if (!at) return null; notes.push(N(at[0], at[1], t, d, x || null)); near = (near * 2 + at[1]) / 3; }
  return notes;
}
const nearOf = k => { const pos = position(k, 'dorian', 1); return pos ? pos[0][1] + 2 : 7; };

/* ------------------------- Foundations: generators ------------------------- */
/** Each chord tone of i m7 in the position, approached from a half step below (or above), off the beat (chunking / hear it first). */
export function approach(c, { from = 'below' } = {}) {
  const k = minorKey(c), r = rangeOf(k); if (!r) return null;
  const tones = tonePitches(chordInfo(nameOf(k) + 'm7').pcs, r[0] + 1, r[1] - 1).slice(0, 8);
  const seq = []; let t = 0;
  const lvl = c.lvl || 2, gap = lvl <= 1 ? 2 : 1;   // a target every 2 beats at level 1, every beat later
  tones.forEach(p => { seq.push([p + (from === 'below' ? -1 : 1), t + gap - 0.5, 0.5], [p, t + gap, gap === 2 ? 1.5 : 0.5]); t += gap; });
  const notes = toNotes(seq, nearOf(k)); if (!notes) return null;
  const below = from === 'below';
  return make(c, {
    id: below ? 'chromatic-below' : 'chromatic-above', name: `Chord tones of ${nameOf(k)}m7, each approached from a half step ${from}`, domain: 'improv', method: below ? 'chunking' : 'audiation',
    unit: gap === 2 ? 'one target every 2 beats' : 'one target per beat', goal: 90, minutes: 4, backing: [nameOf(k) + 'm7'],
    why: below ? 'A note a half step below a chord tone pulls up into it like a magnet. Played off the beat and resolved on the beat, it sounds deliberate and sophisticated instead of wrong: the first chromatic sound to own.'
      : 'From above, the half step falls into the target with a darker, bluesier pull. Singing the target first makes sure your ear, not your fingers, decides where the line is going.',
    instr: below ? `The targets are the root, ♭3, 5 and ♭7 of ${nameOf(k)}m7, low to high. Each one is preceded by the fret just below it, played on the “and” before the beat; the target lands on the beat. Say the target’s name (R, ♭3, 5, ♭7) as you land. Pass: every target in time with the approach short and the target held, twice through.`
      : `Before each pair, sing the target note (play it once first if you need to). Then play the fret above it on the “and” and fall into the target on the beat. Pass: 8 targets where the note you sang matches the note you landed on.`,
    watch: 'Putting the chromatic note on the beat: it belongs on the “and”, the target on the beat.', simplify: 'Only the roots and 5ths.', tab: { notes }
  });
}
/**
 * Scale tones on the beat; when two neighbours are a whole step apart, the chromatic note between
 * them fills the “and”; a half step gets a quarter note. where: 'string' (one string) or 'position'.
 */
export function passing(c, { where = 'string', scale = 'dorian' } = {}) {
  const k = minorKey(c); let ps;
  let str = 3;
  if (where === 'string') { if (mod12(k - OPEN[3]) > 8) str = 4; const s = str, f0 = mod12(k - OPEN[s]); ps = scalePitches(k, scale, OPEN[s] + f0, OPEN[s] + f0 + 12).map(p => [s, p - OPEN[s]]); }
  else { const pos = position(k, scale, 1); if (!pos) return null; ps = pos.slice(3, 15); }
  const seq = [...ps, ...ps.slice(0, -1).reverse()], notes = []; let t = 0;
  for (let i = 0; i < seq.length; i++) {
    const [s, f] = seq[i], nx = seq[i + 1];
    if (!nx) { notes.push(N(s, f, t, 2)); t += 2; break; }
    const gap = pitch(...nx) - pitch(s, f);
    if (Math.abs(gap) === 2) {
      notes.push(N(s, f, t, 0.5));
      const mid = pitch(s, f) + gap / 2, onSame = nx[0] === s ? [s, f + gap / 2] : (mid - OPEN[s] >= 0 && Math.abs(mid - OPEN[s] - f) <= 2 ? [s, mid - OPEN[s]] : [nx[0], mid - OPEN[nx[0]]]);
      if (onSame[1] < 0) return null;
      notes.push(N(onSame[0], onSame[1], t + 0.5, 0.5)); t += 1;
    } else { notes.push(N(s, f, t, 1)); t += 1; }
  }
  const one = where === 'string';
  return make(c, {
    id: one ? 'chromatic-passing-string' : 'chromatic-passing-position', name: one ? `Passing tones along the ${str === 3 ? 'G' : 'D'} string (${nameOf(k)} Dorian)` : `Passing tones through one ${nameOf(k)} Dorian position`, domain: 'improv', method: one ? 'accurate-reps' : 'retrieval',
    unit: '8th notes', goal: 100, minutes: 5,
    why: one ? 'Between two scale notes a whole step apart there is one fret: the passing tone. Filling those gaps on the “and” and leaving half steps alone keeps every scale note on the beat, which is why the line sounds smooth rather than random.'
      : 'Across strings the gaps are harder to see. Knowing where the whole steps are in a position, without the tab, is what lets you add passing tones while improvising.',
    instr: one ? `Up the ${str === 3 ? 'G' : 'D'} string from the root to the octave and back. A whole step gets two 8ths (the scale note on the beat, the passing fret on the “and”); a half step gets one quarter note. Pass: up and down twice with every scale note exactly on the beat.`
      : 'Before each string, say whether its gaps are whole or half steps, then play: scale notes on the beat, a passing note in every whole step, quarter notes on half steps. Cover the tab after the first pass. Pass: up and down from memory, twice.',
    watch: 'Playing every fret in a row (a chromatic scale): only whole steps get a passing note.', simplify: 'Ascending only.', tab: { notes }
  });
}

/* ------------------------ Intermediate: generators ------------------------ */
/** Enclosures: scale step above (on the beat), half step below (off the beat), target (on the beat); or two chromatic notes as triplets. */
export function enclose(c, { kind = 'scale' } = {}) {
  const k = minorKey(c), r = rangeOf(k); if (!r) return null;
  const tones = tonePitches(chordInfo(nameOf(k) + 'm7').pcs, r[0] + 2, r[1] - 2).slice(0, 7);
  const seq = []; let t = 0;
  for (const p of tones) {
    if (kind === 'scale') { let up = p + 1; while (!inScale(k, 'dorian', up)) up++; seq.push([up, t, 0.5], [p - 1, t + 0.5, 0.5], [p, t + 1, 1]); t += 2; }
    else { seq.push([p + 1, t + 1 / 3, 1 / 3], [p - 1, t + 2 / 3, 1 / 3], [p, t + 1, 1]); t += 2; }
  }
  // second pass descends: reverse the order of targets
  const back = []; let t2 = t;
  for (const p of tones.slice().reverse()) {
    if (kind === 'scale') { let up = p + 1; while (!inScale(k, 'dorian', up)) up++; back.push([up, t2, 0.5], [p - 1, t2 + 0.5, 0.5], [p, t2 + 1, 1]); }
    else back.push([p + 1, t2 + 1 / 3, 1 / 3], [p - 1, t2 + 2 / 3, 1 / 3], [p, t2 + 1, 1]);
    t2 += 2;
  }
  const notes = toNotes([...seq, ...back], nearOf(k)); if (!notes) return null;
  const sc = kind === 'scale';
  return make(c, {
    id: sc ? 'chromatic-enclosure' : 'chromatic-enclosure-double', name: sc ? `Enclosures: scale step above, half step below, target (${nameOf(k)}m7)` : `Chromatic enclosures: half step above, half step below, target (${nameOf(k)}m7)`, domain: 'improv', method: 'variable',
    unit: sc ? '8th notes' : '8th-note triplets', goal: sc ? 104 : 92, minutes: 5, dl: sc ? 0 : 1, backing: [nameOf(k) + 'm7'],
    why: sc ? 'An enclosure surrounds the target before landing on it: the scale note above, then the half step below. The ear hears the target coming from both sides, so the landing sounds inevitable. It is the most used figure in bebop and fusion lines.'
      : 'With both surrounding notes chromatic, the enclosure becomes tighter and more “outside”, but the triplet rhythm still puts the target squarely on the beat.',
    instr: sc ? 'For each chord tone of the vamp chord, low to high and back: the scale note above it on the beat, the fret below it on the “and”, the target on the next beat, held. Pass: up and down twice with every target on the beat.'
      : 'Each target is preceded by a triplet: rest, the fret above, the fret below, then the target on the beat. Pass: up and down twice, the chromatic notes light and the targets strong.',
    watch: 'Rushing into the target: hold the rhythm, the enclosure does the work.', simplify: 'Targets on the root only.', tab: { notes }
  });
}
/** The bebop scale of the IV9 chord: Mixolydian plus a passing major 7th, so chord tones fall on every beat, descending (variable). */
export function bebopLine(c, { start = 'root' } = {}) {
  const k = minorKey(c), iv = mod12(k + 5), r = rangeOf(k); if (!r) return null;
  const bebop = [0, 2, 4, 5, 7, 9, 10, 11].map(x => mod12(iv + x));
  const startPc = start === 'root' ? iv : mod12(iv + 4);
  let top = Math.max(r[1] - 11, OPEN[6] + 26); while (mod12(top) !== startPc) top++;   // room for two octaves below
  const seq = []; let p = top, t = 0;
  for (let i = 0; i < 16; i++) { seq.push([p, t, 0.5]); t += 0.5; do { p--; } while (!bebop.includes(mod12(p))); }
  seq.push([p, t, 1.5]);
  const notes = toNotes(seq, nearOf(k) + 3); if (!notes) return null;
  return make(c, {
    id: start === 'root' ? 'chromatic-bebop-root' : 'chromatic-bebop-third', name: `The bebop scale over ${nameOf(iv)}9, down from the ${start === 'root' ? 'root' : '3rd'}`, domain: 'improv', method: 'variable',
    unit: '8th notes', goal: 112, minutes: 5, backing: [nameOf(iv) + '9'],
    why: 'A seven-note scale played in 8ths drifts off the beat: after one octave the chord tones land on the “and”. Adding one passing note (the major 7th, between the root and ♭7) makes it eight notes, so the root, 3rd, 5th and ♭7 always fall on the beat. This is the engine of bebop lines.',
    instr: `Descend in steady 8ths from the ${start === 'root' ? 'root' : '3rd'} of ${nameOf(iv)}9 for two octaves’ worth of notes. Check that a chord tone (R, 3, 5, ♭7) falls on every beat. Pass: the line twice in time, then start it from another chord tone yourself and check the beats again.`,
    watch: 'Skipping the added passing note and losing the beat alignment.', simplify: 'One octave only.', tab: { notes }
  });
}
/** Approach notes into the chord tones of a minor 7th chord, a new key every bar around the cycle of fourths (interleaving). */
export function approachKeys(c) {
  const k0 = minorKey(c), keys = [0, 5, 10, 3].map(x => mod12(k0 + x)), seq = []; let t = 0;
  const names = [];
  for (const k of keys) {
    const r = rangeOf(k); if (!r) return null;
    const tones = tonePitches(chordInfo(nameOf(k) + 'm7').pcs, r[0] + 3, r[1]).slice(0, 3);
    names.push(nameOf(k) + 'm7');
    tones.forEach((p, i) => seq.push([p + (i % 2 ? 1 : -1), t + i + 0.5, 0.5], [p, t + i + 1, i === 2 ? 1 : 0.5]));
    t += 4;
  }
  const notes = toNotes(seq, nearOf(k0)); if (!notes) return null;
  return make(c, {
    id: 'chromatic-approach-keys', name: `Approach notes in four keys: ${names.join(', ')}`, domain: 'improv', method: 'interleaving',
    unit: '8th notes', goal: 100, minutes: 5, dl: 1, chords: names, backing: names,
    why: 'Chromatic approaches are worked out from the target, not from a shape, so they should work in any key at once. Changing key every bar proves you hear the targets, not a memorized pattern.',
    instr: `${names.join(' → ')}: three chord tones per bar, alternating approach from below and from above, the last one held. Name each chord before its bar. Pass: all four bars without stopping, then with the tab covered.`,
    watch: 'Approaching from the wrong side when the direction alternates.', simplify: 'Approach from below only.', tab: { notes }
  });
}
/** A four-bar line over i m7 – IV9 that reaches the next chord’s tone on beat 1 through an approach or enclosure (use in music). */
export function vampLine(c, { mode = 'approach' } = {}) {
  const k = minorKey(c), r = rangeOf(k); if (!r) return null;
  const [ci, civ] = vampChords(k), chords = [ci, civ, ci, civ, ci];
  const seq = []; let cur = tonePitches(chordInfo(ci).pcs, r[0] + 5, r[1]).find(Boolean); if (cur == null) return null;
  for (let bar = 0; bar < 4; bar++) {
    const T = bar * 4, next = chordInfo(chords[bar + 1]).pcs;
    seq.push([cur, T, 1]);
    // pick the next target: a chord tone of the next chord 3–7 semitones away, alternating direction
    const dir = bar % 2 ? -1 : 1;
    let tgt = null; for (let d = 3; d <= 9 && tgt == null; d++) { const q = cur + dir * d; if (q > r[0] + 2 && q < r[1] - 2 && next.includes(mod12(q))) tgt = q; }
    if (tgt == null) for (let d = 3; d <= 9 && tgt == null; d++) { const q = cur - dir * d; if (q > r[0] + 2 && q < r[1] - 2 && next.includes(mod12(q))) tgt = q; }
    if (tgt == null) return null;
    // beats 2–3 and beat 4 on the scale, walking toward the target, then the approach figure
    const lead = mode === 'enclose' ? 2 : 1, slots = 6 - lead, up = tgt > cur ? 1 : -1;
    let above = tgt + 1; while (!inScale(k, 'dorian', above)) above++;
    const stop = up > 0 ? tgt - 1 : mode === 'enclose' ? above : tgt + 1;
    const inner = []; for (let q = cur + up; up > 0 ? q < stop : q > stop; q += up) if (inScale(k, 'dorian', q)) inner.push(q);
    let walk;
    if (inner.length >= slots) walk = inner.slice(inner.length - slots);
    else {
      // not enough room: turn away from the target first, then come back through the inner notes
      const extra = slots - inner.length, h = Math.ceil(extra / 2), away = []; let q = cur;
      while (away.length < h) { q -= up; if (inScale(k, 'dorian', q)) away.push(q); }
      const back = extra % 2 ? away.slice(0, h - 1).reverse() : [...away.slice(0, h - 1).reverse(), cur];
      walk = [...away, ...back, ...inner];
    }
    walk.forEach((q, i) => seq.push([q, T + 1 + i * 0.5, 0.5]));
    if (mode === 'enclose') { seq.push([above, T + 3, 0.5], [tgt - 1, T + 3.5, 0.5]); }
    else seq.push([tgt - up, T + 3.5, 0.5]);
    cur = tgt;
  }
  seq.push([cur, 16, 4, '~']);
  const notes = toNotes(seq, nearOf(k)); if (!notes) return null;
  const enc = mode === 'enclose';
  return make(c, {
    id: enc ? 'chromatic-vamp-enclose' : 'chromatic-vamp-approach', name: `${enc ? 'Enclosures' : 'Approach notes'} across the changes (${ci} – ${civ})`, domain: 'improv', method: 'transfer',
    unit: '8th notes', goal: enc ? 104 : 100, minutes: 6, dl: enc ? 1 : 0, backing: [ci, civ], chords: [ci, civ],
    why: 'In real lines, chromatic notes do one job: they deliver a chord tone of the next chord exactly on beat 1. That is what makes a line sound like it knows where the harmony is going.',
    instr: `Each bar starts on a chord tone, walks through the Dorian scale and ${enc ? 'encloses (scale note above, half step below)' : 'approaches by a half step'} the next chord’s tone, which lands on the next bar’s beat 1. Say the next chord name on beat 4. Then improvise your own bars with the same plan. Pass: the four bars written, then four bars of your own where every bar line lands on a chord tone.`,
    watch: 'Arriving early: the chromatic note is the last 8th of the bar, never earlier.', simplify: 'Play only beat 1 targets and the approach notes.', tab: { notes }
  });
}

/* ------------------------- Advanced: generators ------------------------- */
/** A pentatonic phrase, the same phrase a half step up (outside), then back in: tension and release (focus on the sound). */
export function sideStep(c) {
  const k = minorKey(c);
  const phrase = (key, t0) => { const n = pentBox(key, 1); if (!n) return null; const l = n.map(x => [x.s, x.f]).slice(5, 11); return [...l, l[3], l[2]].map(([s, f], i) => N(s, f, t0 + i * 0.5, i === 7 ? 0.5 : 0.5)); };
  const a = phrase(k, 0), b = phrase(mod12(k + 1), 4), r = phrase(k, 8); if (!a || !b || !r) return null;
  const n0 = pentBox(k, 1), root = n0.find(x => x.s === 4 && mod12(pitch(x.s, x.f) - k) === 0) || n0[0];
  const notes = [...a, ...b, ...r, N(root.s, root.f, 12, 4, '~')];
  return make(c, {
    id: 'chromatic-sidestep', name: `Side-stepping: ${nameOf(k)} minor pentatonic, a half step out and back`, domain: 'improv', method: 'external-focus',
    unit: '8th notes', goal: 104, minutes: 5, backing: [nameOf(k) + 'm7'],
    why: 'Playing a phrase a half step above the key creates strong tension; bringing it back resolves it. Used briefly and resolved clearly, it is the classic “outside” sound of fusion players: wrong on purpose, then right.',
    instr: `Bar 1: the phrase in ${nameOf(k)} minor pentatonic. Bar 2: the same shape one fret higher (${nameOf(k + 1)} minor pentatonic: outside). Bar 3: back in the key. Bar 4: land on the root. Listen to the clash in bar 2 and the relief in bar 3; play bar 2 with the same conviction. Pass: the four bars over the backing with a clear resolution, then side-step a phrase of your own.`,
    watch: 'Staying outside too long: one bar out, then resolve.', simplify: 'Bars 1 and 3 only, then add bar 2.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'chromaticPassing', kind: 'subject', title: 'Chromatic passing tones', domain: 'improv',
  re: /chromatic (passing|approach|notes?|lines?|enclosures?)|passing (tones?|notes?)|approach notes?|enclosures?|outside (playing|notes)|side.?stepping|bebop (scale|lines?)/,
  aliases: ['approach notes', 'enclosures', 'outside playing', 'bebop scale'],
  summary: 'Notes from outside the scale that lead into the notes inside it: approaches, passing tones, enclosures, the bebop scale and side-stepping, the sound of bebop and fusion lines.',
  prereqs: ['pentatonic'],
  ctx: { key: 9, minor: true, prog: 'dorianVamp' },
  stages: [
    stage('foundations', 'Half steps into chord tones',
      'Approach every chord tone of the vamp chord from a half step below and above with the chromatic note on the “and” and the target on the beat at 90 BPM, fill the whole steps of the Dorian scale with passing tones up and down a position from memory, and land on a chord tone at each change of a two-chord vamp.', [
        S('chromatic-approach', 'Approach notes', 'improv', 'A half step into a chord tone, off the beat into on the beat.', [c => approach(c, { from: 'below' }), c => approach(c, { from: 'above' })]),
        S('chromatic-passing', 'Passing tones', 'improv', 'Fill the whole steps, leave the half steps.', [c => passing(c, { where: 'string' }), c => passing(c, { where: 'position' })]),
        S('chromatic-first-music', 'First music', 'improv', 'Approach notes that follow the changes.', [c => vampLine(c, { mode: 'approach' }), M('transfer', ['targetSolo', { chords: '$dorianVamp', scale: 'dorian' }])])
      ], [1, 3]),
    stage('intermediate', 'Enclosures and the bebop scale',
      'Enclose every chord tone of the vamp chord with scale and chromatic enclosures, play the bebop scale over the IV9 chord with a chord tone on every beat at 110 BPM in 8ths, use approach notes in four keys without stopping, and improvise over i–IV landing on a chord tone at every bar line.', [
        S('chromatic-enclosures', 'Enclosures', 'improv', 'Surround the target, then land.', [c => enclose(c, { kind: 'scale' }), c => enclose(c, { kind: 'chromatic' })]),
        S('chromatic-bebop', 'The bebop scale and keys', 'improv', 'One added note keeps the chord tones on the beat.', [c => bebopLine(c, { start: 'root' }), c => bebopLine(c, { start: 'third' }), c => approachKeys(c)]),
        S('chromatic-changes', 'Over the changes', 'improv', 'Enclosures that deliver the next chord.', [c => vampLine(c, { mode: 'enclose' }), M('transfer', ['callResponse', { chords: '$dorianVamp', scale: 'dorian' }])])
      ], [4, 6]),
    stage('advanced', 'Outside and back',
      'Side-step a pentatonic phrase a half step out and resolve it in time, and solo over a funk vamp mixing approaches, enclosures and one side-step per chorus.', [
        S('chromatic-outside', 'Side-stepping', 'improv', 'Tension on purpose, then release.', [c => sideStep(c)]),
        S('chromatic-adv-music', 'Outside in a solo', 'improv', 'Approach notes and side-steps over a vamp.', [M('transfer', ['targetSolo', { chords: '$funk9', scale: 'dorian', name: 'Solo over a funk vamp: approaches, enclosures and one side-step' }])])
      ], [7, 8])
  ]
});
