// Shared building blocks for lesson content: note and exercise helpers, scale
// and chord shapes, and the structure helpers (stage, entry, artist) that every
// file in js/data/kb/ and js/data/artists/ uses. See CONTENT.md.
import { mod12, scaleNps, scaleBox, chordTones, parseChord, ROOT_BY_PC, SCALE_BY_ID } from '../core/theory.js';
import { rootFret6, fretOn } from '../core/atoms.js';
export { mod12, scaleNps, scaleBox, chordTones, parseChord, ROOT_BY_PC, SCALE_BY_ID, rootFret6, fretOn };

/* ------------------------------- Helpers ------------------------------- */
export const OPEN = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
export const N = (s, f, t, d, x, extra) => ({ t: +t.toFixed(4), d, s, f, ...(x ? { x } : {}), ...(extra || {}) });
export const nameOf = pc => (ROOT_BY_PC[mod12(pc)] ? ROOT_BY_PC[mod12(pc)].name : 'A');
export const minorKey = c => (c.minor ? mod12(c.key) : mod12(c.key - 3));
export const goalFor = (c, base) => Math.round(base * (0.78 + (c.lvl || 4) * 0.05));
export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
export const beatsOf = notes => Math.max(4, Math.ceil(Math.max(...notes.map(n => n.t + n.d)) / 4 - 1e-6) * 4);
export function make(c, o) {
  const goal = goalFor(c, o.goal), start = Math.max(30, Math.round(o.start != null ? o.start : goal * 0.6));
  const out = { level: Math.max(1, Math.min(10, Math.round((c.lvl || 4) + (o.dl || 0)))), minutes: o.minutes || 5, goalBpm: goal, startBpm: Math.min(start, goal - 4), ...o };
  delete out.goal; delete out.start; delete out.dl;
  if (out.tab && out.tab.notes && !out.tab.beats) out.tab.beats = beatsOf(out.tab.notes);
  out.id = out.id || slug(out.name);
  return out;
}
export const fromSeq = (seq, step, t0 = 0) => seq.map(([s, f, x], i) => N(s, f, t0 + i * step, step, x));
/** Minor pentatonic box (1–5) for a minor key: 12 notes, low string to high, two per string. */
export function pentBox(key, box = 1) {
  const pcs = [0, 3, 5, 7, 10].map(x => mod12(key + x));
  let f = rootFret6(key), k = 1;
  while (k < box) { f++; if (pcs.includes(mod12(40 + f))) k++; }
  let n = scaleNps(key, 'minorPent', f, 2);
  if ((!n || Math.max(...n.map(x => x.f)) > 20) && f >= 12) n = scaleNps(key, 'minorPent', f - 12, 2);
  return n || null;
}
/** Frets per string: {1: [lo, hi], 2: [...], ...}. */
export const byString = notes => { const m = {}; (notes || []).forEach(n => (m[n.s] = m[n.s] || []).push(n.f)); Object.values(m).forEach(a => a.sort((x, y) => x - y)); return m; };
/** Three-notes-per-string pentatonic: the diagonal shape that travels along the neck. */
export function pent3nps(key) {
  const rf = rootFret6(key);
  for (const f of [rf, rf - 12, rf + 12, 0]) { if (f < 0) continue; const n = scaleNps(key, 'minorPent', f, 3); if (n && Math.max(...n.map(x => x.f)) <= 22) return n; }
  return null;
}
/** Hammer-on / pull-off marks for notes that stay on the same string. */
export function legatoMarks(seq) {
  return seq.map(([s, f], i) => {
    const prev = seq[i - 1];
    if (!prev || prev[0] !== s || prev[1] === f) return [s, f, null];
    return [s, f, f > prev[1] ? 'h' : 'p'];
  });
}
export function chordInfo(name) {
  const c = parseChord(name); if (!c) return null;
  return { name: c.name, pc: c.root.pc, pcs: chordTones(c.root, c.type).map(t => t.pc), type: c.type };
}
// Open chord grips (low E … high e) for the fingerstyle and hybrid drills.
export const OPEN_SHAPES = { C: [null, 3, 2, 0, 1, 0], Am: [null, 0, 2, 2, 1, 0], G: [3, 2, 0, 0, 0, 3], Em: [0, 2, 2, 0, 0, 0], D: [null, null, 0, 2, 3, 2] };
export const onString = (name, s) => OPEN_SHAPES[name][6 - s];
/** Bass strings for an alternating thumb: the root string, and the next useful string up. */
export function bassPair(name) {
  const low = 6 - OPEN_SHAPES[name].findIndex(f => f != null);
  return [low, low === 4 ? 3 : 4];
}
export const openVoicings = names => [...new Set(names)].map(n => ({ name: n, frets: OPEN_SHAPES[n].slice() }));
/** Chords of the key as names: minor i–♭VI–♭VII–V, major I–vi–IV–V. */
export function keyChords(c) {
  if (c.minor) { const k = mod12(c.key); return [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k + 7)]; }
  const k = mod12(c.key); return [nameOf(k), nameOf(k + 9) + 'm', nameOf(k + 5), nameOf(k + 7)];
}
/** A closed triad on strings 3-2-1 (no open strings), the closest to fret `near`. */
export function topTriad(name, near = 6) {
  const ch = chordInfo(name); if (!ch) return null;
  let best = null;
  for (let a = 1; a <= 17; a++) for (let b = 1; b <= 17; b++) for (let e = 1; e <= 17; e++) {
    const fs = [a, b, e]; if (Math.max(...fs) - Math.min(...fs) > 3) continue;
    const pcs = [mod12(OPEN[3] + a), mod12(OPEN[2] + b), mod12(OPEN[1] + e)];
    if (!pcs.every(p => ch.pcs.includes(p)) || new Set(pcs).size < 3) continue;
    const score = Math.abs((a + b + e) / 3 - near);
    if (!best || score < best.score) best = { 3: a, 2: b, 1: e, score, name: ch.name };
  }
  return best;
}
/** The next chord tone above fret f on string s, within `range` frets. */
export function nextToneUp(name, s, f, range = 5) {
  const ch = chordInfo(name); if (!ch) return null;
  for (let x = f + 1; x <= Math.min(22, f + range); x++) if (ch.pcs.includes(mod12(OPEN[s] + x))) return x;
  return null;
}
/** One spread triad (root – 5th – 10th) on a string set: 6 (root on string 6), 5 or 4. */
export function spreadVoicing(rootPc, type, set, near = 5) {
  const open = { 6: 40, 5: 45, 4: 50 }[set];
  let best = null;
  for (let f = 0; f <= 15; f++) if (mod12(open + f) === mod12(rootPc) && (best == null || Math.abs(f - near) < Math.abs(best - near))) best = f;
  if (best == null) return null;
  const f = best, third = type === 'min' || type === 'dim' ? -1 : 0, fifth = type === 'dim' ? 1 : 2;
  const top = { 6: [3, f + 1 + third], 5: [2, f + 2 + third], 4: [1, f + 2 + third] }[set];
  const tones = [[set, f], [set - 1, f + fifth], top];
  const frets = [null, null, null, null, null, null];
  tones.forEach(([s, fr]) => { frets[6 - s] = fr; });
  return { tones, frets, fret: f, set };
}
export function spreadBar(v, t0, notes, { arpeggio = 'pinch' } = {}) {
  const [r, five, ten] = v.tones;
  if (arpeggio === 'pinch') {
    [r, five, ten, five].forEach(([s, f], i) => notes.push(N(s, f, t0 + i * 0.5, 0.5)));
    v.tones.forEach(([s, f]) => notes.push(N(s, f, t0 + 2, 2, null, { chord: true })));
  } else {
    [r, five, ten, five].forEach(([s, f], i) => notes.push(N(s, f, t0 + i * 0.5, 0.5)));
  }
}
export const spreadName = (pc, type) => nameOf(pc) + (type === 'min' ? 'm' : type === 'dim' ? '°' : '');

/* ------------------------------ Structure ------------------------------ */
/** A written drill, for things a tab can't show (use sparingly). */
export const W = (id, name, domain, unit, start, goal, why, instr, watch, simplify, minutes = 5) => ({ spec: { id, name, domain, unit, startBpm: start, goalBpm: goal, why, instr, watch, simplify, minutes } });
/** A skill: a few lessons on one idea. ex entries: (c) => exercise, ['atom', opts, ctxPatch] or W(...). */
export const S = (id, title, domain, summary, ex) => ({ id, title, domain, summary, ex });
/**
 * Tag a lesson entry with the learning method it applies (see js/core/methods.js): works for a
 * generator (c) => exercise, an atom ['atom', opts, ctx] or a written drill W(...).
 */
export function M(method, e) {
  if (typeof e === 'function') { const f = c => { const x = e(c); return x ? { ...x, method: x.method || method } : x; }; f.method = method; return f; }
  if (Array.isArray(e)) { const a = e.slice(); a.method = method; return a; }
  if (e && e.spec) return { spec: { ...e.spec, method } };
  return e;
}
/** A unit of an artist's curriculum. */
export const U = (title, summary, skills) => ({ title, summary, skills });

/** The four stages of every learning path, from scratch to mastery. */
export const TIERS = [
  { id: 'foundations', name: 'Foundations', levels: [1, 3], blurb: 'From scratch: the prerequisites and the first, slow version.' },
  { id: 'intermediate', name: 'Intermediate', levels: [4, 6], blurb: 'The technique itself, in time, in several keys and positions.' },
  { id: 'advanced', name: 'Advanced', levels: [7, 8], blurb: 'Faster, longer, harder variations, and using it in real music.' },
  { id: 'mastery', name: 'Mastery', levels: [9, 10], blurb: 'Performance tempo, improvising with it, and making it your own.' }
];
export const TIER_BY_ID = Object.fromEntries(TIERS.map(t => [t.id, t]));
/** The tier a level belongs to. */
export const tierOf = lvl => TIERS.find(t => lvl >= t.levels[0] && lvl <= t.levels[1]) || TIERS[0];

/**
 * One stage of a path. tier: foundations | intermediate | advanced | mastery.
 * levels: [lo, hi] inside the tier's range (defaults to the whole range); lessons are built at these levels.
 * goal: one sentence on what the player can do when the stage is done (the pass criterion for the stage).
 */
export function stage(tier, title, goal, skills, levels = null) {
  const t = TIER_BY_ID[tier]; if (!t) throw new Error('Unknown tier ' + tier);
  return { tier, title, goal, levels: levels || t.levels.slice(), skills };
}
/**
 * A knowledge-base entry: a technique, subject or musical style, taught as a path of stages.
 * kind: technique | subject | style. ctx: default key and backing for its lessons.
 */
export function entry(e) {
  const stages = (e.stages || []).slice().sort((a, b) => TIERS.findIndex(t => t.id === a.tier) - TIERS.findIndex(t => t.id === b.tier));
  const lo = Math.min(...stages.map(s => s.levels[0])), hi = Math.max(...stages.map(s => s.levels[1]));
  return { kind: 'technique', ctx: { key: 9, minor: true, prog: 'minorRock' }, ...e, stages, level: stages.length ? [lo, hi] : [1, 10] };
}
/** An artist: units of lessons on their signature techniques, plus famous songs (title + note links only). */
export const artist = a => ({ ...a });
/** Skills of a knowledge-base entry (all stages, in order), or only those with the given ids. */
export function skillsOf(e, ...ids) {
  const all = e.stages.flatMap(s => s.skills);
  return ids.length ? ids.map(id => all.find(s => s.id === id)).filter(Boolean) : all;
}
