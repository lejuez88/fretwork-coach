// Artist Series: John Petrucci. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
// Built technique-first (CONTENT.md): his signature techniques are complete learning paths (sweepPicking, sweepChanges,
// alternatePicking, legato, palmMuting, oddTime) drawn here with PU; the closing unit holds the only lessons of his own:
// an original eight-bar study that joins the textures, and soloing over his kind of harmony.
import { make, S, U, PU, artist, targetGuide } from '../lib.js';
import sweepPicking from '../kb/sweepPicking.js';
import sweepChanges from '../kb/sweepChanges.js';
import alternatePicking from '../kb/alternatePicking.js';
import legato from '../kb/legato.js';
import palmMuting from '../kb/palmMuting.js';
import oddTime from '../kb/oddTime.js';

/** A lesson of a path, built for `c`, found by its id (the path's own generator, so the notes are its notes). */
function lessonOf(e, id, c) {
  for (const st of e.stages) for (const sk of st.skills) for (const g of sk.ex) {
    if (typeof g !== 'function') continue;
    const x = g({ ...c, lvl: Math.max(st.levels[0], Math.min(st.levels[1], c.lvl || st.levels[0])) });
    if (x && x.id === id) return x;
  }
  return null;
}
/** The first `beats` beats of a tab's notes, moved to start at beat t0 (notes held past the cut are shortened). */
const part = (x, t0, beats) => x.tab.notes.filter(n => n.t < beats - 1e-6)
  .map(n => ({ ...n, t: +(n.t + t0).toFixed(4), d: +Math.min(n.d, beats - n.t).toFixed(4) }));

/**
 * An original 8-bar study in his style, in a minor key: two bars of sweeps through two chords (the sweep-changes
 * path), two bars of a legato run (the legato path), two bars of an alternate-picked burst (the picking path) and
 * two bars of a palm-muted riff with stops (the palm-muting path). Each section is the first eight beats of a
 * lesson of its path, joined in time, so every note is already in the key.
 */
export function jpStudy(c) {
  const cc = { ...c, lvl: Math.max(7, c.lvl || 8) };
  const a = lessonOf(sweepChanges, 'sweep-changes-5', cc), b = lessonOf(legato, 'leg-sext', cc),
    d = lessonOf(alternatePicking, 'ap-bursts', cc), e = lessonOf(palmMuting, 'pm-riff-adv', cc);
  if (!a || !b || !d || !e) return null;
  const notes = [...part(a, 0, 8), ...part(b, 8, 8), ...part(d, 16, 8), ...part(e, 24, 8)];
  return make(c, {
    id: 'jp-study', name: 'A study in his style: sweeps, legato run, picked burst, muted riff (8 bars)', domain: 'improv', method: 'transfer',
    unit: '16th notes', goal: 80, start: 50, minutes: 8, dl: 1, picking: 'alternate',
    why: 'His playing moves between textures at one steady tempo: arpeggios swept through the chords, a legato run, a burst of alternate picking, and tight palm-muted rhythm. This original study puts the four in eight bars.',
    instr: 'Bars 1–2: sweep arpeggios through two chords, one note per string, each string muted as the pick moves on. Bars 3–4: a legato run, picking only the first note of each string. Bars 5–6: an alternate-picked burst, down-up all the way. Bars 7–8: a palm-muted riff with stops. Keep the tempo the same through every change. Pass: the whole study start to finish at the goal tempo, no pause at a texture change.',
    watch: 'Slowing down for the sweeps and rushing the picked burst: the pulse stays the same.', simplify: 'Bars 1–4, then bars 5–8, then join them.',
    tab: { notes }
  });
}

export default artist({ id: 'john-petrucci', name: 'John Petrucci', wiki: ['John Petrucci'], genre: 'metal', re: /petrucci|dream theater|\bjp\b/,
  blurb: 'Progressive metal lead and rhythm: sweep arpeggios through the chords, fast alternate-picked runs, legato, tight palm-muted riffs and odd-meter grooves.',
  techniques: [{ name: 'Sweep arpeggios', path: 'sweepPicking' }, { name: 'Sweeping through chord changes', path: 'sweepChanges' }, { name: 'Fast alternate-picked runs', path: 'alternatePicking' }, { name: 'Legato runs', path: 'legato' }, { name: 'Tight palm-muted rhythm', path: 'palmMuting' }, { name: 'Odd-meter riffs', path: 'oddTime' }],
  sources: ['https://www.premierguitar.com/lessons/obsessive-progressive-john-petrucci', 'https://www.musicradar.com/totalguitar/john-petruccis-ultimate-warm-up-guest-lesson-533027', 'https://guitarworld.com/lessons/john-petrucci-practice-tips', 'https://www.bonedo.de/artikel/john-petrucci-gitarren-workshop', 'https://guitarworld.com/features/clean-sweep-mastering-sweep-arpeggios-john-petrucci', 'https://johnpetrucci.com/biography/', 'https://en.wikipedia.org/wiki/John_Petrucci'],
  bio: `John Petrucci (born 1967 in Kings Park, New York) began playing at twelve and went to Berklee College of Music, where he met bassist John Myung and drummer Mike Portnoy. The three formed Majesty, which became Dream Theater; the album Images and Words (1992) brought the progressive metal band its wide audience, and Metropolis Pt. 2: Scenes from a Memory (1999) became a landmark. He also records as a solo artist, with Liquid Tension Experiment, and has toured as a guest on Joe Satriani's G3 more than any other invited guitarist.

His playing joins speed with planning. He picks long runs with strict alternate strokes and relaxed hands, sweeps arpeggios through chord changes, plays fast legato runs with few pick strokes, locks palm-muted riffs to the drums, and often writes in odd meters and long bars. He often plays a seven-string, and in his own lessons he stresses slow, metronome-based practice, variety from day to day and listening back to recordings of yourself.

This course follows that order: sweeping, sweeping through changes, alternate picking, legato, palm muting and odd time, then closes with an eight-bar study and soloing over his kind of harmony.`,
  bands: ['Dream Theater', 'Liquid Tension Experiment'],
  ctx: { key: 4, minor: true, prog: 'minorRock' },
  units: [
    PU(sweepPicking, { title: 'Sweep arpeggios', summary: 'One note per string with the pick falling across the strings and each string muted as you leave it.' }),
    PU(sweepChanges, { title: 'Sweeping through chord changes', summary: 'Three-, four- and five-string shapes joined through a progression, minor, major and diminished.' }),
    PU(alternatePicking, { title: 'Alternate-picked runs', summary: 'Even down-up picking through scales, groups and sequences at speed, with a relaxed hand.', tiers: ['intermediate', 'advanced', 'mastery'] }),
    PU(legato, { title: 'Legato runs', summary: 'Hammer-ons and pull-offs through scale shapes with only the first note of each string picked.', tiers: ['intermediate', 'advanced', 'mastery'] }),
    PU(palmMuting, { title: 'Tight palm-muted rhythm', summary: 'Chugs, gallops, syncopation and stops locked to the click.', tiers: ['foundations', 'intermediate', 'advanced'] }),
    PU(oddTime, { title: 'Odd-meter riffs', summary: '5/4, 7/8, 9/8 and longer bars felt in groups of 2s and 3s, up to 4/4 plus 7/8.', tiers: ['intermediate', 'advanced', 'mastery'] }),
    U('Putting it together', 'An eight-bar study that joins the textures, then solos over his kind of harmony.', [
      S('jp-study', 'A study in his style', 'improv', 'Sweeps, a legato run, a picked burst and a muted riff in eight bars.', [c => jpStudy(c)]),
      S('jp-solo', 'Solos in his style', 'improv', 'Minor progressions: sweep a chord, run a scale, land on chord tones.', [
        c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Over a minor progression: a fast run, then land on a chord tone of each chord' }),
        c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Over a Dorian vamp: legato bursts that end on a held note, then space' })])])
  ],
  riffs: [
    { title: 'Pull Me Under', artist: 'Dream Theater', note: 'Palm-muted riffing and a melodic lead break.' },
    { title: 'Under a Glass Moon', artist: 'Dream Theater', note: 'Fast lead runs of the kind this course builds.' },
    { title: 'Erotomania', artist: 'Dream Theater', note: 'An instrumental that showcases his lead playing.' },
    { title: 'Constant Motion', artist: 'Dream Theater', note: 'Heavy palm-muted riffs.' },
    { title: 'Metropolis Pt. 1: The Miracle and the Sleeper', artist: 'Dream Theater', note: 'A progressive-metal landmark for rhythm and lead.' }
  ] });
