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
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-16: space and breathing between
// phrases, singing what you play, the singer's AAB line over a blues, call and response, a motif stated
// and varied (repetition, sequence, rhythm, articulation), resolving on chord tones and adjusting a line to
// the changes, then the shape (arc) of a whole solo. Removed: humming the answer before playing it,
// covering the tab, and naming chords, degrees and changes aloud before each phrase (no source does it).
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
  blues12: k => [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map(x => nameOf(k + x) + '7'),
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
function phraseAt(notes, lad, motif, op, t, chord, { reg = 0, dens = 1, land = null, near = null, art = false } = {}) {
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
  // art: the same notes articulated: a move along the same string is a hammer-on or pull-off (one or two frets) or a slide (three or more)
  const artMark = n => { if (!art || n === 0) return null; const a = lad[idx[n - 1]], b = lad[idx[n]]; if (a.s !== b.s || a.f === b.f) return null; const up = b.f > a.f, w = Math.abs(b.f - a.f); return w >= 3 ? (up ? '/' : '\\') : (up ? 'h' : 'p'); };
  idx.forEach((j, n) => { const last = n === idx.length - 1; notes.push(N(lad[j].s, lad[j].f, u, rhythm[n], artMark(n) || (last ? '~' : null))); u += rhythm[n]; });
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
    const got = phraseAt(notes, lad, motif, item.op || 'state', t, chord, { reg: item.reg || 0, dens: item.dens || 1, land: item.land != null ? item.land : spec.land, near, art: !!item.art });
    if (got == null) return null;
    near = got; lastReg = item.reg || 0; plan.push([notes[start].t, k, scale, chord.pcs]); lastKey = k; usedMotifs.push(motif.name);
  }
  if (notes.length < 3 || notes.length > 400) return null;
  const bars = (spec.plan || []).length || 4;
  const fill = s => s.replace('{key}', `${nameOf(k0)} minor`).replace('{motif}', MOTIFS[spec.motif || 'sigh'].name).replace('{chords}', [...new Set(chords)].join(' – ')).replace('{scale}', SCALE_NAME[scale]);
  const ex = make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'improv', method: spec.method, unit: spec.unit || 'phrases',
    goal: spec.goal || 76, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    backing: Array.from({ length: Math.max(chords.length, Math.min(bars, 16)) }, (_, i) => chords[i % chords.length]), chords: [...new Set(chords)],
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
  return phr(c, { id: 'phr-random', name: 'A new motif, change, key and box every phrase', method: 'interleaving', plan, prog: 'minorRock', goal: 72, start: 48, dl: 1,
    why: 'At mastery level the development of a phrase is a choice made on the spot. Every phrase here asks for a different motif, a different change, a different key and box: nothing can run on autopilot.',
    instr: `${list.join(' → ')}. Play each written phrase, then rest a bar; on the second pass play your own phrase in each slot with the same change, key and box. Pass: all six written phrases in time, then six of your own, each landing on a chord tone.`,
    watch: 'Falling back on the same favourite lick in every key.', simplify: 'The first three phrases.' });
}

/* --------------------------------- The path --------------------------------- */
const LISTEN = 'Play only what is written, then stop: the rest bars are part of the music. Count them (“1 2 3 4”) and keep the left hand on the strings to stop them ringing. ';
const ARC = [{ op: 'state', reg: -1 }, null, { op: 'repeat', reg: -1 }, null, { op: 'seqUp', reg: 0 }, null, { op: 'tail', reg: 0 }, null, { op: 'state', reg: 1, dens: 2 }, { op: 'seqUp', reg: 1, dens: 2 }, { op: 'pickup', reg: 1 }, null, { op: 'state', reg: 1, dens: 2 }, { op: 'answer', reg: 0 }, null, { op: 'augment', reg: -1 }];
const ST = (concept, why, theory) => ({ concept, why, theory });
const STUDY = {
  'phr-space': ST('A phrase is a short musical sentence; the silence after it is part of the music, like a singer taking a breath.', 'Space lets the listener take in what you played and gives you time to plan the next idea.', ['Count the rest bars so the silence is exact.', 'Stop the strings ringing in the rests.']),
  'phr-hear': ST('Singers shape lines by breath, and a blues verse has three four-bar lines: a line, the same line again, and a line that sums them up, each with space at its end.', 'A solo shaped like a sung verse is easy to follow and sounds like it is saying something.', ['A 12-bar blues = three four-bar phrases.', 'Repeat the second line exactly: the repetition is what makes the third line land.']),
  'phr-land': ST('The last note of a phrase decides how it sounds: a chord tone (root, 3rd or 5th of the chord under it) sounds settled; another note sounds unfinished.', 'Choosing the landing note is the simplest way to make a solo follow the chords.', ['The root sounds most final, the 5th more open.', 'The landing note changes when the chord changes.']),
  'phr-first-music': ST('Call and response: one phrase asks, the next answers, usually ending on the root.', 'It is the conversation at the heart of the blues and of most melodic soloing.', ['Answers are usually no longer than the call.']),
  'phr-motif': ST('A motif is a short idea (a few notes and a rhythm). It is developed by repeating it, changing its ending, moving it along the scale (a sequence), or changing how it is articulated.', 'A solo built from a developed motif hangs together: the listener recognises the idea each time it returns.', ['Same, same, different: the third version is the surprise.', 'A sequence moves every note the same number of scale steps.', 'Hammer-ons, pull-offs and slides change the sound of the same notes.']),
  'phr-rhythm': ST('The same notes started somewhere else in the bar (displaced) or an 8th before the bar (a pickup) sound like a new idea.', 'Rhythm is half of phrasing; moving where a phrase starts is the quickest way out of predictable solos.', ['Displacement by an 8th or a beat keeps the notes, changes the accent.', 'A pickup leans into the downbeat.']),
  'phr-choice': ST('Colour notes outside the pentatonic (the 2nd and 6th of Dorian) add tension on the way; chord tones (the 3rd above all) release it.', 'Tension and release is what makes a melody move forward.', ['Dorian = minor pentatonic + 2 + 6.', 'The 3rd of a chord says major or minor.']),
  'phr-qa': ST('Mixing the developments (inversion, displacement, sequence, new tail, pickup) and pairing questions on the 5th with answers on the root.', 'Improvising is choosing a development for each phrase.', ['An inverted motif turns every step upside down.', 'Question on the 5th, answer on the root.']),
  'phr-music': ST('An 8-bar solo from one motif: stated, repeated, extended, moved, displaced and answered.', 'One idea, developed, is a solo; many unrelated ideas are a list.', ['Return to the motif to tie the solo together.']),
  'phr-arc': ST('A solo has a shape: it starts low and sparse, climbs, gets higher and denser at the peak, then settles. Density (notes per bar) is a choice that builds or releases tension.', 'The arc is what makes a solo feel like a story with a climax.', ['Higher register and more notes raise the intensity.', 'Plan the peak for the last third of the solo.']),
  'phr-changes': ST('A motif can keep its shape while its notes change to fit each chord, landing on that chord’s 3rd or another chord tone.', 'One idea that follows the harmony sounds composed rather than improvised over.', ['Over dominant 7th chords the landing notes change with each chord.']),
  'phr-keys': ST('A motif is a shape in scale degrees, so it can be played in any key and any box.', 'Ideas that live in degrees, not in one hand shape, are usable anywhere on the neck.', ['Up a 4th: everything moves five frets up (or seven down).']),
  'phr-adv-music': ST('A ballad study: pickups, the Dorian colour, long notes and whole bars of silence.', 'Slow, spacious playing is where phrasing is most exposed.', ['Every long note needs vibrato and a clean ending.']),
  'phr-random': ST('Every phrase a different motif, development, key and box: the conversation on the spot.', 'Real improvising is responding to what just happened.', ['After each written phrase, answer with your own.']),
  'phr-performance': ST('A 32-bar solo with an arc at performance tempo: the shape must survive the speed.', 'At tempo the space is the first thing to disappear.', ['Keep the rest bars even when the tempo rises.']),
  'phr-voice': ST('A capstone study that develops one motif through every change in the path, then your own on the same plan.', 'Your phrasing is your voice on the instrument.', ['Learn it four bars at a time.'])
};
const path = entry({
  id: 'phrasing', kind: 'subject', title: 'Phrasing and space', domain: 'improv',
  re: /phras(e|ing)|\bspace\b|leav(e|ing) space|motif|call and response|melodic solo/,
  aliases: ['space in solos', 'motif development', 'call and response'],
  summary: 'Soloing in phrases like a singer: a bar of melody and a bar of silence, motifs stated, repeated, sequenced, displaced and answered, landing notes chosen from the chord, colour notes on purpose, and whole solos with a shape.',
  prereqs: ['pentatonic', 'vibrato'],
  sources: ['https://guitarworld.com/lessons/rut-busters-guitarists-part-3-8-phrasing', 'https://www.premierguitar.com/lessons/beyond-blues-phrasing-a-lost-art', 'https://blog.truefire.com/guitar-lessons/guitar-phrasing/', 'https://www.halleonard.com/product/695583', 'https://www.premierguitar.com/articles/29793-how-to-craft-more-melodic-solos', 'https://guitarplayer.com/lessons/amazing-phrasing-10-ways-to-improve-your-solos', 'https://www.guitarworld.com/lessons/david-gilmour-10-lead-guitar-ideas', 'https://www.musicradar.com/how-to/david-gilmour-guitar-lesson-pink-floyd', 'https://riffhard.com/?p=36564'],
  pedagogy: {
    date: '2026-10-16',
    summary: 'Phrasing is taught by learning from singers and horn players: breathe (leave space) between phrases, sing what you play, shape lines like a blues verse (a phrase, the same phrase again, a summary), talk in calls and answers, state a motif and vary it (repetition, sequence, rhythm, articulation), resolve on chord tones and adjust a line to the changes, and finally give a whole solo a structure with a beginning, a climb, a climax and an ending.',
    sequence: [
      { id: 'space', tier: 'foundations', step: 'Space: breathe between phrases', how: 'Pause between phrases as a singer or horn player must, to give the listener a rest and yourself time to plan the next idea.', skills: ['phr-space'], source: 0 },
      { id: 'singer', tier: 'foundations', step: 'Like a singer: sing your lines; the AAB blues verse', how: 'Sing the notes you play and breathe between phrases on purpose; follow the lyric form of a blues: the second line repeats the first exactly, the third sums both up, with space at the end of each line.', skills: ['phr-hear'], source: 1 },
      { id: 'resolve', tier: 'foundations', step: 'Where a phrase resolves', how: 'End one phrase on a non-chord tone so it sounds unfinished, then restate it and resolve on a chord tone.', skills: ['phr-land'], source: 0 },
      { id: 'call-response', tier: 'foundations', step: 'Call and response (question and answer)', how: 'Phrases that converse: a question answered by the next phrase, as in B.B. King, Chuck Berry and Albert King.', skills: ['phr-first-music', 'phr-qa'], source: 0 },
      { id: 'motif', tier: 'intermediate', step: 'Motivic development and articulation', how: 'Start with a short motif and develop it through more and more complex variations (repeat, vary the rhythm or pitch level); play the same phrase with different articulations: bends, slides, hammer-ons, pull-offs, vibrato.', skills: ['phr-motif'], source: 2 },
      { id: 'rhythm', tier: 'intermediate', step: 'Rhythmic phrasing', how: 'Accents, where a phrase starts in the bar and free-time phrasing as separate ways to vary a line.', skills: ['phr-rhythm'], source: 4 },
      { id: 'tension', tier: 'intermediate', step: 'Tension notes and colour', how: 'Move a motif up to a tension note (such as the 9th), then release it to the root or 5th.', skills: ['phr-choice'], source: 3 },
      { id: 'motif-solo', tier: 'intermediate', step: 'A solo built from one motif', how: 'A motif used as a thread through a whole solo, over a blues and over a minor vamp.', skills: ['phr-music', 'phr-adv-music'], source: 2 },
      { id: 'arc', tier: 'advanced', step: 'The arc of a solo', how: 'Shape the solo like a story (beginning, rising action, climax, conclusion) by moving up the neck, using faster rhythms and more notes toward the peak.', skills: ['phr-arc', 'phr-performance'], source: 2 },
      { id: 'changes', tier: 'advanced', step: 'Adjusting a line to the changes', how: 'Keep the shape of a repeated line and change its notes so it fits each chord; build motifs from tones the chords share.', skills: ['phr-changes'], source: 1 },
      { id: 'anywhere', tier: 'advanced', step: 'Motifs and sequences across the neck and in other keys', how: 'The same melodic ideas (motifs, sequences) moved to other positions and keys.', skills: ['phr-keys'], source: 4 },
      { id: 'conversation', tier: 'mastery', step: 'Respond on the spot', how: 'Play responsively, as a conversation: each phrase a reply to the last, whatever it asks for.', skills: ['phr-random'], source: 0 },
      { id: 'own', tier: 'mastery', step: 'A long solo of your own from motifs', how: 'Build a 32-bar solo from your own motifs, combining all the ideas, with space and a shape.', skills: ['phr-voice'], source: 3 }
    ],
    drills: ['One bar of melody, one bar of silence', 'Play a phrase, sing it back, play it again', 'The AAB blues chorus: phrase, the same phrase, a summary', 'Question on a non-chord tone or the 5th, answer on a chord tone', 'One motif repeated, sequenced, displaced and given a new ending', 'The same phrase plain, then with hammer-ons, pull-offs and slides', 'A motif adjusted to each chord of a progression', 'A 16- or 32-bar solo with a planned arc'],
    mistakes: ['No room to breathe: too many ideas, no space', 'Fearing silence, as if a pause meant running out of ideas', 'Not remembering what you played, so the next phrase can’t answer or repeat it', 'Staying in one place too long, so the solo has no shape', 'Notes with no articulation', 'Peaking too early'],
    sources: [
      { title: 'Rut-Busters for Guitarists, Part 3: Phrasing', author: 'Adrian Galysh (Guitar World)', url: 'https://guitarworld.com/lessons/rut-busters-guitarists-part-3-8-phrasing' },
      { title: 'Beyond Blues: Phrasing, a Lost Art', author: 'Corey Christiansen (Premier Guitar)', url: 'https://www.premierguitar.com/lessons/beyond-blues-phrasing-a-lost-art' },
      { title: 'How to Craft More Melodic Solos', author: 'Patrick Brennan (Premier Guitar)', url: 'https://www.premierguitar.com/articles/29793-how-to-craft-more-melodic-solos' },
      { title: 'Guitar phrasing', author: 'TrueFire (with Andy Timmons)', url: 'https://blog.truefire.com/guitar-lessons/guitar-phrasing/' },
      { title: 'Amazing Phrasing – Guitar: 50 Ways to Improve Your Improvisational Skills', author: 'Tom Kolb (Hal Leonard)', url: 'https://www.halleonard.com/product/695583' }
    ]
  },
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Play, then leave space',
      'Play one bar of melody and leave one bar of silence for 8 bars at 70 BPM without the silence ringing, sing a phrase back in the rest, play a singer’s AAB line over a 12-bar blues, land each phrase on the chord’s root, and play a short call-and-response solo over a minor progression.', [
        S('phr-space', 'Phrase and rest', 'improv', 'A bar of melody, a bar of silence.', [
          P_('phr-one-one', 'One bar of melody, one bar of silence: {motif} over {chords}', 'chunking', { motif: 'sigh', plan: ['state', null, 'repeat', null, 'state', null, 'repeat', null], goal: 70, start: 46, why: 'Space is what turns notes into phrases: the listener hears the idea, then has a moment to take it in. One short motif per bar, followed by a whole bar of silence, is the smallest piece of phrasing to learn first.', instr: LISTEN + 'Bars 1, 3, 5, 7: {motif}, the last note held with vibrato. Bars 2, 4, 6, 8: silence. Pass: all 8 bars in time, with silent rest bars and every phrase starting exactly on beat 1.', watch: 'Filling the rest bar with "just one more" note.', simplify: 'Half the tempo, or only bars 1–4.' }),
          P_('phr-two-two', 'Two bars of melody, two of silence, counted aloud ({key})', 'accurate-reps', { motif: 'rise', plan: ['state', 'repeat', null, null, 'state', 'repeat', null, null], goal: 70, start: 46, why: 'Counting the silence aloud makes it as exact as the notes. Only runs with the rests counted and silent count; that is how the habit of space is built.', instr: LISTEN + 'Two bars of {motif}, then two bars of silence counted aloud. Count only clean passes. Pass: 4 passes in a row with every rest bar silent and counted.', watch: 'Rushing back in on the last beat of the rest.', simplify: 'Count only, no playing, for one pass first.' })]),
        S('phr-hear', 'Like a singer', 'improv', 'Breathe between phrases; the singer’s AAB line.', [
          P_('phr-sing-rest', 'Breathe between phrases: play it, sing it back, play it again ({key})', 'transfer', { motif: 'call', plan: ['state', null, 'repeat', null, 'state', null, 'repeat', null], goal: 66, start: 44, why: 'Wind players and singers end a phrase where they need a breath. Singing the line you just played, in the silent bar, gives the rest a purpose and makes the next phrase sound like a voice, the way teachers such as Andy Timmons practise it.', instr: 'Play {motif} in bar 1; in bar 2 sing it back, in time, without playing; play it again in bar 3. Same for bars 5–8. Breathe in before each played phrase. Pass: every sung version matches the rhythm and shape of the played one.', watch: 'Singing a different rhythm from the one you play.', simplify: 'Hum only the rhythm on one pitch.' }),
          P_('phr-aab', 'A singer’s line over a 12-bar blues: say it, say it again, sum it up ({key})', 'chunking', { motif: 'cry', prog: 'blues12', plan: ['state', null, null, null, 'repeat', null, null, null, 'tail', 'answer', null, null], goal: 70, start: 46, why: 'A blues verse has three four-bar lines: the second repeats the first, the third sums both up, and each line leaves space at its end. Playing a solo chorus the same way (phrase, the same phrase again, a new answer) gives it the shape of a song.', instr: 'Bars 1–4: the phrase, then three bars of space. Bars 5–8: the same phrase exactly, over the IV chord. Bars 9–12: a new, longer version and an answer on the root, then space. Learn it four bars at a time. Pass: the chorus in time with the second line identical to the first, then a chorus of your own on the same plan.', watch: 'Changing the second phrase: repeat it exactly.', simplify: 'Bars 1–8.' })]),
        S('phr-land', 'Where a phrase lands', 'theory', 'The last note decides how it sounds.', [
          P_('phr-land-root', 'Land every phrase on the chord’s root ({chords})', 'variable', { motif: 'sigh', land: 0, plan: ['state', null, 'seqDown', null, 'state', null, 'answer', null], goal: 70, start: 46, why: 'A phrase that ends on the root of the chord under it sounds finished; ending anywhere else leaves a question. Landing on the root as the chord changes is the first skill of note choice.', instr: 'Play the phrases over the progression and listen to each landing note against its chord: the tab lands every phrase on that bar’s root. Then improvise four phrases of your own that do the same. Pass: the written phrases in time, then four of your own landing on the root.', watch: 'Landing on the key’s root over every chord.', simplify: 'Only the first chord.' }),
          P_('phr-last-note', 'Make the last note sing: held, with vibrato, then silence ({key})', 'external-focus', { motif: 'rise', land: 1, plan: ['state', null, 'repeat', null, 'state', null, 'question', null], goal: 66, start: 44, why: 'The last note of a phrase is what the listener remembers. Holding it its full length with an even vibrato, and letting it end cleanly before the rest, is what makes a phrase sound like a voice.', instr: 'Play each phrase and listen only to its last note: hold it the whole value with vibrato, then stop it exactly on the next beat by releasing pressure. Pass: every last note sustains and ends cleanly, 4 phrases in a row.', watch: 'Cutting the last note short to get ready for the next one.', simplify: 'No vibrato, just the full length.' })]),
        S('phr-first-music', 'First music', 'improv', 'A call-and-response solo.', [
          P_('phr-first-solo', 'First solo: call and response over {chords}', 'transfer', { motif: 'call', plan: ['state', null, 'answer', null, 'seqDown', null, 'answer', null], goal: 70, start: 46, why: 'A first solo built from one motif: stated, answered on the root, moved down a step, answered again. Four phrases, four silences, and it already sounds like music.', instr: 'Play the solo over the backing; then replace the answers (bars 3 and 7) with your own phrases that land on the root. Pass: the written solo in time, then your version with the rest bars kept.', watch: 'Answers that are longer than the calls.', simplify: 'Only the calls, with the backing.' }),
          M('transfer', ['callResponse', { chords: '$minorRock', scale: 'minorPent' }])])
      ], [1, 3]),
    stage('intermediate', 'Motifs and how to develop them',
      'Develop one motif by repetition, a changed ending, sequence, articulation, rhythmic displacement and pickups at 80 BPM, add the Dorian 6th as a colour note over a minor vamp, land on the 3rd of each chord in box 2, and play an 8-bar solo built from one motif.', [
        S('phr-motif', 'Repeat and vary', 'improv', 'Say it, say it again, change it.', [
          P_('phr-repeat-vary', 'Say it, say it again, change the ending: {motif} ({key})', 'variable', { motif: 'turn', plan: ['state', 'repeat', 'tail', null, 'state', 'repeat', 'trunc', null], goal: 76, start: 50, why: 'Repetition makes a motif memorable; changing it the third time makes it surprising. "Same, same, different" is the oldest shape in melody, from the blues to Pink Floyd.', instr: 'Bars 1–2: {motif} twice. Bar 3: the same start, a new longer ending. Then again with a shorter ending. Pass: the plan in time, then a version with your own third-bar change.', watch: 'Changing the motif already the second time.', simplify: 'Bars 1–4 only.' }),
          P_('phr-sequence', 'Sequence the motif down the scale ({key})', 'variable', { motif: 'call', plan: ['state', 'seqDown', 'seqDown2', null, 'state', 'seqUp', 'answer', null], goal: 76, start: 50, why: 'Moving a motif one scale step at a time (a sequence) keeps it recognisable while the melody travels. It is how a solo moves through the box without running scales.', instr: 'The motif, then one step lower, then two steps lower; rest. Then up a step and answered on the root. Pass: the plan in time, then the same plan starting from the B string.', watch: 'Changing the rhythm when the notes move.', simplify: 'Two versions of the motif.' }),
          P_('phr-artic', 'Same notes, new articulation: plain, then with hammer-ons, pull-offs and slides ({key})', 'variable', { motif: 'turn', plan: ['state', null, { op: 'repeat', art: true }, null, 'seqDown', null, { op: 'seqDown', art: true }, null], goal: 74, start: 48, why: 'A phrase changes character with how it is played: picked plainly it is plain; with hammer-ons, pull-offs and slides it sings. Playing the same notes both ways shows how much of phrasing is articulation, not note choice.', instr: 'Bars 1 and 5: every note picked, the last held with vibrato. Bars 3 and 7: the same notes, but moves along a string are hammer-ons and pull-offs (one or two frets) or slides (three or more), as marked. Pass: each pair in time, with the articulated version clearly smoother; then your own phrase both ways.', watch: 'Rushing the slurred notes.', simplify: 'Bars 1–4.' })]),
        S('phr-rhythm', 'Where it starts in the bar', 'rhythm', 'Same notes, new place in time.', [
          P_('phr-displace', 'Rhythmic displacement: on 1, on the "and", on 2 ({key})', 'variable', { motif: 'rise', plan: ['state', null, 'disp', null, 'disp2', null, 'state', null], goal: 76, start: 50, why: 'The same notes starting somewhere else in the bar sound like a new idea. Displacing a motif an 8th or a beat later is the quickest way to make a solo less predictable.', instr: 'The motif on beat 1, then starting on the "and" of 1, then on beat 2, then back on 1. Count 8th notes aloud. Pass: every start exactly where written.', watch: 'Pulling the displaced start back to the beat.', simplify: 'Only the beat-2 version.' }),
          P_('phr-pickup', 'Pickups: start the phrase an 8th before the bar ({key})', 'chunking', { motif: 'cry', plan: [null, 'pickup', null, 'pickup', null, 'pickup', null, 'answer'], goal: 76, start: 50, why: 'Blues players (B.B. King, and Gilmour after him) often start a phrase on the last 8th of the bar before, so it leans into the downbeat. Practise the pickup alone, then the phrase.', instr: 'Chunk it: first only the pickup note into the downbeat, then the whole phrase. The first note falls on the "and" of 4 of the rest bar. Pass: 4 phrases in a row whose second note lands exactly on beat 1.', watch: 'Starting late, on beat 1.', simplify: 'Pickup and first note only.' })]),
        S('phr-choice', 'Note choice', 'theory', 'Colour notes and chord tones.', [
          P_('phr-dorian', 'The Dorian 6th as a colour note over {chords}', 'external-focus', { motif: 'turn', scale: 'dorian', prog: 'dorian', plan: ['state', null, 'repeat', null, 'seqDown', null, 'answer', null], goal: 72, start: 48, why: 'Adding the 2nd and the major 6th to the minor pentatonic (the Dorian mode) gives a warm, bittersweet colour over a minor vamp: a Gilmour habit. The motif turns around the 5th and touches the 6th.', instr: 'Play the phrases over the vamp and listen to the note right after the first one (the 6th): hear how it brightens the minor chord. Then play the same plan with the ♭6 instead and hear the darker colour. Pass: the plan in time, then two phrases of your own that use the 6th.', watch: 'Landing on the 6th: it is a colour on the way, not a resting note.', simplify: 'Only bars 1–2.' }),
          P_('phr-thirds-box2', 'Land on each chord’s 3rd in box 2 ({chords})', 'variable', { motif: 'sigh', box: 2, land: 1, plan: ['state', 'seqDown', 'state', 'answer', 'state', 'seqDown', 'state', 'answer'], goal: 76, start: 50, why: 'The 3rd of a chord says major or minor: landing on it makes the solo follow the harmony. Landing on it in a box away from home is what playing over changes needs.', instr: 'The tab lands each phrase on its chord’s 3rd (or the nearest chord tone when the 3rd isn’t in the scale). Listen to how the 3rd names the chord as it changes; then play four phrases of your own that land the same way. Pass: the written phrases in time, then four of your own on the 3rds.', watch: 'Defaulting to the root.', simplify: 'Two bars on, two bars rest.' })]),
        S('phr-qa', 'Questions, answers, mixtures', 'improv', 'Many changes, one idea.', [
          P_('phr-mixed-ops', 'A different change every phrase: {motif} ({key})', 'interleaving', { motif: 'call', plan: ['state', null, 'invert', null, 'disp', null, 'seqUp', null, 'tail', null, 'pickup', null, 'trunc', null, 'answer', null], goal: 76, start: 50, why: 'Mixing the development operations (inversion, displacement, sequence, a new tail, a pickup) instead of practising one at a time forces a decision before every phrase, which is what improvising is.', instr: 'Eight versions of {motif}: inverted, displaced, a step higher, with a tail, with a pickup, cut short, and answered. Pass: all eight in time, then the same eight changes in a different order.', watch: 'All the versions drifting toward the same one.', simplify: 'The first four phrases.' }),
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
          P_('phr-retarget', 'The motif adjusted to every chord’s 3rd ({chords})', 'variable', { motif: 'sigh', land: 1, plan: ['state', 'state', 'state', 'state', 'seqUp', 'seqUp', 'seqUp', 'answer'], goal: 80, start: 52, why: 'Playing the same motif over every chord, but landing it on that chord’s 3rd, makes one idea follow the harmony: the motif-and-target approach of melodic soloists.', instr: 'Same motif every bar, each landing on the 3rd of the bar’s chord (or the nearest chord tone in the scale): the shape stays, the notes move with the harmony. Then do the same with a motif of your own. Pass: the 8 written bars in time, then 8 of your own.', watch: 'Landing on the same note over every chord.', simplify: 'Two chords.' }),
          P_('phr-blues-changes', 'Motifs over the dominant blues ({chords})', 'variable', { motif: 'cry', prog: 'blues', plan: ['state', 'repeat', 'tail', null, 'pickup', 'seqDown', 'answer', null], goal: 80, start: 52, why: 'Over dominant 7th chords the minor pentatonic’s landing notes change with each chord: the same cry motif lands on the root, the 5th or the ♭7, whichever belongs to the chord.', instr: 'Play the phrases over the blues; notice which chord tone each landing is. Then improvise with the same plan. Pass: the plan in time, then your own 8 bars.', watch: 'Landing on the ♭3 over the IV chord.', simplify: 'Bars 1–4.' })]),
        S('phr-keys', 'Any key, any box', 'fretboard', 'The same motif anywhere.', [
          P_('phr-keys', 'One motif in four keys around the cycle of fourths', 'interleaving', { motif: 'call', plan: [{ op: 'state' }, { op: 'answer' }, { op: 'state', key: 5 }, { op: 'answer', key: 5 }, { op: 'state', key: 10 }, { op: 'answer', key: 10 }, { op: 'state', key: 3 }, { op: 'answer', key: 3 }], goal: 78, start: 50, why: 'A motif is a shape in degrees, so it moves with the key. Changing key every two bars means finding the motif and its landing instantly in a new place.', instr: 'Call and answer in the home key, then a 4th up, and twice more. The chords move with each key. Pass: all four keys without stopping.', watch: 'The rhythm changing as the key changes.', simplify: 'Two keys.' }),
          P_('phr-boxes', 'One motif in boxes 1, 2, 4 and 5 ({key})', 'interleaving', { motif: 'rise', plan: [{ op: 'state', box: 1 }, { op: 'answer', box: 1 }, { op: 'state', box: 2 }, { op: 'answer', box: 2 }, { op: 'state', box: 4 }, { op: 'answer', box: 4 }, { op: 'state', box: 5 }, { op: 'answer', box: 5 }], goal: 78, start: 50, why: 'The same motif in another box sits under different fingers and in another register. Moving it box by box makes the idea independent of one hand shape.', instr: 'Call and answer in box 1, then 2, 4 and 5. Pass: all four boxes in time.', watch: 'Shifting box late and missing the downbeat.', simplify: 'Boxes 1 and 2.' })]),
        S('phr-adv-music', 'In a solo', 'improv', 'A ballad solo with space.', [
          P_('phr-dorian-ballad', 'Ballad study: pickups, colour and space over {chords}', 'transfer', { motif: 'cry', scale: 'dorian', prog: 'dorian', plan: [null, 'pickup', null, 'seqDown', null, { op: 'tail', reg: 1 }, null, { op: 'augment' }], goal: 76, start: 48, why: 'A slow minor vamp, the Dorian colour, phrases that lean in from a pickup, and whole bars of silence: an original study in the singing, spacious ballad style of Gilmour.', instr: 'Play it with a clean tone and long notes, every landing with vibrato. Then improvise 8 bars with the same plan. Pass: the study in time, then your own version.', watch: 'Filling the silences.', simplify: 'Bars 1–4.' }),
          c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Dorian vamp solo: one motif, developed, with space' })])
      ], [7, 8]),
    stage('mastery', 'Your own voice',
      'Develop any motif in any key and box on demand, play a 32-bar solo with a clear arc at performance tempo, and perform your own 16-bar study that uses every development of the path.', [
        S('phr-random', 'Anything, on the spot', 'improv', 'No warning.', [c => phrRandom(c),
          P_('phr-recall-motifs', 'Six motifs, each answered ({key}, box 3)', 'variable', { box: 3, plan: [{ op: 'state', motif: 'sigh' }, { op: 'answer', motif: 'sigh' }, { op: 'state', motif: 'rise' }, { op: 'answer', motif: 'rise' }, { op: 'state', motif: 'call' }, { op: 'answer', motif: 'call' }, { op: 'state', motif: 'turn' }, { op: 'answer', motif: 'turn' }, { op: 'state', motif: 'leap' }, { op: 'answer', motif: 'leap' }, { op: 'state', motif: 'cry' }, { op: 'answer', motif: 'cry' }], goal: 80, start: 52, why: 'Six motifs (sigh, rise, call, turn, leap, cry) are a vocabulary of shapes. Stating and answering each in a box away from home is call and response with every one of them.', instr: 'In box 3, play each motif, then its answer on the root. Then improvise your own answer to each. Pass: all six pairs in time, then six answers of your own.', watch: 'Mixing up the rhythms of similar motifs.', simplify: 'Three motifs.' })]),
        S('phr-performance', 'A long solo at tempo', 'improv', 'Thirty-two bars with a shape.', [
          P_('phr-long-arc', 'A 32-bar solo with an arc at performance tempo ({key})', 'edge', { motif: 'turn', plan: [...ARC, ...ARC.map(x => (x ? { ...x, key: 5 } : null))], goal: 92, start: 60, why: 'At performance tempo the shape still has to be there: space early, the climb, a dense peak, a settled ending, and a second chorus in the IV key that does it again.', instr: 'Tempo ladder: start where every phrase is in time, add a few BPM after each clean pass. The second 16 bars are in the key a 4th up. Pass: all 32 bars at the goal tempo with the rest bars kept.', watch: 'Losing the space as the tempo rises.', simplify: 'The first 16 bars.' }),
          c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: build to one climax and land' })]),
        S('phr-voice', 'Your own voice', 'improv', 'A study, then your version.', [
          P_('phr-capstone-etude', 'Capstone study: a 16-bar piece that develops one motif ({key})', 'transfer', { motif: 'call', scale: 'dorian', prog: 'dorian', plan: ['state', null, 'repeat', 'tail', null, 'seqDown', 'invert', null, { op: 'pickup', reg: 1 }, { op: 'state', reg: 1, dens: 2 }, { op: 'seqUp', reg: 1, dens: 2 }, null, 'disp', 'question', null, { op: 'augment', land: 0 }], goal: 80, start: 52, dl: 1, minutes: 8, why: 'An original piece that uses every development of the path on one motif: statement, repetition, a new tail, sequence, inversion, a pickup into a dense peak two boxes up the neck, displacement, a question, and a slow, augmented landing, with the Dorian colour and real silences.', instr: 'Learn it 4 bars at a time. Then write your own 16 bars from your own motif with the same plan. Pass: the study at the goal tempo, then your own version once.', watch: 'Rushing the silences after the peak.', simplify: 'Bars 1–8.' }),
          c => targetGuide(c, { prog: 'dorianVamp', scale: 'dorian', name: 'Your motif, developed for 32 bars over a Dorian vamp' })])
      ], [9, 10])
  ]
});
for (const st of path.stages) for (const sk of st.skills) if (STUDY[sk.id] && !sk.study) sk.study = STUDY[sk.id];
export default path;
