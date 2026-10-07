// Evaluate: pick something to play, record it (audio or video), get measured
// feedback and coaching, and add prescriptions to your routines.
import { esc, fmtMinutes } from '../core/util.js';
import { Store } from '../core/store.js';
import { Claude } from '../core/claude.js';
import { EXERCISES, EXERCISE_BY_ID } from '../tools/exercises.js';
import { activeSkills, ensureState, exerciseLevel } from '../core/progression.js';
import { mountEvalSession } from '../eval/ui.js';
import { currentLatency } from '../eval/latency.js';

const PICK_KEY = 'fretworkCoach.evalPick';

function candidates(p) {
  const out = [];
  (p.prescriptions || []).filter(r => r.status === 'active').forEach(r => out.push({ key: 'rx:' + r.id, group: 'Your prescriptions', ex: r.ex, bpm: r.state.target, level: r.ex.level || 4, courseId: r.courseId, note: r.reason }));
  for (const c of p.courses.filter(c => c.status !== 'archived' && c.tree)) {
    ensureState(c);
    for (const s of activeSkills(c).slice(0, 3)) for (const e of s.exercises) {
      const es = c.state.exercises[e.id]; if (es.mastered) continue;
      out.push({ key: `c:${c.id}:${e.id}`, group: c.name, ex: e, bpm: es.target, level: exerciseLevel(c, e), courseId: c.id, note: `${s.title} · target ${es.target} BPM`, hasTab: !!(e.tab && e.tab.notes) });
    }
  }
  EXERCISES.forEach(e => out.push({ key: 'lib:' + e.id, group: 'Library', ex: e, bpm: e.bpm, level: e.level, note: `${e.unit} · goal ${e.goalBpm}`, hasTab: true }));
  out.push({ key: 'rhythm', group: 'Rhythm check', ex: { id: 'rhythm-check', name: 'Rhythm check: strum or riff along', domain: 'rhythm', unit: '8ths', goalBpm: 120, startBpm: 80, why: 'Play anything in time with the click; the app measures how tightly you lock to the beat.' }, bpm: 80, level: (p.domains.rhythm || {}).level || 4, note: 'Any chords or riff, in time with the click' });
  return out;
}

export function mountEvaluate(root, { navigate, sub = null }) {
  const p = Store.profile;
  let mode = 'audio', cleanup = null;
  const list = candidates(p);

  if (sub === 'run') {
    let pick = null; try { pick = JSON.parse(sessionStorage.getItem(PICK_KEY) || 'null'); } catch { /* ignore */ }
    const c = pick && list.find(x => x.key === pick.key);
    if (!c) { navigate('#/evaluate'); return () => {}; }
    root.innerHTML = `<a class="link" href="#/evaluate">← Evaluate</a><section class="card" data-r="sess"></section>`;
    cleanup = mountEvalSession(root.querySelector('[data-r="sess"]'), {
      profile: p, exercise: c.ex, bpm: c.bpm, mode: pick.mode, context: { courseId: c.courseId || null, exId: c.ex.id, level: c.level, source: 'evaluate' },
      onFinish: () => navigate('#/evaluate')
    });
    return () => cleanup && cleanup();
  }
  if (sub && sub.startsWith('view-')) return viewPast(root, p, sub.slice(5));

  function render() {
    const L = currentLatency(p.settings);
    const groups = [...new Set(list.map(x => x.group))];
    const recent = [...p.evaluations].reverse().slice(0, 6);
    root.innerHTML = `
      <h1>Evaluate my playing</h1>
      <div class="segtabs four">${[['tuner', 'Tuner'], ['metronome', 'Metronome'], ['tabs', 'Tab player'], ['evaluate', 'Evaluate']].map(([k, l]) => `<a href="${k === 'evaluate' ? '#/evaluate' : '#/tools/' + k}" class="${'evaluate' === k ? 'on' : ''}">${l}</a>`).join('')}</div>
      <section class="card">
        <div class="segtabs two">${['audio', 'video'].map(m => `<a href="javascript:void 0" data-m="${m}" class="${mode === m ? 'on' : ''}">${m === 'audio' ? '🎤 Audio check' : '🎥 Video form check'}</a>`).join('')}</div>
        <p class="small">${mode === 'audio'
          ? 'Play an exercise along with the click. The app hears every note and measures what a teacher listens for: missed and wrong notes, timing (rushing, dragging, consistency, drift), evenness, weak hammer-ons, tuning, and the exact spots that go wrong.'
          : 'The app films you playing and sends key frames plus the audio measurements to Claude, which reviews posture, fretting-hand and picking-hand technique like a teacher watching over your shoulder.'}</p>
        ${mode === 'video' && !Claude.hasKey() ? '<p class="note warn">Video review needs your Anthropic API key in Settings.</p>' : ''}
        <p class="small">${L.calibrated ? `<span class="ok">✓ Timing calibrated (${Math.round(L.sec * 1000)} ms)</span>` : '<span class="muted">Timing not calibrated yet: you can calibrate on the next screen.</span>'}</p>
        <p class="small muted">Results feed your skill levels, and prescribed exercises are added to your routines.</p>
      </section>
      ${groups.map(g => `<section class="card"><h3>${esc(g)}</h3>${list.filter(x => x.group === g).slice(0, g === 'Library' ? 8 : 6).map(x => `
        <button class="evpick" data-k="${esc(x.key)}"><span><b>${esc(x.ex.name)}</b><span class="small muted">${esc(x.note || '')}</span></span><span class="chev">›</span></button>`).join('')}</section>`).join('')}
      ${recent.length ? `<section class="card"><h3>Recent evaluations</h3>${recent.map(e => `<a class="evhist" href="#/evaluate/view-${e.id}"><span class="score ${e.clean ? 'ok' : ''}">${e.score ?? '—'}</span><span><b>${esc(e.name)}</b><span class="small muted">${e.date} · ${e.type === 'video' ? 'video' : 'audio'} · ${e.bpm} BPM</span></span><span class="chev">›</span></a>`).join('')}</section>` : ''}`;
  }
  const onClick = e => {
    const m = e.target.closest('[data-m]'); if (m) { mode = m.dataset.m; return render(); }
    const b = e.target.closest('[data-k]'); if (!b) return;
    try { sessionStorage.setItem(PICK_KEY, JSON.stringify({ key: b.dataset.k, mode })); } catch { /* ignore */ }
    navigate('#/evaluate/run');
  };
  root.addEventListener('click', onClick);
  render();
  return () => root.removeEventListener('click', onClick);
}

function viewPast(root, p, id) {
  const e = p.evaluations.find(x => x.id === id);
  if (!e) { root.innerHTML = '<p>Not found.</p><a class="link" href="#/evaluate">← Evaluate</a>'; return () => {}; }
  const fb = e.feedback;
  root.innerHTML = `<a class="link" href="#/evaluate">← Evaluate</a>
    <section class="card"><div class="label">${e.date} · ${e.type} · ${e.bpm} BPM</div><h2>${esc(e.name)}</h2>
      <p><b>Score ${e.score ?? '—'}</b> · ${e.clean ? '<span class="ok">clean</span>' : 'not clean yet'}</p><p class="small muted">${esc(e.summary || '')}</p>
      ${e.thumbs && e.thumbs.length ? `<div class="frames">${e.thumbs.map((t, i) => `<figure><img src="${t}" alt="Frame ${i + 1}"></figure>`).join('')}</div>` : ''}
      ${fb ? `<p>${esc(fb.summary)}</p>${fb.issues.map(i => `<div class="issue ${i.severity}"><b>${esc(i.title)}</b><div class="small">${esc(i.detail)}</div>${i.fix ? `<div class="small fix">→ ${esc(i.fix)}</div>` : ''}</div>`).join('')}` : ''}
    </section>`;
  return () => {};
}
