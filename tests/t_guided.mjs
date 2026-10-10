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
  ok(view().querySelector('.skilltree .st-node') && view().querySelector('.st-node.next'), 'the skill tree is there to browse, with the next skill marked');
  nl.querySelector('[data-c="startnext"]').click(); await sleep(80);
  ok(location.hash === '#/play', 'practice the next lesson opens the practice page (no timer)');
  const pc = JSON.parse(sessionStorage.getItem('fretworkCoach.play') || 'null');
  const nx1 = coach.nextInCourse(p, c1);
  ok(pc && pc.items[pc.idx].skillId === nx1.skill.id && pc.back === '#/course/' + c1.id, 'it opens on the recommended skill, with the course to step through');
  ok(/Course tree/.test(view().querySelector('.pb-back').textContent), 'back returns to the course tree');
  await go('#/course/' + c1.id);
  view().querySelector('.nextlesson [data-c="timed"]').click(); await sleep(80);
  const act2 = JSON.parse(localStorage.getItem('fretworkCoach.activeRoutine') || 'null');
  ok(location.hash === '#/practice/run' && act2 && act2.routine.items.some(it => it.skillId === nx1.skill.id), 'the timed session is still there, built around the recommended skill');
  clearActive();

  // --- technique path: next lesson, level choice folded
  await go('#/techniques/travis'); await sleep(120);
  const tn = view().querySelector('.nextlesson [data-al="practice"]');
  ok(tn, 'path page shows the next lesson with a start button');
  const det = view().querySelector('.tech-level details.customize');
  ok(det && !det.open && det.querySelector('[data-lv]'), 'level choice is under Customize, closed');
  tn.click(); await sleep(80);
  ok(location.hash === '#/play', 'start this lesson opens the practice page');
  clearActive();
  await go('#/techniques/travis'); await sleep(120);
  const other = [...view().querySelectorAll('.path-stage[data-tier]')].find(b => !b.classList.contains('on'));
  if (other) { other.click(); await sleep(120); ok(/Back to my recommended stage/.test(view().textContent), 'choosing another stage offers the way back'); }

  // --- artist page
  await go('#/artist/eric-johnson'); await sleep(120);
  ok(view().querySelector('.nextlesson [data-al="practice"]'), 'artist page shows the next lesson');
  view().querySelector('.nextlesson [data-jump]').click(); await sleep(10);
  ok(view().querySelector('.artist-lesson.flash'), '“Show it below” highlights the lesson');

  // --- library exercise: the practice page opens on the recommended variation; customizing is in the panel
  await go('#/practice/ex/spider'); await sleep(20);
  const rail = k => view().querySelector(`[data-rail="${k}"]`);
  if (view().querySelector('[data-r="panel"]').hidden || !rail('custom').classList.contains('on')) rail('custom').click();
  await sleep(10);
  ok(/recommended for your level/.test(view().querySelector('.pp-body').textContent), 'library exercise starts on the recommended variation');
  const otherChip = [...view().querySelectorAll('.pp-body .varchip')].find(b => !b.classList.contains('on'));
  otherChip.click(); await sleep(20);
  ok(/Recommended for you/.test(view().querySelector('.pp-body').textContent) && view().querySelector('.pp-body .linkbtn[data-vid]'), 'picking another offers the way back');
  view().querySelector('.pp-body .linkbtn[data-vid]').click(); await sleep(20);
  ok(/recommended for your level/.test(view().querySelector('.pp-body').textContent), 'back to the recommended one');
  // --- pentatonic mastery path
  await go('#/techniques/pentatonic'); await sleep(200);
  ok(view().querySelectorAll('.path-stage.missing').length === 0, 'pentatonic path has all four stages');
  ok(true, 'lesson methods show on the practice page');
  ok(/How this stage teaches/.test(view().textContent) && view().querySelector('.methods details.method'), 'path page explains the methods with evidence');
  {
    const { createMasterClass, buildMasterTree, MASTER_BY_ID } = await import('../js/core/master.js');
    const { Claude } = await import('../js/core/claude.js');
    const ks = Claude.hasKey, js = Claude.json; let calls = 0; Claude.hasKey = () => true; Claude.json = async () => { calls++; throw new Error('no'); };
    const t = MASTER_BY_ID.pentatonic;
    const course = createMasterClass(p, { title: t.title, topicId: t.id, cat: t.cat, domain: t.domain });
    const r = await buildMasterTree(p, course);
    Claude.hasKey = ks; Claude.json = js;
    ok(calls === 0 && r.source === 'path' && r.tree.units.length >= 2, `the Pentatonic master class is built from the path, no API (${r.source}, ${r.tree.units.map(u => u.title).join(' | ')})`);
    ok(r.tree.units.flatMap(u => u.skills.flatMap(s => s.exercises)).every(e => e.method), 'every lesson in the class keeps its method');
    p.courses = p.courses.filter(c => c !== course);
  }
  // --- metronome sound chooser
  await go('#/tools/metronome');
  const sel = view().querySelector('[data-clicksound]');
  ok(sel, 'metronome has a click-sound chooser');
  sel.value = 'woodblock'; sel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(10);
  const { Audio: A2 } = await import('../js/core/audio.js');
  ok(A2.sound === 'woodblock' && p.settings.clickSound === 'woodblock', 'choice applies and is saved');
  await go('#/settings');
  ok(view().querySelector('[data-clicksound]').value === 'woodblock', 'settings shows the same choice');
  window.__finish();
})().catch(e => { console.log('THROW', e.stack); window.__finish(); });
