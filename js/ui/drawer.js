// Side drawer (Menu A, approved in the App Cosmetics thread). Replaces the bottom tab bar:
// a menu button at the top left (in the header, or in the practice page's top bar) slides
// open a frosted panel with the app's sections and their pages. The section you're in is
// expanded; the search box filters the list. Escape, the ✕ or a tap outside closes it.
import { icon } from './icons.js';
import { logoHTML } from './logo.js';
import { openQuickTuner } from './tunerfab.js';

const SECTIONS = [
  { k: 'practice', t: 'Practice', d: 'Today’s lesson, exercise library', ic: 'play', match: /^#\/(home|practice|play|course)?(\/|$)/,
    subs: [['Today’s lesson', '#/home'], ['Exercise library', '#/practice']] },
  { k: 'courses', t: 'Courses & Artists', d: 'Artist series, songs', ic: 'graduation-cap', match: /^#\/(artist|songs?)(\/|$)/,
    subs: [['Artist series', '#/artist'], ['Songs', '#/songs']] },
  { k: 'tech', t: 'Technique Library', d: 'Beginner-to-mastery paths', ic: 'target', match: /^#\/techniques(\/|$)/,
    subs: [['All paths', '#/techniques']] },
  { k: 'tools', t: 'Tools', d: 'Tuner, metronome, trainers, scales', ic: 'gauge', match: /^#\/(tools|evaluate)(\/|$)/,
    subs: [['Tuner', '#/tools/tuner'], ['Metronome', '#/tools/metronome'], ['Chords', '#/tools/chords'], ['Trainers', '#/tools/trainers'], ['Scales', '#/tools/scales'], ['Evaluate a take', '#/evaluate']] },
  { k: 'profile', t: 'Profile & Settings', d: 'Skill levels, history, sync, keys', ic: 'user-round', match: /^#\/(profile|reassess|results|settings|keys)(\/|$)/,
    subs: [['Skill levels & history', '#/profile'], ['Reassess', '#/reassess'], ['Settings & Drive sync', '#/settings']] }
];

let root = null, openSec = null;

const sectionFor = h => { const s = SECTIONS.find(x => x.match.test(h || '#/home')); return s ? s.k : 'practice'; };
const subOn = (href, h) => h === href || (href !== '#/home' && h.startsWith(href + '/')) || (href === '#/home' && (h === '#/' || h === '' || h.startsWith('#/home')));

function render(filter = '') {
  const h = location.hash || '#/home', cur = sectionFor(h), q = filter.trim().toLowerCase();
  if (openSec == null) openSec = cur;
  let list = '';
  for (const s of SECTIONS) {
    const subs = s.subs.filter(([l]) => !q || l.toLowerCase().includes(q) || s.t.toLowerCase().includes(q));
    if (q && !subs.length) continue;
    const open = q ? true : openSec === s.k;
    list += `<button type="button" class="dw-sec ${s.k === cur ? 'on' : ''} ${open ? 'open' : ''}" data-sec="${s.k}" aria-expanded="${open}">
        <span class="dw-ico">${icon(s.ic)}</span><span><span class="dw-t">${s.t}</span><span class="dw-d">${s.d}</span></span><span class="dw-chev">${icon('chevron-right')}</span></button>
      <div class="dw-subs">${subs.map(([l, href]) => `<a href="${href}" class="${subOn(href, h) ? 'on' : ''}">${l}</a>`).join('')}</div>`;
  }
  root.querySelector('.dw-list').innerHTML = list || '<p class="dw-empty">Nothing matches. Try the ask box on the Practice page.</p>';
}

export function openDrawer() {
  if (!root) return;
  openSec = null;
  const s = root.querySelector('.dw-search input'); if (s) s.value = '';
  render();
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('drawer-open'));
  document.querySelectorAll('.menu-btn').forEach(b => b.setAttribute('aria-expanded', 'true'));
  setTimeout(() => { const f = root.querySelector('.dw-x'); if (f) f.focus(); }, 30);
}
export function closeDrawer() {
  if (!root || root.hidden) return;
  root.classList.remove('drawer-open');
  document.querySelectorAll('.menu-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
  setTimeout(() => { if (!root.classList.contains('drawer-open')) root.hidden = true; }, 230);
}

/** The menu button (header and practice page). */
export const menuButtonHTML = (cls = '') => `<button type="button" class="menu-btn ${cls}" data-menu aria-label="Open the menu" aria-controls="drawer" aria-expanded="false">${icon('menu')}</button>`;

export function initDrawer() {
  if (root) return;
  root = document.createElement('div');
  root.id = 'drawer'; root.hidden = true;
  root.innerHTML = `<div class="drawer-scrim" data-close></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="dw-head"><a class="logo" href="#/home" aria-label="SONYX home">${logoHTML('lg')}</a><button type="button" class="dw-x" data-close aria-label="Close the menu">${icon('x')}</button></div>
      <label class="dw-search">${icon('search')}<input type="search" placeholder="Search lessons, tools, artists…" aria-label="Search the menu"></label>
      <nav class="dw-list" aria-label="Sections"></nav>
      <div class="dw-foot"><button type="button" data-tune>${icon('audio-waveform')}Tune</button><a href="#/settings">${icon('settings')}Settings</a></div>
    </aside>`;
  document.body.appendChild(root);
  root.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { closeDrawer(); return; }
    const sec = e.target.closest('[data-sec]');
    if (sec) { openSec = openSec === sec.dataset.sec ? '' : sec.dataset.sec; render(root.querySelector('.dw-search input').value); return; }
    if (e.target.closest('[data-tune]')) { closeDrawer(); setTimeout(openQuickTuner, 240); return; }
    if (e.target.closest('a')) closeDrawer();
  });
  root.querySelector('.dw-search input').addEventListener('input', e => render(e.target.value));
  document.addEventListener('click', e => { if (e.target.closest('[data-menu]')) openDrawer(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  window.addEventListener('hashchange', closeDrawer);
}
