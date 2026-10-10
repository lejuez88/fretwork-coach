// Course detail with the progress tree: units → skills (nodes) → exercises.
// Nodes show locked / available / in progress / mastered, plus review due.
import { esc, fmtMinutes, toast, today } from '../core/util.js';
import { Store } from '../core/store.js';
import { beatLabel } from '../core/tempo.js';
import { Claude } from '../core/claude.js';
import { wikiTile, hydrateImages } from '../core/wiki.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { buildCourseTree, isGenericPlan, generateTreeLocal } from '../core/coursegen.js';
import { ensureState, progressPct } from '../core/progression.js';
import { DOMAIN_BY_KEY } from '../assessment/engine.js';
import { suggestedDifficulty, tierName } from '../core/courses.js';
import { isMaster, masterDifficulty } from '../core/master.js';
import { topicArtHTML, MC_ICON } from '../ui/mastersheet.js';
import { Shell } from '../ui/shell.js';
import { nextInCourse, recommendSession } from '../core/coach.js';
import { buildRoutine, coachBriefing } from '../core/routine.js';
import { startRoutine, attachBriefing } from './routine.js';
import { openPractice, courseContext } from './play.js';
import { variationsFor } from '../core/variations.js';
import { levelRange } from '../ui/variationpicker.js';

const STATUS = { locked: ['🔒', 'Locked'], available: ['●', 'Ready'], in_progress: ['◐', 'In progress'], mastered: ['✓', 'Mastered'] };

export function mountCourse(root, { id, navigate }) {
  const p = Store.profile, c = p.courses.find(x => x.id === id);
  if (!c) { root.innerHTML = '<section class="card"><p>Course not found.</p><a class="btn block" href="#/home">Back to dashboard</a></section>'; return () => {}; }
  const g = GENRE_BY_ID[c.genre];
  let building = false;
  const master = isMaster(c);
  // where your levels say this course should be now (master classes: the topic's skill area)
  const levelNow = () => (master ? masterDifficulty(p, c.topic || { title: c.style }) : suggestedDifficulty(p, c.genre));

  function render() {
    if (c.tree) { ensureState(c); c.progress = progressPct(c); }
    const sessions = p.practiceLog.filter(l => l.courseId === c.id), mins = sessions.reduce((a, l) => a + l.minutes, 0);
    root.innerHTML = `
      <a class="link" href="#/home">← Dashboard</a>
      <section class="card course-hero ${master ? 'master' : ''}">${master ? `<div class="mc-banner">${topicArtHTML(c.topic && c.topic.cat)}</div>` : wikiTile(g ? g.wiki : c.genre, g ? g.name : c.genre, 'banner')}
        <div class="label">${master ? `${MC_ICON} Master class · ${esc(c.topic ? c.topic.title : c.style)}` : `${esc(g ? g.name : c.genre)} · ${esc(c.style)}`} · level ${c.difficulty} (${esc(c.levelLabel)})</div>
        <h1>${esc(c.name)}</h1><p>${esc(c.tree && c.tree.summary || c.tagline)}</p>
        ${c.players.length ? `<p class="muted small">Inspired by ${c.players.map(esc).join(', ')}</p>` : ''}
        <div class="cprog big"><div class="bar"><i style="width:${c.progress || 0}%"></i></div><span>${c.progress || 0}%</span></div>
        <p class="small muted">${sessions.length} session${sessions.length === 1 ? '' : 's'} · ${fmtMinutes(mins)} practiced</p>
        ${nextHTML()}
      </section>
      ${isGenericPlan(c) ? `<section class="card levelup"><div class="label">New: a plan built for ${esc(c.style)}</div>
        <p>This course still uses the old standard plan, which was the same for every style. Rebuild it to get exercises in ${esc(c.style)}’s own keys, rhythms and techniques. Progress on the old exercises resets; your practice time and skill levels are kept.</p>
        <div class="row"><button class="btn primary" data-c="restyle">Rebuild for ${esc(c.style)}</button>${Claude.hasKey() ? '<button class="btn" data-c="rebuild">Have Claude design it</button>' : ''}</div></section>` : ''}
      ${c.tree && levelNow() > c.difficulty + 1 ? `<section class="card levelup"><div class="label">You’ve outgrown this plan</div>
        <p>Your skill levels for this ${master ? 'topic' : 'style'} are now about <b>${levelNow()}</b>, and this plan was built at level ${c.difficulty}. Untouched exercises already start at faster tempos; rebuilding gives you harder material.</p>
        <button class="btn primary block" data-c="levelup">Rebuild at level ${levelNow()}</button></section>` : ''}
      ${c.tree ? treeHTML() : `<section class="card"><h3>Progress tree</h3>
        <p class="muted">Build the full lesson plan for this course. ${Claude.hasKey() ? 'Claude designs it around your levels, goals and players (30–60 seconds).' : `Without an API key the built-in ${esc(c.style)} plan is used; add a key in Settings for one designed around you.`}</p>
        <button class="btn primary block" data-c="build" ${building ? 'disabled' : ''}>${building ? 'Building your course plan…' : 'Build course plan'}</button></section>`}
      <section class="card"><div class="row"><button class="btn" data-c="archive">Archive</button>${c.tree ? '<button class="btn" data-c="rebuild">Rebuild plan</button>' : ''}<button class="btn ghost danger" data-c="delete">Delete</button></div></section>`;
    hydrateImages(root);
  }

  /** Practice length for a guided lesson: today's usual practice time. */
  const lessonMinutes = () => (recommendSession(p) || {}).minutes || 30;
  /** The lesson the app picks next in this course, with the reason. */
  function nextHTML() {
    const nx = c.tree && nextInCourse(p, c);
    if (!nx) return `<a class="btn primary block" href="#/home/routine/${c.id}">▶ Practice this course</a>`;
    return `<div class="nextlesson"><div class="label">Your next lesson · chosen for you</div>
      <b>${esc(nx.skill.title)}</b><p class="small">${esc(nx.reason)}</p>
      <div class="row"><button class="btn primary" data-c="startnext">▶ Practice it</button><button class="btn" data-c="timed">⏱ Timed session · ${lessonMinutes()} min</button></div>
      <a class="linkbtn small" href="#/home/routine/${c.id}">Customize: pick the skill or length yourself</a></div>`;
  }
  /** Practice the next lesson on the practice page (no timer), with the whole course to step through. */
  function startNext() {
    const nx = nextInCourse(p, c); if (!nx) return;
    openPractice(courseContext(p, c, { skillId: nx.skill.id }), navigate);
  }
  /** The timed version: a routine built around the next lesson. */
  function startTimed() {
    const nx = nextInCourse(p, c); if (!nx) return;
    const mins = lessonMinutes();
    const plan = buildRoutine(p, c, { budget: mins, focusSkillId: nx.skill.id });
    startRoutine(plan, { mode: 'duration', minutes: mins, deadline: Date.now() + mins * 60000 }, navigate);
    if (Claude.hasKey()) coachBriefing(p, plan).then(bf => { if (bf) attachBriefing(bf); });
  }

  function treeHTML() {
    const st = c.state, now = today();
    return `<section class="card tree"><h3>The full plan</h3><p class="muted small">${c.tree.generatedBy === 'claude' ? 'Designed by Claude for you.' : isGenericPlan(c) ? 'Standard plan.' : `Built-in ${esc(c.style)} plan.`} The app picks your next lesson from it; tap any skill to see its exercises or practice it instead.</p>
      ${c.tree.units.map((u, ui) => `
        <div class="unit"><div class="unit-head"><span class="unum">${ui + 1}</span><div><b>${esc(u.title)}</b><div class="muted small">${esc(u.summary)}</div></div></div>
        <div class="nodes">${u.skills.map(s => {
          const ss = st.skills[s.id], [ic, lbl] = STATUS[ss.status];
          const done = s.exercises.filter(e => st.exercises[e.id].mastered).length;
          const due = ss.status === 'mastered' && ss.nextReview && ss.nextReview <= now;
          return `<button class="node ${ss.status}" data-skill="${s.id}"><span class="nic">${ic}</span><span class="nbody"><b>${esc(s.title)}</b>
            <span class="muted small">${DOMAIN_BY_KEY[s.domain] ? DOMAIN_BY_KEY[s.domain].name : s.domain} · ${done}/${s.exercises.length} mastered${due ? ' · <span class="due">review due</span>' : ''}</span></span><span class="nlbl">${lbl}</span></button>`;
        }).join('')}</div></div>`).join('')}
    </section>`;
  }

  /** The exercise's variations, with marks for the ones practiced or mastered. */
  function varsLine(e) {
    let list = []; try { list = variationsFor(e, { course: c, level: e.level || c.difficulty }); } catch { /* none */ }
    const others = list.filter(v => !v.base); if (!others.length) return '';
    const vs = p.varState || {};
    return `<div class="varmini">↻ ${others.length} variations · ${levelRange(list)}: ${others.map(v => { const st = vs[`${c.id}:${e.id}~${v.vid}`]; return `<span class="${st && st.mastered ? 'ok' : ''}">${esc(v.label)}${st && st.mastered ? ' ✓' : ''}</span>`; }).join(' · ')}<div class="small muted">Pick any of them in the routine runner.</div></div>`;
  }

  function skillSheet(skillId) {
    const s = c.tree.units.flatMap(u => u.skills).find(x => x.id === skillId), ss = c.state.skills[s.id];
    const sheet = Shell.sheet(`
      <div class="label">${STATUS[ss.status][1]}${ss.nextReview ? ' · next review ' + ss.nextReview : ''}</div>
      <h2>${esc(s.title)}</h2><p class="muted">${esc(s.summary)}</p>
      ${s.exercises.map(e => { const es = c.state.exercises[e.id]; const pct = Math.min(100, Math.round((es.target - e.startBpm) / Math.max(1, e.goalBpm - e.startBpm) * 100));
        return `<div class="exsheet"><div class="sec-head"><b>${esc(e.name)}</b>${es.mastered ? '<span class="badge ok">Mastered</span>' : es.stalled ? '<span class="badge warn">Stalled</span>' : ''}</div>
        <div class="small muted">${esc(e.unit)} · ${esc(beatLabel(e))} at ${es.target} BPM → goal ${e.goalBpm} BPM${es.best ? ` · best ${es.best}` : ''} · ${es.passes.length}/2 passes</div>
        <div class="bar thin"><i style="width:${es.mastered ? 100 : Math.max(0, pct)}%"></i></div>
        ${e.why ? `<p class="small">${esc(e.why)}</p>` : ''}
        ${varsLine(e)}
        ${es.history.length ? `<div class="spark">${es.history.slice(-12).map(h => `<i class="${h.clean ? 'c' : ''}" style="height:${Math.max(8, Math.round(h.tempo / e.goalBpm * 100))}%" title="${h.date}: ${h.tempo} BPM"></i>`).join('')}</div>` : ''}</div>`; }).join('')}
      ${ss.status === 'locked' ? `<p class="muted small">Unlocks after: ${esc(s.prereqs.map(pid => (c.tree.units.flatMap(u => u.skills).find(x => x.id === pid) || {}).title).filter(Boolean).join(', '))}</p>` : ''}
      <div class="row"><button class="btn primary" data-sk="practice">▶ Practice this skill</button><a class="btn" href="#/home/routine/${c.id}/${s.id}">⏱ Timed session</a></div>`);
    sheet.el.addEventListener('click', e => {
      if (e.target.closest('a')) sheet.close();
      if (e.target.closest('[data-sk="practice"]')) { sheet.close(); openPractice(courseContext(p, c, { skillId: s.id }), navigate); }
    });
  }

  async function build(rebuild) {
    if (rebuild && !confirm('Rebuild the plan? Progress on this course’s exercises resets.')) return;
    building = true; render();
    const r = await buildCourseTree(p, c);
    building = false; Store.save();
    if (r.kept) toast(`Couldn’t rebuild it: ${r.error} Your current plan is unchanged.`, 4200);
    else if (r.error) toast('Claude couldn’t build it (' + r.error + '). ' + (master ? 'The built-in plan was used.' : 'A standard plan was used.'));
    else toast(r.usedClaude ? 'Your course plan is ready.' : 'Standard plan built.');
    render();
  }

  const onClick = e => {
    const b = e.target.closest('[data-c],[data-skill]'); if (!b) return;
    if (b.dataset.skill) return skillSheet(b.dataset.skill);
    const a = b.dataset.c;
    if (a === 'startnext') return startNext();
    if (a === 'timed') return startTimed();
    if (a === 'build') build(false);
    if (a === 'rebuild') build(true);
    if (a === 'restyle') { if (!confirm(`Rebuild “${c.name}” with the ${c.style} plan? Progress on the old exercises resets.`)) return; c.tree = generateTreeLocal(c); c.state = null; Store.save(); toast(`New ${c.style} plan ready.`); render(); }
    if (a === 'levelup') { const lv = levelNow(); if (!confirm(`Rebuild “${c.name}” at level ${lv}? Progress on this course’s exercises resets; your practice time and skill levels are kept.`)) return; c.difficulty = lv; c.levelLabel = tierName(lv); build(false); }
    if (a === 'archive') { c.status = 'archived'; Store.save(); toast('Archived.'); navigate('#/home'); }
    if (a === 'delete' && confirm(`Delete “${c.name}”? Practice time stays in your stats.`)) { p.courses = p.courses.filter(x => x.id !== c.id); Store.save(); navigate('#/home'); }
  };
  root.addEventListener('click', onClick);
  render();
  return () => root.removeEventListener('click', onClick);
}
