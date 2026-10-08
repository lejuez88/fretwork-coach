// Exercise parameters: nothing is stuck in one key, on one string or on one set
// of chords. For any exercise this works out which settings apply (key or
// note, start fret, string or string set, chord progression, chord type),
// lists every option, and rebuilds the exercise with the chosen ones:
// generated exercises are re-run with the new settings, written tabs are
// transposed or moved to other strings keeping the same notes, and chord
// parts are transposed.
import { runAtom, progressionNames } from './styles.js';
import { normalizeExercise } from './coursegen.js';
import { chordName, parseChord, mod12, ROOT_BY_PC, TYPE_BY_ID, STRING_SETS, setName } from './theory.js';
import { stringNotesDrill } from './drills.js';
import { reapplyTransform } from './variations.js';

const OPEN = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
const clone = o => JSON.parse(JSON.stringify(o));
const keyLabel = pc => ROOT_BY_PC[mod12(pc)].name;
const KEYS = Array.from({ length: 12 }, (_, pc) => pc);

// Progressions offered for chord exercises: [id, label]
export const PROG_CHOICES = [
  ['axis', 'I–V–vi–IV'], ['folk145', 'I–IV–V'], ['folkAxis', 'I–vi–IV–V'], ['capo', 'I–vi–iii–IV'], ['country', 'I–IV–I–V'], ['mixo', 'I–♭VII–IV'], ['sus', 'sus colors on I'],
  ['minorRock', 'i–♭VI–♭VII'], ['progMinor', 'i–♭VI–♭III–♭VII'], ['andalusian', 'Andalusian i–♭VII–♭VI–V'], ['classical', 'i–iv–V–i'], ['power145', 'I–IV–V power chords'], ['powerMinor', 'i–♭VI–♭VII power chords'], ['popPunk', 'I–V–vi–IV power chords'],
  ['blues', '12-bar blues (I7–IV7–V7)'], ['blues9', 'Blues with 9ths'], ['slowBlues', 'Slow blues'], ['dorianVamp', 'Dorian vamp i7–IV9'], ['funk9', 'Funk 9ths I9–IV9'], ['latinRock', 'Latin rock i7–IV9'],
  ['iiVI', 'ii–V–I'], ['iiVIminor', 'minor ii–V–i'], ['royal', 'IVmaj7–V7–iii7–vi7'], ['neo', 'IVmaj7–iii7–ii7–Imaj7'], ['indie', 'IVadd9–vi7–I–Vsus4']
];
const PROG_LABEL = Object.fromEntries(PROG_CHOICES);
const QUALITY_CHOICES = ['maj', 'min', '7', 'maj7', 'm7', 'm7b5', 'dim', 'dim7', 'aug', 'sus2', 'sus4', '6', 'm6', '9', 'm9', 'add9', '13'].filter(t => TYPE_BY_ID[t]);
const FUNK_QUALITIES = ['9', '7', 'm7', 'm9', '13', 'maj7'].filter(t => TYPE_BY_ID[t]);
const typeName = t => (TYPE_BY_ID[t] ? TYPE_BY_ID[t].name : t);

// Which settings each generated exercise has
const NO_KEY = new Set(['subdivisionLadder']);
const ROOT_OPT = new Set(['qualityCycle', 'inversionCycle', 'shapesAcrossNeck', 'arpeggioBox']);
const TYPE_OPT = new Set(['inversionCycle', 'shapesAcrossNeck', 'arpeggioBox']);
const CHORDS_OPT = new Set(['strumPattern', 'chordChanges', 'boomChicka', 'travisPattern', 'pimaArpeggio', 'rasgueado', 'triadProgression', 'drop2Comp', 'shellComp', 'guideTones', 'embellish', 'openDrone', 'callResponse', 'targetSolo', 'earKey', 'echoPhrases', 'gapClick']);
const SET_OPT = { triadProgression: 'triad', drop2Comp: 'drop2', qualityCycle: null, inversionCycle: null };
const CHROMATIC_FAMILIES = new Set(['spider', 'trill']);

/* ------------------------------ Tab helpers ------------------------------ */
const notesOf = ex => (ex && ex.tab && Array.isArray(ex.tab.notes) ? ex.tab.notes : []);
const stringsUsed = notes => [...new Set(notes.map(n => n.s))].sort((a, b) => a - b);
/** Move a tab to strings shifted by `delta` (positive = toward the low E), keeping the same notes (or an octave). */
export function moveStrings(notes, delta) {
  if (!delta) return notes;
  const raw = notes.map(n => { const s = n.s + delta; return s < 1 || s > 6 ? null : { ...n, s, f: OPEN[n.s] + n.f - OPEN[s], bend: n.bendTo != null ? OPEN[n.s] + n.bendTo - OPEN[s] : null }; });
  if (raw.some(x => !x)) return null;
  for (const k of [0, 12, -12, 24, -24]) {
    const fs = raw.map(x => x.f + k);
    if (fs.every(f => f >= 0 && f <= 19)) return raw.map((x, i) => { const { bend, ...n } = x; return { ...n, f: fs[i], ...(bend != null ? { bendTo: bend + k } : {}) }; });
  }
  return null;
}
/** Transpose a tab by semitones, choosing the octave that stays closest to the original position. */
export function transposeTab(notes, semis) {
  if (!semis) return notes;
  const lo = Math.min(...notes.map(n => n.f)), hi = Math.max(...notes.map(n => n.f));
  const fits = d => lo + d >= 0 && hi + d <= 19;
  const options = [semis, semis - 12, semis + 12].filter(fits).sort((a, b) => Math.abs(a) - Math.abs(b));
  if (!options.length) return null;
  const d = options[0];
  return notes.map(n => ({ ...n, f: n.f + d, ...(n.bendTo != null ? { bendTo: n.bendTo + d } : {}) }));
}
export function transposeChordList(list, semis) {
  if (!semis) return list;
  const out = list.map(nm => { const c = parseChord(nm); return c ? chordName(mod12(c.root.pc + semis), c.type) : null; });
  return out.every(Boolean) ? out : null;
}
const STRING_WORD = { 1: 'high e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'low E' };
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
/** One-string note drills (the original, or a variation that stays on one string). */
const isOneStringDrill = ex => (/^(lib-string-notes|drill-notes-s\d)/.test(ex.id) || /^Notes on the /.test(ex.name)) && stringsUsed(notesOf(ex)).length <= 1;
/**
 * Move a one-string drill to another string. Natural-note drills keep their
 * shape: the 3rd natural note on the old string becomes the 3rd on the new one.
 * Anything else keeps its note names.
 */
function toOtherString(notes, to) {
  const from = notes[0].s; if (from === to) return notes;
  const nat = s => { const out = []; for (let f = 0; f <= 24; f++) if (NATURAL.includes(mod12(OPEN[s] + f))) out.push(f); return out; };
  const a = nat(from), b = nat(to);
  if (notes.every(n => a.includes(n.f))) return notes.map(n => ({ ...n, s: to, f: b[a.indexOf(n.f)] }));
  return notes.map(n => { let f = mod12(OPEN[from] + n.f - OPEN[to]); while (f + 12 <= n.f + 6) f += 12; return { ...n, s: to, f }; });
}
const stringLabel = list => (list.length === 1 ? `String ${list[0]}` : list.length === 2 ? `Strings ${list[1]} & ${list[0]}` : `Strings ${list[list.length - 1]}–${list[0]}`);

/* ------------------------------- Dimensions ------------------------------- */
/** The key of an exercise, if it has one. */
function keyOf(ex) {
  if (ex.gen && ex.gen.c) { const o = ex.gen.opts || {}; return ex.gen.atom === 'noteFinder' && o.pc != null ? o.pc : o.root != null ? o.root : ex.gen.c.key; }
  if (ex.keyPc != null) return ex.keyPc;
  const first = (ex.chords || [])[0] || (ex.backing || [])[0];
  const c = first ? parseChord(first) : null;
  return c ? c.root.pc : null;
}

/**
 * Settings that apply to this exercise:
 * [{id, label, options:[{v, label}], value}] where value is the exercise's own setting.
 */
export function paramDims(ex) {
  if (!ex) return [];
  const dims = [], g = ex.gen && ex.gen.atom ? ex.gen : null, o = g ? g.opts || {} : {};
  const notes = notesOf(ex), used = stringsUsed(notes);
  const k = keyOf(ex);
  // String-specific drills: notes on one string (variations that roam the whole neck get a note picker below)
  if (isOneStringDrill(ex)) {
    const cur = (used[0] || 5);
    dims.push({ id: 'string', label: 'String', value: cur, options: [6, 5, 4, 3, 2, 1].map(s => ({ v: s, label: `${s} (${['', 'high e', 'B', 'G', 'D', 'A', 'low E'][s]})` })) });
    return dims;
  }
  // Key / note
  const hasPitch = notes.length || (ex.chords || []).length || (ex.backing || []).length || g;
  const fam = ex.family || '';
  if (CHROMATIC_FAMILIES.has(fam) && notes.length) {
    // chromatic drills have no key; they can start on any fret
    const lo = Math.min(...notes.map(n => n.f)), hi = Math.max(...notes.map(n => n.f));
    const opts = []; for (let d = -lo; d + hi <= 17; d++) opts.push({ v: d, label: `Frets ${lo + d}–${hi + d}${d === 0 ? ' (as written)' : ''}` });
    if (opts.length > 1) dims.push({ id: 'shift', label: 'Start fret', value: 0, options: opts });
  } else if (hasPitch && !(g && NO_KEY.has(g.atom))) {
    if (k != null) dims.push({ id: 'key', label: g && g.atom === 'noteFinder' ? 'Note' : 'Key', value: mod12(k), options: KEYS.map(pc => ({ v: pc, label: keyLabel(pc) + (g && g.c.minor && !ROOT_OPT.has(g.atom) && g.atom !== 'noteFinder' ? ' minor' : '') })) });
    else if (notes.length) dims.push({ id: 'shift', label: 'Position', value: 0, options: KEYS.map(d => ({ v: d, label: d ? `Up ${d} fret${d > 1 ? 's' : ''}` : 'As written' })) });
  }
  // Chord type
  if (g && (TYPE_OPT.has(g.atom) || g.atom === 'funkScratch')) {
    const cur = g.atom === 'funkScratch' ? ((parseChord(o.chord || '') || {}).type || '9') : (o.type || 'maj7');
    const list = g.atom === 'funkScratch' ? FUNK_QUALITIES : QUALITY_CHOICES;
    dims.push({ id: 'quality', label: 'Chord type', value: cur, options: (list.includes(cur) ? list : [cur, ...list]).map(t => ({ v: t, label: typeName(t) })) });
  }
  // Progression
  if (g && CHORDS_OPT.has(g.atom) && o.chords != null) {
    const cur = typeof o.chords === 'string' && o.chords.startsWith('$') ? (o.chords === '$prog' ? g.c.prog || 'axis' : o.chords.slice(1)) : 'asis';
    const kk = k != null ? k : g.c.key;
    const opts = [...(cur === 'asis' ? [{ v: 'asis', label: `As written (${(Array.isArray(o.chords) ? o.chords : []).join(' – ')})` }] : []),
      ...PROG_CHOICES.map(([id, label]) => ({ v: id, label: `${label}: ${progressionNames(kk, id).join(' ')}` }))];
    dims.push({ id: 'chords', label: 'Chords', value: cur, options: opts });
  } else if (!g && !notes.length && (ex.chords || []).length >= 2 && k != null) {
    dims.push({ id: 'chords', label: 'Chords', value: 'asis', options: [{ v: 'asis', label: `As written (${ex.chords.join(' – ')})` }, ...PROG_CHOICES.map(([id, label]) => ({ v: id, label: `${label}: ${progressionNames(k, id).join(' ')}` }))] });
  }
  // Strings
  if (g && g.atom in SET_OPT) {
    const famKey = SET_OPT[g.atom] || (o.family && STRING_SETS[o.family] ? o.family : (TYPE_BY_ID[o.type || 'maj7'] && TYPE_BY_ID[o.type || 'maj7'].tones.length === 3 ? 'triad' : 'drop2'));
    const sets = STRING_SETS[famKey] || STRING_SETS.drop2;
    // the atoms' own defaults when no set was given
    const def = g.atom === 'qualityCycle' ? [1, 2, 3, 4] : g.atom === 'drop2Comp' ? [1, 2, 3, 4] : g.atom === 'triadProgression' ? [3, 4, 5] : famKey === 'triad' ? [3, 4, 5] : famKey === 'drop3' ? [0, 2, 3, 4] : [2, 3, 4, 5];
    const cur = (o.set || def).join(',');
    dims.push({ id: 'set', label: 'Strings', value: cur, options: sets.map(st => ({ v: st.join(','), label: cap(setName(st)) })) });
  } else if (notes.length && used.length <= 3 && !(g && ['scaleRun', 'legatoRun', 'connectPositions', 'sweepArp'].includes(g.atom))) {
    const opts = [];
    for (let d = -5; d <= 5; d++) { const moved = d === 0 ? notes : moveStrings(notes, d); if (moved) opts.push({ v: d, label: stringLabel(stringsUsed(moved)) + (d === 0 ? ' (as written)' : '') }); }
    if (opts.length > 1) dims.push({ id: 'strings', label: 'Strings', value: 0, options: opts.sort((a, b) => b.v - a.v) });
  }
  return dims;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------ Resolution ------------------------------ */
/** Turn stored choices (which may say 'random') into concrete values. rnd() → [0,1). */
export function resolveParams(params = {}, dims) {
  const out = {};
  for (const d of dims) {
    const want = params[d.id];
    if (want == null || want === '' || want === 'random' || String(want) === String(d.value)) continue;
    if (d.options.some(x => String(x.v) === String(want))) out[d.id] = d.options.find(x => String(x.v) === String(want)).v;
  }
  return out;
}
export const describeParams = (dims, resolved) => dims.filter(d => resolved[d.id] != null).map(d => { const o = d.options.find(x => String(x.v) === String(resolved[d.id])); return o ? `${d.label}: ${o.label.split(':')[0]}` : ''; }).filter(Boolean).join(' · ');

/** Rebuild an exercise with concrete settings. Returns the original when nothing changes or a setting can't apply. */
export function withParams(ex, vals = {}) {
  if (!ex || !Object.keys(vals).length) return ex;
  const g = ex.gen && ex.gen.atom ? ex.gen : null;
  // notes on one string: the same drill (and the same variation) on another string
  if (vals.string != null && isOneStringDrill(ex)) {
    const to = +vals.string, notes = notesOf(ex);
    if (!notes.length) { const out = normalizeExercise(stringNotesDrill(to, ex.level || 3)); return out ? { ...out, id: ex.id, level: ex.level, varLabel: ex.varLabel, family: ex.family } : ex; }
    const moved = toOtherString(notes, to); if (!moved) return ex;
    const nm = STRING_WORD[to];
    return { ...clone(ex), tab: { ...ex.tab, notes: moved }, name: /Notes on the .+? string/.test(ex.name) ? ex.name.replace(/Notes on the .+? string/, `Notes on the ${nm} string`) : `${ex.name} (${nm} string)` };
  }
  let out = null;
  if (g) {
    const c = { ...g.c }, o = clone(g.opts || {});
    const oldKey = keyOf(ex);
    if (vals.key != null) {
      const nk = +vals.key;
      if (g.atom === 'noteFinder') o.pc = nk;
      else {
        const shift = oldKey != null ? nk - mod12(oldKey) : nk - c.key;
        if (ROOT_OPT.has(g.atom)) o.root = nk; else c.key = mod12(c.key + shift);
        if (Array.isArray(o.chords)) o.chords = transposeChordList(o.chords, shift) || o.chords;
        if (typeof o.chord === 'string') { const pc = parseChord(o.chord); if (pc) o.chord = chordName(mod12(pc.root.pc + shift), pc.type); }
      }
    }
    if (vals.quality != null) {
      if (g.atom === 'funkScratch') { const pc = parseChord(o.chord || '') || { root: { pc: c.key } }; o.chord = chordName(pc.root.pc, vals.quality); }
      else { o.type = vals.quality; if (g.atom === 'inversionCycle') { o.family = null; o.set = null; } }
    }
    if (vals.chords != null && vals.chords !== 'asis') o.chords = '$' + vals.chords;
    if (vals.set != null) o.set = String(vals.set).split(',').map(Number);
    const raw = runAtom(c, g.atom, o);
    if (raw) { out = normalizeExercise(raw); if (out) out.gen = { atom: g.atom, opts: o, c }; }
    if (!out) return ex;
    // a general variation (reversed, half-time, looped…) is re-applied to the rebuilt exercise
    if (ex.xform) { const re = reapplyTransform(ex.xform, out); if (re) out = { ...re, gen: out.gen }; }
  } else {
    out = clone(ex);
    const oldKey = keyOf(ex);
    let semis = 0;
    if (vals.key != null && oldKey != null) semis = mod12(+vals.key - oldKey);
    if (vals.shift != null) semis = +vals.shift;
    if (semis) {
      const exact = vals.shift != null;
      if (notesOf(out).length) {
        const t = exact ? out.tab.notes.map(n => ({ ...n, f: n.f + semis, ...(n.bendTo != null ? { bendTo: n.bendTo + semis } : {}) })) : transposeTab(out.tab.notes, semis > 6 ? semis - 12 : semis);
        if (!t || t.some(n => n.f < 0 || n.f > 20)) return ex;
        out.tab = { ...out.tab, notes: t }; delete out.libId;
      }
      if ((out.chords || []).length) out.chords = transposeChordList(out.chords, semis) || out.chords;
      if ((out.backing || []).length) out.backing = transposeChordList(out.backing, semis) || out.backing;
      delete out.voicings;
      if (out.keyPc != null) out.keyPc = mod12(out.keyPc + semis);
    }
    if (vals.chords != null && vals.chords !== 'asis') {
      const kk = vals.key != null ? +vals.key : oldKey;
      const names = progressionNames(kk, vals.chords);
      if (!notesOf(out).length) { out.chords = names; out.backing = names; delete out.voicings; }
    }
  }
  // strings for short patterns
  if (vals.strings != null && +vals.strings !== 0 && notesOf(out).length) {
    const moved = moveStrings(out.tab.notes, +vals.strings);
    if (moved) { out.tab = { ...out.tab, notes: moved }; delete out.libId; }
  }
  return { ...out, id: ex.id, level: ex.level, varLabel: ex.varLabel, ...(ex.xform ? { xform: ex.xform } : {}), ...(ex.family ? { family: ex.family } : {}), ...(ex.keyPc != null && out.keyPc == null ? { keyPc: ex.keyPc } : {}) };
}

/** Short summary for list rows: “Any key · any chords · any strings”. */
export function paramSummary(ex) {
  const ids = paramDims(ex).map(d => d.id);
  const bits = [];
  if (ids.includes('key')) bits.push('any key');
  if (ids.includes('shift')) bits.push('any position');
  if (ids.includes('quality')) bits.push('any chord type');
  if (ids.includes('chords')) bits.push('any progression');
  if (ids.includes('string') || ids.includes('strings') || ids.includes('set')) bits.push('any strings');
  return bits.join(' · ');
}
