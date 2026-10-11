// Open-string pull-offs: fretted notes pulled off to a ringing open string, the fastest legato on the
// guitar and a staple of rock and blues-rock licks in E, A, D and G (early Van Halen, Hendrix, Page,
// Angus Young, and every "open-string cascade"). From the first pull-off to the open string, through
// melodies over an open-string pedal, double pull-offs, hammer-from-open figures and cascades across
// strings, to 16th-note and sextuplet runs, riffs that mix palm-muted open notes with pull-off fills,
// random access at tempo and an original study.
//
// Concept-first (CONTENT.md): the model is a PEDAL (the open string, or, in a key where no open string
// belongs to the scale, the index finger barred at the nearest fret that plays a scale tone: a "capo
// pedal") plus the key's scale laid out on that string above it. `pedalFor` chooses the pedal string by
// what the open string is in the key (root, then 5th, then other scale tones), so every note is a scale
// tone in every key by construction. A FIGURE is a beat of roles over the pedal: pull-off pairs (f p 0),
// pull–hammer triplets (f p 0 h g), double pull-offs (g p f p 0), hammer-from-open (0 h f p 0), the
// 16th "climb" (f p 0 h f p 0), and walking melodies where each fretted note returns to the pedal. The
// composer `opRun(c, spec)` builds an exercise from figure × melody plan (a list of scale steps above
// the pedal) × string plan (one string, or a cascade across the open strings in the key) × scale
// (natural minor, minor pentatonic, major, Dorian) × key plan × rhythm.
import { OPEN, N, nameOf, make, mod12, S, stage, entry, targetGuide } from '../lib.js';
import { rng } from './bending.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const SN = ['', 'e', 'B', 'G', 'D', 'A', 'E'];
export const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], pent: [0, 3, 5, 7, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], blues: [0, 3, 5, 6, 7, 10] };
const SC_NAME = { minor: 'natural minor', pent: 'minor pentatonic', major: 'major scale', dorian: 'Dorian', blues: 'blues scale' };
/** The scale a lesson uses in this key: minor-key lessons use the minor forms, major keys the major scale. */
const MAJOR_OF = { pent: 'majPent', dorian: 'mixo', blues: 'majBlues' };
const scaleFor = (c, sc) => (c.minor ? sc || 'minor' : MAJOR_OF[sc] || 'major');
Object.assign(SCALES, { majPent: [0, 2, 4, 7, 9], mixo: [0, 2, 4, 5, 7, 9, 10], majBlues: [0, 2, 3, 4, 7, 9] });
Object.assign(SC_NAME, { majPent: 'major pentatonic', mixo: 'Mixolydian', majBlues: 'major blues scale' });
export const pcsOf = (k, sc) => SCALES[sc].map(x => mod12(k + x));
const DEG = { 0: 'root', 7: '5th', 3: '♭3', 4: '3rd', 5: '4th', 10: '♭7', 2: '2nd', 9: '6th', 8: '♭6', 11: '7th', 6: '♭5' };
/**
 * The pedal for a key on a set of candidate strings: the open string whose pitch is the key's root, else
 * its 5th, else another scale tone; when none fits, the lowest fret (1–4) on the first string where a
 * scale tone sits, held by the index finger as a "capo". Returns { s, p (fret of the pedal), open, deg }.
 */
export function pedalFor(k, sc, strings = [1, 2, 3]) {
  const pcs = pcsOf(k, sc), rank = d => (d === 0 ? 0 : d === 7 ? 1 : d === 3 || d === 4 ? 2 : 3);
  const cands = strings.filter(s => pcs.includes(mod12(OPEN[s]))).map(s => ({ s, p: 0, open: true, deg: mod12(OPEN[s] - k) }));
  if (cands.length) return cands.sort((a, b) => rank(a.deg) - rank(b.deg) || strings.indexOf(a.s) - strings.indexOf(b.s))[0];
  const s = strings[0]; for (let f = 1; f <= 4; f++) if (pcs.includes(mod12(pitch(s, f)))) return { s, p: f, open: false, deg: mod12(pitch(s, f) - k) };
  return null;
}
/** The scale tones above the pedal on its string (frets), the first `n` of them. */
export const ladder = (k, sc, ped, n = 9) => { const pcs = pcsOf(k, sc), o = []; for (let f = ped.p + 1; f <= 22 && o.length < n; f++) if (pcs.includes(mod12(pitch(ped.s, f)))) o.push(f); return o; };
/** Open strings of the key, top string first (for cascades); capo pedals don't cascade. */
const openStrings = (k, sc, from = [1, 2, 3, 4]) => from.filter(s => pcsOf(k, sc).includes(mod12(OPEN[s])));

/* ------------------------------- Figures ------------------------------- */
// A figure renders one beat from a melody step i (index into the ladder): returns [[fret, technique], …].
// P is the pedal fret, a and b the ladder frets at i and i+1.
export const FIGURES = {
  pair: { per: 2, unit: '8th notes', name: 'pull-off pairs', f: (a, b, P) => [[a, null], [P, 'p']] },
  pair16: { per: 4, unit: '16th notes', name: 'pull-off 16ths', f: (a, b, P) => [[a, null], [P, 'p'], [a, 'h'], [P, 'p']] },
  trip: { per: 3, unit: '8th-note triplets', name: 'pull–hammer triplets', f: (a, b, P) => [[a, null], [P, 'p'], [b, 'h']] },
  double: { per: 3, unit: '8th-note triplets', name: 'double pull-offs', f: (a, b, P) => [[b, null], [a, 'p'], [P, 'p']] },
  fromOpen: { per: 3, unit: '8th-note triplets', name: 'hammer from the pedal', f: (a, b, P) => [[P, null], [a, 'h'], [P, 'p']] },
  climb: { per: 4, unit: '16th notes', name: 'the 16th-note climb', f: (a, b, P) => [[b, null], [a, 'p'], [P, 'p'], [a, 'h']] },
  six: { per: 6, unit: '16th-note sextuplets', name: 'sextuplet cascades', f: (a, b, P) => [[b, null], [a, 'p'], [P, 'p'], [a, 'h'], [b, 'h'], [a, 'p']] }
};
/** Melody plans: which ladder steps each beat starts on. */
export const PLANS = {
  up: n => Array.from({ length: n }, (_, i) => i),
  updown: n => { const u = Array.from({ length: Math.ceil(n / 2) }, (_, i) => i); return [...u, ...u.slice(0, n - u.length).reverse().map(x => x)]; },
  down: n => Array.from({ length: n }, (_, i) => n - 1 - i),
  zig: n => Array.from({ length: n }, (_, i) => (i % 2 ? Math.floor(i / 2) + 2 : Math.floor(i / 2))),
  hold: n => Array.from({ length: n }, (_, i) => [0, 2, 1, 3][i % 4])
};

/* ------------------------------- The composer ------------------------------- */
/**
 * One open-string exercise from a spec: { id, name ('{key}', '{string}', '{scale}', '{fig}'), method, fig,
 * plan, beats (per string), strings (candidate pedal strings, or cascade: true for every open string of the
 * key, top first), scale, keys (offsets), teach (pieces first), reps, riff (palm-muted low pedal between
 * fills), backing, domain, goal, start, dl, why, instr, watch, simplify }.
 */
export function opRun(c, spec) {
  const k0 = mod12(c.key), notes = [], used = [], scU = []; let t = 0;
  const F = FIGURES[spec.fig || 'pair'], beats = spec.beats || 8, reps = spec.reps || 1;
  for (const off of spec.keys || [0]) {
    const k = mod12(k0 + off), sc = scaleFor(c, spec.scale), pcs = pcsOf(k, sc);
    let peds;
    if (spec.cascade) { const os = openStrings(k, sc, spec.strings || [1, 2, 3, 4]); peds = os.length >= 2 ? os.map(s => ({ s, p: 0, open: true })) : [pedalFor(k, sc, spec.strings || [1, 2, 3])]; }
    else peds = [pedalFor(k, sc, spec.strings || [1, 2, 3])];
    if (peds.some(p => !p)) return null;
    scU.push(sc);
    for (let r = 0; r < reps; r++) for (const ped of peds) {
      const L = ladder(k, sc, ped, 10); if (L.length < 5) return null;
      const P = ped.p, plan = PLANS[spec.plan || 'up'](beats);
      if (spec.teach) {
        // pieces: pick the fretted note and let it ring, then the pull-off alone, then the figure
        for (const i of plan.slice(0, 2)) {
          notes.push(tag(N(ped.s, L[i], t, 1), pcs), tag(N(ped.s, P, t + 1, 1), pcs));
          notes.push(tag(N(ped.s, L[i], t + 2, 1), pcs), tag(N(ped.s, P, t + 3, 1, 'p'), pcs)); t += 4;
        }
      }
      plan.forEach((i, b) => {
        const a = L[Math.min(i, L.length - 2)], bb = L[Math.min(i + 1, L.length - 1)];
        if (spec.riff && b % 2 === 0) {
          // the riff beat: palm-muted 8ths on the low pedal (the open low string in the key, or its root)
          const low = riffLow(k, sc); notes.push(tag(N(low.s, low.f, t, 0.5, 'pm'), pcs), tag(N(low.s, low.f, t + 0.5, 0.5, 'pm'), pcs)); t += 1; return;
        }
        const G = spec.figs ? FIGURES[spec.figs[b % spec.figs.length]] : F, st = 1 / G.per;
        G.f(a, bb, P).forEach(([f, x], j) => notes.push(tag(N(ped.s, f, t + j * st, st, x), pcs)));
        t += 1;
      });
      // land on the pedal's root-most note: the lowest ladder note that is the root, else the pedal
      const land = [P, ...L].find(f => mod12(pitch(ped.s, f) - k) === 0);
      notes.push(tag(N(ped.s, land != null ? land : P, t, 1, land ? '~' : null), pcs)); t += 1;
      if (t % 4) t += 4 - (t % 4);
      used.push(`${nameOf(k)}: ${SN[ped.s]} string ${ped.open ? 'open' : `capo pedal at fret ${P}`}`);
    }
  }
  if (notes.length < 6 || notes.length > 400) return null;
  const first = used[0].split(': ')[1];
  const fill = x => String(x).replace(/\{key\}/g, `${nameOf(k0)} ${c.minor ? 'minor' : 'major'}`).replace(/\{string\}/g, spec.cascade ? 'strings cascading down' : first)
    .replace(/\{scale\}/g, SC_NAME[scU[0]]).replace(/\{fig\}/g, F.name);
  const chords = spec.backing ? spec.backing(k0, c) : null;
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'fretting', method: spec.method, unit: spec.unit || F.unit,
    goal: spec.goal || 100, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr) + (used.some(u => u.includes('capo')) ? ' (In this key no open string is in the scale, so the index finger holds a "capo" pedal: the same motion, pulled off to the held note.)' : ''),
    watch: spec.watch, simplify: spec.simplify, ...(chords ? { backing: chords, chords: [...new Set(chords)] } : {}), tab: { notes }
  });
}
/** The low riff note: the open low E or A string when it is the key's root or 5th, else the root on the low E string. */
function riffLow(k, sc) {
  for (const s of [6, 5]) { const d = mod12(OPEN[s] - k); if (d === 0 || d === 7) return { s, f: 0 }; }
  let f = mod12(k - OPEN[6]); return { s: 6, f };
}
const O_ = (id, name, method, opts) => c => opRun(c, { id, name, method, ...opts });
/** Backing: i – ♭VII – ♭VI – ♭VII in minor, I – ♭VII – IV – I in major (open-string rock). */
const rockProg = (k, c) => (c.minor ? [nameOf(k) + 'm', nameOf(k + 10), nameOf(k + 8), nameOf(k + 10)] : [nameOf(k), nameOf(k + 10), nameOf(k + 5), nameOf(k)]);

/* ------------------------------ Kept generator ------------------------------ */
/** Pull-offs to the open string walking up the scale (kept: the original lesson, now in any key). */
export function evhOpenPulloffs(c) {
  return opRun(c, { id: 'evh-open-pulloffs', name: 'Pull-offs to the open string: walking up the {scale} ({key}, {string})', method: 'accurate-reps', fig: 'pair16', plan: 'up', beats: 7, strings: [1, 2],
    goal: 112, start: 60, why: 'Pulling off to an open string is the fastest legato there is: one finger walks up the scale while the open string keeps the line moving, a sound all over early Van Halen.',
    instr: 'Pick the fretted note, pull off to the open string, hammer back on, pull off again: four 16ths a fret, walking up the scale. Count only passes where the open string is as loud as the fretted note. Pass: three clean passes in a row.',
    watch: 'The open string getting quieter than the fretted note.', simplify: '8th notes, the first three frets.' });
}

/* ------------------------------ Music ------------------------------ */
/** A random string, figure and plan every bar (interleaving). */
export function opRandom(c) {
  const r = rng(733 + (c.lvl || 9)), k = mod12(c.key), sc = scaleFor(c, 'minor'), pcs = pcsOf(k, sc), notes = [], names = [];
  const os = openStrings(k, sc, [1, 2, 3, 4]); const peds = os.length ? os.map(s => ({ s, p: 0, open: true })) : [pedalFor(k, sc)];
  const figs = ['trip', 'double', 'climb', 'pair16', 'six'], plans = ['up', 'down', 'zig'];
  for (let bar = 0; bar < 8; bar++) {
    const ped = peds[Math.floor(r() * peds.length)], fig = figs[Math.floor(r() * figs.length)], plan = plans[Math.floor(r() * plans.length)];
    const L = ladder(k, sc, ped, 8), F = FIGURES[fig], steps = PLANS[plan](4);
    steps.forEach((i, b) => F.f(L[i], L[i + 1], ped.p).forEach(([f, x], j) => notes.push(tag(N(ped.s, f, bar * 4 + b + j / F.per, 1 / F.per, x), pcs))));
    names.push(`${SN[ped.s]} string, ${F.name}, ${plan}`);
  }
  return make(c, {
    id: 'op-random', name: `Random access: a new string, figure and direction every bar (${nameOf(k)} ${c.minor ? 'minor' : 'major'})`, domain: 'fretboard', method: 'interleaving', unit: 'mixed groupings', goal: 104, start: 58, minutes: 5, dl: 1, tab: { notes },
    why: 'At mastery level open-string figures are vocabulary: a random string, figure and direction every bar makes them available on demand instead of as rehearsed runs.',
    instr: `${names.join(' → ')}. Read only the names: find the scale on that string and play the figure. Pass: all 8 bars in time from the names alone.`,
    watch: 'Every bar becoming the same figure.', simplify: 'Triplets in every bar.'
  });
}
/** An original study: a palm-muted riff answered by open-string fills, then a cascade (capstone at mastery). */
function opStudy(c, { capstone = false } = {}) {
  const k = mod12(c.key), sc = scaleFor(c, capstone ? 'dorian' : 'minor'), pcs = pcsOf(k, sc), notes = [];
  const os = openStrings(k, sc, [1, 2, 3, 4]); const peds = (os.length ? os : []).map(s => ({ s, p: 0, open: true }));
  if (!peds.length) { const p = pedalFor(k, sc); if (!p) return null; peds.push(p); }
  const low = riffLow(k, sc); let t = 0;
  const plan = capstone
    ? [['riff'], ['trip', 0, 'up'], ['riff'], ['double', 1, 'down'], ['climb', 0, 'zig'], ['six', 0, 'down'], ['riff'], ['pair16', 1, 'up'], ['trip', 2, 'zig'], ['double', 0, 'down'], ['six', 1, 'up'], ['riff'], ['climb', 2, 'down'], ['six', 0, 'zig'], ['double', 1, 'down'], ['end']]
    : [['riff'], ['trip', 0, 'up'], ['riff'], ['double', 0, 'down'], ['riff'], ['pair16', 1, 'up'], ['climb', 0, 'down'], ['end']];
  for (const [what, pi, pl] of plan) {
    if (what === 'riff') {
      // a palm-muted low pedal riff with two short fretted stabs from the scale on the A or low E string
      const s = low.s, up = []; for (let f = low.f + 1; f <= low.f + 7 && up.length < 2; f++) if (pcs.includes(mod12(pitch(s, f)))) up.push(f);
      [0, 0.5, 1, 1.5, 2.5, 3].forEach(x => notes.push(tag(N(s, low.f, t + x, 0.5, 'pm'), pcs)));
      notes.push(tag(N(s, up[0], t + 2, 0.5), pcs), tag(N(s, up[1] || up[0], t + 3.5, 0.5), pcs));
      t += 4; continue;
    }
    if (what === 'end') { const ped = peds[0], L = ladder(k, sc, ped, 8); const root = [ped.p, ...L].find(f => mod12(pitch(ped.s, f) - k) === 0); notes.push(tag(N(ped.s, root != null ? root : ped.p, t, 4, '~'), pcs)); t += 4; continue; }
    const ped = peds[pi % peds.length], L = ladder(k, sc, ped, 9), F = FIGURES[what];
    PLANS[pl](4).forEach((i, b) => F.f(L[i], L[i + 1], ped.p).forEach(([f, x], j) => notes.push(tag(N(ped.s, f, t + b + j / F.per, 1 / F.per, x), pcs))));
    t += 4;
  }
  const chords = Array.from({ length: plan.length }, (_, i) => (c.minor ? nameOf(k) + 'm' : nameOf(k)));
  return make(c, {
    id: capstone ? 'op-capstone-etude' : 'op-study-8', name: capstone ? `Capstone study: 16 bars of riff and open-string fills (${nameOf(k)} ${SC_NAME[sc]})` : `Study: a palm-muted riff answered by open-string fills (${nameOf(k)} ${c.minor ? 'minor' : 'major'})`,
    domain: 'improv', method: 'transfer', unit: 'mixed groupings', goal: capstone ? 100 : 88, start: capstone ? 56 : 50, minutes: capstone ? 8 : 6, dl: capstone ? 1 : 0,
    backing: chords, chords: [...new Set(chords)], tab: { notes },
    why: capstone ? 'An original 16-bar piece that uses the whole path: a palm-muted riff, triplets, double pull-offs, the 16th climb and sextuplet cascades on every open string of the key, over a one-chord vamp with a Dorian colour.' : 'An original 8-bar piece in the style of early hard rock: a palm-muted riff on the low string answered by open-string pull-off fills on the top strings, ending on the root.',
    instr: capstone ? 'Learn it four bars at a time; name each bar’s figure and string first. Then write your own 16 bars on the same plan (riff, fill, riff, fill …). Pass: the study at the goal tempo, then your own version once.' : 'Learn it two bars at a time, then as one piece. The riff bars stay tight and muted; the fills ring. Pass: two times through at the goal tempo with no gap between riff and fill.',
    watch: 'The fills rushing ahead of the riff.', simplify: capstone ? 'Bars 1–8.' : 'Bars 1–4.'
  });
}
export const opStudyI = c => opStudy(c);
export const opEtude = c => opStudy(c, { capstone: true });

/* --------------------------------- The path --------------------------------- */
const HOW = 'Fret the note with the fingertip, pick it, then pull the finger off downward toward the floor (a small pluck) so the open string sounds as loud as the fretted note. Keep the finger arched so it doesn’t touch the string below, and rest the picking-hand palm on the lower strings. ';
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'openPulls', kind: 'technique', title: 'Open-string pull-offs', domain: 'fretting',
  re: /open.?string (pull|legato|lick|cascade)|pull.?offs? to (the |an )?open/,
  aliases: ['open string licks', 'open string legato', 'pull-offs to open strings'],
  summary: 'Fretted notes pulled off to a ringing open string: from the first pull-off, through melodies over the open-string pedal, double pull-offs, hammer-from-open figures and cascades across the open strings of the key, to 16th and sextuplet runs, riffs with open-string fills, random access at tempo and an original study.',
  prereqs: [],
  sources: ['https://guitarworld.com/lessons/last-licks-open-string-riffs', 'https://www.guitarplayer.com/lessons/eddie-van-halens-playing-secrets-how-to-solo-like-the-lead-guitar-legend', 'https://guitargearfinder.com/lessons/pull-off-exercises', 'https://www.premierguitar.com/lessons/electric-etudes-eddie-van-halen-techniques'],
  ctx: { key: 4, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Pull off to the open string',
      'Pull-off pairs and pull–hammer triplets up the scale on the e string at 70 BPM with the open string as loud as the fretted note and no other string ringing; name the scale notes on the string from memory; play a first open-string melody with the backing.', [
        S('op-motion', 'The pull-off in pieces', 'fretting', 'Ring, pull, then the pair.', [
          O_('op-teach', 'The pull-off in pieces: ring, pull off, then pairs ({key}, {string})', 'chunking', { teach: true, fig: 'pair', plan: 'up', beats: 6, goal: 72, start: 40, why: 'A pull-off to an open string is a pluck by the fretting finger. Hearing the fretted note and the open string separately, then joined by the pull-off, builds the motion in two clean pieces.', instr: HOW + 'First the pieces: pick the fretted note, then pick the open string; then pick the fretted note and pull off to the open string. Then the pairs up the scale. Pass: every pull-off as loud as the picked open string.', watch: 'Lifting the finger straight up: the open string barely sounds.', simplify: 'Only the first two notes.' }),
          O_('op-pairs', 'Pull-off pairs up the {scale}, counting the clean ones ({key}, {string})', 'accurate-reps', { fig: 'pair', plan: 'updown', beats: 8, goal: 74, start: 42, why: 'Counting only clean pairs (fretted note and open string equally loud, nothing else ringing) trains the downward flick until it is automatic.', instr: HOW + '8th notes: pick, pull off. Up the scale and back. Pass: 16 clean pairs in a row.', watch: 'The pulling finger brushing the next string.', simplify: 'Quarter notes.' })], ST(
          'A pull-off sounds a lower note without picking: the finger plucks the string as it leaves. With an open string, the lower note is the open string itself.',
          'It is the fastest legato on the guitar: one finger and the open string can play a whole run.',
          ['Pull off downward (toward the floor), not straight up.', 'The open string is a fixed note: it must belong to the key for the run to sound right.'])),
        S('op-hear', 'Hear the pedal', 'ear', 'The open string as a drone.', [
          O_('op-even', 'Listen for an even line: pull–hammer triplets ({key}, {string})', 'external-focus', { fig: 'trip', plan: 'up', beats: 6, goal: 72, start: 40, why: 'An open-string triplet should sound like three picked notes. Listening for an even volume (rather than watching the fingers) fixes a soft pull-off or a late hammer.', instr: HOW + 'Pick, pull off to the open string, hammer the next scale note. Listen: three notes, the same volume and length. Pass: every triplet even.', watch: 'The hammered note coming early.', simplify: 'Pairs instead of triplets.' }),
          O_('op-sing', 'Sing it first: the scale over the open-string drone ({key}, {string})', 'audiation', { fig: 'pair', plan: 'up', beats: 6, goal: 70, start: 40, why: 'The open string is a drone, and each fretted note makes an interval with it. Singing the scale against the drone puts those intervals in the ear before the fingers play them.', instr: 'Let the open string ring and sing each scale note above it; then play the pairs. Pass: you can sing the line and the playing matches it.', watch: 'Playing a fret that isn’t in the scale.', simplify: 'The first four notes.' })], ST(
          'An open string used as a repeating note is a pedal (a drone). Each fretted note forms an interval with it: the sound of the run is those intervals.',
          'Hearing the pedal is what makes these runs melodic instead of mechanical.',
          ['The open e string is E: in E minor it is the root; in A minor the 5th.', 'A run sounds even when every note has the same volume and length.'])),
        S('op-where', 'Where the notes are', 'fretboard', 'The scale on one string, from memory.', [
          O_('op-find', 'From memory: the {scale} up the string above the open note ({key}, {string})', 'retrieval', { fig: 'pair', plan: 'up', beats: 8, goal: 72, start: 40, why: 'Open-string licks need the scale laid out along one string. Finding it from memory (by step: whole or half) is what lets you invent your own runs.', instr: 'Cover the tab. Say each note name as you go up the string from the open note, fret it and pull off. Pass: eight notes up from memory.', watch: 'Using the same fret spacing everywhere: steps are whole or half.', simplify: 'Look once, then cover.' }),
          O_('op-b-string', 'On another string: pull-offs on the B or G string ({key}, {string})', 'variable', { fig: 'trip', plan: 'up', beats: 6, strings: [2, 3, 1], goal: 72, start: 40, why: 'Every open string gives a different pedal note and a different fret pattern. Playing the same figure on another string varies the layout while the motion stays the same.', instr: HOW + 'Play the triplets on the string shown. Mute the strings above it with the side of the picking hand. Pass: every triplet clean.', watch: 'The higher strings ringing.', simplify: 'Pairs.' })], ST(
          'The scale above an open string is a ladder of whole and half steps. Each string’s ladder starts from a different note.',
          'Knowing the ladder by ear and name lets you build licks instead of copying them.',
          ['Natural minor steps: W H W W H W W.', 'In keys like E, A, D and G several open strings are in the scale; in others only one is.'])),
        S('op-first-music', 'First music', 'improv', 'A melody with the band; answers.', [
          O_('op-first-melody', 'First open-string melody with the band ({key}, {string})', 'transfer', { fig: 'trip', plan: 'hold', beats: 8, reps: 2, backing: rockProg, goal: 74, start: 42, why: 'With a backing the pedal becomes part of the harmony: the open string rings against the chords and the fretted notes make a melody over it.', instr: HOW + 'Two times through with the backing. Pass: 16 bars in time.', watch: 'Stopping at the end of each pass.', simplify: 'Pairs.' }),
          O_('op-call', 'Call and response: a picked call, an open-string answer ({key})', 'transfer', { fig: 'pair16', plan: 'down', beats: 4, reps: 3, backing: rockProg, goal: 74, start: 42, why: 'Open-string runs work best as a burst after a picked phrase. Alternating your call with the written answer trains the switch.', instr: 'Bar 1: your own picked phrase. Bar 2: the written run, pull-offs down the string. Pass: three calls and answers in time.', watch: 'The answer starting late.', simplify: 'Answer with pairs.' })], ST(
          'Open-string runs fit a rock or blues backing in the key: the open string is a chord tone or scale tone of the chords.',
          'They are a fill: a fast answer to a riff or a phrase.',
          ['End a run on the root or a chord tone.', 'Rest after a fast run so it stands out.']))
      ], [1, 3]),
    stage('intermediate', 'Runs over the pedal',
      'Pull-off 16ths, double pull-offs and hammer-from-open figures up and down the scale on any open string of the key at 100 BPM, cascades across the open strings, riffs answered by open-string fills, and an 8-bar study.', [
        S('op-sixteenths', '16ths and the climb', 'fretting', 'Four notes a beat.', [
          c => evhOpenPulloffs(c),
          O_('op-climb', 'The 16th-note climb: pull, pull, hammer ({key}, {string})', 'edge', { fig: 'climb', plan: 'up', beats: 8, goal: 104, start: 56, why: 'The climb (pick, pull off, pull off to the open string, hammer back) is a four-note cell that walks up the string: one of the most used open-string figures in rock.', instr: HOW + 'Tempo ladder: +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'The second pull-off losing volume.', simplify: 'Triplets.' })], ST(
          '16th-note figures put four notes in the beat: pick, then three slurred notes. The pick only strikes the first note of each group.',
          'This is where open-string runs get their speed.',
          ['Accent the picked note lightly to keep your place.', 'Each figure walks one scale step up per beat.'])),
        S('op-double', 'Double pull-offs and hammers from open', 'fretting', 'Two pulls in a row; hammering from the pedal.', [
          O_('op-double', 'Double pull-offs down the scale ({key}, {string})', 'variable', { fig: 'double', plan: 'down', beats: 8, goal: 100, start: 54, why: 'A double pull-off (two fretted notes held, pulled off one after the other to the open string) falls through the scale like a waterfall: the classic open-string cascade.', instr: HOW + 'Fret both notes, pick the higher, pull off to the lower, then to the open string. Pass: eight beats clean.', watch: 'Fretting the lower note late.', simplify: 'Single pull-off pairs.' }),
          O_('op-from-open', 'Hammer from the open string ({key}, {string})', 'variable', { fig: 'fromOpen', plan: 'zig', beats: 8, goal: 100, start: 54, why: 'Starting on the open string and hammering up reverses the motion: the open string is picked and the fretted note sounds from the hammer alone.', instr: HOW + 'Pick the open string, hammer the fretted note, pull off back to the open string. The fretted notes zigzag up the scale. Pass: eight beats even.', watch: 'Hammers too soft to sound.', simplify: 'Quarter notes.' })], ST(
          'A double pull-off holds two fretted notes and pulls off twice; hammering from the open string goes the other way.',
          'Together they let a run move up and down without picking.',
          ['Fret both notes before you pick.', 'A hammer must land hard and right behind the fret.'])),
        S('op-cascade', 'Across the open strings', 'fretboard', 'Cascades; mixed strings.', [
          O_('op-cascade', 'Cascade across the open strings of the key ({key})', 'interleaving', { cascade: true, fig: 'trip', plan: 'down', beats: 4, goal: 100, start: 54, why: 'In keys like E, A and D several open strings belong to the scale. Running a figure down one string, then the next, links them into one long cascade.', instr: HOW + 'Four beats on each open string of the key, top string first. Mute each string after you leave it. Pass: the whole cascade without a gap at the string changes.', watch: 'The last string still ringing under the next.', simplify: 'Two strings.' }),
          O_('op-mixed-fig', 'Mixed figures: pull-off 16ths, triplets and the climb in turn ({key}, {string})', 'interleaving', { figs: ['pair16', 'trip', 'climb'], plan: 'up', beats: 9, unit: 'mixed groupings', goal: 96, start: 52, why: 'Changing figure every beat breaks the habit of one rhythm: the hand has to choose the grouping each time, which is harder in practice and sticks better.', instr: HOW + 'Beat by beat: pull-off 16ths, then a triplet, then the climb, one scale step higher each beat. Say the figure aloud before each beat at first. Pass: the whole run in time.', watch: 'All runs at the same speed whatever the figure.', simplify: 'One string.' })], ST(
          'A cascade links runs on several open strings, each one a pedal of the key.',
          'It turns a one-string trick into a fill that covers the neck.',
          ['Only open strings that are in the key can join the cascade.', 'Mute the string you leave with the picking-hand palm.'])),
        S('op-recall', 'From memory', 'fretboard', 'Called notes; the pentatonic version.', [
          O_('op-called', 'From memory: the minor pentatonic over the open string ({key}, {string})', 'retrieval', { scale: 'pent', fig: 'pair16', plan: 'updown', beats: 8, goal: 98, start: 52, why: 'The pentatonic over the pedal has fewer, wider steps: the bluesier sound of open-string riffs. Finding it from memory means knowing which frets to skip.', instr: 'Cover the tab. Name the pentatonic notes up the string, then play the run. Pass: up and down from memory.', watch: 'Playing natural-minor notes by habit.', simplify: 'Up only.' }),
          O_('op-keys', 'Interleaved keys: the run in E, A and D minor shapes ({key} and up)', 'interleaving', { fig: 'trip', plan: 'up', beats: 6, keys: [0, 5, 10], goal: 96, start: 52, why: 'In a new key a different open string becomes the pedal and the ladder changes. Three keys in a row make you rebuild it each time.', instr: HOW + 'The run in three keys a fourth apart. Pass: all three without stopping.', watch: 'The old key’s frets.', simplify: 'Two keys.' })], ST(
          'Each key has its own pedal string and ladder; the pentatonic version skips the scale’s half steps.',
          'Recalling them in any key makes the technique portable.',
          ['Minor pentatonic: R ♭3 4 5 ♭7.', 'In a key where no open string is in the scale, a fretted note held by the index works as the pedal.'])),
        S('op-music', 'In music', 'improv', 'A riff with fills; a study.', [
          O_('op-riff', 'Riff and fill: palm-muted low notes, open-string answers ({key}, {string})', 'transfer', { fig: 'trip', plan: 'up', beats: 8, riff: true, backing: rockProg, goal: 100, start: 54, why: 'Hard-rock rhythm parts often alternate a palm-muted low pedal with open-string licks on the top strings: rhythm and lead in one part.', instr: HOW + 'Odd beats: two palm-muted 8ths on the low string. Even beats: the open-string triplet. Pass: eight bars in time with the muted notes short and the triplets ringing.', watch: 'The palm mute staying on during the fills.', simplify: 'Riff beats only, then fills only.' }),
          c => opStudyI(c)], ST(
          'In music, open-string runs are fills between riff notes or phrases, and they end on the root.',
          'This is how early hard rock uses them: rhythm and lead in one part.',
          ['Lift the palm mute for the fills; put it back for the riff.', 'End on the root with vibrato.']))
      ], [4, 6]),
    stage('advanced', 'Sextuplets and the whole neck',
      'Sextuplet cascades across every open string of the key at 88 BPM, double pull-offs and climbs in four keys, Dorian and blues-scale versions from memory, and riffs with open-string fills at tempo.', [
        S('op-six', 'Sextuplets', 'fretting', 'Six notes a beat.', [
          O_('op-six', 'Sextuplet runs: pull, pull, hammer, hammer, pull ({key}, {string})', 'edge', { fig: 'six', plan: 'up', beats: 8, goal: 88, start: 50, why: 'Six slurred notes a beat with one pick stroke: the dense, rolling sound of fast open-string passages.', instr: HOW + 'Tempo ladder: +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Rushing the hammers.', simplify: 'The climb in 16ths.' }),
          O_('op-six-cascade', 'Sextuplet cascade across every open string of the key ({key})', 'accurate-reps', { cascade: true, fig: 'six', plan: 'down', beats: 2, reps: 2, goal: 86, start: 48, why: 'Sextuplets on each open string in turn: speed, string changes and muting at once.', instr: HOW + 'Two beats per string, top string first, twice. Count only clean passes. Pass: three clean passes in a row.', watch: 'Strings ringing together at the changes.', simplify: 'Triplets.' })], ST(
          'Sextuplets put six notes in a beat; the cell repeats each beat one step up or down the string.',
          'This is the speed of the open-string showcase passages in rock.',
          ['Keep the pick stroke only on the first note of each six.', 'Relax the fretting hand between bursts.'])),
        S('op-colours', 'Other scales', 'fretboard', 'Dorian and blues.', [
          O_('op-dorian', 'A colour scale over the open string: {scale} ({key}, {string})', 'variable', { scale: 'dorian', fig: 'double', plan: 'down', beats: 8, goal: 88, start: 50, why: 'Changing one note of the scale changes the colour of the same run: Dorian (a major 6th) brightens a minor key, Mixolydian (a ♭7) roughens a major one.', instr: HOW + 'Double pull-offs down the {scale}. Listen for the one note that differs from the plain scale. Pass: eight beats clean.', watch: 'Slipping back to the plain scale by habit.', simplify: 'Pairs.' }),
          O_('op-blues', 'From memory: the {scale} ({key}, {string})', 'retrieval', { scale: 'blues', fig: 'climb', plan: 'updown', beats: 8, goal: 88, start: 50, why: 'The blues scale adds one passing note to the pentatonic (the ♭5 in minor, the ♭3 in major): the gritty sound of blues-rock open-string licks. Finding it from memory is knowing exactly where the extra fret sits.', instr: 'Cover the tab. Name the notes of the {scale} up the string, then play the climb up and down. Pass: from memory, in time.', watch: 'Resting on the passing note.', simplify: 'Up only.' })], ST(
          'Any scale can sit over the open-string pedal: Dorian (natural minor with a major 6th) and the blues scale (pentatonic plus ♭5) are the common colours.',
          'Changing the scale changes the mood of the same figures.',
          ['Dorian: R 2 ♭3 4 5 6 ♭7.', 'Blues scale: R ♭3 4 ♭5 5 ♭7; the ♭5 passes, it doesn’t rest.'])),
        S('op-keys-adv', 'Four keys', 'fretboard', 'Climbs and double pull-offs, mixed.', [
          O_('op-four-keys', 'Four keys around the cycle of fourths: double pull-offs ({key} and up)', 'interleaving', { fig: 'double', plan: 'down', beats: 6, keys: [0, 5, 10, 3], goal: 88, start: 50, why: 'Four keys in a row: four different pedals and ladders, rebuilt on the spot.', instr: HOW + 'The run in four keys a fourth apart. Pass: all four without stopping.', watch: 'Hesitating at each key.', simplify: 'Two keys.' }),
          O_('op-zig-pent', 'Zigzag pentatonic climb across two strings ({key})', 'variable', { scale: 'pent', cascade: true, fig: 'climb', plan: 'zig', beats: 4, reps: 2, goal: 88, start: 50, why: 'A zigzag plan (up two, back one) on two open strings varies direction and string together.', instr: HOW + 'Four beats on each open string, twice. Pass: every beat clean.', watch: 'Losing the zigzag order.', simplify: 'One string.' })], ST(
          'Mixing keys and directions keeps the figures flexible.',
          'Songs use these licks in E, A, D and G most of all; the others need a capo pedal.',
          ['A fourth up the cycle: E → A → D → G.', 'The ladder changes with the pedal note.'])),
        S('op-adv-music', 'In music', 'improv', 'Riffs at tempo; a solo.', [
          O_('op-riff-adv', 'Riff and fill at tempo: palm-muted low notes, sextuplet answers ({key})', 'transfer', { fig: 'six', plan: 'down', beats: 8, riff: true, strings: [1, 2], backing: rockProg, goal: 90, start: 52, why: 'The riff-and-fill part at tempo: the palm-muted pedal and the sextuplet fills alternate every beat.', instr: HOW + 'Odd beats: palm-muted 8ths. Even beats: sextuplets. Pass: eight bars in time.', watch: 'The fills dragging the tempo.', simplify: 'Triplet fills.' }),
          c => targetGuide(c, { prog: c.minor ? 'minorRock' : 'mixo', scale: c.minor ? 'minorPent' : 'majorPent', name: 'Solo: end every second phrase with an open-string run down to the root' })], ST(
          'At this level the runs are part of a solo: a phrase climbs, then an open-string run falls back to the root.',
          'The contrast between picked phrases and slurred runs is what makes them exciting.',
          ['Aim the run’s last note at the root.', 'Keep the runs short: one or two beats.']))
      ], [7, 8]),
    stage('mastery', 'Your open-string vocabulary',
      'Sextuplet runs on any open string of the key at 100 BPM in two keys, any called string and figure on the spot, and your own 16-bar riff-and-fill piece.', [
        S('op-perf', 'At performance tempo', 'fretting', 'Speed and random access.', [
          O_('op-perf', 'Performance tempo: sextuplet cascades in two keys ({key})', 'edge', { cascade: true, fig: 'six', plan: 'down', beats: 2, keys: [0, 7], goal: 100, start: 56, why: 'Sextuplet cascades in two keys: speed, muting and string changes at performance tempo.', instr: HOW + 'Tempo ladder: +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Tension in the fretting hand.', simplify: 'One key.' }),
          c => opRandom(c)], ST(
          'Mastery is speed with control and figures you can call up in any order.',
          'Random order makes the figures last.',
          ['Raise the tempo only after a clean pass.', 'Read the name, not the tab.'])),
        S('op-recall-m', 'From memory', 'fretboard', 'Six keys; improvising.', [
          O_('op-six-keys', 'From memory: the climb in six keys', 'retrieval', { fig: 'climb', plan: 'up', beats: 6, keys: [0, 5, 10, 3, 8, 1], goal: 96, start: 54, why: 'Six keys from memory: each needs its pedal and ladder found on the spot, including keys with a capo pedal.', instr: 'Cover the tab. For each key, name the pedal string and the first three scale notes above it, then play the climb. Pass: all six keys in time.', watch: 'A long pause at each key.', simplify: 'Three keys.' }),
          c => targetGuide(c, { prog: c.minor ? 'minorRock' : 'mixo', scale: c.minor ? 'minorPent' : 'majorPent', name: 'Improvise: two choruses mixing picked phrases and open-string runs' })], ST(
          'Recall in six keys shows the model is learned: pedal, ladder, figure.',
          'Improvising with it means choosing when a run adds something.',
          ['Name the pedal before you play.', 'Use open-string runs as punctuation, not as the whole solo.'])),
        S('op-voice', 'Your own piece', 'improv', 'A capstone study, then your version.', [c => opEtude(c),
          O_('op-own', 'Make it yours: riff, then your own open-string fill ({key})', 'transfer', { fig: 'six', plan: 'zig', beats: 8, riff: true, reps: 2, backing: rockProg, goal: 96, start: 54, minutes: 6, why: 'The tab gives the riff and one possible fill; the lesson is to replace the fills with your own, using any figure and string you know.', instr: 'Keep the palm-muted riff beats as written; on the fill beats play your own open-string figures. Pass: two times through in time, your fills different each time.', watch: 'Your fills copying the written ones.', simplify: 'Triplet fills.' })], ST(
          'The capstone combines riff and every figure in one piece; then you rewrite it.',
          'A technique becomes yours when you compose with it.',
          ['Learn the study four bars at a time.', 'Keep the riff, change the fills.']))
      ], [9, 10])
  ]
});
