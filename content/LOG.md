# Content log

One entry per content run, newest first: date, what was added or changed, sources consulted (URLs), validator result.

## 2026-10-08 — technique run (first content run, by hand in the content thread)
- Run type: technique run (the previous entry was an artist build).
- Added 5 TECHNIQUES entries, 10 skills' worth of tabbed, generated lessons (13 generator variants), every one scaling with level:
  - Beginner (levels 2–4): **Travis picking** (thumb alone → thumb + one finger → full pattern with pinches; C–Am–Em–G), **Slides** (legato/shift slides between pentatonic boxes 1 and 2; the pentatonic along one string with slides).
  - Intermediate (4–7): **Hybrid picking** (pick the bass + middle/ring pinches; pick-middle-ring rolls on strings 3-2-1, triplets then 16ths across the beat), **Economy picking** (3nps natural minor with swept string changes; the two-string six-up/six-down cell on every string pair).
  - Advanced (7–9): **Sweeps through chord changes** (3-string triad sweeps and 5-string A-string shapes through i–♭VI–♭VII–V / I–vi–IV–V).
- Each new technique has a `level: [lo, hi]` range for the new Technique Library (the development thread shipped it during this run; the rebase kept its ranges for the existing 12). Travis picking uses C major and hybrid picking G major (`ctx`).
- Improved: David Gilmour's "Pre-bends and releases" lesson now has a generated tab (box 1, three pre-bends + a 1½-step one at level 6+), same id `dg-prebend` so logged tempos carry over.
- Routing notes: "sweep picking" still opens the curated Sweep picking master class (the new technique only answers "sweeps through chord changes"). "Travis picking", "hybrid picking", "chicken picking" (mapped to hybrid until dead notes exist), "economy picking" and "slides" requests now get these technique units instead of the generic course.
- Pitch check: every note of the new generators verified against its scale or bar chord in all 12 keys, major and minor, levels 1–9 (0 out-of-key notes, 0 failed builds).
- Sources: https://guitarlessons.com/guitar-lessons/guitar-lessons-for-beginners/5-essential-steps-to-learn-travis-picking/ · https://acousticguitar.io/travis-picking-for-beginners/ · https://www.fundamental-changes.com/hybrid-picking-part-1/ · https://my.artistworks.com/blog/how-practice-hybrid-picking-guitar · https://hubguitar.com/technique/economy-picking-overview · https://guitargearfinder.com/lessons/economy-picking-exercises/ · https://guitarworld.com/features/clean-sweep-mastering-sweep-arpeggios-john-petrucci · https://www.fretjam.com/guitar-arpeggio-technique.html · https://jgmusiclessons.com/how-to-play-slides-on-guitar/ · https://appliedguitartheory.com/lessons/guitar-sliding-exercises-to-level-up-your-technique/
- Validator: All content is valid (6 artists, 17 techniques; 2 warnings: Van Halen harmonics and SRV rakes have no tab, both blocked on app note marks).

## 2026-10-08 — initial Artist Series (built by hand in the development thread)
- Added Eric Johnson, Eddie Van Halen, Paul Gilbert, Stevie Ray Vaughan, Jimi Hendrix, David Gilmour and 12 library techniques.
- Validator: all content valid (3 warnings: lessons without a tab).
