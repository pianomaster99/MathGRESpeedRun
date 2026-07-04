// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

/**
 * Static lesson catalog for the Teach-Back learning mode.
 *
 * Each lesson is one concrete, teachable problem drawn from a GRE Mathematics
 * Subject Test topic. Everything here is plain data so it can be reused unchanged
 * by the desktop UI, the mobile UI, and the LLM proxy server. Lessons are grouped
 * by exam area (Calculus 50%, Algebra 25%, Additional Topics 25%) on the home
 * page.
 */

import type { Lesson, Student } from "./types";

/**
 * Build the shared 4-kid roster with greetings flavoured for the given topic, so
 * every lesson keeps the same personalities but the banter fits the subject.
 */
function makeStudents(topicWord: string): Student[] {
    return [
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
            greeting: `omg are we doing ${topicWord} today?? i'm kinda hyped 🤓`,
        },
        {
            id: "sam",
            name: "Sam",
            avatar: "🧑",
            voice: "goofy and a little lost, makes silly jokes when confused",
            greeting: "wait i think i left my brain at home... one sec 🧠",
        },
        {
            id: "jordan",
            name: "Jordan",
            avatar: "🧑\u200d🦱",
            voice: "chill class clown, always angling to finish early",
            greeting: "hi hi hi can we pleaseee finish early today 😜",
        },
    ];
}

// --- Warm-up: Pythagorean theorem -----------------------------------------
export const pythagLesson: Lesson = {
    id: "pythagorean-theorem",
    topic: "The Pythagorean Theorem",
    title: "The Pythagorean Theorem",
    icon: "📐",
    blurb: "Find the hypotenuse of a right triangle — a gentle warm-up for teaching at the board.",
    level: "Warm-up",
    examArea: "Warm-up",
    visual: {
        triggerWords: ["^2", "²", "squared", "sqrt", "√", "pythag", "c ="],
        request: "wait, can you draw the triangle so we can actually see it? 👀",
    },
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
                explanation: "The squares of the legs add up to the square of the hypotenuse.",
                math: "a^2 + b^2 = c^2",
            },
            {
                title: "Substitute the known lengths",
                explanation: "Here a = 3 and b = 4, so plug those in.",
                math: "3^2 + 4^2 = c^2",
            },
            {
                title: "Compute the squares and add",
                explanation: "Square each leg first (3² = 9, 4² = 16), THEN add.",
                math: "9 + 16 = c^2 \\;\\Rightarrow\\; 25 = c^2",
            },
            {
                title: "Take the (positive) square root",
                explanation: "A length is positive, so keep the positive root.",
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
        "Draw and label the right triangle (legs 6 and 8, hypotenuse c, right angle).",
        "Identify that c (the hypotenuse) is the unknown longest side.",
        "Write the Pythagorean theorem a² + b² = c².",
        "Substitute a = 6 and b = 8: 6² + 8² = c².",
        "Compute the squares and add: 36 + 64 = 100, so c² = 100.",
        "Take the positive square root: c = √100 = 10.",
    ],
    commonMisconceptions: [
        "Adding the legs before squaring (6 + 8 = 14) instead of squaring first.",
        "Forgetting the final square root and leaving the answer as c = 100.",
        "Applying the theorem to a triangle that isn't a right triangle.",
        "Mislabeling a leg as the hypotenuse.",
    ],
    exampleQuestions: [
        "wait why do we square them and not just add lol",
        "is c the long slanty one?? 🤔",
        "do i actually gotta square root it or can i be lazy",
        "does this work for ANY triangle or nah",
    ],
    students: makeStudents("triangles"),
    suggestedReview: [
        "When the Pythagorean theorem applies (right triangles only)",
        "Squaring numbers and taking square roots",
        "Identifying the hypotenuse vs the legs",
    ],
};

// --- Calculus: the power rule ---------------------------------------------
export const calculusLesson: Lesson = {
    id: "calculus-power-rule",
    masterySlug: "calculus",
    topic: "Calculus",
    title: "Derivatives with the Power Rule",
    icon: "📈",
    blurb: "Differentiate a polynomial term by term using the power rule.",
    level: "Core",
    examArea: "Calculus",
    workedExample: {
        problem: "Differentiate f(x) = 3x⁴ − 5x² + 2.",
        problemMath: "f(x) = 3x^4 - 5x^2 + 2",
        steps: [
            {
                title: "Recall the power rule",
                explanation: "The derivative of xⁿ is n·xⁿ⁻¹. Constant factors come along for the ride.",
                math: "\\frac{d}{dx}\\,x^n = n x^{n-1}",
            },
            {
                title: "Differentiate each term",
                explanation: "Apply the rule to 3x⁴ and to −5x² separately.",
                math: "\\frac{d}{dx}(3x^4) = 12x^3,\\quad \\frac{d}{dx}(-5x^2) = -10x",
            },
            {
                title: "Handle the constant",
                explanation: "The derivative of a constant (here +2) is 0.",
                math: "\\frac{d}{dx}(2) = 0",
            },
            {
                title: "Combine",
                explanation: "Add the pieces to get the derivative.",
                math: "f'(x) = 12x^3 - 10x",
            },
        ],
    },
    teachback: {
        prompt: "Now teach the class how to differentiate g(x) = 4x³ + 2x² − 7x.",
        problemMath: "g(x) = 4x^3 + 2x^2 - 7x",
        answer: "g'(x) = 12x² + 4x − 7",
    },
    keyConcepts: [
        "The power rule: d/dx xⁿ = n·xⁿ⁻¹",
        "Differentiate term by term (sum rule)",
        "Constant multiples stay in front",
        "The derivative of a linear term ax is just a",
    ],
    expectedSteps: [
        "State the power rule d/dx xⁿ = n·xⁿ⁻¹.",
        "Differentiate 4x³ to get 12x².",
        "Differentiate 2x² to get 4x.",
        "Differentiate −7x to get −7.",
        "Combine: g'(x) = 12x² + 4x − 7.",
    ],
    commonMisconceptions: [
        "Forgetting to multiply by the old exponent (writing x³ → x² instead of 3x²).",
        "Dropping the coefficient (e.g. 4x³ → 3x² instead of 12x²).",
        "Thinking the derivative of −7x is 0 instead of −7.",
        "Reducing the exponent incorrectly.",
    ],
    exampleQuestions: [
        "wait where does the little exponent number GO 😵",
        "why does the 7x just turn into 7 lol",
        "do we do each piece separately or all at once??",
        "does the +constant matter or nah",
    ],
    students: makeStudents("derivatives"),
    suggestedReview: [
        "The power rule for derivatives",
        "Derivative of a constant and of a linear term",
        "Differentiating polynomials term by term",
    ],
};

// --- Linear algebra: eigenvalues of a 2x2 ---------------------------------
export const linearAlgebraLesson: Lesson = {
    id: "linear-algebra-eigenvalues",
    masterySlug: "linear-algebra",
    topic: "Linear Algebra",
    title: "Eigenvalues of a 2×2 Matrix",
    icon: "🔢",
    blurb: "Find eigenvalues from the characteristic equation using trace and determinant.",
    level: "Core",
    examArea: "Algebra",
    workedExample: {
        problem: "Find the eigenvalues of A = [[2, 1], [1, 2]].",
        problemMath: "A = \\begin{pmatrix} 2 & 1 \\\\ 1 & 2 \\end{pmatrix}",
        steps: [
            {
                title: "Set up the characteristic equation",
                explanation: "Eigenvalues λ satisfy det(A − λI) = 0.",
                math: "\\det(A - \\lambda I) = 0",
            },
            {
                title: "Write A − λI",
                explanation: "Subtract λ from each diagonal entry.",
                math: "\\begin{pmatrix} 2-\\lambda & 1 \\\\ 1 & 2-\\lambda \\end{pmatrix}",
            },
            {
                title: "Take the determinant",
                explanation: "For a 2×2, det = (product of diagonal) − (product of off-diagonal).",
                math: "(2-\\lambda)^2 - 1 = 0",
            },
            {
                title: "Solve for λ",
                explanation: "Expand and factor (or use trace 4, det 3: λ² − 4λ + 3 = 0).",
                math: "\\lambda^2 - 4\\lambda + 3 = 0 \\Rightarrow \\lambda = 1,\\ 3",
            },
        ],
    },
    teachback: {
        prompt: "Now teach the class how to find the eigenvalues of B = [[4, 1], [2, 3]].",
        problemMath: "B = \\begin{pmatrix} 4 & 1 \\\\ 2 & 3 \\end{pmatrix}",
        answer: "λ = 2 and λ = 5",
    },
    keyConcepts: [
        "Eigenvalues solve det(A − λI) = 0",
        "For 2×2: characteristic polynomial is λ² − (trace)·λ + det",
        "trace = sum of diagonal, det = ad − bc",
        "Solve the quadratic for the two eigenvalues",
    ],
    expectedSteps: [
        "Write det(B − λI) = 0.",
        "Compute trace = 4 + 3 = 7 and det = 4·3 − 1·2 = 10.",
        "Form the characteristic equation λ² − 7λ + 10 = 0.",
        "Factor (λ − 2)(λ − 5) = 0.",
        "Read off the eigenvalues λ = 2 and λ = 5.",
    ],
    commonMisconceptions: [
        "Subtracting λ from every entry instead of just the diagonal.",
        "Computing the determinant as ad + bc instead of ad − bc.",
        "Getting the sign of the trace term wrong in λ² − (trace)λ + det.",
        "Forgetting there are two eigenvalues.",
    ],
    exampleQuestions: [
        "wait why do we subtract lambda only on the diagonal 🤔",
        "is trace just the diagonal added up??",
        "how'd you get that quadratic so fast lol",
        "can eigenvalues be the same number sometimes?",
    ],
    students: makeStudents("eigenvalues"),
    suggestedReview: [
        "The characteristic equation det(A − λI) = 0",
        "Trace and determinant of a 2×2 matrix",
        "Solving quadratics by factoring",
    ],
};

// --- Abstract algebra: order of an element --------------------------------
export const abstractAlgebraLesson: Lesson = {
    id: "abstract-algebra-order",
    masterySlug: "abstract-algebra",
    topic: "Abstract Algebra",
    title: "Order of an Element in a Group",
    icon: "🔗",
    blurb: "Find the order of an element in the cyclic group ℤₙ.",
    level: "Core",
    examArea: "Algebra",
    workedExample: {
        problem: "In ℤ₆ (integers mod 6 under addition), find the order of the element 2.",
        problemMath: "\\text{order of } 2 \\text{ in } \\mathbb{Z}_6",
        steps: [
            {
                title: "Recall what 'order' means",
                explanation:
                    "The order of an element g is the smallest positive k with g added to itself "
                    + "k times equal to the identity (here 0 mod 6).",
                math: "\\text{ord}(g) = \\min\\{k>0 : kg \\equiv 0\\}",
            },
            {
                title: "Add the element repeatedly",
                explanation: "Keep adding 2 modulo 6 until you reach 0.",
                math: "2,\\ 4,\\ 6\\equiv 0",
            },
            {
                title: "Count the steps",
                explanation: "It took 3 additions to hit 0, so the order is 3.",
                math: "\\text{ord}(2) = 3",
            },
            {
                title: "Check with the formula",
                explanation: "In ℤₙ, ord(k) = n / gcd(n, k). Here 6/gcd(6,2) = 6/2 = 3. ✓",
                math: "\\text{ord}(k) = \\frac{n}{\\gcd(n,k)}",
            },
        ],
    },
    teachback: {
        prompt: "Now teach the class how to find the order of the element 3 in ℤ₁₂.",
        problemMath: "\\text{order of } 3 \\text{ in } \\mathbb{Z}_{12}",
        answer: "order 4 (3, 6, 9, 12≡0), and 12/gcd(12,3) = 12/3 = 4",
    },
    keyConcepts: [
        "Order = smallest k > 0 with k·g equal to the identity",
        "In ℤₙ the identity is 0 and the operation is addition mod n",
        "Formula: ord(k) = n / gcd(n, k)",
        "The order always divides the group size (Lagrange)",
    ],
    expectedSteps: [
        "State that order is the smallest k with k·3 ≡ 0 (mod 12).",
        "Add 3 repeatedly mod 12: 3, 6, 9, 12 ≡ 0.",
        "Count 4 steps, so the order is 4.",
        "Confirm with ord(3) = 12/gcd(12,3) = 12/3 = 4.",
    ],
    commonMisconceptions: [
        "Confusing the element's value (3) with its order (4).",
        "Using multiplication instead of the group's addition.",
        "Forgetting to reduce modulo n.",
        "Misremembering the formula as gcd(n,k) instead of n/gcd(n,k).",
    ],
    exampleQuestions: [
        "wait is the identity 0 or 1 here 😅",
        "why do we divide by the gcd tho",
        "does the order have to divide 12??",
        "do we add or multiply, i always mix it up",
    ],
    students: makeStudents("group theory"),
    suggestedReview: [
        "Definition of the order of a group element",
        "Cyclic groups ℤₙ and addition mod n",
        "The formula ord(k) = n/gcd(n,k) and Lagrange's theorem",
    ],
};

// --- Number theory: Euclidean algorithm -----------------------------------
export const numberTheoryLesson: Lesson = {
    id: "number-theory-gcd",
    masterySlug: "number-theory",
    topic: "Number Theory",
    title: "GCD via the Euclidean Algorithm",
    icon: "➗",
    blurb: "Compute a greatest common divisor with repeated remainders.",
    level: "Core",
    examArea: "Algebra",
    workedExample: {
        problem: "Find gcd(48, 18) using the Euclidean algorithm.",
        problemMath: "\\gcd(48, 18)",
        steps: [
            {
                title: "The key idea",
                explanation: "gcd(a, b) = gcd(b, a mod b). Replace the pair with (b, remainder).",
                math: "\\gcd(a,b) = \\gcd(b,\\ a \\bmod b)",
            },
            {
                title: "Divide and take the remainder",
                explanation: "48 = 2·18 + 12, so gcd(48,18) = gcd(18,12).",
                math: "48 = 2\\cdot 18 + 12",
            },
            {
                title: "Repeat",
                explanation: "18 = 1·12 + 6, so gcd(18,12) = gcd(12,6).",
                math: "18 = 1\\cdot 12 + 6",
            },
            {
                title: "Stop at remainder 0",
                explanation: "12 = 2·6 + 0. The last nonzero remainder is the gcd.",
                math: "12 = 2\\cdot 6 + 0 \\Rightarrow \\gcd = 6",
            },
        ],
    },
    teachback: {
        prompt: "Now teach the class how to compute gcd(84, 30) with the Euclidean algorithm.",
        problemMath: "\\gcd(84, 30)",
        answer: "6  (84 = 2·30 + 24; 30 = 1·24 + 6; 24 = 4·6 + 0)",
    },
    keyConcepts: [
        "gcd(a, b) = gcd(b, a mod b)",
        "Repeatedly replace the pair with (divisor, remainder)",
        "The last nonzero remainder is the gcd",
        "The algorithm always terminates because remainders shrink",
    ],
    expectedSteps: [
        "State gcd(a,b) = gcd(b, a mod b).",
        "84 = 2·30 + 24, so gcd(84,30) = gcd(30,24).",
        "30 = 1·24 + 6, so gcd(30,24) = gcd(24,6).",
        "24 = 4·6 + 0, so the gcd is the last nonzero remainder, 6.",
    ],
    commonMisconceptions: [
        "Taking the last remainder (0) as the answer instead of the last nonzero one.",
        "Swapping quotient and remainder.",
        "Dividing in the wrong order (smaller by larger repeatedly).",
        "Arithmetic slips in the division steps.",
    ],
    exampleQuestions: [
        "wait which number is the answer, the 6 or the 0 😳",
        "why does this even work lol",
        "do we always divide the big one by the small one?",
        "how do we know when to stop",
    ],
    students: makeStudents("gcds"),
    suggestedReview: [
        "The Euclidean algorithm for gcd",
        "Division with quotient and remainder",
        "Why the last nonzero remainder is the gcd",
    ],
};

// --- Real analysis: the ratio test ----------------------------------------
export const realAnalysisLesson: Lesson = {
    id: "real-analysis-ratio-test",
    masterySlug: "real-analysis",
    topic: "Real Analysis",
    title: "Convergence with the Ratio Test",
    icon: "♾️",
    blurb: "Decide whether a series converges using the ratio test.",
    level: "Advanced",
    examArea: "Additional Topics",
    workedExample: {
        problem: "Does the series Σ n/2ⁿ (n from 1 to ∞) converge?",
        problemMath: "\\sum_{n=1}^{\\infty} \\frac{n}{2^n}",
        steps: [
            {
                title: "State the ratio test",
                explanation:
                    "Let L = limₙ |a_{n+1}/a_n|. If L < 1 the series converges (absolutely); "
                    + "if L > 1 it diverges; if L = 1 the test is inconclusive.",
                math: "L = \\lim_{n\\to\\infty} \\left| \\frac{a_{n+1}}{a_n} \\right|",
            },
            {
                title: "Form the ratio",
                explanation: "With aₙ = n/2ⁿ, divide consecutive terms.",
                math: "\\frac{a_{n+1}}{a_n} = \\frac{(n+1)/2^{n+1}}{n/2^n} = \\frac{n+1}{2n}",
            },
            {
                title: "Take the limit",
                explanation: "As n → ∞, (n+1)/(2n) → 1/2.",
                math: "L = \\lim_{n\\to\\infty} \\frac{n+1}{2n} = \\frac{1}{2}",
            },
            {
                title: "Conclude",
                explanation: "Since L = 1/2 < 1, the series converges.",
                math: "L = \\tfrac12 < 1 \\Rightarrow \\text{converges}",
            },
        ],
    },
    teachback: {
        prompt: "Now teach the class how to use the ratio test on Σ 2ⁿ/n! (n from 1 to ∞).",
        problemMath: "\\sum_{n=1}^{\\infty} \\frac{2^n}{n!}",
        answer: "L = lim 2/(n+1) = 0 < 1, so the series converges",
    },
    keyConcepts: [
        "Ratio test: L = lim |a_{n+1}/a_n|",
        "L < 1 converges, L > 1 diverges, L = 1 inconclusive",
        "Simplify the ratio before taking the limit",
        "Factorials shrink ratios fast (n! grows faster than any exponential)",
    ],
    expectedSteps: [
        "State the ratio test and the L < 1 / L > 1 / L = 1 rule.",
        "Form a_{n+1}/a_n = (2ⁿ⁺¹/(n+1)!)·(n!/2ⁿ) = 2/(n+1).",
        "Take the limit: 2/(n+1) → 0.",
        "Since L = 0 < 1, conclude the series converges.",
    ],
    commonMisconceptions: [
        "Flipping the ratio (a_n/a_{n+1}).",
        "Mishandling the factorial: (n+1)! = (n+1)·n!.",
        "Concluding divergence when L < 1.",
        "Forgetting that L = 1 gives no information.",
    ],
    exampleQuestions: [
        "wait what does the L<1 thing mean again 😅",
        "how do factorials cancel like that??",
        "is 0 less than 1... so it converges right?",
        "what if L came out exactly 1",
    ],
    students: makeStudents("infinite series"),
    suggestedReview: [
        "The ratio test and its three cases",
        "Simplifying ratios with factorials",
        "Convergence vs divergence of series",
    ],
};

// --- Topology: is it a topology? ------------------------------------------
export const topologyLesson: Lesson = {
    id: "topology-is-a-topology",
    masterySlug: "topology",
    topic: "Topology",
    title: "Checking the Axioms of a Topology",
    icon: "🌐",
    blurb: "Verify whether a collection of subsets is a valid topology.",
    level: "Advanced",
    examArea: "Additional Topics",
    workedExample: {
        problem: "Is τ = {∅, {a}, {a,b}, X} a topology on X = {a, b, c}?",
        problemMath: "\\tau = \\{\\varnothing, \\{a\\}, \\{a,b\\}, X\\}",
        steps: [
            {
                title: "Recall the three axioms",
                explanation: "A topology τ must contain ∅ and X, and be closed under arbitrary unions and finite intersections.",
                math: "\\varnothing, X \\in \\tau",
            },
            {
                title: "Check ∅ and X",
                explanation: "Both ∅ and X = {a,b,c} are in τ. ✓",
                math: "\\varnothing \\in \\tau,\\ X \\in \\tau",
            },
            {
                title: "Check unions",
                explanation: "Any union of members is again a member (e.g. {a} ∪ {a,b} = {a,b} ∈ τ). ✓",
                math: "\\{a\\} \\cup \\{a,b\\} = \\{a,b\\} \\in \\tau",
            },
            {
                title: "Check intersections",
                explanation: "Any intersection of members is a member (e.g. {a} ∩ {a,b} = {a} ∈ τ). So τ IS a topology. ✓",
                math: "\\{a\\} \\cap \\{a,b\\} = \\{a\\} \\in \\tau",
            },
        ],
    },
    teachback: {
        prompt: "Now teach the class whether τ = {∅, {a}, {b}, X} is a topology on X = {a, b, c}.",
        problemMath: "\\tau = \\{\\varnothing, \\{a\\}, \\{b\\}, X\\},\\ X=\\{a,b,c\\}",
        answer: "No — {a} ∪ {b} = {a,b} is not in τ, so it fails the union axiom.",
    },
    keyConcepts: [
        "A topology contains ∅ and the whole set X",
        "Closed under arbitrary unions",
        "Closed under finite intersections",
        "One failed axiom is enough to say 'not a topology'",
    ],
    expectedSteps: [
        "State the three axioms (∅ and X in τ; closed under unions and finite intersections).",
        "Confirm ∅ and X are in τ.",
        "Test unions: {a} ∪ {b} = {a,b}.",
        "Note {a,b} is NOT in τ, so the union axiom fails.",
        "Conclude τ is NOT a topology.",
    ],
    commonMisconceptions: [
        "Only checking that ∅ and X are present and stopping there.",
        "Forgetting to test unions/intersections of the singletons.",
        "Thinking one valid union makes the whole collection valid.",
        "Confusing union with intersection.",
    ],
    exampleQuestions: [
        "wait so we need the empty set AND the whole thing?? 😵",
        "what's the difference between union and intersection again lol",
        "does ONE bad union really break it?",
        "is {a,b} the same as X here?",
    ],
    students: makeStudents("topology"),
    suggestedReview: [
        "The three axioms of a topology",
        "Unions and intersections of sets",
        "Discrete vs indiscrete topologies",
    ],
};

// --- Complex analysis: powers via polar form ------------------------------
export const complexAnalysisLesson: Lesson = {
    id: "complex-analysis-powers",
    masterySlug: "complex-analysis",
    topic: "Complex Analysis",
    title: "Powers of Complex Numbers (De Moivre)",
    icon: "🧭",
    blurb: "Raise a complex number to a power using polar form and De Moivre's theorem.",
    level: "Advanced",
    examArea: "Additional Topics",
    workedExample: {
        problem: "Compute (1 + i)⁸.",
        problemMath: "(1+i)^8",
        steps: [
            {
                title: "Convert to polar form",
                explanation: "Find the modulus r = |1+i| and argument θ.",
                math: "r = \\sqrt{1^2+1^2} = \\sqrt2,\\quad \\theta = \\frac{\\pi}{4}",
            },
            {
                title: "Apply De Moivre's theorem",
                explanation: "(r·e^{iθ})ⁿ = rⁿ·e^{i n θ}: raise the modulus to the power and multiply the angle.",
                math: "(1+i)^8 = (\\sqrt2)^8\\, e^{i\\cdot 8\\cdot \\pi/4}",
            },
            {
                title: "Simplify the modulus and angle",
                explanation: "(√2)⁸ = 2⁴ = 16, and 8·(π/4) = 2π.",
                math: "= 16\\, e^{i\\,2\\pi}",
            },
            {
                title: "Convert back",
                explanation: "e^{i2π} = 1, so the result is real.",
                math: "= 16",
            },
        ],
    },
    teachback: {
        prompt: "Now teach the class how to compute (1 + i√3)⁶.",
        problemMath: "(1 + i\\sqrt3)^6",
        answer: "64  (r = 2, θ = π/3; 2⁶·e^{i·2π} = 64)",
    },
    keyConcepts: [
        "Polar form: z = r·e^{iθ} with r = |z|, θ = arg z",
        "Modulus of a+bi is √(a² + b²)",
        "De Moivre: zⁿ = rⁿ·e^{inθ}",
        "e^{i2πk} = 1 for integer k",
    ],
    expectedSteps: [
        "Compute the modulus r = |1 + i√3| = √(1 + 3) = 2.",
        "Find the argument θ = arctan(√3/1) = π/3.",
        "Apply De Moivre: (2)⁶·e^{i·6·(π/3)} = 64·e^{i·2π}.",
        "Simplify e^{i2π} = 1 to get 64.",
    ],
    commonMisconceptions: [
        "Computing the modulus as a + b instead of √(a² + b²).",
        "Getting the argument wrong (ignoring the quadrant).",
        "Multiplying the modulus by n instead of raising it to the n.",
        "Forgetting that the angle also gets multiplied by n.",
    ],
    exampleQuestions: [
        "wait how do we get the angle again 🤔",
        "why do we raise r to the power but multiply the angle??",
        "is e^{i2pi} really just 1 lol",
        "how'd the imaginary part disappear",
    ],
    students: makeStudents("complex numbers"),
    suggestedReview: [
        "Polar form of complex numbers",
        "Modulus and argument",
        "De Moivre's theorem for powers",
    ],
};

// --- Probability: expected value ------------------------------------------
export const probabilityLesson: Lesson = {
    id: "probability-expected-value",
    masterySlug: "probability-statistics",
    topic: "Probability & Statistics",
    title: "Expected Value",
    icon: "🎲",
    blurb: "Compute the expected value of a random variable from its distribution.",
    level: "Core",
    examArea: "Additional Topics",
    workedExample: {
        problem: "What is the expected value of a single roll of a fair six-sided die?",
        problemMath: "E[X],\\ X \\in \\{1,2,3,4,5,6\\}",
        steps: [
            {
                title: "Definition of expected value",
                explanation: "E[X] = Σ (value × probability of that value).",
                math: "E[X] = \\sum_i x_i\\, p_i",
            },
            {
                title: "List the distribution",
                explanation: "Each face 1–6 has probability 1/6.",
                math: "p_i = \\tfrac{1}{6}\\ \\text{for each } x_i",
            },
            {
                title: "Sum value × probability",
                explanation: "Add up (1 + 2 + 3 + 4 + 5 + 6) = 21, each weighted by 1/6.",
                math: "E[X] = \\tfrac{1}{6}(1+2+3+4+5+6) = \\tfrac{21}{6}",
            },
            {
                title: "Simplify",
                explanation: "21/6 = 3.5.",
                math: "E[X] = 3.5",
            },
        ],
    },
    teachback: {
        prompt: "Now teach the class the expected value of the SUM of two fair six-sided dice.",
        problemMath: "E[X_1 + X_2]",
        answer: "7  (by linearity, E[X₁] + E[X₂] = 3.5 + 3.5 = 7)",
    },
    keyConcepts: [
        "E[X] = Σ value × probability",
        "For a fair die each outcome has probability 1/6",
        "Linearity of expectation: E[X+Y] = E[X] + E[Y]",
        "Linearity holds even if the variables aren't independent",
    ],
    expectedSteps: [
        "State E[X] = Σ value × probability.",
        "Note each die has expected value 3.5.",
        "Use linearity: E[X₁ + X₂] = E[X₁] + E[X₂].",
        "Add: 3.5 + 3.5 = 7.",
    ],
    commonMisconceptions: [
        "Averaging the two dice (3.5) instead of adding for the sum.",
        "Trying to enumerate all 36 outcomes and slipping arithmetic.",
        "Thinking linearity requires independence.",
        "Using probability 1/12 for each die face.",
    ],
    exampleQuestions: [
        "wait can we really just add the two averages?? 😮",
        "why is it 3.5 when you can't roll a 3.5 lol",
        "do the dice have to be independent for this",
        "is expected value just the average",
    ],
    students: makeStudents("probability"),
    suggestedReview: [
        "Definition of expected value",
        "Linearity of expectation",
        "Expected value of a fair die",
    ],
};

// --- Discrete math / combinatorics: combinations --------------------------
export const discreteLesson: Lesson = {
    id: "discrete-combinations",
    masterySlug: "discrete-combinatorics",
    topic: "Discrete Math & Combinatorics",
    title: "Counting with Combinations",
    icon: "🧮",
    blurb: "Count unordered selections using the binomial coefficient.",
    level: "Core",
    examArea: "Additional Topics",
    workedExample: {
        problem: "How many ways can you choose 2 people from a group of 5?",
        problemMath: "\\binom{5}{2}",
        steps: [
            {
                title: "Recognize order doesn't matter",
                explanation: "Choosing {A,B} is the same as {B,A}, so this is a combination, not a permutation.",
                math: "\\binom{n}{k} = \\frac{n!}{k!\\,(n-k)!}",
            },
            {
                title: "Plug into the formula",
                explanation: "Here n = 5, k = 2.",
                math: "\\binom{5}{2} = \\frac{5!}{2!\\,3!}",
            },
            {
                title: "Cancel and simplify",
                explanation: "5!/3! = 5·4 = 20, divided by 2! = 2.",
                math: "= \\frac{5\\cdot 4}{2\\cdot 1} = \\frac{20}{2}",
            },
            {
                title: "Compute",
                explanation: "The answer is 10.",
                math: "= 10",
            },
        ],
    },
    teachback: {
        prompt: "Now teach the class how many ways there are to choose 3 people from a group of 7.",
        problemMath: "\\binom{7}{3}",
        answer: "35  (7·6·5 / 3·2·1 = 210/6 = 35)",
    },
    keyConcepts: [
        "Combination = unordered selection",
        "C(n,k) = n! / (k!(n−k)!)",
        "Cancel factorials before multiplying to keep numbers small",
        "C(n,k) = C(n, n−k)",
    ],
    expectedSteps: [
        "Note order doesn't matter, so use C(7,3).",
        "Write C(7,3) = 7!/(3!·4!).",
        "Simplify to (7·6·5)/(3·2·1).",
        "Compute 210/6 = 35.",
    ],
    commonMisconceptions: [
        "Using permutations (7·6·5 = 210) and forgetting to divide by 3!.",
        "Dividing by the wrong factorial.",
        "Arithmetic slips multiplying the top.",
        "Confusing C(n,k) with n^k.",
    ],
    exampleQuestions: [
        "wait do we divide by 3 factorial or just 3 😵",
        "why does order not matter here",
        "is this the same as 7 times 6 times 5?",
        "what's the difference from permutations again",
    ],
    students: makeStudents("counting"),
    suggestedReview: [
        "Combinations vs permutations",
        "The formula C(n,k) = n!/(k!(n−k)!)",
        "Simplifying factorials",
    ],
};

// --- Numerical analysis: Newton's method ----------------------------------
export const numericalLesson: Lesson = {
    id: "numerical-newtons-method",
    masterySlug: "numerical-analysis",
    topic: "Numerical Analysis",
    title: "One Step of Newton's Method",
    icon: "🎯",
    blurb: "Improve a root estimate with a single Newton's-method iteration.",
    level: "Advanced",
    examArea: "Additional Topics",
    workedExample: {
        problem: "Use one step of Newton's method on f(x) = x² − 2 with x₀ = 1 to approximate √2.",
        problemMath: "f(x) = x^2 - 2,\\quad x_0 = 1",
        steps: [
            {
                title: "Newton's update formula",
                explanation: "Each step is x₁ = x₀ − f(x₀)/f′(x₀).",
                math: "x_{1} = x_0 - \\frac{f(x_0)}{f'(x_0)}",
            },
            {
                title: "Compute f and f′ at x₀",
                explanation: "f(1) = 1 − 2 = −1, and f′(x) = 2x so f′(1) = 2.",
                math: "f(1) = -1,\\quad f'(1) = 2",
            },
            {
                title: "Substitute",
                explanation: "Plug into the update formula.",
                math: "x_1 = 1 - \\frac{-1}{2} = 1 + 0.5",
            },
            {
                title: "Result",
                explanation: "x₁ = 1.5, already close to √2 ≈ 1.414.",
                math: "x_1 = 1.5",
            },
        ],
    },
    teachback: {
        prompt: "Now teach the class one step of Newton's method on f(x) = x² − 5 with x₀ = 2.",
        problemMath: "f(x) = x^2 - 5,\\quad x_0 = 2",
        answer: "x₁ = 2.25  (x₁ = 2 − (−1)/4 = 2 + 0.25)",
    },
    keyConcepts: [
        "Newton's method: x₁ = x₀ − f(x₀)/f′(x₀)",
        "You need both f(x₀) and the derivative f′(x₀)",
        "Each step is the x-intercept of the tangent line",
        "It converges fast near a simple root",
    ],
    expectedSteps: [
        "Write the update x₁ = x₀ − f(x₀)/f′(x₀).",
        "Compute f(2) = 4 − 5 = −1.",
        "Compute f′(x) = 2x, so f′(2) = 4.",
        "Substitute: x₁ = 2 − (−1)/4 = 2 + 0.25 = 2.25.",
    ],
    commonMisconceptions: [
        "Adding f(x₀)/f′(x₀) instead of subtracting (watch the sign of f).",
        "Forgetting to compute the derivative.",
        "Using f′ evaluated at the wrong point.",
        "Sign error: −(−1)/4 should be +0.25.",
    ],
    exampleQuestions: [
        "wait is it plus or minus the fraction 😵",
        "do we need the derivative every time??",
        "why did the minus become a plus there",
        "how close does one step even get us",
    ],
    students: makeStudents("Newton's method"),
    suggestedReview: [
        "Newton's method update formula",
        "Evaluating a function and its derivative at a point",
        "Signed arithmetic with the correction term",
    ],
};

/** All lessons available, in catalog order (warm-up first, then by exam area). */
export const lessons: Lesson[] = [
    pythagLesson,
    calculusLesson,
    linearAlgebraLesson,
    abstractAlgebraLesson,
    numberTheoryLesson,
    realAnalysisLesson,
    topologyLesson,
    complexAnalysisLesson,
    probabilityLesson,
    discreteLesson,
    numericalLesson,
];

/** Look up a lesson by id, defaulting to the warm-up (Pythagorean) lesson. */
export function getLesson(id?: string): Lesson {
    if (!id) {
        return pythagLesson;
    }
    return lessons.find((l) => l.id === id) ?? pythagLesson;
}
