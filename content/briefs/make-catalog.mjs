// Writes the catalog the Gemini Gem keeps in its knowledge: what the app already teaches, so briefs reuse
// real topic ids and prerequisites and don't duplicate lessons. Usage: node content/briefs/make-catalog.mjs [out.md]
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const root = resolve(new URL('../..', import.meta.url).pathname);
const { KB_INDEX, ARTIST_INDEX } = await import(pathToFileURL(join(root, 'js/data/index.js')).href);
const L = [];
L.push('# Fretwork Coach: what the app already teaches', '', `Generated ${new Date().toISOString().slice(0, 10)} from the repo. Reuse these topic ids as \`prereqs\`; do not propose a topic that is already here unless the request asks to deepen it.`, '', '## Topics (knowledge base)', '');
for (const k of KB_INDEX) {
  L.push(`### ${k.id}: ${k.title} (${k.kind}, ${k.domain}, levels ${k.level?.join('-')})`, k.summary || '');
  if (k.prereqs?.length) L.push(`Prereqs: ${k.prereqs.join(', ')}`);
  if (k.aliases?.length) L.push(`Also called: ${k.aliases.join('; ')}`);
  if (k.stages) L.push('Stages: ' + k.stages.map(s => `${s.tier} (${s.skills} skills, ${s.lessons} lessons)`).join('; '));
  L.push('');
}
L.push('## Artists (Artist Series)', '');
for (const a of ARTIST_INDEX) L.push(`- ${a.id}: ${a.name} (${a.genre}). Techniques: ${(a.techniques || []).join(', ')}. Paths: ${(a.techPaths || []).join(', ')}`);
const out = process.argv[2];
if (out) writeFileSync(out, L.join('\n') + '\n'); else console.log(L.join('\n'));
