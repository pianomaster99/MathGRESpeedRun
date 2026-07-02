// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

/**
 * Shared, platform-agnostic type definitions for the "Teach-Back" learning mode.
 *
 * This module contains NO UI or platform code. It is imported by the shared
 * lesson logic, by the desktop Svelte UI, by the mobile Svelte UI, and (via the
 * same JSON shapes) by the LLM proxy server. Keeping it framework-free is what
 * lets desktop and mobile share the exact same lesson/LLM/feedback logic.
 */

/** A single step in a worked-out solution. */
export interface SolutionStep {
    /** Short label, e.g. "Compute the integrating factor". */
    title: string;
    /** Plain-language explanation of the step. */
    explanation: string;
    /** Optional LaTeX (without delimiters) shown as display math. */
    math?: string;
}

/** A fully worked example the user studies before teaching. */
export interface WorkedExample {
    problem: string;
    /** Optional LaTeX for the problem statement. */
    problemMath?: string;
    steps: SolutionStep[];
}

/** The problem the user is asked to teach back. */
export interface TeachbackProblem {
    prompt: string;
    problemMath?: string;
    /** The final answer, used only by the evaluator/feedback, never shown up-front. */
    answer: string;
}

/** A simulated student in the classroom. */
export interface Student {
    id: string;
    name: string;
    /** Single emoji used as a simple avatar. */
    avatar: string;
    /** A short description of how this student talks (used to flavour questions). */
    voice: string;
    /** A casual, silly greeting shown when the lesson starts. */
    greeting: string;
}

/** One complete lesson definition. */
export interface Lesson {
    id: string;
    topic: string;
    title: string;
    workedExample: WorkedExample;
    teachback: TeachbackProblem;
    /** Concepts the lesson is trying to build. */
    keyConcepts: string[];
    /** Steps we expect a good explanation to cover (drives gap detection). */
    expectedSteps: string[];
    /** Misconceptions the evaluator should watch for. */
    commonMisconceptions: string[];
    /** Example casual questions students might ask. */
    exampleQuestions: string[];
    /** Roster of simulated students for this lesson. */
    students: Student[];
    /** Optional follow-up Anki topics/cards to suggest in feedback. */
    suggestedReview: string[];
}

/** A draggable, editable text box placed on the whiteboard. */
export interface TextBox {
    id: string;
    /** Position as a fraction (0-1) of the board, so it survives resizes. */
    x: number;
    y: number;
    /** The live, possibly-uncommitted text being typed (shown faintly). */
    text: string;
    /** The committed text (shown as solid chalk, and the only thing the LLM sees). */
    committed: string;
}

/** Current contents of the teaching board (one unified whiteboard). */
export interface BoardState {
    /** Freehand + typed content live together on one board. */
    textBoxes: TextBox[];
    /** Data URL of the freehand drawing layer, or null if untouched. */
    drawing: string | null;
    /** True once the user has drawn anything (a real freehand sketch). */
    hasDrawing: boolean;
    /**
     * Bumped whenever the board's *content* changes (text or drawing, not mere
     * dragging).
     */
    rev: number;
}

/** What a chat message is doing. */
export type MessageKind = "reaction" | "question" | "say";

/** A single message in the classroom conversation (student or teacher). */
export interface ChatMessage {
    id: string;
    role: "student" | "teacher";
    /** Present for student messages. */
    studentId?: string;
    text: string;
    /** reaction = casual banter, question = diagnostic question, say = teacher talking. */
    kind: MessageKind;
    at: number;
}

/** A record of the user opening the worked example during teaching. */
export interface WorkedExampleVisit {
    /** Index of the step the user looked at, or -1 for "the whole example". */
    stepIndex: number;
    stepTitle: string;
    at: number;
}

/** High level phase of the lesson. */
export type LessonPhase = "study" | "teach" | "feedback";

/** The full mutable state for one lesson attempt. */
export interface LessonSession {
    lesson: Lesson;
    phase: LessonPhase;
    board: BoardState;
    /** The classroom conversation (greetings, reactions, questions, teacher turns). */
    messages: ChatMessage[];
    workedExampleVisits: WorkedExampleVisit[];
    /** Whether a background LLM check is currently in flight. */
    checking: boolean;
    startedAt: number;
    feedback: FeedbackReport | null;
    generatingFeedback: boolean;
}

/** Where an LLM result actually came from. */
export type ResultSource = "openai" | "offline";

/** One utterance the agent decides a student should say this turn. */
export interface TurnMessage {
    studentId?: string;
    text: string;
    /** reaction = casual banter/response, question = diagnostic/reinforcing question. */
    kind?: "reaction" | "question";
}

/** Result of running the mini classroom agent on a board update. */
export interface AgentResult {
    /** Zero or more student utterances for this turn. */
    messages: TurnMessage[];
    /** Whether this came from the real evaluator or the offline fallback. */
    source?: ResultSource;
}

/** Structured post-lesson feedback. No numeric ratings — just what to fix. */
export interface FeedbackReport {
    strengths: string[];
    /** What the user got wrong or missed (the core of the report). */
    knowledgeGaps: string[];
    suggestedReview: string[];
    workedExampleUsage: string;
    /** A short, supportive closing note. */
    encouragement: string;
    /** Whether this came from the real evaluator or the offline fallback. */
    source?: ResultSource;
}
