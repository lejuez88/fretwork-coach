// Percussive thumb slap: fingerstyle with a drum kit built in. The picking-hand thumb plays the bass
// on the beat and slaps the bass strings on beats 2 and 4 (a muted, snare-like crack from the side of the
// thumb, the wrist turning like a key), the fingers pluck, brush or drop "piano" hits on the treble
// strings in between. The acoustic and clean-electric groove of John Mayer, and of modern percussive
// fingerstyle generally. From the slap alone to 16th-note grooves, chord embellishments, a melody on
// top, every key with a capo, performance tempo and an original accompaniment study.
//
// Concept-first (CONTENT.md): the model is
//   - GRIPS: open-chord shapes with their root string (shared with the Travis path); any key is reached
//     with a CAPO on the nearest open-shape family, and the tab shows real frets, so every pitch is real;
//   - EVENTS on a 16-slot grid (16th notes): B thumb on the root string, b thumb on the alternate bass
//     string, X the slap (side of the thumb across the bass strings: muted notes drawn as x), x a ghost
//     slap (lighter), K the index-nail brush across the top strings (the "snare" layer), P a pinch of the
//     top two strings (m and a), p one finger on the 3rd string (i), H a piano-style hit of three fingers
//     on the top three strings, E a hammer-on embellishment from a scale note into a chord tone, M a
//     melody note on the top string;
//   - PATTERNS: one bar of events (boom–slap, the basic backbeat, 16th grooves, the push, piano hits,
//     ghost slaps, walking bass, embellished, melody);
//   - PROGRESSIONS of key degrees (one chord, two chords, I–vi–IV–V, I–V–vi–IV, I–IV–V–I, i–♭VI–♭VII–V…).
// The composer `slapRun(c, spec)` builds an exercise from progression × pattern plan × key plan (capo) ×
// bars per chord × repeats; every pitched note is tagged with the pitch classes it must belong to (the
// bar's chord, or the key's scale for an embellishment's first note) for the pitch check; slaps are
// muted (no pitch).
import { OPEN, N, nameOf, make, mod12, chordInfo, S, stage, entry, M } from '../lib.js';
import { GRIPS } from './travis.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const SUFFIX = { maj: '', min: 'm', dom: '7' };
export const PROGS = {
  one: { name: 'I (one chord)', major: true, deg: [[0, 'maj']] },
  two: { name: 'I–IV', major: true, deg: [[0, 'maj'], [5, 'maj']] },
  folkAxis: { name: 'I–vi–IV–V', major: true, deg: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']] },
  ballad: { name: 'I–V–vi–IV', major: true, deg: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] },
  folk145: { name: 'I–IV–V–I', major: true, deg: [[0, 'maj'], [5, 'maj'], [7, 'maj'], [0, 'maj']] },
  soul: { name: 'I–vi–IV–I', major: true, deg: [[0, 'maj'], [9, 'min'], [5, 'maj'], [0, 'maj']] },
  ragtime: { name: 'I–VI7–II7–V7', major: true, deg: [[0, 'maj'], [9, 'dom'], [2, 'dom'], [7, 'dom']] },
  minor: { name: 'i–♭VI–♭VII–V7', major: false, deg: [[0, 'min'], [8, 'maj'], [10, 'maj'], [7, 'dom']] }
};
const SHAPE_KEYS = { major: [7, 0, 2, 9, 4], minor: [9, 4, 2] };   // G, C, D, A, E · Am, Em, Dm
const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
/** The shape key and capo that play a progression in key k with open grips (smallest capo up to 7). */
export function capoFor(k, prog) {
  const P = PROGS[prog], list = SHAPE_KEYS[P.major ? 'major' : 'minor'];
  let best = null;
  for (const sk of list) {
    const names = P.deg.map(([d, q]) => nameOf(sk + d) + SUFFIX[q]);
    if (!names.every(n => GRIPS[n])) continue;
    const capo = mod12(k - sk); if (capo > 7) continue;
    if (!best || capo < best.capo) best = { sk, capo, shapes: names };
  }
  return best;
}
function barChord(shapeName, capo, realRoot, q) {
  const g = GRIPS[shapeName], frets = g.f.map(f => (f == null ? null : f + capo));
  const real = nameOf(realRoot) + SUFFIX[q], info = chordInfo(real);
  return { real, pcs: info.pcs, frets, root: g.root, alt: g.root === 4 ? 3 : 4, walk: [g.walk[0], g.walk[1] + capo], at: s => frets[6 - s] };
}
/** Patterns: [slot (0–15, 16ths), event]. */
export const PATTERNS = {
  slap: { name: 'the slap alone on 2 and 4', ev: [[4, 'X'], [12, 'X']] },
  boom: { name: 'boom–slap (bass on 1 and 3, slap on 2 and 4)', ev: [[0, 'B'], [4, 'X'], [8, 'b'], [12, 'X']] },
  pinch: { name: 'boom–slap with pinches', ev: [[0, 'B'], [0, 'P'], [4, 'X'], [8, 'b'], [10, 'P'], [12, 'X']] },
  brush: { name: 'slap + index brush (the snare)', ev: [[0, 'B'], [4, 'X'], [4, 'K'], [8, 'b'], [12, 'X'], [12, 'K']] },
  basic: { name: 'the basic backbeat (fingers on the off-beats)', ev: [[0, 'B'], [2, 'P'], [4, 'X'], [6, 'p'], [8, 'b'], [10, 'P'], [12, 'X'], [14, 'p']] },
  sixteenth: { name: '16th-note groove', ev: [[0, 'B'], [3, 'p'], [4, 'X'], [6, 'P'], [8, 'b'], [11, 'p'], [12, 'X'], [14, 'P']] },
  ghost: { name: 'ghost slaps', ev: [[0, 'B'], [2, 'P'], [4, 'X'], [7, 'x'], [8, 'b'], [10, 'P'], [12, 'X'], [15, 'x']] },
  push: { name: 'the push (anticipating beat 3)', ev: [[0, 'B'], [3, 'P'], [4, 'X'], [7, 'b'], [10, 'p'], [12, 'X'], [14, 'P']] },
  piano: { name: 'piano hits (R&B)', ev: [[0, 'B'], [2, 'H'], [4, 'X'], [6, 'H'], [8, 'b'], [10, 'H'], [12, 'X'], [14, 'H']] },
  walk: { name: 'walking bass under the slap', walk: true, ev: [[0, 'B'], [2, 'P'], [4, 'X'], [8, 'b'], [10, 'P'], [12, 'X'], [14, 'p']] },
  hammer: { name: 'hammer-on embellishments', ev: [[0, 'B'], [2, 'E'], [4, 'X'], [6, 'p'], [8, 'b'], [10, 'P'], [12, 'X'], [14, 'E']] },
  melody: { name: 'a melody on the top string', ev: [[0, 'B'], [2, 'M'], [4, 'X'], [6, 'M'], [8, 'b'], [10, 'M'], [12, 'X'], [14, 'M']] }
};
const SIXTEENTHS = new Set(['sixteenth', 'ghost', 'push']);
/** The top-string melody tones of a bar: chord tones on the 1st string within five frets of the capo. */
function melodyTones(ch, capo) { const out = []; for (let f = capo; f <= capo + 5; f++) if (ch.pcs.includes(mod12(OPEN[1] + f))) out.push(f); return out.length ? out : [ch.at(1)]; }

/* ------------------------------- The composer ------------------------------- */
/**
 * spec: { id, name, method, prog, patterns (cycled per bar), keys (key offsets, one block each),
 * barsPerChord, reps, why, instr, watch, simplify, goal, start, dl, minutes }. '{prog}', '{chords}',
 * '{capo}', '{keys}' and '{patterns}' in the text are filled in.
 */
export function slapRun(c, spec) {
  const progs = spec.progs || [spec.prog || 'folkAxis'], prog = progs[0], P = PROGS[prog];
  const k0 = P.major ? mod12(c.key - (c.minor ? -3 : 0)) : mod12(c.key - (c.minor ? 0 : 3));
  const pats = (spec.patterns || ['basic']).map(p => ({ id: p, ...PATTERNS[p] }));
  const notes = [], chordsUsed = [], voicings = [], capos = [], keyNames = [];
  let bar = 0;
  for (const off of spec.keys || [0]) for (const pr of progs) {
    const P = PROGS[pr], k = mod12(k0 + off), cp = capoFor(k, pr); if (!cp) return null;
    capos.push(`${nameOf(k)}${P.major ? '' : 'm'}: capo ${cp.capo || 'none'} (${[...new Set(cp.shapes)].join(', ')} shapes)`); keyNames.push(`${nameOf(k)}${P.major ? '' : 'm'}`);
    const sc = SCALE[P.major ? 'major' : 'minor'].map(x => mod12(k + x));
    for (let rep = 0; rep < (spec.reps || 1); rep++) P.deg.forEach(([d, q], ci) => {
      const ch = barChord(cp.shapes[ci], cp.capo, k + d, q);
      if (!voicings.find(v => v.name === ch.real)) voicings.push({ name: ch.real, frets: ch.frets.slice() });
      for (let bb = 0; bb < (spec.barsPerChord || 1); bb++) {
        const pat = pats[bar % pats.length], T = bar * 4, first = bar === 0; chordsUsed.push(ch.real);
        const mel = melodyTones(ch, cp.capo); let mi = 0;
        pat.ev.forEach(([slot, ev]) => {
          const t = T + slot / 4, d = 0.5;
          const fing = x => (first ? { fing: x } : {});
          if (ev === 'B' || ev === 'b') {
            const s = ev === 'B' ? ch.root : pat.walk ? ch.walk[0] : ch.alt, f = ev === 'b' && pat.walk ? ch.walk[1] : ch.at(s);
            notes.push(tag(N(s, f, t, 1, null, fing('p')), ch.pcs));
          } else if (ev === 'X' || ev === 'x') {
            [ch.root, ch.root - 1, ch.root - 2].forEach(s => notes.push(N(s, ch.at(s) != null ? ch.at(s) : cp.capo, t, 0.25, ev === 'X' ? 'mute' : 'ghost', { chord: true, ...(ev === 'X' ? fing('p') : {}) })));
            if (ev === 'x') notes.slice(-3).forEach(n => ALLOW.set(n, ch.pcs));
          } else if (ev === 'K') {
            [3, 2, 1].forEach(s => notes.push(tag(N(s, ch.at(s), t, 0.25, null, { chord: true, ...fing('i') }), ch.pcs)));
          } else if (ev === 'P') {
            [[2, 'm'], [1, 'a']].forEach(([s, r]) => notes.push(tag(N(s, ch.at(s), t, d, null, { chord: true, ...fing(r) }), ch.pcs)));
          } else if (ev === 'p') {
            notes.push(tag(N(3, ch.at(3), t, d, null, fing('i')), ch.pcs));
          } else if (ev === 'H') {
            [[3, 'i'], [2, 'm'], [1, 'a']].forEach(([s, r]) => notes.push(tag(N(s, ch.at(s), t, 0.25, null, { chord: true, ...fing(r) }), ch.pcs)));
          } else if (ev === 'M') {
            const f = mel[(mi++ + bar) % mel.length]; notes.push(tag(N(1, f, t, d, null, fing('a')), ch.pcs));
          } else if (ev === 'E') {
            // a hammer-on into a chord tone from the scale note one or two frets below (strings 2, 3, then 1)
            for (const s of [2, 3, 1]) {
              const f = ch.at(s); const lo = [2, 1].map(x => f - x).find(x => x >= cp.capo && sc.includes(mod12(OPEN[s] + x)) && !ch.pcs.includes(mod12(OPEN[s] + x)));
              if (lo == null) continue;
              notes.push(tag(N(s, lo, t, 0.25, null, fing('m')), sc)); notes.push(tag(N(s, f, t + 0.25, 0.25, 'h'), ch.pcs)); return;
            }
            notes.push(tag(N(2, ch.at(2), t, d, null, fing('m')), ch.pcs));
          }
        });
        bar++;
      }
    });
  }
  if (notes.length < 3) return null;
  // notes struck together carry {chord: true}
  const by = new Map(); notes.forEach(n => by.set(n.t, (by.get(n.t) || 0) + 1)); notes.forEach(n => { if (by.get(n.t) > 1) n.chord = true; else delete n.chord; });
  const fill = s => String(s || '').replace('{prog}', progs.map(x => PROGS[x].name).join(', ')).replace('{chords}', chordsUsed.slice(0, 8).join(' – ')).replace('{capo}', [...new Set(capos)].join('; ')).replace('{keys}', [...new Set(keyNames)].join(', ')).replace('{patterns}', [...new Set(pats.map(p => p.name))].join(', '));
  return make(c, {
    id: spec.id, name: fill(spec.name), domain: spec.domain || 'rhythm', method: spec.method, unit: pats.some(p => SIXTEENTHS.has(p.id)) ? '16th notes' : '8th notes', goal: spec.goal || 90, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'fingers',
    backing: chordsUsed.slice(0, 16), chords: [...new Set(chordsUsed)].slice(0, 8), voicings: voicings.slice(0, 12),
    why: fill(spec.why), instr: fill(spec.instr), watch: spec.watch, simplify: spec.simplify, tab: { notes }
  });
}
const T_ = (id, name, method, opts) => c => slapRun(c, { id, name, method, ...opts });
const SLAP = 'The slap: the side of the thumb (just above the knuckle), parallel to the strings, drops onto the bass strings and stays there, so they crack and go dead (the x’s). The power comes from turning the wrist toward you like a key, not from the arm. ';

/* ------------------------------ Generators ------------------------------ */
/** The app plays one bar of a pattern, then a silent bar: play it back (hear it first). */
export function slapEcho(c) {
  const order = ['boom', 'basic', 'brush', 'pinch'], plan = [];
  const x = slapRun(c, { id: 'ts-echo', prog: 'one', name: 'x', patterns: ['boom'], barsPerChord: 1 }); if (!x) return null;
  const notes = [];
  order.forEach((p, i) => {
    const y = slapRun(c, { id: 'y', prog: 'one', name: 'y', patterns: [p] }); plan.push(PATTERNS[p].name);
    y.tab.notes.forEach(n => { const m = { ...n, t: +(n.t + i * 8).toFixed(4) }; delete m.fing; if (ALLOW.get(n)) ALLOW.set(m, ALLOW.get(n)); notes.push(m); });
  });
  return make(c, {
    id: 'ts-echo', name: `Hear it, play it back: four slap grooves on ${x.chords[0]}`, domain: 'ear', method: 'audiation', unit: '8th notes', goal: 84, start: 56, minutes: 4, picking: 'fingers',
    backing: x.chords, chords: x.chords, voicings: x.voicings,
    why: 'A groove is a sound before it is a motion: bass, crack, plucks. Hearing one bar and answering it in the silent bar builds the groove by ear, the way drummers learn.',
    instr: `Cover the tab. Each groove plays for one bar, then one bar is silent: play it back in that bar. The grooves: ${plan.join(' → ')}. Pass: all four echoed in time, twice.`,
    watch: 'Answering late: the echo starts exactly on the next bar line.', simplify: 'Echo only the bass and the slaps.', tab: { notes }
  });
}
/** An original 16-bar accompaniment study (capstone). */
export function slapEtude(c) {
  const parts = [
    { prog: 'ballad', patterns: ['basic'] }, { prog: 'ballad', patterns: ['hammer', 'basic'] },
    { prog: 'soul', patterns: ['piano', 'piano', 'sixteenth', 'ghost'] }, { prog: 'ballad', patterns: ['melody', 'melody', 'push', 'boom'] }];
  const notes = [], backing = [], voicings = []; let off = 0;
  for (const p of parts) {
    const x = slapRun(c, { id: 'x', name: 'x', ...p }); if (!x) return null;
    x.tab.notes.forEach(n => { const m = { ...n, t: +(n.t + off).toFixed(4) }; if (ALLOW.get(n)) ALLOW.set(m, ALLOW.get(n)); notes.push(m); });
    backing.push(...x.backing); x.voicings.forEach(v => { if (!voicings.find(w => w.name === v.name)) voicings.push(v); }); off += 16;
  }
  return make(c, {
    id: 'ts-etude', name: `Capstone study: a 16-bar slap-groove accompaniment (${backing[0]} and its key)`, domain: 'rhythm', method: 'transfer', unit: '8th and 16th notes', goal: 88, start: 52, minutes: 8, picking: 'fingers',
    backing, chords: [...new Set(backing)].slice(0, 8), voicings: voicings.slice(0, 12),
    why: 'An original accompaniment that uses the whole path, as a verse, a pre-chorus, a bridge and a last line: the basic backbeat, hammer-on embellishments, piano hits and 16th ghost slaps, a melody on top, the push and a plain boom–slap ending.',
    instr: 'Learn it four bars at a time (each block has its own pattern plan), then join them. Keep the slaps on 2 and 4 the whole way through: they are the drummer. Then rewrite the last 8 bars with your own pattern plan and sing or hum a melody over it. Pass: the 16 bars at the goal tempo without dropping a slap, then your own version once.',
    watch: 'The groove speeding up in the 16th-note bars.', simplify: 'Bars 1–8.', tab: { notes }
  });
}

/* --------------------------------- The path --------------------------------- */
const ST = (concept, why, theory) => ({ concept, why, theory });
export default entry({
  id: 'thumbSlap', kind: 'technique', title: 'Percussive thumb slap (fingerstyle backbeat)', domain: 'rhythm',
  re: /thumb ?slap|slap (rhythm|guitar|groove)|percussive (fingerstyle|acoustic|guitar|thumb)|fingerstyle backbeat|slap.?(and|n).?pluck/,
  aliases: ['percussive fingerstyle', 'percussive acoustic guitar', 'thumb slap', 'slap rhythm'],
  summary: 'The picking-hand thumb plays the bass and slaps the bass strings on 2 and 4 like a snare, while the fingers pluck, brush and drop piano hits in between: from the slap alone to 16th-note grooves, embellishments, a melody on top, every key with a capo, to an original accompaniment.',
  prereqs: ['travis'],
  sources: ['https://www.premierguitar.com/lessons/acoustic-lessons/acoustic-john-mayer', 'https://www.dummies.com/article/academics-the-arts/music/instruments/guitar/how-to-incorporate-slap-rhythm-into-your-guitar-playing-143506', 'https://www.guitarworld.com/lessons/john-mayer-12-playing-tips', 'https://www.musicradar.com/how-to/how-to-play-percussive-acoustic-guitar'],
  ctx: { key: 7, minor: false, prog: 'folkAxis' },
  stages: [
    stage('foundations', 'Bass and slap',
      'Slap beats 2 and 4 cleanly for 8 bars, play boom–slap (thumb bass on 1 and 3) over two chords at 80 BPM, add pinches and an index brush, play the basic backbeat over I–vi–IV–V for 8 bars without a dropped slap, echo grooves by ear and play a named pattern from memory.', [
        S('ts-slap', 'The slap', 'rhythm', 'The slap alone, then bass and slap.', [
          T_('ts-slap-only', 'The slap alone: beats 2 and 4 on {chords}', 'chunking', { prog: 'one', patterns: ['slap'], reps: 4, goal: 84, start: 50, why: 'The slap is the snare drum of the groove. Before anything else is added, it has to crack the same way every time, exactly on 2 and 4.', instr: SLAP + 'Hold the chord, count “1 2 3 4” and slap only on 2 and 4. Let the thumb rest on the strings after each slap so they stay dead. Pass: 8 bars where every slap sounds the same, with no ringing note.', watch: 'Hitting with the tip of the thumb or the nail: use the side of the thumb, flat.', simplify: 'Slap on beat 4 only.' }),
          T_('ts-boom-slap', 'Boom–slap: thumb bass on 1 and 3, slap on 2 and 4, over {chords}', 'accurate-reps', { prog: 'two', patterns: ['boom'], reps: 2, goal: 90, start: 52, why: 'Boom–slap is the whole drum kit in one thumb: a bass note as the kick on 1 and 3, the slap as the snare on 2 and 4. Counting only clean bars builds a reliable thumb.', instr: SLAP + 'Beat 1: thumb plucks the root. Beat 2: slap. Beat 3: thumb plucks the other bass string. Beat 4: slap. Count only the clean bars. Pass: 8 clean bars in a row.', watch: 'The slap killing the bass note too early: pluck, let it ring a beat, then slap.', simplify: 'Half tempo, one chord.' })],
          ST('In a slap groove the thumb does two jobs: it plucks the bass on the beat (the kick drum) and slaps the bass strings on 2 and 4 (the snare). The slap is a muted crack, not a note.', 'With bass and backbeat in one hand, a single guitar sounds like a band: the basis of John Mayer’s acoustic playing and of modern percussive fingerstyle.', ['Slap with the side of the thumb just above the knuckle, parallel to the strings.', 'Turn the wrist toward you like a key; the arm stays still.', 'After the slap the thumb rests on the strings so they stay dead.'])),
        S('ts-fingers', 'Add the fingers', 'picking', 'Pinches, the brush, then the basic backbeat.', [
          T_('ts-pinch', 'Boom–slap with pinches: m and a pluck the top two strings with the bass ({chords})', 'chunking', { prog: 'two', patterns: ['pinch'], reps: 2, goal: 88, start: 50, why: 'Adding the fingers one event at a time keeps the thumb steady: a pinch with the first bass note and one plucked chord on the “and” of 3.', instr: 'First the boom–slap alone for two bars, then add the pinch on beat 1 (m on the B string, a on the high e, with the thumb), then the pluck on the “and” of 3. Pass: 8 bars with the slaps still on 2 and 4.', watch: 'The thumb waiting for the fingers: the thumb’s pattern never changes.', simplify: 'Only the pinch on beat 1.' }),
          T_('ts-brush', 'The snare layer: slap and an index-nail brush together on 2 and 4 ({chords})', 'external-focus', { prog: 'two', patterns: ['brush'], reps: 2, goal: 88, start: 50, why: 'Brushing the top strings with the index nail at the moment of the slap adds the bright “sizzle” of a snare. The aim is a sound: one combined crack, not two hits.', instr: SLAP + 'On 2 and 4 the thumb slaps and the index nail flicks down across the top three strings at the same instant. Listen: it should sound like one snare hit. Pass: 8 bars where the slap and brush are one sound.', watch: 'The brush arriving a moment after the slap (a flam).', simplify: 'The slap alone, then add the brush on beat 4 only.' }),
          T_('ts-basic', 'The basic backbeat over {prog}: bass on 1 and 3, slap on 2 and 4, fingers on the off-beats', 'accurate-reps', { prog: 'folkAxis', patterns: ['basic'], reps: 2, goal: 92, start: 54, why: 'The basic backbeat is the pattern everything else grows from: kick, snare, and the fingers filling the off-beats with the chord.', instr: SLAP + 'Bass on 1 and 3, slap on 2 and 4, a pinch (m+a) on the “and” of 1 and 3, the index on the G string on the “and” of 2 and 4. Count only clean bars. Pass: 8 clean bars over the four chords.', watch: 'Fingers getting louder than the slap: the slap is the loudest event in the bar.', simplify: 'Leave out the index on the G string.' })],
          ST('The fingers fill the gaps the thumb leaves: pinches with the bass, single plucks on the off-beats, a nail brush on the slap.', 'Separating the thumb (bass and drums) from the fingers (harmony) is what makes the groove sound like several players.', ['m and a pluck the B and high e; i plucks the G.', 'The brush is a downward flick of the index nail across the top strings.'])),
        S('ts-know', 'Hear it, recall it', 'ear', 'Echo grooves by ear; play named patterns from memory.', [c => slapEcho(c),
          T_('ts-recall', 'From memory: boom–slap, pinches, brush, backbeat, one bar each over {chords}', 'retrieval', { prog: 'folkAxis', patterns: ['boom', 'pinch', 'brush', 'basic'], goal: 88, start: 50, why: 'Recalling a pattern from its name, not from the tab, is what lets you switch grooves in a song.', instr: 'Cover the tab. One bar each: boom–slap, pinches, brush, basic backbeat, one per chord. Say the next pattern’s name on beat 4. Pass: twice through from memory with no dropped slap.', watch: 'Peeking at the tab between bars.', simplify: 'Two patterns: boom–slap and basic.' })],
          ST('Each pattern has a sound and a name; hearing and recalling them ties the two together.', 'Accompanying a singer means switching patterns on cue, without reading.', ['Every pattern keeps the slaps on 2 and 4.'])),
        S('ts-first-music', 'First music', 'rhythm', 'A song-style groove.', [
          T_('ts-first-groove', 'First groove: the basic backbeat over {prog}, twice through ({keys})', 'transfer', { prog: 'ballad', patterns: ['basic'], reps: 2, goal: 90, start: 54, why: 'The I–V–vi–IV progression is behind countless pop songs. With the slap backbeat under it, one guitar carries the whole song.', instr: 'The basic backbeat, one chord per bar, twice through. Hum or sing any melody you know over it. Pass: 8 bars in time while humming, with the slaps steady.', watch: 'The groove stopping when the voice comes in.', simplify: 'Boom–slap only.' }),
          M('transfer', ['percussiveGroove', {}])],
          ST('A groove becomes music when something sits on top of it: a voice, a melody, another player.', 'Mayer’s acoustic songs are built on exactly this: a self-contained groove a voice can ride on.', ['Keep the slaps steady while singing: that is the test of an automatic groove.']))
      ], [1, 3]),
    stage('intermediate', 'Grooves, colours and keys',
      'Play the 16th-note groove and ghost slaps at 90 BPM, switch patterns every bar, add hammer-on embellishments and piano hits, change progression and key (with a capo) without stopping, name the capo for a key from memory, and accompany a verse and chorus with a melody on top.', [
        S('ts-16', '16th-note grooves', 'rhythm', 'Syncopated plucks, ghost slaps, patterns mixed.', [
          T_('ts-sixteenth', 'The 16th-note groove over {prog}: plucks on the “e” and the “a”', 'accurate-reps', { prog: 'folkAxis', patterns: ['sixteenth'], reps: 2, goal: 84, why: 'Moving the finger plucks onto 16th-note off-beats makes the groove funky and urgent while the thumb’s kick and snare stay where they are.', instr: 'Count “1 e & a”. Bass on 1 and 3, slap on 2 and 4, the index on the “a” of 1 and 3, the pinch on the “&” of 2 and 4. Count only clean bars. Pass: 8 clean bars.', watch: 'The 16th plucks drifting onto the beat.', simplify: 'Count it aloud at half tempo first.' }),
          T_('ts-ghost', 'Ghost slaps: a lighter slap on the last 16th before 3 and before 1 ({prog})', 'external-focus', { prog: 'folkAxis', patterns: ['ghost'], reps: 2, goal: 84, why: 'A drummer’s ghost notes are quieter hits between the backbeats. Two volumes of slap (full on 2 and 4, a light ghost just before 3 and before the next bar) make the groove breathe; the aim is the contrast you hear.', instr: SLAP + 'Full slaps on 2 and 4; ghost slaps (drawn small) are the same motion with half the weight. Listen for two clear volumes. Pass: 8 bars where the ghosts stay quieter than the backbeats.', watch: 'Ghosts as loud as the backbeat.', simplify: 'Only the ghost before beat 3.' }),
          T_('ts-mix', 'A new pattern every bar: basic, 16ths, brush, ghost ({prog})', 'interleaving', { prog: 'folkAxis', patterns: ['basic', 'sixteenth', 'brush', 'ghost'], reps: 2, goal: 84, why: 'Changing the pattern every bar while the kick and snare stay put trains the fingers to choose, not to repeat.', instr: 'One pattern per bar in the order shown, twice through. Say the next pattern on beat 4. Pass: twice through without a dropped slap or a wrong pattern.', watch: 'Carrying the last bar’s pattern into the next.', simplify: 'Alternate only basic and 16ths.' })],
          ST('In 16ths the fingers can sit on the “e” and “a” while the thumb keeps the beat: syncopation over a steady kick and snare.', 'This is where the groove starts to feel like R&B and funk rather than folk.', ['Count “1 e & a 2 e & a…”.', 'Ghost slaps: same motion, half the weight.'])),
        S('ts-color', 'Colour in the chords', 'fretting', 'Hammer-on embellishments and piano hits.', [
          T_('ts-hammer', 'Hammer-on embellishments inside the groove over {prog}', 'variable', { prog: 'ballad', patterns: ['hammer', 'basic'], reps: 2, goal: 84, why: 'A hammer-on from a scale note into a chord tone (sus2 or sus4 into the chord, for example) adds a melodic flicker to the chord without stopping the groove: a soul and Mayer habit.', instr: 'Bars alternate: the embellished pattern (a hammer-on on the “&” of 1 and of 4, from a scale note a step below into the chord tone), then the basic backbeat. Keep the slaps on 2 and 4. Pass: twice through with every hammer-on ringing.', watch: 'A weak hammer-on: it must ring as loud as a plucked note.', simplify: 'Only the first hammer-on of each bar.' }),
          T_('ts-piano', 'Piano hits: three fingers drop on the top strings between the slaps ({prog})', 'variable', { prog: 'soul', patterns: ['piano'], reps: 2, goal: 84, why: 'Dropping three fingers on the top strings at once gives a short, percussive chord, like a piano comping: the fuller, R&B version of the groove.', instr: SLAP + 'Bass on 1 and 3, slap on 2 and 4, a three-finger hit on every “&”. Keep the hits short: the fingers land and stop the strings again. Pass: 8 bars with short, even hits.', watch: 'Hits that ring on into the slap.', simplify: 'Hits on the “&” of 1 and 3 only.' })],
          ST('Embellishments decorate a chord from inside: a hammer-on from the 2nd or 4th into the 3rd, or a piano-style hit of the top three strings.', 'They make an accompaniment sound arranged rather than strummed.', ['A hammer-on from a scale note one or two frets below a chord tone resolves into the chord.', 'Piano hits are short: land and mute.'])),
        S('ts-changes', 'Progressions and keys', 'fretboard', 'Three progressions; three keys with a capo; the capo from memory.', [
          T_('ts-progs', 'Three progressions in a row: {prog} ({keys})', 'variable', { progs: ['folkAxis', 'folk145', 'soul'], patterns: ['basic'], reps: 1, goal: 88, why: 'The same groove over different chord changes: the thumb has to find each new root string at once.', instr: 'One bar per chord, the three progressions back to back ({chords}). Watch where the root string changes (6th, 5th or 4th). Pass: twice through with every bass note on the right string.', watch: 'Thumbing the 6th string on a C- or D-shape chord.', simplify: 'Two chords.' }),
          T_('ts-keys', 'Three keys with a capo, one progression each: {capo}', 'interleaving', { prog: 'folkAxis', patterns: ['basic'], keys: [0, 2, 5], goal: 84, dl: 1, why: 'With a capo the open shapes play in any key. Switching keys every four bars means switching shape families, while the groove stays the same.', instr: 'Four bars per key; move the capo (or imagine it) as the plan says: {capo}. Pass: all three keys in time, then name the capo for each key without looking.', watch: 'Stopping when the shapes change.', simplify: 'Two keys.' }),
          T_('ts-capo-recall', 'From memory: the capo and shapes for G, A and D, with the groove ({keys})', 'retrieval', { prog: 'ballad', patterns: ['boom', 'basic'], keys: [0, 2, 7], goal: 84, why: 'Knowing which capo and shapes give a key is what lets you accompany a singer in their key on the spot.', instr: 'Before each block say the capo and the shapes ({capo}), then play four bars. Cover the tab. Pass: all three keys named and played without a wrong chord.', watch: 'Guessing the capo: count up from the shape key.', simplify: 'One key.' })],
          ST('Open shapes plus a capo reach every key: G, C, D, A and E shapes cover them all with a capo at fret 7 or lower.', 'Singers choose keys for their voice; the guitarist follows with a capo.', ['Capo fret = semitones from the shape key to the real key.', 'The root string moves: E and G shapes on 6, C and A shapes on 5, D shape on 4.'])),
        S('ts-music-i', 'In a song', 'rhythm', 'A verse and a chorus; a melody on top.', [
          T_('ts-verse-chorus', 'Verse and chorus: the basic backbeat, then 16ths and piano hits ({prog})', 'transfer', { prog: 'ballad', patterns: ['basic', 'basic', 'basic', 'basic', 'sixteenth', 'piano', 'sixteenth', 'piano'], reps: 2, goal: 84, why: 'A song needs contrast: a simpler groove in the verse, a busier one in the chorus, with the same kick and snare under both.', instr: 'Bars 1–4 the basic backbeat (verse), bars 5–8 alternating 16ths and piano hits (chorus). Hum a melody. Pass: twice through in time, with the chorus clearly bigger.', watch: 'Speeding up into the chorus.', simplify: 'Basic backbeat throughout.' }),
          T_('ts-melody', 'A melody on the top string over the groove ({prog})', 'transfer', { prog: 'folkAxis', patterns: ['melody'], reps: 2, goal: 80, why: 'The ring finger plays a simple melody of chord tones on the high e while the thumb keeps bass and slap: accompaniment and tune in one part.', instr: SLAP + 'Melody notes (ring finger, high e) on every “&”, chord tones of each bar near the capo. Then change the melody notes yourself. Pass: 8 bars in time, then 8 with your own melody.', watch: 'The melody pulling the slaps off the beat.', simplify: 'Melody notes on the “&” of 1 and 3 only.' })],
          ST('Grooves become songs through form (verse and chorus) and through a melody on top.', 'This is the self-accompanied singer-songwriter sound.', ['Make the chorus bigger by adding events, not by playing harder.']))
      ], [4, 6]),
    stage('advanced', 'Push, walk and minor',
      'Play the push groove and a random pattern every bar at 96 BPM, a walking bass under the slap, the groove over a minor progression, four keys called from memory, a verse–chorus with clear dynamics, and a 16-bar song form with a melody.', [
        S('ts-adv-groove', 'Syncopation', 'rhythm', 'The push; a random pattern every bar.', [
          T_('ts-push', 'The push: the bass anticipates beat 3 ({prog})', 'variable', { prog: 'folkAxis', patterns: ['push', 'sixteenth'], reps: 2, goal: 90, why: 'Moving the second bass note a 16th early (the push) makes the groove lean forward, a soul and pop rhythm trick. The slap still lands exactly on 2 and 4.', instr: 'Bars alternate the push and the 16th groove. The second bass note comes on the “a” of 2, just before beat 3. Pass: twice through with the slaps exactly on 2 and 4.', watch: 'The slap on 4 moving with the push.', simplify: 'Only the push bars, slowly.' }),
          T_('ts-random-pats', 'A different pattern every bar, eight patterns ({prog})', 'interleaving', { prog: 'folkAxis', patterns: ['ghost', 'piano', 'push', 'brush', 'hammer', 'sixteenth', 'basic', 'melody'], reps: 2, goal: 88, why: 'Eight patterns in a row, each for one bar: the fingers must switch instantly while the kick and snare never move.', instr: 'Read only the pattern names (in the order given) and play each for one bar. Pass: all eight bars twice without a dropped slap.', watch: 'Hesitating at the bar line.', simplify: 'The first four bars.' })],
          ST('Syncopation moves the fingers or the bass off the beat while the backbeat stays fixed.', 'The fixed backbeat is what makes the syncopation feel good rather than wrong.', ['The push lands a 16th before the beat it replaces.'])),
        S('ts-adv-bass', 'Bass lines and minor keys', 'fretboard', 'A walking bass; a minor progression.', [
          T_('ts-walk', 'A walking bass under the slap over {prog}', 'variable', { prog: 'folk145', patterns: ['walk', 'basic'], reps: 2, goal: 88, why: 'Replacing the second bass note with a note on another string (the chord’s 3rd or 5th) makes the bass line move like a bass player’s, under the same slap.', instr: 'In the walking bars the thumb’s beat-3 note moves to another bass string (as written); the slaps stay on 2 and 4. Pass: twice through with the walk clean.', watch: 'The walking note landing on the slap string.', simplify: 'Walk only in bar 1.' }),
          T_('ts-minor', 'The groove in a minor key: {prog} ({keys})', 'variable', { prog: 'minor', patterns: ['basic', 'ghost'], reps: 2, goal: 88, why: 'In a minor key the groove sounds darker and more urgent; the shapes (Am, Em, Dm families) and the V7 chord change the thumb’s strings.', instr: 'Basic and ghost bars alternating over i–♭VI–♭VII–V7. Pass: twice through clean.', watch: 'The V7 chord’s bass string.', simplify: 'Basic backbeat throughout.' })],
          ST('A walking bass moves the thumb’s second note to the chord’s 3rd or 5th on another string; a minor key brings new shapes.', 'Both make the groove serve more songs.', ['In minor, the V is usually a dominant 7th (E7 in A minor).'])),
        S('ts-adv-recall', 'Keys and dynamics', 'fretboard', 'Four keys from memory; verse soft, chorus loud.', [
          T_('ts-keys-called', 'Four keys called from memory: {keys}', 'retrieval', { prog: 'ballad', patterns: ['sixteenth'], keys: [0, 3, 5, 9], goal: 84, why: 'Finding the capo and shapes for a called key, and keeping a 16th groove going while you do it, is the real skill of accompanying.', instr: 'Cover the tab. Before each block: say the capo and shapes ({capo}), then four bars. Pass: all four keys named and played.', watch: 'Reaching for the wrong shape family.', simplify: 'Two keys.' }),
          T_('ts-dynamics', 'Dynamics: a quiet verse, a loud chorus, the same groove ({prog})', 'external-focus', { prog: 'folkAxis', patterns: ['basic'], reps: 2, goal: 84, why: 'The groove has to work at a whisper and at full force. The goal is a clear difference you can hear, with the slap still the loudest event.', instr: 'First four bars at a whisper, last four as loud as you can play cleanly. Listen: the balance between bass, slap and fingers should stay the same at both volumes. Pass: twice through with a clear jump in volume.', watch: 'The slap disappearing when you play softly.', simplify: 'Two bars quiet, two loud.' })],
          ST('Accompaniment changes key and volume with the song; the groove must survive both.', 'A quiet verse makes the chorus land.', ['Keep the balance: slap loudest, then bass, then fingers.'])),
        S('ts-adv-music', 'In a song', 'rhythm', 'A 16-bar form; a ragtime groove.', [
          T_('ts-form16', 'A 16-bar song form: verse, verse, chorus with melody ({prog})', 'transfer', { prog: 'ballad', patterns: ['basic', 'hammer', 'basic', 'push', 'basic', 'hammer', 'basic', 'push', 'melody', 'piano', 'melody', 'piano', 'melody', 'sixteenth', 'melody', 'boom'], reps: 4, goal: 86, why: 'A whole song form: eight bars of verse with embellishments and pushes, then a chorus with the melody on top and piano hits, ending on plain boom–slap.', instr: 'Learn it in four-bar blocks. Then hum the melody of a song you know over it. Pass: all 16 bars in time.', watch: 'Losing the form in the chorus.', simplify: 'The verse only.' }),
          T_('ts-ragtime', 'A ragtime groove: {prog} under the slap', 'transfer', { prog: 'ragtime', patterns: ['basic', 'ghost'], reps: 2, goal: 86, why: 'The ragtime progression (I–VI7–II7–V7) moves around the circle of fifths; with the slap under it it sounds like modern folk-pop.', instr: 'Basic and ghost bars alternating. Pass: twice through in time.', watch: 'The dominant 7th shapes’ bass strings.', simplify: 'Basic backbeat throughout.' })],
          ST('Song forms are blocks of grooves; ragtime changes test the bass hand.', 'Real songs ask for both.', ['Plan the form before you play it.']))
      ], [7, 8]),
    stage('mastery', 'At tempo, anywhere, your own',
      'Play the 16th-note and piano grooves at about 105 BPM, a random pattern every bar in a new key every block, six keys from memory, and perform your own 16-bar accompaniment built on the path.', [
        S('ts-perf', 'Performance tempo', 'rhythm', 'Fast grooves that stay relaxed.', [
          T_('ts-fast', 'The 16th groove and ghost slaps at performance tempo ({prog})', 'edge', { prog: 'folkAxis', patterns: ['sixteenth', 'ghost'], reps: 2, goal: 96, start: 60, why: 'At tempo the wrist has to stay loose: the slap power comes from the turn of the wrist, not from tension. Climb the tempo ladder.', instr: 'Start at the start tempo and add a few BPM after every clean pass. Pass: two clean passes at the goal tempo.', watch: 'Forearm tension: shake out between passes.', simplify: 'Basic backbeat.' }),
          T_('ts-fast-piano', 'Piano hits and pushes at performance tempo ({prog})', 'edge', { prog: 'soul', patterns: ['piano', 'push'], reps: 2, goal: 96, start: 60, why: 'The R&B version at speed: short hits and anticipations, with the backbeat locked.', instr: 'Tempo ladder to the goal. Pass: two clean passes at the goal tempo.', watch: 'Hits getting long as the tempo rises.', simplify: 'Piano bars only.' })],
          ST('Performance tempo is reached in small steps, on a motion that stays relaxed.', 'A tense slap gets louder and slower; a loose one gets faster.', ['Add 3–5 BPM after two clean passes.'])),
        S('ts-anywhere', 'Any key, any groove', 'fretboard', 'No warning.', [
          T_('ts-random', 'Random access: a different groove every bar, a new key every block', 'interleaving', { prog: 'folkAxis', patterns: ['push', 'ghost', 'piano', 'hammer', 'melody', 'sixteenth', 'brush'], keys: [0, 5, 2, 9], goal: 92, why: 'At mastery level any groove should come out in any key on demand.', instr: 'A new key every four bars ({capo}); the groove changes every bar. Read only the names. Pass: all 16 bars at the goal tempo.', watch: 'Stopping at a key change.', simplify: 'Two keys.' }),
          T_('ts-six-keys', 'Six keys from memory, one progression each ({keys})', 'retrieval', { prog: 'ballad', patterns: ['basic'], keys: [0, 2, 4, 5, 7, 9], goal: 92, why: 'Every common singing key, capo and shapes recalled, the groove never stopping.', instr: 'Cover the tab. Say the capo and shapes before each key. Pass: all six keys without a wrong chord.', watch: 'Rushing the capo decision.', simplify: 'Three keys.' })],
          ST('At mastery the groove, the key and the pattern are independent choices.', 'Random practice is harder now and sticks better later.', ['Decide the key, then the shapes, then the groove.'])),
        S('ts-voice', 'Your own voice', 'rhythm', 'A 16-bar study, then your own.', [c => slapEtude(c),
          T_('ts-own', 'Your own arrangement: plan 8 bars of grooves over {prog}, then play it', 'transfer', { prog: 'soul', patterns: ['basic', 'hammer', 'piano', 'push', 'melody', 'ghost', 'sixteenth', 'boom'], goal: 90, why: 'The last step is your own arrangement: choose a groove for each bar, play it, then change it until it serves the song.', instr: 'Play the plan shown, then write your own plan of eight bars on paper (one pattern name per bar) and play it, singing over it. Pass: your own plan played twice in time.', watch: 'Choosing patterns that fight the melody.', simplify: 'Four bars.' })],
          ST('The capstone study shows a whole arrangement; your own plan makes the path yours.', 'Mastery is choosing the groove a song needs.', ['Plan verse and chorus grooves before you play.']))
      ], [9, 10])
  ]
});
