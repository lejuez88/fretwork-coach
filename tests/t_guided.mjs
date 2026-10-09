// Guided lessons: the app picks the lesson (with reasons) and customizing is optional.
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
  const go = async h => { const before = errors.length; location.hash = h; window.dispatchEvent(new HashChangeEvent('hashchange')); await sleep(80); ok(errors.length === before, `${h}: ${errors.slice(before).join(' | ')}`); };
  const view = () => document.getElementById('view');
  const { Store } = await import('../js/core/store.js');
  const coach = await import('../js/core/coach.js');
  const prog = await import('../js/core/progression.js');
  const p = Store.profile;
  const clearActive = () => localStorage.removeItem('fretworkCoach.activeRoutine');

  // --- the coach's choices
  const rec = coach.recommendSession(p);
  ok(rec && rec.course && rec.reasons.length && rec.minutes >= 5, 'today’s lesson has a course, reasons and a length: ' + (rec && rec.reasons.join(' / ')));
  const c0 = p.courses.find(c => c.tree) || rec.course;
  prog.ensureState(c0, p);
  const sk = prog.activeSkills(c0)[0];
  if (sk) {
    const es = c0.state.exercises[sk.exercises[0].id];
    const keep = JSON.stringify(es);
    es.stalled = true; es.history = [{ date: '2026-10-01', tempo: 60, clean: false }];
    const nx = coach.nextInCourse(p, c0);
    ok(nx && nx.kind === 'stalled' && nx.skill === sk, 'a stalled skill comes first: ' + (nx && nx.kind));
    const r2 = coach.recommendSession(p);
    ok(r2.course === c0 && /stalled/i.test(r2.reasons.join(' ')), 'the course with a stalled exercise is chosen today');
    Object.assign(es, JSON.parse(keep)); es.stalled = false;
  }
  const L = [{ key: 'kb:t:a', ex: { goalBpm: 100 } }, { key: 'kb:t:b', ex: { goalBpm: 100 } }, { key: 'kb:t:c', ex: { goalBpm: 100 } }];
  p.varState = p.varState || {};
  ok(coach.nextLesson(p, L).index === 0, 'path: first untouched lesson');
  p.varState['kb:t:a~base'] = { mastered: true, history: [{}] };
  p.varState['kb:t:c~base'] = { mastered: false, history: [{}], best: 70, lastDate: '2026-10-01' };
  ok(coach.nextLesson(p, L).index === 2, 'path: a started lesson is continued before new ones');
  p.varState['kb:t:b~base'] = { mastered: false, stalled: true, history: [{}], best: 60 };
  ok(coach.nextLesson(p, L).kind === 'stalled' && coach.nextLesson(p, L).index === 1, 'path: a stalled lesson comes first');
  ['a', 'b', 'c'].forEach(x => delete p.varState[`kb:t:${x}~base`]);

  // --- dashboard: guided by default
  clearActive();
  await go('#/home');
  const card = view().querySelector('[data-r="routine"]');
  ok(card.classList.contains('guided') && /chosen for you/i.test(card.textContent), 'dashboard card is guided');
  ok(card.querySelectorAll('.why-list li').length >= 1, 'it says why');
  ok(card.querySelector('.planbox [data-r="start"]'), 'the plan is ready to start');
  ok(!card.querySelector('[data-course]'), 'course chips are hidden until Customize');
  const total = () => [...card.querySelectorAll('.pmin')].reduce((a, x) => a + parseInt(x.textContent), 0);
  card.querySelector('[data-min="15"]').click(); await sleep(10);
  const t15 = total();
  card.querySelector('[data-min="45"]').click(); await sleep(10);
  ok(t15 <= 16 && total() > t15, `time chips change the plan (${t15} → ${total()} min)`);
  card.querySelector('[data-r="custom"]').click(); await sleep(10);
  ok(card.querySelector('[data-course]') && card.querySelector('[data-r="build"]'), 'Customize shows course, skill and time choices');
  card.querySelector('[data-r="guided"]').click(); await sleep(10);
  ok(card.classList.contains('guided'), '“Let the app choose” goes back');
  card.querySelector('.planbox [data-r="start"]').click(); await sleep(80);
  ok(location.hash === '#/practice/run', 'start opens the runner');
  const act = JSON.parse(localStorage.getItem('fretworkCoach.activeRoutine') || 'null');
  ok(act && act.routine.items.length && act.mode === 'duration', 'a timed lesson is running');
  clearActive();

  // --- course page: next lesson
  const c1 = p.courses.find(c => c.tree);
  await go('#/course/' + c1.id);
  const nl = view().querySelector('.nextlesson');
  ok(nl && /chosen for you/i.test(nl.textContent) && nl.querySelector('[data-c="startnext"]'), 'course page shows the next lesson');
  ok(/practice it instead/.test(view().querySelector('.tree').textContent), 'the tree is there to browse');
  nl.querySelector('[data-c="startnext"]').click(); await sleep(80);
  ok(location.hash === '#/practice/run', 'start next lesson opens the runner');
  const act2 = JSON.parse(localStorage.getItem('fretworkCoach.activeRoutine') || 'null');
  const nx1 = coach.nextInCourse(p, c1);
  ok(act2 && act2.routine.items.some(it => it.skillId === nx1.skill.id), 'the routine is built around the recommended skill');
  clearActive();

  // --- technique path: next lesson, level choice folded
  await go('#/techniques/travis'); await sleep(120);
  const tn = view().querySelector('.nextlesson [data-al="practice"]');
  ok(tn, 'path page shows the next lesson with a start button');
  const det = view().querySelector('.tech-level details.customize');
  ok(det && !det.open && det.querySelector('[data-lv]'), 'level choice is under Customize, closed');
  tn.click(); await sleep(80);
  ok(location.hash === '#/practice/run', 'start this lesson opens the runner');
  clearActive();
  await go('#/techniques/travis'); await sleep(120);
  const other = [...view().querySelectorAll('.path-stage[data-tier]')].find(b => !b.classList.contains('on'));
  if (other) { other.click(); await sleep(120); ok(/Back to my recommended stage/.test(view().textContent), 'choosing another stage offers the way back'); }

  // --- artist page
  await go('#/artist/eric-johnson'); await sleep(120);
  ok(view().querySelector('.nextlesson [data-al="practice"]'), 'artist page shows the next lesson');
  view().querySelector('.nextlesson [data-jump]').click(); await sleep(10);
  ok(view().querySelector('.artist-lesson.flash'), '“Show it below” highlights the lesson');

  // --- library exercise: recommended variation, customizing folded
  await go('#/practice/ex/spider');
  const exv = view().querySelector('.exvar');
  ok(/Recommended for you/.test(exv.textContent), 'library exercise starts on the recommended variation');
  const d2 = exv.querySelector('details.customize');
  ok(d2 && !d2.open, 'variations and key/strings are under Customize');
  const otherChip = [...d2.querySelectorAll('.varchip')].find(b => !b.classList.contains('on'));
  otherChip.click(); await sleep(20);
  const exv2 = view().querySelector('.exvar');
  ok(/Your choice/.test(exv2.textContent) && exv2.querySelector('details.customize').open, 'picking another shows “Your choice” and keeps Customize open');
  exv2.querySelector('.linkbtn[data-vid]').click(); await sleep(20);
  ok(/Recommended for you/.test(view().querySelector('.exvar').textContent), 'back to the recommended one');
  window.__finish();
})().catch(e => { console.log('THROW', e.stack); window.__finish(); });
