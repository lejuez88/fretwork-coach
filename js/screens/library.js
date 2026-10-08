// Practice tab: the "What do you want to work on?" box and the exercise
// library. Pick any exercise and any of its variations, play it with the tab
// player or metronome, log a result, or queue several into a timed session.
// Course routines are built from the dashboard.
import { esc, toast, fmtMinutes } from '../core/util.js';
import { Store } from '../core/store.js';
import { DOMAIN_BY_KEY } from '../assessment/engine.js';
import { CATEGORIES, CATEGORY_BY_ID, libraryEntries, libEntry, libVariations, libSummary, libState, libTarget, edgeVariation, recordLib, Queue, queueItems, levelFor, getLibParams, setLibParams, instanceOf } from '../core/library.js';
import { paramSummary, describeParams } from '../core/params.js';
import { paramControlsHTML } from '../ui/paramcontrols.js';
import { mountIntervalTrainer } from './intervals.js';
import { topicForEntry } from '../core/master.js';
import { openMasterSheet, MC_ICON } from '../ui/mastersheet.js';
import { findVariation } from '../core/variations.js';
import { makeAdhocRoutine } from '../core/routine.js';
import { toPlayerExercise } from '../core/coursegen.js';
import { describeChanges } from '../core/skills.js';
import { mountAskBox } from '../ui/ask.js';
import { exerciseDiagramsHTML } from '../ui/fretboard.js';
import { variationChipsHTML, variationNoteHTML, levelRange } from '../ui/variationpicker.js';
import { mountTabPlayer } from '../tools/tabplayer.js';
import { tempoRowHTML } from '../ui/temporow.js';
import { beatLabel } from '../core/tempo.js';
import { Metronome, mountMetronome } from '../tools/metronome.js';
import { Shell } from '../ui/shell.js';
import { TOPIC_ART, TOPIC_HUE } from '../ui/topicart.js';
import { startRoutine } from './routine.js';

const UI_KEY = 'fretworkCoach.libUI';
const getUI = () => { try { return JSON.parse(sessionStorage.getItem(UI_KEY) || '{}') || {}; } catch { return {}; } };
const setUI = v => { try { sessionStorage.setItem(UI_KEY, JSON.stringify(v)); } catch { /* ignore */ } };

/** Bottom bar for the session queue (or nothing when it is empty). */
function queueBar() {
  const n = Queue.get().length;
  Shell.actions(n ? `<button class="btn" data-q="clear">Clear</button><button class="btn primary" data-q="start">▶ Start session · ${n} exercise${n > 1 ? 's' : ''}</button>` : '');
}
function startQueue(navigate) {
  const p = Store.profile, items = queueItems(p);
  if (!items.length) { Queue.clear(); queueBar(); return; }
  const total = items.reduce((a, it) => a + (it.minutes || 5), 0);
  const plan = makeAdhocRoutine({ title: 'Library session', focus: `${items.length} exercise${items.length > 1 ? 's' : ''} you picked`, genre: p.questionnaire.genres[0] || null, items, budget: null, kind: 'library' });
  Queue.clear();
  toast(`Session: ${items.length} exercises, about ${fmtMinutes(total)}.`);
  startRoutine(plan, undefined, navigate);
}

/* --------------------------------- List --------------------------------- */
// Topics are buttons with a picture; tapping one opens its exercises below it.
// Searching opens every topic that has a match and shows only the matches.
export function mountLibrary(root, { navigate }) {
  const p = Store.profile;
  const ui = Object.assign({ open: [], q: '' }, getUI());
  if (!Array.isArray(ui.open)) ui.open = [];
  ui.open = ui.open.slice(0, 1); // one topic open at a time
  const entries = libraryEntries(p);
  let offAsk = null, fillTimer = null;

  root.innerHTML = `
    <h1>Practice</h1>
    <section class="card askcard" data-r="askslot"></section>
    <div class="libhead"><h2 class="sechead">Exercise library</h2><span class="muted small">${entries.length} exercises in ${CATEGORIES.length} topics, each with variations from easier to harder</span></div>
    <input type="search" class="libsearch" data-r="q" placeholder="Search: bends, F chord, funk, spider…" value="${esc(ui.q)}" autocomplete="off">
    <div class="topics" data-r="list"></div>
    <p class="muted small center">Course routines are built on the <a class="link" href="#/home">dashboard</a>.</p>`;
  offAsk = mountAskBox(root.querySelector('[data-r="askslot"]'), { start: plan => startRoutine(plan, undefined, navigate) });

  const match = (e, q) => {
    if (!q) return true;
    const hay = `${e.title || ''} ${e.ex.name} ${CATEGORY_BY_ID[e.cat].name} ${e.ex.why} ${e.ex.unit} ${e.ex.domain} ${(e.ex.chords || []).join(' ')} ${e.id.replace(/-/g, ' ')}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
  };
  const progressOf = id => {
    const keys = Object.keys(p.varState || {}).filter(k => k.startsWith(`lib:${id}~`));
    return { mastered: keys.filter(k => p.varState[k].mastered).length, practiced: keys.filter(k => (p.varState[k].history || []).length).length };
  };
  function row(e) {
    const dom = DOMAIN_BY_KEY[e.ex.domain], pr = progressOf(e.id);
    if (e.special) {
      const best = (p.intervalStats && p.intervalStats.rounds || []).reduce((m, r) => Math.max(m, r.n ? Math.round(r.correct / r.n * 100) : 0), 0);
      return `<a class="librow special" href="#/practice/ex/${e.id}"><div class="lrmain"><b>${esc(e.title)}</b>
        <div class="small muted">Interactive · play the note or tap it · any key, scale and intervals</div>${best ? `<div class="small">Best round: <span class="ok">${best}%</span></div>` : ''}</div><span class="chev">›</span></a>`;
    }
    const queued = Queue.get().filter(x => x.id === e.id).length;
    const ps = paramSummary(e.ex);
    return `<a class="librow" href="#/practice/ex/${e.id}">
      <div class="lrmain"><b>${esc(e.title || e.ex.name)}</b>
        <div class="small muted">${esc(dom ? dom.short || dom.name : e.ex.domain)} · <span data-vc="${e.id}">variations</span>${ps ? ` · ${esc(ps)}` : ''}</div>
        ${pr.practiced ? `<div class="small"><span class="ok">${pr.mastered} mastered</span> · ${pr.practiced} practiced</div>` : ''}</div>
      ${queued ? '<span class="badge">In session</span>' : '<span class="chev">›</span>'}</a>`;
  }
  function topicHTML(cat, list, open, searching) {
    const c = CATEGORY_BY_ID[cat];
    const all = entries.filter(e => e.cat === cat);
    const mastered = all.reduce((a, e) => a + progressOf(e.id).mastered, 0);
    return `<section class="topic ${open ? 'open' : ''}" data-topic="${cat}" style="--h:${TOPIC_HUE[cat] || 30}">
      <button class="topic-btn" data-tg="${cat}" aria-expanded="${open}" aria-controls="tb-${cat}">
        <span class="topic-img">${TOPIC_ART[cat] || ''}</span>
        <span class="topic-txt"><b>${esc(c.name)}</b><span class="small muted">${esc(c.blurb)}</span>
          <span class="small topic-meta">${searching ? `${list.length} match${list.length === 1 ? '' : 'es'}` : `${all.length} exercises`} · your level ${levelFor(p, cat)}${mastered ? ` · <span class="ok">${mastered} mastered</span>` : ''}</span></span>
        <span class="topic-chev" aria-hidden="true">›</span>
      </button>
      <div class="topic-body" id="tb-${cat}" ${open ? '' : 'hidden'}>${open ? `<div class="liblist">${list.map(row).join('')}</div>` : ''}</div>
    </section>`;
  }
  function drawList() {
    const q = ui.q.trim(), searching = !!q;
    const groups = CATEGORIES.map(([id]) => [id, entries.filter(e => e.cat === id && match(e, q))]).filter(([, list]) => !searching || list.length);
    root.querySelector('[data-r="list"]').innerHTML = groups.length
      ? groups.map(([cat, list]) => topicHTML(cat, list, searching || ui.open.includes(cat), searching)).join('')
      : '<p class="muted">No exercises match. Try another word, or ask for exactly what you need in the box above.</p>';
    fillCounts();
  }
  function toggle(cat) {
    const q = ui.q.trim();
    if (q) { ui.q = ''; root.querySelector('[data-r="q"]').value = ''; ui.open = [cat]; }
    else ui.open = ui.open.includes(cat) ? [] : [cat]; // opening a topic closes the one that was open
    setUI(ui); drawList();
    const sec = root.querySelector(`[data-topic="${cat}"]`);
    if (sec && ui.open.includes(cat) && sec.scrollIntoView) { try { sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch { /* ignore */ } }
  }
  // Variation counts are computed in small batches so the list appears at once.
  function fillCounts() {
    clearTimeout(fillTimer);
    const spans = [...root.querySelectorAll('[data-vc]')].filter(s => !s.dataset.done);
    const step = () => {
      const batch = spans.splice(0, 5);
      batch.forEach(s => { const e = entries.find(x => x.id === s.dataset.vc); if (!e || !s.isConnected || e.special) return; const list = libVariations(p, e); s.textContent = `${list.length} variations · ${levelRange(list)}`; s.dataset.done = '1'; });
      if (spans.length) fillTimer = setTimeout(step, 16);
    };
    step();
  }

  const onClick = e => { const t = e.target.closest('[data-tg]'); if (t) toggle(t.dataset.tg); };
  const onInput = e => { if (e.target.dataset.r === 'q') { ui.q = e.target.value; setUI(ui); drawList(); } };
  const barClick = e => { const b = e.target.closest('[data-q]'); if (!b) return; if (b.dataset.q === 'clear') { Queue.clear(); queueBar(); drawList(); } else startQueue(navigate); };
  root.addEventListener('click', onClick); root.addEventListener('input', onInput); Shell.actionBar.addEventListener('click', barClick);
  drawList(); queueBar();
  return () => { clearTimeout(fillTimer); if (offAsk) offAsk(); root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); Shell.actionBar.removeEventListener('click', barClick); Shell.actions(''); };
}

/* -------------------------------- Detail -------------------------------- */
export function mountLibraryExercise(root, { navigate, id, vid = null }) {
  const p = Store.profile;
  const entry = libEntry(p, id);
  if (!entry) { navigate('#/practice'); return () => {}; }
  if (entry.special) return mountIntervalTrainer(root, { navigate, entry });
  const list = libVariations(p, entry);
  const edge = edgeVariation(p, entry, list);
  let cur = findVariation(list, vid || (edge && edge.vid));
  let tool = null, logOpen = false;
  const cat = CATEGORY_BY_ID[entry.cat];
  // key / strings / chords: stored per exercise
  let params = getLibParams(entry.id), inst = instanceOf(cur, params);
  const mtopic = topicForEntry(entry);

  function teardown() { if (tool) { tool(); tool = null; } Metronome.stop(); }
  function render() {
    teardown();
    const v = cur, ex = inst.ex, st = libState(p, entry.id, v.vid), target = libTarget(p, entry, v);
    const queued = Queue.has(entry.id, v.vid);
    root.innerHTML = `
      <a class="link" href="#/practice">← Exercise library</a>
      <div class="exhead">
        <div class="label">${esc(cat.name)}</div>
        <h1>${esc(entry.title || entry.ex.name)}</h1>
        ${entry.ex.why ? `<p class="why">${esc(entry.ex.why)}</p>` : ''}
      </div>
      <button class="mcbtn" data-a="master">${MC_ICON} <span>Master class: <b>${esc(mtopic.title)}</b></span><span class="small muted">a whole course on this topic ›</span></button>
      <div class="exgrid">
        <section class="card exvar">
          <div class="sec-head"><div class="label">Variations · ${list.length} · ${levelRange(list)}</div><span class="small muted">Your level: ${levelFor(p, entry.cat)}</span></div>
          ${variationChipsHTML(list, { current: v.vid, edge: edge && edge.vid, stateOf: x => libState(p, entry.id, x) })}
          ${variationNoteHTML(v)}
          ${inst.dims.length ? `<div class="label" style="margin-top:14px">Key, strings and chords</div>${paramControlsHTML(inst.dims, params)}` : ''}
        </section>
        <section class="card exinfo">
          <h3>${esc(ex.name)}</h3>
          ${tempoRowHTML(ex, target, { best: st && st.best, mastered: st && st.mastered })}
          <div class="small muted">${esc(ex.unit || '')}${ex.minutes ? ` · about ${ex.minutes} min` : ''}</div>
          ${ex.instr ? `<div class="instr">${esc(ex.instr)}</div>` : ''}
          ${ex.watch ? `<div class="watch">⚠ Watch for: ${esc(ex.watch)}</div>` : ''}
          ${ex.simplify && v.vid !== 'simp' ? `<div class="small muted">Too hard? ${esc(ex.simplify)}</div>` : ''}
        </section>
        <section class="card explayer">
          ${exerciseDiagramsHTML(ex)}
          <div data-r="tool"></div>
        </section>
        <section class="card exlog" data-r="logcard"></section>
      </div>`;
    Shell.actions(`<button class="btn" data-a="queue">${queued ? '✓ In session' : '+ Add to session'}</button><button class="btn primary" data-a="timer">▶ Practice with timer</button>`);
    mountTool(target);
    drawLog();
  }
  const curBpm = () => (tool && tool.getBpm ? tool.getBpm() : Metronome.bpm);
  /** The log card, redrawn on its own so the player keeps running. */
  function drawLog() {
    const v = cur, ex = v.ex, st = libState(p, entry.id, v.vid), target = libTarget(p, entry, v);
    root.querySelector('[data-r="logcard"]').innerHTML = `
        <div class="sec-head"><h3>Log a result</h3>${st && st.history.length ? `<span class="small muted">${st.history.length} logged</span>` : ''}</div>
        ${logOpen ? `<label class="mini">Highest tempo you played cleanly (or where you stopped)</label>
          <div class="stepper"><button data-rs="-5">−5</button><button data-rs="-1">−1</button><input type="number" inputmode="numeric" data-r="rtempo" value="${curBpm() || target}"><button data-rs="1">+1</button><button data-rs="5">+5</button></div>
          <div class="unit">BPM (${esc(beatLabel(ex))}) · target ${target} · goal ${ex.goalBpm}</div>
          <p class="small" style="margin-top:10px">Clean means 4 reps in a row with no flubbed notes, at that tempo.</p>
          <div class="rubric"><button data-clean="1"><span class="n">✓</span><span>Clean at this tempo</span></button><button data-clean="0"><span class="n">~</span><span>Not clean yet</span></button></div>`
          : '<button class="btn block" data-r="openlog">Log tempo for this variation</button>'}
        ${st && st.history.length ? `<div class="loghist">${st.history.slice(-6).reverse().map(h => `<div class="logrow"><span>${h.date}</span><b>${h.tempo} BPM</b><span class="${h.clean ? 'ok' : 'muted'}">${h.clean ? 'clean' : 'not yet'}</span></div>`).join('')}</div>` : ''}`;
  }
  function mountTool(target) {
    const slot = root.querySelector('[data-r="tool"]'), ex = inst.ex;
    const px = toPlayerExercise(ex, target);
    if (px) tool = mountTabPlayer(slot, px, { settings: p.settings, onSettings: patch => { Object.assign(p.settings, patch); Store.save(); }, startBpm: target, compact: true });
    else {
      Metronome.configure({ bpm: target, mode: ex.metroMode || 'all', backing: ex.backing && ex.backing.length ? ex.backing : null, beatsPerBar: ex.beatsPerBar || 4, subdiv: 1, ramp: null });
      tool = mountMetronome(slot, { compact: false });
    }
  }
  function choose(vid) {
    cur = findVariation(list, vid); logOpen = false; inst = instanceOf(cur, params);
    try { history.replaceState(null, '', `#/practice/ex/${entry.id}/${cur.vid}`); } catch { /* ignore */ }
    render();
  }
  function log(clean) {
    const v = +root.querySelector('[data-r="rtempo"]').value; if (!v) return toast('Enter the tempo.');
    const r = recordLib(p, entry, cur, { tempo: v, clean });
    Store.save(); logOpen = false;
    toast((r.decision && r.decision.message ? r.decision.message : `Logged ${v} BPM.`) + (r.changes.length ? ` Level up: ${describeChanges(r.changes)}.` : ''), 4200);
    render();
  }

  function setParam(idp, value) {
    params = { ...params, [idp]: value };
    // a choice equal to the exercise's own setting is just the default
    const d = inst.dims.find(x => x.id === idp); if (d && String(d.value) === String(value)) delete params[idp];
    setLibParams(entry.id, params); inst = instanceOf(cur, params); render();
  }
  const onChange = e => { const sel = e.target.closest('[data-param]'); if (sel) setParam(sel.dataset.param, sel.value); };
  const onClick = e => {
    if (e.target.closest('[data-a="master"]')) return openMasterSheet({ ...mtopic, from: { name: entry.title || entry.ex.name, why: entry.ex.why || '' } }, { navigate });
    const chip = e.target.closest('[data-vid]'); if (chip) return choose(chip.dataset.vid);
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.r === 'openlog') { logOpen = true; drawLog(); return; }
    if (b.dataset.rs) { const inp = root.querySelector('[data-r="rtempo"]'); inp.value = Math.max(20, (+inp.value || 0) + Number(b.dataset.rs)); return; }
    if (b.dataset.clean != null) return log(b.dataset.clean === '1');
  };
  const barClick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'queue') { const added = Queue.toggle(entry.id, cur.vid); toast(added ? `Added to your session (${Queue.get().length}). Start it from the library.` : 'Removed from your session.'); b.textContent = added ? '✓ In session' : '+ Add to session'; }
    if (b.dataset.a === 'timer') {
      const v = cur, plan = makeAdhocRoutine({ title: entry.title || entry.ex.name, focus: v.label, genre: p.questionnaire.genres[0] || null, kind: 'library', budget: null,
        items: [{ block: 'stretch', ex: inst.ex, targetBpm: libTarget(p, entry, v), minutes: v.ex.minutes || 5, extra: { libId: entry.id, vid: v.vid, exId: entry.ex.id, baseEx: entry.ex, params, resolved: inst.resolved, ...(v.base ? {} : { variation: `${v.label}: ${v.change}` }) } }] });
      teardown(); startRoutine(plan, undefined, navigate);
    }
  };
  root.addEventListener('click', onClick); root.addEventListener('change', onChange); Shell.actionBar.addEventListener('click', barClick);
  render();
  return () => { teardown(); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); Shell.actionBar.removeEventListener('click', barClick); Shell.actions(''); };
}
