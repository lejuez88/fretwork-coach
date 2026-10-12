// Artist Series: John Mayer. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
// Built technique-first (CONTENT.md): his signature techniques are complete learning paths (chordEmbellish, thumbSlap,
// majMinPent, bending, vibrato, doubleStops) drawn here with PU; the closing unit holds the only lessons of his own:
// an original study and soloing over his kind of changes.
import { N, nameOf, make, mod12, S, U, PU, M, artist, targetGuide } from '../lib.js';
import chordEmbellish from '../kb/chordEmbellish.js';
import thumbSlap, { slapRun } from '../kb/thumbSlap.js';
import majMinPent, { notesIn, windowOf, curlIn } from '../kb/majMinPent.js';
import bending from '../kb/bending.js';
import vibrato from '../kb/vibrato.js';
import doubleStops from '../kb/doubleStops.js';

const MAJP = [0, 2, 4, 7, 9], MIX = [0, 2, 3, 4, 5, 7, 9, 10];
/**
 * An original 8-bar study in his style, in a major key over I–V–vi–IV: four bars of slap groove with
 * hammer-on embellishments and piano hits (the acoustic side), then four bars of lead answering it (the
 * electric side): the ♭3-to-3 curl on the I, then major-pentatonic lines landing on a chord tone of each
 * chord, the last one held with vibrato.
 */
export function jmStudy(c) {
  const groove = slapRun(c, { id: 'x', name: 'x', prog: 'ballad', patterns: ['basic', 'hammer', 'basic', 'piano'] }); if (!groove) return null;
  const K = c.minor ? mod12(c.key + 3) : mod12(c.key), notes = groove.tab.notes.map(n => ({ ...n }));
  const degs = [0, 7, 9, 5], win = windowOf(K, 'root'), list = notesIn(MAJP.map(x => mod12(K + x)), win);
  const land = d => mod12(K + (d === 7 ? 7 : d === 9 ? 0 : d === 5 ? 9 : 4));   // a chord tone of each chord inside the major pentatonic
  degs.forEach((d, i) => {
    const t0 = 16 + i * 4, tgt = land(d);
    let ti = list.findIndex(p => mod12(p.m) === tgt && p.s <= 3); if (ti < 0) ti = list.findIndex(p => mod12(p.m) === tgt);
    if (i === 0) { const cu = curlIn(K, win); if (cu) { notes.push(N(cu.s, cu.f, t0, 0.5), N(cu.s, cu.f + 1, t0 + 0.5, 0.5, 'h'), N(cu.after[0][0], cu.after[0][1], t0 + 1, 0.5), N(cu.after[1][0], cu.after[1][1], t0 + 1.5, 0.5)); } }
    const start = i === 0 ? 2 : 0, run = [ti + 3, ti + 2, ti + 1].map(x => list[Math.max(0, Math.min(list.length - 1, x))]).slice(0, i === 0 ? 1 : 3);
    let t = t0 + start; run.forEach(p => { notes.push(N(p.s, p.f, t, 0.5)); t += 0.5; });
    const p = list[ti]; notes.push(N(p.s, p.f, t, t0 + 4 - t, '~'));
  });
  const chords = groove.backing.slice(0, 4);
  return make(c, {
    id: 'jm-study', name: `A study in his style: slap groove, then a sweet blues answer (${chords.join(' – ')})`, domain: 'improv', method: 'transfer', unit: '8th notes', goal: 88, start: 52, minutes: 8, picking: 'fingers',
    backing: [...chords, ...chords], chords, voicings: groove.voicings,
    why: 'His songs often move between a self-contained acoustic groove and a short, vocal electric answer. This original study puts both in eight bars: the slap backbeat with hammer-on embellishments and piano hits, then a curl from the ♭3 into the 3rd and major-pentatonic lines that land on a note of every chord.',
    instr: 'Bars 1–4: the slap groove (bass on 1 and 3, slap on 2 and 4), as in the thumb-slap path. Bars 5–8: the lead, played with the fingers: the curl on the I chord, then a short line into a chord tone of each chord, the last one held with a fast, narrow vibrato. Learn each half, then join them. Then write your own answer for bars 5–8. Pass: all 8 bars at the goal tempo, then your own answer once.',
    watch: 'Rushing the lead: leave space after each landing note.', simplify: 'Bars 1–4, then only the landing notes of bars 5–8.', tab: { notes }
  });
}

export default artist({ id: 'john-mayer', name: 'John Mayer', wiki: ['John Mayer'], genre: 'blues', re: /john mayer|\bmayer\b/,
  blurb: 'Hendrix- and Mayfield-style chord embellishments, a slapped fingerstyle backbeat, sweet major-pentatonic lines mixed with blues minor, singing bends, double-stops and a fast, narrow vibrato.',
  techniques: [{ name: 'Hendrix-style chord embellishments', path: 'chordEmbellish' }, { name: 'Percussive thumb slap', path: 'thumbSlap' }, { name: 'Mixing major and minor pentatonic', path: 'majMinPent' }, { name: 'Bends and quarter-tone curls', path: 'bending' }, { name: 'Fast, narrow vibrato', path: 'vibrato' }, { name: 'Double-stops', path: 'doubleStops' }],
  sources: ['https://www.premierguitar.com/lessons/many-sides-of-john-mayer', 'https://www.premierguitar.com/lessons/acoustic-lessons/acoustic-john-mayer', 'https://www.guitarworld.com/lessons/john-mayer-12-playing-tips', 'https://www.guitarworld.com/lessons/john-mayer-lyrical-solos', 'https://www.musicradar.com/how-to/john-mayer-guitar-lesson', 'https://www.britannica.com/biography/John-Mayer', 'https://en.wikipedia.org/wiki/John_Mayer_Trio'],
  bio: `John Mayer (born 1977 in Bridgeport, Connecticut) studied briefly at Berklee College of Music before his debut album, Room for Squares (2001), made him a pop star; "Your Body Is a Wonderland" won the first of his seven Grammys. He then turned toward the blues: a trio with bassist Pino Palladino and drummer Steve Jordan, the live album Try! (2005), and Continuum (2006). Since 2015 he has also toured with Dead & Company.

His playing joins two sides. On acoustic and clean electric he plays with his fingers: thumb-fretted chords decorated with hammer-ons in the manner of Jimi Hendrix and Curtis Mayfield, and a thumb that slaps a backbeat on 2 and 4 so one guitar sounds like a band. As a soloist he mixes sweet major-pentatonic lines with blues minor, leans on long and quarter-tone bends, double-stops and a fast, narrow vibrato, and phrases like a singer.

This course follows that order: chord embellishments, the thumb slap, mixing the two pentatonics, then bends, vibrato and double-stops, and a closing study and solos that put the acoustic and electric sides together.`,
  bands: ['John Mayer Trio', 'Dead & Company'],
  ctx: { key: 4, minor: false, prog: 'blues' },
  units: [
    PU(chordEmbellish, { title: 'Chord embellishments', summary: 'Thumb-over grips with hammer-ons, pull-offs and double-stop fills: the Hendrix and Mayfield rhythm style at the heart of his playing.' }),
    PU(thumbSlap, { title: 'The thumb slap', summary: 'Thumb bass on the beat, a slap on 2 and 4, the fingers in between: his acoustic groove.' }),
    PU(majMinPent, { title: 'Major and minor pentatonic', summary: 'Sweet major lines on the I chord, blues minor from the IV, the ♭3-to-3 curl that joins them.' }),
    PU(bending, { title: 'Bends', summary: 'Long singing bends and small quarter-tone curls.', tiers: ['intermediate', 'advanced', 'mastery'] }),
    PU(vibrato, { title: 'Vibrato', summary: 'A fast, narrow vibrato on held notes.', tiers: ['intermediate', 'advanced', 'mastery'] }),
    PU(doubleStops, { title: 'Double-stops', summary: 'Thirds and sixths that thicken a melody in a trio.', tiers: ['foundations', 'intermediate', 'advanced'] }),
    U('Putting it together', 'The acoustic groove and the electric answer, then solos over his kind of changes.', [
      S('jm-study', 'A study in his style', 'improv', 'A slap groove, then a sweet blues answer.', [c => jmStudy(c)]),
      S('jm-solo', 'Solos in his style', 'improv', 'Major on the I, minor on the IV, space between phrases.', [
        c => targetGuide(c, { prog: 'slowBlues', scale: 'majorPent', name: 'Slow blues in his style: sweet major lines on the I, blue minor on the IV, long bends and space' }),
        M('transfer', ['callResponse', { chords: '$blues', scale: 'majorPent' }])])])
  ],
  riffs: [
    { title: 'Gravity', note: 'Slow, soulful blues ballad: long bends, vibrato and space.' },
    { title: 'Slow Dancing in a Burning Room', note: 'Clean melodic lead and embellished chords.' },
    { title: 'Neon', note: 'Acoustic thumb-slap groove with fingerpicked chords.' },
    { title: 'Stop This Train', note: 'Fingerstyle accompaniment with a percussive backbeat.' },
    { title: 'Vultures', artist: 'John Mayer Trio', note: 'Funky trio groove and a blues solo.' },
    { title: 'Waiting on the World to Change', note: 'Mayfield-style rhythm with embellished chords.' }
  ] });
