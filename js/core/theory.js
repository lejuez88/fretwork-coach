// Music theory engine: note spelling, chord types, chord parsing and naming,
// chord identification from notes, voicings (full shapes up the neck,
// triads and drop-2/drop-3/shell inversions on string sets), voice leading,
// scales and scale positions. Voicings are fret arrays from the low E string
// to the high e string (index 0 = string 6), null = muted string.

export const STD_LOW = [40, 45, 50, 55, 59, 64];           // string 6 … string 1 (MIDI)
const LETTERS = 'CDEFGAB', LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const ACC = { '-2': '♭♭', '-1': '♭', 0: '', 1: '♯', 2: '♯♯' };
export const mod12 = n => ((n % 12) + 12) % 12;

/** Root choices (common spellings). */
export const ROOTS = [
  ['C', 0, 0], ['C♯', 0, 1], ['D', 1, 0], ['E♭', 2, -1], ['E', 2, 0], ['F', 3, 0],
  ['F♯', 3, 1], ['G', 4, 0], ['A♭', 5, -1], ['A', 5, 0], ['B♭', 6, -1], ['B', 6, 0]
].map(([name, li, acc]) => ({ name, letter: li, acc, pc: mod12(LETTER_PC[li] + acc) }));
export const ROOT_BY_PC = Object.fromEntries(ROOTS.map(r => [r.pc, r]));
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const pcName = (pc, flats = false) => (flats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];

/** Parse a note name ("C#", "Db", "B♭", "e") → {name, letter, acc, pc} or null. */
export function parseNote(s) {
  const m = String(s || '').trim().match(/^([A-Ga-g])(##|bb|[#♯b♭]|𝄪)?$/);
  if (!m) return null;
  const li = LETTERS.indexOf(m[1].toUpperCase());
  const acc = !m[2] ? 0 : /^(##|𝄪)$/.test(m[2]) ? 2 : m[2] === 'bb' ? -2 : /[#♯]/.test(m[2]) ? 1 : -1;
  return { name: LETTERS[li] + ACC[acc], letter: li, acc, pc: mod12(LETTER_PC[li] + acc) };
}

/* ------------------------------ Intervals ------------------------------ */
const DEGREE_OF = { R: 1, '♭2': 2, 2: 2, '♭9': 2, 9: 2, '♯9': 2, '♭3': 3, 3: 3, 4: 4, 11: 4, '♯11': 4, '♭5': 5, 5: 5, '♯5': 5, 6: 6, 13: 6, '♭13': 6, '♭♭7': 7, '♭7': 7, 7: 7 };
/** Spell the note at `semis` above `root` with the given interval label (C + ♭3 → E♭). */
export function spell(root, semis, label) {
  const deg = DEGREE_OF[label] || 1;
  const li = (root.letter + deg - 1) % 7;
  let acc = mod12(root.pc + semis) - LETTER_PC[li];
  if (acc > 6) acc -= 12; if (acc < -6) acc += 12;
  return Math.abs(acc) <= 2 ? LETTERS[li] + ACC[acc] : pcName(root.pc + semis, root.acc < 0);
}
/** Interval family (for colors): root, third, fifth, seventh, extension. */
export function intervalFamily(label) {
  if (label === 'R') return 'root';
  const d = DEGREE_OF[label];
  if (d === 3) return 'third';
  if (d === 5) return 'fifth';
  if (d === 7) return 'seventh';
  if (label === '4' || label === '2') return 'sus';
  if (label === '6') return 'sixth';
  return 'ext';
}
const LABEL_FOR_SEMIS = ['R', '♭9', '9', '♭3', '3', '4', '♭5', '5', '♯5', '6', '♭7', '7'];

/* ----------------------------- Chord types ----------------------------- */
// tones: [semitones, label]; req: labels a voicing must contain; aliases: suffixes accepted when parsing
const T = (id, symbol, name, tones, req, aliases = [], group = 'basic') => ({ id, symbol, name, tones: tones.map(([s, l]) => ({ semis: s, label: l })), req: req || tones.map(t => t[1]), aliases, group });
export const CHORD_TYPES = [
  T('maj', '', 'Major', [[0, 'R'], [4, '3'], [7, '5']], null, ['', 'maj', 'M', 'major'], 'triad'),
  T('min', 'm', 'Minor', [[0, 'R'], [3, '♭3'], [7, '5']], null, ['m', 'min', '-', 'minor'], 'triad'),
  T('dim', 'dim', 'Diminished', [[0, 'R'], [3, '♭3'], [6, '♭5']], null, ['dim', '°', 'o', 'diminished'], 'triad'),
  T('aug', 'aug', 'Augmented', [[0, 'R'], [4, '3'], [8, '♯5']], null, ['aug', '+', 'augmented'], 'triad'),
  T('sus2', 'sus2', 'Suspended 2nd', [[0, 'R'], [2, '2'], [7, '5']], null, ['sus2'], 'triad'),
  T('sus4', 'sus4', 'Suspended 4th', [[0, 'R'], [5, '4'], [7, '5']], null, ['sus4', 'sus'], 'triad'),
  T('5', '5', 'Power chord', [[0, 'R'], [7, '5']], null, ['5'], 'triad'),
  T('7', '7', 'Dominant 7th', [[0, 'R'], [4, '3'], [7, '5'], [10, '♭7']], ['R', '3', '♭7'], ['7', 'dom7', 'dominant7'], 'seventh'),
  T('maj7', 'maj7', 'Major 7th', [[0, 'R'], [4, '3'], [7, '5'], [11, '7']], ['R', '3', '7'], ['maj7', 'M7', 'Δ7', 'Δ', 'ma7', 'major7'], 'seventh'),
  T('m7', 'm7', 'Minor 7th', [[0, 'R'], [3, '♭3'], [7, '5'], [10, '♭7']], ['R', '♭3', '♭7'], ['m7', 'min7', '-7', 'minor7'], 'seventh'),
  T('m7b5', 'm7♭5', 'Half-diminished (m7♭5)', [[0, 'R'], [3, '♭3'], [6, '♭5'], [10, '♭7']], null, ['m7b5', 'ø', 'ø7', 'min7b5', 'halfdiminished'], 'seventh'),
  T('dim7', 'dim7', 'Diminished 7th', [[0, 'R'], [3, '♭3'], [6, '♭5'], [9, '♭♭7']], null, ['dim7', '°7', 'o7', 'diminished7'], 'seventh'),
  T('mmaj7', 'm(maj7)', 'Minor-major 7th', [[0, 'R'], [3, '♭3'], [7, '5'], [11, '7']], ['R', '♭3', '7'], ['mmaj7', 'm(maj7)', 'mM7', 'minmaj7', 'm(ma7)'], 'seventh'),
  T('7sus4', '7sus4', 'Dominant 7th sus4', [[0, 'R'], [5, '4'], [7, '5'], [10, '♭7']], ['R', '4', '♭7'], ['7sus4', '7sus'], 'seventh'),
  T('7b5', '7♭5', 'Dominant 7th ♭5', [[0, 'R'], [4, '3'], [6, '♭5'], [10, '♭7']], null, ['7b5', '7(b5)'], 'seventh'),
  T('aug7', '7♯5', 'Augmented 7th (7♯5)', [[0, 'R'], [4, '3'], [8, '♯5'], [10, '♭7']], null, ['7#5', 'aug7', '+7', '7+'], 'seventh'),
  T('6', '6', 'Major 6th', [[0, 'R'], [4, '3'], [7, '5'], [9, '6']], ['R', '3', '6'], ['6', 'maj6'], 'sixth'),
  T('m6', 'm6', 'Minor 6th', [[0, 'R'], [3, '♭3'], [7, '5'], [9, '6']], ['R', '♭3', '6'], ['m6', 'min6'], 'sixth'),
  T('69', '6/9', '6/9', [[0, 'R'], [4, '3'], [7, '5'], [9, '6'], [2, '9']], ['R', '3', '6', '9'], ['6/9', '69'], 'sixth'),
  T('add9', 'add9', 'Add 9', [[0, 'R'], [4, '3'], [7, '5'], [2, '9']], ['R', '3', '9'], ['add9', 'add2'], 'added'),
  T('madd9', 'm(add9)', 'Minor add 9', [[0, 'R'], [3, '♭3'], [7, '5'], [2, '9']], ['R', '♭3', '9'], ['madd9', 'm(add9)', 'madd2'], 'added'),
  T('9', '9', 'Dominant 9th', [[0, 'R'], [4, '3'], [7, '5'], [10, '♭7'], [2, '9']], ['R', '3', '♭7', '9'], ['9', 'dom9'], 'extended'),
  T('maj9', 'maj9', 'Major 9th', [[0, 'R'], [4, '3'], [7, '5'], [11, '7'], [2, '9']], ['R', '3', '7', '9'], ['maj9', 'M9', 'Δ9'], 'extended'),
  T('m9', 'm9', 'Minor 9th', [[0, 'R'], [3, '♭3'], [7, '5'], [10, '♭7'], [2, '9']], ['R', '♭3', '♭7', '9'], ['m9', 'min9', '-9'], 'extended'),
  T('7b9', '7♭9', 'Dominant 7th ♭9', [[0, 'R'], [4, '3'], [7, '5'], [10, '♭7'], [1, '♭9']], ['R', '3', '♭7', '♭9'], ['7b9'], 'extended'),
  T('7s9', '7♯9', 'Dominant 7th ♯9', [[0, 'R'], [4, '3'], [7, '5'], [10, '♭7'], [3, '♯9']], ['R', '3', '♭7', '♯9'], ['7#9'], 'extended'),
  T('11', '11', 'Dominant 11th', [[0, 'R'], [7, '5'], [10, '♭7'], [2, '9'], [5, '11']], ['R', '♭7', '11'], ['11', '9sus4'], 'extended'),
  T('m11', 'm11', 'Minor 11th', [[0, 'R'], [3, '♭3'], [7, '5'], [10, '♭7'], [2, '9'], [5, '11']], ['R', '♭3', '♭7', '11'], ['m11', 'min11'], 'extended'),
  T('13', '13', 'Dominant 13th', [[0, 'R'], [4, '3'], [7, '5'], [10, '♭7'], [2, '9'], [9, '13']], ['R', '3', '♭7', '13'], ['13', 'dom13'], 'extended')
];
export const TYPE_BY_ID = Object.fromEntries(CHORD_TYPES.map(t => [t.id, t]));
export const TYPE_GROUPS = [['triad', 'Triads'], ['seventh', '7th chords'], ['sixth', '6th chords'], ['added', 'Added tones'], ['extended', 'Extended']];
const ALIAS = [];
CHORD_TYPES.forEach(t => t.aliases.forEach(a => ALIAS.push([a, t.id])));
ALIAS.sort((a, b) => b[0].length - a[0].length);

/** Notes of a chord: [{semis, label, pc, name}] */
export function chordTones(root, typeId) {
  const t = TYPE_BY_ID[typeId] || TYPE_BY_ID.maj;
  const r = typeof root === 'number' ? ROOT_BY_PC[mod12(root)] : root;
  return t.tones.map(x => ({ ...x, pc: mod12(r.pc + x.semis), name: spell(r, x.semis, x.label) }));
}
export function chordName(root, typeId, bass = null) {
  const r = typeof root === 'number' ? ROOT_BY_PC[mod12(root)] : root;
  const t = TYPE_BY_ID[typeId] || TYPE_BY_ID.maj;
  let n = r.name + t.symbol;
  if (bass != null && mod12(typeof bass === 'number' ? bass : bass.pc) !== r.pc) {
    const bpc = mod12(typeof bass === 'number' ? bass : bass.pc);
    const tone = chordTones(r, typeId).find(x => x.pc === bpc);
    n += '/' + (tone ? tone.name : pcName(bpc, r.acc < 0));
  }
  return n;
}

/** Parse "Cmaj7", "F#m7b5", "Bb/D", "Am(add9)" → {root, type, bass, name} or null. */
export function parseChord(s) {
  const m = String(s || '').trim().replace(/♯/g, '#').replace(/♭/g, 'b').match(/^([A-G])(#|b)?(.*?)(?:\/([A-G](?:#|b)?))?$/);
  if (!m) return null;
  const root = parseNote(m[1] + (m[2] || ''));
  let suf = (m[3] || '').replace(/\s+/g, '');
  let typeId = null;
  for (const [a, id] of ALIAS) { if (a === suf) { typeId = id; break; } }
  if (typeId == null) { const lo = suf.toLowerCase(); for (const [a, id] of ALIAS) { if (a.toLowerCase() === lo && !/^M/.test(a)) { typeId = id; break; } } }
  if (typeId == null) return null;
  const bass = m[4] ? parseNote(m[4]) : null;
  const r = ROOT_BY_PC[root.pc].name === root.name ? ROOT_BY_PC[root.pc] : root;
  return { root: r, type: typeId, bass, name: chordName(r, typeId, bass ? bass.pc : null) };
}

/**
 * Name the chord formed by these pitch classes (bassPc = lowest note).
 * Returns candidates best first: {root, type, name, bassLabel, inversion, exact, missing:[labels]}
 */
export function identifyChord(pcs, bassPc = null) {
  const set = [...new Set(pcs.map(mod12))];
  if (!set.length) return [];
  if (bassPc == null) bassPc = set[0];
  const out = [];
  if (set.length === 1) return [{ root: ROOT_BY_PC[set[0]], type: null, name: ROOT_BY_PC[set[0]].name, note: 'single note', exact: true, score: 0 }];
  for (const rpc of set) {
    const ints = new Set(set.map(p => mod12(p - rpc)));
    for (const t of CHORD_TYPES) {
      const full = new Set(t.tones.map(x => mod12(x.semis)));
      const req = t.tones.filter(x => t.req.includes(x.label)).map(x => mod12(x.semis));
      if (![...ints].every(i => full.has(i)) || !req.every(i => ints.has(i))) continue;
      const exact = ints.size === full.size;
      const bassTone = t.tones.find(x => mod12(rpc + x.semis) === mod12(bassPc));
      let score = 10 - t.tones.length * 0.6 + (exact ? 3 : 0) + (rpc === mod12(bassPc) ? 3 : 0);
      if (['maj', 'min', '7', 'maj7', 'm7', '5'].includes(t.id)) score += 1;
      if (t.id === 'aug' || t.id === 'dim7') score -= 0.5; // symmetric chords: prefer the bass as root via the bonus above
      const inv = !bassTone || bassTone.label === 'R' ? 0 : DEGREE_OF[bassTone.label] === 3 ? 1 : DEGREE_OF[bassTone.label] === 5 ? 2 : DEGREE_OF[bassTone.label] === 7 ? 3 : 4;
      out.push({ root: ROOT_BY_PC[rpc], type: t.id, name: chordName(rpc, t.id, bassPc), inversion: inv, exact, score, missing: t.tones.filter(x => !ints.has(mod12(x.semis))).map(x => x.label) });
    }
  }
  if (!out.length && set.length === 2) {
    const iv = mod12(set[1] - set[0]);
    const names = ['unison', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd', 'perfect 4th', 'tritone', 'perfect 5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th'];
    return [{ root: ROOT_BY_PC[mod12(bassPc)], type: null, name: `${pcName(set[0])}–${pcName(set[1])}`, note: names[iv] + ' interval', exact: true, score: 0 }];
  }
  return out.sort((a, b) => b.score - a.score);
}
export const INVERSION_NAMES = ['Root position', '1st inversion', '2nd inversion', '3rd inversion', 'Extension in the bass'];

/* ------------------------------- Voicings ------------------------------ */
/** Lowest fretted note, highest, span, finger count and suggested fingers for a fret array. */
export function voicingInfo(frets) {
  const fretted = frets.map((f, i) => ({ f, i })).filter(o => o.f != null && o.f > 0);
  const minF = fretted.length ? Math.min(...fretted.map(o => o.f)) : 0;
  const maxF = fretted.length ? Math.max(...fretted.map(o => o.f)) : 0;
  const atMin = fretted.filter(o => o.f === minF);
  let barre = null;
  if (atMin.length >= 2) {
    const a = atMin[0].i, z = atMin[atMin.length - 1].i;
    if (frets.slice(a, z + 1).every(f => f != null && f >= minF)) barre = { fret: minF, from: a, to: z };
  }
  const fingersNeeded = barre ? 1 + fretted.filter(o => o.f > minF).length : fretted.length;
  // Finger suggestion: barre or lowest fret = 1, then by fret (and string) order
  const fingers = frets.map(() => null);
  const order = [...fretted].sort((x, y) => x.f - y.f || x.i - y.i);
  let next = 1;
  for (const o of order) {
    if (barre && o.f === minF && o.i >= barre.from && o.i <= barre.to) { fingers[o.i] = 1; continue; }
    const want = Math.max(next, 1 + (o.f - minF) + (barre && o.f > minF ? 0 : 0));
    fingers[o.i] = Math.min(4, Math.max(want, barre ? 2 : 1));
    next = fingers[o.i] + 1;
  }
  return { minF, maxF, span: fretted.length ? maxF - minF : 0, barre, fingersNeeded, fingers, strings: frets.filter(f => f != null).length };
}

function midisOf(frets, tuning = STD_LOW) { return frets.map((f, i) => (f == null ? null : tuning[i] + f)); }

// Standard movable shapes (CAGED and common jazz forms), as fret offsets from a barre fret b
// (null = muted). b = 0 gives the open chords. Voicings that match one get a strong bonus.
const X = null;
const SHAPES = {
  maj: [[0, 2, 2, 1, 0, 0], [X, 0, 2, 2, 2, 0], [X, 3, 2, 0, 1, 0], [3, 2, 0, 0, 0, 3], [X, X, 0, 2, 3, 2], [X, 0, 2, 2, 2, X], [0, 2, 2, 1, X, X]],
  min: [[0, 2, 2, 0, 0, 0], [X, 0, 2, 2, 1, 0], [X, X, 0, 2, 3, 1], [X, 3, 1, 0, 1, X], [X, 0, 2, 2, 1, X]],
  '7': [[0, 2, 0, 1, 0, 0], [X, 0, 2, 0, 2, 0], [X, 3, 2, 3, 1, 0], [X, X, 0, 2, 1, 2], [3, 2, 0, 0, 0, 1], [0, X, 0, 1, 0, X], [X, 0, 2, 0, 2, X], [0, 2, 0, 1, 3, 0]],
  m7: [[0, 2, 0, 0, 0, 0], [X, 0, 2, 0, 1, 0], [X, X, 0, 2, 1, 1], [0, X, 0, 0, 0, X], [X, 0, 2, 0, 1, X], [0, 2, 0, 0, 3, 0]],
  maj7: [[0, X, 1, 1, 0, X], [X, 0, 2, 1, 2, 0], [X, 3, 2, 0, 0, 0], [X, X, 0, 2, 2, 2], [X, 0, 2, 1, 2, X], [0, 2, 1, 1, 0, 0]],
  m7b5: [[X, 0, 1, 0, 1, X], [0, X, 0, 0, -1, X], [X, X, 0, 1, 1, 1]],
  dim7: [[X, 0, 1, -1, 1, X], [0, X, -1, 0, -1, X], [X, X, 0, 1, 0, 1]],
  dim: [[X, 0, 1, 2, 1, X], [X, X, 0, 1, 0, X]],
  aug: [[X, 3, 2, 1, 1, X], [X, X, 0, 3, 3, 2]],
  '6': [[X, 0, 2, 2, 2, 2], [0, 2, 2, 1, 2, 0], [X, 3, 2, 2, 1, 0]],
  m6: [[X, 0, 2, 2, 1, 2], [0, 2, 2, 0, 2, 0], [X, X, 0, 2, 0, 1]],
  sus4: [[0, 2, 2, 2, 0, 0], [X, 0, 2, 2, 3, 0], [X, X, 0, 2, 3, 3]],
  sus2: [[X, 0, 2, 2, 0, 0], [X, X, 0, 2, 3, 0], [X, 3, 0, 0, 3, X]],
  add9: [[X, 3, 2, 0, 3, 0], [X, 0, 2, 4, 2, 0], [X, 3, 2, 0, 3, 3]],
  '9': [[X, 3, 2, 3, 3, X], [0, 2, 0, 1, 0, 2], [X, 0, 2, 4, 2, 3]],
  m9: [[X, 3, 1, 3, 3, X], [0, 2, 0, 0, 0, 2]],
  maj9: [[X, 3, 2, 4, 3, X], [X, 0, 2, 1, 0, 0]],
  '7sus4': [[0, 2, 0, 2, 0, 0], [X, 0, 2, 0, 3, 0], [X, X, 0, 2, 1, 3]],
  '13': [[0, X, 0, 1, 2, X], [X, 0, X, 0, 2, 2]],
  '5': [[0, 2, 2, X, X, X], [0, 2, X, X, X, X], [X, 0, 2, 2, X, X], [X, 0, 2, X, X, X], [X, X, 0, 2, 3, X]]
};
function shapeMatch(frets, typeId) {
  const list = SHAPES[typeId]; if (!list) return 0;
  for (const sh of list) for (let b = 0; b <= 15; b++) {
    const want = sh.map(o => (o == null ? null : b + o));
    if (want.some(f => f != null && f < 0)) continue;
    if (want.every((f, i) => f === frets[i])) return 2;
    // same shape with one or two treble strings left off
    const played = frets.map((f, i) => (f == null ? -1 : i)).filter(i => i >= 0);
    if (played.length >= 4 && played.every(i => want[i] === frets[i]) && want.filter(f => f != null).length - played.length <= 2) {
      const missing = want.map((f, i) => (f != null && frets[i] == null ? i : -1)).filter(i => i >= 0);
      if (missing.every(i => i > played[played.length - 1])) return 1;
    }
  }
  return 0;
}

/**
 * Full chord voicings up the neck (4–6 strings), best per position.
 * opts: {bassLabel: 'R'|'3'|…, maxFret, minStrings, limit}
 */
export function findVoicings(root, typeId, { bassLabel = 'R', maxFret = 15, minStrings = 4, limit = 8, tuning = STD_LOW } = {}) {
  const r = typeof root === 'number' ? ROOT_BY_PC[mod12(root)] : root;
  const t = TYPE_BY_ID[typeId]; if (!t) return [];
  const tones = chordTones(r, typeId);
  const pcSet = new Set(tones.map(x => x.pc));
  const reqPcs = tones.filter(x => t.req.includes(x.label)).map(x => x.pc);
  const bassTone = tones.find(x => x.label === bassLabel) || tones[0];
  const fifth = tones.find(x => DEGREE_OF[x.label] === 5 && x.label !== '♭5' && x.label !== '♯5');
  const third = tones.find(x => DEGREE_OF[x.label] === 3);
  const minStr = Math.min(minStrings, t.tones.length >= 3 ? minStrings : 2, typeId === '5' ? 2 : minStrings);
  const found = new Map();
  for (let base = 0; base <= maxFret - 2; base++) {
    const opts = tuning.map(open => {
      const o = [null];
      for (let f = Math.max(1, base); f <= base + 3; f++) if (pcSet.has(mod12(open + f))) o.push(f);
      if (base <= 5 && pcSet.has(mod12(open))) o.push(0);
      return o;
    });
    const cur = [];
    const walk = i => {
      if (i === 6) { evaluate(cur.slice()); return; }
      for (const f of opts[i]) { cur.push(f); walk(i + 1); cur.pop(); }
    };
    const evaluate = frets => {
      const played = frets.map((f, i) => (f == null ? -1 : i)).filter(i => i >= 0);
      if (played.length < minStr) return;
      const first = played[0], last = played[played.length - 1];
      const interior = frets.slice(first, last + 1).filter(f => f == null).length;
      if (interior > 1) return;
      const trailing = 5 - last;
      if (trailing > (typeId === '5' ? 4 : 2)) return;
      const ms = midisOf(frets, tuning);
      if (mod12(ms[first]) !== bassTone.pc) return;
      const pcsHere = new Set(ms.filter(m => m != null).map(mod12));
      if (!reqPcs.every(p => pcsHere.has(p))) return;
      if (typeId === '5' && played.length > 3) return;
      const info = voicingInfo(frets);
      if (info.fingersNeeded > 4 || info.span > 3) return;
      // An open string can't sit inside a barre, and open strings with a high position are rarely practical
      if (info.barre && frets.slice(info.barre.from, info.barre.to + 1).some(f => f === 0)) return;
      const opens = frets.filter(f => f === 0).length;
      if (opens && info.minF > 5) return;
      let score = played.length * 0.55 - info.span * 0.35 - info.minF * 0.03 - interior * 1.6 - (typeId === '5' ? 0 : trailing * 0.45);
      const sm = shapeMatch(frets, typeId);
      score += sm === 2 ? 2.2 : sm === 1 ? 1.2 : 0;
      // Open strings sandwiched between fretted notes high up the neck are awkward
      const interiorOpens = frets.filter((f, i) => f === 0 && i > first && frets.slice(0, i).some(x => x > 0) && frets.slice(i + 1).some(x => x > 0)).length;
      if (interiorOpens && info.maxF >= 4) score -= 0.7 * interiorOpens;
      if (fifth && pcsHere.has(fifth.pc)) score += 0.4;
      if (ms.filter(m => m != null && mod12(m) === r.pc).length >= 2) score += 0.3;
      if (third && ms.filter(m => m != null && mod12(m) === third.pc).length >= 2) score -= 0.3;
      if (info.fingersNeeded === 4) score -= 0.25;
      if (opens && info.minF > 3) score -= 0.6 * opens;
      if (info.barre && info.barre.to - info.barre.from >= 4) score += 0.2; // full barre shapes are standard
      // Bass note should be the lowest pitch
      if (ms.some(m => m != null && m < ms[first])) return;
      const key = frets.map(f => (f == null ? 'x' : f)).join('-');
      if (!found.has(key) || found.get(key).score < score) found.set(key, { frets, score, shape: sm, ...info });
    };
    walk(0);
  }
  const all = [...found.values()].sort((a, b) => b.score - a.score);
  // Variety: best voicing per neck region (positions at least 2 frets apart)
  const picked = [];
  for (const v of all) {
    const pos = v.minF || 0;
    const near = picked.filter(p => Math.abs((p.minF || 0) - pos) < 2);
    // one voicing per neck region, plus a second standard shape there if it is a different form
    if (near.length && !(v.shape === 2 && near.length < 2 && near.every(p => p.shape === 2 ? p.frets.join() !== v.frets.join() : true) && near.every(p => p.shape !== 2 || Math.abs(p.frets.findIndex(f => f != null) - v.frets.findIndex(f => f != null)) >= 1))) continue;
    picked.push(v);
    if (picked.length >= limit) break;
  }
  return picked.sort((a, b) => (a.minF || 0) - (b.minF || 0)).map(v => decorate(v, r, typeId, tuning));
}

function decorate(v, r, typeId, tuning = STD_LOW) {
  const tones = chordTones(r, typeId);
  const labels = v.frets.map((f, i) => { if (f == null) return null; const pc = mod12(tuning[i] + f); const t = tones.find(x => x.pc === pc); return t ? t.label : LABEL_FOR_SEMIS[mod12(pc - r.pc)]; });
  const names = v.frets.map((f, i) => { if (f == null) return null; const pc = mod12(tuning[i] + f); const t = tones.find(x => x.pc === pc); return t ? t.name : pcName(pc); });
  const info = v.minF != null && v.fingers ? v : { ...v, ...voicingInfo(v.frets) };
  const played = v.frets.findIndex(f => f != null);
  const bassLabel = labels[played];
  const inv = bassLabel === 'R' ? 0 : DEGREE_OF[bassLabel] === 3 ? 1 : DEGREE_OF[bassLabel] === 5 ? 2 : DEGREE_OF[bassLabel] === 7 ? 3 : 4;
  return { frets: v.frets, labels, names, fingers: info.fingers, minF: info.minF, maxF: info.maxF, span: info.span, barre: info.barre, inversion: inv, name: chordName(r, typeId, inv ? mod12(tuning[played] + v.frets[played]) : null), kind: v.kind || 'full', set: v.set || null };
}

/** String sets (indices low→high) for each voicing family. */
export const STRING_SETS = {
  triad: [[3, 4, 5], [2, 3, 4], [1, 2, 3], [0, 1, 2]],
  drop2: [[2, 3, 4, 5], [1, 2, 3, 4], [0, 1, 2, 3]],
  drop3: [[0, 2, 3, 4], [1, 3, 4, 5]],
  shell: [[0, 2, 3], [1, 2, 3]]
};
export const setLabel = set => set.map(i => 6 - i).sort((a, b) => a - b).join('-').replace(/^(\d)-.*-(\d)$/, (m, a, b) => `${a}–${b}`);
const stringNumbers = set => set.map(i => 6 - i).sort((a, b) => a - b);
export const setName = set => { const n = stringNumbers(set); return n.length === 3 && n[2] - n[0] === 2 ? `strings ${n[0]}–${n[2]}` : `strings ${n.join('-')}`; };

/** The 3–4 tones used for inversion voicings of a chord type. */
export function coreTones(typeId) {
  const t = TYPE_BY_ID[typeId];
  if (t.tones.length <= 4) return t.tones.map(x => x.label);
  const req = t.req.slice(0, 4);
  return req.length === 4 ? req : [...req, ...t.tones.map(x => x.label).filter(l => !req.includes(l))].slice(0, 4);
}

/** Close-position orders (low→high) for each inversion of the core tones, sorted by pitch. */
function closeOrders(typeId) {
  const t = TYPE_BY_ID[typeId];
  const core = coreTones(typeId).map(l => t.tones.find(x => x.label === l)).sort((a, b) => mod12(a.semis) - mod12(b.semis));
  const out = [];
  for (let k = 0; k < core.length; k++) out.push([...core.slice(k), ...core.slice(0, k)].map(x => x.label));
  return out;
}

/**
 * Inversion voicings on string sets.
 * family: 'triad' (3 tones, close), 'drop2', 'drop3', 'shell' (R-3-7 / R-7-3).
 * Returns voicings with .inversion, .set, .kind, across the neck (frets 0–maxFret).
 */
export function inversionVoicings(root, typeId, family = 'auto', { maxFret = 17, set = null, tuning = STD_LOW } = {}) {
  const r = typeof root === 'number' ? ROOT_BY_PC[mod12(root)] : root;
  const t = TYPE_BY_ID[typeId]; if (!t) return [];
  const n = coreTones(typeId).length;
  if (family === 'auto') family = n === 3 ? 'triad' : n === 2 ? 'none' : 'drop2';
  if (family === 'none') return [];
  const tones = chordTones(r, typeId);
  const pcOf = label => tones.find(x => x.label === label).pc;
  let orders;
  if (family === 'triad') { if (n !== 3) return []; orders = closeOrders(typeId); }
  else if (family === 'drop2' || family === 'drop3') {
    if (n !== 4) return [];
    orders = closeOrders(typeId).map(c => (family === 'drop2' ? [c[2], c[0], c[1], c[3]] : [c[1], c[0], c[2], c[3]]));
  } else if (family === 'shell') {
    const third = t.tones.find(x => DEGREE_OF[x.label] === 3 || x.label === '4');
    const sev = t.tones.find(x => DEGREE_OF[x.label] === 7) || t.tones.find(x => x.label === '6');
    if (!third || !sev) return [];
    orders = [['R', sev.label, third.label], ['R', third.label, sev.label]];
  }
  const sets = set ? [set] : STRING_SETS[family];
  const out = [], seen = new Set();
  for (const S of sets) {
    if (S.length !== orders[0].length) continue;
    // Shells: root on string 6 → R-7-3 (6-4-3), root on string 5 → R-3-7 (5-4-3)
    const useOrders = family === 'shell' ? [S[0] === 0 ? orders[0] : orders[1]] : orders;
    for (const order of useOrders) {
      for (let lowFret = 0; lowFret <= maxFret; lowFret++) {
        const open0 = tuning[S[0]];
        if (mod12(open0 + lowFret) !== pcOf(order[0])) continue;
        const frets = Array(6).fill(null); frets[S[0]] = lowFret;
        let prev = open0 + lowFret, ok = true;
        for (let k = 1; k < S.length; k++) {
          const open = tuning[S[k]], pc = pcOf(order[k]);
          let m = prev + 1; while (mod12(m) !== pc) m++;
          const f = m - open;
          if (f < 0 || f > maxFret + 4) { ok = false; break; }
          frets[S[k]] = f; prev = m;
        }
        if (!ok) continue;
        const info = voicingInfo(frets);
        const span = info.span + (frets.some(f => f === 0) && info.maxF > 4 ? 9 : 0);
        if (span > (family === 'drop3' ? 4 : 4) || info.fingersNeeded > 4) continue;
        const key = frets.join(',');
        if (seen.has(key)) continue; seen.add(key);
        out.push(decorate({ frets, kind: family, set: S }, r, typeId, tuning));
      }
    }
  }
  return out.sort((a, b) => a.minF - b.minF || a.inversion - b.inversion);
}

/** The voicing in `cands` closest (smallest total finger movement) to `prev` (or to a fret position). */
export function nearestVoicing(cands, prev, targetFret = 5) {
  let best = null, bd = Infinity;
  for (const v of cands) {
    let d;
    if (prev) { d = 0; for (let i = 0; i < 6; i++) { const a = prev.frets[i], b = v.frets[i]; if (a == null && b == null) continue; if (a == null || b == null) { d += 3; continue; } d += Math.abs(a - b); } }
    else d = Math.abs((v.minF || 0) + v.span / 2 - targetFret) * 2;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

/** Voice-lead a progression of chord names on one string set family (smooth inversions). */
export function voiceLead(chordNames, { family = 'drop2', set = null, startFret = 5 } = {}) {
  let prev = null;
  return chordNames.map(nm => {
    const c = typeof nm === 'string' ? parseChord(nm) : nm;
    if (!c) return null;
    let fam = family;
    if (fam === 'drop2' && coreTones(c.type).length === 3) fam = 'triad';
    if (fam === 'triad' && coreTones(c.type).length === 4) fam = 'drop2';
    let sets = set;
    if (sets && sets.length !== (fam === 'triad' || fam === 'shell' ? 3 : 4)) sets = null;
    const cands = inversionVoicings(c.root, c.type, fam, { set: sets, maxFret: 14 });
    const v = nearestVoicing(cands.length ? cands : findVoicings(c.root, c.type), prev, startFret);
    prev = v;
    return v ? { ...v, chord: c.name } : null;
  }).filter(Boolean);
}

/** Labels (intervals), note names and fingering for a given fret array played as `name`. */
export function describeVoicing(frets, name) {
  const c = typeof name === 'string' ? parseChord(name) : name;
  if (!c || !frets) return null;
  const tones = chordTones(c.root, c.type);
  const pcAt = i => mod12(STD_LOW[i] + frets[i]);
  const labels = frets.map((f, i) => (f == null ? null : (tones.find(t => t.pc === pcAt(i)) || { label: LABEL_FOR_SEMIS[mod12(pcAt(i) - c.root.pc)] }).label));
  const names = frets.map((f, i) => (f == null ? null : (tones.find(t => t.pc === pcAt(i)) || { name: pcName(pcAt(i)) }).name));
  const info = voicingInfo(frets);
  return { name: c.name, frets, labels, names, fingers: info.fingers, minF: info.minF, maxF: info.maxF, span: info.span, barre: info.barre };
}

/** Common open-position shapes, used first when a chord needs a default voicing. */
export const OPEN_SHAPES = {
  C: 'x32010', A: 'x02220', G: '320003', E: '022100', D: 'xx0232', F: '133211', B: 'x24442', 'B♭': 'x13331',
  Am: 'x02210', Em: '022000', Dm: 'xx0231', Bm: 'x24432', 'F♯m': '244222', Cm: 'x35543', Gm: '355333', Fm: '133111',
  A7: 'x02020', E7: '020100', D7: 'xx0212', G7: '320001', C7: 'x32310', B7: 'x21202', F7: '131211',
  Am7: 'x02010', Em7: '020000', Dm7: 'xx0211', Bm7: 'x20202', 'F♯m7': '242222',
  Cmaj7: 'x32000', Fmaj7: 'xx3210', Amaj7: 'x02120', Dmaj7: 'xx0222', Gmaj7: '3x443x', Emaj7: '021100',
  Asus2: 'x02200', Asus4: 'x02230', Dsus2: 'xx0230', Dsus4: 'xx0233', Esus4: '022200', Cadd9: 'x32030', Gsus4: '330013',
  E5: '022xxx', A5: 'x022xx', D5: 'xx023x', G5: '355xxx', C5: 'x355xx', F5: '133xxx', B5: 'x244xx',
  Am9: 'x02413', Em9: '022032', E9: '020102', A9: 'x02423', D9: 'x5455x', Dm9: 'x5355x', C9: 'x3233x', Bm7b5: 'x2323x'
};
const voicingCache = new Map();
export function defaultVoicing(name) {
  if (voicingCache.has(name)) return voicingCache.get(name);
  const c = parseChord(name);
  let v = null;
  const open = c && (OPEN_SHAPES[c.name] || OPEN_SHAPES[c.name.replace('♭5', 'b5')]);
  if (open && !c.bass) { v = describeVoicing(stringToFrets(open), c); voicingCache.set(name, v); return v; }
  if (c) {
    const bassLabel = c.bass ? (chordTones(c.root, c.type).find(x => x.pc === c.bass.pc) || {}).label : 'R';
    const list = findVoicings(c.root, c.type, { bassLabel: bassLabel || 'R', limit: 6 });
    v = list.sort((a, b) => (a.minF || 0) - (b.minF || 0))[0] || null;
    if (v) v = { ...v, name: c.name };
  }
  voicingCache.set(name, v);
  return v;
}

/** MIDI notes for a chord name (for backing loops and sound). */
export function chordMidi(name) {
  const v = defaultVoicing(name);
  return v ? v.frets.map((f, i) => (f == null ? null : STD_LOW[i] + f)).filter(m => m != null) : null;
}

/** Convert a voicing to tab notes ({t,d,s,f,chord}) at beat t. */
export function voicingNotes(v, t = 0, d = 2) {
  return v.frets.map((f, i) => (f == null ? null : { t, d, s: 6 - i, f, chord: true })).filter(Boolean);
}
/** "x32010" ↔ fret array. */
export const fretsToString = frets => frets.map(f => (f == null ? 'x' : f > 9 ? `(${f})` : f)).join('');
export function stringToFrets(s) {
  const out = []; const str = String(s || '').trim();
  if (/[-,\s]/.test(str)) str.split(/[-,\s]+/).forEach(x => out.push(/^\d+$/.test(x) ? +x : null));
  else for (let i = 0; i < str.length; i++) { const ch = str[i]; if (ch === '(') { const j = str.indexOf(')', i); out.push(+str.slice(i + 1, j)); i = j; } else out.push(/\d/.test(ch) ? +ch : null); }
  return out.length === 6 ? out : null;
}

/* -------------------------------- Scales -------------------------------- */
const S = (id, name, steps, labels) => ({ id, name, steps, labels });
export const SCALES = [
  S('major', 'Major (Ionian)', [0, 2, 4, 5, 7, 9, 11], ['R', '2', '3', '4', '5', '6', '7']),
  S('minor', 'Natural minor (Aeolian)', [0, 2, 3, 5, 7, 8, 10], ['R', '2', '♭3', '4', '5', '♭6', '♭7']),
  S('dorian', 'Dorian', [0, 2, 3, 5, 7, 9, 10], ['R', '2', '♭3', '4', '5', '6', '♭7']),
  S('phrygian', 'Phrygian', [0, 1, 3, 5, 7, 8, 10], ['R', '♭2', '♭3', '4', '5', '♭6', '♭7']),
  S('lydian', 'Lydian', [0, 2, 4, 6, 7, 9, 11], ['R', '2', '3', '♯4', '5', '6', '7']),
  S('mixolydian', 'Mixolydian', [0, 2, 4, 5, 7, 9, 10], ['R', '2', '3', '4', '5', '6', '♭7']),
  S('locrian', 'Locrian', [0, 1, 3, 5, 6, 8, 10], ['R', '♭2', '♭3', '4', '♭5', '♭6', '♭7']),
  S('harmonicMinor', 'Harmonic minor', [0, 2, 3, 5, 7, 8, 11], ['R', '2', '♭3', '4', '5', '♭6', '7']),
  S('melodicMinor', 'Melodic minor', [0, 2, 3, 5, 7, 9, 11], ['R', '2', '♭3', '4', '5', '6', '7']),
  S('phrygianDominant', 'Phrygian dominant', [0, 1, 4, 5, 7, 8, 10], ['R', '♭2', '3', '4', '5', '♭6', '♭7']),
  S('minorPent', 'Minor pentatonic', [0, 3, 5, 7, 10], ['R', '♭3', '4', '5', '♭7']),
  S('majorPent', 'Major pentatonic', [0, 2, 4, 7, 9], ['R', '2', '3', '5', '6']),
  S('blues', 'Blues scale', [0, 3, 5, 6, 7, 10], ['R', '♭3', '4', '♭5', '5', '♭7']),
  S('majorBlues', 'Major blues', [0, 2, 3, 4, 7, 9], ['R', '2', '♭3', '3', '5', '6'])
];
export const SCALE_BY_ID = Object.fromEntries(SCALES.map(s => [s.id, s]));

/** Scale notes inside a fret window (a "box"), ordered low string → high, ascending. */
export function scaleBox(rootPc, scaleId, startFret, { span = 3, tuning = STD_LOW } = {}) {
  const sc = SCALE_BY_ID[scaleId]; const pcs = sc.steps.map(x => mod12(rootPc + x));
  const notes = [];
  for (let i = 0; i < 6; i++) {
    let here = [];
    for (let f = startFret; f <= startFret + span; f++) if (f >= 0 && pcs.includes(mod12(tuning[i] + f))) here.push(f);
    if (here.length < 2) for (let f = startFret + span + 1; f <= startFret + span + 1 && here.length < 2; f++) if (pcs.includes(mod12(tuning[i] + f))) here.push(f);
    here.forEach(f => notes.push({ s: 6 - i, f, midi: tuning[i] + f, label: sc.labels[pcs.indexOf(mod12(tuning[i] + f))] }));
  }
  // remove duplicate pitches across strings (keep the lower string's note)
  const seen = new Set();
  return notes.filter(n => { if (seen.has(n.midi)) return false; seen.add(n.midi); return true; });
}

/** N-notes-per-string pattern (2 = pentatonic boxes, 3 = 3nps) starting on string 6 at or above `startFret`. */
export function scaleNps(rootPc, scaleId, startFret, nps = 3, { tuning = STD_LOW } = {}) {
  const sc = SCALE_BY_ID[scaleId]; const pcs = sc.steps.map(x => mod12(rootPc + x));
  let m = tuning[0] + Math.max(0, startFret); while (!pcs.includes(mod12(m))) m++;
  const seq = []; while (seq.length < nps * 6) { if (pcs.includes(mod12(m))) seq.push(m); m++; }
  const notes = [];
  for (let k = 0; k < 6; k++) for (let j = 0; j < nps; j++) {
    const midi = seq[k * nps + j], f = midi - tuning[k];
    if (f < 0 || f > 22) return null;
    notes.push({ s: 6 - k, f, midi, label: sc.labels[pcs.indexOf(mod12(midi))] });
  }
  return notes;
}
export const scale3nps = (rootPc, scaleId, startFret, opts) => scaleNps(rootPc, scaleId, startFret, 3, opts);

/** Diatonic chords of a major or minor key: [{degree, roman, name, root, type}] */
export function diatonicChords(keyRoot, mode = 'major', sevenths = false) {
  const steps = mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const triadTypes = mode === 'minor' ? ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'] : ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
  const sevTypes = mode === 'minor' ? ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'] : ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'];
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const r0 = typeof keyRoot === 'number' ? ROOT_BY_PC[mod12(keyRoot)] : keyRoot;
  return steps.map((st, i) => {
    const type = sevenths ? sevTypes[i] : triadTypes[i];
    const li = (r0.letter + i) % 7; let acc = mod12(r0.pc + st) - LETTER_PC[li]; if (acc > 6) acc -= 12; if (acc < -6) acc += 12;
    const root = { name: LETTERS[li] + ACC[acc], letter: li, acc, pc: mod12(r0.pc + st) };
    const minor = /^m|dim/.test(type) && type !== 'maj7';
    let roman = minor ? romans[i].toLowerCase() : romans[i];
    if (type === 'dim') roman += '°'; if (type === 'm7b5') roman += 'ø7'; else if (sevenths) roman += type === 'maj7' ? 'maj7' : '7';
    return { degree: i + 1, roman, root, type, name: chordName(root, type) };
  });
}
