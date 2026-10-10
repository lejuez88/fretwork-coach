// Artist Series: David Gilmour. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
import { OPEN, N, nameOf, minorKey, goalFor, slug, beatsOf, make, fromSeq, pentBox, byString, pent3nps, legatoMarks, chordInfo, OPEN_SHAPES, onString, bassPair, openVoicings, keyChords, topTriad, nextToneUp, spreadVoicing, spreadBar, spreadName, W, S, U, stage, entry, artist, skillsOf, TIERS, TIER_BY_ID, tierOf, mod12, scaleNps, chordTones, parseChord, ROOT_BY_PC, rootFret6, fretOn, scaleBox, SCALE_BY_ID, PU, M } from '../lib.js';
import pentatonic from '../kb/pentatonic.js';
import bending, { phrase } from '../kb/bending.js';
import vibrato from '../kb/vibrato.js';
import phrasing from '../kb/phrasing.js';


const ARTIST_NOTE = 'Use the Songs tab to learn the real thing: add the song, paste or import a tab, and the app turns it into section lessons.';
/** Pre-bends and releases in box 1: bend silently, pick, let the note fall to a scale tone. */
export function dgPrebends(c) {
  const key = minorKey(c), B = byString(pentBox(key, 1));
  if (!B[1] || !B[4] || B[1][1] + 3 > 22) return null;
  const notes = []; let t = 0;
  const pb = (s, f, up) => { notes.push(N(s, f, t, 1, 'b', { bendTo: f + up }), N(s, f, t + 1, 1)); t += 2; };
  // bar 1: G string 4th → 5th; bar 2: B string ♭7 → root; bar 3: e string ♭3 → 4th; bar 4: back down, resolve on the root
  pb(3, B[3][1], 2); notes.push(N(3, B[3][0], t, 2, '~')); t += 2;
  pb(2, B[2][1], 2); notes.push(N(2, B[2][0], t, 2, '~')); t += 2;
  pb(1, B[1][1], 2); notes.push(N(1, B[1][0], t, 2, '~')); t += 2;
  if ((c.lvl || 4) >= 6) { pb(2, B[2][0], 3); notes.push(N(2, B[2][0], t, 2, '~')); t += 2; } // 1½-step pre-bend: 5th up to ♭7
  pb(3, B[3][1], 2); notes.push(N(4, B[4][1], t, 2, '~'));
  return make(c, {
    id: 'dg-prebend', name: `Pre-bends and releases in ${nameOf(key)} minor, box 1 (Gilmour style)`, domain: 'fretting', unit: 'quarter notes', goal: 80, start: 50, minutes: 5,
    why: 'Bending silently, then picking and letting the note fall, makes a melody sigh down into place: a Gilmour signature. It only works if the silent bend is exactly in pitch.',
    instr: `The note marked b is bent BEFORE you pick it: push the string up to the target (whole step = two frets) without sound, pick, then release over one beat to the fretted note and move on. Bar 1: G string, the 4th up to the 5th. Bar 2: B string, ♭7 up to the root. Bar 3: high e, ♭3 up to the 4th.${(c.lvl || 4) >= 6 ? ' Then a 1½-step pre-bend on the B string (the 5th up to the ♭7).' : ''} Last bar resolves to the root on the D string. Pass: every pre-bend matches the target when you check it against the fretted note two frets up.`,
    watch: 'Pre-bends that start flat: you hear the note creep up after you pick. Check the target first, then bend to it.', simplify: 'Bend up and release with sound (no pre-bend) to learn the distance first.', tab: { notes }
  });
}

/** An original 8-bar slow study in his style: a pickup, a bend that resolves, silence, a pre-bend falling through the Dorian 6th, held notes with vibrato. */
export function dgStudy(c) {
  const k = minorKey(c);
  const notes = phrase(k, 1, [
    [null, 0, 3.5], [2, 7, 0.5],                                   // bar 1: space, then a pickup on the 5th
    [3, 5, 1, 'b', 7], [3, 5, 1, 'r'], [3, 3, 2, '~'],              // bar 2: the 4 bent to the 5th, released, the ♭3 held
    [null, 0, 4],                                                   // bar 3: silence
    [2, 10, 1, 'pb', 0], [2, 10, 1, 'r'], [2, 9, 0.5], [2, 7, 1.5, '~'],   // bar 4: pre-bend ♭7 → R falls, through the 6th to the 5th
    [null, 0, 2], [1, 0, 0.5], [1, 3, 1.5, '~'],                    // bar 5: half a bar of space, then up to the ♭3
    [1, 3, 1, 'b', 5], [1, 3, 1, 'r'], [2, 10, 1], [2, 7, 1, '~'],  // bar 6: the ♭3 bent to the 4, falling back to the 5th
    [3, 5, 2, 'b', 7], [3, 5, 1, 'r'], [3, 3, 1],                   // bar 7: a slow bend, released
    [4, 0, 4, '~']                                                  // bar 8: the root, with a wide, slow vibrato
  ]);
  if (!notes) return null;
  const chords = [nameOf(k) + 'm7', nameOf(k + 5) + '9'];
  return make(c, {
    id: 'dg-study', name: `Slow study in his style: bends, a Dorian 6th and space (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer', unit: 'phrases', goal: 72, start: 48, minutes: 6,
    backing: [...chords, ...chords, ...chords, ...chords], chords,
    why: 'An original 8-bar piece that puts his techniques together: a phrase that starts on a pickup, a bend that resolves and a held ♭3, a whole bar of silence, a pre-bend falling through the Dorian 6th, and long notes with slow vibrato over a minor vamp.',
    instr: 'Clean tone, neck pickup, plenty of delay if you have it. Check every bend against its fretted target first; give every held note a slow, even vibrato; count the silent bar. Then play your own 8 bars with the same plan (pickup, bend, silence, pre-bend, landing). Pass: the study at the goal tempo with every bend on pitch, then your version.',
    watch: 'Filling bar 3: the silence is the point.', simplify: 'Bars 1–4.', tab: { notes }
  });
}

export default artist({ id: 'gilmour', name: 'David Gilmour', wiki: ['David Gilmour'], genre: 'classic-rock', re: /gilmour|pink floyd/,
    blurb: 'Slow, singing phrasing, perfectly pitched bends and pre-bends, a slow, wide vibrato, the Dorian colour, and space.',
    techniques: [{ name: 'Bends and pre-bends', path: 'bending' }, { name: 'Vibrato', path: 'vibrato' }, { name: 'Pentatonic phrasing', path: 'pentatonic' }, { name: 'Space', path: 'phrasing' }],
    sources: ['https://www.guitarworld.com/lessons/david-gilmour-10-lead-guitar-ideas', 'https://www.musicradar.com/how-to/david-gilmour-guitar-lesson-pink-floyd', 'https://riffhard.com/?p=36564', 'https://www.premierguitar.com/lessons/shake-it-off-everything-you-need-to-know-about-vibrato', 'https://www.britannica.com/biography/David-Gilmour', 'https://wikipedia2007.classicistranieri.com/d/a/v/David_Gilmour_9ff6.html'],
    bio: `David Gilmour (born 1946 in Cambridge, England) joined Pink Floyd at the end of 1967, first alongside and then in place of Syd Barrett, as lead guitarist and one of its singers. His guitar is central to The Dark Side of the Moon (1973), Wish You Were Here (1975), Animals (1977) and The Wall (1979), and after Roger Waters left he led the band on A Momentary Lapse of Reason and The Division Bell. His solo albums include On an Island (2006).

His playing is rooted in the blues and built on melody rather than speed. Listeners recognise the bends that land exactly on pitch, including slow pre-bends that fall into place, a slow and even vibrato, minor-pentatonic phrases coloured by the Dorian 6th, and the space he leaves between phrases, often filled by echo.

This course follows that order: the pentatonic box, bends in tune, a singing vibrato, and phrasing with space, then a closing unit with pre-bends, an original slow study and slow-phrasing practice.`,
    ctx: { key: 11, minor: true, prog: 'minorRock' },
    units: [
      PU(pentatonic, { title: 'The pentatonic box', summary: 'The box he phrases in, learned slowly, by ear and from memory, then joined to its neighbours.', tiers: ['foundations', 'intermediate'] }),
      PU(bending, { title: 'Bends in tune', summary: 'Every bend lands on pitch: reference bends, releases, pre-bends that sigh down, unison and wide bends, in any box.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      PU(vibrato, { title: 'A vibrato that sings', summary: 'Slow, even, in-tune vibrato: measured pulses, delayed and widening vibrato, vibrato on bends and unisons.', tiers: ['foundations', 'intermediate', 'advanced'] }),
      PU(phrasing, { title: 'Phrasing and space', summary: 'A bar of melody and a bar of silence, motifs developed and answered, the Dorian 6th as colour, solos with a shape.' }),
      U('Putting it together', 'Fewer notes, more meaning: his techniques in original studies and slow solos.', [
        S('dg-bend', 'Pre-bends in his style', 'fretting', 'Silent bends that fall into place, in box 1.', [M('transfer', c => dgPrebends(c))]),
        S('dg-study', 'A slow study', 'improv', 'Bends, the Dorian 6th, vibrato and silence in one piece.', [c => dgStudy(c), M('variable', ['modeCompare', { modes: ['minor', 'dorian'] }])]),
        S('dg-solo', 'Slow phrasing', 'improv', 'Space between phrases.', [['callResponse', { chords: '$minorRock' }], ['targetSolo', { chords: '$slowBlues' }]])])
    ],
    riffs: [{ title: 'Comfortably Numb', artist: 'Pink Floyd', note: 'Bends, vibrato and slow phrasing.' }, { title: 'Shine On You Crazy Diamond', artist: 'Pink Floyd', note: 'Slow, singing lead with space.' },
      { title: 'Time', artist: 'Pink Floyd', note: 'Bends and pentatonic phrasing.' }, { title: 'Money', artist: 'Pink Floyd', note: 'Riff in 7/4 and solo.' },
      { title: 'Wish You Were Here', artist: 'Pink Floyd', note: 'Acoustic intro lick.' }] });
