# Research queue

What the content runs build next. See CONTENT.md ("The research queue" and "What every run does"). Keep each line short: what, why, status.

## Player requests

Synced from the player's Google Drive file `Fretwork Coach research requests.json` at the start of every run. Requests come first.

| Requested | Topic | Kind | Status | Built as |
|---|---|---|---|---|
| 2026-10-09 | Rebuild the Paul Gilbert course on researched, concept-first paths (alternatePicking, pgSix, pent6s, stretchPent, skipArps) and switch other artists to PU (via the development thread) | artist rebuild | built 2026-10-09 | `alternatePicking` (new), `pgSix`, `pent6s`, `stretchPent`, `skipArps` (all complete); `paul-gilbert` rewritten with PU |

## Depth backlog

Incomplete paths and paths below the reference standard, from the validator's coverage table (`node tools/validate-content.mjs`). As of 2026-10-09 (fourth run): **9 of 21 paths complete; 7 meet the reference standard (★)**: pentatonic, alternatePicking, pgSix, pent6s, stretchPent, skipArps, bending. **Complete but below the standard**: hybridPicking, economyPicking (Govan). **chromaticPassing** has foundations and intermediate full, advanced started, mastery missing. The other 11 paths have one stage of 1–4 lessons and need rebuilding concept-first.

Priority order:
1. Paths used by artists: hybridPicking, economyPicking, chromaticPassing, slides (Govan); rolling5s, speedPent, spreadTriads, hexatonic (Eric Johnson); tapping, openPulls (Van Halen); sharp9, octaves (Hendrix).
2. Techniques artists name that have no path yet: vibrato (Gilmour, Hendrix, SRV), double-stops, Texas shuffle, raking (SRV), harmonics, palm muting (Van Halen), phrasing and space (Gilmour), chord embellishments (Hendrix), position shifting (Eric Johnson), arpeggio melodies (Govan).
3. Fundamentals: travis, sweepChanges.

## Discovered

New topics to build, with a reason and a source. Seeded with the core curriculum every guitarist needs; runs add 3–5 researched topics each time.

| Topic | Kind | Why | Status |
|---|---|---|---|
| Alternate picking | technique | Foundation of single-note playing; prerequisite for economy, sweep and speed paths | built 2026-10-09 as `alternatePicking` (complete) |
| Legato (hammer-ons and pull-offs) | technique | Prerequisite for tapping, open-string pull-offs and fluid lines | planned |
| String bending | technique | Core expressive technique; blues, rock and country; needed by Gilmour, Hendrix and SRV | built 2026-10-09 as `bending` (complete, ★ reference standard) |
| Vibrato | technique | Core expressive technique; pairs with bending | planned |
| Sweep picking (fundamentals) | technique | The basic motion before sweeps through changes | planned |
| Palm muting | technique | Rock and metal rhythm foundation | planned |
| Chord changes and barre chords | technique | First hurdle for every beginner | planned |
| Strumming and rhythm | technique | Rhythm-guitar foundation | planned |
| Chicken picking | technique | Country lead technique; currently routed to hybrid picking | planned |
| Fretboard knowledge (notes, CAGED) | subject | Prerequisite for improvising anywhere on the neck | planned |
| Modes | subject | Common request; links theory to soloing | planned |
| Ear training | subject | Playing by ear and transcribing | planned |
| Sight reading | subject | Reading standard notation | planned |
| Blues | style | Shuffle, 12-bar form, phrasing | planned |
| Funk rhythm | style | 16th-note scratch rhythm and 9th chords | planned |
| Jazz comping | style | Shells, drop-2 and ii–V–I | planned |
| Bossa nova | style | Fingerstyle comping and syncopation | planned |
| Slide guitar | technique | Bottleneck intonation and muting | planned |
| Chromatic passing tones | subject | Govan's and Greg Howe's outside/bebop vocabulary; needed by the Govan page. Source: https://www.fundamental-changes.com/chromatic-approach-notes/ | built 2026-10-09 as `chromaticPassing` (foundations + intermediate full, advanced started) |
| String muting (fretting- and picking-hand damping) | technique | Assumed by every string-skipping, hybrid and high-gain lesson (Govan's arpeggio melodies, skipArps, hybrid octaves); no path teaches it. Source: https://www.guitarworld.com/lessons/5-guthrie-govan-guitar-licks | planned |
| Odd time signatures (5/4, 7/8, 7/4) | subject | Counting and grouping odd meters (2+3, 2+2+3); Govan's "Fives"/"Sevens", prog and fusion. Source: https://www.fundamental-changes.com/odd-time-signatures-on-guitar/ | planned |
| Seventh-chord arpeggios across the neck | subject | maj7, m7, 7, m7♭5 arpeggios in CAGED shapes: prerequisite for sweepChanges, skipArps, jazz comping and Govan-style arpeggio melodies. Source: https://www.musiclessons.com/pubs/lesson/index.cfm?pub=254 | planned |
| Odd note groupings against the beat (5s, 7s over 16ths) | subject | Considered for the Gilbert rebuild; the sources didn't single it out as his, and fives against 16ths are now in pent6s and alternatePicking. A general rhythm path (grouping 3, 5, 7 over any pulse) would still help fusion and prog players. Source: https://www.premierguitar.com/articles/23477-cram-session-alternate-picking | planned |
| Whammy bar technique | technique | Dips, scoops, bar vibrato and flutter (Govan, Vai, Beck, EVH); needs a whammy tab mark (see REQUESTS). Source: https://guitarworld.com/lessons/using-your-vibrato-bar-creatively-and-tastefully | planned |
| Double-stops (3rds, 4ths, 6ths; Chuck Berry, SRV and Hendrix fills) | technique | SRV's and Hendrix's signature; a technique chip on two artist pages with no path. Source: https://guitarworld.com/lessons/improve-your-double-stops | planned |
| Harmonics (natural, artificial/tapped, pinch) | technique | Van Halen's signature with no path; the app now has `nh`/`ah` marks. Source: https://www.musictheoryforguitar.com/naturalandartificialguitarharmonics.html | planned |
| Texas shuffle rhythm | style | SRV's signature rhythm (shuffle feel, boogie patterns, muted strums); no path yet. Source: https://www.premierguitar.com/articles/23142-beyond-blues-texas-rhythm-101 | planned |
| Phrasing and space (motifs, call and response, rests, note choice) | subject | Gilmour's "Space"; every improvisation lesson assumes it. Source: https://www.premierguitar.com/articles/29793-how-to-craft-more-melodic-solos | planned |
