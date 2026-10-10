// Artist Series: Jimi Hendrix. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
// Built technique-first (CONTENT.md): his signature techniques are complete learning paths (chordEmbellish, sharp9, octaves,
// pentatonic, bending, vibrato) drawn here with PU; the closing unit holds the only lessons of his own: an original study.
import { N, nameOf, minorKey, make, mod12, S, U, PU, M, artist } from '../lib.js';
import pentatonic from '../kb/pentatonic.js';
import bending, { phrase } from '../kb/bending.js';
import vibrato from '../kb/vibrato.js';
import chordEmbellish, { gripFor, renderBar as embBar } from '../kb/chordEmbellish.js';
import sharp9, { grip as s9Grip, renderBar as s9Bar, RHY } from '../kb/sharp9.js';
import octaves, { place, renderOct, RIFFS, deg } from '../kb/octaves.js';

/**
 * An original 8-bar study in his style: an embellished minor grip and a fill, the 7♯9 in a syncopated
 * push and stabs, an octave riff, a bend phrase, and a trill on the last grip. Every part comes from
 * the paths' own models, so it is right in any key.
 */
export function hxStudy(c) {
  const k = minorKey(c), notes = [], natural = [0, 2, 3, 5, 7, 8, 10].map(d => mod12(k + d));
  const i = gripFor(nameOf(k) + 'm', 3), III = gripFor(nameOf(k + 3), i ? i.bass[1] : 5), s9 = s9Grip('a', k, 7);
  if (!i || !III || !s9) return null;
  if (!embBar(notes, i, 'ham', 0, natural, III) && !embBar(notes, i, 'hold', 0, natural, III)) return null;   // bar 1: the minor grip, hammered
  if (!embBar(notes, III, 'fill', 4, natural, i) && !embBar(notes, III, 'hold', 4, natural, i)) return null;  // bar 2: ♭III and a double-stop fill
  s9Bar(notes, s9, RHY.push.slots, 8); s9Bar(notes, s9, RHY.stabs.slots, 12);                                // bars 3–4: the 7♯9, pushed, then stabbed
  const pcs = [0, 3, 5, 7, 10].map(d => mod12(k + d));
  let pos = 7, t = 16; const base = 40 + mod12(k - 40) + (mod12(k - 40) < 5 ? 12 : 0);
  for (const [ix, b] of RIFFS.first) { const pl = place(base + deg('minorPent', ix), 'pos', pos); if (!pl) return null; renderOct(notes, pl, t, b, 'strum', pcs); pos = pl.f; t += b; }   // bars 5–6: an octave riff
  const bend = phrase(k, 1, [[3, 5, 1, 'b', 7], [3, 5, 0.5, 'r'], [3, 3, 0.5], [2, 10, 1, 'b', 0], [4, 0, 1, '~']], 24); if (!bend) return null; notes.push(...bend);   // bar 7: bends
  if (!embBar(notes, i, 'trill', 28, natural, i) && !embBar(notes, i, 'hold', 28, natural, i)) return null;  // bar 8: the grip with a trill
  const chords = [i.name, III.name, s9.name, s9.name, i.name, i.name, i.name, i.name];
  return make(c, {
    id: 'hx-study', name: `Study in his style: embellished grips, the 7♯9, octaves and bends (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer', unit: 'mixed 8ths and 16ths', goal: 84, start: 50, minutes: 8,
    voicings: [{ name: i.name, frets: i.frets }, { name: III.name, frets: III.frets }, { name: s9.name, frets: s9.frets }], chords: [...new Set(chords)], backing: chords.map(n => n.replace('7♯9', '7')), tab: { notes },
    why: 'An original 8-bar piece that joins his techniques the way his songs do: rhythm and lead in one part. A thumb-over minor grip with a hammer-on, a double-stop fill, the 7♯9 in a funk-rock push, an octave riff, vocal bends, and a trill on the last chord.',
    instr: 'Learn it two bars at a time and name each technique before you play it (hammer-on, fill, 7♯9 push, stabs, octaves, bends, trill). Clean or lightly overdriven tone, neck pickup. Then write your own 8 bars with the same plan. Pass: the study at the goal tempo with every grip ringing and every bend on pitch, then your own version once.',
    watch: 'Treating the rhythm bars as filler: they are as melodic as the lead bars.', simplify: 'Bars 1–4.'
  });
}

export default artist({ id: 'hendrix', name: 'Jimi Hendrix', wiki: ['Jimi Hendrix'], genre: 'classic-rock', re: /hendrix|\bjimi\b/,
    blurb: 'Rhythm and lead as one part: embellished thumb-over grips, the 7♯9 chord, octave riffs, vocal bends and a wide vibrato.',
    techniques: [{ name: 'Chord embellishments', path: 'chordEmbellish' }, { name: 'The 7♯9 chord', path: 'sharp9' }, { name: 'Octaves', path: 'octaves' }, { name: 'Bends and vibrato', path: 'bending' }],
    sources: ['https://www.guitarplayer.com/lessons/jimi-hendrix-the-five-rules-of-his-powerful-rhythm-style', 'https://www.musicradar.com/how-to/jimi-hendrix-rhythm-guitar-lesson', 'https://guitarworld.com/lessons/hendrix-chord-from-jazz-to-jimi', 'https://www.premierguitar.com/lessons/rhythm/jimi-hendrix-rhythm-guitar', 'https://www.udiscovermusic.com/artist/jimi-hendrix/'],
    bio: `Jimi Hendrix (1942–1970) learned his trade as a sideman on the American R&B circuit, touring with acts such as the Isley Brothers and Little Richard, before moving to London in 1966 and forming the Jimi Hendrix Experience with Noel Redding and Mitch Mitchell. In under two years the trio released Are You Experienced, Axis: Bold as Love and Electric Ladyland, and his sets at the Monterey Pop Festival in 1967 and at Woodstock in 1969 became landmarks of rock.

His playing joins rhythm and lead into one part. Chords are small grips, often with the thumb over the neck fretting the bass, decorated with hammer-ons, pull-offs and double-stop fills that come from soul and R&B guitar. He made the dominant 7♯9 a rock sound, doubled riffs in octaves, and bent and shook notes with a wide, vocal vibrato over the minor pentatonic.

This course follows the same order: the chord-embellishment path first, then the 7♯9 chord, octaves, the pentatonic box, bends and vibrato, and a closing study that combines them.`,
    ctx: { key: 4, minor: true, prog: 'minorRock' },
    units: [
      PU(chordEmbellish, { title: 'Rhythm with melody', summary: 'Thumb-over grips decorated from inside the shape: hammer-ons, pull-offs, sus moves, trills, double-stop fills and walking bass.' }),
      PU(sharp9, { title: 'The 7♯9 chord', summary: 'The Hendrix chord: grips, funk-rock 16ths with scratches, parallel moves, the blues, and lines over it.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      PU(octaves, { title: 'Octaves', summary: 'Riffs and melodies doubled an octave up with the middle string muted, on every string pair.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      PU(pentatonic, { title: 'Pentatonic phrasing', summary: 'The boxes under his leads, by ear and from memory.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      PU(bending, { title: 'Vocal bends', summary: 'Bends to pitch, pre-bends, unison, oblique and double-stop bends.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      PU(vibrato, { title: 'Wide vibrato', summary: 'A wide, wrist vibrato, on bends and on double-stops.', tiers: ['intermediate', 'advanced'] }),
      U('Putting it together', 'Rhythm and lead as one part: his techniques in an original study and over a vamp.', [
        S('hx-study', 'A study in his style', 'improv', 'Embellished grips, the 7♯9, octaves and bends in one piece.', [c => hxStudy(c)]),
        S('hx-solo', 'Rhythm and lead as one', 'improv', 'Fills and licks over a vamp.', [M('transfer', ['callResponse', { chords: '$minorRock' }]), M('transfer', ['doubleStops', { interval: '3rds' }])])])
    ],
    riffs: [{ title: 'Little Wing', note: 'Chord embellishments.' }, { title: 'Purple Haze', note: 'The 7♯9 chord.' }, { title: 'Voodoo Child (Slight Return)', note: 'Wah riff and pentatonic lead.' },
      { title: 'Hey Joe', note: 'Bass-line riff and chord fills.' }, { title: 'The Wind Cries Mary', note: 'Chord embellishments.' }, { title: 'Foxy Lady', note: 'The 7♯9 and bends.' },
      { title: 'Third Stone from the Sun', note: 'Octave melody.' }] });
