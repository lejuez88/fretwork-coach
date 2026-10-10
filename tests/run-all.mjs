// Bundles every test (tests/t_*.mjs) with esbuild and runs it in jsdom.
// From the repo root:  npm --prefix tests ci && npm --prefix tests test
import { build } from 'esbuild';
import { readdirSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '.build');
mkdirSync(out, { recursive: true });
// tests that boot the whole app with a player profile
const WITH_PROFILE = new Set(['t_screens', 't_artist_app', 't_guided', 't_dock', 't_ask']);
const only = process.argv.slice(2);
const tests = readdirSync(here).filter(f => /^t_.*\.mjs$/.test(f)).map(f => f.replace(/\.mjs$/, '')).filter(t => !only.length || only.includes(t));
let bad = 0;
for (const t of tests) {
  await build({ entryPoints: [join(here, t + '.mjs')], bundle: true, format: 'iife', outfile: join(out, t + '.js'), logLevel: 'error' });
  const args = [join(here, 'harness.cjs'), join(out, t + '.js'), ...(WITH_PROFILE.has(t) ? ['--profile', 'fixtures/profile.json'] : [])];
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: here });
  if (r.status !== 0) bad++;
}
console.log(bad ? `\n${bad} of ${tests.length} test files failed.` : `\nAll ${tests.length} test files passed.`);
process.exit(bad ? 1 : 0);
