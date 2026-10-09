// Artist Series: Paul Gilbert. Original lessons in this style, built from the knowledge base; famous songs are linked, never transcribed.
// Every technique unit draws from a researched learning path (PU), so progress is shared with the
// Technique Library and with every other artist who uses the same path. Only the closing study is his own.
import { OPEN, N, nameOf, minorKey, make, mod12, S, U, PU, M, artist, targetGuide } from '../lib.js';
import alternatePicking from '../kb/alternatePicking.js';
import pgSix, { cell } from '../kb/pgSix.js';
import pent6s, { grouped, shapeOf } from '../kb/pent6s.js';
import stretchPent, { fullShape } from '../kb/stretchPent.js';
import skipArps, { skipCell } from '../kb/skipArps.js';

const pitch = (s, f) => OPEN[s] + f;

/** An original 8-bar study in his style: the six-note lick, sixes, a stretched run, skipped arpeggios, a held landing. */
export function pgStudy(c) {
  const k = minorKey(c), notes = [];
  const put = (seq, step, t0, beats) => { let t = t0; for (const [s, f] of seq) { if (t >= t0 + beats - 1e-6) break; notes.push(N(s, f, t, step)); t += step; } };
  const six = cell(k, 1, 2, 1), six3 = cell(k, 1, 3, 2), b1 = shapeOf(k, 'box', 1), st = fullShape(k, 1);
  const chords = [nameOf(k) + 'm', nameOf(k + 8), nameOf(k + 10), nameOf(k) + 'm'];
  if (!six || !six3 || !b1 || !st) return null;
  put([...six, ...six, ...six, ...six], 1 / 6, 0, 4);                 // bar 1: the six-note lick, top strings
  put([...six3, ...six3, ...six3, ...six3], 1 / 6, 4, 4);             // bar 2: one string pair down
  put(grouped(b1, 6, 'down'), 1 / 6, 8, 8);                            // bars 3–4: sixes down the box
  put([...st.list, ...st.list.slice(0, -1).reverse()], 0.25, 16, 8);   // bars 5–6: the stretched diagonal up and down
  for (const [i, nm] of [chords[1], chords[2]].entries()) {            // bar 7: skipped arpeggios on ♭VI and ♭VII, two beats each
    const cl = skipCell(nm, [4, 2], 0, 7); if (!cl) return null;
    put([...cl, ...cl.slice(1, -1).reverse(), ...cl, ...cl.slice(1, -1).reverse()], 1 / 6, 24 + i * 2, 2);
  }
  const root = b1.find(([s, f]) => s <= 4 && mod12(pitch(s, f) - k) === 0) || b1[0];
  notes.push(N(root[0], root[1], 28, 4, '~'));                          // bar 8: land with wide vibrato
  return make(c, {
    id: 'pg-study', name: `A study in his style: lick, sixes, stretches, skips (${nameOf(k)} minor)`, domain: 'improv', method: 'transfer',
    unit: 'sextuplets and 16ths', goal: 92, minutes: 8, dl: 1, picking: 'strict', backing: chords, chords: [chords[0], chords[1], chords[2]],
    why: 'His solos string his picking ideas together at full commitment, then stop on one big, singing note. This original study chains each path of the course: the six-note lick on two string pairs, sixes down the box, the stretched diagonal, skipped-string arpeggios and the landing.',
    instr: 'Learn it two bars at a time, then join them. Strict alternate picking throughout, starting every bar with a downstroke. Bar 7 changes chord every two beats (♭VI, then ♭VII). End on the root with a wide, slow vibrato and hold it. Then rewrite bars 5–8 as your own. Pass: the study at the goal tempo with no stops, then your version once.',
    watch: 'Running out of steam in bars 5–6: relax the picking hand on the held note at the end of bar 4.', simplify: 'Bars 1–4.', tab: { notes }
  });
}

export default artist({ id: 'paul-gilbert', name: 'Paul Gilbert', wiki: ['Paul Gilbert'], genre: 'rock', re: /paul gilbert|\bgilbert\b|racer x/,
    blurb: 'Machine-gun alternate picking, the six-note pentatonic lick, pentatonic sequences, wide stretches and string-skipped arpeggios.',
    techniques: ['Strict alternate picking', 'Six-note pentatonic lick', 'Pentatonic in sixes', 'Stretched pentatonic', 'String-skipped arpeggios'],
    ctx: { key: 9, minor: true, prog: 'minorRock' },
    units: [
      PU(alternatePicking, { title: 'Alternate picking', summary: 'The foundation of everything he plays: small, even down-up strokes, inside and outside string changes, three-notes-per-string runs, bursts and accents.' }),
      PU(pgSix, { title: 'The six-note lick', summary: 'His best-known speed drill: the two-string pentatonic cell that trains the inside string change.' }),
      PU(pent6s, { title: 'Pentatonic sequences', summary: 'Groups of 3, 4, 5 and 6 through the pentatonic, the vocabulary of his fast runs.' }),
      PU(stretchPent, { title: 'Stretched pentatonic', summary: 'Three notes per string: the wide shapes behind his long, even pentatonic lines.' }),
      PU(skipArps, { title: 'String-skipped arpeggios', summary: 'Wide-interval arpeggios played with alternate picking instead of sweeps.' }),
      U('Putting it together', 'All of it in a piece, then in a solo.', [
        S('pg-study', 'A study in his style', 'improv', 'The lick, sixes, stretches and skips in eight bars.', [c => pgStudy(c)]),
        S('pg-solo', 'Picking licks in a solo', 'improv', 'Fast ideas, then a long held note.', [M('transfer', ['callResponse', { chords: '$minorRock' }]), c => targetGuide(c, { prog: 'powerMinor', scale: 'minorPent', name: 'Hard-rock solo: bursts of his licks, each ending on a long note with vibrato' })])])
    ],
    riffs: [
      { title: 'Technical Difficulties', artist: 'Racer X', note: 'Alternate-picking and arpeggio showcase.' },
      { title: 'Scarified', artist: 'Racer X', note: 'Fast picked lines and string skipping.' },
      { title: 'Daddy, Brother, Lover, Little Boy', artist: 'Mr. Big', note: 'Fast unison picking runs.' },
      { title: 'Green-Tinted Sixties Mind', artist: 'Mr. Big', note: 'Tapped arpeggio intro.' },
      { title: 'Addicted to That Rush', artist: 'Mr. Big', note: 'Fast picked riffing.' },
      { title: 'Get Out of My Yard', note: 'Instrumental full of his picking vocabulary.' }
    ] });
