// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

/**
 * Lightweight LaTeX rendering for the Teach-Back UI.
 *
 * Anki's built-in MathJax pipeline is served by the Rust backend, which isn't
 * always running for this standalone feature. To keep the classroom
 * self-contained we lazily load KaTeX from a CDN and expose a tiny reactive
 * "ready" flag so components can re-render once it is available. If KaTeX cannot
 * be loaded, callers fall back to showing the raw LaTeX source.
 */

import { writable } from "svelte/store";

export const katexReady = writable(false);

let started = false;

/** Inject the KaTeX stylesheet + script once, on first use. */
export function ensureKatex(): void {
    if (started || typeof document === "undefined") {
        return;
    }
    started = true;
    if ((window as any).katex) {
        katexReady.set(true);
        return;
    }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
    script.defer = true;
    script.onload = () => katexReady.set(true);
    script.onerror = () => console.warn("[teachback] KaTeX failed to load; showing raw LaTeX");
    document.head.appendChild(script);
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/** Render a LaTeX string to HTML, falling back to escaped source. */
export function renderMathToString(tex: string, displayMode = false): string {
    const katex = (window as any)?.katex;
    if (katex) {
        try {
            return katex.renderToString(tex, {
                displayMode,
                throwOnError: false,
                output: "html",
            });
        } catch {
            // fall through to raw
        }
    }
    return `<code class="raw-tex">${escapeHtml(tex)}</code>`;
}
