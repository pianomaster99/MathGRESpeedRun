<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

The Teach-Back home page: pick a GRE Math topic to teach. Lessons are grouped by
exam area (Calculus 50%, Algebra 25%, Additional Topics 25%). Fully responsive —
the grid reflows from multi-column on desktop to a single column on mobile.
-->
<script lang="ts">
    import type { ExamArea, Lesson } from "$lib/teachback/types";

    import AiStatus from "./AiStatus.svelte";

    let { lessons, onSelect }: { lessons: Lesson[]; onSelect: (id: string) => void } = $props();

    // Fixed display order for the exam areas.
    const AREA_ORDER: ExamArea[] = ["Warm-up", "Calculus", "Algebra", "Additional Topics"];
    const AREA_BLURB: Record<ExamArea, string> = {
        "Warm-up": "Get comfortable teaching at the board.",
        "Calculus": "~50% of the GRE Mathematics Subject Test.",
        "Algebra": "~25% of the test — linear, abstract, and number theory.",
        "Additional Topics": "~25% — analysis, topology, probability, and more.",
    };
    // Accent colour per area, applied as a CSS variable so each card can tint its
    // icon chip, top stripe, and call-to-action consistently.
    const AREA_ACCENT: Record<ExamArea, string> = {
        "Warm-up": "#f59e0b",
        "Calculus": "#3b82f6",
        "Algebra": "#8b5cf6",
        "Additional Topics": "#10b981",
    };

    const groups = $derived(
        AREA_ORDER
            .map((area) => ({
                area,
                blurb: AREA_BLURB[area],
                items: lessons.filter((l) => (l.examArea ?? "Additional Topics") === area),
            }))
            .filter((g) => g.items.length > 0),
    );

    function levelClass(level?: string): string {
        const l = (level ?? "").toLowerCase();
        if (l.includes("warm")) return "lvl-warm";
        if (l.includes("adv")) return "lvl-adv";
        return "lvl-core";
    }
</script>

<div class="home">
    <header class="hero">
        <div class="hero-main">
            <span class="eyebrow">Teach-Back · Math GRE</span>
            <h1>Pick a topic to teach</h1>
            <p class="lead">
                You learn it best by teaching it. Choose a topic, study the worked example, then
                explain it to a small class of (slightly goofy) students — they'll interrupt with
                questions whenever your explanation has a gap.
            </p>
        </div>
        <div class="hero-side">
            <AiStatus />
            <div class="count">{lessons.length} lessons</div>
        </div>
    </header>

    {#each groups as group (group.area)}
        <section class="group" style={`--accent:${AREA_ACCENT[group.area]}`}>
            <div class="group-head">
                <h2>{group.area}</h2>
                <span class="group-blurb">{group.blurb}</span>
            </div>
            <div class="grid">
                {#each group.items as lesson (lesson.id)}
                    <button class="card" onclick={() => onSelect(lesson.id)}>
                        <span class="stripe" aria-hidden="true"></span>
                        <div class="card-top">
                            <span class="icon" aria-hidden="true">{lesson.icon ?? "📘"}</span>
                            <span class="badge {levelClass(lesson.level)}">{lesson.level ?? "Core"}</span>
                        </div>
                        <h3>{lesson.title}</h3>
                        <p class="topic">{lesson.topic}</p>
                        {#if lesson.blurb}<p class="blurb">{lesson.blurb}</p>{/if}
                        <span class="go">Teach this <span class="arrow" aria-hidden="true">→</span></span>
                    </button>
                {/each}
            </div>
        </section>
    {/each}

    <footer class="foot">
        Simulated students give casual, in-character reactions. An LLM watches your board live to
        spot gaps — with the AI switched off, you can still teach and get a basic report.
    </footer>
</div>

<style lang="scss">
    .home {
        max-width: 1040px;
        margin: 0 auto;
        padding: 1.5rem 1.1rem 3rem;
    }

    .hero {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1.5rem;
        flex-wrap: wrap;
        margin-bottom: 1.75rem;
    }

    .hero-main {
        flex: 1 1 380px;
        min-width: 0;
    }

    .eyebrow {
        display: inline-block;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.72rem;
        font-weight: 800;
        color: var(--tb-accent, #3b82f6);
        margin-bottom: 0.35rem;
    }

    h1 {
        margin: 0 0 0.5rem;
        font-size: 2rem;
        line-height: 1.15;
    }

    .lead {
        margin: 0;
        color: var(--tb-muted, #64748b);
        line-height: 1.6;
        max-width: 62ch;
    }

    .hero-side {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.5rem;
    }

    .count {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--tb-muted, #64748b);
    }

    .group {
        margin-top: 1.75rem;
    }

    .group-head {
        display: flex;
        align-items: baseline;
        gap: 0.6rem;
        flex-wrap: wrap;
        padding-bottom: 0.4rem;
        margin-bottom: 1rem;
        border-bottom: 2px solid var(--tb-border, #e2e8f0);

        h2 {
            margin: 0;
            font-size: 1.15rem;
            /* small accent tick before the area name */
            padding-left: 0.6rem;
            border-left: 4px solid var(--accent, #3b82f6);
        }
        .group-blurb {
            font-size: 0.85rem;
            color: var(--tb-muted, #94a3b8);
        }
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 0.9rem;
    }

    .card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        height: 100%;
        text-align: left;
        background: var(--tb-panel, #fff);
        border: 1px solid var(--tb-border, #e2e8f0);
        border-radius: 14px;
        padding: 1rem 1.05rem 1.1rem;
        cursor: pointer;
        color: inherit;
        overflow: hidden;
        transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease;

        &:hover {
            transform: translateY(-3px);
            border-color: color-mix(in srgb, var(--accent, #3b82f6) 55%, var(--tb-border, #e2e8f0));
            box-shadow: 0 12px 26px color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent);
        }
        &:hover .arrow {
            transform: translateX(4px);
        }
        &:focus-visible {
            outline: 3px solid var(--accent, #3b82f6);
            outline-offset: 2px;
        }
    }

    /* colored accent stripe down the left edge of each card */
    .stripe {
        position: absolute;
        inset: 0 auto 0 0;
        width: 4px;
        background: var(--accent, #3b82f6);
        opacity: 0.85;
    }

    .card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.6rem;
        height: 2.6rem;
        font-size: 1.5rem;
        line-height: 1;
        border-radius: 12px;
        background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent);
    }

    .badge {
        font-size: 0.66rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 0.2rem 0.5rem;
        border-radius: 999px;

        &.lvl-warm {
            background: #fef3c7;
            color: #92400e;
        }
        &.lvl-core {
            background: #dbeafe;
            color: #1e40af;
        }
        &.lvl-adv {
            background: #ede9fe;
            color: #5b21b6;
        }
    }

    h3 {
        margin: 0.3rem 0 0;
        font-size: 1.05rem;
        line-height: 1.25;
    }

    .topic {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--tb-muted, #94a3b8);
    }

    .blurb {
        margin: 0.15rem 0 0;
        font-size: 0.88rem;
        line-height: 1.45;
        color: var(--tb-muted, #64748b);
    }

    .go {
        margin-top: auto;
        padding-top: 0.6rem;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--accent, #3b82f6);
    }

    .arrow {
        display: inline-block;
        transition: transform 0.15s ease;
    }

    .foot {
        margin-top: 2.5rem;
        padding-top: 1rem;
        border-top: 1px solid var(--tb-border, #e2e8f0);
        font-size: 0.82rem;
        color: var(--tb-muted, #94a3b8);
        line-height: 1.5;
    }

    @media (max-width: 560px) {
        h1 {
            font-size: 1.6rem;
        }
        .hero-side {
            align-items: flex-start;
        }
        .grid {
            grid-template-columns: 1fr;
        }
    }
</style>
