// Quick tuner: a tuning-fork button on every screen. Tapping it pops a small
// curved meter up above the button (it starts listening right away); tapping
// the fork again folds it away and stops the mic. Nothing else on the screen
// is covered or paused, so you can tune and carry on. The button hides on the
// full tuner in Tools, where it would be redundant.
import { Store } from '../core/store.js';
import { mountTuner } from '../tools/tuner.js';

const FORK = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 2v7a4 4 0 0 0 8 0V2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 13v9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const onTunerScreen = () => { const h = location.hash || ''; return h === '#/tools' || h === '#/tools/' || /^#\/tools\/tuner(\/|$)/.test(h); }; // Tools opens on the tuner

let pop = null, off = null, fab = null;

export function openQuickTuner() {
  if (pop || !fab) return;
  const p = Store.profile;
  const settings = p ? p.settings : {};
  const save = patch => { if (Store.profile) { Object.assign(Store.profile.settings, patch); Store.save(); } };
  pop = document.createElement('div');
  pop.className = 'tunepop'; pop.id = 'tunepop';
  document.body.appendChild(pop);
  off = mountTuner(pop, settings, save, { pop: true, autostart: true });
  document.body.classList.add('tuning');
  fab.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => pop && pop.classList.add('show'));
}
export function closeQuickTuner() {
  if (!pop) return;
  if (off) off();
  off = null;
  const el = pop; pop = null;
  el.classList.remove('show'); el.remove();
  document.body.classList.remove('tuning');
  if (fab) fab.setAttribute('aria-expanded', 'false');
}
export const quickTunerOpen = () => !!pop;

function syncVisibility() {
  if (!fab) return;
  const hide = onTunerScreen();
  fab.hidden = hide;
  if (hide) closeQuickTuner();
}

export function initTunerFab() {
  if (document.querySelector('.tunefab')) return;
  fab = document.createElement('button');
  fab.className = 'tunefab'; fab.type = 'button';
  fab.setAttribute('aria-label', 'Quick tuner'); fab.title = 'Quick tuner';
  fab.setAttribute('aria-controls', 'tunepop'); fab.setAttribute('aria-expanded', 'false');
  fab.innerHTML = `${FORK}<span>Tune</span>`;
  fab.addEventListener('click', () => (pop ? closeQuickTuner() : openQuickTuner()));
  document.body.appendChild(fab);
  window.addEventListener('hashchange', syncVisibility);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) closeQuickTuner(); });
  syncVisibility();
}
