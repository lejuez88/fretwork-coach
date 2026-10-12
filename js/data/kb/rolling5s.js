// Rolling 5s: Eric Johnson's five-note pentatonic pattern, played two notes per string (2 + 2 + 1
// across three strings) against a 16th-note pulse so the accent rolls across the beat. Rebuilt
// 2026-10-12 on the player's correction: the pattern is two notes per string, not a generic group of
// five stepping through the scale, and it comes in two picking versions:
//   - ECONOMY ('econ'): each next group starts one string lower (two scale notes later), so the fifth
//     note and the first note of the next group are two downstrokes in a row: the pick sweeps back to
//     the previous string in one direction. Every group is down–up–down–up–down, and inside a group the
//     pick changes strings after upstrokes (a downward pickslant).
//   - JUMP-BACK ('jump'): each next group starts on the second note of the group before, so after the
//     fifth note the pick jumps back up to it (two strings back when the group began on a string's first
//     note, one string when it began on its second), with strict alternate picking: the groups start
//     alternately on a downstroke and an upstroke.
// From counting one 2+2+1 group to quintuplets, rolling 16ths, every box, every key and the whole neck.
//
// Concept-first (CONTENT.md): the model is a pentatonic box as its ordered two-notes-per-string list,
// the grouping rule (`fives(list, variant, dir)`: windows of five, starting every two notes for the
// economy version or every note for the jump-back version) and the rhythmic relation between the group
// and the pulse: five per beat (quintuplets: the group lines up with the click) or four per beat (16ths:
// the group starts a 16th later every beat and comes round after five beats). The composer
// `roll5(c, spec)` builds an exercise from variant × boxes × strings × direction × pulse (8ths,
// quintuplets, 16ths) × articulation (picked, with the strokes marked, or slurred) × keys.
import { OPEN, N, nameOf, minorKey, make, pentBox, byString, mod12, goalFor, S, stage, entry, M, targetGuide } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [0.25, '16th notes (groups of 5)'], [0.2, '16th-note quintuplets']]);
const unitName = step => UNIT.get(step) || '16th notes';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** A box as [string, fret] pairs, low to high, two notes per string (box 1–5). */
export function shape5(k, shape = 'box', b = 1) { const n = pentBox(k, b); return n ? n.map(x => [x.s, x.f]) : null; }
export const VARIANT_NAME = { econ: 'economy (sweep back one string)', jump: 'jump-back (strict alternate)' };
/**
 * The groups of five of a two-notes-per-string list. dir 'down': from the highest note down (each string
 * high fret first); 'up': from the lowest note up. econ: a group starts every two notes (each string's
 * first note), so each group is 2 + 2 + 1 across three strings; jump: a group starts on every note.
 * Returns an array of groups, each five [string, fret] pairs.
 */
export function fives(list, variant = 'econ', dir = 'down') {
  const r = dir === 'down' ? list.slice().reverse() : list.slice(), hop = variant === 'jump' ? 1 : 2, out = [];
  for (let i = 0; i + 5 <= r.length; i += hop) out.push(r.slice(i, i + 5));
  return out;
}
/** Pick strokes for a run of groups: econ = every group D U D U D (U D U D U climbing); jump = strict alternation. */
export function strokes(nGroups, variant = 'econ', dir = 'down') {
  const out = [];
  for (let g = 0; g < nGroups; g++) for (let i = 0; i < 5; i++) {
    if (variant === 'jump') out.push((g * 5 + i) % 2 ? 'u' : 'd');
    else out.push(dir === 'up' ? (i % 2 ? 'd' : 'u') : (i % 2 ? 'u' : 'd'));
  }
  return out;
}
/** Slur marks: each group's first note and each new string picked, the second note on a string slurred. */
function slur(seq) { return seq.map(([s, f], i) => { const p = seq[i - 1]; return [s, f, i % 5 === 0 || !p || p[0] !== s || p[1] === f ? null : f > p[1] ? 'h' : 'p']; }); }
const endOf = notes => Math.max(...notes.map(n => n.t + n.d));
function landOnRoot(notes, k, list) {
  const root = list.find(([s, f]) => s >= 3 && mod12(pitch(s, f) - k) === 0) || list.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || list[0];
  const t = endOf(notes), bar = Math.ceil((t + 1) / 4) * 4; notes.push(N(root[0], root[1], t, bar - t, '~')); return notes;
}

/* ------------------------------- The composer ------------------------------- */
/**
 * One exercise from a spec: { id, name ('{key}'), method, variant ('econ' | 'jump'), boxes, strings,
 * dir ('down' | 'up' | 'alt'), groups (per box), step (0.5 8ths, 0.2 quintuplets, 0.25 16ths),
 * legato, marks (pick strokes on the first groups; default on when picked), keys, goal, start, dl,
 * why, instr, watch, simplify }.
 */
export function roll5(c, spec) {
  const k0 = minorKey(c), step = spec.step || 0.25, variant = spec.variant || 'econ', seq = [], picks = []; let last = null, n = 0;
  for (const off of spec.keys || [0]) for (const b of spec.boxes || [1]) {
    const k = mod12(k0 + off), v = spec.variants ? spec.variants[n % spec.variants.length] : variant; let list = shape5(k, 'box', b); if (!list) return null;
    if (spec.strings) list = list.filter(([s]) => spec.strings.includes(s));
    const dir = spec.dir === 'alt' ? (n % 2 ? 'up' : 'down') : spec.dir || 'down'; n++;
    let g = fives(list, v, dir); if (spec.groups) g = g.slice(0, spec.groups);
    const pk = strokes(g.length, v, dir); seq.push(...g.flat()); picks.push(...pk); if (v === 'jump') picks.splice(picks.length - pk.length, pk.length, ...pk.map((x, i) => ((seq.length - pk.length + i) % 2 ? 'u' : 'd'))); last = { k, list };
  }
  if (seq.length < 10) return null;
  const marked = spec.legato ? slur(seq.slice(0, 300)) : seq.slice(0, 300).map(([s, f]) => [s, f, null]);
  const showPicks = !spec.legato && spec.marks !== false;
  const notes = landOnRoot(marked.map(([s, f, x], i) => N(s, f, i * step, step, x, showPicks && i < 10 ? { pick: picks[i] } : null)), last.k, last.list);
  return make(c, {
    id: spec.id, name: spec.name.replace('{key}', `${nameOf(k0)} minor`), domain: spec.domain || 'picking', method: spec.method, unit: unitName(step), goal: spec.goal || 96, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    picking: spec.legato ? 'legato' : variant === 'jump' && !spec.variants ? 'strict' : 'economy',
    why: spec.why, instr: spec.instr, watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
/** The declared structure of each version (see content/REQUESTS.md, 2026-10-11 "Stop wrong signature patterns"). */
export const PATTERN = {
  econ: { name: 'Eric Johnson fives, economy version', notesPerString: '2 + 2 + 1 across three strings (2-notes-per-string box)', stringOrder: 'descending: X X, X−1 X−1, X−2; next group starts on X−1', picking: 'D U D U D per group; D D sweep back one string at each join (downward pickslant)', sources: ['https://guitarcontrol.com/pentatonic-licks/eric-johnson-trademark-rolling-fives-lick/', 'https://forum.troygrady.com/t/eric-johnson-five-note-pentatonic-pattern-what-is-it/47307', 'https://www.guitarworld.com/lessons/cracking-code-eric-johnsons-pickslanting-pentatonics'], confirmed: 'secondary' },
  jump: { name: 'Eric Johnson fives, jump-back version', notesPerString: '2 + 2 + 1 (or 1 + 2 + 2) across three strings', stringOrder: 'descending; next group starts on the previous group’s 2nd note (2 strings back, or 1)', picking: 'strict alternate; groups start alternately D and U', sources: ['player specification 2026-10-11'], confirmed: 'unconfirmed' }
};
const R5 = (id, name, method, opts) => c => { const x = roll5(c, { id, name, method, ...opts }); const vs = [...new Set(opts.variants || [opts.variant || 'econ'])]; return x ? { ...x, pattern: vs.length === 1 ? PATTERN[vs[0]] : vs.map(v => PATTERN[v]) } : x; };
const ECON = 'Two notes per string, five per group (2 + 2 + 1 across three strings); each next group starts one string lower. Picking: down–up–down–up–down in every group, so the strings change after upstrokes, and the fifth note and the next group’s first note are two downstrokes in a row: one small sweep back to the string above. ';
const JUMP = 'Two notes per string, five per group; each next group starts on the second note of the group before, so after the fifth note the pick jumps back up to it (two strings back, or one). Strict alternate picking: the groups start alternately on a downstroke and an upstroke. ';

/* --------------------------- Existing lesson (kept ids) --------------------------- */
/**
 * Rolling 5s, the economy version in 16ths (also used by the pentatonic path): descending, down box 2
 * then box 1; ascending, up box 1 then box 2; along the neck (`diagonal`, kept for the old id), every
 * box from 1 to 5 in turn. Eight groups per two boxes.
 */
export function ejRolling5s(c, { dir = 'down', diagonal = false } = {}) {
  const boxes = diagonal ? (dir === 'down' ? [5, 4, 3, 2, 1] : [1, 2, 3, 4, 5]) : dir === 'down' ? [2, 1] : [1, 2];
  const x = roll5(c, { id: `ej-rolling5-${dir}${diagonal ? '-diag' : ''}`, name: `Rolling 5s ${dir === 'down' ? 'descending' : 'ascending'}, economy picked, ${diagonal ? 'through all five boxes along the neck' : dir === 'down' ? 'box 2 then box 1' : 'box 1 then box 2'} ({key})`, method: 'variable',
    variant: 'econ', boxes, dir, step: 0.25, goal: diagonal ? 92 : 100, start: 50, dl: diagonal ? 2 : 1,
    why: 'Eric Johnson’s rolling fives are two notes per string, five per group, so each group spans three strings and the next one starts a string lower. Played as 16ths against a quarter-note click the group restarts on a different part of the beat each time: that is the cascading, rolling sound.',
    instr: ECON + `${diagonal ? 'Go through every box in turn (5, 4, 3, 2, 1 going down; 1 to 5 going up), shifting on the first note of a new box.' : 'Four groups per box.'} Accent the first note of each group while the click stays on quarter notes: the accent lands on a different 16th every time. ${dir === 'up' ? 'Climbing, the strokes flip: up–down–up–down–up, and the sweep goes up. ' : ''}Pass: the run clean at the goal tempo with the accents audible.`,
    watch: 'Turning the sweep into two separate strokes: the two downstrokes are one motion.', simplify: 'Quintuplets (five notes per click) at half tempo until the groups feel automatic.' });
  return x ? { ...x, minutes: 6, pattern: PATTERN.econ } : x;
}

/* ------------------------------- Generators ------------------------------- */
/** One 2+2+1 group per bar in 8ths, then a rest: count it, each bar one string lower (chunking). */
export function fiveCount(c) {
  const k = minorKey(c), list = shape5(k, 'box', 1); if (!list) return null;
  const g = fives(list, 'econ', 'down'), notes = [];
  g.slice(0, 4).forEach((grp, bar) => grp.forEach(([s, f], i) => notes.push(N(s, f, bar * 4 + i * 0.5, i === 4 ? 1.5 : 0.5, null, { pick: i % 2 ? 'u' : 'd' }))));
  return make(c, {
    id: 'r5-count', name: `Rolling 5s, step one: one 2 + 2 + 1 group per bar (${nameOf(k)} minor pentatonic, box 1)`, domain: 'picking', method: 'chunking',
    unit: '8th notes', goal: 88, start: 50, minutes: 4,
    why: 'The group is two notes on one string, two on the next, one on the third. Before it can roll against the beat it has to be one unit in your hands and your head: one group per bar with a rest after it lets you count it out loud, 1-2-3-4-5.',
    instr: 'Each bar: five notes down box 1 in 8ths, two on the first string, two on the next, one on the third, counting “1 2 3 4 5” aloud, then hold the fifth. Down–up–down–up–down. The next bar starts one string lower. Pass: all four bars counted and played clean, twice.',
    watch: 'Adding a sixth note (the second note on the third string) out of habit.', simplify: 'Quarter notes.', tab: { notes }
  });
}
/** The junction of the economy version alone: the fifth note, the sweep back, the next note (chunking). */
export function sweepJoin(c) {
  const k = minorKey(c), list = shape5(k, 'box', 1); if (!list) return null;
  const [g1, g2] = fives(list, 'econ', 'down'), cellN = [g1[3], g1[4], g2[0]], notes = [], step = (c.lvl || 2) <= 2 ? 0.5 : 1 / 3;
  for (let r = 0; r < 8; r++) cellN.forEach(([s, f], i) => notes.push(N(s, f, (r * 3 + i) * step, step, null, r < 2 ? { pick: ['u', 'd', 'd'][i] } : null)));
  const t = 24 * step; notes.push(N(g2[0][0], g2[0][1], t, Math.ceil((t + 1) / 4) * 4 - t, '~'));
  return make(c, {
    id: 'r5-sweep', name: `Rolling 5s, the join: up, down, and the sweep back a string (${nameOf(k)} minor, box 1)`, domain: 'picking', method: 'chunking',
    unit: step === 0.5 ? '8th notes' : '8th-note triplets', goal: 96, start: 50, minutes: 3,
    why: 'The economy version has one special moment: the fifth note of a group (a downstroke) and the first note of the next group (another downstroke, one string back up) are one small sweep. Looping just that join makes it automatic.',
    instr: 'Three notes: the fourth note of a group (upstroke), the fifth (downstroke, a string lower), then the next group’s first note (downstroke again, back on the string above) in one continuous motion. Loop it. Pass: 8 loops where the two downstrokes sound like two even notes, not a strum.',
    watch: 'Letting the two downstrokes ring together like a chord: fret one, lift the other.', simplify: 'Quarter notes.', tab: { notes }
  });
}
/** The app plays a 2+2+1 group as a quintuplet, then two silent beats: echo it (hear it first). */
export function fiveEcho(c) {
  const k = minorKey(c), list = shape5(k, 'box', 1), rr = rng(83 + (c.lvl || 2)); if (!list) return null;
  const notes = [];
  for (let i = 0; i < 6; i++) { const dir = rr() < 0.5 ? 'down' : 'up', g = fives(list, 'econ', dir), grp = g[Math.floor(rr() * g.length)]; grp.forEach(([s, f], m) => notes.push(N(s, f, i * 4 + m * 0.4, m === 4 ? 1.2 : 0.4))); }
  return make(c, {
    id: 'r5-echo', name: `Hear five, play five: 2 + 2 + 1 echoes (${nameOf(k)} minor pentatonic)`, domain: 'ear', method: 'audiation',
    unit: '8th-note quintuplets', goal: 72, start: 50, minutes: 4,
    why: 'A group of five fills a space in time that two or four notes don’t: hearing it, then echoing it in the same space, builds the feel before the speed.',
    instr: 'Cover the tab. Each group of five (two notes, two notes, one note across three strings) is played over two beats; the next two beats are silent: sing the group, then play it back in the same time. Pass: 4 of 6 echoes with the right notes and the same length, twice.',
    watch: 'Squeezing the echo into one beat.', simplify: 'Echo only the direction (up or down) and the first note.', tab: { notes }
  });
}
/** A phrase: rolling fives down the box into a bend and a held root (use in music). */
export function rollPhrase(c, { fast = false } = {}) {
  const k = minorKey(c), list = shape5(k, 'box', 1), B = byString(pentBox(k, 1)); if (!list || !B[3]) return null;
  const step = fast ? 0.25 : 0.5, g = fives(list, 'econ', 'down'), notes = [], chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  for (let bar = 0; bar < 2; bar++) {
    let t = bar * 8; const take = (fast ? g.slice(bar, bar + 3) : g.slice(bar, bar + 2)).flat();
    take.forEach(([s, f]) => { notes.push(N(s, f, t, step)); t += step; });
    notes.push(N(3, B[3][1], t, 1, 'b', { bendTo: B[3][1] + 2 })); t += 1;
    const root = list.find(([s, f]) => s === 4 && mod12(pitch(s, f) - k) === 0) || list[0];
    notes.push(N(root[0], root[1], t, Math.max(1, bar * 8 + 8 - t), '~'));
  }
  return make(c, {
    id: fast ? 'r5-phrase-fast' : 'r5-phrase', name: `Rolling fives into a bend${fast ? ', at speed' : ''} (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: unitName(step), goal: fast ? 92 : 88, start: 50, minutes: 5, dl: fast ? 1 : 0, backing: chords, chords,
    why: 'The fives cascade down the box and land in a bend into the 5th, then a held root: the run becomes the build-up to a singing note.',
    instr: 'Play the 2 + 2 + 1 groups descending, economy picked, then bend the G-string 4th up a whole step and land on the root with vibrato. Bar 2 starts one string lower. Then make your own ending. Pass: both bars in time with the bend in tune, then four of your own.',
    watch: 'Running out of beat before the bend: the bend lands on a beat.', simplify: 'One group, then the bend.', tab: { notes }
  });
}
/** A random key, box and version every bar (interleaving). */
export function r5Random(c) {
  const rr = rng(1117 + (c.lvl || 9)), notes = [], names = [];
  for (let bar = 0; bar < 8; bar++) {
    const k = Math.floor(rr() * 12), b = 1 + Math.floor(rr() * 5), v = rr() < 0.5 ? 'econ' : 'jump', list = shape5(k, 'box', b); if (!list) return null;
    fives(list, v, 'down').flat().slice(0, 15).forEach(([s, f], i) => notes.push(N(s, f, bar * 4 + i * 0.2, 0.2)));
    notes.push(N(list[7][0], list[7][1], bar * 4 + 3, 1)); names.push(`${nameOf(k)}m box ${b} ${v === 'econ' ? 'economy' : 'jump-back'}`);
  }
  return make(c, {
    id: 'r5-random', name: 'Random access: rolling fives in a new key, box and version every bar', domain: 'fretboard', method: 'interleaving',
    unit: '16th-note quintuplets', goal: 88, start: 50, minutes: 5, dl: 1,
    why: 'At mastery level either version of the pattern should start from any box in any key the moment you need it.',
    instr: `${names.join(' → ')}. Three quintuplet groups down from the top of the box (economy: each a string lower; jump-back: each from the previous group's second note), then a beat to find the next. Read only the names. Pass: all 8 bars from memory at the goal tempo.`,
    watch: 'Mixing the two versions up: say "sweep" or "jump" before each bar.', simplify: 'The first four bars.', tab: { notes }
  });
}
/** An original 8-bar study on rolling fives (capstone). */
export function r5Etude(c) {
  const k = minorKey(c), b1 = shape5(k, 'box', 1), b2 = shape5(k, 'box', 2), b3 = shape5(k, 'box', 3); if (!b1 || !b2 || !b3) return null;
  const notes = [], put = (seq, step, t0, beats) => { let t = t0; for (const [s, f] of seq) { if (t >= t0 + beats - 1e-6) break; notes.push(N(s, f, t, step)); t += step; } };
  const E = (b, d = 'down') => fives(b, 'econ', d).flat(), J = b => fives(b, 'jump', 'down').flat();
  put(E(b1), 0.2, 0, 4);                 // bar 1: economy groups as quintuplets, the group on the beat
  put(E(b1), 0.25, 4, 4);                // bar 2: the same notes as 16ths, the accent rolling
  put(E(b2, 'up'), 0.25, 8, 4);          // bar 3: box 2 climbing
  put(J(b2), 0.25, 12, 4);               // bar 4: the jump-back version falling through box 2
  put([...E(b3), ...E(b2)], 0.25, 16, 8);  // bars 5–6: down box 3, then box 2: the cascade moves down the neck
  put(J(b1), 0.2, 24, 3);                // bar 7: jump-back in box 1 as quintuplets
  const root = b1.find(([s, f]) => s === 4 && mod12(pitch(s, f) - k) === 0) || b1[0];
  notes.push(N(root[0], root[1], 28, 4, '~'));
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: 'r5-capstone-etude', name: `Capstone study: an 8-bar rolling-fives piece (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'quintuplets and 16ths', goal: 88, start: 50, minutes: 8, dl: 1, backing: [...chords, ...chords], chords,
    why: 'An original piece that turns the path into music: economy fives lined up with the beat, the same notes rolling against it, box 2 climbing, the jump-back version falling, a cascade down the neck from box 3, and a held landing.',
    instr: 'Learn it two bars at a time. Bars 1 and 7 are quintuplets (five per click); the rest are 16ths with the accent rolling. Bars 1–3 and 5–6 economy picked (sweep back a string between groups); bars 4 and 7 the jump-back version, strict alternate. Then write your own 8 bars to the same plan. Pass: the study at the goal tempo with no stops, then your own version once.',
    watch: 'Bar 2: keep the 16ths even when the accent stops matching the beat.', simplify: 'Bars 1–4.', tab: { notes }
  });
}
function as(gen, over) { return c => { const x = gen(c); if (!x) return null; const out = { ...x, id: over.id, method: over.method, name: over.name ? over.name(x) : x.name }; if (over.goal) { out.goalBpm = goalFor(c, over.goal); out.startBpm = Math.max(30, Math.min(Math.round(out.goalBpm * 0.6), out.goalBpm - 4)); } if (over.instr) out.instr = over.instr; return out; }; }

/* --------------------------------- The path --------------------------------- */
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'rolling5s', kind: 'technique', title: 'Rolling 5s', domain: 'picking',
  re: /rolling (5|five)'?s?|groups? of (5|five)|\bin (5|five)s\b|quintuplet/,
  aliases: ['groups of five', 'pentatonic in fives', 'quintuplets', 'Eric Johnson fives'],
  summary: 'Eric Johnson’s five-note pentatonic pattern, two notes per string (2 + 2 + 1 across three strings), in its two picking versions (economy: sweep back one string; jump-back: strict alternate, back to the second note) against a 16th-note pulse so the accent rolls: from one counted group to quintuplets, rolling 16ths, every box and key, and the whole neck.',
  prereqs: ['pentatonic', 'alternatePicking'],
  sources: ['https://www.guitarworld.com/lessons/cracking-code-eric-johnsons-pickslanting-pentatonics', 'https://troygrady.com/2015/01/14/eric-johnsons-pickslanting-pentatonics/', 'https://forum.troygrady.com/t/eric-johnson-five-note-pentatonic-pattern-what-is-it/47307', 'https://guitarcontrol.com/pentatonic-licks/eric-johnson-trademark-rolling-fives-lick/', 'https://www.premierguitar.com/eric-johnson-concepts-and-techniques', 'https://guitarworld.com/lessons/eric-johnson-fluid-streams-of-notes'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Feeling five, two notes per string',
      'Count one 2 + 2 + 1 group per bar, loop the sweep join for 8 bars, play the economy version down box 1 as quintuplets at 70 BPM (one group per click), echo a group by ear, play the box in fives from memory, hear the accent roll in slow 16ths, climb in fives, and end a phrase with a run of fives.', [
        S('r5-count', 'One group at a time', 'picking', 'The 2 + 2 + 1 group, the sweep join, then one group per beat.', [c => fiveCount(c), c => sweepJoin(c),
          R5('r5-quint-slow', 'Economy fives: one group per click down box 1 ({key})', 'accurate-reps', { step: 0.2, goal: 72, start: 46, why: 'Five notes per click (quintuplets) line the group up with the beat, so its shape (two, two, one) is easy to feel. Getting it even, with the sweep in the right place, is the first real version of the technique.', instr: ECON + 'One group per click down box 1. Count “1 2 3 4 5” per beat. Count only clean bars. Pass: 4 clean bars in a row.', watch: 'Uneven groups (the sweep rushing the next note).', simplify: '8th notes.' })],
          ST('Eric Johnson’s five-note pattern lives in the pentatonic box, which has two notes on every string: a group is two notes on one string, two on the next and one on the third, and the next group starts one string lower.', 'Two notes per string is what lets the line run so evenly with a pick: every string gets the same down–up pair.', ['Descending in box 1 of A minor: e 8–5, B 8–5, G 7; then B 8–5, G 7–5, D 7; and so on.', 'Each group is down–up–down–up–down; the fifth note and the next group’s first note are two downstrokes: a small sweep back up one string.'])),
        S('r5-hear', 'Hear and recall', 'ear', 'The group by ear and from memory.', [c => fiveEcho(c),
          R5('r5-recall', 'From memory: box 1 in economy fives as quintuplets ({key})', 'retrieval', { step: 0.2, goal: 72, start: 46, marks: false, why: 'The rule (two, two, one, then a string lower) generates the whole run; recalling it from the box instead of reading is what makes it usable in a solo.', instr: ECON + 'All the way down box 1 as quintuplets. Play it once with the tab, then cover it and say the string each group starts on before you play it. Pass: down the box from memory, twice.', watch: 'Starting a group on the second note of a string: in this version every group starts on a string’s first note.', simplify: 'The top four strings.' })],
          ST('A group of five has its own length in time; hearing it and recalling where each group starts (the next string down) makes it automatic.', 'Recall, not reading, is what lets you use the pattern while improvising.', ['In one box the economy version has four groups going down: starting on strings 1, 2, 3 and 4.'])),
        S('r5-feel', 'The roll', 'picking', 'The accent moving against the beat; climbing fives.', [
          R5('r5-roll-slow', 'Hear the roll: economy fives as slow 16ths down box 1 ({key})', 'external-focus', { step: 0.25, goal: 72, start: 46, why: 'The same groups of five played four notes per click no longer match the beat: the accent arrives a 16th later each time and comes round after five beats. That rolling sound is the point, so listen for it.', instr: ECON + 'In 16ths, accenting the first note of each group. Listen: the accents form a pattern that slides against the click. Pass: four bars where the accents are clearly audible and the 16ths stay even.', watch: 'Pausing after each group to line it up with the beat.', simplify: 'Quintuplets first, then switch to 16ths.' }),
          R5('r5-up-slow', 'Climbing fives: box 1 ascending as quintuplets ({key})', 'variable', { dir: 'up', step: 0.2, goal: 72, start: 46, why: 'Turned around, the groups climb (two notes on a string, two on the next, one on the third, then start a string higher), and the strokes flip to up–down–up–down–up so the sweep between groups goes up.', instr: 'Two notes per string, low fret first, five per group; each next group starts one string higher. Up–down–up–down–up in every group; the fifth note and the next group’s first note are two upstrokes in a row. One group per click. Pass: up the box twice clean.', watch: 'Rushing the last group of each string.', simplify: '8th notes.' })],
          ST('Against 16ths a five-note group starts a 16th later each beat: the accent “rolls” and comes back to the beat every five beats (20 sixteenths, four groups).', 'This is the sound of his runs: fast, even notes with an accent pattern that seems to tumble.', ['Five groups of four 16ths = four groups of five = five beats.', 'Climbing, the same rule runs low to high with the strokes reversed.'])),
        S('r5-first-music', 'First music', 'improv', 'Fives into a bend.', [c => rollPhrase(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])],
          ST('A run is only exciting when it lands: here two groups of fives fall into a bend and a held root.', 'Fast runs in a solo set up the long notes.', ['Bend the 4th up to the 5th on the G string, then rest on the root.']))
      ], [1, 3]),
    stage('intermediate', 'Rolling 16ths: both versions, every box',
      'Roll economy fives down and up boxes 1 and 2 as 16ths at 100 BPM, picked and slurred, play the jump-back version (strict alternate) down box 1, switch between the two versions every bar, find box 2 from memory, change key every five beats, and play a fast rolling run into a bend over a minor progression.', [
        S('r5-box', 'Economy fives in boxes 1 and 2', 'picking', 'Down, up, the next box, and the slurred sound.', [c => ejRolling5s(c, { dir: 'down' }), c => ejRolling5s(c, { dir: 'up' }),
          R5('r5-box2', 'Economy fives down box 2 ({key})', 'variable', { boxes: [2], step: 0.25, goal: 96, why: 'The same rule on box 2: the notes and the stretches change, the roll doesn’t.', instr: ECON + 'Down box 2 in 16ths, accent the first of each group. Pass: down the box clean at the goal tempo.', watch: 'The B-string shift in box 2 (its two notes sit a fret higher).', simplify: 'Quintuplets.' }),
          R5('r5-legato', 'Slurred fives: pick the first note on each string, pull off the second ({key})', 'external-focus', { boxes: [1, 2], legato: true, step: 0.25, goal: 100, why: 'Slurring the second note on each string gives the run its fluid, violin-like sound. It only works if the pulled notes are as loud as the picked ones, so the goal is a sound, not a motion.', instr: 'The economy fives down box 1, then box 2, in 16ths: pick the first note on each string, pull off to the second (marked p). Listen for an even stream with the group accents. Pass: down both boxes twice where no slurred note drops out.', watch: 'Weak pull-offs on the high strings.', simplify: 'Quintuplets.' })],
          ST('The economy version moves the same way through every box: two notes per string, a group a string lower each time, a sweep at each join.', 'Every box has two notes on every string, so the rule never changes; only the frets do.', ['Four economy groups per box going down.', 'Slurred, the picked notes are the first note on each string.'])),
        S('r5-jump', 'The jump-back version', 'picking', 'Back to the second note, strict alternate.', [
          R5('r5-jump-slow', 'Jump-back fives as quintuplets down box 1 ({key})', 'chunking', { variant: 'jump', groups: 8, step: 0.2, goal: 80, start: 46, why: 'In the jump-back version each group starts on the second note of the group before: a different line through the same box, with more groups and the pick jumping back up after every fifth note. Learn it one group per click first.', instr: JUMP + 'Learn it in pairs of groups: groups 1–2, then 3–4, then join them. One group per click. Pass: 8 groups down box 1 clean, twice.', watch: 'Falling back into the economy version (starting a group on the next string instead of the second note).', simplify: '8th notes.' }),
          R5('r5-jump', 'Jump-back fives as rolling 16ths, box 1 then box 2 ({key})', 'variable', { variant: 'jump', boxes: [1, 2], groups: 6, step: 0.25, goal: 96, why: 'In 16ths the jump-back version rolls against the beat like the economy one, but the jumps make it sound more angular. Two boxes make the jumps land on new frets.', instr: JUMP + 'Six groups down box 1, six down box 2, in 16ths, accenting each group’s first note. Pass: both boxes clean at the goal tempo.', watch: 'Accenting the stroke instead of the group: half the groups start on an upstroke, accent them anyway.', simplify: 'Quintuplets.' }),
          R5('r5-econ-jump', 'Sweep, then jump: the two versions alternating, box 1 then box 2 ({key})', 'interleaving', { variants: ['econ', 'jump'], groups: 4, boxes: [1, 1, 2, 2], dir: 'down', step: 0.25, goal: 92, why: 'Switching between the two versions makes you choose the picking on purpose instead of by habit.', instr: 'Four groups of the economy version down box 1, then four groups of the jump-back version from the top of box 1, then the same in box 2. Say “sweep” or “jump” before each block. Pass: the four blocks twice without mixing the versions.', watch: 'Mixing the two versions inside one bar.', simplify: 'Quintuplets.' })],
          ST('The jump-back version groups the same box differently: each group starts on the second note of the one before (the next note down), so the pick jumps back up after the fifth note (two strings back after a group that started on a string’s first note, one string after a group that started on its second), and strict alternate picking makes every other group start on an upstroke.', 'Two versions of one pattern give two sounds and two picking motions: smooth and swept, or angular and strictly alternate.', ['Box 1 of A minor, jump-back: e 8–5, B 8–5, G 7; then e 5, B 8–5, G 7–5; then B 8–5, G 7–5, D 7…', 'A twelve-note box gives four economy groups or eight jump-back groups going down.'])),
        S('r5-control', 'Recall and keys', 'fretboard', 'Box 2 from memory, boxes mixed, other keys.', [
          R5('r5-box2-recall', 'From memory: climbing economy fives in box 2 ({key})', 'retrieval', { boxes: [2], dir: 'up', step: 0.25, goal: 92, marks: false, why: 'Recalling the groups in box 2, climbing, without the tab proves you own the rule and the shape.', instr: 'Two notes per string, five per group, each next group a string higher (up–down–up–down–up). Play the box once as a scale, then cover the tab. Pass: twice from memory at the goal tempo.', watch: 'Starting from box 1’s notes.', simplify: 'Quintuplets.' }),
          R5('r5-boxes12', 'Down box 1, up box 2: economy fives that change shape ({key})', 'interleaving', { boxes: [1, 2, 1, 2], dir: 'alt', step: 0.25, goal: 92, why: 'Switching box and direction every four groups makes the run a map of the neck, not one memorised shape.', instr: ECON + 'Four groups down box 1, four up box 2 (strokes reversed), and again. Pass: the cycle twice without stopping.', watch: 'Starting box 2 from the wrong note.', simplify: 'Quintuplets.' }),
          R5('r5-keys', 'Rolling fives in four keys around the cycle of fourths', 'interleaving', { keys: [0, 5, 10, 3], step: 0.25, goal: 92, dl: 1, why: 'The rule moves to any key. Changing key every four groups (five beats) trains finding box 1 at once while the roll continues.', instr: ECON + 'Four groups down box 1 in each key, a 4th up each time. Name the key before it starts. Pass: all four keys without stopping.', watch: 'Stopping at the key change.', simplify: 'Two keys.' })],
          ST('The pattern belongs to the box, not to a key: find box 1 of the new key and the same groups follow.', 'Mixing boxes, directions and keys makes the pattern available anywhere.', ['Box 1 starts on the root on the low E string.', 'Up a 4th: the root moves five frets up (or seven down).'])),
        S('r5-music', 'In a phrase', 'improv', 'The fast run, and a solo.', [c => rollPhrase(c, { fast: true }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo with one rolling run per phrase, landing on a chord tone' })],
          ST('In a solo, a rolling run is a burst that lands on a chord tone or a bend.', 'Speed is only effective next to space.', ['End runs on the root, the 5th or a bend into the 5th.']))
      ], [4, 6]),
    stage('advanced', 'Along the neck',
      'Roll economy fives down and up through all five boxes at 100 BPM, on the bass strings, through boxes 1–3 alternating direction, the jump-back version through the boxes, boxes called out of order from memory, shape a cascade with a crescendo, and use rolling runs in a blues solo.', [
        S('r5-neck', 'Through the boxes', 'fretboard', 'Fives that travel along the neck.', [c => ejRolling5s(c, { dir: 'down', diagonal: true }),
          R5('r5-neck-up', 'Climbing economy fives through all five boxes ({key})', 'variable', { boxes: [1, 2, 3, 4, 5], dir: 'up', step: 0.25, goal: 92, why: 'Climbing in fives box by box moves the hand along the neck inside the run: the ascending answer to the cascade.', instr: 'Up each box in economy fives (up–down–up–down–up, the sweep going up): box 1, then 2, 3, 4 and 5, shifting on the first note of each box. Pass: clean at the goal tempo.', watch: 'Late shifts between boxes that break the 16ths.', simplify: 'Quintuplets.' }),
          R5('r5-jump-neck', 'Jump-back fives through boxes 1 to 3 ({key})', 'variable', { variant: 'jump', boxes: [1, 2, 3], groups: 6, step: 0.25, goal: 92, why: 'The jump-back version moved through the boxes: more groups per box, the jump after every fifth note, and a shift at each new box.', instr: JUMP + 'Six groups down each box: 1, 2, 3. Pass: clean at the goal tempo.', watch: 'Losing which stroke a group starts on after a shift: it simply continues the alternation.', simplify: 'Quintuplets.' })],
          ST('Every pentatonic box has two notes per string, so the same fives run through all five boxes, joining into one line along the neck.', 'His runs travel: the same pattern in each box carries a line from one end of the neck to the other.', ['Box n+1 starts on box n’s second note on the low E string.', 'Shift on the first note of a group, never in the middle.'])),
        S('r5-low', 'Bass strings and direction changes', 'picking', 'Darker fives; turns.', [
          R5('r5-low', 'Economy fives on the bass strings of boxes 1 and 2 ({key})', 'variable', { boxes: [1, 2], strings: [6, 5, 4, 3], step: 0.25, goal: 92, why: 'On strings 3–6 the roll sounds darker and heavier; the thick strings need a firmer sweep and more muting.', instr: ECON + 'Down the four bass strings of box 1, then box 2 (two groups each). Mute the strings above with the fretting hand. Pass: clean at the goal tempo.', watch: 'Open strings ringing.', simplify: 'Quintuplets.' }),
          R5('r5-alt', 'Down, up, down: economy fives through boxes 1 to 3 ({key})', 'interleaving', { boxes: [1, 2, 3], dir: 'alt', step: 0.25, goal: 92, why: 'Changing direction with every box gives a wave-like run and forces the strokes to reverse cleanly at speed.', instr: ECON + 'Down box 1, up box 2 (strokes reversed), down box 3. Pass: clean at the goal tempo.', watch: 'Losing the group at the turn.', simplify: 'Quintuplets.' })],
          ST('On the bass strings the same 2 + 2 + 1 groups need more muting; changing direction flips the strokes and the sweep.', 'Range and direction changes keep the pattern from sounding like one memorised run.', ['Going up: up–down–up–down–up, the sweep goes up.'])),
        S('r5-adv-recall', 'Called boxes and dynamics', 'fretboard', 'Any box from memory; a shaped cascade.', [
          R5('r5-boxes-called', 'Boxes called out of order: 3, 1, 5, 2, 4 ({key})', 'retrieval', { boxes: [3, 1, 5, 2, 4], step: 0.25, goal: 88, marks: false, why: 'Out of order, each box has to be recalled rather than slid into: exactly the skill a solo asks for.', instr: ECON + 'Four groups down each box: 3, 1, 5, 2, 4. Cover the tab. Pass: all five from memory at the goal tempo.', watch: 'Defaulting to the neighbouring box.', simplify: 'Boxes 1–3.' }),
          R5('r5-swell', 'A cascade with a shape: crescendo through boxes 3, 2 and 1 ({key})', 'external-focus', { boxes: [3, 2, 1], step: 0.25, goal: 92, why: 'A cascade that starts as a whisper and grows to full force as it falls is music; the same notes at one volume are an exercise.', instr: ECON + 'Down box 3, 2 and 1. Start very quietly and grow louder to the end, landing strongly. Listen for a smooth curve. Pass: twice with a smooth crescendo.', watch: 'Speeding up as you get louder.', simplify: 'Box 1.' })],
          ST('Recalling a box by number and shaping the run’s volume are what turn a pattern into a phrase.', 'In a solo you need the box you are in, not the one you practised, and a run needs a shape.', ['A crescendo over a falling line makes it sound like it is going somewhere.'])),
        S('r5-adv-music', 'In a solo', 'improv', 'Rolling runs between phrases.', [c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo: one rolling run per chorus, then space' }), M('transfer', ['callResponse', { chords: '$slowBlues', scale: 'minorPent' }])],
          ST('Rolling runs work best as one event per chorus, answered by space.', 'Restraint makes the speed stand out.', ['Answer a run with a long, bent note.']))
      ], [7, 8]),
    stage('mastery', 'Fast, anywhere and your own',
      'Roll economy fives through all five boxes at about 110 BPM, the jump-back version at about 100, start either version from any key and box on demand, and perform your own 8-bar rolling-fives piece.', [
        S('r5-performance', 'Performance tempo', 'picking', 'Both versions at speed.', [
          as(c => ejRolling5s(c, { dir: 'down', diagonal: true }), { id: 'r5-neck-fast', method: 'edge', goal: 104, name: x => x.name + ', at performance tempo', instr: ECON + 'Through all five boxes at performance tempo. Tempo ladder: add a few BPM after each clean pass. Pass: clean at the goal tempo with the accents still rolling.' }),
          R5('r5-all-boxes', 'Economy fives through all five boxes, alternating direction, at tempo ({key})', 'edge', { boxes: [1, 2, 3, 4, 5], dir: 'alt', step: 0.25, goal: 96, why: 'Four groups per box, alternating direction, through all five: the complete map of the roll at tempo.', instr: ECON + 'Down box 1, up box 2, down box 3… Tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'Tension over the long run.', simplify: 'Boxes 1–3.' }),
          R5('r5-jump-fast', 'Jump-back fives at performance tempo, boxes 1 and 2 ({key})', 'edge', { variant: 'jump', boxes: [1, 2], step: 0.25, goal: 92, why: 'The strict-alternate version at tempo: every jump back has to land without a hitch.', instr: JUMP + 'All eight groups down box 1, then box 2. Tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'The jump back two strings arriving late.', simplify: 'Box 1.' })],
          ST('Performance tempo comes from small steps on a motion that is already efficient.', 'Both versions should be available at speed: the swept one for flow, the strict one for attack.', ['Add 3–5 BPM only after two clean passes.'])),
        S('r5-random-access', 'Any key, any box', 'fretboard', 'No warning.', [c => r5Random(c), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: rolling runs into long notes' })],
          ST('At mastery the pattern starts anywhere: any key, any box, either version.', 'Random practice is harder now and sticks better later.', ['Find the box first, then the version.'])),
        S('r5-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => r5Etude(c), c => targetGuide(c, { prog: 'minorRock', scale: 'blues', name: 'Solo with the blues scale: build your own groups of five' })],
          ST('The capstone combines both versions, both pulses and several boxes in one piece; then you write your own.', 'Mastery is making the pattern part of your own lines.', ['Plan where each run starts and where it lands.']))
      ], [9, 10])
  ]
});
