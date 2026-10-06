// Course detail with the progress tree: units → skills (nodes) → exercises.
// Nodes show locked / available / in progress / mastered, plus review due.
import { esc, fmtMinutes, toast, today } from '../core/util.js';
import { Store } from '../core/store.js';
import { Claude } from '../core/claude.js';
import { wikiTile, hydrateImages } from '../core/wiki.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { buildCourseTree } from '../core/coursegen.js';
import { ensureState, progressPct } from '../core/progression.js';
import { DOMAIN_BY_KEY } from '../assessment/engine.js';
import { Shell } from '../ui/shell.js';

const STATUS = { locked: ['🔒', 'Locked'], available: ['●', 'Ready'], in_progress: ['◐', 'In progress'], mastered: ['✓', 'Mastered'] };

export function mountCourse(root, { id, navigate }) {
  const p = Store.profile, c = p.courses.find(x => x.id === id);
  if (!c) { root.innerHTML = '<section class="card"><p>Course not found.</p><a class="btn block" href="#/home">Back to dashboard</a></section>'; return () => {}; }
  const g = GENRE_BY_ID[c.genre];
  let building = false;

  function render() {
    if (c.tree) { ensureState(c); c.progress = progressPct(c); }
    const sessions = p.practiceLog.filter(l => l.courseId === c.id), mins = sessions.reduce((a, l) => a + l.minutes, 0);
    root.innerHTML = `
      <a class="link" href="#/home">← Dashboard</a>
      <section class="card course-hero">${wikiTile(g ? g.wiki : c.genre, g ? g.name : c.genre, 'banner')}
        <div class="label">${esc(g ? g.name : c.genre)} · ${esc(c.style)} · level ${c.difficulty} (${esc(c.levelLabel)})</div>
        <h1>${esc(c.name)}</h1><p>${esc(c.tree && c.tree.summary || c.tagline)}</p>
        ${c.players.length ? `<p class="muted small">Inspired by ${c.players.map(esc).join(', ')}</p>` : ''}
        <div class="cprog big"><div class="bar"><i style="width:${c.progress || 0}%"></i></div><span>${c.progress || 0}%</span></div>
        <p class="small muted">${sessions.length} session${sessions.length === 1 ? '' : 's'} · ${fmtMinutes(mins)} practiced</p>
        <a class="btn primary block" href="#/practice/course/${c.id}">▶ Practice this course</a>
      </section>
      ${c.tree ? treeHTML() : `<section class="card"><h3>Progress tree</h3>
        <p class="muted">Build the full lesson plan for this course. ${Claude.hasKey() ? 'Claude designs it around your levels, goals and players (30–60 seconds).' : 'Without an API key a standard plan for this style is used; add a key in Settings for a personalized one.'}</p>
        <button class="btn primary block" data-c="build" ${building ? 'disabled' : ''}>${building ? 'Building your course plan…' : 'Build course plan'}</button></section>`}
      <section class="card"><div class="row"><button class="btn" data-c="archive">Archive</button>${c.tree ? '<button class="btn" data-c="rebuild">Rebuild plan</button>' : ''}<button class="btn ghost danger" data-c="delete">Delete</button></div></section>`;
    hydrateImages(root);
  }

  function treeHTML() {
    const st = c.state, now = today();
    return `<section class="card tree"><h3>Progress tree</h3><p class="muted small">${c.tree.generatedBy === 'claude' ? 'Designed by Claude for you.' : 'Standard plan.'} Tap a skill for its exercises.</p>
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

  function skillSheet(skillId) {
    const s = c.tree.units.flatMap(u => u.skills).find(x => x.id === skillId), ss = c.state.skills[s.id];
    const sheet = Shell.sheet(`
      <div class="label">${STATUS[ss.status][1]}${ss.nextReview ? ' · next review ' + ss.nextReview : ''}</div>
      <h2>${esc(s.title)}</h2><p class="muted">${esc(s.summary)}</p>
      ${s.exercises.map(e => { const es = c.state.exercises[e.id]; const pct = Math.min(100, Math.round((es.target - e.startBpm) / Math.max(1, e.goalBpm - e.startBpm) * 100));
        return `<div class="exsheet"><div class="sec-head"><b>${esc(e.name)}</b>${es.mastered ? '<span class="badge ok">Mastered</span>' : es.stalled ? '<span class="badge warn">Stalled</span>' : ''}</div>
        <div class="small muted">${esc(e.unit)} · target ${es.target} BPM → goal ${e.goalBpm} BPM${es.best ? ` · best ${es.best}` : ''} · ${es.passes.length}/2 passes</div>
        <div class="bar thin"><i style="width:${es.mastered ? 100 : Math.max(0, pct)}%"></i></div>
        ${e.why ? `<p class="small">${esc(e.why)}</p>` : ''}
        ${es.history.length ? `<div class="spark">${es.history.slice(-12).map(h => `<i class="${h.clean ? 'c' : ''}" style="height:${Math.max(8, Math.round(h.tempo / e.goalBpm * 100))}%" title="${h.date}: ${h.tempo} BPM"></i>`).join('')}</div>` : ''}</div>`; }).join('')}
      ${ss.status === 'locked' ? `<p class="muted small">Unlocks after: ${esc(s.prereqs.map(pid => (c.tree.units.flatMap(u => u.skills).find(x => x.id === pid) || {}).title).filter(Boolean).join(', '))}</p>` : ''}
      <a class="btn primary block" href="#/practice/course/${c.id}/${s.id}">▶ Practice this skill now</a>`);
    sheet.el.addEventListener('click', e => { if (e.target.closest('a')) sheet.close(); });
  }

  async function build(rebuild) {
    if (rebuild && !confirm('Rebuild the plan? Progress on this course’s exercises resets.')) return;
    building = true; render();
    const r = await buildCourseTree(p, c);
    building = false; Store.save();
    if (r.error) toast('Claude couldn’t build it (' + r.error + '). A standard plan was used.');
    else toast(r.usedClaude ? 'Your course plan is ready.' : 'Standard plan built.');
    render();
  }

  const onClick = e => {
    const b = e.target.closest('[data-c],[data-skill]'); if (!b) return;
    if (b.dataset.skill) return skillSheet(b.dataset.skill);
    const a = b.dataset.c;
    if (a === 'build') build(false);
    if (a === 'rebuild') build(true);
    if (a === 'archive') { c.status = 'archived'; Store.save(); toast('Archived.'); navigate('#/home'); }
    if (a === 'delete' && confirm(`Delete “${c.name}”? Practice time stays in your stats.`)) { p.courses = p.courses.filter(x => x.id !== c.id); Store.save(); navigate('#/home'); }
  };
  root.addEventListener('click', onClick);
  render();
  return () => root.removeEventListener('click', onClick);
}
