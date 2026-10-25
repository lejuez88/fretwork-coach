// Finger independence and the chromatic "spider": one finger per fret, the four fretting fingers
// moving on their own, in every order, across strings and up the neck.
//
// Concept-first (CONTENT.md): the model is a POSITION p (the fret under the first finger) and four FINGERS
// 1-4 that each own one fret of the position: finger f plays fret p + f - 1. Every exercise is a list of
// [string, finger] events; the fret is derived from the position, so a note can only be one of the four
// frets of its position. A PERMUTATION is an order of the four fingers (1-3-2-4), a GROUPING is a short
// cell of 3 to 7 fingers repeated, and the SPIDER is the cell 1-2-3-4 spread over two neighbouring strings
// (fingers 1 and 3 on the lower string, 2 and 4 on the higher). Where an exercise lands in music
// (approaching the root of the key from a half step below, or from above, then the minor pentatonic),
// those notes are checked against the pitch classes of the key.
//
// Teaching method first (CONTENT.md, `pedagogy` below), researched 2026-10-25: the sources start with
// 1-2-3-4 on frets 1 to 4 of each string with one pick stroke per note, then shift the shape up a fret,
// then the two-finger pairs (1-2, 2-3, 3-4, then 1-3, 2-4, 1-4), then the reversed and mixed orders, then
// the spider walk and string crossing, then 3-note and 4-note groupings and longer cells, rhythmic
// displacement, skipped strings, and finally musical phrases, always slow with a metronome and relaxed.
import { OPEN, N, nameOf, make, mod12, S, stage, entry, pentBox, minorKey } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const FING = new WeakMap();    // note → { p, f }: its fret must be p + f - 1
export const ALLOW = new WeakMap();   // note → pitch classes it must belong to (landing notes and pentatonic notes)
const fnote = (s, p, f, t, d, x = null, pcs = null) => { const n = N(s, p + f - 1, t, d, x); FING.set(n, { p, f }); if (pcs) ALLOW.set(n, pcs); return n; };
const pnote = (s, f, t, d, pcs) => { const n = N(s, f, t, d); ALLOW.set(n, pcs); return n; };
/** Events [string, finger] played one after another with a fixed step (beats) and gate; marks[i] optional technique. */
function run(ev, p, { step, gate = 0.92, t0 = 0, marks = null }) {
  return ev.map(([s, f], i) => fnote(s, p, f, t0 + i * step, step * gate, marks ? marks[i] : null));
}
/** The step in beats for a unit by level thresholds: [[lvl, step], …] from the lowest. */
const stepAt = (c, table) => { let st = table[0][1]; for (const [l, s] of table) if ((c.lvl || 1) >= l) st = s; return st; };
const lv = c => c.lvl || 1;
/** A position that moves with the key but stays low enough to keep the whole shape comfortable: 1…9. */
const posOf = c => 1 + (mod12(c.key) % 9);
const SIX = [6, 5, 4, 3, 2, 1];
const PENT = k => [0, 3, 5, 7, 10].map(x => mod12(k + x));
const cells = (perms, s) => perms.flatMap(pm => pm.map(f => [s, f]));

/** The spider on a pair of strings (a below b): 1 and 3 on a, 2 and 4 on b (order 0), or 1 and 3 on b (order 1). */
const spiderCell = (a, b, order = 0) => (order ? [[b, 1], [a, 2], [b, 3], [a, 4]] : [[a, 1], [b, 2], [a, 3], [b, 4]]);
/** Legato marks for a list of events on equal strings: first note picked, then h when the fret rises, p when it falls. */
function legatoOf(ev, p) {
  return ev.map(([s, f], i) => { if (i === 0 || ev[i - 1][0] !== s) return null; return f > ev[i - 1][1] ? 'h' : 'p'; });
}
/** Approach the root of the key's minor pentatonic: a fret on a low string, 4…14, and the string. */
function rootSpot(c) {
  const k = minorKey(c);
  for (const s of [6, 5, 4, 3]) for (let f = 4; f <= 14; f++) if (mod12(pitch(s, f)) === mod12(k)) return { s, f, k };
  return null;
}
const backOf = c => [nameOf(minorKey(c)) + 'm'];

/* ------------------------------ The lesson wrapper ------------------------------ */
function L(id, name, method, o, build) {
  return c => {
    const r = build(c); if (!r || !r.notes || r.notes.length < 4 || r.notes.length > 400) return null;
    const keyName = `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`, pos = posOf(c), root = r.root != null ? nameOf(r.root) : '';
    const fill = x => String(x).replace(/\{key\}/g, keyName).replace(/\{pos\}/g, pos).replace(/\{root\}/g, root);
    return make(c, {
      id, name: fill(name), domain: 'fretting', method, unit: o.unit, goal: o.goal, start: o.start, minutes: o.minutes || 5,
      why: o.why, instr: fill(o.instr), watch: o.watch, simplify: o.simplify,
      ...(r.back ? { backing: r.back, chords: r.back } : {}), tab: { notes: r.notes }
    });
  };
}
const ST = (concept, why, theory) => ({ concept, why, theory });

/* ------------------------------ Skill builders ------------------------------ */
// Foundations
const oneToFour = c => {
  const step = stepAt(c, [[1, 1], [2, 0.5]]), notes = [];
  SIX.forEach((s, i) => notes.push(...run([1, 2, 3, 4].map(f => [s, f]), 1, { step, t0: i * 4 * step })));
  if (lv(c) >= 3) SIX.slice().reverse().forEach((s, i) => notes.push(...run([4, 3, 2, 1].map(f => [s, f]), 1, { step, t0: (6 + i) * 4 * step })));
  return { notes };
};
const shiftUp = c => {
  const step = stepAt(c, [[1, 1], [2, 0.5]]), notes = [], n = lv(c) >= 3 ? 5 : lv(c) >= 2 ? 4 : 3;
  for (let p = 1; p <= n; p++) notes.push(...run([1, 2, 3, 4].map(f => [4, f]), p, { step, t0: (p - 1) * 4 * step }));
  for (let p = n - 1; p >= 1; p--) notes.push(...run([4, 3, 2, 1].map(f => [4, f]), p, { step, t0: (2 * n - 1 - p) * 4 * step }));
  return { notes };
};
const pairRun = (pairs, p, s, reps, step) => {
  const notes = []; let t = 0;
  for (const [a, b] of pairs) for (let r = 0; r < reps; r++) { notes.push(...run([[s, a], [s, b]], p, { step, t0: t })); t += 2 * step; }
  return notes;
};
const pairsNear = c => ({ notes: pairRun([[1, 2], [2, 3], [3, 4]], 1, 4, lv(c) >= 2 ? 4 : 3, stepAt(c, [[1, 1], [2, 0.5]])) });
const pairsWide = c => {
  const pairs = lv(c) >= 2 ? [[1, 3], [2, 4], [1, 4], [3, 1], [4, 2], [4, 1]] : [[1, 3], [2, 4], [1, 4]];
  return { notes: pairRun(pairs, 5, 4, 3, stepAt(c, [[1, 1], [2, 0.5]])) };
};
const reverseOne = c => {
  const step = stepAt(c, [[1, 1], [2, 0.5]]), perms = lv(c) >= 2 ? [[4, 3, 2, 1], [1, 3, 2, 4], [4, 2, 3, 1]] : [[4, 3, 2, 1], [1, 3, 2, 4]], notes = [];
  perms.forEach((pm, i) => notes.push(...run(pm.map(f => [4, f]), 1, { step, t0: i * 8 * step }), ...run(pm.map(f => [3, f]), 1, { step, t0: i * 8 * step + 4 * step })));
  return { notes };
};
const reverseDown = c => {
  const step = stepAt(c, [[1, 1], [2, 0.5]]), notes = [];
  SIX.slice().reverse().forEach((s, i) => notes.push(...run([4, 3, 2, 1].map(f => [s, f]), lv(c) >= 3 ? 5 : 1, { step, t0: i * 4 * step })));
  return { notes };
};
/** Chromatic approach to the root of the key's minor pentatonic, from below (fingers 1-2-3-4 ending on the root) or above (4-3-2-1). */
function approach(c, from) {
  const r = rootSpot(c); if (!r) return null; const pcs = [mod12(r.k)], step = stepAt(c, [[1, 1], [3, 0.5]]), notes = []; let t = 0;
  const reps = lv(c) >= 3 ? 4 : 3;
  for (let i = 0; i < reps; i++) {
    const p = from === 'below' ? r.f - 3 : r.f, perm = from === 'below' ? [1, 2, 3, 4] : [4, 3, 2, 1];
    const land = from === 'below' ? 3 : 3;
    perm.forEach((f, j) => { const n = fnote(r.s, p, f, t + j * step, j === land ? 4 * step : step * 0.92, null, j === land ? pcs : null); notes.push(n); });
    t += 8 * step; if (t % 4) t = Math.ceil(t / 4) * 4;
  }
  return { notes, back: backOf(c), root: r.k };
}
const approachBelow = c => approach(c, 'below');
const approachAbove = c => approach(c, 'above');

// Intermediate
const spiderRun = (c, dir, order, step) => {
  const p = posOf(c), pairs = [[6, 5], [5, 4], [4, 3], [3, 2], [2, 1]], notes = []; let t = 0;
  const list = dir === 'up' ? pairs : pairs.slice().reverse();
  for (const [a, b] of list) {
    const cell = dir === 'up' ? spiderCell(a, b, order) : spiderCell(a, b, order).slice().reverse();
    notes.push(...run(cell, p, { step, t0: t })); t += 4 * step;
  }
  return { notes, pos: p };
};
const spiderUp = c => spiderRun(c, 'up', 0, stepAt(c, [[4, 0.5], [6, 0.25]]));
const spiderDown = c => spiderRun(c, 'down', lv(c) >= 5 ? 1 : 0, stepAt(c, [[4, 0.5], [6, 0.25]]));
const spiderBack = c => {
  const up = spiderRun(c, 'up', 0, 0.25), dn = spiderRun(c, 'down', 0, 0.25); if (!up || !dn) return null;
  const off = 5 * 4 * 0.25; dn.notes.forEach(n => { n.t = +(n.t + off).toFixed(4); });
  return { notes: up.notes.concat(dn.notes) };
};
const PERMS_A = [[1, 3, 2, 4], [2, 4, 1, 3], [4, 2, 3, 1]];
const PERMS_B = [[1, 2, 4, 3], [1, 4, 2, 3], [3, 1, 4, 2]];
const permOne = c => {
  const step = stepAt(c, [[4, 0.5], [6, 0.25]]), p = posOf(c), notes = []; let t = 0;
  for (const pm of PERMS_A) for (let r = 0; r < 2; r++) { notes.push(...run(pm.map(f => [3, f]), p, { step, t0: t })); t += 4 * step; }
  return { notes, pos: p };
};
const permTwo = c => {
  const step = stepAt(c, [[4, 0.5], [6, 0.25]]), p = posOf(c), notes = []; let t = 0;
  for (const pm of PERMS_B) for (let r = 0; r < 2; r++) { notes.push(...run(pm.map(f => [2, f]), p, { step, t0: t })); t += 4 * step; }
  return { notes, pos: p };
};
const permCross = c => {
  const step = stepAt(c, [[4, 0.5], [6, 0.25]]), p = posOf(c), notes = []; let t = 0;
  for (const [a, b] of [[4, 3], [3, 2], [2, 1]]) for (const pm of [PERMS_A[0], PERMS_A[1]]) { notes.push(...run(pm.map((f, i) => [i % 2 ? b : a, f]), p, { step, t0: t })); t += 4 * step; }
  return { notes, pos: p };
};
const posWalk = c => {
  const step = stepAt(c, [[4, 0.5], [6, 0.25]]), notes = []; let t = 0;
  for (const p of [1, 5, 9, 12]) for (let r = 0; r < 2; r++) { notes.push(...run([1, 3, 2, 4].map(f => [3, f]), p, { step, t0: t })); t += 4 * step; }
  return { notes };
};
const posLegato = c => {
  const step = stepAt(c, [[4, 0.5], [6, 0.25]]), p = posOf(c), notes = []; let t = 0;
  const ev = PERMS_A.flatMap(pm => pm.map(f => [3, f]));
  for (let r = 0; r < 2; r++) { const marks = legatoOf(ev.map(([s, f]) => [s, p + f - 1]), p); notes.push(...run(ev, p, { step, t0: t, marks })); t += ev.length * step; }
  return { notes, pos: p };
};
const GROUP3 = [[1, 2, 4], [1, 4, 2], [2, 1, 4], [2, 4, 1], [4, 2, 1], [4, 1, 2]];
const group3 = c => {
  const step = 1 / 3, p = posOf(c), notes = []; let t = 0, n = lv(c) >= 5 ? 6 : 4;
  GROUP3.slice(0, n).forEach(g => { notes.push(...run(g.map(f => [3, f]), p, { step, t0: t })); t += 3 * step; });
  if (t % 4) t = Math.ceil(t / 4) * 4; return { notes: notes.concat(GROUP3.slice(0, n).flatMap((g, i) => run(g.map(f => [2, f]), p, { step, t0: t + i * 3 * step }))), pos: p };
};
const group4 = c => {
  const step = stepAt(c, [[4, 0.5], [6, 0.25]]), p = posOf(c), G = [[1, 2, 4, 2], [1, 4, 2, 4], [2, 1, 3, 1], [3, 4, 1, 4]], notes = []; let t = 0;
  G.forEach(g => { for (let r = 0; r < 2; r++) { notes.push(...run(g.map(f => [4, f]), p, { step, t0: t })); t += 4 * step; } });
  return { notes, pos: p };
};
/** A chromatic fill into the root of the key's minor pentatonic, then the first box coming down. */
function fillLick(c, kind) {
  const r = rootSpot(c); if (!r) return null; const pcs = PENT(r.k), step = 0.5, notes = []; let t = 0;
  const cell = kind === 'perm' ? [2, 1, 3, 4] : [1, 2, 3, 4], p = r.f - 3;
  cell.forEach((f, j) => notes.push(fnote(r.s, p, f, t + j * step, f === 4 ? 4 * step : step * 0.9, null, f === 4 ? [mod12(r.k)] : null)));
  t += 8 * step;
  const box = pentBox(r.k, 1); if (!box) return null;
  const down = box.slice().sort((a, z) => z.s - a.s || a.f - z.f).reverse().slice(0, 8);
  down.forEach((n, j) => notes.push(pnote(n.s, n.f, t + j * step, step * 0.9, pcs)));
  return { notes, back: backOf(c), root: r.k };
}
const fillBasic = c => fillLick(c, 'basic');
const fillPerm = c => fillLick(c, 'perm');

// Advanced
const skipSpider = c => {
  const p = posOf(c), step = stepAt(c, [[7, 0.25]]), pairs = [[6, 4], [5, 3], [4, 2], [3, 1]], notes = []; let t = 0;
  for (const [a, b] of pairs) { notes.push(...run(spiderCell(a, b, 0), p, { step, t0: t }), ...run(spiderCell(a, b, 0).slice().reverse(), p, { step, t0: t + 4 * step })); t += 8 * step; }
  return { notes, pos: p };
};
const skipPerm = c => {
  const p = posOf(c), step = 0.25, notes = []; let t = 0;
  for (const [a, b] of [[5, 3], [4, 2], [3, 1]]) for (const pm of [[1, 3, 2, 4], [4, 2, 3, 1]]) { notes.push(...run(pm.map((f, i) => [i % 2 ? b : a, f]), p, { step, t0: t })); t += 4 * step; }
  return { notes, pos: p };
};
/** One 4-finger cell repeated across whole bars at a subdivision with `per` notes per beat. */
function cellBars(c, perm, s, per, bars) {
  const p = posOf(c), step = 1 / per, n = bars * 4 * per, notes = [];
  for (let i = 0; i < n; i++) notes.push(fnote(s, p, perm[i % perm.length], i * step, step * 0.92));
  return { notes, pos: p };
}
const tripCell = c => cellBars(c, [1, 3, 2, 4], 3, 3, 2);
const tripCell2 = c => cellBars(c, [1, 2, 4, 3], 2, 3, 2);
const quintCell = c => cellBars(c, [1, 2, 3, 4], 3, 5, 1);
const fiveCell = c => cellBars(c, [1, 2, 4, 3, 2], 3, 4, 3);
const sevenCell = c => cellBars(c, [1, 2, 4, 2, 3, 1, 4], 2, 4, 3);
const burst = c => {
  const p = posOf(c), step = 0.25, notes = []; let t = 0;
  for (const s of [6, 5, 4, 3, 2, 1]) { notes.push(...run([1, 2, 3, 4, 3, 2].map(f => [s, f]), p, { step, t0: t })); t += 2; }
  return { notes, pos: p };
};
const advLick = c => {
  const a = fillLick(c, 'perm'); if (!a) return null;
  const r = rootSpot(c), p = r.f - 3, step = 0.25, off = 16; let t = 0; const extra = [];
  for (const pm of [[1, 3, 2, 4], [4, 2, 3, 1], [1, 4, 2, 3]]) { extra.push(...run(pm.map(f => [r.s, f]), p, { step, t0: off + t })); t += 4 * step; }
  extra.push(pnote(r.s, r.f, off + t, 2, [mod12(r.k)]));
  return { notes: a.notes.concat(extra), back: a.back, root: r.k };
};

// Mastery
const speedSpider = c => {
  const up = spiderRun(c, 'up', 0, 0.25), dn = spiderRun(c, 'down', 1, 0.25); if (!up || !dn) return null;
  dn.notes.forEach(n => { n.t = +(n.t + 5).toFixed(4); }); return { notes: up.notes.concat(dn.notes), pos: up.pos };
};
const speedPerm = c => {
  const p = posOf(c), step = 0.25, notes = []; let t = 0;
  for (const s of SIX) for (const pm of [[1, 3, 2, 4], [2, 4, 1, 3]]) { notes.push(...run(pm.map(f => [s, f]), p, { step, t0: t })); t += 4 * step; }
  return { notes, pos: p };
};
const allPositions = c => {
  const step = 0.25, notes = []; let t = 0;
  [1, 3, 5, 7, 9, 11].forEach((p, i) => { const pm = PERMS_A[i % 3]; notes.push(...run(pm.map(f => [3, f]), p, { step, t0: t }), ...run(pm.slice().reverse().map(f => [3, f]), p, { step, t0: t + 4 * step })); t += 8 * step; });
  return { notes };
};
const allKeys = c => {
  const notes = []; let t = 0, roots = [];
  for (const off of [0, 5, 7, 2, 9, 4]) {
    const r = rootSpot({ ...c, key: mod12(c.key + off), minor: true }); if (!r) return null;
    [1, 2, 3, 4].forEach((f, j) => notes.push(fnote(r.s, r.f - 3, f, t + j * 0.5, j === 3 ? 2 : 0.45, null, j === 3 ? [mod12(r.k)] : null)));
    t += 4; roots.push(r.k);
  }
  return { notes, root: roots[0] };
};
const capStudy = c => {
  const parts = [spiderRun(c, 'up', 0, 0.25), permOneFast(c), skipPerm(c), fiveCell(c)];
  if (parts.some(x => !x)) return null;
  const sp = parts[0].notes, pe = parts[1].notes, sk = parts[2].notes, fv = parts[3].notes.filter(n => n.t < 8);
  sp.forEach(n => { n.t = +(n.t + 0).toFixed(4); }); pe.forEach(n => { n.t = +(n.t + 8).toFixed(4); });
  sk.forEach(n => { n.t = +(n.t + 16).toFixed(4); }); fv.forEach(n => { n.t = +(n.t + 24).toFixed(4); });
  const lk = fillLick(c, 'perm'); if (!lk) return null; lk.notes.forEach(n => { n.t = +(n.t + 32).toFixed(4); });
  return { notes: sp.concat(pe, sk, fv, lk.notes), back: lk.back, root: lk.root };
};
function permOneFast(c) {
  const p = posOf(c), step = 0.25, notes = []; let t = 0;
  for (const pm of PERMS_A.concat(PERMS_B)) { notes.push(...run(pm.map(f => [3, f]), p, { step, t0: t })); t += 4 * step; }
  return { notes, pos: p };
}
const capFree = c => {
  const a = skipSpider(c), b = advLick(c); if (!a || !b) return null;
  a.notes.forEach(n => { n.t = +(n.t + 0).toFixed(4); }); b.notes.forEach(n => { n.t = +(n.t + 16).toFixed(4); });
  return { notes: a.notes.concat(b.notes), back: b.back, root: b.root };
};

/* ------------------------------- The path ------------------------------- */
export default entry({
  id: 'fingerIndependence', kind: 'technique', title: 'Finger independence and the chromatic spider', domain: 'fretting',
  re: /finger (independence|exercises?|dexterity|gym|strength)|spider (walk|exercise|drill)|chromatic (exercise|spider|permutation)s?|1.?2.?3.?4 (exercise|pattern)|finger permutations?/,
  aliases: ['spider exercise', 'chromatic exercise', 'finger permutations', 'finger dexterity', 'finger warm-up', 'one finger per fret', '1234 exercise'],
  summary: 'One finger per fret: 1-2-3-4 on every string, pairs, reverse orders, the spider walk, permutations and groupings, skipped strings and rhythmic displacement, then speed and music.',
  prereqs: [],
  sources: [
    'https://artiumacademy.com/blogs/?p=10342',
    'https://goodguitarist.com/finger-independence-guitar-exercise',
    'https://guitarmessenger.com/?p=1041'
  ],
  pedagogy: {
    date: '2026-10-25',
    summary: 'Taught slowly and accurately with one pick stroke per note: the 1-2-3-4 chromatic pattern on frets 1-4 of each string, shifted up a fret at a time, then pairs of fingers, then reversed and mixed orders, then the spider walk across strings and groupings of 3 to 7 notes, and only then skipped strings, rhythmic displacement and short fast bursts, always with a metronome and relaxed hands, finishing in musical phrases.',
    sequence: [
      { id: 'fret', tier: 'foundations', step: 'The 1-2-3-4 pattern, then shifted up the neck', how: 'Fingers 1-2-3-4 on frets 1 to 4 of each string, one pick stroke per note, alternate picking; once clean, shift the shape up a fret.', skills: ['fi-fret'], source: 0 },
      { id: 'pairs', tier: 'foundations', step: 'Two-finger pairs', how: 'Pairs 1-2, 2-3, 3-4 in first position, then 1-3, 2-4 and 1-4 farther up, placing both fingers down together and lifting only the one not fretting.', skills: ['fi-pairs'], source: 1 },
      { id: 'reverse', tier: 'foundations', step: 'Reversed orders', how: 'The patterns 4-3-2-1, 1-3-2-4 and 4-2-3-1, so the hand does not rely on memorised motion.', skills: ['fi-reverse'], source: 0 },
      { id: 'first', tier: 'foundations', step: 'A first musical use', how: 'Short chromatic cells that approach a target note, ending on it, as the sources close with musical application.', skills: ['fi-first'], source: 2 },
      { id: 'spider', tier: 'intermediate', step: 'The spider walk', how: 'Finger 1 on the low string, 2 on the next, 3 on the low string, 4 on the next; then move across neighbouring strings.', skills: ['fi-spider'], source: 0 },
      { id: 'perm', tier: 'intermediate', step: 'Permutations of the four fingers', how: 'Orders such as 1-3-2-4, 2-4-1-3 and 4-2-3-1, then 1-2-4-3 and 1-4-2-3, on one string and across strings.', skills: ['fi-perm'], source: 2 },
      { id: 'position', tier: 'intermediate', step: 'The same pattern at other positions', how: 'The patterns on frets 1, 5, 9 and 12, and as hammer-ons and pull-offs only.', skills: ['fi-pos'], source: 1 },
      { id: 'group', tier: 'intermediate', step: 'Groupings of three and four', how: 'Three-note groups (1-2-4, 1-4-2 …) and four-note groups (1-2-4-2 …), each mastered before the next.', skills: ['fi-group'], source: 2 },
      { id: 'music', tier: 'intermediate', step: 'Chromatic lines in music', how: 'Combining favourite combinations into musical phrases that land on target notes.', skills: ['fi-music'], source: 2 },
      { id: 'skip', tier: 'advanced', step: 'Skipped strings', how: 'The spider and permutations across non-adjacent strings.', skills: ['fi-skip'], source: 0 },
      { id: 'rhythm', tier: 'advanced', step: 'Rhythmic displacement', how: 'The same four-note cell over triplets and quintuplets, so the accents move against the beat.', skills: ['fi-rhythm'], source: 2 },
      { id: 'longer', tier: 'advanced', step: 'Longer groupings', how: 'Five- and seven-note cells repeated across the bar line.', skills: ['fi-longer'], source: 2 },
      { id: 'adv-music', tier: 'advanced', step: 'Bursts and phrases', how: 'Short fast bursts, then fills that land on the root of the key.', skills: ['fi-burst'], source: 0 },
      { id: 'speed', tier: 'mastery', step: 'Clean at speed', how: 'Spider and permutations in 16ths at tempo, raising the click only while the notes stay even.', skills: ['fi-speed'], source: 0 },
      { id: 'all', tier: 'mastery', step: 'Every position and key', how: 'Permutations at positions 1 to 11, and the root approach in six keys.', skills: ['fi-all'], source: 1 },
      { id: 'capstone', tier: 'mastery', step: 'A chromatic study', how: 'A study joining spider, permutations, skipped strings, groupings and a fill into the pentatonic root.', skills: ['fi-cap'], source: 2 }
    ],
    drills: ['1-2-3-4 on frets 1 to 4 of every string, one pick stroke per note', 'Two-finger pairs: place both fingers down, lift only the one that is not fretting', 'Reverse and mixed orders (4-3-2-1, 1-3-2-4, 4-2-3-1)', 'The spider walk across neighbouring strings', 'Permutations as hammer-ons and pull-offs only', 'Three-, four-, five- and seven-note groupings', 'The same cell over triplets and quintuplets', 'Chromatic fills that land on the root of the key'],
    mistakes: ['Playing faster than the fingers are accurate', 'Pressing harder than necessary or squeezing the thumb', 'Lifting the fingers high above the fretboard', 'Uneven rhythm or volume', 'Practising only one pattern', 'Stretching aggressively or continuing through pain', 'Constant downbeat accents (mix the groupings)'],
    sources: [
      { title: '10 Essential Guitar Finger Exercises to Build Speed and Strength', author: 'Artium Academy', url: 'https://artiumacademy.com/blogs/?p=10342' },
      { title: 'Master Finger Independence & Fretboard Skills with This Simple Guitar Exercise', author: 'Good Guitarist', url: 'https://goodguitarist.com/finger-independence-guitar-exercise' },
      { title: 'Different Groupings & Finger Independence', author: 'Guitar Messenger', url: 'https://guitarmessenger.com/?p=1041' }
    ]
  },
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'One finger per fret',
      '1-2-3-4 on frets 1 to 4 of every string, the pairs and the reverse orders, each with one pick stroke per note and an even sound at 70 BPM in 8ths, and a chromatic approach landing on a root, 8 clean bars.', [
        S('fi-fret', 'One finger per fret', 'fretting', 'Fingers 1-2-3-4 on four neighbouring frets, then up the neck.', [
          L('fi-fret-strings', 'Fingers 1-2-3-4 on every string, frets 1 to 4', 'accurate-reps', { unit: '8th notes', goal: 80, start: 45, why: 'The first finger exercise every source teaches: one finger per fret on each string, one pick stroke per note.', instr: 'Frets 1, 2, 3, 4 with fingers 1, 2, 3, 4 on the low E string, then each string up to the high e; alternate pick and keep the fingers close to the strings. Pass: all six strings with every note even in volume and timing.', watch: 'Lifting the fingers high or gripping the neck.', simplify: 'Play one string at a time, slowly.' }, oneToFour),
          L('fi-fret-shift', 'The 1-2-3-4 shape shifted up a fret at a time', 'chunking', { unit: '8th notes', goal: 80, start: 45, why: 'Once the shape is clean in first position, moving it up one fret at a time keeps the same finger-per-fret fingering all the way up.', instr: 'On the D string, play 1-2-3-4 from fret 1, then from fret 2, then 3 and on up, then back down one fret at a time. Pass: 2 passes with no wrong notes.', watch: 'Wide finger stretches creeping in as you move up.', simplify: 'Do three positions only.' }, shiftUp)
        ], ST('Each fretting finger is responsible for one fret: finger 1 on the first fret of the position, finger 2 on the second, finger 3 on the third and finger 4 on the fourth. Playing them one after another with a pick stroke each makes the chromatic exercise.', 'It trains each finger to move on its own and builds the accuracy that every later technique relies on.', ['Position p means finger 1 is on fret p.', 'The notes are a half step apart, so the exercise is chromatic.', 'Keep fingers close to the strings and relaxed.'])),
        S('fi-pairs', 'Two-finger pairs', 'fretting', 'Pairs of fingers alternating on neighbouring and then wider frets.', [
          L('fi-pairs-near', 'Pairs 1-2, 2-3 and 3-4 in first position', 'chunking', { unit: '8th notes', goal: 80, start: 45, why: 'Putting two fingers down together and lifting only the one that is not fretting teaches each finger to move without the others.', instr: 'Place both fingers of the pair on the D string, then alternate them: 1-2-1-2 with the first finger lifting only when 2 is fretting, then 2-3, then 3-4. Pass: each pair 3 times with even notes.', watch: 'The resting fingers jumping away from the fretboard.', simplify: 'Play each pair slowly with long notes.' }, pairsNear),
          L('fi-pairs-wide', 'Pairs 1-3, 2-4 and 1-4 at the 5th fret', 'chunking', { unit: '8th notes', goal: 80, start: 45, why: 'Wider pairs need a stretch, so they start in mid-neck where the frets are closer together.', instr: 'On the D string with finger 1 on the 5th fret, play 1-3, 2-4 and 1-4, then the reverse pairs. Pass: every pair 3 times with no tension.', watch: 'Squeezing the thumb behind the neck.', simplify: 'Play the 2-3 and 3-4 pairs first.' }, pairsWide)
        ], ST('A pair isolates two fingers. Fretting both and lifting one at a time forces the lifted finger to move while the other stays down.', 'Fingers 3 and 4 are the weakest; pair drills make them work on their own.', ['Adjacent pairs are 1-2, 2-3 and 3-4.', 'Wider pairs are 1-3, 2-4 and 1-4.', 'Start mid-neck for the wide pairs.'])),
        S('fi-reverse', 'Reverse orders', 'fretting', 'The pattern in other orders so the hand does not rely on memory.', [
          L('fi-reverse-one', 'Reverse and mixed orders: 4-3-2-1, 1-3-2-4, 4-2-3-1', 'interleaving', { unit: '8th notes', goal: 80, start: 45, why: 'Changing the order stops the fingers from running on memory.', instr: 'Play the orders on the D and G strings in first position, one pick stroke per note. Pass: each order on both strings with no wrong notes.', watch: 'Going back to 1-2-3-4 by habit.', simplify: 'Play 4-3-2-1 only.' }, reverseOne),
          L('fi-reverse-down', 'Descending strings with 4-3-2-1', 'accurate-reps', { unit: '8th notes', goal: 80, start: 45, why: 'The reverse cell down the strings is the mirror of the first exercise.', instr: 'Play 4-3-2-1 on the high e string, then B, G, D, A, low E. Pass: all strings, even.', watch: 'Rushing the last note of each string.', simplify: 'One string at a time.' }, reverseDown)
        ], ST('Playing the fingers in a different order breaks automatic motion and trains the fingers independently of the usual 1-2-3-4 sequence.', 'Variety keeps the hand from learning a single pattern.', ['4-3-2-1 is the reverse.', '1-3-2-4 and 4-2-3-1 are mixed orders.', 'Slow practice reveals weak fingers.'])),
        S('fi-first', 'A first musical use', 'fretting', 'Chromatic cells that approach a target.', [
          L('fi-first-below', 'Chromatic approach to the root from below', 'transfer', { unit: '8th notes', goal: 80, start: 45, why: 'Three half steps below the root, then the root: a chromatic lead-in is a real phrase used in blues and rock.', instr: 'Fingers 1, 2, 3 on the notes below the root, finger 4 on the root of the key ({root}), then hold the root over a minor chord. Pass: 4 repetitions landing on the root.', watch: 'Finishing early and landing on the wrong fret.', simplify: 'Play the last two notes only.' }, approachBelow),
          L('fi-first-above', 'Chromatic approach to the root from above', 'transfer', { unit: '8th notes', goal: 80, start: 45, why: 'The mirror image: fingers 4, 3, 2, 1 coming down onto the root.', instr: 'Fingers 4, 3, 2 on the notes above the root, finger 1 on the root ({root}), then hold. Pass: 4 repetitions landing on the root.', watch: 'Rushing the descending notes.', simplify: 'Start from the note above.' }, approachAbove)
        ], ST('A chromatic approach leads into a target note by half steps. Played over a chord, it makes the arrival feel strong.', 'This is the first place the exercise becomes music.', ['Approach from below or above.', 'Each note is a half step apart.', 'The root of the key is the target.']))
      ]),
    stage('intermediate', 'The spider, permutations and groupings',
      'The spider walk up and down the strings, three permutation sets, a pattern at four positions on the neck and legato only, and 3- and 4-note groupings, each clean at 100 BPM in 8ths, plus a fill landing on the root.', [
        S('fi-spider', 'The spider walk', 'fretting', 'The 1-2-3-4 cell spread over two strings.', [
          L('fi-spider-up', 'The spider up the strings, fret {pos}', 'accurate-reps', { unit: '8th notes', goal: 100, start: 55, why: 'Fingers 1 and 3 on the lower string and 2 and 4 on the higher one make the fingers cross strings, which is much harder than one string.', instr: 'Finger 1 at fret {pos} on the low E, 2 on the A string, 3 on the low E, 4 on the A; then the same on A and D, D and G, G and B, B and e. Pass: the whole walk without a wrong note.', watch: 'Fingers lifting high above the strings.', simplify: 'Do two string pairs only.' }, spiderUp),
          L('fi-spider-down', 'The spider down the strings, fret {pos}', 'accurate-reps', { unit: '8th notes', goal: 100, start: 55, why: 'Going back reverses the order and the string pairs, so the walk works in both directions.', instr: 'Start with finger 4 on the high string and walk back down 4-3-2-1, pair by pair from B and e to low E and A. Pass: the whole walk even.', watch: 'Rushing the high strings.', simplify: 'Do two pairs.' }, spiderDown),
          L('fi-spider-both', 'The spider both ways without stopping, fret {pos}', 'chunking', { unit: '16th notes', goal: 80, start: 50, why: 'Up and down in one pass builds endurance and keeps the fingers independent.', instr: 'Play the up walk then the down walk in 16ths without stopping. Pass: 2 passes at tempo.', watch: 'Tension.', simplify: 'Use 8ths.' }, spiderBack)
        ], ST('The spider spreads 1-2-3-4 over two strings: fingers 1 and 3 on one string and 2 and 4 on the next. Crossing strings with every note makes the picking hand cross too.', 'It is the best known finger-independence exercise and is on every list of guitar warm-ups.', ['Fingers 1 and 3 on the lower string, 2 and 4 on the higher.', 'Move across neighbouring strings.', 'The notes are chromatic.'])),
        S('fi-perm', 'Permutations of the four fingers', 'fretting', 'The four fingers in every order.', [
          L('fi-perm-a', 'Permutations 1-3-2-4, 2-4-1-3 and 4-2-3-1 at fret {pos}', 'interleaving', { unit: '8th notes', goal: 100, start: 55, why: 'Mixed orders train every finger to be ready anywhere in the cell.', instr: 'Play each order twice on the G string at fret {pos}, one pick stroke per note. Pass: all three, twice, even.', watch: 'Falling back to 1-2-3-4.', simplify: 'Play 1-3-2-4 only.' }, permOne),
          L('fi-perm-b', 'Permutations 1-2-4-3, 1-4-2-3 and 3-1-4-2 at fret {pos}', 'interleaving', { unit: '8th notes', goal: 100, start: 55, why: 'A second set of orders so the fingers do not memorise the first.', instr: 'Play each order twice on the B string at fret {pos}. Pass: all three, twice, even.', watch: 'Tension in the little finger.', simplify: 'Do one order.' }, permTwo),
          L('fi-perm-cross', 'Permutations across two strings at fret {pos}', 'chunking', { unit: '8th notes', goal: 100, start: 55, why: 'Alternating strings with each note combines finger independence with string crossing.', instr: 'Play 1-3-2-4 and 2-4-1-3 alternating between a lower and a higher string on D-G, G-B and B-e. Pass: all three pairs even.', watch: 'Hitting the wrong string.', simplify: 'One pair of strings.' }, permCross)
        ], ST('There are 24 orders of four fingers. A few of them already cover every combination the fingers need.', 'Each new order exposes fingers that rely on habit.', ['1-3-2-4 and 2-4-1-3 are the classic ones.', 'Cross strings once the order is clean.', 'One pick stroke per note.'])),
        S('fi-pos', 'The pattern at other positions', 'fretting', 'The same pattern at different frets and as legato.', [
          L('fi-pos-walk', 'Pattern 1-3-2-4 at frets 1, 5, 9 and 12', 'interleaving', { unit: '8th notes', goal: 100, start: 55, why: 'The frets get closer together higher up, so the same fingering feels different.', instr: 'On the G string play 1-3-2-4 twice at frets 1, 5, 9 and 12. Pass: all four positions even.', watch: 'Stretching at the low frets.', simplify: 'Do frets 5 and 9 only.' }, posWalk),
          L('fi-pos-legato', 'The orders as hammer-ons and pull-offs at fret {pos}', 'chunking', { unit: '8th notes', goal: 100, start: 55, why: 'Only the first note on a string is picked, so the fingers do the work.', instr: 'Pick the first note and play the rest with hammer-ons and pull-offs through the three orders on the G string at fret {pos}. Pass: 2 passes with even notes.', watch: 'Weak, quiet pull-offs.', simplify: 'Pick every note first.' }, posLegato)
        ], ST('The same fingering at different frets feels different because the frets get closer higher up. Hammer-ons and pull-offs make the fingers do the sound.', 'Moving a pattern to other positions makes it a skill, not a shape.', ['Frets get closer up the neck.', 'Legato uses the fingers, not the pick.', 'Hammer from above, pull off sideways.'])),
        S('fi-group', 'Groupings of three and four', 'fretting', 'Short cells repeated.', [
          L('fi-group-3', 'Three-note groups on two strings at fret {pos}', 'chunking', { unit: '8th-note triplets', goal: 90, start: 50, why: 'Three-note groups give a triplet feel and use new combinations of fingers.', instr: 'Play 1-2-4, 1-4-2, 2-1-4, 2-4-1, 4-2-1 and 4-1-2 as triplets on the G string, then on the D string. Pass: all groups even.', watch: 'Rushing the third note.', simplify: 'Do the first two groups.' }, group3),
          L('fi-group-4', 'Four-note groups at fret {pos}', 'chunking', { unit: '8th notes', goal: 100, start: 55, why: 'Four-note cells such as 1-2-4-2 are the next step after the three-note groups.', instr: 'Play 1-2-4-2, 1-4-2-4, 2-1-3-1 and 3-4-1-4 twice each on the D string. Pass: all four, even.', watch: 'Mixing up the cells.', simplify: 'Do two cells.' }, group4)
        ], ST('A grouping is a short cell of notes that repeats. Groups of three and four use the fingers in new combinations and change where the accent falls.', 'Mixed groupings stop you accenting the downbeat every time.', ['3-note groups give a triplet feel.', '4-note groups divide the bar evenly.', 'Master each group before the next.'])),
        S('fi-music', 'Chromatic lines in music', 'fretting', 'Fills that land on the root.', [
          L('fi-music-fill', 'A chromatic fill into the root, then the pentatonic box', 'transfer', { unit: '8th notes', goal: 100, start: 55, why: 'The chromatic approach lands on the root of the key and the minor pentatonic box takes over.', instr: 'Play fingers 1-2-3-4 into the root ({root}), hold it, then play the first minor pentatonic box coming down. Pass: 4 clean repetitions over the minor chord.', watch: 'Stopping after the chromatic notes.', simplify: 'Play the box only.' }, fillBasic),
          L('fi-music-perm', 'A permutation fill into the root, then the pentatonic box', 'transfer', { unit: '8th notes', goal: 100, start: 55, why: 'The same idea with a mixed order for a less predictable lick.', instr: 'Play 2-1-3-4 into the root ({root}), hold, then the pentatonic box coming down. Pass: 4 clean repetitions.', watch: 'Wrong finger order.', simplify: 'Use 1-2-3-4.' }, fillPerm)
        ], ST('A chromatic cell followed by pentatonic notes is the bluesy sound of many rock and blues licks.', 'This is how the exercises become phrases.', ['Land on the root.', 'The pentatonic box takes over.', 'The chord underneath is the minor chord of the key.']))
      ]),
    stage('advanced', 'Skips, rhythm and long cells',
      'The spider and permutations across skipped strings, a four-note cell over triplets and quintuplets, five- and seven-note cells across the bar line, and fast bursts, all at 110 BPM in 16ths or the cell rhythm.', [
        S('fi-skip', 'Skipped strings', 'fretting', 'The cells across non-adjacent strings.', [
          L('fi-skip-spider', 'The spider across a skipped string at fret {pos}', 'chunking', { unit: '16th notes', goal: 80, start: 50, why: 'Skipping a string widens the picking motion and the hand must find strings by feel.', instr: 'Play the spider on strings 6-4, 5-3, 4-2 and 3-1 (the middle string is skipped) up and down. Pass: all four pairs even.', watch: 'Hitting the skipped string.', simplify: 'Use 8th notes.' }, skipSpider),
          L('fi-skip-perm', 'Permutations across a skipped string at fret {pos}', 'interleaving', { unit: '16th notes', goal: 80, start: 50, why: 'Mixed finger orders across skipped strings is the hardest crossing.', instr: 'Play 1-3-2-4 and 4-2-3-1 alternating between strings 5-3, 4-2 and 3-1. Pass: all pairs even.', watch: 'Wrong string.', simplify: 'Use 8ths.' }, skipPerm)
        ], ST('Skipping a string means the pick (and fingers) cross an unused string. It is the same chromatic cell with a wider jump.', 'Wide jumps are common in fast modern lines.', ['Skip one string.', 'Mute the skipped string.', 'The cell is unchanged.'])),
        S('fi-rhythm', 'Rhythmic displacement', 'fretting', 'The four-note cell over triplets and quintuplets.', [
          L('fi-rhythm-trip', 'A four-note cell over triplets at fret {pos}', 'chunking', { unit: '8th-note triplets', goal: 85, start: 55, why: 'Four notes against three per beat makes the accent move through the cell.', instr: 'Play 1-3-2-4 repeating in triplets on the G string for two bars, then 1-2-4-3 on the B string. Pass: both bars without losing the beat.', watch: 'Losing where beat 1 is.', simplify: 'Tap the beat with your foot.' }, tripCell),
          L('fi-rhythm-quint', 'A four-note cell over quintuplets at fret {pos}', 'chunking', { unit: '16th-note quintuplets', goal: 70, start: 45, why: 'Five per beat is harder: the cell and the beat realign only after five cells.', instr: 'Play 1-2-3-4 repeating in quintuplets on the G string for a bar. Pass: one bar even.', watch: 'Rushing.', simplify: 'Count 1-2-3-4-5.' }, quintCell)
        ], ST('When a four-note cell is played in triplets or quintuplets, the cell and the beat disagree and the accent moves. The notes are the same, only the rhythm changes.', 'It trains independence of rhythm and fingers.', ['Triplets: 3 notes per beat.', 'Quintuplets: 5 notes per beat.', 'The cell realigns with the beat after a few bars.'])),
        S('fi-longer', 'Longer groupings', 'fretting', 'Five- and seven-note cells.', [
          L('fi-longer-5', 'A five-note cell across the bar line at fret {pos}', 'chunking', { unit: '16th notes (groups of 5)', goal: 80, start: 50, why: 'Five notes in 16ths means the cell starts on a different beat each time.', instr: 'Play 1-2-4-3-2 repeating in 16ths on the G string for 5 bars. Pass: the five bars even.', watch: 'Dropping a note.', simplify: 'Count in groups of 5.' }, fiveCell),
          L('fi-longer-7', 'A seven-note cell across the bar line at fret {pos}', 'chunking', { unit: '16th notes (groups of 7)', goal: 80, start: 50, why: 'Seven notes in 16ths is the hardest grouping.', instr: 'Play 1-2-4-2-3-1-4 repeating in 16ths on the B string for 7 bars. Pass: even.', watch: 'Losing the cell.', simplify: 'Count in groups of 7.' }, sevenCell)
        ], ST('A cell of 5 or 7 notes in 16ths starts on a different part of the bar each time round.', 'Odd groupings break the habit of accenting the beat.', ['5-note cells realign after 5 bars.', '7-note cells realign after 7.', 'Count the groups aloud.'])),
        S('fi-burst', 'Bursts and phrases', 'fretting', 'Fast bursts and fills.', [
          L('fi-burst-strings', 'A fast burst on each string at fret {pos}', 'chunking', { unit: '16th notes', goal: 85, start: 55, why: 'Short fast bursts with a rest between are a realistic way to use speed.', instr: 'Play 1-2-3-4-3-2 in 16ths on each string, then rest. Pass: all six strings clean.', watch: 'Tension building.', simplify: 'Use 8ths.' }, burst),
          L('fi-burst-lick', 'A fill with permutations into the root', 'transfer', { unit: '16th notes', goal: 85, start: 55, why: 'A longer chromatic lick that lands on the root of the key.', instr: 'Play the fill into the root ({root}), the pentatonic box, then three permutations in 16ths landing on the root again. Pass: 4 clean repeats.', watch: 'Rushing the permutations.', simplify: 'Use 8ths.' }, advLick)
        ], ST('Speed is used in short bursts with space around them. The burst is a cell of six notes and a rest.', 'Bursts are how speed is used in music.', ['Burst then rest.', 'The fill lands on the root.', 'Relaxation matters more than speed.']))
      ]),
    stage('mastery', 'Clean at speed, in every position',
      'The spider and permutations in 16ths at 120 BPM on every string, permutations at six positions, the root approach in six keys, and a chromatic study with no wrong notes.', [
        S('fi-speed', 'Clean at speed', 'fretting', 'Spider and permutations at tempo.', [
          L('fi-speed-spider', 'The spider in 16ths, up and down, fret {pos}', 'accurate-reps', { unit: '16th notes', goal: 85, start: 65, why: 'The whole walk up and down at tempo.', instr: 'Play the spider in 16ths up the strings and back, raising the click only while the notes stay even. Pass: 2 passes at tempo.', watch: 'Tension.', simplify: 'Slow by 10 BPM.' }, speedSpider),
          L('fi-speed-perm', 'Permutations on every string in 16ths, fret {pos}', 'accurate-reps', { unit: '16th notes', goal: 85, start: 65, why: 'Two permutations on each of the six strings at tempo.', instr: 'Play 1-3-2-4 and 2-4-1-3 on each string, low E to high e. Pass: all strings even.', watch: 'Weak ring finger.', simplify: 'Slow by 10 BPM.' }, speedPerm)
        ], ST('Speed in finger exercises is evenness: equal timing and volume for every finger.', 'Even notes at speed are what make fast lines sound clean.', ['Raise tempo only when clean.', 'Relaxed hands.', 'Record yourself.'])),
        S('fi-all', 'Every position and key', 'fretting', 'Permutations through the neck and the approach in six keys.', [
          L('fi-all-pos', 'Permutations at positions 1, 3, 5, 7, 9 and 11', 'interleaving', { unit: '16th notes', goal: 85, start: 65, why: 'The same orders at six positions on the neck.', instr: 'Play a permutation and its reverse at each of the six positions on the G string. Pass: all positions even.', watch: 'Stretching at low frets.', simplify: 'Do three positions.' }, allPositions),
          L('fi-all-keys', 'The root approach in six keys', 'interleaving', { unit: '8th notes', goal: 100, start: 65, why: 'Landing on the root in six different keys makes the approach automatic.', instr: 'Play 1-2-3-4 into the root of each of six keys and hold. Pass: all six clean.', watch: 'Wrong root.', simplify: 'Two keys.' }, allKeys)
        ], ST('A skill that works in every position and key is a skill you own.', 'It proves the fingers know the pattern without the landmarks.', ['Positions 1 to 11.', 'Six keys.', 'Hold the root.'])),
        S('fi-cap', 'A chromatic study', 'fretting', 'A study joining the whole path.', [
          L('fi-cap-study', 'Study: spider, permutations, skips, five-note cell, fill', 'transfer', { unit: 'mixed', goal: 85, start: 60, minutes: 8, why: 'The path in one piece: each bar a different exercise, ending on the root.', instr: 'Play the spider up, the permutations, the skipped-string cells, the five-note cell and the fill into the root, one after another without stopping. Pass: one clean pass at tempo.', watch: 'Stopping between sections.', simplify: 'Loop each section on its own.' }, capStudy),
          L('fi-cap-free', 'Study: skips and a long fill', 'transfer', { unit: 'mixed', goal: 85, start: 60, minutes: 8, why: 'A second study using the skipped-string spider and the long fill.', instr: 'Play the skipped-string spider, then the long fill that lands on the root. Pass: one clean pass at tempo.', watch: 'Rushing.', simplify: 'Loop each half.' }, capFree)
        ], ST('A study is a short piece that uses all the exercises. Moving from one to the next without stopping is the real test.', 'The study shows the fingers are ready for music.', ['One section per bar group.', 'End on the root.', 'No gaps.']))
      ])
  ]
});
