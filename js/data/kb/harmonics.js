// Harmonics: bell-like overtones sounded by touching a string at a node instead of fretting it (natural
// harmonics), by tapping or touching 12 frets above a fretted note (tapped and artificial harmonics), or
// by letting the picking thumb graze the string (pinch harmonics). Eddie Van Halen used all three:
// chiming riffs, tapped-harmonic arpeggios, harmonics dived with the bar, and screaming pinch accents.
// From the first 12th-fret harmonic, through the 7th, 5th and 4th-fret nodes, chimes, melodies in a key,
// tapped harmonics over chords and scales and pinch harmonics in riffs, to whammy dives, "harp"
// arpeggios that alternate fretted notes and harmonics, random access at tempo and an original study.
//
// Concept-first (CONTENT.md): the model is the HARMONIC SERIES of each open string. A node at fret 12
// sounds the octave of the open string, 7 an octave and a 5th, 5 two octaves, 4 two octaves and a major
// 3rd (NODES), so every natural harmonic's pitch is computed, never typed. `natIn(pcs)` lists the
// natural harmonics whose pitch belongs to a key's scale (every key has at least four), sorted by pitch,
// so melodies and chimes are in the key by construction. Tapped harmonics (`ah`) sound an octave above a
// fretted note, so they come from any fretted shape: a triad (topTriad) or the key's pentatonic box.
// Pinch harmonics are written `ah` on picked notes of a riff (their exact overtone depends on where the
// pick strikes). The composer `hmRun(c, spec)` builds an exercise from kind (natural | chime | tapped |
// harp | pinch | riff) × node set × string set × plan (up, down, motif) × key plan × whammy move.
//
// Teaching method first (CONTENT.md, `pedagogy` below), audited 2026-10-18: natural harmonics at 12, then
// 7 and 5 (touch over the wire, pick, lift), alternating the open string with its harmonic, all six
// strings and chimes, melodies from the harmonics of a key; then the 4th fret, touched and tapped
// harmonics 12 frets above fretted notes and chords, pinch harmonics (one motion, thumb right after the
// pick) in riffs; then the bar, harp harmonics (fretted notes alternating with harmonics), keys; then
// tempo and your own piece. Removed: singing the pitch (`hm-sing`), naming notes, covering the tab and
// "from memory" versions (`hm-names`, `hm-called`, `hm-key-all`, `hm-six-keys`, the "read only the names"
// bars of `hm-random`); added `hm-open-alt` (open string, then its harmonic) and `hm-all-six`.
import { OPEN, N, nameOf, make, mod12, chordInfo, topTriad, pentBox, byString, S, stage, entry, targetGuide } from '../lib.js';
import { rng } from './bending.js';

/* ------------------------------- The concept ------------------------------- */
/** Natural harmonic nodes: fret → semitones above the open string. */
export const NODES = { 12: 12, 7: 19, 5: 24, 4: 28 };
const NODE_NAME = { 12: 'octave', 7: 'octave + 5th', 5: 'two octaves', 4: 'two octaves + major 3rd' };
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const SN = ['', 'e', 'B', 'G', 'D', 'A', 'E'];
export const hPitch = (s, node) => OPEN[s] + NODES[node];
const SCALE = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], pent: [0, 3, 5, 7, 10], majPent: [0, 2, 4, 7, 9] };
const keyPcs = (k, minor, sc) => SCALE[sc || (minor ? 'minor' : 'major')].map(x => mod12(k + x));
/** Every natural harmonic (string × node) whose pitch is in pcs, low to high, one per pitch. */
export function natIn(pcs, { strings = [6, 5, 4, 3, 2, 1], nodes = [12, 7, 5, 4], min = 4 } = {}) {
  const got = natRaw(pcs, strings, nodes);
  // a key far from the open strings has few harmonics at the easy nodes: add the others until there are enough
  return got.length >= min ? got : natRaw(pcs, [6, 5, 4, 3, 2, 1], [12, 7, 5, 4]);
}
function natRaw(pcs, strings, nodes) {
  const out = [];
  for (const s of strings) for (const n of nodes) { const p = hPitch(s, n); if (pcs.includes(mod12(p))) out.push({ s, f: n, p }); }
  out.sort((a, b) => a.p - b.p || b.s - a.s);
  return out.filter((h, i) => i === 0 || h.p !== out[i - 1].p);
}
/** Chimes: three adjacent strings at one node, struck together (pcs = what they sound). */
export const CHIMES = [12, 7, 5].flatMap(node => [[4, 3, 2], [3, 2, 1], [5, 4, 3], [6, 5, 4]].map(ss => ({ node, ss, pcs: ss.map(s => mod12(hPitch(s, node))) })));
const PAIRS = [12, 7, 5, 4].flatMap(node => [[3, 2], [2, 1], [4, 3], [5, 4], [6, 5]].map(ss => ({ node, ss, pcs: ss.map(s => mod12(hPitch(s, node))) })));
/** Chimes in a key: three-string chimes first, then two-string ones, then single harmonics, until there are at least four. */
function chimesIn(pcs, nodes = [12, 7, 5, 4]) {
  const ok = ch => nodes.includes(ch.node) && ch.pcs.every(p => pcs.includes(p));
  let out = [...CHIMES.filter(ok), ...PAIRS.filter(ok)];
  if (out.length < 4) out = [...out, ...natIn(pcs).map(h => ({ node: h.f, ss: [h.s], pcs: [mod12(h.p)] }))].slice(0, 6);
  return out;
}
/** A triad on strings 3-2-1 low enough (frets ≤ 10) to tap 12 frets above. */
function lowTriad(nm) { for (const near of [4, 3, 5, 6, 2, 7, 8]) { const tr = topTriad(nm, near); if (tr && Math.max(tr[3], tr[2], tr[1]) <= 10) return tr; } return null; }
const PENT = k => SCALE.pent.map(x => mod12(k + x));

/* ------------------------------- The composer ------------------------------- */
/**
 * One harmonics exercise from a spec: { id, name ('{key}', '{nodes}', '{strings}'), method, kind ('natural' | 'teach' |
 * 'chime' | 'tapped' | 'harp' | 'pinch' | 'riff'), nodes, strings, plan ('strings' | 'up' | 'down' | 'updown' | 'motif'),
 * free (natural harmonics of the open strings, no key), keys (offsets), scale, prog ('auto' or k => chord names),
 * step (beats per note), bar ('dive' | 'dip' | 'scoop' | 'vib' on the harmonics), reps, domain, unit, goal, start, dl,
 * why, instr, watch, simplify }.
 */
export function hmRun(c, spec) {
  const lvl = c.lvl || 5, notes = [], used = []; let t = 0;
  const kind = spec.kind || 'natural', step = spec.step || (lvl <= 3 ? 2 : lvl <= 6 ? 1 : 0.5), nodes = spec.nodes || [12, 7, 5];
  const barX = spec.bar ? { bar: spec.bar, ...(spec.barDepth ? { barDepth: spec.barDepth } : {}) } : null;
  for (const off of spec.keys || [0]) {
    const k = mod12(c.key + off), pcs = keyPcs(k, c.minor, spec.scale);
    if (kind === 'natural' || kind === 'teach') {
      let list;
      if (spec.free) list = (spec.strings || [6, 5, 4, 3, 2, 1]).flatMap(s => nodes.map(n => ({ s, f: n, p: hPitch(s, n) })));
      else list = natIn(pcs, { strings: spec.strings || [6, 5, 4, 3, 2, 1], nodes });
      if (list.length < 3) return null;
      const order = plan(list, spec.plan || 'strings', lvl);
      for (const h of order) {
        const allow = spec.free ? [mod12(h.p)] : pcs;
        if (kind === 'teach') {
          // the fretted note at the node (12 only sounds the same note), then the harmonic: touch, pick, lift
          if (h.f === 12 && !spec.open) notes.push(tag(N(h.s, 12, t, step), allow));
          else notes.push(tag(N(h.s, 0, t, step), [mod12(OPEN[h.s])].concat(allow)));
          notes.push(tag(N(h.s, h.f, t + step, step * 2, 'nh'), allow)); t += step * 3;
        } else { notes.push(tag(N(h.s, h.f, t, step, 'nh', barX), allow)); t += step; }
      }
      used.push(spec.free ? 'open strings' : `${nameOf(k)} ${c.minor ? 'minor' : 'major'}`);
    } else if (kind === 'chime') {
      const list = spec.free ? CHIMES.filter(ch => nodes.includes(ch.node) && ch.ss[0] <= 4) : chimesIn(pcs, nodes);
      if (list.length < 2) return null;
      for (let r = 0; r < (spec.reps || 2); r++) for (const ch of list.slice(0, 6)) {
        ch.ss.forEach(s => notes.push(tag(N(s, ch.node, t, step * 2, 'nh', { ...(ch.ss.length > 1 ? { chord: true } : {}), ...(barX || {}) }), spec.free ? ch.pcs : pcs)));
        t += step * 2;
      }
      used.push(spec.free ? 'open strings' : `${nameOf(k)} ${c.minor ? 'minor' : 'major'}`);
    } else if (kind === 'tapped' || kind === 'harp') {
      // over chords: hold a triad on strings 3-2-1 (frets ≤ 10) and tap 12 above each string (harp: fretted note, then the harmonic of the next string)
      const names = spec.prog ? spec.prog(k, c) : [nameOf(k) + (c.minor ? 'm' : ''), nameOf(k + (c.minor ? 8 : 5)), nameOf(k + (c.minor ? 10 : 7)), nameOf(k) + (c.minor ? 'm' : '')];
      let near = 5;
      for (let r = 0; r < (spec.reps || 1); r++) for (const nm of names) {
        const ch = chordInfo(nm), tr = ch && lowTriad(nm); if (!tr) return null;
        const cells = kind === 'harp' ? [[3, 0], [2, 1], [1, 0], [2, 1], [3, 1], [2, 0], [1, 1], [2, 1]] : [[3, 1], [2, 1], [1, 1], [2, 1]];
        const per = kind === 'harp' ? (lvl >= 7 ? 0.25 : 0.5) : (lvl >= 7 ? 0.5 : 1);
        for (let b = 0; b < 4 / (per * cells.length); b++) cells.forEach(([s, h], i) => notes.push(tag(N(s, tr[s], t + b * per * cells.length + i * per, per, h ? 'ah' : null), ch.pcs)));
        t += 4; near = tr[2]; used.push(ch.name);
      }
    } else if (kind === 'tapScale') {
      // tapped harmonics on the notes of a pentatonic box (top three strings), up and down
      const pk = c.minor ? k : mod12(k - 3), ps = PENT(pk);
      const boxSeq = b => { const B = byString(pentBox(pk, b)); return [3, 2, 1].flatMap(s => (B[s] || []).map(f => [s, f])).filter(([, f]) => f <= 10); };
      const bx = [spec.box || 1, 5, 4, 2, 3].sort((x, y) => (boxSeq(y).length >= 5) - (boxSeq(x).length >= 5) || boxSeq(y).length - boxSeq(x).length)[0], seq = boxSeq(bx);
      if (seq.length < 4) return null;
      const order = [...seq, ...seq.slice(0, -1).reverse()], per = lvl >= 7 ? 0.5 : 1;
      order.forEach(([s, f], i) => notes.push(tag(N(s, f, t + i * per, per, i % 2 && spec.alt ? null : 'ah'), ps)));
      t += order.length * per; used.push(`${nameOf(pk)} minor`);
    } else if (kind === 'pinch' || kind === 'riff') {
      // a riff on the low strings: palm-muted root 8ths, with pinch harmonics (pinch) or natural harmonics of the key (riff) as accents
      const pk = c.minor ? k : mod12(k - 3), ps = PENT(pk), R = lowRoot(pk), B = byString(pentBox(pk, 1));
      const nat = natIn(pcs.filter(p => ps.includes(p)), { strings: [4, 3, 2], nodes: [12, 7, 5], min: 2 });
      const lead = kind === 'pinch' ? [3, 4].flatMap(s => (B[s] || []).map(f => [s, f])).filter(([, f]) => f >= 1) : nat.map(h => [h.s, h.f]);
      if (lead.length < 2) return null;
      for (let bar = 0; bar < (spec.bars || 4); bar++) {
        const T = t + bar * 4;
        [0, 0.5, 1, 1.5, 2.5].forEach(x => notes.push(tag(N(R.s, R.f, T + x, 0.5, 'pm'), ps)));
        const [s, f] = lead[bar % lead.length];
        notes.push(tag(N(s, f, T + 2, 0.5, kind === 'pinch' ? 'ah' : 'nh'), kind === 'pinch' ? ps : pcs));
        const [s2, f2] = lead[(bar + 1) % lead.length];
        notes.push(tag(N(s2, f2, T + 3, 1, kind === 'pinch' ? 'ah' : 'nh', barX), kind === 'pinch' ? ps : pcs));
      }
      t += (spec.bars || 4) * 4; used.push(`${nameOf(pk)} minor`);
    }
  }
  if (notes.length < 4 || notes.length > 400) return null;
  const fill = x => String(x).replace(/\{key\}/g, [...new Set(used)].slice(0, 4).join(', ')).replace(/\{nodes\}/g, nodes.join(', ')).replace(/\{strings\}/g, (spec.strings || []).map(s => SN[s]).join(' '));
  const backing = spec.backing ? spec.backing(mod12(c.key), c) : null;
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'picking', method: spec.method, unit: spec.unit || (step >= 2 ? 'half notes' : step >= 1 ? 'quarter notes' : '8th notes'),
    goal: spec.goal || 80, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0,
    why: spec.why, instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify,
    ...(backing ? { backing, chords: [...new Set(backing)] } : (kind === 'tapped' || kind === 'harp') && !spec.keys ? { backing: used, chords: [...new Set(used)] } : {}), tab: { notes }
  });
}
/** Orders a harmonic list: by string (low to high, nodes in order), up or down in pitch, or a motif. */
function plan(list, how, lvl) {
  if (how === 'strings') return list;
  if (how === 'up') return list;
  if (how === 'down') return list.slice().reverse();
  if (how === 'updown') return [...list, ...list.slice(0, -1).reverse()];
  // motif: a three-note figure stepping up the list, then back (longer at higher levels)
  const out = [], n = Math.min(list.length - 2, lvl >= 7 ? 8 : 5);
  for (let i = 0; i < n; i++) out.push(list[i], list[i + 2], list[i + 1]);
  return out;
}
/** The key's root on the low strings (an open string when it is the root). */
function lowRoot(k) { for (const s of [6, 5]) if (mod12(OPEN[s] - k) === 0) return { s, f: 0 }; const f = mod12(k - OPEN[6]); return f <= 7 ? { s: 6, f } : { s: 5, f: mod12(k - OPEN[5]) }; }
const H_ = (id, name, method, opts) => c => hmRun(c, { id, name, method, ...opts });
const minorProg = (k, c) => (c.minor ? [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'] : [nameOf(k), nameOf(k + 9) + 'm', nameOf(k + 5), nameOf(k + 7)]);

/* ------------------------------ Music ------------------------------ */
/** Random access: a random kind (natural, chime, tapped, pinch) and place every bar (interleaving). */
export function hmRandom(c) {
  const r = rng(523 + (c.lvl || 9)), k = mod12(c.key), pcs = keyPcs(k, c.minor), notes = [], names = [];
  const nat = natIn(pcs), chm = chimesIn(pcs), chords = minorProg(k, c);
  for (let bar = 0; bar < 8; bar++) {
    const T = bar * 4, kind = ['natural', 'chime', 'tapped', 'natural'][Math.floor(r() * 4)];
    if (kind === 'chime' && chm.length) {
      const ch = chm[Math.floor(r() * chm.length)]; ch.ss.forEach(s => notes.push(tag(N(s, ch.node, T, 2, 'nh', ch.ss.length > 1 ? { chord: true } : {}), pcs)));
      const h = nat[Math.floor(r() * nat.length)]; notes.push(tag(N(h.s, h.f, T + 2, 2, 'nh', { bar: 'vib' }), pcs));
      names.push(`chime at fret ${ch.node} on ${ch.ss.map(s => SN[s]).join('')}, then a harmonic with bar vibrato`);
    } else if (kind === 'tapped') {
      const nm = chords[Math.floor(r() * chords.length)], ch = chordInfo(nm), tr = lowTriad(nm);
      [3, 2, 1, 2].forEach((s, i) => notes.push(tag(N(s, tr[s], T + i, 1, 'ah'), ch.pcs)));
      names.push(`tapped harmonics over ${ch.name}`);
    } else {
      const i = Math.floor(r() * Math.max(1, nat.length - 3)), seg = nat.slice(i, i + 4);
      seg.forEach((h, j) => notes.push(tag(N(h.s, h.f, T + j, 1, 'nh'), pcs)));
      names.push(`four natural harmonics up from fret ${seg[0].f} on the ${SN[seg[0].s]} string`);
    }
  }
  return make(c, {
    id: 'hm-random', name: `Mixed bars: a new kind of harmonic every bar (${nameOf(k)} ${c.minor ? 'minor' : 'major'})`, domain: 'fretboard', method: 'interleaving', unit: 'quarter notes', goal: 100, start: 56, minutes: 5, dl: 1, tab: { notes },
    why: 'At mastery level harmonics are a palette: natural, chimed or tapped, wherever the music wants them. A new kind and place every bar trains the changes between them.',
    instr: `${names.join(' → ')}. Each bar changes the kind of harmonic; set the hand for the next kind before the bar line. Pass: all 8 bars in time with every harmonic clear.`,
    watch: 'Natural harmonics turning dull when you rush the touch.', simplify: 'The first four bars.'
  });
}
/** An original study: chimes, a harmonic melody, a riff with harmonics, tapped-harmonic arpeggios, a dive (8 or 16 bars). */
function hmStudy(c, capstone) {
  const k = mod12(c.key), pcs = keyPcs(k, c.minor), notes = []; let t = 0;
  const nat = natIn(pcs), chm = chimesIn(pcs), chords = minorProg(k, c), pk = c.minor ? k : mod12(k - 3), ps = PENT(pk), R = lowRoot(pk);
  if (nat.length < 4) return null;
  const sec = {
    chimes: () => { chm.slice(0, 2).forEach((ch, i) => ch.ss.forEach(s => notes.push(tag(N(s, ch.node, t + i * 2, 2, 'nh', ch.ss.length > 1 ? { chord: true } : {}), pcs)))); t += 4; },
    melody: () => { const seg = nat.slice(Math.max(0, nat.length - 6)); [0, 2, 1, 3, 2, 4, 3, 5].forEach((j, i) => { const h = seg[Math.min(j, seg.length - 1)]; notes.push(tag(N(h.s, h.f, t + i * 0.5, 0.5, 'nh'), pcs)); }); t += 4; },
    riff: () => { [0, 0.5, 1, 1.5, 2.5].forEach(x => notes.push(tag(N(R.s, R.f, t + x, 0.5, 'pm'), ps))); const h = natIn(pcs.filter(p => ps.includes(p)), { strings: [4, 3, 2], nodes: [12, 7, 5], min: 2 }); const a = h[0] || nat[0], b = h[1] || nat[1]; notes.push(tag(N(a.s, a.f, t + 2, 0.5, 'nh'), pcs), tag(N(b.s, b.f, t + 3, 1, 'nh'), pcs)); t += 4; },
    tapped: i => { const nm = chords[i % chords.length], ch = chordInfo(nm), tr = lowTriad(nm); [3, 2, 1, 2, 3, 2, 1, 2].forEach((s, j) => notes.push(tag(N(s, tr[s], t + j * 0.5, 0.5, j % 2 ? 'ah' : null), ch.pcs))); t += 4; },
    pinch: () => { [0, 0.5, 1, 1.5].forEach(x => notes.push(tag(N(R.s, R.f, t + x, 0.5, 'pm'), ps))); const B = byString(pentBox(pk, 1)); const f3 = (B[3] || [5])[1]; notes.push(tag(N(3, f3, t + 2, 2, 'ah'), ps)); t += 4; },
    dive: () => { const h = nat.find(x => x.f === 12 && x.s === 3) || nat.find(x => x.f === 12) || nat[nat.length - 1]; notes.push(tag(N(h.s, h.f, t, 4, 'nh', { bar: 'dive', barDepth: 12 }), pcs)); t += 4; }
  };
  const plan = capstone ? ['chimes', 'melody', 'riff', 'riff', 'tapped', 'tapped', 'pinch', 'dive', 'chimes', 'melody', 'riff', 'pinch', 'tapped', 'tapped', 'melody', 'dive'] : ['chimes', 'riff', 'melody', 'riff', 'tapped', 'tapped', 'pinch', 'dive'];
  let ti = 0; plan.forEach(p => (p === 'tapped' ? sec.tapped(ti++) : sec[p]()));
  const back = plan.map((p, i) => chords[i % chords.length]);
  return make(c, {
    id: capstone ? 'hm-capstone-etude' : 'hm-study-8', name: capstone ? `Capstone study: 16 bars of harmonics (${nameOf(k)} ${c.minor ? 'minor' : 'major'})` : `Study: an 8-bar harmonics piece (${nameOf(k)} ${c.minor ? 'minor' : 'major'})`,
    domain: 'improv', method: 'transfer', unit: 'mixed', goal: capstone ? 96 : 84, start: capstone ? 52 : 48, minutes: capstone ? 8 : 6, dl: capstone ? 1 : 0,
    backing: back, chords: [...new Set(back)], tab: { notes },
    why: capstone ? 'An original 16-bar piece that uses the whole path: chimes, natural-harmonic melodies, a riff with harmonic accents, tapped-harmonic arpeggios, pinch harmonics and a harmonic dived with the bar.' : 'An original 8-bar piece in a hard-rock style: chimes, a palm-muted riff answered by harmonics, a harmonic melody, tapped harmonics over two chords, a pinch accent and a dive to finish.',
    instr: capstone ? 'Learn it four bars at a time, slowly, then join the sections. Then rewrite four bars of your own. Pass: the study at the goal tempo with every harmonic ringing clearly, then your own version.' : 'Learn it two bars at a time, then as one piece with the backing. Pass: two times through at the goal tempo with every harmonic clear.',
    watch: 'Natural harmonics dying because the finger stays on the string too long.', simplify: capstone ? 'Bars 1–8.' : 'Bars 1–4.'
  });
}
export const hmStudyI = c => hmStudy(c, false);
export const hmEtude = c => hmStudy(c, true);

/* --------------------------------- The path --------------------------------- */
const HOW_N = 'Touch the string lightly directly above the fret wire (not between the frets), without pressing it down; pick close to the bridge, then lift the touching finger at once so the harmonic rings. ';
const HOW_T = 'Hold the fretted notes; with the picking-hand index or middle finger, tap (bounce off) the same string exactly 12 frets higher, right over the fret wire, so it sounds an octave above (AH in the tab). ';
const HOW_P = 'Bridge pickup and plenty of gain. Choke up on the pick so only the tip shows; pick a firm downstroke and let the side of the thumb graze the string right after the pick, in one motion, over the pickups (move along the string until it squeals). AH marks the pinch harmonic; the overtone you get depends on where you strike. ';
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'harmonics', kind: 'technique', title: 'Harmonics (natural, tapped and pinch)', domain: 'picking',
  re: /harmonics\b|(natural|artificial|tapped|pinch(ed)?|false) harmonic|pinch squeal/,
  aliases: ['natural harmonics', 'artificial harmonics', 'tapped harmonics', 'pinch harmonics', 'pinched harmonics'],
  summary: 'Bell-like overtones: natural harmonics at the 12th, 7th, 5th and 4th frets, chimes, melodies in a key, tapped harmonics over chords and scales, pinch harmonics in riffs, whammy dives and harp-style arpeggios, from the first 12th-fret harmonic to random access at tempo and an original study.',
  prereqs: ['palmMuting'],
  sources: ['https://www.masterclass.com/articles/learn-how-to-play-natural-harmonics-on-guitar', 'https://jamplay.com/guitar-lessons/skill-building/2-lead-concepts-techniques/362', 'https://www.premierguitar.com/articles/26505-how-to-handle-harmonics', 'https://www.guitarworld.com/lessons/how-play-pinch-harmonic', 'https://www.tabs4acoustic.com/en/guitar-lessons/artificial-harmonics-on-the-guitar-98.html', 'https://www.premierguitar.com/lessons/electric-etudes-eddie-van-halen-techniques', 'https://www.guitarplayer.com/lessons/eddie-van-halens-playing-secrets-how-to-solo-like-the-lead-guitar-legend'],
  pedagogy: {
    date: '2026-10-18',
    summary: 'Taught in the order natural, then artificial (touched and tapped), then pinch: natural harmonics at the 12th fret first (the G string is the usual start), then the 7th and 5th and the less common nodes, with the touch directly over the fret wire, a pick near the bridge and the finger lifted at once; open strings alternated with their harmonics, then intervals, chimes and melodies from the harmonics a tuning or key offers. Then artificial harmonics 12 frets above a fretted note, single notes first, then over chords, then harp harmonics that alternate fretted notes and harmonics; pinch harmonics from a few hit-or-miss successes to sweet spots, fretted notes in rhythm and riffs; in rock, harmonics dived with the bar and tapped harmonics over a bend.',
    sequence: [
      { id: 'n12', tier: 'foundations', step: 'Natural harmonics: 12th fret, then 7th and 5th', how: 'Rest the finger lightly over the fret wire, pick, lift at once; 12 first (easiest), then 7, then 5.', skills: ['hm-touch'], source: 0 },
      { id: 'alt', tier: 'foundations', step: 'Open strings alternated with their harmonics; letting them ring', how: 'Each open string, then its 12th-fret harmonic; harmonics left to ring into each other.', skills: ['hm-hear'], source: 2 },
      { id: 'all', tier: 'foundations', step: 'Every string, intervals and chimes', how: 'The nodes across all six strings; two or three strings at one node struck together.', skills: ['hm-map'], source: 1 },
      { id: 'song', tier: 'foundations', step: 'Natural harmonics in a melody or riff', how: 'Melodies from the harmonics available in the key, and harmonics answering a riff.', skills: ['hm-first-music'], source: 1 },
      { id: 'less', tier: 'intermediate', step: 'The less common nodes (4th, 9th, 19th)', how: 'The 4th-fret node and mixed nodes in a melody; a more exact touch near the bridge.', skills: ['hm-nodes'], source: 1 },
      { id: 'art', tier: 'intermediate', step: 'Artificial harmonics: touched or tapped 12 frets above a fretted note', how: 'Single fretted notes first, then a held chord spelled an octave up as harmonics.', skills: ['hm-tapped'], source: 4 },
      { id: 'pinch', tier: 'intermediate', step: 'Pinch harmonics', how: 'Gain and the bridge pickup; pick and graze with the thumb in one motion; find the sweet spots, then fretted notes in rhythm, then riffs.', skills: ['hm-pinch'], source: 3 },
      { id: 'key', tier: 'intermediate', step: 'Harmonic melodies in a key', how: 'The harmonics a key offers in a new order; chimes mixed with single harmonics.', skills: ['hm-recall'], source: 2 },
      { id: 'riff', tier: 'intermediate', step: 'Harmonics in a riff and a study', how: 'Harmonics inside a hard-rock riff, as in the Van Halen intros.', skills: ['hm-music'], source: 5 },
      { id: 'bar', tier: 'advanced', step: 'Harmonics with the whammy bar', how: 'Harmonics dived and given bar vibrato; dip the bar before a pinch.', skills: ['hm-bar'], source: 3 },
      { id: 'harp', tier: 'advanced', step: 'Harp harmonics', how: 'Rolls that alternate harmonics with fretted notes, then the roll over a fretted chord, in several keys.', skills: ['hm-harp'], source: 2 },
      { id: 'dist', tier: 'advanced', step: 'All positions combined and other keys', how: 'All the nodes of a key in one line; artificial harmonics while the fretting hand changes position and key.', skills: ['hm-recall-a'], source: 1 },
      { id: 'solo', tier: 'advanced', step: 'Harmonics in a solo', how: 'Harmonic accents ending phrases; tapped harmonics over a bend in a solo.', skills: ['hm-adv-music'], source: 5 },
      { id: 'tempo', tier: 'mastery', step: 'Harp harmonics at tempo, every kind and every key', how: 'Rolls at speed, changing kind of harmonic each bar, tapped harmonics in many keys.', skills: ['hm-perf', 'hm-recall-m'], source: 2 },
      { id: 'own', tier: 'mastery', step: 'Your own harmonics piece', how: 'Combine the main techniques in a piece of your own.', skills: ['hm-voice'], source: 1 }
    ],
    drills: ['12th-fret harmonics on every string, then 7 and 5', 'Open string alternated with its 12th-fret harmonic', 'Chimes: one finger across three strings at a node', 'Melodies from the natural harmonics of a key', 'Artificial harmonics 12 frets above fretted notes and chords', 'Pinch harmonics on open strings, then fretted notes in rhythm, then in a riff', 'Harp harmonics: fretted notes alternating with harmonics over a chord', 'Natural harmonics dived with the whammy bar'],
    mistakes: ['Touching between the frets instead of directly over the fret wire', 'Pressing the string down instead of resting on it', 'Leaving the touching finger on too long, so the harmonic dies', 'Pinch: picking too lightly, or the thumb touching late or too long so the note goes dead', 'Tapped harmonics pressed down to the fret instead of bounced off', 'Fretted notes louder than the harmonics in harp rolls'],
    sources: [
      { title: 'Learn How to Play Natural Harmonics on Guitar', author: 'MasterClass', url: 'https://www.masterclass.com/articles/learn-how-to-play-natural-harmonics-on-guitar' },
      { title: 'Discover Harmonics on the Guitar (course)', author: 'Jeff Gunn (JamPlay)', url: 'https://jamplay.com/guitar-lessons/skill-building/2-lead-concepts-techniques/362' },
      { title: 'How to Handle Harmonics', author: 'Kirby Jane (Premier Guitar)', url: 'https://www.premierguitar.com/articles/26505-how-to-handle-harmonics' },
      { title: 'How to play a pinch harmonic', author: 'Jamie Humphries (Guitar World)', url: 'https://www.guitarworld.com/lessons/how-play-pinch-harmonic' },
      { title: 'Artificial harmonics on the guitar', author: 'Tabs4Acoustic', url: 'https://www.tabs4acoustic.com/en/guitar-lessons/artificial-harmonics-on-the-guitar-98.html' },
      { title: 'Electric Etudes: Eddie Van Halen techniques', author: 'Jamie Humphries (Premier Guitar)', url: 'https://www.premierguitar.com/lessons/electric-etudes-eddie-van-halen-techniques' }
    ]
  },
  ctx: { key: 4, minor: true, prog: 'minorRock' },
  stages: [
    stage('foundations', 'Touch, pick, lift',
      'Clear natural harmonics at the 12th, 7th and 5th frets on every string at 70 BPM (half notes, each ringing until the next), chimes on three strings, the pitch of each node named from memory, and a first harmonic melody in the key with the backing.', [
        S('hm-touch', 'The touch', 'picking', '12, then 7 and 5.', [
          H_('hm-teach', 'Fretted, then harmonic: the 12th fret on every string ({key})', 'chunking', { kind: 'teach', free: true, nodes: [12], strings: [6, 5, 4, 3, 2, 1], goal: 70, start: 40, why: 'A natural harmonic is three small moves: touch, pick, lift. Playing the fretted 12th-fret note first, then the harmonic at the same place, gives the ear a target (both sound the same note) and builds the touch in pieces.', instr: HOW_N + 'On each string: the fretted note at fret 12, then the harmonic at fret 12 (touch, pick, lift). Pass: every harmonic rings as clearly as the fretted note.', watch: 'Touching between the frets: the harmonic comes out dull.', simplify: 'The G string only.' }),
          H_('hm-7-5', 'The 7th and 5th-fret harmonics, counting the clear ones ({key})', 'accurate-reps', { free: true, nodes: [7, 5], strings: [4, 3, 2, 1], goal: 72, start: 42, why: 'The 7th and 5th-fret nodes need a more exact touch than the 12th. Counting only clear harmonics trains the precise spot over the fret wire.', instr: HOW_N + 'Fret 7, then fret 5, string by string. Count a harmonic only if it rings clearly. Pass: 16 clear in a row.', watch: 'Pressing too hard: the note goes dead.', simplify: 'Fret 12 and 7 only.' })], ST(
          'A natural harmonic sounds an overtone of the open string: touching the string at a node (12th, 7th, 5th fret) silences the fundamental and lets the overtone ring.',
          'Harmonics add bell-like notes that sustain, high above the normal range, and a chiming texture to riffs and ballads.',
          ['Touch directly above the fret wire, don’t press.', 'Lift the touching finger as soon as you pick.', 'Bridge pickup and picking near the bridge make harmonics louder.'])),
        S('hm-hear', 'Clear and ringing', 'picking', 'The open string, then its harmonic; let them ring.', [
          H_('hm-open-alt', 'Open string, then its harmonic: frets 12 and 7 ({key})', 'chunking', { kind: 'teach', open: true, free: true, nodes: [12, 7], strings: [4, 3, 2, 1], goal: 70, start: 40, why: 'Alternating each open string with its harmonic gives the ear a reference: at fret 12 the harmonic is the same note an octave up, at fret 7 an octave and a 5th up. A harmonic that sounds dull or thin next to the open string shows the touch was off the node.', instr: HOW_N + 'On each string: the open string, then the harmonic at the fret shown. Pass: every harmonic rings as long and clearly as the open string.', watch: 'Lifting the touching finger too late: the harmonic dies at once.', simplify: 'Fret 12 only.' }),
          H_('hm-ring', 'Let them ring: harmonics overlapping across the strings ({key})', 'external-focus', { free: true, nodes: [12, 7, 5], strings: [4, 3, 2, 1], plan: 'strings', goal: 72, start: 42, why: 'Harmonics sustain for a long time; letting each one ring into the next makes a bell-like wash. Listening to that ring (and to which notes die early) tells you which touches need work.', instr: HOW_N + 'Don’t mute anything: each harmonic should still be ringing when the next one sounds. Listen for any that die early and repeat those. Pass: every harmonic rings into the next.', watch: 'The picking hand muting the strings as it moves.', simplify: 'Two strings.' })], ST(
          'Each node sounds a fixed interval above the open string: 12 an octave, 7 an octave and a 5th, 5 two octaves, 4 two octaves and a major 3rd.',
          'Hearing the open string next to its harmonic tells you whether you hit the node.',
          ['The 12th and 5th frets sound the open string’s note (an octave and two octaves up).', 'The 7th (and 19th) fret sounds the 5th above the open string.'])),
        S('hm-map', 'All six strings; chimes', 'fretboard', 'Every string at 12, 7 and 5; chimes.', [
          H_('hm-all-six', 'Frets 12, 7 and 5 on all six strings, low E to high e ({key})', 'accurate-reps', { free: true, nodes: [12, 7, 5], strings: [6, 5, 4, 3, 2, 1], goal: 72, start: 42, why: 'The low strings need a slightly firmer pick and the high strings a lighter touch; playing all three nodes on every string makes the touch reliable everywhere. Fret 12 and 5 sound the open string’s note, fret 7 its 5th.', instr: HOW_N + 'String by string from the low E: fret 12, 7, then 5. Count only clear harmonics. Pass: all 18 clear in one pass.', watch: 'The low-string harmonics buzzing because the finger presses down.', simplify: 'The top four strings.' }),
          H_('hm-chimes', 'Chimes: three strings at one node, struck together ({key})', 'variable', { kind: 'chime', free: true, nodes: [12, 7, 5], goal: 72, start: 42, why: 'Laying one finger across three strings at a node and strumming gives a chord of harmonics, a chime. Moving between nodes and string sets varies the touch while the motion stays the same.', instr: 'Lay the finger flat across the three strings directly above the fret wire, strum them, lift. Change node and string set every chime. Pass: every chime with all three notes ringing.', watch: 'One string dead because the finger doesn’t lie flat.', simplify: 'Only fret 12.' })], ST(
          'Harmonics are notes with names: knowing them turns a sound effect into melody and harmony.',
          'Chimes are chords of harmonics, a classic sound in rock intros and ballads.',
          ['12th fret across D G B = a G major triad; 5th fret across G B e = E minor.', 'A chime only works if your finger touches all three strings exactly over the wire.'])),
        S('hm-first-music', 'First music', 'improv', 'A harmonic melody in the key; a riff with chimes.', [
          H_('hm-first-melody', 'First harmonic melody: the harmonics of {key} up and down', 'transfer', { plan: 'updown', nodes: [12, 7, 5], backing: minorProg, goal: 74, start: 42, why: 'Only some harmonics belong to a key. Playing just those, low to high and back with the backing, makes a melody out of them.', instr: HOW_N + 'Play the harmonics in the tab in order with the backing; each is in the key. Pass: up and down in time with every harmonic clear.', watch: 'Rushing the touch at the string changes.', simplify: 'Up only.' }),
          H_('hm-first-riff', 'Riff and chime: palm-muted root, harmonics answer ({key})', 'transfer', { kind: 'riff', bars: 4, backing: minorProg, goal: 76, start: 44, why: 'A palm-muted low root with harmonics ringing over the top is a classic hard-rock texture (Van Halen used harmonics inside riffs). The harmonics are notes of the key.', instr: 'Muted 8ths on the low root, then two harmonics on beats 3 and 4 that ring over the next bar. Pass: four bars in time with every harmonic clear.', watch: 'The palm still on the strings when you play the harmonics.', simplify: 'Harmonics only on beat 4.' })], ST(
          'Natural harmonics that belong to the key work as melody notes; the rest clash. Every key has at least four.',
          'This is how harmonics become music: chosen for the key.',
          ['In E minor almost every harmonic works; in keys far from the open strings only a few do.', 'Let the last harmonic ring over the bar line.']))
      ], [1, 3]),
    stage('intermediate', 'Tapped and pinch harmonics',
      'The 4th-fret harmonics, natural-harmonic melodies in the key at 90 BPM, tapped harmonics over a held triad and on a pentatonic box, pinch harmonics as accents in a palm-muted riff, called harmonics from memory, and an 8-bar harmonics study.', [
        S('hm-nodes', 'All the nodes', 'picking', 'The 4th fret; mixed nodes in a melody.', [
          H_('hm-4', 'The 4th-fret harmonics: two octaves and a major 3rd ({key})', 'accurate-reps', { free: true, nodes: [4, 5, 7], strings: [4, 3, 2, 1], goal: 84, start: 50, why: 'The 4th-fret node is the hardest natural harmonic: it is close to the nut and the target spot is small. Counting only clear ones builds the exact touch.', instr: HOW_N + 'Fret 4, then 5, then 7 on each string; pick near the bridge. Count only clear harmonics. Pass: 16 clear in a row.', watch: 'Missing the 4th fret by a few millimetres: touch right over the wire.', simplify: 'Frets 5 and 7.' }),
          H_('hm-melody-i', 'A harmonic melody in {key}: frets 12, 7, 5 and 4 mixed', 'variable', { plan: 'motif', nodes: [12, 7, 5, 4], backing: minorProg, goal: 84, start: 50, why: 'A melody that moves between all four nodes and several strings varies where the hand goes while the touch stays the same: variable practice that makes every node reliable.', instr: HOW_N + 'Three-note figures stepping up through the key’s harmonics. Pass: the whole melody in time with every note clear.', watch: 'The 4th-fret notes dropping out.', simplify: 'Leave out the 4th-fret notes.' })], ST(
          'Four nodes (12, 7, 5, 4) give four overtones per string: the octave, the 5th above it, two octaves, and the major 3rd above that.',
          'Together they cover enough notes to play melodies in most keys.',
          ['Lower nodes need a more precise touch and a pick near the bridge.', 'The 4th-fret harmonic sounds the same note as the 9th and 16th-fret ones.'])),
        S('hm-tapped', 'Tapped harmonics', 'fretting', 'Over chords and scales.', [
          H_('hm-tap-chord', 'Tapped harmonics over held triads ({key})', 'external-focus', { kind: 'tapped', goal: 84, start: 50, why: 'Tapping 12 frets above a fretted note sounds it an octave higher as a harmonic: over a held triad this gives a glassy, harp-like arpeggio Van Halen used in ballads. The ear judges the tap: it should chime, not thud.', instr: HOW_T + 'Hold the triad on the top three strings and tap each string in turn: G, B, e, B. Listen for a chime; a thud means you pressed too long or missed the fret wire. Pass: every tap chimes.', watch: 'Pressing the tap down to the fret.', simplify: 'One string.' }),
          H_('hm-tap-scale', 'Tapped harmonics on the pentatonic box, top strings ({key})', 'variable', { kind: 'tapScale', box: 1, goal: 84, start: 50, why: 'Every fretted note has a tapped harmonic 12 frets above. Walking a pentatonic box with a tapped harmonic on each note gives a scale of chimes and trains the tap at changing distances.', instr: HOW_T + 'Fret each box note on the G, B and e strings and tap 12 frets above it, up and back. Pass: every note chimes.', watch: 'Tapping at the same fret for every note: the tap moves with the fretted note.', simplify: 'The B and e strings only.' })], ST(
          'A tapped (artificial) harmonic sounds an octave above any fretted note when you tap or touch the string exactly 12 frets higher.',
          'Unlike natural harmonics, tapped harmonics work in every key and over any chord shape.',
          ['Tap 12 frets above the fretted note, on the fret wire, and bounce off.', 'Hold the fretted note firmly: the tapped harmonic is its octave.'])),
        S('hm-pinch', 'Pinch harmonics', 'picking', 'Squeals in a riff.', [
          H_('hm-pinch', 'Pinch-harmonic accents in a palm-muted riff ({key})', 'accurate-reps', { kind: 'pinch', bars: 4, goal: 86, start: 52, why: 'A pinch harmonic is picked and grazed by the thumb in one motion, and makes a single note scream. Counting only the ones that squeal builds the knack of finding the spot.', instr: HOW_P + 'Muted 8ths on the root, then two pinch harmonics on box notes of the D and G strings. Count only the ones that squeal. Pass: 8 squeals out of 10.', watch: 'Too much pick showing: the thumb can’t touch the string.', simplify: 'Pinch harmonics alone, one per beat.' }),
          H_('hm-pinch-var', 'Pinch harmonics in a new place every bar ({key})', 'variable', { kind: 'pinch', bars: 8, goal: 86, start: 52, why: 'The squeal spot moves with the note and the string. Changing note and string every bar is variable practice for finding it quickly.', instr: HOW_P + 'Eight bars, a different pinch note each bar. Adjust where you pick until each one squeals. Pass: 6 of 8 bars with both pinch harmonics clear.', watch: 'Picking in the same spot for every note.', simplify: 'Four bars.' })], ST(
          'A pinch harmonic happens when the thumb grazes the string just after the pick, at a node of the vibrating string: the fundamental is damped and a high overtone screams.',
          'It is the squeal of rock and metal lead playing, used as an accent.',
          ['Choke up on the pick so the thumb is close to the string.', 'More gain and the bridge pickup make them easier.', 'Move the picking spot until it squeals; each note has its own spot.'])),
        S('hm-recall', 'Harmonics in the key', 'fretboard', 'The key’s harmonics falling; chimes.', [
          H_('hm-called', 'The harmonics of {key}, high to low across the strings', 'variable', { plan: 'down', nodes: [12, 7, 5], goal: 84, start: 50, why: 'Only the harmonics whose notes are in the key work in a melody. Playing that set from the highest to the lowest crosses strings and nodes in a new order each time.', instr: HOW_N + 'Down through the key’s harmonics with the click. Pass: the whole run in time with every harmonic clear.', watch: 'A harmonic that is not in the key slipping in.', simplify: 'Frets 12 and 7 only.' }),
          H_('hm-mixed', 'Interleaved: chimes in {key}, then single harmonics', 'interleaving', { kind: 'chime', nodes: [12, 7, 5], reps: 2, goal: 84, start: 50, why: 'Mixing chimes (three strings) with single harmonics in the key, node by node, makes the hand change shape every time.', instr: 'Play the chimes in the tab (each in the key), alternating node and string set. Pass: every chime with all three notes ringing.', watch: 'Rolling the chime instead of striking it.', simplify: 'One chime, repeated.' })], ST(
          'A key’s harmonics are the string × node pairs whose notes belong to its scale.',
          'Knowing that set is what lets you write melodies with them.',
          ['A harmonic is in the key if its note is in the key’s scale.', 'Chimes in a key: all three notes in the scale.'])),
        S('hm-music', 'In music', 'improv', 'An 8-bar study; a riff with harmonics.', [c => hmStudyI(c),
          H_('hm-riff-i', 'Riff with the band: palm-muted root, harmonics in the key ({key})', 'transfer', { kind: 'riff', bars: 8, backing: minorProg, goal: 88, start: 52, why: 'A riff where the harmonics are part of the line, not decoration: the low root drives and the harmonics answer in the key.', instr: 'Eight bars with the backing. Pass: two times through in time with every harmonic clear.', watch: 'The harmonics coming in late.', simplify: 'Four bars.' })], ST(
          'In music, harmonics are notes of the key used for their sustain and colour.',
          'Riffs and intros use them for contrast with muted low notes.',
          ['Let harmonics ring over the next riff notes.', 'Use pinch harmonics sparingly: they are accents.']))
      ], [4, 6]),
    stage('advanced', 'Dives, harps and keys',
      'Harmonics dived and scooped with the bar, harp-style arpeggios that alternate fretted notes and tapped harmonics through a progression at 84 BPM, tapped harmonics in four keys, the key’s natural harmonics from memory, and an advanced study.', [
        S('hm-bar', 'With the bar', 'picking', 'Dives and dips.', [
          H_('hm-dive', 'Harmonic dives: natural harmonics sunk with the bar ({key})', 'variable', { free: true, nodes: [12, 7, 5], strings: [3, 2], bar: 'dive', barDepth: 12, step: 2, goal: 72, start: 44, why: 'A natural harmonic sustains long enough to be dived with the whammy bar: the classic Van Halen dive bomb. Changing the node and string each time varies the pitch you dive from.', instr: HOW_N + 'Let each harmonic ring, then push the bar down slowly over two beats (an octave down). Release before the next. Pass: every dive smooth with the harmonic still sounding at the bottom.', watch: 'Diving before the harmonic speaks.', simplify: 'Half the dive (barDepth 6 on the tab).' }),
          H_('hm-dip', 'Harmonic dips and bar vibrato in {key}', 'external-focus', { plan: 'up', nodes: [12, 7, 5], bar: 'vib', goal: 80, start: 48, backing: minorProg, why: 'A little bar vibrato on a harmonic makes it sing like a voice. Listening to the width (small, even) is what makes it musical rather than seasick.', instr: HOW_N + 'Each harmonic in the key, then gentle bar vibrato. Listen for an even, narrow wobble. Pass: every harmonic with even vibrato.', watch: 'Vibrato so wide the pitch is lost.', simplify: 'Vibrato on every second harmonic.' })], ST(
          'Harmonics sustain, so the whammy bar can bend them: dive them down an octave, or give them vibrato.',
          'This is one of Van Halen’s signature sounds.',
          ['Pick near the bridge for a strong harmonic before you dive.', 'Return the bar to pitch before the next note.'])),
        S('hm-harp', 'Harp harmonics', 'fretting', 'Fretted note, then harmonic.', [
          H_('hm-harp', 'Harp arpeggios: fretted note, tapped harmonic, through the progression ({key})', 'variable', { kind: 'harp', goal: 80, start: 46, why: 'Alternating fretted notes and tapped harmonics on a held chord gives a harp-like cascade where the octaves ring over each other (Chet Atkins’ and Lenny Breau’s "harp harmonics", in rock by Van Halen).', instr: HOW_T + 'Hold the triad; play the notes marked normal with the pick (or a finger), tap the AH notes 12 frets above. Let everything ring. Pass: each bar even, every harmonic clear.', watch: 'Fretted notes louder than the harmonics.', simplify: 'Quarter notes.' }),
          H_('hm-harp-keys', 'Harp arpeggios in four keys ({key} and up)', 'interleaving', { kind: 'harp', keys: [0, 5, 10, 3], prog: (k, c) => [nameOf(k) + (c.minor ? 'm' : '')], goal: 78, start: 46, why: 'In each key the triad moves and so do the taps. Four keys a fourth apart make you find both again each time.', instr: HOW_T + 'One bar per key. Pass: all four keys without stopping.', watch: 'Tapping at the old key’s frets.', simplify: 'Two keys.' })], ST(
          'Harp harmonics alternate a fretted note with a tapped harmonic an octave above another note of the same chord, so the notes overlap like a harp.',
          'It turns any chord shape into a shimmering arpeggio.',
          ['Hold the chord the whole bar so the notes keep ringing.', 'The harmonic is 12 frets above the fretted note on its string.'])),
        S('hm-recall-a', 'Whole key, four keys', 'fretboard', 'All the natural harmonics of a key; tapped harmonics in four keys.', [
          H_('hm-key-all', 'Every natural harmonic of {key}, frets 12, 7, 5 and 4, up and down', 'variable', { plan: 'updown', nodes: [12, 7, 5, 4], goal: 84, start: 50, why: 'The whole set of a key’s natural harmonics, low to high and back: every node, including the hard 4th fret, in one line.', instr: HOW_N + 'Up through the key’s harmonics and back down, in time. Pass: up and down with every harmonic clear.', watch: 'The 4th-fret notes dropping out.', simplify: 'Frets 12 and 7.' }),
          H_('hm-tap-keys', 'Tapped harmonics on the pentatonic in four keys ({key} and up)', 'interleaving', { kind: 'tapScale', keys: [0, 5, 10, 3], alt: true, goal: 84, start: 50, why: 'Tapped harmonics move with the fretted notes, so they work in every key. Four keys in a row, alternating fretted notes and harmonics, keep the distances fresh.', instr: HOW_T + 'Alternate a fretted note and a tapped harmonic up the box and back, in four keys. Pass: all four keys without stopping.', watch: 'Losing the 12-fret distance in the higher keys.', simplify: 'Two keys.' })], ST(
          'Each key has its own set of natural harmonics; tapped harmonics follow the fretted notes anywhere.',
          'Both maps together let you put harmonics in any key.',
          ['A key far from the open strings has few natural harmonics: use tapped ones.', 'Keys a fourth apart: E → A → D → G.'])),
        S('hm-adv-music', 'In music', 'improv', 'A study; a solo with harmonic accents.', [c => hmStudyI({ ...c, key: mod12(c.key + 5) }),
          c => targetGuide(c, { prog: c.minor ? 'minorRock' : 'axis', scale: c.minor ? 'minorPent' : 'majorPent', name: 'Solo: end each phrase on a harmonic (natural, tapped or pinch) on a chord tone' })], ST(
          'At this level harmonics are part of phrasing: the last note of a phrase, a squeal in a riff, a dive at the end.',
          'They give a solo high points and colour.',
          ['End phrases on a harmonic that is a chord tone.', 'One or two harmonics per phrase are enough.']))
      ], [7, 8]),
    stage('mastery', 'Your harmonic palette',
      'Harp arpeggios through a progression at 96 BPM, any called kind of harmonic on the spot, tapped harmonics in six keys from memory, and your own 16-bar piece.', [
        S('hm-perf', 'At performance tempo', 'fretting', 'Harps at tempo; random access.', [
          H_('hm-perf', 'Performance tempo: harp arpeggios through the progression, twice ({key})', 'edge', { kind: 'harp', reps: 2, goal: 96, start: 54, why: 'Harp arpeggios in 16ths at performance tempo: tap accuracy, a steady fretting hand and an even mix of notes and harmonics at once.', instr: HOW_T + 'Tempo ladder: +4 BPM after each clean pass. Pass: clean at the goal tempo.', watch: 'Harmonics thinning out as the tempo rises.', simplify: 'Once through.' }),
          c => hmRandom(c)], ST(
          'Mastery is reliable harmonics at speed, in any order.',
          'Live, you need the harmonic to speak the first time.',
          ['Raise the tempo only after a clean pass.', 'Change hand position for each kind before the bar line.'])),
        S('hm-recall-m', 'Every key', 'fretboard', 'Six keys; improvising.', [
          H_('hm-six-keys', 'Tapped harmonics over the tonic chord in six keys', 'interleaving', { kind: 'tapped', keys: [0, 5, 10, 3, 8, 1], prog: (k, c) => [nameOf(k) + (c.minor ? 'm' : '')], goal: 92, start: 52, why: 'Tapped harmonics work in any key because they follow the fretted chord: six keys a fourth apart move the triad and the taps every bar.', instr: HOW_T + 'One bar per key, no gap between keys. Pass: all six keys in time with every tap chiming.', watch: 'A pause at each key.', simplify: 'Three keys.' }),
          c => targetGuide(c, { prog: c.minor ? 'minorRock' : 'axis', scale: c.minor ? 'minorPent' : 'majorPent', name: 'Improvise: two choruses using harmonics as phrase endings and accents' })], ST(
          'Six keys show the model is learned; improvising shows you can choose.',
          'A palette is only useful if you can reach for it.',
          ['Name the chord before you play.', 'Use harmonics where they add colour.'])),
        S('hm-voice', 'Your own piece', 'improv', 'A capstone study, then your version.', [c => hmEtude(c),
          H_('hm-own', 'Make it yours: a riff with your own harmonic answers ({key})', 'transfer', { kind: 'riff', bars: 8, backing: minorProg, goal: 96, start: 54, minutes: 6, why: 'The tab gives a riff with harmonic answers; the lesson is to replace the answers with your own: natural, tapped or pinch, wherever they fit the key.', instr: 'Keep the palm-muted root; on beats 3 and 4 play your own harmonics (natural ones of the key, tapped or pinch). Pass: two times through in time, your answers different each time.', watch: 'Your answers copying the written ones.', simplify: 'Four bars.' })], ST(
          'The capstone combines every kind of harmonic; then you rewrite it.',
          'A technique becomes yours when you compose with it.',
          ['Learn the study four bars at a time.', 'Keep the riff, change the harmonics.']))
      ], [9, 10])
  ]
});
