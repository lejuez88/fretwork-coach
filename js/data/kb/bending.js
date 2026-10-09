// String bending: raising a fretted note to the pitch of a higher scale tone by pushing the string
// across the fretboard, in tune. From the first supported whole-step bend checked against a fretted
// reference, to half, whole, one-and-a-half and two-step bends, releases, pre-bends, unison, oblique
// and double-stop bends, and bends at speed: the voice of blues and rock lead playing (Gilmour,
// Hendrix, Stevie Ray Vaughan).
//
// Concept-first (CONTENT.md): the model is a bend as a MOVE between two scale degrees on one string
// ([from, to] in semitones above the key: 4 → 5 is [5, 7], a whole step; ♭7 → R is [10, 0]). Where a
// move sits on the neck is found from the key, a pentatonic box (its fret window) and the string, so
// every bend is in tune in every key by construction: the fretted note is the `from` degree and the
// bend's target fret (`bendTo`) is the `to` degree. The composer `bendRun(c, spec)` builds an exercise
// from move set × boxes × strings × articulation (kind: reference bend, bend and hold, bend and
// release, pre-bend and release, release and pull-off, unison, oblique, repeated) × keys × note value.
// Phrases are written as degrees, not frets (`phrase()`), so they too are right in any key.
import { OPEN, N, nameOf, minorKey, make, pentBox, byString, mod12, S, stage, entry, M, targetGuide } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const DEG = { 0: 'R', 2: '2', 3: '♭3', 4: '3', 5: '4', 7: '5', 8: '♭6', 10: '♭7' };
const PENT = [0, 3, 5, 7, 10], NAT = [0, 2, 3, 5, 7, 8, 10];
/** The bends of the minor key, grouped by size. Each is [from, to] in semitones above the key. */
export const MOVES = {
  half: [[2, 3], [7, 8]],                 // 2 → ♭3, 5 → ♭6 (natural minor)
  whole: [[5, 7], [10, 0], [3, 5]],       // 4 → 5, ♭7 → R, ♭3 → 4 (the classic pentatonic bends)
  oneHalf: [[0, 3], [7, 10]],             // R → ♭3, 5 → ♭7
  two: [[3, 7]]                           // ♭3 → 5, the wide rock over-bend
};
export const amountOf = ([a, b]) => mod12(b - a);
const AMOUNT = { 1: 'half step', 2: 'whole step', 3: 'step and a half', 4: 'two steps' };
const moveName = m => `${DEG[m[0]]} → ${DEG[m[1]]}`;
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes']]);
const unitName = step => UNIT.get(step) || 'quarter notes';
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/**
 * A box's frets per string, moved up an octave when it sits at the nut (open strings can't be bent):
 * every bend then has a fretted note to push.
 */
export function boxFrets(k, box) {
  const B = byString(pentBox(k, box)), all = Object.values(B).flat();
  if (Math.min(...all) < 2 && Math.max(...all) + 12 <= 19) Object.keys(B).forEach(s => { B[s] = B[s].map(f => f + 12); });
  return B;
}
/** The fret window of a box on one string: one fret either side of its two notes (room for 2 and ♭6). */
function windowOf(k, box, s) { const B = boxFrets(k, box); return B[s] ? [Math.max(0, B[s][0] - 1), B[s][1] + 1] : null; }
/**
 * Where a move sits on string s inside a box: the fret that plays the `from` degree, and the fret
 * whose pitch the bend reaches. Returns { s, f, to, move } or null when the move isn't in the window.
 */
export function spot(k, box, s, move) {
  const w = windowOf(k, box, s); if (!w) return null;
  for (let f = Math.max(1, w[0]); f <= w[1]; f++) if (mod12(pitch(s, f) - k) === move[0] && f + amountOf(move) <= 22) return { s, f, to: f + amountOf(move), move };
  return null;
}
/** Every bend of the given moves on the given strings of a box, string by string (low to high). */
export function bendsIn(k, box, strings, moves) {
  const out = [];
  for (const s of strings) for (const m of moves) { const b = spot(k, box, s, m); if (b) out.push(b); }
  return out;
}
/** The next scale tone below fret f on string s (for release-and-pull-off), or null. */
function below(k, s, f, scale = PENT) { for (let x = f - 1; x >= Math.max(0, f - 4); x--) if (scale.includes(mod12(pitch(s, x) - k))) return x; return null; }
/** A box note on the next higher string that sits above the bend's target pitch (the held note of an oblique bend). */
function heldAbove(k, box, b) {
  const B = boxFrets(k, box), hs = b.s - 1; if (!B[hs]) return null;
  const f = B[hs].find(x => pitch(hs, x) > pitch(b.s, b.to)); return f == null ? null : [hs, f];
}
/** Note value for fast articulations at a level. */
const fastStep = lvl => (lvl <= 5 ? 0.5 : lvl <= 8 ? 1 / 3 : 0.25);

/* ------------------------------- The composer ------------------------------- */
/**
 * Render one bend as tab notes starting at beat t; returns the beats used.
 *   ref: the target fretted first, then the bend up to it · up: bend and hold · release: bend, release
 *   pre: pre-bend, pick, release · pull: bend, release, pull off to the scale tone below (fast)
 *   unison: the target fretted on the next string, then both together while bending · oblique: bend
 *   under a held higher note · repeat: bend–release twice (fast)
 */
function render(notes, k, box, b, kind, t, step) {
  const B = { bendTo: b.to };
  switch (kind) {
    case 'ref': notes.push(N(b.s, b.to, t, 1), N(b.s, b.f, t + 1, 2, 'b', B)); return 4;
    case 'up': notes.push(N(b.s, b.f, t, 2, 'b', B)); return 2;
    case 'release': notes.push(N(b.s, b.f, t, 1, 'b', B), N(b.s, b.f, t + 1, 1, 'r')); return 2;
    case 'pre': notes.push(N(b.s, b.f, t, 1, 'pb', B), N(b.s, b.f, t + 1, 1, 'r')); return 2;
    case 'pull': { const lo = below(k, b.s, b.f); notes.push(N(b.s, b.f, t, step, 'b', B), N(b.s, b.f, t + step, step, 'r')); if (lo != null) { notes.push(N(b.s, lo, t + 2 * step, step, 'p')); return 3 * step; } return 2 * step; }
    case 'repeat': notes.push(N(b.s, b.f, t, step, 'b', B), N(b.s, b.f, t + step, step, 'r'), N(b.s, b.f, t + 2 * step, step, 'b', B), N(b.s, b.f, t + 3 * step, step, 'r')); return 4 * step;
    case 'unison': {
      const hs = b.s - 1, fu = b.to - (OPEN[hs] - OPEN[b.s]); if (hs < 1 || fu < 0) return 0;
      notes.push(N(hs, fu, t, 1), N(b.s, b.f, t + 1, 2, 'b', { ...B, chord: true }), N(hs, fu, t + 1, 2, null, { chord: true })); return 4;
    }
    case 'oblique': {
      const h = heldAbove(k, box, b); if (!h) return 0;
      notes.push(N(h[0], h[1], t, 2, null, { chord: true }), N(b.s, b.f, t, 2, 'b', { ...B, chord: true })); return 2;
    }
    default: return 0;
  }
}
/**
 * One bending exercise from a spec: { id, name ('{key}', '{moves}'), method, kind, boxes, strings,
 * moves (a MOVES name or a list), keys (offsets, one block each), reps, step, land (end on the root),
 * goal, start, dl, domain, why, instr, watch, simplify, backing (a chord list builder k => names) }.
 */
export function bendRun(c, spec) {
  const k0 = minorKey(c), moves = typeof spec.moves === 'string' ? MOVES[spec.moves] : spec.moves || MOVES.whole;
  const step = spec.step || fastStep(c.lvl || 5), kind = spec.kind || 'ref', notes = []; let t = 0, n = 0, lastK = k0;
  for (const off of spec.keys || [0]) for (const box of spec.boxes || [1]) {
    const k = mod12(k0 + off), list = bendsIn(k, box, spec.strings || [3, 2, 1], moves);
    for (let r = 0; r < (spec.reps || 1); r++) for (const b of list) { const used = render(notes, k, box, b, kind, t, step); if (used) { t += used; n++; } }
    lastK = k;
  }
  if (n < 2) return null;
  if (spec.land !== false) {
    const B = boxFrets(lastK, (spec.boxes || [1])[0]); const rs = [3, 4, 2, 1, 5].find(s => B[s] && B[s].some(f => mod12(pitch(s, f) - lastK) === 0));
    if (rs) { const f = B[rs].find(x => mod12(pitch(rs, x) - lastK) === 0), end = Math.ceil((t + 1) / 4) * 4; notes.push(N(rs, f, t, end - t, '~')); }
  }
  const fill = s => s.replace('{key}', `${nameOf(k0)} minor`).replace('{moves}', moves.map(m => `${moveName(m)} (${AMOUNT[amountOf(m)]})`).join(', '));
  const chords = spec.backing ? spec.backing(k0) : null;
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretting', method: spec.method, unit: spec.unit || (['pull', 'repeat'].includes(kind) ? unitName(step) : 'quarter notes'),
    goal: spec.goal || 80, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, ...(chords ? { backing: chords, chords } : {}), tab: { notes }
  });
}
const B_ = (id, name, method, opts) => c => bendRun(c, { id, name, method, ...opts });
const rockChords = k => [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];

/* ------------------------------- Phrases ------------------------------- */
/** The fret on string s that plays degree d near box `box` (searching its window), or null. */
function fretOf(k, box, s, d) { const w = windowOf(k, box, s); if (!w) return null; for (let f = w[0]; f <= w[1]; f++) if (mod12(pitch(s, f) - k) === d) return f; return null; }
/**
 * A phrase written in degrees: events [string, degree, beats, kind?, toDegree?] where kind is
 * 'b' (bend to toDegree), 'pb' (pre-bend to toDegree), 'r' (release), '~' (vibrato) or null.
 * A null string is a rest. Returns the notes, or null when a degree isn't in the box.
 */
export function phrase(k, box, events, t0 = 0) {
  const notes = []; let t = t0;
  for (const [s, d, beats, x, to] of events) {
    if (s == null) { t += beats; continue; }
    const f = fretOf(k, box, s, d); if (f == null) return null;
    const extra = to != null ? { bendTo: f + mod12(to - d) } : null;
    notes.push(N(s, f, t, beats, x || null, extra)); t += beats;
  }
  return notes;
}
/** First music: two call-and-answer phrases in box 1 built on the 4 → 5 and ♭7 → R bends (use in music). */
export function bendPhrase(c, { level = 1 } = {}) {
  const k = minorKey(c);
  const a = level === 1
    ? [[2, 10, 1], [3, 5, 2, 'b', 7], [3, 5, 1, 'r'], [4, 0, 4, '~'], [1, 3, 1], [2, 10, 2, 'b', 0], [2, 10, 1, 'r'], [2, 7, 4, '~']]
    : level === 2
      ? [[2, 10, 1, 'pb', 0], [2, 10, 1, 'r'], [2, 7, 1], [3, 5, 1, 'b', 7], [3, 5, 4, '~'], [1, 3, 0.5], [1, 0, 0.5], [2, 10, 1, 'b', 0], [2, 10, 1, 'r'], [2, 7, 1], [3, 3, 4, '~']]
      : [[1, 0, 1, 'b', 3], [1, 0, 1, 'r'], [2, 10, 1, 'b', 0], [2, 7, 1, 'b', 10], [2, 7, 1, 'r'], [3, 5, 0.5, 'b', 7], [3, 5, 0.5, 'r'], [3, 3, 2, '~'], [1, 3, 1, 'pb', 5], [1, 3, 1, 'r'], [2, 10, 1, 'b', 0], [2, 10, 1, 'r'], [3, 5, 1, 'b', 7], [4, 0, 4, '~']];
  const notes = phrase(k, 1, a); if (!notes) return null;
  const chords = level === 3 ? [nameOf(k) + '7', nameOf(k + 5) + '7', nameOf(k) + '7', nameOf(k + 7) + '7'] : rockChords(k);
  const id = ['bend-phrase', 'bend-phrase-pre', 'bend-phrase-blues'][level - 1];
  const name = [`First bending phrases: 4 → 5 and ♭7 → R over ${chords.join(' – ')}`, `Phrases with a pre-bend that sighs down (${nameOf(k)} minor)`, `Blues phrases: 1½-step, whole-step and pre-bends over a ${nameOf(k)} blues`][level - 1];
  return make(c, {
    id, name, domain: 'improv', method: 'transfer', unit: 'phrases', goal: level === 3 ? 84 : 76, start: 50, minutes: 5, dl: level === 1 ? 0 : 0, backing: chords, chords,
    why: ['A bend is a vocal sound: it belongs at the peak of a phrase. Two short phrases (one bending the G string, one the B string) answer each other over the groove.',
      'A pre-bend lets a note fall into place like a sigh: the most expressive way to start a phrase. Here it opens the phrase and a held, vibrato-ed bend ends it.',
      'Over a dominant blues the minor pentatonic’s bends become the whole language: a step-and-a-half bend from the root to the ♭3, whole steps to the root and the 5th, a pre-bend that falls from the 4 to the ♭3.'][level - 1],
    instr: 'Play the phrases over the backing, then answer each one with a phrase of your own that uses the same bend. Check the first bend of each phrase against the fretted target before you start. Pass: both phrases in time with every bend on pitch, then four bars of your own.',
    watch: 'Bends that stop short of the target (flat): they sound uncertain. Push until it matches.', simplify: 'Only the first phrase, with whole notes for the bends.', tab: { notes }
  });
}
/** Double-stop bend: the top two strings barred, the B string bent a whole step (♭7 → R) while the e string rises a half step (♭3 → 3) over a dominant blues. */
export function dsBend(c) {
  const k = minorKey(c), B = boxFrets(k, 1); if (!B[1] || !B[2] || B[1][1] !== B[2][1]) return null;
  const f = B[1][1], notes = []; let t = 0;
  const rf = B[4] && B[4].find(x => mod12(pitch(4, x) - k) === 0);
  for (let bar = 0; bar < 4; bar++) {
    t = bar * 4;
    notes.push(N(2, f, t, 1, 'b', { bendTo: f + 2, chord: true }), N(1, f, t, 1, 'b', { bendTo: f + 1, chord: true }));
    notes.push(N(2, f, t + 1, 1, 'r', { chord: true }), N(1, f, t + 1, 1, 'r', { chord: true }));
    notes.push(N(2, f, t + 2, 0.5), N(1, f, t + 2.5, 0.5));
    notes.push(rf != null && bar % 2 ? N(4, rf, t + 3, 1, '~') : N(3, B[3][1], t + 3, 1, 'b', { bendTo: B[3][1] + 2 }));
  }
  const chords = [nameOf(k) + '7', nameOf(k + 5) + '7', nameOf(k) + '7', nameOf(k + 7) + '7'];
  return make(c, {
    id: 'bend-double-stop', name: `Double-stop bends on the top strings (${nameOf(k)} blues)`, domain: 'fretting', method: 'variable', unit: 'quarter notes', goal: 84, start: 52, minutes: 5, backing: chords, chords,
    why: 'Barring the B and high e strings with one finger and bending both gives the classic blues and rock’n’roll double-stop: the B string rises a whole step (♭7 to the root) while the e string, which bends less, rises a half step (the ♭3 to the major 3rd of the I7 chord). That blue rub is the point.',
    instr: 'Barre both strings with the 3rd finger (2nd behind it for support) and pull them toward the floor together; release, pick each string once, then answer with a single-string bend or the root. Pass: four bars where the B string reaches the root every time.',
    watch: 'Pushing the strings sideways so they slip apart: pull straight down.', simplify: 'Bend the B string alone, then add the e string.', tab: { notes }
  });
}
/** The plan of the random lesson: one { k, box, move, kind } per bar. */
export function bendPlan(c) {
  const r = rng(1201 + (c.lvl || 9)), all = [...MOVES.whole, ...MOVES.oneHalf, ...MOVES.half], kinds = ['pre', 'release', 'up'], out = [];
  for (let bar = 0; bar < 8; bar++) out.push({ k: Math.floor(r() * 12), box: 1 + Math.floor(r() * 5), move: all[Math.floor(r() * all.length)], kind: kinds[Math.floor(r() * 3)] });
  return out;
}
/** A random key, box, bend and articulation every bar (interleaving). */
export function bendRandom(c) {
  const plan = bendPlan(c), notes = [], names = [];
  for (const [bar, p] of plan.entries()) {
    const b = [3, 2, 1].map(s => spot(p.k, p.box, s, p.move)).find(Boolean); if (!b) return null;
    render(notes, p.k, p.box, b, p.kind, bar * 4, 0.5);
    const kept = notes[notes.length - 1]; if (p.kind === 'up') kept.d = 4; else notes.push(N(b.s, b.f, bar * 4 + 2, 2, '~'));
    names.push(`${nameOf(p.k)}m box ${p.box}: ${moveName(p.move)} (${{ pre: 'pre-bend', release: 'bend and release', up: 'bend and hold' }[p.kind]})`);
  }
  return make(c, {
    id: 'bend-random', name: 'Random access: a new key, box and bend every bar', domain: 'fretting', method: 'interleaving', unit: 'half notes', goal: 80, start: 52, minutes: 5, dl: 1,
    why: 'At mastery level any bend in any key should be under the fingers and in tune at once: the right fret, the right distance, the right articulation.',
    instr: `${names.join(' → ')}. Read only the names: find the fret, make the bend, then hold the fretted note with vibrato while you find the next. Pass: all 8 bars from memory with every bend on pitch.`,
    watch: 'Wide bends going flat when the box is new to you.', simplify: 'The first four bars.', tab: { notes }
  });
}
/** An original 8-bar study that uses every bend of the path (capstone). */
export function bendEtude(c) {
  const k = minorKey(c), notes = [];
  const p1 = phrase(k, 1, [[2, 10, 1, 'pb', 0], [2, 10, 1, 'r'], [2, 7, 1], [3, 5, 1, 'b', 7], [3, 5, 4, '~']], 0); if (!p1) return null; notes.push(...p1);    // bars 1–2: pre-bend, then the 4 → 5
  const u = spot(k, 1, 3, [5, 7]); if (!u || render(notes, k, 1, u, 'unison', 8, 0.5) === 0) return null;                                                 // bar 3: unison bend
  const ob = spot(k, 1, 3, [5, 7]); if (!ob) return null; render(notes, k, 1, ob, 'oblique', 12, 0.5); render(notes, k, 1, ob, 'oblique', 14, 0.5);   // bar 4: oblique bends
  const w = spot(k, 1, 1, [0, 3]) || spot(k, 1, 2, [7, 10]); if (!w) return null; notes.push(N(w.s, w.f, 16, 2, 'b', { bendTo: w.to }), N(w.s, w.f, 18, 2, 'r'));   // bar 5: a 1½-step bend and slow release
  let t = 20; const rp = spot(k, 1, 2, [10, 0]); if (!rp) return null; for (let i = 0; i < 3; i++) t += render(notes, k, 1, rp, 'repeat', t, 1 / 3);       // bar 6: repeated bends
  t = 24; for (const s of [1, 2, 3]) { const b = [[3, 5], [10, 0], [5, 7]].map(m => spot(k, 1, s, m)).find(Boolean); if (b) t += render(notes, k, 1, b, 'pull', t, 1 / 3); }   // bar 7: release-and-pull down the strings
  const rs = boxFrets(k, 1); const rf = rs[4] && rs[4].find(x => mod12(pitch(4, x) - k) === 0); if (rf == null) return null;
  notes.push(N(4, rf, Math.max(t, 27), 32 - Math.max(t, 27), '~'));
  const chords = rockChords(k);
  return make(c, {
    id: 'bend-capstone-etude', name: `Capstone study: an 8-bar bending piece (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer', unit: 'mixed rhythms', goal: 84, start: 52, minutes: 8, dl: 1, backing: [...chords, ...chords], chords,
    why: 'An original piece that uses every bend of the path musically: a pre-bend that falls into a phrase, the 4 → 5 bend held, a unison bend, oblique bends under a held note, a step-and-a-half bend released slowly, repeated bends, release-and-pull-offs down the strings, and the landing.',
    instr: 'Learn it two bars at a time, checking each new bend against its fretted target first. Then write your own 8 bars to the same plan. Pass: the study at the goal tempo with every bend on pitch, then your own version once.',
    watch: 'The wide bend in bar 5 going flat as you tire: support it with every finger behind it.', simplify: 'Bars 1–4.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const REF = 'Play the fretted target first and listen; then fret the note it marks “b”, with two or three fingers behind each other on the string, and push the string up (toward the ceiling on the G, B and e strings) until it matches. ';
export default entry({
  id: 'bending', kind: 'technique', title: 'String bending', domain: 'fretting',
  re: /\bbend(s|ing)?\b|string.?bend|pre.?bend|ghost bend|unison bend|oblique bend/,
  aliases: ['bends', 'pre-bends and releases', 'unison bends'],
  summary: 'Bending strings in tune, from the first supported whole-step bend checked against a fretted note to half, whole, step-and-a-half and two-step bends, pre-bends, unison, oblique and double-stop bends, in any key and in real solos.',
  prereqs: ['pentatonic'],
  sources: ['https://www.guitarplayer.com/lessons/string-bending-the-one-hour-workout', 'https://hubguitar.com/technique/string-bending-overview', 'https://www.guitarworld.com/lessons/tips-precision-string-bending', 'https://www.pickupmusic.com/blog/guitar-techniques-bending-and-vibrato', 'https://guitarlessons.com/guitar-lessons/lead-guitar-quick-start-series/how-to-bend-the-guitar-strings/'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The first bends, in tune',
      'Bend the 4 up to the 5 on the G string and the ♭7 up to the root on the B string so they match the fretted target 8 times out of 10 at 60 BPM, bend and release in time, name each bend of box 1 from memory, and play two bending phrases over a minor groove.', [
        S('bend-hear', 'Hear the target first', 'ear', 'Play the target, hear it, bend to it.', [
          B_('bend-ref-whole', 'Reference bends: {moves} ({key}, box 1)', 'audiation', { strings: [3, 2], moves: [[5, 7], [10, 0]], reps: 2, kind: 'ref', goal: 72, start: 50, why: 'A bend is only right when it reaches the pitch of the note it replaces. Playing that note first, and hearing it (hum it if you can), gives the ear a target, so the fingers learn how far to push.', instr: REF + 'G string: the 4 up a whole step to the 5. B string: the ♭7 up a whole step to the root. Pass: 8 bends in a row that match the target with no audible gap.', watch: 'Stopping short: a slightly flat bend is the most common sound in beginner solos.', simplify: 'Only the G-string bend, with three fingers pushing.' }),
          B_('bend-ref-all', 'Every whole-step bend of box 1, checked ({key})', 'accurate-reps', { strings: [3, 2, 1], moves: 'whole', kind: 'ref', goal: 72, start: 50, why: 'Box 1 has whole-step bends on all three top strings. Counting only the bends that land exactly on pitch (not the attempts) builds the muscle memory of the distance.', instr: REF + 'Every whole-step bend of the box from the G string to the high e: {moves}. Count the in-tune ones. Pass: 2 passes in a row with every bend matching.', watch: 'The high e string: it needs less push than you think, so it overshoots.', simplify: 'The G and B strings only.' })]),
        S('bend-support', 'Strength and control', 'fretting', 'Support fingers, then bend and release in time.', [
          B_('bend-release-slow', 'Bend and release in time: {moves} ({key})', 'chunking', { strings: [3, 2], moves: [[5, 7], [10, 0]], reps: 3, kind: 'release', goal: 76, start: 50, why: 'Every bend needs a plan for how it ends. Bending up on the beat and releasing on the next beat back to the fretted note splits the move into two halves you can control.', instr: 'One beat up, one beat down, with the pick striking only once. Push with the ring finger and the two fingers behind it; the thumb hooks over the neck for leverage. Pass: 6 bends and releases in a row where both the top and the bottom are in tune.', watch: 'Releasing too early: hold the top until the beat.', simplify: 'Bend up and hold; release in your own time.' }),
          B_('bend-along-b', 'Bends along the B string: every whole step from ♭3, 4 and ♭7 ({key})', 'variable', { strings: [2], moves: 'whole', boxes: [1, 2, 3, 4, 5], kind: 'release', goal: 76, start: 50, why: 'The higher up the neck, the closer the frets and the easier the bend; the lower, the harder. Bending the same string in every box teaches how the push changes along the neck.', instr: 'On the B string only, in each box from 1 to 5: bend every note that has a whole step above it (♭3, 4 or ♭7) and release. Pass: the whole string clean with every bend on pitch.', watch: 'Low-fret bends going flat: add more fingers.', simplify: 'Boxes 1 and 2.' })]),
        S('bend-know', 'Which notes bend where', 'theory', 'The bends of the box, by degree, from memory.', [
          B_('bend-degrees', 'From memory: bend each degree to the next ({key}, box 1)', 'retrieval', { strings: [3, 2, 1], moves: 'whole', kind: 'up', goal: 72, start: 50, why: 'In the minor pentatonic the ♭3, the 4 and the ♭7 each have a scale tone a whole step above them; those are the notes you bend. Knowing them by degree means you can find a bend in any box without searching.', instr: 'Cover the tab. Say the degree, then play its bend and hold: on the G string the 4 → 5, on the B string the ♭7 → R, on the high e the ♭3 → 4. Pass: all three from memory, twice, each on pitch.', watch: 'Bending the root: it needs a step and a half, not a whole step.', simplify: 'Play the box first, naming the degrees, then bend.' }),
          B_('bend-hold-vib', 'Bend, hold and land: {moves} ({key})', 'accurate-reps', { strings: [3, 2, 1], moves: [[5, 7], [10, 0], [3, 5]], kind: 'up', reps: 2, goal: 76, start: 50, why: 'Holding a bend for two full beats at the same pitch is harder than reaching it: the string wants to drop back. Steady bends are what make a held note sing.', instr: 'Bend up on the beat and hold the pitch perfectly still for two beats, then the next. Count only bends that hold steady. Pass: 6 steady bends in a row, then land on the root with vibrato.', watch: 'The pitch sagging during the hold.', simplify: 'One-beat holds.' })]),
        S('bend-first-music', 'First music', 'improv', 'Bends inside phrases.', [c => bendPhrase(c, { level: 1 }), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'Every bend size and type',
      'Bend half steps, whole steps and steps-and-a-half to pitch at 75 BPM, pre-bend and release so the first sound is already in tune, match a unison bend until the beating stops, bend in every box and any degree on demand, and phrase with pre-bends over a minor progression.', [
        S('bend-amounts', 'Half, whole and one-and-a-half', 'fretting', 'Three distances, three different pushes.', [
          B_('bend-half', 'Half-step bends from the natural minor: {moves} ({key})', 'variable', { strings: [3, 2, 1], moves: 'half', kind: 'ref', goal: 80, start: 52, why: 'A half step is the smallest bend and the easiest to overshoot. It belongs to the natural minor: the 2 bends up to the ♭3 and the 5 to the ♭6, a darker, more vocal colour than the pentatonic bends.', instr: REF + 'Every half-step bend of the box: {moves}. Pass: two passes with every bend matching and none overshooting.', watch: 'Overshooting into a whole step.', simplify: 'The G string only.' }),
          B_('bend-one-half', 'Step-and-a-half bends: {moves} ({key})', 'variable', { strings: [3, 2, 1], moves: 'oneHalf', kind: 'ref', goal: 80, start: 52, why: 'A step and a half (three frets) turns the root into the ♭3 or the 5 into the ♭7: the big, crying bend of rock and blues. It needs every finger behind the bending one and a rotation of the wrist, not just finger push.', instr: REF + 'Every 1½-step bend of the box: {moves}. Rotate the wrist like turning a door handle. Pass: two passes with every bend matching.', watch: 'Running out of push at the top so the bend lands flat.', simplify: 'Higher up the neck (box 4), where it is easier.' })]),
        S('bend-types', 'Release, pre-bend and unison', 'fretting', 'Three articulations, judged by ear.', [
          B_('bend-pull', 'Bend, release, pull off: down the top strings ({key})', 'variable', { strings: [1, 2, 3], moves: 'whole', kind: 'pull', reps: 2, goal: 84, why: 'Bend up, release, pull off to the next scale tone below: one of the most common blues and rock licks, and a test that the release lands exactly on the fretted pitch before the pull-off.', instr: 'Pick once, bend up, release, then pull off to the note below, all on one pick stroke, then the next string. Pass: four in a row in time with the release in tune.', watch: 'Picking again on the release.', simplify: 'Slower, without the pull-off.' }),
          B_('bend-pre', 'Pre-bends that fall into place: {moves} ({key})', 'external-focus', { strings: [3, 2, 1], moves: 'whole', kind: 'pre', reps: 2, goal: 76, start: 50, why: 'A pre-bend is bent silently before it is picked, so the first thing anyone hears is the bent pitch: there is no way to correct it. It trains bending by ear and feel, not by sliding up to the note.', instr: 'Bend silently to the target, pick, then release slowly to the fretted note over one beat. Listen only to the first instant after the pick: it must already be in tune. Check against the fretted target if unsure. Pass: 6 pre-bends in a row where the first sound is on pitch.', watch: 'The pitch creeping up after the pick: the pre-bend was short.', simplify: 'Bend with sound first, then without.' }),
          B_('bend-unison', 'Unison bends until the beating stops ({key})', 'external-focus', { strings: [3, 2], moves: [[5, 7], [10, 0]], kind: 'unison', reps: 2, goal: 72, start: 50, why: 'Play a note on the higher string and bend the lower string up to the same pitch: when the two match, the wobble (beating) between them stops. It is the most exact intonation check there is, and a huge rock sound.', instr: 'Pick the fretted note on the higher string, then both strings together while bending the lower one up. Listen for the beating between the two notes to slow down and stop. Pass: 4 unison bends in a row with no beating at the top.', watch: 'Muting the higher string with the bending finger: arch it.', simplify: 'Bend first, then add the higher note.' })]),
        S('bend-boxes', 'Bends in every box', 'fretboard', 'Same degrees, new places, on demand.', [
          B_('bend-box2', 'Whole-step bends in box 2: {moves} ({key})', 'variable', { boxes: [2], strings: [3, 2, 1], moves: 'whole', kind: 'release', goal: 80, start: 52, why: 'Box 2 holds a different set of bends under the same fingers. Finding the ♭3, 4 and ♭7 in a new box shows the bends are degrees, not frets.', instr: 'Bend and release every whole-step bend of box 2 from the G string up. Name each degree. Pass: two passes on pitch.', watch: 'Bending the 5th (it has no whole step above it).', simplify: 'The G and B strings.' }),
          B_('bend-boxes-mix', 'One bend per box, boxes 1 to 5 ({key})', 'interleaving', { boxes: [1, 2, 3, 4, 5], strings: [3], moves: 'whole', kind: 'pre', goal: 76, start: 50, why: 'Changing box with every bend means the arm, the push and the target change each time: mixed practice that sticks better than repeating one bend.', instr: 'The whole-step pre-bends on the G string in boxes 1, 2, 3, 4 and 5, without stopping. Pass: the whole run with every bend on pitch.', watch: 'Different strength needed low and high on the neck.', simplify: 'Boxes 1–3.' }),
          B_('bend-called', 'Bend on demand: the degree is called, you find it ({key}, boxes 1 and 4)', 'retrieval', { boxes: [1, 4], strings: [3, 2, 1], moves: [[3, 5], [5, 7], [10, 0], [0, 3]], kind: 'up', goal: 76, start: 50, why: 'Finding “the 4 → 5 bend” or “the root → ♭3 bend” on demand, in a given box, is exactly what improvising asks for. Retrieval practice makes it fast.', instr: 'Cover the tab. Read the move list: {moves}. In box 1, then box 4, play each one that exists on the G, B or e string, saying it first. Pass: both boxes from memory with every bend on pitch.', watch: 'Mixing up which degree bends how far.', simplify: 'Box 1 only.' })]),
        S('bend-music', 'In music', 'improv', 'Pre-bends in phrases, and a solo.', [c => bendPhrase(c, { level: 2 }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo with a bend at the top of every phrase, landing on chord tones' })])
      ], [4, 6]),
    stage('advanced', 'Wide, double and oblique bends',
      'Bend two steps in tune, release a wide pre-bend slowly without wavering, play oblique and double-stop bends cleanly, play the same bend in four keys and any box from memory, and solo over a blues with bends as the voice.', [
        S('bend-wide', 'Wide bends', 'fretting', 'Two steps, and wide releases.', [
          B_('bend-two-step', 'Two-step over-bends: {moves} ({key})', 'variable', { boxes: [1, 3, 4], strings: [2, 1], moves: 'two', kind: 'ref', goal: 80, start: 52, why: 'Bending the ♭3 all the way to the 5 (four frets) is the screaming over-bend of hard rock. It needs strong support, light strings and a precise ear, because a two-step bend is very easy to leave short.', instr: REF + 'The ♭3 → 5 bend in boxes 1, 3 and 4. Pass: every bend on pitch twice.', watch: 'Low-fret versions: higher up the neck first.', simplify: 'Step-and-a-half bends instead.' }),
          B_('bend-wide-release', 'Wide pre-bends released slowly: {moves} ({key})', 'external-focus', { strings: [2, 1], moves: 'oneHalf', kind: 'pre', reps: 2, goal: 72, start: 50, why: 'A slow release from a wide pre-bend sounds like a voice falling: but only if the fall is smooth and lands exactly on the fretted note. Listening to the whole glide trains the control.', instr: 'Pre-bend a step and a half silently, pick, and let the pitch fall over the whole beat, smoothly, landing exactly on the fretted note. Listen for a continuous slide in pitch with no steps. Pass: 4 releases in a row that glide and land in tune.', watch: 'Dropping the release in one go.', simplify: 'Whole-step pre-bends.' })]),
        S('bend-double', 'Double-stop and oblique bends', 'fretting', 'Two strings at once.', [c => dsBend(c),
          B_('bend-oblique', 'Oblique bends: bending under a held note ({key})', 'variable', { boxes: [1, 2], strings: [3, 2], moves: [[5, 7], [10, 0], [3, 5]], kind: 'oblique', reps: 2, goal: 80, start: 52, why: 'Bend one string while a higher note rings unchanged above it: the pedal-steel sound of country and of Hendrix’s rhythm playing. The held note must not move, which means the bending finger must not touch it.', instr: 'Fret the held note on the higher string with the pinky or ring finger, the bend note below it with the ring or middle finger; pick both and bend only the lower one. Pass: 4 bends in a row with the top note steady and the bend on pitch.', watch: 'The held note going sharp because its string gets pushed too.', simplify: 'Pick the two notes separately first.' })]),
        S('bend-anywhere', 'Any key, any box', 'fretboard', 'Bends found on the spot.', [
          B_('bend-keys', 'The 4 → 5 and ♭7 → R bends in four keys around the cycle of fourths', 'interleaving', { keys: [0, 5, 10, 3], strings: [3, 2], moves: [[5, 7], [10, 0]], kind: 'pre', goal: 76, start: 50, why: 'The bends are degrees, so they move with the key. Changing key every block means finding box 1 and its bends instantly while keeping them in tune.', instr: 'Pre-bend and release the G-string and B-string bends in box 1, then move to the key a 4th up, four keys in all. Pass: all four keys without stopping, every bend on pitch.', watch: 'Higher keys sit higher on the neck: less push needed.', simplify: 'Two keys.' }),
          B_('bend-called-all', 'Bend on demand in all five boxes ({key})', 'retrieval', { boxes: [3, 5, 1, 4, 2], strings: [3, 2, 1], moves: [[5, 7], [10, 0], [0, 3]], kind: 'up', goal: 80, start: 52, why: 'Out of order, each box’s bends have to come from memory: exactly the skill of reaching for the right bend anywhere in a solo.', instr: 'Cover the tab. Boxes 3, 5, 1, 4, 2: in each, find and play the 4 → 5, ♭7 → R and R → ♭3 bends that sit on the G, B and e strings. Pass: all five boxes from memory with every bend on pitch.', watch: 'Defaulting to box 1.', simplify: 'Boxes 1–3.' })]),
        S('bend-adv-music', 'In a solo', 'improv', 'Bends as the voice of a blues.', [c => bendPhrase(c, { level: 3 }), c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo: every phrase peaks on a bend' })])
      ], [7, 8]),
    stage('mastery', 'Fast, anywhere and your own',
      'Play release-and-pull-off runs in 16ths and repeated bends at tempo with every bend on pitch, any key, box and bend on demand, and perform your own 8-bar bending piece.', [
        S('bend-performance', 'Bends at speed', 'fretting', 'Fast bends that stay in tune.', [
          B_('bend-pull-fast', 'Bend–release–pull-off runs at speed ({key}, boxes 1 and 2)', 'edge', { boxes: [1, 2], strings: [1, 2, 3], moves: 'whole', kind: 'pull', reps: 2, goal: 92, why: 'At speed the bend and release take a fraction of a beat, and they still have to hit the pitch: the fast blues-rock lick in its performance form.', instr: 'Bend, release and pull off on one pick stroke, string by string, box 1 then box 2. Tempo ladder: add a few BPM after each pass with every bend on pitch. Pass: clean at the goal tempo.', watch: 'Bends getting smaller as the tempo rises.', simplify: '8th-note triplets.' }),
          B_('bend-repeat', 'Repeated bends: two per note, at tempo ({key})', 'edge', { strings: [3, 2], moves: [[5, 7], [10, 0]], kind: 'repeat', reps: 3, goal: 88, why: 'Bending the same note up and down repeatedly in rhythm (a rock and blues signature) needs strength and timing at once; each repetition must reach the same pitch.', instr: 'Bend–release–bend–release in even notes on one pick stroke per pair, three times per bend. Tempo ladder to the goal. Pass: clean at the goal tempo with every peak on pitch.', watch: 'Later peaks falling short as the hand tires.', simplify: 'Half the tempo.' })]),
        S('bend-random', 'Any key, any box, any bend', 'fretboard', 'No warning.', [c => bendRandom(c), c => targetGuide(c, { prog: 'slowBlues', scale: 'minorPent', name: 'Slow blues: tell a story with bends, one idea per chorus' })]),
        S('bend-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => bendEtude(c), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: unison and over-bends at the peaks' })])
      ], [9, 10])
  ]
});
