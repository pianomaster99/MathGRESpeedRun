// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

/**
 * Static MVP lesson data for the Teach-Back learning mode.
 *
 * The MVP topic is the Pythagorean theorem — deliberately simple so the focus
 * stays on the teach-back interaction. Everything here is plain data so it can
 * be reused unchanged by desktop, mobile, and the LLM proxy server.
 */

import type { Lesson, Student } from "./types";

const students: Student[] = [
    {
        id: "riley",
        name: "Riley",
        avatar: "🧑\u200d🎓",
        voice: "bubbly and easily distracted, uses lots of slang and emojis",
        greeting: "yooo good morning teach!! ☀️",
    },
    {
        id: "maya",
        name: "Maya",
        avatar: "👩\u200d🎓",
        voice: "super enthusiastic, asks 'but WHY' about everything",
        greeting: "omg are we doing triangles today?? i LOVE triangles 🔺",
    },
    {
        id: "sam",
        name: "Sam",
        avatar: "🧑",
        voice: "goofy and a little lost, makes silly jokes when confused",
        greeting: "wait i forgot my calculator... do triangles need batteries 🔋",
    },
    {
        id: "jordan",
        name: "Jordan",
        avatar: "🧑\u200d🦱",
        voice: "chill class clown, always angling to finish early",
        greeting: "hi hi hi can we pleaseee finish early today 😜",
    },
];

export const pythagLesson: Lesson = {
    id: "pythagorean-theorem",
    topic: "The Pythagorean Theorem",
    title: "The Pythagorean Theorem",
    workedExample: {
        problem: "A right triangle has legs of length 3 and 4. Find the hypotenuse.",
        problemMath: "a = 3,\\; b = 4,\\quad c = ?",
        steps: [
            {
                title: "Recognize it's a right triangle",
                explanation:
                    "The Pythagorean theorem only works for RIGHT triangles (one 90° angle). "
                    + "The two shorter sides are the legs (a and b); the longest side, opposite "
                    + "the right angle, is the hypotenuse (c).",
                math: "\\text{legs } a, b \\quad\\text{hypotenuse } c",
            },
            {
                title: "Write the theorem",
                explanation:
                    "For a right triangle, the squares of the legs add up to the square of the "
                    + "hypotenuse.",
                math: "a^2 + b^2 = c^2",
            },
            {
                title: "Substitute the known lengths",
                explanation: "Here a = 3 and b = 4, so plug those in.",
                math: "3^2 + 4^2 = c^2",
            },
            {
                title: "Compute the squares and add",
                explanation:
                    "Square each leg first (3² = 9, 4² = 16), THEN add. Don't add the sides "
                    + "before squaring.",
                math: "9 + 16 = c^2 \\;\\Rightarrow\\; 25 = c^2",
            },
            {
                title: "Take the (positive) square root",
                explanation:
                    "Undo the square by taking the square root of both sides. A length is "
                    + "positive, so we keep the positive root.",
                math: "c = \\sqrt{25} = 5",
            },
        ],
    },
    teachback: {
        prompt: "Now teach the class how to find the hypotenuse of a right triangle with legs 6 and 8.",
        problemMath: "a = 6,\\; b = 8,\\quad c = ?",
        answer: "c = 10",
    },
    keyConcepts: [
        "The theorem applies only to right triangles",
        "The hypotenuse c is the side opposite the right angle (the longest side)",
        "a² + b² = c²",
        "Square the legs before adding them",
        "Take the positive square root to solve for c",
    ],
    expectedSteps: [
        "Draw and label the right triangle so the class can see it (legs 6 and 8, hypotenuse c, and the right angle).",
        "Identify the right triangle and that c (the hypotenuse) is the unknown longest side.",
        "Write the Pythagorean theorem a² + b² = c².",
        "Substitute a = 6 and b = 8: 6² + 8² = c².",
        "Compute the squares and add: 36 + 64 = 100, so c² = 100.",
        "Take the positive square root: c = √100 = 10.",
    ],
    commonMisconceptions: [
        "Explaining only with text/formulas and never drawing or labeling the triangle.",
        "Adding the legs before squaring (6 + 8 = 14) instead of squaring first.",
        "Forgetting the final square root and leaving the answer as c = 100.",
        "Applying the theorem to a triangle that isn't a right triangle.",
        "Mislabeling a leg as the hypotenuse (the hypotenuse is opposite the right angle).",
        "Computing a square wrong, e.g. saying 6² = 12 instead of 36.",
    ],
    exampleQuestions: [
        "wait why do we square them and not just add lol",
        "can you draw the triangle?? i'm a visual learner 👀",
        "is c the long slanty one?? 🤔",
        "do i actually gotta square root it or can i be lazy",
        "does this work for ANY triangle or nah",
        "6 squared is 12 right?? 😅",
    ],
    students,
    suggestedReview: [
        "When the Pythagorean theorem applies (right triangles only)",
        "Squaring numbers (e.g. 6² = 36, 8² = 64)",
        "Square roots (e.g. √100 = 10)",
        "Identifying the hypotenuse vs the legs",
    ],
};

/** All lessons available in the MVP (currently one). */
export const lessons: Lesson[] = [pythagLesson];

/** Look up a lesson by id, defaulting to the Pythagorean lesson. */
export function getLesson(id?: string): Lesson {
    if (!id) {
        return pythagLesson;
    }
    return lessons.find((l) => l.id === id) ?? pythagLesson;
}
