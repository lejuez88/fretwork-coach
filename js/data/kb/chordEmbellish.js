// Chord embellishments: rhythm guitar that sings. Chords held as small partial grips (a bass root, often
// fretted with the thumb over the neck, plus two or three notes on the top strings) and decorated from
// inside the shape with hammer-ons and pull-offs from neighbouring scale tones, sus moves, trills,
// pentatonic double-stop fills and walking bass notes: the R&B and soul rhythm style of Curtis Mayfield
// and Jimi Hendrix, and of the neo-soul and blues players after them. From the thumb-over grip and the
// first hammer-on, to sequencing a bar as root, partial and fill, any chord in any key, and an original
// study.
//
// Concept-first (CONTENT.md): the model is a GRIP (a bass root on the low E or A string, plus a closed
// triad on the strings 3-2-1 or 4-3-2 within reach of it, found from the chord and a hand position) and
// EMBELLISHMENTS defined relative to the grip's chord tones, all staying in the key's scale: the lower or
// upper NEIGHBOUR of a chord tone on its string (one or two frets away), the sus move on the string that
// holds the 3rd, a trill to the upper neighbour, double-stop fills from the chord's own pentatonic (major
// pentatonic over a major chord, minor over a minor one), and bass walks through the scale to the next
// root. The composer `embRun(c, spec)` builds an exercise from progression × grip set × bar pattern (hold,
// hammer, pull, sus, trill, fill, walk, colour, slide, or the full sequence: root, partial, hammer, fill,
// walk) × key plan × level, so every lesson is right in any key.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-17: thumb-over grips that free the
// fingers, then a hammer-on or pull-off from the next scale tone into a chord tone, the little finger
// reaching up from each chord tone (sus4, 6, add9), the minor versions, double-stop fills from the chord's
// pentatonic, slid pairs on adjacent strings, grips with the root on the A string and on other string sets,
// an independent bass line, one or two ornaments per phrase over a progression, and the moves transposed
// around the cycle into every key. Removed: singing the moves, covering the tab, and naming neighbours,
// pentatonics and moves aloud before playing (no source teaches it).
import { OPEN, N, nameOf, make, mod12, S, stage, entry, chordInfo, targetGuide, minorKey } from '../lib.js';
import { rng } from './bending.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
/** Progressions as [degree above the key root, quality]; major-key ones and natural-minor ones. */
export const PROGS = {
  soul: { minor: false, chords: [[0, ''], [4, 'm'], [5, ''], [0, '']], label: 'I – iii – IV – I' },
  pop: { minor: false, chords: [[0, ''], [9, 'm'], [5, ''], [7, '']], label: 'I – vi – IV – V' },
  ballad: { minor: false, chords: [[0, ''], [7, ''], [9, 'm'], [5, '']], label: 'I – V – vi – IV' },
  twoChord: { minor: false, chords: [[0, ''], [5, ''], [0, ''], [5, '']], label: 'I – IV' },
  pair: { minor: false, chords: [[0, ''], [5, '']], label: 'I – IV' },
  cycle: { minor: false, chords: [[9, 'm'], [2, 'm'], [7, ''], [0, '']], label: 'vi – ii – V – I (around the cycle of fifths)' },
  long: { minor: false, chords: [[0, ''], [4, 'm'], [9, 'm'], [5, ''], [0, ''], [2, 'm'], [5, ''], [7, '']], label: 'I – iii – vi – IV – I – ii – IV – V' },
  minor: { minor: true, chords: [[0, 'm'], [3, ''], [5, 'm'], [0, 'm']], label: 'i – ♭III – iv – i' },
  minorLong: { minor: true, chords: [[0, 'm'], [8, ''], [3, ''], [10, ''], [0, 'm'], [5, 'm'], [7, 'm'], [0, 'm']], label: 'i – ♭VI – ♭III – ♭VII – i – iv – v – i' }
};
/** The key root of a progression: the major key (or relative major) for major ones, the minor key for minor ones. */
const keyRoot = (c, minor) => (minor ? minorKey(c) : c.minor ? mod12(c.key + 3) : mod12(c.key));
/** Which note may sound where (for the pitch check): note → allowed pitch classes. */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
/** A closed triad of the chord on three adjacent strings (top = highest string) with frets in [lo, hi]. */
function triadOn(pcs, top, lo, hi) {
  const ss = [top + 2, top + 1, top], out = [];
  for (let a = Math.max(1, lo); a <= hi; a++) for (let b = Math.max(1, lo); b <= hi; b++) for (let e = Math.max(1, lo); e <= hi; e++) {
    const fs = [a, b, e]; if (Math.max(...fs) - Math.min(...fs) > 3) continue;
    const ps = ss.map((s, i) => mod12(pitch(s, fs[i]))); if (!ps.every(p => pcs.includes(p)) || new Set(ps).size < 3) continue;
    out.push(ss.map((s, i) => [s, fs[i]]));
  }
  return out;
}
/**
 * A grip for chord `name`: { name, pcs, bass: [s, f], thumb, top: [[s, f] × 3] low → high, frets } with the
 * bass root on the low E (thumb over the neck) or the A string and a triad on `set` ('321', '432', or '321a':
 * 3-2-1 with the root on the A string) within
 * reach of it, nearest fret `near`.
 */
export function gripFor(name, near = 5, set = '321') {
  const ch = chordInfo(name); if (!ch) return null;
  const top = set === '432' ? 2 : 1; let best = null;
  for (const bs of set === '321' ? [6, 5] : set === '321a' ? [5] : [6]) for (let b = 1; b <= 13; b++) {
    if (mod12(pitch(bs, b)) !== ch.pc) continue;
    for (const tri of triadOn(ch.pcs, top, b - 1, b + 3)) {
      const score = Math.abs(b - near) + (bs === 5 ? 0.5 : 0) + Math.abs(tri[2][1] - b) * 0.1;
      if (!best || score < best.score) best = { score, bass: [bs, b], top: tri };
    }
  }
  if (!best) return null;
  const frets = [null, null, null, null, null, null]; frets[6 - best.bass[0]] = best.bass[1]; best.top.forEach(([s, f]) => { frets[6 - s] = f; });
  return { name: ch.name, pcs: ch.pcs, minor: ch.type === 'min', bass: best.bass, thumb: best.bass[0] === 6, top: best.top, frets };
}
/** The nearest key-scale tone on string s one or two frets below (dir −1) or above (dir +1) fret f. */
function neighbour(s, f, dir, keyPcs) { for (const k of [1, 2]) { const x = f + dir * k; if (x >= 0 && x <= 20 && keyPcs.includes(mod12(pitch(s, x)))) return x; } return null; }
/** A descending double-stop fill on two adjacent strings from the chord's pentatonic, near the grip. */
function dsFill(g, n = 4) {
  const pent = (g.minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]).map(d => mod12(g.pcs[0] + d));
  const top = g.top[2], lo = Math.max(1, Math.min(...g.top.map(x => x[1])) - 4), hi = Math.max(...g.top.map(x => x[1])) + 2;
  const pairs = [];
  for (const [a, b] of [[2, 1], [3, 2]]) for (let fa = lo; fa <= hi; fa++) for (let fb = fa - 1; fb <= fa + 2; fb++) {
    if (fb < 1 || fb > hi + 1) continue;
    const iv = pitch(b, fb) - pitch(a, fa);
    if (pent.includes(mod12(pitch(a, fa))) && pent.includes(mod12(pitch(b, fb))) && iv >= 3 && iv <= 5) pairs.push([[a, fa], [b, fb]]);
  }
  // a descending line: start at or below the grip's top note, each pair lower than the last, the hand moving little
  const hiP = p => pitch(p[1][0], p[1][1]);
  const sorted = pairs.filter(p => hiP(p) <= pitch(top[0], top[1]) + 2).sort((x, y) => hiP(y) - hiP(x));
  const out = []; for (const p of sorted) if (!out.length || hiP(p) < hiP(out[out.length - 1])) out.push(p);
  return out.length >= Math.min(n, 3) ? { pairs: out.slice(0, n), pent } : null;
}
/** Bass notes walking from this root toward the next one through the key's scale (two 8ths before the change). */
function walk(g, next, keyPcs) {
  const [s, f] = g.bass, target = next ? mod12(next.pcs[0]) : mod12(g.pcs[0]); const out = [];
  const up = next ? mod12(target - mod12(pitch(s, f))) <= 6 : true;
  for (let x = f + (up ? 1 : -1), k = 0; x >= 0 && x <= 15 && Math.abs(x - f) <= 5 && out.length < 2; x += up ? 1 : -1, k++) {
    const pc = mod12(pitch(s, x)); if (pc === target) break; if (keyPcs.includes(pc)) out.push([s, x]);
  }
  if (out.length < 2) { const nb = neighbour(s, f, up ? 1 : -1, keyPcs); if (nb != null) return [[s, f], [s, nb]]; return [[s, f], [s, f]]; }
  return out;
}

/* ------------------------------- The composer ------------------------------- */
/** Bar patterns: how a bar of one grip is sequenced. */
export const PATTERNS = {
  hold: 'the grip on beat 1 and beat 3',
  ham: 'a hammer-on into the top note, then a melody across the top of the shape',
  pull: 'a pull-off from the note above the top note, then the shape',
  sus: 'the sus move: the 3rd’s upper neighbour pulled off to the 3rd, then its lower neighbour hammered back up',
  trill: 'a trill between the top note and its upper neighbour',
  fill: 'the grip, then a double-stop fill from the chord’s pentatonic',
  walk: 'the grip, then two walking bass notes into the next chord',
  full: 'root, partial, hammer-on, fill, walk: the whole sequence in one bar',
  color: 'the grip, then each top note reaches up to the next scale tone and falls back (sus4, 6 and add9 colours)',
  slide: 'the grip, then two of its top notes slid as a pair from the scale tones just below (or above) and back'
};
/**
 * A pair of the grip's top notes (adjacent strings) and an offset (±1–2 frets) so that both starting notes are in
 * the key: the pair slides into the grip from the scale tones below (preferred) or above.
 */
function slidePair(g, keyPcs) {
  const [l, m, h] = g.top;
  for (const dir of [-1, 1]) for (const [a, b] of [[m, h], [l, m]]) for (const k of [2, 1]) {
    const off = dir * k;
    if (a[1] + off < 1 || b[1] + off < 1 || a[1] + off > 20 || b[1] + off > 20) continue;
    if (keyPcs.includes(mod12(pitch(a[0], a[1] + off))) && keyPcs.includes(mod12(pitch(b[0], b[1] + off)))) return { a, b, off };
  }
  return null;
}
/** Render one bar of grip g with pattern p from beat T; returns false when the pattern doesn't fit. */
export function renderBar(notes, g, p, T, keyPcs, next, { fast = false } = {}) {
  const chordPcs = g.pcs, ct = (s, f, t, d, x, extra) => notes.push(tag(N(s, f, t, d, x, extra), chordPcs));
  const sc = (s, f, t, d, x, extra) => notes.push(tag(N(s, f, t, d, x, extra), keyPcs));
  const [bs, bf] = g.bass, [l, m, h] = g.top, C = { chord: true };
  const bass = (t, d) => ct(bs, bf, t, d, null, C);
  const grip = (t, d, which = [l, m, h]) => { bass(t, d); which.forEach(([s, f]) => ct(s, f, t, d, null, C)); };
  switch (p) {
    case 'hold': grip(T, 2); grip(T + 2, 2); return true;
    case 'ham': {
      const nb = neighbour(h[0], h[1], -1, keyPcs); if (nb == null) return false;
      bass(T, 2); ct(l[0], l[1], T, 2, null, C); ct(m[0], m[1], T, 2, null, C); sc(h[0], nb, T, 0.5, null, C); ct(h[0], h[1], T + 0.5, 1.5, 'h');
      ct(m[0], m[1], T + 2, 0.5); ct(h[0], h[1], T + 2.5, 0.5); ct(m[0], m[1], T + 3, 0.5); ct(l[0], l[1], T + 3.5, 0.5); return true;
    }
    case 'pull': {
      const nb = neighbour(h[0], h[1], 1, keyPcs); if (nb == null) return false;
      grip(T, 1); sc(h[0], nb, T + 1, 0.5); ct(h[0], h[1], T + 1.5, 0.5, 'p'); ct(m[0], m[1], T + 2, 0.5); ct(l[0], l[1], T + 2.5, 0.5); grip(T + 3, 1); return true;
    }
    case 'sus': {
      const third = [l, m, h].find(([s, f]) => mod12(pitch(s, f)) === chordPcs[1]); if (!third) return false;
      const up = neighbour(third[0], third[1], 1, keyPcs), dn = neighbour(third[0], third[1], -1, keyPcs); if (up == null || dn == null) return false;
      const others = [l, m, h].filter(x => x !== third);
      bass(T, 2); others.forEach(([s, f]) => ct(s, f, T, 2, null, C)); sc(third[0], up, T, 1, null, C); ct(third[0], third[1], T + 1, 1, 'p');
      grip(T + 2, 1); sc(third[0], dn, T + 3, 0.5); ct(third[0], third[1], T + 3.5, 0.5, 'h'); return true;
    }
    case 'trill': {
      const nb = neighbour(h[0], h[1], 1, keyPcs); if (nb == null) return false;
      const st = fast ? 0.25 : 0.5; grip(T, 1);
      for (let t = T + 1, i = 0; t < T + 3 - 1e-6; t += st, i++) (i % 2 ? (s, f, tt, d, x) => ct(s, f, tt, d, x) : (s, f, tt, d, x) => sc(s, f, tt, d, x))(h[0], i % 2 ? h[1] : nb, t, st, i ? (i % 2 ? 'p' : 'h') : null);
      ct(h[0], h[1], T + 3, 1, '~'); return true;
    }
    case 'fill': {
      const ds = dsFill(g); if (!ds) return false;
      grip(T, 2); ds.pairs.forEach(([[a, fa], [b, fb]], i) => { const t = T + 2 + i * 0.5, d = i === ds.pairs.length - 1 ? 4 - (2 + i * 0.5) : 0.5; notes.push(tag(N(a, fa, t, d, null, C), ds.pent), tag(N(b, fb, t, d, null, C), ds.pent)); }); return true;
    }
    case 'walk': {
      const w = walk(g, next, keyPcs); grip(T, 3); w.forEach(([s, f], i) => sc(s, f, T + 3 + i * 0.5, 0.5)); return true;
    }
    case 'color': {
      const ups = [l, m, h].map(([s, f]) => neighbour(s, f, 1, keyPcs)); if (ups.some(u => u == null)) return false;
      bass(T, 4); [l, m, h].forEach(([s, f]) => ct(s, f, T, 1, null, C));
      [l, m, h].forEach(([s, f], i) => { sc(s, ups[i], T + 1 + i, 0.5); ct(s, f, T + 1.5 + i, 0.5, 'p'); }); return true;
    }
    case 'slide': {
      const sp = slidePair(g, keyPcs); if (!sp) return false;
      const { a, b, off } = sp, into = off < 0 ? '/' : '\\', away = off < 0 ? '\\' : '/';
      const pr = (t, d, o, x, tagPcs) => { notes.push(tag(N(a[0], a[1] + o, t, d, x, C), tagPcs), tag(N(b[0], b[1] + o, t, d, x, C), tagPcs)); };
      grip(T, 1); pr(T + 1, 0.5, off, null, keyPcs); pr(T + 1.5, 1, 0, into, chordPcs); pr(T + 2.5, 0.5, off, away, keyPcs); pr(T + 3, 1, 0, into, chordPcs); return true;
    }
    case 'full': {
      const nb = neighbour(h[0], h[1], -1, keyPcs), ds = dsFill(g, 2); if (nb == null || !ds) return false;
      bass(T, 1); ct(m[0], m[1], T + 1, 0.5, null, C); ct(h[0], h[1], T + 1, 0.5, null, C);
      sc(h[0], nb, T + 1.5, 0.5); ct(h[0], h[1], T + 2, 0.5, 'h');
      ds.pairs.forEach(([[a, fa], [b, fb]], i) => { const t = T + 2.5 + i * 0.5; notes.push(tag(N(a, fa, t, 0.5, null, C), ds.pent), tag(N(b, fb, t, 0.5, null, C), ds.pent)); });
      const w = walk(g, next, keyPcs); sc(w[0][0], w[0][1], T + 3.5, 0.5); return true;
    }
    default: return false;
  }
}
/**
 * One embellishment exercise from a spec: { id, name ('{key}', '{prog}', '{chords}', '{pattern}'), method,
 * prog (a PROGS id), patterns (a pattern id, or a list cycling per bar), set ('321' | '432'), keys
 * (offsets, one block each), near, fast, domain, unit, goal, start, dl, why, instr, watch, simplify }.
 */
export function embRun(c, spec) {
  const P = PROGS[spec.prog || 'pop'], k0 = keyRoot(c, P.minor), notes = [], names = [], voicings = new Map();
  const pats = Array.isArray(spec.patterns) ? spec.patterns : [spec.patterns || 'hold'];
  let bar = 0, near = spec.near || 5;
  for (const off of spec.keys || [0]) {
    const k = mod12(k0 + off), keyPcs = (P.minor ? MINOR : MAJOR).map(d => mod12(k + d));
    const grips = P.chords.map(([d, q]) => nameOf(k + d) + q).map(nm => { const g = gripFor(nm, near, spec.set || '321'); if (g) near = g.bass[1]; return g; });
    if (grips.some(g => !g)) return null;
    for (const [i, g] of grips.entries()) {
      const p = pats[bar % pats.length];
      if (!renderBar(notes, g, p, bar * 4, keyPcs, grips[i + 1] || grips[0], { fast: spec.fast || (c.lvl || 5) >= 9 })) {
        if (!renderBar(notes, g, 'hold', bar * 4, keyPcs, grips[i + 1] || grips[0])) return null;
        FALLBACK.n++; FALLBACK[p] = (FALLBACK[p] || 0) + 1;
      }
      names.push(g.name); voicings.set(g.name + g.frets, { name: g.name, frets: g.frets }); bar++;
    }
    near = spec.near || 5;
  }
  if (notes.length > 400) return null;
  const fill = s => s.replace(/\{key\}/g, `${nameOf(k0)}${P.minor ? ' minor' : ''}`).replace('{prog}', P.label).replace('{chords}', [...new Set(names)].join(' – ')).replace('{pattern}', pats.map(p => PATTERNS[p]).join('; '));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretting', method: spec.method, unit: spec.unit || (spec.fast ? '16th notes' : '8th notes'),
    goal: spec.goal || 84, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify,
    voicings: [...voicings.values()].slice(0, 8), chords: [...new Set(names)].slice(0, 8), backing: names, tab: { notes }
  });
}
/** How often a bar fell back to the plain grip because its pattern didn't fit (for the content check). */
export const FALLBACK = { n: 0 };
const E_ = (id, name, method, opts) => c => embRun(c, { id, name, method, ...opts });

/* ------------------------------- Special lessons ------------------------------- */
/** The thumb-over grip in pieces: bass alone, top triad alone, then together (chunking). */
export function embThumb(c) {
  const k = keyRoot(c, false), keyPcs = MAJOR.map(d => mod12(k + d)), notes = [], names = [], vs = [];
  let t = 0;
  for (const nm of [nameOf(k), nameOf(k + 5), nameOf(k + 9) + 'm', nameOf(k)]) {
    const g = gripFor(nm, 3); if (!g) return null;
    const ct = (s, f, tt, d, x) => notes.push(tag(N(s, f, tt, d, null, x), g.pcs));
    ct(g.bass[0], g.bass[1], t, 1); g.top.forEach(([s, f], i) => ct(s, f, t + 1 + i / 3, 1 / 3));
    ct(g.bass[0], g.bass[1], t + 2, 2, { chord: true }); g.top.forEach(([s, f]) => ct(s, f, t + 2, 2, { chord: true }));
    t += 4; names.push(g.name); vs.push({ name: g.name, frets: g.frets });
  }
  if (!keyPcs.length) return null;
  return make(c, {
    id: 'emb-thumb', name: `The thumb-over grip in pieces: ${names.join(' – ')}`, domain: 'fretting', method: 'chunking', unit: 'quarter notes', goal: 66, start: 42, minutes: 4,
    voicings: vs, chords: [...new Set(names)], backing: names, tab: { notes },
    why: 'Hooking the thumb over the neck to fret the bass root (instead of a full barre) frees the fingers to play a small triad on the top strings, and later to decorate it. The grip has two parts: learn each, then join them.',
    instr: 'Beat 1: the bass root alone, fretted with the thumb on the low E (or a finger on the A string if the root is there). Beat 2: the three top notes one by one. Beats 3–4: everything together. The A string (and any string not in the grip) is muted by the thumb’s tip and the fingers. Pass: all four chords with the bass and the three top notes ringing and nothing else.',
    watch: 'Squeezing the neck with the thumb: it only needs to press the low E, with the hand relaxed.', simplify: 'Leave out the bass; play only the top triads.'
  });
}
/** A random chord of the key, grip set and pattern every bar (interleaving). */
export function embRandom(c) {
  const r = rng(523 + (c.lvl || 9)), k = keyRoot(c, false), keyPcs = MAJOR.map(d => mod12(k + d)), notes = [], names = [], chords = [], vs = new Map();
  const deg = [[0, ''], [2, 'm'], [4, 'm'], [5, ''], [7, ''], [9, 'm']], pats = ['ham', 'pull', 'sus', 'fill', 'trill'];
  let near = 5;
  for (let bar = 0; bar < 8; bar++) {
    const [d, q] = deg[Math.floor(r() * deg.length)], p = pats[Math.floor(r() * pats.length)], set = r() < 0.5 ? '321' : '432';
    const g = gripFor(nameOf(k + d) + q, near, set) || gripFor(nameOf(k + d) + q, near, '321'); if (!g) return null;
    if (!renderBar(notes, g, p, bar * 4, keyPcs, g)) { if (!renderBar(notes, g, 'hold', bar * 4, keyPcs, g)) return null; names.push(`${g.name}: hold`); } else names.push(`${g.name}: ${p === 'ham' ? 'hammer-on' : p === 'pull' ? 'pull-off' : p === 'ds' ? 'fill' : p}`);
    chords.push(g.name); vs.set(g.name + g.frets, { name: g.name, frets: g.frets }); near = g.bass[1];
  }
  return make(c, {
    id: 'emb-random', name: `Random access: a new chord of ${nameOf(k)} major and a new embellishment every bar`, domain: 'fretboard', method: 'interleaving', unit: 'mixed 8ths and 16ths', goal: 90, start: 54, minutes: 5, dl: 1,
    voicings: [...vs.values()].slice(0, 8), chords: [...new Set(chords)].slice(0, 8), backing: chords, tab: { notes },
    why: 'At mastery level the embellishment is a choice made on the spot: any chord of the key, any decoration, with no time to plan. An unpredictable order is the practice that makes it automatic.',
    instr: `${names.join(' → ')}. Read only the names: find the grip near your hand and play the embellishment. Pass: all 8 bars in time from the names alone.`,
    watch: 'Playing every bar with your favourite move.', simplify: 'The first four bars.'
  });
}
/** An original 8-bar study (capstone): the thumb grip, every embellishment, a fill and a walk into the last chord. */
export function embEtude(c) {
  const k = keyRoot(c, false), keyPcs = MAJOR.map(d => mod12(k + d)), notes = [], names = [], vs = new Map();
  const plan = [[0, '', 'full'], [4, 'm', 'ham'], [9, 'm', 'sus'], [5, '', 'fill'], [0, '', 'trill'], [2, 'm', 'pull'], [5, '', 'walk'], [7, '', 'full']];
  let near = 3; const grips = [];
  for (const [d, q] of plan) { const g = gripFor(nameOf(k + d) + q, near); if (!g) return null; grips.push(g); near = g.bass[1]; }
  for (const [bar, g] of grips.entries()) {
    if (!renderBar(notes, g, plan[bar][2], bar * 4, keyPcs, grips[bar + 1] || grips[0])) { if (!renderBar(notes, g, 'hold', bar * 4, keyPcs, g)) return null; }
    names.push(g.name); vs.set(g.name + g.frets, { name: g.name, frets: g.frets });
  }
  return make(c, {
    id: 'emb-capstone-etude', name: `Capstone study: an 8-bar soul ballad intro in ${nameOf(k)} (${[...new Set(names)].join(' – ')})`, domain: 'improv', method: 'transfer', unit: 'mixed 8ths and 16ths', goal: 84, start: 50, minutes: 8, dl: 1,
    voicings: [...vs.values()].slice(0, 8), chords: [...new Set(names)].slice(0, 8), backing: names, tab: { notes },
    why: 'An original piece that uses the whole path: a bar sequenced as root, partial, hammer-on, fill and walk, then a hammer-on, a sus move, a double-stop fill, a trill, a pull-off and a walking bass into the last chord: rhythm and melody as one part.',
    instr: 'Learn it two bars at a time, then the whole piece. Then write your own 8 bars over the same chords, choosing a different embellishment for each. Pass: the study at the goal tempo with every hammer-on as loud as the picked notes, then your own version once.',
    watch: 'The bass note dying under the fills: keep the thumb down.', simplify: 'Bars 1–4.'
  });
}

/* --------------------------------- The path --------------------------------- */
const HOLD = 'Hook the thumb over the neck for a low-E root (or use a finger on the A string), keep the top-string fingers arched so every note rings, and let the thumb and the fingers’ undersides mute the strings you don’t play. ';
export default entry({
  id: 'chordEmbellish', kind: 'technique', title: 'Chord embellishments', domain: 'fretting',
  re: /chord embellish|embellish(ed|ing)? chords?|hendrix rhythm|curtis mayfield|r&b rhythm guitar|thumb.over (grips?|chords?)|little wing style/,
  aliases: ['Hendrix-style rhythm guitar', 'R&B chord fills', 'thumb-over grips'],
  summary: 'Rhythm guitar that sings: partial grips with the thumb over the neck, decorated from inside the shape with hammer-ons, pull-offs, sus4, 6 and add9 colours, trills, slid and double-stop fills and walking bass notes, from the first hammer-on to whole progressions in any key and an original study.',
  prereqs: ['pentatonic'],
  sources: ['https://www.premierguitar.com/articles/30887-hendrix-rhythms-made-easy', 'https://guitarworld.com/lessons/how-play-jimi-hendrix-style-rhythm-guitar', 'https://www.guitarplayer.com/lessons/80-ways-to-play-a-c-chord-jimi-hendrix-style', 'https://happybluesman.com/jimi-hendrix-rhythm-guitar-3-steps-mix-rhythm-and-lead/', 'https://www.premierguitar.com/lessons/rhythm/jimi-hendrix-rhythm-guitar', 'https://www.guitarplayer.com/lessons/jimi-hendrix-the-five-rules-of-his-powerful-rhythm-style'],
  ctx: { key: 7, minor: false, prog: 'axis' },
  pedagogy: {
    date: '2026-10-17',
    summary: 'Hendrix- and Curtis Mayfield-style rhythm is taught by first turning barre chords into thumb-over (or small triad) grips that free the fingers, then decorating a chord tone from the next scale tone (hammer-ons and pull-offs, the little finger adding sus4, 6 and add9), doing the same over minor chords, adding double-stop and slid two-string fills from the chord’s pentatonic, moving to grips with the root on the A string and to other string sets, and finally choosing one or two ornaments per phrase over progressions, moved around the cycle into every key and applied to songs.',
    sequence: [
      { id: 'thumb', tier: 'foundations', step: 'Barre chords become thumb-over grips', how: 'Compare the barre shape with the thumb fretting the low-E root; the thumb frees the fourth finger. Play the bass note, then the triad, across a progression, touching lightly and relaxing the hand.', skills: ['emb-grips'], source: 0 },
      { id: 'hammer', tier: 'foundations', step: 'Hammer-ons and pull-offs into a chord tone', how: 'Over the held grip, reach from a chord tone to the next scale degree and back with hammer-ons and pull-offs, keeping the other notes ringing.', skills: ['emb-first-moves'], source: 0 },
      { id: 'colours', tier: 'foundations', step: 'The little finger adds sus4, 6 and add9', how: 'With the triad fretted, the little finger adds the next scale tone above each chord tone (4 on the 3rd, 6 on the 5th, 9 on the root); move between them and hear what each does.', skills: ['emb-colors'], source: 3 },
      { id: 'first-prog', tier: 'foundations', step: 'One or two ornaments per phrase over a simple progression', how: 'Over a I – IV – V (or any simple progression) replace the barre chords with grips and add an embellishment where it feels right; a first double-stop lick from the chord.', skills: ['emb-first-music'], source: 3 },
      { id: 'sus-trill', tier: 'intermediate', step: 'Moves inside the shape: the 2 hammered to the 3, repeated hammer-pulls', how: 'Fret the 2 and hammer to the 3 with the ring finger; pinkie hammer-ons and pull-offs on each string of the shape, repeated as a shimmer.', skills: ['emb-moves'], source: 1 },
      { id: 'fills', tier: 'intermediate', step: 'Double-stop fills from the pentatonic and an independent bass line', how: 'Use the chord’s major or minor pentatonic for two-note licks; play a hammer-on/pull-off figure over an independent bass-note line.', skills: ['emb-fills'], source: 0 },
      { id: 'slides', tier: 'intermediate', step: 'Slides on two adjacent strings', how: 'Slide pairs of notes up and down the neck on neighbouring strings of the shape, and slide between shapes instead of jumping.', skills: ['emb-slides'], source: 1 },
      { id: 'phrase', tier: 'intermediate', step: 'Chain the moves into bars and phrases', how: 'Play the chord or partial first, then a motif; chain one-bar phrases from the moves, then mix and match them.', skills: ['emb-sequence'], source: 2 },
      { id: 'other-grips', tier: 'intermediate', step: 'Grips with the root on the A string and on other string sets', how: 'Apply the same fills to 5th-string-root shapes and to the lower strings of the chord.', skills: ['emb-grips2'], source: 1 },
      { id: 'minor', tier: 'intermediate', step: 'The minor version and songs', how: 'Apply the same ideas to minor shapes with notes that suit minor chords, then combine the concepts over a progression and in songs.', skills: ['emb-music'], source: 0 },
      { id: 'long', tier: 'advanced', step: 'Whole progressions and faster ornaments', how: 'Slow four-bar progressions with the moves chained; vary rhythm and phrasing.', skills: ['emb-flow', 'emb-minor-adv'], source: 2 },
      { id: 'keys', tier: 'advanced', step: 'Every key: shift position and move around the cycle of fifths', how: 'Transpose the moves by shifting position, and mix the A-shaped and E-shaped moves over a cycle-of-fifths progression.', skills: ['emb-keys'], source: 2 },
      { id: 'lead', tier: 'advanced', step: 'Blur rhythm and lead', how: 'Let the fills grow into single-note lines and back over the same chords.', skills: ['emb-adv-music'], source: 3 },
      { id: 'perform', tier: 'mastery', step: 'At performance tempo, any chord', how: 'Play the style at tempo with any chord of the key and any move chosen on the spot.', skills: ['emb-performance'], source: 2 },
      { id: 'own', tier: 'mastery', step: 'Your own parts in your own songs', how: 'Apply the ideas to songs in your own repertoire, every key, and write your own embellished part.', skills: ['emb-recall-m', 'emb-voice'], source: 0 }
    ],
    drills: ['Barre shape, then the same chord with the thumb on the root', 'Bass note, then the triad, across a progression', 'Hammer-on from the scale tone below into the top note; pull-off from the one above', 'Little finger adding the sus4, 6 and add9 to a held triad', 'Two-note pentatonic fills between strums', 'Pairs slid up and down on adjacent strings', 'One-bar phrases chained, then mixed and matched', 'The moves over a cycle-of-fifths progression in every key'],
    mistakes: ['Forcing the grip and squeezing with the thumb instead of touching lightly and relaxing', 'Keeping full barre fingerings that block the fourth finger', 'Too many embellishments in one phrase', 'Hitting unwanted strings so the triad doesn’t ring cleanly', 'Jumping between shapes instead of sliding into them', 'Pressing the palm against the back of the neck'],
    sources: [
      { title: 'Hendrix Rhythms Made Easy', author: 'Jon MacLennan (Premier Guitar)', url: 'https://www.premierguitar.com/articles/30887-hendrix-rhythms-made-easy' },
      { title: 'How to Play Jimi Hendrix-Style Rhythm Guitar', author: 'Joel Hoekstra (Guitar World)', url: 'https://guitarworld.com/lessons/how-play-jimi-hendrix-style-rhythm-guitar' },
      { title: '80 Ways to Play a C Chord – Jimi Hendrix Style', author: 'Jesse Gress (Guitar Player)', url: 'https://www.guitarplayer.com/lessons/80-ways-to-play-a-c-chord-jimi-hendrix-style' },
      { title: 'Jimi Hendrix Rhythm Guitar: 3 Steps to Blur the Lines Between Rhythm and Lead', author: 'Happy Bluesman', url: 'https://happybluesman.com/jimi-hendrix-rhythm-guitar-3-steps-mix-rhythm-and-lead/' }
    ]
  },
  stages: [
    stage('foundations', 'The grip and the first decorations',
      'Play the thumb-over grip in pieces and then whole, change between the four grips of I – vi – IV – V 8 times clean, hammer into and pull off from the top note of a grip with the hammered note as loud as the picked ones, add the sus4, 6 and add9 with the little finger, and play a first embellished progression at 70 BPM.', [
        S('emb-grips', 'The thumb-over grip', 'fretting', 'Bass root and a small triad.', [
          c => embThumb(c),
          E_('emb-grip-reps', 'Grip changes: {chords}, 8 clean in a row', 'accurate-reps', { prog: 'pop', patterns: 'hold', unit: 'half notes', goal: 70, start: 44, why: 'The grips have to appear whole, on the beat, before anything can be added to them. Counting only the changes where the bass and all three top notes ring builds the clean version.', instr: HOLD + 'Two strums per chord ({prog}). Count a change as clean only if every note of the new grip sounds on the beat. Pass: 8 clean changes in a row.', watch: 'Moving the top fingers first and the thumb late: the bass arrives after the beat.', simplify: 'Two chords only, four beats each.' })], {
          concept: 'A thumb-over grip replaces a full barre chord with the bass root fretted by the thumb on the low E (or a finger on the A string) and a small triad on the top three strings.',
          why: 'A barre locks every finger in place; the grip leaves fingers free to decorate the chord, which is the whole point of this style.',
          theory: ['The triad on the top strings holds the root, 3rd and 5th in some order; the bass doubles the root.', 'Only four strings sound: the others are muted by the thumb’s tip and the fingers’ undersides.', 'A slim neck makes the thumb reach easier; the thumb only needs to touch the low E, not squeeze.']
        }),
        S('emb-first-moves', 'Hammer and pull', 'fretting', 'From the note below; from the note above.', [
          E_('emb-ham-first', 'Hammer into the top note: {chords}', 'external-focus', { prog: 'twoChord', patterns: 'ham', goal: 72, start: 44, why: 'Striking the grip with its top note one scale step low and hammering up to it is the basic embellishment: the chord seems to sing its top note. It only works if the hammered note is as loud as the picked ones.', instr: HOLD + 'Strike the grip with the top string fretted one scale step below its chord tone, then hammer the finger onto the chord tone; then a short melody across the top of the shape. Listen to the hammered note: it should be as loud and long as the others. Pass: four bars with every hammer-on clearly heard.', watch: 'A weak hammer from far above the string: hammer from close, fast and firm.', simplify: 'The hammer-on alone, no melody after it.' }),
          E_('emb-ham-pull', 'Hammer, then pull: {chords}', 'variable', { prog: 'twoChord', patterns: ['ham', 'pull'], goal: 72, start: 44, why: 'A pull-off from the scale tone above is the hammer-on’s mirror. Alternating the two (bar by bar) makes the hand choose the move rather than repeat one.', instr: HOLD + 'Bars 1 and 3: hammer into the top note. Bars 2 and 4: pull off to it from the scale tone above (flick the finger slightly downward as it leaves the string). Pass: four bars with both moves sounding even.', watch: 'Pull-offs that only lift the finger: they barely sound.', simplify: 'Only the I chord, alternating the two moves.' })], {
          concept: 'The basic embellishment reaches from a chord tone to the next scale tone and back: a hammer-on from the note below or a pull-off from the note above, while the rest of the grip rings.',
          why: 'It makes a chord sing its top note, so one guitar part carries harmony and melody at once.',
          theory: ['The decorating note is the key’s scale tone one or two frets away from the chord tone.', 'A hammer-on sounds the second note by striking the string with the fretting finger; a pull-off by flicking the finger off it.']
        }),
        S('emb-colors', 'Sus4, 6 and add9', 'fretting', 'The little finger reaches up from each chord tone.', [
          E_('emb-colors', 'The little finger’s colours on each string: {chords}', 'chunking', { prog: 'twoChord', patterns: 'color', goal: 68, start: 42, why: 'On a held triad the little finger can add the next scale tone above any chord tone: the 4 above the 3rd (a sus4), the 6 above the 5th, the 9 above the root (an add9). Each string gives a different colour, and each one falls back into the chord.', instr: HOLD + 'Strike the grip, then on beats 2, 3 and 4 reach up on one top string at a time (the G, then the B, then the high e string), one or two frets, and pull off back to the chord tone. Listen to how each colour sounds against the chord. Pass: four bars with every added note clear and the grip still ringing under it.', watch: 'Lifting the whole hand to reach: only the little finger moves.', simplify: 'One string per bar.' }),
          E_('emb-colors-prog', 'Colours over a soul progression: {prog} ({chords})', 'variable', { prog: 'soul', patterns: ['color', 'hold'], goal: 70, start: 44, why: 'On every chord of a progression the same reach gives the chord’s own sus4, 6 and add9: on a minor chord the 4 above the ♭3 and the ♭6 or 6 the key allows above the 5th. Alternating a coloured bar with a plain one keeps the harmony clear.', instr: HOLD + 'Bars 1 and 3: the three colours, one string at a time. Bars 2 and 4: the plain grip. Pass: four times round in time, every added note in the key.', watch: 'The same fret shape on every chord: the reach is one fret on some strings and two on others.', simplify: 'Only the B string’s colour.' })], {
          concept: 'With the triad held, the little finger adds the next scale tone above a chord tone on one string: a sus4 (4 above the 3rd), a 6 (above the 5th) or an add9 (above the root).',
          why: 'These are the colours behind many Hendrix and Mayfield ballad parts; they decorate the chord without leaving it.',
          theory: ['Major chord: 3 → 4 gives sus4, 5 → 6 gives the 6th, R → 2 gives add9.', 'Minor chord in a major key: ♭3 → 4, 5 → the next scale tone (♭6 on the iii and vi chords, 6 on the ii), R → 2.', 'The reach is one fret where the scale has a half step and two where it has a whole step.']
        }),
        S('emb-first-music', 'First music', 'rhythm', 'An embellished progression.', [
          E_('emb-first-prog', 'First embellished progression: {prog} ({chords})', 'transfer', { prog: 'soul', patterns: ['hold', 'ham', 'hold', 'pull'], goal: 72, start: 46, why: 'A soul progression with one decoration every other bar: the plain grips give the harmony, the decorations give the melody. Leaving bars plain is part of the style.', instr: HOLD + 'Play with the backing: plain grips in bars 1 and 3, a hammer-on in bar 2, a pull-off in bar 4. Then swap which bars are plain. Pass: four times round in time, then once with your own choice of bars.', watch: 'Rushing the plain bars to get to the decorations.', simplify: 'Decorate only bar 2.' }),
          E_('emb-first-fill', 'First double-stop fill: {chords}', 'transfer', { prog: 'twoChord', patterns: ['hold', 'fill'], goal: 70, start: 44, why: 'Between two strums of a chord, two notes at a time from the chord’s own pentatonic make a fill: rhythm guitar answering itself, the sound of Curtis Mayfield and Hendrix ballads.', instr: HOLD + 'Bars 1 and 3: the grip. Bars 2 and 4: the grip on beat 1, then four double-stops from the chord’s pentatonic walking down the top strings. Pass: four bars in time with both notes of every double-stop ringing.', watch: 'One note of the double-stop dropping out: barre or roll the fingertip.', simplify: 'Two double-stops instead of four.' })], {
          concept: 'An embellished progression keeps most bars plain and decorates one or two: the grips state the harmony, the decorations add a melody between them.',
          why: 'Too many ornaments blur the chords; one or two per phrase is how the style is played.',
          theory: ['A double-stop fill takes two notes at a time from the chord’s pentatonic: major over a major chord, minor over a minor one.', 'Plain bars give a singer room; decorated bars answer.']
        })
      ], [1, 3]),
    stage('intermediate', 'Every move, sequenced',
      'Play the sus move, trills, double-stop fills, slid pairs and walking bass notes on every chord of a progression at 84 BPM, sequence a bar as root, partial, hammer-on, fill and walk, use grips with the root on the A string and on the strings 4-3-2, change embellishment every bar, and play embellished progressions in major and minor keys.', [
        S('emb-moves', 'Sus and trill', 'fretting', 'Two more decorations.', [
          E_('emb-sus', 'The sus move on every chord: {chords}', 'variable', { prog: 'pop', patterns: 'sus', goal: 82, start: 50, why: 'On a major chord the 3rd’s upper neighbour is the 4 (a sus4 that resolves) and its lower neighbour the 2; on a minor chord the 4 above the ♭3 and the 2 below it. Doing the same move on chords of different quality makes the hand find it everywhere.', instr: HOLD + 'Strike each grip with the 3rd replaced by its upper neighbour, pull off to the 3rd on beat 2, strum the grip on beat 3, then hammer into the 3rd from the 2 below. Pass: four chords with every resolution in time.', watch: 'Moving the other fingers while you do the sus move: only the 3rd’s finger moves.', simplify: 'Only the pull-off half.' }),
          E_('emb-trill', 'Trills on the top note: {chords}', 'accurate-reps', { prog: 'soul', patterns: 'trill', goal: 82, start: 50, why: 'A trill (fast hammer-ons and pull-offs to the upper neighbour) over a held grip is a Hendrix ballad sound: the chord shimmers. It needs a relaxed, even finger.', instr: HOLD + 'Grip on beat 1, then trill between the top note and the scale tone above it in 8ths for two beats, landing on the chord tone with vibrato on beat 4. Count only the trills where every note is even. Pass: 8 clean trills.', watch: 'The trill speeding up and the last notes disappearing.', simplify: 'Four notes of trill instead of eight.' })], {
          concept: 'The sus move decorates the 3rd from both sides (the 4 pulled off to it, the 2 hammered to it); a trill repeats the hammer-on and pull-off to the top note’s upper neighbour.',
          why: 'Both work from inside the shape, so the chord never stops sounding while the melody moves.',
          theory: ['The 3rd is the note that makes a chord major or minor, so decorating it is the strongest colour change.', 'A trill is even only when the hammer and the pull are the same volume.']
        }),
        S('emb-fills', 'Fills', 'fretting', 'Double-stops; walking bass.', [
          E_('emb-ds', 'Double-stop fills from each chord’s pentatonic: {chords}', 'variable', { prog: 'pop', patterns: 'fill', goal: 84, start: 50, why: 'Each chord has its own pentatonic: major over a major chord, minor over a minor one. Fills built from it always fit, and each chord’s fill sits in a different place under the hand.', instr: HOLD + 'Grip on beat 1, then four double-stops walking down the top strings from the chord’s pentatonic. Pass: four bars in time, every double-stop ringing.', watch: 'Using the same fill (the I chord’s) over every chord.', simplify: 'Two double-stops.' }),
          E_('emb-walk', 'Walking bass into each change: {chords}', 'chunking', { prog: 'pop', patterns: 'walk', unit: '8th notes', goal: 82, start: 48, why: 'Two bass notes from the scale leading into the next chord’s root make the progression move like a bass line under the grip: the independent bass part of the style. Learn the walk alone, then attach it.', instr: HOLD + 'Hold the grip three beats, then two 8th-note bass notes on the bass string, walking toward the next root. First play only the walks (no chords) four times, then the whole. Pass: four changes where the walk lands on the new root on beat 1.', watch: 'The walk landing late and the next grip arriving early.', simplify: 'One walking note.' })], {
          concept: 'A fill answers the chord with two notes at a time from its pentatonic; a walking bass connects one root to the next through the scale.',
          why: 'Fills give the part a melody between strums; the bass walk gives it a bass line, so one guitar sounds like a small band.',
          theory: ['Major pentatonic over a major chord: R 2 3 5 6. Minor pentatonic over a minor chord: R ♭3 4 5 ♭7.', 'Pairs a 3rd or 4th apart on adjacent strings sit under the grip’s top notes.', 'A walk uses scale tones between the two roots, landing on the new root on beat 1.']
        }),
        S('emb-slides', 'Slid pairs', 'fretting', 'Two strings slid together.', [
          E_('emb-slide-pairs', 'Slide two notes of the grip up and back: {chords}', 'accurate-reps', { prog: 'twoChord', patterns: 'slide', goal: 80, start: 48, why: 'Two neighbouring notes of the shape slid together from the scale tones just below or above and back again is one of the most-used Hendrix moves: the chord seems to glide. Both fingers must travel the same distance and keep their pressure.', instr: HOLD + 'Strike the grip, then pick the two notes one or two frets below (or above, where the key puts its scale tones) and slide them into the grip, back out, and in again. Count only the slides where both notes keep sounding. Pass: 8 clean slides in a row.', watch: 'Pressing hard during the slide: the notes squeak and go sharp. Keep light, steady pressure.', simplify: 'Only the slide into the grip, then let it ring.' }),
          E_('emb-slide-prog', 'Slides and hammer-ons over {prog} ({chords})', 'variable', { prog: 'pop', patterns: ['slide', 'ham', 'slide', 'fill'], goal: 82, start: 50, why: 'Slid pairs mixed with hammer-ons and a fill on a progression: the slide has to find a new pair, and sometimes a new distance, on every chord.', instr: HOLD + 'Bar 1: slid pair. Bar 2: hammer-on. Bar 3: slid pair. Bar 4: double-stop fill. Pass: four times round with the backing.', watch: 'Sliding the same distance on every chord: some pairs slide one fret, some two.', simplify: 'Slides only on the I chord.' })], {
          concept: 'Two adjacent notes of the grip are slid as a pair from the scale tones one or two frets below (or above), with one hand shape moving along the neck.',
          why: 'Slides connect notes vocally and move between shapes smoothly instead of jumping.',
          theory: ['Both notes must stay in the key, so the slide distance depends on where the scale has half and whole steps.', 'The arriving notes are chord tones; the starting notes are scale tones that lead into them.']
        }),
        S('emb-sequence', 'Sequencing a bar', 'rhythm', 'Root, partial, fill; a new move every bar.', [
          E_('emb-full', 'Root, partial, hammer, fill, walk: {chords}', 'external-focus', { prog: 'twoChord', patterns: 'full', goal: 80, start: 48, why: 'Hendrix sequenced a bar in layers: the root on the downbeat, a chord partial, then a decoration and a fill, leaving room for a voice. Heard as three layers (bass, chord, melody), the bar becomes an arrangement.', instr: HOLD + 'Beat 1: the bass root alone. Beat 2: the top two notes. Then the hammer-on, two double-stops and one walking bass note. Listen for three different layers: low, middle and high, each clearly separate. Pass: four bars with the layers clean and in time.', watch: 'Everything at one volume: let the bass be firm and the fills lighter.', simplify: 'Root, partial and hammer-on only.' }),
          E_('emb-mixed', 'A new embellishment every bar: {chords}', 'interleaving', { prog: 'long', patterns: ['ham', 'sus', 'fill', 'pull', 'trill', 'walk', 'slide', 'full'], goal: 82, start: 50, why: 'Real parts change decoration from chord to chord. Chaining one-bar phrases with a different move each (hammer, sus, fill, pull, trill, walk, slide, full) mixes the skills the way playing does.', instr: HOLD + 'Eight chords, eight different embellishments, in order. Pass: the 8 bars without stopping.', watch: 'Defaulting to the hammer-on.', simplify: 'The first four bars.' })], {
          concept: 'A bar is built in layers: the bass root on the downbeat, a partial of the chord, then a decoration and a fill; phrases chain such bars with a different move each.',
          why: 'Chaining and mixing the moves is how they become a part rather than a list of tricks.',
          theory: ['Low (bass), middle (partial) and high (melody) are three separate voices.', 'One or two ornaments per phrase keeps the harmony clear.']
        }),
        S('emb-grips2', 'Other grips', 'fretboard', 'Root on the A string; strings 4-3-2.', [
          E_('emb-root5', 'Grips with the root on the A string: {chords} with the hammer-on and the sus move', 'variable', { prog: 'pop', patterns: ['ham', 'sus'], set: '321a', goal: 82, start: 50, why: 'With the root on the A string (fretted by a finger, the low E muted) the same chords sit in a new place, a fourth away from the thumb grips, with new neighbours to decorate.', instr: 'Fret the root on the A string with the first or second finger, let its tip mute the low E, and keep the triad on the top three strings. Bars 1 and 3: hammer into the top note. Bars 2 and 4: the sus move. Pass: four bars clean, the low E silent.', watch: 'The low E ringing under the A-string root.', simplify: 'Hammer-ons only.' }),
          E_('emb-432', 'Grips on the strings 4-3-2 with the hammer-on: {chords}', 'variable', { prog: 'pop', patterns: 'ham', set: '432', goal: 82, start: 50, why: 'The same chords as grips one string lower (bass root plus a triad on 4-3-2) give a darker sound and a new top string to decorate: the B string.', instr: HOLD + 'Bass root on the low E, triad on the D, G and B strings, the high e muted by the underside of the fingers. Hammer into the B-string note. Pass: four bars clean.', watch: 'The high e ringing.', simplify: 'Two chords.' })], {
          concept: 'The same embellishments work on grips with the root on the A string and on triads one string set lower (strings 4-3-2).',
          why: 'More grips mean every chord of a song can be reached near the hand, with different notes on top.',
          theory: ['An A-string root grip sits five frets below (or seven above) the low-E grip of the same chord.', 'On strings 4-3-2 the B string carries the melody note.']
        }),
        S('emb-music', 'In music', 'rhythm', 'A ballad; a minor-key progression.', [
          E_('emb-ballad', 'Ballad accompaniment, sequenced: {prog} ({key})', 'transfer', { prog: 'ballad', patterns: ['full', 'ham', 'fill', 'walk'], goal: 80, start: 48, minutes: 6, why: 'A ballad accompaniment that never strums the same bar twice: sequenced, decorated, filled and walked. This is how a rhythm part supports a singer and still has its own melody.', instr: HOLD + 'Play with the backing, leaving space where a singer would breathe. Then play it again and change two decorations. Pass: four times round in time, then your own version.', watch: 'Filling every gap: some bars are better plain.', simplify: 'Bars 1 and 3 only decorated.' }),
          E_('emb-minor', 'Minor key: {prog} with hammer-ons, sus moves and fills ({key})', 'transfer', { prog: 'minor', patterns: ['ham', 'sus', 'fill', 'pull'], goal: 80, start: 48, why: 'In a minor key the same moves take minor colours: the 2 hammered into the ♭3, the 4 pulled off to it, minor-pentatonic fills over the minor chords: the darker sound of the style.', instr: HOLD + 'i – ♭III – iv – i, a different embellishment each bar. Pass: four times round with the backing.', watch: 'Major-key notes (a major 3rd or 6th) creeping into the decorations.', simplify: 'Hammer-ons only.' })], {
          concept: 'The moves applied to whole accompaniments: a ballad in a major key and a progression in a minor key, where the decorations use the natural minor scale.',
          why: 'The style exists to accompany songs; playing it over a progression with space for a voice is the real use.',
          theory: ['In a minor key the chords i, iv and v take minor-pentatonic fills; ♭III, ♭VI and ♭VII take major ones.', 'The neighbours come from the natural minor scale: 2 and 4 around the ♭3.']
        })
      ], [4, 6]),
    stage('advanced', 'Long progressions, any key',
      'Sequence every bar of an 8-chord progression at 90 BPM, play 16th-note trills and fills, change key every four bars and play the moves around the cycle of fifths, mix all the embellishments in a minor key, and play an 8-bar embellished intro and a solo that grows out of it.', [
        S('emb-flow', 'Flow and speed', 'fretting', 'Whole progressions; 16ths.', [
          E_('emb-full-long', 'Every bar sequenced: {prog} ({key})', 'variable', { prog: 'long', patterns: ['full', 'full', 'ham', 'full', 'sus', 'full', 'fill', 'walk'], goal: 90, start: 54, why: 'Eight chords, mostly sequenced as root, partial, hammer, fill and walk: the whole layer system over a longer form, with the grips and fills changing every bar.', instr: HOLD + 'Play the 8 bars with the backing. Keep the bass on each downbeat as the anchor. Pass: the whole progression in time, twice.', watch: 'Losing the bass when the fills get busy.', simplify: 'The first four bars.' }),
          E_('emb-16ths', '16th-note trills and fills at tempo: {chords}', 'edge', { prog: 'soul', patterns: ['trill', 'fill', 'trill', 'full'], fast: true, unit: '16th notes', goal: 90, start: 54, why: 'At ballad tempos Hendrix’s trills and fills often move in 16ths. Pushing the tempo while the hammer-ons stay even is the edge of the technique.', instr: HOLD + 'Trills in 16ths, fills in 8ths. Tempo ladder: +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'The trill hand tensing and the grip choking.', simplify: '8th-note trills.' })], {
          concept: 'Long progressions with every bar sequenced, and the trills and fills moving in 16ths at ballad tempos.',
          why: 'Songs are longer than four bars; keeping the layers steady over eight changes is the step to playing whole songs.',
          theory: ['The bass on each downbeat is the anchor that keeps the form clear.', 'Faster ornaments need the same evenness as slow ones: speed comes from the tempo ladder, not from tension.']
        }),
        S('emb-keys', 'Any key', 'fretboard', 'Four keys; around the cycle of fifths.', [
          E_('emb-keys', 'Four keys, a fourth apart: {prog} sequenced ({key} and up)', 'interleaving', { prog: 'twoChord', patterns: ['full', 'ham', 'sus', 'fill'], keys: [0, 5, 10, 3], goal: 88, start: 52, why: 'Changing key every four bars means finding new grips, new neighbours and new fills each time: the most transferable practice, because songs come in every key.', instr: HOLD + 'I – IV in four keys around the cycle of fourths, a different embellishment each bar. Pass: all 16 bars without stopping.', watch: 'Neighbour notes from the old key carried into the new one.', simplify: 'Two keys.' }),
          E_('emb-cycle', 'Around the cycle of fifths: {prog} with low-E and A-string grips ({key} and a fourth up)', 'variable', { prog: 'cycle', patterns: ['ham', 'fill', 'sus', 'slide'], keys: [0, 5], goal: 88, start: 52, why: 'A progression that moves by fifths (vi – ii – V – I) is where the two grip families meet: each next chord sits under the hand as a low-E (E-shape) or an A-string (A-shape) grip, so the hand barely moves.', instr: HOLD + 'Take each grip from whichever string keeps it nearest the last one. A different move each bar. Then the same in the key a fourth up. Pass: both keys in time.', watch: 'Jumping up the neck for a low-E grip when an A-string grip is right under the hand.', simplify: 'One key.' })], {
          concept: 'The moves transposed into other keys, by shifting position and by mixing the low-E and A-string grip families over a cycle-of-fifths progression.',
          why: 'Songs come in every key; knowing two grips for each chord keeps the hand in one area of the neck.',
          theory: ['Chords a fourth or fifth apart are a string apart in the two grip families (same fret area).', 'Each new key brings its own scale, so the neighbours change with it.']
        }),
        S('emb-minor-adv', 'The minor sound', 'fretting', 'Long minor progressions; sus and walks.', [
          E_('emb-minor-long', 'Minor-key progression, every embellishment: {prog} ({key})', 'variable', { prog: 'minorLong', patterns: ['ham', 'fill', 'sus', 'walk', 'trill', 'pull', 'fill', 'full'], goal: 88, start: 52, why: 'A long minor progression with every decoration once: the minor chords take minor-pentatonic fills, the major chords major ones, and the sus moves and neighbours stay in the natural minor scale.', instr: HOLD + 'Eight bars, eight embellishments. Pass: twice through in time.', watch: 'The major chords (♭VI, ♭III, ♭VII) getting minor fills.', simplify: 'The first four bars.' }),
          E_('emb-sus-walk', 'Sus moves and walking bass alternating: {chords}', 'accurate-reps', { prog: 'pop', patterns: ['sus', 'walk'], goal: 88, start: 52, why: 'The sus move works the middle of the grip, the walk works the bass: alternating them bar by bar trains the hand to decorate from any part of the shape.', instr: HOLD + 'Bars 1 and 3: the sus move. Bars 2 and 4: hold and walk to the next root. Count clean bars only. Pass: 8 clean bars in a row.', watch: 'The walk losing the top notes of the grip.', simplify: 'Half the tempo.' })], {
          concept: 'Every embellishment over a long minor-key progression, and decorations from the middle and the bottom of the grip alternating.',
          why: 'The minor sound is half the style’s ballads; decorating from any part of the shape makes the part move in every register.',
          theory: ['Natural minor: R 2 ♭3 4 5 ♭6 ♭7; its major chords are ♭III, ♭VI and ♭VII.', 'The walk and the sus move use different fingers, so they can follow each other without moving the hand.']
        }),
        S('emb-adv-music', 'In music', 'improv', 'An intro; a solo from it.', [
          E_('emb-intro', 'An 8-bar embellished intro: {prog} ({key})', 'transfer', { prog: 'long', patterns: ['full', 'ham', 'sus', 'fill', 'trill', 'pull', 'walk', 'full'], goal: 88, start: 52, minutes: 6, why: 'An original intro in the style: the chords are always there, but every bar has its own melody, so the guitar part could stand alone before a band comes in.', instr: HOLD + 'Play it as a piece: dynamics, space, a slower last bar. Then play it once more, changing three embellishments. Pass: the intro in time, then your own version.', watch: 'A mechanical, even volume: shape it.', simplify: 'The first four bars.' }),
          c => targetGuide(c, { prog: 'axis', scale: 'majorPent', name: 'Out of the rhythm part: a solo that starts with chord fills and becomes single notes' })], {
          concept: 'A complete embellished intro, and a solo that grows out of the chord fills into single-note lines over the same changes.',
          why: 'The style blurs rhythm and lead: the fills are already melodies, so a solo can start from them.',
          theory: ['The major pentatonic of the key fits the fills and the solo alike over a major progression.', 'A part shaped with dynamics and space sounds like a piece, not an exercise.']
        })
      ], [7, 8]),
    stage('mastery', 'Your own rhythm voice',
      'Play a fully sequenced progression in two keys at 96 BPM with 16th-note trills, decorate any chord of the key on the spot, play the style in all twelve keys, and perform your own 8-bar embellished piece.', [
        S('emb-performance', 'At performance tempo', 'fretting', 'Fast and any chord.', [
          E_('emb-perf', 'Performance tempo: {prog} sequenced in two keys', 'edge', { prog: 'pop', patterns: ['full', 'trill', 'full', 'fill'], fast: true, keys: [0, 7], goal: 96, start: 58, unit: '16th notes', why: 'The whole style at performance tempo: sequenced bars, 16th-note trills and fills, in two keys, with the bass still steady on every downbeat.', instr: HOLD + 'Tempo ladder from the start tempo, +4 BPM after each clean pass. Pass: both keys clean at the goal tempo.', watch: 'The thumb-over grip tensing at speed.', simplify: 'One key.' }),
          c => embRandom(c)], {
          concept: 'The style at performance tempo, and any chord of the key with any decoration chosen bar by bar.',
          why: 'In a band the chords and the moment decide the decoration; it has to come without planning.',
          theory: ['Six chords of a major key: I, ii, iii, IV, V and vi.', 'Mixing moves in an unpredictable order makes each one quicker to reach.']
        }),
        S('emb-recall-m', 'Every key', 'fretboard', 'All twelve keys; improvising the part.', [
          E_('emb-all-keys', 'I – IV in all twelve keys, sequenced', 'interleaving', { prog: 'pair', patterns: ['full', 'fill', 'ham', 'sus'], keys: [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7], goal: 92, start: 56, why: 'The grips, neighbours and fills of the I and IV chords in every key, around the cycle of fourths: the full map of the style.', instr: HOLD + 'Two bars per key, a different embellishment each bar, moving to the nearest grip of each new key. Pass: all twelve keys in time.', watch: 'A pause at each new key.', simplify: 'Six keys.' }),
          E_('emb-improvise', 'Improvise the part: {prog} with a new embellishment every bar ({key})', 'transfer', { prog: 'ballad', patterns: 'hold', goal: 88, start: 52, minutes: 6, why: 'Mastery is making the part up as you go: the tab gives only the grips; every decoration is your own choice, made in time.', instr: HOLD + 'The tab shows the plain grips. Over the backing, decorate every bar differently (hammer, pull, colour, sus, trill, slide, fill, walk, or the full sequence), never repeating a bar. Pass: four times round in time with no repeated bar.', watch: 'Playing the same three moves in rotation.', simplify: 'Decorate every other bar.' })], {
          concept: 'The I and IV grips and their decorations in all twelve keys, and a part improvised over plain grips.',
          why: 'With every key in the hands, the style works on any song you play.',
          theory: ['Around the cycle of fourths each new key is one flat more (or one sharp fewer).', 'The IV chord of one key is the I chord of the next key in the cycle.']
        }),
        S('emb-voice', 'Your own piece', 'improv', 'A study, then your version.', [
          c => embEtude(c),
          E_('emb-own', 'Make it yours: rewrite {prog} as your own intro ({key})', 'transfer', { prog: 'minorLong', patterns: ['full', 'sus', 'fill', 'walk', 'ham', 'trill', 'pull', 'full'], goal: 88, start: 52, minutes: 6, why: 'Mastery means writing your own part. The tab gives an embellished minor-key progression; the lesson is to keep the chords and replace every decoration with one of your own.', instr: HOLD + 'Learn the written 8 bars, then rewrite every bar’s embellishment and play both versions back to back. Pass: your own version twice, as clean as the written one.', watch: 'A rewrite that changes every time you play it: fix it and repeat it.', simplify: 'Rewrite four bars.' })], {
          concept: 'An original 8-bar study that uses every move, then your own embellished part over a progression.',
          why: 'The sources end in the same place: take the ideas into your own songs and parts.',
          theory: ['Keep the chords, change the decorations: the harmony stays, the melody is yours.', 'A part is finished when it is the same every time you play it.']
        })
      ], [9, 10])
  ]
});
