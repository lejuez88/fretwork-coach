// Progression engine.
// - Starting tempo: calibrated from the player's live level in the exercise's
//   domain vs the exercise's difficulty, blended with how fast they already play
//   other exercises in that domain (so lessons start at a tempo they can play cleanly).
// - First two sessions calibrate: a clean run above target moves the target up to
//   it; a non-clean first run eases the target.
// - Then: two clean passes on separate days → +3–5 BPM; clean far above target →
//   jump ahead; goal reached twice → mastered; 3 sessions without a pass → ease
//   the target and prescribe a prerequisite drill.
// - Mastered skills come back on a spaced-review schedule.
// The same rules drive course exercises and evaluation prescriptions.
import { today, addDays } from './util.js';
import { Store } from './store.js';

export const REVIEW_STEPS = [2, 4, 8, 16, 30];
const CALIBRATION_RUNS = 2;

export function allSkills(course) { return course.tree ? course.tree.units.flatMap(u => u.skills) : []; }
export function allExercises(course) { return allSkills(course).flatMap(s => s.exercises.map(e => ({ ex: e, skill: s }))); }
export function findExercise(course, exId) { return allExercises(course).find(x => x.ex.id === exId) || null; }

/** Difficulty 1–10 of a course exercise (stored, or interpolated across the units). */
export function exerciseLevel(course, ex) {
  if (ex.level) return ex.level;
  const units = course && course.tree ? course.tree.units : [];
  const ui = units.findIndex(u => u.skills.some(s => s.exercises.includes(ex)));
  const base = (course && course.difficulty) || 4;
  if (ui < 0) return base;
  return Math.max(1, Math.min(10, Math.round(base - 0.5 + ui * (2.5 / Math.max(1, units.length - 1)))));
}

/** Median fraction-of-goal the player already plays cleanly in a domain (from lesson evidence). */
export function domainFractions(profile, domain) {
  const ev = (profile && profile.skillEvidence) || {};
  return Object.values(ev).filter(e => e.domain === domain && e.frac > 0).map(e => Math.min(1.1, e.frac));
}
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** A tempo this player should be able to play cleanly today. */
export function calibratedTarget(ex, level, profile) {
  const L = (profile && profile.domains && profile.domains[ex.domain] && profile.domains[ex.domain].level) || level;
  let r = 0.62 + 0.09 * (L - level);              // same level: ~62% of goal; each level above adds ~9%
  const fr = domainFractions(profile, ex.domain);
  if (fr.length >= 2) r = 0.5 * r + 0.5 * (median(fr) - 0.05);
  r = Math.max(0.4, Math.min(0.92, r));
  let t = Math.round(ex.goalBpm * r);
  if (ex.startBpm && ex.startBpm > t) t = Math.round((t + ex.startBpm) / 2); // the plan's own start, if higher, pulls up
  return Math.max(30, Math.min(ex.goalBpm - 2, t));
}

export function newExerciseState(target) {
  return { target, best: 0, passes: [], lastDate: null, lastTempo: null, failDates: [], stalled: false, mastered: false, history: [] };
}

/** Ensure course.state covers every node; re-calibrate exercises the player hasn't touched yet. */
export function ensureState(course, profile = Store.profile) {
  if (!course.tree) return null;
  const st = course.state || (course.state = { skills: {}, exercises: {} });
  for (const s of allSkills(course)) {
    if (!st.skills[s.id]) st.skills[s.id] = { status: 'locked', masteredAt: null, nextReview: null, reviewStep: 0, lastPracticed: null };
    for (const e of s.exercises) {
      const target = calibratedTarget(e, exerciseLevel(course, e), profile);
      if (!st.exercises[e.id]) st.exercises[e.id] = newExerciseState(target);
      else if (!st.exercises[e.id].history.length && !st.exercises[e.id].mastered) st.exercises[e.id].target = target;
    }
  }
  refreshUnlocks(course);
  return st;
}

export function refreshUnlocks(course) {
  const st = course.state;
  for (const s of allSkills(course)) {
    const ss = st.skills[s.id];
    if (ss.status === 'mastered') continue;
    const unlocked = (s.prereqs || []).every(p => st.skills[p] && st.skills[p].status === 'mastered');
    const touched = s.exercises.some(e => st.exercises[e.id].history.length);
    ss.status = !unlocked ? 'locked' : touched ? 'in_progress' : 'available';
  }
  const remaining = allSkills(course).filter(s => st.skills[s.id].status !== 'mastered');
  if (remaining.length && remaining.every(s => st.skills[s.id].status === 'locked')) st.skills[remaining[0].id].status = 'available';
}

export const bumpFor = t => (t < 80 ? 3 : t < 140 ? 4 : 5);

/**
 * Apply one result to an exercise state. Shared by course exercises and prescriptions.
 * result: {tempo, clean, date}. Returns {decision, message}.
 * decision ∈ calibrate | advance | jump | hold | mastered | regress | retry
 */
export function applyResult(es, ex, { tempo, clean, date = today() }) {
  tempo = Math.round(tempo);
  const calibrating = es.history.length < CALIBRATION_RUNS;
  es.history.push({ date, tempo, clean: !!clean, target: es.target });
  if (es.history.length > 60) es.history.splice(0, es.history.length - 60);
  es.lastDate = date; es.lastTempo = tempo;
  if (clean) es.best = Math.max(es.best, tempo);
  const goal = ex.goalBpm;

  if (calibrating) {
    if (clean && tempo >= goal) {
      if (!es.passes.includes(date)) es.passes.push(date);
      es.target = goal;
      if (es.passes.length >= 2) { es.mastered = true; return { decision: 'mastered', message: `Mastered at ${goal} BPM.` }; }
      return { decision: 'calibrate', message: `Clean at the goal tempo on your first try. One more session at ${goal} BPM masters it.` };
    }
    if (clean && tempo > es.target) {
      es.target = tempo; es.passes = [date];
      return { decision: 'calibrate', message: `Calibrated: you play this cleanly at ${tempo} BPM, so that's your new target.` };
    }
    if (clean) {
      if (!es.passes.includes(date)) es.passes.push(date);
      return { decision: 'hold', message: `Clean at ${tempo} BPM. Next session, push the tempo ladder higher.` };
    }
    const eased = Math.max(30, Math.round(Math.min(tempo, es.target) * 0.92));
    const was = es.target; es.target = Math.min(es.target, eased);
    return { decision: 'calibrate', message: es.target < was ? `Calibrating: target eased ${was} → ${es.target} BPM so you start clean.` : `Logged ${tempo} BPM. Aim for clean reps at ${es.target} BPM.` };
  }

  if (clean && tempo >= es.target) {
    if (!es.passes.includes(date)) es.passes.push(date);
    es.failDates = []; es.stalled = false;
    if (tempo >= goal && es.passes.length >= 2) {
      es.mastered = true; es.target = goal;
      return { decision: 'mastered', message: `Mastered at ${goal} BPM.` };
    }
    if (tempo >= es.target + 6) {
      const next = Math.min(goal, tempo - 2);
      const was = es.target; es.target = Math.max(es.target, next); es.passes = [date];
      return { decision: 'jump', message: `Ahead of plan: clean at ${tempo} BPM, so the target moved ${was} → ${es.target} BPM.` };
    }
    if (es.passes.length >= 2) {
      const next = Math.min(goal, es.target + bumpFor(es.target));
      const was = es.target; es.target = next; es.passes = [];
      return { decision: 'advance', message: `Passed twice: target raised ${was} → ${next} BPM.` };
    }
    return { decision: 'hold', message: `Clean at ${tempo} BPM. One more passing session at ${es.target} BPM raises the target.` };
  }
  if (!es.failDates.includes(date)) es.failDates.push(date);
  if (es.failDates.length >= 3 && !es.stalled) {
    es.stalled = true;
    const lowered = Math.max(30, Math.round(es.target * 0.9));
    const msg = `Stalled for 3 sessions. Target eased ${es.target} → ${lowered} BPM. ${ex.simplify ? 'Prerequisite drill: ' + ex.simplify : 'Slow down and isolate the hardest move.'}`;
    es.target = lowered; es.failDates = [];
    return { decision: 'regress', message: msg };
  }
  return { decision: 'retry', message: clean ? `Clean at ${tempo}, below today's ${es.target} BPM target. Hold the target next time.` : `Not clean yet at ${tempo} BPM. Hold here; accuracy before speed.` };
}

/** Record a result for a course exercise (progression + skill mastery + unlocks). */
export function recordResult(course, exId, result) {
  ensureState(course);
  const found = findExercise(course, exId); if (!found) return null;
  const { ex, skill } = found;
  const es = course.state.exercises[exId], ss = course.state.skills[skill.id];
  const out = applyResult(es, ex, result);
  ss.lastPracticed = result.date || today();
  if (skill.exercises.every(e => course.state.exercises[e.id].mastered) && ss.status !== 'mastered') {
    ss.status = 'mastered'; ss.masteredAt = ss.lastPracticed; ss.reviewStep = 0; ss.nextReview = addDays(ss.lastPracticed, REVIEW_STEPS[0]);
    out.message += ` Skill “${skill.title}” mastered: new skills unlocked.`;
  }
  refreshUnlocks(course);
  course.progress = progressPct(course);
  course.lastPracticed = ss.lastPracticed;
  return Object.assign(out, { target: es.target, level: exerciseLevel(course, ex), ex });
}

/** Record a result for an evaluation prescription. */
export function recordPrescription(profile, rxId, result) {
  const rx = (profile.prescriptions || []).find(r => r.id === rxId); if (!rx) return null;
  const out = applyResult(rx.state, rx.ex, result);
  if (rx.state.mastered) { rx.status = 'done'; out.message += ' Prescription complete.'; }
  return Object.assign(out, { target: rx.state.target, level: rx.ex.level || 4, ex: rx.ex });
}

export function markReviewed(course, skillId, date = today()) {
  const ss = course.state && course.state.skills[skillId]; if (!ss || ss.status !== 'mastered') return;
  ss.reviewStep = Math.min(REVIEW_STEPS.length - 1, (ss.reviewStep || 0) + 1);
  ss.nextReview = addDays(date, REVIEW_STEPS[ss.reviewStep]);
}

/** % = mastered exercises plus partial credit for tempo progress toward the goal. */
export function progressPct(course) {
  if (!course.tree) return course.progress || 0;
  if (!course.state) ensureState(course);
  const items = allExercises(course); if (!items.length) return 0;
  let score = 0;
  for (const { ex } of items) {
    const es = course.state.exercises[ex.id];
    if (!es) continue;
    if (es.mastered) score += 1;
    else if (es.history.length) score += 0.05 + 0.6 * Math.max(0, Math.min(1, (Math.max(es.best, es.target) - ex.startBpm) / Math.max(1, ex.goalBpm - ex.startBpm)));
  }
  return Math.min(100, Math.round(score / items.length * 100));
}

export function reviewDue(course, date = today()) {
  ensureState(course);
  return allSkills(course).filter(s => { const ss = course.state.skills[s.id]; return ss.status === 'mastered' && ss.nextReview && ss.nextReview <= date; });
}
export function activeSkills(course) {
  ensureState(course);
  return allSkills(course).filter(s => ['available', 'in_progress'].includes(course.state.skills[s.id].status));
}

/** Tempo ladder for one exercise in a session: start at target, step up to the goal. */
export function tempoLadder(target, goal, steps = 4) {
  const step = bumpFor(target);
  const out = [target];
  while (out.length < steps && out[out.length - 1] < goal) out.push(Math.min(goal, out[out.length - 1] + step));
  return { start: target, step, max: Math.max(target, out[out.length - 1]), rungs: out };
}
