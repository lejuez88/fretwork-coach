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

## Latest: guided lessons (the app picks, you can still choose)

| Area | Included |
|---|---|
| The coach (`js/core/coach.js`) | Decides the lesson that will help most and says why, from: stalled exercises (a targeted, simpler version first), spaced reviews that are due or overdue, your weakest skill areas and the struggles and goals you named, how long since you last worked on something, and unmastered work at your edge. |
| Today's lesson (dashboard) | Guided by default: the app picks the course and the skill to focus on, lists the reasons, and has the plan ready to start; only the length is a quick choice (your usual practice time is preselected). If your biggest need isn't in any of your courses, it says so and offers the master class for it. **Customize** opens the old choices (course, focus skill, exact time) and "Let the app choose" goes back. The coach's briefing (with Claude) is fetched after the lesson starts, so starting is instant. |
| Courses | A "Your next lesson" card with the reason and one button; the full plan stays below to browse, and any skill can be practiced instead. |
| Learning paths and artists | A "Your next lesson" card: the right stage (the one you're partway through, else the first unfinished stage at your level), then the right lesson (stalled first, then the one you're on, then the next new one). Choosing another stage offers the way back; building lessons at another level is under Customize. |
| Exercise library | Opens on the variation recommended for you, with the reason; the variations and the key, strings and chords controls are under Customize, and picking something else shows "Your choice" with a way back. |

## Earlier: learning paths from scratch to mastery, a research queue, and a self-growing library

| Area | Included |
|---|---|
| Learning paths | Every technique, subject and style in the knowledge base is a path in four stages: **Foundations** (levels 1–3, from scratch), **Intermediate** (4–6), **Advanced** (7–8) and **Mastery** (9–10). Each technique page shows the four stages with your progress (lessons practiced and mastered), marks where to start from your level, rebuilds a stage's lessons at any level inside it, and builds the whole path as a master class with no API cost. Stages still being researched are marked "Coming". Lesson cards show your best tempo or "Mastered", and practicing a lesson keeps its progress. |
| Knowledge base | Lessons now live one file per topic (`js/data/kb/<id>.js`) and per artist (`js/data/artists/<id>.js`), loaded only when shown, with a small generated catalog (`js/data/index.js`, built by `node tools/build-index.mjs`) loaded at startup. The library can grow to hundreds of topics without slowing the app. Kinds: technique, subject, style. |
| Add it to the knowledge base | When you ask for a technique, subject, style or guitarist the app doesn't know (in Practice → "What do you want to work on?", a master class, or the Artist series), it asks whether to add it to the research queue. The Technique Library page also has a request box and your queue with status ("In the research queue", then "Added to the app" automatically when it ships). Requests are saved in your profile and to Google Drive as `Fretwork Coach research requests.json`, which the scheduled content runs read. |
| Content runs | CONTENT.md now sets a depth standard (each stage needs 3+ skills and 6+ lessons; a path is complete when all four stages are full) and a run plan: player requests first, then completing paths (two more per run), a new artist every other run, and researching 3–5 new topics for the queue (`content/QUEUE.md`). The validator checks the new structure and prints a coverage table of every path. |
| Automatic check | Every push to main runs `.github/workflows/check.yml` on GitHub: the content validator and the four test suites (`tests/`, run with `npm --prefix tests ci && npm --prefix tests test`) against a scrubbed test profile (`tests/fixtures/profile.json`). A failure marks the commit with a red ✗ and GitHub emails the account that pushed it. |
| Tab marks | Pre-bend (`pb`) and release (`r`), dead notes (`mute`, shown as x), ghost notes, and natural (`<12>`) and artificial harmonics, drawn in the tab and played at the right pitch. |

## Earlier: Artist Series, master classes that follow your request, saved lessons

| Area | Included |
|---|---|
| Artist Series | A dashboard card and an **Artist series** page (`#/artist`) with Eric Johnson, Eddie Van Halen, Paul Gilbert, Stevie Ray Vaughan, Jimi Hendrix and David Gilmour. Each artist page has lessons on that player's signature techniques at your level (original exercises in their style that play in the tab player, with fretboard and chord boxes): Eric Johnson's pentatonic sixes, speed pentatonics across all five boxes, rolling 5s (in the box and along the neck), the added 9th and spread triads (shapes, the chords of a key, progressions); Van Halen's tapped triplet and 16th arpeggios, tapped pentatonic octaves, open-string pull-offs, riffs and harmonics; Paul Gilbert's six-note picking lick (on string pairs and through the boxes), string-skipped arpeggios, pentatonic in sixes and stretched pentatonic; Hendrix's 7♯9 groove, octaves and chord embellishments; SRV's shuffle, rakes and double-stops; Gilmour's pre-bends and phrasing. Try, practice, save or add any lesson to your routines. **Famous songs** are linked to Songsterr and can be added to My songs (not transcribed). **Start the master class** builds a course from the lessons with no API cost. Favorite players who aren't in the series appear as tiles that Claude builds. |
| Master classes follow the request | A request that names techniques gets one skill per technique. With Claude, the course is built in two steps: an outline that lists every technique you named (each gets its own skill), then the exercises unit by unit, a few at a time, so a long course is never cut off (the earlier one-shot request could run out of room, which is why the Eric Johnson class failed and fell back to generic pentatonic lessons). A unit Claude can't write is filled from the built-in lessons for its skills. Without Claude, named techniques (rolling 5s, spread triads, tapping, the six-note lick, string skipping, octaves, 7♯9…) still get their own units instead of a generic course; artists always use the Artist Series lessons. The build button shows progress (outline, then units done). |
| Technique Library | Practice → **Technique library** (`#/techniques`) lists every technique in the lesson library with its level range, your level in that skill area and the players who use it. Filter by For you, Beginner (1–3), Intermediate (4–6), Advanced (7–10) and skill area. Each technique page rebuilds its lessons at any level in its range (tempo goals, length and subdivisions change), with Try, Practice, Add to routines and Save, a master class button, and links to the artists. Techniques that the content runs add appear here automatically. |
| Saved lessons | Master-class plans and "What do you want to work on?" answers that Claude designs are saved in your profile and reused when you ask for the same thing again, even in other words (no API cost). They travel with Export and Google Drive. Rebuilding a course always asks for a new plan. Settings → Claude API spend shows what's saved and can clear it. |

## Earlier: tab player controls, live fretboard, chord highlights, roomier layout

| Area | Included |
|---|---|
| Tab player | **Play / Pause** keeps your place (Resume picks up from there, with the count-in if it is on) and **⏮** goes back to the start. Scroll through the tab (drag, swipe, or a mouse wheel over the long tab) and click or tap any note to move the playhead there. Click and drag across notes (or drag along the bar strip under the tab, which also works on phones) to select them: the selection lights up in the tab, on the bar strip and on the fretboard, and loops when you play. **✕ Clear loop** goes back to the whole exercise. Bar numbers are shown on the tab and the strip, and the meter says where you are (bar, beat, loop). |
| Fretboard under every tab | Every lesson with a tab shows the neck under it: each note of the exercise is marked, and the notes light up as they sound (or, when paused, the notes at the playhead). It scrolls along with the music on narrow screens, follows alternate tunings, and fades the positions outside a looped selection. Tap any fret to hear it. Turn it off with the **Fretboard** toggle. |
| Chord boxes light up | In lessons with chords or backing chords, the chord box of the chord that is sounding is highlighted: from the tab (strums, arpeggios, Travis patterns, triads, single-note lines over the changes) and from the metronome's backing track. Exercises with only a backing track show those chords as "Backing chords" (not for ear training, where that would give the answer away). |
| Beat type with every tempo | Tempos now say what you play against the click: "Target 8th notes at 60 BPM → goal 113", "16th notes", "8th-note triplets", "swung 8th notes", "quarter-note click" for soloing, and so on, on exercise pages, the routine runner, the routine preview, the course page, song lessons, request results and in the player's BPM display. The BPM is always the metronome click (one per quarter note; odd-meter riffs say when the click is on 8ths). |
| Fuller exercises | The chromatic spider now moves along the neck as well as across the strings: up the strings at frets 1–4, shift up a fret and back down, climbing to frets 5–8 and back so the loop joins up. Every finger order, string skipping, the wide stretch, 16ths and triplets climb too; new variations are **One position** (the old version), **Climb from fret 5** and **Along each string** (frets 1–4, 5–8, 9–12 on one string and back). Other short drills became four-bar exercises that travel: bends in two positions across three strings, vibrato up the neck, a moving gallop riff, power-chord shifts along the neck and across strings, Travis picking over C–Am–Fmaj7–G, hybrid-picked sixths up and down the neck, tapped Am–F–C–G arpeggios, picking bursts that change string and position, slides to the 17th fret, double-stop 3rds up the neck, more Drop D moves, finger-pair trills through every pair on two strings, and string crossing through Am–F–C–G. Key changes still work on the wider drills. |
| API keys on phones | Keys pasted on a phone often bring extras along (a line break from a wrapped note, a space, hidden characters, curly quotes, a dash turned into “–”, a capital first letter). The app now strips these when saving and when reading a saved key, checks that the browser really kept it (private browsing or blocked website data are explained), and shows what is saved as `sk-ant-api03…Wx9Q (108 characters)` so you can compare devices. Test buttons say exactly why a key fails: rejected key, website restriction, quota, API not enabled, or a network or content blocker. On iPhone, the Settings page notes that the Home Screen app and Safari keep separate data. |
| Google Drive | Settings → Your data → **Save to Google Drive** puts the profile straight into the signed-in person's own Drive (one file, “Fretwork Coach profile.json”, updated in place on each save; no download). **Load from Google Drive** on another device signs in with the same Google account and loads it. Each Google account has its own profile, and the app asks only for access to the file it creates. API keys are never in the file. Needs a one-time Google OAuth client ID (Settings → Google sign-in setup). |
| Keys to your phone by QR code | Settings → **Use your keys on another device** shows a QR code (or copies a link) holding your saved keys. Scan it with the phone’s camera: the app opens and shows which keys it received (start, end and length only) with **Save on this device**. The keys ride in the link’s # part, which never reaches a server; the app removes them from the address bar right away and the code hides itself after two minutes. A link can also be pasted into Settings (for an iPhone Home Screen app). Settings → About shows the build, so you can tell whether a device has the latest version, and app files are now re-checked on every load so a new release shows up right away. |
| Layout | On wide windows the app uses the space: a wider page, more padding, a two-column dashboard (routine, practice and courses on one side; track, master classes and calendar on the other), library topics side by side, exercise pages with variations next to the instructions and the player full width, a two-column routine runner, settings and profile in two columns, and the songs page with "Add a song" beside "My songs". Phones keep the single column. |

## Earlier: Songsterr tabs, YouTube embed player

| Area | Included |
|---|---|
| Songsterr | Songs use Songsterr's public search API (no key). As you type a song in **Add a song**, matching Songsterr tabs appear with the parts each has (guitars, bass, drums, chords); tap one to add the song already linked. A song page finds its Songsterr tab by itself and lists every part with its tuning and difficulty; each opens in Songsterr's interactive player (real rhythm, speed control, looping). **Change** picks another version. Linking fills in the song's tuning when it has none. Track of the Day has a 🎸 Tab link. The tabs themselves stay on Songsterr: the app keeps only which song it is and the part list. Searches are cached for a day. If a browser won't let the app call Songsterr, the app shows links to Songsterr's own search and best match instead. |
| Track of the Day player | The track plays in YouTube's standard embed player (the same iframe as YouTube's Share → Embed), shown right away with YouTube's own controls, fullscreen and picture-in-picture. The Play button and the player stay in sync, and a copy that can't play outside YouTube is still skipped automatically. “Open” links go to YouTube and to the same video in YouTube Music. |

## Earlier: master classes, pop-up tuner

| Area | Included |
|---|---|
| Master classes | Turn any topic into a whole course built around it: the modes, playing over chord changes, sight reading, bends, sweep picking, or anything you type. With Claude connected, Claude designs it from the topic, anything specific you add, your levels and your genres. Unit 1 is always where to start, and the course climbs about three levels from there. Without Claude, 24 common topics have built-in curricula, and other topics the app understands get a five-step plan. Start one from the dashboard, from any library exercise (“Master class: …”), from the interval trainer, from the routine runner, or from the “What do you want to work on?” box. Master class routines keep every block on the topic. |
| Dashboard suggestions | The dashboard's Master classes card has a **For you** pick and four suggested topics. For you is based on the skill areas that trail your average, the struggles you named, stalled exercises and your weakest intervals, and it says why it was picked. The suggestions change every time the app opens, lean toward your genres, and skip topics you already have a class for. There's also a box for any topic. |
| Practice page | “What do you want to work on?” starts folded to just its text box; tapping the box opens it with the suggestions (the arrow folds it again). Library topics open one at a time: opening another topic closes the one that was open. The “Pick up where you left off” card is only on the dashboard now. |
| Pop-up tuner | The tuning fork now pops up a small curved meter right above the button and starts listening. Tap the fork again to fold it away and stop the mic. Nothing else on screen is covered or paused. The fork is hidden on the full tuner in Tools. |

## Earlier: any key, string or chords; interval trainer

| Area | Included |
|---|---|
| Any key, string, chords | No exercise is stuck in one key, on one string or on one set of chords. Each library exercise has pickers for what applies: key (or note), start fret for chromatic drills like the spider, which string or strings, string set, chord progression (25 to choose from) and chord type. Generated exercises are rebuilt in the new key; written tabs are transposed or moved to other strings with the same notes; a chosen variation (reversed, half-time, looped and so on) stays applied. Choices are remembered per exercise, and the routine runner has the same pickers under “Variations” / “Key & strings”. Rhythm-only drills have no key, and song sections keep their tab. |
| Interval trainer | New in Practice → Theory on the neck. It shows a key and an interval (♭3, 5, 7…); you play that note (the microphone listens, any octave counts) or tap it on the neck. It starts in one key, measured from the root. Every setting can be changed, and each musical one can be randomized: key (any of 12, random each round, random every prompt, cycle of 4ths), scale (14 plus chromatic), intervals (the scale’s degrees, your own pick, or a random 3–4), 9ths/11ths/13ths, root included, measure from the root or the last note, order, label style (♭3 / m3 / minor 3rd), string, neck area, roots shown or hidden, prompts per round, time limit, and a reference tone. Misses show where the note is plus its shape from the root. Each round scores accuracy, seconds per note and each interval, suggests a harder or easier step, and offers a drill of your weakest intervals. Results count toward Fretboard and Theory. |

## Earlier: exercise library, variations everywhere, quick tuner

| Area | Included |
|---|---|
| Practice = exercise library | The Practice tab is now the “What do you want to work on?” box plus a library of 54 exercises in 8 areas (warm-ups, picking, fretting technique, chords, rhythm, scales and fretboard, theory, ear and improvisation), built for your level in each area. Search or filter, open any exercise, play it with the tab player or metronome, log a tempo, or queue several and run them as a timed session. |
| Variations on every exercise | Every exercise and lesson comes in 7–16 versions from easier to harder. The spider has 15: finger orders (4-3-2-1, 1-3-2-4, 1-2-4-3, 2-1-4-3, 1-4-2-3, 1-3-4-2, 2-4-1-3), position 5, diagonal, string skipping, wide stretch, 16ths, triplets and the spider walk. Scales get patterns (3s, 4s, 3rds), rhythms and positions; chord work gets chord sets, beats per chord, keys and progressions; bends get half, whole and 1½-step, pre-bends and unison bends; plus general versions for anything (half-time, looped first half, reversed, new position, start on the “&”, gap click, simplified, pushed tempo). Each variation has its own level, target tempo and progress, and harder variations count more toward your skill levels. |
| Variations in routines | Pick any variation from the routine runner. Routines use them automatically: warm-ups rotate through technique variations day to day, reviews of mastered skills come back as a harder variation, and a stalled exercise starts from an easier one. The course page lists every exercise’s variations. |
| Routines on the dashboard | Course selection and the time budget moved to the dashboard’s Today’s routine card (build, preview, start). Links from the course page open it with the course and skill preselected. |
| Quick tuner | A tuning-fork button on every screen opens a compact tuner that starts listening right away and stops the mic when closed. |
| Library topics | The library opens as 8 topic buttons, each with its own picture (a spider fingering, a pick with stroke marks, a bend arrow, a chord box, a metronome, a pentatonic box, a triad on the note circle, call and response). Tap a topic to show its exercises below it; tap again to close. Search opens every topic with a match. |
| Claude API spend | Settings shows what Claude has cost this billing period, by feature and by model, plus last period. It adds up the exact token usage Anthropic returns with every reply, priced at Anthropic’s published rates. Pick the day your billing period starts. Anthropic’s own cost report can’t be read from a browser, so this counts Fretwork Coach’s requests in this browser; the Claude Console has the official total. |

## Earlier: Track of the Day

| Area | Included |
|---|---|
| Track of the Day | Replaces Album of the Day on the dashboard. One track a day from 160 guitar-focused recordings across all 16 genres (plus songs on your own learning and want lists), chosen for what you're practicing: your last session's course and style, the players you follow, and your genres. Each one says what to **listen for** and gives an **ear challenge** matched to your ear-training level. *Another track* picks a different one. *+ My songs* adds it to your songs. |
| Embedded YouTube player | Tap ▶ and the track plays right on the dashboard (privacy-enhanced youtube-nocookie player). It keeps playing when you start the practice timer or flip the calendar, and stops when you leave the page. If a video is blocked from embedding, the player moves to another copy or tells you why. |
| Profile import fix | Import accepts the exported file on any device (phones often mislabel .json files, and the old file-type filter greyed them out), works when you pick the same file twice, asks before replacing an existing profile, upgrades older exports right away without a reload, and explains what went wrong when it can't import. If the file picker won't cooperate, paste the profile text instead (welcome screen or Settings → Your data). |
| Finding the video | **No key needed:** the app looks the song up on Wikidata, which lists official YouTube videos for many well-known songs. It checks that the Wikidata entry is the right song by the right artist, and moves to one of the day's backup picks when it can't find a video. **Optional YouTube key** (Settings → YouTube): the app searches YouTube for any track, ranks the artist's own channel, official uploads and “Topic” audio first, and drops covers, lessons and reactions. **Wrong video?** Paste any YouTube link and the app remembers it for that track. The key is stored only in your browser and never in profile exports. |

## Earlier: chord glossary, style-specific plans, smarter requests

| Area | Included |
|---|---|
| Chord glossary | Tools → Chords. Pick a root and any of 29 chord types (triads, 6ths, 7ths, added tones, 9/11/13). See the notes and formula, every playable shape up the neck, inversions on each string set (triads, drop 2, drop 3, shells), or every chord tone on the whole neck. The fretboard lights up the frets with the root and intervals (or note names, or fingers). **Build a chord:** tap frets on the fretboard and the chord is named, with its inversion and alternative names. Tap to hear any voicing. |
| Style-specific plans | Every course plan is built for its style: its key, progressions, rhythms and signature techniques (a Texas shuffle course is shuffles, bends and double-stops in E; Jazz Comping is shells and drop-2s over ii–V–I; Thrash Precision is gallops and Phrygian riffs). 48 styles across 16 genres, scaled to your level. Older plans that were the same for every style are upgraded automatically if unpracticed, or offered as a rebuild. |
| Varied routines | Warm-ups, review, theory and musical-application items come from the course's own style pool and rotate day to day. |
| Smarter requests | “What do you want to work on?” reads chord types, voicing words (inversions, drop 2, shells, triads, CAGED), scales and modes, keys (“in G”, “A minor”), progressions (ii–V–I, 12-bar), named chords and techniques, says how it read your request, and builds a focused drill → main → apply set. “7th chords and inversions” gives the four 7th qualities on one root, 7th-chord inversions on two string sets, and a voice-led ii–V–I. Claude gets the same reading as a guide and can use any chord voicing. |
| Chord diagrams everywhere | Exercises can show any voicing (not just open chords), with intervals on the dots. Backing loops play any chord symbol. |

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
| Pick direction | Every interactive tab can show the picking hand: ⊓ downstroke / V upstroke above each note, or p i m a for fingers. Choose alternate (in time), strict alternate, economy, all downstrokes, fingers or hybrid; each exercise and song remembers its choice. Toggle **Pick direction** under the tab player. |

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
| Dashboard | Practice session timer, open courses with %, total / this week / daily average / today, monthly calendar marking 15+ minute days, current and best streak, Track of the Day with an embedded YouTube player, chosen from what you're practicing |
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
js/core/            store (profile schema + stats), Claude client, Wikipedia images, audio engine, courses, Track of the Day + YouTube lookup,
                    course/routine engines, tab parser, songs, drills, custom exercises,
                    theory engine (chords, voicings, scales), exercise generators, style library, request parser
js/data/            genres, guitarists, albums (catalog.js), song list (songs.js), Track of the Day list (tracks.js)
js/assessment/      assessment engine (tests, leveling, profile builder)
js/tools/           pitch detection, tuner, metronome, tab player, exercise library
js/screens/         onboarding, assessment, dashboard, tools, course, routine, songs, evaluate, reassess, profile, settings
js/eval/            recorder, onset/pitch analysis, latency calibration, coaching
js/ui/              shell, audio setup, ask box, fretboard and chord diagrams
sw.js               offline cache
```

No build step: the files are plain ES modules.
