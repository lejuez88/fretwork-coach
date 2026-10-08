// Variations: every exercise comes in several versions at different
// difficulties, so a skill can spiral: same skill, new fingering, position,
// rhythm, pattern or key. Three sources, combined and de-duplicated:
//   1. Generated exercises (atoms) are re-run with different settings: scale
//      patterns and positions, strum patterns, chord sets, inversions, keys.
//   2. Hand-written families for classic drills (the spider gets a dozen
//      finger orders, positions and string patterns; bends, palm-muted chugs,
//      power-chord shifts, tapping and picking bursts get their own ladders).
//   3. General transforms that work on any tab or chord exercise: half-time,
//      a looped first half, reversed, triplets, 16ths, double-picking, a new
//      position, starting on the "&", a simplified version, a pushed tempo,
//      a gap click, eyes off the neck, a new key.
// Results are deterministic, so a variation's id (base id + "~" + vid) is a
// stable key for its own progress.
import { runAtom, styleTreeRaw } from './styles.js';
import { normalizeExercise } from './coursegen.js';
import { parseChord, chordName, mod12, ROOT_BY_PC } from './theory.js';
import { spiderClimb } from '../tools/exercises.js';

const clampL = v => Math.max(1, Math.min(10, Math.round(v)));
const keyName = pc => ROOT_BY_PC[mod12(pc)].name;
const clone = o => JSON.parse(JSON.stringify(o));
const round = v => Math.round(v);

/* ----------------------------- Tab helpers ----------------------------- */
const notesOf = ex => (ex && ex.tab && Array.isArray(ex.tab.notes) ? ex.tab.notes : []);
const isLine = notes => notes.length > 0 && !notes.some(n => n.chord);
const endOf = notes => notes.reduce((m, n) => Math.max(m, n.t + n.d), 0);
function mainStep(notes) {
  const c = {}; notes.forEach(n => { const k = n.d.toFixed(3); c[k] = (c[k] || 0) + 1; });
  return +Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
}
const fix = n => ({ ...n, t: +n.t.toFixed(4), d: +n.d.toFixed(4) });
function withTab(ex, notes, extra = {}) {
  const bpb = ex.beatsPerBar || 4;
  const out = clone(ex);
  delete out.libId;
  out.tab = { ...(ex.tab || {}), notes: notes.map(fix), beats: Math.max(bpb, Math.ceil(endOf(notes) / bpb - 1e-6) * bpb) };
  return Object.assign(out, extra);
}
const tempoScale = (ex, k) => ({ goalBpm: Math.max(40, round(ex.goalBpm * k)), startBpm: Math.max(30, round((ex.startBpm || ex.goalBpm * 0.6) * k)) });
const N = (s, f, t, d, x, extra) => ({ t, d, s, f, ...(x ? { x } : {}), ...(extra || {}) });
const seqNotes = (list, step, t0 = 0) => list.map(([s, f, x, bendTo], i) => N(s, f, t0 + i * step, step, x, bendTo != null ? { bendTo } : null));

/* --------------------------- General transforms --------------------------- */
// Each returns {vid, label, change, dl, ex} or null when it doesn't apply.
const GENERIC = [
  function simplified(ex) {
    if (!ex.simplify) return null;
    return { vid: 'simp', label: 'Simplified', change: ex.simplify, dl: -1,
      ex: { ...clone(ex), instr: `${ex.simplify} When that is clean at the target, go back to the full version.`, ...tempoScale(ex, 0.85) } };
  },
  function halfTime(ex) {
    const n = notesOf(ex); if (n.length < 4 || mainStep(n) > 0.5) return null;
    return { vid: 'half', label: 'Half-time', change: 'Same notes, twice as long each: time to place every note.', dl: -1, ex: withTab(ex, n.map(x => ({ ...x, t: x.t * 2, d: x.d * 2 }))) };
  },
  function firstHalf(ex) {
    const n = notesOf(ex); const len = (ex.tab && ex.tab.beats) || endOf(n); if (len < 8) return null;
    const cut = Math.floor(len / 2 / (ex.beatsPerBar || 4)) * (ex.beatsPerBar || 4) || len / 2;
    const part = n.filter(x => x.t < cut - 1e-6); if (part.length < 4 || part.length === n.length) return null;
    return { vid: 'loop', label: 'First half, looped', change: 'Just the first half, on repeat, until it is automatic.', dl: -1, ex: withTab(ex, part) };
  },
  function reversed(ex) {
    const n = notesOf(ex); if (!isLine(n) || n.length < 6 || n.some(x => x.x === 'b' || x.x === 't')) return null;
    const swap = { h: 'p', p: 'h', '/': '\\', '\\': '/' };
    const rev = [...n].reverse().map((x, i) => ({ ...x, t: n[i].t, d: n[i].d, ...(x.x && swap[x.x] ? { x: swap[x.x] } : {}) }));
    return { vid: 'rev', label: 'Reversed', change: 'The same pattern from the other end: new muscle memory, same notes.', dl: 0, ex: withTab(ex, rev) };
  },
  function triplets(ex) {
    const n = notesOf(ex); if (!isLine(n) || n.length < 6 || Math.abs(mainStep(n) - 0.5) > 0.01) return null;
    return { vid: 'trip', label: 'Triplets', change: 'Three notes per click: the accent moves around the pattern.', dl: 1,
      ex: withTab(ex, n.map(x => ({ ...x, t: x.t * 2 / 3, d: x.d * 2 / 3 })), { unit: 'triplets', ...tempoScale(ex, 0.85) }) };
  },
  function sixteenths(ex) {
    const n = notesOf(ex); if (!isLine(n) || n.length < 6 || Math.abs(mainStep(n) - 0.5) > 0.01) return null;
    const half = n.map(x => ({ ...x, t: x.t / 2, d: x.d / 2 })), span = endOf(n) / 2;
    return { vid: 'x16', label: '16th notes', change: 'Double time: four notes per click.', dl: 2,
      ex: withTab(ex, [...half, ...half.map(x => ({ ...x, t: x.t + span }))], { unit: '16ths', ...tempoScale(ex, 0.68) }) };
  },
  function doublePicked(ex) {
    const n = notesOf(ex); if (!isLine(n) || n.length < 4 || mainStep(n) < 0.5 || n.some(x => ['h', 'p', 'b', 't', '/', '\\'].includes(x.x))) return null;
    const out = n.flatMap(x => [{ ...x, d: x.d / 2 }, { ...x, t: x.t + x.d / 2, d: x.d / 2 }]);
    return { vid: 'dbl', label: 'Double-picked', change: 'Every note twice (down-up): a picking-hand workout.', dl: 1, ex: withTab(ex, out, { picking: 'alternate', ...tempoScale(ex, 0.75) }) };
  },
  function newPosition(ex) {
    const n = notesOf(ex); if (n.length < 4) return null;
    const lo = Math.min(...n.map(x => x.f)), hi = Math.max(...n.map(x => x.f));
    let by = 0;
    if (hi + 5 <= 17) by = 5; else if (lo >= 5) by = -5;
    if (!by) return null;
    const hadOpen = n.some(x => x.f === 0);
    return { vid: by > 0 ? 'up5' : 'dn5', label: by > 0 ? 'Up 5 frets' : 'Down 5 frets', change: `The same shape ${by > 0 ? 'higher' : 'lower'} on the neck${hadOpen ? ', with the open strings now fretted' : ''}.`, dl: hadOpen ? 1 : 0,
      ex: withTab(ex, n.map(x => ({ ...x, f: x.f + by, ...(x.bendTo != null ? { bendTo: x.bendTo + by } : {}) }))) };
  },
  function offbeat(ex) {
    const n = notesOf(ex); if (n.length < 4 || mainStep(n) > 0.5) return null;
    return { vid: 'off', label: 'Start on the “&”', change: 'Everything shifted half a beat: the click lands between your notes.', dl: 1, ex: withTab(ex, n.map(x => ({ ...x, t: x.t + 0.5 }))) };
  },
  function pushed(ex) {
    if (!ex.goalBpm || ex.goalBpm >= 240) return null;
    return { vid: 'push', label: 'Push the tempo', change: `Goal raised to ${round(ex.goalBpm * 1.15)} BPM.`, dl: 1, ex: { ...clone(ex), goalBpm: Math.min(260, round(ex.goalBpm * 1.15)) } };
  },
  function gapClick(ex) {
    if (notesOf(ex).length || ex.metroMode === 'gap') return null;
    return { vid: 'gap', label: 'Gap click', change: 'The click drops out for bars at a time; keep the time yourself.', dl: 1, ex: { ...clone(ex), metroMode: 'gap' } };
  },
  function eyesOff(ex) {
    if (!['fretting', 'fretboard', 'theory'].includes(ex.domain)) return null;
    return { vid: 'blind', label: 'Eyes off the neck', change: 'Look away (or close your eyes) and play by feel.', dl: 1,
      ex: { ...clone(ex), instr: `${ex.instr ? ex.instr + ' ' : ''}Now look away from the fretboard (or close your eyes) and play it by feel.` } };
  },
  function newKey(ex) {
    if (notesOf(ex).length) return null;
    const src = (ex.chords || []).length ? ex.chords : (ex.backing || []);
    if (!src.length) return null;
    const moved = transposeChords(src, 5); if (!moved) return null;
    const out = { ...clone(ex), ...((ex.chords || []).length ? { chords: moved } : {}), backing: ex.backing && ex.backing.length ? (transposeChords(ex.backing, 5) || moved) : [] };
    delete out.voicings;
    return { vid: 'key5', label: 'New key', change: `The same changes up a 4th: ${moved.join(' – ')}.`, dl: 1, ex: out };
  }
];

// Practice ideas for exercises without a fixed tab (soloing, ear, rhythm, theory):
// the material stays, the task changes. [vid, label, change, dl, instruction]
const IDEAS = {
  improv: [
    ['space', 'Leave space', 'Play two bars, rest two bars.', -1, 'Play for two bars, then rest for two. Use the rests to hear what comes next.'],
    ['motif', 'One rhythm', 'Solo with a single repeated rhythm.', 0, 'Pick one short rhythm and use only that rhythm for 8 bars; change the notes, not the rhythm.'],
    ['onestr', 'One string', 'Solo along a single string.', 1, 'Solo on one string only (start with the G string), sliding between positions.'],
    ['third', 'Land on 3rds', 'Aim every phrase at the chord’s 3rd.', 2, 'End every phrase on the 3rd of the chord that is playing. Find each 3rd before the loop starts.']
  ],
  ear: [
    ['hum', 'Hum first', 'Hum each phrase before you look for it.', -1, 'Hum or sing the phrase first, then find it on the neck. Start each search on the first note only.'],
    ['four', '4-bar phrases', 'Longer phrases to remember.', 1, 'Use 4-bar phrases instead of 2-bar ones.'],
    ['nolook', 'No looking', 'Find the notes without looking at the neck.', 1, 'Find the notes by ear and feel, eyes off the fretboard.']
  ],
  rhythm: [
    ['mute', 'Muted strums only', 'Just the rhythm, no chord shapes.', -1, 'Mute all the strings with the fretting hand and play only the rhythm.'],
    ['accent', 'Off-beat accents', 'Accent every “&”.', 1, 'Accent every off-beat (“&”) while the downbeats stay soft.'],
    ['count', 'Count aloud', 'Say the counts while you play.', 0, 'Count every subdivision out loud (“1 e & a”) while you play.']
  ],
  theory: [
    ['say', 'Say every name', 'Name each note or chord tone aloud.', 0, 'Say the name (or interval) of every note out loud as you play it.'],
    ['other', 'New starting point', 'Start from a different string or fret.', 1, 'Start the same exercise from a different string or position.']
  ],
  fretboard: [
    ['say', 'Say every name', 'Name each note aloud.', 0, 'Say every note name out loud as you play it.'],
    ['timed', 'Race the click', 'One beat per note, no pauses.', 1, 'No pauses allowed: every note lands on the next click, or you start over.']
  ],
  repertoire: [
    ['loop', 'Hardest bar on loop', 'Isolate the hardest bar.', -1, 'Loop only the hardest bar until it is clean, then add the bar before it.'],
    ['perform', 'Performance pass', 'Play it through without stopping.', 1, 'Play the whole thing once without stopping, whatever happens.']
  ]
};
function ideaVariations(ex) {
  if (notesOf(ex).length) return [];
  return (IDEAS[ex.domain] || []).map(([vid, label, change, dl, instr]) => ({ vid: 'i-' + vid, label, change, dl, ex: { ...clone(ex), instr: `${instr}${ex.instr ? ' ' + ex.instr : ''}` } }));
}

/** Re-apply a general transform (or a practice idea) to a rebuilt exercise. Returns the new exercise or null. */
export function reapplyTransform(xform, ex) {
  if (!xform || !ex) return null;
  if (xform.startsWith('i-')) { const v = ideaVariations(ex).find(x => x.vid === xform); return v ? v.ex : null; }
  for (const fn of GENERIC) { try { const v = fn(ex); if (v && v.vid === xform) return v.ex; } catch { /* skip */ } }
  return null;
}

export function transposeChords(list, semis) {
  const out = list.map(nm => { const c = parseChord(nm); return c ? chordName(mod12(c.root.pc + semis), c.type) : null; });
  return out.every(Boolean) ? out : null;
}

/* ------------------------- Atom-based variations ------------------------- */
const PROG_LABEL = { folk145: 'I–IV–V', axis: 'I–V–vi–IV', folkAxis: 'I–vi–IV–V', capo: 'I–vi–iii–IV', country: 'I–IV–I–V', iiVI: 'ii–V–I', iiVIminor: 'minor ii–V–i', royal: 'IV–V–iii–vi', neo: 'IVmaj7–iii–ii–I', blues: 'blues changes', minorRock: 'i–♭VI–♭VII', dorianVamp: 'Dorian vamp', andalusian: 'Andalusian cadence', mixo: 'I–♭VII–IV' };
const PROG_SETS = {
  jazz: [['iiVI', 0], ['iiVIminor', 1], ['royal', 1], ['neo', 1]],
  folk: [['folk145', -1], ['axis', 0], ['folkAxis', 0], ['capo', 1]],
  solo: [['blues', 0], ['minorRock', 0], ['axis', 0], ['dorianVamp', 1], ['andalusian', 1]]
};
const PROG_GROUP = { shellComp: 'jazz', drop2Comp: 'jazz', guideTones: 'jazz', embellish: 'jazz', boomChicka: 'folk', travisPattern: 'folk', pimaArpeggio: 'folk', openDrone: 'folk', triadProgression: 'folk', strumPattern: 'folk', rasgueado: 'folk',
  targetSolo: 'solo', callResponse: 'solo', echoPhrases: 'solo', earKey: 'solo', gapClick: 'solo' };
const STRUM_DL = { folk: -1, pop: 0, ballad: 0, rock8: 0, country: 1, reggae: 1, punk: 1 };
const STRUM_LABEL = { folk: 'Folk strum', pop: 'Pop strum', ballad: 'Ballad strum', rock8: 'Straight 8ths', country: 'Bass–strum (country)', reggae: 'Off-beat chops', punk: 'All downstrokes' };

/** Settings-only variants per atom. add(vid, label, change, dl, optsPatch, cPatch) */
const VARY = {
  scaleRun(o, c, add) {
    const box = o.box || 1;
    if (o.unit !== 'quarters') add('q', 'Quarter notes', 'One note per beat: lock in the shape and the root notes.', -2, { unit: 'quarters' });
    if (o.pattern !== 'threes') add('g3', 'Groups of 3', 'Three notes up, then start one note higher.', 1, { pattern: 'threes' });
    if (o.pattern !== 'fours') add('g4', 'Groups of 4', 'Four notes up, then start one note higher.', 1, { pattern: 'fours' });
    if (o.pattern !== 'thirds') add('in3', 'In 3rds', 'Skip a note, step back: the sound of melodic lines.', 2, { pattern: 'thirds' });
    if (o.unit !== 'triplets') add('trip', 'Triplets', 'Three notes per click.', 1, { unit: 'triplets' });
    if (o.unit !== '16ths') add('x16', '16th notes', 'Four notes per click.', 2, { unit: '16ths' });
    const b2 = box % 5 + 1, b3 = b2 % 5 + 1;
    add('pos' + b2, `Position ${b2}`, 'The next shape up the neck.', 1, { box: b2 });
    add('pos' + b3, `Position ${b3}`, 'Two shapes up the neck.', 1, { box: b3 });
    if (o.scale === 'minorPent') add('blues', 'Blues scale', 'Add the blue note (♭5) to the pentatonic.', 1, { scale: 'blues' });
    if (o.scale === 'majorPent') add('mblues', 'Major blues', 'Add the ♭3 passing note.', 1, { scale: 'majorBlues' });
    if (o.scale === 'major') add('mixo', 'Mixolydian', 'Lower the 7th: the dominant sound.', 1, { scale: 'mixolydian' });
    if (o.scale === 'minor') add('dor', 'Dorian', 'Raise the 6th: the jazzy minor.', 1, { scale: 'dorian' });
  },
  connectPositions(o, c, add) {
    const f = o.from || 1;
    [[f % 5 + 1, (f % 5 + 1) % 5 + 1], [((f + 1) % 5) + 1, ((f + 2) % 5) + 1]].forEach(([a, b]) => add(`c${a}${b}`, `Positions ${a}–${b}`, 'A different pair of shapes.', 1, { from: a, to: b }));
  },
  noteFinder(o, c, add) {
    const pc = o.pc != null ? o.pc : c.key;
    [[5, 0], [7, 0], [2, 1], [10, 1]].forEach(([s, dl]) => add('n' + mod12(pc + s), `Every ${keyName(pc + s)}`, `Find every ${keyName(pc + s)} instead.`, dl, { pc: mod12(pc + s) }));
  },
  modeCompare(o, c, add) {
    [[['major', 'mixolydian'], 0], [['minor', 'phrygian'], 1], [['dorian', 'mixolydian'], 1], [['major', 'lydian'], 1]].forEach(([m, dl]) => {
      if (JSON.stringify(m) !== JSON.stringify(o.modes)) add('m-' + m.join('-'), `${cap(m[0])} vs ${m[1]}`, `Compare ${m[0]} and ${m[1]}.`, dl, { modes: m });
    });
  },
  doubleStops(o, c, add) { add(o.interval === '6ths' ? 'i3' : 'i6', o.interval === '6ths' ? 'In 3rds' : 'In 6ths', o.interval === '6ths' ? 'Adjacent-string thirds.' : 'Sixths on a skipped string.', o.interval === '6ths' ? -1 : 1, { interval: o.interval === '6ths' ? '3rds' : '6ths' }); },
  legatoRun(o, c, add) { [['minor', 0], ['major', 0], ['dorian', 1], ['harmonicMinor', 2]].forEach(([s, dl]) => { if (s !== (o.scale || (c.minor ? 'minor' : 'major'))) add('s-' + s, scaleWord(s), `The ${scaleWord(s).toLowerCase()} scale instead.`, dl, { scale: s }); }); },
  sweepArp(o, c, add) { const s = o.strings || (c.lvl >= 7 ? 5 : 3); add(s === 5 ? 'st3' : 'st5', s === 5 ? '3 strings' : '5 strings', s === 5 ? 'A smaller sweep on the top three strings.' : 'A wider sweep across five strings.', s === 5 ? -2 : 2, { strings: s === 5 ? 3 : 5 }); },
  speedBurst(o, c, add) { [['minorPent', 0], ['blues', 1], ['minor', 1]].forEach(([s, dl]) => { if (s !== o.scale) add('s-' + s, scaleWord(s), `Bursts in the ${scaleWord(s).toLowerCase()} scale.`, dl, { scale: s }); }); },
  stringSkip(o, c, add) { [['major', 0], ['minor', 0], ['dorian', 1]].forEach(([s, dl]) => { if (s !== (o.scale || (c.minor ? 'minor' : 'major'))) add('s-' + s, scaleWord(s), `Skipping through the ${scaleWord(s).toLowerCase()} scale.`, dl, { scale: s }); }); },
  strumPattern(o, c, add) {
    Object.keys(STRUM_DL).forEach(p => { if (p !== (o.pattern || 'pop')) add('p-' + p, STRUM_LABEL[p], `${STRUM_LABEL[p]} on the same chords.`, STRUM_DL[p] - (STRUM_DL[o.pattern || 'pop'] || 0), { pattern: p }); });
    if (!o.swing) add('swing', 'Swung', 'Long-short 8ths.', 1, { swing: true });
  },
  chordChanges(o, c, add) {
    const ch = Array.isArray(o.chords) ? o.chords : null; if (!ch) return;
    const beats = o.beats || 2;
    if (ch.length > 2) add('two', 'Two chords', `Only ${ch.slice(0, 2).join(' and ')}, four beats each.`, -2, { chords: ch.slice(0, 2), beats: 4 });
    if (beats !== 4) add('b4', 'Four beats each', 'More time to set up each change.', -1, { beats: 4 });
    if (beats !== 1) add('b1', 'One beat each', 'A change on every beat.', 2, { beats: 1 });
    add('rev', 'Reverse order', `${[...ch].reverse().join(' – ')}: the changes in the other direction.`, 0, { chords: [...ch].reverse() });
    const extra = transposeChords([ch[0]], 9); const relMinor = extra && parseChord(extra[0]) ? chordName(parseChord(extra[0]).root.pc, 'min') : null;
    if (relMinor && !ch.includes(relMinor)) add('add', 'Add a chord', `Add ${relMinor}.`, 1, { chords: [...ch, relMinor] });
    const up = transposeChords(ch, 1); if (up) add('barre', 'Half a step up', `${up.join(' – ')}: the same changes as barre chords.`, 2, { chords: up });
  },
  funkScratch(o, c, add) { [['9', 1], ['m7', 0], ['7', 0]].forEach(([t, dl]) => { const nm = chordName(c.key, t); if (nm !== o.chord) add('c-' + t, nm, `Scratch on ${nm}.`, dl, { chord: nm }); }); },
  powerRiff(o, c, add) { [['halftime', -2], ['stab', -1], ['synco', 0], ['drive', 1]].forEach(([r, dl]) => { if (r !== (o.rhythm || 'synco')) add('r-' + r, { halftime: 'Half-time', stab: 'Stabs', synco: 'Syncopated', drive: 'Driving 8ths' }[r], 'Same chords, a different rhythm.', dl, { rhythm: r }); }); },
  chugRiff(o, c, add) { [['8ths', -2], ['gallop', 0], ['16ths', 2]].forEach(([r, dl]) => { if (r !== (o.rhythm || 'gallop')) add('r-' + r, { '8ths': 'Straight 8ths', gallop: 'Gallop', '16ths': '16th chugs' }[r], 'A different chug rhythm.', dl - ({ '8ths': -2, gallop: 0, '16ths': 2 }[o.rhythm || 'gallop']), { rhythm: r }); }); },
  oddMeterRiff(o, c, add) { [[5, -1], [7, 0], [9, 1]].forEach(([m, dl]) => { if (m !== (o.meter || 7)) add('m' + m, `${m}/8`, `The riff idea in ${m}/8.`, dl, { meter: m }); }); },
  diatonicCycle(o, c, add) { add(o.sevenths ? 'tri' : 'sev', o.sevenths ? 'Triads' : '7th chords', o.sevenths ? 'Three-note chords of the key.' : 'Four-note chords of the key.', o.sevenths ? -1 : 1, { sevenths: !o.sevenths }); },
  triadProgression(o, c, add) {
    [[[2, 3, 4], 0, 'Middle strings'], [[1, 2, 3], 1, 'Top strings']].forEach(([set, dl, lbl]) => { if (JSON.stringify(set) !== JSON.stringify(o.set || [3, 4, 5])) add('set' + set.join(''), lbl, 'The same progression on another string set.', dl, { set }); });
    if (!o.arpeggio) add('arp', 'Arpeggiated', 'Pick the triads one note at a time.', 1, { arpeggio: true });
  },
  drop2Comp(o, c, add) { const alt = JSON.stringify(o.set || [1, 2, 3, 4]) === '[1,2,3,4]' ? [2, 3, 4, 5] : [1, 2, 3, 4]; add('set' + alt.join(''), alt[0] === 1 ? 'Top four strings' : 'Middle four strings', 'The same voicings on another string set.', 1, { set: alt }); },
  qualityCycle(o, c, add) {
    add('q2', 'Two qualities', 'Major 7 and dominant 7 only.', -2, { types: ['maj7', '7'] });
    add('q3', 'Three qualities', 'Major 7, dominant 7, minor 7.', -1, { types: ['maj7', '7', 'm7'] });
    add('q5', 'Five qualities', 'Add the diminished 7th.', 1, { types: ['maj7', '7', 'm7', 'm7b5', 'dim7'] });
    if ((o.family || 'drop2') === 'drop2') add('d3', 'Drop 3 voicings', 'Bass-string drop-3 shapes.', 2, { family: 'drop3', set: [0, 2, 3, 4] });
    add('mid', 'Middle strings', 'Strings 2–5.', 1, { set: [2, 3, 4, 5] });
  },
  inversionCycle(o, c, add) {
    const fam = o.family || null;
    [[[1, 2, 3], 'triad', 'maj', 'Major triads, top strings', -1], [[2, 3, 4], 'triad', 'min', 'Minor triads, middle strings', 0], [[2, 3, 4, 5], 'drop2', 'm7', 'Minor 7 drop 2', 1], [[0, 2, 3, 4], 'drop3', '7', 'Dominant 7 drop 3', 2]]
      .forEach(([set, family, type, lbl, dl]) => { if (!(family === fam && type === o.type)) add(`${family}-${type}`, lbl, 'Another chord through all its inversions.', dl, { set, family, type }); });
  },
  shapesAcrossNeck(o, c, add) { [['maj', 0], ['min', 0], ['7', 1], ['m7', 1]].forEach(([t, dl]) => { if (t !== (o.type || 'maj')) add('t-' + t, `${chordName(o.root != null ? o.root : c.key, t)} shapes`, 'A different chord quality across the neck.', dl, { type: t }); }); },
  arpeggioBox(o, c, add) { [['maj7', 0], ['m7', 0], ['7', 0], ['m7b5', 1], ['maj', -1], ['min', -1]].forEach(([t, dl]) => { if (t !== o.type) add('t-' + t, `${chordName(o.root != null ? o.root : c.key, t)} arpeggio`, 'A different chord quality.', dl, { type: t }); }); },
  subdivisionLadder(o, c, add) { add(o.feel === 'swing' ? 'straight' : 'swing', o.feel === 'swing' ? 'Straight feel' : 'Swing feel', o.feel === 'swing' ? 'Straight subdivisions.' : 'Add swung 8ths to the ladder.', o.feel === 'swing' ? -1 : 1, { feel: o.feel === 'swing' ? 'straight' : 'swing' }); }
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const scaleWord = s => ({ minorPent: 'Minor pentatonic', majorPent: 'Major pentatonic', blues: 'Blues scale', majorBlues: 'Major blues', minor: 'Natural minor', major: 'Major', dorian: 'Dorian', mixolydian: 'Mixolydian', harmonicMinor: 'Harmonic minor', phrygian: 'Phrygian', lydian: 'Lydian' }[s] || s);

function atomVariations(base, gen) {
  const out = [], c0 = { genre: null, prog: null, ...gen.c }, o0 = gen.opts || {};
  const add = (vid, label, change, dl, optsPatch, cPatch) => {
    const c = { ...c0, ...(cPatch || {}) }, opts = { ...o0, ...(optsPatch || {}) };
    const raw = runAtom(c, gen.atom, opts); if (!raw) return;
    const ex = normalizeExercise(raw); if (!ex) return;
    ex.gen = { atom: gen.atom, opts, c: { key: c.key, minor: !!c.minor, lvl: c.lvl, genre: c.genre, prog: c.prog } };
    out.push({ vid, label, change, dl, level: dl == null ? ex.level : null, ex });
  };
  if (VARY[gen.atom]) VARY[gen.atom](o0, c0, add);
  // progression alternatives for chord-based atoms written with a progression
  const grp = PROG_GROUP[gen.atom];
  if (grp && typeof o0.chords === 'string' && o0.chords.startsWith('$')) {
    const cur = o0.chords === '$prog' ? c0.prog : o0.chords.slice(1);
    PROG_SETS[grp].forEach(([pid, dl]) => { if (pid !== cur) add('prog-' + pid, `Over ${PROG_LABEL[pid] || pid}`, `A different progression: ${PROG_LABEL[pid] || pid}.`, dl, { chords: '$' + pid }); });
  }
  const rootPatch = o0.root != null ? { root: mod12(o0.root + 5) } : null;
  add('key', `In ${keyName(c0.key + 5)}`, `The same exercise in ${keyName(c0.key + 5)}${c0.minor ? ' minor' : ''}.`, 0, rootPatch, { key: mod12(c0.key + 5) });
  if (c0.lvl > 1) add('easy', 'Easier version', 'Built for two levels lower: slower goal, simpler rhythm.', null, null, { lvl: clampL(c0.lvl - 2) });
  if (c0.lvl < 10) add('hard', 'Harder version', 'Built for two levels higher: faster goal, denser rhythm.', null, null, { lvl: clampL(c0.lvl + 2) });
  return out;
}

/* --------------------------- Hand-written families --------------------------- */
const spec = (base, o) => {
  const out = { ...clone(base), ...o, libId: null };
  if (o.tab) { const bpb = base.beatsPerBar || 4; out.tab = { ...(base.tab || {}), ...o.tab, notes: o.tab.notes.map(fix) }; out.tab.beats = Math.max(bpb, Math.ceil(endOf(out.tab.notes) / bpb - 1e-6) * bpb); }
  return out;
};
const SPIDER_PERMS = [['4321', 0, 'Fingers 4-3-2-1: start from the pinky.'], ['1324', 1, 'Fingers 1-3-2-4: break the obvious order.'], ['1243', 1, 'Fingers 1-2-4-3: the pinky leads the second pair.'],
  ['2143', 1, 'Fingers 2-1-4-3: pairs swapped.'], ['1423', 2, 'Fingers 1-4-2-3: the widest jump first.'], ['1342', 2, 'Fingers 1-3-4-2: ring and pinky together.'], ['2413', 3, 'Fingers 2-4-1-3: the hardest independence order.']];
function spiderLine({ perm = [1, 2, 3, 4], pos = 1, diagonal = false, strings = [6, 5, 4, 3, 2, 1], frets = null }) {
  const fr = k => (frets ? frets[k - 1] : k - 1);
  const up = [], down = [];
  strings.forEach((s, i) => perm.forEach(k => up.push([s, pos + (diagonal ? i : 0) + fr(k)])));
  [...strings].reverse().forEach((s, i) => [...perm].reverse().forEach(k => down.push([s, pos + (diagonal ? strings.length - 1 - i : 0) + fr(k)])));
  return [...up, ...down];
}
const FAMILIES = {
  spider(base, L) {
    const b = { ...base, picking: 'alternate', unit: '8ths' };
    const mk = (vid, label, change, dl, line, step = 0.5, extra = {}) => ({ vid, label, change, dl, ex: spec(b, { name: base.name, ...extra, tab: { notes: seqNotes(line, step) } }) });
    const climb = o => spiderClimb(o);
    // along each string: frets 1–4, 5–8, 9–12 and back, one string at a time (pure horizontal movement)
    const along = [6, 5, 4, 3, 2, 1].flatMap(st => { const up = Array.from({ length: 12 }, (_, i) => [st, i + 1]); return [...up, ...[...up].reverse()]; });
    // spider walk: two strings at once, fingers 1&3 on the lower string and 2&4 on the higher, climbing a fret each pass
    const walkAt = (pos, upward) => { const w = []; [[6, 5], [5, 4], [4, 3], [3, 2], [2, 1]].forEach(([a, c]) => w.push([a, pos], [c, pos + 1], [a, pos + 2], [c, pos + 3])); return upward ? w : [...w].reverse(); };
    const list = [
      mk('pos1', 'One position', 'Frets 1–4 only: straight across the strings and back, no shifting.', -1, spiderLine({})),
      mk('pos5', 'Climb from fret 5', 'The same climb from frets 5–8 up to 9–12 and back: smaller stretches, easier on the hand.', -1, climb({ from: 5, top: 9 })),
      ...SPIDER_PERMS.map(([p, dl, ch]) => mk('p' + p, p.split('').join('-'), `${ch} Shift up a fret after each pass across the strings.`, dl, climb({ perm: p.split('').map(Number) }))),
      mk('horiz', 'Along each string', 'Frets 1–4, 5–8, 9–12 on one string and back down, then the next string: long, clean shifts along the neck.', 1, along),
      mk('diag', 'Diagonal', 'Move up one fret on each new string, then back down.', 1, spiderLine({ diagonal: true })),
      mk('skip', 'String skipping', 'Strings 6-4-5-3-4-2-3-1 while climbing the neck: skip a string on every move.', 2, climb({ strings: [6, 4, 5, 3, 4, 2, 3, 1] })),
      mk('wide', 'Wide stretch', 'Frets 1-2-3-5 while climbing: the pinky reaches an extra fret.', 2, climb({ frets: [0, 1, 2, 4], top: 4 })),
      mk('x16', '16th notes', 'Four notes per click, still climbing the neck.', 2, climb({}), 0.25, { unit: '16ths', ...tempoScale(base, 0.65) }),
      mk('trip', 'Triplets', 'Four fingers over three-note beats: the accent moves every beat while you climb.', 2, climb({}), 1 / 3, { unit: 'triplets', ...tempoScale(base, 0.8) }),
      mk('walk', 'Spider walk', 'Alternate two strings (1 and 3 on the lower string, 2 and 4 on the higher one), up a fret on each pass.', 3, [...walkAt(1, true), ...walkAt(2, false), ...walkAt(3, true), ...walkAt(2, false)])
    ];
    return list;
  },
  bends(base) {
    const mk = (vid, label, change, dl, list, step = 1, extra = {}) => ({ vid, label, change, dl, ex: spec(base, { ...extra, tab: { notes: seqNotes(list, step) } }) });
    return [
      mk('half', 'Half-step bends', 'Bend one fret’s worth: easier to hear and to reach.', -1, [[3, 8], [3, 7, 'b', 8], [2, 9], [2, 8, 'b', 9], [3, 8], [3, 7, 'b', 8], [2, 9], [2, 8, 'b', 9]]),
      mk('bvib', 'Bend + vibrato', 'Hold the bent note and add vibrato without dropping pitch.', 1, [[3, 9], [3, 7, 'b', 9], [3, 9, '~'], [2, 10], [2, 8, 'b', 10], [2, 10, '~']], 1, { instr: 'Match the target, bend to it, then hold the bend and add vibrato from the bent pitch (small pulses up from the target, never below it).' }),
      mk('15', '1½-step bends', 'Bend three frets’ worth: the Gilmour stretch.', 2, [[2, 11], [2, 8, 'b', 11], [3, 10], [3, 7, 'b', 10], [2, 11], [2, 8, 'b', 11], [3, 10], [3, 7, 'b', 10]]),
      mk('x8', 'Bends in 8ths', 'Same targets, twice as fast.', 1, [[3, 9], [3, 7, 'b', 9], [2, 10], [2, 8, 'b', 10], [3, 9], [3, 7, 'b', 9], [2, 10], [2, 8, 'b', 10]], 0.5),
      { vid: 'pre', label: 'Pre-bend and release', change: 'Bend silently, pick, then let the note fall back.', dl: 2, ex: spec(base, { instr: 'Bend the string up to the target without picking, then pick and release slowly back to the fretted note in time. Check the starting pitch against the fretted target first.', tab: { notes: seqNotes([[3, 9], [3, 7, 'b', 9], [3, 7, 'r'], [2, 10], [2, 8, 'b', 10], [2, 8, 'r']], 1) } }) },
      { vid: 'uni', label: 'Unison bends', change: 'Bend the G string up to match the fretted B string: the two must merge into one pitch.', dl: 2,
        ex: spec(base, { instr: 'Fret the B string at 10 and the G string at 7 together. Bend the G string until the two notes stop beating against each other.', tab: { notes: [0, 2, 4, 6].flatMap(t => [N(3, 7, t, 2, 'b', { chord: true, bendTo: 9 }), N(2, 10, t, 2, null, { chord: true })]) } }) }
    ];
  },
  chug(base) {
    const bar = fn => [0, 1, 2, 3].flatMap(b => fn(b));
    const pm = (t, d) => N(6, 0, t, d, 'pm');
    const mk = (vid, label, change, dl, notes, extra = {}) => ({ vid, label, change, dl, ex: spec(base, { ...extra, tab: { notes } }) });
    return [
      mk('e8', 'Straight 8ths', 'Even palm-muted 8ths: lock in before adding the gallop.', -1, bar(b => [pm(b, 0.5), pm(b + 0.5, 0.5)]), { unit: '8ths', picking: 'down' }),
      mk('rev', 'Reverse gallop', 'Two 16ths then an 8th.', 1, bar(b => [pm(b, 0.25), pm(b + 0.25, 0.25), pm(b + 0.5, 0.5)]), { unit: 'two 16ths + 8th' }),
      mk('x16', '16th chugs', 'Constant palm-muted 16ths.', 1, bar(b => [0, 1, 2, 3].map(k => pm(b + k * 0.25, 0.25))), { unit: '16ths', ...tempoScale(base, 0.85) }),
      mk('trip', 'Triplet gallop', 'Three even notes per beat.', 1, bar(b => [0, 1, 2].map(k => pm(b + k / 3, 1 / 3))), { unit: 'triplets' }),
      mk('acc', 'Gallop with accents', 'Open power-chord hit on beat 1 of each bar, gallops in between.', 2,
        [0, 4].flatMap(t0 => [N(6, 0, t0, 1, null, { chord: true }), N(5, 2, t0, 1, null, { chord: true }), N(4, 2, t0, 1, null, { chord: true }), ...[1, 2, 3].flatMap(b => [pm(t0 + b, 0.5), pm(t0 + b + 0.5, 0.25), pm(t0 + b + 0.75, 0.25)])])),
      mk('down', 'All-downstroke 8ths', 'Every note a downstroke at speed: the thrash endurance test.', 2, bar(b => [pm(b, 0.5), pm(b + 0.5, 0.5)]), { unit: '8ths', picking: 'down', goalBpm: Math.min(240, round(base.goalBpm * 1.3)) })
    ];
  },
  power(base) {
    const pc = (t, d, f, s = 6) => [N(s, f, t, d, null, { chord: true }), N(s - 1, f + 2, t, d, null, { chord: true })];
    const mk = (vid, label, change, dl, notes, extra = {}) => ({ vid, label, change, dl, ex: spec(base, { ...extra, tab: { notes } }) });
    const frets = [0, 3, 5, 3];
    return [
      mk('half', 'Half notes', 'Two beats per chord.', -1, frets.flatMap((f, i) => pc(i * 2, 2, f)), { unit: 'half notes' }),
      mk('e8', '8th notes', 'Two hits per beat, palm muted lightly.', 1, frets.flatMap((f, i) => [0, 0.5, 1, 1.5].flatMap(k => pc(i * 2 + k, 0.5, f))), { unit: '8ths' }),
      mk('syn', 'Syncopated', 'Push each new chord a half beat early.', 1, frets.flatMap((f, i) => pc(i === 0 ? 0 : i * 2 - 0.5, i === 0 ? 1.5 : 2, f)), { unit: 'syncopated' }),
      mk('a5', '5th-string roots', 'The same moves with the root on the A string.', 1, [0, 3, 5, 3].flatMap((f, i) => pc(i, 1, f + 2, 5))),
      mk('mute', 'With muted 8ths', 'Palm-muted root notes between the chord hits.', 2, frets.flatMap((f, i) => [...pc(i * 2, 0.5, f), N(6, f, i * 2 + 0.5, 0.5, 'pm'), N(6, f, i * 2 + 1, 0.5, 'pm'), N(6, f, i * 2 + 1.5, 0.5, 'pm')]), { unit: '8ths' })
    ];
  },
  tapping(base) {
    const mk = (vid, label, change, dl, notes, extra = {}) => ({ vid, label, change, dl, ex: spec(base, { ...extra, tab: { notes } }) });
    const beats = fn => [0, 1, 2, 3].flatMap(fn);
    return [
      mk('tp', 'Tap and pull-off', 'Just the tap and the pull-off, quarter notes.', -1, beats(b => [N(1, 12, b, 0.5, 't'), N(1, 5, b + 0.5, 0.5, 'p')]), { unit: '8ths' }),
      mk('x16', 'Four-note taps', 'Tap–pull–hammer–pull in 16ths: 12-5-8-5.', 1, beats(b => [N(1, 12, b, 0.25, 't'), N(1, 5, b + 0.25, 0.25, 'p'), N(1, 8, b + 0.5, 0.25, 'h'), N(1, 5, b + 0.75, 0.25, 'p')]), { unit: '16ths', ...tempoScale(base, 0.85) }),
      mk('move', 'Moving tap', 'The tapped note climbs: 12, 14, 15, 14.', 2, [12, 14, 15, 14].flatMap((tf, b) => [N(1, tf, b, 1 / 3, 't'), N(1, 5, b + 1 / 3, 1 / 3, 'p'), N(1, 8, b + 2 / 3, 1 / 3, 'h')])),
      mk('two', 'Two strings', 'Alternate the pattern between the B and high e strings.', 2, beats(b => { const s = b % 2 ? 2 : 1, o = s === 2 ? 1 : 0; return [N(s, 12 + o, b, 1 / 3, 't'), N(s, 5 + o, b + 1 / 3, 1 / 3, 'p'), N(s, 8 + o, b + 2 / 3, 1 / 3, 'h')]; }))
    ];
  },
  burst(base) {
    const mk = (vid, label, change, dl, notes, extra = {}) => ({ vid, label, change, dl, ex: spec(base, { ...extra, tab: { notes } }) });
    const cell = [5, 7, 9, 7];
    return [
      mk('e8', '8th notes', 'The same cell in 8ths: get the motion small first.', -1, seqNotes(Array.from({ length: 4 }, () => cell.map(f => [3, f])).flat(), 0.5), { unit: '8ths' }),
      mk('two', 'Across two strings', 'Half the cell on the G string, half on the B.', 1, seqNotes(Array.from({ length: 4 }, () => [[3, 5], [3, 7], [2, 5], [2, 6]]).flat(), 0.25)),
      mk('acc3', 'Accent every 3', 'Group the 16ths in threes against the beat: 5-7-9, 5-7-9…', 1, seqNotes(Array.from({ length: 16 }, (_, i) => [3, [5, 7, 9][i % 3]]), 0.25), { instr: 'Accent the first note of every group of three while the click stays in fours.' }),
      mk('x6', 'Sextuplets', 'Six notes per click.', 2, seqNotes(Array.from({ length: 24 }, (_, i) => [3, [5, 7, 9, 7, 5, 7][i % 6]]), 1 / 6), { unit: 'sextuplets', ...tempoScale(base, 0.7) })
    ];
  },
  trill(base) {
    const mk = (vid, label, change, dl, notes, extra = {}) => ({ vid, label, change, dl, ex: spec(base, { ...extra, tab: { notes } }) });
    const trill = (s, a, b, t0, n = 8, step = 0.25) => Array.from({ length: n }, (_, i) => N(s, i % 2 ? b : a, t0 + i * step, step, i ? (i % 2 ? 'h' : 'p') : null));
    return [
      mk('f12', 'Fingers 1–2', 'Trill between index and middle.', -1, [3, 3, 3, 3].flatMap((s, i) => trill(s, 5, 6, i * 2, 8, 0.25))),
      mk('f23', 'Fingers 2–3', 'Middle and ring: usually the weakest pair.', 0, [3, 3, 3, 3].flatMap((s, i) => trill(s, 6, 7, i * 2, 8, 0.25))),
      mk('f34', 'Fingers 3–4', 'Ring and pinky: the hardest pair.', 1, [3, 3, 3, 3].flatMap((s, i) => trill(s, 7, 8, i * 2, 8, 0.25))),
      mk('f13', 'Fingers 1–3', 'A whole-step trill.', 0, [3, 3, 3, 3].flatMap((s, i) => trill(s, 5, 7, i * 2, 8, 0.25))),
      mk('f14', 'Fingers 1–4', 'Index to pinky: a stretch trill.', 1, [3, 3, 3, 3].flatMap((s, i) => trill(s, 5, 8, i * 2, 8, 0.25))),
      mk('walk', 'Across all strings', 'Fingers 1–3 trill, one bar per string from low E to high e.', 2, [6, 5, 4, 3, 2, 1].flatMap((s, i) => trill(s, 5, 7, i * 2, 8, 0.25)))
    ];
  }
};

/* ------------------------------ Family lookup ------------------------------ */
const C = (key, minor, lvl) => ({ key, minor, lvl: clampL(lvl || 4), genre: null, prog: minor ? 'minorRock' : 'axis' });
const FAMILY_GEN = {
  penta: (ex, L) => ({ atom: 'scaleRun', opts: { scale: 'minorPent', box: /box2/.test(ex.id) ? 2 : 1, unit: /16/.test(ex.id + ex.unit) ? '16ths' : '8ths' }, c: C(9, true, L) }),
  legato: (ex, L) => ({ atom: 'legatoRun', opts: {}, c: C(7, false, L) }),
  sweep: (ex, L) => ({ atom: 'sweepArp', opts: { strings: 3 }, c: C(9, true, L) }),
  shuffle: (ex, L) => ({ atom: 'shuffleRiff', opts: {}, c: C(9, false, L) }),
  strum: (ex, L) => ({ atom: 'strumPattern', opts: { chords: (ex.chords && ex.chords.length >= 2 ? ex.chords : ['G', 'C', 'D', 'Em']), pattern: 'pop' }, c: C(7, false, L) }),
  funk: (ex, L) => ({ atom: 'funkScratch', opts: { chord: (ex.chords || [])[0] || 'Am7' }, c: C(9, true, L) }),
  travis: (ex, L) => ({ atom: 'travisPattern', opts: { chords: ['C', 'Am', 'F', 'G'] }, c: C(0, false, L) }),
  subdiv: (ex, L) => ({ atom: 'subdivisionLadder', opts: { feel: 'straight' }, c: C(9, false, L) }),
  changes: (ex, L) => ({ atom: 'chordChanges', opts: { chords: ex.chords, beats: 2 }, c: C(7, false, L) }),
  notes: (ex, L) => ({ atom: 'noteFinder', opts: {}, c: C(9, true, L) }),
  crossing: (ex, L) => ({ atom: 'stringSkip', opts: {}, c: C(0, false, L) }),
  diatonic: (ex, L) => ({ atom: 'diatonicCycle', opts: {}, c: C(7, false, L) })
};
export function familyOf(ex) {
  if (ex.family) return ex.family;
  const k = `${ex.id} ${ex.libId || ''} ${ex.name}`.toLowerCase();
  if (/spider|chromatic/.test(k)) return 'spider';
  if (/drill-bends|bend to pitch/.test(k)) return 'bends';
  if (/drill-gallop|palm-muted gallop$/.test(k)) return 'chug';
  if (/drill-power|power-chord shifts/.test(k)) return 'power';
  if (/drill-tapping|tap–pull/.test(k)) return 'tapping';
  if (/drill-burst|16th bursts/.test(k)) return 'burst';
  if (/trill/.test(k)) return 'trill';
  if (/penta-box1|penta-16ths|\bbox1\b|\bbox2\b|penta16|minor pentatonic box|pentatonic 16th/.test(k)) return 'penta';
  if (/legato-3nps|legato3|3-note-per-string legato/.test(k)) return 'legato';
  if (/sweep-am|\bsweep\b|minor sweep/.test(k)) return 'sweep';
  if (/blues-shuffle|shuffle riff/.test(k)) return 'shuffle';
  if (/drill-strum|strumming pattern/.test(k)) return 'strum';
  if (/drill-funk16|funk16|16th-note scratch/.test(k)) return 'funk';
  if (/drill-travis|travis picking pattern/.test(k)) return 'travis';
  if (/subdiv|subdivision ladder/.test(k)) return 'subdiv';
  if (/gcd|changes/.test(k) && (ex.chords || []).length >= 2 && !ex.gen) return 'changes';
  if (/notenames|drill-notes|note names|notes on the/.test(k)) return 'notes';
  if (/string-skip|crossing/.test(k)) return 'crossing';
  if (/\btriads\b|build the key/.test(k)) return 'diatonic';
  return null;
}

// Course plans built locally carry atom info by exercise id; recover it for
// plans saved before exercises remembered how they were made.
const genCache = new Map();
function genFromCourse(course, exId) {
  if (!course || !course.tree || course.tree.generatedBy !== 'local') return null;
  const k = `${course.genre}|${course.style}|${course.difficulty}`;
  if (!genCache.has(k)) {
    const map = new Map();
    try { styleTreeRaw(course).units.forEach(u => u.skills.forEach(s => s.exercises.forEach(e => { if (e && e.gen) map.set(e.id, e.gen); }))); } catch { /* none */ }
    genCache.set(k, map);
  }
  return genCache.get(k).get(exId) || null;
}

/* ---------------------------------- API ---------------------------------- */
const varCache = new Map();
const MAX_VARIATIONS = 15; // specific variations kept per exercise
const MIN_FILL = 9;        // general transforms top a short list up to this many

/**
 * All variations of an exercise, easiest first. The original is included
 * (vid 'base'). ctx: { course, level } (level = fallback when the exercise has none).
 * Each: { vid, label, change, level, base, ex } where ex.id = baseId~vid.
 */
export function variationsFor(base, ctx = {}) {
  if (!base) return [];
  const baseId = String(base.id || 'ex').split('~')[0];
  const ck = `${baseId}|${base.name}|${base.goalBpm}|${base.level}|${ctx.course ? ctx.course.id + ':' + ctx.course.difficulty : ''}|${ctx.level || ''}`;
  if (varCache.has(ck)) return varCache.get(ck);
  const L0 = clampL(base.level || ctx.level || 4);
  const items = [];
  const push = (v, prio) => { if (v && v.ex) items.push({ ...v, prio }); };

  // 1. how the exercise was generated, if known
  let gen = base.gen || genFromCourse(ctx.course, baseId);
  const fam = familyOf(base);
  if (!gen && fam && FAMILY_GEN[fam]) gen = FAMILY_GEN[fam](base, L0);
  if (gen && gen.atom) { try { atomVariations(base, { ...gen, c: { ...gen.c, lvl: gen.c && gen.c.lvl ? gen.c.lvl : L0 } }).forEach(v => push(v, 1)); } catch { /* atom failed */ } }
  // 2. hand-written family
  if (fam && FAMILIES[fam]) { try { FAMILIES[fam](base, L0).forEach(v => push(v, 0)); } catch { /* skip */ } }
  // 3. task variations for exercises without a fixed tab, then general transforms
  ideaVariations(base).forEach(v => push(v, 1.5));
  GENERIC.forEach((fn, i) => { try { push(fn(base), 2 + i / 100); } catch { /* skip */ } });

  // finalize: ids, levels, de-duplicate by content, cap the count
  const sig = ex => JSON.stringify([(notesOf(ex)).map(n => [n.t, n.s, n.f, n.x || '']).slice(0, 160), ex.chords || [], ex.metroMode || '', ex.goalBpm, (ex.instr || '').slice(0, 80), ex.unit || '']);
  const seen = new Set([sig(base)]), seenVid = new Set(['base']);
  const out = [];
  items.sort((a, b) => a.prio - b.prio);
  for (const v of items) {
    if (seenVid.has(v.vid)) continue;
    const s = sig(v.ex); if (seen.has(s)) continue;
    seen.add(s); seenVid.add(v.vid);
    const level = clampL(v.level != null ? v.level : L0 + (v.dl || 0));
    // general transforms remember themselves so a key/strings change can re-apply them to the rebuilt exercise
    const ex = { ...v.ex, id: `${baseId}~${v.vid}`, level, varLabel: v.label, ...(v.prio >= 1.5 ? { xform: v.vid } : {}) };
    if (!ex.name) ex.name = base.name;
    // specific = a real technique variation (family pattern, setting); general = tempo, key, transforms
    const kind = v.prio < 2 && !['key', 'easy', 'hard'].includes(v.vid) ? 'specific' : 'general';
    out.push({ vid: v.vid, label: v.label, change: v.change, level, base: false, kind, ex });
  }
  // Specific variations (family / settings) first; general transforms only fill
  // gaps, so a drill like the spider keeps its whole ladder of finger orders.
  const primary = out.filter(v => (items.find(i => i.vid === v.vid) || {}).prio < 2).slice(0, MAX_VARIATIONS);
  const general = out.filter(v => !primary.includes(v));
  const picked = [...primary];
  const has = fn => picked.some(fn);
  const addGen = fn => { const g = general.find(v => fn(v) && !picked.includes(v)); if (g) picked.push(g); return !!g; };
  if (!has(v => v.level < L0)) addGen(v => v.level < L0);
  if (!has(v => v.vid === 'simp') && picked.filter(v => v.level < L0).length < 2) addGen(v => v.vid === 'simp');
  if (!has(v => v.level > L0)) addGen(v => v.level > L0);
  for (const v of general) { if (picked.length >= Math.max(MIN_FILL, primary.length)) break; if (!picked.includes(v)) picked.push(v); }
  const list = [{ vid: 'base', label: 'Standard', change: 'The exercise as written.', level: L0, base: true, ex: { ...base, id: baseId, level: L0 } }, ...picked]
    .sort((a, b) => a.level - b.level || (a.base ? -1 : b.base ? 1 : 0));
  varCache.set(ck, list);
  if (varCache.size > 400) varCache.delete(varCache.keys().next().value);
  return list;
}

export function findVariation(list, vid) { return list.find(v => v.vid === (vid || 'base')) || list.find(v => v.base) || list[0]; }

/**
 * Pick a variation. want: 'edge' (just above the player's level), 'harder'
 * (next harder than `from` that isn't mastered), 'easier', or 'rotate' (any at
 * or below the level, varied by seed). isMastered(vid) tells which are done.
 */
export function pickVariation(list, { want = 'edge', level = 4, from = 'base', isMastered = () => false, seed = 0 } = {}) {
  if (!list.length) return null;
  const cur = findVariation(list, from);
  const open = list.filter(v => !isMastered(v.vid));
  if (want === 'harder') return open.filter(v => v.level > cur.level).sort((a, b) => a.level - b.level)[0] || open.filter(v => v.vid !== cur.vid && v.level >= cur.level)[0] || cur;
  if (want === 'easier') return list.filter(v => v.level < cur.level).sort((a, b) => b.level - a.level)[0] || list.find(v => v.vid === 'simp') || cur;
  if (want === 'rotate') {
    // warm-ups: rotate through technique variations at or just above the exercise's level
    // (spider finger orders, positions, strum patterns), plus the original
    let pool = [cur, ...list.filter(v => v.kind === 'specific' && v.level <= cur.level + 1 && v.vid !== cur.vid)];
    if (pool.length < 3) pool.push(...list.filter(v => ['rev', 'half', 'loop'].includes(v.vid) && !pool.includes(v)));
    return pool.length ? pool[Math.abs(seed) % pool.length] : cur;
  }
  const tgt = level + 1;
  return (open.length ? open : list).slice().sort((a, b) => Math.abs(a.level - tgt) - Math.abs(b.level - tgt) || (a.base ? -1 : 0))[0];
}
