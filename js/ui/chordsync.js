// Lights up the chord box that is sounding. For a tab, each moment of the tab is
// matched to one of the exercise's chord boxes (same frets first, then same
// notes), with a small preference for staying on a chord and for changing on
// the bar line, so arpeggios, strums and single-note lines over the changes all
// follow the harmony. For the metronome's backing track the bar's chord is known.
import { diagramList } from './fretboard.js';
import { parseChord, chordTones, mod12 } from '../core/theory.js';
import { STD_TUNING } from '../tools/exercises.js';

const tonesCache = new Map();
function pcsOf(name) {
  if (!tonesCache.has(name)) {
    const c = parseChord(name);
    tonesCache.set(name, c ? new Set(chordTones(c.root, c.type).map(x => x.pc)) : null);
  }
  return tonesCache.get(name);
}

/**
 * Chord timeline for a tab: [{t, i}] (t = beat where chord box i starts), or
 * null when the exercise has no chord boxes or the tab doesn't follow them.
 * ex: exercise (voicings / chords / backing); notes: tab notes; tuning: low→high strings as string 1 first.
 */
export function chordTimeline(ex, notes, { beatsPerBar = 4, tuning = STD_TUNING } = {}) {
  const { list } = diagramList(ex);
  if (!list.length || !Array.isArray(notes) || !notes.length) return null;
  const K = list.length;
  // onset groups
  const sorted = [...notes].filter(n => n.x !== 'mute').sort((a, b) => a.t - b.t);
  const groups = [];
  for (const n of sorted) { const g = groups[groups.length - 1]; if (g && Math.abs(g.t - n.t) < 1e-3) g.notes.push(n); else groups.push({ t: n.t, notes: [n] }); }
  if (!groups.length) return null;
  const pcs = list.map(v => pcsOf(v.name) || new Set(v.frets.map((f, i) => (f == null ? null : mod12(STD_TUNING[5 - i] + f))).filter(x => x != null)));
  const score = (g, k) => {
    let s = 0;
    for (const n of g.notes) {
      const v = list[k];
      if (v.frets && v.frets[6 - n.s] === n.f) s += 2;
      else if (pcs[k].has(mod12(tuning[n.s - 1] + n.f))) s += 1;
      else s -= 1.2;
    }
    return s;
  };
  const changeCost = (t, from, to) => {
    const inBar = ((t % beatsPerBar) + beatsPerBar) % beatsPerBar;
    const pos = inBar < 1e-3 || beatsPerBar - inBar < 1e-3 ? 0 : beatsPerBar % 2 === 0 && Math.abs(inBar - beatsPerBar / 2) < 1e-3 ? 0.4 : Math.abs(inBar - Math.round(inBar)) < 1e-3 ? 0.9 : 1.6;
    return pos + (to === (from + 1) % K ? 0.3 : 1.5);
  };
  // Viterbi over the chord boxes
  let best = list.map((_, k) => score(groups[0], k) - (k === 0 ? 0 : 0.8));
  const back = [];
  for (let gi = 1; gi < groups.length; gi++) {
    const g = groups[gi], nb = new Array(K), bp = new Array(K);
    for (let k = 0; k < K; k++) {
      let bv = -Infinity, bj = k;
      for (let j = 0; j < K; j++) { const v = best[j] - (j === k ? 0 : changeCost(g.t, j, k)); if (v > bv) { bv = v; bj = j; } }
      nb[k] = bv + score(g, k); bp[k] = bj;
    }
    back.push(bp); best = nb;
  }
  let k = best.indexOf(Math.max(...best));
  const total = Math.max(...best);
  const path = [k];
  for (let gi = back.length - 1; gi >= 0; gi--) { k = back[gi][k]; path.unshift(k); }
  // too little agreement: the tab doesn't follow these chords (e.g. moved to another position)
  if (total / sorted.length < 0.45) return null;
  const out = [];
  path.forEach((ki, gi) => { if (!out.length || out[out.length - 1].i !== ki) out.push({ t: groups[gi].t, i: ki }); });
  return out;
}

/** Chord box index at beat pos (pos in the same units as the timeline), or -1. */
export function chordAt(timeline, pos) {
  if (!timeline || !timeline.length || pos < timeline[0].t - 1e-6) return timeline && timeline.length ? timeline[timeline.length - 1].i : -1;
  let lo = 0, hi = timeline.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (timeline[mid].t <= pos + 1e-6) lo = mid; else hi = mid - 1; }
  return timeline[lo].i;
}

/** The chord boxes that belong with a player: the nearest .diagrams block above it in the page. */
export function findDiagrams(el) {
  let n = el;
  for (let i = 0; i < 6 && n; i++) {
    n = n.parentElement; if (!n) break;
    const d = n.querySelector('.diagrams[data-sync]');
    if (d) return d;
  }
  return null;
}

/** Light up one chord box (by index or by chord name); null clears. */
export function highlightChord(container, which) {
  if (!container) return;
  const boxes = container.querySelectorAll('[data-di]');
  let hit = null;
  if (which != null && which !== -1) {
    hit = typeof which === 'number' ? container.querySelector(`[data-di="${which}"]`) : [...boxes].find(b => b.getAttribute('data-name') === which) || null;
  }
  boxes.forEach(b => { const on = b === hit; if (b.classList.contains('playing') !== on) b.classList.toggle('playing', on); });
}
