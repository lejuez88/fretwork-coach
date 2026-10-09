// The coach: decides what you should practice next, and says why. Everywhere
// the app guides you (today's lesson on the dashboard, a course, a learning
// path, an artist page, a library exercise), it asks the coach for the one
// lesson that will help most, from what it knows about you:
//   - spaced reviews that are due (skills you mastered, before they fade),
//   - stalled exercises (they need a targeted fix, not more of the same),
//   - your weakest skill areas and the struggles and goals you named,
//   - how long since you last worked on something (spacing, no neglect),
//   - the edge zone: unmastered work at or just above your level.
// Choosing for yourself is always possible; the screens keep it under "Customize".
import { today, daysBetween } from './util.js';
import { DOMAIN_BY_KEY } from '../assessment/engine.js';
import { ensureState, allSkills, activeSkills, reviewDue } from './progression.js';

const DOMAINS = ['fretting', 'picking', 'rhythm', 'fretboard', 'theory', 'ear', 'improv'];
// what you named in the questionnaire, as skill areas
const NEED_DOMAIN = { speed: 'picking', timing: 'rhythm', fretboard: 'fretboard', improv: 'improv', theory: 'theory', tension: 'fretting', changes: 'fretting', barre: 'fretting', strum: 'rhythm', ear: 'ear', technique: 'fretting', songs: 'improv' };
const NEED_LABEL = { speed: 'speed', timing: 'timing', fretboard: 'knowing the fretboard', improv: 'improvising', theory: 'theory', tension: 'tension', changes: 'chord changes', barre: 'barre chords', strum: 'strumming', ear: 'playing by ear' };
const domName = d => (DOMAIN_BY_KEY[d] ? DOMAIN_BY_KEY[d].name.toLowerCase() : d);

export const levelOf = (p, d) => (p.domains && p.domains[d] ? p.domains[d].level : null);
export function averageLevel(p) {
  const v = DOMAINS.map(d => levelOf(p, d)).filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 4;
}
/** How much a skill area needs work (0 = fine), with the reason in words. */
export function domainNeed(p, d) {
  const l = levelOf(p, d), avg = averageLevel(p), why = [];
  let score = 0;
  if (l != null && avg - l >= 0.5) { score += (avg - l) * 1.2; why.push(`your ${domName(d)} (level ${l}) trails your other skills`); }
  const struggles = (p.questionnaire && p.questionnaire.struggles) || [], goals = (p.questionnaire && p.questionnaire.goals) || [];
  const s = struggles.find(x => NEED_DOMAIN[x] === d); if (s) { score += 1.5; why.push(`you said ${NEED_LABEL[s] || s} is a struggle`); }
  const g = goals.find(x => NEED_DOMAIN[x] === d); if (g && !s) { score += 0.8; why.push(`${NEED_LABEL[g] || g} is one of your goals`); }
  if (p.focus && p.focus.domain === d) { score += 0.6; if (!why.length) why.push(`${domName(d)} is your current focus`); }
  return { score, why };
}

/* ------------------------------ Courses ------------------------------ */
/**
 * The next thing to work on in a course: {skill, kind, reason} where kind is
 * 'review' (a mastered skill due for review), 'stalled', 'continue' or 'start'.
 */
export function nextInCourse(p, course) {
  if (!course || !course.tree) return null;
  ensureState(course, p);
  const st = course.state, date = today();
  const ex = e => st.exercises[e.id] || {};
  const active = activeSkills(course);
  const stalled = active.find(s => s.exercises.some(e => ex(e).stalled && !ex(e).mastered));
  if (stalled) return { skill: stalled, kind: 'stalled', reason: `“${stalled.title}” has stalled for a few sessions, so today it gets a simpler, targeted version before pushing the tempo again.` };
  const due = reviewDue(course, date);
  // a due review comes first when it's overdue by a few days; otherwise it rides along in the review block
  const overdue = due.find(s => daysBetween(st.skills[s.id].nextReview, date) >= 3);
  if (overdue) return { skill: overdue, kind: 'review', reason: `You mastered “${overdue.title}”; it's due for review so it doesn't fade.` };
  const going = active.filter(s => s.exercises.some(e => (ex(e).history || []).length));
  if (going.length) {
    // the one in progress that's least recently practiced, weighted by how much its area needs work
    const pick = going.map(s => ({ s, n: domainNeed(p, s.domain).score - (st.skills[s.id].lastPracticed === date ? 2 : 0) })).sort((a, b) => b.n - a.n)[0].s;
    const done = pick.exercises.filter(e => ex(e).mastered).length;
    return { skill: pick, kind: 'continue', reason: `Continue “${pick.title}”: ${done} of ${pick.exercises.length} exercises mastered; today pushes the rest toward their goal tempos.` };
  }
  const first = active[0] || allSkills(course).find(s => st.skills[s.id].status !== 'mastered');
  if (!first) return due[0] ? { skill: due[0], kind: 'review', reason: `Everything here is mastered; “${due[0].title}” is due for review.` } : null;
  return { skill: first, kind: 'start', reason: `Next up: “${first.title}”, the next step in the plan.` };
}

/** How much a course would help today, with reasons. */
function courseScore(p, course) {
  const why = [];
  let s = 0;
  if (!course.tree) return { s: 0.5, why: ['its plan is ready to build'], next: null };
  const next = nextInCourse(p, course);
  if (!next) return { s: -5, why: [], next: null };
  ensureState(course, p);
  if (next.kind === 'stalled') { s += 3; why.push('an exercise has stalled and needs a fix'); }
  if (next.kind === 'review') { s += 2.5; why.push('a review is due'); }
  const dueCount = reviewDue(course).length; if (dueCount && next.kind !== 'review') { s += Math.min(1.5, dueCount * 0.5); why.push(`${dueCount} review${dueCount > 1 ? 's are' : ' is'} due`); }
  const need = domainNeed(p, next.skill.domain); s += need.score; why.push(...need.why);
  const last = course.lastPracticed;
  if (!last) { s += 1; why.push('you haven’t started it yet'); }
  else {
    const gap = daysBetween(last, today());
    if (gap === 0) { s -= 2; } else if (gap >= 3) { s += Math.min(2, gap * 0.3); why.push(`you last practiced it ${gap} days ago`); }
  }
  return { s, why, next };
}

/**
 * Today's lesson: the course (and skill) that will help most right now, the length, and why.
 * Returns {course, next, minutes, reasons[], alternatives[]} or null without courses.
 */
export function recommendSession(p, { minutes = null } = {}) {
  const open = (p.courses || []).filter(c => c.status !== 'archived');
  if (!open.length) return null;
  const scored = open.map(c => ({ c, ...courseScore(p, c) })).sort((a, b) => b.s - a.s);
  const best = scored[0];
  const day = new Date().getDay();
  const mins = minutes || (p.questionnaire && p.questionnaire.practice && p.questionnaire.practice[[0, 6].includes(day) ? 'weekend' : 'weekday']) || 30;
  const reasons = [];
  if (best.next) reasons.push(best.next.reason);
  best.why.filter(w => !/stalled|review is due/.test(w) || !best.next || !['stalled', 'review'].includes(best.next.kind)).slice(0, 2).forEach(w => reasons.push(cap(w) + '.'));
  return { course: best.c, next: best.next, minutes: mins, reasons, alternatives: scored.slice(1).map(x => x.c) };
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* --------------------------- Lesson lists --------------------------- */
// For learning paths, artist pages: lessons are {key, ex, skill}; their progress
// lives in profile.varState under `${key}~base`.
const stateOf = (p, l) => (l && l.key ? (p.varState || {})[`${l.key}~base`] || null : null);
/**
 * The next lesson in an ordered list: a stalled one first (with a fix), then one you've
 * started but not mastered (least recently practiced), then the first one not yet touched.
 * Returns {index, kind, reason} or null when everything is mastered.
 */
export function nextLesson(p, lessons, { label = 'this stage' } = {}) {
  const rows = lessons.map((l, i) => ({ l, i, st: stateOf(p, l) }));
  const stalled = rows.find(r => r.st && r.st.stalled && !r.st.mastered);
  if (stalled) return { index: stalled.i, kind: 'stalled', reason: `It has stalled at ${stalled.st.best || stalled.st.target} BPM: today's goal is clean reps a little slower, then nudge the tempo back up.` };
  const started = rows.filter(r => r.st && (r.st.history || []).length && !r.st.mastered)
    .sort((a, b) => String(a.st.lastDate || '').localeCompare(String(b.st.lastDate || '')));
  if (started.length) { const r = started[0]; return { index: r.i, kind: 'continue', reason: `You're on it: best so far ${r.st.best || r.st.lastTempo} BPM, goal ${r.l.ex.goalBpm}.` }; }
  const fresh = rows.find(r => !r.st || !r.st.mastered);
  if (fresh) return { index: fresh.i, kind: 'start', reason: fresh.i === 0 ? `The first lesson of ${label}.` : `The next lesson in ${label}: the ones before it are done.` };
  return null;
}

/**
 * Where to start a learning path: the earliest stage that isn't finished, but never below
 * the stage for your level unless you're new to the technique.
 * meta: index entry ({stages:[{tier, levels}]}); mastered(tier) → {total, mastered}.
 */
export function pathStage(p, meta, progressOf) {
  const lvl = levelOf(p, meta.domain) || Math.round(averageLevel(p));
  const stages = meta.stages || [];
  const atLevel = stages.find(s => lvl >= s.levels[0] && lvl <= s.levels[1]) || stages.filter(s => s.levels[0] <= lvl).slice(-1)[0] || stages[0];
  const unfinished = st => { const pr = progressOf(st.tier); return !pr.total || pr.mastered < pr.total; };
  // working through an earlier stage already? keep going there
  const inProgress = stages.find(st => { const pr = progressOf(st.tier); return pr.practiced && pr.mastered < pr.total; });
  if (inProgress) return { stage: inProgress, reason: `You're partway through ${inProgress.title || inProgress.tier}.` };
  const from = Math.max(0, stages.indexOf(atLevel));
  const st = stages.slice(from).find(unfinished) || atLevel;
  return { stage: st, reason: st === atLevel ? `Matches your ${domName(meta.domain)} level (${lvl}).` : `The stages before it are done.` };
}
