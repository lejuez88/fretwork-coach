// Import controls shared by the welcome screen and Settings: pick a file (any
// file type is allowed, because phones often mislabel .json files and grey them
// out), or paste the profile text when the file picker won't cooperate.
import { esc, toast } from '../core/util.js';
import { Store } from '../core/store.js';
import { parseProfileText, readFileText, saveImported, describeProfile, MAX_BYTES } from '../core/importer.js';

export function importBlockHTML({ label = 'Import profile', btnClass = 'btn block' } = {}) {
  return `<div class="impblock">
      <label class="${btnClass} filebtn">${esc(label)}<input type="file" data-imp="file" aria-label="${esc(label)}"></label>
      <details class="pasteimp"><summary>Can’t pick the file? Paste it instead</summary>
        <p class="muted small">Open your exported profile (.json) in any text or notes app, select all, copy, and paste it here.</p>
        <textarea data-imp="text" rows="5" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder='{ "schema": "fretwork-coach-profile", … }'></textarea>
        <button class="btn block" data-imp="paste">Import pasted profile</button>
      </details>
      <p class="small imp-status" data-imp="status" role="status" aria-live="polite"></p>
    </div>`;
}

/**
 * Wire the controls inside `root`. onDone(profile, saved) runs after a
 * successful import. Asks before replacing a profile that already exists.
 */
export function wireImport(root, { onDone } = {}) {
  let busy = false;
  const status = (msg, cls = '') => {
    const el = root.querySelector('[data-imp="status"]'); if (!el) return;
    el.textContent = msg; el.className = 'small imp-status ' + cls;
  };

  async function run(getText) {
    if (busy) return; busy = true;
    status('Importing…');
    try {
      const data = parseProfileText(await getText());
      const cur = Store.profile;
      if (cur && Object.keys(cur.domains || {}).length) {
        const msg = `Replace the profile in this browser?\n\nNow: ${describeProfile(cur)}\nImport: ${describeProfile(data)}\n\nExport a backup first if you want to keep the current one.`;
        if (!confirm(msg)) { status('Import cancelled. Nothing changed.'); return; }
      }
      const { profile, saved } = saveImported(data);
      if (saved) {
        status(`Imported ${describeProfile(profile)}.`, 'ok'); toast('Profile imported.');
        if (onDone) onDone(profile, saved);
      } else {
        // Stay here so the warning is read before moving on.
        status('Imported, but this browser wouldn’t save it, so it will be gone when you close this tab. Storage for this site may be full, or blocked (private browsing does this). Try a normal (non-private) window, or another browser.', 'bad');
        const el = root.querySelector('[data-imp="status"]');
        if (el && onDone) {
          const go = document.createElement('button'); go.className = 'btn sm'; go.textContent = 'Continue for this session';
          go.style.marginTop = '8px'; go.addEventListener('click', () => onDone(profile, saved));
          el.appendChild(document.createElement('br')); el.appendChild(go);
        }
      }
    } catch (e) {
      status(e.message || String(e), 'bad');
      toast('Import failed. See the message under the button.', 4000);
    } finally { busy = false; }
  }

  const onChange = e => {
    const inp = e.target; if (!inp || inp.dataset.imp !== 'file') return;
    const file = inp.files && inp.files[0];
    inp.value = ''; // so picking the same file again still triggers an import
    if (!file) return;
    if (file.size > MAX_BYTES) { status('That file is too big to be a profile export.', 'bad'); return; }
    run(() => readFileText(file));
  };
  const onClick = e => {
    const b = e.target.closest('[data-imp="paste"]'); if (!b || !root.contains(b)) return;
    const ta = root.querySelector('[data-imp="text"]');
    if (!ta || !ta.value.trim()) { status('Paste the profile text first.', 'bad'); return; }
    run(async () => ta.value);
  };
  root.addEventListener('change', onChange);
  root.addEventListener('click', onClick);
  return () => { root.removeEventListener('change', onChange); root.removeEventListener('click', onClick); };
}
