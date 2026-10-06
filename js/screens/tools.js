// Tools hub: tuner, metronome, and the tab player with the exercise library.
import { esc, toast, today } from '../core/util.js';
import { Store } from '../core/store.js';
import { mountTuner } from '../tools/tuner.js';
import { Metronome, mountMetronome } from '../tools/metronome.js';
import { mountTabPlayer } from '../tools/tabplayer.js';
import { EXERCISES, EXERCISE_BY_ID } from '../tools/exercises.js';

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
      <div class="segtabs">${[['tuner', 'Tuner'], ['metronome', 'Metronome'], ['tabs', 'Tab player']].map(([k, l]) => `<a href="#/tools/${k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</div>
      <div data-r="pane"></div>`;
    const pane = root.querySelector('[data-r="pane"]');
    if (tab === 'tuner') cleanup = mountTuner(pane, p.settings, saveSettings);
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
        onLog: ({ tempo, goalBpm }) => {
          const mastered = !!goalBpm && tempo >= goalBpm;
          p.exerciseLog.push({ date: today(), at: Date.now(), exerciseId: ex.id, name: ex.name, tempo, goalBpm, mastered, source: 'tools' });
          Store.save(); drawHist();
          toast(mastered ? `Logged ${tempo} BPM. Goal reached: mastered! 🎸` : `Logged ${tempo} BPM. ${goalBpm ? goalBpm - tempo + ' BPM to the goal.' : ''}`);
        }
      });
      const drawHist = () => {
        const logs = p.exerciseLog.filter(l => l.exerciseId === ex.id).slice(-8).reverse();
        pane.querySelector('[data-r="hist"]').innerHTML = logs.length ? `<section class="card"><h3>Tempo log</h3>${logs.map(l => `<div class="logrow"><span>${l.date}</span><b>${l.tempo} BPM</b><span class="${l.mastered ? 'ok' : 'muted'}">${l.mastered ? 'Mastered' : l.goalBpm ? `goal ${l.goalBpm}` : ''}</span></div>`).join('')}</section>` : '';
      };
      drawHist();
    } else {
      pane.innerHTML = `<p class="muted">Every exercise has a goal tempo. Reach it and log it to mark the exercise mastered.</p>
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
