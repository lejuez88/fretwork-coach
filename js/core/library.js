// Exercise library for the Practice tab: technique, chords, rhythm, scales,
// theory, ear and improvisation exercises to pick at your own pace. Each entry
// is built for your current level in its skill area, and each comes with its
// variations (see variations.js). Progress is kept per variation in
// profile.varState under "lib:<id>~<vid>".
import { runAtom } from './styles.js';
import { normalizeExercise } from './coursegen.js';
import { drillLibrary, stringNotesDrill } from './drills.js';
import { EXERCISE_BY_ID } from '../tools/exercises.js';
import { variationsFor, findVariation, pickVariation } from './variations.js';
import { calibratedTarget, newExerciseState, applyResult } from './progression.js';
import { addEvidence, recomputeLevels } from './skills.js';
import { today } from './util.js';

export const CATEGORIES = [
  ['warmup', 'Warm-ups', 'Finger independence and relaxed hands'],
  ['picking', 'Picking', 'Alternate, economy, hybrid and fingerstyle'],
  ['fretting', 'Fretting technique', 'Bends, vibrato, legato, slides, tapping'],
  ['chords', 'Chords', 'Changes, voicings, inversions, comping'],
  ['rhythm', 'Rhythm & strumming', 'Strums, funk, shuffle, odd meters, timing'],
  ['scales', 'Scales & fretboard', 'Positions, notes, intervals, arpeggios'],
  ['theory', 'Theory on the neck', 'Keys, chord qualities, modes'],
  ['ear', 'Ear & improvisation', 'Play what you hear, solo over changes']
];
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(([id, name, blurb]) => [id, { id, name, blurb }]));
const CAT_DOMAIN = { warmup: 'fretting', picking: 'picking', fretting: 'fretting', chords: 'fretting', rhythm: 'rhythm', scales: 'fretboard', theory: 'theory', ear: 'ear' };

const C = (key, minor, lvl, prog) => ({ key, minor, lvl, genre: null, prog: prog || (minor ? 'minorRock' : 'axis') });
const A = 9, G = 7, Cn = 0, E = 4, D = 2;

// [id, category, builder(level) → raw exercise]
const ENTRIES = [
  // Warm-ups
  ['spider', 'warmup', L => ({ ...normalizeExercise({ libId: 'spider-1234', id: 'spider', name: 'Chromatic spider', domain: 'fretting', minutes: 4, startBpm: 60, goalBpm: Math.round(110 + L * 4), instr: 'One finger per fret, strict alternate picking. Keep the fingers close to the strings and leave each finger down until it has to move.', watch: 'Fingers flying off the strings, and squeezing the neck.', simplify: 'Two strings only, 8th notes.' }), family: 'spider', level: Math.max(1, L - 2) })],
  ['trills', 'warmup', L => ({ id: 'trills', name: 'Finger-pair trills', domain: 'fretting', family: 'trill', unit: '16ths', level: Math.max(1, L - 1), startBpm: 50, goalBpm: 90 + L * 3, minutes: 4,
    why: 'Fast hammer-on/pull-off trills between finger pairs build strength and independence in the weaker fingers.', instr: 'Pick the first note, then hammer and pull between the two frets for the whole bar. Keep the volume even.', watch: 'The trill slowing down as the fingers tire.', simplify: 'Quarter-note hammer and pull.',
    tab: { notes: [3, 3, 3, 3].flatMap((s, i) => Array.from({ length: 8 }, (_, k) => ({ t: i * 2 + k * 0.25, d: 0.25, s, f: k % 2 ? 7 : 5, ...(k ? { x: k % 2 ? 'h' : 'p' } : {}) }))) } })],
  ['vibrato-holds', 'warmup', L => runAtom(C(A, true, L), 'vibratoHolds')],
  ['speed-burst', 'warmup', L => runAtom(C(A, true, L), 'speedBurst')],
  // Picking
  ['alt-burst', 'picking', L => ({ ...drillLibrary(L).burst, family: 'burst' })],
  ['string-cross', 'picking', L => ({ ...normalizeExercise({ libId: 'string-skip', id: 'string-cross', name: 'String crossing', domain: 'picking', minutes: 5, instr: 'Strict alternate picking, small motion from the wrist. The hard part is the string change; keep it the same size as every other stroke.', watch: 'Hitting neighbouring strings.', simplify: 'Two strings only.' }), family: 'crossing' })],
  ['string-skip', 'picking', L => runAtom(C(Cn, false, L), 'stringSkip')],
  ['gallop', 'picking', L => ({ ...drillLibrary(L, 'metal').gallop, family: 'chug' })],
  ['sweep', 'picking', L => runAtom(C(A, true, Math.max(L, 5)), 'sweepArp', { strings: 3 })],
  ['hybrid', 'picking', L => drillLibrary(L, 'country').hybrid],
  ['travis', 'picking', L => runAtom(C(Cn, false, L), 'travisPattern', { chords: ['C', 'Am', 'F', 'G'] })],
  ['pima', 'picking', L => runAtom(C(A, true, L), 'pimaArpeggio', { chords: ['Am', 'Dm', 'E', 'Am'] })],
  ['picado', 'picking', L => runAtom(C(E, true, L), 'picado')],
  ['rasgueado', 'picking', L => runAtom(C(E, true, L), 'rasgueado', { chords: ['Am', 'G', 'F', 'E'] })],
  // Fretting technique
  ['bends', 'fretting', L => ({ ...drillLibrary(L).bends, family: 'bends' })],
  ['bend-lick', 'fretting', L => runAtom(C(A, true, L), 'bendLick')],
  ['legato', 'fretting', L => runAtom(C(G, false, L), 'legatoRun')],
  ['slides', 'fretting', L => drillLibrary(L).slides],
  ['tapping', 'fretting', L => ({ ...drillLibrary(L).tapping, family: 'tapping' })],
  ['double-stops', 'fretting', L => runAtom(C(G, false, L), 'doubleStops', { interval: '3rds' })],
  ['power-shifts', 'fretting', L => ({ ...drillLibrary(L).power, family: 'power' })],
  // Chords
  ['open-changes', 'chords', L => runAtom(C(G, false, L), 'chordChanges', { chords: ['G', 'C', 'D'], beats: 2 })],
  ['barre-changes', 'chords', L => runAtom(C(Cn, false, Math.max(L, 4)), 'chordChanges', { chords: ['F', 'C', 'G', 'Am'], beats: 2, name: 'F – C – G – Am barre changes' })],
  ['power-riff', 'chords', L => runAtom(C(E, true, L), 'powerRiff', { rhythm: 'synco' })],
  ['triad-shapes', 'chords', L => runAtom(C(Cn, false, L), 'shapesAcrossNeck', { type: 'maj' })],
  ['triad-prog', 'chords', L => runAtom(C(G, false, L), 'triadProgression', { chords: '$axis', set: [2, 3, 4] })],
  ['seventh-qualities', 'chords', L => runAtom(C(Cn, false, Math.max(L, 4)), 'qualityCycle', {})],
  ['inversions', 'chords', L => runAtom(C(Cn, false, Math.max(L, 4)), 'inversionCycle', { type: 'maj7' })],
  ['shells', 'chords', L => runAtom(C(Cn, false, Math.max(L, 4), 'iiVI'), 'shellComp', { chords: '$iiVI' })],
  ['drop2', 'chords', L => runAtom(C(Cn, false, Math.max(L, 5), 'iiVI'), 'drop2Comp', { chords: '$iiVI', set: [1, 2, 3, 4] })],
  ['embellish', 'chords', L => runAtom(C(D, false, L, 'neo'), 'embellish', { chords: '$neo' })],
  // Rhythm
  ['strum', 'rhythm', L => runAtom(C(G, false, L), 'strumPattern', { chords: ['G', 'C', 'D', 'Em'], pattern: 'pop' })],
  ['funk', 'rhythm', L => runAtom(C(E, true, L), 'funkScratch', { chord: 'E9' })],
  ['shuffle', 'rhythm', L => runAtom(C(A, false, L), 'shuffleRiff')],
  ['subdivisions', 'rhythm', L => runAtom(C(A, false, L), 'subdivisionLadder', { feel: 'straight' })],
  ['gap-click', 'rhythm', L => runAtom(C(G, false, L), 'gapClick', { chords: '$axis' })],
  ['odd-meter', 'rhythm', L => runAtom(C(E, true, Math.max(L, 4)), 'oddMeterRiff', { meter: 7 })],
  ['boom-chicka', 'rhythm', L => runAtom(C(G, false, L), 'boomChicka', { chords: ['G', 'C', 'D', 'G'] })],
  ['chug', 'rhythm', L => runAtom(C(E, true, L), 'chugRiff', { rhythm: 'gallop' })],
  // Scales & fretboard
  ['penta', 'scales', L => runAtom(C(A, true, L), 'scaleRun', { scale: 'minorPent', box: 1 })],
  ['major-scale', 'scales', L => runAtom(C(G, false, L), 'scaleRun', { scale: 'major', nps: 3 })],
  ['blues-scale', 'scales', L => runAtom(C(A, true, L), 'scaleRun', { scale: 'blues', box: 1 })],
  ['connect', 'scales', L => runAtom(C(A, true, L), 'connectPositions', { scale: 'minorPent', from: 1, to: 2 })],
  ['note-finder', 'scales', L => runAtom(C(A, true, L), 'noteFinder')],
  ['string-notes', 'scales', L => ({ ...stringNotesDrill(5, L), family: 'notes' })],
  ['intervals', 'scales', L => runAtom(C(A, true, L), 'intervalShapes')],
  ['arpeggio', 'scales', L => runAtom(C(Cn, false, L), 'arpeggioBox', { type: 'maj7' })],
  // Theory
  ['key-chords', 'theory', L => runAtom(C(G, false, L), 'diatonicCycle', {})],
  ['modes', 'theory', L => runAtom(C(A, true, Math.max(L, 4)), 'modeCompare', { modes: ['minor', 'dorian'] })],
  ['guide-tones', 'theory', L => runAtom(C(Cn, false, Math.max(L, 4), 'iiVI'), 'guideTones', { chords: '$iiVI' })],
  // Ear & improvisation
  ['echo', 'ear', L => runAtom(C(A, true, L, 'minorRock'), 'echoPhrases', { chords: '$minorRock' })],
  ['find-key', 'ear', L => runAtom(C(G, false, L), 'earKey', { chords: '$axis' })],
  ['call-response', 'ear', L => runAtom(C(A, true, L, 'blues'), 'callResponse', { chords: '$blues' })],
  ['target-solo', 'ear', L => runAtom(C(A, true, L, 'blues'), 'targetSolo', { chords: '$blues' })]
];

/** Player's level for a category (their level in the matching skill area). */
export function levelFor(p, cat) {
  const d = p && p.domains && p.domains[CAT_DOMAIN[cat] || 'fretting'];
  return Math.max(1, Math.min(10, d ? d.level : 3));
}

const cache = new Map();
/** One library entry, built for the player's level: {id, cat, ex}. */
export function libEntry(p, id) {
  const e = ENTRIES.find(x => x[0] === id); if (!e) return null;
  const L = levelFor(p, e[1]);
  const ck = id + '|' + L;
  if (cache.has(ck)) return cache.get(ck);
  let raw = null;
  try { raw = e[2](L); } catch { raw = null; }
  if (!raw) return null;
  const ex = normalizeExercise({ ...raw, id: 'lib-' + id });
  if (!ex) return null;
  ex.id = 'lib-' + id;
  if (raw.family && !ex.family) ex.family = raw.family;
  if (raw.level && !ex.level) ex.level = raw.level;
  const entry = { id, cat: e[1], ex };
  cache.set(ck, entry);
  return entry;
}
export function libraryEntries(p) { return ENTRIES.map(e => libEntry(p, e[0])).filter(Boolean); }
export function libVariations(p, entry) { return variationsFor(entry.ex, { level: levelFor(p, entry.cat) }); }

/* ------------------------------- Progress ------------------------------- */
export const libKey = (id, vid) => `lib:${id}~${vid || 'base'}`;
export function libState(p, id, vid) { return (p.varState || {})[libKey(id, vid)] || null; }
export function libTarget(p, entry, v) {
  const st = libState(p, entry.id, v.vid);
  return st ? st.target : calibratedTarget(v.ex, v.level, p);
}
/** The variation to suggest: just above the player's level, not yet mastered. */
export function edgeVariation(p, entry, list = libVariations(p, entry)) {
  return pickVariation(list, { want: 'edge', level: levelFor(p, entry.cat), isMastered: vid => !!(libState(p, entry.id, vid) || {}).mastered });
}
/** Summary for a list row: practiced / mastered counts and the level range. */
export function libSummary(p, entry, list = libVariations(p, entry)) {
  const sts = list.map(v => libState(p, entry.id, v.vid)).filter(Boolean);
  return { count: list.length, lo: Math.min(...list.map(v => v.level)), hi: Math.max(...list.map(v => v.level)), practiced: sts.filter(s => s.history.length).length, mastered: sts.filter(s => s.mastered).length };
}

/** Log a result for one variation. Returns the progression decision + level changes. */
export function recordLib(p, entry, v, { tempo, clean, source = 'library' }) {
  p.varState = p.varState || {};
  const k = libKey(entry.id, v.vid);
  const es = p.varState[k] || (p.varState[k] = newExerciseState(libTarget(p, entry, v)));
  const decision = applyResult(es, v.ex, { tempo, clean, date: today() });
  addEvidence(p, { key: k, domain: v.ex.domain, label: `${entry.ex.name}: ${v.label}`, level: v.level, tempo, goal: v.ex.goalBpm, clean, source });
  p.exerciseLog.push({ date: today(), at: Date.now(), exerciseId: v.ex.id, name: `${entry.ex.name} (${v.label})`, tempo, goalBpm: v.ex.goalBpm, clean, mastered: !!es.mastered, source });
  const changes = recomputeLevels(p);
  return { decision, changes, state: es };
}

/* ----------------------------- Session queue ----------------------------- */
const QUEUE_KEY = 'fretworkCoach.libQueue';
export const Queue = {
  get() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') || []; } catch { return []; } },
  set(q) { try { q.length ? localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(0, 12))) : localStorage.removeItem(QUEUE_KEY); } catch { /* storage off */ } },
  has(id, vid) { return this.get().some(x => x.id === id && x.vid === vid); },
  toggle(id, vid) { const q = this.get(); const i = q.findIndex(x => x.id === id && x.vid === vid); if (i >= 0) q.splice(i, 1); else q.push({ id, vid }); this.set(q); return i < 0; },
  clear() { this.set([]); }
};
const BLOCK_FOR = { warmup: 'warmup', theory: 'theory', ear: 'music', scales: 'review' };
/** Items for makeAdhocRoutine from the queue. */
export function queueItems(p) {
  return Queue.get().map(({ id, vid }) => {
    const entry = libEntry(p, id); if (!entry) return null;
    const v = findVariation(libVariations(p, entry), vid);
    return { block: BLOCK_FOR[entry.cat] || 'stretch', ex: v.ex, targetBpm: libTarget(p, entry, v), minutes: v.ex.minutes || 5,
      extra: { libId: entry.id, vid: v.vid, exId: entry.ex.id, baseEx: entry.ex, ...(v.vid !== 'base' ? { variation: `${v.label}: ${v.change}` } : {}) } };
  }).filter(Boolean);
}
export { EXERCISE_BY_ID };
