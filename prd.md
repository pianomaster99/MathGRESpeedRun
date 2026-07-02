# LLM Student Simulator for Math GRE Preparation

## Goal

Build an MVP learning tool that helps Math GRE students improve their understanding by teaching mathematical concepts to simulated students.

The core idea is based on learning science: students learn more deeply when they prepare to teach, explain ideas aloud, answer questions, and receive feedback on gaps in their understanding.

## Objectives

1. **Apply learning science principles from `brainlift.md`**

   * Worked examples
   * Learning by teaching
   * Active recall
   * Diagnostic questioning
   * Feedback on misconceptions
   * Low-stress learning environments

2. **Build on top of the existing Anki codebase**

   * Use Anki’s existing study/review structure where possible.
   * Do not rebuild scheduling, decks, or card management from scratch.
   * Add this as a new learning mode or feature layer.

3. **Create a low-stress teaching environment**

   * The user teaches simulated students.
   * Student questions should be casual, friendly, and nonjudgmental.
   * The user should be able to return to the worked example at any point.
   * The goal is to diagnose misunderstanding, not to make the user feel tested.

4. **Support both desktop and mobile**

   * The MVP should be designed with both desktop and mobile versions in mind.
   * Desktop can prioritize a larger classroom layout.
   * Mobile can use a simplified layout with tabs or collapsible sections.

---

## Core Learning Flow

1. The user studies a worked-out Math GRE example.
2. The user is then asked to teach a similar problem in a simulated classroom.
3. The user explains the solution using text and/or drawings on a virtual board.
4. An LLM monitors the user’s explanation in the background.
5. When the LLM detects a missing step, misconception, vague explanation, or unexplained assumption, one simulated student asks a question.
6. The user can answer the student’s question directly or return to the worked example for help.
7. The user continues teaching after reviewing the worked example.
8. After the lesson, the system gives feedback on:

   * What the user explained well
   * What the user skipped or misunderstood
   * What concepts they should review next

---

## Stress-Reduction Feature: Return to Worked Example

To reduce stress, users should be able to return to the worked-out example at any point during the teaching lesson.

This includes:

* While they are explaining the similar problem
* After a simulated student asks a question
* Before answering a student’s question
* Before submitting the final lesson

The worked example should act as a supportive reference, not a penalty. The goal is to encourage learning and reduce the feeling of being tested.

When the user returns to the worked example, the system should preserve their current board state so they can continue the lesson afterward.

The system may optionally track when the user uses the worked example, but this should be used for feedback and support, not punishment. For example, if the user repeatedly returns to the same part of the worked example, the final feedback can mention that this concept may need more review.

---

## Classroom Interface

Each lesson should take place in a simple classroom setting.

### Desktop Layout

On desktop, the lesson should use a two-column classroom layout.

#### Left Side: Teaching Board

The left half of the screen should contain a board where the user can teach.

The board should support:

* Typed explanations
* Mathematical notation
* Freehand drawing
* Step-by-step solution writing

The board is the main context source for the LLM. The LLM should continuously receive the current board state and use it to evaluate the user’s explanation.

The board should also include a clear way to return to the worked example without ending the lesson or losing progress.

#### Right Side: Simulated Students

The right half of the screen should show several fake students sitting at desks.

Each student should have:

* A name or simple avatar
* A casual speaking style
* The ability to ask questions when selected by the LLM

When the LLM identifies a gap, it should choose one student to ask a short, natural question.

Example student questions:

* “Wait, why can you divide by that?”
* “I’m kinda lost on how you got that step.”
* “Can you explain why that solution works?”
* “How did you know to use that method?”
* “What happens if the initial condition is different?”

### Mobile Layout

On mobile, the classroom layout should be simplified so the interface is usable on a smaller screen.

The mobile version should include:

* A primary board view for teaching
* A way to open the simulated student view
* A way to return to the worked example
* A way to view and answer student questions
* A final lesson feedback screen

The mobile version does not need to show the board and students side by side. It can use tabs, a bottom navigation bar, collapsible panels, or a modal for student questions.

The priority for mobile is usability, not visual complexity.

---

## LLM Behavior

The LLM should act as a background teaching evaluator.

I actually want to build a mini llm agent. How about this. 
Everytime there is new input from user, we put into llm as screenshot of the board. 
First, we identify if there are any questions, or greetings, or anything unrelated to the problem that should elicit response from the students. If so, extract that phrase, and generate response in style of casual silly students based on the context of the entire board, problem statement, and student dialogue already present. At the same time, identify all steps in the user's solution to the problem. 

If there is a 
1. missing step
1. unclear step
1. wrong step
generate a question in style of one of the students to target the inconsistency. 
The student should be able to take any valid solution, does not have to follow any exact solution, but logic should flow.
However, specifically for the pythagorean theorem problem, one step we require if drawing out the triangle.
If the user has already used the pythagorean formula without drawing the triangle out, only then will we generate a question for the drawing.
After a crucial correct step has been identified, the llm should generate a question to reiterate the correct step. For example, a student could say, "Oh, so this formula works for any triangle with 90 degree angle?"

---

## Feedback After Each Lesson

After the user finishes teaching, the system should generate a feedback report.

The report should include:

1. **Strengths**

   * What the user explained clearly

2. **Knowledge Gaps**

   * What the user did not fully explain
   * Any misconceptions or missing steps

3. **Suggested Review**

   * Concepts the user should revisit
   * Optional Anki cards or topics to review next

4. **Worked Example Usage**

   * Whether the user returned to the worked example
   * Which parts they returned to, if tracked
   * What this suggests they may need to review

5. **Teaching Score**

   * A simple score or rating for clarity, correctness, and completeness

The feedback should be supportive and specific. It should help the user understand what to work on next without making them feel judged.

---

## User Persona

The target user is an undergraduate mathematics major, approximately 18–22 years old, preparing for the Math GRE.

The user likely has some mathematical background but may have forgotten details from earlier courses. They need practice recalling concepts, explaining reasoning, and identifying weak spots before the exam.

---

## User Story

As a Math GRE student, I want to teach a problem to simulated students so that I can discover what I do and do not understand before taking the test.

For the MVP, the user story does not need to adapt to test date, prior knowledge, or long-term study planning. The first version should focus on proving that the teaching interaction works.

---

## MVP Scope

The MVP should fully implement one complete lesson.

### MVP Topic

Ordinary Differential Equations

### MVP Lesson Flow

1. Show the user one worked-out ODE example.
2. Ask the user to teach a similar ODE problem on the board.
3. Let the user type and/or draw their explanation.
4. Allow the user to return to the worked example at any point.
5. Send the board context to the LLM.
6. Have simulated students ask diagnostic questions when the explanation has gaps.
7. Let the user answer student questions or review the worked example before answering.
8. Generate a post-lesson feedback report.

### MVP Platforms

The MVP should eventually support both:

* Desktop
* Mobile

For the first implementation, desktop may be built first because the classroom layout is easier to test on a larger screen. However, the architecture should avoid desktop-only assumptions so that the mobile version can be added cleanly afterward.

### MVP Success Criteria

The MVP is successful if:

* The user can complete one full teach-back lesson.
* The user can return to the worked example during the lesson without losing their current board work.
* The LLM can detect at least some missing or unclear reasoning.
* Simulated students can ask relevant questions.
* The user receives useful feedback after the lesson.
* The feature works inside or on top of the existing Anki codebase.
* The feature has a clear path to both desktop and mobile support.

---

## Tech Stack

* The project should be built inside the existing Git repository.
* Features should be implemented and committed incrementally.
* The existing Anki codebase should be reused whenever possible.
* The `OPENAI_API_KEY` is stored in the `.env` file.
* The MVP should prioritize functionality over visual polish.
* The implementation should support both desktop and mobile versions.
* Platform-specific UI code should be separated where possible from shared lesson logic, LLM logic, and feedback logic.

---

## Development Plan

### Step 1: Create the MVP Lesson Data

Define one worked example and one similar teach-back problem in ODEs.

Each lesson should include:

* Problem statement
* Worked solution
* Key concepts
* Expected user explanation steps
* Common misconceptions
* Example student questions

### Step 2: Build the Shared Lesson Logic

Create shared logic for:

* Loading lesson data
* Tracking the current lesson state
* Tracking board content
* Tracking student questions
* Tracking worked-example usage
* Generating the final feedback request

This logic should be reusable across desktop and mobile.

### Step 3: Build the Desktop Classroom UI

Create the desktop version first with:

* A board on the left
* Simulated students on the right
* A way to return to the worked example
* A button to finish the lesson

### Step 4: Build the Mobile Classroom UI

Create a mobile-friendly version with:

* A primary board screen
* A worked-example view
* A student-question view
* A final feedback screen

The mobile version can use tabs, modals, or collapsible panels instead of the desktop two-column layout.

### Step 5: Connect Board State to the LLM

Send the current board content to the LLM along with the expected explanation steps.

The LLM should return either:

* No interruption needed
* A student question targeting a specific gap

### Step 6: Display Student Questions

When the LLM identifies a gap, select one simulated student and show their question in casual language.

### Step 7: Generate Final Feedback

After the user ends the lesson, send the full lesson history to the LLM and generate structured feedback.

### Step 8: Commit Features Incrementally

Suggested commit sequence:

1. Add static ODE lesson data
2. Add shared lesson state logic
3. Add desktop classroom UI
4. Add board input
5. Add worked-example return feature
6. Add LLM gap-detection call
7. Add simulated student questions
8. Add final feedback report
9. Add mobile classroom UI
