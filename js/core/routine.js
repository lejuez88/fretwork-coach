// Daily routine builder. Structure follows the coaching spec and current
// practice research: short targeted warm-up, spaced review with a harder
// variation, the main "stretch" block at the edge of ability (largest share),
// theory applied on the fretboard, and a musical application to finish.
// Blocks are interleaved by type and every item has a countdown and a tempo.
import { uid, today } from './util.js';
import { Claude } from './claude.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { ensureState, allSkills, activeSkills, reviewDue, calibratedTarget, tempoLadder, newExerciseState } from './progression.js';
import { fallbackExercises } from './coursegen.js';
import { stylePools, rotate } from './styles.js';
import { variationsFor, pickVariation } from './variations.js';

export const BLOCKS = {
  warmup: { label: 'Warm-up', share: 0.10, why: 'Primes the exact motions of today’s stretch.' },
  review: { label: 'Review', share: 0.20, why: 'Spaced repetition with a harder variation keeps old skills sharp.' },
  stretch: { label: 'Stretch', share: 0.35, why: 'Today’s edge-zone work: aim for 70–85% clean.' },
  theory: { label: 'Theory in context', share: 0.15, why: 'One concept, applied on the fretboard right away.' },
  music: { label: 'Musical application', share: 0.20, why: 'Use today’s skills in real music.' }
};
const ORDER = ['warmup', 'review', 'stretch', 'theory', 'music'];
const MIN_ITEM = 2;          // minutes
const OPEN_DEFAULT = 45;     // planned length when there is no time limit

const cloneEx = e => JSON.parse(JSON.stringify(e));
const hashDay = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };

/**
 * Build a routine for one course.
 * budget: minutes number, or null for "no time limit". focusSkillId optionally forces the stretch skill.
 */
export function buildRoutine(profile, course, { budget = null, focusSkillId = null } = {}) {
  const st = ensureState(course, profile);
  const fb = fallbackExercises(course);
  // Style pools: warm-ups, review, theory and music items in this course's style, rotating day to day
  let pools = { warmup: [], review: [], theory: [], music: [] };
  try { pools = stylePools(course); } catch { /* fall back to the standard drills */ }
  const seed = `${course.id}|${today()}`;
  st.extras = st.extras || {};
  const exState = id => st.exercises[id] || st.extras[id] || { target: null };
  // Non-tree exercises (warm-ups, fallback drills) also progress, stored in course.state.extras
  const extraTarget = ex => {
    if (!st.extras[ex.id]) st.extras[ex.id] = newExerciseState(calibratedTarget(ex, ex.level || course.difficulty || 4, profile));
    else if (!st.extras[ex.id].history.length) st.extras[ex.id].target = calibratedTarget(ex, ex.level || course.difficulty || 4, profile);
    return st.extras[ex.id].target;
  };
  const RAMP_ON = { stretch: true, review: true, theory: false, music: false, warmup: false };
  const item = (block, ex, skill, extra = {}) => {
    const targetBpm = extra.targetBpm || (skill ? exState(ex.id).target : extraTarget(ex)) || ex.startBpm;
    const lad = tempoLadder(targetBpm, Math.max(ex.goalBpm, targetBpm));
    return {
      key: uid(), block, exId: ex.id, skillId: skill ? skill.id : null, skillTitle: skill ? skill.title : null,
      ex: cloneEx(ex), minutes: ex.minutes || 5, goalBpm: ex.goalBpm,
      ramp: { enabled: RAMP_ON[block], step: lad.step, max: lad.max, rungs: lad.rungs },
      fromTree: !!skill, ...extra, targetBpm
    };
  };

  const active = activeSkills(course);
  const focus = (focusSkillId && allSkills(course).find(s => s.id === focusSkillId)) || active[0] || allSkills(course)[0];
  const picked = new Set();
  const take = (block, ex, skill, extra) => { picked.add(ex.id); return item(block, ex, skill, extra); };

  // Stretch: unmastered exercises of the focus skill (stalled first, simplified), then the next active skill
  const stretch = [];
  const stretchSkills = [focus, ...active.filter(s => s !== focus)].slice(0, 2);
  for (const s of stretchSkills) for (const e of s.exercises) {
    const es = exState(e.id);
    if (es.mastered || picked.has(e.id) || stretch.length >= 3) continue;
    stretch.push(take('stretch', e, s, es.stalled ? { note: `Stalled: ${e.simplify || 'slow down and isolate the hardest move'}` } : {}));
  }
  if (!stretch.length && focus) stretch.push(take('stretch', focus.exercises[0], focus, { variation: 'Mastered: push 5 BPM past the goal or play it in a new position' }));

  // Prescriptions from evaluations go first in the stretch block (max 2)
  const rxs = (profile.prescriptions || []).filter(r => r.status === 'active' && (!r.courseId || r.courseId === course.id)).slice(0, 2);
  rxs.reverse().forEach(r => {
    const it = item('stretch', r.ex, null, { prescriptionId: r.id, targetBpm: r.state.target, note: r.source === 'your request' ? r.reason : `From your ${r.source || 'evaluation'}: ${r.reason}` });
    stretch.unshift(it); if (stretch.length > 4) stretch.pop();
  });

  // Review: due mastered skills (harder variation), else earlier in-progress work
  const review = [];
  for (const s of reviewDue(course)) {
    const e = s.exercises.find(x => !picked.has(x.id)); if (!e || review.length >= 2) continue;
    review.push(take('review', e, s, { variation: `Review: +5 BPM over your goal (${e.goalBpm + 5}) or a new key/position`, targetBpm: e.goalBpm + 5, isReview: true }));
  }
  if (!review.length) {
    const earlier = allSkills(course).filter(s => s !== focus && ['in_progress', 'mastered'].includes(st.skills[s.id].status));
    for (const s of earlier) { const e = s.exercises.find(x => !picked.has(x.id)); if (e && review.length < 1) review.push(take('review', e, s, { variation: 'Keep it warm: one clean pass at your target, then +3 BPM' })); }
  }
  if (!review.length) { const r = rotate(pools.review, seed + '|review', picked) || fb.notesClick; review.push(take('review', r, null, { variation: 'Keep it fresh: a little faster than last time' })); }

  // Warm-up: a technique primer matching the stretch domain
  const stretchDomain = stretch[0] ? stretch[0].ex.domain : 'fretting';
  const warmPool = pools.warmup.filter(e => e.domain === stretchDomain).length ? pools.warmup.filter(e => e.domain === stretchDomain) : pools.warmup;
  const warmPrefs = stretchDomain === 'picking' ? [fb.crossing, fb.warm] : stretchDomain === 'rhythm' ? [fb.subdiv, fb.warm] : [fb.warm, fb.subdiv];
  const warmEx = rotate(warmPool, seed + '|warm', picked) || rotate(pools.warmup, seed + '|warm2', picked) || warmPrefs.find(e => !picked.has(e.id)) || fb.crossing;
  picked.add(warmEx.id);
  const warmup = [item('warmup', warmEx, null, { targetBpm: Math.round(extraTarget(warmEx) * 0.9), variation: 'Easy tempo, about 90% of your target; focus on relaxation' })];

  // Theory: a theory/fretboard exercise from the tree near the focus, else the key-chords drill
  const theoryCand = allSkills(course).filter(s => ['theory', 'fretboard', 'ear'].includes(s.domain) && st.skills[s.id].status !== 'locked')
    .flatMap(s => s.exercises.map(e => ({ e, s }))).find(x => !picked.has(x.e.id) && !exState(x.e.id).mastered);
  const poolTheory = rotate(pools.theory, seed + '|theory', picked);
  // alternate between the course's own theory skill and the style pool so theory doesn't repeat every day
  const useTree = theoryCand && (!poolTheory || hashDay(seed) % 2 === 0);
  const theory = [useTree ? take('theory', theoryCand.e, theoryCand.s) : poolTheory ? take('theory', poolTheory, null) : item('theory', fb.triads, null)];

  // Music: improv / repertoire exercise from the tree, else a backing-loop solo in the course genre
  const musicCand = allSkills(course).filter(s => ['improv', 'repertoire'].includes(s.domain) && st.skills[s.id].status !== 'locked')
    .flatMap(s => s.exercises.map(e => ({ e, s }))).find(x => !picked.has(x.e.id));
  const poolMusic = rotate(pools.music, seed + '|music', picked);
  const music = [musicCand && (!poolMusic || hashDay(seed + 'm') % 3 !== 0) ? take('music', musicCand.e, musicCand.s) : poolMusic ? take('music', poolMusic, null) : item('music', fb.improvLoop, null)];

  const blocks = { warmup, review, stretch, theory, music };
  const items = allocate(blocks, budget);
  applyVariations(profile, course, items, seed);
  return {
    id: uid(), courseId: course.id, courseName: course.name, genre: course.genre, createdAt: Date.now(), date: today(),
    budget, focusSkillId: focus ? focus.id : null, focusTitle: focus ? focus.title : '',
    items, coach: null
  };
}

/**
 * The spiral, applied: warm-ups rotate through easy variations day to day
 * (spider finger orders, positions, rhythms), reviews of mastered skills come
 * back as a harder variation, and a stalled stretch exercise starts from an
 * easier one. Variation progress lives in profile.varState.
 */
function applyVariations(profile, course, items, seed) {
  const vs = profile.varState || {};
  for (const it of items) {
    if (it.prescriptionId || it.vid) continue;
    const want = it.block === 'warmup' ? 'rotate' : it.block === 'review' && it.isReview ? 'harder' : it.block === 'stretch' && it.note && /^Stalled/.test(it.note) ? 'easier' : null;
    if (!want) continue;
    let list;
    try { list = variationsFor(it.ex, { course, level: it.ex.level || course.difficulty || 4 }); } catch { continue; }
    if (list.length < 2) continue;
    const scope = it.fromTree ? `${course.id}:${it.exId}` : `${course.id}:x:${it.exId}`;
    const v = pickVariation(list, { want, level: course.difficulty || 4, isMastered: vid => !!(vs[`${scope}~${vid}`] || {}).mastered, seed: hashDay(seed + it.exId) });
    if (!v || v.base) continue;
    const st = vs[`${scope}~${v.vid}`];
    it.baseEx = it.ex; it.baseTarget = it.targetBpm; it.baseVariation = it.variation || null;
    it.vid = v.vid; it.ex = cloneEx(v.ex); it.goalBpm = v.ex.goalBpm;
    const cal = calibratedTarget(v.ex, v.level, profile);
    it.targetBpm = st ? st.target : want === 'rotate' ? Math.max(30, Math.round(cal * 0.9)) : cal;
    const lad = tempoLadder(it.targetBpm, Math.max(it.goalBpm, it.targetBpm));
    it.ramp = { ...it.ramp, step: lad.step, max: lad.max, rungs: lad.rungs };
    it.variation = want === 'harder' ? `Review with a harder variation: ${v.label}. ${v.change}`
      : want === 'easier' ? `Start with an easier variation: ${v.label}. ${v.change}`
      : `Today’s variation: ${v.label}. ${v.change} Easy tempo; stay relaxed.`;
  }
}

/**
 * A routine that isn't built from a course: a song lesson or exercises the student asked for.
 * items: [{block, ex, minutes, targetBpm, ramp (false to disable), note, extra}]
 */
export function makeAdhocRoutine({ title, focus = '', genre = null, items, budget = null, kind = 'custom', songId = null }) {
  const RAMP_ON = { stretch: true, review: true, theory: false, music: false, warmup: false };
  const out = items.filter(x => x && x.ex).map(x => {
    const block = BLOCKS[x.block] ? x.block : 'stretch';
    const target = Math.round(x.targetBpm || x.ex.startBpm || 60);
    const lad = tempoLadder(target, Math.max(x.ex.goalBpm || target, target));
    return {
      key: uid(), block, exId: x.ex.id, skillId: null, skillTitle: null, ex: cloneEx(x.ex), minutes: Math.max(MIN_ITEM, round05(x.minutes || x.ex.minutes || 5)),
      goalBpm: x.ex.goalBpm || target, ramp: { enabled: x.ramp === false ? false : RAMP_ON[block], step: lad.step, max: lad.max, rungs: lad.rungs },
      fromTree: false, ...(x.note ? { note: x.note } : {}), ...(x.ex.songId ? { songId: x.ex.songId } : {}), ...(x.extra || {}), targetBpm: target
    };
  });
  const order = ORDER;
  out.sort((a, b) => order.indexOf(a.block) - order.indexOf(b.block));
  if (budget != null && out.length) {
    const sum = out.reduce((a, i) => a + i.minutes, 0);
    out.forEach(i => { i.minutes = Math.max(MIN_ITEM, round05(i.minutes * budget / sum)); });
    fit(out, Math.max(budget, out.length * MIN_ITEM));
  }
  return { id: uid(), courseId: null, courseName: title, genre, createdAt: Date.now(), date: today(), budget, focusSkillId: null, focusTitle: focus, items: out, coach: null, kind, songId };
}

/** Split the budget across blocks by share; keep the stretch block when time is short. */
export function allocate(blocks, budget) {
  const total = budget == null ? OPEN_DEFAULT : budget;
  let order = ORDER.filter(b => blocks[b] && blocks[b].length);
  // Very short sessions: keep stretch first, then review, then music; drop the rest
  const minNeeded = b => blocks[b].length * MIN_ITEM;
  const priority = ['stretch', 'review', 'music', 'warmup', 'theory'];
  let keep = [...order];
  while (keep.reduce((a, b) => a + minNeeded(b), 0) > total && keep.length > 1) {
    const drop = [...priority].reverse().find(b => keep.includes(b) && b !== 'stretch');
    if (!drop) break; keep = keep.filter(b => b !== drop);
  }
  // Trim stretch items if even that block is too big
  if (keep.length === 1 && keep[0] === 'stretch') blocks.stretch = blocks.stretch.slice(0, Math.max(1, Math.floor(total / MIN_ITEM)));
  const shareSum = keep.reduce((a, b) => a + BLOCKS[b].share, 0);
  const out = [];
  for (const b of ORDER) {
    if (!keep.includes(b)) continue;
    const blockMin = total * BLOCKS[b].share / shareSum;
    const per = blockMin / blocks[b].length;
    for (const it of blocks[b]) out.push(Object.assign(it, { minutes: Math.max(MIN_ITEM, round05(budget == null ? Math.max(per, it.ex.minutes || per) : per)) }));
  }
  if (budget != null) fit(out, total);
  return out;
}
const round05 = m => Math.round(m * 2) / 2;
/** Make planned minutes sum exactly to `total`: trim the longest items, pad the stretch block. */
function fit(items, total) {
  let sum = items.reduce((a, i) => a + i.minutes, 0), guard = 0;
  while (sum > total + 0.01 && guard++ < 400) {
    const big = items.filter(i => i.minutes > MIN_ITEM).sort((a, b) => b.minutes - a.minutes)[0];
    if (!big) break; big.minutes -= 0.5; sum -= 0.5;
  }
  if (sum < total - 0.01) { const st = items.find(i => i.block === 'stretch') || items[0]; st.minutes = round05(st.minutes + (total - sum)); }
}

/**
 * Re-fit the remaining items (from index `from`) into `remainingMin`.
 * `currentElapsedMin` is time already spent in item `from`.
 */
export function rebudget(routine, from, remainingMin, currentElapsedMin = 0) {
  const rest = routine.items.slice(from);
  if (remainingMin == null) { // switched to no limit: restore natural lengths
    rest.forEach((it, i) => { it.minutes = Math.max(it.minutes, i === 0 ? currentElapsedMin + MIN_ITEM : MIN_ITEM, it.ex.minutes || 0); });
    routine.budget = null; return routine;
  }
  const priority = { stretch: 5, review: 4, music: 3, warmup: 2, theory: 1 };
  let pool = [...rest];
  // Drop lowest-priority future items while each would get less than the minimum (never the current one)
  while (pool.length > 1 && remainingMin / pool.length < MIN_ITEM) {
    const cand = pool.slice(1).sort((a, b) => priority[a.block] - priority[b.block])[0];
    pool = pool.filter(x => x !== cand);
  }
  const weight = it => (BLOCKS[it.block].share / (routine.items.filter(x => x.block === it.block).length || 1));
  const wsum = pool.reduce((a, it) => a + weight(it), 0);
  pool.forEach((it, i) => {
    let m = remainingMin * weight(it) / wsum;
    if (i === 0) m += currentElapsedMin; // current item keeps the time already spent
    it.minutes = Math.max(MIN_ITEM, round05(m));
  });
  const fitTo = round05(remainingMin + currentElapsedMin);
  pool[0].minutes = Math.max(pool[0].minutes, round05(currentElapsedMin + 0.5));
  fit(pool, Math.max(fitTo, pool.length * MIN_ITEM));
  routine.items = [...routine.items.slice(0, from), ...pool];
  routine.budget = routine.items.slice(0, from).reduce((a, i) => a + (i.actualMin || i.minutes), 0) + remainingMin + currentElapsedMin;
  return routine;
}

/** Optional Claude briefing: session focus, why, theory explanation, music prompt. */
export async function coachBriefing(profile, routine) {
  if (!Claude.hasKey()) return null;
  const q = profile.questionnaire, g = GENRE_BY_ID[routine.genre];
  const items = routine.items.map(i => ({ block: i.block, name: i.ex.name, domain: i.ex.domain, target: i.targetBpm, goal: i.goalBpm, minutes: i.minutes, note: i.note || i.variation || '' }));
  try {
    return await Claude.json({
      system: 'You are a direct, encouraging guitar coach. Keep everything short and concrete.',
      content: `Write the briefing for today's practice routine.
Student: ${q.name}, levels ${JSON.stringify(Object.fromEntries(Object.entries(profile.domains).map(([k, v]) => [k, v.level])))}, players they love: ${q.players.map(p => p.name).join(', ') || 'n/a'}.
Course: "${routine.courseName}" (${g ? g.name : routine.genre}). Focus skill: ${routine.focusTitle}. Budget: ${routine.budget == null ? 'no limit' : routine.budget + ' min'}.
Items: ${JSON.stringify(items)}
Return {"focus": "one sentence: today's primary skill and why it's next", "theory": "3-4 sentences explaining the theory item's concept at this student's level, with one concrete fretboard instruction", "music": "2-3 sentences: how to apply today's skills in the music item, in the style of their players", "tips": {"<item name>": "one-sentence cue for that exercise"}}`,
      maxTokens: 900, model: undefined
    });
  } catch { return null; }
}
