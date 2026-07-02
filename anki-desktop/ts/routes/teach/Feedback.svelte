<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html
-->
<script lang="ts">
    import type { Session } from "$lib/teachback/state";
    import type { LessonSession } from "$lib/teachback/types";

    let { session, onRestart }: { session: Session; onRestart?: () => void } = $props();

    const s = $derived($session as LessonSession);
    const fb = $derived(s.feedback);
</script>

<div class="feedback">
    {#if s.generatingFeedback && !fb}
        <div class="loading">
            <div class="spinner"></div>
            <p>Reviewing your lesson…</p>
        </div>
    {:else if fb}
        <header>
            <h1>Lesson Feedback</h1>
        </header>

        {#if fb.source === "offline"}
            <div class="offline-note">
                ⚠ This report came from the basic offline checker (the AI evaluator wasn't
                reachable). Start it with <code>just teachback-server</code> for a real diagnosis.
            </div>
        {/if}

        <section class="tb-card strengths">
            <h2>✅ Strengths</h2>
            <ul>
                {#each fb.strengths as item}<li>{item}</li>{/each}
            </ul>
        </section>

        <section class="tb-card gaps">
            <h2>🧩 Knowledge Gaps</h2>
            <ul>
                {#each fb.knowledgeGaps as item}<li>{item}</li>{/each}
            </ul>
        </section>

        <section class="tb-card review">
            <h2>📚 Suggested Review</h2>
            <ul>
                {#each fb.suggestedReview as item}<li>{item}</li>{/each}
            </ul>
        </section>

        <section class="tb-card usage">
            <h2>📖 Worked Example Usage</h2>
            <p>{fb.workedExampleUsage}</p>
        </section>

        <section class="tb-card encouragement">
            <p>{fb.encouragement}</p>
        </section>

        <div class="actions">
            <button class="primary" onclick={() => onRestart?.()}>Teach it again</button>
        </div>
    {:else}
        <p>No feedback available.</p>
        <button class="primary" onclick={() => onRestart?.()}>Start over</button>
    {/if}
</div>

<style lang="scss">
    .feedback {
        max-width: 760px;
        margin: 0 auto;
        padding: 1.5rem 1rem 3rem;
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;

        h1 {
            margin: 0;
            font-size: 1.6rem;
        }
    }

    .offline-note {
        background: color-mix(in srgb, #d97706 14%, transparent);
        color: #b45309;
        border: 1px solid color-mix(in srgb, #d97706 40%, transparent);
        border-radius: 10px;
        padding: 0.6rem 0.8rem;
        font-size: 0.85rem;
        margin-bottom: 1rem;

        code {
            background: rgba(0, 0, 0, 0.08);
            padding: 0 0.3rem;
            border-radius: 4px;
        }
    }

    .tb-card {
        background: var(--tb-panel, #fff);
        border: 1px solid var(--tb-border, #e2e8f0);
        border-radius: 12px;
        padding: 1rem 1.2rem;
        margin-bottom: 1rem;

        h2 {
            margin: 0 0 0.5rem;
            font-size: 1.1rem;
        }

        ul {
            margin: 0;
            padding-left: 1.2rem;
            line-height: 1.6;
        }

        p {
            margin: 0;
            line-height: 1.6;
        }
    }

    .strengths {
        border-left: 4px solid #16a34a;
    }
    .gaps {
        border-left: 4px solid #d97706;
    }
    .review {
        border-left: 4px solid #3b82f6;
    }
    .encouragement {
        background: var(--tb-panel-2, #eff6ff);
        font-style: italic;
    }

    .actions {
        display: flex;
        justify-content: center;
        margin-top: 1rem;
    }

    .primary {
        background: var(--tb-accent, #3b82f6);
        color: #fff;
        border: none;
        padding: 0.65rem 1.4rem;
        border-radius: 9px;
        font-weight: 700;
        cursor: pointer;
        font-size: 1rem;
    }

    .loading {
        text-align: center;
        padding: 4rem 1rem;
    }

    .spinner {
        width: 44px;
        height: 44px;
        border: 4px solid var(--tb-border, #e2e8f0);
        border-top-color: var(--tb-accent, #3b82f6);
        border-radius: 50%;
        margin: 0 auto 1rem;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
