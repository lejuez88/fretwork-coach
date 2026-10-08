// Profile import and the upgrades every loaded profile gets.
//
// Import reads an exported profile from a file or pasted text, checks it, runs
// the same upgrades as app start (so an export from an older version works at
// once, without a reload), and saves it. It tolerates what happens to files
// moving between devices: a byte-order mark, text around the JSON, a wrong file
// type, and a browser that won't save (full or blocked storage).
import { Store, normalize } from './store.js';
import { ensureAssessed, recomputeLevels } from './skills.js';
import { upgradeGenericPlan } from './coursegen.js';
import { chooseTrack } from './track.js';
import { fmtMinutes } from './util.js';

export const MAX_BYTES = 25 * 1024 * 1024;
// Caches that can be rebuilt; cleared if the browser runs out of room.
const CACHE_KEYS = ['fretworkCoach.wikiCache.v1', 'fretworkCoach.ytCache.v1', 'fretworkCoach.lastSummary', 'fretworkCoach.evalPick'];

/** Bring any profile up to the current version. Safe to run more than once. */
export function prepareProfile(p) {
  if (!p) return p;
  const assessed = Object.keys(p.domains || {}).length > 0;
  if (assessed) {
    try { ensureAssessed(p); } catch { /* keep as is */ }
    try { recomputeLevels(p); } catch { /* keep as is */ }
  }
  (p.courses || []).forEach(c => { try { upgradeGenericPlan(c); } catch { /* keep the old plan */ } });
  if (assessed) { try { chooseTrack(p); } catch { /* the dashboard picks one later */ } }
  return p;
}

/** Parse exported profile text. Throws an Error with a plain-language message. */
export function parseProfileText(text) {
  let s = String(text == null ? '' : text).replace(/^﻿/, '').trim();
  if (!s) throw new Error('There’s nothing to import: the file or pasted text is empty.');
  if (s[0] !== '{') {
    // Text around the JSON (a code block, a note): use the outermost { … }.
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('That isn’t a Fretwork Coach profile export (no profile data found).');
    s = s.slice(a, b + 1);
  }
  let data;
  try { data = JSON.parse(s); }
  catch { throw new Error('The profile data is damaged or cut off, so it can’t be read. Export a fresh copy and try again.'); }
  if (data && typeof data === 'object' && !data.questionnaire && data.profile && typeof data.profile === 'object') data = data.profile;
  if (!data || typeof data !== 'object' || Array.isArray(data) || !data.questionnaire || typeof data.questionnaire !== 'object') {
    throw new Error('That’s JSON, but not a Fretwork Coach profile.');
  }
  return data;
}

/** Read a picked file as text. */
export function readFileText(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file was picked.'));
    if (file.size > MAX_BYTES) return reject(new Error('That file is too big to be a profile export.'));
    if (typeof file.text === 'function') { file.text().then(resolve, () => reject(new Error('This browser couldn’t read that file. Try the paste option below.'))); return; }
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('This browser couldn’t read that file. Try the paste option below.'));
    r.readAsText(file);
  });
}

/** One line describing a profile, for confirmations and messages. */
export function describeProfile(p) {
  const name = (p.questionnaire && p.questionnaire.name) || 'Unnamed player';
  const courses = (p.courses || []).filter(c => c && c.status !== 'archived').length;
  const songs = (p.songs || []).length;
  const mins = (p.practiceLog || []).reduce((a, e) => a + (Number(e && e.minutes) || 0), 0);
  const bits = [`${courses} course${courses === 1 ? '' : 's'}`];
  if (songs) bits.push(`${songs} song${songs === 1 ? '' : 's'}`);
  if (mins) bits.push(`${fmtMinutes(mins)} practiced`);
  const when = p.meta && p.meta.updated ? `, saved ${p.meta.updated}` : '';
  return `${name} (${bits.join(', ')}${when})`;
}

/**
 * Normalize, upgrade and save an imported profile.
 * Returns { profile, saved }. saved is false when the browser refused to store
 * it even after clearing caches (the profile still works until the tab closes).
 */
export function saveImported(data) {
  const profile = prepareProfile(normalize(data));
  let saved = Store.replace(profile);
  if (!saved) {
    for (const k of CACHE_KEYS) { try { localStorage.removeItem(k); } catch { /* blocked */ } }
    saved = Store.save();
  }
  Store.draft.clear();
  return { profile: Store.profile, saved };
}
