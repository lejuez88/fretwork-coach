// Player Profile: radar + bars, strongest/weakest, focus, practice history
// (stats, calendar, logging practice done away from the app), edges, copyable
// profile text, JSON export/import, retake assessment.
import { esc, toast, today } from '../core/util.js';
import { Store } from '../core/store.js';
import { DOMAINS, DOMAIN_BY_KEY, Charts, ProfileText } from '../assessment/engine.js';
import { wikiTile, hydrateImages } from '../core/wiki.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { domainStatus } from './reassess.js';
import { mountPracticeHistory } from '../ui/practicehistory.js';
import { levelPill, KIND_COLORS } from '../ui/colors.js';

export function exportProfile(p) {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `player-profile-${(p.questionnaire.name || 'player').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${today()}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
export function copyText(text) {
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied.'); } catch { toast('Copy failed. Select the text manually.'); } ta.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Profile copied.'), fallback); else fallback();
}

export function mountProfile(root, { navigate, firstRun = false }) {
  const p = Store.profile, d = p.domains;
  if (!Object.keys(d).length) {
    root.innerHTML = `<h1>Player Profile</h1><section class="card"><p>No assessment yet.</p><a class="btn primary block" href="#/assessment">Take the assessment</a></section>`;
    return () => {};
  }
  const lv = Object.fromEntries(DOMAINS.map(x => [x.key, d[x.key] ? d[x.key].level : 1]));
  const sorted = [...DOMAINS].sort((a, b) => lv[b.key] - lv[a.key]);
  const top = sorted.filter(x => lv[x.key] === lv[sorted[0].key]), low = sorted.filter(x => lv[x.key] === lv[sorted[sorted.length - 1].key]);
  const q = p.questionnaire, ds = domainStatus(p);
  const open = DOMAINS.filter(x => ds[x.key].status !== 'placed' && x.key !== 'repertoire');
  let flash = null; try { flash = sessionStorage.getItem('fretworkCoach.flash'); sessionStorage.removeItem('fretworkCoach.flash'); } catch { /* ignore */ }
  if (flash) setTimeout(() => toast(flash, 5000), 50);
  root.innerHTML = `
    <div class="label">${firstRun ? 'Your results' : 'Player Profile'} · ${esc(p.meta.updated)}</div>
    <h1>${esc(q.name || 'Player')}’s Player Profile</h1>
    ${firstRun ? `<section class="card"><p>Your starter course${p.courses.length > 1 ? 's are' : ' is'} ready: ${p.courses.map(c => `<b>${esc(c.name)}</b>`).join(' and ')}.</p><a class="btn primary block" href="#/home">Go to my dashboard →</a></section>` : ''}
    ${open.length ? `<section class="card levelup"><div class="label">Assessment not finished</div>
      <p>${open.map(x => `<b>${esc(x.name)}</b>`).join(', ')} ${open.length === 1 ? 'is' : 'are'} ${open.some(x => ds[x.key].status === 'estimated') ? 'only estimated or ' : ''}stopped before the harder tests, so ${open.length === 1 ? 'that level' : 'those levels'} may be too low.</p>
      <a class="btn primary block" href="#/reassess">Continue assessment</a></section>` : ''}
    <section class="card grille">${Charts.radar(lv)}${Charts.bars(lv)}</section>
    <section class="card"><div class="kpis">
      <div class="kpi"><div class="k">Strongest</div><div class="v">${top.map(x => x.name).join(', ')} · ${lv[top[0].key]}</div></div>
      <div class="kpi"><div class="k">Weakest</div><div class="v">${low.map(x => x.name).join(', ')} · ${lv[low[0].key]}</div></div>
      <div class="kpi"><div class="k">First focus</div><div class="v">${p.focus.domain ? DOMAIN_BY_KEY[p.focus.domain].name : '—'}</div></div></div>
      <p style="margin-top:12px">${esc(p.focus.reason || '')}</p></section>
    <section class="card history" id="history" data-r="history"></section>
    ${q.players.length ? `<section class="card"><h3>Players you’re learning from</h3><div class="pcards">${q.players.map(pl => `<div class="pcard">${wikiTile(pl.wikiTitle || pl.name, pl.name, 'round sm')}<div class="pbody"><b>${esc(pl.name)}</b><div class="muted small">${esc((pl.genres || []).map(g => GENRE_BY_ID[g] ? GENRE_BY_ID[g].name : g).join(' · '))}</div><div class="small">${esc(pl.style || '')}</div></div></div>`).join('')}</div></section>` : ''}
    <section class="card edgelist"><h3>Current edges</h3>
      ${DOMAINS.map(x => { const dm = d[x.key] || {}; return `<div class="e dom-${x.key}"><div class="h"><span><span class="e-name">${x.name}</span><span class="tag">${esc(dm.basis || '')}</span></span>${levelPill(lv[x.key])}</div>
        <div class="muted small">${esc(dm.edge || '')}</div>
        ${dm.lessonNote ? `<div class="small lesson">📈 ${esc(dm.lessonNote)}${dm.assessedLevel != null && dm.assessedLevel !== dm.level ? ` Assessed ${dm.assessedLevel}, now ${dm.level} from lessons.` : ''}</div>` : ''}
        ${x.key !== 'repertoire' && ds[x.key].status !== 'placed' ? `<a class="link small" href="#/reassess/${x.key}">${ds[x.key].status === 'estimated' ? 'Test this area →' : 'Test further →'}</a>` : ''}</div>`; }).join('')}</section>
    <section class="card"><h3>Player Profile text</h3><p class="muted small">Paste this into a coaching chat.</p>
      <pre class="profile">${esc(ProfileText.render(p))}</pre>
      <button class="btn primary block" data-pf="copy">Copy profile</button></section>
    <section class="card"><h3>Manage</h3>
      <div class="row"><button class="btn" data-pf="export">Export (JSON)</button><a class="btn" href="#/settings">Import & settings</a></div>
      <div class="row" style="margin-top:10px"><a class="btn" href="#/reassess">Continue assessment</a><button class="btn" data-pf="retake">Retake everything</button><button class="btn" data-pf="edit">Edit setup answers</button></div></section>`;
  hydrateImages(root);
  const offHistory = mountPracticeHistory(root.querySelector('[data-r="history"]'), p);
  const onClick = e => {
    const b = e.target.closest('[data-pf]'); if (!b) return;
    if (b.dataset.pf === 'copy') copyText(ProfileText.render(p));
    if (b.dataset.pf === 'export') exportProfile(p);
    if (b.dataset.pf === 'retake' && confirm('Retake the full assessment? Your current levels are replaced when you finish.')) { p.assessment.domains = {}; Store.save(); navigate('#/assessment'); }
    if (b.dataset.pf === 'edit') navigate('#/onboarding');
  };
  root.addEventListener('click', onClick);
  return () => { offHistory(); root.removeEventListener('click', onClick); };
}
