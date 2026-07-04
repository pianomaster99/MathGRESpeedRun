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
    const stats = $derived(s.lessonStats);

    const pct = (x: number | null | undefined): string =>
        x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`;

    function masteryColor(x: number | null): string {
        if (x === null) return "var(--tb-muted, #94a3b8)";
        if (x >= 0.85) return "#16a34a";
        if (x >= 0.6) return "#d97706";
        return "#dc2626";
    }
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

        {#if stats}
            <section class="tb-card mastery">
                <h2>📊 Topic mastery update</h2>
                {#if stats.topic}
                    {@const t = stats.topic}
                    <div class="mtopic">
                        <div class="mtopic-head">
                            <span class="mname">{t.topic}</span>
                            <span class="mbig" style={`color:${masteryColor(t.combined)}`}>
                                {pct(t.combined)}
                            </span>
                        </div>
                        <div class="mtrack">
                            <div
                                class="mfill"
                                style={`width:${(t.combined ?? 0) * 100}%;background:${masteryColor(t.combined)}`}
                            ></div>
                        </div>
                        <div class="mbreak">
                            <span>🧠 memory {pct(t.memory)}</span>
                            <span>🎓 teaching {pct(t.teaching)}</span>
                            <span>· taught {t.teachCount}×</span>
                            {#if stats.teachScore !== null}
                                <span>· this lesson {pct(stats.teachScore)}</span>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <p class="muted">
                        This lesson was recorded. (Warm-up topics aren't part of the graded
                        exam breakdown.)
                    </p>
                {/if}

                <div class="three">
                    <div class="scard">
                        <div class="slabel">🧠 Memory</div>
                        {#if stats.scores.memory.abstained}
                            <div class="sval muted">—</div>
                            <div class="ssub">not enough data yet</div>
                        {:else}
                            <div class="sval" style={`color:${masteryColor(stats.scores.memory.value)}`}>
                                {pct(stats.scores.memory.value)}
                            </div>
                            <div class="ssub">
                                likely {pct(stats.scores.memory.low)}–{pct(stats.scores.memory.high)}
                            </div>
                        {/if}
                    </div>
                    <div class="scard">
                        <div class="slabel">🎓 Performance</div>
                        {#if stats.scores.performance.abstained}
                            <div class="sval muted">—</div>
                            <div class="ssub">keep teaching to unlock</div>
                        {:else}
                            <div
                                class="sval"
                                style={`color:${masteryColor(stats.scores.performance.value)}`}
                            >
                                {pct(stats.scores.performance.value)}
                            </div>
                            <div class="ssub">
                                likely {pct(stats.scores.performance.low)}–{pct(
                                    stats.scores.performance.high,
                                )}
                            </div>
                        {/if}
                    </div>
                    <div class="scard">
                        <div class="slabel">🎯 Readiness</div>
                        {#if stats.scores.readiness.abstained}
                            <div class="sval muted">—</div>
                            <div class="ssub">no score yet</div>
                        {:else}
                            <div class="sval">{stats.scores.readiness.scaled}</div>
                            <div class="ssub">
                                likely {stats.scores.readiness.scaledLow}–{stats.scores.readiness
                                    .scaledHigh}
                            </div>
                            <div class="swarn">⚠ not yet validated</div>
                        {/if}
                    </div>
                </div>
                <div class="moverall">
                    Three separate scores, each with a range · coverage
                    {pct(stats.scores.coverage)} · {stats.scores.gradedReviews} graded reviews ·
                    {stats.scores.lessonsVerified} graded lessons
                </div>
                {#if stats.scores.weakest}
                    <div class="mnext">🎯 Study next: {stats.scores.weakest.replace("-", " ")}</div>
                {/if}
            </section>
        {:else}
            <section class="tb-card mastery muted-card">
                Open Teach-Back inside the Anki app to fold this lesson into your topic-mastery
                statistics.
            </section>
        {/if}

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

    .mastery {
        border-left: 4px solid #8b5cf6;
    }
    .mtopic-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.5rem;
    }
    .mname {
        font-weight: 700;
        text-transform: capitalize;
    }
    .mbig {
        font-size: 1.5rem;
        font-weight: 800;
    }
    .mtrack {
        height: 12px;
        border-radius: 999px;
        background: var(--tb-track, #e5e7eb);
        overflow: hidden;
        margin: 6px 0 8px;
    }
    .mfill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.5s ease;
    }
    .mbreak {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        font-size: 0.85rem;
        color: var(--tb-muted, #64748b);
    }
    .three {
        display: flex;
        gap: 0.6rem;
        margin: 0.9rem 0 0.2rem;
        flex-wrap: wrap;
    }
    .scard {
        flex: 1 1 120px;
        text-align: center;
        background: var(--tb-panel-2, #f8fafc);
        border: 1px solid var(--tb-border, #e2e8f0);
        border-radius: 12px;
        padding: 0.7rem 0.5rem;
    }
    .slabel {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--tb-muted, #64748b);
    }
    .sval {
        font-size: 1.6rem;
        font-weight: 800;
        line-height: 1.2;
        margin-top: 2px;
    }
    .sval.muted {
        color: var(--tb-muted, #94a3b8);
    }
    .ssub {
        font-size: 0.74rem;
        color: var(--tb-muted, #64748b);
    }
    .swarn {
        font-size: 0.68rem;
        color: #b45309;
        margin-top: 2px;
    }

    .moverall {
        margin-top: 0.9rem;
        padding-top: 0.7rem;
        border-top: 1px solid var(--tb-border, #e2e8f0);
        font-size: 0.85rem;
        line-height: 1.5;
        color: var(--tb-muted, #64748b);
    }
    .mnext {
        margin-top: 0.4rem;
        font-weight: 600;
        color: #8b5cf6;
        text-transform: capitalize;
    }
    .muted,
    .muted-card {
        color: var(--tb-muted, #64748b);
        font-size: 0.9rem;
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
