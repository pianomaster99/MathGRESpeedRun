# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""Desktop UI for the per-topic Mastery summary.

A direct view over the ``StatsService.TopicMastery`` Rust RPC: every topic (note
tag) with its mastered count, a progress bar, and average predicted recall.
Interactive tag-prefix + mastery-threshold controls call straight into the
shared engine.
"""

from __future__ import annotations

import html

import aqt
from aqt.qt import *
from aqt.utils import (
    disable_help_button,
    qconnect,
    restoreGeom,
    saveGeom,
    setWindowIcon,
)


class TopicMasteryDialog(QDialog):
    GEOMETRY_KEY = "topicMastery"
    silentlyClose = True

    def __init__(self, mw: aqt.AnkiQt) -> None:
        super().__init__(mw)
        self.mw = mw
        self.setWindowTitle("Topic Mastery")
        self.mw.garbage_collect_on_dialog_finish(self)
        self.setMinimumSize(560, 460)
        disable_help_button(self)
        restoreGeom(self, self.GEOMETRY_KEY, default_size=(720, 620))
        setWindowIcon(self)

        self.prefix = QLineEdit("topic::")
        self.threshold = QDoubleSpinBox()
        self.threshold.setRange(0.0, 1.0)
        self.threshold.setSingleStep(0.05)
        self.threshold.setValue(0.9)
        refresh = QPushButton("Refresh")
        qconnect(refresh.clicked, self.refresh)
        qconnect(self.prefix.returnPressed, self.refresh)

        controls = QHBoxLayout()
        controls.addWidget(QLabel("Tag prefix:"))
        controls.addWidget(self.prefix)
        controls.addWidget(QLabel("Mastered \u2265"))
        controls.addWidget(self.threshold)
        controls.addWidget(refresh)
        controls.addStretch()

        self.view = QTextBrowser()

        layout = QVBoxLayout()
        layout.addLayout(controls)
        layout.addWidget(self.view)
        self.setLayout(layout)

        self.refresh()
        self.show()

    def refresh(self) -> None:
        try:
            resp = self.mw.col.topic_mastery(self.threshold.value(), self.prefix.text())
            self.view.setHtml(_render(resp))
        except Exception as exc:  # pragma: no cover - defensive UI guard
            self.view.setHtml(f"<p>Could not load mastery: {html.escape(str(exc))}</p>")

    def reject(self) -> None:
        saveGeom(self, self.GEOMETRY_KEY)
        return QDialog.reject(self)


def _bar(frac: float) -> str:
    pct = max(0, min(100, round(frac * 100)))
    color = "#16a34a" if pct >= 75 else "#d97706" if pct >= 40 else "#dc2626"
    return (
        "<div style='background:#e5e7eb;border-radius:4px;width:140px;height:10px'>"
        f"<div style='background:{color};width:{pct}%;height:10px;border-radius:4px'></div>"
        "</div>"
    )


def _render(resp) -> str:
    # Weakest topics first, so the next thing to study is at the top.
    topics = sorted(resp.topics, key=lambda t: (t.mastered / t.total if t.total else 0.0))
    if not topics:
        return (
            "<p style='font-family:sans-serif'>No cards found for that tag prefix. "
            "Tag notes like <code>topic::calculus</code>, or clear the prefix to "
            "treat every tag as a topic.</p>"
        )

    rows = []
    for t in topics:
        frac = t.mastered / t.total if t.total else 0.0
        rows.append(
            "<tr>"
            f"<td>{html.escape(t.topic)}</td>"
            f"<td style='text-align:center'>{t.mastered}/{t.total}</td>"
            f"<td>{_bar(frac)}</td>"
            f"<td style='text-align:center'>{frac * 100:.0f}%</td>"
            f"<td style='text-align:center'>{t.average_recall * 100:.0f}%</td>"
            "</tr>"
        )

    overall = resp.mastered_total / resp.card_total if resp.card_total else 0.0
    return (
        "<div style='font-family:sans-serif'>"
        "<h2 style='margin:0 0 4px'>Topic mastery</h2>"
        f"<p style='margin:0 0 10px'>Overall: <b>{resp.mastered_total}/{resp.card_total}</b>"
        f" cards mastered ({overall * 100:.0f}%).</p>"
        "<table width='100%' cellspacing='0' cellpadding='6' style='border-collapse:collapse'>"
        "<tr style='font-weight:bold;border-bottom:1px solid #888'>"
        "<td>Topic</td><td>Mastered</td><td>Progress</td><td>%</td><td>Avg recall</td></tr>"
        + "".join(rows)
        + "</table>"
        "<p style='color:#666;font-size:0.85em'>\u201cMastered\u201d = predicted FSRS recall "
        "\u2265 the threshold. Weakest topics are listed first.</p>"
        "</div>"
    )
