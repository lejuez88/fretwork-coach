// Guided Path (approved in the App Cosmetics thread): on wide screens a persistent top nav
// (Home · Practice · Techniques · Artists · Tools) replaces the side drawer, with the streak pill
// and a profile button on the right. Phones keep the menu button and drawer.
import { Store, Practice } from '../core/store.js';
import { icon } from './icons.js';

const LINKS = [['Home', '#/home', /^#\/(home|course)?(\/|$)|^#?$/], ['Practice', '#/practice', /^#\/(practice|play|lesson)(\/|$)/], ['Techniques', '#/techniques', /^#\/techniques(\/|$)/], ['Artists', '#/artist', /^#\/artist(\/|$)/], ['Songs', '#/songs', /^#\/songs?(\/|$)/], ['Tools', '#/tools', /^#\/(tools|evaluate)(\/|$)/]];

export function topNavHTML() {
  return `<nav class="topnav" aria-label="Main">${LINKS.map(([l, href]) => `<a href="${href}" data-tn="${href}">${l}</a>`).join('')}</nav>`;
}
/** Mark the current section and refresh the streak. */
export function updateTopNav() {
  const h = location.hash || '#/home';
  document.querySelectorAll('.topnav a').forEach(a => { const L = LINKS.find(x => x[1] === a.dataset.tn); a.classList.toggle('on', !!(L && L[2].test(h))); });
  const pill = document.querySelector('[data-slot="streak"]'); if (!pill) return;
  const p = Store.profile;
  if (!p || p.guest) { pill.hidden = true; return; }
  let n = 0; try { n = Practice.stats(p).streak || 0; } catch { /* no log */ }
  pill.hidden = false;
  pill.innerHTML = `${icon('flame')}<b>${n}</b><span>day streak</span>`;
  pill.classList.toggle('hot', n > 0);
}
export const profileButtonHTML = () => `<a class="top-settings top-profile" href="#/profile" aria-label="Profile" title="Profile">${icon('user-round')}</a>`;
