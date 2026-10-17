// Texas shuffle: the swung blues rhythm of Texas and Chicago (Jimmy Reed, T-Bone Walker, Freddie King,
// Stevie Ray Vaughan): two-note boogie figures on the bass strings, a walking boogie bass line, the
// "all-in-one" part that plays the bass on the beat and a chord stab on the off-beat, and chord stabs with
// muted scratches, all locked to a long-short triplet feel through the 12-bar form. From counting the
// shuffle and the first root–5th figure, to the whole form in any key, fills between figures, performance
// tempo and an original rhythm chorus.
//
// Concept-first (CONTENT.md): the model is the 12-BAR FORM (quick or slow change: I, IV and V as offsets
// from the key root), the BOX the hand stays in (I on the low E string, IV on the A string at the same
// fret, V two frets up), and FIGURES written as degrees above each chord's root (R+5, R+6, R+♭7 boogie
// dyads, the R–3–5–6–♭7 walk, bass-and-stab, chord stabs and scratches, a pentatonic fill), placed on the
// neck from the root, so every bar is right in any key. The SWING grid turns eight 8th-note slots into
// long-short triplet pairs. The composer `shRun(c, spec)` builds an exercise from form × figure plan (one
// figure, or one per bar) × feel (swing or straight) × palm muting × key plan.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-17: the feel (full triplets, then
// the middle one dropped, on a muted note), the root–5th / root–6th boogie on I, IV and V, the 12-bar with
// the quick change and a light palm mute, the walking bass, all-in-one (bass on the beat, top strings on the
// upbeat, strummed from the elbow and muted by the fretting hand), stabs and scratches in an oval strumming
// motion and upbeat-only stabs, moving the box to other keys, the turnaround, rhythm with simple fills, tempo,
// and whole choruses. Removed: humming the feel (`sh-hear`), covering the tab and saying chords, keys and bar
// numbers aloud (`sh-12-names`, `sh-keys`, `sh-recall`, `sh-all-keys`), reading only names in `sh-random`
// and naming figures in the capstone. Added `sh-triplets`, `sh-quick-change`, `sh-turnaround`.
import { OPEN, N, nameOf, make, mod12, S, stage, entry, targetGuide, chordInfo } from '../lib.js';
import { phrase, rng } from './bending.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const FORMS = {
  quick: [0, 5, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7],
  slow: [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7],
  four: [0, 5, 0, 7],
  iiv: [0, 0, 5, 0],
  one: [0, 0, 0, 0]
};
const FORM_NAME = { quick: 'a quick-change 12-bar', slow: 'a 12-bar (slow change)', four: 'I – IV – I – V', iiv: 'I – I – IV – I', one: 'the I chord' };
/** The I chord's root fret on the low E string (0–11, open allowed), so the whole box sits low on the neck. */
const rootFret = k => mod12(k - 40);
/** Where a chord's root sits in the box: I on the low E, IV on the A string at the same fret, V two frets higher. */
export function rootOf(k, off) { const r = rootFret(k); return off === 0 ? [6, r] : off === 5 ? [5, r] : [5, r + 2]; }
/** Boogie dyads: degree above the root of the companion note on the next string up, and its fret offset. */
const COMP = { 7: 2, 9: 4, 10: 5 };
/** Figures as 8 slots of [kind, degree]: d = dyad (R + degree), b = bass note (degree), s = stab, x = scratch, - = rest. */
export const FIGURES = {
  root: { label: 'the root on every shuffle 8th', slots: Array(8).fill(['b', 0]) },
  r5: { label: 'root and 5th on every 8th', slots: Array(8).fill(['d', 7]) },
  r56: { label: 'the boogie: root–5th, root–6th', slots: [['d', 7], ['d', 7], ['d', 9], ['d', 9], ['d', 7], ['d', 7], ['d', 9], ['d', 9]] },
  r567: { label: 'the long boogie: 5th, 6th, ♭7, 6th', slots: [['d', 7], ['d', 7], ['d', 9], ['d', 9], ['d', 10], ['d', 10], ['d', 9], ['d', 9]] },
  walk: { label: 'the boogie walk: R, 3, 5, 6, ♭7, 6, 5, 3', slots: [['b', 0], ['b', 4], ['b', 7], ['b', 9], ['b', 10], ['b', 9], ['b', 7], ['b', 4]] },
  aio: { label: 'all-in-one: bass on the beat, a stab on the off-beat', slots: [['b', 0], ['s'], ['b', 4], ['s'], ['b', 7], ['s'], ['b', 9], ['s']] },
  stabs: { label: 'chord stabs with muted scratches', slots: [['s'], ['x'], ['x'], ['s'], ['s'], ['x'], ['-'], ['s']] },
  push: { label: 'stabs on the off-beats', slots: [['-'], ['s'], ['-'], ['s'], ['-'], ['s'], ['-'], ['s']] },
  fill: { label: 'a pentatonic fill', slots: null },
  trip: { label: 'full triplets: all three notes of every beat', slots: null }
};
/** The shuffle grid: slot i of 8 → [time, length] (long-short triplet pairs), or straight 8ths. */
export const slot = (i, swing = true) => (swing ? [Math.floor(i / 2) + (i % 2 ? 2 / 3 : 0), i % 2 ? 1 / 3 : 2 / 3] : [i / 2, 0.5]);
/** Which note may sound where (for the pitch check): note → allowed pitch classes (null = a scratch). */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const MIXO = [0, 2, 4, 5, 7, 9, 10];
/** A movable dominant grip near the box: 9th on the A string (x-r-(r-1)-r-r-r) or 7th on the low E (r-x-r-(r+1)-r-x). */
export function stabGrip(k, off) {
  const pc = mod12(k + off), r = rootFret(k);
  const on5 = [0, 12].map(x => mod12(pc - 45) + x).find(f => f >= 1 && Math.abs(f - (r + 2)) <= 5);
  if (on5 != null) return { name: nameOf(pc) + '9', frets: [null, on5, on5 - 1, on5, on5, on5], pcs: [0, 4, 7, 10, 2].map(d => mod12(pc + d)) };
  const on6 = [0, 12].map(x => mod12(pc - 40) + x).find(f => f >= 0 && f <= 14);
  return { name: nameOf(pc) + '7', frets: [on6, null, on6, on6 + 1, on6, null], pcs: [0, 4, 7, 10].map(d => mod12(pc + d)) };
}
/** A two- or three-note dominant partial on the top strings inside the bass hand's fret window (for the all-in-one stab). */
export function partialNear(pc, lo, hi) {
  const tones = [0, 4, 7, 10].map(d => mod12(pc + d)); let best = null;
  const opts = s => { const o = [null]; for (let f = lo; f <= hi; f++) if (tones.includes(mod12(pitch(s, f)))) o.push(f); if (lo > 0 && tones.includes(mod12(pitch(s, 0))) && lo <= 2) o.push(0); return o; };
  for (const a of opts(3)) for (const b of opts(2)) for (const e of opts(1)) {
    const fs = [a, b, e], played = fs.filter(x => x != null); if (played.length < 2) continue;
    const fretted = played.filter(x => x > 0); if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > 3) continue;
    const pcs = fs.map((f, i) => (f == null ? null : mod12(pitch(3 - i, f)))).filter(x => x != null);
    if (new Set(pcs).size < played.length) continue;
    const score = (pcs.includes(tones[1]) ? 4 : 0) + (pcs.includes(tones[3]) ? 3 : 0) + played.length;
    if (!best || score > best.score) best = { score, frets: [null, null, null, a, b, e], pcs: tones };
  }
  return best;
}
/** Render one bar of a figure over the chord `off` semitones above the key from beat T. */
export function renderBar(notes, k, off, fig, T, { swing = true, pm = false } = {}) {
  const pc = mod12(k + off), [s, f] = rootOf(k, off), mix = MIXO.map(d => mod12(pc + d)), g = stabGrip(k, off);
  if (fig === 'fill') {
    const ev = [[2, 10, 2 / 3], [2, 7, 1 / 3], [3, 5, 2 / 3, 'b', 7], [3, 5, 1 / 3, 'r'], [3, 3, 2 / 3], [4, 0, 1 / 3], [4, 10, 2 / 3], [5, 7, 1 / 3], [6, 0, 1]];
    const ph = phrase(k, 1, ev, T); if (!ph) return false; const pent = [0, 3, 5, 7, 10].map(d => mod12(k + d)); ph.forEach(n => notes.push(tag(n, pent))); return true;
  }
  if (fig === 'trip') {
    for (let i = 0; i < 12; i++) notes.push(tag(N(s, f, T + i / 3, 1 / 3, pm ? 'pm' : null), mix));
    return true;
  }
  const F = FIGURES[fig].slots;
  F.forEach(([kind, d], i) => {
    const [t, len] = slot(i, swing), tt = T + t, x = pm ? 'pm' : null;
    if (kind === 'd') notes.push(tag(N(s, f, tt, len, x, { chord: true }), mix), tag(N(s - 1, f + COMP[d], tt, len, x, { chord: true }), mix));
    else if (kind === 'b') { const [bs, bf] = d === 0 ? [s, f] : d === 4 ? [s, f + 4] : [s - 1, f + COMP[d]]; notes.push(tag(N(bs, bf, tt, len, x), mix)); }
    else if (kind === 's' || kind === 'x') {
      const P = fig === 'aio' ? partialNear(pc, Math.max(0, f - 1), f + 4) : g; if (!P) return;
      P.frets.forEach((fr, idx) => { if (fr != null) notes.push(tag(N(6 - idx, fr, tt, len, kind === 'x' ? 'mute' : null, { chord: true }), kind === 'x' ? null : P.pcs)); });
    }
  });
  return true;
}
const UNIT = (swing) => (swing ? '8th-note shuffle' : '8th notes');

/* ------------------------------- The composer ------------------------------- */
/**
 * One shuffle exercise from a spec: { id, name ('{key}', '{form}', '{figures}'), method, form (a FORMS id),
 * figures (a FIGURES id, or a list cycling per bar), keys (offsets, one block each), swing (default true;
 * 'alt' alternates straight and swing bars), pm, domain, unit, goal, start, dl, why, instr, watch, simplify }.
 */
export function shRun(c, spec) {
  const k0 = mod12(c.key), notes = [], chords = [], used = new Set(), voicings = new Map();
  const figs = Array.isArray(spec.figures) ? spec.figures : [spec.figures || 'r5']; let bar = 0;
  for (const off of spec.keys || [0]) {
    const k = mod12(k0 + off);
    for (const o of FORMS[spec.form || 'four']) {
      const fig = figs[bar % figs.length], swing = spec.swing === 'alt' ? bar % 2 === 1 : spec.swing !== false;
      if (!renderBar(notes, k, o, fig, bar * 4, { swing, pm: spec.pm })) return null;
      const nm = nameOf(k + o) + '7'; chords.push(nm); used.add(FIGURES[fig].label);
      if (['stabs', 'push'].includes(fig)) { const g = stabGrip(k, o); voicings.set(g.name, { name: g.name, frets: g.frets }); }
      bar++;
    }
  }
  if (notes.length > 400) return null;
  const fill = s => s.replace(/\{key\}/g, nameOf(k0)).replace('{form}', FORM_NAME[spec.form || 'four']).replace('{figures}', [...used].join('; ')).replace('{chords}', [...new Set(chords)].join(' – '));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'rhythm', method: spec.method, unit: spec.unit || UNIT(spec.swing !== false),
    goal: spec.goal || 110, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify,
    ...(voicings.size ? { voicings: [...voicings.values()].slice(0, 8) } : {}), chords: [...new Set(chords)].slice(0, 8), backing: chords, tab: { notes }
  });
}
const H_ = (id, name, method, opts) => c => shRun(c, { id, name, method, ...opts });

/* ------------------------------- Special lessons ------------------------------- */
/** A random key, chord and figure every bar (interleaving). */
export function shRandom(c) {
  const r = rng(271 + (c.lvl || 9)), notes = [], names = [], chords = [];
  for (let bar = 0; bar < 8; bar++) {
    const k = Math.floor(r() * 12), o = [0, 5, 7][Math.floor(r() * 3)], fig = ['r56', 'r567', 'walk', 'aio', 'stabs'][Math.floor(r() * 5)];
    if (!renderBar(notes, k, o, fig, bar * 4)) return null;
    names.push(`${nameOf(k + o)}7 (the ${['I', 'IV', 'V'][[0, 5, 7].indexOf(o)]} of ${nameOf(k)}): ${FIGURES[fig].label.split(':')[0]}`); chords.push(nameOf(k + o) + '7');
  }
  if (notes.length > 400) return null;
  return make(c, {
    id: 'sh-random', name: 'Random access: a new key, chord and figure every bar', domain: 'fretboard', method: 'interleaving', unit: '8th-note shuffle', goal: 120, start: 70, minutes: 5, dl: 1, chords: [...new Set(chords)].slice(0, 8), backing: chords, tab: { notes },
    why: 'At mastery level the figure is chosen on the spot for any chord in any key, with the shuffle never stopping. An unpredictable order is what makes the box and the figures automatic.',
    instr: `${names.join(' → ')}. Each bar moves the box to a new root and a new figure: look one bar ahead in the tab and move the hand on beat 4, without stopping the shuffle. Pass: all 8 bars in time with the feel never straightening.`,
    watch: 'The shuffle straightening while you search.', simplify: 'The first four bars.'
  });
}
/** An original 12-bar rhythm chorus (capstone): every figure in the form, a fill, and a turnaround stab. */
export function shEtude(c) {
  const k = mod12(c.key), notes = [], chords = [], vs = new Map();
  const plan = ['r56', 'r567', 'walk', 'fill', 'aio', 'aio', 'r567', 'stabs', 'walk', 'r56', 'aio', 'push'];
  for (const [bar, o] of FORMS.quick.entries()) {
    if (!renderBar(notes, k, o, plan[bar], bar * 4, { pm: ['r56', 'r567'].includes(plan[bar]) })) return null;
    chords.push(nameOf(k + o) + '7'); if (['stabs', 'push'].includes(plan[bar])) { const g = stabGrip(k, o); vs.set(g.name, { name: g.name, frets: g.frets }); }
  }
  if (notes.length > 400) return null;
  return make(c, {
    id: 'sh-capstone-etude', name: `Capstone study: an original 12-bar shuffle chorus in ${nameOf(k)}`, domain: 'rhythm', method: 'transfer', unit: '8th-note shuffle', goal: 120, start: 70, minutes: 8, dl: 1,
    voicings: [...vs.values()], chords: [...new Set(chords)], backing: chords, tab: { notes },
    why: 'An original chorus that uses the whole path: palm-muted boogie dyads, the long boogie, the walking bass, a pentatonic fill, the all-in-one part on the IV, chord stabs with scratches, and off-beat stabs as the turnaround.',
    instr: 'Learn it four bars at a time with the backing, then join the sections. Then write your own chorus with a different figure plan. Pass: the chorus at the goal tempo with the shuffle never straightening, then your own version once.',
    watch: 'The fill in bar 4 rushing back to the beat.', simplify: 'The first four bars.'
  });
}

/* --------------------------------- The path --------------------------------- */
const HOW = 'Keep the picking hand moving in a steady triplet motion (down on the beat, up on the last triplet), rest the side of the picking hand on the bass strings near the bridge for a tight sound, and let the fretting hand stay in one box: I on the low E, IV on the A string at the same fret, V two frets up. ';
export default entry({
  id: 'texasShuffle', kind: 'style', title: 'Texas shuffle', domain: 'rhythm',
  re: /texas shuffle|blues shuffle|shuffle (rhythm|groove|feel)|boogie (pattern|riff|bass)|jimmy reed/,
  aliases: ['blues shuffle', 'boogie shuffle', 'shuffle rhythm'],
  summary: 'The swung blues rhythm of Texas and Chicago: boogie dyads, the walking boogie bass, the all-in-one bass-and-stab part and chord stabs with scratches, through the 12-bar form in any key, with fills, at tempo, and an original chorus.',
  sources: ['https://guitarworld.com/lessons/blues-power-shuffling-shuffle-rhythm-patterns', 'https://www.guitarworld.com/lessons/talkin-blues-all-one-shuffle-rhythm', 'https://www.premierguitar.com/beyond-blues-texas-rhythm-101', 'https://www.guitarplayer.com/technique/how-to-play-the-blues-chords-patterns-and-fills-for-major-and-minor-blues', 'https://blog.artistworks.com/blues-shuffle-rhythm-guitar-master-the-essential-groove-artistworks/'],
  pedagogy: {
    date: '2026-10-17',
    summary: 'The shuffle is taught from the feel first (a triplet with the middle note left out, counted and played on one muted note), then the root–5th / root–6th boogie with the index on the root and the pinky reaching the 6th, applied to the I, IV and V and to the 12-bar form with its quick change; then the walking bass and the all-in-one part (bass notes strummed from the elbow on the beat, the top strings on the upbeat, each muted by the fretting hand), chord stabs with a big oval strumming motion and upbeat-only stabs behind a vocal, the shapes slid to other keys; then rhythm alternating with simple fills, faster tempos, turnarounds, and whole choruses locked with the band.',
    sequence: [
      { id: 'feel', tier: 'foundations', step: 'The shuffle feel: a triplet with the middle note left out', how: 'Count "trip-let" or "one-and-uh"; play all three triplets, then only the first and third, on a muted low string, accenting the beat.', skills: ['sh-feel'], source: 0 },
      { id: 'boogie', tier: 'foundations', step: 'The root–5th / root–6th boogie on I, IV and V', how: 'Index on the root, ring on the 5th, pinky reaching the 6th; the same shape moved to the IV and V chords.', skills: ['sh-boogie'], source: 3 },
      { id: 'form', tier: 'foundations', step: 'The 12-bar form and the quick change; a light palm mute', how: 'I – IV – V through 12 bars (IV in bar 2 for the quick change); mute lightly with the heel of the picking hand.', skills: ['sh-form'], source: 3 },
      { id: 'first', tier: 'foundations', step: 'A whole 12-bar with the boogie', how: 'Apply the pattern to the whole 12-bar blues.', skills: ['sh-first-music'], source: 0 },
      { id: 'walk', tier: 'intermediate', step: 'The walking bass and longer boogie figures', how: 'A quarter- and 8th-note bass line outlining each chord, each note isolated by fretting-hand muting.', skills: ['sh-figures'], source: 1 },
      { id: 'aio', tier: 'intermediate', step: 'All-in-one: bass on the beat, the top strings on the upbeat', how: 'Strum from the elbow flat across the strings; the fretting hand decides what sounds; add an upstroke on the top strings on each upbeat and mute it at once.', skills: ['sh-aio'], source: 1 },
      { id: 'stabs', tier: 'intermediate', step: 'Chord stabs and scratches; upbeat stabs behind a singer', how: 'A big oval strumming motion that never stops, pressing for the stabs and releasing for the scratches; then stabs only on the upbeats, locked with the drums.', skills: ['sh-stabs'], source: 2 },
      { id: 'move', tier: 'intermediate', step: 'Mixing figures and moving the shapes to other keys', how: 'The same shapes slid along the neck for the IV, V and other keys; patterns changed between sections.', skills: ['sh-keys'], source: 3 },
      { id: 'chorus', tier: 'intermediate', step: 'A full chorus with the band', how: 'A whole chorus mixing the parts, locked with the drums and bass.', skills: ['sh-music'], source: 4 },
      { id: 'tempo', tier: 'advanced', step: 'Faster shuffles with a loose wrist', how: 'Keep the hand loose and the motion small; the feel stays long-short at speed.', skills: ['sh-tempo'], source: 4 },
      { id: 'turn', tier: 'advanced', step: 'Other keys and the turnaround', how: 'Patterns in new keys around the neck; the last bars of the form as a turnaround back to the top.', skills: ['sh-neck'], source: 3 },
      { id: 'fills', tier: 'advanced', step: 'Rhythm alternating with simple fills', how: 'Rhythm parts that leave space for a short fill and return to the groove on time; keep the fills simple.', skills: ['sh-fills'], source: 2 },
      { id: 'band', tier: 'advanced', step: 'Choruses of rhythm and fills', how: 'Two choruses mixing rhythm figures and fills, as in a band.', skills: ['sh-adv-music'], source: 2 },
      { id: 'perform', tier: 'mastery', step: 'Performance tempo in any key', how: 'The whole form at tempo with the figures changing, in every key.', skills: ['sh-performance', 'sh-recall-m'], source: 1 },
      { id: 'own', tier: 'mastery', step: 'Your own rhythm chorus', how: 'Combine the parts into your own chorus and practise it until it is seamless.', skills: ['sh-voice'], source: 1 }
    ],
    drills: ['Full triplets, then the shuffle (middle triplet dropped) on a muted low string', 'Root–5th / root–6th boogie on I, IV and V', 'The boogie through the 12-bar with the quick change', 'Walking bass with fretting-hand muting, slowly', 'All-in-one: bass on the beat, upstroke on the top strings on the upbeat', 'Chord stabs with muted scratches in an oval strumming motion', 'Upbeat-only stabs behind a vocal', 'Rhythm alternating with a short fill'],
    mistakes: ['Playing straight 8ths instead of long-short', 'Rushing the upbeat', 'Picking individual strings instead of strumming and letting the fretting hand mute', 'Unwanted strings ringing between the bass notes', 'Tension in the picking hand at faster tempos', 'Overplaying behind a singer'],
    sources: [
      { title: 'Blues Power: Shuffling On – Shuffle Rhythm Patterns', author: 'Keith Wyatt (Guitar World)', url: 'https://guitarworld.com/lessons/blues-power-shuffling-shuffle-rhythm-patterns' },
      { title: 'Talkin’ Blues: The All-in-One Shuffle Rhythm', author: 'Keith Wyatt (Guitar World)', url: 'https://www.guitarworld.com/lessons/talkin-blues-all-one-shuffle-rhythm' },
      { title: 'Beyond Blues: Texas Rhythm 101', author: 'Levi Clay (Premier Guitar)', url: 'https://www.premierguitar.com/beyond-blues-texas-rhythm-101' },
      { title: 'How to Play the Blues: Chords, Patterns and Fills', author: 'Guitar Player staff', url: 'https://www.guitarplayer.com/technique/how-to-play-the-blues-chords-patterns-and-fills-for-major-and-minor-blues' },
      { title: 'How to Play Blues Shuffle Rhythm Guitar: The Complete Guide', author: 'ArtistWorks', url: 'https://blog.artistworks.com/blues-shuffle-rhythm-guitar-master-the-essential-groove-artistworks/' }
    ]
  },
  ctx: { key: 4, minor: false, prog: 'blues' },
  stages: [
    stage('foundations', 'The feel and the first boogie',
      'Play full triplets and then the long-short shuffle on one muted note, play root–5th and root–6th boogie figures through I – IV – I – V at 80 BPM with the palm mute tight, play the quick-change 12-bar with every change on time, and play a whole 12-bar shuffle.', [
        S('sh-feel', 'The shuffle feel', 'rhythm', 'Long-short, counted.', [
          H_('sh-count', 'Count the shuffle: the root of {key} on every long-short 8th', 'chunking', { form: 'one', figures: 'root', pm: true, goal: 76, start: 50, why: 'The shuffle is a triplet with the middle note left out: long (two triplets), short (one). Counting "1-and-let" on one muted note, before any chord changes, puts the feel in the hands first.', instr: HOW + 'Palm-mute the low root. Count "1 (and) let, 2 (and) let" aloud and play on "1" and "let" only, accenting the beat. Pass: four bars where every note lands on a triplet, never on a straight 8th.', watch: 'Straight 8ths (even notes): the second note is late and short.', simplify: 'Count aloud while tapping your foot, then add the notes.' }),
          H_('sh-triplets', 'Full triplets, then the shuffle: the muted root of {key}', 'chunking', { form: 'one', figures: ['trip', 'root'], pm: true, unit: '8th-note triplets', goal: 74, start: 48, why: 'Playing all three notes of the triplet and then dropping the middle one shows exactly where the shuffle’s short note sits: on the last triplet, not halfway through the beat.', instr: HOW + 'Odd bars: every triplet (down-up-down per beat is fine). Even bars: leave out the middle note of each triplet and keep the hand moving through it. Pass: four bars of each, the shuffle notes landing exactly where the 1st and 3rd triplets were.', watch: 'The shuffle bars drifting back to straight 8ths.', simplify: 'Count the triplets aloud and play only the 1st one of each beat.' })], {
          concept: 'A shuffle divides each beat into three triplets and plays only the first and the last: a long note and a short one.',
          why: 'The feel is the style. A shuffle with straight 8ths stops sounding like the blues, so it is learned before any notes or chords.',
          theory: ['Count "1-and-let" (or "trip-let"): play on "1" and "let".', 'Written as straight 8ths with a "shuffle" or "swing" mark, played long-short.']
        }),
        S('sh-boogie', 'The boogie figures', 'fretting', 'Root and 5th, root and 6th.', [
          H_('sh-r5', 'Root and 5th on every shuffle 8th: {chords}', 'accurate-reps', { form: 'iiv', figures: 'r5', pm: true, goal: 78, start: 50, why: 'Two notes (the root and the 5th) on the two lowest strings of the chord are the first shuffle figure. The change from I to IV is the same shape moved across one string.', instr: HOW + 'Index on the root, ring finger two frets up on the next string. Count the bars where every pair rings together and the change is on time. Pass: 8 clean bars in a row.', watch: 'Only one string of the pair sounding.', simplify: 'Quarter notes.' }),
          H_('sh-r56', 'The boogie: root–5th, root–6th through {chords}', 'variable', { form: 'four', figures: 'r56', pm: true, goal: 80, start: 52, why: 'Reaching from the 5th to the 6th with the pinky (two 8ths each pair) is the classic boogie that came from boogie-woogie piano. On the V chord the same shape moves two frets up.', instr: HOW + 'Index on the root, ring on the 5th, pinky stretching to the 6th two frets higher. Pass: four bars with the pinky reaching the 6th on time.', watch: 'The index lifting off the root when the pinky stretches.', simplify: 'Root–5th only on the V chord.' })], {
          concept: 'The boogie is a two-note figure on the chord’s lowest strings: the root with the 5th, then the root with the 6th, rocking back and forth.',
          why: 'It is the first shuffle part most players learn and the bass of countless blues records; one shape covers the I, IV and V.',
          theory: ['Index on the root, ring finger on the 5th, pinky on the 6th two frets higher.', 'I on the low E string, IV on the A string at the same fret, V two frets above the IV.']
        }),
        S('sh-form', 'The form and the sound', 'fretboard', 'The quick-change 12-bar; the tight mute.', [
          H_('sh-quick-change', 'The quick-change 12-bar with root–5th: {form} in {key}', 'accurate-reps', { form: 'quick', figures: 'r5', pm: true, goal: 78, start: 50, minutes: 6, why: 'The 12-bar form with the quick change (the IV in bar 2) is the standard blues progression. Moving the shape on beat 4 of the bar before each change keeps the shuffle going through the changes.', instr: HOW + 'Root–5th through the 12 bars: I, IV (the quick change), I, I, IV, IV, I, I, V, IV, I, V. Move the hand during the last 8th before each change. Pass: one chorus with every change on the downbeat.', watch: 'Missing the quick change in bar 2 or the V in bar 9.', simplify: 'The first four bars, then bars 9–12.' }),
          H_('sh-mute', 'The tight palm mute: boogie figures in {key}, listening to the chug', 'external-focus', { form: 'four', figures: 'r56', pm: true, goal: 80, start: 52, why: 'A shuffle is a drum part as much as a bass line. With the heel of the picking hand resting lightly on the bass strings the figures chug: pitched but short and punchy. The sound is the guide.', instr: HOW + 'Move the palm closer to the neck until the notes choke, then back until they just ring with a thump. Listen for every pair the same length and loudness. Pass: four bars with an even chug.', watch: 'The mute so heavy the pitch disappears.', simplify: 'Root–5th only.' })], {
          concept: 'The 12-bar blues uses the I, IV and V chords in a fixed order; the quick change puts the IV in bar 2. A light palm mute makes the bass figures chug.',
          why: 'Every jam and blues band uses this form, and the light mute is what makes a shuffle sound tight rather than boomy.',
          theory: ['Quick change: I – IV – I – I | IV – IV – I – I | V – IV – I – V.', 'All three chords are dominant 7ths in a blues.']
        }),
        S('sh-first-music', 'First music', 'rhythm', 'A whole shuffle.', [
          H_('sh-first-12', 'First 12-bar shuffle: the boogie through {form} in {key}', 'transfer', { form: 'slow', figures: 'r56', pm: true, goal: 82, start: 54, minutes: 6, why: 'The whole 12-bar form in one figure, with the backing: a real blues rhythm part you can play in a band.', instr: HOW + 'Play the chorus with the backing, then a second chorus with a slightly heavier accent on beats 1 and 3. Pass: two choruses without stopping.', watch: 'Speeding up in the IV bars.', simplify: 'Root–5th through the form.' }),
          H_('sh-reed', 'Jimmy Reed style: the long boogie through {chords}', 'transfer', { form: 'four', figures: ['r567', 'r56', 'r567', 'r5'], pm: true, goal: 82, start: 54, why: 'The long boogie reaches up to the ♭7 before coming back: the lazy, rolling figure of Chicago and Texas blues. Mixing it with shorter figures already sounds like a part.', instr: HOW + 'The pinky reaches the ♭7 three frets above the 5th. Pass: four times round with the backing.', watch: 'The ♭7 reach pulling the hand out of position.', simplify: 'The boogie (5th–6th) every bar.' })], {
          concept: 'The boogie played through the whole form with a backing track, and the longer boogie that reaches the ♭7.',
          why: 'From the first stage the figures are used as a real band part, locked with the drums.',
          theory: ['Long boogie: 5th, 6th, ♭7, 6th above the root.', 'The ♭7 is what makes each chord a dominant 7th.']
        })
      ], [1, 3]),
    stage('intermediate', 'Walking bass and all-in-one',
      'Play the long boogie and the boogie walk through the 12-bar at 100 BPM, play the all-in-one part (bass on the beat, a stab on the off-beat) with even balance, play chord stabs with muted scratches and upbeat-only stabs, change figure every bar, play the form in four keys, and play a full shuffle chorus with the backing.', [
        S('sh-figures', 'More figures', 'fretting', 'The long boogie; the walk.', [
          H_('sh-r567', 'The long boogie through {form} ({key})', 'variable', { form: 'quick', figures: 'r567', pm: true, goal: 96, start: 58, minutes: 6, why: 'The long boogie through the whole quick-change form: the reach to the ♭7 on every chord, the shape moving between strings at every change.', instr: HOW + 'Keep the index anchored on each root. Pass: one chorus clean.', watch: 'The ♭7 coming late.', simplify: 'The first four bars.' }),
          H_('sh-walk', 'The boogie walk: single notes through {chords}', 'chunking', { form: 'four', figures: 'walk', goal: 94, start: 56, why: 'The boogie walk spells the dominant chord as a bass line (R, 3, 5, 6, ♭7 and back down): the piano boogie left hand on the guitar. Learn the up half, then the down half, then join them.', instr: HOW + 'First the first four notes only (R, 3, 5, 6) four times, then the way down, then the whole bar. Let only the written note sound: the fretting fingers damp the rest. Pass: four bars with every note in the shuffle.', watch: 'The 3rd (a stretch on the root string) out of tune.', simplify: 'The first half of every bar, then hold the root.' })], {
          concept: 'Two longer bass figures: the long boogie (5th, 6th, ♭7, 6th) and the walk, a single-note line through the chord’s R, 3, 5, 6 and ♭7.',
          why: 'Walking bass lines are the backbone of boogie-woogie and of the all-in-one shuffle that comes next.',
          theory: ['Walk: R – 3 – 5 – 6 – ♭7 – 6 – 5 – 3.', 'Each note is isolated by the fretting hand muting the strings around it.']
        }),
        S('sh-aio', 'All-in-one', 'rhythm', 'Bass and stab together.', [
          H_('sh-aio-4', 'All-in-one: bass on the beat, a stab on the off-beat ({chords})', 'external-focus', { form: 'four', figures: 'aio', goal: 92, start: 54, why: 'One guitar playing the bass line on the beat and a short chord stab on every off-beat (what two guitars did in Jimmy Reed’s band) is the heart of the Texas style. The two layers must balance: a firm bass, a light, short stab.', instr: HOW + 'Strum from the elbow rather than aiming at single strings: the fretting hand decides what sounds. Downstroke the bass note on the beat, upstroke a short stab on the top strings on the "let", then release it as the hand moves to the next bass note. Pass: four bars with every stab short and lighter than the bass.', watch: 'The stabs ringing over the next bass note.', simplify: 'Stabs on beats 2 and 4 only.' }),
          H_('sh-aio-12', 'All-in-one through {form} ({key})', 'accurate-reps', { form: 'quick', figures: 'aio', goal: 92, start: 54, minutes: 6, why: 'The all-in-one part through the whole form: every chord has its own bass walk and stab grip. Counting clean bars builds it bar by bar.', instr: HOW + 'Count only the bars where every stab is short and every bass note is on time. Pass: 12 clean bars in a row.', watch: 'Losing the stab grip at the V chord.', simplify: 'Four bars.' })], {
          concept: 'All-in-one combines the walking bass on the beat with a short stab on the top strings on each upbeat, so one guitar covers two parts.',
          why: 'It is the Texas shuffle sound: bass and rhythm guitar in one part, as in boogie-woogie piano.',
          theory: ['Strum flat across the strings and let the fretting hand mute what should not sound.', 'The stab is an upstroke on the last triplet, released straight away.']
        }),
        S('sh-stabs', 'Stabs and scratches', 'rhythm', 'The chord as a drum.', [
          H_('sh-scratch', 'Chord stabs with muted scratches: {chords}', 'variable', { form: 'four', figures: 'stabs', goal: 92, start: 54, why: 'A big, oval strumming motion that never stops, with the fretting hand pressing only for the stabs and releasing for the scratches, keeps time and gives the shuffle its swagger.', instr: HOW + 'Strum every triplet position the figure uses; press the 9th or 7th grip for the stabs, release it for the scratches. Pass: four bars in time with every scratch dead.', watch: 'The strumming hand stopping on the rests.', simplify: 'Stabs only, no scratches.' }),
          H_('sh-push', 'Off-beat stabs (behind a singer): {chords}', 'variable', { form: 'iiv', figures: 'push', goal: 92, start: 54, why: 'Behind a vocal the rhythm part gets out of the way: short stabs on the off-beats only, locked with the drums. Less is the point.', instr: HOW + 'Mute with the heel of the picking hand between stabs; stab only on each "let" with an upstroke, short. Pass: four bars, every stab exactly on the last triplet.', watch: 'Stabs drifting onto the beat.', simplify: 'Two stabs per bar.' })], {
          concept: 'Chord stabs (short 9th or 7th chords) with muted scratches between them, and stabs on the upbeats only.',
          why: 'Stabs turn the guitar into part of the drum kit; upbeat stabs leave room for a singer or soloist.',
          theory: ['A scratch is a strum with the fretting fingers resting on the strings, not pressing.', 'The 9th chord (R 3 5 ♭7 9) is the classic Texas stab voicing.']
        }),
        S('sh-keys', 'Mixed and in any key', 'fretboard', 'A figure every bar; four keys.', [
          H_('sh-mixed', 'A new figure every bar through {form} ({key})', 'interleaving', { form: 'quick', figures: ['r56', 'walk', 'r567', 'aio'], pm: false, goal: 92, start: 54, minutes: 6, why: 'Real parts change figure from bar to bar. Rotating four figures through the form mixes them the way playing does.', instr: HOW + 'Boogie, walk, long boogie, all-in-one, in turn, through the 12 bars. Pass: one chorus without stopping.', watch: 'The figure change pulling you off the shuffle.', simplify: 'Two figures in turn.' }),
          H_('sh-keys', 'The box in four keys, four bars each ({key}, then up a 4th, a minor 3rd, a minor 6th)', 'interleaving', { form: 'four', figures: 'r56', pm: true, keys: [0, 5, 3, 8], goal: 90, start: 54, why: 'The box is movable: slide it so the I chord’s root on the low E is the new key, and the IV and V follow. Changing key every four bars makes the move automatic.', instr: HOW + 'Four bars per key; on beat 4 of the last bar slide the hand to the new root on the low E string. Pass: all 16 bars without a gap.', watch: 'A gap at each new key.', simplify: 'Two keys.' })], {
          concept: 'Changing figure from bar to bar, and moving the whole box to a new key by sliding the I chord’s root along the low E string.',
          why: 'Bands change figures between sections and play in every key; the box makes any key the same shapes.',
          theory: ['The IV is always on the A string at the I’s fret, the V two frets higher.', 'Moving up a 4th (five frets) gives the key of the old IV.']
        }),
        S('sh-music', 'In music', 'rhythm', 'A chorus and a solo.', [
          H_('sh-chorus', 'A shuffle chorus: all-in-one, boogie and stabs through {form} ({key})', 'transfer', { form: 'quick', figures: ['aio', 'aio', 'aio', 'aio', 'r567', 'r567', 'aio', 'aio', 'stabs', 'stabs', 'aio', 'push'], goal: 96, start: 58, minutes: 6, why: 'A chorus that sounds like a record: all-in-one on the I, the long boogie on the IV, stabs to lift the V, off-beat stabs as the turnaround.', instr: HOW + 'Play two choruses with the backing, locking the bass notes with the kick drum. Pass: both in time with the feel never straightening.', watch: 'Rushing the stabs at bar 9.', simplify: 'All-in-one throughout.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Over your own shuffle: a solo chorus, then back to the rhythm' })], {
          concept: 'A full chorus mixing all-in-one, boogie and stabs, and a solo chorus over the shuffle.',
          why: 'Choosing a figure per section is how a rhythm part is arranged in a band.',
          theory: ['Bars 9–10 (V – IV) are often lifted with chord stabs.', 'Bar 12 (the V) is the turnaround back to the top.']
        })
      ], [4, 6]),
    stage('advanced', 'At tempo, anywhere',
      'Play the long boogie and the walk at 132 BPM, move the box to four keys around the cycle of fourths, play the 12-bar with a stab turnaround, add a pentatonic fill in the form’s gaps, and play two choruses of rhythm with fills.', [
        S('sh-tempo', 'Tempo', 'rhythm', 'Fast shuffles.', [
          H_('sh-fast', 'Fast shuffle: the long boogie at the edge ({chords})', 'edge', { form: 'four', figures: 'r567', pm: true, goal: 132, start: 80, why: 'Fast shuffles (the Texas up-tempo sound) need a loose wrist and a small motion; the feel must stay long-short at speed, not turn into straight 8ths.', instr: HOW + 'Tempo ladder: +4 BPM after each clean pass; shake the hand loose between passes. Pass: clean and swung at the goal tempo.', watch: 'The shuffle straightening at speed.', simplify: 'Root–5th.' }),
          H_('sh-walk-fast', 'The walk at tempo through {form} ({key})', 'accurate-reps', { form: 'quick', figures: 'walk', goal: 126, start: 76, minutes: 6, why: 'The boogie walk through the whole form at tempo: every note of every chord’s walk clean.', instr: HOW + 'Count only clean bars. Pass: 12 in a row.', watch: 'Missing the 3rd stretch at speed.', simplify: 'Four bars.' })], {
          concept: 'The boogie and the walk at up-tempo speeds with the long-short feel intact.',
          why: 'Many Texas shuffles are fast; tension and straightened 8ths are the usual failures.',
          theory: ['Smaller motion and a loose wrist, not more force, give speed.', 'Climb a few BPM after each clean pass.']
        }),
        S('sh-neck', 'Any key, and the turnaround', 'fretboard', 'Four keys; the form’s ending.', [
          H_('sh-four-keys', 'Four keys around the cycle of fourths: the boogie through {chords}', 'interleaving', { form: 'four', figures: ['r56', 'walk'], keys: [0, 5, 10, 3], pm: true, goal: 120, start: 72, why: 'The box moved through four keys a fourth apart, alternating figures: each key puts the box somewhere new on the neck.', instr: HOW + 'Four bars per key, the figure alternating. Pass: all 16 bars without stopping.', watch: 'Keys high on the neck feeling cramped: keep the shape exact.', simplify: 'Two keys.' }),
          H_('sh-turnaround', 'The 12-bar with a stab turnaround: {form} in {key}', 'variable', { form: 'slow', figures: ['r567', 'r567', 'r567', 'r567', 'r56', 'r56', 'r567', 'r567', 'stabs', 'stabs', 'r567', 'push'], pm: true, goal: 120, start: 72, minutes: 6, why: 'The last bars of the form turn it around to the top: here the V and IV are lifted with chord stabs and the last bar (the V) is off-beat stabs that lead back to bar 1.', instr: HOW + 'The long boogie for eight bars, stabs on the V and IV, the boogie on the I, off-beat stabs on the V. Play it twice in a row so the turnaround leads back into bar 1. Pass: two choruses with no gap at the top.', watch: 'Stopping at the end of bar 12.', simplify: 'Bars 9–12 only, looped.' })], {
          concept: 'The box moved to other keys around the cycle of fourths, and the end of the form (bars 9–12) played as a turnaround into the next chorus.',
          why: 'Jams call any key, and a clear turnaround tells the band the chorus is starting again.',
          theory: ['Cycle of fourths: each key five frets up (or seven down) on the same string.', 'Bars 11–12 (I – V) set up the return to the I.']
        }),
        S('sh-fills', 'Fills and mixes', 'improv', 'Gaps for licks.', [
          H_('sh-fill', 'Boogie with a pentatonic fill every fourth bar ({chords})', 'variable', { form: 'four', figures: ['r56', 'r567', 'r56', 'fill'], pm: true, goal: 120, start: 72, why: 'A rhythm guitarist fills the last bar of a phrase with a short, simple lick and is back on the figure for the next bar. The switch from rhythm to lead and back must not drop a beat.', instr: HOW + 'Bar 4: the written minor-pentatonic fill (a bend on the G string, down to the low root). Then make up your own fill for bar 4. Pass: four times round, the figure back on time after every fill.', watch: 'The fill rushing.', simplify: 'Hold the root in bar 4.' }),
          H_('sh-mix-adv', 'Stabs and walks alternating through {form} ({key})', 'variable', { form: 'quick', figures: ['stabs', 'walk'], goal: 120, start: 72, minutes: 6, why: 'Alternating chord stabs and the walking bass bar by bar asks the fretting hand to switch between a chord grip and single notes at every bar line.', instr: HOW + 'Odd bars stabs, even bars the walk. Pass: one chorus clean.', watch: 'The grip arriving late after the walk.', simplify: 'Four bars.' })], {
          concept: 'Rhythm parts that leave a gap for a short pentatonic fill, and parts that switch between chord stabs and single-note bass every bar.',
          why: 'Texas players mix lead and rhythm in one part; the groove must survive every switch.',
          theory: ['A fill uses the key’s minor pentatonic and ends on the root, back in the box.', 'Keep fills short and simple; the rhythm is the job.']
        }),
        S('sh-adv-music', 'In music', 'rhythm', 'Two choruses with fills.', [
          H_('sh-two-choruses', 'Two choruses: rhythm with fills through {form} ({key})', 'transfer', { form: 'quick', figures: ['aio', 'aio', 'r567', 'fill', 'r567', 'r567', 'aio', 'fill', 'stabs', 'stabs', 'aio', 'push'], goal: 120, start: 72, minutes: 6, why: 'A band chorus: all-in-one, the long boogie on the IV, fills at the ends of phrases, stabs on the V and a turnaround.', instr: HOW + 'Play it twice with the backing; in the second chorus change both fills to your own. Pass: two choruses in time.', watch: 'The second chorus losing energy: keep the bass firm.', simplify: 'One chorus.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Trading fours: four bars of shuffle rhythm, four bars of solo' })], {
          concept: 'Whole choruses of rhythm with fills, and trading four bars of rhythm with four bars of solo.',
          why: 'This is how the style is played on stage: rhythm and lead from one guitar.',
          theory: ['Fills go at the ends of phrases (bars 4, 8 and 12).', 'Trading fours keeps the form while the role changes.']
        })
      ], [7, 8]),
    stage('mastery', 'The shuffle at will',
      'Play a quick-change shuffle at 140 BPM with the feel intact, play any figure on any chord in any key on sight, play the form in six keys around the cycle, and perform your own 12-bar rhythm chorus.', [
        S('sh-performance', 'At performance tempo', 'rhythm', 'Fast and anywhere.', [
          H_('sh-perf', 'Performance tempo: {form} with mixed figures ({key})', 'edge', { form: 'quick', figures: ['r567', 'walk', 'r567', 'aio'], pm: true, goal: 140, start: 84, minutes: 6, why: 'The whole form at performance tempo with the figure changing: the Texas up-tempo shuffle.', instr: HOW + 'Tempo ladder from the start tempo, +4 BPM after each clean pass. Pass: clean and swung at the goal tempo.', watch: 'The forearm tightening.', simplify: 'The long boogie throughout.' }),
          c => shRandom(c)], {
          concept: 'The whole form at performance tempo, and a new key, chord and figure every bar.',
          why: 'At this level the figures and the box work at any speed and in any order.',
          theory: ['Relaxation is the limit at fast tempos, not finger speed.', 'Look one bar ahead and move the hand on beat 4.']
        }),
        S('sh-recall-m', 'Every key', 'fretboard', 'Six keys; a solo chorus.', [
          H_('sh-all-keys', 'I – IV – I – V in six keys around the cycle of fourths ({key} and up)', 'interleaving', { form: 'four', figures: ['r56', 'r567'], pm: true, keys: [0, 5, 10, 3, 8, 1], goal: 132, start: 80, why: 'The box in six keys around the cycle of fourths at tempo: the map of the shuffle across the neck.', instr: HOW + 'Four bars per key, sliding to the next root on the last 8th. Pass: all six keys in time, then the other six on your own.', watch: 'A gap at each new key.', simplify: 'Three keys.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'A solo chorus over the shuffle, then a rhythm chorus with your own fills' })], {
          concept: 'The shuffle box in six keys around the cycle of fourths, and a solo chorus followed by a rhythm chorus.',
          why: 'A working rhythm player must be ready in any key a singer calls.',
          theory: ['Six keys a fourth apart cover half the cycle; the other six start a half step higher.', 'Above the 12th fret the box repeats an octave lower.']
        }),
        S('sh-voice', 'Your own chorus', 'rhythm', 'A study, then your version.', [c => shEtude(c),
          H_('sh-own', 'Make it yours: rewrite the figure plan for {form} ({key})', 'transfer', { form: 'quick', figures: ['r56', 'walk', 'aio', 'fill'], goal: 132, start: 80, minutes: 6, why: 'Mastery means writing your own part: the tab gives a chorus with four figures in rotation; keep the form and choose your own figure for every bar.', instr: HOW + 'Learn the written chorus, then write your own figure plan (one figure per bar, a fill at least twice) and play both back to back. Pass: your chorus twice, as tight as the written one.', watch: 'A plan that changes every time: fix it and repeat it.', simplify: 'Rewrite four bars.' })], {
          concept: 'An original 12-bar rhythm chorus using every figure, then your own figure plan for the form.',
          why: 'Combining the parts into your own chorus is the goal of the whole path.',
          theory: ['Contrast between sections (boogie, all-in-one, stabs) gives a chorus shape.', 'Fills at phrase ends, a turnaround in bar 12.']
        })
      ], [9, 10])
  ]
});
