# MathGRE Speedrun — an Anki fork for the GRE Mathematics Subject Test

**Exam: GRE Mathematics Subject Test** (scaled score **200–990**, 10-point steps).

This is a fork of [Anki](https://github.com/ankitects/anki) (desktop, in
`anki-desktop/`) and [AnkiDroid](https://github.com/ankidroid/Anki-Android)
(phone, in `AnkiDroid/`). It is licensed **AGPL-3.0-or-later**, with credit to
Anki and AnkiDroid; some Anki components are BSD-3-Clause.

> Honesty first: this app measures **memory** on real FSRS data and reports it
> with an explicit range and a give-up rule. It does **not** emit a fabricated
> 200–990 "readiness" score — score mapping is a later deliverable and is not
> faked here.

---

## Repository layout

```
anki-desktop/     Anki fork (Rust engine in rslib/, Python in pylib/, Qt in qt/, web in ts/)
AnkiDroid/        AnkiDroid fork (shares Anki's Rust engine on device)
prd.md            product notes
```

---

## Wednesday deliverable — status (no AI)

| Item | Status |
|------|--------|
| Anki forked & building from source | ✅ (`cd anki-desktop && just run`) |
| **Real Rust engine change** (+3 Rust unit tests, +1 Python test) | ✅ code written & type-checks; see below |
| Memory model with an **honest score + range + give-up rule** | ✅ `anki-desktop/mathgre/readiness.py` |
| Topic **coverage map** | ✅ (GRE Math outline in `readiness.py`) |
| Review loop on the exam deck | ✅ Anki's review loop; tag cards `topic::<name>` |
| Desktop installer on a clean machine | ⏳ you run `just` packaging on your machine |
| Mobile: builds + runs a review session on the shared engine | ⏳ AnkiDroid build on your device/emulator |
| Proof recordings (clean build / install / phone review) | ⏳ you capture these locally |

The ⏳ items require a GUI/emulator/screen-capture and can only be produced on
your machine; steps are below.

---

## The Rust engine change: per-topic Mastery query

A new backend RPC computes, per topic (note tag), how many cards are **mastered**
and the **average predicted recall**, in two bulk queries so it stays fast on
50k cards. It powers the readiness dashboard.

**Why Rust (not Python):** it reads every card's FSRS memory state and computes
retrievability with the same `fsrs` crate the scheduler uses, over the whole
collection, behind one protobuf call. Doing it in Python would mean shipping
tens of thousands of cards across the FFI boundary per refresh. Because the
engine is shared, this RPC is available to **both** the desktop and the phone
build.

**Definition:** a card is *mastered* when its predicted FSRS recall
(`current_retrievability_seconds`) is ≥ a threshold (default 0.9). Cards with no
memory state (unstudied) count as recall 0. Topics come from tags matching a
prefix (default `topic::`), stripped to the bare name; untagged cards group under
`(untagged)`.

**API:** `StatsService.TopicMastery(TopicMasteryRequest) → TopicMasteryResponse`
→ Python `collection.topic_mastery(mastery_threshold=0.9, topic_prefix="topic::")`.

### Files touched (upstream) & merge difficulty

| File | Change | Merge risk |
|------|--------|-----------|
| `proto/anki/stats.proto` | +1 rpc, +2 messages in `StatsService` | low (additive) |
| `rslib/src/stats/mastery.rs` | **new** module: impl + 3 unit tests | none (new file) |
| `rslib/src/stats/mod.rs` | `mod mastery;` | trivial |
| `rslib/src/stats/service.rs` | +1 trait method delegating to the impl | low |
| `pylib/anki/collection.py` | +`topic_mastery()` wrapper | low |
| `pylib/tests/test_stats.py` | +`test_topic_mastery` | none |
| `pylib/anki/gre_readiness.py` | **new** honest memory-readiness module | none |
| `pylib/tests/test_gre_readiness.py` | **new** readiness/give-up-rule tests | none |
| `qt/aqt/gre_readiness.py` | **new** GRE Math Readiness dashboard | none |
| `qt/aqt/teachback.py` | **new** Teach-Back launcher window | none |
| `qt/aqt/main.py` | +2 Tools-menu actions | low |
| `qt/aqt/mediasrv.py` | register the `teach` svelte page | low |

Everything is additive; a future upstream merge is easy. Undo/collection
integrity are unaffected — the RPC is read-only (no writes to the collection).

### Tests

- **3 Rust unit tests** in `rslib/src/stats/mastery.rs`:
  `no_data_returns_empty`, `groups_by_topic_and_counts_mastery`,
  `untagged_grouping_and_default_threshold`.
- **1 Python test** in `pylib/tests/test_stats.py`: `test_topic_mastery`
  (calls the RPC through `collection.topic_mastery`, exercising the full
  proto → Rust → pylib pipeline).

---

## Honest memory readiness (`anki-desktop/pylib/anki/gre_readiness.py`)

Lives in the `anki` package (importable app-wide) and consumes the mastery RPC
to report a **memory** signal only:

- point estimate = exam-weight-weighted mean recall (uncovered high-weight
  sections drag it down — you can't skip Calculus and look "ready"),
- a **likely range** that widens with less data and lower coverage,
- **coverage** vs the GRE Math topic outline,
- a **confidence** label and the single **weakest topic** to study next.

**Give-up rule (explicit):** *no score until ≥ 200 graded reviews AND ≥ 50%
topic coverage.* Below that it abstains and says exactly what's missing.

**See it in the app:** **Tools → "GRE Math Readiness"** opens a dashboard
(`qt/aqt/gre_readiness.py`) showing the score + range, coverage, the give-up
message, and a per-topic table — a thin view over the shared engine.

Test: `pylib/tests/test_gre_readiness.py` (runs in the `just test-py` suite).

---

## AI card verification (`anki-desktop/mathgre/eval/`)

Every AI-touched card is checked before it can enter the deck. The checker is
graded on a held-out set and must beat a simpler method; the scoring path itself
uses no AI.

- **Named sources** — `sources.md`: ETS practice books (GR0568/GR1268/GR1768) +
  open textbooks (OpenStax, Judson, Lebl, Trench, Austin, Rosen). Every AI verdict
  cites a mathematical basis; every gold item cites a source.
- **Gold set** — `gold_set.json`: 50 Q/A with known-correct answers (the key).
- **Held-out labeled set** — `eval_labeled.json`: 30 cards (12 correct, 12
  deliberately wrong, 6 low-quality) with ground-truth labels.
- **Checker** — `card_checker.py`: `gpt-4o-mini` judges each card into
  `wrong` / `low_quality` / `correct_useful`, re-deriving the answer itself.
  Non-passing verdicts **escalate to `gpt-4o`** (deterministic) to kill false
  positives. **Cutoff (fixed before results): pass only if `correct_useful`.**
- **Baseline to beat** — `baseline.py`: keyword / nearest-question matching.
- **Harness** — `run_eval.py`: leakage check, held-out accuracy + wrong-answer
  catch rate vs. baseline, then runs the whole 156-card deck and reports the
  three counts, writing `decks/verified_deck.tsv` (kept) and `blocked_cards.tsv`
  (quarantined for human review).

Run it (needs `OPENAI_API_KEY` in `.env`):

```bash
cd anki-desktop && ./out/pyenv/bin/python mathgre/eval/run_eval.py
```

**Results (`mathgre/eval/RESULTS.md`):**

| Method | Accuracy | Wrong-answer catch | False "wrong" on good cards |
|--------|---------:|-------------------:|----------------------------:|
| AI checker | **90%** | **100%** | **0%** |
| Baseline (keyword) | 23% | 8% | 17% |

Full deck: **155 correct/useful (kept), 1 wrong (blocked), 0 low-quality.**

**Honesty note:** the 1 blocked card (`lim_{x→0}(1−cos x)/x = 0`) is actually
*correct* — both models reproducibly mis-evaluate this limit. That false positive
is documented in `RESULTS.md`; it's why blocked cards are quarantined for a human
rather than deleted, and why we report a held-out false-positive rate.

---

## Build & run

Prerequisites for the **Rust test suite** (one-time, Debian/Ubuntu):

```bash
sudo apt install pkg-config libssl-dev    # needed by reqwest's TLS in test deps
```

Desktop:

```bash
cd anki-desktop
just run                     # build + launch Anki (Tools → GRE Math Readiness / Teach-Back)
just test-rust               # runs the 3 mastery unit tests (+ the rest)
just test-py                 # runs test_topic_mastery + test_gre_readiness + pylib suite

# If ninja reports "no work to do" (it caches the pytest task and may not pick up
# a newly added test file), run the tests directly against the BUILT package:
PYTHONPATH="$PWD/pylib:$PWD/out/pylib" ./out/pyenv/bin/python -m pytest \
  pylib/tests/test_stats.py pylib/tests/test_gre_readiness.py -q
```

Note: don't run `./out/pyenv/bin/pytest pylib/...` without the `PYTHONPATH`
above — the editable `anki` points at the source tree, which is missing
build-generated modules (`anki.buildinfo`, `*_pb2`).

A ready-made **deck** of 156 topic-tagged GRE Math cards is **bundled in the app**
and auto-imported the first time each collection opens (embedded in
`qt/aqt/mathgre_deck.py`, seeded by `ensure_gre_math_deck` in
`MainWindow.loadCollection`), so every user starts with the **GRE Math** deck and
the mastery/coverage dashboards populate immediately. Seeding happens once per
collection and isn't re-added if the user deletes the deck. The source TSV lives
at `anki-desktop/mathgre/decks/mathgre_sample.tsv` (also importable by hand via
File → Import). To tag your own notes, use `topic::calculus`,
`topic::linear-algebra`, etc. (topic list in `pylib/anki/gre_readiness.py`).

Mobile (AnkiDroid): `cd AnkiDroid && ./gradlew assembleDebug` then install on a
device/emulator; it shares the same Rust engine, so the mastery RPC is available
there too.

---

## Hand-off: installer, mobile, and recordings (run on your machine)

These need a GUI / Android toolchain / screen capture, so they're done locally,
not in code review.

**Desktop installer** (Briefcase-based, per platform):
```bash
cd anki-desktop
just build            # ensure a full build first
# packaging recipes live under `release.just` / qt/installer/ — e.g.:
just --list | grep -i installer
```
Then run the produced installer on a clean machine and record it.

**Mobile (AnkiDroid)** — shares this Rust engine, so the `TopicMastery` RPC is
available on device once built:
```bash
cd AnkiDroid
./gradlew assembleDebug          # or open in Android Studio and Run on an emulator
adb install AnkiDroid/build/outputs/apk/debug/AnkiDroid-debug.apk
```
Load your exam deck and run a review session (Wednesday: reviewing the shared
deck; two-way sync is Friday). To surface readiness on the phone, add a menu
entry that calls the backend `topicMastery` RPC (same proto, regenerated for
Kotlin) and reuse the weighting/give-up logic from `gre_readiness.py`.

**Recordings to capture** (Wednesday proof): a clean build, the 3 Rust + Python
tests passing, a clean-machine install, and a phone review session.

## Notes / honesty log

- `cargo check -p anki` in isolation reports `tokio` `io-util` errors in
  `sync/` and `updates.rs`; those are a Cargo feature-unification artifact of
  checking the crate alone (the item is "gated behind the io-util feature") and
  do **not** occur in the real `just` build. The mastery change itself
  type-checks with zero errors.
- This repo was flattened from nested git repos, so `anki-desktop/` and the two
  `ftl/` translation folders were re-initialised as local git repos to satisfy
  Anki's build-hash and submodule steps.
