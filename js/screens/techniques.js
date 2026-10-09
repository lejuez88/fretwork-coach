// Technique Library: every technique, subject and style in the knowledge base,
// each taught as a learning path in four stages (foundations → intermediate →
// advanced → mastery). #/techniques lists them with filters; #/techniques/<id>
// shows the path: stages with your progress, each stage's lessons at a level
// you pick, a master class built from the path, and the players who use it.
// New entries added by the content runs (js/data/kb/) appear automatically.
import { esc, toast } from '../core/util.js';
import { Store } from '../core/store.js';
import { DOMAINS, DOMAIN_BY_KEY } from '../assessment/engine.js';
import { KB_INDEX, KB_BY_ID, KINDS, TIERS, TIER_BY_ID, artistsUsing, stageFor } from '../data/kb.js';
import { stageLessonList, techniqueLevelFor, createMasterClass, buildMasterTree, isMaster } from '../core/master.js';
import { calibratedTarget } from '../core/progression.js';
import { tierName } from '../core/courses.js';
import { MC_ICON } from '../ui/mastersheet.js';
import { lessonCardHTML, lessonActions, lessonState, lessonTarget } from '../ui/lessoncards.js';
import { pathStage, nextLesson } from '../core/coach.js';
import { methodOf } from '../core/methods.js';
import { requestBoxHTML, wireRequestBox } from '../ui/kbrequest.js';

const UI_KEY = 'fretworkCoach.techUI';
const getUI = () => { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch { return {}; } };
const setUI = v => { try { localStorage.setItem(UI_KEY, JSON.stringify(v)); } catch { /* storage off */ } };

const yourLevel = (p, t) => (p.domains && p.domains[t.domain] ? p.domains[t.domain].level : 4);
const domName = k => (DOMAIN_BY_KEY[k] ? DOMAIN_BY_KEY[k].short || DOMAIN_BY_KEY[k].name : k);
const hasTier = (t, id) => (t.stages || []).some(s => s.tier === id);
export const LEVEL_BANDS = [
  { id: 'foryou', name: 'For you', test: (t, p) => !!(t.stages || []).find(s => { const l = yourLevel(p, t); return l >= s.levels[0] - 1 && l <= s.levels[1]; }) },
  { id: 'beginner', name: 'Beginner (1–3)', test: t => hasTier(t, 'foundations') },
  { id: 'intermediate', name: 'Intermediate (4–6)', test: t => hasTier(t, 'intermediate') },
  { id: 'advanced', name: 'Advanced (7–10)', test: t => hasTier(t, 'advanced') || hasTier(t, 'mastery') },
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
  const ui = Object.assign({ band: 'foryou', domain: 'all', kind: 'all' }, getUI());
  if (!LEVEL_BANDS.some(b => b.id === ui.band)) ui.band = 'foryou';
  const domains = DOMAINS.filter(d => KB_INDEX.some(t => t.domain === d.key));
  const kinds = KINDS.filter(([k]) => KB_INDEX.some(t => (t.kind || 'technique') === k));
  let offReq = null;
  function render() {
    const list = filterTechniques(p, ui.band, ui.domain, ui.kind), full = KB_INDEX.filter(t => t.complete).length;
    root.innerHTML = `<a class="link" href="#/practice">← Practice</a>
      <div class="exhead"><div class="label">Technique library</div><h1>Learn anything, from scratch to mastery</h1>
        <p class="why">${KB_INDEX.length} techniques${kinds.length > 1 ? ', subjects and styles' : ''}, each a path in four stages: foundations, intermediate, advanced and mastery. ${full ? `${full} ${full === 1 ? 'path is' : 'paths are'} complete; the` : 'The'} rest are filling in as new lessons are researched and added.</p></div>
      <div class="tech-filters">
        ${kinds.length > 1 ? `<div class="chips" role="group" aria-label="Kind"><button class="chip ${ui.kind === 'all' ? 'on' : ''}" data-kind="all">Everything</button>${kinds.map(([k, n]) => `<button class="chip ${ui.kind === k ? 'on' : ''}" data-kind="${k}">${esc(n)}</button>`).join('')}</div>` : ''}
        <div class="chips" role="group" aria-label="Level">${LEVEL_BANDS.map(b => `<button class="chip ${ui.band === b.id ? 'on' : ''}" data-band="${b.id}">${esc(b.name)}</button>`).join('')}</div>
        <div class="chips" role="group" aria-label="Skill area"><button class="chip ${ui.domain === 'all' ? 'on' : ''}" data-dom="all">All areas</button>${domains.map(d => `<button class="chip ${ui.domain === d.key ? 'on' : ''}" data-dom="${d.key}">${esc(d.short || d.name)}</button>`).join('')}</div>
      </div>
      ${list.length ? '' : `<section class="card"><p class="muted">Nothing matches${ui.band === 'foryou' ? ' your current levels with these filters' : ''}. Try another level or area.</p></section>`}
      <div class="tech-grid">${list.map(t => {
        const you = yourLevel(p, t), st = stageFor(t, you), arts = artistsUsing(t.id);
        return `<a class="tech-card" href="#/techniques/${t.id}">
          <div class="tc-top"><span class="tc-dom">${esc(t.kind && t.kind !== 'technique' ? t.kind + ' · ' : '')}${esc(domName(t.domain))}</span>${stageDots(t)}</div>
          <b>${esc(t.title)}</b><p class="small muted">${esc(t.summary)}</p>
          <div class="small">${t.complete ? '<span class="ok">Full path</span> · ' : ''}${t.lessons} lesson${t.lessons === 1 ? '' : 's'} · levels ${t.level[0]}–${t.level[1]}</div>
          <div class="small tc-fit fit">${st ? `Start at: ${esc(TIER_BY_ID[st.tier].name)} (you're at ${you})` : ''}</div>
          ${arts.length ? `<div class="small muted">Used by ${arts.map(a => esc(a.name)).join(', ')}</div>` : ''}
        </a>`;
      }).join('')}</div>
      <section class="card" data-r="req">${requestBoxHTML({ title: 'Don’t see it?', hint: 'Name a technique, subject, style or guitarist and it goes into the research queue. New lessons are researched and added twice a week.' })}</section>`;
    if (offReq) offReq();
    offReq = wireRequestBox(root.querySelector('[data-r="req"]'), { navigate });
  }
  const onClick = e => {
    const b = e.target.closest('[data-band],[data-dom],[data-kind]'); if (!b) return;
    if (b.dataset.band) ui.band = b.dataset.band; else if (b.dataset.dom) ui.domain = b.dataset.dom; else ui.kind = b.dataset.kind;
    setUI(ui); render();
  };
  root.addEventListener('click', onClick);
  render();
  return () => { if (offReq) offReq(); root.removeEventListener('click', onClick); };
}

/** #/techniques/<id>: one learning path. */
export function mountTechnique(root, { navigate, id }) {
  const p = Store.profile, t = KB_BY_ID[id];
  if (!t) { navigate('#/techniques'); return () => {}; }
  const you = yourLevel(p, t);
  // Where the app says to work: refined by the coach once your progress on every stage is known
  let startStage = stageFor(t, techniqueLevelFor(p, id)) || t.stages[0], startReason = '', chosenByHand = false, levelOpen = false;
  let tier = startStage.tier, level = Math.min(Math.max(techniqueLevelFor(p, id), startStage.levels[0]), startStage.levels[1]);
  const fitLevel = s => Math.min(Math.max(you, s.levels[0]), s.levels[1]);
  let lessons = [], targets = [], keysByTier = {}, ready = false, gone = false, building = false;
  const acts = lessonActions(root, { get: () => ({ lessons, targets }), reason: () => `${t.title} path: ${TIER_BY_ID[tier].name}`, title: l => `${t.title}: ${l.ex.name}`, navigate });
  const masterFor = () => p.courses.find(c => isMaster(c) && c.status !== 'archived' && c.topic && c.topic.kbId === id) || null;

  const progressOf = tid => {
    const keys = keysByTier[tid] || [], sts = keys.map(k => (p.varState || {})[`${k}~base`]).filter(Boolean);
    return { total: keys.length, mastered: sts.filter(x => x.mastered).length, practiced: sts.filter(x => x.history && x.history.length).length };
  };
  async function load() {
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
  /** The lesson the app picks next on this path (on the recommended stage), or how to get back to it. */
  function nextHTML() {
    const rs = TIER_BY_ID[startStage.tier];
    if (tier !== startStage.tier) return `<section class="card nextlesson muted-card"><p class="small">You’re looking at the ${esc(TIER_BY_ID[tier].name)} stage. The app recommends <b>${esc(rs.name)}</b> for you right now${startReason ? `: ${esc(startReason.charAt(0).toLowerCase() + startReason.slice(1))}` : '.'}</p>
      <button class="btn sm" data-tier="${startStage.tier}">← Back to my recommended stage</button></section>`;
    const nx = nextLesson(p, lessons, { label: `the ${rs.name.toLowerCase()} stage` });
    if (!nx) {
      const i = t.stages.findIndex(s => s.tier === tier), nextSt = t.stages[i + 1];
      return `<section class="card nextlesson"><div class="label">Stage complete</div><b>Every ${esc(rs.name.toLowerCase())} lesson is mastered.</b>
        ${nextSt ? `<button class="btn primary block" data-tier="${nextSt.tier}">Go on to ${esc(TIER_BY_ID[nextSt.tier].name)} ›</button>` : '<p class="small">You’ve reached the top of this path. Keep it alive with the review in your daily lessons.</p>'}</section>`;
    }
    const l = lessons[nx.index];
    return `<section class="card nextlesson"><div class="label">Your next lesson · chosen for you</div>
      <b>${esc(l.ex.name)}</b>
      <p class="small">${esc(TIER_BY_ID[tier].name)} stage${startReason ? ` (${esc(startReason.charAt(0).toLowerCase() + startReason.slice(1).replace(/\.$/, ''))})` : ''}. ${esc(nx.reason)}</p>
      <div class="row"><button class="btn primary" data-al="practice" data-i="${nx.index}">▶ Start this lesson</button><button class="btn" data-jump="${nx.index}">Show it below</button></div></section>`;
  }
  /** How this stage teaches: the learning methods its lessons use, with the evidence behind each. */
  function methodsHTML() {
    const ids = [...new Set(lessons.map(l => l.ex.method).filter(m => methodOf(m)))];
    if (!ids.length) return '';
    return `<section class="card methods"><h3>How this stage teaches</h3><p class="small muted">Each lesson uses a practice method with research behind it. Tap one for the evidence.</p>
      ${ids.map(id => { const m = methodOf(id); return `<details class="method"><summary><b>${esc(m.name)}</b> <span class="small muted">${esc(m.short)}</span></summary><p class="small">${esc(m.detail)}</p><p class="small muted">${esc(m.source)} <i>${esc(m.strength)}</i></p></details>`; }).join('')}</section>`;
  }
  function render() {
    acts.stop();
    const st = t.stages.find(s => s.tier === tier), arts = artistsUsing(id), mc = masterFor();
    const groups = [];
    lessons.forEach((l, i) => { let g = groups[groups.length - 1]; if (!g || g.skill !== l.skill) groups.push(g = { skill: l.skill, items: [] }); g.items.push(i); });
    const missing = TIERS.filter(x => !hasTier(t, x.id));
    root.innerHTML = `<a class="link" href="#/techniques">← Technique library</a>
      <div class="exhead"><div class="label">${esc(t.kind && t.kind !== 'technique' ? t.kind + ' · ' : '')}${esc(domName(t.domain))} · levels ${t.level[0]}–${t.level[1]}</div><h1>${esc(t.title)}</h1><p class="why">${esc(t.summary)}</p></div>
      <div class="path">${TIERS.map(x => {
        const s = t.stages.find(y => y.tier === x.id);
        if (!s) return `<div class="path-stage missing"><span class="ps-name">${esc(x.name)}</span><span class="small muted">Levels ${x.levels[0]}–${x.levels[1]}</span><span class="small muted">Coming: being researched</span></div>`;
        const pr = progressOf(x.id), here = startStage.tier === x.id;
        return `<button class="path-stage ${x.id === tier ? 'on' : ''}" data-tier="${x.id}"><span class="ps-name">${esc(x.name)}${here ? ' <span class="ps-here">Start here</span>' : ''}</span>
          <span class="small muted">Levels ${s.levels[0]}–${s.levels[1]} · ${s.lessons} lesson${s.lessons === 1 ? '' : 's'}</span>
          <span class="ps-bar"><i style="width:${pr.total ? Math.round(pr.mastered / pr.total * 100) : 0}%"></i></span>
          <span class="small">${pr.mastered ? `${pr.mastered}/${pr.total} mastered` : pr.practiced ? `${pr.practiced} practiced` : 'Not started'}</span></button>`;
      }).join('')}</div>
      <div class="artist-cols">
        <div class="artist-lessons">
          ${ready ? nextHTML() : ''}
          ${st ? `<section class="card tech-level">
            <div class="sec-head"><h3>${esc(TIER_BY_ID[tier].name)}: ${esc(st.title)}</h3><span class="small muted">Level ${level} · your ${esc(domName(t.domain)).toLowerCase()} level: ${you}</span></div>
            <p class="small"><b>Goal:</b> ${esc(st.goal)}</p>
            ${st.levels[1] > st.levels[0] ? `<details class="customize" ${levelOpen ? 'open' : ''}><summary>Customize: build these lessons at another level</summary>
              <div class="chips">${Array.from({ length: st.levels[1] - st.levels[0] + 1 }, (_, i) => st.levels[0] + i).map(l => `<button class="chip ${l === level ? 'on' : ''}" data-lv="${l}">Level ${l}${l === you ? ' · you' : ''}</button>`).join('')}</div>
              <p class="small muted">Tempo goals, length and subdivisions change with the level. The app picks the level that fits you by default.</p></details>` : ''}
          </section>` : ''}
          ${!ready ? '<p class="muted"><span class="spinner sm"></span> Loading lessons…</p>' : groups.map(g => `<section class="card"><div class="sec-head"><h3>${esc(g.skill.title)}</h3></div><p class="small muted">${esc(g.skill.summary)}</p>${g.items.map(i => lessonCardHTML(p, lessons[i], i, targets[i])).join('')}</section>`).join('')}
        </div>
        <aside class="artist-side">
          <section class="card"><h3>${MC_ICON} The whole path as a course</h3>
            <p class="small muted">Every stage from ${esc(TIER_BY_ID[startStage.tier].name.toLowerCase())} up, in order, as a master class with progress and reviews. Built from these lessons (no API cost).</p>
            ${mc ? `<a class="btn primary block" href="#/course/${mc.id}">${MC_ICON} Open your ${esc(t.title)} course</a>` : `<button class="btn primary block" data-tm="master" ${building ? 'disabled' : ''}>${building ? '<span class="spinner sm"></span>Building…' : `${MC_ICON} Start the ${esc(t.title)} path`}</button>`}</section>
          ${missing.length ? `<section class="card"><h3>Still to come</h3><p class="small muted">${missing.map(x => esc(x.name)).join(', ')} ${missing.length === 1 ? 'stage is' : 'stages are'} being researched and added to this path. The research runs (twice a week) fill incomplete paths first.</p></section>` : ''}
          ${methodsHTML()}
          ${arts.length ? `<section class="card"><h3>Players who use it</h3><div class="riffs">${arts.map(a => `<div class="riff"><a class="link" href="#/artist/${a.id}"><b>${esc(a.name)}</b></a><div class="small muted">${esc(a.blurb)}</div></div>`).join('')}</div></section>` : ''}
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
    if (ti) { tier = ti.dataset.tier; chosenByHand = tier !== startStage.tier; const s = t.stages.find(x => x.tier === tier); level = fitLevel(s); ready = false; render(); loadStage(); return; }
    const jump = e.target.closest('[data-jump]');
    if (jump) { const card = root.querySelector(`[data-artslot="${jump.dataset.jump}"]`); const box = card && card.closest('.artist-lesson'); if (box) { box.classList.add('flash'); try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* ignore */ } setTimeout(() => box.classList.remove('flash'), 1600); } return; }
    const lv = e.target.closest('[data-lv]');
    if (lv) { level = +lv.dataset.lv; levelOpen = true; ready = false; render(); loadStage(); return; }
    if (e.target.closest('[data-tm="master"]')) { startPath(); return; }
    acts.onClick(e);
  };
  root.addEventListener('click', onClick);
  render();
  load().catch(e => { if (!gone) root.innerHTML = `<a class="link" href="#/techniques">← Technique library</a><p class="bad">Couldn’t load the lessons (${esc(e.message)}). Check the connection and reload.</p>`; });
  return () => { gone = true; acts.stop(); root.removeEventListener('click', onClick); };
}
