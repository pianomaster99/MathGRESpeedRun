<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html
-->

# Teach-Back — an LLM Student Simulator for Math GRE prep

A new **learning mode** layered on top of Anki. Instead of only reviewing cards,
the student *teaches* a worked-out problem to a small class of simulated
students. An LLM watches the explanation in the background and, when it spots a
gap, has one student ask a short, casual question. At the end the student gets a
supportive, structured feedback report.

This is grounded in the research in `brainlift.md` (the "Protégé Effect" /
expectation-to-teach literature): the value comes from *preparing to teach* in a
**low-stress** environment, so the LLM students are friendly, non-judgmental,
and the worked example is always one tap away.

## Where things live

The feature is split into **shared, platform-agnostic logic** and **per-platform
UI**, so desktop and mobile share the exact same lesson/LLM/feedback code.

```
ts/lib/teachback/          # SHARED logic — no UI, no platform assumptions
  types.ts                 #   all data shapes (also the JSON contract with the server)
  lessons.ts               #   the static lesson (Pythagorean theorem: worked example + teach-back)
  state.ts                 #   the lesson-session store + actions + LLM summary builder
  controller.ts            #   "when do we call the LLM" policy (debounce / cap / finish)
  llm.ts                   #   client for the proxy, with offline heuristic fallbacks
  math.ts                  #   lazy KaTeX loader + render helper

ts/routes/teach/           # UI (Anki SvelteKit route -> served at /_anki/pages/teach)
  +page.svelte             #   phase switching + picks desktop vs mobile + live LLM feed
  StudyIntro.svelte        #   study the worked example first
  Classroom.svelte         #   DESKTOP: board + students always visible; worked-example drawer
  MobileClassroom.svelte   #   MOBILE: board + students always visible; collapsible example (no tabs)
  Board.svelte             #   ONE whiteboard: freehand pen/eraser + draggable, editable text boxes
  WorkedExample.svelte     #   worked example (study view + return drawer, tracks visits)
  Students.svelte          #   student desks, speech bubbles, answer boxes
  Feedback.svelte          #   post-lesson report (scores + strengths/gaps/review)
  Math.svelte              #   renders a LaTeX string

teachback-server/          # tiny zero-dependency LLM proxy (keeps the API key off the client)
  server.mjs
  package.json
```

## Running it (development)

The classroom talks to a small proxy that keeps your `OPENAI_API_KEY`
server-side. The key is read from the repo-root `.env` automatically.

1. **Start the proxy server** (from `anki-desktop/`):

   ```bash
   just teachback-server
   # or: node teachback-server/server.mjs
   ```

   It listens on `http://127.0.0.1:3999`. If no key is found, or OpenAI errors,
   it falls back to deterministic offline heuristics so the lesson still works.

2. **Start the frontend** (from `anki-desktop/`):

   ```bash
   yarn dev
   ```

   Then open <http://127.0.0.1:5173/teach>.

In the packaged Anki app the route is built with the rest of the SvelteKit
frontend and served by the media server via the SPA fallback at
`/_anki/pages/teach`.

## Configuration

- `OPENAI_API_KEY` — read from `.env` (repo root), `anki-desktop/.env`, or the
  environment.
- `TEACHBACK_PORT` (default `3999`), `TEACHBACK_MODEL` (default `gpt-4o-mini`).
- `VITE_TEACHBACK_API` — override the proxy URL the browser calls.

The board is a single green **chalkboard**: use the **Text** tool to drop
draggable, editable chalk boxes anywhere and the **Pen/Eraser** to sketch on the
same surface (chalk font + chalk strokes). The right half is a simSchool-style
classroom of kids who greet you casually when the lesson starts. Nothing is
polled: when you **press Enter** your draft text/drawing "lands" as solid chalk
and a single **mini classroom agent** runs once on the whole board (the text sent
as text, the freehand drawing sent as an image, together). Judging only what's
*already* on the board, it can emit several student utterances in one turn:
reply to a greeting/question you wrote, ask about a **missing/unclear/wrong step
of any valid solution**, ask you to **draw the triangle** (only once you've used
the formula and haven't drawn), and/or **reinforce a crucial correct step**
(e.g. "oh so this only works for right triangles?"). The post-lesson report has
**no numeric ratings** — it just identifies what was missing or wrong.

## Launching it from Anki (built in)

There is a **Tools → "Teach-Back (Math GRE)"** menu entry in the desktop app. It
opens `qt/aqt/teachback.py`'s `TeachBackDialog`, which hosts the `/teach`
SvelteKit page in a webview. Wiring:

- `qt/aqt/teachback.py` — the launcher window (`web.load_sveltekit_page("teach")`).
- `qt/aqt/main.py` — adds the Tools menu action (`on_teachback`).
- `qt/aqt/mediasrv.py` — registers `"teach"` in `is_sveltekit_page` so the media
  server serves the route at `/_anki/pages/teach`.

To try it: run `just run` (builds the web + launches Anki), start the LLM proxy
with `just teachback-server`, then click **Tools → Teach-Back (Math GRE)**. In
web HMR mode the webview loads the route from the Vite dev server automatically.

## Path to mobile / AnkiDroid

The desktop route already ships a dedicated **mobile layout** (board and students
stacked and always visible, collapsible worked example, no tabs) that activates
below 820px, so it is usable on phones today. Because every bit of
lesson/LLM/feedback logic lives in
`ts/lib/teachback/` (pure TypeScript), AnkiDroid can reuse it directly by hosting
these same routes in its `WebView`, or by porting only the thin UI layer while
calling the identical shared logic and proxy contract.
