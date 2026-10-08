// Course curriculum generation. Claude builds a full course tree (units →
// skills → exercises, every exercise with a goal tempo); a local generator
// covers the no-key case. Everything is validated and normalized so the
// routine engine and tab player can trust the shape.
import { Claude } from './claude.js';
import { uid } from './util.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { EXERCISES, EXERCISE_BY_ID } from '../tools/exercises.js';
import { CHORD_SHAPES, DOMAINS } from '../assessment/engine.js';
import { CHORD_MIDI } from './audio.js';
import { parseChord, stringToFrets, describeVoicing } from './theory.js';
import { styleTreeRaw, styleDef, styleContext, progressionNames } from './styles.js';

const DOMAIN_KEYS = DOMAINS.map(d => d.key);
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || uid();
const clampN = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(a, Math.min(b, Math.round(v))) : d; };

/** Backing progressions per genre (chord names must exist in CHORD_MIDI). */
export const GENRE_BACKING = {
  blues: ['A7', 'A7', 'D7', 'A7', 'E7', 'D7', 'A7', 'E7'],
  rock: ['Am', 'G', 'F', 'G'], 'classic-rock': ['E', 'D', 'A', 'E'], metal: ['Em', 'C', 'D', 'Em'], punk: ['G', 'C', 'D', 'G'],
  indie: ['C', 'Am', 'F', 'G'], pop: ['G', 'D', 'Em', 'C'], folk: ['G', 'C', 'D', 'G'], country: ['G', 'C', 'D', 'G'],
  funk: ['Am7', 'D7', 'Am7', 'D7'], neosoul: ['Am7', 'D7', 'Gmaj7', 'Gmaj7'], jazz: ['Am7', 'D7', 'Gmaj7', 'Gmaj7'],
  fingerstyle: ['C', 'G', 'Am', 'F'], prog: ['Em', 'C', 'G', 'D'], jrock: ['F', 'G', 'Em', 'Am'], latin: ['Am', 'G', 'F', 'E']
};

/* ------------------------------ Normalizing ----------------------------- */
const TECHS = ['h', 'p', '/', '\\', 'b', '~', 'pm', 't'];
const PICKING = ['alternate', 'strict', 'economy', 'down', 'fingers', 'hybrid'];
const validTuning = t => (Array.isArray(t) && t.length === 6 && t.every(m => Number.isInteger(m) && m >= 28 && m <= 76) ? t.slice() : null);
function normTab(tab) {
  if (!tab || !Array.isArray(tab.notes)) return null;
  const tuning = validTuning(tab.tuning);
  // Already-timed notes (imported tab sections, library exercises): keep their rhythm
  if (tab.notes.length && tab.notes.every(n => n && !Array.isArray(n) && typeof n === 'object')) {
    const notes = tab.notes.slice(0, 400).filter(n => n.s >= 1 && n.s <= 6 && n.f >= 0 && n.f <= 24 && n.t >= 0 && n.d > 0)
      .map(n => ({ t: +n.t, d: +n.d, s: +n.s, f: +n.f, ...(n.x ? { x: n.x } : {}), ...(n.chord ? { chord: true } : {}), ...(n.bendTo != null ? { bendTo: n.bendTo } : {}) }));
    if (notes.length < 1) return null;
    return { notes, swing: !!tab.swing, ...(tab.beats ? { beats: +tab.beats } : {}), ...(tuning ? { tuning } : {}) };
  }
  // Claude's compact form: [[string, fret, tech?, beats?], ...] with a default step
  const step = [0.25, 1 / 3, 0.5, 1].reduce((b, v) => (Math.abs(v - Number(tab.step)) < Math.abs(b - Number(tab.step)) ? v : b), 0.5);
  const notes = []; let t = 0;
  for (const n of tab.notes.slice(0, 64)) {
    if (!Array.isArray(n)) continue;
    const s = Number(n[0]), f = Number(n[1]);
    const d = [0.25, 1 / 3, 0.5, 0.75, 1, 1.5, 2, 3, 4].find(v => Math.abs(v - Number(n[3])) < 0.02) || step;
    if (s === 0 || n[0] === 'r') { t += d; continue; }            // rest
    if (!(s >= 1 && s <= 6 && f >= 0 && f <= 22 && Number.isInteger(s) && Number.isInteger(f))) continue;
    const x = TECHS.includes(n[2]) ? n[2] : undefined;
    notes.push({ t: Math.round(t * 1000) / 1000, d, s, f, ...(x ? { x } : {}) });
    t += d;
  }
  return notes.length >= 3 ? { notes, swing: !!tab.swing && step === 0.5, ...(tuning ? { tuning } : {}) } : null;
}

export function normalizeExercise(raw, used = new Set()) {
  if (!raw || typeof raw !== 'object') return null;
  let id = slug(raw.id || raw.name);
  while (used.has(id)) id = id + '-' + uid().slice(0, 3);
  used.add(id);
  const lib = raw.libId && EXERCISE_BY_ID[raw.libId];
  const goal = clampN(raw.goalBpm || (lib && lib.goalBpm), 30, 260, 100);
  const start = clampN(raw.startBpm || (lib && lib.bpm) || goal * 0.6, 30, goal, Math.round(goal * 0.6));
  const tab = lib ? { notes: lib.notes, swing: !!lib.swing, ...(lib.beats ? { beats: lib.beats } : {}) } : normTab(raw.tab);
  return {
    id, name: String(raw.name || (lib && lib.name) || 'Exercise').slice(0, 70),
    domain: DOMAIN_KEYS.includes(raw.domain) ? raw.domain : (lib ? lib.domain : 'fretting'),
    why: String(raw.why || (lib && lib.why) || '').slice(0, 240),
    instr: String(raw.instr || raw.instructions || '').slice(0, 600),
    watch: String(raw.watch || '').slice(0, 200),
    simplify: String(raw.simplify || '').slice(0, 200),
    unit: String(raw.unit || (lib && lib.unit) || 'quarter notes').slice(0, 30),
    goalBpm: goal, startBpm: start,
    level: raw.level != null ? clampN(raw.level, 1, 10, null) : (lib ? lib.level : null),
    minutes: clampN(raw.minutes, 2, 20, 5),
    libId: lib ? lib.id : null,
    tab, // {notes, swing} | null
    chords: Array.isArray(raw.chords) ? raw.chords.map(String).filter(c => CHORD_SHAPES[c] || parseChord(c)).slice(0, 8) : [],
    backing: Array.isArray(raw.backing) ? raw.backing.map(String).filter(c => CHORD_MIDI[c] || parseChord(c)).slice(0, 12) : [],
    ...(normVoicings(raw.voicings).length ? { voicings: normVoicings(raw.voicings) } : {}),
    ...(clampN(raw.beatsPerBar, 2, 12, 0) && raw.beatsPerBar != 4 ? { beatsPerBar: clampN(raw.beatsPerBar, 2, 12, 4) } : {}),
    ...(['backbeat', 'gap'].includes(raw.metroMode) ? { metroMode: raw.metroMode } : {}),
    ...(PICKING.includes(raw.picking) ? { picking: raw.picking } : {}),
    ...(raw.pickKey ? { pickKey: String(raw.pickKey).slice(0, 60) } : {}),
    ...(normGen(raw.gen) ? { gen: normGen(raw.gen) } : {}),
    ...(typeof raw.family === 'string' && /^[a-z]{2,20}$/.test(raw.family) ? { family: raw.family } : {})
  };
}

/** How a generated exercise was made ({atom, opts, c}); lets variations re-run it. */
function normGen(g) {
  if (!g || typeof g !== 'object' || typeof g.atom !== 'string' || !/^[a-zA-Z]{2,30}$/.test(g.atom) || !g.c || typeof g.c !== 'object') return null;
  try {
    const opts = JSON.parse(JSON.stringify(g.opts || {}));
    if (JSON.stringify(opts).length > 600) return null;
    const c = { key: ((Number(g.c.key) % 12) + 12) % 12 || 0, minor: !!g.c.minor, lvl: clampN(g.c.lvl, 1, 10, 4), genre: typeof g.c.genre === 'string' ? g.c.genre.slice(0, 20) : null, prog: typeof g.c.prog === 'string' ? g.c.prog.slice(0, 20) : null };
    return { atom: g.atom, opts, c };
  } catch { return null; }
}

/** Chord voicings for diagrams: [{name, frets (low→high, null = muted)}] from arrays or "x32010" strings. */
function normVoicings(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 12).map(v => {
    if (!v) return null;
    const frets = Array.isArray(v.frets) ? v.frets.map(f => (f == null || f === 'x' || f === 'X' ? null : Number(f))) : stringToFrets(v.frets);
    if (!frets || frets.length !== 6 || frets.some(f => f != null && !(f >= 0 && f <= 22)) || frets.every(f => f == null)) return null;
    const name = String(v.name || v.chord || '').slice(0, 16), d = name ? describeVoicing(frets, name) : null;
    return { name, frets, labels: d ? d.labels : (v.labels || null), names: d ? d.names : (v.names || null), fingers: d ? d.fingers : (v.fingers || null), barre: d ? d.barre : (v.barre || null) };
  }).filter(Boolean);
}

export function normalizeTree(raw, meta) {
  const usedSkill = new Set(), usedEx = new Set();
  const units = [];
  for (const u of (raw && raw.units || []).slice(0, 8)) {
    const skills = [];
    for (const s of (u.skills || []).slice(0, 5)) {
      let id = slug(s.id || s.title); while (usedSkill.has(id)) id += '-' + uid().slice(0, 3); usedSkill.add(id);
      const exercises = (s.exercises || []).slice(0, 4).map(e => normalizeExercise(e, usedEx)).filter(Boolean);
      if (!exercises.length) continue;
      skills.push({ id, title: String(s.title || 'Skill').slice(0, 60), domain: DOMAIN_KEYS.includes(s.domain) ? s.domain : exercises[0].domain, summary: String(s.summary || '').slice(0, 240), prereqs: Array.isArray(s.prereqs) ? s.prereqs.map(slug) : [], exercises });
    }
    if (skills.length) units.push({ id: 'u' + units.length, title: String(u.title || `Unit ${units.length + 1}`).slice(0, 60), summary: String(u.summary || '').slice(0, 240), skills });
  }
  // Exercise difficulty: climb from the course level to +2 across the units when not given
  const base = clampN(meta.difficulty, 1, 10, 4);
  units.forEach((u, ui) => u.skills.forEach(s => s.exercises.forEach(e => {
    if (e.level == null) e.level = Math.max(1, Math.min(10, Math.round(base - 0.5 + ui * (2.5 / Math.max(1, units.length - 1)))));
  })));
  // Drop unknown prereqs; default each skill to depend on the previous unit's last skill
  const all = new Set(units.flatMap(u => u.skills.map(s => s.id)));
  units.forEach((u, ui) => u.skills.forEach(s => {
    s.prereqs = s.prereqs.filter(p => all.has(p) && p !== s.id);
    if (!s.prereqs.length && ui > 0) s.prereqs = [units[ui - 1].skills[units[ui - 1].skills.length - 1].id];
  }));
  return { version: meta.version || 1, generatedBy: meta.generatedBy, generatedAt: Date.now(), summary: String(raw && raw.summary || '').slice(0, 300), units, ...(meta.style ? { style: meta.style } : {}) };
}

/* ----------------------------- Claude builder ---------------------------- */
function profileBrief(profile) {
  const q = profile.questionnaire, d = profile.domains;
  return {
    name: q.name, experience: q.experience, goals: q.goals, goalsOther: q.goalsOther, struggles: q.struggles,
    levels: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, { level: v.level, edge: v.edge }])),
    practiceMinutes: q.practice, guitar: q.equipment.guitar,
    players: q.players.map(p => ({ name: p.name, style: p.style, techniques: p.techniques }))
  };
}

export async function generateTreeWithClaude(profile, course) {
  const genre = GENRE_BY_ID[course.genre];
  const lib = EXERCISES.map(e => ({ libId: e.id, name: e.name, domain: e.domain, level: e.level, goalBpm: e.goalBpm }));
  const sd = styleDef(course.genre, course.style), sc = styleContext(course);
  const outline = (sd.units || []).map(u => `${u.title}: ${u.skills.map(x => x.title).join('; ')}`).join(' | ');
  const content = `Design a complete guitar course as a skill tree.

COURSE: "${course.name}". Genre: ${genre ? genre.name : course.genre}. Style focus: ${course.style}. Difficulty ${course.difficulty}/10. Inspired by: ${course.players.join(', ') || 'none'}.
STUDENT: ${JSON.stringify(profileBrief(profile))}
STYLE REFERENCE (a starting point; go deeper and more specific): typical key ${sd.key}${sd.minor ? ' minor' : ''}, typical progression ${progressionNames(sc.key, sd.prog).join(' – ')}. Outline: ${outline}

Teaching rules (follow all):
- Make it SURGICALLY specific to "${course.style}": its signature techniques, rhythms, keys, chord types, progressions and phrasing, and the players named. Every skill must be something a teacher of this exact style would assign. No generic filler (chromatic spider drills, G–C–D changes, generic pentatonic runs) unless this style truly calls for it.
- Calibrate to the student's levels; start each domain at their current edge, never below it, and climb to roughly level ${Math.min(10, course.difficulty + 2)} by the end.
- Theory follows the hands: each theory skill is applied on the fretboard right away, in this style's keys and progressions.
- Cover technique, rhythm, fretboard, theory, ear and improvisation as one connected system, all in the style.
- EVERY exercise is measurable with a metronome: startBpm (a tempo THIS student can already play cleanly) and goalBpm (mastery tempo). Theory/ear exercises are tempo-based drills too.
- Exercises are ORIGINAL drills "in the style of" the players; never transcribe copyrighted songs or solos.
- Standard tuning (or say "tuning" if the style needs another). Tabs: string 1 = high e, string 6 = low E; give a tab for single-note lines (max 48 notes; note = [string, fret, technique or null, beats]).
- Chord parts: any chord symbol is allowed (Cmaj7, F♯m7♭5, E7♯9, Dsus2, A/C♯…). Give exact grips in "voicings" as [{"name":"Cmaj7","frets":"x32000"}] (frets low E → high e, x = muted, two-digit frets in parentheses like "x(10)(12)(11)(12)x") whenever the voicing matters (inversions, drop-2, shells, triads on string sets). "backing" loops may use any chord symbols.
- You may reuse built-in exercises by setting "libId" (then omit tab), only if they fit the style: ${JSON.stringify(lib)}

Size: 4–6 units; 2–3 skills per unit; 2–3 exercises per skill.

Return JSON:
{"summary": string (2 sentences: what the student can do at the end, in this style),
 "units":[{"title":string,"summary":string,
   "skills":[{"id":"kebab-slug","title":string,"domain":one of ${JSON.stringify(DOMAIN_KEYS)},"summary":string (1 sentence),"prereqs":[skill ids],
     "exercises":[{"id":"kebab-slug","name":string,"domain":string,"why":string (1-2 sentences, why this matters in this style),"instr":string (clear steps),"watch":string (common mistake),"simplify":string (easier variant if stuck),
       "unit":"8ths|16ths|triplets|quarter notes|2 beats per chord|...","level":int 1-10,"startBpm":int,"goalBpm":int,"minutes":int (3-10),
       "picking":"alternate|strict|economy|down|fingers|hybrid","libId":optional,"tab":optional {"step":0.25|0.333|0.5|1,"swing":bool,"notes":[[string,fret,"h|p|/|b|~|pm|t" optional, beats optional],...]},
       "voicings":optional [{"name":string,"frets":string}],"chords":optional [symbols],"backing":optional [symbols],"beatsPerBar":optional int (odd meters)}]}]}]}`;
  const raw = await Claude.json({ feature: 'course-plan',
    system: 'You are a world-class guitar teacher and curriculum designer who uses deliberate practice, the 70–85% success "edge zone", spaced repetition and interleaving.',
    content, maxTokens: 12000
  });
  const tree = normalizeTree(raw, { generatedBy: 'claude', difficulty: course.difficulty, style: course.style });
  if (!tree.units.length) throw new Error('Claude returned an empty course.');
  return tree;
}

/* ----------------------------- Local builder ----------------------------- */
const BOX2 = [[6, 8], [6, 10], [5, 7], [5, 10], [4, 7], [4, 10], [3, 7], [3, 9], [2, 8], [2, 10], [1, 8], [1, 10]];
const seqTab = (pairs, step = 0.5) => ({ step, notes: pairs });

function localTemplates(genreId, diff) {
  const k = 0.75 + diff * 0.05; // tempo scale by difficulty
  const g = n => Math.round(n * k);
  const backing = GENRE_BACKING[genreId] || GENRE_BACKING.rock;
  const lib = id => ({ libId: id, goalBpm: g(EXERCISE_BY_ID[id].goalBpm), startBpm: EXERCISE_BY_ID[id].bpm });
  return {
    warm: { ...lib('spider-1234'), id: 'spider', name: 'Chromatic spider warm-up', domain: 'fretting', minutes: 4, instr: 'One finger per fret, strict alternate picking. Stay relaxed; lift fingers only just off the strings.', watch: 'Flying fingers and squeezing the neck.', simplify: 'Two strings only, 8th notes.' },
    changes: { ...lib('gcd-changes'), id: 'gcd', name: 'G–C–D changes on the click', domain: 'fretting', chords: ['G', 'C', 'D'], minutes: 5, instr: 'Strum each chord twice, change on the "&" of 2. Land every change cleanly on beat 1.', watch: 'Late changes that choke the last strum.', simplify: 'G–C only, 4 beats per chord.' },
    box1: { ...lib('penta-box1'), id: 'box1', name: 'Minor pentatonic box 1', domain: 'fretboard', minutes: 5, instr: 'Up and down in 8ths, saying each note name on the way up.', watch: 'Uneven timing at string changes.', simplify: 'Bottom three strings only.' },
    box2: { id: 'box2', name: 'Minor pentatonic box 2', domain: 'fretboard', unit: '8ths', startBpm: 60, goalBpm: g(130), minutes: 5, tab: seqTab([...BOX2, ...[...BOX2].reverse().slice(1)]), why: 'Box 2 links to box 1 and frees your solos from one position.', instr: 'Up and down in 8ths, then connect it to box 1 with a slide on the G string.', watch: 'Losing the root (A at fret 10 on the D string).', simplify: 'Play box 2 in quarter notes.' },
    penta16: { ...lib('penta-16ths'), id: 'penta16', name: 'Pentatonic 16th-note runs', domain: 'picking', minutes: 6, instr: 'Strict alternate picking, accent each beat.', watch: 'Forearm tension as you speed up.', simplify: '8th notes at the same click.' },
    crossing: { ...lib('string-skip'), id: 'crossing', name: 'String-crossing pattern', domain: 'picking', minutes: 5, instr: 'Keep the pick motion small; the wrist does the work.', watch: 'Hitting neighbouring strings.', simplify: 'Two strings only.' },
    shuffle: { ...lib('blues-shuffle-a'), id: 'shuffle', name: 'Shuffle riff with palm mute', domain: 'rhythm', minutes: 5, instr: 'Swing the 8ths: long-short. Palm-mute the low string lightly.', watch: 'Straightening the swing as you speed up.', simplify: 'Quarter notes only, keep the swing in your head.' },
    legato: { ...lib('legato-3nps'), id: 'legato3', name: '3-note-per-string legato', domain: 'fretting', minutes: 6, instr: 'Pick only the first note on each string; hammers and pull-offs must match the picked note\'s volume.', watch: 'Weak hammer-ons.', simplify: 'One string at a time.' },
    subdiv: { id: 'subdiv', name: 'Subdivision ladder', domain: 'rhythm', unit: 'quarters→16ths', startBpm: 60, goalBpm: g(100), minutes: 4, why: 'Switching subdivisions on demand builds the internal grid every style needs.', instr: 'Muted strums: 1 bar each of quarters, 8ths, triplets, 16ths, then repeat without stopping.', watch: 'Triplets drifting into a dotted feel.', simplify: 'Quarters ↔ 8ths only.' },
    notesClick: { id: 'notenames', name: 'Note names on the click', domain: 'fretboard', unit: 'one note per beat', startBpm: 40, goalBpm: g(80), minutes: 4, why: 'Instant note recall is what lets you find roots for chords and solos anywhere.', instr: 'Pick a note (start with A). Play every A on the neck from low to high, one per click. Next round: C, then G.', watch: 'Pausing to count frets from the nut.', simplify: 'Strings 6 and 5 only.' },
    triads: { id: 'triads', name: 'Build the key\'s chords in time', domain: 'theory', unit: 'one chord per bar', startBpm: 50, goalBpm: g(90), minutes: 5, why: 'Knowing which chords live in a key tells you what to play and which notes to target.', instr: 'In the key of your backing (start in G): play the triads I ii iii IV V vi on strings 4-3-2, one per bar, saying the numeral aloud.', watch: 'Mixing up the minor ii and iii.', simplify: 'Only I, IV and V.' },
    earEcho: { id: 'earecho', name: 'Echo phrases by ear', domain: 'ear', unit: '2-bar phrases', startBpm: 60, goalBpm: g(100), minutes: 4, backing, why: 'Copying short phrases in time is the fastest way to play what you hear.', instr: 'Hum a 2-bar phrase over the loop, then find it on the neck in the next 2 bars. Start with 3-note phrases from box 1.', watch: 'Stopping the loop to search. Keep it going.', simplify: '2-note phrases, root plus one note.' },
    improvLoop: { id: 'improv', name: `${GENRE_BY_ID[genreId] ? GENRE_BY_ID[genreId].name : 'Style'} solo over the loop`, domain: 'improv', unit: 'phrases', startBpm: 70, goalBpm: g(110), minutes: 6, backing, why: 'Applying today\'s shapes in real music turns drills into vocabulary.', instr: 'Solo over the backing loop. Use short phrases with space between, land on a chord tone at each change, and repeat one idea before moving on.', watch: 'Running the scale up and down without phrasing.', simplify: 'Three notes only for the whole loop.' },
    targets: { id: 'targets', name: 'Target chord tones on the changes', domain: 'improv', unit: 'one target per bar', startBpm: 60, goalBpm: g(100), minutes: 6, backing, why: 'Landing on chord tones at the changes makes a solo follow the harmony.', instr: 'On beat 1 of every bar, land on the root of the chord. Second round: land on the 3rd.', watch: 'Arriving late: aim from beat 3 of the bar before.', simplify: 'Whole notes: only the targets, in time.' },
    sweep: { ...lib('sweep-am'), id: 'sweep', name: '3-string minor sweep', domain: 'picking', minutes: 6, instr: 'One continuous push through three strings; mute each note as you leave it.', watch: 'Notes ringing together.', simplify: 'Pick the same notes separately.' }
  };
}

export const LOCAL_TREE_VERSION = 2;
/** Style-specific plan built from the style library (no API key needed). */
export function generateTreeLocal(course) {
  const raw = styleTreeRaw(course);
  return normalizeTree(raw, { generatedBy: 'local', difficulty: course.difficulty, version: LOCAL_TREE_VERSION, style: course.style });
}

/** Older local plans were the same template for every style; these should be rebuilt. */
export function isGenericPlan(course) {
  return !!(course && course.tree && course.tree.generatedBy === 'local' && (course.tree.version || 1) < LOCAL_TREE_VERSION);
}
/** Replace an untouched old generic plan with the style-specific one. Returns true if upgraded. */
export function upgradeGenericPlan(course) {
  if (!isGenericPlan(course) || planHasProgress(course)) return false;
  course.tree = generateTreeLocal(course); course.state = null;
  return true;
}
export function planHasProgress(course) {
  const st = course && course.state;
  return !!(st && Object.values(st.exercises || {}).some(e => e.history && e.history.length));
}

/** Generate and attach a tree (Claude first, local fallback). Returns {tree, usedClaude, error}. */
export async function buildCourseTree(profile, course) {
  let tree = null, error = null;
  if (Claude.hasKey()) {
    try { tree = await generateTreeWithClaude(profile, course); } catch (e) { error = e.message; }
  }
  if (!tree) tree = generateTreeLocal(course);
  course.tree = tree;
  course.state = null; // progression initializes on next access
  return { tree, usedClaude: tree.generatedBy === 'claude', error };
}

/** Local exercises the routine engine can always fall back on. */
export function fallbackExercises(course) {
  const T = localTemplates(course.genre, course.difficulty || 3);
  const used = new Set();
  return Object.fromEntries(Object.entries(T).map(([k, v]) => [k, normalizeExercise(v, used)]));
}

/** Convert an exercise spec into the tab player's format (null if it has no tab). */
export function toPlayerExercise(ex, bpm) {
  if (!ex.tab || !ex.tab.notes || !ex.tab.notes.length) return null;
  return { id: ex.id, name: ex.name, unit: ex.unit, why: ex.why, goalBpm: ex.goalBpm, bpm: bpm || ex.startBpm, notes: ex.tab.notes, swing: ex.tab.swing,
    ...(ex.tab.beats ? { beats: ex.tab.beats } : {}), ...(ex.tab.tuning || ex.tuning ? { tuning: ex.tab.tuning || ex.tuning } : {}),
    instr: ex.instr, ...(ex.picking ? { picking: ex.picking } : {}), ...(ex.pickKey ? { pickKey: ex.pickKey } : {}), ...(ex.beatsPerBar ? { beatsPerBar: ex.beatsPerBar } : {}) };
}
