// The four tiers every lesson, course and path offers: Foundations, Intermediate, Advanced,
// Mastery. The player taps a tier; the app highlights the recommended one and picks
// everything inside a tier itself (the variation, the level, the tempo). Levels 1–10 stay
// underneath for progress, reviews and tempo targets, but aren't shown outside the profile.
import { TIERS, TIER_BY_ID } from '../data/lib.js';

export { TIERS, TIER_BY_ID };
const clampLvl = l => Math.max(1, Math.min(10, Math.round(+l || 1)));
/** The tier a level (1–10) falls in. */
export const tierFor = lvl => { const l = clampLvl(lvl); return TIERS.find(t => l >= t.levels[0] && l <= t.levels[1]) || TIERS[0]; };
export const tierIdFor = lvl => tierFor(lvl).id;
export const tierIndex = id => TIERS.findIndex(t => t.id === id);
/** The level to build at for a tier: your level if it's the recommended tier, else the start of the tier. */
export function levelInTier(tierId, yourLevel) {
  const t = TIER_BY_ID[tierId] || TIERS[0], l = clampLvl(yourLevel);
  return l >= t.levels[0] && l <= t.levels[1] ? l : t.levels[0];
}

/**
 * The variation of an exercise to play in a tier, chosen by the app.
 * - In the recommended tier: the recommended variation (recVid) when it's in the tier.
 * - Otherwise: the first variation of the tier you haven't mastered (lowest level first),
 *   so dropping a tier starts you at its beginning.
 * - A tier with no variation of its own uses the nearest one, with the tempo set for the
 *   tier (returned as level, for the tempo target).
 * Returns {v, level} or null.
 */
export function variationForTier(list, tierId, { recVid = null, isMastered = () => false } = {}) {
  if (!list || !list.length) return null;
  const t = TIER_BY_ID[tierId] || TIERS[0], [lo, hi] = t.levels;
  const inT = list.filter(v => v.level >= lo && v.level <= hi).sort((a, b) => a.level - b.level || (a.base ? -1 : b.base ? 1 : 0));
  if (inT.length) {
    const rec = recVid && inT.find(v => v.vid === recVid);
    if (rec) return { v: rec, level: rec.level };
    const open = inT.find(v => !isMastered(v.vid));
    const v = open || inT[0];
    return { v, level: v.level };
  }
  // nothing written for this tier: the closest variation, played at the tier's tempo
  const below = list.filter(v => v.level < lo).sort((a, b) => b.level - a.level)[0];
  const above = list.filter(v => v.level > hi).sort((a, b) => a.level - b.level)[0];
  const v = below || above;
  return { v, level: below ? lo : v.level };
}

/** The recommended tier for a list of variations: the tier of the variation the app would pick. */
export const recTierOfVariation = v => (v ? tierIdFor(v.level) : null);
