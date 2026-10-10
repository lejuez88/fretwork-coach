// The playback bar (ui/transport.js) on practice screens, and artist units drawn from learning paths.
import { Audio } from '../js/core/audio.js';
const ok = window.__ok;
const sleep = ms => new Promise(r => setTimeout(r, ms));
Audio.ctx = { currentTime: 5, state: 'running' }; Audio.get = () => Audio.ctx; Audio.guitar = () => {}; Audio.click = () => {}; Audio.strum = () => {};
const errors = [];
window.addEventListener('error', e => errors.push(e.message));
window.addEventListener('unhandledrejection', e => errors.push('rejection: ' + (e.reason && e.reason.stack)));
console.error = (...a) => { errors.push(a.join(' ')); };
(async () => {
  await import('../js/app.js');
  await sleep(50);
  const go = async (h, wait = 80) => { const before = errors.length; location.hash = h; window.dispatchEvent(new HashChangeEvent('hashchange')); await sleep(wait); ok(errors.length === before, `${h}: ${errors.slice(before).join(' | ')}`); };
  const view = () => document.getElementById('view');
  const bar = () => document.getElementById('transport');
  const q = s => bar() && bar().querySelector(s);
  const { Store } = await import('../js/core/store.js');
  const { Metronome } = await import('../js/tools/metronome.js');
  const p = Store.profile;

  // --- exercise page: the tab player hands its controls to the bar
  await go('#/practice/ex/spider');
  ok(bar() && bar().classList.contains('show'), 'the playback bar shows on an exercise page');
  ok(document.body.classList.contains('has-transport'), 'the page leaves room for it');
  ok(view().querySelector('.tabplayer.docked'), 'the tab player is docked');
  ok(/Chromatic spider/.test(q('.tr-status').textContent), 'the bar names what it plays');
  const bpm0 = +q('[data-tr="bpm"]').textContent;
  q('[data-tr-d="5"]').click(); await sleep(5);
  ok(+q('[data-tr="bpm"]').textContent === bpm0 + 5 && +view().querySelector('.tabplayer [data-r="bpm"]').textContent === bpm0 + 5, 'tempo +5 changes the player');
  q('[data-tr-d="-1"]').click(); await sleep(5);
  ok(+q('[data-tr="bpm"]').textContent === bpm0 + 4, 'tempo −1');
  const range = q('.tr-range'); range.value = '100'; range.dispatchEvent(new Event('input', { bubbles: true })); await sleep(5);
  ok(+q('[data-tr="bpm"]').textContent === 100, 'the slider sets the tempo');
  q('[data-tr="play"]').click(); await sleep(10);
  ok(q('[data-tr="play"]').classList.contains('pause') && /Pause/.test(view().querySelector('.tabplayer [data-r="play"]').textContent), 'play from the bar starts the player');
  q('[data-tr="play"]').click(); await sleep(10);
  ok(!q('[data-tr="play"]').classList.contains('pause'), 'and pauses it');
  // options
  if (bar().querySelector('.tr-opts').hidden) { q('[data-tr="more"]').click(); await sleep(5); }
  ok(!bar().querySelector('.tr-opts').hidden, 'more options open');
  const loopBtn = q('[data-tr-tg="loop"]');
  ok(loopBtn && q('[data-tr-tg="click"]') && q('[data-tr-tg="countIn"]') && q('[data-tr-tg="sound"]') && q('.tr-tgls [data-clicksound]'), 'click, loop, count-in, guitar sound and click sound are in the bar');
  const wasLoop = loopBtn.classList.contains('on');
  loopBtn.click(); await sleep(5);
  ok(q('[data-tr-tg="loop"]').classList.contains('on') === !wasLoop && view().querySelector('.tabplayer [data-tg="loop"]').classList.contains('on') === !wasLoop, 'the loop switch reaches the player');
  q('[data-tr-tg="loop"]').click(); await sleep(5);
  // tap tempo
  const tap = [...bar().querySelectorAll('[data-tr="tap"]')][0];
  const t0 = performance.now(); const realNow = performance.now.bind(performance); let fake = t0;
  performance.now = () => fake;
  for (let i = 0; i < 4; i++) { tap.click(); fake += 500; }
  performance.now = realNow;
  ok(+q('[data-tr="bpm"]').textContent === 120, 'tap tempo (500 ms taps → 120 BPM): ' + q('[data-tr="bpm"]').textContent);
  // space bar
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await sleep(5);
  ok(q('[data-tr="play"]').classList.contains('pause'), 'space bar plays');
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await sleep(5);

  // --- the routine runner keeps it, above the action bar
  const { Queue } = await import('../js/core/library.js');
  Queue.clear(); Queue.toggle('spider', 'base');
  await go('#/practice');
  document.querySelector('#actionbar [data-q="start"]').click(); await sleep(120);
  ok(location.hash === '#/practice/run' && bar().classList.contains('show'), 'the bar stays on the routine runner');
  ok(document.getElementById('actionbar').classList.contains('show'), 'with the action bar under it');
  localStorage.removeItem('fretworkCoach.activeRoutine');

  // --- leaving practice hides it
  await go('#/home');
  ok(!bar().classList.contains('show') && !document.body.classList.contains('has-transport'), 'no bar on Home');

  // --- a metronome exercise docks the metronome
  const { libraryEntries } = await import('../js/core/library.js');
  const metroEx = libraryEntries(p).find(e => !e.special && !e.ex.tab && !(e.ex.chords && e.ex.chords.length) && !e.ex.voicings);
  ok(metroEx, 'found a metronome-only exercise');
  if (metroEx) {
    await go('#/practice/ex/' + metroEx.id);
    ok(!view().querySelector('.metro') || view().querySelector('.metro.docked'), 'a metronome on an exercise page is docked (' + metroEx.id + ')');
    if (view().querySelector('.metro.docked')) {
      ok(/Metronome/.test(q('.tr-status').textContent), 'metronome exercise: the bar controls the metronome');
      q('[data-tr="play"]').click(); await sleep(5);
      ok(Metronome.running, 'play starts the metronome');
      q('[data-tr-d="1"]').click(); await sleep(5);
      ok(+q('[data-tr="bpm"]').textContent === Metronome.bpm, 'tempo follows the metronome');
      q('[data-tr="play"]').click(); await sleep(5);
      ok(!Metronome.running, 'and stops it');
    }
  }
  // --- the Tools metronome isn't docked (it's the tool itself)
  await go('#/tools/metronome');
  ok(!bar().classList.contains('show'), 'no bar on the Tools metronome');

  // --- artist units drawn from a learning path
  const lib = await import('../js/data/lib.js');
  const pent = (await import('../js/data/kb/pentatonic.js')).default;
  const master = await import('../js/core/master.js');
  const u = lib.PU(pent, { title: 'Pentatonic', tiers: ['foundations', 'intermediate', 'advanced'] });
  ok(u.path === 'pentatonic' && u.tiers.length === 3 && u.skills.length > 6, 'PU keeps the path id, its stages and its skills');
  const r1 = await master.pathUnitLessons(p, u);
  ok(r1.lessons.length >= 6 && r1.lessons.every(l => l.key.startsWith('kb:pentatonic:')), 'path unit lessons use the path’s own keys (shared progress)');
  ok(u.tiers.includes(r1.unit.tier) && r1.unit.reason, `the unit is on a stage with a reason (${r1.unit.tier}: ${r1.unit.reason})`);
  // master the whole stage: the unit moves on to the next stage
  const keep = JSON.stringify(p.varState || {});
  const all = await master.stageLessonList(p, 'pentatonic', { tier: r1.unit.tier, lvl: pent.stages.find(s => s.tier === r1.unit.tier).levels[0] });
  all.forEach(l => { p.varState[`${l.key}~base`] = { mastered: true, history: [{ date: '2026-10-01', tempo: 100, clean: true }] }; });
  const r2 = await master.pathUnitLessons(p, u);
  const order = ['foundations', 'intermediate', 'advanced', 'mastery'];
  ok(order.indexOf(r2.unit.tier) > order.indexOf(r1.unit.tier) || r1.unit.tier === 'advanced', `mastering a stage moves the artist unit on (${r1.unit.tier} → ${r2.unit.tier})`);
  p.varState = JSON.parse(keep);
  const units = await master.expandArtistUnits([u, lib.U('Other', 'x', [])], 5);
  ok(units.length === 3 && /Intermediate/.test(units[0].title) && /Advanced/.test(units[1].title) && units[0].lvl === 5 && units[1].lvl === 7, 'a master class climbs the path: the stage at its level and the next (' + units.map(x => x.title).join(' | ') + ')');
  ok(errors.length === 0, 'no errors: ' + errors.join(' | '));
  window.__finish();
})();
