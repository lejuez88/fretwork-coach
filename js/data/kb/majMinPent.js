// Mixing the major and minor pentatonic over a blues: the two pentatonics of one root, where each
// sounds right (major over the I chord, minor from the IV), the ♭3-to-3 "curl" that joins them, the
// combined eight-note scale, following the changes with the major pentatonic of each chord, in every
// key and position, to an original 12-bar study. John Mayer's, B.B. King's, Clapton's and SRV's lead
// vocabulary over dominant blues changes.
//
// Concept-first (CONTENT.md): the model is
//   - SETS of pitch classes over a root K: min (R ♭3 4 5 ♭7), maj (R 2 3 5 6), mix (both: R 2 ♭3 3 4 5 6
//     ♭7) and follow (the major pentatonic of the bar's chord root);
//   - RULES that pick a set per chord of a dominant blues (I7, IV7, V7): 'switch' (major on I and V,
//     minor on IV), 'mix' (the combined set everywhere), 'follow' (each chord's own major pentatonic),
//     or one set throughout;
//   - TARGETS, the note a bar lands on: the I chord's 3rd (from the major side), the IV chord's ♭7 (the
//     ♭3 of the key, from the minor side), the V chord's root (the key's 5th), or each chord's 3rd;
//   - POSITIONS as fret windows on the neck relative to the root on the low E string: 'root' (minor box
//     1 and the major pentatonic from the same root), 'low' (the minor shape moved down three frets,
//     which is the major pentatonic), 'up' (the next position up the neck).
// The composer `mmRun(c, spec)` builds an exercise from rule × target plan × position × motif (run into
// the target, the curl, a sequence) × rhythm × form (4-bar loop or 12-bar) × keys; every note is tagged
// with the pitch classes it must belong to (its bar's set) for the pitch check.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-17: minor pentatonic box 1 first,
// the major pentatonic as the same shapes three frets lower and in the same area as minor box 1, each
// scale over a static I chord to hear its colour, the ♭3-to-3 move (swap the ♭3 of a box-1 lick for the
// 3rd, slide or hammer into it), major on the I and minor on the IV and V, minor phrases answered by major
// ones and the AAB plan (two lines sweet, the third blue), connecting both across the neck, then your own
// blend. Removed: the ear quiz with the tab covered and singing (`mm-hear`), finding degrees from memory
// and saying them (`mm-recall`), covering the tab in `mm-targets`, `mm-called` and `mm-12-thirds`, and
// naming keys or sets aloud in `mm-keys`, `mm-keys-fast` and the capstone (no source teaches it).
import { OPEN, N, nameOf, make, mod12, S, stage, entry, M, rootFret6, targetGuide } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const SETS = { min: [0, 3, 5, 7, 10], maj: [0, 2, 4, 7, 9], mix: [0, 2, 3, 4, 5, 7, 9, 10] };
export const SET_NAME = { min: 'minor pentatonic', maj: 'major pentatonic', mix: 'major + minor (mixed)', follow: 'each chord’s major pentatonic' };
const DEG = { 0: 'R', 2: '2', 3: '♭3', 4: '3', 5: '4', 7: '5', 9: '6', 10: '♭7' };
/** Forms: degrees of the chords, one per bar. */
export const FORMS = { four: [0, 5, 0, 7], twelve: [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7], quick: [0, 5, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7] };
/** The set a rule chooses over a chord a degree d above the key. */
function setFor(rule, d) {
  if (rule === 'switch') return d === 5 ? 'min' : 'maj';
  if (rule === 'follow') return 'follow';
  return rule;   // 'min' | 'maj' | 'mix'
}
const pcsOf = (K, set, d) => (set === 'follow' ? SETS.maj.map(x => mod12(K + d + x)) : SETS[set].map(x => mod12(K + x)));
/** The target pitch class of a bar: 'guide' = I→3, IV→♭7 (the key's ♭3), V→root of V; 'third' = each chord's 3rd; 'root' = each chord's root. */
function targetFor(K, d, plan, set) {
  if (plan === 'root') return mod12(K + d);
  if (plan === 'third' || set === 'follow') return mod12(K + d + 4);
  const pcs = pcsOf(K, set, d);
  // the guide note; when the bar's set doesn't contain it, the minor side lands on the ♭3 over the I,
  // otherwise the first chord tone (3rd, ♭7, root, 5th) the set has
  const cands = [mod12(K + (d === 0 ? 4 : d === 5 ? 3 : 7)), ...(set === 'min' && d === 0 ? [mod12(K + 3)] : []), ...[4, 10, 0, 7].map(x => mod12(K + d + x))];
  return cands.find(x => pcs.includes(x));
}
/** The root fret on the low E for key K, high enough for the 'low' window. */
function rootAt(K) { const f = rootFret6(K); return f < 3 ? f + 12 : f; }
/** A position's fret window. */
export function windowOf(K, pos = 'root') {
  const r = rootAt(K);
  return pos === 'low' ? [r - 3, r] : pos === 'up' ? [r + 2, r + 6] : [r - 1, r + 3];
}
/** All notes of a pitch-class set inside a fret window, low to high, one note per pitch (the lower string kept). */
export function notesIn(pcs, [lo, hi]) {
  const out = [], seen = new Set();
  for (const s of [6, 5, 4, 3, 2, 1]) for (let f = Math.max(0, lo); f <= Math.min(22, hi); f++) { const m = OPEN[s] + f; if (pcs.includes(mod12(m)) && !seen.has(m)) { seen.add(m); out.push({ s, f, m }); } }
  return out.sort((a, b) => a.m - b.m);
}
const chordOf = (K, d) => nameOf(K + d) + '7';
const stepFor = lvl => (lvl <= 3 ? 0.5 : lvl <= 6 ? 1 / 3 : 0.25);
const UNIT = new Map([[0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes']]);

/* ------------------------------- The composer ------------------------------- */
/**
 * spec: { id, name, method, domain, rule ('switch' | 'mix' | 'follow' | 'min' | 'maj' | array per bar),
 * form ('four' | 'twelve' | 'quick' or an array of degrees), target ('guide' | 'third' | 'root'), pos
 * ('root' | 'low' | 'up', or an array per bar), motif ('run' | 'curl' | 'seq' | 'whole'), dirs (cycled
 * per bar: 'up' | 'down'), step, keys (key offsets, one form each), choruses, goal, start, dl, why,
 * instr, watch, simplify }.
 */
export function mmRun(c, spec) {
  const K0 = mod12(c.key), step = spec.step || stepFor(c.lvl || 4), notes = [], chords = [], plan = [];
  const form = Array.isArray(spec.form) ? spec.form : FORMS[spec.form || 'four'];
  let bar = 0;
  for (const off of spec.keys || [0]) for (let ch = 0; ch < (spec.choruses || 1); ch++) form.forEach((d, i) => {
    const K = mod12(K0 + off), rule = Array.isArray(spec.rule) ? spec.rule[i % spec.rule.length] : spec.rule || 'switch', set = setFor(rule, d);
    const pos = Array.isArray(spec.pos) ? spec.pos[bar % spec.pos.length] : spec.pos || 'root';
    const pcs = pcsOf(K, set, d), list = notesIn(pcs, windowOf(K, pos)), tgt = targetFor(K, d, spec.target || 'guide', set);
    const dir = (spec.dirs || ['up', 'down'])[bar % (spec.dirs || ['up', 'down']).length], t0 = bar * 4;
    chords.push(chordOf(K, d)); plan.push(`${chordOf(K, d)}: ${set === 'follow' ? 'major pent. of ' + nameOf(K + d) : SET_NAME[set]}`);
    const motif = spec.motif || 'run';
    if (motif === 'whole') { const tn = nearestTo(list, tgt); notes.push(tag(N(tn.s, tn.f, t0, 4, '~'), pcs)); bar++; return; }
    if (motif === 'curl' && (set === 'maj' || set === 'mix') && d === 0) {
      // ♭3 hammered to 3 on one string, then the 5th and the root, and the 3rd held
      const cu = curlIn(K, windowOf(K, pos)); const allow = SETS.mix.map(x => mod12(K + x));
      if (cu) {
        let t = t0; const seq = [[cu.s, cu.f, null], [cu.s, cu.f + 1, 'h'], ...cu.after.map(([s, f]) => [s, f, null])];
        seq.forEach(([s, f, x], j) => { notes.push(tag(N(s, f, t, step, x), allow)); t += step; });
        notes.push(tag(N(cu.s, cu.f + 1, t, Math.max(step, t0 + 4 - t), '~'), allow)); bar++; return;
      }
    }
    const n = Math.max(3, Math.round(3 / step)), ti = idxNear(list, tgt);
    let idx = [];
    if (motif === 'seq') { // groups of three stepping toward the target
      const from = dir === 'up' ? Math.max(0, ti - Math.ceil(n / 3) - 1) : Math.min(list.length - 1, ti + Math.ceil(n / 3) + 1);
      for (let g = 0; idx.length < n; g++) { const st = dir === 'up' ? from + g : from - g; for (let j = 0; j < 3 && idx.length < n; j++) idx.push(dir === 'up' ? st + j : st - j); }
      idx = idx.map(x => Math.max(0, Math.min(list.length - 1, x)));
    } else {
      for (let j = n; j >= 1; j--) idx.push(dir === 'up' ? ti - j : ti + j);
      if (idx.some(x => x < 0 || x >= list.length)) { idx = []; for (let j = n; j >= 1; j--) idx.push(dir === 'up' ? ti + j : ti - j); }
      idx = idx.map(x => Math.max(0, Math.min(list.length - 1, x)));
    }
    let t = t0; idx.forEach(x => { const p = list[x]; notes.push(tag(N(p.s, p.f, t, step), pcs)); t += step; });
    const tn = list[ti]; notes.push(tag(N(tn.s, tn.f, t, Math.max(step, t0 + 4 - t), '~'), pcs));
    bar++;
  });
  if (notes.length < 3) return null;
  const K = K0, fill = s => String(s).replace(/\{key\}/g, nameOf(K)).replace('{plan}', [...new Set(plan)].slice(0, 6).join(' · '));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'improv', method: spec.method, unit: UNIT.get(step) || '8th notes', goal: spec.goal || 100, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    backing: chords, chords: [...new Set(chords)].slice(0, 8), why: fill(spec.why), instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
function idxNear(list, pc) {
  let best = 0, bd = 1e9; const mid = (list[0].m + list[list.length - 1].m) / 2;
  list.forEach((p, i) => { if (mod12(p.m) !== pc) return; const d = Math.abs(p.m - mid); if (d < bd) { bd = d; best = i; } });
  return best;
}
const nearestTo = (list, pc) => list[idxNear(list, pc)];
/** The ♭3 of K on strings 4–2 inside a window, with the 5th and root that follow it in the same area. */
export function curlIn(K, [lo, hi]) {
  for (const s of [3, 4, 2]) for (let f = Math.max(0, lo); f <= hi; f++) {
    if (mod12(OPEN[s] + f - K) !== 3 || f + 1 > 22) continue;
    const m3 = OPEN[s] + f + 1, want = [m3 + 3, m3 + 8];   // the 5th and the root above the 3rd
    const after = want.map(m => { for (const s2 of [s - 1, s - 2, s]) if (s2 >= 1) { const f2 = m - OPEN[s2]; if (f2 >= Math.max(0, lo - 1) && f2 <= hi + 2) return [s2, f2]; } return null; });
    if (after.every(Boolean)) return { s, f, after };
  }
  return null;
}

/* ------------------------------ Generators ------------------------------ */
/** One box played up and back, the degrees named (accurate reps / chunking). */
export function mmBox(c, { set = 'min', pos = 'root', id, name, method, why, instr, watch, simplify, goal = 100 }) {
  const K = mod12(c.key), pcs = SETS[set].map(x => mod12(K + x)), list = notesIn(pcs, windowOf(K, pos)), step = (c.lvl || 2) <= 2 ? 0.5 : 1 / 3;
  if (list.length < 8) return null;
  const seq = [...list, ...list.slice(0, -1).reverse()], notes = []; let t = 0;
  seq.forEach(p => { notes.push(tag(N(p.s, p.f, t, step), pcs)); t += step; });
  const r = list.find(p => mod12(p.m) === K) || list[0]; notes.push(tag(N(r.s, r.f, t, Math.ceil((t + 1) / 4) * 4 - t, '~'), pcs));
  return make(c, { id, name: name.replace('{key}', nameOf(K)), domain: 'fretboard', method, unit: step === 0.5 ? '8th notes' : '8th-note triplets', goal, start: 50, minutes: 4, why, instr, watch, simplify, tab: { notes } });
}
/** A whole 12-bar study on the path (capstone): curl on the I, minor on the IV, the mix on the V, a sequence, the turnaround. */
export function mmEtude(c) {
  const K = mod12(c.key), parts = [
    { form: [0, 0], rule: 'maj', motif: 'curl' }, { form: [0, 0], rule: 'maj', motif: 'run', pos: 'low' },
    { form: [5, 5], rule: 'min', motif: 'seq' }, { form: [0, 0], rule: 'mix', motif: 'run', pos: 'up' },
    { form: [7, 5], rule: 'follow', motif: 'run' }, { form: [0, 7], rule: 'switch', motif: 'run' }];
  const notes = [], backing = []; let offset = 0;
  for (const p of parts) {
    const x = mmRun({ ...c, lvl: Math.min(c.lvl || 9, 8) }, { id: 'x', name: 'x', why: 'x', instr: 'x', watch: 'x', simplify: 'x', step: 1 / 3, dirs: ['down', 'up'], ...p });
    if (!x) return null;
    x.tab.notes.forEach(n => { const m = { ...n, t: +(n.t + offset).toFixed(4) }; ALLOW.set(m, ALLOW.get(n)); notes.push(m); });
    backing.push(...x.backing); offset += p.form.length * 4;
  }
  return make(c, {
    id: 'mm-etude', name: `Capstone study: a 12-bar blues mixing major and minor (${nameOf(K)})`, domain: 'improv', method: 'transfer', unit: '8th-note triplets', goal: 92, start: 54, minutes: 8,
    backing, chords: [...new Set(backing)],
    why: 'An original 12-bar chorus that uses the whole path: the ♭3-to-3 curl on the I chord, the major pentatonic moved down three frets, a minor sequence over the IV, the mixed scale up the neck, each chord’s own major pentatonic on the V and IV, and the switch in the last two bars.',
    instr: 'Learn it two bars at a time, then join them; the sets change every two bars (major, minor, mixed, the chord’s own). Then write your own chorus with the same plan of sets. Pass: the whole chorus at the goal tempo with every bar landing on its target, then your own version once.',
    watch: 'Letting the minor ♭3 land on the I chord: on the I, the ♭3 always moves up to the 3.', simplify: 'Bars 1–4.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const R_ = (id, name, method, opts) => c => mmRun(c, { id, name, method, ...opts });
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'majMinPent', kind: 'subject', title: 'Mixing major and minor pentatonic', domain: 'improv',
  re: /(mix(ing)?|combin(e|ing)) (the )?major and minor pentatonic|major (and|\/|&) minor pentatonic|major.?minor (pentatonic|blues)/,
  aliases: ['major and minor pentatonic', 'mixing pentatonics', 'major-minor blues'],
  summary: 'The major and minor pentatonic of one root over a dominant blues: where each works (major on the I, minor from the IV), the ♭3-to-3 curl that joins them, the combined eight-note scale, following the changes with each chord’s major pentatonic, in every key and position, to an original 12-bar study.',
  prereqs: ['pentatonic'],
  sources: ['https://www.premierguitar.com/articles/25911-blue-horizons-how-to-mix-major-and-minor-pentatonics', 'https://blog.truefire.com/guitar-lessons/major-and-minor-pentatonic-blues/', 'https://www.fundamental-changes.com/major-pentatonic-licks-for-guitar/', 'https://www.activemelody.com/microlesson/blending-the-major-and-minor-pentatonic-scales-in-1-position-blues-guitar-lesson-ml143/', 'https://www.premierguitar.com/lessons/many-sides-of-john-mayer', 'https://www.musicradar.com/how-to/john-mayer-guitar-lesson'],
  pedagogy: {
    date: '2026-10-17',
    summary: 'Taught from the minor pentatonic the player already knows: the major pentatonic is the same shapes three frets lower, and also sits in the same area as minor box 1; each scale is first played over a static I chord to hear its colour; then the ♭3 of a box-1 lick is swapped for (or slid and bent into) the major 3rd; then the scales follow the chords (major on the I, minor on the IV and V), minor phrases are answered by major ones across the form (two lines sweet, the third blue), the blend is connected across the neck, and finally each player weights the mix in their own way.',
    sequence: [
      { id: 'shapes', tier: 'foundations', step: 'Minor box 1, then the major pentatonic as the same shape three frets lower and in the same area', how: 'Learn the major pentatonic as the minor shapes shifted down three frets, then find the major pattern that overlaps minor box 1 so both sit under one hand.', skills: ['mm-two'], source: 2 },
      { id: 'static', tier: 'foundations', step: 'Each scale over a static I chord', how: 'Play each scale over a one-chord I7 backing and notice the feel of each; then switch between them mid-phrase.', skills: ['mm-static'], source: 1 },
      { id: 'curl', tier: 'foundations', step: 'The ♭3 to the major 3rd', how: 'Take a box-1 minor lick, find the ♭3 and replace it with the 3rd, sliding or bending into it: minor colour turning major.', skills: ['mm-curl'], source: 1 },
      { id: 'switch1', tier: 'foundations', step: 'Major on the I, minor on the IV', how: 'Over a blues, major pentatonic on the I chord and minor on the IV, following the chord changes.', skills: ['mm-first'], source: 1 },
      { id: 'form', tier: 'intermediate', step: 'Switching through the 12-bar form', how: 'Minor away from the I chord (the IV, the V–IV turnaround), major on the return to the I, in the full 12-bar and the quick change.', skills: ['mm-switch'], source: 0 },
      { id: 'blend', tier: 'intermediate', step: 'Both scales in one position: the blended scale and target notes', how: 'Pair the major and minor patterns in one area of the neck and see where they overlap; ask which note fits this moment rather than which scale.', skills: ['mm-mix'], source: 3 },
      { id: 'positions', tier: 'intermediate', step: 'Other positions and keys', how: 'Move the blend to the next pattern up the neck and to other keys; the shapes move with the root.', skills: ['mm-keys'], source: 2 },
      { id: 'answer', tier: 'intermediate', step: 'Minor phrases answered by major ones', how: 'A minor lick answered by a major one on each line of the blues, and the reverse.', skills: ['mm-music-i'], source: 0 },
      { id: 'follow', tier: 'advanced', step: 'Following each chord', how: 'Over the IV, minor built on its ♭7 or the IV chord’s own sound; over the V and the turnaround, minor or the chord’s own notes, resolving to major on the I.', skills: ['mm-follow'], source: 0 },
      { id: 'neck', tier: 'advanced', step: 'Connecting minor and major across the neck', how: 'Join minor and major phrases across the pentatonic positions, a few notes from each scale at a time.', skills: ['mm-neck'], source: 1 },
      { id: 'bends', tier: 'advanced', step: 'Bends, slides and resolution into the 3rd everywhere', how: 'Bend or slide into the major 3rd in every position; tension and resolution, with space between phrases.', skills: ['mm-color'], source: 1 },
      { id: 'aab', tier: 'advanced', step: 'Solos planned by the lyric form', how: 'Major for the first two lines, minor for the third, mirroring the AAB form of a blues verse; shuffles and slow blues.', skills: ['mm-music-a'], source: 0 },
      { id: 'tempo', tier: 'mastery', step: 'Adapting the blend to tempo and every key', how: 'Fast shuffles versus slow blues; the blend at tempo and in any key.', skills: ['mm-perf', 'mm-anykey'], source: 1 },
      { id: 'own', tier: 'mastery', step: 'Your own weighting of the two', how: 'Study how different players weight the blend and build your own choruses.', skills: ['mm-voice'], source: 1 }
    ],
    drills: ['Minor and major pentatonic over a static I chord, then switching mid-phrase', 'A box-1 minor lick with its ♭3 swapped for (or slid into) the 3rd', 'Major pentatonic on the I, minor on the IV over a 12-bar', 'A minor lick answered by a major lick on each line of the blues, and the reverse', 'Major for two lines, minor for the third (AAB)', 'The same lick shifted down three frets to turn minor into major'],
    mistakes: ['Landing on the ♭3 over the I chord without resolving it', 'Staying in the major pentatonic over the IV chord', 'Playing the box without blending the two sounds (scale thinking instead of note choice)', 'Treating the first note of the shifted shape as the root', 'No space between phrases', 'Using the major pentatonic over a minor blues'],
    sources: [
      { title: 'Blue Horizons: How to Mix Major and Minor Pentatonics', author: 'David Hamburger (Premier Guitar)', url: 'https://www.premierguitar.com/articles/25911-blue-horizons-how-to-mix-major-and-minor-pentatonics' },
      { title: 'Major and Minor Pentatonic Blues', author: 'Jeff McErlain (TrueFire)', url: 'https://blog.truefire.com/guitar-lessons/major-and-minor-pentatonic-blues/' },
      { title: 'Major Pentatonic Licks for Guitar', author: 'Joseph Alexander (Fundamental Changes)', url: 'https://www.fundamental-changes.com/major-pentatonic-licks-for-guitar/' },
      { title: 'Blending the Major and Minor Pentatonic Scales in 1 Position (ML143)', author: 'Active Melody', url: 'https://www.activemelody.com/microlesson/blending-the-major-and-minor-pentatonic-scales-in-1-position-blues-guitar-lesson-ml143/' }
    ]
  },
  ctx: { key: 9, minor: false, prog: 'blues' },
  stages: [
    stage('foundations', 'Two pentatonics, one root',
      'Play the minor and the major pentatonic of the same root up and back at 90 BPM in 8ths, both as the minor shape moved down three frets and in the same area as minor box 1, play each over a static I7 chord and switch between them every bar, play the ♭3-to-3 curl into the root with the 3rd as loud as the ♭3, and play major on the I and minor on the IV over a 4-bar blues.', [
        S('mm-two', 'The two shapes', 'fretboard', 'Minor box 1, the major pentatonic from the same root, and the three-fret move.', [
          c => mmBox(c, { set: 'min', id: 'mm-minbox', name: 'The {key} minor pentatonic, box 1, up and back', method: 'accurate-reps', why: 'The minor pentatonic (R ♭3 4 5 ♭7) is the home base of blues soloing. It is half of this path, so it has to be clean before the major side is added.', instr: 'Box 1 from the root on the low E, up and back in 8ths, with a slight accent on every root. Pass: up and back 4 times clean in a row.', watch: 'Rushing the string changes.', simplify: 'Quarter notes.' }),
          c => mmBox(c, { set: 'maj', pos: 'low', id: 'mm-majbox', name: 'The {key} major pentatonic: the same shape three frets lower', method: 'chunking', why: 'Move the minor box-1 shape down three frets and it becomes the major pentatonic of the same root (R 2 3 5 6): one shape, two scales. The root is now under the pinky on the low E.', instr: 'Play the minor box-1 shape with the index three frets lower than before. Find the root (pinky, low E) first, then play up and back. Then play any minor lick you know, and the same lick three frets lower: it turns major. Pass: up and back 4 times clean, landing on the root at the end.', watch: 'Treating the first note as the root: in this position the root is under the pinky.', simplify: 'Only the bottom three strings.' }),
          c => mmBox(c, { set: 'maj', pos: 'root', id: 'mm-majroot', name: 'The {key} major pentatonic around the same root as box 1', method: 'accurate-reps', why: 'The major pentatonic can also be played around the same root as minor box 1, so both scales sit under one hand position and you can switch without moving.', instr: 'Same hand position as minor box 1 (index around the root fret, a fret behind allowed). Up and back in 8ths. Pass: 4 clean passes, then alternate one pass minor, one pass major.', watch: 'Drifting into the minor notes out of habit.', simplify: 'The top four strings.' })],
          ST('Every root has two pentatonics: minor (R ♭3 4 5 ♭7) and major (R 2 3 5 6). They share the root and the 5th; the rest differ.', 'Over a dominant blues both are right, each with its own mood; good blues players switch between them all the time.', ['The minor shape moved down three frets gives the major pentatonic of the same root (it is the minor pentatonic of the relative minor).', 'Shared notes: R and 5. Major only: 2, 3, 6. Minor only: ♭3, 4, ♭7.'])),
        S('mm-static', 'Each scale over the I chord', 'improv', 'Hear what each scale does over one chord, then switch.', [
          R_('mm-static-colour', 'Over a static {key}7: two bars of minor pentatonic, two bars of major', 'external-focus', { form: [0, 0, 0, 0], rule: ['min', 'min', 'maj', 'maj'], target: 'root', dirs: ['up', 'down'], step: 0.5, goal: 88, start: 48, why: 'Over one dominant chord both pentatonics work, but they sound different: the minor one tough and bluesy, the major one sweet and open. Hearing each against the same chord is how the two sounds become choices.', instr: 'One chord all the way ({key}7). Bars 1–2: runs in the minor pentatonic into the root. Bars 3–4: the same in the major pentatonic. Listen to the colour change at bar 3. Pass: the four bars twice in time, every bar ending on the root.', watch: 'Rushing the change at bar 3: the new scale starts exactly on the bar line.', simplify: 'Quarter notes.' }),
          R_('mm-static-switch', 'Switch every bar over {key}7: minor, then major, landing on the ♭3 and the 3', 'variable', { form: [0, 0, 0, 0, 0, 0, 0, 0], rule: ['min', 'maj'], target: 'guide', dirs: ['up', 'down'], step: 0.5, goal: 88, start: 48, why: 'Over the I chord the minor side creates tension and the major 3rd resolves it. Alternating every bar, minor into its ♭3, major into its 3rd, puts both landing notes under the same hand.', instr: 'Eight bars of {key}7: odd bars a minor run, even bars a major run, each held on its last note with vibrato. Pass: eight bars twice in time without a wrong-scale note.', watch: 'Holding the ♭3 at the end of a major bar: in the major bars the last note is the 3rd, a fret higher.', simplify: 'Four bars.' })],
          ST('Over a dominant 7th chord the minor pentatonic sounds tough and bluesy and the major pentatonic sweet and open; the ♭3 is the tension, the 3rd the resolution.', 'Choosing between them on purpose starts with hearing what each does over the same chord.', ['Minor pentatonic: R ♭3 4 5 ♭7. Major pentatonic: R 2 3 5 6.', 'They share the root and the 5th, so moving between them is smooth.'])),
        S('mm-curl', 'The curl: ♭3 to 3', 'fretting', 'The move that joins the two scales.', [
          R_('mm-curl', 'The curl: ♭3 hammered to the 3rd, then the 5th and root, over {key}7', 'accurate-reps', { form: [0, 0, 0, 0], rule: 'maj', motif: 'curl', step: 0.5, goal: 92, start: 50, why: 'Hammering from the minor 3rd to the major 3rd is the sound of the blues: it starts blue and resolves sweet. It is the hinge between the two pentatonics.', instr: 'On the I chord: the ♭3, hammer to the 3 (one fret up), then the 5th and the root, and hold the 3rd with vibrato. Four bars. Pass: 4 bars where the hammer-on is as loud as the picked note.', watch: 'A weak hammer-on: the 3rd must ring as loud as the ♭3.', simplify: 'Only the hammer-on, ♭3 to 3, held.' }),
          R_('mm-curl-ear', 'Hear the lift: ♭3 to 3, slowly, listening for the moment it turns major ({key}7)', 'external-focus', { form: [0, 5, 0, 7], rule: ['maj', 'min', 'maj', 'maj'], motif: 'curl', step: 0.5, goal: 84, start: 46, why: 'The curl only works if the 3rd lands in tune and on time with the chord. Listening for the exact moment the line turns from blue to sweet trains the ear and the timing together.', instr: 'Bars 1, 3 and 4 (the I and V): the curl. Bar 2 (the IV): a minor run landing on the ♭3 of the key (the IV chord’s ♭7). Listen: on the I the ♭3 must resolve; on the IV it can stay. Pass: 4 bars twice where you can hear the I turn major and the IV stay blue.', watch: 'Curling over the IV chord too: there the ♭3 is a chord tone and doesn’t need to move.', simplify: 'Two bars: I, then IV.' })],
          ST('The curl is a small move from the ♭3 to the 3: by hammer-on, slide or a quarter-tone bend.', 'It is the most common way blues players mix the two scales: the minor note leaning into the major one.', ['Over the IV chord the key’s ♭3 is the chord’s ♭7: it can stay.', 'Over the I chord the ♭3 clashes with the chord’s 3rd: resolve it upward.'])),
        S('mm-first', 'First music', 'improv', 'Major on the I, minor on the IV.', [
          R_('mm-first-switch', 'A 4-bar blues in {key}: major pentatonic on the I and V, minor on the IV', 'transfer', { form: 'four', rule: 'switch', motif: 'run', step: 0.5, goal: 92, start: 50, why: 'The simplest rule that works: major pentatonic over the I (its 3rd is the chord’s 3rd), minor pentatonic over the IV (its ♭3 is the IV chord’s ♭7). Each bar runs into a chord tone.', instr: 'Each bar: a short run in the bar’s scale, landing on the target (the 3rd on the I, the ♭3 of the key on the IV, the 5th on the V) on beat 4. Then improvise with the same rule. Pass: the 4 bars twice in time, then four bars of your own.', watch: 'Staying in the major scale on the IV chord: its 3rd clashes there.', simplify: 'Only the target notes, as whole notes.' }),
          M('transfer', ['callResponse', { chords: '$blues', scale: 'majorPent' }])],
          ST('A blues that switches scales with the chords sounds like it follows the song, not just the key.', 'This is the first step to the sound of Clapton, B.B. King or John Mayer over a blues.', ['I: major pentatonic. IV: minor pentatonic. V: major pentatonic or both.']))
      ], [1, 3]),
    stage('intermediate', 'Switching with the changes',
      'Solo over a 12-bar blues in triplets at 100 BPM switching scales with the chords and landing on each bar’s target, play the combined eight-note scale in runs and threes, land on each chord’s target note, switch every bar, use the next position up, change key every four bars, and answer minor phrases with major ones over the whole form.', [
        S('mm-switch', 'The switch', 'improv', 'Major on I, minor on IV, over the 4-bar loop and the 12-bar.', [
          R_('mm-switch-12', 'A 12-bar blues in {key}: the switch, every bar into its target', 'variable', { form: 'twelve', rule: 'switch', dirs: ['up', 'down', 'down', 'up'], goal: 100, why: 'The full 12-bar form: four bars of the I, two of the IV, two of the I, then V–IV–I–V. Every bar runs into its target in the bar’s scale, alternating directions.', instr: 'Plan: {plan}. Each bar a run into its target, held on beat 4. Pass: the chorus twice without a wrong-scale note, then a chorus of your own with the same rule.', watch: 'Losing the form in bars 9–12: V, IV, I, V.', simplify: 'Only bars 1–8.' }),
          R_('mm-quick', 'Quick-change 12-bar: the IV in bar 2 ({key})', 'variable', { form: 'quick', rule: 'switch', dirs: ['down', 'up'], goal: 100, why: 'The quick change moves to the IV chord in bar 2 and back: the scale has to switch after one bar, which is where the habit of following the chords really forms.', instr: 'Same rule, quick-change form: {plan}. Pass: twice through without missing the bar-2 switch.', watch: 'Staying major in bar 2.', simplify: '8th notes.' }),
          R_('mm-half', 'A switch every two beats: I and IV alternating ({key})', 'interleaving', { form: [0, 5, 0, 5, 0, 5, 7, 7], rule: 'switch', dirs: ['up', 'down'], goal: 96, step: 1 / 3, why: 'Switching scale every bar, over and over, is the hardest form of the rule: the hand has to change notes in the same position without stopping.', instr: 'Bars alternate I and IV, then two bars of V: {plan}. Pass: twice through with every target landing.', watch: 'Mixing the scales inside one bar.', simplify: 'Half tempo.' })],
          ST('Following the chord means the scale changes at the bar line, not when it’s convenient.', 'Chord-following is what separates a blues solo that “fits” from one that just stays in key.', ['12-bar: I I I I · IV IV I I · V IV I V.', 'Quick change: I IV I I · IV IV I I · V IV I V.'])),
        S('mm-mix', 'The combined scale', 'fretboard', 'All eight notes in runs and threes; the target of each chord.', [
          R_('mm-mix-run', 'The combined scale over the 4-bar blues: runs through all eight notes ({key})', 'variable', { form: 'four', rule: 'mix', dirs: ['up', 'down'], goal: 100, why: 'Together the two pentatonics make an eight-note scale (R 2 ♭3 3 4 5 6 ♭7): Mixolydian plus the ♭3. Running through it shows how the extra notes sit between the familiar ones.', instr: 'Each bar a run in the combined scale into the bar’s target. Notice the ♭3 and 3 side by side. Pass: twice through clean at the goal tempo.', watch: 'Landing on the ♭3 over the I chord.', simplify: '8th notes.' }),
          R_('mm-mix-seq', 'Threes through the combined scale, into the target ({key})', 'chunking', { form: 'four', rule: 'mix', motif: 'seq', dirs: ['down', 'up'], goal: 96, why: 'Groups of three break the eight-note scale into small, phrase-like pieces and make it sound like phrases rather than a scale.', instr: 'Learn one bar’s groups at a time, then join the bars. Each bar ends on its target. Pass: the 4 bars twice in time.', watch: 'Losing the group of three at the string changes.', simplify: 'One bar, looped.' }),
          R_('mm-targets', 'Target notes through the 12-bar: the 3rd on the I, the ♭7 on the IV, the 5th on the V ({key})', 'external-focus', { form: 'twelve', rule: 'mix', motif: 'whole', goal: 90, start: 60, why: 'With both scales under the hand the question is which note fits this moment. Holding only the target of each chord, with vibrato, lets you hear each one lock with its chord before you build lines into it.', instr: 'Each bar, play only the target as a whole note with vibrato: the 3rd of the I, the ♭7 of the IV (the key’s ♭3), the root of the V (the key’s 5th). Listen for the note blending into the chord. Pass: the 12 bars twice, every target in tune and on the bar line.', watch: 'Playing the key’s 3rd over the IV: that clashes.', simplify: 'Bars 1–6.' })],
          ST('The combined scale is the major and minor pentatonic together: R 2 ♭3 3 4 5 6 ♭7. Its two halves suit different chords.', 'Many great blues phrases use both halves in one line, steered by where they land.', ['Over I7: land on R, 3, 5 or ♭7.', 'Over IV7: land on the key’s ♭3 (the chord’s ♭7) or the key’s 6 (its 3rd).'])),
        S('mm-keys', 'Positions and keys', 'fretboard', 'The next position up; four keys.', [
          R_('mm-up', 'The switch in the next position up the neck ({key})', 'variable', { form: 'four', rule: 'switch', pos: 'up', dirs: ['up', 'down'], goal: 96, why: 'The same rule in the position above: different shapes, the same targets.', instr: 'Each bar in the bar’s scale, landing on the target, in the position just above the root position. Pass: twice through clean.', watch: 'Sliding back to the root position.', simplify: '8th notes.' }),
          R_('mm-keys', 'The switch in four keys around the cycle of fourths, one 4-bar blues each', 'interleaving', { form: 'four', rule: 'switch', keys: [0, 5, 10, 3], dirs: ['up', 'down'], goal: 96, dl: 1, why: 'A new key every four bars: find the root, then both scales around it at once.', instr: 'Each key a 4-bar blues with the switch; the shapes move with the root on the low E. Pass: all four keys without stopping.', watch: 'Carrying the last key’s position over.', simplify: 'Two keys.' })],
          ST('Both scales move with the root: in any key and position the rule stays the same.', 'Real songs come in every key; the rule must travel.', ['Find the root on the low E, then the 3 one fret above the ♭3.'])),
        S('mm-music-i', 'In a solo', 'improv', 'A chorus of your own.', [R_('mm-answer', 'Minor asks, major answers: two bars of each on every line of a {key} blues', 'transfer', { form: 'twelve', rule: ['min', 'min', 'maj', 'maj'], dirs: ['down', 'up'], step: 1 / 3, goal: 96, why: 'A minor phrase answered by a major one, line after line: minor away from the I chord, major on the return to it. The contrast is the sound of B.B. King and Freddie King choruses.', instr: 'Plan: {plan}. Each line of the blues: two bars of minor runs, then two bars of major runs, every bar into its target. Then swap: major asks, minor answers. Pass: the chorus twice in time, then once the other way round.', watch: 'Carrying the minor ♭3 into a major bar: the major answers on the I land on the 3rd, a fret higher.', simplify: 'The first line only.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'majorPent', name: 'Solo over the blues: major pentatonic on the I, minor on the IV, land on the guide notes' }), M('transfer', ['callResponse', { chords: '$blues', scale: 'blues' }])],
          ST('A solo built from two scales needs one plan: where each phrase lands. A classic plan answers a minor phrase with a major one on every line of the blues.', 'Question-and-answer between the blue and the sweet side is how blues players make the two scales tell a story.', ['End phrases on the 3 over the I and the ♭7 over the IV.', 'Minor away from the I chord, major on the return to it.']))
      ], [4, 6]),
    stage('advanced', 'Following every chord',
      'Follow the changes with each chord’s own major pentatonic over a 12-bar in 16ths at 90 BPM, mix major and minor across two positions, change set every bar (minor, major, mixed, the chord’s own), curl and resolve in every position, and solo a chorus planned two lines sweet and one blue, a shuffle and a slow blues.', [
        S('mm-follow', 'Each chord’s own scale', 'improv', 'The major pentatonic of the I, IV and V in turn.', [
          R_('mm-follow-4', 'Follow the chords: the major pentatonic of each chord, landing on its 3rd ({key})', 'variable', { form: 'four', rule: 'follow', target: 'third', dirs: ['up', 'down'], goal: 96, why: 'The next step past the switch: over each chord play that chord’s own major pentatonic and land on its 3rd. The line now outlines every change, the sound of country-blues and soul players.', instr: 'Plan: {plan}. Each bar runs into its chord’s 3rd. Pass: twice through with every 3rd landing.', watch: 'Staying in the I chord’s scale over the IV.', simplify: 'Triplets.' }),
          R_('mm-follow-12', '12-bar, mixing the methods: switch, follow and mixed by bar ({key})', 'interleaving', { form: 'twelve', rule: ['maj', 'mix', 'switch', 'maj', 'min', 'follow', 'mix', 'maj', 'follow', 'min', 'switch', 'follow'], dirs: ['down', 'up', 'up'], goal: 96, why: 'Changing the method every bar (the I’s major scale, the mixed scale, each chord’s own scale) forces a real choice at each bar line.', instr: 'Plan: {plan}. Read the chord and the method, then play into the target. Pass: twice through without a wrong-set note.', watch: 'Defaulting to one scale for the whole chorus.', simplify: 'Bars 1–8.' })],
          ST('Each chord of a blues has its own major pentatonic: over IV7 its 3rd is the key’s 6, over V7 its 3rd is the key’s major 7.', 'Following each chord makes a solo sound like it knows the changes.', ['The V chord’s 3rd is a half step below the key’s root: a strong pull home.'])),
        S('mm-neck', 'Two positions, a set per bar', 'fretboard', 'The mix across positions; a new set every bar.', [
          R_('mm-neck', 'The mixed scale across the root position and the one above ({key})', 'variable', { form: 'twelve', rule: 'mix', pos: ['root', 'up'], dirs: ['up', 'down'], goal: 96, why: 'Alternating two positions bar by bar makes the mixed scale a map of the neck rather than one box.', instr: 'Odd bars in the root position, even bars in the position above, each into its target. Pass: twice through clean.', watch: 'Late shifts at the bar line.', simplify: 'Four bars.' }),
          R_('mm-called', 'A new set every bar in threes: minor, major, mixed, the chord’s own ({key})', 'interleaving', { form: 'twelve', rule: ['min', 'maj', 'mix', 'follow'], motif: 'seq', dirs: ['down', 'up'], goal: 92, why: 'Changing the set every bar, in groups of three, mixes the four sounds so that none becomes a habit: each bar the hand has to move to a different set of notes in the same area.', instr: 'The set for each bar cycles minor, major, mixed, chord’s own: {plan}. Groups of three into each bar’s target. Pass: the chorus twice with every target landing.', watch: 'Carrying the last bar’s set over the bar line.', simplify: 'Four bars.' })],
          ST('The same eight notes exist in every position; the targets don’t move, only the fingerings.', 'Phrases that move across the neck sound freer than those trapped in one box.', ['Shift on the first note of a bar.'])),
        S('mm-color', 'Curls everywhere', 'fretting', 'The curl and its resolution in every position.', [
          R_('mm-curl-pos', 'The curl in three positions over the I chord ({key})', 'external-focus', { form: [0, 0, 0, 0, 0, 0], rule: 'maj', motif: 'curl', pos: ['low', 'root', 'up'], step: 1 / 3, goal: 92, why: 'The ♭3-to-3 move exists in every position; listening to its pitch in each one keeps it in tune when you move.', instr: 'Two bars in each position: the curl, the 5th and root, the 3rd held. Listen for the 3rd matching the chord exactly. Pass: all six bars with every 3rd in tune.', watch: 'An early hammer-on, before the beat.', simplify: 'One position.' }),
          R_('mm-turnaround', 'The last four bars: V–IV–I–V with the switch, into the next chorus ({key})', 'variable', { form: [7, 5, 0, 7], rule: ['follow', 'min', 'maj', 'follow'], dirs: ['down', 'down', 'up', 'up'], step: 0.25, goal: 92, why: 'The turnaround is where the changes come fastest; each bar needs its own set and target.', instr: 'Plan: {plan}. In 16ths, each bar into its target. Pass: twice through in time.', watch: 'Rushing bar 4 into the next chorus.', simplify: 'Triplets.' })],
          ST('The curl can live on any string and in any position; it always resolves the ♭3 to the 3 over the I.', 'Using it everywhere keeps the mixed sound alive all over the neck.', ['The V chord bar can use its own major pentatonic, landing on its 3rd, the key’s leading tone.'])),
        S('mm-music-a', 'In real music', 'improv', 'A shuffle and a slow blues.', [R_('mm-aab', 'Two lines sweet, one line blue: a {key} chorus planned like an AAB verse', 'transfer', { form: 'twelve', rule: ['switch', 'switch', 'switch', 'switch', 'switch', 'switch', 'switch', 'switch', 'min', 'min', 'min', 'min'], dirs: ['up', 'down', 'down', 'up'], step: 1 / 3, goal: 96, why: 'A blues verse is AAB: a line, the line again, and an answer. Planning the solo the same way (the first two lines with the major side on the I chords, the third line all minor) gives a chorus a shape a listener can follow.', instr: 'Plan: {plan}. Bars 1–8 with the switch (major on the I, minor on the IV), bars 9–12 all minor, with space after each line. Pass: the chorus twice in time with every target landing.', watch: 'Filling the space at the end of each line: leave the last beat of bars 4 and 8 empty if you can.', simplify: 'Bars 1–4 and 9–12.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'blues', name: 'Shuffle solo: major on the I, minor on the IV, curls everywhere' }), c => targetGuide(c, { prog: 'slowBlues', scale: 'majorPent', name: 'Slow blues: sweet major lines on the I, blue minor lines on the IV' })],
          ST('In a real solo, the two scales are colours you choose line by line; the AAB form of a blues verse is a ready-made plan.', 'Contrast between the sweet and the blue side is what makes a blues solo tell a story.', ['AAB: two similar lines, then a different answer.', 'Leave space at the end of each line.']))
      ], [7, 8]),
    stage('mastery', 'Any key, at speed, your own',
      'Play a 12-bar mixing all methods in 16ths at about 100 BPM, change key every four bars around the cycle of fourths, land on the 3rd of the I in all 12 keys, and perform the capstone study and your own 12-bar chorus built on the path.', [
        S('mm-perf', 'Performance tempo', 'improv', 'Fast lines that still follow the changes.', [
          R_('mm-fast', 'A fast 12-bar in 16ths: switch, mix and follow ({key})', 'edge', { form: 'twelve', rule: ['switch', 'mix', 'follow'], dirs: ['up', 'down'], step: 0.25, goal: 100, start: 58, why: 'At speed the choices have to be automatic. Climb the tempo ladder and keep every target landing.', instr: 'Plan: {plan}. Start at the start tempo, add a few BPM after each clean chorus. Pass: a clean chorus at the goal tempo.', watch: 'Missing targets as the tempo rises.', simplify: 'Triplets.' }),
          R_('mm-keys-fast', 'A new key every 4 bars at tempo: the switch around the cycle of fourths', 'interleaving', { form: 'four', rule: 'switch', keys: [0, 5, 10, 3, 8, 1], dirs: ['down', 'up'], step: 0.25, goal: 96, why: 'Six keys in a row without stopping: the rule has to work wherever the hand lands.', instr: 'Each key a 4-bar blues with the switch, in 16ths; look ahead to the next root on the low E during the last beat of each key. Pass: all six keys at the goal tempo.', watch: 'Stopping between keys.', simplify: 'Three keys.' })],
          ST('Performance tempo is reached in small steps on choices that are already automatic.', 'The goal is the same decisions, faster.', ['Add 3–5 BPM only after two clean choruses.'])),
        S('mm-anykey', 'Any key', 'fretboard', 'The 3rd of the I in all 12 keys.', [
          R_('mm-12-thirds', 'All 12 keys around the cycle of fourths: land on the 3rd of each I chord', 'interleaving', { form: [0], rule: 'maj', keys: [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7], dirs: ['up'], goal: 92, why: 'The 3rd of the I chord is the one note that announces the major side. Finding it instantly in every key is the core of the skill.', instr: 'One bar per key: a short major-pentatonic run into the 3rd of the I chord, held with vibrato. The 3rd is a fret above the ♭3 of the minor box. Pass: all 12 keys in time without stopping.', watch: 'Landing on the ♭3 in a hurry.', simplify: 'The first six keys.' }),
          c => targetGuide(c, { prog: 'blues9', scale: 'blues', name: 'Blues with 9th chords: mix the two sides, land on chord tones' })],
          ST('In every key, the 3rd is one fret above the ♭3 and a major 3rd above the root.', 'Finding it anywhere is what makes the mixed sound available in any song.', ['Around the cycle of fourths each new root is the old chord’s IV.'])),
        S('mm-voice', 'Your own voice', 'improv', 'A 12-bar study, then your own.', [c => mmEtude(c), c => targetGuide(c, { prog: 'blues', scale: 'majorPent', name: 'Your own chorus: plan the sets bar by bar, then play it' })],
          ST('The capstone study plans a chorus of sets and targets; then you write your own plan and play it.', 'Mastery is choosing the sweet or the blue side on purpose, every bar.', ['Write the plan first: chord, set, target.']))
      ], [9, 10])
  ]
});
