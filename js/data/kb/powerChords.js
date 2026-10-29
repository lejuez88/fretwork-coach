// Power chords and rock rhythm: the two-note (root and fifth) and three-note (plus octave) shapes with
// the root on the 6th, 5th, 4th or 3rd string, moved along the neck by their roots, the same chord in two
// places, shifting with the fewest moves, and the rock rhythms built from them.
//
// Concept-first (CONTENT.md): the model is a SHAPE and a PLACE. A power chord is the root, the fifth
// (seven semitones up) and optionally the octave. On a root string rs it is a fixed pattern of frets
// relative to the root fret f:
//   rs 6 or 5:  [rs, f] [rs-1, f+2] [rs-2, f+2]     (root, 5th, octave)
//   rs 4:       [4, f]  [3, f+2]    [2, f+3]         (the G string tuning shifts the octave a fret higher)
//   rs 3:       [3, f]  [2, f+3]    [1, f+3]
// The PLACE of a chord is found from its root note: the fret f on the root string whose pitch class is the
// chord's root, nearest to where the hand is now. A progression is a list of bars; each bar is a root (an
// offset from the key) and a root string plan; each bar plays a rhythm PATTERN (a list of [slot, length,
// kind] on a 16-slot grid: A ring, C palm-muted chug, R root only, x dead scratch, N the next chord's shape
// an 8th early). Every sounding note is the chord's root, fifth or octave in every key by construction.
//
// Teaching method first (CONTENT.md, `pedagogy` below), researched 2026-10-29: teachers start with the
// root on the low E string and strum only the strings in the shape, move that shape along the neck, then
// learn the same form with the root on the A string, add the higher root (three notes) and the barre
// version, learn that every power chord has two places (6th- or 5th-string root) and choose the closer one,
// then add palm muting and switching between muted and open, and finally the stretchier shapes on higher
// strings, always starting higher on the neck where the frets are closer.
import { OPEN, N, nameOf, make, mod12, S, stage, entry } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const pitch = (s, f) => OPEN[s] + f;
const lv = c => c.lvl || 1;

/** Fret on string s (minF–maxF) whose pitch class is pc, nearest to `near`; null if none. */
export function rootFret(pc, s, near, minF = 0, maxF = 12) {
  let best = null;
  for (let f = minF; f <= maxF; f++) if (mod12(pitch(s, f)) === mod12(pc)) { const d = Math.abs(f - near); if (best == null || d < best.d) best = { f, d }; }
  return best ? best.f : null;
}
/** The shape with its root on string rs at fret f: [[string, fret], …] root, fifth, octave. */
export function shapeAt(rs, f, size = 3) {
  const all = rs >= 5 ? [[rs, f], [rs - 1, f + 2], [rs - 2, f + 2]] : rs === 4 ? [[4, f], [3, f + 2], [2, f + 3]] : [[3, f], [2, f + 3], [1, f + 3]];
  return all.slice(0, size);
}
const framed = notes => { const a = [null, null, null, null, null, null]; notes.forEach(([s, f]) => { a[6 - s] = f; }); return a; };
const cname = pc => nameOf(pc) + '5';

/** Pick the root string and fret for a chord: plan is a string number, 'nearest' (6 or 5) or 'any' (6, 5 or 4). */
function place(pc, plan, near, o = {}) {
  const minF = o.minF || 0, cands = plan === 'nearest' ? [6, 5] : plan === 'any' ? [6, 5, 4] : [plan];
  let best = null;
  for (const rs of cands) {
    const f = rootFret(pc, rs, near, minF, rs <= 4 ? 12 : 12);
    if (f == null) continue;
    const d = Math.abs(f - near) + (cands.length > 1 ? (6 - rs) * 0.01 : 0);
    if (!best || d < best.d) best = { rs, f, d };
  }
  return best;
}

/** Rhythm patterns on 16 slots: [slot, length, kind]. */
const E8 = kind => [0, 2, 4, 6, 8, 10, 12, 14].map(s => [s, 2, kind]);
export const PAT = {
  whole: { name: 'whole notes', unit: 'whole notes', ev: [[0, 16, 'A']] },
  half: { name: 'half notes', unit: 'half notes', ev: [[0, 8, 'A'], [8, 8, 'A']] },
  q: { name: 'quarter notes', unit: 'quarter notes', ev: [0, 4, 8, 12].map(s => [s, 4, 'A']) },
  e8: { name: '8th notes', unit: '8th notes', ev: E8('A') },
  mute4: { name: 'four muted, four open', unit: '8th notes', ev: [...[0, 2, 4, 6].map(s => [s, 2, 'C']), ...[8, 10, 12, 14].map(s => [s, 2, 'A'])] },
  acc1: { name: '8ths, open on 1', unit: '8th notes', ev: [[0, 2, 'A'], ...[2, 4, 6, 8, 10, 12, 14].map(s => [s, 2, 'C'])] },
  acc13: { name: '8ths, open on 1 and 3', unit: '8th notes', ev: [0, 2, 4, 6, 8, 10, 12, 14].map(s => [s, 2, s === 0 || s === 8 ? 'A' : 'C']) },
  synco: { name: '3+3+2 hits', unit: 'syncopated 8ths', ev: [[0, 3, 'A'], [3, 3, 'A'], [6, 2, 'A'], [8, 3, 'A'], [11, 3, 'A'], [14, 2, 'A']] },
  stops: { name: 'hits and scratches', unit: 'syncopated 8ths', ev: [[0, 2, 'A'], [2, 2, 'x'], [4, 2, 'A'], [6, 2, 'x'], [8, 2, 'A'], [10, 2, 'x'], [12, 4, 'A']] },
  fullRoot: { name: 'full chord, then root', unit: '8th notes', ev: [[0, 2, 'A'], ...[2, 4, 6].map(s => [s, 2, 'R']), [8, 2, 'A'], ...[10, 12, 14].map(s => [s, 2, 'R'])] },
  fullRoot2: { name: 'full chord on 1 and 3, root between', unit: '8th notes', ev: [[0, 2, 'A'], [2, 2, 'R'], [4, 2, 'R'], [6, 2, 'R'], [8, 2, 'A'], [10, 2, 'R'], [12, 2, 'R'], [14, 2, 'A']] },
  push: { name: 'the push (next chord an 8th early)', unit: '8th notes', ev: [[0, 4, 'A'], [4, 4, 'A'], [8, 2, 'A'], [10, 2, 'A'], [12, 2, 'A'], [14, 2, 'N']] },
  offbeat: { name: 'chops on the "&"s', unit: '8th notes', ev: [2, 6, 10, 14].map(s => [s, 2, 'A']) },
  s16: { name: 'muted 16ths, open on 1 and the "a" of 2', unit: '16th notes', ev: Array.from({ length: 16 }, (_, i) => [i, 1, i === 0 || i === 7 ? 'A' : 'C']) },
  s16b: { name: 'muted 16ths, open on 1, "&" of 2 and 4', unit: '16th notes', ev: Array.from({ length: 16 }, (_, i) => [i, 1, i === 0 || i === 6 || i === 12 ? 'A' : 'C']) }
};

/** Chord roots (offsets above the key) for the progressions the lessons use. */
export const PROG = {
  one: () => [0, 0, 0, 0],
  ivv: () => [0, 5, 7, 5],
  iv: () => [0, 5, 0, 5],
  rock: c => (c.minor ? [0, 8, 10, 0] : [0, 10, 5, 0]),
  rock2: c => (c.minor ? [0, 3, 8, 10] : [0, 7, 9, 5]),
  turn: c => (c.minor ? [0, 5, 3, 7] : [0, 5, 7, 5])
};
/** Bars from a list of offsets: plan for every chord, a pattern, repeated `reps` times. */
const bars = (offs, plan, pat, reps = 1) => Array.from({ length: reps }, () => offs.map((off, i) => ({ off, plan: Array.isArray(plan) ? plan[i % plan.length] : plan, pat: Array.isArray(pat) ? pat[i % pat.length] : pat }))).flat();

/**
 * One exercise from a spec: { bars: (c, keyPc) => [{off, plan, pat}], keys (offsets, default [0]), size, near, minF, slide,
 * name ('{chords}', '{key}'), unit, goal, start, why, instr, watch, simplify, method, minutes }.
 */
export function pcRun(c, id, method, spec) {
  const notes = [], used = [], voicings = []; let t = 0, near = spec.near != null ? spec.near : 3;
  const size = typeof spec.size === 'function' ? spec.size(c) : spec.size || 3;
  const pats = new Set();
  for (const ko of spec.keys || [0]) {
    const k = mod12(c.key + ko), list = spec.bars(c, k);
    let prev = null;
    for (const [i, b] of list.entries()) {
      const root = mod12(k + b.off), pl = place(root, b.plan, near, spec); if (!pl) return null;
      const P = PAT[b.pat]; pats.add(b.pat);
      const pcs = [root, mod12(root + 7)], sh = shapeAt(pl.rs, pl.f, size);
      let first = true;
      for (const [sl, len, kind] of P.ev) {
        const T = t + sl / 4, D = len / 4;
        if (kind === 'x') {
          sh.slice(0, 2).forEach(([s, f]) => notes.push(tag(N(s, f, T, D, 'mute', { chord: true }), null)));
        } else if (kind === 'R') {
          notes.push(tag(N(sh[0][0], sh[0][1], T, D), pcs));
        } else if (kind === 'N') {
          const nb = list[(i + 1) % list.length], nr = mod12(k + nb.off), np = place(nr, nb.plan, pl.f, spec); if (!np) return null;
          shapeAt(np.rs, np.f, size).forEach(([s, f]) => notes.push(tag(N(s, f, T, D, null, { chord: true }), [nr, mod12(nr + 7)])));
        } else {
          let x = kind === 'C' ? 'pm' : null;
          if (kind === 'A' && first && spec.slide && prev && prev.rs === pl.rs && prev.f >= 1 && pl.f >= 1 && prev.f !== pl.f) x = pl.f > prev.f ? '/' : '\\';
          sh.forEach(([s, f]) => notes.push(tag(N(s, f, T, D, x, { chord: true }), pcs)));
          if (kind === 'A') first = false;
        }
      }
      used.push(cname(root)); near = pl.f; prev = pl;
      const fr = framed(sh), vname = cname(root);
      if (!voicings.some(v => v.name === vname && v.frets.join() === fr.join())) voicings.push({ name: vname, frets: fr });
      t += 4;
    }
  }
  if (notes.length < 6 || notes.length > 400) return null;
  const uniq = [...new Set(used)], keyName = `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`;
  const fill = x => String(x).replace(/\{chords\}/g, uniq.slice(0, 6).join(' – ')).replace(/\{key\}/g, keyName);
  const first = PAT[[...pats][0]];
  return make(c, {
    id, name: fill(spec.name), domain: 'rhythm', method, unit: spec.unit || first.unit, goal: spec.goal, start: spec.start, minutes: spec.minutes || 5,
    picking: spec.picking || (first.unit.includes('16th') ? 'alternate' : 'down'),
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify,
    backing: used, chords: uniq, ...(voicings.length <= 8 ? { voicings } : {}), tab: { notes }
  });
}
const ST = (concept, why, theory) => ({ concept, why, theory });
const G = (id, method, spec) => c => pcRun(c, id, method, typeof spec === 'function' ? spec(c) : spec);

/* ------------------------------ Foundations ------------------------------ */
const six1 = G('pc-six-one', 'accurate-reps', c => ({
  name: 'The first shape: root on the 6th string ({chords})', size: 2, near: 3, bars: () => bars(PROG.one(), 6, 'q'), goal: 90, start: 55,
  why: 'Every teacher starts with the same two-note shape: the root on the low E string and the note two frets up on the next string. It is the shape you will use for the rest of your playing.',
  instr: 'Index finger on the root (6th string), third finger two frets higher on the 5th string, right behind the frets. Pick only those two strings, one downstroke per click, four bars. Mute the other strings with the side of the picking hand and the underside of the first finger. Pass: 4 bars where only the two shape strings sound, every strum on the click.',
  watch: 'Strumming across all six strings so the open strings ring.', simplify: 'One strum per bar, then two.'
}));
const sixMove = G('pc-six-move', 'chunking', {
  name: 'Moving the shape along the 6th string: {chords}', size: 2, near: 3, bars: () => bars(PROG.ivv(), 6, 'q', 2), goal: 90, start: 55,
  why: 'The shape has no open strings in it, so it slides anywhere. The root note tells you where the chord is: a different root, a different power chord.',
  instr: 'Keep the two-note shape and move it so the root lands on each chord name in turn (I, IV, V, IV in the key). Move the whole hand at once, with no flattening of the fingers. Pass: 8 bars with every change on the beat and no stray string noise.',
  watch: 'Letting the shape collapse into a barre while moving.', simplify: 'Two bars per chord.'
});
const five1 = G('pc-five-one', 'accurate-reps', {
  name: 'The same shape with the root on the 5th string ({chords})', size: 2, near: 3, bars: () => bars(PROG.one(), 5, 'q'), goal: 90, start: 55,
  why: 'Shape 2 is exactly the first shape one string higher: root on the A string, fifth on the D string. The form is the same; only the root string changes.',
  instr: 'Index finger on the root (5th string), third finger two frets up on the 4th string. Strum only those two strings, one downstroke per click, four bars. Pass: 4 bars with the 6th string silent (touch it lightly with the tip of the index finger).',
  watch: 'The low E string ringing because the first finger leans away.', simplify: 'Two strums per bar.'
});
const fiveMove = G('pc-five-move', 'chunking', {
  name: 'Moving the 5th-string shape: {chords}', size: 2, near: 3, bars: () => bars(PROG.ivv(), 5, 'q', 2), goal: 90, start: 55,
  why: 'Roots on the 5th string sit five frets lower than the same note on the 6th string, so the same chord needs a different fret.',
  instr: 'Move the 5th-string shape so the root lands on I, IV, V and IV. Keep the root finger as your guide: the chord is named by its lowest note. Pass: 8 bars with every change on the beat.',
  watch: 'Moving to the fret where the 6th-string version was.', simplify: 'Play only I and IV.'
});
const three6 = G('pc-three-six', 'accurate-reps', {
  name: 'Three-note shape, root on the 6th string: {chords}', size: 3, near: 5, bars: () => bars(PROG.ivv(), 6, 'q', 2), goal: 90, start: 55,
  why: 'Adding the octave of the root (on the 4th string, the same fret as the fifth) makes the chord fuller without changing what it is.',
  instr: 'Play the two-note shape and add the 4th string at the same fret as the 5th-string note, using the fourth finger (or bar the two notes with the third finger). Strum three strings. Pass: 8 bars with all three notes clear at every chord.',
  watch: 'The third finger muting the 4th string note when it should sound.', simplify: 'Go back to two notes and add the third on the last two bars.'
});
const three5 = G('pc-three-five', 'chunking', {
  name: 'Three-note shape, root on the 5th string: {chords}', size: 3, near: 5, bars: () => bars(PROG.ivv(), 5, 'q', 2), goal: 90, start: 55,
  why: 'The same three-note form one string higher gives a bigger sound that is easier to play higher up the neck.',
  instr: 'Root on the 5th string, fifth and octave two frets higher on the 4th and 3rd strings. Use the barre version (third finger across both notes) and the fourth-finger version, and keep the one that is more comfortable. Pass: 8 bars with all three notes sounding.',
  watch: 'Muffling the 3rd string note with the barre finger.', simplify: 'Play two notes first.'
});
const placesSame = G('pc-places-same', 'chunking', {
  name: 'One chord, two places: {chords}', size: 2, near: 5, bars: () => [0, 5, 7].flatMap(o => [{ off: o, plan: 6, pat: 'q' }, { off: o, plan: 5, pat: 'q' }]), goal: 90, start: 55,
  why: 'Every power chord exists with its root on the 6th string and again on the 5th string; they sound nearly the same, so you choose the one that is closer to your hand.',
  instr: 'Play each chord twice: first with the root on the 6th string, then the same chord with the root on the 5th string (a few frets lower, so the hand does not travel far). Say which place is closer to the previous chord. Pass: all six bars with the same chord sounding both times.',
  watch: 'Choosing a place by habit instead of by distance.', simplify: 'Only the first two chords.'
});
const placesNear = G('pc-places-near', 'transfer', c => ({
  name: 'A rock progression with the closest places ({key}: {chords})', size: 3, near: 3, bars: c2 => bars(PROG.rock(c2), 'nearest', 'e8', 2), goal: 100, start: 60,
  why: 'Music: choosing the nearest place for each chord keeps the hand small, which is how real riffs are played.',
  instr: 'Play the four chords, two bars of straight 8ths each pass, taking each root from the 6th or 5th string, whichever is nearer the previous chord. Pass: 8 bars of even down-strokes with no big jumps.',
  watch: 'Jumping up the neck for a chord that is one fret away on the other string.', simplify: 'Quarter notes, two-note shapes.'
}));

/* ------------------------------ Intermediate ------------------------------ */
const eightsOne = G('pc-eights-one', 'accurate-reps', {
  name: 'Straight 8ths on one power chord ({chords})', size: 3, near: 3, bars: () => bars(PROG.one(), 6, 'e8', 4), goal: 120, start: 80, picking: 'alternate',
  why: 'Eighth-note power chords are the pulse of rock rhythm. The picking hand swings steadily, touching the strings on every swing.',
  instr: 'Strum the three-note shape in steady 8ths with the root fingers anchored; keep the strum small and from the wrist. Pass: 4 bars (16 strums) with the 4th, 5th and 6th strings clean on every strum.',
  watch: 'Tension in the arm from big strums.', simplify: 'Quarter notes.'
});
const eightsProg = G('pc-eights-prog', 'accurate-reps', {
  name: '8ths on a rock progression ({key}: {chords})', size: 3, near: 3, bars: c => bars(PROG.rock(c), 'nearest', 'e8', 2), goal: 120, start: 80, picking: 'alternate',
  why: 'Changing between shapes while the strumming hand keeps going is the actual skill of rock rhythm.',
  instr: 'Play 8ths over the four chords, one bar each, changing on beat 1 and moving to the next shape on the last 8th. Pass: 8 bars with no gap at the changes.',
  watch: 'Waiting for the new shape.', simplify: 'Two bars per chord.'
});
const muteMix = G('pc-mute-mix', 'chunking', {
  name: 'Four muted, four open ({chords})', size: 3, near: 3, bars: () => bars(PROG.one(), 6, 'mute4', 4), goal: 115, start: 75, picking: 'alternate',
  why: 'Resting the side of the picking hand on the strings at the bridge turns the chord into a short chug; lifting it lets the chord ring. Switching between the two is what makes riffs punchy.',
  instr: 'Palm-mute the first four 8ths of each bar (the hand rests lightly on the strings next to the bridge), then lift the hand for the last four so the chord rings. Pass: 4 bars where the muted and open halves are clearly different and in time.',
  watch: 'Resting too far back (no mute) or too far forward (a dead click).', simplify: 'Mute and open one beat each.'
});
const muteAcc = G('pc-mute-acc', 'interleaving', {
  name: 'Muted chugs with open accents ({key}: {chords})', size: 3, near: 3, bars: c => bars(PROG.rock(c), 'nearest', ['acc1', 'acc13'], 2), goal: 115, start: 75, picking: 'alternate',
  why: 'A riff mostly muted with a ringing chord on the strong beats is the standard hard-rock rhythm part.',
  instr: 'Palm-mute the chugs and lift the hand on the open hits (beat 1, then beats 1 and 3 in the next bar) over the four chords. Pass: 8 bars with the accents ringing and the chugs short.',
  watch: 'Accents that are not louder than the chugs.', simplify: 'One accent per bar only.'
});
const shiftSlide = G('pc-shift-slide', 'chunking', {
  name: 'Sliding the shape between chords ({chords})', size: 2, near: 5, minF: 1, slide: true, bars: () => bars(PROG.ivv(), 6, 'q', 2), goal: 100, start: 60,
  why: 'Sliding the whole shape keeps the strings sounding through the change; it is the classic way to move a power chord, and it ties the roots together.',
  instr: 'Keep the pressure on and slide the two-note shape to the next root (IV, then V, then back) on beat 1, without lifting. Pass: 8 bars with the slides landing on the right fret and no gap in the sound.',
  watch: 'Releasing the pressure so the shape falls apart mid-slide.', simplify: 'Lift and re-place the shape.'
});
const shiftSets = G('pc-shift-sets', 'transfer', {
  name: 'Same fret, other string: I and IV ({chords})', size: 3, near: 5, minF: 1, bars: () => [{ off: 0, plan: 6, pat: 'e8' }, { off: 5, plan: 5, pat: 'e8' }, { off: 0, plan: 6, pat: 'e8' }, { off: 5, plan: 5, pat: 'e8' }, { off: 7, plan: 6, pat: 'e8' }, { off: 5, plan: 5, pat: 'e8' }, { off: 0, plan: 6, pat: 'e8' }, { off: 0, plan: 6, pat: 'e8' }], goal: 115, start: 75, picking: 'alternate',
  why: 'The chord a fourth above has its root on the next string at the same fret. Switching string sets between chords keeps the hand where it is, which is how guitarists make riffs fast to play.',
  instr: 'I with the root on the 6th string, IV with the root on the 5th string at the same fret (just move the shape down a string), and V with the root on the 6th string. Pass: 8 bars of 8ths where the I–IV change is only a move across the strings.',
  watch: 'Sliding up the neck for the IV when it is on the next string.', simplify: 'Play I and IV only.'
});
const rhythmSynco = G('pc-rhythm-synco', 'accurate-reps', {
  name: 'Power chords in 3+3+2 ({key}: {chords})', size: 3, near: 3, bars: c => bars(PROG.rock(c), 'nearest', 'synco', 2), goal: 110, start: 70,
  why: 'Grouping the 8ths as 3 + 3 + 2 puts the hits between the beats; the chord rings on a different part of the bar.',
  instr: 'Strum on the accents of the 3 + 3 + 2 grouping (counting 1 2 3, 1 2 3, 1 2), twice per bar, over the progression. Pass: 8 bars where the groups stay even and the changes land on the first hit.',
  watch: 'Rushing the 2 at the end of each half-bar.', simplify: 'Clap the 3 + 3 + 2 and count aloud first.'
});
const rhythmStops = G('pc-rhythm-stops', 'transfer', {
  name: 'Hits and dead scratches ({key}: {chords})', size: 3, near: 3, bars: c => bars(PROG.rock(c), 'nearest', 'stops', 2), goal: 110, start: 70,
  why: 'A silence or a dead scratch between chord hits gives rock riffs their shape: the gaps are as important as the chords.',
  instr: 'Strum the chord on the beats shown and a dead scratch (fretting hand relaxed, strings touched) on the off-beats between. Pass: 8 bars with the hits clean and the scratches silent.',
  watch: 'Letting the scratches ring.', simplify: 'Replace the scratches with rests.'
});
const fourOne = G('pc-four-one', 'chunking', {
  name: 'Root on the 4th string (the stretch shape): {chords}', size: 3, near: 7, bars: () => bars(PROG.ivv(), 4, 'q', 2), goal: 90, start: 55,
  why: 'With the root on the D string the octave sits one fret further than the fifth, so the shape stretches. It is easier higher on the neck where the frets are close together.',
  instr: 'Root with the index finger, the fifth two frets higher on the 3rd string (third finger), the octave one more fret up on the 2nd string (fourth finger). Start at the 7th fret region and move on only when it is comfortable. Pass: 8 bars with all three notes clear.',
  watch: 'Straining the stretch low on the neck.', simplify: 'Play the first two notes only.'
});
const fourMix = G('pc-four-mix', 'transfer', c => ({
  name: 'Roots on three strings in one riff ({key}: {chords})', size: 3, near: 5, bars: c2 => bars(PROG.turn(c2), [6, 5, 4, 5], 'e8', 2), goal: 105, start: 65, picking: 'alternate',
  why: 'A real riff uses whichever string set is closest; this one moves the root from the 6th to the 5th to the 4th string and back.',
  instr: 'Play the four chords in 8ths, taking the roots from the 6th, 5th, 4th and 5th strings in turn. Pass: 8 bars of even strums with the right string set each time.',
  watch: 'Playing the 4th-string shape with the stretch too low.', simplify: 'Two-note shapes.'
}));

/* ------------------------------- Advanced ------------------------------- */
const fullRootFive = G('pc-fullroot-five', 'chunking', {
  name: 'Full chord then root ({chords})', size: 3, near: 3, bars: () => bars(PROG.ivv(), 5, 'fullRoot', 2), goal: 125, start: 85, picking: 'alternate',
  why: 'Alternating the whole chord and the single root note makes a rhythm that sounds bigger and leaves room, and it trains the hand to let go of the shape between hits.',
  instr: 'Strum the full chord on beats 1 and 3, and play only the root string in 8ths between. Keep the shape under your fingers the whole time. Pass: 8 bars with the roots even and the chord hits clean.',
  watch: 'Dropping the shape when playing the root.', simplify: 'Two roots between the chords.'
});
const fullRootMix = G('pc-fullroot-mix', 'accurate-reps', {
  name: 'Full chord on 1, 3 and the last 8th ({key}: {chords})', size: 3, near: 3, bars: c => bars(PROG.rock(c), 'nearest', 'fullRoot2', 2), goal: 125, start: 85, picking: 'alternate',
  why: 'Adding a hit on the last 8th pulls the bar forward and sets up the next chord.',
  instr: 'Full chord on 1, 3 and the last 8th, root only in between, over the rock progression. Pass: 8 bars with every change on the beat.',
  watch: 'Muting the last 8th chord by moving too early.', simplify: 'Play the first two bars only.'
});
const sixteenOne = G('pc-s16-one', 'chunking', {
  name: 'Palm-muted 16ths with open accents ({chords})', size: 2, near: 3, bars: () => bars(PROG.one(), 6, 's16', 1), goal: 80, start: 55,
  why: 'Alternate-picked 16ths with the palm muting the chugs and the hand lifting for the accents is the speed version of the power chord riff.',
  instr: 'Alternate-pick a muted 16th chug (two-note shape) and lift the hand for the accents on beat 1 and the "a" of 2. Pass: 4 bars relaxed with the accents clear.',
  watch: 'Tension building up in the picking hand.', simplify: 'Play 8ths and add the accents.'
});
const sixteenProg = G('pc-s16-prog', 'accurate-reps', {
  name: 'Muted 16ths on a progression ({key}: {chords})', size: 2, near: 3, bars: c => bars(PROG.rock(c), 'nearest', 's16b', 1), goal: 80, start: 55,
  why: 'The changes happen on the 16th-note groove without stopping the picking hand.',
  instr: 'Muted 16ths with the open accents on beat 1, the "&" of 2 and the "&" of 4 over the four chords, one bar each. Pass: 4 bars (a pass) without the picking hand stopping, three passes in a row.',
  watch: 'Stopping the picking hand at the changes.', simplify: 'Two bars per chord.'
});
const highThree = G('pc-high-three', 'chunking', {
  name: 'High shapes: root on the 3rd string ({chords})', size: 3, near: 7, bars: () => bars(PROG.ivv(), 3, 'q', 2), goal: 90, start: 55,
  why: 'With the root on the G string the top two notes are three frets above, so the fourth finger bars both treble strings. The sound is thinner and brighter, and it fits above the bass line.',
  instr: 'Index finger on the root (3rd string), the fifth and octave three frets up on the 2nd and 1st strings with the fourth finger across both. Start around the 7th fret. Pass: 8 bars with both treble strings clear.',
  watch: 'Letting the barre finger roll and mute one string.', simplify: 'Two notes: root and fifth.'
});
const highAnswer = G('pc-high-answer', 'transfer', c => ({
  name: 'Low shape and the same chord high ({key}: {chords})', size: 3, near: 5, bars: c2 => [0, 5, 7, 5].flatMap(o => [{ off: o, plan: 6, pat: 'half' }, { off: o, plan: 3, pat: 'half' }]), goal: 90, start: 55,
  why: 'The same chord at two registers, low then high: the root note is the same name, the sound is different, and you learn to find the chord on the thin strings.',
  instr: 'Play each chord low (6th-string root), then the same chord with the root on the 3rd string higher up the neck. Pass: 8 bars where both versions have the same name.',
  watch: 'Landing the high shape on the wrong fret.', simplify: 'Only the first two chords.'
}));
const stylePunk = G('pc-style-chops', 'accurate-reps', {
  name: 'Chops on the "&" ({key}: {chords})', size: 3, near: 3, bars: c => bars(PROG.rock(c), 'nearest', 'offbeat', 2), goal: 130, start: 90, picking: 'alternate',
  why: 'Playing the chord only on the "&" of each beat leaves the beat empty for the rest of the band: the offbeat chop of punk and reggae rhythm.',
  instr: 'Hit the chord on each "&" and stop the sound on the beat (relax the fingers). Pass: 8 bars with the chops short and exactly on the "&".',
  watch: 'Letting the chop ring into the next beat.', simplify: 'Count aloud and clap the "&"s.'
});
const stylePush = G('pc-style-push', 'transfer', {
  name: 'The push: next chord an 8th early ({key}: {chords})', size: 3, near: 3, bars: c => bars(PROG.rock2(c), 'nearest', 'push', 2), goal: 120, start: 80, picking: 'alternate',
  why: 'Playing the next chord on the last 8th before the barline anticipates the change, which makes a riff drive forward.',
  instr: 'In each bar play 1, 2, 3, 4 and the next chord on the "&" of 4, then keep going on beat 1 of the new bar. Pass: 8 bars with the push exactly on the "&" of 4.',
  watch: 'Landing the push on beat 4 instead of the "&".', simplify: 'Without the push in the first pass.'
});

/* ------------------------------- Mastery ------------------------------- */
const tempo8 = G('pc-tempo-8', 'accurate-reps', {
  name: 'Non-stop 8ths at tempo ({key}: {chords})', size: 3, near: 3, bars: c => bars(PROG.rock(c), 'nearest', 'e8', 3), goal: 150, start: 105, minutes: 6, picking: 'alternate',
  why: 'Endurance: twelve bars of 8th-note power chords at a performance tempo, with a relaxed strumming hand.',
  instr: 'Play the twelve bars with no breaks, the shapes changing on the beat. Raise the click only while the forearm is relaxed. Pass: 12 bars at the goal tempo with every change on the beat.',
  watch: 'Tension in the forearm after a few bars.', simplify: 'Drop the tempo by 10 BPM.'
});
const tempo16 = G('pc-tempo-16', 'chunking', {
  name: 'Muted 16ths and accents at tempo ({key}: {chords})', size: 2, near: 3, bars: c => bars(PROG.rock(c), 'nearest', ['s16', 's16b'], 2), goal: 100, start: 70, minutes: 6,
  why: 'The 16th-note groove with open accents at performance speed.',
  instr: 'Play the 8-bar groove with the two accent patterns alternating. Pass: 8 bars at the goal tempo without losing the accents.',
  watch: 'Accents that disappear at speed.', simplify: 'Slow down by 10 BPM.'
});
const keysSix = G('pc-keys-six', 'interleaving', {
  name: 'The same riff through six keys ({chords})', size: 3, near: 3, keys: [0, 5, 7, 2, 9, 10], bars: () => bars([0, 5], 'nearest', 'e8'), goal: 130, start: 90, picking: 'alternate',
  why: 'Playing the same pair of chords in six different keys tests that you can find any power chord from its root.',
  instr: 'Play one bar of the key chord and one of its IV chord in each of the six keys, choosing the nearest place. Pass: all twelve bars with no pause at the key changes.',
  watch: 'Hesitating on keys you play less often.', simplify: 'Three keys only.'
});
const keysPlaces = G('pc-keys-places', 'interleaving', {
  name: 'Each root in three places ({chords})', size: 3, near: 5, keys: [0, 3, 7, 10], bars: () => [{ off: 0, plan: 6, pat: 'q' }, { off: 0, plan: 5, pat: 'q' }, { off: 0, plan: 4, pat: 'q' }], goal: 110, start: 75,
  why: 'Every power chord can be found with its root on the 6th, 5th or 4th string; knowing all three means you can play any riff anywhere.',
  instr: 'For each of four roots, play the chord with the root on the 6th string, then the 5th, then the 4th. Pass: all 12 bars with the correct chord each time.',
  watch: 'Using the wrong fret on the 4th-string shape.', simplify: 'Only the 6th and 5th strings.'
});
const cap8 = G('pc-cap-8', 'transfer', {
  name: 'Study: an 8-bar power chord riff ({key}: {chords})', size: 3, near: 3, minutes: 7, bars: c => [{ off: PROG.rock(c)[0], plan: 6, pat: 'acc1' }, { off: PROG.rock(c)[1], plan: 'nearest', pat: 'synco' }, { off: PROG.rock(c)[2], plan: 'nearest', pat: 'fullRoot2' }, { off: PROG.rock(c)[3], plan: 'nearest', pat: 'stops' }, { off: PROG.rock(c)[0], plan: 6, pat: 'acc13' }, { off: PROG.rock(c)[1], plan: 'nearest', pat: 'push' }, { off: PROG.rock2(c)[1], plan: 'nearest', pat: 'e8' }, { off: PROG.rock(c)[0], plan: 6, pat: 'stops' }], goal: 125, start: 80, picking: 'alternate',
  why: 'An original eight-bar riff that uses a different rhythm each bar: muted chugs with accents, 3+3+2, full chord and root, hits and scratches, and the push.',
  instr: 'Learn it two bars at a time, then as one piece. Palm-mute the chugs and lift for the accents. Pass: one clean pass at the goal tempo, then your own version on the same chords.',
  watch: 'Rushing the push.', simplify: 'Play bars 1–4 only.'
});
const cap12 = G('pc-cap-12', 'transfer', {
  name: 'Capstone: a 12-bar riff with high and low shapes ({key}: {chords})', size: 3, near: 3, minutes: 8, bars: c => [{ off: PROG.rock(c)[0], plan: 6, pat: 'acc1' }, { off: PROG.rock(c)[1], plan: 'nearest', pat: 'fullRoot' }, { off: PROG.rock(c)[2], plan: 'nearest', pat: 'synco' }, { off: PROG.rock(c)[3], plan: 'nearest', pat: 'push' }, { off: PROG.rock(c)[0], plan: 3, pat: 'half' }, { off: PROG.rock(c)[1], plan: 3, pat: 'half' }, { off: PROG.rock(c)[2], plan: 'any', pat: 'acc13' }, { off: PROG.rock(c)[3], plan: 'any', pat: 'stops' }, { off: PROG.rock(c)[0], plan: 6, pat: 'fullRoot2' }, { off: PROG.rock(c)[2], plan: 5, pat: 'acc1' }, { off: PROG.rock(c)[1], plan: 4, pat: 'synco' }, { off: PROG.rock(c)[0], plan: 6, pat: 'whole' }], goal: 125, start: 80, picking: 'alternate',
  why: 'The whole path in one riff: all four root strings, muted and open hits, syncopation, the push, and a closing whole note.',
  instr: 'Learn it in three four-bar phrases, then join them. Then write your own 12 bars on the same chords. Pass: the study at the goal tempo with clean shapes, then your own version once.',
  watch: 'Losing the place when the root string changes.', simplify: 'Bars 1–8.'
});

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'powerChords', kind: 'technique', title: 'Power chords and rock rhythm', domain: 'rhythm',
  re: /power ?chords?|5th chords?|fifth chords?|rock rhythm/,
  aliases: ['power chord', 'rock rhythm guitar', 'root and fifth chords', 'power chords for beginners', 'riff chords'],
  summary: 'The root-and-fifth shape on the 6th, 5th, 4th and 3rd strings, moved by its root, with two places for every chord, the fewest-moves rule, palm muting and the rock rhythms built from power chords.',
  prereqs: [],
  sources: [
    'https://www.guitarworld.com/lessons/beginner-guitar-how-to-play-powerchord-riffs',
    'https://amara.org/videos/h79No15k3VkP/en/190463/?tab=urls',
    'https://guitarlessons.com/guitar-lessons/rhythm-guitar-quick-start-series/how-to-play-power-chords/'
  ],
  pedagogy: {
    date: '2026-10-29',
    summary: 'Taught as one shape with a moving root: the root on the low E string and the note two frets up on the next string, strumming only those strings. Then the same form one string higher, the three-note and barre versions, the fact that every power chord can be played with its root on two strings (and choosing the closer place), and then palm muting and switching between muted and open, with the stretchier shapes on higher strings practised higher up the neck where the frets are closer.',
    sequence: [
      { id: 'shape6', tier: 'foundations', step: 'The two-note shape with the root on the 6th string', how: 'Index finger on the root of the low E string, third finger two frets up on the next string, strum only those two strings; then slide the shape along the string.', skills: ['pc-six'], source: 2 },
      { id: 'shape5', tier: 'foundations', step: 'The same shape with the root on the 5th string', how: 'The same form one string higher; the root note names the chord and guides the changes.', skills: ['pc-five'], source: 0 },
      { id: 'three', tier: 'foundations', step: 'The three-note and barre shapes', how: 'Add the higher root with the little finger, or bar the two notes with the third finger.', skills: ['pc-three'], source: 2 },
      { id: 'places', tier: 'foundations', step: 'Every power chord has two places', how: 'Play the same chord with the root on the 6th and on the 5th string, and pick the place closest to the last chord.', skills: ['pc-places'], source: 1 },
      { id: 'eights', tier: 'intermediate', step: 'Steady 8ths on the shapes', how: 'Open-position and moving shapes in even 8ths with the root fingers anchored.', skills: ['pc-eights'], source: 0 },
      { id: 'mute', tier: 'intermediate', step: 'Palm muting and switching between muted and open', how: 'Rest the side of the picking hand next to the bridge for a chug, lift it for the open chord.', skills: ['pc-mute'], source: 1 },
      { id: 'shift', tier: 'intermediate', step: 'Shifting with the fewest moves', how: 'Switch string sets so the chords stay on one fret; slide the whole shape between roots.', skills: ['pc-shift'], source: 1 },
      { id: 'rhythm', tier: 'intermediate', step: 'Rhythms with gaps', how: 'Put the hits in groupings (3 + 3 + 2) and leave silences or dead strums between them. The run\'s own application of the rock-rhythm exercises in the sources.', skills: ['pc-rhythm'], source: 0 },
      { id: 'four', tier: 'intermediate', step: 'The stretch shapes on higher strings', how: 'Roots on the 4th string need a stretch; practise them higher on the neck where the frets are closer.', skills: ['pc-four'], source: 0 },
      { id: 'fullroot', tier: 'advanced', step: 'Alternating full chords and the root note', how: 'Switch between the full three-note shape and only the root, as in the source\'s second exercise.', skills: ['pc-fullroot'], source: 0 },
      { id: 'sixteen', tier: 'advanced', step: 'Palm-muted sixteenths with accents', how: 'Alternate-picked muted chugs with open accents, moving the shapes without stopping the hand.', skills: ['pc-s16'], source: 1 },
      { id: 'high', tier: 'advanced', step: 'Shapes with the root on the 3rd string', how: 'The fourth finger bars the two treble strings; the same chord low and high.', skills: ['pc-high'], source: 0 },
      { id: 'styles', tier: 'advanced', step: 'Power chords in other rhythm styles', how: 'Offbeat chops and the push (an anticipation), as applications of the shapes.', skills: ['pc-style'], source: 1 },
      { id: 'tempo', tier: 'mastery', step: 'Endurance at tempo', how: '8ths and muted 16ths for many bars at a performance tempo.', skills: ['pc-tempo'], source: 1 },
      { id: 'keys', tier: 'mastery', step: 'Any chord in any key and place', how: 'The same riff in six keys; each root found on three strings.', skills: ['pc-keys'], source: 1 },
      { id: 'capstone', tier: 'mastery', step: 'A full power chord riff', how: 'An original riff that uses every shape, string set and rhythm.', skills: ['pc-cap'], source: 0 }
    ],
    drills: ['Move the two-note shape along the 6th string, naming each root', 'The same chord with the root on the 6th and on the 5th string', 'Palm-muted 8ths switching to open on the accents', 'Switching string sets to keep the hand on one fret', 'Alternating the full chord and the root note', 'The stretch shape practised high on the neck first', 'A riff in six keys'],
    mistakes: ['Strumming strings that are not in the shape so the open strings ring', 'Choosing a place for a chord by habit instead of by the nearest root', 'Moving the whole hand up the neck for a chord that is on the next string at the same fret', 'Collapsing the shape into a barre while moving', 'Resting the palm too far back (no mute) or too far forward (a dead click)', 'Straining the stretch shapes low on the neck'],
    sources: [
      { title: 'What is a guitar power chord? How to play power chord riffs and progressions', author: 'Guitar World', url: 'https://www.guitarworld.com/lessons/beginner-guitar-how-to-play-powerchord-riffs' },
      { title: 'Power Chord Shifts and Palm Mutes (BC-192)', author: 'Justin Sandercoe (JustinGuitar), transcript', url: 'https://amara.org/videos/h79No15k3VkP/en/190463/?tab=urls' },
      { title: 'How to Play Power Chords (Rhythm Guitar Quick-Start Series, lesson 2)', author: 'GuitarLessons.com', url: 'https://guitarlessons.com/guitar-lessons/rhythm-guitar-quick-start-series/how-to-play-power-chords/' }
    ]
  },
  ctx: { key: 4, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'One shape, moving roots',
      'The two-note shape with the root on the 6th string and on the 5th string, the three-note version, and the same chord in two places, then a four-chord rock progression in 8ths at 100 BPM with the closest place each time, eight bars with no stray strings.', [
        S('pc-six', 'The first shape: root on the 6th string', 'rhythm', 'Root and fifth on the two lowest strings, moved by its root.', [six1, sixMove],
          ST('A power chord is the root and the fifth of a chord, with no third. It is not major or minor, which is why it suits rock. The first shape has the root on the low E string and the fifth two frets up on the next string.', 'The shape contains no open strings, so it moves anywhere and the root note names the chord.', ['Root, then the note a fifth higher (two frets up, one string over).', 'Strum only the strings in the shape and mute the rest.', 'The lowest note is the name of the chord.'])),
        S('pc-five', 'Root on the 5th string', 'rhythm', 'The same shape one string higher.', [five1, fiveMove],
          ST('The same two-note form moved up a string has its root on the A string, with the fifth on the D string. The shape is identical; only the strings change.', 'Half of all power chord riffs use roots on this string, and it is the key to the "two places" idea.', ['A fifth-string root is five frets lower than the same note on the 6th string.', 'Touch the 6th string lightly to keep it quiet.', 'The root finger is still your guide for the change.'])),
        S('pc-three', 'Three notes and the barre shape', 'rhythm', 'Adding the octave of the root.', [three6, three5],
          ST('Adding the octave of the root (the same pitch class as the root) two frets above the fifth gives a fuller shape without changing the chord. It can be fingered with the little finger or by barring two strings with the third finger.', 'The three-note version fills out a part and is the standard rock rhythm shape.', ['Root, fifth and octave: three strings, two different frets.', 'The third finger can bar the two top notes.', 'Both fingerings sound the same; pick the one that suits your hand.'])),
        S('pc-places', 'One chord, two places', 'rhythm', 'The 6th-string and 5th-string versions of the same chord.', [placesSame, placesNear],
          ST('Every power chord has its root note on two strings within the first twelve frets: the 6th and the 5th. They sound almost identical, so you choose the one closer to the chord you came from.', 'Choosing the closest place keeps your hand small and is how real riffs are played.', ['The 5th-string root is five frets below the 6th-string one.', 'Check which place is nearer before you move.', 'The two places sound nearly the same but not exactly.']))
      ]),
    stage('intermediate', 'Rock rhythm with power chords',
      'Steady 8ths, palm-muted chugs with open accents, the fewest-moves shifts, off-beat rhythms with gaps and the stretch shapes, each over a four-chord progression at 115 BPM for 8 bars.', [
        S('pc-eights', 'Steady 8ths', 'rhythm', 'Even eighth-note strums on the shapes.', [eightsOne, eightsProg],
          ST('Eighth-note power chords are the pulse of rock rhythm. The picking hand swings in a small, steady motion and touches the strings on every swing.', 'It builds the stamina and evenness that every later rhythm needs.', ['Small strums from the wrist.', 'Keep the shape anchored during the change.', 'Down-up motion in the hand even if you only play downs.'])),
        S('pc-mute', 'Muting and releasing', 'rhythm', 'Palm muting and lifting for open chords.', [muteMix, muteAcc],
          ST('Resting the side of the picking hand on the strings next to the bridge makes the chord short and percussive; lifting it lets the chord ring. Alternating the two shapes the riff.', 'It is the difference between a flat strum and a riff with punch.', ['Rest, do not press.', 'Closer to the bridge means more mute.', 'Lift the hand on the accents.'])),
        S('pc-shift', 'Shifting with the fewest moves', 'rhythm', 'Sliding the shape, and switching string sets to stay on one fret.', [shiftSlide, shiftSets],
          ST('Two ways to change chords cheaply: slide the whole shape along the string, or move to the next string set so the chord a fourth up sits on the same fret.', 'Small movements are faster and more reliable than large jumps.', ['A fourth up is the same fret on the next string.', 'Keep the pressure on while sliding.', 'Choose the nearer place before you move.'])),
        S('pc-rhythm', 'Rhythms with gaps', 'rhythm', 'Groupings and dead scratches around the chord hits.', [rhythmSynco, rhythmStops],
          ST('Grouping the eight 8ths of a bar as 3 + 3 + 2 puts the chord on different parts of the bar than the plain beat. A dead scratch or a rest between hits shapes the riff.', 'Most riffs are not continuous strumming; the silences are part of the rhythm.', ['3 + 3 + 2 adds up to 8.', 'A scratch is a muted strum, drawn as x.', 'Count the groups aloud first.'])),
        S('pc-four', 'The stretch shapes on higher strings', 'fretboard', 'Roots on the 4th string and moving between string sets.', [fourOne, fourMix],
          ST('With the root on the D string the octave sits a fret higher than the fifth, which makes the shape a stretch. Practising it higher on the neck, where frets are closer, makes it comfortable.', 'It gives you a third place for every chord and thicker chords higher on the neck.', ['Root, fifth two frets up, octave three frets up.', 'Start near the 7th fret.', 'Use the shape that keeps your hand closest to the last chord.']))
      ]),
    stage('advanced', 'Fuller sounds, faster rhythms',
      'Full chord and root alternation, muted 16ths with accents, the high shapes and the offbeat chop and the push, each at 125 BPM (16ths at 80) for 8 bars without stopping the picking hand.', [
        S('pc-fullroot', 'Full chord, then root', 'rhythm', 'Alternating the whole shape and its root note.', [fullRootFive, fullRootMix],
          ST('Playing the full shape on the strong beats and only the root string between them makes a rhythm that sounds big but leaves room.', 'It trains the hand to hold the shape while the picking hand plays a single note.', ['Keep the shape under your fingers.', 'The root string is the lowest string of the shape.', 'The chord hits are on 1 and 3.'])),
        S('pc-s16', 'Palm-muted 16ths with accents', 'picking', 'Alternate-picked 16th chugs with open accents.', [sixteenOne, sixteenProg],
          ST('The 16th-note chug is picked with alternating down and up strokes while the palm mutes; the accents are the open chord hits where the hand lifts.', 'It is the speed version of the power chord riff.', ['Four swings per beat.', 'Accents on chosen 16ths.', 'Stay relaxed to keep going.'])),
        S('pc-high', 'High shapes on the 3rd string', 'fretboard', 'Roots on the G string, and the same chord at two heights.', [highThree, highAnswer],
          ST('With the root on the G string the fifth and octave are both three frets higher, so one finger can bar them. The chord is the same, but thinner and brighter.', 'It lets you play the same chord in two registers and keep clear of the bass.', ['Root, then fifth and octave three frets up.', 'The fourth finger can bar both.', 'Play high on the neck.'])),
        S('pc-style', 'Chops and the push', 'rhythm', 'The offbeat chop and the anticipated chord.', [stylePunk, stylePush],
          ST('The offbeat chop plays the chord only on the "&" of each beat. The push plays the next chord an 8th early, on the "&" of 4.', 'These two rhythms turn plain power chords into punk, reggae and driving rock parts.', ['Chop: mute on the beat.', 'The push is the chord on the "&" of 4.', 'Count 1 & 2 & 3 & 4 &.']))
      ]),
    stage('mastery', 'Power chord riffs as music',
      'Twelve bars of 8ths at 150 BPM, the same riff in six keys, any root on three strings, and an original eight- and twelve-bar riff at 125 BPM that uses every shape and rhythm.', [
        S('pc-tempo', 'Endurance at tempo', 'rhythm', 'Long stretches of 8ths and 16ths at performance speed.', [tempo8, tempo16],
          ST('Speed in rhythm playing is relaxation. If the arm tightens the strums turn choppy before the tempo gets hard.', 'The tempo you can hold for twelve bars relaxed is the tempo you own.', ['Raise the click only while loose.', 'Record yourself.', 'Breathe and keep the shoulder down.'])),
        S('pc-keys', 'Any chord in any key', 'fretboard', 'The same riff through six keys, and each root in three places.', [keysSix, keysPlaces],
          ST('A riff belongs to the shape, not the key. Moving it through six keys and finding every root on the 6th, 5th and 4th strings means you can play any riff anywhere.', 'Fluency across the neck is what makes power chords automatic.', ['Roots are found by their note names.', 'Three places for each chord.', 'Choose the nearest place.'])),
        S('pc-cap', 'A full power chord riff', 'rhythm', 'An original riff using every shape and rhythm.', [cap8, cap12],
          ST('An arrangement combines the shapes and the rhythms into one piece. Each bar has a different job: a chug, a syncopation, a full chord, a push, a high shape.', 'It is where the path becomes music.', ['Learn it in phrases.', 'Keep the hand moving.', 'Write your own on the same chords.']))
      ])
  ]
});
