// The player's guitar (Settings → Guitar): 6, 7 or 8 strings, any tuning, and every tool following it.
// Also: tab.strings / tab.tuning in the normalizer and the tab player, and the tuner button in the playback bar.
import { Audio } from '../js/core/audio.js';
const ok = window.__ok;
const sleep = ms => new Promise(r => setTimeout(r, ms));
Audio.ctx = { currentTime: 5, state: 'running', sampleRate: 48000 }; Audio.get = () => Audio.ctx; Audio.guitar = () => {}; Audio.click = () => {}; Audio.strum = () => {};
Audio.openMic = async () => { throw Object.assign(new Error('no mic in tests'), { name: 'NotFoundError' }); };
(async () => {
  await import('../js/app.js'); await sleep(50);
  const { Store } = await import('../js/core/store.js');
  const G = await import('../js/core/guitar.js');
  const p = Store.profile;
  const view = () => document.getElementById('view');
  const go = async h => { location.hash = h; window.dispatchEvent(new HashChangeEvent('hashchange')); await sleep(90); };

  // --- the setting
  delete p.settings.guitar;
  ok(G.guitar().strings === 6 && G.currentTuning().join() === '64,59,55,50,45,40', 'default: six strings, standard');
  ok(G.guitarOf({ tuning: 'dropD' }).tuning[5] === 38, 'the old tuner setting (Drop D) carries over');
  ok(G.stringNames(G.STANDARD[8]).join(' ') === 'e B G D A E B F♯' && G.tuningNotes(G.STANDARD[7]) === 'B E A D G B E', '7 and 8 strings: B E A D G B E and F♯ B E A D G B E');
  ok(G.tuningNotes(G.presetNotes(6, 'halfDown')) === 'E♭ A♭ D♭ G♭ B♭ E♭' && G.tuningNotes(G.presetNotes(7, 'dropA')) === 'A E A D G B E' && G.presetNotes(6, 'wholeDown')[5] === 38, 'presets: half step down, Drop A, full step down');
  G.setGuitar({ strings: 8 });
  ok(p.settings.guitar.strings === 8 && G.currentTuning().length === 8 && G.openMidi(8) === 30, 'set to 8 strings: saved in the profile, low F♯ = 30');
  const L = G.stringLabels();
  ok(L[1] === 'high E' && L[6] === 'low E' && L[7] === 'low B' && L[8] === 'F♯' && L[2] === 'B', 'string names for talking: ' + JSON.stringify(L));
  ok(JSON.parse(JSON.stringify(p)).settings.guitar.tunings[8].length === 8, 'it travels with the profile (exports and Drive)');

  // --- note finder on 8 strings
  const nf = await import('../js/screens/notefinder.js');
  ok(nf.allStrings().join() === '8,7,6,5,4,3,2,1' && nf.withTier(nf.NF_DEFAULTS, 'intermediate').strings.length === 8, 'note finder: all eight strings');
  ok(nf.fretsFor(8, 6, 12).join() === '0,12' && nf.fretsFor(7, 11, 12).join() === '0,12', 'F♯ on string 8, B on string 7');
  ok(nf.judgePlayed(30, 8, 6, 12) === 'ok' && nf.judgePlayed(42, 8, 6, 12) === 'ok' && nf.judgePlayed(54, 8, 6, 12) === 'octave', 'playing it: the low F♯ counts on string 8');
  const S8 = { ...nf.NF_DEFAULTS, strings: [8, 7], notes: [0, 2, 4, 5, 7, 9, 11], order: 'random', frets: 12 };
  const st = { seq: 0, misses: {}, last: null }; let onLow = 0;
  for (let i = 0; i < 60; i++) { const x = nf.nextPrompt(S8, st); if ([7, 8].includes(x.s)) onLow++; st.last = x; }
  ok(onLow === 60, 'random prompts use strings 7 and 8');
  await go('#/tools/trainers/notes');
  ok(view().querySelectorAll('[data-str]:not([data-str="all"])').length === 8, 'note finder screen: 8 string chips');
  view().querySelector('[data-nf="start"]').click(); await sleep(30);
  ok(view().querySelectorAll('.nf-neck .fb-sname').length === 8, 'and an 8-string neck');
  const stop = view().querySelector('[data-nf="stop"]'); if (stop) stop.click();

  // --- scales on 8 strings: every position has every note of the scale
  const sc = await import('../js/screens/scales.js');
  const { scalePositions, SCALE_BY_ID, spellScale, ROOTS, mod12 } = await import('../js/core/theory.js');
  const low8 = G.lowFirst();
  let badPos = 0, on8 = 0;
  for (const id of ['major', 'lydian', 'minorPent', 'harmonicMinor', 'blues']) for (const r of [0, 4, 9]) {
    const pcs = new Set(SCALE_BY_ID[id].steps.map(x => mod12(r + x)));
    for (const pos of scalePositions(r, id, { tuning: low8 })) {
      const got = new Set(pos.notes.map(n => mod12(n.midi)));
      if (got.size !== pcs.size || [...got].some(x => !pcs.has(x)) || pos.notes.some(n => mod12(low8[8 - n.s] + n.f) !== mod12(n.midi))) badPos++;
      if (pos.notes.some(n => n.s === 8)) on8++;
    }
  }
  ok(badPos === 0 && on8 > 10, `8-string positions: every note, right pitches (${on8} start on string 8, ${badPos} wrong)`);
  const marks = sc.neckMarksFor(4, 'minorPent', { maxFret: 12, tuning: G.currentTuning() });
  ok(marks.some(m => m.s === 8 && m.f === 1) && marks.some(m => m.s === 7 && m.f === 0), 'E minor pentatonic marks G on string 8 fret 1 and B open on string 7');
  await go('#/tools/scales');
  ok(view().querySelectorAll('.glossary.scales .fb-sname').length === 8 && /8-string guitar/.test(view().textContent), 'scales screen: 8-string neck, says which guitar');

  // --- Drop D on six strings
  G.setGuitar({ strings: 6 }); G.setGuitar({ tuning: G.presetNotes(6, 'dropD') });
  ok(G.guitar().strings === 6 && G.openMidi(6) === 38 && G.guitar().tunings[8].length === 8, 'back to 6 in Drop D; the 8-string tuning is kept');
  ok(nf.fretsFor(6, 2, 12).join() === '0,12' && nf.fretsFor(6, 4, 12).join() === '2', 'Drop D: D is open on string 6, E at fret 2');
  await go('#/tools/chords');
  view().querySelector('[data-view="neck"]').click(); await sleep(30);
  const names = [...view().querySelectorAll('.fboard .fb-sname')].map(t => t.textContent);
  ok(names.join(' ') === 'e B G D A D', 'chords: the neck is labelled in Drop D: ' + names.join(' '));
  ok([...view().querySelectorAll('.fb-mark')].some(m => m.dataset.ms === '6' && m.dataset.mf === '2'), 'C major whole neck: E (the 3rd) at fret 2 of the low D string');
  view().querySelector('[data-view="build"]').click(); await sleep(30);
  // build D5 on the bottom three strings: open, 7? no: in Drop D one finger at 0 across 6-5-4 = D A D
  for (const [s, f] of [[6, 0], [5, 0], [4, 0]]) { view().querySelector(`.fb-hit[data-s="${s}"][data-f="${f}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })); await sleep(10); }
  ok(/^D5/.test(view().querySelector('.bname').textContent.trim()), 'build: open low strings in Drop D name a D5: ' + view().querySelector('.bname').textContent);

  // --- the tuner: one row per string
  G.setGuitar({ strings: 7 });
  await go('#/tools/tuner');
  const rows = [...view().querySelectorAll('[data-r="strings"] [data-t]')].filter(b => /^\d+$/.test(b.dataset.t));
  ok(rows.length === 7 && /^7: B1/.test(rows[0].textContent) && /^1: E4/.test(rows[6].textContent), 'tuner: 7 rows, string 7 = B1: ' + rows.map(b => b.textContent).join(' '));
  view().querySelector('[data-strings="8"]').click(); await sleep(20);
  ok(G.guitar().strings === 8 && view().querySelectorAll('[data-r="strings"] [data-t]').length === 10 && /^8: F♯1/.test(view().querySelector('[data-r="strings"] [data-t="0"]').textContent), 'tuner: switching to 8 strings adds the low F♯');
  const sel = view().querySelector('[data-r="tuning"]'); sel.value = 'dropE'; sel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(20);
  ok(G.openMidi(8) === 28 && /^8: E1/.test(view().querySelector('[data-r="strings"] [data-t="0"]').textContent), 'tuner preset Drop E sets the guitar');
  ok(G.listenRange().minFreq < 40 && G.listenRange().fftSize === 4096, 'the note listener reaches down to the low E1 (' + JSON.stringify(G.listenRange()) + ')');

  // --- Settings → Guitar
  G.setGuitar({ strings: 6, tuning: G.STANDARD[6] });
  await go('#/settings');
  const gs = () => view().querySelector('[data-r="guitarset"]');
  ok(gs() && gs().querySelectorAll('[data-gt-str]').length === 6, 'Settings has a Guitar section with a picker per string');
  gs().querySelector('[data-gt-strings="7"]').click(); await sleep(10);
  ok(p.settings.guitar.strings === 7 && gs().querySelectorAll('[data-gt-str]').length === 7, 'Settings: 7-string adds string 7');
  const s7 = gs().querySelector('[data-gt-str="7"]'); s7.value = '33'; s7.dispatchEvent(new Event('change', { bubbles: true })); await sleep(10);
  ok(G.openMidi(7) === 33 && gs().querySelector('[data-gt="preset"]').value === 'dropA', 'setting string 7 to A reads as Drop A');
  const s1 = gs().querySelector('[data-gt-str="1"]'); s1.value = '62'; s1.dispatchEvent(new Event('change', { bubbles: true })); await sleep(10);
  ok(gs().querySelector('[data-gt="preset"]').value === 'custom' && /Custom/.test(gs().querySelector('[data-gt="preset"]').textContent), 'any string can be set: a custom tuning');
  gs().querySelector('[data-gt="standard"]').click(); await sleep(10);
  ok(G.currentTuning().join() === G.STANDARD[7].join(), 'Back to standard');

  // --- tab format: tab.strings and tab.tuning
  const { normalizeExercise, toPlayerExercise } = await import('../js/core/coursegen.js');
  const base = { name: 'x', domain: 'picking', goalBpm: 120, startBpm: 80 };
  const n8 = normalizeExercise({ ...base, tab: { strings: 8, notes: [{ t: 0, d: 1, s: 8, f: 0 }, { t: 1, d: 1, s: 7, f: 2 }, { t: 2, d: 1, s: 6, f: 3 }] } });
  ok(n8.tab.strings === 8 && n8.tab.notes.length === 3, 'normalizer keeps an 8-string tab');
  const n6 = normalizeExercise({ ...base, tab: { notes: [{ t: 0, d: 1, s: 7, f: 0 }, { t: 1, d: 1, s: 6, f: 2 }, { t: 2, d: 1, s: 5, f: 3 }] } });
  ok(!n6.tab.strings && n6.tab.notes.every(x => x.s <= 6), 'a tab without strings: 7 stays six-string');
  const nd = normalizeExercise({ ...base, tab: { strings: 7, tuning: [64, 59, 55, 50, 45, 40, 33], notes: [{ t: 0, d: 1, s: 7, f: 0 }, { t: 1, d: 1, s: 7, f: 3 }, { t: 2, d: 1, s: 6, f: 3 }] } });
  ok(nd.tab.tuning.length === 7 && nd.tab.tuning[6] === 33, 'normalizer keeps a 7-string Drop A tuning');
  const px = toPlayerExercise(n8, 80);
  ok(px.strings === 8, 'the player gets the string count');

  // the tab player draws 8 lines; on a guitar set to fewer strings it says so
  G.setGuitar({ strings: 6 });
  const { mountTabPlayer } = await import('../js/tools/tabplayer.js');
  const host = document.createElement('div'); document.body.appendChild(host);
  const off = mountTabPlayer(host, px, { settings: p.settings, compact: true });
  await sleep(20);
  ok(host.querySelectorAll('.tab-sname').length >= 8 && /8-string guitar/.test(host.querySelector('.tp-tuning').textContent), '8-string tab: 8 lines, and a note that your guitar is set to 6');
  off();
  G.setGuitar({ strings: 6, tuning: G.presetNotes(6, 'dropD') });
  const p6 = toPlayerExercise(normalizeExercise({ ...base, tab: { notes: [{ t: 0, d: 1, s: 6, f: 0 }, { t: 1, d: 1, s: 6, f: 2 }, { t: 2, d: 1, s: 5, f: 3 }] } }), 80);
  const off2 = mountTabPlayer(host, p6, { settings: p.settings, compact: true }); await sleep(20);
  ok([...host.querySelectorAll('.tab-sname')].slice(0, 6).map(t => t.textContent).join(' ') === 'e B G D A D' && /Drop D/.test(host.querySelector('.tp-tuning').textContent), 'a standard lesson in Drop D: labelled D, with a note');
  const timing = off2.timing ? off2.timing() : null;
  ok(!timing || timing.tuning[5] === 38, 'and it sounds in Drop D');
  off2(); host.remove();
  G.setGuitar({ strings: 6, tuning: G.STANDARD[6] });

  // --- the tuner button in the playback bar
  await go('#/artist/eric-johnson');
  view().querySelector('[data-al="practice"][data-i="0"]').click(); await sleep(80);
  view().querySelector('[data-sp="play"]').click(); await sleep(150);
  const tb = document.querySelector('#transport [data-tr="tune"]');
  ok(tb, 'the playback bar has a tuner button');
  tb.click(); await sleep(30);
  ok(document.querySelector('.tunepop.at-dock') && document.querySelector('#transport [data-tr="tune"]').classList.contains('on'), 'it opens the quick tuner above the bar');
  document.querySelector('#transport [data-tr="tune"]').click(); await sleep(30);
  ok(!document.querySelector('.tunepop'), 'and closes it');
  window.__finish();
})().catch(e => { console.log('TEST ERROR', e && e.stack || e); window.__finish(); });
