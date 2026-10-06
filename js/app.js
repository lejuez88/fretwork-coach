// App entry: boot, hash router, welcome screen.
import { $, esc } from './core/util.js';
import { Store, emptyProfile, normalize } from './core/store.js';
import { Claude } from './core/claude.js';
import { Wiki } from './core/wiki.js';
import { chooseAlbum } from './core/recommend.js';
import { createStarterCourses } from './core/courses.js';
import { ProfileBuilder } from './assessment/engine.js';
import { Metronome } from './tools/metronome.js';
import { Shell } from './ui/shell.js';
import { mountOnboarding } from './screens/onboarding.js';
import { mountAssessment } from './screens/assessment.js';
import { mountDashboard } from './screens/dashboard.js';
import { mountTools } from './screens/tools.js';
import { mountProfile } from './screens/profile.js';
import { mountSettings, importFile } from './screens/settings.js';
import { mountCourse } from './screens/course.js';

const view = () => $('#view');
let cleanup = null;
let working = null; // profile being onboarded or assessed

function navigate(hash) { if (location.hash === hash) route(); else location.hash = hash; }

function workingProfile() {
  if (working) return working;
  const d = Store.draft.get();
  working = d && d.profile ? normalize(d.profile) : (Store.profile || emptyProfile());
  return working;
}

async function finishAssessment(p) {
  view().innerHTML = '<section class="card center"><div class="spinner"></div><h2>Building your profile…</h2><p class="muted">Calculating levels and creating your first courses.</p></section>';
  Shell.actions('');
  ProfileBuilder.build(p);
  await createStarterCourses(p);
  Store.replace(p); Store.draft.clear(); working = null;
  chooseAlbum(Store.profile); Store.save();
  navigate('#/results');
}

function welcome(root) {
  const d = Store.draft.get();
  root.innerHTML = `
    <section class="card grille hero">
      <div class="label">Your adaptive guitar coach</div>
      <h1>Find your edge.</h1>
      <p>Fretwork Coach builds practice at the edge of your ability: hard enough to stretch you, achievable enough to keep you progressing. Setup takes about 20 minutes with your guitar in hand.</p>
      <ul class="steps">
        <li><b>Tell it your taste:</b> genres and the guitarists you want to sound like.</li>
        <li><b>Find your level:</b> playing, theory and ear tests across 8 skill areas.</li>
        <li><b>Get your courses:</b> named for your style and level, tracked on your dashboard.</li>
      </ul>
      <button class="btn primary block" data-w="start">${d ? 'Start over' : 'Create my player profile'}</button>
      ${d ? `<button class="btn block" data-w="resume">Resume setup${d.profile && d.profile.questionnaire.name ? ' (' + esc(d.profile.questionnaire.name) + ')' : ''}</button>` : ''}
      <label class="btn block ghost filebtn">Import a saved profile (JSON)<input type="file" accept="application/json,.json" data-w="import"></label>
    </section>
    <section class="card">
      <h3>Connect Claude ${Claude.hasKey() ? '<span class="badge ok">Connected</span>' : ''}</h3>
      <p class="muted small">Add your Anthropic API key first so Claude can identify the guitarists you type in and name your courses. You can also add it later.</p>
      <a class="btn block" href="#/settings">${Claude.hasKey() ? 'Change API key' : 'Add API key'}</a>
    </section>
    <p class="muted small center">Works best on Chrome or Safari over https. Your data stays in this browser.</p>`;
  const onClick = e => {
    const b = e.target.closest('[data-w]'); if (!b) return;
    if (b.dataset.w === 'start') { Store.draft.clear(); working = emptyProfile(); Store.draft.set({ profile: working, phase: 'onboarding', step: 0 }); navigate('#/onboarding'); }
    if (b.dataset.w === 'resume') { working = null; const dr = Store.draft.get(); navigate(dr.phase === 'assessment' ? '#/assessment' : '#/onboarding'); }
  };
  const onChange = e => { if (e.target.dataset.w === 'import' && e.target.files[0]) importFile(e.target.files[0], () => { Store.load(); applySettings(); navigate(Object.keys(Store.profile.domains).length ? '#/home' : '#/onboarding'); }); };
  root.addEventListener('click', onClick); root.addEventListener('change', onChange);
  return () => { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); };
}

function applySettings() {
  const p = Store.profile; if (!p) return;
  Claude.model = p.settings.model || Claude.model;
  Wiki.enabled = p.settings.wikiImages !== false;
}

const needsProfile = new Set(['home', 'tools', 'profile', 'course', 'results']);

function route() {
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  Metronome.stop();
  Shell.actions('');
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/');
  let page = parts[0] || (Store.profile && Object.keys(Store.profile.domains).length ? 'home' : 'welcome');
  const ready = Store.profile && Object.keys(Store.profile.domains).length;
  if (needsProfile.has(page) && !ready) page = 'welcome';
  const root = view();
  root.innerHTML = '';
  window.scrollTo(0, 0);
  const tabFor = { home: 'home', course: 'home', tools: 'tools', profile: 'profile', results: 'profile', settings: 'settings' };
  Shell.tabs(!!ready && !['welcome', 'onboarding', 'assessment'].includes(page), tabFor[page]);

  switch (page) {
    case 'welcome': cleanup = welcome(root); break;
    case 'onboarding': {
      const p = workingProfile();
      const d = Store.draft.get();
      cleanup = mountOnboarding(root, {
        profile: p, startStep: d && d.phase === 'onboarding' ? d.step || 0 : 0,
        onExit: () => navigate(ready ? '#/profile' : '#/welcome'),
        onComplete: () => {
          if (Object.keys(p.domains).length && Object.keys(p.assessment.domains).length) {
            // Editing answers of an existing profile: recompute without retesting
            ProfileBuilder.build(p); Store.replace(p); Store.draft.clear(); working = null; navigate('#/profile');
          } else navigate('#/assessment');
        }
      });
      break;
    }
    case 'assessment': {
      const p = workingProfile();
      const d = Store.draft.get();
      cleanup = mountAssessment(root, p, {
        startDomain: d && d.phase === 'assessment' ? d.dIdx || 0 : 0,
        onBack: () => { Store.draft.set({ profile: p, phase: 'onboarding', step: 11 }); navigate('#/onboarding'); },
        onDone: () => finishAssessment(p)
      });
      break;
    }
    case 'results': cleanup = mountProfile(root, { navigate, firstRun: true }); break;
    case 'profile': cleanup = mountProfile(root, { navigate }); break;
    case 'home': cleanup = mountDashboard(root, { navigate }); break;
    case 'tools': cleanup = mountTools(root, { tab: parts[1] || 'tuner', exerciseId: parts[2] || null, navigate }); break;
    case 'course': cleanup = mountCourse(root, { id: parts[1], navigate }); break;
    case 'settings': cleanup = mountSettings(root, { navigate }); break;
    default: navigate('#/');
  }
}

function boot() {
  Store.load();
  if (Store.profile) {
    Store.save(); // migrates a v1 profile to v2 storage
    applySettings();
    if (Object.keys(Store.profile.domains).length) { chooseAlbum(Store.profile); Store.save(); }
  }
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
