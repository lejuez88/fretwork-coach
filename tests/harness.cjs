// Runs one bundled test file in jsdom. Usage: node harness.cjs <bundle.js> [--profile fixtures/profile.json]
// The test calls window.__ok(cond, msg) for each check and window.__finish() at the end.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const [file, ...rest] = process.argv.slice(2);
const pi = rest.indexOf('--profile');
const code = fs.readFileSync(file, 'utf8');
const dom = new JSDOM('<!doctype html><html><body><div class="wrap"><main id="view"></main></div><div id="actionbar"></div><nav id="tabbar"><div class="inner"></div></nav><div id="toast"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
const w = dom.window;
w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLElement.prototype.scrollTo = function (o) { if (o && o.left != null) this.scrollLeft = o.left; };
w.Element.prototype.setPointerCapture = function () {};
w.console = console; w.scrollTo = () => {};
if (pi >= 0) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, rest[pi + 1]), 'utf8'));
  w.localStorage.setItem('fretworkCoach.profile.v2', JSON.stringify(raw.questionnaire ? raw : raw.profile));
  w.fetch = () => Promise.reject(new Error('offline'));
  w.__FC_TEST__ = true;
}
let failed = 0, passed = 0;
const name = path.basename(file, '.js');
w.__ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log(`FAIL [${name}]: ${msg}`); } };
w.__finish = () => { console.log(`${name}: ${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0); };
w.addEventListener('error', e => { console.log(`ERROR [${name}]`, e.message); });
try { w.eval(code); } catch (e) { console.log('THROW', e && e.stack || e); process.exit(1); }
setTimeout(() => { console.log(`TIMEOUT [${name}]: ${passed} passed, ${failed} failed`); process.exit(1); }, 180000);
