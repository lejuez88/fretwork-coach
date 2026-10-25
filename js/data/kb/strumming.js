// Strumming and rhythm-guitar feel: the strumming hand as a steady pendulum, chords changing on the beat,
// and the patterns, syncopations, bass-note strums, muted strums, shuffle and triplet feels, sixteenth-note
// strumming and accents that rhythm guitar is built from.
//
// Concept-first (CONTENT.md): the model is a BAR GRID. The strumming hand swings down and up at a fixed
// rate (the grid: 8ths = 8 slots per bar, 16ths = 16 slots, triplets = 12 slots) and never stops; a pattern
// only says which swings touch the strings. Each slot of a pattern is one character:
//   D  a down-strum of the chord (all strings of the grip)
//   U  an up-strum (the top four strings of the grip)
//   x  a dead down-strum: left hand relaxed so the strings are touched, not pitched (drawn "x")
//   u  a dead up-strum
//   B  the bass note of the grip (lowest string)    b  the second bass string of the grip
//   .  a rest: the hand still swings and misses the strings
// Down-strums fall on the numbers and the "&"s in 16ths too, up-strums on the "e"s and "a"s; in 8ths the
// downs are the beats and the ups the "&"s. Chords are grips built from the open shapes (G, C, D, Em, Am, E,
// A) and the movable E-shape and A-shape barres, so every chord name, and every sounding pitch, is right
// in all 12 keys by construction (`grip` is checked against the chord's tones).
//
// Teaching method first (CONTENT.md, `pedagogy` below), researched 2026-10-25: teachers start with all
// downstrokes on one easy chord, add upstrokes so the hand moves down-up without stopping ("arm as
// metronome"), then take strums away while the hand keeps moving, then change chords without stopping the
// hand, then lay patterns over progressions, bass notes and muted strums, then swing and triplet feels,
// sixteenths and accents, always relaxed and slowly with a click.
import { OPEN, N, nameOf, make, mod12, chordInfo, OPEN_SHAPES, S, stage, entry } from '../lib.js';

/* ------------------------------- The concept ------------------------------- */
export const ALLOW = new WeakMap();
const tag = (n, pcs) => { ALLOW.set(n, pcs); return n; };
const pitch = (s, f) => OPEN[s] + f;

/** Open grips beyond lib's OPEN_SHAPES (low E … high e). */
const OPENS = { ...OPEN_SHAPES, E: [0, 2, 2, 1, 0, 0], A: [null, 0, 2, 2, 2, 0] };
/** A chord grip for root pc and quality ('' or 'm'): an open shape if there is one, else the E-shape or A-shape barre closest to the nut. */
export function grip(pc, q = '') {
  const name = nameOf(pc) + q;
  if (OPENS[name]) return { name, frets: OPENS[name].slice() };
  const r6 = mod12(pc - 4), r5 = mod12(pc - 9);
  if (r6 <= r5) return { name, frets: q === 'm' ? [r6, r6 + 2, r6 + 2, r6, r6, r6] : [r6, r6 + 2, r6 + 2, r6 + 1, r6, r6] };
  return { name, frets: q === 'm' ? [null, r5, r5 + 2, r5 + 2, r5 + 1, r5] : [null, r5, r5 + 2, r5 + 2, r5 + 2, r5] };
}
const gripOf = g => {
  const ch = chordInfo(g.name); if (!ch) return null;
  const strings = []; g.frets.forEach((f, i) => { if (f != null) strings.push({ s: 6 - i, f }); });
  return { ...g, strings, pcs: ch.pcs, root: ch.pc };
};
/** Chord progression in the key as [semitones above the key root, quality]. */
const progOf = (c, id) => {
  const mn = !!c.minor;
  if (id === 'one') return [[0, mn ? 'm' : '']];
  if (id === 'two') return mn ? [[0, 'm'], [10, '']] : [[0, ''], [5, '']];
  return mn ? [[0, 'm'], [8, ''], [3, ''], [10, '']] : [[0, ''], [7, ''], [9, 'm'], [5, '']];
};
const keyGrips = (c, id) => progOf(c, id).map(([d, q]) => gripOf(grip(mod12(c.key + d), q)));
const openGrips = names => names.map(n => gripOf({ name: n, frets: OPENS[n].slice() }));

/** One bar of pattern characters per grid. Every pattern has exactly `grid` characters. */
export const PAT = {
  // 8ths (8 slots)
  q: 'D.D.D.D.', arm: 'D.......', two: 'D...D...', eights: 'DUDUDUDU', folk: 'D.D.DUDU', pop: 'D.DU.UDU', ballad: 'D..UD.DU',
  syncA: 'D..UD..U', syncB: 'D.DUD..U', syncC: 'D...D.DU', chopA: 'DxDxDxDx', chopB: 'x.D.x.D.',
  bassA: 'B.D.b.D.', bassB: 'B.DUb.DU', reggae: '.U.U.U.U',
  // 16ths (16 slots)
  s16a: 'DuDuDuDuDuDuDuDu', s16b: 'DuxuDuxuDuxuDuxu', s16c: 'xuxuDuxuxuxuDuxu', s16d: 'DuxuxUxuDuxuxUDu', s16e: 'D.DUD.DUD.DUD.DU',
  accNum: 'DuxuDuxuDuxuDuxu', accAnd: 'xuDuxuDuxuDuxuDu', accE: 'xUxuxUxuxUxuxUxu', accA: 'xuxUxuxUxuxUxuxU',
  accPair: 'DUxuDUxuDUxuDUxu', accThree: 'DuxUxuDuxUxuDuxU',
  // triplets (12 slots)
  tripA: 'DUDDUDDUDDUD', tripB: 'DuxDuxDuxDux', tripC: 'DuxxUxDuxxUx'
};
const GRID = p => PAT[p].length;
const STEP = p => 4 / GRID(p);

/** Strokes of one bar of `pat` on grip g, starting at beat t0. */
function barNotes(g, pat, t0, swing) {
  const P = PAT[pat], step = STEP(pat), out = [];
  const ev = []; for (let i = 0; i < P.length; i++) if (P[i] !== '.') ev.push(i);
  ev.forEach((i, k) => {
    const ch = P[i], t = t0 + i * step, nxt = k + 1 < ev.length ? ev[k + 1] : P.length;
    const ring = Math.min(2, (nxt - i) * step), top = g.strings.slice(-4), three = g.strings.slice(-3);
    if (ch === 'D') g.strings.forEach(x => out.push(tag(N(x.s, x.f, t, ring, null, { chord: true }), g.pcs)));
    else if (ch === 'U') top.forEach(x => out.push(tag(N(x.s, x.f, t, ring, null, { chord: true }), g.pcs)));
    else if (ch === 'x') three.forEach(x => out.push(tag(N(x.s, x.f, t, step, 'mute', { chord: true }), null)));
    else if (ch === 'u') three.forEach(x => out.push(tag(N(x.s, x.f, t, step, 'mute', { chord: true }), null)));
    else if (ch === 'B') { const x = g.strings[0]; out.push(tag(N(x.s, x.f, t, ring), g.pcs)); }
    else if (ch === 'b') { const x = g.strings[1]; out.push(tag(N(x.s, x.f, t, ring), g.pcs)); }
  });
  return out;
}
/**
 * Strum plan: grips (cycled), `per` bars on each grip, `reps` passes, `pats` (one id per bar, cycled).
 * Returns notes, the chord names in order and the voicings used.
 */
function plan(grips, pats, { per = 1, reps = 1, t0 = 0 } = {}) {
  if (!grips || grips.some(g => !g)) return null;
  const notes = [], names = []; let bar = 0;
  for (let r = 0; r < reps; r++) for (const g of grips) for (let b = 0; b < per; b++) {
    const pat = pats[bar % pats.length];
    notes.push(...barNotes(g, pat, t0 + bar * 4)); names.push(g.name); bar++;
  }
  return { notes, chords: names, bars: bar, voicings: grips.map(g => ({ name: g.name, frets: g.frets })) };
}
const lv = (c, d = 1) => c.lvl || d;

/* ------------------------------ The lesson wrapper ------------------------------ */
/** One generator: build(c) → { notes, chords?, voicings?, swing? }; name/instr may use {key} and {chords}. */
function L(id, name, method, o, build) {
  return c => {
    const r = build(c); if (!r || !r.notes || r.notes.length < 4 || r.notes.length > 400) return null;
    const keyName = `${nameOf(c.key)} ${c.minor ? 'minor' : 'major'}`, ch = r.chords ? [...new Set(r.chords)].join(' – ') : '';
    const fill = x => String(x).replace(/\{key\}/g, keyName).replace(/\{chords\}/g, ch);
    return make(c, {
      id, name: fill(name), domain: 'rhythm', method, unit: o.unit, goal: o.goal, start: o.start, minutes: o.minutes || 5,
      why: o.why, instr: fill(o.instr), watch: o.watch, simplify: o.simplify,
      ...(r.chords ? { backing: r.chords, chords: [...new Set(r.chords)], voicings: r.voicings } : {}),
      tab: { notes: r.notes, ...(r.swing ? { swing: true } : {}) }
    });
  };
}
const ST = (concept, why, theory) => ({ concept, why, theory });

/* ------------------------------ Skill builders ------------------------------ */
// Foundations: open chords only (the sources start on Em, E, D), the same in every key.
const quartersEm = c => plan(openGrips(lv(c) >= 2 ? ['Em', 'Am'] : ['Em']), ['q'], { per: 2, reps: lv(c) >= 2 ? 2 : 4 });
const armTick = c => plan(openGrips(['Em']), [lv(c) >= 3 ? 'two' : lv(c) >= 2 ? 'two' : 'arm'], { reps: 1, per: 4 });
const armPlus = c => plan(openGrips(lv(c) >= 2 ? ['Em', 'C'] : ['Em']), [lv(c) >= 3 ? 'folk' : 'two'], { per: 2, reps: lv(c) >= 2 ? 2 : 2 });
const eightsEm = c => plan(openGrips(lv(c) >= 2 ? ['Em', 'Am'] : ['Em']), ['eights'], { per: 2, reps: lv(c) >= 2 ? 2 : 2 });
const eightsED = c => plan(openGrips(['E', 'D']), ['eights'], { per: 2, reps: 2 });
const missFolk = c => plan(openGrips(['G', 'C']), [lv(c) >= 3 ? 'folk' : 'two', 'folk'], { per: 2, reps: 2 });
const missPop = c => plan(openGrips(lv(c) >= 2 ? ['Em', 'D'] : ['Em']), ['pop'], { per: 2, reps: 2 });
const changeTwo = c => plan(openGrips(['G', 'Em']), [lv(c) >= 2 ? 'eights' : 'q'], { per: 1, reps: 4 });
const changeFour = c => plan(openGrips(['G', 'Em', 'C', 'D']), [lv(c) >= 3 ? 'pop' : lv(c) >= 2 ? 'folk' : 'eights'], { per: 1, reps: 2 });

// Intermediate: the four chords of the key
const keyFour = (c, pats, per = 1, reps = 1) => plan(keyGrips(c, 'four'), pats, { per, reps });
const popFour = c => keyFour(c, ['pop'], 1, lv(c) >= 5 ? 2 : 1);
const folkFour = c => keyFour(c, ['folk'], 1, lv(c) >= 5 ? 2 : 1);
const balladFour = c => keyFour(c, lv(c) >= 5 ? ['ballad', 'ballad', 'pop', 'ballad'] : ['ballad'], 1, 2);
const syncOne = c => plan(keyGrips(c, 'two'), ['syncA'], { per: 2, reps: lv(c) >= 5 ? 2 : 1 });
const syncMix = c => keyFour(c, ['syncB', 'syncC', 'syncA', 'pop'], 1, 1);
const bassOne = c => plan(keyGrips(c, 'two'), ['bassA'], { per: 2, reps: 2 });
const bassFour = c => keyFour(c, lv(c) >= 5 ? ['bassB', 'bassA'] : ['bassA'], 1, 2);
const chopDown = c => plan(keyGrips(c, 'two'), ['chopA'], { per: 2, reps: 2 });
const chopBack = c => plan(keyGrips(c, 'two'), lv(c) >= 5 ? ['chopB', 'chopA'] : ['chopB'], { per: 2, reps: 2 });
const swingBounce = c => { const r = plan(keyGrips(c, 'two'), ['chopA'], { per: 2, reps: 2 }); return r && { ...r, swing: true }; };
const swingFull = c => { const r = keyFour(c, lv(c) >= 5 ? ['eights', 'chopA'] : ['eights'], 1, 2); return r && { ...r, swing: true }; };

// Advanced
const sixteenMuted = c => plan(keyGrips(c, 'two'), [lv(c) >= 8 ? 's16b' : 's16a'], { per: 2, reps: 1 });
const sixteenBeat = c => keyFour(c, [lv(c) >= 8 ? 's16d' : 's16b'], 1, 1);
const accentOne = c => plan([keyGrips(c, 'one')[0]], ['accNum', 'accAnd', 'accE', 'accA'], { per: 4 });
const accentPairs = c => plan([keyGrips(c, 'one')[0]], ['accPair', 'accThree', 'accPair', 'accThree'], { per: 4 });
const tripOne = c => { const g = keyGrips(c, 'two'); return plan(g, [lv(c) >= 8 ? 'tripB' : 'tripA'], { per: 2, reps: 1 }); };
const tripFour = c => keyFour(c, lv(c) >= 8 ? ['tripC', 'tripB'] : ['tripB'], 1, 1);
const feelReggae = c => plan(keyGrips(c, 'two'), ['reggae'], { per: 2, reps: 2 });
const feelFunk = c => plan(keyGrips(c, 'two'), lv(c) >= 8 ? ['s16c', 's16d'] : ['s16c'], { per: 2, reps: 1 });

// Mastery
const speedMuted = c => plan(keyGrips(c, 'two'), ['s16a', 's16b'], { per: 2, reps: 1 });
const speedSync = c => keyFour(c, ['s16d', 's16c'], 1, 1);
const keysPop = c => {
  const notes = [], names = [], vs = []; let t = 0;
  for (const off of [0, 5, 7, 2, 9, 10]) {
    const g = gripOf(grip(mod12(c.key + off), c.minor ? 'm' : '')); if (!g) return null;
    const r = plan([g], ['pop'], { per: 1 }); r.notes.forEach(n => { n.t = +(n.t + t).toFixed(4); notes.push(n); });
    names.push(g.name); vs.push({ name: g.name, frets: g.frets }); t += 4;
  }
  return { notes, chords: names, voicings: vs };
};
const keysSixteenth = c => {
  const notes = [], names = [], vs = []; let t = 0;
  for (const off of [0, 7, 2, 9]) {
    const g = gripOf(grip(mod12(c.key + off), c.minor ? 'm' : '')); if (!g) return null;
    const r = plan([g], ['s16b'], { per: 1 }); r.notes.forEach(n => { n.t = +(n.t + t).toFixed(4); notes.push(n); });
    names.push(g.name); vs.push({ name: g.name, frets: g.frets }); t += 4;
  }
  return { notes, chords: names, voicings: vs };
};
/** A sectioned study: each section is [progression id, pattern ids, bars per chord]. */
function study(c, sections) {
  const notes = [], names = [], vs = []; let t = 0;
  for (const [pid, pats, per] of sections) {
    const r = plan(keyGrips(c, pid), pats, { per, t0: t }); if (!r) return null;
    notes.push(...r.notes); names.push(...r.chords); vs.push(...r.voicings); t += r.bars * 4;
  }
  return { notes, chords: names, voicings: vs.filter((v, i, a) => a.findIndex(x => x.name === v.name && x.frets.join() === v.frets.join()) === i) };
}
const capStudy = c => study(c, [['four', ['pop'], 1], ['two', ['syncA'], 1], ['two', ['s16b'], 1]]);
const capChange = c => study(c, [['four', ['folk', 'pop'], 1], ['two', ['bassA'], 1], ['two', ['chopB', 's16c'], 1]]);

/* ------------------------------- The path ------------------------------- */
export default entry({
  id: 'strumming', kind: 'technique', title: 'Strumming and rhythm guitar', domain: 'rhythm',
  re: /strum(ming|s)?|rhythm guitar|strumming patterns?|down.?up strum|rhythm strum/,
  aliases: ['strumming patterns', 'rhythm guitar', 'strumming hand', 'down up strumming', 'strum patterns', 'rhythm playing'],
  summary: 'The strumming hand as a steady pendulum: down-up in 8ths, patterns that miss strums, chord changes on the beat, then bass-note, muted, shuffle, triplet and sixteenth-note strumming with accents.',
  prereqs: [],
  sources: [
    'https://www.laurenbateman.com/?p=5971',
    'https://www.heartwoodguitar.com/lesson/how-to-strum/',
    'https://www.fretjam.com/beginner-guitar-strumming.html',
    'https://www.premierguitar.com/rhythm-rules-16th-note-accents',
    'https://www.riffhard.com/how-to-strum-triplets-on-the-guitar/',
    'https://www.andyguitar.co.uk/online-lessons/courses/beginner-course/lessons/lesson-2-shuffle-and-swing-strumming'
  ],
  pedagogy: {
    date: '2026-10-25',
    summary: 'Taught as one rule: the strumming hand keeps swinging down-up at a fixed rate and only the strings it touches change. Start with all downstrokes on an easy chord with a click, add upstrokes, take strums away while the arm keeps going, change chords without stopping the hand, then apply patterns to progressions and move on to bass notes, muted strums, shuffle and triplet feels, sixteenths and accents. Always relaxed, always slowly, with the metronome.',
    sequence: [
      { id: 'arm', tier: 'foundations', step: 'Downstrokes on the beat; the arm as a metronome', how: 'All downstrokes on an easy chord, one per click, then strum only on beat 1 (or beats 1 and 3) while the arm keeps swinging through the rests.', skills: ['st-arm'], source: 1 },
      { id: 'updown', tier: 'foundations', step: 'Down-up in 8th notes', how: 'Add the upstroke on every "&" so the hand moves down-up without stopping; exaggerate and relax if it sounds choppy.', skills: ['st-updown'], source: 0 },
      { id: 'miss', tier: 'foundations', step: 'Taking strums away while the hand keeps moving', how: 'Play patterns such as down, rest, down-up, rest, up-down-up, saying "down, up, rest" aloud; the arm swings through the rests.', skills: ['st-miss'], source: 1 },
      { id: 'change', tier: 'foundations', step: 'Changing chords without stopping the hand', how: 'Keep the same rhythm across a chord change and move the fretting hand early, on the last "&", so the new chord lands on the beat.', skills: ['st-change'], source: 2 },
      { id: 'patterns', tier: 'intermediate', step: 'Patterns on a progression', how: 'The common pop, folk and ballad patterns over a four-chord progression, repeated until automatic.', skills: ['st-pop'], source: 1 },
      { id: 'sync', tier: 'intermediate', step: 'Syncopation: patterns that miss the beat', how: 'Patterns with upstrokes on the "&" of 2 and 4 and rests on the beat, counted aloud as down, up and rest.', skills: ['st-sync'], source: 1 },
      { id: 'bass', tier: 'intermediate', step: 'Bass note then strum', how: 'Pick the root, strum, pick a second bass string, strum: the boom-chick accompaniment, with the hand swinging all the time.', skills: ['st-bass'], source: 1 },
      { id: 'mute', tier: 'intermediate', step: 'Muted strums and the chop', how: 'Relax the fretting hand so a strum is only percussion; chords on the backbeat with muted strums around them.', skills: ['st-chop'], source: 3 },
      { id: 'swing', tier: 'intermediate', step: 'Shuffle and swung eighths', how: 'The blues shuffle strum: long-short 8ths with the "&" muted to leave the bounce; straight and swung feels are not mixed in one song.', skills: ['st-swing'], source: 5 },
      { id: 'sixteen', tier: 'advanced', step: 'Sixteenth-note strumming', how: 'The hand swings in 16ths: downs on the number and "&", ups on "e" and "a"; strums are muted so only chosen ones ring.', skills: ['st-16'], source: 3 },
      { id: 'accent', tier: 'advanced', step: 'Accents on any strum', how: 'Even muted 16ths, then the accent on the numbers, on the "&"s, on the "e"s and on the "a"s, then paired and displaced accents.', skills: ['st-accent'], source: 3 },
      { id: 'triplet', tier: 'advanced', step: 'Triplet strumming', how: 'Three strums to the beat counted "1-trip-let", down-up-down on a simple chord, then accents on the first, second or third strum.', skills: ['st-trip'], source: 4 },
      { id: 'feel', tier: 'advanced', step: 'Strum feels by style', how: 'Applying the grid to offbeat chops and sixteenth-note funk scratches over a progression.', skills: ['st-feel'], source: 3 },
      { id: 'speed', tier: 'mastery', step: 'Relaxed at tempo', how: 'Sixteenth-note strumming at performance tempo for long stretches, raising the click only while the motion stays relaxed.', skills: ['st-speed'], source: 0 },
      { id: 'keys', tier: 'mastery', step: 'The same groove in every key', how: 'The same pattern moved through six keys in a row, changing grips without stopping the hand.', skills: ['st-keys'], source: 2 },
      { id: 'capstone', tier: 'mastery', step: 'A full strummed arrangement', how: 'Sections of a song with a different pattern each (verse, pre-chorus, chorus), the hand never stopping between them.', skills: ['st-cap'], source: 1 }
    ],
    drills: ['All downstrokes on Em, one per click', 'The arm as metronome: strum only on beat 1 while the arm keeps swinging', 'Down-up in 8ths on one chord, counted aloud', 'Saying "down, up, rest" while playing a pattern that skips strums', 'Chord changes on the last "&" of the bar without stopping the hand', 'Muted 16th strums with the accent moved to the number, "&", "e" and "a"', 'Triplets as down-up-down on an open chord with a slow click', 'Recording yourself against a backing track'],
    mistakes: ['Tension in the arm, wrist or pick grip, which makes the upstrokes choppy', 'Stopping the arm on the rests, which breaks the steady rhythm', 'Rushing to get the hand back for the next strum', 'Pausing the hand to change chord instead of changing early on the last "&"', 'Moving only the wrist and barely crossing the strings, so single strings are heard', 'Mixing straight, shuffle and triplet feels in one groove', 'Speeding up before the pattern is automatic'],
    sources: [
      { title: 'Strumming Lesson For Beginners', author: 'Lauren Bateman', url: 'https://www.laurenbateman.com/?p=5971' },
      { title: 'How to Strum', author: 'Heartwood Guitar', url: 'https://www.heartwoodguitar.com/lesson/how-to-strum/' },
      { title: 'Beginner Guitar Strumming', author: 'FretJam', url: 'https://www.fretjam.com/beginner-guitar-strumming.html' },
      { title: 'Rhythm Rules: 16th-Note Accents', author: 'Premier Guitar', url: 'https://www.premierguitar.com/rhythm-rules-16th-note-accents' },
      { title: 'How to Strum Triplets on the Guitar', author: 'Riffhard', url: 'https://www.riffhard.com/how-to-strum-triplets-on-the-guitar/' },
      { title: 'Shuffle and Swing Strumming (beginner course)', author: 'Andy Guitar', url: 'https://www.andyguitar.co.uk/online-lessons/courses/beginner-course/lessons/lesson-2-shuffle-and-swing-strumming' }
    ]
  },
  ctx: { key: 7, minor: false, prog: 'folkAxis' },
  stages: [
    stage('foundations', 'The arm that never stops',
      'Down-strums on every beat, down-up 8ths and a pattern with missed strums on open chords at 80 BPM, then G–Em–C–D with the hand never stopping across the changes, eight bars with no hiccup.', [
        S('st-arm', 'The arm as a metronome', 'rhythm', 'The strumming arm swings on every beat, whether or not it touches the strings.', [
          L('st-arm-quarters', 'Down-strums on every beat: {chords}', 'accurate-reps', { unit: 'quarter notes', goal: 90, start: 55, why: 'One relaxed downstroke per click on an easy chord is where every teacher starts: even, loose strums before anything else.', instr: 'Hold the chord, let the pick fall across all six strings once per click, and let the hand swing back up between strums without touching the strings. Two bars on each chord. Pass: 8 bars with every strum the same strength and every one on the click.', watch: 'Gripping the pick or tightening the wrist, which makes the strums choppy.', simplify: 'Play only beat 1 of each bar and count the rest.' }, quartersEm),
          L('st-arm-tick', 'The arm as metronome: strums on beat 1 only (Em)', 'chunking', { unit: 'quarter notes', goal: 80, start: 50, why: 'Keeping the arm swinging while it only strums on some beats is the habit all later patterns rest on.', instr: 'Keep the arm swinging down and up at the click and strum only where the tab shows: beat 1 (then beats 1 and 3). Count 1 2 3 4 aloud and feel the hand pass the strings on the rests. Pass: 4 bars with the arm never stopping.', watch: 'Stopping the arm between strums.', simplify: 'Strum on every beat, then take the odd beats away one by one.' }, armTick)
        ], ST('Strumming is a pendulum: the arm swings down and up at a steady rate and the pick only touches the strings on some of the swings. A strum on the beat is a downstroke; the swing back up is the upstroke, even if you miss the strings.', 'A steady arm gives you time, and every pattern after this is just choosing which swings to play.', ['Keep the arm moving even when no strum is written (rests).', 'Downs fall on the beats (1 2 3 4), ups on the "&"s.', 'Relaxed shoulder, loose wrist, thin pick or light grip.'])),
        S('st-updown', 'Down-up in 8th notes', 'rhythm', 'Adding the upstroke so the hand moves down-up without stopping.', [
          L('st-updown-em', 'Down-up 8ths on one chord: {chords}', 'chunking', { unit: '8th notes', goal: 90, start: 55, why: 'Every "&" gets an upstroke, so the hand moves at twice the click rate with no pauses.', instr: 'Count 1 & 2 & 3 & 4 &. Down on the numbers, up on the "&"s, evenly. If the upstrokes sound choppy, slow down and let the hand fall instead of forcing it. Pass: 8 bars of even down-ups.', watch: 'Choppy, hard upstrokes from a tight forearm.', simplify: 'Play the downs only and just let the arm swing up.' }, eightsEm),
          L('st-updown-open', 'Down-up 8ths: E to D', 'accurate-reps', { unit: '8th notes', goal: 90, start: 55, why: 'The same down-up hand across two bar-length chords (E, then D) with the change on the barline.', instr: 'Two bars on E, two on D, strumming down-up 8ths and changing right on beat 1. Pass: 4 passes (16 bars) with no pause at the change.', watch: 'Stopping the strumming hand while the fretting hand changes.', simplify: 'Strum down only, two bars per chord.' }, eightsED)
        ], ST('Playing the upstroke makes the hand swing at 8th-note speed: down on the beat, up on the "&". Teachers let the hand fall rather than push, so the pick floats over the strings.', 'The 8th-note swing is the engine of nearly every strumming pattern in pop, folk and rock.', ['Count 1 & 2 & 3 & 4 &.', 'The pick stays almost level with the strings, not dug in.', 'Upstrokes only need to hit the top few strings.'])),
        S('st-miss', 'Missing strums, moving arm', 'rhythm', 'Patterns where some swings miss the strings but the arm keeps going.', [
          L('st-miss-folk', 'A folk strum with missed strums: {chords}', 'chunking', { unit: '8th notes', goal: 95, start: 55, why: 'The classic folk pattern is down-up 8ths with a few downs left out; the arm still swings through the gaps.', instr: 'Play D . D . D U D U (a dot is a rest: the arm swings and misses the strings). Say "down, rest, down, rest, down, up, down, up" aloud. Pass: 8 bars with the arm never stopping.', watch: 'Letting the arm stop on the rests.', simplify: 'Down on every beat, then add the last two upstrokes.' }, missFolk),
          L('st-miss-pop', 'The pop strum: D . D U . U D U ({chords})', 'accurate-reps', { unit: '8th notes', goal: 95, start: 55, why: 'The most common pattern in pop and rock: the hand misses the "&" of 1 and the beat 3.', instr: 'Play D . D U . U D U over the chords, two bars each, counting 1 & 2 & 3 & 4 &. The ups on the "&" of 2 and 3 are the feel of the pattern. Pass: 8 bars with every strum on its count.', watch: 'Playing the ups in the wrong place or rushing the second half.', simplify: 'Play only the first half (D . D U) and repeat it.' }, missPop)
        ], ST('A strumming pattern is the 8th-note down-up swing with some strums left out. The misses are as important as the hits, because the arm keeps moving through them.', 'Almost every strumming pattern you will meet is a thinned-out version of continuous down-ups.', ['A dot in a pattern is a rest: the arm swings and misses the strings.', 'Say "down, up, rest" aloud while playing.', 'The hit pattern repeats each bar; chords change on beat 1.'])),
        S('st-change', 'Changing chords without stopping the hand', 'rhythm', 'Moving the fretting hand early so the new chord lands on the beat while the strumming hand keeps going.', [
          L('st-change-two', 'Chord changes on the beat: {chords}', 'chunking', { unit: '8th notes', goal: 90, start: 55, why: 'The strumming hand never waits for the fretting hand: it keeps the rhythm while the chord changes underneath it.', instr: 'One bar of G, one of Em, continuing the strum with no pause. Start moving the fretting fingers on the last "&" of the bar so the new chord sounds on beat 1. Pass: 8 bars without a hiccup at either change.', watch: 'Waiting for the new chord and letting the strum stop.', simplify: 'Two bars on each chord and let the strum thin out before the change.' }, changeTwo),
          L('st-change-four', 'A four-chord loop with the strum going: {chords}', 'transfer', { unit: '8th notes', goal: 90, start: 55, why: 'Real music: four open chords in a loop, with a strumming pattern that does not stop across any change.', instr: 'One bar on each of G, Em, C and D with the pattern shown, changing chords early on the last "&". Pass: 8 bars (two passes) with the strum steady across every change.', watch: 'Pausing the hand at the hardest change.', simplify: 'Two bars on each chord, or drop the "&" strums at the changes.' }, changeFour)
        ], ST('Chord changes and strumming are two jobs for two hands. The fretting hand moves early (on the last "&" of the bar) so the new chord lands on the beat; the strumming hand does not wait.', 'A steady hand turns chords into rhythm; waiting for the fingers makes every bar a different length.', ['Change in the gap between the last "&" and beat 1, starting before it.', 'Keep the same pattern across a change.', 'Slow the click rather than stop the hand.']))
      ]),
    stage('intermediate', 'Patterns, bass notes and muted strums',
      'The pop, folk and ballad strums, an off-beat syncopated pattern and a bass-note strum on the four chords of a key, plus muted chops and a swung shuffle, each played at 100 BPM for 8 bars with the chord changes on the beat.', [
        S('st-pop', 'Patterns on the progression', 'rhythm', 'The pop, folk and ballad strums on a four-chord loop in the key.', [
          L('st-pop-pop', 'The pop strum in {key}: {chords}', 'accurate-reps', { unit: '8th notes', goal: 100, start: 65, why: 'The same D . D U . U D U pattern on the four chords of the key moves what you learned onto barre and movable shapes.', instr: 'One bar each of {chords}, pattern D . D U . U D U, hand swinging 8ths all the time. Pass: 8 bars with the changes on the beat.', watch: 'Slowing the hand down for the barre chord.', simplify: 'Two bars per chord, or the folk pattern.' }, popFour),
          L('st-pop-folk', 'The folk strum in {key}: {chords}', 'interleaving', { unit: '8th notes', goal: 100, start: 65, why: 'A second pattern on the same changes, so the hand learns that the pattern and the chord are separate things.', instr: 'Play D . D . D U D U on {chords}, one bar each. Pass: 8 bars with the arm steady.', watch: 'Mixing up the two patterns when the chord changes.', simplify: 'Down-up 8ths on each chord.' }, folkFour),
          L('st-pop-ballad', 'The ballad strum in {key}: {chords}', 'transfer', { unit: '8th notes', goal: 95, start: 60, why: 'A slower pattern with a gap on beat 2 for songs that breathe: it uses the same hand with different hits.', instr: 'Play D . . U D . D U over {chords}, counting 1 & 2 & 3 & 4 &, with the arm swinging through the rests. Pass: 8 bars at tempo.', watch: 'Rushing the first upstroke after the rest.', simplify: 'Play D . . U D . . U until it is steady.' }, balladFour)
        ], ST('A strumming pattern is a bar of the 8th-note swing with some strums taken out. Different patterns give different styles on the same chords, so the pattern and the chord progression are two separate choices.', 'With a handful of patterns you can accompany most songs; the point is to switch pattern without changing the arm.', ['The pop pattern drops the "&" of 1 and the beat 3 hit.', 'The folk pattern keeps downs on 1, 2 and 3 and fills the last half.', 'The ballad pattern leaves beat 2 open.'])),
        S('st-sync', 'Syncopation: strumming off the beat', 'rhythm', 'Patterns whose first hits land on the "&" and not on the beat.', [
          L('st-sync-one', 'A syncopated strum: D . . U D . . U ({chords})', 'chunking', { unit: '8th notes', goal: 100, start: 60, why: 'Upstrokes on the "&" of 2 and 4 with rests on beats 2 and 4 put the weight between the beats.', instr: 'Play D . . U D . . U on {chords}, two bars each; say "down, rest, rest, up, down, rest, rest, up". Pass: 8 bars with the ups exactly on the "&"s.', watch: 'Letting the arm stop on the beat 2 and beat 4 rests.', simplify: 'Add the upstrokes to a plain down-on-the-beat pattern one at a time.' }, syncOne),
          L('st-sync-mix', 'Syncopated patterns in a row: {chords}', 'interleaving', { unit: '8th notes', goal: 100, start: 60, why: 'Changing the pattern every bar so the feel changes and the arm does not.', instr: 'One bar each of D . D U D . . U, D . . . D . D U, D . . U D . . U and the pop strum over {chords}. Pass: one pass through all four with no pause.', watch: 'Letting the pattern collapse into plain down-ups.', simplify: 'Repeat each pattern four times before moving on.' }, syncMix)
        ], ST('Syncopation puts the hits between the beats: an upstroke on the "&" with nothing on the beat after it. The arm still swings in 8ths; only the strings it touches change.', 'Rhythm that pulls against the beat is what makes strumming sound alive instead of mechanical.', ['Upstrokes are on the "&" of a beat.', 'A rest on the beat after a syncopated up is heard as a push.', 'Keep counting 1 & 2 & 3 & 4 & aloud.'])),
        S('st-bass', 'Bass note then strum', 'rhythm', 'Alternating a picked bass note with a strum, the boom-chick accompaniment.', [
          L('st-bass-boom', 'Bass-note strum: B . D . b . D . ({chords})', 'chunking', { unit: '8th notes', goal: 100, start: 60, why: 'The root on the beat and a second bass string on beat 3 with a strum between: the country and folk accompaniment.', instr: 'Pick the lowest string of the grip on beat 1 (the root), strum down on beat 2, pick the next string on beat 3 and strum on beat 4. The arm keeps swinging down-up 8ths. Pass: 8 bars with the bass notes ringing and the strums clean.', watch: 'Hitting the wrong bass string or hitting too many strings.', simplify: 'Bass note then strum on beats 1 and 2 only.' }, bassOne),
          L('st-bass-up', 'Bass note with upstrokes: {chords}', 'accurate-reps', { unit: '8th notes', goal: 100, start: 60, why: 'Adding the upstroke after each strum fills the bar and makes the pattern more driving.', instr: 'Play B . D U b . D U over {chords}: bass note, strum down-up, second bass note, strum down-up. Pass: 8 bars at tempo.', watch: 'Rushing the up after the strum.', simplify: 'Use the plain boom-chick for two bars first.' }, bassFour)
        ], ST('Picking one low string then strumming splits the guitar into two parts: a bass line and the chord. Moving between two bass strings of the grip makes a walking feel under the strums.', 'This is the step between strumming and fingerstyle, and it makes a single guitar sound like a band.', ['The root is the lowest string of the grip.', 'The second bass string is the next string up that is part of the grip.', 'Let bass notes ring while the strum goes over them.'])),
        S('st-chop', 'Muted strums and the chop', 'rhythm', 'Strums that are only percussion, and chords placed on the backbeat.', [
          L('st-chop-ring', 'Ring and scratch: D x D x D x D x ({chords})', 'chunking', { unit: '8th notes', goal: 100, start: 60, why: 'A downstroke that rings followed by an upstroke that is muted by relaxing the fretting hand: the percussive strum.', instr: 'Down-strum the chord on every beat; on the "&" relax the fretting fingers so the strings are touched but not pitched (x). Pass: 8 bars with the rings clear and the scratches dead.', watch: 'Lifting the fingers off entirely so open strings sound.', simplify: 'Mute with the picking-hand palm for a bar, then with the fretting hand.' }, chopDown),
          L('st-chop-back', 'The chop on 2 and 4: x . D . x . D . ({chords})', 'transfer', { unit: '8th notes', goal: 100, start: 60, why: 'The chord rings only on the backbeat (2 and 4) with a dead strum on 1 and 3: the rhythm of most pop, rock and soul.', instr: 'Strum a muted chord on beats 1 and 3, a clear chord on beats 2 and 4, the arm swinging down-up 8ths. Pass: 8 bars with the accent exactly on the backbeat.', watch: 'Letting the muted strums ring.', simplify: 'Mute every strum and add the ring on beat 2 only.' }, chopBack)
        ], ST('A muted strum is a strum with the fretting hand relaxed: the strings are touched but not pressed, so you hear percussion, not pitch. Putting the clear chord on beats 2 and 4 (the backbeat) gives the groove its snap.', 'Muted strums let you keep the arm moving at 16th speed without every strum ringing.', ['x in the tab is a dead strum.', 'Relax the fingers but keep them on the strings.', 'Backbeat is beats 2 and 4.'])),
        S('st-swing', 'Shuffle and swung eighths', 'rhythm', 'The long-short 8ths of the blues shuffle.', [
          L('st-swing-bounce', 'The shuffle bounce: D x D x D x D x, swung ({chords})', 'chunking', { unit: 'swung 8ths', goal: 95, start: 60, why: 'Muting the "&" leaves a gap that gives the shuffle its bounce; the pulse is long-short (the first two thirds of a triplet).', instr: 'Down-strum the chord on each beat and mute the swung "&" (x). Count 1-trip-let, 2-trip-let, hitting the first and third. Pass: 8 bars with the swing steady.', watch: 'Playing the "&" straight and ringing.', simplify: 'Straight 8ths first, then lean the "&" late.' }, swingBounce),
          L('st-swing-full', 'Swung strums on the chords: {chords}', 'transfer', { unit: 'swung 8ths', goal: 95, start: 60, why: 'The same long-short feel with full down-up strums, as in swing and blues strumming.', instr: 'Down-up 8ths with the "&" late (long-short) over {chords}. Do not mix this with a straight feel in the same bar. Pass: 8 bars with the swing consistent.', watch: 'Drifting back to straight 8ths as you speed up.', simplify: 'Use the bounce version for the first pass.' }, swingFull)
        ], ST('Swung 8ths divide the beat into a long note and a short note (two thirds, one third) instead of two equal halves. Muting the short note gives the shuffle its bounce.', 'Blues, swing and shuffle feels sit on this long-short grid, and mixing it with straight 8ths in one groove sounds wrong.', ['Long-short is the first and third note of a triplet.', 'Straight and swung feels do not mix inside one part.', 'The tab plays back swung when it shows the swing mark.']))
      ]),
    stage('advanced', 'Sixteenths, accents and feels',
      'Sixteenth-note strums with muted fill, accents on the number, the "&", the "e" and the "a", triplet strums and a funk and reggae part, each played over two chords at 90 BPM for 8 bars without the arm tightening.', [
        S('st-16', 'Sixteenth-note strumming', 'rhythm', 'The hand swings in 16ths with most strums muted.', [
          L('st-16-muted', 'Constant 16ths, chord on the 8ths ({chords})', 'chunking', { unit: '16th notes', goal: 80, start: 55, why: 'The hand swings at 16th speed (down on the number and the "&", up on the "e" and "a") and only some strums ring.', instr: 'Keep the arm swinging 16ths; the chord rings on the numbers and "&"s, the strums between are muted (u). Count 1 e & a 2 e & a. Pass: 4 bars relaxed at tempo.', watch: 'Tightening the forearm and losing the swing.', simplify: 'Play 8ths for two bars, then add the muted strums.' }, sixteenMuted),
          L('st-16-beat', 'Chord on the beat, scratches between ({chords})', 'accurate-reps', { unit: '16th notes', goal: 80, start: 55, why: 'A ringing chord only on the beat with muted 16ths between: the pulse of funk and pop rhythm.', instr: 'Ring the chord on each beat and scratch the strums between with the fretting hand relaxed. Pass: 4 bars with the rings always on the beat.', watch: 'Letting the muted strums ring or disappear.', simplify: 'Mute with the palm for one bar.' }, sixteenBeat)
        ], ST('Sixteenth-note strumming runs the hand at four swings per beat: downs on the numbers and the "&"s, ups on the "e"s and "a"s. Most of those swings are muted, so the groove is the few that ring.', 'It gives you the pulse of funk, pop and R&B rhythm guitar.', ['Count 1 e & a 2 e & a 3 e & a 4 e & a.', 'Muted strums keep the hand going without noise.', 'Slow the click until the arm stays loose.'])),
        S('st-accent', 'Accents on any strum', 'rhythm', 'Moving a louder strum to the number, the "&", the "e" and the "a".', [
          L('st-accent-four', 'Accent on the number, the "&", the "e", the "a" ({chords})', 'chunking', { unit: '16th notes', goal: 75, start: 50, why: 'Learning to accent any 16th strum, including the hard upstrokes, is what makes syncopated patterns possible.', instr: 'Four muted bars of 16ths; the strum that rings the chord moves from the numbers to the "&"s to the "e"s to the "a"s. Keep the unaccented strums dead and equal. Pass: 4 bars without the accents shifting.', watch: 'Weak accents on the upstrokes or accenting the next downbeat by accident.', simplify: 'Do each accent for one bar at 60 BPM.' }, accentOne),
          L('st-accent-pairs', 'Paired and displaced accents ({chords})', 'interleaving', { unit: '16th notes', goal: 75, start: 50, why: 'Two accents together (a down and an up), and accents every three 16ths, move the feel across the bar line.', instr: 'Accent two strums in a row (down and up) on each beat; then accent every third 16th note, counting the displaced groups aloud. Pass: 4 bars of each with the accents clear.', watch: 'Letting the accents fall on the beat anyway.', simplify: 'Count 3-3-3-3-4 and tap the accents first.' }, accentPairs)
        ], ST('An accent is a strum louder than its neighbours; in muted 16ths it is the one that rings. Moving it around the beat is how you build any syncopated pattern.', 'If you can accent every position, you can write or copy any strum feel.', ['Number and "&" accents are downstrokes; "e" and "a" accents are upstrokes.', 'Paired accents are a down and an up in a row.', 'Every third 16th note repeats every 12 strums.'])),
        S('st-trip', 'Triplet strumming', 'rhythm', 'Three strums to the beat.', [
          L('st-trip-down', 'Down-up-down triplets ({chords})', 'chunking', { unit: '8th-note triplets', goal: 80, start: 55, why: 'Three even strums per beat: the feel behind slow blues, 6/8 ballads and many rock songs.', instr: 'Count 1-trip-let, 2-trip-let and strum D U D on each beat. All three strums ring. Pass: 4 bars even.', watch: 'Rushing the last strum of each triplet.', simplify: 'Clap the triplets first, then strum a chord.' }, tripOne),
          L('st-trip-acc', 'Triplets with the accent on the first strum ({chords})', 'transfer', { unit: '8th-note triplets', goal: 80, start: 55, why: 'Accenting the first strum of each triplet gives the triplet feel its lilt.', instr: 'Ring the first strum of each triplet and mute the next two (D u x on every beat) over the progression; in the later bars the second and third strums swap between a dead up and a dead down. Pass: 4 bars at tempo.', watch: 'Accenting the wrong strum or flattening the dynamics.', simplify: 'Ring all three strums for the first bar.' }, tripFour)
        ], ST('A triplet divides the beat into three equal parts instead of two. Strumming three per beat gives a rolling, lilting feel.', 'Triplet feels are everywhere in blues, soul, ballads and 6/8 songs, and they feel completely different from straight 8ths.', ['Count 1-trip-let.', 'Three evenly spaced strums per beat.', 'Do not mix straight, shuffle and triplet feels in one groove.'])),
        S('st-feel', 'Strum feels by style', 'rhythm', 'Reggae chops and funk scratch strumming.', [
          L('st-feel-reggae', 'Offbeat chops: . U . U . U . U ({chords})', 'transfer', { unit: '8th notes', goal: 100, start: 65, why: 'Reggae puts the chord only on the "&"s: short, upstroke chops with silence on the beat.', instr: 'Let the arm swing; touch only the top strings on the up. Mute the chord right after each chop by relaxing the fretting hand. Pass: 8 bars with the chops short and exactly on the "&".', watch: 'Letting the chops ring.', simplify: 'Count 1 & 2 & aloud and clap the "&"s.' }, feelReggae),
          L('st-feel-funk', 'Funk scratch strumming ({chords})', 'transfer', { unit: '16th notes', goal: 80, start: 55, why: 'Muted 16ths with a few clear chords on the backbeat: the basic funk rhythm part.', instr: 'Keep the arm swinging 16ths, chords on beats 2 and 4 only, scratches elsewhere; then add one displaced hit. Pass: 4 bars relaxed.', watch: 'Rushing the clear chords.', simplify: 'Play the chops on 2 and 4 in 8ths.' }, feelFunk)
        ], ST('Each style is the same arm doing different things: reggae hits only the "&" and stops the sound, funk plays muted 16ths with the chord on the backbeat.', 'Applying the grid to a style shows you that patterns are just placements on one grid.', ['Reggae: chops on the "&".', 'Funk: chords on beats 2 and 4, muted 16ths between.', 'Mute chords quickly by relaxing the fingers.']))
      ]),
    stage('mastery', 'Strumming as music',
      'Sixteenth-note strumming at 100 BPM for 8 bars relaxed, the same groove through six keys, and a sectioned strumming arrangement that changes pattern every two bars without the hand stopping.', [
        S('st-speed', 'Relaxed at tempo', 'rhythm', 'Sixteenth-note strumming at performance tempo, loose.', [
          L('st-speed-16', 'Sixteenths at tempo ({chords})', 'accurate-reps', { unit: '16th notes', goal: 90, start: 70, why: 'Endurance: the same relaxed motion at a tempo you would use on stage.', instr: 'Play the constant muted 16ths (chord on every number and "&") for four bars, then the chord-on-the-beat version for four, raising the click only while the forearm stays loose. Pass: 8 bars at the goal tempo without tightening.', watch: 'Tension building up after four bars.', simplify: 'Drop 10 BPM or play 8ths.' }, speedMuted),
          L('st-speed-sync', 'Syncopated sixteenths ({chords})', 'chunking', { unit: '16th notes', goal: 90, start: 70, why: 'The displaced and funk patterns at performance tempo.', instr: 'Play the syncopated 16th pattern then the backbeat chops over {chords}, one bar each. Pass: 4 passes without stopping.', watch: 'Rushing the displaced hits.', simplify: 'Slow by 10 BPM.' }, speedSync)
        ], ST('Speed in strumming is relaxation: if the arm tightens the strums get choppy before the tempo gets hard.', 'The tempo you can hold relaxed for four minutes is the tempo you actually own.', ['Raise the click only while you stay loose.', 'Record yourself to hear tension.', 'Breathing and posture matter.'])),
        S('st-keys', 'The same groove in every key', 'rhythm', 'A pattern moved through six keys.', [
          L('st-keys-pop', 'The pop strum through six keys ({chords})', 'interleaving', { unit: '8th notes', goal: 110, start: 75, why: 'Moving the same pattern through six chords tests the hand on every grip.', instr: 'One bar each of {chords} with the pop strum, no pause between. Pass: 3 passes at tempo.', watch: 'Stopping the arm at the awkward grips.', simplify: 'Two bars per chord.' }, keysPop),
          L('st-keys-16', 'Sixteenth strums through four keys ({chords})', 'interleaving', { unit: '16th notes', goal: 85, start: 60, why: 'The same 16th groove on four different chords.', instr: 'One bar each of {chords} with the chord-on-the-beat pattern. Pass: 3 passes relaxed.', watch: 'Rushing after each change.', simplify: 'Two bars per chord.' }, keysSixteenth)
        ], ST('A groove belongs to the arm, not to the chord shape. Moving it through keys shows that the hand pattern stays the same whatever the fretting hand does.', 'Playing in any key without thinking is what turns a pattern into a skill.', ['Barre grips use the E-shape and A-shape.', 'Keep the same pattern across each change.', 'Change early on the last "&".'])),
        S('st-cap', 'A full strummed arrangement', 'rhythm', 'Sections with different patterns, hand never stopping.', [
          L('st-cap-study', 'Study: verse, pre-chorus, chorus ({key})', 'transfer', { unit: '16th notes', goal: 85, start: 60, minutes: 8, why: 'Using the pop strum, a syncopated strum and a 16th groove in order, each section a different texture.', instr: 'Verse: four bars pop strum on the progression. Pre-chorus: two bars of D . . U D . . U on two chords. Chorus: two bars of the 16th groove on two chords. Play it with no gap between sections. Pass: one clean pass at tempo.', watch: 'Stopping the arm between sections.', simplify: 'Loop each section separately.' }, capStudy),
          L('st-cap-change', 'Study: changing the pattern every two bars ({key})', 'transfer', { unit: '16th notes', goal: 85, start: 60, minutes: 8, why: 'Switching between folk, pop, bass-note and 16th groove without the arm stopping.', instr: 'Alternate the folk and pop strums over the four-chord loop; then the bass-note strum; then the chop and the funk scratch. Pass: one clean pass with no hiccups.', watch: 'Mixing up the patterns at the changes.', simplify: 'Loop two sections at a time.' }, capChange)
        ], ST('An arrangement is a sequence of strumming patterns matched to sections. The arm never stops; only what it touches changes.', 'This is how strumming becomes music instead of an exercise.', ['Quiet sections use fewer, softer strums.', 'Loud sections use more strums and accents.', 'Change pattern on a bar line.']))
      ])
  ]
});
