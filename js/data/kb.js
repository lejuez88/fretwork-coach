// The knowledge base: techniques, subjects and styles taught as learning paths
// (foundations → intermediate → advanced → mastery), and the Artist Series.
// The catalog (js/data/index.js, generated) is small and loads at startup; each
// entry's lessons live in their own file (js/data/kb/<id>.js, js/data/artists/<id>.js)
// and load only when a page or a course needs them.
import { KB_INDEX, ARTIST_INDEX } from './index.js';
import { TIERS, TIER_BY_ID, tierOf } from './lib.js';

export { KB_INDEX, ARTIST_INDEX, TIERS, TIER_BY_ID, tierOf };
export const KB_BY_ID = Object.fromEntries(KB_INDEX.map(e => [e.id, e]));
export const ARTIST_META_BY_ID = Object.fromEntries(ARTIST_INDEX.map(a => [a.id, a]));
export const KINDS = [['technique', 'Techniques'], ['subject', 'Subjects'], ['style', 'Styles']];
export const ARTIST_NOTE = 'Use the Songs tab to learn the real thing: add the song, paste or import a tab, and the app turns it into section lessons.';

/** Entries named in a request, in the order they appear (catalog entries, not loaded). */
export function matchTechniques(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return [];
  return KB_INDEX.map(x => {
    const m = t.match(x.re);
    const al = !m && (x.aliases || []).map(a => t.indexOf(String(a).toLowerCase())).filter(i => i >= 0).sort((a, b) => a - b)[0];
    return m ? { x, at: m.index } : al != null && al !== false && al >= 0 ? { x, at: al } : null;
  }).filter(Boolean).sort((a, b) => a.at - b.at).map(m => m.x);
}
/** The artist named in a text (or null). */
export function matchArtist(text) {
  const t = String(text || '').toLowerCase();
  return t ? ARTIST_INDEX.find(a => a.re.test(t)) || null : null;
}
/** Artists whose lessons use an entry. */
export const artistsUsing = id => ARTIST_INDEX.filter(a => (a.uses || []).includes(id));
/** Recommended level range of an entry ([lo, hi]). */
export const techniqueLevel = e => (e && Array.isArray(e.level) ? e.level : [1, 10]);
/** Stage of an entry for a level: the one whose range contains it, else the nearest. */
export function stageFor(meta, lvl) {
  const st = meta.stages || [];
  return st.find(s => lvl >= s.levels[0] && lvl <= s.levels[1]) || st.slice().sort((a, b) => Math.abs(a.levels[0] - lvl) - Math.abs(b.levels[0] - lvl))[0] || null;
}

const cache = new Map();
/** Load an entry's lessons. Resolves to the full entry (stages with skills and generators). */
export function loadEntry(id) {
  if (!KB_BY_ID[id]) return Promise.reject(new Error('Unknown topic ' + id));
  if (!cache.has('kb:' + id)) cache.set('kb:' + id, import(`./kb/${id}.js`).then(m => m.default));
  return cache.get('kb:' + id);
}
/** Load an artist's curriculum. */
export function loadArtist(id) {
  if (!ARTIST_META_BY_ID[id]) return Promise.reject(new Error('Unknown artist ' + id));
  if (!cache.has('artist:' + id)) cache.set('artist:' + id, import(`./artists/${id}.js`).then(m => m.default));
  return cache.get('artist:' + id);
}
export const loadEntries = ids => Promise.all(ids.map(loadEntry));
