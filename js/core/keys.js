// API keys (Claude and YouTube): clean up what was pasted, check its shape,
// make sure this browser really keeps it, and describe a saved key without
// showing it, so the same key can be compared across devices.
//
// Pasting a key on a phone often brings extras along: a space or line break
// from a wrapped note or email, invisible formatting characters, a curly
// quote, a dash turned into "–", or a capital first letter from the keyboard.
// Any of these makes the key fail on that device only.

const INVISIBLE = /[\s\u00A0\u1680\u180E\u2000-\u200F\u2028-\u202F\u205F-\u2064\u3000\uFEFF]/g;
const DASHES = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
const QUOTES = /["'\u2018\u2019\u201C\u201D`<>]/g;
const FULL = { anthropic: /^sk-ant-[A-Za-z0-9_-]{30,}$/, youtube: /^AIza[0-9A-Za-z_-]{35}$/ };
const FIND = { anthropic: /sk-ant-[A-Za-z0-9_-]{30,}/, youtube: /AIza[0-9A-Za-z_-]{35}/ };
const fixCase = (k, kind) => (kind === 'anthropic' ? k.replace(/^sk-ant-/i, 'sk-ant-') : kind === 'youtube' ? k.replace(/^aiza/i, 'AIza') : k);

/** The key inside whatever was pasted. kind: 'anthropic' | 'youtube'. */
export function cleanKey(raw, kind) {
  let s = String(raw == null ? '' : raw);
  try { s = s.normalize('NFKC'); } catch { /* old browser */ }
  s = s.replace(DASHES, '-').replace(QUOTES, ' ');
  // A whole key among other words ("My key: sk-ant-…"): take it as it is
  const prose = /[^A-Za-z0-9_\-\s\u00A0\u200B-\u200D\u2060\uFEFF]/.test(s);
  const tokens = s.split(INVISIBLE).filter(Boolean).map(t => fixCase(t, kind));
  const whole = prose && FULL[kind] && tokens.find(t => FULL[kind].test(t));
  if (whole) return whole;
  // Otherwise it's just the key, maybe split by a line break or space: join the pieces
  const joined = fixCase(s.replace(INVISIBLE, ''), kind);
  const m = FIND[kind] && joined.match(FIND[kind]);
  return m ? m[0] : joined;
}

/** Problems with a key's shape, in plain words (empty list = looks right). */
export function keyProblems(k, kind) {
  const out = [];
  if (!k) return out;
  if (kind === 'anthropic') {
    if (!/^sk-ant-/.test(k)) out.push(`Anthropic keys start with “sk-ant-”; this one starts with “${k.slice(0, 7)}”.`);
    if (/[^A-Za-z0-9_-]/.test(k)) out.push('It has characters a key never has.');
    if (k.length < 60) out.push(`It looks cut short (${k.length} characters; Anthropic keys are about 100).`);
  } else if (kind === 'youtube') {
    if (!/^AIza/.test(k)) out.push(`YouTube keys start with “AIza”; this one starts with “${k.slice(0, 4)}”.`);
    if (k.length !== 39) out.push(`YouTube keys are 39 characters long; this one is ${k.length}.`);
    if (/[^A-Za-z0-9_-]/.test(k)) out.push('It has characters a key never has.');
  }
  return out;
}

/** "sk-ant-api03…Wx9Q (108 characters)": enough to compare two devices without showing the key. */
export function fingerprint(k, kind) {
  if (!k) return '';
  const head = k.slice(0, kind === 'anthropic' ? 12 : 6);
  return `${head}…${k.slice(-4)} (${k.length} characters)`;
}

// Rebuildable caches that can be dropped when the browser's storage is full
const CACHE_KEYS = ['fretworkCoach.wikiCache.v1', 'fretworkCoach.ytCache.v1', 'fretworkCoach.lastSummary', 'fretworkCoach.evalPick'];

/**
 * Save a key and read it back. Returns { ok, reason }: reason 'blocked' when
 * the browser refuses to keep website data (private browsing, cookies
 * blocked), 'full' when its storage is full even after dropping caches.
 */
export function storeKey(storeName, value) {
  const write = () => { if (value) localStorage.setItem(storeName, value); else localStorage.removeItem(storeName); };
  try { write(); }
  catch (e) {
    if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
      CACHE_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
      try { write(); } catch { return { ok: false, reason: 'full' }; }
    } else return { ok: false, reason: 'blocked' };
  }
  let back = null;
  try { back = localStorage.getItem(storeName); } catch { return { ok: false, reason: 'blocked' }; }
  return (value ? back === value : back == null) ? { ok: true } : { ok: false, reason: 'blocked' };
}

/** Why a key couldn't be kept, and what to do. */
export function storageAdvice(reason) {
  return reason === 'full'
    ? 'This browser’s storage for the app is full, so the key wasn’t kept. Export your profile as a backup, then clear this site’s data in the browser settings and import it again.'
    : 'This browser didn’t keep the key. Private browsing, or a setting that blocks website data (on iPhone: Settings → Apps → Safari → “Block All Cookies”), stops the app from saving anything. Use a normal tab or turn that setting off, then save the key again.';
}

/** On iPhone/iPad the Home Screen app keeps its own data, separate from Safari. */
export function homeScreenNote() {
  try {
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios && standalone) return 'You’re using the app from your Home Screen. On iPhone and iPad it keeps its own data, separate from Safari, so keys (and your profile) entered in Safari have to be entered here too.';
    if (ios) return 'On iPhone and iPad, the Safari tab and a Home Screen icon of this app keep separate data: enter your keys in the one you use.';
  } catch { /* ignore */ }
  return '';
}

/** A plain-words reason when a request couldn't get through at all. */
export function networkAdvice(host) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return offline ? 'This device is offline.'
    : `Couldn’t reach ${host}. Check the connection; on a phone, a content blocker, VPN, Private Relay or a Wi-Fi filter can also block it.`;
}
