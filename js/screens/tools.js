// Tools hub: tuner, metronome, trainers (note finder and intervals), the chord glossary and the
// scales glossary. (The old Tabs list moved to the Practice library, where every exercise has variations.)
import { esc, toast, today } from '../core/util.js';
import { Store } from '../core/store.js';
import { mountTuner } from '../tools/tuner.js';
import { Metronome, mountMetronome } from '../tools/metronome.js';
import { mountChordGlossary } from './chords.js';
import { mountScalesGlossary } from './scales.js';
import { mountNoteFinder } from './notefinder.js';
import { mountIntervalTrainer } from './intervals.js';
import { libEntry } from '../core/library.js';

export function bestTempo(profile, exId) {
  return profile.exerciseLog.filter(l => l.exerciseId === exId).reduce((m, l) => Math.max(m, l.tempo), 0);
}

export const TOOL_TABS = [['tuner', 'Tuner'], ['metronome', 'Metronome'], ['trainers', 'Trainers'], ['chords', 'Chords'], ['scales', 'Scales'], ['evaluate', 'Evaluate']];
const TRAINERS = [['notes', 'Note finder', 'Learn every note on the neck'], ['intervals', 'Intervals', 'Find any interval by ear and on the neck']];

export function mountTools(root, { tab = 'tuner', exerciseId = null, navigate }) {
  const p = Store.profile;
  let cleanup = null;
  const saveSettings = patch => { Object.assign(p.settings, patch); Store.save(); };
  if (tab === 'tabs') tab = 'trainers';

  function render() {
    if (cleanup) { cleanup(); cleanup = null; }
    root.innerHTML = `
      <h1>Tools</h1>
      <div class="segtabs six">${TOOL_TABS.map(([k, l]) => `<a href="${k === 'evaluate' ? '#/evaluate' : '#/tools/' + k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</div>
      <div data-r="pane"></div>`;
    const pane = root.querySelector('[data-r="pane"]');
    if (tab === 'tuner') cleanup = mountTuner(pane, p.settings, saveSettings);
    else if (tab === 'chords') cleanup = mountChordGlossary(pane, { initial: exerciseId });
    else if (tab === 'scales') cleanup = mountScalesGlossary(pane);
    else if (tab === 'trainers') {
      const which = TRAINERS.some(t => t[0] === exerciseId) ? exerciseId : 'notes';
      pane.innerHTML = `<div class="trainer-pick">${TRAINERS.map(([k, l, d]) => `<a class="trainer-tab ${which === k ? 'on' : ''}" href="#/tools/trainers/${k}"><b>${l}</b><span class="small muted">${d}</span></a>`).join('')}</div><div data-r="tr"></div>`;
      const host = pane.querySelector('[data-r="tr"]');
      cleanup = which === 'intervals' ? mountIntervalTrainer(host, { navigate, entry: libEntry(p, 'interval-trainer'), embedded: true }) : mountNoteFinder(host);
    } else if (tab === 'metronome') {
      Metronome.configure({ mode: Metronome.mode, backing: null, beatsPerBar: Metronome.beatsPerBar, subdiv: Metronome.subdiv });
      pane.innerHTML = '<section class="card"><div data-r="m"></div></section><p class="muted small">Tip: “Gap” mode drops the click for 2 bars so you can check your internal time.</p>';
      const off = mountMetronome(pane.querySelector('[data-r="m"]'));
      cleanup = () => { off(); Metronome.stop(); };
    }
  }
  render();
  return () => { if (cleanup) cleanup(); };
}
