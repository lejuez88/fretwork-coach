// Artist Series: Stevie Ray Vaughan. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
// Built technique-first (CONTENT.md): his signature techniques are complete learning paths (texasShuffle, bending, vibrato,
// doubleStops, raking, pentatonic) drawn here with PU; the closing unit holds the only lessons of his own: an original study.
import { N, nameOf, make, mod12, S, U, PU, M, artist } from '../lib.js';
import pentatonic from '../kb/pentatonic.js';
import bending from '../kb/bending.js';
import vibrato, { spotDeg } from '../kb/vibrato.js';
import texasShuffle, { renderBar as shBar, FORMS } from '../kb/texasShuffle.js';
import doubleStops from '../kb/doubleStops.js';
import raking, { rakeInto } from '../kb/raking.js';

/**
 * An original 12-bar study in his style: the all-in-one shuffle, the long boogie on the IV, raked bends and
 * vibrato, a barred double-stop in triplets, stabs on the V and a turnaround. Every part comes from the
 * paths' own models, so it is right in any key.
 */
export function srvStudy(c) {
  const k = mod12(c.key), notes = [], pent = [0, 3, 5, 7, 10].map(d => mod12(k + d));
  const plan = ['aio', 'aio', 'lead1', 'lead2', 'r567', 'r567', 'aio', 'lead3', 'stabs', 'stabs', 'aio', 'push'];
  for (const [bar, o] of FORMS.quick.entries()) {
    const T = bar * 4, p = plan[bar];
    if (!p.startsWith('lead')) { if (!shBar(notes, k, o, p, T, { pm: p === 'r567' })) return null; continue; }
    if (p === 'lead1') {   // a rake into the ♭7 → R bend on the B string, then the ♭3 with vibrato
      const a = spotDeg(k, 1, 2, 10), b = spotDeg(k, 1, 3, 3); if (!a || !b) return null;
      if (!rakeInto(notes, k, 1, a, T + 1, { size: 3, grace: 1 / 3, arrive: 'bend', len: 1 })) return null;
      if (!rakeInto(notes, k, 1, b, T + 2 + 2 / 3, { size: 2, grace: 1 / 3, arrive: 'vib', len: 4 / 3 })) return null;
    } else if (p === 'lead2') {   // the barred ♭7 + ♭3 pair on the top strings, in triplets
      const a = spotDeg(k, 1, 2, 10); if (!a) return null; const f = a.f;
      for (let i = 0; i < 9; i++) notes.push(N(2, f, T + i / 3, 1 / 3, null, { chord: true }), N(1, f, T + i / 3, 1 / 3, null, { chord: true }));
      notes.push(N(2, f, T + 3, 1, '~', { chord: true }), N(1, f, T + 3, 1, '~', { chord: true }));
    } else {   // rakes into the 5th and the root, with vibrato
      const a = spotDeg(k, 1, 2, 7), b = spotDeg(k, 1, 4, 0); if (!a || !b) return null;
      if (!rakeInto(notes, k, 1, a, T + 1, { size: 3, grace: 1 / 3, arrive: 'vib', len: 1 })) return null;
      if (!rakeInto(notes, k, 1, b, T + 2 + 2 / 3, { size: 2, grace: 1 / 3, arrive: 'vib', len: 4 / 3 })) return null;
    }
  }
  if (notes.length > 400) return null;
  const chords = FORMS.quick.map(o => nameOf(k + o) + '7');
  return make(c, {
    id: 'srv-study', name: `Study in his style: a 12-bar shuffle with raked bends and double-stops (${nameOf(k)})`, domain: 'improv', method: 'transfer', unit: '8th-note shuffle', goal: 100, start: 60, minutes: 8,
    chords: [...new Set(chords)], backing: chords, tab: { notes },
    why: 'An original 12-bar piece that joins his techniques the way his records do: the all-in-one shuffle, the long boogie on the IV, a rake into a bend and a raked ♭3, the barred double-stop in triplets, stabs on the V and a turnaround: rhythm and lead in one part.',
    instr: 'Learn it four bars at a time and name each technique before you play it. Medium overdrive, neck or middle pickup, dig in. Then write your own chorus to the same plan. Pass: the study at the goal tempo with the shuffle never straightening and every bend on pitch, then your own version once.',
    watch: 'The lead bars rushing out of the shuffle feel.', simplify: 'Bars 1–4.'
  });
}

export default artist({ id: 'srv', name: 'Stevie Ray Vaughan', wiki: ['Stevie Ray Vaughan'], genre: 'blues', re: /stevie ray|\bsrv\b|vaughan/,
    blurb: 'The Texas shuffle, huge bends with a wide vibrato, rakes into notes and double-stop fills, all played with great force.',
    techniques: [{ name: 'Texas shuffle', path: 'texasShuffle' }, { name: 'Wide bends and vibrato', path: 'bending' }, { name: 'Double-stops', path: 'doubleStops' }, { name: 'Raking', path: 'raking' }],
    sources: ['https://en.wikipedia.org/wiki/Stevie_Ray_Vaughan', 'https://www.londonguitaracademy.com/?p=8981', 'https://guitarworld.com/lessons/stevie-ray-vaughan-5-licks', 'https://www.premierguitar.com/beyond-blues-texas-rhythm-101', 'https://www.guitarworld.com/lessons/talkin-blues-all-one-shuffle-rhythm', 'https://www.premierguitar.com/deep-blues-double-stoppin-jive'],
    bio: `Stevie Ray Vaughan (1954–1990) grew up in Dallas, Texas, following his older brother Jimmie onto the guitar, and moved to Austin as a teenager to play the club circuit. He formed Double Trouble with drummer Chris Layton and bassist Tommy Shannon. A 1982 set at the Montreux Jazz Festival led David Bowie to hire him for Let's Dance, and the band's debut, Texas Flood (1983), put him at the front of the 1980s blues revival. Couldn't Stand the Weather, Soul to Soul and In Step followed before he died in a helicopter crash after a concert in Wisconsin in 1990.

His playing joins Albert King's huge bends, Jimi Hendrix's rhythm and fire, and the Texas shuffle, played with great force: heavy strings tuned down a half step, a wide vibrato, rakes across muted strings into a note, double-stop fills, and a shuffle that is rhythm and lead at once.

This course starts with the Texas shuffle, then the pentatonic box, bends, a wide vibrato, double-stops and raking, and ends with an original 12-bar study that combines them.`,
    ctx: { key: 4, minor: true, prog: 'blues' },
    units: [
      PU(texasShuffle, { title: 'The Texas shuffle', summary: 'Boogie figures, the walking bass, the all-in-one part and chord stabs through the 12-bar form.' }),
      PU(pentatonic, { title: 'The pentatonic box', summary: 'Box 1 and its neighbours, by ear and from memory: the shapes his licks live in.', tiers: ['foundations', 'intermediate'] }),
      PU(bending, { title: 'Big bends in tune', summary: 'Whole-step and wider bends with every finger behind them, pre-bends, unison and double-stop bends.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      PU(vibrato, { title: 'A wide vibrato', summary: 'Wide, wrist-driven vibrato locked to the shuffle, on bends and on double-stops.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      PU(doubleStops, { title: 'Double-stops', summary: 'The barred pair, 3rds, 6ths and pentatonic pairs that follow the blues changes.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      PU(raking, { title: 'Raking', summary: 'Muted rakes into notes, bends and double-stops: his percussive attack.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      U('Putting it together', 'Rhythm and lead as one part: his techniques in an original 12-bar study and blues phrasing.', [
        S('srv-study', 'A study in his style', 'improv', 'The shuffle, raked bends and double-stops in one chorus.', [c => srvStudy(c)]),
        S('srv-solo', 'Blues phrasing', 'improv', 'Call and response, chord targets.', [M('transfer', ['callResponse', { chords: '$blues' }]), M('transfer', ['targetSolo', { chords: '$slowBlues' }])])])
    ],
    riffs: [{ title: 'Pride and Joy', note: 'The Texas shuffle.' }, { title: 'Texas Flood', note: 'Slow blues phrasing.' }, { title: 'Lenny', note: 'Clean chord melody.' },
      { title: 'Scuttle Buttin\'', note: 'Fast pentatonic shuffle instrumental.' }, { title: 'Couldn\'t Stand the Weather', note: 'Funky riff and rhythm part.' }, { title: 'Cold Shot', note: 'Slow shuffle with chord stabs.' }] });
