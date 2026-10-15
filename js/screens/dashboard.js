// Home: what to do today. In order of use: today's lesson (chosen by the coach),
// your courses, this week's practice (with the free-practice timer and "Log
// practice"), shortcuts to explore, and the Track of the Day. Discovery (master
// classes, the Technique library, the Artist series, the exercise library) lives
// on Practice; history (calendar, skill levels) lives on Profile.
// The track and the lesson card are mounted once, so re-rendering the rest never
// stops the music or resets a time you picked.
import { esc, fmtMinutes, fmtClock, toast } from '../core/util.js';
import { icon } from '../ui/icons.js';
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
import { tierIdFor, levelInTier } from '../core/tiers.js';
import { tierPickerHTML } from '../ui/tierpicker.js';
import { recommendSession, nextInCourse } from '../core/coach.js';
import { hasActiveRoutine } from './routine.js';
import { openPractice, courseContext } from './play.js';
import { KB_INDEX } from '../data/kb.js';

export function mountDashboard(root, { navigate, courseId = null, skillId = null }) {
  const p = Store.profile;
  if (p && p.guest) return mountGuestHome(root, { navigate });
  let tick = null;
  // Two columns on wide screens (main: lesson and courses; side: this week, explore,
  // track); one column, in the same order, on phones.
  // Guided Path: the greeting, then "continue where you left off" beside this week, then
  // today's path (the node trail), the technique library and your courses; the side column
  // keeps explore and the track of the day. One column, in the same order, on phones.
  root.innerHTML = `<div data-r="head"></div>
    <div class="gp-hero"><div data-r="continue"></div><div class="dash-side gp-week" data-r="week"></div></div>
    <div class="dash-cols">
      <div class="dash-main"><section class="card routine-cta" data-r="routine"></section><div data-r="tech"></div><div data-r="main"></div></div>
      <div class="dash-side"><div data-r="side"></div><section class="card track" data-r="track"></section></div>
    </div>`;
  const head = root.querySelector('[data-r="head"]'), main = root.querySelector('[data-r="main"]'), side = root.querySelector('[data-r="side"]');
  const week = root.querySelector('[data-r="week"]'), cont = root.querySelector('[data-r="continue"]'), tech = root.querySelector('[data-r="tech"]');
  let builder = null;

  function render() {
    const st = Practice.stats(p), act = Practice.active();
    const open = p.courses.filter(c => c.status !== 'archived');
    const name = p.questionnaire.name || 'there';
    const est = estimatedCount(p);
    let mins = null; try { mins = (recommendSession(p) || {}).minutes; } catch { /* no course yet */ }

    head.innerHTML = `
      <div class="dash-head gp-greet"><div><h1>Hey ${esc(name)} 👋</h1><p class="small muted">${open.length && mins ? `Here’s today’s path: about ${mins} minutes.` : 'Pick a path and start playing.'}</p></div></div>
      ${est ? `<a class="slimnote" href="#/reassess"><span><b>Finish your assessment</b> <span class="muted">· ${est} skill area${est > 1 ? 's' : ''} still estimated, so lessons may start too easy</span></span><span class="go">Continue ›</span></a>` : ''}`;

    main.innerHTML = `
      <section class="card">
        <div class="sec-head"><h3>Your courses</h3><button class="btn sm" data-d="newcourse">+ New course</button></div>
        ${open.length ? `<div class="courselist">${open.map(courseRow).join('')}</div>` : '<p class="muted small">No courses yet. A course turns your style and level into a full learning path.</p>'}
      </section>`;

    cont.innerHTML = continueHTML(open);
    tech.innerHTML = techHTML();
    week.innerHTML = `
      <section class="card weekcard ${act ? 'live' : ''}">
        <div class="sec-head"><h3>This week</h3><a class="link small" href="#/profile">History →</a></div>
        <div class="wk-sum"><div><b>${fmtMinutes(st.week)}</b><span class="small muted">this week</span></div><div><b class="${st.practicedToday >= 15 ? 'ok' : ''}">${fmtMinutes(st.practicedToday)}</b><span class="small muted">today</span></div><div><b>${st.best}</b><span class="small muted">best streak</span></div></div>
        ${weekStripHTML(st)}
        ${act ? liveSession(act, open) : `<div class="row wk-actions"><button class="btn" data-d="start">⏱ Start timer</button><button class="btn ghost" data-d="manual">+ Log practice</button></div>
          <p class="small muted wk-hint">Jamming or playing songs? Run the timer so it counts toward your streak.</p>`}
      </section>`;
    side.innerHTML = exploreHTML();
    hydrateImages(main); hydrateImages(side);
    if (builder) builder.refresh();
    clearInterval(tick);
    if (act) tick = setInterval(() => { const c = week.querySelector('[data-r="clock"]'); if (c) c.textContent = fmtClock(Practice.elapsedSec()); }, 1000);
  }

  function liveSession(act, open) {
    return `<div class="wk-live"><div class="label">Free practice in progress</div>
      <div class="live-clock" data-r="clock">${fmtClock(Practice.elapsedSec())}</div>
      ${open.length ? `<label class="mini">Counts toward</label><select data-r="sesscourse"><option value="">Free practice</option>${open.map(c => `<option value="${c.id}" ${c.id === act.courseId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
      <div class="row"><button class="btn primary" data-d="finish">Finish & log</button><button class="btn" data-d="tools">Open tools</button></div>
      <button class="linkbtn small" data-d="discard">Discard this session</button></div>`;
  }

  /** "Continue where you left off": a lesson in progress, else the course you practiced last, with its progress ring. */
  function continueHTML(open) {
    if (hasActiveRoutine()) return `<a class="gp-continue" href="#/practice/run"><span class="gp-c-in"><span class="gp-c-txt"><span class="label">Continue</span><b>Today’s lesson is in progress</b><span class="small muted">Pick up where you left off</span></span>${ringHTML(null)}</span></a>`;
    const c = [...open].filter(x => x.tree).sort((a, b) => String(b.lastPracticed || '').localeCompare(String(a.lastPracticed || '')))[0];
    if (!c) return '';
    const pct = progressPct(c), nx = nextInCourse(p, c);
    const kind = isMaster(c) ? (c.topic && c.topic.cat === 'artist' ? 'Artist series' : 'Master class') : ((GENRE_BY_ID[c.genre] || {}).name || 'Course');
    return `<button class="gp-continue" data-d="continue" data-c="${c.id}"><span class="gp-c-in"><span class="gp-c-txt"><span class="label">Continue</span>
      <b>${esc(c.name)}${nx ? ` — ${esc(nx.skill.title)}` : ''}</b><span class="small muted">${esc(kind)} · ${esc(tierName(c.difficulty))}${c.lastPracticed ? ` · last played ${esc(c.lastPracticed)}` : ''}</span></span>${ringHTML(pct)}</span></button>`;
  }
  const ringHTML = pct => `<span class="gp-ring" style="--pct:${pct == null ? 50 : pct}"><span>${pct == null ? icon('play') : `${pct}%`}</span></span>`;
  /** Technique library cards: paths you've started first, then ones at your level. */
  function techHTML() {
    const started = id => Object.keys(p.varState || {}).some(k => k.startsWith(`kb:${id}:`));
    const lvl = t => (p.domains[t.domain] ? p.domains[t.domain].level : 4);
    const fits = t => (t.stages || []).some(st => lvl(t) >= st.levels[0] - 1 && lvl(t) <= st.levels[1]);
    const list = [...KB_INDEX].sort((a, b) => (started(b.id) - started(a.id)) || (fits(b) - fits(a)) || a.title.localeCompare(b.title)).slice(0, 4);
    if (!list.length) return '';
    return `<section class="gp-tech"><div class="sec-head"><h3>Technique library</h3><a class="link small" href="#/techniques">All paths →</a></div>
      <div class="gp-tech-grid">${list.map(t => `<a class="gp-tcard dom-${t.domain}" href="#/techniques/${t.id}"><span class="gp-badge">${icon('target')}</span><b>${esc(t.title)}</b><span class="small muted">${esc(tierName(lvl(t)))} · ${t.lessons} lessons</span></a>`).join('')}</div></section>`;
  }

  /** Shortcuts to the learning areas; the master class for your biggest need comes first. */
  function exploreHTML() {
    const fy = forYou(p)[0];
    return `<section class="card explore">
      <div class="sec-head"><h3>Explore</h3><a class="link small" href="#/practice">Practice →</a></div>
      ${fy ? `<button class="ex-row" data-mc="${esc(fy.topic.id)}">${topicArtHTML(fy.topic.cat, 'sm')}<span class="ex-txt"><span class="label">Master class for you</span><b>${esc(fy.topic.title)}</b></span><span class="mc-go">›</span></button>` : ''}
      <a class="ex-row" href="#/techniques"><span class="ex-ic" aria-hidden="true">${icon('target')}</span><span class="ex-txt"><b>Technique library</b><span class="small muted">Beginner to mastery paths</span></span><span class="mc-go">›</span></a>
      <a class="ex-row" href="#/artist"><span class="ex-ic" aria-hidden="true">${icon('guitar')}</span><span class="ex-txt"><b>Artist series</b><span class="small muted">Signature techniques of great players</span></span><span class="mc-go">›</span></a>
    </section>`;
  }

  function courseRow(c) {
    if (c.tree) c.progress = progressPct(c);
    const g = !isMaster(c) && GENRE_BY_ID[c.genre];
    const art = isMaster(c) ? topicArtHTML(c.topic && c.topic.cat, 'thumb') : wikiTile(g ? g.wiki : c.genre, g ? g.name : c.genre, 'thumb');
    const sub = isMaster(c) ? `${MC_ICON} Master class · ${tierName(c.difficulty)}` : `${esc(g ? g.name : c.genre)} · ${tierName(c.difficulty)}`;
    return `<a class="course ${isMaster(c) ? 'master' : ''}" href="#/course/${c.id}">${art}
      <div class="cbody"><b>${esc(c.name)}</b><div class="muted small">${sub}</div>
        <div class="cprog"><div class="bar"><i style="width:${c.progress || 0}%"></i></div><span>${c.progress || 0}%</span></div></div></a>`;
  }

  function newCourseSheet() {
    const q = p.questionnaire;
    const order = [...q.genres, ...GENRES.map(g => g.id).filter(id => !q.genres.includes(id))];
    let genreId = order[0], style = null, tier = tierIdFor(suggestedDifficulty(p, genreId)), busy = false;
    const difficultyNow = () => levelInTier(tier, suggestedDifficulty(p, genreId));
    const sheet = Shell.sheet('<div data-r="body"></div>');
    const draw = () => {
      const g = GENRE_BY_ID[genreId]; style = style && g.styles.includes(style) ? style : g.styles[0];
      const players = q.players.filter(pl => (pl.genres || []).includes(genreId));
      sheet.el.querySelector('[data-r="body"]').innerHTML = `
        <h2>New course</h2>
        <div class="field"><label>Genre</label><div class="tiles small">${order.map(id => { const x = GENRE_BY_ID[id]; return `<button class="tile ${id === genreId ? 'on' : ''}" data-g="${id}">${wikiTile(x.wiki, x.name)}<span class="tile-name">${esc(x.name)}</span><span class="tick">✓</span></button>`; }).join('')}</div></div>
        <div class="field"><label>Style focus</label><div class="chips">${g.styles.map(s => `<button class="chip ${s === style ? 'on' : ''}" data-st="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>
        <div class="field"><label>Level</label>${tierPickerHTML({ current: tier, recommended: tierIdFor(suggestedDifficulty(p, genreId)), attr: 'data-ntier' })}</div>
        ${players.length ? `<p class="small">Inspired by: ${players.map(x => esc(x.name)).join(', ')}</p>` : ''}
        <button class="btn primary block" data-r="create" ${busy ? 'disabled' : ''}>${busy ? 'Naming your course…' : 'Create course'}</button>`;
      hydrateImages(sheet.el);
    };
    sheet.el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.g) { genreId = b.dataset.g; tier = tierIdFor(suggestedDifficulty(p, genreId)); draw(); }
      else if (b.dataset.ntier) { tier = b.dataset.ntier; draw(); }
      else if (b.dataset.st) { style = b.dataset.st; draw(); }
      else if (b.dataset.r === 'create' && !busy) {
        busy = true; draw();
        const players = q.players.filter(pl => (pl.genres || []).includes(genreId)).map(x => x.name).slice(0, 3);
        const c = await createCourse(p, { genreId, style, difficulty: difficultyNow(), players });
        Store.save(); sheet.close(); toast(`Created “${c.name}”.`); render();
      }
    });
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
      case 'continue': { const c = p.courses.find(x => x.id === b.dataset.c); const nx = c && nextInCourse(p, c); if (c && nx) openPractice(courseContext(p, c, { skillId: nx.skill.id }), navigate); else if (c) navigate('#/course/' + c.id); return; }
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

/** Home for a guest: everything open, nothing chosen for you, and the way to a profile. */
function mountGuestHome(root, { navigate }) {
  const go = (href, ic, title, sub) => `<a class="ex-row" href="${href}"><span class="ex-ic" aria-hidden="true">${icon(ic)}</span><span class="ex-txt"><b>${title}</b><span class="small muted">${sub}</span></span><span class="mc-go">›</span></a>`;
  root.innerHTML = `<div class="dash-head"><div><div class="label">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1>Pick anything and play.</h1></div></div>
    <div class="dash-cols">
      <div class="dash-main">
        <section class="card guest-card">
          <div class="label">Guest mode</div>
          <h3>Everything is open</h3>
          <p class="small">Every lesson, path, artist course, song tool and trainer works as a guest. Two things need a player profile: <b>saving your progress</b> (tempos, mastered lessons, streaks) and <b>lessons chosen for your level</b>. Anything you log as a guest is gone when you close the app.</p>
          <div class="row"><a class="btn primary" href="#/welcome" data-g="create">Create my player profile</a><a class="btn ghost" href="#/settings">Load a saved profile</a></div>
        </section>
        <section class="card explore">
          <div class="sec-head"><h3>Start here</h3></div>
          ${go('#/practice', 'library-big', 'Exercise library', 'Warm-ups, picking, fretting, chords, rhythm, scales')}
          ${go('#/techniques', 'target', 'Technique library', 'Step-by-step paths from beginner to mastery')}
          ${go('#/artist', 'guitar', 'Artist series', 'Signature techniques of great players')}
          ${go('#/songs', 'music', 'Songs', 'Paste or import a tab and learn it section by section')}
          ${go('#/tools', 'gauge', 'Tools', 'Tuner, metronome, trainers, chords and scales')}
        </section>
      </div>
      <div class="dash-side"><section class="card track" data-r="track"></section></div>
    </div>`;
  let offTrack = () => {};
  try { offTrack = mountTrackCard(root.querySelector('[data-r="track"]')) || (() => {}); } catch { root.querySelector('[data-r="track"]').remove(); }
  return () => offTrack();
}
