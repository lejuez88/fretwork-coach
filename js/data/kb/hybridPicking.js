// Hybrid picking: the pick plus the middle (m) and ring (a) fingers, from the first pick-and-finger
// alternation to country rolls, snapped "chicken" notes and a capstone study.
//
// Concept-first (CONTENT.md): the model is a set of chord grips found from the chord's notes on any
// string set (grip), the major scale and its diatonic 3rds, 6ths and octaves, and the major pentatonic
// box. Every exercise assigns one job to the pick (the lower string) and one to the fingers (the
// higher strings), so the same idea works in any key: pick-and-middle pairs, bass and pinches, rolls,
// string skipping, double stops, chicken snaps. Keys come from the context: a minor context uses its
// relative major, so every chord stays diatonic.
import { OPEN, N, nameOf, make, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, pentBox, mod12, S, stage, entry, M } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
/** The major key of a context (a minor context uses its relative major). */
export const majKey = c => (c.minor ? mod12(c.key + 3) : mod12(c.key));
const pitch = (s, f) => OPEN[s] + f;
const inMajor = (k, p) => MAJOR.includes(mod12(p - k));
/** Deterministic pseudo-random numbers (same lesson every time for the same level). */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** I–IV–I–V, the country changes, as chord names. */
export const country = k => [nameOf(k), nameOf(k + 5), nameOf(k), nameOf(k + 7)];
/** I–vi–IV–V as chord names. */
const axis = k => [nameOf(k), nameOf(k + 9) + 'm', nameOf(k + 5), nameOf(k + 7)];
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const unitName = step => UNIT.get(step) || '8th notes';

/**
 * A closed chord grip on a set of strings (listed low to high): every note a chord tone, the
 * fretted notes within `span` frets, as many different chord tones as the strings allow, close to
 * fret `near`. rootLow: the lowest string plays the root. Returns { name, at: {string: fret}, frets }.
 */
export function grip(name, strings, { near = 5, rootLow = false, open = false, span = 3 } = {}) {
  const ch = chordInfo(name); if (!ch) return null;
  const cands = strings.map(s => { const a = []; for (let f = open ? 0 : 1; f <= 17; f++) if (ch.pcs.includes(mod12(OPEN[s] + f))) a.push(f); return a; });
  const need = Math.min(ch.pcs.length, strings.length); let best = null; const cur = [];
  const rec = i => {
    if (i === strings.length) {
      const pcs = strings.map((s, j) => mod12(OPEN[s] + cur[j]));
      if (rootLow && pcs[0] !== ch.pc) return;
      const avg = cur.reduce((a, b) => a + b, 0) / cur.length;
      const score = (need - new Set(pcs).size) * 10 + Math.abs(avg - near);
      if (!best || score < best.score) best = { frets: cur.slice(), score };
      return;
    }
    for (const f of cands[i]) { cur.push(f); const fs = cur.filter(x => x > 0); if (!fs.length || Math.max(...fs) - Math.min(...fs) <= span) rec(i + 1); cur.pop(); }
  };
  rec(0);
  if (!best) return null;
  const at = Object.fromEntries(strings.map((s, j) => [s, best.frets[j]]));
  return { name: ch.name, at, frets: [6, 5, 4, 3, 2, 1].map(s => (s in at ? at[s] : null)) };
}
/** A grip with the root in the bass on string 6 or 5, whichever sits nearer `near`; strings above as given. */
function bassGrip(name, upper, near = 5) {
  const a = grip(name, [6, ...upper], { near, rootLow: true }), b = grip(name, [5, ...upper], { near, rootLow: true });
  if (!a) return b; if (!b) return a;
  const d = g => Math.abs(Object.values(g.at).reduce((x, y) => x + y, 0) / Object.values(g.at).length - near);
  return d(a) <= d(b) ? { ...a, bass: 6 } : { ...b, bass: 5 };
}
const withBass = g => (g ? { ...g, bass: g.bass || Math.max(...Object.keys(g.at).map(Number)) } : g);
const voicing = g => ({ name: g.name, frets: g.frets.slice() });
/** Major-scale notes on string s from fret lo to hi. */
function scaleOn(k, s, lo, hi) { const out = []; for (let f = Math.max(0, lo); f <= Math.min(22, hi); f++) if (inMajor(k, pitch(s, f))) out.push(f); return out; }
/** The diatonic interval `steps` scale steps above pitch p (2 = a 3rd, 5 = a 6th, 7 = an octave). */
function diatonicAbove(k, p, steps) { let q = p, n = 0; while (n < steps) { q++; if (inMajor(k, q)) n++; } return q; }
/** Major pentatonic box (box 1 of the relative minor holds the same notes): [[s, f], …] low to high. */
const majPentBox = (k, b = 1) => { const n = pentBox(mod12(k + 9), b); return n ? n.map(x => [x.s, x.f]) : null; };

/* ------------------------- Foundations: generators ------------------------- */
/** Pick on the lower string, middle finger on the next string up, one string pair at a time (chunking). */
export function pmPairs(c) {
  const k = majKey(c), g = grip(nameOf(k), [5, 4, 3, 2, 1], { near: 5, rootLow: true }); if (!g) return null;
  const step = (c.lvl || 2) <= 1 ? 1 : 0.5, notes = []; let t = 0;
  for (const [lo, hi] of [[5, 4], [4, 3], [3, 2], [2, 1]]) for (let b = 0; b < 2; b++) for (let i = 0; i < 4 / step; i++) { const s = i % 2 ? hi : lo; notes.push(N(s, g.at[s], t, step)); t += step; }
  notes.push(N(5, g.at[5], t, 4));
  return make(c, {
    id: 'hybrid-pm-pairs', name: `Pick and middle finger, one string pair at a time (${g.name} grip)`, domain: 'picking', method: 'chunking',
    unit: unitName(step), goal: 100, minutes: 5, picking: 'hybrid',
    why: 'Hybrid picking starts with one finger: the pick takes the lower string, the middle finger the next string up. Doing it on one pair of strings at a time isolates the new motion before anything else is added.',
    instr: `Hold the ${g.name} grip shown. Downstroke with the pick on the lower string, then the middle finger plucks the next string up, curling into the palm. Two bars on each pair: strings 5–4, 4–3, 3–2, 2–1. Keep the pick hand still: only the pick and the fingertip move. Pass: all four pairs with the plucked notes as loud as the picked ones, twice in a row.`,
    watch: 'The plucked note being much quieter, or the hand lifting off the strings to pluck.', simplify: 'Strings 4–3 only, quarter notes.', voicings: [voicing(g)], chords: [g.name], tab: { notes }
  });
}
/** Pick on the D string, middle finger alternating between the G and B strings, through I–IV–I–V (accurate repetitions). */
export function pmChanges(c) {
  const k = majKey(c), chords = country(k), notes = [], vs = []; let near = 5;
  const step = (c.lvl || 2) <= 1 ? 1 : 0.5;
  for (const [bar, nm] of chords.entries()) {
    const g = grip(nm, [4, 3, 2], { near, rootLow: true }); if (!g) return null; vs.push(voicing(g)); near = g.at[3];
    const order = [4, 3, 4, 2];
    for (let i = 0; i < 4 / step; i++) { const s = order[i % 4]; notes.push(N(s, g.at[s], bar * 4 + i * step, step)); }
  }
  return make(c, {
    id: 'hybrid-pm-changes', name: `Pick and middle finger through the changes (${chords.join(' – ')})`, domain: 'picking', method: 'accurate-reps',
    unit: unitName(step), goal: 104, minutes: 5, picking: 'hybrid', backing: chords,
    why: 'The middle finger has to find the right string without looking, just as the pick does. Moving it between the G and B strings while the chords change builds that aim.',
    instr: 'Pick the root on the D string, middle finger on the G string, pick the root again, middle finger on the B string: four notes, over and over. Change grip on each bar line without breaking the rhythm. Count the clean bars, not the minutes. Pass: 8 clean bars in a row (every note sounding, no wrong string).',
    watch: 'The middle finger catching both strings: pluck with the fingertip, not the pad.', simplify: 'One chord, quarter notes.', voicings: dedupe(vs), chords, tab: { notes }
  });
}
const dedupe = vs => { const seen = new Set(); return vs.filter(v => { const k = v.name + v.frets.join(','); if (seen.has(k)) return false; seen.add(k); return true; }); };
/** The app plays a two-beat pick-and-finger pattern on one grip, then leaves two beats to echo it by ear (hear it first). */
export function pmEcho(c) {
  const k = majKey(c), g = grip(nameOf(k), [5, 4, 3, 2, 1], { near: 5, rootLow: true }); if (!g) return null;
  const r = rng(71 + (c.lvl || 2)), notes = []; let t = 0;
  for (let ph = 0; ph < 4; ph++) {
    const lo = 5 - Math.floor(r() * 3), his = [lo - 1, lo - 2].filter(x => x >= 1);
    for (let i = 0; i < 4; i++) { const s = i % 2 ? his[Math.floor(r() * his.length)] : lo; notes.push(N(s, g.at[s], t, 0.5)); t += 0.5; }
    t += 2; // two silent beats: your echo
  }
  return make(c, {
    id: 'hybrid-pm-echo', name: `Hear it, then pluck it: pick-and-finger echoes (${g.name} grip)`, domain: 'ear', method: 'audiation',
    unit: '8th notes', goal: 90, minutes: 4, picking: 'hybrid', voicings: [voicing(g)], chords: [g.name],
    why: 'Hearing which strings a pattern uses, then playing it back straight away, ties the sound to the hand. It also checks that the pick and the finger sound equal: if your echo sounds different, one of them is too loud.',
    instr: 'Hold the grip. Cover the tab. Each pattern is four notes (pick on the low string, middle finger on a higher one); in the two silent beats, play it back. Check against the tab after each round. Pass: 3 of the 4 patterns echoed exactly, twice in a row.',
    watch: 'Looking at the tab before you try: guess, then check.', simplify: 'Echo only the first two notes of each pattern.', tab: { notes }
  });
}
/** Bass, then middle, ring, then both: the pinch built inside one bar (chunking). */
export function pinchSteps(c) {
  const k = majKey(c), chords = country(k), notes = [], vs = []; let near = 5;
  for (const [bar, nm] of chords.entries()) {
    const g = bassGrip(nm, [2, 1], near); if (!g) return null; vs.push(voicing(g)); near = g.at[2];
    const T = bar * 4, b = g.bass;
    for (let beat = 0; beat < 4; beat++) {
      notes.push(N(b, g.at[b], T + beat, 0.5));
      const up = beat === 0 ? [2] : beat === 1 ? [1] : [2, 1];
      up.forEach(s => notes.push(N(s, g.at[s], T + beat + 0.5, 0.5, null, up.length > 1 ? { chord: true } : null)));
    }
  }
  return make(c, {
    id: 'hybrid-pinch-steps', name: `Bass and pinch, built up one finger at a time (${chords.join(' – ')})`, domain: 'picking', method: 'chunking',
    unit: '8th notes', goal: 100, minutes: 5, picking: 'hybrid', backing: chords,
    why: 'A pinch (two fingers plucking together against the pick) is three motions at once. Each bar builds it in order: middle finger alone, ring finger alone, then both, so you can hear which finger lags.',
    instr: 'The pick plays the root on every beat. On the “and”: beat 1 middle finger (B string), beat 2 ring finger (high e), beats 3 and 4 both together. Pass: four bars where the pinch sounds as one note, not a flam, 3 times in a row.',
    watch: 'The ring finger arriving late in the pinch (a flam).', simplify: 'Leave out the ring finger: middle finger on every “and”.', voicings: dedupe(vs), chords, tab: { notes }
  });
}
/** A simple tune on the top strings plucked by the fingers, over a picked root (first music). */
export function pinchMelody(c) {
  const k = majKey(c), chords = country(k), notes = [], vs = []; let near = 5;
  for (const [bar, nm] of chords.entries()) {
    const g = bassGrip(nm, [2, 1], near); if (!g) return null; vs.push(voicing(g)); near = g.at[2];
    const T = bar * 4, b = g.bass;
    // melody: chord tone on beats 1 and 3, a scale step on beats 2 and 4
    const top = g.at[1], mid = g.at[2];
    const step = (s, f, dir) => { for (let d = 1; d <= 2; d++) { const x = f + dir * d; if (x >= 0 && inMajor(k, pitch(s, x))) return x; } return f; };
    const mel = bar % 2 === 0 ? [[1, top], [1, step(1, top, 1)], [1, top], [2, mid]] : [[2, mid], [2, step(2, mid, -1)], [2, mid], [1, top]];
    mel.forEach(([s, f], i) => notes.push(N(s, f, T + i, 1)));
    notes.push(N(b, g.at[b], T, 2), N(b, g.at[b], T + 2, 2));
  }
  notes.sort((a, b) => a.t - b.t || b.s - a.s);
  return make(c, {
    id: 'hybrid-pinch-melody', name: `A first tune: fingers on the melody, pick on the root (${nameOf(k)} major)`, domain: 'picking', method: 'transfer',
    unit: 'quarter notes', goal: 96, minutes: 5, picking: 'hybrid', backing: chords,
    why: 'Hybrid picking is for music: here the fingers carry a melody on the top strings while the pick holds down the bass, so you hear the two parts as one arrangement.',
    instr: 'The pick plays the root on beats 1 and 3, together with the melody note above it (pick and finger at the same time). Melody notes on the high e use the ring finger, on the B string the middle finger. Make the melody louder than the bass. Pass: the four bars with the melody singing over the bass, then make up your own top-string melody over the same bass.',
    watch: 'The bass drowning the melody: lighter pick, firmer fingers.', simplify: 'Melody alone, then add the bass.', voicings: dedupe(vs), chords, tab: { notes }
  });
}

/* ------------------------- Existing lessons (kept ids) ------------------------- */
/** Hybrid picking: pick on the bass, middle and ring fingers pinch the top two strings (open chords). */
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
    id: 'hybrid-pinches', name: `Hybrid picking: pick the bass, pluck the top pair (${chords.join(' – ')})`, domain: 'picking', method: 'accurate-reps', unit: '8th notes', goal: 112, minutes: 5, picking: 'hybrid',
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
    id: `hybrid-rolls-${cross ? '16' : '3'}`, name: `Hybrid-picked rolls on the top three strings${cross ? ' in 16ths' : ''} (${used.join(' – ')})`, domain: 'picking', method: 'variable',
    unit: cross ? '16th notes' : '8th-note triplets', goal: cross ? 96 : 100, minutes: 6, dl: cross ? 1 : 0, picking: 'hybrid',
    why: cross ? 'A three-note roll played in 16ths starts on a different part of the beat every time: the cascading banjo-roll sound of country hybrid picking. The hand has to keep a three-note cycle against a four-note pulse.'
      : 'Pick, middle, ring across three strings is the core motion of hybrid picking. Played as triplets, each beat is one complete roll, so you can lock every finger to the click.',
    instr: `Pick (downstroke) on the G string, middle finger on the B string, ring finger on the high e, over and over${cross ? ', without restarting at the bar line: the roll keeps cycling, so the accent moves' : ', one roll per beat'}. One chord per bar: grip the triad shown and change shapes without breaking the roll. Pass: all four bars even in volume at the goal tempo.`,
    watch: 'The ring finger being weaker than the others, or the pick digging in louder than the fingers.', simplify: cross ? 'Play it as triplets (one roll per beat) first.' : 'One chord, half tempo.',
    voicings, chords: used, backing: used, tab: { notes }
  });
}

/* ------------------------ Intermediate: generators ------------------------ */
/** The major scale in octaves, pick on the lower note, middle finger on the upper, strings 5–3 then 4–2 (variable). */
export function octaveSkips(c) {
  const k = majKey(c), split = (c.lvl || 4) >= 5, notes = []; let t = 0;
  // root on string 5 near frets 2–9; the octave is two strings up, +2 frets (5→3) or +3 frets (4→2)
  let r5 = mod12(k - 45); if (r5 < 1) r5 += 12;
  const low = []; let p = 45 + r5; for (let i = 0; i < 8; i++) { low.push(p); p = diatonicAbove(k, p, 1); }
  // first half (degrees 1–4) on strings 5–3, the rest on 4–2
  const pairs = low.map((q, i) => (i < 4 ? [5, q - 45, 3, q - 45 + 2] : [4, q - 50, 2, q - 50 + 3]));
  if (pairs.some(([, a, , b]) => a < 0 || b > 22)) return null;
  const seq = [...pairs, ...pairs.slice(0, -1).reverse()];
  const d = split ? 0.5 : 1;
  for (const [s1, f1, s2, f2] of seq) {
    if (split) { notes.push(N(s1, f1, t, 0.5), N(s2, f2, t + 0.5, 0.5)); t += 1; }
    else { notes.push(N(s1, f1, t, d), N(s2, f2, t, d, null, { chord: true })); t += d; }
  }
  return make(c, {
    id: 'hybrid-octaves', name: `${nameOf(k)} major in octaves: pick the low note, pluck the high one`, domain: 'picking', method: 'variable',
    unit: split ? '8th notes (split octaves)' : 'quarter notes (pinched octaves)', goal: split ? 120 : 90, minutes: 5,
    why: 'Octaves skip a string, which is awkward with a pick alone. With hybrid picking the pick takes the low note and the middle finger the high one, and the string in between stays silent under the fretting hand.',
    instr: `Fret the octave shape (index on the low note, ring or pinky two strings up). ${split ? 'Pick the low note, then the middle finger plucks the high one: two even 8th notes.' : 'Pick and middle finger pluck together.'} Strings 5 and 3 for the first four notes of the scale, then strings 4 and 2 (the shape stretches one fret more across the B string). The fretting index finger lies lightly across the middle string to mute it. Pass: up and down twice with no middle string sounding.`,
    watch: 'The muted string in the middle ringing: keep the index finger flat enough to touch it.', simplify: 'Strings 5 and 3 only.', tab: { notes }
  });
}
/** Pick on string 4, fingers on strings 2 and 1: a string-skipping arpeggio through I–vi–IV–V (interleaving). */
export function skipArps(c) {
  const k = majKey(c), chords = axis(k), notes = [], vs = []; let near = 6;
  const tri = (c.lvl || 4) <= 4, step = tri ? 1 / 3 : 0.25;
  for (const [bar, nm] of chords.entries()) {
    const g = grip(nm, [4, 2, 1], { near, rootLow: true }); if (!g) return null; vs.push(voicing(g)); near = g.at[2];
    const order = tri ? [4, 2, 1] : [4, 1, 2, 1];
    for (let i = 0; i < 4 / step; i++) { const s = order[i % order.length]; notes.push(N(s, g.at[s], bar * 4 + i * step, step)); }
  }
  return make(c, {
    id: 'hybrid-skip-arps', name: `String-skipping arpeggios: pick on the D string, fingers on the top two (${chords.join(' – ')})`, domain: 'picking', method: 'interleaving',
    unit: unitName(step), goal: tri ? 96 : 92, minutes: 5, dl: tri ? 0 : 1, picking: 'hybrid', backing: chords,
    why: 'Skipping the G string gives an open, piano-like spread of the chord. The pick never has to jump: it stays on the D string while the middle and ring fingers cover the top two strings.',
    instr: `${tri ? 'Pick the D string, middle finger the B string, ring finger the high e: one roll per beat.' : 'Pick the D string, ring finger the high e, middle finger the B string, ring finger again: four 16ths per beat.'} One chord per bar; the G string stays silent. Pass: the four chords twice through with every note even.`,
    watch: 'Letting the G string ring: rest the fretting finger on the D string lightly against it.', simplify: 'Triplets, one chord.', voicings: dedupe(vs), chords, tab: { notes }
  });
}
/** Diatonic 6ths on strings 3 and 1, pick on the G string, middle finger on the high e (variable). */
export function sixthsPluck(c) {
  const k = majKey(c), split = (c.lvl || 4) >= 5;
  // G-string notes of the major scale from near fret 2 upward, each with the diatonic 6th above on string 1
  const g3 = scaleOn(k, 3, 2, 14).slice(0, 8);
  const pairs = g3.map(f => [f, diatonicAbove(k, pitch(3, f), 5) - 64]).filter(([, h]) => h >= 0 && h <= 22);
  if (pairs.length < 6) return null;
  const seq = [...pairs, ...pairs.slice(0, -1).reverse()], notes = []; let t = 0;
  for (const [lo, hi] of seq) {
    if (split) { notes.push(N(3, lo, t, 0.5), N(1, hi, t + 0.5, 0.5)); t += 1; }
    else { notes.push(N(3, lo, t, 1), N(1, hi, t, 1, null, { chord: true })); t += 1; }
  }
  return make(c, {
    id: 'hybrid-sixths', name: `${nameOf(k)} major in 6ths on the G and high e strings`, domain: 'picking', method: 'variable',
    unit: split ? '8th notes (split)' : 'quarter notes (pinched)', goal: split ? 116 : 92, minutes: 5,
    why: 'Sixths on strings 3 and 1 are the sweetest double stops in country and soul guitar. Hybrid picking plays both strings at once while skipping the B string, which a pick alone can’t do.',
    instr: `Pick the G string while the middle finger plucks the high e${split ? ', first one then the other' : ', together'}. The shapes alternate between a 6th with the frets one apart and a 6th with the frets two apart: follow the scale up and back. Mute the B string with the underside of the finger on the G string. Pass: up and down twice with no B string sounding, then play the shapes from memory.`,
    watch: 'The B string ringing between the two notes.', simplify: 'The first four pairs only.', tab: { notes }
  });
}
/** Diatonic 3rds on strings 2 and 1, pinched by middle and ring, over a picked bass root (variable). */
export function thirdsPinch(c) {
  const k = majKey(c), notes = []; let t = 0;
  const b2 = scaleOn(k, 2, 3, 15).slice(0, 7);
  const pairs = b2.map(f => [f, diatonicAbove(k, pitch(2, f), 2) - 64]).filter(([, h]) => h >= 0);
  if (pairs.length < 6) return null;
  let r = mod12(k - 45); if (r < 3) r += 12; const root = [5, r];
  const seq = [...pairs, ...pairs.slice(0, -1).reverse()];
  seq.forEach(([lo, hi], i) => {
    if (i % 2 === 0) notes.push(N(root[0], root[1], t, 1));
    notes.push(N(2, lo, t + 0.5, 0.5), N(1, hi, t + 0.5, 0.5, null, { chord: true }));
    t += 1;
  });
  return make(c, {
    id: 'hybrid-thirds', name: `${nameOf(k)} major in 3rds on the top two strings, over a picked root`, domain: 'picking', method: 'variable',
    unit: '8th notes', goal: 104, minutes: 5,
    why: 'Thirds on the top two strings plucked by the middle and ring fingers, with the pick keeping a bass note going below: the basic texture of country and Motown-style fills.',
    instr: 'The pick plays the root on the A string on every other beat. On each “and”, middle and ring fingers pinch the 3rd on the B and high e strings and the shape climbs the scale and back. Pass: the whole line twice with every pinch landing together.',
    watch: 'The shapes alternate between frets one apart and frets two apart: let your ear check each one.', simplify: 'Leave out the bass note.', tab: { notes }
  });
}
/** Sixths that land on chord tones over I–IV–I–V, sliding between the two shapes of each chord (use in music). */
export function sixthsOverChanges(c, { prog = 'country' } = {}) {
  const k = majKey(c), chords = prog === 'axis' ? axis(k) : country(k), notes = []; let t = 0, near = 7;
  for (const nm of chords) {
    const ch = chordInfo(nm); const opts = [];
    for (let f = 1; f <= 16; f++) { const lo = pitch(3, f); if (!ch.pcs.includes(mod12(lo)) || !inMajor(k, lo)) continue; const hi = diatonicAbove(k, lo, 5); if (ch.pcs.includes(mod12(hi)) && hi - 64 >= 1 && hi - 64 <= 20) opts.push([f, hi - 64]); }
    opts.sort((a, b) => Math.abs(a[0] - near) - Math.abs(b[0] - near));
    const [a, b] = opts.slice(0, 2).sort((x, y) => x[0] - y[0]); if (!a || !b) return null; near = a[0];
    // approach: slide into the lower shape from a fret below, then up to the higher shape and back
    notes.push(N(3, a[0], t, 1, null), N(1, a[1], t, 1, null, { chord: true }));
    notes.push(N(3, b[0], t + 1, 1, '/'), N(1, b[1], t + 1, 1, '/', { chord: true }));
    notes.push(N(3, b[0], t + 2, 0.5), N(1, b[1], t + 2.5, 0.5));
    notes.push(N(3, a[0], t + 3, 1, '\\'), N(1, a[1], t + 3, 1, '\\', { chord: true }));
    t += 4;
  }
  return make(c, {
    id: `hybrid-sixths-${prog}`, name: `6ths over the changes: chord tones on every chord (${chords.join(' – ')})`, domain: 'improv', method: 'transfer',
    unit: 'quarter notes', goal: 100, minutes: 6, backing: chords, chords,
    why: 'Each chord has two 6th shapes made only of its own chord tones. Sliding between them is the classic country and soul fill: it follows the harmony automatically.',
    instr: 'Pick on the G string, middle finger on the high e. For each chord: the lower shape, slide up to the higher one, split it into two 8ths, slide back. Say the chord name as it changes. Then improvise your own rhythm with the same shapes. Pass: four bars written, then four bars of your own, every slide landing in time.',
    watch: 'Sliding the two fingers unevenly so the 6th goes out of tune mid-slide.', simplify: 'No slides: just the two shapes per chord.', tab: { notes }
  });
}

/* -------------------------- Advanced: generators -------------------------- */
/** Major pentatonic box, pick on one string and middle finger two strings up, in 16ths (variable). */
export function skipPent(c, { boxes = [1] } = {}) {
  const k = majKey(c), notes = []; let t = 0;
  for (const b of boxes) {
    const bx = majPentBox(k, b); if (!bx) return null;
    const on = s => bx.filter(x => x[0] === s).map(x => x[1]);
    for (const [lo, hi] of [[6, 4], [5, 3], [4, 2], [3, 1]]) {
      const L = on(lo), H = on(hi); if (L.length < 2 || H.length < 2) return null;
      [[lo, L[0]], [hi, H[0]], [lo, L[1]], [hi, H[1]], [hi, H[1]], [lo, L[1]], [hi, H[0]], [lo, L[0]]].forEach(([s, f]) => { notes.push(N(s, f, t, 0.25)); t += 0.25; });
    }
  }
  const root = notes[0]; notes.push(N(root.s, root.f, t, 2));
  const many = boxes.length > 1;
  return make(c, {
    id: many ? 'hybrid-skip-pent-neck' : 'hybrid-skip-pent', name: `${nameOf(k)} major pentatonic with string skips${many ? `, boxes ${boxes.join(', ')}` : ''}`, domain: 'picking', method: many ? 'edge' : 'variable',
    unit: '16th notes', goal: many ? 100 : 96, minutes: 5, dl: many ? 1 : 0, picking: 'hybrid',
    why: 'Pick on one string, middle finger two strings higher: the pentatonic turns into wide, banjo-like intervals that a pick alone would have to jump for. This is the sound of modern country and fusion lines.',
    instr: `For each pair of strings (6–4, 5–3, 4–2, 3–1): pick the low note, pluck the high note with the middle finger, then the next pair of notes, and back down: eight 16ths per pair.${many ? ' Move up to the next box at each new bar group without stopping.' : ''} Pass: the whole sequence clean ${many ? 'at the goal tempo, using the tempo ladder to climb' : 'twice in a row'}.`,
    watch: 'Letting the skipped string ring: the fretting fingers must touch it lightly.', simplify: 'Two string pairs only, 8th notes.', tab: { notes }
  });
}
/** Chicken picking: a muted pick stroke then the same note snapped by the middle finger, through the major pentatonic (focus on the sound). */
export function chickenSnap(c, { box = 1 } = {}) {
  const k = majKey(c), bx = majPentBox(k, box); if (!bx) return null;
  const line = bx.filter(([s]) => s <= (box === 1 ? 3 : 4));
  const seq = [...line, ...line.slice(0, -1).reverse()], notes = []; let t = 0;
  for (const [s, f] of seq) { notes.push(N(s, f, t, 0.25, 'mute'), N(s, f, t + 0.25, 0.25)); t += 0.5; }
  notes.push(N(seq[seq.length - 1][0], seq[seq.length - 1][1], t, 1.5, '~'));
  return make(c, {
    id: box === 1 ? 'hybrid-chicken' : `hybrid-chicken-box${box}`, name: `Chicken picking: muted pick, snapped finger (${nameOf(k)} major pentatonic${box === 1 ? '' : ', box ' + box})`, domain: 'picking', method: box === 1 ? 'external-focus' : 'edge',
    unit: '16th notes', goal: box === 1 ? 92 : 96, minutes: 5, dl: box === 1 ? 0 : 1, picking: 'hybrid',
    why: 'The “cluck” of chicken picking comes from two sounds per note: a dead, muted pick stroke and then the note snapped by the middle finger so it slaps against the frets. It is the signature sound of country lead guitar.',
    instr: `For each note: rest the fretting finger lightly on the string and pick it (a dead “x”), then press the note and snap it with the middle finger, pulling the string up and letting it slap back. Listen for a percussive cluck, then a bright, popping note. ${box === 1 ? 'Strings 3 to 1 of the box.' : 'Strings 4 to 1 of box ' + box + '.'} Pass: every note with both sounds clearly different, up and down twice.`,
    watch: 'The muted stroke sounding a pitch: the fretting finger only touches, it doesn’t press.', simplify: 'Snap the notes without the muted stroke first.', tab: { notes }
  });
}
/** The banjo forward roll (3 + 3 + 2) across strings 3-2-1 through I–vi–IV–V (variable). */
export function forwardRoll(c) {
  const k = majKey(c), chords = axis(k), notes = [], vs = []; let near = 6;
  const pat = [3, 2, 1, 3, 2, 1, 3, 2];
  for (const [bar, nm] of chords.entries()) {
    const tr = topTriad(nm, near); if (!tr) return null; near = (tr[1] + tr[2] + tr[3]) / 3;
    vs.push({ name: tr.name, frets: [null, null, null, tr[3], tr[2], tr[1]] });
    for (let h = 0; h < 2; h++) pat.forEach((s, i) => notes.push(N(s, tr[s], bar * 4 + h * 2 + i * 0.25, 0.25)));
  }
  return make(c, {
    id: 'hybrid-forward-roll', name: `The 3 + 3 + 2 forward roll (${chords.join(' – ')})`, domain: 'picking', method: 'variable',
    unit: '16th notes', goal: 96, minutes: 5, picking: 'hybrid', backing: chords,
    why: 'Grouping eight 16ths as 3 + 3 + 2 is the syncopation behind banjo rolls and a lot of country and pop guitar. It restarts the roll every half bar, so the accents fall on beats 1, the “a” of 1 and the “and” of 2.',
    instr: 'Pick (G string), middle (B), ring (high e), pick, middle, ring, pick, middle: then start again. Accent each pick stroke. One chord per bar, triad shapes on the top three strings. Pass: four bars clean with the accents audible, then twice through.',
    watch: 'Turning it into straight groups of three: the last group has only two notes.', simplify: 'One chord, 8th notes.', voicings: vs, chords, tab: { notes }
  });
}
/** The forward roll on the I chord in a new key every bar, around the cycle of fourths (interleaving); random=true shuffles keys and chords. */
export function rollKeys(c, { random = false } = {}) {
  const notes = [], vs = [], names = []; let near = 7;
  const r = rng(211 + (c.lvl || 8));
  const base = [0, 5, 10, 3, 8, 1, 6, 11].map(x => mod12(majKey(c) + x));
  const pat = [3, 2, 1, 3, 2, 1, 3, 2];
  for (let bar = 0; bar < 8; bar++) {
    const k = random ? Math.floor(r() * 12) : base[bar];
    const nm = random ? [nameOf(k), nameOf(k + 5), nameOf(k + 7), nameOf(k + 9) + 'm'][Math.floor(r() * 4)] : nameOf(k);
    const tr = topTriad(nm, near); if (!tr) return null; near = Math.min(10, Math.max(4, (tr[1] + tr[2] + tr[3]) / 3));
    names.push(tr.name); vs.push({ name: tr.name, frets: [null, null, null, tr[3], tr[2], tr[1]] });
    for (let h = 0; h < 2; h++) pat.forEach((s, i) => notes.push(N(s, tr[s], bar * 4 + h * 2 + i * 0.25, 0.25)));
  }
  return make(c, {
    id: random ? 'hybrid-roll-random' : 'hybrid-roll-keys', name: random ? 'Random access: a forward roll on a new chord every bar' : `Forward roll through 8 keys around the cycle of fourths`, domain: 'picking', method: 'interleaving',
    unit: '16th notes', goal: random ? 104 : 96, minutes: 5, dl: random ? 1 : 0, picking: 'hybrid', chords: names, voicings: dedupe(vs),
    why: random ? 'At mastery level the roll should run on any chord the band throws at you. Unpredictable changes make you find each triad while the picking hand carries on by itself.'
      : 'Changing key every bar makes the fretting hand find a new triad shape while the picking hand keeps rolling: the two hands learn to work independently.',
    instr: `The chords are ${names.join(', ')}. Keep the roll going without a gap at the bar line, and find each triad near the last one. Read only the chord name: cover the tab after the first pass. Pass: all 8 bars without breaking the roll${random ? ' at the goal tempo' : ''}.`,
    watch: 'Stopping the picking hand while the fretting hand searches: lower the tempo instead.', simplify: 'The first four bars only.', tab: { notes }
  });
}
/** A syncopated comp: picked root, then triad pinches on strings 3-2-1 off the beat (use in music). */
export function hybridComp(c) {
  const k = majKey(c), chords = axis(k), notes = [], vs = []; let near = 7;
  for (const [bar, nm] of chords.entries()) {
    const g = bassGrip(nm, [3, 2, 1], near); if (!g) return null; near = g.at[2]; vs.push(voicing(g));
    const T = bar * 4, b = g.bass;
    notes.push(N(b, g.at[b], T, 1));
    for (const [off, d] of [[1.5, 0.5], [2.5, 0.5], [3, 0.25], [3.5, 0.5]]) [3, 2, 1].forEach(s => notes.push(N(s, g.at[s], T + off, d, null, { chord: true })));
    notes.push(N(b, g.at[b], T + 2, 0.5));
  }
  notes.sort((a, b) => a.t - b.t || b.s - a.s);
  return make(c, {
    id: 'hybrid-comp', name: `Hybrid comping: picked bass, plucked chords off the beat (${chords.join(' – ')})`, domain: 'rhythm', method: 'transfer',
    unit: '8th and 16th notes', goal: 100, minutes: 5, picking: 'hybrid', backing: chords, chords, voicings: dedupe(vs),
    why: 'Plucking the chord with pick, middle and ring together gives a tight, piano-like stab that a strum can’t: every string starts at exactly the same moment. Against a picked bass note it becomes a whole rhythm section.',
    instr: 'Pick the root on beat 1 and beat 3. The chord stabs (pick on the G string, middle on the B, ring on the high e, all at once) fall on the “and” of 2, the “and” of 3, beat 4 and its “and”. Let go of the chord between stabs so they are short. Pass: four bars with the stabs crisp and in time, then vary the rhythm yourself.',
    watch: 'Strumming instead of plucking: the stab must be one clean attack.', simplify: 'Stabs on the “and” of 2 and the “and” of 4 only.', tab: { notes }
  });
}

/* --------------------------- Mastery: generators --------------------------- */
/** An original 8-bar country-style study: pinches, rolls, 6ths, chicken snaps, an ending (capstone). */
export function hybridEtude(c) {
  const k = majKey(c), ch = country(k), notes = [], vs = [];
  const put = (s, f, t, d, x, extra) => notes.push(N(s, f, t, d, x, extra));
  // bars 1–2: bass and pinches on I and IV
  let near = 5;
  for (const [bar, nm] of [ch[0], ch[1]].entries()) {
    const g = bassGrip(nm, [2, 1], near); if (!g) return null; vs.push(voicing(g)); near = g.at[2];
    for (let beat = 0; beat < 4; beat++) { put(g.bass, g.at[g.bass], bar * 4 + beat, 0.5); put(2, g.at[2], bar * 4 + beat + 0.5, 0.5, null, { chord: true }); put(1, g.at[1], bar * 4 + beat + 0.5, 0.5, null, { chord: true }); }
  }
  // bars 3–4: forward roll on I then V
  for (const [i, nm] of [ch[0], ch[3]].entries()) {
    const tr = topTriad(nm, 7); if (!tr) return null; vs.push({ name: tr.name, frets: [null, null, null, tr[3], tr[2], tr[1]] });
    for (let h = 0; h < 2; h++) [3, 2, 1, 3, 2, 1, 3, 2].forEach((s, j) => put(s, tr[s], 8 + i * 4 + h * 2 + j * 0.25, 0.25));
  }
  // bars 5–6: 6ths that follow I and IV
  let t = 16;
  for (const nm of [ch[0], ch[1]]) {
    const info = chordInfo(nm), opts = [];
    for (let f = 1; f <= 16; f++) { const lo = pitch(3, f); if (!info.pcs.includes(mod12(lo)) || !inMajor(k, lo)) continue; const hi = diatonicAbove(k, lo, 5); if (info.pcs.includes(mod12(hi)) && hi - 64 >= 1 && hi - 64 <= 20) opts.push([f, hi - 64]); }
    opts.sort((a, b) => Math.abs(a[0] - 7) - Math.abs(b[0] - 7));
    const [a, b] = opts.slice(0, 2).sort((x, y) => x[0] - y[0]); if (!a || !b) return null;
    put(3, a[0], t, 1); put(1, a[1], t, 1, null, { chord: true }); put(3, b[0], t + 1, 1, '/'); put(1, b[1], t + 1, 1, '/', { chord: true });
    put(3, b[0], t + 2, 0.5); put(1, b[1], t + 2.5, 0.5); put(3, a[0], t + 3, 1, '\\'); put(1, a[1], t + 3, 1, '\\', { chord: true });
    t += 4;
  }
  // bar 7: chicken snaps down the major pentatonic, strings 2–3
  const bx = majPentBox(k, 1); if (!bx) return null;
  const run = bx.filter(([s]) => s === 2 || s === 3).reverse();
  run.forEach(([s, f], i) => { put(s, f, 24 + i * 0.5, 0.25, 'mute'); put(s, f, 24 + i * 0.5 + 0.25, 0.25); });
  // bar 8: the ending, a pinched I chord
  const end = bassGrip(ch[0], [3, 2, 1], 5); if (!end) return null; vs.push(voicing(end));
  put(end.bass, end.at[end.bass], 28, 4); [3, 2, 1].forEach(s => put(s, end.at[s], 28, 4, null, { chord: true }));
  notes.sort((a, b) => a.t - b.t || b.s - a.s);
  return make(c, {
    id: 'hybrid-capstone-etude', name: `Capstone study: an 8-bar hybrid-picking piece (${nameOf(k)} major)`, domain: 'improv', method: 'transfer',
    unit: 'mixed rhythms', goal: 100, minutes: 8, dl: 1, backing: ch, chords: [...new Set(vs.map(v => v.name))], voicings: dedupe(vs),
    why: 'One short original piece that uses the whole path: bass and pinches, the forward roll, 6ths following the chords, chicken snaps and a clean ending. Mastery is playing all of them in a row, switching textures without a hiccup.',
    instr: 'Learn it two bars at a time, then join the pairs. Make the textures contrast: warm pinches, driving rolls, singing 6ths, percussive snaps. Then write your own 8 bars with the same plan (two bars per texture) over the same changes. Pass: the study at the goal tempo with no stops, then your own version played through once.',
    watch: 'Rushing the change from the roll (bars 3–4) into the 6ths: hold the slide shapes for their full length.', simplify: 'Bars 1–4 only.', tab: { notes }
  });
}


/* ------------------- Added for the reference standard ------------------- */
/** A pedal tone: the pick walks up the scale on the G string, the middle finger answers each note with the same 5th on the B string (variable). */
export function pedalPluck(c) {
  const k = majKey(c); let r = mod12(k - OPEN[3]); if (r < 2) r += 12;
  const line = []; for (let f = r; f <= r + 7 && f <= 20; f++) if (inMajor(k, pitch(3, f))) line.push(f);
  if (line.length < 5) return null;
  let pf = null; for (let f = 1; f <= 20; f++) if (mod12(pitch(2, f) - k) === 7 && (pf == null || Math.abs(f - (r + 3)) < Math.abs(pf - (r + 3)))) pf = f;
  if (pf == null) return null;
  const step = (c.lvl || 2) <= 1 ? 1 : 0.5, seq = [...line, ...line.slice(0, -1).reverse()], notes = []; let t = 0;
  for (const f of seq) { notes.push(N(3, f, t, step), N(2, pf, t + step, step)); t += 2 * step; }
  notes.push(N(3, line[0], t, 2), N(2, pf, t, 2, null, { chord: true }));
  return make(c, {
    id: 'hybrid-pedal', name: `A pedal tone: the scale picked on the G string, the 5th plucked on the B (${nameOf(k)} major)`, domain: 'picking', method: 'variable',
    unit: unitName(step), goal: 100, minutes: 4, picking: 'hybrid',
    why: 'The pick and the middle finger now do different musical jobs: the pick plays a moving line, the finger repeats one note (a pedal) above it. That independence is the basis of banjo rolls, country licks and arpeggio melodies.',
    instr: 'Pick each scale note on the G string on the beat; on every “and” the middle finger plucks the same note on the B string (the key’s 5th). Up the scale and back. Pass: up and back twice with the pedal note always the same volume.',
    watch: 'The pedal getting louder as the line rises.', simplify: 'Three notes of the line only.', tab: { notes }
  });
}
/** Say the finger before every note: p (pick), m, a, over the changes, then from memory (retrieval). */
export function fingerCall(c) {
  const k = majKey(c), chords = country(k), notes = [], vs = []; let near = 5;
  for (const [bar, nm] of chords.entries()) {
    const g = grip(nm, [4, 3, 2, 1], { near }); if (!g) return null; vs.push(voicing(g)); near = g.at[3];
    [4, 2, 3, 1, 4, 2, 3, 1].forEach((s, i) => notes.push(N(s, g.at[s], bar * 4 + i * 0.5, 0.5)));
  }
  return make(c, {
    id: 'hybrid-finger-call', name: `Which finger? p-m-p-a through ${chords.join(' – ')}, from memory`, domain: 'picking', method: 'retrieval',
    unit: '8th notes', goal: 96, minutes: 4, picking: 'hybrid', backing: chords, chords, voicings: dedupe(vs),
    why: 'In hybrid picking every string belongs to a finger: the pick takes the D and G strings, the middle finger the B, the ring finger the high e. Saying the finger before the note, then playing the pattern from memory, makes those assignments automatic.',
    instr: 'The pattern per beat pair is pick (D), middle (B), pick (G), ring (e). Play one bar saying “p, m, p, a” before each note. Then cover the tab and play all four bars from the chord names alone. Pass: the four bars from memory with no wrong finger, twice.',
    watch: 'The pick creeping onto the B string out of habit.', simplify: 'One chord, quarter notes.', tab: { notes }
  });
}
/** The pop: pick on the G string, middle finger snapping the B and e strings in the major pentatonic (focus on the sound). */
export function popNotes(c) {
  const k = majKey(c), bx = majPentBox(k, 1); if (!bx) return null;
  const on = s => bx.filter(x => x[0] === s).map(x => x[1]), G = on(3), B = on(2), E = on(1); if (G.length < 2 || B.length < 2 || E.length < 2) return null;
  const step = (c.lvl || 4) <= 5 ? 0.5 : 0.25, cell = [[3, G[0]], [2, B[0]], [3, G[1]], [2, B[1]], [2, B[0]], [1, E[0]], [2, B[1]], [1, E[1]]];
  const seq = [...cell, ...cell.slice().reverse()], notes = []; let t = 0;
  for (let r = 0; r < 2; r++) seq.forEach(([s, f]) => { notes.push(N(s, f, t, step)); t += step; });
  notes.push(N(3, G[0], t, 2));
  return make(c, {
    id: 'hybrid-pop', name: `The pop: snapped middle-finger notes in ${nameOf(k)} major pentatonic`, domain: 'picking', method: 'external-focus',
    unit: unitName(step), goal: 100, minutes: 4, picking: 'hybrid',
    why: 'A finger can do what a pick can’t: hook under the string and let it snap back against the frets for a bright, percussive pop. The sound, not the motion, is the target: picked notes round, finger notes popping.',
    instr: 'Pick the G-string notes; the middle finger plucks the B- and e-string notes, hooking slightly under the string and letting it snap. Listen for two distinct colours and the same loudness. Pass: the pattern twice where every finger note pops and none is louder than the picked notes.',
    watch: 'Snapping so hard the note goes sharp or rattles.', simplify: 'Only the G and B strings.', tab: { notes }
  });
}
/** Diatonic 6ths with the low note picked on the D string and the high note plucked on the B string (retrieval). */
export function sixthsFourTwo(c) {
  const k = majKey(c), notes = []; let t = 0;
  const all = [];
  for (let f = 1; f <= 17; f++) {
    if (!inMajor(k, pitch(4, f))) continue;
    const hi = diatonicAbove(k, pitch(4, f), 5) - OPEN[2]; if (hi < 0 || hi > 20 || Math.abs(hi - f) > 4) continue;
    all.push([f, hi]);
  }
  const ri = all.findIndex(([f]) => mod12(pitch(4, f) - k) === 0);
  let pairs = all.slice(Math.max(0, ri), Math.max(0, ri) + 8); if (pairs.length < 6) pairs = all.slice(-8);
  if (pairs.length < 6) return null;
  const seq = [...pairs, ...pairs.slice(0, -1).reverse()];
  seq.forEach(([a, b]) => { notes.push(N(4, a, t, 0.5), N(2, b, t + 0.5, 0.5), N(4, a, t + 1, 1, null, { chord: true }), N(2, b, t + 1, 1, null, { chord: true })); t += 2; });
  return make(c, {
    id: 'hybrid-sixths-42', name: `6ths on the D and B strings, from memory (${nameOf(k)} major)`, domain: 'fretboard', method: 'retrieval',
    unit: '8th notes', goal: 104, minutes: 5, picking: 'hybrid',
    why: 'A 6th spans one skipped string: the pick takes the bottom, the middle finger the top. Knowing the scale’s 6ths on a second string pair (not just G and e) doubles the places you can play them, and recalling them instead of reading builds that map.',
    instr: 'For each 6th: pick the D-string note, pluck the B-string note, then pinch both together. Up the scale and back. After one pass with the tab, cover it and say the scale degree of each bottom note before you play it. Pass: up and back from memory, twice.',
    watch: 'Letting the G string sound: mute it with the underside of the fretting finger.', simplify: 'The first four 6ths.', tab: { notes }
  });
}
/** Seventh-chord arpeggios over ii–V–I: pick on the D and G strings, middle and ring on B and e, in 16ths (variable). */
export function hybridArp7(c) {
  const k = majKey(c), chords = [nameOf(k + 2) + 'm7', nameOf(k + 7) + '7', nameOf(k) + 'maj7', nameOf(k) + 'maj7'], notes = [], vs = []; let near = 7;
  for (const [bar, nm] of chords.entries()) {
    const g = grip(nm, [4, 3, 2, 1], { near }); if (!g) return null; vs.push(voicing(g)); near = (g.at[3] + g.at[2]) / 2;
    [4, 3, 2, 1, 2, 3, 4, 3, 4, 3, 2, 1, 2, 3, 2, 1].forEach((s, i) => notes.push(N(s, g.at[s], bar * 4 + i * 0.25, 0.25)));
  }
  return make(c, {
    id: 'hybrid-arp7', name: `Hybrid seventh-chord arpeggios over ii–V–I (${chords.slice(0, 3).join(' – ')})`, domain: 'picking', method: 'variable',
    unit: '16th notes', goal: 100, minutes: 5, picking: 'hybrid', backing: chords, chords, voicings: dedupe(vs),
    why: 'Four strings, four chord tones, four jobs: the pick takes the two lower strings, the middle and ring fingers the two higher. Arpeggios become a roll instead of a sweep, which is how fusion players get smooth, even seventh-chord lines.',
    instr: 'Hold each grip. Pick D and G, middle finger B, ring finger e, then back down; one bar per chord. Keep each note separate (lift as the next sounds). Pass: the four bars at the goal tempo with every string equally loud.',
    watch: 'The ring finger landing late on the high e.', simplify: '8th notes.', tab: { notes }
  });
}
/** A diatonic chord named every bar: find a bass-and-pinch grip on the spot (retrieval). */
export function pinchCalled(c) {
  const k = majKey(c), r = rng(613 + (c.lvl || 7)), deg = [[0, ''], [2, 'm'], [4, 'm'], [5, ''], [7, ''], [9, 'm']], chords = [], notes = [], vs = []; let near = 5;
  for (let bar = 0; bar < 8; bar++) { const [d, q] = deg[Math.floor(r() * deg.length)]; chords.push(nameOf(k + d) + q); }
  for (const [bar, nm] of chords.entries()) {
    const g = bassGrip(nm, [3, 2, 1], near); if (!g) return null; vs.push(voicing(g)); near = g.at[2];
    const T = bar * 4;
    notes.push(N(g.bass, g.at[g.bass], T, 1));
    [3, 2, 1].forEach(s => notes.push(N(s, g.at[s], T + 1, 1, null, { chord: true })));
    notes.push(N(g.bass, g.at[g.bass], T + 2, 0.5));
    [2, 1].forEach(s => notes.push(N(s, g.at[s], T + 2.5, 0.5, null, { chord: true })));
    [3, 2, 1].forEach(s => notes.push(N(s, g.at[s], T + 3, 1, null, { chord: true })));
  }
  return make(c, {
    id: 'hybrid-pinch-called', name: `Chords on demand: ${chords.join(' – ')}, bass and pinches`, domain: 'rhythm', method: 'retrieval',
    unit: 'quarter notes', goal: 104, minutes: 5, dl: 1, picking: 'hybrid', backing: chords, chords, voicings: dedupe(vs),
    why: 'Comping from a chart means finding each chord’s grip the moment you read its name. Every bar here is a diatonic chord out of order, played as a picked root and plucked pinches near the last grip.',
    instr: 'Cover the tab after one pass. Read only the chord names: pick the root on beat 1, pinch the top three strings on beat 2, root and a two-string pinch on beat 3, all three on beat 4. Stay within a few frets. Pass: all 8 bars from the names, at the goal tempo, twice.',
    watch: 'Jumping to open or root-position shapes far away.', simplify: 'The first four bars.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'hybridPicking', kind: 'technique', title: 'Hybrid picking', domain: 'picking',
  re: /hybrid.?pick|pick (and|&|\+) fingers?|chicken.?pick/,
  aliases: ['pick and fingers', 'chicken picking'],
  sources: ['https://www.fundamental-changes.com/hybrid-picking-part-1/', 'https://www.londonguitaracademy.com/hybrid-picking-guitar', 'https://my.artistworks.com/blog/how-practice-hybrid-picking-guitar', 'https://www.premierguitar.com/articles/23906-cosmic-country-finger-rolls', 'https://www.premierguitar.com/lessons/fierce-guitar-intervallic-arpeggios'],
  summary: 'Pick plus middle and ring fingers, from the first pick-and-finger alternation to rolls, string-skipping lines, 6ths, chicken snaps and a capstone study.',
  ctx: { key: 7, minor: false, prog: 'country' },
  stages: [
    stage('foundations', 'Pick and fingers together',
      'Alternate pick and middle finger on every string pair at 90 BPM in 8ths with even volume, pinch two strings against a picked bass with no flam, play a scale line under a plucked pedal note, play p-m-p-a through the changes from memory, and play a short top-string melody over a picked root.', [
        S('hybrid-pm', 'Pick and middle finger', 'picking', 'The first motion: pick on the lower string, middle finger on the next one up.', [c => pmPairs(c), c => pmChanges(c), c => pmEcho(c)]),
        S('hybrid-pinch', 'Bass and pinches', 'picking', 'Middle and ring fingers pluck together against the pick.', [c => pinchSteps(c), c => hybridPinches(c)]),
        S('hybrid-bass', 'Independence and recall', 'picking', 'A moving line under a plucked pedal; every finger’s string from memory.', [c => pedalPluck(c), c => fingerCall(c)]),
        S('hybrid-first-music', 'First music', 'picking', 'A melody on top, the bass below.', [c => pinchMelody(c)])
      ], [1, 3]),
    stage('intermediate', 'Rolls, skips and double stops',
      'Roll pick-middle-ring across three strings as triplets at 100 BPM and in 16ths at 90, play octaves and string-skipped arpeggios with no middle string sounding, play 6ths and 3rds of the major scale up and back (6ths on two string pairs from memory), and snap middle-finger pops at even volume.', [
        S('hybrid-rolls', 'Hybrid rolls', 'picking', 'Pick, middle, ring across strings 3-2-1.', [c => hybridRolls(c, { cross: false }), c => hybridRolls(c, { cross: true })]),
        S('hybrid-skip', 'String skipping with the fingers', 'picking', 'The pick stays put, the fingers reach across.', [c => octaveSkips(c), c => skipArps(c)]),
        S('hybrid-dstops', 'Double stops', 'picking', '6ths and 3rds of the scale, plucked.', [c => sixthsPluck(c), c => thirdsPinch(c)]),
        S('hybrid-control', 'Pop and recall', 'picking', 'The snapped finger sound; 6ths on a second string pair from memory.', [c => popNotes(c), c => sixthsFourTwo(c)]),
        S('hybrid-changes', 'Over the changes', 'improv', 'Chord-tone 6ths and a solo over country changes.', [c => sixthsOverChanges(c), M('transfer', ['targetSolo', { chords: '$country', scale: 'majorPent' }])])
      ], [4, 6]),
    stage('advanced', 'Country and fusion lines',
      'Play the major pentatonic with pick-and-finger string skips in 16ths at 100 BPM, chicken-pick it with a clear cluck on every note, keep the 3 + 3 + 2 roll going through a key change every bar, roll seventh-chord arpeggios over ii–V–I in 16ths, find any diatonic chord from its name, and comp with off-beat pinches.', [
        S('hybrid-lines', 'String-skipping pentatonic', 'picking', 'Wide intervals with the pick and the middle finger.', [c => skipPent(c), c => chickenSnap(c)]),
        S('hybrid-banjo', 'Banjo rolls', 'picking', 'The 3 + 3 + 2 roll, through chords and keys.', [c => forwardRoll(c), c => rollKeys(c)]),
        S('hybrid-fusion', 'Arpeggios and chords on demand', 'picking', 'Seventh-chord rolls over ii–V–I; any diatonic chord from its name.', [c => hybridArp7(c), c => pinchCalled(c)]),
        S('hybrid-adv-music', 'Comping and soloing', 'rhythm', 'Hybrid picking as a rhythm part and a lead voice.', [c => hybridComp(c), M('transfer', ['callResponse', { chords: '$country', scale: 'majorPent' }])])
      ], [7, 8]),
    stage('mastery', 'Fluent, fast and your own',
      'Run the skipping pentatonic through three boxes at 108 BPM in 16ths, chicken-pick box 2 at 104, roll through random chords without a gap, solo over a blues with snaps and 6ths, and perform your own 8-bar hybrid-picking piece.', [
        S('hybrid-speed', 'Performance tempo', 'picking', 'Skips and snaps across the neck at speed.', [c => skipPent(c, { boxes: [1, 2, 3] }), c => chickenSnap(c, { box: 2 })]),
        S('hybrid-random', 'Any chord, any time', 'picking', 'Rolls on demand, and a solo over a blues.', [c => rollKeys(c, { random: true }), M('transfer', ['targetSolo', { chords: '$blues', scale: 'majorPent', name: 'Hybrid-picked blues solo: 6ths, snaps and rolls on the changes' }])]),
        S('hybrid-voice', 'Your own voice', 'improv', 'A study that uses everything, then your version.', [c => hybridEtude(c), c => sixthsOverChanges(c, { prog: 'axis' })])
      ], [9, 10])
  ]
});
