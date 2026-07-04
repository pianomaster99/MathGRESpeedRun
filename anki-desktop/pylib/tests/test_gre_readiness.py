# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

from anki.gre_readiness import compute_memory_readiness
from tests.shared import getEmptyCol


def test_abstains_without_enough_data():
    """The give-up rule must fire on an empty collection (also exercises the
    TopicMastery Rust RPC end to end through the Python wrapper)."""
    col = getEmptyCol()
    r = compute_memory_readiness(col)
    assert r.abstained is True
    assert r.score is None
    assert r.low is None and r.high is None
    assert r.confidence == "none"
    assert r.coverage == 0.0
    assert r.graded_reviews == 0
    assert len(r.topics) > 0
    assert all(not t.covered for t in r.topics)


def test_coverage_reflects_tagged_cards():
    """Adding calculus cards marks that topic covered (still abstains overall
    until the coverage/review thresholds are met)."""
    col = getEmptyCol()
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
    assert r.abstained is True  # not enough reviews/coverage yet -> honest abstain
