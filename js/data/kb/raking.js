// Raking: dragging the pick across two to four muted strings, so they click without pitch, straight into a
// target note that rings out: the percussive, vocal attack of Stevie Ray Vaughan, B.B. King, Albert King and
// most blues-rock lead players. From the first slow rake (muted strings alone, then the note alone, then
// both), through rakes of two, three and four strings, down- and up-rakes, rakes into bends, slides and
// vibrato, in every box and key, to rakes on every beat, rhythmic rakes in a shuffle and an original study.
//
// Concept-first (CONTENT.md): the model is a RAKE as (target, size, direction, timing, arrival). The TARGET
// is a scale degree on a string inside a minor-pentatonic box (vibrato.js `spotDeg`, so it is in the key by
// construction); SIZE is how many muted strings come before it (on the lower strings for a down-rake, the
// higher strings for an up-rake), written as dead notes at the target's fret (the flattened fretting
// fingers); TIMING is how long the rake lasts before the beat (a 16th, a triplet 8th, or a fast flick), so
// the target lands exactly on the beat; ARRIVAL is what the target does (rings, vibrato, a bend to the next
// degree, a slide up from the pentatonic note below, a barred double-stop). The composer `rakeRun(c, spec)`
// builds an exercise from targets (degrees x strings x boxes x keys) x size x direction x timing x arrival.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-17: the mute (picking-hand heel and a
// flat fretting finger) and the rake in pieces, then as one motion; a dry click and an emphatic top note
// (B.B. King); down- and up-rakes (SRV); rakes into bends, slides and vibrato; bigger rakes and the timing of
// the rake in a shuffle; every box and key; rhythmic rakes in a single-note shuffle part; raked phrases and
// solos. Removed: singing the target (`rake-compare`), covering the tab and saying degrees aloud
// (`rake-landing` rewritten as a tabbed drill, `rake-called`, `rake-called-all`, `rake-recall-fast`, the
// "read only the names" mixed drill and the study's "say the rake size"), and the double-stop arrival
// lessons (`rake-double`; no source teaches rakes into double-stops).
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
  // slide: rake into the pentatonic note just below the target on the same string, then slide up to it
  let lo = null;
  if (arrive === 'slide') { for (let x = p.f - 1; x >= Math.max(1, p.f - 4) && lo == null; x--) if (pcs.includes(mod12(pitch(p.s, x)))) lo = x; if (lo == null || len < 1) arrive = 'vib'; }
  const df = lo == null ? p.f : lo;
  ss.forEach((s, i) => notes.push(tag(N(s, df, t - grace + (i * grace) / size, grace / size, 'mute', { pick: dir === 'down' ? 'd' : 'u' }), null)));
  switch (arrive) {
    case 'slide': notes.push(tag(N(p.s, lo, t, 0.5, null, { pick: dir === 'down' ? 'd' : 'u' }), pcs), tag(N(p.s, p.f, t + 0.5, len - 0.5, '/'), pcs)); return true;
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
    const box = 1 + Math.floor(r() * 5), d = [0, 3, 7, 5, 10][Math.floor(r() * 5)], s = [3, 2, 1][Math.floor(r() * 3)], size = 2 + Math.floor(r() * 3), arrive = ['vib', 'bend', 'ring', 'slide'][Math.floor(r() * 4)];
    let p = spotDeg(k, box, s, d), dir = 'down';
    if (!p || p.s + size > 6) { p = [3, 2, 1].map(x => spotDeg(k, box, x, d)).find(q => q && q.s + size <= 6); }
    if (!p) { p = spotDeg(k, box, 1, d) || spotDeg(k, box, 2, d); dir = 'down'; }
    if (!p) return null;
    const sz = Math.min(size, 6 - p.s);
    if (!rakeInto(notes, k, box, p, bar * 4 + 1, { size: sz, dir, grace: 0.25, arrive, len: 3 })) return null;
    names.push(`box ${box}, ${sz}-string rake, ${arrive === 'vib' ? 'vibrato' : arrive === 'bend' ? 'bend' : arrive === 'slide' ? 'slide' : 'ring'}`);
  }
  return make(c, {
    id: 'rake-random', name: `Mixed rakes: a new box, size and arrival every bar (${nameOf(k)} minor)`, domain: 'picking', method: 'interleaving', unit: '16th-note rakes', goal: 100, start: 60, minutes: 5, dl: 1, tab: { notes },
    why: 'At mastery level the rake is an accent you add anywhere, to any note, at any size: a changing order of boxes, rake sizes and arrivals keeps the motion flexible instead of one rehearsed move.',
    instr: `The bars: ${names.join(' → ')}. Read the tab one bar ahead: set the mute (picking-hand heel and a flat fretting finger) over the strings before the target, then rake into it on beat 2 and let it bend, slide, ring or shake as written. Pass: all 8 bars in time with every rake landing on beat 2.`,
    watch: 'Rakes growing to every string out of habit: match the written size.', simplify: 'The first four bars.'
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
    instr: 'Learn it four bars at a time, slowly, with the rake and its target as one motion, then join the sections. Then write your own 12 bars to the same plan. Pass: the study at the goal tempo with every rake landing on beat 2, then your own version once.',
    watch: 'The higher boxes making the rakes louder and longer: keep them a short click.', simplify: 'The first four bars.'
  });
}

/* --------------------------------- The path --------------------------------- */
const HOW = 'Lay the heel of the picking hand lightly on the strings below the target and flatten a spare fretting finger across them, so they go dead; then drag the pick through them in one motion and stop on the target string: the dead strings click, the target rings. ';
export default entry({
  id: 'raking', kind: 'technique', title: 'Raking', domain: 'picking',
  re: /\brak(e|es|ing)\b|string rakes?|pick rakes?/,
  aliases: ['string rakes', 'pick raking', 'muted rakes'],
  summary: 'A muted rake across two to four dead strings into a target note that rings: from the mute and the rake in slow pieces, through down- and up-rakes, rakes into bends, slides and vibrato in every box and key, to rakes on every beat, rhythmic rakes in a shuffle and an original blues study.',
  prereqs: ['pentatonic', 'bending'],
  sources: ['https://musicradar.com/how-to/5-minute-blues-guitar-lesson-string-rakes', 'https://www.guitarworld.com/lessons/talkin-blues-keith-wyatt-massive-attack-slapping-and-raking', 'https://www.dummies.com/article/academics-the-arts/music/instruments/guitar/how-to-use-sweep-picking-and-raking-on-the-guitar-143481', 'https://f-guitar.com/rake-electric-guitar-tutorial.html', 'https://www.licklibrary.com/glossary/rakes', 'https://www.musicradar.com/how-to/8-essential-blues-guitar-lead-tricks', 'https://www.licklibrary.com/learn/lessons/mitch-laddie/blues-rhythm-hacks-part-4-rhythmic-rakes'],
  pedagogy: {
    date: '2026-10-17',
    summary: 'Raking is taught as one motion built from three parts: deaden the strings before the target (the picking-hand heel resting on them and a fretting finger laid flat across them), drag the pick through them, and release onto a fretted target that is the only note to ring. Players start with small down-rakes into a single note, add rakes in the other direction (an upward rake through the higher strings), then rakes over more strings into the top string (B.B. King) and into bends, slides and vibrato (Stevie Ray Vaughan, Albert King), and finally use rakes as accents in phrases and as rhythmic rakes in single-note shuffle parts.',
    sequence: [
      { id: 'mute', tier: 'foundations', step: 'The mute and the rake in pieces, then as one motion', how: 'Picking-hand heel on the strings, a fretting finger laid flat across them, another finger on the target; drag the pick across the dead strings and let only the target ring. Do the three parts as one unit, slowly.', skills: ['rake-pieces'], source: 3 },
      { id: 'sound', tier: 'foundations', step: 'A dry click, then one note; the emphatic top note', how: 'Rake across the muted lower strings and strike the highest note with a loud, clear "pop"; only the note at the end of the rake should sound.', skills: ['rake-sound'], source: 1 },
      { id: 'direction', tier: 'foundations', step: 'Down-rakes and up-rakes', how: 'Rakes can be picked down or up: the pick pushed through the lower strings, or pulled back through the higher strings into a note on a lower string (Stevie Ray Vaughan).', skills: ['rake-where'], source: 0 },
      { id: 'phrases', tier: 'foundations', step: 'Rakes inside first blues phrases', how: 'A rake as the attack of the notes a phrase leans on, the B.B. King trademark.', skills: ['rake-first-music'], source: 1 },
      { id: 'bends', tier: 'intermediate', step: 'Rakes into bends', how: 'The rake leads straight into a note that is bent (or held with vibrato); the bend must still reach pitch.', skills: ['rake-bends'], source: 4 },
      { id: 'size', tier: 'intermediate', step: 'Bigger rakes and the timing of the rake', how: 'A rake across all strings but the first into a high note; the rake timed so the target lands on the beat, in a shuffle on the last triplet.', skills: ['rake-size'], source: 2 },
      { id: 'boxes', tier: 'intermediate', step: 'Rakes anywhere on the neck', how: 'The same muting and drag on target notes in every position, with the mute adjusted to each fret.', skills: ['rake-boxes'], source: 3 },
      { id: 'slides', tier: 'intermediate', step: 'Rakes into slides; up-rakes into bends', how: 'A rake combined with a slide into (or off) the target, and an upward rake into a bent note on a lower string.', skills: ['rake-slides'], source: 2 },
      { id: 'music', tier: 'intermediate', step: 'Rakes in phrases and solos', how: 'Rakes combined with bends, slides and vibrato to make phrases more expressive.', skills: ['rake-music'], source: 4 },
      { id: 'tempo', tier: 'advanced', step: 'Rakes at tempo and as rhythm', how: 'Fast rakes into every beat, and single-note shuffle rhythm parts with rakes for a percussive drive (Stevie Ray Vaughan).', skills: ['rake-fast'], source: 6 },
      { id: 'keys', tier: 'advanced', step: 'Every key and box', how: 'Rakes into the landing notes of all five boxes and other keys.', skills: ['rake-keys'], source: 3 },
      { id: 'mixed', tier: 'advanced', step: 'Mixed directions and arrivals', how: 'Down- and up-rakes into bends, slides, vibrato and plain notes mixed together, as in real lines.', skills: ['rake-mixed'], source: 4 },
      { id: 'adv-music', tier: 'advanced', step: 'Raked blues phrases and a slow blues', how: 'Rakes on the strong notes of a solo.', skills: ['rake-adv-music'], source: 1 },
      { id: 'perform', tier: 'mastery', step: 'Performance tempo, any size, any key', how: 'Rakes of any size into any note at tempo, in every key.', skills: ['rake-performance', 'rake-any-key'], source: 4 },
      { id: 'own', tier: 'mastery', step: 'Your own raked blues', how: 'A whole blues solo with rakes as your own accent.', skills: ['rake-voice'], source: 1 }
    ],
    drills: ['The mute alone, the target alone, then the rake as one motion', 'Two-string down-rakes into one target, counting clean ones', 'Up-rakes through the higher strings into a lower-string note', 'A rake across all strings but the first into a high note', 'Rakes straight into whole-step bends', 'Rakes into slides', 'Rakes on the last triplet of a shuffle', 'Single-note shuffle rhythm with rakes'],
    mistakes: ['Muted strings sounding as pitches (not enough mute)', 'Muting so much that the target is choked too', 'The target landing late because the rake is slow', 'The bend after a rake falling short', 'Unwanted strings (often the high e) ringing after the target'],
    sources: [
      { title: '5-minute blues guitar lesson: String rakes', author: 'Total Guitar (MusicRadar)', url: 'https://musicradar.com/how-to/5-minute-blues-guitar-lesson-string-rakes' },
      { title: 'Talkin’ Blues: Massive Attack (slapping and raking)', author: 'Keith Wyatt (Guitar World)', url: 'https://www.guitarworld.com/lessons/talkin-blues-keith-wyatt-massive-attack-slapping-and-raking' },
      { title: 'How to use sweep picking and raking (Rock Guitar For Dummies)', author: 'Jon Chappell (Dummies / Wiley)', url: 'https://www.dummies.com/article/academics-the-arts/music/instruments/guitar/how-to-use-sweep-picking-and-raking-on-the-guitar-143481' },
      { title: 'How to play rake on electric guitar', author: 'f-guitar.com', url: 'https://f-guitar.com/rake-electric-guitar-tutorial.html' },
      { title: 'Rakes (glossary)', author: 'LickLibrary', url: 'https://www.licklibrary.com/glossary/rakes' },
      { title: 'Learn 8 essential blues guitar lead tricks', author: 'Total Guitar (MusicRadar)', url: 'https://www.musicradar.com/how-to/8-essential-blues-guitar-lead-tricks' },
      { title: 'Blues Rhythm Hacks part 4: rhythmic rakes', author: 'Mitch Laddie (LickLibrary)', url: 'https://www.licklibrary.com/learn/lessons/mitch-laddie/blues-rhythm-hacks-part-4-rhythmic-rakes' }
    ]
  },
  ctx: { key: 4, minor: true, prog: 'blues' },
  stages: [
    stage('foundations', 'Click, then the note',
      'Rake two strings into the ♭3, 5th and root of box 1 at 70 BPM with the dead strings silent of pitch and the target landing on the beat, rake three strings into the high e, rake in both directions, and play two raked phrases over a blues.', [
        S('rake-pieces', 'The rake in pieces', 'picking', 'Dead strings, the note, then both.', [
          R_('rake-teach', 'Dead strings, the note, then the rake: {targets} ({key}, box 1)', 'chunking', { teach: true, size: 2, degs: [3, 7, 0], strings: [3, 2, 1], goal: 62, start: 40, why: 'A rake is three things done as one unit: muting the strings so they only click, dragging the pick through them, and landing on a note in time. Playing the dead strings alone, then the target alone, then both in one stroke builds each piece before the whole.', instr: HOW + 'Beats 1–2: pick the two dead strings slowly, one by one (they must click, with no pitch). Beat 3: the target alone. Then the rake: one stroke through the dead strings that lands on the target on the beat, held with vibrato. Pass: every target, each piece clean.', watch: 'The muted strings ringing as notes.', simplify: 'Only the G-string ♭3.' }),
          R_('rake-two', 'Two-string rakes into {targets} ({key})', 'accurate-reps', { size: 2, grace: 0.5, degs: [3, 7, 0], strings: [3, 2, 1], arrive: 'vib', every: 4, len: 2, goal: 64, start: 42, why: 'A small rake (two dead strings) on the 8th before the beat is the version blues players use most. Counting only the clean ones (two clicks, then the note on the beat) builds the clean motion.', instr: HOW + 'One rake a bar, landing on beat 2, the note held with vibrato. Count only rakes where both dead strings click and the target lands on the beat. Pass: 8 clean rakes in a row.', watch: 'The target arriving late because the rake is too slow.', simplify: 'Rake into the G string only.' })], {
          concept: 'A rake drags the pick across strings that are muted, so they give only a percussive click, and stops on a fretted note that rings. The mute comes from the heel of the picking hand resting on the strings and a fretting finger laid flat across them.',
          why: 'Mute, drag and landing must become one motion; learning them separately first keeps the click clean and the note on time.',
          theory: ['The dead strings sit on the low side of the target for a downward rake.', 'Only the last note of a rake has pitch; in a sweep every note sounds.']
        }),
        S('rake-sound', 'A click and a pop', 'picking', 'Listen; three strings into the high e.', [
          R_('rake-click', 'Listen: a click, then a pitch ({key}, box 1)', 'external-focus', { size: 2, grace: 0.5, degs: [3, 7, 0, 10], strings: [3, 2, 1], arrive: 'ring', every: 2, goal: 66, start: 44, why: 'The sound tells you everything: a good rake is a short, dry percussive click and then one clear note. Listening for that (instead of watching the hand) is the fastest way to fix the muting.', instr: HOW + 'Rake into each target and listen only: a click (no pitches), then the note. If you hear pitches in the click, mute more; if the note is choked, lift the mute off its string. Pass: every rake a clean click and a clear note.', watch: 'Pitches leaking into the click.', simplify: 'One target, many times.' }),
          R_('rake-top', 'Three dead strings into the high e: {targets} ({key})', 'accurate-reps', { size: 3, grace: 0.5, degs: [0, 3, 7], strings: [1], boxes: [1, 4], arrive: 'vib', every: 4, len: 2, goal: 64, start: 42, why: 'B.B. King’s trademark: the heel of the hand rests on the lower strings, the pick drags across them and the top note pops out loud and clear. Three dead strings give a bigger click than two.', instr: HOW + 'The D, G and B strings are dead; rake through them into the e-string note on beat 2 and hold it with vibrato. Pass: 8 rakes in a row where the top note pops and nothing else rings.', watch: 'Muting so hard that the e string is choked too.', simplify: 'Two dead strings.' })], {
          concept: 'A clean rake is heard as a short dry click followed by one clear, emphatic note. A rake over three strings into the top string is the B.B. King version.',
          why: 'The ear is the best judge of the mute: pitches in the click mean too little mute, a choked target too much.',
          theory: ['The more dead strings, the longer and louder the click.', 'The target note should pop out louder than a normally picked note.']
        }),
        S('rake-where', 'Down and up', 'picking', 'The landing notes; rakes in both directions.', [
          R_('rake-landing', 'Rakes into the landing notes of box 1: root, ♭3 and 5th ({key})', 'accurate-reps', { size: 2, grace: 0.5, degs: [0, 3, 7], strings: [4, 3, 2, 1], arrive: 'vib', every: 2, goal: 64, start: 42, why: 'Rakes usually go into the notes a phrase rests on: the root, the ♭3 and the 5th. Raking into each of them on the D, G, B and e strings moves the mute with the target.', instr: HOW + 'Rake into each written note on the beat and hold it with vibrato; the dead strings change as the target moves up. Pass: the whole run with every target clean.', watch: 'The mute staying on the old strings when the target moves.', simplify: 'The G and B strings only.' }),
          R_('rake-up', 'Down-rakes and up-rakes alternating: {targets} ({key})', 'variable', { size: 2, grace: 0.5, degs: [3, 7, 0], strings: [4, 3], dir: 'alt', arrive: 'vib', every: 2, goal: 64, start: 42, why: 'A rake can be pushed down through the lower strings or pulled up through the higher strings into a note on a lower string (a Stevie Ray Vaughan habit). Alternating them makes the motion work in both directions.', instr: HOW + 'Odd notes: down-rake from the lower strings. Even notes: up-rake from the higher strings, muted by the fretting fingers above the target. Pass: every rake clean in both directions.', watch: 'Up-rakes catching the target string twice.', simplify: 'Down-rakes only.' })], {
          concept: 'Rakes can be picked down (through the strings below the target) or up (through the strings above it). The landing note is usually a strong note of the scale: the root, ♭3 or 5th.',
          why: 'Both directions are needed in real lines: the up-rake comes naturally after a phrase on the top strings.',
          theory: ['Down-rake: the dead strings are lower in pitch than the target. Up-rake: higher.', 'In the minor pentatonic the root, ♭3 and 5th are the notes phrases rest on.']
        }),
        S('rake-first-music', 'First music', 'improv', 'Raked phrases over a blues.', [c => rakePhrase(c, { level: 1 }), R_('rake-call', 'Call and response: plain call, raked answer ({key})', 'transfer', { size: 2, grace: 0.5, degs: [3, 0], strings: [3, 1], arrive: 'vib', every: 4, len: 2, backing: blues, goal: 66, start: 44, why: 'A rake makes an answer louder and more urgent than the question. Playing a plain phrase, then answering with a raked note, uses the rake as phrasing, not just technique.', instr: 'Over the backing: play two bars of your own plain phrase, then the written raked note with vibrato as the answer. Pass: four questions and raked answers in time.', watch: 'Raking every note of the question too.', simplify: 'Answer with the ♭3 only.' })], {
          concept: 'In music a rake is the attack of the notes a phrase leans on: its first note and its long note.',
          why: 'Rakes on every note lose their effect; placed on the important notes they make the phrase speak.',
          theory: ['Leave space after a raked long note.', 'The rake ends exactly on the beat; the click is the pickup.']
        })
      ], [1, 3]),
    stage('intermediate', 'Bends, sizes and boxes',
      'Rake three strings into bends, slides and vibrato on the shuffle’s last triplet at 84 BPM, rake into the root, ♭3, 5th and ♭7 in every box, and play raked phrases and a blues solo with rakes on the strong notes.', [
        S('rake-bends', 'Into bends', 'fretting', 'The rake that cries.', [
          R_('rake-bend', 'Rake into whole-step bends: {targets} ({key})', 'accurate-reps', { size: 3, degs: [5, 10, 3], strings: [3, 2, 1], arrive: 'bend', every: 2, goal: 78, start: 48, why: 'Raking into a bend (the 4 to the 5, the ♭7 to the root, the ♭3 to the 4) is the classic Texas and Albert King attack. The bend must still reach pitch after the rake.', instr: HOW + 'Rake three dead strings into the note and bend it a whole step on arrival. Count only the ones that reach pitch. Pass: 8 clean in a row.', watch: 'The bend falling short because the rake used up your attention.', simplify: 'Two-string rakes.' }),
          R_('rake-bend-vib', 'Rakes into bends and vibrato, alternating ({key})', 'variable', { size: 3, degs: [5, 3, 10, 7], strings: [3, 2], arrive: ['bend', 'vib'], every: 2, goal: 78, start: 48, why: 'Alternating the arrival (a bend, then a vibrato) keeps the rake the same while the note changes, as in real phrases.', instr: HOW + 'Odd notes: bend on arrival. Even notes: vibrato. Pass: all of them in time.', watch: 'Bending the vibrato notes by habit.', simplify: 'Half the tempo.' })], {
          concept: 'A rake straight into a bent note: the dead strings click, then the note is picked and pushed up to the next pentatonic degree.',
          why: 'This is the most vocal blues attack; the bend has to reach pitch even though the hand just raked.',
          theory: ['Whole-step bends in the minor pentatonic: 4 → 5, ♭7 → root; the ♭3 bends to the 4.', 'Rake first, then bend: they happen one after the other, not at once.']
        }),
        S('rake-size', 'Size and timing', 'picking', 'Three and four strings; the shuffle triplet.', [
          R_('rake-big', 'Bigger rakes: {size} rakes into {targets} ({key})', 'variable', { size: 3, degs: [3, 7], strings: [2, 1], arrive: 'vib', every: 2, goal: 78, start: 48, why: 'More dead strings make a longer, louder click. The rake must speed up to fit the same space, so the target still lands on the beat.', instr: HOW + 'Rake across the dead strings below the B and e strings into the target. Pass: every rake ends on the beat.', watch: 'The rake starting early to make room: it must start later and move faster.', simplify: 'Two-string rakes at the same tempo.' }),
          R_('rake-triplet', 'Rakes on the last triplet of the shuffle ({key})', 'chunking', { size: 2, grace: 1 / 3, degs: [3, 0, 7], strings: [3, 2], arrive: 'vib', every: 2, backing: blues, unit: 'shuffle triplets', goal: 76, start: 46, why: 'In a shuffle the rake fits the last triplet before the beat, like the drummer’s pickup.', instr: HOW + 'Count "1-and-let". First rake only (no target) on "let" for a bar, then add the target on the beat. Pass: four bars locked to the shuffle.', watch: 'Rakes landing on straight 16ths.', simplify: 'One rake per bar.' })], {
          concept: 'The size of a rake is how many dead strings it crosses; its timing is how long before the beat it starts, so the target always lands on the beat.',
          why: 'A bigger rake must move faster in the same space; in a shuffle it belongs on the last triplet.',
          theory: ['Two strings: the 8th before the beat. Three or four: a fast flick in the last 16th or triplet.', 'The target, not the start of the rake, is on the beat.']
        }),
        S('rake-boxes', 'Every box', 'fretboard', 'Rakes all over the neck.', [
          R_('rake-all-boxes', 'Rakes into the root and 5th in boxes 1 to 5 ({key})', 'interleaving', { size: 2, degs: [0, 7], strings: [2], boxes: [1, 2, 3, 4, 5], arrive: 'vib', every: 2, goal: 80, start: 50, why: 'Changing box every note changes the fret, the finger and the muting, so the rake works anywhere on the neck.', instr: HOW + 'On the B string, rake into the root or 5th of each box from 1 to 5. Pass: the whole run with every rake clean.', watch: 'Muting that works in box 1 failing higher up.', simplify: 'Boxes 1–3.' }),
          R_('rake-box2', 'Rakes into the root, ♭3, 5th and ♭7 of box 2 ({key})', 'accurate-reps', { size: 2, degs: [0, 3, 7, 10], strings: [4, 3, 2, 1], boxes: [2], arrive: 'vib', every: 2, goal: 78, start: 48, why: 'Box 2 is the next place blues phrases live. Raking into its strong notes on four strings moves the mute across a new shape.', instr: HOW + 'Rake into each written note of box 2 on the beat with vibrato. Pass: the run twice with every click dry and every note clear.', watch: 'Falling back to box 1 fingerings.', simplify: 'The G and B strings only.' })], {
          concept: 'The same rake into target notes in all five pentatonic boxes, the mute moving with the hand.',
          why: 'Rakes are used all over the neck; the muting has to be found again in every position.',
          theory: ['Each box has the root, ♭3, 5th and ♭7 on different strings.', 'Higher up the neck the frets are closer, so the flattened finger covers less distance.']
        }),
        S('rake-slides', 'Into slides; up-rakes into bends', 'fretting', 'Combinations.', [
          R_('rake-slide', 'Rake, then slide up into {targets} ({key})', 'chunking', { size: 2, degs: [3, 7, 0, 10, 5], strings: [3, 2], arrive: 'slide', every: 2, goal: 78, start: 48, why: 'A rake into the scale note just below, then a slide up to the target, is a favourite blues combination: the click, then the note gliding in.', instr: HOW + 'Rake into the first note on the beat, then slide up on the same string to the target on the off-beat and let it ring. First the slide alone, then with the rake. Pass: every slide arrives in tune on the off-beat.', watch: 'The slide overshooting the target fret.', simplify: 'Two targets.' }),
          R_('rake-up-bends', 'Up-rakes into bends on the G string ({key})', 'variable', { size: 2, degs: [5, 3], strings: [3], dir: 'up', arrive: 'bend', every: 2, boxes: [1, 4], goal: 76, start: 46, why: 'An upstroke rake from the B and e strings into a G-string bend comes after a phrase on the top strings: the rake joins the phrase instead of interrupting it.', instr: HOW + 'Upstroke through the dead B and e strings into the G-string note, then bend it. Pass: every bend in tune after an up-rake.', watch: 'Hitting the D string after the target.', simplify: 'Down-rakes.' })], {
          concept: 'A rake combined with a second move: a slide up into the target, or an up-rake into a bend.',
          why: 'Rakes are rarely alone: they lead into slides, bends and vibrato in real phrases.',
          theory: ['The slide starts from the pentatonic note just below the target on the same string.', 'An up-rake crosses the higher strings, so they are muted by the fretting fingers.']
        }),
        S('rake-music', 'In music', 'improv', 'Phrases and a solo.', [c => rakePhrase(c, { level: 2 }), c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Blues solo with a rake into the first note of every phrase' })], {
          concept: 'Raked phrases with bends, then a solo where the first note of every phrase is raked.',
          why: 'Using the rake in phrases over a blues is the point of the technique.',
          theory: ['Rake the notes that start and end a phrase.', 'Rakes combine with bends, slides and vibrato.']
        })
      ], [4, 6]),
    stage('advanced', 'Rakes as accents',
      'Rake four strings into every beat with 16th-note timing at 96 BPM, play a single-note shuffle rhythm part with rakes, rake in four keys and every box, mix directions and arrivals, and play raked blues phrases and a slow-blues solo where every strong note is raked.', [
        S('rake-fast', 'On every beat', 'picking', 'Four-string rakes at tempo; rhythmic rakes.', [
          R_('rake-every-beat', 'Four-string rakes into every beat ({key}, boxes 1 and 4)', 'edge', { size: 4, grace: 0.25, degs: [3, 7, 0], strings: [2, 1], boxes: [1, 4], arrive: 'ring', every: 1, goal: 96, start: 56, why: 'A rake into every beat is the most intense form of the technique (and the hardest to keep in time): each rake a fast flick, each note exactly on the click.', instr: HOW + 'Tempo ladder: +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Rakes eating the end of the previous note.', simplify: 'Every other beat.' }),
          R_('rake-bend-trip', 'Rakes into bends on the shuffle triplet, three strings ({key})', 'accurate-reps', { size: 3, grace: 1 / 3, degs: [5, 10, 3], strings: [3, 2, 1], boxes: [1, 4], arrive: 'bend', every: 2, backing: blues, goal: 92, start: 54, why: 'Rakes into bends at a shuffle tempo, in two boxes: the core of Texas blues lead playing.', instr: HOW + 'Count only the bends that reach pitch after a clean rake. Pass: 8 clean in a row.', watch: 'Short bends.', simplify: 'Box 1 only.' }),
          R_('rake-rhythm', 'Rhythmic rakes: a single-note shuffle part on the D string ({key})', 'transfer', { size: 2, grace: 1 / 3, degs: [0, 3, 5, 7, 10], strings: [4], boxes: [1, 2], arrive: 'ring', every: 1, len: 2 / 3, backing: blues, unit: 'shuffle triplets', goal: 92, start: 54, why: 'Single-note rhythm parts with a rake into each note give a shuffle a driving, percussive sound (Stevie Ray Vaughan): the low dead strings click like a snare before every bass note.', instr: HOW + 'The heel of the hand rests on the A and low E strings; rake through them into each D-string note on the beat, short, with the shuffle. Pass: four bars locked to the backing with every note short and even.', watch: 'The notes ringing into each other: release each one before the next rake.', simplify: 'Half the notes.' })], {
          concept: 'Rakes at tempo: four-string flicks into every beat, rakes into bends on the shuffle triplet, and rakes as rhythm on the bass strings.',
          why: 'At tempo the rake becomes a percussive accent and, on the low strings, part of the groove.',
          theory: ['A four-string rake in a 16th is a single fast flick from a relaxed wrist.', 'Rhythmic rakes are short: the note is released before the next click.']
        }),
        S('rake-keys', 'Any key, any box', 'fretboard', 'Four keys; five boxes.', [
          R_('rake-keys', 'Four keys around the cycle of fourths ({key} and up)', 'interleaving', { size: 3, grace: 0.25, keys: [0, 5, 10, 3], degs: [3, 7, 0], strings: [3, 2], arrive: 'vib', every: 2, goal: 92, start: 54, why: 'The landing notes move with the key. Changing key every block means finding them again and raking into them straight away.', instr: HOW + 'Box 1 of four keys, a fourth apart. Pass: all four keys without stopping.', watch: 'Rakes into the old key’s notes.', simplify: 'Two keys.' }),
          R_('rake-five-boxes', 'Rakes into the landing notes of boxes 3, 5, 1, 4 and 2 ({key})', 'interleaving', { size: 3, grace: 0.25, degs: [0, 3, 7], strings: [3, 2, 1], boxes: [3, 5, 1, 4, 2], arrive: 'vib', every: 1, len: 0.75, goal: 92, start: 54, why: 'Out of order, every box’s landing notes with a rake into each: hitting a strong note anywhere on the neck.', instr: HOW + 'Boxes 3, 5, 1, 4, 2: in each, rake into the root, ♭3 and 5th on the G, B and e strings as written. Pass: all five boxes without stopping.', watch: 'The mute arriving late after each jump.', simplify: 'Boxes 1–3.' })], {
          concept: 'Rakes into the strong notes of every box and of four keys a fourth apart.',
          why: 'Mixing keys and positions once the motion is secure makes it reliable anywhere.',
          theory: ['Around the cycle of fourths each key is five frets up (or seven down).', 'The box order 3, 5, 1, 4, 2 forces a real jump each time.']
        }),
        S('rake-mixed', 'Mixed arrivals', 'fretting', 'Bend, slide, vibrato, ring.', [
          R_('rake-mix', 'Every arrival in turn: bend, slide, vibrato, ring ({key})', 'variable', { size: 3, grace: 0.25, degs: [5, 3, 7, 10, 0], strings: [3, 2], boxes: [1, 4], arrive: ['bend', 'slide', 'vib', 'ring'], every: 2, goal: 92, start: 54, why: 'The same rake into four different arrivals, changing every note: the rake stays automatic while the note does something new each time.', instr: HOW + 'Bend, slide, vibrato, plain, in turn. Pass: all of them in time.', watch: 'The slides arriving late.', simplify: 'Bend and vibrato only.' }),
          R_('rake-up-mix', 'Down- and up-rakes into bends and vibrato across boxes 1 and 2 ({key})', 'variable', { size: 2, grace: 0.25, degs: [5, 3, 7], strings: [3, 2], boxes: [1, 2], dir: 'alt', arrive: ['bend', 'vib'], every: 2, goal: 92, start: 54, why: 'Alternating rake direction and arrival at the same time, in two boxes, prepares the hand for rakes in the middle of real lines.', instr: HOW + 'Odd notes down-rake, even notes up-rake; bends and vibratos alternate. Pass: all of them clean.', watch: 'Up-rakes getting bigger than the down-rakes.', simplify: 'One box.' })], {
          concept: 'Rakes in both directions into bends, slides, vibrato and plain notes, mixed note by note.',
          why: 'Real lines change direction and arrival constantly; the rake has to stay the same underneath.',
          theory: ['Down-rakes follow lower notes, up-rakes follow higher ones.', 'Keep the rake size constant while the arrival changes.']
        }),
        S('rake-adv-music', 'In music', 'improv', 'Blues phrases; a slow blues.', [c => rakePhrase(c, { level: 3 }), c => targetGuide(c, { prog: 'slowBlues', scale: 'minorPent', name: 'Slow blues: rake into every note that starts or ends a phrase' })], {
          concept: 'Blues phrases with a rake on every strong note, then a slow-blues solo built the same way.',
          why: 'In a slow blues every rake is heard; it has to be as controlled as the note itself.',
          theory: ['Slow tempos expose late or ringing rakes.', 'Vary the rake size with the dynamics of the phrase.']
        })
      ], [7, 8]),
    stage('mastery', 'Your attack',
      'Rake four strings into every beat at 104 BPM in any box, play a changing sequence of boxes, rake sizes and arrivals in time, rake into bends in six keys, and perform an original 12-bar raked blues and your own version.', [
        S('rake-performance', 'At performance tempo', 'picking', 'Fast and anywhere.', [
          R_('rake-perf', 'Performance tempo: four-string rakes on every beat in two keys ({key})', 'edge', { size: 4, grace: 0.25, keys: [0, 7], degs: [3, 7, 0], strings: [2, 1], boxes: [1, 4], arrive: ['ring', 'vib'], every: 1, goal: 104, start: 62, why: 'Rakes at performance tempo in two keys and two boxes: speed, muting and timing together.', instr: HOW + 'Tempo ladder from the start tempo, +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Tension in the picking forearm.', simplify: 'One key.' }),
          c => rakeRandom(c)], {
          concept: 'Rakes at performance tempo, and a sequence that changes box, rake size and arrival every bar.',
          why: 'At mastery the rake is an accent available on any note, at any size, at full speed.',
          theory: ['A relaxed forearm keeps fast rakes even.', 'Changing size and arrival bar by bar keeps the motion flexible.']
        }),
        S('rake-any-key', 'Any key', 'fretboard', 'Six keys; two choruses.', [
          R_('rake-bends-keys', 'Raked bends at tempo in box 2, six keys ({key} and around)', 'interleaving', { size: 3, grace: 0.25, keys: [0, 5, 10, 3, 8, 1], degs: [5, 10], strings: [3, 2], boxes: [2], arrive: 'bend', every: 2, goal: 100, start: 60, why: 'The bend notes of box 2 (the 4 on the G string, the ♭7 on the B string) in six keys, raked into and bent at tempo.', instr: HOW + 'In each key, rake into the 4 and the ♭7 of box 2 and bend each a whole step, as written. Pass: all six keys in time with every bend in tune.', watch: 'A pause at each key change.', simplify: 'Three keys.' }),
          c => targetGuide(c, { prog: 'blues', scale: 'minorPent', name: 'Two blues choruses: the first with no rakes, the second with a rake on every strong note' })], {
          concept: 'Raked bends in six keys, and two choruses that compare the same solo without and with rakes.',
          why: 'A rake should be a choice: hearing the plain chorus next to the raked one shows what it adds.',
          theory: ['Box 2 bends: the 4 to the 5 on the G string, the ♭7 to the root on the B string.', 'Six keys around the cycle of fourths cover half the keys.']
        }),
        S('rake-voice', 'Your own blues', 'improv', 'A study, then your version.', [c => rakeEtude(c),
          R_('rake-own', 'Make it yours: rake your own phrase in every box ({key})', 'transfer', { size: 3, grace: 1 / 3, degs: [3, 7, 0], strings: [3, 2, 1], boxes: [1, 2, 3, 4, 5], arrive: ['vib', 'bend', 'ring'], every: 4, len: 1, backing: blues, goal: 96, start: 58, minutes: 6, why: 'Mastery means using the rake as your own accent: the tab gives one raked note per bar through all five boxes; the lesson is to build a phrase of your own after each one.', instr: HOW + 'Rake into the written note on beat 2, then finish the bar with your own phrase in that box. Pass: all bars in time, every phrase different.', watch: 'Phrases that ignore the box the rake landed in.', simplify: 'Boxes 1 and 2.' })], {
          concept: 'An original 12-bar blues study built on rakes through the boxes, then your own phrases after raked notes in all five boxes.',
          why: 'The capstone puts every rake size and arrival into one piece of music, then hands the rake over to you.',
          theory: ['The study moves from box 1 up through boxes 2, 4 and 5 and back.', 'Every bar is answered by short notes: the rake leads, the phrase follows.']
        })
      ], [9, 10])
  ]
});
