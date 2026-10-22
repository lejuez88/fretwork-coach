// Spread triads: a triad opened out over three strings with one string skipped (root, 5th and the
// 3rd an octave up, the 10th), the wide, piano-like chord sound of Eric Johnson's clean playing,
// arpeggiated, pinched and voice-led through progressions and chord melodies.
//
// Concept-first (CONTENT.md): the model is a triad's tones in an ORDER (root position R–5–3, first
// inversion 3–R–5, second inversion 5–3–R, each the next tone above the last) laid on a STRING SET
// (bass string s, the string above it, and the string two above that: sets 6, 5 and 4), searched
// from the chord's notes so every voicing is right in every key (`spread()`); the diatonic chords of
// the key; and voice leading (the nearest voicing to the last one, `nearest()`). The composer
// `spreadRun(c, spec)` builds an exercise from progression × string sets × inversion (or nearest) ×
// pattern (arpeggio, pinch, both, top-note melody) × note value × keys.
import { OPEN, N, nameOf, make, mod12, chordInfo, fretOn, spreadVoicing, spreadBar, spreadName, goalFor, S, stage, entry, M, targetGuide } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes']]);
const unitName = step => UNIT.get(step) || '8th notes';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** The major key of a context (a minor context uses its relative major). */
const majKey = c => (c.minor ? mod12(c.key + 3) : mod12(c.key));
const minKey = c => (c.minor ? mod12(c.key) : mod12(c.key - 3));
const INV = ['root position', '1st inversion', '2nd inversion'];
/** The strings of a set: the bass string, the next one up, and the one two above that. */
export const SET = { 6: [6, 5, 3], 5: [5, 4, 2], 4: [4, 3, 1] };
/**
 * A spread voicing of chord `name` on string set 6, 5 or 4 in inversion inv (0 R–5–3, 1 3–R–5, 2 5–3–R),
 * each tone the first of its kind above the last, frets 1–17 within a span of 5, nearest to fret `near`.
 * Returns { name, inv, set, tones: [[s, f] ×3] low to high, frets (low E … high e) } or null.
 */
export function spread(name, inv = 0, set = 5, near = 6) {
  const ch = chordInfo(name); if (!ch || ch.pcs.length < 3) return null;
  const [R, T, F] = ch.pcs, order = [[R, F, T], [T, R, F], [F, T, R]][inv], [sb, sm, st] = SET[set]; let best = null;
  for (let fb = 1; fb <= 17; fb++) {
    if (mod12(pitch(sb, fb)) !== order[0]) continue;
    let pm = pitch(sb, fb) + 1; while (mod12(pm) !== order[1]) pm++;
    let pt = pm + 1; while (mod12(pt) !== order[2]) pt++;
    const fm = pm - OPEN[sm], ft = pt - OPEN[st]; if (fm < 1 || ft < 1 || fm > 17 || ft > 17) continue;
    const fs = [fb, fm, ft]; if (Math.max(...fs) - Math.min(...fs) > 5) continue;
    const d = Math.abs((fb + fm + ft) / 3 - near); if (!best || d < best.d) best = { d, fs };
  }
  if (!best) return null;
  const tones = [[sb, best.fs[0]], [sm, best.fs[1]], [st, best.fs[2]]], frets = [null, null, null, null, null, null];
  tones.forEach(([s, f]) => { frets[6 - s] = f; });
  return { name: ch.name, inv, set, tones, frets };
}
const avg = v => v.tones.reduce((a, x) => a + x[1], 0) / 3;
/** The voicing of a chord nearest to fret `near`, over the given sets and inversions (voice leading). */
export function nearest(name, near, sets = [6, 5, 4], invs = [0, 1, 2]) {
  let best = null;
  for (const set of sets) for (const inv of invs) { const v = spread(name, inv, set, near); if (v && (!best || Math.abs(avg(v) - near) < Math.abs(avg(best) - near))) best = v; }
  return best;
}
/** Diatonic triads of a major key K (with the octave I), or of a minor key k. */
export const DIA = {
  major: K => [nameOf(K), nameOf(K + 2) + 'm', nameOf(K + 4) + 'm', nameOf(K + 5), nameOf(K + 7), nameOf(K + 9) + 'm', nameOf(K + 11) + '°', nameOf(K)],
  minor: k => [nameOf(k) + 'm', nameOf(k + 2) + '°', nameOf(k + 3), nameOf(k + 5) + 'm', nameOf(k + 7) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm']
};
/** Progressions as chord names: major ones from the major key K, minor ones from the minor key k. */
export const PROG = {
  axis: (K, k) => [nameOf(K), nameOf(K + 7), nameOf(K + 9) + 'm', nameOf(K + 5)],
  oneFourFive: (K, k) => [nameOf(K), nameOf(K + 5), nameOf(K + 7), nameOf(K)],
  pop: (K, k) => [nameOf(K), nameOf(K + 9) + 'm', nameOf(K + 5), nameOf(K + 7)],
  ballad: (K, k) => [nameOf(K), nameOf(K + 4) + 'm', nameOf(K + 5), nameOf(K + 2) + 'm', nameOf(K), nameOf(K + 9) + 'm', nameOf(K + 5), nameOf(K + 7)],
  minorRock: (K, k) => [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'],
  minorFull: (K, k) => [nameOf(k) + 'm', nameOf(k + 5) + 'm', nameOf(k + 7) + 'm', nameOf(k + 8), nameOf(k + 3), nameOf(k + 10), nameOf(k + 5) + 'm', nameOf(k) + 'm']
};
/** Arpeggio patterns over the three tones (0 bass, 1 middle, 2 top), per bar. */
const PAT = { rolled: [0, 1, 2, 1], wide: [0, 2, 1, 2], up: [0, 1, 2], updown: [0, 1, 2, 1, 2, 1, 0, 1] };

/* ------------------------------- The composer ------------------------------- */
/**
 * One exercise from a spec: { id, name ('{key}', '{chords}'), method, prog (a PROG name) or dia
 * ('major' | 'minor') or chords, keys (offsets), sets, inv (0–2, or 'near' for voice leading), invs
 * (one per bar), pattern ('rolled' | 'wide' | 'up' | 'updown' | 'pinch' | 'both'), beats (per chord),
 * step, goal, start, dl, domain, why, instr, watch, simplify }.
 */
export function spreadRun(c, spec) {
  const K0 = majKey(c), k0 = minKey(c), beats = spec.beats || 4, step = spec.step || 0.5, notes = [], vs = [], names = [];
  const list = []; for (const off of spec.keys || [0]) { const K = mod12(K0 + off), k = mod12(k0 + off); list.push(...(spec.chords || (spec.dia ? DIA[spec.dia](spec.dia === 'major' ? K : k) : PROG[spec.prog || 'axis'](K, k)))); }
  let near = spec.near || 6, t = 0;
  for (const [i, nm] of list.entries()) {
    const sets = spec.sets || [5];
    const v = spec.inv === 'near' ? nearest(nm, near, sets) : spread(nm, spec.invs ? spec.invs[i % spec.invs.length] : spec.inv || 0, sets[i % sets.length], spec.climb ? near : (spec.near || 6));
    if (!v) return null; if (spec.inv === 'near' || spec.climb) near = spec.climb ? avg(v) + 1.5 : avg(v);
    const pat = spec.pattern || 'both';
    if (pat === 'pinch') { const hits = beats >= 4 ? [0, 1, 2, 3] : [0, 1]; hits.forEach(h => v.tones.forEach(([s, f]) => notes.push(N(s, f, t + h, 1, null, { chord: true })))); }
    else if (pat === 'both') { [0, 1, 2, 1].forEach((j, m) => notes.push(N(v.tones[j][0], v.tones[j][1], t + m * (beats / 8), beats / 8))); v.tones.forEach(([s, f]) => notes.push(N(s, f, t + beats / 2, beats / 2, null, { chord: true }))); }
    else { const p = PAT[pat], n = Math.round(beats / step); for (let m = 0; m < n; m++) { const [s, f] = v.tones[p[m % p.length]]; notes.push(N(s, f, t + m * step, step)); } }
    vs.push({ name: v.name, frets: v.frets }); names.push(v.name); t += beats;
  }
  const uniq = []; const seen = new Set(); vs.forEach(x => { const key = x.name + x.frets.join(','); if (!seen.has(key)) { seen.add(key); uniq.push(x); } });
  const fill = x => x.replace('{key}', spec.dia === 'minor' || /minor/.test(spec.prog || '') ? `${nameOf(k0)} minor` : `${nameOf(K0)} major`).replace('{chords}', names.slice(0, 8).join(' – ')).replace('{inv}', INV[spec.inv] || 'the nearest inversion');
  const ch = names.length <= 8 ? names : [...new Set(names)].slice(0, 8);
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretboard', method: spec.method, unit: spec.pattern === 'pinch' ? 'quarter notes' : unitName(spec.pattern === 'both' ? beats / 8 : step), goal: spec.goal || 96, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'hybrid',
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, voicings: uniq.slice(0, 8), chords: ch, ...(names.length <= 8 && beats === 4 ? { backing: names } : {}), tab: { notes }
  });
}
const T_ = (id, name, method, opts) => c => spreadRun(c, { id, name, method, ...opts });

/* --------------------------- Existing lessons (kept ids) --------------------------- */
/** Spread triads, major and minor, on three string sets. */
export function ejSpreadShapes(c, { root = null } = {}) {
  const pc = root != null ? root : majKey(c);
  const plan = [[6, 'maj', 5], [6, 'min', 5], [5, 'maj', 10], [5, 'min', 10], [4, 'maj', 7], [4, 'min', 7]];
  const notes = [], voicings = [], chords = [];
  plan.forEach(([set, type, near], i) => {
    const v = spreadVoicing(pc, type, set, near); if (!v) return;
    spreadBar(v, i * 4, notes);
    const nm = spreadName(pc, type); voicings.push({ name: nm, frets: v.frets }); chords.push(nm);
  });
  if (notes.length < 12) return null;
  return make(c, {
    id: 'ej-spread-shapes', name: `Spread triads: ${nameOf(pc)} and ${nameOf(pc)}m on three string sets`, domain: 'fretboard', method: 'accurate-reps', unit: '8th notes', goal: 100, start: 50, minutes: 5,
    why: 'A spread (open) triad puts the root, 5th and the 3rd an octave up (the 10th) on non-adjacent strings. It’s the wide, piano-like chord sound in Eric Johnson’s clean parts and melodies.',
    instr: 'Each bar: root, 5th, 10th, 5th as 8th notes, then pinch all three together for two beats. Strings in between stay muted by the fretting fingers. The only difference between major and minor is the top note: one fret lower for minor. Use the pick on the root and the middle and ring fingers on the upper notes (hybrid picking), or fingers only. Pass: all six bars clean twice, the skipped strings silent.',
    watch: 'The muted middle string ringing through.', simplify: 'Only the string-5 shapes.', voicings, chords, tab: { notes }
  });
}
/** Spread triads through a progression with the closest shape each time. */
export function ejSpreadProgression(c, { key = null, degrees = [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] } = {}) {
  const K = key != null ? key : majKey(c), notes = [], voicings = [], chords = []; let near = 5;
  for (const [bar, [semi, type]] of degrees.entries()) {
    const pc = mod12(K + semi), cands = [6, 5].map(set => spreadVoicing(pc, type, set, near)).filter(Boolean).filter(v => v.fret >= 1 && v.fret <= 12);
    const v = cands.sort((a, b) => Math.abs(a.fret - near) - Math.abs(b.fret - near))[0]; if (!v) return null;
    near = v.fret; spreadBar(v, bar * 4, notes);
    const nm = spreadName(pc, type); voicings.push({ name: nm, frets: v.frets }); chords.push(nm);
  }
  return make(c, {
    id: 'ej-spread-prog', name: `Spread triads through ${chords.join(' – ')}`, domain: 'theory', method: 'transfer', unit: '8th notes', goal: 96, start: 50, minutes: 6,
    why: 'Moving spread triads between the string-6 and string-5 sets keeps the hand in one area of the neck, so the chords connect smoothly instead of jumping.',
    instr: 'One chord per bar: arpeggiate root–5th–10th–5th, then pinch the three notes. For each chord take the shape closest to the last one (the diagrams show which). Let the notes ring over each other in the arpeggio. Then play the progression with your own rhythm. Pass: four bars clean over the backing, then four of your own.',
    watch: 'Moving the whole hand when the next shape is one string set over.', simplify: 'Two chords only, looped.', voicings, chords, backing: chords, tab: { notes }
  });
}
/** The chords of a major key as spread triads, climbing string set 5-4-2. */
export function ejSpreadDiatonic(c, { key = null } = {}) {
  const K = key != null ? key : majKey(c), deg = [[0, 'maj'], [2, 'min'], [4, 'min'], [5, 'maj'], [7, 'maj'], [9, 'min'], [12, 'maj']];
  const notes = [], voicings = [], chords = []; let t = 0;
  let base = fretOn(5, K, 1, 12); if (base == null) return null; if (base > 7) base -= 12; if (base < 1) base += 12;
  for (const [semi, type] of deg) {
    const pc = mod12(K + semi), v = spreadVoicing(pc, type, 5, base + semi); if (!v) return null;
    const [r, five, ten] = v.tones; [r, five, ten, five].forEach(([s, f], i) => notes.push(N(s, f, t + i * 0.5, 0.5)));
    t += 2; const nm = spreadName(pc, type); voicings.push({ name: nm, frets: v.frets }); chords.push(nm);
  }
  if (Math.max(...notes.map(n => n.f)) > 22) return null;
  const last = spreadVoicing(K, 'maj', 5, base + 12); if (last) last.tones.forEach(([s, f]) => notes.push(N(s, f, t, 2, null, { chord: true })));
  return make(c, {
    id: 'ej-spread-diatonic', name: `Spread triads: the chords of ${nameOf(K)} major`, domain: 'theory', method: 'variable', unit: '8th notes', goal: 104, start: 52, minutes: 5,
    why: 'Harmonizing the major scale in spread triads shows which chords live in the key and gives you a ready-made chord melody: the top notes spell out the scale.',
    instr: `I, ii, iii, IV, V and vi of ${nameOf(K)} major, then I an octave up, all on strings 5, 4 and 2. Two beats each: root, 5th, 10th, 5th. Major shapes have the top note two frets above the root fret; minor shapes one fret. Pass: up the key and back clean twice.`,
    watch: 'Forgetting which chords are minor (ii, iii, vi).', simplify: 'I, IV and V only.', voicings: voicings.slice(0, 8), chords, tab: { notes }
  });
}

/* ------------------------------- Generators ------------------------------- */
/** One chord built note by note: bass, bass + middle, then all three, on each set (chunking). */
export function buildSpread(c) {
  const K = majKey(c), notes = [], vs = []; let t = 0;
  for (const set of [5, 6, 4]) {
    const v = spread(nameOf(K), 0, set, 6); if (!v) return null; vs.push({ name: v.name, frets: v.frets });
    const [b, m, top] = v.tones;
    notes.push(N(b[0], b[1], t, 1), N(m[0], m[1], t + 1, 1), N(b[0], b[1], t + 2, 2, null, { chord: true }), N(m[0], m[1], t + 2, 2, null, { chord: true }));
    notes.push(N(top[0], top[1], t + 4, 2), N(b[0], b[1], t + 6, 2, null, { chord: true }), N(m[0], m[1], t + 6, 2, null, { chord: true }), N(top[0], top[1], t + 6, 2, null, { chord: true }));
    t += 8;
  }
  return make(c, {
    id: 'spread-build', name: `Spread triads, one note at a time: ${nameOf(K)} on three string sets`, domain: 'fretboard', method: 'chunking',
    unit: 'quarter notes', goal: 80, start: 50, minutes: 4, picking: 'hybrid', voicings: vs, chords: [nameOf(K)],
    why: 'Three notes on non-adjacent strings, with a string skipped and muted: too much at once for the hands. Bass, then bass and 5th, then the 10th on top, builds the grip and the muting in order.',
    instr: 'On each set: the root alone, the 5th alone, both together; then the 10th alone and all three together. Mute the skipped string with the underside of the finger fretting the 5th. Pass: all three sets with every note clear and the skipped string silent.', watch: 'The skipped string ringing.', simplify: 'The string-5 set only.', tab: { notes }
  });
}
/** Major and minor spread triads of one root, then of the 4th: only the top note moves (JG Music Lessons' drill). */
export function spreadEar(c) {
  const K = majKey(c), notes = [], vs = [], names = [];
  [[nameOf(K), 5], [nameOf(K) + 'm', 5], [nameOf(K + 5), 5], [nameOf(K + 5) + 'm', 5]].forEach(([nm, set], i) => {
    const v = spread(nm, 0, set, 6); if (!v) return; vs.push({ name: v.name, frets: v.frets }); names.push(v.name);
    const [b, m, top] = v.tones; notes.push(N(b[0], b[1], i * 4, 1), N(m[0], m[1], i * 4 + 1, 1), N(top[0], top[1], i * 4 + 2, 2));
  });
  if (names.length < 4) return null;
  return make(c, {
    id: 'spread-ear', name: `Major then minor on one root: ${names.join(', ')}`, domain: 'fretboard', method: 'accurate-reps',
    unit: 'quarter notes', goal: 72, start: 50, minutes: 4, voicings: vs, chords: names, backing: names,
    why: 'Between a major and a minor spread triad only the top note changes, by one fret. Playing the pair back to back shows what the 3rd does to the chord.',
    instr: 'Each bar: bass, middle, then the top note held for two beats. Play the major, then the minor of the same root, then the same pair on the 4th. Notice that only the top note moves. Pass: four bars clean with the skipped string silent, twice.', watch: 'Moving the bass and middle fingers when only the top note changes.', simplify: 'Only the first two bars.', tab: { notes }
  });
}
/** Diatonic chords called by numeral, played from memory on the nearest set (retrieval). */
export function spreadCalled(c, { minor = false } = {}) {
  const K = majKey(c), k = minKey(c), r = rng(minor ? 523 : 521 + (c.lvl || 5)), dia = minor ? DIA.minor(k) : DIA.major(K);
  const numerals = minor ? ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'] : ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
  const pick = []; for (let i = 0; i < 8; i++) { let j = Math.floor(r() * 7); if (dia[j].endsWith('°')) j = 0; pick.push(j); }
  const chords = pick.map(j => dia[j]);
  const x = spreadRun(c, { id: minor ? 'spread-called-minor' : 'spread-called', name: `Chords out of order: ${pick.map(j => numerals[j]).join(' – ')} in {key}`, method: 'variable', chords, inv: 'near', sets: [6, 5, 4], pattern: 'both', goal: 92, dl: minor ? 1 : 0, ...(minor ? { dia: 'minor' } : {}),
    why: 'Chord parts follow a chart, not the order of the scale. Finding the spread voicing nearest the last one for chords in any order is the skill the harmonized-scale drills prepare.',
    instr: `The numerals are ${pick.map(j => numerals[j]).join(', ')}. For each, work out the chord of the key, choose its nearest spread voicing on any set, arpeggiate and pinch it. Pass: the eight bars in time, each voicing within a few frets of the last, twice.`,
    watch: 'Jumping across the neck for root-position shapes.', simplify: 'The first four bars.' });
  return x ? { ...x, name: x.name.replace(`${nameOf(K)} major`, minor ? `${nameOf(k)} minor` : `${nameOf(K)} major`) } : x;
}
/** A chord melody: the top notes of nearest spread voicings make a tune; each bar pinches, then sings the top (use in music). */
export function spreadMelody(c, { minor = false } = {}) {
  const K = majKey(c), k = minKey(c), chords = minor ? PROG.minorFull(K, k) : PROG.ballad(K, k), notes = [], vs = []; let near = 7, lastTop = null;
  for (const [bar, nm] of chords.entries()) {
    let best = null;
    for (const set of [6, 5, 4]) for (const inv of [0, 1, 2]) { const v = spread(nm, inv, set, near); if (!v) continue; const tp = pitch(...v.tones[2]); const sc = (lastTop == null ? 0 : Math.abs(tp - lastTop)) + Math.abs(avg(v) - near) * 0.5; if (!best || sc < best.sc) best = { v, sc }; }
    if (!best) return null; const v = best.v; near = avg(v); lastTop = pitch(...v.tones[2]); vs.push({ name: v.name, frets: v.frets });
    const T = bar * 4; v.tones.forEach(([s, f]) => notes.push(N(s, f, T, 2, null, { chord: true })));
    notes.push(N(v.tones[1][0], v.tones[1][1], T + 2, 1), N(v.tones[2][0], v.tones[2][1], T + 3, 1, '~'));
  }
  const uniq = []; const seen = new Set(); vs.forEach(x => { const key = x.name + x.frets.join(','); if (!seen.has(key)) { seen.add(key); uniq.push(x); } });
  return make(c, {
    id: minor ? 'spread-melody-minor' : 'spread-melody', name: `A chord melody in spread triads: ${chords.join(' – ')}`, domain: 'improv', method: 'transfer',
    unit: 'half and quarter notes', goal: 80, start: 50, minutes: 6, picking: 'hybrid', voicings: uniq.slice(0, 8), chords, backing: chords,
    why: 'Choosing for each chord the voicing whose top note is closest to the last one turns the top notes into a melody that moves by small steps over the changes: a chord melody in Eric Johnson’s clean style.',
    instr: 'Each bar: pinch the voicing for two beats, then the middle note, then the top note with vibrato. Listen to the top line as a tune. Then keep the chords and make your own top-note melody. Pass: eight bars in time with the top line singing, then eight of your own.', watch: 'Top notes buried under the lower ones: pluck the top a little harder.', simplify: 'Pinches only.', tab: { notes }
  });
}
/** A random chord (any root, major or minor) every bar, the nearest spread voicing (interleaving). */
export function spreadRandom(c) {
  const r = rng(1301 + (c.lvl || 9)), chords = []; for (let i = 0; i < 8; i++) chords.push(nameOf(Math.floor(r() * 12)) + (r() < 0.5 ? '' : 'm'));
  return spreadRun(c, { id: 'spread-random', name: 'Random access: any major or minor chord, the nearest spread voicing', method: 'interleaving', chords, inv: 'near', sets: [6, 5, 4], pattern: 'rolled', step: 0.25, goal: 96, dl: 1,
    why: 'At mastery level any chord should become a spread voicing near your hand the moment you read it.',
    instr: 'The chords are {chords}. Read the names: find the nearest spread voicing (any set, any inversion) and roll it in 16ths. Pass: all 8 bars in time from the names, each voicing near the last.', watch: 'Jumping to root position far away.', simplify: 'The first four bars.' });
}
/** An original 8-bar study in spread triads (capstone). */
export function spreadEtude(c) {
  const K = majKey(c), chords = PROG.ballad(K, minKey(c)), notes = [], vs = []; let near = 6, t = 0;
  const pats = ['rolled', 'rolled', 'wide', 'wide', 'updown', 'updown', 'pinch', 'pinch'];
  for (const [bar, nm] of chords.entries()) {
    const v = nearest(nm, near); if (!v) return null; near = avg(v); vs.push({ name: v.name, frets: v.frets });
    const pat = pats[bar];
    if (pat === 'pinch') { [0, 1, 2].forEach(h => v.tones.forEach(([s, f]) => notes.push(N(s, f, t + h, 1, null, { chord: true })))); notes.push(N(v.tones[2][0], v.tones[2][1], t + 3, 1, '~')); }
    else { const p = PAT[pat], step = pat === 'updown' ? 0.25 : 0.5, n = Math.round(4 / step); for (let m = 0; m < n; m++) { const [s, f] = v.tones[p[m % p.length]]; notes.push(N(s, f, t + m * step, step)); } }
    t += 4;
  }
  const uniq = []; const seen = new Set(); vs.forEach(x => { const key = x.name + x.frets.join(','); if (!seen.has(key)) { seen.add(key); uniq.push(x); } });
  return make(c, {
    id: 'spread-capstone-etude', name: `Capstone study: an 8-bar spread-triad piece (${nameOf(K)} major)`, domain: 'improv', method: 'transfer',
    unit: 'mixed rhythms', goal: 88, start: 52, minutes: 8, dl: 1, picking: 'hybrid', voicings: uniq.slice(0, 8), chords, backing: chords,
    why: 'An original clean-guitar piece that uses the whole path: rolled and wide arpeggios, a 16th-note up-and-down pattern and pinched chords, every chord voice-led to the nearest spread voicing across all three string sets.',
    instr: 'Learn it two bars at a time; let the arpeggios ring. Then write your own 8 bars over the same chords with your own patterns. Pass: the study at the goal tempo with no stops, then your own version once.',
    watch: 'Skipped strings ringing in the 16th-note bars.', simplify: 'Bars 1–4.', tab: { notes }
  });
}
function as(gen, over) { return c => { const x = gen(c); if (!x) return null; const out = { ...x, id: over.id, method: over.method, name: over.name ? over.name(x) : x.name }; if (over.goal) { out.goalBpm = goalFor(c, over.goal); out.startBpm = Math.max(30, Math.min(Math.round(out.goalBpm * 0.6), out.goalBpm - 4)); } if (over.instr) out.instr = over.instr; return out; }; }


/* ------------------------------ Study notes ------------------------------ */
const ST = (concept, why, theory) => ({ concept, why, theory });
const STUDY = {
  'spread-build': ST('A spread (open) triad takes a close-position triad and lifts its middle note an octave, so the three tones sit on non-adjacent strings with one string skipped between them: root, 5th, then the 3rd an octave up (the 10th).', 'The wide spacing gives the piano-like chord sound used in clean guitar parts, and each voicing is a small, reusable grip.', ['Root position is R–5–10 from the bass up; the 1st and 2nd inversions are 3–R–5 and 5–3–R.', 'Shapes are grouped by the string the bass note is on: the 6th, 5th or 4th string.', 'The skipped string is damped by the underside of a fretting finger.']),
  'spread-hear': ST('Between a major and a minor spread triad of the same root only the top note moves, by one fret, because the 3rd is the only tone that changes.', 'Comparing the pair is how the quality of a shape is learned, and I–IV–V–I is the first progression to use them in.', ['Major 3rd = 4 semitones above the root, minor 3rd = 3; the 10th is that note an octave up.', 'Moving the shape to a new root moves every tone by the same number of frets.']),
  'spread-touch': ST('The three tones are plucked together (pick on the bass, fingers on the upper notes) or rolled one after another with every note left to ring.', 'Pick and fingers is the hybrid-picking style these voicings are usually played in; letting them ring gives the harp-like sound.', ['Pinch = bass with the pick, upper tones with the middle and ring fingers.', 'A rolled chord keeps each finger down so notes overlap.']),
  'spread-first-music': ST('One spread triad per chord of a progression, chosen near the last, with a melody over the top.', 'Chords that connect smoothly are the point of the shapes; this is the first time they are used in a part.', ['Moving between the 6th- and 5th-string sets keeps the hand in one region of the neck.']),
  'spread-key': ST('Harmonizing the major scale gives a triad on every degree (I ii iii IV V vi vii°); each one becomes a spread voicing.', 'It shows which chords belong to a key and gives a ready-made chord melody: the top notes follow the scale.', ['Major key triads: major, minor, minor, major, major, minor, diminished.', 'The vii° has a flattened 5th, so its middle note is a fret lower than a minor shape.', 'The same harmonization works on each of the three string sets.']),
  'spread-inversions': ST('Each chord has three spread shapes (root, 3rd or 5th in the bass), in major and minor, on each string set.', 'Knowing all three means there is always a shape near the hand, and the nearest one makes the chords connect.', ['Inversions cycle R–5–3, 3–R–5, 5–3–R.', 'Voice leading: choose the voicing closest to the last chord’s notes.']),
  'spread-control': ST('Chords are called in any order, the top note is brought out, and the same progression is moved to other keys.', 'Charts do not follow scale order, and parts are rarely in one key.', ['Pluck the top note a little harder to make it the melody.', 'Moving I–IV–V–I up a 4th each time visits the keys of the cycle of fourths.']),
  'spread-music': ST('A chord melody: the top notes of nearest voicings form a tune over the chords.', 'It is the musical use of the shapes: melody and harmony in one part.', ['Choose the inversion whose top note is closest to the previous top note.']),
  'spread-arps': ST('Arpeggios through the three tones in patterns (up and back, wide) in 16ths and triplets.', 'Patterns turn voicings into flowing clean-guitar textures.', ['Wide pattern: bass–top–middle–top.', 'Four-note patterns against triplets cross the beat.']),
  'spread-minor': ST('The natural minor key’s triads (i, ii°, ♭III, iv, v, ♭VI, ♭VII) as spread voicings.', 'Minor-key parts need the same fluency as major-key ones.', ['Minor triads have the 10th one fret lower than major.']),
  'spread-adv-control': ST('Minor-key chords played out of order, and the voicings picked one note at a time with a plain pick.', 'The voicings must work for any chord order and for a player without the fingers.', ['Spread voicings suit fingerpicking and can also be picked note by note.']),
  'spread-adv-music': ST('A chord melody and a solo in a minor key built on the spread shapes.', 'It uses the minor-key voicings in music.', ['The top notes of the voicings are good targets for a solo.']),
  'spread-performance': ST('The flowing 16th-note texture and the harmonized key played at tempo with nearest voicings.', 'The shapes must be a reflex before they can be played at performance speed.', ['Raise the tempo in small steps after clean passes.']),
  'spread-random-access': ST('Any major or minor chord in any key is found as a nearby spread voicing from its name.', 'It is the end state of the path: chord names turn into shapes without a diagram.', ['Choose by distance from the hand, not by always starting from the root.']),
  'spread-voice': ST('A capstone study that combines rolled, wide, up-and-back and pinched textures with voice-led chords, then a version of your own.', 'It is the technique in music.', ['Plan the top notes first, then fit the lower tones.'])
};
const S2 = (id, title, domain, summary, ex) => S(id, title, domain, summary, ex, STUDY[id]);

/* --------------------------------- The path --------------------------------- */
const SP = 'A spread triad: three tones on a bass string, the next string up, and the string two above that, with the string between muted; ';
export default entry({
  id: 'spreadTriads', kind: 'technique', title: 'Spread triads', domain: 'theory',
  re: /spread(-| )?triads?|open(-| )?(voiced )?triads?|wide triads?|spread voicings?|10ths?\b|tenths/,
  aliases: ['open triads', 'tenths', 'open-voiced triads'],
  summary: 'Triads opened out over three strings with one skipped (root, 5th and 10th, and their inversions): from the first grip to the chords of a key, voice leading, arpeggio patterns and chord melodies in clean, piano-like textures.',
  prereqs: ['hybridPicking'],
  pedagogy: {
    date: '2026-10-22',
    summary: 'Spread (open-voiced) triads are taught by starting from a close-position triad and lifting the middle note an octave, then learning the shapes by bass string (6th, 5th, 4th) in root position and two inversions, major and minor, as chords and as arpeggios; then harmonizing the major scale, choosing inversions that move smoothly through progressions, adding a melody on the top note, and finally using the voicings in clean, pianistic parts with pick and fingers.',
    sequence: [
      { id: 'construct', tier: 'foundations', step: 'Build the voicing from a close triad', how: 'Take the close-position triad and raise (or lower) the middle note an octave; learn the three tones and the skipped string for the root-position shape.', skills: ['spread-build'], source: 1 },
      { id: 'quality', tier: 'foundations', step: 'Major and minor of one root; I–IV–V–I', how: 'Play a major and a minor spread triad from the same root and hear what the 3rd changes; use the voicings for the main chords of a key.', skills: ['spread-hear'], source: 2 },
      { id: 'touch', tier: 'foundations', step: 'Pick and fingers; let it ring', how: 'Pick the bass and pluck the upper notes with fingers, as chords and as arpeggios; fingerpicking and picking note by note both work.', skills: ['spread-touch'], source: 4 },
      { id: 'first', tier: 'foundations', step: 'A first progression', how: 'Spread triads through a short progression, with smooth changes between chords.', skills: ['spread-first-music'], source: 2 },
      { id: 'harmonize', tier: 'intermediate', step: 'Harmonize the major scale', how: 'A spread triad on each degree of the major scale, on the 6th, 5th and 4th string sets.', skills: ['spread-key'], source: 1 },
      { id: 'inversions', tier: 'intermediate', step: 'Inversions, major and minor, voice leading', how: 'Root position and the two inversions of major and minor shapes on each string set; the inversion that moves smoothly from the last chord.', skills: ['spread-inversions'], source: 1 },
      { id: 'top', tier: 'intermediate', step: 'The top line and other keys', how: 'A melody on the top notes of the voicings; the same progressions in other keys.', skills: ['spread-control'], source: 0 },
      { id: 'music2', tier: 'intermediate', step: 'A chord melody', how: 'Top-note melody over a progression, with the lower notes as accompaniment.', skills: ['spread-music'], source: 3 },
      { id: 'patterns', tier: 'advanced', step: 'Arpeggio patterns', how: 'Arpeggiated voicings in flowing patterns in the clean style, with pick and fingers.', skills: ['spread-arps'], source: 4 },
      { id: 'minor', tier: 'advanced', step: 'The minor key', how: 'The same harmonization and progressions in a minor key, major and minor shapes together.', skills: ['spread-minor'], source: 1 },
      { id: 'out', tier: 'advanced', step: 'Any order; pick alone', how: 'Chords chosen in any order, and the voicings played one note at a time with a pick.', skills: ['spread-adv-control'], source: 2 },
      { id: 'music3', tier: 'advanced', step: 'Minor chord melody and solo', how: 'Top-note melody and chord-tone soloing in a minor key.', skills: ['spread-adv-music'], source: 3 },
      { id: 'tempo', tier: 'mastery', step: 'At tempo', how: 'The flowing textures and the harmonized key played at performance tempo.', skills: ['spread-performance'], source: 4 },
      { id: 'any', tier: 'mastery', step: 'Any chord, any key', how: 'Any major or minor chord found as a nearby voicing from its name.', skills: ['spread-random-access'], source: 2 },
      { id: 'own', tier: 'mastery', step: 'A study of your own', how: 'An original part combining the textures, then your own.', skills: ['spread-voice'], source: 3 }
    ],
    drills: ['Close triad versus its spread version', 'Major and minor spread triad from one root', 'Each string set and inversion as a block chord and as an arpeggio', 'Harmonizing a major scale with spread triads on each string set', 'Progressions with inversions chosen to move smoothly', 'A top-note melody over the chords', 'Pick-and-finger arpeggios of open-voiced chords'],
    mistakes: ['The skipped string ringing', 'Fingers arriving after the pick when plucking the three notes together', 'Jumping to root position for every chord instead of the nearest shape', 'Playing the wider stretches fast before they are clean', 'Burying the top note under the lower ones'],
    sources: [
      { title: 'Spread Triads: Making the Guitar Sound Beautiful', author: 'Elliott Klein (Guitar World)', url: 'https://guitarworld.com/lessons/spread-triads-making-guitar-sound-beautiful' },
      { title: 'Spread Triads', author: 'Applied Guitar Theory', url: 'https://appliedguitartheory.com/lessons/spread-triads/' },
      { title: 'How to play spread triad chords on guitar', author: 'JG Music Lessons', url: 'https://jgmusiclessons.com/how-to-play-spread-triad-chords-on-the-guitar-chord-charts-and-examples' },
      { title: 'Eric Johnson: Concepts and Techniques', author: 'Premier Guitar', url: 'https://www.premierguitar.com/eric-johnson-concepts-and-techniques' },
      { title: '5 guitar tricks you can learn from Eric Johnson today', author: 'MusicRadar', url: 'https://www.musicradar.com/how-to/5-guitar-tricks-you-can-learn-from-eric-johnson-today' }
    ]
  },
  sources: ['https://guitarworld.com/lessons/spread-triads-making-guitar-sound-beautiful', 'https://appliedguitartheory.com/lessons/spread-triads/', 'https://jgmusiclessons.com/how-to-play-spread-triad-chords-on-the-guitar-chord-charts-and-examples', 'https://www.premierguitar.com/eric-johnson-concepts-and-techniques', 'https://www.musicradar.com/how-to/5-guitar-tricks-you-can-learn-from-eric-johnson-today'],
  ctx: { key: 4, minor: false, prog: 'axis' },
  stages: [
    stage('foundations', 'The spread grip',
      'Build a spread triad note by note on three string sets with the skipped string silent, play major and minor shapes on all three sets at 80 BPM, play major and minor on one root and see that only the top note moves, play I–IV–V–I on the string-5 set, pinch them in time, let a rolled arpeggio ring evenly, and play a progression voice-led between sets.', [
        S2('spread-build', 'Building the shape', 'fretboard', 'One note at a time, then major and minor on every set.', [c => buildSpread(c), c => ejSpreadShapes(c)]),
        S2('spread-hear', 'Major and minor on one root', 'fretboard', 'The top note decides the quality; I–IV–V–I on one set.', [c => spreadEar(c),
          T_('spread-names', 'I–IV–V–I as spread triads on the string-5 set ({key})', 'accurate-reps', { prog: 'oneFourFive', sets: [5], inv: 0, pattern: 'rolled', step: 0.5, goal: 84, start: 50, why: SP.replace('; ', '. ') + 'Playing the three main chords of the key on one string set shows how the same grip moves with the root.', instr: SP + 'roll each chord (bass, middle, top, middle) in 8th notes, one chord per bar, on the string-5 set. Pass: the four bars clean twice, the skipped string silent.', watch: 'The top note landing on the wrong fret when the chord changes from major to minor.', simplify: 'Two chords.' })]),
        S2('spread-touch', 'Pinch and ring', 'picking', 'Pick plus fingers; letting it ring.', [
          T_('spread-pinch', 'Pinched spread triads on three sets: {chords}', 'variable', { prog: 'oneFourFive', sets: [6, 5, 4, 5], inv: 0, pattern: 'pinch', goal: 84, start: 50, why: 'Plucking all three tones at once (pick on the bass, middle and ring fingers on the others) is the piano-like sound. Changing set every bar makes the hand re-find the grip.', instr: SP + 'pinch the three tones together on every beat, one chord per bar, a new string set each bar. Pass: four bars where the three notes sound as one, twice.', watch: 'A flam: the fingers arriving after the pick.', simplify: 'One set.' }),
          T_('spread-ring', 'Let it ring: rolled spread triads over {chords}', 'external-focus', { prog: 'axis', sets: [5], inv: 'near', pattern: 'rolled', step: 0.5, goal: 80, start: 50, why: 'In a rolled spread triad each note keeps ringing under the next, which is what makes it sound like a piano or a harp. The goal is the sound: an even, ringing chord, no buzz, no extra strings.', instr: SP + 'roll each chord (bass, middle, top, middle), keeping every finger down so the notes overlap. Listen for an even, bell-like chord. Pass: four bars that ring cleanly, twice.', watch: 'Lifting fingers so notes stop.', simplify: 'Quarter notes.' })]),
        S2('spread-first-music', 'First music', 'improv', 'A progression, voice-led.', [c => ejSpreadProgression(c), c => targetGuide(c, { prog: 'axis', scale: 'majorPent', name: 'Melody over I–V–vi–IV: start each phrase from the top note of the chord' })])
      ], [1, 3]),
    stage('intermediate', 'The chords of the key',
      'Play every chord of the major key as spread triads on the string-5, string-6 and string-4 sets, all three inversions of a chord, voice-lead a progression to the nearest voicing, play the key’s chords out of order from their numerals, bring out the top line of a progression, play I–IV–V in four keys, and play a chord melody.', [
        S2('spread-key', 'Harmonize the major scale', 'theory', 'The key’s chords on three sets.', [c => ejSpreadDiatonic(c),
          T_('spread-dia-6', 'The chords of {key} on the string-6 set', 'variable', { dia: 'major', sets: [6], inv: 0, climb: true, near: 1, pattern: 'rolled', beats: 2, step: 0.5, goal: 96, why: 'The same harmonized scale with the bass on the low E string: deeper, and a different hand shape for each quality.', instr: SP + 'each chord of the key in turn, two beats each, rolled. Pass: up the key clean twice.', watch: 'The diminished vii°: its 5th is a fret lower.', simplify: 'I, IV and V.' }),
          T_('spread-dia-4', 'The chords of {key} on the string-4 set', 'variable', { dia: 'major', sets: [4], inv: 0, climb: true, near: 1, pattern: 'rolled', beats: 2, step: 0.5, goal: 96, why: 'On the top strings the spread triads are bright and sit right where melodies are.', instr: SP + 'each chord of the key, two beats each, rolled. Pass: up the key clean twice.', watch: 'Muting the B string while fretting the G and high e.', simplify: 'I, IV and V.' })]),
        S2('spread-inversions', 'Inversions and voice leading', 'fretboard', 'Three shapes per chord; the nearest one.', [
          T_('spread-inv', 'One chord, three inversions: {chords} on the string-5 set', 'variable', { chords: null, prog: 'oneFourFive', sets: [5], invs: [0, 1, 2, 0], climb: true, pattern: 'both', goal: 92, why: 'Every triad has three spread shapes: root, 3rd or 5th in the bass. Knowing all three means there is always one nearby.', instr: SP + 'bar 1 root position, bar 2 1st inversion (3rd in the bass), bar 3 2nd inversion (5th in the bass), bar 4 root position again, arpeggiated then pinched. Pass: four bars clean twice.', watch: 'Losing which note is the root.', simplify: 'Root position and 1st inversion.' }),
          c => { const K = majKey(c), n = nameOf(K); return spreadRun(c, { id: 'spread-inv-quality', name: `Major and minor in all three inversions: ${n} and ${n}m on the string-5 set`, method: 'accurate-reps', chords: [n, n + 'm', n, n + 'm', n, n + 'm'], invs: [0, 0, 1, 1, 2, 2], sets: [5], pattern: 'both', goal: 88, why: 'Every spread shape comes in major and minor and in three inversions. Playing each pair side by side, on one string set, is the standard way to learn the set.', instr: SP + 'six bars: root position major and minor, 1st inversion major and minor, 2nd inversion major and minor; each arpeggiated and then pinched. Pass: the six bars clean twice.', watch: 'Moving the whole hand when only one note changes between major and minor.', simplify: 'Root position and 1st inversion.' }); },
          T_('spread-lead', 'Voice-led spread triads: {chords}, the nearest shape', 'interleaving', { prog: 'ballad', inv: 'near', sets: [6, 5, 4], pattern: 'both', goal: 92, why: 'Taking the nearest voicing for each chord (any set, any inversion) keeps the hand in one place and makes the inner voices move smoothly: how good chord parts are built.', instr: SP + 'for each chord, the voicing closest to the last one. Arpeggiate, then pinch. Pass: all eight bars clean, staying within five frets.', watch: 'Jumping to root position.', simplify: 'The first four bars.' })]),
        S2('spread-control', 'The top line and other keys', 'theory', 'Chords out of order; the melody on top; four keys.', [c => spreadCalled(c),
          T_('spread-top', 'Bring out the top note: {chords}', 'external-focus', { prog: 'axis', inv: 'near', sets: [5, 4], pattern: 'wide', step: 0.5, goal: 92, why: 'In a wide pattern (bass, top, middle, top) the top note sounds twice per bar. Plucking it a little stronger turns the top line into a melody over the chords.', instr: SP + 'play bass, top, middle, top in 8ths, the top note slightly louder. Listen for the top line. Pass: four bars where the top line sings over the rest.', watch: 'Everything at one volume.', simplify: 'Quarter notes.' }),
          T_('spread-keys', 'I–IV–V–I in four keys around the cycle of fourths', 'interleaving', { prog: 'oneFourFive', keys: [0, 5, 10, 3], inv: 'near', sets: [6, 5], pattern: 'rolled', step: 0.5, goal: 92, dl: 1, why: 'Spread triads are built from the chord, so the same progression works in every key; changing key every four bars trains finding them fast.', instr: SP + 'I–IV–V–I in each key, the nearest voicings, a 4th up each time. Pass: all four keys without stopping.', watch: 'Stopping at the key change.', simplify: 'Two keys.' })]),
        S2('spread-music', 'In music', 'improv', 'A chord melody, and a solo.', [c => spreadMelody(c), c => targetGuide(c, { prog: 'folkAxis', scale: 'major', name: 'Solo over I–vi–IV–V: chord tones from the spread shapes as targets' })])
      ], [4, 6]),
    stage('advanced', 'Patterns, minor keys and colour',
      'Arpeggiate voice-led spread triads in 16ths and in wide patterns at 96 BPM, harmonize the minor key and play a minor progression, find any diatonic chord of the minor key from its numeral, shape soft arpeggios against strong pinches, and play a minor-key chord melody.', [
        S2('spread-arps', 'Arpeggio patterns', 'picking', 'Hybrid-picked patterns through the changes.', [
          T_('spread-arp-16', 'Spread triads up and down in 16ths: {chords}', 'variable', { prog: 'ballad', inv: 'near', sets: [6, 5, 4], pattern: 'updown', step: 0.25, goal: 96, why: 'Up and back through the three tones in 16ths makes a flowing harp-like texture; with the nearest voicings it never jumps.', instr: SP + 'pattern bass–middle–top–middle–top–middle–bass–middle, two per bar, hybrid picked. Pass: all eight bars clean at the goal tempo.', watch: 'The skipped strings sounding at speed.', simplify: '8th notes.' }),
          T_('spread-arp-wide', 'Wide pattern as triplets: {chords}', 'variable', { prog: 'axis', inv: 'near', sets: [6, 5, 4], pattern: 'wide', step: 1 / 3, goal: 96, why: 'Bass, top, middle, top in triplets: the four-note pattern against a three-note pulse rolls across the beat.', instr: SP + 'the wide pattern as triplets. Pass: four bars clean at the goal tempo.', watch: 'Accenting the bass every time it comes round: accent the beat.', simplify: '8th notes.' })]),
        S2('spread-minor', 'The minor key', 'theory', 'Harmonized minor; a minor progression.', [
          T_('spread-dia-minor', 'The chords of {key} as spread triads', 'variable', { dia: 'minor', inv: 'near', sets: [6, 5, 4], pattern: 'rolled', beats: 2, step: 0.5, goal: 96, why: 'The natural minor key’s chords (i, ii°, ♭III, iv, v, ♭VI, ♭VII) in spread voicings: the darker clean palette.', instr: SP + 'each chord of the minor key, two beats, the nearest voicing. Pass: up the key clean twice.', watch: 'The ii° chord.', simplify: 'i, iv and v.' }),
          T_('spread-minor-prog', 'A minor progression: {chords}', 'variable', { prog: 'minorFull', inv: 'near', sets: [6, 5, 4], pattern: 'both', goal: 92, why: 'Eight bars of minor-key harmony, voice-led, arpeggiated then pinched: a real clean rhythm part.', instr: SP + 'one chord per bar, the nearest voicing. Pass: all eight bars clean at the goal tempo.', watch: 'The iv to v move.', simplify: 'The first four bars.' })]),
        S2('spread-adv-control', 'Minor chords out of order; pick alone', 'theory', 'Minor chords in any order; the pick alone.', [c => spreadCalled(c, { minor: true }),
          c => { const x = spreadRun(c, { id: 'spread-pick-only', name: 'Pick alone: {chords} rolled one note at a time', method: 'variable', prog: 'ballad', inv: 'near', sets: [6, 5, 4], pattern: 'rolled', step: 0.5, goal: 92, why: 'Spread voicings also work with a plain pick, one note at a time. Playing them without the fingers shows how the same shapes serve a player who does not use hybrid picking.', instr: SP + 'roll each chord (bass, middle, top, middle) with alternate picking only, letting the notes ring. Pass: all eight bars clean, the skipped strings silent.', watch: 'The pick catching the skipped string.', simplify: 'The first four bars.' }); return x ? { ...x, picking: 'alternate' } : x; }]),
        S2('spread-adv-music', 'In music', 'improv', 'A minor chord melody, and a solo.', [c => spreadMelody(c, { minor: true }), c => targetGuide(c, { prog: 'progMinor', scale: 'minor', name: 'Minor-key solo: aim for the top notes of the spread voicings' })])
      ], [7, 8]),
    stage('mastery', 'Fluent and your own',
      'Play voice-led 16th-note arpeggios through eight chords at about 110 BPM and the major key in 16ths across the neck, any chord on demand, and perform your own 8-bar spread-triad piece.', [
        S2('spread-performance', 'Performance tempo', 'picking', 'At speed.', [
          as(T_('spread-x', '', 'edge', { prog: 'ballad', inv: 'near', sets: [6, 5, 4], pattern: 'updown', step: 0.25, goal: 104, why: 'The flowing 16th-note texture through eight chords at tempo.', instr: SP + 'tempo ladder: add a few BPM after each clean pass. Pass: all eight bars at the goal tempo.', watch: 'Forearm tension.', simplify: '8th notes.' }), { id: 'spread-arp-fast', method: 'edge', name: x => `Spread triads: arpeggios at performance tempo (${x.chords.slice(0, 4).join(' – ')} …)` }),
          T_('spread-dia-fast', 'The chords of {key} rolled in 16ths, nearest voicings', 'edge', { dia: 'major', inv: 'near', sets: [6, 5, 4], pattern: 'rolled', beats: 2, step: 0.25, goal: 100, why: 'The whole harmonized key at tempo with the nearest voicings: chord knowledge as reflex.', instr: SP + 'tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'The vii° chord.', simplify: '8th notes.' })]),
        S2('spread-random-access', 'Any chord, any time', 'theory', 'No warning.', [c => spreadRandom(c), c => targetGuide(c, { prog: 'axis', scale: 'majorPent', name: 'Clean solo over I–V–vi–IV: phrases that start from spread-triad tones' })]),
        S2('spread-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => spreadEtude(c), c => targetGuide(c, { prog: 'capo', scale: 'major', name: 'Ballad changes: your own chord melody, then a solo' })])
      ], [9, 10])
  ]
});
