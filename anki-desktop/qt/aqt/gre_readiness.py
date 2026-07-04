# Copyright: Ankitects Pty Ltd and contributors
# License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

"""Desktop dashboard for the three GRE Math scores.

Shows the three SEPARATE scores the exam needs — MEMORY (FSRS recall),
PERFORMANCE (exam-style teaching accuracy), and READINESS (projected 200-990
score) — each with its own range and give-up rule, never blended into one number.
Everything is computed by ``anki.gre_readiness.compute_scores`` on top of the
``StatsService.TopicMastery`` Rust RPC, so this window is a thin view over the
shared engine. Rendered in an AnkiWebView for full CSS/SVG (and dark-mode).
"""

from __future__ import annotations

import html
import math

import aqt
from anki.gre_readiness import (
    MIN_COVERAGE,
    MIN_GRADED_REVIEWS,
    MIN_PERF_COVERAGE,
    MIN_PERF_LESSONS,
    ExamScores,
    Score,
    TopicReadiness,
    compute_scores,
)
from aqt.qt import *
from aqt.utils import (
    disable_help_button,
    qconnect,
    restoreGeom,
    saveGeom,
    setWindowIcon,
)
from aqt.webview import AnkiWebView, AnkiWebViewKind


class GreReadinessDialog(QDialog):
    GEOMETRY_KEY = "greReadiness"
    silentlyClose = True

    def __init__(self, mw: aqt.AnkiQt) -> None:
        super().__init__(mw)
        self.mw = mw
        self.setWindowTitle("GRE Math Readiness")
        self.mw.garbage_collect_on_dialog_finish(self)
        self.setMinimumSize(640, 540)
        disable_help_button(self)
        restoreGeom(self, self.GEOMETRY_KEY, default_size=(820, 760))
        setWindowIcon(self)

        self.web = AnkiWebView(parent=self, kind=AnkiWebViewKind.DEFAULT)
        self.web.set_bridge_command(self._on_bridge, self)

        refresh = QPushButton("Refresh")
        qconnect(refresh.clicked, self.refresh)

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self.web, 1)
        buttons = QHBoxLayout()
        buttons.setContentsMargins(10, 6, 10, 10)
        buttons.addStretch(1)
        buttons.addWidget(refresh)
        layout.addLayout(buttons)
        self.setLayout(layout)

        self.refresh()
        self.show()

    def _on_bridge(self, cmd: str) -> None:
        if cmd == "close":
            self.reject()
        elif cmd == "refresh":
            self.refresh()

    def refresh(self) -> None:
        try:
            scores = compute_scores(self.mw.col)
            body = _render_html(scores)
        except Exception as exc:  # pragma: no cover - defensive UI guard
            body = f"<p style='padding:20px'>Could not compute scores: {html.escape(str(exc))}</p>"
        self.web.stdHtml(body, css=[], js=[])

    def reject(self) -> None:
        saveGeom(self, self.GEOMETRY_KEY)
        return QDialog.reject(self)


# --- rendering helpers ------------------------------------------------------

def _pct(x: float | None) -> str:
    return "—" if x is None else f"{x * 100:.0f}%"


def _level_color(x: float | None) -> str:
    if x is None:
        return "#94a3b8"
    if x >= 0.85:
        return "#16a34a"
    if x >= 0.6:
        return "#d97706"
    return "#dc2626"


def _semicircle_path(cx: float, cy: float, r: float, f0: float, f1: float) -> str:
    f0 = max(0.0, min(1.0, f0))
    f1 = max(0.0, min(1.0, f1))

    def pt(f: float) -> tuple[float, float]:
        a = math.pi * (1 - f)
        return (cx + r * math.cos(a), cy - r * math.sin(a))

    x0, y0 = pt(f0)
    x1, y1 = pt(f1)
    return f"M {x0:.2f} {y0:.2f} A {r} {r} 0 0 1 {x1:.2f} {y1:.2f}"


def _gauge_svg(s: Score) -> str:
    """0-1 gauge for the memory / performance scores, with the range band."""
    cx, cy, rad, sw = 110.0, 112.0, 88.0, 18.0
    track = _semicircle_path(cx, cy, rad, 0, 1)
    parts = [
        '<svg viewBox="0 0 220 132" width="100%" style="max-width:240px">',
        f'<path d="{track}" fill="none" stroke="var(--track)" stroke-width="{sw}" stroke-linecap="round"/>',
    ]
    if s.abstained or s.value is None:
        parts.append(
            f'<text x="{cx}" y="{cy - 10}" text-anchor="middle" font-size="26" '
            'font-weight="800" fill="var(--muted)">🔒</text>'
        )
        parts.append(
            f'<text x="{cx}" y="{cy + 12}" text-anchor="middle" font-size="12" '
            'fill="var(--muted)">no score yet</text>'
        )
    else:
        color = _level_color(s.value)
        band = _semicircle_path(cx, cy, rad, s.low or 0, s.high or 0)
        value = _semicircle_path(cx, cy, rad, 0, s.value)
        parts.append(
            f'<path d="{band}" fill="none" stroke="{color}" stroke-opacity="0.28" '
            f'stroke-width="{sw}" stroke-linecap="round"/>'
        )
        parts.append(
            f'<path d="{value}" fill="none" stroke="{color}" stroke-width="{sw}" '
            'stroke-linecap="round"/>'
        )
        parts.append(
            f'<text x="{cx}" y="{cy - 4}" text-anchor="middle" font-size="34" '
            f'font-weight="800" fill="{color}">{_pct(s.value)}</text>'
        )
        parts.append(
            f'<text x="{cx}" y="{cy + 15}" text-anchor="middle" font-size="12" '
            f'fill="var(--muted)">likely {_pct(s.low)}–{_pct(s.high)}</text>'
        )
    parts.append("</svg>")
    return "".join(parts)


def _score_card(title: str, subtitle: str, s: Score) -> str:
    return (
        '<div class="card score-card">'
        f'<div class="score-title">{title}</div>'
        f'<div class="score-sub">{html.escape(subtitle)}</div>'
        f"{_gauge_svg(s)}"
        f'<span class="pill {html.escape(s.confidence)}">confidence: {html.escape(s.confidence)}</span>'
        "</div>"
    )


def _readiness_card(x: ExamScores) -> str:
    r = x.readiness
    if r.abstained or r.scaled is None:
        body = (
            '<div class="rbig muted">🔒 no score yet</div>'
            f'<div class="rrange">{html.escape(r.reason)}</div>'
        )
    else:
        frac = (r.scaled - _SCALE_MIN) / max(_SCALE_MAX - _SCALE_MIN, 1)
        color = _level_color(frac)
        body = (
            f'<div class="rbig" style="color:{color}">{r.scaled}</div>'
            f'<div class="rrange">likely {r.scaled_low}–{r.scaled_high} '
            f'· scale {_SCALE_MIN}–{_SCALE_MAX}</div>'
            '<div class="rwarn">⚠ projection not yet validated against real outcomes</div>'
        )
    return (
        '<div class="card score-card readiness">'
        '<div class="score-title">Readiness</div>'
        '<div class="score-sub">projected exam score</div>'
        f"{body}"
        f'<span class="pill {html.escape(r.confidence)}">confidence: {html.escape(r.confidence)}</span>'
        "</div>"
    )


def _donut_svg(coverage: float) -> str:
    cx, cy, rad, sw = 55.0, 55.0, 42.0, 13.0
    circ = 2 * math.pi * rad
    dash = coverage * circ
    color = "#3b82f6" if coverage >= MIN_COVERAGE else "#94a3b8"
    return (
        '<svg viewBox="0 0 110 110" width="104" height="104">'
        f'<circle cx="{cx}" cy="{cy}" r="{rad}" fill="none" stroke="var(--track)" stroke-width="{sw}"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{rad}" fill="none" stroke="{color}" stroke-width="{sw}" '
        f'stroke-linecap="round" stroke-dasharray="{dash:.2f} {circ - dash:.2f}" '
        f'transform="rotate(-90 {cx} {cy})"/>'
        f'<text x="{cx}" y="{cy + 2}" text-anchor="middle" font-size="20" font-weight="800" '
        f'fill="var(--fg)">{_pct(coverage)}</text>'
        f'<text x="{cx}" y="{cy + 18}" text-anchor="middle" font-size="9" fill="var(--muted)">coverage</text>'
        "</svg>"
    )


def _progress(label: str, frac: float, detail: str) -> str:
    frac = max(0.0, min(1.0, frac))
    done = frac >= 1.0
    color = "#16a34a" if done else "#3b82f6"
    tick = " ✓" if done else ""
    return (
        '<div class="prog">'
        f'<div class="prog-top"><span>{html.escape(label)}{tick}</span>'
        f'<span class="prog-detail">{html.escape(detail)}</span></div>'
        f'<div class="track"><div class="fill" style="width:{frac * 100:.0f}%;background:{color}"></div></div>'
        "</div>"
    )


def _topic_row(t: TopicReadiness) -> str:
    weight = f"{t.exam_weight * 100:.0f}%"
    if t.combined is None:
        bar = '<div class="track"><div class="empty">no data</div></div>'
        right = "—"
    else:
        color = _level_color(t.combined)
        bar = (
            '<div class="track">'
            f'<div class="fill" style="width:{t.combined * 100:.0f}%;background:{color}"></div>'
            "</div>"
        )
        right = _pct(t.combined)
    name = html.escape(t.topic.replace("-", " "))
    mem = _pct(t.average_recall) if t.covered else "—"
    teach = _pct(t.teach_score) if t.teach_score is not None else "—"
    taught = f" · taught {t.teach_count}×" if t.teach_count else ""
    return (
        '<div class="topic">'
        f'<div class="tname">{name}<span class="wt">exam {weight}</span></div>'
        f'<div class="tbar">{bar}</div>'
        f'<div class="tright"><span class="recall">{right}</span>'
        f'<span class="mastered">🧠 {mem} · 🎓 {teach}{taught}</span></div>'
        "</div>"
    )


_SCALE_MIN = 200
_SCALE_MAX = 990

_STYLE = """
<style>
:root{
  --bg:transparent; --panel:#ffffff; --panel-2:#f8fafc; --fg:#0f172a;
  --muted:#64748b; --border:#e2e8f0; --track:#e5e7eb; --accent:#3b82f6;
}
.night-mode{
  --panel:#1e293b; --panel-2:#172033; --fg:#e2e8f0; --muted:#94a3b8;
  --border:#334155; --track:#334155; --accent:#60a5fa;
}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
.wrap{max-width:900px;margin:0 auto;padding:18px 16px 26px;}
h1{font-size:1.25rem;margin:0;}
.sub{color:var(--muted);font-size:.85rem;margin:2px 0 14px;}
.card{background:var(--panel);border:1px solid var(--border);border-radius:14px;
  padding:14px 16px;margin-bottom:14px;}
.three{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;}
.three .card{flex:1 1 200px;margin-bottom:0;text-align:center;
  display:flex;flex-direction:column;align-items:center;justify-content:flex-start;}
.score-title{font-weight:800;font-size:1rem}
.score-sub{color:var(--muted);font-size:.75rem;margin-bottom:4px}
.rbig{font-size:2.6rem;font-weight:800;line-height:1.1;margin:14px 0 2px}
.rbig.muted{font-size:1.3rem;color:var(--muted)}
.rrange{color:var(--muted);font-size:.82rem;line-height:1.4}
.rwarn{color:#b45309;font-size:.72rem;margin-top:6px}
.night-mode .rwarn{color:#fcd97a}
.pill{display:inline-block;margin-top:8px;font-size:.68rem;font-weight:800;
  text-transform:uppercase;letter-spacing:.04em;padding:.2rem .55rem;border-radius:999px;}
.pill.high{background:#dcfce7;color:#166534}
.pill.medium{background:#fef9c3;color:#854d0e}
.pill.low{background:#fee2e2;color:#991b1b}
.pill.none{background:#f1f5f9;color:#475569}
.banner{border-radius:12px;padding:11px 14px;margin-bottom:14px;font-size:.9rem;line-height:1.5}
.banner.warn{background:#fff4e5;border:1px solid #f0c26b;color:#8a5a00}
.night-mode .banner.warn{background:#3b2f14;color:#fcd97a;border-color:#7c5e1e}
.covrow{display:flex;align-items:center;gap:16px}
.covrow .meta .big{font-weight:700}
.covrow .meta .small{color:var(--muted);font-size:.84rem;line-height:1.5;margin-top:4px}
h3{font-size:1rem;margin:0 0 10px}
.prog{margin:10px 0}
.prog-top{display:flex;justify-content:space-between;font-size:.84rem;font-weight:600;margin-bottom:4px}
.prog-detail{color:var(--muted);font-weight:500}
.track{position:relative;height:12px;border-radius:999px;background:var(--track);overflow:hidden}
.fill{height:100%;border-radius:999px}
.empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.68rem;color:var(--muted)}
.next{background:var(--panel-2);border-style:dashed}
.next b{color:var(--accent)}
.topic{display:grid;grid-template-columns:1fr;gap:4px;padding:9px 0;border-bottom:1px solid var(--border)}
.topic:last-child{border-bottom:none}
.tname{display:flex;align-items:center;gap:8px;font-weight:600;text-transform:capitalize}
.tname .wt{font-size:.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
.tright{display:flex;justify-content:space-between;font-size:.78rem;color:var(--muted)}
.tright .recall{font-weight:700;color:var(--fg)}
.foot{color:var(--muted);font-size:.8rem;line-height:1.5;margin-top:6px}
.foot code{background:var(--panel-2);padding:0 .3rem;border-radius:4px}
</style>
"""


def _render_html(x: ExamScores) -> str:
    memory_card = _score_card("Memory", "recall a known fact", x.memory)
    perf_card = _score_card("Performance", "answer a new question", x.performance)
    readiness_card = _readiness_card(x)

    banner = (
        '<div class="banner warn"><b>Honest scoring:</b> three separate scores, each '
        "with its own range and give-up rule. Readiness is a projection on the "
        f"{_SCALE_MIN}–{_SCALE_MAX} scale and is not yet validated against real outcomes.</div>"
    )

    unlock = (
        '<div class="card"><h3>Progress to honest scores</h3>'
        + _progress(
            "Memory — graded reviews",
            x.graded_reviews / MIN_GRADED_REVIEWS,
            f"{x.graded_reviews} / {MIN_GRADED_REVIEWS}",
        )
        + _progress(
            "Memory/Readiness — topic coverage",
            x.coverage / MIN_COVERAGE,
            f"{_pct(x.coverage)} / {MIN_COVERAGE:.0%}",
        )
        + _progress(
            "Performance — graded lessons",
            x.lessons_verified / MIN_PERF_LESSONS,
            f"{x.lessons_verified} / {MIN_PERF_LESSONS}",
        )
        + "</div>"
    )

    weakest = (
        f'<div class="card next">🎯 <b>Study next:</b> '
        f'{html.escape(x.weakest_topic.replace("-", " "))}</div>'
        if x.weakest_topic
        else ""
    )

    topic_rows = "".join(
        _topic_row(t) for t in sorted(x.topics, key=lambda t: -t.exam_weight)
    )

    cov = (
        '<div class="card covrow">'
        + _donut_svg(x.coverage)
        + '<div class="meta"><div class="big">Exam coverage</div>'
        + f'<div class="small">Your deck covers {_pct(x.coverage)} of the exam by weight · '
        f"{x.graded_reviews} graded reviews · {x.lessons_verified} graded lessons. "
        "Uncovered high-weight topics pull every score down.</div></div></div>"
    )

    disclaimer = (
        '<div class="foot"><b>Memory</b> = can you recall a fact (FSRS). '
        "<b>Performance</b> = can you answer a new exam-style problem (from Teach-Back "
        "lessons). <b>Readiness</b> = projected scaled score. Tag notes as "
        "<code>topic::calculus</code>, <code>topic::linear-algebra</code>, etc.</div>"
    )

    return (
        _STYLE
        + '<div class="wrap">'
        + '<div class="head"><h1>GRE Mathematics Subject Test</h1>'
        '<div class="sub">Three scores · computed from your FSRS + Teach-Back data · no AI</div></div>'
        + banner
        + f'<div class="three">{memory_card}{perf_card}{readiness_card}</div>'
        + cov
        + unlock
        + weakest
        + f'<div class="card"><h3>Topics</h3>{topic_rows}</div>'
        + disclaimer
        + "</div>"
    )
