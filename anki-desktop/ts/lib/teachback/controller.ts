// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

/**
 * Orchestration shared by the desktop and mobile classrooms.
 *
 * There is a single trigger: the user posts to the board (presses Enter). That
 * runs the mini classroom agent once on the whole board (screenshot + text +
 * conversation), which may return several student utterances — a reply to a
 * greeting/question written on the board, a question about a missing/unclear/
 * wrong step, a request to draw the triangle, and/or a question reinforcing a
 * crucial correct step. We add whatever it returns to the conversation.
 */

import { recordLesson } from "./ankiBridge";
import { generateFeedback, runAgent } from "./llm";
import { summarizeForLLM } from "./state";
import type { Session } from "./state";
import type { TurnMessage } from "./types";

/** Don't flood the class: cap how many kids speak per single board post. */
const MAX_PER_TURN = 3;

export function createController(session: Session) {
    // Exact committed-board content the agent last processed. Re-posting the same
    // board (e.g. spamming Enter with no change) is ignored deterministically;
    // any real change still goes to the agent, which decides on new steps.
    let lastSignature: string | null = null;

    function studentIdFor(m: TurnMessage): string {
        const students = session.get().lesson.students;
        const valid = m.studentId && students.some((st) => st.id === m.studentId);
        return valid ? m.studentId! : students[Math.floor(Math.random() * students.length)].id;
    }

    /**
     * Run the agent on the current board and add any student utterances. Any
     * change to the board goes to the agent; an identical re-post is skipped so
     * spamming Enter can't produce repeat questions.
     */
    async function reactToBoard(): Promise<void> {
        const s = session.get();
        if (s.phase !== "teach" || s.checking) {
            return;
        }
        const summary = summarizeForLLM(s);
        const signature = `${summary.boardText.trim()}\u0000${summary.drawing ?? ""}`;
        if (signature === lastSignature) {
            return;
        }
        lastSignature = signature;
        session.setChecking(true);
        try {
            const result = await runAgent(summary);
            for (const m of (result.messages ?? []).slice(0, MAX_PER_TURN)) {
                if (m.text && m.text.trim()) {
                    session.addStudentMessage({
                        studentId: studentIdFor(m),
                        text: m.text.trim(),
                        kind: m.kind === "question" ? "question" : "reaction",
                    });
                }
            }
        } finally {
            session.setChecking(false);
        }
    }

    /** End the lesson and generate the final feedback report. */
    async function finish(): Promise<void> {
        const s = session.get();
        session.setGeneratingFeedback(true);
        const feedback = await generateFeedback(summarizeForLLM(s));
        session.finishLesson(feedback);

        // Fold the lesson result into topic mastery (in-app only; no-ops in dev).
        const lesson = s.lesson;
        try {
            const stats = await recordLesson({
                lessonId: lesson.id,
                slug: lesson.masterySlug ?? null,
                topic: lesson.topic,
                gaps: feedback.knowledgeGaps?.length ?? 0,
                strengths: feedback.strengths?.length ?? 0,
                verified: feedback.source === "openai",
            });
            session.setLessonStats(stats);
        } catch {
            session.setLessonStats(null);
        }
    }

    return { reactToBoard, finish };
}

export type Controller = ReturnType<typeof createController>;
