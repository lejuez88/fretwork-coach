// Color schemes (dark only; approved in the App Cosmetics thread). The scheme is a
// data-scheme attribute on <html>; css/theme.css holds each scheme's tokens, so the whole
// app and the SONYX logo recolor at once. Saved in the profile (so it syncs with Drive)
// and in localStorage (so it applies before the profile loads, e.g. on the welcome screen).
import { Store } from '../core/store.js';
import { paintFavicon } from './logo.js';

const KEY = 'fretworkCoach.scheme';
export const SCHEMES = [
  { id: 1, name: 'Amber Stage', note: 'Warm stage amber on near-black plum', sw: ['#0f0d12', '#221e29', '#f5a524', '#f2ede4'] },
  { id: 2, name: 'Lime Graphite', note: 'Neutral graphite, electric lime', sw: ['#0d0f10', '#1d2124', '#c6f432', '#eef1ec'] },
  { id: 3, name: 'Cobalt Night', note: 'Deep navy, cobalt blue', sw: ['#0a0e1a', '#172036', '#5b8cff', '#e8eefc'] },
  { id: 4, name: 'Studio Mono', note: 'Black and white, one red signal', sw: ['#0b0b0c', '#1c1c1e', '#ff4d3d', '#f4f4f5'] }
];
const valid = v => SCHEMES.some(s => s.id === +v);

export function currentScheme() {
  const p = Store.profile && Store.profile.settings && Store.profile.settings.scheme;
  if (valid(p)) return +p;
  try { const v = localStorage.getItem(KEY); if (valid(v)) return +v; } catch { /* ignore */ }
  return 1;
}

export function applyScheme(id = currentScheme()) {
  id = valid(id) ? +id : 1;
  if (id === 1) document.documentElement.removeAttribute('data-scheme'); else document.documentElement.setAttribute('data-scheme', String(id));
  try { localStorage.setItem(KEY, String(id)); } catch { /* ignore */ }
  paintFavicon();
}

export function setScheme(id) {
  if (Store.profile) { Store.profile.settings.scheme = +id; Store.save(); }
  applyScheme(id);
}

/** Settings card: pick one of the four dark schemes. */
export function schemePickerHTML() {
  const cur = currentScheme();
  return `<div class="scheme-pick" role="radiogroup" aria-label="Color scheme">${SCHEMES.map(s => `
    <button type="button" class="sp-opt ${s.id === cur ? 'on' : ''}" data-scheme="${s.id}" role="radio" aria-checked="${s.id === cur}">
      <span class="sp-sw" aria-hidden="true">${s.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span>
      <span class="sp-txt"><b>${s.name}${s.id === 1 ? ' <span class="small muted">(default)</span>' : ''}</b><span class="small muted">${s.note}</span></span>
    </button>`).join('')}</div>`;
}
