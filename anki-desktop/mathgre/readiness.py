# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""Honest MEMORY readiness for the GRE Mathematics Subject Test (scale 200-990).

Wednesday scope: NO AI. This computes only the *memory* signal (can the student
recall the facts they've studied), reported as a probability with an explicit
range, plus a hard give-up rule and a topic-coverage map. It deliberately does
NOT emit a 200-990 projected score — that is the "readiness" model (score
mapping) which is a later deliverable and must not be faked.

The memory signal is built entirely on Anki's own FSRS data, surfaced through the
new Rust backend RPC `StatsService.TopicMastery` (see rslib/src/stats/mastery.rs
and collection.topic_mastery). Cards are grouped by the note tag
``topic::<name>``.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import anki.collection

TOPIC_PREFIX = "topic::"
MASTERY_THRESHOLD = 0.9

# --- Give-up rule (stated explicitly) --------------------------------------
# We show NO memory score until BOTH are true. A system that knows when it does
# not know is more useful than a confident guess.
MIN_GRADED_REVIEWS = 200
MIN_COVERAGE = 0.50

# --- GRE Mathematics Subject Test outline (approximate ETS weightings) ------
# name -> fraction of the exam. Used for coverage and weighting.
GRE_MATH_TOPICS: dict[str, float] = {
    "calculus": 0.50,
    "linear-algebra": 0.09,
    "abstract-algebra": 0.09,
    "number-theory": 0.07,
    "real-analysis": 0.09,
    "topology": 0.06,
    "complex-analysis": 0.05,
    "probability-statistics": 0.03,
    "discrete-combinatorics": 0.01,
    "numerical-analysis": 0.01,
}


@dataclass
class TopicReadiness:
    topic: str
    exam_weight: float
    covered: bool
    total_cards: int
    mastered: int
    average_recall: float


@dataclass
class MemoryReadiness:
    """Honest memory readiness. `score` is None when the give-up rule fires."""

    score: float | None  # weighted mean recall over the exam, 0-1
    low: float | None  # lower end of the likely range
    high: float | None  # upper end of the likely range
    coverage: float  # fraction of exam weight your deck covers
    graded_reviews: int
    confidence: str  # "none" | "low" | "medium" | "high"
    abstained: bool
    reason: str  # why we abstained, or the main driver of the number
    weakest_topic: str | None  # single best next thing to study
    topics: list[TopicReadiness] = field(default_factory=list)


def _graded_review_count(col: anki.collection.Collection) -> int:
    # revlog.type: 0=learn 1=review 2=relearn 3=cram/filtered; -1 rows are manual
    # reschedules and are not graded answers.
    return int(col.db.scalar("select count() from revlog where type >= 0") or 0)


def compute_memory_readiness(
    col: anki.collection.Collection,
    *,
    topic_prefix: str = TOPIC_PREFIX,
    mastery_threshold: float = MASTERY_THRESHOLD,
) -> MemoryReadiness:
    """Compute the honest memory readiness signal for the current collection."""
    resp = col.topic_mastery(mastery_threshold, topic_prefix)
    by_topic = {t.topic: t for t in resp.topics}

    topics: list[TopicReadiness] = []
    covered_weight = 0.0
    weighted_recall = 0.0
    for name, weight in GRE_MATH_TOPICS.items():
        t = by_topic.get(name)
        covered = t is not None and t.total > 0
        if covered:
            covered_weight += weight
            weighted_recall += weight * t.average_recall
        topics.append(
            TopicReadiness(
                topic=name,
                exam_weight=weight,
                covered=covered,
                total_cards=t.total if t else 0,
                mastered=t.mastered if t else 0,
                average_recall=t.average_recall if t else 0.0,
            )
        )

    total_weight = sum(GRE_MATH_TOPICS.values())
    coverage = covered_weight / total_weight if total_weight else 0.0
    graded = _graded_review_count(col)

    # Score over the WHOLE exam: uncovered topics count as 0 recall, so skipping a
    # high-weight section can't look "ready".
    score = weighted_recall / total_weight if total_weight else 0.0

    # Weakest covered topic = best next thing to study; else a big uncovered one.
    weakest = _pick_weakest(topics)

    # --- give-up rule ---
    if graded < MIN_GRADED_REVIEWS or coverage < MIN_COVERAGE:
        reason = (
            f"Not enough data yet: {graded}/{MIN_GRADED_REVIEWS} graded reviews, "
            f"{coverage:.0%}/{MIN_COVERAGE:.0%} topic coverage."
        )
        return MemoryReadiness(
            score=None,
            low=None,
            high=None,
            coverage=coverage,
            graded_reviews=graded,
            confidence="none",
            abstained=True,
            reason=reason,
            weakest_topic=weakest,
            topics=topics,
        )

    # --- honest range ---
    # Statistical margin from sample size (Wald-ish) widened by how much of the
    # exam is still uncovered. More data + more coverage => tighter range.
    stat_margin = 1.96 * math.sqrt(max(score * (1 - score), 0.01) / graded)
    coverage_margin = 0.5 * (1 - coverage)
    margin = stat_margin + coverage_margin
    low = max(0.0, score - margin)
    high = min(1.0, score + margin)

    confidence = _confidence(graded, coverage)
    reason = (
        f"Weighted recall {score:.0%} over {coverage:.0%} of the exam "
        f"({graded} graded reviews). Range widened by uncovered material."
    )
    return MemoryReadiness(
        score=score,
        low=low,
        high=high,
        coverage=coverage,
        graded_reviews=graded,
        confidence=confidence,
        abstained=False,
        reason=reason,
        weakest_topic=weakest,
        topics=topics,
    )


def _pick_weakest(topics: list[TopicReadiness]) -> str | None:
    # Prefer an uncovered high-weight topic; otherwise the covered topic with the
    # lowest recall, weighted by exam importance.
    uncovered = [t for t in topics if not t.covered]
    if uncovered:
        return max(uncovered, key=lambda t: t.exam_weight).topic
    covered = [t for t in topics if t.covered]
    if not covered:
        return None
    return min(covered, key=lambda t: t.average_recall * 0.5 + (1 - t.exam_weight)).topic


def _confidence(graded: int, coverage: float) -> str:
    if graded >= 1000 and coverage >= 0.9:
        return "high"
    if graded >= 500 and coverage >= 0.7:
        return "medium"
    return "low"
