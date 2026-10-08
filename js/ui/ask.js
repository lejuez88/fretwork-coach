// "What do you want to work on?" bubble for the Practice screen. The student
// types a request in their own words; Claude (or the local drill matcher)
// returns 1–3 exercises with tab previews that can be tried inline, practiced
// as a session, saved, or added to the daily routines.
import { esc, toast } from '../core/util.js';
import { Store } from '../core/store.js';
import { Claude } from '../core/claude.js';
import { DOMAIN_BY_KEY } from '../assessment/engine.js';
import { exerciseDiagramsHTML } from './fretboard.js';
import { generateExercises, saveCustom, removeCustom, addToRoutines, roleBlock, ASK_EXAMPLES } from '../core/custom.js';
import { makeAdhocRoutine } from '../core/routine.js';
import { toPlayerExercise } from '../core/coursegen.js';
import { notesToText } from '../core/tabparse.js';
import { mountTabPlayer } from '../tools/tabplayer.js';
import { Metronome, mountMetronome } from '../tools/metronome.js';
import { variationsFor, findVariation } from '../core/variations.js';
import { calibratedTarget } from '../core/progression.js';
import { variationChipsHTML, variationNoteHTML } from './variationpicker.js';

const ROLE = { drill: 'Drill', main: 'Main exercise', apply: 'Apply it' };
const DRAFT_KEY = 'fretworkCoach.askDraft';

/** Card for one exercise. i = index used by buttons; opts.saved = saved entry */
export function exerciseCardHTML(ex, { i, role = null, target = null, saved = null, actions = ['try', 'add', 'save'] } = {}) {
  const dom = DOMAIN_BY_KEY[ex.domain];
  const tab = ex.tab && ex.tab.notes && ex.tab.notes.length ? notesToText(ex.tab.notes, { tuning: ex.tab.tuning || undefined, maxBars: 2 }) : '';
  return `<div class="askex b-${role ? roleBlock(role) : 'stretch'}">
    <div class="askex-h">${role ? `<span class="pblock">${ROLE[role] || role}</span>` : ''}<b>${esc(ex.name)}</b></div>
    <div class="small muted">${dom ? esc(dom.short || dom.name) : esc(ex.domain)}${ex.level ? ` · level ${ex.level}` : ''} · ${target || ex.startBpm} → ${ex.goalBpm} BPM · ${ex.minutes || 5} min${ex.unit ? ' · ' + esc(ex.unit) : ''}</div>
    ${ex.why ? `<p class="why">${esc(ex.why)}</p>` : ''}
    ${ex.instr ? `<div class="instr small">${esc(ex.instr)}</div>` : ''}
    ${ex.watch ? `<div class="watch">⚠ ${esc(ex.watch)}</div>` : ''}
    ${ex.simplify ? `<div class="small muted">Too hard? ${esc(ex.simplify)}</div>` : ''}
    ${tab ? `<pre class="tab small">${esc(tab)}</pre>` : ''}
    ${exerciseDiagramsHTML(ex)}
    ${saved && saved.state ? `<div class="small">Target <b>${saved.state.target}</b> BPM${saved.state.best ? ` · best ${saved.state.best}` : ''}${saved.state.mastered ? ' · <span class="ok">mastered</span>' : ''}</div>` : ''}
    <div class="row askex-act">
      ${actions.includes('try') ? `<button class="btn sm" data-ask="try" data-i="${i}">▶ Try it</button>` : ''}
      ${actions.includes('practice') ? `<button class="btn sm primary" data-ask="practice1" data-i="${i}">▶ Practice</button>` : ''}
      ${actions.includes('add') ? `<button class="btn sm" data-ask="add" data-i="${i}">+ Add to my routines</button>` : ''}
      ${actions.includes('save') ? `<button class="btn sm" data-ask="save" data-i="${i}">☆ Save</button>` : ''}
      ${actions.includes('remove') ? `<button class="btn sm ghost danger" data-ask="remove" data-i="${i}">Remove</button>` : ''}
    </div>
    <div data-tryslot="${i}"></div>
  </div>`;
}

/**
 * Mount the ask box. start(routine) launches a routine in the runner.
 * Returns a cleanup function.
 */
export function mountAskBox(el, { start, courseId = null }) {
  const p = Store.profile;
  let busy = false, result = null, request = '', tryTool = null, tryIdx = null, showSaved = false;
  try { const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); if (d) { result = d.result; request = d.request; } } catch { /* ignore */ }
  const keep = () => { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ result, request })); } catch { /* ignore */ } };

  function stopTry() { if (tryTool) { tryTool(); tryTool = null; } Metronome.stop(); tryIdx = null; }

  function render() {
    stopTry();
    const saved = p.customExercises;
    el.innerHTML = `
      <div class="label">What do you want to work on?</div>
      <div class="askbox">
        <textarea data-r="ask" rows="2" maxlength="600" placeholder="Tell me in your own words, e.g. “my bends sound out of tune” or “switching between F and C”">${esc(request)}</textarea>
        <button class="btn primary" data-ask="go" ${busy ? 'disabled' : ''}>${busy ? '<span class="spinner sm"></span>Creating…' : 'Create exercise'}</button>
      </div>
      ${!result && !busy ? `<div class="chips askchips">${ASK_EXAMPLES.slice(0, 6).map(x => `<button class="chip sm" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
      ${!Claude.hasKey() ? '<p class="small muted">Without a Claude key, exercises come from the built-in drill library. <a class="link small" href="#/settings">Add key</a></p>' : ''}
      <div data-r="out">${result ? resultHTML() : ''}</div>
      ${saved.length ? `<div class="savedhead"><button class="btn ghost sm" data-ask="toggleSaved">${showSaved ? '▾' : '▸'} Your exercises (${saved.length})</button></div>
        ${showSaved ? `<div class="savedlist">${saved.map((c, i) => exerciseCardHTML(c.ex, { i: 's' + i, target: c.state.target, saved: c, actions: ['practice', 'try', 'add', 'remove'] }) + (c.request ? `<p class="small muted askreq">You asked: “${esc(c.request)}”</p>` : '')).join('')}</div>` : ''}` : ''}`;
  }

  function resultHTML() {
    const total = result.items.reduce((a, it) => a + (it.ex.minutes || 5), 0);
    return `<div class="askresult">
      ${result.summary ? `<p class="coach">${result.source === 'claude' ? '🎯 ' : ''}${esc(result.summary)}</p>` : ''}
      ${result.error ? `<p class="small muted">Claude couldn’t answer (${esc(result.error)}), so these come from the drill library.</p>` : ''}
      ${result.items.map((it, i) => exerciseCardHTML(it.ex, { i, role: it.role, target: it.targetBpm })).join('')}
      <div class="row"><button class="btn primary" data-ask="practice">▶ Practice ${result.items.length > 1 ? 'these' : 'this'} now · ${total} min</button><button class="btn ghost" data-ask="clear">Clear</button></div>
    </div>`;
  }

  const itemAt = i => {
    if (String(i).startsWith('s')) { const c = p.customExercises[+String(i).slice(1)]; return c ? { ex: c.ex, saved: c, targetBpm: c.state.target, role: 'main' } : null; }
    return result && result.items[+i];
  };

  async function go() {
    const ta = el.querySelector('[data-r="ask"]'); request = (ta.value || '').trim();
    if (request.length < 3) return toast('Tell me what you’d like to work on.');
    busy = true; result = null; render();
    try { result = await generateExercises(p, request); }
    catch (e) { toast(e.message || 'Could not create exercises.'); }
    busy = false; keep(); render();
    const out = el.querySelector('.askresult'); if (out && out.scrollIntoView) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Inline preview with the exercise's variations; vid switches variation in place. */
  function tryIt(i, vid = null) {
    const it = itemAt(i); if (!it) return;
    const same = tryIdx === String(i); stopTry();
    el.querySelectorAll('[data-tryslot]').forEach(s => { s.innerHTML = ''; });
    if (same && vid == null) return;
    const slot = el.querySelector(`[data-tryslot="${i}"]`); tryIdx = String(i);
    let list = []; try { list = variationsFor(it.ex, { level: it.ex.level || 4 }); } catch { list = []; }
    const v = list.length ? findVariation(list, vid) : null;
    const ex = v ? v.ex : it.ex;
    const target = !v || v.base ? (it.targetBpm || it.ex.startBpm) : calibratedTarget(v.ex, v.level, p);
    slot.innerHTML = `${list.length > 1 ? `<div class="label" style="margin-top:10px">Variations · ${list.length}</div>${variationChipsHTML(list, { current: v.vid, attr: 'data-tvid' })}${variationNoteHTML(v)}` : ''}<div data-r="trytool"></div>`;
    const host = slot.querySelector('[data-r="trytool"]');
    const px = toPlayerExercise(ex, target);
    if (px) tryTool = mountTabPlayer(host, px, { settings: p.settings, onSettings: patch => { Object.assign(p.settings, patch); Store.save(); }, startBpm: target, compact: true });
    else {
      Metronome.configure({ bpm: target, mode: ex.metroMode || 'all', backing: ex.backing && ex.backing.length ? ex.backing : null, beatsPerBar: ex.beatsPerBar || 4, subdiv: 1, ramp: null });
      tryTool = mountMetronome(host, { compact: true });
    }
  }

  function practice(items) {
    const entries = items.map(it => {
      const entry = it.saved || saveCustom(p, it.ex, request);
      return { block: roleBlock(it.role), ex: entry.ex, targetBpm: entry.state.target, minutes: entry.ex.minutes || 5, extra: { customId: entry.id } };
    });
    Store.save();
    const first = items[0].saved ? items[0].saved.request : request;
    const plan = makeAdhocRoutine({ title: items.length > 1 ? 'Your request' : entries[0].ex.name, focus: first || entries[0].ex.name, genre: p.questionnaire.genres[0] || null, items: entries, budget: null, kind: 'custom' });
    stopTry();
    start(plan);
  }

  const onClick = e => {
    const chip = e.target.closest('[data-ex]');
    if (chip) { const ta = el.querySelector('[data-r="ask"]'); ta.value = chip.dataset.ex; ta.focus(); return; }
    const tv = e.target.closest('[data-tvid]');
    if (tv && tryIdx != null) return tryIt(tryIdx, tv.dataset.tvid);
    const b = e.target.closest('[data-ask]'); if (!b) return;
    const a = b.dataset.ask, i = b.dataset.i;
    if (a === 'go') return go();
    if (a === 'clear') { result = null; request = ''; keep(); return render(); }
    if (a === 'toggleSaved') { showSaved = !showSaved; return render(); }
    if (a === 'try') return tryIt(i);
    if (a === 'practice') return result && practice(result.items);
    const it = itemAt(i); if (!it) return;
    if (a === 'practice1') return practice([it]);
    if (a === 'save') { saveCustom(p, it.ex, request); Store.save(); toast('Saved to Your exercises.'); b.disabled = true; b.textContent = '★ Saved'; return; }
    if (a === 'add') {
      const rx = addToRoutines(p, it.ex, it.saved ? it.saved.request : request, courseId);
      Store.save(); toast(rx ? 'Added: it goes first in the stretch block of your next routines.' : 'Already in your routines.'); b.disabled = true; b.textContent = '✓ In your routines'; return;
    }
    if (a === 'remove' && it.saved) { removeCustom(p, it.saved.id); Store.save(); return render(); }
  };
  const onKey = e => { if (e.target.dataset.r === 'ask' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } };
  const onInput = e => { if (e.target.dataset.r === 'ask') request = e.target.value; };
  el.addEventListener('click', onClick); el.addEventListener('keydown', onKey); el.addEventListener('input', onInput);
  render();
  return () => { stopTry(); el.removeEventListener('click', onClick); el.removeEventListener('keydown', onKey); el.removeEventListener('input', onInput); };
}
