# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""Honest MEMORY readiness for the GRE Mathematics Subject Test (scale 200-990).

No AI. This computes only the *memory* signal (can the student recall the facts
they've studied), reported as a probability with an explicit range, plus a hard
give-up rule and a topic-coverage map. It deliberately does NOT emit a 200-990
projected score — that is the "readiness" score-mapping model, which is a later
deliverable and must not be faked.

The signal is built entirely on Anki's own FSRS data, surfaced through the Rust
backend RPC ``StatsService.TopicMastery`` (see rslib/src/stats/mastery.rs and
``Collection.topic_mastery``). Cards are grouped by the note tag
``topic::<name>``. Living in the ``anki`` package means the desktop UI, tests,
and any script share exactly one implementation.
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from anki.teachback_stats import blend, record_lesson, teaching_by_topic

if TYPE_CHECKING:
    from anki.collection import Collection

TOPIC_PREFIX = "topic::"
MASTERY_THRESHOLD = 0.9

# --- Give-up rule (stated explicitly) --------------------------------------
# Show NO memory score until BOTH are true. Knowing when it does not know is
# more useful than a confident guess.
MIN_GRADED_REVIEWS = 200
MIN_COVERAGE = 0.50

# Performance give-up rule: no exam-style performance score until enough
# graded Teach-Back lessons across enough of the exam.
MIN_PERF_LESSONS = 10
MIN_PERF_COVERAGE = 0.30

# GRE Mathematics Subject Test scaled-score range (readiness is projected here).
SCALE_MIN = 200
SCALE_MAX = 990

# --- GRE Mathematics Subject Test outline (approximate ETS weightings) ------
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
    # Teaching signal from Teach-Back lessons (anki.teachback_stats).
    teach_score: float | None = None  # recent verified teaching score, 0-1
    teach_count: int = 0  # lessons taught for this topic
    combined: float | None = None  # memory + teaching blended, 0-1


@dataclass
class MemoryReadiness:
    """Honest memory readiness. `score` is None when the give-up rule fires.

    `score` is the exam-weighted blend of memory (FSRS recall) AND teaching
    (Teach-Back results); `memory_score` is the memory-only component, kept for
    transparency. With no teaching data the two are identical.
    """

    score: float | None  # blended weighted mastery over the exam, 0-1
    low: float | None  # lower end of the likely range
    high: float | None  # upper end of the likely range
    coverage: float  # fraction of exam weight your deck covers
    graded_reviews: int
    confidence: str  # "none" | "low" | "medium" | "high"
    abstained: bool
    reason: str
    weakest_topic: str | None
    memory_score: float | None = None  # memory-only weighted mastery, 0-1
    topics: list[TopicReadiness] = field(default_factory=list)


@dataclass
class Score:
    """One of the three scores (memory or performance), 0-1, with a range."""

    value: float | None
    low: float | None
    high: float | None
    confidence: str  # "none" | "low" | "medium" | "high"
    abstained: bool
    reason: str


@dataclass
class ReadinessScore:
    """Projected exam score on the real scale (200-990), with a range."""

    scaled: int | None
    scaled_low: int | None
    scaled_high: int | None
    confidence: str
    abstained: bool
    reason: str
    # Honesty flag: whether past projections have been checked against outcomes.
    # False here — calibration/validation is a later (Sunday) deliverable.
    accuracy_validated: bool = False


@dataclass
class ExamScores:
    """The three separate scores the app must show, each with its own range."""

    memory: Score
    performance: Score
    readiness: ReadinessScore
    coverage: float
    graded_reviews: int
    lessons_verified: int
    weakest_topic: str | None
    updated_at: int  # epoch seconds
    topics: list[TopicReadiness] = field(default_factory=list)


def _graded_review_count(col: Collection) -> int:
    # revlog.type >= 0 are graded answers; -1 rows are manual reschedules.
    return int(col.db.scalar("select count() from revlog where type >= 0") or 0)


def compute_memory_readiness(
    col: Collection,
    *,
    topic_prefix: str = TOPIC_PREFIX,
    mastery_threshold: float = MASTERY_THRESHOLD,
) -> MemoryReadiness:
    """Compute the honest memory readiness signal for the current collection."""
    resp = col.topic_mastery(mastery_threshold, topic_prefix)
    by_topic = {t.topic: t for t in resp.topics}
    teach = teaching_by_topic(col)

    topics: list[TopicReadiness] = []
    covered_weight = 0.0
    weighted_recall = 0.0  # memory-only numerator
    for name, weight in GRE_MATH_TOPICS.items():
        t = by_topic.get(name)
        covered = t is not None and t.total > 0
        memory = t.average_recall if covered else None
        summary = teach.get(name)
        teach_score = summary.avg_score if summary else None
        teach_count = summary.count if summary else 0
        combined = blend(memory, teach_score)
        if covered:
            covered_weight += weight
            weighted_recall += weight * (memory or 0.0)
        topics.append(
            TopicReadiness(
                topic=name,
                exam_weight=weight,
                covered=covered,
                total_cards=t.total if t else 0,
                mastered=t.mastered if t else 0,
                average_recall=memory or 0.0,
                teach_score=teach_score,
                teach_count=teach_count,
                combined=combined,
            )
        )

    total_weight = sum(GRE_MATH_TOPICS.values())
    coverage = covered_weight / total_weight if total_weight else 0.0
    graded = _graded_review_count(col)

    # Uncovered high-weight sections drag the score down — you can't skip
    # Calculus and look "ready". This is the pure MEMORY score; performance and
    # readiness are separate scores (see compute_scores).
    memory_score = weighted_recall / total_weight if total_weight else 0.0
    score = memory_score
    weakest = _pick_weakest(topics)

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
            memory_score=None,
            topics=topics,
        )

    # Range: statistical margin from sample size, widened by uncovered material.
    stat_margin = 1.96 * math.sqrt(max(score * (1 - score), 0.01) / graded)
    coverage_margin = 0.5 * (1 - coverage)
    margin = stat_margin + coverage_margin
    low = max(0.0, score - margin)
    high = min(1.0, score + margin)

    reason = (
        f"Memory recall {score:.0%} over {coverage:.0%} of the exam "
        f"({graded} graded reviews). Range widened by uncovered material."
    )
    return MemoryReadiness(
        score=score,
        low=low,
        high=high,
        coverage=coverage,
        graded_reviews=graded,
        confidence=_confidence(graded, coverage),
        abstained=False,
        reason=reason,
        weakest_topic=weakest,
        memory_score=memory_score,
        topics=topics,
    )


def _mastery_of(t: TopicReadiness) -> float:
    return t.combined if t.combined is not None else t.average_recall


def _pick_weakest(topics: list[TopicReadiness]) -> str | None:
    # A topic with no signal at all (no cards, never taught) is the biggest hole.
    no_signal = [t for t in topics if t.combined is None]
    if no_signal:
        return max(no_signal, key=lambda t: t.exam_weight).topic
    if not topics:
        return None
    # Otherwise the lowest blended mastery, weighted toward high-exam-weight gaps.
    return min(topics, key=lambda t: _mastery_of(t) * 0.5 + (1 - t.exam_weight)).topic


def _confidence(graded: int, coverage: float) -> str:
    if graded >= 1000 and coverage >= 0.9:
        return "high"
    if graded >= 500 and coverage >= 0.7:
        return "medium"
    return "low"


def _to_scale(frac: float) -> int:
    """Map a 0-1 fraction to the exam scale, rounded to the nearest 10."""
    frac = max(0.0, min(1.0, frac))
    raw = SCALE_MIN + frac * (SCALE_MAX - SCALE_MIN)
    return int(round(raw / 10.0) * 10)


def _performance_score(
    col: Collection, topics: list[TopicReadiness], total_weight: float
) -> tuple[Score, int, float]:
    """Exam-style PERFORMANCE score from graded Teach-Back lessons.

    This is a different question than memory: can the student actually work a
    problem, not just recall a fact. Untested topics drag the score down, and it
    abstains until there's enough graded teaching practice.
    """
    teach = teaching_by_topic(col)
    weighted = 0.0
    perf_weight = 0.0
    verified_total = 0
    for t in topics:
        summary = teach.get(t.topic)
        if summary and summary.avg_score is not None:
            weighted += t.exam_weight * summary.avg_score
            perf_weight += t.exam_weight
            verified_total += summary.verified_count
    perf_coverage = perf_weight / total_weight if total_weight else 0.0
    value = weighted / total_weight if total_weight else 0.0

    if verified_total < MIN_PERF_LESSONS or perf_coverage < MIN_PERF_COVERAGE:
        reason = (
            f"Not enough teaching practice yet: {verified_total}/{MIN_PERF_LESSONS} "
            f"graded lessons, {perf_coverage:.0%}/{MIN_PERF_COVERAGE:.0%} topic coverage."
        )
        return (
            Score(None, None, None, "none", True, reason),
            verified_total,
            perf_coverage,
        )

    margin = 0.7 / math.sqrt(verified_total) + 0.5 * (1 - perf_coverage)
    low = max(0.0, value - margin)
    high = min(1.0, value + margin)
    conf = (
        "high"
        if verified_total >= 80 and perf_coverage >= 0.7
        else "medium"
        if verified_total >= 30 and perf_coverage >= 0.5
        else "low"
    )
    reason = (
        f"Exam-style teaching accuracy {value:.0%} over {perf_coverage:.0%} of the "
        f"exam ({verified_total} graded lessons). Range widened by untested topics."
    )
    return Score(value, low, high, conf, False, reason), verified_total, perf_coverage


def _readiness_score(memory: Score, performance: Score) -> ReadinessScore:
    """Project a scaled exam score from the memory and performance scores.

    Honesty: requires the memory give-up rule to be satisfied, always reports a
    range, and flags that the projection itself is not yet accuracy-validated.
    """
    if memory.abstained or memory.value is None:
        return ReadinessScore(
            None,
            None,
            None,
            "none",
            True,
            "No projected score until the memory model has enough data: "
            + memory.reason,
            accuracy_validated=False,
        )
    mem = memory.value
    if not performance.abstained and performance.value is not None:
        frac = 0.5 * mem + 0.5 * performance.value
        low_frac = 0.5 * (memory.low or 0) + 0.5 * (performance.low or 0)
        high_frac = 0.5 * (memory.high or 0) + 0.5 * (performance.high or 0)
        basis = f"memory {mem:.0%} and performance {performance.value:.0%}"
    else:
        frac = mem
        low_frac = memory.low or 0.0
        high_frac = memory.high or 0.0
        basis = f"memory {mem:.0%} (no performance data yet)"
    reason = (
        f"Projected from {basis}, mapped to the {SCALE_MIN}-{SCALE_MAX} scale. "
        "This projection has NOT been validated against real outcomes yet."
    )
    return ReadinessScore(
        scaled=_to_scale(frac),
        scaled_low=_to_scale(low_frac),
        scaled_high=_to_scale(high_frac),
        confidence="low",  # unvalidated projection -> never above low
        abstained=False,
        reason=reason,
        accuracy_validated=False,
    )


def compute_scores(
    col: Collection,
    *,
    topic_prefix: str = TOPIC_PREFIX,
    mastery_threshold: float = MASTERY_THRESHOLD,
) -> ExamScores:
    """Compute the three SEPARATE scores (memory, performance, readiness).

    Each carries its own range and give-up rule; they are never blended into a
    single number.
    """
    r = compute_memory_readiness(
        col, topic_prefix=topic_prefix, mastery_threshold=mastery_threshold
    )
    memory = Score(r.score, r.low, r.high, r.confidence, r.abstained, r.reason)
    total_weight = sum(GRE_MATH_TOPICS.values())
    performance, verified_total, _perf_cov = _performance_score(
        col, r.topics, total_weight
    )
    readiness = _readiness_score(memory, performance)
    return ExamScores(
        memory=memory,
        performance=performance,
        readiness=readiness,
        coverage=r.coverage,
        graded_reviews=r.graded_reviews,
        lessons_verified=verified_total,
        weakest_topic=r.weakest_topic,
        updated_at=int(time.time()),
        topics=r.topics,
    )


def _score_dict(s: Score) -> dict[str, Any]:
    return {
        "value": s.value,
        "low": s.low,
        "high": s.high,
        "confidence": s.confidence,
        "abstained": s.abstained,
        "reason": s.reason,
    }


def scores_snapshot(x: ExamScores) -> dict[str, Any]:
    """Compact, JSON-serializable view of the three scores (for the UI/phone)."""
    return {
        "memory": _score_dict(x.memory),
        "performance": _score_dict(x.performance),
        "readiness": {
            "scaled": x.readiness.scaled,
            "scaledLow": x.readiness.scaled_low,
            "scaledHigh": x.readiness.scaled_high,
            "confidence": x.readiness.confidence,
            "abstained": x.readiness.abstained,
            "reason": x.readiness.reason,
            "accuracyValidated": x.readiness.accuracy_validated,
            "scaleMin": SCALE_MIN,
            "scaleMax": SCALE_MAX,
        },
        "coverage": x.coverage,
        "gradedReviews": x.graded_reviews,
        "lessonsVerified": x.lessons_verified,
        "weakest": x.weakest_topic,
        "updatedAt": x.updated_at,
    }


def readiness_snapshot(r: MemoryReadiness) -> dict[str, Any]:
    """A compact, JSON-serializable view of a readiness report (for the UI)."""
    return {
        "score": r.score,
        "memoryScore": r.memory_score,
        "low": r.low,
        "high": r.high,
        "coverage": r.coverage,
        "gradedReviews": r.graded_reviews,
        "confidence": r.confidence,
        "abstained": r.abstained,
        "reason": r.reason,
        "weakest": r.weakest_topic,
    }


def record_lesson_and_stats(col: Collection, payload: dict[str, Any]) -> dict[str, Any]:
    """Record one finished Teach-Back lesson and return the updated stats.

    Called from the Teach-Back webview via the pycmd bridge. `payload` carries
    ``lessonId``, ``slug`` (mastery topic slug or None for warm-ups), ``topic``
    (display name), ``gaps``, ``strengths``, and ``verified`` (graded by the real
    LLM). Returns the lesson's teaching score, the affected topic's mastery
    breakdown, and an overall readiness snapshot for immediate display.
    """
    rec = record_lesson(
        col,
        lesson_id=str(payload.get("lessonId", "")),
        slug=payload.get("slug") or None,
        topic=str(payload.get("topic", "")),
        gaps=int(payload.get("gaps", 0) or 0),
        strengths=int(payload.get("strengths", 0) or 0),
        verified=bool(payload.get("verified", False)),
    )

    scores = compute_scores(col)
    slug = rec["slug"]
    topic_stats: dict[str, Any] | None = None
    if slug:
        tr = next((t for t in scores.topics if t.topic == slug), None)
        if tr is not None:
            topic_stats = {
                "slug": slug,
                "topic": rec["topic"],
                "examWeight": tr.exam_weight,
                "memory": tr.average_recall if tr.covered else None,
                "teaching": tr.teach_score,
                "combined": tr.combined,
                "teachCount": tr.teach_count,
                "mastered": tr.mastered,
                "total": tr.total_cards,
            }

    return {
        "recorded": True,
        "teachScore": rec["teachScore"],
        "verified": rec["verified"],
        "topic": topic_stats,
        "scores": scores_snapshot(scores),
    }
