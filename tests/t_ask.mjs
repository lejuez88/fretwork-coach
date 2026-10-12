// The ask box: the built-in match first (diminished scale → the scale, not chords), "Not what you were
// looking for?" asks Claude which topic was meant (never for drills), and unresearched topics go to the research queue.
import { Audio } from '../js/core/audio.js';
const ok = window.__ok;
const sleep = ms => new Promise(r => setTimeout(r, ms));
Audio.ctx = { currentTime: 5, state: 'running' }; Audio.guitar = () => {}; Audio.click = () => {}; Audio.strum = () => {};
(async () => {
  await import('../js/app.js'); await sleep(50);
  const { Store } = await import('../js/core/store.js');
  const { Claude } = await import('../js/core/claude.js');
  const { generateExercises } = await import('../js/core/custom.js');
  const { parseRequest } = await import('../js/core/topics.js');
  const p = Store.profile;
  // parsing
  const r = parseRequest('I would like to practice the diminished scale');
  ok(r.scale === 'dimWH' && !r.chordTypes.length, 'the diminished scale is a scale, not diminished chords');
  ok(parseRequest('half-whole diminished over G7').scale === 'dimHW' && parseRequest('whole tone scale').scale === 'wholeTone', 'half–whole and whole tone are recognized');
  ok(parseRequest('diminished chords').chordTypes.includes('dim'), 'diminished chords are still chords');
  // no key: built-in exercises for the scale
  Claude.hasKey = () => false;
  const a = await generateExercises(p, 'I would like to practice the diminished scale');
  ok(a.source === 'local' && a.items.length >= 3 && a.items.every(it => /diminished/i.test(it.ex.name)) && !a.items.some(it => /dim shapes|inversions/i.test(it.ex.name)), 'built-in: diminished scale exercises: ' + a.items.map(i => i.ex.name).join(' / '));
  // with a key: the built-in match comes first (no API call); Claude only identifies the topic
  let calls = 0, lastPrompt = '', reply = { path: null, topic: 'Diminished scale (half–whole)', kind: 'subject', why: 'You meant the symmetrical scale.' };
  Claude.hasKey = () => true;
  Claude.json = async ({ content }) => { calls++; lastPrompt = content; return reply; };
  const b = await generateExercises(p, 'diminished scale please');
  ok(b.source === 'local' && calls === 0, 'with a key the built-in match still comes first (no API cost)');
  const c = await generateExercises(p, 'diminished scale please', { mode: 'claude', rejected: b.summary });
  ok(calls === 1 && /NOT what they meant/.test(lastPrompt) && !/exercises"/.test(lastPrompt), 'asking Claude tells it what missed, and asks only for the topic');
  ok(c.items.length === 0 && c.queue && /half–whole/.test(c.queue.text) && /won’t make up drills/.test(c.summary), 'no researched path: no made-up drills, the precise topic goes to the queue');
  reply = { path: 'vibrato', topic: 'Vibrato', kind: 'technique', why: 'You meant vibrato.' };
  const c2 = await generateExercises(p, 'make my long notes sing', { mode: 'claude' });
  ok(c2.items.length >= 1 && c2.paths && c2.paths.includes('vibrato'), 'a researched path that fits: its lessons');
  // nothing researched, no key: queue and the closest paths, no drills
  Claude.hasKey = () => false;
  const e1 = await generateExercises(p, 'sight reading standard notation');
  ok(e1.items.length === 0 && e1.queue && Array.isArray(e1.paths), 'unknown topic without a key: no drills, queued, closest paths: ' + (e1.paths || []).join(', ') + ' items ' + e1.items.map(i => i.ex.name).join('|') + ' src ' + e1.source);
  Claude.hasKey = () => true;
  reply = { path: null, topic: 'Harmonic minor sweep picking', kind: 'technique', why: '' };
  // the UI
  location.hash = '#/practice'; window.dispatchEvent(new HashChangeEvent('hashchange')); await sleep(80);
  const view = document.getElementById('view');
  const ta = view.querySelector('[data-r="ask"]'); ta.value = 'harmonic minor sweeps in E'; ta.dispatchEvent(new Event('input', { bubbles: true }));
  view.querySelector('[data-ask="go"]').click(); await sleep(150);
  const nw = view.querySelector('[data-ask="claude"]');
  ok(nw && /Not what you were looking for/.test(nw.textContent), 'a built-in answer offers “Not what you were looking for?”');
  const before = calls;
  nw.click(); await sleep(150);
  ok(calls === before + 1 && /won’t make up drills/.test(view.querySelector('.askresult').textContent) && !view.querySelector('.askresult [data-ask="practice"]'), 'clicking it: no made-up drills');
  ok(p.kbRequests.some(x => /harmonic minor sweep/i.test(x.text)) && view.querySelector('.kbgap.done'), 'and the topic Claude named goes to the research queue');
  // unknown topic: queued automatically
  Claude.hasKey = () => false;
  const ta2 = view.querySelector('[data-r="ask"]'); ta2.value = 'slide guitar in open G'; ta2.dispatchEvent(new Event('input', { bubbles: true }));
  view.querySelector('[data-ask="go"]').click(); await sleep(150);
  ok(p.kbRequests.some(x => /slide guitar/i.test(x.text)) && /added to the research queue/.test(view.querySelector('.askresult').textContent), 'a topic the app doesn’t teach is queued for research automatically');
  view.querySelector('[data-ask="unqueue"]').click(); await sleep(10);
  ok(!p.kbRequests.some(x => /slide guitar/i.test(x.text)), 'and Undo removes it');
  window.__finish();
})().catch(e => { console.log('TEST ERROR', e && e.stack || e); window.__finish(); });
