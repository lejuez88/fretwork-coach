// Artist Series: Tosin Abasi. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
// Built technique-first (CONTENT.md): his signature techniques are complete learning paths (thumping, multiTap,
// alternatePicking, djentRiffs, palmMuting, subdivisions) drawn here with PU; the closing unit holds the only lessons
// of his own: an original 8-string study that joins the techniques, and soloing over his kind of harmony.
import { N, nameOf, make, mod12, S, U, PU, artist, targetGuide } from '../lib.js';
import thumping from '../kb/thumping.js';
import multiTap, { mtRun } from '../kb/multiTap.js';
import alternatePicking from '../kb/alternatePicking.js';
import djentRiffs, { djRun, CELLS as DJ } from '../kb/djentRiffs.js';
import palmMuting from '../kb/palmMuting.js';
import subdivisions from '../kb/subdivisions.js';

/** A lesson of a path, built for `c`, found by its id (the path's own generator, so the notes are its notes). */
function lessonOf(e, id, c) {
  for (const st of e.stages) for (const sk of st.skills) for (const g of sk.ex) {
    if (typeof g !== 'function') continue;
    const x = g({ ...c, lvl: Math.max(st.levels[0], Math.min(st.levels[1], c.lvl || st.levels[0])) });
    if (x && x.id === id) return x;
  }
  return null;
}
/** Shift a tab's notes (the first `beats` beats of it) to start at beat t0. */
const shift = (notes, t0, beats) => notes.filter(n => n.t < beats - 1e-6).map(n => ({ ...n, t: +(n.t + t0).toFixed(4) }));

/**
 * An original 8-bar study in his style on an 8-string, in a minor key: two bars of a palm-muted riff of
 * fives on the 8th string, two bars of a thumping groove, two bars of tapped chords (bass in the fretting
 * hand, colour-tone combos in the tapping hand, over i m9 and ♭VI maj9), and two bars of a nine-16th riff
 * cut to land on the downbeat. Every section is a lesson of its path, joined in time.
 */
export function taStudy(c) {
  const k = c.minor ? mod12(c.key) : mod12(c.key - 3), cc = { ...c, key: k, minor: true, lvl: Math.max(7, c.lvl || 8) };
  const a = djRun(cc, { id: 'x', name: 'x', low: 8, segments: [[DJ.five, 30], [DJ.tailA, 2]], pitches: [0, 0, 3, 0, 8, 7], end: false });
  const b = lessonOf(thumping, 'thump-groove', cc);
  const t = mtRun(cc, { id: 'x', name: 'x', cell: 'together', move: true, chords: kk => [nameOf(kk) + 'm9', nameOf(kk + 8) + 'maj9'] });
  const d = djRun(cc, { id: 'x', name: 'x', low: 8, segments: [[DJ.nine, 30], [DJ.tailA, 2]], pitches: [0, 8, 7] });
  if (!a || !b || !t || !d || (b.tab.strings || 6) !== 8) return null;
  const notes = [...shift(a.tab.notes, 0, 8), ...shift(b.tab.notes, 8, 8), ...shift(t.tab.notes, 16, 8), ...shift(d.tab.notes, 24, 10)];
  const root = nameOf(k), chords = [root + 'm', root + 'm', root + 'm', root + 'm', root + 'm9', nameOf(k + 8) + 'maj9', root + 'm', root + 'm'];
  return make(c, {
    id: 'ta-study', name: `A study in his style: riff, thump, tapped chords, riff (${root} minor, 8-string)`, domain: 'improv', method: 'transfer', unit: '16th notes', goal: 84, start: 50, minutes: 8, dl: 1, picking: 'alternate',
    backing: chords, chords: [...new Set(chords)],
    why: 'His pieces move between textures: palm-muted cross-rhythm riffs on the low strings, a thumped and popped groove, and clean two-handed tapped chords, each locked to the same steady beat. This original study puts the four in eight bars on an 8-string.',
    instr: 'On an 8-string in standard tuning (low to high F♯ B E A D G B E). Bars 1–2: the riff of fives on the 8th string, palm-muted chugs and ringing accents, as in the djent path. Bars 3–4: the thumping groove (thumb down and up, index and middle pops). Bars 5–6: tapped chords, the fretting hand on root, 5th and octave, the tapping hand on the colour tones. Bars 7–8: the nine-16th riff, cut to land on the downbeat. Learn each pair of bars in its own path first, then join them. Pass: all 8 bars at the goal tempo with every texture change on the bar line.',
    watch: 'Rushing the change from the riff into the thumping bars: the pulse stays the same.', simplify: 'Bars 1–4.', tab: { strings: 8, notes }
  });
}

export default artist({ id: 'tosin-abasi', name: 'Tosin Abasi', wiki: ['Tosin Abasi'], genre: 'metal', re: /tosin|abasi|animals as leaders/,
  blurb: 'Eight-string progressive metal and fusion: thumped and popped grooves, two-handed tapped chords, odd-time alternate picking and palm-muted riffs whose groupings cross the bar line.',
  techniques: [{ name: 'Thumping (slap and pop)', path: 'thumping' }, { name: 'Tapped chords and double-stop tapping', path: 'multiTap' }, { name: 'Odd-time alternate picking', path: 'alternatePicking' }, { name: 'Palm-muted riffs with rhythmic displacement', path: 'djentRiffs' }, { name: 'Palm muting', path: 'palmMuting' }, { name: 'Odd groupings and gear changes', path: 'subdivisions' }],
  sources: ['https://www.musicradar.com/tuition/guitars/how-to-play-guitar-like-tosin-abasi-612264', 'https://guitarworld.com/lessons/tosin-abasi-guitar-technique-workshop', 'https://www.guitarinteractivemagazine.com/tech-session/tosin-abasi/page/3/', 'https://en.wikipedia.org/wiki/Tosin_Abasi', 'https://en.wikipedia.org/wiki/Animals_as_Leaders', 'https://www.premierguitar.com/lessons/expanded-two-hand-tapping'],
  bio: `Tosin Abasi (born 1983 in Washington, D.C.) played in the technical metalcore band Reflux before starting Animals as Leaders as a solo project in 2007. The self-titled debut came out on Prosthetic Records in 2009; with Javier Reyes on second guitar and later Matt Garstka on drums, the instrumental trio followed it with Weightless, The Joy of Motion, The Madness of Many and Parrhesia. The band has no bassist: two eight-string guitars cover the low end.

His playing treats the guitar as a percussion and keyboard instrument as well as a melodic one. He thumps the low strings with his thumb and pops the higher ones with his fingers, taps chords and double stops with both hands, picks fast lines across odd meters, and builds palm-muted riffs from groupings that run against a steady 4/4 until they resolve.

This course builds those techniques one path at a time: thumping, tapped chords, alternate picking, palm muting, odd groupings, then djent riffs, and closes with an 8-string study and soloing over his kind of harmony.`,
  bands: ['Animals as Leaders', 'T.R.A.M.', 'Reflux'],
  ctx: { key: 6, minor: true, prog: 'minorRock' },
  units: [
    PU(thumping, { title: 'Thumping', summary: 'Thumb down and up through the string, index and middle pops: his slap-and-pop groove on the low strings.' }),
    PU(multiTap, { title: 'Tapped chords and double stops', summary: 'Two- and three-finger tapping, double-stop taps, and the two-handed chord style: bass in one hand, colour tones in the other.' }),
    PU(alternatePicking, { title: 'Alternate picking', summary: 'Even, efficient picking for fast lines in any meter.', tiers: ['intermediate', 'advanced', 'mastery'] }),
    PU(palmMuting, { title: 'Palm muting', summary: 'Tight chugs and ringing accents: the touch every riff needs.', tiers: ['foundations', 'intermediate', 'advanced'] }),
    PU(subdivisions, { title: 'Odd groupings and gear changes', summary: 'Fives, sevens and gear changes against the click: the rhythmic engine of his lines.', tiers: ['intermediate', 'advanced', 'mastery'] }),
    PU(djentRiffs, { title: 'Djent riffs and displacement', summary: 'Cells of 5, 7, 9 and 21 sixteenths that cross the bar line and resolve, on 6-, 7- and 8-string guitars.' }),
    U('Putting it together', 'An 8-string study that joins the textures, then solos over his kind of harmony.', [
      S('ta-study', 'A study in his style', 'improv', 'Riff, thumping groove, tapped chords and a closing riff in eight bars.', [c => taStudy(c)]),
      S('ta-solo', 'Solos in his style', 'improv', 'Minor 9th vamps, fives and sevens against the beat, landing on chord tones.', [
        c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Solo in his style over a minor vamp: odd-grouped bursts that land on chord tones, then space' }),
        c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Over a minor progression: palm-muted phrases opening into ringing chord tones' })])])
  ],
  riffs: [
    { title: 'CAFO', artist: 'Animals as Leaders', note: 'Clean tapped arpeggios, odd-time riffs and fast picking.' },
    { title: 'Physical Education', artist: 'Animals as Leaders', note: 'Thumped and popped grooves on the 8-string.' },
    { title: 'The Woven Web', artist: 'Animals as Leaders', note: 'Syncopated low-string riffs against a steady beat.' },
    { title: 'Tempting Time', artist: 'Animals as Leaders', note: 'Palm-muted 8-string riffs and fusion lines.' }
  ] });
