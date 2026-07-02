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
async function callOpenAI(messages, { vision = false } = {}) {
    if (!OPENAI_API_KEY) {
        throw new Error("no-api-key");
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: vision ? 0.4 : 0.5,
            response_format: { type: "json_object" },
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

function userContent(summary, instruction) {
    // Build a multimodal message when the user has drawn on the board.
    const textPart = {
        type: "text",
        text: `${instruction}\n\nLESSON CONTEXT (JSON):\n${
            JSON.stringify({ ...summary, drawing: undefined }, null, 2)
        }`,
    };
    // Send the board text (as text) and the freehand drawing (as an image)
    // together in one multimodal message when a drawing exists.
    const img = summary.drawing;
    if (summary.hasDrawing && typeof img === "string" && img.startsWith("data:image")) {
        return [textPart, { type: "image_url", image_url: { url: img } }];
    }
    return [textPart];
}

// --- Mini classroom agent --------------------------------------------------
const AGENT_SYSTEM = `You are the single mind behind a small class of casual, silly school kids. A
teacher is teaching at the board. You are given: the problem statement, the
current board TEXT, the freehand DRAWING as an image (when present),
"hasDrawing" (whether a drawing exists), and the whole class conversation so far
(this includes every message the kids have ALREADY said — that is your memory).
Read the text and the drawing together.

You are called on EVERY post the teacher makes, even if they just pressed Enter
again without changing anything. So your FIRST job is to figure out what, if
anything, is NEW — and to stay silent when nothing new has happened.

Follow these steps in order:

STEP 1 — Break down the board into an ordered list of solution steps, PLUS any
  non-math text the teacher wrote to the class: greetings, questions, or
  OFF-TOPIC small talk (e.g. "how's the weather today?", "what did you have for
  breakfast?"). They may use ANY valid approach; do not force a specific
  solution, just check the logic flows.

STEP 2 — Compare against the conversation (your memory). Determine what is NEW
  since the kids last spoke: a new greeting/question/remark the TEACHER wrote, a
  newly added solution step, a newly drawn figure, or a change to something. Any
  new text the teacher wrote to the class counts as new (the kids' own earlier
  greetings do NOT make the teacher's greeting redundant). If NOTHING is new (the
  board is genuinely the same as when you last responded), return
  {"messages": []} and say nothing.

STEP 3 — Decide what the kids say, but DO NOT force a response. Only speak when
  there is a real reason (the cases below). If the new content doesn't call for a
  reply — e.g. a correct step with nothing notable, or a neutral statement — then
  return {"messages": []} and stay silent. Silence is normal and common. You may
  return MULTIPLE messages when several distinct things each warrant one.
  (a) CONVERSATION / SMALL TALK: if the TEACHER directly asks the class a question
      (e.g. "how are you guys doing?") answer it — a direct question always needs
      a reply. A greeting or off-topic small talk (weather, breakfast, weekend)
      usually gets a short, casual, FUNNY reply in character — but don't force one
      for every little thing. Don't force it back to math. (kind = "reaction")
  (b) GAP: for each NEW step that is MISSING, UNCLEAR, or WRONG, a kid asks a
      casual question targeting that specific inconsistency (different kids for
      different gaps).
      HARD RULE (this problem): drawing the triangle is a REQUIRED step. If the
      teacher has used the Pythagorean formula but hasDrawing is false, a kid
      asks them to draw the triangle — but ONLY once the formula has been used,
      and never again once a drawing exists.
  (c) REINFORCE: if the teacher just did a crucial CORRECT step, one kid asks a
      short question reiterating it, e.g. "oh so this only works for right
      triangles right?".
  (d) FOLLOW-UP / CONFIRM: if the NEW content answers or addresses a question a
      kid asked earlier in the conversation, that same kid confirms it happily
      ("ohh okok that makes sense now, thanks! 🙌") or asks ONE short follow-up
      question about it.

STRICT RULES:
- DO NOT force a response. If an input doesn't genuinely need one, return
  {"messages": []}. It is completely fine (and common) for the class to say
  nothing on a given post.
- Off-topic small talk is NOT a solution step — never treat it as a wrong/missing
  step; just answer it with a funny reaction.
- Judge ONLY what is already on the board. NEVER anticipate steps not yet reached
  (don't ask about the square root before c² is computed).
- Never repeat or rephrase something already said in the conversation.
- Do not respond to a step you have already responded to. If the teacher re-posts
  the same board, say nothing.
- Each message is ONE short, casual, sometimes silly sentence in the chosen
  kid's voice (voices provided). Pick a fitting studentId per message.

Return ONLY JSON:
{"messages": [{"studentId": string, "text": string, "kind": "reaction" | "question"}]}
Use "reaction" for conversational replies, "question" for gap/reinforcing
questions. Return {"messages": []} if nothing new happened.`;

const FEEDBACK_SYSTEM = `You are the evaluator generating a post-lesson feedback report for a student who
just taught a lesson to simulated students. Your ONLY job is to identify what
they got WRONG or MISSED. Do NOT give any numeric ratings, scores, grades, or
percentages of any kind. Your tone is warm and encouraging, but honest.

DIAGNOSE RIGOROUSLY:
1. Solve the problem correctly yourself first (the expected answer is provided).
2. Compare the student's board line-by-line to the expected steps and to the
   list of common misconceptions.
3. In knowledgeGaps, list every real ERROR, missing step, and misconception,
   named SPECIFICALLY (quote or paraphrase the wrong line and say what the
   correct version is). Vague items like "could clarify more" are NOT acceptable
   when there is an actual mistake — call the mistake out plainly but kindly.
   If the explanation was fully correct and complete, say so honestly.

Treat any use of the worked example as NORMAL learning, never a failure — but if
they returned to the same part repeatedly, note that concept may deserve review.
Never label incorrect work as correct, and never invent a score.

Respond ONLY with JSON of the form:
{
  "strengths": string[],
  "knowledgeGaps": string[],
  "suggestedReview": string[],
  "workedExampleUsage": string,
  "encouragement": string
}
Keep each list to 2-4 concise, concrete bullet points.`;

async function handleTurn(summary) {
    try {
        const result = await callOpenAI([
            { role: "system", content: AGENT_SYSTEM },
            {
                role: "user",
                content: userContent(
                    summary,
                    "The teacher just posted to the board. Decide what the kids say this turn (respond to any greeting/question, ask about a missing/unclear/wrong step, require the triangle drawing, and/or reinforce a crucial correct step). Judge only what's already there.",
                ),
            },
        ], { vision: summary.hasDrawing });
        let messages = Array.isArray(result.messages) ? result.messages : [];
        messages = messages.filter((m) => m && typeof m.text === "string" && m.text.trim());
        const boardText = (summary.boardText || "").trim();
        // Safety net: never fire a diagnostic QUESTION on a trivial post (e.g. a
        // greeting). Gaps require the teacher to have actually written something.
        if (boardText.length < 20) {
            messages = messages.filter((m) => m.kind !== "question");
        }

        // --- Deterministic drawing rule -----------------------------------
        // The triangle drawing is a REQUIRED step. Enforce it regardless of the
        // model's mood: a "draw the triangle" request is valid ONLY once the
        // formula has been used and no drawing exists yet, and is asked ONCE.
        const formulaUsed = /(\^\s*2|²|squared|pythag|sqrt|√|c\s*=|=\s*c\b)/i.test(boardText);
        const isDrawRequest = (t) => /draw|sketch/i.test(t) && /triangle/i.test(t);
        const alreadyAskedDraw = (summary.conversation || []).some(
            (c) => c.role === "student" && isDrawRequest(c.text),
        );
        // Keep a draw request only if valid AND not already asked — the triangle
        // is requested exactly once (dropping the model's rephrased repeats).
        messages = messages.filter(
            (m) => !isDrawRequest(m.text) || (formulaUsed && !summary.hasDrawing && !alreadyAskedDraw),
        );
        // Inject the required draw request if it's warranted and not yet asked.
        if (
            formulaUsed
            && !summary.hasDrawing
            && !alreadyAskedDraw
            && !messages.some((m) => isDrawRequest(m.text))
        ) {
            messages.push({
                studentId: randomStudent(summary),
                text: "wait, can you draw the triangle so we can actually see it? 👀",
                kind: "question",
            });
        }
        // Final guard: never repeat (even reworded) a question/remark already said.
        const priorTexts = (summary.conversation || []).map((c) => c.text);
        messages = dropRepeats(messages, priorTexts);
        return { messages, source: "openai" };
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
        ], { vision: summary.hasDrawing });
        if (!Array.isArray(result.knowledgeGaps)) {
            return localFeedback(summary);
        }
        return { ...result, source: "openai" };
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

function missingConcepts(text) {
    const t = normalize(text);
    const missing = [];
    if (!/(a\^?2|a²|square|squared|\^2)/.test(t)) missing.push("squaring the legs");
    if (!/(c\^?2|c²|a\^?2\s*\+\s*b\^?2|pythag)/.test(t)) missing.push("the formula a² + b² = c²");
    if (!/(sqrt|square root|√|root)/.test(t)) missing.push("taking the square root at the end");
    if (!/(hypotenuse|longest|opposite)/.test(t)) missing.push("which side is the hypotenuse");
    return missing;
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

// Only speaks about CURRENT gaps; never preempts steps not yet reached.
function localTurn(summary) {
    const text = (summary.boardText ?? "").trim();
    const said = studentSaid(summary);
    const one = (t) => ({
        messages: [{ studentId: randomStudent(summary), text: t, kind: "question" }],
        source: "offline",
    });
    if (text.length < 25) return { messages: [], source: "offline" };
    if (!summary.hasDrawing && text.length > 60) {
        const q = "can you draw the triangle?? i'm a visual learner 👀";
        if (!said.has(normalize(q))) return one(q);
    }
    const map = {
        "squaring the legs": "wait do we add them or square them first?? 😅",
        "the formula a² + b² = c²": "ummm what's the actual formula again lol",
        "taking the square root at the end": "do we HAVE to square root it or can i be lazy",
        "which side is the hypotenuse": "is c the long slanty side or nah?",
    };
    for (const concept of missingConcepts(text)) {
        const q = map[concept];
        if (q && !said.has(normalize(q))) return one(q);
    }
    return { messages: [], source: "offline" };
}

function localFeedback(summary) {
    const text = summary.boardText ?? "";
    const missing = missingConcepts(text);
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
                ? "You drew the triangle to make it visual."
                : "You worked through the problem on the board.",
        ],
        knowledgeGaps: missing.length
            ? missing.map((m) => `Your explanation didn't clearly cover ${m}.`)
            : ["No major gaps detected by the offline checker."],
        suggestedReview: missing.length
            ? [
                "When the Pythagorean theorem applies (right triangles only)",
                "Squaring numbers and taking square roots",
                "Identifying the hypotenuse vs the legs",
            ]
            : ["Keep practicing more right-triangle problems."],
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
