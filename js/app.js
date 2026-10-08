// App entry: boot, hash router, welcome screen.
import { $, esc } from './core/util.js';
import { Store, emptyProfile, normalize } from './core/store.js';
import { Claude } from './core/claude.js';
import { Wiki } from './core/wiki.js';
import { chooseTrack } from './core/track.js';
import { createStarterCourses } from './core/courses.js';
import { ProfileBuilder } from './assessment/engine.js';
import { rebuildProfile } from './core/skills.js';
import { Metronome } from './tools/metronome.js';
import { Shell } from './ui/shell.js';
import { mountOnboarding } from './screens/onboarding.js';
import { mountAssessment } from './screens/assessment.js';
import { mountDashboard } from './screens/dashboard.js';
import { mountTools } from './screens/tools.js';
import { mountProfile } from './screens/profile.js';
import { mountSettings } from './screens/settings.js';
import { importBlockHTML, wireImport } from './ui/importui.js';
import { prepareProfile } from './core/importer.js';
import { mountCourse } from './screens/course.js';
import { mountRoutineRunner, mountRoutineSummary } from './screens/routine.js';
import { mountLibrary, mountLibraryExercise } from './screens/library.js';
import { initTunerFab } from './ui/tunerfab.js';
import { mountReassessHub, mountReassessRun } from './screens/reassess.js';
import { mountEvaluate } from './screens/evaluate.js';
import { mountSongsHub, mountSongDetail } from './screens/songs.js';
import { Recorder } from './eval/recorder.js';
import { Audio as AudioEngine } from './core/audio.js';
import { applyAudioPrefs } from './ui/audiosetup.js';

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
  rebuildProfile(p);
  await createStarterCourses(p);
  Store.replace(p); Store.draft.clear(); working = null;
  chooseTrack(Store.profile); Store.save();
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
      ${importBlockHTML({ label: 'Import a saved profile (JSON)', btnClass: 'btn block ghost' })}
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
  const offImport = wireImport(root, {
    onDone: prof => { working = null; applySettings(); navigate(Object.keys(prof.domains || {}).length ? '#/home' : '#/onboarding'); }
  });
  root.addEventListener('click', onClick);
  return () => { offImport(); root.removeEventListener('click', onClick); };
}

function applySettings() {
  const p = Store.profile; if (!p) return;
  Claude.model = p.settings.model || Claude.model;
  Wiki.enabled = p.settings.wikiImages !== false;
  applyAudioPrefs(p);
}

const LIB_FOR_TAB = { 'spider-1234': 'spider', 'penta-box1': 'penta', 'penta-16ths': 'penta', 'gcd-changes': 'open-changes', 'legato-3nps': 'legato', 'blues-shuffle-a': 'shuffle', 'string-skip': 'string-cross', 'sweep-am': 'sweep' };
const needsProfile = new Set(['home', 'tools', 'profile', 'course', 'results', 'practice', 'reassess', 'evaluate', 'songs', 'song']);

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
  // per-screen class, so wide windows can lay each screen out in columns
  const sub = String(parts[1] || '').replace(/[^a-z0-9-]/gi, '');
  root.className = `view v-${page}${sub ? ` v-${page}-${sub}` : ''}`;
  window.scrollTo(0, 0);
  const tabFor = { home: 'home', course: 'home', practice: 'practice', reassess: 'profile', evaluate: 'tools', tools: 'tools', profile: 'profile', results: 'profile', songs: 'songs', song: 'songs' };
  Shell.tabs(!!ready && !['welcome', 'onboarding', 'assessment'].includes(page) && !(page === 'reassess' && parts[1] === 'run'), tabFor[page]);

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
            rebuildProfile(p, 'Setup answers updated'); Store.replace(p); Store.draft.clear(); working = null; navigate('#/profile');
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
    case 'home': cleanup = mountDashboard(root, { navigate, courseId: parts[1] === 'routine' ? parts[2] || null : null, skillId: parts[1] === 'routine' ? parts[3] || null : null }); break;
    case 'tools':
      // the tab-player exercises now live in the Practice library (with variations)
      if (parts[1] === 'tabs' && parts[2] && LIB_FOR_TAB[parts[2]]) { navigate('#/practice/ex/' + LIB_FOR_TAB[parts[2]]); return; }
      cleanup = mountTools(root, { tab: parts[1] || 'tuner', exerciseId: parts[2] ? decodeURIComponent(parts[2]) : null, navigate }); break;
    case 'course': cleanup = mountCourse(root, { id: parts[1], navigate }); break;
    case 'practice':
      if (parts[1] === 'run') cleanup = mountRoutineRunner(root, { navigate });
      else if (parts[1] === 'summary') cleanup = mountRoutineSummary(root, { navigate });
      else if (parts[1] === 'ex' && parts[2]) cleanup = mountLibraryExercise(root, { navigate, id: decodeURIComponent(parts[2]), vid: parts[3] ? decodeURIComponent(parts[3]) : null });
      // course routines are built on the dashboard now; keep old links working
      else if (parts[1] === 'course') { navigate(`#/home/routine/${parts[2] || ''}${parts[3] ? '/' + parts[3] : ''}`); return; }
      else cleanup = mountLibrary(root, { navigate });
      break;
    case 'reassess':
      if (parts[1] === 'run') cleanup = mountReassessRun(root, { navigate });
      else cleanup = mountReassessHub(root, { navigate, preselect: parts[1] || null });
      break;
    case 'evaluate': cleanup = mountEvaluate(root, { navigate, sub: parts[1] || null }); break;
    case 'songs': cleanup = mountSongsHub(root, { navigate }); break;
    case 'song': cleanup = mountSongDetail(root, { id: parts[1], navigate }); break;
    case 'settings': cleanup = mountSettings(root, { navigate, applySettings }); break;
    default: navigate('#/');
  }
}

function boot() {
  if (window.__FC_TEST__) window.__fc = { Recorder, Store, Audio: AudioEngine };
  Store.load();
  if (Store.profile) {
    applySettings();
    // Upgrades older profiles: assessment fields, levels, style-specific plans, today's track
    prepareProfile(Store.profile);
    Store.save();
  }
  window.addEventListener('hashchange', route);
  initTunerFab();
  route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
