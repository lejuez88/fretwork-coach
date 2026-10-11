// Two-hand tapping: a picking-hand finger hammers a note onto the fretboard and pulls off to notes the
// fretting hand holds, so one string plays a wide arpeggio at speed (Eddie Van Halen, and after him most
// rock and fusion players). From the first slow tap and pull-off, through tapped triplet arpeggios over a
// progression on every string, tapped pentatonic octaves, pedal figures, 16ths, tapped slides and
// descending cascades, to quintuplets and sextuplets across strings and keys, random access at tempo
// and an original study.
//
// Concept-first (CONTENT.md): the model is a tapping SHAPE on one string: three tones of a pitch set
// (a chord's tones, or the key's pentatonic) where L and M are fretted (index and ring/pinky, at most
// five frets apart) and T is tapped (the next tone up). `shapeOn` finds the shape closest to a hand
// position, so every tapped note is a chord tone (or scale tone) in every key by construction. A CELL is
// one beat of roles (T tap, L and M fretted) with legato marks: tap–pull–hammer triplets, tap–pull 8ths,
// 16ths, descending cascades, fives and sixes, pedal figures (the fretted note held while the taps move,
// or the tap held while the fretted notes move) and tapped slides. The composer `tapRun(c, spec)` builds
// an exercise from progression × cell × string plan (one string, a string per bar, across strings per
// beat) × beats per chord × key plan × source (chords or pentatonic box) × teaching mode.
import { OPEN, N, nameOf, make, mod12, slug, chordInfo, pentBox, byString, S, stage, entry, M, targetGuide } from '../lib.js';
import { rng } from './bending.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
/** Which pitch classes each note may sound (for the pitch check). */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const SN = ['', 'e', 'B', 'G', 'D', 'A', 'E'];
/** Frets on string s (lo..hi) whose pitch class is in pcs. */
export const tonesOn = (pcs, s, lo = 0, hi = 22) => { const o = []; for (let f = Math.max(0, lo); f <= Math.min(22, hi); f++) if (pcs.includes(mod12(pitch(s, f)))) o.push(f); return o; };
/**
 * A tapping shape for a pitch set on one string: L and M fretted (at most 5 frets apart), T tapped (the
 * next tone up, 2+ frets above M, at most 12 above L), closest to fret `near`. With slide: T2, the next
 * tone above T within 5 frets (a tapped slide target). Returns { s, L, M, T, T2 } or null.
 */
export function shapeOn(pcs, s, near = 7, { slide = false, minL = 1 } = {}) {
  const fs = tonesOn(pcs, s, minL, 22); let best = null;
  for (let i = 0; i + 2 < fs.length; i++) {
    const [L, Mf, T] = [fs[i], fs[i + 1], fs[i + 2]], T2 = fs[i + 3];
    if (Mf - L > 5 || T - Mf < 2 || T - L > 12) continue;
    if (slide && !(T2 != null && T2 - T <= 5)) continue;
    const d = Math.abs(L - near); if (!best || d < best.d) best = { s, L, M: Mf, T, T2, d };
  }
  return best;
}
/** One beat of roles: [role, technique]. T = tap, L/M = fretted; T2 = tapped-slide target. */
export const CELLS = {
  tp: { per: 2, roles: [['T', 't'], ['L', 'p']], unit: '8th notes', name: 'tap–pull 8ths' },
  tph: { per: 3, roles: [['T', 't'], ['L', 'p'], ['M', 'h']], unit: '8th-note triplets', name: 'tap–pull–hammer triplets' },
  tphp: { per: 4, roles: [['T', 't'], ['L', 'p'], ['M', 'h'], ['L', 'p']], unit: '16th notes', name: 'tap–pull–hammer–pull 16ths' },
  desc: { per: 3, roles: [['T', 't'], ['M', 'p'], ['L', 'p']], unit: '8th-note triplets', name: 'descending tap–pull–pull triplets' },
  five: { per: 5, roles: [['T', 't'], ['L', 'p'], ['M', 'h'], ['L', 'p'], ['M', 'h']], unit: 'quintuplets', name: 'quintuplets' },
  six: { per: 6, roles: [['T', 't'], ['L', 'p'], ['M', 'h'], ['T', 't'], ['L', 'p'], ['M', 'h']], unit: '16th-note sextuplets', name: 'sextuplets' },
  slide: { per: 4, roles: [['T', 't'], ['T2', '/'], ['L', 'p'], ['M', 'h']], unit: '16th notes', name: 'tapped slides' },
  pedalF: { per: 3, roles: [['Ti', 't'], ['L', 'p'], ['M', 'h']], unit: '8th-note triplets', name: 'fretted pedal, moving taps' },
  pedalT: { per: 3, roles: [['T', 't'], ['Li', 'p'], ['Mi', 'h']], unit: '8th-note triplets', name: 'tapped pedal, moving fretted notes' },
  fret: { per: 3, roles: [['L', null], ['M', 'h'], ['L', 'p']], unit: '8th-note triplets', name: 'fretting hand alone' }
};
/** Progressions as [semitones above the key root, chord suffix]: minor-key and major-key. */
export const PROGS = {
  minor: [[0, 'm'], [8, ''], [10, ''], [7, '']],             // i – ♭VI – ♭VII – V (Am F G E)
  minor2: [[0, 'm'], [10, ''], [8, ''], [10, '']],           // i – ♭VII – ♭VI – ♭VII
  minor3: [[0, 'm'], [5, 'm'], [8, ''], [7, '']],            // i – iv – ♭VI – V
  major: [[0, ''], [9, 'm'], [5, ''], [7, '']],              // I – vi – IV – V
  major2: [[0, ''], [7, ''], [9, 'm'], [5, '']],             // I – V – vi – IV
  long: [[0, 'm'], [5, 'm'], [10, ''], [3, ''], [8, ''], [5, 'm'], [7, ''], [7, '']]   // i iv ♭VII ♭III ♭VI iv V V
};
const pickProg = (c, id) => (id === 'auto' ? (c.minor ? 'minor' : 'major') : id === 'auto2' ? (c.minor ? 'minor3' : 'major2') : id || (c.minor ? 'minor' : 'major'));
export const chordsOf = (k, prog) => (PROGS[prog] || PROGS.minor).map(([o, q]) => nameOf(k + o) + q);
const PENT = k => [0, 3, 5, 7, 10].map(x => mod12(k + x));
const MAJPENT = k => [0, 2, 4, 7, 9].map(x => mod12(k + x));
/** The key's minor root (for the pentatonic source): the key itself in minor, the relative minor in major. */
const minorRoot = c => (c.minor ? mod12(c.key) : mod12(c.key - 3));

/* ------------------------------- Rendering ------------------------------- */
/** A pentatonic tapping shape on string s from box `box`: the box's two notes fretted, the tap an octave above L (oct) or the next scale tone above M. */
function pentShape(k, box, s, oct = true) {
  const B = byString(pentBox(k, box)); if (!B[s]) return null;
  const [L, Mf] = B[s], pcs = PENT(k);
  let T = oct ? L + 12 : (tonesOn(pcs, s, Mf + 3, Mf + 7)[0]);
  if (T == null || T > 22) T = tonesOn(pcs, s, Mf + 2, Mf + 7)[0];
  if (T == null || T > 22) return null;
  return { s, L, M: Mf, T };
}
/**
 * Render one bar (or part of one): `beats` beats of a cell on a shape (or per-beat shapes) from beat t0.
 * Returns false if a shape is missing. pcs: what every note may sound.
 */
function renderBeats(notes, cell, shapes, t0, beats, pcs, extra = {}) {
  const C = CELLS[cell], step = 1 / C.per;
  for (let b = 0; b < beats; b++) {
    const sh = shapes[b % shapes.length]; if (!sh) return false;
    C.roles.forEach(([role, x], i) => {
      let f;
      if (role === 'Ti') f = sh.taps[b % sh.taps.length];
      else if (role === 'Li' || role === 'Mi') f = sh.pairs[b % sh.pairs.length][role === 'Li' ? 0 : 1];
      else f = sh[role];
      notes.push(tag(N(sh.s, f, t0 + b + i * step, step, x), pcs));
    });
  }
  // the bar ends on a held note when asked (a landing): the last beat's L rings for its length
  if (extra.land) { const sh = shapes[0]; notes.push(tag(N(sh.s, sh.L, t0 + beats, extra.land, '~'), pcs)); }
  return true;
}

/* ------------------------------- The composer ------------------------------- */
/**
 * One tapping exercise from a spec:
 * { id, name ('{chords}', '{key}', '{string}', '{cell}'), method, src ('chords' | 'pent'), prog (PROGS id or 'auto'),
 *   chords (k => names, overrides prog), cell, strings (one string per bar, cycling; or across: true for one per beat),
 *   bpc (beats per chord), keys (offsets), boxes (pent source), oct (pent: octave taps), teach (chunking bars),
 *   answer (call and response: tapping in every other bar), reps, near, backing, domain, unit, goal, start, dl,
 *   why, instr, watch, simplify }.
 */
export function tapRun(c, spec) {
  const notes = [], used = [], lvl = c.lvl || 5;
  const cell = spec.cell || 'tph', bpc = spec.bpc || 4, strings = spec.strings || [2];
  const kBase = spec.src === 'pent' ? minorRoot(c) : mod12(c.key);
  let t = 0, bar = 0, near = spec.near || 7;
  const reps = spec.reps || 1;
  for (const off of spec.keys || [0]) {
    const k = mod12(kBase + off);
    if (spec.src === 'pent') {
      const pcs = PENT(k);
      for (let r = 0; r < reps; r++) for (const box of spec.boxes || [1]) for (const s of strings) {
        const sh = pentShape(k, box, s, spec.oct !== false); if (!sh) continue;
        if (!renderBeats(notes, cell, [sh], t, bpc, pcs)) return null;
        t += bpc; bar++;
      }
      used.push(`${nameOf(k)} minor`);
      continue;
    }
    const names = spec.chords ? spec.chords(k, c) : chordsOf(k, pickProg(c, spec.prog));
    for (let r = 0; r < reps; r++) names.forEach((nm, i) => {
      const ch = chordInfo(nm); if (!ch) return;
      const s = strings[(bar) % strings.length];
      if (spec.answer && bar % 2 === 0) { t += bpc; bar++; used.push(ch.name); return; }   // the call: your own picked phrase
      let shapes;
      if (cell === 'pedalT') {
        // the tap stays on the chord's root; the fretted pairs walk down the key's scale below it
        const sc = c.minor ? PENT(k) : MAJPENT(k), rootF = tonesOn([ch.pc], s, near + 4, near + 12)[0] || tonesOn([ch.pc], s, 5, 22)[0];
        const below = tonesOn(sc, s, Math.max(1, rootF - 9), rootF - 2).reverse(), pairs = [];
        for (let j = 1; j < below.length && pairs.length < 4; j++) if (below[j - 1] - below[j] <= 5) pairs.push([below[j], below[j - 1]]);
        if (!pairs.length || rootF == null) return;
        shapes = [{ s, T: rootF, pairs, L: pairs[0][0] }];
        renderBeats(notes, cell, shapes, t, bpc, [...new Set([...sc, ch.pc])]); t += bpc;
      } else {
        const sh = spec.across ? null : shapeOn(ch.pcs, s, near, { slide: cell === 'slide' });
        shapes = spec.across ? strings.map(x => shapeOn(ch.pcs, x, near, { slide: cell === 'slide' })) : [sh];
        if (shapes.some(x => !x)) return;
        if (cell === 'pedalF') shapes.forEach(x => { x.taps = tonesOn(ch.pcs, x.s, x.M + 2, Math.min(22, x.L + 14)).slice(0, 3); });
        if (spec.teach) {
          // chunking: the fretting hand alone (2 beats), tap and pull-off alone (2 beats), then the whole cell (4 beats)
          renderBeats(notes, 'fret', shapes, t, 2, ch.pcs); renderBeats(notes, 'tp', shapes, t + 2, 2, ch.pcs);
          renderBeats(notes, cell, shapes, t + 4, 4, ch.pcs); t += 8;
        } else { renderBeats(notes, cell, shapes, t, bpc, ch.pcs); t += bpc; }
      }
      near = shapes[0].L; bar++; used.push(ch.name);
    });
  }
  if (notes.length < 6 || notes.length > 400) return null;
  const uniq = [...new Set(used)];
  const fill = x => String(x).replace(/\{chords\}/g, uniq.join(' – ')).replace(/\{key\}/g, `${nameOf(kBase)} ${spec.src === 'pent' || c.minor ? 'minor' : 'major'}`)
    .replace(/\{string\}/g, strings.length > 1 ? `strings ${strings.join('-')}` : `the ${SN[strings[0]]} string`).replace(/\{cell\}/g, CELLS[cell].name);
  const backing = spec.backing === false || spec.src === 'pent' ? null : (spec.chords ? spec.chords(kBase, c) : chordsOf(kBase, pickProg(c, spec.prog)));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretting', method: spec.method, unit: spec.unit || CELLS[cell].unit,
    goal: spec.goal || 100, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify,
    ...(backing && !spec.keys ? { backing, chords: [...new Set(backing)] } : {}), tab: { notes }
  });
}
const T_ = (id, name, method, opts) => c => tapRun(c, { id, name, method, ...opts });

/* ------------------------------ Kept generators ------------------------------ */
/** Tap – pull-off – hammer-on triplets that outline each chord on one string (kept: used by the tests and older courses). */
export function evhTapTriplets(c, { chords = ['Am', 'F', 'G', 'E'], string = 2, sixteenths = false } = {}) {
  const notes = [], used = [];
  let t = 0;
  for (const name of chords) {
    const ch = chordInfo(name); if (!ch) continue;
    const frets = []; for (let f = 1; f <= 22; f++) if (ch.pcs.includes(mod12(OPEN[string] + f))) frets.push(f);
    const i = frets.findIndex(f => f >= 4 && f <= 10);
    if (i < 0 || i + 2 >= frets.length) continue;
    const [L, Mf, T] = [frets[i], frets[i + 1], frets[i + 2]];
    const cell = sixteenths ? [[T, 't'], [L, 'p'], [Mf, 'h'], [L, 'p']] : [[T, 't'], [L, 'p'], [Mf, 'h']];
    const step = sixteenths ? 0.25 : 1 / 3;
    for (let b = 0; b < 4; b++) cell.forEach(([f, x], k) => notes.push(tag(N(string, f, t + b + k * step, step, x), ch.pcs)));
    t += 4; used.push(ch.name);
  }
  if (!notes.length) return null;
  return make(c, {
    id: `evh-tap-${sixteenths ? '16' : '3'}-${slug(used.join(''))}`, name: `Tapped ${sixteenths ? '16th-note' : 'triplet'} arpeggios: ${used.join(' – ')} (Van Halen style)`, domain: 'fretting',
    unit: sixteenths ? '16th notes' : '8th-note triplets', goal: sixteenths ? 104 : 112, start: 50, minutes: 5, dl: 1,
    why: 'Eddie Van Halen made two-hand tapping a rock technique: the picking hand taps a high note, pulls off to a fretted note and the fretting hand hammers the next, so one string plays a whole chord at speed.',
    instr: `Tap (T) with the picking-hand middle or index finger, pull off sideways to the index finger's fret so the note sounds, then hammer the middle note. One chord per bar on string ${string}; the chord boxes show which notes you are outlining. Rest the picking-hand palm on the low strings to keep them quiet. Pass: four bars in time with every tapped note as loud as the hammered one.`,
    watch: 'The tapped pull-off being weaker than the hammer: flick the string down toward the floor as you release.', simplify: 'Tap and pull-off only, in 8th notes, one chord.',
    chords: used, backing: used, tab: { notes }
  });
}
/** Tapped octave extensions of the pentatonic box (kept). */
export function evhPentTap(c) {
  const key = minorRoot(c), pcs = PENT(key);
  // box 1, or (when box 1 sits too high for the octave tap) the box just below it
  const bx = [1, 5, 4].find(b => { const X = byString(pentBox(key, b)); return [1, 2, 3].every(s => X[s] && X[s][0] + 12 <= 22); });
  if (!bx) return null;
  const B = byString(pentBox(key, bx));
  const notes = []; let t = 0;
  for (const s of [1, 2, 3, 2]) {
    const [a, b] = B[s];
    for (let r = 0; r < 2; r++) { notes.push(tag(N(s, a + 12, t, 1 / 3, 't'), pcs), tag(N(s, a, t + 1 / 3, 1 / 3, 'p'), pcs), tag(N(s, b, t + 2 / 3, 1 / 3, 'h'), pcs)); t += 1; }
  }
  return make(c, {
    id: 'evh-pent-tap', name: `Tapped pentatonic octaves (${nameOf(key)} minor, box ${bx})`, domain: 'fretting', unit: '8th-note triplets', goal: 112, start: 50, minutes: 5, dl: 1,
    why: 'Tapping the octave above the box turns a familiar pentatonic shape into wide, fast Van Halen-style licks without learning a new scale.',
    instr: 'On each string: tap 12 frets above the lower box note, pull off to it, hammer the upper box note. Two beats per string: 1, 2, 3, then back to 2. Pass: the whole run twice in time, the tap landing right behind the fret wire.',
    watch: 'Tapping slightly off the fret (the tapped note goes sharp or dull).', simplify: 'String 1 only.', tab: { notes }
  });
}

/* ------------------------------ Music: studies ------------------------------ */
// A study as bars: [chord offset, suffix, cell, string(s) (array = across, per beat), beats].
const STUDY_I = [[0, 'm', 'tph', [2], 4], [8, '', 'tph', [2], 4], [10, '', 'tphp', [2], 4], [7, '', 'desc', [2], 4], [0, 'm', 'tph', [3], 4], [5, 'm', 'tph', [3], 4], [10, '', 'pedalF', [2], 4], [7, '', 'tph', [3, 2, 1, 2], 4]];
const STUDY_A = [[0, 'm', 'six', [2], 4], [8, '', 'six', [2], 4], [3, '', 'five', [3], 4], [10, '', 'slide', [2], 4], [5, 'm', 'tph', [3, 2, 1, 2], 4], [8, '', 'desc', [1, 2, 3, 2], 4], [7, '', 'tphp', [2], 4], [7, '', 'pedalF', [1], 4]];
const STUDY_M = [[0, 'm', 'tph', [2], 4], [8, '', 'tph', [2], 4], [10, '', 'tphp', [3], 4], [0, 'm', 'six', [3, 2, 1, 2], 4], [5, 'm', 'five', [2], 4], [3, '', 'slide', [1], 4], [8, '', 'desc', [3, 2, 1, 1], 4], [7, '', 'pedalF', [2], 4],
  [0, 'm', 'six', [1], 4], [10, '', 'six', [2], 4], [8, '', 'tphp', [3], 4], [7, '', 'six', [3, 2, 1, 2], 4], [5, 'm', 'tph', [2], 4], [3, '', 'desc', [2], 4], [7, '', 'slide', [2], 4], [0, 'm', 'tph', [2], 2]];
function studyRun(c, plan, { id, name, method = 'transfer', goal, start, why, instr, watch, simplify }) {
  const k = c.minor ? mod12(c.key) : mod12(c.key - 3), notes = [], names = []; let t = 0, near = 7;
  for (const [o, q, cell, ss, beats] of plan) {
    const nm = nameOf(k + o) + q, ch = chordInfo(nm); if (!ch) return null;
    const shapes = ss.map(s => shapeOn(ch.pcs, s, near, { slide: cell === 'slide' }));
    if (shapes.some(x => !x)) return null;
    if (cell === 'pedalF') shapes.forEach(x => { x.taps = tonesOn(ch.pcs, x.s, x.M + 2, Math.min(22, x.L + 14)).slice(0, 3); });
    if (!renderBeats(notes, cell, shapes, t, beats, ch.pcs)) return null;
    t += beats; near = shapes[0].L; names.push(ch.name);
  }
  const last = notes[notes.length - 1]; notes.push(tag(N(last.s, last.f, t, 2, '~'), ALLOW.get(last)));
  return make(c, {
    id, name: `${name} (${nameOf(k)} minor)`, domain: 'improv', method, unit: 'mixed groupings', goal, start, minutes: 8, dl: 1,
    backing: names, chords: [...new Set(names)], why, instr, watch, simplify, tab: { notes }
  });
}
export const tapStudyI = c => studyRun(c, STUDY_I, { id: 'tap-study-8', name: 'Study: an 8-bar tapped progression', goal: 96, start: 52,
  why: 'An original 8-bar piece that joins the intermediate moves: triplet arpeggios, 16ths, a descending bar, a fretted pedal and a last bar across three strings, all outlining a minor-key progression.',
  instr: 'Learn it two bars at a time; name each bar’s chord and cell before you play it. Then play the eight bars as one piece with the backing. Pass: two times through at the goal tempo without a gap at the bar lines.',
  watch: 'Rushing the bar where the cell changes.', simplify: 'The first four bars.' });
export const tapStudyA = c => studyRun(c, STUDY_A, { id: 'tap-study-adv', name: 'Study: sixes, fives, slides and cascades', goal: 84, start: 46,
  why: 'An original 8-bar piece at the advanced level: sextuplets, a quintuplet bar (the push-pull grouping Van Halen liked), a tapped slide, a cascade across strings and a pedal ending.',
  instr: 'Learn it bar by bar, then in pairs of bars. Count the fives aloud ("1-2-3-4-5") before you tap them. Pass: the study twice through at the goal tempo with every bar line in time.',
  watch: 'The quintuplet bar turning into 16ths.', simplify: 'Bars 1, 2, 7 and 8.' });
export const tapEtude = c => studyRun(c, STUDY_M, { id: 'tap-capstone-etude', name: 'Capstone study: 16 bars of tapping', goal: 92, start: 50,
  why: 'An original 16-bar piece that uses the whole path: triplets, 16ths, fives and sixes, slides, cascades, pedals, one string and three, over a minor-key progression that ends on the dominant.',
  instr: 'Learn it four bars at a time; say each bar’s chord and cell first. Then rewrite four bars with your own cells and strings over the same chords. Pass: the study at the goal tempo, then your rewritten version once.',
  watch: 'Tension building up through the 16 bars: shake out after each four.', simplify: 'Bars 1–8.' });

/** Random access: a random chord of the key, string and cell every bar (interleaving). */
export function tapRandom(c) {
  const r = rng(907 + (c.lvl || 9)), k = mod12(c.key), notes = [], names = [];
  const pool = c.minor ? [[0, 'm'], [5, 'm'], [7, ''], [3, ''], [8, ''], [10, '']] : [[0, ''], [5, ''], [7, ''], [9, 'm'], [2, 'm'], [4, 'm']];
  const cells = ['tph', 'tphp', 'six', 'desc', 'five'];
  let t = 0, near = 7;
  for (let bar = 0; bar < 8; bar++) {
    const [o, q] = pool[Math.floor(r() * pool.length)], s = 1 + Math.floor(r() * 3), cell = cells[Math.floor(r() * cells.length)];
    const ch = chordInfo(nameOf(k + o) + q); const sh = ch && shapeOn(ch.pcs, s, near); if (!sh) return null;
    renderBeats(notes, cell, [sh], t, 4, ch.pcs); t += 4; near = sh.L;
    names.push(`${ch.name} on the ${SN[s]} string, ${CELLS[cell].name}`);
  }
  return make(c, {
    id: 'tap-random', name: `Random access: a new chord, string and grouping every bar (${nameOf(k)} ${c.minor ? 'minor' : 'major'})`, domain: 'fretboard', method: 'interleaving', unit: 'mixed groupings', goal: 96, start: 54, minutes: 5, dl: 1, tab: { notes },
    why: 'At mastery level a tapped arpeggio is a vocabulary you call up anywhere: an unpredictable chord, string and grouping every bar makes it automatic instead of a rehearsed run.',
    instr: `${names.join(' → ')}. Read only the names, not the tab: find the shape, then tap. Pass: all 8 bars in time from the names alone.`,
    watch: 'Falling back to the B string.', simplify: 'Triplets in every bar.'
  });
}

/* --------------------------------- The path --------------------------------- */
const HOW = 'Tap with the picking-hand middle finger (hold the pick between thumb and index), straight down just behind the fret wire, then pull off sideways and down so the fretted note sounds; the fretting hand hammers its notes without a pick stroke. Rest the picking-hand palm on the lower strings and let the fretting-hand index lie lightly across the higher ones to keep them silent. ';
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'tapping', kind: 'technique', title: 'Two-hand tapping', domain: 'fretting',
  re: /tapping|tapped|two.?hand(ed)? tap|\btaps?\b|eruption/,
  aliases: ['finger tapping', 'right-hand tapping', 'tapped arpeggios'],
  summary: 'A picking-hand finger taps notes onto the fretboard and pulls off to fretted notes: from the first slow tap and pull-off, through tapped triplet arpeggios over progressions on every string, pentatonic octave taps, pedal figures and 16ths, to fives and sixes, tapped slides and cascades across strings, random access at tempo and an original study.',
  prereqs: ['pentatonic'],
  sources: ['https://guitarplayer.com/lessons/eddie-van-halen-tapping', 'https://www.premierguitar.com/lessons/cram-session-two-hand-tapping', 'https://www.premierguitar.com/lessons/electric-etudes-eddie-van-halen-techniques', 'https://guitarworld.com/lessons/6-guitar-tricks-you-can-learn-from-eddie-van-halen', 'https://guitarworld.com/lessons/5-ways-to-make-two-hand-tapping-work-for-you'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Tap, pull, hammer',
      'Tap–pull–hammer triplets on the B string over i–♭VI–♭VII–V at 70 BPM, one chord per bar, with the tapped and pulled-off notes as loud as the hammered one and the other strings silent; find each chord’s three notes on the B string from memory.', [
        S('tap-motion', 'The motion in pieces', 'fretting', 'Fretting hand alone, tap and pull alone, then together.', [
          T_('tap-teach', 'Tapping in pieces: fretting hand, tap and pull, then the triplet ({chords})', 'chunking', { teach: true, prog: 'auto', strings: [2], cell: 'tph', goal: 70, start: 40, why: 'A tapped triplet is two motions joined: the fretting hand’s hammer and pull, and the tapping finger’s tap and pull-off. Each is practised alone before they join, so neither hand has to learn both at once.', instr: HOW + 'Each chord gets two bars: beats 1–2 the fretting hand alone (pick L, hammer M, pull to L); beats 3–4 tap T and pull off to L; then a full bar of tap–pull–hammer triplets. Pass: every piece clean, then the full bars in time.', watch: 'The tap landing on top of the fret instead of just behind it.', simplify: 'Only the first chord.' }),
          T_('tap-pull', 'Tap and pull off, counting the clean ones ({chords}, {string})', 'accurate-reps', { cell: 'tp', prog: 'auto', strings: [2], goal: 72, start: 42, why: 'The pull-off from the tap is the weak spot of every beginner’s tapping: the note after the tap dies. Counting only clean pull-offs (as loud as the tap) trains the sideways flick.', instr: HOW + 'Tap T, pull off to L: 8th notes, one chord a bar. Count a rep only when both notes are equally loud. Pass: 16 clean reps in a row.', watch: 'Lifting the tapping finger straight up: the fretted note doesn’t sound.', simplify: 'Quarter notes.' })], ST(
          'Tapping adds a third "finger" on the fretboard: the picking hand hammers a note (the tap) and pulls off to a note the fretting hand holds, which can hammer to a third note. One string then plays a whole chord with almost no picking.',
          'It is the sound of Eddie Van Halen’s "Eruption" and of countless rock and fusion solos: wide arpeggios at a speed picking can’t reach.',
          ['The tap is a hammer-on from nowhere: strike straight down just behind the fret.', 'The pull-off is a small pluck: flick the string sideways as you release.', 'The fretted notes are usually played by the index and the ring or little finger.'])),
        S('tap-hear', 'Hear it even', 'ear', 'Three equal notes; sing the arpeggio.', [
          T_('tap-even', 'Listen for three equal notes: tap–pull–hammer triplets ({chords})', 'external-focus', { cell: 'tph', prog: 'auto', strings: [2], goal: 70, start: 40, why: 'Good tapping sounds like three picked notes of the same volume. Listening to the evenness (instead of watching the hands) is the fastest way to fix a weak pull-off or a late hammer.', instr: HOW + 'Play each bar and listen only: are the three notes the same volume and the same length? If the pulled-off note is soft, flick harder; if the hammer is late, hammer from closer. Pass: every bar heard as an even triplet.', watch: 'A loud tap and two quiet fretted notes.', simplify: 'One chord, over and over.' }),
          T_('tap-sing', 'Sing it first: each chord’s three notes, then tap them ({chords})', 'audiation', { cell: 'tp', prog: 'auto', strings: [2], bpc: 2, reps: 2, goal: 70, start: 40, why: 'Singing the arpeggio before tapping puts the chord’s sound in the ear, so the hands aim at a sound you already hear, and wrong notes stand out at once.', instr: 'Before each pass, sing the three notes of each chord (low, middle, high) with the backing. Then tap them: tap and pull-off, two beats per chord. Pass: you can sing every chord’s arpeggio and the tapped notes match it.', watch: 'Tapping the next fret by habit when the chord changes.', simplify: 'Only the first two chords.' })], ST(
          'An even tapped triplet has three notes of the same volume and length, like a picked arpeggio. The usual faults are a soft pulled-off note and a hammered note that comes late.',
          'Hearing the problem is quicker than seeing it: the hands correct themselves when you listen for evenness.',
          ['A louder pull-off comes from flicking the string toward the floor, not from pressing harder.', 'Each chord’s three tapped notes are its root, 3rd and 5th in some order.'])),
        S('tap-where', 'Where the notes are', 'fretboard', 'Chord tones on one string, then three strings.', [
          T_('tap-find', 'From memory: each chord’s three notes on {string} ({chords})', 'retrieval', { cell: 'tph', prog: 'auto', strings: [2], goal: 70, start: 40, why: 'A tapped arpeggio is a chord laid out along one string. Finding its three notes from the chord name (instead of reading frets) is what later lets you tap over any progression.', instr: 'Cover the tab. For each chord, name its notes, find them on the B string near the 7th fret (lowest two for the fretting hand, the highest one for the tap), then play a bar. Pass: all four chords from memory.', watch: 'Using the same fret pattern for every chord: major and minor shapes differ.', simplify: 'Look once, then cover.' }),
          T_('tap-three-strings', 'The same arpeggios on a new string every bar: {string} ({chords})', 'variable', { cell: 'tph', prog: 'auto', strings: [1, 2, 3], goal: 70, start: 40, why: 'The same chord on another string has another fret pattern. Changing string every bar makes you rebuild the shape each time: variable practice that builds a flexible map instead of one memorised spot.', instr: HOW + 'Bar 1 on the e string, bar 2 on the B, bar 3 on the G, and so on. Mute the unused strings with both hands. Pass: every bar clean and in time.', watch: 'The G-string bars ringing into the B string.', simplify: 'The e and B strings only.' })], ST(
          'A triad on one string is three frets, a few frets apart; the order of root, 3rd and 5th depends on the chord and where you play it. Each string has its own pattern for the same chord.',
          'Knowing the chord tones on every string turns tapping from a memorised trick into something you can use over any song.',
          ['On one string, a major triad’s notes are 4, 3 and 5 frets apart in root position; a minor triad’s 3, 4 and 5.', 'Moving a shape to another string changes the frets because the open strings are tuned in 4ths (and a 3rd between G and B).'])),
        S('tap-first-music', 'First music', 'improv', 'A tapped progression; tapped answers.', [
          T_('tap-first-prog', 'First tapped progression with the band ({chords})', 'transfer', { cell: 'tph', prog: 'auto', strings: [2], reps: 2, goal: 72, start: 42, why: 'Tapping over a backing track makes the arpeggios music: each bar outlines the chord the band is playing, so you hear the harmony move.', instr: HOW + 'Two times through the progression with the backing, one chord per bar. Pass: eight bars in time with every chord change on beat 1.', watch: 'Stopping at the chord changes.', simplify: 'Half-time: tap–pull 8ths.' }),
          T_('tap-call', 'Call and response: your phrase, then a tapped answer ({chords})', 'transfer', { cell: 'tph', prog: 'auto', strings: [2], answer: true, reps: 2, goal: 72, start: 42, why: 'Players use tapping as an answer to a picked phrase, not as a whole solo. Alternating your own picked bar with a tapped bar teaches the switch between picking and tapping.', instr: 'Odd bars: play your own short picked phrase with the pick. Even bars: tap the written arpeggio of that bar’s chord (palm the pick or hold it tucked). Pass: four calls and tapped answers in time.', watch: 'The switch from pick to tap costing a beat.', simplify: 'Answer with tap–pull 8ths.' })], ST(
          'Each bar’s tapped notes outline the chord of that bar, so the arpeggios follow the harmony and you can hear the progression in the tapping alone.',
          'Tapping is most effective as a contrast: a tapped burst after a picked phrase.',
          ['Change shape exactly on beat 1 of each bar.', 'Tuck the pick under the middle finger (or palm it) so the index or middle finger is free to tap.']))
      ], [1, 3]),
    stage('intermediate', 'Arpeggios across the neck',
      'Tapped triplet and 16th-note arpeggios over minor- and major-key progressions on the e, B and G strings at 100 BPM, pentatonic octave taps, both pedal figures, and an 8-bar tapped study with the backing.', [
        S('tap-prog', 'Progressions in triplets and 16ths', 'fretting', 'One chord a bar, two groupings.', [
          M('accurate-reps', c => evhTapTriplets(c, { chords: chordsOf(mod12(c.key), c.minor ? 'minor' : 'major') })),
          T_('tap-16', 'Tapped 16ths: tap–pull–hammer–pull ({chords}, {string})', 'edge', { cell: 'tphp', prog: 'auto', strings: [2], reps: 2, goal: 100, start: 56, why: '16ths put four notes in the beat and bring the pulled-off note back at the end of each group: a faster, rolling version of the triplet that most tapping licks use.', instr: HOW + 'Tap, pull, hammer, pull: four even 16ths a beat. Tempo ladder: +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Accenting only the tap: all four notes even.', simplify: 'Triplets at the same tempo.' })], ST(
          'The same three notes can be played as triplets (tap, pull, hammer) or as 16ths (tap, pull, hammer, pull). The grouping changes the feel, not the chord.',
          'Switching groupings is how players make tapped lines sound like phrases instead of a loop.',
          ['Triplets put the tap on every beat; 16ths do too, with one extra pull-off.', 'Keep the tapping hand still between taps: the fingertip barely leaves the string.'])),
        S('tap-strings', 'Every string', 'fretboard', 'The G string; strings mixed.', [
          T_('tap-g', 'On the G string: {chords}', 'variable', { cell: 'tph', prog: 'auto2', strings: [3], reps: 2, goal: 96, start: 54, why: 'Lower strings are thicker and need a firmer tap and more muting on both sides. Playing a new progression on the G string varies string, pattern and harmony together.', instr: HOW + 'One chord a bar on the G string. Mute the B and e with the fretting-hand fingertips and the low strings with the picking-hand palm. Pass: eight bars clean with no other string ringing.', watch: 'The B string ringing after the pull-offs.', simplify: 'Two chords.' }),
          T_('tap-mix', 'Interleaved: e, B and G strings in turn ({chords})', 'interleaving', { cell: 'tph', prog: 'auto', strings: [1, 3, 2], reps: 2, goal: 96, start: 54, why: 'Changing string every bar in a mixed order (e, G, B) is harder than one string at a time, and that difficulty is what makes the shapes stick.', instr: HOW + 'Bar by bar: e string, G string, B string, then again. Pass: eight bars in time.', watch: 'Pausing before the G-string bars.', simplify: 'Two strings.' })], ST(
          'Each string holds every chord’s tones in a different fret pattern. Moving a progression between strings keeps the harmony but changes the hand shapes.',
          'Using several strings gives tapped lines range and lets you move between registers in a solo.',
          ['The G string needs a firmer tap than the e string.', 'The fretting-hand fingertips mute the higher strings; the picking-hand palm mutes the lower ones.'])),
        S('tap-pent', 'Tapping the pentatonic', 'fretboard', 'Octave taps on the box; the next box note.', [
          M('variable', c => evhPentTap(c)),
          T_('tap-pent-next', 'Tap the next scale note: boxes 1 and 2, strings 1-2-3 ({key} pentatonic)', 'variable', { src: 'pent', boxes: [1, 2], strings: [1, 2, 3], oct: false, cell: 'tph', bpc: 2, goal: 96, start: 54, why: 'Instead of the octave, the tap can add the next scale note above the box: a three-note-per-string pentatonic that stretches the box without leaving the scale.', instr: HOW + 'On each string: the two box notes fretted, the tap on the next pentatonic note above them. Two beats per string, box 1 then box 2. Pass: both boxes clean.', watch: 'Tapping a fret that isn’t in the scale.', simplify: 'Box 1 only.' })], ST(
          'Tapping works on scales too: the fretting hand plays the two notes of a pentatonic box on one string, and the tap adds the octave of the lower note or the next scale note above.',
          'It turns the box you already know into wide, fast Van Halen-style licks without learning new shapes.',
          ['The octave of any note is 12 frets above it on the same string.', 'Every tapped note still belongs to the minor pentatonic, so it sounds right over the same chords.'])),
        S('tap-pedal', 'Pedal figures', 'fretting', 'One note holds, the others move.', [
          T_('tap-pedal-fret', 'Fretted pedal: the taps climb the chord while the fretted notes hold ({chords})', 'variable', { cell: 'pedalF', prog: 'auto', strings: [2], reps: 2, goal: 96, start: 54, why: 'In a pedal figure one hand stays put while the other moves. Here the fretting hand holds its two notes while the tap climbs through the chord tones above: a wide, sweeping arpeggio Van Halen used in his solos.', instr: HOW + 'Beat 1 taps the nearest chord tone above, beat 2 the next one up, beat 3 the next; then it starts again. The fretting hand never moves. Pass: eight bars clean.', watch: 'The tapping finger missing the higher frets: look at the target before each beat.', simplify: 'Only the first two taps.' }),
          T_('tap-pedal-tap', 'Tapped pedal: the tap holds the root while the fretted notes walk down the scale ({chords})', 'external-focus', { cell: 'pedalT', prog: 'auto', strings: [2], reps: 2, goal: 96, start: 54, why: 'The reverse pedal keeps the tapped note on the chord’s root while the fretting hand walks down the scale under it: the tap becomes a ringing drone that the melody moves against.', instr: HOW + 'The tap stays on the chord root; each beat, the fretting hand moves to the next pair of scale notes down. Listen for the root ringing out the same every beat while the lower notes move. Pass: eight bars with the root even every time.', watch: 'The tap drifting off the root fret.', simplify: 'Two pairs per chord.' })], ST(
          'A pedal is a note that repeats while other notes move. With tapping, either hand can hold the pedal: the fretting hand (the taps move) or the tap (the fretted notes move).',
          'Pedal figures give tapped lines melody and direction instead of the same arpeggio over and over.',
          ['A fretted pedal outlines the chord upward through its tones.', 'A tapped pedal on the root sounds like a drone; the moving notes come from the key’s pentatonic scale.'])),
        S('tap-recall', 'From memory', 'fretboard', 'Called chords on the G string.', [
          T_('tap-called', 'From memory: called chords on the G string ({chords})', 'retrieval', { cell: 'tph', prog: 'minor3', strings: [3], goal: 94, start: 52, why: 'Hearing a chord name and finding its tapped shape at once is the skill that lets you tap over any song. Recalling it on the G string, the least familiar, makes the retrieval real.', instr: 'Cover the tab. Read the chord name, find its three notes on the G string between frets 4 and 16, then tap a bar. Pass: all four chords from memory, in time.', watch: 'Defaulting to the B-string frets.', simplify: 'Look at the first bar, then cover.' }),
          T_('tap-major', 'Interleaved keys: a major-key progression, then its relative minor ({chords})', 'interleaving', { cell: 'tph', strings: [2], chords: (k, c) => (c.minor ? [...chordsOf(mod12(k + 3), 'major'), ...chordsOf(k, 'minor')] : [...chordsOf(k, 'major'), ...chordsOf(mod12(k - 3), 'minor')]), goal: 94, start: 52, why: 'A major-key and a minor-key progression share most of their chords but in a new order and with a new home. Alternating them mixes shapes you know in a new sequence.', instr: HOW + 'Bars 1–4: the major-key progression. Bars 5–8: the relative minor’s. Pass: all eight bars without a pause between the halves.', watch: 'Confusing the major and minor shapes of the same root.', simplify: 'Only the first four bars.' })], ST(
          'Each chord’s tapped shape can be rebuilt from its name: the chord tones, found on the chosen string near your hand.',
          'Recalling shapes from names (instead of reading tab) is what makes tapping usable over real songs.',
          ['A major key and its relative minor use the same notes; their progressions share chords.', 'The G string sits a major 3rd below the B string, so its frets are four higher for the same note.'])),
        S('tap-music', 'In music', 'improv', 'An 8-bar study; a solo with tapped answers.', [c => tapStudyI(c),
          c => targetGuide(c, { prog: c.minor ? 'minorRock' : 'axis', scale: c.minor ? 'minorPent' : 'majorPent', name: 'Solo over the progression: pick a phrase, answer it with a bar of tapping' })], ST(
          'In a solo, tapping works best as a burst that answers a picked phrase, landing on a chord tone of the next bar.',
          'It keeps tapping musical: a contrast in the solo instead of a trick played for its own sake.',
          ['Land the last note of a tapped bar on a chord tone of the next chord.', 'Leave space after a tapped burst.']))
      ], [4, 6]),
    stage('advanced', 'Fives, sixes, slides and cascades',
      'Tapped quintuplets and sextuplets over progressions at 84 BPM, tapped slides and descending cascades across the top three strings, arpeggios across strings per beat in four keys, and an 8-bar advanced study.', [
        S('tap-odd', 'Fives and sixes', 'fretting', 'Odd and dense groupings.', [
          T_('tap-six', 'Sextuplets: two tapped triplets a beat ({chords})', 'edge', { cell: 'six', prog: 'auto', strings: [2], reps: 2, goal: 84, start: 48, why: 'Sextuplets double the triplet: six notes a beat, two taps. This is the speed of most tapping showcases, and it needs a relaxed tapping hand.', instr: HOW + 'Tempo ladder from the start tempo, +4 BPM after each clean pass. Pass: eight bars clean at the goal tempo.', watch: 'The tapping forearm tensing up: shake out between passes.', simplify: 'Triplets at double the tempo.' }),
          T_('tap-five', 'Quintuplets: five notes against the beat ({chords})', 'accurate-reps', { cell: 'five', prog: 'auto2', strings: [2], reps: 2, goal: 76, start: 44, why: 'Five notes a beat (tap, pull, hammer, pull, hammer) don’t line up with the usual groupings: the push-pull rhythm Van Halen liked, with the tap landing on every beat.', instr: HOW + 'Count "1-2-3-4-5" per beat; the tap is always on 1. Count only bars where the tap lands exactly on the click. Pass: 8 clean bars in a row.', watch: 'Quintuplets drifting into 16ths.', simplify: 'Say the count while tapping slowly.' })], ST(
          'Fives and sixes change how many notes fit in a beat: sextuplets are two tapped triplets, quintuplets add a hammer-pull after the triplet so the tap still falls on the beat.',
          'Odd groupings give a tapped line forward motion; dense ones give it speed.',
          ['Sextuplet = 6 notes a beat; quintuplet = 5.', 'Keep the tap on the beat and let the fretting hand fill the rest.'])),
        S('tap-slide', 'Slides and cascades', 'fretting', 'Tapped slides; descending runs across strings.', [
          T_('tap-slides', 'Tapped slides: tap, slide up to the next chord tone, pull off ({chords})', 'variable', { cell: 'slide', prog: 'auto', strings: [2], reps: 2, goal: 84, start: 48, why: 'Sliding the tapping finger to the next chord tone before the pull-off adds a fourth note and a vocal swoop, a move from Van Halen’s solos.', instr: HOW + 'Tap T, keep the pressure and slide up to the next chord tone, then pull off to L and hammer M: four 16ths a beat. Pass: every slide arriving in tune.', watch: 'Losing pressure during the slide: the note dies.', simplify: 'Tap–pull–hammer without the slide.' }),
          T_('tap-cascade', 'Cascades: descending tap–pull–pull across strings e-B-G ({chords})', 'variable', { cell: 'desc', across: true, prog: 'auto', strings: [1, 2, 3], reps: 2, goal: 84, start: 48, why: 'A cascade taps the top note and pulls off twice, falling through the chord, then moves down a string: the falling run that ends many tapping passages.', instr: HOW + 'Each beat on the next string down (e, B, G, then e again): tap, pull to M, pull to L. Pass: eight bars clean with no ringing strings.', watch: 'The previous string ringing under the next one.', simplify: 'The e and B strings only.' })], ST(
          'A tapped slide moves the tap along the string to the next chord tone before the pull-off. A cascade reverses the triplet: tap, then two pull-offs downward.',
          'Both add direction: the slide swoops up, the cascade falls through the chord.',
          ['Keep the tapping finger pressed while it slides.', 'In a cascade the fretting hand holds both notes before the tap.'])),
        S('tap-across', 'Across strings and keys', 'fretboard', 'Per-beat strings; four keys; a long progression.', [
          T_('tap-across-beat', 'Across strings every beat: G, B, e, B ({chords})', 'interleaving', { cell: 'tph', across: true, prog: 'auto', strings: [3, 2, 1, 2], reps: 2, goal: 84, start: 48, why: 'Changing string on every beat while the chord stays turns three one-string shapes into one arpeggio across the neck.', instr: HOW + 'Each beat on the next string of the pattern G, B, e, B. Pass: eight bars clean.', watch: 'Late string changes.', simplify: 'One string a bar.' }),
          T_('tap-keys', 'Four keys around the cycle of fourths ({chords})', 'interleaving', { cell: 'tph', prog: 'auto', strings: [2], keys: [0, 5, 10, 3], goal: 84, start: 48, why: 'In a new key every shape moves. Four keys a fourth apart make you rebuild them each time instead of playing from finger memory.', instr: HOW + 'The progression in four keys, a fourth apart. Pass: all four keys without stopping.', watch: 'Playing the old key’s frets.', simplify: 'Two keys.' }),
          T_('tap-long', 'From memory: an 8-chord progression on the B string ({chords})', 'retrieval', { cell: 'tphp', prog: 'long', strings: [2], goal: 84, start: 48, why: 'A longer progression with chords you don’t expect makes the shapes come from the chord names, not from habit.', instr: 'Cover the tab. Read each chord name, find the shape on the B string near the last one, tap a bar of 16ths. Pass: all eight chords from memory.', watch: 'Jumping around the neck: stay near the last shape.', simplify: 'The first four chords.' })], ST(
          'Combining strings and keys makes the shapes portable: one chord across three strings, the same progression in any key.',
          'Real songs come in every key; flexible shapes are what let you tap anywhere.',
          ['A cycle of fourths moves each chord root up a fourth.', 'When chords change, stay near the last shape (voice leading).'])),
        S('tap-adv-music', 'In music', 'improv', 'An advanced study; tapping inside a solo.', [c => tapStudyA(c),
          c => targetGuide(c, { prog: c.minor ? 'minorRock' : 'axis', scale: c.minor ? 'minorPent' : 'majorPent', name: 'Solo: pentatonic phrases with a tapped run at the end of every fourth bar' })], ST(
          'At this level tapping becomes part of a solo’s phrasing: a run at the end of a phrase, landing on a chord tone.',
          'It keeps tapping as a musical event rather than a separate exercise.',
          ['Lead into the tapped run from a picked note on the same string.', 'End the run on a long note with vibrato.']))
      ], [7, 8]),
    stage('mastery', 'Your tapping voice',
      'Sextuplets across strings at 96 BPM in two keys, any called chord, string and grouping on the spot, tapping from memory in six keys, and your own 16-bar tapping piece.', [
        S('tap-perf', 'At performance tempo', 'fretting', 'Speed and random access.', [
          T_('tap-perf', 'Performance tempo: sextuplets across strings in two keys ({chords})', 'edge', { cell: 'six', across: true, prog: 'auto', strings: [2, 1, 2, 3], keys: [0, 7], goal: 96, start: 54, why: 'Sextuplets across strings in two keys: the speed, accuracy and muting of a full tapping passage at once.', instr: HOW + 'Tempo ladder, +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Tension in the tapping hand.', simplify: 'One key.' }),
          c => tapRandom(c)], ST(
          'Mastery is speed with control, and shapes you can call up in any order.',
          'Performance and improvisation both need tapping to be automatic.',
          ['Raise the tempo only after a clean pass.', 'Random order is harder to practise and lasts longer.'])),
        S('tap-recall-m', 'From memory', 'fretboard', 'Six keys; improvising.', [
          T_('tap-six-keys', 'From memory: the progression in six keys on the G and B strings', 'retrieval', { cell: 'tphp', prog: 'auto', strings: [3, 2], keys: [0, 5, 10, 3, 8, 1], goal: 92, start: 52, why: 'The same progression in six keys, from memory, on two strings: retrieval at tempo across the whole neck.', instr: 'Cover the tab. For each key, name the four chords, then tap them (G string, B string in turn). Pass: all six keys in time.', watch: 'A pause at each new key.', simplify: 'Three keys.' }),
          c => targetGuide(c, { prog: c.minor ? 'minorRock' : 'axis', scale: c.minor ? 'minorPent' : 'majorPent', name: 'Improvise: two choruses, the second answering every phrase with tapping' })], ST(
          'Recall at tempo across keys is the test that the shapes are learned, not memorised in one place.',
          'Improvising with tapping means choosing when to tap, on which chord and string.',
          ['Name the chords before you play them.', 'Tap only where it adds something.'])),
        S('tap-voice', 'Your own piece', 'improv', 'A capstone study, then your version.', [c => tapEtude(c),
          T_('tap-own', 'Make it yours: one tapped bar per chord, then your own bar ({chords})', 'transfer', { cell: 'six', prog: 'long', strings: [2, 3], answer: true, goal: 90, start: 52, minutes: 6, why: 'Mastery means using tapping as your own vocabulary: the tab gives every second bar; the bars between are yours, built from any cell you know.', instr: HOW + 'Odd bars: your own tapped or picked bar over the chord. Even bars: the written sextuplets. Pass: two times through with every bar in time, your bars different each time.', watch: 'Your bars copying the written ones.', simplify: 'Triplets in the written bars.' })], ST(
          'The capstone combines every cell, string and grouping in one piece; the last step is writing your own.',
          'A technique becomes yours when you compose with it.',
          ['Learn long pieces four bars at a time.', 'Rewrite a section keeping the chords and changing the cells.']))
      ], [9, 10])
  ]
});
