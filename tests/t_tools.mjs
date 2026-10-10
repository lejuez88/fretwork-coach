// Tools: note finder (strings, notes, order, random, scoring) and the scales glossary.
import { Audio } from '../js/core/audio.js';
const ok = window.__ok;
const sleep = ms => new Promise(r => setTimeout(r, ms));
Audio.ctx = { currentTime: 5, state: 'running' }; Audio.get = () => Audio.ctx; Audio.guitar = () => {};
(async () => {
  const nf = await import('../js/screens/notefinder.js');
  const sc = await import('../js/screens/scales.js');
  const { SCALE_BY_ID } = await import('../js/core/theory.js');
  // fret math
  ok(nf.fretsFor(6, 0, 12).join() === '8' && nf.fretsFor(5, 9, 12).join() === '0,12' && nf.fretsFor(1, 4, 12).join() === '0,12', 'fretsFor finds C on low E (8), A on A (0,12), E on high E (0,12)');
  // in order
  const S = { ...nf.NF_DEFAULTS, strings: [6, 5], notes: [0, 2], order: 'order', frets: 12 };
  const st = { seq: 0, misses: {}, last: null };
  const seq = Array.from({ length: 5 }, () => nf.nextPrompt(S, st)).map(x => `${x.s}:${x.pc}`);
  ok(seq.join() === '6:0,6:2,5:0,5:2,6:0', 'in order: low string first, notes in order, then repeats: ' + seq);
  // random: only chosen strings/notes, no immediate repeats, misses weighted
  const R = { ...S, order: 'random', strings: [3, 4], notes: [0, 2, 4, 5, 7, 9, 11] };
  const st2 = { seq: 0, misses: { '3:7': 8 }, last: null }; let prev = null, repeats = 0, g = 0, bad = 0;
  for (let i = 0; i < 400; i++) { const x = nf.nextPrompt(R, st2); if (![3, 4].includes(x.s) || !R.notes.includes(x.pc) || x.f > 12) bad++; if (prev && prev === `${x.s}:${x.pc}`) repeats++; if (x.s === 3 && x.pc === 7) g++; prev = `${x.s}:${x.pc}`; st2.last = x; }
  ok(!bad && !repeats, 'random prompts stay inside the chosen strings, notes and frets, never the same twice in a row');
  ok(g > 400 / 14 * 2, `missed spots come up more often (${g}/400)`);
  ok(nf.nextPrompt({ ...S, strings: [] }, st) === null, 'no strings: no prompt');
  // the trainer UI
  const el = document.createElement('div'); document.body.appendChild(el);
  localStorage.setItem('fretworkCoach.noteFinder', JSON.stringify({ mode: 'find', strings: [5], notes: [0], frets: 12, order: 'random', round: 2 }));
  const off = nf.mountNoteFinder(el);
  el.querySelector('[data-nf="start"]').click(); await sleep(5);
  ok(/C/.test(el.querySelector('.nf-note').textContent) && /A<\/b> string|A string/.test(el.querySelector('.nf-on').innerHTML), 'asks for C on the A string');
  el.querySelector('.fb-hit[data-s="5"][data-f="2"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); await sleep(5);
  ok(el.querySelector('.nf-fb.bad') && el.querySelector('.fb-mark.wrong') && /fret 3/.test(el.querySelector('.nf-fb').textContent), 'a wrong fret shows the right one (fret 3)');
  el.querySelector('[data-nf="next"]').click(); await sleep(5);
  el.querySelector('.fb-hit[data-s="5"][data-f="3"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); await sleep(800);
  ok(/Round done: 50%/.test(el.textContent), 'a round of 2 ends with the score: ' + el.querySelector('h3').textContent);
  ok(/Missed most: C on the A string/.test(el.textContent), 'and names the spots missed most');
  // name-it mode and settings
  el.querySelector('[data-mode="name"]').click(); el.querySelector('[data-notes="all"]').click(); el.querySelector('[data-str="all"]').click(); await sleep(5);
  const saved = JSON.parse(localStorage.getItem('fretworkCoach.noteFinder'));
  ok(saved.mode === 'name' && saved.notes.length === 12 && saved.strings.length === 6, 'settings are saved');
  el.querySelector('[data-nf="start"]').click(); await sleep(5);
  ok(el.querySelectorAll('.nf-choices .chip').length === 12 && el.querySelector('.fb-mark.target'), 'name it: a marked spot and 12 note choices');
  el.querySelector('[data-nf="stop"]').click();
  el.querySelector('[data-nf="randomize"]').click(); await sleep(5);
  const rnd = JSON.parse(localStorage.getItem('fretworkCoach.noteFinder'));
  ok(rnd.strings.length >= 1 && rnd.notes.length >= 3, 'randomize picks strings and notes');
  off();
  // scales glossary
  ok(sc.scaleNotes(9, 'minorPent').map(n => n.name).join() === 'A,C,D,E,G', 'A minor pentatonic notes');
  ok(sc.scaleNotes(0, 'dimHW').length === 8 && SCALE_BY_ID.dimWH && SCALE_BY_ID.wholeTone, 'diminished and whole-tone scales are in');
  ok(sc.scaleNotes(5, 'major').map(n => n.name).join() === 'F,G,A,B♭,C,D,E', 'F major spelled with B♭');
  const marks = sc.neckMarksFor(9, 'minorPent', { maxFret: 12 });
  ok(marks.filter(m => m.family === 'root').length >= 6 && marks.every(m => m.f <= 12), 'whole-neck marks with roots');
  const g2 = document.createElement('div'); document.body.appendChild(g2);
  sc.mountScalesGlossary(g2);
  const sel = g2.querySelector('[data-r="scale"]'); sel.value = 'dimWH'; sel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(5);
  ok(/Diminished \(whole–half\)/.test(g2.querySelector('h2').textContent) && /W H W H/.test(g2.textContent) && g2.querySelector('.sc-info dt'), 'the glossary shows a scale, its step pattern and notes');
  g2.querySelector('[data-pos="1"]').click(); await sleep(5);
  ok(g2.querySelector('.fb-mark.ghost') && g2.querySelector('.fb-dim'), 'a position dims the rest of the neck');
  window.__finish();
})().catch(e => { console.log('TEST ERROR', e && e.stack || e); window.__finish(); });
