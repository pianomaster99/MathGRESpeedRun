<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html
-->
<script lang="ts">
    import type { Session } from "$lib/teachback/state";
    import type { Lesson } from "$lib/teachback/types";
    import { onMount } from "svelte";

    import Math from "./Math.svelte";

    let {
        lesson,
        session,
        mode = "full",
        onClose,
    }: {
        lesson: Lesson;
        session: Session;
        mode?: "full" | "modal" | "drawer";
        onClose?: () => void;
    } = $props();

    const track = mode !== "full";

    // Which steps are expanded. In modal mode we start collapsed so we can learn
    // which parts the user actually opens; in full study mode everything is open.
    let expanded = $state<boolean[]>(lesson.workedExample.steps.map(() => !track));

    onMount(() => {
        if (track) {
            // Record that the user returned to the worked example as a whole.
            session.recordWorkedExampleVisit(-1, "worked example (opened)");
        }
    });

    function toggle(i: number) {
        expanded[i] = !expanded[i];
        if (track && expanded[i]) {
            session.recordWorkedExampleVisit(i, lesson.workedExample.steps[i].title);
        }
    }
</script>

<div class="worked-example" class:is-modal={mode === "modal"} class:is-drawer={mode === "drawer"}>
    <div class="header">
        <h2>Worked Example</h2>
        {#if mode !== "full"}
            <button class="tb-close" onclick={() => onClose?.()}>✕ Close</button>
        {/if}
    </div>

    <p class="problem">{lesson.workedExample.problem}</p>
    {#if lesson.workedExample.problemMath}
        <Math tex={lesson.workedExample.problemMath} display />
    {/if}

    <ol class="steps">
        {#each lesson.workedExample.steps as step, i}
            <li class="step">
                <button class="step-head" onclick={() => toggle(i)} aria-expanded={expanded[i]}>
                    <span class="chevron" class:open={expanded[i]}>▸</span>
                    <span class="step-title">{step.title}</span>
                </button>
                {#if expanded[i]}
                    <div class="step-body">
                        <p>{step.explanation}</p>
                        {#if step.math}
                            <Math tex={step.math} display />
                        {/if}
                    </div>
                {/if}
            </li>
        {/each}
    </ol>

    {#if track}
        <p class="hint">
            Looking things up here is part of learning — not a penalty. Take what you need,
            then head back to your board.
        </p>
    {/if}
</div>

<style lang="scss">
    .worked-example {
        background: var(--tb-panel, #fff);
        color: var(--tb-fg, #1a1a1a);
        border-radius: 12px;
        padding: 1.25rem 1.5rem;
        max-width: 720px;

        &.is-modal {
            width: min(720px, 92vw);
            max-height: 88vh;
            overflow-y: auto;
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
        }

        &.is-drawer {
            width: 100%;
            max-width: none;
            height: 100%;
            overflow-y: auto;
            border: 1px solid var(--tb-border, #e2e8f0);
            padding: 1rem 1.1rem;
        }
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.5rem;

        h2 {
            margin: 0;
            font-size: 1.2rem;
        }
    }

    .tb-close {
        border: none;
        background: var(--tb-accent, #3b82f6);
        color: #fff;
        padding: 0.45rem 0.8rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        white-space: nowrap;
    }

    .problem {
        font-weight: 600;
        font-size: 1.05rem;
        margin: 0.25rem 0;
    }

    .steps {
        list-style: none;
        margin: 0.75rem 0 0;
        padding: 0;
        counter-reset: step;
    }

    .step {
        border: 1px solid var(--tb-border, #e2e8f0);
        border-radius: 8px;
        margin-bottom: 0.5rem;
        overflow: hidden;
    }

    .step-head {
        counter-increment: step;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: var(--tb-panel-2, #f8fafc);
        border: none;
        padding: 0.7rem 0.9rem;
        cursor: pointer;
        text-align: left;
        font-size: 0.98rem;
        color: inherit;

        &::before {
            content: counter(step);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 1.5rem;
            height: 1.5rem;
            border-radius: 50%;
            background: var(--tb-accent, #3b82f6);
            color: #fff;
            font-size: 0.8rem;
            font-weight: 700;
            flex: 0 0 auto;
        }
    }

    .chevron {
        transition: transform 0.15s ease;
        &.open {
            transform: rotate(90deg);
        }
    }

    .step-title {
        font-weight: 600;
    }

    .step-body {
        padding: 0.6rem 0.9rem 0.9rem 3rem;
        p {
            margin: 0 0 0.3rem;
            line-height: 1.5;
        }
    }

    .hint {
        margin-top: 1rem;
        font-size: 0.85rem;
        font-style: italic;
        color: var(--tb-muted, #64748b);
    }
</style>
