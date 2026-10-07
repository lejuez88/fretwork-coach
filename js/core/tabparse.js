// ASCII tab importer. Turns the common 6-line text tab format into timed notes:
//   e|-----0-----|-----------|
//   B|---1---1---|-----3-----|
//   ...
// Bars come from the "|" lines; rhythm isn't written in ASCII tab, so each note's
// position inside its bar is taken from its column and snapped to a 16th (or
// triplet) grid. Techniques (h p b r / \ ~ x) and alternate tunings are kept.

const STD = [64, 59, 55, 50, 45, 40];          // string 1 (high e) … string 6 (low E)
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const STRING_LINE = /^\s*([A-Ga-g][#b♯♭]?)?\s*[|:]?\s*([-–—0-9a-z/\\~^|().*<>=\s]*[-–—][-–—0-9a-z/\\~^|().*<>=\s]*)$/;

function labelMidi(label, ref) {
  if (!label) return ref;
  const L = label[0].toUpperCase(); if (!(L in PC)) return ref;
  let pc = PC[L] + (/[#♯]/.test(label) ? 1 : /[b♭]/.test(label.slice(1)) ? -1 : 0);
  pc = ((pc % 12) + 12) % 12;
  // nearest MIDI with this pitch class to the standard string pitch
  let best = ref, bd = 99;
  for (let m = ref - 7; m <= ref + 7; m++) if (((m % 12) + 12) % 12 === pc && Math.abs(m - ref) < bd) { bd = Math.abs(m - ref); best = m; }
  return best;
}

/** Find blocks of 6 consecutive tab lines. */
function findBlocks(lines) {
  const isTab = l => { const t = l.replace(/\s+$/, ''); return (t.match(/[-–—]/g) || []).length >= 4 && STRING_LINE.test(t); };
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isTab(lines[i])) continue;
    let j = i; while (j < lines.length && isTab(lines[j])) j++;
    const n = j - i;
    if (n >= 6) for (let k = i; k + 6 <= j; k += 6) blocks.push(lines.slice(k, k + 6));
    i = j - 1;
  }
  return blocks;
}

/** Strip "e|" prefixes and line up the 6 rows; returns {labels, rows}. */
function normalizeBlock(block) {
  const labels = [], rows = [];
  for (const raw of block) {
    const l = raw.replace(/[–—]/g, '-').replace(/\s+$/, '');
    const m = l.match(/^\s*([A-Ga-g][#b♯♭]?)?\s*([|:]?)/);
    labels.push(m && m[1] ? m[1] : null);
    let body = l.slice(m ? m[0].length : 0);
    rows.push(body);
  }
  // Align on the first "|" or "-" so rows with different prefix widths still line up
  const w = Math.max(...rows.map(r => r.length));
  return { labels, rows: rows.map(r => r.padEnd(w, '-')) };
}

const TECH = { h: 'h', p: 'p', b: 'b', r: 'r', '/': '/', '\\': '\\', '~': '~', x: 'x', s: '/', v: '~' };

function parseBlock({ rows }) {
  const w = rows[0].length;
  // bar lines: columns where at least 4 of 6 rows have "|"
  const barCols = [];
  for (let c = 0; c < w; c++) { let k = 0; for (const r of rows) if (r[c] === '|') k++; if (k >= 4) barCols.push(c); }
  if (!barCols.length || barCols[0] > 1) barCols.unshift(-1);
  if (barCols[barCols.length - 1] < w - 2) barCols.push(w);
  // notes per row
  const notes = [];
  rows.forEach((r, si) => {
    for (let c = 0; c < r.length; c++) {
      const ch = r[c];
      if (/[0-9]/.test(ch)) {
        let num = ch, c2 = c + 1;
        if (/[0-9]/.test(r[c2] || '') && Number(ch + r[c2]) <= 24) { num += r[c2]; c2++; }
        const f = Number(num);
        let x = null, bendTo = null;
        const after = r[c2], digitNext = /[0-9]/.test(r[c2 + 1] || '');
        // Connectors (h p / \ s) belong to the note that follows them: "7h9" = pick 7, hammer 9.
        if (c > 0 && 'hp/\\s'.includes(r[c - 1]) && /[0-9]/.test(r[c - 2] || '')) x = TECH[r[c - 1]];
        if (after === 'b' || after === 'r') {
          // "7b9" is one bent note (target pitch 9), "7b9r7" bends and releases
          x = 'b';
          let c3 = c2 + 1, tgt = '';
          while (/[0-9]/.test(r[c3] || '') && tgt.length < 2) tgt += r[c3++];
          if (tgt) bendTo = Number(tgt);
          if (r[c3] === 'r') { c3++; while (/[0-9]/.test(r[c3] || '')) c3++; }
          c2 = c3;
        } else if (after === '~' || after === 'v') { x = x || '~'; c2++; }
        else if (after && 'hp/\\s'.includes(after) && !digitNext) x = x || TECH[after];   // slide/legato into nothing
        if (!x && c > 0 && r[c - 1] === '(') x = 'ghost';
        notes.push({ s: si + 1, f, col: c, x, ...(bendTo != null ? { bendTo } : {}) });
        c = c2 - 1;
      } else if (ch === 'x' || ch === 'X') {
        if ((r[c - 1] === '-' || r[c - 1] === '|' || c === 0) && (r[c + 1] === '-' || r[c + 1] === '|' || c + 1 >= r.length)) notes.push({ s: si + 1, f: 0, col: c, x: 'mute' });
      }
    }
  });
  // split into bars
  const bars = [];
  for (let b = 0; b < barCols.length - 1; b++) {
    const a = barCols[b], z = barCols[b + 1];
    const inBar = notes.filter(n => n.col > a && n.col < z);
    if (z - a < 3) continue;
    bars.push({ start: a + 1, end: z, notes: inBar });
  }
  return bars;
}

/**
 * Parse tab text. opts: {beatsPerBar=4, grid: 'auto'|'8'|'16'|'triplet'}
 * Returns {bars:[{index, notes:[{t,d,s,f,x,chord}] (t relative to bar)}], notes (absolute), tuning, totalBeats, warnings}
 */
export function parseTab(text, { beatsPerBar = 4, grid = 'auto' } = {}) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const blocks = findBlocks(lines);
  const warnings = [];
  if (!blocks.length) return { bars: [], notes: [], tuning: STD.slice(), totalBeats: 0, warnings: ['No 6-line guitar tab found. Paste the tab including all six string lines.'] };
  const first = normalizeBlock(blocks[0]);
  const tuning = STD.map((m, i) => labelMidi(first.labels[i], m));
  const rawBars = [];
  for (const b of blocks) rawBars.push(...parseBlock(normalizeBlock(b)));
  // Rhythm from spacing: the most common gap between notes is one grid step; the bar's
  // width divided by that step gives the subdivision (8ths, 16ths, triplets…).
  const STEP_OPTIONS = [4, 6, 8, 12, 16, 24, 32];
  const mode = arr => { const m = new Map(); arr.forEach(v => m.set(v, (m.get(v) || 0) + 1)); let best = null, bc = 0; for (const [v, c] of m) if (c > bc || (c === bc && v < best)) { best = v; bc = c; } return best; };
  const allGaps = [];
  const leads = [];
  for (const rb of rawBars) {
    const cols = [...new Set(rb.notes.map(n => n.col))].sort((a, b) => a - b);
    for (let i = 1; i < cols.length; i++) allGaps.push(cols[i] - cols[i - 1]);
    if (cols.length) leads.push(cols[0] - rb.start);
  }
  const globalGap = Math.max(1, mode(allGaps.filter(g => g >= 1 && g <= 8)) || 2);
  const lead = Math.min(2, Math.max(0, leads.length ? Math.min(...leads) : 1));
  // Place sorted offsets (in grid steps) on whole steps: keep order, never share a step,
  // never run past the bar. Returns null when the notes don't fit.
  const place = (offs, steps) => {
    if (offs.length > steps) return null;
    const ks = [];
    offs.forEach((o, i) => { ks.push(Math.max(0, Math.round(o), i ? ks[i - 1] + 1 : 0)); });
    if (ks.length && ks[ks.length - 1] >= steps) {
      ks[ks.length - 1] = steps - 1;
      for (let i = ks.length - 2; i >= 0; i--) ks[i] = Math.min(ks[i], ks[i + 1] - 1);
      if (ks[0] < 0) return null;
    }
    return ks;
  };
  const bars = [];
  for (const rb of rawBars) {
    const cols = [...new Set(rb.notes.map(n => n.col))].sort((a, b) => a - b);
    const gaps = []; for (let i = 1; i < cols.length; i++) gaps.push(cols[i] - cols[i - 1]);
    const gap = gaps.length >= 3 ? Math.max(1, mode(gaps.filter(g => g >= 1 && g <= 8)) || globalGap) : globalGap;
    const usable = Math.max(1, rb.end - rb.start - lead);
    const offs = cols.map(c => Math.max(0, c - rb.start - lead));
    let steps, ks = null;
    const forced = grid === 'triplet' ? [6, 12, 24] : grid === '16' ? [16, 32] : grid === '8' ? [8, 16, 32] : null;
    if (forced) {
      // fixed grid: spread the bar's width over the grid
      for (const s of forced) { const r = place(offs.map(o => (o / usable) * s), s); if (r && (s >= usable / gap - 0.5 || s === forced[forced.length - 1])) { steps = s; ks = r; break; } if (r && !ks) { steps = s; ks = r; } }
    } else {
      // even spacing in the tab = even notes; bar width / spacing = subdivision
      const raw = usable / gap;
      steps = STEP_OPTIONS.reduce((b, o) => (Math.abs(o - raw) < Math.abs(b - raw) ? o : b), 8);
      const need = Math.max(...offs.map(o => Math.round(o / gap)), 0) + 1;
      if (need > steps) steps = STEP_OPTIONS.find(o => o >= need) || 32;   // notes spill past the bar: use a finer grid
      ks = place(offs.map(o => o / gap), steps);
      if (!ks) ks = place(offs.map(o => (o / usable) * 32), (steps = 32));
    }
    if (!ks) { warnings.push(`Bar ${bars.length + 1} has more notes than the grid can hold; some were merged.`); steps = 32; ks = offs.map(o => Math.min(31, Math.round((o / usable) * 32))); }
    const stepBeats = beatsPerBar / steps;
    const snapped = new Map();
    cols.forEach((c, i) => snapped.set(c, Math.round(ks[i] * stepBeats * 1000) / 1000));
    const times = [...new Set(snapped.values())].sort((a, b) => a - b);
    const notes = rb.notes.map(n => {
      const t = snapped.get(n.col), next = times.find(v => v > t);
      const chordSize = rb.notes.filter(m => m.col === n.col).length;
      return { t, d: Math.round(((next == null ? beatsPerBar : next) - t) * 1000) / 1000, s: n.s, f: n.f, ...(n.x ? { x: n.x } : {}), ...(n.bendTo != null ? { bendTo: n.bendTo } : {}), ...(chordSize > 1 ? { chord: true } : {}) };
    }).sort((a, b) => a.t - b.t || a.s - b.s);
    bars.push({ index: bars.length + 1, notes, grid: steps % 3 === 0 ? 3 : 4, steps });
  }
  // drop empty leading/trailing bars
  while (bars.length && !bars[0].notes.length) bars.shift();
  while (bars.length && !bars[bars.length - 1].notes.length) bars.pop();
  bars.forEach((b, i) => { b.index = i + 1; });
  if (!bars.length) warnings.push('Tab lines were found but no notes could be read.');
  if (bars.some(b => b.notes.some(n => n.x === 'mute'))) warnings.push('Muted strokes (x) are kept as percussive hits.');
  const notes = bars.flatMap((b, i) => b.notes.filter(n => n.x !== 'mute').map(n => ({ ...n, t: n.t + i * beatsPerBar })));
  return { bars, notes, tuning, totalBeats: bars.length * beatsPerBar, warnings, beatsPerBar };
}

/** Notes for bars from..to (1-based, inclusive), re-based to start at beat 0. */
export function sliceBars(parsed, from, to) {
  const bpb = parsed.beatsPerBar || 4;
  const a = Math.max(1, from), z = Math.min(parsed.bars.length, to);
  const out = [];
  for (let i = a; i <= z; i++) for (const n of parsed.bars[i - 1].notes) if (n.x !== 'mute') out.push({ ...n, t: n.t + (i - a) * bpb });
  return out;
}

/** Plain-text rendering of selected bars (for sending a section to Claude). */
export function barsToText(parsed, from, to) {
  const names = parsed.tuning.map(m => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][((m % 12) + 12) % 12]);
  const rows = names.map((n, i) => (i === 0 ? n.toLowerCase() : n).padEnd(2) + '|');
  for (let i = from; i <= to; i++) {
    const bar = parsed.bars[i - 1]; if (!bar) continue;
    const steps = bar.steps || 16, per = (parsed.beatsPerBar || 4) / steps;
    const tok = n => n.x === 'mute' ? 'x' : n.x === 'b' ? `${n.f}b${n.bendTo != null ? n.bendTo : ''}` : n.x === 'ghost' ? `(${n.f})` : (['h', 'p', '/', '\\'].includes(n.x) ? n.x : '') + n.f + (n.x === '~' ? '~' : '');
    const wd = Math.max(2, ...bar.notes.map(n => tok(n).length + 1));
    const cells = rows.map(() => new Array(steps).fill('-'.repeat(wd)));
    for (const n of bar.notes) {
      const k = Math.min(steps - 1, Math.round(n.t / per));
      cells[n.s - 1][k] = tok(n).padEnd(wd, '-');
    }
    rows.forEach((r, s) => { rows[s] += '-' + cells[s].join('') + '|'; });
  }
  return rows.join('\n');
}

/** Plain-text tab for exercise notes ({t, d, s, f, x}); used for previews. */
export function notesToText(notes, { tuning = STD, beatsPerBar = 4, maxBars = 4 } = {}) {
  if (!notes || !notes.length) return '';
  const end = Math.max(...notes.map(n => n.t + (n.d || 0)));
  const nBars = Math.min(maxBars, Math.max(1, Math.ceil(end / beatsPerBar - 1e-6)));
  const bars = [];
  for (let b = 0; b < nBars; b++) {
    const inBar = notes.filter(n => n.t >= b * beatsPerBar - 1e-6 && n.t < (b + 1) * beatsPerBar - 1e-6 && n.x !== 'mute').map(n => ({ ...n, t: n.t - b * beatsPerBar }));
    const steps = [4, 8, 12, 16, 24, 32].find(st => inBar.every(n => Math.abs(n.t * st / beatsPerBar - Math.round(n.t * st / beatsPerBar)) < 0.02)) || 16;
    bars.push({ index: b + 1, notes: inBar, steps });
  }
  const text = barsToText({ bars, tuning, beatsPerBar }, 1, nBars);
  return end > maxBars * beatsPerBar ? text.split('\n').map(l => l + ' …').join('\n') : text;
}

/** Quick facts about a range of bars, used for local section help. */
export function sectionFacts(parsed, from, to) {
  const notes = sliceBars(parsed, from, to);
  const singles = notes.filter(n => !n.chord);
  let crossings = 0, shifts = 0, maxSpan = 0;
  for (let i = 1; i < singles.length; i++) {
    if (singles[i].s !== singles[i - 1].s) crossings++;
    if (Math.abs(singles[i].f - singles[i - 1].f) >= 5 && singles[i].f && singles[i - 1].f) shifts++;
  }
  const byT = new Map(); notes.forEach(n => { if (!byT.has(n.t)) byT.set(n.t, []); byT.get(n.t).push(n); });
  for (const g of byT.values()) { const fr = g.map(n => n.f).filter(f => f > 0); if (fr.length > 1) maxSpan = Math.max(maxSpan, Math.max(...fr) - Math.min(...fr)); }
  const minStep = Math.min(...notes.map(n => n.d).filter(d => d > 0), 1);
  return {
    notes: notes.length, chords: [...byT.values()].filter(g => g.length > 1).length,
    legato: notes.filter(n => n.x === 'h' || n.x === 'p').length, bends: notes.filter(n => n.x === 'b').length,
    slides: notes.filter(n => n.x === '/' || n.x === '\\').length, vibrato: notes.filter(n => n.x === '~').length,
    crossings, shifts, maxSpan, fastest: minStep <= 0.25 ? '16ths' : minStep <= 1 / 3 ? 'triplets' : minStep <= 0.5 ? '8ths' : 'quarters',
    highestFret: Math.max(0, ...notes.map(n => n.f))
  };
}

export const STANDARD_TUNING = STD;
export function tuningName(t) {
  const names = t.map(m => ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][((m % 12) + 12) % 12]);
  const key = t.join(',');
  if (key === STD.join(',')) return 'Standard';
  if (key === [64, 59, 55, 50, 45, 38].join(',')) return 'Drop D';
  if (key === STD.map(m => m - 1).join(',')) return 'E♭ standard';
  return names.slice().reverse().join(' ');
}
