<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

Mobile classroom. No tabs: the board and the students are BOTH visible at all
times (stacked). The worked example is a collapsible panel between them, so
opening it shrinks the board a little but never hides the students. The LLM
watches the board live, so there is no manual "ask" button.
-->
<script lang="ts">
    import type { Controller } from "$lib/teachback/controller";
    import type { Session } from "$lib/teachback/state";
    import type { LessonSession } from "$lib/teachback/types";

    import AiStatus from "./AiStatus.svelte";
    import Board from "./Board.svelte";
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

<div class="mobile">
    <header class="mtop">
        <div class="mprompt">{s.lesson.teachback.prompt}</div>
        <AiStatus compact />
        {#if s.checking}<span class="live">●</span>{/if}
        <button
            class="ex-toggle"
            class:active={showExample}
            onclick={() => (showExample = !showExample)}
        >📖</button>
        <button class="finish" onclick={() => controller.finish()} disabled={s.generatingFeedback}>
            {s.generatingFeedback ? "…" : "Finish"}
        </button>
    </header>

    <section class="mboard">
        <Board {session} {controller} />
    </section>

    {#if showExample}
        <section class="mexample">
            <WorkedExample
                lesson={s.lesson}
                {session}
                mode="drawer"
                onClose={() => (showExample = false)}
            />
        </section>
    {/if}

    <section class="mstudents">
        <Students {session} />
    </section>
</div>

<style lang="scss">
    .mobile {
        display: flex;
        flex-direction: column;
        height: 100dvh;
        min-height: 0;
    }

    .mtop {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 0.8rem;
        border-bottom: 1px solid var(--tb-border, #e2e8f0);
        flex: 0 0 auto;
    }

    .mprompt {
        flex: 1;
        font-weight: 600;
        font-size: 0.85rem;
    }

    .live {
        color: #16a34a;
        font-weight: 700;
        animation: pulse 1.4s ease-in-out infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 0.4;
        }
        50% {
            opacity: 1;
        }
    }

    .ex-toggle,
    .finish {
        border: none;
        border-radius: 8px;
        padding: 0.45rem 0.7rem;
        font-weight: 700;
        cursor: pointer;
    }

    .ex-toggle {
        background: transparent;
        border: 1px solid var(--tb-border, #cbd5e1);
        color: inherit;
        &.active {
            background: var(--tb-accent, #3b82f6);
            border-color: var(--tb-accent, #3b82f6);
            color: #fff;
        }
    }

    .finish {
        background: #16a34a;
        color: #fff;
        &:disabled {
            opacity: 0.6;
        }
    }

    /* Board and students both always visible; example squeezes in between. */
    .mboard {
        flex: 1 1 auto;
        min-height: 220px;
        padding: 0.6rem 0.6rem 0;
        display: flex;
    }

    .mexample {
        flex: 0 0 auto;
        max-height: 34vh;
        overflow: hidden;
        margin: 0.6rem 0.6rem 0;
        border-radius: 12px;
    }

    .mstudents {
        flex: 0 0 36%;
        min-height: 0;
        overflow-y: auto;
        padding: 0.6rem;
        border-top: 1px solid var(--tb-border, #e2e8f0);
        background: var(--tb-panel-2, #f8fafc);
    }
</style>
