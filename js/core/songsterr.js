// Songsterr: find a song's interactive tab. Uses Songsterr's public search API
// (no key) for titles, artists and the instrument parts each tab has (with
// tuning and difficulty), and links to Songsterr's own player to play the tab.
// The tabs themselves stay on Songsterr: the app only stores which Songsterr
// song a song is, plus the part names and tunings it lists.
// Results are cached for a day so the app makes as few requests as possible.

const API = 'https://www.songsterr.com/api/songs';
const LEGACY = 'https://www.songsterr.com/a/ra/songs.json';
const SITE = 'https://www.songsterr.com';
const CACHE_STORE = 'fretworkCoach.songsterr.v1';
const DAY = 86400000;

let cache = {};
try { cache = JSON.parse(localStorage.getItem(CACHE_STORE) || '{}') || {}; } catch { cache = {}; }
function persist() {
  try {
    const keys = Object.keys(cache);
    if (keys.length > 120) keys.sort((a, b) => cache[a].at - cache[b].at).slice(0, keys.length - 120).forEach(k => delete cache[k]);
    localStorage.setItem(CACHE_STORE, JSON.stringify(cache));
  } catch { /* storage full or off */ }
}
let blocked = false; // the browser refused the request (e.g. CORS): stop trying for this visit
export const searchBlocked = () => blocked;

/* ------------------------------ Links ------------------------------ */
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Songsterr's player for a song (its documented song link). */
export const songUrl = item => `${SITE}/a/wa/song?id=${encodeURIComponent(item.songId)}`;
/** Songsterr's player opened on one part (track index from the search result). */
export const trackUrl = (item, index) => `${SITE}/a/wsa/${slug(item.artist)}-${slug(item.title)}-tab-s${item.songId}t${index}`;
export const artistUrl = item => (item.artistId ? `${SITE}/a/wsa/${slug(item.artist)}-tabs-a${item.artistId}` : `${SITE}/?pattern=${encodeURIComponent(item.artist)}`);
/** Songsterr's best match for a title (and artist), no request from the app needed. */
export const bestMatchUrl = (title, artist = '') => `${SITE}/a/wa/bestMatchForQueryStringPart?s=${encodeURIComponent(title)}${artist ? `&a=${encodeURIComponent(artist)}` : ''}`;
export const siteSearchUrl = q => `${SITE}/?pattern=${encodeURIComponent(q)}`;

/* ---------------------------- Parsing ---------------------------- */
const NOTE = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const KNOWN_TUNINGS = {
  '40,45,50,55,59,64': 'Standard', '38,45,50,55,59,64': 'Drop D', '39,44,49,54,58,63': 'E♭ standard', '38,43,48,53,57,62': 'D standard',
  '36,43,48,53,57,62': 'Drop C', '37,44,49,54,58,63': 'Drop C♯', '38,45,50,55,57,62': 'DADGAD', '38,43,50,55,59,62': 'Open G', '38,45,50,54,57,62': 'Open D', '40,47,52,56,59,64': 'Open E',
  '28,33,38,43': 'Standard (bass)', '26,33,38,43': 'Drop D (bass)', '27,32,37,42': 'E♭ standard (bass)', '23,28,33,38,43': '5-string bass'
};
/** Tuning name from MIDI notes (any order). */
export function tuningLabel(midis) {
  if (!Array.isArray(midis) || !midis.length || !midis.every(n => Number.isFinite(n))) return '';
  const low = [...midis].sort((a, b) => a - b);
  return KNOWN_TUNINGS[low.join(',')] || low.map(n => NOTE[((n % 12) + 12) % 12]).join(' ');
}
const kindOf = (instrument, name) => {
  const t = `${instrument || ''} ${name || ''}`.toLowerCase();
  if (/drum|percussion/.test(t)) return 'drums';
  if (/bass/.test(t) && !/bass(o|oon)/.test(t)) return 'bass';
  if (/vocal|voice|voice/.test(t)) return 'vocals';
  if (/guitar|gtr|acoustic|electric|overdrive|distortion|nylon|steel|jazz gtr|clean/.test(t)) return 'guitar';
  return 'other';
};
const DIFF = { VERY_EASY: 1, EASY: 2, BELOW_INTERMEDIATE: 3, INTERMEDIATE: 4, UPPER_INTERMEDIATE: 5, ADVANCED: 6, VERY_ADVANCED: 7 };
const diffText = d => (typeof d === 'number' ? d : DIFF[String(d || '').toUpperCase()] || null);

/** One search result, from either API shape. */
export function normalizeSong(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const songId = raw.songId ?? raw.id;
  const title = String(raw.title || '').trim();
  const artist = String(typeof raw.artist === 'object' && raw.artist ? raw.artist.name || '' : raw.artist || '').trim();
  if (songId == null || !title) return null;
  const tracks = (Array.isArray(raw.tracks) ? raw.tracks : []).map((t, index) => {
    const instrument = String(t.instrument || t.instrumentName || '').trim();
    const name = String(t.name || t.title || '').trim();
    const tuning = Array.isArray(t.tuning) ? t.tuning.filter(n => Number.isFinite(n)) : [];
    return { index, name, instrument, kind: kindOf(instrument, name), tuning, tuningName: tuningLabel(tuning), difficulty: diffText(t.difficulty), views: Number(t.views) || 0 };
  });
  const types = Array.isArray(raw.tabTypes) ? raw.tabTypes : [];
  return {
    songId: Number(songId) || songId, title, artist,
    artistId: raw.artistId ?? (raw.artist && raw.artist.id) ?? null,
    hasChords: !!(raw.hasChords || raw.chordsPresent || types.includes('CHORDS')),
    hasPlayer: raw.hasPlayer !== false && (types.length ? types.includes('PLAYER') : true),
    defaultTrack: Number.isInteger(raw.defaultTrack) ? raw.defaultTrack : Number.isInteger(raw.popularTrack) ? raw.popularTrack : null,
    tracks
  };
}
/** The guitar parts first (most viewed first), then bass, then the rest; drums and vocals last. */
export function partsOf(item) {
  const order = { guitar: 0, bass: 1, other: 2, vocals: 3, drums: 4 };
  return [...(item.tracks || [])].sort((a, b) => order[a.kind] - order[b.kind] || b.views - a.views || a.index - b.index);
}
/** A one-line summary: "2 guitars · bass · drums". */
export function partsSummary(item) {
  const n = k => (item.tracks || []).filter(t => t.kind === k).length;
  const bits = [];
  if (n('guitar')) bits.push(n('guitar') === 1 ? '1 guitar' : `${n('guitar')} guitars`);
  if (n('bass')) bits.push('bass');
  if (n('drums')) bits.push('drums');
  if (n('other')) bits.push(`${n('other')} other`);
  return bits.join(' · ') || (item.hasPlayer ? 'interactive tab' : '');
}

/* ---------------------------- Matching ---------------------------- */
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
/** How well a result matches the song we're looking for (0–1). */
export function matchScore(item, title, artist = '') {
  const t = norm(title), a = norm(artist), it = norm(item.title), ia = norm(item.artist);
  let s = 0;
  if (it === t) s += 0.6; else if (it.startsWith(t) || t.startsWith(it)) s += 0.4; else if (it.includes(t) || t.includes(it)) s += 0.25;
  if (a) { if (ia === a) s += 0.4; else if (ia.includes(a) || a.includes(ia)) s += 0.25; } else s += 0.1;
  return Math.min(1, s);
}

/* ----------------------------- Search ----------------------------- */
async function getJSON(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) { const e = new Error(`Songsterr answered ${res.status}`); e.status = res.status; throw e; }
  return res.json();
}
/**
 * Search Songsterr. Returns {items, error?, blocked?, cached?}.
 * items: [{songId, title, artist, artistId, hasChords, hasPlayer, defaultTrack, tracks:[{index, name, instrument, kind, tuning, tuningName, difficulty, views}]}]
 */
export async function searchSongsterr(query, { size = 10, fetchImpl = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null) } = {}) {
  const q = String(query || '').replace(/\s+/g, ' ').trim();
  if (q.length < 2) return { items: [] };
  const key = q.toLowerCase();
  const hit = cache[key];
  if (hit && Date.now() - hit.at < DAY) return { items: hit.items, cached: true };
  if (blocked || !fetchImpl) return { items: [], blocked: true, error: 'Songsterr can’t be searched from this browser.' };
  try {
    let raw;
    try { raw = await getJSON(`${API}?pattern=${encodeURIComponent(q)}&size=${size}`, fetchImpl); }
    catch (e) { if (e.status) raw = await getJSON(`${LEGACY}?pattern=${encodeURIComponent(q)}`, fetchImpl); else throw e; }
    const list = Array.isArray(raw) ? raw : Array.isArray(raw && raw.songs) ? raw.songs : Array.isArray(raw && raw.records) ? raw.records : [];
    const items = list.map(normalizeSong).filter(Boolean).slice(0, size);
    cache[key] = { at: Date.now(), items }; persist();
    return { items };
  } catch (e) {
    // A TypeError means the browser stopped the request (offline, or Songsterr doesn't allow other sites to call it)
    if (!e.status) { blocked = typeof navigator === 'undefined' || navigator.onLine !== false; return { items: [], blocked: true, error: 'Songsterr’s search couldn’t be reached from the app.' }; }
    return { items: [], error: e.message };
  }
}
/** Best result for a song (title + artist), or null; the rest come back too. */
export async function findSong(title, artist = '', opts) {
  const r = await searchSongsterr(`${artist} ${title}`.trim(), opts);
  let items = r.items;
  if (!items.length && artist && !r.blocked) items = (await searchSongsterr(title, opts)).items;
  const ranked = items.map(it => ({ it, s: matchScore(it, title, artist) })).sort((a, b) => b.s - a.s);
  return { best: ranked.length && ranked[0].s >= 0.6 ? ranked[0].it : null, items: ranked.map(x => x.it), blocked: r.blocked, error: r.error };
}
/** What the app keeps on a song once linked. */
export function linkInfo(item) {
  return { songId: item.songId, title: item.title, artist: item.artist, artistId: item.artistId || null, hasChords: !!item.hasChords, defaultTrack: item.defaultTrack,
    tracks: partsOf(item).slice(0, 12).map(t => ({ index: t.index, name: t.name, instrument: t.instrument, kind: t.kind, tuning: t.tuning, tuningName: t.tuningName, difficulty: t.difficulty })), linkedAt: Date.now() };
}
export function _resetForTests() { cache = {}; blocked = false; persist(); }
