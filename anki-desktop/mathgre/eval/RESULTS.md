# Card verification results

AI outputs come from `gpt-4o-mini` (see `card_checker.py`), traced to named sources in `sources.md`. Any non-passing verdict is escalated to a stronger model (`gpt-4o`) that re-derives the answer (deterministic, temp 0) to remove false positives. Cutoff fixed before looking: **a card passes only if verdict == "correct_useful"** (wrong and low_quality are blocked). Blocked cards are quarantined for human review, not deleted.

## 1. Held-out eval (AI checker vs. simple baseline)

Labeled set: 30 cards (12 correct, 12 wrong, 6 low_quality).

| Method | Accuracy | Wrong-answer catch rate | False 'wrong' on good cards |
|--------|---------:|------------------------:|----------------------------:|
| **AI checker** | 90% | 100% | 0% |
| Baseline (keyword) | 23% | 8% | 17% |

The AI checker beats the baseline on accuracy (90% vs 23%) and on catching wrong answers (100% vs 8%).

## 2. Leakage check

Gold-set questions vs. the 156 generated cards, near-duplicate threshold Jaccard ≥ 0.85: **6** near-duplicate(s). The AI checker never consults the gold set (it re-derives answers itself), so it cannot "cheat" from the key; the overlaps below are just canonical facts (e.g. standard derivatives) that naturally appear in both.

Near-duplicates:
- (1.0) d/dx[tan x] = ?
- (1.0) d/dx[ln x] = ?
- (1.0) d/dx[e^x] = ?
- (1.0) d/dx[arctan x] = ?
- (1.0) ∫ 1/(1 + x^2) dx = ?
- (1.0) ∫ e^x dx = ?

## 3. Full deck check (the three counts)

Deck: 156 cards (generated from the ETS content outline + open textbooks).

| Verdict | Count |
|---------|------:|
| correct & useful (kept) | 155 |
| wrong (blocked) | 1 |
| correct but low-quality (blocked) | 0 |

**155/156** cards pass the cutoff → `decks/verified_deck.tsv`. **1** blocked → `blocked_cards.tsv` (with the reason for each). Blocked cards are quarantined for human review, not silently deleted — the checker is not infallible (see the manual audit below).

### Manual audit of blocked cards

- **Evaluate lim_{x→0} (1 − cos x)/x.** → `0` — checker said *wrong*.

On manual review, `lim_{x→0} (1 − cos x)/x = 0` is in fact **correct** (1 − cos x ≈ x²/2, so the ratio → 0). Both `gpt-4o-mini` and `gpt-4o` reproducibly mis-evaluate this limit — the reason field even derives `sin(0)/1 = 0` and then contradicts itself. This is a genuine AI false positive: it wrongly blocks a correct card. It is the reason blocked cards are quarantined for a human, and the reason we report a held-out false-positive rate instead of trusting the checker blindly.

## 4. Runs with AI off

The memory/mastery path is pure FSRS math with no model calls: the `TopicMastery` Rust RPC and `anki.gre_readiness` never touch OpenAI, and `pylib/tests/test_gre_readiness.py` passes with no network. AI is used only to *check/generate* cards; scoring works with AI switched off.
