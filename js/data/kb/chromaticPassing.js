// Chromatic passing tones and approach notes: notes from outside the scale that lead into notes
// inside it, the sound of bebop, fusion and players like Guthrie Govan and Greg Howe.
//
// Concept-first (CONTENT.md): the model is a scale (Dorian by default, the minor mode of fusion and
// funk) with its chord tones, and one rhythmic rule: scale or chord tones sit on the beat, chromatic
// notes sit off the beat and move by a half step into the next target. From that come single
// approaches (from below, from above), passing tones that fill a whole step, enclosures (scale step
// above, half step below, target), the bebop scale (an added passing tone that keeps chord tones on
// the beat), lines over the changes and side-stepping a phrase a half step out and back.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-17: approaches, passing tones,
// the beat-1 approach, enclosures (off- and on-beat set-ups), the bebop scale, lines over the changes,
// side-stepping and chromatic runs, then tempo and your own lines. Removed: naming targets aloud, singing
// the target, covering the tab and "from memory" versions (no source teaches them), and the ghosted
// approach lesson (no source read for it); added chromatic runs between chord tones (Ed Levy).
import { OPEN, N, nameOf, minorKey, make, mod12, SCALE_BY_ID, chordInfo, pentBox, byString, goalFor, S, stage, entry, M, targetGuide } from '../lib.js';
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
/** The nearest Dorian note above / below a pitch. */
const sAbove = (k, p) => { let q = p + 1; while (!inScale(k, 'dorian', q)) q++; return q; };
const sBelow = (k, p) => { let q = p - 1; while (!inScale(k, 'dorian', q)) q--; return q; };
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
    id: below ? 'chromatic-below' : 'chromatic-above', name: `Chord tones of ${nameOf(k)}m7, each approached from a half step ${from}`, domain: 'improv', method: 'accurate-reps',
    unit: gap === 2 ? 'one target every 2 beats' : 'one target per beat', goal: 90, minutes: 4, backing: [nameOf(k) + 'm7'],
    why: below ? 'A note a half step below a chord tone pulls up into it like a magnet. Played off the beat and resolved on the beat, it sounds deliberate and sophisticated instead of wrong: the first chromatic sound to own.'
      : 'From above, the half step falls into the target with a darker, bluesier pull. It is the same rule from the other side: the chromatic note off the beat, the chord tone on it.',
    instr: below ? `The targets are the root, ♭3, 5 and ♭7 of ${nameOf(k)}m7, low to high. Each one is preceded by the fret just below it, played on the “and” before the beat; the target lands on the beat. Pass: every target in time with the approach short and the target held, twice through.`
      : `The same targets, root, ♭3, 5 and ♭7 of ${nameOf(k)}m7, low to high. Each one is preceded by the fret just above it on the “and”, falling into the target on the beat. Pass: every target in time with the approach short and the target held, twice through.`,
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
    id: one ? 'chromatic-passing-string' : 'chromatic-passing-position', name: one ? `Passing tones along the ${str === 3 ? 'G' : 'D'} string (${nameOf(k)} Dorian)` : `Passing tones through one ${nameOf(k)} Dorian position`, domain: 'improv', method: 'accurate-reps',
    unit: '8th notes', goal: 100, minutes: 5,
    why: one ? 'Between two scale notes a whole step apart there is one fret: the passing tone. Filling those gaps on the “and” and leaving half steps alone keeps every scale note on the beat, which is why the line sounds smooth rather than random.'
      : 'Across strings the gaps are harder to see. Filling them through a whole position shows where the whole steps sit in the shape you improvise in.',
    instr: one ? `Up the ${str === 3 ? 'G' : 'D'} string from the root to the octave and back. A whole step gets two 8ths (the scale note on the beat, the passing fret on the “and”); a half step gets one quarter note. Pass: up and down twice with every scale note exactly on the beat.`
      : 'Up and down the position: scale notes on the beat, a passing note on the “and” in every whole step (on the same string or the next, whichever is closer), quarter notes on half steps. Pass: up and down twice with every scale note on the beat.',
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
    else if (kind === 'diatonic') { seq.push([sAbove(k, p), t, 0.5], [sBelow(k, p), t + 0.5, 0.5], [p, t + 1, 1]); t += 2; }
    else { seq.push([p + 1, t + 1 / 3, 1 / 3], [p - 1, t + 2 / 3, 1 / 3], [p, t + 1, 1]); t += 2; }
  }
  // second pass descends: reverse the order of targets
  const back = []; let t2 = t;
  for (const p of tones.slice().reverse()) {
    if (kind === 'scale') { let up = p + 1; while (!inScale(k, 'dorian', up)) up++; back.push([up, t2, 0.5], [p - 1, t2 + 0.5, 0.5], [p, t2 + 1, 1]); }
    else if (kind === 'diatonic') back.push([sAbove(k, p), t2, 0.5], [sBelow(k, p), t2 + 0.5, 0.5], [p, t2 + 1, 1]);
    else back.push([p + 1, t2 + 1 / 3, 1 / 3], [p - 1, t2 + 2 / 3, 1 / 3], [p, t2 + 1, 1]);
    t2 += 2;
  }
  const notes = toNotes([...seq, ...back], nearOf(k)); if (!notes) return null;
  const sc = kind === 'scale';
  if (kind === 'diatonic') return make(c, {
    id: 'chromatic-enclosure-diatonic', name: `Scale-note enclosures: the scale notes above and below each chord tone (${nameOf(k)}m7)`, domain: 'improv', method: 'accurate-reps',
    unit: '8th notes', goal: 104, minutes: 4, backing: [nameOf(k) + 'm7'],
    why: 'An enclosure does not need chromatic notes: the scale note above and the scale note below surround the target just as well, with an inside sound. Hearing it this way first shows that the figure, not the chromatic note, does the work.',
    instr: `For each chord tone of ${nameOf(k)}m7, low to high and back: the ${nameOf(k)} Dorian note above it on the beat, the Dorian note below it on the “and”, the target on the next beat, held. Pass: up and down twice with every target on the beat.`,
    watch: 'Landing the target off the beat.', simplify: 'Targets on the root only.', tab: { notes }
  });
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
  const startPc = start === 'root' ? iv : start === 'fifth' ? mod12(iv + 7) : mod12(iv + 4);
  let top = Math.max(r[1] - 11, OPEN[6] + 26); while (mod12(top) !== startPc) top++;   // room for two octaves below
  const seq = []; let p = top, t = 0;
  for (let i = 0; i < 16; i++) { seq.push([p, t, 0.5]); t += 0.5; do { p--; } while (!bebop.includes(mod12(p))); }
  seq.push([p, t, 1.5]);
  const notes = toNotes(seq, nearOf(k) + 3); if (!notes) return null;
  return make(c, {
    id: `chromatic-bebop-${start}`, name: `The bebop scale over ${nameOf(iv)}9, down from the ${{ root: 'root', third: '3rd', fifth: '5th' }[start]}`, domain: 'improv', method: 'variable',
    unit: '8th notes', goal: 112, minutes: 5, backing: [nameOf(iv) + '9'],
    why: 'A seven-note scale played in 8ths drifts off the beat: after one octave the chord tones land on the “and”. Adding one passing note (the major 7th, between the root and ♭7) makes it eight notes, so the root, 3rd, 5th and ♭7 always fall on the beat. This is the engine of bebop lines.',
    instr: `Descend in steady 8ths from the ${{ root: 'root', third: '3rd', fifth: '5th' }[start]} of ${nameOf(iv)}9 for two octaves’ worth of notes. Check that a chord tone (R, 3, 5, ♭7) falls on every beat. Pass: the line twice in time, then start it from another chord tone yourself and check the beats again.`,
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
    instr: `${names.join(' → ')}: three chord tones per bar, alternating approach from below and from above, the last one held. Pass: all four bars without stopping, twice.`,
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
    const encB = mode === 'enclose' || (mode === 'mixed' && bar % 2 === 1);
    const lead = encB ? 2 : 1, slots = 6 - lead, up = tgt > cur ? 1 : -1;
    let above = tgt + 1; while (!inScale(k, 'dorian', above)) above++;
    const stop = up > 0 ? tgt - 1 : encB ? above : tgt + 1;
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
    if (encB) { seq.push([above, T + 3, 0.5], [tgt - 1, T + 3.5, 0.5]); }
    else seq.push([tgt - up, T + 3.5, 0.5]);
    cur = tgt;
  }
  seq.push([cur, 16, 4, '~']);
  const notes = toNotes(seq, nearOf(k)); if (!notes) return null;
  const enc = mode === 'enclose', mixed = mode === 'mixed';
  if (mixed) return make(c, {
    id: 'chromatic-vamp-mixed', name: `Approach, then enclose: alternating bar by bar (${ci} – ${civ})`, domain: 'improv', method: 'variable',
    unit: '8th notes', goal: 104, minutes: 6, dl: 1, backing: [ci, civ], chords: [ci, civ],
    why: 'Real lines mix their devices: a single half-step approach into one chord, a full enclosure into the next. Alternating them keeps the ear guessing while every bar line still lands on a chord tone.',
    instr: 'Bars 1 and 3 end with a half-step approach into the next chord’s tone; bars 2 and 4 end with an enclosure (scale note above, half step below). Then improvise four bars with the same alternation. Pass: the four bars written, then four of your own where every bar line lands on a chord tone.',
    watch: 'Using the same device every bar out of habit.', simplify: 'Only beat-1 targets and the last two 8ths of each bar.', tab: { notes }
  });
  return make(c, {
    id: enc ? 'chromatic-vamp-enclose' : 'chromatic-vamp-approach', name: `${enc ? 'Enclosures' : 'Approach notes'} across the changes (${ci} – ${civ})`, domain: 'improv', method: 'transfer',
    unit: '8th notes', goal: enc ? 104 : 100, minutes: 6, dl: enc ? 1 : 0, backing: [ci, civ], chords: [ci, civ],
    why: 'In real lines, chromatic notes do one job: they deliver a chord tone of the next chord exactly on beat 1. That is what makes a line sound like it knows where the harmony is going.',
    instr: `Each bar starts on a chord tone, walks through the Dorian scale and ${enc ? 'encloses (scale note above, half step below)' : 'approaches by a half step'} the next chord’s tone, which lands on the next bar’s beat 1. Then improvise your own bars with the same plan. Pass: the four bars written, then four bars of your own where every bar line lands on a chord tone.`,
    watch: 'Arriving early: the chromatic note is the last 8th of the bar, never earlier.', simplify: 'Play only beat 1 targets and the approach notes.', tab: { notes }
  });
}

/* ------------------------- Advanced: generators ------------------------- */
/** A pentatonic phrase, the same phrase a half step up (outside), then back in: tension and release (focus on the sound). */
export function sideStep(c, { dir = 1 } = {}) {
  const k = minorKey(c), up = dir > 0;
  const phrase = (key, t0) => { const n = pentBox(key, 1); if (!n) return null; const l = n.map(x => [x.s, x.f]).slice(5, 11); return [...l, l[3], l[2]].map(([s, f], i) => N(s, f, t0 + i * 0.5, i === 7 ? 0.5 : 0.5)); };
  const a = phrase(k, 0), b = phrase(mod12(k + dir), 4), r = phrase(k, 8); if (!a || !b || !r) return null;
  const n0 = pentBox(k, 1), root = n0.find(x => x.s === 4 && mod12(pitch(x.s, x.f) - k) === 0) || n0[0];
  const notes = [...a, ...b, ...r, N(root.s, root.f, 12, 4, '~')];
  return make(c, {
    id: up ? 'chromatic-sidestep' : 'chromatic-sidestep-down', name: up ? `Side-stepping: ${nameOf(k)} minor pentatonic, a half step out and back` : `Side-stepping down: ${nameOf(k)} minor pentatonic, a half step below and back`, domain: 'improv', method: up ? 'external-focus' : 'variable',
    unit: '8th notes', goal: 104, minutes: 5, backing: [nameOf(k) + 'm7'],
    why: 'Playing a phrase a half step above the key creates strong tension; bringing it back resolves it. Used briefly and resolved clearly, it is the classic “outside” sound of fusion players: wrong on purpose, then right.',
    instr: `Bar 1: the phrase in ${nameOf(k)} minor pentatonic. Bar 2: the same shape one fret ${up ? 'higher' : 'lower'} (${nameOf(k + dir)} minor pentatonic: outside). Bar 3: back in the key. Bar 4: land on the root. Listen to the clash in bar 2 and the relief in bar 3; play bar 2 with the same conviction. Pass: the four bars over the backing with a clear resolution, then side-step a phrase of your own.`,
    watch: 'Staying outside too long: one bar out, then resolve.', simplify: 'Bars 1 and 3 only, then add bar 2.', tab: { notes }
  });
}


/* -------------------- Added for the reference standard -------------------- */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const PENT = [0, 3, 5, 7, 10];
/** A lesson built by another generator, renamed and retargeted (a new id, method and tempo goal). */
function as(gen, over) { return c => { const x = gen(c); if (!x) return null; const out = { ...x, id: over.id, name: over.name ? over.name(x) : x.name, method: over.method }; if (over.goal) { out.goalBpm = goalFor(c, over.goal); out.startBpm = Math.max(30, Math.min(Math.round(out.goalBpm * 0.6), out.goalBpm - 4)); } if (over.why) out.why = over.why; if (over.instr) out.instr = over.instr; return out; }; }
/** Box 1 of the minor pentatonic with a chromatic passing note in every whole step: the 3, the ♭5 and the 7. */
export function bluesPassing(c) {
  const k = minorKey(c), box = pentBox(k, 1); if (!box) return null;
  const list = box.map(x => [x.s, x.f]), seq = [...list, ...list.slice(0, -1).reverse()], notes = []; let t = 0;
  for (let i = 0; i < seq.length; i++) {
    const [s, f] = seq[i], nx = seq[i + 1];
    if (!nx) { notes.push(N(s, f, t, 2, '~')); break; }
    const gap = pitch(nx[0], nx[1]) - pitch(s, f);
    if (Math.abs(gap) === 2) {
      const mid = pitch(s, f) + gap / 2; let at = [s, mid - OPEN[s]];
      if (at[1] < 0 || Math.abs(at[1] - f) > 2) at = [nx[0], mid - OPEN[nx[0]]];
      if (at[1] < 0) return null;
      notes.push(N(s, f, t, 0.5), N(at[0], at[1], t + 0.5, 0.5)); t += 1;
    } else { notes.push(N(s, f, t, 1)); t += 1; }
  }
  return make(c, {
    id: 'chromatic-blues-box', name: `Passing tones in the blues box: ${nameOf(k)} minor pentatonic, box 1`, domain: 'improv', method: 'accurate-reps',
    unit: '8th notes', goal: 96, minutes: 5, backing: [nameOf(k) + 'm7'],
    why: 'The minor pentatonic has three whole steps (♭3 to 4, 4 to 5, ♭7 to the root). Filling each with its chromatic note gives the major 3rd, the blue ♭5 and the major 7th as passing tones: the first chromatic sounds most players use, and they sit inside a shape you already know.',
    instr: 'Up and down box 1: scale notes on the beat; where two neighbours are a whole step apart, the fret between them on the “and”; minor 3rds get a quarter note. Pass: up and down with every scale note on the beat, twice.',
    watch: 'Adding a passing note inside a minor 3rd (that makes two chromatic notes in a row).', simplify: 'Ascending only.', tab: { notes }
  });
}
/** Chord tones of IV9 (4, 6, R, ♭3) approached alternately from below and from above (variable). */
export function approachIV(c) {
  const k = minorKey(c), iv = nameOf(k + 5) + '9', r = rangeOf(k); if (!r) return null;
  const tones = tonePitches(chordInfo(iv).pcs, r[0] + 2, r[1] - 1).slice(0, 8), seq = []; let t = 0;
  tones.forEach((p, i) => { seq.push([p + (i % 2 ? 1 : -1), t + 0.5, 0.5], [p, t + 1, 1]); t += 2; });
  const notes = toNotes(seq, nearOf(k)); if (!notes) return null;
  return make(c, {
    id: 'chromatic-approach-iv', name: `Approach notes into ${iv}: below, above, below…`, domain: 'improv', method: 'accurate-reps',
    unit: 'one target every 2 beats', goal: 92, minutes: 4, backing: [iv],
    why: 'The second chord of the vamp has its own targets (its 3rd is the 6th of the key, the brightest note of Dorian). Approaching them alternately from below and above trains both directions on a new set of targets.',
    instr: `The targets are the chord tones of ${iv}, low to high. Each is approached by the fret below or above it on the “and”, alternating; the target lands on the beat and is held. Pass: up through all the targets twice with every approach a half step and every target on the beat.`,
    watch: 'Approaching from a whole step away.', simplify: 'Approach from below only.', tab: { notes }
  });
}
/** Approach notes played as ghost notes: barely heard, so the targets speak (focus on the sound). */
export function ghostApproach(c) {
  const k = minorKey(c), r = rangeOf(k); if (!r) return null;
  const tones = tonePitches(chordInfo(nameOf(k) + 'm7').pcs, r[0] + 1, r[1] - 1).slice(0, 8), seq = []; let t = 0;
  [...tones, ...tones.slice(0, -1).reverse()].forEach((p, i) => { seq.push([p - 1, t + 0.5, 0.5, 'ghost'], [p, t + 1, 0.5]); t += 1; });
  const notes = toNotes(seq, nearOf(k)); if (!notes) return null;
  return make(c, {
    id: 'chromatic-ghost', name: `Ghosted approaches: chromatic notes you feel more than hear (${nameOf(k)}m7)`, domain: 'improv', method: 'external-focus',
    unit: '8th notes', goal: 104, minutes: 4, backing: [nameOf(k) + 'm7'],
    why: 'Jazz and fusion players often play the chromatic note so lightly it is almost a ghost: the ear registers a slide into the target rather than a wrong note. Controlling that difference in volume is a sound skill, not a finger skill.',
    instr: 'Each chord tone is preceded by the fret below it on the “and”, played very softly (the tab shows it in brackets); the target on the beat is full volume. Listen for a line of chord tones with a faint lead-in. Pass: up and down twice where a listener would hear only the targets.',
    watch: 'Ghost notes as loud as the targets.', simplify: 'Leave the ghost note out, then add it back softly.', tab: { notes }
  });
}
/** Enclosures into the chord tones of IV9. */
export function encloseIV(c) {
  const k = minorKey(c), iv = nameOf(k + 5) + '9', r = rangeOf(k); if (!r) return null;
  const tones = tonePitches(chordInfo(iv).pcs, r[0] + 2, r[1] - 2).slice(0, 6), seq = []; let t = 0;
  for (const p of [...tones, ...tones.slice(0, -1).reverse()]) { let up = p + 1; while (!inScale(k, 'dorian', up)) up++; seq.push([up, t, 0.5], [p - 1, t + 0.5, 0.5], [p, t + 1, 1]); t += 2; }
  const notes = toNotes(seq, nearOf(k)); if (!notes) return null;
  return make(c, {
    id: 'chromatic-enclose-iv', name: `Enclosures into every chord tone of ${iv}`, domain: 'improv', method: 'accurate-reps',
    unit: '8th notes', goal: 100, minutes: 5, backing: [iv],
    why: 'An enclosure is worked out from its target: find the chord tone, then the scale note above and the fret below. The second chord of the vamp has different targets, so the same figure lands on new frets.',
    instr: `For each chord tone of ${iv}, low to high and back: the scale note above it on the beat, the fret below it on the “and”, the target on the next beat, held. Pass: up and back twice with every target on the beat.`,
    watch: 'Taking the chromatic note above instead of the scale note above.', simplify: 'Three targets only.', tab: { notes }
  });
}
/** Two chromatic notes from below (target −2, −1, target): the double approach (variable). */
export function doubleApproach(c) {
  const k = minorKey(c), r = rangeOf(k); if (!r) return null;
  const tones = tonePitches(chordInfo(nameOf(k) + 'm7').pcs, r[0] + 2, r[1] - 1).slice(0, 8), seq = []; let t = 0;
  tones.forEach(p => { seq.push([p - 2, t + 1 / 3, 1 / 3], [p - 1, t + 2 / 3, 1 / 3], [p, t + 1, 1]); t += 2; });
  const notes = toNotes(seq, nearOf(k)); if (!notes) return null;
  return make(c, {
    id: 'chromatic-double', name: `Double approaches: two half steps up into each chord tone of ${nameOf(k)}m7`, domain: 'improv', method: 'variable',
    unit: '8th-note triplets', goal: 96, minutes: 4, backing: [nameOf(k) + 'm7'],
    why: 'Two chromatic notes in a row climbing into a target make a longer, smoother pull. As triplets they fit before the beat, so the target still lands squarely on it.',
    instr: 'For each chord tone: the fret two below and the fret one below as the last two triplets of the beat before, then the target on the beat, held. Pass: all targets twice with the chromatic notes even and the targets on the beat.',
    watch: 'The first chromatic note landing on the beat.', simplify: 'Single approaches first.', tab: { notes }
  });
}
/** The bebop scale over IV9 in four keys around the cycle of fourths (interleaving). */
export function bebopKeys(c) {
  const k0 = minorKey(c), seq = [], names = []; let t = 0;
  for (const off of [0, 5, 10, 3]) {
    const k = mod12(k0 + off), iv = mod12(k + 5), r = rangeOf(k); if (!r) return null;
    const bebop = [0, 2, 4, 5, 7, 9, 10, 11].map(x => mod12(iv + x));
    let p = r[1] - 3; while (mod12(p) !== iv) p--;
    for (let i = 0; i < 8; i++) { seq.push([p, t, 0.5]); t += 0.5; do { p--; } while (!bebop.includes(mod12(p))); }
    names.push(nameOf(iv) + '9');
  }
  const notes = toNotes(seq, nearOf(k0) + 3); if (!notes) return null;
  return make(c, {
    id: 'chromatic-bebop-keys', name: `The bebop scale in four keys: ${names.join(', ')}`, domain: 'improv', method: 'interleaving',
    unit: '8th notes', goal: 104, minutes: 5, dl: 1, backing: names, chords: names,
    why: 'The bebop rule (one added passing note keeps the chord tones on the beat) is the same for every dominant chord. Changing key every bar proves you hear where the added note goes, not a memorised fingering.',
    instr: `${names.join(' → ')}: eight 8ths down from each chord’s root, one bar per chord. Check that a chord tone falls on every beat. Pass: all four bars without stopping, twice.`,
    watch: 'Forgetting the added major 7th in the new key.', simplify: 'Two keys.', tab: { notes }
  });
}
/** A different chord tone each bar, either chord of the vamp, enclosed so it lands on beat 4. */
export function targetsCalled(c) {
  const k = minorKey(c), rr = rng(887 + (c.lvl || 7)), r = rangeOf(k); if (!r) return null;
  const [ci, civ] = vampChords(k), labels = { [ci]: ['R', '♭3', '5', '♭7'], [civ]: ['R', '3', '5', '♭7', '9'] };
  const seq = [], names = [], chords = []; let t = 0;
  for (let bar = 0; bar < 8; bar++) {
    const nm = bar % 2 ? civ : ci, info = chordInfo(nm), j = Math.floor(rr() * Math.min(4, info.pcs.length));
    const pc = info.pcs[j]; let p = Math.round((r[0] + r[1]) / 2); while (mod12(p) !== pc) p++;
    let up = p + 1; while (!inScale(k, 'dorian', up)) up++;
    seq.push([up, t + 2, 0.5], [p - 1, t + 2.5, 0.5], [p, t + 3, 1]);
    names.push(`${nm}: ${labels[nm][j]}`); chords.push(nm); t += 4;
  }
  const notes = toNotes(seq, nearOf(k)); if (!notes) return null;
  return make(c, {
    id: 'chromatic-targets-called', name: 'A new target every bar: enclosing the chord tone each bar names', domain: 'improv', method: 'variable',
    unit: '8th notes', goal: 96, minutes: 5, dl: 1, backing: chords, chords,
    why: 'In a solo the target comes first: you choose “the 3rd of the next chord” and the enclosure follows. A different chord tone every bar, on either chord, makes the figure follow the target instead of a fixed fingering.',
    instr: `${names.join(' → ')}. Rest for two beats, then enclose the bar’s chord tone (scale note above on beat 3, fret below on the “and”) so it lands on beat 4 and is held. Then play the same bars choosing your own targets. Pass: all 8 bars in time, twice, with every target on beat 4.`,
    watch: 'Finding the target too late and rushing the enclosure.', simplify: 'Only roots and 5ths.', tab: { notes }
  });
}
/** Approach notes into a random minor-7th chord every bar (interleaving). */
export function approachRandom(c) {
  const k0 = minorKey(c), rr = rng(431 + (c.lvl || 9)), seq = [], names = []; let t = 0;
  for (let bar = 0; bar < 8; bar++) {
    const k = Math.floor(rr() * 12), r = rangeOf(k); if (!r) return null;
    const tones = tonePitches(chordInfo(nameOf(k) + 'm7').pcs, r[0] + 3, r[1]).slice(0, 3);
    tones.forEach((p, i) => seq.push([p + (i % 2 ? 1 : -1), t + i + 0.5, 0.5], [p, t + i + 1, i === 2 ? 1 : 0.5]));
    names.push(nameOf(k) + 'm7'); t += 4;
  }
  const notes = toNotes(seq, nearOf(k0)); if (!notes) return null;
  return make(c, {
    id: 'chromatic-random', name: 'Random access: approach notes into a new minor-7th chord every bar', domain: 'improv', method: 'interleaving',
    unit: '8th notes', goal: 104, minutes: 5, dl: 1, backing: names, chords: names,
    why: 'At mastery level chromatic approaches should work on any chord the instant you read it, with no pattern to lean on.',
    instr: `${names.join(' → ')}: three chord tones per bar, approached alternately from below and above, the last held. Pass: all 8 bars in time at the goal tempo.`,
    watch: 'Approaching from the wrong side when the chord is unfamiliar.', simplify: 'The first four bars.', tab: { notes }
  });
}
/** An original 8-bar study: enclosures across the changes, a side-step out and back, the landing (capstone). */
export function chromEtude(c) {
  const k = minorKey(c), cc = { ...c, key: k, minor: true }, a = vampLine(cc, { mode: 'mixed' }), sd = sideStep(cc), bb = bebopLine(cc, { start: 'root' });
  if (!a || !sd || !bb) return null;
  const notes = a.tab.notes.filter(n => n.t < 15.5).map(n => ({ ...n }));                      // bars 1–4: approach, enclose, approach, enclose
  const b0 = bb.tab.notes[0], ap = place(pitch(b0.s, b0.f) - 1, b0.f); if (!ap) return null;
  notes.push(N(ap[0], ap[1], 15.5, 0.5));                                                       // …and a half-step approach into bar 5
  bb.tab.notes.filter(n => n.t < 4).forEach(n => notes.push({ ...n, t: n.t + 16 }));            // bar 5: the bebop scale down over IV9
  sd.tab.notes.filter(n => n.t >= 4 && n.t < 12).forEach(n => notes.push({ ...n, t: n.t + 16 })); // bars 6–7: out a half step, then back in
  const n0 = pentBox(k, 1), root = n0.find(x => x.s === 4 && mod12(pitch(x.s, x.f) - k) === 0) || n0[0];
  notes.push(N(root.s, root.f, 28, 4, '~'));                                                    // bar 8: land
  const [ci, civ] = vampChords(k), chords = [ci, civ, ci, civ, civ, ci, ci, ci];
  return make(c, {
    id: 'chromatic-capstone-etude', name: `Capstone study: an 8-bar chromatic line (${ci} – ${civ})`, domain: 'improv', method: 'transfer',
    unit: '8th notes', goal: 100, minutes: 8, dl: 1, backing: chords, chords,
    why: 'An original piece that uses the whole path: approaches and enclosures delivering each new chord on beat 1, the bebop scale keeping chord tones on the beat, a deliberate half step outside, and a clear resolution.',
    instr: 'Learn it two bars at a time. Bars 1–4: approach and enclosure alternately into each bar line. Bar 5: the bebop scale down over the IV chord. Bars 6–7: the phrase a half step out, then back in. Bar 8: land on the root. Then write your own 8 bars to the same plan. Pass: the study at the goal tempo with no stops, then your own version once.',
    watch: 'Hesitating in the outside bar: commit to it, then resolve.', simplify: 'Bars 1–4.', tab: { notes }
  });
}

/** Chromatic runs down from chord tone to chord tone of i m7: every chord tone on a beat, the frets between them as 8ths. */
export function chromRun(c) {
  const k = minorKey(c), r = rangeOf(k); if (!r) return null;
  const tones = tonePitches(chordInfo(nameOf(k) + 'm7').pcs, r[0] + 1, r[1]).reverse().slice(0, (c.lvl || 4) >= 6 ? 7 : 5);
  if (tones.length < 3) return null;
  const seq = []; let t = 0;
  for (let i = 0; i < tones.length - 1; i++) {
    const a = tones[i], b = tones[i + 1], g = a - b;
    seq.push([a, t, g % 2 ? 1 : 0.5]); t += g % 2 ? 1 : 0.5;
    for (let q = a - 1; q > b; q--) { seq.push([q, t, 0.5]); t += 0.5; }
  }
  seq.push([tones[tones.length - 1], t, 2]);
  const notes = toNotes(seq, nearOf(k)); if (!notes) return null;
  return make(c, {
    id: 'chromatic-run-down', name: `Chromatic runs down through ${nameOf(k)}m7: chord tone to chord tone`, domain: 'improv', method: 'accurate-reps',
    unit: '8th notes', goal: 100, minutes: 4, backing: [nameOf(k) + 'm7'],
    why: 'Walking down by half steps from one chord tone to the next is the simplest way to sound “outside” without losing the harmony: the chord tones still arrive on the beat, and the frets between them are heard as motion.',
    instr: `Start on the top chord tone of ${nameOf(k)}m7 in the position and walk down fret by fret to the next chord tone below, then the next. Every chord tone (R, ♭3, 5, ♭7) falls on a beat; where the gap is an odd number of frets the chord tone is held for a quarter note first so the next one still lands on the beat. Pass: the run twice in time with every chord tone on a beat.`,
    watch: 'Speeding up through the chromatic frets so the chord tones land early.', simplify: 'Only the first two chord tones.', tab: { notes }
  });
}
const ST = (concept, why, theory) => ({ concept, why, theory });

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'chromaticPassing', kind: 'subject', title: 'Chromatic passing tones', domain: 'improv',
  re: /chromatic (passing|approach|notes?|lines?|enclosures?)|passing (tones?|notes?)|approach notes?|enclosures?|outside (playing|notes)|side.?stepping|bebop (scale|lines?)/,
  aliases: ['approach notes', 'enclosures', 'outside playing', 'bebop scale'],
  sources: ['https://www.fundamental-changes.com/chromatic-approach-notes/', 'https://jazzimproviser.com/enclosure-approach-notes-jazz-chromatics', 'https://www.freejazzlessons.com/dominant-scale-lesson/', 'https://www.premierguitar.com/lessons/scales/how-to-make-pentatonics-better', 'https://www.premierguitar.com/articles/Kick_Out_The_Jams_Both_Sides_of_the_Field_Outside_Playing_101', 'https://jazzimproviser.com/category/don-mock-outside-chromatics-for-jazz-fusion-guitar-lines/', 'https://www.premierguitar.com/lessons/guthrie-govans-erotic-cakes', 'https://www.guitarworld.com/lessons/5-guthrie-govan-guitar-licks'],
  summary: 'Notes from outside the scale that lead into the notes inside it: approaches, passing tones, enclosures, the bebop scale and side-stepping, the sound of bebop and fusion lines.',
  prereqs: ['pentatonic'],
  pedagogy: {
    date: '2026-10-17',
    summary: 'Taught from one rhythmic rule: chord tones on the strong beats, chromatic notes off the beat. First a single half step into each chord tone (from below, then above) and passing notes that fill the whole steps of a scale or the pentatonic box; then the approach note on the “and” of beat 4 that delivers the next chord’s tone on beat 1; then enclosures (scale or chromatic notes on both sides of the target, set up off or on the beat) and the bebop scale, whose added passing note keeps chord tones on the beat; then lines over the changes, chromatic runs and side-stepping a phrase a half step out and back, resolved; finally all of it at tempo, in any key, in your own lines.',
    sequence: [
      { id: 'approach', tier: 'foundations', step: 'A half step into each chord tone, off the beat into on the beat', how: 'Approach each tone of the chord (first the triad, then the 7th) from a half step below, then from above; the chromatic note on the “and”, the chord tone on the beat.', skills: ['chromatic-approach'], source: 3 },
      { id: 'passing', tier: 'foundations', step: 'Passing notes that fill the whole steps', how: 'Where two scale notes are a whole step apart, the fret between them goes on the off-beat; half steps get no passing note. In a scale on one string, a position, and the minor pentatonic box.', skills: ['chromatic-passing', 'chromatic-blues'], source: 0 },
      { id: 'beat1', tier: 'foundations', step: 'The approach on beat 4’s “and” that lands the next chord on beat 1', how: 'Walk the scale through the bar and use one chromatic note on the last 8th to arrive on a chord tone of the next chord on beat 1.', skills: ['chromatic-first-music'], source: 0 },
      { id: 'enclose', tier: 'intermediate', step: 'Enclosures: both sides of the target, set up off or on the beat', how: 'When the target is a half step away, play the note on its other side first; enclosures with a scale note above and the half step below, then with chromatic notes on both sides, placed off the beat or starting on it.', skills: ['chromatic-enclosures', 'chromatic-control'], source: 1 },
      { id: 'bebop', tier: 'intermediate', step: 'The dominant bebop scale', how: 'Mixolydian plus a passing note between the ♭7 and the root: eight notes, so a line in 8ths from a chord tone keeps chord tones on the beats.', skills: ['chromatic-bebop'], source: 2 },
      { id: 'changes', tier: 'intermediate', step: 'Lines over the changes', how: 'Approaches and enclosures that deliver each new chord’s tone on beat 1, in a two-chord vamp, written and then improvised.', skills: ['chromatic-changes'], source: 0 },
      { id: 'outside', tier: 'advanced', step: 'Side-stepping and chromatic runs: out, then back in', how: 'Shift a pentatonic phrase a half step up (or down) and bring it back; walk chromatically between chord tones; keep it short and always resolve.', skills: ['chromatic-outside', 'chromatic-runs'], source: 3 },
      { id: 'bebopAny', tier: 'advanced', step: 'Bebop lines from any chord tone, in any key', how: 'Start the bebop scale from the 3rd or 5th as well as the root and move it through keys.', skills: ['chromatic-bebop-adv'], source: 2 },
      { id: 'mix', tier: 'advanced', step: 'Choosing the target and the device bar by bar', how: 'Pick a chord tone for each bar, then approach or enclose it; mix the devices in longer lines and in a solo.', skills: ['chromatic-recall', 'chromatic-adv-music'], source: 1 },
      { id: 'tempo', tier: 'mastery', step: 'At performance tempo and on any chord', how: 'Learn the lines slowly and accurately, then bring them up to speed; chord after chord in any key.', skills: ['chromatic-performance', 'chromatic-random-access'], source: 3 },
      { id: 'own', tier: 'mastery', step: 'Your own lines', how: 'Compose and improvise lines with the devices you like, keeping chord tones on the strong beats and resolving every outside move.', skills: ['chromatic-voice'], source: 4 }
    ],
    drills: ['Each chord tone approached from a half step below, then above, chromatic note on the off-beat', 'Passing notes in every whole step of a scale and of the pentatonic box', 'A scale line whose last 8th is a chromatic approach into the next chord’s tone on beat 1', 'Enclosures (scale above, chromatic below; chromatic on both sides), off-beat and on-beat set-ups', 'The dominant bebop scale in 8ths from a chord tone, chord tones on the beats', 'A pentatonic phrase played a half step up, then back in the key', 'Chromatic runs from one chord tone down to the next'],
    mistakes: ['Putting the chromatic note on the beat and the chord tone off it', 'Filling a half step with a passing note (it becomes a chromatic scale)', 'Leaving out the bebop scale’s added note, so chord tones drift onto the off-beats', 'Staying outside too long or not resolving the side-step', 'Rushing the chromatic notes so the target lands early', 'Using outside notes so often the line loses the key'],
    sources: [
      { title: 'Chromatic Approach Notes (from Jazz Blues Soloing for Guitar)', author: 'Joseph Alexander (Fundamental Changes)', url: 'https://www.fundamental-changes.com/chromatic-approach-notes/' },
      { title: 'Enclosure, target tones and approach notes: how to use them', author: 'Jazz Improviser', url: 'https://jazzimproviser.com/enclosure-approach-notes-jazz-chromatics' },
      { title: 'Dominant bebop scale video lesson', author: 'Steve Nixon (FreeJazzLessons)', url: 'https://www.freejazzlessons.com/dominant-scale-lesson/' },
      { title: 'How to make pentatonics better', author: 'Ed Levy (Premier Guitar)', url: 'https://www.premierguitar.com/lessons/scales/how-to-make-pentatonics-better' },
      { title: 'Both Sides of the Field: Outside Playing 101', author: 'Emil Werstler (Premier Guitar)', url: 'https://www.premierguitar.com/articles/Kick_Out_The_Jams_Both_Sides_of_the_Field_Outside_Playing_101' }
    ]
  },
  ctx: { key: 9, minor: true, prog: 'dorianVamp' },
  stages: [
    stage('foundations', 'Half steps into chord tones',
      'Approach every chord tone of the vamp chord from a half step below and above with the chromatic note on the “and” and the target on the beat at 90 BPM, fill the whole steps of the Dorian scale on one string and through a position, fill the whole steps of the blues box, approach the IV9 chord’s tones from both sides, and land on a chord tone at each change of a two-chord vamp.', [
        S('chromatic-approach', 'Approach notes', 'improv', 'A half step into a chord tone, off the beat into on the beat.', [c => approach(c, { from: 'below' }), c => approach(c, { from: 'above' })],
          ST('An approach note is a note a half step from a chord tone, played just before it. The chromatic note sits off the beat and resolves on the beat, so the ear hears it as a lead-in rather than a mistake.', 'It is the smallest outside move there is and the base of every enclosure, passing tone and bebop line in this path.', ['From below the half step pulls up like a leading tone; from above it falls in with a darker sound.', 'The rule: chord tones on the strong beats, chromatic notes between them.', 'Over Am7 the targets are A, C, E and G.'])),
        S('chromatic-passing', 'Passing tones', 'improv', 'Fill the whole steps, leave the half steps.', [c => passing(c, { where: 'string' }), c => passing(c, { where: 'position' })],
          ST('A passing tone is the chromatic note between two scale notes a whole step apart. Filled on the off-beat, it keeps every scale note on the beat.', 'It turns a scale run into a smooth line and shows where the whole and half steps of the scale are on the neck.', ['Dorian has five whole steps and two half steps per octave; only the whole steps get a passing note.', 'A half step already moves chromatically, so it gets a quarter note instead.'])),
        S('chromatic-blues', 'In the blues box and the second chord', 'improv', 'Passing tones in the pentatonic you know; approaches into IV9.', [c => bluesPassing(c), c => approachIV(c)],
          ST('The minor pentatonic box has three whole steps; filling them adds the major 3rd, the ♭5 and the major 7th as passing notes. The vamp’s second chord, IV9, has its own chord tones to approach.', 'Most rock and blues players meet chromatic notes this way first: inside the box they already know.', ['In A minor pentatonic the passing notes are C♯ (between C and D), E♭ (between D and E) and G♯ (between G and A).', 'D9 is D F♯ A C E: its 3rd, F♯, is the 6th of A Dorian.'])),
        S('chromatic-first-music', 'First music', 'improv', 'Approach notes that follow the changes.', [c => vampLine(c, { mode: 'approach' }), M('transfer', ['targetSolo', { chords: '$dorianVamp', scale: 'dorian' }])],
          ST('Over changing chords, the most useful chromatic note is the last 8th of the bar: a half step from a chord tone of the next chord, which then lands on beat 1.', 'It makes a line sound as if it knows where the harmony is going.', ['Landing a chord tone on the last note of the bar is a weak resolution; the approach moves it to beat 1.', 'When the target is a whole step away, the chromatic note between them does the same job.']))
      ], [1, 3]),
    stage('intermediate', 'Enclosures and the bebop scale',
      'Enclose every chord tone of the vamp chord with scale and chromatic enclosures, play the bebop scale over the IV9 chord with a chord tone on every beat at 110 BPM in 8ths, use approach notes in four keys without stopping, play double approaches and enclosures into the IV9 chord’s tones, and improvise over i–IV landing on a chord tone at every bar line.', [
        S('chromatic-enclosures', 'Enclosures', 'improv', 'Surround the target, then land.', [c => enclose(c, { kind: 'diatonic' }), c => enclose(c, { kind: 'scale' }), c => enclose(c, { kind: 'chromatic' })],
          ST('An enclosure plays a note on each side of the target before landing on it: a scale note above and the half step below, or chromatic notes on both sides.', 'The target is heard coming from both directions, so the landing sounds certain. It is the most used figure in bebop and fusion lines.', ['The scale enclosure starts on the beat; the chromatic one is set up off the beat as a triplet.', 'Enclosures need not be chromatic: two scale notes around a target work too.'])),
        S('chromatic-bebop', 'The bebop scale and keys', 'improv', 'One added note keeps the chord tones on the beat.', [c => bebopLine(c, { start: 'root' }), c => bebopLine(c, { start: 'third' }), c => approachKeys(c)],
          ST('The dominant bebop scale is Mixolydian with one added passing note between the ♭7 and the root, eight notes in all.', 'Eight notes fill a bar of 8ths exactly, so a line started on a chord tone keeps the chord tones on the beats.', ['Over D9: D E F♯ G A B C C♯.', 'A seven-note scale in 8ths drifts: after an octave the chord tones fall on the off-beats.', 'It works best in 8th notes, started on a chord tone on the beat.'])),
        S('chromatic-control', 'Double approaches and the second chord', 'improv', 'Two half steps into a target, and enclosures into IV9.', [c => doubleApproach(c), c => encloseIV(c)],
          ST('A double approach climbs two half steps into the target; the same enclosure figure also works into the chord tones of the vamp’s second chord.', 'Longer approaches give the line more pull, and a new set of targets moves the figure to new frets.', ['As 8th-note triplets the two chromatic notes fit before the beat, so the target still lands on it.', 'Over D9 the targets are D, F♯, A, C and E.'])),
        S('chromatic-changes', 'Over the changes', 'improv', 'Enclosures that deliver the next chord.', [c => vampLine(c, { mode: 'enclose' }), M('transfer', ['callResponse', { chords: '$dorianVamp', scale: 'dorian' }])],
          ST('The enclosure moves to the bar line: beats 3–4 surround a chord tone of the next chord, which lands on beat 1.', 'This is how bebop and fusion lines follow the harmony: the chromatic notes point at the next chord.', ['Am7 to D9: C (♭3 of Am7) is the ♭7 of D9; E is the 5th of Am7 and the 9th of D9.', 'Choose the target first, then the walk and the enclosure that reach it.']))
      ], [4, 6]),
    stage('advanced', 'Outside and back',
      'Side-step a pentatonic phrase a half step above and below and resolve it in time, walk chromatically between chord tones, run the bebop scale from the 5th and in four keys, enclose a different chord tone every bar, mix approaches and enclosures bar by bar, and solo over a funk vamp with one side-step per chorus.', [
        S('chromatic-outside', 'Side-stepping', 'improv', 'Tension on purpose, then release: up and down a half step.', [c => sideStep(c), c => sideStep(c, { dir: -1 })],
          ST('Side-stepping plays a phrase from the key, then the same shape a half step higher or lower, then back in the key.', 'It is the classic “outside” sound of fusion: strong tension that resolves the moment the phrase returns.', ['Out for a short time, then resolve clearly: the return is what makes it sound intended.', 'The outside notes act as passing tones to the inside phrase.'])),
        S('chromatic-runs', 'Chromatic runs between chord tones', 'improv', 'Walk down by half steps from one chord tone to the next.', [c => chromRun(c)],
          ST('A chromatic run fills every fret between two chord tones while the chord tones still fall on beats.', 'It shows how far a line can move by half steps and still sound tied to the chord.', ['In Am7 the gaps are R–♭7 (2 frets), ♭7–5 (3), 5–♭3 (4) and ♭3–R (3).', 'An odd gap needs one longer note so the next chord tone stays on the beat.'])),
        S('chromatic-bebop-adv', 'Bebop lines anywhere', 'improv', 'From any chord tone, in any key.', [c => bebopLine(c, { start: 'fifth' }), c => bebopKeys(c)],
          ST('The bebop scale keeps working when it starts from the 3rd or 5th, and it is the same rule in every key.', 'Starting from different chord tones and keys makes it a line you can enter anywhere.', ['The added note is always between the chord’s ♭7 and root.', 'Around the cycle of fourths each new dominant is a 4th above the last.'])),
        S('chromatic-recall', 'A new target every bar', 'improv', 'A different chord tone enclosed each bar; devices mixed bar by bar.', [c => targetsCalled(c), c => vampLine(c, { mode: 'mixed' })],
          ST('Here the target changes every bar, and approaches and enclosures alternate.', 'In a solo the choice of target comes first; varying it keeps the figure from becoming one fixed lick.', ['Any chord tone can be a target: root, 3rd, 5th, 7th or 9th.', 'Approach for a short pull, enclosure for a stronger one.'])),
        S('chromatic-adv-music', 'Outside in a solo', 'improv', 'Approach notes and side-steps over a vamp.', [M('transfer', ['targetSolo', { chords: '$funk9', scale: 'dorian', name: 'Solo over a funk vamp: approaches, enclosures and one side-step' }]), M('transfer', ['callResponse', { chords: '$dorianVamp', scale: 'dorian' }])],
          ST('Use the devices in improvised lines over a groove: approaches into the bar lines, an enclosure now and then, one side-step per chorus.', 'Outside notes work in moderation; most of the line stays inside the key.', ['One side-step per chorus is plenty.', 'Resolve every outside move to a chord tone.']))
      ], [7, 8]),
    stage('mastery', 'Fluent, fast and your own',
      'Play enclosure lines across the changes at about 120 BPM and the bebop scale at 130 in 8ths, approach notes into a new chord every bar, and perform your own 8-bar chromatic study.', [
        S('chromatic-performance', 'Performance tempo', 'improv', 'The lines at tempo.', [
          as(c => vampLine(c, { mode: 'enclose' }), { id: 'chromatic-vamp-fast', method: 'edge', goal: 120, name: x => x.name.replace('Enclosures across the changes', 'Enclosures across the changes at performance tempo'), instr: 'The enclosure line across i–IV at performance tempo. Tempo ladder: start below the goal and add a few BPM after each pass where every bar line lands on a chord tone. Pass: the four bars at the goal tempo, then four improvised bars at the same tempo.' }),
          as(c => bebopLine(c, { start: 'third' }), { id: 'chromatic-bebop-fast', method: 'edge', goal: 128, name: x => x.name + ', at performance tempo', instr: 'The bebop line down from the 3rd at performance tempo. Tempo ladder to the goal, checking that a chord tone still falls on every beat. Pass: twice at the goal tempo.' })],
          ST('The same lines at performance tempo.', 'Learned slowly and accurately first, they now have to hold up at speed.', ['Raise the tempo only after a clean pass.', 'Check the beat alignment again at each new tempo.'])),
        S('chromatic-random-access', 'Any chord, any key', 'improv', 'A new chord every bar.', [c => approachRandom(c), c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp solo: every bar line reached by an approach or enclosure' })],
          ST('Approach notes worked out from the target work on any chord, so the chords here change key every bar.', 'Fluency means the devices follow the harmony, not a memorized position.', ['Find the chord tones first, then the half steps around them.', 'Alternate below and above.'])),
        S('chromatic-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => chromEtude(c), c => targetGuide(c, { prog: 'iiVIminor', scale: 'harmonicMinor', name: 'Minor ii–V–i: enclose the 3rd of every chord' })],
          ST('An original 8-bar study uses the whole path; then you write and improvise your own.', 'Your own lines are where the devices become vocabulary.', ['Plan the targets on the bar lines first.', 'Go out briefly, then resolve.']))
      ], [9, 10])
  ]
});
