// Home: what to do today. In order of use: today's lesson (chosen by the coach),
// your courses, this week's practice (with the free-practice timer and "Log
// practice"), shortcuts to explore, and the Track of the Day. Discovery (master
// classes, the Technique library, the Artist series, the exercise library) lives
// on Practice; history (calendar, skill levels) lives on Profile.
// The track and the lesson card are mounted once, so re-rendering the rest never
// stops the music or resets a time you picked.
import { esc, fmtMinutes, fmtClock, toast } from '../core/util.js';
import { Store, Practice } from '../core/store.js';
import { wikiTile, hydrateImages } from '../core/wiki.js';
import { GENRES, GENRE_BY_ID } from '../data/catalog.js';
import { createCourse, suggestedDifficulty, tierName } from '../core/courses.js';
import { Shell } from '../ui/shell.js';
import { progressPct } from '../core/progression.js';
import { estimatedCount } from './reassess.js';
import { mountTrackCard } from '../ui/trackcard.js';
import { mountRoutineBuilder } from '../ui/routinebuilder.js';
import { forYou, isMaster, MASTER_BY_ID } from '../core/master.js';
import { openMasterSheet, topicArtHTML, MC_ICON } from '../ui/mastersheet.js';
import { weekStripHTML, openManualLog } from '../ui/practicehistory.js';

export function mountDashboard(root, { navigate, courseId = null, skillId = null }) {
  const p = Store.profile;
  let tick = null;
  // Two columns on wide screens (main: lesson and courses; side: this week, explore,
  // track); one column, in the same order, on phones.
  root.innerHTML = `<div data-r="head"></div>
    <div class="dash-cols">
      <div class="dash-main"><section class="card routine-cta" data-r="routine"></section><div data-r="main"></div></div>
      <div class="dash-side"><div data-r="side"></div><section class="card track" data-r="track"></section></div>
    </div>`;
  const head = root.querySelector('[data-r="head"]'), main = root.querySelector('[data-r="main"]'), side = root.querySelector('[data-r="side"]');
  let builder = null;

  function render() {
    const st = Practice.stats(p), act = Practice.active();
    const open = p.courses.filter(c => c.status !== 'archived');
    const name = p.questionnaire.name || 'there';
    const hour = new Date().getHours(), greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const est = estimatedCount(p);

    head.innerHTML = `
      <div class="dash-head"><div><div class="label">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1>${greet}, ${esc(name)}.</h1></div>
        <div class="streak-badge ${st.streak ? 'hot' : ''}" title="Days in a row with 15+ minutes"><b>${st.streak}</b><span>day${st.streak === 1 ? '' : 's'}<br>streak</span></div></div>
      ${est ? `<a class="slimnote" href="#/reassess"><span><b>Finish your assessment</b> <span class="muted">· ${est} skill area${est > 1 ? 's' : ''} still estimated, so lessons may start too easy</span></span><span class="go">Continue ›</span></a>` : ''}`;

    main.innerHTML = `
      <section class="card">
        <div class="sec-head"><h3>Your courses</h3><button class="btn sm" data-d="newcourse">+ New course</button></div>
        ${open.length ? `<div class="courselist">${open.map(courseRow).join('')}</div>` : '<p class="muted small">No courses yet. A course turns your style and level into a full learning path.</p>'}
      </section>`;

    side.innerHTML = `
      <section class="card weekcard ${act ? 'live' : ''}">
        <div class="sec-head"><h3>This week</h3><a class="link small" href="#/profile">History →</a></div>
        <div class="wk-sum"><div><b>${fmtMinutes(st.week)}</b><span class="small muted">this week</span></div><div><b class="${st.practicedToday >= 15 ? 'ok' : ''}">${fmtMinutes(st.practicedToday)}</b><span class="small muted">today</span></div><div><b>${st.best}</b><span class="small muted">best streak</span></div></div>
        ${weekStripHTML(st)}
        ${act ? liveSession(act, open) : `<div class="row wk-actions"><button class="btn" data-d="start">⏱ Start timer</button><button class="btn ghost" data-d="manual">+ Log practice</button></div>
          <p class="small muted wk-hint">Jamming or playing songs? Run the timer so it counts toward your streak.</p>`}
      </section>
      ${exploreHTML()}`;
    hydrateImages(main); hydrateImages(side);
    if (builder) builder.refresh();
    clearInterval(tick);
    if (act) tick = setInterval(() => { const c = side.querySelector('[data-r="clock"]'); if (c) c.textContent = fmtClock(Practice.elapsedSec()); }, 1000);
  }

  function liveSession(act, open) {
    return `<div class="wk-live"><div class="label">Free practice in progress</div>
      <div class="live-clock" data-r="clock">${fmtClock(Practice.elapsedSec())}</div>
      ${open.length ? `<label class="mini">Counts toward</label><select data-r="sesscourse"><option value="">Free practice</option>${open.map(c => `<option value="${c.id}" ${c.id === act.courseId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
      <div class="row"><button class="btn primary" data-d="finish">Finish & log</button><button class="btn" data-d="tools">Open tools</button></div>
      <button class="linkbtn small" data-d="discard">Discard this session</button></div>`;
  }

  /** Shortcuts to the learning areas; the master class for your biggest need comes first. */
  function exploreHTML() {
    const fy = forYou(p)[0];
    return `<section class="card explore">
      <div class="sec-head"><h3>Explore</h3><a class="link small" href="#/practice">Practice →</a></div>
      ${fy ? `<button class="ex-row" data-mc="${esc(fy.topic.id)}">${topicArtHTML(fy.topic.cat, 'sm')}<span class="ex-txt"><span class="label">Master class for you</span><b>${esc(fy.topic.title)}</b></span><span class="mc-go">›</span></button>` : ''}
      <a class="ex-row" href="#/techniques"><span class="ex-ic" aria-hidden="true">🎯</span><span class="ex-txt"><b>Technique library</b><span class="small muted">Beginner to mastery paths</span></span><span class="mc-go">›</span></a>
      <a class="ex-row" href="#/artist"><span class="ex-ic" aria-hidden="true">🎸</span><span class="ex-txt"><b>Artist series</b><span class="small muted">Signature techniques of great players</span></span><span class="mc-go">›</span></a>
    </section>`;
  }

  function courseRow(c) {
    if (c.tree) c.progress = progressPct(c);
    const g = !isMaster(c) && GENRE_BY_ID[c.genre];
    const art = isMaster(c) ? topicArtHTML(c.topic && c.topic.cat, 'thumb') : wikiTile(g ? g.wiki : c.genre, g ? g.name : c.genre, 'thumb');
    const sub = isMaster(c) ? `${MC_ICON} Master class · level ${c.difficulty}` : `${esc(g ? g.name : c.genre)} · level ${c.difficulty}`;
    return `<a class="course ${isMaster(c) ? 'master' : ''}" href="#/course/${c.id}">${art}
      <div class="cbody"><b>${esc(c.name)}</b><div class="muted small">${sub}</div>
        <div class="cprog"><div class="bar"><i style="width:${c.progress || 0}%"></i></div><span>${c.progress || 0}%</span></div></div></a>`;
  }

  function newCourseSheet() {
    const q = p.questionnaire;
    const order = [...q.genres, ...GENRES.map(g => g.id).filter(id => !q.genres.includes(id))];
    let genreId = order[0], style = null, difficulty = suggestedDifficulty(p, genreId), busy = false;
    const sheet = Shell.sheet('<div data-r="body"></div>');
    const draw = () => {
      const g = GENRE_BY_ID[genreId]; style = style && g.styles.includes(style) ? style : g.styles[0];
      const players = q.players.filter(pl => (pl.genres || []).includes(genreId));
      sheet.el.querySelector('[data-r="body"]').innerHTML = `
        <h2>New course</h2>
        <div class="field"><label>Genre</label><div class="tiles small">${order.map(id => { const x = GENRE_BY_ID[id]; return `<button class="tile ${id === genreId ? 'on' : ''}" data-g="${id}">${wikiTile(x.wiki, x.name)}<span class="tile-name">${esc(x.name)}</span><span class="tick">✓</span></button>`; }).join('')}</div></div>
        <div class="field"><label>Style focus</label><div class="chips">${g.styles.map(s => `<button class="chip ${s === style ? 'on' : ''}" data-st="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>
        <div class="field"><label>Difficulty: <b>${difficulty}/10 · ${tierName(difficulty)}</b></label>
          <input type="range" min="1" max="10" value="${difficulty}" data-r="diff" aria-label="Difficulty">
          <p class="muted small">Suggested from your ${g.name} skill levels: ${suggestedDifficulty(p, genreId)}.</p></div>
        ${players.length ? `<p class="small">Inspired by: ${players.map(x => esc(x.name)).join(', ')}</p>` : ''}
        <button class="btn primary block" data-r="create" ${busy ? 'disabled' : ''}>${busy ? 'Naming your course…' : 'Create course'}</button>`;
      hydrateImages(sheet.el);
    };
    sheet.el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.g) { genreId = b.dataset.g; difficulty = suggestedDifficulty(p, genreId); draw(); }
      else if (b.dataset.st) { style = b.dataset.st; draw(); }
      else if (b.dataset.r === 'create' && !busy) {
        busy = true; draw();
        const players = q.players.filter(pl => (pl.genres || []).includes(genreId)).map(x => x.name).slice(0, 3);
        const c = await createCourse(p, { genreId, style, difficulty, players });
        Store.save(); sheet.close(); toast(`Created “${c.name}”.`); render();
      }
    });
    sheet.el.addEventListener('input', e => { if (e.target.dataset.r === 'diff') { difficulty = +e.target.value; draw(); } });
    draw();
  }

  const onChange = e => {
    if (e.target.dataset.r !== 'sesscourse') return;
    const s = Practice.active(); if (!s) return;
    const c = p.courses.find(x => x.id === e.target.value);
    Practice.start({ ...s, courseId: c ? c.id : null, genre: c ? c.genre : s.genre });
  };
  const onClick = e => {
    const mc = e.target.closest('[data-mc]');
    if (mc) { const t = MASTER_BY_ID[mc.dataset.mc]; if (t) openMasterSheet({ title: t.title, topicId: t.id, cat: t.cat, domain: t.domain }, { navigate }); return; }
    const b = e.target.closest('button'); if (!b) return;
    switch (b.dataset.d) {
      case 'start':
        Practice.start({ source: 'free', courseId: null, genre: p.questionnaire.genres[0] || null });
        render(); return;
      case 'finish': {
        const entry = Practice.stop(p);
        if (entry && !entry.discarded) {
          const c = entry.courseId && p.courses.find(x => x.id === entry.courseId); if (c) c.lastPracticed = entry.date;
          Store.save(); toast(`Logged ${fmtMinutes(entry.minutes)}. Nice work.`);
        } else toast('Under 30 seconds, so nothing was logged.');
        render(); return;
      }
      case 'discard': if (confirm('Discard this session without logging it?')) { Practice.discard(); render(); } return;
      case 'tools': navigate('#/tools'); return;
      case 'newcourse': newCourseSheet(); return;
      case 'manual': openManualLog(p, render); return;
    }
  };
  root.addEventListener('click', onClick); root.addEventListener('change', onChange);
  builder = mountRoutineBuilder(root.querySelector('[data-r="routine"]'), { navigate, courseId, skillId });
  render();
  const offTrack = mountTrackCard(root.querySelector('[data-r="track"]'));
  return () => { clearInterval(tick); offTrack(); builder.destroy(); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); };
}
