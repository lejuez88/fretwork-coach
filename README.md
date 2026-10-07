# Fretwork Coach

An adaptive guitar coach that runs in the browser: onboarding with genre and guitarist pickers, a skill assessment, auto-named courses, a practice dashboard, an accurate tuner, a metronome and a scrolling tab player.

## Put it online (GitHub Pages, free, about 5 minutes)

The tuner and (in Phase C) audio/video evaluation need microphone and camera access, which browsers only allow on **https** pages. GitHub Pages gives you https for free and works on your phone.

1. Create a new repository on github.com (for example `fretwork-coach`). It can be private if you have GitHub Pro; otherwise make it public. Your profile data is never in the repo; it stays in your browser.
2. Upload the contents of this folder (`index.html`, `css/`, `js/`, `manifest.json`, `sw.js`, `icon.svg`) to the repository root. Drag-and-drop on the "Add file → Upload files" page works.
3. Go to **Settings → Pages**, set **Source** to "Deploy from a branch", choose `main` and `/ (root)`, and save.
4. After a minute your app is at `https://<your-username>.github.io/fretwork-coach/`.
5. On your phone, open that link and use **Add to Home Screen** to install it like an app.

To try it on your computer without hosting: run `python3 -m http.server 8000` in this folder and open `http://localhost:8000`. Browsers treat localhost as secure, so the microphone works there too.

## Connect Claude

Open **Settings** (the ⚙ at the top) and paste an Anthropic API key (create one at console.anthropic.com). The key is stored only in your browser's local storage and is not included in profile exports. Calls go straight from your browser to the Anthropic API and are billed to your account. Claude:

- identifies any guitarist you type in and names your courses
- writes course plans, song lessons and exercises from your requests
- looks up and recommends songs, and helps with hard parts of a tab
- reviews your recorded playing (audio measurements and video frames)

Without a key, everything still works with built-in data: catalog guitarists and songs, standard course plans and lessons, and a library of original drills.

## What's in Phase D

| Area | Included |
|---|---|
| Ask for an exercise | Practice tab → “What do you want to work on?”: type a request in your own words (“my bends sound out of tune”, “switching between F and C at 90 BPM”). Claude writes 1–3 exercises for it (drill → main → apply) with tab, a start tempo you can play cleanly and a goal tempo. Try each inline, practice them as a session, save them to “Your exercises”, or add them to your daily routines. Without a key, a built-in library of original drills is matched to your words. |
| Songs | New Songs tab. Add any song; Claude looks up its key, tuning, tempo, sections and the techniques it needs (built-in data for 100+ well-known songs without a key). Status (want / learning / solid / mastered) feeds your repertoire level. |
| Recommendations | Real songs matched to your song level and genres: one comfortable pick, mostly stretch songs, one reach. Filter by genre; Claude picks with a key, the built-in list without. |
| Song lessons | A one-day plan for the time you have: warm-up for the song’s main technique, the next part of the song at a tempo you can play cleanly with a tempo ladder, theory in context, then linking the parts or playing along. Runs in the routine runner and tracks progress per part. |
| Tab import | Paste or open a text tab (find one with the Songsterr / Ultimate Guitar search links). Bars, rhythm (read from spacing, or pick 8ths/16ths/triplets), techniques and alternate tunings (Drop D etc.) are read. Tap bars to select a part, loop it in the tab player with a tempo ladder, save named parts. |
| Help with a part | “Help me with this part” on any selected bars: Claude explains what makes it hard, fingering and picking, answers your question and writes drills; offline, the app finds the hardest beat and builds a micro-loop from it. |
| Check a part | The audio/video evaluator works on any selected bars, in any tuning. |

Claude never writes out a song’s notes or lyrics: it describes the song and writes original drills. The notes you practice come only from the tab you import, which stays in your browser.

## What's in Phase C

| Area | Included |
|---|---|
| Audio check | Records you playing an exercise along with the click (AudioWorklet, sample-accurate). Detects every note onset (to about 1 ms), aligns it to the tab, and measures: notes played, wrong notes (judged from the new energy at each onset, so ringing strings don't confuse it), timing spread, rushing/dragging, drift, volume evenness, weak hammer-ons/pull-offs, tuning, and the exact trouble spots (string changes, position shifts). Exercises without tab get a rhythm-only check against the click grid. |
| Video form check | Films you (front or back camera, framing guide for full view / fretting hand / picking hand), sends 10 key frames plus the audio measurements to Claude, which reviews posture and both hands frame by frame. You can watch and save the take. |
| Coaching | Claude turns the numbers (and frames) into strengths, issues with evidence, and up to 3 prescribed exercises. Rule-based feedback works without a key. |
| Prescriptions | Accepted prescriptions are added to your routines (first in the stretch block) and progress with the same tempo rules. |
| Audio input | Settings → Audio input & output: pick any input device (built-in mic, audio interface such as a Focusrite Scarlett, amp/pedal USB), choose which input the guitar is on (Input 1 / Input 2 / mix) with a live two-channel meter that detects it for you, and route the click to your interface's outputs. Quiet direct-input signals are normalized before analysis. |
| Timing calibration | Speaker loopback test (microphone) or tap-along test (headphones or direct input) measures latency per input device, so early/late can be judged exactly. |
| Routine integration | “Evaluate this take” on any exercise records it and fills in the tempo and clean/not-clean result from the measurement. |

### Also new
- **Continue assessment:** test only the skill areas you skipped or stopped early on; harder tests on demand; levels update without touching courses.
- **Level-matched starting tempos:** every exercise starts at a tempo your current level suggests you can play cleanly; the first two sessions calibrate it.
- **Tempo ladders:** exercises step up automatically (+3–5 BPM every 2 loops or 4 bars) toward the goal; log the highest clean tempo you reached.
- **Levels that learn:** clean results in routines, tools and evaluations feed your skill levels; courses suggest a rebuild when you outgrow them.

## What's in Phase B

| Area | Included |
|---|---|
| Course plans | Claude designs each course as a skill tree (units → skills → exercises) around your levels, goals and favorite players; a standard plan is used without an API key |
| Progress tree | Locked / ready / in progress / mastered skills, review-due badges, per-exercise target, goal, best tempo and history |
| Routines | Pick a course and your time (hours/minutes, an end time, or no limit), get a warm-up → review → stretch → theory → music plan; change the time mid-session and the rest re-fits |
| Runner | Per-exercise countdown with a time-up alert, on-pace indicator, tab player or metronome/backing loop per exercise, tempo logged at the end of each exercise |
| Progression | +3–5 BPM after two clean passes on separate days, mastery at the goal tempo, 3 sessions without a pass eases the target and suggests a prerequisite drill, mastered skills return on a 2/4/8/16/30-day review schedule |

## What's in Phase A

| Area | Included |
|---|---|
| Onboarding | Name, experience, image grid of 16 genres, guitarists filtered by your genres (photos from Wikipedia), type-in players identified by Claude, chords, techniques, theory, struggles, goals, practice time, equipment |
| Assessment | 8 domains, adaptive test ladders, metronome + timer for playing tests, auto-scored theory and ear tests |
| Dashboard | Practice session timer, open courses with %, total / this week / daily average / today, monthly calendar marking 15+ minute days, current and best streak, album of the day chosen from your last session |
| Courses | Auto-named on creation (starter courses come from your top genres), per-course page with practice history |
| Tuner | YIN pitch detection with sub-cent interpolation, needle + strobe, 9 tunings, adjustable A4, reference tones |
| Metronome | Tap tempo, 2–7 beats, subdivision clicks, 2&4 mode, gap mode |
| Tab player | 8 starter exercises, scrolling or stationary tab, guitar tone (on/off), click, loop, count-in, tempo log toward a goal BPM |
| Data | Saved in the browser, JSON export/import, v1 profiles migrate automatically |

## Project layout

```
index.html          app shell
css/app.css         theme and components
js/app.js           boot + hash router
js/core/            store (profile schema + stats), Claude client, Wikipedia images, audio engine, courses, album picks,
                    course/routine engines, tab parser, songs, drills, custom exercises
js/data/            genres, guitarists, albums (catalog.js), song list (songs.js)
js/assessment/      assessment engine (tests, leveling, profile builder)
js/tools/           pitch detection, tuner, metronome, tab player, exercise library
js/screens/         onboarding, assessment, dashboard, tools, course, routine, songs, evaluate, reassess, profile, settings
js/eval/            recorder, onset/pitch analysis, latency calibration, coaching
js/ui/              shell, audio setup, ask box
sw.js               offline cache
```

No build step: the files are plain ES modules.
