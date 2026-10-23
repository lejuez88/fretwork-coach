// String muting: keeping every string you are not playing silent, so only the notes you mean to play
// sound. Fretting-hand damping (fingertips and finger pads resting on the neighbours of a fretted note,
// lifting just enough to stop a note on the beat), picking-hand damping (the heel of the hand or the thumb
// on strings below, the palm or fingertips stopping a ringing note), and the two hands together, from
// slow single notes to clean power chords, skipped strings, palm-muted bursts, legato and fast runs.
//
// Concept-first (CONTENT.md): the model is a BAR GRID on the page's tab. A note's length is how long it
// RINGS; the gap after it is the silence the muting hands must produce (a staccato note is drawn short,
// and the rest between notes is part of the exercise). Dead notes are drawn with the `mute` mark (an "x":
// the strings are touched, not pitched). Every sounding note comes from one of three sources, so each is
// right in every key by construction: ROOTS and POWER CHORDS (root + 5th, plus the octave) on the low
// strings for the chord progression (minor: i – ♭VI – ♭VII – i, major: I – IV – V – I), the minor
// PENTATONIC BOX shapes of the key (`pentBox`; for a major key, its relative minor's boxes), and the
// SAME-FRET FOURTHS used by the finger-roll drills (any pentatonic note except the 3rd (♭3) has its
// perfect fourth, one string up, at the same fret, also in the scale). The skip arpeggios use the
// root–octave–fifth shape that keeps the same frets on strings 6-4-2 and 5-3-1.
//
// Teaching method first (CONTENT.md, `pedagogy` below), researched 2026-10-23: fretting-hand damping is
// taught first (the finger on the played note touches its neighbours; lift just enough to stop a note),
// then the picking hand (heel and thumb on lower strings, palm or fingertips to stop a note, palm muting
// as the shaping tool), then both together on power chords and pentatonic lines, then the places noise
// gets worse (skipped strings, fast runs, legato, high gain), always slowly at first with a metronome.
import { OPEN, N, nameOf, make, mod12, chordInfo, S, stage, entry, pentBox, targetGuide } from '../lib.js';
import { lowRoot } from './palmMuting.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const PENT = k => [0, 3, 5, 7, 10].map(x => mod12(k + x));
/** The pentatonic root: the key itself in a minor key, the relative minor in a major key. */
const penK = c => (c.minor ? mod12(c.key) : mod12(c.key - 3));
/** Chord progression as [semitones above the key root, quality]. */
const progOf = (c, id) => {
  if (id === 'one') return [[0, c.minor ? 'm' : '']];
  return c.minor ? [[0, 'm'], [8, ''], [10, ''], [0, 'm']] : [[0, ''], [5, ''], [7, ''], [0, '']];
};
/** Note patterns for one bar: [slot (16ths), length (16ths), kind] with kind 'n' (note or chord) or 'x' (dead note). */
export const PAT = {
  q4s: [[0, 2], [4, 2], [8, 2], [12, 2]],
  e8s: [0, 2, 4, 6, 8, 10, 12, 14].map(s => [s, 1]),
  h2: [[0, 8], [8, 8]],
  q4: [[0, 4], [4, 4], [8, 4], [12, 4]],
  stab: [[0, 2], [6, 2], [10, 2]],
  stopA: [[0, 2], [3, 2], [6, 2], [10, 2], [12, 2]],
  stopB: [[0, 1], [2, 1], [4, 1], [8, 1], [10, 1], [12, 3]],
  stopC: [[0, 1], [3, 1], [6, 1], [7, 1], [10, 1], [12, 2], [15, 1]],
  dead8: [[0, 2, 'n'], [2, 2, 'x'], [4, 2, 'n'], [6, 2, 'x'], [8, 2, 'n'], [10, 2, 'x'], [12, 2, 'n'], [14, 2, 'x']],
  dead16: [[0, 1, 'n'], [1, 1, 'x'], [2, 1, 'x'], [3, 1, 'n'], [4, 1, 'x'], [5, 1, 'x'], [6, 1, 'n'], [7, 1, 'x'], [8, 1, 'x'], [9, 1, 'x'], [10, 1, 'n'], [11, 1, 'x'], [12, 1, 'n'], [13, 1, 'x'], [14, 1, 'x'], [15, 1, 'n']]
};
/** A power chord from a root on string 6 or 5: root, 5th (next string, two frets up), octave (next, two frets up). */
const power = R => [[R.s, R.f], [R.s - 1, R.f + 2], [R.s - 2, R.f + 2]];

/**
 * Riffs on the progression: one pattern per bar (cycled), as roots or power chords, with dead notes
 * where the pattern says 'x'. o: pats, kind ('root' | 'power'), prog, keys (key offsets, one pass each),
 * reps, tech ('pm'), t0 (start beat).
 */
function riffBars(c, o) {
  const notes = [], used = []; let t = o.t0 || 0, bar = 0, near = 3;
  for (const off of o.keys || [0]) {
    const k = mod12(c.key + off);
    for (let rep = 0; rep < (o.reps || 1); rep++) for (const [d, q] of progOf(c, o.prog)) {
      const root = mod12(k + d), R = lowRoot(root, near), nm = nameOf(root) + q;
      if (!R || !chordInfo(nm)) return null;
      near = R.f;
      for (const [sl, len, kind = 'n'] of PAT[o.pats[bar % o.pats.length]]) {
        const T = t + sl / 4, D = len / 4;
        if (kind === 'x') [R.s, R.s - 1].forEach(s => notes.push(tag(N(s, R.f, T, D, 'mute', { chord: true }), null)));
        else if (o.kind === 'root') notes.push(tag(N(R.s, R.f, T, D, o.tech || null), [root]));
        else power(R).forEach(([s, f]) => notes.push(tag(N(s, f, T, D, o.tech || null, { chord: true }), [root, mod12(root + 7)])));
      }
      t += 4; bar++; used.push(nm);
    }
  }
  return { notes, chords: used, end: t };
}
/** The notes of a pentatonic box on the given strings, low string to high, low fret to high. */
function boxOn(c, box, strs) {
  const b = pentBox(penK(c), box); if (!b) return null;
  return b.filter(n => strs.includes(n.s)).sort((a, z) => z.s - a.s || a.f - z.f).map(n => [n.s, n.f]);
}
/** Up, then back down without repeating the top note. */
const upDown = a => a.concat(a.slice(0, -1).reverse());
/** A line of [string, fret] events, one per step; d = step × gate. */
function line(seq, { step, gate = 0.95, t0 = 0, tech = null, marks = null, pcs }) {
  return seq.map(([s, f], i) => tag(N(s, f, t0 + i * step, step * gate, marks ? marks[i] : tech), pcs));
}
/** One fret of the pentatonic note `pc` on string s, in 1…11 (or 12 for the open one), so +10 stays on the neck. */
function runFret(s, pc) {
  for (let f = 0; f < 12; f++) if (mod12(pitch(s, f)) === mod12(pc)) return f === 0 ? 12 : f;
  return null;
}
/** The pentatonic run on one string: R ♭3 4 5 ♭7 and back. */
function stringRun(c, s, step, gate, reps = 1) {
  const pk = penK(c), f0 = runFret(s, pk); if (f0 == null) return null;
  const degs = upDown([0, 3, 5, 7, 10]), notes = [];
  for (let r = 0; r < reps; r++) degs.forEach((d, i) => notes.push(tag(N(s, f0 + d, (r * degs.length + i) * step, step * gate), PENT(pk))));
  return { notes };
}
const BACK = c => progOf(c).map(([d, q]) => nameOf(mod12(c.key + d)) + q);
const lv = (c, a, b) => ((c.lvl || 1) >= a ? b : null);

/* ------------------------------ The lesson wrapper ------------------------------ */
/** One generator: build(c) → { notes, chords? }; name/instr may use {key} and {chords}. */
function L(id, name, method, o, build) {
  return c => {
    const r = build(c); if (!r || !r.notes || r.notes.length < 4 || r.notes.length > 380) return null;
    const keyName = `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`, ch = r.chords ? [...new Set(r.chords)].join(' – ') : '';
    const fill = x => String(x).replace(/\{key\}/g, keyName).replace(/\{chords\}/g, ch);
    return make(c, {
      id, name: fill(name), domain: 'picking', method, unit: o.unit, goal: o.goal, start: o.start, minutes: o.minutes || 5,
      why: o.why, instr: fill(o.instr), watch: o.watch, simplify: o.simplify,
      ...(r.chords && o.back !== false ? { backing: r.chords, chords: [...new Set(r.chords)] } : {}), tab: { notes: r.notes }
    });
  };
}
const ST = (concept, why, theory) => ({ concept, why, theory });

/* ------------------------------ Skill builders ------------------------------ */
// Foundations
const liftRoots = c => riffBars(c, { pats: [(c.lvl || 1) >= 3 ? 'e8s' : 'q4s'], kind: 'root' });
const liftLineFret = c => stringRun(c, 4, (c.lvl || 1) >= 3 ? 0.5 : 1, 0.5, 2);
const stopLinePick = c => stringRun(c, 5, (c.lvl || 1) >= 3 ? 0.5 : 1, 0.5, 2);
const heelHigh = c => { const b = boxOn(c, 1, [3, 2]); if (!b) return null; return { notes: line(upDown(b), { step: (c.lvl || 1) >= 2 ? 0.5 : 1, pcs: PENT(penK(c)) }).concat(line(upDown(b), { step: (c.lvl || 1) >= 2 ? 0.5 : 1, t0: upDown(b).length * ((c.lvl || 1) >= 2 ? 0.5 : 1), pcs: PENT(penK(c)) })) }; };
const heelThree = c => { const b = boxOn(c, 1, [4, 3, 2, 1]); if (!b) return null; const st = (c.lvl || 1) >= 3 ? 0.5 : 1; return { notes: line(upDown(b), { step: st, pcs: PENT(penK(c)) }) }; };
const flatOnePer = c => { const b = boxOn(c, 1, [6, 5, 4, 3, 2, 1]); if (!b) return null; const one = [6, 5, 4, 3, 2, 1].map(s => b.find(n => n[0] === s)); const st = (c.lvl || 1) >= 2 ? 0.5 : 1; return { notes: line(upDown(one).concat(upDown(one)), { step: st, pcs: PENT(penK(c)) }) }; };
const flatPairs = c => { const b = boxOn(c, 1, [6, 5, 4, 3, 2, 1]); if (!b) return null; const st = (c.lvl || 1) >= 2 ? 0.5 : 1; const seq = []; for (const pr of [[6, 5], [4, 3], [2, 1]]) seq.push(...b.filter(n => pr.includes(n[0]))); return { notes: line(seq.concat(seq.slice(0, -1).reverse()), { step: st, pcs: PENT(penK(c)) }) }; };
const powerHold = c => riffBars(c, { pats: [(c.lvl || 1) >= 3 ? 'q4' : 'h2'], kind: 'power' });
const powerStab = c => riffBars(c, { pats: ['stab'], kind: 'power' });
const firstRiff = c => riffBars(c, { pats: ['stab', 'stab', 'stopA', 'stab'], kind: 'power', reps: (c.lvl || 1) >= 3 ? 2 : 1 });
/** Call and answer: a two-bar pentatonic motif from box 1 on strings 4-3, then the answer, over the progression. */
function motifBars(c, strs, plan, step = 0.5, gate = 0.5) {
  const b = boxOn(c, 1, strs); if (!b || b.length < 4) return null;
  const notes = []; let t = 0;
  plan.forEach(ix => { ix.forEach((i, j) => notes.push(tag(N(b[i][0], b[i][1], t + j * step, step * gate), PENT(penK(c))))); t += 4; });
  return { notes, chords: BACK(c) };
}
const firstLine = c => motifBars(c, [4, 3], [[0, 1, 2, 3], [0, 2, 1, 3], [3, 2, 1, 0], [0, 1, 0, 2]]);

// Intermediate
/** Same-fret fourths: a note on string s, then the same fret on the next string up (a pentatonic fourth). */
function rolls(c, pairs, step, reps = 1) {
  const pk = penK(c), notes = []; let t = 0, prev = 5;
  for (let r = 0; r < reps; r++) for (const [s] of pairs) {
    const order = r % 2 ? [10, 7, 5, 0] : [0, 5, 7, 10];
    for (const d of order) {
      let f = null, bd = 99;
      for (let x = 2; x <= 14; x++) if (mod12(pitch(s, x)) === mod12(pk + d) && Math.abs(x - prev) < bd) { f = x; bd = Math.abs(x - prev); }
      if (f == null) return null; prev = f;
      notes.push(tag(N(s, f, t, step * 0.9), PENT(pk)), tag(N(s - 1, f, t + step, step * 0.9), PENT(pk))); t += step * 2;
    }
  }
  return { notes };
}
const rollLow = c => rolls(c, [[6], [5]], (c.lvl || 4) >= 5 ? 0.25 : 0.5, 1);
const rollMid = c => rolls(c, [[4], [2]], (c.lvl || 4) >= 5 ? 0.25 : 0.5, 1);
const boxUpDown = c => { const b = boxOn(c, 1, [6, 5, 4, 3, 2, 1]); if (!b) return null; return { notes: line(upDown(b), { step: (c.lvl || 4) >= 6 ? 0.25 : 0.5, pcs: PENT(penK(c)) }).concat(line(upDown(b).slice(1), { step: (c.lvl || 4) >= 6 ? 0.25 : 0.5, t0: upDown(b).length * ((c.lvl || 4) >= 6 ? 0.25 : 0.5), pcs: PENT(penK(c)) })) }; };
const boxPositions = c => { const out = []; let t = 0; for (const bx of [1, 2, 3]) { const b = boxOn(c, bx, [6, 5, 4, 3, 2, 1]); if (!b) return null; const a = upDown(b), st = 0.5; out.push(...line(a, { step: st, t0: t, pcs: PENT(penK(c)) })); t += a.length * st; } return { notes: out }; };
const stopsPower = c => riffBars(c, { pats: (c.lvl || 4) >= 6 ? ['stopA', 'stopB', 'stopC', 'stopA'] : ['stopA', 'stopA', 'stopB', 'stopA'], kind: 'power' });
/** A single-note pentatonic riff on the low strings with the stops of the pattern. */
function stopsLine(c) {
  const b = boxOn(c, 1, [6, 5, 4]); if (!b) return null; const notes = []; let t = 0;
  const plan = [0, 0, 2, 0, 3, 2, 1, 0, 4, 2, 0, 5];
  ['stopA', 'stopB', 'stopC', 'stopA'].forEach((p, bar) => { PAT[p].forEach(([sl, len], j) => { const n = b[plan[(j + bar * 3) % plan.length]]; notes.push(tag(N(n[0], n[1], t + sl / 4, len / 4), PENT(penK(c)))); }); t += 4; });
  return { notes, chords: BACK(c) };
}
const deadEighths = c => riffBars(c, { pats: ['dead8'], kind: 'root', reps: 1 });
const deadSixteenths = c => riffBars(c, { pats: ['dead16'], kind: 'power' });
const mixedRiff = c => riffBars(c, { pats: ['stopA', 'dead8', 'stopB', 'dead16'], kind: 'power', reps: 1 });
const lineAnswer = c => {
  const b = boxOn(c, 1, [6, 5, 4, 3]); if (!b) return null; const a = riffBars(c, { pats: ['stab'], kind: 'power' }); if (!a) return null;
  const notes = []; let t = 0;
  [[0, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 0], [0, 2, 1, 3, 2, 4], [3, 2, 1, 0, 1, 0]].forEach(ix => { ix.forEach((i, j) => notes.push(tag(N(b[i][0], b[i][1], t + j * 0.5, 0.45), PENT(penK(c))))); t += 4; });
  return { notes, chords: BACK(c) };
};

// Advanced
/** Root–octave–fifth skip arpeggios on strings 6-4-2 or 5-3-1: the same two frets, the middle string untouched. */
function skipArps(c, orders, step) {
  const notes = []; let t = 0, bar = 0, near = 3; const used = [];
  for (const [d, q] of progOf(c)) {
    const root = mod12(c.key + d), R = lowRoot(root, near), nm = nameOf(root) + q; if (!R) return null; near = R.f;
    const sh = [[R.s, R.f], [R.s - 2, R.f + 2], [R.s - 4, R.f]], order = orders[bar % orders.length];
    order.forEach((i, j) => notes.push(tag(N(sh[i][0], sh[i][1], t + j * step, step * 0.95), [root, mod12(root + 7)])));
    t += order.length * step; if (order.length * step < 4) t = Math.ceil(t / 4) * 4; bar++; used.push(nm);
  }
  return { notes, chords: used };
}
const skipUp = c => skipArps(c, [[0, 1, 2, 1, 0, 1, 2, 1]], (c.lvl || 7) >= 8 ? 0.5 : 0.5);
const skipOrders = c => skipArps(c, [[0, 1, 2, 1, 0, 1, 2, 1], [2, 1, 0, 1, 2, 1, 0, 1], [0, 2, 1, 2, 0, 2, 1, 2], [0, 1, 2, 2, 1, 0, 0, 1]], 0.5);
/** Palm-muted bursts on box 1 (strings 4-3-2): three muted notes, one open, in 16ths. */
const pmBurst = c => {
  const b = boxOn(c, 1, [4, 3, 2]); if (!b) return null; const a = upDown(b), notes = []; let t = 0;
  for (let r = 0; r < 2; r++) a.forEach((p, i) => { notes.push(tag(N(p[0], p[1], t, 0.25, i % 4 === 3 ? null : 'pm'), PENT(penK(c)))); t += 0.25; });
  return { notes };
};
/** A palm-muted low root as the pedal under pentatonic notes that ring, in 16ths. */
const pmPedal = c => {
  const b = boxOn(c, 1, [3, 2]); if (!b) return null; const R = lowRoot(penK(c), 3); if (!R) return null; const notes = []; let t = 0, k = 0;
  for (let bar = 0; bar < 4; bar++) for (let beat = 0; beat < 4; beat++) for (let j = 0; j < 4; j++) {
    if (j % 2 === 0) notes.push(tag(N(R.s, R.f, t, 0.2, 'pm'), [penK(c)]));
    else { const p = b[(k++ + bar) % b.length]; notes.push(tag(N(p[0], p[1], t, 0.22), PENT(penK(c)))); }
    t += 0.25;
  }
  return { notes: notes.slice(0, 120), chords: null };
};
/** Hammer-on / pull-off groups on one string at a time (strings 4, 3, 2): pick, hammer, pull, in triplets. */
const hpPairs = c => {
  const b = boxOn(c, 1, [4, 3, 2]); if (!b) return null; const notes = []; let t = 0; const st = 1 / 3;
  const strs = [4, 3, 2, 3, 4];
  for (const s of strs) { const two = b.filter(n => n[0] === s); for (let r = 0; r < 2; r++) { notes.push(tag(N(s, two[0][1], t, st * 0.9), PENT(penK(c))), tag(N(s, two[1][1], t + st, st * 0.9, 'h'), PENT(penK(c))), tag(N(s, two[0][1], t + 2 * st, st * 0.9, 'p'), PENT(penK(c)))); t += 1; } }
  return { notes };
};
/** The box up with one pick per string (hammer the second note) and down with one pick per string (pull off). */
const hpBox = c => {
  const b = boxOn(c, 1, [6, 5, 4, 3, 2, 1]); if (!b) return null; const notes = []; let t = 0; const st = (c.lvl || 7) >= 8 ? 0.25 : 0.5;
  for (let i = 0; i < b.length; i += 2) { notes.push(tag(N(b[i][0], b[i][1], t, st * 0.95), PENT(penK(c))), tag(N(b[i + 1][0], b[i + 1][1], t + st, st * 0.95, 'h'), PENT(penK(c)))); t += 2 * st; }
  for (let i = b.length - 1; i > 0; i -= 2) { notes.push(tag(N(b[i][0], b[i][1], t, st * 0.95), PENT(penK(c))), tag(N(b[i - 1][0], b[i - 1][1], t + st, st * 0.95, 'p'), PENT(penK(c)))); t += 2 * st; }
  return { notes };
};
/** A 16-bar clean-up study from the four textures: stops, dead notes, skip arpeggios, legato line. */
function studyBars(c, n = 4) {
  const parts = [riffBars(c, { pats: ['stopA', 'stopB'], kind: 'power', t0: 0 }), riffBars(c, { pats: ['dead8', 'dead16'], kind: 'power', t0: 16 })];
  if (parts.some(p => !p)) return null;
  const sk = skipArps(c, [[0, 1, 2, 1, 0, 1, 2, 1]], 0.5); if (!sk) return null;
  sk.notes.forEach(x => { x.t += 32; });
  const notes = parts.flatMap(p => p.notes).concat(sk.notes);
  const hb = hpPairs(c); if (!hb) return null; hb.notes.forEach(x => { x.t += 48; });
  return { notes: notes.concat(hb.notes), chords: [...parts[0].chords, ...parts[1].chords, ...sk.chords, ...BACK(c)] };
}
const studyShort = c => {
  const a = riffBars(c, { pats: ['stopA', 'dead8'], kind: 'power', t0: 0 }), b = skipArps(c, [[0, 1, 2, 1, 0, 1, 2, 1]], 0.5);
  if (!a || !b) return null; b.notes.forEach(x => { x.t += 16; });
  const l = lineAnswer(c); if (!l) return null; l.notes.forEach(x => { x.t += 32; });
  return { notes: a.notes.concat(b.notes, l.notes), chords: [...a.chords, ...b.chords, ...BACK(c)] };
};

// Mastery
const box16 = c => { const b = boxOn(c, 1, [6, 5, 4, 3, 2, 1]); if (!b) return null; const a = upDown(b); return { notes: line(a, { step: 0.25, pcs: PENT(penK(c)) }).concat(line(a.slice(1), { step: 0.25, t0: a.length * 0.25, pcs: PENT(penK(c)) })) }; };
const skip16 = c => skipArps(c, [[0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1]], 0.25);
const keyStops = c => riffBars(c, { pats: ['stopA', 'stopB'], kind: 'power', prog: 'one', keys: [0, 5, 7, 3, 8, 10] });
const keyDead = c => riffBars(c, { pats: ['dead8', 'dead16'], kind: 'power', prog: 'one', keys: [0, 7, 2, 9, 4, 11] });

/* ------------------------------- The path ------------------------------- */
export default entry({
  id: 'stringMuting', kind: 'technique', title: 'String muting and damping', domain: 'picking',
  re: /string.?mut(e|es|ed|ing)|damp(en|ing|ed)? (the |your )?strings?|dead(en|ening)? (the )?strings?|(fret|fretting).?hand mut|mut(e|ing) (the )?(unused|unplayed|idle) strings|string noise/,
  aliases: ['muting', 'damping', 'string damping', 'muting unused strings', 'fretting hand muting', 'picking hand muting', 'eliminate string noise'],
  summary: 'Keeping every string you are not playing silent: lifting to stop a note, the fretting finger touching its neighbours, the heel and thumb of the picking hand on the strings below, then clean power chords, dead notes, skipped strings, palm-muted bursts and legato, to fast clean runs in every key.',
  prereqs: [],
  sources: [
    'https://www.guitar9.com/node/6349',
    'https://www.riffhard.com/?p=36281',
    'https://www.riffhard.com/?p=37390',
    'https://www.riffhard.com/?p=35620',
    'https://www.jasonstallworth.com/?p=7543',
    'https://community.justinguitar.com/t/muting-strings-deliberately/2205'
  ],
  pedagogy: {
    date: '2026-10-23',
    summary: 'Taught fretting hand first: the finger that frets a note also touches the strings next to it, and a note is stopped by lifting the finger just enough. Then the picking hand (the heel resting on the strings below, the thumb on a low string, the palm or a fingertip to stop a ringing note), then both hands together on slow scales and power chords, then the harder cases (skipped strings, fast runs, legato, high gain), slowly and with a metronome, recording yourself to hear the noise.',
    sequence: [
      { id: 'lift', tier: 'foundations', step: 'Stop a note by lifting the finger', how: 'Fret a note, pick it, and lift the finger just enough to stop the string on the beat; the root of a chord, then a pentatonic run, one note at a time and slowly.', skills: ['sm-lift'], source: 5 },
      { id: 'picking', tier: 'foundations', step: 'The picking hand: heel, thumb, palm and fingertip', how: 'The heel of the picking hand rests on the strings below the one you pick; the palm or a fingertip touches a ringing note to stop it.', skills: ['sm-heel'], source: 1 },
      { id: 'flat', tier: 'foundations', step: 'The fretting finger touches its neighbours', how: 'Angle the fretting finger across the strings so its tip touches the string above and the pad the string below; one note per string, then pairs of strings.', skills: ['sm-flat'], source: 4 },
      { id: 'power', tier: 'foundations', step: 'Clean power chords', how: 'Three-string power chords with the idle strings damped by the fretting finger and the palm; held, then stabbed with silence between.', skills: ['sm-power'], source: 2 },
      { id: 'first', tier: 'foundations', step: 'A first clean riff and line', how: 'Short riffs and a pentatonic motif over a progression, judged by listening for noise.', skills: ['sm-first'], source: 1 },
      { id: 'roll', tier: 'intermediate', step: 'Rolling one finger across strings', how: 'One finger frets a note, then rolls to the next string at the same fret; the string it leaves must stop as the next one sounds.', skills: ['sm-roll'], source: 0 },
      { id: 'box', tier: 'intermediate', step: 'Scales with both hands muting', how: 'The pentatonic box up and down slowly, every unused string damped by one hand or the other, then the next boxes.', skills: ['sm-box'], source: 2 },
      { id: 'stops', tier: 'intermediate', step: 'Stops and staccato riffs', how: 'Power-chord and single-note riffs with exact silences, ending notes on time with the fretting or the picking hand.', skills: ['sm-stops'], source: 1 },
      { id: 'dead', tier: 'intermediate', step: 'Dead notes in rhythm', how: 'Releasing the pressure so the strings are touched but not pitched, in 8ths then 16ths.', skills: ['sm-dead'], source: 4 },
      { id: 'mix', tier: 'intermediate', step: 'Riffs and lines using both hands', how: 'A riff that mixes stops, dead notes and chords, and a line answered by a riff.', skills: ['sm-mix'], source: 1 },
      { id: 'skip', tier: 'advanced', step: 'Skipped strings', how: 'Root, octave and fifth arpeggios that jump a string; the skipped string is touched by the fretting finger and the picking hand.', skills: ['sm-skip'], source: 2 },
      { id: 'pm', tier: 'advanced', step: 'Palm muting inside lead lines', how: 'Muted bursts ending in a ringing note; a muted pedal root under ringing notes.', skills: ['sm-pmlead'], source: 4 },
      { id: 'legato', tier: 'advanced', step: 'Clean legato', how: 'Hammer-ons and pull-offs with the idle strings damped, then across a whole box.', skills: ['sm-legato'], source: 4 },
      { id: 'adv-music', tier: 'advanced', step: 'A clean study', how: 'A short study using stops, dead notes, skipped strings and a legato line over a progression.', skills: ['sm-adv-music'], source: 0 },
      { id: 'speed', tier: 'mastery', step: 'Clean at tempo', how: 'The box and skip arpeggios in 16ths, raising the metronome only while the recording stays clean.', skills: ['sm-speed'], source: 1 },
      { id: 'keys', tier: 'mastery', step: 'The same riffs in every key', how: 'Stops and dead notes moved through six keys in a row.', skills: ['sm-keys'], source: 2 },
      { id: 'capstone', tier: 'mastery', step: 'A full study and a clean solo', how: 'A long study joining all four textures, then a solo over a progression with every phrase ending exactly.', skills: ['sm-cap'], source: 0 }
    ],
    drills: ['Lift a fretted note just enough to stop it on the beat', 'Rest the heel of the picking hand on the strings below while picking higher strings', 'One pentatonic note per string with the fretting finger touching its neighbours', 'Power chords held, then stabbed with silence between', 'Roll one finger across strings, stopping the string it leaves', 'Play the pentatonic box slowly with every idle string damped', 'Dead-note rhythms in 8ths and 16ths', 'Practise a riff at high gain and record it to hear the noise'],
    mistakes: ['Pressing the muting hand too hard: it chokes the note you want', 'Muting with the picking hand only and forgetting the fretting hand', 'Arching the fretting fingers like chord shapes instead of angling them across the strings', 'Palm muting every note, which kills the dynamics', 'Tension and gripping the neck', 'Speeding up before the recording is clean'],
    sources: [
      { title: 'The Sounds Of Silence', author: 'Guitar9 (guitar lesson on muting)', url: 'https://www.guitar9.com/node/6349' },
      { title: 'How to Mute Guitar Strings While Picking', author: 'Riffhard', url: 'https://www.riffhard.com/?p=36281' },
      { title: 'How to Dampen Guitar Strings', author: 'Riffhard', url: 'https://www.riffhard.com/?p=37390' },
      { title: 'How to Mute Strings on a Guitar', author: 'Riffhard', url: 'https://www.riffhard.com/?p=35620' },
      { title: 'Metal Guitar: How to Eliminate String Noise', author: 'Jason Stallworth', url: 'https://www.jasonstallworth.com/?p=7543' },
      { title: 'Muting Strings Deliberately (teachers and players discussing)', author: 'JustinGuitar community', url: 'https://community.justinguitar.com/t/muting-strings-deliberately/2205' }
    ]
  },
  ctx: { key: 4, minor: true, prog: 'powerMinor' },
  stages: [
    stage('foundations', 'Stop it, touch it, keep it clean',
      'Notes lifted to silence exactly on the beat at 60 BPM, a one-note-per-string pass and a pentatonic line with no neighbouring string sounding, and clean power chords held and stabbed over a four-chord progression at 80 BPM, eight bars with no extra string noise.', [
        S('sm-lift', 'Lift to stop a note', 'picking', 'The fretting finger lifts just enough to end the note.', [
          L('sm-lift-roots', 'Lift to stop: the roots of {chords} ({key})', 'chunking', { unit: 'staccato notes', goal: 80, start: 50, why: 'A note ends when the fretting finger lifts off, not when you stop picking. Learning to lift just enough, without letting go of the neck, is the first muting skill.', instr: 'Fret the root, pick it once, and lift the finger just enough to stop the string on the next beat, keeping the fingertip touching the string. One note a beat, one root a bar. Pass: 8 bars where every note stops on the beat with nothing left ringing.', watch: 'Lifting the whole hand off the neck: lift only enough to stop the string, finger still on it.', simplify: 'Half the tempo, one chord.' }, liftRoots),
          L('sm-lift-line', 'Lift to stop: the pentatonic run on the D string ({key})', 'accurate-reps', { unit: 'staccato notes', goal: 80, start: 50, why: 'The same lift on a line of moving notes: each fretting finger stops its own note as the next one is picked, so the run never blurs.', instr: 'Pick each note once and lift to stop it before the next beat; up the five notes and back, twice. Pass: 2 runs with every note short and clear.', watch: 'Notes running into each other because the lift came late.', simplify: 'Quarter notes at a slower tempo.' }, liftLineFret)
        ], ST('A guitar string rings until something stops it. The easiest stopper is the fretting finger itself: lift it just enough to end the vibration, and the note stops without any other movement.', 'Clean riffs and lines are mostly silence you made on purpose: this is the first way to make it.', ['Lifting a finger slightly relaxes the pressure but keeps contact, so the string is damped instead of buzzing.', 'A note shown short on the tab (a half beat in a whole beat) means the silence after it is part of the exercise.'])),
        S('sm-heel', 'The picking hand: heel, thumb, palm', 'picking', 'Strings below stay quiet; a finger or palm stops a ringing note.', [
          L('sm-stop-pick', 'Stop with the picking hand: the A-string run ({key})', 'chunking', { unit: 'staccato notes', goal: 80, start: 50, why: 'The picking hand can end a note too: the palm or a fingertip touches the string right after you pick it. It is the way to stop open strings and notes you cannot lift.', instr: 'Pick each note, then touch the string with the side of the picking hand to stop it on the next beat. Fretting finger stays down. Pass: 2 runs where every note stops on the beat.', watch: 'Touching the string before the note has sounded.', simplify: 'Only the first three notes.' }, stopLinePick),
          L('sm-heel-high', 'Heel on the low strings: the box on the G and B strings ({key})', 'accurate-reps', { unit: '8th notes', goal: 84, start: 50, why: 'When you pick the higher strings, the heel of the picking hand rests lightly on the strings below, so nothing underneath can ring.', instr: 'Rest the heel of the picking hand on the low strings, near the bridge. Pick the four notes on the G and B strings up and back, twice, with a steady pick. Pass: 2 passes with no low string sounding.', watch: 'Pressing so hard the heel moves your picking.', simplify: 'Pick only the G string notes.' }, heelHigh),
          L('sm-heel-three', 'Heel and thumb: the box on four strings ({key})', 'accurate-reps', { unit: '8th notes', goal: 84, start: 50, why: 'Moving across more strings means the damping must follow the pick. The heel and thumb move down the neck-side of the bridge with the picking.', instr: 'Pick the box notes on strings 4 to 1 up and back, keeping the picking hand resting on the strings below. Pass: one pass with no string ringing that you did not pick.', watch: 'Lifting the hand off as you cross strings.', simplify: 'Three strings.' }, heelThree)
        ], ST('The picking hand has three jobs: the heel rests on strings below the one being picked, the thumb can rest on a low string, and the palm or a fingertip stops a ringing note.', 'Many open-string rings are stopped only here: the fretting hand cannot reach them.', ['Light contact near the bridge damps a string without choking the string you pick.', 'The thumb on a low string is the standard way to damp it while you pick the strings above.'])),
        S('sm-flat', 'The fretting finger touches its neighbours', 'fretting', 'Angle the finger so its tip and pad damp the neighbouring strings.', [
          L('sm-flat-one', 'One note per string, each alone ({key})', 'accurate-reps', { unit: '8th notes', goal: 84, start: 50, why: 'A fretted note should touch the strings next to it so they cannot ring. Angling the finger across the strings, instead of arching it, lets the tip damp the string above and the pad the string below.', instr: 'Play the lowest pentatonic note on each string, from the low E to the high e and back, angling each fretting finger across the strings. Listen for any other string. Pass: 2 passes up and back with only the picked string sounding.', watch: 'Arched fingers: they leave the neighbouring strings free to ring.', simplify: 'Quarter notes.' }, flatOnePer),
          L('sm-flat-pairs', 'Two notes per string, pair by pair ({key})', 'chunking', { unit: '8th notes', goal: 84, start: 50, why: 'The same damping while the finger changes fret: the pair stays on one string, so only the finger moves, not the damping of the others.', instr: 'Play the two box notes on the low pair of strings, then the middle pair, then the high pair, and back. Pass: 2 clean passes with no neighbouring string sounding.', watch: 'Lifting the finger off the string above when the second note comes.', simplify: 'One pair of strings.' }, flatPairs)
        ], ST('The finger that frets a note also damps: angled across the strings, its tip rests on the string above and its pad on the string below.', 'This keeps scales and riffs clean without any extra movement.', ['The first finger usually damps the lower strings because it can reach back.', 'If a lower string rings, check that the damping finger lies flat on it.'])),
        S('sm-power', 'Clean power chords', 'picking', 'Three-string power chords with the idle strings damped.', [
          L('sm-power-hold', 'Held power chords, idle strings damped: {chords} ({key})', 'accurate-reps', { unit: 'quarter notes', goal: 80, start: 50, why: 'A power chord has three sounding strings and three idle ones. The idle ones are damped by the fretting finger above and the picking-hand heel below.', instr: 'Strum only the three chord strings, with the first finger lightly touching the next string up. Hold each chord for the pattern, then change. Pass: 8 bars with no idle string ringing.', watch: 'Strumming all six strings.', simplify: 'One chord for four bars.' }, powerHold),
          L('sm-power-stab', 'Stabbed power chords with silence between: {chords} ({key})', 'chunking', { unit: '8th notes', goal: 84, start: 50, why: 'Between stabs, release the chord pressure without leaving the strings, so the chord stops dead and the silence is clean.', instr: 'Hit the chord on the beat and release the pressure right after, keeping the fingers on the strings. Pass: 8 bars where every stab stops completely.', watch: 'Lifting the fingers right off the strings: they should stay touching.', simplify: 'Half the tempo.' }, powerStab)
        ], ST('A power chord is root, fifth and octave. The other strings are damped by the finger above the chord and the heel of the picking hand.', 'Clean power chords are the base of rock rhythm.', ['The fifth is two frets higher on the next string.', 'Release pressure to stop the chord, keeping the fingers lightly on the strings.'])),
        S('sm-first', 'First clean music', 'rhythm', 'A first riff and line, judged by listening for noise.', [
          L('sm-first-riff', 'First clean riff: stabs and one syncopated bar ({chords})', 'transfer', { unit: '8th notes', goal: 88, start: 54, why: 'Stabs with silences between are where muting shows. Over the backing the silence has to fit the groove.', instr: 'Play the stabs with the chord strings only, releasing right after. Pass: 8 bars locked to the backing with no extra noise.', watch: 'Stabs that ring into the silence.', simplify: 'Bars of stabs only.' }, firstRiff),
          L('sm-first-line', 'First clean line: a motif and its answers ({chords})', 'transfer', { unit: '8th notes', goal: 88, start: 54, why: 'A pentatonic motif with spaces turns the muting into phrasing: each phrase ends where you end it.', instr: 'Play the four-note motif in the first half of each bar and let the second half be silent, stopping the last note with a lift. Pass: 4 bars with clean endings.', watch: 'The last note of each phrase ringing into the silence.', simplify: 'Two bars.' }, firstLine)
        ], ST('Silence is a note value. In a riff or a line it is made by a hand, on time.', 'It is what separates a clean part from a messy one.', ['A good test is to play and listen only to the rests.', 'Recording yourself shows noise you do not hear while playing.']))
      ], [1, 3]),
    stage('intermediate', 'Rolling, boxes and stops',
      'The pentatonic box up and down in 8ths at 100 BPM with every idle string damped, finger rolls across strings, power-chord and single-note riffs with exact stops, and dead-note rhythms in 8ths and 16ths, played over a four-chord progression for 8 bars with no extra noise.', [
        S('sm-roll', 'Rolling one finger across strings', 'fretting', 'Same-fret fourths: the finger rolls from one string to the next.', [
          L('sm-roll-low', 'Rolling across the low strings: fourths on E–A and A–D ({key})', 'chunking', { unit: '8th notes', goal: 96, start: 56, why: 'One finger rolling from a string to the next at the same fret keeps the damping on: as the finger leaves a string, it still touches it.', instr: 'Play a pentatonic note, then roll the same finger onto the next string at the same fret. Go through the root, 4th, 5th and ♭7 notes. Pass: 2 passes where the note you leave stops as the next sounds.', watch: 'Lifting the finger instead of rolling it.', simplify: 'Only the first two notes.' }, rollLow),
          L('sm-roll-mid', 'Rolling across the middle strings: fourths on D–G and B–e ({key})', 'chunking', { unit: '8th notes', goal: 96, start: 56, why: 'The same roll on other string pairs, which trains the finger angle on strings where the spacing changes.', instr: 'The same four rolls on the D and G strings and on the B and high e strings. Pass: 2 passes with no overlap between the two notes.', watch: 'Notes overlapping because the roll is slow.', simplify: 'One string pair.' }, rollMid)
        ], ST('A finger can fret two strings at once by rolling: the fingertip presses one, the pad rests on the other.', 'It is how barre chords and fast arpeggios stay clean.', ['In the pentatonic scale, every note except the ♭3 has its perfect fourth on the next string at the same fret.', 'Roll from the tip to the pad and back.'])),
        S('sm-box', 'The box with both hands muting', 'fretboard', 'Scale boxes where every idle string is damped.', [
          L('sm-box-one', 'Box 1 up and down, every string clean ({key})', 'accurate-reps', { unit: '8th notes', goal: 104, start: 60, why: 'Playing a scale slowly reveals the noise: this drill finds it. Each hand covers the strings it can reach.', instr: 'Play the box up and back with a steady pick, the fretting finger touching its neighbours and the picking hand resting. Pass: 2 passes clean at the goal tempo.', watch: 'Rushing before the passes are clean.', simplify: 'Three strings at a time.' }, boxUpDown),
          L('sm-box-three', 'Boxes 1, 2 and 3, one after another ({key})', 'interleaving', { unit: '8th notes', goal: 100, start: 60, why: 'New positions bring new finger angles. The damping has to be rebuilt in each box.', instr: 'Play box 1 up and back, then box 2, then box 3, in 8ths. Pass: one run through the three boxes with no extra string sounding.', watch: 'The picking-hand heel sliding off the strings.', simplify: 'Two boxes.' }, boxPositions)
        ], ST('Every pentatonic box has strings it does not use at that moment; those must be damped as well.', 'This is the daily exercise for clean lead playing.', ['Each box is two notes per string.', 'Playing slowly lets you hear where the noise comes from.'])),
        S('sm-stops', 'Stops and staccato riffs', 'rhythm', 'Exact silences.', [
          L('sm-stops-power', 'Power-chord riffs with stops: {chords} ({key})', 'accurate-reps', { unit: '8th notes', goal: 104, start: 60, why: 'A stop ends the chord exactly on time. The fretting hand releases pressure; the picking hand touches the strings.', instr: 'Play the pattern with the chord stopping at the end of each hit. Pass: 8 bars where every stop is audible.', watch: 'The chord ringing a little after each stop.', simplify: 'Only the first pattern.' }, stopsPower),
          L('sm-stops-line', 'A single-note riff with stops ({key})', 'chunking', { unit: '8th notes', goal: 104, start: 60, why: 'Single notes are stopped by lifting the finger, and open strings by the picking hand.', instr: 'Play the riff with each note lifted at the end of its length. Pass: 4 bars of exact stops.', watch: 'Notes sustained past their length.', simplify: 'One bar.' }, stopsLine)
        ], ST('A stop is an event: the note ends on a count, like a note starts on one.', 'Metal, funk and rock riffs rely on exact stops.', ['The silences are as precise as the notes.', 'Use the click to hear the stops.'])),
        S('sm-dead', 'Dead notes in rhythm', 'rhythm', 'Touching strings without pitch.', [
          L('sm-dead-eighths', 'Dead notes on the off-beats: roots and x in 8ths ({chords})', 'accurate-reps', { unit: '8th notes', goal: 100, start: 60, why: 'A dead note is a string touched with the pressure released: it gives a click of rhythm without pitch.', instr: 'Play the root on the beat and a dead note on the off-beat by relaxing the fretting hand. Pass: 8 bars with a clear difference between notes and dead notes.', watch: 'Dead notes that sound a pitch because the pressure is not released enough.', simplify: 'Half the tempo.' }, deadEighths),
          L('sm-dead-sixteenths', 'Dead notes in 16ths: power chords and x ({chords})', 'chunking', { unit: '16th notes', goal: 92, start: 54, why: 'Faster dead notes are the base of funk and metal rhythm.', instr: 'Play the pattern in 16ths: chords where marked and dead notes in between. Pass: 4 bars at the goal tempo.', watch: 'Tension in the fretting hand.', simplify: 'Play the 8ths pattern first.' }, deadSixteenths)
        ], ST('A dead note is made by releasing the fretting-hand pressure while the finger still rests on the strings.', 'It adds rhythm without adding pitches.', ['The strings are touched, not pressed to the fret.', 'A dead note is shown with an x.'])),
        S('sm-mix', 'Riffs and lines with both hands', 'rhythm', 'Stops, dead notes, chords and lines together.', [
          L('sm-mix-riff', 'A mixed riff: stops and dead notes ({chords})', 'transfer', { unit: '16th notes', goal: 98, start: 58, why: 'Real riffs mix chords, stops and dead notes in a few bars; this joins them.', instr: 'Play the four bars of different patterns without a pause. Pass: 2 passes with every stop and dead note clear.', watch: 'Switching patterns late.', simplify: 'Play two bars.' }, mixedRiff),
          L('sm-mix-answer', 'A pentatonic line answered by stabs ({chords})', 'transfer', { unit: '8th notes', goal: 98, start: 58, why: 'A line and a riff in one part needs the damping to change between them.', instr: 'Play the six-note line and let each end clean. Pass: 4 bars with no noise in the rests.', watch: 'Line notes ringing over the riff.', simplify: 'Play the first two bars.' }, lineAnswer)
        ], ST('Real parts use all the damping at once.', 'It is the application of every earlier skill in one part.', ['Plan the damping before you play.', 'Record and listen.']))
      ], [4, 6]),
    stage('advanced', 'Skips, bursts and legato',
      'Root–octave–fifth skip arpeggios in 8ths at 112 BPM with the skipped string silent, palm-muted bursts that end in a ringing note, hammer-on and pull-off groups with the idle strings damped, and a 16-bar clean study over a progression with nothing sounding that is not written.', [
        S('sm-skip', 'Skipped strings', 'picking', 'The string between stays silent.', [
          L('sm-skip-up', 'Skip arpeggios: root, octave, fifth on strings 6-4-2 ({chords})', 'accurate-reps', { unit: '8th notes', goal: 108, start: 64, why: 'Skipping a string leaves it free to ring. The fretting finger touches it and the picking hand rests on it.', instr: 'Each bar is one chord: root on the low string, the octave two strings up (two frets higher) and the fifth two strings above that, on the root fret. The string between each pair is skipped: let the fretting finger that plays the lower note lean over to touch it, and rest the picking-hand heel on the strings below. Alternate pick in 8ths. Pass: 4 bars (two times through) with the skipped strings completely silent.', watch: 'The pick brushing the skipped string on the way past: raise the pick a little and keep the leap small.', simplify: 'Play root and octave only, then add the fifth.' }, skipUp),
          L('sm-skip-orders', 'Skip arpeggios in four orders ({chords})', 'variable', { unit: '8th notes', goal: 108, start: 64, why: 'Different orders change which string the hands have to damp.', instr: 'Bar 1 goes up, bar 2 comes down, bar 3 jumps from the root to the fifth and back, bar 4 ends on the root. Each order leaves a different string to damp: check the skipped one every time. Pass: 4 bars with no skipped string sounding, in the order written.', watch: 'Playing the order from the previous bar when the chord changes.', simplify: 'Only the first two orders, two bars each.' }, skipOrders)
        ], ST('A skipped string is silenced by two things: the fretting finger touching it and the picking hand resting.', 'This is the base of string-skipping arpeggios and wide-interval lines.', ['The shape of root, octave, fifth uses the same frets on strings 6-4-2 and 5-3-1.', 'The skip is a leap for the pick; keep it small.'])),
        S('sm-pmlead', 'Palm muting in lead lines', 'picking', 'Muted bursts and a muted pedal root.', [
          L('sm-pm-burst', 'Muted bursts ending in a ringing note ({key})', 'chunking', { unit: '16th notes', goal: 100, start: 58, why: 'Palm muting shapes lines: three muted notes and one open note make a burst.', instr: 'Climb the box on strings 4 to 2 in 16ths and back. The notes marked pm are played with the side of the palm resting on the strings at the bridge; the fourth note of each group is played with the palm lifted so it rings. Pass: 2 passes in which every fourth note rings and the other three are short and clear.', watch: 'Lifting the palm a note early, so the third note rings too.', simplify: 'Half tempo, or mute only the first note of each group of four.' }, pmBurst),
          L('sm-pm-pedal', 'A muted pedal root under ringing notes ({key})', 'chunking', { unit: '16th notes', goal: 96, start: 56, why: 'The muted root is a drone under the line.', instr: 'The muted low root is played on every other 16th with the palm resting; the notes from the G and B strings in between are played with the palm lifted just enough to ring. Pass: 4 bars (16 beats) where the root stays short and the box notes stay clear.', watch: 'The palm dragging on the box notes, or the root ringing out.', simplify: 'Half tempo, with the root and one box note only.' }, pmPedal)
        ], ST('Palm muting inside a lead line turns muting into shape.', 'It adds contrast between short and long notes.', ['The palm rests at the bridge for the muted notes.', 'The ringing note is where the palm lifts.'])),
        S('sm-legato', 'Clean legato', 'fretting', 'Hammer-ons and pull-offs with idle strings damped.', [
          L('sm-legato-pairs', 'Hammer-on and pull-off groups on one string at a time ({key})', 'accurate-reps', { unit: '8th-note triplets', goal: 96, start: 56, why: 'Legato leaves the picking hand free to damp, but the fretting hand has to do more work.', instr: 'On each string pick the lower fret, hammer on to the higher fret and pull off back, twice, then move to the next string: D, G, B, G, D. The fretting finger of the lower note stays down and touches the string above; the picking-hand heel rests on the strings below. Pass: 2 passes with all three notes of every group equal in volume and no neighbouring string sounding.', watch: 'A weak hammer-on or pull-off: strike the hammer from above and flick the pull-off sideways.', simplify: 'Two groups per string, at half tempo.' }, hpPairs),
          L('sm-legato-box', 'The whole box with one pick per string ({key})', 'chunking', { unit: '8th notes', goal: 104, start: 60, why: 'Across strings, the damping must follow.', instr: 'Climb the box picking the first note of each string and hammering the second; come down picking the second and pulling off to the first. Pass: 2 passes with a clean string change every time.', watch: 'A burst of noise at the string change: the finger that leaves a string should still touch it.', simplify: 'Play three strings, then six.' }, hpBox)
        ], ST('Legato makes two notes with one pick.', 'It shows how well the idle strings are damped.', ['Pick the first note, hammer the second.', 'On the way down, pull off.'])),
        S('sm-adv-music', 'A clean study', 'rhythm', 'The four textures in one piece.', [
          L('sm-adv-study', 'A clean study: stops, dead notes, skip arpeggios and legato ({chords})', 'transfer', { unit: '8th notes', goal: 104, start: 60, why: 'All four textures in a row, as in a real part.', instr: 'Four bars of stops, then four of dead notes, then four bars of skip arpeggios, then the pentatonic line and its answers. Pass: one pass with nothing sounding that is not written, in time with the click.', watch: 'Rushing the change from one texture to the next.', simplify: 'Play one four-bar section at a time.' }, studyShort),
          L('sm-adv-line', 'A pentatonic line over the progression ({chords})', 'transfer', { unit: '8th notes', goal: 100, start: 60, why: 'Lines are where the noise shows most.', instr: 'Play each six-note line in the first half of the bar and stab the chord on the next. Stop each phrase by lifting or touching the string. Pass: 4 bars where the rests between phrases are silent.', watch: 'Line notes ringing into the stabs.', simplify: 'Play the first two bars only.' }, lineAnswer)
        ], ST('A study joins the skills in order.', 'Playing a piece shows what drills do not.', ['Listen back.', 'Keep the tempo steady.']))
      ], [7, 8]),
    stage('mastery', 'Clean at tempo, in every key',
      'The box and the skip arpeggios in 16ths at 100 BPM with the recording clean, stops and dead notes through six keys in a row, and an original 16-bar study and a solo with every phrase ending exactly on time.', [
        S('sm-speed', 'Clean at tempo', 'picking', 'The box and the skip arpeggios in 16ths.', [
          L('sm-speed-box', 'Box 1 in 16ths, clean ({key})', 'edge', { unit: '16th notes', goal: 100, start: 64, why: 'Speed shows the noise. Raise the metronome only while the recording stays clean.', instr: 'Play the box up and back in 16ths twice, recording the take. Raise the metronome by 4 BPM only after a take with no extra noise. Pass: 2 recorded takes in a row at the goal tempo with every idle string silent.', watch: 'Raising the tempo before the recording is clean.', simplify: 'Play 8ths at the same BPM.' }, box16),
          L('sm-speed-skip', 'Skip arpeggios in 16ths ({chords})', 'edge', { unit: '16th notes', goal: 100, start: 64, why: 'Skips at speed need both hands to damp the middle string.', instr: 'Play the root–octave–fifth skip arpeggios in 16ths, four notes to a beat, recording the take. Pass: 4 bars with the skipped strings silent on the recording.', watch: 'The skipped string ringing when the pick moves faster.', simplify: 'Play 8ths at the same BPM.' }, skip16)
        ], ST('Tempo reveals what slow playing hides.', 'The goal is control, not speed.', ['Record yourself.', 'Raise the tempo in small steps.'])),
        S('sm-keys', 'The same riffs in every key', 'fretboard', 'Stops and dead notes through six keys.', [
          L('sm-keys-stops', 'Stops through six keys, one bar each ({key} first)', 'interleaving', { unit: '8th notes', goal: 108, start: 64, why: 'Changing key changes the fret and the strings the hands damp.', instr: 'Play one bar of the stop pattern in each of the six keys written, starting in the key of the lesson, moving the root without stopping. Pass: one pass through all six keys with every stop exact.', watch: 'A stop that rings because the new root sits on a different string.', simplify: 'Three keys, then six.' }, keyStops),
          L('sm-keys-dead', 'Dead notes through six keys, one bar each ({key} first)', 'interleaving', { unit: '16th notes', goal: 96, start: 58, why: 'The same for dead notes.', instr: 'Play one bar of the dead-note pattern in each of the six keys written. Pass: one pass in which the dead notes stay unpitched in every key.', watch: 'Dead notes that sound a pitch on the new strings.', simplify: 'Three keys, then six.' }, keyDead)
        ], ST('Moving a riff to another key tests the damping on new strings.', 'It makes muting automatic.', ['The shape stays the same.', 'Know the string above and below.'])),
        S('sm-cap', 'Capstone: a full study and a clean solo', 'improv', 'Joining everything.', [
          L('sm-cap-study', 'Capstone study: four textures, 16 bars ({key})', 'transfer', { unit: '8th notes', goal: 108, start: 64, why: 'A long original study joining stops, dead notes, skip arpeggios and legato.', instr: 'Play the 16 bars: stops and dead notes, then skip arpeggios, then the legato groups. Pass: one take you would be happy to record, with nothing sounding that is not written.', watch: 'Rushing the legato groups at the end.', simplify: 'Four bars at a time, then eight.' }, studyBars),
          c => {
            const x = targetGuide(c, { prog: 'minorRock', id: 'sm-cap-solo', name: 'Capstone solo: every phrase ends on time ({key})' }); if (!x) return null;
            return { ...x, name: x.name.replace(/\{key\}/g, `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`), domain: 'picking', method: 'transfer',
              why: 'In a solo the muting is invisible when it is right: every phrase ends where you end it, with no string noise.',
              instr: 'Improvise over the backing with the pentatonic scale, aiming each phrase at the guide note and ending it by lifting or touching the string. Record a chorus. Pass: one chorus where every phrase starts and ends clean.',
              watch: 'Phrases that end by fading into noise.', simplify: 'Play only the guide notes, each stopped on time.' };
          }
        ], ST('The final test is a performance: the listener hears only what you intend.', 'This is mastery of muting.', ['Record and listen.', 'Own your silences.']))
      ], [9, 10])
  ]
});
