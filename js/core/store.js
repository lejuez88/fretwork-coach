// Profile model, persistence and migration. One JSON object holds everything;
// later phases (course engine, routines, evaluation) add to the same sections.
import { today, daysBetween, addDays, parseDay } from './util.js';

export const APP_VERSION = 2;
/** Shown in Settings → About, to tell which version a device is running. Bump with each release. */
export const BUILD = '2026-10-10.3';
const PROFILE_KEY = 'fretworkCoach.profile.v2';
const LEGACY_KEY = 'fretworkCoach.profile.v1';
const DRAFT_KEY = 'fretworkCoach.draft.v2';
const SESSION_KEY = 'fretworkCoach.activeSession';

const safe = {
  get(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};

export function emptyProfile() {
  return {
    schema: 'fretwork-coach-profile', version: APP_VERSION,
    meta: { created: today(), updated: today() },
    questionnaire: {
      name: '', experience: '', learning: '', chords: [], techniques: [], theory: {},
      struggles: [], strugglesOther: '', goals: [], goalsOther: '',
      genres: [],            // genre ids from the catalog
      genresText: '',        // legacy v1 free text
      players: [],           // {id, name, wikiTitle, genres[], style, qualities[], techniques[], source}
      practice: { weekday: 30, weekend: 45 },
      equipment: { guitar: '', gear: [], metronome: '', looper: '', daw: '' }
    },
    assessment: { date: null, priors: {}, domains: {} },
    domains: {},
    repertoire: [],
    activeExercises: [],
    reviewQueue: [],
    theory: { learned: [], next: '' },
    weaknesses: [],
    focus: { domain: '', reason: '' },
    sessionLog: [],
    // ---- v2 additions ----
    courses: [],             // {id, name, genre, style, difficulty, levelLabel, players[], createdAt, status, progress, tree, lessons}
    practiceLog: [],         // {id, date, start, minutes, source, courseId, genre, note}
    exerciseLog: [],         // Phase B: {date, exerciseId, tempo, goalTempo, mastered}
    evaluations: [],         // Phase C: audio/video evaluation results
    prescriptions: [],       // Phase C: exercises prescribed by evaluations {id, ex, reason, status, state, ...}
    skillEvidence: {},       // lesson results that feed live skill levels (key → {domain, level, frac, value, ...})
    levelHistory: [],        // {date, domain, from, to}
    songs: [],               // Phase D: {id, title, artist, genre, difficulty, status, info, tab, sections, state, lessons}
    customExercises: [],     // Phase D: exercises generated from "what do you want to work on?" {id, ex, request, state}
    lessonCache: { masters: [], requests: [] }, // plans and exercises Claude designed, reused for the same request (no API cost)
    kbRequests: [],          // topics you asked to add to the knowledge base {id, text, kind, source, note, at}
    songRecs: null,
    varState: {},            // progress per exercise variation and library exercise: {"<scope>~<vid>": exerciseState}          // Phase D: cached recommendations {key, date, items, source}
    dashboard: { trackHistory: [] }, // Track of the Day: today's pick in .track, recent keys in .trackHistory
    settings: { referenceA4: 440, tuning: 'standard', tabAudio: true, tabScroll: true, wikiImages: true, model: 'claude-sonnet-5-5', latency: null, headphones: false, tabPicks: true, pickModes: {}, clickSound: 'click' }
  };
}

/** Accepts a v1 or v2 profile (or junk) and returns a complete v2 profile. */
export function normalize(p) {
  const b = emptyProfile();
  if (!p || typeof p !== 'object') return b;
  const pq = p.questionnaire || {};
  const q = Object.assign({}, b.questionnaire, pq);
  q.practice = Object.assign({}, b.questionnaire.practice, pq.practice || {});
  q.equipment = Object.assign({}, b.questionnaire.equipment, pq.equipment || {});
  ['chords', 'techniques', 'struggles', 'goals', 'players'].forEach(k => { if (!Array.isArray(q[k])) q[k] = []; });
  // v1 stored genres as free text
  if (typeof q.genres === 'string') { q.genresText = q.genres; q.genres = []; }
  if (!Array.isArray(q.genres)) q.genres = [];
  if (!Array.isArray(q.equipment.gear)) q.equipment.gear = [];
  if (!q.theory || typeof q.theory !== 'object') q.theory = {};
  const out = Object.assign(b, p, {
    schema: b.schema, version: APP_VERSION, questionnaire: q,
    meta: Object.assign(b.meta, p.meta || {}),
    assessment: Object.assign(b.assessment, p.assessment || {}),
    theory: Object.assign(b.theory, p.theory || {}),
    dashboard: Object.assign(b.dashboard, p.dashboard || {}),
    settings: Object.assign(b.settings, p.settings || {})
  });
  if (!out.skillEvidence || typeof out.skillEvidence !== 'object' || Array.isArray(out.skillEvidence)) out.skillEvidence = {};
  if (!out.varState || typeof out.varState !== 'object' || Array.isArray(out.varState)) out.varState = {};
  if (!out.lessonCache || typeof out.lessonCache !== 'object' || Array.isArray(out.lessonCache)) out.lessonCache = { masters: [], requests: [] };
  ['masters', 'requests'].forEach(k => { if (!Array.isArray(out.lessonCache[k])) out.lessonCache[k] = []; });
  if (out.intervalStats != null && (typeof out.intervalStats !== 'object' || Array.isArray(out.intervalStats))) delete out.intervalStats;
  ['courses', 'practiceLog', 'exerciseLog', 'evaluations', 'prescriptions', 'levelHistory', 'repertoire', 'sessionLog', 'activeExercises', 'reviewQueue', 'weaknesses', 'songs', 'customExercises', 'kbRequests']
    .forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  return out;
}

export const Store = {
  profile: null,
  load() {
    let p = safe.get(PROFILE_KEY);
    if (!p) { const legacy = safe.get(LEGACY_KEY); if (legacy) p = legacy; }
    this.profile = p ? normalize(p) : null;
    return this.profile;
  },
  /** Save to this browser. Returns false if the browser refused (storage full or blocked). */
  save() { if (!this.profile) return false; this.profile.meta.updated = today(); return safe.set(PROFILE_KEY, this.profile); },
  replace(p) { this.profile = normalize(p); return this.save(); },
  hasLegacy() { return !!safe.get(LEGACY_KEY) && !safe.get(PROFILE_KEY); },
  reset() { safe.del(PROFILE_KEY); safe.del(DRAFT_KEY); safe.del(SESSION_KEY); this.profile = null; },
  draft: {
    get: () => safe.get(DRAFT_KEY),
    set: v => safe.set(DRAFT_KEY, v),
    clear: () => safe.del(DRAFT_KEY)
  }
};

/* ------------------------- Practice time + stats ------------------------- */
export const Practice = {
  /** Running free-practice session survives navigation and reloads. */
  active() { return safe.get(SESSION_KEY); },
  start(meta = {}) { const s = Object.assign({ startedAt: Date.now() }, meta); safe.set(SESSION_KEY, s); return s; },
  discard() { safe.del(SESSION_KEY); },
  elapsedSec() { const s = this.active(); return s ? (Date.now() - s.startedAt) / 1000 : 0; },
  stop(p, extra = {}) {
    const s = this.active(); if (!s) return null;
    safe.del(SESSION_KEY);
    const minutes = Math.round((Date.now() - s.startedAt) / 60000 * 10) / 10;
    if (minutes < 0.5) return { minutes, discarded: true };
    const entry = Object.assign({ id: Math.random().toString(36).slice(2, 10), date: today(new Date(s.startedAt)), start: s.startedAt, minutes, source: s.source || 'free', courseId: s.courseId || null, genre: s.genre || null, note: s.note || '' }, extra);
    p.practiceLog.push(entry);
    return entry;
  },
  addManual(p, date, minutes, note = '') {
    const e = { id: Math.random().toString(36).slice(2, 10), date, start: parseDay(date).getTime(), minutes, source: 'manual', courseId: null, genre: null, note };
    p.practiceLog.push(e); return e;
  },
  minutesByDay(p) {
    const m = {};
    for (const e of p.practiceLog) m[e.date] = (m[e.date] || 0) + (e.minutes || 0);
    return m;
  },
  stats(p, now = today()) {
    const byDay = this.minutesByDay(p);
    const days = Object.keys(byDay).sort();
    const total = Object.values(byDay).reduce((a, b) => a + b, 0);
    // Week = Monday..Sunday containing `now`
    const d = parseDay(now), dow = (d.getDay() + 6) % 7, weekStart = addDays(now, -dow);
    let week = 0; for (let i = 0; i < 7; i++) week += byDay[addDays(weekStart, i)] || 0;
    const span = days.length ? daysBetween(days[0], now) + 1 : 0;
    const avgDaily = span ? total / span : 0;
    // Streak of consecutive >=15 min days ending today (or yesterday if today isn't done yet)
    const ok = day => (byDay[day] || 0) >= 15;
    let cursor = ok(now) ? now : addDays(now, -1), streak = 0;
    while (ok(cursor)) { streak++; cursor = addDays(cursor, -1); }
    // Longest streak
    let best = 0, run = 0, prev = null;
    for (const day of days) {
      if (!ok(day)) { run = 0; prev = day; continue; }
      run = prev && daysBetween(prev, day) === 1 && ok(prev) ? run + 1 : 1;
      best = Math.max(best, run); prev = day;
    }
    return { total, week, avgDaily, streak, best, byDay, practicedToday: byDay[now] || 0 };
  },
  lastSession(p) { return p.practiceLog.length ? [...p.practiceLog].sort((a, b) => b.start - a.start)[0] : null; }
};
