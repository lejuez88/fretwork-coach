// Today's routine, built on the dashboard: pick a course, say how much time
// you have, preview the plan (warm-up, review, stretch, theory, music), start.
import { esc, toast, fmtMinutes } from '../core/util.js';
import { Store } from '../core/store.js';
import { Claude } from '../core/claude.js';
import { buildRoutine, coachBriefing, BLOCKS } from '../core/routine.js';
import { buildCourseTree, isGenericPlan } from '../core/coursegen.js';
import { progressPct } from '../core/progression.js';
import { timeInputHTML, wireTimeInput, readTime, startRoutine, hasActiveRoutine } from '../screens/routine.js';

export function mountRoutineBuilder(el, { navigate, courseId = null, skillId = null }) {
  const p = Store.profile;
  let plan = null, building = false, briefing = null, timeSel = null, alive = true;
  const open = () => p.courses.filter(c => c.status !== 'archived');
  let selected = null;
  const pickDefault = () => (courseId && open().find(c => c.id === courseId)) || [...open()].sort((a, b) => String(b.lastPracticed || '').localeCompare(String(a.lastPracticed || '')))[0] || null;
  selected = pickDefault();
  const focusSkill = () => (skillId && selected && selected.id === courseId ? skillId : null);

  let lastSig = '';
  const signature = () => `${hasActiveRoutine()}|${open().map(c => c.id + ':' + (c.tree ? 1 : 0)).join(',')}`;
  function render() {
    lastSig = signature();
    if (hasActiveRoutine()) {
      el.className = 'card routine-cta live';
      el.innerHTML = '<div class="label">Routine in progress</div><h3>Pick up where you left off</h3><a class="btn primary block" href="#/practice/run">▶ Resume routine</a>';
      return;
    }
    const courses = open();
    if (!courses.length) {
      el.className = 'card routine-cta';
      el.innerHTML = `<div class="label">Today’s routine</div><h3>Create a course to get daily routines</h3>
        <p class="muted small">A course turns your style and level into a plan; each day’s routine is built from it. Meanwhile, the exercise library has everything to practice at your own pace.</p>
        <div class="row"><button class="btn primary" data-d="newcourse">+ New course</button><a class="btn" href="#/practice">Exercise library</a></div>`;
      return;
    }
    if (!selected || !courses.includes(selected)) selected = pickDefault();
    const defMin = p.questionnaire.practice[[0, 6].includes(new Date().getDay()) ? 'weekend' : 'weekday'] || 30;
    el.className = 'card routine-cta builder';
    el.innerHTML = `
      <div class="label">Today’s routine</div>
      <h3>Build a session for the time you have</h3>
      <div class="field"><label>Course</label>
        <div class="chips">${courses.map(c => `<button class="chip ${c === selected ? 'on' : ''}" data-course="${c.id}">${esc(c.name)} · ${progressPct(c)}%</button>`).join('')}</div>
        ${focusSkill() ? `<p class="small muted" style="margin-top:8px">Focusing on the skill you picked from the course plan.</p>` : ''}
        ${selected.tree ? '' : `<p class="small muted" style="margin-top:8px">This course doesn’t have a lesson plan yet. It will be built when you continue${Claude.hasKey() ? ' (Claude takes about 30–60 seconds)' : ''}.</p>`}
        ${isGenericPlan(selected) ? `<p class="note warn">This course still uses the old standard plan. <a class="link" href="#/course/${selected.id}">Rebuild it for ${esc(selected.style)}</a> to practice the style’s own material.</p>` : ''}
      </div>
      <div class="field"><label>How much time do you have?</label><div data-r="time">${timeInputHTML('duration', defMin)}</div></div>
      <button class="btn primary block" data-r="build">Build my routine</button>
      <div data-r="preview"></div>`;
    wireTimeInput(el.querySelector('[data-r="time"]'));
    drawPreview();
  }
  function drawPreview() {
    const b = el.querySelector('[data-r="build"]'); if (!b) return;
    b.disabled = building; b.textContent = building ? (b.dataset.msg || 'Building…') : plan ? 'Rebuild plan' : 'Build my routine';
    const pv = el.querySelector('[data-r="preview"]');
    pv.innerHTML = plan && !building ? previewHTML() : '';
  }
  function previewHTML() {
    const total = plan.items.reduce((a, i) => a + i.minutes, 0);
    return `<div class="planbox"><div class="label">Your plan · ${fmtMinutes(total)}${plan.budget == null ? ' suggested' : ''}</div>
      ${briefing && briefing.focus ? `<p class="coach">🎯 ${esc(briefing.focus)}</p>` : `<p class="small muted">Focus: <b>${esc(plan.focusTitle)}</b></p>`}
      ${plan.items.map(it => `<div class="planrow b-${it.block}"><span class="pblock">${BLOCKS[it.block].label}</span><div class="pname"><b>${esc(it.ex.name)}</b><span class="muted small">${it.targetBpm} → ${it.goalBpm} BPM${it.note ? ' · ' + esc(it.note) : it.variation ? ' · ↻ ' + esc(it.variation) : ''}</span></div><span class="pmin">${it.minutes}m</span></div>`).join('')}
      <button class="btn primary block" data-r="start">▶ Start routine</button></div>`;
  }
  async function build() {
    const t = readTime(el.querySelector('[data-r="time"]')); if (t.error) return toast(t.error);
    timeSel = t; building = true;
    el.querySelector('[data-r="build"]').dataset.msg = !selected.tree ? (Claude.hasKey() ? 'Claude is writing your course plan (30–60 s)…' : 'Building your course plan…') : 'Building…';
    drawPreview();
    if (!selected.tree) {
      const r = await buildCourseTree(p, selected); Store.save();
      if (!selected.tree) { building = false; toast(r.error || 'The plan couldn’t be built.', 4200); drawPreview(); return; }
      if (r.error) toast('Claude couldn’t build the plan (' + r.error + '), so a standard plan was used.');
    }
    if (!alive) return;
    plan = buildRoutine(p, selected, { budget: t.minutes, focusSkillId: focusSkill() });
    building = false; briefing = null; lastSig = signature(); drawPreview();
    const mine = plan;
    coachBriefing(p, plan).then(b => { if (alive && b && plan === mine) { briefing = b; plan.coach = b; drawPreview(); } });
  }
  function start() {
    if (!plan) return;
    const fresh = readTime(el.querySelector('[data-r="time"]'));
    startRoutine(plan, fresh.error ? timeSel : fresh, navigate);
  }

  const onClick = e => {
    const b = e.target.closest('button'); if (!b || !el.contains(b)) return;
    if (b.dataset.course) { selected = open().find(c => c.id === b.dataset.course); plan = null; render(); }
    else if (b.dataset.r === 'build') build();
    else if (b.dataset.r === 'start') start();
  };
  el.addEventListener('click', onClick);
  render();
  if (courseId && el.scrollIntoView) setTimeout(() => { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { /* ignore */ } }, 60);
  return {
    // Re-render only when something the builder shows changed (a new course,
    // a routine started elsewhere), so the time you picked isn't reset.
    refresh: () => { const sig = signature(); if (sig !== lastSig && !building) { plan = null; render(); } },
    destroy: () => { alive = false; el.removeEventListener('click', onClick); }
  };
}
