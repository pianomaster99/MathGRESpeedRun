# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""Teach-Back results as a second signal for GRE topic mastery.

The Teach-Back lessons (ts/routes/teach) let a student *teach* a problem; the LLM
evaluator returns a feedback report whose knowledge-gap count is a real, if noisy,
measure of how well they understand that topic. This module turns each finished
lesson into a numeric **teaching score** in [0, 1] and stores a per-collection log
in the collection config, so the score can be blended into topic mastery
(``anki.gre_readiness``) and shown right after a lesson.

No AI here: the score is a deterministic function of the (already-produced)
feedback. Verified lessons are ones graded by the real LLM evaluator; offline
lessons are logged as attempts but do not contribute a score.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from anki.collection import Collection

CONFIG_KEY = "mathgreTeachbackLog"
MAX_RECORDS = 1000

# Each real knowledge gap costs this much of a lesson's teaching score.
GAP_PENALTY = 0.25
# Average the most recent N verified lessons per topic (reflects current skill,
# so a topic's teaching score improves as the student re-teaches it).
RECENT_WINDOW = 5

# How a topic's memory (FSRS recall) and teaching scores combine into one number.
MEMORY_WEIGHT = 0.70
TEACH_WEIGHT = 0.30


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def compute_teach_score(gaps: int, verified: bool) -> float | None:
    """Teaching score in [0,1] from a lesson's gap count. None if not verified."""
    if not verified:
        return None
    return _clamp01(1.0 - GAP_PENALTY * max(0, int(gaps)))


def _load_log(col: Collection) -> list[dict[str, Any]]:
    log = col.get_config(CONFIG_KEY, None)
    return log if isinstance(log, list) else []


def _save_log(col: Collection, log: list[dict[str, Any]]) -> None:
    col.set_config(CONFIG_KEY, log[-MAX_RECORDS:])


def record_lesson(
    col: Collection,
    *,
    lesson_id: str,
    slug: str | None,
    topic: str,
    gaps: int,
    strengths: int,
    verified: bool,
) -> dict[str, Any]:
    """Append one finished-lesson record and return it."""
    rec: dict[str, Any] = {
        "at": int(time.time()),
        "lessonId": str(lesson_id or ""),
        "slug": (slug or None),
        "topic": str(topic or ""),
        "gaps": int(gaps or 0),
        "strengths": int(strengths or 0),
        "verified": bool(verified),
        "teachScore": compute_teach_score(gaps, verified),
    }
    log = _load_log(col)
    log.append(rec)
    _save_log(col, log)
    return rec


@dataclass
class TeachingSummary:
    slug: str
    count: int  # total lessons taught for this topic
    verified_count: int  # lessons graded by the real evaluator
    avg_score: float | None  # mean of the recent verified teaching scores
    last_at: int | None
    last_gaps: int | None


def teaching_by_topic(col: Collection) -> dict[str, TeachingSummary]:
    """Aggregate the teach-back log into a per-topic-slug summary."""
    log = _load_log(col)
    grouped: dict[str, list[dict[str, Any]]] = {}
    for rec in log:
        slug = rec.get("slug")
        if slug:
            grouped.setdefault(slug, []).append(rec)

    out: dict[str, TeachingSummary] = {}
    for slug, recs in grouped.items():
        recs.sort(key=lambda r: r.get("at", 0))
        verified_scores = [
            r["teachScore"] for r in recs if r.get("teachScore") is not None
        ]
        recent = verified_scores[-RECENT_WINDOW:]
        avg = sum(recent) / len(recent) if recent else None
        last = recs[-1]
        out[slug] = TeachingSummary(
            slug=slug,
            count=len(recs),
            verified_count=len(verified_scores),
            avg_score=avg,
            last_at=last.get("at"),
            last_gaps=last.get("gaps"),
        )
    return out


def blend(memory: float | None, teaching: float | None) -> float | None:
    """Combine a topic's memory (FSRS) and teaching scores into one mastery value.

    Uses both when available, otherwise whichever signal exists (None if neither).
    """
    if memory is not None and teaching is not None:
        return MEMORY_WEIGHT * memory + TEACH_WEIGHT * teaching
    if memory is not None:
        return memory
    if teaching is not None:
        return teaching
    return None
