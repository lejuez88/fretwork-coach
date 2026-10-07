// Songs: add and enrich songs, recommendations, one-day song lessons, help
// with a highlighted section of an imported tab, section progress and the
// repertoire skill level. Claude never writes out a song's notes or lyrics:
// it describes the song, plans the lesson and writes original drills. Notes for
// section practice come only from the tab the student imports.
import { Claude } from './claude.js';
import { uid, today } from './util.js';
import { SONGS, songMatch, songWikiTitles } from '../data/songs.js';
import { GENRES, GENRE_BY_ID } from '../data/catalog.js';
import { DOMAINS, Leveling } from '../assessment/engine.js';
import { parseTab, sliceBars, barsToText, sectionFacts, tuningName, STANDARD_TUNING } from './tabparse.js';
import { normalizeExercise, GENRE_BACKING } from './coursegen.js';
import { drillLibrary } from './drills.js';
import { calibratedTarget, newExerciseState, applyResult } from './progression.js';

export const STATUSES = [['want', 'Want to learn'], ['learning', 'Learning'], ['solid', 'Solid'], ['mastered', 'Mastered']];
const GENRE_IDS = GENRES.map(g => g.id);
const DOMAIN_KEYS = DOMAINS.map(d => d.key);
const norm = s => String(s || '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '');
const clampInt = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(a, Math.min(b, Math.round(v))) : d; };
const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);
const diffWord = d => (d <= 3 ? 'easy' : d <= 6 ? 'medium' : 'hard');

/* ------------------------------ Basics ------------------------------- */
export function findSong(p, id) { return (p.songs || []).find(s => s.id === id) || null; }
export function songTempo(song) { return clampInt(song.tempo || (song.info && song.info.tempo), 30, 260, 100); }
export function songImageTitles(song) { return songWikiTitles(song); }
/** The player's level for learning songs: the average of the hands-and-time domains. */
export function songLevelFor(p) {
  const d = p.domains || {}, ks = ['fretting', 'picking', 'rhythm'].filter(k => d[k]);
  return ks.length ? Math.round(ks.reduce((a, k) => a + d[k].level, 0) / ks.length) : 3;
}
export function fitLabel(p, diff) {
  if (!diff) return '';
  const L = songLevelFor(p), g = diff - L;
  return g <= 0 ? 'Comfortable' : g <= 2 ? 'Stretch' : g <= 3 ? 'Reach' : 'Long-term goal';
}

export function addSong(p, { title, artist = '', genre = null, difficulty = null, techniques = [], why = '', source = 'manual', status = 'want', wikiTitle = null } = {}) {
  title = str(title, 120).trim(); artist = str(artist, 80).trim();
  if (!title) return null;
  const dup = p.songs.find(s => norm(s.title) === norm(title) && (!artist || !s.artist || norm(s.artist) === norm(artist)));
  if (dup) return dup;
  const cat = songMatch(title, artist);
  const song = {
    id: uid(), title: cat ? cat.title : title, artist: artist || (cat ? cat.artist : ''),
    genre: GENRE_IDS.includes(genre) ? genre : cat ? cat.genres[0] : (p.questionnaire.genres[0] || 'rock'),
    difficulty: clampInt(difficulty != null ? difficulty : cat ? cat.difficulty : null, 1, 10, null),
    status, addedAt: today(), source: cat && source === 'manual' ? 'catalog' : source,
    wikiTitle: wikiTitle || (cat ? cat.wikiTitle : null),
    info: { techniques: (techniques && techniques.length ? techniques : cat ? cat.techniques : []).slice(0, 8), why: str(why, 240), sections: [], prerequisites: [], summary: '', enrichedBy: cat ? 'catalog' : null },
    tempo: null, tab: null, sections: [], state: { sections: {} }, lessons: [], lastPracticed: null
  };
  p.songs.push(song);
  syncRepertoire(p);
  return song;
}

export function removeSong(p, id) {
  p.songs = p.songs.filter(s => s.id !== id);
  p.repertoire = (p.repertoire || []).filter(r => r.songId !== id);
  return syncRepertoire(p);
}

/** Change a song's status and update the repertoire level. Returns a level change or null. */
export function setStatus(p, song, status) {
  if (!STATUSES.some(([k]) => k === status)) return null;
  song.status = status;
  if (status === 'solid' || status === 'mastered') song[status + 'At'] = song[status + 'At'] || today();
  return syncRepertoire(p);
}

/** Mirror songs into the repertoire list and recompute the repertoire level. */
export function syncRepertoire(p) {
  const fromSongs = p.songs.filter(s => s.status !== 'want').map(s => ({ title: s.title, artist: s.artist, status: s.status, difficulty: diffWord(s.difficulty || songLevelFor(p)), songId: s.id }));
  const others = (p.repertoire || []).filter(r => r && r.title && !r.songId && !p.songs.some(s => norm(s.title) === norm(r.title)));
  p.repertoire = [...others, ...fromSongs];
  if (!p.domains || !Object.keys(p.domains).length) return null;
  const before = p.domains.repertoire ? p.domains.repertoire.level : null;
  const r = Leveling.repertoire(p.repertoire, null);
  p.domains.repertoire = Object.assign(p.domains.repertoire || {}, { level: r.level, edge: r.edge, basis: 'song list' });
  if (before != null && before !== r.level) {
    const c = { domain: 'repertoire', name: 'Repertoire', from: before, to: r.level };
    (p.levelHistory = p.levelHistory || []).push({ date: today(), ...c });
    return c;
  }
  return null;
}

/* ------------------------------ Enrich ------------------------------- */
function studentBrief(p) {
  const q = p.questionnaire;
  return {
    levels: Object.fromEntries(Object.entries(p.domains || {}).map(([k, v]) => [k, v.level])),
    genres: q.genres.map(g => (GENRE_BY_ID[g] ? GENRE_BY_ID[g].name : g)), players: q.players.map(x => x.name),
    goals: q.goals, experience: q.experience
  };
}

/** Fill in key, tuning, tempo, techniques and sections (Claude), or catalog data. */
export async function enrichSong(p, song) {
  if (!Claude.hasKey()) return { ok: false, source: 'local' };
  const raw = await Claude.json({
    system: 'You are a guitar teacher with encyclopedic knowledge of recorded music. Be accurate; say when you are unsure.',
    content: `Identify this song for a guitar student and describe what it takes to play the main guitar part.
Song: "${song.title}"${song.artist ? ` by ${song.artist}` : ''}.
Student: ${JSON.stringify(studentBrief(p))}
Rules: never include lyrics, tablature or note-by-note transcriptions. Describe sections only in technique terms. If you don't recognise the song, set "found" to false and estimate from the artist's style.
Return JSON: {"found": bool, "title": canonical title, "artist": string, "year": int|null, "genre": one of ${JSON.stringify(GENRE_IDS)}, "difficulty": int 1-10 (main guitar part), "key": string|null, "tuning": "Standard"|"Drop D"|"E♭ standard"|..., "tuningMidi": [6 MIDI numbers, high string first], "capo": int|null, "tempo": int (approximate BPM of the recording), "timeSig": "4/4", "techniques": [3-6 short phrases], "picking": "alternate|strict|economy|down|fingers|hybrid" (how the main guitar part is picked), "prerequisites": [2-4 skills to have first], "sections": [{"name": "Intro", "desc": "what the guitar does, in technique terms"}], "summary": "1-2 sentences", "why": "one sentence on how this song stretches this student", "wikiTitle": "English Wikipedia article title for the song, or null"}`,
    maxTokens: 1400
  });
  if (!raw || typeof raw !== 'object') return { ok: false, source: 'claude' };
  const I = song.info;
  if (raw.found !== false) {
    if (raw.title) song.title = str(raw.title, 120);
    if (raw.artist) song.artist = str(raw.artist, 80);
    if (raw.wikiTitle) song.wikiTitle = str(raw.wikiTitle, 120);
  }
  if (GENRE_IDS.includes(raw.genre)) song.genre = raw.genre;
  song.difficulty = clampInt(raw.difficulty, 1, 10, song.difficulty);
  Object.assign(I, {
    year: clampInt(raw.year, 1900, 2100, null), key: raw.key ? str(raw.key, 30) : null, tuning: raw.tuning ? str(raw.tuning, 40) : null,
    tuningMidi: Array.isArray(raw.tuningMidi) && raw.tuningMidi.length === 6 && raw.tuningMidi.every(m => Number.isInteger(m) && m > 25 && m < 80) ? raw.tuningMidi : null,
    capo: clampInt(raw.capo, 0, 12, null), tempo: clampInt(raw.tempo, 30, 260, null), timeSig: raw.timeSig ? str(raw.timeSig, 8) : null,
    techniques: (raw.techniques || []).slice(0, 6).map(t => str(t, 60)), prerequisites: (raw.prerequisites || []).slice(0, 4).map(t => str(t, 80)),
    sections: (raw.sections || []).slice(0, 10).map(s => ({ name: str(s.name, 40), desc: str(s.desc, 200) })).filter(s => s.name),
    summary: str(raw.summary, 300), why: str(raw.why, 240) || I.why, enrichedBy: raw.found === false ? 'claude-unsure' : 'claude'
  });
  if (['alternate', 'strict', 'economy', 'down', 'fingers', 'hybrid'].includes(raw.picking)) song.picking = raw.picking;
  syncRepertoire(p);
  return { ok: true, found: raw.found !== false, source: 'claude' };
}

/* --------------------------- Recommendations -------------------------- */
export function localRecommendations(p, { genre = null, count = 6 } = {}) {
  const L = songLevelFor(p), mine = new Set(p.songs.map(s => norm(s.title)));
  const genres = genre ? [genre] : p.questionnaire.genres;
  const players = p.questionnaire.players.map(x => norm(x.name));
  const scored = SONGS.filter(s => !mine.has(norm(s.title)) && (!genre || s.genres.includes(genre))).map(s => {
    const gap = s.difficulty - L;
    let score = gap >= 0 && gap <= 2 ? 3 - Math.abs(gap - 1) * 0.5 : gap < 0 ? 2 + gap * 0.7 : 2 - (gap - 2) * 0.9;
    if (genres.some(g => s.genres.includes(g))) score += 2;
    if (players.some(n => n && (norm(s.artist).includes(n) || n.includes(norm(s.artist))))) score += 1.5;
    return { s, score };
  }).sort((a, b) => b.score - a.score);
  // One comfortable song, mostly stretch songs, one reach
  const pick = [], used = new Set();
  const take = pred => { const x = scored.find(o => !used.has(o.s.id) && pred(o.s.difficulty - L)); if (x) { used.add(x.s.id); pick.push(x.s); } };
  take(g => g <= 0); take(g => g >= 1 && g <= 2); take(g => g >= 1 && g <= 2); take(g => g === 3);
  for (const o of scored) { if (pick.length >= count) break; if (!used.has(o.s.id)) { used.add(o.s.id); pick.push(o.s); } }
  return pick.slice(0, count).map(s => ({
    title: s.title, artist: s.artist, genre: s.genres.find(g => genres.includes(g)) || s.genres[0], difficulty: s.difficulty,
    techniques: s.techniques, wikiTitle: s.wikiTitle, fit: fitLabel(p, s.difficulty),
    why: `${fitLabel(p, s.difficulty)} for you: teaches ${s.techniques.slice(0, 2).join(' and ')}.`
  }));
}

export async function recommendSongs(p, { genre = null, count = 6 } = {}) {
  if (!Claude.hasKey()) return { items: localRecommendations(p, { genre, count }), source: 'local' };
  try {
    const have = p.songs.map(s => `${s.title} – ${s.artist}`).concat((p.repertoire || []).filter(r => !r.songId).map(r => r.title));
    const raw = await Claude.json({
      system: 'You are a guitar teacher who picks songs that sit at the edge of a student\'s ability and match their taste.',
      content: `Recommend ${count} real, well-known recorded songs for this guitar student to learn.
Student: ${JSON.stringify(studentBrief(p))}. Song-playing level (hands and timing): ${songLevelFor(p)}/10.
${genre ? `Genre: ${GENRE_BY_ID[genre] ? GENRE_BY_ID[genre].name : genre} only.` : 'Spread across their genres.'}
Already on their list (exclude): ${JSON.stringify(have.slice(0, 40))}
Mix: 1 comfortable (at their level), 3-4 stretch (+1 to +2 levels), 1 reach (+3). Favor songs by or associated with their favorite players. Only songs with a clear guitar part.
Return JSON: {"songs":[{"title","artist","genre": one of ${JSON.stringify(GENRE_IDS)},"difficulty": int 1-10,"techniques":[2-4 short phrases],"why":"one sentence: what it teaches this student and why now","wikiTitle":"English Wikipedia title of the song or null"}]}`,
      maxTokens: 1600
    });
    const mine = new Set(p.songs.map(s => norm(s.title)));
    const items = (raw.songs || []).filter(s => s && s.title && !mine.has(norm(s.title))).slice(0, count).map(s => ({
      title: str(s.title, 120), artist: str(s.artist, 80), genre: GENRE_IDS.includes(s.genre) ? s.genre : (genre || p.questionnaire.genres[0] || 'rock'),
      difficulty: clampInt(s.difficulty, 1, 10, null), techniques: (s.techniques || []).slice(0, 4).map(t => str(t, 50)),
      why: str(s.why, 220), wikiTitle: s.wikiTitle ? str(s.wikiTitle, 120) : null, fit: fitLabel(p, clampInt(s.difficulty, 1, 10, null))
    }));
    if (!items.length) throw new Error('No songs returned.');
    return { items, source: 'claude' };
  } catch (e) {
    return { items: localRecommendations(p, { genre, count }), source: 'local', error: e.message };
  }
}

/* ------------------------------- Tabs -------------------------------- */
const parsedCache = new Map();
export function tabParsed(song) {
  if (!song || !song.tab || !song.tab.text) return null;
  const k = song.id + ':' + song.tab.importedAt;
  if (!parsedCache.has(k)) parsedCache.set(k, parseTab(song.tab.text, { beatsPerBar: song.tab.beatsPerBar || 4, grid: song.tab.grid || 'auto' }));
  return parsedCache.get(k);
}
export function importTab(song, text, { beatsPerBar = 4, grid = 'auto', source = 'paste' } = {}) {
  const parsed = parseTab(text, { beatsPerBar, grid });
  if (!parsed.bars.length) return { ok: false, warnings: parsed.warnings };
  song.tab = { text: String(text).slice(0, 80000), importedAt: Date.now(), bars: parsed.bars.length, notes: parsed.notes.length, tuning: parsed.tuning, tuningName: tuningName(parsed.tuning), beatsPerBar, grid, source };
  song.sections = (song.sections || []).filter(s => s.to <= parsed.bars.length);
  return { ok: true, parsed, warnings: parsed.warnings };
}
export function removeTab(song) { song.tab = null; song.sections = []; }
export const sectionKey = (from, to) => `${from}-${to}`;

/** Main technical demand of a passage → the domain its practice counts toward. */
function domainOfFacts(f) {
  if (f.chords >= Math.max(2, f.notes / 6)) return 'rhythm';
  if (f.legato + f.bends + f.slides + f.shifts > f.notes / 5) return 'fretting';
  if (f.fastest === '16ths' || f.crossings > f.notes * 0.45) return 'picking';
  return 'fretting';
}
function factsTip(f) {
  if (f.shifts) return 'Look ahead to each position shift and move the hand early, on the note before.';
  if (f.bends) return 'Bends that fall short of the target pitch; check against the fretted target note.';
  if (f.legato) return 'Hammer-ons and pull-offs that are quieter than the picked notes.';
  if (f.chords) return 'Late chord changes: lift and place all fingers together, landing on the beat.';
  if (f.crossings) return 'Hitting neighbouring strings on string changes; keep the pick motion small.';
  return 'Rushing the easy notes and dragging the hard ones; stay with the click.';
}

export function sectionExercise(p, song, from, to, { name = null } = {}) {
  const parsed = tabParsed(song); if (!parsed || !parsed.bars.length) return null;
  const n = parsed.bars.length;
  from = Math.max(1, Math.min(n, from | 0)); to = Math.max(from, Math.min(n, to | 0));
  const notes = sliceBars(parsed, from, to); if (!notes.length) return null;
  const f = sectionFacts(parsed, from, to), bpb = parsed.beatsPerBar || 4, goal = songTempo(song);
  const sec = (song.sections || []).find(s => s.from === from && s.to === to);
  const label = name || (sec && sec.name) || (from === to ? `bar ${from}` : `bars ${from}–${to}`);
  return {
    id: `song-${song.id}-${from}-${to}`, name: `${song.title}: ${label}`, domain: domainOfFacts(f),
    level: clampInt(song.difficulty || songLevelFor(p), 1, 10, 4),
    why: 'Section practice from your tab: loop it clean, then let the tempo ladder carry it toward the song tempo.',
    instr: `Loop ${from === to ? 'this bar' : 'these bars'} with the tab. Every note clean before the tempo goes up; if a spot breaks down, slow down rather than stopping.`,
    watch: factsTip(f), simplify: from === to ? 'Loop just the first two beats, then the last two, then join them.' : 'Split the section in half: loop each half, then join them.',
    unit: f.fastest, goalBpm: goal, startBpm: Math.max(30, Math.round(goal * 0.5)), minutes: 6, libId: null,
    tab: { notes, swing: false, beats: (to - from + 1) * bpb, tuning: parsed.tuning }, chords: [], backing: [],
    songId: song.id, sectionKey: sectionKey(from, to), bars: [from, to], pickKey: 'song-' + song.id, ...(song.picking ? { picking: song.picking } : {})
  };
}

/** Progress state of a section (created and calibrated on first use). */
export function sectionState(p, song, ex) {
  song.state = song.state || { sections: {} };
  const k = ex.sectionKey || ex.id;
  const target = calibratedTarget(ex, ex.level || 4, p);
  let es = song.state.sections[k];
  if (!es) es = song.state.sections[k] = newExerciseState(target);
  else if (!es.history.length && !es.mastered) es.target = target;
  return es;
}

/** Record a practice result for a song item. Returns {decision, message, level}. */
export function recordSongResult(p, songId, ex, result) {
  const song = findSong(p, songId); if (!song) return null;
  const es = sectionState(p, song, ex);
  const out = applyResult(es, ex, result);
  song.lastPracticed = result.date || today();
  if (song.status === 'want') { song.status = 'learning'; syncRepertoire(p); out.message += ` “${song.title}” moved to Learning.`; }
  if (ex.fullSong && result.clean && result.tempo >= songTempo(song) && song.status === 'learning') out.message += ' Clean at full tempo: mark the song Solid when you can play it start to finish.';
  return Object.assign(out, { target: es.target, level: ex.level || song.difficulty || 4, ex });
}

/** Auto sections when the student hasn't saved any: 4-bar chunks (2 if dense). */
export function autoChunks(parsed) {
  const n = parsed.bars.length, dense = parsed.bars.reduce((a, b) => a + b.notes.length, 0) / Math.max(1, n) > 10;
  const size = dense ? 2 : 4, out = [];
  for (let a = 1; a <= n; a += size) out.push({ from: a, to: Math.min(n, a + size - 1) });
  return out;
}

/* ------------------------- Technique drills -------------------------- */
// Original drills that build the techniques a song needs.
function techniqueDrills(song, p) {
  const L = song.difficulty || songLevelFor(p);
  const D = drillLibrary(L, song.genre);
  const map = [
    [/bend/i, D.bends], [/vibrato|sustain/i, D.vibrato], [/gallop|palm|mute|chug|downpick/i, D.gallop], [/drop d/i, D.dropd], [/power.?chord|riff/i, D.power],
    [/string.?skip|crossing|jangle/i, D.crossing], [/travis|fingerpick|fingerstyle|thumb|p–i/i, D.travis], [/arpegg/i, D.crossing], [/hybrid|chicken/i, D.hybrid], [/tap/i, D.tapping], [/double.?stop|embellish/i, D.doublestops],
    [/legato|hammer|pull/i, D.legato], [/slide/i, D.slides], [/16th|funk|scratch|chop/i, D.funk16], [/shuffle|boogie|12-bar|blues/i, D.shuffle],
    [/fast|picking|tremolo|speed|run|shred|picado/i, D.burst], [/sweep/i, D.sweep],
    [/pentatonic|solo|lead|phras|lick/i, D.penta], [/strum|rasgueado/i, D.strum], [/chord|capo|sus|open|change|seventh|voicing/i, D.changes], [/odd|meter|5\/4|7\/4|time/i, D.subdiv]
  ];
  const techs = (song.info.techniques || []).concat(song.info.tuning && /drop d/i.test(song.info.tuning) ? ['drop d'] : []);
  const out = [], used = new Set();
  for (const t of techs) for (const [re, ex] of map) if (re.test(t) && ex) { if (!used.has(ex.id)) { used.add(ex.id); out.push(ex); } break; }
  if (!out.length) out.push(D.warm);
  return out.map(e => normalizeExercise(e, new Set())).filter(Boolean);
}

/* --------------------------- Song lessons ---------------------------- */
const LESSON_SHARE = { warmup: 0.1, review: 0.12, stretch: 0.45, theory: 0.1, music: 0.23 };
function spread(items, budget) {
  const total = budget == null ? 40 : budget;
  const byBlock = {}; items.forEach(i => (byBlock[i.block] = byBlock[i.block] || []).push(i));
  const shareSum = Object.keys(byBlock).reduce((a, b) => a + (LESSON_SHARE[b] || 0.1), 0);
  for (const [b, list] of Object.entries(byBlock)) list.forEach(i => { if (!i.minutes) i.minutes = Math.max(2, Math.round(total * (LESSON_SHARE[b] || 0.1) / shareSum / list.length * 2) / 2); });
  // Make the plan add up to the budget: the stretch block absorbs the rounding
  const diff = total - items.reduce((a, i) => a + i.minutes, 0), st = items.find(i => i.block === 'stretch') || items[0];
  if (st && Math.abs(diff) >= 0.5) st.minutes = Math.max(2, st.minutes + Math.round(diff * 2) / 2);
  return items;
}

/** Parts of a tabbed song in order: the student's named parts, with 4-bar chunks filling the gaps. */
export function songChunks(song, parsed) {
  const saved = (song.sections || []).map(s => ({ from: s.from, to: s.to, name: s.name })).sort((a, b) => a.from - b.from);
  const auto = autoChunks(parsed).filter(c => !saved.some(s => c.from <= s.to && c.to >= s.from));
  // Chunks that only partly overlap a saved part are trimmed to the free bars
  const free = [];
  for (const c of autoChunks(parsed)) {
    if (auto.includes(c)) continue;
    let a = c.from;
    for (let k = c.from; k <= c.to + 1; k++) {
      const taken = k <= c.to && saved.some(s => k >= s.from && k <= s.to);
      if ((taken || k > c.to) && k > a) { free.push({ from: a, to: k - 1 }); }
      if (taken || k > c.to) a = k + 1;
    }
  }
  return [...saved, ...auto, ...free].sort((a, b) => a.from - b.from);
}

function playAlong(p, song, goal) {
  const along = normalizeExercise({ id: `song-${song.id}-along`, name: `Play along: ${song.title}`, domain: 'rhythm', level: song.difficulty || songLevelFor(p), unit: 'whole song', startBpm: goal, goalBpm: goal, minutes: 8, metroMode: 'gap',
    why: 'Playing along with the record trains keeping going through mistakes, like a real performance.', instr: 'Play along with the recording (or with the click at the song tempo). Play the parts you know, keep the rhythm going through the rest, and don’t stop for mistakes; note where it broke down.',
    watch: 'Stopping to fix mistakes.', simplify: 'Play only the parts you’ve learned and mute through the rest in rhythm.' }, new Set());
  return Object.assign(along, { songId: song.id, sectionKey: 'along', fullSong: true });
}

/** Local one-day lesson for a song. Returns {title, focus, items:[{block, ex, minutes, targetBpm, note}], source}. */
export function localSongLesson(p, song, budget) {
  song.state = song.state || { sections: {} }; song.state.sections = song.state.sections || {}; song.info = song.info || { techniques: [], sections: [] };
  const parsed = tabParsed(song), goal = songTempo(song), items = [];
  const drills = techniqueDrills(song, p);
  // Warm-up: the first technique drill at an easy tempo
  const warm = drills[0];
  items.push({ block: 'warmup', ex: warm, targetBpm: Math.round(calibratedTarget(warm, warm.level || 3, p) * 0.9), note: 'Easy tempo; warm up the move this song needs most.' });
  let focus;
  if (parsed && parsed.bars.length) {
    const chunks = songChunks(song, parsed);
    const st = song.state.sections || {};
    const open = chunks.filter(c => !(st[sectionKey(c.from, c.to)] || {}).mastered);
    const todo = (open.length ? open : chunks).slice(0, budget != null && budget < 25 ? 1 : 2);
    focus = `Learn ${todo.map(c => c.name || `bars ${c.from}–${c.to}`).join(' and ')} of “${song.title}” up toward ${goal} BPM.`;
    // Review a section practiced before
    const prev = chunks.find(c => !todo.includes(c) && (st[sectionKey(c.from, c.to)] || { history: [] }).history.length);
    if (prev) { const ex = sectionExercise(p, song, prev.from, prev.to, { name: prev.name }); items.push({ block: 'review', ex, targetBpm: sectionState(p, song, ex).target, note: 'Review: one clean pass at target, then +3 BPM.' }); }
    if (drills[1]) items.push({ block: 'review', ex: drills[1], targetBpm: calibratedTarget(drills[1], drills[1].level || 4, p), note: 'Technique this song needs.' });
    for (const c of todo) { const ex = sectionExercise(p, song, c.from, c.to, { name: c.name }); if (ex) items.push({ block: 'stretch', ex, targetBpm: sectionState(p, song, ex).target }); }
    // Link everything learned so far (from the start of the song through today's last part)
    const last = todo[todo.length - 1], first = chunks[0];
    const linkSpan = last ? last.to - first.from + 1 : 0, todoSpan = todo.reduce((a, c) => a + c.to - c.from + 1, 0);
    if (last && linkSpan > todoSpan) {
      const link = sectionExercise(p, song, first.from, last.to, { name: last.to >= parsed.bars.length ? 'full run-through' : `bars ${first.from}–${last.to} linked` });
      if (link) { link.fullSong = last.to >= parsed.bars.length; link.instr = 'Play everything you have learned so far without stopping. Mark the spot that breaks down and loop it after.'; items.push({ block: 'music', ex: link, targetBpm: Math.round(sectionState(p, song, link).target * 0.95), ramp: false }); }
    } else items.push({ block: 'music', ex: playAlong(p, song, goal), targetBpm: goal, ramp: false });
  } else {
    const secs = (song.info.sections && song.info.sections.length ? song.info.sections : [{ name: 'Main riff', desc: '' }, { name: 'Verse', desc: '' }, { name: 'Chorus', desc: '' }]);
    const learned = new Set(Object.keys(song.state.sections || {}).filter(k => (song.state.sections[k] || {}).mastered));
    const todo = secs.filter(s => !learned.has('part-' + norm(s.name))).slice(0, budget != null && budget < 25 ? 1 : 2);
    focus = `Learn the ${todo.map(s => s.name.toLowerCase()).join(' and ')} of “${song.title}”${song.tempo || song.info.tempo ? ` toward ${goal} BPM` : ''}.`;
    if (drills[1]) items.push({ block: 'review', ex: drills[1], targetBpm: calibratedTarget(drills[1], drills[1].level || 4, p), note: 'Technique this song needs.' });
    for (const s of todo) {
      const ex = normalizeExercise({ id: `song-${song.id}-part-${norm(s.name)}`, name: `${song.title}: ${s.name}`, domain: 'fretting', level: song.difficulty || songLevelFor(p), unit: 'with the click', startBpm: Math.round(goal * 0.5), goalBpm: goal, minutes: 8,
        why: s.desc || 'Learning the song a part at a time, with the click, builds it solidly.',
        instr: `Use your tab or the recording. Loop 2 bars of the ${s.name.toLowerCase()} at the target tempo with the click; add the next 2 bars once it’s clean. Import the tab on the song page to get a scrolling tab with the notes.`,
        watch: 'Practicing mistakes in: slow down as soon as a bar breaks.', simplify: 'One bar at a time, half tempo.' }, new Set());
      Object.assign(ex, { songId: song.id, sectionKey: 'part-' + norm(s.name) });
      items.push({ block: 'stretch', ex, targetBpm: sectionState(p, song, ex).target });
    }
    items.push({ block: 'music', ex: playAlong(p, song, goal), targetBpm: goal, ramp: false });
  }
  // Theory in context when there's time
  if ((budget == null || budget >= 25) && (song.info.key || song.genre)) {
    const key = song.info.key || '';
    const ex = normalizeExercise({ id: `song-${song.id}-theory`, name: key ? `Map the key: ${key}` : 'Find the song’s key', domain: 'theory', level: Math.max(2, songLevelFor(p) - 1), unit: 'one note per beat', startBpm: 60, goalBpm: 90, minutes: 4,
      why: 'Knowing the key tells you which scale shapes and chords the song is built from, so it’s faster to learn and remember.',
      instr: key ? `Play the ${key} scale (or its pentatonic) in the position the song uses, one note per click, saying the scale degree of each note. Then name the degree of the song’s first chord.` : 'Find the root note the song keeps resolving to; play that note’s scale one note per click and name the degrees.',
      watch: 'Guessing degrees instead of counting from the root.', simplify: 'Root, 3rd and 5th only.', backing: GENRE_BACKING[song.genre] && !key ? GENRE_BACKING[song.genre] : [] }, new Set());
    items.push({ block: 'theory', ex, targetBpm: calibratedTarget(ex, ex.level, p) });
  }
  const order = ['warmup', 'review', 'stretch', 'theory', 'music'];
  items.sort((a, b) => order.indexOf(a.block) - order.indexOf(b.block));
  spread(items, budget);
  return { title: song.title, focus, items, source: 'local' };
}

/** Claude-planned lesson, falling back to the local plan. */
export async function buildSongLesson(p, song, budget) {
  const local = localSongLesson(p, song, budget);
  if (!Claude.hasKey()) return local;
  const parsed = tabParsed(song);
  const chunkFacts = parsed ? songChunks(song, parsed).slice(0, 24).map(c => {
    const st = (song.state.sections || {})[sectionKey(c.from, c.to)];
    return { bars: [c.from, c.to], name: c.name || null, facts: sectionFacts(parsed, c.from, c.to), progress: st ? { target: st.target, best: st.best, mastered: st.mastered } : null };
  }) : null;
  try {
    const raw = await Claude.json({
      system: 'You are a world-class guitar teacher. You plan one focused practice session at the edge of the student\'s ability (70–85% success).',
      content: `Plan today's ${budget == null ? 'open-ended (~40 min)' : budget + '-minute'} lesson on one song.
SONG: ${JSON.stringify({ title: song.title, artist: song.artist, difficulty: song.difficulty, key: song.info.key, tuning: song.info.tuning, capo: song.info.capo, tempo: songTempo(song), techniques: song.info.techniques, sections: song.info.sections, status: song.status })}
STUDENT: ${JSON.stringify(studentBrief(p))}
${chunkFacts ? `The student imported a tab with ${parsed.bars.length} bars. Chunks (with what's in them and their progress): ${JSON.stringify(chunkFacts)}` : 'No tab imported: the student will use their own tab or the recording.'}
Rules:
- Structure: warm-up (~10%), review (~15%), stretch: the next part of the song (~45%), theory in context (~10%), musical application: linking parts or playing along (~20%). Minutes must add up to the budget.
- NEVER write out the song's notes, riffs or lyrics. Song parts are referenced by bar numbers of the imported tab ("bars": [from, to]) or by section name.
- Drills that isolate a technique are ORIGINAL; give them a "tab" only for single-note lines (string 1 = high e).
- Every item has a startBpm the student can play cleanly today and a goalBpm (the song tempo for song parts).
Return JSON: {"focus": "one sentence: today's goal for this song", "items":[{"block":"warmup|review|stretch|theory|music","kind":"drill|section|playalong","name":string,"minutes":number,"why":string,"instr":string,"watch":string,"simplify":string,"unit":string,"level":int 1-10,"domain": one of ${JSON.stringify(DOMAIN_KEYS)},"startBpm":int,"goalBpm":int,"picking":"alternate|strict|economy|down|fingers|hybrid","bars":[from,to] (section items when a tab exists),"tab": optional {"step":0.25|0.333|0.5|1,"notes":[[string,fret,"h|p|/|b|~|pm" optional],...]}}]}`,
      maxTokens: 3500
    });
    const items = [];
    for (const it of (raw.items || []).slice(0, 9)) {
      const block = ['warmup', 'review', 'stretch', 'theory', 'music'].includes(it.block) ? it.block : 'stretch';
      const minutes = Math.max(2, Math.min(30, Math.round((Number(it.minutes) || 5) * 2) / 2));
      if (it.kind === 'section' && parsed && Array.isArray(it.bars)) {
        const ex = sectionExercise(p, song, +it.bars[0], +it.bars[1] || +it.bars[0], { name: it.name && !it.name.includes(song.title) ? it.name : null });
        if (!ex) continue;
        if (it.instr) ex.instr = str(it.instr, 600); if (it.watch) ex.watch = str(it.watch, 200); if (it.why) ex.why = str(it.why, 240);
        if (block === 'music') { ex.fullSong = +it.bars[1] >= parsed.bars.length && +it.bars[0] <= 1; }
        items.push({ block, ex, minutes, targetBpm: sectionState(p, song, ex).target, ramp: block !== 'music' });
      } else if (it.kind === 'section' || it.kind === 'playalong') {
        const ex = normalizeExercise({ ...it, goalBpm: it.goalBpm || songTempo(song), id: `song-${song.id}-${it.kind === 'playalong' ? 'along' : 'part-' + norm(it.name)}` }, new Set());
        if (!ex) continue;
        Object.assign(ex, { songId: song.id, sectionKey: it.kind === 'playalong' ? 'along' : 'part-' + norm(it.name), fullSong: it.kind === 'playalong', name: ex.name.includes(song.title) ? ex.name : `${song.title}: ${ex.name}` });
        items.push({ block, ex, minutes, targetBpm: sectionState(p, song, ex).target, ramp: block !== 'music' });
      } else {
        const ex = normalizeExercise(it, new Set()); if (!ex) continue;
        items.push({ block, ex, minutes, targetBpm: Math.min(ex.goalBpm, Math.max(30, Number(it.startBpm) || calibratedTarget(ex, ex.level || 4, p))) });
      }
    }
    if (!items.some(i => i.ex.songId)) throw new Error('The plan had no song parts.');
    return { title: song.title, focus: str(raw.focus, 240) || local.focus, items, source: 'claude' };
  } catch (e) {
    return Object.assign(local, { error: e.message });
  }
}

/* ------------------------ Help with a section ------------------------ */
/** The densest beat in a range: most notes, string changes, shifts and techniques. */
export function hardestSpot(parsed, from, to) {
  const notes = sliceBars(parsed, from, to), bpb = parsed.beatsPerBar || 4, beats = (to - from + 1) * bpb;
  let best = null;
  for (let b = 0; b < beats; b++) {
    const w = notes.filter(n => n.t >= b && n.t < b + 1);
    if (!w.length) continue;
    let score = w.length;
    for (let i = 1; i < w.length; i++) { if (w[i].s !== w[i - 1].s) score += 1.5; if (Math.abs(w[i].f - w[i - 1].f) >= 4) score += 2; }
    score += w.filter(n => n.x && n.x !== 'ghost').length;
    if (!best || score > best.score) best = { beat: b, score, notes: w };
  }
  if (!best) return null;
  const landing = notes.filter(n => n.t >= best.beat + 1).sort((a, b) => a.t - b.t)[0];
  const bar = from + Math.floor(best.beat / bpb), beatInBar = (best.beat % bpb) + 1;
  return { ...best, landing, bar, beatInBar };
}

/** A two-beat micro-loop of the hardest spot (repeated to fill a bar). */
function microLoop(p, song, parsed, from, to, spot) {
  if (!spot) return null;
  const base = spot.notes.map(n => ({ ...n, t: n.t - spot.beat, d: Math.min(n.d, 1) }));
  if (spot.landing) base.push({ ...spot.landing, t: 1, d: 1 });
  const notes = [...base, ...base.map(n => ({ ...n, t: n.t + 2 }))].filter(n => n.t < 4);
  const goal = songTempo(song);
  return {
    id: `song-${song.id}-spot-${spot.bar}-${spot.beatInBar}`, name: `Micro-loop: bar ${spot.bar}, beat ${spot.beatInBar}`, domain: domainOfFacts(sectionFacts(parsed, from, to)),
    level: clampInt(song.difficulty || songLevelFor(p), 1, 10, 4), unit: 'one beat + landing', goalBpm: Math.round(goal * 1.1), startBpm: Math.max(30, Math.round(goal * 0.5)), minutes: 4,
    why: 'The hardest beat of the passage, looped on its own with the note it lands on, so the move gets reps without the easy parts around it.',
    instr: 'Play the beat and land on the next note, rest, repeat. Exaggerate the slow, relaxed motion; speed comes after 10 clean reps.',
    watch: 'Tensing up before the hard move.', simplify: 'Play only the last two notes of the beat into the landing.',
    tab: { notes, swing: false, beats: 4, tuning: parsed.tuning }, chords: [], backing: [], songId: song.id, sectionKey: `spot-${spot.bar}-${spot.beatInBar}`, pickKey: 'song-' + song.id
  };
}

export function localSectionHelp(p, song, from, to, question = '') {
  const parsed = tabParsed(song); if (!parsed) return null;
  const f = sectionFacts(parsed, from, to), spot = hardestSpot(parsed, from, to);
  const hard = [];
  if (spot) hard.push({ where: `bar ${spot.bar}, beat ${spot.beatInBar}`, what: `The busiest beat: ${spot.notes.length} notes${spot.notes.some((n, i) => i && n.s !== spot.notes[i - 1].s) ? ' across strings' : ''}.`, fix: 'Loop just that beat and the note it lands on (micro-loop below), then put it back in context.' });
  if (f.shifts) hard.push({ where: `${f.shifts} position shift${f.shifts > 1 ? 's' : ''}`, what: 'Jumps of 4+ frets between notes.', fix: 'Shift on the note before, with a light thumb; glance at the target fret early.' });
  if (f.bends) hard.push({ where: `${f.bends} bend${f.bends > 1 ? 's' : ''}`, what: 'Bends need to land on a specific pitch.', fix: 'Fret the target note first and bend up to match it; use two or three fingers.' });
  if (f.legato) hard.push({ where: `${f.legato} hammer-on/pull-off${f.legato > 1 ? 's' : ''}`, what: 'Legato notes fade if they\'re not hammered firmly.', fix: 'Hammer from about 1 cm with the fingertip; pull off slightly downward, like a pluck.' });
  if (f.maxSpan >= 4) hard.push({ where: 'Wide chord shapes', what: `A stretch of ${f.maxSpan} frets in one shape.`, fix: 'Thumb lower behind the neck, wrist forward; practice the shape on its own, placing all fingers at once.' });
  if (f.chords && !f.maxSpan) hard.push({ where: `${f.chords} chord${f.chords > 1 ? 's' : ''}`, what: 'Chord changes have to land on the beat.', fix: 'Practice the change alone: last strum of one chord to the first of the next, 10 times.' });
  const tips = [
    f.fastest === '16ths' ? 'Count it out loud in 16ths ("1 e & a") at half speed before playing it.' : f.fastest === 'triplets' ? 'Count triplets ("1-trip-let") so the groups stay even.' : 'Tap your foot on the beat and feel where each note falls.',
    f.crossings ? 'Keep the pick close to the strings on string changes; most misses come from a big motion.' : 'Keep the fretting fingers close to the frets between notes.',
    'Stop the loop the moment it isn\'t clean and drop 5 BPM: clean reps teach your hands, sloppy ones teach mistakes.'
  ];
  const drills = [];
  const micro = microLoop(p, song, parsed, from, to, spot); if (micro) drills.push(micro);
  const slow = sectionExercise(p, song, from, to); if (slow) { slow.name = `${slow.name} (slow, with ladder)`; drills.push(slow); }
  const tech = techniqueDrills(song, p)[0]; if (tech) drills.push(tech);
  return {
    summary: `${to - from + 1} bar${to > from ? 's' : ''}, ${f.notes} notes, fastest rhythm ${f.fastest}${f.highestFret ? `, up to fret ${f.highestFret}` : ''}.${question ? ' (Add your Claude key for answers to specific questions.)' : ''}`,
    hardParts: hard, tips, fingering: f.maxSpan >= 4 || f.shifts ? 'Use one finger per fret within each position; plan the shift points before you play.' : 'One finger per fret; keep the first finger anchored where you can.',
    drills, source: 'local'
  };
}

export async function sectionHelp(p, song, from, to, question = '') {
  const local = localSectionHelp(p, song, from, to, question);
  if (!Claude.hasKey() || !local) return local;
  const parsed = tabParsed(song);
  try {
    const raw = await Claude.json({
      system: 'You are an expert guitar teacher looking at a passage a student is stuck on. Be specific: name bars, beats, fingers and pick directions.',
      content: `Song: "${song.title}" by ${song.artist || 'unknown'} (${tuningName(parsed.tuning)} tuning, song tempo ${songTempo(song)} BPM).
Student: ${JSON.stringify(studentBrief(p))}
The student highlighted bars ${from}–${to} of the tab they imported (bar numbers are theirs; rhythm was inferred from spacing):
${barsToText(parsed, from, to)}
Measured facts: ${JSON.stringify(sectionFacts(parsed, from, to))}
${question ? `Their question: "${String(question).slice(0, 400)}"` : 'They want help making this part clean and up to tempo.'}
Rules: discuss the passage by bar/beat; don't re-write the whole passage. Drills are ORIGINAL exercises that isolate the problem moves (a drill tab may reuse at most 6 notes of the passage). Every drill has startBpm (clean today) and goalBpm.
Return JSON: {"summary":"2 sentences: what makes this passage hard for this student","hardParts":[{"where":"bar 3, beat 2","what":string,"fix":string}],"fingering":"fretting-hand fingering plan","picking":"picking-hand plan (directions, pick or fingers)","tips":[2-4 short tips],"answer":"direct answer to their question, or empty","drills":[{"name","domain": one of ${JSON.stringify(DOMAIN_KEYS)},"why","instr","watch","simplify","unit","level":int,"startBpm":int,"goalBpm":int,"minutes":int,"picking":"alternate|strict|economy|down|fingers|hybrid","tab": optional {"step":0.25|0.333|0.5|1,"notes":[[string,fret,"h|p|/|b|~|pm" optional],...]}}]}`,
      maxTokens: 2500
    });
    const used = new Set();
    const drills = (raw.drills || []).slice(0, 3).map(d => normalizeExercise(d, used)).filter(Boolean);
    return {
      summary: str(raw.summary, 400) || local.summary, answer: str(raw.answer, 800),
      hardParts: (raw.hardParts || []).slice(0, 6).map(h => ({ where: str(h.where, 60), what: str(h.what, 240), fix: str(h.fix, 240) })),
      fingering: str(raw.fingering, 400), picking: str(raw.picking, 400), tips: (raw.tips || []).slice(0, 4).map(t => str(t, 200)),
      drills: [...drills, ...local.drills.slice(0, 2)].slice(0, 4), source: 'claude'
    };
  } catch (e) {
    return Object.assign(local, { error: e.message });
  }
}

/** Search links for finding a tab to paste (opened by the student). */
export function tabSearchLinks(song) {
  const q = encodeURIComponent(`${song.title} ${song.artist || ''}`.trim());
  return [
    { label: 'Songsterr', url: `https://www.songsterr.com/?pattern=${q}` },
    { label: 'Ultimate Guitar', url: `https://www.ultimate-guitar.com/search.php?search_type=title&value=${q}` }
  ];
}
export { STANDARD_TUNING };
