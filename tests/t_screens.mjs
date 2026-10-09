// Smoke test: boot the app with the test profile (tests/fixtures/profile.json) and visit every screen; open every
// library exercise and start a routine. Any thrown error fails.
import { Audio } from '../js/core/audio.js';
const ok = window.__ok;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ctx = { currentTime: 5, state: 'running' };
Audio.ctx = ctx; Audio.guitar = () => {}; Audio.click = () => {}; Audio.strum = () => {};
const errors = [];
window.addEventListener('error', e => errors.push(e.message));
window.addEventListener('unhandledrejection', e => errors.push('rejection: ' + (e.reason && e.reason.message)));
const origErr = console.error; console.error = (...a) => { errors.push(a.join(' ')); };
(async () => {
  await import('../js/app.js');
  await sleep(50);
  const go = async h => { const before = errors.length; location.hash = h; window.dispatchEvent(new HashChangeEvent('hashchange')); await sleep(40); ok(errors.length === before, `${h}: ${errors.slice(before).join(' | ')}`); };
  const view = () => document.getElementById('view');
  for (const h of ['#/home', '#/practice', '#/tools', '#/tools/metronome', '#/tools/chords', '#/tools/tabs', '#/tools/evaluate', '#/profile', '#/settings', '#/songs', '#/reassess']) await go(h);
  await go('#/songs');
  ok(view().className.includes('v-songs'), 'view class per screen');
  await go('#/home');
  ok(document.querySelector('.dash-cols .dash-main [data-r="routine"]') && document.querySelector('.dash-side [data-r="track"]'), 'dashboard columns');
  // every library exercise
  const { libraryEntries } = await import('../js/core/library.js');
  const { Store } = await import('../js/core/store.js');
  const ents = libraryEntries(Store.profile);
  let withPlayer = 0, withNeck = 0, withTempo = 0;
  for (const e of ents) {
    await go('#/practice/ex/' + e.id);
    if (e.special) continue;
    if (view().querySelector('.tabplayer')) withPlayer++;
    if (view().querySelector('.tpneck .fboard')) withNeck++;
    if (view().querySelector('.tempo-row b.tv')) withTempo++;
    ok(view().querySelector('.exgrid .exvar') && view().querySelector('.exgrid .explayer'), e.id + ' uses the exercise grid');
  }
  const n = ents.filter(e => !e.special).length;
  ok(withTempo === n, `tempo row with beat label on every exercise (${withTempo}/${n})`);
  ok(withNeck === withPlayer && withPlayer > 30, `neck under every tab player (${withNeck}/${withPlayer})`);
  // a routine from the library
  await go('#/practice/ex/strum');
  const timerBtn = document.querySelector('#actionbar [data-a="timer"]');
  ok(!!timerBtn, 'practice with timer button');
  if (timerBtn) { timerBtn.click(); await sleep(80); }
  ok(view().querySelector('.run-grid .run-a') && view().querySelector('.runcard .tabplayer'), 'routine runner layout with player');
  ok(/8th notes/.test(view().querySelector('.tempo-row').textContent), 'runner tempo row says 8th notes');
  // the strum's chord boxes light up while it plays
  view().querySelector('[data-r="play"]').click();
  for (let i = 0; i < 90; i++) { ctx.currentTime += 0.1; await sleep(26); }
  ok(view().querySelector('.cdiag.playing'), 'runner: chord box lights up while playing');
  view().querySelector('[data-r="play"]').click();

  // Settings: a key pasted with a line break and a capital first letter is cleaned, saved and described
  await go('#/settings');
  const A = 'sk-ant-api03-' + 'Ab1_'.repeat(23) + 'x-yzAA';
  const box = view().querySelector('[data-r="key"]');
  box.value = 'Sk-ant-' + A.slice(7, 50) + String.fromCharCode(10) + A.slice(50) + ' ';
  view().querySelector('[data-s="save"]').click();
  ok(localStorage.getItem('fretworkCoach.anthropicKey') === A, 'cleaned key saved');
  ok(/Saved in this browser: sk-ant-api03/.test(view().querySelector('[data-r="status"]').textContent) && /Removed spaces/.test(view().querySelector('[data-r="status"]').textContent), 'status shows what was saved: ' + view().querySelector('[data-r="status"]').textContent);
  const Y = 'AIzaSy' + 'B'.repeat(33);
  view().querySelector('[data-r="ytkey"]').value = Y.slice(0, 20) + ' ' + Y.slice(20);
  view().querySelector('[data-s="ytsave"]').click();
  ok(localStorage.getItem('fretworkCoach.youtubeKey') === Y, 'cleaned YouTube key saved');
  // an old saved key with a stray space still works when read
  localStorage.setItem('fretworkCoach.anthropicKey', A.slice(0, 30) + ' ' + A.slice(30));
  const { Claude } = await import('../js/core/claude.js');
  ok(Claude.getKey() === A, 'stored key with a space is read cleanly');
  // storage that refuses to keep anything gets a clear message
  const realSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function () { const e = new Error('blocked'); e.name = 'SecurityError'; throw e; };
  view().querySelector('[data-r="key"]').value = A;
  view().querySelector('[data-s="save"]').click();
  Storage.prototype.setItem = realSet;
  ok(/didn’t keep the key/.test(view().querySelector('[data-r="status"]').textContent), 'blocked storage explained');
  localStorage.removeItem('fretworkCoach.anthropicKey'); localStorage.removeItem('fretworkCoach.youtubeKey');

  // Moving keys to another device: QR on one, #/keys link on the other
  {
    const A2 = 'sk-ant-api03-' + 'Zz9-'.repeat(23) + 'q_rsAA', Y2 = 'AIzaSy' + 'Bc9_'.repeat(8) + 'Z';
    localStorage.setItem('fretworkCoach.anthropicKey', A2); localStorage.setItem('fretworkCoach.youtubeKey', Y2);
    await go('#/settings');
    ok(/Build /.test(view().textContent), 'build label shown');
    ok(!view().querySelector('[data-r="sendrow"]').hidden, 'send row visible with keys');
    view().querySelector('[data-s="qr"]').click(); await sleep(10);
    ok(view().querySelector('.keyqr svg') && !view().querySelector('[data-r="qr"]').hidden, 'QR shown');
    const { keysLink } = await import('../js/core/keys.js');
    const link = keysLink({ anthropic: A2, youtube: Y2 });
    localStorage.removeItem('fretworkCoach.anthropicKey'); localStorage.removeItem('fretworkCoach.youtubeKey');
    await go(link.slice(link.indexOf('#')));
    ok(location.hash === '#/keys', 'keys removed from the address bar: ' + location.hash);
    ok(/sk-ant-api03/.test(view().textContent) && /39 characters/.test(view().textContent), 'import screen shows fingerprints');
    view().querySelector('[data-k="save"]').click(); await sleep(60);
    ok(localStorage.getItem('fretworkCoach.anthropicKey') === A2 && localStorage.getItem('fretworkCoach.youtubeKey') === Y2, 'keys saved from link');
    ok(location.hash === '#/settings', 'back to settings after saving');
    // pasting a link in Settings
    localStorage.removeItem('fretworkCoach.youtubeKey');
    view().querySelector('[data-r="keylink"]').value = 'link: ' + keysLink({ youtube: Y2 });
    view().querySelector('[data-s="uselink"]').click(); await sleep(60);
    ok(location.hash === '#/keys' && /AIzaSy/.test(view().textContent), 'pasted link opens the import screen');
    view().querySelector('[data-k="save"]').click(); await sleep(60);
    ok(localStorage.getItem('fretworkCoach.youtubeKey') === Y2, 'pasted link saves the key');
    await go('#/keys');
    ok(/No keys to add/.test(view().textContent), 'empty import screen');
    localStorage.removeItem('fretworkCoach.anthropicKey'); localStorage.removeItem('fretworkCoach.youtubeKey');
  }

  // Google Drive: save creates the file, a second save updates it, load replaces the profile
  {
    const calls = []; let stored = null;
    window.google = { accounts: { oauth2: { initTokenClient: o => ({ requestAccessToken() { setTimeout(() => this.callback({ access_token: 'tok', expires_in: 3600 }), 0); }, callback: o.callback }), revoke() {} } } };
    window.fetch = async (url, opt = {}) => {
      calls.push((opt.method || 'GET') + ' ' + url.replace('https://www.googleapis.com', '').split('?')[0]);
      const J = (o, st = 200) => ({ ok: st < 400, status: st, json: async () => o });
      if (/\/drive\/v3\/files\?q=/.test(url)) return J({ files: stored ? [{ id: 'F1', name: 'Fretwork Coach profile.json', modifiedTime: new Date().toISOString(), webViewLink: 'https://drive.google.com/file/d/F1' }] : [] });
      if (/uploadType=multipart/.test(url)) { stored = String(opt.body).split('\r\n\r\n')[2].split('\r\n--')[0]; return J({ id: 'F1', name: 'Fretwork Coach profile.json', modifiedTime: new Date().toISOString(), webViewLink: 'https://drive.google.com/file/d/F1' }); }
      if (/uploadType=media/.test(url)) { stored = opt.body; return J({ id: 'F1', name: 'Fretwork Coach profile.json', modifiedTime: new Date().toISOString() }); }
      if (/alt=media/.test(url)) return J(JSON.parse(stored));
      return J({}, 404);
    };
    localStorage.setItem('fretworkCoach.googleClientId', 'test.apps.googleusercontent.com');
    await go('#/settings');
    view().querySelector('[data-s="drivesave"]').click(); await sleep(80);
    ok(/Saved to your Drive/.test(view().querySelector('[data-r="drivestatus"]').textContent) && calls.some(c => c.startsWith('POST /upload')), 'first save creates the file: ' + view().querySelector('[data-r="drivestatus"]').textContent);
    ok(JSON.parse(stored).questionnaire.name === 'Test Player', 'Drive file holds the profile');
    ok(!/sk-ant-|AIza/.test(stored), 'no API keys in the Drive file');
    view().querySelector('[data-s="drivesave"]').click(); await sleep(80);
    ok(calls.some(c => c.startsWith('PATCH /upload/drive/v3/files/F1')), 'second save updates the same file');
    const changed = JSON.parse(stored); changed.questionnaire.name = 'Test Player (from Drive)'; stored = JSON.stringify(changed);
    window.confirm = () => true;
    view().querySelector('[data-s="driveload"]').click(); await sleep(150);
    const { Store } = await import('../js/core/store.js');
    ok(Store.profile.questionnaire.name === 'Test Player (from Drive)', 'load replaces the profile');
    localStorage.removeItem('fretworkCoach.googleClientId');
  }
  ok(errors.length === 0, 'no errors: ' + errors.slice(0, 5).join(' | '));
  window.__finish();
})().catch(e => { console.log('TEST ERROR', e && e.stack || e); window.__finish(); });
