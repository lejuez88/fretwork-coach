// Lesson cards shared by the Artist Series and the Technique Library: each
// lesson shows its tempo line, instructions and chord boxes, and can be tried
// inline (tab player), practiced (routine runner), added to your routines or saved.
import { esc, toast } from '../core/util.js';
import { Store } from '../core/store.js';
import { DOMAIN_BY_KEY } from '../assessment/engine.js';
import { toPlayerExercise } from '../core/coursegen.js';
import { saveCustom, addToRoutines } from '../core/custom.js';
import { makeAdhocRoutine } from '../core/routine.js';
import { exerciseDiagramsHTML } from './fretboard.js';
import { tempoShort } from './temporow.js';
import { mountTabPlayer } from '../tools/tabplayer.js';
import { Metronome, mountMetronome } from '../tools/metronome.js';
import { startRoutine } from '../screens/routine.js';

/** One lesson card. l = {ex, ...}; i = its index; target = today's tempo. */
export function lessonCardHTML(p, l, i, target) {
  const ex = l.ex, dom = DOMAIN_BY_KEY[ex.domain];
  const saved = p.customExercises.some(c => c.ex.id === ex.id), inRoutine = p.prescriptions.some(r => r.status === 'active' && r.ex.id === ex.id);
  return `<div class="askex artist-lesson">
    <div class="askex-h"><b>${esc(ex.name)}</b></div>
    <div class="small muted">${dom ? esc(dom.short || dom.name) : esc(ex.domain)}${ex.level ? ` · level ${ex.level}` : ''} · ${esc(tempoShort(ex, target, ex.goalBpm))} · ${ex.minutes || 5} min</div>
    ${ex.why ? `<p class="why">${esc(ex.why)}</p>` : ''}
    ${ex.instr ? `<div class="instr small">${esc(ex.instr)}</div>` : ''}
    ${ex.watch ? `<div class="watch">⚠ ${esc(ex.watch)}</div>` : ''}
    ${ex.simplify ? `<div class="small muted">Too hard? ${esc(ex.simplify)}</div>` : ''}
    ${exerciseDiagramsHTML(ex)}
    <div class="row askex-act">
      <button class="btn sm" data-al="try" data-i="${i}">▶ Try it</button>
      <button class="btn sm primary" data-al="practice" data-i="${i}">▶ Practice</button>
      <button class="btn sm" data-al="add" data-i="${i}" ${inRoutine ? 'disabled' : ''}>${inRoutine ? '✓ In your routines' : '+ Add to my routines'}</button>
      <button class="btn sm" data-al="save" data-i="${i}" ${saved ? 'disabled' : ''}>${saved ? '★ Saved' : '☆ Save'}</button>
    </div>
    <div data-artslot="${i}"></div>
  </div>`;
}

/**
 * Click handling for a page of lesson cards.
 * get() returns {lessons, targets}; reason(l) says where a lesson came from (for routines and saves);
 * title(l) names the practice session. Returns {onClick(e) → handled?, stop()}.
 */
export function lessonActions(root, { get, reason, title, genre = null, navigate }) {
  const p = Store.profile;
  let tool = null, tryIdx = null;
  const stop = () => { if (tool) { try { tool(); } catch { /* ignore */ } tool = null; } Metronome.stop(); tryIdx = null; };
  function tryIt(i) {
    const { lessons, targets } = get();
    const same = tryIdx === String(i); stop();
    root.querySelectorAll('[data-artslot]').forEach(s => { s.innerHTML = ''; });
    root.querySelectorAll('[data-al="try"]').forEach(b => { b.textContent = '▶ Try it'; });
    if (same) return;
    const slot = root.querySelector(`[data-artslot="${i}"]`), l = lessons[i]; if (!slot || !l) return;
    tryIdx = String(i);
    const btn = root.querySelector(`[data-al="try"][data-i="${i}"]`); if (btn) btn.textContent = '■ Close';
    const px = toPlayerExercise(l.ex, targets[i]);
    if (px) tool = mountTabPlayer(slot, px, { settings: p.settings, onSettings: patch => { Object.assign(p.settings, patch); Store.save(); }, startBpm: targets[i], compact: true });
    else {
      Metronome.configure({ bpm: targets[i], mode: l.ex.metroMode || 'all', backing: l.ex.backing && l.ex.backing.length ? l.ex.backing : null, beatsPerBar: l.ex.beatsPerBar || 4, subdiv: 1, ramp: null });
      tool = mountMetronome(slot, { compact: true });
    }
  }
  function onClick(e) {
    const b = e.target.closest('[data-al]'); if (!b || b.dataset.i == null) return false;
    const { lessons, targets } = get();
    const i = +b.dataset.i, l = lessons[i]; if (!l) return false;
    switch (b.dataset.al) {
      case 'try': tryIt(i); return true;
      case 'save': saveCustom(p, l.ex, reason(l)); Store.save(); toast('Saved to Your exercises (Practice tab).'); b.disabled = true; b.textContent = '★ Saved'; return true;
      case 'add': if (addToRoutines(p, l.ex, reason(l))) { Store.save(); toast('Added to your daily routines.'); } b.disabled = true; b.textContent = '✓ In your routines'; return true;
      case 'practice': {
        stop();
        const plan = makeAdhocRoutine({ title: title(l), focus: l.skill ? l.skill.title : l.ex.name, genre: genre || p.questionnaire.genres[0] || null, items: [{ block: 'stretch', ex: l.ex, targetBpm: targets[i], minutes: l.ex.minutes || 5 }], budget: null, kind: 'custom' });
        startRoutine(plan, undefined, navigate); return true;
      }
    }
    return false;
  }
  return { onClick, stop };
}
