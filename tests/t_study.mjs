// The Study page: reading cards first (#/lesson), then “Practice it” opens the practice page (#/play).
import { Audio } from '../js/core/audio.js';
const ok = window.__ok;
const sleep = ms => new Promise(r => setTimeout(r, ms));
Audio.ctx = { currentTime: 5, state: 'running' }; Audio.guitar = () => {}; Audio.click = () => {}; Audio.strum = () => {};
(async () => {
  await import('../js/app.js'); await sleep(50);
  const view = () => document.getElementById('view');
  const go = async h => { location.hash = h; window.dispatchEvent(new HashChangeEvent('hashchange')); await sleep(80); };
  await go('#/artist/eric-johnson');
  view().querySelector('[data-al="practice"][data-i="0"]').click(); await sleep(80);
  ok(location.hash === '#/lesson', 'a lesson opens on its Study page');
  const v = view();
  ok(v.querySelector('.sp-prog i') && /1\s*\/\s*\d+/.test(v.querySelector('.sp-count').textContent), 'progress bar and lesson count');
  ok(v.querySelector('.sp-card h1').textContent.trim().length > 2, 'the lesson title');
  ok(v.querySelectorAll('.sp-read h4').length >= 2, 'reading sections: ' + [...v.querySelectorAll('.sp-read h4')].map(h => h.textContent).join(', '));
  ok(v.querySelector('.sp-diagram'), 'a diagram of the notes');
  ok(v.querySelector('[data-sp="prev"]').disabled && !v.querySelector('[data-sp="next"]').disabled, 'first lesson: back disabled, next enabled');
  const t1 = v.querySelector('.sp-card h1').textContent;
  v.querySelector('[data-sp="next"]').click(); await sleep(40);
  ok(view().querySelector('.sp-card h1').textContent !== t1 && /2\s*\//.test(view().querySelector('.sp-count').textContent), 'next moves to lesson 2');
  view().querySelector('[data-sp="prev"]').click(); await sleep(40);
  ok(view().querySelector('.sp-card h1').textContent === t1, 'back returns to lesson 1');
  ok(document.body.classList.contains('studymode'), 'study mode on');
  view().querySelector('[data-sp="play"]').click(); await sleep(80);
  ok(location.hash === '#/play' && view().querySelector('.play-stage .tabplayer'), '“Practice it” opens the practice page with the tab');
  ok(!document.body.classList.contains('studymode'), 'study mode off after leaving');
  // the neck diagram never scrolls; a lesson high up the neck gets a window on its frets
  const { neckOf } = await import('../js/screens/study.js');
  const hiEx = { tab: { notes: [{ s: 1, f: 17 }, { s: 1, f: 22 }, { s: 2, f: 20 }] } };
  const box = document.createElement('div'); box.innerHTML = neckOf(hiEx);
  const win = box.querySelector('.sp-neck-win svg');
  ok(win && /frets 15 to 22/.test(win.getAttribute('aria-label')) && win.querySelectorAll('.fb-mark').length === 3, 'fret 22: a window on frets 15–22 with every note');
  ok(![...win.querySelectorAll('.fb-num')].some(t => +t.textContent < 15 || +t.textContent > 22) && !win.querySelector('.fb-nut'), 'the window draws only those frets (no nut)');
  const loBox = document.createElement('div'); loBox.innerHTML = neckOf({ tab: { notes: [{ s: 6, f: 0 }, { s: 1, f: 3 }] } });
  ok(loBox.querySelector('.sp-neck-full .fb-nut') && !loBox.querySelector('.sp-neck-win'), 'open position: the neck from the nut, no window needed');
  window.__finish();
})().catch(e => { console.log('TEST ERROR', e && e.stack || e); window.__finish(); });
