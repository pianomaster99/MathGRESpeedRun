# Speedrun status — Wednesday & Friday deliverables

Exam: **GRE Mathematics Subject Test** (scaled **200–990**). Honest status of every
Wednesday and Friday requirement. ✅ done · 🟡 partial (needs local run/record) ·
⛔ not done in this repo (needs separate infra). No item is dressed up as more than it is.

## Wednesday — core works, no AI

### Desktop
- ✅ **Forked Anki, builds from source.** Brownfield fork; `cd anki-desktop && just run`.
  (A clean-build *recording* is a local hand-off — can't be recorded from here.)
- ✅ **Real Rust engine change, end to end.** New `StatsService.TopicMastery` RPC:
  `proto/anki/stats.proto`, `rslib/src/stats/mastery.rs` (impl + **3 Rust unit tests**:
  `no_data_returns_empty`, `groups_by_topic_and_counts_mastery`,
  `untagged_grouping_and_default_threshold`), wired in `rslib/src/stats/service.rs`,
  **called from Python** in `pylib/tests/test_stats.py::test_topic_mastery`.
  (Running the Rust tests needs `cargo` + `pkg-config libssl-dev` on your machine.)
- ✅ **Review loop on the exam deck.** Anki's review loop + the **156-card GRE deck**
  bundled and auto-imported on first launch (`qt/aqt/mathgre_deck.py`).
- ✅ **Memory model, honest score (range + give-up).** `pylib/anki/gre_readiness.py`
  → the **Memory** score with an explicit range and the give-up rule (≥200 graded
  reviews AND ≥50% coverage). Visible in **Tools → GRE Math Readiness**.
- 🟡 **Installer on a clean machine.** Anki's packaging recipes exist
  (`release.just`, `qt/installer/`); building/recording the installer is a local step.

### Mobile
- ⛔ **Phone companion running the shared Rust engine.** NOT satisfied as the spec
  defines it. What exists today is a **responsive web UI** (`ts/routes/teach`, shared
  logic in `ts/lib/teachback`) that runs in a browser/webview and, on a phone browser
  over LAN, shows the same three scores. That is a shared-*logic* web view, **not** a
  native companion running Anki's Rust engine (AnkiDroid / iOS FFI). Building that is
  a separate multi-day effort with Android/iOS toolchains and is the top open item.

## Friday — AI added and checked; phone syncs

### Desktop (AI)
- ✅ **What AI / why / skipped.** See `README.md` → "AI card verification" and
  `anki-desktop/mathgre/eval/RESULTS.md`. Summary: AI is used only to *check/generate*
  cards (not to score); scoring is deliberately AI-free.
- ✅ **Every AI output traces to a named source.** `mathgre/eval/sources.md`; the
  checker cites a mathematical basis per verdict.
- ✅ **Eval before students see anything (accuracy + wrong-answer rate + cutoff).**
  `mathgre/eval/run_eval.py` → `RESULTS.md` (held-out set; cutoff fixed before results).
- ✅ **Beats a simpler method.** AI checker **90% acc / 100% wrong-catch** vs keyword
  baseline **23% / 8%** (`RESULTS.md`).
- ✅ **Still scores with AI off.** All three scores are pure math (FSRS + logged
  Teach-Back results); no model calls. Verified by `pylib/tests/test_gre_readiness.py`.
- ✅ **Leakage check (7e).** `run_eval.py` `leakage_check` (gold vs deck near-dupes).
- ✅ **AI card check (7f).** 50-item gold set, generated deck, 3 counts, pre-set cutoff,
  failing cards blocked (`mathgre/eval/`).

### Mobile
- 🟡 **Three scores with ranges + give-up on the phone.** The web/phone UI shows
  **Memory · Performance · Readiness**, each with a range and give-up (after a lesson
  in `ts/routes/teach/Feedback.svelte`; dashboard in `qt/aqt/gre_readiness.py`). It's
  viewable on a phone browser, but via the web UI, not a native companion.
- ⛔ **Two-way sync desktop⇄phone (7b) + offline-then-sync.** Not done — there is no
  second app to sync with. Anki's own sync exists, but the companion doesn't.

## Rules-you-cannot-break (Friday-relevant)
- ✅ **Three separate scores, each with a range (not one blended number).** Implemented
  in `compute_scores`: Memory (FSRS), Performance (Teach-Back accuracy), Readiness
  (projected 200–990). Each has value + range + confidence + give-up; readiness is
  flagged **not yet validated** (calibration is the Sunday item).
- ✅ **Refuse a score without enough data.** Give-up rules for all three.
- ✅ **AGPL-3.0-or-later, credit to Anki.** Inherited from upstream Anki (`LICENSE`);
  README credits Anki.
- 🟡 **Ship desktop installer + phone build that run with AI off.** AI-off works;
  packaging/recording is local; native phone build is the open item above.

## The honest headline
Everything that is a **code + engine + AI-evaluation** deliverable for Wed/Fri is done
and tested here. The genuine gap is the **native phone companion that shares the Rust
engine and syncs** (Wed mobile / Fri mobile sync) — that needs Android/iOS build infra
and is not something this repo can fake. It is called out rather than dressed up, per
the assignment's honesty rule.
