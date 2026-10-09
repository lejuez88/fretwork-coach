import { Audio } from '../js/core/audio.js';
const ok = window.__ok;
const sleep = ms => new Promise(r => setTimeout(r, ms));
Audio.ctx = { currentTime: 5, state: 'running' }; Audio.guitar = () => {}; Audio.click = () => {}; Audio.strum = () => {};
const errors = [];
window.addEventListener('error', e => errors.push(e.message));
window.addEventListener('unhandledrejection', e => errors.push('rejection: ' + (e.reason && e.reason.stack)));
console.error = (...a) => { errors.push(a.join(' ')); };
(async () => {
  await import('../js/app.js');
  await sleep(50);
  const go = async h => { const before = errors.length; location.hash = h; window.dispatchEvent(new HashChangeEvent('hashchange')); await sleep(60); ok(errors.length === before, `${h}: ${errors.slice(before).join(' | ')}`); };
  const view = () => document.getElementById('view');
  const { Store } = await import('../js/core/store.js');
  const p = Store.profile;
  await go('#/practice');
  ok(view().querySelector('a.lib-more-card[href="#/artist"]'), 'practice links to the artist series');
  await go('#/artist');
  ok(view().querySelectorAll('.artist-big').length === 6, 'artist index');
  for (const id of ['eric-johnson', 'van-halen', 'paul-gilbert', 'srv', 'hendrix', 'gilmour']) {
    await go('#/artist/' + id); await sleep(80);
    const n = view().querySelectorAll('.artist-lesson').length;
    ok(n >= 8, `${id}: ${n} lessons`);
    ok(view().querySelectorAll('.riff').length >= 5, id + ' riffs');
    // try every lesson
    let players = 0;
    for (let i = 0; i < n; i++) {
      const b = view().querySelector(`[data-al="try"][data-i="${i}"]`); b.click(); await sleep(5);
      if (view().querySelector(`[data-artslot="${i}"] .tabplayer`)) players++;
      if (view().querySelector(`[data-artslot="${i}"] .tabplayer .tpneck`)) {}
    }
    ok(players >= n - 4, `${id}: ${players}/${n} lessons open in the tab player`);
  }
  await go('#/artist/eric-johnson'); await sleep(80);
  const titles = [...view().querySelectorAll('.artist-lesson b')].map(b => b.textContent).join(' | ');
  ok(/Rolling 5s/.test(titles) && /Spread triads/.test(titles) && /sixes/i.test(titles), 'EJ lessons: ' + titles.slice(0, 300));
  // add a riff to My songs
  const before = p.songs.length;
  view().querySelector('[data-riff="0"]').click(); await sleep(10);
  ok(p.songs.length === before + 1 && p.songs[p.songs.length - 1].title.includes('Cliffs'), 'riff added to My songs');
  // save and add to routines
  view().querySelector('[data-al="save"][data-i="0"]').click();
  view().querySelector('[data-al="add"][data-i="1"]').click();
  ok(p.customExercises.length >= 1 && p.prescriptions.some(r => r.status === 'active' && /Eric Johnson/.test(r.reason)), 'save + add to routines');
  // start the master class
  view().querySelector('[data-al="master"]').click(); await sleep(150);
  ok(/#\/course\//.test(location.hash), 'master class opened: ' + location.hash);
  const mc = p.courses.find(c => c.topic && c.topic.topicId === 'artist-eric-johnson');
  ok(mc && mc.name === 'Eric Johnson Master Class' && mc.tree.units.length >= 5, 'EJ master class built');
  await go(location.hash);
  await go('#/artist/eric-johnson'); await sleep(80);
  ok(view().querySelector('a.btn.primary[href^="#/course/"]'), 'artist page links to your master class');
  // practice a lesson
  view().querySelector('[data-al="practice"][data-i="2"]').click(); await sleep(80);
  ok(location.hash === '#/practice/run', 'practice opens the runner');
  // Technique library: learning paths
  await go('#/practice');
  ok(view().querySelector('.learn-links a[href="#/techniques"]'), 'practice page links to the technique library');
  await go('#/techniques');
  view().querySelector('[data-band="all"]').click(); await sleep(10);
  const { KB_INDEX } = await import('../js/data/kb.js');
  ok(view().querySelectorAll('.tech-card').length === KB_INDEX.length, `all entries listed (${view().querySelectorAll('.tech-card').length}/${KB_INDEX.length})`);
  ok(view().querySelectorAll('.tech-card .stage-dots').length === KB_INDEX.length, 'stage dots on every card');
  view().querySelector('[data-band="beginner"]').click(); await sleep(10);
  ok([...view().querySelectorAll('.tech-card')].length === KB_INDEX.filter(t => t.stages.some(s => s.tier === 'foundations')).length, 'beginner filter = entries with a foundations stage');
  view().querySelector('[data-band="all"]').click(); await sleep(10);
  for (const t of KB_INDEX) {
    await go('#/techniques/' + t.id); await sleep(60);
    const n = view().querySelectorAll('.artist-lesson').length;
    ok(n >= 1, `${t.id}: ${n} lessons`);
    ok(view().querySelectorAll('.path-stage').length === 4, t.id + ' shows all four stages');
    ok(view().querySelectorAll('.path-stage.missing').length === 4 - t.stages.length, t.id + ' marks missing stages');
    const b = view().querySelector('[data-al="try"][data-i="0"]'); b.click(); await sleep(5);
    ok(view().querySelector('[data-artslot="0"] .tabplayer, [data-artslot="0"] .metro'), t.id + ' try opens a player');
  }
  // the request box on the library page
  await go('#/techniques');
  const form = view().querySelector('[data-r="kbform"]');
  form.elements.text.value = 'bossa nova'; form.elements.kind.value = 'style';
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(30);
  ok(p.kbRequests.some(r => r.text === 'bossa nova' && r.kind === 'style'), 'request added from the library page');
  ok(/bossa nova/.test(view().querySelector('.kbqueue').textContent), 'queue shows the request');
  // the gap prompt in the master-class sheet
  const { openMasterSheet } = await import('../js/ui/mastersheet.js');
  const sh = openMasterSheet({ title: 'Tosin Abasi style', cat: 'artist' }, { navigate: () => {} }); await sleep(20);
  const gapBox = document.querySelector('.kbgap');
  ok(gapBox && /Tosin Abasi/.test(gapBox.textContent), 'master sheet asks to add an unknown guitarist');
  gapBox.querySelector('[data-kbadd]').click(); await sleep(20);
  ok(p.kbRequests.some(r => r.text === 'Tosin Abasi' && r.kind === 'guitarist'), 'guitarist added to the research queue');
  sh.close();
  await go('#/techniques/rolling5s'); await sleep(60);
  ok(/Eric Johnson/.test(view().querySelector('.artist-side').textContent), 'rolling 5s lists Eric Johnson');
  await go('#/artist/eric-johnson'); await sleep(60);
  ok(view().querySelector('.artist-head a.chip[href="#/techniques/rolling5s"]'), 'artist technique chips link to the library');
  await go('#/settings');
  ok(/Saved lessons/.test(view().textContent), 'settings shows saved lessons');
  window.__finish();
})().catch(e => { console.log('THROW', e.stack); window.__finish(); });
