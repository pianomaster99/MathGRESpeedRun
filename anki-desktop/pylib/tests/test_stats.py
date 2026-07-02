# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

import os
import tempfile

from anki.collection import CardStats
from tests.shared import getEmptyCol


def test_stats():
    col = getEmptyCol()
    note = col.newNote()
    note["Front"] = "foo"
    col.addNote(note)
    c = note.cards()[0]
    # card stats
    card_stats = col.card_stats_data(c.id)
    assert card_stats.note_id == note.id
    c = col.sched.getCard()
    col.sched.answerCard(c, 3)
    col.sched.answerCard(c, 2)
    card_stats = col.card_stats_data(c.id)
    assert len(card_stats.revlog) == 2


def test_topic_mastery():
    # Exercises the new Rust backend RPC (StatsService.TopicMastery) end to end.
    col = getEmptyCol()
    note = col.newNote()
    note["Front"] = "foo"
    note.tags.append("topic::calculus")
    col.addNote(note)

    res = col.topic_mastery(0.9, "topic::")
    assert res.card_total == 1
    # A brand-new card has no FSRS memory state -> recall 0 -> not mastered.
    assert res.mastered_total == 0
    assert len(res.topics) == 1
    assert res.topics[0].topic == "calculus"
    assert res.topics[0].total == 1
    assert res.topics[0].mastered == 0


def test_graphs_empty():
    col = getEmptyCol()
    assert col.stats().report()


def test_graphs():
    dir = tempfile.gettempdir()
    col = getEmptyCol()
    g = col.stats()
    rep = g.report()
    with open(os.path.join(dir, "test.html"), "w", encoding="UTF-8") as note:
        note.write(rep)
    return
