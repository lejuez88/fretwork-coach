// Guest mode: use the app without a player profile. Everything opens, nothing is
// chosen for you, and progress isn't kept (only settings are).
import { Audio } from '../js/core/audio.js';
const ok = window.__ok;
const sleep = ms => new Promise(r => setTimeout(r, ms));
Audio.ctx = { currentTime: 5, state: 'running' }; Audio.guitar = () => {}; Audio.click = () => {}; Audio.strum = () => {};
const errors = [];
window.addEventListener('error', e => errors.push(e.message));
window.addEventListener('unhandledrejection', e => errors.push('rejection: ' + (e.reason && e.reason.stack)));
console.error = (...a) => { errors.push(a.join(' ')); };
window.confirm = () => true;
window.fetch = globalThis.fetch = () => Promise.reject(new Error('offline in tests'));
(async () => {
  await import('../js/app.js');
  await sleep(50);
  const go = async h => { const before = errors.length; location.hash = h; window.dispatchEvent(new HashChangeEvent('hashchange')); await sleep(120); ok(errors.length === before, `${h}: ${errors.slice(before).join(' | ')}`); };
  const view = () => document.getElementById('view');
  const { Store } = await import('../js/core/store.js');

  // --- welcome offers guest mode
  await go('#/');
  const skip = view().querySelector('[data-w="guest"]');
  ok(skip && /guest/i.test(skip.textContent), 'the welcome screen offers “use the app as a guest”');
  skip.click(); await sleep(120);
  ok(Store.profile && Store.profile.guest, 'guest mode starts');
  ok(location.hash === '#/home' && view().querySelector('.guest-card'), 'home is the guest home with the way to a profile');
  ok(!view().querySelector('[data-r="routine"]') && !/chosen for you\b/i.test(view().textContent), 'no lesson is chosen for a guest');
  ok(document.querySelector('#tabbar').innerHTML.length > 0, 'the tab bar is there');

  // --- nothing but settings is stored
  Store.profile.settings.clickSound = 'woodblock';
  Store.profile.varState['x~base'] = { history: [{ tempo: 90 }] };
  Store.save();
  ok(!localStorage.getItem('fretworkCoach.profile.v2'), 'no profile is written to the browser');
  const g = JSON.parse(localStorage.getItem('fretworkCoach.guest') || 'null');
  ok(g && g.settings && g.settings.clickSound === 'woodblock' && !g.varState, 'only settings are kept');
  Store.load();
  ok(Store.profile.guest && Store.profile.settings.clickSound === 'woodblock' && !Store.profile.varState['x~base'], 'reopening: still a guest, settings kept, progress gone');

  // --- the learning areas open, without suggestions
  await go('#/practice');
  ok(view().querySelector('.mastercard') && !view().querySelector('.mc-foryou'), 'Practice: no “For you” master class');
  await go('#/techniques');
  ok(view().querySelectorAll('.tech-bubble').length > 10 && !view().querySelector('.lvl-dots') && !view().querySelector('[data-band="foryou"]'), 'technique library: every entry, no level pills, no “For you” filter');
  await go('#/techniques/pentatonic'); await sleep(200);
  ok(view().querySelector('.guest-note') && !/chosen for you\b/i.test(view().textContent), 'technique path: a guest note instead of a chosen lesson');
  ok(view().querySelector('.lr, .artist-lesson, .lgroup, .lesson-group') || view().querySelector('[data-al]') || /Lessons/.test(view().textContent), 'the path’s lessons are listed');
  await go('#/artist/paul-gilbert'); await sleep(150);
  ok(view().querySelector('.guest-note') && !/chosen for you\b/i.test(view().textContent), 'artist page: a guest note instead of a chosen lesson');
  ok(!view().querySelector('[data-al="master"]'), 'no master class button for a guest');
  await go('#/songs');
  ok(!/Recommended for you/.test(view().textContent) && view().querySelector('.guest-note'), 'songs: no recommendations, a guest note');
  await go('#/tools/trainers/notes');
  ok(view().querySelector('.notefinder, [data-nf], .nf') || /note/i.test(view().textContent), 'tools open');

  // --- practice page: logging is allowed but says it isn't kept
  await go('#/practice/ex/spider'); await sleep(30);
  const rail = view().querySelector('[data-rail="log"]');
  ok(rail, 'the practice page opens for a guest');
  if (rail) { rail.click(); await sleep(20); ok(view().querySelector('.guest-line'), 'the log panel says tempos aren’t kept'); }

  // --- profile and settings
  await go('#/profile');
  ok(view().querySelector('.guest-card a[href="#/welcome"]'), 'profile: explains what a profile adds, with a create button');
  await go('#/settings');
  ok(!view().querySelector('[data-s="export"]') && !view().querySelector('[data-s="drivesave"]') && view().querySelector('[data-s="endguest"]'), 'settings: no save or export of a guest; a way out of guest mode');
  view().querySelector('[data-s="endguest"]').click(); await sleep(120);
  ok(!Store.profile && !localStorage.getItem('fretworkCoach.guest') && location.hash === '#/welcome', 'leaving guest mode goes back to the welcome screen');

  // --- a real profile replaces guest mode
  Store.startGuest();
  const { emptyProfile } = await import('../js/core/store.js');
  const real = emptyProfile(); real.domains = { picking: { level: 5 } };
  Store.replace(real);
  ok(!Store.profile.guest && localStorage.getItem('fretworkCoach.profile.v2') && !localStorage.getItem('fretworkCoach.guest'), 'creating or loading a profile ends guest mode');
  window.__finish();
})().catch(e => { console.log('THROW', e.stack); window.__finish(); });
