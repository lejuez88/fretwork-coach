// "What do you want to work on?" — turns a request in the student's own words
// into 1–4 measurable exercises at the edge of their ability. The request is
// parsed first (chord types, voicings, scales, keys, progressions, techniques);
// Claude writes exercises for it with that reading as a guide, and without a
// key (or if Claude fails) the theory engine builds them. Generated exercises
// can be practiced right away, saved, or added to the daily routines.
import { Claude } from './claude.js';
import { uid, today } from './util.js';
import { DOMAINS, CHORD_SHAPES } from '../assessment/engine.js';
import { CHORD_MIDI } from './audio.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { EXERCISES } from '../tools/exercises.js';
import { normalizeExercise } from './coursegen.js';
import { matchDrills, drillLibrary } from './drills.js';
import { parseRequest, exercisesForRequest } from './topics.js';
import { calibratedTarget, newExerciseState, applyResult } from './progression.js';

export const ASK_EXAMPLES = [
  'My bends sound out of tune', 'Faster alternate picking', 'Switching between F and C', 'Funk 16th-note strumming',
  'Soloing over a blues', 'Learn the notes on the A string', 'Palm-muted metal riffs', 'Travis picking'
];
const DOMAIN_KEYS = DOMAINS.map(d => d.key);
const ROLE_BLOCK = { drill: 'warmup', main: 'stretch', apply: 'music' };
export const roleBlock = r => ROLE_BLOCK[r] || 'stretch';

function brief(p) {
  const q = p.questionnaire;
  const recent = (p.exerciseLog || []).slice(-8).map(e => ({ name: e.name, tempo: e.tempo, goal: e.goalBpm, clean: e.clean }));
  return {
    levels: Object.fromEntries(Object.entries(p.domains || {}).map(([k, v]) => [k, { level: v.level, edge: v.edge }])),
    goals: q.goals, struggles: q.struggles, genres: q.genres.map(g => (GENRE_BY_ID[g] ? GENRE_BY_ID[g].name : g)), players: q.players.map(x => x.name),
    guitar: q.equipment.guitar, recent
  };
}
const levelFor = (p, domain) => (p.domains && p.domains[domain] ? p.domains[domain].level : 4);
function tempoInText(text) { const m = String(text).match(/(\d{2,3})\s*bpm/i); return m ? Math.max(30, Math.min(260, +m[1])) : null; }

/** Claude version. Returns {summary, items:[{role, ex}]} */
async function withClaude(p, text) {
  const lib = EXERCISES.map(e => ({ libId: e.id, name: e.name, domain: e.domain, level: e.level, goalBpm: e.goalBpm }));
  const req = parseRequest(text);
  const hint = { topics: req.topics, chordTypes: req.chordTypes, chords: req.chords, key: req.key ? `${(req.key.minor ? 'minor ' : '')}pc${req.key.pc}` : null, scale: req.scale, progression: req.progression, genre: req.genre };
  const raw = await Claude.json({ feature: 'request',
    system: 'You are a world-class guitar teacher who designs deliberate-practice exercises at the edge of a student\'s ability (70–85% success). You give exactly what was asked for, never a generic substitute.',
    content: `The student typed what they want to work on: "${String(text).slice(0, 600)}"
STUDENT: ${JSON.stringify(brief(p))}
The app's reading of the request (a hint; correct it if it's wrong): ${JSON.stringify(hint)}
Design 2–4 exercises that address EXACTLY this request and nothing generic, in order: a focused drill that isolates the core skill ("drill"), the main exercise(s) ("main"), and a musical application ("apply"). Example: "7th chords and inversions" → the four 7th-chord qualities on one root, the inversions of a 7th chord on one string set up the neck, then a ii–V–I using the nearest inversions. Never answer a chord-type or voicing request with basic open-chord changes.
Rules:
- Calibrate to the student's level in the relevant domain. startBpm = a tempo they can play cleanly today; goalBpm = mastery tempo.${tempoInText(text) ? ` They mentioned ${tempoInText(text)} BPM: use it as the goal if realistic.` : ''}
- Original material only (no copyrighted songs or solos). If they name a song, write original drills for its techniques and suggest using the Songs tab for the song itself.
- Tabs: string 1 = high e, 6 = low E. notes are [string, fret, technique (h|p|/|\\\\|b|~|pm|t or null), beats (note length; default = step)]. Use [0, 0, null, beats] for a rest. Max 48 notes. Use "tuning" (6 MIDI numbers, high string first) only if not standard.
- Chords: any chord symbol is allowed (Cmaj7, Dm7♭5, G7♯9, C/E, Fadd9…). For voicing-specific work give exact grips in "voicings": [{"name":"Cmaj7/E","frets":"xx2413"}] (frets from low E to high e, x = muted, two-digit frets in parentheses, e.g. "x(10)(10)9(12)x"), in the order they're played. "backing" may use any chord symbols.
- You may reuse a built-in exercise with "libId" (then omit tab): ${JSON.stringify(lib)}
- If the request is vague, pick the most likely meaning and say what you assumed in the summary.
Return JSON: {"summary": "1-2 sentences: what these exercises fix and how they'll know it's working", "exercises":[{"role":"drill|main|apply","name":string,"domain": one of ${JSON.stringify(DOMAIN_KEYS)},"why":string,"instr":string (clear steps),"watch":string,"simplify":string,"unit":string,"level":int 1-10,"startBpm":int,"goalBpm":int,"minutes":int 3-10,"metroMode":"all|backbeat|gap","picking":"alternate|strict|economy|down|fingers|hybrid" (picking-hand approach),"libId": optional,"tab": optional {"step":0.25|0.333|0.5|1,"swing":bool,"tuning": optional,"notes":[...]},"voicings": optional [{"name":string,"frets":string}],"chords": optional [symbols],"backing": optional [symbols],"beatsPerBar": optional int}]}`,
    maxTokens: 3500
  });
  const used = new Set();
  const items = (raw.exercises || []).slice(0, 4).map(r => {
    const ex = normalizeExercise({ ...r, id: 'ask-' + (r.name || 'exercise') }, used);
    if (!ex) return null;
    if (['all', 'backbeat', 'gap'].includes(r.metroMode)) ex.metroMode = r.metroMode;
    return { role: ['drill', 'main', 'apply'].includes(r.role) ? r.role : 'main', ex };
  }).filter(Boolean);
  if (!items.length) throw new Error('Claude returned no exercises.');
  return { summary: String(raw.summary || '').slice(0, 400), items };
}

/** Local version from keywords. */
export function localExercises(p, text) {
  const built = exercisesForRequest(p, text);
  if (built.items.length) {
    const summary = `I read this as: ${built.understood.join(' + ') || 'your request'}${/chord|invers|voicing|triad|arpegg|scale|mode|key|progress|tone/.test(built.understood.join(' ')) ? ` (in ${built.key})` : ''}. ${built.items.length > 1 ? 'Start with the drill, then the main exercise' + (built.items.some(i => i.role === 'apply') ? ', then use it musically.' : '.') : ''}${built.req.key ? '' : ' Add “in G”, “A minor” etc. to choose the key.'}`.trim();
    built.items.forEach(it => { it.ex.level = Math.max(1, Math.min(10, it.ex.level || levelFor(p, it.ex.domain))); });
    return { summary, items: built.items, understood: built.understood };
  }
  const genre = p.questionnaire.genres[0] || 'rock';
  const avg = Math.round(Object.values(p.domains || {}).reduce((a, d) => a + d.level, 0) / Math.max(1, Object.keys(p.domains || {}).length)) || 4;
  let { label, picks } = matchDrills(text, { level: avg, genre });
  let summary;
  if (!picks.length) {
    // Nothing matched: work on their current focus area
    const focus = (p.focus && p.focus.domain) || 'picking';
    const D = drillLibrary(levelFor(p, focus), genre);
    const byDomain = { fretting: D.warm, picking: D.burst, rhythm: D.subdiv, fretboard: D.notes, theory: D.triads, ear: D.ear, improv: D.targets, repertoire: D.strum };
    picks = [{ role: 'main', raw: byDomain[focus] || D.warm }];
    summary = `I couldn’t match that to a specific technique, so here’s an exercise for your current focus (${focus}). Add your Claude API key for exercises written for your exact words.`;
  } else summary = `Exercises for ${label}, set to your level. ${Claude.hasKey() ? '' : 'Add your Claude API key for exercises written for your exact request.'}`.trim();
  const used = new Set(), goal = tempoInText(text);
  const items = picks.map(({ role, raw }) => {
    const ex = normalizeExercise({ ...raw, id: 'ask-' + (raw.id || raw.name) }, used);
    if (!ex) return null;
    if (raw.metroMode) ex.metroMode = raw.metroMode;
    ex.level = Math.max(1, Math.min(10, ex.level || levelFor(p, ex.domain)));
    if (goal && role === 'main') { ex.goalBpm = goal; ex.startBpm = Math.min(ex.startBpm, goal); }
    return { role, ex };
  }).filter(Boolean);
  return { summary, items };
}

/**
 * Generate exercises for a request. Returns {summary, items:[{role, ex, targetBpm}], source, error?}.
 * Every exercise is tagged with the request so it can be traced later.
 */
export async function generateExercises(p, text) {
  text = String(text || '').trim();
  if (!text) return { summary: '', items: [], source: 'none' };
  let out = null, error = null, source = 'local';
  if (Claude.hasKey()) {
    try { out = await withClaude(p, text); source = 'claude'; } catch (e) { error = e.message; }
  }
  if (!out) out = localExercises(p, text);
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
