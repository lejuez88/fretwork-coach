// Builds js/data/index.js: the small catalog the app loads at startup (names,
// match patterns, levels, stage summaries) so lesson files load only when shown.
// Run from the repo root after any change in js/data/kb/ or js/data/artists/:
//   node tools/build-index.mjs
// The validator fails when the index is out of date.
import { readdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { TIERS } from '../js/data/lib.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'js', 'data');
const OUT = join(dataDir, 'index.js');

const lessonsIn = skills => skills.reduce((a, s) => a + (s.ex || []).length, 0);
/** The depth standard (CONTENT.md): a stage is full with 3+ skills and 6+ lessons; a path is complete when all four stages are full. */
export const FULL_STAGE = { skills: 3, lessons: 6 };
export const isFull = st => st.skills.length >= FULL_STAGE.skills && lessonsIn(st.skills) >= FULL_STAGE.lessons;
/**
 * The reference standard (CONTENT.md, "The reference standard"): the depth of the pentatonic path,
 * per stage, 3+ research sources and an audited pedagogy (pedagogyIssues). Musical use is checked by the validator.
 */
export const STANDARD = { foundations: { skills: 4, lessons: 8 }, intermediate: { skills: 4, lessons: 10 }, advanced: { skills: 4, lessons: 8 }, mastery: { skills: 3, lessons: 6 } };
export const meetsDepth = st => { const t = STANDARD[st.tier]; return !!t && st.skills.length >= t.skills && lessonsIn(st.skills) >= t.lessons; };
export const hasSources = e => Array.isArray(e.sources) && e.sources.filter(x => /^https?:\/\//.test(x)).length >= 3;
/**
 * Teaching method first (CONTENT.md): what's wrong with an entry's pedagogy record, [] when it's
 * complete — the standard teaching sequence (3+ steps, each with the skills that teach it), every
 * skill mapped to a step, 3+ standard drills and 3+ recognized sources.
 */
export function pedagogyIssues(e) {
  const p = e.pedagogy, out = [];
  if (!p || typeof p !== 'object') return ['no "pedagogy" record: research how this topic is taught first'];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) out.push('pedagogy.date must be YYYY-MM-DD');
  if (!p.summary) out.push('pedagogy.summary is missing');
  const seq = Array.isArray(p.sequence) ? p.sequence : [];
  if (seq.length < 3) out.push(`pedagogy.sequence has ${seq.length} step(s) (needs 3+)`);
  const tiers = new Set(TIERS.map(t => t.id)), all = new Set(e.stages.flatMap(st => st.skills.map(sk => sk.id))), mapped = new Set();
  seq.forEach((x, i) => {
    if (!x || !x.id || !x.step || !x.how) out.push(`pedagogy.sequence[${i}] needs id, step and how`);
    if (x && !tiers.has(x.tier)) out.push(`pedagogy.sequence[${i}] tier "${x && x.tier}" isn't foundations, intermediate, advanced or mastery`);
    (x && Array.isArray(x.skills) ? x.skills : []).forEach(id => { if (!all.has(id)) out.push(`pedagogy step "${x.id}" lists unknown skill "${id}"`); mapped.add(id); });
    if (x && !(Array.isArray(x.skills) && x.skills.length)) out.push(`pedagogy step "${x.id}" lists no skills`);
  });
  const loose = [...all].filter(id => !mapped.has(id));
  if (seq.length && loose.length) out.push(`${loose.length} skill(s) not mapped to a teaching step: ${loose.slice(0, 6).join(', ')}${loose.length > 6 ? '…' : ''}`);
  if (!Array.isArray(p.drills) || p.drills.length < 3) out.push('pedagogy.drills needs 3+ standard drill formats');
  const src = Array.isArray(p.sources) ? p.sources.filter(x => (typeof x === 'string' && /^https?:\/\//.test(x)) || (x && ((x.url && /^https?:\/\//.test(x.url)) || (x.title && x.author)))) : [];
  if (src.length < 3) out.push(`pedagogy.sources has ${src.length} usable source(s) (needs 3+: a url, or a book's title and author)`);
  return out;
}
export const isTaught = e => pedagogyIssues(e).length === 0;
const reSrc = re => (re instanceof RegExp ? re.toString() : '/(?!)/');

export async function buildIndex() {
  const kb = [], artists = [];
  for (const f of readdirSync(join(dataDir, 'kb')).filter(f => f.endsWith('.js')).sort()) {
    const e = (await import(pathToFileURL(join(dataDir, 'kb', f)).href)).default;
    if (!e || !e.id) throw new Error(`js/data/kb/${f} has no default export entry(...)`);
    if (`${e.id}.js` !== f) throw new Error(`js/data/kb/${f}: the file name must be the entry id (${e.id}.js)`);
    kb.push({ e, f });
  }
  for (const f of readdirSync(join(dataDir, 'artists')).filter(f => f.endsWith('.js')).sort()) {
    const a = (await import(pathToFileURL(join(dataDir, 'artists', f)).href)).default;
    if (!a || !a.id) throw new Error(`js/data/artists/${f} has no default export artist(...)`);
    if (`${a.id}.js` !== f) throw new Error(`js/data/artists/${f}: the file name must be the artist id (${a.id}.js)`);
    artists.push({ a, f });
  }
  // which knowledge-base entries each artist's lessons use
  const uses = a => kb.filter(({ e }) => a.units.some(u => u.path === e.id) || e.stages.some(st => st.skills.some(sk => a.units.some(u => u.skills.includes(sk))))).map(({ e }) => e.id);
  const kbLines = kb.map(({ e }) => {
    const stages = TIERS.map(t => { const st = e.stages.find(s => s.tier === t.id); return st ? { tier: t.id, title: st.title, goal: st.goal, levels: st.levels, skills: st.skills.length, lessons: lessonsIn(st.skills), full: isFull(st) } : null; }).filter(Boolean);
    const complete = TIERS.every(t => { const st = stages.find(s => s.tier === t.id); return st && st.full; });
    const taught = isTaught(e);
    const deep = complete && TIERS.every(t => { const st = e.stages.find(s => s.tier === t.id); return st && meetsDepth(st); }) && hasSources(e) && taught;
    const meta = { id: e.id, kind: e.kind || 'technique', title: e.title, domain: e.domain, level: e.level, summary: e.summary, aliases: e.aliases || [], prereqs: e.prereqs || [], stages, lessons: stages.reduce((a, s) => a + s.lessons, 0), complete, deep, taught, taughtOn: taught ? e.pedagogy.date : null };
    return `  { ...${JSON.stringify(meta)}, re: ${reSrc(e.re)} }`;
  });
  const artistLines = artists.map(({ a }) => {
    const meta = { id: a.id, name: a.name, wiki: a.wiki, genre: a.genre, blurb: a.blurb, techniques: a.techniques, techPaths: a.techPaths || [], ctx: a.ctx, uses: uses(a), lessons: a.units.reduce((n, u) => n + lessonsIn(u.skills), 0), songs: (a.riffs || []).length };
    return `  { ...${JSON.stringify(meta)}, re: ${reSrc(a.re)} }`;
  });
  return `// GENERATED by tools/build-index.mjs: do not edit by hand.
// Run \`node tools/build-index.mjs\` after changing anything in js/data/kb/ or js/data/artists/.
export const KB_INDEX = [
${kbLines.join(',\n')}
];
export const ARTIST_INDEX = [
${artistLines.join(',\n')}
];
`;
}

/** True when js/data/index.js matches the content files. */
export async function indexIsCurrent() {
  return existsSync(OUT) && readFileSync(OUT, 'utf8') === await buildIndex();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = await buildIndex();
  writeFileSync(OUT, text);
  const n = (text.match(/^ {2}\{ \.\.\./gm) || []).length;
  console.log(`Wrote js/data/index.js (${n} entries and artists).`);
}
