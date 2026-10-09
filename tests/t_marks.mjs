// Tab marks: whammy-bar moves and written pick strokes / fingers (drawn, kept by the normalizer, heard).
import { Audio } from '../js/core/audio.js';
import { mountTabPlayer, barLabel, pitchMoves } from '../js/tools/tabplayer.js';
import { computePicks } from '../js/tools/picking.js';
import { normalizeExercise, toPlayerExercise } from '../js/core/coursegen.js';

const ok = window.__ok;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ctx = { currentTime: 10, state: 'running' };
const glides = [];
Audio.ctx = ctx; Audio.get = () => ctx; Audio.click = () => {}; Audio.strum = () => {};
Audio.guitar = (m, t) => { const src = { m, t, detune: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} } }; return src; };
const realGlide = Audio.glide.bind(Audio);
Audio.glide = (src, pts) => { glides.push({ m: src.m, pts }); realGlide(src, pts); };

(async () => {
  // ---- labels and pitch curves
  ok(barLabel({ bar: 'dip' }) === 'dip −1', 'dip label: ' + barLabel({ bar: 'dip' }));
  ok(barLabel({ bar: 'dive', barDepth: 12 }) === 'dive −12', 'dive label');
  ok(barLabel({ bar: 'dip', barDepth: 0.5 }) === 'dip −½', 'half-step dip: ' + barLabel({ bar: 'dip', barDepth: 0.5 }));
  ok(barLabel({ bar: 'scoop', barDepth: 1.5 }) === 'scoop 1½', 'scoop label: ' + barLabel({ bar: 'scoop', barDepth: 1.5 }));
  ok(barLabel({ bar: 'vib' }) === 'w/bar ~' && barLabel({ bar: 'flutter' }) === 'flutter' && barLabel({}) === '', 'vibrato, flutter, none');
  const dip = pitchMoves({ bar: 'dip', barDepth: 1 }, 1);
  ok(Math.min(...dip.map(p => p[1])) === -100 && dip[dip.length - 1][1] === 0, 'a dip goes down a semitone and back');
  const scoop = pitchMoves({ bar: 'scoop', barDepth: 2 }, 1);
  ok(scoop[0][1] === -200 && scoop[scoop.length - 1][1] === 0, 'a scoop starts two semitones below and rises');
  const dive = pitchMoves({ bar: 'dive', barDepth: 12 }, 2);
  ok(dive[dive.length - 1][1] === -1200, 'a dive sinks an octave');
  const vib = pitchMoves({ bar: 'vib', barDepth: 0.5 }, 1);
  ok(vib.length > 6 && Math.max(...vib.map(p => p[1])) === 25 && Math.min(...vib.map(p => p[1])) === -25, 'bar vibrato swings ±¼ step');
  ok(pitchMoves({ bar: 'flutter' }, 1).length > pitchMoves({ bar: 'vib' }, 1).length, 'flutter is faster than vibrato');
  const bend = pitchMoves({ x: 'b', f: 7, bendTo: 9 }, 1);
  ok(bend[0][1] === 0 && bend[bend.length - 1][1] === 200, 'a bend glides up a whole step');
  const rel = pitchMoves({ x: 'r', f: 7, bendTo: 9 }, 1);
  ok(rel[0][1] === 200 && rel[rel.length - 1][1] === 0, 'a release glides back down');
  const bendDip = pitchMoves({ x: 'b', f: 7, bendTo: 9, bar: 'dip' }, 1);
  ok(bendDip.some(p => p[1] === 100) && bendDip[bendDip.length - 1][1] === 200, 'a bend with a bar dip dips from the bent pitch');

  // ---- written picks and fingers
  const notes = [
    { t: 0, d: 0.25, s: 3, f: 5 }, { t: 0.25, d: 0.25, s: 3, f: 7, pick: 'u' }, { t: 0.5, d: 0.25, s: 2, f: 5 },
    { t: 0.75, d: 0.25, s: 1, f: 5, fing: 'm' }, { t: 1, d: 1, s: 4, f: 7 }, { t: 1, d: 1, s: 3, f: 7, pick: 'u', chord: true }
  ];
  const auto = computePicks(notes.map(({ pick, fing, ...n }) => n), 'strict');
  const w = computePicks(notes, 'strict');
  ok(auto[1].stroke === 'u' && w[1].stroke === 'u' && w[1].written, 'a written stroke is kept');
  ok(w[3].finger === 'm' && !w[3].stroke && w[3].lead, 'a written finger replaces the stroke');
  ok(w[5].stroke === 'u' && w[5].lead && !w[4].lead && !w[4].stroke, 'in a chord, the written stroke carries the symbol');
  const wf = computePicks(notes, 'fingers');
  ok(wf[1].stroke === 'u' && wf[3].finger === 'm', 'written marks win in every mode (fingers)');
  const wd = computePicks([{ t: 0, d: 1, s: 6, f: 0, pick: 'u' }, { t: 1, d: 1, s: 6, f: 0 }], 'down');
  ok(wd[0].stroke === 'u' && wd[1].stroke === 'd', 'written upstroke inside all-downstrokes');

  // ---- the normalizer keeps the marks; bad values are dropped
  const raw = { id: 'marks', name: 'Marks', domain: 'fretting', why: 'w', instr: 'i', watch: 'w', simplify: 's', unit: '8ths', startBpm: 60, goalBpm: 90,
    tab: { notes: [{ t: 0, d: 1, s: 3, f: 12, x: 'nh', bar: 'dive', barDepth: 12 }, { t: 1, d: 1, s: 2, f: 8, bar: 'dip' }, { t: 2, d: 1, s: 1, f: 5, pick: 'u', fing: 'a' }, { t: 3, d: 1, s: 1, f: 5, bar: 'wobble', pick: 'x', fing: 'z' }] } };
  const n = normalizeExercise(raw);
  const tn = n.tab.notes;
  ok(tn[0].bar === 'dive' && tn[0].barDepth === 12 && tn[0].x === 'nh', 'normalizer keeps a dive on a harmonic');
  ok(tn[1].bar === 'dip' && tn[1].barDepth == null, 'a dip without depth (uses the default)');
  ok(tn[2].pick === 'u' && tn[2].fing === 'a', 'pick and finger kept');
  ok(!tn[3].bar && !tn[3].pick && !tn[3].fing, 'unknown values dropped');

  // ---- the player draws and plays them
  const el = document.createElement('div'); document.body.appendChild(el);
  const px = toPlayerExercise(n, 80);
  const stop = mountTabPlayer(el, px, { settings: {}, startBpm: 80 });
  const techs = [...el.querySelectorAll('.tab-tech')].map(t => t.textContent);
  ok(techs.includes('NH dive −12') && techs.includes('dip −1'), 'tab shows the bar marks: ' + techs.join(' | '));
  ok(el.querySelector('.tab-tech.bar'), 'bar marks are coloured');
  ok([...el.querySelectorAll('.tab-finger')].some(f => f.textContent === 'a') && el.querySelector('.tab-pick'), 'the written finger and stroke are drawn');
  ok(/marked by the lesson/.test(el.querySelector('[data-r="pickhint"]').textContent), 'the picking hint says marks are written');
  el.querySelector('[data-r="play"]').click();
  for (let k = 0; k < 90; k++) { ctx.currentTime += 0.08; await sleep(28); }
  ok(glides.some(g => g.pts.some(p => p[1] === -1200)) && glides.some(g => g.pts.some(p => p[1] === -100)), `the player bends the pitch with the bar (${glides.length} glides)`);
  stop();
  window.__finish();
})().catch(e => { console.log('TEST ERROR', e && e.stack || e); window.__finish(); });
