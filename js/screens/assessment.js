// Adaptive skill assessment UI (ported from v1, now using the shared metronome).
import { esc, toast, clamp } from '../core/util.js';
import { Store } from '../core/store.js';
import { Audio } from '../core/audio.js';
import { Metronome, mountMetronome } from '../tools/metronome.js';
import { DOMAINS, Assessment, Leveling, TEST_BY_ID, testsFor, buildQuiz, Timer, chordSVG, patternHTML } from '../assessment/engine.js';
import { Shell } from '../ui/shell.js';

export function mountAssessment(root, profile, { startDomain = 0, onDone, onBack, only = null, maxTests = 3, persist = null, continueMode = false }) {
  const LIST = only ? DOMAINS.filter(d => only.includes(d.key)) : DOMAINS;
  let dIdx = Math.min(startDomain, LIST.length - 1), ui = {}, quiz = null, offMetro = null;
  const saveDraft = persist ? () => persist(dIdx) : () => Store.draft.set({ profile, phase: 'assessment', dIdx });
  const nextLabel = () => (dIdx >= LIST.length - 1 ? (continueMode ? 'Finish & update levels →' : 'Finish →') : 'Next domain →');
  const nextDomain = () => { if (dIdx >= LIST.length - 1) return finish(); dIdx++; go(); };

  function teardown() {
    Metronome.stop(); Timer.stopTimers(); Timer.onTick = null; Timer.onDone = null;
    if (offMetro) { offMetro(); offMetro = null; }
  }
  function go() { teardown(); saveDraft(); render(); window.scrollTo(0, 0); }

  function render() {
    const d = LIST[dIdx], pct = Math.round(dIdx / LIST.length * 100);
    let html = `<div class="label">${continueMode ? 'Continue assessment' : 'Assessment'} · ${dIdx + 1} of ${LIST.length}</div><div class="progress"><i style="width:${pct}%"></i></div>
      <h2>${d.name}</h2><p class="muted">${d.blurb}</p>`;
    if (d.key === 'repertoire') {
      root.innerHTML = html + repertoireHTML();
      Shell.actions(`<button class="btn" data-as="back">← Back</button><button class="btn primary" data-as="finish">See my results →</button>`);
      return;
    }
    const ds = Assessment.state(profile, d.key);
    if (continueMode && !ds.continued) {
      ds.continued = true;
      if (ds.skipped || !ds.tests.length) {
        const lv = profile.domains[d.key] ? profile.domains[d.key].level : 0;
        const start = Math.max(lv, Leveling.priors(profile.questionnaire)[d.key]);
        Object.assign(ds, { tests: [], phase: 'test', skipped: false, current: Assessment.startingTest(d.key, start).id });
      } else { ds.phase = 'feedback'; ds.current = ds.tests[ds.tests.length - 1].id; }
      saveDraft();
    }
    if (!ds.current && ds.phase !== 'done') {
      const pri = Leveling.priors(profile.questionnaire);
      ds.current = Assessment.startingTest(d.key, pri[d.key]).id; ds.phase = 'test';
    }
    if (ds.tests.length) html += `<div class="hist">${ds.tests.map(t => `<span class="${Assessment.zone(t.score)}">${esc(t.name)}: ${Math.round(t.score * 100)}%</span>`).join('')}</div>`;
    if (ds.phase === 'done') html += `<section class="card"><h3>Domain complete</h3><p class="muted">${ds.skipped ? 'Skipped. This level is estimated from your answers.' : 'Your edge in this domain is recorded.'}</p>
      <button class="btn block" data-as="redo">Redo this domain</button><button class="btn primary block" data-as="dnext">${nextLabel()}</button></section>`;
    else if (ds.phase === 'feedback') html += feedbackHTML(d.key);
    else { const t = TEST_BY_ID[ds.current]; html += t.type === 'play' ? playHTML(t) : quizHTML(t); }
    root.innerHTML = html;
    Shell.actions(`<button class="btn" data-as="back">← Back</button><button class="btn" data-as="skip">${ds.phase === 'done' ? nextLabel() : 'Skip domain'}</button>`);
    afterRender();
  }

  function playHTML(t) {
    if (ui.testId !== t.id) {
      ui = { testId: t.id, resultVal: t.input.type === 'bpm' ? t.metro.bpm : (t.input.type === 'count' ? 0 : null), rating: null };
      Metronome.configure({ bpm: t.metro.bpm, mode: t.metro.mode || 'all', backing: t.metro.backing || null, beatsPerBar: 4, subdiv: 1 });
    }
    const i = t.input;
    let input;
    if (i.type === 'rating') input = `<div class="rubric">${i.rubric.map((r, k) => `<button class="${ui.rating === k + 1 ? 'on' : ''}" data-rating="${k + 1}"><span class="n">${k + 1}</span><span>${esc(r)}</span></button>`).join('')}</div>`;
    else if (i.type === 'bpm') input = `<div class="stepper"><button data-step="-5">−5</button><button data-step="-1">−1</button><input type="number" inputmode="numeric" data-r="result" value="${ui.resultVal}"><button data-step="1">+1</button><button data-step="5">+5</button></div>
      <div class="unit">BPM</div><button class="btn sm block" data-as="usebpm">Use current metronome BPM</button>`;
    else input = `<div class="stepper s1"><button data-step="-1">−</button><input type="number" inputmode="numeric" data-r="result" value="${ui.resultVal}"><button data-step="1">+</button></div><div class="unit">${esc(i.unit)} · max ${i.max}</div>`;
    return `<section class="card">
      <div class="label">Level ${t.level} test</div><h3>${esc(t.name)}</h3><p class="why">${esc(t.why)}</p>
      <div class="instr">${esc(t.instr)}</div>
      ${t.chords ? `<div class="diagrams">${t.chords.map(chordSVG).join('')}</div>` : ''}
      ${t.pattern ? patternHTML(t.pattern) : ''}
      ${t.tab ? `<pre class="tab">${esc(t.tab)}</pre>` : ''}
      <div class="watch">⚠ Watch for: ${esc(t.watch)}</div>
      <div data-r="metro"></div>
      ${t.timer ? `<div class="timer"><div class="time" data-r="tval">${t.timer}</div><div class="status" data-r="tstatus">Starts the click, then a 1-bar count-in</div>
        <div class="row"><button class="btn primary" data-as="tstart">▶ Start ${t.timer}-s test</button><button class="btn" data-as="treset">Reset</button></div></div>` : ''}
      <div class="field"><label>${i.type === 'rating' ? 'Rate the run' : esc(i.label)}</label>${input}</div>
      <button class="btn primary block" data-as="submit">Save result</button></section>`;
  }

  function quizHTML(t) {
    if (!quiz || quiz.testId !== t.id) {
      return `<section class="card"><div class="label">Level ${t.level} ${t.audio ? 'ear' : 'quiz'} test</div><h3>${esc(t.name)}</h3><p class="why">${esc(t.why)}</p>
        <p>${t.audio ? '8 questions. Each one plays audio; tap Replay as often as you need. Headphones recommended.' : (t.gen ? '8 questions, auto-scored.' : '5 questions, auto-scored.')}</p>
        <button class="btn primary block" data-as="qstart" data-id="${t.id}">Start</button></section>`;
    }
    const q = quiz.qs[quiz.idx], ans = quiz.answered;
    const opts = q.options.map(o => { let cls = 'opt'; if (ans != null) { if (o === q.answer) cls += ' right'; else if (o === ans) cls += ' wrong'; } return `<button class="${cls}" data-answer="${esc(o)}" ${ans != null ? 'disabled' : ''}>${esc(o)}</button>`; }).join('');
    return `<section class="card"><div class="qhead"><span>${esc(t.name)}</span><span>Q ${quiz.idx + 1} of ${quiz.qs.length} · ${quiz.correct} correct</span></div>
      <div class="progress"><i style="width:${Math.round(quiz.idx / quiz.qs.length * 100)}%"></i></div>
      <div class="qtext">${esc(q.prompt)}</div>
      ${q.audio ? '<button class="btn playbig" data-as="replay">🔊 Replay</button>' : ''}
      <div class="opts ${q.options.length <= 2 || q.options.some(o => o.length > 22) ? 'one' : ''}">${opts}</div>
      ${ans != null ? `<p style="margin-top:12px">${ans === q.answer ? '✓ Correct.' : `✗ It was <b>${esc(q.answer)}</b>.`}</p><button class="btn primary block" data-as="qnext">${quiz.idx === quiz.qs.length - 1 ? 'Finish test' : 'Next question →'}</button>` : ''}
    </section>`;
  }

  function feedbackHTML(key) {
    const ds = Assessment.state(profile, key), last = ds.tests[ds.tests.length - 1], z = Assessment.zone(last.score), nx = Assessment.next(profile, key, maxTests);
    if (continueMode && nx.stop && z !== 'fail') {
      const tried = new Set(ds.tests.map(t => t.id)), top = Math.max(...ds.tests.map(t => t.level));
      const harder = testsFor(key).find(t => t.level > top && !tried.has(t.id));
      if (harder && ds.tests.length < maxTests) { nx.offer = harder; nx.dir = 'harder'; nx.stop = false; }
    }
    const verdict = { pass: 'Comfortable: above your edge zone. Let’s push to find where it gets hard.', edge: 'Edge zone found (70–90%). This is exactly where practice pays off.', fail: 'Below 70%: too big a jump right now. Let’s find solid ground.' }[z];
    const actions = nx.offer
      ? `<button class="btn primary block" data-as="nexttest" data-id="${nx.offer.id}">${nx.dir === 'harder' ? 'Try the harder test' : 'Try the easier test'}: ${esc(nx.offer.name)}</button><button class="btn block" data-as="ddone">Stop here · ${nextLabel()}</button>`
      : `<p class="muted">${esc(nx.why)}</p><button class="btn primary block" data-as="ddone">${nextLabel()}</button>`;
    return `<section class="card verdict ${z}"><div class="label">Result</div><h3>${esc(last.name)}</h3>
      <div class="bigres">${esc(last.display)}</div><p class="muted">Target ${esc(last.targetText)} · score ${Math.round(Math.min(last.score, 1) * 100)}%</p>
      <p>${verdict}</p>${actions}<button class="btn ghost block sm" data-as="retry">Redo this test</button></section>`;
  }

  function repertoireHTML() {
    const songs = profile.repertoire;
    if (!songs.length) songs.push({ title: '', difficulty: 'easy', status: 'solid' });
    return `<section class="card"><p>List songs you can play start to finish, plus anything you’re learning. Difficulty is relative to you.</p>
      ${songs.map((s, i) => `<div class="song">
        <div class="top"><input type="text" data-song="${i}" value="${esc(s.title)}" placeholder="Song — Artist"><button class="btn sm" data-songdel="${i}" aria-label="Remove song">✕</button></div>
        <div class="seg s3">${['easy', 'medium', 'hard'].map(v => `<button class="${s.difficulty === v ? 'on' : ''}" data-songset="${i}" data-f="difficulty" data-val="${v}">${v}</button>`).join('')}</div>
        <div class="seg s3">${['learning', 'solid', 'mastered'].map(v => `<button class="${s.status === v ? 'on' : ''}" data-songset="${i}" data-f="status" data-val="${v}">${v}</button>`).join('')}</div>
      </div>`).join('')}
      <button class="btn block" data-as="songadd">+ Add song</button>
      <p class="muted small" style="margin-top:12px">No full songs yet? Leave it blank; your first song becomes part of the plan.</p></section>`;
  }

  function afterRender() {
    const slot = root.querySelector('[data-r="metro"]');
    if (slot) offMetro = mountMetronome(slot, { compact: false });
    const tv = root.querySelector('[data-r="tval"]');
    if (tv) {
      Timer.onTick = (rem, st) => {
        tv.textContent = Math.ceil(rem); tv.classList.toggle('live', st === 'live' || st === 'count');
        const s = root.querySelector('[data-r="tstatus"]');
        if (s) s.textContent = { count: 'Count-in…', live: 'Go! Count your clean reps.', done: 'Time! Enter your result below.', ready: 'Starts the click, then a 1-bar count-in' }[st] || '';
      };
      Timer.onDone = () => Metronome.stop();
    }
    const rv = root.querySelector('[data-r="result"]');
    if (rv) rv.addEventListener('input', () => { ui.resultVal = rv.value === '' ? null : +rv.value; });
  }

  const key = () => LIST[dIdx].key;
  const current = () => TEST_BY_ID[Assessment.state(profile, key()).current];

  function finish() {
    profile.repertoire = profile.repertoire.filter(s => s.title.trim());
    teardown(); onDone();
  }

  const onClick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    const ds = d.as || d.answer != null || d.rating || d.step || d.songset != null || d.songdel != null ? true : null;
    if (!ds) return;
    switch (d.as) {
      case 'back': if (dIdx === 0) { teardown(); return onBack(); } dIdx--; return go();
      case 'skip': {
        const st = Assessment.state(profile, key());
        if (st.phase !== 'done') { st.phase = 'done'; st.skipped = !st.tests.length; }
        return nextDomain();
      }
      case 'dnext': return nextDomain();
      case 'ddone': { const st = Assessment.state(profile, key()); st.phase = 'done'; st.skipped = false; return nextDomain(); }
      case 'redo': profile.assessment.domains[key()] = { tests: [], current: null, phase: 'test', skipped: false }; quiz = null; return go();
      case 'nexttest': { const st = Assessment.state(profile, key()); st.current = d.id; st.phase = 'test'; quiz = null; return go(); }
      case 'retry': { const st = Assessment.state(profile, key()); const last = st.tests.pop(); st.current = last.id; st.phase = 'test'; quiz = null; ui = {}; return go(); }
      case 'tstart': { const t = current(); if (!Metronome.running) Metronome.start(); Timer.start(t.timer, Math.round(4 * 60 / Metronome.bpm * 1000)); return; }
      case 'treset': return Timer.reset(current().timer);
      case 'usebpm': { ui.resultVal = Metronome.bpm; root.querySelector('[data-r="result"]').value = Metronome.bpm; return; }
      case 'submit': {
        const t = current(); let v;
        if (t.input.type === 'rating') { if (!ui.rating) return toast('Tap a rating first.'); v = ui.rating; }
        else { const el = root.querySelector('[data-r="result"]'); v = el && el.value !== '' ? +el.value : ui.resultVal; if (v == null || isNaN(v)) return toast('Enter your result first.'); v = clamp(Math.round(v), 0, t.input.max || 999); }
        const res = Assessment.scorePlay(t, v); res.raw = v;
        Assessment.record(profile, key(), t, res); ui = {}; return go();
      }
      case 'qstart': { const t = TEST_BY_ID[d.id]; quiz = { testId: t.id, qs: buildQuiz(t), idx: 0, correct: 0, answered: null }; render(); if (t.audio) Audio.play(quiz.qs[0].audio); return; }
      case 'replay': { const q = quiz && quiz.qs[quiz.idx]; if (q && q.audio) Audio.play(q.audio); return; }
      case 'qnext': {
        const t = TEST_BY_ID[quiz.testId];
        if (quiz.idx < quiz.qs.length - 1) { quiz.idx++; quiz.answered = null; render(); if (t.audio) Audio.play(quiz.qs[quiz.idx].audio); return; }
        Assessment.record(profile, key(), t, { score: quiz.correct / quiz.qs.length, display: `${quiz.correct}/${quiz.qs.length} correct`, targetText: '90%+', raw: quiz.correct });
        quiz = null; return go();
      }
      case 'songadd': profile.repertoire.push({ title: '', difficulty: 'easy', status: 'learning' }); saveDraft(); return render();
      case 'finish': return finish();
    }
    if (d.answer != null && quiz && quiz.answered == null) { quiz.answered = d.answer; if (d.answer === quiz.qs[quiz.idx].answer) quiz.correct++; return render(); }
    if (d.rating) { ui.rating = +d.rating; root.querySelectorAll('.rubric button').forEach(x => x.classList.toggle('on', +x.dataset.rating === ui.rating)); return; }
    if (d.step) { const t = current(); ui.resultVal = clamp((+ui.resultVal || 0) + Number(d.step), 0, t.input.max || 999); root.querySelector('[data-r="result"]').value = ui.resultVal; return; }
    if (d.songset != null) { profile.repertoire[+d.songset][d.f] = d.val; saveDraft(); return render(); }
    if (d.songdel != null) { profile.repertoire.splice(+d.songdel, 1); saveDraft(); return render(); }
  };
  const onInput = e => { if (e.target.dataset.song != null) { profile.repertoire[+e.target.dataset.song].title = e.target.value; saveDraft(); } };
  const barClick = e => { if (e.target.closest('[data-as]')) onClick(e); };
  root.addEventListener('click', onClick); root.addEventListener('input', onInput);
  Shell.actionBar.addEventListener('click', barClick);
  saveDraft(); render();
  return () => { teardown(); root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); Shell.actionBar.removeEventListener('click', barClick); Shell.actions(''); };
}
