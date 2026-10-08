# Adding lessons to Fretwork Coach

This is the contract for adding lesson content (the Artist Series and the technique library) without touching the app's code. The automated content runs follow it, and so should anyone adding lessons by hand. App features and UI are developed separately; if content needs something the app can't do yet, write it in `content/REQUESTS.md` instead of changing app code.

## Where content lives

| File | What goes there |
|---|---|
| `js/data/artists.js` | **All lesson content:** generator functions, the `TECHNIQUES` library, and the `ARTISTS` list. |
| `content/ROSTER.md` | The list of guitar virtuosos to cover. Each one has a status (`planned`, `built`, `needs-work`), signature techniques, sources and the build date. |
| `content/LOG.md` | One entry per content run: the date, what was added, sources used, and validator output. |
| `content/REQUESTS.md` | Things the content needs from the app (a new note technique, a new screen…) for the development thread. |

Content runs edit **only** these files. They never edit anything else in `js/`, `css/`, `index.html`, `sw.js` or `README.md`.

## The technique library (`TECHNIQUES`)

A technique is a named skill a player might ask for ("rolling 5s", "hybrid picking", "travis picking for beginners"). Requests and master classes that name it get its skills, and artists reuse them.

```js
{ id: 'rolling5s',                 // camelCase or kebab-case, unique
  title: 'Rolling 5s',             // how players name it
  re: /rolling (5|five)'?s?|groups? of (5|five)/,  // matches the ways people write it; must match its own title (lowercased)
  domain: 'picking',               // fretting | picking | rhythm | fretboard | theory | ear | improv
  summary: 'One sentence on what it is.',
  skills: [S('rolling5s-box', 'Rolling 5s in box 1', 'picking', 'One sentence.', [c => ejRolling5s(c), ...])] }
```

**Skill entries.** Each entry in a skill's list is one of:
- a generator `(c) => exercise`;
- an atom `['atomName', {opts}, {ctxPatch}]` from `js/core/atoms.js` (for example `['bendLick']`, `['scaleRun', {scale: 'blues', box: 1}]`, `['callResponse', {chords: '$blues'}]`);
- a written drill `W(...)` for things a tab can't show. Use `W` sparingly: lessons with tabs are far more useful.

## Artists (`ARTISTS`)

```js
{ id: 'eric-johnson', name: 'Eric Johnson', wiki: ['Eric Johnson (guitarist)'],  // Wikipedia article titles (for the photo)
  genre: 'rock',                  // a genre id from js/data/catalog.js
  re: /eric johnson|\bej\b/,      // finds the artist in a request; must not match any other artist's name
  blurb: 'One sentence on the sound.',
  techniques: ['Speed pentatonics', 'Rolling 5s', ...],   // 3–6 signature techniques, shown as chips
  ctx: { key: 9, minor: true, prog: 'minorRock' },         // default key (pitch class, C = 0) and backing progression
  units: [U('Unit title', 'One sentence.', [skills...]), ...],  // 4–6 units, easiest first; the last puts it together in music
  riffs: [{ title: 'Cliffs of Dover', note: 'What it showcases.' }, { title: '…', artist: 'Band name', note: '…' }] }
```

Units should reuse `techSkills('id')` from the library wherever a technique already exists, and add new techniques to the library rather than burying them in one artist.

## Writing a generator

A generator receives `c = { key, minor, lvl, genre, prog }` and returns a raw exercise built with `make(c, {...})`, the helper at the top of `artists.js`. It is pure: no randomness, no network, the same output for the same input.

| Field | What it is |
|---|---|
| `id` | Kebab-case and unique. |
| `name` | Specific: name the technique, the key and where it sits on the neck. |
| `domain` | One of the seven domains listed above. |
| `unit` | Says what is played against the click, for example `'16th notes'`, `'16th-note sextuplets'`, `'8th-note triplets'` or `'8th notes'`. |
| `goal` | A base goal tempo; `make` scales it with the level. `start` is optional. |
| `why` | 1–2 sentences on what this builds and why this player does it. |
| `instr` | Concrete steps: fingering, picking, what to count. |
| `watch` | The most common mistake. |
| `simplify` | An easier version for when it's too hard. |
| `tab` | `{ notes }`, where each note is `N(string, fret, t, d, technique?, extra?)`. |

Tab note rules:
- String 1 is the high e and string 6 is the low E. Frets run 0–22.
- `t` and `d` are in beats.
- Techniques: `h` hammer-on, `p` pull-off, `/` and `\` slides, `b` bend (`extra: { bendTo: semitones }`), `~` vibrato, `pm` palm mute, `t` tap.
- Notes struck together share `t` and carry `extra: { chord: true }`.

Chord parts add two fields:
- `voicings`: `[{ name, frets: [lowE … highE] }]`, with `null` for a muted string.
- `chords`: the chord names. Add `backing` for an accompaniment loop.

Helpers in `artists.js` cover most needs:
- `pentBox(key, box)`: a minor-pentatonic box.
- `pent3nps(key)`: three-notes-per-string pentatonic.
- `spreadVoicing(root, type, set, nearFret)`: spread triads.
- `legatoMarks(seq)`: adds hammer-on and pull-off marks.
- `chordInfo(name)`: the notes of a chord.
- `fromSeq(seq, step)`: turns a sequence into evenly spaced notes.
- `byString(notes)`: groups notes by string.

You can also import `scaleNps`, `chordTones` and `parseChord` from `js/core/theory.js`, and `fretOn` and `rootFret6` from `js/core/atoms.js`.

## Teaching rules

- **Edge zone.** Calibrate every exercise so a player at its level succeeds 70–85% of the time. Keep it measurable: a start and goal tempo, and a clear pass criterion in `instr` or `watch`.
- **Difficulty from 1 to 10.** Generators should scale with `c.lvl` (tempo goal, length, subdivision, or a harder variant). Cover beginner (1–3), intermediate (4–6) and advanced (7–10) material across the library, not only virtuoso tricks.
- **Musically correct.** Every note must belong to the scale or chord it claims. Verify pitches from string and fret, using standard tuning MIDI 40 45 50 55 59 64 for strings 6 to 1.
- **Theory follows the hands.** When a lesson introduces a concept (a scale degree, an arpeggio), say it in `why` or `instr` and apply it on the neck right away.
- **Specific, not generic.** A lesson for a named technique drills that technique itself, not a generic substitute.

## Copyright (non-negotiable)

- Exercises are **original** and written "in the style of" the player. Never transcribe or closely paraphrase a copyrighted riff, solo, melody or tab, including "simplified" versions.
- Famous songs go in `riffs` as a title and a note only, never notes. The app links them to Songsterr and lets the player add them to My songs.
- Research sources (interviews, lesson videos, articles) inform which techniques to teach. Their text and tabs are not copied. Paraphrase in your own words and record the source URLs in `content/LOG.md`.

## Checking your work

Run this from the repo root:

```
node tools/validate-content.mjs
```

It must end with `All content is valid.`; errors block the commit. It checks:
- every generator runs and its output survives the app's normalizer;
- tab ranges, timing, techniques, chord names and voicings are valid;
- each artist has 8 or more lessons and the required fields;
- each artist's master class builds;
- regexes find their own names and don't collide;
- no song in `riffs` carries notes.

Fix warnings when you can.

## Committing

1. `git pull --rebase` before you start and again before pushing.
2. Change only the content files listed above.
3. Run the validator.
4. Commit with a message like `Content: add Yngwie Malmsteen (5 units, 14 lessons)`, then push to `main`. GitHub Pages deploys in about a minute.
5. If a rebase conflicts with an app file, stop. Don't resolve it by editing app code; record it in `content/LOG.md` and the run's summary.
6. If `js/data/artists.js` grows past about 300 KB, add a note to `content/REQUESTS.md` asking for it to be split into per-artist files.
