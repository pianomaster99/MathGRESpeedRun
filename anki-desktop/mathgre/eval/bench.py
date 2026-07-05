# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""One-command performance benchmark for the GRE Math engine (assignment 7h/10).

Loads a large deck (default 50,000 cards, built by repeating the real deck) and
reports p50 / p95 / worst latency for the dashboard-powering actions:
  - the TopicMastery Rust RPC,
  - the full three-score compute (compute_scores),
  - a whole-collection card search.

Run:  ./out/pyenv/bin/python mathgre/eval/bench.py [N]
   or: just bench
Reports the median, 95th percentile, and worst case (never a single cherry-picked
number), per the spec.
"""

from __future__ import annotations

import os
import statistics
import sys
import tempfile
import time

from anki.collection import Collection, ImportCsvRequest
from anki.gre_readiness import compute_scores

HERE = os.path.dirname(os.path.abspath(__file__))
DECK = os.path.join(HERE, "..", "decks", "mathgre_sample.tsv")


def build_deck(n: int) -> str:
    rows = [
        line for line in open(DECK, encoding="utf-8")
        if line.strip() and not line.startswith("#")
    ]
    out = "#separator:tab\n#html:false\n#notetype:Basic\n#deck:GRE Math\n#tags column:3\n"
    body = []
    for i in range(n):
        front, back, tag = rows[i % len(rows)].rstrip("\n").split("\t")
        body.append(f"{front} #{i}\t{back}\t{tag}")
    fd, path = tempfile.mkstemp(prefix="gre_bench_", suffix=".tsv")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(out + "\n".join(body) + "\n")
    return path


def bench(label: str, fn, runs: int = 20) -> None:
    times = []
    for _ in range(runs):
        s = time.perf_counter()
        fn()
        times.append((time.perf_counter() - s) * 1000)
    times.sort()
    p50 = statistics.median(times)
    p95 = times[max(0, int(len(times) * 0.95) - 1)]
    worst = times[-1]
    print(f"{label:34s} p50={p50:7.1f}ms  p95={p95:7.1f}ms  worst={worst:7.1f}ms")


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 50000
    path = build_deck(n)
    col = Collection(os.path.join(tempfile.mkdtemp(), "bench.anki2"))
    t0 = time.time()
    meta = col.get_csv_metadata(path=path, delimiter=None)
    if not meta.WhichOneof("deck"):
        meta.deck_name = "GRE Math"
    col.import_csv(ImportCsvRequest(path=path, metadata=meta))
    total = len(col.find_cards(""))
    print(f"\nGRE Math engine benchmark — {total} cards (import took {time.time()-t0:.1f}s)\n")
    bench("TopicMastery RPC (Rust)", lambda: col.topic_mastery(0.9, "topic::"))
    bench("compute_scores (3 scores)", lambda: compute_scores(col))
    bench("whole-collection search", lambda: col.find_cards(""))
    print("\nTargets (dashboard): p95 < 1000ms first load, < 500ms refresh.")
    os.remove(path)
    col.close()


if __name__ == "__main__":
    main()
