// Assembles a research brief from its five parts (or reads a single full file) and checks it.
// Usage: node content/briefs/merge-brief.mjs <folder> <topicId> [--out merged.json]
// Files looked for in <folder>: <topicId>.core.json + <topicId>.{foundations,intermediate,advanced,mastery}.json,
// or a single <topicId>.json in the full shape (SCHEMA.md). Exit code 0 = merged brief is valid; 1 = problems printed.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TIERS = ['foundations', 'intermediate', 'advanced', 'mastery'];
const [folder, topicId, ...rest] = process.argv.slice(2);
if (!folder || !topicId) { console.error('usage: merge-brief.mjs <folder> <topicId> [--out file]'); process.exit(2); }
const outIdx = rest.indexOf('--out'), outFile = outIdx >= 0 ? rest[outIdx + 1] : null;
const problems = [];
const read = name => {
  const f = join(folder, name);
  if (!existsSync(f)) return null;
  let t = readFileSync(f, 'utf8').trim().replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
  // A Google Doc read as Markdown escapes brackets and underscores (\\[ \\] \\_ \\#); JSON never has those escapes, so undo them.
  t = t.replace(/\\([\[\]_#*>~`-])/g, '$1');
  // Text before the first { or after the last } (a header line from a pasted chat) is dropped.
  const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a > 0 || (b >= 0 && b < t.length - 1)) t = t.slice(Math.max(a, 0), b + 1);
  try { return JSON.parse(t); } catch (e) { problems.push(`${name}: not valid JSON (${e.message})`); return undefined; }
};

let brief = read(`${topicId}.json`);
if (!brief) {
  const core = read(`${topicId}.core.json`);
  if (core === null) problems.push(`${topicId}.core.json is missing`);
  if (core) {
    brief = { ...core, tiers: {} };
    for (const t of TIERS) {
      const part = read(`${topicId}.${t}.json`);
      if (part === null) { problems.push(`${topicId}.${t}.json is missing`); continue; }
      if (!part) continue;
      if (part.tier && part.tier !== t) problems.push(`${t} part says tier "${part.tier}"`);
      if (part.topicId && part.topicId !== topicId) problems.push(`${t} part is for topic "${part.topicId}"`);
      brief.tiers[t] = { goal: part.goal || '', skills: part.skills || [] };
      if (Array.isArray(part.openQuestions) && part.openQuestions.length) brief.openQuestions = [...(brief.openQuestions || []), ...part.openQuestions.map(q => `[${t}] ${q}`)];
    }
  }
}

if (brief) {
  if (brief.schemaVersion !== 1) problems.push('schemaVersion must be 1');
  if (brief.topic?.id !== topicId) problems.push(`topic.id is "${brief.topic?.id}", expected "${topicId}"`);
  const patterns = brief.concept?.patterns || [];
  const ids = new Set(patterns.map(p => p.id));
  if (!patterns.length) problems.push('concept.patterns is empty');
  for (const p of patterns) {
    if (!['player', 'primary', 'secondary', 'unconfirmed'].includes(p.confirmed)) problems.push(`pattern ${p.id}: confirmed level missing or invalid`);
    if (!Array.isArray(p.notation) || !p.notation.every(n => Array.isArray(n) && n.length === 2 && n[0] >= 1 && n[0] <= 6 && n[1] >= 0 && n[1] <= 22)) problems.push(`pattern ${p.id}: notation must be [[string 1-6, fret 0-22], ...]`);
    if (!p.picking || !['d', 'u'].includes(p.picking.firstStroke)) problems.push(`pattern ${p.id}: picking.firstStroke must be d or u`);
  }
  const seen = new Set();
  for (const t of TIERS) {
    const tier = brief.tiers?.[t];
    if (!tier || !Array.isArray(tier.skills) || !tier.skills.length) { problems.push(`tier ${t} has no skills`); continue; }
    for (const s of tier.skills) for (const l of s.lessons || []) {
      if (seen.has(l.id)) problems.push(`duplicate lesson id ${l.id}`); seen.add(l.id);
      if (l.patternId && !ids.has(l.patternId)) problems.push(`lesson ${l.id} cites unknown patternId "${l.patternId}"`);
    }
  }
}

if (problems.length || !brief) { console.error('PROBLEMS:\n- ' + problems.join('\n- ')); process.exit(1); }
const json = JSON.stringify(brief, null, 2);
if (outFile) writeFileSync(outFile, json); else console.log(json);
console.error(`OK: ${topicId} merged (${(brief.concept.patterns || []).length} patterns, ${TIERS.map(t => brief.tiers[t].skills.length + ' skills in ' + t).join(', ')})`);
