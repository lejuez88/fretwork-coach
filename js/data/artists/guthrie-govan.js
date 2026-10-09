// Artist Series: Guthrie Govan. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
import { OPEN, N, nameOf, minorKey, make, mod12, chordInfo, S, U, PU, M, artist } from '../lib.js';
import hybridPicking from '../kb/hybridPicking.js';
import economyPicking, { position } from '../kb/economyPicking.js';
import chromaticPassing, { vampChords, place, vampLine, sideStep } from '../kb/chromaticPassing.js';
import slides from '../kb/slides.js';
import alternatePicking from '../kb/alternatePicking.js';
import arpMelodies from '../kb/arpMelodies.js';

const pitch = (s, f) => OPEN[s] + f;
/** Chord-tone pitches of a chord between lo and hi. */
const tones = (name, lo, hi) => { const pcs = chordInfo(name).pcs, out = []; for (let p = lo; p <= hi; p++) if (pcs.includes(mod12(p))) out.push(p); return out; };
/** Slide marks for consecutive notes on the same string. */
function slideMarks(notes) { return notes.map((n, i) => { const p = notes[i - 1]; return p && p.s === n.s && p.f !== n.f && Math.abs(p.f - n.f) <= 5 ? { ...n, x: n.f > p.f ? '/' : '\\' } : n; }); }

/** An intervallic arpeggio melody over the Dorian vamp: the chord tones in 3rds of the arpeggio (wide leaps), joined with slides. */
export function ggArpMelody(c, { t0 = 0 } = {}) {
  const k = minorKey(c), chords = vampChords(k), notes = []; let near = 8;
  for (const [bar, nm] of [...chords, ...chords].entries()) {
    const ts = tones(nm, 50, 79); const mid = ts.findIndex(p => p >= 57); if (mid < 0) return null;
    const base = ts.slice(mid, mid + 6); if (base.length < 6) return null;
    const order = bar % 2 ? [5, 3, 4, 2, 3, 1, 2, 0] : [0, 2, 1, 3, 2, 4, 3, 5];   // up in arpeggio 3rds, then down
    order.forEach((ix, i) => { const at = place(base[ix], near); if (!at) return; notes.push(N(at[0], at[1], t0 + bar * 4 + i * 0.5, i === 7 ? 0.5 : 0.5)); near = (near * 2 + at[1]) / 3; });
  }
  if (notes.length < 24) return null;
  return make(c, {
    id: 'gg-arp-melody', name: `Arpeggio melodies with wide leaps and slides (${chords.join(' – ')})`, domain: 'improv', method: 'transfer',
    unit: '8th notes', goal: 100, minutes: 6, dl: 1, backing: chords, chords, tab: { notes: slideMarks(notes) },
    why: 'A trademark of his writing is melody built straight from the chord: arpeggio notes taken in leaps of a 4th, 5th or 6th instead of in order, connected by slides so the wide intervals still sing. Only chord tones, yet it never sounds like an exercise.',
    instr: 'Each bar takes the chord’s tones in “arpeggio 3rds” (1–3, 2–4, 3–5…), up over one chord, down over the next. Where two notes share a string, slide between them instead of picking. Fret one note at a time and mute everything else with spare fingers, so only one string ever sounds. Pass: the four bars clean over the backing, then four bars of your own using only chord tones and slides.',
    watch: 'Neighbouring strings ringing on the leaps: mute with the fretting-hand fingertips and the side of the picking hand.', simplify: 'Half tempo, and pick every note instead of sliding.'
  });
}

/** An original 8-bar study in his style over the Dorian vamp: arpeggio melody, enclosures, a Dorian run, a side-step out and back, a held landing. */
export function ggStudy(c) {
  const k = minorKey(c), cc = { ...c, key: k, minor: true };
  const a = ggArpMelody(cc), v = vampLine(cc, { mode: 'enclose' }), side = sideStep(cc), pos = position(k, 'dorian', 1);
  if (!a || !v || !side || !pos) return null;
  const notes = [];
  a.tab.notes.filter(n => n.t < 8).forEach(n => notes.push({ ...n }));                       // bars 1–2: arpeggio melody
  v.tab.notes.filter(n => n.t < 7.5).forEach(n => notes.push({ ...n, t: n.t + 8, d: n.t === 7 ? 1 : n.d }));  // bars 3–4: enclosures across the change
  pos.slice(0, 16).forEach(([s, f], i) => notes.push(N(s, f, 16 + i * 0.25, 0.25)));        // bar 5: a Dorian run up in 16ths
  side.tab.notes.filter(n => n.t >= 4 && n.t < 12).forEach(n => notes.push({ ...n, t: n.t + 16 }));  // bars 6–7: out a half step, then back
  const root = pos.find(([s, f]) => s <= 4 && mod12(pitch(s, f) - k) === 0) || pos[0];
  notes.push(N(root[0], root[1], 28, 4, '~'));                                                 // bar 8: land and hold
  const chords = vampChords(k);
  return make(c, {
    id: 'gg-study', name: `A fusion study in his style (${nameOf(k)} Dorian, ${chords.join(' – ')})`, domain: 'improv', method: 'transfer',
    unit: 'mixed rhythms', goal: 96, minutes: 8, dl: 1, backing: chords, chords,
    why: 'His solos move between very different ideas in a few bars, each one played with total control: a singing arpeggio melody, bebop-style enclosures, a fast scale burst, a deliberate trip outside the key and a long, held resolution. This original study strings those ideas together.',
    instr: 'Learn it two bars at a time, then join them. Bars 1–2: arpeggio leaps with slides. Bars 3–4: enclosures that land on the new chord. Bar 5: economy-picked Dorian run. Bars 6–7: the same phrase a half step up (outside), then back in. Bar 8: hold the root with wide, slow vibrato. Pass: the study at the goal tempo with no stops; then rewrite bars 5–8 as your own.',
    watch: 'Treating the outside bar timidly: play it with the same conviction, then resolve.', simplify: 'Bars 1–4 only.', tab: { notes }
  });
}

export default artist({ id: 'guthrie-govan', name: 'Guthrie Govan', wiki: ['Guthrie Govan'], genre: 'fusion', re: /guthrie|govan|the aristocrats/,
  blurb: 'Every technique at his fingertips, used for melody: hybrid and economy picking, legato and slides, chromatic and outside lines, and arpeggio melodies with wide leaps.',
  techniques: [{ name: 'Hybrid picking', path: 'hybridPicking' }, { name: 'Economy picking', path: 'economyPicking' }, { name: 'Chromatic passing tones', path: 'chromaticPassing' }, { name: 'Outside side-stepping', path: 'chromaticPassing' }, { name: 'Slides', path: 'slides' }, { name: 'Arpeggio melodies', path: 'arpMelodies' }],
  sources: ['https://www.guitarworld.com/lessons/5-guthrie-govan-guitar-licks', 'https://www.premierguitar.com/lessons/guthrie-govans-erotic-cakes', 'https://www.premierguitar.com/lessons/guthrie-govans-single-string-arpeggios', 'https://www.premierguitar.com/lessons/shred/guthrie-govan-tapping-arpeggios', 'https://www.guitarworld.com/lessons/legato-evolution-lesson'],
  ctx: { key: 7, minor: true, prog: 'dorianVamp' },
  units: [
    PU(slides, { title: 'Slides', summary: 'Slides make his fast lines sound vocal instead of mechanical: start here.' }),
    PU(hybridPicking, { title: 'Hybrid picking', summary: 'Pick plus middle and ring fingers: string skips, double stops and snapped notes.' }),
    PU(alternatePicking, { title: 'Alternate picking at speed', summary: 'Strict alternate picking for his fast chromatic and Dorian lines: bursts, accents, skips and performance tempo.', tiers: ['advanced', 'mastery'] }),
    PU(economyPicking, { title: 'Economy picking', summary: 'One stroke through string changes: the fluid three-note-per-string runs.' }),
    PU(chromaticPassing, { title: 'Chromatic and outside notes', summary: 'Approach notes, enclosures and side-stepping: the bebop-meets-rock vocabulary.' }),
    PU(arpMelodies, { title: 'Arpeggio melodies', summary: 'Tunes made of chord tones: arpeggio 3rds, wide leaps and octave displacement, voice-led and joined by slides.' }),
    U('Putting it together', 'Studies in his style over a Dorian vamp: an arpeggio melody and a fusion study that uses everything.', [
      S('gg-arpeggios', 'An arpeggio melody in his style', 'improv', 'Chord tones in wide leaps, joined by slides.', [c => ggArpMelody(c)]),
      S('gg-study', 'A fusion study', 'improv', 'Every idea of the course in eight bars.', [c => ggStudy(c), M('transfer', ['targetSolo', { chords: '$dorianVamp', scale: 'dorian', name: 'Your own solo over a Dorian vamp: arpeggios, enclosures, one side-step' }])])
    ])
  ],
  riffs: [
    { title: 'Wonderful Slippery Thing', note: 'Legato, slides and fluid phrasing over a fusion groove.' },
    { title: 'Waves', note: 'A 16th-note melody built from arpeggios with wide leaps.' },
    { title: 'Erotic Cakes', note: 'Funk-rock riffing and bebop-flavoured lines.' },
    { title: 'Fives', note: 'A melody in 5/4.' },
    { title: 'Sevens', note: '7/4 with a cascading tapped arpeggio section.' },
    { title: 'Hangover', note: 'Slow blues-rock: long slurred phrases and extreme bends.' }
  ] });
