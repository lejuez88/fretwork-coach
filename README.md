# Fretwork Coach — Phase A

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

Open **Settings** in the app and paste an Anthropic API key (create one at console.anthropic.com). The key is stored only in your browser's local storage and is not included in profile exports. Calls go straight from your browser to the Anthropic API and are billed to your account. In Phase A, Claude:

- identifies any guitarist you type in, with their genres, style qualities and signature techniques
- names your courses so each name is unique to its style and difficulty

Without a key, the app still works: built-in guitarists can be picked, and course names are generated locally.

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

## Roadmap

- **Phase B:** course engine with a progress tree per course, daily routines built for the time you have (hours/minutes, an end time, or no limit, editable mid-session), per-exercise countdowns with an on-pace indicator, goal tempos with mastery logging.
- **Phase C:** playing evaluation from the microphone (timing and note accuracy against the tab, measured locally, interpreted by Claude) and video form review (key frames sent to Claude), which add targeted exercises to your routine.
- **Phase D:** song lessons (a one-day plan for a chosen song), practicing tabs you import with section highlighting and "help me with this part", and song recommendations for your style and level.

## Project layout

```
index.html          app shell
css/app.css         theme and components
js/app.js           boot + hash router
js/core/            store (profile schema + stats), Claude client, Wikipedia images, audio engine, courses, album picks
js/data/catalog.js  genres, guitarists, albums
js/assessment/      assessment engine (tests, leveling, profile builder)
js/tools/           pitch detection, tuner, metronome, tab player, exercise library
js/screens/         onboarding, assessment, dashboard, tools, course, profile, settings
sw.js               offline cache
```

No build step: the files are plain ES modules.
