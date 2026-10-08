// Settings: Claude API key + model, images, data import/export, reset.
import { esc, toast } from '../core/util.js';
import { Store, normalize } from '../core/store.js';
import { Claude, MODELS } from '../core/claude.js';
import { Wiki } from '../core/wiki.js';
import { exportProfile } from './profile.js';
import { mountAudioSetup } from '../ui/audiosetup.js';

export function importFile(file, onDone) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data || !data.questionnaire) throw new Error('Not a Fretwork Coach profile');
      Store.replace(normalize(data)); Store.draft.clear();
      toast('Profile imported.'); onDone && onDone();
    } catch (e) { toast('Import failed: ' + e.message); }
  };
  r.readAsText(file);
}

export function mountSettings(root, { navigate }) {
  const p = Store.profile;
  const key = Claude.getKey();
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
    ${p ? `<section class="card"><h3>Audio input & output</h3><p class="muted small">Used by the tuner and playing evaluations. Pick your audio interface (e.g. a Focusrite Scarlett), amp/pedal USB, or microphone.</p><div data-r="audio"></div></section>` : ''}
    ${p ? `<section class="card">
      <h3>Display</h3>
      <label class="switch"><input type="checkbox" data-r="wiki" ${p.settings.wikiImages ? 'checked' : ''}> Load artist and album photos from Wikipedia</label>
    </section>` : ''}
    <section class="card">
      <h3>Your data</h3>
      <p class="muted small">Everything is saved in this browser. Export a backup now and then, and to move to another device.</p>
      <div class="row">${p ? '<button class="btn" data-s="export">Export profile (JSON)</button>' : ''}<label class="btn filebtn">Import profile<input type="file" accept="application/json,.json" data-r="import"></label></div>
      ${p ? '<button class="btn ghost block danger" data-s="reset">Delete profile from this browser</button>' : ''}
    </section>
    <section class="card">
      <h3>About this version</h3>
      <p class="small">Fretwork Coach · Phase D. Included: onboarding and continuable assessment, dashboard, course plans with progress trees, timed routines with tempo ladders and level-matched tempos, exercises from your own requests, songs with recommendations, one-day song lessons, tab import with section looping and help, audio and video evaluation with Claude coaching, tuner, metronome, tab player with pick directions, chord glossary with chord finder, style-specific course plans.</p>
    </section>`;
  const r = n => root.querySelector(`[data-r="${n}"]`);
  const status = (msg, cls = '') => { r('status').textContent = msg; r('status').className = 'small ' + cls; };

  const onClick = async e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    switch (b.dataset.s) {
      case 'show': r('key').type = r('key').type === 'password' ? 'text' : 'password'; b.textContent = r('key').type === 'password' ? 'Show' : 'Hide'; break;
      case 'save': Claude.setKey(r('key').value); if (p) { p.settings.model = r('model').value; Store.save(); } Claude.model = r('model').value; status(r('key').value ? 'Key saved.' : 'Key removed.', 'ok'); break;
      case 'test': {
        Claude.setKey(r('key').value); Claude.model = r('model').value;
        if (p) { p.settings.model = Claude.model; Store.save(); }
        status('Testing…');
        try { const t = await Claude.message({ content: 'Reply with exactly: ready', maxTokens: 10 }); status(`Connected to ${Claude.model}. Reply: “${t.trim()}”`, 'ok'); }
        catch (err) { status(err.message, 'bad'); }
        break;
      }
      case 'export': exportProfile(p); break;
      case 'reset':
        if (confirm('Delete your profile, courses and practice history from this browser? Export a backup first if you want to keep it.')) { Store.reset(); navigate('#/welcome'); }
        break;
    }
  };
  const onChange = e => {
    if (e.target.dataset.r === 'wiki') { p.settings.wikiImages = e.target.checked; Wiki.enabled = e.target.checked; Store.save(); }
    if (e.target.dataset.r === 'import' && e.target.files[0]) importFile(e.target.files[0], () => navigate('#/home'));
  };
  root.addEventListener('click', onClick); root.addEventListener('change', onChange);
  const audioSlot = root.querySelector('[data-r="audio"]');
  const offAudio = audioSlot ? mountAudioSetup(audioSlot, { profile: p }) : null;
  return () => { if (offAudio) offAudio(); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); };
}
