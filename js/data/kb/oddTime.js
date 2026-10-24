// Odd time signatures: bars of 5, 7, 9, 11, 13 or 15 pulses felt as groups of 2s, 3s (and 4s), played on guitar.
// From counting a bar in groups, through accents, rotating groupings, longer bars and pentatonic lines
// that start on the group starts, to phrases that cross the bar and an original study.
//
// Concept-first (CONTENT.md): a METER is a bar of N pulses split into GROUPS (5 = 3+2 or 2+3; 7 = 2+2+3,
// 3+2+2, 2+3+2; 9 = 3+3+3 or 2+2+2+3; 11 = 3+3+3+2; 13 = 3+3+3+2+2; 15 = 2+2+2+2+2+2+3). The click is the
// PULSE (a quarter in /4 bars, an eighth in /8 bars); every group starts with an accent. The composer
// `oddRun(c, spec)` builds an exercise from PARTS (bars of one source: palm-muted pulses with accents, riff
// accents, dead notes, chord stabs with rests, a pentatonic line that restarts on every group, or a cell
// cycling across the bar). Every pitch is the minor root, a chord tone of the root power chord or an
// accent degree of the natural minor, or a note of minor pentatonic box 1, so every key is correct by
// construction.
//
// Teaching method first (CONTENT.md, `pedagogy` below): group the bar in 2s and 3s, one pitch with accents
// on the group starts, rotate the grouping, longer bars, subdivide the pulse, pitched lines, then phrases
// of another length across the bar and an original study.
import { OPEN, N, nameOf, make, mod12, pentBox, minorKey, S, stage, entry } from '../lib.js';

const MINOR = [0, 2, 3, 5, 7, 8, 10];
/** Degrees an accent may use (natural minor without the 2nd). */
export const DEGS = [0, 3, 5, 7, 8, 10];
const sum = a => a.reduce((x, y) => x + y, 0);

/** The meter named by its pulse count and pulse note: 7 pulses of an 8th note = 7/8. */
export const meterName = (pulses, pulse) => `${pulses}/${pulse === 'q' ? 4 : 8}`;
/** How a bar is counted: groups [2, 2, 3] -> "1 2 1 2 1 2 3". */
export const countOf = groups => groups.map(g => Array.from({ length: g }, (_, i) => i + 1).join(' ')).join(' ');
const plus = groups => groups.join('+');

/**
 * spec: { id, name ('{key}', '{meter}', '{groups}'), method, pulse ('q' | 'e'), parts: [ { groups | groupSets,
 * bars, src: 'pm' | 'riff' | 'mute' | 'stab' | 'pent' | 'cycle', sub (notes per pulse, default 1), pitches
 * (accent degrees), rests (group numbers left silent), starts (pent: the scale-note index each group starts
 * on), step (pent: scale notes per move), cycle (cycle: pulses per cell) } ], flip (mark the pick direction
 * of the first note of every bar), goal, start, dl, minutes, why, instr, watch, simplify }.
 */
export function oddRun(c, spec) {
  const k = minorKey(c), fR = mod12(k - OPEN[6]), pcs = MINOR.map(x => mod12(k + x));
  const box = pentBox(k, 1); if (!box) return null;
  const notes = []; let t0 = 0, barNo = 0, bar0 = null;
  const pfret = d => { let f = fR + d; if (f > 12) f -= 12; return f; };
  const pm = (t, dur, extra) => notes.push(N(6, fR, t, Math.min(dur, 0.5), 'pm', extra || null));
  const ring = (d, t, dur, extra) => {
    const f = pfret(d);
    notes.push(N(6, f, t, dur, null, { chord: true, ...(extra || {}) }), N(5, f + 2, t, dur, null, { chord: true }));
  };
  for (const P of spec.parts) {
    const sets = P.groupSets || [P.groups], bar = sum(sets[0]);
    if (sets.some(g => sum(g) !== bar)) return null;
    if (bar0 == null) bar0 = bar; else if (bar0 !== bar) return null;
    const bars = P.bars || sets.length, sub = P.sub || 1, step = 1 / sub, pit = P.pitches || [0];
    let acc = 0, run = 0;
    for (let b = 0; b < bars; b++, barNo++) {
      const groups = sets[b % sets.length], bt = t0 + b * bar;
      const firstPick = spec.flip ? { pick: barNo % 2 === 0 ? 'd' : 'u' } : null;
      if (P.src === 'cycle') {
        const n = P.cycle, slots = bar * sub;
        for (let i = 0; i < slots; i++) {
          const gi = b * slots + i, t = +(bt + i * step).toFixed(4);
          if (gi % n === 0) { ring(pit[acc % pit.length], t, step, i === 0 ? firstPick : null); acc++; } else pm(t, step);
        }
        continue;
      }
      let pos = 0;
      groups.forEach((g, gi) => {
        const gt = bt + pos, silent = (P.rests || []).includes(gi + 1);
        if (!silent) {
          if (P.src === 'pent') {
            const n = g * sub, st = (P.starts || [0, 2, 4])[run % (P.starts || [0, 2, 4]).length], mv = P.step || 1;
            let idx = st, dir = 1;
            for (let i = 0; i < n; i++) {
              const nt = box[idx], t = +(gt + i * step).toFixed(4);
              notes.push(N(nt.s, nt.f, t, step, null, gi === 0 && i === 0 && firstPick ? firstPick : null));
              for (let j = 0; j < mv; j++) { if (idx + dir > box.length - 1 || idx + dir < 0) dir = -dir; idx += dir; }
            }
          } else if (P.src === 'stab') {
            ring(pit[acc % pit.length], gt, Math.max(0.5, g / 2), gi === 0 ? firstPick : null); acc++;
          } else {
            const ex = gi === 0 ? firstPick : null;
            if (P.src === 'riff') { ring(pit[acc % pit.length], gt, step, ex); acc++; }
            else notes.push(N(6, fR, gt, step, null, ex));
            for (let i = 1; i < g * sub; i++) {
              const t = +(gt + i * step).toFixed(4);
              if (P.src === 'mute') notes.push(N(6, fR, t, step, 'mute')); else pm(t, step);
            }
          }
        }
        pos += g; run++;
      });
    }
    t0 += bars * bar;
  }
  if (notes.length < 6 || notes.length > 420) return null;
  const pulse = spec.pulse || 'e', first = spec.parts[0], groups0 = (first.groupSets || [first.groups])[0], bar = sum(groups0);
  const kn = `${nameOf(k)} minor`, mt = meterName(bar, pulse), gs = plus(groups0);
  const f = x => String(x || '').replace(/\{key\}/g, kn).replace(/\{meter\}/g, mt).replace(/\{groups\}/g, gs).replace(/\{count\}/g, countOf(groups0));
  const sub = first.sub || 1;
  const unit = spec.unit || (pulse === 'q' ? (sub === 1 ? 'quarter notes' : sub === 2 ? '8th notes' : '16th notes') : (sub === 1 ? '8th notes' : '16th notes'));
  return make(c, {
    id: spec.id, name: f(spec.name), domain: spec.domain || 'rhythm', method: spec.method, unit,
    goal: spec.goal || 110, start: spec.start, minutes: spec.minutes || 5, dl: spec.dl || 0, picking: 'alternate',
    beatsPerBar: bar, why: f(spec.why), instr: f(spec.instr), watch: f(spec.watch), simplify: f(spec.simplify),
    tab: { notes, beats: t0 }
  });
}

const OD = (id, name, method, o) => c => oddRun(c, { id, name, method, ...o });
const ST = (concept, why, theory) => ({ concept, why, theory });
const COUNT = 'Count it aloud as “{count}”: every 1 is the start of a group and gets the accent. The click is one pulse; the bar is {meter}. ';

export default entry({
  id: 'oddTime', kind: 'subject', title: 'Odd time signatures', domain: 'rhythm',
  re: /odd.?(time|meter)|time signatures?|(5|7|9|11|13|15)\/(4|8)|asymmetric meters?|irregular meters?|compound meters?/,
  aliases: ['odd meters', '5/4 and 7/8', 'asymmetric time', 'prog rock time signatures'],
  summary: 'Bars of 5, 7, 9, 11, 13 or 15 pulses felt as groups of 2s and 3s: counting by group, accents on the group starts, rotating groupings, pentatonic lines and riffs, and phrases that cross the bar.',
  prereqs: ['subdivisions'],
  sources: ['https://www.fundamental-changes.com/odd-time-signatures-on-guitar/', 'https://www.soundbrenner.com/blogs/articles/practice-odd-time-signatures-with-metronome-5-4-7-8-9-8', 'https://www.soundbrenner.com/blogs/articles/make-odd-time-signatures-groove-not-counting', 'https://www.premierguitar.com/obsessive-progressive-get-a-grip-on-odd-meter-time-signatures', 'https://www.premierguitar.com/lessons/obsessive-progressive-john-petrucci'],
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  pedagogy: {
    date: '2026-10-24',
    summary: 'Taught by grouping: split the odd bar into 2s and 3s, count by group instead of to seven, put an accent on every group start, and loop the bar on one note with a click set to the pulse. Meters then come in order of difficulty (5/4, 7/4, 7/8, 9/8, 11/8 and longer), the same bar is re-grouped, and the click is moved from every pulse to the group starts. Pitched riffs and lines come after the feel is solid.',
    sequence: [
      { id: 'groups', tier: 'foundations', step: 'Split the bar into groups of 2 and 3 and count by group', how: 'A bar of 5/4 is 3+2 or 2+3, a bar of 7/8 is 2+2+3; count “1 2 3 1 2”, not to five or seven; one note, accent on each group start.', skills: ['od-count'], source: 1 },
      { id: 'accent', tier: 'foundations', step: 'Accents mark the groups', how: 'Light but clear accents on the first note of every group, with the rest of the group even and quieter, on 5/8 and 6/8.', skills: ['od-accent'], source: 2 },
      { id: 'regroup', tier: 'foundations', step: 'Re-group the same bar', how: '7/8 as 2+2+3, 3+2+2 and 2+3+2: the same seven pulses felt three ways, one grouping per practice block.', skills: ['od-regroup'], source: 1 },
      { id: 'pulse', tier: 'foundations', step: 'A steady pulse under the groups', how: 'Eighths on a palm-muted root in 9/8 and 7/8 with strict alternate picking; the bar starts on a downstroke in one bar and an upstroke in the next when the count is odd.', skills: ['od-pulse'], source: 0 },
      { id: 'meters', tier: 'intermediate', step: 'The common meters in order', how: '7/4 (4+3), 5/4 (2+3), 9/8 (2+2+2+3) and 11/8 (3+3+3+2), each with its drum landmarks.', skills: ['od-meters'], source: 0 },
      { id: 'lines', tier: 'intermediate', step: 'Pitched lines by group', how: 'A minor pentatonic line that restarts at every group start, so the shape of the line shows the grouping.', skills: ['od-pent'], source: 3 },
      { id: 'subdivide', tier: 'intermediate', step: 'Subdivide the pulse', how: 'Click on the eighths while learning, then play eighths or sixteenths inside each pulse and keep the group accents.', skills: ['od-sub'], source: 1 },
      { id: 'stabs', tier: 'intermediate', step: 'Stabs, rests and counted silence', how: 'Chord stabs on the group starts with a group of rest counted through and re-entered on the next first note.', skills: ['od-stabs'], source: 1 },
      { id: 'long', tier: 'advanced', step: 'Long bars: 13/8 and 15/8', how: 'Count 13 as 3+3+3+2+2 and 15 as 4/4 followed by 7/8, tapping the foot on each group start.', skills: ['od-long'], source: 3 },
      { id: 'cycle', tier: 'advanced', step: 'A phrase of another length across the bar', how: 'A cell of 4 pulses over 7/8, or 3 over 5/4, so the accent walks across the barline and lands on the bar start again after several bars.', skills: ['od-cycle'], source: 3 },
      { id: 'rotate', tier: 'advanced', step: 'Rotating the grouping bar by bar', how: 'The groups of the same bar swap each time round (2+2+3, 3+2+2, 2+3+2); two-bar phrases with a cue so the barline is not a reset.', skills: ['od-rotate'], source: 2 },
      { id: 'solo', tier: 'advanced', step: 'Lines that outline the groups', how: 'Sixteenth-note pentatonic lines in 7/8 and 5/4 starting on the group starts.', skills: ['od-solo'], source: 4 },
      { id: 'tempo', tier: 'mastery', step: 'Tempo and endurance in odd bars', how: 'Riffs and lines at performance tempo, eight clean bars before the count lets go.', skills: ['od-tempo'], source: 1 },
      { id: 'mix', tier: 'mastery', step: 'Mixing textures in one bar structure', how: 'Riff, stab and line sections that keep the same meter and the same landmarks.', skills: ['od-mix'], source: 2 },
      { id: 'study', tier: 'mastery', step: 'An original study', how: 'An 8-bar piece in 7/8 and a piece in 4/4 + 7/8 that joins the textures.', skills: ['od-study'], source: 4 }
    ],
    drills: [
      'Count the bar by groups (“1 2 3 1 2”) with the click on every pulse',
      'One palm-muted note with an accent on every group start',
      'The same bar re-grouped (2+2+3, 3+2+2, 2+3+2)',
      'Click on the eighths first, then only on the group starts',
      'Pentatonic line restarting on every group',
      'Counted rests: stay in the count through a silent group and enter on the 1',
      'A cell of another length cycling across the bar'
    ],
    mistakes: [
      'Counting 1 to 7 instead of by group, so 7/8 is mistaken for 7/4',
      'Rushing the long group instead of leaning into its internal count',
      'Losing the 1 after a rest',
      'Making the accents loud instead of clear and light',
      'Letting the click fight the groove instead of using it for landmarks'
    ],
    sources: [
      { title: 'Reading the Meter: How to Play Odd Time Signatures on Guitar', author: 'Fundamental Changes', url: 'https://www.fundamental-changes.com/odd-time-signatures-on-guitar/' },
      { title: 'Practice odd time signatures with a metronome: 5/4, 7/8, 9/8', author: 'Soundbrenner', url: 'https://www.soundbrenner.com/blogs/articles/practice-odd-time-signatures-with-metronome-5-4-7-8-9-8' },
      { title: 'Make odd time signatures groove, not just count', author: 'Soundbrenner', url: 'https://www.soundbrenner.com/blogs/articles/make-odd-time-signatures-groove-not-counting' },
      { title: 'Obsessive Progressive: Get a Grip on Odd Meter Time Signatures', author: 'Premier Guitar', url: 'https://www.premierguitar.com/obsessive-progressive-get-a-grip-on-odd-meter-time-signatures' },
      { title: 'Obsessive Progressive: John Petrucci', author: 'Premier Guitar', url: 'https://www.premierguitar.com/lessons/obsessive-progressive-john-petrucci' }
    ]
  },
  stages: [
    stage('foundations', 'Counting the bar in groups',
      'Play a bar of 5/4 as 3+2 and 7/8 as 2+2+3 on one palm-muted note, accents on the group starts, eight clean bars at 84 BPM per pulse while counting by group.', [
      S('od-count', 'Counting a bar in groups', 'rhythm', 'Count by group, not to five or seven.', [
        OD('od-54-32', 'One note in 5/4 as {groups}, accent on each group start ({key})', 'chunking', { parts: [{ groups: [3, 2], bars: 4, src: 'pm' }], pulse: 'q', goal: 84, start: 52, dl: -1,
          why: 'A bar of five is not “1 2 3 4 5”: it is a group of three and a group of two. Counting by group is what makes the bar feel like a bar.',
          instr: COUNT + 'Palm-mute the open low string, one note per pulse; pick the group starts a little harder. Eight bars with the count out loud, then four bars with the count in your head. Pass: eight clean bars at the goal tempo without losing a group start.',
          watch: 'Counting to five: the second group should restart at “1”.', simplify: 'Clap the count with the click first, then add the guitar.' }),
        OD('od-78-223', 'One note in 7/8 as {groups}, accent on each group start ({key})', 'chunking', { parts: [{ groups: [2, 2, 3], bars: 4, src: 'pm' }], pulse: 'e', goal: 120, start: 72, dl: -1,
          why: 'Seven pulses split into 2+2+3 is the most common way to feel 7/8; the long group comes last.',
          instr: COUNT + 'The click is one eighth note. Palm-mute one note per pulse; accent the three 1s. Pass: eight clean bars at the goal tempo, the long group not rushed.',
          watch: 'Rushing the group of three: it takes the same time per pulse as the twos.', simplify: 'Slow the click until you can say the count comfortably.' })],
        ST('An odd bar is a short run of 2s and 3s: 5 = 3+2 (or 2+3), 7 = 2+2+3.', 'Counting by group gives you the landmarks the whole band uses.', ['Odd meters have an odd top number: the pulses cannot be split into twos only.', 'Counting “1 2 3 1 2” keeps 5/4 from being confused with 3/4 plus extra beats; “1 2 1 2 1 2 3” keeps 7/8 from 7/4.'])),
      S('od-accent', 'Accents mark the groups', 'rhythm', 'Light, clear accents on the group starts.', [
        OD('od-58-32', '5/8 as {groups}: accented root, muted pulses ({key})', 'accurate-reps', { parts: [{ groups: [3, 2], bars: 4, src: 'riff' }], pulse: 'e', goal: 126, start: 76, dl: -1,
          why: 'Five eighths is the shortest odd bar. Accenting the group starts is what shows the ear the 3+2.',
          instr: COUNT + 'Palm-mute the pulses; on each group start let the low E power chord ring for one pulse. Pass: eight bars where the two accents per bar sound even.',
          watch: 'Accents that come late because the muted notes are rushed.', simplify: 'Play only the accents (two per bar) while counting the others silently.' }),
        OD('od-68-33', '6/8 as {groups}: the compound feel, accents on 1 and 4 ({key})', 'accurate-reps', { parts: [{ groups: [3, 3], bars: 4, src: 'riff', pitches: [0, 7] }], pulse: 'e', goal: 126, start: 76, dl: -1,
          why: 'A bar of 6/8 is two groups of three, the compound meter the book methods teach first. The same count as the odd bars, with no odd group.',
          instr: COUNT + 'Palm-mute the pulses; accent the 1 of each group with the low E power chord, then with its fifth (A) on the second group. Pass: eight bars, the two groups equal in length.',
          watch: 'Turning the bar into 3/4 (three quarters): feel two long beats.', simplify: 'Tap your foot on each 1 and count 1 2 3 only in your head.' })],
        ST('The first note of every group gets a light accent.', 'The accent is what the ear hears as the grouping; the notes between stay even.', ['6/8 is two groups of three: a compound meter, familiar, with no odd group.', 'In 5/8 the group of three is felt as longer than the group of two.'])),
      S('od-regroup', 'One bar, three groupings', 'rhythm', '7/8 as 2+2+3, 3+2+2 and 2+3+2.', [
        OD('od-78-322', '7/8 as 3+2+2: the long group first ({key})', 'chunking', { parts: [{ groups: [3, 2, 2], bars: 4, src: 'riff', pitches: [0, 3, 5] }], pulse: 'e', goal: 120, start: 70,
          why: 'The same seven pulses, the long group moved to the front. The bar sounds different although the click is the same.',
          instr: COUNT + 'Palm-mute the pulses; the three accents play the root, ♭3 and 4th as power chords. Pass: eight clean bars, the three accents at the right places every time.',
          watch: 'Falling back to 2+2+3 because it is the familiar one.', simplify: 'Sing “1 2 3 1 2 1 2” on the click, then play.' }),
        OD('od-78-232', '7/8 as 2+3+2: the long group in the middle ({key})', 'chunking', { parts: [{ groups: [2, 3, 2], bars: 4, src: 'riff', pitches: [0, 3, 5] }], pulse: 'e', goal: 120, start: 70,
          why: 'The third grouping of seven: the bar leans into the middle.',
          instr: COUNT + 'Same notes as the last lesson, new landmarks. Pass: eight clean bars without sliding into another grouping.',
          watch: 'Pulling the long group toward the end of the bar.', simplify: 'Play the accents only, counting the other pulses silently.' }),
        OD('od-78-riff', 'A riff in 7/8 as {groups}: power-chord accents ({key})', 'transfer', { parts: [{ groups: [2, 2, 3], bars: 4, src: 'riff', pitches: [0, 0, 3, 0, 8, 7] }], pulse: 'e', goal: 126, start: 76, dl: 1,
          why: 'The first riff in an odd bar: pitched accents on the group starts over a muted pulse.',
          instr: COUNT + 'Palm-mute the pulses; the accents run through the root, ♭3, root, ♭6 and 5th as power chords. Pass: four bars of the riff at the goal tempo with every accent on its group start.',
          watch: 'Accents that fall on the pulses between the group starts.', simplify: 'Keep the root on every accent.' })],
        ST('The same bar can be grouped more than one way.', 'Every band member should agree on one grouping; the groups are the landmarks.', ['2+2+3, 3+2+2 and 2+3+2 are rotations of each other.', 'The click does not change; where the accents fall does.'])),
      S('od-pulse', 'A steady pulse under the groups', 'picking', 'Strict alternate picking through odd bars.', [
        OD('od-98-333', '9/8 as {groups}: strict alternate picking on palm-muted eighths ({key})', 'accurate-reps', { parts: [{ groups: [3, 3, 3], bars: 4, src: 'pm' }], pulse: 'e', goal: 132, start: 80,
          why: 'Nine eighths as three groups of three is a compound bar; picking keeps the eighths even.',
          instr: COUNT + 'Alternate-pick every eighth (down on the 1s), palm muted, with a slightly harder first note of each group. Pass: eight bars with the three groups equal.',
          watch: 'Picking arm tension: the eighths are slow, so stay loose.', simplify: 'Play four bars at a time with a rest bar between.' }),
        OD('od-78-flip', '7/8: the bar starts on a downstroke, then an upstroke ({key})', 'accurate-reps', { parts: [{ groups: [2, 2, 3], bars: 4, src: 'pm' }], pulse: 'e', goal: 126, start: 76, flip: true, dl: 1,
          why: 'With seven pulses per bar, strict alternate picking turns around: bar one starts down, bar two starts up. Players feel this as a bar that is “inside out”.',
          instr: COUNT + 'Alternate-pick every pulse and never reset the stroke at the barline: the first note of bars one and three is a downstroke, of bars two and four an upstroke (marked in the tab). Pass: four bars, the strokes unbroken and the accents on the group starts.',
          watch: 'Resetting to a downstroke on every bar 1: the stroke follows the count, not the bar.', simplify: 'Play two bars at a time, say “down” and “up” out loud at the barline.' })],
        ST('A steady pulse sits under the groups.', 'The pulse is the click; the picking never stops, even when the grouping changes.', ['With an odd number of pulses per bar, alternate picking flips direction at the barline.', '9/8 as 3+3+3 is compound; 2+2+2+3 gives the “long last group” feel.']))
    ], [1, 3]),
    stage('intermediate', 'The common meters, pitched lines and rests',
      'Play 7/4, 9/8 (2+2+2+3) and 11/8 (3+3+3+2) riffs, a pentatonic line that restarts on every group, and a riff with a counted rest group in 7/8, all at 112 BPM per pulse with the accents on the group starts.', [
      S('od-meters', 'The common meters in order', 'rhythm', '7/4, 5/4, 9/8 and 11/8.', [
        OD('od-74-43', '7/4 as {groups}: a long bar of quarters ({key})', 'accurate-reps', { parts: [{ groups: [4, 3], bars: 4, src: 'riff', pitches: [0, 7, 3] }], pulse: 'q', goal: 96, start: 62,
          why: 'Seven quarter notes: a bar of four and a bar of three joined into one. Prog and rock use it a lot.',
          instr: COUNT + 'The click is a quarter note. Palm-mute the pulses; the two accents are the root and the fifth. Pass: eight clean bars, the three-group not rushed.',
          watch: 'Treating the bar as 4/4 plus a short extra bar and losing the 1 of the second group.', simplify: 'Count 1 2 3 4 / 1 2 3 and tap the foot on each 1.' }),
        OD('od-54-23', '5/4 as {groups}: the short group first ({key})', 'accurate-reps', { parts: [{ groups: [2, 3], bars: 4, src: 'riff', pitches: [0, 5] }], pulse: 'q', goal: 100, start: 64,
          why: 'The mirror of 3+2: the same five beats, a very different swing.',
          instr: COUNT + 'Palm-mute the pulses; accents on root then the 4th. Pass: eight bars where the 2+3 sounds different from the 3+2 of the last stage.',
          watch: 'Returning to 3+2 because it feels more familiar.', simplify: 'Alternate one bar of 3+2 and one of 2+3 to hear the difference.' }),
        OD('od-98-2223', '9/8 as {groups}: three short groups, one long ({key})', 'accurate-reps', { parts: [{ groups: [2, 2, 2, 3], bars: 4, src: 'riff', pitches: [0, 0, 3, 7] }], pulse: 'e', goal: 126, start: 76,
          why: 'Nine eighths felt as a 4/4 bar with one extra eighth: the “dragging” bar.',
          instr: COUNT + 'Palm-mute the pulses; the four accents are root, root, ♭3 and fifth. Pass: eight bars, the last group leaning forward without slowing the click.',
          watch: 'Slowing the long group down to make room.', simplify: 'Play the first three groups and count the last one silently.' }),
        OD('od-118-3332', '11/8 as {groups}: ({key})', 'chunking', { parts: [{ groups: [3, 3, 3, 2], bars: 4, src: 'riff', pitches: [0, 3, 5, 7] }], pulse: 'e', goal: 126, start: 72, dl: 1,
          why: 'Eleven pulses are too many to feel as one count; four groups of 3, 3, 3 and 2 give the foot a landmark every few pulses.',
          instr: COUNT + 'Tap the foot on each 1 (an irregular foot pattern). Palm-mute the pulses, accent the four group starts. Pass: eight bars without the count slipping.',
          watch: 'Counting 1 to 11 in your head: group it.', simplify: 'Loop the first two groups only, then add the third and fourth.' })],
        ST('Each common meter has a standard way to be grouped.', 'Knowing the usual grouping lets you play with other musicians and learn the music faster.', ['5/4 is 3+2 or 2+3; 7/4 is 4+3 (or 3+4); 9/8 is 3+3+3 or 2+2+2+3; 11/8 is 3+3+3+2.', 'Drummers mark the groups with the snare and bass drum; listen for them.'])),
      S('od-pent', 'Pentatonic lines by group', 'fretboard', 'A line that restarts on every group start.', [
        OD('od-pent-78', '7/8 as {groups}: a minor pentatonic line starting again on every group ({key}, box 1)', 'chunking', { parts: [{ groups: [2, 2, 3], bars: 4, src: 'pent', starts: [0, 3, 6], step: 1 }], pulse: 'e', goal: 116, start: 70,
          why: 'A line that climbs from a new note at each group start shows the grouping in the pitches, not only in the accents.',
          instr: COUNT + 'One note per pulse in minor pentatonic box 1 of the key, climbing from a new starting note at each group (the tab shows which). Alternate pick. Pass: four bars at the goal tempo with every note in the box and every group start on the click.',
          watch: 'Letting the line run on past the group start.', simplify: 'Play the first note of each group only, then add the others.' }),
        OD('od-pent-54', '5/4 as {groups}: pentatonic 8ths, a new start on each group ({key}, box 1)', 'chunking', { parts: [{ groups: [3, 2], bars: 4, src: 'pent', sub: 2, starts: [0, 4], step: 1 }], pulse: 'q', goal: 96, start: 62, dl: 1,
          why: 'Eighth notes inside a quarter-note pulse: the line and the grouping together.',
          instr: COUNT + 'Two eighths per pulse, strict alternate picking, the line restarting at each group start. Pass: four bars at the goal tempo with the groups of three and two even.',
          watch: 'Picking the group of two shorter than it is.', simplify: 'Play it as quarters first.' }),
        OD('od-pent-98', '9/8 as {groups}: pentatonic lines in threes ({key}, box 1)', 'chunking', { parts: [{ groups: [3, 3, 3], bars: 4, src: 'pent', starts: [0, 2, 4], step: 2 }], pulse: 'e', goal: 126, start: 76,
          why: 'In a compound bar a three-note line per group is the natural shape: the pentatonic skipping every other note.',
          instr: COUNT + 'Skip a scale note between each pick (steps of two in the box), restart at each group. Pass: four bars, even and in the box.',
          watch: 'Rushing the last note of each group.', simplify: 'Keep steps of one.' })],
        ST('A line that restarts on each group shows the meter in its shape.', 'You hear the grouping in the pitches as well as the accents.', ['All the notes come from minor pentatonic box 1 of the key.', 'Group starts are where a new run begins; the contour does the counting.'])),
      S('od-sub', 'Subdividing the pulse', 'rhythm', 'Eighths and sixteenths inside each pulse.', [
        OD('od-sub-54', '5/4 as {groups} in eighth notes, accented group starts ({key})', 'chunking', { parts: [{ groups: [3, 2], bars: 4, src: 'riff', sub: 2, pitches: [0, 7] }], pulse: 'q', goal: 100, start: 64,
          why: 'Click on quarters while playing eighths: the bar now has ten notes, still felt in two groups.',
          instr: COUNT + 'Palm-mute eighth notes (two per pulse), strict alternate picking, the group starts ring as power chords. Pass: eight bars with the accent on every group start.',
          watch: 'Accenting every beat instead of the group starts.', simplify: 'Click on the eighths while learning.' }),
        OD('od-sub-78', '7/8 as {groups} in sixteenth notes ({key})', 'chunking', { parts: [{ groups: [2, 2, 3], bars: 4, src: 'riff', sub: 2, pitches: [0, 3, 0] }], pulse: 'e', goal: 100, start: 60, dl: 1,
          why: 'Sixteenths inside an eighth-note pulse: 14 notes a bar, the density of a metal riff.',
          instr: COUNT + 'Palm-mute sixteenths, alternate picking, accents on the group starts. Pass: four bars, the sixteenths even and the accents on the click.',
          watch: 'Picking hand running ahead on the long group.', simplify: 'Play it in eighths first.' }),
        OD('od-sub-68', '6/8 in sixteenth notes: two groups of three ({key})', 'chunking', { parts: [{ groups: [3, 3], bars: 4, src: 'riff', sub: 2, pitches: [0, 5] }], pulse: 'e', goal: 104, start: 62,
          why: 'The compound feel with a busier subdivision.',
          instr: COUNT + 'Sixteenths, alternate picking, accents on 1 and 4. Pass: four bars at the goal tempo.',
          watch: 'Tension in the picking hand when the notes double.', simplify: 'Play quarters then eighths of the pulse.' })],
        ST('Subdividing the pulse adds notes, not beats.', 'The sources start with the click on the eighths and move it to the group starts later.', ['Two notes per pulse doubles the density without changing the count.', 'The groups remain the landmarks.'])),
      S('od-stabs', 'Stabs, rests and counted silence', 'rhythm', 'Chord stabs and a group of rest.', [
        OD('od-stab-78', '7/8 stabs on {groups} with a rest group ({key})', 'transfer', { parts: [{ groups: [2, 2, 3], bars: 4, src: 'stab', rests: [2], pitches: [0, 8, 7] }], pulse: 'e', goal: 116, start: 70,
          why: 'Rests are part of the riff: you count through the silent group and enter on the next 1.',
          instr: COUNT + 'Power-chord stabs on the group starts and one silent group (the second); keep the pick hand moving in the air. Pass: four bars with every entrance on the group start after the rest.',
          watch: 'Losing the 1 after the rest: keep counting through the silent group.', simplify: 'Play all three stabs, then drop the second.' }),
        OD('od-stab-54', '5/4 stabs on {groups}, the second group silent ({key})', 'transfer', { parts: [{ groups: [3, 2], bars: 4, src: 'stab', rests: [2], pitches: [0, 5] }], pulse: 'q', goal: 100, start: 64,
          why: 'Half the bar is silence: the entrance of the next bar has to come on the 1.',
          instr: COUNT + 'A stab on the first group start, the second group silent. Pass: eight bars with every entrance on the 1.',
          watch: 'Entering early because the silence feels long.', simplify: 'Tap the foot through the rest.' }),
        OD('od-stab-98', '9/8 stabs on {groups} ({key})', 'transfer', { parts: [{ groups: [2, 2, 2, 3], bars: 4, src: 'stab', rests: [3], pitches: [0, 3, 7] }], pulse: 'e', goal: 120, start: 72, dl: 1,
          why: 'Four groups, one rested: a riff in a longer bar.',
          instr: COUNT + 'Stabs on three of the four group starts, the third silent. Pass: eight bars without the 1 slipping.',
          watch: 'Pulling the long last group back toward the beat.', simplify: 'Keep stabs on all four group starts first.' })],
        ST('Rests are counted, not skipped.', 'An odd riff is as much about where it is silent as where it plays.', ['Count through the silent group and enter on the next 1.', 'Treat the click as a landmark, not a strict 1.']))
    ], [4, 6]),
    stage('advanced', 'Long bars, phrases across the bar, rotating groupings',
      'Play a 13/8 and a 15/8 (4/4 then 7/8) riff, a four-pulse phrase across 7/8 that lands back on the bar start, rotating groupings of 7/8 and sixteenth-note pentatonic lines on the group starts at 120 BPM per pulse.', [
      S('od-long', 'Long bars: 13/8 and 15/8', 'rhythm', 'Count by group, tap on the 1s.', [
        OD('od-138-33322', '13/8 as {groups} ({key})', 'chunking', { parts: [{ groups: [3, 3, 3, 2, 2], bars: 4, src: 'riff', pitches: [0, 3, 5, 7, 8] }], pulse: 'e', goal: 126, start: 74,
          why: 'Thirteen pulses are five groups; the foot taps five times a bar.',
          instr: COUNT + 'Tap the foot on each 1. Palm-mute the pulses; accents on the five group starts. Pass: four bars without the count slipping.',
          watch: 'Counting to 13.', simplify: 'Loop the first three groups.' }),
        OD('od-158-4478', '15/8 as 4/4 followed by 7/8 ({key})', 'chunking', { parts: [{ groups: [2, 2, 2, 2, 2, 2, 3], bars: 4, src: 'riff', pitches: [0, 0, 3, 0, 8, 0, 7] }], pulse: 'e', goal: 126, start: 74, dl: 1,
          why: 'Fifteen pulses as eight (4/4) plus seven (7/8) is the way the Petrucci lesson from Premier Guitar combines an even and an odd bar.',
          instr: COUNT + 'Think of a bar of 4/4 followed by a bar of 7/8 joined without a break. Palm-mute the pulses; accents on the seven group starts. Pass: four bars without the count slipping at the join.',
          watch: 'Treating the join as a barline and adding a pause.', simplify: 'Play the 4/4 half twice, then the 7/8 half twice, then join them.' })],
        ST('Long bars are strings of short groups.', 'Tap the foot on each group start and the bar becomes a few landmarks.', ['13/8 = 3+3+3+2+2.', '15/8 can be 4/4 + 7/8 (2+2+2+2+2+2+3).'])),
      S('od-cycle', 'A phrase of another length across the bar', 'rhythm', 'A four-pulse cell over 7/8, a three-pulse cell over 5/4.', [
        OD('od-cyc-4-78', 'Four-pulse phrase across 7/8: back on the bar start after 4 bars ({key})', 'edge', { parts: [{ groups: [2, 2, 3], bars: 4, src: 'cycle', cycle: 4, pitches: [0, 3, 0, 8, 7] }], pulse: 'e', goal: 126, start: 76, dl: 1,
          why: 'A cell of four pulses repeats against a bar of seven: the accent walks across the barline and meets the bar start after four bars.',
          instr: 'The click is one eighth note; the bar is 7/8 ({count}). Palm-mute the pulses and let a power chord ring every fourth pulse (the pitches change on each accent). The bar start is the 1 of the count; the accents will not always land there. Pass: four bars, the accent back on the 1 at the end.',
          watch: 'Pulling the cell back to the bar start.', simplify: 'Play two bars and stop.' }),
        OD('od-cyc-3-54', 'Three-pulse phrase across 5/4: back on the bar start after 3 bars ({key})', 'edge', { parts: [{ groups: [3, 2], bars: 3, src: 'cycle', cycle: 3, pitches: [0, 7, 3, 5] }], pulse: 'q', goal: 96, start: 62, dl: 1,
          why: 'Three against five: the cell realigns after fifteen pulses (three bars).',
          instr: 'The click is a quarter note; the bar is 5/4 ({count}). A power-chord accent every third pulse, palm-muted pulses between. Pass: three bars, the accent on the 1 at the end.',
          watch: 'Losing the bar start while following the cell.', simplify: 'Count the cell out loud, then count the bar.' })],
        ST('A phrase of another length slides across the bar.', 'The same idea as cross rhythms in 4/4, in an odd bar.', ['4 and 7 realign after 28 pulses (4 bars); 3 and 5 realign after 15 pulses (3 bars).', 'The bar count is the anchor; the cell is the colour.'])),
      S('od-rotate', 'Rotating the grouping bar by bar', 'rhythm', 'The same 7/8 grouped three ways in three bars.', [
        OD('od-rot-78', '7/8: {groups}, 3+2+2, 2+3+2 and round again ({key})', 'interleaving', { parts: [{ groupSets: [[2, 2, 3], [3, 2, 2], [2, 3, 2]], bars: 6, src: 'riff', pitches: [0, 3, 5] }], pulse: 'e', goal: 120, start: 72, dl: 1,
          why: 'The accents move bar by bar while the pulse stays put.',
          instr: 'The click is one eighth note. Bars rotate 2+2+3, 3+2+2, 2+3+2 (the tab shows the accents). Palm-mute the pulses; accent the group starts. Pass: six bars (two rotations) without an accent in the wrong place.',
          watch: 'Staying in the first grouping.', simplify: 'Play each grouping for two bars before rotating.' }),
        OD('od-rot-54', '5/4: {groups} then 2+3, then round again ({key})', 'interleaving', { parts: [{ groupSets: [[3, 2], [2, 3]], bars: 4, src: 'riff', pitches: [0, 5] }], pulse: 'q', goal: 100, start: 64,
          why: 'Two bars of 5/4 grouped differently make a ten-pulse phrase.',
          instr: 'The click is a quarter note. Bar one 3+2, bar two 2+3, repeated. Pass: eight bars with the groups swapping on time.',
          watch: 'Letting bar two fall back to 3+2.', simplify: 'Play each grouping for two bars.' })],
        ST('Moving the groups moves the feel.', 'Two-bar phrases give the second bar a small change so the barline does not feel like a reset.', ['The three rotations of 2+2+3 are 2+2+3, 3+2+2, 2+3+2.', 'The tab marks the accents so you can see the rotation.'])),
      S('od-solo', 'Lines that outline the groups', 'improv', 'Sixteenth-note pentatonic lines starting on the group starts.', [
        OD('od-solo-78', '7/8 as {groups}: sixteenth-note pentatonic lines from each group start ({key}, box 1)', 'transfer', { parts: [{ groups: [2, 2, 3], bars: 4, src: 'pent', sub: 2, starts: [0, 4, 7], step: 1 }], pulse: 'e', goal: 100, start: 60, dl: 1,
          why: 'Soloing in an odd bar: the line restarts at every group start so the player stays inside the count.',
          instr: COUNT + 'Sixteenth notes in minor pentatonic box 1, alternate picking, a new starting note at each group (the tab shows which). Pass: four bars at the goal tempo, every group start on the click.',
          watch: 'Losing the count when the notes speed up.', simplify: 'Play eighths first.' }),
        OD('od-solo-54', '5/4 as {groups}: sixteenth-note pentatonic lines ({key}, box 1)', 'transfer', { parts: [{ groups: [3, 2], bars: 4, src: 'pent', sub: 4, starts: [0, 5], step: 1 }], pulse: 'q', goal: 84, start: 52, dl: 1,
          why: 'Four notes per pulse across five beats: twenty notes a bar, felt as two groups.',
          instr: COUNT + 'Sixteenths, alternate picking, a new run at each group start. Pass: four bars, even sixteenths and accurate group starts.',
          watch: 'Tension in the picking hand.', simplify: 'Play the pulse in eighths first.' })],
        ST('A line in an odd bar still obeys the groups.', 'Fast lines work only when the group starts are exact.', ['Notes come from minor pentatonic box 1.', 'The start note at each group changes so the contour shows the grouping.']))
    ], [7, 8]),
    stage('mastery', 'Tempo, mixed textures and an original study',
      'Play a 7/8 riff and a 5/4 sixteenth-note line at performance tempo, mix riff, stab and line sections in one bar structure, and play an original study in 7/8 and one in 4/4 + 7/8.', [
      S('od-tempo', 'Tempo and endurance in odd bars', 'rhythm', 'Eight clean bars at speed.', [
        OD('od-perf-78', '7/8 riff at performance tempo, eight bars ({key})', 'edge', { parts: [{ groups: [2, 2, 3], bars: 8, src: 'riff', sub: 2, pitches: [0, 0, 3, 0, 8, 7] }], pulse: 'e', goal: 120, start: 80, minutes: 6,
          why: 'Endurance: eight bars of sixteenths in 7/8 where neither the count nor the picking falls apart.',
          instr: COUNT + 'Sixteenth-note palm-muted pulses, power-chord accents on the group starts. Pass: eight bars at the goal tempo with the count and the picking intact.',
          watch: 'Tension building in the picking arm after bar four.', simplify: 'Play four bars, rest, play four.' }),
        OD('od-perf-54', '5/4 sixteenth-note pentatonic lines at tempo ({key}, box 1)', 'edge', { parts: [{ groups: [3, 2], bars: 8, src: 'pent', sub: 4, starts: [0, 5], step: 1 }], pulse: 'q', goal: 96, start: 64, minutes: 6,
          why: 'The fast line in a five-beat bar held for eight bars.',
          instr: COUNT + 'Sixteenths, alternate picking, a new run at each group start. Pass: eight bars at the goal tempo without dropping a note out of the box.',
          watch: 'Sliding into a four-beat feel.', simplify: 'Four bars, then four.' })],
        ST('Tempo comes after the count is automatic.', 'Eight clean bars at speed show that the grouping no longer needs thinking.', ['Raise the tempo by small steps.', 'Rest between sets to keep the picking arm loose.'])),
      S('od-mix', 'Mixing textures in one bar structure', 'improv', 'Riff, stab and line sections keep the same meter.', [
        OD('od-mix-78', '7/8: riff, stabs, pentatonic line, riff ({key})', 'transfer', { parts: [{ groups: [2, 2, 3], bars: 2, src: 'riff', pitches: [0, 0, 3, 0, 8, 7] }, { groups: [2, 2, 3], bars: 2, src: 'stab', rests: [2], pitches: [0, 8, 7] }, { groups: [2, 2, 3], bars: 2, src: 'pent', sub: 2, starts: [0, 4, 7], step: 1 }, { groups: [2, 2, 3], bars: 2, src: 'riff', pitches: [0, 3, 5] }], pulse: 'e', goal: 104, start: 64, dl: 1, minutes: 8,
          why: 'Four textures in eight bars that share one count.',
          instr: COUNT + 'Bars 1–2 a riff, 3–4 stabs with a rest group, 5–6 a sixteenth-note pentatonic line, 7–8 a closing riff. Pass: eight bars without the count slipping at a texture change.',
          watch: 'Pausing at the change.', simplify: 'Play each section on its own.' }),
        OD('od-mix-54', '5/4: stabs, a pentatonic line, then a three-pulse cell across the bar ({key})', 'transfer', { parts: [{ groups: [3, 2], bars: 2, src: 'stab', rests: [2], pitches: [0, 5] }, { groups: [3, 2], bars: 2, src: 'pent', sub: 2, starts: [0, 4], step: 1 }, { groups: [3, 2], bars: 3, src: 'cycle', cycle: 3, pitches: [0, 7, 3, 5] }], pulse: 'q', goal: 96, start: 62, dl: 1, minutes: 8,
          why: 'The textures of this stage in the shorter odd bar.',
          instr: COUNT + 'Bars 1–2 stabs, 3–4 a pentatonic line in eighths, 5–7 the three-pulse cell. Pass: seven bars without losing the 1.',
          watch: 'Treating the cell as a new bar.', simplify: 'Play each section on its own.' })],
        ST('Textures change; the count does not.', 'A real odd-meter piece changes texture while the groups stay the landmarks.', ['Stabs, runs and cycles use the same bar.', 'The 1 at each texture change is where players get lost.'])),
      S('od-study', 'An original study', 'improv', 'Eight bars in 7/8 and a piece in 4/4 + 7/8.', [
        OD('od-capstone-78', 'Capstone study: eight bars in 7/8, riff, stabs, line and riff ({key})', 'transfer', { parts: [{ groups: [2, 2, 3], bars: 2, src: 'riff', sub: 2, pitches: [0, 0, 3, 0, 8, 7] }, { groupSets: [[2, 2, 3], [3, 2, 2]], bars: 2, src: 'riff', pitches: [0, 3, 5] }, { groups: [2, 2, 3], bars: 2, src: 'pent', sub: 2, starts: [0, 4, 7], step: 1 }, { groups: [2, 2, 3], bars: 2, src: 'stab', rests: [2], pitches: [0, 8, 7] }], pulse: 'e', goal: 100, start: 60, dl: 1, minutes: 10,
          why: 'The whole subject in one piece: sixteenths, a rotating grouping, a line and a stab section.',
          instr: COUNT + 'Bars 1–2 a sixteenth-note riff, 3–4 the grouping rotates to 3+2+2, 5–6 a pentatonic line, 7–8 stabs with a rest group. Pass: the study start to finish at the goal tempo, the count intact.',
          watch: 'Losing the group after the rotation in bar 4.', simplify: 'Play two bars at a time.' }),
        OD('od-capstone-158', 'Capstone study: 4/4 + 7/8 in 15/8, riff, line and stabs ({key})', 'transfer', { parts: [{ groups: [2, 2, 2, 2, 2, 2, 3], bars: 2, src: 'riff', pitches: [0, 0, 3, 0, 8, 0, 7] }, { groups: [2, 2, 2, 2, 2, 2, 3], bars: 1, src: 'pent', sub: 2, starts: [0, 2, 4, 6, 8, 10, 7], step: 1 }, { groups: [2, 2, 2, 2, 2, 2, 3], bars: 1, src: 'stab', rests: [6], pitches: [0, 8, 7] }], pulse: 'e', goal: 96, start: 58, dl: 1, minutes: 10,
          why: 'The way a long bar is built into a piece: an even half and an odd half joined, then different textures over the same landmarks.',
          instr: COUNT + 'Bars 1–2 a riff, bar 3 a sixteenth-note pentatonic line, bar 4 stabs with the sixth group silent. Pass: four bars at the goal tempo with the join between the 4/4 half and the 7/8 half clean.',
          watch: 'A pause at the join.', simplify: 'Play the 4/4 half and the 7/8 half separately.' })],
        ST('The capstone combines the whole subject.', 'A study proves that the count and the textures work together.', ['Each section keeps the same bar structure.', 'Write your own: choose a meter, a grouping and three textures.']))
    ], [9, 10])
  ]
});
