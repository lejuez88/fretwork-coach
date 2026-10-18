// Subdivisions, gear changes and odd groupings: playing exactly 2, 3, 4, 5, 6 or 7 notes per beat on
// demand, switching between them without moving the beat ("changing gears", Greg Howe's and every
// fusion player's tool), and grouping notes in 3s, 5s and 7s against a steady 8th- or 16th-note
// stream so phrases cross the bar. From counting one muted note, through ladders and gear changes,
// groups of three, quintuplets and septuplets, to random access and an original rhythmic study.
//
// Concept-first (CONTENT.md): the model is a PULSE of beats, each beat carrying a SUBDIVISION (2–7
// notes), plus a NOTE SOURCE that decides the pitches: a fretting-hand-muted note (rhythm only), the
// root, a scale line (the minor pentatonic box, up and down, so the pitch shows the position in the
// group), or a CELL of g scale notes repeated over a fixed subdivision (a grouping: 3 over 16ths
// crosses the beat and realigns every 3 beats). The composer `subRun(c, spec)` builds an exercise from
// subdivision plan × source × grouping × bars × key; every pitched note is tagged with its scale.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-17: the pulse divided on one
// note, spoken counts, the subdivisions mixed, scale lines, the ladder, gear changes, groups of 3,
// off-beat starts and displacement, fives and sevens, mixed sizes, tempo and your own lines. Removed:
// the ear quiz with the tab covered (`sub-name`) and the "from memory" plans (`sub-plan`, `sub-plan-odd`,
// `sub-plan-long`, now written plans); added the rhythm pyramid in any order (`sub-pyramid`).
import { OPEN, N, nameOf, make, mod12, pentBox, minorKey, S, stage, entry, M, targetGuide } from '../lib.js';
import { rng } from './alternatePicking.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
export const NAMES = { 1: 'quarter notes', 2: '8th notes', 3: 'triplets', 4: '16th notes', 5: 'quintuplets', 6: 'sextuplets', 7: 'septuplets' };
export const COUNTS = { 1: '1', 2: '1-and', 3: '1-trip-let', 4: '1-e-and-a', 5: '1-2-3-4-5 (“un-i-ver-si-ty”)', 6: '1-la-li-1-la-li', 7: '1-2-3-4-5-6-7' };
const PENT = k => [0, 3, 5, 7, 10].map(x => mod12(k + x));
const box1 = k => (pentBox(k, 1) || []).map(n => [n.s, n.f]);
/** The scale line: box 1 up and down, endlessly (so each note shows where in the line you are). */
const lineOf = k => { const L = box1(k); return [...L, ...L.slice(1, -1).reverse()]; };

/* ------------------------------- The composer ------------------------------- */
/**
 * spec: { id, name, method, plan (subdivision per beat, cycled), bars, source ('mute' | 'root' |
 * 'line' | 'cell'), group (cell size), groupStep (subdivision the cell runs over), offset (cell start in
 * notes, for displacement), accentFirst, backing, why, instr, watch, simplify, goal, start, dl }.
 */
export function subRun(c, spec) {
  const k = minorKey(c), pcs = PENT(k), L = box1(k); if (!L.length) return null;
  const root = L.find(([s, f]) => s === 5 && mod12(OPEN[s] + f) === k) || L.find(([s, f]) => mod12(OPEN[s] + f) === k) || L[0];
  const line = lineOf(k), bars = spec.bars || 2, notes = [];
  if (spec.source === 'cell') {
    const g = spec.group || 3, n = spec.groupStep || 4, st = 1 / n, total = Math.round(bars * 4 * n);
    // a cell of g consecutive box notes starting near the middle of the box; each repetition moves one step up then back
    const mid = Math.max(0, Math.min(L.length - g, Math.floor(L.length / 2) - 1));
    for (let i = 0; i < total; i++) {
      const rep = Math.floor((i + (spec.offset || 0)) / g), pos = (i + (spec.offset || 0)) % g;
      const shift = [0, 1, 2, 1][rep % 4], [s, f] = L[Math.min(L.length - 1, mid + shift + pos)];
      notes.push(tag(N(s, f, i * st, st, null, pos === 0 && spec.marks !== false ? { pick: 'd' } : null), pcs));
    }
  } else {
    const plan = spec.plan || [4]; let t = 0, li = 0;
    for (let b = 0; b < bars * 4; b++) {
      const n = plan[b % plan.length], st = 1 / n;
      for (let j = 0; j < n; j++) {
        let s, f, x = null;
        if (spec.source === 'mute') { [s, f] = root; x = j === 0 ? null : 'mute'; }
        else if (spec.source === 'root') [s, f] = root;
        else { [s, f] = line[li++ % line.length]; }
        notes.push(tag(N(s, f, t + j * st, st, x), pcs));
      }
      t += 1;
    }
  }
  const last = notes[notes.length - 1], end = last.t + last.d;
  notes.push(tag(N(root[0], root[1], end, Math.max(1, Math.ceil((end + 1) / 4) * 4 - end), '~'), pcs));
  const planNames = spec.plan ? [...new Set(spec.plan)].map(n => NAMES[n]).join(' → ') : `groups of ${spec.group} over ${NAMES[spec.groupStep || 4]}`;
  const fill = s => String(s || '').replace('{key}', `${nameOf(k)} minor pentatonic`).replace('{plan}', planNames).replace('{counts}', spec.plan ? [...new Set(spec.plan)].map(n => `${n}: "${COUNTS[n]}"`).join(', ') : '');
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'rhythm', method: spec.method, unit: spec.plan && new Set(spec.plan).size === 1 ? NAMES[spec.plan[0]] : planNames, goal: spec.goal || 80, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'alternate', metroMode: 'all',
    ...(spec.backing ? { backing: spec.backing(k), chords: [...new Set(spec.backing(k))] } : {}),
    why: fill(spec.why), instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
const R_ = (id, name, method, opts) => c => subRun(c, { id, name, method, ...opts });
const groove = k => [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
const vamp = k => [nameOf(k) + 'm7', nameOf(k + 5) + '7'];
const HOW = 'Strict alternate picking, the click on every beat. Count out loud ({counts}) and land the first note of every beat exactly on the click. ';

/* ------------------------------ Generators ------------------------------ */
/** Not used by the path since the 2026-10-17 audit (an ear quiz with the tab covered; no source teaches it). */
export function subName(c) {
  const r = rng(37 + (c.lvl || 2)), k = minorKey(c), L = box1(k), notes = [], ans = []; if (!L.length) return null;
  const root = L.find(([s, f]) => mod12(OPEN[s] + f) === k) || L[0], max = (c.lvl || 2) <= 2 ? 4 : 6;
  for (let b = 0; b < 4; b++) {
    const n = 2 + Math.floor(r() * (max - 1)); ans.push(NAMES[n]);
    for (let i = 0; i < 4 * n; i++) notes.push(tag(N(root[0], root[1], b * 8 + i / n, 1 / n, i % n ? 'mute' : null), PENT(k)));
  }
  return make(c, {
    id: 'sub-name', name: 'Name the subdivision: 8ths, triplets or 16ths?', domain: 'ear', method: 'retrieval', unit: 'mixed', goal: 84, start: 50, minutes: 4, picking: 'alternate', metroMode: 'all',
    why: 'Recognising a subdivision by ear, and recalling how it is counted, is what lets you copy rhythms and lock with a drummer.',
    instr: `Cover the tab. Each bar plays one subdivision on a muted note; the next bar is silent. Name it, count it aloud, then play it in the silent bar. The answers: ${ans.join(', ')}. Pass: 3 of 4 named and played right, twice.`,
    watch: 'Triplets heard as 16ths: count three per click, not four.', simplify: 'Only 8ths and 16ths.', tab: { notes }
  });
}
/** A random subdivision every beat (interleaving). */
export function subRandom(c, { max = 7, id = 'sub-random', bars = 4 } = {}) {
  const r = rng(503 + (c.lvl || 9) + max), plan = Array.from({ length: bars * 4 }, () => 2 + Math.floor(r() * (max - 1)));
  return subRun(c, { id, name: `Random access: a new subdivision every beat, 2 to ${max} notes ({key})`, method: 'interleaving', plan, bars, source: 'line', goal: 66, start: 44,
    why: 'At mastery any subdivision should come out on demand. A new one every beat, chosen at random, is the hardest and most transferable way to practise that.',
    instr: `The plan: ${plan.join(' ')} notes per beat. Read the numbers, not the notes; keep the scale line going. Pass: all ${bars} bars with every beat landing on the click.`,
    watch: 'Rushing the 5s and 7s into the next beat.', simplify: 'Only 2, 3, 4 and 6.' });
}
/** An original 8-bar rhythmic study (capstone): 8ths to septuplets and back, a group of 3, a group of 5, the landing. */
export function subEtude(c) {
  const k = minorKey(c), pcs = PENT(k), line = lineOf(k), L = box1(k), notes = []; if (!L.length) return null;
  let li = 0, t = 0;
  const beats = (plan) => plan.forEach(n => { for (let j = 0; j < n; j++) { const [s, f] = line[li++ % line.length]; notes.push(tag(N(s, f, t + j / n, 1 / n), pcs)); } t += 1; });
  beats([2, 2, 3, 3]); beats([4, 4, 6, 6]);                                     // bars 1–2: up through the gears
  const cell = (g, n, nb) => { const mid = Math.floor(L.length / 2) - 1; for (let i = 0; i < nb * n; i++) { const [s, f] = L[Math.min(L.length - 1, mid + (i % g))]; notes.push(tag(N(s, f, t + i / n, 1 / n), pcs)); } t += nb; };
  cell(3, 4, 4); cell(5, 4, 4);                                                    // bars 3–4: groups of 3, then 5, over 16ths
  beats([5, 5, 5, 5]); beats([6, 6, 7, 7]);                                      // bars 5–6: quintuplets, sextuplets, septuplets
  beats([6, 4, 3, 2]);                                                            // bar 7: back down the gears
  const root = L.find(([s, f]) => s <= 4 && mod12(OPEN[s] + f) === k) || L[0]; notes.push(tag(N(root[0], root[1], t, 4, '~'), pcs));
  const chords = vamp(k);
  return make(c, {
    id: 'sub-etude', name: `Capstone study: an 8-bar piece through every subdivision (${nameOf(k)} minor pentatonic)`, domain: 'improv', method: 'transfer', unit: 'changing gears', goal: 72, start: 46, minutes: 8, picking: 'alternate', metroMode: 'all',
    backing: [...chords, ...chords, ...chords, ...chords], chords,
    why: 'An original study that climbs through the gears (8ths, triplets, 16ths, sextuplets), crosses the bar with groups of 3 and 5, reaches quintuplets and septuplets and comes back down: the full rhythmic range of the path in one line.',
    instr: 'Learn it two bars at a time. Count every beat aloud before playing it; the click never moves. Then write your own 8 bars with a different gear plan. Pass: the study at the goal tempo, every beat on the click, then your own version once.',
    watch: 'The septuplets turning into sextuplets: seven is one more, not the same feel.', simplify: 'Bars 1–4.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'subdivisions', kind: 'subject', title: 'Subdivisions, gear changes and odd groupings', domain: 'rhythm',
  re: /subdivisions?|gear changes?|changing gears|odd (note )?groupings?|quintuplets?|septuplets?|groups? of (3|5|7|three|five|seven) (over|against)/,
  aliases: ['rhythmic subdivisions', 'changing gears', 'odd note groupings', 'quintuplets and septuplets'],
  summary: 'Exactly 2 to 7 notes per beat on demand, switching between them without moving the beat, and groupings of 3, 5 and 7 that cross the bar: the rhythmic engine of fusion and modern lead playing.',
  prereqs: ['alternatePicking'],
  sources: ['https://hubguitar.com/rhythm/rhythm-study-subdivision', 'https://www.premierguitar.com/articles/23477-cram-session-alternate-picking', 'https://www.guitarinteractivemagazine.com/tech-session/greg-howe/page/2/', 'https://www.fundamental-changes.com/odd-time-signatures-on-guitar/', 'https://www.premierguitar.com/good-times-odd-times-a-guide-to-unusual-note-groupings', 'https://openbooks.library.baylor.edu/rhythm/?p=184', 'https://www.moderndrummer.com/article/october-2015-progressive-drumming-essentials-part-4-feel-odd-subdivisions/'],
  pedagogy: {
    date: '2026-10-17',
    summary: 'Taught from the pulse: the beat divided 1, 2, 3 and 4 ways on one note against a metronome, each subdivision counted aloud (syllables, five- and seven-syllable words for the odd ones) before it is played; the subdivisions mixed in any order; then a scale played in groups of 3 and 4, the groupings reinterpreted in 8ths, 16ths and sextuplets so they cross the beat, gear changes between triplets and 16ths and off-beat starts; then quintuplets and septuplets, groupings that don’t match the rhythm and phrases ended with a different group so they realign, combined group sizes; finally all of it at tempo and in your own lines.',
    sequence: [
      { id: 'pulse', tier: 'foundations', step: 'The beat divided 1, 2, 3 and 4 ways on one note', how: 'A rhythm pyramid on a single note with the metronome on the beat: quarters, 8ths, triplets, 16ths, starting slowly.', skills: ['sub-count'], source: 0 },
      { id: 'speak', tier: 'foundations', step: 'Speak it, then play it; lines of the pyramid in any order', how: 'Say the count in rhythm with the click before playing, then switch between the subdivisions at random.', skills: ['sub-hear'], source: 0 },
      { id: 'scale', tier: 'foundations', step: 'A scale line in each subdivision, then in a groove', how: 'The same scale run in 8ths, triplets and 16ths; muted 16ths with the beat accented.', skills: ['sub-scale', 'sub-first-music'], source: 1 },
      { id: 'ladder', tier: 'intermediate', step: 'Compressing and expanding: the subdivision ladder', how: 'More notes per beat, then fewer, at one tempo with the metronome.', skills: ['sub-ladder'], source: 2 },
      { id: 'gears', tier: 'intermediate', step: 'Changing gears between triplets and 16ths', how: 'Switch subdivision inside the bar without moving the beat, in fixed plans and at random.', skills: ['sub-gears', 'sub-recall'], source: 3 },
      { id: 'groups3', tier: 'intermediate', step: 'Groups of 3 played in 8ths and 16ths', how: 'A three-note grouping reinterpreted in 8ths or 16ths so it crosses the beat.', skills: ['sub-groups'], source: 1 },
      { id: 'offbeat', tier: 'intermediate', step: 'Off-beat starts and displacement in music', how: 'Phrases starting on the second or fourth 16th of the beat; a repeated cell displaced; groupings in riffs over a groove.', skills: ['sub-music-i'], source: 3 },
      { id: 'fives', tier: 'advanced', step: 'Quintuplets and groups of 5', how: 'Five notes per beat counted “u-ni-ver-si-ty” with the click; five-note groups over 16ths.', skills: ['sub-five'], source: 1 },
      { id: 'sevens', tier: 'advanced', step: 'Septuplets and groups of 7', how: 'Seven-syllable counts, sevens beside sixes, a seven-note group over 16ths.', skills: ['sub-seven'], source: 2 },
      { id: 'combine', tier: 'advanced', step: 'Mixed sizes and gears in one line', how: 'Combine groups and subdivisions in one phrase and resolve onto the beat; fusion lines over a vamp.', skills: ['sub-adv-mix', 'sub-music-a'], source: 1 },
      { id: 'tempo', tier: 'mastery', step: 'At tempo and in any order', how: 'Odd gears and groupings worked up in small tempo steps; random subdivisions; long plans.', skills: ['sub-perf', 'sub-random'], source: 1 },
      { id: 'own', tier: 'mastery', step: 'Your own rhythmic lines', how: 'An original study through every gear, then your own phrasing.', skills: ['sub-voice'], source: 1 }
    ],
    drills: ['A rhythm pyramid on one note with a metronome', 'Speaking the count in rhythm before playing', 'A scale in groups of 3 played as 16ths', 'Gear changes between triplets and 16ths', 'Quintuplets counted with a five-syllable word', 'A phrase of mixed group sizes that realigns with the downbeat', 'Off-beat starts on the second 16th of the beat'],
    mistakes: ['Losing the pulse while the subdivision changes', 'Quintuplets collapsing into 16ths plus a late note', 'Sextuplets too fast for the picking hand', 'Playing odd groupings endlessly without realigning to the downbeat', 'Rushing the slower gear after a fast one'],
    sources: [
      { title: 'Rhythm study: subdivision', author: 'Hub Guitar', url: 'https://hubguitar.com/rhythm/rhythm-study-subdivision' },
      { title: 'Good Times, Odd Times: A Guide to Unusual Note Groupings', author: 'Rob Compa (Premier Guitar)', url: 'https://www.premierguitar.com/good-times-odd-times-a-guide-to-unusual-note-groupings' },
      { title: 'The Rhythm and Meter Compendium, ch. 21: Quintuplets and Septuplets', author: 'Amy L. Fleming and Edward J. F. Taylor (Baylor University)', url: 'https://openbooks.library.baylor.edu/rhythm/?p=184' },
      { title: 'Greg Howe-style tech session (changing gears, off-beat 16ths)', author: 'Tom Quayle (Guitar Interactive)', url: 'https://www.guitarinteractivemagazine.com/tech-session/greg-howe/page/2/' }
    ]
  },
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Counting the beat',
      'Play 8ths, triplets and 16ths on a muted note and on the pentatonic box at 70 BPM, switch between them every bar and in any order with every beat on the click, and count each one aloud.', [
        S('sub-count', 'Count it, play it', 'rhythm', 'One muted note: 1, 2, 3 and 4 notes per beat.', [
          R_('sub-ladder-mute', 'The ladder on one muted note: quarters, 8ths, triplets, 16ths', 'accurate-reps', { plan: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4], bars: 4, source: 'mute', goal: 80, start: 50, why: 'With the pitch taken away, only the rhythm is left: one bar each of 1, 2, 3 and 4 notes per beat, every first note on the click.', instr: HOW + 'Pick the first note of each beat clearly; the others are muted with the fretting hand lying on the strings. Count only bars where every beat lands on the click. Pass: 4 clean ladders in a row.', watch: 'Triplets drifting into a dotted, swung feel.', simplify: 'Quarters and 8ths only.' }),
          R_('sub-two-three', '8ths, then triplets, a bar of each on the root', 'chunking', { plan: [2, 2, 2, 2, 3, 3, 3, 3], bars: 4, source: 'root', goal: 80, start: 50, why: 'The switch from two to three notes per beat is the first gear change and the one that most often goes wrong. Isolating it makes it automatic.', instr: HOW + 'Loop the bar line (beat 4 of the 8ths into beat 1 of the triplets) before playing the whole thing. Pass: 4 switches in a row, every beat on the click.', watch: 'The first triplet coming late.', simplify: 'Half tempo.' })],
          ST('A subdivision is how many notes fill one beat: 2 (8ths), 3 (triplets), 4 (16ths) and so on. The beat itself doesn’t move.', 'Every rhythm is built on it: locking subdivisions to the click is what makes a player sound in time.', ['Count aloud: "1-and", "1-trip-let", "1-e-and-a".', 'The first note of each beat falls on the click, whatever the subdivision.'])),
        S('sub-hear', 'Speak it, play it', 'rhythm', 'Say the count, then play it; the beat divided in any order.', [
          R_('sub-say', 'Say it, then play it: "1-and, 1-trip-let, 1-e-and-a"', 'accurate-reps', { plan: [2, 2, 3, 3, 4, 4, 3, 3], bars: 2, source: 'mute', goal: 76, start: 48, why: 'Speaking a rhythm before playing it puts it in the ear first; the hands then follow the voice, not the other way round.', instr: 'Speak the counts with the click for two bars, then play them on a muted note while still speaking. Pass: 4 bars where the played rhythm matches the spoken one exactly.', watch: 'Speaking evenly but playing unevenly: slow down.', simplify: '8ths and triplets only.' }),
          R_('sub-pyramid', 'The rhythm pyramid on one note: a different subdivision every beat', 'interleaving', { plan: [4, 2, 3, 1, 3, 4, 2, 3], bars: 2, source: 'root', goal: 72, start: 46, why: 'The quarter-note pulse stays put while the beat is divided 1, 2, 3 or 4 ways in any order: the lines of a rhythm pyramid mixed, on one note so only the rhythm changes.', instr: HOW + 'The plan per beat: 4 2 3 1 · 3 4 2 3. Speak it once with the click, then play it. Pass: 4 bars where every beat lands on the click, twice.', watch: 'The quarter note after a beat of 16ths cut short.', simplify: 'Only 2 and 4.' })],
          ST('Each subdivision has a sound and a spoken count; spoken in rhythm with the click, it is learned before the hands play it.', 'Saying a rhythm evenly is the quickest way to hear whether you play it evenly.', ['Triplets sound rolling; 16ths sound busier and square.', 'Keep the pulse in mind: the listener follows the beat, not the subdivision.'])),
        S('sub-scale', 'With notes', 'picking', 'The scale line in each subdivision.', [
          R_('sub-line', 'The scale line in 8ths, then triplets ({key})', 'variable', { plan: [2, 2, 2, 2, 3, 3, 3, 3], bars: 4, source: 'line', goal: 80, start: 50, why: 'With the box running up and down, the subdivision change moves the notes against the beat: in 8ths the line repeats every few beats, in triplets it lands somewhere new.', instr: HOW + 'Keep the box line going through the change. Pass: 4 bars clean twice.', watch: 'Stopping the line at the change.', simplify: 'Quarter notes and 8ths.' }),
          R_('sub-16', '16th notes on the scale line, one bar at a time ({key})', 'accurate-reps', { plan: [4], bars: 2, source: 'line', goal: 76, start: 46, why: '16ths are the most used lead subdivision. Counting only clean bars builds them right.', instr: HOW + 'Count only bars where all 16 notes are even. Pass: 4 clean bars in a row.', watch: 'Rushing the "a" into the next beat.', simplify: '8th notes.' })],
          ST('With a scale line, the subdivision decides where each note falls against the beat.', 'This is where rhythm meets lead playing.', ['Box 1 has 12 notes: in 16ths it fills three beats.'])),
        S('sub-first-music', 'First music', 'improv', 'A muted 16th groove; call and response.', [
          R_('sub-groove', 'A 16th-note groove: muted 16ths, the root on each beat, over a minor progression', 'transfer', { plan: [4], bars: 4, source: 'mute', goal: 84, start: 52, backing: groove, why: 'Muted 16ths with the beat accented is the engine of funk and rock rhythm: a steady stream with a clear pulse.', instr: HOW + 'Accent the picked note on each beat; the muted 16ths in between stay light. Play with the band. Pass: 4 bars in the pocket, twice.', watch: 'The accents drifting off the beat.', simplify: '8th notes.' }),
          M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])],
          ST('A rhythm becomes a groove when the subdivision is steady and the beat is clear.', 'Rhythm guitar is subdivision made audible.', ['Accent the beat, keep the rest light.']))
      ], [1, 3]),
    stage('intermediate', 'Gears and groups of three',
      'Run the ladder 2 to 6 notes per beat up and down on the scale at 80 BPM, change gear every two beats and at random, play groups of 3 over 16ths and over 8ths so the line crosses the beat, start a cell on the "e", and play a written gear plan.', [
        S('sub-ladder', 'The ladder', 'rhythm', '2 to 6 notes per beat, up and down.', [
          R_('sub-ladder-up', 'The ladder up: 2, 3, 4, 6 notes per beat ({key})', 'variable', { plan: [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 6, 6, 6, 6], bars: 4, source: 'line', goal: 72, start: 46, why: 'Each bar one gear higher on the same line: the hands learn each subdivision’s speed at one tempo.', instr: HOW + 'One bar each. Pass: twice through with every beat on the click.', watch: 'Speeding up the tempo with the gear.', simplify: 'Stop at 4.' }),
          R_('sub-ladder-down', 'The ladder down: 6, 4, 3, 2 ({key})', 'variable', { plan: [6, 6, 6, 6, 4, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2], bars: 4, source: 'line', goal: 72, start: 46, why: 'Coming down is harder: the slower gears tend to rush. Same line, gears falling.', instr: HOW + 'One bar each, top gear first. Pass: twice through, every beat on the click.', watch: 'The 8ths rushing after the sextuplets.', simplify: 'Start from 4.' })],
          ST('A ladder walks through the subdivisions at one tempo.', 'It builds a feel for each speed and the switches between them.', ['Sextuplets = two triplets per beat.'])),
        S('sub-gears', 'Changing gears', 'rhythm', 'Every two beats; at random.', [
          R_('sub-gears-2', 'Gear change every two beats: triplets and 16ths ({key})', 'interleaving', { plan: [3, 3, 4, 4], bars: 4, source: 'line', goal: 76, start: 48, why: 'Switching twice a bar, as fusion players do in the middle of a line, makes the run surge and relax without moving the beat.', instr: HOW + 'Two beats of triplets, two of 16ths. Pass: 4 bars clean twice.', watch: 'The 16ths starting early.', simplify: 'One gear per bar.' }),
          c => subRandom(c, { max: 6, id: 'sub-random-6', bars: 4 })],
          ST('A gear change switches subdivision without changing tempo.', 'It is how a line accelerates and relaxes inside one groove.', ['Plan the next gear during the current beat.'])),
        S('sub-groups', 'Groups of three', 'picking', 'A 3-note cell over 16ths and over 8ths.', [
          R_('sub-g3-16', 'Groups of 3 over 16ths: the cell crosses the beat ({key})', 'chunking', { source: 'cell', group: 3, groupStep: 4, bars: 3, goal: 76, start: 46, why: 'A three-note cell played in 16ths starts in a new place each beat and lines up again every three beats: the classic "3 over 4" sound of rock and fusion runs.', instr: 'Strict alternate picking; the cell restarts on a downstroke only every other time. Learn it one beat at a time, then the three-beat cycle. Pass: 3 bars with the click steady and the cell clear.', watch: 'Accenting the beat instead of the cell start: hear both.', simplify: 'Groups of 3 in triplets first (they line up).' }),
          R_('sub-g3-8', 'Groups of 3 over 8ths: across the bar ({key})', 'variable', { source: 'cell', group: 3, groupStep: 2, bars: 3, goal: 92, start: 54, why: 'Over 8ths the three-note cell takes a bar and a half to come round: the "3+3+2" feel heard in countless riffs.', instr: 'Count 8ths aloud and hear the cell starting on 1, the "and" of 2, 4… Pass: 3 bars clean twice.', watch: 'Shortening the cell to fit the bar.', simplify: 'Quarter notes.' })],
          ST('A grouping is a melodic cell whose length doesn’t match the subdivision: 3 notes over a 4-note beat.', 'It makes phrases cross the beat and the bar, which sounds sophisticated and fast.', ['3 over 16ths realigns every 3 beats; over 8ths every 3 half-beats.'])),
        S('sub-recall', 'Written gear plans', 'rhythm', 'A gear on every beat, in a mixed order.', [
          R_('sub-plan', 'A written gear plan: 3 4 6 4 · 2 3 4 6 ({key})', 'variable', { plan: [3, 4, 6, 4, 2, 3, 4, 6], bars: 2, source: 'line', goal: 72, start: 46, why: 'A gear on every beat, in an order that isn’t a ladder: the kind of mixed triplet and 16th phrasing fusion lines use, written out so each change can be practised.', instr: HOW + 'Count the plan with the click once, then play it on the scale line. Pass: twice with every beat on the click.', watch: 'The sextuplet beats rushing into the next beat.', simplify: 'The first bar only.' })],
          ST('A gear plan is a list of subdivisions, one per beat; playing it means changing gear on every click.', 'Fusion lines change gear inside the bar; written plans isolate those changes.', ['Plan the next gear during the current beat.', 'Sextuplets are two triplets per beat.'])),
        S('sub-music-i', 'In music', 'improv', 'A 3+3+2 riff; gears over a groove; displacement.', [
          R_('sub-332', 'A 3+3+2 riff over 8ths ({key})', 'transfer', { source: 'cell', group: 3, groupStep: 2, bars: 4, goal: 96, start: 56, backing: groove, why: 'Grouping 8ths in 3+3+2 is one of the most common riff rhythms in rock, funk and pop.', instr: 'Play the cell over the band; let the band’s beat and your cell rub against each other. Pass: 4 bars in time twice.', watch: 'Drifting back to the beat.', simplify: 'Two bars.' }),
          R_('sub-gear-groove', 'Gears over a groove: 8ths, triplets, 16ths in each bar ({key})', 'transfer', { plan: [2, 3, 4, 4], bars: 4, source: 'line', goal: 76, start: 48, backing: groove, why: 'Three gears in every bar over a band: the line accelerates through each bar and resets at the bar line.', instr: HOW + 'Pass: 4 bars in the pocket, twice; then improvise your own gear plan.', watch: 'The 8ths at the start of each bar rushing.', simplify: 'Two gears.' }),
          R_('sub-displace', 'Displacement: the 3-note cell starting on the "e" ({key})', 'variable', { source: 'cell', group: 3, groupStep: 4, offset: 1, bars: 3, goal: 72, start: 44, why: 'Starting the same cell one 16th later moves every accent: the same notes become a new rhythm.', instr: 'Count 16ths aloud; the cell starts on the "e" of 1. Pass: 3 bars clean twice.', watch: 'Pulling the cell back onto the beat.', simplify: 'Half tempo.' })],
          ST('Rhythmic ideas become music over a band: riffs, accelerating lines, displaced cells.', 'This is where subdivision control pays off.', ['Displacement moves a phrase in time without changing its notes.']))
      ], [4, 6]),
    stage('advanced', 'Fives and sevens',
      'Play quintuplets and septuplets on the scale line at 70 BPM, groups of 5 and 7 over 16ths, a random subdivision every beat from 2 to 7, an odd-gear plan, and a fusion line through four gears over a vamp.', [
        S('sub-five', 'Fives', 'rhythm', 'Quintuplets; groups of 5 over 16ths.', [
          R_('sub-5', 'Quintuplets: five notes per beat ({key})', 'chunking', { plan: [4, 5, 4, 5], bars: 2, source: 'line', goal: 66, start: 42, why: 'Five notes per beat is the first odd subdivision: it can’t be split into twos or threes, so it has to be felt. Alternating it with 16ths shows exactly how much more it is.', instr: HOW + 'Count "un-i-ver-si-ty" for the fives. Learn one beat of five first. Pass: 2 bars clean twice.', watch: 'Fives collapsing into 16ths plus a late note.', simplify: 'One beat of five per bar.' }),
          R_('sub-g5', 'Groups of 5 over 16ths ({key})', 'variable', { source: 'cell', group: 5, groupStep: 4, bars: 5, goal: 72, start: 44, why: 'A five-note cell in 16ths comes round every five beats: long, cascading phrases (Eric Johnson’s fives) that hide the bar line.', instr: 'Count 16ths; the cell restarts every 5 notes. Pass: 5 bars clean.', watch: 'Accenting the beat instead of the cell.', simplify: 'Two bars.' })],
          ST('Quintuplets put five notes in a beat; a group of 5 over 16ths is five notes repeated against four per beat.', 'Fives sound fluid and unpredictable: the sound of fusion and Eric Johnson-style runs.', ['5 over 4 realigns every 5 beats.'])),
        S('sub-seven', 'Sevens', 'rhythm', 'Septuplets; groups of 7.', [
          R_('sub-7', 'Septuplets: seven notes per beat ({key})', 'variable', { plan: [6, 7, 6, 7], bars: 2, source: 'line', goal: 56, start: 38, why: 'Seven notes per beat, alternating with six: the finest gear change, felt rather than counted at speed.', instr: HOW + 'Count seven numbers per click at first. Pass: 2 bars clean twice.', watch: 'Sevens flattened into sixes.', simplify: 'Fives and sixes.' }),
          R_('sub-g7', 'Groups of 7 over 16ths ({key})', 'variable', { source: 'cell', group: 7, groupStep: 4, bars: 7, goal: 72, start: 44, why: 'A seven-note cell in 16ths takes seven beats to come home: long-form tension against the bar.', instr: 'Count 16ths; restart the cell every 7. Pass: all 7 bars clean.', watch: 'Losing count in the middle: keep the 16ths steady and the cell takes care of itself.', simplify: 'Groups of 5.' })],
          ST('Septuplets and groups of 7 are the outer edge of common lead subdivisions.', 'They give the free, speech-like flow of advanced fusion lines.', ['7 over 4 realigns every 7 beats.'])),
        S('sub-adv-mix', 'Anything, any beat', 'rhythm', 'Random beats 2–7; an odd-gear plan.', [
          c => subRandom(c, { max: 7, id: 'sub-random-7', bars: 4 }),
          R_('sub-plan-odd', 'An odd-gear plan: 4 5 6 7 · 6 5 4 3 ({key})', 'variable', { plan: [4, 5, 6, 7, 6, 5, 4, 3], bars: 2, source: 'line', goal: 60, start: 40, why: 'Up through fives and sevens and back down: the line compresses as more notes fit each beat, then expands.', instr: HOW + 'Count the plan with the click first ("un-i-ver-si-ty" for the fives). Pass: twice with every beat on the click.', watch: 'Swapping the 5 and 7.', simplify: 'The first bar.' })],
          ST('Every subdivision from 2 to 7 on demand, in any order.', 'Random practice transfers best.', ['Plan the next gear during the current beat.', 'Five- and seven-syllable words keep fives and sevens even.'])),
        S('sub-music-a', 'Fusion lines', 'improv', 'Four gears over a vamp; a solo.', [
          R_('sub-fusion', 'Fusion line: 4, 5, 6, 7 notes per beat over a vamp ({key})', 'transfer', { plan: [4, 5, 6, 7], bars: 4, source: 'line', goal: 60, start: 40, backing: vamp, why: 'Each beat one gear faster: a line that accelerates through every bar over a Dorian vamp, then resets.', instr: HOW + 'Then improvise your own lines that change gear inside the bar and land on a held note. Pass: the written line twice, then 8 bars of your own.', watch: 'The tempo creeping up.', simplify: '4, 5, 6 only.' }),
          c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp: phrases that change gear, then rest' })],
          ST('In fusion, phrases change subdivision inside the bar and resolve on a long note.', 'It makes lines speak rather than run.', ['Plan the landing before the run.']))
      ], [7, 8]),
    stage('mastery', 'Free and your own',
      'Switch between 2 and 7 notes per beat at random at 80 BPM, hold groups of 3, 5 and 7 over 16ths at speed, play a four-bar gear plan, and perform your own 8-bar rhythmic study.', [
        S('sub-perf', 'Performance tempo', 'rhythm', 'Odd gears and groupings at speed.', [
          R_('sub-perf-odd', 'Fives, sixes and sevens at tempo ({key})', 'edge', { plan: [5, 6, 7, 6], bars: 4, source: 'line', goal: 64, start: 44, why: 'The odd gears at performance tempo: the tempo ladder takes them there in steps.', instr: HOW + 'Tempo ladder: add 3 BPM after every clean pass. Pass: two clean passes at the goal.', watch: 'Tension: the picking hand stays loose.', simplify: '4, 5, 6.' }),
          R_('sub-perf-groups', 'Groups of 5 over 16ths at tempo ({key})', 'edge', { source: 'cell', group: 5, groupStep: 4, bars: 5, goal: 84, start: 52, why: 'Long cascading fives at speed.', instr: 'Tempo ladder to the goal. Pass: two clean passes.', watch: 'Rushing the cell.', simplify: 'Groups of 3.' })],
          ST('Odd subdivisions at speed are felt, not counted.', 'At tempo the beat must still be obvious under the line.', ['Small tempo steps over clean passes.'])),
        S('sub-random', 'Anything, any time', 'rhythm', 'Random beats; a long gear plan.', [
          c => subRandom(c, { max: 7, id: 'sub-random-m', bars: 8 }),
          R_('sub-plan-long', 'A four-bar gear plan: 2 3 4 5 · 6 7 6 5 · 4 3 2 3 · 4 6 4 3 ({key})', 'variable', { plan: [2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 3, 4, 6, 4, 3], bars: 4, source: 'line', goal: 60, start: 40, why: 'Four bars that climb to sevens and come back down by a different route: a long line whose speed changes on every beat.', instr: HOW + 'Learn it a bar at a time, then join the bars. Pass: twice through with every beat on the click.', watch: 'Losing the place in bar 3.', simplify: 'Two bars.' })],
          ST('At mastery, rhythm is free: any subdivision on any beat.', 'That freedom is what makes phrasing personal.', ['Hear the next beat before it comes.'])),
        S('sub-voice', 'Your own voice', 'improv', 'A study, then your own.', [c => subEtude(c), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Rock solo: speed bursts in odd groupings, then long notes' })],
          ST('A capstone study uses every gear and grouping of the path, then becomes your own.', 'Mastery is rhythm used musically.', ['Contrast: a burst, then space.']))
      ], [9, 10])
  ]
});
