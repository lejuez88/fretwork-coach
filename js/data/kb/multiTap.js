// Multi-finger tapping: tapped chords and double stops. The picking hand taps with two or three fingers
// (index, middle, ring) on one or several strings, alone, as two-note "combos" struck together, or in
// octaves, while the fretting hand plays bass notes and chord tones with hammer-ons from nowhere: the
// piano-like, two-handed chord sound of Tosin Abasi, Chris Letchford and modern prog players.
//
// Concept-first (CONTENT.md): every bar is one chord of the key (9th chords: i m9, ♭VI maj9, ♭VII add9,
// iv m9 in minor; I maj9, vi m9, IV maj9, V add9 in major). The fretting hand owns a BASS GRIP: the root
// on the low E or A string (frets 2–10), the 5th and the octave on the next two strings, the 9th a whole
// step above the root. The tapping hand owns a TAP ZONE five to twelve frets above the root on the upper
// strings, where it plays the chord's colour tones (3rd, 7th, 9th) as single taps, two-note combos
// (double stops) or octaves. In the first stage there is no bass grip: the fretting hand holds a
// chord-tone note or dyad and the taps pull off to it. Each exercise is a CELL (one cycle of slots, each
// slot one or more simultaneous notes) repeated over each chord; `mtRun(c, spec)` builds it from cell ×
// progression × beats per chord × keys. Every note is a tone of its bar's chord (the walking bass's
// fourth note is a half-step approach into the next root), tagged for the pitch check.
//
// Teaching method first (CONTENT.md, `pedagogy` below), researched 2026-10-18: two tapping fingers on one
// string, then one finger per string over a held chord, then double-stop taps; then hands apart (bass in
// the fretting hand, colour-tone combos in the tapping hand, a 3+3+2 rhythm), hands together, tapped
// octaves over add9 shapes, taps over a held chord; then five-note tapped arpeggios, tapped slides,
// staccato unison taps between the hands and a moving bass line under the taps; finally tempo, long
// progressions and an original study.
import { OPEN, N, nameOf, make, mod12, chordInfo, S, stage, entry } from '../lib.js';
import { tonesOn } from './tapping.js';
import { grip as gripOn } from './hybridPicking.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const pitch = (s, f) => OPEN[s] + f;
const SN = { 1: 'high e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'low E' };
/** Progressions as [semitones above the key root, chord suffix]. */
export const PROGS = {
  minor: [[0, 'm9'], [8, 'maj9'], [10, 'add9'], [5, 'm9']],            // i – ♭VI – ♭VII – iv
  major: [[0, 'maj9'], [9, 'm9'], [5, 'maj9'], [7, 'add9']],            // I – vi – IV – V
  minor2: [[0, 'm9'], [10, 'add9'], [8, 'maj9'], [3, 'maj9']],          // i – ♭VII – ♭VI – ♭III
  major2: [[0, 'maj9'], [7, 'add9'], [9, 'm9'], [5, 'maj9']],           // I – V – vi – IV
  long: [[0, 'm9'], [5, 'm9'], [10, 'add9'], [3, 'maj9'], [8, 'maj9'], [5, 'm9'], [10, 'add9'], [0, 'm9']]
};
const pickProg = (c, id) => (id === 'auto' ? (c.minor ? 'minor' : 'major') : id === 'auto2' ? (c.minor ? 'minor2' : 'major2') : id === 'long' ? 'long' : (c.minor ? 'minor' : 'major'));
export const chordsOf = (k, prog) => PROGS[prog].map(([o, q]) => nameOf(k + o) + q);
/** The key's scale (natural minor or major) as pitch classes. */

/** The fretting hand's bass grip: root on string 6 or 5 (frets 2–10) nearest `near`; 5th, octave, 9th. */
export function bassGrip(ch, near = 6) {
  let best = null;
  for (const sb of [6, 5]) for (let f = 2; f <= 10; f++) {
    if (mod12(pitch(sb, f)) !== ch.pc) continue;
    const d = Math.abs(f - near) + (sb === 5 ? 0.5 : 0);
    if (!best || d < best.d) best = { sb, f, d };
  }
  if (!best) return null;
  const { sb, f } = best;
  return { sb, fR: f, R: [sb, f], P5: [sb - 1, f + 2], O: [sb - 2, f + 2], NINE: [sb, f + 2], ups: sb === 6 ? [3, 2, 1] : [2, 1] };
}
/** Colour tones of a chord: everything but the root and 5th (3rd, 7th, 9th). */
const colourOf = ch => ch.pcs.filter(p => p !== ch.pc && p !== mod12(ch.pc + 7));
/**
 * A two-note tapped combo on adjacent strings a (lower) and b = a − 1: chord tones, frets at most 3 apart,
 * inside [lo, hi], nearest `anchor`; colour tones preferred. Returns [fa, fb] or null.
 */
export function combo(ch, a, lo, hi, anchor, avoid = null) {
  const b = a - 1, all = ch.pcs, col = colourOf(ch); let best = null;
  for (const fa of tonesOn(all, a, lo, Math.min(22, hi))) for (const fb of tonesOn(all, b, lo, Math.min(22, hi))) {
    if (Math.abs(fa - fb) > 3 || mod12(pitch(a, fa)) === mod12(pitch(b, fb))) continue;
    if (avoid && avoid[0] === fa && avoid[1] === fb) continue;
    const nCol = [col.includes(mod12(pitch(a, fa))), col.includes(mod12(pitch(b, fb)))].filter(Boolean).length;
    const d = Math.abs((fa + fb) / 2 - anchor) + (2 - nCol) * 2;
    if (!best || d < best.d) best = { v: [fa, fb], d };
  }
  return best ? best.v : null;
}
/** First-stage shape on one string: fretted L, taps T1 < T2 (index, middle), all chord tones. */
export function oneShape(ch, s, near) {
  let best = null;
  for (const L of tonesOn(ch.pcs, s, Math.max(1, near - 1), near + 4)) for (const T1 of tonesOn(ch.pcs, s, L + 2, L + 8)) for (const T2 of tonesOn(ch.pcs, s, T1 + 1, T1 + 5)) {
    if (T2 > 22) continue;
    const d = Math.abs(L - near) + (T2 - T1) * 0.5 + Math.abs(T1 - L - 5) * 0.3;
    if (!best || d < best.d) best = { s, L, T1, T2, d };
  }
  return best;
}
/** First-stage shape on two strings a, a − 1: a fretted chord-tone dyad and a tapped combo above it. */
export function twoShape(ch, a, near) {
  const b = a - 1; let best = null;
  for (const La of tonesOn(ch.pcs, a, Math.max(1, near - 1), near + 4)) for (const Lb of tonesOn(ch.pcs, b, Math.max(1, near - 1), near + 4)) {
    if (Math.abs(La - Lb) > 3 || mod12(pitch(a, La)) === mod12(pitch(b, Lb))) continue;
    const top = Math.max(La, Lb), T = combo(ch, a, top + 3, Math.min(La, Lb) + 10, top + 5);
    if (!T || T[0] <= La + 1 || T[1] <= Lb + 1) continue;
    const d = Math.abs(La - near) + Math.abs(T[0] - T[1]) * 0.5;
    if (!best || d < best.d) best = { a, b, La, Lb, Ta: T[0], Tb: T[1], d };
  }
  return best;
}
/** Tapped octave of the chord's 3rd on the G and high e strings (index on the G, ring on the e), above the grip. */
function octaveTap(ch, g) {
  const third = ch.pcs.find(p => p === mod12(ch.pc + 3) || p === mod12(ch.pc + 4));
  const fs = tonesOn([third], 3, g.fR + 4, Math.min(19, g.fR + 15)).sort((x, y) => Math.abs(x - g.fR - 9) - Math.abs(y - g.fR - 9));
  return fs.length ? fs[0] : null;
}

/* ------------------------------- The cells ------------------------------- */
// A cell is a function (shape context) => { step, slots: [[note, …] | null, …] }; each note is
// { s, f, x, fing, d }. The renderer repeats the slots to fill the bar.
const T = (s, f, fing) => ({ s, f, x: 't', fing });
const P = (s, f) => ({ s, f, x: 'p' });
const H = (s, f) => ({ s, f, x: 'h' });
export const CELLS = {
  one: { unit: '8th notes', name: 'two taps on one string', need: 'one', make: ({ sh }) => ({ step: 0.5, slots: [[T(sh.s, sh.T1, 'i')], [P(sh.s, sh.L)], [T(sh.s, sh.T2, 'm')], [P(sh.s, sh.L)]] }) },
  two: { unit: '8th notes', name: 'one finger per string', need: 'two', make: ({ sh }) => ({ step: 0.5, slots: [[T(sh.a, sh.Ta, 'i')], [P(sh.a, sh.La)], [T(sh.b, sh.Tb, 'm')], [P(sh.b, sh.Lb)]] }) },
  two16: { unit: '16th notes', name: 'one finger per string in 16ths', need: 'two', make: ({ sh }) => ({ step: 0.25, slots: [[T(sh.a, sh.Ta, 'i')], [P(sh.a, sh.La)], [T(sh.b, sh.Tb, 'm')], [P(sh.b, sh.Lb)]] }) },
  dstop: { unit: '8th notes', name: 'double-stop taps', need: 'two', make: ({ sh }) => ({ step: 0.5, slots: [[T(sh.a, sh.Ta, 'i'), T(sh.b, sh.Tb, 'm')], [P(sh.a, sh.La), P(sh.b, sh.Lb)]] }) },
  dstop16: { unit: '16th notes', name: 'double-stop taps in 16ths', need: 'two', make: ({ sh }) => ({ step: 0.25, slots: [[T(sh.a, sh.Ta, 'i'), T(sh.b, sh.Tb, 'm')], [P(sh.a, sh.La), P(sh.b, sh.Lb)]] }) },
  // hands apart, 3 + 3 + 2 in 8ths: bass, bass, combo | bass, bass, combo | bass, combo
  apart: { unit: '8th notes (3 + 3 + 2)', name: 'hands apart, 3 + 3 + 2', need: 'grip', make: ({ g, D1, D2, move }) => { const R = H(...g.R), F = H(...g.P5), O = H(...g.O), A = cmb(g, D1), B = cmb(g, move ? D2 : D1); return { step: 0.5, slots: [[R], [F], A, [R], [F], B, [O], A] }; } },
  // hands together: bass on the beats, combos on the off-beats (one off-beat left open)
  together: { unit: '8th notes', name: 'hands together', need: 'grip', make: ({ g, D1, D2, move }) => { const A = cmb(g, D1), B = cmb(g, move ? D2 : D1); return { step: 0.5, slots: [[H(...g.R)], A, [H(...g.P5)], B, [H(...g.O)], null, [H(...g.P5)], A] }; } },
  // add9 shape in the fretting hand (root, 9th, 5th by hammer-ons), the tapped octave on G and e
  octave: { unit: '16th notes', name: 'add9 shape and tapped octaves', need: 'oct', make: ({ g, oct }) => ({ step: 0.25, slots: [[H(...g.R)], [H(...g.NINE)], [H(...g.P5)], [T(3, oct, 'i'), T(1, oct + 3, 'a')]] }) },
  octave6: { unit: '16th-note sextuplets', name: 'add9 shape and tapped octaves in sextuplets', need: 'oct', make: ({ g, oct }) => ({ step: 1 / 6, slots: [[H(...g.R)], [H(...g.NINE)], [H(...g.P5)], [T(3, oct, 'i'), T(1, oct + 3, 'a')], [H(...g.P5)], [H(...g.NINE)]] }) },
  // a held chord: the four strings picked, then two taps pulling off to the chord
  held: { unit: '8th notes', name: 'taps over a held chord', need: 'held', make: ({ hg }) => ({ step: 0.5, slots: [[{ s: 4, f: hg.at[4] }], [{ s: 3, f: hg.at[3] }], [{ s: 2, f: hg.at[2] }], [{ s: 1, f: hg.at[1] }], [T(1, hg.t1, 'i')], [P(1, hg.at[1])], [T(2, hg.t2, 'm')], [P(2, hg.at[2])]] }) },
  // five notes: root, 5th, octave (fretting hand), then middle and ring taps on the upper strings
  five: { unit: 'quintuplets', name: 'five-note tapped arpeggios', need: 'five', make: ({ g, ft }) => ({ step: 0.2, slots: [[H(...g.R)], [H(...g.P5)], [H(...g.O)], [T(ft[0][0], ft[0][1], 'm')], [T(ft[1][0], ft[1][1], 'a')]] }) },
  five16: { unit: '16th notes (groups of 5)', name: 'five-note groups over 16ths', need: 'five', make: ({ g, ft }) => ({ step: 0.25, slots: [[H(...g.R)], [H(...g.P5)], [H(...g.O)], [T(ft[0][0], ft[0][1], 'm')], [T(ft[1][0], ft[1][1], 'a')]] }) },
  // a tapped combo, slid up to the next combo, pulled off to the fretted dyad
  slide: { unit: '8th-note triplets', name: 'tapped combo slides', need: 'slide', make: ({ sh, up }) => ({ step: 1 / 3, slots: [[T(sh.a, sh.Ta, 'i'), T(sh.b, sh.Tb, 'm')], [{ s: sh.a, f: up[0], x: '/' }, { s: sh.b, f: up[1], x: '/' }], [P(sh.a, sh.La), P(sh.b, sh.Lb)]] }) },
  // the same pitch from both hands: tapping hand on the D string, fretting hand on the G string, staccato
  unison: { unit: '8th notes', name: 'unison taps between the hands', need: 'uni', make: ({ uni }) => ({ step: 0.5, short: true, slots: uni.flatMap(f => [[T(4, f, 'i')], [H(3, f - 5)]]) }) },
  unison16: { unit: '16th notes', name: 'unison taps between the hands in 16ths', need: 'uni', make: ({ uni }) => ({ step: 0.25, short: true, slots: uni.flatMap(f => [[T(4, f, 'i')], [H(3, f - 5)]]) }) }
};
/** A combo slot: the two tapped notes struck together (index on the lower string, middle on the higher). */
function cmb(g, D) { return [T(D.a, D.v[0], 'i'), T(D.a - 1, D.v[1], 'm')]; }

/** Everything a cell needs for one chord, or null when the chord has no playable shape here. */
function shapeFor(cellId, ch, c, st) {
  const need = CELLS[cellId].need, near = st.near;
  if (need === 'one') { const sh = oneShape(ch, st.string, near); return sh && { sh, L: sh.L }; }
  if (need === 'two') { const sh = twoShape(ch, st.string, near); return sh && { sh, L: sh.La }; }
  if (need === 'slide') for (const nr of [near, near - 2, near + 2, near + 4]) {
    const sh = twoShape(ch, st.string, nr); if (!sh) continue;
    let up = null;
    for (const fa of tonesOn(ch.pcs, sh.a, sh.Ta + 1, Math.min(22, sh.Ta + 6))) for (const fb of tonesOn(ch.pcs, sh.b, sh.Tb + 1, Math.min(22, sh.Tb + 6))) {
      if (Math.abs(fa - fb) > 3 || mod12(pitch(sh.a, fa)) === mod12(pitch(sh.b, fb))) continue;
      const d = Math.abs(fa - sh.Ta - (fb - sh.Tb)) + (fa - sh.Ta) * 0.2;
      if (!up || d < up.d) up = { v: [fa, fb], d };
    }
    if (!up) continue; up = up.v;
    return { sh, up, L: sh.La };
  }
  if (need === 'slide') return null;
  const g = bassGrip(ch, st.near); if (!g) return null;
  if (need === 'grip') {
    const a = g.ups[0], lo = g.fR + 5, hi = g.fR + 12;
    const v1 = combo(ch, a, lo, hi, g.fR + 7); if (!v1) return null;
    const v2 = combo(ch, a, Math.min(...v1) + 1, Math.max(...v1) + 4, Math.max(...v1) + 2, v1) || combo(ch, a, Math.min(...v1) - 4, Math.max(...v1) - 1, Math.min(...v1) - 2, v1) || v1;
    return { g, D1: { a, v: v1 }, D2: { a, v: v2 }, move: !!st.move, L: g.fR };
  }
  if (need === 'oct') { for (const nr of [Math.min(st.near, 5), 4, 8]) { const g2 = bassGrip(ch, nr), oct = g2 && octaveTap(ch, g2); if (oct != null) return { g: g2, oct, L: g2.fR }; } return null; }
  if (need === 'five') {
    const [s1, s2] = [g.ups[0], g.ups[1]], col = colourOf(ch);
    const a1 = tonesOn(col, s1, g.fR + 5, g.fR + 12)[0]; if (a1 == null) return null;
    const a2 = tonesOn(ch.pcs, s2, a1 - 1, a1 + 4).find(f => mod12(pitch(s2, f)) !== mod12(pitch(s1, a1)));
    return a2 == null ? null : { g, ft: [[s1, a1], [s2, a2]], L: g.fR };
  }
  if (need === 'held') {
    const hg = gripOn(ch.name, [4, 3, 2, 1], { near }); if (!hg) return null;
    const t1 = tonesOn(colourOf(ch).length ? ch.pcs : ch.pcs, 1, hg.at[1] + 3, hg.at[1] + 9)[0], t2 = tonesOn(ch.pcs, 2, hg.at[2] + 3, hg.at[2] + 9)[0];
    if (t1 == null || t2 == null || t1 > 22 || t2 > 22) return null;
    return { hg: { at: hg.at, t1, t2 }, voicing: { name: hg.name, frets: hg.frets }, L: hg.at[3] };
  }
  if (need === 'uni') {
    // chord tones on the D string in the tapping hand's zone, each also reachable five frets lower on the G string
    const fs = tonesOn(ch.pcs, 4, Math.max(7, near + 2), 17).filter(f => f - 5 >= 2).slice(0, 4);
    if (fs.length < 2) return null;
    return { uni: st.lvl >= 7 ? [...fs, ...fs.slice(1, -1).reverse()] : fs.slice(0, 2), L: fs[0] - 5 };
  }
  return null;
}
/** Render one chord's beats of a cell from beat t0; returns the next beat. */
function render(notes, cellId, ctxS, t0, beats, pcs) {
  const { step, slots, short } = CELLS[cellId].make(ctxS), n = Math.round(beats / step);
  for (let i = 0; i < n; i++) {
    const slot = slots[i % slots.length]; if (!slot) continue;
    slot.forEach(q => notes.push(tag(N(q.s, q.f, t0 + i * step, short ? step / 2 : step, q.x || null, { ...(q.fing ? { fing: q.fing } : {}), ...(slot.length > 1 ? { chord: true } : {}) }), pcs)));
  }
  return t0 + beats;
}

/* ------------------------------- The composer ------------------------------- */
/**
 * spec: { id, name ('{chords}', '{string}', '{key}'), method, cell, cells (per chord, cycling), prog
 * ('auto' | 'auto2' | 'long'), chords ((k, c) => names), bpc (beats per chord), reps, keys (offsets),
 * string (first-stage cells), near, move (combos alternate), apartBars (hands apart: bass bar, then taps
 * bar), answer (every other chord is yours), walk (a walking bass under held combos), goal, start, dl,
 * unit, why, instr, watch, simplify, minutes, domain }.
 */
export function mtRun(c, spec) {
  const notes = [], used = [], voicings = []; const lvl = c.lvl || 5, bpc = spec.bpc || 4, reps = spec.reps || 1;
  let t = 0, near = spec.near || 6, idx = 0; const walkOut = {};
  const kBase = mod12(c.key);
  for (const off of spec.keys || [0]) {
    const k = mod12(kBase + off), names = spec.chords ? spec.chords(k, c) : chordsOf(k, pickProg(c, spec.prog || 'auto'));
    for (let r = 0; r < reps; r++) for (let i = 0; i < names.length; i++) {
      const ch = chordInfo(names[i]); if (!ch) return null;
      const cellId = spec.cells ? spec.cells[idx % spec.cells.length] : spec.cell; idx++;
      if (spec.answer && idx % 2 === 1) { t += bpc; used.push(ch.name); continue; }   // your own bar
      const st = { near, string: spec.string || 2, move: spec.move, lvl };
      const sc = shapeFor(cellId, ch, c, st); if (!sc) return null;
      if (sc.voicing) voicings.push(sc.voicing);
      if (spec.walk) { t = walkBar(notes, ch, sc, names[(i + 1) % names.length], k, c.minor, t, walkOut); if (t == null) return null; }
      else t = render(notes, cellId, sc, t, bpc, ch.pcs);
      near = Math.max(3, Math.min(9, sc.L)); used.push(ch.name);
    }
  }
  if (notes.length < 6 || notes.length > 420) return null;
  const last = notes[notes.length - 1];
  if (spec.walk) {   // the walk resolves to the first chord's root
    const R0 = walkOut.R; notes.push(tag(N(R0[0], R0[1], t, 2, 'h'), [mod12(pitch(...R0))]));
  } else notes.push(tag(N(last.s, last.f, t, 2, last.x === 't' ? 't' : null), ALLOW.get(last)));
  const uniq = [...new Set(used)], cell = CELLS[spec.cell || spec.cells[0]];
  const fill = x => String(x || '').replace(/\{chords\}/g, uniq.join(' – ')).replace(/\{key\}/g, `${nameOf(kBase)} ${c.minor ? 'minor' : 'major'}`)
    .replace(/\{string\}/g, (spec.string || 2) === 2 ? 'the B string' : `the ${SN[spec.string || 2]} string`).replace(/\{pair\}/g, `the ${SN[spec.string || 2]} and ${SN[(spec.string || 2) - 1]} strings`);
  const backing = spec.keys ? null : (spec.chords ? spec.chords(kBase, c) : chordsOf(kBase, pickProg(c, spec.prog || 'auto')));
  const vs = []; const seen = new Set(); voicings.forEach(v => { const key = v.name + v.frets.join(','); if (!seen.has(key)) { seen.add(key); vs.push(v); } });
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretting', method: spec.method, unit: spec.unit || (spec.walk ? 'quarter notes and 8ths' : cell.unit),
    goal: spec.goal || 80, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: fill(spec.why), instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify,
    ...(backing ? { backing, chords: [...new Set(backing)] } : {}), ...(vs.length ? { voicings: vs } : {}), tab: { notes }
  });
}
/**
 * A walking-bass bar: the fretting hand plays the root, two chord tones moving toward the next chord and a
 * half-step approach into the next root (hammer-ons from nowhere, never on an open string), while the
 * tapped combo rings on the "and" of 1 and 3.
 */
function walkBar(notes, ch, sc, nextName, k, minor, t0, out = {}) {
  const g = sc.g, D = sc.D1, nx = chordInfo(nextName), rootP = pitch(...g.R);
  const g2 = bassGrip(nx, Math.max(3, Math.min(9, g.fR))); if (!g2) return null;
  const target = pitch(...g2.R);   // the next bar's root, exactly where the next grip plays it
  out.R = g2.R;
  const place = q => [g.sb, g.sb - 1, g.sb + 1].filter(x => x >= 4 && x <= 6 && q - OPEN[x] >= 1 && q - OPEN[x] <= 15).sort((x, y) => Math.abs(q - OPEN[x] - g.fR) - Math.abs(q - OPEN[y] - g.fR))[0];
  let line = null;
  for (const tg of [target]) {
    const dir = tg > rootP ? 1 : -1, tones = [];
    for (let q = rootP + dir; tones.length < 2 && q !== tg; q += dir) if (ch.pcs.includes(mod12(q))) tones.push(q);
    if (tones.length < 2) continue;
    let appr = tones[1] > tg ? tg + 1 : tg - 1; if (appr === tones[1]) appr = tones[1] > tg ? tg - 1 : tg + 1;
    const cand = [[rootP, [ch.pc]], [tones[0], ch.pcs], [tones[1], ch.pcs], [appr, [mod12(appr)]]];
    if (cand.every(([q]) => place(q) != null)) { line = cand; break; }
  }
  if (!line) for (const tg of [target]) {
    // fallback: root, 5th, root, then a half step into the next root
    const fifth = [rootP + 7, rootP - 5].find(q => place(q) != null), appr = [tg - 1, tg + 1].find(q => place(q) != null && q !== rootP);
    if (fifth != null && appr != null && Math.abs(tg - rootP) <= 12) { line = [[rootP, [ch.pc]], [fifth, ch.pcs], [rootP, [ch.pc]], [appr, [mod12(appr)]]]; break; }
  }
  if (!line) return null;
  for (const [i, [q, pcs]] of line.entries()) {
    const s = place(q);
    notes.push(tag(N(s, q - OPEN[s], t0 + i, 1, 'h'), pcs));
    if (i === 0 || i === 2) cmb(g, D).forEach(n => notes.push(tag(N(n.s, n.f, t0 + i + 0.5, 1.5, 't', { fing: n.fing, chord: true }), ch.pcs)));
  }
  return t0 + 4;
}
/** An original study: a plan of [chord offset, suffix, cell] bars. */
const STUDY = [[0, 'm9', 'two'], [8, 'maj9', 'dstop'], [10, 'add9', 'apart'], [5, 'm9', 'together'], [0, 'm9', 'octave'], [3, 'maj9', 'held'], [10, 'add9', 'five'], [0, 'm9', 'apart']];
const STUDY_M = [...STUDY, [5, 'm9', 'slide'], [10, 'add9', 'unison'], [3, 'maj9', 'octave6'], [8, 'maj9', 'together'], [5, 'm9', 'dstop16'], [10, 'add9', 'five16'], [8, 'maj9', 'apart'], [0, 'm9', 'octave']];
const studyRun = (plan, o) => c => {
  const k = c.minor ? mod12(c.key) : mod12(c.key - 3);   // the study is in the minor key (the relative minor in a major context)
  return mtRun({ ...c, key: k, minor: true }, { ...o, chords: kk => plan.map(([x, q]) => nameOf(kk + x) + q), cells: plan.map(p => p[2]), move: true });
};

/* --------------------------------- The path --------------------------------- */
const R_ = (id, name, method, o) => c => mtRun(c, { id, name, method, ...o });
const HOW = 'Hold the pick tucked under the thumb (or palmed) so the index, middle and ring fingers of the picking hand are free. Tap with the fingertips, straight down just behind the fret, and pull off slightly sideways so the fretted note sounds. Mute the strings you are not playing with the side of the picking hand and the flat of the fretting-hand fingers. ';
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'multiTap', kind: 'technique', title: 'Multi-finger tapping: tapped chords and double stops', domain: 'fretting',
  re: /multi.?finger tap|tapped (chords?|double.?stops?|octaves?)|double.?stop tap|two.?finger tap|chord tapping|piano.?style tapping|tapping chords?/,
  aliases: ['tapped chords', 'double-stop tapping', 'piano-style tapping', 'two-handed chord tapping'],
  summary: 'Tapping with two and three fingers: two taps on one string, one finger per string, double-stop taps, then the fretting hand on the bass and the tapping hand on colour-tone combos (hands apart, then together), tapped octaves, taps over a held chord, five-note arpeggios, tapped slides, unison taps and a walking bass under the taps.',
  prereqs: ['tapping', 'legato'],
  sources: ['https://www.premierguitar.com/lessons/expanded-two-hand-tapping', 'https://www.premierguitar.com/lessons/future-rock-two-handed-tapping-and-how-to-play-the-intro-to-atlas-novus?page=2', 'https://www.musicradar.com/tuition/guitars/how-to-play-guitar-like-tosin-abasi-612264', 'https://www.guitarinteractivemagazine.com/tech-session/tosin-abasi/page/3/', 'https://www.talkingbass.net/tapping-bass-guitar-lesson-part-2-piano-style/'],
  pedagogy: {
    date: '2026-10-18',
    summary: 'Taught as an extension of one-finger tapping: tap with the fingertips (index and middle first, the ring finger for wider shapes), slowly and in free time, then with a metronome. Tapped double stops strike two strings at once and pull off to a held chord. The two-handed chord style divides the chord: the fretting hand plays the root, 5th and octave, the tapping hand the colour tones (3rds, 7ths, 9ths) as two-note combos, practised hands apart first (a 3 + 3 + 2 rhythm), then hands together with the bass on the downbeats; add9 shapes with tapped octaves; taps pulling off to a held chord. Then five-note tapped arpeggios, tapped slides, short staccato taps between the hands, and a moving bass line under the tapped chords; finally tempo, longer progressions and full pieces.',
    sequence: [
      { id: 'twofingers', tier: 'foundations', step: 'Two tapping fingers on one string', how: 'Index and middle (later ring) tap two chord tones above one fretted note, pulling off to it; fingertips, not pads, for even volume.', skills: ['mt-one'], source: 1 },
      { id: 'perstring', tier: 'foundations', step: 'One tapping finger per string over a fretted dyad', how: 'Index on the lower string, middle on the higher, each pulling off to its fretted note.', skills: ['mt-two'], source: 1 },
      { id: 'dstop', tier: 'foundations', step: 'Double-stop taps', how: 'Tap two strings at the same time with the first and second fingers and pull off to the held notes together.', skills: ['mt-dstop'], source: 2 },
      { id: 'firstmusic', tier: 'foundations', step: 'The shapes through a progression', how: 'One chord per bar, the tapped shape following the chords; tapped answers to your own phrases.', skills: ['mt-first-music'], source: 1 },
      { id: 'apart', tier: 'intermediate', step: 'Hands apart: bass in the fretting hand, colour tones in the tapping hand', how: 'Fretting hand on root, 5th and octave; tapping hand on two-note combos of 3rds, 7ths and 9ths; a 3 + 3 + 2 rhythm, the hands alternating; then the combos moving.', skills: ['mt-apart'], source: 0 },
      { id: 'together', tier: 'intermediate', step: 'Hands together', how: 'Strong downbeats in the fretting hand against syncopated combos in the tapping hand; then the combos moving.', skills: ['mt-together'], source: 0 },
      { id: 'octaves', tier: 'intermediate', step: 'add9 shapes with tapped octaves', how: 'Fretting-hand hammer-ons through an add9 shape, the tapping hand adding an octave with index and ring; practise the hammer-ons alone, then add the taps; then change shapes.', skills: ['mt-oct'], source: 1 },
      { id: 'held', tier: 'intermediate', step: 'Taps over a held chord', how: 'Fret and hold a chord, pick its notes, then tap notes above it and pull off to the chord tones while it rings.', skills: ['mt-held'], source: 2 },
      { id: 'groove', tier: 'intermediate', step: 'The two-handed chord style over a groove', how: 'Hands apart and together over a backing, one chord per bar.', skills: ['mt-music-i'], source: 0 },
      { id: 'five', tier: 'advanced', step: 'Five-note tapped arpeggios', how: 'Repeating five-note figures: fretting-hand hammer-ons, then middle and ring taps, as quintuplets and as groups of five over 16ths.', skills: ['mt-five'], source: 3 },
      { id: 'slides', tier: 'advanced', step: 'Tapped slides', how: 'Slide the tapped notes to the next chord tones before the pull-off; isolate the slide in a simplified figure first.', skills: ['mt-slide'], source: 0 },
      { id: 'unison', tier: 'advanced', step: 'Short, sharp taps between the hands', how: 'The same note tapped by each hand on adjacent strings, alternating, staccato.', skills: ['mt-unison'], source: 2 },
      { id: 'bass', tier: 'advanced', step: 'A moving bass line under the tapped chords', how: 'Bass notes in the low register, chord tones above, the bass line walking between the chords.', skills: ['mt-adv-music'], source: 4 },
      { id: 'tempo', tier: 'mastery', step: 'At tempo: sextuplets and 16ths', how: 'The shapes in 16th-note triplets and 16ths, raised with the metronome in small steps.', skills: ['mt-perf'], source: 1 },
      { id: 'pieces', tier: 'mastery', step: 'Longer progressions, every technique combined', how: 'Slides, hammer-ons and pull-offs between the hands, hands apart and together, over a longer progression and in several keys.', skills: ['mt-long'], source: 0 },
      { id: 'own', tier: 'mastery', step: 'Your own tapped piece', how: 'An original study, then bars of your own.', skills: ['mt-voice'], source: 0 }
    ],
    drills: ['Index and middle tapping two notes above one fretted note', 'Double-stop taps pulling off to a held dyad', 'Hands apart in 3 + 3 + 2: bass notes, then a tapped combo', 'Hands together: bass on the beats, combos on the off-beats', 'add9 hammer-ons with a tapped octave (hammer-ons alone first)', 'Taps pulling off to a held chord', 'Five-note tapped arpeggios', 'Tapped combo slides', 'Unison taps alternating between the hands'],
    mistakes: ['Tapping with the pad of the finger (quiet, uneven taps)', 'Rushing instead of starting slowly in free time', 'Watching one hand or looking back and forth instead of the whole area', 'The two tapped notes of a combo not landing together', 'Other strings ringing for lack of muting', 'Raising the tempo too fast or skipping the metronome'],
    sources: [
      { title: 'Expanded Two-Hand Tapping', author: 'Vahe Sarkissian (Premier Guitar)', url: 'https://www.premierguitar.com/lessons/expanded-two-hand-tapping' },
      { title: 'Future Rock: Two-Handed Tapping and How to Play the Intro to “Atlas Novus”', author: 'Chris Letchford (Premier Guitar)', url: 'https://www.premierguitar.com/lessons/future-rock-two-handed-tapping-and-how-to-play-the-intro-to-atlas-novus?page=2' },
      { title: 'How to play guitar like… Tosin Abasi', author: 'Total Guitar (MusicRadar)', url: 'https://www.musicradar.com/tuition/guitars/how-to-play-guitar-like-tosin-abasi-612264' },
      { title: 'Tosin Abasi tech session', author: 'Sam Bell (Guitar Interactive)', url: 'https://www.guitarinteractivemagazine.com/tech-session/tosin-abasi/page/3/' },
      { title: 'Tapping for Bass Guitar, Part 2: Piano Style and Chords', author: 'TalkingBass', url: 'https://www.talkingbass.net/tapping-bass-guitar-lesson-part-2-piano-style/' }
    ]
  },
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Two fingers, two strings, two notes at once',
      'Tap two chord tones with index and middle above one fretted note on the B string, tap one finger per string over a fretted dyad, and strike double-stop taps that pull off together, each in even 8ths at 70 BPM over i–♭VI–♭VII–iv, one chord per bar, with every tapped note as loud as the fretted ones and no other string ringing.', [
      S('mt-one', 'Two taps on one string', 'fretting', 'Index and middle tap two notes above one fretted note.', [
        R_('mt-one-b', 'Index and middle on the B string: two taps above one fretted note ({chords})', 'chunking', { cell: 'one', string: 2, goal: 70, start: 40, why: 'With two tapping fingers one string holds three chord tones: the fretted note and two taps above it. Each tapping finger lands on its own fret, so the hand does not move.', instr: HOW + 'The fretting hand holds the low note. Index taps the first tap fret and pulls off, middle taps the higher one and pulls off: four even 8ths, one chord per bar. Practise each chord in free time before the click. Pass: four bars twice with all four notes equally loud.', watch: 'The middle-finger tap quieter than the index.', simplify: 'Index only (tap–pull 8ths).' }),
        R_('mt-one-g', 'Index and middle on the G string ({chords})', 'accurate-reps', { cell: 'one', string: 3, goal: 70, start: 40, why: 'The thicker G string needs firmer taps and more muting on both sides; the same two-finger motion, new frets.', instr: HOW + 'Same pattern on the G string: index tap, pull, middle tap, pull. Mute the B and high e with the fretting-hand fingertips. Count only clean bars. Pass: 8 clean bars in a row.', watch: 'The B string ringing after the pull-offs.', simplify: 'Two chords.' })],
        ST('With two tapping fingers, the picking hand holds two notes above the fretting hand’s note on the same string, each finger on its own fret.', 'It is the step from one-finger tapping to tapped chords: more notes without moving the hand.', ['Tap with the fingertip, not the pad: the volume comes from a quick, hard strike.', 'All three notes are tones of the bar’s chord (9th chords: R, 3rd, 5th, 7th, 9th).'])),
      S('mt-two', 'One finger per string', 'fretting', 'Index on the lower string, middle on the higher, over a fretted dyad.', [
        R_('mt-two-gb', 'One finger per string: index on the G, middle on the B ({chords})', 'accurate-reps', { cell: 'two', string: 3, goal: 70, start: 40, why: 'Giving each tapping finger its own string turns the taps into a chord shape: two fingers, two strings, two fretted notes under them.', instr: HOW + 'The fretting hand holds a two-note chord-tone shape on the G and B strings. Index taps the G and pulls off, middle taps the B and pulls off. Pass: four bars twice with the four notes even.', watch: 'Pulling off toward the next string and catching it.', simplify: 'One chord, quarter notes.' }),
        R_('mt-two-be', 'One finger per string: index on the B, middle on the high e ({chords})', 'accurate-reps', { cell: 'two', string: 2, goal: 72, start: 42, why: 'The same shape a string higher: a brighter register and new frets for every chord.', instr: HOW + 'Fretted dyad on the B and high e; index taps the B, middle the e, each pulling off to its fretted note. Pass: 8 clean bars in a row.', watch: 'The high e ringing on after its pull-off.', simplify: 'Two chords.' })],
        ST('Each tapping finger owns a string, like the fingers of a fingerpicking hand, while the fretting hand holds a chord-tone dyad under them.', 'Tapped chord shapes are built from this: the hands share the chord between them.', ['Index on the lower string, middle on the higher.', 'Pull off slightly toward the floor, away from the next string.'])),
      S('mt-dstop', 'Double-stop taps', 'fretting', 'Two strings tapped at once.', [
        R_('mt-dstop-gb', 'Double-stop taps on the G and B strings ({chords})', 'chunking', { cell: 'dstop', string: 3, goal: 68, start: 40, why: 'Striking two strings at once with index and middle sounds a tapped dyad; pulling both off together sounds the fretted dyad under it: two chord voicings from one hand position.', instr: HOW + 'Index and middle tap the G and B strings at the same moment, then pull off together to the fretted notes. Learn the tap alone, then the pull-off alone, then join them. Pass: four bars twice with each pair sounding as one.', watch: 'One finger landing a moment after the other (a flam).', simplify: 'Tap only; let the fretted dyad sound by itself.' }),
        R_('mt-dstop-be', 'Double-stop taps on the B and high e strings ({chords})', 'accurate-reps', { cell: 'dstop', string: 2, goal: 70, start: 42, why: 'The same double-stop tap on the top two strings, where it rings brightest and is easiest to hear.', instr: HOW + 'Tap both strings together, pull off both together, in 8ths. Count only bars where every pair lands as one. Pass: 8 clean bars in a row.', watch: 'The pull-off of one string weaker than the other.', simplify: 'Two chords.' })],
        ST('A double-stop tap strikes two strings at the same moment with two fingers, then pulls both off together.', 'It is the core of tapped chords: two notes at a time from the tapping hand.', ['Tosin Abasi taps mainly with his first and second fingers.', 'Listen for one sound, not two: a flam means one finger is late.'])),
      S('mt-first-music', 'First music', 'improv', 'The shapes through a progression; tapped answers.', [
        R_('mt-first-prog', 'Tapped shapes with the band: one finger per string through {chords}', 'transfer', { cell: 'two', string: 3, reps: 2, goal: 72, start: 42, why: 'Over a backing the tapped shapes become harmony: each bar spells the chord the band is playing, 9ths and all.', instr: HOW + 'Two times through the progression, one chord per bar, changing shape exactly on beat 1. Pass: eight bars in time with every change on the beat.', watch: 'Stopping at the chord changes.', simplify: 'Half the notes: the taps only.' }),
        R_('mt-first-call', 'Call and response: your phrase, then a double-stop tap answer ({chords})', 'transfer', { cell: 'dstop', string: 2, answer: true, reps: 2, goal: 72, start: 42, why: 'Tapped chords work as answers to a picked phrase. Switching between picking and tapping is a skill of its own.', instr: 'Odd bars: your own short picked phrase. Even bars: the written double-stop taps for that bar’s chord. ' + HOW + 'Pass: four calls and answers in time.', watch: 'The switch to tapping costing a beat.', simplify: 'Answer with single taps.' })],
        ST('The shapes follow the chords: i m9, ♭VI maj9, ♭VII add9, iv m9 in a minor key.', 'Ninth chords are the colour of Tosin Abasi’s and Chris Letchford’s tapped parts.', ['Change shape on beat 1.', 'The tapped notes often include the 9th, the colour of the chord.']))
    ], [1, 3]),
    stage('intermediate', 'Two hands, one chord',
      'Split each chord between the hands at 80 BPM in 8ths: the fretting hand on root, 5th and octave by hammer-ons, the tapping hand on colour-tone combos, hands apart in 3 + 3 + 2 and hands together with the bass on the beats, with moving combos; add9 shapes with tapped octaves in 16ths at 72; taps pulling off to a held chord; and the style over a groove.', [
      S('mt-apart', 'Hands apart', 'fretting', 'Bass in the fretting hand, combos in the tapping hand, 3 + 3 + 2.', [
        R_('mt-apart-static', 'Hands apart, 3 + 3 + 2: root and 5th, then a tapped combo ({chords})', 'chunking', { cell: 'apart', goal: 80, start: 46, why: 'The two-handed chord style divides each chord: the fretting hand takes the root, 5th and octave, the tapping hand the colour tones. With the hands alternating, each has its own moment.', instr: HOW + 'The fretting hand hammers the root and the 5th from nowhere (no pick), then the tapping hand strikes the two-note combo: bass, bass, combo · bass, bass, combo · octave, combo. Accent each group’s first note: 3 + 3 + 2. Pass: four bars twice with the accents audible and every note even.', watch: 'The hammer-ons from nowhere too quiet next to the taps.', simplify: 'The first two groups only.' }),
        R_('mt-apart-move', 'Hands apart with moving combos: two colour voicings per chord ({chords})', 'variable', { cell: 'apart', move: true, goal: 80, start: 46, why: 'Moving the tapped combo between two colour voicings makes a melody on top of the bass, while the fretting hand repeats.', instr: HOW + 'Same 3 + 3 + 2 pattern; the second combo of each bar is a different pair of chord tones a few frets higher. Pass: four bars twice with both combos clean.', watch: 'Missing the second combo’s frets: look at the target area, not your hands.', simplify: 'One combo per bar.' })],
        ST('Hands apart means the hands take turns: bass notes from the fretting hand, then a tapped combo.', 'It is the easier starting point because each hand plays alone; coordination comes next.', ['Root, 5th and octave are the fretting hand’s notes; 3rd, 7th and 9th are the tapping hand’s.', '3 + 3 + 2: eight 8ths grouped 3, 3, 2.'])),
      S('mt-together', 'Hands together', 'fretting', 'Bass on the beats, combos on the off-beats.', [
        R_('mt-together-static', 'Hands together: bass on the beats, combos on the off-beats ({chords})', 'chunking', { cell: 'together', goal: 80, start: 46, why: 'Now the hands play in one groove: strong downbeats from the bass, syncopated combos between them, like a pianist’s left and right hands.', instr: HOW + 'Root, 5th, octave and 5th on beats 1 to 4 (hammer-ons from nowhere); the tapped combo on the “and” of 1, 2 and 4. Learn the bass line alone first, then add the combos. Pass: four bars twice in time.', watch: 'The combos pulling toward the beat.', simplify: 'Combos on the “and” of 2 and 4 only.' }),
        R_('mt-together-move', 'Hands together with moving combos ({chords})', 'variable', { cell: 'together', move: true, goal: 80, start: 46, why: 'Moving combos over a steady bass: the tapping hand plays a melody of colour tones while the fretting hand holds the groove.', instr: HOW + 'Same bass line; the combo on the “and” of 2 is a second voicing. Pass: four bars twice.', watch: 'The bass slowing down when the combo moves.', simplify: 'One combo per bar.' })],
        ST('Hands together means bass and taps overlap in one rhythm: the fretting hand on the beats, the tapping hand on the off-beats.', 'This is the full two-handed chord sound: bass line and harmony from one guitar.', ['Learn the bass part alone first.', 'Keep your eyes on the whole area of the neck, not on one hand.'])),
      S('mt-oct', 'add9 shapes and tapped octaves', 'fretting', 'Hammer-ons through an add9 shape, an octave tapped above.', [
        R_('mt-oct-bar', 'add9 hammer-ons with a tapped octave, one chord per bar ({chords})', 'chunking', { cell: 'octave', goal: 64, start: 40, why: 'The fretting hand hammers root, 9th and 5th; the tapping hand adds the 3rd as an octave with index and ring. Four 16ths, four different sounds, one chord.', instr: HOW + 'First the hammer-ons alone (root, 9th, 5th) for a bar, then add the octave tap: index on the G string, ring on the high e. Pass: four bars twice with the octave as loud as the hammer-ons.', watch: 'Hammering the 9th with the ring finger: the middle finger leaves the pinky its stretch.', simplify: 'Hammer-ons alone, octave on beat 1 only.' }),
        R_('mt-oct-half', 'add9 shapes changing every two beats ({chords})', 'variable', { cell: 'octave', bpc: 2, reps: 2, goal: 64, start: 40, why: 'Changing shape every two beats makes both hands move at once: the hammer-on shape and the tapped octave jump together.', instr: HOW + 'Two beats per chord, twice through. Pass: the progression twice with every change on the beat.', watch: 'The tapped octave arriving late after a shape change.', simplify: 'Four beats per chord.' })],
        ST('An add9 shape on the bass strings (root, 9th, 5th) leaves the 3rd to the tapping hand, played as an octave on the G and high e strings.', 'It is the sound of modern prog tapping intros: wide, open chords that no single hand could reach.', ['The octave on the G and high e strings is three frets apart.', 'Index and ring tap the octave; the middle finger is free.'])),
      S('mt-held', 'Taps over a held chord', 'fretting', 'Pick the chord, then tap above it.', [
        R_('mt-held-one', 'A held chord: pick it, then tap and pull off to its notes ({chords})', 'accurate-reps', { cell: 'held', goal: 76, start: 44, why: 'With a chord held in the fretting hand, every pull-off lands on a chord tone and the chord keeps ringing under the taps.', instr: HOW + 'Fret the chord shown and hold it. Pick the four strings low to high in 8ths, then tap the high e and pull off, tap the B and pull off. Let the chord ring. Pass: four bars twice with no fretted note lifting.', watch: 'Lifting a fretting finger while tapping.', simplify: 'Pick the chord, then one tap.' }),
        R_('mt-held-prog', 'Held chords through the second progression ({chords})', 'variable', { cell: 'held', prog: 'auto2', goal: 78, start: 46, why: 'A new progression moves every grip and every tap: the taps always land a few frets above whatever chord is held.', instr: HOW + 'One chord per bar: pick, then tap and pull off. Pass: four bars twice.', watch: 'Taps landing on the fretted notes instead of above them.', simplify: 'Two chords.' })],
        ST('Fret a chord and hold it; picked notes and tapped notes then pull off into the same ringing chord.', 'It joins picking and tapping inside one chord, a texture Tosin Abasi uses on extended chords.', ['The taps are three to nine frets above the grip.', 'Hold the grip still: the pull-offs need the fretted notes there.'])),
      S('mt-music-i', 'Over a groove', 'improv', 'Hands apart and together with the band.', [
        R_('mt-groove-apart', 'Hands apart over a groove, the second progression ({chords})', 'transfer', { cell: 'apart', prog: 'auto2', reps: 2, move: true, goal: 84, start: 48, why: 'With a backing the 3 + 3 + 2 pattern becomes a syncopated part that sits against the band’s beat.', instr: HOW + 'Twice through with the band. Pass: eight bars in the pocket.', watch: 'Drifting back onto the beat.', simplify: 'Static combos.' }),
        R_('mt-groove-together', 'Hands together over the band, a chord every two beats ({chords})', 'transfer', { cell: 'together', bpc: 2, reps: 2, goal: 80, start: 46, why: 'Faster changes: two beats per chord, bass and combos moving together.', instr: HOW + 'Two beats per chord. Pass: the progression twice in time.', watch: 'Late shape changes.', simplify: 'One chord per bar.' })],
        ST('Over a band the two-handed style is a full part: bass, harmony and rhythm.', 'This is where it becomes music.', ['Leave space: the band plays the bass too.', 'Lock the downbeats with the drums.']))
    ], [4, 6]),
    stage('advanced', 'Fives, slides and moving bass',
      'Play five-note tapped arpeggios as quintuplets at 66 BPM and as groups of five over 16ths at 80, slide tapped combos to the next chord tones in triplets, alternate short unison taps between the hands in 16ths, walk a bass line under tapped combos, and play an 8-bar tapped study with the backing.', [
      S('mt-five', 'Five-note tapped arpeggios', 'fretting', 'Three hammer-ons, two taps.', [
        R_('mt-five-q', 'Five-note tapped arpeggios as quintuplets ({chords})', 'chunking', { cell: 'five', goal: 53, start: 36, why: 'Root, 5th and octave from the fretting hand, then two colour tones tapped by middle and ring: a five-note arpeggio that fits one beat as a quintuplet.', instr: HOW + 'Count five per click (“u-ni-ver-si-ty”). Learn one beat first, then the bar. Pass: four bars twice with the first note of every beat on the click.', watch: 'The quintuplet collapsing into four notes and a late fifth.', simplify: 'One beat of five per bar.' }),
        R_('mt-five-16', 'Groups of five over 16ths: the arpeggio crossing the beat ({chords})', 'variable', { cell: 'five16', goal: 64, start: 40, why: 'The same five notes in 16ths start in a new place every beat: a repeating figure that crosses the bar line, as in Tosin Abasi’s odd-time tapping.', instr: HOW + 'Steady 16ths; the five-note figure restarts every fifth note. Pass: four bars clean twice.', watch: 'Accenting the beat instead of the figure.', simplify: 'Quintuplets first.' })],
        ST('A five-note tapped arpeggio uses three fretting-hand notes and two taps (middle and ring).', 'Five-note cells give tapped lines an odd, rolling feel, in quintuplets or crossing the beat in 16ths.', ['Quintuplet: five notes per beat. Group of five over 16ths: realigns every five beats.', 'Middle and ring tap; the index stays free.'])),
      S('mt-slide', 'Tapped slides', 'fretting', 'Combo, slide, pull-off.', [
        R_('mt-slide-gb', 'Tapped combo slides on the G and B strings ({chords})', 'chunking', { cell: 'slide', string: 3, goal: 58, start: 38, why: 'Sliding both tapping fingers to the next chord tones adds a vocal swoop and a new voicing before the pull-off.', instr: HOW + 'Tap the combo, keep the pressure and slide both fingers up to the next combo, then pull off to the fretted dyad: three triplet notes per beat. First practise the slide alone. Pass: four bars twice with the slid notes in tune.', watch: 'Losing pressure on the slide so the notes die.', simplify: 'Tap and slide, no pull-off.' }),
        R_('mt-slide-be', 'Tapped combo slides on the B and high e ({chords})', 'variable', { cell: 'slide', string: 2, goal: 60, start: 38, why: 'The same slide on the top strings, with a new set of frets for every chord.', instr: HOW + 'Tap, slide, pull off, one chord per bar. Pass: 8 clean bars.', watch: 'One finger sliding farther than the other.', simplify: 'Two chords.' })],
        ST('A tapped slide moves the tapping fingers to new frets while the notes sound, before the pull-off.', 'It adds expression and a second voicing to each tapped shape.', ['Both fingers keep their pressure through the slide.', 'The slide ends on chord tones of the same chord.'])),
      S('mt-unison', 'Unison taps between the hands', 'fretting', 'The same note from each hand, short and sharp.', [
        R_('mt-unison-8', 'Unison taps: the tapping hand on the D string, the fretting hand on the G ({chords})', 'accurate-reps', { cell: 'unison', goal: 80, start: 46, why: 'The same pitch tapped by each hand on adjacent strings, alternating, gives a staccato, percussive repeated note, the hands trading the line.', instr: HOW + 'The tapping hand taps a chord tone on the D string; the fretting hand taps the same pitch five frets lower on the G string; alternate, each note short. Pass: four bars twice with both hands sounding identical.', watch: 'Notes ringing on: release each tap at once.', simplify: 'Quarter notes.' }),
        R_('mt-unison-16', 'Unison taps in 16ths through the chord tones ({chords})', 'variable', { cell: 'unison16', goal: 71, start: 44, why: 'In 16ths the alternating hands move through the chord tones: a fast, staccato figure no single hand could play this evenly.', instr: HOW + 'Two notes per pitch (tapping hand, then fretting hand), moving through the chord tones and back. Pass: four bars clean twice.', watch: 'One hand louder than the other.', simplify: '8ths.' })],
        ST('Unison taps play one pitch from both hands on two strings: the tapping hand higher on the lower string, the fretting hand lower on the higher string.', 'Short, sharp alternating taps make a percussive line that sounds like one instrument.', ['A note on the D string sounds the same five frets lower on the G string.', 'Keep both taps short: staccato.'])),
      S('mt-adv-music', 'Bass lines and a study', 'improv', 'A walking bass under tapped combos; an 8-bar study.', [
        R_('mt-walk', 'A walking bass under tapped combos ({chords})', 'transfer', { cell: 'together', walk: true, reps: 2, goal: 66, start: 40, why: 'With the combos held, the fretting hand walks the bass from each root toward the next chord: a moving bass line under tapped chords, the full piano-style texture.', instr: HOW + 'Beat 1: the root; beats 2 and 3: chord tones moving toward the next chord; beat 4: a half step from the next root, leading into it (all hammer-ons from nowhere). The combo is tapped on the “and” of 1 and 3 and allowed to ring. Pass: eight bars in time with the band.', watch: 'The combo cut short by the walking bass.', simplify: 'Root on beats 1 and 3 only.' }),
        studyRun(STUDY, { id: 'mt-study-8', name: 'Study: an 8-bar tapped chord piece', method: 'transfer', goal: 60, start: 38, minutes: 8, dl: 1, why: 'An original 8-bar piece that joins the moves of the path: one finger per string, double-stop taps, hands apart and together, a tapped octave, a held chord and a five-note arpeggio.', instr: HOW + 'Learn it two bars at a time, then join the pairs. Pass: twice through at the goal tempo without a gap at the bar lines.', watch: 'Rushing the bar where the texture changes.', simplify: 'The first four bars.' })],
        ST('Under tapped chords the fretting hand can play a moving bass line; the study combines every texture of the path.', 'This is how tapped chords carry a whole arrangement.', ['Bass notes in the low register, chord tones above.', 'Each bar of the study uses a different texture.']))
    ], [7, 8]),
    stage('mastery', 'Two-handed arrangements',
      'Play add9 octave shapes in 16th-note sextuplets at 76 BPM and double-stop taps in 16ths at 96, the two-handed style through an 8-chord progression and in four keys, and your own 16-bar tapped piece.', [
      S('mt-perf', 'At performance tempo', 'fretting', 'Sextuplets and 16ths.', [
        R_('mt-perf-oct', 'add9 shapes and tapped octaves in sextuplets ({chords})', 'edge', { cell: 'octave6', reps: 2, goal: 58, start: 40, why: 'Six notes per beat through the add9 shape and its tapped octave: the speed of a full tapped intro.', instr: HOW + 'Tempo ladder: +3 BPM after each clean pass. Pass: eight bars clean at the goal tempo.', watch: 'Tension in the tapping forearm.', simplify: '16ths.' }),
        R_('mt-perf-dstop', 'Double-stop taps in 16ths, a chord every two beats ({chords})', 'edge', { cell: 'dstop16', string: 3, bpc: 2, reps: 2, goal: 78, start: 50, why: 'Fast tapped dyads with quick changes: both tapping fingers landing together at speed.', instr: HOW + 'Tempo ladder to the goal. Pass: twice through clean at the goal tempo.', watch: 'The pairs flamming at speed.', simplify: 'One chord per bar.' })],
        ST('The shapes at performance tempo.', 'Speed with every pair landing together and every note even.', ['Small tempo steps after clean passes.', 'Shake out the tapping hand between passes.'])),
      S('mt-long', 'Long progressions and every key', 'fretting', 'Eight chords; four keys.', [
        R_('mt-long-8', 'Hands together through an 8-chord progression, combos moving ({chords})', 'variable', { cell: 'together', prog: 'long', move: true, goal: 73, start: 46, why: 'A longer progression with chords you don’t expect moves both hands into new shapes every bar.', instr: HOW + 'One chord per bar, each grip near the last. Pass: all eight bars twice in time.', watch: 'Jumping across the neck: stay near the last grip.', simplify: 'The first four chords.' }),
        R_('mt-keys', 'Hands apart in four keys around the cycle of fourths', 'interleaving', { cell: 'apart', keys: [0, 5, 10, 3], bpc: 2, goal: 68, start: 44, why: 'In a new key every grip and combo moves; four keys a fourth apart make the shapes portable.', instr: HOW + 'The progression in four keys, two beats per chord. Pass: all four keys without stopping.', watch: 'Playing the old key’s frets.', simplify: 'Two keys.' })],
        ST('Longer progressions and other keys move every grip and every combo.', 'Real pieces change chords often and come in any key.', ['A key a fourth up moves the grip five frets up (or seven down).', 'Stay near the last grip.'])),
      S('mt-voice', 'Your own piece', 'improv', 'A 16-bar study, then your own bars.', [
        studyRun(STUDY_M, { id: 'mt-capstone', name: 'Capstone study: 16 bars of two-handed tapping', method: 'transfer', goal: 58, start: 38, minutes: 8, dl: 1, why: 'An original 16-bar piece that uses the whole path: single-string and per-string taps, double stops, hands apart and together, octaves in 16ths and sextuplets, held chords, fives, slides and unison taps, over a minor-key progression.', instr: HOW + 'Learn it four bars at a time. Then rewrite four bars with your own textures over the same chords. Pass: the study at the goal tempo, then your version once.', watch: 'Tension building through the 16 bars: shake out after each four.', simplify: 'Bars 1–8.' }),
        R_('mt-own', 'Make it yours: a written tapped bar, then your own ({chords})', 'transfer', { cell: 'together', prog: 'long', answer: true, move: true, goal: 66, start: 42, minutes: 6, why: 'Every second bar is written; the bars between are yours, built from any texture of the path.', instr: HOW + 'Odd bars: your own two-handed bar over the chord. Even bars: the written hands-together bar. Pass: twice through with every bar in time and your bars different each time.', watch: 'Your bars copying the written ones.', simplify: 'Hands apart in your bars.' })],
        ST('The capstone combines every texture; the last step is your own arrangement.', 'A technique becomes yours when you compose with it.', ['Learn long pieces four bars at a time.', 'Keep the chords, change the textures.']))
    ], [9, 10])
  ]
});
