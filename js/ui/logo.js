// SONYX logo (wordmark + pick mark), drawn as inline SVG so it takes the active color
// scheme: the fill gradient uses --btn-top → --accent-d and the outline uses --accent.
// Built from the branding sheets Chris supplied (COSMETICS.md, "SONYX logo"): forward slant,
// vertically compressed letters, solid top half, hollow (outlined) lower half; the pick has a
// diagonal split with the same solid/hollow treatment.
let n = 0;

// Letter skeletons on a 40-unit-high grid; each is stroked with a thick pen (T).
const T = 9, TOP = 4.5, BOT = 35.5, MID = 20, R = 7.5;
const GLYPHS = [
  // S
  w => `M${w - 4.5} ${TOP}H${4.5 + R}Q4.5 ${TOP} 4.5 ${TOP + R}V${MID - R}Q4.5 ${MID} ${4.5 + R} ${MID}H${w - 4.5 - R}Q${w - 4.5} ${MID} ${w - 4.5} ${MID + R}V${BOT - R}Q${w - 4.5} ${BOT} ${w - 4.5 - R} ${BOT}H4.5`,
  // O
  w => `M${4.5 + R} ${TOP}H${w - 4.5 - R}Q${w - 4.5} ${TOP} ${w - 4.5} ${TOP + R}V${BOT - R}Q${w - 4.5} ${BOT} ${w - 4.5 - R} ${BOT}H${4.5 + R}Q4.5 ${BOT} 4.5 ${BOT - R}V${TOP + R}Q4.5 ${TOP} ${4.5 + R} ${TOP}Z`,
  // N
  w => `M4.5 ${BOT}V${TOP}L${w - 4.5} ${BOT}V${TOP}`,
  // Y
  w => `M4.5 ${TOP}Q4.5 ${MID} ${w / 2} ${MID}Q${w - 4.5} ${MID} ${w - 4.5} ${TOP}M${w / 2} ${MID}V${BOT}`,
  // X
  w => `M4.5 ${TOP - .5}V${TOP}L${w - 4.5} ${BOT}V${BOT + .5}M${w - 4.5} ${TOP - .5}V${TOP}L4.5 ${BOT}V${BOT + .5}`
];
const WIDTHS = [58, 60, 56, 58, 58], GAP = 9, SKEW = -18;

function wordPaths() {
  let x = 0, d = '';
  GLYPHS.forEach((g, i) => { d += `<path transform="translate(${x} 0)" d="${g(WIDTHS[i])}"/>`; x += WIDTHS[i] + GAP; });
  return { d, w: x - GAP };
}
const WORD = wordPaths();

/** The SONYX wordmark. */
export function wordmark(cls = '') {
  const id = 'sxw' + (++n), slant = Math.abs(Math.tan(SKEW * Math.PI / 180) * 40);
  const vw = Math.ceil(WORD.w + slant + 2);
  const pen = (w, color) => `<g fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="miter" stroke-miterlimit="2" stroke-linecap="square">${WORD.d}</g>`;
  return `<svg class="sx-word ${cls}" viewBox="0 -1 ${vw} 42" role="img" aria-label="SONYX">
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--btn-top)"/><stop offset="1" style="stop-color:var(--accent-d)"/></linearGradient>
    <clipPath id="${id}t"><rect x="-20" y="-10" width="${vw + 40}" height="${MID + 10}"/></clipPath>
    <clipPath id="${id}b"><rect x="-20" y="${MID}" width="${vw + 40}" height="40"/></clipPath>
    <mask id="${id}m" maskUnits="userSpaceOnUse" x="-20" y="-10" width="${vw + 40}" height="60"><g clip-path="url(#${id}b)">${pen(T, '#fff')}${pen(T - 4.4, '#000')}</g></mask>
  </defs>
  <g transform="translate(${slant + 1} 0) skewX(${SKEW})">
    <g clip-path="url(#${id}t)">${pen(T, `url(#${id}g)`)}</g>
    <rect x="-20" y="-10" width="${vw + 40}" height="60" mask="url(#${id}m)" style="fill:var(--accent)"/>
  </g></svg>`;
}

// Guitar pick on a 100 × 110 grid, split on a diagonal: solid above, hollow below.
const PICK = 'M50 105Q45 105 41 99C26 78 6 52 6 33C6 13 27 4 50 4C73 4 94 13 94 33C94 52 74 78 59 99Q55 105 50 105Z';
const CUT = 'M-5 -5H105V22L-5 60Z';
const LOW = 'M-5 60L105 22V120H-5Z';
/** The SONYX pick mark. */
export function pickMark(cls = '') {
  const id = 'sxp' + (++n);
  return `<svg class="sx-pick ${cls}" viewBox="0 0 100 110" role="img" aria-label="SONYX">
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--btn-top)"/><stop offset=".6" style="stop-color:var(--accent-d)"/></linearGradient>
    <clipPath id="${id}t"><path d="${CUT}"/></clipPath>
    <clipPath id="${id}l"><path d="${LOW}"/></clipPath>
  </defs>
  <path d="${PICK}" fill="none" style="stroke:var(--accent)" stroke-width="7" stroke-linejoin="round"/>
  <path d="${PICK}" clip-path="url(#${id}l)" transform="translate(50 47) scale(.62) translate(-50 -47)" fill="none" style="stroke:var(--accent)" stroke-width="7.5" stroke-linejoin="round"/>
  <path d="${PICK}" clip-path="url(#${id}t)" fill="url(#${id}g)" style="stroke:var(--accent)" stroke-width="7" stroke-linejoin="round"/>
  <path d="M-5 60L105 22" style="stroke:var(--bg)" stroke-width="5" clip-path="url(#${id}t)"/>
  </svg>`;
}

/** Pick + wordmark, as used in the header and the drawer. */
export function logoHTML(cls = '') { return `${pickMark()}${wordmark(cls)}`; }

/** Favicon in the active accent color (browsers can't read CSS variables from a favicon). */
export function paintFavicon() {
  const cs = getComputedStyle(document.documentElement);
  const a = (cs.getPropertyValue('--accent') || '#f5a524').trim(), t = (cs.getPropertyValue('--btn-top') || '#ffbd45').trim();
  const bg = (cs.getPropertyValue('--bg') || '#0f0d12').trim();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -6 116 122"><rect x="-8" y="-6" width="116" height="122" rx="26" fill="${bg}"/><path d="${PICK}" fill="none" stroke="${a}" stroke-width="8"/><path d="${PICK}" clip-path="url(#c)" fill="${t}" stroke="${a}" stroke-width="8"/><clipPath id="c"><path d="${CUT}"/></clipPath></svg>`;
  let l = document.querySelector('link[rel="icon"]');
  if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
  l.type = 'image/svg+xml'; l.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', bg);
}
