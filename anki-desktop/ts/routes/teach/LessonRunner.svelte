<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

Runs a single selected lesson through its phases (study -> teach -> feedback),
choosing the desktop vs mobile classroom, and offering a way back to the topic
picker. A fresh session/controller is created per lesson (the parent keys this
component by lesson id), so no state leaks between topics.
-->
<script lang="ts">
    import { createController } from "$lib/teachback/controller";
    import { getLesson } from "$lib/teachback/lessons";
    import { createSession } from "$lib/teachback/state";
    import type { LessonSession } from "$lib/teachback/types";
    import { onMount, untrack } from "svelte";

    import Classroom from "./Classroom.svelte";
    import Feedback from "./Feedback.svelte";
    import MobileClassroom from "./MobileClassroom.svelte";
    import StudyIntro from "./StudyIntro.svelte";

    let { lessonId, onExit }: { lessonId: string; onExit: () => void } = $props();

    // The parent remounts this component per lesson via {#key lessonId}, so we
    // intentionally read the initial lessonId to build the session once.
    const lesson = getLesson(untrack(() => lessonId));
    const session = createSession(lesson);
    const controller = createController(session);
    const s = $derived($session as LessonSession);

    let isMobile = $state(false);
    onMount(() => {
        const mq = window.matchMedia("(max-width: 820px)");
        const update = () => (isMobile = mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    });

    const phaseLabel = $derived(
        s.phase === "study" ? "Study" : s.phase === "teach" ? "Teaching" : "Feedback",
    );
</script>

<div class="runner">
    <header class="runner-bar">
        <button class="back" onclick={() => onExit()} title="Back to all topics">
            <span aria-hidden="true">←</span> All topics
        </button>
        <div class="crumb">
            {#if lesson.icon}<span class="ico" aria-hidden="true">{lesson.icon}</span>{/if}
            <span class="title">{lesson.title}</span>
            <span class="sep">·</span>
            <span class="phase">{phaseLabel}</span>
        </div>
        <span class="grow"></span>
    </header>

    <div class="runner-body" class:scroll={s.phase !== "teach"}>
        {#if s.phase === "study"}
            <StudyIntro {session} onStart={() => session.startTeaching()} />
        {:else if s.phase === "teach"}
            {#if isMobile}
                <MobileClassroom {session} {controller} />
            {:else}
                <Classroom {session} {controller} />
            {/if}
        {:else}
            <Feedback {session} onRestart={() => session.reset()} />
        {/if}
    </div>
</div>

<style lang="scss">
    .runner {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .runner-bar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.9rem;
        border-bottom: 1px solid var(--tb-border, #e2e8f0);
        background: var(--tb-panel, #fff);
    }

    .back {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        border: 1px solid var(--tb-border, #cbd5e1);
        background: transparent;
        color: inherit;
        border-radius: 8px;
        padding: 0.4rem 0.75rem;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;

        &:hover {
            background: var(--tb-panel-2, #f1f5f9);
            border-color: var(--tb-accent, #3b82f6);
        }
        span {
            font-size: 1.05rem;
            line-height: 1;
        }
    }

    .crumb {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        min-width: 0;
        color: var(--tb-muted, #64748b);
        font-size: 0.92rem;

        .ico {
            font-size: 1.1rem;
        }
        .title {
            font-weight: 700;
            color: var(--tb-fg, #0f172a);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .sep {
            opacity: 0.5;
        }
        .phase {
            text-transform: uppercase;
            letter-spacing: 0.04em;
            font-size: 0.72rem;
            font-weight: 700;
        }
    }

    .grow {
        flex: 1;
    }

    .runner-body {
        flex: 1;
        min-height: 0;

        &.scroll {
            overflow: auto;
        }
    }

    @media (max-width: 560px) {
        .crumb .sep,
        .crumb .phase {
            display: none;
        }
    }
</style>
