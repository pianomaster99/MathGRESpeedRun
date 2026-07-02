<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

Desktop classroom. The board and the students are visible at ALL times. The
worked example opens as a slide-in drawer that shrinks the board but never hides
the board or the students. An LLM watches the board live in the background, so
there is no manual "ask the class" button.
-->
<script lang="ts">
    import type { Controller } from "$lib/teachback/controller";
    import type { Session } from "$lib/teachback/state";
    import type { LessonSession } from "$lib/teachback/types";

    import AiStatus from "./AiStatus.svelte";
    import Board from "./Board.svelte";
    import Math from "./Math.svelte";
    import Students from "./Students.svelte";
    import WorkedExample from "./WorkedExample.svelte";

    let {
        session,
        controller,
    }: {
        session: Session;
        controller: Controller;
    } = $props();

    const s = $derived($session as LessonSession);
    let showExample = $state(false);
</script>

<div class="classroom">
    <div class="toolbar">
        <div class="prompt">
            <span class="label">Teaching:</span>
            <span class="text">{s.lesson.teachback.prompt}</span>
            {#if s.lesson.teachback.problemMath}
                <Math tex={s.lesson.teachback.problemMath} />
            {/if}
        </div>
        <div class="tools">
            <AiStatus />
            {#if s.checking}
                <span class="live" title="A student is following along right now">● live</span>
            {/if}
            <button
                class="secondary"
                class:active={showExample}
                onclick={() => (showExample = !showExample)}
            >
                📖 {showExample ? "Hide" : "Worked"} example
            </button>
            <button
                class="primary"
                onclick={() => controller.finish()}
                disabled={s.generatingFeedback}
            >
                {s.generatingFeedback ? "Finishing…" : "Finish lesson"}
            </button>
        </div>
    </div>

    <div class="grid" class:with-drawer={showExample}>
        {#if showExample}
            <section class="drawer">
                <WorkedExample
                    lesson={s.lesson}
                    {session}
                    mode="drawer"
                    onClose={() => (showExample = false)}
                />
            </section>
        {/if}
        <section class="board-col">
            <Board {session} {controller} />
        </section>
        <aside class="students-col">
            <Students {session} />
        </aside>
    </div>
</div>

<style lang="scss">
    .classroom {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--tb-border, #e2e8f0);
        flex-wrap: wrap;
    }

    .prompt {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;

        .label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--tb-muted, #94a3b8);
            font-weight: 700;
        }
        .text {
            font-weight: 600;
        }
    }

    .tools {
        display: flex;
        align-items: center;
        gap: 0.5rem;

        button {
            border-radius: 8px;
            padding: 0.5rem 0.9rem;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid transparent;
            font-size: 0.9rem;

            &:disabled {
                opacity: 0.6;
                cursor: default;
            }
        }
        .primary {
            background: #16a34a;
            color: #fff;
        }
        .secondary {
            background: transparent;
            border-color: var(--tb-border, #cbd5e1);
            color: inherit;

            &.active {
                background: var(--tb-accent, #3b82f6);
                border-color: var(--tb-accent, #3b82f6);
                color: #fff;
            }
        }
    }

    .live {
        color: #16a34a;
        font-weight: 700;
        font-size: 0.85rem;
        animation: pulse 1.4s ease-in-out infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 0.45;
        }
        50% {
            opacity: 1;
        }
    }

    .grid {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: 1fr 340px;
        gap: 1rem;
        padding: 1rem;

        &.with-drawer {
            grid-template-columns: 320px 1fr 340px;
        }
    }

    .drawer {
        min-height: 0;
        overflow: hidden;
        animation: slidein 0.18s ease;
    }

    @keyframes slidein {
        from {
            opacity: 0;
            transform: translateX(-8px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    .board-col {
        min-height: 0;
    }

    .students-col {
        min-height: 0;
        background: var(--tb-panel-2, #f8fafc);
        border-radius: 12px;
        padding: 1rem;
        border: 1px solid var(--tb-border, #e2e8f0);
        overflow-y: auto;
    }

    @media (max-width: 1100px) {
        .grid.with-drawer {
            grid-template-columns: 280px 1fr 300px;
        }
    }
</style>
