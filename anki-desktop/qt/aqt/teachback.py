# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""Launcher window for the Teach-Back (Math GRE) learning mode.

Opens the SvelteKit `/teach` route (served by the media server at
`/_anki/pages/teach`) inside a webview. This is a thin host around the web UI;
all lesson/LLM/feedback logic lives in the frontend (ts/lib/teachback and
ts/routes/teach) and the small proxy in teachback-server/.
"""

from __future__ import annotations

import aqt
from aqt.qt import *
from aqt.utils import disable_help_button, restoreGeom, saveGeom, setWindowIcon
from aqt.webview import AnkiWebView, AnkiWebViewKind


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
        self.web.load_sveltekit_page("teach")

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self.web)
        self.setLayout(layout)
        self.show()

    def reject(self) -> None:
        if self.web:
            self.web.cleanup()
            self.web = None
        saveGeom(self, self.GEOMETRY_KEY)
        return QDialog.reject(self)
