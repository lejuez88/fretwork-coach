// Today's lesson, on the dashboard. By default the app chooses for you: the
// course, the skill to focus on and the plan that will help most right now (see
// core/coach.js), with the reasons, and one button to start. Only the length is
// asked, as a quick choice. Everything can still be chosen by hand under
// "Customize": the course, the skill and the exact time.
import { esc, toast, fmtMinutes } from '../core/util.js';
import { tempoShort } from './temporow.js';
import { Store } from '../core/store.js';
import { Claude } from '../core/claude.js';
import { buildRoutine, coachBriefing, BLOCKS } from '../core/routine.js';
import { buildCourseTree, isGenericPlan } from '../core/coursegen.js';
import { progressPct, allSkills } from '../core/progression.js';
import { recommendSession, nextInCourse } from '../core/coach.js';
import { forYou, isMaster } from '../core/master.js';
import { timeInputHTML, wireTimeInput, readTime, startRoutine, hasActiveRoutine, attachBriefing } from '../screens/routine.js';

const QUICK_TIMES = [15, 20, 30, 45, 60];

export function mountRoutineBuilder(el, { navigate, courseId = null, skillId = null }) {
  const p = Store.profile;
  // Customize mode: opened by hand, or when a course page sends you here for a specific skill
  let custom = !!(courseId && skillId);
  let plan = null, building = false, briefing = null, timeSel = null, alive = true;
  let rec = null, minutes = null;
  const open = () => p.courses.filter(c => c.status !== 'archived');
  let selected = null;
  const pickDefault = () => (courseId && open().find(c => c.id === courseId)) || (rec && rec.course) || [...open()].sort((a, b) => String(b.lastPracticed || '').localeCompare(String(a.lastPracticed || '')))[0] || null;
  const focusSkill = () => (custom ? (skillId && selected && selected.id === courseId ? skillId : null) : rec && rec.next && rec.course === selected ? rec.next.skill.id : null);

  let lastSig = '';
  const signature = () => `${hasActiveRoutine()}|${open().map(c => c.id + ':' + (c.tree ? 1 : 0) + ':' + (c.lastPracticed || '')).join(',')}`;

  function render() {
    lastSig = signature();
    if (hasActiveRoutine()) {
      el.className = 'card routine-cta live';
      el.innerHTML = '<div class="label">Lesson in progress</div><h3>Pick up where you left off</h3><a class="btn primary block" href="#/practice/run">▶ Resume</a>';
      return;
    }
    const courses = open();
    if (!courses.length) {
      el.className = 'card routine-cta';
      el.innerHTML = `<div class="label">Today’s lesson</div><h3>Create a course to get daily lessons</h3>
        <p class="muted small">A course turns your style and level into a plan; each day the app picks the lesson that will help you most. Meanwhile, the exercise library has everything to practice at your own pace.</p>
        <div class="row"><button class="btn primary" data-d="newcourse">+ New course</button><a class="btn" href="#/practice">Exercise library</a></div>`;
      return;
    }
    rec = recommendSession(p, { minutes });
    if (minutes == null) minutes = rec.minutes;
    if (!custom) selected = rec.course;
    else if (!selected || !courses.includes(selected)) selected = pickDefault();
    if (custom) return renderCustom(courses);
    // Guided: the plan is ready to start as soon as the course has one
    if (selected.tree && !plan) plan = buildRoutine(p, selected, { budget: minutes, focusSkillId: focusSkill() });
    el.className = 'card routine-cta guided';
    const skill = rec.next && rec.next.skill;
    el.innerHTML = `
      <div class="label">Today’s lesson · chosen for you</div>
      <h3>${esc(selected.name)}${skill ? `: <span class="hl">${esc(skill.title)}</span>` : ''}</h3>
      ${rec.reasons.length ? `<ul class="why-list">${rec.reasons.slice(0, 3).map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      ${isGenericPlan(selected) ? `<p class="note warn">This course still uses the old standard plan. <a class="link" href="#/course/${selected.id}">Rebuild it for ${esc(selected.style)}</a> to practice the style’s own material.</p>` : ''}
      <div class="quick-time"><span class="small muted">Time</span><div class="chips">${[...new Set([...QUICK_TIMES, rec.minutes, minutes])].sort((x, y) => x - y).map(m => `<button class="chip sm ${m === minutes ? 'on' : ''}" data-min="${m}">${m} min</button>`).join('')}</div></div>
      ${selected.tree ? previewHTML() : `<p class="small muted">This course’s lesson plan will be built when you start${Claude.hasKey() ? ' (Claude takes about 30–60 seconds)' : ''}.</p>
        <button class="btn primary block" data-r="buildstart" ${building ? 'disabled' : ''}>${building ? 'Building your course plan…' : '▶ Start today’s lesson'}</button>`}
      ${gapHTML(courses)}
      <button class="linkbtn" data-r="custom">Customize: choose the course, skill or exact time</button>`;
  }
  /** When your biggest need isn't in any of your courses, say so and offer the master class for it. */
  function gapHTML(courses) {
    const fy = forYou(p)[0]; if (!fy) return '';
    const covered = courses.some(c => isMaster(c) && c.topic && c.topic.topicId === fy.topic.id) || courses.some(c => { const nx = c.tree && nextInCourse(p, c); return nx && nx.skill.domain === fy.topic.domain; });
    if (covered) return '';
    return `<p class="small also">Also recommended: <button class="linkbtn small" data-mc="${esc(fy.topic.id)}">${esc(fy.topic.title)} master class ›</button> ${esc(fy.reason)} None of your courses works on it right now.</p>`;
  }

  function renderCustom(courses) {
    const defMin = minutes || 30;
    el.className = 'card routine-cta builder';
    el.innerHTML = `
      <div class="sec-head"><div class="label">Today’s lesson · your choice</div><button class="linkbtn" data-r="guided">← Let the app choose</button></div>
      <h3>Build a session for the time you have</h3>
      <div class="field"><label>Course</label>
        <div class="chips">${courses.map(c => `<button class="chip ${c === selected ? 'on' : ''}" data-course="${c.id}">${esc(c.name)} · ${progressPct(c)}%</button>`).join('')}</div>
        ${selected.tree ? skillPickerHTML() : `<p class="small muted" style="margin-top:8px">This course doesn’t have a lesson plan yet. It will be built when you continue${Claude.hasKey() ? ' (Claude takes about 30–60 seconds)' : ''}.</p>`}
        ${isGenericPlan(selected) ? `<p class="note warn">This course still uses the old standard plan. <a class="link" href="#/course/${selected.id}">Rebuild it for ${esc(selected.style)}</a> to practice the style’s own material.</p>` : ''}
      </div>
      <div class="field"><label>How much time do you have?</label><div data-r="time">${timeInputHTML('duration', defMin)}</div></div>
      <button class="btn primary block" data-r="build">Build my routine</button>
      <div data-r="preview"></div>`;
    wireTimeInput(el.querySelector('[data-r="time"]'));
    drawPreview();
  }
  /** Focus skill (customize mode): the coach's pick, or any unlocked skill. */
  function skillPickerHTML() {
    const nx = nextInCourse(p, selected);
    const skills = allSkills(selected).filter(s => selected.state.skills[s.id].status !== 'locked');
    if (skills.length < 2) return '';
    const cur = (skillId && selected.id === courseId && skillId) || '';
    return `<label class="mini" style="margin-top:10px">Focus skill</label><select data-r="skill">
      <option value="">${nx ? `Recommended: ${esc(nx.skill.title)}` : 'Recommended'}</option>
      ${skills.map(s => `<option value="${esc(s.id)}" ${s.id === cur ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}</select>`;
  }
  function drawPreview() {
    const b = el.querySelector('[data-r="build"]'); if (!b) return;
    b.disabled = building; b.textContent = building ? (b.dataset.msg || 'Building…') : plan ? 'Rebuild plan' : 'Build my routine';
    const pv = el.querySelector('[data-r="preview"]');
    pv.innerHTML = plan && !building ? previewHTML() : '';
  }
  function previewHTML() {
    const total = plan.items.reduce((a, i) => a + i.minutes, 0);
    return `<div class="planbox"><div class="label">The plan · ${fmtMinutes(total)}</div>
      ${briefing && briefing.focus ? `<p class="coach">🎯 ${esc(briefing.focus)}</p>` : ''}
      ${plan.items.map(it => `<div class="planrow b-${it.block}"><span class="pblock">${BLOCKS[it.block].label}</span><div class="pname"><b>${esc(it.ex.name)}</b><span class="muted small">${esc(tempoShort(it.ex, it.targetBpm, it.goalBpm))}${it.note ? ' · ' + esc(it.note) : it.variation ? ' · ↻ ' + esc(it.variation) : ''}</span></div><span class="pmin">${it.minutes}m</span></div>`).join('')}
      <button class="btn primary block" data-r="start">▶ Start today’s lesson</button></div>`;
  }
  async function ensureTree() {
    if (selected.tree) return true;
    const r = await buildCourseTree(p, selected); Store.save();
    if (!selected.tree) { toast(r.error || 'The plan couldn’t be built.', 4200); return false; }
    if (r.error) toast('Claude couldn’t build the plan (' + r.error + '), so a standard plan was used.');
    return true;
  }
  async function build() {
    const t = readTime(el.querySelector('[data-r="time"]')); if (t.error) return toast(t.error);
    timeSel = t; building = true;
    el.querySelector('[data-r="build"]').dataset.msg = !selected.tree ? (Claude.hasKey() ? 'Claude is writing your course plan (30–60 s)…' : 'Building your course plan…') : 'Building…';
    drawPreview();
    if (!(await ensureTree())) { building = false; drawPreview(); return; }
    if (!alive) return;
    const sel = el.querySelector('[data-r="skill"]');
    plan = buildRoutine(p, selected, { budget: t.minutes, focusSkillId: (sel && sel.value) || focusSkill() || (nextInCourse(p, selected) || {}).skill && nextInCourse(p, selected).skill.id });
    building = false; briefing = null; lastSig = signature(); drawPreview();
    const mine = plan;
    coachBriefing(p, plan).then(b => { if (alive && b && plan === mine) { briefing = b; plan.coach = b; drawPreview(); } });
  }
  /** Start the guided lesson; the coach's briefing (Claude) is fetched after it starts, so starting is instant. */
  function startGuided() {
    if (!plan) return;
    const go = plan;
    startRoutine(go, { mode: 'duration', minutes, deadline: Date.now() + minutes * 60000 }, navigate);
    if (Claude.hasKey()) coachBriefing(p, go).then(b => { if (b) attachBriefing(b); });
  }
  async function buildAndStart() {
    building = true; render();
    const ok = await ensureTree();
    building = false;
    if (!alive) return;
    if (!ok) { render(); return; }
    rec = recommendSession(p, { minutes });
    plan = buildRoutine(p, selected, { budget: minutes, focusSkillId: focusSkill() });
    startGuided();
  }
  function startCustom() {
    if (!plan) return;
    const fresh = readTime(el.querySelector('[data-r="time"]'));
    startRoutine(plan, fresh.error ? timeSel : fresh, navigate);
  }

  const onClick = e => {
    const b = e.target.closest('button'); if (!b || !el.contains(b)) return;
    if (b.dataset.min) { minutes = +b.dataset.min; plan = null; render(); return; }
    if (b.dataset.r === 'custom') { custom = true; plan = null; briefing = null; render(); return; }
    if (b.dataset.r === 'guided') { custom = false; plan = null; briefing = null; render(); return; }
    if (b.dataset.course) { selected = open().find(c => c.id === b.dataset.course); plan = null; render(); return; }
    if (b.dataset.r === 'build') build();
    else if (b.dataset.r === 'buildstart') buildAndStart();
    else if (b.dataset.r === 'start') { if (custom) startCustom(); else startGuided(); }
  };
  const onChange = e => { if (e.target.dataset.r === 'skill') { plan = null; drawPreview(); } };
  el.addEventListener('click', onClick); el.addEventListener('change', onChange);
  render();
  if (courseId && el.scrollIntoView) setTimeout(() => { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { /* ignore */ } }, 60);
  return {
    // Re-render only when something the card shows changed (a new course, a lesson
    // started or finished elsewhere), so a time you picked isn't reset.
    refresh: () => { const sig = signature(); if (sig !== lastSig && !building) { plan = null; render(); } },
    destroy: () => { alive = false; el.removeEventListener('click', onClick); el.removeEventListener('change', onChange); }
  };
}
