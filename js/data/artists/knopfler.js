// Artist Series: Mark Knopfler. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
// Built technique-first (CONTENT.md): his signature techniques are complete learning paths (fingerstyleLead, legato, doubleStops,
// bending, vibrato, phrasing) drawn here with PU; the closing unit holds the only lessons of his own: an original eight-bar study
// that joins four fingerstyle textures, and soloing over his kind of harmony.
import { make, S, U, PU, artist, targetGuide } from '../lib.js';
import fingerstyleLead from '../kb/fingerstyleLead.js';
import legato from '../kb/legato.js';
import doubleStops from '../kb/doubleStops.js';
import bending from '../kb/bending.js';
import vibrato from '../kb/vibrato.js';
import phrasing from '../kb/phrasing.js';

/** A lesson of a path, built for `c`, found by its id (the path's own generator, so the notes are its notes). */
function lessonOf(e, id, c) {
  for (const st of e.stages) for (const sk of st.skills) for (const g of sk.ex) {
    if (typeof g !== 'function') continue;
    const x = g({ ...c, lvl: Math.max(st.levels[0], Math.min(st.levels[1], c.lvl || st.levels[0])) });
    if (x && x.id === id) return x;
  }
  return null;
}
/** Beats [from, from + beats) of a tab's notes, moved to start at beat t0 (notes held past the cut are shortened). */
const part = (x, from, beats, t0) => x.tab.notes.filter(n => n.t >= from - 1e-6 && n.t < from + beats - 1e-6)
  .map(n => ({ ...n, t: +(n.t - from + t0).toFixed(4), d: +Math.min(n.d, from + beats - n.t).toFixed(4) }));

/**
 * An original 8-bar study in his style, over the four chords of the key: two bars of palm-muted thumb bass under a ringing melody,
 * two bars of pinches answered by the fingers, two bars of a 16th-note roll and two bars of quick-pluck rakes with fills. Each
 * section is two bars of one lesson of the fingerstyleLead path, so every note is already a chord tone or in the key.
 */
export function knStudy(c) {
  const cc = { ...c, lvl: Math.max(7, c.lvl || 8) };
  const a = lessonOf(fingerstyleLead, 'fl-pm-2', cc), b = lessonOf(fingerstyleLead, 'fl-pinch-2', cc),
    d = lessonOf(fingerstyleLead, 'fl-16-b', cc), e = lessonOf(fingerstyleLead, 'fl-rake-b', cc);
  if (!a || !b || !d || !e) return null;
  const notes = [...part(a, 0, 8, 0), ...part(b, 8, 8, 8), ...part(d, 0, 8, 16), ...part(e, 8, 8, 24)];
  return make(c, {
    id: 'kn-study', name: 'A study in his style: muted bass, pinches, 16th roll, rake and fill (8 bars)', domain: 'improv', method: 'transfer',
    unit: '16th notes', goal: 80, start: 50, minutes: 8, dl: 1, picking: 'fingers',
    why: 'His rhythm and lead both come from the same right hand: a thumb for the bass and fingers for everything else. This original study moves through four textures of that hand in eight bars, with no pick.',
    instr: 'Bars 1–2: palm-muted thumb under a ringing melody. Bars 3–4: pinches with the fingers answering between them. Bars 5–6: the 16th-note thumb-index-middle roll. Bars 7–8: a quick-pluck rake into a short fill. Keep the pulse the same through all four; the thumb never stops. Pass: all eight bars without a pause between textures.',
    watch: 'The thumb rushing in the roll and the fill, or the pinches landing one note late.', simplify: 'Bars 1–4, then bars 5–8, then join them.',
    backing: [...new Set([...(a.chords || []), ...(b.chords || [])])], chords: [...new Set([...(a.chords || []), ...(b.chords || [])])],
    tab: { notes }
  });
}

export default artist({ id: 'knopfler', name: 'Mark Knopfler', wiki: ['Mark Knopfler'], genre: 'rock', re: /knopfler|dire straits/,
  blurb: 'Pickless lead and rhythm: thumb and two fingers, rolls and pinches, plucked pentatonic lines with pull-offs, double-stops with wide vibrato, and phrasing that leaves space.',
  techniques: [{ name: 'Thumb-and-fingers lead and rhythm', path: 'fingerstyleLead' }, { name: 'Pull-offs and legato lines', path: 'legato' }, { name: 'Double-stops', path: 'doubleStops' }, { name: 'Bends', path: 'bending' }, { name: 'Wide vibrato', path: 'vibrato' }, { name: 'Phrasing and space', path: 'phrasing' }],
  sources: [
    'https://www.premierguitar.com/lessons/mark-knopflers-fingerstyle-finesse',
    'https://www.guitarplayer.com/players/i-was-doing-things-with-my-fingers-that-i-couldnt-do-with-a-pick-mark-knopfler-on-his-world-famous-picking-technique',
    'https://www.musicradar.com/how-to/play-guitar-like-mark-knopfler',
    'https://guitarworld.com/news/mark-knopfler-fingerpicking-style-origins',
    'https://www.musicstreet.co.uk/blogs/blog-post/how-to-play-guitar-like-mark-knopfler-technique-gear-and-signature-sound',
    'https://www.britannica.com/print/article/2123157',
    'https://en.wikipedia.org/wiki/Mark_Knopfler'
  ],
  bio: `Mark Knopfler (born 1949 in Glasgow, raised in Newcastle) was lead guitarist, singer and songwriter of Dire Straits, the band that took its name in 1977. The self-titled debut album came out in 1978, and Brothers in Arms (1985), with the hit "Money for Nothing", made the group an international success. He has continued as a solo artist since the band ended.

His playing is recognizable from the right hand. Born left-handed, he plays right-handed, and over the years he gave up the pick for lead and much rhythm work, using the thumb and first two fingers, often striking a note with thumb and second finger together. He still picks for strumming and some acoustic work. Pull-offs, rolls, double-stops with wide vibrato and short, singing phrases with plenty of space fill out the sound, mostly on a Stratocaster.

This course starts with the hand itself, the fingerstyle lead path, then adds pull-offs, double-stops, bends, vibrato and phrasing, and closes with an eight-bar study and soloing over his kind of changes.`,
  bands: ['Dire Straits'],
  ctx: { key: 2, minor: true, prog: 'minorRock' },
  units: [
    PU(fingerstyleLead, { title: 'Thumb and fingers: lead and rhythm', summary: 'From the relaxed hand and index-middle alternation to rolls, pinches, muted bass, plucked lines, 16th rolls and fingers under overdrive.' }),
    PU(legato, { title: 'Pull-offs and legato lines', summary: 'Plucked pairs and runs where the fretting hand supplies the second note.', tiers: ['foundations', 'intermediate', 'advanced'] }),
    PU(doubleStops, { title: 'Double-stops', summary: 'Adjacent-string dyads with steel-guitar bends and wide vibrato.', tiers: ['intermediate', 'advanced'] }),
    PU(bending, { title: 'Bends', summary: 'In-tune bends, quick up-down bends and bends after a hammer-on.', tiers: ['intermediate', 'advanced'] }),
    PU(vibrato, { title: 'Wide vibrato', summary: 'A wide, controlled vibrato on held notes and double-stops.', tiers: ['intermediate', 'advanced'] }),
    PU(phrasing, { title: 'Phrasing and space', summary: 'Short answering phrases with room to breathe.', tiers: ['intermediate', 'advanced'] }),
    U('Putting it together', 'An eight-bar study that joins four fingerstyle textures, then solos over his kind of changes.', [
      S('kn-study', 'A study in his style', 'improv', 'Muted bass, pinches, a 16th roll and a rake in eight bars.', [c => knStudy(c)]),
      S('kn-solo', 'Solos in his style', 'improv', 'Minor and major progressions: short phrases, chord tones and space.', [
        c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Over a minor progression: a short answering phrase, then space' }),
        c => targetGuide(c, { prog: 'folkAxis', scale: 'majorPent', name: 'Over a major progression: a singing phrase that lands on the third' })])])
  ],
  riffs: [
    { title: 'Sultans of Swing', artist: 'Dire Straits', note: 'Fingerstyle lead with pull-offs and a fluid pentatonic line.' },
    { title: 'Money for Nothing', artist: 'Dire Straits', note: 'A riff played with the fingers under overdrive.' },
    { title: 'Brothers in Arms', artist: 'Dire Straits', note: 'A slow, singing lead with long notes and space.' },
    { title: 'Romeo and Juliet', artist: 'Dire Straits', note: 'Fingerstyle accompaniment with a ringing melody.' },
    { title: 'Telegraph Road', artist: 'Dire Straits', note: 'A long arrangement that builds from fingerstyle rhythm to lead.' }
  ] });
