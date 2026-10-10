// The 7♯9 chord ("the Hendrix chord"): a dominant 7th with a raised 9th, so the major 3rd and the
// minor 3rd (the ♯9) sound in one grip, major and minor at once: the tense, bluesy chord of funk-rock,
// blues and psychedelic rock. From building the grip one string at a time and hearing it against a
// plain dominant 7th, to funk-rock 16th grooves with muted scratches, parallel moves and slides, the
// chord in three grips across the neck, through a blues in any key, with minor-pentatonic riffs and
// fills over it, and an original study (Hendrix, and the funk and blues players around him).
//
// Concept-first (CONTENT.md): the model is a chord QUALITY as degrees above a root (7♯9 = R, 3, ♭7,
// ♯9; the 5th is usually left out) and GRIPS as fret offsets from the root on its string (the A-string
// grip x-0-(-1)-0-1-x, the top-string grip on the D string, the thumb-over grip from the low E, and a
// rootless three-note partial), so every chord is found from the key and is right in any key. The
// composer `s9Run(c, spec)` builds an exercise from progression (vamp, parallel ♭VII move, blues) ×
// grip plan (one grip, a grip per bar, or the nearest grip: voice leading) × rhythm (a 16-slot pattern
// of hits, muted scratches and rests) × approach (a slide from a fret below) × key plan. Riffs and
// fills over the chord are written in minor-pentatonic degrees (bending.js `phrase()`), plus the
// chord's own major 3rd for the hybrid "major-minor" sound, so they too are right in any key.
import { OPEN, N, nameOf, make, mod12, S, stage, entry, targetGuide } from '../lib.js';
import { phrase, rng } from './bending.js';

/* ------------------------------- The concept ------------------------------- */
/** Chord qualities as degrees above the root. */
export const QUALITY = {
  s9: { suffix: '7♯9', degs: [0, 4, 7, 10, 3], label: '7♯9' },
  d7: { suffix: '7', degs: [0, 4, 7, 10], label: 'dominant 7th' }
};
/**
 * Grips: rs = the string the root (or the reference root) sits on, rel = fret offsets low E … high e
 * from that root fret (null = muted). Degrees in the comment, low to high.
 */
export const GRIPS = {
  a: { rs: 5, rel: [null, 0, -1, 0, 1, null], q: 's9', label: 'the A-string grip', tones: 'R 3 ♭7 ♯9' },
  d: { rs: 4, rel: [null, null, 0, -1, 1, 1], q: 's9', label: 'the top-string grip (root on the D string)', tones: 'R 3 ♭7 ♯9' },
  e: { rs: 6, rel: [0, null, 0, 1, null, 3], q: 's9', label: 'the thumb-over grip (root on the low E)', tones: 'R ♭7 3 ♯9' },
  top: { rs: 5, rel: [null, null, -1, 0, 1, null], q: 's9', label: 'the three-note partial (no root)', tones: '3 ♭7 ♯9' },
  dom7: { rs: 5, rel: [null, 0, -1, 0, -2, null], q: 'd7', label: 'the plain dominant 7th', tones: 'R 3 ♭7 R' }
};
const pitch = (s, f) => OPEN[s] + f;
export const chordName = (pc, q = 's9') => nameOf(pc) + QUALITY[q].suffix;
/** A grip of the chord on root pc, the root fret nearest `near` that keeps every fret in 1–17 (open low E allowed). */
export function grip(shape, pc, near = 7) {
  const G = GRIPS[shape]; let best = null;
  for (let r = 0; r <= 17; r++) {
    if (mod12(pitch(G.rs, r) - pc) !== 0) continue;
    const frets = G.rel.map(x => (x == null ? null : r + x)), vals = frets.filter(x => x != null);
    if (Math.min(...vals) < (shape === 'e' ? 0 : 1) || Math.max(...vals) > 17) continue;
    if (!best || Math.abs(r - near) < Math.abs(best.r - near)) best = { r, frets, shape, q: G.q, pc: mod12(pc), name: chordName(pc, G.q) };
  }
  return best;
}
/** The pitch classes a note of this chord may have (for the pitch check). */
export const tonesOf = (pc, q = 's9') => QUALITY[q].degs.map(d => mod12(pc + d));
/** Which note may sound where (for the pitch check): note object → allowed pitch classes. */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };

/** Rhythms: 16 slots a bar. X = the chord, ringing to the next slot; x = a muted scratch; . = rest. */
export const RHY = {
  whole: { slots: 'X...............', unit: 'whole notes', label: 'one hit a bar, ringing' },
  quarters: { slots: 'X...X...X...X...', unit: 'quarter notes', label: 'quarter notes' },
  eighths: { slots: 'X.X.X.X.X.X.X.X.', unit: '8th notes', label: '8th notes' },
  scratch8: { slots: 'X.x.X.x.X.x.X.x.', unit: '8th notes', label: '8ths: chord on the beat, a muted scratch on the "and"' },
  push: { slots: 'X..X..X...X.X...', unit: '8th notes', label: 'a syncopated push (3 + 3 + 4 + 2 + 4 16ths)' },
  stabs: { slots: '....X..X....X...', unit: '8th notes', label: 'stabs: beat 2, the "and" of 2, beat 4' },
  funk: { slots: 'X.xX.xX.x.X.xX.x', unit: '16th notes', label: '16th funk-rock: hits and scratches' },
  funk2: { slots: 'XxxXxxXxXxxXxxXx', unit: '16th notes', label: '16ths with the hand never stopping: accents every three 16ths' },
  stop: { slots: 'X.......X.X.....', unit: '8th notes', label: 'stop time: beat 1, beat 3, its "and", then silence' }
};
/** Rhythm at a level for "by level" specs. */
export const rhyFor = lvl => (lvl <= 1 ? 'quarters' : lvl <= 3 ? 'eighths' : lvl <= 5 ? 'scratch8' : lvl <= 7 ? 'push' : 'funk');
/** Progressions: one chord per bar, as [offset from the key root, grip override?]. */
export const PROGS = {
  vamp: [[0], [0], [0], [0]],
  two: [[0], [0]],
  vampVII: [[0], [0], [10], [0]],
  compare: [[0, 'dom7'], [0], [0, 'dom7'], [0]],
  blues4: [[0], [5], [0], [7]],
  blues12: [[0], [5], [0], [0], [5], [5], [0], [0], [7], [5], [0], [7]],
  rise: [[0], [3], [5], [0]]
};
const PROG_NAME = { vamp: 'a one-chord vamp', two: 'two bars per chord', vampVII: 'I – I – ♭VII – I', compare: 'dominant 7th vs 7♯9', blues4: 'I – IV – I – V', blues12: 'a 12-bar blues', rise: 'I – ♭III – IV – I' };

/* ------------------------------- The composer ------------------------------- */
/** Render one bar of a grip in a rhythm; slide = approach the first hit from one fret below. */
export function renderBar(notes, g, slots, t0, { slide = false, mute = false } = {}) {
  const pcs = tonesOf(g.pc, g.q), events = [...slots].map((ch, i) => [ch, i]).filter(([ch]) => ch !== '.');
  events.forEach(([ch, i], j) => {
    const t = t0 + i / 4, next = j + 1 < events.length ? events[j + 1][1] : 16, d = ch === 'X' ? (next - i) / 4 : 0.25;
    const strings = g.frets.map((f, idx) => (f == null ? null : [6 - idx, f])).filter(Boolean);
    if (slide && j === 0) {
      const below = g.frets.filter(f => f != null).every(f => f >= 1);
      if (below) { const lo = tonesOf(mod12(g.pc - 1), g.q); strings.forEach(([s, f]) => notes.push(tag(N(s, f - 1, t, 0.25, null, { chord: true }), lo))); strings.forEach(([s, f]) => notes.push(tag(N(s, f, t + 0.25, d - 0.25, '/', { chord: true }), pcs))); return; }
    }
    strings.forEach(([s, f]) => notes.push(tag(N(s, f, t, d, ch === 'x' ? 'mute' : (mute ? 'pm' : null), { chord: true }), ch === 'x' ? null : pcs)));
  });
}
/** The grip plan for a bar: a fixed list cycling per bar, or 'near' (the grip of a, d, e closest to the last one). */
function pickGrip(plan, bar, pc, last) {
  if (plan === 'near') {
    const cands = ['a', 'd', 'e'].map(s => grip(s, pc, last ? last.r : 7)).filter(Boolean);
    const pos = g => g.frets.filter(f => f != null).reduce((a, b) => a + b, 0) / g.frets.filter(f => f != null).length;
    const ref = last ? pos(last) : 7;
    return cands.sort((x, y) => Math.abs(pos(x) - ref) - Math.abs(pos(y) - ref))[0];
  }
  const list = Array.isArray(plan) ? plan : [plan || 'a'];
  return grip(list[bar % list.length], pc, last ? last.r : 7);
}
/**
 * One 7♯9 exercise from a spec: { id, name ('{key}', '{rhythm}', '{prog}', '{grips}'), method, prog,
 * grips ('a' | ['a','d'] | 'near'), rhythm (a RHY id, or by level), keys (offsets from the key root, one
 * block each), slide, mute, domain, unit, goal, start, dl, why, instr, watch, simplify }.
 */
export function s9Run(c, spec) {
  const root = mod12(c.key), lvl = c.lvl || 5, rk = spec.rhythm || rhyFor(lvl), R = RHY[rk];
  const notes = [], chords = [], voicings = new Map(), usedGrips = new Set(); let bar = 0, last = null;
  for (const off of spec.keys || [0]) {
    for (const [o, override] of PROGS[spec.prog || 'vamp']) {
      const pc = mod12(root + off + o), g = override ? grip(override, pc, last ? last.r : 7) : pickGrip(spec.grips || 'a', bar, pc, last);
      if (!g) return null;
      renderBar(notes, g, R.slots, bar * 4, { slide: spec.slide && (bar === 0 || chords[chords.length - 1] !== g.name), mute: spec.mute });
      chords.push(g.name); voicings.set(g.name + g.frets.join(','), { name: g.name, frets: g.frets }); usedGrips.add(GRIPS[g.shape].label); last = g; bar++;
    }
  }
  if (notes.length > 400) return null;
  const fill = s => s.replace(/\{key\}/g, nameOf(root)).replace('{rhythm}', R.label).replace('{prog}', PROG_NAME[spec.prog || 'vamp']).replace('{grips}', [...usedGrips].join(', ')).replace('{chords}', [...new Set(chords)].join(' – '));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'rhythm', method: spec.method, unit: spec.unit || R.unit,
    goal: spec.goal || 96, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify,
    voicings: [...voicings.values()].slice(0, 8), chords: [...new Set(chords)].slice(0, 8), backing: chords.map(n => n.replace('7♯9', '7')), tab: { notes }
  });
}
const R_ = (id, name, method, opts) => c => s9Run(c, { id, name, method, ...opts });

/* ------------------------------- Lines over the chord ------------------------------- */
// Degrees above the chord root: the minor pentatonic (R ♭3 4 5 ♭7) fits the 7♯9 because its ♭3 IS the ♯9;
// the chord's major 3rd (4) is added for the hybrid "major-minor" line.
const PENT = [0, 3, 5, 7, 10], HYB = [0, 3, 4, 5, 7, 10];
const LINES = {
  low: [[6, 0, 0.5], [6, 0, 0.25], [6, 3, 0.25], [5, 5, 0.5], [5, 7, 0.5], [6, 3, 0.5], [6, 0, 1], [null, 0, 0.5]],
  answer: [[4, 0, 0.5], [4, 10, 0.5], [5, 7, 0.5], [5, 5, 0.25], [6, 3, 0.25], [6, 0, 1], [null, 0, 1]],
  curl: [[3, 3, 0.5, 'b', 4], [4, 0, 0.5], [4, 10, 0.5], [5, 7, 0.5], [3, 3, 0.25], [3, 4, 0.25, 'h'], [4, 0, 1.5]],
  hybrid: [[2, 7, 0.5], [3, 5, 0.25], [3, 4, 0.25, 'p'], [3, 3, 0.5], [3, 4, 0.5, 'h'], [4, 0, 0.5], [4, 10, 0.5], [4, 0, 1]],
  high: [[1, 0, 0.5], [1, 3, 0.5], [2, 10, 0.5], [2, 7, 0.5], [3, 5, 0.5], [3, 3, 0.25], [3, 4, 0.25, 'h'], [4, 0, 1]]
};
/** A line in degrees over the chord root (box 1 of its minor pentatonic), tagged with the scale it claims. */
function line(root, name, t0, scale = PENT) {
  const ev = LINES[name], notes = phrase(root, 1, ev.map(([s, d, b, x]) => [s, d, b, x === 'b' || x === 'h' || x === 'p' ? null : x]), t0);
  if (!notes) return null;
  // put back the articulations phrase() doesn't take: a quarter-tone curl written as a half-step bend, hammer-ons, pull-offs
  let i = 0; ev.forEach(([s, , , x, to]) => { if (s == null) return; const n = notes[i++]; if (x === 'b') { n.x = 'b'; n.bendTo = n.f + 1; } else if (x === 'h' || x === 'p') n.x = x; });
  const pcs = scale.map(d => mod12(root + d));
  notes.forEach(n => tag(n, pcs));
  return notes;
}
/** A double-stop on the top of the chord: 3 and ♯9 together (the clash), then resolved to ♭7 and R. */
function clashBar(notes, root, t0) {
  const g = grip('a', root, 7); if (!g) return false;
  const pcs = tonesOf(root);
  notes.push(tag(N(4, g.frets[2], t0, 1, null, { chord: true }), pcs), tag(N(2, g.frets[4], t0, 1, null, { chord: true }), pcs));
  notes.push(tag(N(3, g.frets[3], t0 + 1, 1, null, { chord: true }), pcs), tag(N(2, g.frets[4], t0 + 1, 1, null, { chord: true }), pcs));
  notes.push(tag(N(5, g.frets[1], t0 + 2, 2), pcs));
  return true;
}

/** Riff and chord: a bar of hits, then a bar of low pentatonic riff (use in music). */
export function s9RiffChord(c, { level = 1 } = {}) {
  const root = mod12(c.key), notes = [], plan = level === 1 ? ['stabs', 'low', 'stabs', 'answer'] : ['push', 'low', 'funk', 'answer'];
  const g = grip('a', root, 7); if (!g) return null;
  for (const [bar, p] of plan.entries()) {
    if (RHY[p]) renderBar(notes, g, RHY[p].slots, bar * 4);
    else { const l = line(root, p, bar * 4); if (!l) return null; notes.push(...l); }
  }
  const nm = g.name;
  return make(c, {
    id: level === 1 ? 's9-riff-chord' : 's9-riff-chord-funk', name: level === 1 ? `Riff and chord: stabs of ${nm}, answered by a low riff` : `Funk-rock riff and chord: the push, the riff, 16ths, the answer (${nm})`,
    domain: 'rhythm', method: 'transfer', unit: level === 1 ? '8th notes' : '16th notes', goal: level === 1 ? 90 : 96, start: level === 1 ? 54 : 60, minutes: 5,
    voicings: [{ name: nm, frets: g.frets }], chords: [nm], backing: [nm.replace('7♯9', '7')], tab: { notes },
    why: 'Funk-rock guitar is a conversation between the chord and a riff on the low strings, both from the same minor pentatonic: the 7♯9’s ♯9 is the scale’s ♭3, so riff and chord agree.',
    instr: `Bars 1 and 3: the ${nm} grip in the written rhythm. Bars 2 and 4: an original low riff from the root (index finger on the low E), which lets go of the chord completely. Switch between them without a gap. Then make up your own two-beat riff for bars 2 and 4. Pass: four times round in time, chord and riff at the same volume.`,
    watch: 'A gap before the chord comes back: have the grip ready during the last note of the riff.', simplify: 'Quarter-note chords, and only the first half of each riff bar.'
  });
}
/** Lines over the chord, in degrees (hear the ♯9 as the ♭3, add the major 3rd). */
export function s9Lines(c, { kind = 'curl' } = {}) {
  const root = mod12(c.key), notes = [], g = grip('a', root, 7); if (!g) return null;
  const bars = kind === 'curl' ? ['curl', 'quarters', 'low', 'quarters'] : kind === 'hybrid' ? ['hybrid', 'scratch8', 'high', 'scratch8'] : ['clash', 'curl', 'clash', 'hybrid'];
  for (const [bar, p] of bars.entries()) {
    if (p === 'clash') { if (!clashBar(notes, root, bar * 4)) return null; continue; }
    if (RHY[p]) { renderBar(notes, g, RHY[p].slots, bar * 4); continue; }
    const l = line(root, p, bar * 4, p === 'low' ? PENT : HYB); if (!l) return null; notes.push(...l);
  }
  const nm = g.name;
  const T = {
    curl: ['s9-curl', `Minor pentatonic over ${nm}: the ♭3 curled toward the 3rd`, 'external-focus', 'The chord holds both 3rds, so a line over it can too: the minor pentatonic’s ♭3 (the chord’s ♯9) nudged a little sharp, toward the major 3rd, is the bluesy "curl" every blues and funk-rock player uses.', `Bars 1 and 3: the line in box 1 of ${nameOf(root)} minor pentatonic; the first note is the ♭3, bent a little (the tab writes a half step: aim between the two 3rds and listen for the rub against the chord). Bars 2 and 4: the chord in quarter notes. Pass: the line in time with the curl audibly between the two 3rds, then your own one-bar line.`, 'Bending the ♭3 a full half step every time: it becomes a plain major 3rd. Listen for the in-between.', 'Leave out the curl; play the line straight.'],
    hybrid: ['s9-hybrid', `The major-minor line over ${nm}: ♭3 hammered to 3`, 'variable', 'Adding the chord’s major 3rd to the minor pentatonic gives a six-note "hybrid" scale: the ♭3 hammered or pulled into the 3rd is the sound of Hendrix, Clapton and Robben Ford over a dominant chord.', `Bars 1 and 3: lines from the hybrid scale (R ♭3 3 4 5 ♭7), with the ♭3 → 3 move as a hammer-on and as a pull-off from the 4th. Bars 2 and 4: the chord in 8ths with scratches. Then play the same move on another string pair. Pass: every hammer-on lands on the 3rd in time, and your own line uses the move twice.`, 'Stopping on the ♭3 at the end of a phrase over a major chord: it sounds wrong. Keep moving to the 3rd or the root.', 'Only the ♭3 → 3 hammer-ons, as quarter notes.'],
    clash: ['s9-clash', `The 3rd against the ♯9: the clash, the curl and the line (${nm})`, 'audiation', 'The whole sound of the chord is the semitone-and-an-octave rub between the major 3rd and the ♯9. Hearing the two notes alone, then resolving them, trains the ear to find that rub anywhere.', `Bar 1: the 3rd (D string) and the ♯9 (B string) alone, then the ♭7 and the ♯9, then the root. Sing the 3rd, then the ♯9, before you play bar 1 again. Bars 2 and 4: lines that use both 3rds. Pass: you can sing the 3rd and the ♯9 from the chord, and play all four bars in time.`, 'Rushing past the clash: let it ring a full beat.', 'Bar 1 only, slowly, singing each note.']
  }[kind];
  return make(c, {
    id: T[0], name: T[1], domain: kind === 'clash' ? 'ear' : 'improv', method: T[2], unit: '8th notes', goal: 88, start: 52, minutes: 5,
    voicings: [{ name: nm, frets: g.frets }], chords: [nm], backing: [nm.replace('7♯9', '7')], tab: { notes },
    why: T[3], instr: T[4], watch: T[5], simplify: T[6]
  });
}
/** Random access: a new key, grip and rhythm every bar (interleaving). */
export function s9Random(c) {
  const r = rng(709 + (c.lvl || 9)), notes = [], names = [], chords = [], voicings = new Map(); let last = null;
  for (let bar = 0; bar < 8; bar++) {
    const pc = Math.floor(r() * 12), shape = ['a', 'd', 'e'][Math.floor(r() * 3)], rk = ['scratch8', 'push', 'funk', 'stabs'][Math.floor(r() * 4)];
    const g = grip(shape, pc, last ? last.r : 7); if (!g) return null;
    renderBar(notes, g, RHY[rk].slots, bar * 4); chords.push(g.name); voicings.set(g.name + g.frets, { name: g.name, frets: g.frets }); last = g;
    names.push(`${g.name} (${GRIPS[shape].label.replace('the ', '')}, ${RHY[rk].label.split(':')[0]})`);
  }
  if (notes.length > 400) return null;
  return make(c, {
    id: 's9-random', name: 'Random access: a new key, grip and rhythm every bar', domain: 'fretboard', method: 'interleaving', unit: 'mixed 8ths and 16ths', goal: 100, start: 60, minutes: 5, dl: 1,
    voicings: [...voicings.values()].slice(0, 8), chords: [...new Set(chords)].slice(0, 8), backing: chords.map(n => n.replace('7♯9', '7')), tab: { notes },
    why: 'At mastery level the grip has to appear instantly for any root on any string, in whatever rhythm the groove needs: switching key, grip and rhythm every bar is the hardest, most useful mix.',
    instr: `${names.join(' → ')}. Read only the names: find the root on its string, grab the grip, play the rhythm. Pass: all 8 bars in time from the names alone.`,
    watch: 'Stopping the strumming hand while the fretting hand searches: keep it moving and scratch until the grip arrives.', simplify: 'The first four bars, all in 8ths.'
  });
}
/** An original 8-bar funk-rock study that uses every part of the path (capstone). */
export function s9Etude(c) {
  const root = mod12(c.key), notes = [], chords = [], voicings = new Map();
  const A = grip('a', root, 7), D = grip('d', mod12(root + 5), 7), E = grip('e', mod12(root + 7), 7), V = grip('a', mod12(root + 10), 7);
  if (!A || !D || !E || !V) return null;
  const put = (g, rk, bar, o = {}) => { renderBar(notes, g, RHY[rk].slots, bar * 4, o); chords.push(g.name); voicings.set(g.name + g.frets, { name: g.name, frets: g.frets }); };
  put(A, 'funk', 0, { slide: true });                                  // bar 1: slide in, 16th groove
  const l1 = line(root, 'low', 4); if (!l1) return null; notes.push(...l1); chords.push(A.name);   // bar 2: the low riff
  put(A, 'push', 2); put(V, 'stabs', 3);                               // bars 3–4: the push, then a parallel ♭VII
  put(D, 'scratch8', 4);                                               // bar 5: the IV on the top-string grip
  const l2 = line(root, 'hybrid', 20, HYB); if (!l2) return null; notes.push(...l2); chords.push(A.name);   // bar 6: the major-minor line
  put(E, 'stop', 6);                                                    // bar 7: the V, thumb-over, stop time
  if (!clashBar(notes, root, 28)) return null; chords.push(A.name);    // bar 8: the clash and the root
  if (notes.length > 400) return null;
  return make(c, {
    id: 's9-capstone-etude', name: `Capstone study: an 8-bar funk-rock piece in ${nameOf(root)}`, domain: 'rhythm', method: 'transfer', unit: 'mixed 8ths and 16ths', goal: 100, start: 60, minutes: 8, dl: 1,
    voicings: [...voicings.values()], chords: [...new Set(chords)], backing: chords.map(n => n.replace('7♯9', '7')), tab: { notes },
    why: 'An original piece that uses the whole path: a slide into a 16th-note groove, a low riff, the push, a parallel ♭VII, the IV on the top-string grip, the major-minor line, the V thumb-over in stop time, and the 3rd-against-♯9 clash to finish.',
    instr: 'Learn it two bars at a time, naming the grip and the rhythm of each bar before you play it. Then write your own 8 bars to the same plan (groove, riff, push, move, IV, line, V, ending). Pass: the study at the goal tempo with every scratch muted and every chord change on time, then your own version once.',
    watch: 'Bar 6 (the line) rushing: keep the 16th feel of the groove going in your strumming arm while you play single notes.', simplify: 'Bars 1–4.'
  });
}
/** The 7♯9 funk-rock groove on the I and ♭VII (kept from the first version of the path; tested by the app). */
export function hxSharp9(c) {
  const root = mod12(c.key), I = grip('a', root, 7), VII = grip('a', mod12(root + 10), I ? I.r : 7); if (!I || !VII) return null;
  const notes = [];
  [I, I, VII, I].forEach((g, bar) => renderBar(notes, g, RHY.funk.slots, bar * 4));
  return make(c, {
    id: 'hx-sharp9', name: `The 7♯9 groove on the I and ♭VII (${I.name}, ${VII.name})`, domain: 'rhythm', method: 'variable', unit: '16th notes', goal: 110, start: 60, minutes: 5,
    why: 'The dominant 7♯9 has the major 3rd and the minor 3rd (♯9) in one grip: the tense, bluesy chord Hendrix made famous in rock. Moving the same grip down a whole step (the ♭VII) and back is how funk-rock treats it: a sound, not a chord that must resolve.',
    instr: `Grip ${I.name} with the root on the A string. Keep the strumming hand moving in 16ths: the x hits are scratches (relax the fretting hand so the strings go dead, don't let go). Bar 3 moves the grip down two frets to ${VII.name}. Pass: four bars in time with every scratch dead and every hit ringing.`,
    watch: 'Strings 1 and 6 ringing: touch them with the thumb and the underside of the index finger.', simplify: 'Quarter-note strums.',
    voicings: [{ name: I.name, frets: I.frets }, { name: VII.name, frets: VII.frets }], chords: [I.name, VII.name], backing: [I.name, I.name, VII.name, I.name].map(n => n.replace('7♯9', '7')), tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const MUTE = 'Mute the strings you don’t play: the tip of the fretting finger on the root touches the low E, the underside of the fingers touches the high e. ';
export default entry({
  id: 'sharp9', kind: 'technique', title: 'The 7♯9 chord', domain: 'rhythm',
  re: /7.?(♯|#|sharp) ?9|hendrix chord|purple haze chord/,
  aliases: ['the Hendrix chord', 'dominant sharp nine'],
  summary: 'The "Hendrix chord": a dominant 7th with both 3rds, from building the grip and hearing it, to funk-rock 16th grooves with muted scratches, three grips across the neck, a blues in any key, minor-pentatonic riffs and the major-minor line over it, and an original study.',
  prereqs: ['pentatonic'],
  sources: ['https://guitarworld.com/lessons/hendrix-chord-from-jazz-to-jimi', 'https://www.guitarplayer.com/lessons/jimi-hendrix-the-five-rules-of-his-powerful-rhythm-style', 'https://www.musicradar.com/how-to/jimi-hendrix-rhythm-guitar-lesson', 'https://www.jazz-guitar-licks.com/pages/chords/dominant-seventh-sharp-ninth-chord-7-9-guitar-diagrams-and-voicings.html'],
  ctx: { key: 4, minor: false, prog: 'blues' },
  stages: [
    stage('foundations', 'Build it, hear it, grip it',
      'Build the A-string 7♯9 grip one string at a time and hear it against a plain dominant 7th, grip it cleanly 8 times in a row with strings 1 and 6 silent, move it to any called root on the A string, slide into it, and play quarter- and 8th-note grooves with a low riff answering it at 80 BPM.', [
        S('s9-hear', 'Hear the two 3rds', 'ear', 'Dominant 7th vs 7♯9; one string at a time.', [
          R_('s9-compare', 'Dominant 7th, then 7♯9: one finger changes ({key})', 'audiation', { prog: 'compare', rhythm: 'whole', domain: 'ear', unit: 'whole notes', goal: 70, start: 46, why: 'The 7♯9 is a dominant 7th with one note moved: the root on the B string goes up three frets to the ♯9, a minor 3rd above the root that rubs against the major 3rd. Hearing the plain chord first makes the new note jump out.', instr: MUTE + 'Bar 1: the dominant 7th (R 3 ♭7 R). Bar 2: move only the B-string finger up three frets: the 7♯9. Before each bar, sing the top note. Listen for the sweet chord turning sour and bluesy. Pass: you can sing the top note of both chords, and change between them in time.', watch: 'Moving more than one finger: only the B string changes.', simplify: 'Arpeggiate each chord slowly instead of strumming.' }),
          c => { const root = mod12(c.key), g = grip('a', root, 7); if (!g) return null; const pcs = tonesOf(root), notes = []; const st = g.frets.map((f, i) => (f == null ? null : [6 - i, f])).filter(Boolean); let t = 0;
            for (let k = 1; k <= st.length; k++) { st.slice(0, k).forEach(([s, f], i) => notes.push(tag(N(s, f, t + i * 0.5, 0.5), pcs))); t += k * 0.5; st.slice(0, k).forEach(([s, f]) => notes.push(tag(N(s, f, t, 2, null, { chord: true }), pcs))); t += 2; }
            return make(c, { id: 's9-build', name: `Build ${g.name} one string at a time: R, 3, ♭7, ♯9`, domain: 'fretting', method: 'chunking', unit: '8th notes', goal: 70, start: 44, minutes: 4, voicings: [{ name: g.name, frets: g.frets }], chords: [g.name], backing: [g.name.replace('7♯9', '7')], tab: { notes },
              why: 'Four notes, four jobs: the root, the major 3rd, the ♭7 and the ♯9. Adding them one at a time (and hearing each one join) builds the grip in small pieces and teaches what every finger is for.', instr: `Middle finger on the root (A string), index on the 3rd (D string, one fret lower), ring on the ♭7 (G string, same fret as the root), pinky on the ♯9 (B string, one fret higher). Pick the root, then root + 3rd, then root + 3rd + ♭7, then all four, and strum each group. Name each note as it joins. Pass: all four steps clean, then the full grip from nothing in one move.`, watch: 'The index finger flattening and muting the G string.', simplify: 'Stop at three notes (R 3 ♭7) until it rings, then add the pinky.' }); }]),
        S('s9-grip', 'A clean grip', 'fretting', 'Every string that should ring, rings; the others don’t.', [
          R_('s9-grip-reps', 'Grip, strum, let go: {chords}, 8 clean grips in a row', 'accurate-reps', { prog: 'vamp', rhythm: 'quarters', domain: 'fretting', goal: 72, start: 44, why: 'A grip is learned by grabbing it from nothing many times, not by holding it for minutes. Counting only the grips where all four notes ring builds the clean version.', instr: MUTE + 'Grab the grip, strum four quarter notes, let go completely (fingers off the strings, hand relaxed), grab it again. Count the grips where all four notes ring on the first strum. Pass: 8 clean grips in a row.', watch: 'Grabbing the grip one finger at a time: aim to land all four together.', simplify: 'Two strums per grip, with a beat of rest to re-grab.' }),
          R_('s9-silent-strings', 'Strum all six strings, hear only four: {chords}', 'external-focus', { prog: 'vamp', rhythm: 'eighths', domain: 'rhythm', goal: 74, start: 46, why: 'Funk-rock players strum through all six strings and let the fretting hand decide what sounds. That only works if the low E and the high e are silent: the sound tells you whether the muting works.', instr: MUTE + 'Strum all six strings in 8ths, as if the grip were a full barre chord. Listen to the edges of the sound: no low E booming under the root, no high e ringing above the ♯9. Pass: four bars of 8ths where you hear exactly four notes on every strum.', watch: 'Shrinking the strum to avoid the outer strings: strum them all and mute them.', simplify: 'Quarter notes.' })]),
        S('s9-move', 'Move it', 'fretboard', 'Any root on the A string; slide in from below.', [
          R_('s9-roots-called', 'From memory: the grip on called roots ({chords})', 'retrieval', { prog: 'vamp', rhythm: 'whole', keys: [0, 5, 10, 3], unit: 'whole notes', domain: 'fretboard', goal: 70, start: 44, why: 'The grip is movable: its root is the note on the A string under the middle finger. Finding the root of a called chord from memory is what lets you play the chord in any key.', instr: 'Cover the tab. Say the chord name, find its root on the A string, grab the grip and let it ring for the bar: {chords}, four bars each. Pass: every chord found before its bar starts, from the names alone.', watch: 'Finding the root with the index finger: the root is under the middle finger, the index is a fret lower on the D string.', simplify: 'Look at the A-string notes once, then cover them.' }),
          R_('s9-slide-in', 'Slide in from a fret below: {chords}', 'variable', { prog: 'vampVII', rhythm: 'quarters', slide: true, goal: 74, start: 46, why: 'Sliding the whole grip in from one fret below is a classic funk-rock entrance: the chord arrives with a little smear of tension. It also trains the grip to stay one shape while it moves.', instr: MUTE + 'Grab the grip one fret low, strum on the last 16th before the beat, and slide up to the real chord on the beat (the tab writes the low chord and the slide). Every new chord starts with a slide. Pass: four bars where the grip arrives intact on the beat.', watch: 'The grip loosening during the slide: keep light pressure and move the whole hand.', simplify: 'Slide in only on bar 1.' })]),
        S('s9-first-music', 'First music', 'rhythm', 'A groove, and a riff that answers the chord.', [
          R_('s9-groove-first', 'First groove: stabs on 2 and 4 over {prog} ({chords})', 'transfer', { prog: 'vampVII', rhythm: 'stabs', goal: 80, start: 50, why: 'A 7♯9 groove leaves room: stabs on beat 2 and 4 with space between are how the chord sits in a band, and moving the same grip down a whole step (the ♭VII) and back is all the harmony a funk-rock vamp needs.', instr: MUTE + 'Play the stabs short and together, and keep the strumming hand moving in 8ths in the air between them. Bar 3: the same grip two frets lower. Pass: four times round in time with the backing.', watch: 'Rushing the stab on the "and" of 2.', simplify: 'Only beat 2 and beat 4.' }),
          c => s9RiffChord(c, { level: 1 })])
      ], [1, 3]),
    stage('intermediate', 'Grooves, grips and the blues',
      'Play the 7♯9 in scratch 8ths, the syncopated push and 16th funk-rock at 90 BPM with every scratch dead, use the A-string, top-string and thumb-over grips, play a 12-bar blues in 7♯9s choosing the nearest grip, name any 7♯9 on the neck from memory, and play minor-pentatonic and major-minor lines over the chord.', [
        S('s9-rhythms', 'Rhythms', 'rhythm', 'Scratches, the push, 16ths.', [
          R_('s9-scratch', 'Scratch 8ths: the chord on the beat, dead strings on the "and" ({chords})', 'variable', { prog: 'vampVII', rhythm: 'scratch8', goal: 92, start: 56, why: 'The scratch (a strum with the fretting hand relaxed so the strings go dead) is what makes a funk-rock part groove: the hand never stops, and only some strokes sound.', instr: MUTE + 'Down on the beat with the grip pressed, up on the "and" with the fingers still on the strings but released. Listen for a click, not a note. Pass: four bars with every "and" dead and every beat ringing.', watch: 'Lifting the fingers off the strings for the scratch: they must stay touching.', simplify: 'Quarter-note chords, scratches only on beat 4’s "and".' }),
          c => hxSharp9(c),
          R_('s9-push', 'The push: {rhythm} ({chords})', 'variable', { prog: 'vamp', rhythm: 'push', goal: 90, start: 54, why: 'Syncopation (hits that land between the beats) is what makes a riff feel like funk instead of strumming. The push groups 16ths as 3 + 3 + 4 + 2 + 4 against a steady beat.', instr: MUTE + 'Count 16ths ("1 e & a") and strum down on every 16th in the air; touch the strings only where the tab has a hit. Pass: four bars locked to the click, with the hits on the "a" of 1 and the "&" of 2 exactly placed.', watch: 'The hand stopping before the off-beat hits: keep it moving.', simplify: 'Half the tempo, counting aloud.' })]),
        S('s9-grips', 'Three grips', 'fretting', 'The top strings and the thumb-over grip.', [
          R_('s9-grip-d', 'The top-string grip, root on the D string: {chords}', 'chunking', { prog: 'blues4', grips: 'd', rhythm: 'quarters', domain: 'fretting', goal: 80, start: 48, why: 'With the root on the D string the grip sits on the four top strings: a brighter, thinner 7♯9 that stays out of the bass player’s way. It has the same four notes in a different order.', instr: 'Root on the D string (index finger stretched across, middle on the 3rd one fret lower on the G string, ring and pinky barring the ♭7 and ♯9 on the B and e strings one fret higher). Learn it on one chord, then through I – IV – I – V. Pass: the four bars with all four notes ringing on every chord.', watch: 'The low strings ringing: mute them with the thumb and the tip of the index finger.', simplify: 'Only the D, G and B strings (R 3 ♭7).' }),
          R_('s9-grip-e', 'Thumb over the neck, root on the low E: {chords}', 'accurate-reps', { prog: 'vampVII', grips: 'e', rhythm: 'eighths', domain: 'fretting', goal: 80, start: 48, why: 'Hooking the thumb over the neck to fret the low root (Hendrix’s habit) frees the fingers for the ♭7, 3rd and ♯9 above it. The A and B strings are muted by the fingers next to them.', instr: 'Thumb on the low-E root, index on the ♭7 (D string, same fret), middle on the 3rd (G string, one fret higher), pinky on the ♯9 (high e, three frets up). The undersides of the fingers mute the A and B strings. Count clean grips. Pass: 8 bars with no A or B string sounding.', watch: 'The thumb dragging the hand behind the neck: keep the wrist relaxed, the thumb only hooks.', simplify: 'Leave out the ♯9: thumb, ♭7 and 3rd only.' })]),
        S('s9-blues', 'Through a blues, from memory', 'fretboard', 'Nearest grip; called chords.', [
          R_('s9-blues-near', '12-bar blues in 7♯9s: the nearest grip for every chord ({key})', 'interleaving', { prog: 'blues12', grips: 'near', rhythm: 'quarters', goal: 86, start: 52, why: 'Over a blues the I, IV and V are three different 7♯9s. Choosing, for each, the grip closest to the last one (A-string, top-string or thumb-over) keeps the hand in one place and mixes the grips the way real playing does.', instr: MUTE + 'Before each change, decide which grip is nearest and say it. The tab shows the choice: {grips}. Pass: one chorus without stopping, every change on beat 1.', watch: 'Jumping up and down the neck: if a change moves more than three frets, look for a closer grip.', simplify: 'The first four bars.' }),
          R_('s9-called', 'Called chords around the cycle of fourths ({chords})', 'retrieval', { prog: 'vamp', rhythm: 'whole', grips: ['a', 'd', 'e'], keys: [0, 5, 10, 3, 8, 1], unit: 'whole notes', domain: 'fretboard', goal: 80, start: 48, why: 'Every 7♯9 is a root plus one of three grips. Recalling the root on the A, D or low E string from the chord name, under time, is the retrieval that makes the chord usable in any key.', instr: 'Cover the tab. The chords move up a fourth every four bars and the grip changes every bar (A string, D string, thumb-over). Say the name and grip, find the root, play. Pass: all six chords from memory, every bar on time.', watch: 'Only ever using the A-string grip.', simplify: 'A-string grip only.' })]),
        S('s9-lines', 'Lines over the chord', 'improv', 'The curl and the major-minor line.', [c => s9Lines(c, { kind: 'curl' }), c => s9Lines(c, { kind: 'hybrid' })]),
        S('s9-music', 'In music', 'rhythm', 'Funk-rock riff and chord; a blues solo.', [c => s9RiffChord(c, { level: 2 }), c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues over the 7♯9: minor pentatonic, landing on each chord’s 3rd and root' })])
      ], [4, 6]),
    stage('advanced', 'Funk-rock at tempo',
      'Play 16th funk-rock with accents and scratches at 100 BPM, move the grip in parallel and slide into every change, play a 12-bar blues in all three grips and in four keys, hear and play the 3rd-against-♯9 clash and resolve it, and play a rhythm chorus and a lead chorus over a 7♯9 blues.', [
        S('s9-sixteenths', '16ths', 'rhythm', 'The hand never stops.', [
          R_('s9-funk16', '16th funk-rock with scratches: {chords}', 'variable', { prog: 'rise', rhythm: 'funk', goal: 100, start: 60, why: 'At 16ths the strumming hand is a drummer’s hi-hat: down on every 16th downbeat, up between, and the fretting hand turns notes on and off. Moving the grip through I – ♭III – IV keeps the groove going over changes.', instr: MUTE + 'Down–up 16ths without stopping. Press for the hits, release for the scratches. The grip moves up three frets, then two, then back. Pass: four bars at the goal tempo with every scratch dead.', watch: 'Pressing on the scratches (they ring) or releasing on the hits (they choke).', simplify: 'Scratch 8ths at the same tempo.' }),
          R_('s9-accents', 'Accents every three 16ths, the hand never stopping ({chords})', 'edge', { prog: 'vampVII', rhythm: 'funk2', goal: 100, start: 60, why: 'Accents every three 16ths over a four-beat bar make the groove roll across the bar line (a 3-against-4 feel). It is the hardest common funk-rock pattern: the timing has to come from the hand that never stops.', instr: MUTE + 'Every 16th is strummed; only the accented ones (the X hits) are pressed. Tempo ladder: start slow, add 4 BPM after each clean pass. Pass: four bars clean at the goal tempo.', watch: 'Accents drifting onto the beats.', simplify: 'Accent only the first three hits of each bar.' })]),
        S('s9-neck', 'Across the neck', 'fretboard', 'All grips, four keys.', [
          R_('s9-keys', '12-bar blues in four keys, nearest grip ({key} and up a fourth)', 'interleaving', { prog: 'blues4', grips: 'near', rhythm: 'push', keys: [0, 5, 10, 3], goal: 96, start: 58, why: 'Changing key every four bars with the nearest grip forces a new choice on every chord: the most transferable kind of practice, and how a working player finds the chord in someone else’s key.', instr: MUTE + 'I – IV – I – V in four keys, a fourth apart, in the syncopated push. For each chord, take the grip nearest the last one. Pass: all 16 bars without stopping.', watch: 'Defaulting to the A-string grip and leaping.', simplify: 'Two keys.' }),
          R_('s9-slide-changes', 'Slide into every change: {chords}', 'accurate-reps', { prog: 'blues12', grips: 'near', rhythm: 'quarters', slide: true, goal: 96, start: 58, why: 'A slide into every new chord makes each change a small event, and it is a good test of whether the grip survives a move.', instr: MUTE + 'Every new chord arrives by sliding from a fret below on the last 16th before its bar. Count the changes that arrive with all notes intact. Pass: a full chorus with every slide clean.', watch: 'Sliding with the whole hand tense: keep only enough pressure to hold the shape.', simplify: 'Slide only into the IV and V.' })]),
        S('s9-ear-adv', 'The rub and the line', 'ear', 'The clash, resolved; the ♯9 from memory.', [
          c => s9Lines(c, { kind: 'clash' }),
          R_('s9-recall-grips', 'From memory: every grip of {key}7♯9 up the neck', 'retrieval', { prog: 'vamp', rhythm: 'whole', grips: ['e', 'a', 'd', 'top'], unit: 'whole notes', domain: 'fretboard', goal: 90, start: 54, why: 'The same chord lives in several places: thumb-over at the bottom, the A-string grip, the top-string grip, and the rootless partial. Recalling them in order up the neck links the shapes into one map of the chord.', instr: 'Cover the tab. Play {key}7♯9 with the thumb-over grip, then the A-string grip, then the top-string grip, then the three-note partial, a bar each, saying where the root (or the missing root) is. Pass: twice from memory without looking.', watch: 'Losing track of the root in the partial: it is one fret above the index finger, on the A string you’re not playing.', simplify: 'Two grips.' })]),
        S('s9-adv-music', 'In music', 'rhythm', 'Rhythm chorus, lead chorus.', [
          R_('s9-chorus', 'Rhythm chorus: a 12-bar 7♯9 blues in {rhythm} ({key})', 'transfer', { prog: 'blues12', grips: 'near', rhythm: 'push', goal: 100, start: 60, minutes: 6, why: 'A whole chorus of 7♯9 rhythm is a performance: the same push every bar, the grips chosen for smooth changes, the scratches keeping the groove. Then a lead chorus answers it.', instr: MUTE + 'Play the chorus with the backing. Then play a second chorus of single-note lines (the minor pentatonic with the ♭3 → 3 move) and a third of rhythm again. Pass: three choruses in time, rhythm and lead at the same groove.', watch: 'The rhythm getting busier and louder each chorus: keep the push the same.', simplify: 'Quarter-note chords for the rhythm chorus.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Lead chorus over a 7♯9 blues: the ♭3 curled toward the 3rd on every chord' })])
      ], [7, 8]),
    stage('mastery', 'The chord at will',
      'Play 16th funk-rock in 7♯9s at 110 BPM with accents across the bar line, find any 7♯9 in any grip and rhythm on the spot, and perform your own 8-bar funk-rock piece and a two-chorus blues mixing rhythm and lead.', [
        S('s9-performance', 'At performance tempo', 'rhythm', 'Fast, tight, in any key.', [
          R_('s9-perf', 'Performance tempo: 16ths through {prog} in two keys', 'edge', { prog: 'blues4', grips: 'near', rhythm: 'funk', keys: [0, 7], goal: 110, start: 70, why: 'At performance tempo the scratch and the hit are a single movement of the fretting hand; only a relaxed arm keeps 16ths going for a whole tune.', instr: MUTE + 'Tempo ladder from the start tempo, +4 BPM after each clean pass. Pass: all 8 bars clean at the goal tempo with the arm loose.', watch: 'Tension in the strumming forearm: let the arm swing from the elbow.', simplify: 'One key.' }),
          R_('s9-recall-fast', 'From memory at tempo: called 7♯9s in all three grips ({chords})', 'retrieval', { prog: 'two', rhythm: 'scratch8', grips: ['d', 'e', 'a'], keys: [0, 7, 2, 9, 4, 11], goal: 106, start: 64, why: 'Retrieval under speed: the chord name, the root, the grip and the groove all at once, with no time to look.', instr: 'Cover the tab. Six chords a fifth apart, two bars each, the grip changing every bar. Keep the 8ths going through every change. Pass: from memory, no gaps.', watch: 'A dropped beat at each key change.', simplify: 'Two bars per grip.' })]),
        S('s9-random', 'Any key, any grip, any rhythm', 'fretboard', 'No warning.', [c => s9Random(c), c => targetGuide(c, { prog: 'blues9', scale: 'minorPent', name: 'Two choruses: rhythm, then lead over the same blues, with the major-minor line' })]),
        S('s9-voice', 'Your own groove', 'rhythm', 'A study, then your version.', [c => s9Etude(c),
          R_('s9-own-groove', 'Make it yours: a new rhythm over {prog} in two keys ({key} and up a fourth)', 'transfer', { prog: 'rise', grips: 'near', rhythm: 'funk', keys: [0, 5], goal: 108, start: 66, minutes: 6, why: 'Mastery is writing your own part. The tab gives a starting groove; the lesson is to replace its rhythm with one of your own and keep it as tight as the written one.', instr: MUTE + 'Learn the written 8 bars, then keep the chords and grips and invent your own 16th-note rhythm (where the hits fall, where the scratches go). Record both. Pass: your own groove for 8 bars with the same timing and muting as the written one.', watch: 'An invented rhythm that changes every bar: repeat it, like a real part.', simplify: 'Change the rhythm of bars 1 and 5 only.' })])
      ], [9, 10])
  ]
});
