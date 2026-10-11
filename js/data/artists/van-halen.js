// Artist Series: Eddie Van Halen. Built technique-first (CONTENT.md): his signature techniques are their own
// learning paths (palmMuting, openPulls, tapping, harmonics, plus the pentatonic), drawn here with PU; the closing
// unit holds the only lessons of his own: an original study in his style and solo lessons. Famous songs are linked,
// never transcribed.
import { nameOf, make, mod12, S, U, PU, artist } from '../lib.js';
import pentatonic from '../kb/pentatonic.js';
import palmMuting, { pmRun } from '../kb/palmMuting.js';
import openPulls, { opRun } from '../kb/openPulls.js';
import tapping, { tapRun, evhTapTriplets, chordsOf } from '../kb/tapping.js';
import harmonics, { hmRun } from '../kb/harmonics.js';

/** Copies `beats` beats of an exercise's tab, from beat `from`, to beat `at`. */
function take(ex, from, beats, at) {
  if (!ex || !ex.tab) return null;
  return ex.tab.notes.filter(n => n.t >= from - 1e-6 && n.t < from + beats - 1e-6).map(n => ({ ...n, t: +(n.t - from + at).toFixed(4) }));
}
const X = { why: '-', instr: '-', watch: '-', simplify: '-' };
/**
 * An original 8-bar study in the Van Halen style: a palm-muted pedal-tone riff with triad stabs, an open-string
 * pull-off fill, a riff bar answered by harmonics, tapped triplet arpeggios over two chords, a tapped cascade
 * across the strings, and a harmonic dived with the bar. Every part comes from the path it belongs to, so it is
 * in the key in every key.
 */
export function evhStudy(c) {
  const parts = [
    take(pmRun(c, { id: 'x', name: 'x', style: 'pedal', patterns: ['pedal8'], prog: 'one', ...X }), 0, 8, 0),
    take(opRun(c, { id: 'x', name: 'x', fig: 'trip', plan: 'down', beats: 4, strings: [1, 2], ...X }), 0, 4, 8),
    take(hmRun(c, { id: 'x', name: 'x', kind: 'riff', bars: 1, ...X }), 0, 4, 12),
    take(tapRun(c, { id: 'x', name: 'x', cell: 'tph', prog: 'auto', strings: [2], ...X }), 0, 8, 16),
    take(tapRun(c, { id: 'x', name: 'x', cell: 'desc', across: true, prog: 'auto', strings: [1, 2, 3, 2], ...X }), 0, 4, 24),
    take(hmRun(c, { id: 'x', name: 'x', kind: 'natural', nodes: [12, 7], strings: [3, 2, 4], plan: 'down', step: 4, bar: 'dive', barDepth: 12, ...X }), 0, 4, 28)
  ];
  if (parts.some(p => !p || !p.length)) return null;
  const k = mod12(c.key), ch = chordsOf(k, c.minor ? 'minor' : 'major'), i = ch[0];
  const backing = [i, i, i, i, ch[0], ch[1], i, i];
  return make(c, {
    id: 'evh-study', name: `Study in the Van Halen style: riff, open-string fill, harmonics, taps and a dive (${nameOf(k)} ${c.minor ? 'minor' : 'major'})`,
    domain: 'improv', method: 'transfer', unit: 'mixed', goal: 100, start: 56, minutes: 8, dl: 1, backing, chords: [...new Set(backing)],
    why: 'An original 8-bar piece that joins his techniques the way his playing does: a palm-muted pedal-tone riff with triad stabs, an open-string pull-off fill, harmonics over the riff, tapped arpeggios, a tapped cascade across the strings and a harmonic dived with the bar.',
    instr: 'Learn it two bars at a time; each pair is a lesson of the paths above. Then play it as one piece with the backing, with a loose, swinging feel in the riff bars. Pass: two times through at the goal tempo without a gap between the techniques.',
    watch: 'The changes between techniques costing a beat: prepare the next hand position during the last note.', simplify: 'Bars 1–4.',
    tab: { notes: parts.flat() }
  });
}

export default artist({ id: 'van-halen', name: 'Eddie Van Halen', wiki: ['Eddie Van Halen'], genre: 'rock', re: /van halen|\bevh\b|eddie van|eruption/,
    blurb: 'Two-hand tapping, open-string legato, tight palm-muted riffs and fearless whammy work.',
    techniques: [
      { name: 'Two-hand tapping', path: 'tapping' }, { name: 'Tapped pentatonic', path: 'tapping' }, { name: 'Open-string pull-offs', path: 'openPulls' },
      { name: 'Palm-muted riffs', path: 'palmMuting' }, { name: 'Harmonics', path: 'harmonics' }],
    sources: ['https://www.nme.com/features/eddie-van-halen-obituary-tribute-2774589', 'https://www.scotsman.com/whats-on/arts-and-entertainment/eddie-van-halen-life-and-career-of-legendary-guitarist-who-has-died-aged-65-and-most-famous-songs-and-solos-from-jump-to-beat-it-2995439', 'https://guitarworld.com/lessons/6-guitar-tricks-you-can-learn-from-eddie-van-halen',
      'https://guitarplayer.com/lessons/eddie-van-halen-tapping', 'https://www.guitarplayer.com/lessons/eddie-van-halens-playing-secrets-how-to-solo-like-the-lead-guitar-legend', 'https://www.premierguitar.com/lessons/electric-etudes-eddie-van-halen-techniques'],
    bands: ['Van Halen'],
    bio: `Eddie Van Halen (1955–2020) was born in Amsterdam and moved with his family to the United States in 1962. With his brother Alex on drums he founded Van Halen in 1972, and the band's 1978 debut album, with the short instrumental "Eruption", changed rock guitar almost overnight. He also played the guitar solo on Michael Jackson's "Beat It", and "Jump", from the album 1984, became the band's only number-one single. He died of cancer in October 2020.

He popularised two-hand tapping: a picking-hand finger taps notes on the fretboard for fast arpeggios with wide intervals. Around it he built open-string pull-offs, natural and tapped harmonics, whammy-bar dives and scoops, tremolo picking, and riffs that keep a palm-muted open string ringing under short chord shapes, all with a loose, playful sense of time.

This course starts with his rhythm playing (palm-muted riffs and the pedal-tone style), then open-string pull-offs and the pentatonic, then tapping and harmonics, each from its own path, and ends with an original study that puts them together.`,
    ctx: { key: 4, minor: true, prog: 'minorRock' },
    units: [
      PU(palmMuting, { title: 'Palm-muted riffs', summary: 'Chugs, gallops, the push, stops and the pedal-tone style: his rhythm engine.' }),
      PU(openPulls, { title: 'Open-string pull-offs', summary: 'Fast, slurred lines against the open string, and riffs answered by open-string fills.' }),
      PU(pentatonic, { title: 'The pentatonic boxes', summary: 'The scale his licks and tapped extensions start from.', tiers: ['intermediate', 'advanced'] }),
      PU(tapping, { title: 'Two-hand tapping', summary: 'Tap, pull off, hammer on: arpeggios over progressions, the tapped pentatonic, fives and sixes, slides and cascades.' }),
      PU(harmonics, { title: 'Harmonics', summary: 'Natural, tapped and pinch harmonics, chimes, harp arpeggios and dives with the bar.' }),
      U('Putting it together', 'His techniques in one study, then in a solo.', [
        S('evh-study', 'Study in his style', 'improv', 'Riff, fill, harmonics, taps and a dive in 8 bars.', [c => evhStudy(c)]),
        S('evh-speed', 'Speed bursts and tremolo', 'picking', 'Short, fast bursts between licks.', [['speedBurst'], ['scaleRun', { scale: 'blues', box: 1, unit: '16ths' }]]),
        S('evh-solo', 'Tapping in a solo', 'improv', 'Answer a phrase with a tapped lick.', [['callResponse', { chords: '$minorRock' }], c => evhTapTriplets(c, { chords: chordsOf(mod12(c.key), c.minor ? 'minor' : 'major') })])])
    ],
    riffs: [
      { title: 'Eruption', note: 'The tapping showcase.' }, { title: 'Ain\'t Talkin\' \'bout Love', note: 'Arpeggiated riff with a heavy groove.' },
      { title: 'Panama', note: 'Driving riff with open strings.' }, { title: 'Hot for Teacher', note: 'Fast shuffle riff and tapping.' },
      { title: 'Runnin\' with the Devil', note: 'Simple, heavy power-chord riff.' }, { title: 'Unchained', note: 'Drop-D riff with harmonics.' },
      { title: 'Spanish Fly', note: 'Acoustic tapping and tapped harmonics.' }, { title: 'Mean Street', note: 'Tapped harmonics on electric guitar.' }
    ] });
