// Tempo lines that say what the BPM means: "Target 8th notes at 60 BPM → goal 113".
import { esc } from '../core/util.js';
import { beatLabel, clickNote } from '../core/tempo.js';

/** The tempo row on exercise cards. */
export function tempoRowHTML(ex, target, { goal = ex && ex.goalBpm, best = null, mastered = false, lead = 'Target' } = {}) {
  return `<div class="tempo-row" title="${esc(clickNote(ex))}">
    <span class="tr-main">${esc(lead)} <b class="tv">${esc(beatLabel(ex))}</b> at <b>${target}</b> BPM</span>
    ${goal ? `<span>→ goal <b class="goal">${goal}</b> BPM</span>` : ''}${best ? `<span>Best <b>${best}</b></span>` : ''}${mastered ? '<span class="ok">Mastered</span>' : ''}</div>`;
}

/** One-line version for lists: "8th notes · 60 → 113 BPM". */
export function tempoShort(ex, from, to) {
  return `${beatLabel(ex)} · ${from}${to && to !== from ? ` → ${to}` : ''} BPM`;
}
