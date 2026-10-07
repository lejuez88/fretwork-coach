// Continue the assessment: pick skill areas that were skipped (estimated) or
// stopped before the harder tests, test only those, then update levels without
// touching courses, practice history or lesson evidence.
import { esc } from '../core/util.js';
import { Store, normalize } from '../core/store.js';
import { DOMAINS, Assessment, testsFor } from '../assessment/engine.js';
import { rebuildProfile, describeChanges } from '../core/skills.js';
import { mountAssessment } from './assessment.js';
import { Shell } from '../ui/shell.js';

const DRAFT = 'fretworkCoach.reassessDraft';
const getDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { return null; } };
const setDraft = v => { try { v ? localStorage.setItem(DRAFT, JSON.stringify(v)) : localStorage.removeItem(DRAFT); } catch { /* ignore */ } };

/** Status of each domain: estimated | higher (could test harder) | placed. */
export function domainStatus(profile) {
  const out = {};
  for (const d of DOMAINS) {
    const ds = profile.assessment.domains[d.key];
    const dm = profile.domains[d.key] || {};
    if (d.key === 'repertoire') { out[d.key] = { status: profile.repertoire.length ? 'placed' : 'estimated', level: dm.level }; continue; }
    if (!ds || ds.skipped || !ds.tests || !ds.tests.length) { out[d.key] = { status: 'estimated', level: dm.level, note: 'Not tested: estimated from your setup answers' }; continue; }
    const tried = new Set(ds.tests.map(t => t.id)), top = Math.max(...ds.tests.map(t => t.level));
    const last = ds.tests[ds.tests.length - 1];
    const harder = testsFor(d.key).find(t => t.level > top && !tried.has(t.id));
    const z = Assessment.zone(last.score);
    if (harder && z !== 'fail') out[d.key] = { status: 'higher', level: dm.level, note: `Stopped at ${last.name} (${Math.round(last.score * 100)}%). Harder test available: ${harder.name}` };
    else out[d.key] = { status: 'placed', level: dm.level, note: `Placed by ${last.name}` };
  }
  return out;
}
export function estimatedCount(profile) { const st = domainStatus(profile); return Object.keys(st).filter(k => k !== 'repertoire' && st[k].status !== 'placed').length; }

export function mountReassessHub(root, { navigate, preselect = null }) {
  const p = Store.profile, st = domainStatus(p), draft = getDraft();
  const sel = new Set(preselect ? [preselect] : Object.keys(st).filter(k => st[k].status !== 'placed' && k !== 'repertoire'));
  const label = { estimated: 'Estimated', higher: 'Can go higher', placed: 'Placed' };

  function render() {
    root.innerHTML = `
      <a class="link" href="#/profile">← Profile</a>
      <h1>Continue assessment</h1>
      <p class="muted">Pick up where you stopped. Test only the areas you choose; your courses, practice history and lesson results stay as they are, and levels update when you finish.</p>
      ${draft ? `<section class="card levelup"><h3>Resume where you left off</h3><p class="small muted">${draft.keys.map(k => DOMAINS.find(d => d.key === k).name).join(', ')}</p><a class="btn primary block" href="#/reassess/run">Resume</a><button class="btn ghost block sm" data-x="discard">Discard that run</button></section>` : ''}
      <section class="card">
        ${DOMAINS.map(d => { const s = st[d.key]; return `
          <button class="rarow ${sel.has(d.key) ? 'on' : ''}" data-k="${d.key}">
            <span class="rcheck">${sel.has(d.key) ? '✓' : ''}</span>
            <span class="rbody"><b>${esc(d.name)}</b><span class="small muted">${esc(s.note || '')}</span></span>
            <span class="rstat ${s.status}">${label[s.status]}<br><b>${s.level || '—'}</b></span>
          </button>`; }).join('')}
      </section>`;
    Shell.actions(`<button class="btn primary" data-x="go" ${sel.size ? '' : 'disabled'}>Test ${sel.size} area${sel.size === 1 ? '' : 's'} →</button>`);
  }
  const onClick = e => {
    const b = e.target.closest('[data-k],[data-x]'); if (!b) return;
    if (b.dataset.k) { sel.has(b.dataset.k) ? sel.delete(b.dataset.k) : sel.add(b.dataset.k); return render(); }
    if (b.dataset.x === 'discard') { setDraft(null); return navigate('#/reassess'); }
    if (b.dataset.x === 'go' && sel.size) {
      const keys = DOMAINS.map(d => d.key).filter(k => sel.has(k));
      const copy = normalize(JSON.parse(JSON.stringify(p)));
      keys.forEach(k => { const ds = copy.assessment.domains[k]; if (ds) delete ds.continued; });
      setDraft({ keys, dIdx: 0, assessment: copy.assessment, repertoire: copy.repertoire });
      navigate('#/reassess/run');
    }
  };
  root.addEventListener('click', onClick); Shell.actionBar.addEventListener('click', onClick);
  render();
  return () => { root.removeEventListener('click', onClick); Shell.actionBar.removeEventListener('click', onClick); Shell.actions(''); };
}

export function mountReassessRun(root, { navigate }) {
  const d = getDraft();
  if (!d) { navigate('#/reassess'); return () => {}; }
  const work = normalize(JSON.parse(JSON.stringify(Store.profile)));
  work.assessment = d.assessment; work.repertoire = d.repertoire || work.repertoire;
  return mountAssessment(root, work, {
    only: d.keys, startDomain: d.dIdx || 0, continueMode: true, maxTests: 6,
    persist: dIdx => setDraft({ keys: d.keys, dIdx, assessment: work.assessment, repertoire: work.repertoire }),
    onBack: () => navigate('#/reassess'),
    onDone: () => {
      const p = Store.profile;
      const before = Object.fromEntries(DOMAINS.map(x => [x.key, p.domains[x.key] ? p.domains[x.key].level : null]));
      Object.values(work.assessment.domains).forEach(ds => { delete ds.continued; });
      p.assessment = work.assessment; p.assessment.date = work.assessment.date;
      if (d.keys.includes('repertoire')) p.repertoire = work.repertoire.filter(s => s.title && s.title.trim());
      rebuildProfile(p, 'Assessment update');
      const changes = DOMAINS.filter(x => before[x.key] != null && p.domains[x.key] && p.domains[x.key].level !== before[x.key])
        .map(x => ({ name: x.name, from: before[x.key], to: p.domains[x.key].level }));
      p.levelHistory.push(...changes.map(c => ({ date: p.meta.updated, domain: c.name, from: c.from, to: c.to, source: 'assessment' })));
      Store.save(); setDraft(null);
      try { sessionStorage.setItem('fretworkCoach.flash', changes.length ? `Levels updated: ${describeChanges(changes)}. New exercises now start at matching tempos.` : 'Assessment updated. Your levels are unchanged.'); } catch { /* ignore */ }
      navigate('#/profile');
    }
  });
}
