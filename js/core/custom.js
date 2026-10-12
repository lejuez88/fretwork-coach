// "What do you want to work on?" — turns a request in the student's own words into exercises
// from what the app has researched: the learning path for that technique (taught the way teachers
// teach it), or the theory engine's standard formats for scales, chords and progressions. It never
// improvises drills: a topic that hasn't been researched goes to the research queue, with the
// closest researched paths offered meanwhile. Claude only helps work out which topic was meant.
import { Claude } from './claude.js';
import { uid, today } from './util.js';
import { DOMAINS, CHORD_SHAPES } from '../assessment/engine.js';
import { CHORD_MIDI } from './audio.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { EXERCISES } from '../tools/exercises.js';
import { normalizeExercise } from './coursegen.js';
import { parseRequest, exercisesForRequest } from './topics.js';
import { calibratedTarget, newExerciseState, applyResult } from './progression.js';
import { matchTechniques, matchArtist, loadEntries, stageFor, KB_INDEX, KB_BY_ID, ARTIST_INDEX } from '../data/kb.js';
import { runAtom } from './styles.js';

export const ASK_EXAMPLES = [
  'My bends sound out of tune', 'Faster alternate picking', 'Switching between F and C', 'Funk 16th-note strumming',
  'Soloing over a blues', 'Learn the notes on the A string', 'Palm-muted metal riffs', 'Travis picking'
];
const DOMAIN_KEYS = DOMAINS.map(d => d.key);
const ROLE_BLOCK = { drill: 'warmup', main: 'stretch', apply: 'music' };
export const roleBlock = r => ROLE_BLOCK[r] || 'stretch';

const levelFor = (p, domain) => (p.domains && p.domains[domain] ? p.domains[domain].level : 4);

/**
 * Claude works out which topic the player meant (never designs drills): a researched path id when
 * one fits, else the precise topic name for the research queue. Returns {path, topic, kind, why}.
 */
async function identifyWithClaude(p, text, rejected = null) {
  const paths = KB_INDEX.map(m => ({ id: m.id, title: m.title, aliases: m.aliases, summary: m.summary }));
  const raw = await Claude.json({ feature: 'request',
    system: 'You are an experienced guitar teacher helping a practice app understand what a student wants to learn. You never invent exercises; you only identify the topic.',
    content: `The student typed: "${String(text).slice(0, 400)}"${rejected ? `
The app offered "${String(rejected).slice(0, 200)}" and the student said that's NOT what they meant.` : ''}
The app's researched learning paths: ${JSON.stringify(paths)}
Its artists: ${JSON.stringify(ARTIST_INDEX.map(a => a.name))}
If one path teaches exactly what they asked for, return its id. Otherwise return null and name the topic precisely, the way a guitar teacher would title a lesson series on it (e.g. "Diminished scale (half–whole)", "Chicken picking", "Sight reading").
Return JSON: {"path": id or null, "topic": string, "kind": "technique"|"subject"|"style"|"guitarist", "why": "one short sentence"}`,
    maxTokens: 400
  });
  const path = raw && raw.path && KB_BY_ID[raw.path] ? raw.path : null;
  return { path, topic: String((raw && raw.topic) || text).slice(0, 80), kind: raw && raw.kind ? raw.kind : null, why: raw && raw.why ? String(raw.why).slice(0, 200) : '' };
}

/** Researched paths whose words overlap the request most (for "the closest the app has"). */
export function closestPaths(text, n = 3) {
  const words = String(text).toLowerCase().split(/[^a-z0-9#♯♭]+/).filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'how', 'want', 'learn', 'play', 'practice', 'better', 'guitar', 'my'].includes(w));
  if (!words.length) return [];
  return KB_INDEX.map(m => { const hay = `${m.title} ${(m.aliases || []).join(' ')} ${m.summary}`.toLowerCase(); return { m, score: words.reduce((a, w) => a + (hay.includes(w) ? (m.title.toLowerCase().includes(w) ? 3 : 1) : 0), 0) }; })
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, n).map(x => x.m.id);
}

async function techniqueExercises(p, text) {
  const metas = matchTechniques(text);
  if (!metas.length) return null;
  const a = matchArtist(text);
  const entries = await loadEntries(metas.slice(0, 3).map(x => x.id));
  const items = [], used = new Set();
  entries.forEach((x, ti) => {
    const lvl = levelFor(p, x.domain), st = stageFor(x, lvl) || x.stages[0]; if (!st) return;
    const L = Math.max(st.levels[0], Math.min(st.levels[1], lvl));
    const ctx = a ? a.ctx : x.ctx;
    const c = { key: ctx.key, minor: !!ctx.minor, lvl: L, genre: p.questionnaire.genres[0] || 'rock', prog: ctx.prog || 'minorRock' };
    const exs = st.skills.flatMap(s => s.ex).slice(0, entries.length > 1 ? 2 : 3);
    exs.forEach((e, i) => {
      const raw = typeof e === 'function' ? e(c) : Array.isArray(e) ? runAtom({ ...c, ...(e[2] || {}) }, e[0], e[1] || {}) : e && e.spec ? { ...e.spec, level: L } : null;
      const ex = raw && normalizeExercise({ ...raw, id: 'ask-' + (raw.id || raw.name) }, used);
      if (ex) { ex.level = Math.max(1, Math.min(10, ex.level || L)); items.push({ role: i === 0 && ti === 0 ? 'drill' : 'main', ex }); }
    });
  });
  if (!items.length) return null;
  return { summary: `Exercises for ${metas.map(x => x.title.toLowerCase()).join(', ')}${a ? ` in ${a.name}’s style` : ''}, from the stage of each path that fits your level. The full paths are in Practice → Technique library.`, items, understood: metas.map(x => x.title), matched: true, paths: metas.map(x => x.id) };
}

/** Local version from keywords. */
export async function localExercises(p, text) {
  const tech = await techniqueExercises(p, text);
  if (tech) return tech;
  const built = exercisesForRequest(p, text);
  if (built.items.length) {
    const summary = `I read this as: ${built.understood.join(' + ') || 'your request'}${/chord|invers|voicing|triad|arpegg|scale|mode|key|progress|tone/.test(built.understood.join(' ')) ? ` (in ${built.key})` : ''}. ${built.items.length > 1 ? 'Start with the drill, then the main exercise' + (built.items.some(i => i.role === 'apply') ? ', then use it musically.' : '.') : ''}${built.req.key ? '' : ' Add “in G”, “A minor” etc. to choose the key.'}`.trim();
    built.items.forEach(it => { it.ex.level = Math.max(1, Math.min(10, it.ex.level || levelFor(p, it.ex.domain))); });
    return { summary, items: built.items, understood: built.understood, matched: true };
  }
  // Nothing researched matches: no improvised drills (teaching method first)
  return { summary: '', items: [], matched: false };
}

/**
 * Generate exercises for a request. Returns {summary, items:[{role, ex, targetBpm}], source, error?}.
 * Every exercise is tagged with the request so it can be traced later.
 */
export async function generateExercises(p, text, { mode = 'auto', rejected = null } = {}) {
  text = String(text || '').trim();
  if (!text) return { summary: '', items: [], source: 'none' };
  let out = null, error = null, source = 'local';
  const local = mode === 'claude' ? { items: [], matched: false } : await localExercises(p, text);
  if (local.matched) out = local;
  else if (Claude.hasKey()) {
    // Claude names the topic: a researched path → its lessons; otherwise → the research queue
    try {
      const id = await identifyWithClaude(p, text, rejected);
      if (id.path) {
        const tech = await techniqueExercises(p, KB_BY_ID[id.path].title);
        if (tech) { out = { ...tech, summary: `${id.why ? id.why + ' ' : ''}${tech.summary}` }; source = 'claude'; }
      }
      if (!out) out = { summary: '', items: [], matched: false, queue: { text: id.topic, kind: id.kind } };
    } catch (e) { error = e.message; }
  }
  if (!out) out = { summary: '', items: [], matched: false };
  if (!out.items.length) {
    out.paths = closestPaths(text);
    out.queue = out.queue || { text, kind: null };
    out.summary = `The app teaches only what it has researched, so it won’t make up drills for “${out.queue.text}”.`;
    source = 'none';
  }
  out.items.forEach(it => {
    it.ex.request = text.slice(0, 200); it.ex.source = 'request';
    it.targetBpm = calibratedTarget(it.ex, it.ex.level || levelFor(p, it.ex.domain), p);
  });
  return { ...out, source, ...(error ? { error } : {}) };
}

/* ------------------------- Saved custom exercises ------------------------- */
export function saveCustom(p, ex, request = '') {
  const have = p.customExercises.find(c => c.ex.id === ex.id && c.request === request);
  if (have) return have;
  const entry = { id: uid(), ex: JSON.parse(JSON.stringify(ex)), request: String(request || ex.request || '').slice(0, 200), createdAt: today(), state: newExerciseState(calibratedTarget(ex, ex.level || 4, p)) };
  p.customExercises.push(entry);
  return entry;
}
export function removeCustom(p, id) { p.customExercises = p.customExercises.filter(c => c.id !== id); }
export function recordCustom(p, id, result) {
  const c = p.customExercises.find(x => x.id === id); if (!c) return null;
  const out = applyResult(c.state, c.ex, result);
  c.lastPracticed = result.date || today();
  return Object.assign(out, { target: c.state.target, level: c.ex.level || 4, ex: c.ex });
}
/** Add to the daily routines: a prescription that goes first in the stretch block. */
export function addToRoutines(p, ex, request = '', courseId = null) {
  if (p.prescriptions.some(r => r.status === 'active' && r.ex.id === ex.id)) return null;
  const rx = { id: uid(), ex: JSON.parse(JSON.stringify(ex)), reason: `You asked: “${String(request || ex.request || ex.name).slice(0, 120)}”`, source: 'your request', from: null, courseId, addedAt: today(), status: 'active', state: newExerciseState(calibratedTarget(ex, ex.level || 4, p)) };
  p.prescriptions.push(rx);
  return rx;
}
