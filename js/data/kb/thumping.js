// Thumping: the guitar version of the bassist's double-thumb slap and pop (Victor Wooten's technique,
// brought to the 7- and 8-string guitar by Tosin Abasi). The thumb works like a rigid pick turned from the
// wrist: a downstroke through the low string, an upstroke that catches it on the way back, then the index
// (and later the middle) finger pops a higher string, giving fast, drum-like cells of three and four notes.
//
// Built 2026-10-17 from the player's research brief (Gemini Gem, five parts `thumping.*.json`, merged with
// content/briefs/merge-brief.mjs) and checked against real pages: Bass Musician Magazine (double thumbing:
// the thumb as a rigid pick from the wrist, even accents, scales and octave grooves), Guitar World's Tosin
// Abasi workshop and "Prog-Gnosis" lesson (thumb down and up, then index and middle; hammer-ons start the
// phrases; the six-string adaptation; 16ths against triplet-based cells), MusicRadar (the pop), Guitar
// Messenger's THUMP! contents. The brief's patterns are used as written: thumpTriplet8 (8th string open,
// twice, then 6th string fret 2), thumpQuad8 (+ 5th string fret 4), thumpTriplet6 and thumpQuad6 (the same
// cells two strings up on a six-string). None of them is presented as a transcription of Tosin Abasi.
//
// Concept-first (CONTENT.md): the model is a CELL of ROLES on a ROOT. Roles are intervals above the thumb
// note on strings counted from the thumb string: D and U (thumb down and up, the root), P (index pop, the
// octave two strings up), Q (middle pop, the 5th above the octave three strings up), H (a fretting-hand
// hammer-on from nowhere, the ♭3 above the octave on Q's string, at the root's fret); "wide" moves P and Q two strings further
// (two octaves and the 5th above). `thumpRun(c, spec)` places each bar's root (a degree of the minor key)
// on the thumb string nearest the hand, computes every role's fret from pitch, and fills the bar with a
// cell in a rhythm (loop, continuous across bars for displacement, or exact events), so every lesson is
// right in all 12 keys and on 8 or 6 strings.
import { OPEN, N, nameOf, minorKey, make, mod12, S, stage, entry } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
/** Role → [semitones above the root, strings above the thumb string]. */
export const ROLE = { D: [0, 0], U: [0, 0], P: [12, 2], Q: [19, 3], H: [15, 3] };
/** Wide versions: the pops two strings further away (two octaves up, and the 5th above that). */
export const WIDE = { P: [24, 4], Q: [31, 5] };
const MARK = { D: { fing: 'p', pick: 'd' }, U: { fing: 'p', pick: 'u' }, P: { fing: 'i' }, Q: { fing: 'm' } };
/**
 * 8-string tabs (tab.strings: 8) are on: the app tests accept strings up to a lesson's tab.strings since
 * commit d6abf0d (content/REQUESTS.md, 2026-10-17). Set to false to build every 8-string lesson on a
 * six-string instead, two strings up (thumb on the low E or A string), or three up for the open-string drills.
 */
export const EIGHT_STRING_TABS = true;
const STR8 = { 8: '8th string', 7: '7th string', 6: '6th string', 5: '5th string', 4: 'D string', 3: 'G string', 2: 'B string', 1: 'high e string' };
const STR6 = { 6: 'low E string', 5: 'A string', 4: 'D string', 3: 'G string', 2: 'B string', 1: 'high e string' };
const G8 = 'On an 8-string in standard tuning (low to high F♯ B E A D G B E). ';
const G6 = 'On a six-string in standard tuning. ';
/** Thumb strings for each guitar: the lowest first. */
export const THUMB = { 8: [8, 7], 6: [6, 5] };
/** Which note may sound where (for the pitch check): note → allowed pitch classes. */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
/** Where a role sounds for a root (thumb string T, root MIDI pitch): {s, f} or null if it doesn't fit. */
export function roleAt(role, T, rootP, wide = false) {
  const [iv, ds] = (wide && WIDE[role]) || ROLE[role], s = T - ds;
  if (s < 1) return null;
  const f = rootP + iv - OPEN[s];
  return f >= 0 && f <= 22 ? { s, f } : null;
}
/** The root's place: the thumb string and fret nearest `near` where every role of the bar fits. */
export function placeRoot(pc, strings, near, roles, wide = false, minF = 0) {
  let best = null;
  for (const [i, T] of strings.entries()) for (let f = mod12(pc - OPEN[T]); f <= 22; f += 12) {
    if (f < minF || !roles.every(r => roleAt(r, T, OPEN[T] + f, wide))) continue;
    const score = Math.abs(f - near) + i * 0.5;
    if (!best || score < best.score) best = { T, f, score };
  }
  return best;
}
/**
 * Pedal bars: the thumb holds the key's low root (pedal {T, f}) while the pops play the bar chord's root (P)
 * and 5th (Q) on higher strings within reach of the pedal fret. Returns {P, Q} spots or null.
 */
export function popsNear(pc, pedal, roles) {
  const lo = pedal.f, hi = pedal.f === 0 ? 7 : pedal.f + 5, at = (s, x) => { for (let f = Math.max(lo, 0); f <= hi; f++) if (mod12(OPEN[s] + f) === mod12(x)) return { s, f }; return null; };
  for (let ps = pedal.T - 2; ps >= Math.max(1, pedal.T - 4); ps--) {
    const P = at(ps, pc); if (!P) continue;
    if (!roles.includes('Q')) return { P };
    for (let qs = ps - 1; qs >= Math.max(1, ps - 2); qs--) { const Q = at(qs, pc + 7); if (Q && OPEN[Q.s] + Q.f > OPEN[P.s] + P.f) return { P, Q }; }
  }
  return null;
}
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
/** The events of a bar: [role | '.', start (beats from the bar), length]. */
function barEvents(bar, beats, cyc) {
  const out = [];
  if (bar.ev) { let t = 0; for (const [seq, step] of bar.ev) for (const ch of seq) { if (ch !== '.') out.push([ch, t, step]); t += step; } return { out, used: 0 }; }
  const slots = Math.round(beats / bar.step), start = bar.cont ? cyc : 0;
  for (let i = 0; i < slots; i++) { const ch = bar.seq[(start + i) % bar.seq.length]; if (ch !== '.') out.push([ch, i * bar.step, bar.step]); }
  return { out, used: slots };
}
/**
 * One thumping exercise from a spec: { id, name ('{key}', '{guitar}', '{chords}'), method, guitar (8 | 6),
 * open (the brief's open-string position: root = the open thumb string, any key), plan (lvl => bars or bars:
 * { off (semitones above the minor key's root), q ('m' minor | '' major), seq + step (loop), cont (carry the
 * cell on from the last bar), ev ([[roles, step], …] exact), beats, strings (thumb strings), wide, pedal (thumb
 * stays on the key's low root while the pops follow the chord), minF }), near, backing (true), beatsPerBar,
 * domain, unit, goal, start, minutes, dl, why, instr, watch, simplify }.
 */
export function thumpRun(c, spec0) {
  const down = (spec0.guitar || 8) === 8 && !EIGHT_STRING_TABS, shift = !down ? 0 : spec0.downStrings ? spec0.strings[0] - spec0.downStrings[0] : spec0.open ? 3 : 2;
  const mapB = b => (b.strings ? { ...b, strings: b.strings.map(x => x - shift) } : b);
  const spec = down ? { ...spec0, guitar: 6, strings: spec0.downStrings || (spec0.strings && spec0.strings.map(x => x - shift)), plan: typeof spec0.plan === 'function' ? lvl => spec0.plan(lvl).map(mapB) : spec0.plan.map(mapB) } : spec0;
  const lvl = c.lvl || 4, g = spec.guitar || 8, plan = typeof spec.plan === 'function' ? spec.plan(lvl) : spec.plan;
  const k = spec.open ? mod12(OPEN[THUMB[g][0] - (down ? 1 : 0)]) : minorKey(c);
  const notes = [], chords = [], steps = new Set(); let t = 0, near = spec.near != null ? spec.near : spec.open ? 0 : 3, cyc = 0, pedal = null;
  for (const bar of plan) {
    const beats = bar.beats || spec.beatsPerBar || 4, wide = !!(bar.wide || spec.wide), q = bar.q != null ? bar.q : 'm';
    const pc = mod12(k + (bar.off || 0));
    const { out, used } = barEvents(bar, beats, cyc);
    const roles = [...new Set(out.map(e => e[0]))];
    if (bar.pedal && !pedal) { const pp = placeRoot(k, [THUMB[g][0]], 0, ['D']); if (!pp) return null; pedal = { T: pp.T, f: pp.f }; }
    let T, f;
    if (bar.pedal) { T = pedal.T; f = pedal.f; }
    else if (spec.open) { T = bar.T || THUMB[g][0] - (down ? 1 : 0); f = mod12(pc - OPEN[T]); }
    else {
      const strings = bar.strings || spec.strings || THUMB[g];
      const pl = placeRoot(pc, strings, near, roles, wide, bar.minF != null ? bar.minF : spec.minF || 0);
      if (!pl) return null; T = pl.T; f = pl.f; if (!bar.pedal) near = f;
    }
    const pedalPops = bar.pedal ? popsNear(pc, pedal, roles) : null;
    if (bar.pedal && !pedalPops) return null;
    const rootP = OPEN[T] + f, chordPcs = [0, 7, ...(q === 'm' ? [3, 10] : [])].map(x => mod12(pc + x));
    for (const [role, at, d] of out) {
      steps.add(d);
      if (bar.pedal && (role === 'D' || role === 'U')) { notes.push(tag(N(pedal.T, pedal.f, t + at, d, null, MARK[role]), [k])); continue; }
      const p = bar.pedal ? pedalPops[role] : roleAt(role, T, rootP, wide); if (!p) return null;
      notes.push(tag(N(p.s, p.f, t + at, d, role === 'H' ? 'h' : null, MARK[role] || null), chordPcs));
    }
    if (bar.cont || bar.seq) cyc = bar.cont ? cyc + used : used;
    for (let b = 0; b < Math.round(beats / 4) || (b === 0 && beats < 4); b++) chords.push(nameOf(pc) + q);
    t += beats;
  }
  if (notes.length < 3 || notes.length > 400) return null;
  const used = [...new Set(chords)];
  const names = g === 8 ? STR8 : STR6;
  const fill = s => s.replace(/\{key\}/g, `${nameOf(k)}${spec.open ? '' : ' minor'}`).replace(/\{guitar\}/g, `${g}-string`).replace(/\{chords\}/g, used.join(' – '))
    .replace(/\{s(\d)\}/g, (_, n) => names[+n - shift]).replace(/\{open\}/g, g === 8 ? 'low F♯' : nameOf(k)).replace(/\{G\}/g, g === 8 ? G8 : G6);
  const unit = spec.unit || (steps.size === 1 ? UNIT.get([...steps][0]) : 'mixed rhythms') || 'mixed rhythms';
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'picking', method: spec.method, unit,
    goal: spec.goal || 80, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'fingers',
    ...(spec.beatsPerBar ? { beatsPerBar: spec.beatsPerBar } : {}),
    why: fill(spec.why), instr: fill(spec.instr), watch: fill(spec.watch), simplify: fill(spec.simplify),
    ...(spec.backing !== false && !spec.beatsPerBar ? { backing: chords, chords: used.slice(0, 8) } : {}),
    tab: g === 8 ? { strings: 8, notes } : { notes }
  });
}
const T_ = (id, name, method, opts) => c => thumpRun(c, { id, name, method, ...opts });

/* ------------------------------- Bar plans ------------------------------- */
const rep = (n, bar) => Array.from({ length: n }, () => ({ ...bar }));
const Q16 = { seq: 'DUPQ', step: 0.25 }, T8 = { seq: 'DUP', step: 1 / 3 }, D16 = { seq: 'DUP', step: 0.25 }, F16 = { seq: 'DUPQH', step: 0.25 }, E8 = { seq: 'DUPQ', step: 0.5 };
const GEAR = { ev: [['DUPQDUPQ', 0.25], ['DUPDUP', 1 / 3]] }, STOP = { ev: [['DUPDUP', 1 / 3], ['.', 2]] };
// degrees of the minor key (semitones) and their chord quality
const i = 0, iv = 5, v = 7, bVI = 8, bVII = 10, bIII = 3;
const Mj = { q: '' };
/** Etude bars: [degree, cell, extra]. */
const bars = list => list.map(([off, cell, x]) => ({ off, ...cell, ...([bVI, bVII, bIII].includes(off) ? Mj : {}), ...(x || {}) }));
const STUDY16 = bars([[i, E8], [i, Q16], [bVI, Q16, { pedal: true }], [bVII, Q16, { pedal: true }], [i, T8], [i, GEAR], [iv, Q16], [v, T8],
  [i, Q16], [i, Q16], [bVI, Q16, { pedal: true }], [bVII, Q16, { pedal: true }], [iv, D16], [iv, { ...D16, cont: true }], [v, GEAR], [i, STOP]]);
const CAP_A = bars([[i, E8], [i, Q16], [i, F16], [i, { ...Q16 }], [bVI, Q16, { pedal: true }], [bVII, Q16, { pedal: true }], [i, GEAR], [i, T8],
  [iv, E8], [iv, D16], [v, E8], [v, D16], [bVI, T8], [bVII, T8], [i, GEAR], [i, STOP]]);
const CAP_B = bars([[i, T8, { wide: true }], [i, T8, { wide: true }], [bVI, T8], [bVII, T8], [iv, F16], [iv, E8], [v, T8], [v, GEAR],
  [i, E8], [i, D16], [i, { ...D16, cont: true }], [bVII, T8], [bVI, E8, { pedal: true }], [bVII, E8, { pedal: true }], [i, E8], [i, { ev: [['DUPQDUPQ', 0.25], ['D', 2]] }]]);

/* --------------------------------- Lessons --------------------------------- */
const THUMBHOW = 'Keep the thumb rigid and move it from a turn of the wrist, not the arm: the downstroke strikes through the string with the side of the thumb, and the upstroke catches the same string on the way back. ';
const POPHOW = 'For a pop, hook the fingertip slightly under the string and snap it away from the neck so it slaps back against the frets; don’t yank it (the pitch goes sharp). ';
const MUTE = 'Let the fretting hand lie lightly across the strings you are not playing: thumping makes the whole guitar ring. ';

/** A study plan as a spec (shared by the advanced study and the capstone). */
const study = (id, name, plan, method, extra) => T_(id, name, method, { guitar: 8, plan, domain: 'improv', unit: 'mixed rhythms', ...extra });

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'thumping', kind: 'technique', title: 'Thumping (double thumb and pop)', domain: 'picking',
  re: /\bthump(ing|ed|s)?\b|double.?thumb(ing)?|thumb (down|up).?strokes?/,
  aliases: ['double thumbing', 'thumb slap and pop on guitar'],
  summary: 'The double-thumb slap and pop on guitar: the thumb as a rigid pick striking down and catching up, then index and middle-finger pops, built into 3- and 4-note cells on 8 and 6 strings, in every key, through chord changes, odd groupings and odd meters, to an original prog study.',
  prereqs: ['hybridPicking', 'subdivisions'],
  sources: ['https://bassmusicianmagazine.com/2007/10/double-thumbing/', 'https://www.guitarworld.com/lessons/tosin-abasi-guitar-technique-workshop', 'https://www.guitarworld.com/uncategorized/prog-gnosis-how-play-thumb-slapped-intro-infinite-regression', 'https://www.musicradar.com/tuition/guitars/how-to-play-guitar-like-tosin-abasi-612264', 'https://guitarmessenger.com/Thump'],
  pedagogy: {
    date: '2026-10-17',
    summary: 'Double thumbing is taught from the thumb downstroke (the thumb held rigid like a pick, moved from the wrist, striking through the string), then the upstroke that catches the same string on the way back with the same accent, then the finger pop (the string pulled away from the neck and released to snap against the frets); the three are joined into a down-up-pop cell on a root and its octave, a second pop with the middle finger makes a four-note cell, and the cells are then moved across string sets and to the six-string, set against the beat (16ths against three-note cells), sped up in small steps, extended with fretting-hand hammer-ons from nowhere into longer groups, and used in grooves, riffs and studies.',
    sequence: [
      { id: 'down', tier: 'foundations', step: 'The thumb downstroke through the string', how: 'The thumb kept rigid, moved by the wrist, strikes through the low string with its side (the corner, not the whole pad), with an even volume.', skills: ['thump-rest'], source: 0 },
      { id: 'double', tier: 'foundations', step: 'The double thump: the upstroke catches the string', how: 'After passing through, the thumb comes back up and catches the same string, so one motion gives two notes; the two attacks as even as possible.', skills: ['thump-double'], source: 0 },
      { id: 'pop', tier: 'foundations', step: 'The pop', how: 'The index finger pulls the string away from the body and lets it snap back against the frets.', skills: ['thump-pop'], source: 3 },
      { id: 'cell', tier: 'foundations', step: 'Thumb down, up, pop: the three-note cell on a root and its octave', how: 'The thumb slap and the pop joined into one figure; the thumb on the root, the pop on its octave two strings up.', skills: ['thump-cell'], source: 1 },
      { id: 'quad', tier: 'intermediate', step: 'The second pop: thumb down, up, index, middle', how: 'After the two thumb notes the index and middle fingers sound the next two notes, on the root’s octave and 5th.', skills: ['thump-quad'], source: 2 },
      { id: 'sets', tier: 'intermediate', step: 'Other string sets, other roots and the six-string version', how: 'The same cell moved to other strings; on a six-string it sits on higher strings with less weight.', skills: ['thump-sets'], source: 2 },
      { id: 'gears', tier: 'intermediate', step: 'Cells against the beat: triplets, 16ths and displacement', how: 'Three-note cells played as straight 16ths against the beat (two against three), switching between triplet and 16th feels.', skills: ['thump-gears'], source: 2 },
      { id: 'context', tier: 'intermediate', step: 'Grooves and scales with the double thumb', how: 'Scales played with double thumbing, and octave grooves (root, octave) over a groove.', skills: ['thump-context'], source: 0 },
      { id: 'speed', tier: 'advanced', step: 'Speed in small steps: bursts and chord changes', how: 'Slow and accurate first, then the tempo raised in small steps once the hands are synchronised.', skills: ['thump-speed'], source: 1 },
      { id: 'skips', tier: 'advanced', step: 'Wider string skips', how: 'Thumb and pops on strings further apart; string skipping is the hard part at first.', skills: ['thump-skip'], source: 0 },
      { id: 'hammer', tier: 'advanced', step: 'Hammer-ons from nowhere: five-note groups', how: 'Fretting-hand hammer-ons add notes to the slap and pop, giving five-note figures that run across the beat.', skills: ['thump-groups'], source: 1 },
      { id: 'riffs', tier: 'advanced', step: 'Riffs in odd meters and a study', how: 'Thumping in a rhythmic context and in musical examples: displaced phrases and odd-time riffs.', skills: ['thump-adv-music'], source: 4 },
      { id: 'stamina', tier: 'mastery', step: 'Long runs at tempo with even accents', how: 'Long passages with the down and up attacks kept even, the tempo raised gradually.', skills: ['thump-stamina'], source: 0 },
      { id: 'improv', tier: 'mastery', step: 'Mixing the cells over grooves and changes', how: 'Break the patterns up and make your own lines, following a progression’s roots.', skills: ['thump-improv'], source: 0 },
      { id: 'capstone', tier: 'mastery', step: 'A complete musical example', how: 'A full piece that uses the slap, pops, hammer-ons, skips and displacement musically.', skills: ['thump-capstone'], source: 4 }
    ],
    drills: ['Thumb downstrokes on one open string with an even volume', 'Down-up 8ths on one string with equal accents', 'Index pops alone, then alternating with the thumb', 'Down-up-pop triplets on a root and its octave', 'Down-up-pop-pop 16ths with the middle finger on the 5th', 'Scales with the double thumb', 'Three-note cells as 16ths against the beat', 'Five-note groups with a hammer-on from nowhere'],
    mistakes: ['Bouncing the thumb off the string like a bass slap instead of striking through it like a pick', 'Uneven volume between the thumb downstroke and upstroke', 'Moving the arm instead of turning the wrist', 'Using too much of the thumb, so it can’t pass through in both directions', 'Pulling the popped string too hard: sharp pitch and fret buzz', 'Unplayed strings ringing'],
    sources: [
      { title: 'Double Thumbing', author: 'Bass Musician Magazine', url: 'https://bassmusicianmagazine.com/2007/10/double-thumbing/' },
      { title: 'Selective picking: learn Tosin Abasi’s groundbreaking technique (technique workshop)', author: 'Guitar World', url: 'https://www.guitarworld.com/lessons/tosin-abasi-guitar-technique-workshop' },
      { title: 'Prog-Gnosis: How to play the thumb-slapped intro to "An Infinite Regression"', author: 'Guitar World', url: 'https://www.guitarworld.com/uncategorized/prog-gnosis-how-play-thumb-slapped-intro-infinite-regression' },
      { title: 'How to play guitar like… Tosin Abasi', author: 'MusicRadar (Total Guitar)', url: 'https://www.musicradar.com/tuition/guitars/how-to-play-guitar-like-tosin-abasi-612264' },
      { title: 'THUMP! Tosin Abasi’s guitar instructional DVD (contents)', author: 'Tosin Abasi, Guitar Messenger', url: 'https://guitarmessenger.com/Thump' }
    ]
  },
  ctx: { key: 6, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Thumb down, thumb up, pop',
      'Play the down-up-pop cell on an open low string (the low F♯ of an 8-string, the low E or A of a six-string) in 8th-note triplets at 75 BPM for 4 bars, the thumb’s down and up strokes the same volume and every pop clean.', [
        S('thump-rest', 'The thumb downstroke', 'picking', 'Strike through the string like a pick.', [
          T_('thump-rest-8', 'Thumb downstrokes on the open {open} string ({guitar})', 'accurate-reps', { guitar: 8, open: true, plan: lvl => rep(2 + lvl, { seq: 'D', step: 1 }), goal: 60, start: 40, backing: false,
            why: 'Everything in thumping starts with one downstroke: the thumb used like a pick, striking through the string rather than bouncing off it as in a bass slap.',
            instr: '{G}' + THUMBHOW + 'Downstrokes only, one per click, on the open {s8}; let the thumb come to rest against the {s7} after each stroke. ' + MUTE + 'Pass: 20 clean downstrokes in a row, each one the same volume, the thumb stopping on the next string every time.',
            watch: 'Bouncing the thumb off the string (a bass slap): it should pass through and stop.', simplify: 'Half notes, at 40 BPM.' }),
          T_('thump-rest-6', 'Thumb downstrokes on the open low E ({guitar})', 'accurate-reps', { guitar: 6, open: true, plan: lvl => rep(2 + lvl, { seq: 'D', step: 1 }), goal: 60, start: 40, backing: false,
            why: 'The same downstroke on a six-string’s low E, where the string is lighter: the thumb has to stay parallel to the strings to strike cleanly.',
            instr: G6 + THUMBHOW + 'Downstrokes only on the open low E, resting against the A string after each one. Keep the thumb parallel to the strings. Pass: 20 clean downstrokes in a row at an even volume.',
            watch: 'The thumb angled across the strings, catching the nail.', simplify: 'Half notes.' })], {
          concept: 'The thumping downstroke uses the side of a rigid thumb like a pick: it strikes through the low string and stops, instead of bouncing off it as a bassist’s slap does.',
          why: 'A rigid thumb that passes through the string is what makes the second stroke (the upstroke) possible.',
          theory: ['The motion comes from a turn of the wrist, not the arm or the thumb joint.', 'Use the corner of the thumb: too much flesh can’t pass through in both directions.']
        }),
        S('thump-double', 'The double thump', 'picking', 'Down, then up on the same string.', [
          T_('thump-du-8', 'Down-up double thumps in 8ths on the open {open} string ({guitar})', 'accurate-reps', { guitar: 8, open: true, plan: lvl => rep(2 + lvl, { seq: 'DU', step: 0.5 }), goal: 70, start: 44, backing: false,
            why: 'The double thump turns one wrist motion into two notes: down through the string, then the upstroke catches it on the way back.',
            instr: '{G}' + THUMBHOW + 'Down on the beat, up on the "and", on the open {s8}. Listen for two notes of the same loudness. Pass: 10 down-up pairs in a row with equal volume between the strokes.',
            watch: 'A loud downstroke and a weak upstroke.', simplify: 'Quarter notes: down, up.' }),
          T_('thump-du-6', 'Continuous double thumping on the open low E ({guitar})', 'accurate-reps', { guitar: 6, open: true, plan: lvl => rep(3 + lvl, { seq: 'DU', step: 0.5 }), goal: 80, start: 48, backing: false,
            why: 'The upstroke on a six-string’s low E is where the nail tends to snag; keeping the thumb parallel to the strings keeps it smooth.',
            instr: G6 + THUMBHOW + 'Continuous 8th notes, down-up, on the open low E. Pass: 4 bars of continuous double thumps with no snag of the nail and an even volume.',
            watch: 'The nail catching the string on the upstroke: flatten the thumb’s angle.', simplify: 'Two bars, then rest two.' })], {
          concept: 'The double thump is a downstroke through the string and an upstroke that catches the same string on the way back, two notes from one wrist rotation.',
          why: 'It doubles the speed of the thumb and gives the even, drum-like pulse that the pops sit on.',
          theory: ['Down and up should be equally loud; accents come later, by choice.', 'The same motion as alternate picking, with the thumb as the pick.']
        }),
        S('thump-pop', 'The pop', 'picking', 'The index finger snaps the octave.', [
          T_('thump-pop-6', 'Index-finger pops on the octave: D string, fret 2 ({guitar})', 'chunking', { guitar: 6, open: true, plan: lvl => rep(2 + lvl, { seq: 'P', step: 1 }), goal: 70, start: 44, backing: false,
            why: 'The pop is the other half of the technique, and it has to be learned alone: the finger pulls the string away from the neck and lets it snap back.',
            instr: G6 + POPHOW + 'Fret the E on the D string (fret 2, the octave of the open low E) and pop it with the index finger once per click. ' + MUTE + 'Pass: 10 clean, ringing pops in a row with no sharp pitch.',
            watch: 'Pulling too hard: the note goes sharp and buzzes.', simplify: 'Pluck it normally first, then add the snap.' }),
          T_('thump-dp-8', 'Thumb and pop in turn: {open} and its octave ({guitar})', 'chunking', { guitar: 8, open: true, plan: lvl => rep(2 + lvl, { seq: 'DP', step: 0.5 }), goal: 75, start: 46, backing: false,
            why: 'Thumb downstroke, then the index pop on the octave two strings up: the two hands of the technique taking turns, before the upstroke is added between them.',
            instr: '{G}' + THUMBHOW + POPHOW + 'Downstroke on the open {s8} on the beat, pop the octave on the {s6} (fret 2) on the "and". Pass: 4 bars of thumb and pop in turn with the wrist relaxed.',
            watch: 'The wrist tightening when the pop comes.', simplify: 'Quarter notes.' })], {
          concept: 'A pop pulls a string away from the neck with the fingertip and releases it, so it slaps back against the frets with a bright, percussive attack.',
          why: 'The pop gives the cell its high, cutting note; on its own and then alternating with the thumb, it becomes automatic.',
          theory: ['The pop here is the root an octave above the thumb’s note: two strings up, two frets higher.', 'Hook the tip just under the string; a small snap is louder than a big pull.']
        }),
        S('thump-cell', 'The three-note cell', 'picking', 'Down, up, pop.', [
          T_('thump-tri-8', 'The down-up-pop cell on the open {open} string ({guitar})', 'edge', { guitar: 8, open: true, plan: lvl => rep(2 + lvl, T8), goal: 80, start: 50, backing: false,
            why: 'Thumb down, thumb up, index pop: the three-note cell at the heart of thumping, in its basic open-string form ({s8} open twice, then the {s6} at fret 2).',
            instr: '{G}' + 'One cell per beat in 8th-note triplets: down and up on the open {s8}, pop the {s6} at fret 2. ' + MUTE + 'Climb from the start tempo by 4 BPM after each clean pass. Pass: 4 clean bars of the cell at the goal tempo.',
            watch: 'The pop rushing ahead of the triplet.', simplify: 'At 50 BPM, one cell every two beats.' }),
          T_('thump-tri-6', 'First groove: the cell on the low E and D strings over E minor ({guitar})', 'transfer', { guitar: 6, open: true, plan: lvl => [...rep(2 + lvl, T8), { ev: [['DUPDUPDUP', 1 / 3], ['.', 1]] }], goal: 80, start: 50,
            why: 'The same cell two strings up on a six-string (open low E twice, the E on the D string popped), looped as a groove with a stop at the end: the first music made with the technique.',
            instr: G6 + 'Loop the cell over the E minor backing, one cell per beat; in the last bar play three cells and leave beat 4 silent. Pass: 8 cells in a row with steady timing, then the stop exactly on beat 4.',
            watch: 'Strings ringing in the stop: mute everything with both hands.', simplify: 'Two bars and the stop.' })], {
          concept: 'The cell joins the double thump and the pop: down and up on the root, then the octave popped two strings higher, one cell per beat as a triplet.',
          why: 'Every thumping groove is built from cells like this one.',
          theory: ['Root, root, octave: a cell that is right over any chord with that root.', 'The thumb rests against the next string between strokes; the fretting hand mutes the rest.']
        })
      ], [1, 3]),
    stage('intermediate', 'Four-note cells, any key',
      'Play the 3- and 4-note cells in any key on 8 and 6 strings, move them between string sets and between the two lowest strings, switch between triplets and 16ths every bar, loop the 3-note cell as 16ths, and hold a 4-bar thumping groove over a minor backing at 90 BPM.', [
        S('thump-quad', 'The four-note cell', 'picking', 'Down, up, index, middle.', [
          T_('thump-mpop', 'The middle-finger pop on the 5th: {key} ({guitar})', 'chunking', { guitar: 8, strings: [8], plan: lvl => [...rep(2, { seq: 'Q', step: 1 }), ...rep(lvl - 2, { seq: 'PQ', step: 0.5 })], goal: 70, start: 44, unit: 'quarter and 8th notes',
            why: 'The four-note cell adds a second pop with the middle finger, on the 5th above the octave (one string higher than the index pop). It is learned alone, then next to the index pop.',
            instr: '{G}' + POPHOW + 'First the middle-finger pop alone, once per click, on the {s5} (the 5th of the key). Then index and middle pops in turn, octave and 5th. Pass: 20 clean middle-finger pops without catching the {s6}, then the pairs in time.',
            watch: 'The middle finger snagging the index finger’s string.', simplify: 'Only the middle-finger pops.' }),
          T_('thump-quad-8', 'The four-note cell in 16ths: {key} ({guitar})', 'accurate-reps', { guitar: 8, strings: [8], downStrings: [5], plan: lvl => rep(lvl - 2, Q16), goal: 80, start: 50,
            why: 'Down, up, index, middle: four notes per beat, the cell that turns thumping into continuous 16ths.',
            instr: '{G}' + 'Thumb down and up on the {s8} root, index pop on the octave ({s6}), middle pop on the 5th ({s5}). One cell per beat. Pass: 8 bars of continuous 16ths with even dynamics.',
            watch: 'The two pops louder than the thumb notes.', simplify: '8th notes, two beats per cell.' }),
          T_('thump-quad-6', 'The four-note cell on the E, D and G strings: {key} ({guitar})', 'accurate-reps', { guitar: 6, strings: [6], plan: lvl => rep(lvl - 2, Q16), goal: 80, start: 50,
            why: 'The six-string version of the four-note cell, two strings up (thumb on the low E string, pops on the D and G strings): lighter strings, less weight, the same motion.',
            instr: G6 + 'Thumb down and up on the low E string root, index pop on its octave (D string), middle pop on the 5th (G string). Pass: 4 clean bars of the cell in 16ths.',
            watch: 'Popping the B string by mistake with the middle finger.', simplify: 'Two cells, then a beat of rest.' })], {
          concept: 'The four-note cell adds a second pop: thumb down and up on the root, the index pops the octave and the middle finger pops the 5th above it, one string higher.',
          why: 'Four notes per beat give continuous 16th notes, the rhythm most thumping grooves run on.',
          theory: ['Root, root, octave, 5th: the notes of a power chord, right over a major or minor chord with that root.', 'On a six-string the cell sits on the E, D and G strings.']
        }),
        S('thump-sets', 'Strings and roots', 'picking', 'Move the cells; aim the thumb.', [
          T_('thump-tri-move', 'The three-note cell moved from the E–D to the A–G strings: {key} ({guitar})', 'variable', { guitar: 6, plan: lvl => [...rep(2, { ...T8, strings: [6] }), ...rep(2, { ...T8, strings: [5] }), ...(lvl >= 5 ? rep(2, { ...T8, strings: [6] }) : [])], goal: 85, start: 52,
            why: 'Moving the same cell up a string set (thumb on the A string, pop on the G string) changes where the thumb rests and where the pop finger reaches, without changing the motion.',
            instr: G6 + 'Two bars with the thumb on the low E string, then two with the thumb on the A string (the same note name an octave or a 4th away, pop two strings up), and back if the tab continues. Pass: 4 bars with the change of string set in time.',
            watch: 'The thumb landing on the old string after the move.', simplify: 'One bar on each string set.' }),
          T_('thump-quad-roots', 'Thumb accuracy: the four-note cell on {chords}, {s8} and {s7} ({guitar})', 'interleaving', { guitar: 8, plan: lvl => [i, iv, i, iv, ...(lvl >= 5 ? [i, iv] : [])].map(off => ({ off, ...Q16, strings: off === iv ? [7] : [8] })), goal: 80, start: 50,
            why: 'The i and iv chords sit at the same fret on the two lowest strings, so the thumb alone changes the harmony: it must find the right string every bar while the pops move with it.',
            instr: '{G}' + 'Bars on the i chord: thumb on the {s8}. Bars on the iv: the same fret on the {s7}, pops one string higher too. ' + MUTE + 'Pass: 4 bars with the thumb always on the right string and the 16ths unbroken.',
            watch: 'The thumb hitting both low strings at the change.', simplify: 'Two bars on each chord.' }),
          T_('thump-tri-fretted', 'The three-note cell on a fretted root up the neck: {key} ({guitar})', 'accurate-reps', { guitar: 8, strings: [8], minF: 5, near: 9, plan: lvl => rep(lvl - 1, T8), goal: 85, start: 52,
            why: 'With a fretted root the fretting hand has to hold the note and mute the strings around it, and the thumb has to rest on the skipped {s7} between strokes without letting it ring.',
            instr: '{G}' + 'The cell on the root at the fret shown (5th fret or higher), the pop two strings up. Rest the thumb on the {s7} after each downstroke. Pass: 4 bars with the skipped string silent throughout.',
            watch: 'The {s7} ringing after the thumb lands on it.', simplify: 'Two bars.' })], {
          concept: 'A cell can sit on any string set and on any root: the thumb’s string sets the root, and the pops are always two and three strings higher.',
          why: 'Moving the cell between strings and roots is how thumping follows chord changes.',
          theory: ['On the two lowest strings the same fret gives the i (lowest string) and the iv (the next string), a 4th apart.', 'Thumb strings and pop strings move together.']
        }),
        S('thump-gears', 'Gears and displacement', 'rhythm', 'Triplets, 16ths, and cells across the beat.', [
          T_('thump-gears', 'Gear shift: a bar of triplet cells, a bar of four-note cells ({key}, {guitar})', 'interleaving', { guitar: 8, strings: [8], plan: lvl => Array.from({ length: lvl - 2 }, (_, n) => (n % 2 ? { ...Q16 } : { ...T8 })), goal: 75, start: 46,
            why: 'Three-note cells fall naturally into triplets, four-note cells into 16ths: switching every bar trains the hands to change the subdivision without dropping the beat.',
            instr: '{G}' + 'Odd bars: the three-note cell in 8th-note triplets. Even bars: the four-note cell in 16ths. Keep the downstroke on every beat. Pass: 4 bars alternating with no beat dropped at the change.',
            watch: 'Rushing into the 16ths.', simplify: 'Two bars of each before switching.' }),
          T_('thump-displace-6', 'Three-note cells as 16ths across the beat: {key} ({guitar})', 'variable', { guitar: 6, strings: [6], plan: lvl => [{ ...D16, beats: 12 }, ...(lvl >= 6 ? [{ ...D16, beats: 12, cont: true }] : [])], goal: 85, start: 52,
            why: 'Played as straight 16ths, a three-note cell starts in a different place in each beat (three against four) and only realigns every three beats: the rhythmic displacement heard in modern prog thumping.',
            instr: G6 + 'Loop the cell as continuous 16ths for three bars; the downstroke moves through the beat. Count 16ths ("1 e & a") and feel where each cell starts. Pass: 3 bars in time, the cell landing back on beat 1 of bar 4.',
            watch: 'Turning it back into triplets.', simplify: 'Half tempo, one bar at a time.' }),
          T_('thump-burst', 'Bursts: two beats of quarters, two beats of four-note cells ({key}, {guitar})', 'edge', { guitar: 8, strings: [8], plan: lvl => rep(lvl - 2, { ev: [['DU', 1], ['DUPQDUPQ', 0.25]] }), goal: 95, start: 58, unit: 'quarter notes and 16ths',
            why: 'Short bursts at a fast tempo with slow notes around them let the hands find the motion of the four-note cell at speed without fatigue.',
            instr: '{G}' + 'Thumb down and up as quarter notes on beats 1 and 2, then two four-note cells in 16ths on beats 3 and 4. Pass: 4 bursts in a row, clean and in time.',
            watch: 'Tensing up before the burst.', simplify: 'One cell in beat 3, rest in beat 4.' })], {
          concept: 'A three-note cell in 16ths starts on a different part of each beat and lines up again only every three beats; four-note cells line up every beat.',
          why: 'Changing gears and letting cells run across the beat are the rhythmic core of the style.',
          theory: ['3 notes against 4 sixteenths: the pattern repeats every 3 beats (12 sixteenths).', 'Keep counting the beat, not the cell.']
        }),
        S('thump-context', 'In a groove', 'improv', 'A groove and a scale.', [
          T_('thump-groove', 'A thumping groove over {chords} ({guitar})', 'transfer', { guitar: 8, strings: [8], plan: lvl => [...rep(lvl - 3, Q16), { ev: [['DUPQDUPQ', 0.25], ['.', 2]] }], goal: 90, start: 54,
            why: 'The four-note cell as a groove over a minor backing, with a stop at the end of the phrase: thumping as a rhythm part, not an exercise.',
            instr: '{G}' + MUTE + 'Loop the cell over the backing; in the last bar play two cells and stop dead for beats 3 and 4. Pass: 16 bars (four times round) in time with the sympathetic strings muted and the stop silent.',
            watch: 'Noise from the open strings in the stop.', simplify: 'Leave out the stop.' }),
          T_('thump-scale-shift', 'The three-note cell along the {key} scale on the {s8} ({guitar})', 'variable', { guitar: 8, strings: [8], plan: lvl => [0, 2, 3, 5, 7, 5, 3, 2].slice(0, lvl + 2).map(off => ({ off, ...T8 })), goal: 85, start: 52, backing: false,
            why: 'Double thumbing is practised through scales: here the cell moves up the natural minor scale along the low string, a degree per bar, and back down.',
            instr: '{G}' + 'One bar per degree: root, 2nd, ♭3rd, 4th, 5th and back down, the cell sliding along the {s8} (pops two strings up, two frets higher). Pass: 8 bars without losing the downstroke on the beat at the shifts.',
            watch: 'Late shifts: move the hand during the pop.', simplify: 'Only root, ♭3rd and 5th.' })], {
          concept: 'In music the cell becomes a groove: looped over a chord with stops, or moved along the low string through a scale.',
          why: 'A groove with space in it is what makes thumping sound like a rhythm section.',
          theory: ['Natural minor: R 2 ♭3 4 5 ♭6 ♭7.', 'A root-and-octave cell fits any chord built on that root.']
        })
      ], [4, 6]),
    stage('advanced', 'Speed, skips and odd groups',
      'Play bursts of sextuplets at 105 BPM and four-note cells through i – ♭VI – ♭VII at 115 BPM, thump with wide string skips, play five-note groups with a hammer-on from nowhere and three-note cells across chord changes, a 7/8 riff and a 16-bar study.', [
        S('thump-speed', 'Speed', 'picking', 'Bursts and changes at tempo.', [
          T_('thump-sext-burst', 'Sextuplet bursts: two cells in one beat ({key}, {guitar})', 'edge', { guitar: 8, strings: [8], plan: lvl => rep(8, { ev: lvl >= 8 ? [['DUPDUPDUPDUP', 1 / 6], ['.', 2]] : [['DUPDUP', 1 / 6], ['.', 3]] }), goal: 93, start: 57, unit: '16th-note sextuplets',
            why: 'Two three-note cells squeezed into one beat (sextuplets) with rests between: short bursts at a speed you can’t yet sustain, the safe way to raise the ceiling.',
            instr: '{G}' + 'One beat of sextuplets (two cells), then rest; at level 8, two beats. Stay loose in the rests. Pass: 8 bursts in a row, clean, with the rests silent.',
            watch: 'The second cell smearing: start the burst slower.', simplify: 'One cell as a triplet, then rest.' }),
          T_('thump-quad-changes', 'Four-note cells through {chords} at tempo ({guitar})', 'accurate-reps', { guitar: 8, plan: lvl => bars([[i, Q16], [bVI, Q16], [bVII, Q16], [i, Q16], ...(lvl >= 8 ? [[iv, Q16], [bVI, Q16], [bVII, Q16], [i, Q16]] : [])]), goal: 102, start: 62,
            why: 'Fast four-note cells that follow the chords: each change moves the thumb to a new root on the {s8} or {s7} while the 16ths continue.',
            instr: '{G}' + 'One bar per chord; the thumb goes to the nearest root ({s8} or {s7}) and the pops follow. Pass: 8 bars in time at the goal tempo without a gap at the changes.',
            watch: 'A hiccup on the first note after each change.', simplify: 'Two bars per chord.' })], {
          concept: 'Speed comes from short bursts above your comfortable tempo and from keeping the cells going through chord changes.',
          why: 'Thumping parts move between chords at full speed; the change can’t cost a note.',
          theory: ['Sextuplets: six notes per beat, two three-note cells.', 'i – ♭VI – ♭VII: the roots of the minor key’s 1st, 6th and 7th degrees.']
        }),
        S('thump-skip', 'Wide skips', 'picking', 'Pops far from the thumb.', [
          T_('thump-wide-6', 'Wide-gap cell: thumb on the low E string, pop on the B string ({key}, {guitar})', 'chunking', { guitar: 6, strings: [6], wide: true, plan: lvl => [...rep(lvl - 5, { seq: 'DP', step: 0.5 }), ...rep(2, T8)], goal: 84, start: 50,
            why: 'With the pop two octaves above the thumb (on the B string), the pop finger has to reach across four strings: a wide skip that gives a huge, open sound.',
            instr: G6 + 'First thumb and pop in turn, then the full cell: thumb down and up on the low E string, pop the root two octaves up on the B string. Pass: 4 measures of the cell with the strings between silent.',
            watch: 'Hitting the G string on the way to the B string.', simplify: 'Thumb and pop only.' }),
          T_('thump-wide-8', 'Wide-skip four-note cell: thumb on the {s8}, pops on the {s4} and {s3} ({key}, {guitar})', 'accurate-reps', { guitar: 8, strings: [8], wide: true, plan: lvl => rep(lvl - 4, Q16), goal: 84, start: 50,
            why: 'The four-note cell spread out: thumb on the {s8}, pops two octaves up and on the 5th above that, skipping three strings that must stay silent.',
            instr: '{G}' + MUTE + 'Thumb down and up on the {s8}, index pop on the {s4} (two octaves up), middle pop on the {s3}. Pass: 4 bars with no sympathetic ringing from the skipped strings.',
            watch: 'The skipped strings between the thumb and the pops ringing.', simplify: 'The three-note version.' })], {
          concept: 'Wide skips move the pops further from the thumb: two octaves up for the index, the 5th above that for the middle finger.',
          why: 'Wide intervals give the big, open sound of extended-range thumping, and they are the hardest part to keep clean.',
          theory: ['Two strings further means one more octave for the same notes.', 'Every skipped string needs a muting finger.']
        }),
        S('thump-groups', 'Odd groups', 'rhythm', 'Hammer-ons from nowhere; cells through changes.', [
          T_('thump-five', 'Five-note groups: the four-note cell plus a hammer-on from nowhere ({key}, {guitar})', 'chunking', { guitar: 8, strings: [8], plan: lvl => [{ ...F16, beats: lvl >= 8 ? 20 : 10 }], goal: 88, start: 53, unit: '16th notes in groups of five',
            why: 'A fretting-hand hammer-on from nowhere (the minor 3rd above the octave, on the middle-finger string at the root’s fret) turns the four-note cell into a five-note group that runs across the beat.',
            instr: '{G}' + 'Down, up, index, middle, then hammer the first finger onto the {s5} at the root’s fret without plucking it (the minor 3rd an octave up). In 16ths the group starts in a new place each beat. Pass: 4 bars of continuous groups in time.',
            watch: 'A weak hammer-on: hit the string firmly, straight down.', simplify: 'One group, then rest to the next beat.' }),
          T_('thump-tri16-changes', 'Three-note cells as 16ths through {chords} ({guitar})', 'variable', { guitar: 8, plan: lvl => [{ off: i, ...D16, beats: 12 }, { off: iv, ...D16, beats: 12, cont: true }, ...(lvl >= 8 ? [{ off: bVI, ...D16, beats: 12, cont: true, q: '' }] : [])], goal: 93, start: 55,
            why: 'The displaced three-note cell kept running through chord changes: the cell carries on across the change, so the chord moves in the middle of a cell.',
            instr: '{G}' + 'Three bars on the i, three on the iv (and three on the ♭VI): the cell continues as 16ths across each change. Pass: every downbeat felt and every change in time.',
            watch: 'Restarting the cell at each change.', simplify: 'Half tempo, one chord.' })], {
          concept: 'Hammer-ons from nowhere add fretting-hand notes to the cell, and odd-length groups (3 and 5) run across the beat and across the chord changes.',
          why: 'Groups that don’t match the beat are the rhythmic signature of modern prog thumping.',
          theory: ['A hammer-on from nowhere sounds a note with the fretting hand alone; here the ♭3 an octave up, so the group spells R 8 5 ♭3.', '5-note groups in 16ths realign every 5 beats.']
        }),
        S('thump-adv-music', 'Riffs and a study', 'improv', '7/8 and 16 bars.', [
          T_('thump-7-8', 'A 7/8 riff: a four-note and a three-note cell per bar ({chords}, {guitar})', 'transfer', { guitar: 8, beatsPerBar: 7, plan: lvl => [[i, ''], [i, ''], [bVI, ''], [bVII, '']].concat(lvl >= 8 ? [[iv, ''], [v, '']] : []).map(([off]) => ({ off, ev: [['DUPQ', 1], ['DUP', 1]], ...([bVI, bVII].includes(off) ? Mj : {}) })), goal: 150, start: 97, unit: '8th notes in 7/8 (click on every 8th)',
            why: 'One four-note cell plus one three-note cell makes seven 8th notes: a bar of 7/8, the odd meter of a lot of progressive metal.',
            instr: '{G}' + 'The click is on every 8th note, seven per bar. Each bar: down-up-index-middle, then down-up-index, on the bar’s chord. Count "1 2 3 4 1 2 3". Pass: 8 times through the riff in time.',
            watch: 'Adding an eighth 8th note at the end of the bar.', simplify: 'Two bars on one chord.' }),
          study('thump-prog-study', 'A 16-bar thumping study: cells, gears, shifts and a low pedal ({key})', STUDY16, 'transfer', { goal: 93, start: 55, minutes: 8,
            why: 'An original 16-bar study that uses the advanced stage: four-note cells, a gear change, three-note cells across the beat, position shifts and bars where the thumb holds the low root as a pedal while the pops follow the chords.',
            instr: '{G}' + 'Learn it four bars at a time. In the pedal bars the thumb stays on the low root while the pops play the ♭VI and ♭VII chords. Pass: all 16 bars at the goal tempo, then once with your own last four bars.',
            watch: 'The pedal bars: the thumb drifting to the new chord.', simplify: 'Bars 1–8.' })], {
          concept: 'Cells combined into riffs in odd meters and into a study with shifts, gear changes and a pedal.',
          why: 'Real parts mix the cells, the meters and the positions: this is where the technique becomes music.',
          theory: ['7/8 = 4 + 3 eighth notes.', 'A pedal point holds one note while the harmony above it changes.']
        })
      ], [7, 8]),
    stage('mastery', 'Your thumping',
      'Keep four-note cells even for 2 minutes at 110 BPM, play triplet cells in long runs at 120 BPM, mix 3- and 4-note cells through a groove and a minor 12-bar, and perform the 32-bar capstone study.', [
        S('thump-stamina', 'Stamina', 'picking', 'Long runs at tempo.', [
          T_('thump-marathon', 'The 16th-note marathon: four-note cells through {chords} ({guitar})', 'edge', { guitar: 8, plan: bars([[i, Q16], [bVI, Q16], [bIII, Q16], [bVII, Q16]]), goal: 89, start: 57, minutes: 10,
            why: 'Two minutes of continuous four-note cells: the test is the evenness of the last bar, not the first.',
            instr: '{G}' + 'Loop the four bars for two minutes. Keep the down and up strokes the same volume and the pops level. Pass: 2 full minutes at the goal tempo with even dynamics.',
            watch: 'The upstroke fading as the hand tires.', simplify: 'One minute.' }),
          T_('thump-tri-burn', 'Triplet runs: eight bars on, eight bars off ({chords}, {guitar})', 'accurate-reps', { guitar: 8, plan: bars([[i, T8], [i, T8], [iv, T8], [iv, T8], [bVI, T8], [bVII, T8], [i, T8], [i, T8]]), goal: 98, start: 60, minutes: 10,
            why: 'Fast three-note cells for eight bars, then eight bars of rest: long runs with recovery build endurance without tension.',
            instr: '{G}' + 'Play the eight bars, rest eight, five times. Pass: 5 cycles, every run clean.',
            watch: 'Tension creeping into the shoulder.', simplify: 'Four bars on, four off.' })], {
          concept: 'Endurance: long passages of cells at performance tempo, with rests to recover.',
          why: 'A real part lasts minutes; evenness at the end is the measure.',
          theory: ['Raise the tempo in small steps after clean runs.', 'Relax in the rests: tension is what limits endurance.']
        }),
        S('thump-improv', 'Over grooves and changes', 'improv', 'Mix the cells; follow the roots.', [
          T_('thump-juggle', 'Cell juggling: 3- and 4-note cells mixed over {chords} ({guitar})', 'transfer', { guitar: 8, plan: [[i, 0], [i, 1], [iv, 2], [iv, 3], [bVI, 0], [bVII, 1], [i, 2], [i, 3]].map(([off, n]) => ({ off, ev: [[['DUPQDUPDUPDUPDUP', 'DUPDUPQDUPDUPDUP', 'DUPDUPDUPQDUPDUP', 'DUPQDUPQDUPQDUPQ'][n], 0.25]], ...([bVI, bVII].includes(off) ? Mj : {}) })), goal: 81, start: 49, minutes: 8,
            why: 'A written groove that mixes four-note and three-note cells in a different order every bar (4+3+3+3+3, then other orders), as a model for making your own.',
            instr: '{G}' + 'Learn the eight bars, then improvise eight bars of your own over the same chords, choosing the order of 3- and 4-note cells as you go. Pass: the written groove in time, then 16 bars of your own with no beat dropped.',
            watch: 'Losing the downbeat when a cell order changes.', simplify: 'Only bars 1–4.' }),
          T_('thump-12bar', 'The three-note cell through a minor 12-bar blues ({key}, {guitar})', 'transfer', { guitar: 6, plan: [i, i, i, i, iv, iv, i, i, v, iv, i, v].map(off => ({ off, ...T8 })), goal: 85, start: 50, minutes: 6,
            why: 'The cell follows the roots of a minor blues: the thumb moves to each new root and the groove never stops.',
            instr: G6 + 'One cell per beat; at each change the thumb goes to the nearest root on the low E or A string. Pass: the 12 bars twice through without a break at the changes.',
            watch: 'Looking for the root after the change instead of before it.', simplify: 'Quarter-note roots on the changes.' })], {
          concept: 'Improvising with the cells: choosing their order over a groove, and moving them through the changes of a progression.',
          why: 'Mastery is making the parts up: the cells become a vocabulary.',
          theory: ['Minor 12-bar: i (4 bars), iv (2), i (2), v, iv, i, v.', '4 + 3 + 3 + 3 + 3 = 16 sixteenths: one bar.']
        }),
        S('thump-capstone', 'Capstone study', 'improv', 'An original prog study.', [
          study('thump-etude-a', 'Capstone study, part A: bars 1–16 ({key})', CAP_A, 'chunking', { goal: 89, start: 54, minutes: 10,
            why: 'The first half of an original 32-bar study: four-note cells, five-note groups with hammer-ons, pedal bars, gear changes and three-note cells across the beat, in 16 bars.',
            instr: '{G}' + 'Learn it in four-bar chunks, then join them. Pass: the 16 bars at the goal tempo in sync with the backing.',
            watch: 'Speeding up in the 16th bars after the triplet bars.', simplify: 'Bars 1–8.' }),
          study('thump-etude-full', 'Capstone study: the full 32 bars ({key})', [...CAP_A, ...CAP_B], 'transfer', { goal: 89, start: 54, minutes: 15,
            why: 'The whole study: part A, then part B with wide skips, five-note groups, three bars of displaced cells, pedal bars and an ending. It uses every skill of the path.',
            instr: '{G}' + 'Play part A, then part B. Then write your own 8-bar part B using the same tools. Pass: the 32 bars at the goal tempo, then your own part once.',
            watch: 'Part B’s wide skips: prepare the pop finger early.', simplify: 'Part B at the start tempo.' })], {
          concept: 'An original study that combines every thumping skill: cells of 3, 4 and 5, gears, skips, pedal bars and changes.',
          why: 'A complete piece shows the technique working as music from start to end.',
          theory: ['Section A on i – ♭VI – ♭VII – iv – v; section B adds wide skips and displacement.', 'Learn in chunks; perform as a whole.']
        })
      ], [9, 10])
  ]
});
