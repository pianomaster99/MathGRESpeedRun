// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

/**
 * Teach-Back LLM proxy server.
 *
 * A tiny, zero-dependency Node HTTP server (Node 18+, uses the built-in
 * `fetch`). Its only jobs are:
 *   1. Keep the OpenAI API key server-side (never shipped to the browser).
 *   2. Turn the shared lesson summary into two structured LLM calls:
 *        POST /api/gap       -> should a student interrupt, and with what?
 *        POST /api/feedback  -> the final structured feedback report.
 *
 * If no API key is configured, or OpenAI errors out, every endpoint degrades to
 * a deterministic local heuristic so the whole feature still works offline.
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.TEACHBACK_PORT ? Number(process.env.TEACHBACK_PORT) : 3999;
const MODEL = process.env.TEACHBACK_MODEL || "gpt-4o-mini";

// --- .env loading ----------------------------------------------------------
// Look in a few sensible places so the server works whether it's launched from
// the repo root, the anki-desktop folder, or its own directory.
function loadApiKey() {
    if (process.env.OPENAI_API_KEY) {
        return process.env.OPENAI_API_KEY;
    }
    const candidates = [
        join(__dirname, "..", "..", ".env"), // repo root (anki-brownfield/.env)
        join(__dirname, "..", ".env"), // anki-desktop/.env
        join(__dirname, ".env"), // teachback-server/.env
        join(process.cwd(), ".env"),
    ];
    for (const path of candidates) {
        try {
            const content = readFileSync(path, "utf8");
            for (const line of content.split(/\r?\n/)) {
                const m = line.match(/^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.+)\s*$/);
                if (m) {
                    let v = m[1].trim();
                    if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
                        v = v.slice(1, -1);
                    }
                    if (v) {
                        console.log(`[teachback] loaded OPENAI_API_KEY from ${path}`);
                        return v;
                    }
                }
            }
        } catch {
            // file not found / unreadable — try next candidate
        }
    }
    return null;
}

const OPENAI_API_KEY = loadApiKey();
if (!OPENAI_API_KEY) {
    console.warn("[teachback] No OPENAI_API_KEY found — running in offline heuristic mode.");
}

// --- OpenAI helper ---------------------------------------------------------
// Uses native Structured Outputs (json_schema + strict) when a schema is given,
// which guarantees the response matches our shape (no missing fields / bad
// enums), and falls back to plain json_object otherwise. Low temperature keeps
// the diagnostic judgments consistent while the persona text still varies.
async function callOpenAI(messages, { vision = false, schema = null, temperature = 0.3 } = {}) {
    if (!OPENAI_API_KEY) {
        throw new Error("no-api-key");
    }
    const response_format = schema
        ? { type: "json_schema", json_schema: schema }
        : { type: "json_object" };
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            temperature,
            response_format,
        }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`openai ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(content);
}

// Build the user turn: instructions + clearly-delimited context sections, plus
// the board drawing as an image when one exists (multimodal). Delimiters keep
// the model from confusing our instructions with the board data it evaluates.
function userContent(summary, instruction) {
    const ctx = {
        problem: summary.problem,
        expectedAnswer: summary.expectedAnswer,
        expectedSteps: summary.expectedSteps,
        keyConcepts: summary.keyConcepts,
        commonMisconceptions: summary.commonMisconceptions,
        students: summary.students,
        visual: summary.visual ?? null,
        workedExampleVisits: summary.workedExampleVisits,
    };
    const board = (summary.boardText || "").trim() || "(the board is blank)";
    const convo = (summary.conversation || [])
        .map((c) => `- ${c.who} (${c.role}/${c.kind}): ${c.text}`)
        .join("\n") || "(no one has spoken yet)";
    const text =
        `${instruction}\n\n`
        + `<lesson_reference>\n${JSON.stringify(ctx, null, 2)}\n</lesson_reference>\n\n`
        + `<board_text>\n${board}\n</board_text>\n\n`
        + `<has_drawing>${!!summary.hasDrawing}</has_drawing>\n\n`
        + `<conversation_memory>\n${convo}\n</conversation_memory>`;
    const textPart = { type: "text", text };
    const img = summary.drawing;
    if (summary.hasDrawing && typeof img === "string" && img.startsWith("data:image")) {
        return [textPart, { type: "image_url", image_url: { url: img } }];
    }
    return [textPart];
}

// --- Mini classroom agent --------------------------------------------------
// Strict output schema: the model must fill an "analysis" object (hidden
// chain-of-thought that the client ignores) BEFORE the "messages" it will speak.
const AGENT_SCHEMA = {
    name: "classroom_turn",
    strict: true,
    schema: {
        type: "object",
        additionalProperties: false,
        properties: {
            analysis: {
                type: "object",
                additionalProperties: false,
                properties: {
                    newSinceLastTurn: {
                        type: "string",
                        description: "What is genuinely new since the kids last spoke, or 'nothing new'.",
                    },
                    solutionSteps: {
                        type: "array",
                        items: { type: "string" },
                        description: "Ordered math steps currently on the board.",
                    },
                    issuesFound: {
                        type: "array",
                        items: { type: "string" },
                        description: "Each missing/unclear/wrong step with the reason; empty if none.",
                    },
                },
                required: ["newSinceLastTurn", "solutionSteps", "issuesFound"],
            },
            messages: {
                type: "array",
                description: "Zero or more student utterances for this turn (empty is normal).",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        studentId: { type: "string" },
                        text: { type: "string", description: "ONE short, casual sentence in that kid's voice." },
                        kind: { type: "string", enum: ["reaction", "question"] },
                        type: {
                            type: "string",
                            enum: ["greeting_reply", "offtopic_reply", "gap", "reinforce", "followup", "diagram"],
                        },
                    },
                    required: ["studentId", "text", "kind", "type"],
                },
            },
        },
        required: ["analysis", "messages"],
    },
};

const AGENT_SYSTEM = `# Role
You are the single shared mind controlling a small class of casual, good-natured,
slightly silly school kids in a LOW-STRESS "teach-back" tutor. A learner (the
"teacher") is teaching one math problem at a board. Make the class feel like real,
curious classmates: react warmly and ask short questions ONLY when the teacher's
explanation genuinely needs it. This is NOT a test — never be harsh or nitpicky.

# Inputs (in the user message, inside XML tags)
- <lesson_reference>: the PROBLEM, expectedAnswer, expectedSteps, keyConcepts,
  commonMisconceptions, the student roster (id + voice), an optional "visual"
  diagram hint, and worked-example visits. The teacher may use ANY valid method —
  do NOT force the expected steps; only require that the logic is correct and complete.
- <board_text>: everything currently written on the board.
- A board DRAWING image is included when <has_drawing>true</has_drawing>. Read the
  text and the drawing together.
- <conversation_memory>: every message already said this lesson. This is your
  MEMORY — never repeat or rephrase anything already there.

# You are called on EVERY post (even a repeated Enter)
So first work out what, if anything, is NEW. Silence is normal and common.

# Think first (fill the "analysis" field before deciding messages)
1. newSinceLastTurn: what genuinely changed since the kids last spoke — a new
   solution step, a new/changed figure, or a new remark/question the TEACHER wrote.
   (The kids' own earlier greetings do NOT make the teacher's greeting redundant.)
2. solutionSteps: the ordered math steps currently on the board.
3. issuesFound: any step that is MISSING, UNCLEAR, or WRONG, each with the reason.
   Judge ONLY what is already on the board; never anticipate steps not yet reached.

# Then choose 0+ messages (classify each with "type")
- "greeting_reply": teacher greeted or DIRECTLY asked the class something → always
  answer a direct question; a greeting gets one short, funny, in-character reply.
- "offtopic_reply": teacher wrote something unrelated to math (weather, breakfast)
  → one short funny remark; never treat it as a solution step.
- "gap": a NEW step is missing/unclear/wrong → ONE kid asks a casual question
  targeting that specific issue (different kids for different issues).
- "reinforce": when the teacher CORRECTLY states or uses a KEY idea for the first
  time — the core formula/theorem, a crucial insight, or the correct final answer —
  ONE kid SHOULD ask a short question that restates it to lock it in (e.g. "oh so
  this only works when there's a right angle, right?"). This is a WANTED teaching
  beat, not filler: do it once per key idea (not for routine arithmetic, never twice).
- "followup": the new content answers a question a kid asked earlier → that SAME
  kid confirms happily ("ohh that makes sense now, thanks! 🙌") or asks one short
  follow-up.
- "diagram" (kind = question): ONLY if a "visual" hint applies and no drawing
  exists yet → one kid asks the teacher to draw it, exactly once.

# Hard rules
- DO NOT force a reply for routine or unremarkable content, and return
  "messages": [] whenever nothing is new. But DO react to greetings and direct
  questions, to real gaps, and to the FIRST correct use of a key idea (reinforce).
  Empty is a perfectly good answer when none of those apply.
- NEVER invent an error — if the board is correct, do not fabricate a gap.
- NEVER repeat or rephrase anything already in <conversation_memory>.
- One issue per kid; each message is ONE short casual sentence in that kid's voice.
- kind = "reaction" for greeting_reply/offtopic_reply/reinforce/followup;
  kind = "question" for gap/diagram.
- Pick a studentId that exists in the roster.

# Examples
Input: <board_text> "hey team, how's everyone doing today?" </board_text>, no prior kid replies to it.
Output: {"analysis":{"newSinceLastTurn":"teacher greeted and asked the class a direct question","solutionSteps":[],"issuesFound":[]},"messages":[{"studentId":"riley","text":"we're good teach!! ready when you are 😎","kind":"reaction","type":"greeting_reply"}]}

Input: <board_text> unchanged from the previous turn </board_text>.
Output: {"analysis":{"newSinceLastTurn":"nothing new","solutionSteps":["(same as before)"],"issuesFound":[]},"messages":[]}

Input: eigenvalue lesson, <board_text> "det = 4*3 + 1*2 = 14" </board_text> (should be ad − bc = 10).
Output: {"analysis":{"newSinceLastTurn":"teacher computed the determinant","solutionSteps":["det via 4*3+1*2"],"issuesFound":["determinant used ad+bc instead of ad−bc; 14 should be 10"]},"messages":[{"studentId":"maya","text":"wait isn't the determinant ad MINUS bc?? so like 10, not 14 🤔","kind":"question","type":"gap"}]}

Return ONLY JSON matching the provided schema.`;

const FEEDBACK_SCHEMA = {
    name: "feedback_report",
    strict: true,
    schema: {
        type: "object",
        additionalProperties: false,
        properties: {
            analysis: {
                type: "object",
                additionalProperties: false,
                properties: {
                    correctApproach: {
                        type: "string",
                        description: "The correct solution/steps, worked out by you first.",
                    },
                    comparison: {
                        type: "string",
                        description: "How the teacher's board compares, line by line.",
                    },
                },
                required: ["correctApproach", "comparison"],
            },
            strengths: { type: "array", items: { type: "string" } },
            knowledgeGaps: { type: "array", items: { type: "string" } },
            suggestedReview: { type: "array", items: { type: "string" } },
            workedExampleUsage: { type: "string" },
            encouragement: { type: "string" },
        },
        required: [
            "analysis",
            "strengths",
            "knowledgeGaps",
            "suggestedReview",
            "workedExampleUsage",
            "encouragement",
        ],
    },
};

const FEEDBACK_SYSTEM = `# Role
You are the evaluator writing a short, supportive post-lesson report for someone
who just taught a math problem to simulated students in a LOW-STRESS tutor. Warm
but honest — help them improve without making them feel judged.

# Inputs (in the user message, inside XML tags)
- <lesson_reference>: the PROBLEM, expectedAnswer, expectedSteps, keyConcepts,
  commonMisconceptions, and worked-example visits.
- <board_text> (+ a drawing image when present): what the teacher actually taught.
- <conversation_memory>: the questions the kids asked during the lesson.

# Method — fill "analysis" FIRST
1. correctApproach: solve the problem correctly yourself (expectedAnswer is given);
   note the key correct steps. The teacher may use any valid method.
2. comparison: compare the board line-by-line to your solution, the expectedSteps,
   and the commonMisconceptions.

# Then write the report
- strengths: 2-4 SPECIFIC things they explained correctly (quote/paraphrase their
  actual work).
- knowledgeGaps: every real ERROR, missing step, or misconception, named
  SPECIFICALLY — quote the wrong line and give the correct version. Vague items
  like "could clarify more" are NOT acceptable when there is a real mistake. If the
  explanation was fully correct and complete, say so honestly and keep this short.
- suggestedReview: 2-4 concepts to revisit next.
- workedExampleUsage: comment on their worked-example visits. Treat ANY use as
  NORMAL learning, never a failure; if they returned to the same part repeatedly,
  gently note that concept may deserve review.
- encouragement: one warm closing sentence.

# Hard rules
- Do NOT output any numeric score, grade, rating, or percentage of any kind.
- Never label incorrect work as correct; never invent facts.

Return ONLY JSON matching the provided schema.`;

async function handleTurn(summary) {
    try {
        const result = await callOpenAI([
            { role: "system", content: AGENT_SYSTEM },
            {
                role: "user",
                content: userContent(
                    summary,
                    "The teacher just posted to the board. Decide what the kids say this turn (respond to any greeting/question, ask about a missing/unclear/wrong step, ask for a diagram only if the lesson's visual hint applies, and/or reinforce a crucial correct step). Judge only what's already there.",
                ),
            },
        ], { vision: summary.hasDrawing, schema: AGENT_SCHEMA, temperature: 0.3 });
        if (result.analysis) {
            console.log("[teachback] agent analysis:", JSON.stringify(result.analysis));
        }
        let messages = Array.isArray(result.messages) ? result.messages : [];
        messages = messages.filter((m) => m && typeof m.text === "string" && m.text.trim());
        const boardText = (summary.boardText || "").trim();
        // Safety net: never fire a diagnostic QUESTION on a trivial post (e.g. a
        // greeting). Gaps require the teacher to have actually written something.
        if (boardText.length < 20) {
            messages = messages.filter((m) => m.kind !== "question");
        }

        // --- Deterministic diagram rule (lesson-driven) -------------------
        // Only lessons that ship a "visual" hint can trigger a drawing request.
        // It fires once the board mentions any trigger word, no drawing exists,
        // and it hasn't been asked yet — and it's asked exactly once.
        const visual = summary.visual;
        const isDrawRequest = (t) => /\b(draw|sketch|diagram|graph|plot|picture)\b/i.test(t);
        const alreadyAskedDraw = (summary.conversation || []).some(
            (c) => c.role === "student" && isDrawRequest(c.text),
        );
        if (visual && Array.isArray(visual.triggerWords)) {
            const bt = boardText.toLowerCase();
            const triggered = visual.triggerWords.some((w) => bt.includes(String(w).toLowerCase()));
            const canAsk = triggered && !summary.hasDrawing && !alreadyAskedDraw;
            // Keep a model draw request only if it's currently warranted.
            messages = messages.filter((m) => !isDrawRequest(m.text) || canAsk);
            // Inject the diagram request if warranted and not already present.
            if (canAsk && !messages.some((m) => isDrawRequest(m.text))) {
                messages.push({
                    studentId: randomStudent(summary),
                    text: visual.request || "wait, can you draw that so we can see it? 👀",
                    kind: "question",
                });
            }
        } else {
            // No visual hint for this lesson: never ask for a drawing.
            messages = messages.filter((m) => !isDrawRequest(m.text));
        }
        // Final guard: never repeat (even reworded) a question/remark already said.
        const priorTexts = (summary.conversation || []).map((c) => c.text);
        messages = dropRepeats(messages, priorTexts);
        // Return only the client's contract (drop the internal "type"/analysis).
        const clean = messages.map((m) => ({ studentId: m.studentId, text: m.text, kind: m.kind }));
        return { messages: clean, source: "openai" };
    } catch (err) {
        console.warn("[teachback] agent OpenAI call failed, using heuristic:", err.message);
        return localTurn(summary);
    }
}

async function handleFeedback(summary) {
    try {
        const result = await callOpenAI([
            { role: "system", content: FEEDBACK_SYSTEM },
            {
                role: "user",
                content: userContent(
                    summary,
                    "Generate the final feedback report for this teaching session.",
                ),
            },
        ], { vision: summary.hasDrawing, schema: FEEDBACK_SCHEMA, temperature: 0.2 });
        if (!Array.isArray(result.knowledgeGaps)) {
            return localFeedback(summary);
        }
        if (result.analysis) {
            console.log("[teachback] feedback analysis:", JSON.stringify(result.analysis).slice(0, 300));
        }
        // Strip the internal reasoning; return only the client's report shape.
        const { analysis, ...report } = result;
        return { ...report, source: "openai" };
    } catch (err) {
        console.warn("[teachback] feedback OpenAI call failed, using heuristic:", err.message);
        return localFeedback(summary);
    }
}

// --- Local heuristics (mirror ts/lib/teachback/llm.ts) ---------------------
const normalize = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Near-duplicate detection so a rephrased question doesn't get asked twice.
function contentWords(t) {
    return (t || "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3);
}

function isNearDuplicate(a, b) {
    const na = normalize(a).replace(/[^a-z0-9 ]/g, "").trim();
    const nb = normalize(b).replace(/[^a-z0-9 ]/g, "").trim();
    if (na && na === nb) {
        return true;
    }
    const A = new Set(contentWords(a));
    const B = new Set(contentWords(b));
    // For very short messages (few content words) require an exact match above.
    if (A.size < 3 || B.size < 3) {
        return false;
    }
    let inter = 0;
    for (const w of A) {
        if (B.has(w)) inter++;
    }
    const union = A.size + B.size - inter;
    return union > 0 && inter / union >= 0.6;
}

/** Drop messages that repeat (even reworded) anything already said. */
function dropRepeats(messages, priorTexts) {
    const seen = [...priorTexts];
    const out = [];
    for (const m of messages) {
        if (seen.some((p) => isNearDuplicate(m.text, p))) {
            continue;
        }
        seen.push(m.text);
        out.push(m);
    }
    return out;
}

function studentSaid(summary) {
    return new Set(
        (summary.conversation || [])
            .filter((c) => c.role === "student")
            .map((c) => normalize(c.text)),
    );
}

function randomStudent(summary) {
    const students = summary.students || [{ id: "riley" }];
    return students[Math.floor(Math.random() * students.length)].id;
}

// Lesson-agnostic offline fallback: nudge with the lesson's own diagram hint or
// one of its example questions. It never fabricates topic-specific corrections.
function localTurn(summary) {
    const text = (summary.boardText ?? "").trim();
    const said = studentSaid(summary);
    const one = (t) => ({
        messages: [{ studentId: randomStudent(summary), text: t, kind: "question" }],
        source: "offline",
    });
    if (text.length < 25) return { messages: [], source: "offline" };
    // Diagram nudge, only if this lesson ships a visual hint and it's warranted.
    const visual = summary.visual;
    if (visual && Array.isArray(visual.triggerWords) && !summary.hasDrawing) {
        const bt = text.toLowerCase();
        if (visual.triggerWords.some((w) => bt.includes(String(w).toLowerCase()))) {
            const q = visual.request || "can you draw that so we can see it? 👀";
            if (!said.has(normalize(q))) return one(q);
        }
    }
    // Otherwise ask one still-unused example question for this lesson.
    for (const q of summary.exampleQuestions || []) {
        if (q && !said.has(normalize(q))) return one(q);
    }
    return { messages: [], source: "offline" };
}

function localFeedback(summary) {
    const text = summary.boardText ?? "";
    const visits = summary.workedExampleVisits || [];
    const revisited = visits.map((v) => v.step);
    const usage = visits.length === 0
        ? "You taught the whole lesson without opening the worked example — nice independence!"
        : `You returned to the worked example ${visits.length} time(s)`
            + (revisited.length ? `, most around: ${[...new Set(revisited)].join(", ")}.` : ".");
    return {
        strengths: [
            text.length > 100
                ? "You wrote out your reasoning step by step."
                : "You engaged with the problem and started explaining your steps.",
            summary.hasDrawing
                ? "You added a diagram to make it visual."
                : "You worked through the problem on the board.",
        ],
        // Offline can't verify correctness for arbitrary topics, so it says so
        // honestly rather than inventing topic-specific gaps.
        knowledgeGaps: [
            "The offline checker can't verify this topic in detail — start the LLM"
            + " proxy (with an OPENAI_API_KEY) for a line-by-line diagnosis.",
        ],
        suggestedReview: (summary.suggestedReview && summary.suggestedReview.length)
            ? summary.suggestedReview
            : ["Review the worked example and try teaching it again."],
        workedExampleUsage: usage,
        source: "offline",
        encouragement: OPENAI_API_KEY
            ? "Nice work teaching the lesson! (This report used the offline checker.)"
            : "Great job! Add an OPENAI_API_KEY to the .env for a much richer report.",
    };
}

// --- HTTP plumbing ---------------------------------------------------------
function send(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end(json);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => {
            data += chunk;
            if (data.length > 8 * 1024 * 1024) {
                reject(new Error("payload too large"));
                req.destroy();
            }
        });
        req.on("end", () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on("error", reject);
    });
}

const server = createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
        return send(res, 204, {});
    }
    if (req.method === "GET" && req.url === "/health") {
        return send(res, 200, { ok: true, model: MODEL, hasKey: !!OPENAI_API_KEY });
    }
    const routes = {
        "/api/gap": handleTurn, // run the mini agent on a board post
        "/api/feedback": handleFeedback,
    };
    if (req.method === "POST" && routes[req.url]) {
        try {
            const summary = await readBody(req);
            const result = await routes[req.url](summary);
            return send(res, 200, result);
        } catch (err) {
            console.error("[teachback] request error:", err);
            return send(res, 400, { error: String(err?.message || err) });
        }
    }
    return send(res, 404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`[teachback] proxy listening on http://127.0.0.1:${PORT} (model: ${MODEL}, key: ${OPENAI_API_KEY ? "yes" : "no"})`);
});
