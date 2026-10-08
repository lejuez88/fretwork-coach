// YouTube for Track of the Day: find a playable video for a track and embed it.
//
// Finding a video happens in the browser, in this order:
//   1. A cached answer (or a link the student pasted).
//   2. Wikidata: the song's “YouTube video ID” (P1651). No key needed. The
//      Wikidata item must be a song by the right artist, so a page with the same
//      title can't produce the wrong video.
//   3. The YouTube Data API v3, when the student saved a key in Settings. Results
//      are ranked toward the artist's own channel, official uploads and “Topic”
//      audio, and away from covers, lessons and reactions.
// The key is stored only in this browser (never in the profile or exports).
import { today } from './util.js';
import { cleanKey, storeKey, fingerprint, networkAdvice } from './keys.js';

const KEY_STORE = 'fretworkCoach.youtubeKey';
const CACHE_STORE = 'fretworkCoach.ytCache.v1';
const DAY = 86400000;
const VALID_ID = /^[A-Za-z0-9_-]{11}$/;

/* ------------------------------- Key -------------------------------- */
export function getKey() { try { return cleanKey(localStorage.getItem(KEY_STORE) || '', 'youtube'); } catch { return ''; } }
/** Save (or remove, when empty) the key. Returns { ok, reason, key } with the cleaned key. */
export function setKey(k) { const key = cleanKey(k, 'youtube'); return { ...storeKey(KEY_STORE, key), key }; }
export function hasKey() { return !!getKey(); }
/** Which key a cached lookup was made with (so a new or fixed key looks again). */
const keyTag = () => { const k = getKey(); return k ? k.slice(-6) : false; };

/* ------------------------------ Cache ------------------------------- */
let cache = {};
try { cache = JSON.parse(localStorage.getItem(CACHE_STORE) || '{}') || {}; } catch { cache = {}; }
function persist() { try { localStorage.setItem(CACHE_STORE, JSON.stringify(cache)); } catch { /* full */ } }
export function cachedVideo(key) { return cache[key] || null; }
export function clearVideo(key) { delete cache[key]; persist(); }
/** The student's own link for a track: it wins over everything else. */
export function setVideo(key, id) {
  if (!VALID_ID.test(id)) return false;
  const prev = cache[key] || {};
  cache[key] = { ids: [id], src: 'you', at: Date.now(), keyed: keyTag(), bad: (prev.bad || []).filter(x => x !== id) };
  persist(); return true;
}
/** Remember that a video can't play here (removed, private or not embeddable). */
export function markBad(key, id) {
  const c = cache[key] || (cache[key] = { ids: [], src: 'none', at: Date.now(), keyed: keyTag(), bad: [] });
  c.bad = [...new Set([...(c.bad || []), id])].slice(-20);
  c.ids = (c.ids || []).filter(x => x !== id);
  persist();
}

/** Video ID from a YouTube URL (watch, youtu.be, shorts, embed, music) or a bare ID. */
export function parseVideoId(s) {
  s = String(s || '').trim();
  if (VALID_ID.test(s)) return s;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
    const h = u.hostname.replace(/^www\.|^m\.|^music\./, '');
    if (h === 'youtu.be') { const id = u.pathname.split('/')[1]; return VALID_ID.test(id) ? id : null; }
    if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v'); if (v && VALID_ID.test(v)) return v;
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/); if (m) return m[1];
    }
  } catch { /* not a URL */ }
  return null;
}

export const watchUrl = id => `https://www.youtube.com/watch?v=${id}`;
export const thumbUrl = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const searchUrl = t => `https://www.youtube.com/results?search_query=${encodeURIComponent(queryFor(t))}`;
export const musicSearchUrl = t => `https://music.youtube.com/search?q=${encodeURIComponent(queryFor(t))}`;
export function queryFor(t) { return t.q || [t.artist, t.title].filter(Boolean).join(' '); }

/* ---------------------------- Matching ------------------------------ */
const STOP = new Set(['the', 'and', 'from', 'with', 'band', 'his', 'her', 'their', 'feat', 'featuring', 'song', 'single', 'by']);
export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const tokens = s => norm(s).split(' ').filter(w => w.length >= 3 && !STOP.has(w));
const padded = s => ` ${norm(s)} `;

/** Does `text` name `artist`? Whole-name containment, or most of the artist's words. */
export function artistMatches(text, artist) {
  const t = norm(text), a = norm(artist).replace(/^the /, '');
  if (!t || !a) return false;
  if (padded(t).includes(` ${a} `)) return true;
  const shortT = t.replace(/^the /, '');
  if (shortT.length >= 3 && padded(a).includes(` ${shortT} `)) return true; // “TK” in “TK from Ling Tosite Sigure”
  const at = tokens(artist); if (!at.length) return false;
  const tt = new Set(tokens(text));
  const hits = at.filter(w => tt.has(w)).length;
  return hits >= Math.min(2, at.length);
}
/** Does a label or video title name the song? */
export function titleMatches(text, title) {
  const t = norm(text), s = norm(title).replace(/^the /, '');
  if (!t || !s) return false;
  const base = norm(String(title).replace(/\(.*?\)/g, '')).replace(/^the /, '');
  if (padded(t).includes(` ${s} `) || (base.length >= 3 && padded(t).includes(` ${base} `))) return true;
  const st = tokens(title); if (!st.length) return false;
  const tt = new Set(tokens(text));
  return st.filter(w => tt.has(w)).length / st.length >= 0.75;
}

/* ------------------------------- HTTP -------------------------------- */
async function getJSON(url, ms = 9000) {
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), ms) : null;
  try {
    const r = await fetch(url, ac ? { signal: ac.signal } : {});
    let j = null; try { j = await r.json(); } catch { /* not JSON */ }
    if (!r.ok) {
      const msg = j && j.error && (j.error.message || j.error.info) || `HTTP ${r.status}`;
      const err = new Error(String(msg).replace(/<[^>]+>/g, '')); err.status = r.status; err.api = true; throw err;
    }
    return j;
  } finally { if (timer) clearTimeout(timer); }
}

/* ----------------------------- Wikidata ------------------------------ */
// Items that are clearly not a song: people, bands, albums, disambiguation pages.
const NOT_SONG = new Set(['Q5', 'Q215380', 'Q5741069', 'Q482994', 'Q4167410', 'Q2088357', 'Q9212979', 'Q169930', 'Q208569', 'Q1371849']);
const claimIds = (claims, p) => (claims[p] || []).map(c => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value).filter(Boolean);

/** Wikipedia titles to try for a track, most specific first. */
export function wikiCandidates(t) {
  const list = [...(t.wikiTitles || [])];
  if (t.title) {
    if (t.artist) list.push(`${t.title} (${t.artist} song)`);
    list.push(`${t.title} (song)`, t.title);
  }
  return list.filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 6);
}

export async function wikidataVideos(t) {
  const titles = wikiCandidates(t);
  if (!titles.length) return [];
  const wp = await getJSON('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageprops&ppprop=wikibase_item&titles='
    + encodeURIComponent(titles.join('|')));
  const q = wp && wp.query || {};
  const step = (list, from) => { const hit = (list || []).find(x => x.from === from); return hit ? hit.to : from; };
  const byTitle = {};
  for (const pg of Object.values(q.pages || {})) if (pg && pg.pageprops && pg.pageprops.wikibase_item) byTitle[pg.title] = pg.pageprops.wikibase_item;
  const qids = [];
  for (const title of titles) {
    const final = step(q.redirects, step(q.normalized, title));
    const id = byTitle[final];
    if (id && !qids.includes(id)) qids.push(id);
  }
  if (!qids.length) return [];
  const wd = await getJSON('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=claims|labels|descriptions&languages=en&ids='
    + qids.join('|'));
  const ents = wd && wd.entities || {};
  for (const id of qids) {
    const e = ents[id]; if (!e || e.missing != null) continue;
    const claims = e.claims || {};
    if (!claims.P1651) continue;
    if (claimIds(claims, 'P31').some(c => NOT_SONG.has(c.id))) continue;
    const label = e.labels && e.labels.en ? e.labels.en.value : '';
    if (!titleMatches(label, t.title)) continue;
    if (t.artist && !(await byArtist(e, t.artist))) continue;
    const vids = claims.P1651
      .filter(c => c.rank !== 'deprecated')
      .sort((a, b) => (b.rank === 'preferred') - (a.rank === 'preferred'))
      .map(c => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value)
      .filter(v => typeof v === 'string' && VALID_ID.test(v));
    if (vids.length) return [...new Set(vids)].slice(0, 4);
  }
  return [];
}

/** Is this Wikidata item by the artist? Check the description, then the performer/composer labels. */
async function byArtist(e, artist) {
  const desc = e.descriptions && e.descriptions.en ? e.descriptions.en.value : '';
  if (artistMatches(desc, artist)) return true;
  const claims = e.claims || {};
  const people = ['P175', 'P86', 'P676', 'P870'].flatMap(p => claimIds(claims, p).map(v => v.id)).filter(Boolean).slice(0, 6);
  if (!people.length) return false;
  const j = await getJSON('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=labels|aliases&languages=en&ids=' + people.join('|'));
  return Object.values(j && j.entities || {}).some(p => {
    const names = [p.labels && p.labels.en && p.labels.en.value, ...((p.aliases && p.aliases.en) || []).map(a => a.value)].filter(Boolean);
    return names.some(n => artistMatches(n, artist) || artistMatches(artist, n));
  });
}

/* --------------------------- YouTube search -------------------------- */
const JUNK = /\b(cover|covers|covered|lesson|tutorial|how to play|karaoke|reaction|reacts|reacting|backing track|jam track|guitar only|isolated|play ?along|playthrough|tabs?|chords|drum|drums|bass cover|piano|ukulele|remix|sped up|slowed|nightcore|8d|1 hour|loop|lyrics? (?:español|traducida)|shorts?)\b/i;
const compact = s => norm(s).replace(/^the /, '').replace(/ /g, '');
/** Channel names often squash the artist together (“StevieRayVaughanVEVO”). */
function channelIsArtist(ch, artist) {
  const c = ch.replace(/\s*-\s*topic$/i, '').replace(/\s*vevo$/i, '').replace(/\s*official$/i, '');
  if (artistMatches(c, artist)) return true;
  const a = compact(artist), cc = compact(c);
  return cc.length >= 5 && a.length >= 5 && (a.startsWith(cc) || cc.startsWith(a));
}
export function scoreVideo(item, t) {
  const sn = item.snippet || {};
  const title = decodeEntities(sn.title || ''), ch = decodeEntities(sn.channelTitle || '');
  const ownTitle = norm(t.title);
  let s = 0;
  if (titleMatches(title, t.title)) s += 4; else s -= 6; // a different song is never the answer
  if (t.artist && channelIsArtist(ch, t.artist)) s += 5;
  if (/\s-\s*topic$/i.test(ch)) s += 2;
  if (/vevo/i.test(ch)) s += 2;
  if (/official|remaster/i.test(title)) s += 2;
  if (t.artist && artistMatches(title, t.artist)) s += 1;
  const junk = title.match(JUNK);
  if (junk && !ownTitle.includes(norm(junk[0]))) s -= 7;
  if (/\blive\b/i.test(title) && !/\blive\b/.test(ownTitle)) s -= 2;
  return s;
}
function decodeEntities(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export async function youtubeSearch(t, key = getKey(), { max = 10 } = {}) {
  if (!key) return [];
  const base = { part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: String(max), q: queryFor(t), key };
  const run = async extra => {
    const j = await getJSON('https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams({ ...base, ...extra }));
    return (j && j.items || []).filter(it => it.id && VALID_ID.test(it.id.videoId));
  };
  let items = await run({ videoCategoryId: '10' });
  if (!items.length) items = await run({});
  return items.filter(it => titleMatches(decodeEntities(it.snippet && it.snippet.title || ''), t.title))
    .map(it => ({ id: it.id.videoId, s: scoreVideo(it, t) }))
    .filter(x => x.s >= 3)
    .sort((a, b) => b.s - a.s)
    .map(x => x.id)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 4);
}

/** Check a key with the cheapest useful call. */
export async function testKey(key) {
  let j;
  try { j = await getJSON('https://www.googleapis.com/youtube/v3/videos?' + new URLSearchParams({ part: 'id', id: 'jNQXAC9IVRw', key })); }
  catch (e) { throw new Error(explainError(e, key)); }
  if (!j || !Array.isArray(j.items)) throw new Error('Unexpected reply from YouTube.');
  return true;
}
/** What a failed YouTube call means, in plain words. */
export function explainError(e, key = getKey()) {
  if (!e || !e.api) return e && e.name === 'AbortError' ? 'YouTube took too long to answer. Try again.' : networkAdvice('YouTube (www.googleapis.com)');
  const m = String(e.message || '');
  const ref = m.match(/referer\s+(\S*)\s+are blocked/i);
  if (ref || /referer/i.test(m)) return `This key only works on the websites listed in its settings, and this page (${location.origin || 'this site'}) isn’t one of them. In Google Cloud → APIs & Services → Credentials → your key → Website restrictions, add ${location.origin ? location.origin + '/*' : 'https://lejuez88.github.io/*'} (the same entry works on every device).`;
  if (/ip address/i.test(m)) return 'This key is limited to certain IP addresses, so it only works on one network. In Google Cloud → Credentials → your key, switch Application restrictions to Websites instead.';
  if (/api key not valid|invalid/i.test(m)) return `Google says this key isn’t valid (${fingerprint(key, 'youtube')}). Compare it with the key that works on your other device, or paste it again.`;
  if (/quota/i.test(m)) return 'This key has used up today’s free YouTube quota. It resets at midnight Pacific time.';
  if (/has not been used|disabled|not enabled/i.test(m)) return 'The YouTube Data API v3 isn’t turned on for this key’s Google Cloud project. Enable it under APIs & Services → Library.';
  return 'YouTube said: ' + m;
}

/* ----------------------------- Resolver ------------------------------ */
/**
 * Playable video IDs for a track: { ids, src, error }.
 * src: 'you' (pasted link) | 'wikidata' | 'youtube' | 'none'.
 */
export async function resolveVideos(t, { refresh = false } = {}) {
  const key = t.key;
  const c = cache[key];
  const bad = new Set((c && c.bad) || []);
  if (c && !refresh) {
    const ids = (c.ids || []).filter(id => !bad.has(id));
    if (ids.length) return { ids, src: c.src };
    const stale = Date.now() - (c.at || 0) > 21 * DAY;
    const keyNow = hasKey() && c.keyed !== keyTag();
    if (c.src === 'none' && !stale && !keyNow) return { ids: [], src: 'none' };
  }
  let ids = [], src = 'none', error = null, netFail = false, ytFail = false;
  try { ids = (await wikidataVideos(t)).filter(id => !bad.has(id)); if (ids.length) src = 'wikidata'; }
  catch (e) { error = e.message; netFail = !e.api; }
  if (!ids.length && hasKey()) {
    try { ids = (await youtubeSearch(t)).filter(id => !bad.has(id)); if (ids.length) { src = 'youtube'; error = null; } }
    catch (e) { error = explainError(e); ytFail = true; netFail = netFail && !e.api; }
  }
  // Don't remember a miss caused by a network failure or a key problem; try again next time.
  if (ids.length || (!netFail && !ytFail)) { cache[key] = { ids, src, at: Date.now(), keyed: keyTag(), bad: [...bad], day: today() }; persist(); }
  return { ids, src, error, offline: !ids.length && netFail };
}

/* ------------------------------ Player ------------------------------- */
let apiPromise = null;
/** Load the YouTube IFrame Player API once. */
export function loadYT(timeout = 9000) {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { try { if (typeof prev === 'function') prev(); } catch { /* ignore */ } resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = () => { apiPromise = null; reject(new Error('The YouTube player could not load.')); };
    document.head.appendChild(s);
    setTimeout(() => { if (!(window.YT && window.YT.Player)) { apiPromise = null; reject(new Error('The YouTube player took too long to load.')); } }, timeout);
  });
  return apiPromise;
}

const ERRORS = { 2: 'The video link is invalid.', 5: 'The video can’t play in this browser.', 100: 'The video was removed or is private.', 101: 'The owner doesn’t allow this video to play inside other sites.', 150: 'The owner doesn’t allow this video to play inside other sites.' };
export const playerError = code => ERRORS[code] || 'The video can’t play here.';

/**
 * The standard YouTube embed player (the same iframe as YouTube's Share → Embed),
 * shown right away with YouTube's own controls. The IFrame API is attached to it
 * only to notice a copy that can't play here and move on to the next one.
 * Calls onBad(id, code) for each failed video, onFail(code) when none play and
 * onState(state) on play/pause. Returns { destroy(), play(), pause(), playing, ready }.
 */
export function mountEmbed(host, ids, { onBad, onFail, onState, autoplay = false } = {}) {
  let i = 0, player = null, dead = false, state = -1;
  const origin = typeof location !== 'undefined' && /^https?:/.test(location.origin) ? `&origin=${encodeURIComponent(location.origin)}` : '';
  const src = id => `https://www.youtube.com/embed/${id}?enablejsapi=1&rel=0&playsinline=1${autoplay ? '&autoplay=1' : ''}${origin}`;
  host.innerHTML = `<div class="yt-embed"><iframe width="560" height="315" src="${src(ids[0])}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
  const frame = host.querySelector('iframe');
  const ctl = {
    ready: false,
    get playing() { return state === 1 || state === 3; },
    get id() { return ids[i]; },
    play() { try { if (player && player.playVideo) player.playVideo(); } catch { /* not ready */ } },
    pause() { try { if (player && player.pauseVideo) player.pauseVideo(); } catch { /* not ready */ } },
    destroy() { dead = true; try { if (player && player.destroy) player.destroy(); } catch { /* gone */ } player = null; host.innerHTML = ''; }
  };
  loadYT().then(YT => {
    if (dead || !frame.isConnected) return;
    player = new YT.Player(frame, { events: {
      onReady: () => { ctl.ready = true; if (onState) onState(state); },
      onStateChange: e => { state = e.data; if (onState) onState(e.data); },
      onError: e => {
        if (dead) return;
        if (onBad) onBad(ids[i], e.data);
        i++;
        if (i < ids.length) { try { player.loadVideoById(ids[i]); } catch { if (onFail) onFail(e.data); } }
        else if (onFail) onFail(e.data);
      }
    } });
  }).catch(() => { /* the embed still plays on its own; only error detection is lost */ });
  return ctl;
}
export const musicUrl = id => `https://music.youtube.com/watch?v=${id}`;

/**
 * Embed a player in `host` and play the first ID; on an error move to the next.
 * Calls onBad(id, code) for each failed video and onFail(code) when none play.
 * Returns { destroy(), pause() }.
 */
export function mountPlayer(host, ids, { onBad, onFail, onState } = {}) {
  let i = 0, player = null, dead = false;
  const ctl = {
    destroy() { dead = true; try { player && player.destroy && player.destroy(); } catch { /* gone */ } player = null; if (host) host.innerHTML = ''; },
    pause() { try { player && player.pauseVideo && player.pauseVideo(); } catch { /* not ready */ } }
  };
  host.innerHTML = '<div class="yt-frame"><div class="yt-target"></div><div class="yt-loading">Loading player…</div></div>';
  const target = host.querySelector('.yt-target');
  loadYT().then(YT => {
    if (dead) return;
    player = new YT.Player(target, {
      host: 'https://www.youtube-nocookie.com',
      videoId: ids[0], width: '100%', height: '100%',
      playerVars: { autoplay: 1, rel: 0, playsinline: 1, modestbranding: 1, origin: location.origin },
      events: {
        onReady: e => { const l = host.querySelector('.yt-loading'); if (l) l.remove(); try { e.target.playVideo(); } catch { /* blocked autoplay */ } },
        onStateChange: e => { if (onState) onState(e.data); },
        onError: e => {
          if (dead) return;
          if (onBad) onBad(ids[i], e.data);
          i++;
          if (i < ids.length) { try { player.loadVideoById(ids[i]); } catch { if (onFail) onFail(e.data); } }
          else if (onFail) onFail(e.data);
        }
      }
    });
  }).catch(() => {
    if (dead) return;
    // Fallback: a plain embed (no error detection, but it plays).
    const src = `https://www.youtube-nocookie.com/embed/${ids[0]}?autoplay=1&rel=0&playsinline=1`;
    host.innerHTML = `<div class="yt-frame"><iframe src="${src}" title="YouTube video player" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  });
  return ctl;
}
