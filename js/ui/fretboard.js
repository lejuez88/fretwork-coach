// SVG renderers for chord diagrams (vertical boxes) and the horizontal
// fretboard. Dots are colored by interval family (root, 3rd, 5th, 7th,
// extensions) and labeled with the interval, the note name or a finger.
import { esc } from '../core/util.js';
import { intervalFamily, defaultVoicing, fretsToString, describeVoicing } from '../core/theory.js';
import { CHORD_SHAPES } from '../assessment/engine.js';

/** Voicing for a chord name: the hand-made open shape if there is one, else the theory engine's. */
export function voicingForName(name) {
  const sh = CHORD_SHAPES[name];
  if (sh) {
    const frets = sh.frets.split('').map(c => (c === 'x' ? null : +c));
    const d = describeVoicing(frets, name);
    if (d) return { ...d, fingers: sh.fingers.split('').map(c => (c === 'x' || c === '0' ? null : +c)), barre: sh.barre ? { fret: sh.barre } : d.barre };
  }
  return defaultVoicing(name);
}

const LABEL_MODES = { interval: 'labels', note: 'names', finger: 'fingers' };

/** Chord box diagram. v: {frets (low→high), labels?, names?, fingers?, barre?, name}. */
export function chordDiagramSVG(v, { mode = 'interval', title = null, selected = false, w = 112 } = {}) {
  if (!v || !v.frets) return '';
  const frets = v.frets;
  const fretted = frets.filter(f => f != null && f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0, minF = fretted.length ? Math.min(...fretted) : 0;
  const base = maxF <= 4 ? 1 : minF;
  const L = 24, T = 46, G = 14, FH = 19, rows = 5;
  const labels = v[LABEL_MODES[mode]] || v.labels || [];
  const name = title != null ? title : v.name || '';
  let o = `<svg class="cdiag ${selected ? 'sel' : ''}" viewBox="0 0 ${w} 158" role="img" aria-label="${esc(name)} chord diagram ${fretsToString(frets)}">`;
  if (name) o += `<text x="${L + 2.5 * G}" y="13" text-anchor="middle" class="cd-name">${esc(name)}</text>`;
  for (let i = 0; i < 6; i++) o += `<line x1="${L + i * G}" y1="${T}" x2="${L + i * G}" y2="${T + rows * FH}" class="cd-str"/>`;
  for (let f = 0; f <= rows; f++) o += `<line x1="${L}" y1="${T + f * FH}" x2="${L + 5 * G}" y2="${T + f * FH}" class="cd-fret ${f === 0 && base === 1 ? 'nut' : ''}"/>`;
  if (base > 1) o += `<text x="${L - 10}" y="${T + 13}" text-anchor="end" class="cd-base">${base}</text>`;
  if (v.barre && v.barre.fret >= base && v.barre.fret < base + rows) {
    const idx = frets.map((f, i) => (f === v.barre.fret ? i : -1)).filter(i => i >= 0);
    if (idx.length >= 2) { const y = T + (v.barre.fret - base + 0.5) * FH; o += `<rect x="${L + idx[0] * G - 7}" y="${y - 7}" width="${(idx[idx.length - 1] - idx[0]) * G + 14}" height="14" rx="7" class="cd-barre"/>`; }
  }
  frets.forEach((f, i) => {
    const x = L + i * G, lab = labels[i] != null ? String(labels[i]) : '', fam = v.labels && v.labels[i] ? intervalFamily(v.labels[i]) : 'root';
    if (f == null) o += `<text x="${x}" y="${T - 6}" text-anchor="middle" class="cd-x">×</text>`;
    else if (f === 0) o += `<circle cx="${x}" cy="${T - 10}" r="4.5" class="cd-open fam-${fam}"/>${mode !== 'finger' && lab ? `<text x="${x}" y="${T - 19}" text-anchor="middle" class="cd-olab">${esc(lab)}</text>` : ''}`;
    else {
      const y = T + (f - base + 0.5) * FH;
      o += `<circle cx="${x}" cy="${y}" r="7.5" class="cd-dot fam-${fam}"/>${lab ? `<text x="${x}" y="${y + 3.5}" text-anchor="middle" class="cd-lab ${lab.length > 2 ? 'sm' : ''}">${esc(lab)}</text>` : ''}`;
    }
  });
  return o + '</svg>';
}

/** Diagrams for an exercise: explicit voicings first, else chord names. */
export function exerciseDiagramsHTML(ex, opts = {}) {
  const list = (ex.voicings && ex.voicings.length ? ex.voicings : (ex.chords || []).map(voicingForName)).filter(Boolean).slice(0, 8);
  return list.length ? `<div class="diagrams">${list.map(v => chordDiagramSVG(v, opts)).join('')}</div>` : '';
}

/**
 * Horizontal fretboard (string 1 at the top, like tab).
 * marks: [{s, f, label, family, ghost, cls}]; muted: [string numbers]; opts: {maxFret, interactive,
 * highlightFrets: [lo, hi] (frets outside are dimmed), focusString: string number to highlight}
 */
export function fretboardSVG({ marks = [], muted = [], maxFret = 15, interactive = false, highlightFrets = null, focusString = null } = {}) {
  const NUT = 38, FW = 46, ROW = 26, TOP = 18, H = TOP + ROW * 5 + 30, W = NUT + maxFret * FW + 12;
  let o = `<svg class="fboard ${interactive ? 'interactive' : ''}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Fretboard">`;
  // inlays
  [3, 5, 7, 9, 15, 17].filter(f => f <= maxFret).forEach(f => { o += `<circle cx="${NUT + (f - 0.5) * FW}" cy="${TOP + ROW * 2.5}" r="5" class="fb-inlay"/>`; });
  if (maxFret >= 12) { o += `<circle cx="${NUT + 11.5 * FW}" cy="${TOP + ROW * 1.5}" r="5" class="fb-inlay"/><circle cx="${NUT + 11.5 * FW}" cy="${TOP + ROW * 3.5}" r="5" class="fb-inlay"/>`; }
  // frets and nut
  for (let f = 0; f <= maxFret; f++) { const x = NUT + f * FW; o += `<line x1="${x}" y1="${TOP}" x2="${x}" y2="${TOP + ROW * 5}" class="${f === 0 ? 'fb-nut' : 'fb-fret'}"/>`; if (f > 0) o += `<text x="${x - FW / 2}" y="${H - 6}" text-anchor="middle" class="fb-num ${[3, 5, 7, 9, 12, 15].includes(f) ? 'em' : ''}">${f}</text>`; }
  // strings (thicker for low)
  if (focusString >= 1 && focusString <= 6) o += `<rect x="${NUT - 30}" y="${TOP + (focusString - 1) * ROW - 8}" width="${W - NUT + 24}" height="16" rx="8" class="fb-focus"/>`;
  for (let s = 1; s <= 6; s++) { const y = TOP + (s - 1) * ROW; o += `<line x1="${NUT - 30}" y1="${y}" x2="${W - 6}" y2="${y}" class="fb-str" style="stroke-width:${0.8 + (s - 1) * 0.35}"/>`; o += `<text x="4" y="${y + 4}" class="fb-sname">${['e', 'B', 'G', 'D', 'A', 'E'][s - 1]}</text>`; }
  // dim the frets outside the practice area
  if (Array.isArray(highlightFrets)) {
    const [lo, hi] = highlightFrets, y = TOP - 12, h = ROW * 5 + 24;
    if (lo > 0) o += `<rect x="${NUT - 30}" y="${y}" width="${(lo - 1) * FW + 30}" height="${h}" class="fb-dim"/>`;
    if (hi < maxFret) o += `<rect x="${NUT + hi * FW}" y="${y}" width="${W - (NUT + hi * FW)}" height="${h}" class="fb-dim"/>`;
  }
  // click targets
  if (interactive) for (let s = 1; s <= 6; s++) for (let f = 0; f <= maxFret; f++) {
    const x = f === 0 ? NUT - 26 : NUT + (f - 1) * FW, w = f === 0 ? 26 : FW, y = TOP + (s - 1) * ROW - ROW / 2;
    o += `<rect class="fb-hit" data-s="${s}" data-f="${f}" x="${x}" y="${y}" width="${w}" height="${ROW}"/>`;
  }
  muted.forEach(s => { o += `<text x="${NUT - 13}" y="${TOP + (s - 1) * ROW + 5}" text-anchor="middle" class="fb-x">×</text>`; });
  // marks
  for (const m of marks) {
    const x = m.f === 0 ? NUT - 13 : NUT + (m.f - 0.5) * FW, y = TOP + (m.s - 1) * ROW, r = m.ghost ? 9 : 11.5;
    const lab = m.label != null ? String(m.label) : '';
    o += `<g class="fb-mark ${m.ghost ? 'ghost' : ''} ${m.cls || ''}" data-ms="${m.s}" data-mf="${m.f}"><circle cx="${x}" cy="${y}" r="${r}" class="fam-${m.family || 'root'}"/>${lab ? `<text x="${x}" y="${y + 4}" text-anchor="middle" class="${lab.length > 2 ? 'sm' : ''}">${esc(lab)}</text>` : ''}</g>`;
  }
  return o + '</svg>';
}

export const FAMILY_LEGEND = [['root', 'Root'], ['third', '3rd'], ['fifth', '5th'], ['seventh', '7th'], ['sixth', '6th'], ['sus', '2nd / 4th'], ['ext', '9 / 11 / 13']];
