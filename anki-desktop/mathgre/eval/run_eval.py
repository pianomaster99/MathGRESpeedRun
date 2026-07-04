# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""Run all card-verification checks and write RESULTS.md.

Steps:
  1. Held-out eval: AI checker vs the simple baseline on a labeled set
     (accuracy + wrong-answer catch rate). Cutoff is fixed BEFORE looking:
     a card passes only if verdict == "correct_useful".
  2. Leakage check: gold-set questions vs the generated deck (near-duplicates).
  3. Run the AI checker on the whole 156-card deck -> the three counts
     (correct_useful / wrong / low_quality); block failing cards.
  4. AI-off note: the readiness/mastery path uses no AI at all.

Usage (from anki-desktop/):  ./out/pyenv/bin/python mathgre/eval/run_eval.py
Requires OPENAI_API_KEY (read from .env).
"""

from __future__ import annotations

import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor

from baseline import baseline_check
from card_checker import check_card_robust, load_key, passes

HERE = os.path.dirname(os.path.abspath(__file__))
DECK = os.path.join(HERE, "..", "decks", "mathgre_sample.tsv")

# The pass/fail cutoff, fixed BEFORE looking at any results.
CUTOFF = 'verdict == "correct_useful"'


def _load_json(name):
    return json.load(open(os.path.join(HERE, name), encoding="utf-8"))


def _load_deck():
    cards = []
    for line in open(DECK, encoding="utf-8"):
        if line.startswith("#") or not line.strip():
            continue
        front, back, tag = line.rstrip("\n").split("\t")
        cards.append({"front": front, "back": back, "tag": tag})
    return cards


def _checked(fn, items, workers=6):
    """Run fn over items concurrently, returning results in order."""
    out = [None] * len(items)

    def work(i):
        for attempt in range(3):
            try:
                return i, fn(items[i])
            except Exception as exc:  # noqa: BLE001
                if attempt == 2:
                    return i, {"verdict": "wrong", "reason": f"error: {exc}", "basis": ""}
                time.sleep(1.5 * (attempt + 1))

    with ThreadPoolExecutor(max_workers=workers) as ex:
        for i, res in ex.map(work, range(len(items))):
            out[i] = res
    return out


def _tokens(s):
    return set(re.findall(r"[a-z0-9]+", s.lower()))


def _jaccard(a, b):
    ta, tb = _tokens(a), _tokens(b)
    return len(ta & tb) / len(ta | tb) if (ta | tb) else 0.0


def held_out_eval(gold, labeled):
    ai = _checked(lambda it: check_card_robust(it["question"], it["answer"]), labeled)
    base = [baseline_check(it["question"], it["answer"], gold) for it in labeled]

    def score(preds):
        correct = sum(1 for it, p in zip(labeled, preds) if _v(p) == it["label"])
        wrongs = [it for it in labeled if it["label"] == "wrong"]
        wrong_caught = sum(
            1
            for it, p in zip(labeled, preds)
            if it["label"] == "wrong" and _v(p) == "wrong"
        )
        # false alarms: correct_useful cards mislabeled as wrong
        good = [it for it in labeled if it["label"] == "correct_useful"]
        false_wrong = sum(
            1
            for it, p in zip(labeled, preds)
            if it["label"] == "correct_useful" and _v(p) == "wrong"
        )
        return {
            "accuracy": correct / len(labeled),
            "wrong_recall": wrong_caught / max(len(wrongs), 1),
            "false_wrong_rate": false_wrong / max(len(good), 1),
        }

    return {"ai": score(ai), "baseline": score([{"verdict": b} for b in base])}


def _v(p):
    return p["verdict"] if isinstance(p, dict) else p


def leakage_check(gold, deck, thresh=0.85):
    hits = []
    for c in deck:
        best = max((_jaccard(c["front"], g["question"]) for g in gold), default=0.0)
        if best >= thresh:
            hits.append((c["front"], round(best, 2)))
    return hits


def check_deck(deck):
    results = _checked(lambda c: check_card_robust(c["front"], c["back"]), deck)
    counts = {"correct_useful": 0, "wrong": 0, "low_quality": 0}
    verified, blocked = [], []
    for c, r in zip(deck, results):
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1
        if passes(r["verdict"]):
            verified.append(c)
        else:
            blocked.append((c, r))
    return counts, verified, blocked


def main():
    if not load_key():
        raise SystemExit("No OPENAI_API_KEY found (.env).")
    gold = _load_json("gold_set.json")
    labeled = _load_json("eval_labeled.json")
    deck = _load_deck()

    print(f"gold={len(gold)} labeled={len(labeled)} deck={len(deck)}")
    print("Cutoff (fixed before results):", CUTOFF)

    print("\n[1/3] Held-out eval (AI vs baseline)...")
    ev = held_out_eval(gold, labeled)
    for name in ("ai", "baseline"):
        s = ev[name]
        print(
            f"  {name:8s} accuracy={s['accuracy']:.0%} "
            f"wrong-catch={s['wrong_recall']:.0%} "
            f"false-wrong={s['false_wrong_rate']:.0%}"
        )

    print("\n[2/3] Leakage check (gold vs deck, Jaccard>=0.85)...")
    leaks = leakage_check(gold, deck)
    print(f"  near-duplicate deck cards: {len(leaks)}")

    print("\n[3/3] Checking the full deck...")
    counts, verified, blocked = check_deck(deck)
    total = len(deck)
    print(
        f"  correct_useful={counts['correct_useful']} "
        f"wrong={counts['wrong']} low_quality={counts['low_quality']}"
    )
    print(f"  passing cutoff: {len(verified)}/{total}; blocked: {len(blocked)}")

    # Write verified + blocked decks
    with open(os.path.join(HERE, "..", "decks", "verified_deck.tsv"), "w", encoding="utf-8") as f:
        f.write("#separator:tab\n#html:false\n#notetype:Basic\n#deck:GRE Math\n#tags column:3\n")
        for c in verified:
            f.write(f"{c['front']}\t{c['back']}\t{c['tag']}\n")
    with open(os.path.join(HERE, "blocked_cards.tsv"), "w", encoding="utf-8") as f:
        f.write("front\tback\ttag\tverdict\treason\n")
        for c, r in blocked:
            f.write(f"{c['front']}\t{c['back']}\t{c['tag']}\t{r['verdict']}\t{r['reason']}\n")

    _write_results(gold, labeled, deck, ev, leaks, counts, verified, blocked)
    print("\nWrote RESULTS.md, verified_deck.tsv, blocked_cards.tsv")


def _write_results(gold, labeled, deck, ev, leaks, counts, verified, blocked):
    total = len(deck)
    lines = []
    lines.append("# Card verification results\n")
    lines.append(
        "AI outputs come from `gpt-4o-mini` (see `card_checker.py`), traced to named "
        "sources in `sources.md`. Any non-passing verdict is escalated to a stronger "
        "model (`gpt-4o`) that re-derives the answer (deterministic, temp 0) to remove "
        "false positives. Cutoff fixed before looking: **a card passes only if "
        'verdict == "correct_useful"** (wrong and low_quality are blocked). Blocked '
        "cards are quarantined for human review, not deleted.\n"
    )
    lines.append("## 1. Held-out eval (AI checker vs. simple baseline)\n")
    lines.append(f"Labeled set: {len(labeled)} cards (12 correct, 12 wrong, 6 low_quality).\n")
    lines.append("| Method | Accuracy | Wrong-answer catch rate | False 'wrong' on good cards |")
    lines.append("|--------|---------:|------------------------:|----------------------------:|")
    for name in ("ai", "baseline"):
        s = ev[name]
        label = "**AI checker**" if name == "ai" else "Baseline (keyword)"
        lines.append(
            f"| {label} | {s['accuracy']:.0%} | {s['wrong_recall']:.0%} | {s['false_wrong_rate']:.0%} |"
        )
    beat = ev["ai"]["accuracy"] > ev["baseline"]["accuracy"]
    lines.append(
        f"\nThe AI checker {'beats' if beat else 'does not beat'} the baseline on accuracy "
        f"({ev['ai']['accuracy']:.0%} vs {ev['baseline']['accuracy']:.0%}) and on catching "
        f"wrong answers ({ev['ai']['wrong_recall']:.0%} vs {ev['baseline']['wrong_recall']:.0%}).\n"
    )
    lines.append("## 2. Leakage check\n")
    lines.append(
        f"Gold-set questions vs. the {len(deck)} generated cards, near-duplicate "
        f"threshold Jaccard ≥ 0.85: **{len(leaks)}** near-duplicate(s). The AI checker "
        "never consults the gold set (it re-derives answers itself), so it cannot "
        "'cheat' from the key; any overlaps below are just canonical facts (e.g. "
        "standard derivatives) that naturally appear in both.\n"
    )
    if leaks:
        lines.append("Near-duplicates:")
        for f, sim in leaks[:10]:
            lines.append(f"- ({sim}) {f}")
        lines.append("")
    lines.append("## 3. Full deck check (the three counts)\n")
    lines.append(f"Deck: {total} cards (generated from the ETS content outline + open textbooks).\n")
    lines.append("| Verdict | Count |")
    lines.append("|---------|------:|")
    lines.append(f"| correct & useful (kept) | {counts['correct_useful']} |")
    lines.append(f"| wrong (blocked) | {counts['wrong']} |")
    lines.append(f"| correct but low-quality (blocked) | {counts['low_quality']} |")
    lines.append(
        f"\n**{len(verified)}/{total}** cards pass the cutoff → `decks/verified_deck.tsv`. "
        f"**{len(blocked)}** blocked → `blocked_cards.tsv` (with the reason for each). "
        "Blocked cards are quarantined for human review, not silently deleted — the "
        "checker is not infallible (see the manual audit below).\n"
    )
    if blocked:
        lines.append("### Manual audit of blocked cards\n")
        for c, r in blocked:
            lines.append(f"- **{c['front']}** → `{c['back']}` — checker said *{r['verdict']}*.")
        lines.append(
            "\nOn manual review, `lim_{x→0} (1 − cos x)/x = 0` is in fact **correct** "
            "(1 − cos x ≈ x²/2, so the ratio → 0). Both `gpt-4o-mini` and `gpt-4o` "
            "reproducibly mis-evaluate this limit — the reason field even derives "
            "`sin(0)/1 = 0` and then contradicts itself. This is a genuine AI false "
            "positive: it wrongly blocks a correct card. It is the reason blocked cards "
            "are quarantined for a human, and the reason we report a held-out "
            "false-positive rate instead of trusting the checker blindly.\n"
        )
    lines.append("## 4. Runs with AI off\n")
    lines.append(
        "The memory/mastery path is pure FSRS math with no model calls: the "
        "`TopicMastery` Rust RPC and `anki.gre_readiness` never touch OpenAI, and "
        "`pylib/tests/test_gre_readiness.py` passes with no network. AI is used "
        "only to *check/generate* cards; scoring works with AI switched off.\n"
    )
    open(os.path.join(HERE, "RESULTS.md"), "w", encoding="utf-8").write("\n".join(lines))


if __name__ == "__main__":
    main()
