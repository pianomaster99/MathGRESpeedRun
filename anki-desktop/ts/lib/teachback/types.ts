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

/**
 * An optional per-lesson "draw a diagram" nudge. When present, the classroom
 * agent may ask the teacher to sketch something once the board mentions any of
 * the trigger words and nothing has been drawn yet. Kept as plain data so it
 * works for any topic (not just geometry) without hard-coding the server.
 */
export interface VisualHint {
    /** Case-insensitive substrings that mean "a diagram would help now". */
    triggerWords: string[];
    /** The casual student request to draw it (asked at most once). */
    request: string;
}

/** GRE Math exam areas, used to group lessons on the home page. */
export type ExamArea = "Calculus" | "Algebra" | "Additional Topics" | "Warm-up";

/** One complete lesson definition. */
export interface Lesson {
    id: string;
    topic: string;
    title: string;
    /** Emoji shown on the topic card. */
    icon?: string;
    /** One-line description shown on the topic card. */
    blurb?: string;
    /** Short difficulty/level label, e.g. "Core" or "Advanced". */
    level?: string;
    /** Which GRE Math area this belongs to (for grouping the catalog). */
    examArea?: ExamArea;
    /**
     * The topic-mastery slug this lesson feeds (a key of GRE_MATH_TOPICS in
     * anki.gre_readiness, e.g. "linear-algebra"). Omitted for warm-ups that
     * don't map to a graded exam topic.
     */
    masterySlug?: string;
    /** Optional diagram nudge (see VisualHint). */
    visual?: VisualHint;
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

/** Per-topic mastery breakdown returned after recording a lesson (in-app). */
export interface TopicMasteryStat {
    slug: string;
    topic: string;
    examWeight: number;
    /** Memory (FSRS recall) component, 0-1, or null if the topic has no cards. */
    memory: number | null;
    /** Teaching component from recent verified lessons, 0-1, or null. */
    teaching: number | null;
    /** Blended mastery, 0-1, or null if there's no signal at all. */
    combined: number | null;
    teachCount: number;
    mastered: number;
    total: number;
}

/** One of the three 0-1 scores (memory or performance) with its range. */
export interface ScoreSnapshot {
    value: number | null;
    low: number | null;
    high: number | null;
    confidence: string;
    abstained: boolean;
    reason: string;
}

/** Projected readiness score on the real exam scale, with its range. */
export interface ReadinessSnapshot {
    scaled: number | null;
    scaledLow: number | null;
    scaledHigh: number | null;
    confidence: string;
    abstained: boolean;
    reason: string;
    accuracyValidated: boolean;
    scaleMin: number;
    scaleMax: number;
}

/** The three separate scores shown after a lesson (mirrors the dashboard). */
export interface ExamScoresSnapshot {
    memory: ScoreSnapshot;
    performance: ScoreSnapshot;
    readiness: ReadinessSnapshot;
    coverage: number;
    gradedReviews: number;
    lessonsVerified: number;
    weakest: string | null;
    updatedAt: number;
}

/** Result of recording a finished lesson into the collection (in-app only). */
export interface LessonStats {
    recorded: boolean;
    teachScore: number | null;
    verified: boolean;
    topic: TopicMasteryStat | null;
    scores: ExamScoresSnapshot;
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
    /** Topic-mastery stats recorded after finishing (null in dev/mobile or before finish). */
    lessonStats: LessonStats | null;
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
