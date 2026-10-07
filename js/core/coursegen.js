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
function normTab(tab) {
  if (!tab || !Array.isArray(tab.notes)) return null;
  const step = [0.25, 1 / 3, 0.5, 1].reduce((b, v) => (Math.abs(v - Number(tab.step)) < Math.abs(b - Number(tab.step)) ? v : b), 0.5);
  const notes = [];
  for (const n of tab.notes.slice(0, 64)) {
    if (!Array.isArray(n)) continue;
    const s = Number(n[0]), f = Number(n[1]);
    if (!(s >= 1 && s <= 6 && f >= 0 && f <= 22 && Number.isInteger(s) && Number.isInteger(f))) continue;
    const x = ['h', 'p', '/', '\\', 'b', '~', 'pm'].includes(n[2]) ? n[2] : undefined;
    notes.push({ t: notes.length * step, d: step, s, f, ...(x ? { x } : {}) });
  }
  return notes.length >= 3 ? { notes, swing: !!tab.swing && step === 0.5 } : null;
}

export function normalizeExercise(raw, used = new Set()) {
  if (!raw || typeof raw !== 'object') return null;
  let id = slug(raw.id || raw.name);
  while (used.has(id)) id = id + '-' + uid().slice(0, 3);
  used.add(id);
  const lib = raw.libId && EXERCISE_BY_ID[raw.libId];
  const goal = clampN(raw.goalBpm || (lib && lib.goalBpm), 30, 260, 100);
  const start = clampN(raw.startBpm || (lib && lib.bpm) || goal * 0.6, 30, goal, Math.round(goal * 0.6));
  const tab = lib ? { notes: lib.notes, swing: !!lib.swing } : normTab(raw.tab);
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
    chords: Array.isArray(raw.chords) ? raw.chords.filter(c => CHORD_SHAPES[c]).slice(0, 4) : [],
    backing: Array.isArray(raw.backing) ? raw.backing.filter(c => CHORD_MIDI[c]).slice(0, 8) : [],
    ...(['backbeat', 'gap'].includes(raw.metroMode) ? { metroMode: raw.metroMode } : {})
  };
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
  return { version: 1, generatedBy: meta.generatedBy, generatedAt: Date.now(), summary: String(raw && raw.summary || '').slice(0, 300), units };
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
  const content = `Design a complete guitar course as a skill tree.

COURSE: "${course.name}". Genre: ${genre ? genre.name : course.genre}. Style focus: ${course.style}. Difficulty ${course.difficulty}/10. Inspired by: ${course.players.join(', ') || 'none'}.
STUDENT: ${JSON.stringify(profileBrief(profile))}

Teaching rules (follow all):
- Calibrate to the student's levels; start each domain at their current edge, never below it, and climb to roughly level ${Math.min(10, course.difficulty + 2)} by the end.
- Theory follows the hands: each theory skill is applied on the fretboard right away.
- Cover technique, rhythm, fretboard, theory, ear and improvisation as one connected system, biased toward this style.
- EVERY exercise is measurable with a metronome: give startBpm (a comfortable working tempo) and goalBpm (mastery tempo). For theory/ear exercises, make them tempo-based drills (e.g. name notes on each click, play the interval you hear in time).
- Exercises are ORIGINAL drills "in the style of" the players; never transcribe copyrighted songs or solos.
- Standard tuning. Tabs: string 1 = high e, string 6 = low E. Only give a tab for single-note lines (max 32 notes). Chords go in "chords" (only from: ${Object.keys(CHORD_SHAPES).join(', ')}).
- You may reuse built-in exercises by setting "libId" (then omit tab): ${JSON.stringify(lib)}
- Backing loops for improv/rhythm may use chords from: ${Object.keys(CHORD_MIDI).join(', ')}.

Size: 4–6 units; 2–3 skills per unit; 1–3 exercises per skill.

Return JSON:
{"summary": string (2 sentences: what the student can do at the end),
 "units":[{"title":string,"summary":string,
   "skills":[{"id":"kebab-slug","title":string,"domain":one of ${JSON.stringify(DOMAIN_KEYS)},"summary":string (1 sentence),"prereqs":[skill ids],
     "exercises":[{"id":"kebab-slug","name":string,"domain":string,"why":string (1-2 sentences),"instr":string (clear steps),"watch":string (common mistake),"simplify":string (easier variant if stuck),
       "unit":"8ths|16ths|triplets|quarter notes|2 beats per chord|...","level":int 1-10 (difficulty of this exercise),"startBpm":int (a tempo THIS student can already play cleanly, given their level in this exercise's domain),"goalBpm":int,"minutes":int (3-10),
       "libId":optional,"tab":optional {"step":0.25|0.333|0.5|1,"swing":bool,"notes":[[string,fret,"h|p|/|b|~|pm" optional],...]},
       "chords":optional [names],"backing":optional [chord names]}]}]}]}`;
  const raw = await Claude.json({
    system: 'You are a world-class guitar teacher and curriculum designer who uses deliberate practice, the 70–85% success "edge zone", spaced repetition and interleaving.',
    content, maxTokens: 12000
  });
  const tree = normalizeTree(raw, { generatedBy: 'claude', difficulty: course.difficulty });
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

export function generateTreeLocal(course) {
  const T = localTemplates(course.genre, course.difficulty);
  const hi = course.difficulty >= 6;
  const raw = {
    summary: `A step-by-step path through ${course.style.toLowerCase()}, from clean fundamentals to musical soloing over real changes.`,
    units: [
      { title: 'Foundations', summary: 'Clean hands and steady time.', skills: [
        { id: 'clean-hands', title: 'Clean, relaxed fretting', domain: 'fretting', summary: 'Economy of motion in the fretting hand.', exercises: [T.warm, T.changes] },
        { id: 'steady-time', title: 'Steady time', domain: 'rhythm', summary: 'Lock to the click at every subdivision.', exercises: [T.subdiv] }] },
      { title: 'Fretboard & Vocabulary', summary: 'Know where the notes are and the shapes that matter.', skills: [
        { id: 'penta-box1', title: 'Pentatonic box 1', domain: 'fretboard', summary: 'The core soloing shape.', prereqs: ['clean-hands'], exercises: [T.box1, T.notesClick] },
        { id: 'style-rhythm', title: `${course.style} rhythm`, domain: 'rhythm', summary: 'The groove at the heart of the style.', prereqs: ['steady-time'], exercises: [T.shuffle] }] },
      { title: 'Theory in the Hands', summary: 'Harmony you can play.', skills: [
        { id: 'key-chords', title: 'Chords of the key', domain: 'theory', summary: 'Build and name the diatonic chords.', prereqs: ['penta-box1'], exercises: [T.triads] },
        { id: 'ear-echo', title: 'Hear it, play it', domain: 'ear', summary: 'Copy phrases by ear in time.', prereqs: ['penta-box1'], exercises: [T.earEcho] }] },
      { title: 'Speed & Control', summary: 'Picking precision and fluid lines.', skills: [
        { id: 'picking-control', title: 'Picking control', domain: 'picking', summary: 'Even alternate picking across strings.', prereqs: ['style-rhythm'], exercises: [T.crossing, T.penta16] },
        { id: 'box2', title: 'Connecting positions', domain: 'fretboard', summary: 'Box 2 and moving between boxes.', prereqs: ['penta-box1'], exercises: [T.box2] },
        ...(hi ? [{ id: 'advanced-technique', title: 'Legato & sweeps', domain: 'fretting', summary: 'Fluid lines with fewer pick strokes.', prereqs: ['picking-control'], exercises: [T.legato, T.sweep] }] : [])] },
      { title: 'Making Music', summary: 'Use everything in real musical settings.', skills: [
        { id: 'chord-tones', title: 'Playing the changes', domain: 'improv', summary: 'Target chord tones over the progression.', prereqs: ['key-chords'], exercises: [T.targets] },
        { id: 'style-solo', title: `Soloing in the style`, domain: 'improv', summary: 'Phrasing, space and vocabulary over a loop.', prereqs: ['box2'], exercises: [T.improvLoop] }] }
    ]
  };
  return normalizeTree(raw, { generatedBy: 'local', difficulty: course.difficulty });
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
  return { id: ex.id, name: ex.name, unit: ex.unit, why: ex.why, goalBpm: ex.goalBpm, bpm: bpm || ex.startBpm, notes: ex.tab.notes, swing: ex.tab.swing };
}
