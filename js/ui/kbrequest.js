// "Add it to the knowledge base?": the prompt shown when a request names a
// technique, subject, style or guitarist the app doesn't teach yet, and the
// request box on the Technique Library page with your queue and its status.
import { esc, toast } from '../core/util.js';
import { Store } from '../core/store.js';
import { REQUEST_KINDS, addRequest, removeRequest, myRequests, hasRequest, syncRequests, knowledgeGap } from '../core/kbrequests.js';

const kindName = k => (REQUEST_KINDS.find(([x]) => x === k) || [k, k])[1].toLowerCase();

/** After adding: save the profile, then write the requests file to Drive (may open Google sign-in). */
export async function saveAndSync(p) {
  Store.save();
  const r = await syncRequests(p);
  if (r.ok) toast('Added to the research queue. The next content run will pick it up.', 4200);
  else if (r.reason === 'no-drive') toast('Added to your research queue. Set up Google Drive in Settings so the content runs can see it.', 5200);
  else toast(`Added to your research queue. It will reach the content runs the next time you save to Google Drive (${r.reason}).`, 5600);
}

/** The inline question for a gap ({text, kind}); empty when there's no gap or it was already requested. */
export function gapPromptHTML(gap) {
  const p = Store.profile;
  if (!gap || !p) return '';
  if (hasRequest(p, gap.text)) return `<div class="kbgap done"><b>“${esc(gap.text)}”</b> is in your research queue: it will be researched and added as a full ${gap.kind === 'guitarist' ? 'Artist Series page' : 'learning path'}.</div>`;
  return `<div class="kbgap" data-gap-text="${esc(gap.text)}" data-gap-kind="${esc(gap.kind)}">
    <div><b>“${esc(gap.text)}”</b> isn’t in Fretwork Coach’s knowledge base yet. Add this ${esc(kindName(gap.kind))} to the research queue? It will be researched and built into the app as a ${gap.kind === 'guitarist' ? 'player page with lessons on their style' : 'full path from beginner to mastery'}.</div>
    <div class="row"><button class="btn sm primary" data-kbadd>+ Add to the knowledge base</button><button class="btn sm ghost" data-kbno>No thanks</button></div></div>`;
}
/** Click handling for gapPromptHTML; returns true when it handled the click. */
export function onGapClick(e) {
  const box = e.target.closest('.kbgap'); if (!box) return false;
  if (e.target.closest('[data-kbno]')) { box.remove(); return true; }
  if (!e.target.closest('[data-kbadd]')) return false;
  const p = Store.profile;
  const r = addRequest(p, { text: box.dataset.gapText, kind: box.dataset.gapKind, source: 'prompt' });
  if (r) { box.classList.add('done'); box.innerHTML = `<b>“${esc(r.text)}”</b> is in your research queue.`; saveAndSync(p); }
  return true;
}
/** The question for a gap in its own sheet-free check: gap for a request text (or null). */
export const gapFor = (text, kind = null) => knowledgeGap(text, kind);

/** The request box: add anything, see your queue. */
export function requestBoxHTML({ title = 'Request a topic', hint = '' } = {}) {
  const p = Store.profile, mine = myRequests(p);
  return `<h3>${esc(title)}</h3>${hint ? `<p class="small muted">${esc(hint)}</p>` : ''}
    <form class="kbreq" data-r="kbform">
      <input type="text" name="text" maxlength="80" placeholder="e.g. chicken picking, sight reading, bossa nova, Tosin Abasi" aria-label="Topic to add">
      <select name="kind" aria-label="Kind">${REQUEST_KINDS.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select>
      <button class="btn" type="submit">+ Add</button>
    </form>
    ${mine.length ? `<div class="kbqueue"><div class="label">Your requests</div>${mine.map(r => `<div class="kbq-row"><span><b>${esc(r.text)}</b> <span class="small muted">${esc(kindName(r.kind))} · ${esc(r.at)}</span></span>
      <span class="kbq-status ${r.status}">${r.status === 'added' ? '✓ Added to the app' : 'In the research queue'}</span>${r.status === 'added' ? '' : `<button class="kbtn sm" data-kbremove="${r.id}" aria-label="Remove">✕</button>`}</div>`).join('')}</div>` : ''}`;
}
/** Wire a container holding requestBoxHTML. Returns a cleanup function. */
export function wireRequestBox(el, { title, hint } = {}) {
  if (!el) return () => {};
  const p = Store.profile;
  const redraw = () => { const h = el.querySelector('h3'); el.innerHTML = requestBoxHTML({ title: title || (h ? h.textContent : undefined), hint: hint != null ? hint : (el.querySelector('p.small.muted') || {}).textContent }); };
  const onSubmit = e => {
    const f = e.target.closest('[data-r="kbform"]'); if (!f) return;
    e.preventDefault();
    const text = (f.elements.text.value || '').trim(), kind = f.elements.kind.value;
    if (text.length < 3) return toast('Name the technique, subject, style or guitarist.');
    const gap = knowledgeGap(text, kind);
    if (!gap) { toast(`Fretwork Coach already teaches that: search the library or ask for it in Practice.`, 4200); return; }
    if (hasRequest(p, gap.text)) { toast('That’s already in your research queue.'); return; }
    addRequest(p, { text: gap.text, kind, source: 'library' });
    redraw(); saveAndSync(p);
  };
  const onClick = e => {
    const rm = e.target.closest('[data-kbremove]'); if (!rm) return;
    removeRequest(p, rm.dataset.kbremove); Store.save(); redraw();
  };
  el.addEventListener('submit', onSubmit); el.addEventListener('click', onClick);
  return () => { el.removeEventListener('submit', onSubmit); el.removeEventListener('click', onClick); };
}
