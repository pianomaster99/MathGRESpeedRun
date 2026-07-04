<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

One unified green chalkboard: freehand drawing AND draggable text boxes on the
same surface. Content is "draft" (faint) while you type/draw, and only "lands"
as solid chalk when you press Enter — which is also the moment the class sees it
and the evaluator reacts. Nothing is polled in the background.
-->
<script lang="ts">
    import type { Controller } from "$lib/teachback/controller";
    import type { Session } from "$lib/teachback/state";
    import type { LessonSession, TextBox } from "$lib/teachback/types";
    import { onMount, tick } from "svelte";

    let { session, controller }: { session: Session; controller: Controller } = $props();

    const s = $derived($session as LessonSession);

    type Tool = "pen" | "eraser" | "text";
    let tool = $state<Tool>("text");

    let surface: HTMLDivElement | undefined = $state();
    // Two layers: committed (opaque chalk) and pending (faint, not yet landed).
    let committed: HTMLCanvasElement | undefined = $state();
    let pending: HTMLCanvasElement | undefined = $state();
    let cctx: CanvasRenderingContext2D | null = null;
    let pctx: CanvasRenderingContext2D | null = null;

    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    function prep(ctx: CanvasRenderingContext2D | null) {
        if (ctx) {
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
        }
    }

    function resizeCanvas() {
        if (!committed || !pending || !surface) {
            return;
        }
        const rect = surface.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return;
        }
        for (const c of [committed, pending]) {
            c.width = rect.width;
            c.height = rect.height;
        }
        cctx = committed.getContext("2d");
        pctx = pending.getContext("2d");
        prep(cctx);
        prep(pctx);
        // Restore already-committed drawing.
        const stored = session.get().board.drawing;
        if (stored && stored.startsWith("data:image") && cctx) {
            const img = new Image();
            img.onload = () => cctx?.drawImage(img, 0, 0, committed!.width, committed!.height);
            img.src = stored;
        }
    }

    onMount(() => {
        resizeCanvas();
        const ro = new ResizeObserver(() => resizeCanvas());
        if (surface) {
            ro.observe(surface);
        }
        return () => ro.disconnect();
    });

    function localPos(e: PointerEvent): [number, number] {
        const rect = surface!.getBoundingClientRect();
        return [e.clientX - rect.left, e.clientY - rect.top];
    }

    async function onSurfacePointerDown(e: PointerEvent) {
        if (!surface) {
            return;
        }
        const [x, y] = localPos(e);
        if (tool === "text") {
            const rect = surface.getBoundingClientRect();
            const id = session.addTextBox(x / rect.width, y / rect.height);
            await tick();
            surface.querySelector<HTMLTextAreaElement>(`[data-box="${id}"] textarea`)?.focus();
            return;
        }
        if (!pctx || !cctx) {
            return;
        }
        drawing = true;
        [lastX, lastY] = [x, y];
        surface.setPointerCapture(e.pointerId);
    }

    function onSurfacePointerMove(e: PointerEvent) {
        if (!drawing) {
            return;
        }
        const [x, y] = localPos(e);
        if (tool === "eraser") {
            // Eraser works directly on the committed (landed) layer.
            if (!cctx || !committed) {
                return;
            }
            cctx.globalCompositeOperation = "destination-out";
            cctx.lineWidth = 28;
            cctx.beginPath();
            cctx.moveTo(lastX, lastY);
            cctx.lineTo(x, y);
            cctx.stroke();
        } else {
            // Pen draws onto the faint pending layer until committed.
            if (!pctx) {
                return;
            }
            pctx.globalCompositeOperation = "source-over";
            pctx.strokeStyle = "rgba(245, 245, 235, 0.95)";
            pctx.lineWidth = 3;
            pctx.shadowColor = "rgba(255, 255, 255, 0.35)";
            pctx.shadowBlur = 1.5;
            pctx.beginPath();
            pctx.moveTo(lastX, lastY);
            pctx.lineTo(x, y);
            pctx.stroke();
        }
        [lastX, lastY] = [x, y];
    }

    function onSurfacePointerUp() {
        if (!drawing) {
            return;
        }
        drawing = false;
        // Eraser edits committed immediately; persist that.
        if (tool === "eraser" && committed) {
            session.setDrawing(committed.toDataURL("image/png"));
        }
    }

    function clearDrawing() {
        if (cctx && pctx && committed && pending) {
            cctx.clearRect(0, 0, committed.width, committed.height);
            pctx.clearRect(0, 0, pending.width, pending.height);
            session.setDrawing(null);
        }
    }

    // Tracks whether the pen has drawn anything not yet committed.
    let pendingDirty = false;

    /** Land all draft text + pending strokes as solid chalk, then evaluate. */
    function commitBoard() {
        // commit text boxes
        for (const box of session.get().board.textBoxes) {
            if (box.text !== box.committed) {
                session.commitTextBox(box.id);
            }
        }
        // Merge pending strokes into committed — but only persist a drawing when
        // the pen was actually used, so text-only posts keep hasDrawing = false
        // (the agent uses that for the optional per-lesson "draw a diagram" nudge).
        if (pendingDirty && cctx && pctx && committed && pending) {
            cctx.globalCompositeOperation = "source-over";
            cctx.drawImage(pending, 0, 0);
            pctx.clearRect(0, 0, pending.width, pending.height);
            session.setDrawing(committed.toDataURL("image/png"));
        }
        pendingDirty = false;
        controller.reactToBoard();
    }

    function onBoxInput(box: TextBox, e: Event) {
        const el = e.target as HTMLTextAreaElement;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
        session.updateTextBox(box.id, el.value);
    }

    function onBoxKey(e: KeyboardEvent) {
        // Enter posts to the board; Shift+Enter makes a new line.
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            commitBoard();
        }
    }

    function onWindowKey(e: KeyboardEvent) {
        if (s.phase !== "teach") {
            return;
        }
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        if (tag === "TEXTAREA" || tag === "INPUT" || tag === "BUTTON" || tag === "A") {
            return; // those handle their own Enter
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commitBoard();
        }
    }

    let dragId: string | null = null;

    function startDrag(box: TextBox, e: PointerEvent) {
        e.stopPropagation();
        dragId = box.id;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    function onDrag(e: PointerEvent) {
        if (dragId === null || !surface) {
            return;
        }
        const rect = surface.getBoundingClientRect();
        const x = Math.min(0.98, Math.max(0, (e.clientX - rect.left) / rect.width));
        const y = Math.min(0.98, Math.max(0, (e.clientY - rect.top) / rect.height));
        session.moveTextBox(dragId, x, y);
    }

    function endDrag() {
        dragId = null;
    }

    const isEmpty = $derived(s.board.textBoxes.length === 0 && !s.board.hasDrawing);
</script>

<svelte:window onkeydown={onWindowKey} />

<div class="board">
    <div class="toolbar">
        <div class="tools">
            <button class:active={tool === "text"} onclick={() => (tool = "text")} title="Add text">
                🅣 Text
            </button>
            <button class:active={tool === "pen"} onclick={() => (tool = "pen")} title="Draw">
                🖊️ Pen
            </button>
            <button
                class:active={tool === "eraser"}
                onclick={() => (tool = "eraser")}
                title="Erase drawing"
            >
                🧽 Eraser
            </button>
        </div>
        <span class="enter-hint">⏎ Enter to post</span>
        <button class="clear" onclick={clearDrawing} title="Clear the drawing layer">
            Clear drawing
        </button>
    </div>

    <div
        class="surface"
        class:draw-mode={tool !== "text"}
        role="application"
        aria-label="Chalkboard: draw or place text, press Enter to post"
        bind:this={surface}
        onpointerdown={onSurfacePointerDown}
        onpointermove={(e) => {
            onSurfacePointerMove(e);
            if (drawing && tool === "pen") pendingDirty = true;
        }}
        onpointerup={onSurfacePointerUp}
        onpointerleave={onSurfacePointerUp}
    >
        <canvas class="committed" bind:this={committed}></canvas>
        <canvas class="pending" bind:this={pending}></canvas>

        {#each s.board.textBoxes as box (box.id)}
            <div
                class="textbox"
                data-box={box.id}
                role="group"
                aria-label="Text box"
                style={`left:${box.x * 100}%; top:${box.y * 100}%`}
                onpointerdown={(e) => e.stopPropagation()}
            >
                <div
                    class="tb-handle"
                    role="button"
                    tabindex="-1"
                    aria-label="Move text box"
                    onpointerdown={(e) => startDrag(box, e)}
                    onpointermove={onDrag}
                    onpointerup={endDrag}
                >
                    <span class="grip">⠿</span>
                    <button
                        class="tb-del"
                        aria-label="Delete text box"
                        onclick={() => session.removeTextBox(box.id)}
                    >×</button>
                </div>
                <textarea
                    class:draft={box.text !== box.committed}
                    rows="1"
                    placeholder="Type… ⏎ to post"
                    value={box.text}
                    oninput={(e) => onBoxInput(box, e)}
                    onkeydown={onBoxKey}
                ></textarea>
            </div>
        {/each}

        {#if isEmpty}
            <div class="empty-hint">
                <p>This is your chalkboard.</p>
                <p class="sub">
                    Use <strong>Text</strong> to write and <strong>Pen</strong> to draw. It shows up
                    faint while you work — press <strong>Enter</strong> to make it land as chalk
                    (that's when the class sees it).
                </p>
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    $chalk: rgba(245, 245, 235, 0.92);
    $chalk-dim: rgba(245, 245, 235, 0.5);
    $wood: #6b4a2f;
    $wood-dark: #573b25;

    .board {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        border-radius: 10px;
        overflow: hidden;
        border: 10px solid $wood;
        box-shadow:
            inset 0 0 0 2px $wood-dark,
            0 10px 26px rgba(0, 0, 0, 0.25);
        font-family: "Gochi Hand", "Comic Sans MS", cursive;
    }

    .toolbar {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.45rem 0.6rem;
        background: linear-gradient(180deg, $wood 0%, $wood-dark 100%);
        border-bottom: 2px solid rgba(0, 0, 0, 0.25);

        .tools {
            display: flex;
            gap: 0.3rem;
        }

        button {
            border: 1px solid rgba(255, 255, 255, 0.25);
            background: rgba(255, 255, 255, 0.08);
            padding: 0.3rem 0.7rem;
            border-radius: 7px;
            cursor: pointer;
            font-weight: 700;
            color: #fbe7c9;
            font-size: 0.95rem;
            font-family: inherit;

            &.active {
                background: $chalk;
                color: #2f4a39;
                border-color: $chalk;
            }
        }

        .clear {
            font-size: 0.9rem;
        }
    }

    .enter-hint {
        margin-left: auto;
        color: #fbe7c9;
        opacity: 0.85;
        font-size: 1rem;
        font-family: inherit;
    }

    .surface {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        background:
            radial-gradient(120% 90% at 50% 0%, rgba(255, 255, 255, 0.06) 0%, transparent 55%),
            radial-gradient(60% 50% at 80% 100%, rgba(255, 255, 255, 0.05) 0%, transparent 60%),
            #35533f;
        touch-action: none;
        cursor: crosshair;
    }

    canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }

    /* faint until committed */
    canvas.pending {
        opacity: 0.4;
    }

    .textbox {
        position: absolute;
        min-width: 180px;
        max-width: 66%;
        background: transparent;
        border: 1px dashed transparent;
        border-radius: 6px;
        overflow: hidden;
        z-index: 2;

        &:focus-within {
            border-color: rgba(255, 255, 255, 0.35);
        }
    }

    .tb-handle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1px 4px;
        color: $chalk-dim;
        cursor: grab;
        user-select: none;
        opacity: 0.55;

        &:hover {
            opacity: 1;
        }
        &:active {
            cursor: grabbing;
        }

        .grip {
            font-size: 0.8rem;
            letter-spacing: 1px;
        }
    }

    .tb-del {
        border: none;
        background: transparent;
        color: $chalk-dim;
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
        padding: 0 2px;

        &:hover {
            color: $chalk;
        }
    }

    .textbox textarea {
        display: block;
        width: 100%;
        border: none;
        outline: none;
        resize: none;
        padding: 0.1rem 0.4rem 0.4rem;
        font-family: "Gochi Hand", "Comic Sans MS", cursive;
        font-size: 1.75rem;
        line-height: 1.4;
        background: transparent;
        color: $chalk;
        text-shadow: 0 0 1px rgba(255, 255, 255, 0.35);
        overflow: hidden;
        transition: opacity 0.15s ease;

        /* draft = still being typed, not yet posted */
        &.draft {
            opacity: 0.4;
            font-style: italic;
        }

        &::placeholder {
            color: rgba(255, 255, 255, 0.35);
        }
    }

    .empty-hint {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        pointer-events: none;
        color: $chalk-dim;
        padding: 1rem;
        font-family: "Gochi Hand", "Comic Sans MS", cursive;

        p {
            margin: 0.15rem 0;
            font-size: 1.7rem;
            color: $chalk;
        }
        .sub {
            font-size: 1.25rem;
            max-width: 30rem;
            color: $chalk-dim;
        }
    }
</style>
