// Content validator for Fretwork Coach lessons (Artist Series and the technique library).
// Run from the repo root:  node tools/validate-content.mjs
// Exits with code 1 when anything is broken. Warnings don't fail the run.
// See CONTENT.md for the format these checks enforce.
import { ARTISTS, TECHNIQUES, matchArtist, matchTechniques } from '../js/data/artists.js';
import { artistLessonList, createMasterClass, buildMasterTree } from '../js/core/master.js';
import { emptyProfile, normalize } from '../js/core/store.js';
import { normalizeExercise } from '../js/core/coursegen.js';

const errors = [], warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DOMAINS = ['fretting', 'picking', 'rhythm', 'fretboard', 'theory', 'ear', 'improv'];

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
      if (x.x && !['h', 'p', '/', '\\', 'b', '~', 'pm', 't'].includes(x.x)) err(where, `note ${i}: unknown technique "${x.x}"`);
    });
    if (n.tab == null) err(where, 'tab dropped by the normalizer (check the note format)');
  } else if (!(ex.chords && ex.chords.length) && !(ex.voicings && ex.voicings.length) && !ex.libId) warn(where, 'no tab, chords or voicings: it will only show the metronome');
  if (ex.chords && n.chords.length !== ex.chords.length) err(where, `chord names not recognized: ${ex.chords.filter(c => !n.chords.includes(c)).join(', ')}`);
  if (ex.voicings && (!n.voicings || n.voicings.length !== ex.voicings.length)) err(where, 'a voicing is invalid (6 frets, low E first, null = muted, 0–22)');
}

/* Technique library */
const techIds = new Set();
for (const t of TECHNIQUES) {
  const w = `technique "${t.id}"`;
  if (!KEBAB.test(t.id) && !/^[a-z][a-zA-Z0-9]*$/.test(t.id)) err(w, 'id must be kebab-case or camelCase');
  if (techIds.has(t.id)) err(w, 'duplicate id'); techIds.add(t.id);
  if (!(t.re instanceof RegExp)) err(w, '"re" must be a RegExp');
  else if (!t.re.test(t.title.toLowerCase())) warn(w, `its regex doesn't match its own title "${t.title}" (requests using that name won't find it)`);
  if (!t.skills || !t.skills.length) err(w, 'no skills');
  for (const s of t.skills || []) for (const [i, e] of (s.ex || []).entries()) {
    const c = { key: 9, minor: true, lvl: 5, genre: 'rock', prog: 'minorRock' };
    if (typeof e === 'function') { try { checkExercise(`${w} › ${s.id} #${i + 1}`, e(c)); } catch (x) { err(`${w} › ${s.id} #${i + 1}`, 'generator threw: ' + x.message); } }
  }
}

/* Artists */
const ids = new Set(), p = normalize(emptyProfile());
for (const a of ARTISTS) {
  const w = `artist "${a.id}"`;
  if (!KEBAB.test(a.id)) err(w, 'id must be kebab-case');
  if (ids.has(a.id)) err(w, 'duplicate id'); ids.add(a.id);
  for (const k of ['name', 'blurb', 'genre']) if (!a[k]) err(w, `missing "${k}"`);
  if (!Array.isArray(a.wiki) || !a.wiki.length) err(w, '"wiki" must list at least one Wikipedia article title');
  if (!(a.re instanceof RegExp)) err(w, '"re" must be a RegExp');
  else { const m = matchArtist(a.name); if (!m || m.id !== a.id) err(w, `matchArtist("${a.name}") finds ${m ? m.id : 'nothing'}: the regex is missing or another artist's regex catches it first`); }
  if (!a.ctx || typeof a.ctx.key !== 'number') err(w, '"ctx" needs {key, minor, prog}');
  if (!Array.isArray(a.techniques) || a.techniques.length < 3) err(w, 'list at least 3 signature techniques');
  if (!Array.isArray(a.units) || a.units.length < 4) err(w, 'at least 4 units (the last one should put everything together in music)');
  if (!Array.isArray(a.riffs) || a.riffs.length < 3) warn(w, 'fewer than 3 famous songs');
  for (const r of a.riffs || []) {
    if (!r.title || !r.note) err(w, 'each riff needs "title" and "note"');
    if (r.tab || r.notes) err(w, `riff "${r.title}" carries notes: famous songs are linked, never transcribed`);
  }
  let lessons = [];
  try { lessons = artistLessonList(p, a.id); } catch (x) { err(w, 'lessons failed to build: ' + x.message); }
  if (lessons.length < 8) err(w, `only ${lessons.length} lessons build (need 8+)`);
  const exIds = new Set();
  lessons.forEach(l => { checkExercise(`${w} › ${l.skill.id} › ${l.ex.name}`, l.ex); if (exIds.has(l.ex.id)) warn(w, `duplicate exercise id ${l.ex.id}`); exIds.add(l.ex.id); });
  try {
    const course = createMasterClass(p, { title: `${a.name} style` });
    const r = await buildMasterTree(p, course);
    if (r.source !== 'artist') err(w, `the master class didn't come from the Artist Series (source: ${r.source})`);
    p.courses = [];
  } catch (x) { err(w, 'master class failed to build: ' + x.message); }
}
// artist regexes must not catch each other's names
for (const a of ARTISTS) for (const b of ARTISTS) if (a !== b && a.re.test(b.name.toLowerCase())) err(`artist "${a.id}"`, `its regex also matches "${b.name}"`);
// every technique id is reachable from its own words
for (const t of TECHNIQUES) { const found = matchTechniques(t.title).map(x => x.id); if (found.length && found[0] !== t.id && !found.includes(t.id)) warn(`technique "${t.id}"`, `"${t.title}" matches ${found.join(', ')} instead`); }

console.log(`Checked ${ARTISTS.length} artists and ${TECHNIQUES.length} techniques.`);
warnings.forEach(x => console.log('WARN  ' + x));
errors.forEach(x => console.log('ERROR ' + x));
console.log(errors.length ? `${errors.length} error(s).` : 'All content is valid.');
process.exit(errors.length ? 1 : 0);
