// Skill levels that learn from practice.
// Every clean result (routine, tools, evaluation) becomes evidence: "played an
// exercise of difficulty E at X% of its goal tempo". Each domain's live level
// blends the assessed level with the best evidence, gaining confidence as more
// distinct exercises are proven. Levels move up freely and down by at most one
// level below the assessment.
import { today } from './util.js';
import { DOMAINS, ProfileBuilder } from '../assessment/engine.js';

/** Demonstrated level for a clean run at `frac` of the goal on an exercise of difficulty `level`. */
export function demonstrated(level, frac) {
  return Math.max(1, Math.min(10, level - 1.5 + 2 * Math.min(1.15, Math.max(0, frac))));
}

/**
 * Add evidence. key identifies the exercise (one entry per exercise; the best
 * run is kept). Returns the stored entry.
 */
export function addEvidence(profile, { key, domain, label, level, tempo, goal, clean, source, weight = 1, unit = null }) {
  if (!domain || !goal || !tempo) return null;
  const ev = profile.skillEvidence || (profile.skillEvidence = {});
  const frac = (clean ? 1 : 0.8) * tempo / goal;     // unclean runs count, discounted
  const value = demonstrated(level || 4, frac);
  const prev = ev[key];
  if (!prev || value >= prev.value) ev[key] = { domain, label, level: level || 4, tempo, goal, frac: +frac.toFixed(3), value: +value.toFixed(2), clean: !!clean, source, date: today(), weight, ...(unit ? { unit } : {}) };
  else prev.date = today();
  return ev[key];
}

/** Assessed level stays the anchor; set it once from older profiles. */
export function ensureAssessed(profile) {
  for (const d of DOMAINS) {
    const dm = profile.domains[d.key]; if (!dm) continue;
    if (dm.assessedLevel == null) dm.assessedLevel = dm.level;
  }
}

/** Recompute live levels from assessment + evidence. Returns [{domain, name, from, to}]. */
export function recomputeLevels(profile) {
  ensureAssessed(profile);
  const ev = Object.values(profile.skillEvidence || {});
  const changes = [];
  for (const d of DOMAINS) {
    const dm = profile.domains[d.key]; if (!dm || d.key === 'repertoire') continue;
    const A = dm.assessedLevel;
    const mine = ev.filter(e => e.domain === d.key).sort((a, b) => b.value - a.value);
    const n = mine.length;
    let level = A, E = null;
    if (n) {
      const top = mine.slice(0, 3);
      E = top.reduce((a, e) => a + e.value, 0) / top.length;
      const w = Math.min(0.8, 0.25 + 0.15 * n);      // confidence grows with distinct exercises
      const blended = A * (1 - w) + E * w;
      if (E > A) level = Math.max(A, Math.round(blended));
      else if (n >= 3 && E < A - 1) level = Math.max(A - 1, Math.round(blended));
    }
    level = Math.max(1, Math.min(10, level));
    if (level !== dm.level) changes.push({ domain: d.key, name: d.name, from: dm.level, to: level });
    dm.level = level;
    dm.lessonLevel = E == null ? null : +E.toFixed(1);
    dm.lessonCount = n;
    if (n) {
      const best = mine[0];
      dm.lessonNote = `Best lesson result: ${best.label} at ${best.tempo} ${best.unit || 'BPM'}${best.clean ? ' clean' : ''} (goal ${best.goal}).`;
      dm.basis = dm.basis === 'estimated' && level !== A ? 'lessons' : dm.basis === 'estimated' ? 'estimated' : 'tested + lessons';
    }
  }
  if (changes.length) {
    profile.levelHistory = profile.levelHistory || [];
    changes.forEach(c => profile.levelHistory.push({ date: today(), ...c }));
    if (profile.levelHistory.length > 200) profile.levelHistory.splice(0, profile.levelHistory.length - 200);
    profile.focus = ProfileBuilder.focus(profile);
  }
  return changes;
}

/** Rebuild assessment-derived fields, keep lesson evidence, re-apply it. */
export function rebuildProfile(profile, label = 'Onboarding assessment') {
  ProfileBuilder.build(profile, label);
  for (const d of DOMAINS) { const dm = profile.domains[d.key]; if (dm) dm.assessedLevel = dm.level; }
  recomputeLevels(profile);
  profile.focus = ProfileBuilder.focus(profile);
  return profile;
}

/** Human summary of level changes. */
export function describeChanges(changes) {
  return changes.map(c => `${c.name} ${c.from} → ${c.to}`).join(', ');
}
