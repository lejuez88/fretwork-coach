// Original technique drills, used by song lessons and by the "What do you
// want to work on?" generator when Claude isn't connected. Every drill is
// metronome-measurable (start and goal tempo) and most come with a tab.
import { fallbackExercises } from './coursegen.js';
import { CHORD_SHAPES } from '../assessment/engine.js';
import { CHORD_MIDI } from './audio.js';

const timed = (list, step) => list.map(([s, f, x], i) => ({ t: i * step, d: step, s, f, ...(x ? { x } : {}), ...(x === 'b' ? { bendTo: f + 2 } : {}) }));
const OPEN = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const PCN = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** All drills at a level (1–10) for a genre. Returns raw exercise specs (normalize before use). */
export function drillLibrary(level = 4, genre = 'rock') {
  const L = Math.max(1, Math.min(10, Math.round(level)));
  const fb = fallbackExercises({ genre, difficulty: L });
  const lv = d => Math.max(1, Math.min(10, L + d));
  return {
    bends: { id: 'drill-bends', name: 'Bend to pitch', domain: 'fretting', unit: 'quarter notes', level: lv(-1), startBpm: 50, goalBpm: 80, minutes: 4,
      why: 'Bends that land exactly on pitch are what make lead lines sound finished.', instr: 'Play the fretted target note, then bend two frets below it until you match it. Use three fingers behind the bend and hold the pitch for the whole beat.',
      watch: 'Stopping short of the target pitch.', simplify: 'Half-step bends first (one fret).', tab: { notes: timed([[3, 9], [3, 7, 'b'], [2, 10], [2, 8, 'b'], [3, 9], [3, 7, 'b'], [2, 10], [2, 8, 'b']], 1) } },
    vibrato: { id: 'drill-vibrato', name: 'Even vibrato on held notes', domain: 'fretting', unit: '2 beats per note', level: lv(-1), startBpm: 60, goalBpm: 90, minutes: 3,
      why: 'Controlled vibrato gives sustained notes a voice.', instr: 'Hold each note two beats with vibrato in time: two pulses per beat. Move from the wrist, not the finger.',
      watch: 'Vibrato that speeds up or wobbles the pitch flat.', simplify: 'One pulse per beat.', tab: { notes: [[2, 8], [3, 7], [2, 10], [1, 8]].map(([s, f], i) => ({ t: i * 2, d: 2, s, f, x: '~' })) } },
    gallop: { id: 'drill-gallop', name: 'Palm-muted gallop', domain: 'picking', picking: 'alternate', unit: '8th + two 16ths', level: lv(-1), startBpm: 70, goalBpm: 140, minutes: 4,
      why: 'Tight, even palm-muted rhythms are the engine of rock and metal riffs.', instr: 'Down–down–up on the muted low E: an 8th then two 16ths. Keep the palm lightly on the bridge saddles.',
      watch: 'Uneven 16ths, or the mute choking the note completely.', simplify: 'Straight palm-muted 8ths.',
      tab: { notes: [0, 1, 2, 3].flatMap(b => [{ t: b, d: 0.5, s: 6, f: 0, x: 'pm' }, { t: b + 0.5, d: 0.25, s: 6, f: 0, x: 'pm' }, { t: b + 0.75, d: 0.25, s: 6, f: 0, x: 'pm' }]) } },
    power: { id: 'drill-power', name: 'Power-chord shifts in time', domain: 'fretting', unit: 'quarter notes', level: lv(-2), startBpm: 60, goalBpm: 120, minutes: 4,
      why: 'Fast, accurate power-chord moves are the backbone of most riffs.', instr: 'Two-note power chords on strings 6 and 5. Move the shape as one unit; ease the pressure as you move so the chord doesn’t smear.',
      watch: 'Landing late on the new fret.', simplify: 'Two beats per chord.',
      tab: { notes: [[0, 0], [1, 3], [2, 5], [3, 3]].flatMap(([t, f]) => [{ t, d: 1, s: 6, f, chord: true }, { t, d: 1, s: 5, f: f + 2, chord: true }]) } },
    travis: { id: 'drill-travis', name: 'Travis picking pattern', domain: 'picking', picking: 'fingers', unit: '8ths', level: lv(-1), startBpm: 50, goalBpm: 100, minutes: 5,
      why: 'An independent, steady thumb is the base of fingerpicked songs.', instr: 'C chord shape. The thumb plays the bass on every beat (strings 5, 4, 5, 4); the fingers fill the off-beats. Keep the thumb steady even when a finger misses.',
      watch: 'The thumb copying the fingers’ rhythm.', simplify: 'Thumb only, then add one finger.', tab: { notes: timed([[5, 3], [2, 1], [4, 2], [3, 0], [5, 3], [2, 1], [4, 2], [1, 0]], 0.5) } },
    hybrid: { id: 'drill-hybrid', name: 'Hybrid picking: pick and finger', domain: 'picking', picking: 'hybrid', unit: '8ths', level: lv(0), startBpm: 60, goalBpm: 120, minutes: 4,
      why: 'Pick plus middle finger lets you skip strings cleanly, the core of country and modern lead playing.', instr: 'Pick the low notes with a downstroke; pluck the B-string notes with your middle finger. Let both ring.',
      watch: 'The finger pulling the string too far so it slaps the fret.', simplify: 'Quarter notes, same pattern.', tab: { notes: timed([[4, 2], [2, 3], [4, 2], [2, 3], [5, 3], [2, 1], [5, 3], [2, 1]], 0.5) } },
    tapping: { id: 'drill-tapping', name: 'Tap–pull–hammer triplets', domain: 'fretting', unit: 'triplets', level: lv(0), startBpm: 50, goalBpm: 100, minutes: 4,
      why: 'Even tapped triplets build the coordination behind tapping runs.', instr: 'Tap fret 12 with the picking hand, pull off to 5, hammer 8. Mute the other strings with both hands.',
      watch: 'The pull-off from the tap being quieter than the other notes.', simplify: 'Tap and pull-off only, quarter notes.',
      tab: { notes: [0, 1, 2, 3].flatMap(b => [{ t: b, d: 1 / 3, s: 1, f: 12, x: 't' }, { t: b + 1 / 3, d: 1 / 3, s: 1, f: 5, x: 'p' }, { t: b + 2 / 3, d: 1 / 3, s: 1, f: 8, x: 'h' }]) } },
    dropd: { id: 'drill-dropd', name: 'Drop D one-finger chords', domain: 'fretting', unit: 'quarter notes', level: lv(-2), startBpm: 60, goalBpm: 130, minutes: 3,
      why: 'In Drop D, one finger across the low three strings makes a power chord; moving it cleanly is the core skill.', instr: 'Tune the low E down to D. Barre strings 6–4 with one finger at frets 0, 3, 5, 3, one per beat.',
      watch: 'Hitting string 3.', simplify: 'Two beats per chord.',
      tab: { tuning: [64, 59, 55, 50, 45, 38], notes: [[0, 0], [1, 3], [2, 5], [3, 3]].flatMap(([t, f]) => [6, 5, 4].map(s => ({ t, d: 1, s, f, chord: true }))) } },
    burst: { id: 'drill-burst', name: 'Single-string 16th bursts', domain: 'picking', unit: '16ths', level: lv(0), startBpm: 60, goalBpm: 130, minutes: 4,
      why: 'Speed comes from small, synchronized motions; one string removes string-crossing problems so you can build them.', instr: 'Strict alternate picking (down-up). Accent the first note of each group of four. Keep the pick motion tiny, from the wrist.',
      watch: 'The forearm tensing as the tempo rises.', simplify: 'The same notes in 8ths.', tab: { notes: timed(Array.from({ length: 4 }, () => [[3, 5], [3, 7], [3, 9], [3, 7]]).flat(), 0.25) } },
    slides: { id: 'drill-slides', name: 'In-time slides', domain: 'fretting', unit: '8ths', level: lv(-1), startBpm: 60, goalBpm: 110, minutes: 3,
      why: 'Slides that arrive on the beat sound intentional; late ones sound like mistakes.', instr: 'Slide with steady pressure and arrive exactly on the click. Keep the same finger the whole way.',
      watch: 'Releasing pressure mid-slide so the note dies.', simplify: 'Quarter notes.', tab: { notes: timed([[3, 5], [3, 7, '/'], [3, 9, '/'], [3, 7, '\\'], [2, 5], [2, 8, '/'], [2, 10, '/'], [2, 8, '\\']], 0.5) } },
    doublestops: { id: 'drill-doublestops', name: 'Double-stops on the top strings', domain: 'fretting', unit: 'quarter notes', level: lv(0), startBpm: 60, goalBpm: 110, minutes: 4,
      why: 'Two-note shapes on the top strings are the sound of soul, blues and rock rhythm fills.', instr: 'Play each pair together with one pick stroke (or thumb and finger). Mute the strings below with the fretting hand.',
      watch: 'Uneven volume between the two notes.', simplify: 'Two beats per pair.',
      tab: { notes: [[0, 7, 8], [1, 5, 5], [2, 7, 8], [3, 9, 10]].flatMap(([t, g, b]) => [{ t, d: 1, s: 3, f: g, chord: true }, { t, d: 1, s: 2, f: b, chord: true }]) } },
    funk16: { id: 'drill-funk16', name: 'Muted 16th-note scratch', domain: 'rhythm', unit: '16ths', level: lv(-1), startBpm: 70, goalBpm: 110, minutes: 4, chords: ['Am7'], backing: ['Am7', 'D7'],
      why: 'Funk lives in a hand that never stops moving: constant 16ths, and you choose which strokes sound.', instr: 'Keep the strumming hand moving down-up in 16ths the whole time. Mute the strings with the fretting hand; press the Am7 down only on beats 2 and 4.',
      watch: 'The hand stopping or changing speed when the chord sounds.', simplify: 'Muted 8ths with the chord on 2 and 4.' },
    strum: { id: 'drill-strum', name: 'Strumming pattern D–DU–UDU', domain: 'rhythm', unit: '8ths', level: lv(-2), startBpm: 60, goalBpm: 110, minutes: 4, chords: ['G', 'C', 'D', 'Em'], backing: ['G', 'C', 'D', 'Em'],
      why: 'The most used pop/folk pattern; a steady down-up motion makes every pattern easy.', instr: 'Hand moves down-up in 8ths constantly. Strum: Down, Down-Up, (miss), Up-Down-Up. One bar per chord.',
      watch: 'Stopping the hand on the missed strum.', simplify: 'Down-strums on each beat.' },
    shuffle: { ...fb.shuffle },
    crossing: { ...fb.crossing }, legato: { ...fb.legato }, sweep: { ...fb.sweep }, penta: { ...fb.box1 }, penta16: { ...fb.penta16 },
    improv: { ...fb.improvLoop }, targets: { ...fb.targets }, subdiv: { ...fb.subdiv }, notes: { ...fb.notesClick }, triads: { ...fb.triads }, ear: { ...fb.earEcho },
    warm: { ...fb.warm }, changes: { ...fb.changes }, box2: { ...fb.box2 }
  };
}

/** Notes on one string: the natural notes up to fret 12 and back, one per beat. */
export function stringNotesDrill(stringNo = 5, level = 3) {
  const open = OPEN[stringNo] || 45;
  const frets = []; for (let f = 0; f <= 12; f++) if (NATURAL.includes((open + f) % 12)) frets.push(f);
  const seq = [...frets, ...frets.slice(0, -1).reverse()].map(f => [stringNo, f]);
  const name = stringNo === 1 ? 'high e' : stringNo === 6 ? 'low E' : PCN[open % 12];
  return { id: `drill-notes-s${stringNo}`, name: `Notes on the ${name} string`, domain: 'fretboard', unit: 'one note per beat', level: Math.max(1, level - 1), startBpm: 50, goalBpm: 100, minutes: 4,
    why: 'Knowing every note on a string is the base for finding roots, chords and scales anywhere on the neck.', instr: 'Say each note name out loud as you play it, up to fret 12 and back. Second round: eyes closed for the way down.',
    watch: 'Counting frets from the nut instead of recalling the note.', simplify: 'Frets 0–7 only.', tab: { notes: timed(seq, 1) } };
}

/** Chord-change drill for specific chords (names must exist in the chord diagrams). */
export function chordChangeDrill(chords, level = 3) {
  const ch = chords.filter(c => CHORD_SHAPES[c]).slice(0, 4);
  const list = ch.length >= 2 ? ch : ['G', 'C', 'D'];
  return { id: 'drill-changes-' + list.join('-').toLowerCase(), name: `${list.join('–')} changes on the click`, domain: 'fretting', unit: '2 beats per chord', level: Math.max(1, level - 1), startBpm: 50, goalBpm: 100, minutes: 5,
    chords: list, backing: list.filter(c => CHORD_MIDI[c]).length === list.length ? list : [],
    why: 'Changes that land on beat 1 are what make songs sound finished; practicing just the change trains it fastest.',
    instr: 'Strum each chord twice (2 beats). Start moving on the “&” of beat 2 so the new chord lands on the next beat. Place all fingers at once, not one by one.',
    watch: 'Late changes that leave a gap before the new chord.', simplify: 'Four beats per chord, then two.' };
}

/**
 * Pick drills that match a free-text request. Returns [{role, raw}] (raw = exercise spec)
 * plus the label of the rule that matched.
 */
export function matchDrills(text, { level = 4, genre = 'rock' } = {}) {
  const T = String(text || ''), t = T.toLowerCase();
  const D = drillLibrary(level, genre);
  const chordsInText = [...T.matchAll(/\b([A-G](?:b|#)?(?:maj7|m7|m|7)?)(?=[\s,.;/–-]|$)/g)].map(m => m[1]).filter(c => CHORD_SHAPES[c]);
  const strM = t.match(/\b(low e|high e|[eadgb])\s*string/);
  const rules = [
    [/bend/, 'bends', () => [['drill', D.bends], ['apply', D.improv]]],
    [/vibrato/, 'vibrato', () => [['drill', D.vibrato], ['apply', D.improv]]],
    [/gallop|palm.?mut|chug|downpick|metal riff/, 'palm-muted riffs', () => [['drill', D.gallop], ['main', D.power]]],
    [/drop ?d/, 'Drop D', () => [['main', D.dropd], ['apply', D.gallop]]],
    [/power.?chord/, 'power chords', () => [['main', D.power], ['apply', D.gallop]]],
    [/travis|fingerpick|finger.?style|thumb/, 'fingerpicking', () => [['main', D.travis]]],
    [/hybrid|chicken|country lick/, 'hybrid picking', () => [['main', D.hybrid], ['apply', D.doublestops]]],
    [/tap(ping)?\b/, 'tapping', () => [['drill', D.tapping], ['main', D.legato]]],
    [/sweep/, 'sweep picking', () => [['drill', D.crossing], ['main', D.sweep]]],
    [/legato|hammer|pull.?off/, 'legato', () => [['main', D.legato]]],
    [/slide/, 'slides', () => [['main', D.slides]]],
    [/double.?stop/, 'double-stops', () => [['main', D.doublestops]]],
    [/funk|16th.?(note)? strum|scratch|chop/, 'funk rhythm', () => [['drill', D.subdiv], ['main', D.funk16]]],
    [/barre|bar chord|f chord|f major/, 'barre chords', () => [['main', chordChangeDrill(chordsInText.length >= 2 ? chordsInText : ['F', 'C', 'G'], level)]]],
    [/chord|change|switch|transition/, 'chord changes', () => [['main', chordChangeDrill(chordsInText, level)]]],
    [/strum/, 'strumming', () => [['main', D.strum]]],
    [/shuffle|blues/, 'blues', () => [['main', D.shuffle], ['apply', D.improv]]],
    [/string.?skip|crossing|cross/, 'string crossing', () => [['main', D.crossing]]],
    [/alternate|picking|speed|fast|faster|shred|tremolo/, 'picking speed', () => [['drill', D.burst], ['main', D.penta16]]],
    [/pentatonic|scale|box|position/, 'scales', () => [['main', D.penta], ['apply', D.box2]]],
    [/solo|improv|jam|lead/, 'soloing', () => [['drill', D.targets], ['apply', D.improv]]],
    [/note|fretboard|neck/, 'fretboard notes', () => [['main', strM ? stringNotesDrill({ 'low e': 6, 'high e': 1, e: 6, a: 5, d: 4, g: 3, b: 2 }[strM[1]], level) : D.notes]]],
    [/triad|theory|chord tone|arpeggio|key/, 'theory', () => [['main', D.triads], ['apply', D.targets]]],
    [/ear|interval|by ear|transcri/, 'ear training', () => [['main', D.ear]]],
    [/timing|rhythm|tempo|metronome|groove|time\b/, 'timing', () => [['main', D.subdiv], ['apply', { ...D.strum, metroMode: 'gap', name: 'Gap click: keep time alone', why: 'The click drops out for a bar; you keep the time yourself, which builds your internal clock.' }]]],
    [/tension|relax|pain|warm/, 'relaxed hands', () => [['main', D.warm]]]
  ];
  for (const [re, label, build] of rules) if (re.test(t)) return { label, picks: build().map(([role, raw]) => ({ role, raw })) };
  return { label: null, picks: [] };
}

export const STRING_LABEL = s => ({ 1: 'high e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'low E' }[s]);
