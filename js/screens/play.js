// The practice page (#/play): one lesson at a time with the tab and the player always on screen.
// The stage holds the tab player and fills the window between the top bar and the playback bar,
// so the tab never scrolls out of view. Everything else lives in a panel on the right that slides
// out and folds back into a rail of buttons:
//   Study      what the concept is, why it matters, the theory behind it, how to play it
//   Customize  variations, key / strings / chords, display (scrolling tab, pick strokes, fretboard,
//              light or dark tab) and the picking mode
//   Log        the tempo you reached, clean or not, and the history
// plus Evaluate this take and Build a master class. ‹ › move through the list the lesson came from
// (a course, a path, an artist, the exercise library), and ← goes back to it. No timer: timed
// sessions are the routines built on Home.
//
// A practice context: {title, back, backLabel, idx, items: [routine-item shape + skill/unit info],
// courseId?, kind}. openPractice(ctx) stores it (so a reload keeps your place) and opens #/play.
import { esc, toast } from '../core/util.js';
import { Store } from '../core/store.js';
import { Claude } from '../core/claude.js';
import { toPlayerExercise } from '../core/coursegen.js';
import { calibratedTarget, ensureState, tempoLadder } from '../core/progression.js';
import { variationsFor, findVariation, pickVariation } from '../core/variations.js';
import { variationChipsHTML, variationNoteHTML, levelRange } from '../ui/variationpicker.js';
import { paramDims, resolveParams, withParams, describeParams } from '../core/params.js';
import { paramControlsHTML } from '../ui/paramcontrols.js';
import { recordItemResult, itemState, varKeyOf, usesVarState } from '../core/record.js';
import { recomputeLevels, describeChanges } from '../core/skills.js';
import { lessonStudy } from '../core/study.js';
import { openEvalSheet } from '../eval/ui.js';
import { mountTabPlayer } from '../tools/tabplayer.js';
import { Metronome, mountMetronome } from '../tools/metronome.js';
import { PICK_MODES } from '../tools/picking.js';
import { exerciseDiagramsHTML } from '../ui/fretboard.js';
import { tempoRowHTML } from '../ui/temporow.js';
import { beatLabel } from '../core/tempo.js';
import { Shell } from '../ui/shell.js';
import { topicForExercise, topicForEntry } from '../core/master.js';
import { libEntry, libraryEntries, levelFor, Queue, CATEGORY_BY_ID } from '../core/library.js';
import { openMasterSheet, MC_ICON } from '../ui/mastersheet.js';
import { DOMAIN_BY_KEY } from '../assessment/engine.js';
import { methodOf } from '../core/methods.js';

const PLAY_KEY = 'fretworkCoach.play';
const PANEL_KEY = 'fretworkCoach.playPanel';
const getCtx = () => { try { return JSON.parse(sessionStorage.getItem(PLAY_KEY) || 'null'); } catch { return null; } };
const saveCtx = c => { try { sessionStorage.setItem(PLAY_KEY, JSON.stringify(c)); } catch { /* too big: keep in memory */ } };

/** Open the practice page on a list of lessons. */
export function openPractice(ctx, navigate) {
  const c = { kind: 'lessons', idx: 0, ...ctx, idx: Math.max(0, Math.min((ctx.items || []).length - 1, ctx.idx || 0)) };
  saveCtx(c); memo = c;
  if (navigate) navigate('#/play'); else location.hash = '#/play';
}
let memo = null;

/** A practice context for the exercise library: every exercise in the same topic, starting at `id`. */
export function libraryContext(p, id, vid = null) {
  const e = libEntry(p, id); if (!e || e.special) return null;
  const list = libraryEntries(p).filter(x => x.cat === e.cat && !x.special);
  const items = list.map(x => { const full = libEntry(p, x.id); return full ? { ex: full.ex, libId: full.id, exId: full.ex.id, cat: full.cat, title: full.title || full.ex.name, skill: { title: (CATEGORY_BY_ID[full.cat] || {}).name || '', summary: (CATEGORY_BY_ID[full.cat] || {}).blurb ? `${CATEGORY_BY_ID[full.cat].name}: ${CATEGORY_BY_ID[full.cat].blurb}.` : '' } } : null; }).filter(Boolean);
  const idx = Math.max(0, items.findIndex(x => x.libId === id));
  if (vid) items[idx].wantVid = vid;
  return { kind: 'library', title: 'Exercise library', back: '#/practice', backLabel: 'Exercise library', idx, items };
}
/** A practice context for a course: every exercise of the plan in order, starting at a skill (or an exercise). */
export function courseContext(p, course, { skillId = null, exId = null } = {}) {
  if (!course || !course.tree) return null;
  ensureState(course);
  const items = [];
  course.tree.units.forEach(u => u.skills.forEach(s => s.exercises.forEach(ex => items.push({ ex, exId: ex.id, skillId: s.id, fromTree: true, courseId: course.id, skill: { title: s.title, summary: s.summary, study: s.study || null }, unit: u.title }))));
  let idx = exId ? items.findIndex(x => x.exId === exId) : skillId ? items.findIndex(x => x.skillId === skillId) : 0;
  if (skillId && !exId) {
    // the first exercise of the skill that isn't mastered yet
    const firstOpen = items.findIndex(x => x.skillId === skillId && !(course.state.exercises[x.exId] || {}).mastered);
    if (firstOpen >= 0) idx = firstOpen;
  }
  return { kind: 'course', title: course.name, back: `#/course/${course.id}`, backLabel: 'Course tree', courseId: course.id, idx: Math.max(0, idx), items };
}

export function mountPlay(root, { navigate, ctx = null }) {
  const p = Store.profile;
  let C = ctx || memo || getCtx();
  if (!C || !C.items || !C.items.length) { navigate('#/practice'); return () => {}; }
  if (ctx) saveCtx(C);
  memo = C;
  const course = C.courseId ? p.courses.find(x => x.id === C.courseId) : null;
  if (course) ensureState(course);
  let tool = null, offMetro = null, peak = 0, logOpen = false, lastDecision = null, explaining = false;
  let panel = (() => { try { return JSON.parse(localStorage.getItem(PANEL_KEY) || 'null'); } catch { return null; } })() || { open: !narrow(), tab: 'study' };
  const savePanel = () => { try { localStorage.setItem(PANEL_KEY, JSON.stringify(panel)); } catch { /* ignore */ } };
  const cur = () => C.items[C.idx];
  document.body.classList.add('playmode');
  Shell.actions('');

  /* ---------------------- preparing the current item ---------------------- */
  const varsOf = it => { try { return variationsFor(it.baseEx || it.ex, { course, level: (it.baseEx || it.ex).level || (it.libId ? levelFor(p, it.cat) : (course && course.difficulty) || 4) }); } catch { return []; } };
  const preParamsEx = it => { if (it.vid && it.vid !== 'base') { const v = findVariation(varsOf(it), it.vid); if (v) return v.ex; } return it.baseEx || it.ex; };
  function prepare(it) {
    if (it.prepared) return;
    it.baseEx = it.baseEx || it.ex;
    // library exercises open on the recommended variation (just above your level, not mastered)
    if (it.libId && !it.vid) {
      const list = varsOf(it);
      const want = it.wantVid && findVariation(list, it.wantVid);
      const v = want || pickVariation(list, { want: 'edge', level: levelFor(p, it.cat), isMastered: vid => !!((p.varState || {})[`lib:${it.libId}~${vid}`] || {}).mastered });
      if (v) { it.vid = v.vid; it.ex = JSON.parse(JSON.stringify(v.ex)); it.recVid = v.vid; }
    }
    it.goalBpm = it.ex.goalBpm;
    retarget(it);
    it.prepared = true;
  }
  function retarget(it) {
    const st = itemState(p, it, course);
    it.targetBpm = st && st.target ? st.target : calibratedTarget(it.ex, it.ex.level || 4, p);
    const lad = tempoLadder(it.targetBpm, Math.max(it.goalBpm || it.targetBpm, it.targetBpm));
    it.ramp = { enabled: false, step: lad.step, max: lad.max, rungs: lad.rungs };
  }
  function chooseVariation(vid) {
    const it = cur(), v = findVariation(varsOf(it), vid); if (!v) return;
    it.vid = v.vid; it.ex = JSON.parse(JSON.stringify(v.ex)); it.goalBpm = v.ex.goalBpm;
    if (it.params && Object.keys(it.params).length) applyParams(it);
    retarget(it); saveCtx(C); peak = 0; render();
    toast(v.base ? 'The exercise as written.' : `Variation: ${v.label} (level ${v.level}).`);
  }
  function applyParams(it) {
    const pre = preParamsEx(it), dims = paramDims(pre);
    it.resolved = resolveParams(it.params || {}, dims);
    it.ex = withParams(pre, it.resolved);
  }
  function setParam(id, value) {
    const it = cur(); it.params = { ...(it.params || {}), [id]: value };
    const d = paramDims(preParamsEx(it)).find(x => x.id === id); if (d && String(d.value) === String(value)) delete it.params[id];
    applyParams(it); saveCtx(C); render();
  }

  /* -------------------------------- render -------------------------------- */
  function render() {
    teardown();
    const it = cur(); prepare(it);
    const n = C.items.length, st = itemState(p, it, course);
    const dark = (p.settings.tabTheme || 'dark') !== 'light';
    root.innerHTML = `<div class="play ${panel.open ? 'panel-open' : ''}">
      <header class="play-bar">
        <a class="kbtn pb-back" href="${esc(C.back || '#/practice')}" title="Back to ${esc(C.backLabel || 'the list')}">←<span class="pb-backtxt"> ${esc(C.backLabel || 'Back')}</span></a>
        <div class="pb-title"><div class="label">${esc(C.title || 'Practice')}${n > 1 ? ` · ${C.idx + 1} of ${n}` : ''}${it.unit ? ` · ${esc(it.unit)}` : ''}</div><b>${esc(it.ex.name)}</b></div>
        <div class="pb-nav">
          <button class="kbtn" data-pl="prev" ${C.idx === 0 ? 'disabled' : ''} aria-label="Previous lesson" title="Previous lesson">‹</button>
          <button class="kbtn" data-pl="next" ${C.idx >= n - 1 ? 'disabled' : ''} aria-label="Next lesson" title="Next lesson">›</button>
        </div>
      </header>
      <div class="play-stage" data-r="stage">
        <div class="stage-meta">${tempoRowHTML(it.ex, it.targetBpm, { goal: it.goalBpm, best: st && st.best, mastered: st && st.mastered, lead: 'Today' })}${st && st.mastered ? '<span class="lesson-badge ok">✓ Mastered</span>' : ''}</div>
        <div class="stage-tool" data-r="tool"></div>
      </div>
      <nav class="play-rail" aria-label="Lesson panel">
        <button class="rail-btn ${panel.open && panel.tab === 'study' ? 'on' : ''}" data-rail="study" title="Study the lesson"><span>📖</span><b>Study</b></button>
        <button class="rail-btn ${panel.open && panel.tab === 'custom' ? 'on' : ''}" data-rail="custom" title="Variations, key and display"><span>⚙</span><b>Customize</b></button>
        <button class="rail-btn ${panel.open && panel.tab === 'log' ? 'on' : ''}" data-rail="log" title="Log the tempo you reached"><span>✓</span><b>Log tempo</b></button>
        <button class="rail-btn" data-rail="eval" title="Evaluate this take"><span>🎤</span><b>Evaluate</b></button>
        <button class="rail-btn" data-rail="master" title="Build a master class on this"><span>${MC_ICON}</span><b>Master class</b></button>
        <button class="rail-btn" data-rail="theme" title="${dark ? 'Light' : 'Dark'} tab"><span>${dark ? '☀' : '☾'}</span><b>${dark ? 'Light tab' : 'Dark tab'}</b></button>
      </nav>
      <aside class="play-panel" data-r="panel" ${panel.open ? '' : 'hidden'}>
        <div class="pp-head"><div class="segtabs three pp-tabs">${[['study', 'Study'], ['custom', 'Customize'], ['log', 'Log tempo']].map(([k, l]) => `<a href="javascript:void 0" data-ptab="${k}" class="${panel.tab === k ? 'on' : ''}">${l}</a>`).join('')}</div>
          <button class="kbtn sm pp-close" data-pl="close" aria-label="Close the panel" title="Close">✕</button></div>
        <div class="pp-body" data-r="pbody">${panelBody(it)}</div>
      </aside>
    </div>`;
    mountTool();
    requestAnimationFrame(layout);
  }
  function panelBody(it) {
    if (panel.tab === 'custom') return customHTML(it);
    if (panel.tab === 'log') return logHTML(it);
    return studyHTML(it);
  }
  function studyHTML(it) {
    const s = lessonStudy(it, (p.lessonCache && p.lessonCache.study) || null), ex = it.ex, dom = DOMAIN_BY_KEY[ex.domain];
    return `<div class="study">
      <div class="small muted">${dom ? esc(dom.name) : esc(ex.domain || '')}${ex.level ? ` · level ${ex.level}` : ''} · ${esc(ex.unit || '')}${ex.minutes ? ` · about ${ex.minutes} min` : ''}</div>
      ${it.skill && it.skill.title && it.skill.title !== ex.name ? `<div class="label st-skill">${esc(it.skill.title)}</div>` : ''}
      ${s.concept ? `<h4>The concept</h4><p>${esc(s.concept)}</p>` : ''}
      ${s.why ? `<h4>Why it matters</h4><p>${esc(s.why)}</p>` : ''}
      ${s.theory.length ? `<h4>The theory</h4><ul class="st-theory">${s.theory.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${ex.instr ? `<h4>How to practice it</h4><div class="instr">${esc(ex.instr)}</div>` : ''}
      ${ex.watch ? `<div class="watch">⚠ Watch for: ${esc(ex.watch)}</div>` : ''}
      ${ex.simplify ? `<p class="small muted">Too hard? ${esc(ex.simplify)}</p>` : ''}
      ${s.method ? `<h4>How this lesson teaches</h4><p class="small"><span class="method-chip">${esc(s.method.name)}</span> ${esc(s.method.text)}</p>` : ''}
      ${exerciseDiagramsHTML(ex)}
      ${!s.written && Claude.hasKey() ? `<button class="btn sm" data-pl="explain" ${explaining ? 'disabled' : ''}>${explaining ? '<span class="spinner sm"></span>Writing…' : '✨ Explain it in more depth (Claude)'}</button>` : ''}
      ${s.fromClaude ? '<p class="small muted">Study notes written by Claude for this exercise.</p>' : ''}
    </div>`;
  }
  function customHTML(it) {
    const list = varsOf(it), dims = paramDims(preParamsEx(it)), v = list.length ? findVariation(list, it.vid) : null;
    const d = tool && tool.display ? tool.display() : { scroll: p.settings.tabScroll !== false, picks: p.settings.tabPicks !== false, neck: p.settings.tabNeck !== false, pickMode: null };
    const tg = (k, l, on) => `<button class="tgl ${on ? 'on' : ''}" data-dtg="${k}" aria-pressed="${on}">${l}</button>`;
    return `<div class="custom">
      ${list.length > 1 ? `<h4>Variations <span class="small muted">${list.length} · ${levelRange(list)}</span></h4>
        ${it.recVid && it.vid !== it.recVid ? `<p class="small muted">Recommended for you: ${esc((findVariation(list, it.recVid) || {}).label || '')} <button class="linkbtn small" data-vid="${it.recVid}">← back to it</button></p>` : it.recVid ? '<p class="small muted">This is the variation recommended for your level.</p>' : ''}
        ${variationChipsHTML(list, { current: v ? v.vid : 'base', stateOf: x => (x === 'base' && !usesVarState({ ...it, vid: null }) ? itemState(p, { ...it, vid: null }, course) : (p.varState || {})[varKeyOf({ ...it, vid: x }, course)] || null) })}
        ${v && !v.base ? variationNoteHTML(v) : ''}` : ''}
      ${dims.length ? `<h4>Key, strings and chords</h4>${paramControlsHTML(dims, it.params || {})}${it.resolved && Object.keys(it.resolved).length ? `<p class="small muted">${esc(describeParams(dims, it.resolved))}</p>` : ''}` : ''}
      ${tool && tool.display ? `<h4>Display</h4><div class="toggles">${tg('scroll', 'Scrolling tab', d.scroll)}${tg('picks', 'Pick strokes', d.picks)}${tg('neck', 'Fretboard', d.neck)}${tg('theme', 'Light tab', (p.settings.tabTheme || 'dark') === 'light')}</div>
        <label class="mini" style="margin-top:10px">Picking<select data-r="pickmode">${PICK_MODES.map(([k, l]) => `<option value="${k}" ${d.pickMode === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
      ${it.libId ? `<h4>Timed session</h4><button class="btn sm" data-pl="queue">${Queue.has(it.libId, it.vid || 'base') ? '✓ In your session' : '+ Add to a timed session'}</button><p class="small muted">Sessions start from the exercise library, with a timer for each exercise.</p>` : ''}
    </div>`;
  }
  const curBpm = () => (tool && tool.getBpm ? tool.getBpm() : Metronome.bpm);
  function logHTML(it) {
    const st = itemState(p, it, course), bpm = Math.max(peak, curBpm() || 0) || it.targetBpm;
    return `<div class="logpane">
      ${lastDecision ? `<div class="note">${esc(lastDecision)}</div>${C.idx < C.items.length - 1 ? '<button class="btn primary block" data-pl="next">Next lesson ›</button>' : ''}` : ''}
      <label class="mini">Highest tempo you played cleanly (or where you stopped)</label>
      <div class="stepper"><button data-rs="-5">−5</button><button data-rs="-1">−1</button><input type="number" inputmode="numeric" data-r="rtempo" value="${bpm}"><button data-rs="1">+1</button><button data-rs="5">+5</button></div>
      <div class="unit">BPM (${esc(beatLabel(it.ex))}) · target ${it.targetBpm} · goal ${it.goalBpm}</div>
      <p class="small">Clean means 4 reps in a row with no flubbed notes, at that tempo.</p>
      <div class="rubric"><button data-clean="1"><span class="n">✓</span><span>Clean at this tempo</span></button><button data-clean="0"><span class="n">~</span><span>Not clean yet</span></button></div>
      ${st && st.history && st.history.length ? `<h4>History</h4><div class="loghist">${st.history.slice(-8).reverse().map(h => `<div class="logrow"><span>${h.date}</span><b>${h.tempo} BPM</b><span class="${h.clean ? 'ok' : 'muted'}">${h.clean ? 'clean' : 'not yet'}</span></div>`).join('')}</div>` : ''}
    </div>`;
  }
  function drawPanel() {
    const body = root.querySelector('[data-r="pbody"]'); if (body) body.innerHTML = panelBody(cur());
    root.querySelectorAll('[data-ptab]').forEach(a => a.classList.toggle('on', a.dataset.ptab === panel.tab));
    root.querySelectorAll('[data-rail]').forEach(b => b.classList.toggle('on', panel.open && b.dataset.rail === panel.tab));
  }
  function setPanel(open, tab = panel.tab) {
    panel = { open, tab }; savePanel();
    const pl = root.querySelector('.play'); if (pl) pl.classList.toggle('panel-open', open);
    const el = root.querySelector('[data-r="panel"]'); if (el) el.hidden = !open;
    drawPanel(); layout();
  }

  /* ------------------------------- the tool ------------------------------- */
  function teardown() { if (tool) { tool(); tool = null; } if (offMetro) { offMetro(); offMetro = null; } Metronome.stop(); }
  function mountTool() {
    const it = cur(), slot = root.querySelector('[data-r="tool"]');
    const px = toPlayerExercise(it.ex, it.targetBpm);
    peak = it.targetBpm;
    if (px) {
      tool = mountTabPlayer(slot, px, { settings: p.settings, onSettings: patch => { Object.assign(p.settings, patch); Store.save(); }, startBpm: it.targetBpm, compact: true, dock: true,
        ramp: { enabled: false, step: it.ramp.step, everyLoops: 2, max: it.ramp.max }, onBpm: v => { peak = Math.max(peak, v); } });
    } else {
      Metronome.configure({ bpm: it.targetBpm, mode: it.ex.metroMode || 'all', backing: it.ex.backing && it.ex.backing.length ? it.ex.backing : null, beatsPerBar: it.ex.beatsPerBar || 4, subdiv: 1, ramp: { enabled: false, step: it.ramp.step, everyBars: 4, max: it.ramp.max } });
      slot.innerHTML = `${exerciseDiagramsHTML(it.ex)}<div data-r="metro"></div>`;
      offMetro = mountMetronome(slot.querySelector('[data-r="metro"]'), { compact: false, dock: true });
      const off = Metronome.on(e => { if (e.type === 'bpm') peak = Math.max(peak, e.bpm); });
      const o = offMetro; offMetro = () => { o(); off(); };
    }
  }
  /** Fit the stage between the top bar and the playback bar (and beside the panel on wide screens). */
  function layout() {
    const stage = root.querySelector('[data-r="stage"]'), bar = root.querySelector('.play-bar'); if (!stage || !bar) return;
    document.body.style.setProperty('--play-top', bar.getBoundingClientRect().bottom + 'px');
    if (tool && tool.relayout) tool.relayout();
  }

  /* ------------------------------- actions -------------------------------- */
  function go(delta) {
    const next = C.idx + delta; if (next < 0 || next >= C.items.length) return;
    C.idx = next; lastDecision = null; saveCtx(C); render();
    if (C.kind === 'library' && cur().libId) { try { history.replaceState(null, '', `#/practice/ex/${cur().libId}`); } catch { /* ignore */ } }
  }
  function log(clean) {
    const inp = root.querySelector('[data-r="rtempo"]'); const tempo = +(inp && inp.value); if (!tempo) return toast('Enter the tempo.');
    const it = cur();
    const decision = recordItemResult(p, it, { tempo, clean }, { course, source: 'practice' });
    const ch = recomputeLevels(p);
    Store.save();
    lastDecision = (decision && decision.message ? decision.message : `Logged ${tempo} BPM.`) + (ch.length ? ` Level up: ${describeChanges(ch)}.` : '');
    toast(lastDecision, 4200);
    retarget(it); saveCtx(C);
    const meta = root.querySelector('.stage-meta'); const st = itemState(p, it, course);
    if (meta) meta.innerHTML = `${tempoRowHTML(it.ex, it.targetBpm, { goal: it.goalBpm, best: st && st.best, mastered: st && st.mastered, lead: 'Today' })}${st && st.mastered ? '<span class="lesson-badge ok">✓ Mastered</span>' : ''}`;
    drawPanel();
  }
  function evaluate() {
    const it = cur();
    teardown();
    openEvalSheet({
      profile: p, exercise: it.ex, bpm: curBpm() || it.targetBpm, context: { courseId: C.courseId || null, exId: it.exId, level: it.ex.level || 4, source: 'practice' },
      onUse: r => { peak = Math.max(peak, r.tempo); lastDecision = `🎤 Measured: ${r.summary}`; render(); setPanel(true, 'log'); const inp = root.querySelector('[data-r="rtempo"]'); if (inp) inp.value = r.tempo; },
      onClose: () => mountTool()
    });
  }
  function master() {
    const it = cur(), e = it.libId ? libEntry(p, it.libId) : null;
    const topic = e && !e.special ? { ...topicForEntry(e), from: { name: it.ex.name, why: it.ex.why || '' } } : topicForExercise(it.baseEx || it.ex);
    openMasterSheet(topic, { navigate });
  }
  async function explain() {
    const it = cur(), ex = it.ex; explaining = true; drawPanel();
    try {
      const raw = await Claude.json({ feature: 'study', system: 'You are a world-class guitar teacher. You explain concepts clearly and briefly, with correct music theory.',
        content: `Write study notes a guitarist reads before practicing this exercise.\nEXERCISE: ${JSON.stringify({ name: ex.name, why: ex.why, instr: ex.instr, unit: ex.unit, chords: ex.chords, skill: it.skill && it.skill.title })}\nReturn JSON {"concept": "2-3 sentences: what the technique or idea is", "why": "1-2 sentences: why it matters and where it is used in real music", "theory": ["2-4 short, correct theory facts behind it (notes, intervals, scale or chord functions, rhythm)"]}`, maxTokens: 700 });
      const st = { concept: String(raw.concept || '').slice(0, 500), why: String(raw.why || '').slice(0, 400), theory: (raw.theory || []).map(String).slice(0, 5) };
      p.lessonCache = p.lessonCache || { masters: [], requests: [] }; p.lessonCache.study = p.lessonCache.study || {};
      p.lessonCache.study[ex.id] = st; Store.save();
    } catch (e) { toast(e.message || 'Claude couldn’t write it.'); }
    explaining = false; drawPanel();
  }

  const onClick = e => {
    const rail = e.target.closest('[data-rail]');
    if (rail) {
      const k = rail.dataset.rail;
      if (k === 'eval') return evaluate();
      if (k === 'master') return master();
      if (k === 'theme') return setTheme();
      return setPanel(!(panel.open && panel.tab === k), k);
    }
    const pt = e.target.closest('[data-ptab]'); if (pt) return setPanel(true, pt.dataset.ptab);
    const chip = e.target.closest('[data-vid]'); if (chip && root.querySelector('[data-r="panel"]').contains(chip)) return chooseVariation(chip.dataset.vid);
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pl === 'prev') return go(-1);
    if (b.dataset.pl === 'next') return go(1);
    if (b.dataset.pl === 'close') return setPanel(false);
    if (b.dataset.pl === 'explain') return explain();
    if (b.dataset.pl === 'queue') { const it = cur(); const added = Queue.toggle(it.libId, it.vid || 'base'); toast(added ? `Added to your session (${Queue.get().length}). Start it from the exercise library.` : 'Removed from your session.'); return drawPanel(); }
    if (b.dataset.dtg) { if (b.dataset.dtg === 'theme') return setTheme(); if (tool && tool.flip) { tool.flip(b.dataset.dtg); drawPanel(); requestAnimationFrame(layout); } return; }
    if (b.dataset.rs) { const inp = root.querySelector('[data-r="rtempo"]'); inp.value = Math.max(20, (+inp.value || 0) + Number(b.dataset.rs)); return; }
    if (b.dataset.clean != null) return log(b.dataset.clean === '1');
  };
  function setTheme() {
    p.settings.tabTheme = (p.settings.tabTheme || 'dark') === 'light' ? 'dark' : 'light'; Store.save();
    if (tool && tool.setTheme) tool.setTheme(p.settings.tabTheme);
    root.querySelector('.play').classList.toggle('tab-light', p.settings.tabTheme === 'light');
    const t = root.querySelector('[data-rail="theme"]'); const dark = p.settings.tabTheme !== 'light';
    if (t) t.innerHTML = `<span>${dark ? '☀' : '☾'}</span><b>${dark ? 'Light tab' : 'Dark tab'}</b>`;
    drawPanel();
  }
  const onChange = e => {
    const sel = e.target.closest('[data-param]'); if (sel) return setParam(sel.dataset.param, sel.value);
    if (e.target.dataset.r === 'pickmode' && tool && tool.setPickMode) tool.setPickMode(e.target.value);
  };
  const onKey = e => {
    const tag = e.target && e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowRight' && e.altKey) { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft' && e.altKey) { e.preventDefault(); go(-1); }
  };
  const onResize = () => layout();
  root.addEventListener('click', onClick); root.addEventListener('change', onChange);
  document.addEventListener('keydown', onKey); window.addEventListener('resize', onResize); window.addEventListener('fc:bars', onResize);
  render();
  if ((p.settings.tabTheme || 'dark') === 'light') root.querySelector('.play').classList.add('tab-light');
  return () => {
    teardown(); document.body.classList.remove('playmode');
    root.removeEventListener('click', onClick); root.removeEventListener('change', onChange);
    document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); window.removeEventListener('fc:bars', onResize);
  };
}
function narrow() { return typeof matchMedia === 'function' && matchMedia('(max-width: 999px)').matches; }
