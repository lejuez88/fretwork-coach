// Album of the day: a different album every time the app opens, chosen for
// relevance to what was practiced in the previous session.
import { ALBUMS, GENRE_BY_ID } from '../data/catalog.js';
import { Practice } from './store.js';
import { pick } from './util.js';

export function chooseAlbum(profile) {
  const q = profile.questionnaire;
  const last = Practice.lastSession(profile);
  const lastCourse = last && last.courseId ? profile.courses.find(c => c.id === last.courseId) : null;
  const lastGenre = (lastCourse && lastCourse.genre) || (last && last.genre) || null;
  const coursePlayers = new Set((lastCourse ? lastCourse.players : []).map(n => n.toLowerCase()));
  const myPlayerIds = new Set(q.players.map(p => p.id));
  const myGenres = new Set(q.genres);
  const recent = new Set((profile.dashboard.albumHistory || []).slice(-8));

  let best = [], bestScore = -1;
  for (const a of ALBUMS) {
    if (recent.has(a.id)) continue;
    let s = 0;
    if (lastGenre && a.genres.includes(lastGenre)) s += 3;
    if (a.players.some(id => myPlayerIds.has(id))) s += 2;
    if (a.artist && [...coursePlayers].some(n => a.artist.toLowerCase().includes(n.split(' ').pop()))) s += 2;
    if (a.genres.some(g => myGenres.has(g))) s += 1;
    if (s > bestScore) { bestScore = s; best = [a]; } else if (s === bestScore) best.push(a);
  }
  if (!best.length) best = ALBUMS;
  const album = pick(best);

  let reason;
  if (lastCourse && album.genres.includes(lastCourse.genre)) reason = `Because your last session was in “${lastCourse.name}”.`;
  else if (lastGenre && album.genres.includes(lastGenre)) reason = `Because you practiced ${GENRE_BY_ID[lastGenre] ? GENRE_BY_ID[lastGenre].name.toLowerCase() : lastGenre} last session.`;
  else if (album.players.some(id => myPlayerIds.has(id))) reason = `Features a player you want to learn from.`;
  else if (album.genres.some(g => myGenres.has(g))) reason = `Matches your ${album.genres.filter(g => myGenres.has(g)).map(g => GENRE_BY_ID[g].name).join(' / ')} interest.`;
  else reason = 'A classic guitar record worth knowing.';

  const hist = profile.dashboard.albumHistory || (profile.dashboard.albumHistory = []);
  hist.push(album.id); if (hist.length > 20) hist.splice(0, hist.length - 20);
  profile.dashboard.current = { albumId: album.id, reason, at: Date.now() };
  return { album, reason };
}
