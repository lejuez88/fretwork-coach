// Understands a practice request in the student's own words and builds a
// focused group of exercises for exactly that topic. It reads chord types
// ("7th chords", "m7b5"), voicing words ("inversions", "drop 2", "shells"),
// scales and modes, keys ("in G", "A minor"), progressions ("ii-V-I",
// "12-bar"), named chords ("F and C"), techniques and styles, then combines
// them: "7th chords and inversions" → the four 7th qualities on one root,
// the inversions of a 7th chord up the neck, and a ii–V–I using them.
import { parseChord, parseNote, chordName, ROOT_BY_PC, mod12, SCALE_BY_ID, TYPE_BY_ID } from './theory.js';
import { ATOMS, progressionIn } from './atoms.js';
import { progressionNames, styleDef } from './styles.js';
import { drillLibrary, stringNotesDrill } from './drills.js';
import { normalizeExercise } from './coursegen.js';

/* ------------------------------- Parsing ------------------------------- */
const SCALE_WORDS = [
  [/harmonic minor/, 'harmonicMinor'], [/melodic minor/, 'melodicMinor'], [/phrygian dominant|spanish/, 'phrygianDominant'],
  [/minor pent|pentatonic minor|minor penta/, 'minorPent'], [/major pent|pentatonic major/, 'majorPent'], [/major blues/, 'majorBlues'], [/blues scale/, 'blues'],
  [/dorian/, 'dorian'], [/mixolydian/, 'mixolydian'], [/lydian/, 'lydian'], [/phrygian/, 'phrygian'], [/locrian/, 'locrian'], [/aeolian|natural minor|minor scale/, 'minor'],
  [/ionian|major scale/, 'major'], [/pentatonic/, 'minorPent']
];
const GENRE_WORDS = [[/\bjazz|bebop/, 'jazz'], [/\bblues/, 'blues'], [/\bmetal|thrash|djent/, 'metal'], [/\bfunk|disco/, 'funk'], [/neo.?soul|\br&b|\brnb/, 'neosoul'], [/\bcountry|twang|chicken pick/, 'country'], [/\bfolk|bluegrass/, 'folk'], [/flamenco|\blatin|rumba/, 'latin'], [/\bpunk/, 'punk'], [/\bprog\b|progressive (rock|metal)/, 'prog'], [/\bclassical|fingerstyle/, 'fingerstyle'], [/\bindie\b|alt.?rock|alternative rock/, 'indie'], [/\banime|j.?rock|city.?pop/, 'jrock']];

/** Chord-type words → chord type ids. */
function chordTypesIn(t) {
  const out = new Set();
  // explicit chord symbols ("Am7", "D9") are handled as chords, not as chord-type words
  t = t.replace(/(^|[\s,(/–-])[a-g](#|b|♯|♭)?(maj7|maj9|m7b5|m7♭5|mmaj7|dim7|m9|m7|m6|m11|7sus4|7#9|7b9|sus2|sus4|add9|dim|aug|maj|m|5|6|7|9|11|13)(?=$|[\s,.;)!?/–-])/g, '$1');
  if (/half.?dim|m7b5|m7♭5|ø/.test(t)) out.add('m7b5');
  if (/dim(inished)?\s*7|dim7|°7/.test(t)) out.add('dim7');
  if (/(major|maj)\s*7|maj7|∆|Δ/.test(t)) out.add('maj7');
  if (/(minor|min)\s*7|m7(?!b|♭)/.test(t)) out.add('m7');
  if (/dominant|dom7/.test(t)) out.add('7');
  else if (/\b7 chords?|7th chords?|seventh chords?|\b7ths\b|sevenths/.test(t) && !['maj7', 'm7', 'm7b5', 'dim7'].some(x => out.has(x))) ['maj7', '7', 'm7', 'm7b5'].forEach(x => out.add(x));
  if (/(minor|min)\s*9|m9/.test(t)) out.add('m9');
  if (/(major|maj)\s*9|maj9/.test(t)) out.add('maj9');
  if (/9th|ninth|\b9 chords?/.test(t) && !out.has('m9') && !out.has('maj9')) out.add('9');
  if (/13th|\b13 chords?/.test(t)) out.add('13');
  if (/11th|\b11 chords?/.test(t)) out.add('m11');
  if (/sus2|suspended 2/.test(t)) out.add('sus2');
  if (/sus4|suspended 4/.test(t)) out.add('sus4');
  if (/\bsus\b|sus chords?|suspended chords?/.test(t)) { out.add('sus2'); out.add('sus4'); }
  if (/add.?9|add.?2/.test(t)) out.add('add9');
  if (/6th chords?|\b6 chords?|six chords?/.test(t)) out.add('6');
  if (/augmented|\baug\b/.test(t)) out.add('aug');
  if (/diminished(?!\s*7)|\bdim\b(?!7)/.test(t) && !out.has('dim7')) out.add('dim');
  if (/minor chords?|\bminor triads?/.test(t)) out.add('min');
  if (/major chords?|\bmajor triads?/.test(t)) out.add('maj');
  if (/power.?chords?/.test(t)) out.add('5');
  return [...out];
}

/** Explicit chord symbols in the text ("Am7 to D7", "F and C"). */
function chordsIn(text) {
  const out = [];
  const re = /(?:^|[\s,(/–-])([A-G](?:#|b|♯|♭)?(?:maj7|maj9|m7b5|m7♭5|mmaj7|m\(maj7\)|dim7|m9|m7|m6|m11|7sus4|7#9|7b9|sus2|sus4|add9|dim|aug|maj|m|5|6|7|9|11|13)?(?:\/[A-G](?:#|b)?)?)(?=$|[\s,.;)!?/–-])/g;
  let m;
  while ((m = re.exec(text))) {
    const sym = m[1];
    // a lone capital letter is only a chord when the request talks about chords/changes, or there are several
    const c = parseChord(sym);
    if (c) out.push({ sym, c, bare: /^[A-G]$/.test(sym) });
  }
  // lower-case symbols with a quality ("cadd9", "am7", "f#m7b5") are chords too; "a", "am", "e" are words
  const re2 = /(?:^|[\s,(/–-])([a-g](?:#|b|♯|♭)?(?:maj7|maj9|m7b5|m7♭5|mmaj7|dim7|m9|m7|m6|m11|7sus4|7#9|7b9|sus2|sus4|add9|dim|aug|maj|13|11|9|7|6|5))(?=$|[\s,.;)!?/–-])/g;
  while ((m = re2.exec(text))) { const c = parseChord(m[1][0].toUpperCase() + m[1].slice(1)); if (c && !out.some(x => x.c.name === c.name)) out.push({ sym: m[1], c, bare: false }); }
  const chordy = /chord|change|switch|between|to |progression|strum|transition/.test(text.toLowerCase());
  const real = out.filter(x => !x.bare || chordy || out.length >= 3);
  return [...new Set(real.map(x => x.c.name))];
}

function keyIn(text) {
  const m = text.match(/\b(?:in|key of|in the key of)\s+([A-G](?:#|b|♯|♭)?)\s*(minor|min|m(?![a-z])|major|maj)?\b/i);
  if (m) { const n = parseNote(m[1]); if (n) return { pc: n.pc, minor: !!m[2] && /^m(in(or)?)?$/i.test(m[2].replace(/aj.*/i, '')) && !/maj/i.test(m[2]) }; }
  const m2 = text.match(/\b([A-G](?:#|b|♯|♭)?)\s+(minor|major|dorian|mixolydian|lydian|phrygian|locrian|aeolian|ionian|blues|pentatonic)\b/i);
  if (m2) { const n = parseNote(m2[1]); if (n) return { pc: n.pc, minor: /minor|dorian|phrygian|aeolian|locrian|blues|pentatonic/i.test(m2[2]) && !/major/i.test(m2[2]) }; }
  return null;
}

const TOPICS = [
  ['inversions', /invers|slash chords?|voice.?lead/], ['drop2', /drop.?2|drop two/], ['drop3', /drop.?3|drop three/], ['shells', /shell/],
  ['triads', /triads?/], ['caged', /caged/], ['barre', /barre|bar chords?|f chord|f major chord/], ['open', /open chords?|beginner chords?|first chords?|cowboy chords?/],
  ['arpeggio', /arpegg/], ['chordMelody', /chord.?melody/], ['comping', /\bcomp(ing)?\b/], ['guideTones', /guide.?tones?|chord tones?|target(ing)? notes?|outlin/],
  ['keychords', /diatonic|chords in (the |a )?key|harmoni[sz]ed? (the )?scale|roman numerals?|nashville|number system/],
  ['progression', /ii.?v.?i|2.?5.?1|12.?bar|twelve.?bar|i.?iv.?v\b|1.?4.?5\b|i.?v.?vi.?iv|progressions?/],
  ['modes', /\bmodes?\b|modal/], ['scale', /scales?|pentatonic|dorian|mixolydian|lydian|phrygian|locrian|aeolian|ionian|harmonic minor|melodic minor/],
  ['intervals', /intervals?/], ['fretboard', /note names|notes on|fretboard|memori[sz]|the neck|where the notes|find(ing)? notes|octave shapes?/],
  ['bends', /bend/], ['vibrato', /vibrato/], ['legato', /legato|hammer|pull.?off/], ['tapping', /\btap(ping)?\b/], ['sweep', /sweep/],
  ['economy', /economy pick/], ['hybrid', /hybrid|chicken pick|pick and finger/], ['skip', /string.?skip/], ['speed', /alternate pick|speed|faster|fast|shred|tremolo|picking hand|picking technique/],
  ['palm', /palm.?mut|chug|gallop|metal riff/], ['downpick', /downpick|down.?strokes?/], ['slides', /slides?|sliding/], ['doublestops', /double.?stops?|thirds|sixths|3rds|6ths/],
  ['travis', /travis|fingerpick|finger.?picking|alternating bass/], ['classical', /classical|p.?i.?m.?a|rest stroke/], ['percussive', /percussive|slap/],
  ['funk', /funk|16th.?(note)? strum|scratch|chop/], ['rasgueado', /rasgueado|flamenco strum|rumba/], ['picado', /picado/], ['oddmeter', /odd.?(time|meter)|7\/8|5\/4|7\/4|5\/8|polyrhythm/],
  ['strum', /strum/], ['timing', /timing|rhythm|tempo|metronome|groove|in time|swing feel|triplets?|subdivi|syncopat/],
  ['improv', /solo|improvis|licks?|phrasing|jam|lead guitar|lead lines?/], ['ear', /\bear\b|by ear|transcri|hear/], ['riff', /riffs?/], ['power', /power.?chords?/],
  ['changes', /chord changes?|chord switch|switching|transitions?|changing chords?|change between|chords? faster/]
];

/** Read a request. Returns {topics, chordTypes, chords, key, scale, genre, tempo, progression, string, text}. */
export function parseRequest(text) {
  const raw = String(text || ''), t = raw.toLowerCase();
  const topics = TOPICS.filter(([, re]) => re.test(t)).map(([id]) => id);
  const chordTypes = chordTypesIn(t);
  if (chordTypes.length && !topics.some(x => ['inversions', 'drop2', 'drop3', 'shells', 'triads', 'caged', 'arpeggio', 'comping', 'keychords', 'changes'].includes(x))) topics.unshift('chordtypes');
  else if (chordTypes.length) topics.push('chordtypes');
  const chords = chordsIn(raw);
  if (chords.length >= 2 && !topics.includes('changes')) topics.push('changes');
  let key0 = keyIn(raw);
  // A single named chord ("what is a Cadd9", "Bm7b5 shapes"): study that chord
  if (chords.length === 1) {
    const c = parseChord(chords[0]);
    if (c && !chordTypes.includes(c.type)) chordTypes.unshift(c.type);
    if (c && !key0) key0 = { pc: c.root.pc, minor: false };
    if (!topics.length || topics.every(x => ['chordtypes', 'changes'].includes(x))) topics.unshift('chordtypes');
  }
  let scale = null; for (const [re, id] of SCALE_WORDS) if (re.test(t)) { scale = id; break; }
  let genre = null; for (const [re, id] of GENRE_WORDS) if (re.test(t)) { genre = id; break; }
  const progression = /ii.?v.?i|2.?5.?1/.test(t) ? (/minor/.test(t) ? 'iiVIminor' : 'iiVI') : /12.?bar|twelve.?bar/.test(t) ? 'blues' : /i.?v.?vi.?iv|1.?5.?6.?4/.test(t) ? 'axis' : /i.?iv.?v|1.?4.?5/.test(t) ? 'folk145' : /andalusian/.test(t) ? 'andalusian' : null;
  const tm = raw.match(/(\d{2,3})\s*bpm/i);
  const sm = t.match(/\b(low e|high e|[eadgb])\s*string/);
  if (!topics.length && /\bchords?\b/.test(t)) topics.push('keychords');
  return { text: raw, topics: [...new Set(topics)], chordTypes, chords, key: key0, scale, genre, progression, tempo: tm ? Math.max(30, Math.min(260, +tm[1])) : null, string: sm ? sm[1] : null };
}

/* ------------------------------- Building ------------------------------- */
const LABEL = {
  inversions: 'inversions', drop2: 'drop-2 voicings', drop3: 'drop-3 voicings', shells: 'shell voicings', triads: 'triads', caged: 'CAGED shapes', barre: 'barre chords', open: 'open chords',
  arpeggio: 'arpeggios', chordMelody: 'chord-melody', comping: 'comping', guideTones: 'chord tones / guide tones', keychords: 'chords of a key', progression: 'a progression', modes: 'modes', scale: 'scales',
  intervals: 'intervals', fretboard: 'fretboard notes', bends: 'bends', vibrato: 'vibrato', legato: 'legato', tapping: 'tapping', sweep: 'sweep picking', economy: 'economy picking', hybrid: 'hybrid picking',
  skip: 'string skipping', speed: 'picking speed', palm: 'palm muting', downpick: 'downpicking', slides: 'slides', doublestops: 'double-stops', travis: 'Travis picking', classical: 'classical technique',
  percussive: 'percussive fingerstyle', funk: 'funk rhythm', rasgueado: 'rasgueado', picado: 'picado', oddmeter: 'odd meters', strum: 'strumming', timing: 'timing', improv: 'soloing', ear: 'ear training',
  riff: 'riffs', power: 'power chords', changes: 'chord changes', chordtypes: 'chord types'
};
const TRIAD_TYPES = new Set(['maj', 'min', 'dim', 'aug', 'sus2', 'sus4']);

/** Build exercises for a parsed request. Returns {interpretation, items:[{role, raw}]}. */
export function buildForRequest(profile, req) {
  const d = profile.domains || {};
  const lvlOf = dom => (d[dom] ? d[dom].level : 4);
  const T = new Set(req.topics);
  // Key: from the text, else the style the request mentions, else a sensible default for the topic
  let key = req.key;
  const styleKey = req.genre ? styleDef(req.genre, '') : null;
  if (!key && styleKey) { const n = parseNote(styleKey.key); key = { pc: n.pc, minor: !!styleKey.minor }; }
  const chordTopic = ['inversions', 'drop2', 'drop3', 'shells', 'triads', 'caged', 'barre', 'arpeggio', 'chordMelody', 'comping', 'keychords', 'chordtypes', 'changes', 'guideTones', 'progression'].some(x => T.has(x));
  if (!key) key = chordTopic ? { pc: 0, minor: false } : T.has('bends') || T.has('improv') || T.has('speed') ? { pc: 9, minor: true } : T.has('palm') || T.has('downpick') ? { pc: 4, minor: true } : { pc: 7, minor: false };
  const c = dom => ({ key: key.pc, minor: key.minor, lvl: lvlOf(dom), prog: req.progression || (styleKey ? styleKey.prog : key.minor ? 'minorRock' : 'axis') });
  const prog = name => progressionNames(key.pc, name);
  const P = progressionNames(key.pc, c('theory').prog);
  const items = [], add = (role, raw) => { if (raw && !items.some(i => i.raw.id === raw.id)) items.push({ role, raw }); };
  const types = req.chordTypes.filter(x => x !== '5');
  const sevenths = types.filter(x => TYPE_BY_ID[x] && TYPE_BY_ID[x].tones.length === 4 && TYPE_BY_ID[x].tones.some(t => /7/.test(t.label)));
  const triadTypes = types.filter(x => TRIAD_TYPES.has(x));
  const kn = ROOT_BY_PC[key.pc] ? ROOT_BY_PC[key.pc].name : chordName(key.pc, 'maj');
  const iiVI = key.minor ? prog('iiVIminor') : prog('iiVI');
  const A = ATOMS;
  let what = [];

  // ---- Chord voicings and inversions ----
  if (T.has('inversions') || T.has('drop2') || T.has('drop3') || T.has('triads') && !T.has('scale')) {
    const fam = T.has('drop3') ? 'drop3' : T.has('triads') && !sevenths.length ? 'triad' : sevenths.length || T.has('drop2') ? 'drop2' : 'triad';
    if (fam === 'triad') {
      const tt = triadTypes.length ? triadTypes : ['maj', 'min'];
      what.push(`${tt.map(x => TYPE_BY_ID[x].name.toLowerCase()).join(' and ')} triad inversions`);
      add('drill', A.inversionCycle(c('fretboard'), { type: tt[0], family: 'triad', set: [3, 4, 5] }));
      add('main', A.inversionCycle(c('fretboard'), { type: tt[1] || tt[0], family: 'triad', set: [2, 3, 4] }));
      add('apply', A.triadProgression(c('fretboard'), { chords: key.minor ? prog('minorRock') : prog('folkAxis'), set: [3, 4, 5] }));
    } else {
      const st = sevenths.length ? sevenths : ['maj7', '7', 'm7', 'm7b5'];
      what.push(`${st.length > 1 ? '7th chords (' + st.map(x => TYPE_BY_ID[x].symbol || x).join(', ') + ')' : TYPE_BY_ID[st[0]].name.toLowerCase() + ' chords'} in ${fam === 'drop3' ? 'drop-3' : 'drop-2'} inversions`);
      if (st.length > 1) add('drill', A.qualityCycle(c('theory'), { types: st, family: fam, set: fam === 'drop3' ? [0, 2, 3, 4] : [1, 2, 3, 4] }));
      add('main', A.inversionCycle(c('fretboard'), { type: st[0], family: fam, set: fam === 'drop3' ? [0, 2, 3, 4] : [2, 3, 4, 5] }));
      if (st[1]) add('main', A.inversionCycle(c('fretboard'), { type: st.includes('7') && st[0] !== '7' ? '7' : st[1], family: fam, set: fam === 'drop3' ? [1, 3, 4, 5] : [1, 2, 3, 4] }));
      add('apply', A.drop2Comp(c('theory'), { chords: iiVI, set: [1, 2, 3, 4] }));
    }
  } else if (T.has('shells')) {
    what.push('shell voicings');
    add('drill', A.qualityCycle(c('theory'), { types: sevenths.length ? sevenths : ['maj7', '7', 'm7'], family: 'shell', set: [1, 2, 3] }));
    add('main', A.shellComp(c('theory'), { chords: iiVI }));
    add('apply', A.guideTones(c('improv'), { chords: iiVI }));
  } else if (T.has('chordtypes') && types.length && !T.has('arpeggio')) {
    // chord qualities without voicing words: compare, shapes, inversions, then the chord in context
    const main = types[0];
    const NEIGHBOR = { m7b5: 'm7', dim7: 'm7b5', maj7: '7', '7': 'maj7', m7: '7', '9': '7', m9: 'm7', maj9: 'maj7', '13': '7', m11: 'm7', sus4: 'maj', sus2: 'maj', add9: 'maj', '6': 'maj7', m6: 'm7', aug: 'maj', dim: 'min', min: 'maj', maj: 'min' };
    what.push(`${types.map(x => TYPE_BY_ID[x].name.toLowerCase()).join(', ')} chords`);
    add('drill', A.qualityCycle(c('theory'), { types: types.length > 1 ? types.slice(0, 5) : [NEIGHBOR[main] || 'maj', main], family: 'full' }));
    add('main', A.shapesAcrossNeck(c('fretboard'), { type: main }));
    const nT = TYPE_BY_ID[main].tones.length;
    if (types[1]) add('main', A.shapesAcrossNeck(c('fretboard'), { type: types[1] }));
    else if ((nT === 3 && TRIAD_TYPES.has(main)) || sevenths.includes(main)) add('main', A.inversionCycle(c('fretboard'), { type: main }));
    const sym = x => chordName(key.pc, x);
    const ctx = {
      m7b5: () => A.drop2Comp(c('theory'), { chords: progressionNames(mod12(key.pc + 9), 'iiVIminor') }),
      dim7: () => A.chordChanges(c('fretting'), { chords: [sym('maj'), chordName(mod12(key.pc + 1), 'dim7'), chordName(mod12(key.pc + 2), 'm7'), chordName(mod12(key.pc + 7), '7')], name: `Passing diminished: ${sym('maj')} – ${chordName(mod12(key.pc + 1), 'dim7')} – ${chordName(mod12(key.pc + 2), 'm7')} – ${chordName(mod12(key.pc + 7), '7')}` }),
      '7': () => A.chordChanges(c('fretting'), { chords: progressionNames(key.pc, 'blues') }),
      '9': () => A.funkScratch(c('rhythm'), { chord: sym('9') }), '13': () => A.chordChanges(c('fretting'), { chords: [sym('13'), chordName(mod12(key.pc + 5), '13')] }),
      sus2: () => A.strumPattern(c('rhythm'), { chords: progressionNames(key.pc, 'sus'), pattern: 'folk' }), sus4: () => A.strumPattern(c('rhythm'), { chords: progressionNames(key.pc, 'sus'), pattern: 'folk' }),
      add9: () => A.strumPattern(c('rhythm'), { chords: progressionNames(key.pc, 'indie'), pattern: 'pop' })
    };
    add('apply', (ctx[main] || (() => (sevenths.length ? A.drop2Comp(c('theory'), { chords: iiVI }) : A.chordChanges(c('fretting'), { chords: [sym(main), chordName(mod12(key.pc + 5), main), chordName(mod12(key.pc + 7), main)] }))))());
  }
  if (T.has('caged')) { what.push('CAGED shapes'); add('main', A.shapesAcrossNeck(c('fretboard'), { type: key.minor ? 'min' : 'maj' })); add('main', A.arpeggioBox(c('fretboard'), { type: key.minor ? 'min' : 'maj' })); }
  if (T.has('arpeggio') && !T.has('sweep')) {
    const tps = types.length ? types : [key.minor ? 'm7' : 'maj7', '7'];
    what.push(`${tps.map(x => chordName(key.pc, x)).join(' / ')} arpeggios`);
    tps.slice(0, 3).forEach((tp, i) => add(i ? 'main' : 'drill', A.arpeggioBox(c('fretboard'), { type: tp })));
    add('apply', A.guideTones(c('improv'), { chords: iiVI }));
  }
  if (T.has('barre')) {
    what.push('barre chords');
    const names = req.chords.length >= 2 ? req.chords : [chordName(5, 'maj'), chordName(11, 'min'), chordName(10, 'maj'), chordName(6, 'min')];
    add('drill', A.shapesAcrossNeck(c('fretting'), { type: 'maj', root: 5 }));
    add('main', A.chordChanges(c('fretting'), { chords: names, beats: 4, name: `Barre chords: ${names.join(' – ')}` }));
    add('apply', A.strumPattern(c('rhythm'), { chords: names, pattern: 'pop' }));
  }
  if (T.has('open') && !req.chords.length) { what.push('open chords'); const names = ['G', 'C', 'D', 'Em']; add('main', A.chordChanges(c('fretting'), { chords: names, beats: 4 })); add('apply', A.strumPattern(c('rhythm'), { chords: names, pattern: 'pop' })); }
  if (T.has('changes') && req.chords.length >= 2) { what.push(`changes between ${req.chords.join(', ')}`); add('drill', A.chordChanges(c('fretting'), { chords: req.chords.slice(0, 4), beats: 4, name: `${req.chords.slice(0, 4).join(' ↔ ')}: slow changes` })); add('main', A.chordChanges(c('fretting'), { chords: req.chords.slice(0, 4), beats: 2 })); add('apply', A.strumPattern(c('rhythm'), { chords: req.chords.slice(0, 4), pattern: 'pop' })); }
  else if (T.has('changes') && !items.length) { const names = types.length ? [chordName(key.pc, types[0]), chordName(mod12(key.pc + 5), types[0]), chordName(mod12(key.pc + 7), types[0])] : P; what.push(`chord changes (${names.join(', ')})`); add('main', A.chordChanges(c('fretting'), { chords: names, beats: 2 })); add('apply', A.strumPattern(c('rhythm'), { chords: names })); }
  if (T.has('keychords')) { what.push(`the chords of ${kn} ${key.minor ? 'minor' : 'major'}`); add('main', A.diatonicCycle(c('theory'), { sevenths: false })); add('main', A.diatonicCycle(c('theory'), { sevenths: true })); add('apply', A.triadProgression(c('theory'), { chords: P })); }
  if (T.has('progression') && req.progression) {
    const names = prog(req.progression); what.push(names.join(' – '));
    if (/iiVI/.test(req.progression)) { add('main', A.shellComp(c('theory'), { chords: names })); add('main', A.drop2Comp(c('theory'), { chords: names })); add('apply', A.guideTones(c('improv'), { chords: names })); }
    else if (req.progression === 'blues') { add('main', A.shuffleRiff(c('rhythm'))); add('main', A.chordChanges(c('fretting'), { chords: names })); add('apply', A.callResponse({ ...c('improv'), minor: true }, { chords: names })); }
    else { add('main', A.chordChanges(c('fretting'), { chords: names })); add('main', A.triadProgression(c('fretboard'), { chords: names })); add('apply', A.strumPattern(c('rhythm'), { chords: names })); }
  }
  if (T.has('chordMelody')) { what.push('chord-melody'); add('main', A.chordMelody(c('theory'))); add('main', A.drop2Comp(c('theory'), { chords: iiVI })); }
  if (T.has('comping') && !T.has('shells')) { what.push('comping'); add('main', A.shellComp(c('theory'), { chords: iiVI })); add('main', A.drop2Comp(c('theory'), { chords: iiVI })); }
  if (T.has('guideTones') && !T.has('arpeggio')) { what.push('targeting chord tones'); add('main', A.guideTones(c('improv'), { chords: iiVI })); add('apply', A.targetSolo(c('improv'), { chords: P })); }

  // ---- Scales and modes ----
  if (T.has('modes') && !req.scale) {
    what.push(`the modes from ${kn}`);
    add('main', A.modeCompare(c('theory'), { modes: ['major', 'lydian'] })); add('main', A.modeCompare(c('theory'), { modes: ['mixolydian', 'dorian'] })); add('main', A.modeCompare(c('theory'), { modes: ['minor', 'phrygian'] }));
  } else if ((T.has('scale') || T.has('modes')) && req.scale) {
    const sc = req.scale, minorish = /minor|dorian|phrygian|locrian|blues|minorPent/.test(sc);
    const cc = { ...c('fretboard'), minor: minorish };
    what.push(`the ${kn} ${SCALE_BY_ID[sc].name.toLowerCase()}`);
    add('drill', A.scaleRun(cc, { scale: sc, box: 1, unit: '8ths' }));
    add('main', A.scaleRun(cc, { scale: sc, box: 1, pattern: SCALE_BY_ID[sc].steps.length > 6 ? 'thirds' : 'threes' }));
    add('main', A.connectPositions(cc, { scale: sc, from: 1, to: 2 }));
    const parent = { dorian: ['minor', 'dorian'], mixolydian: ['major', 'mixolydian'], lydian: ['major', 'lydian'], phrygian: ['minor', 'phrygian'], locrian: ['minor', 'locrian'], harmonicMinor: ['minor', 'harmonicMinor'], melodicMinor: ['minor', 'melodicMinor'], phrygianDominant: ['phrygian', 'phrygianDominant'], majorPent: ['majorPent', 'major'], minorPent: ['minorPent', 'blues'], blues: ['minorPent', 'blues'] }[sc];
    if (parent) add('apply', A.modeCompare(cc, { modes: parent }));
    const vamp = { dorian: 'dorianVamp', mixolydian: 'mixo', phrygianDominant: 'andalusian', blues: 'blues', minorPent: 'minorRock', majorPent: 'country' }[sc];
    add('apply', A.targetSolo(cc, { chords: vamp ? prog(vamp) : P, scale: sc }));
  } else if (T.has('scale')) { what.push(`${kn} ${key.minor ? 'minor' : 'major'} pentatonic`); const sc = key.minor ? 'minorPent' : 'majorPent'; add('main', A.scaleRun(c('fretboard'), { scale: sc })); add('main', A.connectPositions(c('fretboard'), { scale: sc })); add('apply', A.callResponse(c('improv'), { chords: P, scale: sc })); }
  if (T.has('intervals')) { what.push('intervals'); add('main', A.intervalShapes(c('ear'))); add('apply', A.echoPhrases(c('ear'), { chords: P })); }
  if (T.has('fretboard')) {
    what.push('fretboard notes');
    if (req.string) {
      const sn = { 'low e': 6, 'high e': 1, e: 6, a: 5, d: 4, g: 3, b: 2 }[req.string], open = { 6: 4, 5: 9, 4: 2, 3: 7, 2: 11, 1: 4 }[sn];
      add('drill', stringNotesDrill(sn, lvlOf('fretboard'))); add('main', A.noteFinder(c('fretboard'), { pc: open })); add('main', A.noteFinder(c('fretboard'), { pc: mod12(open + 7) }));
    } else { add('main', A.noteFinder(c('fretboard'), { pc: key.pc })); add('main', A.noteFinder(c('fretboard'), { pc: mod12(key.pc + 7) })); add('apply', A.intervalShapes(c('fretboard'))); }
  }

  // ---- Techniques ----
  const D = drillLibrary(lvlOf('fretting'), req.genre || 'rock');
  const tech = (id, label, fns) => { if (T.has(id)) { what.push(label); fns.forEach(([role, ex]) => add(role, ex)); } };
  tech('bends', 'bends', [['drill', A.bendLick({ ...c('fretting'), minor: true })], ['main', A.vibratoHolds({ ...c('fretting'), minor: true })], ['apply', A.callResponse({ ...c('improv'), minor: true }, { chords: P })]]);
  tech('vibrato', 'vibrato', [['main', A.vibratoHolds(c('fretting'))], ['apply', A.bendLick(c('fretting'))]]);
  tech('legato', 'legato', [['main', A.legatoRun(c('fretting'))], ['apply', A.tapLick(c('fretting'))]]);
  tech('tapping', 'tapping', [['main', A.tapLick(c('fretting'))], ['apply', A.legatoRun(c('fretting'))]]);
  tech('sweep', 'sweep picking', [['drill', A.sweepArp({ ...c('picking'), lvl: Math.min(lvlOf('picking'), 6) }, { strings: 3 })], ['main', A.sweepArp({ ...c('picking'), lvl: 8 }, { strings: 5 })]]);
  tech('economy', 'economy picking', [['main', A.sweepArp(c('picking'), { strings: 3 })], ['apply', A.scaleRun(c('picking'), { scale: 'major', nps: 3, unit: '16ths' })]]);
  tech('hybrid', 'hybrid picking', [['main', A.doubleStops(c('picking'), { interval: '6ths' })], ['apply', A.travisPattern(c('picking'), { chords: prog('country') })]]);
  tech('skip', 'string skipping', [['main', A.stringSkip(c('picking'))]]);
  tech('speed', 'picking speed', [['drill', A.speedBurst(c('picking'))], ['main', A.scaleRun(c('picking'), { scale: key.minor ? 'minor' : 'major', nps: 3, unit: '16ths', pattern: 'threes' })]]);
  tech('palm', 'palm muting', [['drill', A.chugRiff(c('picking'), { rhythm: '8ths' })], ['main', A.chugRiff(c('picking'), { rhythm: 'gallop' })], ['apply', A.powerRiff(c('rhythm'), { rhythm: 'synco' })]]);
  tech('downpick', 'downpicking', [['main', A.chugRiff(c('picking'), { rhythm: '8ths' })], ['apply', A.powerRiff(c('rhythm'), { rhythm: 'drive' })]]);
  tech('slides', 'slides', [['main', D.slides]]);
  tech('doublestops', 'double-stops', [['main', A.doubleStops(c('fretting'), { interval: /6th|sixth/.test(req.text.toLowerCase()) ? '6ths' : '3rds' })], ['main', A.doubleStops(c('fretting'), { interval: /6th|sixth/.test(req.text.toLowerCase()) ? '3rds' : '6ths' })], ['apply', A.doubleStopRnR(c('fretting'))]]);
  tech('travis', 'Travis picking', [['main', A.travisPattern(c('picking'), { chords: req.chords.length >= 2 ? req.chords : prog('folkAxis') })], ['apply', A.travisPattern(c('picking'), { chords: prog('capo') })]]);
  tech('classical', 'classical right hand', [['main', A.pimaArpeggio(c('picking'), { chords: prog('classical') })]]);
  tech('percussive', 'percussive fingerstyle', [['main', A.percussiveGroove(c('picking'))]]);
  tech('funk', 'funk rhythm', [['drill', A.subdivisionLadder(c('rhythm'))], ['main', A.funkScratch(c('rhythm'))], ['main', A.funkScratch(c('rhythm'), { chord: chordName(mod12(key.pc + 5), '9') })]]);
  tech('rasgueado', 'rasgueado', [['main', A.rasgueado(c('rhythm'))]]);
  tech('picado', 'picado', [['main', A.picado(c('picking'))]]);
  tech('oddmeter', 'odd meters', [['main', A.oddMeterRiff(c('rhythm'), { meter: /5\//.test(req.text) ? 5 : 7 })], ['main', A.oddMeterRiff(c('rhythm'), { meter: /5\//.test(req.text) ? 7 : 5 })]]);
  if (T.has('strum') && !T.has('funk')) { const ch = req.chords.length >= 2 ? req.chords : P; what.push('strumming'); add('main', A.strumPattern(c('rhythm'), { chords: ch, pattern: 'pop' })); add('main', A.strumPattern(c('rhythm'), { chords: ch, pattern: 'folk' })); add('apply', A.gapClick(c('rhythm'), { chords: ch })); }
  tech('power', 'power chords', [['main', A.powerRiff(c('rhythm'), { rhythm: 'drive' })], ['apply', A.powerRiff(c('rhythm'), { rhythm: 'synco' })]]);
  tech('riff', 'riffs', [['main', A.powerRiff(c('rhythm'), { rhythm: 'synco' })], ['main', A.chugRiff(c('picking'), { rhythm: 'gallop' })]]);
  if (T.has('timing') && !items.length) { what.push('timing'); add('drill', A.subdivisionLadder(c('rhythm'))); add('main', A.gapClick(c('rhythm'), { chords: P })); }
  if (T.has('improv')) { what.push(`soloing in ${kn}${key.minor ? ' minor' : ''}`); add('main', A.callResponse(c('improv'), { chords: P })); add('apply', A.targetSolo(c('improv'), { chords: P })); }
  if (T.has('ear')) { what.push('ear training'); add('main', A.intervalShapes(c('ear'))); add('main', A.echoPhrases(c('ear'), { chords: P })); add('apply', A.earKey(c('ear'), { chords: P })); }

  // Tempo the student named becomes the goal of the main exercise
  if (req.tempo) { const m = items.find(i => i.role === 'main'); if (m) { m.raw.goalBpm = req.tempo; m.raw.startBpm = Math.min(m.raw.startBpm, Math.round(req.tempo * 0.6)); } }
  // Keep the set focused: up to 4, drill → main → apply
  const order = { drill: 0, main: 1, apply: 2 };
  const picked = items.filter(i => i.raw).sort((a, b) => order[a.role] - order[b.role]).slice(0, 4);
  what = [...new Set(what)];
  return { understood: what, key: `${kn}${key.minor ? ' minor' : ''}`, items: picked };
}

/** Normalize builder output into exercises (with roles). */
export function exercisesForRequest(profile, text) {
  const req = parseRequest(text);
  const built = buildForRequest(profile, req);
  const used = new Set();
  const items = built.items.map(({ role, raw }) => {
    const ex = normalizeExercise({ ...raw, id: 'ask-' + (raw.id || raw.name) }, used);
    if (!ex) return null;
    ['metroMode', 'picking', 'beatsPerBar'].forEach(k => { if (raw[k] && !ex[k]) ex[k] = raw[k]; });
    return { role, ex };
  }).filter(Boolean);
  return { req, understood: built.understood, key: built.key, items };
}
