// Tools hub: tuner, metronome, the tab player with the exercise library, and the chord glossary.
import { esc, toast, today } from '../core/util.js';
import { Store } from '../core/store.js';
import { mountTuner } from '../tools/tuner.js';
import { Metronome, mountMetronome } from '../tools/metronome.js';
import { mountTabPlayer } from '../tools/tabplayer.js';
import { EXERCISES, EXERCISE_BY_ID } from '../tools/exercises.js';
import { addEvidence, recomputeLevels, describeChanges } from '../core/skills.js';
import { mountChordGlossary } from './chords.js';

export function bestTempo(profile, exId) {
  return profile.exerciseLog.filter(l => l.exerciseId === exId).reduce((m, l) => Math.max(m, l.tempo), 0);
}

export function mountTools(root, { tab = 'tuner', exerciseId = null, navigate }) {
  const p = Store.profile;
  let cleanup = null;
  const saveSettings = patch => { Object.assign(p.settings, patch); Store.save(); };

  function render() {
    if (cleanup) { cleanup(); cleanup = null; }
    root.innerHTML = `
      <h1>Tools</h1>
      <div class="segtabs five">${[['tuner', 'Tuner'], ['metronome', 'Metronome'], ['tabs', 'Tabs'], ['chords', 'Chords'], ['evaluate', 'Evaluate']].map(([k, l]) => `<a href="${k === 'evaluate' ? '#/evaluate' : '#/tools/' + k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</div>
      <div data-r="pane"></div>`;
    const pane = root.querySelector('[data-r="pane"]');
    if (tab === 'tuner') cleanup = mountTuner(pane, p.settings, saveSettings);
    else if (tab === 'chords') cleanup = mountChordGlossary(pane, { initial: exerciseId });
    else if (tab === 'metronome') {
      Metronome.configure({ mode: Metronome.mode, backing: null, beatsPerBar: Metronome.beatsPerBar, subdiv: Metronome.subdiv });
      pane.innerHTML = '<section class="card"><div data-r="m"></div></section><p class="muted small">Tip: “Gap” mode drops the click for 2 bars so you can check your internal time.</p>';
      const off = mountMetronome(pane.querySelector('[data-r="m"]'));
      cleanup = () => { off(); Metronome.stop(); };
    } else if (exerciseId && EXERCISE_BY_ID[exerciseId]) {
      const ex = EXERCISE_BY_ID[exerciseId];
      pane.innerHTML = `<a class="link" href="#/tools/tabs">← All exercises</a><section class="card"><div data-r="tp"></div></section><div data-r="hist"></div>`;
      cleanup = mountTabPlayer(pane.querySelector('[data-r="tp"]'), ex, {
        settings: p.settings, onSettings: saveSettings,
        ramp: { enabled: false, step: ex.bpm < 80 ? 3 : ex.bpm < 140 ? 4 : 5, everyLoops: 2, max: ex.goalBpm },
        onLog: ({ tempo, goalBpm }) => {
          const mastered = !!goalBpm && tempo >= goalBpm;
          p.exerciseLog.push({ date: today(), at: Date.now(), exerciseId: ex.id, name: ex.name, tempo, goalBpm, mastered, source: 'tools' });
          addEvidence(p, { key: 'lib:' + ex.id, domain: ex.domain, label: ex.name, level: ex.level, tempo, goal: goalBpm, clean: true, source: 'tools' });
          const ch = recomputeLevels(p);
          Store.save(); drawHist();
          toast((mastered ? `Logged ${tempo} BPM. Goal reached: mastered! 🎸` : `Logged ${tempo} BPM. ${goalBpm ? Math.max(0, goalBpm - tempo) + ' BPM to the goal.' : ''}`) + (ch.length ? ` Level up: ${describeChanges(ch)}.` : ''), 4000);
        }
      });
      const drawHist = () => {
        const logs = p.exerciseLog.filter(l => l.exerciseId === ex.id).slice(-8).reverse();
        pane.querySelector('[data-r="hist"]').innerHTML = logs.length ? `<section class="card"><h3>Tempo log</h3>${logs.map(l => `<div class="logrow"><span>${l.date}</span><b>${l.tempo} BPM</b><span class="${l.mastered ? 'ok' : 'muted'}">${l.mastered ? 'Mastered' : l.goalBpm ? `goal ${l.goalBpm}` : ''}</span></div>`).join('')}</section>` : '';
      };
      drawHist();
    } else {
      pane.innerHTML = `<section class="card nudge"><div><b>More in the Practice library</b><div class="small muted">54 exercises, each with variations from easier to harder (the spider alone has 15 finger orders, positions and rhythms). These open there too.</div></div><a class="btn sm primary" href="#/practice">Open</a></section>
        <p class="muted">Every exercise has a goal tempo. Log the highest tempo you play cleanly; reaching the goal marks it mastered and counts toward your skill levels.</p>
        ${EXERCISES.map(ex => { const best = bestTempo(p, ex.id), pct = Math.min(100, Math.round(best / ex.goalBpm * 100)); return `
        <a class="exrow card" href="#/tools/tabs/${ex.id}">
          <div><b>${esc(ex.name)}</b><div class="muted small">${esc(ex.tags.join(' · '))} · level ${ex.level}</div>
          <div class="cprog"><div class="bar"><i style="width:${pct}%"></i></div><span>${best ? best + ' / ' : ''}${ex.goalBpm} BPM</span></div></div>
          ${best >= ex.goalBpm ? '<span class="badge ok">Mastered</span>' : '<span class="chev">›</span>'}
        </a>`; }).join('')}`;
    }
  }
  render();
  return () => { if (cleanup) cleanup(); };
}
