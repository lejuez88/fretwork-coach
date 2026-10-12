// Technique Library: every technique, subject and style in the knowledge base,
// each taught as a learning path in four stages (foundations → intermediate →
// advanced → mastery). #/techniques lists them with filters; #/techniques/<id>
// shows the path: stages with your progress, each stage's lessons at a level
// you pick, a master class built from the path, and the players who use it.
// New entries added by the content runs (js/data/kb/) appear automatically.
import { esc, toast } from '../core/util.js';
import { Store } from '../core/store.js';
import { DOMAINS, DOMAIN_BY_KEY } from '../assessment/engine.js';
import { KB_INDEX, KB_BY_ID, KINDS, TIERS, TIER_BY_ID, artistsUsing, stageFor, loadEntry } from '../data/kb.js';
import { stageLessonList, techniqueLevelFor, createMasterClass, buildMasterTree, isMaster } from '../core/master.js';
import { calibratedTarget } from '../core/progression.js';
import { tierName } from '../core/courses.js';
import { MC_ICON } from '../ui/mastersheet.js';
import { lessonGroupHTML, lessonActions, lessonState, lessonTarget } from '../ui/lessoncards.js';
import { pathStage, nextLesson } from '../core/coach.js';
import { levelDots, levelBand, LEVEL_BANDS as COLOR_BANDS } from '../ui/colors.js';
const levelBandName = l => levelBand(l).name;
import { methodOf } from '../core/methods.js';
import { requestBoxHTML, wireRequestBox } from '../ui/kbrequest.js';
import { guestNoteHTML, isGuest } from '../ui/guest.js';

const UI_KEY = 'fretworkCoach.techUI';
const getUI = () => { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch { return {}; } };
const setUI = v => { try { localStorage.setItem(UI_KEY, JSON.stringify(v)); } catch { /* storage off */ } };

const yourLevel = (p, t) => (p.domains && p.domains[t.domain] ? p.domains[t.domain].level : 4);
const domName = k => (DOMAIN_BY_KEY[k] ? DOMAIN_BY_KEY[k].short || DOMAIN_BY_KEY[k].name : k);
const hasTier = (t, id) => (t.stages || []).some(s => s.tier === id);
export const LEVEL_BANDS = [
  { id: 'foryou', name: 'For you', test: (t, p) => !!(t.stages || []).find(s => { const l = yourLevel(p, t); return l >= s.levels[0] - 1 && l <= s.levels[1]; }) },
  { id: 'foundations', name: 'Foundations', test: t => hasTier(t, 'foundations') },
  { id: 'intermediate', name: 'Intermediate', test: t => hasTier(t, 'intermediate') },
  { id: 'advanced', name: 'Advanced', test: t => hasTier(t, 'advanced') },
  { id: 'mastery', name: 'Mastery', test: t => hasTier(t, 'mastery') },
  { id: 'all', name: 'All', test: () => true }
];
/** Entries passing the filters, full paths first, then easiest first. */
export function filterTechniques(p, band = 'all', domain = 'all', kind = 'all') {
  const b = LEVEL_BANDS.find(x => x.id === band) || LEVEL_BANDS[LEVEL_BANDS.length - 1];
  return KB_INDEX.filter(t => b.test(t, p) && (domain === 'all' || t.domain === domain) && (kind === 'all' || (t.kind || 'technique') === kind))
    .sort((a, c) => (c.complete ? 1 : 0) - (a.complete ? 1 : 0) || a.level[0] - c.level[0] || a.title.localeCompare(c.title));
}
/** Four little blocks: which stages of the path exist. */
const stageDots = t => `<span class="stage-dots" title="${TIERS.map(x => `${x.name}: ${hasTier(t, x.id) ? 'ready' : 'coming'}`).join(' · ')}">${TIERS.map(x => `<i class="${hasTier(t, x.id) ? 'on' : ''}"></i>`).join('')}</span>`;

/** #/techniques: the whole library with kind, level and skill-area filters. */
export function mountTechniqueIndex(root, { navigate }) {
  const p = Store.profile;
  const guest = isGuest(p);
  const ui = Object.assign({ band: guest ? 'all' : 'foryou', domain: 'all', kind: 'all' }, getUI());
  if (!LEVEL_BANDS.some(b => b.id === ui.band) || (guest && ui.band === 'foryou')) ui.band = guest ? 'all' : 'foryou';
  const domains = DOMAINS.filter(d => KB_INDEX.some(t => t.domain === d.key));
  const kinds = KINDS.filter(([k]) => KB_INDEX.some(t => (t.kind || 'technique') === k));
  let offReq = null;
  function render() {
    const list = filterTechniques(p, ui.band, ui.domain, ui.kind), full = KB_INDEX.filter(t => t.complete).length;
    root.innerHTML = `<a class="link" href="#/practice">← Practice</a>
      <div class="exhead"><div class="label">Technique library</div><h1>Learn anything, from scratch to mastery</h1>
        <p class="why">${KB_INDEX.length} techniques${kinds.length > 1 ? ', subjects and styles' : ''}, each a path in four stages: foundations, intermediate, advanced and mastery. ${full ? `${full} ${full === 1 ? 'path is' : 'paths are'} complete; the` : 'The'} rest are filling in as new lessons are researched and added.</p></div>
      <div class="tech-filters">
        ${kinds.length > 1 ? `<div class="chips" role="group" aria-label="Kind"><button class="chip ${ui.kind === 'all' ? 'on' : ''}" data-kind="all">Everything</button>${kinds.map(([k, n]) => `<button class="chip kind-chip kind-${k} ${ui.kind === k ? 'on' : ''}" data-kind="${k}">${esc(n)}</button>`).join('')}</div>` : ''}
        <div class="chips" role="group" aria-label="Level">${LEVEL_BANDS.filter(b => !(guest && b.id === 'foryou')).map(b => `<button class="chip ${ui.band === b.id ? 'on' : ''}" data-band="${b.id}">${esc(b.name)}</button>`).join('')}</div>
        <div class="chips" role="group" aria-label="Skill area"><button class="chip ${ui.domain === 'all' ? 'on' : ''}" data-dom="all">All areas</button>${domains.map(d => `<button class="chip dom-chip dom-${d.key} ${ui.domain === d.key ? 'on' : ''}" data-dom="${d.key}">${esc(d.short || d.name)}</button>`).join('')}</div>
        <div class="tech-legend small muted"><span>Outline: ${kinds.map(([k, n]) => `<i class="kdot kind-${k}"></i>${esc(n.replace(/s$/, ''))}`).join(' ')}</span>${guest ? '' : `<span class="lvl-key">Pills: your level ${COLOR_BANDS.map(b => `<span><i class="lvl-sw lvl-${b.id}"></i>${esc(b.name)}</span>`).join('')}</span>`}</div>
      </div>
      ${list.length ? '' : `<section class="card"><p class="muted">Nothing matches${ui.band === 'foryou' ? ' your current levels with these filters' : ''}. Try another tier or area.</p></section>`}
      <div class="tech-bubbles">${list.map(t => {
        const you = yourLevel(p, t), open = ui.open === t.id;
        return `<div class="tech-bubble kind-${t.kind || 'technique'} dom-${t.domain} ${open ? 'open' : ''}" data-tb="${t.id}">
          <button class="tb-head" data-tbopen="${t.id}" aria-expanded="${open}">
            <span class="tb-dom">${esc(domName(t.domain))}</span>${guest ? '' : levelDots(you, `Your ${domName(t.domain).toLowerCase()}: ${levelBandName(you)}`)}
            <b>${esc(t.title)}</b>
          </button>
        </div>`;
      }).join('')}${detailHTML(list.find(t => t.id === ui.open))}</div>
      <section class="card" data-r="req">${requestBoxHTML({ title: 'Don’t see it?', hint: 'Name a technique, subject, style or guitarist and it goes into the research queue. New lessons are researched and added every day.' })}</section>`;
    if (offReq) offReq();
    offReq = wireRequestBox(root.querySelector('[data-r="req"]'), { navigate });
    placeDetail();
  }
  /** The open bubble's details: a panel across the whole row, under the row that holds the bubble (bubbles stay one size). */
  function detailHTML(t) {
    if (!t) return '';
    const you = yourLevel(p, t), st = stageFor(t, you), arts = artistsUsing(t.id);
    return `<div class="tb-detail kind-${t.kind || 'technique'} dom-${t.domain}" data-tbdetail="${t.id}">
      <div class="tb-dhead"><span class="tb-dom">${esc(domName(t.domain))}</span><b>${esc(t.title)}</b><button class="linkbtn small" data-tbopen="${t.id}" aria-label="Close">Close ✕</button></div>
      <div class="tb-body">
            <p class="small muted">${esc(t.summary)}</p>
            <div class="small muted tb-stages">Stages ready ${stageDots(t)}</div>
            <div class="small">${t.complete ? '<span class="ok">Full path</span> · ' : ''}${t.lessons} lesson${t.lessons === 1 ? '' : 's'}${t.kind && t.kind !== 'technique' ? ` · ${esc(t.kind)}` : ''}</div>
            ${st && !guest ? `<div class="small fit">Recommended: ${esc(TIER_BY_ID[st.tier].name)}</div>` : ''}
            ${arts.length ? `<div class="small muted">Used by ${arts.map(a => esc(a.name)).join(', ')}</div>` : ''}
            <a class="btn sm primary" href="#/techniques/${t.id}">Open the path ›</a>
      </div>
    </div>`;
  }
  /** Moves the details panel to just after the last bubble in the open bubble's row; again on resize. */
  function placeDetail() {
    const grid = root.querySelector('.tech-bubbles'), det = grid && grid.querySelector('.tb-detail'); if (!det) return;
    const openB = grid.querySelector('.tech-bubble.open'); if (!openB) return;
    const all = [...grid.querySelectorAll('.tech-bubble')], top = openB.offsetTop;
    let last = openB; for (const b of all.slice(all.indexOf(openB) + 1)) { if (b.offsetTop !== top) break; last = b; }
    if (last.nextSibling !== det) last.after(det);
    const r = openB.getBoundingClientRect(), g = grid.getBoundingClientRect();
    det.style.setProperty('--notch', `${Math.max(18, r.left - g.left + r.width / 2 - 8)}px`);
  }
  const onClick = e => {
    const tb = e.target.closest('[data-tbopen]');
    if (tb) { ui.open = ui.open === tb.dataset.tbopen ? null : tb.dataset.tbopen; setUI(ui); render(); return; }
    const b = e.target.closest('[data-band],[data-dom],[data-kind]'); if (!b) return;
    if (b.dataset.band) ui.band = b.dataset.band; else if (b.dataset.dom) ui.domain = b.dataset.dom; else ui.kind = b.dataset.kind;
    setUI(ui); render();
  };
  root.addEventListener('click', onClick);
  const onResize = () => placeDetail();
  window.addEventListener('resize', onResize);
  render();
  return () => { if (offReq) offReq(); root.removeEventListener('click', onClick); window.removeEventListener('resize', onResize); };
}

/** #/techniques/<id>: one learning path. */
export function mountTechnique(root, { navigate, id }) {
  const p = Store.profile, t = KB_BY_ID[id];
  if (!t) { navigate('#/techniques'); return () => {}; }
  const you = yourLevel(p, t);
  // Where the app says to work: refined by the coach once your progress on every stage is known
  let startStage = stageFor(t, techniqueLevelFor(p, id)) || t.stages[0], startReason = '', chosenByHand = false;
  let tier = startStage.tier, level = Math.min(Math.max(techniqueLevelFor(p, id), startStage.levels[0]), startStage.levels[1]);
  const fitLevel = s => Math.min(Math.max(you, s.levels[0]), s.levels[1]);
  let lessons = [], targets = [], keysByTier = {}, ready = false, gone = false, building = false, full = null;
  const acts = lessonActions(root, { get: () => ({ lessons, targets }), reason: () => `${t.title} path: ${TIER_BY_ID[tier].name}`, title: l => `${t.title}: ${l.ex.name}`, navigate, listTitle: () => t.title });
  const masterFor = () => p.courses.find(c => isMaster(c) && c.status !== 'archived' && c.topic && c.topic.kbId === id) || null;

  const progressOf = tid => {
    const keys = keysByTier[tid] || [], sts = keys.map(k => (p.varState || {})[`${k}~base`]).filter(Boolean);
    return { total: keys.length, mastered: sts.filter(x => x.mastered).length, practiced: sts.filter(x => x.history && x.history.length).length };
  };
  async function load() {
    try { full = await loadEntry(id); } catch { full = null; }
    // lesson keys for every stage (to show progress), then the selected stage's lessons
    for (const st of t.stages) keysByTier[st.tier] = (await stageLessonList(p, id, { tier: st.tier, lvl: st.levels[0] })).map(l => l.key);
    const ps = pathStage(p, t, progressOf);
    if (ps && ps.stage) { startStage = ps.stage; startReason = ps.reason; if (!chosenByHand) { tier = startStage.tier; level = fitLevel(startStage); } }
    await loadStage();
  }
  async function loadStage() {
    lessons = await stageLessonList(p, id, { tier, lvl: level });
    targets = lessons.map(l => lessonTarget(p, l, calibratedTarget(l.ex, l.ex.level || level, p)));
    ready = true; if (!gone) render();
  }
  /** The next lesson in the tier on screen: the app's pick in the recommended tier, the start of any other. */
  function nextHTML() {
    if (isGuest(p)) return guestNoteHTML('Pick any tier and lesson. With a player profile, the app recommends a tier, chooses your next lesson and keeps your progress.');
    const ts = TIER_BY_ID[tier], recd = tier === startStage.tier;
    const nx = nextLesson(p, lessons, { label: `the ${ts.name.toLowerCase()} tier` });
    if (!nx) {
      const i = t.stages.findIndex(s => s.tier === tier), nextSt = t.stages[i + 1];
      return `<section class="card nextlesson"><div class="label">Tier complete</div><b>Every ${esc(ts.name.toLowerCase())} lesson is mastered.</b>
        ${nextSt ? `<button class="btn primary block" data-tier="${nextSt.tier}">Go on to ${esc(TIER_BY_ID[nextSt.tier].name)} ›</button>` : '<p class="small">You’ve reached the top of this path. Keep it alive with the review in your daily lessons.</p>'}</section>`;
    }
    const l = lessons[nx.index];
    return `<section class="card nextlesson"><div class="label">${recd ? 'Your next lesson · chosen for you' : `Next lesson · ${esc(ts.name)}`}</div>
      <b>${esc(l.ex.name)}</b><p class="small">${esc(nx.reason)}</p>
      <div class="row"><button class="btn primary" data-al="practice" data-i="${nx.index}">▶ Start this lesson</button><button class="btn" data-jump="${nx.index}">Show it in the list</button></div></section>`;
  }
  /** How this topic is taught: the standard teaching steps for this tier, from the sources on record. */
  function pedagogyHTML() {
    const pd = full && full.pedagogy;
    if (!t.taught || !pd) return `<section class="card how-taught pending"><h3>How it’s taught</h3><p class="small muted">This path is being checked against how guitar teachers and method books teach ${esc(t.title.toLowerCase())}. Lessons that don’t match a standard method will be rewritten.</p></section>`;
    const steps = (pd.sequence || []).filter(x => x.tier === tier);
    const src = (pd.sources || []).map(x => (typeof x === 'string' ? { url: x, title: x.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] } : x));
    return `<section class="card how-taught"><h3>How it’s taught</h3><p class="small">${esc(pd.summary || '')}</p>
      ${steps.length ? `<ol class="ht-steps">${steps.map(x => `<li><b>${esc(x.step)}</b><span class="small muted">${esc(x.how)}</span></li>`).join('')}</ol>` : ''}
      <details class="small ht-src"><summary>Sources</summary><ul>${src.map(x => `<li>${x.url ? `<a class="link" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title || x.url)}</a>` : `<i>${esc(x.title)}</i>`}${x.author ? `, ${esc(x.author)}` : ''}</li>`).join('')}</ul></details></section>`;
  }
  function render() {
    acts.stop();
    const st = t.stages.find(s => s.tier === tier), arts = artistsUsing(id), mc = masterFor();
    const groups = [];
    lessons.forEach((l, i) => { let g = groups[groups.length - 1]; if (!g || g.skill !== l.skill) groups.push(g = { skill: l.skill, items: [] }); g.items.push(i); });
    const missing = TIERS.filter(x => !hasTier(t, x.id));
    root.innerHTML = `<a class="link" href="#/techniques">← Technique library</a>
      <div class="exhead"><div class="label">${esc(t.kind && t.kind !== 'technique' ? t.kind + ' · ' : '')}${esc(domName(t.domain))}</div><h1>${esc(t.title)}</h1><p class="why">${esc(t.summary)}</p></div>
      <div class="path">${TIERS.map(x => {
        const s = t.stages.find(y => y.tier === x.id);
        if (!s) return `<div class="path-stage missing"><span class="ps-name">${esc(x.name)}</span><span class="small muted">Coming soon</span></div>`;
        const pr = progressOf(x.id), here = !isGuest(p) && startStage.tier === x.id;
        return `<button class="path-stage ${x.id === tier ? 'on' : ''} ${here ? 'rec' : ''}" data-tier="${x.id}"><span class="ps-name">${esc(x.name)}${here ? ' <span class="ps-here">Recommended</span>' : ''}</span>
          <span class="small muted">${s.lessons} lesson${s.lessons === 1 ? '' : 's'}</span>
          <span class="ps-bar"><i style="width:${pr.total ? Math.round(pr.mastered / pr.total * 100) : 0}%"></i></span>
          <span class="small">${pr.mastered ? `${pr.mastered}/${pr.total} mastered` : pr.practiced ? `${pr.practiced} practiced` : 'Not started'}</span></button>`;
      }).join('')}</div>
      <div class="page-cols">
        <div class="pc-main">
          ${st ? `<section class="card tech-level">
            <h3>${esc(TIER_BY_ID[tier].name)}: ${esc(st.title)}</h3>
            <p class="small"><b>Goal:</b> ${esc(st.goal)}</p>
          </section>` : ''}
          ${pedagogyHTML()}
          ${missing.length ? `<section class="card"><h3>Still to come</h3><p class="small muted">${missing.map(x => esc(x.name)).join(', ')} ${missing.length === 1 ? 'stage is' : 'stages are'} being researched and added to this path. The daily research runs fill incomplete paths first.</p></section>` : ''}
          ${arts.length ? `<section class="card"><h3>Players who use it</h3><div class="riffs">${arts.map(a => `<div class="riff"><a class="link" href="#/artist/${a.id}"><b>${esc(a.name)}</b></a><div class="small muted">${esc(a.blurb)}</div></div>`).join('')}</div></section>` : ''}
        </div>
        <aside class="pc-side">
          ${ready ? nextHTML() : ''}
          <section class="card side-course"><h3>${MC_ICON} The whole path as a course</h3>
            <p class="small muted">${isGuest(p) ? 'Every stage in order, as a master class with progress and reviews. Courses follow your level and keep your progress, so they need a player profile.' : `Every stage from ${esc(TIER_BY_ID[startStage.tier].name.toLowerCase())} up, in order, as a master class with progress and reviews. Built from these lessons (no API cost).`}</p>
            ${isGuest(p) ? '<a class="btn block" href="#/welcome">Create a profile to take it as a course</a>' : mc ? `<a class="btn primary block" href="#/course/${mc.id}">${MC_ICON} Open your ${esc(t.title)} course</a>` : `<button class="btn primary block" data-tm="master" ${building ? 'disabled' : ''}>${building ? '<span class="spinner sm"></span>Building…' : `${MC_ICON} Start the ${esc(t.title)} path`}</button>`}</section>
          <div class="artist-lessons"><h2 class="sechead">Lessons${st ? ` · ${esc(TIER_BY_ID[tier].name)}` : ''}</h2>
          ${!ready ? '<p class="muted"><span class="spinner sm"></span> Loading lessons…</p>' : groups.map((g, gi) => lessonGroupHTML(p, lessons, targets, { title: g.skill.title, items: g.items }, gi, { note: g.skill.summary ? `<p class="small muted lg-note">${esc(g.skill.summary)}</p>` : '' })).join('')}</div>
        </aside>
      </div>`;
  }
  async function startPath() {
    if (building) return;
    building = true; render();
    const course = createMasterClass(p, { title: t.title, domain: t.domain, difficulty: techniqueLevelFor(p, id) });
    course.topic.kbId = id;
    try {
      const r = await buildMasterTree(p, course);
      Store.save(); toast(`${MC_ICON} “${course.name}” is ready.${r.source === 'path' || r.source === 'local' ? ' Built from the path’s lessons (no API cost).' : ''}`, 4200);
      building = false; navigate(`#/course/${course.id}`);
    } catch (e) {
      p.courses = p.courses.filter(c => c.id !== course.id);
      building = false; toast(e.message || 'The course couldn’t be built.'); render();
    }
  }
  const onClick = e => {
    const ti = e.target.closest('[data-tier]');
    if (ti) { tier = ti.dataset.tier; chosenByHand = tier !== startStage.tier; const s = t.stages.find(x => x.tier === tier); level = chosenByHand ? s.levels[0] : fitLevel(s); ready = false; render(); loadStage(); return; }
    const jump = e.target.closest('[data-jump]');
    if (jump) { const box = acts.open(jump.dataset.jump, { scroll: true }); if (box) { box.classList.add('flash'); setTimeout(() => box.classList.remove('flash'), 1600); } return; }
    if (e.target.closest('[data-tm="master"]')) { startPath(); return; }
    acts.onClick(e);
  };
  root.addEventListener('click', onClick);
  render();
  load().catch(e => { if (!gone) root.innerHTML = `<a class="link" href="#/techniques">← Technique library</a><p class="bad">Couldn’t load the lessons (${esc(e.message)}). Check the connection and reload.</p>`; });
  return () => { gone = true; acts.stop(); root.removeEventListener('click', onClick); };
}
