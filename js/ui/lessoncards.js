// Lesson cards shared by the Artist Series and the Technique Library: each
// lesson shows its tempo line, instructions and chord boxes, and can be tried
// inline (tab player), practiced (routine runner), added to your routines or saved.
import { esc, toast } from '../core/util.js';
import { Store } from '../core/store.js';
import { DOMAIN_BY_KEY } from '../assessment/engine.js';
import { methodOf } from '../core/methods.js';
import { toPlayerExercise } from '../core/coursegen.js';
import { saveCustom, addToRoutines } from '../core/custom.js';
import { makeAdhocRoutine } from '../core/routine.js';
import { exerciseDiagramsHTML } from './fretboard.js';
import { tempoShort } from './temporow.js';
import { mountTabPlayer } from '../tools/tabplayer.js';
import { Metronome, mountMetronome } from '../tools/metronome.js';
import { startRoutine } from '../screens/routine.js';

/** Saved progress for a lesson (by its stable key), or null. */
export const lessonState = (p, l) => (l && l.key ? (p.varState || {})[`${l.key}~base`] || null : null);
/** Today's tempo for a lesson: its saved target once practiced, else the calibrated one. */
export const lessonTarget = (p, l, calibrated) => { const st = lessonState(p, l); return st && st.target ? st.target : calibrated; };

/** A short summary for the collapsed row: the first sentence of why, about 120 characters at most. */
export function lessonSummary(ex) {
  const w = String(ex.why || ex.instr || '').trim(); if (!w) return '';
  const first = (w.match(/^.*?[.!?](\s|$)/) || [w])[0].trim();
  if (first.length <= 120) return first;
  const cut = first.slice(0, 118); return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…';
}
/**
 * One lesson, as a row that opens: the name, a one-line summary and its status; tapping it shows the
 * full lesson (tempo, instructions, chord boxes, actions). Only one is open at a time (lessonActions).
 * l = {ex, key, ...}; i = its index; target = today's tempo.
 */
export function lessonCardHTML(p, l, i, target) {
  const ex = l.ex, dom = DOMAIN_BY_KEY[ex.domain], st = lessonState(p, l);
  const saved = p.customExercises.some(c => c.ex.id === ex.id), inRoutine = p.prescriptions.some(r => r.status === 'active' && r.ex.id === ex.id);
  const badge = st && st.mastered ? '<span class="lesson-badge ok">✓ Mastered</span>' : st && st.history && st.history.length ? `<span class="lesson-badge">Best ${st.best || st.lastTempo} BPM</span>` : '';
  const m = methodOf(ex.method);
  return `<div class="askex artist-lesson lesson-row ${st && st.mastered ? 'done' : ''}" data-lesson="${i}">
    <button class="lr-head" data-al-open="${i}" aria-expanded="false" aria-controls="lr-body-${i}">
      <span class="lr-txt"><b>${esc(ex.name)}</b><span class="small muted lr-sum">${esc(lessonSummary(ex))}</span></span>
      <span class="lr-side">${badge}<span class="lr-chev" aria-hidden="true">›</span></span>
    </button>
    <div class="lr-body" id="lr-body-${i}" hidden>
      <div class="small muted lr-meta">${dom ? esc(dom.short || dom.name) : esc(ex.domain)}${ex.level ? ` · level ${ex.level}` : ''} · ${esc(tempoShort(ex, target, ex.goalBpm))} · ${ex.minutes || 5} min${m ? ` · <span class="method-chip" title="${esc(m.short)}">${esc(m.name)}</span>` : ''}</div>
      ${ex.why ? `<p class="why">${esc(ex.why)}</p>` : ''}
      ${ex.instr ? `<div class="instr small">${esc(ex.instr)}</div>` : ''}
      ${ex.watch ? `<div class="watch">⚠ ${esc(ex.watch)}</div>` : ''}
      ${ex.simplify ? `<div class="small muted">Too hard? ${esc(ex.simplify)}</div>` : ''}
      ${exerciseDiagramsHTML(ex)}
      <div class="row askex-act">
        <button class="btn sm primary" data-al="practice" data-i="${i}">▶ Practice</button>
        <button class="btn sm" data-al="try" data-i="${i}">▶ Try it here</button>
        <button class="btn sm" data-al="add" data-i="${i}" ${inRoutine ? 'disabled' : ''}>${inRoutine ? '✓ In your routines' : '+ Add to my routines'}</button>
        <button class="btn sm" data-al="save" data-i="${i}" ${saved ? 'disabled' : ''}>${saved ? '★ Saved' : '☆ Save'}</button>
      </div>
      <div data-artslot="${i}"></div>
    </div>
  </div>`;
}

/**
 * Click handling for a page of lesson cards.
 * get() returns {lessons, targets}; reason(l) says where a lesson came from (for routines and saves);
 * title(l) names the practice session. Returns {onClick(e) → handled?, stop()}.
 */
export function lessonActions(root, { get, reason, title, genre = null, navigate }) {
  const p = Store.profile;
  let tool = null, tryIdx = null, openIdx = null;
  const clearTry = () => {
    if (tool) { try { tool(); } catch { /* ignore */ } tool = null; }
    Metronome.stop(); tryIdx = null;
    root.querySelectorAll('[data-artslot]').forEach(s => { s.innerHTML = ''; });
    root.querySelectorAll('[data-al="try"]').forEach(b => { b.textContent = '▶ Try it here'; });
  };
  const stop = () => { clearTry(); openIdx = null; };
  /** Open one lesson (closing the one that was open, and its player); open(null) closes all. */
  function open(i, { scroll = false } = {}) {
    const next = i == null ? null : String(i);
    if (openIdx !== next) clearTry();
    root.querySelectorAll('.lesson-row').forEach(row => {
      const on = next != null && row.dataset.lesson === next;
      row.classList.toggle('open', on);
      const body = row.querySelector('.lr-body'), head = row.querySelector('.lr-head');
      if (body) body.hidden = !on;
      if (head) head.setAttribute('aria-expanded', on);
    });
    openIdx = next;
    const row = next != null && root.querySelector(`.lesson-row[data-lesson="${next}"]`);
    if (row && scroll && row.scrollIntoView) { try { row.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { /* ignore */ } }
    return row || null;
  }
  function tryIt(i) {
    const { lessons, targets } = get();
    const same = tryIdx === String(i);
    if (openIdx !== String(i)) open(i);
    clearTry();
    if (same) return;
    const slot = root.querySelector(`[data-artslot="${i}"]`), l = lessons[i]; if (!slot || !l) return;
    tryIdx = String(i);
    const btn = root.querySelector(`[data-al="try"][data-i="${i}"]`); if (btn) btn.textContent = '■ Close';
    const px = toPlayerExercise(l.ex, targets[i]);
    if (px) tool = mountTabPlayer(slot, px, { settings: p.settings, onSettings: patch => { Object.assign(p.settings, patch); Store.save(); }, startBpm: targets[i], compact: true, dock: true });
    else {
      Metronome.configure({ bpm: targets[i], mode: l.ex.metroMode || 'all', backing: l.ex.backing && l.ex.backing.length ? l.ex.backing : null, beatsPerBar: l.ex.beatsPerBar || 4, subdiv: 1, ramp: null });
      tool = mountMetronome(slot, { compact: true, dock: true });
    }
  }
  function onClick(e) {
    const h = e.target.closest('[data-al-open]');
    if (h && root.contains(h)) { const i = h.dataset.alOpen; open(openIdx === i ? null : i); return true; }
    const b = e.target.closest('[data-al]'); if (!b || b.dataset.i == null) return false;
    const { lessons, targets } = get();
    const i = +b.dataset.i, l = lessons[i]; if (!l) return false;
    switch (b.dataset.al) {
      case 'try': tryIt(i); return true;
      case 'save': saveCustom(p, l.ex, reason(l)); Store.save(); toast('Saved to Your exercises (Practice tab).'); b.disabled = true; b.textContent = '★ Saved'; return true;
      case 'add': if (addToRoutines(p, l.ex, reason(l))) { Store.save(); toast('Added to your daily routines.'); } b.disabled = true; b.textContent = '✓ In your routines'; return true;
      case 'practice': {
        stop();
        const plan = makeAdhocRoutine({ title: title(l), focus: l.skill ? l.skill.title : l.ex.name, genre: genre || p.questionnaire.genres[0] || null, items: [{ block: 'stretch', ex: l.ex, targetBpm: targets[i], minutes: l.ex.minutes || 5, ...(l.key ? { extra: { kbKey: l.key } } : {}) }], budget: null, kind: 'custom' });
        startRoutine(plan, undefined, navigate); return true;
      }
    }
    return false;
  }
  return { onClick, stop, open, get openIndex() { return openIdx; } };
}
