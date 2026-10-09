// Picking-hand directions for tab notes. Strokes are computed from the rhythm
// and strings, so every tab (library, Claude-written, imported) gets them:
//   alternate  down on the beat and the "&", up on the off-beats (the hand keeps
//              moving in time, as most teachers mark rhythm and lead parts)
//   strict     every picked note alternates, regardless of rhythm
//   economy    alternate on one string; when changing strings, keep going in the
//              direction of the move (sweep through)
//   down       all downstrokes (punk, metal chugs, Ramones-style drive)
//   fingers    p i m a (thumb on strings 4–6, fingers on 3, 2, 1)
//   hybrid     pick on strings 3–6 (in time), middle/ring finger on strings 2 and 1
// Hammer-ons, pull-offs, slid-into and tapped notes get no stroke.
// A lesson can also write the stroke or finger on a note ({pick: 'd'|'u'}, {fing: 'p'|'i'|'m'|'a'|'c'});
// written marks always win over the computed ones, in every mode.

export const PICK_MODES = [
  ['alternate', 'Alternate (in time)', 'Down on the beat and the “&”, up in between: the hand keeps moving in time, even through rests.'],
  ['strict', 'Strict alternate', 'Every picked note alternates down–up, whatever the rhythm.'],
  ['economy', 'Economy', 'Alternate on one string; when you change strings, keep the pick moving the same way and sweep through.'],
  ['down', 'All downstrokes', 'Every note is a downstroke: tight, driving and even.'],
  ['fingers', 'Fingers (p i m a)', 'Thumb (p) on strings 4–6, index (i) on 3, middle (m) on 2, ring (a) on 1.'],
  ['hybrid', 'Hybrid (pick + fingers)', 'Pick the lower strings in time; pluck string 2 with the middle finger (m) and string 1 with the ring finger (a).']
];
export const PICK_MODE_IDS = PICK_MODES.map(m => m[0]);
const UNPICKED = new Set(['h', 'p', '/', '\\', 't']);

/** Best picking mode for an exercise: its own setting, else guessed from its description. */
export function suggestPicking(ex) {
  if (ex && PICK_MODE_IDS.includes(ex.picking)) return ex.picking;
  const t = `${ex && ex.name || ''} ${ex && ex.unit || ''} ${ex && ex.instr || ''} ${ex && ex.why || ''}`.toLowerCase();
  if (/sweep|economy/.test(t)) return 'economy';
  if (/hybrid|chicken pick|pick and finger|pick plus/.test(t)) return 'hybrid';
  if (/travis|fingerpick|fingerstyle|thumb|classical|p[–-]i|pima|pluck/.test(t)) return 'fingers';
  if (/downpick|downstroke|all down|down-?strokes/.test(t)) return 'down';
  if (/strict alternate/.test(t)) return 'strict';
  return 'alternate';
}

/** The rhythmic grid (beats per step) that every time in `times` sits on, or null. */
function gridOf(times) {
  for (const g of [1, 0.5, 1 / 3, 0.25, 1 / 6, 0.125]) {
    if (times.every(t => Math.abs(t / g - Math.round(t / g)) < 0.02)) return g;
  }
  return null;
}
const FINGER_FOR_STRING = { 1: 'a', 2: 'm', 3: 'i', 4: 'p', 5: 'p', 6: 'p' };

/**
 * Compute directions for notes sorted by time.
 * Returns an array aligned with `notes`: {stroke: 'd'|'u'|null, finger: 'p'|'i'|'m'|'a'|null, lead: bool}
 * `lead` marks the one note per chord/strum that carries the symbol.
 */
export const WRITTEN_FINGERS = ['p', 'i', 'm', 'a', 'c'];
export function computePicks(notes, mode = 'alternate') { return applyWritten(notes, autoPicks(notes, mode)); }
/** Strokes and fingers written in the lesson replace the computed ones (and carry the symbol for their chord). */
function applyWritten(notes, out) {
  const atT = t => notes.map((m, j) => j).filter(j => Math.abs(notes[j].t - t) < 1e-3);
  notes.forEach((n, i) => {
    const pick = n.pick === 'd' || n.pick === 'u' ? n.pick : null, fing = WRITTEN_FINGERS.includes(n.fing) ? n.fing : null;
    if (!pick && !fing) return;
    const group = atT(n.t);
    if (pick) { group.forEach(j => { if (j !== i) { out[j].stroke = null; out[j].lead = false; } }); out[i].stroke = pick; }
    if (fing) { out[i].finger = fing; if (!pick) out[i].stroke = null; }
    if (!group.some(j => out[j].lead) || pick) { group.forEach(j => { out[j].lead = false; }); out[i].lead = true; }
    out[i].written = true;
  });
  return out;
}
function autoPicks(notes, mode) {
  const out = notes.map(() => ({ stroke: null, finger: null, lead: false }));
  // Group simultaneous notes (chords, pinches)
  const groups = [];
  notes.forEach((n, i) => {
    const g = groups.length && Math.abs(groups[groups.length - 1].t - n.t) < 1e-3 ? groups[groups.length - 1] : null;
    if (g) g.idx.push(i); else groups.push({ t: n.t, idx: [i] });
  });
  const picked = groups.map(g => ({ ...g, idx: g.idx.filter(i => !UNPICKED.has(notes[i].x)) })).filter(g => g.idx.length);
  if (!picked.length) return out;
  const leadOf = g => g.idx.reduce((a, i) => (notes[i].s > notes[a].s ? i : a), g.idx[0]); // lowest string carries the strum symbol

  if (mode === 'fingers') {
    picked.forEach(g => { g.idx.forEach(i => { out[i].finger = FINGER_FOR_STRING[notes[i].s] || 'p'; }); out[leadOf(g)].lead = true; });
    return out;
  }
  if (mode === 'down') { picked.forEach(g => { const l = leadOf(g); out[l].stroke = 'd'; out[l].lead = true; }); return out; }

  // In time: the hand moves down-up on the smallest subdivision, at least in 8ths
  const pendulum = list => {
    const grid = gridOf(list.map(g => g.t));
    if (!grid || Math.abs(grid - 1 / 6) < 1e-6) return null; // no grid, or triplets mixed with straight notes: strict alternate reads better
    const step = Math.min(grid, 0.5);
    return list.map(g => (Math.round(g.t / step) % 2 === 0 ? 'd' : 'u'));
  };

  if (mode === 'hybrid') {
    // Pick the lower strings in time; fingers take strings 1–2 when the pick isn't on them
    const pickGroups = [];
    picked.forEach(g => {
      const fingered = g.idx.filter(i => notes[i].s <= 2), pickedIdx = g.idx.filter(i => notes[i].s > 2);
      fingered.forEach(i => { out[i].finger = FINGER_FOR_STRING[notes[i].s]; });
      if (pickedIdx.length) pickGroups.push({ t: g.t, idx: pickedIdx });
      out[leadOf(pickedIdx.length ? { idx: pickedIdx } : g)].lead = true;
    });
    const dirs = pendulum(pickGroups) || pickGroups.map((_, k) => (k % 2 ? 'u' : 'd'));
    pickGroups.forEach((g, k) => { out[leadOf(g)].stroke = dirs[k]; });
    return out;
  }

  let dirs = null;
  if (mode === 'alternate') dirs = pendulum(picked);
  if (!dirs) {
    // strict (and economy's base): alternate note to note, starting with a downstroke
    dirs = [];
    picked.forEach((g, k) => {
      if (k === 0) { dirs.push('d'); return; }
      const prev = dirs[k - 1];
      if (mode === 'economy' && g.idx.length === 1 && picked[k - 1].idx.length === 1) {
        const s0 = notes[picked[k - 1].idx[0]].s, s1 = notes[g.idx[0]].s;
        // A downstroke travels toward string 1 (the floor): moving to a lower-numbered string, keep going down
        if (s1 !== s0) { dirs.push(s1 < s0 ? 'd' : 'u'); return; }
      }
      dirs.push(prev === 'd' ? 'u' : 'd');
    });
  }
  picked.forEach((g, k) => { const l = leadOf(g); out[l].stroke = dirs[k]; out[l].lead = true; });
  return out;
}

/** SVG for one stroke symbol centred at (x, y): ⊓ for down, V for up. */
export function strokeSVG(stroke, x, y, i) {
  if (stroke === 'd') return `<path class="tab-pick" data-i="${i}" d="M${x - 5} ${y + 5}V${y - 4}H${x + 5}V${y + 5}"/>`;
  if (stroke === 'u') return `<path class="tab-pick" data-i="${i}" d="M${x - 5} ${y - 5}L${x} ${y + 5}L${x + 5} ${y - 5}"/>`;
  return '';
}
