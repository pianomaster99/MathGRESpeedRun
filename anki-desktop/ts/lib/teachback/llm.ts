// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

/**
 * Client for the Teach-Back LLM proxy server.
 *
 * The browser never talks to OpenAI directly (that would leak the API key), so
 * all calls go through the small local proxy in `teachback-server/`. If the
 * proxy or network is unavailable, we fall back to lightweight local heuristics
 * so the lesson still works end-to-end offline.
 */

import { writable } from "svelte/store";

import { getLesson } from "./lessons";
import type { LLMSummary } from "./state";
import type { AgentResult, FeedbackReport } from "./types";

/** Base URL of the proxy server. Overridable via Vite env for deployment. */
export const TEACHBACK_API: string = (import.meta as any)?.env?.VITE_TEACHBACK_API
    ?? "http://127.0.0.1:3999";

/**
 * Live status of the AI evaluator, surfaced in the UI so the user always knows
 * whether the real LLM is diagnosing their lesson or whether we've fallen back
 * to the basic offline checker.
 */
export const aiStatus = writable<{
    checked: boolean;
    online: boolean;
    hasKey: boolean;
    model?: string;
}>({ checked: false, online: false, hasKey: false });

/** Ping the proxy's /health endpoint to learn whether the AI is available. */
export async function checkHealth(): Promise<void> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${TEACHBACK_API}/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) {
            throw new Error(`health ${res.status}`);
        }
        const j = await res.json();
        aiStatus.set({ checked: true, online: true, hasKey: !!j.hasKey, model: j.model });
    } catch {
        aiStatus.set({ checked: true, online: false, hasKey: false });
    }
}

async function postJSON<T>(path: string, body: unknown, timeoutMs = 30000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${TEACHBACK_API}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (!res.ok) {
            throw new Error(`proxy responded ${res.status}`);
        }
        return (await res.json()) as T;
    } finally {
        clearTimeout(timer);
    }
}

function markStatus(source: "openai" | "offline" | undefined) {
    aiStatus.update((s) => ({
        ...s,
        checked: true,
        online: source === "openai" ? true : source === "offline" ? false : s.online,
        hasKey: source === "openai" ? true : source === "offline" ? false : s.hasKey,
    }));
}

/**
 * Run the mini classroom agent on the current board. Returns 0+ student
 * utterances (replies to greetings/questions, gap questions, drawing requests,
 * reinforcing questions).
 */
export async function runAgent(summary: LLMSummary): Promise<AgentResult> {
    try {
        const res = await postJSON<AgentResult>("/api/gap", summary, 30000);
        markStatus(res.source ?? "openai");
        return res;
    } catch (err) {
        console.warn("[teachback] agent fell back to local heuristic:", err);
        markStatus("offline");
        return localAgentHeuristic(summary);
    }
}

/** Generate the final structured feedback report. */
export async function generateFeedback(summary: LLMSummary): Promise<FeedbackReport> {
    try {
        const res = await postJSON<FeedbackReport>("/api/feedback", summary, 45000);
        markStatus(res.source ?? "openai");
        return res;
    } catch (err) {
        console.warn("[teachback] feedback fell back to local heuristic:", err);
        markStatus("offline");
        return localFeedbackHeuristic(summary);
    }
}

// --- Local fallbacks -------------------------------------------------------
// These are intentionally simple. They keep the experience usable without a
// network connection or API key, and mirror the JSON contract of the server.

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

function randomStudentId(summary: LLMSummary): string {
    const students = summary.students?.length
        ? summary.students
        : getLesson(summary.lessonId).students;
    return students[Math.floor(Math.random() * students.length)].id;
}

/**
 * Offline agent (lesson-agnostic): nudges with the lesson's own diagram hint if
 * it applies, otherwise asks one still-unused example question for this lesson.
 * It never fabricates topic-specific corrections.
 */
function localAgentHeuristic(summary: LLMSummary): AgentResult {
    const text = (summary.boardText ?? "").trim();
    const said = new Set(
        (summary.conversation ?? [])
            .filter((c) => c.role === "student")
            .map((c) => normalize(c.text)),
    );
    const emit = (t: string) => ({
        messages: [{ studentId: randomStudentId(summary), text: t, kind: "question" as const }],
        source: "offline" as const,
    });

    if (text.length < 25) {
        return { messages: [], source: "offline" };
    }
    const visual = summary.visual;
    if (visual && !summary.hasDrawing) {
        const bt = text.toLowerCase();
        if (visual.triggerWords.some((w) => bt.includes(w.toLowerCase()))) {
            const q = visual.request;
            if (!said.has(normalize(q))) {
                return emit(q);
            }
        }
    }
    for (const q of summary.exampleQuestions ?? []) {
        if (q && !said.has(normalize(q))) {
            return emit(q);
        }
    }
    return { messages: [], source: "offline" };
}

function localFeedbackHeuristic(summary: LLMSummary): FeedbackReport {
    const text = summary.boardText ?? "";

    const revisitedSteps = summary.workedExampleVisits.map((v) => v.step);
    const usage = summary.workedExampleVisits.length === 0
        ? "You taught the whole lesson without opening the worked example — nice independence!"
        : `You returned to the worked example ${summary.workedExampleVisits.length} time(s)`
            + (revisitedSteps.length
                ? `, most around: ${[...new Set(revisitedSteps)].join(", ")}. That's a good signal for what to review.`
                : ".");

    return {
        strengths: [
            text.length > 80
                ? "You wrote out your reasoning step by step."
                : "You engaged with the problem and started writing out your reasoning.",
            summary.hasDrawing
                ? "You added a diagram to make it visual."
                : "You worked through the problem on the board.",
        ],
        // Offline can't verify correctness for arbitrary topics — be honest.
        knowledgeGaps: [
            "The offline checker can't verify this topic in detail — start the LLM"
            + " proxy (with an OPENAI_API_KEY) for a line-by-line diagnosis.",
        ],
        suggestedReview: summary.suggestedReview?.length
            ? summary.suggestedReview
            : ["Review the worked example and try teaching it again."],
        workedExampleUsage: usage,
        source: "offline",
        encouragement:
            "This is offline feedback from a simple checker. Start the LLM proxy server for a much richer report — but great work teaching the lesson!",
    };
}
