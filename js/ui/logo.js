// SONYX logo: Chris's artwork (img/sonyx-pick.png, img/sonyx-wordmark.png) with the finish
// from his branding sheet, rendered for each color scheme by tools/build-logo.py
// (img/logo/word-N.png, pick-N.png). css/theme.css shows the one for the active scheme.

/** The SONYX wordmark. */
export const wordmark = (cls = '') => `<span class="sx-word ${cls}" role="img" aria-label="SONYX"></span>`;
/** The SONYX pick mark. */
export const pickMark = (cls = '') => `<span class="sx-pick ${cls}" aria-hidden="true"></span>`;
/** Pick + wordmark, as used in the header and the drawer. */
export const logoHTML = (cls = '') => `${pickMark(cls)}${wordmark(cls)}`;

/** Favicon: the rendered pick for the active scheme on the background color. */
let pickImg = null;
export function paintFavicon() {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return;
  const cs = getComputedStyle(document.documentElement);
  const bg = (cs.getPropertyValue('--bg') || '#0b090d').trim() || '#0b090d';
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', bg);
  const n = document.documentElement.getAttribute('data-scheme') || '1';
  const draw = () => {
    let c; try { c = document.createElement('canvas'); c.width = c.height = 64; } catch { return; }
    const x = c.getContext && c.getContext('2d'); if (!x) return;
    x.fillStyle = bg; if (x.roundRect) { x.beginPath(); x.roundRect(0, 0, 64, 64, 14); x.fill(); } else x.fillRect(0, 0, 64, 64);
    const h = 52, w = h * pickImg.width / pickImg.height; x.drawImage(pickImg, (64 - w) / 2, 6, w, h);
    let l = document.querySelector('link[rel="icon"]');
    if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
    try { l.type = 'image/png'; l.href = c.toDataURL('image/png'); } catch { /* ignore */ }
  };
  pickImg = new Image(); pickImg.onload = draw; pickImg.src = `img/logo/pick-${n}.png`;
}
