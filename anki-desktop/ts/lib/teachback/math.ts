// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

/**
 * LaTeX rendering for the Teach-Back UI.
 *
 * KaTeX (and its fonts/CSS) is bundled with the app rather than loaded from a
 * CDN, so math renders correctly inside Anki's webview — where an external CDN
 * is blocked by the content-security-policy — and fully offline. Callers fall
 * back to showing the raw LaTeX source only if a specific expression fails.
 */

import katex from "katex";
import { writable } from "svelte/store";

// Bundling KaTeX's stylesheet pulls in its @font-face fonts through Vite, so
// the glyphs are served from the app itself (no network needed).
import "katex/dist/katex.min.css";

// KaTeX is always available (bundled), so this is immediately "ready". Kept as a
// store so existing components can depend on it without changes.
export const katexReady = writable(true);

/** No-op: KaTeX is bundled and ready. Kept for API compatibility. */
export function ensureKatex(): void {}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/** Render a LaTeX string to HTML, falling back to escaped source on error. */
export function renderMathToString(tex: string, displayMode = false): string {
    try {
        return katex.renderToString(tex, {
            displayMode,
            throwOnError: false,
            output: "html",
        });
    } catch {
        return `<code class="raw-tex">${escapeHtml(tex)}</code>`;
    }
}
