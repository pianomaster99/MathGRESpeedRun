// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

/**
 * Bridge from the Teach-Back web UI to the Anki desktop backend.
 *
 * When Teach-Back runs inside Anki, every page gets a `pycmd` bridge injected by
 * AnkiWebView. We use it to record a finished lesson into the collection and get
 * back the updated topic-mastery stats (handled by TeachBackDialog._on_bridge ->
 * anki.gre_readiness.record_lesson_and_stats). In the standalone dev server or a
 * plain mobile browser there is no `pycmd`, so these calls no-op and return null.
 */

import type { LessonStats } from "./types";

const RECORD_PREFIX = "mathgre:record:";

type PyCmd = (arg: string, cb?: (res: unknown) => void) => unknown;

function pycmd(): PyCmd | null {
    const fn = (globalThis as any)?.pycmd;
    return typeof fn === "function" ? (fn as PyCmd) : null;
}

/** True when running inside the Anki app (backend recording is available). */
export function ankiAvailable(): boolean {
    return pycmd() !== null;
}

export interface LessonResultPayload {
    lessonId: string;
    /** Mastery topic slug, or null for warm-ups with no graded topic. */
    slug: string | null;
    topic: string;
    gaps: number;
    strengths: number;
    /** Whether the feedback came from the real LLM evaluator (vs offline). */
    verified: boolean;
}

/**
 * Record a finished lesson and resolve with the updated stats, or null when the
 * backend isn't reachable (dev/mobile) or the call fails.
 */
export function recordLesson(payload: LessonResultPayload): Promise<LessonStats | null> {
    const cmd = pycmd();
    if (!cmd) {
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 8000);
        try {
            cmd(RECORD_PREFIX + JSON.stringify(payload), (res: unknown) => {
                clearTimeout(timer);
                const r = res as LessonStats | null;
                resolve(r && (r as any).recorded ? r : null);
            });
        } catch {
            clearTimeout(timer);
            resolve(null);
        }
    });
}
