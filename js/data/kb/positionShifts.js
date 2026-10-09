// Position shifting: moving the hand from one position to another while a line keeps going, so a
// phrase can travel the neck instead of living in one box. Guide-finger shifts, silent jumps, octave
// shifts and the diagonal runs of Eric Johnson's playing, in time and without a gap.
//
// Concept-first (CONTENT.md): the model is the minor pentatonic as five boxes (positions) that climb
// the neck, each holding two notes on every string (`boxNotes()`), and a ROUTE through them: which
// boxes in which order, on which strings, and how the hand gets from one to the next (a guide-finger
// slide on the shared string, a silent jump, or the same shape an octave away). The composer
// `shiftRun(c, spec)` builds an exercise from route × strings × direction × shift kind × note value
// × keys; the diagonal three-notes-per-string shape gives runs that shift every two strings.
import { OPEN, N, nameOf, minorKey, make, pentBox, pent3nps, byString, mod12, goalFor, S, stage, entry, M, targetGuide } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
const UNIT = new Map([[1, 'quarter notes'], [0.5, '8th notes'], [1 / 3, '8th-note triplets'], [0.25, '16th notes'], [1 / 6, '16th-note sextuplets']]);
const unitName = step => UNIT.get(step) || '8th notes';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const PENT = [0, 3, 5, 7, 10];
/** The pentatonic tones along string s (frets 0–22). */
const along = (k, s) => { const out = []; for (let f = 0; f <= 22; f++) if (PENT.includes(mod12(pitch(s, f) - k))) out.push(f); return out; };
/**
 * Box b (1–5, or 0 = box 5 an octave lower) on string s, as two neighbouring tones of the scale along
 * the string, counted from box 1 (where the root sits on the low E string). Boxes therefore always
 * climb in order. Returns [lo, hi] or null when the box runs off the neck.
 */
export function boxOn(k, b, s) {
  const B1 = byString(pentBox(k, 1)); if (!B1[s]) return null;
  const L = along(k, s), i0 = L.indexOf(B1[s][0]), a = i0 + b - 1;
  return i0 >= 0 && a >= 0 && a + 1 < L.length ? [L[a], L[a + 1]] : null;
}
/** The notes of box b on the given strings, low to high in pitch. */
export function boxNotes(k, b, strings) { const out = []; for (const s of strings.slice().sort((x, y) => y - x)) { const B = boxOn(k, b, s); if (!B) return null; out.push([s, B[0]], [s, B[1]]); } return out; }
/** A route of five climbing boxes that fits this key: 1–5, or 0 (box 5 an octave down) and 1–4. */
export function fitRoute(k, strings) { const fits = b => !!boxNotes(k, b, strings); return [1, 2, 3, 4, 5].every(fits) ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4].every(fits) ? [0, 1, 2, 3, 4] : null; }
const boxName = b => (b === 0 ? '5 (an octave down)' : String(b));
const endOf = notes => Math.max(...notes.map(n => n.t + n.d));

/* ------------------------------- The composer ------------------------------- */
/**
 * One exercise from a spec: { id, name ('{key}', '{route}'), method, route (box numbers, 1–5 mapped
 * onto the boxes that fit), strings, dir ('up' | 'down' | 'updown': the notes inside each box), shift
 * ('slide': the first note of the new box slides in on the shared string · 'jump'), step, keys, goal,
 * start, dl, domain, why, instr, watch, simplify }.
 */
export function shiftRun(c, spec) {
  const k0 = minorKey(c), step = spec.step || 0.5, strings = spec.strings || [3, 2, 1], seq = [], names = []; let k = k0;
  for (const off of spec.keys || [0]) {
    k = mod12(k0 + off); const fit = fitRoute(k, strings); if (!fit) return null;
    for (const [i, rb] of (spec.route || [1, 2]).entries()) {
      const b = fit[rb - 1], list = boxNotes(k, b, strings); if (!list) return null;
      const dir = spec.dir === 'updown' ? (i % 2 ? 'down' : 'up') : spec.dir || 'up';
      let ord = dir === 'up' ? list : list.slice().reverse();
      const p = seq[seq.length - 1];
      if (i > 0 && spec.shift === 'slide' && p) {
        const B = boxOn(k, b, p[0]); const upward = B && B[0] >= p[1];
        const tgt = B ? (upward ? B[1] : B[0]) : null;
        if (tgt != null && tgt !== p[1] && tgt > 0 && p[1] > 0) { seq.push([p[0], tgt, tgt > p[1] ? '/' : '\\']); const j = ord.findIndex(([s, f]) => s === p[0] && f === tgt); if (j >= 0) ord = ord.filter((x, m) => m !== j); }
      }
      ord.forEach(([s, f]) => seq.push([s, f, null]));
      if (off === (spec.keys || [0])[0]) names.push(boxName(b));
    }
  }
  const notes = []; let t = 0;
  seq.slice(0, 300).forEach(([s, f, x]) => { notes.push(N(s, f, t, step, x)); t += step; });
  const root = seq.slice().reverse().find(([s, f]) => mod12(pitch(s, f) - k) === 0) || seq[seq.length - 1];
  const end = endOf(notes), bar = Math.ceil((end + 1) / 4) * 4; notes.push(N(root[0], root[1], end, bar - end, '~'));
  const fill = x => x.replace('{key}', `${nameOf(k0)} minor`).replace('{route}', names.join(' → '));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretboard', method: spec.method, unit: unitName(step), goal: spec.goal || 96, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
const R_ = (id, name, method, opts) => c => shiftRun(c, { id, name, method, ...opts });

/* ------------------------------- Generators ------------------------------- */
/** A short lick in box 1, then the same lick shifted an octave up (or down) the neck (octave shift). */
export function octaveShift(c, { down = false, step = 0.5, id = 'shift-octave', method = 'audiation' } = {}) {
  const k = minorKey(c); let phrase = null, d = 0, bx = 1;
  for (const b of [1, 2, 3, 4, 5]) {
    const lick = boxNotes(k, b, [3, 2, 1]); if (!lick) continue;
    const ph = [...lick.slice(0, 4), ...lick.slice(0, 3).reverse()];
    const hi = ph.every(([, f]) => f + 12 <= 22), lo = ph.every(([, f]) => f - 12 >= 0);
    const dd = down ? (lo ? -12 : hi ? 12 : 0) : (hi ? 12 : lo ? -12 : 0); if (dd) { phrase = ph; d = dd; bx = b; break; }
  }
  if (!phrase) return null;
  const notes = []; let t = 0;
  for (const [rep, off] of [[0, 0], [1, d], [2, 0], [3, d]]) { phrase.forEach(([s, f], i) => notes.push(N(s, f + off, t + i * step, i === phrase.length - 1 ? 4 - (phrase.length - 1) * step : step))); t += 4; }
  return make(c, {
    id, name: `The same lick an octave ${d > 0 ? 'up' : 'down'}: shifting twelve frets in ${unitName(step)} (${nameOf(k)} minor)`, domain: 'fretboard', method,
    unit: unitName(step), goal: method === 'audiation' ? 80 : 96, start: 50, minutes: 4,
    why: 'Every pentatonic shape repeats twelve frets away. Moving a lick an octave is the biggest shift there is, and the ear can check it: the second version must sound exactly like the first, only higher (or lower).',
    instr: `Bar 1: the lick in box ${bx}. Bar 2: the identical shape twelve frets ${d > 0 ? 'higher' : 'lower'}. ${method === 'audiation' ? 'Before bar 2, sing the lick an octave up in your head, then play it there. ' : ''}Move the whole hand during the held note at the end of each bar. Pass: four bars where the shifted lick lands on the right fret on beat 1.`,
    watch: 'Counting frets during the shift: use the 12th-fret dots as landmarks.', simplify: 'Shift during a whole bar of rest.', tab: { notes }
  });
}
/** A phrase that climbs through boxes with shifts, then lands (use in music). */
export function shiftPhrase(c, { level = 1 } = {}) {
  const k = minorKey(c), fit = fitRoute(k, [3, 2, 1]); if (!fit) return null;
  const route = level === 1 ? [1, 2] : level === 2 ? [1, 2, 3] : [2, 3, 4, 5];
  const step = level === 1 ? 0.5 : level === 2 ? 1 / 3 : 0.25, notes = []; let t = 0;
  for (const [i, rb] of route.entries()) {
    const l = boxNotes(k, fit[rb - 1], [3, 2, 1]); if (!l) return null;
    const take = level === 1 ? l.slice(0, 4) : l;
    take.forEach(([s, f], j) => { const p = notes[notes.length - 1]; notes.push(N(s, f, t, step, j === 0 && i > 0 && p && p.s === s && p.f > 0 && f > p.f ? '/' : null)); t += step; });
  }
  const hiBox = boxNotes(k, fit[route[route.length - 1] - 1], [3, 2, 1]), top = hiBox[hiBox.length - 1];
  notes.push(N(top[0], top[1], t, 2, '~')); t += 2;
  const home = boxNotes(k, fit[0], [4, 3]); const r = home.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || home[0];
  const bar = Math.ceil((t + 1) / 4) * 4; notes.push(N(r[0], r[1], t, bar - t, '~'));
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: ['shift-phrase', 'shift-phrase-3', 'shift-phrase-high'][level - 1], name: [`A phrase that shifts from box 1 to box 2 (${nameOf(k)} minor)`, `A phrase that climbs three boxes (${nameOf(k)} minor)`, `A high climb through boxes 2 to 5, then home (${nameOf(k)} minor)`][level - 1],
    domain: 'improv', method: 'transfer', unit: unitName(step), goal: [84, 92, 100][level - 1], start: 50, minutes: 5, backing: chords, chords,
    why: 'A phrase that climbs the neck builds intensity the way a singer rises: the shifts are what let it go higher than one box allows. It ends on a held high note, then drops home.',
    instr: 'Play the climbing line, shifting on the first note of each new box (slide where marked), hold the top note with vibrato, then jump home to the root. Then improvise your own climbing phrase. Pass: the phrase twice in time, then four bars of your own.',
    watch: 'Slowing down at the shift.', simplify: 'Half tempo.', tab: { notes }
  });
}
/** A random key and box pair every bar, shifting between them (interleaving). */
export function shiftRandom(c) {
  const rr = rng(1609 + (c.lvl || 9)), notes = [], names = [];
  for (let bar = 0; bar < 8; bar++) {
    const k = Math.floor(rr() * 12), fit = fitRoute(k, [3, 2, 1]); if (!fit) return null;
    const j = Math.floor(rr() * 4), a = boxNotes(k, fit[j], [3, 2, 1]), b = boxNotes(k, fit[j + 1], [3, 2, 1]); if (!a || !b) return null;
    [...a, ...b.slice(0, 3)].forEach(([s, f], i) => notes.push(N(s, f, bar * 4 + i * (1 / 3), 1 / 3)));
    notes.push(N(b[3][0], b[3][1], bar * 4 + 3, 1)); names.push(`${nameOf(k)}m ${boxName(fit[j])}→${boxName(fit[j + 1])}`);
  }
  return make(c, {
    id: 'shift-random', name: 'Random access: a new key and a new shift every bar', domain: 'fretboard', method: 'interleaving',
    unit: '8th-note triplets', goal: 96, start: 52, minutes: 5, dl: 1,
    why: 'At mastery level any shift between neighbouring boxes, in any key, should happen without a thought or a gap.',
    instr: `${names.join(' → ')}: the top three strings of the first box, shift, the start of the next box. Read only the names. Pass: all 8 bars from the names alone at the goal tempo.`,
    watch: 'Hesitating on unfamiliar keys.', simplify: 'The first four bars.', tab: { notes }
  });
}
/** An original 8-bar study on position shifting (capstone). */
export function shiftEtude(c) {
  const k = minorKey(c), fit = fitRoute(k, [3, 2, 1]), dg = pent3nps(k); if (!fit || !dg) return null;
  const notes = []; let t = 0;
  const put = (seq, step, beats, t0) => { let tt = t0; for (const [s, f, x] of seq) { if (tt >= t0 + beats - 1e-6) break; notes.push(N(s, f, tt, step, x || null)); tt += step; } };
  const box = (b, strs, dir = 'up') => { const l = boxNotes(k, fit[b - 1], strs); return dir === 'up' ? l : l.slice().reverse(); };
  put([...box(1, [3, 2, 1]), ...box(2, [3, 2, 1]).slice(0, 2)], 0.5, 4, 0);                // bar 1: box 1 into box 2
  put([...box(2, [3, 2, 1]), ...box(3, [3, 2, 1]).slice(0, 2)], 1 / 3, 4, 4);              // bar 2: box 2 into 3, triplets
  put([...box(3, [2, 1]), ...box(4, [2, 1]), ...box(5, [2, 1])], 0.25, 4, 8);              // bar 3: up the top two strings
  notes.push(N(box(5, [2, 1])[3][0], box(5, [2, 1])[3][1], 12, 4, '~'));                   // bar 4: hold the top
  put(dg.map(x => [x.s, x.f]).reverse(), 0.25, 8, 16);                                     // bars 5–6: down the diagonal
  put([...box(2, [3, 2, 1], 'down'), ...box(1, [4, 3, 2], 'down')], 1 / 3, 4, 24);        // bar 7: home through boxes 2 and 1
  const home = boxNotes(k, fit[0], [5, 4]), r = home.find(([s, f]) => mod12(pitch(s, f) - k) === 0) || home[0];
  notes.push(N(r[0], r[1], 28, 4, '~'));
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  return make(c, {
    id: 'shift-capstone-etude', name: `Capstone study: an 8-bar piece that travels the neck (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'mixed rhythms', goal: 92, start: 52, minutes: 8, dl: 1, backing: [...chords, ...chords], chords,
    why: 'An original piece that climbs from box 1 to box 5 through every kind of shift (into the next box, in triplets, up two strings at speed), holds the top, cascades down the diagonal and comes home.',
    instr: 'Learn it two bars at a time and mark where each shift happens. Every shift is in time, with no gap. Then write your own 8-bar journey up and down the neck. Pass: the study at the goal tempo with no stops, then your own version once.',
    watch: 'Bar 3: the shifts come every four notes; lead with the thumb.', simplify: 'Bars 1–4.', tab: { notes }
  });
}
/** The diagonal three-notes-per-string shape: the hand shifts up every two strings (variable / edge). */
export function diagShift(c, { step = 1 / 3, id = 'shift-diag', method = 'variable', goal = 96, down = false } = {}) {
  const k = minorKey(c), dg = pent3nps(k); if (!dg) return null;
  const l = dg.map(x => [x.s, x.f]), seq = down ? l.slice().reverse() : [...l, ...l.slice(0, -1).reverse()];
  const notes = seq.map(([s, f], i) => N(s, f, i * step, step)); const end = endOf(notes), bar = Math.ceil((end + 1) / 4) * 4;
  notes.push(N(seq[seq.length - 1][0], seq[seq.length - 1][1], end, bar - end, '~'));
  return make(c, {
    id, name: `The diagonal: three notes per string, shifting every two strings${down ? ', descending' : ''} (${nameOf(k)} minor pentatonic)`, domain: 'fretboard', method,
    unit: unitName(step), goal, start: 52, minutes: 5, dl: method === 'edge' ? 1 : 0,
    why: 'With three pentatonic notes on each string, the shape climbs diagonally: the hand has to shift up the neck every two strings. It is the shape behind long runs that travel two octaves and two boxes in one sweep.',
    instr: 'Up the diagonal and back (or down). Shift the whole hand with the first note of every second string, sliding the index finger lightly if it helps. Keep the rhythm perfectly even through every shift. Pass: clean at the goal tempo, twice.',
    watch: 'A tiny pause at each shift.', simplify: '8th notes.', tab: { notes }
  });
}
function as(gen, over) { return c => { const x = gen(c); if (!x) return null; const out = { ...x, id: over.id, method: over.method, name: over.name ? over.name(x) : x.name }; if (over.goal) { out.goalBpm = goalFor(c, over.goal); out.startBpm = Math.max(30, Math.min(Math.round(out.goalBpm * 0.6), out.goalBpm - 4)); } if (over.instr) out.instr = over.instr; return out; }; }

/* --------------------------------- The path --------------------------------- */
const SH = 'Each box holds two scale notes on every string; the shift moves the hand to the next box. ';
export default entry({
  id: 'positionShifts', kind: 'technique', title: 'Position shifting', domain: 'fretboard',
  re: /position (shift|shifting|changes?)|shifting positions?|shift(ing)? (between|across) (boxes|positions)|travel(l)?ing (up )?the neck/,
  aliases: ['position shifts', 'shifting positions', 'moving between boxes'],
  summary: 'Moving the hand between positions while the line keeps going: guide-finger slides, silent jumps, octave shifts, the diagonal and routes through all five boxes, in time and without a gap, so phrases can travel the neck.',
  prereqs: ['pentatonic', 'slides'],
  sources: ['https://guitarworld.com/lessons/eric-johnson-fluid-streams-of-notes', 'https://www.pickupmusic.com/blog/how-to-play-minor-pentatonic-scales', 'https://www.guitarworld.com/lessons/using-monster-three-notes-per-string-pentatonic-patterns-to-efficiently-traverse-the-fretboard', 'https://www.guitarnine.com/node/6040'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'The first shifts',
      'Shift from box 1 to box 2 with a guide-finger slide in quarter notes and then 8ths at 80 BPM, jump between boxes with no gap in the rhythm, name each box before shifting into it, move a lick an octave by ear, and play a phrase that shifts from box 1 to box 2 over a minor groove.', [
        S('shift-guide', 'The guide finger', 'fretboard', 'One finger slides and takes the hand with it.', [
          R_('shift-guide-slow', 'Guide-finger shift: box 1 into box 2 on the G and B strings ({key})', 'chunking', { route: [1, 2], strings: [3, 2], shift: 'slide', step: 1, goal: 80, start: 50, why: SH + 'The simplest shift: the finger that plays the last note of box 1 slides along the string to the first note of box 2 and the hand moves with it, so the new position is found by touch.', instr: 'Box 1 up the G and B strings, slide into box 2 on the B string, then box 2. Slowly, in quarter notes: first just the slide, then the whole thing. Pass: four shifts in a row where the hand arrives with the right finger over each fret.', watch: 'Only the finger moving, not the hand: then box 2 is out of reach.', simplify: 'Only the slide and the next note.' }),
          R_('shift-guide-count', 'Count clean shifts: box 1, box 2, back and forth ({key})', 'accurate-reps', { route: [1, 2, 1, 2], strings: [3, 2], shift: 'slide', dir: 'updown', step: 0.5, goal: 88, start: 50, why: SH + 'Back and forth between boxes, counting only the shifts that land cleanly and on time, builds the reflex.', instr: 'Up box 1, slide into box 2, down box 2, back into box 1, repeat. 8th notes. Count clean shifts only. Pass: 8 clean shifts in a row.', watch: 'Speeding up into the shift.', simplify: 'Quarter notes.' })]),
        S('shift-jump', 'Silent shifts', 'fretboard', 'Moving without a slide, and without a gap.', [
          R_('shift-jump', 'A silent jump: box 1 to box 2 on the top strings ({key})', 'variable', { route: [1, 2, 1, 2], strings: [2, 1], shift: 'jump', step: 0.5, goal: 88, start: 50, why: SH + 'Not every shift can slide. A silent shift lifts the hand at the end of one box and lands it in the next while the rhythm keeps going: the hand moves during the last note.', instr: 'Up the B and high e strings in box 1, then jump (no slide) to the B string of box 2 and climb it, and back. Move as the last note of each box sounds. Pass: four shifts with no gap in the 8ths.', watch: 'Cutting the last note short to get there in time.', simplify: 'A quarter-note rest before each jump.' }),
          R_('shift-no-gap', 'No gap: box 1 to box 3 in one move ({key})', 'external-focus', { route: [1, 3, 1, 3], strings: [3, 2, 1], shift: 'jump', step: 0.5, goal: 84, start: 50, why: 'Skipping a box makes the shift longer, which is where gaps appear. Listen only to the rhythm: the 8ths must flow straight through.', instr: SH + 'Up box 1, jump to box 3 and down it, back to box 1. Close your eyes on the second pass: you should hear an unbroken line. Pass: four jumps where no listener could tell where the shift happened.', watch: 'A late arrival that pushes the next note.', simplify: 'Boxes 1 and 2.' })]),
        S('shift-know', 'Know where you are going', 'theory', 'Name the box first; hear the octave.', [
          R_('shift-name', 'Name the box, then go: 1, 2, 3 on the top strings ({key})', 'retrieval', { route: [1, 2, 3], strings: [3, 2, 1], shift: 'slide', step: 0.5, goal: 84, start: 50, why: 'A shift starts in the head: you need to know which box is next and where its first note is before the hand moves. Saying it first makes that automatic.', instr: SH + 'Before each shift, say the next box and its first fret on the G string; then shift. After one pass, cover the tab. Pass: the route from memory, twice.', watch: 'Moving first and looking second.', simplify: 'Boxes 1 and 2.' }),
          c => octaveShift(c)]),
        S('shift-first-music', 'First music', 'improv', 'A phrase that shifts.', [c => shiftPhrase(c, { level: 1 }), M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'Routes through the boxes',
      'Play the diagonal shape up and back as triplets at 100 BPM, climb the top two strings through all five boxes, take routes that skip and return, descend through the boxes, take boxes called out of order from memory, shift with legato slides, shift between boxes in four keys, and play a phrase that climbs three boxes.', [
        S('shift-diagonal', 'The diagonal and two strings', 'fretboard', 'Runs that shift every two strings; the neck on two strings.', [c => diagShift(c),
          R_('shift-two-strings', 'Up the neck on two strings: boxes {route} ({key})', 'variable', { route: [1, 2, 3, 4, 5], strings: [2, 1], shift: 'slide', step: 1 / 3, goal: 92, why: 'Two strings through all five boxes is horizontal playing: the shape Eric Johnson’s lines often take, with a shift every four notes.', instr: SH + 'Up the B and high e strings in each box, sliding into the next box on the B string. Pass: the climb twice in time.', watch: 'Running out of hand on the stretch in box 5.', simplify: 'Boxes 1–3.' })]),
        S('shift-routes', 'Routes', 'fretboard', 'Skips, returns and descents.', [
          R_('shift-low', 'Shifts on the bass strings: boxes {route} ({key})', 'variable', { route: [1, 2, 3, 2], strings: [6, 5, 4], dir: 'updown', shift: 'slide', step: 1 / 3, goal: 92, why: 'Low on the neck the frets are wide and the strings thick: the same shifts need a bigger, more deliberate hand move.', instr: SH + 'Up and down the three bass strings of each box, sliding into the next box on the shared string. Pass: the route twice in time.', watch: 'Open strings ringing during the shift.', simplify: 'Boxes 1 and 2.' }),
          R_('shift-route-skip', 'A route with skips: boxes {route} ({key})', 'interleaving', { route: [1, 3, 2, 4, 3, 5], strings: [3, 2, 1], shift: 'jump', dir: 'updown', step: 1 / 3, goal: 92, why: 'Two steps up, one back: a route that keeps changing distance makes every shift a new problem.', instr: SH + 'Up one box, down the next, along the route shown. Pass: the route clean twice.', watch: 'Defaulting to the neighbouring box.', simplify: 'The first four boxes of the route.' }),
          R_('shift-down', 'Down the neck: boxes {route} on the top strings ({key})', 'variable', { route: [5, 4, 3, 2, 1], strings: [3, 2, 1], dir: 'down', shift: 'slide', step: 1 / 3, goal: 92, why: 'Descending shifts move the hand toward the nut; the guide finger now slides down into the lower box.', instr: SH + 'Down each box from the high e to the G string, then shift down into the next box. Pass: the descent twice in time.', watch: 'Overshooting downward.', simplify: 'Boxes 5–3.' })]),
        S('shift-control', 'Recall and touch', 'fretboard', 'Boxes from memory; shifts you can’t hear.', [
          R_('shift-called', 'Boxes called out of order: {route} ({key})', 'retrieval', { route: [3, 1, 4, 2, 5], strings: [3, 2, 1], shift: 'jump', step: 1 / 3, goal: 88, why: 'Out of order, each box must come from memory: exactly what a solo asks when it leaps to a new part of the neck.', instr: SH + 'The top three strings of each box in the order shown. Cover the tab; say the box before each. Pass: from memory, twice.', watch: 'Shifting to the neighbour instead.', simplify: 'Boxes 1–3.' }),
          R_('shift-legato', 'Legato shifts: slide into each box on the B string ({key})', 'external-focus', { route: [1, 2, 3, 2, 1], strings: [3, 2], shift: 'slide', dir: 'updown', step: 1 / 3, goal: 92, why: 'When the shift is a slide, the line can sound completely legato: the goal is that a listener hears one phrase, not boxes.', instr: SH + 'Up and down the G and B strings, sliding into each new box. Listen for a seamless line. Pass: the route twice with every slide inaudible as a “shift”.', watch: 'Picking the slid note.', simplify: 'Boxes 1–2.' }),
          R_('shift-keys', 'Box 1 to box 2 in four keys around the cycle of fourths', 'interleaving', { route: [1, 2], keys: [0, 5, 10, 3], strings: [3, 2, 1], shift: 'slide', step: 1 / 3, goal: 92, dl: 1, why: 'The shift is a shape, so it works in every key; changing key every few beats trains finding box 1 and box 2 anywhere.', instr: SH + 'Box 1 into box 2 in each key, a 4th up each time. Pass: all four keys without stopping.', watch: 'Stopping at the key change.', simplify: 'Two keys.' })]),
        S('shift-music', 'In music', 'improv', 'A climbing phrase, and a solo.', [c => shiftPhrase(c, { level: 2 }), c => targetGuide(c, { prog: 'minorRock', scale: 'minorPent', name: 'Solo that starts in box 1 and ends in box 3' })])
      ], [4, 6]),
    stage('advanced', 'Speed and the whole neck',
      'Move a lick up and down an octave in time, run the diagonal in 16ths and down as triplets at 100 BPM, zig-zag through the boxes, take long routes from memory, make fast shifts inaudible, and solo from box 2 to box 5 over a blues.', [
        S('shift-octaves', 'Octave shifts', 'fretboard', 'Twelve frets in one move.', [
          c => octaveShift(c, { step: 0.25, id: 'shift-octave-fast', method: 'variable' }),
          c => octaveShift(c, { down: true, step: 1 / 3, id: 'shift-octave-down', method: 'variable' })]),
        S('shift-fast', 'Fast shifts', 'picking', 'The diagonal at speed; zig-zags.', [
          c => diagShift(c, { step: 0.25, id: 'shift-diag-16', goal: 100 }),
          R_('shift-zigzag', 'Zig-zag: up a box, down the next, through boxes {route} ({key})', 'interleaving', { route: [1, 2, 3, 4, 5], strings: [3, 2, 1], dir: 'updown', shift: 'jump', step: 0.25, goal: 96, why: 'Alternating direction box by box means each shift starts from the opposite end of the box: a constant change of hand position at speed.', instr: SH + 'Up box 1, down box 2, up box 3… in 16ths. Pass: the route clean at the goal tempo.', watch: 'Late shifts at the top of each box.', simplify: '8th-note triplets.' })]),
        S('shift-adv-recall', 'Long routes and invisible shifts', 'fretboard', 'Memory and smoothness at speed.', [
          R_('shift-long-route', 'From memory: a long route {route} ({key})', 'retrieval', { route: [2, 4, 1, 5, 3, 1], strings: [3, 2, 1], shift: 'jump', step: 0.25, goal: 92, why: 'A long route with big jumps, from memory: the neck as one map you can move around at will.', instr: SH + 'Cover the tab. The top three strings of each box along the route. Pass: twice from memory at the goal tempo.', watch: 'Losing the route halfway.', simplify: 'The first three boxes.' }),
          c => diagShift(c, { step: 1 / 3, id: 'shift-diag-down', method: 'external-focus', goal: 96, down: true })]),
        S('shift-adv-music', 'In music', 'improv', 'A high climb, and a blues solo.', [c => shiftPhrase(c, { level: 3 }), c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo: each chorus one box higher' })])
      ], [7, 8]),
    stage('mastery', 'Anywhere, fast and your own',
      'Run the diagonal in sextuplets at about 105 BPM and the whole neck up and back on the top strings in 16ths at 110, any shift in any key on demand, and perform your own 8-bar piece that travels the neck.', [
        S('shift-performance', 'Performance tempo', 'picking', 'The whole neck at speed.', [
          c => diagShift(c, { step: 1 / 6, id: 'shift-diag-fast', method: 'edge', goal: 92 }),
          R_('shift-neck-fast', 'The whole neck and back on the top strings at performance tempo ({key})', 'edge', { route: [1, 2, 3, 4, 5, 4, 3, 2, 1], strings: [3, 2, 1], dir: 'updown', shift: 'slide', step: 0.25, goal: 100, why: 'Up through all five boxes and back down at tempo: the complete map with every kind of shift.', instr: SH + 'Tempo ladder: add a few BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Tension over the long run.', simplify: 'Boxes 1–3.' })]),
        S('shift-random-access', 'Any key, any shift', 'fretboard', 'No warning.', [c => shiftRandom(c), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: start low, finish at the top of the neck' })]),
        S('shift-voice', 'Your own voice', 'improv', 'A study, then your version.', [c => shiftEtude(c), c => targetGuide(c, { prog: 'slowBlues', scale: 'minorPent', name: 'Slow blues: tell the story by moving up the neck' })])
      ], [9, 10])
  ]
});
