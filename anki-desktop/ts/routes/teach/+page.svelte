<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

Entry point for Anki's "Teach-Back" learning mode.

This component owns the platform-neutral orchestration (phase switching,
choosing the desktop vs mobile layout, and the debounced background LLM loop)
while delegating all rendering to the shared shared-logic-driven children.
-->
<script lang="ts">
    import { lessons } from "$lib/teachback/lessons";
    import { checkHealth } from "$lib/teachback/llm";
    import { onMount } from "svelte";

    import LessonRunner from "./LessonRunner.svelte";
    import TopicHome from "./TopicHome.svelte";

    // Which lesson (if any) the user has picked. null => show the topic picker.
    let selectedId = $state<string | null>(null);

    onMount(() => {
        // Learn whether the AI evaluator is reachable so we can show its status.
        checkHealth();
    });
</script>

<svelte:head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link
        href="https://fonts.googleapis.com/css2?family=Gochi+Hand&display=swap"
        rel="stylesheet"
    />
</svelte:head>

<div class="teachback">
    {#if selectedId === null}
        <TopicHome {lessons} onSelect={(id) => (selectedId = id)} />
    {:else}
        {#key selectedId}
            <LessonRunner lessonId={selectedId} onExit={() => (selectedId = null)} />
        {/key}
    {/if}
</div>

<style lang="scss">
    :global(html),
    :global(body) {
        height: 100%;
        margin: 0;
    }

    .teachback {
        /* Light theme tokens (overridden for dark mode below). */
        --tb-bg: #f1f5f9;
        --tb-fg: #0f172a;
        --tb-muted: #64748b;
        --tb-panel: #ffffff;
        --tb-panel-2: #f8fafc;
        --tb-border: #e2e8f0;
        --tb-accent: #3b82f6;

        height: 100dvh;
        overflow: auto;
        background: var(--tb-bg);
        color: var(--tb-fg);
        font-family:
            -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    :global(body.night-mode) .teachback,
    :global(.night-mode) .teachback {
        --tb-bg: #0f172a;
        --tb-fg: #e2e8f0;
        --tb-muted: #94a3b8;
        --tb-panel: #1e293b;
        --tb-panel-2: #172033;
        --tb-border: #334155;
        --tb-accent: #60a5fa;
    }

    @media (prefers-color-scheme: dark) {
        .teachback {
            --tb-bg: #0f172a;
            --tb-fg: #e2e8f0;
            --tb-muted: #94a3b8;
            --tb-panel: #1e293b;
            --tb-panel-2: #172033;
            --tb-border: #334155;
            --tb-accent: #60a5fa;
        }
    }
</style>
