// Three-notes-per-string scales: the seven positions of the major scale (and, from the same shapes, natural
// minor), each played three scale notes on every string. Foundations: position 1 one string at a time, the
// three finger patterns, down as well as up, then over a chord; intermediate: positions 2-7 one at a time,
// linking neighbouring positions, the same shape in other keys; advanced: 16ths and triplets, all seven
// positions in one pass, minor positions, phrases over progressions; mastery: tempo, endurance, studies.
//
// Concept-first (CONTENT.md): the scale is a list of semitone steps; a POSITION k (0-6) is the three-per-string
// pattern whose lowest note is scale degree k+1 on the low E string (scaleNps in core/theory.js). Every note is
// a scale tone by construction. A lesson is a list of PASSES (position, key offset, strings, direction and
// sequence); the engine also serves scaleSequences.js. Bar phrases (`barsRun`) choose the starting note of a
// short pattern so each bar ends on a tone of that bar's diatonic chord.
//
// Teaching method first (see `pedagogy` below), researched 2026-10-31.
import { N, nameOf, make, mod12, S, stage, entry, scaleNps, SCALE_BY_ID, legatoMarks } from '../lib.js';

export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
export const STEP = { 'quarter notes': 1, '8th notes': 0.5, '8th-note triplets': 1 / 3, '16th notes': 0.25 };
export const keyName = c => `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`;
export const stepsOf = c => SCALE_BY_ID[c.minor ? 'minor' : 'major'].steps;

/** Position k (0-6) of the key's scale: 18 notes, low string to high, three per string, ascending. */
export function pos(c, k) {
  const id = c.minor ? 'minor' : 'major', root = mod12(c.key), st = SCALE_BY_ID[id].steps;
  const f0 = mod12(root + st[k] - 40);
  for (const f of [f0, f0 + 12]) {
    if (f < 1) continue;
    const n = scaleNps(root, id, f, 3);
    if (n && n[0].f === f && Math.min(...n.map(x => x.f)) >= 1 && Math.max(...n.map(x => x.f)) <= 21) return n;
  }
  return null;
}

/** Sequences: n (ladder length) -> list of cells; each cell a list of ladder indexes (ascending form). */
const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
export const SEQ = {
  scale: n => range(0, n - 1).map(i => [i]),
  strRep: n => range(0, n / 3 - 1).map(g => [3 * g, 3 * g + 1, 3 * g + 2, 3 * g + 1, 3 * g, 3 * g + 1, 3 * g + 2, 3 * g + 1]),
  fours: n => range(0, n - 4).map(i => [i, i + 1, i + 2, i + 3]),
  threes: n => range(0, n - 3).map(i => [i, i + 1, i + 2]),
  thirds: n => range(0, n - 3).map(i => [i, i + 2]),
  fourths: n => range(0, n - 4).map(i => [i, i + 3]),
  sixths: n => range(0, n - 6).map(i => [i, i + 5]),
  stepBack: n => range(1, n - 1).map(i => [i, i - 1]),
  skip13: n => range(0, n - 4).map(i => [i, i + 2, i + 1, i + 3]),
  sixBack: n => range(0, Math.floor((n - 6) / 4)).map(j => range(4 * j, 4 * j + 5)),
  nines: n => range(0, Math.floor((n - 9) / 3)).map(j => range(3 * j, 3 * j + 8)),
  strSkip: n => { const g = n / 3, out = []; for (let j = 0; j + 3 < g; j++) [j, j + 2, j + 1, j + 3].forEach(x => out.push([3 * x, 3 * x + 1, 3 * x + 2])); return out; }
};

/** One exercise from passes: [{k, off, minor, g: [firstString, lastString], seq, dir: up|down|both, legato}]. */
export function run(c, id, method, spec) {
  const step = STEP[spec.unit], notes = []; let t = 0, ends = [];
  const passes = typeof spec.passes === 'function' ? spec.passes(c) : spec.passes;
  for (const p of passes) {
    const cc = { ...c, key: mod12(c.key + (p.off || 0)), minor: p.minor != null ? p.minor : !!c.minor };
    const L = pos(cc, p.k || 0); if (!L) return null;
    const g = p.g || [0, 5], lad = L.slice(3 * g[0], 3 * g[1] + 3), n = lad.length;
    const cells = SEQ[p.seq || 'scale'](n); if (!cells.length) return null;
    const pcs = stepsOf(cc).map(x => mod12(cc.key + x));
    let seq = [];
    for (const d of p.dir === 'both' ? ['up', 'down'] : [p.dir || 'up']) {
      const part = cells.flat().map(i => (d === 'up' ? i : n - 1 - i));
      if (seq.length && seq[seq.length - 1] === part[0]) part.shift();
      seq = seq.concat(part);
    }
    for (let r = 1; r < (p.rep || 1); r++) seq = seq.concat(seq);
    const marks = p.legato ? legatoMarks(seq.map(i => [lad[i].s, lad[i].f])) : null;
    seq.forEach((i, j) => { notes.push(tag(N(lad[i].s, lad[i].f, t, step, marks ? marks[j][2] : null), pcs)); t += step; });
    ends.push(`${nameOf(cc.key)} ${cc.minor ? 'minor' : 'major'} position ${(p.k || 0) + 1}`);
  }
  if (notes.length < 6 || notes.length > 400) return null;
  const tonic = nameOf(c.key) + (c.minor ? 'm' : '');
  const fill = x => String(x).replace(/\{key\}/g, keyName(c)).replace(/\{tonic\}/g, tonic);
  return make(c, {
    id, name: fill(spec.name), domain: spec.domain || 'fretboard', method, unit: spec.unit, goal: spec.goal, start: spec.start, minutes: spec.minutes || 5,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, backing: [tonic], chords: [tonic], tab: { notes }
  });
}

/* ----- phrases over a progression: every bar ends on a chord tone of that bar's chord ----- */
const MAJQ = ['', 'm', 'm', '', '', 'm', 'dim'], MINQ = ['m', 'dim', '', 'm', 'm', '', ''];
export const PROGS = {
  fourChords: c => (c.minor ? [0, 5, 2, 6] : [0, 4, 5, 3]),
  oneFourFive: c => (c.minor ? [0, 3, 4, 0] : [0, 3, 4, 0]),
  vamp: c => [0, 3, 0, 4],
  turn: c => (c.minor ? [0, 3, 6, 2] : [0, 5, 3, 4])
};
export const BARPAT = {
  f4: [0, 1, 2, 3, 1, 2, 3, 4], th: [0, 2, 1, 3, 2, 4, 3, 5], sb: [1, 0, 2, 1, 3, 2, 4, 3], run: [0, 1, 2, 3, 4, 5, 6, 7], tri3: [0, 1, 2, 1, 2, 3, 2, 3], iv4: [0, 3, 1, 4, 2, 5, 3, 6], two: [0, 1, 2, 0, 1, 2, 3, 1]
};
export function barsRun(c, id, method, spec) {
  const st = stepsOf(c), root = mod12(c.key), Q = c.minor ? MINQ : MAJQ, pcs = st.map(x => mod12(root + x));
  const degs = spec.prog(c), notes = [], names = []; let t = 0, prev = null;
  const reps = spec.reps || 1;
  for (let r = 0; r < reps; r++) for (let b = 0; b < degs.length; b++) {
    const bi = r * degs.length + b, d = degs[b];
    const L = pos(c, Array.isArray(spec.pos) ? spec.pos[bi % spec.pos.length] : (spec.pos || 0)); if (!L) return null;
    const pat = BARPAT[Array.isArray(spec.pats) ? spec.pats[bi % spec.pats.length] : spec.pats];
    const dir = Array.isArray(spec.dirs) ? spec.dirs[bi % spec.dirs.length] : (spec.dirs || 'up');
    const tones = [d, d + 2, d + 4].map(x => pcs[x % 7]), mx = Math.max(...pat);
    let best = null;
    for (let o = 0; o < L.length; o++) {
      const idx = pat.map(p => (dir === 'up' ? o + p : o - p));
      if (Math.min(...idx) < 0 || Math.max(...idx) >= L.length) continue;
      const last = L[idx[idx.length - 1]];
      if (!tones.includes(mod12(last.midi))) continue;
      const cost = prev == null ? Math.abs(L[idx[0]].midi - 62) : Math.abs(L[idx[0]].midi - prev);
      if (!best || cost < best.cost) best = { idx, cost };
    }
    if (!best) return null;
    best.idx.forEach((i, j) => notes.push(tag(N(L[i].s, L[i].f, t + j * 0.5, 0.5), pcs)));
    prev = L[best.idx[best.idx.length - 1]].midi; t += 4;
    names.push(nameOf(pcs[d]) + Q[d]);
  }
  const uniq = [...new Set(names)];
  const fill = x => String(x).replace(/\{key\}/g, keyName(c)).replace(/\{chords\}/g, uniq.join(' – '));
  return make(c, {
    id, name: fill(spec.name), domain: 'fretboard', method, unit: '8th notes', goal: spec.goal, start: spec.start, minutes: spec.minutes || 6,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, backing: names, chords: uniq, tab: { notes }
  });
}

const ST = (concept, why, theory) => ({ concept, why, theory });
const G = (id, method, spec) => c => run(c, id, method, spec);
const B = (id, method, spec) => c => barsRun(c, id, method, spec);
const one = (k, extra) => [{ k, ...extra }];
const MIN = c => ({ ...c, minor: true }), MAJ = c => ({ ...c, minor: false });

/* ------------------------------ Foundations ------------------------------ */
const p1Low = c => run(c, 'n3-p1-low', 'chunking', { name: 'Position 1, the three lowest strings ({key})', unit: '8th notes', goal: 85, start: 55, minutes: 4,
  passes: one(0, { g: [0, 2], dir: 'both' }),
  why: 'Teachers start with the first position of the scale and show it a string at a time: three notes on each string, the first note of the pattern on the root.',
  instr: 'Find the root on the low E string. Index finger on the lowest note of each string, pinky on the highest, the middle note with the finger that fits the gap. Play the three lowest strings up, then back down, alternate picking. Pass: 4 clean round trips with every note even.',
  watch: 'Lifting the fingers early, so the notes stop sounding.', simplify: 'One string at a time, three notes up and back.' });
const p1Full = G('n3-p1-full', 'accurate-reps', { name: 'Position 1 on all six strings ({key})', unit: '8th notes', goal: 90, start: 60,
  passes: one(0, { dir: 'both' }),
  why: 'The whole pattern at an even pulse is the baseline for every later position.',
  instr: 'Play all eighteen notes up, turn on the top note, and come back down without a pause, strict alternate picking. Pass: 4 round trips with no wrong note and no change in the beat.',
  watch: 'Rushing when the pattern crosses to the thinner strings.', simplify: 'Stop at the fourth string.' });
const strRep = G('n3-string-fingers', 'chunking', { name: 'Three notes, back and forth, string by string ({key})', unit: '8th notes', goal: 90, start: 60,
  passes: one(0, { seq: 'strRep' }),
  why: 'The three-note group on each string is one of three step patterns. Repeating each string locks the fingering before you move on.',
  instr: 'On each string play the three notes up and back twice (low, mid, high, mid, low, mid, high, mid), then move to the next string. Keep the same fingers on every string that has the same gap. Pass: one pass over all six strings with the fingers never changing their choice.',
  watch: 'Switching fingers for the middle note from string to string.', simplify: 'The three lowest strings.' });
const topStrings = G('n3-top-strings', 'chunking', { name: 'The top four strings only ({key})', unit: '8th notes', goal: 90, start: 60,
  passes: one(0, { g: [2, 5], dir: 'both' }),
  why: 'The shapes on the B and high E strings stretch differently from the low ones; they get their own practice.',
  instr: 'Play strings 4 to 1 of position 1 up and down. Pass: 4 round trips with every note sounding and the stretches relaxed.',
  watch: 'Squeezing the neck on the 4-fret stretch.', simplify: 'Strings 2 and 1 only.' });
const descOnly = G('n3-descend', 'accurate-reps', { name: 'Coming down: position 1 from the top ({key})', unit: '8th notes', goal: 85, start: 55,
  passes: one(0, { dir: 'down' }),
  why: 'Down is harder than up for most players. Teachers have you play the pattern both ways, so the way down gets its own repetitions.',
  instr: 'Start on the highest note and play all eighteen notes down, alternate picking, then jump back to the top. Pass: 6 descents in a row with no mistakes.',
  watch: 'Fingers hovering far from the strings.', simplify: 'Descend two strings at a time.' });
const vamp = B('n3-vamp-p1', 'transfer', { name: 'Position 1 phrases over a vamp ({key}: {chords})', prog: PROGS.vamp, pats: ['run', 'f4'], dirs: ['up', 'down'], pos: 0, reps: 2, goal: 80, start: 55,
  why: 'A scale pattern becomes music when it runs over chords. Each bar here is a short piece of position 1 that lands on a tone of that bar’s chord.',
  instr: 'Play the bars one at a time over the chords: {chords}. Each bar is eight 8th notes; the last note of every bar is a tone of its chord. Pass: 8 bars at the goal tempo, landing exactly on beat 4-and each time.',
  watch: 'Stopping the pick hand at the bar line.', simplify: 'Play only the first four bars.' });
const p1Major = c => run(MAJ(c), 'n3-p1-major', 'accurate-reps', { name: 'Position 1 in the major key ({key})', unit: '8th notes', goal: 90, start: 60,
  passes: one(0, { dir: 'both' }),
  why: 'The pattern is the same shape in every major key: only where it starts on the neck changes.',
  instr: 'Place the root on the low E string for {key} and play position 1 up and back. Pass: 4 round trips.',
  watch: 'Starting from the wrong fret.', simplify: 'The three lowest strings.' });
const p1Minor = c => run(MIN(c), 'n3-p1-minor', 'accurate-reps', { name: 'The same pattern from the minor root ({key})', unit: '8th notes', goal: 90, start: 60,
  passes: one(0, { dir: 'both' }),
  why: 'The natural minor scale uses the same notes as the major scale three semitones above: playing the pattern from the minor root gives the minor sound.',
  instr: 'Start on the minor root and play the shape for natural minor up and back. Pass: 4 round trips.',
  watch: 'Mixing up the major and minor starting fret.', simplify: 'The three lowest strings.' });

/* ------------------------------ Intermediate ------------------------------ */
const posK = (k, name, goal, why) => G(`n3-pos${k + 1}`, 'accurate-reps', { name: `Position ${k + 1}: ${name} ({key})`, unit: '8th notes', goal, start: Math.round(goal * 0.65),
  passes: one(k, { dir: 'both' }), why,
  instr: `Position ${k + 1} starts on the ${['root', '2nd', '3rd', '4th', '5th', '6th', '7th'][k]} of the scale on the low E string. Play all eighteen notes up and back, alternate picking, keeping the fingers close to the strings. Pass: 4 round trips with no wrong note.`,
  watch: 'Falling back on the position you know best.', simplify: 'The lowest three strings only.' });
const pos2 = posK(1, 'the second-degree start', 95, 'Positions are taught one at a time in order; the second is the shape that begins one scale step above position 1.');
const pos3 = posK(2, 'the third-degree start', 95, 'The third position is where many players first meet a four-fret stretch on the lower strings.');
const pos4 = posK(3, 'the fourth-degree start', 95, 'Position 4 sits next to position 3 on the neck and shares notes with it.');
const pos5 = posK(4, 'the fifth-degree start', 95, 'Position 5 starts on the fifth of the scale and lies a little higher up the neck.');
const pos6 = posK(5, 'the sixth-degree start', 95, 'Position 6 is high on the neck in many keys; move it down an octave if the neck heel is in the way.');
const pos7 = posK(6, 'the seventh-degree start', 95, 'Position 7 completes the set. It may sit high in some keys, so use the octave lower where it exists.');
const hop12 = G('n3-hop-12', 'chunking', { name: 'Linking positions 1 and 2 ({key})', unit: '8th notes', goal: 95, start: 60,
  passes: [{ k: 0, dir: 'up' }, { k: 1, dir: 'down' }, { k: 0, dir: 'up' }, { k: 1, dir: 'down' }],
  why: 'Sources have you connect the positions: up one, back down the next, so you see how they overlap on the neck.',
  instr: 'Play position 1 up, then position 2 down, then repeat. Pass: 4 passes with no stumble where the two meet.',
  watch: 'Hesitating on the turn at the top.', simplify: 'Do one pair.' });
const hop234 = G('n3-hop-234', 'chunking', { name: 'Linking positions 2, 3 and 4 ({key})', unit: '8th notes', goal: 95, start: 60,
  passes: [{ k: 1, dir: 'up' }, { k: 2, dir: 'down' }, { k: 3, dir: 'up' }, { k: 2, dir: 'down' }],
  why: 'The same linking idea in the middle of the set.',
  instr: 'Play position 2 up, 3 down, 4 up, 3 down. Pass: 3 rounds without a break.',
  watch: 'Losing which position you are in.', simplify: 'Positions 2 and 3.' });
const keysFour = G('n3-keys-iv', 'interleaving', { name: 'Position 1 in the key, then a fourth up ({key})', unit: '8th notes', goal: 95, start: 60,
  passes: [{ k: 0, off: 0, dir: 'both' }, { k: 0, off: 5, dir: 'both' }],
  why: 'The shape does not change when the key does: the whole pattern slides along the neck, with the root as the guide.',
  instr: 'Play position 1 in {key}, then the same shape starting on the root a fourth higher. Pass: both keys twice with no wrong note.',
  watch: 'Counting frets instead of finding the root.', simplify: 'Only the first key.' });
const keysFifth = G('n3-keys-v', 'interleaving', { name: 'Position 1 in the key, then a fifth up ({key})', unit: '8th notes', goal: 95, start: 60,
  passes: [{ k: 0, off: 0, dir: 'both' }, { k: 0, off: 7, dir: 'both' }],
  why: 'Another move of the same shape, which builds the habit of finding position 1 from any root.',
  instr: 'Play position 1 in {key}, then the same shape starting on the root a fifth higher. Pass: both keys twice with no wrong note.',
  watch: 'Starting the second pass on the wrong string.', simplify: 'Only the first key.' });
const mixPos = G('n3-mix-pos', 'interleaving', { name: 'Two positions per pass ({key})', unit: '8th notes', goal: 95, start: 60,
  passes: [{ k: 4, dir: 'up' }, { k: 5, dir: 'down' }, { k: 6, dir: 'up' }, { k: 0, dir: 'down', off: 0 }],
  why: 'The higher positions are linked the same way as the lower ones.',
  instr: 'Play position 5 up, 6 down, 7 up and 1 down. Pass: 3 rounds without a stumble.',
  watch: 'Slowing down on the shape you like least.', simplify: 'Positions 5 and 6 only.' });
const oneBarPhrases = B('n3-phrases-1', 'transfer', { name: 'Phrases through a four-chord loop ({key}: {chords})', prog: PROGS.fourChords, pats: ['f4', 'th'], dirs: ['up', 'down'], pos: [0, 1], reps: 2, goal: 90, start: 60,
  why: 'Using two neighbouring positions over the chords of a key is the first step from drilling to playing.',
  instr: 'Play the bars with the chords {chords}. Each bar ends on a tone of its chord. Pass: 8 bars at the goal tempo.',
  watch: 'Rushing the last two notes of the bar.', simplify: 'Four bars.' });

/* ------------------------------- Advanced ------------------------------- */
const pos1_16 = G('n3-16-p1', 'accurate-reps', { name: 'Position 1 in 16th notes ({key})', unit: '16th notes', goal: 70, start: 45,
  passes: one(0, { dir: 'both' }),
  why: 'Sixteen notes in a bar is the speed at which three notes per string feels like a run.',
  instr: 'Play all eighteen notes up and back in 16ths, alternate picking. Pass: 4 round trips even.',
  watch: 'Tension in the picking forearm.', simplify: 'Play in 8ths.' });
const pos5_16 = G('n3-16-p5', 'accurate-reps', { name: 'Position 5 in 16th notes ({key})', unit: '16th notes', goal: 70, start: 45,
  passes: one(4, { dir: 'both' }),
  why: 'The same speed in a position higher on the neck.',
  instr: 'Pass: 4 round trips even.', watch: 'Missing the wide stretch.', simplify: 'Play in 8ths.' });
const hopAll = G('n3-hop-all', 'chunking', { name: 'Seven positions in one pass ({key})', unit: '8th notes', goal: 105, start: 70, minutes: 6,
  passes: [0, 1, 2, 3, 4, 5, 6].map((k, i) => ({ k, dir: i % 2 ? 'down' : 'up' })),
  why: 'The final test of the set is linking all seven: up one, down the next.',
  instr: 'Play position 1 up, 2 down, and so on through position 7. Pass: one pass with no wrong note and no break in the beat.',
  watch: 'Losing the thread at position 5.', simplify: 'Positions 1 to 4.' });
const keysAdv = G('n3-keys-adv', 'interleaving', { name: 'Positions 1, 3 and 5 in one key and the next ({key})', unit: '8th notes', goal: 100, start: 65, minutes: 6,
  passes: [{ k: 0, dir: 'both' }, { k: 2, dir: 'both' }, { k: 4, dir: 'both' }, { k: 0, off: 5, dir: 'both' }, { k: 2, off: 5, dir: 'both' }],
  why: 'Moving between positions and keys is the skill the sources build towards.',
  instr: 'Pass: the whole sequence once with no wrong note.',
  watch: 'Missing the root of the new key.', simplify: 'Two positions.' });
const minAll = G('n3-min-1to3', 'chunking', { name: 'Minor positions 1 to 3 ({key})', unit: '8th notes', goal: 100, start: 65,
  passes: (c) => [0, 1, 2].map((k, i) => ({ k, minor: true, dir: i % 2 ? 'down' : 'up' })),
  why: 'The three-per-string shapes work for natural minor from the minor root.',
  instr: 'Play minor position 1 up, 2 down and 3 up. Pass: 3 rounds clean.',
  watch: 'Thinking of the shapes as major.', simplify: 'Positions 1 and 2.' });
const minAll2 = G('n3-min-4to7', 'chunking', { name: 'Minor positions 4 to 7 ({key})', unit: '8th notes', goal: 100, start: 65,
  passes: (c) => [3, 4, 5, 6].map((k, i) => ({ k, minor: true, dir: i % 2 ? 'down' : 'up' })),
  why: 'The higher minor positions complete the set.',
  instr: 'Play minor positions 4 to 7 alternating up and down. Pass: 3 rounds clean.',
  watch: 'Slowing at the top of the neck.', simplify: 'Positions 4 and 5.' });
const progMaj = B('n3-prog-maj', 'transfer', { name: 'Phrases through three positions ({key}: {chords})', prog: PROGS.turn, pats: ['f4', 'th', 'sb', 'run'], dirs: ['up', 'down'], pos: [1, 2, 3, 4], reps: 2, goal: 95, start: 65,
  why: 'Different positions on different chords: the move that makes positions useful.',
  instr: 'Pass: 8 bars with the chords {chords}.', watch: 'Resolving on the wrong note.', simplify: 'Four bars.' });
const progMin = B('n3-prog-min', 'transfer', { name: 'Phrases over a minor loop ({key}: {chords})', prog: PROGS.fourChords, pats: ['th', 'f4', 'sb', 'run'], dirs: ['down', 'up'], pos: [5, 6, 0, 1], reps: 2, goal: 95, start: 65,
  why: 'A minor key with positions from the higher part of the set.',
  instr: 'Pass: 8 bars over {chords}.', watch: 'Arriving a beat early.', simplify: 'Four bars.' });

/* ------------------------------- Mastery ------------------------------- */
const fast8 = G('n3-tempo-8', 'accurate-reps', { name: 'Position 1 and 3 at performance tempo ({key})', unit: '8th notes', goal: 125, start: 90, minutes: 6,
  passes: [{ k: 0, dir: 'both', rep: 2 }, { k: 2, dir: 'both', rep: 2 }],
  why: 'At performance speed the positions should feel automatic.',
  instr: 'Pass: both positions twice at the goal tempo with no wrong note.', watch: 'Digging in with the pick.', simplify: 'Drop 10 BPM.' });
const fast16 = G('n3-tempo-16', 'accurate-reps', { name: 'Seven positions in 16ths ({key})', unit: '16th notes', goal: 85, start: 60, minutes: 6,
  passes: [0, 2, 4].map((k, i) => ({ k, dir: i % 2 ? 'down' : 'up' })),
  why: 'The speed at which a position becomes a run.',
  instr: 'Pass: positions 1, 3 and 5 in 16ths at the goal tempo, clean.', watch: 'Losing the beat in the high position.', simplify: 'Drop 10 BPM.' });
const endure = G('n3-endure', 'accurate-reps', { name: 'All seven positions, round trip ({key})', unit: '8th notes', goal: 110, start: 75, minutes: 7,
  passes: [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((k, i) => ({ k, dir: i % 2 ? 'down' : 'up' })),
  why: 'Stamina for a long run through the whole set.',
  instr: 'Pass: one trip up through the positions and back without a stop.', watch: 'Tension building after position 4.', simplify: 'Positions 1 to 4 and back.' });
const loop3 = G('n3-loop', 'accurate-reps', { name: 'Loop two positions until they never drift ({key})', unit: '8th notes', goal: 115, start: 80, minutes: 6,
  passes: [{ k: 1, dir: 'both', rep: 2 }, { k: 3, dir: 'both', rep: 2 }],
  why: 'Looping shows drift.', instr: 'Loop for three minutes. Pass: no change in tempo or tone.', watch: 'Speeding up.', simplify: 'Drop 10 BPM.' });
const cap8 = B('n3-cap-8', 'transfer', { name: 'Study: eight bars through the positions ({key}: {chords})', prog: PROGS.fourChords, pats: ['f4', 'th', 'run', 'sb'], dirs: ['up', 'down', 'up', 'down'], pos: [0, 1, 2, 3, 4, 3, 2, 1], reps: 2, goal: 100, start: 70, minutes: 7,
  why: 'An original study using several positions over a four-chord loop.',
  instr: 'Learn two bars at a time. Pass: one clean pass at the goal tempo, then make your own version on the same chords.', watch: 'Rushing.', simplify: 'Four bars.' });
const cap12 = B('n3-cap-12', 'transfer', { name: 'Capstone: a twelve-bar study ({key}: {chords})', prog: PROGS.oneFourFive, pats: ['f4', 'th', 'sb', 'run'], dirs: ['up', 'down', 'down', 'up'], pos: [0, 1, 2, 3, 4, 5, 6, 0, 2, 4, 3, 1], reps: 3, goal: 100, start: 70, minutes: 8,
  why: 'The whole path in a twelve-bar study.',
  instr: 'Learn in three four-bar phrases, join them, then write your own on the same chords. Pass: one clean pass at the goal tempo.', watch: 'Losing the position at a chord change.', simplify: 'Bars 1 to 8.' });

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'threeNps', kind: 'subject', title: 'Three-notes-per-string scales (the seven positions)', domain: 'fretboard',
  re: /three(-| )notes?(-| )per(-| )string|3(-| )?nps|seven (major )?scale positions|7 (major )?scale positions|scale positions/,
  aliases: ['3nps', 'three notes per string', 'seven positions', 'major scale positions'],
  summary: 'The major (and natural minor) scale as seven three-notes-per-string positions: one position at a time, the three finger patterns, linking neighbouring positions, other keys, 16ths, and phrases over chords.',
  prereqs: ['alternatePicking'],
  ctx: { key: 7, minor: false, prog: 'folkAxis' },
  sources: [
    'https://appliedguitartheory.com/lessons/3-notes-per-string-major-scale-patterns/',
    'https://appliedguitartheory.com/lessons/3-notes-per-string-major-scale-exercises/',
    'https://www.tabs4acoustic.com/en/guitar-lessons/learn-major-scales-on-the-guitar-291.html',
    'https://dummies.com/article/how-to-play-three-notes-per-string-patterns-on-the-guitar-155538',
    'https://fretjam.com/major-scale-patterns.html'
  ],
  pedagogy: {
    date: '2026-10-31',
    summary: 'Taught as seven patterns in order, each with three notes on every string, played up and down with alternate picking and a metronome. The fingering follows the gap between the notes, one pattern is learned at a time while the earlier ones are kept, and the patterns are then linked and moved to other keys.',
    sequence: [
      { id: 'shape', tier: 'foundations', step: 'One pattern, one string at a time', how: 'Position 1: three notes on each string, built from the root on the low E string.', skills: ['n3-s-shape'], source: 2 },
      { id: 'fingers', tier: 'foundations', step: 'The three step patterns and their fingers', how: 'Every group of three is whole-half, half-whole or whole-whole; keep one fingering for each.', skills: ['n3-s-fingers'], source: 2 },
      { id: 'down', tier: 'foundations', step: 'Down as well as up, then over a chord', how: 'Both directions without interruption, then over a chord.', skills: ['n3-s-down'], source: 0 },
      { id: 'modes', tier: 'foundations', step: 'The same shape for major and minor', how: 'The pattern from the major root, then from the minor root three semitones lower.', skills: ['n3-s-mode'], source: 1 },
      { id: 'seven', tier: 'intermediate', step: 'Positions 2 to 4, one at a time', how: 'Each position in order, up and down, keeping the earlier ones going.', skills: ['n3-s-pos24'], source: 2 },
      { id: 'seven2', tier: 'intermediate', step: 'Positions 5 to 7', how: 'The higher patterns; on acoustic guitars the last may be played an octave lower.', skills: ['n3-s-pos57'], source: 2 },
      { id: 'link', tier: 'intermediate', step: 'Linking neighbouring positions', how: 'Up one pattern and down the next, then longer chains.', skills: ['n3-s-link'], source: 4 },
      { id: 'keys', tier: 'intermediate', step: 'The same position in other keys', how: 'Find the root, then the same shape from the new root.', skills: ['n3-s-keys'], source: 3 },
      { id: 'speed', tier: 'advanced', step: 'Faster subdivisions', how: 'Triplet and 16th-note forms of the patterns.', skills: ['n3-s-speed'], source: 1 },
      { id: 'chain', tier: 'advanced', step: 'All seven positions in one pass', how: 'Connecting the positions until the neck runs out.', skills: ['n3-s-chain'], source: 3 },
      { id: 'minor', tier: 'advanced', step: 'All seven in minor', how: 'The same exercises suggested for the minor scale.', skills: ['n3-s-minor'], source: 1 },
      { id: 'prog', tier: 'advanced', step: 'Over accompaniment', how: 'Practising in new keys over backing.', skills: ['n3-s-prog'], source: 3 },
      { id: 'tempo', tier: 'mastery', step: 'Tempo', how: 'The patterns at performance speed.', skills: ['n3-s-tempo'], source: 0 },
      { id: 'endure', tier: 'mastery', step: 'Endurance', how: 'A long chain of patterns and a looped pair.', skills: ['n3-s-endure'], source: 4 },
      { id: 'study', tier: 'mastery', step: 'Studies', how: 'Original studies using several positions.', skills: ['n3-s-study'], source: 3 }
    ],
    drills: ['Each position up and down in 8ths with a metronome', 'Three notes on a string, repeated, then the next string', 'Linking position n up and n+1 down', 'The same position from a new root', 'Positions in 16th notes', 'All seven positions in a chain'],
    mistakes: ['Trying to learn all seven at once', 'Lifting the fingers in the middle of a string', 'Changing the finger for the middle note from string to string', 'Neck heel in the way on high positions of acoustic guitars', 'Thinking in boxes instead of seeing the whole neck'],
    sources: [
      { title: '3 Notes Per String Major Scale Patterns', author: 'Applied Guitar Theory', url: 'https://appliedguitartheory.com/lessons/3-notes-per-string-major-scale-patterns/' },
      { title: '3 Notes Per String Major Scale Exercises', author: 'Applied Guitar Theory', url: 'https://appliedguitartheory.com/lessons/3-notes-per-string-major-scale-exercises/' },
      { title: 'Learn Major Scales on the Guitar', author: 'Tabs4Acoustic', url: 'https://www.tabs4acoustic.com/en/guitar-lessons/learn-major-scales-on-the-guitar-291.html' },
      { title: 'How to Play Three-Notes-Per-String Patterns on the Guitar', author: 'Desi Serna (Guitar Theory For Dummies)', url: 'https://dummies.com/article/how-to-play-three-notes-per-string-patterns-on-the-guitar-155538' },
      { title: 'Major Scale Patterns: 3 Notes Per String & More', author: 'fretjam', url: 'https://fretjam.com/major-scale-patterns.html' }
    ]
  },
  stages: [
    stage('foundations', 'Position 1, string by string',
      'Position 1 on all six strings, up and down, in 8th notes at 90 BPM with the same fingers on every string of the same step pattern, and four bars of it over a chord vamp.', [
        S('n3-s-shape', 'One pattern, three notes a string', 'fretboard', 'Position 1 in pieces.', [p1Low, p1Full],
          ST('A three-notes-per-string position plays three scale notes on every string. Position 1 starts on the root of the scale on the low E string.', 'It is the basic map for fast, even scale lines.', ['Eighteen notes over six strings.', 'The pattern starts on the root.', 'Alternate picking throughout.'])),
        S('n3-s-fingers', 'Three step patterns', 'fretboard', 'Fingering the groups of three.', [strRep, topStrings],
          ST('Each group of three notes is whole-half, half-whole or whole-whole apart. A fixed finger set for each keeps the hand steady.', 'One fingering is easier to remember than a new one for each string.', ['Index on the first note and pinky on the last.', 'The middle finger or ring finger takes the middle note, depending on the gap.', 'Pick one fingering and stay with it.'])),
        S('n3-s-down', 'Down, and over a chord', 'fretboard', 'Both directions, then a chord.', [descOnly, vamp],
          ST('The way down uses the same notes but feels different. Playing over a chord ties the pattern to harmony.', 'Fluent lines need both directions.', ['Play down without stopping.', 'The bar ends on a chord tone.', 'Count in 8ths.'])),
        S('n3-s-mode', 'Major and minor', 'fretboard', 'The same shape, two roots.', [p1Major, p1Minor],
          ST('The natural minor scale holds the same notes as the major scale three semitones above. The shape is the same; the root moves.', 'One set of shapes serves both keys.', ['Major: start on the major root.', 'Minor: start on the minor root.', 'The minor root is three semitones below the relative major.']))
      ]),
    stage('intermediate', 'The seven positions, linked',
      'All seven positions up and down at 95 BPM in 8th notes, linked two at a time, and position 1 in two keys, each without a wrong note.', [
        S('n3-s-pos24', 'Positions 2 to 4', 'fretboard', 'The next three shapes.', [pos2, pos3, pos4],
          ST('Each position starts on the next degree of the scale and overlaps its neighbours on the neck.', 'Together the seven cover the whole fretboard.', ['Learn one at a time.', 'Keep the earlier ones going.', 'Same fingering rules.'])),
        S('n3-s-pos57', 'Positions 5 to 7', 'fretboard', 'The higher shapes.', [pos5, pos6, pos7],
          ST('The last three positions lie higher on the neck in many keys.', 'They complete the set so any key can be played anywhere.', ['Use the lower octave where needed.', 'Check fret limits.', 'Same shapes, new region.'])),
        S('n3-s-link', 'Linking positions', 'fretboard', 'One position up, the next down.', [hop12, hop234, mixPos],
          ST('Because neighbouring positions overlap, you can go up one and down the next without leaving the key.', 'It turns separate shapes into one map.', ['Overlapping notes are the link.', 'Turn at the top note.', 'Name the positions as you go.'])),
        S('n3-s-keys', 'Other keys and phrases', 'fretboard', 'Moving the shape and using it.', [keysFour, keysFifth, oneBarPhrases],
          ST('The shape never changes with the key; it slides to start on the new root. Phrases over a loop use it in context.', 'This is how the shapes become useful in songs.', ['Find the root first.', 'The shape is the same.', 'End bars on chord tones.']))
      ]),
    stage('advanced', 'Faster, minor, and in context',
      'Positions 1 and 5 in 16th notes at 80 BPM, all seven in one pass at 105 BPM, the minor positions, and two eight-bar phrases over chord loops.', [
        S('n3-s-speed', 'Sixteenth notes', 'fretboard', 'Faster subdivisions.', [pos1_16, pos5_16],
          ST('Sixteenth notes put sixteen notes in a bar, with the same picking.', 'It is the next step in speed.', ['Alternate strictly.', 'Keep the wrist loose.', 'Slow down when tension builds.'])),
        S('n3-s-chain', 'All seven in one pass', 'fretboard', 'The whole set, linked.', [hopAll, keysAdv],
          ST('Connecting all seven positions shows whether the whole set is under your fingers.', 'It is the final test of the mapping.', ['Alternate up and down.', 'Know where you are.', 'Repeat in another key.'])),
        S('n3-s-minor', 'The minor positions', 'fretboard', 'The set from the minor root.', [minAll, minAll2],
          ST('Natural minor uses the same shapes, started from the minor root.', 'It doubles what the set can do.', ['Start on the minor root.', 'Same fingering.', 'Positions 1 to 7.'])),
        S('n3-s-prog', 'Over progressions', 'fretboard', 'Phrases over chords.', [progMaj, progMin],
          ST('Choosing a position per bar and ending the phrase on a chord tone is the beginning of soloing.', 'It is where the patterns become music.', ['Pick the position near your hand.', 'Land on a chord tone.', 'Move smoothly.']))
      ]),
    stage('mastery', 'Tempo, endurance and studies',
      'Positions at 125 BPM in 8ths and 85 BPM in 16ths, a chain of all seven positions up and back, a looped pair held for three minutes, and an eight- and a twelve-bar study at 100 BPM.', [
        S('n3-s-tempo', 'Performance tempo', 'fretboard', 'Speed.', [fast8, fast16],
          ST('Performance tempo is the speed you can hold with every note clean.', 'It shows whether the shapes are automatic.', ['Raise the click only when relaxed.', 'Record yourself.', 'Rest between runs.'])),
        S('n3-s-endure', 'Endurance', 'fretboard', 'A long chain.', [endure, loop3],
          ST('A long chain of positions tests stamina and a loop shows drift.', 'It builds the control a working player needs.', ['Loop for three minutes.', 'Listen for drift.', 'Lower the tempo if it breaks.'])),
        S('n3-s-study', 'Original studies', 'fretboard', 'Using the whole set.', [cap8, cap12],
          ST('The final step is making your own study: choose positions and patterns for each bar.', 'It turns the shapes into your playing.', ['Learn in phrases.', 'Choose with care.', 'Write your own on the same chords.']))
      ])
  ]
});
