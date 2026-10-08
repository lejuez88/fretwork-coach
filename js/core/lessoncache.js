// Lesson cache: master classes and request exercises that Claude has designed
// are kept in the profile, so asking for the same thing again (in the same or
// slightly different words) reuses them with no API call. It lives in the
// profile, so it travels with Export and Google Drive to your other devices.
// Entries are matched by their meaningful words (order and filler words don't
// matter) and, for master classes, by the starting level (in steps of two).

const STOP = new Set(('a an the and or of on in for with to from into by at as is are be me my i im i\'m we our you your can could would '
  + 'please want wanna like help learn learning master masterclass class classes course courses lesson lessons style styles covering cover '
  + 'such including include includes most commonly common used uses use his her their its techniques technique some how play playing '
  + 'make build create give get do that this these those them it about around based also plus etc really just more better').split(' '));
export const MAX_MASTERS = 10, MAX_REQUESTS = 60, MAX_BYTES = 900000;

/** The meaningful words of a request, normalized (pentatonics → pentatonic, 5s → 5). */
export function requestWords(text) {
  const words = String(text || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9♯♭#]+/g, ' ').split(' ')
    .filter(Boolean).map(w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : /^\d+s$/.test(w) ? w.slice(0, -1) : w))
    .filter(w => !STOP.has(w));
  return [...new Set(words)].sort();
}
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size && !B.size) return 1; let n = 0; A.forEach(x => { if (B.has(x)) n++; }); return n / (A.size + B.size - n); };
export const levelBucket = d => Math.max(1, Math.min(5, Math.ceil((Number(d) || 4) / 2)));

function store(p) {
  if (!p.lessonCache || typeof p.lessonCache !== 'object') p.lessonCache = { masters: [], requests: [] };
  if (!Array.isArray(p.lessonCache.masters)) p.lessonCache.masters = [];
  if (!Array.isArray(p.lessonCache.requests)) p.lessonCache.requests = [];
  return p.lessonCache;
}
function find(list, words, extra = () => true) {
  let best = null, score = 0;
  for (const e of list) { if (!extra(e)) continue; const s = jaccard(words, e.words); if (s > score) { best = e; score = s; } }
  return score >= 0.8 ? best : null;
}
const clone = o => JSON.parse(JSON.stringify(o));
function trim(p) {
  const c = store(p);
  const byUse = (a, b) => (b.used || 0) - (a.used || 0);
  c.masters.sort(byUse); c.requests.sort(byUse);
  c.masters.length = Math.min(c.masters.length, MAX_MASTERS);
  c.requests.length = Math.min(c.requests.length, MAX_REQUESTS);
  // keep the whole cache well inside the browser's storage limit
  while ((c.masters.length || c.requests.length) && JSON.stringify(c).length > MAX_BYTES) {
    if (c.masters.length > 1 || !c.requests.length) c.masters.pop(); else c.requests.pop();
  }
}

/** A saved master-class plan for this request and level, or null. Returns a copy. */
export function getMaster(p, text, difficulty) {
  const c = store(p), words = requestWords(text), b = levelBucket(difficulty);
  if (!words.length) return null;
  const e = find(c.masters, words, x => x.bucket === b);
  if (!e) return null;
  e.used = Date.now(); e.hits = (e.hits || 0) + 1;
  return { tree: clone(e.tree), name: e.name || null, tagline: e.tagline || null, savedAt: e.at };
}
/** Save a plan Claude designed. */
export function putMaster(p, text, difficulty, { tree, name = null, tagline = null }) {
  const c = store(p), words = requestWords(text), b = levelBucket(difficulty);
  if (!words.length || !tree || !tree.units || !tree.units.length) return;
  c.masters = c.masters.filter(x => !(x.bucket === b && jaccard(words, x.words) >= 0.8));
  c.masters.unshift({ key: words.join(' '), words, bucket: b, title: String(text).slice(0, 120), tree: clone(tree), name, tagline, at: Date.now(), used: Date.now(), hits: 0 });
  trim(p);
}

/** Saved request exercises ({summary, items}) or null. Returns a copy. */
export function getRequest(p, text) {
  const c = store(p), words = requestWords(text);
  if (!words.length) return null;
  const e = find(c.requests, words);
  if (!e) return null;
  e.used = Date.now(); e.hits = (e.hits || 0) + 1;
  return { summary: e.summary, items: clone(e.items), savedAt: e.at };
}
export function putRequest(p, text, { summary, items }) {
  const c = store(p), words = requestWords(text);
  if (!words.length || !items || !items.length) return;
  c.requests = c.requests.filter(x => jaccard(words, x.words) < 0.8);
  c.requests.unshift({ key: words.join(' '), words, title: String(text).slice(0, 200), summary, items: clone(items), at: Date.now(), used: Date.now(), hits: 0 });
  trim(p);
}

/** What's saved, for Settings: counts and size. */
export function cacheStats(p) {
  const c = store(p);
  return { masters: c.masters.length, requests: c.requests.length, bytes: JSON.stringify(c).length, reused: [...c.masters, ...c.requests].reduce((a, e) => a + (e.hits || 0), 0) };
}
export function clearCache(p) { p.lessonCache = { masters: [], requests: [] }; }
