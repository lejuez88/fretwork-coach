// Key / strings / chords / chord type pickers for an exercise. Shared by the
// library and the routine runner.
import { esc } from '../core/util.js';

/** dims from paramDims(); params = stored choices. */
export function paramControlsHTML(dims, params = {}) {
  if (!dims.length) return '';
  return `<div class="params">${dims.map(d => {
    const want = params[d.id] != null && params[d.id] !== 'random' ? String(params[d.id]) : String(d.value);
    return `<label class="mini param"><span>${esc(d.label)}</span><select data-param="${esc(d.id)}">
      ${d.options.map(o => `<option value="${esc(String(o.v))}" ${want === String(o.v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
  }).join('')}</div>`;
}
