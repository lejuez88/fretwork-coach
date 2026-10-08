// Central dashboard: practice session timer, open courses with progress,
// practice stats, Track of the Day (with a YouTube player), and the 15-minute
// calendar with streak. The track card lives outside the re-rendered parts of
// the page, so starting the timer or flipping the calendar never stops the music.
import { esc, fmtMinutes, fmtClock, today, toast } from '../core/util.js';
import { Store, Practice } from '../core/store.js';
import { wikiTile, hydrateImages } from '../core/wiki.js';
import { GENRES, GENRE_BY_ID } from '../data/catalog.js';
import { createCourse, suggestedDifficulty, tierName } from '../core/courses.js';
import { DOMAINS } from '../assessment/engine.js';
import { Shell } from '../ui/shell.js';
import { progressPct } from '../core/progression.js';
import { estimatedCount } from './reassess.js';
import { mountTrackCard } from '../ui/trackcard.js';
import { mountRoutineBuilder } from '../ui/routinebuilder.js';

export function mountDashboard(root, { navigate, courseId = null, skillId = null }) {
  const p = Store.profile;
  let calMonth = today().slice(0, 7); // YYYY-MM
  let tick = null;
  // Stable regions (routine builder, track player) are mounted once; the rest re-renders.
  root.innerHTML = '<div data-r="head"></div><section class="card routine-cta" data-r="routine"></section><div data-r="top"></div><section class="card track" data-r="track"></section><div data-r="bottom"></div>';
  const head = root.querySelector('[data-r="head"]'), top = root.querySelector('[data-r="top"]'), bottom = root.querySelector('[data-r="bottom"]');
  let builder = null;

  function render() {
    const st = Practice.stats(p), act = Practice.active();
    const open = p.courses.filter(c => c.status !== 'archived');
    const name = p.questionnaire.name || 'there';
    const hour = new Date().getHours(), greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    head.innerHTML = `
      <div class="dash-head"><div><div class="label">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1>${greet}, ${esc(name)}.</h1></div>
        <div class="streak-badge ${st.streak ? 'hot' : ''}" title="Current streak"><b>${st.streak}</b><span>day${st.streak === 1 ? '' : 's'}<br>streak</span></div></div>`;
    top.innerHTML = `
      ${estimatedCount(p) ? `<section class="card nudge"><div><b>Finish your assessment</b><div class="small muted">${estimatedCount(p)} skill area${estimatedCount(p) > 1 ? 's are' : ' is'} estimated or untested at the harder levels, so lessons may start too easy.</div></div><a class="btn sm primary" href="#/reassess">Continue</a></section>` : ''}
      <section class="card session ${act ? 'live' : ''}">${act ? liveSession(act) : idleSession(open)}</section>

      <section class="stats">
        ${stat('Total practice', fmtMinutes(st.total))}
        ${stat('This week', fmtMinutes(st.week))}
        ${stat('Daily average', fmtMinutes(st.avgDaily))}
        ${stat('Today', fmtMinutes(st.practicedToday), st.practicedToday >= 15 ? 'ok' : '')}
      </section>

      <section class="card">
        <div class="sec-head"><h3>Your courses</h3><button class="btn sm" data-d="newcourse">+ New course</button></div>
        ${open.length ? open.map(courseCard).join('') : '<p class="muted">No courses yet. Create one to get a full learning path.</p>'}
      </section>`;

    bottom.innerHTML = `
      <section class="card">
        <div class="sec-head"><h3>Practice calendar</h3><div class="calnav"><button class="kbtn sm" data-d="calprev" aria-label="Previous month">‹</button><button class="kbtn sm" data-d="calnext" aria-label="Next month">›</button></div></div>
        ${calendar(st)}
        <div class="cal-foot"><span><i class="dot done"></i>15+ min</span><span><i class="dot some"></i>under 15</span><span>Best streak: <b>${st.best}</b> days</span></div>
        <button class="btn ghost sm block" data-d="manual">+ Log practice done away from the app</button>
      </section>

      ${Object.keys(p.domains || {}).length ? `<section class="card">
        <div class="sec-head"><h3>Skill levels</h3><a class="link" href="#/profile">Player Profile →</a></div>
        ${DOMAINS.map(d => { const l = p.domains[d.key] ? p.domains[d.key].level : 1; return `<div class="lv"><span>${d.short}</span><div class="bar"><i style="width:${l * 10}%"></i></div><b>${l}</b></div>`; }).join('')}
      </section>` : ''}`;
    hydrateImages(top); hydrateImages(bottom);
    if (builder) builder.refresh();
    clearInterval(tick);
    if (act) tick = setInterval(() => { const c = top.querySelector('[data-r="clock"]'); if (c) c.textContent = fmtClock(Practice.elapsedSec()); }, 1000);
  }

  const stat = (k, v, cls = '') => `<div class="stat ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`;

  function idleSession(open) {
    return `<div class="label">Free practice</div>
      <p class="muted small">Just playing or jamming? Run the timer so it counts toward your stats and streak.</p>
      ${open.length ? `<div class="chips" data-r="sesscourse">${open.map((c, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-sc="${c.id}">${esc(c.name)}</button>`).join('')}<button class="chip" data-sc="">Free practice</button></div>` : ''}
      <button class="btn block" data-d="start">⏱ Start free-practice timer</button>`;
  }
  function liveSession(act) {
    const c = act.courseId && p.courses.find(x => x.id === act.courseId);
    return `<div class="label">Session in progress</div>
      <div class="live-clock" data-r="clock">${fmtClock(Practice.elapsedSec())}</div>
      <p class="muted small">${c ? esc(c.name) : 'Free practice'} · counts toward today once you finish.</p>
      <div class="row"><button class="btn primary" data-d="finish">Finish & log</button><button class="btn" data-d="tools">Open tools</button></div>
      <button class="btn ghost sm block" data-d="discard">Discard this session</button>`;
  }

  function courseCard(c) {
    if (c.tree) c.progress = progressPct(c);
    const g = GENRE_BY_ID[c.genre];
    return `<a class="course" href="#/course/${c.id}">
      ${wikiTile(g ? g.wiki : c.genre, g ? g.name : c.genre, 'thumb')}
      <div class="cbody"><b>${esc(c.name)}</b><div class="muted small">${esc(g ? g.name : c.genre)} · ${esc(c.levelLabel)} · level ${c.difficulty}</div>
        <div class="cprog"><div class="bar"><i style="width:${c.progress || 0}%"></i></div><span>${c.progress || 0}%</span></div></div></a>`;
  }

  function calendar(st) {
    const [y, m] = calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7, now = today();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="cd empty"></span>';
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const min = st.byDay[iso] || 0;
      const cls = [min >= 15 ? 'done' : min > 0 ? 'some' : '', iso === now ? 'today' : '', iso > now ? 'future' : ''].join(' ');
      cells += `<span class="cd ${cls}" title="${iso}: ${fmtMinutes(min)}">${d}</span>`;
    }
    return `<div class="cal-title">${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
      <div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="cw">${x}</span>`).join('')}${cells}</div>`;
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

  function manualSheet() {
    let mins = 30;
    const sheet = Shell.sheet(`<h2>Log practice</h2><p class="muted small">For practice you did away from the app. It counts toward your stats and calendar.</p>
      <div class="field"><label>Date</label><input type="date" data-r="date" value="${today()}" max="${today()}"></div>
      <div class="field"><label>Minutes</label><div class="stepper s1"><button data-m="-5">−</button><input type="number" inputmode="numeric" data-r="min" value="${mins}"><button data-m="5">+</button></div></div>
      <button class="btn primary block" data-r="save">Save</button>`);
    sheet.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const inp = sheet.el.querySelector('[data-r="min"]');
      if (b.dataset.m) { inp.value = Math.max(1, (+inp.value || 0) + Number(b.dataset.m)); }
      if (b.dataset.r === 'save') {
        const date = sheet.el.querySelector('[data-r="date"]').value || today();
        const m = Math.max(1, Math.min(600, +inp.value || 0));
        if (date > today()) return toast('That date is in the future.');
        Practice.addManual(p, date, m); Store.save(); sheet.close(); toast(`Logged ${m} min on ${date}.`); render();
      }
    });
  }

  const onClick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sc != null) { root.querySelectorAll('[data-sc]').forEach(x => x.classList.toggle('on', x === b)); return; }
    switch (b.dataset.d) {
      case 'start': {
        const sel = root.querySelector('[data-sc].on'); const cid = sel ? sel.dataset.sc || null : null;
        const c = cid && p.courses.find(x => x.id === cid);
        Practice.start({ source: 'free', courseId: cid, genre: c ? c.genre : (p.questionnaire.genres[0] || null) });
        render(); return;
      }
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
      case 'manual': manualSheet(); return;
      case 'calprev': case 'calnext': {
        const [y, m] = calMonth.split('-').map(Number), d = new Date(y, m - 1 + (b.dataset.d === 'calnext' ? 1 : -1), 1);
        calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; render(); return;
      }
    }
  };
  root.addEventListener('click', onClick);
  builder = mountRoutineBuilder(root.querySelector('[data-r="routine"]'), { navigate, courseId, skillId });
  render();
  const offTrack = mountTrackCard(root.querySelector('[data-r="track"]'));
  return () => { clearInterval(tick); offTrack(); builder.destroy(); root.removeEventListener('click', onClick); };
}
