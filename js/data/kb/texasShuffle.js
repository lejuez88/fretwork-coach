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
  fill: { label: 'a pentatonic fill', slots: null }
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
    instr: `${names.join(' → ')}. Read only the names: find the root in its box, play the figure. Pass: all 8 bars in time from the names alone.`,
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
    instr: 'Learn it four bars at a time, naming each bar’s figure before you play it. Then write your own chorus with a different figure plan. Pass: the chorus at the goal tempo with the shuffle never straightening, then your own version once.',
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
  sources: ['https://www.guitarworld.com/lessons/talkin-blues-all-one-shuffle-rhythm', 'https://www.premierguitar.com/beyond-blues-texas-rhythm-101', 'https://guitarworld.com/lessons/stevie-ray-vaughan-5-licks', 'https://www.premierguitar.com/articles/27037-rhythm-rules-8-ways-to-navigate-a-12-bar-blues'],
  ctx: { key: 4, minor: false, prog: 'blues' },
  stages: [
    stage('foundations', 'The feel and the first boogie',
      'Count and play the shuffle’s long-short 8ths on one note and hear it against straight 8ths, play root–5th and root–6th boogie figures through I – IV – I – V at 80 BPM with the palm mute tight, name every chord of a 12-bar from memory while playing it, and play a whole 12-bar shuffle.', [
        S('sh-feel', 'The shuffle feel', 'rhythm', 'Long-short, counted and heard.', [
          H_('sh-count', 'Count the shuffle: the root of {key} on every long-short 8th', 'chunking', { form: 'one', figures: 'root', pm: true, goal: 76, start: 50, why: 'The shuffle is a triplet with the middle note left out: long (two triplets), short (one). Counting "1-and-let" on one note, before any chord changes, puts the feel in the hands first.', instr: HOW + 'Palm-mute the low root. Count "1 (and) let, 2 (and) let" aloud and play on "1" and "let" only. Pass: four bars where every note lands on a triplet, never on a straight 8th.', watch: 'Straight 8ths (even notes): the second note is late and short.', simplify: 'Count aloud while tapping your foot, then add the notes.' }),
          H_('sh-hear', 'Hear it first: straight 8ths, then the shuffle ({key})', 'audiation', { form: 'one', figures: 'r5', swing: 'alt', goal: 74, start: 48, why: 'Hearing the same figure straight and then swung, bar by bar, makes the difference audible: the shuffle leans and bounces, straight 8ths march.', instr: HOW + 'Odd bars straight, even bars swung. Before each bar, hum it in the feel it will have. Pass: you can hear and play each feel on demand.', watch: 'Both feels coming out the same.', simplify: 'Hum only, then play only the swung bars.' })]),
        S('sh-boogie', 'The boogie figures', 'fretting', 'Root and 5th, root and 6th.', [
          H_('sh-r5', 'Root and 5th on every shuffle 8th: {chords}', 'accurate-reps', { form: 'iiv', figures: 'r5', pm: true, goal: 78, start: 50, why: 'Two notes (the root and the 5th) on the two lowest strings of the chord are the first shuffle figure (Jimmy Reed’s). The change from I to IV is the same shape moved across one string.', instr: HOW + 'Index on the root, ring finger two frets up on the next string. Count the bars where every pair rings together and the change is on time. Pass: 8 clean bars in a row.', watch: 'Only one string of the pair sounding.', simplify: 'Quarter notes.' }),
          H_('sh-r56', 'The boogie: root–5th, root–6th through {chords}', 'variable', { form: 'four', figures: 'r56', pm: true, goal: 80, start: 52, why: 'Reaching from the 5th to the 6th with the pinky (two beats each pair) is the classic boogie: the bass line that every blues band uses. On the V chord the same shape moves two frets up.', instr: HOW + 'Index on the root, ring on the 5th, pinky stretching to the 6th two frets higher. Pass: four bars with the pinky reaching the 6th on time.', watch: 'The index lifting off the root when the pinky stretches.', simplify: 'Root–5th only on the V chord.' })]),
        S('sh-form', 'The form and the sound', 'fretboard', 'The 12-bar from memory; the tight mute.', [
          H_('sh-12-names', 'From memory: name each chord of {form} as you play it', 'retrieval', { form: 'quick', figures: 'r5', pm: true, goal: 78, start: 50, minutes: 6, why: 'The 12-bar form has to be in memory so the hands can move before the bar line. Saying each chord as you play its bar (and before the change) is the retrieval that fixes it.', instr: 'Cover the tab. Play root–5th through the quick-change 12-bar, saying the chord (I, IV or V) on beat 4 of the bar before it changes. Pass: a whole chorus from memory, every change on time.', watch: 'Forgetting the quick change in bar 2 or the V in bar 9.', simplify: 'Look at the form once, then cover it.' }),
          H_('sh-mute', 'The tight palm mute: boogie figures in {key}, listening to the chug', 'external-focus', { form: 'four', figures: 'r56', pm: true, goal: 80, start: 52, why: 'A shuffle is a drum part as much as a bass line. With the palm resting at the right place on the bass strings the figures chug: pitched but short and punchy. The sound is the guide.', instr: HOW + 'Move the palm closer to the neck until the notes choke, then back until they just ring with a thump. Listen for every pair the same length and loudness. Pass: four bars with an even chug.', watch: 'The mute so heavy the pitch disappears.', simplify: 'Root–5th only.' })]),
        S('sh-first-music', 'First music', 'rhythm', 'A whole shuffle.', [
          H_('sh-first-12', 'First 12-bar shuffle: the boogie through {form} in {key}', 'transfer', { form: 'slow', figures: 'r56', pm: true, goal: 82, start: 54, minutes: 6, why: 'The whole 12-bar form in one figure, with the backing: a real blues rhythm part you can play in a band.', instr: HOW + 'Play the chorus with the backing, then a second chorus starting the bars with a slightly heavier accent on beats 2 and 4. Pass: two choruses without stopping.', watch: 'Speeding up in the IV bars.', simplify: 'Root–5th through the form.' }),
          H_('sh-reed', 'Jimmy Reed style: the long boogie through {chords}', 'transfer', { form: 'four', figures: ['r567', 'r56', 'r567', 'r5'], pm: true, goal: 82, start: 54, why: 'The long boogie reaches up to the ♭7 before coming back: the lazy, rolling figure of Chicago and Texas blues. Mixing it with shorter figures already sounds like a part.', instr: HOW + 'The pinky reaches the ♭7 three frets above the 5th. Pass: four times round with the backing.', watch: 'The ♭7 reach pulling the hand out of position.', simplify: 'The boogie (5th–6th) every bar.' })])
      ], [1, 3]),
    stage('intermediate', 'Walking bass and all-in-one',
      'Play the long boogie and the boogie walk through the 12-bar at 100 BPM, play the all-in-one part (bass on the beat, a stab on the off-beat) with even balance, play chord stabs with muted scratches, change figure every bar, play the form in four called keys from memory, and play a full shuffle chorus with the backing.', [
        S('sh-figures', 'More figures', 'fretting', 'The long boogie; the walk.', [
          H_('sh-r567', 'The long boogie through {form} ({key})', 'variable', { form: 'quick', figures: 'r567', pm: true, goal: 96, start: 58, minutes: 6, why: 'The long boogie through the whole quick-change form: the reach to the ♭7 on every chord, the shape moving between strings at every change.', instr: HOW + 'Keep the index anchored on each root. Pass: one chorus clean.', watch: 'The ♭7 coming late.', simplify: 'The first four bars.' }),
          H_('sh-walk', 'The boogie walk: single notes through {chords}', 'chunking', { form: 'four', figures: 'walk', goal: 94, start: 56, why: 'The boogie walk spells the dominant chord as a bass line (R, 3, 5, 6, ♭7 and back down): the piano boogie left hand on the guitar. Learn the up half, then the down half, then join them.', instr: HOW + 'First the first four notes only (R, 3, 5, 6) four times, then the way down, then the whole bar. Pass: four bars with every note in the shuffle.', watch: 'The 3rd (a stretch on the root string) out of tune.', simplify: 'The first half of every bar, then hold the root.' })]),
        S('sh-aio', 'All-in-one', 'rhythm', 'Bass and stab together.', [
          H_('sh-aio-4', 'All-in-one: bass on the beat, a stab on the off-beat ({chords})', 'external-focus', { form: 'four', figures: 'aio', goal: 92, start: 54, why: 'One guitar playing the bass line on the beat and a short chord stab on every off-beat (what two guitars did in Jimmy Reed’s band) is the heart of the Texas style. The two layers must balance: a firm bass, a light, short stab.', instr: HOW + 'Downstroke the bass note on the beat, upstroke a short stab on the top strings on the "let". Mute the stab right away by releasing the fingers. Listen for two layers at two volumes. Pass: four bars with every stab short and lighter than the bass.', watch: 'The stabs ringing over the next bass note.', simplify: 'Stabs on beats 2 and 4 only.' }),
          H_('sh-aio-12', 'All-in-one through {form} ({key})', 'accurate-reps', { form: 'quick', figures: 'aio', goal: 92, start: 54, minutes: 6, why: 'The all-in-one part through the whole form: every chord has its own bass walk and stab grip. Counting clean bars builds it bar by bar.', instr: HOW + 'Count only the bars where every stab is short and every bass note is on time. Pass: 12 clean bars in a row.', watch: 'Losing the stab grip at the V chord.', simplify: 'Four bars.' })]),
        S('sh-stabs', 'Stabs and scratches', 'rhythm', 'The chord as a drum.', [
          H_('sh-scratch', 'Chord stabs with muted scratches: {chords}', 'variable', { form: 'four', figures: 'stabs', goal: 92, start: 54, why: 'A big, oval strumming motion that never stops, with the fretting hand pressing only for the stabs and releasing for the scratches, gives the shuffle its swagger (the "Cold Shot" approach).', instr: HOW + 'Strum every triplet position the figure uses; press the 9th or 7th grip for the stabs, release it for the scratches. Pass: four bars in time with every scratch dead.', watch: 'The strumming hand stopping on the rests.', simplify: 'Stabs only, no scratches.' }),
          H_('sh-push', 'Off-beat stabs (behind a singer): {chords}', 'variable', { form: 'iiv', figures: 'push', goal: 92, start: 54, why: 'Behind a vocal the rhythm part gets out of the way: short stabs on the off-beats only, locked with the drummer’s hi-hat. Less is the point.', instr: HOW + 'Stab only on each "let", short. Pass: four bars, every stab exactly on the last triplet.', watch: 'Stabs drifting onto the beat.', simplify: 'Two stabs per bar.' })]),
        S('sh-keys', 'Mixed and in any key', 'fretboard', 'A figure every bar; called keys.', [
          H_('sh-mixed', 'A new figure every bar through {form} ({key})', 'interleaving', { form: 'quick', figures: ['r56', 'walk', 'r567', 'aio'], pm: false, goal: 92, start: 54, minutes: 6, why: 'Real parts change figure from bar to bar. Rotating four figures through the form mixes them the way playing does, which makes each one stick better.', instr: HOW + 'Boogie, walk, long boogie, all-in-one, in turn, through the 12 bars. Pass: one chorus without stopping.', watch: 'The figure change pulling you off the shuffle.', simplify: 'Two figures in turn.' }),
          H_('sh-keys', 'From memory: four called keys, four bars each (E, A, G, C relative to {key})', 'retrieval', { form: 'four', figures: 'r56', pm: true, keys: [0, 5, 3, 8], goal: 90, start: 54, why: 'The box is movable: find the I chord’s root on the low E and everything else follows. Recalling the box in a called key is what lets you play a shuffle in anyone’s key.', instr: 'Cover the tab. Four keys (the key, up a 4th, up a minor 3rd, up a minor 6th), four bars each. Say the key, find the root, play. Pass: all four from memory.', watch: 'A gap at each new key.', simplify: 'Two keys.' })]),
        S('sh-music', 'In music', 'rhythm', 'A chorus and a solo.', [
          H_('sh-chorus', 'A shuffle chorus: all-in-one, boogie and stabs through {form} ({key})', 'transfer', { form: 'quick', figures: ['aio', 'aio', 'aio', 'aio', 'r567', 'r567', 'aio', 'aio', 'stabs', 'stabs', 'aio', 'push'], goal: 96, start: 58, minutes: 6, why: 'A chorus that sounds like a record: all-in-one on the I, the long boogie on the IV, stabs to lift the V, off-beat stabs as the turnaround.', instr: HOW + 'Play two choruses with the backing. Pass: both in time with the feel never straightening.', watch: 'Rushing the stabs at bar 9.', simplify: 'All-in-one throughout.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Over your own shuffle: a solo chorus, then back to the rhythm' })])
      ], [4, 6]),
    stage('advanced', 'At tempo, anywhere',
      'Play the long boogie and the walk at 132 BPM, move the box to any key and play the form from memory, mix stabs and walks and add a pentatonic fill in the form’s gaps, and play two choruses of rhythm with fills.', [
        S('sh-tempo', 'Tempo', 'rhythm', 'Fast shuffles.', [
          H_('sh-fast', 'Fast shuffle: the long boogie at the edge ({chords})', 'edge', { form: 'four', figures: 'r567', pm: true, goal: 132, start: 80, why: 'Fast shuffles (the Texas up-tempo sound) need a loose wrist and a small motion; the feel must stay long-short at speed, not turn into straight 8ths.', instr: HOW + 'Tempo ladder: +4 BPM after each clean pass. Pass: clean and swung at the goal tempo.', watch: 'The shuffle straightening at speed.', simplify: 'Root–5th.' }),
          H_('sh-walk-fast', 'The walk at tempo through {form} ({key})', 'accurate-reps', { form: 'quick', figures: 'walk', goal: 126, start: 76, minutes: 6, why: 'The boogie walk through the whole form at tempo: every note of every chord’s walk clean.', instr: HOW + 'Count only clean bars. Pass: 12 in a row.', watch: 'Missing the 3rd stretch at speed.', simplify: 'Four bars.' })]),
        S('sh-neck', 'Any key', 'fretboard', 'Moved and recalled.', [
          H_('sh-four-keys', 'Four keys around the cycle of fourths: the boogie through {chords}', 'interleaving', { form: 'four', figures: ['r56', 'walk'], keys: [0, 5, 10, 3], pm: true, goal: 120, start: 72, why: 'The box moved through four keys a fourth apart, alternating figures: each key puts the box somewhere new on the neck.', instr: HOW + 'Four bars per key, the figure alternating. Pass: all 16 bars without stopping.', watch: 'Keys high on the neck feeling cramped: keep the shape exact.', simplify: 'Two keys.' }),
          H_('sh-recall', 'From memory: {form} in {key} with the figures you choose', 'retrieval', { form: 'slow', figures: ['r567', 'r56'], pm: true, goal: 120, start: 72, minutes: 6, why: 'The form, the box and the figures from memory together, with the tab covered: what you need in a jam.', instr: 'Cover the tab. Play the slow-change 12-bar, saying the bar numbers 5, 9 and 11 aloud as they arrive. Pass: two choruses from memory.', watch: 'Losing count in bars 7–8.', simplify: 'One chorus.' })]),
        S('sh-fills', 'Fills and mixes', 'improv', 'Gaps for licks.', [
          H_('sh-fill', 'Boogie with a pentatonic fill every fourth bar ({chords})', 'variable', { form: 'four', figures: ['r56', 'r567', 'r56', 'fill'], pm: true, goal: 120, start: 72, why: 'A rhythm guitarist fills the last bar of a phrase with a short lick and is back on the figure for the next bar. The switch from rhythm to lead and back must not drop a beat.', instr: HOW + 'Bar 4: the written minor-pentatonic fill (a bend on the G string, down to the low root). Then make up your own fill for bar 4. Pass: four times round, the figure back on time after every fill.', watch: 'The fill rushing.', simplify: 'Hold the root in bar 4.' }),
          H_('sh-mix-adv', 'Stabs and walks alternating through {form} ({key})', 'variable', { form: 'quick', figures: ['stabs', 'walk'], goal: 120, start: 72, minutes: 6, why: 'Alternating chord stabs and the walking bass bar by bar asks the fretting hand to switch between a chord grip and single notes at every bar line.', instr: HOW + 'Odd bars stabs, even bars the walk. Pass: one chorus clean.', watch: 'The grip arriving late after the walk.', simplify: 'Four bars.' })]),
        S('sh-adv-music', 'In music', 'rhythm', 'Two choruses with fills.', [
          H_('sh-two-choruses', 'Two choruses: rhythm with fills through {form} ({key})', 'transfer', { form: 'quick', figures: ['aio', 'aio', 'r567', 'fill', 'r567', 'r567', 'aio', 'fill', 'stabs', 'stabs', 'aio', 'push'], goal: 120, start: 72, minutes: 6, why: 'A band chorus: all-in-one, the long boogie on the IV, fills at the ends of phrases, stabs on the V and a turnaround.', instr: HOW + 'Play it twice with the backing; in the second chorus change both fills to your own. Pass: two choruses in time.', watch: 'The second chorus losing energy: keep the bass firm.', simplify: 'One chorus.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Trading fours: four bars of shuffle rhythm, four bars of solo' })])
      ], [7, 8]),
    stage('mastery', 'The shuffle at will',
      'Play a quick-change shuffle at 140 BPM with the feel intact, play any figure on any chord in any key on the spot, play the form in all twelve keys from memory, and perform your own 12-bar rhythm chorus.', [
        S('sh-performance', 'At performance tempo', 'rhythm', 'Fast and anywhere.', [
          H_('sh-perf', 'Performance tempo: {form} with mixed figures ({key})', 'edge', { form: 'quick', figures: ['r567', 'walk', 'r567', 'aio'], pm: true, goal: 140, start: 84, minutes: 6, why: 'The whole form at performance tempo with the figure changing: the Texas up-tempo shuffle.', instr: HOW + 'Tempo ladder from the start tempo, +4 BPM after each clean pass. Pass: clean and swung at the goal tempo.', watch: 'The forearm tightening.', simplify: 'The long boogie throughout.' }),
          c => shRandom(c)]),
        S('sh-recall-m', 'Every key', 'fretboard', 'All twelve keys; trading choruses.', [
          H_('sh-all-keys', 'From memory: I – IV – I – V in six keys around the cycle ({key} and up)', 'retrieval', { form: 'four', figures: 'r56', pm: true, keys: [0, 5, 10, 3, 8, 1], goal: 132, start: 80, why: 'The box in six keys around the cycle of fourths, recalled under time: the map of the shuffle across the neck.', instr: 'Cover the tab. Four bars per key. Pass: all six keys in time from memory, then the other six on your own.', watch: 'A gap at each new key.', simplify: 'Three keys.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'A solo chorus over the shuffle, then a rhythm chorus with your own fills' })]),
        S('sh-voice', 'Your own chorus', 'rhythm', 'A study, then your version.', [c => shEtude(c),
          H_('sh-own', 'Make it yours: rewrite the figure plan for {form} ({key})', 'transfer', { form: 'quick', figures: ['r56', 'walk', 'aio', 'fill'], goal: 132, start: 80, minutes: 6, why: 'Mastery means writing your own part: the tab gives a chorus with four figures in rotation; keep the form and choose your own figure for every bar.', instr: HOW + 'Learn the written chorus, then write your own figure plan (one figure per bar, a fill at least twice) and play both back to back. Pass: your chorus twice, as tight as the written one.', watch: 'A plan that changes every time: fix it and repeat it.', simplify: 'Rewrite four bars.' })])
      ], [9, 10])
  ]
});
