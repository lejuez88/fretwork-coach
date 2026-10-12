// SONYX logo: Chris's artwork (img/sonyx-pick.png, img/sonyx-wordmark.png, white on
// transparent) used as a stencil (CSS mask) and filled with the active scheme's colors,
// so the exact artwork recolors with whichever scheme is chosen in Settings.
// Fill: --btn-top → --accent → --accent-d, top to bottom (see .sx-pick / .sx-word in css/theme.css).
const PICK_PNG = 'img/sonyx-pick.png';

/** The SONYX wordmark. */
export const wordmark = (cls = '') => `<span class="sx-word ${cls}" role="img" aria-label="SONYX"></span>`;
/** The SONYX pick mark. */
export const pickMark = (cls = '') => `<span class="sx-pick ${cls}" aria-hidden="true"></span>`;
/** Pick + wordmark, as used in the header and the drawer. */
export const logoHTML = (cls = '') => `${pickMark(cls)}${wordmark(cls)}`;

/** Favicon in the active scheme (browsers can't read CSS variables from a favicon, so it's painted on a canvas). */
let pickImg = null;
export function paintFavicon() {
  if (typeof document === 'undefined' || !document.createElement('canvas').getContext) return;
  const cs = getComputedStyle(document.documentElement);
  const v = (k, d) => (cs.getPropertyValue(k) || d).trim() || d;
  const top = v('--btn-top', '#ffbd45'), mid = v('--accent', '#f5a524'), bot = v('--accent-d', '#d48a10'), bg = v('--bg', '#0f0d12');
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', bg);
  const draw = () => {
    let c; try { c = document.createElement('canvas'); c.width = c.height = 64; } catch { return; }
    const x = c.getContext && c.getContext('2d'); if (!x) return;
    const art = document.createElement('canvas'); art.width = art.height = 64;
    const a = art.getContext('2d'); if (!a) return;
    const h = 52, w = h * pickImg.width / pickImg.height, ox = (64 - w) / 2, oy = 6;
    a.drawImage(pickImg, ox, oy, w, h);
    a.globalCompositeOperation = 'source-in';
    const g = a.createLinearGradient(0, oy, 0, oy + h); g.addColorStop(0, top); g.addColorStop(.55, mid); g.addColorStop(1, bot);
    a.fillStyle = g; a.fillRect(0, 0, 64, 64);
    x.fillStyle = bg; if (x.roundRect) { x.beginPath(); x.roundRect(0, 0, 64, 64, 14); x.fill(); } else x.fillRect(0, 0, 64, 64);
    x.drawImage(art, 0, 0);
    let l = document.querySelector('link[rel="icon"]');
    if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
    try { l.type = 'image/png'; l.href = c.toDataURL('image/png'); } catch { /* ignore */ }
  };
  if (pickImg && pickImg.complete && pickImg.naturalWidth) { draw(); return; }
  if (typeof Image === 'undefined') return;
  pickImg = new Image(); pickImg.onload = draw; pickImg.src = PICK_PNG;
}
