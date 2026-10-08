// Illustrations for the exercise-library topics, drawn in the app's style
// (strings and frets in bone white, amber and violet accents) so they're
// crisp at any size and need no network.
const W = 'rgba(236,230,218,.6)', F = 'rgba(236,230,218,.32)', AM = '#f5a524', VI = '#b9a6ef', INK = '#1b1205';
const svg = body => `<svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">${body}</svg>`;
const dot = (x, y, n, c = AM, r = 6.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>${n != null ? `<text x="${x}" y="${y + 3.4}" text-anchor="middle" font-size="9.5" font-weight="700" font-family="Inter,system-ui,sans-serif" fill="${INK}">${n}</text>` : ''}`;
const hLines = (ys, x1, x2, stroke = W, w = 1.6) => ys.map(y => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${stroke}" stroke-width="${w}"/>`).join('');
const vLines = (xs, y1, y2, stroke = F, w = 2) => xs.map(x => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${stroke}" stroke-width="${w}"/>`).join('');

export const TOPIC_ART = {
  // Spider: one finger per fret, climbing across the strings
  warmup: svg(`${hLines([20, 33, 46, 59], 10, 74)}<rect x="9" y="15" width="4" height="49" rx="1" fill="#ece6da"/>${vLines([29, 45, 61], 15, 64)}
    <path d="M21 59 L37 46 L53 33 L68 20" stroke="${AM}" stroke-width="2" stroke-dasharray="3 3" fill="none" opacity=".75"/>
    ${dot(21, 59, 1)}${dot(37, 46, 2)}${dot(53, 33, 3)}${dot(68, 20, 4)}`),
  // A pick with down and up strokes
  picking: svg(`<path d="M34 16 C48 16 57 23 55 34 C53 47 43 59 34 66 C25 59 15 47 13 34 C11 23 20 16 34 16Z" fill="${AM}" stroke="#c47f0e" stroke-width="2"/>
    <path d="M34 22 C43 22 49 27 48 34" stroke="rgba(255,255,255,.45)" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M62 18 v-6 h10 v6" stroke="#ece6da" stroke-width="2.4" fill="none" stroke-linejoin="round"/>
    <path d="M62 30 l5 9 l5 -9" stroke="#ece6da" stroke-width="2.4" fill="none" stroke-linejoin="round"/>
    <path d="M61 50 q6 6 0 12 M67 47 q8 9 0 18" stroke="${VI}" stroke-width="2" fill="none" stroke-linecap="round"/>`),
  // Tab bend arrow and vibrato on a fretted string
  fretting: svg(`${hLines([24, 58], 6, 76)}${vLines([20, 42, 64], 16, 66)}
    ${dot(31, 58, null, AM, 5.5)}<path d="M31 58 C42 58 47 50 47 30" stroke="${AM}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M41 33 L47 23 L53 33" fill="${AM}"/>
    <path d="M52 16 q3 -5 6 0 t6 0 t6 0" stroke="${VI}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`),
  // Chord box: C major
  chords: svg(`<rect x="17" y="17" width="46" height="4" rx="1" fill="#ece6da"/>
    ${vLines([19, 27.6, 36.2, 44.8, 53.4, 62], 19, 68, W, 1.5)}${hLines([31, 43, 55, 67], 19, 62, F, 2)}
    <path d="M15.5 6 l7 7 M22.5 6 l-7 7" stroke="#ff8a80" stroke-width="2" stroke-linecap="round"/>
    <circle cx="44.8" cy="10" r="3.6" stroke="#ece6da" stroke-width="1.8" fill="none"/><circle cx="62" cy="10" r="3.6" stroke="#ece6da" stroke-width="1.8" fill="none"/>
    ${dot(27.6, 49, null, AM)}${dot(36.2, 37, null, VI)}${dot(53.4, 25, null, VI)}`),
  // Metronome and beamed 8th notes
  rhythm: svg(`<path d="M10 68 L18 14 L30 14 L38 68 Z" fill="rgba(236,230,218,.12)" stroke="#ece6da" stroke-width="2" stroke-linejoin="round"/>
    <line x1="24" y1="60" x2="33" y2="22" stroke="${AM}" stroke-width="2.4" stroke-linecap="round"/><rect x="27" y="34" width="7" height="5" rx="1" fill="${AM}" transform="rotate(13 30 36)"/>
    <line x1="10" y1="68" x2="38" y2="68" stroke="#ece6da" stroke-width="2"/>
    <ellipse cx="50" cy="60" rx="5.5" ry="4" fill="#ece6da" transform="rotate(-20 50 60)"/><ellipse cx="66" cy="56" rx="5.5" ry="4" fill="#ece6da" transform="rotate(-20 66 56)"/>
    <line x1="55" y1="58" x2="55" y2="24" stroke="#ece6da" stroke-width="2"/><line x1="71" y1="54" x2="71" y2="20" stroke="#ece6da" stroke-width="2"/>
    <path d="M55 24 L71 20 L71 26 L55 30 Z" fill="${VI}"/>`),
  // Minor pentatonic box with roots highlighted
  scales: svg(`${hLines([12, 23, 34, 45, 56, 67], 8, 76, W, 1.3)}<rect x="7" y="9" width="3.5" height="61" rx="1" fill="#ece6da"/>${vLines([26, 44, 62], 9, 70)}
    ${[[12, 17, 1], [12, 53, 0], [23, 17, 0], [23, 53, 0], [34, 17, 0], [34, 35, 1], [45, 17, 0], [45, 35, 0], [56, 17, 0], [56, 35, 0], [67, 17, 1], [67, 53, 0]].map(([y, x, r]) => dot(x, y, null, r ? AM : VI, r ? 5.2 : 4.4)).join('')}`),
  // Twelve notes in a ring; one chord (a triad) drawn inside
  theory: svg(`<circle cx="40" cy="40" r="27" stroke="rgba(236,230,218,.35)" stroke-width="2" fill="none"/>
    ${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${(40 + Math.cos(a) * 27).toFixed(1)}" cy="${(40 + Math.sin(a) * 27).toFixed(1)}" r="${[0, 4, 7].includes(i) ? 0 : 2.6}" fill="#ece6da"/>`; }).join('')}
    ${(() => { const pt = i => { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; return [(40 + Math.cos(a) * 27).toFixed(1), (40 + Math.sin(a) * 27).toFixed(1)]; }; const [a, b, c] = [pt(0), pt(4), pt(7)];
      return `<path d="M${a} L${b} L${c} Z" fill="rgba(245,165,36,.18)" stroke="${AM}" stroke-width="2.4" stroke-linejoin="round"/>${dot(+a[0], +a[1], null, AM, 5.5)}${dot(+b[0], +b[1], null, VI, 5)}${dot(+c[0], +c[1], null, VI, 5)}`; })()}`),
  // Call and response: a phrase, then your answer
  ear: svg(`<path d="M8 12 h40 a6 6 0 0 1 6 6 v16 a6 6 0 0 1 -6 6 h-26 l-8 8 v-8 h-6 a6 6 0 0 1 -6 -6 v-16 a6 6 0 0 1 6 -6Z" fill="rgba(236,230,218,.14)" stroke="#ece6da" stroke-width="2"/>
    <ellipse cx="22" cy="31" rx="3.6" ry="2.7" fill="#ece6da"/><ellipse cx="36" cy="28" rx="3.6" ry="2.7" fill="#ece6da"/><path d="M25.4 31 V19 L39.4 16 V28" stroke="#ece6da" stroke-width="1.8" fill="none"/>
    <path d="M32 40 h38 a5 5 0 0 1 5 5 v14 a5 5 0 0 1 -5 5 h-4 v8 l-8 -8 h-26 a5 5 0 0 1 -5 -5 v-14 a5 5 0 0 1 5 -5Z" fill="rgba(245,165,36,.2)" stroke="${AM}" stroke-width="2"/>
    <path d="M36 54 q4 -8 8 0 t8 0 t8 0 t8 0" stroke="${AM}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`),
  // Artist Series: an electric guitar under a spotlight
  artist: svg(`<path d="M40 2 L22 70 L58 70 Z" fill="rgba(245,165,36,.13)"/>
    <path d="M47 8 l6 -3 l3 5 l-6 3 Z" fill="#ece6da"/><rect x="43.5" y="11" width="5" height="30" rx="1.5" transform="rotate(14 46 26)" fill="#ece6da"/>
    <path d="M30 44 C26 38 33 33 38 37 C41 34 47 34 47 39 C52 40 54 47 49 51 C52 57 46 64 39 61 C34 66 25 63 26 56 C21 54 23 46 30 44Z" fill="${AM}" stroke="#c47f0e" stroke-width="1.6"/>
    <rect x="31" y="47" width="11" height="3" rx="1" fill="${INK}" opacity=".55" transform="rotate(14 36 48)"/><rect x="29" y="53" width="11" height="3" rx="1" fill="${INK}" opacity=".55" transform="rotate(14 34 54)"/>
    <circle cx="44" cy="56" r="2" fill="${VI}"/><path d="M14 18 l3 -6 l3 6 l6 1 l-5 4 l2 6 l-6 -3 l-6 3 l2 -6 l-5 -4 Z" fill="${VI}" opacity=".85"/>`)
};
export const TOPIC_HUE = { warmup: 20, picking: 35, fretting: 350, chords: 265, rhythm: 190, scales: 145, theory: 225, ear: 305, artist: 45 };
