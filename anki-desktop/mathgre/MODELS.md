# Model descriptions — GRE Mathematics Subject Test (200–990)

Three **separate** scores, each with its own range and give‑up rule; never blended
into one number. All three are pure math (no AI), so they work with AI switched
off. Source: `pylib/anki/gre_readiness.py` + `pylib/anki/teachback_stats.py` on
top of the Rust `StatsService.TopicMastery` RPC (`rslib/src/stats/mastery.rs`).

---

## 1. Memory model — "can you recall a fact right now?"

**Inputs.** Anki's FSRS predicted recall (retrievability) per card, from the
card's memory state (stability/difficulty) and time since last review — computed
in Rust (`predicted_recall`). Cards are grouped by the `topic::<slug>` tag.

**Per topic.** `average_recall` = mean predicted recall over the topic's cards;
`mastered` = count with recall ≥ 0.9.

**Overall.** Exam‑weight‑weighted mean of per‑topic average recall divided by the
**total** exam weight (uncovered topics drag it down — you can't skip Calculus and
look ready).

**Range.** `1.96·√(p(1−p)/reviews)` (sampling margin) + `0.5·(1−coverage)`
(extrapolation penalty). Tightens with more reviews and broader coverage.

**Give‑up rule.** No score until **≥ 200 graded reviews AND ≥ 50% topic
coverage**. Below that it abstains and says exactly what's missing.

**Calibration (Step 1).** Method + runnable harness in `mathgre/eval/calibrate.py`
(Brier, log loss, reliability curve binning predicted vs observed recall). Honest
status: a real calibration needs longitudinal reviews (same learner over weeks,
predicted retrievability recorded before each review, outcome after). We don't
have that in a one‑week build, so we ship the harness + method and **do not**
publish a calibrated number we can't back up. `calibrate.py --selftest` proves the
harness is correct on synthetic ground‑truth data.

---

## 2. Performance model — "can you answer a NEW exam‑style question?"

Memory ≠ performance: recalling a fact isn't the same as working a problem. This
is the bridge.

**Signal.** Graded **Teach‑Back** lessons. When a learner teaches a problem, the
LLM evaluator returns a knowledge‑gap count; a verified (online‑graded) lesson
scores `teach_score = clamp(1 − 0.25·gaps, 0, 1)`. Offline lessons are logged as
attempts but contribute no score.

**Per topic.** Mean of the recent verified `teach_score`s for that topic slug.
**Overall.** Exam‑weight‑weighted mean / total weight (untested topics drag down).

**Range.** `0.7/√(lessons)` + `0.5·(1−performance_coverage)`.

**Give‑up rule.** No score until **≥ 10 graded lessons AND ≥ 30% topic coverage**.

**Held‑out check (Step 2 / 7d — the paraphrase test).** Design + status in
`mathgre/eval/README`: for a card, write reworded exam‑style questions testing the
same idea and compare the learner's card recall to their accuracy on the
rewordings; report the gap (a small gap means performance is just copying memory).
Honest status: measuring "the learner's" accuracy needs a real learner, so this is
specified and instrumented but the gap number awaits real study sessions.

---

## 3. Readiness model — "what would you score today?"

**Method.** Blend the two 0–1 scores, `fraction = 0.5·memory + 0.5·performance`
(memory alone if performance hasn't unlocked), then map to the exam scale:
`scaled = round( 200 + fraction·(990−200), to nearest 10 )`. The range is the same
mapping applied to the blended low/high.

**Give‑up rule.** Requires the memory give‑up rule to be satisfied.

**Honesty.** Confidence is capped at **low** and the projection is flagged
**"not yet validated against real outcomes."** Turning question performance into a
true scaled score (Step 3/4) needs students with both study history and real
practice‑test scores, tracked over time — which we don't have. We report a range
and an explicit caveat rather than a confident single number.

---

## Give‑up rules at a glance
| Score | Shows a number only when |
|-------|--------------------------|
| Memory | ≥ 200 graded reviews AND ≥ 50% coverage |
| Performance | ≥ 10 graded lessons AND ≥ 30% coverage |
| Readiness | memory rule satisfied (then blended), always with a range + "not validated" |
