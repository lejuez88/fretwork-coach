// Learning methods behind the lessons. Every lesson in a learning path can carry
// a `method` id; the app shows it on the lesson card and explains it on the path
// page. The evidence notes are deliberately honest: some methods are strongly
// supported in general learning research and only starting to be tested in music.
export const METHODS = {
  edge: {
    name: 'Edge-zone practice', short: 'Just beyond what you can do, with clear goals and feedback.',
    detail: 'Every lesson starts at a tempo you can play cleanly and climbs toward a goal, aiming for 70–85% clean attempts: hard enough to stretch, easy enough to stay accurate.',
    source: 'Ericsson, Krampe & Tesch-Römer (1993), Psychological Review: deliberate practice.', strength: 'Strong for skill development in general; the 70–85% target is a coaching rule of thumb.'
  },
  'accurate-reps': {
    name: 'Accurate repetitions', short: 'Clean reps count; sloppy ones don’t.',
    detail: 'Slow down until it is clean, then speed up. The pass criteria count clean repetitions in a row, not minutes spent.',
    source: 'Duke, Simmons & Cash (2009), Journal of Research in Music Education: pianists’ share of accurate run-throughs predicted next-day performance; total practice time did not.', strength: 'Music-specific; correlational, small sample.'
  },
  chunking: {
    name: 'Chunking', short: 'Learn small pieces, then join them.',
    detail: 'Shapes are learned two strings at a time, phrases a few notes at a time, then combined. The hard spot gets isolated and repaired instead of replaying the whole thing.',
    source: 'Duke, Simmons & Cash (2009): the best pianists isolated and fixed the precise spot where errors happened.', strength: 'Music-specific observation; consistent with motor-learning research on sequence chunking.'
  },
  retrieval: {
    name: 'Retrieval practice', short: 'Pull it from memory instead of reading it.',
    detail: 'Find the roots without looking, call out scale degrees, play a box in a key you name on the spot. Recalling strengthens memory more than re-reading.',
    source: 'Roediger & Karpicke (2006), Psychological Science: the testing effect.', strength: 'Strong for knowledge (like fretboard and theory); tested mostly outside music.'
  },
  interleaving: {
    name: 'Interleaving', short: 'Mix keys, positions and patterns instead of repeating one.',
    detail: 'Switching key or box every bar feels harder and less fluent, which is the point: it trains you to find the shape anywhere, the way real playing demands.',
    source: 'Carter & Grahn (2016), Frontiers in Psychology: clarinetists improved as much or more with interleaved practice (small study, mixed across raters); Shea & Morgan (1979): contextual interference in motor learning.', strength: 'Strong in motor learning; promising but limited in music.'
  },
  variable: {
    name: 'Variable practice', short: 'The same idea in many forms.',
    detail: 'One scale, played in different sequences, rhythms, positions and string sets, builds a flexible skill instead of one memorized pattern.',
    source: 'Schmidt (1975), schema theory of motor learning; contextual interference research.', strength: 'Well supported in motor learning.'
  },
  spacing: {
    name: 'Spaced review', short: 'Come back after a gap, before it fades.',
    detail: 'Mastered lessons come back in your daily lessons after 2, 4, 8, 16 and 30 days, each time a little harder.',
    source: 'Cepeda et al. (2006), Psychological Bulletin: meta-analysis of distributed practice.', strength: 'Very strong for memory; well supported for motor skills.'
  },
  'external-focus': {
    name: 'Focus on the sound', short: 'Aim at the result you hear, not at your fingers.',
    detail: 'Instructions point your attention at the sound (in tune, even, singing) instead of at finger movements.',
    source: 'Duke, Cash & Allen (2011), Journal of Research in Music Education: players were more accurate focusing on the sound than on their movements; Wulf (2013) review.', strength: 'Music-specific evidence plus a large motor-learning literature.'
  },
  audiation: {
    name: 'Hear it first', short: 'Sing or imagine the note before you play it.',
    detail: 'Singing the next note before you play it links the sound to the shape, the basis of playing what you hear and improvising.',
    source: 'Edwin Gordon’s Music Learning Theory (audiation).', strength: 'A widely used teaching approach; less experimental evidence than the methods above.'
  },
  transfer: {
    name: 'Use it in music', short: 'Practice in the setting where you will use it.',
    detail: 'Each stage ends with the skill inside real music: over a groove or progression, in call and response, in a short original piece.',
    source: 'Coaching principle supported by research on practice specificity: skills transfer best to settings that resemble practice.', strength: 'Reasonable consensus; not one decisive study.'
  }
};
export const METHOD_IDS = Object.keys(METHODS);
export const methodOf = id => METHODS[id] || null;
