// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

/**
 * Shared lesson-state logic for the Teach-Back mode.
 *
 * This is deliberately UI-agnostic: it exposes a Svelte store plus plain action
 * functions. Desktop and mobile components both drive the same store, so the
 * lesson logic, worked-example tracking, and question handling live in exactly
 * one place.
 */

import { get, writable } from "svelte/store";

import type { ChatMessage, Lesson, LessonSession, LessonStats, TextBox } from "./types";

function newId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function initialSession(lesson: Lesson): LessonSession {
    return {
        lesson,
        phase: "study",
        board: { textBoxes: [], drawing: null, hasDrawing: false, rev: 0 },
        messages: [],
        workedExampleVisits: [],
        checking: false,
        startedAt: Date.now(),
        feedback: null,
        generatingFeedback: false,
        lessonStats: null,
    };
}

/**
 * Create a self-contained lesson session store. Returning a factory (rather than
 * a module-level singleton) keeps the logic testable and avoids cross-lesson
 * state leaking between mounts.
 */
export function createSession(lesson: Lesson) {
    const store = writable<LessonSession>(initialSession(lesson));

    function update(fn: (s: LessonSession) => void) {
        store.update((s) => {
            // Return a fresh top-level object each time. Svelte 5's store→signal
            // bridge dedupes by reference, so mutating and returning the same
            // object would not trigger re-renders.
            const next: LessonSession = {
                ...s,
                board: { ...s.board, textBoxes: [...s.board.textBoxes] },
                messages: [...s.messages],
            };
            fn(next);
            return next;
        });
    }

    const actions = {
        subscribe: store.subscribe,
        get: () => get(store),

        startTeaching() {
            update((s) => {
                s.phase = "teach";
                // Seed the conversation with each kid's casual greeting.
                if (s.messages.length === 0) {
                    for (const student of s.lesson.students) {
                        s.messages.push({
                            id: newId(),
                            role: "student",
                            studentId: student.id,
                            text: student.greeting,
                            kind: "reaction",
                            at: Date.now(),
                        });
                    }
                }
            });
        },

        /** Add a text box at fractional position (x,y) and return its id. */
        addTextBox(x: number, y: number): string {
            const box: TextBox = { id: newId(), x, y, text: "", committed: "" };
            update((s) => {
                s.board.textBoxes.push(box);
                s.board.rev++;
            });
            return box.id;
        },

        /** Update the live (draft) text of a box. */
        updateTextBox(id: string, text: string) {
            update((s) => {
                const box = s.board.textBoxes.find((b) => b.id === id);
                if (box) {
                    box.text = text;
                    s.board.rev++;
                }
            });
        },

        /** Commit a box's draft text so it becomes solid chalk and visible to the LLM. */
        commitTextBox(id: string) {
            update((s) => {
                const box = s.board.textBoxes.find((b) => b.id === id);
                if (box) {
                    box.committed = box.text;
                    s.board.rev++;
                }
            });
        },

        moveTextBox(id: string, x: number, y: number) {
            update((s) => {
                const box = s.board.textBoxes.find((b) => b.id === id);
                if (box) {
                    box.x = x;
                    box.y = y;
                }
            });
        },

        removeTextBox(id: string) {
            update((s) => {
                s.board.textBoxes = s.board.textBoxes.filter((b) => b.id !== id);
                s.board.rev++;
            });
        },

        setDrawing(dataUrl: string | null) {
            update((s) => {
                s.board.drawing = dataUrl;
                s.board.hasDrawing = !!dataUrl;
                s.board.rev++;
            });
        },

        /** Record that the user opened the worked example (whole thing or a step). */
        recordWorkedExampleVisit(stepIndex: number, stepTitle: string) {
            update((s) => {
                s.workedExampleVisits.push({ stepIndex, stepTitle, at: Date.now() });
            });
        },

        setChecking(checking: boolean) {
            update((s) => {
                s.checking = checking;
            });
        },

        /** Add a message spoken by a simulated student. */
        addStudentMessage(m: { studentId: string; text: string; kind: "reaction" | "question" }): ChatMessage {
            const msg: ChatMessage = {
                id: newId(),
                role: "student",
                studentId: m.studentId,
                text: m.text,
                kind: m.kind,
                at: Date.now(),
            };
            update((s) => {
                s.messages.push(msg);
            });
            return msg;
        },

        setGeneratingFeedback(value: boolean) {
            update((s) => {
                s.generatingFeedback = value;
            });
        },

        finishLesson(feedback: LessonSession["feedback"]) {
            update((s) => {
                s.feedback = feedback;
                s.phase = "feedback";
                s.generatingFeedback = false;
            });
        },

        /** Store the topic-mastery stats recorded after finishing (in-app). */
        setLessonStats(stats: LessonStats | null) {
            update((s) => {
                s.lessonStats = stats;
            });
        },

        reset() {
            store.set(initialSession(lesson));
        },
    };

    return actions;
}

export type Session = ReturnType<typeof createSession>;

/**
 * Build a compact, serializable summary of the whole attempt. This is the single
 * payload used both for gap detection (in progress) and final feedback, so the
 * LLM logic never has to reach into UI state.
 */
export function summarizeForLLM(session: LessonSession) {
    const { lesson, board, messages, workedExampleVisits } = session;
    // Only committed text is "on the board" as far as the class is concerned.
    const boardText = board.textBoxes
        .map((b) => b.committed.trim())
        .filter(Boolean)
        .join("\n");
    const nameOf = (id?: string) => lesson.students.find((st) => st.id === id)?.name ?? "Student";
    return {
        lessonId: lesson.id,
        topic: lesson.topic,
        problem: lesson.teachback.prompt,
        expectedAnswer: lesson.teachback.answer,
        expectedSteps: lesson.expectedSteps,
        keyConcepts: lesson.keyConcepts,
        commonMisconceptions: lesson.commonMisconceptions,
        exampleQuestions: lesson.exampleQuestions,
        suggestedReview: lesson.suggestedReview,
        // Optional per-lesson "draw a diagram" nudge (null for most topics).
        visual: lesson.visual ?? null,
        students: lesson.students.map((s) => ({ id: s.id, name: s.name, voice: s.voice })),
        boardText,
        hasDrawing: board.hasDrawing,
        // The freehand drawing image, sent alongside the text (together) to the model.
        drawing: board.drawing,
        // The classroom conversation so far (greetings, reactions, questions).
        conversation: messages.map((m) => ({
            who: m.role === "teacher" ? "Teacher" : nameOf(m.studentId),
            role: m.role,
            kind: m.kind,
            text: m.text,
        })),
        workedExampleVisits: workedExampleVisits.map((v) => ({
            step: v.stepTitle,
            stepIndex: v.stepIndex,
        })),
    };
}

export type LLMSummary = ReturnType<typeof summarizeForLLM>;
