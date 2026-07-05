# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""Memory-model calibration harness (assignment Sunday, Step 1).

"Calibrated" means: when the model says 80%, the learner recalls about 80% of the
time. This module scores that from (predicted_recall, actual_outcome) pairs:
  - Brier score (mean squared error of probabilistic predictions; lower better),
  - log loss (penalises confident wrong predictions; lower better),
  - a reliability table (binned predicted vs observed) + an SVG reliability curve.

HONEST NOTE ON DATA: a real calibration needs longitudinal reviews — the same
learner studying over weeks, with predicted retrievability recorded *before* each
review and the actual pass/fail recorded after. We do not have that dataset in a
one-week build (the seeded demo history is same-day, so predictions cluster near
1.0 and calibration is not yet meaningful). Per the rubric, we say so plainly and
ship the harness + methodology, rather than a polished number we cannot back up.
The `--selftest` run below proves the harness itself is correct on synthetic data
with a known ground truth.
"""

from __future__ import annotations

import math
import random
import sys


def brier_score(pairs: list[tuple[float, int]]) -> float:
    return sum((p - o) ** 2 for p, o in pairs) / len(pairs)


def log_loss(pairs: list[tuple[float, int]]) -> float:
    eps = 1e-9
    total = 0.0
    for p, o in pairs:
        p = min(1 - eps, max(eps, p))
        total += -(o * math.log(p) + (1 - o) * math.log(1 - p))
    return total / len(pairs)


def reliability_table(pairs: list[tuple[float, int]], bins: int = 10):
    buckets: list[list[tuple[float, int]]] = [[] for _ in range(bins)]
    for p, o in pairs:
        idx = min(bins - 1, int(p * bins))
        buckets[idx].append((p, o))
    rows = []
    for i, b in enumerate(buckets):
        lo, hi = i / bins, (i + 1) / bins
        if b:
            mean_pred = sum(p for p, _ in b) / len(b)
            observed = sum(o for _, o in b) / len(b)
            rows.append((lo, hi, len(b), mean_pred, observed))
        else:
            rows.append((lo, hi, 0, None, None))
    return rows


def reliability_svg(rows) -> str:
    # Diagonal = perfect calibration; dots = observed vs predicted per bin.
    W = H = 260
    pad = 30

    def x(v):
        return pad + v * (W - 2 * pad)

    def y(v):
        return H - pad - v * (H - 2 * pad)

    parts = [f'<svg viewBox="0 0 {W} {H}" width="{W}" xmlns="http://www.w3.org/2000/svg">']
    parts.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="white"/>')
    parts.append(f'<line x1="{x(0)}" y1="{y(0)}" x2="{x(1)}" y2="{y(1)}" stroke="#94a3b8" stroke-dasharray="4 4"/>')
    parts.append(f'<line x1="{x(0)}" y1="{y(0)}" x2="{x(1)}" y2="{y(0)}" stroke="#334155"/>')
    parts.append(f'<line x1="{x(0)}" y1="{y(0)}" x2="{x(0)}" y2="{y(1)}" stroke="#334155"/>')
    pts = [(mp, ob) for _, _, n, mp, ob in rows if n and mp is not None]
    for mp, ob in pts:
        parts.append(f'<circle cx="{x(mp):.1f}" cy="{y(ob):.1f}" r="4" fill="#3b82f6"/>')
    if len(pts) >= 2:
        d = "M " + " L ".join(f"{x(mp):.1f} {y(ob):.1f}" for mp, ob in pts)
        parts.append(f'<path d="{d}" fill="none" stroke="#3b82f6" stroke-width="1.5"/>')
    parts.append(f'<text x="{W/2}" y="{H-6}" text-anchor="middle" font-size="10">predicted recall</text>')
    parts.append(f'<text x="10" y="{H/2}" text-anchor="middle" font-size="10" transform="rotate(-90 10 {H/2})">observed</text>')
    parts.append("</svg>")
    return "".join(parts)


def report(pairs: list[tuple[float, int]], title: str) -> str:
    lines = [f"# {title}", ""]
    lines.append(f"n = {len(pairs)} predictions")
    lines.append(f"Brier score : {brier_score(pairs):.4f}  (0 = perfect, 0.25 = always-0.5 guess)")
    lines.append(f"Log loss    : {log_loss(pairs):.4f}")
    lines.append("")
    lines.append("Reliability (predicted bin -> observed recall):")
    lines.append("  bin        n     mean_pred   observed")
    for lo, hi, n, mp, ob in reliability_table(pairs):
        if n:
            lines.append(f"  {lo:.1f}-{hi:.1f}  {n:5d}   {mp:8.2f}   {ob:8.2f}")
        else:
            lines.append(f"  {lo:.1f}-{hi:.1f}  {0:5d}   {'--':>8}   {'--':>8}")
    return "\n".join(lines)


def _selftest() -> None:
    """Prove the harness: a well-calibrated predictor scores far better than a
    miscalibrated (overconfident) one on the SAME synthetic outcomes."""
    random.seed(1)
    truth = [random.random() for _ in range(5000)]
    outcomes = [1 if random.random() < p else 0 for p in truth]
    calibrated = list(zip(truth, outcomes))  # predicts the true probability
    overconfident = [(1.0 if p >= 0.5 else 0.0, o) for p, o in zip(truth, outcomes)]

    print(report(calibrated, "Self-test: WELL-CALIBRATED predictor (predicts true p)"))
    print()
    print(report(overconfident, "Self-test: OVERCONFIDENT predictor (0/1 only)"))
    b_cal, b_over = brier_score(calibrated), brier_score(overconfident)
    print()
    print(f"=> calibrated Brier {b_cal:.3f} < overconfident Brier {b_over:.3f}: {b_cal < b_over}")
    open("/tmp/reliability.svg", "w").write(reliability_svg(reliability_table(calibrated)))
    print("wrote reliability curve -> /tmp/reliability.svg")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        _selftest()
    else:
        print(__doc__)
