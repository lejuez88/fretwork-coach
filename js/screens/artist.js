// Artist Series: one page per artist with lessons on their signature
// techniques (playable tabs at your level), famous songs linked out to
// Songsterr, and a master class built from the lessons. #/artist lists every
// artist; #/artist/<id> is one artist.
import { esc, toast } from '../core/util.js';
import { Store } from '../core/store.js';
import { wikiTile, hydrateImages } from '../core/wiki.js';
import { ARTIST_INDEX as ARTISTS, ARTIST_META_BY_ID, ARTIST_NOTE, KB_INDEX, loadArtist } from '../data/kb.js';
import { artistLessonList, createMasterClass, buildMasterTree, isMaster } from '../core/master.js';
import { calibratedTarget } from '../core/progression.js';
import { addSong } from '../core/songs.js';
import { bestMatchUrl } from '../core/songsterr.js';
import { openMasterSheet, MC_ICON } from '../ui/mastersheet.js';
import { lessonCardHTML, lessonActions, lessonTarget } from '../ui/lessoncards.js';

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** The library technique an artist's technique chip names (or null). */
const techniqueByName = name => KB_INDEX.find(t => norm(t.title) === norm(name)) || KB_INDEX.find(t => t.re.test(String(name).toLowerCase())) || null;
/** Artists whose names match your favorite players come first. */
export function artistsForYou(p) {
  const fav = (p.questionnaire.players || []).map(x => norm(x.name));
  const isFav = a => fav.some(n => n && (n === norm(a.name) || a.re.test(n)));
  return [...ARTISTS.filter(isFav), ...ARTISTS.filter(a => !isFav(a))];
}
/** Your favorite players who aren't in the series yet (Claude builds those). */
export function otherPlayers(p) {
  return (p.questionnaire.players || []).filter(x => x && x.name && !ARTISTS.some(a => a.re.test(x.name.toLowerCase())));
}
const masterFor = (p, id) => p.courses.find(c => isMaster(c) && c.status !== 'archived' && c.topic && c.topic.topicId === 'artist-' + id) || null;

/** The dashboard card. */
export function artistCardHTML(p) {
  const list = artistsForYou(p), others = otherPlayers(p).slice(0, 2);
  return `<section class="card artistcard">
    <div class="sec-head"><h3>🎸 Artist series</h3><span class="row" style="gap:14px"><a class="link" href="#/techniques">Technique library →</a><a class="link" href="#/artist">All artists →</a></span></div>
    <p class="small muted">Lessons on each player’s signature techniques, their famous songs, and a master class built from them.</p>
    <div class="artist-tiles">${list.map(a => `<a class="artist-tile" href="#/artist/${a.id}">${wikiTile(a.wiki, a.name)}<span class="at-name">${esc(a.name)}</span><span class="at-tech small muted">${esc(a.techniques.slice(0, 2).join(' · '))}</span></a>`).join('')}
      ${others.map(x => `<button class="artist-tile other" data-artist-other="${esc(x.name)}">${wikiTile(x.wikiTitle || x.name, x.name)}<span class="at-name">${esc(x.name)}</span><span class="at-tech small muted">Claude builds it</span></button>`).join('')}</div>
  </section>`;
}
/** Clicks on the card's "other player" tiles (Claude designs those). */
export function onArtistCardClick(e, navigate) {
  const b = e.target.closest('[data-artist-other]'); if (!b) return false;
  openMasterSheet({ title: `${b.dataset.artistOther} style`, cat: 'artist' }, { navigate });
  return true;
}

/** #/artist: every artist, plus "any other artist". */
export function mountArtistIndex(root, { navigate }) {
  const p = Store.profile;
  root.innerHTML = `<a class="link" href="#/home">← Dashboard</a>
    <div class="exhead"><div class="label">Artist series</div><h1>Learn from the players</h1>
      <p class="why">Pick a player to get lessons on their signature techniques at your level, links to their famous songs, and a master class built around their style.</p></div>
    <div class="artist-grid">${artistsForYou(p).map(a => `<a class="artist-big" href="#/artist/${a.id}">${wikiTile(a.wiki, a.name)}<div class="ab-body"><b>${esc(a.name)}</b><p class="small muted">${esc(a.blurb)}</p>
      <div class="chips">${a.techniques.slice(0, 4).map(t => `<span class="chip sm">${esc(t)}</span>`).join('')}</div></div></a>`).join('')}</div>
    <a class="lib-more-card" href="#/techniques"><span class="lm-ic" aria-hidden="true">🎯</span><span><b>Technique library</b><span class="small muted">Every technique these players use, and more, from beginner to advanced.</span></span><span class="mc-go">›</span></a>
    <section class="card"><h3>Another player</h3><p class="small muted">Not in the series yet? Claude designs a master class on their style (saved, so asking again costs nothing).</p>
      <form class="mc-ask" data-r="other"><input type="text" name="artist" maxlength="60" placeholder="e.g. Yngwie Malmsteen, John Mayer, Tosin Abasi" aria-label="Artist"><button class="btn" type="submit">${MC_ICON} Build</button></form>
      ${otherPlayers(p).length ? `<div class="chips" style="margin-top:10px">${otherPlayers(p).map(x => `<button class="chip" data-artist-other="${esc(x.name)}">${esc(x.name)}</button>`).join('')}</div>` : ''}</section>`;
  hydrateImages(root);
  const onSubmit = e => {
    if (!e.target.closest('[data-r="other"]')) return; e.preventDefault();
    const v = (e.target.querySelector('input').value || '').trim(); if (v.length < 3) return toast('Type a player’s name.');
    const known = ARTISTS.find(a => a.re.test(v.toLowerCase()));
    if (known) return navigate(`#/artist/${known.id}`);
    openMasterSheet({ title: `${v} style`, cat: 'artist' }, { navigate });
  };
  const onClick = e => { onArtistCardClick(e, navigate); };
  root.addEventListener('submit', onSubmit); root.addEventListener('click', onClick);
  return () => { root.removeEventListener('submit', onSubmit); root.removeEventListener('click', onClick); };
}

/** #/artist/<id>: one artist's lessons and songs. */
export function mountArtist(root, { navigate, id }) {
  const p = Store.profile, meta = ARTIST_META_BY_ID[id];
  if (!meta) { navigate('#/artist'); return () => {}; }
  let a = meta, lessons = [], targets = [], building = false, ready = false, gone = false;
  const acts = lessonActions(root, { get: () => ({ lessons, targets }), reason: l => `${a.name} lesson: ${l.skill.title}`, title: l => `${a.name}: ${l.ex.name}`, genre: a.genre, navigate });

  const hasSong = r => p.songs.some(s => norm(s.title) === norm(r.title));
  function render() {
    acts.stop();
    if (!ready) { root.innerHTML = `<a class="link" href="#/artist">← Artist series</a><div class="exhead"><div class="label">Artist series</div><h1>${esc(meta.name)}</h1></div><p class="muted"><span class="spinner sm"></span> Loading lessons…</p>`; return; }
    const mc = masterFor(p, id);
    // group lessons by unit, in order
    const groups = [];
    lessons.forEach((l, i) => { let g = groups[groups.length - 1]; if (!g || g.unit !== l.unit) groups.push(g = { unit: l.unit, items: [] }); g.items.push(i); });
    root.innerHTML = `<a class="link" href="#/artist">← Artist series</a>
      <div class="artist-head">${wikiTile(a.wiki, a.name, 'artist-photo')}
        <div><div class="label">Artist series</div><h1>${esc(a.name)}</h1><p class="why">${esc(a.blurb)}</p>
          <div class="chips">${a.techniques.map(t => { const tech = techniqueByName(t); return tech ? `<a class="chip sm" href="#/techniques/${tech.id}">${esc(t)}</a>` : `<span class="chip sm">${esc(t)}</span>`; }).join('')}</div>
          <div class="row" style="margin-top:12px">${mc ? `<a class="btn primary" href="#/course/${mc.id}">${MC_ICON} Open your ${esc(a.name)} master class</a>` : `<button class="btn primary" data-al="master" ${building ? 'disabled' : ''}>${building ? '<span class="spinner sm"></span>Building…' : `${MC_ICON} Start the ${esc(a.name)} master class`}</button>`}</div>
          <p class="small muted">${lessons.length} lessons at your level, original exercises in this style that play in the tab player. The master class turns them into a course with progress and reviews.</p></div></div>
      <div class="artist-cols">
        <div class="artist-lessons">${groups.map(g => `<section class="card"><div class="sec-head"><h3>${esc(g.unit.title)}</h3></div><p class="small muted">${esc(g.unit.summary)}</p>${g.items.map(i => lessonCardHTML(p, lessons[i], i, targets[i])).join('')}</section>`).join('')}</div>
        <aside class="artist-side"><section class="card"><h3>Famous songs</h3>
          <p class="small muted">Linked, not copied: open the tab on Songsterr, or add the song to My songs, where you can paste a tab and get section-by-section lessons.</p>
          <div class="riffs">${a.riffs.map((r, i) => `<div class="riff"><div><b>${esc(r.title)}</b>${r.artist ? ` <span class="small muted">(${esc(r.artist)})</span>` : ''}<div class="small muted">${esc(r.note)}</div></div>
            <div class="riff-act"><a class="btn sm ghost" href="${esc(bestMatchUrl(r.title, r.artist || a.name))}" target="_blank" rel="noopener">Tab ↗</a>
            <button class="btn sm" data-riff="${i}" ${hasSong(r) ? 'disabled' : ''}>${hasSong(r) ? '✓ In My songs' : '+ My songs'}</button></div></div>`).join('')}</div>
          <p class="small muted">${esc(ARTIST_NOTE)}</p></section></aside>
      </div>`;
    hydrateImages(root);
  }
  async function startMaster() {
    if (building) return;
    building = true; render();
    const course = createMasterClass(p, { title: `${a.name} style`, topicId: 'artist-' + id, cat: 'artist' });
    try {
      await buildMasterTree(p, course);
      Store.save(); toast(`${MC_ICON} “${course.name}” is ready. Built from these lessons (no API cost).`, 4200);
      building = false; navigate(`#/course/${course.id}`);
    } catch (e) {
      p.courses = p.courses.filter(c => c.id !== course.id);
      building = false; toast(e.message || 'The course couldn’t be built.'); render();
    }
  }
  const onClick = e => {
    const r = e.target.closest('[data-riff]');
    if (r) {
      const riff = a.riffs[+r.dataset.riff]; const song = addSong(p, { title: riff.title, artist: riff.artist || a.name, source: 'artist', why: riff.note });
      if (song) { Store.save(); toast(`Added “${song.title}” to My songs.`); r.disabled = true; r.textContent = '✓ In My songs'; }
      return;
    }
    if (e.target.closest('[data-al="master"]')) { startMaster(); return; }
    acts.onClick(e);
  };
  root.addEventListener('click', onClick);
  render();
  Promise.all([loadArtist(id), artistLessonList(p, id)]).then(([full, list]) => {
    if (gone) return;
    a = full; lessons = list; targets = lessons.map(l => lessonTarget(p, l, calibratedTarget(l.ex, l.ex.level || 4, p))); ready = true; render();
  }).catch(e => { if (!gone) root.innerHTML = `<a class="link" href="#/artist">← Artist series</a><p class="bad">Couldn’t load the lessons (${esc(e.message)}). Check the connection and reload.</p>`; });
  return () => { gone = true; acts.stop(); root.removeEventListener('click', onClick); };
}
