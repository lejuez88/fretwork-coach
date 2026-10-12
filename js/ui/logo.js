// SONYX logo: Chris's artwork (img/sonyx-pick.png, img/sonyx-wordmark.png, white on
// transparent) used as a stencil (CSS mask) and filled with the active scheme's colors,
// so the exact artwork recolors with whichever scheme is chosen in Settings.
// Metallic finish from the branding sheet in the scheme's colors (see .sx-pick / .sx-word in css/theme.css).
const PICK_PNG = 'img/sonyx-pick.png';

/** The SONYX wordmark. */
export const wordmark = (cls = '') => `<span class="sx-word ${cls}" role="img" aria-label="SONYX"></span>`;
/** The SONYX pick mark. */
export const pickMark = (cls = '') => `<span class="sx-pick ${cls}" aria-hidden="true"></span>`;
/** Pick + wordmark, as used in the header and the drawer. */
export const logoHTML = (cls = '') => `${pickMark(cls)}${wordmark(cls)}`;

/** Favicon in the active scheme (browsers can't read CSS variables from a favicon, so it's painted on a canvas). */
let pickImg = null;
/** Mix hex color a toward b; w = share of a (0–1). */
function mix(a, b, w) {
  const h = c => { c = c.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16)); };
  try { const A = h(a), B = h(b); return '#' + A.map((v, i) => Math.round(v * w + B[i] * (1 - w)).toString(16).padStart(2, '0')).join(''); } catch { return a; }
}
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
    const g = a.createLinearGradient(0, oy, 0, oy + h);
    g.addColorStop(0, mix(top, '#ffffff', .55)); g.addColorStop(.14, top); g.addColorStop(.34, mid); g.addColorStop(.52, bot); g.addColorStop(.6, mid); g.addColorStop(1, mix(bot, '#000000', .75));
    a.fillStyle = g; a.fillRect(0, 0, 64, 64);
    // sheen: darker left, brighter right (as on the branding sheet)
    const sh = a.createLinearGradient(0, 0, 64, 0); sh.addColorStop(0, 'rgba(0,0,0,.22)'); sh.addColorStop(.45, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(255,255,255,.22)');
    a.globalCompositeOperation = 'source-atop'; a.fillStyle = sh; a.fillRect(0, 0, 64, 64);
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
