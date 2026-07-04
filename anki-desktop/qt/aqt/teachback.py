# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""Launcher window for the Teach-Back (Math GRE) learning mode.

Opens the SvelteKit `/teach` route (served by the media server at
`/_anki/pages/teach`) inside a webview. This is a thin host around the web UI;
all lesson/LLM/feedback logic lives in the frontend (ts/lib/teachback and
ts/routes/teach) and the small proxy in teachback-server/.
"""

from __future__ import annotations

import json
from typing import Any

import aqt
from aqt.qt import *
from aqt.utils import disable_help_button, restoreGeom, saveGeom, setWindowIcon
from aqt.webview import AnkiWebView, AnkiWebViewKind

# Prefix for pycmd() messages sent by the Teach-Back web UI to record a finished
# lesson and get back updated topic-mastery stats.
_RECORD_PREFIX = "mathgre:record:"


class TeachBackDialog(QDialog):
    GEOMETRY_KEY = "teachback"
    silentlyClose = True

    def __init__(self, mw: aqt.AnkiQt) -> None:
        super().__init__(mw)
        self.mw = mw
        self.setWindowTitle("Teach-Back (Math GRE)")
        self.mw.garbage_collect_on_dialog_finish(self)
        self.setMinimumSize(820, 560)
        disable_help_button(self)
        restoreGeom(self, self.GEOMETRY_KEY, default_size=(1100, 760))
        setWindowIcon(self)

        self.web: AnkiWebView | None = AnkiWebView(kind=AnkiWebViewKind.DEFAULT)
        # Bridge: the web UI calls pycmd(_RECORD_PREFIX + json) when a lesson ends;
        # we record it into the collection and return the updated stats.
        self.web.set_bridge_command(self._on_bridge, self)
        self.web.load_sveltekit_page("teach")

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self.web)
        self.setLayout(layout)
        self.show()

    def _on_bridge(self, cmd: str) -> Any:
        if not cmd.startswith(_RECORD_PREFIX):
            return None
        try:
            payload = json.loads(cmd[len(_RECORD_PREFIX) :])
            from anki.gre_readiness import record_lesson_and_stats

            return record_lesson_and_stats(self.mw.col, payload)
        except Exception as exc:  # never let a bad message break the UI
            print("[mathgre] failed to record lesson result:", exc)
            return {"recorded": False, "error": str(exc)}

    def reject(self) -> None:
        if self.web:
            self.web.cleanup()
            self.web = None
        saveGeom(self, self.GEOMETRY_KEY)
        return QDialog.reject(self)
