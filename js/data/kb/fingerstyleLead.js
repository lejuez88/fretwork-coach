// Fingerstyle lead and rhythm: playing with the thumb and the first two (or three) fingers instead of a
// pick, the way Mark Knopfler and many country, folk and blues players do. From the hand position and
// index-middle alternation, through thumb-bass-and-fingers accompaniment, rolls, pinches, palm-muted
// bass under a ringing melody, plucked pentatonic lines with pull-offs and triads on the top strings,
// to sixteenth-note rolls, triplet lines, double-stops, string skipping, fingers under overdrive,
// quick-pluck rakes, and a capstone study.
//
// Concept-first (CONTENT.md): the model is a RIGHT-HAND ASSIGNMENT BY STRING. The thumb (p) owns the
// bass strings (6, 5, 4), the index (i) owns string 3, the middle (m) string 2 and the ring (a) string 1
// (the classical p-i-m-a). Every accompaniment pattern is a bar grid of tokens, each token a string
// role (B = lowest string of the grip, b = the next bass string, 4/3/2/1 = that string, "+" = two
// strings plucked together, S = the top three strings plucked together, * = palm-muted, . = rest),
// played on chord grips whose strings are all chord tones. Every single-note line is drawn from the
// pentatonic scale of the key inside one six-fret window, ordered by pitch, with i and m alternating
// (the thumb takes any bass-string note). So every sounding pitch is right in all 12 keys by
// construction.
//
// Teaching method first (CONTENT.md, `pedagogy` below), researched 2026-10-26: teachers start with a
// relaxed hand and p-i-m-a names, alternate index and middle on single notes, put the thumb on the
// low strings and the fingers on the high ones, then take a chord through p-i-m-a variations and
// pinches, add the palm-muted thumb bass, plucked pentatonic lead lines with pull-offs, 16th-note
// rolls, double-stops and the same hand under distortion (Premier Guitar's Knopfler lesson).
import { OPEN, N, nameOf, make, mod12, chordInfo, OPEN_SHAPES, topTriad, targetGuide, S, stage, entry } from '../lib.js';
import { grip } from './strumming.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const pitch = (s, f) => OPEN[s] + f;
/** The right-hand finger for a string: thumb on the basses, then i, m, a up the top three strings. */
export const FING = s => (s >= 4 ? 'p' : s === 3 ? 'i' : s === 2 ? 'm' : 'a');

const OPENS = { ...OPEN_SHAPES, E: [0, 2, 2, 1, 0, 0], A: [null, 0, 2, 2, 2, 0] };
const gripOf = g => {
  const ch = chordInfo(g.name); if (!ch) return null;
  const strings = []; g.frets.forEach((f, i) => { if (f != null) strings.push({ s: 6 - i, f }); });
  const bass = strings.filter(x => x.s >= 4);
  return { ...g, strings, pcs: ch.pcs, bass: bass[0], bass2: bass[1] || bass[0], root: ch.pc };
};
const openGrips = names => names.map(n => gripOf({ name: n, frets: OPENS[n].slice() }));
const progOf = (c, id) => {
  const mn = !!c.minor;
  if (id === 'one') return [[0, mn ? 'm' : '']];
  if (id === 'two') return mn ? [[0, 'm'], [10, '']] : [[0, ''], [5, '']];
  return mn ? [[0, 'm'], [8, ''], [3, ''], [10, '']] : [[0, ''], [7, ''], [9, 'm'], [5, '']];
};
const keyGrips = (c, id) => progOf(c, id).map(([d, q]) => gripOf(grip(mod12(c.key + d), q)));

/** Patterns: one token per slot, `step` beats per slot. Tokens: see the header. `alt`: i and m alternate on the upper strings. */
const P = (step, toks, o = {}) => ({ step, toks: toks.split(' '), ...o });
export const PAT = {
  // 8ths
  q4: P(1, 'B b B b'),
  pim8: P(0.5, 'B 3 2 3 B 3 2 3'),
  pima8: P(0.5, 'B 3 2 1 B 3 2 1'),
  pimaRev: P(0.5, 'B 2 3 1 B 2 3 1'),
  amip: P(0.5, '1 2 3 B 1 2 3 B'),
  fstrum: P(0.5, 'B S . S B S . S'),
  alt1: P(0.5, 'B 3 b 2 B 3 b 2'),
  alt2: P(0.5, 'B 3 b 2 B 1 b 2'),
  imA: P(0.5, '3 3 3 3 3 3 3 3', { alt: true }),
  imB: P(0.5, '3 2 3 2 3 2 3 2', { alt: true }),
  pinch1: P(0.5, 'B+2 . 3 . b+2 . 3 .'),
  pinch2: P(0.5, 'B+2 . 3 2 b+2 . 3 2'),
  pmA: P(0.5, 'B* 2 B* 3 B* 2 B* 1'),
  pmB: P(0.5, 'B* . 2 B* . 3 b* 2'),
  wide: P(0.5, 'B 1 b 2 B 1 b 3'),
  sync: P(0.5, 'B . 3 2 . 3 b .'),
  riffA: P(0.5, '4* . 3 4* . 2 3 .'),
  riffB: P(0.5, '4* 4* . 3 4* . 2 .'),
  rakeA: P(0.5, 'R . . 2 3 . 2 .'),
  rakeB: P(0.5, 'R . 3 . R . 2 1'),
  // triplets (12 slots)
  trip3: P(1 / 3, 'B 3 2 B 3 2 B 3 2 B 3 2'),
  tripAlt: P(1 / 3, 'B 3 2 b 3 2 B 3 2 b 3 2'),
  // 16ths (16 slots)
  r16: P(0.25, 'B 3 2 3 B 3 2 3 B 3 2 3 B 3 2 3'),
  r16a: P(0.25, 'B 3 2 1 B 3 2 1 B 3 2 1 B 3 2 1'),
  r16b: P(0.25, 'B 3 2 3 b 3 2 3 B 3 2 3 b 3 2 3'),
  r16d: P(0.25, 'B 3 2 . 3 2 B 3 . 2 3 2 B . 3 2')
};
const unitOf = step => (step === 1 ? 'quarter notes' : step === 0.5 ? '8th notes' : step === 0.25 ? '16th notes' : '8th-note triplets');

/** One bar of a pattern on grip g, starting at t0. `fc` counts the i/m alternation across bars. */
function barNotes(g, pat, t0, fc) {
  const pt = PAT[pat], step = pt.step, out = [], ev = [];
  pt.toks.forEach((tk, i) => { if (tk !== '.') ev.push(i); });
  const fret = s => { const x = g.strings.find(y => y.s === s); return x ? x.f : null; };
  const strOf = tk => (tk === 'B' ? g.bass.s : tk === 'b' ? g.bass2.s : +tk);
  const one = (s, t, d, extra, pm) => {
    const f = fret(s); if (f == null) return null;
    let fing = FING(s);
    if (pt.alt && s <= 3) { fing = fc.i % 2 ? 'm' : 'i'; fc.i++; }
    return tag(N(s, f, t, d, pm ? 'pm' : null, { fing, ...(extra || {}) }), g.pcs);
  };
  ev.forEach((i, k) => {
    let tk = pt.toks[i]; const t = t0 + i * step, nxt = k + 1 < ev.length ? ev[k + 1] : pt.toks.length;
    const ring = Math.min(2, (nxt - i) * step);
    const pm = tk.endsWith('*'); if (pm) tk = tk.slice(0, -1);
    if (tk === 'S') [3, 2, 1].forEach(s => { const n = one(s, t, ring, { chord: true }); if (n) out.push(n); });
    else if (tk === 'R') [g.bass.s, 3, 2].forEach((s, j) => { const n = one(s, t + j * 0.0625, ring); if (n) out.push(n); });
    else if (tk.includes('+')) tk.split('+').forEach(a => { const n = one(strOf(a), t, ring, { chord: true }); if (n) out.push(n); });
    else { const n = one(strOf(tk), t, ring, null, pm); if (n) out.push(n); }
  });
  return out;
}
/** Plan: grips cycled, `per` bars on each, `reps` passes, one pattern id per bar (cycled). */
function plan(grips, pats, { per = 1, reps = 1, t0 = 0 } = {}) {
  if (!grips || grips.some(g => !g)) return null;
  const notes = [], names = [], fc = { i: 0 }; let bar = 0;
  for (let r = 0; r < reps; r++) for (const g of grips) for (let b = 0; b < per; b++) {
    notes.push(...barNotes(g, pats[bar % pats.length], t0 + bar * 4, fc)); names.push(g.name); bar++;
  }
  return { notes, chords: names, bars: bar, voicings: grips.map(g => ({ name: g.name, frets: g.frets })) };
}
const lv = (c, d = 1) => c.lvl || d;

/* ---- single-note lines: the pentatonic scale of the key in one five-fret window ---- */
const MINPENT = [0, 3, 5, 7, 10], MAJPENT = [0, 2, 4, 7, 9];
export const scalePcs = c => (c.minor ? MINPENT : MAJPENT).map(d => mod12(c.key + d));
/** Scale notes on `strings` between fret lo-1 and lo+5 (lo = the root's fret on the low E string), by pitch. */
export function pool(c, strings) {
  const lo = mod12(c.key - 4) || 12, pcs = scalePcs(c), out = [];
  for (const s of strings) for (let f = Math.max(1, lo - 1); f <= lo + 5; f++) if (pcs.includes(mod12(pitch(s, f)))) out.push({ s, f, p: pitch(s, f) });
  out.sort((a, b) => a.p - b.p || a.f - b.f);
  return out.filter((x, i, a) => !a.slice(0, i).some(y => y.p === x.p));
}
const SEQ = {
  ud: n => { const a = []; for (let i = 0; i < n; i++) a.push(i); for (let i = n - 2; i >= 0; i--) a.push(i); return a; },
  th3: n => { const a = []; for (let i = 0; i + 2 < n; i++) a.push(i, i + 1, i + 2); return a; },
  th3d: n => { const a = []; for (let i = n - 1; i - 2 >= 0; i--) a.push(i, i - 1, i - 2); return a; },
  thu: n => { const a = []; for (let i = 0; i + 2 < n; i++) a.push(i, i + 1, i + 2); for (let i = n - 1; i - 2 >= 0; i--) a.push(i, i - 1, i - 2); return a; },
  skip: n => { const a = []; for (let i = 0; i + 2 < n; i++) a.push(i, i + 2); return a; },
  pairs: n => { const a = []; for (let i = 0; i + 1 < n; i++) a.push(i, i + 1); return a; }
};
/** A line: kind of sequence, strings, step, bars, legato (pull-offs and hammer-ons instead of plucks). */
function line(c, { kind = 'ud', strings = [4, 3, 2, 1], step = 0.5, bars = 2, leg = false, min = 5 } = {}) {
  const pl = pool(c, strings); if (pl.length < min) return null;
  const slots = Math.round(4 / step), pcs = scalePcs(c);
  let seq = SEQ[kind](pl.length); if (!seq.length) return null;
  const want = Math.max(1, Math.min(bars, Math.floor(seq.length / slots) || 1)) * slots;
  while (seq.length < want) seq = seq.concat(seq);
  seq = seq.slice(0, want);
  const notes = []; let fi = 0, prev = null;
  seq.forEach((ix, k) => {
    const x = pl[ix], t = k * step, last = k === seq.length - 1;
    const d = last ? Math.min(2, 4 - ((k * step) % 4)) : step;
    if (leg && prev && prev.s === x.s && prev.f !== x.f) notes.push(tag(N(x.s, x.f, t, d, x.f > prev.f ? 'h' : 'p'), pcs));
    else { let f = FING(x.s); if (x.s <= 3) { f = fi % 2 ? 'm' : 'i'; fi++; } notes.push(tag(N(x.s, x.f, t, d, null, { fing: f }), pcs)); }
    prev = x;
  });
  return { notes };
}

/** Closed triad on strings 3-2-1 for a chord, plucked i-m-a together over a thumb bass. */
function triBars(c, id, { dyad = false, near = 7 } = {}) {
  const notes = [], names = [], vs = []; let t = 0;
  for (const g of keyGrips(c, id)) {
    const tr = topTriad(g.name, near); if (!tr) return null;
    const pcs = g.pcs;
    notes.push(tag(N(g.bass.s, g.bass.f, t, 1, null, { fing: 'p' }), pcs));
    (dyad ? [2, 1] : [3, 2, 1]).forEach(s => notes.push(tag(N(s, tr[s], t + 1, 1, null, { chord: true, fing: FING(s) }), pcs)));
    notes.push(tag(N(g.bass2.s, g.bass2.f, t + 2, 1, null, { fing: 'p' }), pcs));
    (dyad ? [2, 1] : [3, 2, 1]).forEach(s => notes.push(tag(N(s, tr[s], t + 3, 1, null, { chord: true, fing: FING(s) }), pcs)));
    names.push(g.name); vs.push({ name: g.name, frets: g.frets }); t += 4;
  }
  return { notes, chords: names, voicings: vs };
}

/** A sectioned study: each section is [progression id, pattern ids, bars per chord]. */
function study(c, sections) {
  const notes = [], names = [], vs = [], fc = { i: 0 }; let t = 0;
  for (const [pid, pats, per] of sections) {
    const r = plan(keyGrips(c, pid), pats, { per, t0: t }); if (!r) return null;
    notes.push(...r.notes); names.push(...r.chords); vs.push(...r.voicings); t += r.bars * 4;
  }
  return { notes, chords: names, voicings: vs.filter((v, i, a) => a.findIndex(x => x.name === v.name && x.frets.join() === v.frets.join()) === i) };
}

/* ------------------------------ The lesson wrapper ------------------------------ */
/** build(c) → { notes, chords?, voicings? }; name/instr may use {key} and {chords}. */
function L(id, name, method, o, build) {
  return c => {
    const r = build(c); if (!r || !r.notes || r.notes.length < 4 || r.notes.length > 400) return null;
    const keyName = `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`, ch = r.chords ? [...new Set(r.chords)].join(' – ') : '';
    const fill = x => String(x).replace(/\{key\}/g, keyName).replace(/\{chords\}/g, ch);
    return make(c, {
      id, name: fill(name), domain: 'picking', method, unit: o.unit, goal: o.goal, start: o.start, minutes: o.minutes || 5, picking: 'fingers',
      why: o.why, instr: fill(o.instr), watch: o.watch, simplify: o.simplify,
      ...(r.chords ? { backing: r.chords, chords: [...new Set(r.chords)], voicings: r.voicings } : {}),
      tab: { notes: r.notes }
    });
  };
}
const ST = (concept, why, theory) => ({ concept, why, theory });

/* ------------------------------ Skill builders ------------------------------ */
// Foundations: open chords only, the same in every key.
const f_bass = c => plan(openGrips(lv(c) >= 2 ? ['Em', 'Am'] : ['Em']), ['q4'], { per: 2, reps: 2 });
const f_pim = c => plan(openGrips(lv(c) >= 2 ? ['Em', 'C'] : ['Em']), ['pim8'], { per: 2, reps: 2 });
const f_imOne = c => plan(openGrips(['G']), [lv(c) >= 3 ? 'imB' : 'imA'], { per: 2, reps: 1 });
const f_imLine = c => line(c, { kind: 'ud', strings: [3, 2], step: 0.5, bars: lv(c) >= 2 ? 2 : 1, min: 4 });
const f_strum = c => plan(openGrips(lv(c) >= 2 ? ['Em', 'Am'] : ['Em']), ['fstrum'], { per: 2, reps: 2 });
const f_alt = c => plan(openGrips(['G', 'Em', 'C', 'D']), [lv(c) >= 3 ? 'alt2' : 'alt1'], { per: 1, reps: 2 });
const f_pima = c => plan(openGrips(lv(c) >= 2 ? ['Em', 'Am'] : ['Em']), ['pima8'], { per: 2, reps: 2 });
const f_rev = c => plan(openGrips(['Am', 'C', 'G', 'Em']), [lv(c) >= 3 ? 'amip' : 'pimaRev'], { per: 1, reps: 2 });
// Intermediate: the chords of the key
const kf = (c, pats, per = 1, reps = 1) => plan(keyGrips(c, 'four'), pats, { per, reps });
const k2 = (c, pats, per = 2, reps = 2) => plan(keyGrips(c, 'two'), pats, { per, reps });
// Mastery studies
const capA = c => study(c, [['four', ['fstrum', 'alt1'], 1], ['two', ['pmA'], 1], ['two', ['r16'], 1]]);
const capB = c => study(c, [['four', ['pinch2', 'pmB'], 1], ['two', ['wide', 'sync'], 1], ['two', ['rakeA', 'r16a'], 1]]);
const guide = (c, id, name) => { const g = targetGuide(c, { prog: c.minor ? 'minorRock' : 'folkAxis', name, id }); return g ? { ...g, picking: 'fingers' } : g; };

/* ------------------------------- The path ------------------------------- */
export default entry({
  id: 'fingerstyleLead', kind: 'technique', title: 'Fingerstyle lead and rhythm (thumb and fingers)', domain: 'picking',
  re: /finger.?style (lead|rhythm|electric|playing)|fingerstyle lead|pick.?less|without a pick|thumb and (two )?fingers|fingers? instead of (a )?pick|knopfler/,
  aliases: ['fingerstyle electric guitar', 'playing without a pick', 'thumb and two fingers', 'Knopfler fingerstyle', 'fingerstyle lead guitar', 'p i m a', 'fingerstyle rolls'],
  summary: 'Playing lead and rhythm with the thumb and fingers instead of a pick: i-m alternation, thumb bass under finger melody, rolls, pinches, palm-muted bass, plucked pentatonic lines, triads, 16th rolls, double-stops and fingers under overdrive.',
  prereqs: [],
  sources: [
    'https://jgmusiclessons.com/how-to-finger-pick-on-guitar-including-exercises',
    'https://www.guitarworld.com/lessons/the-ultimate-fingerstyle-guitar-lesson',
    'https://www.premierguitar.com/lessons/mark-knopflers-fingerstyle-finesse',
    'https://www.guitarplayer.com/players/i-was-doing-things-with-my-fingers-that-i-couldnt-do-with-a-pick-mark-knopfler-on-his-world-famous-picking-technique',
    'https://www.musicradar.com/how-to/play-guitar-like-mark-knopfler',
    'https://www.musicstreet.co.uk/blogs/blog-post/how-to-play-guitar-like-mark-knopfler-technique-gear-and-signature-sound'
  ],
  pedagogy: {
    date: '2026-10-26',
    summary: 'Taught as one rule: the thumb owns the bass strings and the fingers (i, m, then a) own the upper strings. Start with a relaxed hand and the names p-i-m-a, alternate index and middle on single notes, split bass from melody, then roll and pinch on chords, mute the bass with the palm, pluck pentatonic lead lines with pull-offs, and finish with 16th-note rolls, double-stops and the same hand under overdrive.',
    sequence: [
      { id: 'hand', tier: 'foundations', step: 'A relaxed hand and thumb on the bass strings', how: 'Rest the forearm on the body, hand at a slight diagonal, thumb on the low strings; learn p, i, m, a and play a slow thumb-only bass first.', skills: ['fl-hand'], source: 0 },
      { id: 'im', tier: 'foundations', step: 'Index and middle alternating on single notes', how: 'Alternate i and m on one open string, then on a short scale fragment, with each finger coming to rest on the next string after it plays.', skills: ['fl-im'], source: 0 },
      { id: 'bm', tier: 'foundations', step: 'Thumb for the bass, fingers for the melody', how: 'The thumb plays bass on beats 1 and 3 while i and m strum between; then the thumb alternates two bass strings under finger notes.', skills: ['fl-bm'], source: 2 },
      { id: 'arp', tier: 'foundations', step: 'p-i-m-a arpeggio variations', how: 'Play a chord one string at a time in p-i-m-a, then p-m-i-a and a-m-i-p, first with no chord changes.', skills: ['fl-arp'], source: 1 },
      { id: 'rolls', tier: 'intermediate', step: 'Rolls in circles', how: 'Repeat the p-i-m-i circle in 8ths over a progression, then p-i-m-a and triplet rolls.', skills: ['fl-roll'], source: 2 },
      { id: 'pinch', tier: 'intermediate', step: 'Pinches: thumb and a finger together', how: 'Drive the thumb down and a finger up on two strings at once; Knopfler pinches with thumb and second finger. Pull the hand away so neighbours stay quiet.', skills: ['fl-pinch'], source: 3 },
      { id: 'pm', tier: 'intermediate', step: 'Palm-muted thumb under a ringing melody', how: 'Rest the palm on the low strings so the thumb notes are muted and the finger notes ring over them.', skills: ['fl-pm'], source: 1 },
      { id: 'lines', tier: 'intermediate', step: 'Fingerstyle lead lines on the pentatonic', how: 'Pentatonic lines in one position plucked with i and m alternating, thumb on bass-string notes.', skills: ['fl-lines'], source: 2 },
      { id: 'pull', tier: 'intermediate', step: 'Pull-offs and hammer-ons after a plucked note', how: 'Pluck the first note of a pair and let the fretting hand play the second, as in the legato lines of Knopfler\'s lead playing.', skills: ['fl-pull'], source: 4 },
      { id: 'tri', tier: 'intermediate', step: 'Triads on the top strings', how: 'Pluck a closed triad on strings 3, 2 and 1 together with i, m and a over a thumb bass.', skills: ['fl-tri'], source: 5 },
      { id: 'sixteen', tier: 'advanced', step: 'Sixteenth-note rolls', how: 'The repeating thumb-index-middle cycle at 16th-note speed, the roll the Premier Guitar lesson says is needed at tempo.', skills: ['fl-16'], source: 2 },
      { id: 'trip', tier: 'advanced', step: 'Triplet lines with pull-offs', how: 'Fit three notes into the space of two with fingers plucking the first of each triplet and pull-offs for the rest.', skills: ['fl-trip'], source: 4 },
      { id: 'dbl', tier: 'advanced', step: 'Double-stops and plucked dyads', how: 'Adjacent-string dyads and triad pieces plucked together over a thumb bass, with wide vibrato.', skills: ['fl-dbl'], source: 2 },
      { id: 'skip', tier: 'advanced', step: 'String skipping and wide rolls', how: 'Rolls that jump from the bass strings to the first string and back.', skills: ['fl-skip'], source: 1 },
      { id: 'rock', tier: 'advanced', step: 'Fingers under overdrive', how: 'Thumb on the fourth string, index on the third and middle on the second, with the palm resting for a riff that keeps the fingerstyle attack.', skills: ['fl-rock'], source: 2 },
      { id: 'rake', tier: 'advanced', step: 'Quick-pluck rakes into a fill', how: 'Pluck chord notes with thumb and two fingers in quick succession instead of raking a pick, then answer with a short pentatonic fill.', skills: ['fl-rake'], source: 4 },
      { id: 'speed', tier: 'mastery', step: 'Rolls at performance tempo', how: 'The same circles at performance tempo over changes, relaxed, raising the click only while the hand stays loose.', skills: ['fl-speed'], source: 2 },
      { id: 'improv', tier: 'mastery', step: 'Improvising with the fingers', how: 'Aim phrases at chord tones over a progression, using space, touch and attack as the expressive tool.', skills: ['fl-improv'], source: 5 },
      { id: 'endure', tier: 'mastery', step: 'Endurance lines', how: 'Longer sixteenth-note and triplet lines without the hand tiring or tightening.', skills: ['fl-endure'], source: 2 },
      { id: 'cap', tier: 'mastery', step: 'A study in several textures', how: 'Verse, roll and lead textures joined in one fingerstyle arrangement without pausing the hand.', skills: ['fl-cap'], source: 2 }
    ],
    drills: ['Alternating index and middle on one open string, slowly', 'Thumb alone on the bass strings, quarter notes', 'p-i-m-a, p-m-i-a and a-m-i-p arpeggios on one chord', 'Thumb bass on 1 and 3 with a finger strum between', 'Pinches: thumb plus middle finger together', 'Palm-muted thumb under a ringing melody note', 'The 16th-note p-i-m-i roll', 'Pentatonic lines plucked with i and m, thumb on the basses'],
    mistakes: ['A tense hand or wrist, which shows first as uneven finger strokes', 'Offbeat thumb notes played louder than the melody', 'Hitting neighbouring strings after a pinch because the hand stays too close to the strings', 'Moving to position shifts before the plucking is accurate in one position', 'Letting the fretted notes release early while the picking hand moves on'],
    sources: [
      { title: 'How to fingerpick on guitar (including exercises)', author: 'JG Music Lessons', url: 'https://jgmusiclessons.com/how-to-finger-pick-on-guitar-including-exercises' },
      { title: 'The ultimate fingerstyle guitar lesson', author: 'Guitar World', url: 'https://www.guitarworld.com/lessons/the-ultimate-fingerstyle-guitar-lesson' },
      { title: "Mark Knopfler's fingerstyle finesse", author: 'Premier Guitar', url: 'https://www.premierguitar.com/lessons/mark-knopflers-fingerstyle-finesse' },
      { title: '"I was doing things with my fingers that I couldn\'t do with a pick": Mark Knopfler on his picking technique', author: 'Guitar Player', url: 'https://www.guitarplayer.com/players/i-was-doing-things-with-my-fingers-that-i-couldnt-do-with-a-pick-mark-knopfler-on-his-world-famous-picking-technique' },
      { title: '5 guitar tricks to learn from Mark Knopfler', author: 'MusicRadar', url: 'https://www.musicradar.com/how-to/play-guitar-like-mark-knopfler' },
      { title: 'How to play guitar like Mark Knopfler: technique, gear and signature sound', author: 'Music Street', url: 'https://www.musicstreet.co.uk/blogs/blog-post/how-to-play-guitar-like-mark-knopfler-technique-gear-and-signature-sound' }
    ]
  },
  ctx: { key: 2, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The thumb and the first two fingers',
      'The thumb alone on the bass, index and middle alternating, a thumb-bass-and-finger strum and a p-i-m-a arpeggio on open chords at 80 BPM, then an alternating-bass pattern over G–Em–C–D, eight bars with a relaxed hand and no hesitations.', [
        S('fl-hand', 'A relaxed hand: thumb on the bass', 'picking', 'The forearm rests, the thumb plays the low strings, and the fingers wait on the high ones.', [
          L('fl-hand-bass', 'The thumb alone on the bass strings: {chords}', 'accurate-reps', { unit: 'quarter notes', goal: 90, start: 50, why: 'The thumb owns the bass strings, so a slow, even thumb is the foundation of every fingerstyle part.', instr: 'Rest the picking forearm on the body and let the hand fall at a slight diagonal. Play the lowest string of the chord on beats 1 and 3 and the next bass string on 2 and 4, one thumb stroke per click. Pass: eight bars even and relaxed, with no tension in the forearm.', watch: 'Pinching the thumb tight or lifting the wrist.', simplify: 'Only the root, one stroke every two beats.' }, f_bass),
          L('fl-hand-pim', 'Thumb, index and middle in a circle: {chords}', 'chunking', { unit: '8th notes', goal: 90, start: 50, why: 'Naming the fingers p, i and m and playing them in a fixed circle is the first step from bass to a full hand.', instr: 'Thumb on the bass string, then index on string 3, middle on string 2, index on string 3 again: p-i-m-i. Let each finger come to rest on the string above after it plays. Pass: four bars on each chord with every note even.', watch: 'Tension in the fingers that shows as uneven volume.', simplify: 'Play thumb, index and middle only (p-i-m), one bar per chord.' }, f_pim)
        ], ST('In fingerstyle each finger of the picking hand has a name (p thumb, i index, m middle, a ring) and a home: the thumb takes the low strings, the fingers the high ones. The forearm rests on the guitar so the hand can stay loose.', 'A relaxed hand with a settled home position is what makes the later patterns even and quiet.', ['p, i, m, a come from the Spanish names for the thumb and fingers.', 'The thumb usually takes strings 6, 5 and 4, i takes string 3, m string 2 and a string 1.', 'Teachers say to keep the hand quiet: small, close finger movements rather than big plucks.'])),
        S('fl-im', 'Index and middle alternating', 'picking', 'Alternating i and m on single notes, the picking-hand equivalent of alternate picking.', [
          L('fl-im-open', 'Index–middle alternation on one string: {chords}', 'accurate-reps', { unit: '8th notes', goal: 100, start: 55, why: 'Alternating two fingers on one note is the first single-note drill that teachers set because it trains the hand to walk.', instr: 'Play the open third string in 8ths, index then middle then index, counting 1 & 2 & 3 & 4 &, with the thumb resting on the sixth string. Pass: eight bars even, the two fingers matching in volume.', watch: 'The middle finger hitting harder than the index.', simplify: 'Quarter notes, one finger at a time.' }, f_imOne),
          L('fl-im-line', 'Index and middle up and down a scale fragment: {key}', 'chunking', { unit: '8th notes', goal: 100, start: 55, why: 'Turning the alternation into a short pentatonic line carries it from open strings to real notes.', instr: 'Pluck the {key} pentatonic notes on the third and second strings in the tab, alternating index and middle, going up and then back down. Pass: two bars clean with the alternation never breaking.', watch: 'Doubling the same finger when the line changes strings.', simplify: 'Four notes up and four down.' }, f_imLine)
        ], ST('Alternating index and middle gives single-note lines the same walking motion that alternate picking gives with a pick. Each finger stays close to the strings and comes to rest on the next string after it plays.', 'Alternation is what lets fingerstyle lead lines run at tempo without tiring one finger.', ['i and m take turns: i m i m.', 'A finger that rests on the next string after playing is ready for the next stroke.', 'Slow, even, loose first; speed comes later.'])),
        S('fl-bm', 'Thumb for the bass, fingers for the melody', 'picking', 'Splitting the hand into a bass part and a finger part.', [
          L('fl-bm-strum', 'The fingerstyle strum: bass on 1 and 3, fingers between ({chords})', 'chunking', { unit: '8th notes', goal: 100, start: 55, why: 'Bass on the beats with the fingers strumming the top strings between them is the simplest split of the hand and the first Knopfler exercise.', instr: 'Thumb plays the lowest string on beats 1 and 3. Index, middle and ring brush the top three strings together on the "&" of 1, 2 and 4 as tab shows. Pass: eight bars with the bass steady and the fingers light.', watch: 'Offbeat notes played louder than the thumb.', simplify: 'Thumb bass only, then add the strum on beat 2.' }, f_strum),
          L('fl-bm-alt', 'Alternating bass with the fingers on top: {chords}', 'transfer', { unit: '8th notes', goal: 100, start: 55, why: 'A thumb that alternates two bass strings under finger notes is the engine of country and folk fingerstyle.', instr: 'Thumb alternates the root and the next bass string every beat; the index and middle play the top strings on the "&"s as in the tab. Pass: four bars of each chord without the thumb hesitating.', watch: 'The thumb stopping when the fingers play.', simplify: 'Thumb alone on one chord, then add the top notes.' }, f_alt)
        ], ST('The thumb plays a steady bass and the fingers add melody or chords on top. Each hand part is simple; the skill is keeping them apart.', 'This split is how one guitar plays bass and chords or melody at once.', ['Thumb on the beats, fingers on the "&"s.', 'The thumb is the pulse: if it hesitates, the whole pattern falls apart.', 'Keep offbeat notes lighter than the bass.'])),
        S('fl-arp', 'p-i-m-a arpeggios', 'picking', 'One chord played one string at a time in the classical finger orders.', [
          L('fl-arp-pima', 'p-i-m-a on open chords: {chords}', 'accurate-reps', { unit: '8th notes', goal: 100, start: 55, why: 'Adding the ring finger completes the four-finger hand, and the straight p-i-m-a order is the standard first arpeggio.', instr: 'Thumb on the bass, index on string 3, middle on string 2, ring on string 1, then repeat, two times a bar. Pass: eight bars even, the ring finger as strong as the others.', watch: 'The ring finger lagging behind.', simplify: 'Play p-i-m-i until the ring finger feels ready.' }, f_pima),
          L('fl-arp-rev', 'p-m-i-a and a-m-i-p variations: {chords}', 'interleaving', { unit: '8th notes', goal: 100, start: 55, why: 'Teachers vary the finger order on the same notes so the hand learns to start anywhere in the circle, not just on the thumb.', instr: 'Play the order in the tab on each chord: p-m-i-a (thumb, middle, index, ring), and at level 3 a-m-i-p, which ends on the thumb. Practise without chord changes first, then change on the barline. Pass: four bars of each chord without a stumble.', watch: 'Changing chords before the fingers have settled.', simplify: 'Stay on one chord for four bars.' }, f_rev)
        ], ST('A p-i-m-a arpeggio plucks the strings of a chord one at a time in a set order of fingers. Different orders train different starts and finishes for the hand.', 'Arpeggio orders are the building blocks of rolls, patterns and fills.', ['p-i-m-a is the standard order.', 'Changing the order (p-m-i-a, a-m-i-p) makes the thumb land on a different beat.', 'Practise on one chord before changing chords.']))
      ]),
    stage('intermediate', 'Rolls, pinches, palm-muted bass and plucked lines',
      'P-i-m rolls over the four chords of a key, a pinch pattern, a palm-muted bass under a ringing melody, pentatonic lines plucked with i and m with pull-offs, and a triad part on the top strings, each at 100 BPM for 8 bars.', [
        S('fl-roll', 'Rolls in circles', 'picking', 'Repeating finger circles in 8ths and triplets.', [
          L('fl-roll-pim', 'The p-i-m-i roll in {key}: {chords}', 'accurate-reps', { unit: '8th notes', goal: 105, start: 65, why: 'The repeating thumb-index-middle circle is the roll at the heart of Knopfler\'s fingerstyle rhythm.', instr: 'Play thumb on the bass, then index, middle, index, twice a bar, one bar on each chord. The thumb note rings into the circle. Pass: eight bars with each chord change on the beat.', watch: 'Rushing the circle after a chord change.', simplify: 'Stay on one chord for four bars.' }, c => kf(c, ['pim8'], 1, lv(c) >= 5 ? 2 : 1)),
          L('fl-roll-pima', 'The p-i-m-a roll in {key}: {chords}', 'chunking', { unit: '8th notes', goal: 100, start: 65, why: 'Adding the ring finger fills the top string and widens the roll.', instr: 'Play thumb, index, middle, ring twice a bar over the four chords. Pass: eight bars even.', watch: 'The ring finger plucking harder than the rest.', simplify: 'p-i-m-i until the ring finger is secure.' }, c => kf(c, ['pima8'], 1, lv(c) >= 5 ? 2 : 1)),
          L('fl-roll-trip', 'Triplet rolls in {key}: {chords}', 'interleaving', { unit: '8th-note triplets', goal: 95, start: 60, why: 'A thumb-index-middle roll in triplets gives the rolling feel of slow blues and country ballads.', instr: 'Play the circle three notes to the beat, thumb on each beat, with the bass strings alternating in the second chord. Pass: four bars on each pair of chords with the triplets even.', watch: 'Squashing the triplets into 8ths.', simplify: 'Count 1-trip-let aloud on one chord.' }, c => k2(c, [lv(c) >= 5 ? 'tripAlt' : 'trip3'], 2, 2))
        ], ST('A roll repeats a short circle of fingers so the notes of a chord flow into one another. The thumb marks the beat and the fingers fill the rest.', 'Rolls turn a chord into rhythm and let the hand keep moving across the changes.', ['A roll is a loop of fingers: p-i-m-i or p-i-m-a.', 'The thumb stays on the beat.', 'Triplets repeat the same circle at three per beat.'])),
        S('fl-pinch', 'Pinches', 'picking', 'Thumb and a finger plucking two strings together.', [
          L('fl-pinch-1', 'Pinches on the beat: {chords}', 'chunking', { unit: '8th notes', goal: 100, start: 60, why: 'Knopfler often strikes a note with the thumb and second finger together, the squeeze that gives a note extra body.', instr: 'On beats 1 and 3, pinch the bass string with the middle finger on string 2 (thumb pushes down, middle pulls up) and play the index on string 3 in between. Pass: eight bars with the pinches landing together.', watch: 'One note of the pinch late.', simplify: 'Pinch on beat 1 only.' }, c => k2(c, ['pinch1'])),
          L('fl-pinch-2', 'Pinches with the fingers answering: {chords}', 'transfer', { unit: '8th notes', goal: 100, start: 60, why: 'Alternating the pinch with finger notes on the 2s and 4s turns it into a groove over the progression.', instr: 'Pinch on the beats and answer with the index and middle between as tab shows, over {chords}. Pass: eight bars even with the changes on the beat.', watch: 'The hand staying close to the strings so neighbours ring.', simplify: 'Two bars on one chord.' }, c => kf(c, ['pinch2'], 1, lv(c) >= 5 ? 2 : 1))
        ], ST('A pinch plucks two strings together: thumb pushing down while a finger pulls up. The two notes sound as one thicker note.', 'Pinches give the beat extra weight and are a signature of Knopfler\'s touch.', ['Thumb down, finger up.', 'Pull the hand slightly away afterwards so neighbouring strings stay quiet.', 'Keep the pinches even.'])),
        S('fl-pm', 'Palm-muted thumb under a ringing melody', 'picking', 'The palm damps the bass while the melody notes ring.', [
          L('fl-pm-1', 'Palm-muted bass, ringing melody: {chords}', 'chunking', { unit: '8th notes', goal: 100, start: 60, why: 'A muted thumb keeps the bass tight and makes the melody notes stand out over it.', instr: 'Rest the heel of the picking hand lightly on the low strings so the thumb notes are short and dull, and let the finger notes on strings 2, 3 and 1 ring. Pass: eight bars where the melody is clearly louder than the bass.', watch: 'Muting the melody strings too.', simplify: 'Mute and play the thumb only.' }, c => k2(c, ['pmA'])),
          L('fl-pm-2', 'A muted bass and melody over four chords: {chords}', 'transfer', { unit: '8th notes', goal: 100, start: 60, why: 'The same muted bass under melodies that move through a whole progression.', instr: 'Keep the palm resting and play the bass and melody pattern over {chords}, one bar each, then repeat with the second pattern. Pass: eight bars with the mute steady.', watch: 'The mute drifting off the strings.', simplify: 'Two chords only.' }, c => kf(c, ['pmA', 'pmB'], 1, lv(c) >= 5 ? 2 : 1))
        ], ST('Palm muting the thumb notes shortens them, so the ringing finger notes sound like a melody above a bass line.', 'It separates the two hands\' jobs and is the classic Travis and Knopfler texture.', ['The palm rests lightly on the low strings, near the bridge.', 'Only the bass strings are muted.', 'A muted thumb should still be even.'])),
        S('fl-lines', 'Plucked lead lines', 'picking', 'Pentatonic lines played with i and m alternating.', [
          L('fl-lines-ud', 'A pentatonic line up and down in {key}', 'accurate-reps', { unit: '8th notes', goal: 105, start: 65, why: 'A pentatonic line plucked with alternating fingers is the basic shape of fingerstyle lead.', instr: 'Pluck the {key} pentatonic notes of the position in the tab from the lowest to the highest and back. Use the thumb on the fourth-string notes and index and middle alternating on the others. Pass: two bars clean with the alternation never breaking.', watch: 'Letting one finger do all the work.', simplify: 'Four notes up and four down.' }, c => line(c, { kind: 'ud', bars: lv(c) >= 5 ? 3 : 2 })),
          L('fl-lines-th3', 'Threes up the pentatonic in {key}', 'interleaving', { unit: '8th notes', goal: 100, start: 60, why: 'Groups of three notes moving up the scale exercise the alternation across an odd count, so i and m swap beats each group.', instr: 'Play the three-note groups of the tab, thumb on the bass-string notes and i-m alternating on the rest. Pass: two bars at the goal with every group clean.', watch: 'The alternation breaking at the group boundary.', simplify: 'Play each group alone first.' }, c => line(c, { kind: 'th3', bars: 2 })),
          L('fl-lines-321', 'Skipping notes on the top three strings in {key}', 'chunking', { unit: '8th notes', goal: 100, start: 60, why: 'Skipping a scale note makes wider steps on the top strings with the fingers.', instr: 'Pluck every other scale note on strings 3, 2 and 1 as the tab shows, i and m alternating. Pass: two bars clean.', watch: 'Hitting the wrong string at a jump.', simplify: 'Half the line.' }, c => line(c, { kind: 'skip', strings: [3, 2, 1], bars: 2 }))
        ], ST('A lead line played with the fingers uses the same scale notes as with a pick but plucks them with alternating fingers, so you can mix single notes with chord notes freely.', 'It is how Knopfler plays licks and fills without a pick.', ['Stay in one five-fret window.', 'The thumb takes any bass-string note.', 'i and m alternate on the upper strings.'])),
        S('fl-pull', 'Pull-offs after a plucked note', 'picking', 'Plucking the first note and letting the fretting hand play the next.', [
          L('fl-pull-1', 'Pull-offs down the pentatonic in {key}', 'chunking', { unit: '8th notes', goal: 100, start: 60, why: 'Pulling off after a plucked note creates the smooth, vocal runs of fingerstyle lead.', instr: 'Pluck the first note of each pair with index or middle, then pull your fretting finger off to sound the next, as the tab shows. Pass: two bars with the pull-offs as loud as the plucks.', watch: 'Weak pull-offs. Pull slightly down toward the floor.', simplify: 'One pair at a time.' }, c => line(c, { kind: 'th3d', leg: true, bars: 2 })),
          L('fl-pull-2', 'Hammer-ons and pull-offs together in {key}', 'transfer', { unit: '8th notes', goal: 105, start: 60, why: 'Mixing both gives lines that rise and fall as one phrase, the way an up-and-down pentatonic is played.', instr: 'Pluck each new string, and use hammer-ons going up and pull-offs coming down inside the string. Pass: two bars legato and even.', watch: 'Plucking notes that should be hammered.', simplify: 'Only the descending half.' }, c => line(c, { kind: 'thu', leg: true, bars: 3 }))
        ], ST('A pull-off or hammer-on sounds a note with the fretting hand alone, so only the first note of a pair is plucked. The plucking hand keeps the rhythm, the fretting hand supplies the sound.', 'It lets you play fast and fluent lines with the plucking hand barely moving.', ['The pluck starts the string; the fretting hand finishes it.', 'Pull off slightly sideways so the string sounds.', 'Pull-offs should match the plucks in volume.'])),
        S('fl-tri', 'Triads on the top strings', 'picking', 'Closed triads plucked together over a bass note.', [
          L('fl-tri-two', 'Triads over a thumb bass: {chords}', 'chunking', { unit: 'quarter notes', goal: 95, start: 60, why: 'A thumb on the bass and fingers pinching a triad on strings 3, 2 and 1 gives full chords without strumming.', instr: 'Thumb on the beat, then pluck index, middle and ring together on the next beat, as the tab shows, over {chords}. Pass: four bars of each chord with the three notes landing together.', watch: 'The triad notes rolling instead of sounding together.', simplify: 'Play only the top two notes.' }, c => triBars(c, 'two')),
          L('fl-tri-four', 'Triads through the progression: {chords}', 'transfer', { unit: 'quarter notes', goal: 100, start: 60, why: 'Moving the triads through the four chords of a key applies the shape to real changes.', instr: 'Play the same bass-then-triad pattern on each chord, one bar each. Pass: eight bars even.', watch: 'Losing the shape on the chord changes.', simplify: 'Two chords only.' }, c => triBars(c, 'four'))
        ], ST('A closed triad on the top three strings is three chord tones in one compact shape. Plucked together with i, m and a it sounds like a small strum without moving the whole hand.', 'It adds full harmony to a fingerstyle texture.', ['Strings 3, 2, 1 take i, m, a.', 'Triad shapes move with the chord.', 'All three notes land together.']))
      ]),
    stage('advanced', 'Fast rolls, triplets, double-stops and fingers under overdrive',
      '16th-note rolls, triplet lines with pull-offs, double-stops, string-skipping rolls, an overdriven riff and a rake-and-fill phrase, each at 90 BPM for 8 bars without the hand tightening.', [
        S('fl-16', 'Sixteenth-note rolls', 'picking', 'The roll at 16th-note speed.', [
          L('fl-16-a', 'The 16th-note p-i-m-i roll in {key}: {chords}', 'accurate-reps', { unit: '16th notes', goal: 85, start: 55, why: 'At speed the roll is the Premier Guitar lesson\'s authentic sound: a thumb, index and middle circle repeated without a pause.', instr: 'Play thumb, index, middle, index four times a bar over {chords}, one bar on each chord. Pass: eight bars even, the thumb never accenting the circle.', watch: 'Tension building in the forearm as the tempo rises.', simplify: 'Half the tempo in 8ths.' }, c => k2(c, [lv(c) >= 8 ? 'r16b' : 'r16'])),
          L('fl-16-b', 'Sixteenth-note rolls with the ring finger: {chords}', 'chunking', { unit: '16th notes', goal: 80, start: 55, why: 'Adding the ring finger widens the circle without slowing it.', instr: 'Play p-i-m-a four times a bar through {chords}. Pass: eight bars clean.', watch: 'The ring finger lagging.', simplify: 'p-i-m-i first.' }, c => kf(c, ['r16a'], 1, 1))
        ], ST('At 16th-note speed the roll becomes a continuous stream of notes where the thumb marks the beats and the fingers fill between. Relaxation, not force, makes it fast.', 'Fast rolls are the basis of fingerstyle country and rock rhythm.', ['Four notes to the beat.', 'The thumb stays steady.', 'Only speed up while loose.'])),
        S('fl-trip', 'Triplet lines', 'picking', 'Three notes to the beat with pull-offs.', [
          L('fl-trip-line', 'Triplet pull-offs down the pentatonic in {key}', 'chunking', { unit: '8th-note triplets', goal: 80, start: 55, why: 'Three notes to a beat with a pluck and two pull-offs is the Knopfler triplet lick.', instr: 'Pluck the first note of each triplet and pull off the other two, as the tab shows. Pass: two bars with the triplets even.', watch: 'Rushing the pull-offs.', simplify: 'One group, slowly.' }, c => line(c, { kind: 'th3d', step: 1 / 3, leg: true, bars: 2 })),
          L('fl-trip-roll', 'Triplet roll with alternating bass: {chords}', 'transfer', { unit: '8th-note triplets', goal: 85, start: 55, why: 'A rolling triplet accompaniment under the lines gives the lilt of a slow ballad.', instr: 'Play the circle with thumb on the beats, alternating the bass strings, over {chords}. Pass: eight bars even.', watch: 'Losing the triplet feel.', simplify: 'Single bass string.' }, c => k2(c, ['tripAlt'], 2, 2))
        ], ST('Triplets fit three notes into one beat. With pull-offs, one pluck is enough per group.', 'They give fingerstyle lead its flowing, singing quality.', ['Count 1-trip-let.', 'Pluck once, pull twice.', 'Even spacing.'])),
        S('fl-dbl', 'Double-stops and plucked dyads', 'picking', 'Two or three notes plucked together on the top strings.', [
          L('fl-dbl-a', 'Plucked dyads over a thumb bass: {chords}', 'chunking', { unit: 'quarter notes', goal: 85, start: 55, why: 'Adjacent-string dyads of chord tones, plucked together, are the double-stops used with wide vibrato.', instr: 'Play the bass, then the top two strings of the chord together with middle and ring, over {chords}. Pass: eight bars with both notes of each dyad together.', watch: 'One note of the dyad late.', simplify: 'One chord only.' }, c => triBars(c, 'two', { dyad: true, near: 9 })),
          L('fl-dbl-b', 'Dyads through the progression: {chords}', 'transfer', { unit: 'quarter notes', goal: 90, start: 55, why: 'Moving the dyad through four chords applies the shape to a real progression.', instr: 'Play bass and dyad on each chord, one bar each. Add vibrato to the last dyad of each bar if you can. Pass: eight bars even.', watch: 'Fretting-hand shapes drifting.', simplify: 'Two chords.' }, c => triBars(c, 'four', { dyad: true, near: 9 }))
        ], ST('A double-stop is two notes played together, here the top two strings of a chord. Plucked with the fingers they sound like pedal-steel harmony.', 'It adds a country, steel-guitar flavour to lead and rhythm.', ['Adjacent strings.', 'Chord tones only.', 'Both notes together.'])),
        S('fl-skip', 'String skipping and wide rolls', 'picking', 'Rolls that jump from the bass to the top string.', [
          L('fl-skip-a', 'Wide rolls: bass to the first string: {chords}', 'chunking', { unit: '8th notes', goal: 100, start: 60, why: 'Jumping from the bass to the first string stretches the hand and makes the roll sparkle.', instr: 'Play the bass strings with the thumb and the first string with the ring finger, skipping over the middle, over {chords}. Pass: eight bars clean.', watch: 'Hitting the middle strings by accident.', simplify: 'One chord for four bars.' }, c => k2(c, ['wide'])),
          L('fl-skip-b', 'Wide rolls and syncopated fingers: {chords}', 'interleaving', { unit: '8th notes', goal: 100, start: 60, why: 'Mixing the wide roll with a syncopated pattern teaches the hand to change shape.', instr: 'Alternate one bar of the wide roll and one of the syncopated pattern over {chords}. Pass: eight bars.', watch: 'Rushing the syncopated bar.', simplify: 'Two chords.' }, c => kf(c, ['wide', 'sync'], 1, 1))
        ], ST('Skipping strings means jumping over the strings between two notes. In rolls it widens the pattern from three strings to four or five.', 'It gives the roll more range and a more open sound.', ['Aim before you pluck.', 'Keep the hand quiet.', 'Muted strings in between stay silent.'])),
        S('fl-rock', 'Fingers under overdrive', 'picking', 'The same hand under heavier tone.', [
          L('fl-rock-a', 'A fingerstyle riff on strings 4, 3 and 2: {chords}', 'chunking', { unit: '8th notes', goal: 100, start: 60, why: 'Thumb on the fourth string, index on the third and middle on the second keeps the finger attack under overdrive.', instr: 'Play the thumb on string 4 with the palm lightly muting, index on 3 and middle on 2, as tab shows, over {chords}. Pass: eight bars tight.', watch: 'The palm muting the wrong strings.', simplify: 'Thumb notes only.' }, c => k2(c, ['riffA'])),
          L('fl-rock-b', 'A heavier riff with the fingers: {chords}', 'transfer', { unit: '8th notes', goal: 100, start: 60, why: 'The same fingers on a more syncopated riff apply the technique to rock.', instr: 'Alternate the two riff patterns over {chords}. Pass: eight bars tight.', watch: 'Rushing the syncopation.', simplify: 'One chord.' }, c => kf(c, ['riffA', 'riffB'], 1, 1))
        ], ST('Playing with the fingers under overdrive keeps the attack of the fingertips and thumb while the amp adds sustain. The thumb is usually muted by the palm.', 'It lets you play riffs and fills without a pick.', ['Strings 4, 3, 2.', 'Palm rests on the bass.', 'Attack with the fingertips.'])),
        S('fl-rake', 'Quick-pluck rakes', 'picking', 'Plucking a chord quickly with p-i-m instead of raking with a pick, then a fill.', [
          L('fl-rake-a', 'Quick-pluck rake into a fill: {chords}', 'chunking', { unit: '8th notes', goal: 90, start: 55, why: 'Plucking thumb, index and middle in quick succession gives the rake sound without a pick.', instr: 'Pluck the bass, the third and the second string in quick succession on beat 1, then play the fill notes of the tab. Pass: eight bars with the rake sounding as one gesture.', watch: 'The notes of the rake spread too wide.', simplify: 'Rake only.' }, c => k2(c, ['rakeA'])),
          L('fl-rake-b', 'Rakes and fills through the progression: {chords}', 'transfer', { unit: '8th notes', goal: 90, start: 55, why: 'Placing rakes and fills across a progression builds a phrase.', instr: 'Alternate the two rake patterns over {chords}. Pass: eight bars.', watch: 'Losing the beat after the rake.', simplify: 'Two chords.' }, c => kf(c, ['rakeA', 'rakeB'], 1, 1))
        ], ST('A rake is a quick spread of a chord. With the fingers you pluck the notes in rapid succession from low to high instead of dragging a pick.', 'It is the opening gesture of many Knopfler phrases.', ['Notes land almost together, low to high.', 'Follow with a short fill.', 'Keep the pulse.']))
      ]),
    stage('mastery', 'Fingerstyle as a voice',
      'Sixteenth-note rolls at 100 BPM relaxed, improvised phrases over a progression, long endurance lines, and a study that joins rolls, pinches, muted bass, wide rolls and a rake in one arrangement.', [
        S('fl-speed', 'Rolls at tempo', 'picking', 'Performance-tempo rolls over changes.', [
          L('fl-speed-a', 'Relaxed 16ths at tempo: {chords}', 'accurate-reps', { unit: '16th notes', goal: 95, start: 70, why: 'The tempo you can hold relaxed is the tempo you own.', instr: 'Play the 16th-note rolls with the thumb alternating bass strings over {chords}. Pass: eight bars with no tension.', watch: 'Forearm tension.', simplify: 'Lower tempo.' }, c => k2(c, ['r16', 'r16b'])),
          L('fl-speed-b', 'Syncopated 16ths at tempo: {chords}', 'chunking', { unit: '16th notes', goal: 90, start: 65, why: 'Syncopated rolls at tempo test the hand\'s independence.', instr: 'Play the syncopated 16th pattern and the ring-finger roll through {chords}. Pass: eight bars.', watch: 'Losing the thumb pulse.', simplify: 'Half tempo.' }, c => kf(c, ['r16d', 'r16a'], 1, 1))
        ], ST('Speed in fingerstyle is relaxation. Raise the click only while the hand stays loose.', 'Relaxed speed lasts for a whole song.', ['Loose forearm.', 'Small movements.', 'Record yourself.'])),
        S('fl-improv', 'Improvising with the fingers', 'improv', 'Chord-tone phrases over a progression.', [
          c => guide(c, 'fl-improv-guide', 'Fingerstyle solo over the changes: land on chord tones'),
          c => guide({ ...c, minor: !c.minor }, 'fl-improv-guide2', 'Fingerstyle solo in the other mode: chord tones and space')
        ], ST('Improvising with the fingers uses the same chord-tone targets as with a pick; the difference is touch and dynamics, which come from the fingertip itself.', 'Dynamics and space are what make a fingerstyle solo sing.', ['Land on a chord tone at each change.', 'Use space.', 'Vary the attack.'])),
        S('fl-endure', 'Endurance lines', 'picking', 'Long lines without tightening.', [
          L('fl-endure-16', 'A long 16th-note line in {key}', 'accurate-reps', { unit: '16th notes', goal: 85, start: 60, why: 'Endurance shows whether the alternation is truly relaxed.', instr: 'Pluck the {key} pentatonic line, alternating i and m, thumb on bass notes. Pass: four bars without the hand tightening.', watch: 'Gripping.', simplify: 'Two bars.' }, c => line(c, { kind: 'ud', step: 0.25, bars: 4 })),
          L('fl-endure-trip', 'A long triplet line with pull-offs in {key}', 'chunking', { unit: '8th-note triplets', goal: 85, start: 60, why: 'Long triplet lines with pull-offs test the pluck–pull balance.', instr: 'Play the triplet line, pluck once, pull twice. Pass: four bars even.', watch: 'Weak pull-offs late in the line.', simplify: 'Two bars.' }, c => line(c, { kind: 'thu', step: 1 / 3, leg: true, bars: 4 }))
        ], ST('An endurance line keeps the same motion going for several bars. It trains consistency.', 'Long lines show tension that short ones hide.', ['Even touch.', 'Rest the arm.', 'Breathe.'])),
        S('fl-cap', 'Capstone studies', 'picking', 'Original studies that join the whole technique.', [
          L('fl-cap-a', 'Study: strum, muted bass, rolls ({key})', 'transfer', { unit: '16th notes', goal: 85, start: 60, minutes: 8, why: 'Using the fingerstyle strum, palm-muted bass and 16th rolls in sequence puts the whole technique into one piece.', instr: 'Play the study: four bars of the fingerstyle strum and alternating bass, two of muted bass, two of 16th rolls. Pass: all eight bars without the hand stopping.', watch: 'Pausing between sections.', simplify: 'One section at a time.' }, capA),
          L('fl-cap-b', 'Study: pinches, wide rolls, rake ({key})', 'transfer', { unit: '16th notes', goal: 85, start: 60, minutes: 8, why: 'A second study uses pinches, wide rolls, a rake and a 16th roll.', instr: 'Play the study through, a different texture every two bars. Pass: all eight bars with the pulse steady.', watch: 'The thumb rushing in the roll.', simplify: 'Half the sections.' }, capB)
        ], ST('A study joins several textures in one piece. The hand never stops; only what it plays changes.', 'This is how technique becomes music.', ['Plan the sections.', 'Keep the pulse.', 'Play it musically.']))
      ])
  ]
});
