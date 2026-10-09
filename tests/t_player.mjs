// Tests: tempo labels, chord timelines, the tab player (pause/restart, seek,
// select + loop, neck, chord boxes), metronome backing highlights, the spider's
// horizontal movement, fleshed-out drills, layouts.
import { Audio } from '../js/core/audio.js';
import { beatLabel, tempoPhrase } from '../js/core/tempo.js';
import { chordTimeline, chordAt } from '../js/ui/chordsync.js';
import { exerciseDiagramsHTML, diagramList } from '../js/ui/fretboard.js';
import { mountTabPlayer } from '../js/tools/tabplayer.js';
import { Metronome, mountMetronome } from '../js/tools/metronome.js';
import { runAtom } from '../js/core/styles.js';
import { normalizeExercise, toPlayerExercise } from '../js/core/coursegen.js';
import { libraryEntries, libEntry, libVariations, instanceOf } from '../js/core/library.js';
import { paramDims } from '../js/core/params.js';
import { drillLibrary } from '../js/core/drills.js';
import { EXERCISE_BY_ID } from '../js/tools/exercises.js';
import { tempoRowHTML, tempoShort } from '../js/ui/temporow.js';

const ok = window.__ok;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- fake audio clock ----------
const log = { notes: [], clicks: [], strums: [] };
const ctx = { currentTime: 10, state: 'running' };
Audio.ctx = ctx;
Audio.guitar = (m, t, o) => log.notes.push({ m, t });
Audio.click = (t, acc) => log.clicks.push({ t, acc });
Audio.strum = (ms, t) => log.strums.push({ ms, t });
const reset = () => { log.notes.length = 0; log.clicks.length = 0; log.strums.length = 0; };
async function advance(sec, step = 0.05) { const end = ctx.currentTime + sec; while (ctx.currentTime < end - 1e-9) { ctx.currentTime = Math.min(end, ctx.currentTime + step); await sleep(28); } }

const C = (key, minor, lvl, prog) => ({ key, minor, lvl, genre: null, prog: prog || (minor ? 'minorRock' : 'axis') });
const ex = (atom, opts, c = C(7, false, 5)) => normalizeExercise(runAtom(c, atom, opts));

(async () => {
  /* ------------------------------ tempo labels ------------------------------ */
  ok(beatLabel({ unit: '8ths' }) === '8th notes', 'unit 8ths');
  ok(beatLabel({ unit: '16ths' }) === '16th notes', 'unit 16ths');
  ok(beatLabel({ unit: 'triplets' }) === '8th-note triplets', 'unit triplets');
  ok(beatLabel({ unit: 'swung 8ths' }) === 'swung 8th notes', 'swung');
  ok(beatLabel({ unit: '8ths', tab: { swing: true, notes: [] } }) === 'swung 8th notes', 'swing flag');
  ok(beatLabel({ unit: 'one note per beat' }) === 'quarter notes', 'per beat');
  ok(beatLabel({ unit: '8th + two 16ths' }) === '8th + two 16ths', 'mixed rhythm kept: ' + beatLabel({ unit: '8th + two 16ths' }));
  ok(beatLabel({ unit: '2 beats per chord', tab: { notes: [0, 1, 2, 3].map(t => ({ t, d: 1, s: 2, f: 1 })) } }) === 'quarter notes', 'from tab gaps');
  ok(beatLabel({ unit: 'phrases' }) === 'quarter-note click', 'no rhythm');
  ok(beatLabel({ unit: '8th-note pulse, 7/8 (one click = one 8th)' }) === '8th-note pulse', 'odd meter pulse');
  ok(tempoPhrase({ unit: '8ths' }, 130) === '8th notes at 130 BPM', 'phrase');
  const row = tempoRowHTML({ unit: '16ths', goalBpm: 120 }, 80);
  ok(/16th notes/.test(row) && /80/.test(row) && /120/.test(row), 'tempo row has label and numbers');
  ok(tempoShort({ unit: '8ths' }, 60, 100) === '8th notes · 60 → 100 BPM', 'tempo short');
  // every library exercise gets a label
  const prof = { domains: { fretting: { level: 5 }, picking: { level: 5 }, rhythm: { level: 4 }, fretboard: { level: 6 }, theory: { level: 5 }, ear: { level: 4 } }, varState: {}, settings: {} };
  const ents = libraryEntries(prof).filter(e => !e.special);
  ok(ents.every(e => typeof beatLabel(e.ex) === 'string' && beatLabel(e.ex).length > 3), 'labels for all library entries');

  /* ------------------------------ chord timelines ------------------------------ */
  const strum = ex('strumPattern', { chords: ['G', 'C', 'D', 'Em'], pattern: 'pop' });
  const tl = chordTimeline(strum, strum.tab.notes);
  ok(tl && tl.map(x => x.i).join() === '0,1,2,3' && tl.map(x => x.t).join() === '0,4,8,12', 'strum timeline: ' + JSON.stringify(tl));
  ok(chordAt(tl, 5.5) === 1 && chordAt(tl, 12) === 3 && chordAt(tl, 0) === 0, 'chordAt');
  const cc = ex('chordChanges', { chords: ['G', 'C', 'D'], beats: 2 });
  const tl2 = chordTimeline(cc, cc.tab.notes);
  ok(tl2 && tl2.map(x => x.i).join() === '0,1,2,0,1,2' && tl2[1].t === 2, 'changes timeline: ' + JSON.stringify(tl2));
  const travis = ex('travisPattern', { chords: ['C', 'Am', 'F', 'G'] }, C(0, false, 5));
  const tl3 = chordTimeline(travis, travis.tab.notes);
  ok(tl3 && tl3.map(x => x.i).join() === '0,1,2,3', 'arpeggio timeline: ' + JSON.stringify(tl3));
  const triArp = ex('triadProgression', { chords: ['G', 'D', 'Em', 'C'], set: [2, 3, 4], arpeggio: true });
  const tl4 = chordTimeline(triArp, triArp.tab.notes);
  ok(tl4 && tl4.map(x => x.t).join() === '0,4,8,12', 'triad arpeggio timeline: ' + JSON.stringify(tl4));
  const gt = ex('guideTones', { chords: ['Dm7', 'G7', 'Cmaj7', 'Cmaj7'] }, C(0, false, 5, 'iiVI'));
  const tl5 = chordTimeline(gt, gt.tab.notes);
  ok(tl5 && tl5[0].i === 0 && tl5.some(x => x.i === 1 && x.t === 4) && tl5.some(x => x.i === 2 && x.t === 8), 'guide tones follow changes: ' + JSON.stringify(tl5));
  ok(chordTimeline({ name: 'x' }, strum.tab.notes) === null, 'no chord boxes → null');
  // backing-only exercises get boxes (not ear training)
  ok(diagramList({ backing: ['A7', 'D7', 'A7', 'E7'], domain: 'rhythm' }).list.length === 3, 'backing boxes deduped');
  ok(diagramList({ backing: ['G', 'C'], domain: 'ear' }).list.length === 0, 'no boxes for ear training');
  const dh = exerciseDiagramsHTML(strum);
  ok(/data-sync/.test(dh) && /data-di="3"/.test(dh) && /data-name="Em"/.test(dh), 'diagram attributes');

  /* ------------------------------ tab player ------------------------------ */
  const host = document.createElement('section'); host.className = 'card';
  document.getElementById('view').appendChild(host);
  host.innerHTML = exerciseDiagramsHTML(strum) + '<div data-r="tool"></div>';
  const px = toPlayerExercise(strum, 60);
  ok(px.voicings && px.voicings.length === 4 && px.domain === 'rhythm', 'player exercise carries chord boxes');
  let tool = mountTabPlayer(host.querySelector('[data-r="tool"]'), px, { settings: {}, startBpm: 60, compact: true });
  const q = s => host.querySelector(s);
  ok(q('[data-r="restart"]') && q('[data-r="play"]').textContent.includes('Play'), 'transport buttons');
  ok(q('.tpneck svg.tpboard') && host.querySelectorAll('.tpneck .fb-mark').length >= 8, 'neck under the tab');
  ok(/8th notes/.test(q('.tp-tempo .bpm span').textContent), 'BPM box says 8th notes');
  ok(q('.tp-ruler') && host.querySelectorAll('.tp-rbar').length === 4, 'bar strip with 4 bars');
  // play with count-in: 4 clicks before the first note, which is 4 beats (4 s at 60) after start
  reset(); ctx.currentTime = 10;
  q('[data-r="play"]').click();
  ok(tool.isPlaying() && q('[data-r="play"]').textContent.includes('Pause'), 'playing; shows Pause');
  await advance(1.2);
  const t0 = tool.timing().t0;
  ok(Math.abs(t0 - (10 + 0.1 + 4)) < 1e-6, 'count-in lead of one bar: t0=' + t0);
  ok(log.clicks.filter(c => c.t < t0 - 1e-6).length >= 1, 'count-in clicks');
  await advance(4.5);
  const firstNotes = log.notes.filter(n => Math.abs(n.t - t0) < 0.08);
  ok(firstNotes.length === 6, 'G chord strummed on beat 1: ' + firstNotes.length);
  ok(host.querySelector('.cdiag.playing[data-di="0"]'), 'G box lit while G plays');
  await advance(4.2); // now in bar 2 (C)
  ok(host.querySelector('.cdiag.playing[data-di="1"]'), 'C box lit in bar 2');
  ok(host.querySelectorAll('.tpneck .fb-mark.on').length >= 3, 'neck lights the sounding notes');
  // pause keeps the place
  tool.pause();
  const st = tool.state();
  ok(!st.playing && st.pos > 4 && st.pos < 6, 'paused mid-bar-2: ' + st.pos);
  ok(q('[data-r="play"]').textContent.includes('Resume'), 'button says Resume');
  // resume (count-in on) starts from the paused spot
  reset(); q('[data-r="play"]').click();
  await advance(0.3);
  const tm = tool.timing();
  const P = st.pos, lead = P - (Math.ceil(P) - 4);
  ok(Math.abs(tm.t0 - (ctx.currentTime - 0.3 + 0.1 + lead)) < 0.06, 'resume lead matches count-in from the paused spot');
  await advance(lead + 0.6);
  const resumed = log.notes.filter(n => n.t > tm.t0 - 0.01);
  ok(resumed.length > 0 && resumed.every(n => n.t >= tm.t0 - 0.02), 'resumed from the paused spot, not the start');
  // restart while playing jumps back to the start
  tool.restart(); await advance(0.1);
  ok(tool.state().pos === 0 && Math.abs(tool.timing().t0 - (ctx.currentTime - 0.1 + 0.1)) < 0.06, 'restart while playing restarts at beat 0');
  tool.pause();
  // seek: snap to the nearest note
  tool.seek(6.1);
  ok(Math.abs(tool.state().pos - 6) < 1e-6, 'seek near a beat snaps to the beat: ' + tool.state().pos);
  tool.seek(6.42);
  ok(Math.abs(tool.state().pos - 6.5) < 1e-6, 'seek near a note snaps to the note: ' + tool.state().pos);
  ok(host.querySelector('.cdiag.playing[data-di="1"]'), 'chord box follows the playhead when paused');
  ok(host.querySelectorAll('.tab-note.on').length >= 1, 'notes at the playhead light up');
  // select bar 3 (beats 8..11.9) → loops beats 8–12
  ok(tool.select(8, 11.6), 'select');
  const s2 = tool.state();
  ok(s2.sel && s2.sel.a === 8 && s2.sel.b === 12 && s2.loop, 'selection = bar 3, loop on: ' + JSON.stringify(s2.sel));
  ok(host.querySelectorAll('.tab-note.insel').length > 0 && !q('[data-r="selbar"]').hidden && !q('[data-r="rsel"]').hidden, 'selection highlighted');
  ok(/Loop:/.test(q('[data-r="seltxt"]').textContent), 'selection text');
  ok(host.querySelectorAll('.tpneck .fb-mark.out').length > 0, 'neck fades positions outside the selection');
  // play the selection: notes only from beats 8..12, looping
  reset(); tool.set('countIn', false); q('[data-r="play"]').click();
  await advance(9);
  const t0s = tool.timing().t0;
  const rel = log.notes.map(n => n.t - t0s).filter(x => x > -0.01);
  ok(rel.length > 0 && rel.every(x => (x % 4) < 3.6), 'only the selected bar plays');
  ok(log.notes.some(n => Math.abs(n.t - t0s - 4) < 0.05) && log.notes.some(n => Math.abs(n.t - t0s - 8) < 0.05), 'selection loops every bar');
  ok(host.querySelector('.cdiag.playing[data-di="2"]'), 'D box lit while looping bar 3');
  // clear the loop while playing: keeps going from where it is
  q('[data-r="clearsel"]').click();
  ok(!tool.state().sel && tool.isPlaying(), 'clear loop keeps playing');
  tool.pause();
  // seeking outside a selection clears it
  tool.select(0, 3); tool.seek(13);
  ok(!tool.state().sel, 'seek outside the selection clears it');
  // loop off: finishes at the end
  tool.restart(); tool.set('loop', false); reset(); q('[data-r="play"]').click();
  await advance(17.5);
  ok(!tool.isPlaying() && tool.state().pos === 0, 'stops at the end without loop');
  tool(); // cleanup
  ok(!host.querySelector('.cdiag.playing'), 'cleanup clears chord highlight');

  // tempo ladder still steps at loop boundaries
  const small = { id: 'x', name: 'x', notes: [0, 1, 2, 3].map(t => ({ t, d: 1, s: 1, f: 0 })), goalBpm: 120, unit: 'quarters' };
  const h2 = document.createElement('div'); document.body.appendChild(h2);
  let bumped = [];
  tool = mountTabPlayer(h2, small, { settings: {}, startBpm: 60, compact: true, ramp: { step: 10, max: 80, everyLoops: 1 }, onBpm: v => bumped.push(v) });
  tool.set('countIn', false); reset(); ctx.currentTime = 100; tool.play();
  await advance(9);
  ok(tool.getBpm() === 80 && bumped.includes(70), 'tempo ladder: ' + tool.getBpm() + ' ' + bumped.join());
  tool();

  // eval mode: always from beat 0, loops, t0 = beat 0
  tool = mountTabPlayer(h2, small, { settings: {}, startBpm: 60, compact: true, evalMode: true });
  ctx.currentTime = 200; tool.play();
  const te = tool.timing();
  ok(Math.abs(te.t0 - (200 + 0.1 + 4)) < 1e-6 && te.totalBeats === 4 && te.notes.length === 4, 'eval timing unchanged');
  ok(h2.querySelector('.tp-transport').hidden && h2.querySelector('.tpneck').hidden, 'eval hides transport and neck');
  tool();

  // swing still lands the "&" two-thirds through the beat
  const sh = ex('shuffleRiff', {}, C(9, false, 5));
  const pxs = toPlayerExercise(sh, 60);
  tool = mountTabPlayer(h2, pxs, { settings: {}, startBpm: 60, compact: true });
  tool.set('countIn', false); reset(); ctx.currentTime = 300; tool.play();
  await advance(1.5);
  const ts0 = tool.timing().t0;
  ok(log.notes.some(n => Math.abs(n.t - ts0 - 2 / 3) < 0.03), 'swung 8th at 2/3 of the beat');
  tool();

  /* ------------------------------ metronome backing ------------------------------ */
  const mh = document.createElement('section'); mh.className = 'card';
  mh.innerHTML = exerciseDiagramsHTML({ chords: ['Am', 'G'], domain: 'improv' }) + '<div data-r="m"></div>';
  document.body.appendChild(mh);
  Metronome.configure({ bpm: 240, backing: ['Am', 'G'], beatsPerBar: 4 });
  const offM = mountMetronome(mh.querySelector('[data-r="m"]'), {});
  ctx.currentTime = 400; Metronome.start();
  await advance(0.3, 0.02);
  ok(mh.querySelector('.cdiag.playing[data-name="Am"]'), 'metronome lights Am in bar 1');
  await advance(1.0, 0.02);
  ok(mh.querySelector('.cdiag.playing[data-name="G"]'), 'metronome lights G in bar 2');
  ok(/G/.test(mh.querySelector('[data-r="backnow"]').textContent), 'backing shows the chord now');
  Metronome.stop(); await sleep(10);
  ok(!mh.querySelector('.cdiag.playing'), 'stop clears the highlight');
  offM();

  /* ------------------------------ spider moves horizontally ------------------------------ */
  const sp = EXERCISE_BY_ID['spider-1234'];
  const posOf = n => n.f; // fret
  const spanFrets = notes => Math.max(...notes.map(posOf)) - Math.min(...notes.map(posOf));
  ok(spanFrets(sp.notes) >= 7, 'spider climbs the neck (fret span ' + spanFrets(sp.notes) + ')');
  ok(new Set(sp.notes.map(n => n.s)).size === 6, 'spider crosses all strings');
  // it returns to where it started, so the loop joins up
  ok(sp.notes[0].f === 1 && sp.notes[sp.notes.length - 1].f === 2 && sp.notes[sp.notes.length - 1].s === 6, 'loop joins');
  const spEntry = libEntry(prof, 'spider');
  const spv = libVariations(prof, spEntry);
  const moving = spv.filter(v => v.ex.tab && spanFrets(v.ex.tab.notes) >= 6);
  ok(moving.length >= spv.length - 3, `most spider variations move along the neck (${moving.length}/${spv.length})`);
  ok(spv.some(v => v.vid === 'horiz') && spv.some(v => v.vid === 'pos1'), 'along-the-string and one-position variations');
  const horiz = spv.find(v => v.vid === 'horiz');
  ok(spanFrets(horiz.ex.tab.notes) === 11 && horiz.ex.tab.notes.slice(0, 12).every(n => n.s === 6), 'along each string: frets 1–12 on one string');

  /* ------------------------------ drills fleshed out ------------------------------ */
  const D = drillLibrary(5);
  for (const k of ['bends', 'vibrato', 'gallop', 'power', 'travis', 'hybrid', 'tapping', 'burst', 'slides', 'doublestops', 'dropd']) {
    const n = D[k].tab.notes, len = Math.max(...n.map(x => x.t + x.d));
    ok(len >= 16, `${k} is 4 bars (${len} beats)`);
    ok(new Set(n.map(x => x.f)).size >= 4, `${k} moves (${new Set(n.map(x => x.f)).size} frets)`);
  }
  // every library entry and variation builds; key changes still work on the wider drills
  let built = 0, bad = [];
  for (const e of ents) { try { const list = libVariations(prof, e); built += list.length; if (!list.length) bad.push(e.id); } catch (err) { bad.push(e.id + ':' + err.message); } }
  ok(!bad.length && built > 400, `variations build (${built}) ${bad.join(' ')}`);
  for (const id of ['bends', 'slides', 'tapping', 'power-shifts', 'hybrid', 'string-cross', 'gallop']) {
    const e = libEntry(prof, id), v = libVariations(prof, e).find(x => x.base);
    const dims = paramDims(v.ex), kd = dims.find(d => d.id === 'key');
    ok(kd, `${id} has a key choice`);
    if (!kd) continue;
    const fails = kd.options.filter(o => { const inst = instanceOf(v, { key: o.v }); return String(o.v) !== String(kd.value) && inst.ex.tab.notes.every((n, i) => n.f === v.ex.tab.notes[i].f); });
    ok(!fails.length, `${id}: every key moves the tab (${fails.map(f => f.v).join(',')})`);
  }

  window.__finish();
})().catch(e => { console.log('TEST ERROR', e && e.stack || e); window.__finish(); });
