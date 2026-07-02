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

## Honest memory readiness (`anki-desktop/mathgre/readiness.py`)

Consumes the mastery RPC and reports a **memory** signal only:

- point estimate = exam-weight-weighted mean recall (uncovered high-weight
  sections drag it down — you can't skip Calculus and look "ready"),
- a **likely range** that widens with less data and lower coverage,
- **coverage** vs the GRE Math topic outline,
- a **confidence** label and the single **weakest topic** to study next.

**Give-up rule (explicit):** *no score until ≥ 200 graded reviews AND ≥ 50%
topic coverage.* Below that it abstains and says exactly what's missing.

Test: `anki-desktop/mathgre/test_readiness.py`.

---

## Build & run

Prerequisites for the **Rust test suite** (one-time, Debian/Ubuntu):

```bash
sudo apt install pkg-config libssl-dev    # needed by reqwest's TLS in test deps
```

Desktop:

```bash
cd anki-desktop
just run                     # build + launch Anki
just test-rust               # runs the 3 mastery unit tests (+ the rest)
just test-py                 # runs test_topic_mastery (the new RPC) + pylib suite

# The readiness test lives outside pylib/tests, so run it against the BUILT
# package (out/pylib), not the editable source tree:
PYTHONPATH="$PWD/out/pylib:$PWD" ./out/pyenv/bin/python -m pytest mathgre/test_readiness.py
```

Note: don't run `./out/pyenv/bin/pytest pylib/...` directly — the editable
`anki` points at the source tree, which is missing build-generated modules
(`anki.buildinfo`, `*_pb2`). `just test-py` and the `PYTHONPATH=out/pylib`
invocation above use the built package.

Tag your exam deck's notes with `topic::calculus`, `topic::linear-algebra`, etc.
(see `mathgre/readiness.py` for the topic list) so mastery/coverage populate.

Mobile (AnkiDroid): `cd AnkiDroid && ./gradlew assembleDebug` then install on a
device/emulator; it shares the same Rust engine, so the mastery RPC is available
there too.

---

## Notes / honesty log

- `cargo check -p anki` in isolation reports `tokio` `io-util` errors in
  `sync/` and `updates.rs`; those are a Cargo feature-unification artifact of
  checking the crate alone (the item is "gated behind the io-util feature") and
  do **not** occur in the real `just` build. The mastery change itself
  type-checks with zero errors.
- This repo was flattened from nested git repos, so `anki-desktop/` and the two
  `ftl/` translation folders were re-initialised as local git repos to satisfy
  Anki's build-hash and submodule steps.
