// Course records and auto-generated, unique course names. Phase B attaches a
// full lesson tree to each course; Phase A creates the course shell, its name,
// difficulty and style focus.
import { uid, today, pick } from './util.js';
import { Claude } from './claude.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { DOMAINS } from '../assessment/engine.js';

export const LEVEL_TIERS = [
  [2, 'Foundations'], [4, 'Builder'], [6, 'Workshop'], [8, 'Mastery'], [10, 'Virtuoso']
];
export const tierName = lvl => LEVEL_TIERS.find(([max]) => lvl <= max)[1];

/** Average level of the domains a genre emphasizes (falls back to overall). */
export function suggestedDifficulty(profile, genreId) {
  const g = GENRE_BY_ID[genreId], d = profile.domains || {};
  const keys = g ? g.focus : DOMAINS.map(x => x.key);
  const vals = keys.map(k => d[k] && d[k].level).filter(Boolean);
  if (!vals.length) return 3;
  return Math.max(1, Math.min(10, Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)));
}

function localName(genre, style, difficulty, players, existing) {
  const tier = tierName(difficulty);
  const base = `${style} ${tier}`;
  const candidates = [base, ...players.map(p => `${base}: The ${p.split(' ').pop()} Path`), `${style}: ${tier} Sessions`, `${genre.name} ${tier}: ${style}`];
  return candidates.find(c => !existing.has(c.toLowerCase())) || `${base} ${existing.size + 1}`;
}

/**
 * Create a course. Uses Claude for a distinctive name when a key is set,
 * otherwise a deterministic local name. Names are unique per profile.
 */
export async function createCourse(profile, { genreId, style, difficulty, players = [] }) {
  const genre = GENRE_BY_ID[genreId] || { id: genreId, name: genreId, styles: [] };
  style = style || pick(genre.styles || ['Core Skills']);
  difficulty = difficulty || suggestedDifficulty(profile, genreId);
  const existing = new Set(profile.courses.map(c => c.name.toLowerCase()));
  let name = null, tagline = '';
  if (Claude.hasKey()) {
    try {
      const r = await Claude.json({
        system: 'You name guitar courses for a practice app. Names are short, vivid and specific to the style and level.',
        content: `Create a course name.
Genre: ${genre.name}. Style focus: ${style}. Difficulty: ${difficulty}/10 (${tierName(difficulty)}).
Inspired by: ${players.join(', ') || 'none specified'}.
Existing course names to avoid: ${JSON.stringify([...existing])}.
Rules: 2–5 words, no quotes or emoji, evocative but clear about the style, signal the level (e.g. "Foundations", "Mastery") or imply it.
Return {"name": string, "tagline": string (max 12 words: what the course builds)}.`,
        maxTokens: 200
      });
      if (r && r.name && !existing.has(String(r.name).toLowerCase())) { name = String(r.name).slice(0, 60); tagline = String(r.tagline || '').slice(0, 120); }
    } catch { /* fall back to local naming */ }
  }
  if (!name) name = localName(genre, style, difficulty, players, existing);
  const course = {
    id: uid(), name, tagline: tagline || `${style} for ${genre.name.toLowerCase()} at ${tierName(difficulty).toLowerCase()} level.`,
    genre: genre.id, style, players, difficulty, levelLabel: tierName(difficulty),
    createdAt: today(), status: 'open', progress: 0,
    tree: null,        // Phase B: generated skill tree {nodes:[], edges:[]}
    lessons: [],       // Phase B: lesson records
    lastPracticed: null
  };
  profile.courses.push(course);
  return course;
}

/** Starter courses from the onboarding genres (max 2). */
export async function createStarterCourses(profile) {
  if (profile.courses.length) return [];
  const q = profile.questionnaire;
  const genres = q.genres.slice(0, 2);
  if (!genres.length) genres.push('rock');
  const made = [];
  for (const g of genres) {
    const players = q.players.filter(p => (p.genres || []).includes(g)).map(p => p.name).slice(0, 3);
    made.push(await createCourse(profile, { genreId: g, players }));
  }
  return made;
}
