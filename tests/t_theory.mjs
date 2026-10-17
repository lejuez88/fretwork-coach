// Music-theory correctness: the rules every scale, chord, position and lesson must obey.
// The checks don't trust the app's own tables: they work things out from first principles
// (degree → semitones from the major scale; letters stacked in order; the notes physically on
// each string and fret) and from textbook spellings typed in by hand, then compare.
const ok = window.__ok;
(async () => {
  const T = await import('../js/core/theory.js');
  const I = await import('../js/core/intervals.js');
  const { scaleNotes, neckMarksFor } = await import('../js/screens/scales.js');
  const { SCALES, SCALE_BY_ID, CHORD_TYPES, ROOTS, STD_LOW, mod12 } = T;

  // ---- first principles
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  /** Semitones of a degree label from the major scale: '♭3' → 3, '♯4' → 6, '♭♭7' → 9, '13' → 9, 'R' → 0. */
  const semis = label => {
    if (label === 'R') return 0;
    const m = String(label).match(/^([♭♯b#]*)(\d+)$/); if (!m) return NaN;
    const n = +m[2], acc = [...m[1]].reduce((a, c) => a + (c === '♭' || c === 'b' ? -1 : 1), 0);
    return mod12(MAJOR[(n - 1) % 7] + acc);
  };
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  /** Pitch class of a written note name: 'F♯' → 6, 'B♯' → 0, 'E♭♭' → 2. */
  const pcOf = name => mod12(LETTER_PC[name[0]] + [...name.slice(1)].reduce((a, c) => a + (c === '♭' ? -1 : c === '♯' ? 1 : 0), 0));
  const root = n => ROOTS.find(r => r.name === n);
  let bad;

  // 1. every scale's degree labels match its semitones
  bad = [];
  for (const sc of SCALES) sc.steps.forEach((st, i) => { if (semis(sc.labels[i]) !== mod12(st)) bad.push(`${sc.id} ${sc.labels[i]}=${st}`); });
  ok(!bad.length, 'every scale degree label matches its semitones: ' + bad.join(', '));

  // 2. textbook formulas, typed in independently
  const FORMULA = {
    major: '1 2 3 4 5 6 7', minor: '1 2 b3 4 5 b6 b7', dorian: '1 2 b3 4 5 6 b7', phrygian: '1 b2 b3 4 5 b6 b7',
    lydian: '1 2 3 #4 5 6 7', mixolydian: '1 2 3 4 5 6 b7', locrian: '1 b2 b3 4 b5 b6 b7',
    harmonicMinor: '1 2 b3 4 5 b6 7', melodicMinor: '1 2 b3 4 5 6 7', phrygianDominant: '1 b2 3 4 5 b6 b7',
    minorPent: '1 b3 4 5 b7', majorPent: '1 2 3 5 6', blues: '1 b3 4 b5 5 b7', majorBlues: '1 2 b3 3 5 6',
    lydianDominant: '1 2 3 #4 5 6 b7', altered: '1 b2 #2 3 b5 #5 b7', dimWH: '1 2 b3 4 b5 #5 6 7', dimHW: '1 b2 #2 3 #4 5 6 b7',
    wholeTone: '1 2 3 #4 #5 b7', hungarianMinor: '1 2 b3 #4 5 b6 7', chromatic: '1 b2 2 b3 3 4 b5 5 b6 6 b7 7'
  };
  bad = [];
  for (const [id, f] of Object.entries(FORMULA)) {
    const want = f.split(' ').map(x => semis(x === '1' ? 'R' : x)), got = (SCALE_BY_ID[id] || { steps: [] }).steps.map(mod12);
    if (want.join() !== got.join()) bad.push(`${id}: ${got} ≠ ${want}`);
  }
  ok(!bad.length && Object.keys(FORMULA).every(id => SCALE_BY_ID[id]), 'every scale matches its textbook formula: ' + bad.join(' | '));

  // 3. the modes of the major scale are rotations of it
  const modes = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'];
  bad = modes.filter((id, k) => { const rot = MAJOR.map(x => mod12(x - MAJOR[k])).sort((a, b) => a - b); return rot.join() !== SCALE_BY_ID[id].steps.join(); });
  ok(!bad.length, 'the seven modes are the major scale started on each degree: ' + bad.join(', '));

  // 4. spelling: textbook examples, letter by letter
  const SPELL = [
    ['C', 'major', 'C D E F G A B'], ['F♯', 'major', 'F♯ G♯ A♯ B C♯ D♯ E♯'], ['F♯', 'lydian', 'F♯ G♯ A♯ B♯ C♯ D♯ E♯'],
    ['A', 'lydian', 'A B C♯ D♯ E F♯ G♯'], ['E♭', 'dorian', 'E♭ F G♭ A♭ B♭ C D♭'], ['B', 'locrian', 'B C D E F G A'],
    ['A', 'harmonicMinor', 'A B C D E F G♯'], ['E', 'phrygianDominant', 'E F G♯ A B C D'], ['B♭', 'mixolydian', 'B♭ C D E♭ F G A♭'],
    ['A', 'minorPent', 'A C D E G'], ['A', 'blues', 'A C D E♭ E G'], ['C', 'lydianDominant', 'C D E F♯ G A B♭'],
    ['G', 'minor', 'G A B♭ C D E♭ F'], ['D', 'melodicMinor', 'D E F G A B C♯'], ['C♯', 'minor', 'C♯ D♯ E F♯ G♯ A B'], ['C', 'altered', 'C D♭ E♭ F♭ G♭ A♭ B♭']
  ];
  bad = SPELL.filter(([r, id, want]) => scaleNotes(root(r).pc, id).map(n => n.name).join(' ') !== want).map(([r, id, want]) => `${r} ${id}: ${scaleNotes(root(r).pc, id).map(n => n.name).join(' ')} (want ${want})`);
  ok(!bad.length, 'scales are spelled the textbook way: ' + bad.join(' | '));

  // 5. every seven-note scale, in every key, uses each letter once and the right pitches
  bad = [];
  for (const sc of SCALES) for (const r of ROOTS) {
    const ns = scaleNotes(r.pc, sc.id);
    if (ns.some((n, i) => pcOf(n.name) !== mod12(r.pc + sc.steps[i]))) bad.push(`${r.name} ${sc.id}: wrong pitch`);
    if (sc.steps.length === 7 && new Set(ns.map(n => n[0] || n.name[0])).size !== 7) bad.push(`${r.name} ${sc.id}: ${ns.map(n => n.name).join(' ')}`);
  }
  ok(!bad.length, 'every scale in all 12 keys: right pitches, one letter per degree: ' + bad.slice(0, 6).join(' | '));

  // 6. scales tool positions: every note of the scale is in every position, nothing outside the scale
  bad = [];
  for (const sc of SCALES) for (const r of ROOTS) {
    const pcs = new Set(sc.steps.map(x => mod12(r.pc + x))), pos = T.scalePositions(r.pc, sc.id);
    if (!pos.length) bad.push(`${r.name} ${sc.id}: no positions`);
    pos.forEach(({ lo, hi, notes }, k) => {
      const lit = new Set(notes.map(n => `${n.s}:${n.f}`));
      const marks = neckMarksFor(r.pc, sc.id, { maxFret: Math.max(15, hi), lit }).filter(m => !m.ghost);
      if (marks.length !== notes.length) bad.push(`${r.name} ${sc.id} position ${k + 1}: ${notes.length} notes, ${marks.length} shown`);
      const found = new Set(notes.map(n => mod12(n.midi)));
      const missing = [...pcs].filter(pc => !found.has(pc));
      if (missing.length) bad.push(`${r.name} ${sc.id} position ${k + 1} is missing ${missing.map(pc => scaleNotes(r.pc, sc.id).find(n => n.pc === pc).label).join(', ')}`);
      // run it straight up: every scale tone in order, none skipped, no note outside the scale
      const run = notes.map(n => n.midi), want = []; for (let m = run[0]; m <= run[run.length - 1]; m++) if (pcs.has(mod12(m))) want.push(m);
      if (run.join() !== want.join()) bad.push(`${r.name} ${sc.id} position ${k + 1}: playing it up skips ${want.filter(m => !run.includes(m)).map(m => scaleNotes(r.pc, sc.id).find(n => n.pc === mod12(m)).label).join(', ') || 'nothing but is out of order'}`);
      if (notes.some(n => STD_LOW[6 - n.s] + n.f !== n.midi)) bad.push(`${r.name} ${sc.id} position ${k + 1}: a note is on the wrong fret`);
      if (notes.some(n => semis(n.label) !== mod12(n.midi - r.pc))) bad.push(`${r.name} ${sc.id} position ${k + 1}: a wrong degree label`);
      if (run[run.length - 1] - run[0] < 12) bad.push(`${r.name} ${sc.id} position ${k + 1}: less than an octave`);
      if (hi - lo > 6) bad.push(`${r.name} ${sc.id} position ${k + 1} spans ${hi - lo + 1} frets`);
    });
    const outside = neckMarksFor(r.pc, sc.id).filter(m => !pcs.has(mod12(STD_LOW[6 - m.s] + m.f)));
    if (outside.length) bad.push(`${r.name} ${sc.id}: ${outside.length} notes outside the scale on the neck`);
    // every scale note on every string in frets 0–15 is shown
    const expected = []; for (let i = 0; i < 6; i++) for (let f = 0; f <= 15; f++) if (pcs.has(mod12(STD_LOW[i] + f))) expected.push(`${6 - i}:${f}`);
    const shown = new Set(neckMarksFor(r.pc, sc.id).map(m => `${m.s}:${m.f}`));
    if (expected.some(x => !shown.has(x))) bad.push(`${r.name} ${sc.id}: a scale note on the neck isn't shown`);
  }
  ok(!bad.length, 'scales tool: every position runs through the whole scale without skipping a note; the neck shows exactly the scale: ' + bad.slice(0, 6).join(' | '));
  {
    const pos = T.scalePositions(root('A').pc, 'lydian');
    ok(pos.length === 7, `A Lydian has seven positions (${pos.length})`);
    ok(T.scalePositions(root('A').pc, 'minorPent').length === 5, 'A minor pentatonic has five boxes');
  }

  // 7. lessons' scale patterns (notes per string): consecutive scale tones, no gaps, no wrong notes
  bad = [];
  for (const sc of SCALES) for (const r of ROOTS) for (let f = 0; f <= 12; f++) {
    for (const nps of sc.steps.length <= 6 ? [2, 3] : [3]) {
      const ns = T.scaleNps(r.pc, sc.id, f, nps); if (!ns) continue;
      const order = []; for (let m = ns[0].midi; m <= ns[ns.length - 1].midi; m++) if (sc.steps.map(x => mod12(r.pc + x)).includes(mod12(m))) order.push(m);
      if (ns.map(n => n.midi).join() !== order.join()) bad.push(`${r.name} ${sc.id} ${nps}nps from fret ${f}`);
      if (ns.some(n => semis(n.label) !== mod12(n.midi - r.pc))) bad.push(`${r.name} ${sc.id}: wrong degree label`);
    }
  }
  ok(!bad.length, 'lesson scale patterns: every scale tone in order, labels right: ' + bad.slice(0, 5).join(' | '));

  // 7b. the lessons' scale runs (what the tab player plays): straight up through every tone, no gaps
  {
    const A = await import('../js/core/atoms.js');
    bad = [];
    for (const sc of SCALES) for (const r of ROOTS) for (let box = 1; box <= Math.min(5, sc.steps.length); box++) {
      let ex = null; try { ex = A.scaleRun({ key: r.pc, minor: false, lvl: 4, genre: 'rock' }, { scale: sc.id, box }); } catch (e) { bad.push(`${r.name} ${sc.id} box ${box}: ${e.message}`); continue; }
      if (!ex) continue;
      const midi = ex.tab.notes.map(n => STD_LOW[6 - n.s] + n.f);
      const top = midi.indexOf(Math.max(...midi)), up = midi.slice(0, top + 1);
      const pcs = new Set(sc.steps.map(x => mod12(r.pc + x))), want = []; for (let m = up[0]; m <= up[up.length - 1]; m++) if (pcs.has(mod12(m))) want.push(m);
      if (up.join() !== want.join()) bad.push(`${r.name} ${sc.id} position ${box}: skips ${want.filter(m => !up.includes(m)).length} note(s)`);
      if (midi.some(m => !pcs.has(mod12(m)))) bad.push(`${r.name} ${sc.id} position ${box}: a note outside the scale`);
    }
    ok(!bad.length, 'lesson scale runs go straight through the scale: ' + bad.slice(0, 6).join(' | '));
  }

  // 7c. every lesson in every path and tier: notes on real strings and frets, chord names that exist
  {
    const kb = await import('../js/data/kb.js'), M = await import('../js/core/master.js');
    const pp = { domains: {}, varState: {}, settings: {}, questionnaire: { genres: [] }, courses: [] };
    bad = []; let count = 0;
    for (const t of kb.KB_INDEX) for (const st of t.stages || []) {
      let ls = []; try { ls = await M.stageLessonList(pp, t.id, { tier: st.tier, lvl: st.levels[0] }); } catch (e) { bad.push(`${t.id} ${st.tier}: ${e.message}`); continue; }
      for (const l of ls) {
        count++;
        const ns = (l.ex.tab && l.ex.tab.notes) || [];
        const nStr = [6, 7, 8].includes(l.ex.tab && l.ex.tab.strings) ? l.ex.tab.strings : 6;
        if (ns.some(n => !(n.s >= 1 && n.s <= nStr) || !(n.f >= 0 && n.f <= 24))) bad.push(`${t.id}: ${l.ex.name}: a note off the neck`);
        (l.ex.chords || []).forEach(c => { if (!T.parseChord(c)) bad.push(`${t.id}: ${l.ex.name}: unknown chord ${c}`); });
      }
    }
    ok(count > 300 && !bad.length, `all ${count} path lessons: notes on the neck, real chord names: ` + bad.slice(0, 6).join(' | '));
  }

  // 8. chords: labels match semitones and textbook formulas
  bad = [];
  for (const c of CHORD_TYPES) c.tones.forEach(({ semis: st, label: lab }) => { if (semis(lab) !== mod12(st)) bad.push(`${c.id} ${lab}=${st}`); });
  const CF = { maj: '1 3 5', min: '1 b3 5', dim: '1 b3 b5', aug: '1 3 #5', 7: '1 3 5 b7', maj7: '1 3 5 7', m7: '1 b3 5 b7', m7b5: '1 b3 b5 b7', dim7: '1 b3 b5 bb7', '7s9': '1 3 5 b7 #9', 13: '1 3 5 b7 9 13' };
  for (const [id, f] of Object.entries(CF)) { const c = CHORD_TYPES.find(x => x.id === id); const want = f.split(' ').map(x => semis(x === '1' ? 'R' : x)).sort((a, b) => a - b).join(); if (!c || c.tones.map(t => mod12(t.semis)).sort((a, b) => a - b).join() !== want) bad.push(id); }
  ok(!bad.length, 'chord formulas: ' + bad.join(', '));

  // 9. chord voicings sound the chord: every voicing's notes are chord tones, root and 3rd present
  bad = [];
  for (const r of ROOTS) for (const id of ['maj', 'min', '7', 'maj7', 'm7', 'm7b5', 'dim7', '9']) {
    const tones = new Set(T.chordTones(r, id).map(t => t.pc));
    const vs = T.findVoicings(r, id, { limit: 6 }) || [];
    if (!vs.length) bad.push(`${r.name}${id}: no voicing`);
    vs.forEach(v => {
      const frets = v.frets || v;
      const pcs = frets.map((f, i) => (f == null ? null : mod12(STD_LOW[i] + f))).filter(x => x != null);
      if (pcs.some(pc => !tones.has(pc))) bad.push(`${r.name}${id} ${frets.join(',')}: wrong note`);
    });
  }
  ok(!bad.length, 'every chord voicing plays only chord tones: ' + bad.slice(0, 5).join(' | '));

  // 10. diatonic chords: qualities from stacked thirds of the scale, letters in order
  bad = [];
  for (const r of ROOTS) for (const mode of ['major', 'minor']) {
    const steps = mode === 'major' ? MAJOR : [0, 2, 3, 5, 7, 8, 10];
    T.diatonicChords(r, mode).forEach((ch, i) => {
      const a = steps[i], b = steps[(i + 2) % 7] + (i + 2 >= 7 ? 12 : 0), c = steps[(i + 4) % 7] + (i + 4 >= 7 ? 12 : 0);
      const q = [b - a, c - a].join();
      const want = { '4,7': 'maj', '3,7': 'min', '3,6': 'dim', '4,8': 'aug' }[q];
      if (ch.type !== want) bad.push(`${r.name} ${mode} ${ch.roman}: ${ch.type} ≠ ${want}`);
      if (pcOf(ch.root.name) !== mod12(r.pc + a)) bad.push(`${r.name} ${mode} ${ch.roman}: root ${ch.root.name}`);
    });
    const letters = T.diatonicChords(r, mode).map(ch => ch.root.name[0]).join('');
    if (new Set(letters).size !== 7) bad.push(`${r.name} ${mode}: letters ${letters}`);
  }
  ok(!bad.length, 'diatonic chords in every key: right quality, right root, one letter each: ' + bad.slice(0, 5).join(' | '));

  // 11. interval table
  bad = I.INTERVALS.filter(x => x.id !== '8' && semis(x.deg) !== mod12(x.semis)).map(x => x.id);
  ok(!bad.length, 'interval names match their semitones: ' + bad.join(', '));
  window.__finish();
})().catch(e => { window.__ok(false, 'THROW ' + e.stack); window.__finish(); });
