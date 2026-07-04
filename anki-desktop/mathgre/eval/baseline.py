# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""A deliberately simple, non-AI baseline card checker to beat.

Method (keyword / nearest-question matching, no model):
  - If the answer is very short / a known vague phrase -> "low_quality".
  - Else find the nearest gold-set question by token overlap; if a close match
    exists, compare the card's answer to the gold answer by keyword overlap and
    call it "wrong" when overlap is low, otherwise "correct_useful".
  - If no close gold question exists, it can't tell, so it guesses
    "correct_useful".

This mirrors a keyword/vector-search approach and is expected to miss subtle
wrong answers that aren't in the gold set — which is exactly what the AI checker
should beat.
"""

from __future__ import annotations

import re

VAGUE = {
    "the study of change",
    "study of change",
    "math",
    "mathematics",
    "a number",
    "it depends",
    "a function",
    "a set",
}


def _tokens(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", s.lower()))


def baseline_check(question: str, answer: str, gold: list[dict]) -> str:
    ans = answer.strip().lower()
    if len(_tokens(answer)) <= 2 or ans in VAGUE:
        return "low_quality"

    qt = _tokens(question)
    best = None
    best_sim = 0.0
    for g in gold:
        gt = _tokens(g["question"])
        if not gt:
            continue
        sim = len(qt & gt) / len(qt | gt) if (qt | gt) else 0.0
        if sim > best_sim:
            best_sim, best = sim, g

    if best and best_sim >= 0.5:
        aa = _tokens(answer)
        ga = _tokens(best["answer"])
        overlap = len(aa & ga) / max(len(ga), 1)
        return "correct_useful" if overlap >= 0.5 else "wrong"

    return "correct_useful"  # no close reference -> can't judge, guess pass
