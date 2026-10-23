// Travis picking: an alternating thumb bass on every beat with the fingers playing between the beats.
// From the thumb alone, through one finger, the pinch and the classic pattern, to pattern variations
// (pinches on 1 and 3, every off-beat filled, the syncopated "and of 2"), a walking bass, the
// palm-muted "Merle" thumb, hammer-ons inside the pattern and a melody on top, in every key with a
// capo, to performance tempo, random access and an original accompaniment study.
//
// Concept-first (CONTENT.md): the model is
//   - GRIPS: open-chord shapes (low E … high e) with their root string. The THUMB plays the root string
//     and the next string up, alternating on every beat (6–4 for E- and G-shapes, 5–4 for C- and
//     A-shapes, 4–3 for D-shapes); a WALK replaces the third beat with the chord's 5th or 3rd on
//     another bass string. The FINGERS are roles (i, m, a) mapped to the strings above the thumb's.
//   - The CAPO: any key is reached by playing the open shapes of a nearby key (G, C, D, A or E; Am, Em
//     or Dm in minor) with a capo; the tab shows real frets (open strings at the capo's fret), so every
//     note is the real pitch.
//   - PATTERNS: one bar as thumb beats plus finger events [time, role, kind]: thumb only, one finger,
//     the pinch, the basic pattern, pinches on 1 and 3, every off-beat, the syncopation, the
//     palm-muted thumb, the walking bass, a hammer-on into the thumb's note, and a melody on the top string.
//   - PROGRESSIONS of key degrees (I–vi–IV–V, I–IV–V–I, I–IV–I–V, the ragtime I–VI7–II7–V7, i–♭VI–♭VII–V).
// The composer `tvRun(c, spec)` builds an exercise from progression × pattern plan × key plan (capo) ×
// bars per chord × repeats; every note is tagged with the pitch classes it must belong to (the bar's
// chord, or the key's scale for a hammer-on's first note) for the pitch check.
import { OPEN, N, nameOf, make, mod12, chordInfo, S, stage, entry, M } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
/** Open grips, low E … high e (null = not played), with the root string and the walking-bass note [string, fret]. */
export const GRIPS = {
  C: { f: [null, 3, 2, 0, 1, 0], root: 5, walk: [6, 3] }, A: { f: [null, 0, 2, 2, 2, 0], root: 5, walk: [6, 0] },
  G: { f: [3, 2, 0, 0, 0, 3], root: 6, walk: [5, 2] }, E: { f: [0, 2, 2, 1, 0, 0], root: 6, walk: [5, 2] },
  D: { f: [null, null, 0, 2, 3, 2], root: 4, walk: [5, 0] }, F: { f: [null, null, 3, 2, 1, 1], root: 4, walk: [5, 3] },
  Am: { f: [null, 0, 2, 2, 1, 0], root: 5, walk: [6, 0] }, Em: { f: [0, 2, 2, 0, 0, 0], root: 6, walk: [5, 2] },
  Dm: { f: [null, null, 0, 2, 3, 1], root: 4, walk: [5, 0] }, Bm: null,
  A7: { f: [null, 0, 2, 0, 2, 0], root: 5, walk: [6, 0] }, B7: { f: [null, 2, 1, 2, 0, 2], root: 5, walk: [6, 2] },
  C7: { f: [null, 3, 2, 3, 1, 0], root: 5, walk: [6, 3] }, D7: { f: [null, null, 0, 2, 1, 2], root: 4, walk: [5, 0] },
  E7: { f: [0, 2, 0, 1, 0, 0], root: 6, walk: [5, 2] }, G7: { f: [3, 2, 0, 0, 0, 1], root: 6, walk: [5, 2] }
};
const SUFFIX = { maj: '', min: 'm', dom: '7' };
/** Progressions as [semitones above the key root, quality]. */
export const PROGS = {
  folkAxis: { name: 'I–vi–IV–V', major: true, deg: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']] },
  folk145: { name: 'I–IV–V–I', major: true, deg: [[0, 'maj'], [5, 'maj'], [7, 'maj'], [0, 'maj']] },
  country: { name: 'I–IV–I–V', major: true, deg: [[0, 'maj'], [5, 'maj'], [0, 'maj'], [7, 'maj']] },
  ballad: { name: 'I–V–vi–IV', major: true, deg: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] },
  ragtime: { name: 'I–VI7–II7–V7', major: true, deg: [[0, 'maj'], [9, 'dom'], [2, 'dom'], [7, 'dom']] },
  minor: { name: 'i–♭VI–♭VII–V7', major: false, deg: [[0, 'min'], [8, 'maj'], [10, 'maj'], [7, 'dom']] },
  iVi: { name: 'I–vi', major: true, deg: [[0, 'maj'], [9, 'min']] },
  blues12: { name: 'the 12-bar blues (I7–IV7–V7)', major: true, deg: [[0, 'dom'], [0, 'dom'], [0, 'dom'], [0, 'dom'], [5, 'dom'], [5, 'dom'], [0, 'dom'], [0, 'dom'], [7, 'dom'], [5, 'dom'], [0, 'dom'], [7, 'dom']] },
  minorFolk: { name: 'i–iv–i–V7', major: false, deg: [[0, 'min'], [5, 'min'], [0, 'min'], [7, 'dom']] }
};
const SHAPE_KEYS = { major: [7, 0, 2, 9, 4], minor: [9, 4, 2] };   // G, C, D, A, E · Am, Em, Dm
const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
/** The shape key and capo that play a progression in key k with open grips (smallest capo up to 7). */
export function capoFor(k, prog) {
  const P = PROGS[prog], list = SHAPE_KEYS[P.major ? 'major' : 'minor'];
  let best = null;
  for (const sk of list) {
    const names = P.deg.map(([d, q]) => nameOf(sk + d) + SUFFIX[q]);
    if (!names.every(n => GRIPS[n])) continue;
    const capo = mod12(k - sk); if (capo > 7) continue;
    if (!best || capo < best.capo) best = { sk, capo, shapes: names };
  }
  return best;
}
/** One bar's chord: the grip moved by the capo, the real chord name and tones, the thumb and finger strings. */
function barChord(shapeName, capo, realRoot, q) {
  const g = GRIPS[shapeName], frets = g.f.map(f => (f == null ? null : f + capo));
  const real = nameOf(realRoot) + SUFFIX[q], info = chordInfo(real);
  const alt = g.root === 4 ? 3 : 4, fingers = { i: alt - 1, m: Math.max(1, alt - 2), a: 1 };
  const at = s => frets[6 - s];
  return { shapeName, real, pcs: info.pcs, frets, root: g.root, alt, walk: [g.walk[0], g.walk[1] + capo], fingers, at };
}
/**
 * Patterns: thumb ('q' quarters on R/alt, 'walk' R–alt–walk–alt, 'pm' palm-muted) and finger events
 * [time in beats, role, extra] where extra 'pinch' sounds with the thumb's beat.
 */
export const PATTERNS = {
  thumb: { name: 'thumb only', thumb: 'q', ev: [] },
  thumbpm: { name: 'thumb only, palm-damped', thumb: 'pm', ev: [] },
  mid: { name: 'thumb + middle finger on every "and"', thumb: 'q', ev: [[0.5, 'm'], [1.5, 'm'], [2.5, 'm'], [3.5, 'm']] },
  mi: { name: 'thumb + middle and index on the "ands"', thumb: 'q', ev: [[0.5, 'm'], [1.5, 'i'], [2.5, 'm'], [3.5, 'i']] },
  fill: { name: 'basic pattern with a triplet roll on beat 4', thumb: 'q', fill: true, ev: [[0, 'a'], [0.5, 'm'], [1.5, 'i'], [2.5, 'm'], [10 / 3, 'i', 1 / 3], [11 / 3, 'm', 1 / 3]] },
  one: { name: 'thumb + one finger on the "and" of 2 and 4', thumb: 'q', ev: [[1.5, 'm'], [3.5, 'm']] },
  pinch: { name: 'thumb + a pinch on beat 1', thumb: 'q', ev: [[0, 'a']] },
  basic: { name: 'the basic pattern', thumb: 'q', ev: [[0, 'a'], [0.5, 'm'], [1.5, 'i'], [2.5, 'm'], [3.5, 'a']] },
  pinch13: { name: 'pinches on 1 and 3', thumb: 'q', ev: [[0, 'a'], [0.5, 'm'], [1.5, 'i'], [2, 'a'], [2.5, 'm'], [3.5, 'i']] },
  full8: { name: 'every off-beat filled', thumb: 'q', ev: [[0.5, 'i'], [1.5, 'm'], [2.5, 'a'], [3.5, 'm']] },
  synco: { name: 'the syncopated "and of 2"', thumb: 'q', ev: [[0, 'a'], [0.5, 'm'], [1.5, 'a'], [2.5, 'i'], [3.5, 'm']] },
  muted: { name: 'palm-muted thumb ("Merle" style)', thumb: 'pm', ev: [[0.5, 'm'], [1.5, 'i'], [2.5, 'm'], [3.5, 'a']] },
  walk: { name: 'walking bass', thumb: 'walk', ev: [[0, 'a'], [0.5, 'm'], [1.5, 'i'], [2.5, 'm'], [3.5, 'a']] },
  hammer: { name: 'a hammer-on into beat 2', thumb: 'q', hammer: true, ev: [[0, 'a'], [0.5, 'm'], [1.5, 'i'], [2.5, 'm'], [3.5, 'a']] },
  melody: { name: 'a melody on the top string', thumb: 'q', melody: true, ev: [[0, 'a'], [0.5, 'm'], [1.5, 'a'], [2.5, 'i'], [3.5, 'a']] }
};
/** Top-string melody for a bar: chord tones (and scale tones on off-beats) on string 1 near the grip. */
function melodyFrets(ch, k, sc, capo, bar) {
  const base = ch.at(1), out = [];
  const tones = []; for (let f = Math.max(0, capo); f <= capo + 5; f++) if (ch.pcs.includes(mod12(OPEN[1] + f))) tones.push(f);
  const up = tones.filter(f => f > base), dn = tones.filter(f => f < base);
  const second = bar % 2 ? (dn.length ? dn[dn.length - 1] : base) : (up.length ? up[0] : base);
  out.push(base, second, base);
  return out;
}

/** Notes struck together (a pinch) all carry {chord: true}. */
function pinchMarks(notes) { const by = new Map(); notes.forEach(n => by.set(n.t, (by.get(n.t) || 0) + 1)); notes.forEach(n => { if (by.get(n.t) > 1) n.chord = true; else delete n.chord; }); }

/* ------------------------------- The composer ------------------------------- */
/**
 * spec: { id, name, method, prog, patterns (cycled per bar), keys (key offsets, one block each), minor
 * (use the relative minor of the context's key), barsPerChord, reps, why, instr, watch, simplify, goal,
 * start, dl, minutes }. '{prog}', '{chords}', '{capo}' and '{patterns}' in the text are filled in.
 */
export function tvRun(c, spec) {
  const prog = spec.prog || 'folkAxis', P = PROGS[prog];
  const k0 = P.major ? mod12(c.key - (c.minor ? -3 : 0)) : mod12(c.key - (c.minor ? 0 : 3));
  const pats = (spec.patterns || ['basic']).map(p => PATTERNS[p]);
  const notes = [], chordsUsed = [], voicings = [], capos = [], keyNames = [];
  let bar = 0;
  for (const off of spec.keys || [0]) {
    const k = mod12(k0 + off), cp = capoFor(k, prog); if (!cp) return null;
    capos.push(`${nameOf(k)}${P.major ? '' : 'm'}: capo ${cp.capo || 'none'} (${[...new Set(cp.shapes)].join(', ')} shapes)`); keyNames.push(`${nameOf(k)}${P.major ? '' : 'm'}`);
    const sc = SCALE[P.major ? 'major' : 'minor'].map(x => mod12(k + x));
    for (let rep = 0; rep < (spec.reps || 1); rep++) P.deg.forEach(([d, q], ci) => {
      const ch = barChord(cp.shapes[ci], cp.capo, k + d, q);
      if (rep === 0 && !voicings.find(v => v.name === ch.real)) voicings.push({ name: ch.real, frets: ch.frets.slice() });
      for (let bb = 0; bb < (spec.barsPerChord || 1); bb++) {
        const pat = pats[bar % pats.length], T = bar * 4; chordsUsed.push(ch.real);
        // thumb
        const bass = pat.thumb === 'walk' ? [ch.root, ch.alt, ch.walk[0], ch.alt] : [ch.root, ch.alt, ch.root, ch.alt];
        bass.forEach((s, i) => {
          const f = pat.thumb === 'walk' && i === 2 ? ch.walk[1] : ch.at(s);
          if (pat.hammer && i === 1) {
            // a hammer-on into the thumb's beat-2 note from a key-scale note one or two frets below
            const lo = [1, 2].map(x => f - x).find(x => x >= cp.capo && x >= 0 && sc.includes(mod12(OPEN[s] + x)) && !ch.pcs.includes(mod12(OPEN[s] + x)));
            if (lo != null) { notes.push(tag(N(s, lo, T + i, 0.5, null, { fing: 'p' }), sc)); notes.push(tag(N(s, f, T + i + 0.5, 0.5, 'h'), ch.pcs)); return; }
          }
          notes.push(tag(N(s, f, T + i, pat.fill && i === 3 ? 1 / 3 : 1, pat.thumb === 'pm' ? 'pm' : null, i === 0 && bar === 0 ? { fing: 'p' } : null), ch.pcs));
        });
        // fingers
        const mel = pat.melody ? melodyFrets(ch, k, sc, cp.capo, bar) : null; let mi = 0;
        pat.ev.forEach(([t, role, dd]) => {
          if (pat.hammer && t === 1.5) return;   // the hammer-on owns the "and" of 2
          const s = ch.fingers[role]; let f = ch.at(s); if (f == null) return;
          if (mel && role === 'a') f = mel[Math.min(mel.length - 1, mi++)];
          notes.push(tag(N(s, f, T + t, typeof dd === 'number' ? dd : t % 1 === 0 ? 1 : 0.5, null, { ...(t % 1 === 0 ? { chord: true } : {}), ...(bar === 0 ? { fing: role } : {}) }), ch.pcs));
        });
        bar++;
      }
    });
  }
  if (!notes.length) return null;
  pinchMarks(notes);
  const uniq = [...new Set(chordsUsed)];
  const fill = s => String(s || '').replace('{prog}', P.name).replace('{chords}', chordsUsed.slice(0, 8).join(' – ')).replace('{capo}', capos.join('; ')).replace('{keys}', keyNames.join(', ')).replace('{patterns}', [...new Set(pats.map(p => p.name))].join(', '));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'picking', method: spec.method, unit: pats.every(p => !p.ev.length) ? 'quarter notes' : '8th notes', goal: spec.goal || 96, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'fingers',
    voicings: voicings.slice(0, 8), chords: uniq.slice(0, 8), backing: chordsUsed.slice(0, 16),
    why: fill(spec.why), instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes: notes.slice(0, 400) }
  });
}
const T_ = (id, name, method, opts) => c => tvRun(c, { id, name, method, ...opts });
const HOLD = 'Hold each chord shape for the whole bar so the notes ring. Thumb (p) on every beat, alternating root string and the next string up; fingers i, m, a on the strings above. ';

/* ------------------------------ Generators ------------------------------ */
/** An original 8-bar accompaniment study (capstone): basic, walk, syncopation with melody, hammer-on, minor turn, ending. */
export function tvEtude(c) {
  const parts = [['basic'], ['walk'], ['melody'], ['hammer']];
  const all = [], voic = [], chordsUsed = [];
  for (const [i, pats] of parts.entries()) {
    const ex = tvRun(c, { id: 'x', name: 'x', method: 'transfer', prog: 'folkAxis', patterns: pats, reps: 2, why: 'x', instr: 'x', watch: 'x', simplify: 'x' }); if (!ex) return null;
    ex.tab.notes.filter(n => n.t >= 8 * i && n.t < 8 * i + 8).forEach(n => { const m = { ...n }; ALLOW.set(m, ALLOW.get(n)); all.push(m); });
    ex.voicings.forEach(v => { if (!voic.find(x => x.name === v.name)) voic.push(v); });
    chordsUsed.push(...ex.backing.slice(2 * i, 2 * i + 2));
  }
  return make(c, {
    id: 'tv-etude', name: `Capstone study: an 8-bar Travis accompaniment (${chordsUsed.join(' – ')})`, domain: 'picking', method: 'transfer', unit: '8th notes', goal: 96, start: 52, minutes: 8, picking: 'fingers',
    voicings: voic, chords: [...new Set(chordsUsed)], backing: chordsUsed,
    why: 'An original accompaniment that uses the whole path in eight bars: the basic pattern, the walking bass, a melody on the top string and a hammer-on into the thumb, without the thumb ever stopping.',
    instr: 'Learn it two bars at a time (each pair uses one idea), then join them. Keep the thumb identical through every change of idea. Then arrange your own 8 bars over the same chords, choosing a pattern for each pair of bars. Pass: the study at the goal tempo with no stops, then your arrangement played through once.',
    watch: 'The thumb stumbling where the walking bass or the hammer-on starts.', simplify: 'Bars 1–4 only.', tab: { notes: all }
  });
}

/* --------------------------------- The path --------------------------------- */
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'travis', kind: 'technique', title: 'Travis picking', domain: 'picking',
  re: /travis(-| )?pick|travis (pattern|style)|alternating(-| )thumb|alternating bass fingerpick/,
  aliases: ['alternating bass fingerpicking', 'Travis-style fingerpicking'],
  summary: 'An alternating thumb bass with the fingers between the beats: from the thumb alone, then one finger at a time, the pinch and chord changes, to pattern variations, a capo in any key, the Travis blues, a walking and a palm-muted bass, a melody on top, hammer-ons, fills and a whole arrangement.',
  prereqs: [],
  sources: ['https://www.premierguitar.com/articles/19838-twang-101-travis-picking-essentials', 'https://www.guitarworld.com/lessons/how-fingerpick-merle-travis', 'https://www.fender.com/articles/how-to/travis-picking-on-guitar', 'https://goodguitarist.com/travis-picking-patterns'],
  pedagogy: {
    date: '2026-10-23',
    summary: 'Taught from the thumb outward: the alternating bass alone until it runs by itself (lightly palm-damped), then the fingers added one at a time on their own strings (middle, then index, then the pinch with the thumb), then chord changes under the pattern and a first song. After that the same hands learn variations (off-beat and syncopated notes), a melody on the top strings, hammer-ons and fills, and the pattern is applied to progressions and to the Travis blues, one bar looped and the next added when the first runs on its own.',
    sequence: [
      { id: 'thumb', tier: 'foundations', step: 'The alternating thumb alone', how: 'The thumb bounces between two bass strings in steady beats over one chord, lightly palm-damped, never resting on the strings above; slowly until it runs by itself.', skills: ['travis-thumb'], source: 0 },
      { id: 'fingers', tier: 'foundations', step: 'The fingers added one at a time', how: 'Thumb plus the middle finger on the B string between the bass notes, then the index on the G string; the thumb and a finger together (the pinch); each finger keeps its own string.', skills: ['travis-fingers'], source: 2 },
      { id: 'changes', tier: 'foundations', step: 'Chord changes under the pattern', how: 'Switching between two chords while the pattern keeps going, the thumb moving to the new chord’s root string on the first beat.', skills: ['travis-changes'], source: 2 },
      { id: 'song', tier: 'foundations', step: 'The pattern in a first song', how: 'A familiar progression played with the pattern, slowly, until the thumb never stops.', skills: ['travis-first-music'], source: 3 },
      { id: 'variations', tier: 'intermediate', step: 'Off-beat notes, syncopation and joined bars', how: 'Finger notes placed on the off-beats and moved early so they ring over the next beat; one bar looped until it is automatic, then a second pattern added.', skills: ['travis-patterns'], source: 0 },
      { id: 'keys', tier: 'intermediate', step: 'Other keys with the same shapes', how: 'The open shapes kept and a capo used to change key, then the minor shapes.', skills: ['travis-keys'], source: 3 },
      { id: 'bass', tier: 'intermediate', step: 'A moving and a damped bass', how: 'The thumb’s bass notes varied (root, fifth, a walking note) and the bass strings palm-muted for a thud under the ringing fingers.', skills: ['travis-bass'], source: 1 },
      { id: 'blues', tier: 'intermediate', step: 'The Travis blues', how: 'The pattern on E7, A7 and B7 over a 12-bar blues, the muted thumb first, learned bar by bar.', skills: ['travis-blues'], source: 1 },
      { id: 'music1', tier: 'intermediate', step: 'Accompanying songs', how: 'Ragtime and country progressions with the pattern as a whole accompaniment.', skills: ['travis-music-i'], source: 0 },
      { id: 'melody', tier: 'advanced', step: 'A melody on the top strings', how: 'A simple melody on beats and then on the off-beats over the steady thumb; the melody louder than the inner notes.', skills: ['travis-melody'], source: 0 },
      { id: 'hammer', tier: 'advanced', step: 'Hammer-ons and ornaments', how: 'A hammer-on into a chord tone, in time as an 8th note rather than a slide, without the thumb rushing.', skills: ['travis-hammer'], source: 0 },
      { id: 'fills', tier: 'advanced', step: 'Fills', how: 'A triplet roll with the thumb and two fingers at the end of a phrase, then the thumb hops back to the bass.', skills: ['travis-fills'], source: 0 },
      { id: 'anykey', tier: 'advanced', step: 'Any key, major and minor', how: 'The pattern and its variations moved with the capo through major and minor keys.', skills: ['travis-anykey'], source: 3 },
      { id: 'music2', tier: 'advanced', step: 'Song arrangements', how: 'Textures changed from section to section: a sparse intro, a fuller verse, an ending.', skills: ['travis-music-a'], source: 1 },
      { id: 'perf', tier: 'mastery', step: 'Performance tempo', how: 'The busiest textures raised in small tempo steps once each pass is clean.', skills: ['travis-perf'], source: 0 },
      { id: 'anywhere', tier: 'mastery', step: 'Any pattern in any key', how: 'Patterns and keys changed without warning, as an accompanist is asked to.', skills: ['travis-random'], source: 3 },
      { id: 'voice', tier: 'mastery', step: 'Your own arrangement', how: 'A complete accompaniment worked out and then rearranged by the player.', skills: ['travis-voice'], source: 1 }
    ],
    drills: ['The thumb alone, alternating two bass strings over one chord', 'Thumb plus the middle finger, then plus the index finger', 'The pinch: thumb and a finger together on beat 1', 'Switching between two chords with the pattern running', 'One bar looped until it runs by itself, then the next added', 'The 12-bar blues with a palm-damped thumb', 'A triplet roll on the last beat, then back to the bass'],
    mistakes: ['The thumb copying the fingers’ rhythm instead of holding every beat', 'Resting the thumb on the upper strings, which blocks later melody notes', 'Rushing the hammered note or the triplet fill', 'Moving on before the current pattern is played in time', 'Unclear finger assignments: each finger should keep its own string'],
    sources: [
      { title: 'Twang 101: Travis Picking Essentials', author: 'Premier Guitar', url: 'https://www.premierguitar.com/articles/19838-twang-101-travis-picking-essentials' },
      { title: 'Travis picking: how to fingerpick like Merle Travis', author: 'Guitar World', url: 'https://www.guitarworld.com/lessons/how-fingerpick-merle-travis' },
      { title: 'Travis picking on guitar', author: 'Ben Nemeroff (Fender)', url: 'https://www.fender.com/articles/how-to/travis-picking-on-guitar' },
      { title: 'Travis picking patterns', author: 'Good Guitarist', url: 'https://goodguitarist.com/travis-picking-patterns' }
    ]
  },
  ctx: { key: 0, minor: false, prog: 'folkAxis' },
  stages: [
    stage('foundations', 'The thumb, then the fingers',
      'Play the alternating thumb through I–vi–IV–V for 8 bars at 90 BPM without a pause at the changes, add the middle finger and then the index on their own strings, play the pinch, change between two chords with the pattern running, and play the basic pattern through a simple song progression at 70 BPM.', [
        S('travis-thumb', 'The thumb on autopilot', 'picking', 'Thumb alone on one chord, damped, then through the changes.', [
          T_('tv-thumb-one', 'Thumb only on one chord: root string, next string up ({chords})', 'accurate-reps', { prog: 'folk145', patterns: ['thumb'], barsPerChord: 2, goal: 100, start: 56, why: 'Travis picking only works when the thumb runs on autopilot: one note on every beat, root string then the next string up, never waiting for anything.', instr: HOLD + 'Thumb only, two bars per chord. Keep the thumb off the strings above the bass strings. Count only bars where every beat is even. Pass: 8 even bars in a row.', watch: 'Accenting the root and swallowing the alternate note.', simplify: 'One chord, half the tempo.' }),
          T_('tv-thumb-damped', 'Thumb only with the palm lightly damping the bass strings ({chords})', 'external-focus', { prog: 'folk145', patterns: ['thumbpm'], barsPerChord: 2, goal: 96, start: 52, why: 'A light palm damp on the bass strings (the edge of the picking hand near the bridge) separates the bass from the fingers and gives the clicky, percussive tone of Travis picking.', instr: HOLD + 'Rest the edge of the picking palm lightly on the bass strings so each note stops quickly; the thumb moves in a small near-circular motion. Listen for a short, clear bass. Pass: 8 even bars with every bass note short and clean.', watch: 'Pressing so hard the notes go dead.', simplify: 'Without the damp, then add it for one chord.' }),
          T_('tv-thumb-changes', 'Thumb only through {prog}, one chord a bar ({chords})', 'chunking', { prog: 'folkAxis', patterns: ['thumb'], goal: 96, start: 52, why: 'The changes are where the thumb stops. Practising only the change (the last beat of one chord into the first of the next) fixes the gap where it happens.', instr: HOLD + 'First loop just beat 4 of each chord into beat 1 of the next, then the whole progression. The new chord’s root string comes on beat 1: change the grip during beat 4. Pass: 4 times through with no gap at any change.', watch: 'Changing the grip late, so beat 1 is missing.', simplify: 'Two bars per chord.' })],
          ST('The thumb (p) plays every beat: the chord’s root string, then the next string up, alternating. It is the clock of the whole pattern, and the first thing taught in every method.', 'Everything else in Travis picking sits on top of the thumb; if it hesitates, the groove falls apart.', ['E- and G-shapes: strings 6 and 4. C- and A-shapes: 5 and 4. D-shapes: 4 and 3.', 'Hold the whole chord so the bass notes ring into each other, or damp them lightly with the palm.', 'Keep the thumb away from the upper strings so they stay free for the fingers.'])),
        S('travis-fingers', 'Adding the fingers', 'picking', 'The middle finger, the index, then the pinch and the basic pattern.', [
          T_('tv-one-finger', 'One finger on the "and" of 2 and 4 ({chords})', 'chunking', { prog: 'folk145', patterns: ['one'], barsPerChord: 2, goal: 92, start: 48, why: 'Adding a finger between the thumb’s beats is the hardest moment in Travis picking: the thumb must keep its quarter notes while the finger plays between them. One finger, twice a bar, is the smallest step.', instr: HOLD + 'The middle finger (m) plucks the B string on the "and" of 2 and the "and" of 4. Pass: 8 bars where the thumb stays even while the finger joins.', watch: 'The thumb copying the finger’s rhythm.', simplify: 'Thumb only for one bar, then one bar with the finger.' }),
          T_('tv-mid-every', 'Thumb and the middle finger on every "and" ({chords})', 'accurate-reps', { prog: 'folk145', patterns: ['mid'], barsPerChord: 2, goal: 92, start: 48, why: 'The middle finger on the B string answers each thumb beat. Steady 8th notes between the beats lock the finger to the thumb before a second finger joins.', instr: HOLD + 'Thumb on 1, 2, 3, 4; middle finger (m) on the B string on every "and". Count only clean bars. Pass: 8 bars with the thumb and the finger perfectly alternating.', watch: 'The finger rushing the thumb.', simplify: 'The previous lesson, one finger twice a bar.' }),
          T_('tv-two-fingers', 'Thumb, middle and index alternating on the "ands" ({chords})', 'chunking', { prog: 'folk145', patterns: ['mi'], barsPerChord: 2, goal: 92, start: 48, why: 'The index finger takes the G string beside the middle finger on the B string. Each finger owns one string, so the sound stays clean.', instr: HOLD + 'Off-beats: middle (B string), index (G string), middle, index, with the thumb on every beat. Pass: 8 bars with the two fingers staying on their own strings.', watch: 'The index and middle swapping strings.', simplify: 'Middle finger only.' }),
          T_('tv-pinch', 'The pinch: thumb and ring finger together on beat 1 ({chords})', 'chunking', { prog: 'folk145', patterns: ['pinch'], barsPerChord: 2, goal: 92, start: 48, why: 'A pinch (thumb and a finger at the same moment) anchors the bar. Practising it alone teaches the two digits to move together without the thumb losing its beat afterwards.', instr: HOLD + 'Beat 1: thumb on the root string and ring finger (a) on the high e at the same time; beats 2–4: thumb only. Pass: 8 bars with the two notes of every pinch sounding as one.', watch: 'The finger landing a little after the thumb (a flam).', simplify: 'The pinch on beat 1 of every other bar.' }),
          T_('tv-basic', 'The basic Travis pattern through {prog} ({chords})', 'accurate-reps', { prog: 'folkAxis', patterns: ['basic'], goal: 88, start: 46, why: 'The classic pattern: the pinch on beat 1, then the fingers on every "and" except the second (B, G, B, e), the thumb on every beat underneath. It is the accompaniment behind folk, country and fingerstyle pop.', instr: HOLD + 'Index (i) on the G string, middle (m) on the B, ring (a) on the high e (on D-shapes everything moves up one string). Count only clean bars. Pass: 4 clean times through the progression.', watch: 'The thumb hesitating when a finger joins.', simplify: 'The one-finger version for a minute, then back.' })],
          ST('The fingers play between the thumb’s beats, each on its own string: index on the G, middle on the B, ring on the high e (the PIMA idea: p thumb, i index, m middle, a ring). A pinch is the thumb and a finger together.', 'Two independent parts from one hand, bass and treble, is what makes one guitar sound like two.', ['Add one finger at a time; move on only when the pattern so far is in time.', 'The basic pattern: pinch on 1, then the fingers on the "and" of 1, 2, 3 and 4.', 'Each finger owns one string; the thumb owns the bass strings.'])),
        S('travis-changes', 'Changing chords under the pattern', 'fretting', 'Two chords, then three, with the pattern running.', [
          T_('tv-switch-two', 'Two chords, the pattern running: {prog}, two bars each ({chords})', 'chunking', { prog: 'iVi', patterns: ['basic'], barsPerChord: 2, reps: 2, goal: 88, start: 46, why: 'Switching between just two chords is the standard first test of the pattern: the hand must change shape without the thumb stopping.', instr: HOLD + 'Play two bars on each chord. Change the grip during beat 4, and let the thumb find the new root string on beat 1. Pass: 4 changes with the thumb never pausing.', watch: 'Stopping the thumb to change the grip.', simplify: 'Thumb only on the change bar.' }),
          T_('tv-switch-bar', 'The changes come every bar: {prog} ({chords})', 'chunking', { prog: 'folk145', patterns: ['basic'], barsPerChord: 1, reps: 2, goal: 84, start: 44, why: 'With one chord a bar the change comes round twice as often, so the hand has half the time to prepare it.', instr: HOLD + 'One bar on each chord. Look ahead to the next shape during beats 3 and 4. Pass: twice through with no gap at any change.', watch: 'Looking at the picking hand instead of the next chord.', simplify: 'Two bars per chord.' })],
          ST('A change has to happen while the pattern keeps going; the thumb finds the next chord’s root string on beat 1.', 'The rest of playing songs is built on this skill.', ['Move the fretting hand on beat 4, before the new bar starts.', 'Chords with a shared note keep that finger in place to help.'])),
        S('travis-first-music', 'First music', 'picking', 'The pattern in a song progression.', [
          T_('tv-first-song', 'First song: the basic pattern over {prog}, two bars per chord ({chords})', 'transfer', { prog: 'folk145', patterns: ['basic'], barsPerChord: 2, goal: 88, start: 46, why: 'Two bars per chord gives the hand time to settle before each change, the way most folk songs move. This is the first real accompaniment.', instr: HOLD + 'Play it as a song: quietly, evenly, the thumb a little louder than the fingers. Pass: twice through with no stops.', watch: 'Speeding up in the second bar of each chord.', simplify: 'The one-finger pattern.' }),
          M('transfer', ['travisPattern', { chords: ['G', 'Em', 'C', 'D'] }])],
          ST('A song accompaniment is the pattern held steady under changing chords.', 'Applying the pattern to progressions you already play is how every method ends its first stage.', ['Most songs change chord every one or two bars.']))
      ], [1, 3]),
    stage('intermediate', 'Variations, keys and the bass',
      'Play the pattern with pinches on 1 and 3, every off-beat filled and the syncopated "and of 2" at 96 BPM, join two patterns bar by bar, switch keys with a capo, walk and palm-mute the bass, play a Travis blues in E, and accompany a ragtime and a country progression.', [
        S('travis-patterns', 'Pattern variations', 'picking', 'Pinches on 1 and 3, every off-beat, the syncopation; two patterns joined.', [
          T_('tv-pinch13', 'Pinches on 1 and 3 ({chords})', 'variable', { prog: 'folkAxis', patterns: ['pinch13'], goal: 96, start: 52, why: 'A second pinch on beat 3 gives the bar two strong points: a fuller, more even sound.', instr: HOLD + 'Pinch (thumb + ring) on beats 1 and 3, middle and index on the "ands". Pass: 4 clean times through.', watch: 'The second pinch flamming.', simplify: 'The basic pattern.' }),
          T_('tv-full8', 'Every off-beat filled: i, m, a, m ({chords})', 'variable', { prog: 'folkAxis', patterns: ['full8'], goal: 96, start: 52, why: 'Fingers on every "and" make a continuous rolling stream of 8th notes over the thumb: the busier sound of country and fingerstyle instrumentals.', instr: HOLD + 'Off-beats: index, middle, ring, middle. Thumb on every beat. Pass: 4 clean times through.', watch: 'The fingers rushing ahead of the thumb.', simplify: 'Half the bars with the basic pattern.' }),
          T_('tv-synco', 'The syncopated "and of 2": the top note that anticipates beat 3 ({chords})', 'variable', { prog: 'folkAxis', patterns: ['synco'], goal: 92, start: 50, why: 'Moving the high-e note to the "and" of 2 makes it arrive before beat 3 and ring over it: the syncopation that gives Travis picking its bounce.', instr: HOLD + 'Pinch on 1, middle on the "and" of 1, ring on the "and" of 2 (let it ring over beat 3), index on the "and" of 3, middle on the "and" of 4. Pass: 4 times through with the thumb dead even under the syncopation.', watch: 'The thumb moving to meet the syncopated note.', simplify: 'Only the first two beats syncopated, then thumb only.' }),
          T_('tv-join', 'Two patterns joined: basic, then syncopated, bar by bar ({chords})', 'chunking', { prog: 'folkAxis', patterns: ['basic', 'synco'], reps: 2, goal: 92, start: 50, why: 'Loop one bar until it runs by itself, then add the next: the standard way to build a longer phrase from patterns you already know.', instr: HOLD + 'Loop the basic bar four times, then the syncopated bar four times, then alternate them bar by bar. Pass: 8 bars alternating with the thumb never pausing.', watch: 'Carrying the last pattern into the next bar.', simplify: 'Four bars of each, no alternating.' })],
          ST('The same thumb carries many finger patterns: pinches on 1 and 3, every off-beat filled, or a top note moved early (syncopation).', 'Varying the pattern keeps an accompaniment alive and matches it to the song.', ['A syncopated note lands between beats and is held over the next beat.', 'Loop one bar until it is automatic, then add the next.'])),
        S('travis-keys', 'Any key with a capo', 'fretboard', 'Open shapes, capo moved: four keys, a minor key.', [
          T_('tv-capo-keys', 'Four keys with a capo, a new key every block ({keys})', 'interleaving', { prog: 'folkAxis', patterns: ['basic'], keys: [0, 7, 2, 9], goal: 92, start: 50, why: 'With a capo, the same open shapes play in any key; the tab shows the real frets, so the open strings sit at the capo. Changing key every block means finding the shapes again each time.', instr: HOLD + 'Each block is a new key: {capo}. The tab counts from the nut: with the capo on, fret numbers equal to the capo are the "open" strings of the shape. Pass: all four blocks without a stop.', watch: 'Forgetting to move the capo: check the first chord’s bass note.', simplify: 'Two keys.' }),
          T_('tv-minor', 'A minor key: the pattern over {prog} ({chords})', 'variable', { prog: 'minor', patterns: ['basic'], goal: 92, start: 50, why: 'Minor-key songs use the same pattern over minor shapes (Am, Em, Dm and their neighbours): a darker sound with the same hands.', instr: HOLD + 'The V7 chord is major (the raised 7th of harmonic minor): listen to how it pulls back to the i chord. Pass: 4 clean times through.', watch: 'The thumb on the wrong string for the Am shape (5 and 4, not 6 and 4).', simplify: 'Two bars per chord.' })],
          ST('A capo raises every open string; the open shapes keep their fingering and change key.', 'It is how fingerstyle players get open-string resonance in any key.', ['Capo on fret 2 + G shapes = A major.', 'In the tab, the capo’s fret is the shape’s open string.'])),
        S('travis-bass', 'The bass moves', 'picking', 'A walking bass; the palm-muted thumb.', [
          T_('tv-walk', 'Walking bass: the third beat on another bass string ({chords})', 'chunking', { prog: 'folkAxis', patterns: ['walk'], goal: 92, start: 48, why: 'Moving the thumb’s third beat to another bass note (the 5th under C- and A-shapes, the 3rd under G- and E-shapes) turns the bass into a line, the way Chet Atkins and Merle Travis played it.', instr: HOLD + 'Beat 3 of each bar: the thumb goes to the walking note (the fretting hand moves one finger for C-shapes). Loop beats 2–4 of one chord first, then the whole progression. Pass: 4 clean times through.', watch: 'The fingers stopping while the thumb walks.', simplify: 'Walk only on the first chord.' }),
          T_('tv-muted', 'The palm-muted thumb: thud in the bass, ring in the treble ({chords})', 'external-focus', { prog: 'country', patterns: ['muted'], goal: 96, start: 52, why: 'Resting the picking palm on the bass strings makes the thumb thud while the fingers ring: the country "Merle" sound. Listening for the two sounds keeps the mute on the bass only.', instr: HOLD + 'The edge of the picking palm rests on strings 6–4 by the bridge; the fingers’ strings ring. Listen: bass short with pitch, treble long. Pass: 4 times through with every bass note muted and every finger note ringing.', watch: 'The palm creeping onto the G string and muting the fingers too.', simplify: 'Thumb only, muted, then add the fingers.' })],
          ST('The thumb can walk (move to another bass note on beat 3) and can be palm-muted for a percussive bass.', 'A moving or muted bass is what makes Travis picking sound like Merle Travis and Chet Atkins rather than an exercise.', ['Walking notes are chord tones: the 5th or the 3rd on another bass string.', 'Mute only the bass strings: the treble keeps ringing.'])),
        S('travis-blues', 'The Travis blues', 'picking', 'The 12-bar blues with a muted thumb, then the full pattern.', [
          T_('tv-blues-muted', 'Travis blues: muted thumb over {prog}, learned four bars at a time ({chords})', 'chunking', { prog: 'blues12', patterns: ['muted'], goal: 96, start: 52, why: 'The classic Travis vehicle is a 12-bar blues on E7, A7 and B7: the muted thumb on the bass, the fingers ringing over it.', instr: HOLD + 'Learn the first four bars, then add four more, then all twelve. Palm-mute the bass strings and keep the fingers ringing. Pass: the 12 bars once through with no stop.', watch: 'Losing the thumb at the IV and V chords.', simplify: 'The first four bars only.' }),
          T_('tv-blues-full', 'Travis blues: the basic pattern with a hammer-on every fourth bar ({chords})', 'transfer', { prog: 'blues12', patterns: ['basic', 'basic', 'basic', 'hammer'], goal: 92, start: 50, why: 'The same twelve bars with the full pattern, and a hammer-on into the thumb’s note every fourth bar for a bluesy touch.', instr: HOLD + 'Every fourth bar replaces the "and" of 2 with a hammer-on into the thumb’s note. Pass: the 12 bars twice through in time.', watch: 'The hammer-on rushing beat 3.', simplify: 'Basic pattern only.' })],
          ST('A 12-bar blues in a dominant-7 key (I7, IV7, V7) is the traditional Travis-picking form.', 'It shows the pattern working in a real form, bar by bar, the way the Guitar World lesson builds it.', ['I7–IV7–V7: in E, E7–A7–B7.', 'Learn four bars at a time, then join them.'])),
        S('travis-music-i', 'Accompanying songs', 'picking', 'Ragtime changes and a country progression.', [
          T_('tv-ragtime', 'Ragtime changes: {prog} with the basic pattern ({chords})', 'transfer', { prog: 'ragtime', patterns: ['basic'], barsPerChord: 2, goal: 92, start: 50, why: 'The ragtime progression (dominant chords moving around the cycle of fourths) is the classic Travis-picking vehicle: each 7th chord pulls to the next.', instr: HOLD + 'Two bars per chord; the 7th chords change one or two fingers from the open shapes. Play it as a piece, with the thumb slightly louder. Pass: twice through without a stop.', watch: 'The thumb on the wrong string for the A7 shape.', simplify: 'One bar per chord, one-finger pattern.' }),
          T_('tv-country', 'Country accompaniment: {prog}, syncopated, muted thumb ({chords})', 'transfer', { prog: 'country', patterns: ['synco', 'muted'], reps: 2, goal: 96, start: 52, why: 'Country fingerpicking mixes the syncopated pattern with a muted thumb: bounce in the treble, thud in the bass.', instr: HOLD + 'Odd bars: the syncopated pattern; even bars: the muted thumb. Pass: twice through in time, with the two sounds clearly different.', watch: 'The syncopation dragging the thumb.', simplify: 'Syncopated pattern only.' })],
          ST('Patterns become accompaniment when they fit a song’s chords and feel.', 'This is what Travis picking is for: backing a song with bass and chords from one guitar.', ['Ragtime: I–VI7–II7–V7, each chord the V7 of the next.']))
      ], [4, 6]),
    stage('advanced', 'Melody, hammer-ons, fills, any key',
      'Play a melody on the top string over the thumb, hammer-ons into the thumb’s beat, a triplet-roll fill, the pattern in four major and four minor keys, and an 8-bar song accompaniment with an intro, at 100 BPM.', [
        S('travis-melody', 'Melody on top', 'picking', 'The ring finger plays a line, not one note.', [
          T_('tv-melody', 'A melody on the high e over the thumb ({chords})', 'variable', { prog: 'folkAxis', patterns: ['melody'], goal: 96, start: 52, why: 'In fingerstyle arrangements the top string carries a melody while the thumb keeps the bass. Here the ring finger plays a short line of chord tones near the shape on beats 1, the "and" of 2 and the "and" of 4.', instr: HOLD + 'The fretting hand reaches the melody notes on the high e while holding the rest of the chord (move one finger only). Pass: 4 clean times through with the melody clearly louder than the inner notes.', watch: 'Letting go of the chord to reach the melody note.', simplify: 'Melody on beat 1 only.' }),
          T_('tv-melody-ballad', 'Melody over {prog}, two bars per chord ({chords})', 'variable', { prog: 'ballad', patterns: ['melody', 'synco'], barsPerChord: 2, goal: 92, start: 50, why: 'A ballad progression with the melody bar and the syncopated bar alternating: the line rises, then bounces.', instr: HOLD + 'Bar 1 of each chord: melody pattern; bar 2: syncopated. Pass: twice through with the melody singing over the pattern.', watch: 'The thumb getting louder than the melody.', simplify: 'Melody pattern only.' })],
          ST('The top string can carry a melody (chord tones reached with one free finger) over the thumb’s bass.', 'This is the step from accompaniment to solo fingerstyle: melody, harmony and bass at once.', ['Choose melody notes from the chord, one or two frets from the shape.', 'A melody note on an off-beat is held over the next beat.'])),
        S('travis-hammer', 'Hammer-ons inside the pattern', 'fretting', 'A hammer-on into the thumb’s beat.', [
          T_('tv-hammer', 'A hammer-on into beat 2 ({chords})', 'variable', { prog: 'folkAxis', patterns: ['hammer'], goal: 92, start: 50, why: 'Plucking a note just below a chord tone and hammering onto it on the "and" makes the bass sing; it is one of the commonest fingerstyle decorations.', instr: HOLD + 'Beat 2: the thumb plucks a key note one or two frets below the bass note, the fretting finger hammers onto the chord tone on the "and". The fingers’ note on the "and" of 2 is left out. Pass: 4 times through with the hammered note as loud as the plucked one and played in time as an 8th note.', watch: 'A weak hammer-on: snap the finger down near the fret.', simplify: 'Hammer only on the first chord.' }),
          T_('tv-hammer-walk', 'Hammer-ons and walking bass interleaved ({chords})', 'interleaving', { prog: 'folkAxis', patterns: ['hammer', 'walk', 'basic', 'hammer'], reps: 2, goal: 92, start: 50, why: 'Mixing the decorations bar by bar trains the hand to choose them freely, the way an arranger would.', instr: HOLD + 'Bar by bar: hammer-on, walking bass, basic, hammer-on, twice through. Pass: 8 bars without the thumb losing a beat.', watch: 'The walking note and the hammer-on landing on the same beat: they belong to different beats.', simplify: 'Hammer-on and basic only.' })],
          ST('A hammer-on from a scale note into a chord tone decorates the bass without breaking the thumb’s rhythm.', 'Decorations make an accompaniment personal and musical.', ['The first note is a scale tone, the hammered note a chord tone.'])),
        S('travis-fills', 'Fills', 'picking', 'A triplet roll on beat 4, then the thumb hops back.', [
          T_('tv-fill', 'A triplet-roll fill on beat 4 every fourth bar ({chords})', 'chunking', { prog: 'folkAxis', patterns: ['basic', 'basic', 'basic', 'fill'], reps: 2, goal: 88, start: 46, why: 'A fill marks the end of a phrase: on the last beat the thumb, index and middle roll through a triplet, then the thumb hops back to the root.', instr: HOLD + 'Bars 1–3: the basic pattern. Bar 4, beat 4: thumb, index, middle as three even triplet notes, then back to the bass on bar 1. Practise the roll alone first. Pass: 2 times through with an even triplet and no rush.', watch: 'Rushing the triplet, which makes it fall apart.', simplify: 'Thumb and index only in the fill.' }),
          T_('tv-fill-blues', 'Fills at the turnaround of a 12-bar blues ({chords})', 'transfer', { prog: 'blues12', patterns: ['basic', 'basic', 'basic', 'fill'], goal: 88, start: 46, why: 'Ending a phrase with a fill is the habit that turns a pattern into a song.', instr: HOLD + 'The basic pattern with the triplet roll closing each four-bar phrase. Pass: the 12 bars once through with each fill even.', watch: 'Tension in the hand on the fill.', simplify: 'Fill on the last bar only.' })],
          ST('A fill is a short run (here a triplet roll of thumb, index and middle) at the end of a phrase, before the thumb returns to the bass.', 'Fills show where a phrase ends and keep an accompaniment interesting.', ['A triplet puts three even notes in one beat.', 'The roll rises from the bass string through the middle strings.'])),
        S('travis-anykey', 'Any key', 'fretboard', 'Major and minor keys around the neck.', [
          T_('tv-keys-minor', 'Minor keys with a capo, a new key every block ({keys})', 'interleaving', { prog: 'minorFolk', patterns: ['basic', 'walk'], keys: [0, 5, 7, 2], goal: 92, start: 50, why: 'Minor keys need the Am, Em and Dm families; changing key every block trains you to pick the right family and capo on the spot.', instr: HOLD + 'Each block a new minor key: {capo}. Pass: all four blocks in time.', watch: 'Using a major shape family by habit.', simplify: 'Two keys.' }),
          T_('tv-keys-major', 'Four major keys with the syncopated pattern, a new key every block ({keys})', 'interleaving', { prog: 'country', patterns: ['synco'], keys: [0, 5, 10, 3], goal: 96, start: 52, why: 'The same pattern in four keys a fourth apart: the capo changes and the shape family changes with it.', instr: HOLD + 'Each block is a new key: {capo}. Pass: all four blocks in time with the thumb unbroken.', watch: 'Picking a shape family that needs a capo above 7 when a lower one exists.', simplify: 'Two keys.' })],
          ST('Every key has an open-shape family and a capo fret that reaches it: G, C, D, A or E shapes for major; Am, Em or Dm for minor.', 'Accompanists change key for every singer.', ['The smallest capo is usually the best: the strings ring longest.'])),
        S('travis-music-a', 'Song arrangements', 'picking', 'An 8-bar accompaniment with an intro; a minor ballad.', [
          T_('tv-song-intro', 'Song with an intro: syncopated melody for 4 bars, then the full pattern ({chords})', 'transfer', { prog: 'folkAxis', patterns: ['melody', 'melody', 'synco', 'synco', 'full8', 'full8', 'walk', 'basic'], reps: 2, goal: 96, start: 52, why: 'A real arrangement changes texture: a sparse intro with a melody, a busier verse, a walking bass into the end.', instr: HOLD + 'Bars 1–2 melody, 3–4 syncopated, 5–6 every off-beat, 7 walking bass, 8 basic. Play it like a song: build from quiet to full. Pass: the 8 bars twice with no stops.', watch: 'All patterns at one volume: let it build.', simplify: 'Bars 1–4.' }),
          T_('tv-minor-ballad', 'Minor ballad: {prog}, two bars per chord, hammer-ons and walks ({chords})', 'transfer', { prog: 'minor', patterns: ['basic', 'hammer', 'walk', 'pinch13'], barsPerChord: 2, goal: 88, start: 48, why: 'A slow minor ballad gives room for decorations: hammer-ons, walks and the double pinch.', instr: HOLD + 'Two bars per chord, the patterns changing bar by bar. Play slowly and let notes ring. Pass: twice through without a stop.', watch: 'Rushing the slow tempo.', simplify: 'Basic pattern only.' })],
          ST('Arranging means choosing pattern, texture and dynamics for each part of a song.', 'It is where the technique becomes music of your own.', ['Start sparse, build, then thin out for the end.']))
      ], [7, 8]),
    stage('mastery', 'Fluent, any key, your own',
      'Play the full pattern with walking bass and the syncopated melody at 110 BPM, switch key and pattern bar by bar, and perform your own 8-bar arrangement.', [
        S('travis-perf', 'Performance tempo', 'picking', 'The busiest patterns at speed.', [
          T_('tv-fast-full', 'Every off-beat with a walking bass at speed ({chords})', 'edge', { prog: 'ragtime', patterns: ['full8', 'walk'], reps: 2, goal: 100, start: 60, why: 'The densest texture at performance tempo: rolling fingers over a moving bass.', instr: HOLD + 'Alternate the full pattern and the walking bass bar by bar. Tempo ladder: add 4 BPM after every clean pass. Pass: two clean passes at the goal tempo.', watch: 'Tension in the picking hand: let the fingers stay close to the strings.', simplify: 'The basic pattern at speed.' }),
          T_('tv-fast-melody', 'Syncopated melody at speed ({chords})', 'edge', { prog: 'folkAxis', patterns: ['melody', 'synco'], reps: 2, goal: 100, start: 60, why: 'Melody and syncopation at tempo: the bounce has to survive the speed.', instr: HOLD + 'Melody and syncopated bars alternate. Tempo ladder to the goal. Pass: two clean passes at the goal tempo.', watch: 'The syncopation flattening into straight 8ths.', simplify: 'Syncopated pattern only.' })],
          ST('Performance tempo comes from small tempo steps over clean passes.', 'At tempo, the pattern must feel as relaxed as it did slowly.', ['Fingers close to the strings: small motions are fast motions.'])),
        S('travis-random', 'Any pattern, any key', 'picking', 'Patterns and keys changing without warning.', [
          T_('tv-random', 'Pattern changes every bar in four keys ({keys})', 'interleaving', { prog: 'folkAxis', patterns: ['synco', 'walk', 'hammer', 'full8', 'melody', 'pinch13', 'muted'], keys: [0, 9, 4, 2], goal: 96, start: 54, why: 'Unpredictable changes of key and pattern are the hardest, and most transferable, way to practise: nothing can run on habit.', instr: HOLD + 'Every bar a new pattern, every block a new key ({capo}). Follow the pattern names. Pass: all 16 bars in time.', watch: 'Freezing at a key change: set the capo and shapes before the block starts.', simplify: 'Two keys.' }),
          T_('tv-twelve', 'Six keys around the cycle of fourths ({keys})', 'interleaving', { prog: 'folk145', patterns: ['basic'], keys: [0, 5, 10, 3, 8, 1], goal: 96, start: 54, why: 'Six keys in a row, each reached by a capo and a shape family.', instr: HOLD + 'Each block a new key: {capo}. Pass: all six blocks in time with the thumb unbroken.', watch: 'Losing the thumb’s strings when the shape family changes.', simplify: 'Three keys.' })],
          ST('At mastery the pattern runs in any key and texture on demand.', 'Real gigs bring key changes and arrangement changes without warning.', ['Capo and shape family first, then the thumb’s strings.'])),
        S('travis-voice', 'Your own arrangement', 'picking', 'A study, then your arrangement.', [c => tvEtude(c),
          T_('tv-arrange', 'Your arrangement over {prog}: choose a pattern for every two bars ({chords})', 'transfer', { prog: 'ballad', patterns: ['melody', 'synco', 'walk', 'hammer'], barsPerChord: 2, goal: 92, start: 50, minutes: 8, why: 'Mastery is making the pattern serve a song: here is one arrangement of a ballad progression; then write and play your own.', instr: HOLD + 'Play the written arrangement, then rearrange it: choose a pattern for each pair of bars, add an intro and an ending. Pass: your arrangement played through twice without a stop.', watch: 'Using every trick at once: leave space.', simplify: 'Two patterns only.' })],
          ST('A capstone arrangement uses the whole path, then becomes your own.', 'This is what Travis picking is for: playing songs.', ['Contrast between sections makes an arrangement.']))
      ], [9, 10])
  ]
});
