// What a tempo means. The BPM in this app is always the metronome click (one
// click per quarter note, except odd-meter riffs that click every 8th). The
// note value says what you actually play against that click, so "8th notes at
// 130 BPM" means two notes per click at 130 clicks a minute.

const VALUES = [
  [1 / 8, '32nd notes'], [1 / 6, '16th-note sextuplets'], [0.25, '16th notes'], [1 / 3, '8th-note triplets'],
  [0.5, '8th notes'], [0.75, 'dotted 8th notes'], [2 / 3, 'quarter-note triplets'], [1, 'quarter notes'],
  [1.5, 'dotted quarter notes'], [2, 'half notes'], [3, 'dotted half notes'], [4, 'whole notes']
];
const near = (a, b) => Math.abs(a - b) < 0.012;

/** Does the click land on 8th notes instead of quarters (odd-meter riffs)? */
export function clicksOnEighths(ex) {
  return /one click\s*=\s*one 8th|click is on every 8th|8th-note pulse/i.test(`${(ex && ex.unit) || ''} ${(ex && ex.instr) || ''}`);
}

/** Note value named in an exercise's unit text, or null. */
function fromUnit(unit) {
  const u = String(unit || '').toLowerCase();
  if (!u) return null;
  if (/\+/.test(u) && /(8th|16th|quarter)/.test(u)) return u.replace(/\bone\b/g, '').trim(); // "8th + two 16ths": a rhythm, say it as written
  if (/charleston/.test(u)) return 'Charleston rhythm (dotted quarter + 8th)';
  if (/syncopat/.test(u) && /8th/.test(u)) return 'syncopated 8th notes';
  if (/sextuplet/.test(u)) return '16th-note sextuplets';
  if (/32nd/.test(u)) return '32nd notes';
  if (/16th/.test(u)) return '16th notes';
  if (/quarter[- ]note triplet/.test(u)) return 'quarter-note triplets';
  if (/triplet/.test(u)) return '8th-note triplets';
  if (/swung 8th|swing 8th|swung/.test(u)) return 'swung 8th notes';
  if (/8th|eighth/.test(u)) return /pulse/.test(u) ? '8th-note pulse' : '8th notes';
  if (/quarter|one (note|chord|strum) per beat|per beat$/.test(u)) return 'quarter notes';
  if (/half note/.test(u)) return 'half notes';
  if (/whole note/.test(u)) return 'whole notes';
  return null;
}

/** Note value from the tab: the most common gap between note onsets. */
function fromNotes(notes, swing) {
  if (!Array.isArray(notes) || notes.length < 2) return null;
  const on = [...new Set(notes.map(n => Math.round(n.t * 1000) / 1000))].sort((a, b) => a - b);
  if (on.length < 2) return null;
  const count = new Map();
  for (let i = 1; i < on.length; i++) { const g = Math.round((on[i] - on[i - 1]) * 1000) / 1000; count.set(g, (count.get(g) || 0) + 1); }
  // most common gap; ties go to the shorter (faster) value
  const [gap] = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const hit = VALUES.find(([v]) => near(v, gap));
  if (!hit) return null;
  return swing && near(gap, 0.5) ? 'swung 8th notes' : hit[1];
}

/**
 * What you play against the click, e.g. "8th notes", "16th notes",
 * "8th-note triplets". Falls back to "quarter-note click" when the exercise
 * has no fixed rhythm (soloing, ear work).
 */
export function beatLabel(ex) {
  if (!ex) return 'quarter-note click';
  const notes = (ex.tab && ex.tab.notes) || ex.notes || null;
  const swing = !!((ex.tab && ex.tab.swing) || ex.swing);
  const u = fromUnit(ex.unit);
  if (u) return swing && u === '8th notes' ? 'swung 8th notes' : u;
  return fromNotes(notes, swing) || (clicksOnEighths(ex) ? '8th-note pulse' : 'quarter-note click');
}

/** "8th notes at 130 BPM". */
export function tempoPhrase(ex, bpm) {
  const lbl = beatLabel(ex);
  return `${lbl} at ${bpm} BPM`;
}

/** A tooltip that says what the BPM counts. */
export function clickNote(ex) {
  return clicksOnEighths(ex) ? 'BPM = metronome clicks per minute; here every click is an 8th note.' : 'BPM = metronome clicks per minute, one click per quarter note (beat).';
}
