// Chromatic passing tones and approach notes: notes from outside the scale that lead into notes
// inside it, the sound of bebop, fusion and players like Guthrie Govan and Greg Howe.
//
// Concept-first (CONTENT.md): the model is a scale (Dorian by default, the minor mode of fusion and
// funk) with its chord tones, and one rhythmic rule: scale or chord tones sit on the beat, chromatic
// notes sit off the beat and move by a half step into the next target. From that come single
// approaches (from below, from above), passing tones that fill a whole step, enclosures (scale step
// above, half step below, target), the bebop scale (an added passing tone that keeps chord tones on
// the beat), lines over the changes and side-stepping a phrase a half step out and back.
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
    instr: 'Bars 1 and 3 end with a half-step approach into the next chord’s tone; bars 2 and 4 end with an enclosure (scale note above, half step below). Say “approach” or “enclose” on beat 4. Then improvise four bars with the same alternation. Pass: the four bars written, then four of your own where every bar line lands on a chord tone.',
    watch: 'Using the same device every bar out of habit.', simplify: 'Only beat-1 targets and the last two 8ths of each bar.', tab: { notes }
  });
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
/** Box 1 of the minor pentatonic with a chromatic passing note in every whole step: the 3, the ♭5 and the 7 (retrieval). */
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
    id: 'chromatic-blues-box', name: `Passing tones in the blues box: ${nameOf(k)} minor pentatonic, box 1`, domain: 'improv', method: 'retrieval',
    unit: '8th notes', goal: 96, minutes: 5, backing: [nameOf(k) + 'm7'],
    why: 'The minor pentatonic has three whole steps (♭3 to 4, 4 to 5, ♭7 to the root). Filling each with its chromatic note gives the major 3rd, the blue ♭5 and the major 7th as passing tones: the first chromatic sounds most players use, and they sit inside a shape you already know.',
    instr: 'Up and down box 1: scale notes on the beat; where two neighbours are a whole step apart, the fret between them on the “and”; minor 3rds get a quarter note. After one pass, cover the tab and say “pass” before each passing note. Pass: up and down from memory with every scale note on the beat, twice.',
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
    id: 'chromatic-approach-iv', name: `Approach notes into ${iv}: below, above, below…`, domain: 'improv', method: 'variable',
    unit: 'one target every 2 beats', goal: 92, minutes: 4, backing: [iv],
    why: 'The second chord of the vamp has its own targets (its 3rd is the 6th of the key, the brightest note of Dorian). Approaching them alternately from below and above trains both directions on a new set of targets.',
    instr: `The targets are the chord tones of ${iv}, low to high. Each is approached by the fret below or above it on the “and”, alternating; the target lands on the beat and is held. Say each target’s name as it lands. Pass: up through all the targets twice with every approach a half step and every target on the beat.`,
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
/** Enclosures into the chord tones of IV9, from memory (retrieval). */
export function encloseIV(c) {
  const k = minorKey(c), iv = nameOf(k + 5) + '9', r = rangeOf(k); if (!r) return null;
  const tones = tonePitches(chordInfo(iv).pcs, r[0] + 2, r[1] - 2).slice(0, 6), seq = []; let t = 0;
  for (const p of [...tones, ...tones.slice(0, -1).reverse()]) { let up = p + 1; while (!inScale(k, 'dorian', up)) up++; seq.push([up, t, 0.5], [p - 1, t + 0.5, 0.5], [p, t + 1, 1]); t += 2; }
  const notes = toNotes(seq, nearOf(k)); if (!notes) return null;
  return make(c, {
    id: 'chromatic-enclose-iv', name: `From memory: enclose every chord tone of ${iv}`, domain: 'improv', method: 'retrieval',
    unit: '8th notes', goal: 100, minutes: 5, backing: [iv],
    why: 'An enclosure is worked out from its target: find the chord tone, then the scale note above and the fret below. Doing that from memory on the second chord of the vamp makes it a habit of mind, not a pattern.',
    instr: `Play it once with the tab, then cover it. For each chord tone of ${iv} (low to high and back), say its name, then play the scale note above it, the fret below it, and land on it on the beat. Pass: up and back from memory with every target on the beat.`,
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
    instr: `${names.join(' → ')}: eight 8ths down from each chord’s root, one bar per chord. Name the chord before each bar and check that a chord tone falls on every beat. Pass: all four bars without stopping, then with the tab covered.`,
    watch: 'Forgetting the added major 7th in the new key.', simplify: 'Two keys.', tab: { notes }
  });
}
/** A chord tone named each bar, any of the vamp's two chords: enclose it on the spot (retrieval). */
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
    id: 'chromatic-targets-called', name: 'Targets on demand: a chord tone named every bar, enclosed', domain: 'improv', method: 'retrieval',
    unit: '8th notes', goal: 96, minutes: 5, dl: 1, backing: chords, chords,
    why: 'In a solo the target comes first: you decide “the 3rd of the next chord” and the enclosure follows. Naming a random target every bar and finding it at once is that skill in isolation.',
    instr: `${names.join(' → ')}. Cover the tab. Rest for two beats, then enclose the named chord tone (scale note above, fret below) so it lands on beat 4. Pass: all 8 bars from the names alone, twice.`,
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
    instr: `${names.join(' → ')}: three chord tones per bar, approached alternately from below and above, the last held. Read only the chord names. Pass: all 8 bars from the names alone at the goal tempo.`,
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

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'chromaticPassing', kind: 'subject', title: 'Chromatic passing tones', domain: 'improv',
  re: /chromatic (passing|approach|notes?|lines?|enclosures?)|passing (tones?|notes?)|approach notes?|enclosures?|outside (playing|notes)|side.?stepping|bebop (scale|lines?)/,
  aliases: ['approach notes', 'enclosures', 'outside playing', 'bebop scale'],
  sources: ['https://www.fundamental-changes.com/chromatic-approach-notes/', 'https://jazzimproviser.com/enclosure-approach-notes-jazz-chromatics', 'https://jazzimproviser.com/category/don-mock-outside-chromatics-for-jazz-fusion-guitar-lines/', 'https://www.premierguitar.com/lessons/guthrie-govans-erotic-cakes', 'https://www.guitarworld.com/lessons/5-guthrie-govan-guitar-licks'],
  summary: 'Notes from outside the scale that lead into the notes inside it: approaches, passing tones, enclosures, the bebop scale and side-stepping, the sound of bebop and fusion lines.',
  prereqs: ['pentatonic'],
  ctx: { key: 9, minor: true, prog: 'dorianVamp' },
  stages: [
    stage('foundations', 'Half steps into chord tones',
      'Approach every chord tone of the vamp chord from a half step below and above with the chromatic note on the “and” and the target on the beat at 90 BPM, fill the whole steps of the Dorian scale with passing tones up and down a position from memory, fill the whole steps of the blues box from memory, approach the IV9 chord’s tones from both sides, and land on a chord tone at each change of a two-chord vamp.', [
        S('chromatic-approach', 'Approach notes', 'improv', 'A half step into a chord tone, off the beat into on the beat.', [c => approach(c, { from: 'below' }), c => approach(c, { from: 'above' })]),
        S('chromatic-passing', 'Passing tones', 'improv', 'Fill the whole steps, leave the half steps.', [c => passing(c, { where: 'string' }), c => passing(c, { where: 'position' })]),
        S('chromatic-blues', 'In the blues box and the second chord', 'improv', 'Passing tones in the pentatonic you know; approaches into IV9.', [c => bluesPassing(c), c => approachIV(c)]),
        S('chromatic-first-music', 'First music', 'improv', 'Approach notes that follow the changes.', [c => vampLine(c, { mode: 'approach' }), M('transfer', ['targetSolo', { chords: '$dorianVamp', scale: 'dorian' }])])
      ], [1, 3]),
    stage('intermediate', 'Enclosures and the bebop scale',
      'Enclose every chord tone of the vamp chord with scale and chromatic enclosures, play the bebop scale over the IV9 chord with a chord tone on every beat at 110 BPM in 8ths, use approach notes in four keys without stopping, play ghosted and double approaches, enclose the IV9 chord’s tones from memory, and improvise over i–IV landing on a chord tone at every bar line.', [
        S('chromatic-enclosures', 'Enclosures', 'improv', 'Surround the target, then land.', [c => enclose(c, { kind: 'scale' }), c => enclose(c, { kind: 'chromatic' })]),
        S('chromatic-bebop', 'The bebop scale and keys', 'improv', 'One added note keeps the chord tones on the beat.', [c => bebopLine(c, { start: 'root' }), c => bebopLine(c, { start: 'third' }), c => approachKeys(c)]),
        S('chromatic-control', 'Touch and recall', 'improv', 'Ghosted approaches, double approaches, and enclosures into IV9 from memory.', [c => ghostApproach(c), c => doubleApproach(c), c => encloseIV(c)]),
        S('chromatic-changes', 'Over the changes', 'improv', 'Enclosures that deliver the next chord.', [c => vampLine(c, { mode: 'enclose' }), M('transfer', ['callResponse', { chords: '$dorianVamp', scale: 'dorian' }])])
      ], [4, 6]),
    stage('advanced', 'Outside and back',
      'Side-step a pentatonic phrase a half step above and below and resolve it in time, run the bebop scale from any chord tone and in four keys, enclose any named chord tone on the spot, mix approaches and enclosures bar by bar, and solo over a funk vamp with one side-step per chorus.', [
        S('chromatic-outside', 'Side-stepping', 'improv', 'Tension on purpose, then release: up and down a half step.', [c => sideStep(c), c => sideStep(c, { dir: -1 })]),
        S('chromatic-bebop-adv', 'Bebop lines anywhere', 'improv', 'From any chord tone, in any key.', [c => bebopLine(c, { start: 'fifth' }), c => bebopKeys(c)]),
        S('chromatic-recall', 'Targets on demand', 'improv', 'Any chord tone, enclosed on the spot; devices mixed bar by bar.', [c => targetsCalled(c), c => vampLine(c, { mode: 'mixed' })]),
        S('chromatic-adv-music', 'Outside in a solo', 'improv', 'Approach notes and side-steps over a vamp.', [M('transfer', ['targetSolo', { chords: '$funk9', scale: 'dorian', name: 'Solo over a funk vamp: approaches, enclosures and one side-step' }]), M('transfer', ['callResponse', { chords: '$dorianVamp', scale: 'dorian' }])])
      ], [7, 8]),
    stage('mastery', 'Fluent, fast and your own',
      'Play enclosure lines across the changes at about 120 BPM and the bebop scale at 130 in 8ths, approach notes into a random chord every bar from the names, and perform your own 8-bar chromatic study.', [
        S('chromatic-performance', 'Performance tempo', 'improv', 'The lines at tempo.', [
          as(c => vampLine(c, { mode: 'enclose' }), { id: 'chromatic-vamp-fast', method: 'edge', goal: 120, name: x => x.name.replace('Enclosures across the changes', 'Enclosures across the changes at performance tempo'), instr: 'The enclosure line across i–IV at performance tempo. Tempo ladder: start below the goal and add a few BPM after each pass where every bar line lands on a chord tone. Pass: the four bars at the goal tempo, then four improvised bars at the same tempo.' }),
          as(c => bebopLine(c, { start: 'third' }), { id: 'chromatic-bebop-fast', method: 'edge', goal: 128, name: x => x.name + ', at performance tempo', instr: 'The bebop line down from the 3rd at performance tempo. Tempo ladder to the goal, checking that a chord tone still falls on every beat. Pass: twice at the goal tempo.' })]),
        S('chromatic-random-access', 'Any chord, any key', 'improv', 'No warning.', [c => approachRandom(c), c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp solo: every bar line reached by an approach or enclosure' })]),
        S('chromatic-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => chromEtude(c), c => targetGuide(c, { prog: 'iiVIminor', scale: 'harmonicMinor', name: 'Minor ii–V–i: enclose the 3rd of every chord' })])
      ], [9, 10])
  ]
});
