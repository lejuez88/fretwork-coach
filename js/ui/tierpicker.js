// The four-tier control: Foundations · Intermediate · Advanced · Mastery. The recommended tier
// carries a small "Recommended" mark; tapping any tier switches to it, no warnings.
import { esc } from '../core/util.js';
import { TIERS } from '../core/tiers.js';

/**
 * current: the tier on screen; recommended: the tier to mark (null for guests);
 * missing: tier ids with nothing yet (shown, not tappable); attr: the data attribute.
 */
export function tierPickerHTML({ current, recommended = null, missing = [], attr = 'data-tier4', compact = false, list = false, extra = () => '' } = {}) {
  if (list) return tierListHTML({ current, recommended, missing, attr });
  return `<div class="tier4 ${compact ? 'compact' : ''}" role="group" aria-label="Level">${TIERS.map(t => {
    const miss = missing.includes(t.id), on = t.id === current, rec = t.id === recommended;
    return `<button class="t4 ${on ? 'on' : ''} ${rec ? 'rec' : ''} ${miss ? 'missing' : ''}" ${miss ? 'disabled' : `${attr}="${t.id}"`} aria-pressed="${on}">
      <span class="t4-name">${esc(t.name)}</span>${rec ? '<span class="t4-rec">Recommended</span>' : miss ? '<span class="t4-rec soon">Coming soon</span>' : ''}${extra(t)}</button>`;
  }).join('')}</div>`;
}

/** Guided Path: the four tiers as a vertical list of numbered cards, each with what it covers. */
function tierListHTML({ current, recommended, missing, attr }) {
  return `<div class="tier-list" role="group" aria-label="Level">${TIERS.map((t, i) => {
    const miss = missing.includes(t.id), on = t.id === current, rec = t.id === recommended;
    return `<button class="tl-item ${on ? 'on' : ''} ${rec ? 'rec' : ''} ${miss ? 'missing' : ''}" ${miss ? 'disabled' : `${attr}="${t.id}"`} aria-pressed="${on}">
      <span class="tl-num">${i + 1}</span><span class="tl-txt"><b>${esc(t.name)}${rec ? ' <span class="t4-rec">Recommended</span>' : ''}</b><span>${esc(miss ? 'Coming soon' : t.blurb)}</span></span></button>`;
  }).join('')}</div>`;
}
