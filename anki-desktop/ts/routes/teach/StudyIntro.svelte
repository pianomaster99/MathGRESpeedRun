<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html
-->
<script lang="ts">
    import type { Session } from "$lib/teachback/state";
    import type { LessonSession } from "$lib/teachback/types";

    import Math from "./Math.svelte";
    import WorkedExample from "./WorkedExample.svelte";

    let { session, onStart }: { session: Session; onStart?: () => void } = $props();

    const s = $derived($session as LessonSession);
</script>

<div class="intro">
    <div class="intro-head">
        <span class="pill">{s.lesson.topic}</span>
        <h1>{s.lesson.title}</h1>
        <p class="lead">
            Study this worked example carefully — in a moment you'll teach a similar problem to
            a small class of students. You're not being tested; you're helping them learn (and
            spotting your own gaps along the way).
        </p>
    </div>

    <WorkedExample lesson={s.lesson} {session} mode="full" />

    <div class="next">
        <h2>Your turn to teach</h2>
        <p class="teach-prompt">{s.lesson.teachback.prompt}</p>
        {#if s.lesson.teachback.problemMath}
            <Math tex={s.lesson.teachback.problemMath} display />
        {/if}
        <button class="start" onclick={() => onStart?.()}>I'm ready to teach →</button>
    </div>
</div>

<style lang="scss">
    .intro {
        max-width: 760px;
        margin: 0 auto;
        padding: 1.5rem 1rem 3rem;
    }

    .pill {
        display: inline-block;
        background: var(--tb-accent, #3b82f6);
        color: #fff;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 0.25rem 0.7rem;
        border-radius: 999px;
    }

    h1 {
        margin: 0.6rem 0 0.4rem;
        font-size: 1.7rem;
    }

    .lead {
        color: var(--tb-muted, #475569);
        line-height: 1.6;
        margin: 0 0 1.5rem;
    }

    .next {
        margin-top: 1.5rem;
        background: var(--tb-panel-2, #eff6ff);
        border: 1px solid var(--tb-border, #dbeafe);
        border-radius: 12px;
        padding: 1.2rem 1.4rem;
        text-align: center;

        h2 {
            margin: 0 0 0.5rem;
        }
    }

    .teach-prompt {
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0.25rem 0;
    }

    .start {
        margin-top: 1rem;
        background: var(--tb-accent, #3b82f6);
        color: #fff;
        border: none;
        padding: 0.75rem 1.6rem;
        border-radius: 10px;
        font-size: 1.05rem;
        font-weight: 700;
        cursor: pointer;
    }
</style>
