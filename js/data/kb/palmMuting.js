// Palm muting and palm-muted riffs: the side of the picking hand rests on the strings at the bridge so
// notes thud with a short, percussive pitch, then lifts for the accents that ring. The engine of hard
// rock and metal rhythm guitar (Van Halen, AC/DC, Metallica) and of countless pop-punk and indie parts.
// From the first muted root on the low string, through 8ths, gallops and 16ths, accents and pushes,
// palm-muted single-note riffs, the pedal-tone rhythm style (a muted low root under short ringing
// triads), palm-muted arpeggios and syncopated stops, to performance tempo, random access and an
// original riff study.
//
// Concept-first (CONTENT.md): the model is a RIFF as a 16-slot grid per bar. Each slot event is a
// KIND: a palm-muted chug on the low root (C), an unmuted ACCENT (A: a power chord, or in pedal style a
// triad on the top strings), a fretting-hand SCRATCH (x: dead strings), or a rest. Rhythm PATTERNS are
// lists of [slot, length, kind]: quarters, 8ths, gallop (8th + two 16ths), reverse gallop, 16ths, the
// push (an accent on the "and" of 4), the 3+3+2 syncopation, stops. Harmony comes from a progression of
// key degrees; each bar's chug is that chord's root on the low E or A string, its accent the power chord
// (root and 5th, with the octave at higher levels) placed near the last one, so every note is the chord's
// root or 5th (or a triad tone in pedal style) in every key by construction. Single-note riffs and
// arpeggios use the same grid with the key's minor pentatonic or the bar's chord tones. The composer
// `pmRun(c, spec)` builds an exercise from style (chug | pedal | single | arp) × pattern plan × progression
// × key plan × octave.
import { OPEN, N, nameOf, make, mod12, chordInfo, topTriad, S, stage, entry, targetGuide } from '../lib.js';
import { rng } from './bending.js';

/* ------------------------------- The concept ------------------------------- */
const pitch = (s, f) => OPEN[s] + f;
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
/** Rhythm patterns: [slot (16ths), length (16ths), kind]: C chug (muted), A accent (rings), x scratch. */
export const PATTERNS = {
  quarters: { name: 'quarter notes', unit: 'quarter notes', ev: [[0, 4, 'C'], [4, 4, 'C'], [8, 4, 'C'], [12, 4, 'C']] },
  eighths: { name: '8th notes', unit: '8th notes', ev: [0, 2, 4, 6, 8, 10, 12, 14].map(s => [s, 2, 'C']) },
  accent1: { name: '8ths with an accent on 1', unit: '8th notes', ev: [[0, 2, 'A'], ...[2, 4, 6, 8, 10, 12, 14].map(s => [s, 2, 'C'])] },
  accent13: { name: '8ths with accents on 1 and 3', unit: '8th notes', ev: [[0, 2, 'A'], [2, 2, 'C'], [4, 2, 'C'], [6, 2, 'C'], [8, 2, 'A'], [10, 2, 'C'], [12, 2, 'C'], [14, 2, 'C']] },
  gallop: { name: 'gallops (8th + two 16ths)', unit: '8th + two 16ths', ev: [0, 4, 8, 12].flatMap(b => [[b, 2, 'C'], [b + 2, 1, 'C'], [b + 3, 1, 'C']]) },
  revGallop: { name: 'reverse gallops (two 16ths + 8th)', unit: 'two 16ths + 8th', ev: [0, 4, 8, 12].flatMap(b => [[b, 1, 'C'], [b + 1, 1, 'C'], [b + 2, 2, 'C']]) },
  gallopAcc: { name: 'gallops with an accent on 1', unit: '8th + two 16ths', ev: [[0, 2, 'A'], [2, 1, 'C'], [3, 1, 'C'], ...[4, 8, 12].flatMap(b => [[b, 2, 'C'], [b + 2, 1, 'C'], [b + 3, 1, 'C']])] },
  sixteenths: { name: '16th notes', unit: '16th notes', ev: Array.from({ length: 16 }, (_, i) => [i, 1, 'C']) },
  sixteenthsAcc: { name: '16ths with accents on 1 and the "and" of 2', unit: '16th notes', ev: Array.from({ length: 16 }, (_, i) => [i, 1, i === 0 || i === 6 ? 'A' : 'C']) },
  push: { name: 'the push (the next chord an 8th early)', unit: '8th notes', next: true, ev: [[0, 2, 'C'], [2, 2, 'C'], [4, 2, 'C'], [6, 2, 'C'], [8, 2, 'C'], [10, 2, 'C'], [12, 2, 'C'], [14, 2, 'A']] },
  synco: { name: '3+3+2 syncopation', unit: 'syncopated 8ths', ev: [[0, 3, 'A'], [3, 3, 'A'], [6, 2, 'A'], [8, 2, 'C'], [10, 2, 'C'], [12, 2, 'A'], [14, 2, 'C']] },
  stops: { name: 'stops with scratches', unit: 'syncopated 16ths', ev: [[0, 2, 'A'], [2, 1, 'x'], [3, 1, 'x'], [4, 2, 'C'], [6, 2, 'C'], [8, 2, 'A'], [10, 1, 'x'], [11, 1, 'x'], [12, 1, 'C'], [13, 1, 'C'], [14, 2, 'A']] },
  pedal8: { name: 'pedal 8ths with triad stabs', unit: '8th notes', ev: [[0, 2, 'C'], [2, 2, 'A'], [4, 2, 'C'], [6, 2, 'C'], [8, 2, 'C'], [10, 2, 'A'], [12, 2, 'C'], [14, 2, 'A']] },
  pedal16: { name: 'pedal 16ths with triad stabs', unit: '16th notes', ev: Array.from({ length: 16 }, (_, i) => [i, 1, [3, 6, 11, 14].includes(i) ? 'A' : 'C']) }
};
/** Progressions as [semitones above the key root, quality]: power-chord rock in minor and major keys. */
export const PROGS = {
  minor: [[0, 'm'], [8, ''], [10, ''], [0, 'm']],   // i – ♭VI – ♭VII – i (E5 C5 D5 E5)
  minor2: [[0, 'm'], [10, ''], [8, ''], [10, '']],  // i – ♭VII – ♭VI – ♭VII
  minor3: [[0, 'm'], [3, ''], [5, 'm'], [7, 'm']],  // i – ♭III – iv – v
  major: [[0, ''], [10, ''], [5, ''], [0, '']],     // I – ♭VII – IV – I (Mixolydian rock)
  major2: [[0, ''], [5, ''], [7, ''], [5, '']],     // I – IV – V – IV
  one: [[0, 'm'], [0, 'm'], [0, 'm'], [0, 'm']]
};
const progFor = (c, id) => (id === 'one' ? (c.minor ? PROGS.one : PROGS.one.map(([o]) => [o, ''])) : PROGS[id === 'auto2' ? (c.minor ? 'minor2' : 'major2') : id === 'auto3' ? (c.minor ? 'minor3' : 'major2') : c.minor ? 'minor' : 'major']);
const PENT = k => [0, 3, 5, 7, 10].map(x => mod12(k + x));
/** The chord root on the low strings: the low E string (frets 0–9), else the A string (0–7). */
export function lowRoot(pc, near = 3) {
  const opts = [];
  for (const s of [6, 5]) for (let f = 0; f <= 12; f++) if (mod12(pitch(s, f)) === mod12(pc)) opts.push({ s, f, d: Math.abs(f - near) + (s === 5 ? 0.5 : 0) });
  return opts.filter(o => o.f <= 10).sort((a, b) => a.d - b.d)[0];
}
/** A power chord on a root: root, 5th (next string, two frets up; or open 5th), and the octave at higher levels. */
function power(r, oct) {
  const n = [[r.s, r.f], [r.s - 1, r.f + 2]];
  if (oct) n.push([r.s - 2, r.f + 2]);
  return n;
}
const SN = ['', 'e', 'B', 'G', 'D', 'A', 'E'];

/* ------------------------------- The composer ------------------------------- */
/**
 * One palm-muting exercise from a spec: { id, name ('{chords}', '{key}', '{pattern}'), method, style ('chug' | 'pedal' |
 * 'single' | 'arp'), patterns (one per bar, cycling), prog ('auto' | 'auto2' | 'auto3' | 'one'), keys (offsets), reps,
 * oct (octave in power chords; default from level 5), teach (open vs muted first), riff (single: degrees per slot),
 * domain, unit, goal, start, dl, why, instr, watch, simplify }.
 */
export function pmRun(c, spec) {
  const lvl = c.lvl || 5, notes = [], used = []; let t = 0, bar = 0, near = 3;
  const pats = (spec.patterns || ['eighths']).map(p => PATTERNS[p]), style = spec.style || 'chug';
  const oct = spec.oct != null ? spec.oct : lvl >= 5;
  for (const off of spec.keys || [0]) {
    const k = mod12(c.key + off), prog = progFor(c, spec.prog || 'auto'), pentK = c.minor ? k : mod12(k - 3);
    if (spec.teach) {
      // open vs muted: 4 open quarter notes on the root, 4 muted, then 8 muted 8ths
      const r = lowRoot(k, near), pcs = [k];
      for (let i = 0; i < 4; i++) notes.push(tag(N(r.s, r.f, t + i, 1, null, { pick: 'd' }), pcs));
      for (let i = 0; i < 4; i++) notes.push(tag(N(r.s, r.f, t + 4 + i, 1, 'pm', { pick: 'd' }), pcs));
      for (let i = 0; i < 8; i++) notes.push(tag(N(r.s, r.f, t + 8 + i * 0.5, 0.5, 'pm'), pcs));
      t += 12; used.push(nameOf(k) + '5');
    }
    for (let rep = 0; rep < (spec.reps || 1); rep++) for (const [pi, [o, q]] of prog.entries()) {
      const P = pats[bar % pats.length], root = mod12(k + o), R = lowRoot(root, near), chName = nameOf(root) + q;
      const ch = chordInfo(chName); if (!R || !ch) return null;
      const pw = [root, mod12(root + 7)];
      const keyRoot = lowRoot(k, 3);
      for (const [sl, len, kind] of P.ev) {
        const T = t + sl / 4, D = len / 4;
        if (style === 'single') {
          // single-note riff: the slots walk a degree plan through the minor pentatonic on the low strings
          const degs = spec.riff || [0, 0, 3, 0, 5, 0, 7, 10], ps = PENT(pentK);
          const d = degs[(sl + bar * 3) % degs.length], target = mod12(pentK + d);
          let best = null; for (const s of [6, 5, 4]) for (let f = Math.max(0, R.f - 3); f <= R.f + 5; f++) if (mod12(pitch(s, f)) === target && (!best || Math.abs(f - R.f) + (s === 4 ? 3 : 0) < Math.abs(best.f - R.f) + (best.s === 4 ? 3 : 0))) best = { s, f };
          if (!best) return null;
          notes.push(tag(N(best.s, best.f, T, D, kind === 'A' ? null : 'pm'), ps));
          continue;
        }
        if (kind === 'C') {
          const cr = style === 'pedal' ? keyRoot : R;   // pedal style: the key's root stays under every chord
          notes.push(tag(N(cr.s, cr.f, T, D, 'pm'), style === 'pedal' ? [k, ...ch.pcs] : pw));
        } else if (kind === 'x') {
          [R.s, R.s - 1].forEach(s => notes.push(tag(N(s, R.f, T, D, 'mute', { chord: true }), null)));
        } else if (style === 'pedal') {
          const tr = topTriad(chName, Math.max(3, keyRoot.f + 4)); if (!tr) return null;
          [3, 2, 1].forEach(s => notes.push(tag(N(s, tr[s], T, D, null, { chord: true }), ch.pcs)));
        } else if (style === 'arp') {
          // palm-muted arpeggio: the chord's tones up the strings above the root, one per slot
          const tones = arpTones(ch.pcs, R), i = Math.round(sl / len) % tones.length;
          notes.push(tag(N(tones[i][0], tones[i][1], T, D, 'pm'), ch.pcs));
        } else if (P.next && sl === 14) {
          // the push: the next chord, an 8th early
          const nr = mod12(k + prog[(pi + 1) % prog.length][0]), NR = lowRoot(nr, R.f);
          power(NR, oct).forEach(([s, f]) => notes.push(tag(N(s, f, T, D, null, { chord: true }), [nr, mod12(nr + 7)])));
        } else {
          power(R, oct).forEach(([s, f]) => notes.push(tag(N(s, f, T, D, null, { chord: true }), pw)));
        }
      }
      if (style === 'arp' && P.ev.every(e => e[2] === 'C')) {
        // a plain arpeggio pattern: rewrite the bar's chugs as the arpeggio, low to high and back
        const tones = arpTones(ch.pcs, R), order = [...tones, ...tones.slice(1, -1).reverse()];
        const barNotes = notes.filter(n => n.t >= t && n.t < t + 4);
        barNotes.forEach((n, i) => { const [s, f] = order[i % order.length]; n.s = s; n.f = f; ALLOW.set(n, ch.pcs); });
      }
      near = R.f; t += 4; bar++; used.push(style === 'pedal' ? chName : style === 'arp' ? chName : nameOf(root) + '5');
    }
  }
  if (notes.length < 6 || notes.length > 400) return null;
  const uniq = [...new Set(used)];
  const fill = x => String(x).replace(/\{chords\}/g, uniq.join(' – ')).replace(/\{key\}/g, `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`).replace(/\{pattern\}/g, pats.map(p => p.name).join(', '));
  const backing = spec.keys ? null : used.slice(spec.teach ? 1 : 0);
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'rhythm', method: spec.method, unit: spec.unit || pats[0].unit,
    goal: spec.goal || 120, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: spec.picking || (pats[0].unit.includes('16th') ? 'alternate' : 'down'),
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify,
    ...(backing && backing.length ? { backing, chords: [...new Set(backing)] } : {}), tab: { notes }
  });
}
/** Chord tones up the strings from a low root, within the root's hand position: [[s, f], …] low to high. */
function arpTones(pcs, R) {
  const out = [[R.s, R.f]];
  for (let s = R.s - 1; s >= Math.max(2, R.s - 3); s--) { for (let f = Math.max(0, R.f - 1); f <= R.f + 3; f++) if (pcs.includes(mod12(pitch(s, f)))) { out.push([s, f]); break; } }
  return out;
}
const P_ = (id, name, method, opts) => c => pmRun(c, { id, name, method, ...opts });

/* ------------------------------ Music ------------------------------ */
/** Random access: a random pattern and chord of the key every bar (interleaving). */
export function pmRandom(c) {
  const r = rng(611 + (c.lvl || 9)), k = mod12(c.key), notes = [], names = [];
  const pool = c.minor ? [[0, 'm'], [3, ''], [5, 'm'], [7, 'm'], [8, ''], [10, '']] : [[0, ''], [5, ''], [7, ''], [10, ''], [9, 'm'], [2, 'm']];
  const pats = ['gallop', 'revGallop', 'sixteenthsAcc', 'synco', 'stops', 'push'];
  let near = 3;
  for (let bar = 0; bar < 8; bar++) {
    const [o, q] = pool[Math.floor(r() * pool.length)], pn = pats[Math.floor(r() * pats.length)], root = mod12(k + o), R = lowRoot(root, near), pw = [root, mod12(root + 7)];
    for (const [sl, len, kind] of PATTERNS[pn].ev) {
      const T = bar * 4 + sl / 4, D = len / 4;
      if (kind === 'C') notes.push(tag(N(R.s, R.f, T, D, 'pm'), pw));
      else if (kind === 'x') [R.s, R.s - 1].forEach(s => notes.push(tag(N(s, R.f, T, D, 'mute', { chord: true }), null)));
      else power(R, true).forEach(([s, f]) => notes.push(tag(N(s, f, T, D, null, { chord: true }), pw)));
    }
    names.push(`${nameOf(root)}5, ${PATTERNS[pn].name}`); near = R.f;
  }
  return make(c, {
    id: 'pm-random', name: `Random access: a new chord and rhythm every bar (${nameOf(k)} ${c.minor ? 'minor' : 'major'})`, domain: 'rhythm', method: 'interleaving', unit: 'mixed rhythms', goal: 132, start: 76, minutes: 5, dl: 1, picking: 'alternate', tab: { notes },
    why: 'At mastery level the muting hand reacts to whatever the riff asks: a random chord and rhythm every bar makes the mute and the lift automatic.',
    instr: `${names.join(' → ')}. Read only the names: find the root, play the rhythm, lift the palm for the accents. Pass: all 8 bars in time from the names alone.`,
    watch: 'The palm staying down on the accents.', simplify: 'The first four bars.'
  });
}
/** An original riff study: chugs, gallops, a push, pedal-tone stabs and stops (8 bars; 16 for the capstone). */
function pmStudy(c, capstone) {
  const plan = capstone
    ? [['chug', 'accent1'], ['chug', 'gallop'], ['chug', 'push'], ['chug', 'stops'], ['pedal', 'pedal8'], ['pedal', 'pedal8'], ['chug', 'synco'], ['chug', 'push'], ['single', 'eighths'], ['single', 'gallop'], ['chug', 'sixteenthsAcc'], ['chug', 'stops'], ['pedal', 'pedal16'], ['arp', 'eighths'], ['chug', 'gallopAcc'], ['chug', 'synco']]
    : [['chug', 'accent1'], ['chug', 'gallop'], ['chug', 'push'], ['chug', 'stops'], ['pedal', 'pedal8'], ['pedal', 'pedal8'], ['single', 'eighths'], ['chug', 'synco']];
  const parts = []; const prog = progFor(c, 'auto');
  plan.forEach(([style, pat], i) => {
    const [o, q] = prog[i % prog.length];
    const x = pmRun({ ...c, key: mod12(c.key + o), minor: q === 'm' ? true : q === '' && c.minor ? false : c.minor }, { id: 'x', name: 'x', style, patterns: [pat], prog: 'one', why: '-', instr: '-', watch: '-', simplify: '-' });
    parts.push(x ? x.tab.notes.map(n => ({ n, t: n.t + i * 4 })) : null);
  });
  if (parts.some(p => !p)) return null;
  const notes = parts.flat().filter(({ n }) => n.t < 4).map(({ n, t }) => { const m = { ...n, t: +t.toFixed(4) }; ALLOW.set(m, ALLOW.get(n)); return m; });
  const chords = plan.map((_, i) => { const [o, q] = prog[i % prog.length]; return nameOf(c.key + o) + (q === 'm' ? 'm' : ''); });
  return make(c, {
    id: capstone ? 'pm-capstone-etude' : 'pm-study-8', name: capstone ? `Capstone study: a 16-bar palm-muted riff (${nameOf(c.key)} ${c.minor ? 'minor' : 'major'})` : `Study: an 8-bar palm-muted riff (${nameOf(c.key)} ${c.minor ? 'minor' : 'major'})`,
    domain: 'rhythm', method: 'transfer', unit: 'mixed rhythms', goal: capstone ? 132 : 112, start: capstone ? 76 : 64, minutes: capstone ? 8 : 6, dl: capstone ? 1 : 0, picking: 'alternate',
    backing: chords, chords: [...new Set(chords)], tab: { notes },
    why: capstone ? 'An original 16-bar riff that uses the whole path: accents, gallops, the push, stops with scratches, pedal-tone triad stabs, a palm-muted single-note line, 16ths and an arpeggio bar.' : 'An original 8-bar hard-rock riff: an accent and chugs, a gallop bar, the push, a stop, two bars of pedal-tone triad stabs, a muted single-note bar and a syncopated ending.',
    instr: capstone ? 'Learn it four bars at a time; say each bar’s rhythm name before you play it. Then write your own 16 bars on the same chords. Pass: the study at the goal tempo with the muted notes even and the accents ringing, then your own version once.' : 'Learn it two bars at a time, then as one riff with the backing. Pass: two times through at the goal tempo with every accent ringing and every chug the same thud.',
    watch: 'Chugs getting louder (or the mute lifting) as the riff speeds up.', simplify: capstone ? 'Bars 1–8.' : 'Bars 1–4.'
  });
}
export const pmStudyI = c => pmStudy(c, false);
export const pmEtude = c => pmStudy(c, true);

/* --------------------------------- The path --------------------------------- */
const HOW = 'Rest the fleshy edge of the picking hand on the strings right where they leave the bridge saddles: lightly, so the note still has pitch but thuds instead of ringing. Pick from the wrist with the hand anchored there; lift the edge of the hand a few millimetres for the accents (no PM), and put it straight back. ';
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'palmMuting', kind: 'technique', title: 'Palm muting and palm-muted riffs', domain: 'rhythm',
  re: /palm.?mut(e|es|ed|ing)|\bchug(s|ging)?\b|\bpm\b riffs?/,
  aliases: ['palm muting', 'palm-muted riffs', 'chugging', 'chugs'],
  summary: 'The picking hand rests on the strings at the bridge so notes thud, then lifts for accents that ring: from the first muted root, through 8ths, gallops and 16ths, accents and pushes, single-note riffs, the pedal-tone rhythm style and palm-muted arpeggios, to syncopated stops at tempo, random access and an original riff study.',
  prereqs: [],
  sources: ['https://fretjam.com/palm-mute-guitar.html', 'https://guitarlessons.com/guitar-lessons/guitar-technique/how-to-palm-mute-guitar/', 'https://pmtonline.co.uk/pmt-college/how-to-palm-mute', 'https://guitarworld.com/lessons/6-guitar-tricks-you-can-learn-from-eddie-van-halen'],
  ctx: { key: 4, minor: true, prog: 'powerMinor' },
  stages: [
    stage('foundations', 'The muted chug',
      'Palm-muted 8th notes on the low root with downstrokes at 90 BPM, every note the same short thud, with an unmuted power chord on beat 1 of each bar over i–♭VI–♭VII–i; name the progression’s roots from memory.', [
        S('pm-touch', 'Find the mute', 'picking', 'Open, then muted; quarters, then 8ths.', [
          P_('pm-teach', 'Open, then muted: the root ringing, then thudding ({key})', 'chunking', { teach: true, prog: 'one', patterns: ['quarters'], reps: 1, goal: 84, start: 50, why: 'Palm muting is a matter of where and how hard the hand rests. Playing the same note open, then muted, then muted in 8ths, builds the touch in steps and lets you hear the difference.', instr: HOW + 'Bar 1: the root open with downstrokes. Bar 2: the same with the palm resting at the bridge. Bar 3: muted 8ths. Then the muted quarter notes. Pass: every muted note has pitch but stops short.', watch: 'Resting too far from the bridge: the note goes dead with no pitch.', simplify: 'Bars 1 and 2 only.' }),
          P_('pm-eighths', 'Downstroke 8ths, counting the even ones ({chords})', 'accurate-reps', { patterns: ['eighths'], prog: 'auto', picking: 'down', goal: 92, start: 54, why: 'Steady muted downstroke 8ths are the core of rock rhythm. Counting only bars where every note is the same volume and length trains an even mute.', instr: HOW + 'All downstrokes. One chord a bar: move the root, keep the palm where it is. Count a bar only if every chug is even. Pass: 8 even bars in a row.', watch: 'The palm sliding off the strings when the root moves to the A string.', simplify: 'Quarter notes.' })], ST(
          'Palm muting damps the strings with the edge of the picking hand where they leave the bridge. The note keeps its pitch but loses its ring: a short, percussive thud.',
          'It is the sound of almost all rock and metal rhythm guitar: the muted notes give drive, the unmuted ones punch out.',
          ['The closer to the bridge, the more pitch; the further toward the neck, the more muted.', 'Downstrokes give a heavier, more even chug than alternate picking at moderate tempos.'])),
        S('pm-hear', 'Hear the mute', 'ear', 'Thud versus ring; the rhythm first.', [
          P_('pm-depth', 'Listen for the thud: 8ths with one accent a bar ({chords})', 'external-focus', { patterns: ['accent1'], prog: 'auto', oct: false, goal: 92, start: 54, why: 'The ear is the best judge of the mute: a good chug thuds with a clear pitch; a good accent rings. Listening for that difference (rather than watching the hand) fixes both.', instr: HOW + 'Beat 1: lift the palm and let the power chord ring. The other 8ths: muted. Listen to each bar: are the chugs short with pitch, and the accent full? Pass: every bar heard as thud, thud … ring.', watch: 'The accent still muted because the palm didn’t lift.', simplify: 'Only the first two chords.' }),
          P_('pm-sing', 'Hear it first: count the rhythm aloud, then play it ({chords})', 'audiation', { patterns: ['accent13'], prog: 'auto', oct: false, goal: 90, start: 52, why: 'A riff is its rhythm. Saying it aloud first ("DUN chug chug chug DUN chug chug chug") puts the accents in your head before the hand plays them.', instr: 'Speak the rhythm with the click: "DUN" on the accents (beats 1 and 3), "chug" on the muted 8ths. Then play it. Pass: the played rhythm matches the spoken one for 8 bars.', watch: 'Accents drifting off beats 1 and 3.', simplify: 'Accent on 1 only.' })], ST(
          'Muted and open notes are two sounds with one hand: down for the chug, lifted for the accent. A riff is the pattern between them.',
          'Hearing that pattern is what makes a riff groove.',
          ['A muted note still has pitch: if it doesn’t, the hand is too far from the bridge.', 'Speak a rhythm before you play it: the hands follow the voice.'])),
        S('pm-switch', 'Mute, lift, move', 'fretboard', 'Accents and roots from memory.', [
          P_('pm-accent', 'A new accent spot every bar: 8ths with accents on 1, then on 1 and 3 ({chords})', 'variable', { patterns: ['accent1', 'accent13'], prog: 'auto2', oct: false, goal: 92, start: 54, why: 'Changing where the accent falls varies the one move that matters most (lift and drop the palm) while the rest stays the same.', instr: HOW + 'Odd bars: one accent on beat 1. Even bars: accents on 1 and 3. Pass: 8 bars with every accent ringing.', watch: 'Lifting the palm too far and losing the anchor.', simplify: 'Accent on 1 in every bar.' }),
          P_('pm-roots', 'From memory: the progression’s roots on the low strings ({chords})', 'retrieval', { patterns: ['eighths'], prog: 'auto', goal: 90, start: 52, why: 'Riffs move between roots on the low E and A strings. Finding each root from the chord name builds the low-string map every riff relies on.', instr: 'Cover the tab. Say each chord’s root, find it on the low E or A string near the last one, and chug a bar. Pass: all four from memory.', watch: 'Jumping up the neck when a lower root is near.', simplify: 'Look once, then cover.' })], ST(
          'Riffs are built from chord roots on the two lowest strings, chugged with the palm, plus accents where the palm lifts.',
          'Knowing the roots by name lets you play any riff in any key.',
          ['The same note sits five frets lower on the A string than on the low E string.', 'A power chord is root + 5th: the same fret shape on any root.'])),
        S('pm-first-music', 'First music', 'rhythm', 'A first riff with the band; call and response.', [
          P_('pm-first-riff', 'First riff with the band: 8ths with accents ({chords})', 'transfer', { patterns: ['accent1', 'eighths', 'accent13', 'eighths'], prog: 'auto', reps: 2, oct: false, goal: 94, start: 56, why: 'With a drum backing the chugs lock to the hi-hat and the accents to the snare and kick: the rhythm guitar becomes part of the band.', instr: HOW + 'Two times through with the backing. Pass: 8 bars locked to the drums.', watch: 'Rushing the accent bars.', simplify: 'Muted 8ths throughout.' }),
          P_('pm-call', 'Call and response: muted bar, accented bar ({chords})', 'transfer', { patterns: ['eighths', 'accent13'], prog: 'auto2', reps: 2, oct: false, goal: 94, start: 56, why: 'Alternating a fully muted bar with an accented bar is how many riffs build tension and release.', instr: HOW + 'Odd bars all muted (tension), even bars with accents (release). Pass: 8 bars in time.', watch: 'Accents creeping into the muted bars.', simplify: 'Slower tempo.' })], ST(
          'A rhythm part locks to the drums: chugs with the hi-hat 8ths, accents with the kick and snare.',
          'That lock is what makes a band sound tight.',
          ['Listen to the drums more than to yourself.', 'Tension (all muted) and release (accents) shape a riff.']))
      ], [1, 3]),
    stage('intermediate', 'Gallops, 16ths and the pedal tone',
      'Gallops and reverse gallops at 110 BPM, palm-muted 16ths with alternate picking, palm-muted single-note riffs in the minor pentatonic, the pedal-tone style (a muted low root under ringing triads) and the push, and an 8-bar riff study with the backing.', [
        S('pm-gallop', 'Gallops', 'picking', 'Long-short-short and short-short-long.', [
          P_('pm-gallop', 'Gallops: an 8th and two 16ths ({chords})', 'accurate-reps', { patterns: ['gallop'], prog: 'auto', picking: 'alternate', goal: 110, start: 62, why: 'The gallop (one 8th, two 16ths) is the driving rhythm of hard rock and metal. Counting only even gallops keeps the two 16ths from blurring.', instr: HOW + 'Pick down, down-up (or all downstrokes at slower tempos), counting "1-e-and-a" with the notes on 1, and, a. Count only clean bars. Pass: 8 clean bars in a row.', watch: 'The two 16ths rushing into the next beat.', simplify: '8ths.' }),
          P_('pm-rev-gallop', 'Reverse gallops: two 16ths and an 8th ({chords})', 'variable', { patterns: ['revGallop', 'gallop'], prog: 'auto2', picking: 'alternate', goal: 108, start: 60, why: 'Reversing the gallop puts the two short notes first. Alternating both kinds bar by bar varies the rhythm so neither becomes a habit.', instr: HOW + 'Odd bars: reverse gallops (1-e-and). Even bars: gallops (1-and-a). Pass: 8 bars without mixing them up.', watch: 'Playing gallops in the reverse bars.', simplify: 'One kind only.' })], ST(
          'A gallop is an 8th followed by two 16ths; a reverse gallop is two 16ths followed by an 8th. Both repeat every beat.',
          'They give riffs a forward, horse-like drive.',
          ['Gallop counted 1 (e) and a; reverse gallop 1 e and (a).', 'Keep the palm still: only the picking motion changes.'])),
        S('pm-sixteenths', '16ths', 'picking', 'Steady alternate-picked 16ths.', [
          P_('pm-16', 'Palm-muted 16ths with alternate picking ({chords})', 'edge', { patterns: ['sixteenths'], prog: 'auto', picking: 'alternate', goal: 104, start: 58, why: 'Steady muted 16ths need small, even alternate-picking motions from the wrist while the palm stays anchored.', instr: HOW + 'Down-up from the wrist. Tempo ladder: +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Upstrokes quieter than downstrokes.', simplify: '8ths at double the tempo.' }),
          P_('pm-16-acc', '16ths with accents on 1 and the "and" of 2 ({chords})', 'external-focus', { patterns: ['sixteenthsAcc'], prog: 'auto', picking: 'alternate', goal: 102, start: 58, why: 'Accents inside a 16th stream give the riff a shape. Listening for two clear accents per bar over even chugs trains the lift without breaking the stream.', instr: HOW + 'Keep the 16ths going; on 1 and the "and" of 2 lift the palm and let the power chord ring for one 16th. Listen: two rings, the rest thuds. Pass: 8 bars with both accents clear.', watch: 'The picking hand stopping at the accents.', simplify: 'One accent on 1.' })], ST(
          '16th notes are four even notes a beat, alternate picked. Accents inside them are lifts of the palm, not harder picking.',
          'This is the rhythm of fast metal and punk.',
          ['Down on the beat and the "and", up on "e" and "a".', 'Accents come from lifting the mute, not from picking harder.'])),
        S('pm-single', 'Single-note riffs', 'fretboard', 'Muted lines on the low strings.', [
          P_('pm-single', 'A palm-muted single-note riff: the minor pentatonic on the low strings ({key})', 'variable', { style: 'single', patterns: ['eighths', 'gallop'], prog: 'auto', riff: [0, 0, 3, 0, 5, 0, 7, 3, 0, 10, 0, 5], goal: 104, start: 58, why: 'Many riffs are single notes, not chords: a muted root pedal with scale notes in between. Different degrees in each bar vary the line while the mute stays even.', instr: HOW + 'Muted 8ths (odd bars) and gallops (even bars), the notes walking between the root and the pentatonic notes around it on the low E and A strings. Pass: 8 bars, every note muted and even.', watch: 'Higher notes ringing louder than the root.', simplify: '8ths only.' }),
          P_('pm-single-recall', 'From memory: the pentatonic riff notes on the E and A strings ({key})', 'retrieval', { style: 'single', patterns: ['eighths'], prog: 'one', riff: [0, 3, 5, 7, 10, 7, 5, 3], goal: 100, start: 56, why: 'The low pentatonic notes (R ♭3 4 5 ♭7) are the raw material of riffs. Finding them from memory near the root lets you make up riffs on the spot.', instr: 'Cover the tab. Say each degree, find it on the low E or A string near the root, play it muted. Pass: up and down from memory.', watch: 'Shifting position for notes that are under your fingers.', simplify: 'Root, ♭3, 4 only.' })], ST(
          'A single-note riff mixes a muted low root with other scale notes; the minor pentatonic near the root is the usual source.',
          'Riffs like this carry whole songs in hard rock and metal.',
          ['Minor pentatonic degrees: R ♭3 4 5 ♭7.', 'The root works as a pedal between the other notes.'])),
        S('pm-pedal', 'The pedal-tone style', 'rhythm', 'Muted low root, ringing triads; the push.', [
          P_('pm-pedal', 'Pedal-tone rhythm: muted low root under ringing triads ({chords})', 'variable', { style: 'pedal', patterns: ['pedal8'], prog: 'auto', goal: 104, start: 58, why: 'Eddie Van Halen often kept a muted low root chugging while short three-note chords rang on the top strings: rhythm and lead in one part. The triads change while the root stays (a pedal).', instr: HOW + 'Muted 8ths on the key’s low root; on the stabs, lift the palm and strike only the top three strings. The low root never moves. Pass: 8 bars with the triads ringing and the root muted.', watch: 'Hitting the middle strings on the stabs.', simplify: 'Stabs on beat 2 only.' }),
          P_('pm-push', 'The push: an accent on the "and" of 4, tied over the bar line ({chords})', 'external-focus', { patterns: ['push'], prog: 'auto2', goal: 104, start: 58, why: 'Anticipating the next chord by an 8th (the push) is one of the most common rock rhythm moves. The accent must ring through the bar line, which you hear rather than see.', instr: HOW + 'Chug 8ths; on the "and" of 4, lift the palm and strike the next bar’s power chord an 8th early, letting it ring over the bar line. Listen for the accent arriving before the drums’ beat 1. Pass: 8 bars with every push ringing over.', watch: 'Cutting the push short.', simplify: 'Accent on beat 1 instead.' })], ST(
          'In pedal-tone rhythm the low root keeps chugging while chords on the top strings change: a pedal under moving harmony. The push accents the next chord an 8th early.',
          'Both are central to Van Halen’s rhythm style and to hard rock generally.',
          ['A pedal is a note held or repeated while the harmony moves.', 'A push lands on the "and" of 4 and rings through beat 1.'])),
        S('pm-music', 'In music', 'rhythm', 'A riff with the backing; an 8-bar study.', [
          P_('pm-riff-i', 'Riff with the band: gallops, push and accents ({chords})', 'transfer', { patterns: ['accent1', 'gallop', 'eighths', 'push'], prog: 'auto', reps: 2, goal: 106, start: 60, why: 'Mixing patterns across four bars makes a real riff: an accent bar, a gallop bar, a plain bar and a push into the repeat.', instr: HOW + 'Two times through with the backing. Pass: 8 bars locked to the drums.', watch: 'The gallop bar rushing.', simplify: '8ths with accents.' }),
          c => pmStudyI(c)], ST(
          'A riff is a sequence of rhythm patterns over a progression, repeating every few bars.',
          'Combining patterns is how riffs get their identity.',
          ['Four-bar riffs often end with a push into the repeat.', 'Keep the chugs even across every pattern.']))
      ], [4, 6]),
    stage('advanced', 'Syncopation, stops and arpeggios',
      'The 3+3+2 syncopation and stops with fretting-hand scratches at 120 BPM, palm-muted arpeggios through a progression in four keys, mixed patterns bar by bar, a riff recalled in a new key, and an advanced riff study.', [
        S('pm-synco', 'Syncopation and stops', 'rhythm', '3+3+2; scratches.', [
          P_('pm-synco', 'The 3+3+2 syncopation ({chords})', 'variable', { patterns: ['synco', 'eighths'], prog: 'auto3', goal: 120, start: 66, why: 'Grouping 8 16ths as 3+3+2 puts the accents off the beat: the syncopated punch of many hard-rock and metal riffs.', instr: HOW + 'Odd bars: accents on 1, the "a" of 1 and the "and" of 2, then chugs. Even bars: straight muted 8ths. Pass: 8 bars without the accents sliding onto the beat.', watch: 'Evening out the 3+3+2 into straight 8ths.', simplify: 'Count it aloud first.' }),
          P_('pm-stops', 'Stops with fretting-hand scratches ({chords})', 'accurate-reps', { patterns: ['stops'], prog: 'auto', picking: 'alternate', goal: 116, start: 64, why: 'A stop silences the chord with the fretting hand (it relaxes but stays on the strings) so the pick plays dead "scratches": a percussive gap inside the riff.', instr: HOW + 'Accent, then two scratches (fretting hand relaxed on the strings, no notes), chugs, accent, scratches, chugs, accent. Count only clean bars. Pass: 8 clean bars in a row.', watch: 'Notes sounding in the scratches.', simplify: 'Rests instead of scratches.' })], ST(
          'Syncopation puts accents between beats; a stop cuts the sound with the fretting hand while the pick keeps time on dead strings.',
          'Both make a riff hit harder by contrast.',
          ['3+3+2 = eight 16ths grouped as three, three, two.', 'Scratches: relax the fretting fingers on the strings without lifting them off.'])),
        S('pm-arps', 'Palm-muted arpeggios', 'picking', 'Chord tones, muted.', [
          P_('pm-arp', 'Palm-muted arpeggios through the progression ({chords})', 'external-focus', { style: 'arp', patterns: ['eighths'], prog: 'auto', goal: 116, start: 64, why: 'Arpeggiating a chord with the palm muting every note gives a tight, rhythmic texture (another Van Halen habit). Each note must keep its pitch under the mute.', instr: HOW + 'Hold the chord shape; pick its notes one at a time, low to high and back, every note muted. Listen: each note distinct, none ringing over the next. Pass: 8 bars with every note clear.', watch: 'Higher strings escaping the mute: move the palm so it covers them.', simplify: 'Two strings only.' }),
          P_('pm-arp-keys', 'Palm-muted arpeggios in four keys ({key} and up)', 'interleaving', { style: 'arp', patterns: ['eighths'], prog: 'auto2', keys: [0, 5, 10, 3], goal: 112, start: 62, why: 'In a new key every shape moves. Four keys a fourth apart, a progression each, rebuild the arpeggios each time.', instr: HOW + 'The progression in four keys. Pass: all four keys without stopping.', watch: 'The palm drifting off the strings at the key changes.', simplify: 'Two keys.' })], ST(
          'A palm-muted arpeggio plays a chord’s notes one by one, each one muted so they don’t blur together.',
          'It adds motion to a rhythm part without the wash of a ringing chord.',
          ['Angle the palm to cover the higher strings too.', 'The chord tones come from the shape you hold.'])),
        S('pm-mixed', 'Mixed and recalled', 'fretboard', 'Patterns bar by bar; a new key.', [
          P_('pm-mix', 'Interleaved: gallop, 16ths, synco and stops, a new one every bar ({chords})', 'interleaving', { patterns: ['gallopAcc', 'sixteenthsAcc', 'synco', 'stops'], prog: 'auto', picking: 'alternate', reps: 2, goal: 116, start: 64, why: 'Switching rhythm every bar is harder than repeating one, and that is what makes the switches automatic.', instr: HOW + 'One pattern per bar, in turn. Pass: 8 bars in time.', watch: 'The stops bar losing time.', simplify: 'Two patterns.' }),
          P_('pm-recall-key', 'From memory: the riff in a new key ({key} up a fourth and a fifth)', 'retrieval', { patterns: ['accent1', 'gallop', 'synco', 'push'], prog: 'auto', keys: [5, 7], goal: 112, start: 62, why: 'Moving a riff to a new key from memory (roots found by name, rhythm kept) is how you transpose on the bandstand.', instr: 'Cover the tab. Play the riff (accent, gallop, synco, push) with the progression a fourth up, then a fifth up, finding the roots by name. Pass: both keys in time.', watch: 'Playing the old key’s roots.', simplify: 'One key.' })], ST(
          'Mixed practice and recall make riffs portable: any rhythm, any key.',
          'Bands change keys for singers; riffs have to move.',
          ['A fourth up: E → A; a fifth up: E → B.', 'Keep the rhythm; move the roots.'])),
        S('pm-adv-music', 'In music', 'rhythm', 'A riff and a solo over it.', [
          P_('pm-riff-adv', 'Riff with the band: pedal tone, stops and 16ths ({chords})', 'transfer', { style: 'pedal', patterns: ['pedal16', 'pedal8'], prog: 'auto2', reps: 2, goal: 112, start: 62, why: 'The pedal-tone style at tempo with 16ths: the kind of rhythm part that carries a whole hard-rock verse.', instr: HOW + 'Two times through with the backing. Pass: 8 bars locked to the drums.', watch: 'Triad stabs rushing.', simplify: '8th-note pedal bars only.' }),
          c => targetGuide(c, { prog: c.minor ? 'powerMinor' : 'mixo', scale: c.minor ? 'minorPent' : 'majorPent', name: 'Over the riff: palm-mute the first half of each phrase, open up the second' })], ST(
          'Palm muting works in lead lines too: muted notes build tension, open notes release it.',
          'Mixing them is a hallmark of hard-rock soloing.',
          ['Lift the palm on the note you want to stand out.', 'Start phrases muted, end them ringing.']))
      ], [7, 8]),
    stage('mastery', 'Your riffs',
      'Accented 16th-note gallops at 132 BPM, any called pattern and chord on the spot, riffs from memory in six keys, and your own 16-bar riff.', [
        S('pm-perf', 'At performance tempo', 'picking', 'Speed and random access.', [
          P_('pm-perf', 'Performance tempo: accented gallops and 16ths in two keys ({key})', 'edge', { patterns: ['gallopAcc', 'sixteenthsAcc'], prog: 'auto', keys: [0, 7], picking: 'alternate', goal: 132, start: 76, why: 'Gallops and accented 16ths at performance tempo in two keys: endurance, an even mute and clean lifts together.', instr: HOW + 'Tempo ladder: +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Forearm tension: let the wrist do the work.', simplify: 'One key.' }),
          c => pmRandom(c)], ST(
          'Mastery is an even mute and clean accents at speed, in any order.',
          'Live riffs are fast and don’t wait.',
          ['Raise the tempo only after a clean pass.', 'Read the name, not the tab.'])),
        S('pm-recall-m', 'From memory', 'fretboard', 'Six keys; your own riff.', [
          P_('pm-six-keys', 'From memory: the riff in six keys', 'retrieval', { patterns: ['accent1', 'gallop'], prog: 'auto', keys: [0, 5, 10, 3, 8, 1], picking: 'alternate', goal: 128, start: 74, why: 'The same riff in six keys from memory: the roots found by name at tempo.', instr: 'Cover the tab. For each key, name the four roots, then play the riff. Pass: all six keys in time.', watch: 'A pause at each key.', simplify: 'Three keys.' }),
          P_('pm-own', 'Make it yours: the written bars, then your own riff bars ({chords})', 'transfer', { patterns: ['synco', 'gallopAcc', 'stops', 'push'], prog: 'auto', reps: 2, goal: 124, start: 72, minutes: 6, why: 'The tab gives a riff; the lesson is to rewrite every second bar with your own mix of chugs, accents and stops.', instr: 'Play the written odd bars; replace the even bars with your own palm-muted rhythm on the same chord. Pass: two times through in time, your bars different each time.', watch: 'Your bars copying the written ones.', simplify: 'Rewrite only the last bar.' })], ST(
          'Recall in six keys and rewriting riffs are the test that the model is yours.',
          'Writing riffs is the goal of all rhythm technique.',
          ['Name the roots before you play.', 'Keep one element (the rhythm or the chords) and change the other.'])),
        S('pm-voice', 'Your own riff', 'rhythm', 'A capstone riff, then a solo over it.', [c => pmEtude(c),
          c => targetGuide(c, { prog: c.minor ? 'powerMinor' : 'mixo', scale: c.minor ? 'minorPent' : 'majorPent', name: 'Solo over your riff: muted pentatonic phrases that open up at the end' })], ST(
          'The capstone riff combines every pattern and style; then you write and solo over your own.',
          'A technique becomes yours when you compose with it.',
          ['Learn long riffs four bars at a time.', 'Record your riff and solo over it.']))
      ], [9, 10])
  ]
});
