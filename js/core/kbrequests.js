// Knowledge-base requests: when you ask to learn a technique, subject, style or
// guitarist the app doesn't know yet, it offers to add it to the research queue.
// Requests are kept in the profile (so they travel with Export and Drive) and
// written to a small Google Drive file, "Fretwork Coach research requests.json",
// which the scheduled content runs read: they research each request and build it
// into the app as a full learning path (or an Artist Series page).
import { uid, today } from './util.js';
import { matchArtist, matchTechniques } from '../data/kb.js';
import { topicFor } from './master.js';
import { parseRequest } from './topics.js';
import { saveRequestsToDrive, driveReady } from './gdrive.js';

const LOOKALIKE = /slide guitar|bottleneck|lap steel|pedal steel|steel guitar|banjo roll|mandolin/;
export const REQUEST_KINDS = [['technique', 'Technique'], ['subject', 'Subject'], ['style', 'Style'], ['guitarist', 'Guitarist']];
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9♯♭#]+/g, ' ').trim();
const clean = s => String(s || '').replace(/\s+/g, ' ').replace(/\b(style|master ?class|lessons?|course)\b\s*$/i, '').trim().slice(0, 80);

/** A sensible kind for a request's words. */
export function guessKind(text) {
  const t = String(text || '').toLowerCase().trim();
  if (/\b(blues|jazz|funk|metal|country|flamenco|bossa|reggae|rock|soul|gospel|classical|fingerstyle|bluegrass|surf|djent|fusion|neo.?soul|latin|celtic|gypsy|manouche|punk|indie|pop|r&b|shred)\b/.test(t)) return 'style';
  if (/\b(theory|reading|notation|ear|interval|harmony|modes?|scales?|chords? in|arranging|improvis|songwriting|composition|transcrib)/.test(t)) return 'subject';
  if (/^[a-z .'’-]+ style$/.test(t) || /^[A-Z][a-z]+ [A-Z][a-z]+/.test(String(text || '').trim())) return 'guitarist'; // "Yngwie Malmsteen style", "Tosin Abasi"
  return 'technique';
}

/**
 * What's missing from the knowledge base in a request, or null when the app already teaches it.
 * kind: 'guitarist' checks only the Artist Series; otherwise any artist, knowledge-base entry,
 * built-in master class or recognized technique counts as known.
 */
export function knowledgeGap(text, kind = null) {
  const words = clean(text);
  if (words.length < 3) return null;
  if (kind === 'guitarist') return matchArtist(words) ? null : { text: words, kind: 'guitarist' };
  if (matchArtist(text) || matchTechniques(text).length || topicFor(text)) return null;
  // Requests about concrete material (chords, keys, scales, progressions) are answered by the theory engine.
  // Keyword topics alone ("slide", "rhythm") don't count: they are what the knowledge base is meant to cover.
  // Keyword topics count for plain technique requests ("notes on the A string"), but not for styles or
  // for names the keywords only resemble (slide guitar is bottleneck playing, not legato slides).
  if (!kind) {
    const r = parseRequest(text);
    if ((r.chords || []).length || (r.chordTypes || []).length || r.progression || r.scale || r.key) return null;
    if (r.topics.length && guessKind(text) === 'technique' && !LOOKALIKE.test(String(text).toLowerCase())) return null;
  }
  return { text: words, kind: kind || guessKind(text) };
}

function list(p) { if (!Array.isArray(p.kbRequests)) p.kbRequests = []; return p.kbRequests; }
/** Status of a request: 'added' once the knowledge base teaches it, otherwise 'queued'. */
export function requestStatus(r) {
  if (r.kind === 'guitarist') return matchArtist(r.text) ? 'added' : 'queued';
  return matchArtist(r.text) || matchTechniques(r.text).length ? 'added' : 'queued';
}
/** Your requests, newest first, with their current status. */
export const myRequests = p => list(p).slice().reverse().map(r => ({ ...r, status: requestStatus(r) }));
export const hasRequest = (p, text) => list(p).some(r => norm(r.text) === norm(text));

/** Add a request (no duplicates). Returns the request. */
export function addRequest(p, { text, kind = null, source = 'app', note = '' }) {
  const t = clean(text); if (t.length < 3) return null;
  const have = list(p).find(r => norm(r.text) === norm(t));
  if (have) return have;
  const r = { id: uid(), text: t, kind: REQUEST_KINDS.some(([k]) => k === kind) ? kind : guessKind(t), source, note: String(note || '').slice(0, 200), at: today() };
  list(p).push(r);
  return r;
}
export function removeRequest(p, id) { p.kbRequests = list(p).filter(r => r.id !== id); }

/** The requests file content the content runs read (no personal details beyond the requests). */
export function requestsFile(p) {
  return { app: 'Fretwork Coach', about: 'Topics a player asked to add to the knowledge base. The content runs research each queued one and build it into the app (see CONTENT.md in the repo).', updated: new Date().toISOString(), requests: myRequests(p).map(r => ({ text: r.text, kind: r.kind, status: r.status, at: r.at, source: r.source, ...(r.note ? { note: r.note } : {}) })) };
}
/**
 * Write the requests file to Google Drive. Call from a click (it may open Google sign-in).
 * Resolves to {ok, reason?}: reason 'no-drive' when Drive isn't set up for this app.
 */
export async function syncRequests(p, { interactive = true } = {}) {
  if (!driveReady()) return { ok: false, reason: 'no-drive' };
  try { await saveRequestsToDrive(requestsFile(p), { interactive }); p.kbRequestsSyncedAt = Date.now(); return { ok: true }; }
  catch (e) { return { ok: false, reason: e.message || 'failed' }; }
}
