// "Study" for a lesson: what the concept is, why it matters, and the theory behind it, so a
// player can read the lesson before playing it. Written study notes come from the content
// (a skill's `study: {concept, why, theory}` or the path's `overview`); the app adds facts it can
// work out from the exercise itself: the notes it uses and the scale they make, the chords and
// their tones, the rhythm and the learning method. With a Claude key, "Explain it" can write
// study notes for any exercise (saved, so asking again costs nothing).
import { SCALES, SCALE_BY_ID, STD_LOW, mod12, chordTones, parseChord } from './theory.js';
import { methodOf } from './methods.js';
import { beatLabel } from './tempo.js';

const NAMES_S = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'], NAMES_F = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const LABEL = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

/** Pitch classes an exercise's tab uses, with how often each appears. */
export function pitchClassesOf(ex) {
  const notes = (ex && ex.tab && ex.tab.notes) || [];
  const tuning = (ex.tab && ex.tab.tuning) || null;
  const count = {};
  notes.forEach(n => {
    if (n.x === 'mute') return;
    const open = tuning ? tuning[n.s - 1] : STD_LOW[6 - n.s];
    const pc = mod12(open + n.f + (n.x === 'pb' && n.bendTo != null ? n.bendTo - n.f : 0));
    count[pc] = (count[pc] || 0) + 1;
  });
  return count;
}
/**
 * The scale that best explains a set of pitch classes: every note must fit; prefers a root that is
 * used a lot (and is the first note), then the smallest scale. Returns {root, scale, extra: []} or null.
 */
export function inferScale(count, firstPc = null) {
  const pcs = Object.keys(count).map(Number); if (pcs.length < 3) return null;
  let best = null;
  for (let root = 0; root < 12; root++) for (const sc of SCALES) {
    if (sc.id === 'chromatic') continue;
    const set = new Set(sc.steps.map(s => mod12(root + s)));
    if (!pcs.every(pc => set.has(pc))) continue;
    const score = (count[root] || 0) * 3 + (root === firstPc ? 4 : 0) - sc.steps.length * 1.5 + (['minorPent', 'majorPent', 'major', 'minor'].includes(sc.id) ? 1 : 0);
    if (!best || score > best.score) best = { root, scale: sc.id, score };
  }
  return best;
}
const nameIn = (pc, scaleId) => (/♭/.test(SCALE_BY_ID[scaleId] ? SCALE_BY_ID[scaleId].labels.join('') : '') || [5, 10, 3, 8, 1].includes(pc) ? NAMES_F : NAMES_S)[mod12(pc)];

/** Theory facts the app can state about an exercise (plain sentences). */
export function theoryFacts(ex) {
  const out = [];
  if (!ex) return out;
  const count = pitchClassesOf(ex), first = ex.tab && ex.tab.notes && ex.tab.notes[0];
  const firstPc = first ? mod12(((ex.tab.tuning && ex.tab.tuning[first.s - 1]) || STD_LOW[6 - first.s]) + first.f) : null;
  const sc = inferScale(count, firstPc);
  if (sc) {
    const s = SCALE_BY_ID[sc.scale], names = s.steps.map(st => nameIn(sc.root + st, sc.scale));
    const used = Object.keys(count).length;
    out.push(`It uses ${used === s.steps.length ? 'every note' : `${used} of the ${s.steps.length} notes`} of ${nameIn(sc.root, sc.scale)} ${s.name.toLowerCase()}: ${names.join(' ')} (${s.labels.join(' ')}).`);
  } else if (Object.keys(count).length >= 3) {
    const pcs = Object.keys(count).map(Number).sort((a, b) => a - b);
    out.push(`Notes used: ${pcs.map(pc => NAMES_S[pc]).join(' ')}.`);
  }
  const chords = [...new Set([...(ex.chords || []), ...((ex.voicings || []).map(v => v.name).filter(Boolean))])].slice(0, 6);
  chords.forEach(c => {
    const pc = parseChord(c); if (!pc) return;
    const tones = chordTones(pc.root, pc.type);
    if (tones && tones.length) out.push(`${c}: ${tones.map(t => `${t.name} (${t.label === 'R' ? 'root' : t.label})`).join(', ')}.`);
  });
  if (ex.backing && ex.backing.length && !chords.length) out.push(`It loops over ${ex.backing.join(' – ')}.`);
  if (ex.unit) out.push(`Rhythm: ${ex.unit}; the tempo counts ${beatLabel(ex)}${ex.swing || (ex.tab && ex.tab.swing) ? ', swung' : ''}.`);
  return out;
}

/**
 * Study notes for a lesson item ({ex, skill?, entry?, study?}): {concept, why, theory: [..], method, written}.
 * cache: saved Claude study notes keyed by exercise id (p.lessonCache.study).
 */
export function lessonStudy(item, cache = null) {
  const ex = item.ex || {}, sk = item.skill || {}, written = sk.study || item.study || (cache && cache[ex.id]) || null, ov = item.overview || null;
  const theory = [];
  if (written && written.theory) theory.push(...[].concat(written.theory));
  else if (ov && ov.theory) theory.push(...[].concat(ov.theory));
  theory.push(...theoryFacts(ex));
  const m = methodOf(ex.method);
  return {
    concept: (written && written.concept) || sk.summary || (ov && ov.concept) || ex.unit && `A ${String(ex.unit).toLowerCase()} exercise: ${ex.name}.` || '',
    why: (written && written.why) || ex.why || (ov && ov.why) || '',
    theory,
    method: m ? { name: m.name, text: m.detail || m.short } : null,
    written: !!written,
    fromClaude: !!(cache && cache[ex.id] && !(sk.study || item.study))
  };
}
