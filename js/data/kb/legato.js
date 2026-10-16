// Legato: hammer-ons and pull-offs, so most notes come from the fretting hand and the line flows
// without a pick attack on every note. From the first hammer-on and pull-off on one string, through
// three-notes-per-string scale shapes picked once per string, sequences, trills and "hammer-ons from
// nowhere" (a new string started by the fretting hand alone), to gear changes between triplets, 16ths
// and sextuplets (Greg Howe's trademark), horizontal legato along one string, every key, performance
// tempo and an original fusion study.
//
// Concept-first (CONTENT.md): the model is a SHAPE (a scale laid out with 2 or 3 notes per string from
// the n-th scale note on the low E string: natural minor, Dorian, major or the pentatonics), and a
// PATTERN that turns the shape into an order of notes: up, down, up and down, sixes on string pairs,
// fours across the shape, trills, hammer pairs, pull triplets, and the horizontal 'string' walk (groups
// of three along one string joined by slides). ARTICULATION follows from the order: a same-string move
// up is a hammer-on, down a pull-off; a new string is picked ('string' mode) or hammered from nowhere
// ('once' mode, ascending). A RHYTHM PLAN gives each bar a note value (triplets, 16ths, sextuplets), so
// the same line can change gears. The composer `legRun(c, spec)` builds an exercise from scale × shape
// × pattern × pick mode × rhythm plan × key plan; every note is tagged with its scale for the pitch check.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-16: hammer-ons alone, pull-offs
// alone, then both, with every finger (strength and independence against an anchored index); the
// pentatonic box picking once per string; three-notes-per-string scales and sequences; single-string
// runs with position shifts; hammer-ons from nowhere; trills; gear changes across the beat; licks over
// backing tracks. Removed: echoing figures by ear, covering the tab and naming shapes, keys and roots
// aloud (no source combines them with legato drills).
import { OPEN, N, nameOf, make, mod12, scaleNps, rootFret6, SCALE_BY_ID, S, stage, entry, M, targetGuide } from '../lib.js';
import { rng } from './alternatePicking.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const UNIT = new Map([[0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 5, '16th-note quintuplets'], [1 / 6, '16th-note sextuplets']]);
const SC_NAME = { minor: 'natural minor', dorian: 'Dorian', major: 'major', minorPent: 'minor pentatonic', majorPent: 'major pentatonic', mixolydian: 'Mixolydian' };
const pcsOf = (k, sc) => SCALE_BY_ID[sc].steps.map(x => mod12(k + x));
/** Key root for a scale: minor-type scales use the minor key of the context, major-type the major key. */
function rootFor(c, sc) { const minorType = ['minor', 'dorian', 'minorPent'].includes(sc); return minorType ? (c.minor ? mod12(c.key) : mod12(c.key - 3)) : (c.minor ? mod12(c.key + 3) : mod12(c.key)); }
/** Shape n (1…7, or 1…5 for pentatonics): the scale from its n-th note on the low E, nps notes per string, as [s, f] low to high. */
export function shape(k, sc, n = 1, nps = 3) {
  const pcs = pcsOf(k, sc); let f = rootFret6(k), cnt = 1;
  while (cnt < n) { f++; if (pcs.includes(mod12(OPEN[6] + f))) cnt++; }
  for (const g of [f, f - 12, f + 12]) { if (g < 0) continue; const L = scaleNps(k, sc, g, nps); if (L && Math.max(...L.map(x => x.f)) <= 21 && Math.min(...L.map(x => x.f)) >= (g === 0 ? 0 : 1)) return L.map(x => [x.s, x.f]); }
  return null;
}
const byStr = L => { const m = {}; L.forEach(([s, f]) => (m[s] = m[s] || []).push([s, f])); return m; };
/** Patterns: an ascending shape → a practice order. */
export const PATTERNS = {
  up: L => L, down: L => L.slice().reverse(), updown: L => [...L, ...L.slice(0, -1).reverse()],
  six: L => { const B = byStr(L), out = []; for (const s of [6, 5, 4, 3, 2]) { if (!B[s] || !B[s - 1]) continue; const g = [...B[s], ...B[s - 1]]; out.push(...g, ...g.slice(0, -1).reverse().slice(0, g.length - 1)); } return out; },
  four: L => { const up = [], dn = [], r = L.slice().reverse(); for (let i = 0; i + 4 <= L.length; i++) up.push(...L.slice(i, i + 4)); for (let i = 0; i + 4 <= r.length; i++) dn.push(...r.slice(i, i + 4)); return [...up, ...dn]; },
  trill: L => { const B = byStr(L), out = []; for (const s of [3, 2, 1]) { if (!B[s] || B[s].length < 2) continue; for (let i = 0; i < 6; i++) out.push(B[s][i % 2]); } return out; },
  pairs: L => { const B = byStr(L), out = []; for (const s of [6, 5, 4, 3, 2, 1]) { if (!B[s]) continue; for (let i = 0; i + 1 < B[s].length; i++) out.push(B[s][i], B[s][i + 1]); } return out; },
  pulls: L => { const B = byStr(L), out = []; for (const s of [1, 2, 3, 4, 5, 6]) { if (!B[s]) continue; out.push(...B[s].slice().reverse()); } return out; },
  hammers: L => { const B = byStr(L), out = []; for (const s of [6, 5, 4, 3, 2, 1]) { if (!B[s]) continue; out.push(...B[s]); out.push(...B[s]); } return out; }
};
const PAT_NAME = { up: 'ascending', down: 'descending', updown: 'up and down', six: 'in sixes on string pairs', four: 'in groups of 4', trill: 'trills', pairs: 'hammer pairs', pulls: 'pull-off triplets', hammers: 'hammer-on triplets' };
/** Legato marks: same-string up = hammer, down = pull; a new string in 'once' mode = hammer from nowhere (ascending or descending). */
function marks(seq, mode) {
  return seq.map(([s, f], i) => {
    const p = seq[i - 1]; if (!p) return null;
    if (p[0] === s) return f > p[1] ? 'h' : f < p[1] ? 'p' : null;
    if (mode === 'once' && s !== p[0]) return 'h';
    return null;
  });
}
/** Along one string: the scale in groups of three, each group picked once, joined by a slide to the next group. */
function alongString(k, sc, s, lo = 2, hi = 19) {
  const pcs = pcsOf(k, sc), fr = []; for (let f = lo; f <= hi; f++) if (pcs.includes(mod12(OPEN[s] + f))) fr.push(f);
  const out = [];
  for (let i = 0; i + 2 < fr.length; i += 2) out.push([s, fr[i], i ? '/' : null], [s, fr[i + 1], 'h'], [s, fr[i + 2], 'h']);
  return out;
}

/* ------------------------------- The composer ------------------------------- */
/**
 * spec: { id, name, method, domain, scale, shapes (one block each), nps, pattern, mode ('string' |
 * 'once' | 'all' = pick every note for comparison), steps (note values, one per bar, cycled), keys,
 * along (string number for the horizontal walk), reps, land, backing, why, instr, watch, simplify,
 * goal, start, dl, minutes }. '{key}', '{scale}', '{shapes}' and '{steps}' in the text are filled in.
 */
export function legRun(c, spec) {
  const sc = spec.scale || 'minor', nps = spec.nps || (sc.endsWith('Pent') ? 2 : 3), mode = spec.mode || 'string';
  const steps = spec.steps || [(c.lvl || 4) <= 3 ? 0.5 : (c.lvl || 4) <= 6 ? 1 / 3 : (c.lvl || 4) <= 8 ? 0.25 : 1 / 6];
  const seq = [], keyNames = [], shapes = spec.shapes || [1]; let k0 = null;
  for (const off of spec.keys || [0]) {
    const k = mod12(rootFor(c, sc) + off); if (k0 == null) k0 = k; keyNames.push(nameOf(k));
    for (const n of shapes) {
      let block;
      if (spec.along) block = alongString(k, sc, spec.along).map(x => ({ s: x[0], f: x[1], x: x[2] }));
      else { const L = shape(k, sc, n, nps); if (!L) return null; const ord = PATTERNS[spec.pattern || 'updown'](L); const mk = marks(ord, mode); block = ord.map(([s, f], i) => ({ s, f, x: mode === 'all' ? null : mk[i] })); }
      for (let r = 0; r < (spec.reps || 1); r++) block.forEach((b, i) => seq.push({ ...b, x: i === 0 ? null : b.x, pcs: pcsOf(k, sc) }));
    }
  }
  if (!seq.length) return null;
  const notes = []; let t = 0, bar = 0, i = 0;
  while (i < seq.length && notes.length < 380) {
    const st = steps[bar % steps.length], per = Math.round(4 / st);
    for (let j = 0; j < per && i < seq.length; j++, i++) { const q = seq[i]; notes.push(tag(N(q.s, q.f, t, st, q.x, i === 0 ? { pick: 'd' } : null), q.pcs)); t += st; }
    bar++; t = bar * 4;
    if (i < seq.length && notes.length && notes[notes.length - 1].t + notes[notes.length - 1].d < t - 1e-6) { /* bar not full: fine, next bar starts on the beat */ }
  }
  const last = notes[notes.length - 1], end = last.t + last.d;
  notes.push(tag(N(last.s, last.f, end, Math.max(1, Math.ceil((end + 1) / 4) * 4 - end), '~'), ALLOW.get(last)));
  const stepNames = [...new Set(steps.map(s => UNIT.get(s)))].join(' → ');
  const fill = s => String(s || '').replace('{key}', `${nameOf(k0)} ${SC_NAME[sc]}`).replace('{scale}', SC_NAME[sc]).replace('{shapes}', shapes.join(', ')).replace('{steps}', stepNames).replace('{keys}', keyNames.join(', '));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretting', method: spec.method, unit: steps.length > 1 ? stepNames : UNIT.get(steps[0]) || '16th notes', goal: spec.goal || 100, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'legato',
    ...(spec.backing ? { backing: spec.backing(k0), chords: [...new Set(spec.backing(k0))] } : {}),
    why: fill(spec.why), instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
const L_ = (id, name, method, opts) => c => legRun(c, { id, name, method, ...opts });
const vamp = k => [nameOf(k) + 'm7', nameOf(k + 5) + '7'];
const minorGroove = k => [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
const HOW = 'Pick only the first note on each string; every other note is a hammer-on (going up) or a pull-off (going down). Hammer with the fingertip close behind the fret; pull off slightly sideways so the string is plucked, not just released. ';

/* ------------------------------ Generators ------------------------------ */
/** The same line picked, then legato: match the volume (focus on the sound). */
export function legCompare(c) {
  const a = legRun(c, { id: 'x', name: 'x', method: 'external-focus', scale: 'minorPent', pattern: 'pairs', mode: 'all', steps: [0.5], why: 'x', instr: 'x', watch: 'x', simplify: 'x' });
  const b = legRun(c, { id: 'x', name: 'x', method: 'external-focus', scale: 'minorPent', pattern: 'pairs', mode: 'string', steps: [0.5], why: 'x', instr: 'x', watch: 'x', simplify: 'x' });
  if (!a || !b) return null;
  const off = Math.ceil((a.tab.notes[a.tab.notes.length - 1].t + 1) / 4) * 4, notes = [...a.tab.notes, ...b.tab.notes.map(n => { const m = { ...n, t: +(n.t + off).toFixed(4) }; ALLOW.set(m, ALLOW.get(n)); return m; })];
  const k = rootFor(c, 'minorPent');
  return make(c, {
    id: 'leg-compare', name: `Picked, then legato: the same pairs at the same volume (${nameOf(k)} minor pentatonic)`, domain: 'fretting', method: 'external-focus', unit: '8th notes', goal: 96, start: 50, minutes: 4, picking: 'legato',
    why: 'Good legato sounds as even as picking: the hammered and pulled notes as loud as the picked ones. Playing the same line both ways and matching them by ear is the fastest way to strong hammer-ons and pull-offs.',
    instr: 'First half: every note picked. Second half: the same notes, only the first of each pair picked, the second hammered. Listen: the second half should sound as loud and even as the first. Pass: you can’t hear which half is legato, twice in a row.',
    watch: 'Quiet hammered notes: hammer from a little higher, faster.', simplify: 'One string only.', tab: { notes }
  });
}
/**
 * Finger strength and independence (Premier Guitar, Jamie Humphries, Ex. 1; Guitar Player legato workout,
 * Fig. 4): the index finger anchored on one fret, the 2nd, 3rd and 4th fingers hammering and pulling
 * against it, string by string from the top; at level 3 the pairs without the index (2-3, 2-4, 3-4).
 * Chromatic on purpose: four frets, one finger each.
 */
export const CHROMATIC = Array.from({ length: 12 }, (_, i) => i);
export function legFingers(c) {
  const lvl = c.lvl || 2, base = 5, strings = lvl <= 1 ? [3] : lvl === 2 ? [3, 2] : [3, 2, 1];
  const pairs = lvl <= 2 ? [[1, 2], [1, 3], [1, 4]] : [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]];
  const step = lvl <= 2 ? 0.5 : 1 / 3, notes = []; let t = 0;
  for (const s of strings) for (const [lo, hi] of pairs) {
    const a = base + lo - 1, b = base + hi - 1;
    for (let i = 0; i < 6; i++) { notes.push(tag(N(s, i % 2 ? b : a, t, step, i === 0 ? null : i % 2 ? 'h' : 'p', i === 0 ? { pick: 'd' } : null), CHROMATIC)); t += step; }
  }
  const end = t; notes.push(tag(N(strings[0], base, end, Math.max(1, Math.ceil((end + 1) / 4) * 4 - end)), CHROMATIC));
  return make(c, {
    id: 'leg-fingers', name: `Finger strength: ${pairs.map(p => p.join('-')).join(', ')} hammered and pulled at the 5th fret (${strings.length} string${strings.length > 1 ? 's' : ''})`, domain: 'fretting', method: 'accurate-reps', unit: UNIT.get(step), goal: 96, start: 50, minutes: 4, picking: 'legato',
    why: 'Legato asks every finger to hammer and pull with the same strength, including the ring and little fingers that are usually weaker. One finger per fret from the 5th fret, each finger pair trilling against the other, builds that strength and independence before scales.',
    instr: `One finger per fret, frets 5 to 8, thumb behind the neck. For each finger pair (${pairs.map(p => p.join('-')).join(', ')}): pick the lower note once, then hammer, pull, hammer, pull, hammer without picking again. Keep the lower finger pressed down while the upper one moves. Start on the G string, then add the strings above. Pass: every pair with all six notes the same volume, twice through.`,
    watch: 'The little finger drifting far from the string between hammers: keep it hovering close.', simplify: 'Only the 1-2 and 1-3 pairs, quarter notes.', tab: { notes }
  });
}
/** Random shape, pattern and gear every bar (interleaving). */
export function legRandom(c) {
  const r = rng(911 + (c.lvl || 9)), sc = c.minor ? 'dorian' : 'major', k = rootFor(c, sc), notes = [], names = [];
  const pats = ['up', 'down', 'six', 'four', 'updown'], gears = [1 / 3, 0.25, 1 / 6];
  for (let b = 0; b < 8; b++) {
    const n = 1 + Math.floor(r() * 7), p = pats[Math.floor(r() * pats.length)], st = gears[Math.floor(r() * gears.length)], L = shape(k, sc, n, 3); if (!L) return null;
    names.push(`shape ${n}, ${PAT_NAME[p]}, ${UNIT.get(st)}`);
    const ord = PATTERNS[p](L), mk = marks(ord, 'string'), per = Math.round(3 / st);
    for (let j = 0; j < per; j++) { const i = j % ord.length; notes.push(tag(N(ord[i][0], ord[i][1], b * 4 + j * st, st, j ? mk[i] : null), pcsOf(k, sc))); }
    const e = ord[(per - 1) % ord.length]; notes.push(tag(N(e[0], e[1], b * 4 + 3, 1, '~'), pcsOf(k, sc)));
  }
  return make(c, {
    id: 'leg-random', name: `A new shape, pattern and gear every bar (${nameOf(k)} ${SC_NAME[sc]})`, domain: 'fretting', method: 'interleaving', unit: 'mixed', goal: 92, start: 54, minutes: 5, picking: 'legato',
    why: 'At mastery every shape, pattern and note value is available on demand. A new shape, pattern and gear every bar, in one key, makes the hands change while the line keeps flowing.',
    instr: `${names.join(' → ')}. Three beats of legato, a held note, then the next; the notes are in the tab. Keep the beat still when the gear changes. Pass: all 8 bars without stopping at the goal tempo.`,
    watch: 'Picking more notes when the gear goes up.', simplify: 'The first four bars.', tab: { notes }
  });
}
/** An original 8-bar fusion study (capstone): pairs, a Dorian run in triplets, a gear change, sixes, the horizontal walk, trills, the landing. */
export function legEtude(c) {
  const sc = 'dorian', k = rootFor(c, sc), pcs = pcsOf(k, sc), notes = [];
  const L1 = shape(k, sc, 1, 3), L3 = shape(k, sc, 3, 3), P = shape(k, 'minorPent', 1, 2); if (!L1 || !L3 || !P) return null;
  const put = (ord, mode, st, t0, beats) => { const mk = marks(ord, mode); for (let j = 0; j < Math.round(beats / st); j++) { const i = j % ord.length; notes.push(tag(N(ord[i][0], ord[i][1], t0 + j * st, st, j ? mk[i] : null), pcs)); } };
  put(PATTERNS.pairs(P), 'string', 0.5, 0, 3); notes.push(tag(N(3, byStr(P)[3][1][1], 3, 1, '~'), pcs));          // bar 1: pentatonic hammer pairs, held
  put(PATTERNS.up(L1), 'string', 1 / 3, 4, 4);                                                                    // bar 2: shape 1 up in triplets
  put(PATTERNS.down(L1), 'string', 0.25, 8, 4);                                                                  // bar 3: down in 16ths (gear change)
  put(PATTERNS.six(L3), 'string', 1 / 6, 12, 4);                                                                 // bar 4: sixes in shape 3, sextuplets
  const lo5 = Math.max(2, Math.min(L1[0][1], 7)), al = alongString(k, sc, 2, lo5, Math.min(21, lo5 + 14)); put(al.map(x => [x[0], x[1]]), 'string', 0.25, 16, 4);   // bar 5: along the B string
  put(PATTERNS.trill(L3), 'string', 1 / 6, 20, 2); put(PATTERNS.up(L3), 'once', 0.25, 22, 2);                     // bar 6: trills, then from nowhere
  put(PATTERNS.down(L3), 'string', 1 / 6, 24, 4);                                                                // bar 7: down in sextuplets
  const root = L1.find(([s, f]) => s <= 3 && mod12(OPEN[s] + f) === k) || L1[0]; notes.push(tag(N(root[0], root[1], 28, 4, '~'), pcs));   // bar 8: land
  const chords = vamp(k);
  return make(c, {
    id: 'leg-etude', name: `Capstone study: an 8-bar legato piece (${nameOf(k)} Dorian)`, domain: 'improv', method: 'transfer', unit: 'changing gears', goal: 92, start: 52, minutes: 8,
    backing: [...chords, ...chords, ...chords, ...chords], chords, picking: 'legato',
    why: 'An original piece over a Dorian vamp that uses the whole path and changes gear the way fusion players do: hammer pairs, a triplet run, the same run back in 16ths, sixes in sextuplets, a horizontal walk on one string, trills, hammer-ons from nowhere and a held landing.',
    instr: 'Learn it two bars at a time, then join them. Keep the pulse identical while the note values change; pick only the first note on each string. Then write your own 8 bars on the same plan. Pass: the study at the goal tempo with no stops, then your version played through once.',
    watch: 'Rushing when the gear goes up: the beat doesn’t move.', simplify: 'Bars 1–4.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'legato', kind: 'technique', title: 'Legato (hammer-ons and pull-offs)', domain: 'fretting',
  re: /\blegato\b|hammer-?ons?( and| &) pull-?offs?|pull-?offs?( and| &) hammer-?ons?|hammer-?ons? from nowhere/,
  aliases: ['hammer-ons and pull-offs', 'legato technique', 'hammer-ons from nowhere'],
  summary: 'Lines played mostly by the fretting hand: from the first hammer-on and pull-off to three-notes-per-string scales, sequences, trills, hammer-ons from nowhere, horizontal legato and gear changes between triplets, 16ths and sextuplets.',
  prereqs: ['pentatonic'],
  sources: ['https://guitarlessons.com/guitar-lessons/lead-guitar/legato-guitar-technique/', 'https://www.guitarplayer.com/lessons/legato-workout-one-hour-to-fluid-performance', 'https://www.premierguitar.com/lessons/cram-session-modern-legato-techniques', 'https://guitarworld.com/lessons/modern-legato-video-masterclass', 'https://appliedguitartheory.com/lessons/legato-exercises-for-guitar/', 'https://www.musicradar.com/how-to/improve-your-legato-lead-playing-in-20-minutes-with-this-easy-guitar-lesson', 'https://www.premierguitar.com/lessons/shred/joe-satriani-legato-guitar-lesson', 'https://www.guitarinteractivemagazine.com/tech-session/greg-howe/page/2/'],
  pedagogy: {
    date: '2026-10-16',
    summary: 'Legato is taught as hammer-ons alone, then pull-offs alone, then the two combined, on one string with each finger; then the pentatonic box and three-notes-per-string scales picking only the first note of each string, sequences and triplet patterns, single-string runs with position shifts, hammer-ons from nowhere and trills, and finally licks and phrases over backing tracks, always slowly with a metronome and with the slurred notes as loud as the picked ones.',
    sequence: [
      { id: 'hammer', tier: 'foundations', step: 'Hammer-ons alone, pairs on one string with each finger', how: 'Pick the lower note, bring the next finger down right behind the fret without picking; two-note pairs with the middle, ring and little finger, then three notes per string.', skills: ['leg-hammer'], source: 0 },
      { id: 'pull', tier: 'foundations', step: 'Pull-offs, then hammer-ons and pull-offs together', how: 'Fret both notes, pick the upper and pull the finger slightly sideways to pluck the lower; then pick once and keep hammering and pulling.', skills: ['leg-pull'], source: 0 },
      { id: 'even-strong', tier: 'foundations', step: 'Even volume and finger strength', how: 'Slurred notes as loud as picked ones; strength and independence drills with the index anchored and the other fingers hammering and pulling against it.', skills: ['leg-even'], source: 3 },
      { id: 'licks', tier: 'foundations', step: 'Legato licks over backing tracks', how: 'Minor pentatonic, major pentatonic and scale licks, then phrases in the styles of Satriani, Kotzen and Garsed with held notes between legato bursts.', skills: ['leg-first-music', 'leg-music-i', 'leg-music-a'], source: 0 },
      { id: 'three-nps', tier: 'intermediate', step: 'Three-notes-per-string scales, one pick per string', how: 'Major and minor three-notes-per-string shapes, picking only the first note of each string, up and down.', skills: ['leg-3nps'], source: 1 },
      { id: 'sequences', tier: 'intermediate', step: 'Step-back sequences and triplet patterns', how: 'Don’t only run the scale: step-back patterns and triplet groupings through the shape, looped for even tone and timing.', skills: ['leg-seq'], source: 1 },
      { id: 'across-beat', tier: 'intermediate', step: 'Groupings that sit across the beat', how: 'Modern legato plays fast, irregular groups across the beat; the beat stays still while the grouping changes.', skills: ['leg-gears'], source: 3 },
      { id: 'nowhere', tier: 'intermediate', step: 'Hammer-ons from nowhere', how: 'Start a new string with the fretting hand alone (half slur), going up and on the descent, muting the string you left.', skills: ['leg-nowhere'], source: 2 },
      { id: 'speed-trills', tier: 'advanced', step: 'Trills and endurance at speed', how: 'Trill sequences and looped 16th-note-triplet patterns on the top strings for strength, stamina and timing.', skills: ['leg-speed'], source: 2 },
      { id: 'one-string', tier: 'advanced', step: 'Single-string runs and position shifts', how: 'Groups along one string from the 1st fret up, picking only the first note of each position, and scales across several positions joined by slides.', skills: ['leg-horizontal'], source: 1 },
      { id: 'positions-keys', tier: 'advanced', step: 'Other keys, modes and positions', how: 'The same approach in other scales and keys (Dorian, Aeolian, Lydian, major) and in several positions up the neck.', skills: ['leg-keys'], source: 3 },
      { id: 'performance', tier: 'mastery', step: 'Performance tempo', how: 'Start slowly and raise the tempo gradually with a metronome, only while every note is clean and even.', skills: ['leg-perf'], source: 1 },
      { id: 'anywhere', tier: 'mastery', step: 'Any shape, pattern and key', how: 'Long runs through many positions and keys, combining the earlier patterns.', skills: ['leg-anywhere'], source: 3 },
      { id: 'own', tier: 'mastery', step: 'Your own legato study', how: 'A piece that combines the techniques of the path, then your own on the same plan.', skills: ['leg-voice'], source: 2 }
    ],
    drills: ['Two-note hammer-on and pull-off pairs on one string with each finger', 'Index anchored, other fingers hammering and pulling against it', 'Minor pentatonic picking only the first note of each string', 'Three-notes-per-string scales picked once per string', 'Step-back and triplet sequences', 'Single-string runs with position shifts', 'Hammer-ons from nowhere ascending and descending', 'Trills'],
    mistakes: ['Slurred notes much quieter than the picked note', 'Hammering too hard (sharp) or pulling too hard (out of tune, open-string noise)', 'Hammering away from the fret', 'Fingers rushing because the pick no longer sets the time', 'Picking more notes than the first of each string', 'The little finger drifting away from the fretboard', 'Raising the tempo before the line is even'],
    sources: [
      { title: 'Legato Hammer-Ons & Pull-Offs (Lead Guitar Quick-Start)', author: 'Guitareo / Guitarlessons.com', url: 'https://guitarlessons.com/guitar-lessons/lead-guitar/legato-guitar-technique/' },
      { title: 'Legato Exercises for Guitar', author: 'Applied Guitar Theory', url: 'https://appliedguitartheory.com/lessons/legato-exercises-for-guitar/' },
      { title: 'Legato Workout: One Hour to Fluid Performance', author: 'Guitar Player', url: 'https://www.guitarplayer.com/lessons/legato-workout-one-hour-to-fluid-performance' },
      { title: 'Cram Session: Modern Legato Techniques', author: 'Jamie Humphries (Premier Guitar)', url: 'https://www.premierguitar.com/lessons/cram-session-modern-legato-techniques' }
    ]
  },
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Hammer-ons and pull-offs',
      'Hammer and pull pairs and three-note groups on every string of a box at 90 BPM in 8th notes with the legato notes as loud as the picked ones, trill every finger pair against the index at the 5th fret with all notes the same volume, and play a legato lick over a minor groove.', [
        S('leg-hammer', 'Hammer-ons', 'fretting', 'Pairs, then three-note groups, string by string.', [
          L_('leg-pairs', 'Hammer-on pairs on every string ({key}, box 1)', 'chunking', { scale: 'minorPent', pattern: 'pairs', steps: [0.5], goal: 100, start: 50, why: 'A hammer-on sounds a note by bringing a finger down hard on the string, without picking. Pairs (pick one, hammer the next) are the smallest piece of legato.', instr: HOW + 'Pick the lower note, hammer the upper, string by string from the low E. Pass: every hammered note as loud as the picked one, twice through.', watch: 'Hammering from too high and too slowly: short, fast and close to the fret.', simplify: 'One string, quarter notes.' }),
          L_('leg-hammer3', 'Three-note hammer-ons on each string ({key}, three notes per string)', 'accurate-reps', { scale: 'minor', pattern: 'hammers', steps: [0.5], goal: 96, start: 48, why: 'Three notes per string, one pick and two hammer-ons: the motion behind every fast legato run. Clean repetitions build it.', instr: HOW + 'Each string twice, low to high. Count only clean groups. Pass: 8 clean groups in a row.', watch: 'The middle finger collapsing; keep the fingers curved.', simplify: 'Two notes per string.' })],
          ST('A hammer-on sounds a note by bringing the fretting finger down onto the string; the picked note before it keeps ringing into the new one.', 'Legato lines are smoother and faster than picked ones: one pick stroke can sound three notes.', ['Hammer close behind the fret with the fingertip.', 'Keep the lower finger down while the upper one hammers.'])),
        S('leg-pull', 'Pull-offs', 'fretting', 'Pairs going down; three-note pull-offs.', [
          L_('leg-pull3', 'Three-note pull-offs on each string, high to low ({key})', 'accurate-reps', { scale: 'minor', pattern: 'pulls', steps: [0.5], goal: 96, start: 48, why: 'A pull-off plucks the string with the fretting finger as it leaves, sounding the lower note already fretted. Three-note pull-offs are the descending half of legato.', instr: HOW + 'Fret all three notes of the string first, pick the top one, pull off to the middle, then to the lowest. Pass: 8 clean groups in a row.', watch: 'Lifting straight up (no sound): pull slightly toward the floor.', simplify: 'Two notes per string.' }),
          L_('leg-updown1', 'Up with hammer-ons, down with pull-offs: shape 1 ({key})', 'chunking', { scale: 'minor', pattern: 'updown', steps: [0.5], goal: 96, start: 48, why: 'Joining the two motions: hammer-ons up the shape, pull-offs back down, one pick per string.', instr: HOW + 'Learn it two strings at a time, then whole. Pass: up and down twice without a gap at the turn.', watch: 'Picking extra notes at the top of the shape.', simplify: 'Strings 6–4 only.' })],
          ST('A pull-off sounds the lower of two fretted notes by plucking the string with the finger that leaves it.', 'Pull-offs give the descending half of every legato line.', ['Fret both notes first; pull slightly sideways.', 'Mute the strings below with the picking hand.'])),
        S('leg-even', 'Even and strong', 'fretting', 'Match legato to picking by ear; strength and independence in every finger.', [c => legCompare(c), c => legFingers(c)],
          ST('Legato should sound as even as picking: the hammered and pulled notes as loud as the picked one. Every finger needs the same strength, so the weaker ring and little fingers are drilled against the index.', 'Uneven volume is the most common legato fault, and weak fingers are its usual cause.', ['Hammer close behind the fret, fast rather than hard: too hard pushes the note sharp.', 'Keep the lower finger down while the upper one hammers and pulls.'])),
        S('leg-first-music', 'First music', 'improv', 'A legato lick over a minor groove.', [
          L_('leg-lick', 'First legato lick: hammer pairs up the box into a held note ({key})', 'transfer', { scale: 'minorPent', pattern: 'pairs', steps: [0.5], goal: 96, start: 50, backing: minorGroove, why: 'The pentatonic box with hammer pairs is the most common legato sound in rock and blues: the lick climbs smoothly and lands on a held note.', instr: HOW + 'Play it over the groove, hold the last note with vibrato, then make your own lick with the same pairs. Pass: the lick twice in time, then 4 bars of your own.', watch: 'Rushing the hammered notes.', simplify: 'Only strings 3–1.' }),
          M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])],
          ST('Legato pairs inside a phrase: smooth notes, a held ending.', 'The technique becomes music when it is part of a phrase.', ['End legato runs on a note you can hold.']))
      ], [1, 3]),
    stage('intermediate', 'Three notes per string, in time',
      'Play three-notes-per-string shapes up and down in triplets at 100 BPM picking once per string, play them in sixes and fours, change gear between triplets and 16ths every bar, hammer on from nowhere going up and going down, and play Dorian legato phrases over a vamp.', [
        S('leg-3nps', 'Shapes up and down', 'fretting', 'Ascending, descending, and up and down in triplets.', [
          L_('leg-up', '{key} shape 1 ascending, one pick per string, in triplets', 'variable', { scale: 'minor', pattern: 'up', reps: 2, goal: 100, why: 'Three notes per string fit triplets exactly: one pick on the beat, two hammer-ons. The ascending run is the backbone of legato.', instr: HOW + 'One string per beat. Pass: 4 clean runs at the goal tempo.', watch: 'Accenting the hammered notes less than the picked one.', simplify: '8th notes.' }),
          L_('leg-down', '{key} shape 2 descending with pull-offs, in triplets', 'variable', { scale: 'minor', shapes: [2], pattern: 'down', reps: 2, goal: 100, why: 'Descending legato depends on clean pull-offs and muting: the open strings above want to ring.', instr: HOW + 'One string per beat, top to bottom. Pass: 4 clean runs at the goal tempo.', watch: 'Open strings ringing after the pull-offs.', simplify: '8th notes.' }),
          L_('leg-updown', '{key} shapes 1 and 3 up and down in triplets', 'variable', { scale: 'minor', shapes: [1, 3], pattern: 'updown', goal: 100, why: 'Two shapes, up and down: the hand has to change map in the middle while the legato stays even.', instr: HOW + 'Shape 1 up and down, then shape 3. Pass: twice through clean.', watch: 'A gap at the turn at the top.', simplify: 'Shape 1 only.' })],
          ST('Three-notes-per-string shapes put three scale notes on every string: one pick, two hammers or pulls.', 'They are the standard fingering for fast legato runs.', ['Triplets: one string per beat.', 'Seven shapes cover the whole neck for a seven-note scale.'])),
        S('leg-seq', 'Sequences', 'fretting', 'Sixes on string pairs; fours.', [
          L_('leg-six', '{key} in sixes on string pairs (shape 1)', 'variable', { scale: 'minor', pattern: 'six', steps: [1 / 3], goal: 96, why: 'Six notes on two strings, up and back: the classic legato loop, two beats of triplets per pair.', instr: HOW + 'Each pair: three up on the lower string, three up on the upper, then back down. Pass: through all pairs clean twice.', watch: 'Picking the first note of the return.', simplify: '8th notes.' }),
          L_('leg-four', '{key} in groups of 4 (shape 1)', 'variable', { scale: 'minor', pattern: 'four', steps: [0.25], goal: 92, why: 'Groups of four cross the three-note strings, so the pick lands in a different place each time: legato in 16ths.', instr: HOW + 'Four notes up from each scale note, then down. Pass: twice through clean.', watch: 'Losing the group when the string changes.', simplify: 'Half the shape.' })],
          ST('Sequences reorder the shape: sixes on string pairs, groups of four across it.', 'They turn scale runs into melodic lines.', ['Groups of 4 against three notes per string shift the pick around the beat.'])),
        S('leg-gears', 'Changing gears', 'rhythm', 'Triplets and 16ths alternating every bar.', [
          L_('leg-gear', 'Gear change: triplets, then 16ths, every bar ({key}, shapes 1 and 2)', 'interleaving', { scale: 'minor', shapes: [1, 2], pattern: 'updown', steps: [1 / 3, 0.25], goal: 92, why: 'Switching between triplets and 16ths on the same line (Greg Howe’s trademark) makes a run surge forward without changing tempo. Alternating every bar stops the hands settling into one speed.', instr: HOW + 'Bar 1 in triplets, bar 2 in 16ths, and so on: the beat stays still, the notes speed up. Count "1-trip-let" then "1-e-and-a". Pass: 4 bars with every gear change on the beat.', watch: 'The tempo jumping with the gear.', simplify: '8ths, then triplets.' })],
          ST('A gear change keeps the beat and changes the note value: triplets (3 per beat) to 16ths (4) to sextuplets (6).', 'It is how fusion players make a line accelerate within one tempo.', ['Same tempo, more notes per beat.'])),
        S('leg-nowhere', 'Hammer-ons from nowhere', 'fretting', 'A new string started by the fretting hand alone.', [
          L_('leg-once', 'Hammer-ons from nowhere: shape 1 ascending, picked only once ({key})', 'chunking', { scale: 'minor', pattern: 'up', mode: 'once', reps: 2, steps: [1 / 3], goal: 92, why: 'A hammer-on from nowhere starts a new string by hammering without picking: the whole ascending run comes from one pick stroke. Learn it one string change at a time.', instr: 'Pick only the very first note. Each new string: hammer its first note hard enough to sound it on its own, while the picking hand mutes the strings below. Loop each string change first, then the whole run. Pass: 4 runs with every string start as loud as the rest.', watch: 'Weak string starts: hammer from higher and mute the old string.', simplify: 'Pick each new string; hammer from nowhere on one string change only.' }),
          L_('leg-once-down', 'Hammer-ons from nowhere going down: shape 2 descending, picked once ({key})', 'chunking', { scale: 'minor', shapes: [2], pattern: 'down', mode: 'once', steps: [1 / 3], goal: 92, why: 'Descending, each new string starts on its highest note with nothing ringing to pull from. Hammering that note from nowhere keeps the whole run on one pick stroke, the way modern legato players descend.', instr: 'Pick only the very first note. On each new, lower string, hammer its top note hard enough to sound on its own, then pull off through the other two; the picking hand mutes the string you left. Loop each string change, then the whole run. Pass: 4 runs with every string start as loud as the pulled notes.', watch: 'The first note on the new string missing or much quieter.', simplify: 'Pick each new string; hammer from nowhere on one string change only.' })],
          ST('A hammer-on from nowhere sounds a note on a new string with the fretting hand alone.', 'It allows whole runs from a single pick stroke: the smoothest legato sound.', ['Mute the string you left with the picking hand.'])),
        S('leg-music-i', 'Legato phrases', 'improv', 'Dorian over a vamp; pentatonic legato licks.', [
          L_('leg-dorian', 'Dorian legato over a minor vamp ({key})', 'transfer', { scale: 'dorian', shapes: [1, 2], pattern: 'updown', steps: [1 / 3], goal: 96, backing: vamp, why: 'Dorian (minor with a major 6th) over a i–IV vamp is the classic fusion sound; legato runs through two shapes make it flow.', instr: HOW + 'Play the written run over the vamp, then improvise: short legato bursts ending on a held chord tone. Pass: the run twice, then 8 bars of your own.', watch: 'Running the shape without ever stopping.', simplify: 'Shape 1 only.' }),
          L_('leg-pent-licks', 'Pentatonic legato licks in sixes ({key})', 'transfer', { scale: 'minorPent', pattern: 'six', steps: [1 / 3], goal: 96, backing: minorGroove, why: 'Two notes per string in sixes gives the rolling pentatonic legato of rock lead playing.', instr: HOW + 'Through the string pairs over the groove, then improvise your own legato licks from the box. Pass: twice through, then 8 bars of your own.', watch: 'Rushing the pull-offs.', simplify: 'Two string pairs.' })],
          ST('Legato in a solo: bursts of smooth notes between held ones.', 'Contrast between flowing runs and space keeps legato musical.', ['Dorian = natural minor with a major 6th.']))
      ], [4, 6]),
    stage('advanced', 'Speed, trills and the whole neck',
      'Play three-notes-per-string runs in sextuplets at 90 BPM, trill evenly for a full beat on each string, walk the scale along one string with slides, change key every block, climb four positions without a gap, and play a fusion phrase that changes gear.', [
        S('leg-speed', 'Speed', 'fretting', 'Sextuplets; trills.', [
          L_('leg-sext', '{key} shapes 1–3 up and down in sextuplets', 'edge', { scale: 'minor', shapes: [1, 2, 3], pattern: 'updown', steps: [1 / 6], goal: 88, start: 54, why: 'Two strings per beat: legato at speed. The tempo ladder takes it there in small, clean steps.', instr: HOW + 'Tempo ladder: start at the start tempo, add 4 BPM after every clean pass. Pass: two clean passes at the goal tempo.', watch: 'Tension in the fretting hand: lighter, not harder.', simplify: '16ths.' }),
          L_('leg-trills', 'Trills: one beat on each of the top strings ({key})', 'external-focus', { scale: 'minor', shapes: [1, 3], pattern: 'trill', steps: [1 / 6], goal: 84, start: 50, why: 'A trill (hammer and pull between two notes, fast) is the endurance test of legato. Listening for an even, unbroken buzz is the goal.', instr: 'Hammer and pull between the two notes as evenly as possible for a beat on each string. Listen: no gaps, no louder notes. Pass: every trill even at the goal tempo.', watch: 'The pull-off getting weaker as the hand tires.', simplify: '16ths.' })],
          ST('Speed in legato comes from small, light finger motions; trills build endurance.', 'Fast legato is the sound of Holdsworth, Satriani and Howe.', ['Six notes per beat = two strings of three.'])),
        S('leg-horizontal', 'Along the neck', 'fretboard', 'One string with slides; shapes linked.', [
          L_('leg-along', 'Along the B string: groups of three joined by slides ({key})', 'variable', { scale: 'minor', along: 2, reps: 2, steps: [0.25], goal: 92, why: 'Horizontal legato: three notes on one string, then a slide into the next three. It travels the neck and sounds like a voice.', instr: 'Pick the first note only; hammer the next two; slide the index finger up into the next group. Pass: up the string twice in time.', watch: 'Picking after each slide.', simplify: '8th notes.' }),
          L_('leg-along-g', 'Along the G string in triplets ({key})', 'variable', { scale: 'dorian', along: 3, reps: 2, steps: [1 / 3], goal: 92, why: 'The same walk on the G string in Dorian: the 6th falls on new frets, so the hand can’t rely on the last string’s map.', instr: 'Groups of three with slides along the G string. Pass: twice in time.', watch: 'Uneven slides.', simplify: '8th notes.' })],
          ST('Horizontal legato moves along one string, joining groups of three with slides.', 'It links the shapes and carries a line across the neck.', ['Slide with the index finger into the next group.'])),
        S('leg-keys', 'Keys and positions', 'fretboard', 'Four keys; four positions up the neck.', [
          L_('leg-keys', 'Four keys around the cycle of fourths ({keys})', 'interleaving', { scale: 'minor', keys: [0, 5, 10, 3], pattern: 'up', steps: [0.25], goal: 96, why: 'The shapes move with the key; changing key every block forces you to rebuild the map each time.', instr: HOW + 'Shape 1 ascending in each key ({keys}); use the held last note to move to the next key. Pass: all four without stopping.', watch: 'Stopping to find the new root: lower the tempo instead.', simplify: 'Two keys.' }),
          L_('leg-positions', 'Up the neck through four positions: shapes 1, 2, 3 and 4 ({key})', 'variable', { scale: 'minor', shapes: [1, 2, 3, 4], pattern: 'up', steps: [0.25], goal: 96, why: 'Taking the same scale through four positions in a row moves the hand up the neck one shape at a time, so the legato stays even while the stretches and the fret spacing change.', instr: HOW + 'Each block is one shape, ascending, in 16ths: shape 1, then 2, 3 and 4, each starting on the next scale note of the low E string. Pass: all four positions without a gap between them.', watch: 'Weaker hammer-ons in the higher positions, where the frets are closer.', simplify: 'Shapes 1 and 2.' })],
          ST('Every key has seven three-notes-per-string shapes; shape n starts on the n-th scale note of the low E string, so the shapes climb the neck in order.', 'Real lines change key and position; the legato has to stay even through both.', ['A key a 4th higher moves every shape five frets up (or seven down).', 'Higher positions: closer frets, smaller stretches.'])),
        S('leg-music-a', 'Fusion phrases', 'improv', 'Gear changes over a Dorian vamp; a solo.', [
          L_('leg-fusion', 'Fusion phrase: triplets, 16ths, sextuplets over the vamp ({key})', 'transfer', { scale: 'dorian', shapes: [1, 3], pattern: 'updown', steps: [1 / 3, 0.25, 1 / 6], goal: 88, start: 52, backing: vamp, why: 'The line surges through three gears over a static vamp, the way Greg Howe builds a phrase, then lands.', instr: HOW + 'Bar by bar: triplets, 16ths, sextuplets. Then improvise your own phrase that changes gear and ends on a held chord tone. Pass: the written phrase twice, then 8 bars of your own.', watch: 'Speeding up the beat with the notes.', simplify: 'Two gears.' }),
          c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp: legato bursts that change gear, each ending on a chord tone' })],
          ST('In fusion, legato runs change speed within the bar and land on chord tones.', 'It is the sound of the style.', ['Plan the landing note before the burst.']))
      ], [7, 8]),
    stage('mastery', 'Anywhere, at speed, your own',
      'Play shapes 1–7 up and down in sextuplets at about 100 BPM, legato in a new shape, pattern and gear every bar, six keys in a row, and perform your own 8-bar legato study.', [
        S('leg-perf', 'Performance tempo', 'fretting', 'The whole neck at speed.', [
          L_('leg-neck', 'All seven shapes up and down in sextuplets ({key})', 'edge', { scale: 'minor', shapes: [1, 2, 3, 4, 5, 6, 7], pattern: 'updown', steps: [1 / 6], goal: 92, start: 56, why: 'Every shape at performance tempo: the complete legato map of the key.', instr: HOW + 'Tempo ladder to the goal. Pass: two clean passes.', watch: 'Fatigue in shapes 6 and 7: shake out between shapes.', simplify: 'Shapes 1–4.' }),
          L_('leg-neck-once', 'Hammer-ons from nowhere at speed: shapes 1, 3, 5 ascending ({key})', 'edge', { scale: 'dorian', shapes: [1, 3, 5], pattern: 'up', mode: 'once', steps: [1 / 6], goal: 88, start: 54, why: 'Picked once per run at speed: only the fretting hand plays.', instr: 'Pick only the first note of each shape. Tempo ladder to the goal. Pass: two clean passes with every string start sounding.', watch: 'Weak string starts at speed.', simplify: '16ths.' })],
          ST('Performance tempo is reached in small tempo steps over clean passes.', 'At speed, legato must stay as even as slow.', ['Add 3–5 BPM after two clean passes.'])),
        S('leg-anywhere', 'Any shape, any key', 'fretboard', 'Random access; all keys.', [c => legRandom(c),
          L_('leg-12', 'Six keys around the cycle of fourths ({keys})', 'interleaving', { scale: 'minor', keys: [0, 5, 10, 3, 8, 1], pattern: 'up', steps: [1 / 6], goal: 92, why: 'Six keys in a row at sextuplet speed: the shapes move with every key, the legato must not change.', instr: HOW + 'Shape 1 ascending in each key, one block per key. Pass: all six keys without stopping.', watch: 'Losing the flat keys.', simplify: 'Three keys.' })],
          ST('At mastery any shape, pattern and gear in any key comes out on demand.', 'Mixed practice, once each shape is secure, is what carries over into real solos.', ['Root on the low E first, then the shape.'])),
        S('leg-voice', 'Your own voice', 'improv', 'A study, then your own.', [c => legEtude(c), c => targetGuide(c, { prog: 'minorRock', scale: 'minor', name: 'Rock solo: legato runs between bends and long notes' })],
          ST('A capstone study uses every idea of the path, then becomes your own.', 'Mastery is legato used musically.', ['Contrast: smooth runs, then space.']))
      ], [9, 10])
  ]
});
