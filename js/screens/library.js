// Practice tab: the "What do you want to work on?" box and the exercise
// library. Pick any exercise and any of its variations, play it with the tab
// player or metronome, log a result, or queue several into a timed session.
// Course routines are built from the dashboard.
import { esc, toast, fmtMinutes } from '../core/util.js';
import { Store } from '../core/store.js';
import { DOMAIN_BY_KEY } from '../assessment/engine.js';
import { CATEGORIES, CATEGORY_BY_ID, libraryEntries, libEntry, libVariations, libSummary, libState, libTarget, edgeVariation, recordLib, Queue, queueItems, levelFor } from '../core/library.js';
import { findVariation } from '../core/variations.js';
import { makeAdhocRoutine } from '../core/routine.js';
import { toPlayerExercise } from '../core/coursegen.js';
import { describeChanges } from '../core/skills.js';
import { mountAskBox } from '../ui/ask.js';
import { exerciseDiagramsHTML } from '../ui/fretboard.js';
import { variationChipsHTML, variationNoteHTML, levelRange } from '../ui/variationpicker.js';
import { mountTabPlayer } from '../tools/tabplayer.js';
import { Metronome, mountMetronome } from '../tools/metronome.js';
import { Shell } from '../ui/shell.js';
import { startRoutine, hasActiveRoutine } from './routine.js';

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
export function mountLibrary(root, { navigate }) {
  const p = Store.profile;
  const ui = Object.assign({ cat: 'all', q: '' }, getUI());
  const entries = libraryEntries(p);
  let offAsk = null, fillTimer = null;

  root.innerHTML = `
    <h1>Practice</h1>
    ${hasActiveRoutine() ? '<section class="card routine-cta live"><div class="label">Routine in progress</div><h3>Pick up where you left off</h3><a class="btn primary block" href="#/practice/run">▶ Resume routine</a></section>' : ''}
    <section class="card askcard" data-r="askslot"></section>
    <div class="libhead"><h2 class="sechead">Exercise library</h2><span class="muted small">${entries.length} exercises, each with variations from easier to harder</span></div>
    <input type="search" class="libsearch" data-r="q" placeholder="Search: bends, F chord, funk, spider…" value="${esc(ui.q)}" autocomplete="off">
    <div class="chips libcats" data-r="cats">${[['all', 'All'], ...CATEGORIES.map(([id, name]) => [id, name])].map(([id, name]) => `<button class="chip sm ${ui.cat === id ? 'on' : ''}" data-cat="${id}">${esc(name)}</button>`).join('')}</div>
    <div data-r="list"></div>
    <p class="muted small center">Course routines are built on the <a class="link" href="#/home">dashboard</a>.</p>`;
  offAsk = mountAskBox(root.querySelector('[data-r="askslot"]'), { start: plan => startRoutine(plan, undefined, navigate) });

  const match = (e, q) => {
    if (!q) return true;
    const hay = `${e.ex.name} ${CATEGORY_BY_ID[e.cat].name} ${e.ex.why} ${e.ex.unit} ${e.ex.domain} ${(e.ex.chords || []).join(' ')} ${e.id.replace(/-/g, ' ')}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
  };
  function row(e) {
    const dom = DOMAIN_BY_KEY[e.ex.domain];
    const keys = Object.keys(p.varState || {}).filter(k => k.startsWith(`lib:${e.id}~`));
    const mastered = keys.filter(k => p.varState[k].mastered).length, practiced = keys.filter(k => (p.varState[k].history || []).length).length;
    const queued = Queue.get().filter(x => x.id === e.id).length;
    return `<a class="librow" href="#/practice/ex/${e.id}">
      <div class="lrmain"><b>${esc(e.ex.name)}</b>
        <div class="small muted">${esc(dom ? dom.short || dom.name : e.ex.domain)} · <span data-vc="${e.id}">variations</span></div>
        ${practiced ? `<div class="small"><span class="ok">${mastered} mastered</span> · ${practiced} practiced</div>` : ''}</div>
      ${queued ? '<span class="badge">In session</span>' : '<span class="chev">›</span>'}</a>`;
  }
  function drawList() {
    const q = ui.q.trim();
    const shown = entries.filter(e => (ui.cat === 'all' || e.cat === ui.cat) && match(e, q));
    const groups = ui.cat === 'all' && !q ? CATEGORIES.map(([id]) => [id, shown.filter(e => e.cat === id)]).filter(g => g[1].length) : [[ui.cat === 'all' ? null : ui.cat, shown]];
    root.querySelector('[data-r="list"]').innerHTML = shown.length ? groups.map(([cat, list]) => `
      ${cat ? `<div class="libcat"><h3>${esc(CATEGORY_BY_ID[cat].name)}</h3><span class="small muted">${esc(CATEGORY_BY_ID[cat].blurb)} · your level ${levelFor(p, cat)}</span></div>` : ''}
      <div class="liblist">${list.map(row).join('')}</div>`).join('')
      : '<p class="muted">No exercises match. Try another word, or ask for exactly what you need in the box above.</p>';
    fillCounts();
  }
  // Variation counts are computed in small batches so the list appears at once.
  function fillCounts() {
    clearTimeout(fillTimer);
    const spans = [...root.querySelectorAll('[data-vc]')].filter(s => !s.dataset.done);
    const step = () => {
      const batch = spans.splice(0, 5);
      batch.forEach(s => { const e = entries.find(x => x.id === s.dataset.vc); if (!e || !s.isConnected) return; const list = libVariations(p, e); s.textContent = `${list.length} variations · ${levelRange(list)}`; s.dataset.done = '1'; });
      if (spans.length) fillTimer = setTimeout(step, 16);
    };
    step();
  }

  const onClick = e => {
    const c = e.target.closest('[data-cat]');
    if (c) { ui.cat = c.dataset.cat; setUI(ui); root.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('on', x === c)); drawList(); }
  };
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
  const list = libVariations(p, entry);
  const edge = edgeVariation(p, entry, list);
  let cur = findVariation(list, vid || (edge && edge.vid));
  let tool = null, logOpen = false;
  const cat = CATEGORY_BY_ID[entry.cat];

  function teardown() { if (tool) { tool(); tool = null; } Metronome.stop(); }
  function render() {
    teardown();
    const v = cur, ex = v.ex, st = libState(p, entry.id, v.vid), target = libTarget(p, entry, v);
    const queued = Queue.has(entry.id, v.vid);
    root.innerHTML = `
      <a class="link" href="#/practice">← Exercise library</a>
      <div class="label">${esc(cat.name)}</div>
      <h1>${esc(entry.ex.name)}</h1>
      ${entry.ex.why ? `<p class="why">${esc(entry.ex.why)}</p>` : ''}
      <section class="card">
        <div class="sec-head"><div class="label">Variations · ${list.length} · ${levelRange(list)}</div><span class="small muted">Your level: ${levelFor(p, entry.cat)}</span></div>
        ${variationChipsHTML(list, { current: v.vid, edge: edge && edge.vid, stateOf: x => libState(p, entry.id, x) })}
        ${variationNoteHTML(v)}
      </section>
      <section class="card">
        ${ex.name !== entry.ex.name ? `<h3>${esc(ex.name)}</h3>` : ''}
        <div class="tempo-row"><span>Target <b>${target}</b></span><span>Goal <b class="goal">${ex.goalBpm}</b> BPM</span>${st && st.best ? `<span>Best <b>${st.best}</b></span>` : ''}${st && st.mastered ? '<span class="ok">Mastered</span>' : ''}</div>
        <div class="small muted">${esc(ex.unit || '')}${ex.minutes ? ` · about ${ex.minutes} min` : ''}</div>
        ${ex.instr ? `<div class="instr">${esc(ex.instr)}</div>` : ''}
        ${ex.watch ? `<div class="watch">⚠ Watch for: ${esc(ex.watch)}</div>` : ''}
        ${ex.simplify && v.vid !== 'simp' ? `<div class="small muted">Too hard? ${esc(ex.simplify)}</div>` : ''}
        ${exerciseDiagramsHTML(ex)}
        <div data-r="tool"></div>
      </section>
      <section class="card" data-r="logcard"></section>`;
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
          <div class="unit">BPM · target ${target} · goal ${ex.goalBpm}</div>
          <p class="small" style="margin-top:10px">Clean means 4 reps in a row with no flubbed notes, at that tempo.</p>
          <div class="rubric"><button data-clean="1"><span class="n">✓</span><span>Clean at this tempo</span></button><button data-clean="0"><span class="n">~</span><span>Not clean yet</span></button></div>`
          : '<button class="btn block" data-r="openlog">Log tempo for this variation</button>'}
        ${st && st.history.length ? `<div class="loghist">${st.history.slice(-6).reverse().map(h => `<div class="logrow"><span>${h.date}</span><b>${h.tempo} BPM</b><span class="${h.clean ? 'ok' : 'muted'}">${h.clean ? 'clean' : 'not yet'}</span></div>`).join('')}</div>` : ''}`;
  }
  function mountTool(target) {
    const slot = root.querySelector('[data-r="tool"]'), ex = cur.ex;
    const px = toPlayerExercise(ex, target);
    if (px) tool = mountTabPlayer(slot, px, { settings: p.settings, onSettings: patch => { Object.assign(p.settings, patch); Store.save(); }, startBpm: target, compact: true });
    else {
      Metronome.configure({ bpm: target, mode: ex.metroMode || 'all', backing: ex.backing && ex.backing.length ? ex.backing : null, beatsPerBar: ex.beatsPerBar || 4, subdiv: 1, ramp: null });
      tool = mountMetronome(slot, { compact: false });
    }
  }
  function choose(vid) {
    cur = findVariation(list, vid); logOpen = false;
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

  const onClick = e => {
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
      const v = cur, plan = makeAdhocRoutine({ title: entry.ex.name, focus: v.label, genre: p.questionnaire.genres[0] || null, kind: 'library', budget: null,
        items: [{ block: 'stretch', ex: v.ex, targetBpm: libTarget(p, entry, v), minutes: v.ex.minutes || 5, extra: { libId: entry.id, vid: v.vid, exId: entry.ex.id, baseEx: entry.ex, ...(v.base ? {} : { variation: `${v.label}: ${v.change}` }) } }] });
      teardown(); startRoutine(plan, undefined, navigate);
    }
  };
  root.addEventListener('click', onClick); Shell.actionBar.addEventListener('click', barClick);
  render();
  return () => { teardown(); root.removeEventListener('click', onClick); Shell.actionBar.removeEventListener('click', barClick); Shell.actions(''); };
}
