// The ask box: the built-in match first (diminished scale → the scale, not chords), "Not what you were
// looking for?" hands off to Claude, and topics the knowledge base lacks go to the research queue.
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
  // with a key: the built-in match comes first (no API call), then Claude when asked
  let calls = 0, lastPrompt = '';
  Claude.hasKey = () => true;
  Claude.json = async ({ content }) => { calls++; lastPrompt = content; return { summary: 'Claude: symmetrical diminished runs.', exercises: [{ role: 'main', name: 'Diminished runs up the neck', domain: 'fretboard', why: 'w', instr: 'i', watch: 'w', simplify: 's', unit: '8ths', level: 5, startBpm: 60, goalBpm: 100, minutes: 5, tab: { step: 0.5, notes: [[5, 3], [5, 5], [5, 6], [4, 3], [4, 5], [4, 6]] } }] }; };
  const b = await generateExercises(p, 'diminished scale please');
  ok(b.source === 'local' && calls === 0, 'with a key the built-in match still comes first (no API cost)');
  const c = await generateExercises(p, 'diminished scale please', { mode: 'claude', rejected: b.summary });
  ok(c.source === 'claude' && calls === 1 && /NOT what they meant/.test(lastPrompt), 'asking Claude tells it what missed');
  const d = await generateExercises(p, 'diminished scale please');
  ok(d.source === 'cache' && calls === 1, 'next time the same request reuses Claude’s answer');
  // the UI
  location.hash = '#/practice'; window.dispatchEvent(new HashChangeEvent('hashchange')); await sleep(80);
  const view = document.getElementById('view');
  const ta = view.querySelector('[data-r="ask"]'); ta.value = 'harmonic minor sweeps in E'; ta.dispatchEvent(new Event('input', { bubbles: true }));
  view.querySelector('[data-ask="go"]').click(); await sleep(150);
  const nw = view.querySelector('[data-ask="claude"]');
  ok(nw && /Not what you were looking for/.test(nw.textContent), 'a built-in answer offers “Not what you were looking for?”');
  const before = calls;
  nw.click(); await sleep(150);
  ok(calls === before + 1 && /Diminished runs/.test(view.querySelector('.askresult').textContent), 'clicking it shows Claude’s exercises');
  ok(p.kbRequests.some(x => /harmonic minor sweeps/i.test(x.text)) && view.querySelector('.kbgap.done'), 'and the topic goes to the research queue');
  // unknown topic: queued automatically
  Claude.hasKey = () => false;
  const ta2 = view.querySelector('[data-r="ask"]'); ta2.value = 'slide guitar in open G'; ta2.dispatchEvent(new Event('input', { bubbles: true }));
  view.querySelector('[data-ask="go"]').click(); await sleep(150);
  ok(p.kbRequests.some(x => /slide guitar/i.test(x.text)) && /added to the research queue/.test(view.querySelector('.askresult').textContent), 'a topic the app doesn’t teach is queued for research automatically');
  view.querySelector('[data-ask="unqueue"]').click(); await sleep(10);
  ok(!p.kbRequests.some(x => /slide guitar/i.test(x.text)), 'and Undo removes it');
  window.__finish();
})().catch(e => { console.log('TEST ERROR', e && e.stack || e); window.__finish(); });
