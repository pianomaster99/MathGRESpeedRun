# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""AI flashcard checker for the GRE Math deck.

An LLM judge (OpenAI, keyed from the repo .env) that, for each card, independently
works out the correct answer, then classifies the card as:
  - "wrong"          — the answer is mathematically incorrect (worst; block it)
  - "low_quality"    — correct but vague/trivial/circular (block it)
  - "correct_useful" — correct AND teaches a specific idea (keep it)

The verdict cites a named mathematical basis (grounding). The cutoff keeps only
"correct_useful". No external deps (stdlib urllib).
"""

from __future__ import annotations

import json
import os
import urllib.request

MODEL = os.environ.get("TEACHBACK_MODEL", "gpt-4o-mini")
# Flagged cards are escalated to a stronger model for confirmation, so that a
# weak model's arithmetic slips don't wrongly block a correct card.
CONFIRM_MODEL = os.environ.get("CHECKER_CONFIRM_MODEL", "gpt-4o")
CUTOFF_PASS = {"correct_useful"}


def load_key() -> str | None:
    if os.environ.get("OPENAI_API_KEY"):
        return os.environ["OPENAI_API_KEY"]
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, "..", "..", "..", ".env"),  # repo root
        os.path.join(here, "..", "..", ".env"),  # anki-desktop
        os.path.join(here, ".env"),
    ]
    for path in candidates:
        try:
            for line in open(path, encoding="utf-8"):
                s = line.strip()
                if s.startswith("OPENAI_API_KEY="):
                    v = s.split("=", 1)[1].strip().strip('"').strip("'")
                    if v:
                        return v
        except FileNotFoundError:
            pass
    return None


SYSTEM = """You are a strict grader of math flashcards for the GRE Mathematics
Subject Test (undergraduate math). For the given card (question + answer):

1) Independently work out the correct answer yourself, then decide whether the
   card's answer is mathematically CORRECT.
2) Judge teaching quality: is it specific and useful, or vague / trivial /
   circular / not testing a real skill?

Return exactly one verdict:
- "wrong": the answer is mathematically incorrect (a wrong fact). Worst case.
- "low_quality": the answer is correct but the card is vague, trivial, circular,
  or not specific enough to test a real skill.
- "correct_useful": correct AND teaches a specific, useful idea.

Cite the mathematical basis for your correctness call (a named theorem/rule).
Respond ONLY as JSON: {"verdict": "...", "reason": "...", "basis": "..."}"""

# Extra guardrails for the confirmation pass, targeting the mistakes that cause
# a correct card to be wrongly rejected (false positives).
CONFIRM = """Re-derive the correct answer from scratch, step by step, before you
judge. Be especially careful with:
- limits (e.g. (1−cos x)/x → 0, but (1−cos x)/x² → 1/2);
- asymptotic/error orders (e.g. composite Simpson's rule error is O(h^4));
- signs, constants of integration, and algebra.
Only return "wrong" if you are certain the card's answer is mathematically
incorrect after re-deriving. If it matches your derivation, it is not "wrong".
Prefer "correct_useful" unless there is a real defect."""


def check_card(
    question: str,
    answer: str,
    key: str | None = None,
    temperature: float = 0,
    confirm: bool = False,
    model: str | None = None,
) -> dict:
    key = key or load_key()
    if not key:
        raise RuntimeError("no OPENAI_API_KEY available")
    system = SYSTEM + ("\n\n" + CONFIRM if confirm else "")
    body = json.dumps(
        {
            "model": model or MODEL,
            "temperature": temperature,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": f"Question: {question}\nAnswer: {answer}"},
            ],
        }
    ).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    out = json.loads(data["choices"][0]["message"]["content"])
    verdict = out.get("verdict")
    if verdict not in ("wrong", "low_quality", "correct_useful"):
        verdict = "wrong"  # fail closed
    return {"verdict": verdict, "reason": out.get("reason", ""), "basis": out.get("basis", "")}


def check_card_robust(question: str, answer: str, key: str | None = None) -> dict:
    """Cheap first pass with the small model; if it does not pass, escalate to a
    stronger model that carefully re-derives the answer (deterministic, temp 0).
    This removes most false positives (correct cards wrongly flagged by the weak
    model) while adding a call only for flagged cards, and stays reproducible."""
    key = key or load_key()
    first = check_card(question, answer, key, temperature=0)
    if first["verdict"] == "correct_useful":
        return first
    confirmed = check_card(question, answer, key, temperature=0, confirm=True, model=CONFIRM_MODEL)
    confirmed["escalated_to"] = CONFIRM_MODEL
    return confirmed


def passes(verdict: str) -> bool:
    """The cutoff: only correct+useful cards are allowed into the deck."""
    return verdict in CUTOFF_PASS
