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
  window.__finish();
})().catch(e => { console.log('TEST ERROR', e && e.stack || e); window.__finish(); });
