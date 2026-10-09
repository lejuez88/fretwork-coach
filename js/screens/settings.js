// Settings: Claude API key + model, optional YouTube key, audio, images,
// data import/export, reset. Keys live only in this browser, never in exports.
import { esc, toast } from '../core/util.js';
import { Store, BUILD } from '../core/store.js';
import { Claude, MODELS } from '../core/claude.js';
import { Wiki } from '../core/wiki.js';
import { exportProfile } from './profile.js';
import { getKey as ytGetKey, setKey as ytSetKey, testKey as ytTestKey } from '../core/youtube.js';
import { cleanKey, keyProblems, fingerprint, storageAdvice, homeScreenNote, keysLink, parseKeysLink } from '../core/keys.js';
import qrcode from '../vendor/qrcode.js';
import { mountAudioSetup } from '../ui/audiosetup.js';
import { clickSoundSelectHTML } from '../ui/clicksound.js';
import { importBlockHTML, wireImport } from '../ui/importui.js';
import { saveImported, describeProfile } from '../core/importer.js';
import { driveReady, getClientId, setClientId, loadGoogle, saveToDrive, loadFromDrive, lastDriveFile } from '../core/gdrive.js';
import { cacheStats, clearCache } from '../core/lessoncache.js';
import { periodFor, summarize, billingDay, setBillingDay, clearUsage, priceFor, fmtUSD, fmtTokens, FEATURE_LABEL, PRICES_AS_OF } from '../core/usage.js';

// Keys are pasted, not typed: no auto-capitals, autocorrect or password managers
const KEY_ATTRS = 'autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" data-1p-ignore data-lpignore="true" data-form-type="other"';

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
        <div class="row nowrap"><input type="password" data-r="key" placeholder="sk-ant-…" value="${esc(key)}" ${KEY_ATTRS}><button class="btn" data-s="show">Show</button></div></div>
      <div class="field"><label>Model</label><select data-r="model">${MODELS.map(m => `<option value="${m.id}" ${p && p.settings.model === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></div>
      <div class="row"><button class="btn primary" data-s="save">Save key</button><button class="btn" data-s="test">Test connection</button></div>
      <p class="small" data-r="status">${key ? `Saved in this browser: <span class="keyfp">${esc(fingerprint(key, 'anthropic'))}</span>` : 'No key saved in this browser yet. Get one at console.anthropic.com.'}</p>
      ${homeScreenNote() ? `<p class="small muted keynote">📱 ${esc(homeScreenNote())}</p>` : ''}
    </section>
    <section class="card" data-r="spend"></section>
    <section class="card">
      <h3>YouTube (optional)</h3>
      <p class="muted small">Track of the Day plays each track from YouTube. Without a key, the app finds videos through Wikidata, which lists official videos for many well-known songs, and skips to another track when it can't find one. Add a free YouTube Data API key and the app can search YouTube for any track, favoring the artist's own uploads. The key is stored only in this browser and is never included in profile exports.</p>
      <div class="field"><label>YouTube Data API key</label>
        <div class="row nowrap"><input type="password" data-r="ytkey" placeholder="AIza…" value="${esc(ytKey)}" ${KEY_ATTRS}><button class="btn" data-s="ytshow">Show</button></div></div>
      <div class="row"><button class="btn primary" data-s="ytsave">Save key</button><button class="btn" data-s="yttest">Test key</button></div>
      <p class="small" data-r="ytstatus">${ytKey ? `Saved in this browser: <span class="keyfp">${esc(fingerprint(ytKey, 'youtube'))}</span>` : 'No YouTube key saved in this browser. Track of the Day still works through Wikidata.'}</p>
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
    <section class="card" data-r="transfer">
      <h3>Use your keys on another device</h3>
      <p class="muted small">Typing a 39- or 100-character key on a phone is easy to get wrong (I and l, O and 0 look alike). Instead, show a QR code here and scan it with your phone’s camera: the app opens on the phone and offers to save the same keys there. The keys travel inside the link itself; they never pass through a server.</p>
      <div class="row" data-r="sendrow" ${key || ytKey ? '' : 'hidden'}><button class="btn" data-s="qr">Show QR code</button><button class="btn" data-s="copylink">Copy link</button></div>
      <div class="keyqr" data-r="qr" hidden></div>
      <p class="small muted" data-r="qrnote">${key || ytKey ? 'Anyone who scans the code or gets the link can use your keys, so show it only to your own device.' : 'Save a key above first; then you can send it to your other devices from here.'}</p>
      <div class="field"><label>Got a key link from your other device? Paste it here</label>
        <div class="row nowrap"><input type="text" data-r="keylink" placeholder="https://…#/keys/…" ${KEY_ATTRS}><button class="btn" data-s="uselink">Add keys</button></div></div>
      <p class="small" data-r="linkstatus"></p>
    </section>
    ${p ? `<section class="card"><h3>Metronome sound</h3><p class="muted small">The click used by the metronome, the tab player and every lesson. Choosing one plays a bar of it.</p>${clickSoundSelectHTML()}</section>` : ''}
    ${p ? `<section class="card"><h3>Audio input & output</h3><p class="muted small">Used by the tuner and playing evaluations. Pick your audio interface (e.g. a Focusrite Scarlett), amp/pedal USB, or microphone.</p><div data-r="audio"></div></section>` : ''}
    ${p ? `<section class="card">
      <h3>Display</h3>
      <label class="switch"><input type="checkbox" data-r="wiki" ${p.settings.wikiImages ? 'checked' : ''}> Load artist, song and genre photos from Wikipedia</label>
    </section>` : ''}
    <section class="card">
      <h3>Your data</h3>
      <p class="muted small">Everything is saved in this browser. Export a backup now and then, and to move to another device.</p>
      <div class="drivebox">
        <div class="label">Google Drive</div>
        <p class="muted small">Save your profile straight to your own Google Drive, then load it on your phone (or any device) with the same Google account. Each Google account keeps its own profile; the app can only see the file it saves there.</p>
        <div class="row">${p ? '<button class="btn primary" data-s="drivesave">Save to Google Drive</button>' : ''}<button class="btn" data-s="driveload">Load from Google Drive</button></div>
        <p class="small" data-r="drivestatus">${driveStatusHTML()}</p>
        <button class="textbtn small" data-s="driveacct">Use a different Google account</button>
        <details class="small drivesetup" ${driveReady() ? '' : 'open'}><summary>Google sign-in setup ${driveReady() ? '(done)' : '(needed once)'}</summary>
          <p class="muted">The app needs a Google OAuth client ID (a public ID, not a secret) from a Google Cloud project, with <code>${esc(location.origin || 'https://lejuez88.github.io')}</code> as an authorized JavaScript origin and the Google Drive API enabled.</p>
          <div class="row nowrap"><input type="text" data-r="clientid" placeholder="…apps.googleusercontent.com" value="${esc(getClientId())}" ${KEY_ATTRS}><button class="btn" data-s="clientsave">Save</button></div>
        </details>
      </div>
      ${p ? '<button class="btn block" data-s="export">Export profile (JSON file)</button>' : ''}
      ${importBlockHTML({ label: 'Import profile (JSON)', btnClass: 'btn block' })}
      ${p ? '<button class="btn ghost block danger" data-s="reset">Delete profile from this browser</button>' : ''}
    </section>
    <section class="card">
      <h3>About this version</h3>
      <p class="small"><b>Build ${BUILD}</b>. If another device shows a different build, reload it (or close and reopen the app) to get the latest.</p>
      <p class="small">Fretwork Coach · Phase D. Included: onboarding and continuable assessment, dashboard, course plans with progress trees, timed routines with tempo ladders and level-matched tempos, exercises from your own requests, songs with recommendations, one-day song lessons, tab import with section looping and help, audio and video evaluation with Claude coaching, tuner, metronome, tab player with pick directions, chord glossary with chord finder, style-specific course plans, Track of the Day with YouTube playback.</p>
    </section>`;
  const r = n => root.querySelector(`[data-r="${n}"]`);
  let qrTimer = null;
  if (driveReady()) loadGoogle().catch(() => {}); // ready before the first tap, so sign-in can open
  const driveSay = (html, cls = '') => { r('drivestatus').innerHTML = html; r('drivestatus').className = 'small ' + cls; };
  async function driveSave(chooseAccount) {
    if (!driveReady()) { driveSay('Google sign-in isn’t set up yet: add the client ID below.', 'bad'); return; }
    driveSay('Saving to Google Drive…');
    try { Store.save(); const f = await saveToDrive(Store.profile, { chooseAccount }); driveSay(`Saved to your Drive: <a class="link" href="${esc(f.webViewLink || 'https://drive.google.com')}" target="_blank" rel="noopener">${esc(f.name || 'Fretwork Coach profile.json')}</a> · ${new Date(f.modifiedTime || Date.now()).toLocaleString()}`, 'ok'); }
    catch (err) { driveSay(esc(err.message), 'bad'); }
  }
  async function driveLoad(chooseAccount) {
    if (!driveReady()) { driveSay('Google sign-in isn’t set up yet: add the client ID below.', 'bad'); return; }
    driveSay('Loading from Google Drive…');
    try {
      const { data, file } = await loadFromDrive({ chooseAccount });
      const when = new Date(file.modifiedTime).toLocaleString();
      if (Store.profile && !confirm(`Replace the profile in this browser with the one saved in Google Drive (${when})?\n\n${describeProfile(data.questionnaire ? data : (data.profile || data))}`)) { driveSay('Kept the profile in this browser.'); return; }
      const res = saveImported(data.questionnaire ? data : (data.profile || data));
      driveSay(res.saved ? `Loaded your profile from Google Drive (saved ${esc(when)}).` : 'Loaded, but this browser couldn’t store it permanently.', res.saved ? 'ok' : 'bad');
      if (applySettings) applySettings();
      setTimeout(() => navigate(Object.keys(res.profile.domains || {}).length ? '#/home' : '#/onboarding'), 900);
    } catch (err) { driveSay(esc(err.message), 'bad'); }
  }
  const status = (msg, cls = '') => { r('status').textContent = msg; r('status').className = 'small ' + cls; };
  const ytStatus = (msg, cls = '') => { r('ytstatus').textContent = msg; r('ytstatus').className = 'small ' + cls; };
  /**
   * Save a key from its box: clean it, store it, read it back, and say exactly what
   * was saved (or why it wasn't). Returns the saved key, or null when it couldn't be kept.
   */
  function saveKey(kind) {
    const box = r(kind === 'anthropic' ? 'key' : 'ytkey'), say = kind === 'anthropic' ? status : ytStatus;
    const raw = box.value, cleaned = cleanKey(raw, kind);
    const res = kind === 'anthropic' ? Claude.setKey(raw) : ytSetKey(raw);
    if (!res.ok) { say(storageAdvice(res.reason), 'bad'); return null; }
    box.value = cleaned;
    if (!cleaned) { say(kind === 'anthropic' ? 'Key removed from this browser.' : 'YouTube key removed from this browser.', 'ok'); return ''; }
    const fixed = cleaned !== raw.trim() ? ' Removed spaces, line breaks or hidden characters that came with the paste.' : '';
    const send = r('sendrow'); if (send) send.hidden = false;
    const probs = keyProblems(cleaned, kind);
    say(`Saved in this browser: ${fingerprint(cleaned, kind)}.${fixed}${probs.length ? ' Check it: ' + probs.join(' ') : ''}`, probs.length ? 'bad' : 'ok');
    return cleaned;
  }

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
      ${cur.since ? '<button class="btn ghost sm" data-s="clearspend">Reset spend history</button>' : ''}
      ${p ? (() => { const cs = cacheStats(p); return `<div class="spend-sub">Saved lessons</div>
        <p class="small">${cs.masters} master class plan${cs.masters === 1 ? '' : 's'} and ${cs.requests} exercise answer${cs.requests === 1 ? '' : 's'} Claude designed are saved in your profile (${Math.round(cs.bytes / 1024)} KB)${cs.reused ? `, reused ${cs.reused} time${cs.reused === 1 ? '' : 's'} so far` : ''}. Asking for the same thing again, even in other words, reuses them at no cost; they travel with Export and Google Drive. Rebuilding a course always asks Claude for a new plan.</p>
        ${cs.masters + cs.requests ? '<button class="btn ghost sm" data-s="clearcache">Clear saved lessons</button>' : ''}`; })() : ''}`;
  }
  renderSpend();

  const onClick = async e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    switch (b.dataset.s) {
      case 'show': r('key').type = r('key').type === 'password' ? 'text' : 'password'; b.textContent = r('key').type === 'password' ? 'Show' : 'Hide'; break;
      case 'save': saveKey('anthropic'); if (p) { p.settings.model = r('model').value; Store.save(); } Claude.model = r('model').value; break;
      case 'test': {
        const k = saveKey('anthropic'); Claude.model = r('model').value;
        if (p) { p.settings.model = Claude.model; Store.save(); }
        if (k == null) break;
        if (!k) { status('Paste a key first.', 'bad'); break; }
        status('Testing…');
        try { const t = await Claude.message({ content: 'Reply with exactly: ready', maxTokens: 10, feature: 'test' }); status(`Connected to ${Claude.model} with ${fingerprint(k, 'anthropic')}. Reply: “${t.trim()}”`, 'ok'); renderSpend(); }
        catch (err) { status(err.message, 'bad'); }
        break;
      }
      case 'ytshow': r('ytkey').type = r('ytkey').type === 'password' ? 'text' : 'password'; b.textContent = r('ytkey').type === 'password' ? 'Show' : 'Hide'; break;
      case 'ytsave': saveKey('youtube'); break;
      case 'yttest': {
        const k = saveKey('youtube');
        if (k == null) break;
        if (!k) { ytStatus('Paste a key first.', 'bad'); break; }
        ytStatus('Testing…');
        try { await ytTestKey(k); ytStatus(`YouTube key works and is saved in this browser: ${fingerprint(k, 'youtube')}.`, 'ok'); }
        catch (err) { ytStatus(err.message, 'bad'); }
        break;
      }
      case 'qr': case 'copylink': {
        const link = keysLink({ anthropic: Claude.getKey(), youtube: ytGetKey() });
        if (b.dataset.s === 'copylink') {
          try { await navigator.clipboard.writeText(link); r('qrnote').textContent = 'Link copied. Send it to your own phone (AirDrop, or a note to yourself), open it there, and tap Save.'; }
          catch { r('qrnote').textContent = 'This browser wouldn’t copy the link. Use the QR code instead.'; }
          break;
        }
        const box = r('qr');
        if (!box.hidden) { box.hidden = true; box.innerHTML = ''; b.textContent = 'Show QR code'; break; }
        const q = qrcode(0, 'L'); q.addData(link); q.make();
        box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 4, scalable: true, title: 'Your keys for another device' }) + '<div class="small muted">Point your phone’s camera at the code and open the link it shows. Hides itself in 2 minutes.</div>';
        box.hidden = false; b.textContent = 'Hide QR code';
        clearTimeout(qrTimer); qrTimer = setTimeout(() => { if (!root.isConnected) return; box.hidden = true; box.innerHTML = ''; const qb = root.querySelector('[data-s="qr"]'); if (qb) qb.textContent = 'Show QR code'; }, 120000);
        break;
      }
      case 'uselink': {
        const keys = parseKeysLink(r('keylink').value);
        if (!keys) { r('linkstatus').textContent = 'That doesn’t look like a key link. On your other device, use Copy link above and paste the whole link here.'; r('linkstatus').className = 'small bad'; break; }
        r('keylink').value = '';
        sessionKeys = keys; navigate('#/keys');
        break;
      }
      case 'clearcache': if (confirm('Clear the saved lessons? Your courses keep their plans; only the reuse store is emptied.')) { clearCache(p); Store.save(); renderSpend(); } break;
      case 'clearspend': if (confirm('Clear the spend history kept in this browser? This doesn’t change anything with Anthropic.')) { clearUsage(); renderSpend(); } break;
      case 'export': exportProfile(p); break;
      case 'drivesave': driveSave(false); break;
      case 'driveload': driveLoad(false); break;
      case 'driveacct': (p ? driveSave : driveLoad)(true); break;
      case 'clientsave': { setClientId(r('clientid').value); if (driveReady()) { loadGoogle().catch(() => {}); driveSay('Google sign-in is set up. Tap Save or Load.', 'ok'); } else driveSay('Client ID removed.'); break; }
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
  return () => { clearTimeout(qrTimer); if (offAudio) offAudio(); offImport(); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); };
}

/* ------------------------- Keys from another device ------------------------- */
// Keys handed over by #/keys/<link> (QR code) or pasted in Settings, waiting for "Save".
let sessionKeys = null;
/** Take keys out of the address bar right away, so they don't sit in the URL or history. */
export function takeKeysFromUrl(payload) {
  const keys = parseKeysLink(payload);
  if (keys) sessionKeys = keys;
  try { history.replaceState(null, '', location.pathname + location.search + '#/keys'); } catch { /* ignore */ }
  return keys;
}
export function mountKeyImport(root, { navigate }) {
  const keys = sessionKeys;
  const note = homeScreenNote();
  if (!keys) {
    root.innerHTML = `<h1>Add keys</h1><section class="card"><p>No keys to add. On the device where your keys work, open Settings → “Use your keys on another device” and show the QR code or copy the link.</p><a class="btn block" href="#/settings">Open Settings</a></section>`;
    return () => {};
  }
  const line = (label, k, kind) => (k ? `<div class="keyline"><span>${label}</span><span class="keyfp">${esc(fingerprint(k, kind))}</span></div>` : '');
  root.innerHTML = `
    <h1>Add your keys to this device</h1>
    <section class="card">
      <p>These keys came from your other device. Saving keeps them in this browser only, like typing them into Settings.</p>
      ${line('Claude', keys.anthropic, 'anthropic')}${line('YouTube', keys.youtube, 'youtube')}
      <div class="row" style="margin-top:12px"><button class="btn primary" data-k="save">Save on this device</button><button class="btn ghost" data-k="cancel">Cancel</button></div>
      <p class="small" data-r="kstatus"></p>
      ${note ? `<p class="small muted keynote">📱 ${esc(note)}</p>` : ''}
    </section>`;
  const onClick = e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    if (b.dataset.k === 'cancel') { sessionKeys = null; navigate('#/settings'); return; }
    const results = [];
    if (keys.anthropic) results.push(Claude.setKey(keys.anthropic));
    if (keys.youtube) results.push(ytSetKey(keys.youtube));
    const bad = results.find(x => !x.ok);
    const st = root.querySelector('[data-r="kstatus"]');
    if (bad) { st.textContent = storageAdvice(bad.reason); st.className = 'small bad'; return; }
    sessionKeys = null;
    toast('Keys saved on this device. Test them below.', 3500);
    navigate('#/settings');
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}

function driveStatusHTML() {
  const f = lastDriveFile();
  if (!f) return driveReady() ? 'Not saved to Google Drive from this browser yet.' : '';
  const when = new Date(f.modifiedTime || f.savedAt || f.loadedAt).toLocaleString();
  return `Last ${f.loadedAt && !f.savedAt ? 'loaded' : 'saved'}: <a class="link" href="${esc(f.webViewLink || 'https://drive.google.com')}" target="_blank" rel="noopener">${esc(f.name || 'Fretwork Coach profile.json')}</a> · ${esc(when)}`;
}
