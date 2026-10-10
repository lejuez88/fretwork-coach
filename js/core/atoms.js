// Exercise generators ("atoms"). Each builds an original, measurable exercise
// (tab and/or chord voicings, start and goal tempo, instructions) for a key,
// level and style, using the theory engine. Course plans, routines, song
// lessons and the request box all draw on these, so a blues course in E gets
// a shuffle in E and bends in the E box, while a jazz course gets shell
// voicings and guide tones over ii–V–I.
import {
  ROOT_BY_PC, mod12, STD_LOW, chordName, chordTones, parseChord, scaleNps, scaleBox, SCALE_BY_ID, inversionVoicings, voiceLead,
  findVoicings, defaultVoicing, diatonicChords, voicingNotes, intervalFamily
} from './theory.js';

/* ------------------------------- Helpers ------------------------------- */
const OPEN = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
/** Fret of a pitch class on a string within [lo, hi]. */
export function fretOn(s, pc, lo = 0, hi = 15) { for (let f = lo; f <= hi; f++) if (mod12(OPEN[s] + f) === mod12(pc)) return f; return null; }
/** Root fret on the low E string for box shapes (E plays in open position). */
export function rootFret6(pc) { let f = mod12(pc - 40); if (f === 0) return 0; return f; }
const N = (s, f, t, d, x, extra) => ({ t: +t.toFixed(4), d, s, f, ...(x ? { x } : {}), ...(extra || {}) });
const seqNotes = (list, step, t0 = 0) => list.map(([s, f, x, bt], i) => N(s, f, t0 + i * step, step, x, bt != null ? { bendTo: bt } : null));
const beatsOf = notes => Math.max(4, Math.ceil(Math.max(...notes.map(n => n.t + n.d)) / 4 - 1e-6) * 4);
const unitStep = u => (u === '16ths' ? 0.25 : u === 'triplets' ? 1 / 3 : u === 'quarters' ? 1 : 0.5);
const keyName = c => ROOT_BY_PC[c.key] ? ROOT_BY_PC[c.key].name : chordName(c.key, 'maj');
/** Level-scaled goal tempo. */
const goalFor = (c, base) => Math.round(base * (0.78 + c.lvl * 0.05));
function make(c, o) {
  const goal = goalFor(c, o.goal), start = Math.max(30, Math.round(o.start != null ? o.start : goal * 0.6));
  const out = { level: Math.max(1, Math.min(10, Math.round(c.lvl + (o.dl || 0)))), minutes: o.minutes || 5, goalBpm: goal, startBpm: Math.min(start, goal - 4), ...o };
  delete out.goal; delete out.start; delete out.dl;
  if (out.tab && out.tab.notes && !out.tab.beats) out.tab.beats = beatsOf(out.tab.notes);
  out.id = out.id || slugId(out.name);
  return out;
}
// same rule as the course normalizer, so ids match between plans and routine pools
const slugId = s => ('g-' + String(s)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const voicingsOf = list => list.filter(Boolean).map(v => ({ name: v.chord || v.name, frets: v.frets, labels: v.labels, names: v.names, fingers: v.fingers, barre: v.barre }));
const uniqVoicings = list => { const seen = new Set(); return list.filter(v => { const k = v.name + v.frets.join(); if (seen.has(k)) return false; seen.add(k); return true; }); };

/** Chord names for scale degrees of a key. degrees: 1-based, with optional quality override, e.g. [1,4,5] or ['1:7','4:7','5:7']. */
export function progressionIn(keyPc, mode, degrees, sevenths = false) {
  const dia = diatonicChords(keyPc, mode === 'minor' ? 'minor' : 'major', sevenths);
  return degrees.map(d => {
    const [deg, q] = String(d).split(':');
    const dc = dia[(+deg - 1) % 7];
    return q ? chordName(dc.root, q) : dc.name;
  });
}

/** Ascending scale notes for a box / 3nps position. */
function positionNotes(keyPc, scale, box = 1, nps = null) {
  const sc = SCALE_BY_ID[scale];
  nps = nps || (scale === 'wholeTone' ? 3 : scale === 'chromatic' ? 4 : sc.steps.length <= 6 ? 2 : 3);
  const r = rootFret6(keyPc);
  // start fret of box k = k-th scale tone on string 6 from the root
  let f = r, k = 1; const pcs = sc.steps.map(x => mod12(keyPc + x));
  while (k < box) { f++; if (pcs.includes(mod12(40 + f))) k++; }
  const scaleIdForNps = scale === 'blues' ? 'minorPent' : scale === 'majorBlues' ? 'majorPent' : scale;
  let notes = scaleNps(keyPc, scaleIdForNps, f, nps);
  if (!notes) notes = scaleNps(keyPc, scaleIdForNps, Math.max(0, f - 12), nps);
  if (!notes) return [];
  if (scale === 'blues' || scale === 'majorBlues') {
    // add the blue note inside the box
    const blue = mod12(keyPc + (scale === 'blues' ? 6 : 3));
    const lo = Math.min(...notes.map(n => n.f)), hi = Math.max(...notes.map(n => n.f)) + 1;
    for (let s = 6; s >= 1; s--) { const fb = fretOn(s, blue, lo, hi); if (fb != null) notes.push({ s, f: fb, midi: OPEN[s] + fb, label: scale === 'blues' ? '♭5' : '♭3' }); }
    const seen = new Set(); notes = notes.sort((a, b) => a.midi - b.midi).filter(n => (seen.has(n.midi) ? false : seen.add(n.midi)));
  }
  return notes.sort((a, b) => a.midi - b.midi);
}
function patternize(pts, pattern) {
  const up = pts, n = pts.length, out = [];
  if (pattern === 'thirds') { for (let i = 0; i + 2 < n; i++) out.push(up[i], up[i + 2]); for (let i = n - 1; i - 2 >= 0; i--) out.push(up[i], up[i - 2]); }
  else if (pattern === 'fours') { for (let i = 0; i + 3 < n; i++) out.push(up[i], up[i + 1], up[i + 2], up[i + 3]); }
  else if (pattern === 'threes') { for (let i = 0; i + 2 < n; i++) out.push(up[i], up[i + 1], up[i + 2]); for (let i = n - 1; i - 2 >= 0; i--) out.push(up[i], up[i - 1], up[i - 2]); }
  else { out.push(...up, ...up.slice(0, -1).reverse().slice(0, -1)); }
  return out;
}
function chordHits(voicing, hits) { return hits.flatMap(([t, d, x]) => voicing.frets.map((f, i) => (f == null ? null : N(6 - i, f, t, d, x, { chord: true }))).filter(Boolean)); }

/* ------------------------------ Fretboard ------------------------------ */
export function scaleRun(c, { scale, box = 1, nps = null, pattern = 'linear', unit = null, name = null, domain = 'fretboard' } = {}) {
  unit = unit || (c.lvl >= 6 ? '16ths' : '8ths');
  const pts = positionNotes(c.key, scale, box, nps);
  if (!pts.length) return null;
  let seq = patternize(pts, pattern).slice(0, 64);
  const step = unitStep(unit);
  const sc = SCALE_BY_ID[scale];
  const notes = seq.map((p, i) => N(p.s, p.f, i * step, step));
  const pat = { linear: 'up and down', thirds: 'in 3rds', fours: 'in groups of 4', threes: 'in groups of 3' }[pattern];
  return make(c, {
    name: name || `${keyName(c)} ${sc.name.toLowerCase()}, position ${box} ${pattern !== 'linear' ? pat : ''}`.trim(), domain, unit,
    goal: unit === '16ths' ? 100 : 140, minutes: 5, picking: 'alternate',
    why: `${sc.name} is core vocabulary for this style; position ${box} links to the shapes around it.`,
    instr: `Play ${pat} in ${unit}, strict alternate picking. Say the root (${keyName(c)}) each time you pass it; the root dots are what tie this shape to the chords.`,
    watch: 'Speeding up on the easy strings and slowing on string changes.', simplify: unit === '16ths' ? 'Play it in 8ths at the same tempo.' : 'Quarter notes, eyes on the root positions.',
    tab: { notes }
  });
}

export function connectPositions(c, { scale = 'minorPent', from = 1, to = 2 } = {}) {
  const a = positionNotes(c.key, scale, from), b = positionNotes(c.key, scale, to);
  if (!a.length || !b.length) return null;
  const seq = [...a, ...b.slice().reverse()];
  const step = c.lvl >= 6 ? 0.25 : 0.5;
  return make(c, {
    name: `Connect positions ${from} and ${to} (${keyName(c)} ${SCALE_BY_ID[scale].name.toLowerCase()})`, domain: 'fretboard', unit: step === 0.25 ? '16ths' : '8ths', goal: step === 0.25 ? 90 : 130, minutes: 5,
    why: 'Soloing across the neck means moving between shapes without stopping; this drills the hand-off.',
    instr: `Up position ${from}, then shift and come down position ${to}. The shared notes are the bridge: find them before you play.`,
    watch: 'A pause at the shift.', simplify: 'Play only the top three strings of each position.', tab: { notes: seq.map((p, i) => N(p.s, p.f, i * step, step)) }
  });
}

export function noteFinder(c, { pc = null } = {}) {
  pc = pc == null ? c.key : pc;
  const seq = [];
  for (let s = 6; s >= 1; s--) { const f = fretOn(s, pc, 0, 11); if (f != null) seq.push([s, f]); }
  for (let s = 1; s <= 6; s++) { const f = fretOn(s, pc, 12 - 0, 23); if (f != null && f <= 17) seq.push([s, f]); }
  const nm = ROOT_BY_PC[mod12(pc)].name;
  return make(c, {
    name: `Every ${nm} on the neck`, domain: 'fretboard', unit: 'one note per beat', goal: 90, start: 40, minutes: 4, dl: -1,
    why: `${nm} is the key center here; finding it instantly on every string is what lets you place any shape.`,
    instr: `Play every ${nm} from the low E string up (frets 0–11), then come back down in the upper octave. One per click, say “${nm}” each time.`,
    watch: 'Counting frets from the nut instead of using octave shapes.', simplify: 'Strings 6, 5 and 4 only.', tab: { notes: seqNotes(seq, 1) }
  });
}

export function intervalShapes(c) {
  const r = fretOn(5, c.key, 2, 10), root = OPEN[5] + r;
  const ivs = [[3, '♭3'], [4, '3'], [5, '4'], [7, '5'], [9, '6'], [10, '♭7'], [11, '7'], [12, '8']];
  const seq = [];
  ivs.forEach(([semi]) => {
    const target = root + semi;
    let best = null;
    for (const s of [5, 4, 3]) { const f = target - OPEN[s]; if (f >= r - 1 && f <= r + 4) { best = [s, f]; break; } }
    if (best) seq.push([5, r], best);
  });
  return make(c, {
    name: `Interval shapes from ${keyName(c)}`, domain: 'ear', unit: '8ths, root then interval', goal: 100, start: 50, minutes: 4, dl: -1,
    why: 'Every interval has a fixed shape on the neck; knowing shape + sound is how you play what you hear.',
    instr: 'Root, then the interval: minor 3rd, major 3rd, 4th, 5th, 6th, minor 7th, major 7th, octave. Sing each interval before you play it.',
    watch: 'Playing the shapes without listening; name each one as it sounds.', simplify: 'Only the 3rds and the 5th.', tab: { notes: seqNotes(seq, 0.5) }
  });
}

export function modeCompare(c, { modes = ['minor', 'dorian'] } = {}) {
  const parts = modes.map(m => positionNotes(c.key, m, 1, 3)).filter(x => x.length);
  if (parts.length < 2) return null;
  const notes = []; let t = 0;
  parts.forEach(pts => { pts.forEach(p => { notes.push(N(p.s, p.f, t, 0.5)); t += 0.5; }); t = Math.ceil(t / 4) * 4; });
  let names = modes.map(m => SCALE_BY_ID[m].name.split(' (')[0]);
  if (new Set(names).size < names.length) names = modes.map(m => SCALE_BY_ID[m].name);
  return make(c, {
    name: `${keyName(c)} ${names.join(' vs ')}`, domain: 'theory', unit: '8ths', goal: 130, minutes: 5,
    why: `${names.join(' and ')} share a root but differ by one or two notes; hearing that difference is what modes are about.`,
    instr: `Play ${names[0]}, then ${names[1]}, from the same root. Find the note(s) that change and lean on them: that's the color of each mode.`,
    watch: 'Treating them as the same shape: they are not.', simplify: 'Play only strings 4–1 of each.', tab: { notes }
  });
}

/* ------------------------------- Lead ------------------------------- */
export function bendLick(c) {
  const r = rootFret6(c.minor ? c.key : mod12(c.key - 3)) || 12;
  const notes = [
    N(3, r + 4, 0, 1), N(3, r + 2, 1, 1, 'b', { bendTo: r + 4 }), N(2, r + 5, 2, 1), N(2, r + 3, 3, 1, 'b', { bendTo: r + 5 }),
    N(2, r + 3, 4, 0.5, 'b', { bendTo: r + 5 }), N(1, r, 4.5, 0.5), N(2, r + 3, 5, 0.5), N(3, r + 2, 5.5, 0.5), N(3, r + 2, 6, 2, '~')
  ];
  return make(c, {
    name: `Bends in tune: ${keyName(c)} box 1`, domain: 'fretting', unit: 'quarters, then a phrase', goal: 90, start: 50, minutes: 4,
    why: 'A bend that lands on pitch is the voice of rock and blues lead; this checks it against the fretted target.',
    instr: 'Bar 1: play the target note, then bend up to match it (G string: whole step; B string: whole step). Bar 2: the bends inside a short phrase, ending with vibrato.',
    watch: 'Bending short of the target pitch.', simplify: 'Half-step bends first.', tab: { notes }
  });
}

export function vibratoHolds(c) {
  const r = rootFret6(c.minor ? c.key : mod12(c.key - 3)) || 12;
  const notes = [[3, r + 2], [2, r + 3], [2, r + 5], [1, r]].map(([s, f], i) => N(s, f, i * 2, 2, '~'));
  return make(c, {
    name: 'Vibrato on target notes', domain: 'fretting', unit: '2 beats per note', goal: 80, start: 60, minutes: 3, dl: -1,
    why: 'Even, in-time vibrato makes long notes sing.', instr: 'Hold each note for two beats with vibrato in time: two pulses per beat. Wrist rotation, thumb hooked or light.',
    watch: 'Vibrato that drifts flat or speeds up.', simplify: 'One pulse per beat.', tab: { notes }
  });
}

export function doubleStops(c, { interval = '3rds' } = {}) {
  const steps = SCALE_BY_ID[c.minor ? 'minor' : 'major'].steps;
  const [lo, hi, gap] = interval === '6ths' ? [3, 1, 5] : [3, 2, 2];
  const scalePitches = []; for (let m = 50; m < 100; m++) if (steps.includes(mod12(m - c.key))) scalePitches.push(m);
  const startIdx = scalePitches.findIndex(m => mod12(m - c.key) === 0 && m - OPEN[lo] >= 2);
  const notes = []; let t = 0;
  for (let k = 0; k < 8; k++) {
    const a = scalePitches[startIdx + k], b = scalePitches[startIdx + k + gap];
    const fa = a - OPEN[lo], fb = b - OPEN[hi];
    if (fa < 0 || fb < 0 || fa > 20 || fb > 20) break;
    notes.push(N(lo, fa, t, 1, null, { chord: true }), N(hi, fb, t, 1, null, { chord: true })); t += 1;
  }
  return make(c, {
    name: `Diatonic ${interval} on strings ${lo} & ${hi} (${keyName(c)})`, domain: 'fretting', unit: 'quarters', goal: 100, start: 50, minutes: 4,
    why: `${interval === '6ths' ? 'Sixths' : 'Thirds'} on two strings are the sweet double-stops of soul, country and R&B fills.`,
    instr: `Climb the ${keyName(c)} ${c.minor ? 'minor' : 'major'} scale in ${interval}, both notes together. ${interval === '6ths' ? 'Mute string 2 with the underside of the fretting finger, or pluck with pick and middle finger.' : 'Roll one finger across when the frets match.'}`,
    watch: 'One note louder than the other.', simplify: 'Half notes, first four pairs only.', picking: interval === '6ths' ? 'hybrid' : 'alternate', tab: { notes }
  });
}

export function legatoRun(c, { scale = null } = {}) {
  scale = scale || (c.minor ? 'minor' : 'major');
  const pts = positionNotes(c.key, scale, 1, 3);
  if (!pts.length) return null;
  const notes = []; let t = 0; const step = c.lvl >= 6 ? 1 / 3 : 0.5;
  const byString = s => pts.filter(p => p.s === s);
  for (let s = 6; s >= 1; s--) byString(s).forEach((p, i) => { notes.push(N(p.s, p.f, t, step, i ? 'h' : null)); t += step; });
  for (let s = 1; s <= 6; s++) byString(s).slice().reverse().forEach((p, i) => { notes.push(N(p.s, p.f, t, step, i ? 'p' : null)); t += step; });
  return make(c, {
    name: `Legato 3-notes-per-string: ${keyName(c)} ${SCALE_BY_ID[scale].name.split(' (')[0].toLowerCase()}`, domain: 'fretting', unit: step < 0.5 ? 'triplets' : '8ths', goal: step < 0.5 ? 100 : 120, minutes: 5,
    why: 'Pick once per string and let the fretting hand do the rest: the fluid sound of rock and fusion lead.',
    instr: 'Pick only the first note on each string. Hammer-ons going up, pull-offs coming down, every note the same volume.',
    watch: 'Weak hammer-ons and notes that fade.', simplify: 'One string at a time, then two.', tab: { notes }
  });
}

export function sweepArp(c, { strings = null } = {}) {
  const type = c.minor ? 'min' : 'maj';
  strings = strings || (c.lvl >= 7 ? 5 : 3);
  const notes = []; let t = 0; const step = 1 / 3;
  if (strings === 5) {
    const rA = fretOn(5, c.key, 7, 17);
    const tones = chordTones(c.key, type).map(x => x.semis);
    const base = OPEN[5] + rA, seqP = []; for (let m = base; seqP.length < 7; m++) if (tones.includes(mod12(m - c.key))) seqP.push(m);
    const plan = [[5, seqP[0]], [5, seqP[1], 'h'], [4, seqP[2]], [3, seqP[3]], [2, seqP[4]], [1, seqP[5]], [1, seqP[6], 'h']];
    const frets = plan.map(([s, m]) => m - OPEN[s]);
    if (Math.max(...frets) - Math.min(...frets) <= 6 && Math.min(...frets) >= 0) {
      const up = plan.map(([s, m, x], i) => [s, m - OPEN[s], x]);
      const down = up.slice(0, -1).reverse().map(([s, f], i) => [s, f, i === 0 ? 'p' : null]).slice(0, -1);
      [...up, ...down].forEach(([s, f, x]) => { notes.push(N(s, f, t, step, x)); t += step; });
    }
  }
  if (!notes.length) {
    strings = 3;
    const v = inversionVoicings(c.key, type, 'triad', { set: [3, 4, 5] }).find(x => x.inversion === 0 && x.minF >= 4) || inversionVoicings(c.key, type, 'triad', { set: [3, 4, 5] })[0];
    if (!v) return null;
    const g = v.frets[3], b = v.frets[4], e = v.frets[5], top = e + (mod12(c.key - mod12(OPEN[1] + e)) || 12);
    [[3, g], [2, b], [1, e], [1, top, 'h'], [1, e, 'p'], [2, b]].forEach(([s, f, x]) => { notes.push(N(s, f, t, step, x)); t += step; });
    const copy = notes.slice(); copy.forEach(n => notes.push({ ...n, t: +(n.t + 2).toFixed(4) }));
  }
  return make(c, {
    name: `${strings}-string ${keyName(c)}${type === 'min' ? 'm' : ''} sweep arpeggio`, domain: 'picking', unit: 'triplets', goal: 110, start: 50, minutes: 5, dl: 1, picking: 'economy',
    why: 'Sweeps play a chord one note at a time with one continuous pick motion: shred and neoclassical vocabulary.',
    instr: 'One push through the strings going up, one pull coming down; lift each finger as soon as its note has sounded so notes don’t ring together.',
    watch: 'Notes bleeding into a strum.', simplify: 'Pick each note separately, slowly.', tab: { notes }
  });
}

export function tapLick(c) {
  const pcs = SCALE_BY_ID.minorPent.steps.map(x => mod12((c.minor ? c.key : c.key - 3) + x));
  const onE = []; for (let f = 5; f <= 20; f++) if (pcs.includes(mod12(64 + f))) onE.push(f);
  const tap = onE.find(f => f >= 14 && mod12(64 + f) === mod12(c.minor ? c.key : c.key - 3)) || onE[onE.length - 1];
  const low = onE.find(f => f >= tap - 7), mid = onE.filter(f => f < tap).pop();
  const notes = [];
  for (let b = 0; b < 4; b++) notes.push(N(1, tap, b, 1 / 3, 't'), N(1, low, b + 1 / 3, 1 / 3, 'p'), N(1, mid, b + 2 / 3, 1 / 3, 'h'));
  return make(c, {
    name: `Tapping triplets in ${keyName(c)}`, domain: 'fretting', unit: 'triplets', goal: 110, start: 50, minutes: 4, dl: 1,
    why: 'Tapping adds a third finger to the fretboard: wide, fast lines that picking can’t reach.',
    instr: `Tap fret ${tap} with the picking hand (T), pull off to ${low}, hammer ${mid}. Mute the other strings with both hands.`,
    watch: 'The pull-off from the tap being quieter than the hammered note.', simplify: 'Tap and pull-off only, quarter notes.', tab: { notes }
  });
}

export function speedBurst(c, { scale = null } = {}) {
  scale = scale || (c.minor ? 'minorPent' : 'majorPent');
  const pts = positionNotes(c.key, scale, 1).filter(p => p.s === 3 || p.s === 2);
  const g = pts.filter(p => p.s === 3).map(p => p.f), b = pts.filter(p => p.s === 2).map(p => p.f);
  if (g.length < 2 || b.length < 2) return null;
  const cell = [[3, g[0]], [3, g[1]], [2, b[0]], [2, b[1]]];
  const seq = []; for (let k = 0; k < 4; k++) seq.push(...cell, ...cell.slice().reverse());
  const sext = c.lvl >= 7;
  return make(c, {
    name: `${sext ? 'Sextuplet' : '16th-note'} bursts on two strings (${keyName(c)})`, domain: 'picking', unit: sext ? 'sextuplets' : '16ths', goal: sext ? 90 : 120, minutes: 4, picking: 'strict',
    why: 'Short, fast cells across a string change build the synchronized hands that shred lines need.',
    instr: 'Strict alternate picking, tiny motions. Play the cell 4 times, rest a beat, repeat. Speed comes from relaxation, not force.',
    watch: 'Tension creeping into the forearm as the tempo rises.', simplify: 'The same cell in 8ths.', tab: { notes: seqNotes(seq, sext ? 1 / 6 : 0.25) }
  });
}

export function stringSkip(c, { scale = null } = {}) {
  scale = scale || (c.minor ? 'minor' : 'major');
  const pts = positionNotes(c.key, scale, 1, 3);
  const s4 = pts.filter(p => p.s === 4), s2 = pts.filter(p => p.s === 2);
  if (s4.length < 3 || s2.length < 3) return null;
  const seq = []; for (let i = 0; i < 3; i++) seq.push([4, s4[i].f], [2, s2[i].f]);
  const all = [...seq, ...seq.slice().reverse()];
  return make(c, {
    name: `String skipping: strings 4 and 2 (${keyName(c)})`, domain: 'picking', unit: '8ths', goal: 130, minutes: 4,
    why: 'Wide intervals across a skipped string give lines an angular, modern sound and clean up picking accuracy.',
    instr: 'Alternate picking; the pick jumps over string 3 without touching it. Keep the motion from the wrist, small and quick.',
    watch: 'Clipping string 3 on the way over.', simplify: 'Quarter notes.', tab: { notes: seqNotes(all, 0.5) }
  });
}

/* ----------------------------- Rhythm / chords ----------------------------- */
function voicingFor(name, opts = {}) {
  const c = parseChord(name);
  if (!c) return null;
  if (opts.family) { const list = inversionVoicings(c.root, c.type, opts.family, { set: opts.set || null }); const v = list.find(x => x.minF >= (opts.minFret || 0)) || list[0]; if (v) return { ...v, chord: c.name }; }
  const v = defaultVoicing(c.name);
  return v ? { ...v, chord: c.name } : null;
}

const STRUMS = {
  pop: { slots: 'D.DU.UDU', label: 'D – D U – U D U' },
  folk: { slots: 'D.D.DUDU', label: 'D – D – D U D U' },
  rock8: { slots: 'DUDUDUDU', label: 'straight 8ths, accent beats 2 and 4' },
  punk: { slots: 'DDDDDDDD', label: 'all downstrokes, 8ths' },
  reggae: { slots: '.U.U.U.U', label: 'off-beat chops only' },
  ballad: { slots: 'D..UD.DU', label: 'D – – U D – D U' },
  country: { slots: 'B.D.B.D.', label: 'bass – strum – bass – strum' }
};
export function strumPattern(c, { chords, pattern = 'pop', swing = false, name = null } = {}) {
  const P = STRUMS[pattern] || STRUMS.pop;
  const notes = [], vs = [];
  chords.forEach((nm, bar) => {
    const v = voicingFor(nm); if (!v) return; vs.push(v);
    P.slots.split('').forEach((ch, k) => {
      if (ch === '.') return;
      const t = bar * 4 + k * 0.5;
      if (ch === 'B') { const i = v.frets.findIndex(f => f != null); notes.push(N(6 - i, v.frets[i], t, 0.5)); return; }
      const strings = ch === 'U' ? v.frets.map((f, i) => (i >= 2 ? f : null)) : v.frets;
      strings.forEach((f, i) => { if (f != null) notes.push(N(6 - i, f, t, 0.5, null, { chord: true })); });
    });
  });
  if (!notes.length) return null;
  return make(c, {
    name: name || `${chords.join('–')} strumming (${P.label})`, domain: 'rhythm', unit: swing ? 'swung 8ths' : '8ths', goal: 110, start: 60, minutes: 5, dl: -1,
    why: 'A steady down-up hand with chords that change on the beat is the backbone of accompaniment.',
    instr: `Keep the strumming hand moving down-up in 8ths all the time; only touch the strings where the pattern says (${P.label}). Change chords on the last “&” of the bar.`,
    watch: 'Stopping the hand on the missed strums.', simplify: 'Down-strums on each beat.', voicings: voicingsOf(uniqVoicings(vs)), chords, backing: chords, tab: { notes, swing }
  });
}

export function chordChanges(c, { chords, beats = 2, name = null } = {}) {
  const notes = [], vs = []; let t = 0;
  for (let rep = 0; rep < 2; rep++) chords.forEach(nm => { const v = voicingFor(nm); if (!v) return; if (!rep) vs.push(v); for (let k = 0; k < beats; k++) notes.push(...voicingNotes(v, t + k, 1)); t += beats; });
  if (!notes.length) return null;
  return make(c, {
    name: name || `${chords.join(' – ')} changes`, domain: 'fretting', unit: `${beats} beats per chord`, goal: 100, start: 50, minutes: 5, dl: -1,
    why: 'Changes that land exactly on beat 1 are what make chord parts sound finished.',
    instr: `Strum each chord on every beat, ${beats} beats each. Start moving on the last “&” so the new chord lands on the beat; place the fingers together, not one by one.`,
    watch: 'A gap before each new chord.', simplify: 'Four beats per chord.', voicings: voicingsOf(uniqVoicings(vs)), chords, backing: chords, tab: { notes }
  });
}

export function funkScratch(c, { chord = null } = {}) {
  chord = chord || chordName(c.key, c.minor ? 'm7' : '9');
  const cc = parseChord(chord);
  const v = findVoicings(cc.root, cc.type, { minStrings: 4 }).find(x => x.frets.filter(f => f != null).length <= 4 && x.minF >= 4) || voicingFor(chord);
  if (!v) return null;
  const top4 = { ...v, frets: v.frets.map((f, i) => (f != null && i >= 1 ? f : null)) };
  const pattern = c.lvl >= 6 ? 'x.Cx xCx. C.xC x.Cx' : 'C.x. x.C. C.x. x.C.';
  const hits = [];
  pattern.replace(/\s/g, '').split('').forEach((ch, k) => { if (ch === '.') return; hits.push([k * 0.25, 0.25, ch === 'x' ? 'mute' : null]); });
  return make(c, {
    name: `${chord} 16th-note funk scratch`, domain: 'rhythm', unit: '16ths', goal: 105, start: 70, minutes: 5, picking: 'alternate',
    why: 'Funk rhythm is a constant 16th-note hand: you choose which strokes ring and which are muted scratches.',
    instr: 'Hand never stops: down-up in 16ths. Press the chord only on the C hits; on the x hits relax the fretting hand so the strings are muted (a percussive scratch).',
    watch: 'The strumming hand stopping or changing speed when the chord sounds.', simplify: 'Chord stabs on beats 2 and 4 only, scratches elsewhere.',
    voicings: voicingsOf([top4]), backing: [chord], tab: { notes: chordHits(top4, hits) }
  });
}

/** Power-chord riff over scale degrees with a style rhythm. */
export function powerRiff(c, { degrees = null, rhythm = 'synco', name = null } = {}) {
  degrees = degrees || (c.minor ? [0, 8, 10, 0] : [0, 5, 7, 5]); // semitones from the key root
  const RH = {
    synco: [[0, 0.75], [0.75, 0.75], [1.5, 0.5], [2, 0.75], [2.75, 0.75], [3.5, 0.5]],
    drive: [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]],
    stab: [[0, 1], [1.5, 0.5], [2.5, 0.5], [3, 1]],
    halftime: [[0, 1.5], [1.5, 0.5], [2, 2]]
  }[rhythm] || [];
  const notes = [];
  degrees.forEach((semi, bar) => {
    const pc = mod12(c.key + semi);
    let f = fretOn(6, pc, 0, 11), s = 6;
    if (f == null || f > 9) { f = fretOn(5, pc, 0, 11); s = 5; }
    RH.forEach(([t, d]) => { notes.push(N(s, f, bar * 4 + t, d, null, { chord: true }), N(s - 1, f + 2, bar * 4 + t, d, null, { chord: true })); });
  });
  const names = degrees.map(sm => chordName(mod12(c.key + sm), '5'));
  return make(c, {
    name: name || `${names.join(' – ')} riff (${rhythm === 'synco' ? 'syncopated' : rhythm})`, domain: 'rhythm', unit: rhythm === 'drive' ? '8ths' : 'syncopated 8ths', goal: 130, start: 70, minutes: 5, dl: -1,
    why: 'Power-chord riffs with a tight rhythm are the core of rock writing; the rhythm is the riff.',
    instr: 'Two-note power chords (root + 5th), one shape moved as a unit. Mute with the fretting fingers between hits so the rests are silent.',
    watch: 'Chords ringing into the rests.', simplify: 'Quarter notes on each chord.', chords: names, tab: { notes }
  });
}

export function chugRiff(c, { rhythm = 'gallop' } = {}) {
  const low = mod12(c.key) === 4 ? 0 : fretOn(6, c.key, 0, 7);
  const notes = [];
  for (let b = 0; b < 8; b++) {
    if (rhythm === 'gallop') notes.push(N(6, low, b, 0.5, 'pm'), N(6, low, b + 0.5, 0.25, 'pm'), N(6, low, b + 0.75, 0.25, 'pm'));
    else if (rhythm === '16ths') for (let k = 0; k < 4; k++) notes.push(N(6, low, b + k * 0.25, 0.25, 'pm'));
    else notes.push(N(6, low, b, 0.5, 'pm'), N(6, low, b + 0.5, 0.5, 'pm'));
  }
  // power-chord stabs on the "and" of 4 in each bar
  [3.5, 7.5].forEach(t => { const pc = mod12(c.key + (c.minor ? 3 : 5)); const f = fretOn(6, pc, 1, 10); const i = notes.findIndex(n => Math.abs(n.t - t) < 1e-3); if (i >= 0) notes.splice(i, 1); notes.push(N(6, f, t, 0.5, null, { chord: true }), N(5, f + 2, t, 0.5, null, { chord: true })); });
  notes.sort((a, b) => a.t - b.t);
  return make(c, {
    name: rhythm === 'gallop' ? 'Palm-muted gallop with stabs' : rhythm === '16ths' ? 'Palm-muted 16th chugs' : 'Palm-muted 8th chugs', domain: 'picking',
    unit: rhythm === 'gallop' ? '8th + two 16ths' : rhythm === '16ths' ? '16ths' : '8ths', goal: rhythm === '16ths' ? 120 : 150, start: 80, minutes: 4, picking: rhythm === '8ths' ? 'down' : 'alternate',
    why: 'Tight palm-muted rhythm on the low string is the engine of metal; the open accents are where the riff speaks.',
    instr: 'Palm lightly on the bridge saddles for the PM notes; lift it for the power-chord stabs. Every chug the same volume.',
    watch: 'Chugs getting louder or choked as you speed up.', simplify: 'Straight 8ths, no stabs.', tab: { notes }
  });
}

export function shuffleRiff(c) {
  const degs = [0, 5, 0, 7];
  const notes = [];
  degs.forEach((semi, bar) => {
    const pc = mod12(c.key + semi);
    let s = 6, f = fretOn(6, pc, 0, 7);
    if (f == null || (semi === 5 && fretOn(5, pc, 0, 7) != null)) { s = 5; f = fretOn(5, pc, 0, 7); }
    for (let k = 0; k < 8; k++) { const sixth = k % 4 >= 2; notes.push(N(s, f, bar * 4 + k * 0.5, 0.5, null, { chord: true }), N(s - 1, f + (sixth ? 4 : 2), bar * 4 + k * 0.5, 0.5, null, { chord: true })); }
  });
  const names = degs.map(sm => chordName(mod12(c.key + sm), '7'));
  return make(c, {
    name: `${keyName(c)} boogie shuffle (I–IV–I–V)`, domain: 'rhythm', unit: 'swung 8ths', goal: 120, start: 70, minutes: 5, dl: -1, picking: 'down',
    why: 'The root–5th / root–6th shuffle is the blues rhythm part; the swing feel lives in your picking hand.',
    instr: 'Swing the 8ths (long-short). Root + 5th, then stretch to root + 6th, two of each. Light palm mute on the low strings.',
    watch: 'Straightening the swing as you speed up.', simplify: 'Root + 5th only.', backing: names, tab: { notes, swing: true }
  });
}

export function doubleStopRnR(c) {
  const r = rootFret6(c.key) || 12;
  const notes = [];
  for (let k = 0; k < 6; k++) notes.push(N(2, r, k * 0.5, 0.5, null, { chord: true }), N(1, r, k * 0.5, 0.5, null, { chord: true }));
  notes.push(N(3, r + 2, 3, 0.5, 'b', { bendTo: r + 4 }), N(2, r, 3.5, 0.5));
  for (let k = 0; k < 4; k++) notes.push(N(3, r + 2, 4 + k * 0.5, 0.5, null, { chord: true }), N(2, r + 3, 4 + k * 0.5, 0.5, null, { chord: true }));
  notes.push(N(3, r + 2, 6, 0.5, 'b', { bendTo: r + 4 }), N(3, r, 6.5, 0.5), N(4, r + 2, 7, 1));
  return make(c, {
    name: `Rock ’n’ roll double-stops in ${keyName(c)}`, domain: 'fretting', unit: '8ths', goal: 150, start: 80, minutes: 4,
    why: 'Repeated double-stops on the top strings are the vintage rock lead sound: rhythmic, punchy and in the key.',
    instr: 'One finger barres both strings for the repeated stops. Keep the 8ths driving and land the bend in tune.',
    watch: 'Strings 3 and 4 ringing in: mute them with the fretting finger’s tip.', simplify: 'Bar 1 only, quarter notes.', tab: { notes }
  });
}

export function boomChicka(c, { chords } = {}) {
  const notes = [], vs = [];
  chords.forEach((nm, bar) => {
    const v = voicingFor(nm); if (!v) return; vs.push(v);
    const played = v.frets.map((f, i) => (f == null ? null : i)).filter(i => i != null);
    const b1 = played[0], b2 = played[1] != null && played[1] <= 2 ? played[1] : played[0];
    const top = v.frets.map((f, i) => (f != null && i >= 2 ? f : null));
    notes.push(N(6 - b1, v.frets[b1], bar * 4, 1));
    top.forEach((f, i) => { if (f != null) notes.push(N(6 - i, f, bar * 4 + 1, 1, null, { chord: true })); });
    notes.push(N(6 - b2, v.frets[b2], bar * 4 + 2, 1));
    top.forEach((f, i) => { if (f != null) notes.push(N(6 - i, f, bar * 4 + 3, 1, null, { chord: true })); });
  });
  return make(c, {
    name: `Boom-chicka: ${chords.join(' – ')}`, domain: 'rhythm', unit: 'quarters', goal: 140, start: 70, minutes: 5, dl: -1,
    why: 'Bass note, strum, alternate bass, strum: the country and folk accompaniment pattern.',
    instr: 'Pick the bass note alone on beats 1 and 3 (root, then the next string), brush the top strings on 2 and 4.',
    watch: 'Hitting the whole chord on the bass beats.', simplify: 'Root bass only, no alternate.', voicings: voicingsOf(uniqVoicings(vs)), chords, backing: chords, tab: { notes }
  });
}

export function travisPattern(c, { chords } = {}) {
  const notes = [], vs = [];
  chords.forEach((nm, bar) => {
    const v = voicingFor(nm); if (!v) return; vs.push(v);
    const played = v.frets.map((f, i) => (f == null ? null : i)).filter(i => i != null);
    const b1 = played[0], b2 = played.find(i => i > b1 && i <= 3) != null ? played.find(i => i > b1 && i <= 3) : b1;
    const f2 = v.frets[4] != null ? 4 : 3, f1 = v.frets[5] != null ? 5 : 4, f3 = v.frets[3] != null ? 3 : f2;
    const T = bar * 4;
    [[b1, 0], [f2, 0.5], [b2, 1], [f3, 1.5], [b1, 2], [f2, 2.5], [b2, 3], [f1, 3.5]].forEach(([i, t]) => notes.push(N(6 - i, v.frets[i], T + t, 0.5)));
  });
  return make(c, {
    name: `Travis picking: ${chords.join(' – ')}`, domain: 'picking', unit: '8ths', goal: 110, start: 50, minutes: 6, picking: 'fingers',
    why: 'An alternating thumb bass under finger-picked melody notes: the core of folk and fingerstyle accompaniment.',
    instr: 'Thumb plays the bass on every beat, alternating between the root string and the next one up. Fingers fill the off-beats. Keep the thumb steady even when a finger misses.',
    watch: 'The thumb copying the fingers’ rhythm.', simplify: 'Thumb only for one bar, then add one finger.', voicings: voicingsOf(uniqVoicings(vs)), chords, tab: { notes }
  });
}

export function pimaArpeggio(c, { chords } = {}) {
  const notes = [], vs = [];
  chords.forEach((nm, bar) => {
    const v = voicingFor(nm); if (!v) return; vs.push(v);
    const b = v.frets.findIndex(f => f != null), T = bar * 2;
    [[b, 0], [3, 1 / 3], [4, 2 / 3], [5, 1], [4, 4 / 3], [3, 5 / 3]].forEach(([i, t]) => { if (v.frets[i] != null) notes.push(N(6 - i, v.frets[i], T + t, 1 / 3)); });
  });
  return make(c, {
    name: `p-i-m-a arpeggios: ${chords.join(' – ')}`, domain: 'picking', unit: 'triplets', goal: 100, start: 50, minutes: 5, picking: 'fingers',
    why: 'Classical right-hand independence: thumb on the bass, i-m-a on strings 3-2-1, every note even.',
    instr: 'p (thumb) bass, then i, m, a, m, i. Plant the fingers on their strings before each chord; rest strokes for a full tone.',
    watch: 'Uneven volume between fingers (a is usually weakest).', simplify: 'p-i-m only.', voicings: voicingsOf(uniqVoicings(vs)), chords, tab: { notes }
  });
}

export function rasgueado(c, { chords = null } = {}) {
  chords = chords || ['Am', 'G', 'F', 'E'];
  const notes = [], vs = [];
  chords.forEach((nm, bar) => {
    const v = voicingFor(nm); if (!v) return; vs.push(v);
    const hits = c.lvl >= 6 ? [[0, 0.25], [0.25, 0.25], [0.5, 0.25], [0.75, 0.25], [1, 1], [2, 0.25], [2.25, 0.25], [2.5, 0.25], [2.75, 0.25], [3, 1]] : [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1], [3, 0.5], [3.5, 0.5]];
    notes.push(...chordHits(v, hits.map(([t, d]) => [bar * 4 + t, d])));
  });
  return make(c, {
    name: `Rasgueado over ${chords.join(' – ')}`, domain: 'rhythm', unit: c.lvl >= 6 ? '16ths' : '8ths', goal: 100, start: 60, minutes: 5, picking: 'down',
    why: 'The four-finger rasgueado (e-a-m-i) is the fiery flamenco strum; this Phrygian cadence is the sound of the style.',
    instr: 'Curl the fingers into the palm and flick them out one after another (pinky, ring, middle, index) for each 16th group; the quarter notes are a single index down-stroke.',
    watch: 'Flicks clumping together instead of four distinct hits.', simplify: 'Index finger down-up strums in 8ths.', voicings: voicingsOf(uniqVoicings(vs)), chords, backing: chords, tab: { notes }
  });
}

export function picado(c) {
  const pts = scaleNps(c.key, 'phrygianDominant', Math.max(0, fretOn(6, c.key, 0, 9)), 3);
  if (!pts) return null;
  const top = pts.filter(p => p.s <= 3).sort((a, b) => a.midi - b.midi);
  const seq = [...top, ...top.slice(0, -1).reverse()];
  return make(c, {
    name: `Picado run: ${keyName(c)} Phrygian dominant`, domain: 'picking', unit: c.lvl >= 6 ? '16ths' : '8ths', goal: c.lvl >= 6 ? 100 : 130, minutes: 5, picking: 'strict',
    why: 'Picado is the fast, articulated flamenco scale run played with alternating i-m rest strokes.',
    instr: 'Alternate index and middle fingers (i-m) with rest strokes, or strict alternate picking with a pick. The ♭2 and major 3rd are the Spanish sound.',
    watch: 'Fingers galloping (i-m uneven).', simplify: 'Two strings only.', tab: { notes: seqNotes(seq.map(p => [p.s, p.f]), c.lvl >= 6 ? 0.25 : 0.5) }
  });
}

export function oddMeterRiff(c, { meter = 7 } = {}) {
  const groups = meter === 7 ? [2, 2, 3] : meter === 5 ? [3, 2] : [3, 3, 2];
  const low = mod12(c.key) === 4 ? 0 : fretOn(6, c.key, 0, 7);
  const notes = []; let t = 0;
  for (let bar = 0; bar < 2; bar++) groups.forEach((g, gi) => {
    for (let k = 0; k < g; k++) {
      if (k === 0) { const pc = mod12(c.key + [0, 3, 5, 7][(gi + bar) % 4]); const f = gi === 0 ? low : fretOn(6, pc, 1, 10); notes.push(N(6, f, t, 1, null, { chord: true }), N(5, f + 2, t, 1, null, { chord: true })); }
      else notes.push(N(6, low, t, 1, 'pm'));
      t += 1;
    }
  });
  return make(c, {
    name: `${meter}/8 riff (${groups.join('+')})`, domain: 'rhythm', unit: `8th-note pulse, ${meter}/8 (one click = one 8th)`, goal: 200, start: 110, minutes: 5, dl: 1, beatsPerBar: meter,
    why: 'Odd meters feel natural once you count them as groups of 2s and 3s; the accents tell you where you are.',
    instr: `Count out loud ${groups.map(g => g === 2 ? '1-2' : '1-2-3').join(' ')}. Power chord on the first pulse of each group, palm-muted chugs on the rest. The click is on every 8th note.`,
    watch: 'Adding or dropping a pulse at the end of the bar.', simplify: 'Clap and count it first, then play only the accents.', tab: { notes, beats: meter * 2 }
  });
}

/* ------------------------------ Harmony ------------------------------ */
export function diatonicCycle(c, { sevenths = false } = {}) {
  const dia = diatonicChords(c.key, c.minor ? 'minor' : 'major', sevenths);
  const names = [...dia.map(x => x.name), dia[0].name];
  const vs = voiceLead(names, { family: sevenths ? 'drop2' : 'triad', set: sevenths ? [1, 2, 3, 4] : [2, 3, 4], startFret: Math.max(2, (rootFret6(c.key) || 12) - 2) });
  const notes = []; vs.forEach((v, i) => notes.push(...voicingNotes(v, i * 2, 2)));
  return make(c, {
    name: `Chords of ${keyName(c)} ${c.minor ? 'minor' : 'major'}${sevenths ? ' (7th chords)' : ''}`, domain: 'theory', unit: 'one chord per 2 beats', goal: 100, start: 50, minutes: 5,
    why: 'Every key has seven chords built from its scale; knowing them by number (I, ii, V…) is how players talk and think about songs.',
    instr: `Play up the key: ${dia.map(x => x.roman).join(' – ')}, saying each numeral and its quality out loud. The voicings stay in one area of the neck.`,
    watch: 'Mixing up which chords are minor.', simplify: 'Only I, IV and V.', voicings: voicingsOf(vs), chords: names, tab: { notes }
  });
}

export function triadProgression(c, { chords, set = [3, 4, 5], arpeggio = false } = {}) {
  const vs = voiceLead(chords, { family: 'triad', set, startFret: 5 });
  const notes = [];
  vs.forEach((v, bar) => {
    if (arpeggio) { const idx = v.frets.map((f, i) => (f == null ? null : i)).filter(i => i != null); [...idx, ...idx.slice(1, -1).reverse(), idx[0], idx[1]].slice(0, 8).forEach((i, k) => notes.push(N(6 - i, v.frets[i], bar * 4 + k * 0.5, 0.5))); }
    else notes.push(...voicingNotes(v, bar * 4, 2), ...voicingNotes(v, bar * 4 + 2, 2));
  });
  return make(c, {
    name: `${chords.join(' – ')} with triad inversions (${set.map(i => 6 - i).sort().join('-')})`, domain: 'fretboard', unit: arpeggio ? '8ths' : 'half notes', goal: 110, start: 60, minutes: 5,
    why: 'Inversions let you play a progression without jumping around: each chord moves to the nearest shape.',
    instr: 'Notice how each chord keeps or moves only a fret or two from the last one. Say which inversion you’re on (root, 1st, 2nd).',
    watch: 'Jumping back to root-position shapes out of habit.', simplify: 'Two chords only.', voicings: voicingsOf(vs), chords, backing: chords, tab: { notes }
  });
}

export function drop2Comp(c, { chords, set = [1, 2, 3, 4] } = {}) {
  const vs = voiceLead(chords, { family: 'drop2', set, startFret: 5 });
  const notes = []; vs.forEach((v, bar) => notes.push(...voicingNotes(v, bar * 4, 1.5), ...voicingNotes(v, bar * 4 + 1.5, 0.5)));
  return make(c, {
    name: `${chords.join(' – ')} in drop-2 voicings`, domain: 'theory', unit: 'Charleston rhythm (1, &2)', goal: 120, start: 60, minutes: 6, dl: 1,
    why: 'Drop-2 voicings voice-led through a progression are how jazz and neo-soul players comp with smooth inner voices.',
    instr: 'Hit each chord on beat 1 and the “&” of 2 (the Charleston rhythm). Each new chord is the closest inversion: watch which voices move and which stay.',
    watch: 'Big jumps between chords: pick the nearest inversion instead.', simplify: 'Whole notes, one chord per bar.', voicings: voicingsOf(vs), chords, backing: chords, tab: { notes }
  });
}

export function shellComp(c, { chords } = {}) {
  const vs = voiceLead(chords, { family: 'shell', startFret: 5 });
  const notes = []; vs.forEach((v, bar) => notes.push(...voicingNotes(v, bar * 4, 1.5), ...voicingNotes(v, bar * 4 + 1.5, 2.5)));
  return make(c, {
    name: `Shell voicings: ${chords.join(' – ')}`, domain: 'theory', unit: 'Charleston rhythm', goal: 140, start: 70, minutes: 5,
    why: 'Root, 3rd and 7th are the whole identity of a chord; shells are the first comping grips every jazz guitarist learns.',
    instr: 'Root on string 6 or 5, 3rd and 7th on the middle strings. Mute everything else. Play beat 1 and the “&” of 2.',
    watch: 'Letting open strings ring.', simplify: 'Whole notes.', voicings: voicingsOf(vs), chords, backing: chords, tab: { notes }
  });
}

export function guideTones(c, { chords } = {}) {
  let prev = null; const notes = [];
  chords.forEach((nm, bar) => {
    const cc = parseChord(nm); if (!cc) return;
    const tones = chordTones(cc.root, cc.type).filter(x => /3|7/.test(x.label) && x.label !== 'R');
    tones.slice(0, 2).forEach((tn, k) => {
      let best = null, bd = 99;
      for (const s of [2, 3, 4]) for (let f = 3; f <= 12; f++) if (mod12(OPEN[s] + f) === tn.pc) { const m = OPEN[s] + f, d = prev == null ? Math.abs(f - 6) : Math.abs(m - prev); if (d < bd) { bd = d; best = [s, f, m]; } }
      if (best) { notes.push(N(best[0], best[1], bar * 4 + k * 2, 2)); prev = best[2]; }
    });
  });
  return make(c, {
    name: `Guide-tone line: ${chords.join(' – ')}`, domain: 'improv', unit: 'half notes', goal: 120, start: 60, minutes: 5, dl: 1,
    why: 'The 3rds and 7ths are what define each chord; connecting them smoothly is the skeleton of every good solo over changes.',
    instr: 'Play the 3rd then the 7th of each chord (or 7th then 3rd), always moving to the nearest one. Then improvise around this line over the backing.',
    watch: 'Big leaps between guide tones.', simplify: 'Only the 3rd of each chord, on beat 1.', chords, backing: chords, tab: { notes }
  });
}

export function embellish(c, { chords } = {}) {
  const vs = voiceLead(chords, { family: 'triad', set: [3, 4, 5], startFret: 5 });
  const notes = [];
  vs.forEach((v, bar) => {
    const T = bar * 4, top = v.frets[5], below = v.frets.map((f, i) => (i < 5 ? f : null));
    notes.push(...below.map((f, i) => (f == null ? null : N(6 - i, f, T, 2, null, { chord: true }))).filter(Boolean));
    if (top >= 2) notes.push(N(1, top - 2, T, 0.5, null, { chord: true }), N(1, top, T + 0.5, 1.5, 'h'));
    else notes.push(N(1, top, T, 2, null, { chord: true }));
    notes.push(N(2, v.frets[4], T + 2, 0.5), N(1, top, T + 2.5, 0.5), N(2, v.frets[4], T + 3, 0.5), N(3, v.frets[3], T + 3.5, 0.5));
  });
  return make(c, {
    name: `Hammer-on embellishments: ${chords.join(' – ')}`, domain: 'fretting', unit: '8ths', goal: 90, start: 50, minutes: 5,
    why: 'Neo-soul and R&B players decorate chords with hammer-ons from a step below: the chord sings like a melody.',
    instr: 'Strike the chord with the top note a whole step low, hammer up to the chord tone, then pick a short melody across the top of the shape.',
    watch: 'The hammered note dying out; hammer firmly from close to the fret.', simplify: 'Chord and hammer only, no melody.', voicings: voicingsOf(vs), chords, backing: chords, tab: { notes }
  });
}

export function openDrone(c, { chords } = {}) {
  const vs = voiceLead(chords, { family: 'triad', set: [1, 2, 3], startFret: 4 });
  const notes = [];
  vs.forEach((v, bar) => {
    const idx = [1, 2, 3].filter(i => v.frets[i] != null);
    const pat = [idx[0], idx[1], idx[2], 'e', idx[2], 'B', idx[1], 'e'];
    pat.forEach((i, k) => { if (i === 'e') notes.push(N(1, 0, bar * 4 + k * 0.5, 0.5)); else if (i === 'B') notes.push(N(2, 0, bar * 4 + k * 0.5, 0.5)); else notes.push(N(6 - i, v.frets[i], bar * 4 + k * 0.5, 0.5)); });
  });
  return make(c, {
    name: `Moving shapes over open strings: ${chords.join(' – ')}`, domain: 'picking', unit: '8ths', goal: 130, start: 70, minutes: 5,
    why: 'Fretted shapes moving against ringing open B and e strings give indie and alt-rock parts their shimmer.',
    instr: 'Arpeggiate the fretted shape on strings 5-4-3 and let the open B and e ring between them. Let everything sustain.',
    watch: 'Fretting fingers touching the open strings and muting them.', simplify: 'Two chords only.', voicings: voicingsOf(vs), chords, tab: { notes }
  });
}

export function chordMelody(c) {
  const dia = diatonicChords(c.key, 'major', false);
  const map = { 1: 0, 2: 4, 3: 0, 4: 3, 5: 0, 6: 3, 7: 4, 8: 0 };
  const scale = SCALE_BY_ID.major.steps;
  let prev = null; const notes = [], vs = [];
  [1, 2, 3, 4, 5, 6, 7, 8].forEach((deg, i) => {
    const melPc = mod12(c.key + scale[(deg - 1) % 7]);
    const ch = dia[map[deg]];
    const cands = inversionVoicings(ch.root, ch.type, 'triad', { set: [3, 4, 5] }).filter(v => mod12(OPEN[1] + v.frets[5]) === melPc);
    let v = null, bd = 99; for (const x of cands) { const d = prev ? Math.abs(x.minF - prev.minF) : Math.abs(x.minF - 5); if (d < bd) { bd = d; v = x; } }
    if (!v) return; prev = v; vs.push({ ...v, chord: ch.name });
    notes.push(...voicingNotes(v, i * 2, 2));
  });
  return make(c, {
    name: `Chord-melody: harmonize the ${keyName(c)} major scale`, domain: 'theory', unit: 'half notes', goal: 90, start: 50, minutes: 6, dl: 1,
    why: 'Chord-melody puts the melody on top of the chord; this harmonized scale is the first step to arranging tunes.',
    instr: 'The top note of each voicing is the scale; the chord under it changes (I, V, I, IV…). Let the top note ring loudest.',
    watch: 'Melody note buried under the chord.', simplify: 'Play only the top two strings.', voicings: voicingsOf(uniqVoicings(vs)), tab: { notes }
  });
}

export function percussiveGroove(c) {
  const r6 = mod12(c.key) === 4 ? 0 : fretOn(6, c.key, 0, 7);
  const v = voicingFor(chordName(c.key, c.minor ? 'min' : 'maj'));
  const notes = [];
  for (let bar = 0; bar < 2; bar++) {
    const T = bar * 4;
    notes.push(N(6, r6, T, 1));
    [3, 2, 1].forEach(s => { const i = 6 - s; if (v && v.frets[i] != null) notes.push(N(s, v.frets[i], T + 1, 1, 'mute', { chord: true })); });
    notes.push(N(6, r6, T + 2, 0.5), N(2, v ? v.frets[4] || 0 : 0, T + 2.5, 0.5));
    [3, 2, 1].forEach(s => { const i = 6 - s; if (v && v.frets[i] != null) notes.push(N(s, v.frets[i], T + 3, 1, 'mute', { chord: true })); });
  }
  return make(c, {
    name: 'Thumb bass with percussive slaps', domain: 'picking', unit: 'quarters', goal: 110, start: 60, minutes: 5, picking: 'fingers',
    why: 'Modern fingerstyle turns the guitar into a band: thumb bass, a slap “snare” on 2 and 4, melody on top.',
    instr: 'Thumb on the low root. On beats 2 and 4, slap the strings with the side of the thumb/palm (the x hits): a muted, snare-like crack. Melody note on the “&” of 3.',
    watch: 'The bass note dying when you slap; keep the thumb steady.', simplify: 'Bass and slap only.', tab: { notes }
  });
}

/* ----------------------------- Improvisation ----------------------------- */
export function callResponse(c, { scale = null, chords = null } = {}) {
  scale = scale || (c.minor ? 'minorPent' : 'majorPent');
  const pts = positionNotes(c.key, scale, 1);
  if (!pts.length) return null;
  const rootIdx = pts.findIndex(p => mod12(p.midi - c.key) === 0 && p.s <= 4);
  const i0 = rootIdx >= 0 ? rootIdx : 4;
  const pick = k => pts[Math.max(0, Math.min(pts.length - 1, i0 + k))];
  const call = [[pick(0), 0, 0.5], [pick(1), 0.5, 0.5], [pick(2), 1, 1], [pick(1), 2, 0.5], [pick(0), 2.5, 1.5]];
  const notes = call.map(([p, t, d]) => N(p.s, p.f, t, d));
  return make(c, {
    name: `Call and response in ${keyName(c)}`, domain: 'improv', unit: 'phrases', goal: 100, start: 70, minutes: 6, backing: chords,
    why: 'Phrasing like a conversation (a question, then an answer) is what makes a solo sound like music instead of scales.',
    instr: 'Bar 1: play the written call. Bar 2: answer it with your own phrase from the same box, ending on the root. Then make up both call and answer over the loop.',
    watch: 'Filling every beat: leave space.', simplify: 'Answer with only three notes.', tab: { notes, beats: 8 }
  });
}

export function targetSolo(c, { chords, scale = null, name = null } = {}) {
  scale = scale || (c.minor ? 'minorPent' : 'majorPent');
  return make(c, {
    name: name || `Solo over ${chords.join(' – ')}: land on chord tones`, domain: 'improv', unit: 'phrases', goal: 110, start: 70, minutes: 6, backing: chords, chords,
    why: 'Landing on a chord tone at each change makes a solo follow the harmony.',
    instr: `Improvise with the ${keyName(c)} ${SCALE_BY_ID[scale].name.toLowerCase()}. On beat 1 of each new chord, land on its root or 3rd; use space between phrases and repeat ideas before changing them.`,
    watch: 'Running the scale up and down without phrasing.', simplify: 'Whole notes: only the target notes, in time.'
  });
}

export function earKey(c, { chords }) {
  return make(c, {
    name: 'Find the key by ear', domain: 'ear', unit: 'over the loop', goal: 100, start: 70, minutes: 4, backing: chords,
    why: 'Hearing the home note of a progression is the first step to playing along with anything.',
    instr: 'Don’t look at the chord names. Over the loop, hum the note that feels like “home”, find it on the low E string, then check it against the first chord.',
    watch: 'Guessing from the first chord instead of listening for the resolution.', simplify: 'Play single notes on one string until one sounds like home.'
  });
}

export function echoPhrases(c, { chords, scale = null } = {}) {
  scale = scale || (c.minor ? 'minorPent' : 'majorPent');
  return make(c, {
    name: 'Echo phrases by ear', domain: 'ear', unit: '2-bar phrases', goal: 100, start: 60, minutes: 4, backing: chords,
    why: 'Copying short phrases in time is the fastest way to play what you hear.',
    instr: `Hum a 2-bar phrase over the loop, then find it on the neck in the next 2 bars, inside the ${keyName(c)} ${SCALE_BY_ID[scale].name.toLowerCase()}. Start with 3-note phrases.`,
    watch: 'Stopping the loop to search; keep it going.', simplify: '2-note phrases: the root plus one note.'
  });
}

export function subdivisionLadder(c, { feel = 'straight' } = {}) {
  return make(c, {
    name: feel === 'swing' ? 'Swing feel ladder' : 'Subdivision ladder', domain: 'rhythm', unit: 'quarters → 16ths', goal: 100, start: 60, minutes: 4, dl: -1,
    why: 'Switching subdivisions on demand builds the internal grid every style needs.',
    instr: feel === 'swing' ? 'Muted strums: one bar of quarters, one of straight 8ths, one of swung 8ths (long-short), one of triplets. Repeat without stopping.' : 'Muted strums: one bar each of quarters, 8ths, triplets and 16ths, then back down without stopping.',
    watch: 'Triplets drifting into a dotted feel.', simplify: 'Quarters ↔ 8ths only.', metroMode: 'all'
  });
}

export function gapClick(c, { chords }) {
  return make(c, {
    name: 'Gap click: keep the time yourself', domain: 'rhythm', unit: 'the click drops out', goal: 110, start: 70, minutes: 4, metroMode: 'gap', chords,
    why: 'When the click disappears for two bars, only your internal clock keeps you in time.',
    instr: 'Play the progression in steady 8ths. The click plays 2 bars and goes silent for 2: you should land exactly with it when it comes back.',
    watch: 'Rushing in the silent bars.', simplify: 'Quarter-note strums.'
  });
}

/* --------------------------- Chord vocabulary --------------------------- */
const TYPE_WORD = { maj7: 'major 7th', '7': 'dominant 7th', m7: 'minor 7th', m7b5: 'half-diminished (m7♭5)', dim7: 'diminished 7th', mmaj7: 'minor-major 7th', maj: 'major', min: 'minor', dim: 'diminished', aug: 'augmented', '6': '6th', m6: 'minor 6th', '9': '9th', m9: 'minor 9th', maj9: 'major 9th', sus2: 'sus2', sus4: 'sus4', add9: 'add9', '13': '13th', '7sus4': '7sus4' };
const INV = ['root position', '1st inversion', '2nd inversion', '3rd inversion'];
const setWord = set => `strings ${set.map(i => 6 - i).sort((a, b) => a - b).join('–').replace(/^(\d)–(?:\d–)*(\d)$/, '$1–$2')}`;

/** Same root, different qualities (e.g. Cmaj7 → C7 → Cm7 → Cm7♭5) in one voicing family. */
export function qualityCycle(c, { types = ['maj7', '7', 'm7', 'm7b5'], family = 'drop2', set = [1, 2, 3, 4], root = null } = {}) {
  root = root == null ? c.key : root;
  const vs = [];
  for (const t of types) {
    const fam = family === 'drop2' && ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'].includes(t) ? 'triad' : family;
    const st = fam === 'triad' ? [2, 3, 4] : set;
    const list = fam === 'full' ? findVoicings(root, t) : inversionVoicings(root, t, fam, { set: st });
    const v = list.filter(x => x.inversion === 0).sort((a, b) => Math.abs(a.minF - 5) - Math.abs(b.minF - 5))[0] || list[0];
    if (v) vs.push({ ...v, chord: chordName(root, t) });
  }
  if (vs.length < 2) return null;
  const notes = []; vs.forEach((v, i) => notes.push(...voicingNotes(v, i * 2, 2))); vs.slice().reverse().forEach((v, i) => notes.push(...voicingNotes(v, vs.length * 2 + i * 2, 2)));
  return make(c, {
    name: `${vs.map(v => v.chord).join(' → ')}: hear the qualities`, domain: 'theory', unit: '2 beats per chord', goal: 90, start: 50, minutes: 5,
    why: `Moving one root through ${types.map(t => TYPE_WORD[t] || t).join(', ')} shows exactly which note changes between chord qualities, so you hear and see the difference.`,
    instr: `Play each voicing for 2 beats (one root, ${family === 'full' ? 'full shapes' : setWord(set)}). Before each change, say which interval moves: 7 → ♭7 → ♭3 → ♭5. Listen for the color change.`,
    watch: 'Moving fingers that don’t need to move: only one or two notes change each time.', simplify: 'Just the first two qualities.',
    voicings: voicingsOf(vs), chords: vs.map(v => v.chord), tab: { notes }
  });
}

/** One chord through all its inversions on a string set, up the neck and back. */
export function inversionCycle(c, { type = 'maj7', family = null, set = null, root = null } = {}) {
  root = root == null ? c.key : root;
  const nTones = (['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'].includes(type)) ? 3 : 4;
  family = family || (nTones === 3 ? 'triad' : 'drop2');
  set = set || (family === 'triad' ? [3, 4, 5] : family === 'drop3' ? [0, 2, 3, 4] : [2, 3, 4, 5]);
  const list = inversionVoicings(root, type, family, { set }).filter(v => v.minF <= 15);
  if (list.length < 2) return null;
  // start from the lowest voicing and walk up through every inversion once (plus the octave of the first)
  const up = list.slice(0, nTones + 1);
  const seq = [...up, ...up.slice(0, -1).reverse()];
  const notes = []; seq.forEach((v, i) => notes.push(...voicingNotes(v, i * 2, 2)));
  const nm = chordName(root, type);
  return make(c, {
    name: `${nm} inversions on ${setWord(set)} (${family === 'triad' ? 'triads' : family === 'drop2' ? 'drop 2' : family === 'drop3' ? 'drop 3' : family})`, domain: 'fretboard', unit: '2 beats per voicing', goal: 90, start: 50, minutes: 6,
    why: `Each inversion puts a different chord tone in the bass and on top. Knowing every inversion of ${nm} on one string set lets you play it anywhere on the neck and move to the next chord with the smallest jump.`,
    instr: `Climb the neck: ${up.map(v => INV[v.inversion] || 'voicing').join(' → ')}, then back down. Name the bass note of each voicing (the chord tone in the bass tells you which inversion it is) and keep the same four strings.`,
    watch: 'Losing track of which note is the root: find it in every shape before moving on.', simplify: 'Only root position and 1st inversion.',
    voicings: voicingsOf(up), chords: [nm], tab: { notes }
  });
}

/** The CAGED / movable shapes of one chord across the neck. */
export function shapesAcrossNeck(c, { type = 'maj', root = null } = {}) {
  root = root == null ? c.key : root;
  const vs = findVoicings(root, type, { limit: 6 }).slice(0, 5);
  if (vs.length < 2) return null;
  const notes = []; vs.forEach((v, i) => notes.push(...voicingNotes(v, i * 2, 2)));
  const nm = chordName(root, type);
  return make(c, {
    name: `${nm} shapes across the neck`, domain: 'fretboard', unit: '2 beats per shape', goal: 80, start: 45, minutes: 5,
    why: 'The same chord lives in five places (the CAGED shapes); linking them is how you stop getting stuck in one position.',
    instr: `Play each ${nm} shape low to high, 2 beats each. Find the root in each shape first; notice how each shape overlaps the next one up.`,
    watch: 'Muddy barres: roll the index finger slightly onto its side.', simplify: 'Only the first three shapes.',
    voicings: voicingsOf(vs), chords: [nm], tab: { notes }
  });
}

/** Two-octave arpeggio of a chord type in one position. */
export function arpeggioBox(c, { type = null, root = null } = {}) {
  root = root == null ? c.key : root;
  type = type || (c.minor ? 'm7' : 'maj7');
  const tones = chordTones(root, type).map(x => x.semis % 12);
  const r = fretOn(6, root, 2, 13);
  const notes = []; let t = 0;
  const pts = [];
  for (let s = 6; s >= 1; s--) for (let f = Math.max(0, r - 1); f <= r + 3; f++) if (tones.includes(mod12(OPEN[s] + f - root))) pts.push({ s, f, m: OPEN[s] + f });
  const seen = new Set(); const up = pts.sort((a, b) => a.m - b.m).filter(p => (seen.has(p.m) ? false : seen.add(p.m)));
  [...up, ...up.slice(0, -1).reverse()].forEach(p => { notes.push(N(p.s, p.f, t, 0.5)); t += 0.5; });
  if (notes.length < 6) return null;
  const nm = chordName(root, type);
  return make(c, {
    name: `${nm} arpeggio, two octaves`, domain: 'fretboard', unit: '8ths', goal: 120, start: 60, minutes: 4,
    why: `An arpeggio is the chord played one note at a time; knowing ${nm}'s tones in a position is what lets you outline the chord when you solo.`,
    instr: 'Up and down in 8ths, one finger per fret. Say the chord tone (1, 3, 5, 7) as you play each note.',
    watch: 'Two notes on the same fret across strings ringing together: roll the finger.', simplify: 'One octave only.', chords: [nm], tab: { notes }
  });
}

export const ATOMS = {
  scaleRun, connectPositions, noteFinder, intervalShapes, modeCompare, bendLick, vibratoHolds, doubleStops, legatoRun, sweepArp, tapLick, speedBurst, stringSkip,
  strumPattern, chordChanges, funkScratch, powerRiff, chugRiff, shuffleRiff, doubleStopRnR, boomChicka, travisPattern, pimaArpeggio, rasgueado, picado, oddMeterRiff,
  diatonicCycle, triadProgression, drop2Comp, shellComp, guideTones, embellish, openDrone, chordMelody, percussiveGroove, callResponse, targetSolo, earKey, echoPhrases,
  subdivisionLadder, gapClick, qualityCycle, inversionCycle, shapesAcrossNeck, arpeggioBox
};
export { intervalFamily };
