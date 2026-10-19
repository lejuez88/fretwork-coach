// String-skipped arpeggios: triads spread over two strings with one string skipped between them,
// alternate picked: the wide, angular arpeggio sound Paul Gilbert uses instead of sweeping.
//
// Concept-first (CONTENT.md): the model is a triad (from the chord's notes, so any chord in any key)
// laid out as a cell of four notes: two consecutive chord tones on a lower string, the next two on a
// string two higher (t0 t1 | t2 t3, with t3 an octave above t0). The inversion picks which chord tone
// starts the cell; string pair, inversion and voice leading (the nearest cell for the next chord) are
// independent choices, and the two-octave version stacks three strings (5, 3, 1). The composer
// `skipArp(c, spec)` builds an exercise from chords × string pair (adjacent or skipped) × inversion ×
// note value; every bar holds one chord.
import { OPEN, N, nameOf, minorKey, make, chordInfo, mod12, slug, fromSeq, S, stage, entry, M, targetGuide } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const unitName = step => UNIT.get(step) || '8th notes';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const INV = ['root position', '1st inversion', '2nd inversion'];
/** Chord progressions of a minor key, as chord names. */
export const PROGS = {
  rock: k => [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'],
  diatonic: k => [nameOf(k) + 'm', nameOf(k + 2) + '°', nameOf(k + 3), nameOf(k + 5) + 'm', nameOf(k + 7) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'],
  harmonic: k => [nameOf(k) + 'm', nameOf(k + 5) + 'm', nameOf(k + 7), nameOf(k) + 'm'],
  epic: k => [nameOf(k) + 'm', nameOf(k + 3), nameOf(k + 10), nameOf(k + 8)],
  /** Minor and major on the same root, then on the 4th: the 3rd is the only note that changes. */
  qualities: k => [nameOf(k) + 'm', nameOf(k), nameOf(k + 5) + 'm', nameOf(k + 5)],
  /** The minor key's seventh chords around the cycle (i7 iv7 ♭VII7 ♭IIImaj7 ♭VImaj7 ii7♭5 V7 i7). */
  sevenths: k => [nameOf(k) + 'm7', nameOf(k + 5) + 'm7', nameOf(k + 10) + '7', nameOf(k + 3) + 'maj7', nameOf(k + 8) + 'maj7', nameOf(k + 2) + 'm7b5', nameOf(k + 7) + '7', nameOf(k) + 'm7'],
  /** Three inversions of i, three of iv, then V and i: for the inversion ladder. */
  ladder: k => [nameOf(k) + 'm', nameOf(k) + 'm', nameOf(k) + 'm', nameOf(k + 5) + 'm', nameOf(k + 5) + 'm', nameOf(k + 5) + 'm', nameOf(k + 7), nameOf(k) + 'm']
};
/** Chord tones ascending from a pitch (for a seventh chord the cell is R 3 5 7: four different tones): the first n chord-tone pitches at or above `from`. */
function tonesFrom(pcs, from, n) { const out = []; for (let p = from; out.length < n; p++) if (pcs.includes(mod12(p))) out.push(p); return out; }
/**
 * One cell: strings (low to high, e.g. [4, 2], [3, 2] or [5, 3, 1]) get two consecutive chord tones
 * each, starting from chord tone `inv` (0 root, 1 3rd, 2 5th) on the lowest string, near fret `near`.
 * Returns [[string, fret], …] ascending, or null when it doesn't fit (frets 0–20, 5-fret span per string).
 */
export function skipCell(name, strings, inv = 0, near = 6) {
  const ch = chordInfo(name); if (!ch) return null;
  const startPc = ch.pcs[inv % 3], lo = strings[0]; let best = null;
  for (let f = 1; f <= 17; f++) {
    if (mod12(pitch(lo, f)) !== startPc) continue;
    const ps = tonesFrom(ch.pcs, pitch(lo, f), strings.length * 2);
    const cell = ps.map((p, i) => [strings[Math.floor(i / 2)], p - OPEN[strings[Math.floor(i / 2)]]]);
    if (cell.some(([, fr]) => fr < 0 || fr > 20)) continue;
    if (strings.some((s, i) => Math.abs(cell[2 * i + 1][1] - cell[2 * i][1]) > 6)) continue;
    const frets = cell.map(x => x[1]); if (Math.max(...frets) - Math.min(...frets) > 8) continue;
    const d = Math.abs(frets.reduce((a, b) => a + b, 0) / frets.length - near);
    if (!best || d < best.d) best = { cell, d };
  }
  return best ? best.cell : null;
}
/** The nearest cell of any inversion to the last position (voice leading). */
function leadCell(name, strings, near) {
  let best = null;
  for (let inv = 0; inv < 3; inv++) { const c = skipCell(name, strings, inv, near); if (!c) continue; const avg = c.reduce((a, x) => a + x[1], 0) / c.length, d = Math.abs(avg - near); if (!best || d < best.d) best = { c, d, inv }; }
  return best;
}
/** Up and down the cell, as a cycle: t0 t1 t2 t3 t2 t1 (or the six-note version on three strings). */
const cycleOf = cell => [...cell, ...cell.slice(1, -1).reverse()];
/** The plan of the random lesson: one chord name per bar, from random keys. */
export function skipPlan(c) {
  const r = rng(911 + (c.lvl || 9)), out = [];
  for (let i = 0; i < 8; i++) { const k = Math.floor(r() * 12), q = Math.floor(r() * 3); out.push(q === 0 ? nameOf(k) : q === 1 ? nameOf(k) + 'm' : nameOf(k) + '°'); }
  return out;
}

/* ------------------------------- The composer ------------------------------- */
/**
 * One exercise from a spec: { id, name ('{key}', '{chords}', '{strings}'), method, prog (a PROGS
 * name) or chords (names) or keys (offsets: the i chord in each), strings, stringPlan (one string set
 * per bar, cycling), inv (0–2 or 'lead'), invs (one inversion per bar), order ('down': start the cycle
 * from the top note), step, goal, dl, why, instr, watch, simplify }. One chord per bar; the cycle
 * repeats to fill the bar.
 */
export function skipArp(c, spec) {
  const k = minorKey(c);
  const chords = spec.chords || (spec.keys ? spec.keys.map(o => nameOf(k + o) + 'm') : PROGS[spec.prog || 'rock'](k));
  const strings = spec.strings || [4, 2], step = spec.step || 1 / 6, per = Math.round(4 / step);
  const notes = [], used = []; let near = spec.near || 6;
  for (const [bar, nm] of chords.entries()) {
    let cell; const strs = spec.stringPlan ? spec.stringPlan[bar % spec.stringPlan.length] : strings;
    if (spec.invs) cell = skipCell(nm, strs, spec.invs[bar % spec.invs.length], near);
    else if (spec.inv === 'lead') { const l = leadCell(nm, strs, near); cell = l && l.c; } else cell = skipCell(nm, strs, spec.inv || 0, near);
    if (!cell) return null;
    near = spec.inv === 'lead' || spec.invs ? cell.reduce((a, x) => a + x[1], 0) / cell.length : near;
    const cyc = spec.order === 'down' ? cycleOf(cell.slice().reverse()) : cycleOf(cell);
    for (let i = 0; i < per; i++) { const [s, f] = cyc[i % cyc.length]; notes.push(N(s, f, bar * 4 + i * step, step)); }
    used.push(chordInfo(nm).name);
  }
  const strName = spec.stringPlan ? 'changing string pairs' : strings.map(String).join(' and ').replace(/ and (\d) and /, ', $1 and ');
  const fill = t => t.replace('{key}', `${nameOf(k)} minor`).replace('{chords}', used.join(' – ')).replace('{strings}', spec.stringPlan ? strName : `strings ${strName}`).replace('{inv}', INV[spec.inv] || 'the nearest inversion');
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'picking', method: spec.method, unit: unitName(step), goal: spec.goal || 96, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'alternate',
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, chords: used, backing: spec.backing === false ? undefined : used, tab: { notes }
  });
}
const K = (id, name, method, opts) => c => skipArp(c, { id, name, method, ...opts });

/* --------------------------- Existing lesson (kept id) --------------------------- */
/** String-skipped arpeggios on strings 4 and 2 (Paul Gilbert style), over Am – F – C – G. */
export function pgSkipArps(c, { chords = ['Am', 'F', 'C', 'G'] } = {}) {
  const seq = [], used = []; let near = 7;
  for (const name of chords) {
    const cell = skipCell(name, [4, 2], 0, near); if (!cell) continue;
    near = cell[0][1];
    for (let r = 0; r < 4; r++) seq.push(...cycleOf(cell));
    used.push(chordInfo(name).name);
  }
  if (!seq.length) return null;
  return make(c, {
    id: `pg-skip-${slug(used.join(''))}`, name: `String-skipped arpeggios: ${used.join(' – ')}`, domain: 'picking', method: 'variable', unit: '16th-note sextuplets', goal: 92, minutes: 6, dl: 2, picking: 'alternate',
    why: 'Skipping a string turns a plain triad into wide intervals: the angular arpeggio sound Paul Gilbert uses instead of sweeping, played with alternate picking.',
    instr: 'Each chord: root and 3rd on string 4, skip string 3, 5th and octave on string 2, back down. Four times per bar, one chord per bar. Alternate pick every note; mute string 3 with the underside of the fretting fingers. Pass: the four chords clean at the goal tempo.',
    watch: 'Clipping string 3 on the way over.', simplify: '16th notes and one chord.', chords: used, backing: used, tab: { notes: fromSeq(seq, 1 / 6) }
  });
}

/* ---------------------------- Foundations: the jump ---------------------------- */
/** The pick-hand jump alone: the cell's lowest note and the note across the skip, back and forth, one chord per bar. */
export function skipJump(c) {
  const k = minorKey(c), chords = PROGS.rock(k), notes = [], used = []; const step = (c.lvl || 1) <= 1 ? 1 : 0.5;
  for (const [bar, nm] of chords.entries()) {
    const cell = skipCell(nm, [4, 2], 0, 6); if (!cell) return null;
    const pair = [cell[0], cell[2]];
    for (let i = 0; i < Math.round(4 / step); i++) { const [s, f] = pair[i % 2]; notes.push(N(s, f, bar * 4 + i * step, step)); }
    used.push(chordInfo(nm).name);
  }
  return make(c, {
    id: 'skip-jump', name: `The jump alone: root on the D string, 5th on the B string (${used.join(' – ')})`, domain: 'picking', method: 'accurate-reps',
    unit: unitName(step), goal: 84, minutes: 4, dl: 0, picking: 'alternate', chords: used, backing: used,
    why: 'Before the whole cell, the picking hand needs the one new motion: crossing over a string without touching it. Two notes, a string apart, back and forth, is that motion on its own.',
    instr: 'Each bar: the chord’s root on the D string, then its 5th on the B string, back and forth. Downstroke on the D string, upstroke on the B. Keep the pick close to the strings: clear the G string, no higher. Rest the picking hand lightly on the bridge. Pass: 8 bars in a row with the G string silent.',
    watch: 'Lifting the pick high over the skipped string: the motion gets slow and inaccurate.', simplify: 'One chord, quarter notes.', tab: { notes }
  });
}

/* ------------------------------ Capstone ------------------------------ */
/** An original 8-bar study: adjacent, skipped, inversions, two octaves, the landing (capstone). */
export function skipEtude(c) {
  const k = minorKey(c), prog = PROGS.rock(k), harm = PROGS.harmonic(k), notes = [];
  const bar = (nm, strings, inv, b, step, near) => { const cell = inv === 'lead' ? (leadCell(nm, strings, near) || {}).c : skipCell(nm, strings, inv, near); if (!cell) return null; const cyc = cycleOf(cell); for (let i = 0; i < Math.round(4 / step); i++) { const [s, f] = cyc[i % cyc.length]; notes.push(N(s, f, b * 4 + i * step, step)); } return cell; };
  const plan = [[prog[0], [3, 2], 0, 1 / 3], [prog[1], [4, 2], 0, 1 / 3], [prog[2], [4, 2], 'lead', 0.25], [prog[3], [3, 1], 'lead', 0.25], [harm[1], [5, 3, 1], 0, 1 / 6], [harm[2], [5, 3, 1], 0, 1 / 6], [prog[0], [5, 3, 1], 0, 1 / 6]];
  let near = 6;
  for (const [b, [nm, strings, inv, step]] of plan.entries()) { const cell = bar(nm, strings, inv, b, step, near); if (!cell) return null; near = cell.reduce((a, x) => a + x[1], 0) / cell.length; }
  const last = skipCell(prog[0], [4, 2], 0, 7); if (!last) return null;
  notes.push(N(last[0][0], last[0][1], 28, 4, '~'));
  const chords = [...plan.map(p => chordInfo(p[0]).name), chordInfo(prog[0]).name];
  return make(c, {
    id: 'skip-capstone-etude', name: `Capstone study: an 8-bar string-skipping arpeggio piece (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'triplets, 16ths and sextuplets', goal: 92, minutes: 8, dl: 1, picking: 'alternate', chords, backing: chords,
    why: 'An original piece that builds the arpeggios the way the path did: a triad on two adjacent strings, the first skip, voice-led inversions, then two-octave arpeggios through a harmonic-minor cadence and a held landing.',
    instr: 'One chord per bar; the note value gets faster as the shapes get bigger (triplets, 16ths, sextuplets). Learn it two bars at a time, muting the skipped strings throughout. Then write your own 8 bars over the same chords. Pass: the study at the goal tempo with no stops, then your own version once.',
    watch: 'Skipped strings ringing in the two-octave bars: mute with both hands.', simplify: 'Bars 1–4.', tab: { notes }
  });
}
/** A random chord (major, minor or diminished, any root) every bar, on strings 4 and 2 (interleaving). */
export function skipRandom(c) {
  const plan = skipPlan(c);
  return skipArp(c, { id: 'skip-random', name: 'Random access: a new triad every bar, skipped strings', method: 'interleaving', chords: plan, strings: [4, 2], inv: 'lead', step: 1 / 6, goal: 92, dl: 1,
    why: 'At mastery level any triad should appear under the fingers as a skipped-string shape the moment you read its name: major, minor or diminished, any root.',
    instr: 'The chords are {chords}. Read the names: find the nearest shape (any inversion) on strings 4 and 2 and keep the sextuplets going. Pass: all 8 bars at the goal tempo without a stop.',
    watch: 'Jumping across the neck: look for the nearest inversion.', simplify: 'The first four bars.' });
}

/* --------------------------------- The path --------------------------------- */
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'skipArps', kind: 'technique', title: 'String-skipped arpeggios', domain: 'picking',
  re: /string.?skip/,
  aliases: ['string skipping arpeggios', 'skipped-string triads'],
  pedagogy: {
    date: '2026-10-19',
    summary: 'Taught from the picking hand outward: the skip itself slowly with a metronome (small pick motion, light anchor, the previous note muted by loosening the finger), then triads in place of sweeps (closed shapes first, then spread over a skipped string), all three inversions of major and minor (plus diminished) learned slowly and then linked, the triads of the key connected over progressions by the nearest shape, then wider and two-string skips, seventh-chord arpeggios, sextuplet sequences at speed, and finally the shapes used in lines and your own ideas.',
    sequence: [
      { id: 'closed', tier: 'foundations', step: 'The triad as a closed shape first', how: 'The triad within an octave on neighbouring strings, then the same notes spread wider than an octave (open voicing).', skills: ['skip-adjacent'], source: 3 },
      { id: 'jump', tier: 'foundations', step: 'The skip itself, slowly', how: 'The pick-hand motion over a skipped string, slowly with a metronome: a small motion, the pick at an angle, the hand lightly anchored; then the triad with a string skipped.', skills: ['skip-first'], source: 0 },
      { id: 'qualities', tier: 'foundations', step: 'Major and minor shapes, both directions', how: 'Major and minor triads on one root, ascending and descending.', skills: ['skip-hear'], source: 3 },
      { id: 'music1', tier: 'foundations', step: 'A progression arpeggiated', how: 'One triad per chord of a progression, placed where it sounds melodic.', skills: ['skip-first-music'], source: 4 },
      { id: 'key', tier: 'intermediate', step: 'Every triad of the key', how: 'The triads within the scale, in order, on more than one string pair.', skills: ['skip-cycle'], source: 4 },
      { id: 'inversions', tier: 'intermediate', step: 'Inversions and the nearest shape', how: 'Three inversions of each triad, practised slowly, then the closest one chosen for each chord.', skills: ['skip-inversions'], source: 3 },
      { id: 'clean', tier: 'intermediate', step: 'Clean, even notes on every string pair', how: 'Loosen the finger on the previous note so it stops; equal volume; the same cells on other string pairs.', skills: ['skip-control'], source: 0 },
      { id: 'music2', tier: 'intermediate', step: 'Over a progression', how: 'The arpeggios as a part over chord changes, so the chords can be heard from the arpeggios alone.', skills: ['skip-music'], source: 4 },
      { id: 'speed', tier: 'advanced', step: 'Sextuplet arpeggio sequences', how: 'Skipped triads as sextuplets through a progression, including inversions.', skills: ['skip-speed'], source: 2 },
      { id: 'wide', tier: 'advanced', step: 'Two skips and other keys', how: 'Arpeggios that skip two strings, and the same shapes in other keys.', skills: ['skip-wide'], source: 1 },
      { id: 'sevenths', tier: 'advanced', step: 'Seventh-chord arpeggios; linked inversions', how: 'Harmonised seventh arpeggios of the key; the inversions of one chord linked into a longer sequence.', skills: ['skip-sevenths'], source: 2 },
      { id: 'music3', tier: 'advanced', step: 'Minor to major: the regal cadence', how: 'Minor triads resolving to a major chord, the shapes memorised before your own phrasing.', skills: ['skip-adv-music'], source: 5 },
      { id: 'tempo', tier: 'mastery', step: 'Performance tempo', how: 'With a metronome, the tempo raised gradually and tracked over days and weeks.', skills: ['skip-performance'], source: 1 },
      { id: 'any', tier: 'mastery', step: 'Any triad, anywhere', how: 'The triads known in all twelve keys all over the neck.', skills: ['skip-random'], source: 4 },
      { id: 'own', tier: 'mastery', step: 'Your own lines', how: 'The shapes used in linear lines, with notes moved to other octaves so they don’t sound like exercises.', skills: ['skip-voice'], source: 3 }
    ],
    drills: ['The pick jump over a skipped string, two notes back and forth', 'Root-position triads on two strings with one string skipped', 'Major and minor shapes on one root', 'Three inversions of a triad, then linked', 'Every triad of the key with the nearest shape', 'Two-octave arpeggios skipping two strings', 'Seventh-chord arpeggios of the key', 'Sextuplet arpeggio sequences through a progression'],
    mistakes: ['Lifting the pick high over the skipped string', 'Notes ringing together like a strummed chord', 'The skipped string sounding', 'Tension in the picking hand', 'Jumping to root position for every chord instead of the nearest shape', 'Rushing before the skip is accurate'],
    sources: [
      { title: 'Making the Jump: How to Master the Art of String Skipping', author: 'Patrick Brennan (GuitarPlayer)', url: 'https://www.guitarplayer.com/lessons/making-the-jump-how-to-master-the-art-of-string-skipping' },
      { title: 'Learn string skipping', author: 'Jenna Scaramanga (Guitar World)', url: 'https://www.guitarworld.com/lessons/string-skipping-lead-guitar' },
      { title: 'Cram Session: The Ups and Downs of String Skipping', author: 'Jamie Humphries (Premier Guitar)', url: 'https://www.premierguitar.com/articles/24206-cram-session-the-ups-and-downs-of-string-skipping' },
      { title: 'The Thinking Shredder: Open Heart and Open Voice', author: 'German Schauss (Premier Guitar)', url: 'https://www.premierguitar.com/articles/The_Thinking_Shredder_Open_Heart_and_Open_Voice' },
      { title: 'Triad Arpeggios Applied', author: 'Mike Campese (Premier Guitar)', url: 'https://www.premierguitar.com/lessons/triad-arpeggios-applied' },
      { title: 'Shred Your Enthusiasm: Aristocratic Arpeggios', author: 'Paul Gilbert (Premier Guitar)', url: 'https://www.premierguitar.com/shred-your-enthusiasm-aristocratic-arpeggios' }
    ]
  },
  summary: 'Triads spread over two strings with one skipped between, alternate picked: from a triad on two adjacent strings to voice-led inversions and two-octave arpeggios through progressions at speed.',
  prereqs: ['alternatePicking'],
  sources: ['https://www.guitarplayer.com/lessons/making-the-jump-how-to-master-the-art-of-string-skipping', 'https://www.guitarworld.com/lessons/string-skipping-lead-guitar', 'https://www.premierguitar.com/articles/24206-cram-session-the-ups-and-downs-of-string-skipping', 'https://www.premierguitar.com/articles/The_Thinking_Shredder_Open_Heart_and_Open_Voice', 'https://www.premierguitar.com/lessons/triad-arpeggios-applied', 'https://www.premierguitar.com/shred-your-enthusiasm-aristocratic-arpeggios'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'One triad, then the skip',
      'Play a triad as root–3rd on one string and 5th–octave on the next at 90 BPM in 8ths, jump the pick over a string 8 bars clean, play the cell with a string skipped and the middle string silent, play minor and major on one root, start the cell from the top as well as the bottom, and arpeggiate i–♭VI–♭VII–i in triplets with every note clean.', [
        S('skip-adjacent', 'On two strings first', 'picking', 'The triad as a four-note cell on neighbouring strings.', [
          K('skip-adjacent', 'Triads on two neighbouring strings: {chords}', 'chunking', { prog: 'rock', strings: [3, 2], step: 0.5, goal: 96, why: 'Before skipping, learn the cell where it is easiest: root and 3rd on the G string, 5th and octave on the B string. Four notes, two per string, up and back.', instr: 'One chord per bar: root and 3rd on the G string, 5th and octave on the B, back down. Alternate picking, slowly with the click. Pass: the four bars clean twice.', watch: 'Letting notes ring into each other: lift each finger as the next note sounds.', simplify: 'One chord.' }),
          K('skip-adjacent-inv', 'Triads on two strings from the 3rd: {chords}', 'accurate-reps', { prog: 'rock', strings: [3, 2], inv: 1, step: 0.5, goal: 92, why: 'Every triad has three shapes, from the root, the 3rd and the 5th. The first inversion starts the cell on the 3rd: the same three notes in a new order and a new spot on the neck.', instr: 'The cell starts on each chord’s 3rd: 3rd and 5th on the G string, root and 3rd on the B. Alternate picking, slowly. Pass: the four bars clean twice in a row.', watch: 'Defaulting to the root.', simplify: 'Root position (previous lesson).' })],
          ST('A triad played as a four-note cell: two chord tones on one string, the next two on the string above, the top note an octave above the bottom one. On neighbouring strings it is a closed shape, the easiest place to learn it.', 'The skipped-string arpeggio is this same cell with its upper half moved one string higher, so the closed version comes first.', ['Root position: root and 3rd on the lower string, 5th and octave on the upper.', 'First inversion starts on the 3rd: 3rd and 5th, then root and 3rd.', 'Lift each finger as the next note sounds so the notes don’t ring together.'])),
        S('skip-first', 'The skip', 'picking', 'The jump alone, then the same cell with a string skipped.', [c => skipJump(c),
          K('skip-first', 'The first skip: {chords} on {strings}', 'accurate-reps', { prog: 'rock', strings: [4, 2], step: 0.5, goal: 96, why: 'Moving the upper half of the cell up a string leaves a gap: the intervals get wider and the pick has to jump a string. Slowly, with only clean repetitions counted.', instr: 'Root and 3rd on the D string, skip the G string, 5th and octave on the B string, back down. Alternate pick every note. Count only clean bars. Pass: 8 clean bars in a row.', watch: 'Hitting the G string on the way over.', simplify: 'Quarter notes.' }),
          K('skip-mute', 'Silence in the gap: {chords} on {strings}', 'external-focus', { prog: 'rock', strings: [5, 3], step: 1 / 3, goal: 92, why: 'A skipped-string arpeggio only sounds right if the skipped string stays silent and each note stops when the next starts. Listening for that silence is the skill.', instr: 'Play the cells on the A and G strings as triplets. Listen, don’t look: only one note should sound at a time, and the D string never. Use the underside of the fretting fingers and the side of the picking hand to mute. Pass: four bars where you hear no extra string, twice.', watch: 'Rushing: muting needs time at first.', simplify: '8th notes.' })],
          ST('Moving the upper two notes of the cell up one string leaves a string unplayed in the middle. The intervals get wider (the cell spreads past an octave) and the pick has to cross the skipped string.', 'Skipping instead of sweeping gives the arpeggio a wide, separated sound with alternate picking.', ['Keep the pick close to the strings: clear the skipped string, no higher.', 'A light rest of the picking hand on the bridge helps judge the distance.', 'Mute the skipped string with the underside of the fretting fingers.'])),
        S('skip-hear', 'Major and minor shapes; the cell from the top', 'fretboard', 'Minor and major on one root; the cell started from the top note.', [
          K('skip-qualities', 'Minor and major on one root: {chords}', 'accurate-reps', { prog: 'qualities', strings: [3, 2], step: 0.5, goal: 88, why: 'Minor and major triads on the same root differ by one note, the 3rd, a fret apart. Learning both shapes side by side shows that the rest of the cell stays put.', instr: 'Each bar one cell on the G and B strings: minor, then major on the same root, then the same on the 4th. Only the second note (the 3rd) moves, one fret. Pass: 4 bars clean twice, with the backing chord and the 3rd agreeing every bar.', watch: 'Playing the minor shape over the major chord: listen to the clash and fix it.', simplify: 'Only the first two chords.' }),
          K('skip-down-first', 'From the top: skipped cells starting on the octave ({chords})', 'accurate-reps', { prog: 'rock', strings: [4, 2], order: 'down', step: 0.5, goal: 92, why: 'Starting from the top note turns every skip around: you now cross from the B string down to the D string first. Good arpeggio players can start a shape from either end.', instr: 'Each bar: octave and 5th on the B string, skip the G string, 3rd and root on the D string, then back up. Alternate pick starting with a downstroke. Count only clean bars. Pass: 8 clean bars in a row.', watch: 'Catching the G string on the way down.', simplify: 'Quarter notes.' })],
          ST('Minor and major triads on the same root differ only in the 3rd, one fret apart; the cell can also start from its top note and come down.', 'Knowing both qualities and both directions lets the cell follow any chord in a progression.', ['Minor 3rd: three frets above the root; major 3rd: four.', 'Starting from the top turns every skip around: the pick crosses downward first.'])),
        S('skip-first-music', 'First music', 'improv', 'A progression, arpeggiated.', [
          K('skip-prog-slow', 'Arpeggiating a progression: {chords}', 'transfer', { prog: 'epic', strings: [4, 2], inv: 'lead', step: 1 / 3, goal: 92, why: 'Arpeggiated, a progression becomes a part you can play in a band: here every chord takes the nearest cell to the last, so the hand barely moves.', instr: 'One chord per bar, the nearest shape each time (some start on the 3rd or 5th). Then make up your own rhythm with the same shapes over the backing. Pass: four bars clean, then four of your own.', watch: 'Jumping to root position every time.', simplify: 'Two chords.' }),
          c => targetGuide(c, { prog: 'minorRock', scale: 'minor' })],
          ST('Arpeggiated, a progression becomes a part: one cell per chord, each the nearest shape to the last.', 'Choosing the nearest shape keeps the hand in one area of the neck and the line smooth.', ['i–♭III–♭VII–♭VI in a minor key are all minor or major triads.', 'The nearest shape may start on the root, the 3rd or the 5th.']))
      ], [1, 3]),
    stage('intermediate', 'Every chord, every string pair',
      'Play every diatonic triad of the minor key skipped on strings 4–2 and 5–3 in 16ths at 100 BPM, play all three inversions and voice-lead a progression without jumping, switch string pairs every bar, and arpeggiate a progression in triplets at 110.', [
        S('skip-cycle', 'Every chord of the key', 'picking', 'The diatonic triads on two string pairs.', [
          K('skip-diatonic', 'All seven triads of {key}, skipped: {chords}', 'variable', { prog: 'diatonic', strings: [4, 2], step: 0.25, goal: 100, why: 'Minor, diminished, major: the cell changes shape with the chord quality. Playing every triad of the key teaches all three shapes in their musical order.', instr: 'One triad per bar up the key and back to i, on the D and B strings. Each quality has its own cell: minor, diminished (the 5th one fret lower) and major. Pass: the cycle clean at the goal tempo.', watch: 'The diminished chord: its 5th is one fret lower than you expect.', simplify: '8th notes.' }),
          K('skip-53', 'Skipped triads on the A and G strings: {chords}', 'variable', { prog: 'diatonic', strings: [5, 3], step: 0.25, goal: 100, why: 'The same cells a string lower: the shape changes because the gap between the A and G strings is wider than between the D and B.', instr: 'The seven triads on strings 5 and 3. Pass: clean at the goal tempo.', watch: 'Using the D–B fingering here.', simplify: '8th notes.' })],
          ST('Each scale note of the key carries a triad: in a minor key i, ii°, ♭III, iv, v, ♭VI, ♭VII. The skipped cell changes with the quality: minor, major or diminished.', 'Playing every triad of the key in order teaches all three cell shapes in their musical context.', ['A diminished triad has a minor 3rd and a ♭5: its 5th is one fret lower than a minor triad’s.', 'The gap between the A and G strings (a minor 7th) is a fret wider than between the D and B (a major 6th), so the shapes differ.'])),
        S('skip-inversions', 'Inversions and voice leading', 'fretboard', 'Three shapes per chord, the nearest one each time.', [
          K('skip-inv2', 'Second inversion (from the 5th) on the G and high e: {chords}', 'variable', { prog: 'rock', strings: [3, 1], inv: 2, step: 0.25, goal: 100, why: 'Starting on the 5th gives the brightest, most open version of the cell, and on the top strings it sits right where melodies are.', instr: 'Each cell starts on the chord’s 5th on the G string: 5th and root there, 3rd and 5th on the high e. Mute the B string. Pass: clean at the goal tempo.', watch: 'Losing which note is the root.', simplify: '8th notes.' }),
          K('skip-lead', 'Voice-led arpeggios: {chords}, the nearest shape', 'interleaving', { prog: 'diatonic', strings: [4, 2], inv: 'lead', step: 0.25, goal: 100, why: 'Good arpeggio playing moves as little as possible between chords: each chord’s nearest inversion keeps the line smooth and in one area of the neck.', instr: 'For each chord, use whichever inversion is closest to the last one, so the hand stays in one area of the neck. Pass: the cycle clean, staying within about five frets.', watch: 'Drifting up the neck.', simplify: 'The first four chords.' })],
          ST('Every triad has three skipped shapes, starting from the root, the 3rd or the 5th. Voice leading picks, for each chord, the shape closest to the last one.', 'Inversions are what let arpeggios follow a progression without jumping up and down the neck.', ['Second inversion starts on the 5th: 5th and root, then 3rd and 5th.', 'The G and high e strings are a major 6th apart, like the D and B, so the shapes match.'])),
        S('skip-control', 'Inversions, sound and string pairs', 'picking', 'First inversions on a new pair, an even sound, and changing string pairs.', [
          K('skip-names-53', 'First inversions through every triad of {key}, strings 5 and 3', 'variable', { prog: 'diatonic', strings: [5, 3], inv: 1, step: 1 / 3, goal: 96, why: 'Every triad of the key in its first inversion, on the lower string pair: a new set of shapes for all three chord qualities, starting from the 3rd.', instr: 'One triad per bar: 3rd and 5th on the A string, skip the D, root and 3rd on the G, then back down. Triplets. Pass: all eight bars clean at the goal tempo.', watch: 'Starting from the root out of habit.', simplify: 'The first four chords.' }),
          K('skip-even', 'One note at a time: even skipped arpeggios on the G and high e ({chords})', 'external-focus', { prog: 'epic', strings: [3, 1], inv: 'lead', step: 0.25, goal: 100, why: 'At speed, skipped arpeggios smear when notes ring into each other or the far string lands louder. Listening for single, equal notes is the fastest route to a clean sound.', instr: 'Play the cells in 16ths. Listen: each note stops as the next starts (loosen the finger on the last note rather than lifting it away), the B string never sounds, and the notes across the skip are as loud as the ones beside them. Record one pass and listen back. Pass: a recorded pass where every note is separate and even.', watch: 'Fretting fingers left down so the notes ring together like a chord.', simplify: '8th notes.' }),
          K('skip-pair-switch', 'Switching string pairs every bar: {chords}', 'interleaving', { prog: 'rock', stringPlan: [[4, 2], [5, 3], [3, 1], [4, 2]], inv: 'lead', step: 0.25, goal: 96, why: 'Changing the string pair every bar means the hand has to find each chord on a new pair, with a new gap, instead of grooving one shape.', instr: 'Bar 1 on strings 4 and 2, bar 2 on 5 and 3, bar 3 on 3 and 1, bar 4 on 4 and 2, each time the nearest inversion. Pass: the four bars clean twice without stopping.', watch: 'Using the D–B fingering on the A–G pair (the gap is different).', simplify: 'Only pairs 4–2 and 5–3.' }),
          K('skip-down-16', 'Top-down cells through {chords}, 16ths', 'variable', { prog: 'harmonic', strings: [4, 2], order: 'down', inv: 'lead', step: 0.25, goal: 100, why: 'The descending-first cell through the harmonic-minor cadence: the same chords as before, a different motion and a darker sound.', instr: 'Start every cell on its top note and go down across the skip, then back up. One chord per bar, nearest shapes. Pass: clean at the goal tempo.', watch: 'The V chord’s 3rd, a fret higher than natural minor.', simplify: 'Triplets.' })],
          ST('Clean skipped arpeggios need one note at a time: each note stopped as the next starts, the skipped string silent, and every note equally loud. The same cells on other string pairs test the shapes.', 'Notes ringing together turn an arpeggio into a strummed chord; uneven volume makes it sound picked rather than flowing.', ['Loosen the finger on the previous note instead of lifting it away: it mutes as it goes.', 'First inversions on the A and G strings start on the 3rd.', 'Each string pair has its own gap, so the cell shape changes with the pair.'])),
        S('skip-music', 'In music', 'improv', 'A progression arpeggiated, and a solo.', [
          K('skip-prog', 'Skipped arpeggios through {chords}', 'transfer', { prog: 'rock', strings: [4, 2], inv: 'lead', step: 1 / 3, goal: 104, why: 'The progression as an arpeggiated part, the nearest shapes, a little faster.', instr: 'One chord per bar, nearest shapes, triplets. Then improvise a melody that starts from each bar’s first arpeggio note. Pass: four bars clean, then four of your own.', watch: 'Accents falling apart at the chord change.', simplify: '8th notes.' }),
          M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minor' }])],
          ST('The same cells as a part over a progression, then a melody that starts from each bar’s first arpeggio note.', 'Arpeggios are most useful when you can hear the chords from them alone.', ['Start the melody on the first note of each bar’s cell: it is always a chord tone.']))
      ], [4, 6]),
    stage('advanced', 'Speed and two octaves',
      'Play the skipped cells through a progression as sextuplets at 100 BPM, play two-octave skipped arpeggios on strings 5, 3 and 1 in 16ths, skipped seventh chords around the key, all three inversions of a chord linked up the neck, change key every bar, and arpeggiate a harmonic-minor i–iv–V–i.', [
        S('skip-speed', 'Sextuplets', 'picking', 'One cell per beat.', [c => pgSkipArps(c),
          K('skip-prog-fast', 'Voice-led skipped arpeggios as sextuplets: {chords}', 'variable', { prog: 'epic', strings: [5, 3], inv: 'lead', step: 1 / 6, goal: 92, why: 'One cell per beat on the lower string pair, nearest shapes: the motion at speed with the fretting hand moving as little as possible.', instr: 'Sextuplets, one chord per bar, nearest shapes on the A and G strings. Pass: clean at the goal tempo.', watch: 'Tension in the picking hand on the skips.', simplify: '16ths.' })],
          ST('At speed the cell is played one per beat as sextuplets: up the four-note cell and back down its middle notes, six notes per beat.', 'This is the fast, separated arpeggio sound used in place of sweeping.', ['Six notes per beat: t0 t1 t2 t3 t2 t1.', 'Downstroke on the beat with alternate picking.'])),
        S('skip-wide', 'Two octaves and keys', 'picking', 'Three strings, two skips; any key.', [
          K('skip-two-oct', 'Two-octave skipped arpeggios on strings 5, 3 and 1: {chords}', 'variable', { prog: 'rock', strings: [5, 3, 1], step: 0.25, goal: 96, why: 'Two chord tones on each of three strings, skipping two strings: a two-octave arpeggio with no sweeping, the big Gilbert-style arpeggio sound.', instr: 'Up the A, G and high e strings (two notes each), back down. Mute the D and B strings. Pass: clean at the goal tempo.', watch: 'Uneven spacing on the skips.', simplify: '8th notes.' }),
          K('skip-keys', 'The i chord, skipped, in four keys', 'interleaving', { keys: [0, 5, 10, 3], strings: [4, 2], inv: 'lead', step: 1 / 6, goal: 92, why: 'The cell is built from the chord, so it is right in any key: changing key every bar trains you to find it instantly.', instr: 'The chords are {chords}, one per bar, nearest shapes; each new key is a 4th up. Pass: all four without stopping.', watch: 'Stopping to look for the next root.', simplify: 'Two keys.' })],
          ST('Two chord tones on each of three strings with two strings skipped (A, G, high e) make a two-octave arpeggio without sweeping. The same cell moved around the cycle of fourths changes key every bar.', 'The two-octave version is the big, wide arpeggio sound; changing key trains finding the cell anywhere.', ['Strings 5, 3 and 1 skip the D and the B.', 'Up a 4th each bar: A, D, G, C minor.'])),
        S('skip-sevenths', 'Sevenths and inversions', 'fretboard', 'Four-note chords skipped; every inversion linked up the neck.', [
          K('skip-sevenths', 'Skipped seventh chords around the minor key: {chords}', 'variable', { prog: 'sevenths', strings: [4, 2], inv: 'lead', step: 0.25, goal: 96, why: 'A seventh chord has four different tones, so the skipped cell becomes root, 3rd, 5th and 7th with no doubled note: the jazz-fusion version of the Gilbert arpeggio, and the sound of every chord in the key.', instr: 'One chord per bar, the nearest shape: two chord tones on the D string, skip the G, the next two on the B. The chord types change every bar (m7, 7, maj7, m7♭5), so the top note is the 7th, not the octave. Pass: the eight bars clean at the goal tempo.', watch: 'Playing the triad’s octave instead of the 7th on the top note.', simplify: 'The first four chords, 8th notes.' }),
          K('skip-inv-ladder', 'Linking the inversions: i and iv in all three ({chords})', 'variable', { prog: 'ladder', strings: [4, 2], invs: [0, 1, 2, 0, 1, 2, 0, 0], step: 1 / 6, goal: 92, why: 'Every triad has three skipped shapes, from the root, the 3rd and the 5th. Linking all three in a row climbs the neck on one chord and joins the shapes into one sequence.', instr: 'Bars 1–3: the i chord from the root, then from the 3rd, then from the 5th, each shape higher up the neck; bars 4–6 the same for iv; then V and i. Shift during the last note of each bar. Pass: all eight bars clean at the goal tempo.', watch: 'Repeating the previous inversion instead of moving to the next.', simplify: '16ths, bars 1–3 only.' })],
          ST('A seventh chord has four different tones, so its skipped cell has no doubled note: root, 3rd, 5th, 7th. All three triad inversions can also be linked up the neck on one chord.', 'Seventh arpeggios give the fusion version of the sound; linked inversions turn one chord into a long climbing line.', ['In a minor key: i m7, iv m7, ♭VII7, ♭IIImaj7, ♭VImaj7, ii m7♭5, V7.', 'Each inversion of a triad sits higher on the neck than the last.'])),
        S('skip-adv-music', 'Neoclassical arpeggios', 'improv', 'Harmonic minor i–iv–V–i.', [
          K('skip-harmonic', 'Harmonic-minor arpeggios: {chords}', 'transfer', { prog: 'harmonic', strings: [5, 3, 1], step: 1 / 6, goal: 88, why: 'The major V chord of the harmonic minor makes this the classic neoclassical cadence; as two-octave skipped arpeggios it sounds huge.', instr: 'One chord per bar, two-octave cells, sextuplets. Then improvise with the harmonic minor over the same backing. Pass: four bars clean, then four of your own.', watch: 'The V chord’s 3rd (the raised 7th of the key): it is a fret higher than in natural minor.', simplify: '16ths.' }),
          c => targetGuide(c, { prog: 'iiVIminor', scale: 'harmonicMinor' })],
          ST('The harmonic minor raises the 7th, so the V chord becomes major: i–iv–V–i. As two-octave skipped arpeggios this is the neoclassical cadence.', 'Minor to major on the V gives the regal, classical sound of shred arpeggios.', ['In A harmonic minor the V chord is E major (E G♯ B); G♯ is the raised 7th.']))
      ], [7, 8]),
    stage('mastery', 'Any chord, at speed, your own',
      'Play two-octave skipped arpeggios through a progression as sextuplets at about 105 BPM, every diatonic triad on the top strings as sextuplets at 110, any triad on demand, and perform your own 8-bar arpeggio piece.', [
        S('skip-performance', 'Performance tempo', 'picking', 'Big arpeggios at speed.', [
          K('skip-two-oct-fast', 'Two-octave skipped arpeggios at performance tempo: {chords}', 'edge', { prog: 'epic', strings: [5, 3, 1], inv: 'lead', step: 1 / 6, goal: 88, why: 'The full two-octave arpeggio through a progression at tempo: the showpiece version.', instr: 'Tempo ladder: start below the goal, add a few BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Forearm tension: shake out between passes.', simplify: '16ths.' }),
          K('skip-diatonic-fast', 'All seven triads skipped on the G and high e, sextuplets: {chords}', 'edge', { prog: 'diatonic', strings: [3, 1], inv: 'lead', step: 1 / 6, goal: 92, why: 'Every chord quality at speed on the top strings, where the arpeggio sound cuts through a band.', instr: 'Nearest shapes, one triad per bar, tempo ladder to the goal. Pass: clean at the goal tempo.', watch: 'The diminished bar.', simplify: '16ths.' })],
          ST('Performance tempo means the two-octave cells and every triad of the key as sextuplets at speed, reached a few BPM at a time.', 'Even, separated notes at speed are the goal, not the number.', ['Add 3–5 BPM after two clean passes.', 'Shake out tension between runs.'])),
        S('skip-random', 'Any triad, any time', 'fretboard', 'No warning.', [c => skipRandom(c), c => targetGuide(c, { prog: 'progMinor', scale: 'minor', name: 'Solo built on arpeggios: start every phrase from a skipped-string cell' })],
          ST('Any triad, any root, any quality: find the nearest skipped shape from the chord name alone.', 'In a song the arpeggio has to follow whatever chord comes next.', ['Major, minor and diminished each have their own cell.', 'Look for the nearest inversion, not the root position.'])),
        S('skip-voice', 'Your own voice', 'improv', 'A study that uses everything, then your version.', [c => skipEtude(c), c => targetGuide(c, { prog: 'andalusian', scale: 'harmonicMinor', name: 'Andalusian cadence: arpeggios and harmonic-minor lines' })],
          ST('The capstone study builds the arpeggios the way the path did: adjacent strings, the skip, inversions, two octaves, a held landing.', 'Mastery means using the shapes in your own lines, not only as patterns.', ['Move single notes of a cell up or down an octave for your own version.']))
      ], [9, 10])
  ]
});
