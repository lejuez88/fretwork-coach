// One color language across the app: each skill area has a color (the area label on technique
// bubbles, the profile bars and radar), each kind of topic has a color (the outline of its bubble),
// and each level band has a color (the level pills): foundations 1–3, intermediate 4–6,
// advanced 7–8, mastery 9–10. The same values live in CSS as .dom-*, .kind-* and .lvl-* classes.
export const DOMAIN_COLORS = { fretting: '#ff8a7a', picking: '#f5c044', rhythm: '#6fd3a0', fretboard: '#7aa7ff', theory: '#b593ec', ear: '#5cc4e0', improv: '#ff9f4a', repertoire: '#e47ad8' };
export const KIND_COLORS = { technique: '#f5a524', subject: '#5cc4b4', style: '#e2708a' };
export const LEVEL_BANDS = [
  { id: 'found', name: 'Foundations', lo: 1, hi: 3, color: '#5cc46b' },
  { id: 'inter', name: 'Intermediate', lo: 4, hi: 6, color: '#4f9df5' },
  { id: 'adv', name: 'Advanced', lo: 7, hi: 8, color: '#a77bf0' },
  { id: 'mast', name: 'Mastery', lo: 9, hi: 10, color: '#ff6b5a' }
];
export const levelBand = lvl => LEVEL_BANDS.find(b => lvl >= b.lo && lvl <= b.hi) || LEVEL_BANDS[0];
export const domainColor = k => DOMAIN_COLORS[k] || '#a39d93';
/** A small level pill, colored by band. */
export const levelPill = (lvl, title = '') => `<span class="lvl-pill lvl-${levelBand(lvl).id}" title="${title || `Level ${lvl}: ${levelBand(lvl).name}`}">${lvl}</span>`;
/** Four small level pills (one per band: foundations, intermediate, advanced, mastery), filled in band colors up to the player's level. */
export const levelDots = (lvl, title = '') => {
  const cur = levelBand(lvl).id;
  return `<span class="lvl-dots" title="${title || `Level ${lvl}: ${levelBand(lvl).name}`}" aria-label="${title || `Level ${lvl}`}">${LEVEL_BANDS.map(b => `<i class="lvl-${b.id}${lvl >= b.lo ? ' on' : ''}${b.id === cur ? ' cur' : ''}"></i>`).join('')}</span>`;
};
