# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""Tests for the honest memory-readiness signal + give-up rule.

Run (after a build) from the anki-desktop directory, e.g.:
    ./out/pyenv/bin/pytest mathgre/test_readiness.py
"""

import os
import tempfile

import anki.collection

from mathgre.readiness import compute_memory_readiness


def _new_col() -> anki.collection.Collection:
    directory = tempfile.mkdtemp()
    return anki.collection.Collection(os.path.join(directory, "col.anki2"))


def test_abstains_without_enough_data():
    """The give-up rule must fire on an empty collection (also exercises the
    new TopicMastery Rust RPC end to end)."""
    col = _new_col()
    try:
        r = compute_memory_readiness(col)
        assert r.abstained is True
        assert r.score is None
        assert r.low is None and r.high is None
        assert r.confidence == "none"
        assert r.coverage == 0.0
        assert r.graded_reviews == 0
        # Every GRE Math topic should be reported as uncovered.
        assert len(r.topics) > 0
        assert all(not t.covered for t in r.topics)
    finally:
        col.close()


def test_coverage_reflects_tagged_cards():
    """Adding calculus cards should mark that topic covered (still abstains
    overall until the coverage/reviews thresholds are met)."""
    col = _new_col()
    try:
        for i in range(3):
            note = col.newNote()
            note["Front"] = f"q{i}"
            note["Back"] = f"a{i}"
            note.tags.append("topic::calculus")
            col.addNote(note)
        r = compute_memory_readiness(col)
        calc = next(t for t in r.topics if t.topic == "calculus")
        assert calc.covered is True
        assert calc.total_cards == 3
        # Not enough reviews/coverage yet -> still abstains, honestly.
        assert r.abstained is True
    finally:
        col.close()
