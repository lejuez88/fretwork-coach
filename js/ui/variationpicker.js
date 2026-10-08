// Variation chips shared by the library, the routine runner and the request box.
import { esc } from '../core/util.js';

/**
 * list: variations (easiest first); current: vid; edge: vid suggested for the
 * player; stateOf(vid) → progress state or null.
 */
export function variationChipsHTML(list, { current = 'base', edge = null, stateOf = () => null, attr = 'data-vid' } = {}) {
  return `<div class="varchips">${list.map(v => {
    const st = stateOf(v.vid);
    const mark = st && st.mastered ? '<i class="vm ok" title="Mastered">✓</i>' : st && st.history && st.history.length ? '<i class="vm" title="Practiced">•</i>' : '';
    return `<button class="varchip ${v.vid === current ? 'on' : ''} ${v.vid === edge ? 'edge' : ''}" ${attr}="${esc(v.vid)}" title="${esc(v.change)}" aria-pressed="${v.vid === current}">
      <span class="vlv">L${v.level}</span><span class="vlab">${esc(v.label)}</span>${mark}${v.vid === edge && v.vid !== current ? '<span class="vedge">your edge</span>' : ''}</button>`;
  }).join('')}</div>`;
}

export function variationNoteHTML(v) {
  if (!v) return '';
  return `<p class="varnote"><b>${esc(v.label)}</b> · level ${v.level}${v.base ? '' : ''} · ${esc(v.change)}</p>`;
}

export function levelRange(list) {
  if (!list.length) return '';
  const lo = Math.min(...list.map(v => v.level)), hi = Math.max(...list.map(v => v.level));
  return lo === hi ? `level ${lo}` : `levels ${lo}–${hi}`;
}
