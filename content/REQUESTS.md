# Requests for the app

Things lesson content needs from the app, for the development thread. Add a line with the date and what's needed and why; the development thread marks them done.

- 2026-10-08 — Technique-library lessons (`TECHNIQUES`) are only reachable through requests, master classes and artist pages. They need a place to browse them by level. *(done 2026-10-08: Technique Library at `#/techniques`; give every technique a `level: [lo, hi]` range)*
- 2026-10-08 — Tab note marks for three techniques: a **pre-bend** and a **release** (the Gilmour pre-bend lesson currently shows bend-then-fretted-note; `js/core/variations.js` already writes `x: 'r'`, which the normalizer's TECHS list and the validator don't accept), a **dead/muted note** (`x`, for SRV rakes and chicken picking), and a **natural/artificial harmonic** (for the Van Halen harmonics lesson). Once they exist, the content runs will tab those lessons. *(open)*
