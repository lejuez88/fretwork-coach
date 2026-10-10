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
  const { ARTIST_INDEX } = await import('../js/data/kb.js');
  ok(view().querySelectorAll('.artist-big').length === ARTIST_INDEX.length && ARTIST_INDEX.length >= 6, 'artist index lists every artist');
  for (const id of ['eric-johnson', 'van-halen', 'paul-gilbert', 'srv', 'hendrix', 'gilmour']) {
    await go('#/artist/' + id); await sleep(80);
    const n = view().querySelectorAll('.artist-lesson').length;
    ok(n >= 8, `${id}: ${n} lessons`);
    ok(view().querySelectorAll('.riff').length >= 5, id + ' riffs');
    // practice every lesson: open the first on the practice page and step through with ›
    let players = 0;
    view().querySelector('[data-al="practice"][data-i="0"]').click(); await sleep(60);
    ok(location.hash === '#/play', id + ': practice opens the practice page');
    for (let i = 0; i < n; i++) {
      if (view().querySelector('.play-stage .tabplayer')) players++;
      const nx = view().querySelector('[data-pl="next"]'); if (nx && !nx.disabled) { nx.click(); await sleep(8); }
    }
    ok(players >= n - 4, `${id}: ${players}/${n} lessons open in the tab player`);
    ok(/← /.test(view().querySelector('.pb-back').textContent) && view().querySelector('.pb-back').getAttribute('href') === '#/artist/' + id, id + ': back goes to the artist page');
  }
  await go('#/artist/eric-johnson'); await sleep(80);
  // topics are buttons that open their lesson lists, one at a time
  {
    const groups = [...view().querySelectorAll('.lesson-group')];
    ok(groups.length >= 4 && groups.every(g => g.querySelector('.lg-body').hidden), `artist topics start closed (${groups.length})`);
    ok(groups.every(g => /\d+ lessons?/.test(g.querySelector('.lg-head').textContent)), 'each topic shows its lesson count');
    groups[0].querySelector('.lg-head').click(); await sleep(5);
    ok(!groups[0].querySelector('.lg-body').hidden && groups[0].querySelector('.lg-head').getAttribute('aria-expanded') === 'true', 'tapping a topic opens its lessons');
    groups[1].querySelector('.lg-head').click(); await sleep(5);
    ok(groups[0].querySelector('.lg-body').hidden && !groups[1].querySelector('.lg-body').hidden, 'opening another topic closes the first');
    groups[1].querySelector('.lg-head').click(); await sleep(5);
    ok(!view().querySelector('.lesson-group.open'), 'tapping the open topic closes it');
    const jump = view().querySelector('.nextlesson [data-jump]');
    if (jump) {
      jump.click(); await sleep(10);
      const row = view().querySelector(`.lesson-row[data-lesson="${jump.dataset.jump}"]`);
      ok(row && row.classList.contains('open') && row.closest('.lesson-group').classList.contains('open'), '“Show it in the list” opens its topic and the lesson');
    }
    ok(view().querySelector('.ah-body [data-r="bio"]') && !/About Eric Johnson/.test(view().querySelector('.artist-head').textContent), 'the bio sits under the name, without an “About” heading');
    ok(view().querySelector('.ah-body [data-r="video"] .topvid'), 'the bio area has the YouTube video (or the link to the most-viewed videos)');
    view().querySelectorAll('.lesson-group.open .lg-head').forEach(h => h.click());
  }
  // lessons are rows: name + summary, one open at a time
  {
    const rows = [...view().querySelectorAll('.lesson-row')];
    ok(rows.length >= 8 && rows.every(r => r.querySelector('.lr-head b') && r.querySelector('.lr-body').hidden), 'artist lessons start as closed rows');
    ok(rows.filter(r => r.querySelector('.lr-sum').textContent.trim().length > 10).length >= rows.length - 1 && rows.every(r => r.querySelector('.lr-sum').textContent.length <= 121), 'each row has a short summary');
    rows[0].querySelector('.lr-head').click(); await sleep(5);
    ok(!rows[0].querySelector('.lr-body').hidden && rows[0].classList.contains('open') && rows[0].querySelector('.lr-head').getAttribute('aria-expanded') === 'true', 'tapping a row opens the full lesson');
    rows[1].querySelector('.lr-head').click(); await sleep(5);
    ok(rows[0].querySelector('.lr-body').hidden && !rows[1].querySelector('.lr-body').hidden && view().querySelectorAll('.lesson-row.open').length === 1, 'opening another closes the first');
    ok(rows[1].querySelector('[data-al="practice"]') && !rows[1].querySelector('[data-al="try"]') && !view().querySelector('.tabplayer'), 'an open lesson offers Practice; no player on the list page');
    rows[2].querySelector('.lr-head').click(); await sleep(10);
    rows[2].querySelector('.lr-head').click(); await sleep(5);
    ok(!view().querySelector('.lesson-row.open'), 'tapping the open row closes it');
    ok(view().querySelector('[data-r="bio"]'), 'the artist page has a place for the bio');
  }
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
  ok(location.hash === '#/play' && view().querySelector('.play-stage'), 'practice opens the practice page');
  ok(!localStorage.getItem('fretworkCoach.activeRoutine'), 'no timer for a single lesson');
  // Technique library: learning paths
  await go('#/practice');
  ok(view().querySelector('.learn-links a[href="#/techniques"]'), 'practice page links to the technique library');
  await go('#/techniques');
  view().querySelector('[data-band="all"]').click(); await sleep(10);
  const { KB_INDEX } = await import('../js/data/kb.js');
  ok(view().querySelectorAll('.tech-bubble').length === KB_INDEX.length, `all entries listed as bubbles (${view().querySelectorAll('.tech-bubble').length}/${KB_INDEX.length})`);
  ok([...view().querySelectorAll('.tech-bubble')].every(b => b.querySelector('.tb-dom') && b.querySelector('.lvl-dots i.on.cur') && /kind-(technique|subject|style)/.test(b.className) && /dom-/.test(b.className) && !b.querySelector('.tb-body')), 'bubbles show the area, your level pills (color-coded) and the kind outline, details hidden');
  view().querySelector('.tech-bubble [data-tbopen]').click(); await sleep(10);
  ok(view().querySelectorAll('.tech-bubble.open').length === 1 && view().querySelector('.tech-bubble.open .tb-body a[href^="#/techniques/"]') && view().querySelector('.tech-bubble.open .stage-dots'), 'tapping a bubble shows its details and the path link');
  view().querySelectorAll('.tech-bubble [data-tbopen]')[1].click(); await sleep(10);
  ok(view().querySelectorAll('.tech-bubble.open').length === 1, 'one bubble open at a time');
  view().querySelector('[data-band="beginner"]').click(); await sleep(10);
  ok([...view().querySelectorAll('.tech-bubble')].length === KB_INDEX.filter(t => t.stages.some(s => s.tier === 'foundations')).length, 'beginner filter = entries with a foundations stage');
  view().querySelector('[data-band="all"]').click(); await sleep(10);
  for (const t of KB_INDEX) {
    await go('#/techniques/' + t.id); await sleep(60);
    const n = view().querySelectorAll('.artist-lesson').length;
    ok(n >= 1, `${t.id}: ${n} lessons`);
    ok(view().querySelectorAll('.path-stage').length === 4, t.id + ' shows all four stages');
    ok(view().querySelectorAll('.path-stage.missing').length === 4 - t.stages.length, t.id + ' marks missing stages');
    view().querySelector('[data-al="practice"][data-i="0"]').click(); await sleep(40);
    ok(view().querySelector('.play-stage .tabplayer, .play-stage .metro'), t.id + ' practice opens a player');
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
  ok(/Eric Johnson/.test(view().querySelector('.pc-main').textContent), 'rolling 5s lists Eric Johnson');
  await go('#/artist/eric-johnson'); await sleep(60);
  ok(view().querySelector('.artist-head a.chip[href="#/techniques/rolling5s"]'), 'artist technique chips link to the library');
  await go('#/settings');
  ok(/Saved lessons/.test(view().textContent), 'settings shows saved lessons');
  window.__finish();
})().catch(e => { console.log('THROW', e.stack); window.__finish(); });
