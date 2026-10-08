// Practice routines: setup (course + time), plan preview, the timed runner
// (per-exercise countdown, on-pace indicator, tempo logging) and a summary.
import { esc, toast, fmtClock, fmtMinutes, today } from '../core/util.js';
import { Store, Practice } from '../core/store.js';
import { Audio } from '../core/audio.js';
import { Claude } from '../core/claude.js';
import { buildRoutine, rebudget, coachBriefing, BLOCKS } from '../core/routine.js';
import { findSong, recordSongResult } from '../core/songs.js';
import { recordCustom } from '../core/custom.js';
import { mountAskBox } from '../ui/ask.js';
import { buildCourseTree, toPlayerExercise, isGenericPlan } from '../core/coursegen.js';
import { recordResult, recordPrescription, applyResult, newExerciseState, markReviewed, progressPct, ensureState } from '../core/progression.js';
import { addEvidence, recomputeLevels } from '../core/skills.js';
import { openEvalSheet } from '../eval/ui.js';
import { mountTabPlayer } from '../tools/tabplayer.js';
import { Metronome, mountMetronome } from '../tools/metronome.js';
import { exerciseDiagramsHTML } from '../ui/fretboard.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { Shell } from '../ui/shell.js';

const ACTIVE_KEY = 'fretworkCoach.activeRoutine';
const getActive = () => { try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null'); } catch { return null; } };
const saveActive = a => { try { a ? localStorage.setItem(ACTIVE_KEY, JSON.stringify(a)) : localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ } };
export const hasActiveRoutine = () => !!getActive();

/* ------------------------------ Time input ------------------------------ */
/** Markup + reader for the 3-way time input. Returns {html, read(root)} */
export function timeInputHTML(mode = 'duration', mins = 45) {
  const end = new Date(Date.now() + mins * 60000);
  const hh = String(end.getHours()).padStart(2, '0'), mm = String(Math.ceil(end.getMinutes() / 5) * 5 % 60).padStart(2, '0');
  return `
  <div class="segtabs tmode">${[['duration', 'How long'], ['end', 'Until a time'], ['open', 'No limit']].map(([k, l]) => `<a href="javascript:void 0" data-tmode="${k}" class="${mode === k ? 'on' : ''}">${l}</a>`).join('')}</div>
  <div data-tpane="duration" ${mode !== 'duration' ? 'hidden' : ''}>
    <div class="hm"><label class="mini">Hours<div class="stepper s1"><button data-hm="h" data-d="-1">−</button><input type="number" inputmode="numeric" data-r="h" value="${Math.floor(mins / 60)}" min="0" max="8"><button data-hm="h" data-d="1">+</button></div></label>
    <label class="mini">Minutes<div class="stepper s1"><button data-hm="m" data-d="-5">−</button><input type="number" inputmode="numeric" data-r="m" value="${mins % 60}" min="0" max="59"><button data-hm="m" data-d="5">+</button></div></label></div>
    <div class="quick">${[10, 15, 20, 30, 45, 60, 90].map(v => `<button class="chip" data-qmin="${v}">${v < 60 ? v + 'm' : Math.floor(v / 60) + 'h' + (v % 60 ? ' ' + (v % 60) + 'm' : '')}</button>`).join('')}</div>
  </div>
  <div data-tpane="end" ${mode !== 'end' ? 'hidden' : ''}><label class="mini">I need to stop at<input type="time" data-r="end" value="${hh}:${mm}"></label></div>
  <div data-tpane="open" ${mode !== 'open' ? 'hidden' : ''}><p class="muted small">No countdown pressure: each exercise still gets a suggested time, and you move on when you’re ready.</p></div>`;
}
export function wireTimeInput(root) {
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-tmode]');
    if (t) {
      root.querySelectorAll('[data-tmode]').forEach(x => x.classList.toggle('on', x === t));
      root.querySelectorAll('[data-tpane]').forEach(p => { p.hidden = p.dataset.tpane !== t.dataset.tmode; });
      return;
    }
    const hm = e.target.closest('[data-hm]');
    if (hm) {
      const inp = root.querySelector(`[data-r="${hm.dataset.hm}"]`);
      let v = (+inp.value || 0) + Number(hm.dataset.d);
      if (hm.dataset.hm === 'm') { if (v >= 60) { v -= 60; const h = root.querySelector('[data-r="h"]'); h.value = Math.min(8, +h.value + 1); } if (v < 0) v = 55; }
      inp.value = Math.max(0, Math.min(hm.dataset.hm === 'h' ? 8 : 59, v));
      return;
    }
    const q = e.target.closest('[data-qmin]');
    if (q) { const v = +q.dataset.qmin; root.querySelector('[data-r="h"]').value = Math.floor(v / 60); root.querySelector('[data-r="m"]').value = v % 60; }
  });
}
/** Returns {mode, minutes|null, deadline|null} or {error} */
export function readTime(root) {
  const mode = (root.querySelector('[data-tmode].on') || {}).dataset?.tmode || 'duration';
  if (mode === 'open') return { mode, minutes: null, deadline: null };
  if (mode === 'duration') {
    const m = (+root.querySelector('[data-r="h"]').value || 0) * 60 + (+root.querySelector('[data-r="m"]').value || 0);
    if (m < 5) return { error: 'Give yourself at least 5 minutes.' };
    return { mode, minutes: m, deadline: Date.now() + m * 60000 };
  }
  const v = root.querySelector('[data-r="end"]').value; if (!v) return { error: 'Pick an end time.' };
  const [h, mi] = v.split(':').map(Number); const d = new Date(); d.setHours(h, mi, 0, 0);
  const m = Math.floor((d - Date.now()) / 60000);
  if (m < 5) return { error: 'That end time is less than 5 minutes away.' };
  return { mode, minutes: m, deadline: d.getTime() };
}

/**
 * Start any routine (course, song lesson or custom). t = {mode, minutes, deadline}
 * from the time input, or omitted for no time limit.
 */
export function startRoutine(plan, t = { mode: 'open', minutes: null, deadline: null }, navigate) {
  const p = Store.profile;
  if (Practice.active()) { const e = Practice.stop(p); if (e && !e.discarded) toast(`Logged your running session (${fmtMinutes(e.minutes)}) first.`); }
  if (t.minutes !== plan.budget) rebudget(plan, 0, t.minutes, 0);
  saveActive({ routine: plan, idx: 0, startedAt: Date.now(), itemStart: Date.now(), pausedAt: null, pausedTotal: 0, itemPaused: 0, deadline: t.deadline, mode: t.mode, results: [], alerted: false });
  Store.save(); navigate('#/practice/run');
}

/* -------------------------------- Setup --------------------------------- */
export function mountRoutineSetup(root, { navigate, courseId = null, skillId = null }) {
  const p = Store.profile;
  if (getActive()) { navigate('#/practice/run'); return () => {}; }
  const open = p.courses.filter(c => c.status !== 'archived');
  if (!open.length) {
    root.innerHTML = '<h1>Practice</h1><section class="card askcard" data-r="askslot"></section><section class="card"><p>Create a course to get full daily routines built from a course plan.</p><a class="btn primary block" href="#/home">Go to dashboard</a></section>';
    const offAsk = mountAskBox(root.querySelector('[data-r="askslot"]'), { start: plan => startRoutine(plan, undefined, navigate) });
    return () => offAsk();
  }
  let selected = (courseId && open.find(c => c.id === courseId)) || [...open].sort((a, b) => String(b.lastPracticed || '').localeCompare(String(a.lastPracticed || '')))[0];
  let plan = null, building = false, briefing = null, timeSel = null, offAsk = null;

  function render() {
    if (offAsk) { offAsk(); offAsk = null; }
    root.innerHTML = `
      <h1>Practice</h1>
      <section class="card askcard" data-r="askslot"></section>
      <h2 class="sechead">Today’s routine</h2>
      <section class="card"><div class="label">1 · Course</div>
        <div class="chips">${open.map(c => `<button class="chip ${c === selected ? 'on' : ''}" data-course="${c.id}">${esc(c.name)} · ${progressPct(c)}%</button>`).join('')}</div>
        ${selected.tree ? '' : `<p class="small muted" style="margin-top:10px">This course doesn’t have a lesson plan yet. It will be built when you continue${Claude.hasKey() ? ' (Claude takes about 30–60 seconds)' : ''}.</p>`}
        ${isGenericPlan(selected) ? `<p class="note warn">This course still uses the old standard plan. <a class="link" href="#/course/${selected.id}">Rebuild it for ${esc(selected.style)}</a> to practice the style’s own material.</p>` : ''}
      </section>
      <section class="card"><div class="label">2 · How much time do you have?</div><div data-r="time">${timeInputHTML('duration', p.questionnaire.practice[[0, 6].includes(new Date().getDay()) ? 'weekend' : 'weekday'] || 30)}</div>
        <button class="btn primary block" data-r="build">Build my routine</button></section>
      <div data-r="preview"></div>`;
    wireTimeInput(root.querySelector('[data-r="time"]'));
    offAsk = mountAskBox(root.querySelector('[data-r="askslot"]'), { start: plan => startRoutine(plan, undefined, navigate), courseId: selected ? selected.id : null });
    drawPreview();
  }
  function drawPreview() {
    const b = root.querySelector('[data-r="build"]');
    b.disabled = building; b.textContent = building ? (b.dataset.msg || 'Building…') : plan ? 'Rebuild plan' : 'Build my routine';
    root.querySelector('[data-r="preview"]').innerHTML = plan ? previewHTML() : '';
    Shell.actions(plan && !building ? '<button class="btn primary" data-r="start">▶ Start routine</button>' : '');
  }
  function previewHTML() {
    const total = plan.items.reduce((a, i) => a + i.minutes, 0);
    return `<section class="card"><div class="label">3 · Your plan · ${fmtMinutes(total)}${plan.budget == null ? ' suggested' : ''}</div>
      ${briefing && briefing.focus ? `<p class="coach">🎯 ${esc(briefing.focus)}</p>` : `<p class="small muted">Focus: <b>${esc(plan.focusTitle)}</b></p>`}
      ${plan.items.map((it, i) => `<div class="planrow b-${it.block}"><span class="pblock">${BLOCKS[it.block].label}</span><div class="pname"><b>${esc(it.ex.name)}</b><span class="muted small">${it.targetBpm} → ${it.goalBpm} BPM${it.note ? ' · ' + esc(it.note) : it.variation ? ' · ' + esc(it.variation) : ''}</span></div><span class="pmin">${it.minutes}m</span></div>`).join('')}
    </section>`;
  }

  async function build() {
    const t = readTime(root.querySelector('[data-r="time"]')); if (t.error) return toast(t.error);
    timeSel = t; building = true;
    root.querySelector('[data-r="build"]').dataset.msg = !selected.tree ? (Claude.hasKey() ? 'Claude is writing your course plan (30–60 s)…' : 'Building your course plan…') : 'Building…';
    drawPreview();
    if (!selected.tree) {
      const r = await buildCourseTree(p, selected); Store.save();
      if (r.error) toast('Claude couldn’t build the plan (' + r.error + '), so a standard plan was used.');
    }
    plan = buildRoutine(p, selected, { budget: t.minutes, focusSkillId: skillId });
    building = false; briefing = null; drawPreview();
    const mine = plan;
    coachBriefing(p, plan).then(b => { if (b && plan === mine) { briefing = b; plan.coach = b; drawPreview(); } });
  }
  function start() {
    if (!plan) return;
    const fresh = readTime(root.querySelector('[data-r="time"]'));
    const t = fresh.error ? timeSel : fresh;
    startRoutine(plan, t, navigate);
  }

  const onClick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.course) { selected = open.find(c => c.id === b.dataset.course); plan = null; render(); }
    else if (b.dataset.r === 'build') build();
  };
  const barClick = e => { if (e.target.closest('[data-r="start"]')) start(); };
  root.addEventListener('click', onClick); Shell.actionBar.addEventListener('click', barClick);
  render();
  return () => { if (offAsk) offAsk(); root.removeEventListener('click', onClick); Shell.actionBar.removeEventListener('click', barClick); Shell.actions(''); };
}

/* -------------------------------- Runner -------------------------------- */
export function mountRoutineRunner(root, { navigate }) {
  const p = Store.profile;
  let A = getActive();
  if (!A) { navigate('#/practice'); return () => {}; }
  const course = A.routine.courseId ? p.courses.find(c => c.id === A.routine.courseId) : null;
  if (course) ensureState(course);
  /** Progress state behind an item (course, prescription, song section or saved exercise). */
  const stateOf = it => {
    if (course && it.fromTree) return course.state && course.state.exercises[it.exId];
    if (it.prescriptionId) { const r = p.prescriptions.find(x => x.id === it.prescriptionId); return r && r.state; }
    if (it.songId) { const s = findSong(p, it.songId); return s && s.state && s.state.sections[it.ex.sectionKey || it.exId]; }
    if (it.customId) { const c = p.customExercises.find(x => x.id === it.customId); return c && c.state; }
    return course && course.state && course.state.extras ? course.state.extras[it.exId] : null;
  };
  let tool = null, offMetro = null, tick = null, phase = 'play'; // play | result

  const now = () => (A.pausedAt || Date.now());
  const itemElapsed = () => (now() - A.itemStart - A.itemPaused) / 1000;
  const cur = () => A.routine.items[A.idx];
  const remaining = () => cur().minutes * 60 - itemElapsed();

  function pace() {
    if (!A.deadline) return { cls: 'open', text: 'No time limit' };
    const later = A.routine.items.slice(A.idx + 1).reduce((a, i) => a + i.minutes * 60, 0);
    const projected = now() + (Math.max(0, remaining()) + later) * 1000;
    const diff = (A.deadline - projected) / 60000;
    if (diff >= 1) return { cls: 'ahead', text: `On pace · ${Math.round(diff)} min to spare` };
    if (diff >= -0.5) return { cls: 'ok', text: 'On pace' };
    return { cls: 'behind', text: `${Math.ceil(-diff)} min behind` };
  }

  function teardownTool() { if (tool) { tool(); tool = null; } if (offMetro) { offMetro(); offMetro = null; } Metronome.stop(); }

  function render() {
    teardownTool();
    const it = cur(), ex = it.ex, B = BLOCKS[it.block];
    const es = stateOf(it);
    const tip = A.routine.coach && A.routine.coach.tips && A.routine.coach.tips[ex.name];
    const coachText = A.routine.coach && (it.block === 'theory' ? A.routine.coach.theory : it.block === 'music' ? A.routine.coach.music : null);
    root.innerHTML = `
      <div class="run-top">
        <div><div class="label">${B.label} · ${A.idx + 1} of ${A.routine.items.length}</div><div class="muted small">${esc(A.routine.courseName)}</div></div>
        <span class="pace" data-r="pace"></span>
      </div>
      <div class="run-steps">${A.routine.items.map((x, i) => `<i class="${i < A.idx ? 'done' : i === A.idx ? 'cur' : ''} b-${x.block}" style="flex:${x.minutes}"></i>`).join('')}</div>
      <section class="card runcard" data-r="card">
        <div class="countdown"><div class="cd-time" data-r="cd">${fmtClock(Math.max(0, remaining()))}</div><div class="cd-sub" data-r="cdsub">of ${it.minutes} min</div></div>
        <h2>${esc(ex.name)}</h2>
        <div class="tempo-row"><span>Today’s target <b>${it.targetBpm}</b></span><span>Goal <b class="goal">${it.goalBpm}</b> BPM</span>${es && es.best ? `<span>Best <b>${es.best}</b></span>` : ''}</div>
        <div class="bar thin"><i style="width:${Math.min(100, Math.round(((es ? es.target : it.targetBpm) - ex.startBpm) / Math.max(1, it.goalBpm - ex.startBpm) * 100))}%"></i></div>
        ${it.ramp && it.ramp.rungs && it.ramp.rungs.length > 1 ? `<div class="ladder"><span class="muted small">Tempo ladder</span>${it.ramp.rungs.map(v => `<span class="rung ${v === it.targetBpm ? 'start' : ''}" data-rung="${v}">${v}</span>`).join('<i>›</i>')}</div>` : ''}
        ${it.note ? `<div class="note warn">⚠ ${esc(it.note)}</div>` : ''}${it.variation ? `<div class="note">↻ ${esc(it.variation)}</div>` : ''}
        ${ex.why ? `<p class="why">${esc(ex.why)} <span class="muted">${esc(B.why)}</span></p>` : `<p class="why">${esc(B.why)}</p>`}
        ${coachText ? `<p class="coach">${esc(coachText)}</p>` : ''}
        ${ex.instr ? `<div class="instr">${esc(ex.instr)}</div>` : ''}
        ${tip ? `<p class="coach small">💡 ${esc(tip)}</p>` : ''}
        ${ex.watch ? `<div class="watch">⚠ Watch for: ${esc(ex.watch)}</div>` : ''}
        ${exerciseDiagramsHTML(ex)}
        <div data-r="tool"></div>
        <button class="btn block evalbtn" data-r="evaluate">🎤 Evaluate this take</button>
      </section>
      <div class="row run-ctrl"><button class="btn" data-r="pause">${A.pausedAt ? '▶ Resume' : '❚❚ Pause'}</button><button class="btn" data-r="time">⏱ Change time</button><button class="btn ghost" data-r="end">End session</button></div>`;
    Shell.actions(`<button class="btn" data-r="skip">Skip</button><button class="btn primary" data-r="next">Done → log tempo</button>`);
    if (phase === 'result') return renderResult();
    mountTool();
    update();
  }

  function mountTool() {
    const it = cur(), slot = root.querySelector('[data-r="tool"]');
    const px = toPlayerExercise(it.ex, it.targetBpm);
    const R = it.ramp && it.ramp.rungs && it.ramp.rungs.length > 1 ? it.ramp : null;
    const start = A.lastToolBpm || it.targetBpm;
    peak = Math.max(peak, start);
    if (px) {
      tool = mountTabPlayer(slot, px, { settings: p.settings, onSettings: patch => { Object.assign(p.settings, patch); Store.save(); }, startBpm: start, compact: true,
        ramp: R ? { enabled: R.enabled, step: R.step, everyLoops: 2, max: R.max } : null, onBpm: v => { peak = Math.max(peak, v); markRung(v); } });
    } else {
      Metronome.configure({ bpm: start, mode: it.ex.metroMode || 'all', backing: it.ex.backing && it.ex.backing.length ? it.ex.backing : null, beatsPerBar: it.ex.beatsPerBar || 4, subdiv: 1,
        ramp: R ? { enabled: R.enabled, step: R.step, everyBars: 4, max: R.max } : null });
      offMetro = mountMetronome(slot, { compact: false });
      const offBpm = Metronome.on(e => { if (e.type === 'bpm') { peak = Math.max(peak, e.bpm); markRung(e.bpm); } });
      const o = offMetro; offMetro = () => { o(); offBpm(); };
    }
    markRung(start);
  }
  function markRung(v) { root.querySelectorAll('.rung').forEach(x => x.classList.toggle('on', +x.dataset.rung <= v)); }
  let peak = 0;
  const toolBpm = () => (tool && tool.getBpm ? tool.getBpm() : Metronome.bpm);

  function renderResult() {
    teardownTool();
    const it = cur(), bpm = A.prefill ? A.prefill.tempo : (A.lastToolBpm || it.targetBpm);
    const reached = [...new Set([...(it.ramp && it.ramp.rungs || []), it.targetBpm, A.peakBpm || 0])].filter(v => v && v <= Math.max(A.peakBpm || 0, it.targetBpm)).sort((a, b) => a - b);
    root.querySelector('[data-r="tool"]').innerHTML = `
      <div class="result-step"><h3>How did it go?</h3>
        ${A.prefill ? `<div class="note">🎤 Measured: ${esc(A.prefill.summary)}</div>` : ''}
        <label class="mini">Highest tempo you played cleanly (or where you stopped)</label>
        ${reached.length > 1 ? `<div class="quick">${reached.map(v => `<button class="chip" data-rset="${v}">${v}</button>`).join('')}</div>` : ''}
        <div class="stepper"><button data-rs="-5">−5</button><button data-rs="-1">−1</button><input type="number" inputmode="numeric" data-r="rtempo" value="${bpm}"><button data-rs="1">+1</button><button data-rs="5">+5</button></div>
        <div class="unit">BPM · target ${it.targetBpm} · goal ${it.goalBpm}</div>
        <p class="small" style="margin-top:12px">Clean means 4 reps in a row with no flubbed notes, at that tempo.</p>
        <div class="rubric"><button data-clean="1" class="${A.prefill && A.prefill.clean ? 'on' : ''}"><span class="n">✓</span><span>Clean at this tempo</span></button>
        <button data-clean="0" class="${A.prefill && !A.prefill.clean ? 'on' : ''}"><span class="n">~</span><span>Not clean yet</span></button></div>
      </div>`;
    Shell.actions('<button class="btn" data-r="back">← Back to exercise</button>');
  }

  function update() {
    if (!root.isConnected) return;
    const rem = remaining(), cd = root.querySelector('[data-r="cd"]'), card = root.querySelector('[data-r="card"]');
    if (cd) {
      cd.textContent = rem >= 0 ? fmtClock(rem) : '+' + fmtClock(-rem);
      card.classList.toggle('timeup', rem <= 0);
      root.querySelector('[data-r="cdsub"]').textContent = rem <= 0 ? 'Time’s up: finish this rep and move on' : `of ${cur().minutes} min`;
    }
    const pc = pace(), el = root.querySelector('[data-r="pace"]');
    if (el) { el.className = 'pace ' + pc.cls; el.textContent = pc.text; }
    if (rem <= 0 && !A.alerted && !A.pausedAt) {
      A.alerted = true; saveActive(A);
      const c = Audio.get(); if (c) { Audio.beep(c.currentTime + 0.05, 988, 0.25); Audio.beep(c.currentTime + 0.35, 1319, 0.4); }
      try { navigator.vibrate && navigator.vibrate([150, 80, 150]); } catch { /* ignore */ }
    }
  }

  function advance(result) {
    const it = cur();
    it.actualMin = Math.round(itemElapsed() / 6) / 10;
    let decision = null;
    if (result) {
      const res = { tempo: result.tempo, clean: result.clean, date: today() };
      if (course && it.fromTree) {
        decision = recordResult(course, it.exId, res);
        if (it.isReview && result.clean) markReviewed(course, it.skillId);
      } else if (it.prescriptionId) {
        decision = recordPrescription(p, it.prescriptionId, res);
      } else if (it.songId) {
        decision = recordSongResult(p, it.songId, it.ex, res);
      } else if (it.customId) {
        decision = recordCustom(p, it.customId, res);
      } else if (course) {
        const st = ensureState(course); st.extras = st.extras || {};
        const es = st.extras[it.exId] || (st.extras[it.exId] = newExerciseState(it.targetBpm));
        decision = applyResult(es, it.ex, res);
      }
      if (!decision) decision = { decision: result.clean ? 'hold' : 'retry', message: result.clean ? `Clean at ${result.tempo} BPM.` : `Logged ${result.tempo} BPM.` };
      addEvidence(p, { key: it.songId ? `song:${it.songId}:${it.ex.sectionKey || it.exId}` : it.customId ? 'custom:' + it.customId : (it.fromTree ? A.routine.courseId + ':' : '') + it.exId, domain: it.ex.domain, label: it.ex.name, level: decision.level || it.ex.level || (course && course.difficulty) || 4, tempo: result.tempo, goal: it.goalBpm, clean: result.clean, source: 'routine' });
      A.prefill = null; A.peakBpm = 0;
      p.exerciseLog.push({ date: today(), at: Date.now(), exerciseId: it.exId, name: it.ex.name, courseId: A.routine.courseId, ...(it.songId ? { songId: it.songId } : {}), tempo: result.tempo, goalBpm: it.goalBpm, clean: result.clean, mastered: decision && decision.decision === 'mastered', source: A.routine.kind || 'routine' });
      toast(decision.message, 3800);
    }
    A.results.push({ key: it.key, name: it.ex.name, block: it.block, minutes: it.actualMin, tempo: result ? result.tempo : null, clean: result ? result.clean : null, skipped: !result, decision: decision ? decision.decision : 'skipped', message: decision ? decision.message : 'Skipped' });
    Store.save();
    if (A.idx >= A.routine.items.length - 1) return finish();
    A.idx++; A.itemStart = Date.now(); A.itemPaused = 0; A.alerted = false; A.lastToolBpm = null; A.prefill = null; A.peakBpm = 0; peak = 0; phase = 'play';
    saveActive(A); render(); window.scrollTo(0, 0);
  }

  function finish() {
    teardownTool();
    const activeMs = (A.pausedAt || Date.now()) - A.startedAt - A.pausedTotal;
    const minutes = Math.round(activeMs / 6000) / 10;
    if (minutes >= 0.5) p.practiceLog.push({ id: Math.random().toString(36).slice(2, 10), date: today(new Date(A.startedAt)), start: A.startedAt, minutes, source: A.routine.kind === 'song' ? 'song' : 'routine', courseId: A.routine.courseId, songId: A.routine.songId || null, genre: A.routine.genre, note: A.routine.focusTitle });
    if (course) { course.progress = progressPct(course); course.lastPracticed = today(); }
    const song = A.routine.songId ? findSong(p, A.routine.songId) : null;
    if (song) { song.lastPracticed = today(); (song.lessons = song.lessons || []).push({ date: today(), minutes, items: A.results.filter(r => !r.skipped).length }); if (song.lessons.length > 30) song.lessons.shift(); }
    const levelChanges = recomputeLevels(p);
    p.sessionLog.push({ date: today(), focus: `${A.routine.courseName}: ${A.routine.focusTitle}`, result: A.results.filter(r => !r.skipped).map(r => `${r.name} ${r.tempo} BPM${r.clean ? ' clean' : ''}`).join('; ') || 'no results logged' });
    Store.save();
    const summary = { ...A, minutes, finishedAt: Date.now(), progress: course ? course.progress : null, levelChanges };
    saveActive(null);
    try { sessionStorage.setItem('fretworkCoach.lastSummary', JSON.stringify(summary)); } catch { /* ignore */ }
    navigate('#/practice/summary');
  }

  function changeTime() {
    const sheet = Shell.sheet(`<h2>Change your time</h2><p class="muted small">The rest of the routine is re-fit to the time you have now. Today’s stretch block is kept.</p>
      <div data-r="t">${timeInputHTML(A.mode === 'end' ? 'end' : A.mode === 'open' ? 'open' : 'duration', Math.max(5, Math.round(A.deadline ? (A.deadline - Date.now()) / 60000 : 30)))}</div>
      <button class="btn primary block" data-r="apply">Update plan</button>`);
    const t = sheet.el.querySelector('[data-r="t"]'); wireTimeInput(t);
    sheet.el.addEventListener('click', e => {
      if (!e.target.closest('[data-r="apply"]')) return;
      const sel = readTime(t); if (sel.error) return toast(sel.error);
      const elapsedMin = itemElapsed() / 60;
      rebudget(A.routine, A.idx, sel.minutes == null ? null : Math.max(2, sel.minutes), elapsedMin);
      A.deadline = sel.deadline; A.mode = sel.mode; A.alerted = remaining() <= 0;
      saveActive(A); sheet.close(); toast(sel.minutes == null ? 'No time limit. Move on when you’re ready.' : `Plan re-fit to ${sel.minutes} min.`); render();
    });
  }

  function togglePause() {
    if (A.pausedAt) {
      const d = Date.now() - A.pausedAt; A.pausedTotal += d; A.itemPaused += d;
      if (A.deadline && A.mode === 'duration') A.deadline += d; // a duration budget pauses with you; a fixed end time doesn't
      A.pausedAt = null;
    } else { A.pausedAt = Date.now(); A.lastToolBpm = toolBpm(); }
    saveActive(A); render();
  }

  const onClick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.r === 'pause') return togglePause();
    if (d.r === 'time') return changeTime();
    if (d.r === 'end') { if (confirm('End the session now? Time so far is logged.')) finish(); return; }
    if (d.rs) { const inp = root.querySelector('[data-r="rtempo"]'); inp.value = Math.max(20, (+inp.value || 0) + Number(d.rs)); return; }
    if (d.rset) { root.querySelector('[data-r="rtempo"]').value = d.rset; return; }
    if (d.r === 'evaluate') {
      const it = cur(); A.lastToolBpm = toolBpm(); teardownTool();
      openEvalSheet({
        profile: p, exercise: it.ex, bpm: A.lastToolBpm || it.targetBpm, context: { courseId: A.routine.courseId, exId: it.exId, level: it.ex.level || (course && course.difficulty) || 4, source: 'routine' },
        onUse: r => { A.prefill = { tempo: r.tempo, clean: r.clean, summary: r.summary }; A.peakBpm = Math.max(A.peakBpm || 0, r.tempo); phase = 'result'; saveActive(A); render(); },
        onClose: () => { if (phase === 'play') { teardownTool(); mountTool(); } }
      });
      return;
    }
    if (d.clean != null) { const v = +root.querySelector('[data-r="rtempo"]').value; if (!v) return toast('Enter the tempo.'); advance({ tempo: v, clean: d.clean === '1' }); }
  };
  const barClick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.r === 'next') { A.lastToolBpm = toolBpm(); A.peakBpm = Math.max(peak, toolBpm(), tool && tool.getPeakBpm ? tool.getPeakBpm() : 0); phase = 'result'; saveActive(A); renderResult(); }
    else if (b.dataset.r === 'skip') advance(null);
    else if (b.dataset.r === 'back') { phase = 'play'; render(); }
  };
  root.addEventListener('click', onClick); Shell.actionBar.addEventListener('click', barClick);
  render();
  tick = setInterval(update, 250);
  return () => { clearInterval(tick); teardownTool(); root.removeEventListener('click', onClick); Shell.actionBar.removeEventListener('click', barClick); Shell.actions(''); };
}

/* -------------------------------- Summary ------------------------------- */
export function mountRoutineSummary(root, { navigate }) {
  let S = null; try { S = JSON.parse(sessionStorage.getItem('fretworkCoach.lastSummary') || 'null'); } catch { /* ignore */ }
  if (!S) { navigate('#/home'); return () => {}; }
  const icon = { mastered: '🏆', advance: '⬆', jump: '⏫', calibrate: '🎯', hold: '✓', retry: '•', regress: '↓', skipped: '–' };
  root.innerHTML = `
    <div class="label">Session complete</div><h1>Nice work.</h1>
    <section class="stats">
      <div class="stat"><div class="k">Practiced</div><div class="v">${fmtMinutes(S.minutes)}</div></div>
      <div class="stat"><div class="k">Exercises</div><div class="v">${S.results.filter(r => !r.skipped).length}/${S.routine.items.length}</div></div>
      <div class="stat"><div class="k">Course</div><div class="v">${S.progress != null ? S.progress + '%' : '—'}</div></div>
      <div class="stat ${S.minutes >= 15 ? 'ok' : ''}"><div class="k">Streak day</div><div class="v">${S.minutes >= 15 ? '✓' : '< 15m'}</div></div>
    </section>
    ${S.levelChanges && S.levelChanges.length ? `<section class="card levelup"><div class="label">Skill levels updated</div>${S.levelChanges.map(c => `<div class="lvchg"><b>${esc(c.name)}</b><span>${c.from} → <b class="${c.to > c.from ? 'ok' : 'bad'}">${c.to}</b></span></div>`).join('')}<p class="small muted">Levels blend your assessment with what you prove in lessons. New exercises now start at tempos matched to them.</p></section>` : ''}
    <section class="card"><h3>${esc(S.routine.courseName)}</h3>
      ${S.results.map(r => `<div class="resrow"><span class="ri">${icon[r.decision] || '•'}</span><div><b>${esc(r.name)}</b><div class="small muted">${esc(r.message)}</div></div><span class="rt">${r.tempo ? r.tempo + ' BPM' : ''}</span></div>`).join('')}
    </section>
    <div class="row"><a class="btn primary" href="#/home">Dashboard</a>${S.routine.songId ? `<a class="btn" href="#/song/${S.routine.songId}">Back to the song</a>` : S.routine.courseId ? `<a class="btn" href="#/course/${S.routine.courseId}">View course tree</a>` : '<a class="btn" href="#/practice">Practice</a>'}</div>`;
  return () => {};
}
