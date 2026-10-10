// Phrasing and space: soloing in phrases, the way a singer does. From the first bar of melody followed
// by a bar of silence, to motifs that are stated, repeated, varied, sequenced, displaced and answered,
// landing notes chosen from the chord, colour notes chosen on purpose, and whole solos with a shape
// (a beginning, a climb, a peak and an ending): the skill behind David Gilmour's "space", B.B. King's
// economy and every melodic solo.
//
// Concept-first (CONTENT.md): the model is a PHRASE = a motif (a contour of steps along the scale and a
// rhythm) + a development operation + where it starts in the bar + where it lands. The scale is a
// "ladder" of the notes inside a pentatonic box's fret window (`ladder()`: minor pentatonic, or Dorian /
// natural minor when the lesson adds colour notes), sorted by pitch, so a motif moved along the ladder
// (a diatonic sequence) stays in the key in every key. Each phrase's last note is replaced by the
// nearest ladder note that is a tone of that bar's chord (the root, 3rd or 5th the lesson asks for), so
// every phrase lands on the harmony. The composer `phr(c, spec)` builds an exercise from motif ×
// plan (one entry per bar: a development op, or a rest bar) × register × density × scale × box × key
// plan × progression. New lessons are new plans, not new code.
import { OPEN, N, nameOf, minorKey, make, mod12, chordInfo, S, stage, entry, M, targetGuide } from '../lib.js';
import { boxFrets, rng } from './bending.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const SCALES = { pent: [0, 3, 5, 7, 10], dorian: [0, 2, 3, 5, 7, 9, 10], natural: [0, 2, 3, 5, 7, 8, 10] };
const SCALE_NAME = { pent: 'minor pentatonic', dorian: 'Dorian (pentatonic + 2 and 6)', natural: 'natural minor (pentatonic + 2 and ♭6)' };
const DEG = { 0: 'R', 2: '2', 3: '♭3', 5: '4', 7: '5', 8: '♭6', 9: '6', 10: '♭7' };
/** The scale as a ladder of notes inside a box's fret window (one fret either side), lowest pitch first. */
export function ladder(k, box, scale = 'pent', strings = [6, 5, 4, 3, 2, 1]) {
  const B = boxFrets(k, box), pcs = SCALES[scale], seen = new Map();
  for (const s of strings) {
    if (!B[s]) continue;
    for (let f = Math.max(1, B[s][0] - 1); f <= Math.min(22, B[s][1] + 1); f++) {
      const p = pitch(s, f); if (!pcs.includes(mod12(p - k))) continue;
      const inBox = B[s].includes(f), old = seen.get(p);
      if (!old || (inBox && !old.inBox)) seen.set(p, { s, f, p, d: mod12(p - k), inBox });
    }
  }
  return [...seen.values()].sort((a, b) => a.p - b.p);
}
/** Motifs: a contour (ladder steps from the first note) and a rhythm (beats); the last note lands. */
export const MOTIFS = {
  sigh: { name: 'the sigh (three notes falling)', steps: [0, -1, -2], rhythm: [1, 0.5, 2.5], from: 7 },
  rise: { name: 'the rise (up and back)', steps: [0, 1, 2, 1], rhythm: [0.5, 0.5, 1, 2], from: 3 },
  call: { name: 'the call (leap and fall)', steps: [0, 2, 1, 0], rhythm: [0.5, 0.5, 0.5, 2.5], from: 0 },
  turn: { name: 'the turn (around a note)', steps: [0, 1, 0, -1, -2], rhythm: [0.5, 0.5, 0.5, 0.5, 2], from: 7 },
  leap: { name: 'the leap (a wide jump, then steps)', steps: [0, 3, 2, 1], rhythm: [1, 1, 0.5, 1.5], from: 0 },
  cry: { name: 'the cry (repeated note, then a fall)', steps: [0, 0, -1, -2], rhythm: [0.5, 1, 0.5, 2], from: 10 }
};
/** Development operations: how a phrase changes the motif. */
export const OPS = {
  state: 'the motif', repeat: 'the motif again', seqDown: 'one step lower (sequence)', seqUp: 'one step higher (sequence)', seqDown2: 'two steps lower (sequence)',
  disp: 'displaced an 8th later', disp2: 'displaced to beat 2', pickup: 'starting an 8th before the bar', tail: 'with a new, longer ending', trunc: 'cut short',
  invert: 'upside down (inverted)', augment: 'twice as slow', answer: 'answered, landing on the root', question: 'as a question, landing on the 5th'
};
const SEQ = { seqDown: -1, seqUp: 1, seqDown2: -2 };
/** Chord lists for the backings (built from the minor key). */
export const PROGS = {
  minorRock: k => [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'],
  dorian: k => [nameOf(k) + 'm7', nameOf(k + 5) + '9'],
  blues: k => [nameOf(k) + '7', nameOf(k + 5) + '7', nameOf(k) + '7', nameOf(k + 7) + '7'],
  slow: k => [nameOf(k) + '9', nameOf(k + 5) + '9', nameOf(k) + '9', nameOf(k + 7) + '9'],
  power: k => [nameOf(k) + '5', nameOf(k + 8) + '5', nameOf(k + 10) + '5', nameOf(k) + '5']
};
/** The ladder index of the chord tone nearest to index i (preferring `want`: 0 root, 1 third, 2 fifth). */
function landIndex(lad, i, chord, want) {
  const ok = j => lad[j] && chord.pcs.includes(mod12(lad[j].p));
  const pref = want != null && chord.pcs[want] != null ? j => ok(j) && mod12(lad[j].p) === chord.pcs[want] : ok;
  for (const test of [pref, ok]) for (let r = 0; r < lad.length; r++) for (const j of [i - r, i + r]) if (j >= 0 && j < lad.length && test(j)) return j;
  return -1;
}

/* ------------------------------- The composer ------------------------------- */
/** For the pitch check: the key and scale of each note's block ([[from beat, key pc, scale]]). */
export const KEY_PLAN = new WeakMap();
/**
 * One phrase into `notes` from beat t (the bar's downbeat): motif × op × register, landing on `chord`.
 * Returns the first ladder index used (so the next phrase can start near it), or null.
 */
function phraseAt(notes, lad, motif, op, t, chord, { reg = 0, dens = 1, land = null, near = null } = {}) {
  let steps = motif.steps.slice(), rhythm = motif.rhythm.slice(), t0 = t;
  if (op === 'invert') steps = steps.map(x => -x);
  if (op === 'trunc') { steps = steps.slice(0, Math.max(2, steps.length - 1)); rhythm = rhythm.slice(0, steps.length); rhythm[rhythm.length - 1] += 1; }
  if (op === 'tail') { const last = steps[steps.length - 1]; steps = [...steps.slice(0, -1), last + 1, last, last - 1]; rhythm = [...rhythm.slice(0, -1), 0.5, 0.5, Math.max(1, rhythm[rhythm.length - 1] - 1)]; }
  if (op === 'augment') rhythm = rhythm.map(x => x * 2);
  if (dens === 2) { const base = steps.slice(0, -1).slice(0, 3); steps = [...base, ...base.map(x => x - 1), steps[steps.length - 1] - 1]; rhythm = [...base.map(() => 0.5), ...base.map(() => 0.5), Math.max(0.5, 4 - base.length)]; }
  if (op === 'disp') t0 += 0.5; if (op === 'disp2') t0 += 1; if (op === 'pickup') t0 -= 0.5;
  const total = rhythm.reduce((a, x) => a + x, 0), room = (op === 'augment' ? 8 : 4) - (t0 - t);
  if (total > room) rhythm[rhythm.length - 1] = Math.max(0.5, rhythm[rhythm.length - 1] - (total - room));
  const mid = Math.round(lad.length * 0.62) + reg * 3;
  // the motif's first note: the ladder note of its degree nearest the register (or the previous phrase) whose whole contour fits in the box
  const fits = j => Math.min(...steps.map(x => j + x)) >= 0 && Math.max(...steps.map(x => j + x)) < lad.length, target = near != null ? near : mid, sq = SEQ[op] || 0;
  let base = -1; lad.forEach((x, j) => { if (x.d === motif.from && fits(j + sq) && (base < 0 || Math.abs(j - target) < Math.abs(base - target))) base = j; });
  if (base < 0) return null;
  const i0 = base + sq;
  const idx = steps.map(x => i0 + x);
  const want = op === 'answer' ? 0 : op === 'question' ? 2 : land;
  const li = landIndex(lad, idx[idx.length - 1], chord, want); if (li < 0) return null;
  idx[idx.length - 1] = li;
  if (t0 < 0) t0 = t;
  const prev = notes[notes.length - 1];
  if (prev && prev.t + prev.d > t0) { if (prev.t + 0.25 <= t0) prev.d = +(t0 - prev.t).toFixed(4); else t0 = prev.t + prev.d; }
  let u = t0;
  idx.forEach((j, n) => { const last = n === idx.length - 1; notes.push(N(lad[j].s, lad[j].f, u, rhythm[n], last ? '~' : null)); u += rhythm[n]; });
  return base;
}
/**
 * One phrasing exercise from a spec: { id, name ('{key}', '{motif}', '{chords}', '{scale}'), method, motif,
 * plan (one entry per bar: an OPS id, null for a rest bar, or { op, reg, dens, land, motif, box, key }),
 * prog, scale, box, land (0 root, 1 third, 2 fifth), goal, start, dl, domain, unit, why, instr, watch, simplify }.
 */
export function phr(c, spec) {
  const k0 = minorKey(c), scale = spec.scale || 'pent', progOf = PROGS[spec.prog || 'minorRock'];
  const chords = progOf(k0), notes = [], plan = [], usedMotifs = []; let near = null, lastKey = null, lastReg = 0;
  for (const [bar, item0] of (spec.plan || ['state', null, 'repeat', null]).entries()) {
    if (item0 == null) continue;
    const item = typeof item0 === 'string' ? { op: item0 } : item0;
    const k = mod12(k0 + (item.key || 0)), home = item.box || spec.box || 1, box = (item.reg || 0) > 0 && !item.box ? ((home + 1) % 5) + 1 : home, lad = ladder(k, box, scale);   // the peak (reg 1) moves two boxes up the neck
    const motif = MOTIFS[item.motif || spec.motif || 'sigh'];
    const chord = chordInfo(progOf(k)[bar % progOf(k).length]); if (!chord) return null;
    if (k !== lastKey || item.box || (item.reg || 0) !== lastReg) near = null;   // a new key, box or register: start fresh
    const t = bar * 4, start = notes.length;
    const got = phraseAt(notes, lad, motif, item.op || 'state', t, chord, { reg: item.reg || 0, dens: item.dens || 1, land: item.land != null ? item.land : spec.land, near });
    if (got == null) return null;
    near = got; lastReg = item.reg || 0; plan.push([notes[start].t, k, scale, chord.pcs]); lastKey = k; usedMotifs.push(motif.name);
  }
  if (notes.length < 3 || notes.length > 400) return null;
  const bars = (spec.plan || []).length || 4;
  const fill = s => s.replace('{key}', `${nameOf(k0)} minor`).replace('{motif}', MOTIFS[spec.motif || 'sigh'].name).replace('{chords}', chords.join(' – ')).replace('{scale}', SCALE_NAME[scale]);
  const ex = make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'improv', method: spec.method, unit: spec.unit || 'phrases',
    goal: spec.goal || 76, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    backing: Array.from({ length: Math.max(chords.length, Math.min(bars, 16)) }, (_, i) => chords[i % chords.length]), chords,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes, beats: Math.max(bars * 4, Math.ceil(Math.max(...notes.map(n => n.t + n.d)) / 4 - 1e-6) * 4) }
  });
  KEY_PLAN.set(ex, plan); return ex;
}
const P_ = (id, name, method, opts) => c => phr(c, { id, name, method, ...opts });

/* ----------------------------- Plans with chance ----------------------------- */
const OP_POOL = ['state', 'seqDown', 'seqUp', 'disp', 'pickup', 'tail', 'trunc', 'invert', 'answer', 'question'];
/** Random access: a random motif, development, key and box for each phrase, a rest bar after each. */
export function phrRandomPlan(c) {
  const r = rng(733 + (c.lvl || 9)), names = Object.keys(MOTIFS), out = [];
  for (let i = 0; i < 6; i++) { out.push({ op: OP_POOL[Math.floor(r() * OP_POOL.length)], motif: names[Math.floor(r() * names.length)], key: [0, 5, 10, 3, 7, 2][Math.floor(r() * 6)], box: 1 + Math.floor(r() * 5) }); out.push(null); }
  return out;
}
export function phrRandom(c) {
  const plan = phrRandomPlan(c), list = plan.filter(Boolean).map(p => `${MOTIFS[p.motif].name.split(' (')[0]}, ${OPS[p.op]}, in ${nameOf(minorKey(c) + p.key)} minor box ${p.box}`);
  return phr(c, { id: 'phr-random', name: 'Random access: a new motif, change, key and box every phrase', method: 'interleaving', plan, prog: 'minorRock', goal: 72, start: 48, dl: 1,
    why: 'At mastery level the development of a phrase is a choice made on the spot. Every phrase here asks for a different motif, a different change, a different key and box: nothing can run on autopilot.',
    instr: `${list.join(' → ')}. Read only the words: build each phrase from the description, then rest a bar. Pass: all six phrases from the words alone, each landing on a chord tone.`,
    watch: 'Falling back on the same favourite lick in every key.', simplify: 'The first three phrases.' });
}

/* --------------------------------- The path --------------------------------- */
const LISTEN = 'Play only what is written, then stop: the rest bars are part of the music. Count them aloud (“1 2 3 4”) and keep the left hand on the strings to stop them ringing. ';
const ARC = [{ op: 'state', reg: -1 }, null, { op: 'repeat', reg: -1 }, null, { op: 'seqUp', reg: 0 }, null, { op: 'tail', reg: 0 }, null, { op: 'state', reg: 1, dens: 2 }, { op: 'seqUp', reg: 1, dens: 2 }, { op: 'pickup', reg: 1 }, null, { op: 'state', reg: 1, dens: 2 }, { op: 'answer', reg: 0 }, null, { op: 'augment', reg: -1 }];
export default entry({
  id: 'phrasing', kind: 'subject', title: 'Phrasing and space', domain: 'improv',
  re: /phras(e|ing)|\bspace\b|leav(e|ing) space|motif|call and response|melodic solo/,
  aliases: ['space in solos', 'motif development', 'call and response'],
  summary: 'Soloing in phrases like a singer: a bar of melody and a bar of silence, motifs stated, repeated, sequenced, displaced and answered, landing notes chosen from the chord, colour notes on purpose, and whole solos with a shape.',
  prereqs: ['pentatonic', 'vibrato'],
  sources: ['https://www.premierguitar.com/articles/29793-how-to-craft-more-melodic-solos', 'https://guitarplayer.com/lessons/amazing-phrasing-10-ways-to-improve-your-solos', 'https://www.guitarworld.com/lessons/david-gilmour-10-lead-guitar-ideas', 'https://www.musicradar.com/how-to/david-gilmour-guitar-lesson-pink-floyd', 'https://riffhard.com/?p=36564'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Play, then leave space',
      'Play one bar of melody and leave one bar of silence for 8 bars at 70 BPM without the silence ringing, sing a phrase in the rest before playing it, land each phrase on the chord’s root from memory, and play a short call-and-response solo over a minor progression.', [
        S('phr-space', 'Phrase and rest', 'improv', 'A bar of melody, a bar of silence.', [
          P_('phr-one-one', 'One bar of melody, one bar of silence: {motif} over {chords}', 'chunking', { motif: 'sigh', plan: ['state', null, 'repeat', null, 'state', null, 'repeat', null], goal: 70, start: 46, why: 'Space is what turns notes into phrases: the listener hears the idea, then has a moment to take it in. One short motif per bar, followed by a whole bar of silence, is the smallest piece of phrasing to learn first.', instr: LISTEN + 'Bars 1, 3, 5, 7: {motif}, the last note held with vibrato. Bars 2, 4, 6, 8: silence. Pass: all 8 bars in time, with silent rest bars and every phrase starting exactly on beat 1.', watch: 'Filling the rest bar with "just one more" note.', simplify: 'Half the tempo, or only bars 1–4.' }),
          P_('phr-two-two', 'Two bars of melody, two of silence, counted aloud ({key})', 'accurate-reps', { motif: 'rise', plan: ['state', 'repeat', null, null, 'state', 'repeat', null, null], goal: 70, start: 46, why: 'Counting the silence aloud makes it as exact as the notes. Only runs with the rests counted and silent count; that is how the habit of space is built.', instr: LISTEN + 'Two bars of {motif}, then two bars of silence counted aloud. Count only clean passes. Pass: 4 passes in a row with every rest bar silent and counted.', watch: 'Rushing back in on the last beat of the rest.', simplify: 'Count only, no playing, for one pass first.' })]),
        S('phr-hear', 'Hear it first', 'ear', 'Sing the phrase, then play it.', [
          P_('phr-sing-rest', 'Sing it in the rest, then play it ({key})', 'audiation', { motif: 'call', plan: ['state', null, 'repeat', null, 'state', null, 'repeat', null], goal: 66, start: 44, why: 'A phrase you can sing is a phrase you mean. Singing (or humming) the motif in the silent bar, then playing it, joins the ear to the fingers, and keeps the rest bars musical instead of empty.', instr: 'Play {motif} in bar 1; in bar 2 sing it back, in time, without playing; play it again in bar 3. Same for bars 5–8. Pass: every sung version matches the rhythm and shape of the played one.', watch: 'Singing a different rhythm from the one you play.', simplify: 'Hum only the rhythm on one pitch.' }),
          P_('phr-echo', 'Hear the answer before you play it: {motif}, answered on the root ({key})', 'audiation', { motif: 'cry', plan: ['state', null, 'answer', null, 'seqDown', null, 'answer', null], goal: 66, start: 44, why: 'An answer that you hear in your head first sounds like a reply, not a reflex. Hearing (and humming) where the answer will land, before the fingers move, is how phrases start to talk to each other.', instr: 'Play the call (bar 1). In the silent bar, hum the answer you are about to play, ending on the root. Then play it (bar 3). Same for bars 5–8. Pass: every hummed answer matches the played one, and every answer ends on the root.', watch: 'Humming one thing and playing another.', simplify: 'Hum only the last note of the answer (the root).' })]),
        S('phr-land', 'Where a phrase lands', 'theory', 'The last note decides how it sounds.', [
          P_('phr-land-root', 'From memory: land every phrase on the chord’s root ({chords})', 'retrieval', { motif: 'sigh', land: 0, plan: ['state', null, 'seqDown', null, 'state', null, 'answer', null], goal: 70, start: 46, why: 'A phrase that ends on the root of the chord under it sounds finished; ending anywhere else leaves a question. Finding that root in the box from memory, as the chord changes, is the first skill of note choice.', instr: 'Before each phrase, name the chord of that bar and find its root in the box. The tab lands on it; cover the tab after one pass and land from memory. Pass: every phrase lands on the right root without looking.', watch: 'Landing on the key’s root over every chord.', simplify: 'Only the first chord.' }),
          P_('phr-last-note', 'Make the last note sing: held, with vibrato, then silence ({key})', 'external-focus', { motif: 'rise', land: 1, plan: ['state', null, 'repeat', null, 'state', null, 'question', null], goal: 66, start: 44, why: 'The last note of a phrase is what the listener remembers. Holding it its full length with an even vibrato, and letting it end cleanly before the rest, is what makes a phrase sound like a voice.', instr: 'Play each phrase and listen only to its last note: hold it the whole value with vibrato, then stop it exactly on the next beat by releasing pressure. Pass: every last note sustains and ends cleanly, 4 phrases in a row.', watch: 'Cutting the last note short to get ready for the next one.', simplify: 'No vibrato, just the full length.' })]),
        S('phr-first-music', 'First music', 'improv', 'A call-and-response solo.', [
          P_('phr-first-solo', 'First solo: call and response over {chords}', 'transfer', { motif: 'call', plan: ['state', null, 'answer', null, 'seqDown', null, 'answer', null], goal: 70, start: 46, why: 'A first solo built from one motif: stated, answered on the root, moved down a step, answered again. Four phrases, four silences, and it already sounds like music.', instr: 'Play the solo over the backing; then replace the answers (bars 3 and 7) with your own phrases that land on the root. Pass: the written solo in time, then your version with the rest bars kept.', watch: 'Answers that are longer than the calls.', simplify: 'Only the calls, with the backing.' }),
          M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'Motifs and how to develop them',
      'Develop one motif by repetition, a changed ending, sequence, rhythmic displacement and pickups at 80 BPM, add the Dorian 6th as a colour note over a minor vamp, land on the 3rd of each chord from memory in box 2, and play an 8-bar solo built from one motif.', [
        S('phr-motif', 'Repeat and vary', 'improv', 'Say it, say it again, change it.', [
          P_('phr-repeat-vary', 'Say it, say it again, change the ending: {motif} ({key})', 'variable', { motif: 'turn', plan: ['state', 'repeat', 'tail', null, 'state', 'repeat', 'trunc', null], goal: 76, start: 50, why: 'Repetition makes a motif memorable; changing it the third time makes it surprising. "Same, same, different" is the oldest shape in melody, from the blues to Pink Floyd.', instr: 'Bars 1–2: {motif} twice. Bar 3: the same start, a new longer ending. Then again with a shorter ending. Pass: the plan in time, then a version with your own third-bar change.', watch: 'Changing the motif already the second time.', simplify: 'Bars 1–4 only.' }),
          P_('phr-sequence', 'Sequence the motif down the scale ({key})', 'variable', { motif: 'call', plan: ['state', 'seqDown', 'seqDown2', null, 'state', 'seqUp', 'answer', null], goal: 76, start: 50, why: 'Moving a motif one scale step at a time (a sequence) keeps it recognisable while the melody travels. It is how a solo moves through the box without running scales.', instr: 'The motif, then one step lower, then two steps lower; rest. Then up a step and answered on the root. Name the first note of each version. Pass: the plan in time, then the same plan starting from the B string.', watch: 'Changing the rhythm when the notes move.', simplify: 'Two versions of the motif.' })]),
        S('phr-rhythm', 'Where it starts in the bar', 'rhythm', 'Same notes, new place in time.', [
          P_('phr-displace', 'Rhythmic displacement: on 1, on the "and", on 2 ({key})', 'variable', { motif: 'rise', plan: ['state', null, 'disp', null, 'disp2', null, 'state', null], goal: 76, start: 50, why: 'The same notes starting somewhere else in the bar sound like a new idea. Displacing a motif an 8th or a beat later is the quickest way to make a solo less predictable.', instr: 'The motif on beat 1, then starting on the "and" of 1, then on beat 2, then back on 1. Count 8th notes aloud. Pass: every start exactly where written.', watch: 'Pulling the displaced start back to the beat.', simplify: 'Only the beat-2 version.' }),
          P_('phr-pickup', 'Pickups: start the phrase an 8th before the bar ({key})', 'chunking', { motif: 'cry', plan: [null, 'pickup', null, 'pickup', null, 'pickup', null, 'answer'], goal: 76, start: 50, why: 'Blues players (B.B. King, and Gilmour after him) often start a phrase on the last 8th of the bar before, so it leans into the downbeat. Practise the pickup alone, then the phrase.', instr: 'Chunk it: first only the pickup note into the downbeat, then the whole phrase. The first note falls on the "and" of 4 of the rest bar. Pass: 4 phrases in a row whose second note lands exactly on beat 1.', watch: 'Starting late, on beat 1.', simplify: 'Pickup and first note only.' })]),
        S('phr-choice', 'Note choice', 'theory', 'Colour notes and chord tones.', [
          P_('phr-dorian', 'The Dorian 6th as a colour note over {chords}', 'external-focus', { motif: 'turn', scale: 'dorian', prog: 'dorian', plan: ['state', null, 'repeat', null, 'seqDown', null, 'answer', null], goal: 72, start: 48, why: 'Adding the 2nd and the major 6th to the minor pentatonic (the Dorian mode) gives a warm, bittersweet colour over a minor vamp: a Gilmour habit. The motif turns around the 5th and touches the 6th.', instr: 'Play the phrases over the vamp and listen to the note right after the first one (the 6th): hear how it brightens the minor chord. Then play the same plan with the ♭6 instead and hear the darker colour. Pass: the plan in time, then two phrases of your own that use the 6th.', watch: 'Landing on the 6th: it is a colour on the way, not a resting note.', simplify: 'Only bars 1–2.' }),
          P_('phr-thirds-box2', 'From memory: land on each chord’s 3rd in box 2 ({chords})', 'retrieval', { motif: 'sigh', box: 2, land: 1, plan: ['state', 'seqDown', 'state', 'answer', 'state', 'seqDown', 'state', 'answer'], goal: 76, start: 50, why: 'The 3rd of a chord says major or minor: landing on it makes the solo follow the harmony. Finding each chord’s 3rd in a box away from home, from memory, is the retrieval that changes-playing needs.', instr: 'Name each bar’s chord and its 3rd before you play; the tab lands on it (or the nearest chord tone when the 3rd isn’t in the scale). Cover the tab after one pass. Pass: every landing from memory.', watch: 'Defaulting to the root.', simplify: 'Two bars on, two bars rest.' })]),
        S('phr-qa', 'Questions, answers, mixtures', 'improv', 'Many changes, one idea.', [
          P_('phr-mixed-ops', 'A different change every phrase: {motif} ({key})', 'interleaving', { motif: 'call', plan: ['state', null, 'invert', null, 'disp', null, 'seqUp', null, 'tail', null, 'pickup', null, 'trunc', null, 'answer', null], goal: 76, start: 50, why: 'Mixing the development operations (inversion, displacement, sequence, a new tail, a pickup) instead of practising one at a time forces a decision before every phrase, which is what improvising is.', instr: 'Eight versions of {motif}: inverted, displaced, a step higher, with a tail, with a pickup, cut short, and answered. Say the change before each phrase. Pass: all eight in time, then the same eight changes in a different order.', watch: 'All the versions drifting toward the same one.', simplify: 'The first four phrases.' }),
          P_('phr-question-answer', 'Question on the 5th, answer on the root ({key})', 'variable', { motif: 'rise', plan: ['question', 'answer', 'question', 'answer', 'question', 'answer', 'question', 'answer'], goal: 76, start: 50, why: 'A phrase that ends on the 5th sounds open, like a question; one that ends on the root closes it. Pairing them is call and response inside one solo.', instr: 'Odd bars end on the 5th, even bars on the root. Then improvise your own pairs with the same endings. Pass: four written pairs, then four of your own.', watch: 'Questions and answers that sound the same.', simplify: 'Two pairs.' })]),
        S('phr-music', 'In music', 'improv', 'A solo built from one motif.', [
          P_('phr-motif-solo', 'An 8-bar solo from one motif over {chords}', 'transfer', { motif: 'turn', plan: ['state', 'repeat', 'tail', null, 'seqDown', 'disp', 'answer', null], goal: 76, start: 50, why: 'A whole solo can grow from one idea: stated, repeated, extended, moved, displaced and answered. The listener follows it because it keeps coming back.', instr: 'Play the solo, then write your own 8 bars from a motif of your own with the same plan. Pass: both versions in time with the rest bars kept.', watch: 'Abandoning the motif after two bars.', simplify: 'Bars 1–4.' }),
          c => targetGuide(c, { prog: 'slowBlues', scale: 'minorPent', name: 'Slow blues: two bars of melody, two bars of space' })])
      ], [4, 6]),
    stage('advanced', 'Shape a whole solo',
      'Play a 16-bar solo with a shape (low and sparse, climbing, denser at the peak, settling) at 84 BPM, raise the density from 2 to 8 notes a bar on purpose, retarget a motif to each chord, play the same motif in four keys and four boxes, and play a Dorian ballad solo with pickups and space.', [
        S('phr-arc', 'The arc', 'improv', 'Beginning, climb, peak, ending.', [
          P_('phr-arc', 'A 16-bar solo with a shape over {chords}', 'chunking', { motif: 'call', plan: ARC, goal: 80, start: 52, why: 'Good solos have a shape: they start low and sparse, climb, get denser and higher at the peak, and settle at the end. Learning one in 4-bar chunks shows how register, density and space build that arc.', instr: 'Learn it 4 bars at a time: bars 1–4 low with space, 5–8 a step up, 9–12 high and dense (the peak), 13–16 back down to a slow landing. Pass: the 16 bars in time, then your own 16 bars to the same plan.', watch: 'Peaking in the first four bars.', simplify: 'Bars 1–8.' }),
          P_('phr-density', 'Density on purpose: from 3 notes a bar to 7 ({key})', 'variable', { motif: 'turn', plan: [{ op: 'trunc' }, null, { op: 'state' }, null, { op: 'state', dens: 2 }, null, { op: 'seqUp', dens: 2 }, { op: 'answer' }], goal: 80, start: 52, why: 'How many notes you play is a choice that builds or releases tension. Changing the density on purpose, while the motif stays the same, is the control that makes a climax possible.', instr: 'The same motif cut short, as written, then doubled (twice the notes in the same bar), then doubled and moved up, then answered. Pass: every bar at its density, in time.', watch: 'Rushing the doubled bars.', simplify: 'Bars 1–4.' })]),
        S('phr-changes', 'Following the changes', 'improv', 'The motif moves with the chords.', [
          P_('phr-retarget', 'From memory: the motif retargeted to every chord’s 3rd ({chords})', 'retrieval', { motif: 'sigh', land: 1, plan: ['state', 'state', 'state', 'state', 'seqUp', 'seqUp', 'seqUp', 'answer'], goal: 80, start: 52, why: 'Playing the same motif over every chord, but landing it on that chord’s 3rd, makes one idea follow the harmony: the motif-and-target approach of melodic soloists.', instr: 'Same motif every bar, each landing on the 3rd of the bar’s chord (or the nearest chord tone in the scale). Cover the tab after one pass. Pass: 8 bars from memory, every landing correct.', watch: 'Landing on the same note over every chord.', simplify: 'Two chords.' }),
          P_('phr-blues-changes', 'Motifs over the dominant blues ({chords})', 'variable', { motif: 'cry', prog: 'blues', plan: ['state', 'repeat', 'tail', null, 'pickup', 'seqDown', 'answer', null], goal: 80, start: 52, why: 'Over dominant 7th chords the minor pentatonic’s landing notes change with each chord: the same cry motif lands on the root, the 5th or the ♭7, whichever belongs to the chord.', instr: 'Play the phrases over the blues; notice which chord tone each landing is. Then improvise with the same plan. Pass: the plan in time, then your own 8 bars.', watch: 'Landing on the ♭3 over the IV chord.', simplify: 'Bars 1–4.' })]),
        S('phr-keys', 'Any key, any box', 'fretboard', 'The same motif anywhere.', [
          P_('phr-keys', 'One motif in four keys around the cycle of fourths', 'interleaving', { motif: 'call', plan: [{ op: 'state' }, { op: 'answer' }, { op: 'state', key: 5 }, { op: 'answer', key: 5 }, { op: 'state', key: 10 }, { op: 'answer', key: 10 }, { op: 'state', key: 3 }, { op: 'answer', key: 3 }], goal: 78, start: 50, why: 'A motif is a shape in degrees, so it moves with the key. Changing key every two bars means finding the motif and its landing instantly in a new place.', instr: 'Call and answer in the home key, then a 4th up, and twice more. The chords move with each key. Pass: all four keys without stopping.', watch: 'The rhythm changing as the key changes.', simplify: 'Two keys.' }),
          P_('phr-boxes', 'One motif in boxes 1, 2, 4 and 5 ({key})', 'interleaving', { motif: 'rise', plan: [{ op: 'state', box: 1 }, { op: 'answer', box: 1 }, { op: 'state', box: 2 }, { op: 'answer', box: 2 }, { op: 'state', box: 4 }, { op: 'answer', box: 4 }, { op: 'state', box: 5 }, { op: 'answer', box: 5 }], goal: 78, start: 50, why: 'The same motif in another box sits under different fingers and in another register. Moving it box by box makes the idea independent of one hand shape.', instr: 'Call and answer in box 1, then 2, 4 and 5. Name the first degree in each box before playing. Pass: all four boxes in time.', watch: 'Shifting box late and missing the downbeat.', simplify: 'Boxes 1 and 2.' })]),
        S('phr-adv-music', 'In a solo', 'improv', 'A ballad solo with space.', [
          P_('phr-dorian-ballad', 'Ballad study: pickups, colour and space over {chords}', 'transfer', { motif: 'cry', scale: 'dorian', prog: 'dorian', plan: [null, 'pickup', null, 'seqDown', null, { op: 'tail', reg: 1 }, null, { op: 'augment' }], goal: 76, start: 48, why: 'A slow minor vamp, the Dorian colour, phrases that lean in from a pickup, and whole bars of silence: an original study in the singing, spacious ballad style of Gilmour.', instr: 'Play it with a clean tone and long notes, every landing with vibrato. Then improvise 8 bars with the same plan. Pass: the study in time, then your own version.', watch: 'Filling the silences.', simplify: 'Bars 1–4.' }),
          c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp solo: one motif, developed, with space' })])
      ], [7, 8]),
    stage('mastery', 'Your own voice',
      'Develop any motif in any key and box on demand, play a 32-bar solo with a clear arc at performance tempo, and perform your own 16-bar study that uses every development of the path.', [
        S('phr-random', 'Anything, on the spot', 'improv', 'No warning.', [c => phrRandom(c),
          P_('phr-recall-motifs', 'From memory: all six motifs, each answered ({key}, box 3)', 'retrieval', { box: 3, plan: [{ op: 'state', motif: 'sigh' }, { op: 'answer', motif: 'sigh' }, { op: 'state', motif: 'rise' }, { op: 'answer', motif: 'rise' }, { op: 'state', motif: 'call' }, { op: 'answer', motif: 'call' }, { op: 'state', motif: 'turn' }, { op: 'answer', motif: 'turn' }, { op: 'state', motif: 'leap' }, { op: 'answer', motif: 'leap' }, { op: 'state', motif: 'cry' }, { op: 'answer', motif: 'cry' }], goal: 80, start: 52, why: 'Six motifs (sigh, rise, call, turn, leap, cry) are a vocabulary. Recalling each by name in a box away from home, and answering it, makes them yours.', instr: 'Cover the tab. In box 3, play each motif by name, then its answer on the root. Pass: all six from memory.', watch: 'Mixing up the rhythms of similar motifs.', simplify: 'Three motifs.' })]),
        S('phr-performance', 'A long solo at tempo', 'improv', 'Thirty-two bars with a shape.', [
          P_('phr-long-arc', 'A 32-bar solo with an arc at performance tempo ({key})', 'edge', { motif: 'turn', plan: [...ARC, ...ARC.map(x => (x ? { ...x, key: 5 } : null))], goal: 92, start: 60, why: 'At performance tempo the shape still has to be there: space early, the climb, a dense peak, a settled ending, and a second chorus in the IV key that does it again.', instr: 'Tempo ladder: start where every phrase is in time, add a few BPM after each clean pass. The second 16 bars are in the key a 4th up. Pass: all 32 bars at the goal tempo with the rest bars kept.', watch: 'Losing the space as the tempo rises.', simplify: 'The first 16 bars.' }),
          c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: build to one climax and land' })]),
        S('phr-voice', 'Your own voice', 'improv', 'A study, then your version.', [
          P_('phr-capstone-etude', 'Capstone study: a 16-bar piece that develops one motif ({key})', 'transfer', { motif: 'call', scale: 'dorian', prog: 'dorian', plan: ['state', null, 'repeat', 'tail', null, 'seqDown', 'invert', null, { op: 'pickup', reg: 1 }, { op: 'state', reg: 1, dens: 2 }, { op: 'seqUp', reg: 1, dens: 2 }, null, 'disp', 'question', null, { op: 'augment', land: 0 }], goal: 80, start: 52, dl: 1, minutes: 8, why: 'An original piece that uses every development of the path on one motif: statement, repetition, a new tail, sequence, inversion, a pickup into a dense peak two boxes up the neck, displacement, a question, and a slow, augmented landing, with the Dorian colour and real silences.', instr: 'Learn it 4 bars at a time, naming each phrase’s change. Then write your own 16 bars from your own motif with the same plan. Pass: the study at the goal tempo, then your own version once.', watch: 'Rushing the silences after the peak.', simplify: 'Bars 1–8.' }),
          c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Your motif, developed for 32 bars over a Dorian vamp' })])
      ], [9, 10])
  ]
});
