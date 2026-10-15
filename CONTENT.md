# Adding lessons to Fretwork Coach

This is the contract for lesson content: the **knowledge base** (techniques, subjects and styles, each taught as a learning path from scratch to mastery) and the **Artist Series**. The scheduled content runs follow it on every run, and so should anyone adding lessons by hand. **This file overrides any older instructions in a run's prompt.**

App features and UI are developed separately (the development thread). If content needs something the app can't do, write it in `content/REQUESTS.md` instead of changing app code.

## Goal

Someone who has never played a technique, subject or style must be able to start from scratch in the app and reach true mastery of it. Every topic gets a complete path. The library also keeps growing on its own: each run researches new topics as well as deepening existing ones.

## Files you may edit

| File | What goes there |
|---|---|
| `js/data/kb/<id>.js` | One knowledge-base entry (technique, subject or style) per file: its generators and its learning path. |
| `js/data/artists/<id>.js` | One artist per file: units of lessons on their signature techniques, plus famous songs as links. |
| `js/data/index.js` | **Generated** by `node tools/build-index.mjs`. Never edit it by hand, but commit it after every change. |
| `js/data/lib.js` | Shared helpers. You may **add** new exported helpers to its Helpers section. Don't change existing helpers or the Structure section (`TIERS`, `stage`, `entry`, `artist`, `S`, `U`, `W`). |
| `content/QUEUE.md` | The research queue: player requests, the depth backlog, and discovered topics. |
| `content/ROSTER.md` | The guitar virtuosos covered or planned. |
| `content/LOG.md` | One entry per run. |
| `content/REQUESTS.md` | What the content needs from the app. |

Never edit anything else in `js/`, `css/`, `index.html`, `sw.js`, `tools/`, `README.md` or this file.

## Learning paths: four stages

Every knowledge-base entry is a path through four stages (`TIERS` in `js/data/lib.js`):

| Stage (`tier`) | Levels | What it covers |
|---|---|---|
| `foundations` | 1–3 | From scratch. Assume only a basic open chord and holding a pick. Include the prerequisite motions as drills, then the first, slow version of the technique. |
| `intermediate` | 4–6 | The technique itself, in time with the click: several keys, positions and string sets, and simple musical uses. |
| `advanced` | 7–8 | Faster, longer and harder variations (odd groupings, wider shapes, string skipping), combinations with other techniques, and real-music contexts in several styles. |
| `mastery` | 9–10 | Performance tempo, endurance, improvising and composing with it, and a capstone: an original study piece that uses the whole technique musically. |

### The depth standard

A stage is **full** when it has **3 or more skills and 6 or more lessons**. A path is **complete** when all four stages are full. That is the floor: it makes a path usable from scratch to mastery, and the app marks it "Full path".

### The reference standard (build every path to this)

Every path should be as thorough as `js/data/kb/pentatonic.js`, the reference. "Complete" is not the goal; this is:

| Stage | Skills | Lessons |
|---|---|---|
| Foundations | 4+ | 8+ |
| Intermediate | 4+ | 10+ |
| Advanced | 4+ | 8+ |
| Mastery | 3+ | 6+ |

Also, for every path:
- **Taught the way it's taught:** a `pedagogy` record (see "Teaching method first") with the standard teaching sequence from 3+ recognized sources, and every skill mapped to a step of it. **This comes first.** Depth without it doesn't count.
- **Use it in music in every stage:** at least one `transfer` lesson per stage (over a groove or progression, call and response, a study), ending in the capstone study in Mastery.
- **Research on record:** `sources: ['https://…', …]` on the entry, 3+ URLs (reputable lessons, method books' publishers, teachers' articles, analyses) that the model and sequence come from. The log lists them too.
- **Correct in every key:** a concept model as code, every generator checked in all 12 keys (see "Teaching method first", step 4).

The validator checks all of this. Its coverage table marks paths that meet the standard (★: depth, sources and an audited pedagogy), warns about complete paths that fall short (with what's missing), and its Artist readiness table counts only paths that meet the standard. **A new artist can't ship until every path it draws from meets the reference standard.**

Paths that are complete but below the standard (everything built before 2026-10-09, including Paul Gilbert's five) get deepened to it, with priority for the paths artists use. When deepening, add skills that are distinct ideas (new patterns, string sets, rhythms, contexts or combinations), never the same exercise at another tempo.

- **Variety, not repetition.** Each skill is a distinct idea: a pattern, a string set, a rhythm, a key or position, a musical context, a combination. The app already rebuilds every lesson at each level inside the stage, adjusting tempo goals and lengths, so never add the same exercise at another tempo and call it a new lesson.
- **Pass criteria.** Each stage's `goal` says concretely what the player can do when the stage is done, for example "Travis pattern over G–Em–C–D at 90 BPM for 8 bars without the thumb hesitating". This is the stage's pass criterion.
- **Prerequisites.** When an entry depends on another technique, list it in `prereqs: ['alternatePicking']` (the app links to it). If the prerequisite doesn't exist yet, put it in the queue.

### An entry file

```js
// js/data/kb/travis.js
import { N, make, OPEN_SHAPES, onString, bassPair, S, stage, entry } from '../lib.js';

export function travisStages(c, { stage = 3 } = {}) { /* … returns make(c, {...}) */ }

export default entry({
  id: 'travis',                     // camelCase, the same as the file name
  kind: 'technique',                // technique | subject | style
  title: 'Travis picking', domain: 'picking',   // fretting | picking | rhythm | fretboard | theory | ear | improv
  re: /travis(-| )?pick|alternating(-| )thumb/,  // how people write it; must match its own title (lowercased)
  aliases: ['alternating bass fingerpicking'],   // optional extra names
  summary: 'One sentence.',
  prereqs: [],                      // optional: ids of entries to learn first
  ctx: { key: 0, minor: false, prog: 'folkAxis' },  // default key and backing for its lessons
  stages: [
    stage('foundations', 'The alternating thumb', 'Thumb alone over C–Am–G–C at 80 BPM, then one finger on the off-beats, 8 bars clean.', [
      S('travis-thumb', 'The thumb on autopilot', 'picking', 'One sentence.', [c => travisStages(c, { stage: 1 }), …]),
      S(…), S(…)
    ], [1, 3]),                     // optional levels inside the tier's range
    stage('intermediate', …), stage('advanced', …), stage('mastery', …)
  ]
});
```

**Skill entries.** Each entry in a skill's list is one of:
- a generator `(c) => exercise`, which is preferred;
- an atom from `js/core/atoms.js`, written `['atomName', {opts}, {ctxPatch}]`;
- a written drill `W(...)`, used sparingly for things a tab can't show.

**Reusing work.** Another entry's generators can be imported (`import tapping, { evhTapTriplets } from './tapping.js'`). Artists draw whole paths with `PU(entry)` (below), or single skills with `skillsOf(entry, 'skill-id')`.

## Artists (`js/data/artists/<id>.js`)

### Building an artist: technique-first

An artist course is only as good as the technique courses under it, so an artist is always built in this order. Don't skip or reorder steps, and don't publish the artist early.

1. **Research the artist.** Interviews, the artist's own lessons and instructional material, transcription-based analyses from reputable publications, and teachers who specialize in the style. Identify their **signature techniques** (usually 3–6) and their **style**: the scales, harmony, rhythm feel, tone and phrasing habits that make them recognizable. Record what you found and the URLs in the log, and the URLs in the artist's `sources`.
2. **Research each technique until it can be generated.** For each signature technique, follow "Teaching method first" below: research how it is taught (including the artist's own instructional material), record the pedagogy, then write the concept model. If the technique already has a path, review it against your research and improve it rather than starting over.
3. **Build a complete course for each technique.** Each technique becomes (or already is) its own knowledge-base path built to **the reference standard** (an audited pedagogy, all four stages at the pentatonic path's depth, music in every stage, sources on record), with every generator pitch-checked in all 12 keys. These paths are useful on their own: a player can learn the technique without the artist.
4. **Only then add the artist.** When every signature technique has a complete path, write the artist file. Its units draw from those paths with `PU` (choose the `tiers` that fit the style), in the order a player should learn them. The only lessons the artist file writes itself are in the closing **"put it together"** unit: original studies in the artist's style that combine the techniques, and improvising over their kind of progression.

The validator enforces this: for any new artist it is an **error** if a signature technique has no path (link it with `{name, path}` when the name alone doesn't find it), if a path it uses doesn't meet the reference standard, if a signature technique isn't taught by a `PU` unit, if a unit other than the last has its own lessons, if `sources` has fewer than 3 URLs, or if it has no `bio`. It also prints an **Artist readiness** table: which paths each artist still needs.

While an artist's techniques are being built (step 2–3 can take several runs), keep the artist `planned` in `content/ROSTER.md` with a note of which paths are done, so the next run picks up where you left off.

**The artists built before this rule** (Eric Johnson, Van Halen, Paul Gilbert, Stevie Ray Vaughan, Jimi Hendrix, David Gilmour, Guthrie Govan) get the same checks as warnings. Bring them up to the rule over the next runs: build their missing technique paths, then rewrite their files with `PU` units, `sources` and a `bio`. Artists already rewritten only need their `bio`: add those first, in the next run.

```js
import { S, U, PU, artist } from '../lib.js';
import pentatonic from '../kb/pentatonic.js';
import rolling5s from '../kb/rolling5s.js';
import spreadTriads from '../kb/spreadTriads.js';
export default artist({ id: 'eric-johnson', name: 'Eric Johnson', wiki: ['Eric Johnson (guitarist)'], genre: 'rock',
  re: /eric johnson|\bej\b/, blurb: 'One sentence on the sound.',
  techniques: ['Rolling 5s', { name: 'Violin-like legato tone', path: 'legatoTone' }, …],   // 3–6 chips; each must resolve to a complete path
  sources: ['https://…interview', 'https://…lesson', 'https://…analysis'],                 // 3+ URLs from step 1
  bio: `First paragraph…\n\nSecond paragraph…`,                                            // 120–200 words, original (see below)
  bands: ['Racer X', 'Mr. Big'],                                                           // optional: bands they're known for (finds their videos)
  topVideo: { id: 'xxxxxxxxxxx', title: 'Official video title', channel: 'Channel' },     // their most-viewed video on YouTube (see below)
  ctx: { key: 9, minor: true, prog: 'minorRock' },
  units: [PU(pentatonic, { title: 'The pentatonic boxes', tiers: ['intermediate', 'advanced', 'mastery'] }),
          PU(rolling5s, { title: 'Rolling 5s' }),
          PU(spreadTriads, { title: 'Spread triads' }),
          U('Putting it together', 'One sentence.', [S('ej-study', …), S('ej-solo', …)])],   // the closing unit: the artist's own studies
  riffs: [{ title: 'Cliffs of Dover', note: 'What it showcases.' }, { title: '…', artist: 'Band name', note: '…' }] });
```

An artist's signature techniques belong in the knowledge base, each as its own path, and the artist file reuses them. That way a player can learn "rolling 5s" with or without Eric Johnson.

**The bio** (`bio`, shown at the top of the artist page) is written from your step-1 research, in your own words: never copied or closely paraphrased from Wikipedia or any other source. 120–200 words in two or three short paragraphs, separated by a blank line: (1) who they are: era, bands and the records that made their name; (2) what defines their guitar playing: the sound, the techniques, the habits a listener recognizes; (3) why it's worth studying and how this course approaches it (which paths it draws on and in what order). Facts only, checked against at least two of your sources; no hype words. Until an artist has a bio, the page shows Wikipedia's introduction with credit.

**The most popular video** (`topVideo`, shown under the bio): the most-viewed YouTube video of the artist or a band they're known for, as an official upload (the artist's, band's or label's channel, VEVO or "- Topic"), not a cover, lesson or fan upload. Find it by searching YouTube sorted by view count and checking the view counts; give the 11-character video id, the title and the channel. List their bands in `bands`. When a player has a YouTube key, the app looks up the current most-viewed video itself and uses `topVideo` when it can't.

**Draw from paths with `PU(entry, {title, summary, tiers})`.** A path unit doesn't copy lessons: the artist page teaches the stage of that path the player is at (the stage they're partway through, else the first unfinished one at their level), with the path's own lessons and progress. A lesson mastered on the Paul Gilbert page is mastered on the path page and for every other artist who uses that path, and the unit moves on to the next stage when the current one is done. A master class built from the artist climbs each path unit two stages from the player's level. Use `tiers` to keep to the stages that matter for the player's style (for example only `['intermediate', 'advanced', 'mastery']` of the pentatonic path for a shred player). Rules:
- When an artist uses a technique that has a path, use `PU`. Never copy a multi-stage path with `skillsOf(entry)`; the validator warns when a unit does.
- Before writing a new artist-specific exercise, check whether an existing path already teaches it; if it does, draw from the path, and put anything genuinely new into that path (where every player gets it) rather than into the artist file.
- `U(...)` with `S(...)` skills only in the closing "put it together" unit. If something is truly the artist's own (a signature lick like Paul Gilbert's six-note cell), it still gets its own path (`pgSix`), so it can be taught from scratch to mastery.

## Study notes (read before playing)

The practice page opens every lesson with a **Study** panel: the concept, why it matters, and the theory behind it, so a player can understand a lesson before playing it. Write them per skill, as the sixth argument of `S(...)`:

```js
S('pent-boxes', 'The five boxes', 'fretboard', 'Each box two strings at a time.', [ … lessons … ], {
  concept: 'The minor pentatonic is five notes (R ♭3 4 5 ♭7) that repeat as five interlocking shapes ("boxes") along the neck.',
  why: 'Most rock, blues and funk solos are built from these shapes; knowing all five frees you from one position.',
  theory: ['Box 1 starts on the root on the low E string; each next box starts on the next scale note.', 'No half steps: that is why almost every note sounds right over a minor or dominant chord.']
})
```

- 2–3 sentences for `concept`, 1–2 for `why`, 2–4 short facts for `theory`; your own words, checked against your sources; correct theory only.
- The app adds what it can work out itself (the notes the exercise uses and the scale they form, the chord tones, the rhythm, the learning method), so don't repeat those mechanically.
- The validator warns about skills without study notes. Add them to every new skill, and to the existing paths over the next runs, starting with the paths artists use.

## Teaching method first (how every topic is built)

**Understanding a topic means understanding how it is taught.** Before writing a single lesson, find out how recognized teachers and method books actually teach this topic, and build the path from that. Lessons are the standard drills those sources use, in the order they use them. They are never new inventions made by combining a technique with unrelated tasks.

### 1. Research the pedagogy

Use **3 or more recognized sources** that teach this exact topic. Pick them by reputation, and prefer sources that show the actual teaching sequence:
- established method books and their publishers (Hal Leonard, Berklee Press, Mel Bay, Alfred);
- recognized teachers' courses and lesson series (for example JustinGuitar, Troy Grady's *Cracking the Code* for picking mechanics, Fender Play, TrueFire and Guitar World lessons by named instructors);
- the artist's own instructional material for a signature technique (Paul Gilbert's *Intense Rock*, Guthrie Govan's *Creative Guitar*, Eric Johnson's *Total Electric Guitar*, and so on).

From them, write down:
- **the sequence:** the order the topic is taught in, from first contact to mastery, as the sources agree on it. Where they disagree, follow the majority and note the difference.
- **the drills:** the standard exercise formats for each step. For vibrato: the supported-finger wrist motion on one note, slowly, then measured vibrato against a click (quarters, 8ths, triplets), then matching a pitch target, then vibrato on bent notes. For alternate picking: tremolo on one string, then string changes, then scale fragments and sequences.
- **the common mistakes** and the prerequisites.

### 2. Record it as the entry's `pedagogy`

```js
pedagogy: {
  date: '2026-10-13',          // the day it was researched; change it whenever the path is rebuilt
  summary: 'How the topic is usually taught, in one or two sentences.',
  sequence: [                  // the standard teaching order, from the sources
    { id: 'motion', tier: 'foundations', step: 'The wrist-rotation motion on one supported note',
      how: 'Third finger on the G string, first and second fingers behind it; rotate from the wrist, slowly.', skills: ['vib-motion'], source: 0 },
    { id: 'measured', tier: 'intermediate', step: 'Measured vibrato against a click', how: '…', skills: ['vib-measured'], source: 1 },
    …
  ],
  drills: ['Measured vibrato in quarters, 8ths and triplets', 'Pitch-target vibrato (bend to the note above, back)', …],
  mistakes: ['Vibrato from the finger instead of the wrist', '…'],
  sources: [{ title: 'Vibrato lessons', author: 'Justin Sandercoe (JustinGuitar)', url: 'https://…' }, …]   // 3+; a book needs title and author, a web page a url
}
```

Rules the validator enforces (errors for new and rebuilt paths, warnings for paths still waiting for their audit):
- 3+ steps in `sequence`, each with `id`, `tier`, `step`, `how` and the `skills` that teach it;
- **every skill of every stage is listed under a step**, and every listed skill exists;
- 3+ `drills` and 3+ `sources`.

### 3. Build the skills from the sequence

- Each skill teaches one step, with the drill formats the sources use for it. A skill name says what is practiced ("Measured vibrato against a click"), not a learning method.
- **Don't combine tasks the sources don't combine.** No singing, naming degrees or recalling shapes inside a technique drill unless a source teaches it that way. Ear training and theory belong in their own paths (or a clearly separate skill in a subject path), not bolted onto a technique.
- Keep keys, positions and contexts conventional for the topic: what the sources use first (often the key and position most teachers start in), then move to other keys and positions at the point the sources do.
- Every stage still ends with musical use: playing it over a groove or progression, or in an original study, the way the sources apply it.

### 4. Make it correct in every key

Write the facts once as code (notes, intervals, shapes and fingerings as functions of the key; see `js/data/kb/pentatonic.js` for a concept model), derive every exercise from it, and build every generator in all 12 keys at every level of its stage, checking every pitch. Combine dimensions (shape × rhythm × key × context) only into formats your sources name.

### 5. Practice methods are optional tags, not a quota

Research on practice (below) is about **how to practice** a drill: tempo ladders, clean repetitions, spaced review, mixing keys in later stages. You may tag a lesson with the one that fits (`method` on the exercise, or `M('method', entry)`), and the app shows it, but **no stage needs a set number of methods**, and a method is never a reason to invent a drill.

| `method` | What it means in practice | Evidence |
|---|---|---|
| `edge` | Climbing toward a goal at 70–85% clean | Deliberate practice (Ericsson et al. 1993) |
| `accurate-reps` | Clean repetitions counted, not minutes | Duke, Simmons & Cash 2009 |
| `chunking` | Small pieces joined; isolating the hard spot | Duke et al. 2009 |
| `interleaving` | Mixing keys or positions once the drill is secure | Carter & Grahn 2016; contextual interference |
| `spacing` | Spaced review (the app schedules it) | Cepeda et al. 2006 |
| `external-focus` | Instructions about the sound, not the fingers | Wulf 2013 review |
| `transfer` | The skill inside real music | Practice-specificity principle |

### The pedagogy audit (every existing path and artist)

Every path and artist built before 2026-10-13 was built to an older rule that required a mix of learning methods in every stage, and some of its lessons don't match how the topic is taught. Each one gets audited:
1. Research the pedagogy (steps 1–2) and add the `pedagogy` record.
2. Compare every skill and lesson to it. **Keep** what matches a standard drill, **rewrite** what is a standard drill done oddly, and **remove** what no source teaches (method-driven combinations such as vibrato plus degree recall, or singing inside a picking drill).
3. Fill the gaps the sequence shows, keeping the depth standard.
4. Set `pedagogy.date` to the day of the rebuild. Courses built from the path then offer the player a rebuild.

The validator's **Pedagogy audit** table lists the paths still waiting. Audit order: paths used by artists (Artist series pages show them first), then fundamentals (alternate picking, vibrato, bending, legato, pentatonic, slides), then the rest. An artist's own "put it together" unit gets the same audit against the artist's own instructional material and transcription-based analyses.

## Writing a generator

A generator receives `c = { key, minor, lvl, genre, prog }` and returns `make(c, {...})`. It is pure: no randomness, no network, the same output for the same input. It must **scale with `c.lvl`** (tempo goal, length, subdivision or a harder variant).

| Field | What it is |
|---|---|
| `id` | Kebab-case and unique. |
| `name` | Specific: name the technique, the key and where it sits on the neck. |
| `domain` | One of the seven domains listed above. |
| `unit` | Says what is played against the click (`'16th notes'`, `'16th-note sextuplets'`, `'8th-note triplets'`, `'8th notes'`). |
| `goal` | A base goal tempo; `start` is optional. |
| `why` | 1–2 sentences on what it builds. |
| `instr` | Concrete steps: fingering, picking, counting. End with a pass criterion. |
| `watch` | The most common mistake. |
| `simplify` | An easier version for when it's too hard. |
| `tab` | `{ notes }`, where each note is `N(string, fret, t, d, technique?, extra?)`. |

Tab note rules:
- String 1 is the high e and string 6 is the low E. Frets run 0–22.
- **7- and 8-string tabs** declare `strings` on the tab: `tab: { strings: 7 | 8, notes }`. Strings are numbered like tab: 1 = high e … 6 = low E, **7 = low B, 8 = low F♯**. Without `strings` a tab is for six strings and may only use strings 1–6 (the validator errors on string 7 or 8). Standard tuning for each count, as MIDI with string 1 first: 6 = `[64, 59, 55, 50, 45, 40]`, 7 = `[64, 59, 55, 50, 45, 40, 35]`, 8 = `[64, 59, 55, 50, 45, 40, 35, 30]`. Generators stay six-string unless the lesson is made for an extended-range guitar; only lessons that declare `strings: 7 | 8` use strings 7 and 8.
- **Tuning.** Lessons are written in standard tuning and leave `tuning` out. A lesson that needs another tuning (Drop D, Drop A, open G …) adds `tab.tuning`: an array of MIDI note numbers, **one per string, string 1 (high e) first**, the same length as the string count (6, or `strings`). Example, Drop D: `tab: { tuning: [64, 59, 55, 50, 45, 38], notes }`; Drop A on a 7-string: `tab: { strings: 7, tuning: [64, 59, 55, 50, 45, 40, 33], notes }`. Values are 20–76 (E2 = 40, B1 = 35, F♯1 = 30). Say the tuning in `instr` too. Frets are written as played in that tuning.
- How the app plays them: a tab with `tuning` sounds and is labelled in that tuning. A tab without it is shown in the player's own tuning (Settings → Guitar), so a player in Drop D sees and hears string 6 as D; the player sees a note saying the tab is written for standard. A 7- or 8-string tab on a guitar set to fewer strings still shows every string, with a note that it's written for 7 or 8 strings.
- `t` and `d` are in beats.
- Techniques:
  - `h` hammer-on, `p` pull-off, `/` and `\` slides, `~` vibrato, `pm` palm mute, `t` tap.
  - `b` bend, with `{bendTo: fret}`, the fret whose pitch the bend reaches.
  - `pb` pre-bend: bend silently, then pick (`{bendTo: fret}`). Follow it with `r`, release, on the same fret.
  - `mute`: a dead or raked note, drawn as "x".
  - `ghost`: a ghost note, drawn as "(5)".
  - `nh`: a natural harmonic at frets 12, 7, 5, 4 or 3, drawn as "<12>".
  - `ah`: an artificial or tapped harmonic, sounding an octave above the fretted note.
  - **Whammy bar** (an extra on any note, alone or with a technique): `{bar: 'dip' | 'scoop' | 'dive' | 'vib' | 'flutter', barDepth: semitones}`. `dip` pushes the pitch down and back, `scoop` starts below and rises to the note, `dive` sinks over the note's length (a dive bomb, often on a harmonic), `vib` is bar vibrato and `flutter` a fast flutter. `barDepth` defaults to 1 (dip, scoop), 12 (dive) or ½ (vib, flutter). Drawn above the note ("dip −1", "dive −12", "w/bar ~") and heard in the player. Example: `N(3, 12, t, 2, 'nh', { bar: 'dive', barDepth: 12 })`.
  - **Written pick stroke or finger** (an extra on any note): `{pick: 'd' | 'u'}` for a down or up stroke, `{fing: 'p' | 'i' | 'm' | 'a' | 'c'}` for a plucking finger (thumb, index, middle, ring, little; hybrid picking uses `m` and `a`). Marked notes are drawn as written (⊓, V, or the letter) in every picking mode; unmarked notes keep the computed strokes. Mark only where the stroke or finger is the point of the lesson (an upstroke start, an outside string change, a hybrid pluck); the app computes the rest.
- Bends glide up to `bendTo` in the player, and a release (`r` with `bendTo`) glides back down.
- Notes struck together share `t` and carry `{ chord: true }`.

Chord parts add two fields:
- `voicings`: `[{ name, frets: [lowE … highE] }]`, with `null` for a muted string.
- `chords`: the chord names. Add `backing` for an accompaniment loop.

`js/data/lib.js` has helpers for most needs:
- `pentBox`, `pent3nps`, `scaleNps`, `scaleBox`: scale shapes. For 7- and 8-string shapes pass the tuning, lowest string first: `scaleNps(root, scale, startFret, 3, { tuning: [30, 35, 40, 45, 50, 55, 59, 64] })` gives three notes per string across all eight strings (string numbers 8 … 1). `OPEN[7]` (35) and `OPEN[8]` (30) and `fretOn(7 | 8, pc)` work too.
- `spreadVoicing`, `topTriad`, `keyChords`, `chordInfo`: chords.
- `OPEN_SHAPES`, `onString`, `bassPair`: open chords for fingerstyle.
- `legatoMarks`, `fromSeq`, `byString`, `fretOn`, `rootFret6`: building note sequences.

## Teaching rules

- **Edge zone.** A player at a lesson's level should succeed 70–85% of the time.
- **Measurable.** Every lesson has a start and goal tempo and a clear pass criterion.
- **Musically correct.** Every note belongs to the scale or chord it claims. Verify pitches from string and fret, using standard tuning MIDI 40 45 50 55 59 64 for strings 6 to 1 (35 for string 7, 30 for string 8), or the tab's own `tuning` when it has one.
- **Theory follows the hands.** Name the concept in `why` or `instr` and apply it on the neck right away.
- **Specific, not generic.** A lesson for a named technique drills that technique itself.
- **Musical.** Every stage ends with at least one skill that uses the technique in music: over a progression, in a groove, in a short original piece.

## Copyright (non-negotiable)

- Exercises are **original** and written "in the style of" the player. Never transcribe or closely paraphrase a copyrighted riff, solo, melody or tab, simplified or not.
- Famous songs go in `riffs` as a title and a note only; the app links them to Songsterr.
- Research sources (teachers, curricula, interviews, lesson videos) inform *what* to teach, never the notes or text. Paraphrase in your own words and record the source URLs in `content/LOG.md`.

## The research queue (`content/QUEUE.md`)

The queue has three sections. Every run keeps them up to date.

1. **Player requests.** When a player asks the app for a technique, subject, style or guitarist it doesn't know, the app offers to add it to the knowledge base. Requests are saved to the player's Google Drive as **`Fretwork Coach research requests.json`** (`requests: [{text, kind, status, at, note?}]`). At the start of every run:
   - Find the file with the Google Drive connector: search for the title `Fretwork Coach research requests`, then read or download it.
   - Copy every request with `status: "queued"` into this section with the date, unless it's already there.
   - Mark a request built here (with the entry or artist id) once it ships. The app marks it "Added" by itself when the new entry matches the request's words, so make sure the new entry's `re` matches them.
   - If the Drive connector isn't available in the run, say so in the log and carry on with the rest of the queue.
2. **Depth backlog.** Incomplete paths, copied from the validator's coverage table.
3. **Discovered.** New topics found by research.

### Research briefs (the player's Gemini Gem)

Briefs arrive in Google Drive (`FretworkCoach/Briefs/Inbox`); the format and the merge step are in `content/briefs/SCHEMA.md`. **Gemini's sources are leads, not proof:** the content run verifies every lead it relies on by opening a real page that teaches the thing, cites that page's URL, and marks anything it can't verify `unconfirmed` (listed under "Needs your check"). A `primary` label is the run's own judgement from the page, never the Gem's. Details: `content/briefs/SCHEMA.md`, "Sources are leads".

## What every run does, in order

1. Run `git pull --rebase`, read this file, then sync the player requests from Drive into `content/QUEUE.md`.
2. **Player requests first.** For each new request:
   - **Technique, subject or style:** create its knowledge-base entry with at least the foundations and intermediate stages full, and the rest started.
   - **Guitarist:** add them to `content/ROSTER.md` as high priority and start "Building an artist: technique-first": research the artist, then build their technique paths. Add the artist page only when every one of their techniques has a complete path; until then, record progress on the roster.
   - **Artist rebuild** (a request to build an artist's course on researched paths): build or complete each of the artist's technique paths teaching-method-first, then rewrite the artist file so its units draw from those paths with `PU`. Then check every other artist for the same techniques and switch them to `PU` as well.
3. **Pedagogy audit first.** Until the validator's Pedagogy audit table is empty, audit **at least two paths per run** (or one path and one artist's own unit), in the audit order, before any other depth work. A run that only adds new topics while audits are waiting is incomplete.
4. **Depth.** Bring paths up to the reference standard. Each run must leave **at least two more paths meeting the standard** (★ in the coverage table) than before. Priority order:
   - paths players requested;
   - paths that artists need (see the validator's **Artist readiness** table): first the paths of the artist being built, then the paths the older artists are missing;
   - fundamentals every guitarist needs: alternate picking, legato, bending, vibrato, chord changes, barre chords, strumming, palm muting, fretboard knowledge, timing.
5. **Artists, technique-first.** Every other run, work on the next `planned` artist in `content/ROSTER.md` following "Building an artist: technique-first": research the artist, then build or complete their technique paths (as many as the run allows, each one complete). Add the artist file only in the run where the last of their paths is complete. In the runs between, also bring one of the older artists up to the rule when its paths are ready (switch its units to `PU`, add `sources`).
6. **Discovery.** Research 3–5 topics the library doesn't cover yet and add them to the Discovered section of the queue with a one-line reason and a source. Look at:
   - the curricula of reputable teaching programs and methods;
   - what learners commonly ask to learn;
   - techniques that the existing artists or paths assume;
   - styles and subjects as well as techniques (for example sight reading, ear training, jazz comping, bossa nova, slide, chicken picking, flamenco rasgueado).
   Build the most valuable discovered topic when time allows.
7. Run the checks below, update `content/ROSTER.md` and `content/QUEUE.md`, and write a `content/LOG.md` entry (date, what was added and completed, sources, the coverage summary line, validator result).
8. Commit and push (see below). Finish with a short summary.

## Checking your work

Run these from the repo root:

```
node tools/build-index.mjs        # regenerate js/data/index.js after any change in js/data/kb or js/data/artists
node tools/validate-content.mjs   # must end with "All content is valid."
```

The validator checks:
- every generator at both ends of each stage's levels;
- tab ranges, timing, techniques, chord names and voicings;
- stage tiers and levels, and that prerequisites exist;
- each artist builds 8+ lessons and a master class;
- regexes find their own names and don't collide;
- no song carries notes;
- the index is current.

It ends with the coverage table. Fix errors before committing and fix warnings when you can.

## Automatic check

Every push to `main` triggers a GitHub check (`.github/workflows/check.yml`) that runs the validator and the app's test suites (`npm --prefix tests ci && npm --prefix tests test`). A failure puts a red ✗ on the commit and emails the account that pushed it. To run the same suites before pushing, use those two commands; the first installs the test tools once.

## Committing

1. Run `git pull --rebase` before you start and again before pushing.
2. Change only the files listed in "Files you may edit".
3. Run both commands above.
4. Commit with a message like `Content: complete travis + economyPicking paths; add chickenPicking (requested)`, then push to `main`. GitHub Pages deploys in about a minute.
5. If a rebase conflicts with an app file, stop and report it in `content/LOG.md` and the summary. Don't edit app code.
