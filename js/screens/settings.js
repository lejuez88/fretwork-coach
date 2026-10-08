// Settings: Claude API key + model, optional YouTube key, audio, images,
// data import/export, reset. Keys live only in this browser, never in exports.
import { esc, toast } from '../core/util.js';
import { Store } from '../core/store.js';
import { Claude, MODELS } from '../core/claude.js';
import { Wiki } from '../core/wiki.js';
import { exportProfile } from './profile.js';
import { getKey as ytGetKey, setKey as ytSetKey, testKey as ytTestKey } from '../core/youtube.js';
import { mountAudioSetup } from '../ui/audiosetup.js';
import { importBlockHTML, wireImport } from '../ui/importui.js';
import { periodFor, summarize, billingDay, setBillingDay, clearUsage, priceFor, fmtUSD, fmtTokens, FEATURE_LABEL, PRICES_AS_OF } from '../core/usage.js';

export function mountSettings(root, { navigate, applySettings }) {
  const p = Store.profile;
  const key = Claude.getKey();
  const ytKey = ytGetKey();
  const site = location.origin && location.origin !== 'null' ? location.origin + '/*' : 'https://lejuez88.github.io/*';
  root.innerHTML = `
    ${Store.draft.get() ? '<a class="link" href="#/onboarding">← Back to setup</a>' : (!p ? '<a class="link" href="#/welcome">← Back</a>' : '')}
    <h1>Settings</h1>
    <section class="card">
      <h3>Claude</h3>
      <p class="muted small">Claude identifies guitarists, writes your course plans and song lessons, creates exercises from your requests, recommends songs, helps with hard parts of a tab, and reviews your playing. Your key is stored only in this browser and is never included in profile exports. Usage is billed to your Anthropic account.</p>
      <div class="field"><label>Anthropic API key</label>
        <div class="row nowrap"><input type="password" data-r="key" placeholder="sk-ant-…" value="${esc(key)}" autocomplete="off" spellcheck="false"><button class="btn" data-s="show">Show</button></div></div>
      <div class="field"><label>Model</label><select data-r="model">${MODELS.map(m => `<option value="${m.id}" ${p && p.settings.model === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></div>
      <div class="row"><button class="btn primary" data-s="save">Save key</button><button class="btn" data-s="test">Test connection</button></div>
      <p class="small" data-r="status">${key ? 'A key is saved.' : 'No key saved yet. Get one at console.anthropic.com.'}</p>
    </section>
    <section class="card" data-r="spend"></section>
    <section class="card">
      <h3>YouTube (optional)</h3>
      <p class="muted small">Track of the Day plays each track from YouTube. Without a key, the app finds videos through Wikidata, which lists official videos for many well-known songs, and skips to another track when it can't find one. Add a free YouTube Data API key and the app can search YouTube for any track, favoring the artist's own uploads. The key is stored only in this browser and is never included in profile exports.</p>
      <div class="field"><label>YouTube Data API key</label>
        <div class="row nowrap"><input type="password" data-r="ytkey" placeholder="AIza…" value="${esc(ytKey)}" autocomplete="off" spellcheck="false"><button class="btn" data-s="ytshow">Show</button></div></div>
      <div class="row"><button class="btn primary" data-s="ytsave">Save key</button><button class="btn" data-s="yttest">Test key</button></div>
      <p class="small" data-r="ytstatus">${ytKey ? 'A YouTube key is saved.' : 'No YouTube key saved. Track of the Day still works through Wikidata.'}</p>
      <details class="small ytkey-help"><summary>How to get a free key (about 5 minutes)</summary>
        <ol>
          <li>Open <a class="link" href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> and create a project (any name).</li>
          <li>Go to APIs &amp; Services → Library, find <b>YouTube Data API v3</b> and click Enable.</li>
          <li>Go to APIs &amp; Services → Credentials → Create credentials → API key.</li>
          <li>Edit the key. Under Application restrictions choose <b>Websites</b> and add <code>${esc(site)}</code>. Under API restrictions choose <b>YouTube Data API v3</b>. Save.</li>
          <li>Paste the key above and tap Save key. One track lookup uses about 100 of the 10,000 free daily units, and each track is looked up only once.</li>
        </ol>
      </details>
    </section>
    ${p ? `<section class="card"><h3>Audio input & output</h3><p class="muted small">Used by the tuner and playing evaluations. Pick your audio interface (e.g. a Focusrite Scarlett), amp/pedal USB, or microphone.</p><div data-r="audio"></div></section>` : ''}
    ${p ? `<section class="card">
      <h3>Display</h3>
      <label class="switch"><input type="checkbox" data-r="wiki" ${p.settings.wikiImages ? 'checked' : ''}> Load artist, song and genre photos from Wikipedia</label>
    </section>` : ''}
    <section class="card">
      <h3>Your data</h3>
      <p class="muted small">Everything is saved in this browser. Export a backup now and then, and to move to another device.</p>
      ${p ? '<button class="btn block" data-s="export">Export profile (JSON)</button>' : ''}
      ${importBlockHTML({ label: 'Import profile (JSON)', btnClass: 'btn block' })}
      ${p ? '<button class="btn ghost block danger" data-s="reset">Delete profile from this browser</button>' : ''}
    </section>
    <section class="card">
      <h3>About this version</h3>
      <p class="small">Fretwork Coach · Phase D. Included: onboarding and continuable assessment, dashboard, course plans with progress trees, timed routines with tempo ladders and level-matched tempos, exercises from your own requests, songs with recommendations, one-day song lessons, tab import with section looping and help, audio and video evaluation with Claude coaching, tuner, metronome, tab player with pick directions, chord glossary with chord finder, style-specific course plans, Track of the Day with YouTube playback.</p>
    </section>`;
  const r = n => root.querySelector(`[data-r="${n}"]`);
  const status = (msg, cls = '') => { r('status').textContent = msg; r('status').className = 'small ' + cls; };
  const ytStatus = (msg, cls = '') => { r('ytstatus').textContent = msg; r('ytstatus').className = 'small ' + cls; };

  /** Claude API spend for the current billing period (from the app's own usage ledger). */
  function renderSpend() {
    const per = periodFor(), prev = periodFor(new Date(per.start.getTime() - 86400000));
    const cur = summarize(per), last = summarize(prev);
    const day = billingDay();
    const fmtD = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const lastDay = new Date(per.end.getTime() - 86400000);
    const sinceTxt = cur.since ? new Date(cur.since + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : null;
    const rows = (obj, label) => Object.entries(obj).sort((a, b) => b[1].usd - a[1].usd)
      .map(([k, x]) => `<div class="spend-row"><span class="sl">${esc(label(k))}</span><b>${fmtUSD(x.usd)}</b><span class="muted sd">${x.n} request${x.n === 1 ? '' : 's'} · ${fmtTokens(x.in + x.read + x.write)} tokens in · ${fmtTokens(x.out)} out</span></div>`).join('');
    r('spend').innerHTML = `
      <div class="sec-head"><h3>Claude API spend</h3><span class="small muted">${fmtD(per.start)} – ${fmtD(lastDay)}</span></div>
      <div class="spend-total"><b>${fmtUSD(cur.total.usd)}</b><span class="muted small">this billing period · ${cur.total.n} request${cur.total.n === 1 ? '' : 's'} · ${fmtTokens(cur.total.in + cur.total.read + cur.total.write)} tokens in · ${fmtTokens(cur.total.out)} out</span></div>
      ${cur.total.n ? `<div class="spend-sub">By feature</div><div class="spend-rows">${rows(cur.byFeature, k => FEATURE_LABEL[k] || k)}</div>
        <div class="spend-sub">By model</div><div class="spend-rows">${rows(cur.byModel, k => priceFor(k).name)}</div>` : `<p class="small muted">${sinceTxt ? 'No Claude requests yet this period.' : 'Nothing counted yet. Spend is tracked from now on, each time the app asks Claude something.'}</p>`}
      <p class="small">Last period (${fmtD(prev.start)} – ${fmtD(new Date(prev.end.getTime() - 86400000))}): <b>${fmtUSD(last.total.usd)}</b>${last.total.n ? ` · ${last.total.n} requests` : ''}</p>
      <div class="field"><label>Billing period starts on day</label>
        <select data-r="billday" style="max-width:260px">${Array.from({ length: 28 }, (_, i) => i + 1).map(d => `<option value="${d}" ${d === day ? 'selected' : ''}>${d}${d === 1 ? ' (calendar month)' : ''}</option>`).join('')}</select></div>
      <p class="muted small">Counted from the exact token usage Anthropic reports with every reply, priced at Anthropic’s published rates (${PRICES_AS_OF}), before tax. It covers Claude requests Fretwork Coach made in this browser${sinceTxt ? ` since ${sinceTxt}` : ''}; other apps, other devices and any credits or discounts aren’t included. Your official total is on the <a class="link" href="https://platform.claude.com/cost" target="_blank" rel="noopener">Cost page in the Claude Console</a>.</p>
      ${cur.since ? '<button class="btn ghost sm" data-s="clearspend">Reset spend history</button>' : ''}`;
  }
  renderSpend();

  const onClick = async e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    switch (b.dataset.s) {
      case 'show': r('key').type = r('key').type === 'password' ? 'text' : 'password'; b.textContent = r('key').type === 'password' ? 'Show' : 'Hide'; break;
      case 'save': Claude.setKey(r('key').value); if (p) { p.settings.model = r('model').value; Store.save(); } Claude.model = r('model').value; status(r('key').value ? 'Key saved.' : 'Key removed.', 'ok'); break;
      case 'test': {
        Claude.setKey(r('key').value); Claude.model = r('model').value;
        if (p) { p.settings.model = Claude.model; Store.save(); }
        status('Testing…');
        try { const t = await Claude.message({ content: 'Reply with exactly: ready', maxTokens: 10, feature: 'test' }); status(`Connected to ${Claude.model}. Reply: “${t.trim()}”`, 'ok'); renderSpend(); }
        catch (err) { status(err.message, 'bad'); }
        break;
      }
      case 'ytshow': r('ytkey').type = r('ytkey').type === 'password' ? 'text' : 'password'; b.textContent = r('ytkey').type === 'password' ? 'Show' : 'Hide'; break;
      case 'ytsave': ytSetKey(r('ytkey').value); ytStatus(r('ytkey').value.trim() ? 'YouTube key saved.' : 'YouTube key removed.', 'ok'); break;
      case 'yttest': {
        const k = r('ytkey').value.trim();
        if (!k) { ytStatus('Paste a key first.', 'bad'); break; }
        ytSetKey(k); ytStatus('Testing…');
        try { await ytTestKey(k); ytStatus('YouTube key works. Saved.', 'ok'); }
        catch (err) { ytStatus(`YouTube said: ${err.message}`, 'bad'); }
        break;
      }
      case 'clearspend': if (confirm('Clear the spend history kept in this browser? This doesn’t change anything with Anthropic.')) { clearUsage(); renderSpend(); } break;
      case 'export': exportProfile(p); break;
      case 'reset':
        if (confirm('Delete your profile, courses and practice history from this browser? Export a backup first if you want to keep it.')) { Store.reset(); navigate('#/welcome'); }
        break;
    }
  };
  const onChange = e => {
    if (e.target.dataset.r === 'billday') { setBillingDay(e.target.value); renderSpend(); return; }
    if (e.target.dataset.r === 'wiki') { p.settings.wikiImages = e.target.checked; Wiki.enabled = e.target.checked; Store.save(); }
  };
  root.addEventListener('click', onClick); root.addEventListener('change', onChange);
  const audioSlot = root.querySelector('[data-r="audio"]');
  const offAudio = audioSlot ? mountAudioSetup(audioSlot, { profile: p }) : null;
  const offImport = wireImport(root, {
    onDone: (prof) => { if (applySettings) applySettings(); setTimeout(() => navigate(Object.keys(prof.domains || {}).length ? '#/home' : '#/onboarding'), 900); }
  });
  return () => { if (offAudio) offAudio(); offImport(); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); };
}
