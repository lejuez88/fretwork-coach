// Exercise library in a structured tab format the tab player renders and plays.
// Note: {t: start beat, d: duration in beats, s: string 1-6 (1 = high e), f: fret, x?: technique}
// Techniques: 'h' hammer-on, 'p' pull-off, '/' slide up, '\\' slide down, 'b' bend, '~' vibrato, 'pm' palm mute.
// Phase B's routine engine pulls from this library and from Claude-generated exercises in the same format.

export const STD_TUNING = [64, 59, 55, 50, 45, 40]; // index 0 = string 1 (high e)
export const noteMidi = (n, tuning = STD_TUNING) => tuning[n.s - 1] + n.f;

/** Build notes from a flat sequence of [string, fret, tech?] with a fixed step. */
function seq(list, step = 0.5, start = 0) {
  return list.map(([s, f, x], i) => ({ t: start + i * step, d: step, s, f, ...(x ? { x } : {}) }));
}
/** Chord shape "x32010" (low E → high e) at beat t. */
function chord(shape, t, d) {
  const out = [];
  shape.split('').forEach((c, i) => { if (c !== 'x') out.push({ t, d, s: 6 - i, f: Number(c), chord: true }); });
  return out;
}

const PENTA = [[6, 5], [6, 8], [5, 5], [5, 7], [4, 5], [4, 7], [3, 5], [3, 7], [2, 5], [2, 8], [1, 5], [1, 8]];

/**
 * The spider moving both ways: across the strings (low E to high e) with one
 * finger per fret, then up one fret and back across (high e to low E), climbing
 * to `top` and back down to where it started, so the loop joins up.
 */
export function spiderClimb({ from = 1, top = 5, perm = [1, 2, 3, 4], strings = [6, 5, 4, 3, 2, 1], frets = null } = {}) {
  const fr = k => (frets ? frets[k - 1] : k - 1);
  const positions = [];
  for (let p = from; p <= top; p++) positions.push(p);
  for (let p = top - 1; p > from; p--) positions.push(p);
  const out = [];
  positions.forEach((pos, i) => {
    const across = i % 2 === 0 ? strings : [...strings].reverse();
    const order = i % 2 === 0 ? perm : [...perm].reverse();
    across.forEach(s => order.forEach(k => out.push([s, pos + fr(k)])));
  });
  return out;
}

export const EXERCISES = [
  {
    id: 'spider-1234', name: 'Chromatic spider 1-2-3-4, climbing the neck', domain: 'fretting', level: 2, tags: ['finger independence', 'alternate picking', 'position shifts'],
    why: 'One finger per fret builds independence and economy of motion; shifting up a fret after every pass across the strings adds clean, relaxed position shifts.',
    bpm: 60, goalBpm: 120, unit: '8ths',
    notes: seq(spiderClimb(), 0.5)
  },
  {
    id: 'penta-box1', name: 'A minor pentatonic, box 1', domain: 'fretboard', level: 2, tags: ['scales', 'alternate picking'],
    why: 'The most-used soloing shape in rock and blues; the foundation for improvising.',
    bpm: 70, goalBpm: 140, unit: '8ths', beats: 12,
    notes: seq([...PENTA, ...[...PENTA].reverse()], 0.5)
  },
  {
    id: 'penta-16ths', name: 'Pentatonic box 1 in 16ths', domain: 'picking', level: 5, tags: ['alternate picking', 'string crossing'],
    why: 'String crossing at speed exposes uneven picking; strict alternation fixes it.',
    bpm: 70, goalBpm: 110, unit: '16ths', beats: 6,
    notes: seq([...PENTA, ...[...PENTA].reverse()], 0.25)
  },
  {
    id: 'gcd-changes', name: 'G – C – D chord changes', domain: 'fretting', level: 3, tags: ['chord changes', 'strumming'],
    why: 'Fast, clean changes between the three most common open chords unlock hundreds of songs.',
    bpm: 60, goalBpm: 100, unit: '2 beats per chord', beats: 8,
    notes: [...chord('320003', 0, 2), ...chord('x32010', 2, 2), ...chord('xx0232', 4, 2), ...chord('320003', 6, 2)]
  },
  {
    id: 'legato-3nps', name: 'G major 3-note-per-string legato', domain: 'fretting', level: 7, tags: ['legato', 'hammer-ons', 'pull-offs'],
    why: 'Pick only the first note on each string; it builds fretting-hand strength and evenness.',
    bpm: 60, goalBpm: 110, unit: '16ths', beats: 9,
    notes: (() => {
      const up = [[6, 3], [6, 5, 'h'], [6, 7, 'h'], [5, 3], [5, 5, 'h'], [5, 7, 'h'], [4, 4], [4, 5, 'h'], [4, 7, 'h'], [3, 4], [3, 5, 'h'], [3, 7, 'h'], [2, 5], [2, 7, 'h'], [2, 8, 'h'], [1, 5], [1, 7, 'h'], [1, 8, 'h']];
      const down = [[1, 8], [1, 7, 'p'], [1, 5, 'p'], [2, 8], [2, 7, 'p'], [2, 5, 'p'], [3, 7], [3, 5, 'p'], [3, 4, 'p'], [4, 7], [4, 5, 'p'], [4, 4, 'p'], [5, 7], [5, 5, 'p'], [5, 3, 'p'], [6, 7], [6, 5, 'p'], [6, 3, 'p']];
      return seq([...up, ...down], 0.25);
    })()
  },
  {
    id: 'blues-shuffle-a', name: 'A blues shuffle riff', domain: 'rhythm', level: 3, tags: ['shuffle feel', 'palm muting'],
    why: 'The shuffle is the heartbeat of blues and rock ’n’ roll; it trains swing feel against the click.',
    bpm: 80, goalBpm: 130, unit: 'swung 8ths', beats: 16, swing: true,
    notes: (() => {
      // Classic root–5th / root–6th dyad shuffle: A, A, D, A (root = open string)
      const notes = [];
      [5, 5, 4, 5].forEach((low, bi) => {
        [2, 2, 4, 4].forEach((top, beat) => {
          for (let half = 0; half < 2; half++) {
            const t = bi * 4 + beat + half * 0.5;
            notes.push({ t, d: 0.5, s: low, f: 0, x: 'pm' }, { t, d: 0.5, s: low - 1, f: top, chord: true });
          }
        });
      });
      return notes;
    })()
  },
  {
    id: 'string-skip', name: 'Alternate picking, string crossing', domain: 'picking', level: 4, tags: ['alternate picking', 'outside picking'],
    why: 'A repeating 3-string pattern isolates the hardest motion in picking: changing strings cleanly. Here it walks through Am – F – C – G, so the hand also moves between shapes.',
    bpm: 70, goalBpm: 120, unit: '16ths', beats: 16, chords: ['Am', 'F', 'C', 'G'],
    // [G-string, B-string, e-string, top e-string note] for each chord shape
    notes: seq([[5, 5, 5, 8], [5, 6, 5, 8], [5, 5, 3, 8], [4, 3, 3, 7]].flatMap(([g, b, e, top]) => Array.from({ length: 2 }, () => [[3, g], [2, b], [1, e], [2, b], [3, g], [2, b], [1, top], [2, b]]).flat()), 0.25)
  },
  {
    id: 'sweep-am', name: '3-string A minor sweep', domain: 'picking', level: 8, tags: ['sweep picking', 'muting'],
    why: 'Sweeps train picking-hand follow-through and fretting-hand muting together.',
    bpm: 60, goalBpm: 110, unit: 'triplets', beats: 8,
    notes: seq(Array.from({ length: 4 }, () => [[3, 14], [2, 13], [1, 12], [1, 17], [1, 12], [2, 13]]).flat(), 1 / 3)
  }
];
export const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

/** Total length in beats, rounded up to whole bars. */
export function exerciseBeats(ex, beatsPerBar = 4) {
  const end = ex.beats || Math.max(...ex.notes.map(n => n.t + n.d));
  return Math.ceil(end / beatsPerBar) * beatsPerBar;
}
