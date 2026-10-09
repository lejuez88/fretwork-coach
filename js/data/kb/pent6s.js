// Pentatonic in sixes and other sequences: the pentatonic played in groups of 3, 4, 5 and 6, the
// vocabulary of Paul Gilbert's (and Zakk Wylde's, and Eric Johnson's) fast pentatonic runs.
//
// Concept-first (CONTENT.md): the model is the pentatonic as an ordered note list (one of the five
// boxes, or the diagonal three-notes-per-string shape) and the grouping rule: n notes up from each
// note in turn, then n down from each note. Groups of n against a pulse of m notes per beat give the
// accent pattern (6 in sextuplets: one group per beat; 5 or 6 in 16ths: the accent drifts). The
// composer `seqRun(c, spec)` builds an exercise from shape × boxes × strings × group size ×
// direction × note value × keys.
import { OPEN, N, nameOf, minorKey, make, fromSeq, pentBox, pent3nps, byString, mod12, S, stage, entry, M, targetGuide } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const unitName = step => UNIT.get(step) || '8th notes';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** The grouping rule: n notes up from each note (up), n down from each note (down), or both. */
export function grouped(list, n, dir = 'both') {
  const up = [], dn = [], r = list.slice().reverse();
  for (let i = 0; i + n <= list.length; i++) up.push(...list.slice(i, i + n));
  for (let i = 0; i + n <= r.length; i++) dn.push(...r.slice(i, i + n));
  return dir === 'up' ? up : dir === 'down' ? dn : [...up, ...dn];
}
/** A pentatonic shape as [string, fret] pairs, low to high: box 1–5 or the diagonal. */
export function shapeOf(k, shape = 'box', box = 1) {
  const n = shape === 'diag' ? pent3nps(k) : pentBox(k, box);
  return n ? n.map(x => [x.s, x.f]) : null;
}
const endOf = notes => Math.max(...notes.map(n => n.t + n.d));
function landOnRoot(notes, k, list) {
  const root = list.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || list[0];
  const t = endOf(notes), bar = Math.ceil((t + 1) / 4) * 4;
  notes.push(N(root[0], root[1], t, bar - t));
  return notes;
}
/** The plan of the random lesson: one { k, box, n } per bar. */
export function p6Plan(c) {
  const r = rng(503 + (c.lvl || 9)), out = [];
  for (let bar = 0; bar < 8; bar++) out.push({ k: Math.floor(r() * 12), box: 1 + Math.floor(r() * 5) });
  return out;
}

/* ------------------------------- The composer ------------------------------- */
/**
 * One sequence exercise from a spec: { id, name ('{key}'), method, shape ('box'|'diag'), boxes,
 * strings, n (group size), dir ('both'|'up'|'down'), alt (alternate the direction box by box), reps,
 * keys (offsets, one block each), step, goal, dl, why, instr, watch, simplify }.
 */
export function seqRun(c, spec) {
  const k0 = minorKey(c), seq = []; let last = null;
  for (const off of spec.keys || [0]) {
    const k = mod12(k0 + off);
    (spec.boxes || [1]).forEach((b, i) => {
      let list = shapeOf(k, spec.shape || 'box', b); if (!list) { seq.length = 0; seq.push(null); return; }
      if (spec.strings) list = list.filter(([s]) => spec.strings.includes(s));
      const dir = spec.alt ? (i % 2 ? 'down' : 'up') : spec.dir || 'both';
      const g = grouped(list, spec.n || 6, dir); for (let r = 0; r < (spec.reps || 1); r++) seq.push(...g); last = { k, list };
    });
  }
  if (!seq.length || seq.includes(null) || !last) return null;
  const step = spec.step || 1 / 6;
  const notes = landOnRoot(fromSeq(seq.slice(0, 300), step), last.k, last.list);
  return make(c, {
    id: spec.id, name: spec.name.replace('{key}', `${nameOf(k0)} minor`), domain: spec.domain || 'picking', method: spec.method, unit: unitName(step), goal: spec.goal || 100, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'alternate',
    why: spec.why, instr: spec.instr, watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
const R = (id, name, method, opts) => c => seqRun(c, { id, name, method, ...opts });

/* --------------------------- Existing lesson (kept id) --------------------------- */
/** The pentatonic box in groups of six, up and down (also used by the pentatonic path). */
export function pgPent6s(c) {
  const key = minorKey(c), pts = pentBox(key, 1); if (!pts) return null;
  const list = pts.map(p => [p.s, p.f]), upSeq = grouped(list, 6, 'up'), dnSeq = grouped(list, 6, 'down');
  const notes = fromSeq(upSeq, 1 / 6).concat(fromSeq(dnSeq, 1 / 6, 8));
  return make(c, {
    id: 'pg-pent-6s', name: `Pentatonic in groups of six (${nameOf(key)} minor)`, domain: 'picking', method: 'variable', unit: '16th-note sextuplets', goal: 92, minutes: 5, dl: 1, picking: 'alternate',
    why: 'Sequencing the pentatonic in sixes is a Paul Gilbert staple: each beat starts one note further along, so the line climbs steadily while every beat begins on a downstroke.',
    instr: 'Six notes up from the first note, then six up from the second, and so on to the top; then the same coming down. One group per beat, alternate picked. Pass: up and down clean at the goal tempo.',
    watch: 'Losing the downstroke at the start of each beat.', simplify: 'Groups of four in 16ths.', tab: { notes }
  });
}

/* ------------------------------ Music: generators ------------------------------ */
/** A phrase: two groups of six down from the top of the box, then a bend and the root (use in music). */
export function seqPhrase(c, { fast = false } = {}) {
  const k = minorKey(c), list = shapeOf(k, 'box', 1), B = byString(pentBox(k, 1)); if (!list || !B[3]) return null;
  const step = fast ? 1 / 6 : 1 / 3, groups = grouped(list, 6, 'down'), notes = []; let t = 0;
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  for (let bar = 0; bar < 2; bar++) {
    t = bar * 8;
    const take = groups.slice(bar * 12, bar * 12 + (fast ? 24 : 12));
    take.forEach(([s, f]) => { notes.push(N(s, f, t, step)); t += step; });
    notes.push(N(3, B[3][1], t, 1, 'b', { bendTo: B[3][1] + 2 })); t += 1;
    const root = list.find(([s, f]) => s <= 4 && mod12(pitch(s, f) - k) === 0) || list[0];
    notes.push(N(root[0], root[1], t, Math.max(1, bar * 8 + 8 - t), '~'));
  }
  return make(c, {
    id: fast ? 'p6-phrase-fast' : 'p6-phrase', name: `Sixes in a phrase: down the box into a bend${fast ? ', at speed' : ''} (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: unitName(step), goal: fast ? 88 : 92, minutes: 5, dl: fast ? 1 : 0, backing: chords, chords,
    why: 'A sequence is only a lick when it goes somewhere: here the groups of six fall down the box and launch a bend into the 5th, then rest on the root.',
    instr: 'Play the groups of six descending, then bend the G-string 4th up a whole step and land on the root with vibrato. The second bar continues the sequence from where the first stopped. Then make your own ending after the sequence. Pass: both bars in time with the bend in tune, then four phrases of your own.',
    watch: 'Running out of breath before the bend: the bend lands on the beat.', simplify: 'One group, then the bend.', tab: { notes }
  });
}
/** A random key and box every bar, groups of six up from the bottom (interleaving). */
export function p6Random(c) {
  const plan = p6Plan(c), notes = [], names = []; let t = 0;
  for (const { k, box } of plan) {
    const list = shapeOf(k, 'box', box); if (!list) return null;
    names.push(`${nameOf(k)}m box ${box}`);
    grouped(list, 6, 'up').slice(0, 18).forEach(([s, f], i) => notes.push(N(s, f, t + i / 6, 1 / 6)));
    const l = list[7]; notes.push(N(l[0], l[1], t + 3, 1)); t += 4;
  }
  return make(c, {
    id: 'p6-random', name: 'Random access: groups of six in a new key and box every bar', domain: 'picking', method: 'interleaving',
    unit: '16th-note sextuplets', goal: 92, minutes: 5, dl: 1, picking: 'alternate',
    why: 'At mastery level the sequence should run from any box in any key the moment you need it.',
    instr: `${names.join(' → ')}. Three groups of six up from the bottom of the box, then a beat to find the next one. Read only the names. Pass: all 8 bars from memory at the goal tempo.`,
    watch: 'Starting the group from the wrong note of a new box.', simplify: 'The first four bars.', tab: { notes }
  });
}
/** An original 8-bar study on pentatonic sequences: threes, fours, sixes up, sixes down, fives, the landing (capstone). */
export function p6Etude(c) {
  const k = minorKey(c), b1 = shapeOf(k, 'box', 1), b2 = shapeOf(k, 'box', 2), dg = shapeOf(k, 'diag'); if (!b1 || !b2 || !dg) return null;
  const notes = []; const put = (seq, step, t0, beats) => { let t = t0; for (const [s, f] of seq) { if (t >= t0 + beats - 1e-6) break; notes.push(N(s, f, t, step)); t += step; } };
  put(grouped(b1, 3, 'up'), 1 / 3, 0, 4);          // bar 1: threes
  put(grouped(b1, 4, 'down'), 0.25, 4, 4);         // bar 2: fours down
  put(grouped(b2, 6, 'up'), 1 / 6, 8, 8);          // bars 3–4: sixes up box 2
  put(grouped(dg, 6, 'down'), 1 / 6, 16, 8);       // bars 5–6: sixes down the diagonal
  put(grouped(b1, 5, 'down'), 0.25, 24, 4);        // bar 7: fives in 16ths
  const root = b1.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || b1[0];
  notes.push(N(root[0], root[1], 28, 4, '~'));
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: 'p6-capstone-etude', name: `Capstone study: an 8-bar pentatonic sequence piece (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'triplets, 16ths and sextuplets', goal: 92, minutes: 8, dl: 1, picking: 'alternate', backing: [...chords, ...chords], chords,
    why: 'An original piece that climbs through the groupings of the path: threes, fours, sixes up box 2, sixes down the diagonal across the neck, fives against the beat, and a held landing.',
    instr: 'Learn it two bars at a time. The note value changes with the grouping, the click does not: triplets, 16ths, sextuplets, 16ths. Then write your own 8 bars with the same plan. Pass: the study at the goal tempo with no stops, then your own version once.',
    watch: 'Bar 7: five-note groups in 16ths drift across the beat; count the beats, not the groups.', simplify: 'Bars 1–4.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
export default entry({
  id: 'pent6s', kind: 'technique', title: 'Pentatonic in sixes and other sequences', domain: 'picking',
  re: /pentatonic in (6'?s|sixes)|groups? of (6|six)|pentatonic sequences?|sequenc(e|ing) (the )?pentatonic/,
  aliases: ['pentatonic sequences', 'pentatonic in groups of six'],
  summary: 'The pentatonic in groups of 3, 4, 5 and 6, from slow triplets in one box to sextuplets across the neck in any key: the sequences behind fast rock runs.',
  prereqs: ['pentatonic', 'alternatePicking'],
  sources: ['https://hubguitar.com/fretboard/pentatonic-scale-sequences', 'https://hubguitar.com/fretboard/pentatonic-scale-sequences-2', 'https://guitarlessons.com/guitar-lessons/lead-guitar/pentatonic-scale-sequencing-6s/', 'https://www.premierguitar.com/articles/23477-cram-session-alternate-picking'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Groups of three, four and six, slowly',
      'Play box 1 in groups of 3 and 4 in 8ths at 90 BPM, groups of six as triplets on the top strings and through the box with no lost group, sing each group of three before playing it, play groups of 4 from memory, and finish a phrase with a sequence into a bend.', [
        S('p6-small', 'Small groups first', 'picking', 'Threes and fours in 8th notes.', [
          R('p6-threes', 'Box 1 of {key} pentatonic in groups of 3, 8th notes', 'accurate-reps', { n: 3, step: 0.5, goal: 96, why: 'A sequence is a rule (n notes up from each note in turn), and threes are its simplest form: short enough to hear each group as a unit.', instr: 'Three notes up from each note of the box, to the top; then three down from each note. Accent the first of each group. Pass: up and down 4 times clean.', watch: 'Losing your place at the string change.', simplify: 'Ascending only.' }),
          R('p6-fours', 'Box 1 of {key} pentatonic in groups of 4, 8th notes', 'accurate-reps', { n: 4, step: 0.5, goal: 96, why: 'Groups of four line up with the beat once you play them as 16ths later; learning them slowly now fixes the order of notes.', instr: 'Four up from each note, then four down. Say the first note of each group out loud. Pass: up and down 4 times clean.', watch: 'Skipping a group in the middle.', simplify: 'The top four strings.' })]),
        S('p6-sixes-slow', 'Sixes, slowly', 'picking', 'Groups of six as triplets: two beats per group.', [
          R('p6-sixes-top', 'Groups of six on the top three strings, triplets ({key})', 'chunking', { n: 6, strings: [3, 2, 1], reps: 4, step: 1 / 3, goal: 92, why: 'Six notes cover three strings of the box: learning the sequence on just three strings first keeps the pattern small enough to hold in your head.', instr: 'Six notes up strings 3–1 and six back down, as triplets (one group = two beats), four times. Pass: 4 times clean in a row.', watch: 'Rushing the last note of each group.', simplify: '8th notes.' }),
          R('p6-sixes-slow', 'Box 1 of {key} pentatonic in groups of six, triplets', 'accurate-reps', { n: 6, step: 1 / 3, goal: 96, why: 'The full box in sixes at a slow tempo: the exact notes of the fast version, with time to get every one right.', instr: 'Six up from each note of the box, then six down from each note. Every group starts on a downstroke. Count only clean repetitions. Pass: 3 clean in a row.', watch: 'Starting a group on an upstroke.', simplify: 'The top three strings (previous lesson).' })]),
        S('p6-hear', 'Hear it and recall it', 'ear', 'Sing a group before you play it; play the groups from memory.', [
          R('p6-threes-sing', 'Sing, then play: groups of 3 on the top strings ({key})', 'audiation', { n: 3, dir: 'up', strings: [3, 2, 1], step: 1, goal: 76, why: 'A sequence is a melody with a rule. Singing each three-note group before playing it makes the rule audible, so later you can hear where a fast run is going instead of only feeling it.', instr: 'Play the first group, then sing the next group (any syllable, roughly in pitch) before you play it, and so on up the top three strings of box 1. Quarter notes, slow click. Pass: the whole climb with every group sung first, twice.', watch: 'Singing after playing: the voice leads, the hand follows.', simplify: 'The B and high e strings only.' }),
          R('p6-fours-recall', 'From memory: groups of 4 on the top four strings ({key})', 'retrieval', { n: 4, strings: [4, 3, 2, 1], step: 0.5, goal: 96, why: 'Recalling the sequence without the tab (by knowing the rule and the box) is what makes it available in a solo. Saying each group’s first note forces the recall.', instr: 'Play it once reading the tab, then cover it. Say the first note of each group of four (its string and fret) just before you play it, up and back down. Pass: twice through from memory with no wrong group.', watch: 'Going on autopilot and skipping a group.', simplify: 'Ascending only.' })]),
        S('p6-first-music', 'First music', 'improv', 'A sequence that ends in a phrase.', [c => seqPhrase(c), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'Sixes in time, and fives',
      'Play box 1 in groups of six as sextuplets at 90 BPM up and down, the descending sixes alone, groups of 5, 3 and 6 in 16ths keeping the click, sixes in box 3 from memory, sixes in box 2 and alternating boxes 1 and 2, and use a fast sequence in a phrase.', [
        S('p6-sixes', 'Sixes in sextuplets and in 16ths', 'picking', 'One group per beat, then the same groups against four.', [c => pgPent6s(c),
          R('p6-sixes-16', 'Sixes as 16ths: the group across the beat ({key}, box 1)', 'variable', { n: 6, step: 0.25, goal: 100, why: 'The same groups of six played as 16ths no longer match the beat: each group lasts a beat and a half, so every other group starts on the “and”. Same notes, a completely different rhythm and feel.', instr: 'Six up from each note, then six down, in steady 16ths. Every other group begins halfway through a beat; keep picking strictly and let the click hold you. Pass: up and down at the goal tempo without drifting into sextuplets.', watch: 'Pausing at the end of a group to line it up with the beat.', simplify: '8th notes, counting the groups out loud.' }),
          R('p6-sixes-down', 'Descending sixes only ({key}, box 1)', 'variable', { n: 6, dir: 'down', step: 1 / 6, goal: 96, why: 'The descending half is where most players lose the sequence: practised alone, it becomes the cascading run of rock solos.', instr: 'Six down from each note, from the top of the box to the bottom, one group per beat. Pass: 4 clean in a row at the goal tempo.', watch: 'The group shrinking to five as you rush.', simplify: 'Triplets.' })]),
        S('p6-other', 'Fives, threes against four, and other boxes', 'picking', 'The same rule with a different group and shape; accents you can hear.', [
          R('p6-threes-16', 'Threes against four: box 1 in groups of 3 as 16ths, accented ({key})', 'external-focus', { n: 3, step: 0.25, goal: 100, why: 'Played as 16ths, groups of three form a three-against-four cross-rhythm: the accent lands on a different part of the beat until it comes round again after three beats. It only works if you can hear the accents over the click.', instr: 'Accent the first note of each group of three, keep everything else light, in steady 16ths. Listen for the accents forming their own slower pulse against the click. Pass: up and down at the goal tempo with the accent pattern clearly audible.', watch: 'Slipping into triplets so the accents line up with the beat.', simplify: '8th notes first.' }),
          R('p6-fives', 'Box 1 of {key} pentatonic in groups of 5, as 16ths', 'variable', { n: 5, step: 0.25, goal: 100, why: 'Five notes against four per beat: the accent lands somewhere new every beat and comes back after five beats. It sounds unpredictable, which is the point.', instr: 'Five up from each note, then five down, in steady 16ths. Accent the first of each group lightly and keep the click as your anchor. Pass: 4 clean at the goal tempo.', watch: 'Turning it into quintuplets (five per beat) by accident.', simplify: 'Play it as quintuplets first: one group per beat.' }),
          R('p6-sixes-box2', 'Box 2 of {key} pentatonic in groups of six', 'variable', { boxes: [2], n: 6, step: 1 / 6, goal: 92, why: 'The same sequence on a new shape: the notes change, the rule doesn’t.', instr: 'Six up from each note of box 2, then six down. Pass: 4 clean at the goal tempo.', watch: 'The B-string shift in box 2.', simplify: 'Triplets.' })]),
        S('p6-connect', 'Joining boxes', 'fretboard', 'Up one box, down the next; any box from memory.', [
          R('p6-box3-recall', 'From memory: sixes in box 3 ({key})', 'retrieval', { boxes: [3], n: 6, step: 1 / 6, goal: 88, why: 'Box 3 is where the sequence first feels unfamiliar. Building it from the rule (six up from each note) instead of reading frets is the real test that you own the sequence.', instr: 'Play box 3 up and down once as a plain scale, then cover the tab and play it in sixes, up and down, from memory. Pass: twice through from memory at the goal tempo.', watch: 'Losing the box shape on the B string.', simplify: 'Triplets.' }),
          R('p6-boxes12', 'Sixes up box 1, down box 2 ({key})', 'interleaving', { boxes: [1, 2, 1, 2], alt: true, n: 6, step: 1 / 6, goal: 88, why: 'Changing box on every pass makes the sequence a map of the neck instead of a single shape.', instr: 'Sixes ascending through box 1, then descending through box 2, then again. Pass: the whole cycle twice without stopping.', watch: 'Starting the box-2 descent from the wrong note: it starts at the top of box 2.', simplify: 'Triplets.' })]),
        S('p6-music', 'In a phrase', 'improv', 'The sequence at speed, and a solo.', [c => seqPhrase(c, { fast: true }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent' })])
      ], [4, 6]),
    stage('advanced', 'Across the neck and in every key',
      'Play sixes and fours on the diagonal shape across two boxes, sixes through all five boxes without stopping, sixes in four keys and in boxes called out of order, shape a descent with a crescendo, and drop sequences into a blues solo.', [
        S('p6-diag', 'The diagonal shape', 'picking', 'Sequences that travel along the neck.', [
          R('p6-sixes-diag', 'Sixes on the diagonal {key} pentatonic', 'variable', { shape: 'diag', n: 6, step: 1 / 6, goal: 92, why: 'On the three-notes-per-string shape, groups of six travel along the neck as well as across it: the long, sweeping runs of shred-era pentatonic playing.', instr: 'Six up from each note of the diagonal shape, then six down. Slide or shift the index finger on the position changes. Pass: 4 clean at the goal tempo.', watch: 'Uneven timing on the stretches.', simplify: 'Triplets.' }),
          R('p6-fours-diag', 'Fours on the diagonal {key} pentatonic', 'variable', { shape: 'diag', n: 4, step: 0.25, goal: 104, why: 'Groups of four in 16ths on the diagonal: a downstroke on every beat and a steady climb across two boxes.', instr: 'Four up from each note, then four down, in 16ths. Pass: 4 clean at the goal tempo.', watch: 'Losing the 16th grid on the shifts.', simplify: '8th notes.' })]),
        S('p6-everywhere', 'Every box, every key', 'fretboard', 'The sequence anywhere.', [
          R('p6-five-boxes', 'Sixes through all five boxes ({key})', 'variable', { boxes: [1, 2, 3, 4, 5], alt: true, n: 6, step: 1 / 6, goal: 88, why: 'Up one box, down the next, through all five: the complete map of the sequence on the neck.', instr: 'Ascending sixes in box 1, descending in box 2, ascending in box 3, and so on to box 5. Pass: all five boxes without stopping.', watch: 'Hesitating on boxes 4 and 5.', simplify: 'Boxes 1–3.' }),
          R('p6-keys', 'Sixes in four keys around the cycle of fourths', 'interleaving', { keys: [0, 5, 10, 3], n: 6, dir: 'up', strings: [4, 3, 2, 1], step: 1 / 6, goal: 92, why: 'A sequence is a rule, not a memorised string of frets: it should start in any key at once.', instr: 'Sixes ascending on the top four strings of box 1, then the same in the key a 4th up, four keys in a row. Pass: all four keys without stopping.', watch: 'Starting the new key in the wrong place.', simplify: 'Two keys.' })]),
        S('p6-adv-recall', 'Called boxes and dynamics', 'fretboard', 'Any box on the spot; a sequence that rises and falls in volume.', [
          R('p6-boxes-called', 'Box called, sixes played: 3, 1, 4, 2, 5 ({key})', 'retrieval', { boxes: [3, 1, 4, 2, 5], n: 6, dir: 'up', strings: [4, 3, 2, 1], step: 1 / 6, goal: 88, why: 'Out of order, each box has to come from memory instead of sliding along from the last one: exactly what a solo asks of you.', instr: 'Cover the tab. Ascending sixes on the top four strings of box 3, then 1, 4, 2 and 5, one after another without stopping. Pass: all five boxes from memory at the goal tempo.', watch: 'Stopping between boxes: find the next one while the last group ends.', simplify: 'Boxes 1–3, 16ths.' }),
          R('p6-swell', 'Crescendo and fade: descending sixes on the diagonal ({key})', 'external-focus', { shape: 'diag', n: 6, dir: 'down', step: 1 / 6, goal: 92, why: 'A long sequence at one volume sounds like an exercise. Shaping it (fading in from the top, swelling as it falls) makes it a musical gesture, and controlling the pick at every attack is a technique of its own.', instr: 'Start the descent as quietly as you can, grow steadily louder until the last group, then land on the root strongly. Listen for a smooth curve, not steps. Pass: the descent at the goal tempo with a smooth crescendo, twice.', watch: 'Speeding up as you get louder.', simplify: 'Box 1 instead of the diagonal.' })]),
        S('p6-adv-music', 'In a solo', 'improv', 'Sequences between phrases.', [c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo: one sequence per chorus, between vocal phrases' }), M('transfer', ['callResponse', { chords: '$slowBlues', scale: 'minorPent' }])])
      ], [7, 8]),
    stage('mastery', 'Instant, fast and your own',
      'Play sixes on the diagonal at about 110 BPM in sextuplets, fives on the diagonal in 16ths at 120, any key and box on demand, and perform your own 8-bar sequence piece.', [
        S('p6-performance', 'Performance tempo', 'picking', 'Long sequences at speed.', [
          R('p6-diag-fast', 'Sixes on the diagonal {key} pentatonic at performance tempo', 'edge', { shape: 'diag', n: 6, step: 1 / 6, goal: 96, why: 'The signature fast pentatonic run, at tempo: one group per beat across two boxes.', instr: 'Use the tempo ladder: start below the goal and add a few BPM after each clean pass. Pass: 4 clean at the goal tempo.', watch: 'Forearm tension: shake out between passes.', simplify: '16ths.' }),
          R('p6-fives-diag', 'Fives on the diagonal {key} pentatonic, 16ths', 'edge', { shape: 'diag', n: 5, step: 0.25, goal: 100, why: 'Fives against the beat on the long shape: the most unpredictable-sounding sequence, at speed.', instr: 'Groups of five in steady 16ths, tempo ladder to the goal. Pass: 4 clean at the goal tempo.', watch: 'Drifting into quintuplets.', simplify: 'Box 1 only.' })]),
        S('p6-random', 'Any key, any box', 'fretboard', 'No warning.', [c => p6Random(c), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: sequences as launch pads for long notes' })]),
        S('p6-voice', 'Your own voice', 'improv', 'A study on the sequences, then your version.', [c => p6Etude(c), c => targetGuide(c, { prog: 'minorRock', scale: 'blues', name: 'Solo with the blues scale: build your own sequences from it' })])
      ], [9, 10])
  ]
});
