// Progression engine: per-exercise working tempos, the "pass twice in separate
// sessions → +3–5 BPM" rule, mastery at the goal tempo, stall detection after
// 3 sessions without a pass, skill unlocking, spaced review, and course %.
import { today, addDays } from './util.js';

export const REVIEW_STEPS = [2, 4, 8, 16, 30];

export function allSkills(course) { return course.tree ? course.tree.units.flatMap(u => u.skills) : []; }
export function allExercises(course) { return allSkills(course).flatMap(s => s.exercises.map(e => ({ ex: e, skill: s }))); }
export function findExercise(course, exId) { return allExercises(course).find(x => x.ex.id === exId) || null; }

/** Ensure course.state covers every node in the tree. */
export function ensureState(course) {
  if (!course.tree) return null;
  const st = course.state || (course.state = { skills: {}, exercises: {} });
  for (const s of allSkills(course)) {
    if (!st.skills[s.id]) st.skills[s.id] = { status: 'locked', masteredAt: null, nextReview: null, reviewStep: 0, lastPracticed: null };
    for (const e of s.exercises) {
      if (!st.exercises[e.id]) st.exercises[e.id] = { target: e.startBpm, best: 0, passes: [], lastDate: null, lastTempo: null, failDates: [], stalled: false, mastered: false, history: [] };
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
  // Never leave the student with nothing to do: if every remaining skill is locked, open the earliest ones
  const remaining = allSkills(course).filter(s => st.skills[s.id].status !== 'mastered');
  if (remaining.length && remaining.every(s => st.skills[s.id].status === 'locked')) st.skills[remaining[0].id].status = 'available';
}

const bumpFor = t => (t < 80 ? 3 : t < 140 ? 4 : 5);

/**
 * Record one result. result: {tempo, clean, date}
 * Returns {decision, message, target} where decision ∈ advance|hold|mastered|regress|retry
 */
export function recordResult(course, exId, { tempo, clean, date = today() }) {
  ensureState(course);
  const found = findExercise(course, exId); if (!found) return null;
  const { ex, skill } = found;
  const es = course.state.exercises[exId], ss = course.state.skills[skill.id];
  tempo = Math.round(tempo);
  es.history.push({ date, tempo, clean: !!clean });
  if (es.history.length > 60) es.history.splice(0, es.history.length - 60);
  es.lastDate = date; es.lastTempo = tempo; ss.lastPracticed = date;
  if (clean) es.best = Math.max(es.best, tempo);
  let decision, message;

  if (clean && tempo >= es.target) {
    if (!es.passes.includes(date)) es.passes.push(date);
    es.failDates = []; es.stalled = false;
    if (es.passes.length >= 2) {
      if (es.target >= ex.goalBpm || tempo >= ex.goalBpm) {
        es.mastered = true; es.target = ex.goalBpm;
        decision = 'mastered'; message = `Mastered at ${ex.goalBpm} BPM.`;
      } else {
        const next = Math.min(ex.goalBpm, es.target + bumpFor(es.target));
        decision = 'advance'; message = `Passed twice: target raised ${es.target} → ${next} BPM.`;
        es.target = next; es.passes = [];
      }
    } else {
      decision = 'hold'; message = `Clean at ${tempo} BPM. One more passing session at ${es.target} BPM raises the target.`;
    }
  } else {
    if (!es.failDates.includes(date)) es.failDates.push(date);
    if (es.failDates.length >= 3 && !es.stalled) {
      es.stalled = true;
      const lowered = Math.max(30, Math.round(es.target * 0.9));
      decision = 'regress';
      message = `Stalled for 3 sessions. Target eased ${es.target} → ${lowered} BPM. ${ex.simplify ? 'Prerequisite drill: ' + ex.simplify : 'Slow down and isolate the hardest move.'}`;
      es.target = lowered; es.failDates = [];
    } else {
      decision = 'retry';
      message = clean ? `Clean at ${tempo}, below today's ${es.target} BPM target. Hold the target next time.` : `Not clean yet at ${tempo} BPM. Hold here; accuracy before speed.`;
    }
  }
  // Skill mastery + review scheduling
  if (skill.exercises.every(e => course.state.exercises[e.id].mastered) && ss.status !== 'mastered') {
    ss.status = 'mastered'; ss.masteredAt = date; ss.reviewStep = 0; ss.nextReview = addDays(date, REVIEW_STEPS[0]);
    message += ` Skill “${skill.title}” mastered: new skills unlocked.`;
  }
  refreshUnlocks(course);
  course.progress = progressPct(course);
  course.lastPracticed = date;
  return { decision, message, target: es.target };
}

/** A completed review pushes the next review further out. */
export function markReviewed(course, skillId, date = today()) {
  const ss = course.state && course.state.skills[skillId]; if (!ss || ss.status !== 'mastered') return;
  ss.reviewStep = Math.min(REVIEW_STEPS.length - 1, (ss.reviewStep || 0) + 1);
  ss.nextReview = addDays(date, REVIEW_STEPS[ss.reviewStep]);
}

/** % = mastered exercises plus partial credit for tempo progress toward the goal. */
export function progressPct(course) {
  if (!course.tree) return course.progress || 0;
  ensureStateLite(course);
  const items = allExercises(course); if (!items.length) return 0;
  let score = 0;
  for (const { ex } of items) {
    const es = course.state.exercises[ex.id];
    if (es.mastered) score += 1;
    else if (es.history.length) score += 0.6 * Math.max(0, Math.min(1, (es.target - ex.startBpm) / Math.max(1, ex.goalBpm - ex.startBpm))) + 0.05;
  }
  return Math.min(100, Math.round(score / items.length * 100));
}
function ensureStateLite(course) { if (!course.state) ensureState(course); }

export function reviewDue(course, date = today()) {
  ensureState(course);
  return allSkills(course).filter(s => { const ss = course.state.skills[s.id]; return ss.status === 'mastered' && ss.nextReview && ss.nextReview <= date; });
}
export function activeSkills(course) {
  ensureState(course);
  return allSkills(course).filter(s => ['available', 'in_progress'].includes(course.state.skills[s.id].status));
}
