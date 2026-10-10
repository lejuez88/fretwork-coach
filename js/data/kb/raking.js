// Raking: dragging the pick across two to four strings muted by the fretting hand, so they click without
// pitch, straight into a target note that rings out: the percussive, vocal attack of Stevie Ray Vaughan,
// B.B. King, Albert King and most blues-rock lead players. From the first slow rake (muted strings alone,
// then the note alone, then both), through rakes of two, three and four strings, down- and up-rakes, rakes
// into bends, vibrato and double-stops, in every box and key, to rakes on every beat at tempo and an
// original blues study.
//
// Concept-first (CONTENT.md): the model is a RAKE as (target, size, direction, timing, arrival). The TARGET
// is a scale degree on a string inside a minor-pentatonic box (vibrato.js `spotDeg`, so it is in the key by
// construction); SIZE is how many muted strings come before it (on the lower strings for a down-rake, the
// higher strings for an up-rake), written as dead notes at the target's fret (the flattened fretting
// fingers); TIMING is how long the rake lasts before the beat (a 16th, a triplet 8th, or a fast 32nd-ish
// flick), so the target lands exactly on the beat; ARRIVAL is what the target does (rings, vibrato, a bend
// to the next degree, a barred double-stop). The composer `rakeRun(c, spec)` builds an exercise from
// targets (degrees × strings × boxes × keys) × size × direction × timing × arrival × spacing.
import { OPEN, N, nameOf, minorKey, make, mod12, S, stage, entry, targetGuide } from '../lib.js';
import { spotDeg } from './vibrato.js';
import { spot, boxFrets, rng } from './bending.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const DEG = { 0: 'R', 3: '♭3', 5: '4', 7: '5', 10: '♭7' };
const PENT = [0, 3, 5, 7, 10];
/** The bend that starts on a degree (to the next pentatonic degree): 4 → 5, ♭7 → R, ♭3 → 4. */
const BEND = { 5: [5, 7], 10: [10, 0], 3: [3, 5] };
/** Rake size and timing a level can control. */
export const sizeFor = lvl => (lvl <= 2 ? 2 : lvl <= 6 ? 3 : 4);
export const graceFor = lvl => (lvl <= 3 ? 0.5 : lvl <= 6 ? 1 / 3 : 0.25);
/** Which note may sound where (for the pitch check): note → allowed pitch classes (null = a raked dead note). */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };

/**
 * One rake into target p (spot {s, f, d}) arriving at beat t: `size` dead notes on the strings below
 * (dir 'down', a downstroke) or above (dir 'up', an upstroke), spread evenly over `grace` beats before t;
 * then the arrival for `len` beats. Returns false when the strings aren't there.
 */
export function rakeInto(notes, k, box, p, t, { size = 2, dir = 'down', grace = 0.25, arrive = 'ring', len = 1 } = {}) {
  const pcs = PENT.map(d => mod12(k + d)), ss = [];
  for (let i = size; i >= 1; i--) { const s = dir === 'down' ? p.s + i : p.s - i; if (s < 1 || s > 6) return false; ss.push(s); }
  ss.forEach((s, i) => notes.push(tag(N(s, p.f, t - grace + (i * grace) / size, grace / size, 'mute', { pick: dir === 'down' ? 'd' : 'u' }), null)));
  switch (arrive) {
    case 'ring': notes.push(tag(N(p.s, p.f, t, len, null, { pick: dir === 'down' ? 'd' : 'u' }), pcs)); return true;
    case 'vib': notes.push(tag(N(p.s, p.f, t, len, '~'), pcs)); return true;
    case 'bend': {
      const b = BEND[p.d] && spot(k, box, p.s, BEND[p.d]); if (!b || b.f !== p.f) { notes.push(tag(N(p.s, p.f, t, len, '~'), pcs)); return true; }
      notes.push(tag(N(p.s, p.f, t, len, 'b', { bendTo: b.to }), pcs)); return true;
    }
    case 'double': {
      if (p.s < 2) return false; const hs = p.s - 1, hf = p.f + (p.s === 3 ? 1 : 0);   // the next string at the same fret (B string: one fret up)
      const hi = mod12(pitch(hs, hf)); if (!pcs.includes(hi)) return false;
      notes.push(tag(N(p.s, p.f, t, len, null, { chord: true }), pcs), tag(N(hs, hf, t, len, null, { chord: true }), pcs)); return true;
    }
    default: return false;
  }
}
/** Every target spot of the given degrees on the given strings of a box, low string to high. */
function targets(k, box, strings, degs) { const out = []; for (const s of strings) for (const d of degs) { const p = spotDeg(k, box, s, d); if (p) out.push(p); } return out; }
const UNIT = g => (g >= 0.5 ? 'quarter notes (rake on the 8th before)' : g >= 1 / 3 ? 'shuffle triplets (rake on the last triplet)' : '16th-note rakes');

/* ------------------------------- The composer ------------------------------- */
/**
 * One raking exercise from a spec: { id, name ('{key}', '{targets}', '{size}'), method, degs, strings,
 * boxes, keys (offsets), size (or by level), dir ('down' | 'up' | 'alt'), grace (or by level), arrive
 * ('ring' | 'vib' | 'bend' | 'double' | a list cycling per target), every (beats between targets), len,
 * teach (muted strings alone, the note alone, then the rake), domain, unit, goal, start, dl, backing (k => chords),
 * why, instr, watch, simplify }.
 */
export function rakeRun(c, spec) {
  const k0 = minorKey(c), lvl = c.lvl || 5, size = spec.size || sizeFor(lvl), grace = spec.grace || graceFor(lvl), every = spec.every || 2;
  const notes = [], used = []; let t = 1, n = 0;
  const arrives = Array.isArray(spec.arrive) ? spec.arrive : [spec.arrive || 'ring'];
  for (const off of spec.keys || [0]) for (const box of spec.boxes || [1]) {
    const k = mod12(k0 + off);
    for (const p of targets(k, box, spec.strings || [3, 2, 1], spec.degs || [0, 3, 7])) {
      const dir = spec.dir === 'alt' ? (n % 2 ? 'up' : 'down') : spec.dir || 'down';
      if (spec.teach) {
        const ss = []; for (let i = size; i >= 1; i--) { const s = dir === 'down' ? p.s + i : p.s - i; if (s >= 1 && s <= 6) ss.push(s); }
        if (ss.length < size) continue;
        ss.forEach((s, i) => notes.push(tag(N(s, p.f, t + i * 0.5, 0.5, 'mute'), null)));
        notes.push(tag(N(p.s, p.f, t + 2, 1), PENT.map(d => mod12(k + d))));
        if (!rakeInto(notes, k, box, p, t + 4, { size, dir, grace: 0.5, arrive: 'vib', len: 2 })) continue;
        t += 7; n++; used.push(`${DEG[p.d]} (${p.s === 1 ? 'e' : p.s === 2 ? 'B' : p.s === 3 ? 'G' : p.s === 4 ? 'D' : 'A'} string)`); continue;
      }
      const arrive = arrives[n % arrives.length];
      if (!rakeInto(notes, k, box, p, t, { size, dir, grace, arrive, len: spec.len || every - grace })) continue;
      t += every; n++; if (used.length < 9) used.push(`${DEG[p.d]} (${['', 'e', 'B', 'G', 'D', 'A', 'E'][p.s]} string)`);
    }
  }
  if (n < 2 || notes.length > 400) return null;
  const fill = s => s.replace(/\{key\}/g, `${nameOf(k0)} minor`).replace('{targets}', [...new Set(used)].join(', ')).replace('{size}', `${size}-string`);
  const chords = spec.backing ? spec.backing(k0) : null;
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'picking', method: spec.method, unit: spec.unit || UNIT(grace),
    goal: spec.goal || 84, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, ...(chords ? { backing: chords, chords: [...new Set(chords)] } : {}), tab: { notes }
  });
}
const R_ = (id, name, method, opts) => c => rakeRun(c, { id, name, method, ...opts });
const blues = k => [0, 5, 0, 7].map(o => nameOf(k + o) + '7');

/* ------------------------------- Phrases ------------------------------- */
// Phrases in degrees: [string, degree, beats, arrive ('ring' | 'vib' | 'bend'), rake size (0 = no rake)]; null string = rest.
const PHRASES = [
  [[3, 3, 1, 'vib', 2], [4, 0, 1, 'ring', 0], [4, 10, 2, 'vib', 0], [null, 0, 4], [2, 7, 1, 'ring', 2], [3, 5, 1, 'ring', 0], [3, 3, 2, 'vib', 2], [null, 0, 4]],
  [[2, 10, 1, 'bend', 3], [2, 7, 1, 'ring', 0], [3, 5, 1, 'bend', 2], [3, 3, 1, 'vib', 0], [null, 0, 2], [1, 3, 1, 'vib', 3], [1, 0, 1, 'ring', 0], [2, 10, 2, 'bend', 2], [2, 7, 2, 'vib', 0], [null, 0, 2], [3, 3, 0.5, 'ring', 2], [4, 0, 0.5, 'ring', 0], [4, 10, 3, 'vib', 2]],
  [[1, 3, 0.5, 'bend', 4], [1, 0, 0.5, 'ring', 0], [2, 10, 1, 'vib', 3], [2, 10, 1, 'bend', 3], [2, 7, 1, 'ring', 0], [3, 5, 0.5, 'bend', 3], [3, 3, 0.5, 'ring', 0], [4, 0, 1, 'ring', 2], [4, 10, 2, 'vib', 2], [null, 0, 1], [2, 7, 1, 'vib', 3], [2, 10, 1, 'bend', 3], [1, 0, 1, 'vib', 4], [null, 0, 1], [3, 3, 0.5, 'ring', 3], [4, 10, 0.5, 'ring', 0], [4, 0, 2, 'vib', 2]]
];
export function rakePhrase(c, { level = 1 } = {}) {
  const k = minorKey(c), notes = [], pcs = PENT.map(d => mod12(k + d)); let t = 1;
  for (const [s, d, b, arrive, size] of PHRASES[level - 1]) {
    if (s == null) { t += b; continue; }
    const p = spotDeg(k, 1, s, d); if (!p) return null;
    if (size) { if (!rakeInto(notes, k, 1, p, t, { size, grace: level === 1 ? 0.5 : level === 2 ? 1 / 3 : 0.25, arrive, len: b })) return null; }
    else notes.push(tag(N(p.s, p.f, t, b, arrive === 'vib' ? '~' : null), pcs));
    t += b;
  }
  const chords = blues(k);
  const id = ['rake-phrase', 'rake-phrase-bends', 'rake-phrase-blues'][level - 1];
  return make(c, {
    id, name: [`First raked phrases over a ${nameOf(k)} blues`, `Raked phrases with bends: rakes of two and three strings (${nameOf(k)} blues)`, `Blues phrases with a rake on every strong note (${nameOf(k)} blues)`][level - 1],
    domain: 'improv', method: 'transfer', unit: 'phrases', goal: [70, 80, 90][level - 1], start: [46, 50, 56][level - 1], minutes: 5, backing: [...chords, ...chords], chords: [...new Set(chords)], tab: { notes },
    why: ['A rake belongs on the notes a phrase leans on: the first note and the long one. Two short phrases with a rake into each landing note and a bar of space after each one.', 'Raking into a bend is the most vocal attack in the blues: the click of the dead strings, then the note crying upward. Here rakes of two and three strings lead into bends and long notes.', 'Rakes on every strong note, including into bends at the top of the box and down to the low root: the intense, percussive Texas sound, with rests so it can breathe.'][level - 1],
    instr: 'Play the phrases over the backing. Every rake ends exactly on the beat, with the dead strings clicking and the target note ringing. Then answer each phrase with one of your own that rakes into its first and last notes. Pass: the phrases in time with every rake clean, then four bars of your own.',
    watch: 'Raked strings that sound as pitches: flatten the fretting fingers more.', simplify: 'Only the first phrase.'
  });
}
/** A random target, box, size, direction and arrival every bar (interleaving). */
export function rakeRandom(c) {
  const r = rng(817 + (c.lvl || 9)), k = minorKey(c), notes = [], names = [];
  for (let bar = 0; bar < 8; bar++) {
    const box = 1 + Math.floor(r() * 5), d = [0, 3, 7, 5, 10][Math.floor(r() * 5)], s = [3, 2, 1][Math.floor(r() * 3)], size = 2 + Math.floor(r() * 3), arrive = ['vib', 'bend', 'ring'][Math.floor(r() * 3)];
    let p = spotDeg(k, box, s, d), dir = 'down';
    if (!p || p.s + size > 6) { p = [3, 2, 1].map(x => spotDeg(k, box, x, d)).find(q => q && q.s + size <= 6); }
    if (!p) { p = spotDeg(k, box, 1, d) || spotDeg(k, box, 2, d); dir = 'down'; }
    if (!p) return null;
    const sz = Math.min(size, 6 - p.s);
    if (!rakeInto(notes, k, box, p, bar * 4 + 1, { size: sz, dir, grace: 0.25, arrive, len: 3 })) return null;
    names.push(`box ${box}: the ${DEG[d]}, ${sz}-string rake, ${arrive === 'vib' ? 'vibrato' : arrive === 'bend' ? 'bend' : 'ring'}`);
  }
  return make(c, {
    id: 'rake-random', name: `Random access: a new box, note, rake size and arrival every bar (${nameOf(k)} minor)`, domain: 'fretboard', method: 'interleaving', unit: '16th-note rakes', goal: 100, start: 60, minutes: 5, dl: 1, tab: { notes },
    why: 'At mastery level the rake is an accent you add anywhere, to any note, at any size: an unpredictable order makes it automatic instead of a rehearsed move.',
    instr: `${names.join(' → ')}. Read only the names: find the note, flatten the fingers over the strings below it, and rake into it on beat 2. Pass: all 8 bars in time from the names alone.`,
    watch: 'Rakes growing to every string out of habit: match the called size.', simplify: 'The first four bars.'
  });
}
/** An original 12-bar blues study built on rakes (capstone). */
export function rakeEtude(c) {
  const k = minorKey(c), notes = [], pcs = PENT.map(d => mod12(k + d));
  const plan = [[3, 3, 'vib', 2, 1], [2, 10, 'bend', 3, 1], [1, 3, 'vib', 3, 1], [4, 0, 'ring', 2, 1], [3, 5, 'bend', 3, 2], [2, 7, 'vib', 3, 2], [1, 0, 'vib', 4, 4], [2, 10, 'bend', 3, 4], [1, 3, 'bend', 4, 5], [2, 7, 'vib', 3, 4], [3, 3, 'vib', 2, 1], [4, 0, 'vib', 2, 1]];
  for (const [bar, [s, d, arrive, size, box]] of plan.entries()) {
    const p = spotDeg(k, box, s, d) || spotDeg(k, 1, s, d); if (!p) return null;
    const bx = spotDeg(k, box, s, d) ? box : 1, T = bar * 4;
    if (!rakeInto(notes, k, bx, p, T + 1, { size: Math.min(size, 6 - p.s), grace: 0.25, arrive, len: 1.5 })) return null;
    const q = [p.s, p.s + 1].map(x => (spotDeg(k, bx, x, d === 0 ? 10 : d === 3 ? 0 : 3))).find(Boolean);
    if (q) { notes.push(tag(N(q.s, q.f, T + 2.5, 0.5), pcs)); }
    const r = spotDeg(k, bx, Math.min(4, p.s + 1), 0) || spotDeg(k, 1, 4, 0); if (r) notes.push(tag(N(r.s, r.f, T + 3, 1, '~'), pcs));
  }
  const chords = [0, 5, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map(o => nameOf(k + o) + '7');
  return make(c, {
    id: 'rake-capstone-etude', name: `Capstone study: a 12-bar blues built on rakes (${nameOf(k)})`, domain: 'improv', method: 'transfer', unit: '16th-note rakes', goal: 92, start: 56, minutes: 8, dl: 1, backing: chords, chords: [...new Set(chords)], tab: { notes },
    why: 'An original 12-bar piece that uses the whole path: rakes of two, three and four strings into vibrato notes and bends, moving from box 1 up through boxes 2, 4 and 5 and back, each bar answered by two short notes.',
    instr: 'Learn it four bars at a time, saying the rake size and the arrival of each bar before you play it. Then write your own 12 bars to the same plan. Pass: the study at the goal tempo with every rake landing on beat 2, then your own version once.',
    watch: 'The higher boxes making the rakes louder and longer: keep them a short click.', simplify: 'The first four bars.'
  });
}

/* --------------------------------- The path --------------------------------- */
const HOW = 'Flatten the fretting finger (or lay the spare fingers) lightly across the strings before the target so they go dead, then drag the pick through them in one motion and stop on the target string: the dead strings click, the target rings. ';
export default entry({
  id: 'raking', kind: 'technique', title: 'Raking', domain: 'picking',
  re: /\brak(e|es|ing)\b|string rakes?|pick rakes?/,
  aliases: ['string rakes', 'pick raking', 'muted rakes'],
  summary: 'A muted rake across two to four dead strings into a target note that rings: from the first slow rake, through down- and up-rakes, rakes into bends, vibrato and double-stops in every box and key, to rakes on every beat at tempo and an original blues study.',
  prereqs: ['pentatonic', 'bending'],
  sources: ['https://musicradar.com/how-to/5-minute-blues-guitar-lesson-string-rakes', 'https://www.dummies.com/article/academics-the-arts/music/instruments/guitar/how-to-use-sweep-picking-and-raking-on-the-guitar-143481', 'https://www.premierguitar.com/beyond-blues-texas-rhythm-101', 'https://www.musicradar.com/how-to/8-essential-blues-guitar-lead-tricks'],
  ctx: { key: 4, minor: true, prog: 'blues' },
  stages: [
    stage('foundations', 'Click, then the note',
      'Rake two strings into the ♭3, 5th and root of box 1 at 70 BPM with the dead strings silent of pitch and the target landing on the beat, rake in both directions, name the landing notes from memory, and play two raked phrases over a blues.', [
        S('rake-pieces', 'The rake in pieces', 'picking', 'Dead strings, the note, then both.', [
          R_('rake-teach', 'Dead strings, the note, then the rake: {targets} ({key}, box 1)', 'chunking', { teach: true, size: 2, degs: [3, 7, 0], strings: [3, 2, 1], goal: 62, start: 40, why: 'A rake is two skills joined: muting strings so they only click, and landing on a note in time. Playing the dead strings alone, then the target alone, then both in one stroke builds each piece before the whole.', instr: HOW + 'Beats 1–2: pick the two dead strings slowly, one by one (they must click, with no pitch). Beat 3: the target alone. Then the rake: one stroke through the dead strings that lands on the target on the beat, held with vibrato. Pass: every target, each piece clean.', watch: 'The muted strings ringing as notes.', simplify: 'Only the G-string ♭3.' }),
          R_('rake-two', 'Two-string rakes into {targets} ({key})', 'accurate-reps', { size: 2, grace: 0.5, degs: [3, 7, 0], strings: [3, 2, 1], arrive: 'vib', every: 4, len: 2, goal: 64, start: 42, why: 'A small rake (two dead strings) on the 8th before the beat is the version every blues player uses most. Counting only the clean ones (two clicks, then the note on the beat) builds the clean motion.', instr: HOW + 'One rake a bar, landing on beat 2, the note held with vibrato. Count only rakes where both dead strings click and the target lands on the beat. Pass: 8 clean rakes in a row.', watch: 'The target arriving late because the rake is too slow.', simplify: 'Rake into the G string only.' })]),
        S('rake-sound', 'Hear the rake', 'ear', 'A click, then a pitch.', [
          R_('rake-click', 'Listen: a click, then a pitch ({key}, box 1)', 'external-focus', { size: 2, grace: 0.5, degs: [3, 7, 0, 10], strings: [3, 2, 1], arrive: 'ring', every: 2, goal: 66, start: 44, why: 'The sound tells you everything: a good rake is a short, dry percussive click and then one clear note. Listening for that (instead of watching the hand) is the fastest way to fix the muting.', instr: HOW + 'Rake into each target and listen only: a click (no pitches), then the note. If you hear pitches in the click, flatten the fingers more; if the note is muted, lift the finger off it. Pass: every rake a clean click and a clear note.', watch: 'Pitches leaking into the click.', simplify: 'One target, many times.' }),
          R_('rake-compare', 'Hear it first: the plain note, then raked ({key})', 'audiation', { teach: true, size: 2, degs: [3, 0], strings: [3, 1], goal: 62, start: 40, why: 'Hearing the plain note and then the raked note one after the other puts the rake’s effect in the ear: the same pitch, but with the attack of a drum hit.', instr: 'Sing the target note, play it plainly, then rake into it. Hear the difference before you move on. Pass: you can hear and say which attack was a rake.', watch: 'Raking so hard the note goes sharp.', simplify: 'One target.' })]),
        S('rake-where', 'Where and which way', 'fretboard', 'Landing notes from memory; up-rakes.', [
          R_('rake-landing', 'From memory: rake into every landing note of box 1 ({key})', 'retrieval', { size: 2, grace: 0.5, degs: [0, 3, 7], strings: [4, 3, 2, 1], arrive: 'vib', every: 2, goal: 64, start: 42, why: 'Rakes go into the notes a phrase rests on: the root, the ♭3 and the 5th. Finding those from memory, by degree, is what lets you rake into the right note mid-phrase.', instr: 'Cover the tab. Say each degree, find it in box 1 on the D, G, B and e strings, and rake into it. Pass: all of them from memory.', watch: 'Raking into the 4th or ♭7, which don’t rest.', simplify: 'The G and B strings only.' }),
          R_('rake-up', 'Down-rakes and up-rakes alternating: {targets} ({key})', 'variable', { size: 2, grace: 0.5, degs: [3, 7, 0], strings: [4, 3], dir: 'alt', arrive: 'vib', every: 2, goal: 64, start: 42, why: 'A rake can come from below (a downstroke through the lower strings) or from above (an upstroke through the higher strings). Alternating them makes the motion flexible in both directions.', instr: HOW + 'Odd notes: down-rake from the lower strings. Even notes: up-rake from the higher strings, muted by the fingers above the target. Pass: every rake clean in both directions.', watch: 'Up-rakes catching the target string twice.', simplify: 'Down-rakes only.' })]),
        S('rake-first-music', 'First music', 'improv', 'Raked phrases over a blues.', [c => rakePhrase(c, { level: 1 }), R_('rake-call', 'Call and response: plain call, raked answer ({key})', 'transfer', { size: 2, grace: 0.5, degs: [3, 0], strings: [3, 1], arrive: 'vib', every: 4, len: 2, backing: blues, goal: 66, start: 44, why: 'A rake makes an answer louder and more urgent than the question. Playing a plain phrase, then answering with a raked note, uses the rake as phrasing, not just technique.', instr: 'Over the backing: play two bars of your own plain phrase, then the written raked note with vibrato as the answer. Pass: four questions and raked answers in time.', watch: 'Raking every note of the question too.', simplify: 'Answer with the ♭3 only.' })])
      ], [1, 3]),
    stage('intermediate', 'Bends, sizes and boxes',
      'Rake three strings into bends, vibrato and double-stops on the shuffle’s last triplet at 84 BPM, rake in every box and find called degrees in box 2 from memory, and play raked phrases and a blues solo with rakes on the strong notes.', [
        S('rake-bends', 'Into bends', 'fretting', 'The rake that cries.', [
          R_('rake-bend', 'Rake into whole-step bends: {targets} ({key})', 'accurate-reps', { size: 3, degs: [5, 10, 3], strings: [3, 2, 1], arrive: 'bend', every: 2, goal: 78, start: 48, why: 'Raking into a bend (the 4 to the 5, the ♭7 to the root, the ♭3 to the 4) is the signature Texas blues attack. The bend must still reach pitch after the rake.', instr: HOW + 'Rake three dead strings into the note and bend it a whole step on arrival. Count only the ones that reach pitch. Pass: 8 clean in a row.', watch: 'The bend falling short because the rake used up your attention.', simplify: 'Two-string rakes.' }),
          R_('rake-bend-vib', 'Rakes into bends and vibrato, alternating ({key})', 'variable', { size: 3, degs: [5, 3, 10, 7], strings: [3, 2], arrive: ['bend', 'vib'], every: 2, goal: 78, start: 48, why: 'Alternating the arrival (a bend, then a vibrato) keeps the rake the same while the note changes: mixed practice that keeps each move fresh.', instr: HOW + 'Odd notes: bend on arrival. Even notes: vibrato. Pass: all of them in time.', watch: 'Bending the vibrato notes by habit.', simplify: 'Half the tempo.' })]),
        S('rake-size', 'Size and timing', 'picking', 'Three and four strings; the shuffle triplet.', [
          R_('rake-big', 'Bigger rakes: {size} rakes into {targets} ({key})', 'variable', { size: 3, degs: [3, 7], strings: [2, 1], arrive: 'vib', every: 2, goal: 78, start: 48, why: 'More dead strings make a longer, louder click. The rake must speed up to fit the same space, so the target still lands on the beat.', instr: HOW + 'Rake across the dead strings below the B and e strings into the target. Pass: every rake ends on the beat.', watch: 'The rake starting early to make room: it must start later and move faster.', simplify: 'Two-string rakes at the same tempo.' }),
          R_('rake-triplet', 'Rakes on the last triplet of the shuffle ({key})', 'chunking', { size: 2, grace: 1 / 3, degs: [3, 0, 7], strings: [3, 2], arrive: 'vib', every: 2, backing: blues, unit: 'shuffle triplets', goal: 76, start: 46, why: 'In a shuffle the rake fits the last triplet before the beat, like the drummer’s pickup. Count triplets aloud, place the rake on "let", the note on "one".', instr: HOW + 'Count "1-and-let" aloud. First rake only (no target) on "let" for a bar, then add the target on the beat. Pass: four bars locked to the shuffle.', watch: 'Rakes landing on straight 16ths.', simplify: 'One rake per bar.' })]),
        S('rake-boxes', 'Every box', 'fretboard', 'Rakes all over the neck.', [
          R_('rake-all-boxes', 'Rakes into the root and 5th in boxes 1 to 5 ({key})', 'interleaving', { size: 2, degs: [0, 7], strings: [2], boxes: [1, 2, 3, 4, 5], arrive: 'vib', every: 2, goal: 80, start: 50, why: 'Changing box every note changes the fret, the finger and the muting: mixed practice that makes the rake work anywhere on the neck.', instr: HOW + 'On the B string, rake into the root or 5th of each box from 1 to 5. Pass: the whole run with every rake clean.', watch: 'Muting that works in box 1 failing higher up.', simplify: 'Boxes 1–3.' }),
          R_('rake-called', 'From memory: called degrees with a rake in box 2 ({key})', 'retrieval', { size: 2, degs: [0, 3, 7, 10], strings: [4, 3, 2, 1], boxes: [2], arrive: 'vib', every: 2, goal: 78, start: 48, why: 'Calling a degree and raking into it in box 2 joins the fretboard knowledge to the attack: the note is found from memory, then hit.', instr: 'Cover the tab. Say each degree, find it in box 2, rake into it. Pass: all of them from memory.', watch: 'Falling back to box 1.', simplify: 'Look once, then cover.' })]),
        S('rake-ds', 'Into double-stops', 'fretting', 'Two notes after the click.', [
          R_('rake-double', 'Rake into double-stops: {targets} and the string above ({key})', 'external-focus', { size: 2, degs: [3, 7, 0, 10, 5], strings: [3, 2], arrive: 'double', every: 2, goal: 78, start: 48, why: 'A rake into a pair of notes is a big, chordal blues attack (a Vaughan favourite). The dead strings click, then both notes must sound together and equally.', instr: HOW + 'Rake into the pair: the target and the scale tone on the string above. Listen for the click, then two notes as one. Pass: every pair clean after its rake.', watch: 'The upper note of the pair dead because the rake stopped short.', simplify: 'Two pairs.' }),
          R_('rake-up-bends', 'Up-rakes into bends on the G string ({key})', 'variable', { size: 2, degs: [5, 3], strings: [3], dir: 'up', arrive: 'bend', every: 2, boxes: [1, 4], goal: 76, start: 46, why: 'An upstroke rake from the B and e strings into a G-string bend comes after a phrase on the top strings: the rake joins the phrase instead of interrupting it.', instr: HOW + 'Upstroke through the dead B and e strings into the G-string note, then bend it. Pass: every bend in tune after an up-rake.', watch: 'Hitting the D string after the target.', simplify: 'Down-rakes.' })]),
        S('rake-music', 'In music', 'improv', 'Phrases and a solo.', [c => rakePhrase(c, { level: 2 }), c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo with a rake into the first note of every phrase' })])
      ], [4, 6]),
    stage('advanced', 'Rakes as accents',
      'Rake four strings into every beat with 16th-note timing at 96 BPM, rake in four keys and any box from memory, mix arrivals on the spot, and play raked blues phrases and a slow-blues solo where every strong note is raked.', [
        S('rake-fast', 'On every beat', 'picking', 'Four-string rakes at tempo.', [
          R_('rake-every-beat', 'Four-string rakes into every beat ({key}, boxes 1 and 4)', 'edge', { size: 4, grace: 0.25, degs: [3, 7, 0], strings: [2, 1], boxes: [1, 4], arrive: 'ring', every: 1, goal: 96, start: 56, why: 'A rake into every beat is the most intense form of the technique (and the hardest to keep in time): each rake a fast flick, each note exactly on the click.', instr: HOW + 'Tempo ladder: +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Rakes eating the end of the previous note.', simplify: 'Every other beat.' }),
          R_('rake-bend-trip', 'Rakes into bends on the shuffle triplet, three strings ({key})', 'accurate-reps', { size: 3, grace: 1 / 3, degs: [5, 10, 3], strings: [3, 2, 1], boxes: [1, 4], arrive: 'bend', every: 2, backing: blues, goal: 92, start: 54, why: 'Rakes into bends at a shuffle tempo, in two boxes: the core of Texas blues lead playing.', instr: HOW + 'Count only the bends that reach pitch after a clean rake. Pass: 8 clean in a row.', watch: 'Short bends.', simplify: 'Box 1 only.' })]),
        S('rake-keys', 'Any key, any box', 'fretboard', 'Mixed and recalled.', [
          R_('rake-keys', 'Four keys around the cycle of fourths ({key} and up)', 'interleaving', { size: 3, grace: 0.25, keys: [0, 5, 10, 3], degs: [3, 7, 0], strings: [3, 2], arrive: 'vib', every: 2, goal: 92, start: 54, why: 'The landing notes move with the key. Changing key every block means finding them again and raking into them straight away.', instr: HOW + 'Box 1 of four keys, a fourth apart. Pass: all four keys without stopping.', watch: 'Rakes into the old key’s notes.', simplify: 'Two keys.' }),
          R_('rake-called-all', 'From memory: rake into the landing notes of boxes 3, 5, 1, 4, 2 ({key})', 'retrieval', { size: 3, grace: 0.25, degs: [0, 3, 7], strings: [3, 2, 1], boxes: [3, 5, 1, 4, 2], arrive: 'vib', every: 1, len: 0.75, goal: 92, start: 54, why: 'Out of order, every box’s landing notes from memory with a rake into each: the skill of hitting a strong note anywhere on the neck.', instr: 'Cover the tab. Boxes 3, 5, 1, 4, 2: in each, rake into the root, ♭3 and 5th on the G, B and e strings. Pass: all five boxes from memory.', watch: 'Defaulting to box 1.', simplify: 'Boxes 1–3.' })]),
        S('rake-mixed', 'Mixed arrivals', 'fretting', 'Bend, vibrato, pair, ring.', [
          R_('rake-mix', 'Every arrival in turn: bend, pair, vibrato, ring ({key})', 'variable', { size: 3, grace: 0.25, degs: [5, 3, 7, 10, 0], strings: [3, 2], boxes: [1, 4], arrive: ['bend', 'double', 'vib', 'ring'], every: 2, goal: 92, start: 54, why: 'The same rake into four different arrivals, changing every note: the rake stays automatic while the note does something new each time.', instr: HOW + 'Bend, double-stop, vibrato, plain, in turn. Pass: all of them in time.', watch: 'The pair arrivals losing their upper note.', simplify: 'Bend and vibrato only.' }),
          R_('rake-up-mix', 'Down- and up-rakes into bends and vibrato across boxes 1 and 2 ({key})', 'variable', { size: 2, grace: 0.25, degs: [5, 3, 7], strings: [3, 2], boxes: [1, 2], dir: 'alt', arrive: ['bend', 'vib'], every: 2, goal: 92, start: 54, why: 'Alternating rake direction and arrival at the same time, in two boxes, prepares the hand for rakes in the middle of real lines.', instr: HOW + 'Odd notes down-rake, even notes up-rake; bends and vibratos alternate. Pass: all of them clean.', watch: 'Up-rakes getting bigger than the down-rakes.', simplify: 'One box.' })]),
        S('rake-adv-music', 'In music', 'improv', 'Blues phrases; a slow blues.', [c => rakePhrase(c, { level: 3 }), c => targetGuide(c, { prog: 'slowBlues', scale: 'minorPent', name: 'Slow blues: rake into every note that starts or ends a phrase' })])
      ], [7, 8]),
    stage('mastery', 'Your attack',
      'Rake four strings into every beat at 104 BPM in any box, add a called rake of any size and arrival to any note on the spot, and perform your own 12-bar raked blues.', [
        S('rake-performance', 'At performance tempo', 'picking', 'Fast and anywhere.', [
          R_('rake-perf', 'Performance tempo: four-string rakes on every beat in two keys ({key})', 'edge', { size: 4, grace: 0.25, keys: [0, 7], degs: [3, 7, 0], strings: [2, 1], boxes: [1, 4], arrive: ['ring', 'vib'], every: 1, goal: 104, start: 62, why: 'Rakes at performance tempo in two keys and two boxes: speed, muting and timing together.', instr: HOW + 'Tempo ladder from the start tempo, +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Tension in the picking forearm.', simplify: 'One key.' }),
          c => rakeRandom(c)]),
        S('rake-recall-m', 'From memory', 'fretboard', 'Any key; a solo.', [
          R_('rake-recall-fast', 'From memory at tempo: bends raked in boxes 2 and 4, six keys', 'retrieval', { size: 3, grace: 0.25, keys: [0, 5, 10, 3, 8, 1], degs: [5, 10], strings: [3, 2], boxes: [2], arrive: 'bend', every: 2, goal: 100, start: 60, why: 'The bend notes of box 2 in six keys, found from memory and raked into: retrieval under speed.', instr: 'Cover the tab. In each key, rake into the 4 (G string) and the ♭7 (B string) of box 2 and bend them. Pass: all six keys in time.', watch: 'A pause at each key.', simplify: 'Three keys.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Two blues choruses: the first with no rakes, the second with a rake on every strong note' })]),
        S('rake-voice', 'Your own blues', 'improv', 'A study, then your version.', [c => rakeEtude(c),
          R_('rake-own', 'Make it yours: rake your own phrase in every box ({key})', 'transfer', { size: 3, grace: 1 / 3, degs: [3, 7, 0], strings: [3, 2, 1], boxes: [1, 2, 3, 4, 5], arrive: ['vib', 'bend', 'ring'], every: 4, len: 1, backing: blues, goal: 96, start: 58, minutes: 6, why: 'Mastery means using the rake as your own accent: the tab gives one raked note per bar through all five boxes; the lesson is to build a phrase of your own after each one.', instr: HOW + 'Rake into the written note on beat 2, then finish the bar with your own phrase in that box. Pass: all bars in time, every phrase different.', watch: 'Phrases that ignore the box the rake landed in.', simplify: 'Boxes 1 and 2.' })])
      ], [9, 10])
  ]
});
