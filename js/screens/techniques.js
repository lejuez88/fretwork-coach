// Technique Library: every technique in the lesson library (rolling 5s, spread
// triads, tapping…), browsable by level and skill area. #/techniques lists them;
// #/techniques/<id> shows one technique's lessons at a level you pick, the
// artists who use it, and a master class on it. New techniques added to
// js/data/artists.js (by the content runs) appear here automatically.
import { esc } from '../core/util.js';
import { Store } from '../core/store.js';
import { DOMAINS, DOMAIN_BY_KEY } from '../assessment/engine.js';
import { TECHNIQUES, TECHNIQUE_BY_ID, techniqueLevel, artistsUsing } from '../data/artists.js';
import { techniqueLessonList, techniqueLevelFor } from '../core/master.js';
import { calibratedTarget } from '../core/progression.js';
import { tierName } from '../core/courses.js';
import { openMasterSheet, MC_ICON } from '../ui/mastersheet.js';
import { lessonCardHTML, lessonActions } from '../ui/lessoncards.js';

const UI_KEY = 'fretworkCoach.techUI';
const getUI = () => { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch { return {}; } };
const setUI = v => { try { localStorage.setItem(UI_KEY, JSON.stringify(v)); } catch { /* storage off */ } };

export const LEVEL_BANDS = [
  { id: 'foryou', name: 'For you', test: (t, p) => { const [lo, hi] = techniqueLevel(t), l = yourLevel(p, t); return l >= lo - 1 && l <= hi; } },
  { id: 'beginner', name: 'Beginner (1–3)', test: t => techniqueLevel(t)[0] <= 3 },
  { id: 'intermediate', name: 'Intermediate (4–6)', test: t => { const [lo, hi] = techniqueLevel(t); return lo <= 6 && hi >= 4; } },
  { id: 'advanced', name: 'Advanced (7–10)', test: t => techniqueLevel(t)[1] >= 7 },
  { id: 'all', name: 'All', test: () => true }
];
const yourLevel = (p, t) => (p.domains && p.domains[t.domain] ? p.domains[t.domain].level : 4);
const domName = k => (DOMAIN_BY_KEY[k] ? DOMAIN_BY_KEY[k].short || DOMAIN_BY_KEY[k].name : k);

/** Techniques that pass a level band and a skill area, easiest first. */
export function filterTechniques(p, band = 'all', domain = 'all') {
  const b = LEVEL_BANDS.find(x => x.id === band) || LEVEL_BANDS[LEVEL_BANDS.length - 1];
  return TECHNIQUES.filter(t => b.test(t, p) && (domain === 'all' || t.domain === domain))
    .sort((a, c) => techniqueLevel(a)[0] - techniqueLevel(c)[0] || techniqueLevel(a)[1] - techniqueLevel(c)[1] || a.title.localeCompare(c.title));
}

/** #/techniques: the whole library with level and skill-area filters. */
export function mountTechniqueIndex(root, { navigate }) {
  const p = Store.profile;
  const ui = Object.assign({ band: 'foryou', domain: 'all' }, getUI());
  if (!LEVEL_BANDS.some(b => b.id === ui.band)) ui.band = 'foryou';
  const domains = DOMAINS.filter(d => TECHNIQUES.some(t => t.domain === d.key));
  function render() {
    let list = filterTechniques(p, ui.band, ui.domain);
    const empty = !list.length;
    root.innerHTML = `<a class="link" href="#/practice">← Practice</a>
      <div class="exhead"><div class="label">Technique library</div><h1>Techniques</h1>
        <p class="why">${TECHNIQUES.length} techniques, each with lessons that adapt to your level: pick one, choose a level inside its range, and try the lessons in the tab player. New techniques are added here as the library grows.</p></div>
      <div class="tech-filters">
        <div class="chips" role="group" aria-label="Level">${LEVEL_BANDS.map(b => `<button class="chip ${ui.band === b.id ? 'on' : ''}" data-band="${b.id}">${esc(b.name)}</button>`).join('')}</div>
        <div class="chips" role="group" aria-label="Skill area"><button class="chip ${ui.domain === 'all' ? 'on' : ''}" data-dom="all">All areas</button>${domains.map(d => `<button class="chip ${ui.domain === d.key ? 'on' : ''}" data-dom="${d.key}">${esc(d.short || d.name)}</button>`).join('')}</div>
      </div>
      ${empty ? `<section class="card"><p class="muted">No techniques match${ui.band === 'foryou' ? ' your current levels in this area yet' : ''}. Try another level or area.</p></section>` : ''}
      <div class="tech-grid">${list.map(t => {
        const [lo, hi] = techniqueLevel(t), you = yourLevel(p, t), arts = artistsUsing(t.id);
        const fit = you < lo ? 'stretch' : you > hi ? 'review' : 'fit';
        return `<a class="tech-card" href="#/techniques/${t.id}">
          <div class="tc-top"><span class="tc-dom">${esc(domName(t.domain))}</span><span class="tc-lv">Levels ${lo}–${hi}</span></div>
          <b>${esc(t.title)}</b><p class="small muted">${esc(t.summary)}</p>
          <div class="tc-meter" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i + 1 >= lo && i + 1 <= hi ? 'in' : ''} ${i + 1 === you ? 'you' : ''}"></i>`).join('')}</div>
          <div class="small tc-fit ${fit}">${fit === 'fit' ? `At your level (${you})` : fit === 'stretch' ? `A stretch: you're at ${you}` : `Below your level (${you}): good for review`}</div>
          ${arts.length ? `<div class="small muted">Used by ${arts.map(a => esc(a.name)).join(', ')}</div>` : ''}
        </a>`;
      }).join('')}</div>`;
  }
  const onClick = e => {
    const b = e.target.closest('[data-band],[data-dom]'); if (!b) return;
    if (b.dataset.band) ui.band = b.dataset.band; else ui.domain = b.dataset.dom;
    setUI(ui); render();
  };
  root.addEventListener('click', onClick);
  render();
  return () => root.removeEventListener('click', onClick);
}

/** #/techniques/<id>: one technique's lessons at a chosen level. */
export function mountTechnique(root, { navigate, id }) {
  const p = Store.profile, t = TECHNIQUE_BY_ID[id];
  if (!t) { navigate('#/techniques'); return () => {}; }
  const [lo, hi] = techniqueLevel(t);
  let level = techniqueLevelFor(p, id), lessons = [], targets = [];
  const build = () => { lessons = techniqueLessonList(p, id, level); targets = lessons.map(l => calibratedTarget(l.ex, l.ex.level || level, p)); };
  const acts = lessonActions(root, { get: () => ({ lessons, targets }), reason: l => `Technique library: ${t.title}`, title: l => `${t.title}: ${l.ex.name}`, navigate });
  function render() {
    acts.stop(); build();
    const arts = artistsUsing(id), you = yourLevel(p, t);
    const groups = [];
    lessons.forEach((l, i) => { let g = groups[groups.length - 1]; if (!g || g.skill !== l.skill) groups.push(g = { skill: l.skill, items: [] }); g.items.push(i); });
    root.innerHTML = `<a class="link" href="#/techniques">← Technique library</a>
      <div class="exhead"><div class="label">${esc(domName(t.domain))} · levels ${lo}–${hi}</div><h1>${esc(t.title)}</h1><p class="why">${esc(t.summary)}</p></div>
      <div class="artist-cols">
        <div class="artist-lessons">
          <section class="card tech-level">
            <div class="sec-head"><h3>Level ${level} · ${esc(tierName(level))}</h3><span class="small muted">Your ${esc(domName(t.domain)).toLowerCase()} level: ${you}</span></div>
            <p class="small muted">The lessons are rebuilt for the level you pick: tempo goals, length and subdivisions change with it.</p>
            <div class="chips">${Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map(l => `<button class="chip ${l === level ? 'on' : ''}" data-lv="${l}">${l}${l === you ? ' · you' : ''}</button>`).join('')}</div>
          </section>
          ${groups.map(g => `<section class="card"><div class="sec-head"><h3>${esc(g.skill.title)}</h3></div><p class="small muted">${esc(g.skill.summary)}</p>${g.items.map(i => lessonCardHTML(p, lessons[i], i, targets[i])).join('')}</section>`).join('')}
        </div>
        <aside class="artist-side">
          <section class="card"><h3>${MC_ICON} Master class</h3><p class="small muted">A whole course built around ${esc(t.title.toLowerCase())}: where to start, these lessons in order, and using it in real music.</p>
            <button class="btn primary block" data-tm="master">${MC_ICON} Build a master class</button></section>
          ${arts.length ? `<section class="card"><h3>Players who use it</h3><div class="riffs">${arts.map(a => `<div class="riff"><a class="link" href="#/artist/${a.id}"><b>${esc(a.name)}</b></a><div class="small muted">${esc(a.blurb)}</div></div>`).join('')}</div></section>` : ''}
        </aside>
      </div>`;
  }
  const onClick = e => {
    const lv = e.target.closest('[data-lv]');
    if (lv) { level = +lv.dataset.lv; render(); return; }
    if (e.target.closest('[data-tm="master"]')) { openMasterSheet({ title: t.title, domain: t.domain }, { navigate }); return; }
    acts.onClick(e);
  };
  root.addEventListener('click', onClick);
  render();
  return () => { acts.stop(); root.removeEventListener('click', onClick); };
}
