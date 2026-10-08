// Quick tuner: a small button on every screen that opens a compact tuner in a
// sheet, starts listening right away, and stops the mic when closed.
import { Store } from '../core/store.js';
import { Shell } from './shell.js';
import { mountTuner } from '../tools/tuner.js';

const FORK = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 2v7a4 4 0 0 0 8 0V2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 13v9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

let sheet = null, off = null;

export function openQuickTuner() {
  if (sheet) return;
  const p = Store.profile;
  const settings = p ? p.settings : {};
  const save = patch => { if (Store.profile) { Object.assign(Store.profile.settings, patch); Store.save(); } };
  sheet = Shell.sheet('<div class="qt-head"><h2>Quick tune</h2></div><div data-r="qt"></div>', { onClose: () => { if (off) off(); off = null; sheet = null; document.body.classList.remove('tuning'); } });
  sheet.el.classList.add('qtsheet');
  document.body.classList.add('tuning');
  off = mountTuner(sheet.el.querySelector('[data-r="qt"]'), settings, save, { mini: true, autostart: true });
}
export function closeQuickTuner() { if (sheet) sheet.close(); }

export function initTunerFab() {
  if (document.querySelector('.tunefab')) return;
  const b = document.createElement('button');
  b.className = 'tunefab'; b.type = 'button';
  b.setAttribute('aria-label', 'Quick tuner'); b.title = 'Quick tuner';
  b.innerHTML = `${FORK}<span>Tune</span>`;
  b.addEventListener('click', () => (sheet ? closeQuickTuner() : openQuickTuner()));
  document.body.appendChild(b);
  // leaving the screen (or following the "Tools → Tuner" link) closes the sheet
  window.addEventListener('hashchange', () => closeQuickTuner());
}
