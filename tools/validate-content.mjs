// Content validator for Fretwork Coach: the knowledge base (js/data/kb/) and the Artist Series (js/data/artists/).
// Run from the repo root:  node tools/validate-content.mjs
// Exits with code 1 when anything is broken. Warnings don't fail the run. It ends with a coverage report:
// how deep every learning path is, which stages are missing or thin, so the content runs know what to build next.
// See CONTENT.md for the format these checks enforce.
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { TIERS, TIER_BY_ID } from '../js/data/lib.js';
import { indexIsCurrent, isFull, FULL_STAGE, STANDARD, meetsDepth, hasSources } from './build-index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'js', 'data');
const errors = [], warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
const DOMAINS = ['fretting', 'picking', 'rhythm', 'fretboard', 'theory', 'ear', 'improv'];
const KINDS = ['technique', 'subject', 'style'];
const TECHS = ['h', 'p', '/', '\\', 'b', 'pb', 'r', '~', 'pm', 't', 'mute', 'ghost', 'nh', 'ah'];

if (!(await indexIsCurrent())) err('js/data/index.js', 'out of date: run `node tools/build-index.mjs` and commit the result');

// app modules (loaded after the index check so a stale index is reported first)
const { normalizeExercise } = await import('../js/core/coursegen.js');
const { runAtom } = await import('../js/core/styles.js');
const { KB_INDEX, ARTIST_INDEX, matchArtist, matchTechniques } = await import('../js/data/kb.js');
const { artistLessonList, stageLessonList, createMasterClass, buildMasterTree } = await import('../js/core/master.js');
const { emptyProfile, normalize } = await import('../js/core/store.js');
const { METHOD_IDS } = await import('../js/core/methods.js');

function checkExercise(where, ex) {
  if (!ex) return err(where, 'generator returned nothing');
  const n = normalizeExercise(ex);
  if (!n) return err(where, 'exercise could not be normalized');
  for (const k of ['name', 'why', 'instr', 'watch', 'simplify', 'unit']) if (!ex[k] || String(ex[k]).trim().length < 3) err(where, `missing "${k}"`);
  if (!DOMAINS.includes(ex.domain)) err(where, `domain "${ex.domain}" is not one of ${DOMAINS.join(', ')}`);
  if (!(n.goalBpm > n.startBpm)) err(where, `goalBpm (${n.goalBpm}) must be above startBpm (${n.startBpm})`);
  if (ex.tab) {
    const notes = ex.tab.notes || [];
    if (notes.length < 3) err(where, 'tab has fewer than 3 notes');
    if (notes.length > 400) err(where, `tab has ${notes.length} notes (max 400)`);
    notes.forEach((x, i) => {
      if (!(Number.isInteger(x.s) && x.s >= 1 && x.s <= 6)) err(where, `note ${i}: string ${x.s} (1 = high e … 6 = low E)`);
      if (!(Number.isInteger(x.f) && x.f >= 0 && x.f <= 22)) err(where, `note ${i}: fret ${x.f} (0–22)`);
      if (!(x.t >= 0 && x.d > 0)) err(where, `note ${i}: bad timing t=${x.t} d=${x.d}`);
      if (x.x && !TECHS.includes(x.x)) err(where, `note ${i}: unknown technique "${x.x}"`);
      if (x.bar != null && !['dip', 'scoop', 'dive', 'vib', 'flutter'].includes(x.bar)) err(where, `note ${i}: unknown whammy-bar move "${x.bar}" (dip, scoop, dive, vib, flutter)`);
      if (x.barDepth != null && !(x.barDepth > 0 && x.barDepth <= 24)) err(where, `note ${i}: barDepth ${x.barDepth} (semitones, above 0 and up to 24)`);
      if (x.barDepth != null && x.bar == null) err(where, `note ${i}: barDepth without a bar move`);
      if (x.pick != null && !['d', 'u'].includes(x.pick)) err(where, `note ${i}: pick "${x.pick}" (d or u)`);
      if (x.fing != null && !['p', 'i', 'm', 'a', 'c'].includes(x.fing)) err(where, `note ${i}: fing "${x.fing}" (p, i, m, a or c)`);
    });
    if (n.tab == null) err(where, 'tab dropped by the normalizer (check the note format)');
  } else if (!(ex.chords && ex.chords.length) && !(ex.voicings && ex.voicings.length) && !ex.libId) warn(where, 'no tab, chords or voicings: it will only show the metronome');
  if (ex.chords && n.chords.length !== ex.chords.length) err(where, `chord names not recognized: ${ex.chords.filter(c => !n.chords.includes(c)).join(', ')}`);
  if (ex.voicings && (!n.voicings || n.voicings.length !== ex.voicings.length)) err(where, 'a voicing is invalid (6 frets, low E first, null = muted, 0–22)');
}
/** Run one lesson entry the way the app does. */
function runOne(c, e, lvl) {
  if (typeof e === 'function') return e(c);
  if (Array.isArray(e)) return runAtom({ ...c, ...(e[2] || {}) }, e[0], e[1] || {});
  if (e && e.spec) return { ...e.spec, level: lvl };
  return null;
}

/* ---------------------------- Knowledge base ---------------------------- */
const p = normalize(emptyProfile());
const kbFiles = readdirSync(join(dataDir, 'kb')).filter(f => f.endsWith('.js')).sort();
const kbIds = new Set(kbFiles.map(f => f.replace(/\.js$/, '')));
const coverage = [];
for (const f of kbFiles) {
  const w = `kb/${f}`;
  let e;
  try { e = (await import(pathToFileURL(join(dataDir, 'kb', f)).href)).default; } catch (x) { err(w, 'failed to load: ' + x.message); continue; }
  if (!e || !e.id) { err(w, 'no default export entry({...})'); continue; }
  if (`${e.id}.js` !== f) err(w, `the file name must be the entry id (${e.id}.js)`);
  if (!/^[a-z][a-zA-Z0-9]*$/.test(e.id)) err(w, 'id must be camelCase (letters and digits)');
  if (!KINDS.includes(e.kind || 'technique')) err(w, `kind "${e.kind}" is not one of ${KINDS.join(', ')}`);
  for (const k of ['title', 'summary']) if (!e[k]) err(w, `missing "${k}"`);
  if (!DOMAINS.includes(e.domain)) err(w, `domain "${e.domain}" is not one of ${DOMAINS.join(', ')}`);
  if (!(e.re instanceof RegExp)) err(w, '"re" must be a RegExp');
  else if (!e.re.test(e.title.toLowerCase())) warn(w, `its regex doesn't match its own title "${e.title}" (requests using that name won't find it)`);
  for (const pre of e.prereqs || []) if (!kbIds.has(pre)) err(w, `prereq "${pre}" is not a knowledge-base entry`);
  if (!e.stages || !e.stages.length) { err(w, 'no stages'); continue; }
  const seenTiers = new Set();
  for (const st of e.stages) {
    const sw = `${w} › ${st.tier}`, T = TIER_BY_ID[st.tier];
    if (!T) { err(sw, `unknown tier (use ${TIERS.map(t => t.id).join(', ')})`); continue; }
    if (seenTiers.has(st.tier)) err(sw, 'two stages with the same tier'); seenTiers.add(st.tier);
    if (!(st.levels[0] >= T.levels[0] && st.levels[1] <= T.levels[1] && st.levels[0] <= st.levels[1])) err(sw, `levels [${st.levels}] must sit inside ${T.name} (${T.levels.join('–')})`);
    if (!st.goal || /^Play every lesson of this stage clean/.test(st.goal)) warn(sw, 'give the stage a specific goal (what the player can do when it is done)');
    if (!st.skills.length) err(sw, 'no skills');
    const ctx = e.ctx || { key: 9, minor: true, prog: 'minorRock' };
    for (const lvl of new Set(st.levels)) for (const s of st.skills) {
      if (!s.ex || !s.ex.length) { err(`${sw} › ${s.id}`, 'skill has no lessons'); continue; }
      s.ex.forEach((x, i) => {
        const where = `${sw} › ${s.id} #${i + 1} (level ${lvl})`;
        try { checkExercise(where, runOne({ key: ctx.key, minor: !!ctx.minor, lvl, genre: 'rock', prog: ctx.prog }, x, lvl)); } catch (y) { err(where, 'generator threw: ' + y.message); }
      });
    }
  }
  const gaps = [];   // what keeps this path below the reference standard
  try {
    let untagged = 0, total = 0;
    for (const t of TIERS) { const st = e.stages.find(x => x.tier === t.id); if (!st) gaps.push(`no ${t.name} stage`); else if (!meetsDepth(st)) gaps.push(`${t.name} ${st.skills.length}/${st.skills.reduce((a, x) => a + x.ex.length, 0)} (needs ${STANDARD[t.id].skills}/${STANDARD[t.id].lessons})`); }
    if (!hasSources(e)) gaps.push('fewer than 3 research URLs in "sources"');
    for (const st of e.stages) {
      const list = await stageLessonList(p, e.id, { tier: st.tier, lvl: st.levels[0] });
      if (!list.length) err(`${w} › ${st.tier}`, 'the app builds no lessons for this stage');
      total += list.length; untagged += list.filter(l => !l.ex.method).length;
      const ms = new Set(list.map(l => l.ex.method).filter(Boolean)), need = st.tier === 'mastery' ? 3 : 4;
      if (ms.size < need) gaps.push(`${TIER_BY_ID[st.tier].name} uses ${ms.size} learning method${ms.size === 1 ? '' : 's'} (needs ${need}+)`);
      if (!ms.has('transfer')) gaps.push(`${TIER_BY_ID[st.tier].name} has no "use it in music" (transfer) lesson`);
      if (st.tier !== 'foundations' && !ms.has('retrieval') && !ms.has('interleaving') && !ms.has('variable')) gaps.push(`${TIER_BY_ID[st.tier].name} has no retrieval, interleaving or variable-practice lesson`);
      list.filter(l => l.ex.method && !METHOD_IDS.includes(l.ex.method)).forEach(l => err(`${w} › ${st.tier}`, `"${l.ex.name}": unknown method "${l.ex.method}" (use ${METHOD_IDS.join(', ')})`));
    }
    if (untagged) warn(w, `${untagged} of ${total} lessons have no learning-method tag (see CONTENT.md, "Concept-first lessons")`);
  } catch (x) { err(w, 'the app failed to build its lessons: ' + x.message); }
  const noStudy = e.stages.flatMap(st => st.skills).filter(sk => !(sk.study && sk.study.concept && sk.study.why)).length;
  if (noStudy) warn(w, `${noStudy} skill${noStudy === 1 ? '' : 's'} without study notes (CONTENT.md, "Study notes")`);
  const standard = gaps.length === 0;
  if (!standard && KB_INDEX.find(m => m.id === e.id && m.complete)) warn(w, `complete, but below the reference standard (the pentatonic path): ${gaps.join('; ')}`);
  coverage.push({ id: e.id, title: e.title, kind: e.kind || 'technique', standard, gaps, cells: TIERS.map(t => { const st = e.stages.find(s => s.tier === t.id); return st ? { skills: st.skills.length, lessons: st.skills.reduce((a, s) => a + s.ex.length, 0), full: isFull(st) } : null; }) });
}
// every entry is findable by its own words, and names don't steal each other's requests
for (const m of KB_INDEX) { const found = matchTechniques(m.title).map(x => x.id); if (!found.includes(m.id)) warn(`kb/${m.id}.js`, `"${m.title}" matches ${found.join(', ') || 'nothing'} instead`); }

/* ------------------------------ Artists ------------------------------ */
const artistFiles = readdirSync(join(dataDir, 'artists')).filter(f => f.endsWith('.js')).sort();
for (const f of artistFiles) {
  const w = `artists/${f}`;
  let a;
  try { a = (await import(pathToFileURL(join(dataDir, 'artists', f)).href)).default; } catch (x) { err(w, 'failed to load: ' + x.message); continue; }
  if (!a || !a.id) { err(w, 'no default export artist({...})'); continue; }
  if (`${a.id}.js` !== f) err(w, `the file name must be the artist id (${a.id}.js)`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.id)) err(w, 'id must be kebab-case');
  for (const k of ['name', 'blurb', 'genre']) if (!a[k]) err(w, `missing "${k}"`);
  if (!Array.isArray(a.wiki) || !a.wiki.length) err(w, '"wiki" must list at least one Wikipedia article title');
  if (!(a.re instanceof RegExp)) err(w, '"re" must be a RegExp');
  else { const m = matchArtist(a.name); if (!m || m.id !== a.id) err(w, `matchArtist("${a.name}") finds ${m ? m.id : 'nothing'}: the regex is missing or another artist's regex catches it first`); }
  if (!a.ctx || typeof a.ctx.key !== 'number') err(w, '"ctx" needs {key, minor, prog}');
  if (!Array.isArray(a.techniques) || a.techniques.length < 3) err(w, 'list at least 3 signature techniques');
  if (!Array.isArray(a.units) || a.units.length < 4) err(w, 'at least 4 units (the last one should put everything together in music)');
  if (!Array.isArray(a.riffs) || a.riffs.length < 3) warn(w, 'fewer than 3 famous songs');
  // Units that copy a whole multi-stage path should draw from it instead (PU), so the artist
  // teaches the stage the player is at and shares progress with the path.
  const kbLoaded = await Promise.all(kbFiles.map(x => import(pathToFileURL(join(dataDir, 'kb', x)).href).then(m => m.default).catch(() => null)));
  for (const u of a.units || []) {
    if (u.path) { if (!kbIds.has(u.path)) err(w, `unit "${u.title}" draws from unknown path "${u.path}"`); continue; }
    for (const e of kbLoaded.filter(Boolean)) {
      const tiers = e.stages.filter(st => st.skills.some(sk => (u.skills || []).includes(sk))).length;
      if (tiers >= 2) warn(w, `unit "${u.title}" copies ${tiers} stages of the ${e.id} path: use PU(${e.id}) so it teaches the player's stage and shares progress`);
    }
  }
  for (const r of a.riffs || []) {
    if (!r.title || !r.note) err(w, 'each riff needs "title" and "note"');
    if (r.tab || r.notes) err(w, `riff "${r.title}" carries notes: famous songs are linked, never transcribed`);
  }
  let lessons = [];
  try { lessons = await artistLessonList(p, a.id); } catch (x) { err(w, 'lessons failed to build: ' + x.message); }
  if (lessons.length < 8) err(w, `only ${lessons.length} lessons build (need 8+)`);
  const ids = new Set();
  lessons.forEach(l => { checkExercise(`${w} › ${l.skill.id} › ${l.ex.name}`, l.ex); if (ids.has(l.ex.id)) warn(w, `duplicate exercise id ${l.ex.id}`); ids.add(l.ex.id); });
  try {
    const course = createMasterClass(p, { title: `${a.name} style` });
    const r = await buildMasterTree(p, course);
    if (r.source !== 'artist') err(w, `the master class didn't come from the Artist Series (source: ${r.source})`);
    p.courses = [];
  } catch (x) { err(w, 'master class failed to build: ' + x.message); }
}
for (const a of ARTIST_INDEX) for (const b of ARTIST_INDEX) if (a !== b && a.re.test(b.name.toLowerCase())) err(`artists/${a.id}.js`, `its regex also matches "${b.name}"`);

/* ---------------------- Artists are built technique-first ---------------------- */
// The process (CONTENT.md, "Building an artist"): research the artist and name their signature
// techniques; research each technique until it can be generated with proven learning methods;
// build each one as a complete path (all four stages full); only then add the artist, whose
// units draw from those paths (PU). New artists must pass every check below; the artists that
// were built before this rule get warnings instead, which form their catch-up list.
const LEGACY_ARTISTS = new Set(['eric-johnson', 'van-halen', 'paul-gilbert', 'srv', 'hendrix', 'gilmour', 'guthrie-govan'].filter(id => id !== process.env.FC_STRICT_ARTIST));
const KB_META = Object.fromEntries(KB_INDEX.map(m => [m.id, m]));
const readiness = [];
for (const f of artistFiles) {
  let a; try { a = (await import(pathToFileURL(join(dataDir, 'artists', f)).href)).default; } catch { continue; }
  if (!a || !a.id) continue;
  const w = `artists/${f}`, legacy = LEGACY_ARTISTS.has(a.id), report = legacy ? warn : err;
  const units = a.units || [], pathUnits = units.filter(u => u.path);
  // every signature technique resolves to a learning path the artist draws from
  const techs = (a.techniques || []).map((name, i) => {
    const id = (a.techPaths && a.techPaths[i]) || (matchTechniques(name)[0] || {}).id || null;
    return { name, id };
  });
  for (const t of techs) {
    if (!t.id) report(w, `signature technique "${t.name}" has no learning path: research it and build it as a complete path first (or link it with {name, path})`);
    else if (!KB_META[t.id]) report(w, `signature technique "${t.name}" links to unknown path "${t.id}"`);
    else if (!pathUnits.some(u => u.path === t.id)) report(w, `signature technique "${t.name}" (${t.id}) isn't taught by a PU(${t.id}) unit`);
  }
  // every path the artist draws from is complete
  const STD = Object.fromEntries(coverage.map(r => [r.id, r]));
  for (const u of pathUnits) if (KB_META[u.path] && !(STD[u.path] && STD[u.path].standard)) report(w, `unit "${u.title}" draws from ${u.path}, which doesn't meet the reference standard yet (${STD[u.path] ? STD[u.path].gaps.slice(0, 3).join('; ') : 'not built'}): finish the path before the artist`);
  // lessons outside paths only in the closing unit
  units.slice(0, -1).filter(u => !u.path).forEach(u => report(w, `unit "${u.title}" has its own lessons: a signature technique belongs in a complete path (draw it with PU); only the closing "put it together" unit holds the artist's own studies`));
  if (!Array.isArray(a.sources) || a.sources.filter(x => /^https?:\/\//.test(x)).length < 3) report(w, 'list the research behind the artist in "sources" (3+ URLs: interviews, lessons, analyses)');
  const bioWords = typeof a.bio === 'string' ? a.bio.trim().split(/\s+/).filter(Boolean).length : 0;
  if (!bioWords) report(w, 'no "bio": write a 120–200 word bio from your research (CONTENT.md, "The bio")');
  else if (bioWords < 80 || bioWords > 260) warn(w, `bio is ${bioWords} words (aim for 120–200)`);
  if (a.topVideo == null) warn(w, 'no "topVideo": add their most-viewed official YouTube video (CONTENT.md, "The most popular video")');
  else if (!/^[A-Za-z0-9_-]{11}$/.test(a.topVideo.id || '') || !a.topVideo.title) err(w, 'topVideo needs an 11-character YouTube id and a title');
  const ids = [...new Set(techs.map(t => t.id).filter(Boolean).concat(pathUnits.map(u => u.path)))];
  readiness.push({ id: a.id, legacy, done: ids.filter(id => STD[id] && STD[id].standard), todo: ids.filter(id => !(STD[id] && STD[id].standard)), missing: techs.filter(t => !t.id).map(t => t.name), sources: hasSources(a), bio: !!bioWords });
}

/* ------------------------------- Report ------------------------------- */
const cell = c => (c ? `${c.full ? '✓' : '·'}${c.skills}/${c.lessons}` : '—').padEnd(9);
console.log(`\nLearning-path coverage (skills/lessons per stage; ✓ = full: ${FULL_STAGE.skills}+ skills and ${FULL_STAGE.lessons}+ lessons):`);
console.log(`${'entry'.padEnd(26)}${TIERS.map(t => t.name.slice(0, 8).padEnd(9)).join('')}Reference standard`);
coverage.sort((a, b) => b.cells.filter(c => c && c.full).length - a.cells.filter(c => c && c.full).length || a.id.localeCompare(b.id))
  .forEach(r => console.log(`${(r.id + (r.kind !== 'technique' ? ` (${r.kind})` : '')).padEnd(26)}${r.cells.map(cell).join('')}${r.standard ? '★ meets it' : r.cells.every(c => c && c.full) ? '· not yet' : ''}`));
const complete = coverage.filter(r => r.cells.every(c => c && c.full)).length;
console.log(`${complete} of ${coverage.length} paths complete; ${coverage.filter(r => r.standard).length} meet the reference standard; ${coverage.length - complete} need more stages or lessons. ${artistFiles.length} artists.\n`);
console.log('Artist readiness (technique-first: every signature technique a complete path):');
readiness.forEach(r => console.log(`${(r.id + (r.legacy ? ' (built before the rule)' : '')).padEnd(38)}${r.todo.length || r.missing.length || !r.sources || !r.bio ? `paths to bring to the standard: ${r.todo.join(', ') || '—'}${r.missing.length ? `; techniques with no path yet: ${r.missing.join(', ')}` : ''}${r.sources ? '' : '; artist sources missing'}${r.bio ? '' : '; bio missing'}` : 'ready'}`));
console.log('');
console.log(`Checked ${kbFiles.length} knowledge-base entries and ${artistFiles.length} artists.`);
warnings.forEach(x => console.log('WARN  ' + x));
errors.forEach(x => console.log('ERROR ' + x));
console.log(errors.length ? `${errors.length} error(s).` : 'All content is valid.');
process.exit(errors.length ? 1 : 0);
