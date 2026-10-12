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
  return mod12(K + (d === 0 ? 4 : d === 5 ? 3 : 7));
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
/** The app plays a phrase from the major or the minor pentatonic over the I7 chord; name which (hear it first). */
export function mmHear(c) {
  const K = mod12(c.key), notes = [], ans = []; let seed = 7 + (c.lvl || 2);
  for (let i = 0; i < 6; i++) {
    seed = (seed * 9301 + 49297) % 233280; const set = seed % 2 ? 'maj' : 'min', pcs = SETS[set].map(x => mod12(K + x)), list = notesIn(pcs, windowOf(K, 'root'));
    const ti = idxNear(list, set === 'maj' ? mod12(K + 4) : mod12(K + 3)), idx = [ti + 2, ti + 1, ti, ti - 1, ti].map(x => Math.max(0, Math.min(list.length - 1, x)));
    idx.forEach((x, j) => notes.push(tag(N(list[x].s, list[x].f, i * 8 + j * 0.5, j === 4 ? 2 : 0.5), pcs))); ans.push(set === 'maj' ? 'major' : 'minor');
  }
  return make(c, {
    id: 'mm-hear', name: `Hear it: major or minor pentatonic over ${nameOf(K)}7?`, domain: 'ear', method: 'audiation', unit: '8th notes', goal: 84, start: 50, minutes: 4, backing: [chordOf(K, 0)], chords: [chordOf(K, 0)],
    why: 'Over a dominant 7th chord both pentatonics work, but they sound different: the major one sweet and country-soul, the minor one tough and bluesy. Hearing the difference is what lets you choose on purpose.',
    instr: `Cover the tab. Each phrase lands on the 3rd (major) or the ♭3 (minor) of the chord; then four beats of silence: say “major” or “minor”, then sing the last note. Answers: ${ans.join(', ')}. Pass: 5 of 6 right, twice.`,
    watch: 'Guessing from the first note: listen to the note the phrase lands on.', simplify: 'Listen to only the last note of each phrase.', tab: { notes }
  });
}
/** Degrees called from memory: the 3rd, ♭3, 6th, ♭7 and root of the key in the root position (retrieval). */
export function mmRecall(c) {
  const K = mod12(c.key), list = notesIn(SETS.mix.map(x => mod12(K + x)), windowOf(K, 'root')), want = [4, 3, 9, 10, 0, 2, 4, 3], notes = [], allow = SETS.mix.map(x => mod12(K + x));
  want.forEach((iv, i) => { const p = list[idxNear(list, mod12(K + iv))]; notes.push(tag(N(p.s, p.f, i * 2, 2), allow)); });
  return make(c, {
    id: 'mm-recall', name: `From memory: find the 3, ♭3, 6, ♭7 and root of ${nameOf(K)} in one position`, domain: 'fretboard', method: 'retrieval', unit: 'half notes', goal: 80, start: 50, minutes: 4,
    why: 'The difference between the two scales is three notes: the major side has the 3rd, 6th and 2nd, the minor side the ♭3, 4th and ♭7. Finding them on demand is the whole skill.',
    instr: `Cover the tab. Play, in order, the ${want.map(x => DEG[x]).join(', ')} of ${nameOf(K)}, all in the position around the root on the low E (frets ${windowOf(K, 'root').join('–')}). Say each degree before you play it. Pass: all eight from memory, twice.`,
    watch: 'Mixing up the ♭3 and the 3: they are a fret apart.', simplify: 'Only the 3 and ♭3.', tab: { notes }
  });
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
    instr: 'Learn it two bars at a time, then join them. Say the set before each pair of bars (major, minor, mixed, the chord’s own). Then write your own chorus with the same plan of sets. Pass: the whole chorus at the goal tempo with every bar landing on its target, then your own version once.',
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
  sources: ['https://www.premierguitar.com/articles/25911-blue-horizons-how-to-mix-major-and-minor-pentatonics', 'https://community.justinguitar.com/t/major-pentatonic-in-the-blues/2095', 'https://www.guitarworld.com/lessons/three-essential-blues-scales-every-guitarist-should-know', 'https://www.premierguitar.com/lessons/many-sides-of-john-mayer', 'https://www.musicradar.com/how-to/john-mayer-guitar-lesson'],
  ctx: { key: 9, minor: false, prog: 'blues' },
  stages: [
    stage('foundations', 'Two pentatonics, one root',
      'Play the minor and the major pentatonic of the same root up and back in one position at 90 BPM in 8ths, find the major one by moving the minor shape down three frets, name major or minor by ear (5 of 6), find the 3 and ♭3 from memory, play the ♭3-to-3 curl into the root, and play major on the I and minor on the IV over a 4-bar blues.', [
        S('mm-two', 'The two shapes', 'fretboard', 'Minor box 1, the major pentatonic from the same root, and the three-fret move.', [
          c => mmBox(c, { set: 'min', id: 'mm-minbox', name: 'The {key} minor pentatonic, box 1, up and back', method: 'accurate-reps', why: 'The minor pentatonic (R ♭3 4 5 ♭7) is the home base of blues soloing. It is half of this path, so it has to be clean before the major side is added.', instr: 'Box 1 from the root on the low E, up and back in 8ths, naming the roots. Pass: up and back 4 times clean in a row.', watch: 'Rushing the string changes.', simplify: 'Quarter notes.' }),
          c => mmBox(c, { set: 'maj', pos: 'low', id: 'mm-majbox', name: 'The {key} major pentatonic: the same shape three frets lower', method: 'chunking', why: 'Move the minor box-1 shape down three frets and it becomes the major pentatonic of the same root (R 2 3 5 6): one shape, two scales. The root is now under the pinky on the low E.', instr: 'Play the minor box-1 shape with the index three frets lower than before. Find the root (pinky, low E) first, then play up and back. Pass: up and back 4 times clean, saying “root” on each root.', watch: 'Treating the first note as the root: in this position the root is under the pinky.', simplify: 'Only the bottom three strings.' }),
          c => mmBox(c, { set: 'maj', pos: 'root', id: 'mm-majroot', name: 'The {key} major pentatonic around the same root as box 1', method: 'accurate-reps', why: 'The major pentatonic can also be played around the same root as minor box 1, so both scales sit under one hand position and you can switch without moving.', instr: 'Same hand position as minor box 1 (index around the root fret, a fret behind allowed). Up and back in 8ths. Pass: 4 clean passes, then alternate one pass minor, one pass major.', watch: 'Drifting into the minor notes out of habit.', simplify: 'The top four strings.' })],
          ST('Every root has two pentatonics: minor (R ♭3 4 5 ♭7) and major (R 2 3 5 6). They share the root and the 5th; the rest differ.', 'Over a dominant blues both are right, each with its own mood; good blues players switch between them all the time.', ['The minor shape moved down three frets gives the major pentatonic of the same root (it is the minor pentatonic of the relative minor).', 'Shared notes: R and 5. Major only: 2, 3, 6. Minor only: ♭3, 4, ♭7.'])),
        S('mm-know', 'Hear it, find it', 'ear', 'Major or minor by ear; the key notes from memory.', [c => mmHear(c), c => mmRecall(c)],
          ST('The 3rd and the ♭3 decide the sound: land on the 3 and the line sounds sweet, land on the ♭3 and it sounds blue.', 'Hearing and finding the deciding notes is what lets you choose the sound on purpose.', ['The ♭3 is one fret below the 3.', 'Over a dominant chord the ♭3 is a “blue” clash that wants to rise to the 3.'])),
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
      'Solo over a 12-bar blues in triplets at 100 BPM switching scales with the chords and landing on each bar’s target, play the combined eight-note scale with the curl, land on named targets from memory, switch every two beats, use the next position up, change key every chorus, and improvise a chorus with call and response.', [
        S('mm-switch', 'The switch', 'improv', 'Major on I, minor on IV, over the 4-bar loop and the 12-bar.', [
          R_('mm-switch-12', 'A 12-bar blues in {key}: the switch, every bar into its target', 'variable', { form: 'twelve', rule: 'switch', dirs: ['up', 'down', 'down', 'up'], goal: 100, why: 'The full 12-bar form: four bars of the I, two of the IV, two of the I, then V–IV–I–V. Every bar runs into its target in the bar’s scale, alternating directions.', instr: 'Plan: {plan}. Each bar a run into its target, held on beat 4. Pass: the chorus twice without a wrong-scale note, then a chorus of your own with the same rule.', watch: 'Losing the form in bars 9–12: say the chords.', simplify: 'Only bars 1–8.' }),
          R_('mm-quick', 'Quick-change 12-bar: the IV in bar 2 ({key})', 'variable', { form: 'quick', rule: 'switch', dirs: ['down', 'up'], goal: 100, why: 'The quick change moves to the IV chord in bar 2 and back: the scale has to switch after one bar, which is where the habit of following the chords really forms.', instr: 'Same rule, quick-change form: {plan}. Pass: twice through without missing the bar-2 switch.', watch: 'Staying major in bar 2.', simplify: '8th notes.' }),
          R_('mm-half', 'A switch every two beats: I and IV alternating ({key})', 'interleaving', { form: [0, 5, 0, 5, 0, 5, 7, 7], rule: 'switch', dirs: ['up', 'down'], goal: 96, step: 1 / 3, why: 'Switching scale every bar, over and over, is the hardest form of the rule: the hand has to change notes in the same position without stopping.', instr: 'Bars alternate I and IV, then two bars of V: {plan}. Pass: twice through with every target landing.', watch: 'Mixing the scales inside one bar.', simplify: 'Half tempo.' })],
          ST('Following the chord means the scale changes at the bar line, not when it’s convenient.', 'Chord-following is what separates a blues solo that “fits” from one that just stays in key.', ['12-bar: I I I I · IV IV I I · V IV I V.', 'Quick change: I IV I I · IV IV I I · V IV I V.'])),
        S('mm-mix', 'The combined scale', 'fretboard', 'All eight notes; the curl inside a run; targets from memory.', [
          R_('mm-mix-run', 'The combined scale over the 4-bar blues: runs through all eight notes ({key})', 'variable', { form: 'four', rule: 'mix', dirs: ['up', 'down'], goal: 100, why: 'Together the two pentatonics make an eight-note scale (R 2 ♭3 3 4 5 6 ♭7): Mixolydian plus the ♭3. Running through it shows how the extra notes sit between the familiar ones.', instr: 'Each bar a run in the combined scale into the bar’s target. Notice the ♭3 and 3 side by side. Pass: twice through clean at the goal tempo.', watch: 'Landing on the ♭3 over the I chord.', simplify: '8th notes.' }),
          R_('mm-mix-seq', 'Threes through the combined scale, into the target ({key})', 'chunking', { form: 'four', rule: 'mix', motif: 'seq', dirs: ['down', 'up'], goal: 96, why: 'Groups of three break the eight-note scale into small, singable pieces and make it sound like phrases rather than a scale.', instr: 'Learn one bar’s groups at a time, then join the bars. Each bar ends on its target. Pass: the 4 bars twice in time.', watch: 'Losing the group of three at the string changes.', simplify: 'One bar, looped.' }),
          R_('mm-targets', 'Targets from memory: 3 on the I, ♭7 on the IV, root on the V ({key})', 'retrieval', { form: 'twelve', rule: 'mix', motif: 'whole', goal: 90, start: 60, why: 'The target note of each chord is what makes a mixed line sound intentional. Recalling it before the bar arrives is the skill improvising needs.', instr: 'Cover the tab. Each bar, play only the target as a whole note with vibrato: the 3rd of the I, the ♭7 of the IV (the key’s ♭3), the root of the V. Say it before each bar. Pass: the 12 bars from memory twice.', watch: 'Playing the key’s 3rd over the IV: that clashes.', simplify: 'Bars 1–6.' })],
          ST('The combined scale is the major and minor pentatonic together: R 2 ♭3 3 4 5 6 ♭7. Its two halves suit different chords.', 'Many great blues phrases use both halves in one line, steered by where they land.', ['Over I7: land on R, 3, 5 or ♭7.', 'Over IV7: land on the key’s ♭3 (the chord’s ♭7) or the key’s 6 (its 3rd).'])),
        S('mm-keys', 'Positions and keys', 'fretboard', 'The next position up; four keys.', [
          R_('mm-up', 'The switch in the next position up the neck ({key})', 'variable', { form: 'four', rule: 'switch', pos: 'up', dirs: ['up', 'down'], goal: 96, why: 'The same rule in the position above: different shapes, the same targets.', instr: 'Each bar in the bar’s scale, landing on the target, in the position just above the root position. Pass: twice through clean.', watch: 'Sliding back to the root position.', simplify: '8th notes.' }),
          R_('mm-keys', 'The switch in four keys around the cycle of fourths, one 4-bar blues each', 'interleaving', { form: 'four', rule: 'switch', keys: [0, 5, 10, 3], dirs: ['up', 'down'], goal: 96, dl: 1, why: 'A new key every four bars: find the root, then both scales around it at once.', instr: 'Each key a 4-bar blues with the switch. Name the key and its 3rd before it starts. Pass: all four keys without stopping.', watch: 'Carrying the last key’s position over.', simplify: 'Two keys.' })],
          ST('Both scales move with the root: in any key and position the rule stays the same.', 'Real songs come in every key; the rule must travel.', ['Find the root on the low E, then the 3 one fret above the ♭3.'])),
        S('mm-music-i', 'In a solo', 'improv', 'A chorus of your own.', [c => targetGuide(c, { prog: 'blues', scale: 'majorPent', name: 'Solo over the blues: major pentatonic on the I, minor on the IV, land on the guide notes' }), M('transfer', ['callResponse', { chords: '$blues', scale: 'blues' }])],
          ST('A solo built from two scales needs one plan: where each phrase lands.', 'Landing notes make mixed phrases sound deliberate.', ['End phrases on the 3 over the I and the ♭7 over the IV.']))
      ], [4, 6]),
    stage('advanced', 'Following every chord',
      'Follow the changes with each chord’s own major pentatonic over a 12-bar in 16ths at 90 BPM, mix major and minor across two positions, play the scale called for each bar from memory, curl and resolve in every position, and solo a shuffle and a slow blues mixing the two on purpose.', [
        S('mm-follow', 'Each chord’s own scale', 'improv', 'The major pentatonic of the I, IV and V in turn.', [
          R_('mm-follow-4', 'Follow the chords: the major pentatonic of each chord, landing on its 3rd ({key})', 'variable', { form: 'four', rule: 'follow', target: 'third', dirs: ['up', 'down'], goal: 96, why: 'The next step past the switch: over each chord play that chord’s own major pentatonic and land on its 3rd. The line now outlines every change, the sound of country-blues and soul players.', instr: 'Plan: {plan}. Each bar runs into its chord’s 3rd. Pass: twice through with every 3rd landing.', watch: 'Staying in the I chord’s scale over the IV.', simplify: 'Triplets.' }),
          R_('mm-follow-12', '12-bar, mixing the methods: switch, follow and mixed by bar ({key})', 'interleaving', { form: 'twelve', rule: ['maj', 'mix', 'switch', 'maj', 'min', 'follow', 'mix', 'maj', 'follow', 'min', 'switch', 'follow'], dirs: ['down', 'up', 'up'], goal: 96, why: 'Changing the method every bar (the I’s major scale, the mixed scale, each chord’s own scale) forces a real choice at each bar line.', instr: 'Plan: {plan}. Read the chord and the method, then play into the target. Pass: twice through without a wrong-set note.', watch: 'Defaulting to one scale for the whole chorus.', simplify: 'Bars 1–8.' })],
          ST('Each chord of a blues has its own major pentatonic: over IV7 its 3rd is the key’s 6, over V7 its 3rd is the key’s major 7.', 'Following each chord makes a solo sound like it knows the changes.', ['The V chord’s 3rd is a half step below the key’s root: a strong pull home.'])),
        S('mm-neck', 'Two positions, from memory', 'fretboard', 'The mix across positions; sets called by bar.', [
          R_('mm-neck', 'The mixed scale across the root position and the one above ({key})', 'variable', { form: 'twelve', rule: 'mix', pos: ['root', 'up'], dirs: ['up', 'down'], goal: 96, why: 'Alternating two positions bar by bar makes the mixed scale a map of the neck rather than one box.', instr: 'Odd bars in the root position, even bars in the position above, each into its target. Pass: twice through clean.', watch: 'Late shifts at the bar line.', simplify: 'Four bars.' }),
          R_('mm-called', 'Sets called by bar: minor, major, mixed, chord’s own, from memory ({key})', 'retrieval', { form: 'twelve', rule: ['min', 'maj', 'mix', 'follow'], motif: 'seq', dirs: ['down', 'up'], goal: 92, why: 'Recalling which notes belong to each named set, at speed, is what lets you choose a sound in the moment.', instr: 'Cover the tab. The set for each bar cycles minor, major, mixed, chord’s own: {plan}. Say it before the bar. Pass: the chorus from memory with every target landing.', watch: 'Saying the set but playing the last one.', simplify: 'Four bars.' })],
          ST('The same eight notes exist in every position; the targets don’t move, only the fingerings.', 'Phrases that move across the neck sound freer than those trapped in one box.', ['Shift on the first note of a bar.'])),
        S('mm-color', 'Curls everywhere', 'fretting', 'The curl and its resolution in every position.', [
          R_('mm-curl-pos', 'The curl in three positions over the I chord ({key})', 'external-focus', { form: [0, 0, 0, 0, 0, 0], rule: 'maj', motif: 'curl', pos: ['low', 'root', 'up'], step: 1 / 3, goal: 92, why: 'The ♭3-to-3 move exists in every position; listening to its pitch in each one keeps it in tune when you move.', instr: 'Two bars in each position: the curl, the 5th and root, the 3rd held. Listen for the 3rd matching the chord exactly. Pass: all six bars with every 3rd in tune.', watch: 'An early hammer-on, before the beat.', simplify: 'One position.' }),
          R_('mm-turnaround', 'The last four bars: V–IV–I–V with the switch, into the next chorus ({key})', 'variable', { form: [7, 5, 0, 7], rule: ['follow', 'min', 'maj', 'follow'], dirs: ['down', 'down', 'up', 'up'], step: 0.25, goal: 92, why: 'The turnaround is where the changes come fastest; each bar needs its own set and target.', instr: 'Plan: {plan}. In 16ths, each bar into its target. Pass: twice through in time.', watch: 'Rushing bar 4 into the next chorus.', simplify: 'Triplets.' })],
          ST('The curl can live on any string and in any position; it always resolves the ♭3 to the 3 over the I.', 'Using it everywhere keeps the mixed sound alive all over the neck.', ['The V chord bar can use its own major pentatonic, landing on its 3rd, the key’s leading tone.'])),
        S('mm-music-a', 'In real music', 'improv', 'A shuffle and a slow blues.', [c => targetGuide(c, { prog: 'blues', scale: 'blues', name: 'Shuffle solo: major on the I, minor on the IV, curls everywhere' }), c => targetGuide(c, { prog: 'slowBlues', scale: 'majorPent', name: 'Slow blues: sweet major lines on the I, blue minor lines on the IV' })],
          ST('In a real solo, the two scales are colours you choose phrase by phrase.', 'Contrast between the sweet and the blue side is what makes a blues solo tell a story.', ['Plan a chorus: major first, minor in the middle, both at the end.']))
      ], [7, 8]),
    stage('mastery', 'Any key, at speed, your own',
      'Play a 12-bar mixing all methods in 16ths at about 100 BPM, change key every chorus around the cycle of fourths, land on the 3rd of the I in all 12 keys from memory, and perform your own 12-bar chorus built on the path.', [
        S('mm-perf', 'Performance tempo', 'improv', 'Fast lines that still follow the changes.', [
          R_('mm-fast', 'A fast 12-bar in 16ths: switch, mix and follow ({key})', 'edge', { form: 'twelve', rule: ['switch', 'mix', 'follow'], dirs: ['up', 'down'], step: 0.25, goal: 100, start: 58, why: 'At speed the choices have to be automatic. Climb the tempo ladder and keep every target landing.', instr: 'Plan: {plan}. Start at the start tempo, add a few BPM after each clean chorus. Pass: a clean chorus at the goal tempo.', watch: 'Missing targets as the tempo rises.', simplify: 'Triplets.' }),
          R_('mm-keys-fast', 'A new key every 4 bars at tempo: the switch around the cycle of fourths', 'interleaving', { form: 'four', rule: 'switch', keys: [0, 5, 10, 3, 8, 1], dirs: ['down', 'up'], step: 0.25, goal: 96, why: 'Six keys in a row without stopping: the rule has to work wherever the hand lands.', instr: 'Each key a 4-bar blues with the switch, in 16ths. Name the key and its 3rd during the last beat of the previous key. Pass: all six keys at the goal tempo.', watch: 'Stopping between keys.', simplify: 'Three keys.' })],
          ST('Performance tempo is reached in small steps on choices that are already automatic.', 'The goal is the same decisions, faster.', ['Add 3–5 BPM only after two clean choruses.'])),
        S('mm-anykey', 'Any key', 'fretboard', 'The 3rd of the I in all 12 keys.', [
          R_('mm-12-thirds', 'All 12 keys around the cycle of fourths: land on the 3rd of each I chord', 'retrieval', { form: [0], rule: 'maj', keys: [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7], dirs: ['up'], goal: 92, why: 'The 3rd of the I chord is the one note that announces the major side. Finding it instantly in every key is the core of the skill.', instr: 'One bar per key: a short major-pentatonic run into the 3rd of the I chord. Say the key and its 3rd before each bar. Pass: all 12 keys in time, then the first six from memory.', watch: 'Landing on the ♭3 in a hurry.', simplify: 'The first six keys.' }),
          c => targetGuide(c, { prog: 'blues9', scale: 'blues', name: 'Blues with 9th chords: mix the two sides, land on chord tones' })],
          ST('In every key, the 3rd is one fret above the ♭3 and a major 3rd above the root.', 'Finding it anywhere is what makes the mixed sound available in any song.', ['Around the cycle of fourths each new root is the old chord’s IV.'])),
        S('mm-voice', 'Your own voice', 'improv', 'A 12-bar study, then your own.', [c => mmEtude(c), c => targetGuide(c, { prog: 'blues', scale: 'majorPent', name: 'Your own chorus: plan the sets bar by bar, then play it' })],
          ST('The capstone study plans a chorus of sets and targets; then you write your own plan and play it.', 'Mastery is choosing the sweet or the blue side on purpose, every bar.', ['Write the plan first: chord, set, target.']))
      ], [9, 10])
  ]
});
