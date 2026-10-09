// The metronome sound chooser, shared by the metronome, the tab player and Settings.
// The choice is saved in the profile (settings.clickSound) and applies everywhere at once.
import { Audio, CLICK_SOUNDS } from '../core/audio.js';
import { Store } from '../core/store.js';
import { esc } from '../core/util.js';

export const clickSoundSelectHTML = (cls = '') => `<label class="mini clicksound ${cls}">Click sound<select data-clicksound>${CLICK_SOUNDS.map(([k, l]) => `<option value="${k}" ${Audio.sound === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;

/** Use a sound everywhere, save it, play a bar of it, and update every chooser on screen. */
export function setClickSound(id, { preview = true } = {}) {
  if (!CLICK_SOUNDS.some(([k]) => k === id)) return;
  Audio.sound = id;
  const p = Store.profile; if (p) { p.settings.clickSound = id; Store.save(); }
  if (preview) Audio.previewClick(id);
  document.querySelectorAll('[data-clicksound]').forEach(s => { if (s.value !== id) s.value = id; });
}
// one listener for every chooser, wherever it is drawn
if (typeof document !== 'undefined') document.addEventListener('change', e => { const s = e.target && e.target.closest && e.target.closest('[data-clicksound]'); if (s) setClickSound(s.value); });
