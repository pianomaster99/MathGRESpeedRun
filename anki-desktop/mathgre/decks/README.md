# GRE Math sample deck

`mathgre_sample.tsv` — **156** sample flashcards for the GRE Mathematics Subject
Test, tagged by topic (`topic::calculus`, `topic::linear-algebra`, …) so they
feed the `TopicMastery` RPC and the readiness dashboard.

Coverage (matches the ETS outline weighting — Calculus is the largest):

| Topic | Cards |
|-------|------:|
| calculus | 40 |
| abstract-algebra | 18 |
| linear-algebra | 16 |
| real-analysis | 15 |
| probability-statistics | 14 |
| topology | 12 |
| complex-analysis | 11 |
| number-theory | 11 |
| discrete-combinatorics | 10 |
| numerical-analysis | 9 |

## Bundled in the app (auto-imported)

This deck ships **inside the app**: the same content is embedded in
`qt/aqt/mathgre_deck.py` and imported automatically the first time each profile's
collection is opened (see `MainWindow.loadCollection` → `ensure_gre_math_deck`).
So every user starts with the **GRE Math** deck already loaded and topic-tagged —
**Tools → Topic Mastery** / **GRE Math Readiness** populate immediately.

Seeding runs once per collection (guarded by the `mathgreDeckSeeded` config flag)
and is not re-added if the user later deletes the deck. If you regenerate this
TSV, refresh the embedded copy with:

```bash
python - <<'PY'
import json
tsv = open("mathgre/decks/mathgre_sample.tsv", encoding="utf-8").read()
# ...re-emit qt/aqt/mathgre_deck.py's GRE_MATH_DECK_TSV constant from `tsv`...
PY
```

### Manual import (optional)

You can still import it by hand: File → Import → `mathgre_sample.tsv`. The header
directives (`#separator:tab`, `#notetype:Basic`, `#deck:GRE Math`,
`#tags column:3`) auto-configure the import.

## Provenance & caveat

These were generated (Friday, AI allowed) by parallel subagents from the ETS
content outline and spot-checked for correctness. They are **sample** cards: per
the assignment's AI-card-check requirement, run them through a gold-set checker
(and block wrong/low-quality cards) before treating them as trusted study
material. A wrong fact is worse than no card.
