// The player's guitar: how many strings (6, 7 or 8) and how each string is tuned.
// Saved in the profile's settings (settings.guitar), so it travels with the profile through
// Google Drive. Every tool reads it from here: fretboards, the note finder, scales, chords,
// intervals, the tuner, the note listener and the tab player.
//
// Strings are numbered like tab: 1 = high e … 6 = low E, 7 = low B, 8 = low F♯.
// A tuning is an array of MIDI note numbers with string 1 first (the same order as tab.tuning).
import { Store } from './store.js';

export const STRING_COUNTS = [6, 7, 8];
export const STANDARD = {
  6: [64, 59, 55, 50, 45, 40],
  7: [64, 59, 55, 50, 45, 40, 35],
  8: [64, 59, 55, 50, 45, 40, 35, 30]
};
const shift = (t, d) => t.map(m => m + d);
const drop = (t, d = 2) => t.map((m, i) => (i === t.length - 1 ? m - d : m));

/** Tuning presets per string count: [id, label, notes (string 1 first)]. */
export const PRESETS = {
  6: [
    ['standard', 'Standard', STANDARD[6]],
    ['dropD', 'Drop D', drop(STANDARD[6])],
    ['halfDown', 'Half step down', shift(STANDARD[6], -1)],
    ['wholeDown', 'Full step down', shift(STANDARD[6], -2)],
    ['dropC', 'Drop C', drop(shift(STANDARD[6], -2))],
    ['dadgad', 'DADGAD', [62, 57, 55, 50, 45, 38]],
    ['openG', 'Open G', [62, 59, 55, 50, 43, 38]],
    ['openD', 'Open D', [62, 57, 54, 50, 45, 38]],
    ['openE', 'Open E', [64, 59, 56, 52, 47, 40]]
  ],
  7: [
    ['standard', 'Standard', STANDARD[7]],
    ['dropA', 'Drop A', drop(STANDARD[7])],
    ['halfDown', 'Half step down', shift(STANDARD[7], -1)],
    ['wholeDown', 'Full step down', shift(STANDARD[7], -2)]
  ],
  8: [
    ['standard', 'Standard', STANDARD[8]],
    ['dropE', 'Drop E', drop(STANDARD[8])],
    ['halfDown', 'Half step down', shift(STANDARD[8], -1)],
    ['wholeDown', 'Full step down', shift(STANDARD[8], -2)]
  ]
};
/** The old six-string tuner setting (settings.tuning) → a six-string tuning. */
const OLD_TUNER = { standard: 'standard', dropD: 'dropD', halfDown: 'halfDown', wholeDown: 'wholeDown', dropC: 'dropC', dadgad: 'dadgad', openG: 'openG', openD: 'openD', openE: 'openE' };

const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const pc = m => ((Math.round(m) % 12) + 12) % 12;
/** A tuning reads in flats when it has an E♭ or B♭ string (E♭ standard: E♭ A♭ D♭ G♭ B♭ E♭), otherwise sharps (F♯ B E …, open E's G♯). */
const flatsFor = t => t.some(m => [3, 10].includes(pc(m)));
export const noteOf = (m, flats = false) => (flats ? FLAT : SHARP)[pc(m)];
export const noteWithOctave = (m, flats = false) => noteOf(m, flats) + (Math.floor(Math.round(m) / 12) - 1);

/** Is this a usable tuning for n strings? (whole numbers in a guitar range, low strings lowest-ish) */
export function validTuning(t, n) {
  return Array.isArray(t) && t.length === n && t.every(m => Number.isInteger(m) && m >= 20 && m <= 76);
}
/** Clean a stored guitar setting: {strings, tunings: {6, 7, 8}}. */
export function normalizeGuitar(g, oldTuner = null) {
  const out = { strings: 6, tunings: {} };
  if (g && STRING_COUNTS.includes(+g.strings)) out.strings = +g.strings;
  for (const n of STRING_COUNTS) {
    const t = g && g.tunings && (g.tunings[n] || g.tunings[String(n)]);
    out.tunings[n] = validTuning(t, n) ? t.slice() : STANDARD[n].slice();
  }
  if (!(g && g.tunings && g.tunings[6]) && oldTuner && OLD_TUNER[oldTuner]) out.tunings[6] = presetNotes(6, OLD_TUNER[oldTuner]).slice();
  return out;
}
/** The guitar for a settings object: {strings, tuning (string 1 first), tunings}. */
export function guitarOf(settings) {
  const g = normalizeGuitar(settings && settings.guitar, settings && settings.tuning);
  return { strings: g.strings, tuning: g.tunings[g.strings], tunings: g.tunings };
}
/** The player's guitar right now. */
export function guitar() { return guitarOf(Store.profile && Store.profile.settings); }
export const stringCount = () => guitar().strings;
/** The current tuning, string 1 first. */
export const currentTuning = () => guitar().tuning.slice();
/** The current tuning, lowest string first (the order the theory helpers use). */
export const lowFirst = (t = currentTuning()) => t.slice().reverse();
/** MIDI note of open string s (1 = high e) in a tuning (string 1 first). */
export const openMidi = (s, t = currentTuning()) => t[s - 1];

/** String labels for a tuning (string 1 first): standard 6 reads e B G D A E; the high E is lower-case. */
export function stringNames(t = currentTuning()) {
  const flats = flatsFor(t);
  return t.map((m, i) => { const n = noteOf(m, flats); return i === 0 && n === 'E' ? 'e' : n; });
}
/** String names for talking about them: "high E", "B", … "low E" (7-string: "low B"; Drop D: "low D"). Keyed by string number. */
export function stringLabels(t = currentTuning()) {
  const names = stringNames(t).map(n => (n === 'e' ? 'E' : n)), out = {};
  names.forEach((n, i) => {
    const dup = names.filter(x => x === n).length > 1, lowest = names.lastIndexOf(n) === i;
    out[i + 1] = dup ? (lowest ? `low ${n}` : i === 0 ? `high ${n}` : n) : n;
  });
  return out;
}
/** "E A D G B E", low to high. */
export const tuningNotes = (t = currentTuning()) => { const flats = flatsFor(t); return t.slice().reverse().map(m => noteOf(m, flats)).join(' '); };
export function presetNotes(n, id) { const p = (PRESETS[n] || []).find(x => x[0] === id); return p ? p[2] : null; }
/** The preset id a tuning matches, or 'custom'. */
export function presetIdOf(n, t) { const p = (PRESETS[n] || []).find(x => x[2].length === t.length && x[2].every((m, i) => m === t[i])); return p ? p[0] : 'custom'; }
/** "Drop D (D A D G B E)" or "Custom (C G C F A D)". */
export function tuningLabel(n = stringCount(), t = currentTuning()) {
  const id = presetIdOf(n, t), p = (PRESETS[n] || []).find(x => x[0] === id);
  return `${p ? p[1] : 'Custom'} (${tuningNotes(t)})`;
}
export const isStandard = (t, n = t.length) => STANDARD[n] && presetIdOf(n, t) === 'standard';

/** Save a change to the guitar: {strings} and/or {tuning} (for the current or given string count). */
export function setGuitar({ strings = null, tuning = null, forStrings = null } = {}) {
  const p = Store.profile; if (!p) return guitar();
  const g = normalizeGuitar(p.settings.guitar, p.settings.tuning);
  if (strings != null && STRING_COUNTS.includes(+strings)) g.strings = +strings;
  const n = forStrings || g.strings;
  if (tuning && validTuning(tuning, n)) g.tunings[n] = tuning.slice();
  p.settings.guitar = g;
  if (n === 6) p.settings.tuning = presetIdOf(6, g.tunings[6]); // keeps older app versions in step
  Store.save();
  return guitar();
}

/** Notes a string can be tuned to in the Settings picker: from 7 semitones below standard to 4 above. */
export function tuningChoices(n, s) {
  const std = STANDARD[n][s - 1], out = [];
  for (let m = std - 7; m <= std + 4; m++) out.push(m);
  return out;
}

/**
 * The tuning for a tab (string 1 first): the tab's own tuning if it declares one, otherwise the
 * player's guitar for the strings the tab uses. A tab for more strings than the guitar has keeps
 * standard tuning on the extra strings.
 */
export function tuningForTab(tab, g = guitar()) {
  const n = tabStrings(tab);
  if (tab && validTuning(tab.tuning, n)) return tab.tuning.slice();
  const k = Math.min(n, g.strings);
  return STANDARD[n].map((m, i) => (i < k ? g.tuning[i] : m));
}
/** How many strings a tab is for: its declared `strings`, its tuning's length, or the highest string number it uses (at least 6). */
export function tabStrings(tab) {
  if (!tab) return 6;
  const used = Math.max(6, ...((tab.notes || []).map(n => +n.s || 0)));
  const decl = STRING_COUNTS.includes(+tab.strings) ? +tab.strings : Array.isArray(tab.tuning) && STRING_COUNTS.includes(tab.tuning.length) ? tab.tuning.length : 6;
  return Math.min(8, Math.max(decl, used));
}

/**
 * Pitch-detection range for the microphone: low enough for the guitar's lowest open string
 * (a 7-string's B ≈ 62 Hz, an 8-string's F♯ ≈ 46 Hz). {minFreq, highpass, fftSize}.
 */
export function listenRange(t = currentTuning()) {
  const low = 440 * Math.pow(2, (Math.min(...t) - 69) / 12);
  const minFreq = Math.max(35, Math.min(70, Math.floor(low * 0.9)));
  return { minFreq, highpass: Math.min(60, Math.floor(low * 0.75)), fftSize: minFreq < 60 ? 4096 : 2048 };
}
