// Course detail. Phase A: course identity, progress, practice history and a
// session starter. Phase B renders the generated skill tree here.
import { esc, fmtMinutes, toast } from '../core/util.js';
import { Store, Practice } from '../core/store.js';
import { wikiTile, hydrateImages } from '../core/wiki.js';
import { GENRE_BY_ID } from '../data/catalog.js';

export function mountCourse(root, { id, navigate }) {
  const p = Store.profile, c = p.courses.find(x => x.id === id);
  if (!c) { root.innerHTML = '<section class="card"><p>Course not found.</p><a class="btn block" href="#/home">Back to dashboard</a></section>'; return () => {}; }
  const g = GENRE_BY_ID[c.genre];
  const sessions = p.practiceLog.filter(l => l.courseId === c.id);
  const mins = sessions.reduce((a, l) => a + l.minutes, 0);
  root.innerHTML = `
    <a class="link" href="#/home">← Dashboard</a>
    <section class="card course-hero">${wikiTile(g ? g.wiki : c.genre, g ? g.name : c.genre, 'banner')}
      <div class="label">${esc(g ? g.name : c.genre)} · ${esc(c.style)} · level ${c.difficulty} (${esc(c.levelLabel)})</div>
      <h1>${esc(c.name)}</h1><p>${esc(c.tagline)}</p>
      ${c.players.length ? `<p class="muted small">Inspired by ${c.players.map(esc).join(', ')}</p>` : ''}
      <div class="cprog big"><div class="bar"><i style="width:${c.progress}%"></i></div><span>${c.progress}%</span></div>
      <div class="row"><button class="btn primary" data-c="practice">▶ Practice this course</button></div>
    </section>
    <section class="card"><h3>Progress tree</h3>
      <p class="muted">The full lesson plan for this course, shown as a skill tree with daily routines, is built in Phase B. Your course, its level and your practice time are already saved and carry over.</p></section>
    <section class="card"><h3>Practice history</h3>
      ${sessions.length ? `<p class="small">${sessions.length} session${sessions.length > 1 ? 's' : ''}, ${fmtMinutes(mins)} total.</p>${sessions.slice(-6).reverse().map(s => `<div class="logrow"><span>${s.date}</span><b>${fmtMinutes(s.minutes)}</b></div>`).join('')}` : '<p class="muted small">No sessions yet.</p>'}
    </section>
    <section class="card"><div class="row"><button class="btn" data-c="archive">Archive course</button><button class="btn ghost danger" data-c="delete">Delete</button></div></section>`;
  hydrateImages(root);
  const onClick = e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    if (b.dataset.c === 'practice') {
      if (Practice.active()) { toast('A session is already running.'); return navigate('#/home'); }
      Practice.start({ source: 'course', courseId: c.id, genre: c.genre }); navigate('#/home');
    }
    if (b.dataset.c === 'archive') { c.status = 'archived'; Store.save(); toast('Archived.'); navigate('#/home'); }
    if (b.dataset.c === 'delete' && confirm(`Delete “${c.name}”? Practice time stays in your stats.`)) { p.courses = p.courses.filter(x => x.id !== c.id); Store.save(); navigate('#/home'); }
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
