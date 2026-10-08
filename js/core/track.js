// Track of the Day: one track a day, chosen for what you're practicing now
// (your last session's course and style, songs you're learning, players you
// follow, your genres), with one thing to listen for and an ear challenge
// matched to your ear-training level.
//
// The day's choice is made right away from a ranked list of candidates. Then
// settleTrack() looks for a playable video. Without a YouTube key it moves down
// the list until it finds a track with a known video, so the dashboard almost
// always has something to play.
import { TRACKS } from '../data/tracks.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { songMatch } from '../data/songs.js';
import { Practice } from './store.js';
import { today, hash } from './util.js';
import { resolveVideos, norm, artistMatches, titleMatches } from './youtube.js';

const HISTORY = 90;      // remembered picks
const MAX_ALTS = 7;      // backups if the first pick has no playable video
const SETTLE_TRIES = 6;

const STYLE_STOP = new Set(['foundations', 'basics', 'mastery', 'lab', 'craft', 'drive', 'grooves', 'rhythm', 'lead', 'chords', 'technique', 'architecture', 'building', 'storytelling']);

/** Everything that can be Track of the Day: the catalog plus the student's own songs. */
export function trackPool(p) {
  const pool = TRACKS.map(t => ({ ...t }));
  for (const s of p.songs || []) {
    if (!s || !s.title || !['want', 'learning'].includes(s.status)) continue;
    const hit = pool.find(t => sameSong(t, s));
    if (hit) { hit.songId = s.id; hit.mine = s.status; continue; }
    const tech = (s.info && s.info.techniques || []).slice(0, 3);
    pool.push({
      key: 'song:' + s.id, title: s.title, artist: s.artist || '', year: null,
      genres: [s.genre].filter(Boolean), players: [],
      listenFor: (s.info && s.info.why) || (tech.length ? `Listen for the ${tech.join(', ')} you'll be practicing.` : 'How the original feels before you practice it.'),
      wikiTitles: s.wikiTitle ? [s.wikiTitle] : [], q: null, songId: s.id, mine: s.status
    });
  }
  return pool;
}
const sameSong = (t, s) => norm(t.title) === norm(s.title) && (!s.artist || artistMatches(t.artist, s.artist) || artistMatches(s.artist, t.artist));

/** What the student is working on right now. */
function context(p) {
  const q = p.questionnaire || {};
  const last = Practice.lastSession(p);
  const lastCourse = last && last.courseId ? (p.courses || []).find(c => c.id === last.courseId) : null;
  const openCourses = (p.courses || []).filter(c => c.status !== 'archived');
  const lastGenre = (lastCourse && lastCourse.genre) || (last && last.genre) || null;
  const style = lastCourse && lastCourse.style ? lastCourse.style : null;
  const styleWords = style ? norm(style).split(' ').filter(w => w.length >= 4 && !STYLE_STOP.has(w)) : [];
  return {
    lastCourse, lastGenre, style, styleWords,
    courseGenres: new Set(openCourses.map(c => c.genre)),
    myGenres: new Set(q.genres || []),
    myPlayers: (q.players || []).map(pl => ({ id: pl.id, name: pl.name })).filter(pl => pl.name)
  };
}

function playerHit(t, ctx) {
  for (const pl of ctx.myPlayers) {
    if (pl.id && t.players.includes(pl.id)) return pl.name;
    if (artistMatches(t.artist, pl.name)) return pl.name;
  }
  return null;
}

function scoreTrack(t, ctx) {
  let s = 0;
  if (ctx.lastGenre && t.genres.includes(ctx.lastGenre)) s += 3;
  if (ctx.styleWords.length && ctx.styleWords.some(w => norm(t.listenFor).includes(w.replace(/s$/, '')))) s += 2;
  if (t.mine === 'learning') s += 3; else if (t.mine === 'want') s += 2;
  if (playerHit(t, ctx)) s += 2;
  if (t.genres.some(g => ctx.courseGenres.has(g))) s += 1;
  if (t.genres.some(g => ctx.myGenres.has(g))) s += 1;
  return s;
}

function reasonFor(t, ctx) {
  const gName = g => (GENRE_BY_ID[g] ? GENRE_BY_ID[g].name : g);
  if (ctx.lastCourse && t.genres.includes(ctx.lastCourse.genre)) {
    if (ctx.styleWords.some(w => norm(t.listenFor).includes(w.replace(/s$/, '')))) return `Ties in with your ${ctx.style} work in “${ctx.lastCourse.name}”.`;
    return `Because your last session was in “${ctx.lastCourse.name}”.`;
  }
  if (t.mine === 'learning') return 'You’re learning this one. Hear how the original feels before you practice it.';
  if (t.mine === 'want') return 'It’s on your want-to-learn list.';
  const who = playerHit(t, ctx);
  if (who) return `Features ${who}, a player you want to learn from.`;
  if (ctx.lastGenre && t.genres.includes(ctx.lastGenre)) return `Because you practiced ${gName(ctx.lastGenre).toLowerCase()} last session.`;
  const shared = t.genres.filter(g => ctx.courseGenres.has(g) || ctx.myGenres.has(g));
  if (shared.length) return `Matches your ${shared.slice(0, 2).map(gName).join(' / ')} interest.`;
  return `A ${gName(t.genres[0]).toLowerCase()} track every guitarist should know.`;
}

/** Ear challenge for today, matched to the ear-training level. */
export function earChallenge(p, t, date = today()) {
  const lv = p.domains && p.domains.ear ? p.domains.ear.level : 2;
  const sets = [
    [ // 1–3
      'Tap your foot to the beat and count how many beats are in each bar of the intro.',
      'Is the song mostly major (bright) or minor (dark)? Decide by the end of the first chorus.',
      'Hum the very last note of the song, then find that note on your low E string.',
      'When does the guitar play chords and when does it play single notes? Count the switches.',
      'Find the first note of the main riff or melody on your guitar.'
    ],
    [ // 4–6
      'Find the key: hum the “home” note, find it on the 6th or 5th string, and check it against the chords.',
      'Count the chords in the verse. Which ones sound major and which minor?',
      'Learn the first phrase of the guitar part by ear, then play it with the track.',
      'Find where the song repeats. Write the form as letters (for example A A B A).',
      'Pick out the bass line of the first four bars on your low strings.'
    ],
    [ // 7+
      'Transcribe the first four bars of the main guitar part, then play along at full speed.',
      'Write the verse progression as Roman numerals in the song’s key.',
      'Which scale or mode does the solo use? Find its home position and play along.',
      'Work out one voicing the guitarist uses that you don’t already know.',
      'Transcribe one lick from the solo and play it in two other positions.'
    ]
  ];
  const set = sets[lv <= 3 ? 0 : lv <= 6 ? 1 : 2];
  return set[hash(date + t.key) % set.length];
}

const brief = (t, reason) => ({
  key: t.key, title: t.title, artist: t.artist, year: t.year || null, genres: t.genres, players: t.players || [],
  listenFor: t.listenFor, wikiTitles: t.wikiTitles || [], q: t.q || null,
  songId: t.songId || null, mine: t.mine || null, reason
});

/**
 * Choose today's track (once per day). force: pick a different one now.
 * Returns profile.dashboard.track.
 */
export function chooseTrack(p, { force = false, rand = Math.random } = {}) {
  const d = p.dashboard || (p.dashboard = {});
  const hist = d.trackHistory || (d.trackHistory = []);
  const cur = d.track;
  if (cur && cur.date === today() && !force) return cur;

  const pool = trackPool(p);
  const ctx = context(p);
  const avoid = new Set(hist.slice(-Math.min(HISTORY, Math.max(0, pool.length - 12))));
  if (cur) avoid.add(cur.key);
  let cands = pool.filter(t => !avoid.has(t.key));
  if (cands.length < 4) cands = pool.filter(t => !cur || t.key !== cur.key);

  // Rank: score plus a little randomness so equal-score tracks rotate.
  const ranked = cands.map(t => ({ t, s: scoreTrack(t, ctx) + rand() * 1.5 })).sort((a, b) => b.s - a.s);
  const top = ranked.slice(0, MAX_ALTS + 1).map(x => brief(x.t, reasonFor(x.t, ctx)));
  const [first, ...alts] = top;
  d.track = { ...first, date: today(), alts, settled: false };
  hist.push(first.key);
  if (hist.length > HISTORY) hist.splice(0, hist.length - HISTORY);
  return d.track;
}

/** Make `t` (one of today's backups) the day's track. */
function adopt(p, t) {
  const d = p.dashboard, cur = d.track;
  const alts = [cur, ...(cur.alts || [])].filter(x => x.key !== t.key).map(x => { const { alts: _a, date: _d, settled: _s, ...rest } = x; return rest; });
  d.track = { ...t, date: cur.date, alts, settled: false };
  const hist = d.trackHistory || (d.trackHistory = []);
  if (!hist.includes(t.key)) hist.push(t.key);
  return d.track;
}

/**
 * Find a playable video for today's track. Without one, move to a backup that
 * has a video. Returns { track, ids, src, error, offline, changed }.
 */
export async function settleTrack(p, { onTry } = {}) {
  const d = p.dashboard; let cur = d && d.track;
  if (!cur) return null;
  if (cur.settled) { const r = await resolveVideos(cur); return { track: cur, ...r, changed: false }; }
  const order = [cur, ...(cur.alts || [])].slice(0, SETTLE_TRIES);
  let firstResult = null;
  for (const t of order) {
    if (onTry) onTry(t);
    const r = await resolveVideos(t);
    if (!firstResult) firstResult = r;
    if (r.ids.length) {
      const changed = t.key !== cur.key;
      if (changed) cur = adopt(p, t);
      cur.settled = true;
      return { track: cur, ...r, changed };
    }
    if (r.offline) return { track: cur, ...r, changed: false }; // try again next time
  }
  cur.settled = true;
  return { track: cur, ...firstResult, changed: false };
}

/** Catalog song for the track, if it's one the app can teach. */
export function teachable(t) { return songMatch(t.title, t.artist); }

/** Pictures for the track's tile before a video is found: the song page, then the artist. */
export function trackImageTitles(t) { return [...(t.wikiTitles || []), t.artist].filter(Boolean); }

/** Does a track (by key) look like a stored song the student already has? */
export function linkedSong(p, t) {
  if (t.songId) { const s = (p.songs || []).find(x => x.id === t.songId); if (s) return s; }
  return (p.songs || []).find(s => norm(s.title) === norm(t.title) && (!s.artist || titleMatches(s.title, t.title) && (artistMatches(t.artist, s.artist) || artistMatches(s.artist, t.artist)))) || null;
}
