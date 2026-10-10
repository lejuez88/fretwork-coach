// Recording a practice result for any kind of item (shared by the timed routine runner and the
// practice page). An item is the routine-item shape: {ex, targetBpm, goalBpm, vid?, and one of
// libId | kbKey | courseId+fromTree+exId+skillId | prescriptionId | songId | customId}.
// Every variation, library exercise and knowledge-base / artist lesson keeps its progress in
// profile.varState under "<scope>~<vid>"; course, prescription, song and saved exercises keep
// theirs in their usual place.
import { today } from './util.js';
import { findSong, recordSongResult } from './songs.js';
import { recordCustom } from './custom.js';
import { recordResult, recordPrescription, applyResult, newExerciseState, markReviewed, ensureState } from './progression.js';
import { addEvidence } from './skills.js';

/** The progress scope of an item (course = the course the item belongs to, if any). */
export function scopeOf(it, course = null) {
  const cid = course ? course.id : it.courseId;
  return it.kbKey ? it.kbKey : it.libId ? `lib:${it.libId}` : cid && it.fromTree ? `${cid}:${it.exId}` : it.prescriptionId ? `rx:${it.prescriptionId}`
    : it.songId ? `song:${it.songId}:${it.ex.sectionKey || it.exId}` : it.customId ? `custom:${it.customId}` : cid ? `${cid}:x:${it.exId}` : `ex:${it.exId}`;
}
export const usesVarState = it => !!it.libId || !!it.kbKey || (!!it.vid && it.vid !== 'base');
export const varKeyOf = (it, course = null) => `${scopeOf(it, course)}~${it.vid || 'base'}`;

/** Saved progress behind an item, or null. */
export function itemState(p, it, course = null) {
  if (usesVarState(it)) return (p.varState || {})[varKeyOf(it, course)] || null;
  if (course && it.fromTree) return course.state && course.state.exercises[it.exId];
  if (it.prescriptionId) { const r = p.prescriptions.find(x => x.id === it.prescriptionId); return r && r.state; }
  if (it.songId) { const s = findSong(p, it.songId); return s && s.state && s.state.sections[it.ex.sectionKey || it.exId]; }
  if (it.customId) { const c = p.customExercises.find(x => x.id === it.customId); return c && c.state; }
  return course && course.state && course.state.extras ? course.state.extras[it.exId] : null;
}

/**
 * Record {tempo, clean} for an item. Returns the decision ({decision, message, ...}).
 * ctx: {course, source ('routine' | 'library' | 'practice' …)}. Adds skill evidence and an exerciseLog entry.
 */
export function recordItemResult(p, it, result, { course = null, source = 'practice' } = {}) {
  const res = { tempo: result.tempo, clean: result.clean, date: today() };
  let decision = null;
  if (usesVarState(it)) {
    p.varState = p.varState || {};
    const k = varKeyOf(it, course);
    const es = p.varState[k] || (p.varState[k] = newExerciseState(it.targetBpm));
    decision = applyResult(es, it.ex, res);
    if (it.isReview && result.clean && course) markReviewed(course, it.skillId);
  } else if (course && it.fromTree) {
    decision = recordResult(course, it.exId, res);
    if (it.isReview && result.clean) markReviewed(course, it.skillId);
  } else if (it.prescriptionId) {
    decision = recordPrescription(p, it.prescriptionId, res);
  } else if (it.songId) {
    decision = recordSongResult(p, it.songId, it.ex, res);
  } else if (it.customId) {
    decision = recordCustom(p, it.customId, res);
  } else if (course) {
    const st = ensureState(course); st.extras = st.extras || {};
    const es = st.extras[it.exId] || (st.extras[it.exId] = newExerciseState(it.targetBpm));
    decision = applyResult(es, it.ex, res);
  }
  if (!decision) decision = { decision: result.clean ? 'hold' : 'retry', message: result.clean ? `Clean at ${result.tempo} BPM.` : `Logged ${result.tempo} BPM.` };
  const label = it.ex.name + (it.vid && it.vid !== 'base' && it.ex.varLabel ? ` (${it.ex.varLabel})` : '');
  addEvidence(p, {
    key: usesVarState(it) ? varKeyOf(it, course) : it.songId ? `song:${it.songId}:${it.ex.sectionKey || it.exId}` : it.customId ? 'custom:' + it.customId : (it.fromTree && course ? course.id + ':' : '') + it.exId,
    domain: it.ex.domain, label, level: usesVarState(it) ? (it.ex.level || 4) : (decision.level || it.ex.level || (course && course.difficulty) || 4),
    tempo: result.tempo, goal: it.goalBpm, clean: result.clean, source
  });
  p.exerciseLog.push({ date: today(), at: Date.now(), exerciseId: usesVarState(it) ? it.ex.id : it.exId, name: label, ...(it.vid ? { vid: it.vid } : {}), courseId: course ? course.id : null, ...(it.songId ? { songId: it.songId } : {}), tempo: result.tempo, goalBpm: it.goalBpm, clean: result.clean, mastered: decision && decision.decision === 'mastered', source });
  if (course && it.fromTree) course.lastPracticed = today();
  return decision;
}
