// Interval trainer: settings, prompt generation and scoring. The screen
// (screens/intervals.js) shows a key and an interval; the player answers by
// playing the note (microphone) or tapping it on the fretboard. Every musical
// setting can be fixed or randomized.
import { mod12, ROOT_BY_PC, SCALES, SCALE_BY_ID, parseNote } from './theory.js';

export const INTERVALS = [
  ['1', 0, '1', 'P1', 'root'], ['b2', 1, '♭2', 'm2', 'minor 2nd'], ['2', 2, '2', 'M2', 'major 2nd'], ['b3', 3, '♭3', 'm3', 'minor 3rd'], ['3', 4, '3', 'M3', 'major 3rd'],
  ['4', 5, '4', 'P4', 'perfect 4th'], ['#4', 6, '♯4', 'A4', 'augmented 4th'], ['b5', 6, '♭5', 'd5', 'diminished 5th'], ['5', 7, '5', 'P5', 'perfect 5th'], ['#5', 8, '♯5', 'A5', 'augmented 5th'],
  ['b6', 8, '♭6', 'm6', 'minor 6th'], ['6', 9, '6', 'M6', 'major 6th'], ['b7', 10, '♭7', 'm7', 'minor 7th'], ['7', 11, '7', 'M7', 'major 7th'], ['8', 12, '8', 'P8', 'octave'],
  ['b9', 13, '♭9', 'm9', 'flat 9th'], ['9', 14, '9', 'M9', '9th'], ['#9', 15, '♯9', 'A9', 'sharp 9th'], ['11', 17, '11', 'P11', '11th'], ['#11', 18, '♯11', 'A11', 'sharp 11th'], ['b13', 20, '♭13', 'm13', 'flat 13th'], ['13', 21, '13', 'M13', '13th']
].map(([id, semis, deg, short, long]) => ({ id, semis, deg, short, long, ext: semis > 12 }));
export const INTERVAL_BY_ID = Object.fromEntries(INTERVALS.map(i => [i.id, i]));
const LABEL_ID = { R: '1', '♭2': 'b2', 2: '2', '♭3': 'b3', 3: '3', 4: '4', '♯4': '#4', '♭5': 'b5', 5: '5', '♯5': '#5', '♭6': 'b6', 6: '6', '♭7': 'b7', 7: '7' };
// Scale degree (letter distance) of each interval, for spelling the answer (A + ♭3 = C, C + ♭3 = E♭)
const DEG_NUM = { 1: 1, b2: 2, 2: 2, b3: 3, 3: 3, 4: 4, '#4': 4, b5: 5, 5: 5, '#5': 5, b6: 6, 6: 6, b7: 7, 7: 7, 8: 1, b9: 2, 9: 2, '#9': 2, 11: 4, '#11': 4, b13: 6, 13: 6 };

export const KEY_NAMES = Array.from({ length: 12 }, (_, pc) => ROOT_BY_PC[pc].name);
export const AREAS = { neck: [0, 15, 'Whole neck'], open: [0, 4, 'Open position (frets 0–4)'], p5: [5, 8, 'Frets 5–8'], p7: [7, 10, 'Frets 7–10'], p9: [9, 12, 'Frets 9–12'], p12: [12, 15, 'Frets 12–15'] };
export const STRING_NAMES = ['', 'high e', 'B', 'G', 'D', 'A', 'low E'];
export const OPEN_MIDI = [64, 59, 55, 50, 45, 40]; // string 1 … string 6
export const SCALE_CHOICES = [['chromatic', 'All 12 (chromatic)'], ...SCALES.filter(s => s.id !== 'chromatic').map(s => [s.id, s.name])];
export const DEFAULTS = {
  key: 9,                 // pc | 'random-round' | 'random-prompt' | 'cycle4'
  scale: 'major',         // scale id | 'chromatic' | 'random'
  source: 'scale',        // 'scale' (the scale's degrees) | 'custom' | 'random-set'
  custom: ['1', '3', '5'],
  ext: false,             // add 9ths, 11ths, 13ths: true | false | 'random'
  includeRoot: false,     // ask for the root (1) too: true | false | 'random'
  order: 'random',        // 'random' | 'up' | 'down'
  from: 'root',           // 'root' | 'previous' | 'random'
  string: 'any',          // 'any' | 1..6 | 'random'
  area: 'neck',           // area id | 'random'
  labels: 'deg',          // 'deg' | 'short' | 'long' | 'random'
  count: 20,              // prompts per round (0 = keep going)
  time: 0,                // seconds per prompt (0 = no limit)
  answer: 'mic',          // 'mic' | 'tap'
  playRoot: true,         // play the root when the key changes
  showRoots: true         // mark the roots on the neck
};
const TRI = v => (v === 'random' ? 'random' : !!v);
export function normalizeSettings(s = {}) {
  const o = { ...DEFAULTS, ...(s || {}) };
  if (typeof o.key === 'string' && /^\d+$/.test(o.key)) o.key = +o.key;
  if (!(typeof o.key === 'number' && o.key >= 0 && o.key < 12) && !['random-round', 'random-prompt', 'cycle4'].includes(o.key)) o.key = DEFAULTS.key;
  if (!(o.scale === 'chromatic' || o.scale === 'random' || SCALE_BY_ID[o.scale])) o.scale = 'major';
  if (!['scale', 'custom', 'random-set'].includes(o.source)) o.source = 'scale';
  if (!Array.isArray(o.custom)) o.custom = [];
  o.custom = INTERVALS.map(i => i.id).filter(id => o.custom.includes(id));
  if (!o.custom.length) o.custom = [...DEFAULTS.custom];
  o.ext = TRI(o.ext); o.includeRoot = TRI(o.includeRoot);
  if (!['random', 'up', 'down'].includes(o.order)) o.order = 'random';
  if (!['root', 'previous', 'random'].includes(o.from)) o.from = 'root';
  if (!(o.area in AREAS) && o.area !== 'random') o.area = 'neck';
  if (o.string !== 'any' && o.string !== 'random') o.string = +o.string >= 1 && +o.string <= 6 ? +o.string : 'any';
  if (!['deg', 'short', 'long', 'random'].includes(o.labels)) o.labels = 'deg';
  o.count = [0, 10, 20, 30, 50].includes(+o.count) ? +o.count : 20;
  o.time = [0, 2, 3, 5, 8].includes(+o.time) ? +o.time : 0;
  if (!['mic', 'tap'].includes(o.answer)) o.answer = 'mic';
  o.playRoot = !!o.playRoot; o.showRoots = !!o.showRoots;
  return o;
}

/** Interval ids a scale contains (as degrees from its root). */
export function scaleIntervals(scaleId) {
  if (scaleId === 'chromatic') return ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
  const sc = SCALE_BY_ID[scaleId] || SCALE_BY_ID.major;
  return sc.labels.map(l => LABEL_ID[l]).filter(Boolean);
}
export const scaleName = id => (id === 'chromatic' ? 'chromatic' : (SCALE_BY_ID[id] || { name: id }).name.replace(/ \(.*\)$/, ''));
export function intervalLabel(id, style = 'deg') {
  const i = INTERVAL_BY_ID[id]; if (!i) return id;
  return style === 'short' ? i.short : style === 'long' ? i.long : i.deg;
}
/** Color family for fretboard dots. */
export function intervalFamily(id) {
  const d = DEG_NUM[id]; const i = INTERVAL_BY_ID[id];
  if (d === 1) return 'root';
  if (i && i.ext) return 'ext';
  return d === 3 ? 'third' : d === 5 ? 'fifth' : d === 7 ? 'seventh' : d === 6 ? 'sixth' : 'sus';
}

const LETTERS = 'CDEFGAB', LETTER_PC = [0, 2, 4, 5, 7, 9, 11], ACC = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
/** Spell the note an interval above a named note: spellInterval('A', 'b3') → 'C', ('C', 'b3') → 'E♭'. */
export function spellInterval(refName, id) {
  const ref = parseNote(String(refName).replace('𝄫', 'bb').replace('𝄪', '##')) || { letter: 0, pc: 0, acc: 0 };
  const it = INTERVAL_BY_ID[id]; if (!it) return refName;
  const li = (ref.letter + (DEG_NUM[id] || 1) - 1) % 7;
  let acc = mod12(ref.pc + it.semis) - LETTER_PC[li];
  if (acc > 6) acc -= 12; if (acc < -6) acc += 12;
  if (Math.abs(acc) <= 2) return LETTERS[li] + ACC[acc];
  return ROOT_BY_PC[mod12(ref.pc + it.semis)].name;
}

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const EXT_FOR = { 2: '9', b2: 'b9', b3: '#9', 4: '11', '#4': '#11', b6: 'b13', 6: '13' };

/**
 * A round fixes the round-level choices (key, scale, interval set, area,
 * extensions, root included). prev: the previous round or {key} (for the cycle of 4ths).
 */
export function newRound(settings, prev = null, rnd = Math.random) {
  const s = normalizeSettings(settings);
  const scale = s.scale === 'random' ? pick(SCALE_CHOICES.map(x => x[0]), rnd) : s.scale;
  const key = typeof s.key === 'number' ? s.key
    : s.key === 'cycle4' ? (prev && typeof prev.key === 'number' ? mod12(prev.key + 5) : 0)
    : Math.floor(rnd() * 12);
  const ext = s.ext === 'random' ? rnd() < 0.5 : s.ext;
  const includeRoot = s.includeRoot === 'random' ? rnd() < 0.5 : s.includeRoot;
  let pool = s.source === 'custom' ? [...s.custom] : scaleIntervals(scale);
  if (s.source === 'random-set') {
    const base = scaleIntervals(scale).filter(x => x !== '1');
    const n = Math.min(base.length, 3 + Math.floor(rnd() * 2)); pool = [];
    while (pool.length < n) { const x = pick(base, rnd); if (!pool.includes(x)) pool.push(x); }
    if (includeRoot) pool.push('1');
  }
  // your own picks are used as they are; scale sets drop the root unless asked
  if (s.source !== 'custom' && !includeRoot && pool.length > 1) pool = pool.filter(x => x !== '1' && x !== '8');
  if (s.source === 'scale' && includeRoot && !pool.includes('1')) pool.push('1');
  if (ext) pool = [...pool, ...pool.map(x => EXT_FOR[x]).filter(Boolean)];
  pool = [...new Set(pool)].filter(id => INTERVAL_BY_ID[id]).sort((a, b) => INTERVAL_BY_ID[a].semis - INTERVAL_BY_ID[b].semis);
  if (!pool.length) pool = ['3'];
  const area = s.area === 'random' ? pick(Object.keys(AREAS).filter(a => a !== 'neck'), rnd) : s.area;
  return { settings: s, key, scale, pool, area, ext, includeRoot, i: 0, last: null, lastTarget: null, lastTargetName: null, results: [], startedAt: Date.now() };
}

/** Where a pitch class sits in an area (and optionally on one string): [{s, f}]. */
export function positionsOf(pc, area = 'neck', string = null) {
  const [lo, hi] = Array.isArray(area) ? area : (AREAS[area] || AREAS.neck);
  const out = [];
  for (let s = 1; s <= 6; s++) { if (string && s !== string) continue; for (let f = lo; f <= hi; f++) if (mod12(OPEN_MIDI[s - 1] + f) === mod12(pc)) out.push({ s, f }); }
  return out;
}

/** Next prompt in a round. */
export function nextPrompt(round, rnd = Math.random) {
  const s = round.settings;
  const key = s.key === 'random-prompt' ? Math.floor(rnd() * 12) : round.key;
  let id;
  if (s.order === 'up' || s.order === 'down') {
    const list = s.order === 'up' ? round.pool : [...round.pool].reverse();
    id = list[round.i % list.length];
  } else {
    const opts = round.pool.length > 1 ? round.pool.filter(x => x !== round.last) : round.pool;
    id = pick(opts, rnd);
  }
  const wantPrev = s.from === 'previous' || (s.from === 'random' && rnd() < 0.5);
  const chained = wantPrev && round.lastTarget != null;
  const refPc = chained ? round.lastTarget : key;
  const refName = chained ? round.lastTargetName : KEY_NAMES[key];
  const it = INTERVAL_BY_ID[id];
  const string = s.string === 'random' ? 1 + Math.floor(rnd() * 6) : s.string === 'any' ? null : +s.string;
  const labels = s.labels === 'random' ? pick(['deg', 'short', 'long'], rnd) : s.labels;
  const targetPc = mod12(refPc + it.semis);
  // Where to play it: the round's area, on one string if asked. A short window on
  // one string can miss the note, so the string then opens to the whole neck.
  let zone = [...(AREAS[round.area] || AREAS.neck).slice(0, 2)];
  if (string && !positionsOf(targetPc, zone, string).length) zone = [0, 15];
  const prompt = { n: round.i + 1, key, keyName: KEY_NAMES[key], id, semis: it.semis, refPc, refName, from: chained ? 'previous' : 'root', targetPc, targetName: spellInterval(refName, id), string, labels, area: round.area, zone, at: Date.now() };
  round.i++; round.last = id;
  return prompt;
}

/** Record an answer. result: {correct, ms, playedPc, hinted, timedOut, skipped} */
export function scoreAnswer(round, prompt, result) {
  round.results.push({ id: prompt.id, key: prompt.key, correct: !!result.correct && !result.hinted, ms: Math.max(0, Math.round(result.ms || 0)), playedPc: result.playedPc ?? null, hinted: !!result.hinted, timedOut: !!result.timedOut, skipped: !!result.skipped });
  // the chain continues from the right note either way, spelled the common way (A♯ → B♭)
  round.lastTarget = prompt.targetPc; round.lastTargetName = KEY_NAMES[prompt.targetPc];
}
export function roundDone(round) { return round.settings.count > 0 && round.results.length >= round.settings.count; }

/** Summary: accuracy, average time of correct answers, per interval, best streak, weakest intervals. */
export function summarizeRound(round) {
  const r = round.results, n = r.length, correct = r.filter(x => x.correct).length;
  const times = r.filter(x => x.correct).map(x => x.ms);
  const avgMs = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const by = {};
  for (const x of r) { const b = by[x.id] || (by[x.id] = { id: x.id, n: 0, correct: 0, ms: 0 }); b.n++; if (x.correct) { b.correct++; b.ms += x.ms; } }
  const per = Object.values(by).map(b => ({ ...b, acc: b.n ? b.correct / b.n : 0, avgMs: b.correct ? Math.round(b.ms / b.correct) : null }))
    .sort((a, b) => a.acc - b.acc || (b.avgMs || 9e9) - (a.avgMs || 9e9));
  let streak = 0, best = 0; for (const x of r) { streak = x.correct ? streak + 1 : 0; best = Math.max(best, streak); }
  const weakest = per.filter(b => b.acc < 1 || (avgMs && (b.avgMs || 0) > avgMs * 1.3)).slice(0, 3).map(b => b.id);
  return { n, correct, acc: n ? correct / n : 0, avgMs, per, bestStreak: best, weakest };
}
/** Correct answers per minute of answering time (the trainer's "tempo"). */
export function answersPerMinute(sum) { return sum.avgMs ? Math.round(60000 / sum.avgMs * sum.acc) : 0; }

/** How demanding these settings are (1–10), for skill evidence. */
export function settingsLevel(settings) {
  const s = normalizeSettings(settings);
  let l = 2;
  if (s.key === 'random-prompt') l += 2; else if (typeof s.key !== 'number') l += 1;
  const n = s.source === 'custom' ? s.custom.length : s.source === 'random-set' ? 4 : scaleIntervals(s.scale === 'random' ? 'major' : s.scale).length;
  if (n >= 7) l += 1; if (n >= 11 || (s.source === 'scale' && s.scale === 'chromatic')) l += 1;
  if (s.ext === true) l += 1; else if (s.ext === 'random') l += 0.5;
  if (s.from === 'previous') l += 2; else if (s.from === 'random') l += 1;
  if (s.time && s.time <= 3) l += 1;
  if (s.string !== 'any' || s.area !== 'neck') l += 1;
  if (!s.showRoots) l += 0.5;
  return Math.max(1, Math.min(10, Math.round(l)));
}

export const keyName = pc => KEY_NAMES[mod12(pc)];
/** A spelled note with its everyday name when the spelling is unusual: 'E♯ (F)', 'B𝄫 (A)'. */
export function noteLabel(name) {
  const n = parseNote(String(name).replace('𝄫', 'bb').replace('𝄪', '##'));
  if (!n) return name;
  return KEY_NAMES[n.pc] === name || ['C♯', 'D♭', 'D♯', 'G♭', 'G♯', 'A♯'].includes(name) ? name : `${name} (${KEY_NAMES[n.pc]})`;
}
/** Pitch class at a string/fret. */
export const pcAt = (s, f) => mod12(OPEN_MIDI[s - 1] + f);

/**
 * Where an interval sits relative to its reference note, as a fretboard shape
 * ("one string up, 2 frets back"). Strings are a 4th apart except G to B (a 3rd),
 * so crossing that pair moves the shape one fret up.
 */
export function shapeTip(id) {
  const it = INTERVAL_BY_ID[id]; if (!it) return '';
  const semis = it.semis === 0 ? 0 : it.semis % 12 === 0 ? 12 : it.semis % 12;
  const fr = o => (o === 0 ? 'same fret' : `${Math.abs(o)} fret${Math.abs(o) > 1 ? 's' : ''} ${o > 0 ? 'up' : 'back'}`);
  if (semis === 0) return 'Same note as the reference (or its octave: two strings up, 2 frets up).';
  const opts = [];
  if (semis <= 5) opts.push(`${fr(semis)} on the same string`);
  for (const [d, t] of [[5, 'one string up'], [10, 'two strings up']]) { const o = semis - d; if (Math.abs(o) <= 4) opts.push(`${t}, ${fr(o)}`); }
  const base = it.ext ? `The ${INTERVAL_BY_ID[EXT_BASE[id]].deg} an octave higher: ` : '';
  const cross = opts.some(o => /string up/.test(o)) ? ' (+1 fret when you cross from G to B)' : '';
  return `${base}${opts.slice(0, 2).join(', or ')}${cross}.`.replace(/^./, c => c.toUpperCase());
}
const EXT_BASE = { b9: 'b2', 9: '2', '#9': 'b3', 11: '4', '#11': '#4', b13: 'b6', 13: '6' };
